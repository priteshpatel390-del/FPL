/* GW1-P2D-P1 — diagnostic transport probe.
   ----------------------------------------
   Option A physical acceptance failed on 20 August 2026: a genuine Stage 10
   record stayed at `Waiting to archive` on a real iPhone in normal Safari with
   Prevent Cross-Site Tracking ON. The physical evidence did not isolate which
   stage failed, and the repository refuses to guess between Safari cookie
   policy, Cloudflare Access, CORS preflight, Worker configuration and client
   scheduling.

   This module is the smallest safe experiment that can tell those apart. It
   reproduces the exact failing request shape — same origin, same Access
   protected endpoint, same method, same Content-Type, same credentialled CORS
   mode — and changes exactly one thing: the body is a fixed, deliberately
   invalid, non-evidence probe payload.

   The deployed Worker rejects that body in `validateEnvelope()` before it
   reads or writes any evidence state, so a successful transport produces a
   deterministic `422 envelope_schema`. Reaching that response proves the whole
   browser -> Access -> Worker path; failing to reach it localises the failure.

   Deliberate non-behaviour, and the reason for each:
   - This module imports no evidence module. It cannot read, serialise,
     enqueue, hash, restamp or transmit a Stage 10 record, and in particular it
     can never touch the genuine GW1 record.
   - Attempt results live in memory only. Nothing is persisted, so no storage
     key, journal, index or outbox row is created or modified.
   - There is no scheduler, no retry, no backoff and no automatic attempt. One
     owner tap performs exactly one request. This is a diagnostic, not a
     delivery mechanism, and must not become one.
   - No cookie, JWT, Access identity, team domain, policy audience, account
     identifier, provider payload or response body is read, rendered or
     stored. Only the numeric HTTP status, the Worker's short error code from a
     fixed allow-list, and local timings are observed. */

import { $, el, setChildren } from '../util.mjs';

const PROBE_META = 'teamsheet-evidence-transport-probe';
const PROBE_ENDPOINT_PATH = '/v1/evidence/predeadline';
const PROBE_SIGN_IN_PATH = '/v1/health';
const PROBE_REQUEST_TIMEOUT_MS = 20000;
const PROBE_MAX_ATTEMPTS_SHOWN = 5;
const PROBE_EXPECTED_STATUS = 422;
const PROBE_EXPECTED_ERROR = 'envelope_schema';

/* The whole payload. It is a frozen module constant rather than anything
   derived at call time so that no caller, and no future edit, can route real
   evidence through this path. It carries no identity of any kind: no team,
   league, manager, snapshot, hash, provider or build field. The Worker's
   envelope validator requires exactly the keys
   archiveVersion/enqueuedAt/idempotencyKey/origin/record, so this object can
   only ever produce `envelope_schema`. */
const PROBE_PAYLOAD = Object.freeze({probe:'teamsheet-transport-check'});

/* Two request shapes against the same endpoint and the same invalid payload.
   `session` is an exact replica of the delivery request that failed physical
   acceptance. `control` differs in exactly two options — the Access session is
   not sent, and a redirect is surfaced instead of followed — so it exercises
   the browser preflight/CORS layer without depending on any cookie.

   Comparing the pair is the measurement. If `control` gets a readable answer
   or a surfaced redirect while `session` is blocked outright, then preflight
   and CORS work in general and the credentialled response specifically was
   refused by the browser. If both are blocked, the failure is below the
   session layer. Neither result names a cause on its own. */
const PROBE_MODES = Object.freeze({SESSION:'session', CONTROL:'control'});

const PROBE_OUTCOMES = Object.freeze({
  NOT_STARTED:'not_started',
  UNCONFIGURED:'unconfigured',
  BLOCKED_BEFORE_RESPONSE:'blocked_before_response',
  OPAQUE_REDIRECT:'opaque_redirect',
  TRANSPORT_PROVEN:'transport_proven',
  ACCESS_REJECTED:'access_rejected',
  ORIGIN_REJECTED:'origin_rejected',
  RATE_LIMITED:'rate_limited',
  ARCHIVE_UNAVAILABLE:'archive_unavailable',
  UNEXPECTED_RESPONSE:'unexpected_response'
});

/* Worker error codes this diagnostic is willing to repeat back. Anything else
   is reported as the category alone, so no server-controlled string can reach
   the screen. */
const PROBE_KNOWN_WORKER_ERRORS = Object.freeze([
  'envelope_schema','unauthorised','origin_not_allowed','rate_limited',
  'auth_not_configured','auth_keys_unavailable','storage_not_configured',
  'route_not_allowed','method_not_allowed','invalid_json','payload_too_large'
]);

function normaliseProbeEndpoint(value){
  if(typeof value !== 'string' || !value.trim()) return null;
  try{
    const url = new URL(value.trim());
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if(url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null;
    if(url.username || url.password || url.search || url.hash) return null;
    if(url.pathname !== PROBE_ENDPOINT_PATH) return null;
    /* A wildcard or Cloudflare preview hostname must never be probed: the
       accepted route state disables preview URLs, and a diagnostic that
       silently tested a different hostname would prove nothing about the
       hostname that actually failed. */
    if(/^\*|^[^.]*-teamsheet-evidence-archive\./.test(url.hostname)) return null;
    return url.origin + url.pathname;
  }catch(error){ return null; }
}

function configuredProbeEndpoint(documentRef = globalThis.document){
  const meta = documentRef?.querySelector?.(`meta[name="${PROBE_META}"]`);
  return normaliseProbeEndpoint(meta?.content || '');
}

/* Access sign-in is a first-party top-level navigation to the archive's own
   health route. It is never embedded, never scripted cross-site and never
   carries a payload. */
function probeSignInUrl(endpoint = configuredProbeEndpoint()){
  if(!endpoint) return null;
  try{ return new URL(endpoint).origin + PROBE_SIGN_IN_PATH; }
  catch(error){ return null; }
}

/* A short opaque value so one tap can be matched against one Cloudflare Access
   and Worker log line. It is random, carries no user, device or evidence
   identity, never reaches storage and never becomes an archive identity. It
   travels as a query parameter because the Worker's preflight contract allows
   only Content-Type: adding a custom header would fail the preflight and
   destroy the very measurement this probe exists to take. */
function newCorrelationId(randomFn){
  const bytes = new Uint8Array(4);
  if(typeof randomFn === 'function') randomFn(bytes);
  else if(globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for(let i=0;i<bytes.length;i++) bytes[i] = Math.floor(Math.random()*256);
  return Array.from(bytes, byte => byte.toString(16).padStart(2,'0')).join('');
}

function probeRequestUrl(endpoint, correlationId){
  return `${endpoint}?probe=${encodeURIComponent(correlationId)}`;
}

function knownWorkerError(code){
  return PROBE_KNOWN_WORKER_ERRORS.includes(String(code||'')) ? String(code) : null;
}

function classifyProbeResponse({status, workerError} = {}){
  const code = Number(status);
  const error = knownWorkerError(workerError);
  if(code === PROBE_EXPECTED_STATUS && error === PROBE_EXPECTED_ERROR) return PROBE_OUTCOMES.TRANSPORT_PROVEN;
  if(code === 403 && error === 'origin_not_allowed') return PROBE_OUTCOMES.ORIGIN_REJECTED;
  if(code === 401 || code === 403) return PROBE_OUTCOMES.ACCESS_REJECTED;
  if(code === 429) return PROBE_OUTCOMES.RATE_LIMITED;
  if(code === 503) return PROBE_OUTCOMES.ARCHIVE_UNAVAILABLE;
  return PROBE_OUTCOMES.UNEXPECTED_RESPONSE;
}

/* Only the Worker's own short error code is read, and only from the fixed
   allow-list above. The response body is never rendered, stored or logged. */
async function probeWorkerErrorCode(response){
  try{
    const body = await response.json();
    return knownWorkerError(body?.error);
  }catch(error){ return null; }
}

const probeAttemptLog = [];
let probeInFlight = false;

function probeAttempts(){ return probeAttemptLog.slice(); }
function resetProbeAttempts(){ probeAttemptLog.length = 0; }

/* Exactly one request per call. There is deliberately no queue, no timer, no
   retry and no `nextAttemptAt`, so nothing in this path can be blocked by, or
   can modify, evidence delivery scheduling. */
async function runTransportProbe({
  fetchFn = globalThis.fetch,
  nowFn = Date.now,
  randomFn = null,
  documentRef = globalThis.document,
  mode = PROBE_MODES.SESSION
} = {}){
  const endpoint = configuredProbeEndpoint(documentRef);
  const sequence = probeAttemptLog.length + 1;
  const requestedAt = nowFn();
  const control = mode === PROBE_MODES.CONTROL;
  if(!endpoint){
    const attempt = Object.freeze({sequence,mode,requestedAt,startedAt:null,completedAt:nowFn(),durationMs:null,
      outcome:PROBE_OUTCOMES.UNCONFIGURED,status:null,workerError:null,correlationId:null});
    probeAttemptLog.push(attempt);
    return attempt;
  }
  const correlationId = newCorrelationId(randomFn);
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller && typeof setTimeout === 'function'
    ? setTimeout(() => controller.abort(), PROBE_REQUEST_TIMEOUT_MS) : null;
  const startedAt = nowFn();
  let outcome, status = null, workerError = null;
  try{
    /* This is the measurement. Every option below is deliberately identical to
       the delivery request that failed physical acceptance, so that a result
       here is evidence about that request and not about a different one.
       credentials:'include' is what would carry the Cloudflare Access session
       cross-site; this code never reads the cookie it relies on. */
    const response = await fetchFn(probeRequestUrl(endpoint,correlationId),{
      method:'POST',
      mode:'cors',
      credentials:control ? 'omit' : 'include',
      redirect:control ? 'manual' : 'follow',
      cache:'no-store',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(PROBE_PAYLOAD),
      ...(controller ? {signal:controller.signal} : {})
    });
    if(!response) outcome = PROBE_OUTCOMES.BLOCKED_BEFORE_RESPONSE;
    else if(response.type === 'opaqueredirect') outcome = PROBE_OUTCOMES.OPAQUE_REDIRECT;
    else{
      status = Number(response.status);
      workerError = await probeWorkerErrorCode(response);
      outcome = classifyProbeResponse({status,workerError});
    }
  }catch(error){
    /* A blocked Access cookie, a refused preflight, an Access redirect the
       script may not read and a genuine network failure are indistinguishable
       here. All of them are reported as one honest category; the exception is
       never inspected, because its text can contain the request URL. */
    outcome = PROBE_OUTCOMES.BLOCKED_BEFORE_RESPONSE;
  }finally{ if(timer) clearTimeout(timer); }
  const completedAt = nowFn();
  const attempt = Object.freeze({sequence,mode,requestedAt,startedAt,completedAt,
    durationMs:Math.max(0,completedAt-startedAt),outcome,status,workerError,correlationId});
  probeAttemptLog.push(attempt);
  return attempt;
}

/* Fixed owner-facing copy. Every string is a literal here; nothing the server
   returns reaches the screen. The wording never says archive, upload, send
   evidence or archive now, because this action must not be confused with
   evidence custody. */
const PROBE_COPY = Object.freeze({
  [PROBE_OUTCOMES.NOT_STARTED]:['No check has been run','Sign in first, return here, then run one check.','plain'],
  [PROBE_OUTCOMES.UNCONFIGURED]:['Check unavailable','This build has no diagnostic endpoint configured, so no request was made.','plain'],
  [PROBE_OUTCOMES.BLOCKED_BEFORE_RESPONSE]:['No response reached Teamsheet','The request was started but the browser returned no readable response. This points at the browser, network, preflight or sign-in boundary. Check the archive logs for this attempt.','bad'],
  [PROBE_OUTCOMES.OPAQUE_REDIRECT]:['Redirected to sign-in','The connection itself worked and the archive redirected the request to sign-in. For the sign-in-free control check this is the expected healthy answer.','plain'],
  [PROBE_OUTCOMES.TRANSPORT_PROVEN]:['Connection reached the archive','The archive received this check and rejected the deliberately invalid test message exactly as expected. The connection itself works in this test.','good'],
  [PROBE_OUTCOMES.ACCESS_REJECTED]:['Sign-in was not accepted','The request reached the archive but was not recognised as signed in. Sign in again, return here and repeat the check.','bad'],
  [PROBE_OUTCOMES.ORIGIN_REJECTED]:['Address not permitted','The archive refused this address. This is a configuration result, not a browser result.','bad'],
  [PROBE_OUTCOMES.RATE_LIMITED]:['Too many checks','The archive asked Teamsheet to wait. Leave it a minute, then run one more check.','plain'],
  [PROBE_OUTCOMES.ARCHIVE_UNAVAILABLE]:['Archive not ready','The archive reported that it is not currently configured to answer. This is a server-side result.','bad'],
  [PROBE_OUTCOMES.UNEXPECTED_RESPONSE]:['Unexpected reply','The archive answered with something this check did not expect. Record the details below before drawing any conclusion.','bad']
});

function probeCopy(outcome){ return PROBE_COPY[outcome] || PROBE_COPY[PROBE_OUTCOMES.UNEXPECTED_RESPONSE]; }

/* Bounded, non-sensitive technical detail, present only so one tap can be
   matched to one archive log line. */
function probeDetailLine(attempt){
  const parts = [`Check ${attempt.sequence}`,
    attempt.mode === PROBE_MODES.CONTROL ? 'sign-in-free control' : 'signed-in check'];
  const startedAt = Number.isFinite(attempt.startedAt) ? attempt.startedAt : attempt.requestedAt;
  parts.push(`started ${new Date(startedAt).toISOString().replace('T',' ').slice(0,19)} UTC`);
  if(Number.isFinite(attempt.durationMs)) parts.push(`took ${attempt.durationMs} ms`);
  parts.push(Number.isFinite(attempt.status) && attempt.status ? `HTTP ${attempt.status}` : 'no HTTP status visible');
  if(attempt.workerError) parts.push(`archive code ${attempt.workerError}`);
  if(attempt.correlationId) parts.push(`reference ${attempt.correlationId}`);
  return parts.join(' · ');
}

function renderProbeResult(){
  const node = $('transportProbeResult');
  if(!node) return;
  const attempts = probeAttemptLog.slice(-PROBE_MAX_ATTEMPTS_SHOWN).reverse();
  if(!attempts.length){
    const [title,detail] = probeCopy(PROBE_OUTCOMES.NOT_STARTED);
    setChildren(node,el('article',{class:'note plain'},el('b',{},title),el('div',{class:'status'},detail)));
    return;
  }
  setChildren(node,attempts.map(attempt => {
    const [title,detail,tone] = probeCopy(attempt.outcome);
    return el('article',{class:`note ${tone}`},
      el('b',{},title),
      el('div',{class:'status'},detail),
      el('div',{class:'status mono'},probeDetailLine(attempt)));
  }));
}

/* The route host only exists once the settings shell has built its routes, so
   the panel is created on demand and its two listeners are attached to the
   freshly created buttons. The panel-exists guard keeps that to exactly one
   binding per button for the life of the page. */
function ensureTransportProbeUi(){
  const host = $('evidenceTransportProbeHost');
  if(!host || $('evidenceTransportProbePanel')) return;
  const configured = Boolean(configuredProbeEndpoint());
  const signInButton = el('button',{class:'btn ghost',id:'transportProbeSignInBtn',type:'button',...(configured?{}:{disabled:true})},'Open archive sign-in');
  const runButton = el('button',{class:'btn ghost',id:'runTransportProbeBtn',type:'button',...(configured?{}:{disabled:true})},'Run one connection check');
  const controlButton = el('button',{class:'btn ghost',id:'runTransportControlBtn',type:'button',...(configured?{}:{disabled:true})},'Run sign-in-free control check');
  signInButton.addEventListener('click',openProbeSignIn);
  runButton.addEventListener('click',() => handleProbeClick(PROBE_MODES.SESSION));
  controlButton.addEventListener('click',() => handleProbeClick(PROBE_MODES.CONTROL));
  const panel = el('section',{class:'panel settings-content-panel',id:'evidenceTransportProbePanel'},
    el('span',{class:'eyebrow'},'Connection diagnostic'),
    el('h3',{},'Archive connection check'),
    el('p',{class:'hint'},'This checks whether this iPhone can reach the evidence archive at all. It sends one deliberately invalid test message and expects to be rejected. It never sends, reads, changes or deletes your saved deadline evidence.'),
    el('div',{class:'evidence-actions'},signInButton,runButton,controlButton),
    el('p',{class:'status'},'Sign in first, return to Teamsheet, then run one signed-in check. The control check deliberately does not send your sign-in, so comparing the two shows whether the connection or the sign-in is the problem. Run one at a time and note the reference shown.'),
    el('div',{id:'transportProbeResult'}));
  host.appendChild(panel);
  renderProbeResult();
}

function openProbeSignIn(){
  const url = probeSignInUrl();
  if(url && globalThis.location?.assign) globalThis.location.assign(url);
}

async function handleProbeClick(mode){
  if(probeInFlight) return;
  probeInFlight = true;
  const buttons = [$('runTransportProbeBtn'),$('runTransportControlBtn')].filter(Boolean);
  buttons.forEach(button => { button.disabled = true; });
  const node = $('transportProbeResult');
  if(node) setChildren(node,el('article',{class:'note plain'},el('b',{},'Check running'),el('div',{class:'status'},'One request is in progress.')));
  try{ await runTransportProbe({mode}); }
  finally{
    probeInFlight = false;
    buttons.forEach(button => { button.disabled = false; });
    renderProbeResult();
  }
}

function initEvidenceTransportProbeUi(){
  if(typeof document === 'undefined') return;
  ensureTransportProbeUi();
  document.addEventListener('teamsheet:route-change',ensureTransportProbeUi);
  document.addEventListener('teamsheet:data-rendered',ensureTransportProbeUi);
}

initEvidenceTransportProbeUi();

export {
  PROBE_META,
  PROBE_MODES,
  PROBE_ENDPOINT_PATH,
  PROBE_SIGN_IN_PATH,
  PROBE_PAYLOAD,
  PROBE_OUTCOMES,
  PROBE_KNOWN_WORKER_ERRORS,
  PROBE_EXPECTED_STATUS,
  PROBE_EXPECTED_ERROR,
  PROBE_REQUEST_TIMEOUT_MS,
  normaliseProbeEndpoint,
  configuredProbeEndpoint,
  probeSignInUrl,
  newCorrelationId,
  probeRequestUrl,
  classifyProbeResponse,
  probeCopy,
  probeDetailLine,
  probeAttempts,
  resetProbeAttempts,
  runTransportProbe,
  ensureTransportProbeUi,
  renderProbeResult,
  initEvidenceTransportProbeUi
};
