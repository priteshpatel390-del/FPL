/* GW1-P2 — browser evidence delivery.

   Owns storage, transport, scheduling and the minimal status surface for the
   evidence outbox. The state machine itself lives in src/evidence/outbox.mjs
   and knows nothing about Cloudflare, so replacing this transport replaces
   only this file.

   The hard rule of this module: the FPL recommendation never waits for it and
   never fails because of it. Delivery is scheduled on its own timers, never
   inside runVerifiedRefresh(), and every path is wrapped so an archive fault
   can only produce a status line. */

import { S } from '../state.mjs';
import { $, el, setChildren } from '../util.mjs';
import { FPL_RULES } from '../config.mjs';
import { recordStage10Diagnostic } from './evidence-recovery.mjs';
import {
  K_EVIDENCE_OUTBOX, rawEvidenceGet, rawEvidenceSet, loadEvidenceRecord
} from './evidence.mjs';
import {
  OUTBOX_RULES, OUTBOX_STATES, DELIVERY_OUTCOMES,
  normaliseOutbox, enqueueRecord, envelopeText, classifyResponse,
  applyDeliveryOutcome, dueRow, resumePausedRows, outboxSummary, pinnedSnapshotIds
} from '../evidence/outbox.mjs';
import { stableStringify } from '../evidence/snapshot.mjs';

const EVIDENCE_ARCHIVE_META = 'teamsheet-evidence-archive';
const DELIVERY_SCHEDULE_MS = 5 * 60 * 1000;
const DELIVERY_ENQUEUE_DELAY_MS = 5 * 1000;
const DELIVERY_REQUEST_TIMEOUT_MS = 120 * 1000;
let deliveryBusy = false;
let deliveryTimer = null;

/* Same shape of contract as the Official FPL gateway meta: an exact HTTPS
   origin plus the one approved ingestion path, or nothing at all. An
   unconfigured archive is a supported state — delivery simply never runs. */
function normaliseArchiveEndpoint(value){
  if(typeof value !== 'string' || !value.trim()) return null;
  try{
    const url = new URL(value.trim());
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if(url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null;
    if(url.username || url.password || url.search || url.hash) return null;
    if(url.pathname !== '/v1/evidence/predeadline') return null;
    return url.origin + url.pathname;
  }catch(error){ return null; }
}
function configuredArchiveEndpoint(documentRef = globalThis.document){
  const injected = normaliseArchiveEndpoint(globalThis.__TEAMSHEET_EVIDENCE_ARCHIVE__);
  if(injected) return injected;
  const meta = documentRef?.querySelector?.(`meta[name="${EVIDENCE_ARCHIVE_META}"]`);
  return normaliseArchiveEndpoint(meta?.content || '');
}
/* The Access sign-in target. Authenticating is a first-party top-level
   navigation to the archive's own health route; it is never an embedded
   request and never carries evidence. */
function archiveSignInUrl(endpoint = configuredArchiveEndpoint()){
  if(!endpoint) return null;
  try{ return new URL(endpoint).origin + '/v1/health'; }catch(error){ return null; }
}

async function loadOutbox(){
  const raw = await rawEvidenceGet(K_EVIDENCE_OUTBOX);
  if(!raw) return [];
  try{ return normaliseOutbox(JSON.parse(raw),{season:FPL_RULES.season}); }
  catch(error){
    recordStage10Diagnostic('outbox_corrupt',{recordType:'preDeadlineSnapshot',severity:'error',message:error.message});
    return [];
  }
}
async function saveOutbox(rows){
  await rawEvidenceSet(K_EVIDENCE_OUTBOX,stableStringify(rows));
  return rows;
}
/* Read-only for src/ui/evidence.mjs: which stored records must survive the
   bounded local-retention sweep because they still owe the archive a copy. */
async function pinnedEvidenceIds(){
  try{ return pinnedSnapshotIds(await loadOutbox()); }
  catch(error){ return []; }
}

async function enqueueEvidenceForDelivery(record){
  try{
    const rows = await loadOutbox();
    const result = enqueueRecord(rows,record,{enqueuedAt:Date.now()});
    if(!result.added) return result.row;
    await saveOutbox(result.rows);
    if(result.row.state === OUTBOX_STATES.BLOCKED_RETENTION)
      recordStage10Diagnostic('archive_retention_blocked',{recordType:'preDeadlineSnapshot',
        recordId:result.row.snapshotId,severity:'warning',message:'provider retention is not approved'});
    return result.row;
  }catch(error){
    /* A failed outbox write never invalidates the record that is already
       saved locally, and never touches the recommendation. */
    recordStage10Diagnostic('outbox_unavailable',{recordType:'preDeadlineSnapshot',
      recordId:record?.identity?.snapshotId,severity:'warning',message:error.message});
    return null;
  }
}

function retryAfterMs(response){
  const header = Number(response?.headers?.get?.('Retry-After'));
  return Number.isFinite(header) && header > 0 ? header * 1000 : null;
}
/* Amendment 4 — the Worker's own JSON error code is read when a body is
   available. When Cloudflare Access answers ahead of the Worker there is no
   parsable body, and null is returned so the outcome resolves to an identity
   problem rather than a Worker configuration defect. */
async function workerErrorCode(response){
  try{
    const type = String(response?.headers?.get?.('Content-Type')||'');
    if(!/application\/json/i.test(type)) return null;
    const body = await response.json();
    const code = body?.error;
    return typeof code === 'string' && code ? code : null;
  }catch(error){ return null; }
}
async function successManifest(response){
  try{ return (await response.json())?.manifest || null; }
  catch(error){ return null; }
}

async function postEvidence(endpoint,text,{fetchFn = globalThis.fetch} = {}){
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(),DELIVERY_REQUEST_TIMEOUT_MS) : null;
  try{
    /* credentials:'include' is what carries the Cloudflare Access session.
       mode:'cors' with an exact-origin, credentialled Worker response is the
       whole transport; no token, cookie or header is read by this code. */
    return await fetchFn(endpoint,{
      method:'POST',
      mode:'cors',
      credentials:'include',
      cache:'no-store',
      headers:{'Content-Type':'application/json'},
      body:text,
      ...(controller ? {signal:controller.signal} : {})
    });
  }finally{ if(timer) clearTimeout(timer); }
}

async function deliverRow(row,endpoint,{fetchFn = globalThis.fetch,now = Date.now()} = {}){
  const record = await loadEvidenceRecord(row.snapshotId);
  if(!record || record.identity?.contentHash !== row.contentHash)
    return {outcome:DELIVERY_OUTCOMES.RECORD_UNAVAILABLE,manifest:null,retryAfter:null};
  let text;
  try{ text = envelopeText(row,record); }
  catch(error){ return {outcome:DELIVERY_OUTCOMES.RECORD_UNAVAILABLE,manifest:null,retryAfter:null}; }
  if(text.length > OUTBOX_RULES.maxCanonicalBytes)
    return {outcome:DELIVERY_OUTCOMES.PAYLOAD_TOO_LARGE,manifest:null,retryAfter:null};
  let response;
  try{ response = await postEvidence(endpoint,text,{fetchFn}); }
  catch(error){
    /* A blocked Access cookie, a CORS refusal and a genuine network failure
       are indistinguishable to script here. All three classify as transport
       unavailability, never as evidence rejection. */
    return {outcome:DELIVERY_OUTCOMES.NETWORK_UNAVAILABLE,manifest:null,retryAfter:null};
  }
  if(!response || response.type === 'opaqueredirect')
    return {outcome:DELIVERY_OUTCOMES.AUTH_UNAVAILABLE,manifest:null,retryAfter:null};
  const status = Number(response.status);
  if(status === 200 || status === 201){
    const manifest = await successManifest(response);
    return {outcome:classifyResponse({status}),manifest,retryAfter:null};
  }
  const code = await workerErrorCode(response);
  return {outcome:classifyResponse({status,workerError:code}),manifest:null,retryAfter:retryAfterMs(response)};
}

async function flushOutbox({fetchFn = globalThis.fetch,nowFn = Date.now,maxRows = 3} = {}){
  if(deliveryBusy) return {delivered:0,reason:'busy'};
  const endpoint = configuredArchiveEndpoint();
  if(!endpoint) return {delivered:0,reason:'not_configured'};
  if(globalThis.navigator && globalThis.navigator.onLine === false) return {delivered:0,reason:'offline'};
  deliveryBusy = true;
  let delivered = 0;
  try{
    for(let i = 0; i < maxRows; i++){
      const rows = await loadOutbox();
      const row = dueRow(rows,{now:nowFn()});
      if(!row) return {delivered,reason:delivered ? 'complete' : 'nothing_due'};
      const result = await deliverRow(row,endpoint,{fetchFn,now:nowFn()});
      const next = applyDeliveryOutcome(row,result.outcome,
        {now:nowFn(),manifest:result.manifest,retryAfterMs:result.retryAfter});
      await saveOutbox(rows.map(item => item.contentHash === row.contentHash ? next : item));
      if(next.state === OUTBOX_STATES.SENT || next.state === OUTBOX_STATES.DUPLICATE) delivered++;
      else if(next.state !== OUTBOX_STATES.PENDING) return {delivered,reason:next.state};
      else if(result.outcome !== DELIVERY_OUTCOMES.ACCEPTED) return {delivered,reason:result.outcome};
    }
    return {delivered,reason:'batch_limit'};
  }catch(error){
    recordStage10Diagnostic('archive_delivery_failed',{recordType:'preDeadlineSnapshot',
      severity:'warning',message:error.message});
    return {delivered,reason:'error'};
  }finally{
    deliveryBusy = false;
    await renderDeliveryStatus().catch(() => {});
  }
}
function scheduleDelivery(delayMs = DELIVERY_ENQUEUE_DELAY_MS){
  if(typeof setTimeout !== 'function') return null;
  if(deliveryTimer) clearTimeout(deliveryTimer);
  deliveryTimer = setTimeout(() => { deliveryTimer = null; void flushOutbox(); },Math.max(0,delayMs));
  return deliveryTimer;
}

/* Every user-facing string below is fixed here. No server message, status
   code, header, URL, identity or configuration detail reaches the page. */
const DELIVERY_COPY = Object.freeze({
  not_configured:['Cloud archive not configured','Records stay on this device only.'],
  nothing:['Nothing waiting','Every eligible record on this device has been archived.'],
  pending:['Waiting to archive','Saved on this device. Teamsheet will keep trying in the background.'],
  auth:['Sign-in needed','Connect to the evidence archive to upload the records saved on this device.'],
  paused:['Archiving paused','Records remain saved on this device. Try again when convenient.'],
  blocked:['Archiving not approved','Some records contain provider data that is not approved for cloud retention. They stay on this device.'],
  rejected:['Not accepted','The archive did not accept a record. It remains saved on this device.'],
  expired:['No longer stored','A record awaiting upload was removed to protect device storage.'],
  archived:['Archived','Evidence is stored in the cloud archive.']
});
function deliveryCopyKey(summary,configured){
  if(!configured) return 'not_configured';
  if(summary.expiredLocal) return 'expired';
  if(summary.blockedRetention) return 'blocked';
  if(summary.paused) return summary.lastOutcome === DELIVERY_OUTCOMES.AUTH_UNAVAILABLE ? 'auth' : 'paused';
  if(summary.pending) return summary.lastOutcome === DELIVERY_OUTCOMES.AUTH_UNAVAILABLE ? 'auth' : 'pending';
  if(summary.rejected) return 'rejected';
  if(summary.archived) return 'archived';
  return 'nothing';
}
function ensureDeliveryUi(){
  const host = $('evidenceDeliveryHost');
  if(!host || $('evidenceDeliveryPanel')) return;
  const panel = el('section',{class:'panel settings-content-panel',id:'evidenceDeliveryPanel'},
    el('span',{class:'eyebrow'},'Cloud archive'),
    el('h3',{},'Evidence archiving'),
    el('p',{class:'hint'},'Archiving runs in the background and never affects your recommendation. Records are always saved on this device first.'),
    el('div',{class:'note plain',id:'evidenceDeliveryStatus'},el('b',{},'Nothing waiting'),document.createTextNode(' Every eligible record on this device has been archived.')),
    el('div',{class:'evidence-actions'},
      el('button',{class:'btn ghost',id:'evidenceSignInBtn',type:'button'},'Connect evidence archive'),
      el('button',{class:'btn ghost',id:'evidenceRetryBtn',type:'button'},'Try archiving now')),
    el('p',{class:'status evidence-message',id:'evidenceDeliveryMessage'},'Archiving is optional. Teamsheet works fully without it.'));
  host.appendChild(panel);
}
async function renderDeliveryStatus(){
  ensureDeliveryUi();
  const node = $('evidenceDeliveryStatus');
  if(!node) return null;
  const configured = Boolean(configuredArchiveEndpoint());
  const summary = outboxSummary(await loadOutbox());
  const [title,detail] = DELIVERY_COPY[deliveryCopyKey(summary,configured)];
  setChildren(node,el('b',{},title),document.createTextNode(' ' + detail));
  node.className = `note ${summary.archived && !summary.pending && !summary.paused ? 'good' : 'plain'}`;
  const signIn = $('evidenceSignInBtn');
  if(signIn) signIn.disabled = !configured;
  const retry = $('evidenceRetryBtn');
  if(retry) retry.disabled = !configured || deliveryBusy;
  return summary;
}
function openArchiveSignIn(){
  const url = archiveSignInUrl();
  if(!url) return null;
  /* A top-level user-initiated navigation: Cloudflare Access can only present
     its sign-in as a first-party page, never inside a background request. */
  globalThis.open?.(url,'_blank','noopener');
  return url;
}
async function retryArchiveDelivery({includeBlocked = false} = {}){
  const message = $('evidenceDeliveryMessage');
  try{
    const rows = await loadOutbox();
    await saveOutbox(resumePausedRows(rows,{now:Date.now(),includeBlocked}));
    if(message) message.textContent = 'Trying to archive the records saved on this device…';
    const result = await flushOutbox();
    if(message) message.textContent = result.delivered
      ? 'Archiving finished for the records that could be uploaded.'
      : 'Nothing could be archived yet. Records remain saved on this device.';
    return result;
  }catch(error){
    if(message) message.textContent = 'Archiving could not run. Records remain saved on this device.';
    return null;
  }
}

function initEvidenceDeliveryUi(){
  if(typeof document === 'undefined') return;
  ensureDeliveryUi();
  $('evidenceSignInBtn')?.addEventListener('click',openArchiveSignIn);
  $('evidenceRetryBtn')?.addEventListener('click',() => void retryArchiveDelivery());
  /* Enqueue is driven by an event, so src/ui/evidence.mjs never depends on the
     delivery layer and Stage 10 capture cannot be delayed by it. */
  document.addEventListener('teamsheet:evidence-stored',event => {
    const record = event.detail?.record;
    if(!record) return;
    const task = enqueueEvidenceForDelivery(record).then(() => { scheduleDelivery(); });
    if(typeof event.detail?.waitUntil === 'function') event.detail.waitUntil(task);
    else void task;
  });
  document.addEventListener('teamsheet:data-rendered',() => void renderDeliveryStatus());
  document.addEventListener('teamsheet:data-verified',() => { scheduleDelivery(DELIVERY_ENQUEUE_DELAY_MS); });
  document.addEventListener('visibilitychange',() => {
    if(!document.visibilityState || document.visibilityState === 'visible') scheduleDelivery(DELIVERY_ENQUEUE_DELAY_MS);
  });
  setInterval(() => {
    if(!document.visibilityState || document.visibilityState === 'visible') void flushOutbox();
  },DELIVERY_SCHEDULE_MS);
  void renderDeliveryStatus().then(() => scheduleDelivery(DELIVERY_ENQUEUE_DELAY_MS));
}

initEvidenceDeliveryUi();

export {
  EVIDENCE_ARCHIVE_META,
  DELIVERY_SCHEDULE_MS,
  DELIVERY_ENQUEUE_DELAY_MS,
  DELIVERY_COPY,
  normaliseArchiveEndpoint,
  configuredArchiveEndpoint,
  archiveSignInUrl,
  loadOutbox,
  saveOutbox,
  pinnedEvidenceIds,
  enqueueEvidenceForDelivery,
  deliverRow,
  flushOutbox,
  scheduleDelivery,
  deliveryCopyKey,
  renderDeliveryStatus,
  openArchiveSignIn,
  retryArchiveDelivery,
  ensureDeliveryUi,
  initEvidenceDeliveryUi
};
