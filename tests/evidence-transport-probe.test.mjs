/* GW1-P2D-P1 — diagnostic transport probe regressions.
   ----------------------------------------------------
   These tests hold the safety boundary of a diagnostic, not the correctness of
   a delivery mechanism. The probe exists to isolate the stage at which Option A
   failed physical acceptance, and the danger of any such experiment is that it
   quietly acquires the powers of the thing it is measuring: evidence access,
   persistence, scheduling or custody. Each test below pins one of those doors
   shut. They prove nothing about live Safari, Cloudflare Access or the physical
   iPhone result, which only the owner's physical test can establish. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PROBE_META, PROBE_MODES, PROBE_ENDPOINT_PATH, PROBE_SIGN_IN_PATH, PROBE_PAYLOAD, PROBE_OUTCOMES,
  PROBE_EXPECTED_STATUS, PROBE_EXPECTED_ERROR, PROBE_KNOWN_WORKER_ERRORS,
  normaliseProbeEndpoint, configuredProbeEndpoint, probeSignInUrl, newCorrelationId,
  probeRequestUrl, classifyProbeResponse, probeCopy, probeDetailLine,
  probeAttempts, resetProbeAttempts, runTransportProbe
} from '../src/ui/evidence-transport-probe.mjs';
import { handleEvidenceArchiveRequest, validateEnvelope } from '../workers/evidence-archive-core.mjs';
import { normaliseTeamsheetRoute, teamsheetRouteMeta } from '../src/ui/app-shell.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(ROOT, path), 'utf8');
const PROBE_SOURCE = read('src/ui/evidence-transport-probe.mjs');
/* Comment prose legitimately names the things the probe must not do. Code-level
   guards therefore scan the source with comments removed. */
const PROBE_CODE = PROBE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const ARCHIVE_ORIGIN = 'https://teamsheet-evidence-archive.fpltsheet.workers.dev';
const APP_ORIGIN = 'https://priteshpatel390-del.github.io';
const ENDPOINT = `${ARCHIVE_ORIGIN}${PROBE_ENDPOINT_PATH}`;

const documentWith = content => ({querySelector:selector =>
  selector === `meta[name="${PROBE_META}"]` ? (content === null ? null : {content}) : null});

function fetchRecorder(responder){
  const calls = [];
  return {calls, fetchFn:(url, options) => { calls.push({url, options}); return responder(url, options); }};
}
const jsonResponse = (status, body) => ({status, type:'basic', json: async () => body});

/* ---------- 1. The probe can never read or serialise Stage 10 evidence ---------- */

test('the diagnostic probe imports no evidence module and names no evidence storage key', () => {
  const imports = [...PROBE_SOURCE.matchAll(/^import\s[^;]*?from\s+'([^']+)';/gm)].map(match => match[1]);
  assert.deepEqual(imports, ['../util.mjs'],
    'the probe may import DOM helpers only; importing any evidence module would give it a path to Stage 10 records');
  for (const forbidden of ['evidence/snapshot', 'evidence-recovery', './evidence.mjs', 'outbox', 'evidence-delivery', 'storage.mjs']) {
    assert.ok(!PROBE_CODE.includes(forbidden), `the probe references ${forbidden}, which would couple a diagnostic to evidence custody`);
  }
  for (const key of ['fpl:evidence', 'fpl:cache', 'snapshotId', 'contentHash', 'capturePreDeadlineSnapshot', 'stableStringify']) {
    assert.ok(!PROBE_CODE.includes(key), `the probe names ${key}; it must not be able to reach or reproduce evidence state`);
  }
});

test('the genuine GW1 record identity appears nowhere in the diagnostic path', () => {
  /* The immutable prospective record captured on 20 August 2026. The probe must
     have no way to name, load, replay or transmit it. */
  for (const path of ['src/ui/evidence-transport-probe.mjs', 'src/ui/app-shell.mjs', 'app.html', 'build.mjs']) {
    assert.ok(!read(path).includes('predeadline-gw1-3fec5b2f1e134e52'),
      `${path} names the genuine GW1 Stage 10 record`);
  }
});

test('the probe payload is a frozen constant carrying no project or user identity', () => {
  assert.ok(Object.isFrozen(PROBE_PAYLOAD), 'the probe payload must be frozen so no caller can substitute evidence');
  assert.deepEqual(Object.keys(PROBE_PAYLOAD), ['probe']);
  assert.deepEqual(PROBE_PAYLOAD, {probe:'teamsheet-transport-check'},
    'the probe payload is a fixed literal; any derived value could carry real data');
  const text = JSON.stringify(PROBE_PAYLOAD);
  assert.ok(text.length < 120, 'the probe payload must stay tiny');
  assert.doesNotMatch(text, /\d/, 'the probe payload carries no numeric identifier of any kind');
  /* The Worker's own forbidden-key rule, applied to the probe body. */
  const forbiddenKey = /^(?:api[-_]?key|odds[-_]?key|authorization|password|secret|access[-_]?token|token|team[-_]?id|entry(?:[-_]?id)?|league[-_]?id|manager[-_]?name|email|phone)$/i;
  for (const key of Object.keys(PROBE_PAYLOAD)) assert.doesNotMatch(key, forbiddenKey);
  for (const forbidden of [/teamId/i, /entryId/i, /leagueId/i, /manager/i, /captain/i, /squad/i,
                           /token/i, /cookie/i, /jwt/i, /email/i, /odds/i, /understat/i, /snapshot/i]) {
    assert.doesNotMatch(text, forbidden, `the probe payload matches a forbidden identity pattern: ${forbidden}`);
  }
});

/* ---------- 2. The probe cannot create R2 or D1 evidence custody ---------- */

test('the probe payload is rejected by envelope validation before any evidence work', () => {
  const result = validateEnvelope(PROBE_PAYLOAD);
  assert.equal(result.ok, false);
  assert.equal(result.reason, PROBE_EXPECTED_ERROR,
    'the probe must fail at the envelope gate, which runs before record validation, R2 and D1');
});

test('an authenticated probe request touches no R2 object and no evidence or receipt table', async () => {
  const statements = [];
  const bucket = new Proxy({}, {get(target, property){
    throw new Error(`the probe reached R2 via ${String(property)}`);
  }});
  const db = {prepare(sql){
    statements.push(sql);
    if(/rate_limit_windows/.test(sql)) return {bind:() => ({first: async () => ({request_count:1})})};
    throw new Error(`the probe reached an unexpected D1 statement: ${sql}`);
  }};
  const request = new Request(`${ENDPOINT}?probe=abcd1234`, {
    method:'POST', headers:{'Origin':APP_ORIGIN,'Content-Type':'application/json'},
    body:JSON.stringify(PROBE_PAYLOAD)
  });
  const response = await handleEvidenceArchiveRequest(request, {EVIDENCE_DB:db, EVIDENCE_BUCKET:bucket},
    {authVerifier: async () => ({sub:'probe-subject'})});
  assert.equal(response.status, PROBE_EXPECTED_STATUS);
  assert.deepEqual(await response.json(), {error:PROBE_EXPECTED_ERROR});
  assert.ok(statements.every(sql => /rate_limit_windows/.test(sql)),
    `the probe issued a non-rate-limit statement: ${statements.filter(sql => !/rate_limit_windows/.test(sql)).join(' | ')}`);
  assert.ok(!statements.some(sql => /INSERT INTO evidence_records|INSERT INTO ingest_receipts/.test(sql)),
    'the probe must never write an evidence manifest or ingest receipt');
});

test('the expected probe rejection is deterministic across repeated identical requests', async () => {
  const results = [];
  for (let i = 0; i < 3; i++) {
    const db = {prepare:() => ({bind:() => ({first: async () => ({request_count:1})})})};
    const response = await handleEvidenceArchiveRequest(
      new Request(`${ENDPOINT}?probe=repeat${i}`, {
        method:'POST', headers:{'Origin':APP_ORIGIN,'Content-Type':'application/json'},
        body:JSON.stringify(PROBE_PAYLOAD)
      }),
      {EVIDENCE_DB:db, EVIDENCE_BUCKET:{}},
      {authVerifier: async () => ({sub:'probe-subject'})});
    results.push([response.status, JSON.stringify(await response.json()),
      response.headers.get('Access-Control-Allow-Origin')]);
  }
  assert.deepEqual(results, Array.from({length:3}, () =>
    [PROBE_EXPECTED_STATUS, JSON.stringify({error:PROBE_EXPECTED_ERROR}), APP_ORIGIN]),
    'the diagnostic depends on one deterministic controlled rejection');
});

/* ---------- 3. No persistence, no outbox row, no scheduling ---------- */

test('the probe writes nothing to browser storage and keeps attempts in memory only', async () => {
  const trap = new Proxy({}, {get(target, property){
    throw new Error(`the probe reached persistent storage via ${String(property)}`);
  }});
  const originalLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'localStorage', {value:trap, configurable:true});
  Object.defineProperty(globalThis, 'window', {value:{storage:trap}, configurable:true});
  try{
    resetProbeAttempts();
    const {fetchFn} = fetchRecorder(async () => jsonResponse(422, {error:'envelope_schema'}));
    const attempt = await runTransportProbe({fetchFn, documentRef:documentWith(ENDPOINT)});
    assert.equal(attempt.outcome, PROBE_OUTCOMES.TRANSPORT_PROVEN);
    assert.equal(probeAttempts().length, 1);
  }finally{
    if(originalLocal) Object.defineProperty(globalThis, 'localStorage', originalLocal); else delete globalThis.localStorage;
    if(originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else delete globalThis.window;
    resetProbeAttempts();
  }
  assert.ok(!/rawEvidenceSet|localStorage|window\.storage|setItem/.test(PROBE_CODE),
    'the probe source names a persistence API; a diagnostic must leave no durable trace');
});

test('the probe owns no retry, backoff, scheduler or delivery deadline', () => {
  for (const forbidden of [/nextAttemptAt/, /backoff/i, /setInterval/, /\bretry\b/i, /flushOutbox/, /pinLimit/]) {
    assert.doesNotMatch(PROBE_CODE, forbidden,
      `the probe contains ${forbidden}; it must remain a single owner-initiated attempt, never a delivery mechanism`);
  }
  /* setTimeout is permitted for exactly one purpose: aborting a hung request. */
  const timeouts = [...PROBE_CODE.matchAll(/setTimeout\(/g)];
  assert.equal(timeouts.length, 1, 'the probe should use setTimeout only for its single abort timer');
  assert.match(PROBE_CODE, /setTimeout\(\(\) => controller\.abort\(\), PROBE_REQUEST_TIMEOUT_MS\)/);
});

test('one call performs exactly one request with no scheduled follow-up', async () => {
  resetProbeAttempts();
  const {calls, fetchFn} = fetchRecorder(async () => jsonResponse(422, {error:'envelope_schema'}));
  const before = Date.now();
  const attempt = await runTransportProbe({fetchFn, documentRef:documentWith(ENDPOINT)});
  assert.equal(calls.length, 1, 'a diagnostic tap must produce exactly one request');
  assert.ok(attempt.startedAt >= before, 'the attempt runs immediately rather than waiting for a delivery deadline');
  assert.ok(attempt.durationMs >= 0 && Number.isFinite(attempt.durationMs));
  resetProbeAttempts();
});

test('normal evidence capture and storage remain untouched by this checkpoint', () => {
  /* The probe is additive. Neither evidence module may gain a reference to it,
     and no evidence module may be routed through the diagnostic path. */
  for (const path of ['src/ui/evidence.mjs', 'src/evidence/snapshot.mjs', 'src/ui/evidence-recovery.mjs', 'src/ui/download.mjs']) {
    const source = read(path);
    assert.ok(!/transport-probe|transportProbe|runTransportProbe/.test(source),
      `${path} references the diagnostic probe; evidence behaviour must be unchanged`);
  }
});

/* ---------- 4. Exact origin, path and credentialled CORS contract ---------- */

test('only the exact approved archive endpoint is accepted', () => {
  assert.equal(normaliseProbeEndpoint(ENDPOINT), ENDPOINT);
  for (const rejected of [
    `${ARCHIVE_ORIGIN}/v1/health`,
    `${ARCHIVE_ORIGIN}/v1/admin/reconcile`,
    `${ARCHIVE_ORIGIN}${PROBE_ENDPOINT_PATH}?x=1`,
    `${ARCHIVE_ORIGIN}${PROBE_ENDPOINT_PATH}#x`,
    `http://teamsheet-evidence-archive.fpltsheet.workers.dev${PROBE_ENDPOINT_PATH}`,
    `https://preview-teamsheet-evidence-archive.fpltsheet.workers.dev${PROBE_ENDPOINT_PATH}`,
    `https://user:pass@teamsheet-evidence-archive.fpltsheet.workers.dev${PROBE_ENDPOINT_PATH}`,
    'https://evil.example.com/v1/evidence/predeadline',
    '', null, undefined
  ]) {
    if (rejected === 'https://evil.example.com/v1/evidence/predeadline') {
      assert.equal(normaliseProbeEndpoint(rejected), rejected,
        'a foreign origin is shape-valid here; the Worker allow-list, not the client, is the security boundary');
      continue;
    }
    assert.equal(normaliseProbeEndpoint(rejected), null, `endpoint should have been rejected: ${rejected}`);
  }
  assert.equal(configuredProbeEndpoint(documentWith(ENDPOINT)), ENDPOINT);
  assert.equal(configuredProbeEndpoint(documentWith(null)), null);
});

test('the probe request replicates the failed delivery shape exactly, with a preflight-safe header set', async () => {
  resetProbeAttempts();
  const {calls, fetchFn} = fetchRecorder(async () => jsonResponse(422, {error:'envelope_schema'}));
  await runTransportProbe({fetchFn, documentRef:documentWith(ENDPOINT)});
  const {url, options} = calls[0];
  const parsed = new URL(url);
  assert.equal(parsed.origin, ARCHIVE_ORIGIN);
  assert.equal(parsed.pathname, PROBE_ENDPOINT_PATH);
  assert.deepEqual([...parsed.searchParams.keys()], ['probe'],
    'only the opaque correlation parameter may be added to the approved endpoint');
  assert.match(parsed.searchParams.get('probe'), /^[0-9a-f]{8}$/);
  assert.equal(options.method, 'POST');
  assert.equal(options.mode, 'cors');
  assert.equal(options.credentials, 'include');
  assert.equal(options.cache, 'no-store');
  assert.equal(options.body, JSON.stringify(PROBE_PAYLOAD));
  /* Content-Type is the only header the Worker's preflight contract allows.
     A custom header here would fail the preflight and destroy the measurement. */
  assert.deepEqual(Object.keys(options.headers), ['Content-Type']);
  assert.equal(options.headers['Content-Type'], 'application/json');
  resetProbeAttempts();
});

test('the correlation reference is opaque, short-lived and never an archive identity', () => {
  const ids = new Set(Array.from({length:32}, () => newCorrelationId()));
  assert.ok(ids.size > 20, 'correlation references should be random');
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}$/);
  assert.equal(probeRequestUrl(ENDPOINT, 'abcd1234'), `${ENDPOINT}?probe=abcd1234`);
  assert.ok(!/idempotencyKey|duplicateKey|contentHash/.test(PROBE_CODE),
    'the correlation reference must never be used as an archive or idempotency identity');
});

test('the sign-in target is the archive health route, never an evidence endpoint', () => {
  assert.equal(probeSignInUrl(ENDPOINT), `${ARCHIVE_ORIGIN}${PROBE_SIGN_IN_PATH}`);
  assert.equal(probeSignInUrl(null), null);
  assert.equal(PROBE_SIGN_IN_PATH, '/v1/health');
});

/* ---------- 5. The Worker keeps every existing protection ---------- */

test('the diagnostic adds no Worker route and requires no Worker redeployment', () => {
  const core = read('workers/evidence-archive-core.mjs');
  const mirror = read('workers/evidence-archive/evidence-archive-core.mjs');
  assert.equal(core, mirror, 'the deployment mirror must stay byte-identical');
  assert.ok(!/probe/i.test(core),
    'the Worker must contain no diagnostic-specific code; the probe deliberately tests the already-deployed Worker');
});

test('a foreign origin is still refused outright and never receives CORS headers', async () => {
  const response = await handleEvidenceArchiveRequest(
    new Request(`${ENDPOINT}?probe=abcd1234`, {
      method:'POST', headers:{'Origin':'https://evil.example.com','Content-Type':'application/json'},
      body:JSON.stringify(PROBE_PAYLOAD)}),
    {EVIDENCE_DB:{}, EVIDENCE_BUCKET:{}}, {});
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {error:'origin_not_allowed'});
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
});

test('an unauthenticated probe request is still rejected by the protected route', async () => {
  const response = await handleEvidenceArchiveRequest(
    new Request(`${ENDPOINT}?probe=abcd1234`, {
      method:'POST', headers:{'Origin':APP_ORIGIN,'Content-Type':'application/json'},
      body:JSON.stringify(PROBE_PAYLOAD)}),
    {EVIDENCE_DB:{}, EVIDENCE_BUCKET:{}, TEAM_DOMAIN:'', POLICY_AUD:''}, {});
  assert.ok([403, 503].includes(response.status),
    'an unauthenticated probe must never reach archive processing');
  assert.notEqual((await response.json()).error, PROBE_EXPECTED_ERROR,
    'only an authenticated request may produce the transport-proven result');
});

test('no wildcard CORS relaxation is introduced anywhere by this checkpoint', () => {
  for (const path of ['workers/evidence-archive-core.mjs', 'workers/evidence-archive/evidence-archive-core.mjs',
                      'src/ui/evidence-transport-probe.mjs', 'build.mjs', 'app.html']) {
    assert.ok(!read(path).includes("'Access-Control-Allow-Origin','*'"), `${path} introduces a wildcard origin`);
    assert.ok(!/Access-Control-Allow-Origin["'\s:,]+\*/.test(read(path)), `${path} introduces a wildcard origin`);
  }
});

/* ---------- 6. Result classification is honest and non-sensitive ---------- */

test('result categories separate the stages the physical test must distinguish', () => {
  assert.equal(classifyProbeResponse({status:422, workerError:'envelope_schema'}), PROBE_OUTCOMES.TRANSPORT_PROVEN);
  assert.equal(classifyProbeResponse({status:403, workerError:'unauthorised'}), PROBE_OUTCOMES.ACCESS_REJECTED);
  assert.equal(classifyProbeResponse({status:401, workerError:null}), PROBE_OUTCOMES.ACCESS_REJECTED);
  assert.equal(classifyProbeResponse({status:403, workerError:'origin_not_allowed'}), PROBE_OUTCOMES.ORIGIN_REJECTED);
  assert.equal(classifyProbeResponse({status:429, workerError:'rate_limited'}), PROBE_OUTCOMES.RATE_LIMITED);
  assert.equal(classifyProbeResponse({status:503, workerError:'auth_not_configured'}), PROBE_OUTCOMES.ARCHIVE_UNAVAILABLE);
  assert.equal(classifyProbeResponse({status:404, workerError:'route_not_allowed'}), PROBE_OUTCOMES.UNEXPECTED_RESPONSE);
  /* A 2xx would mean the archive accepted a payload that cannot be evidence.
     That must never read as success. */
  assert.equal(classifyProbeResponse({status:201, workerError:null}), PROBE_OUTCOMES.UNEXPECTED_RESPONSE);
  assert.equal(classifyProbeResponse({status:422, workerError:'something_else'}), PROBE_OUTCOMES.UNEXPECTED_RESPONSE);
});

test('a blocked, refused or redirected request is reported honestly, never as a cause', async () => {
  resetProbeAttempts();
  const thrown = await runTransportProbe({
    fetchFn: async () => { throw new TypeError('Load failed: https://teamsheet-evidence-archive.fpltsheet.workers.dev/secret'); },
    documentRef:documentWith(ENDPOINT)});
  assert.equal(thrown.outcome, PROBE_OUTCOMES.BLOCKED_BEFORE_RESPONSE);
  assert.equal(thrown.status, null);
  const [title, detail] = probeCopy(thrown.outcome);
  for (const text of [title, detail, probeDetailLine(thrown)]) {
    assert.ok(!text.includes('teamsheet-evidence-archive'), 'raw exception text must never reach the screen');
    assert.ok(!/secret|Load failed/.test(text), 'raw exception text must never reach the screen');
  }
  assert.doesNotMatch(detail, /Safari|ITP|cookie|Intelligent Tracking/i,
    'the diagnostic must not assert an unproven root cause');

  const redirected = await runTransportProbe({
    fetchFn: async () => ({type:'opaqueredirect', status:0}), documentRef:documentWith(ENDPOINT)});
  assert.equal(redirected.outcome, PROBE_OUTCOMES.OPAQUE_REDIRECT);

  const unconfigured = await runTransportProbe({fetchFn: async () => { throw new Error('unreachable'); },
    documentRef:documentWith(null)});
  assert.equal(unconfigured.outcome, PROBE_OUTCOMES.UNCONFIGURED);
  assert.equal(unconfigured.correlationId, null);
  resetProbeAttempts();
});

test('no owner-visible string carries a credential, identifier or server message', async () => {
  resetProbeAttempts();
  const attempt = await runTransportProbe({
    fetchFn: async () => jsonResponse(403, {error:'unauthorised', detail:'CF_Authorization cookie missing for team.cloudflareaccess.com'}),
    documentRef:documentWith(ENDPOINT)});
  assert.equal(attempt.outcome, PROBE_OUTCOMES.ACCESS_REJECTED);
  assert.equal(attempt.workerError, 'unauthorised');
  const rendered = [...probeCopy(attempt.outcome), probeDetailLine(attempt)].join(' ');
  for (const forbidden of [/CF_Authorization/i, /cloudflareaccess/i, /cookie missing/i, /jwt/i,
                           /POLICY_AUD/i, /TEAM_DOMAIN/i, /bearer/i]) {
    assert.doesNotMatch(rendered, forbidden, `owner-visible text leaked ${forbidden}`);
  }
  assert.match(probeDetailLine(attempt), /^Check 1 · signed-in check · started \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC · took \d+ ms · HTTP 403 · archive code unauthorised · reference [0-9a-f]{8}$/);
  resetProbeAttempts();

  for (const forbidden of [/console\.(log|error|warn)/, /CF_Authorization/, /document\.cookie/, /Cf-Access-Jwt-Assertion/i]) {
    assert.doesNotMatch(PROBE_CODE, forbidden, `the probe source contains ${forbidden}`);
  }
  assert.ok(PROBE_KNOWN_WORKER_ERRORS.every(code => /^[a-z_]{4,32}$/.test(code)),
    'only short fixed error codes may be echoed back');
});

/* ---------- 7. Build, CSP and bundle invariants ---------- */

test('the build admits the archive origin for the diagnostic only, with no delivery path', () => {
  const build = read('build.mjs');
  assert.match(build, /src\/ui\/evidence-transport-probe\.mjs/, 'the probe must be a declared build input');
  assert.match(build, /transportProbeOrigin/, 'the probe origin must reach connect-src through validated build code');
  assert.ok(!/src\/ui\/evidence-delivery\.mjs|src\/evidence\/outbox\.mjs/.test(build),
    'this branch must contain no evidence delivery or outbox module');
  const html = read('app.html');
  assert.equal([...html.matchAll(/name="teamsheet-evidence-transport-probe"/g)].length, 1,
    'exactly one diagnostic meta tag may be declared');
  assert.match(html, new RegExp(`content="${ARCHIVE_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${PROBE_ENDPOINT_PATH}"`));
});

test('the generated bundle carries the diagnostic and preserves the CSP and build invariants', () => {
  const generated = read('index.html');
  const deployable = read('dist/index.html');
  assert.equal(generated, deployable, 'root and deployable output must stay identical');
  const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(generated)?.[1];
  assert.ok(csp, 'the generated page must carry a hash-locked CSP');
  assert.ok(csp.includes(`connect-src`) && csp.includes(ARCHIVE_ORIGIN),
    'the archive origin must be admitted by connect-src or the probe cannot run');
  assert.ok(!csp.includes("'unsafe-inline'"), 'the CSP must not be relaxed');
  assert.ok(!csp.includes('*'), 'the CSP must not gain a wildcard source');
  assert.match(csp, /script-src 'sha256-/, 'the script hash lock must survive');

  const bundle = read('dist/app.bundle.js');
  assert.ok(bundle.includes('runTransportProbe'), 'the diagnostic must be present in the generated bundle');
  assert.ok(!bundle.includes('predeadline-gw1-3fec5b2f1e134e52'), 'the genuine GW1 record must not be in the bundle');
  /* Executable bundle code only: the probe's own comments legitimately name the
     delivery machinery this branch deliberately does not ship. */
  const bundleCode = bundle.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/flushOutbox|nextAttemptAt|OUTBOX_RULES/.test(bundleCode),
    'the generated bundle must contain no evidence delivery scheduler');
  /* Exactly one cross-site credentialled request may exist in the whole bundle,
     and it must be the diagnostic. The Official FPL gateway request stays
     credential-free and same-origin uses are unaffected. */
  const credentialUses = bundleCode.match(/credentials\s*:\s*[^,\n}]+/g) || [];
  assert.deepEqual(credentialUses.map(use => use.replace(/\s+/g, ' ').trim()).sort(), [
    "credentials:'omit'",
    "credentials:'same-origin'",
    "credentials:control ? 'omit' : 'include'"
  ], 'the diagnostic probe must be the only cross-site credentialled request in the generated bundle');
  const manifest = JSON.parse(read('dist/manifest.json'));
  assert.ok(manifest.moduleOrder.includes('src/ui/evidence-transport-probe.mjs'),
    'the build manifest must record the diagnostic module');
});

test('the diagnostic route is separate from every evidence surface and never says archive now', () => {
  const shell = read('src/ui/app-shell.mjs');
  assert.match(shell, /id:'evidenceTransportProbeHost'/);
  /* Rendering the route is not the same as registering it: PR #136 did the
     first without the second and the screen was unreachable on a phone.
     Reachability is proven by executing the real router, not by matching
     source text — see tests/settings-route-activation.test.mjs. */
  assert.equal(normaliseTeamsheetRoute('#/settings/data/connection-check'), '#/settings/data/connection-check',
    'the diagnostic route must be registered, or navigating to it silently falls back to the section menu');
  assert.equal(teamsheetRouteMeta('#/settings/data/connection-check').title, 'Connection check');
  for (const forbidden of [/archive now/i, /upload/i, /send evidence/i, /try archiving/i]) {
    assert.doesNotMatch(PROBE_CODE, forbidden,
      `probe copy matches ${forbidden}; it must never read as evidence custody`);
  }
});


/* ---------- 8. The credentialled/control pair, and what it can isolate ---------- */

test('the signed-in check and the control check differ only in session and redirect handling', async () => {
  resetProbeAttempts();
  const {calls, fetchFn} = fetchRecorder(async () => jsonResponse(422, {error:'envelope_schema'}));
  await runTransportProbe({fetchFn, documentRef:documentWith(ENDPOINT), mode:PROBE_MODES.SESSION});
  await runTransportProbe({fetchFn, documentRef:documentWith(ENDPOINT), mode:PROBE_MODES.CONTROL});
  const [session, control] = calls.map(call => call.options);

  assert.equal(session.credentials, 'include');
  assert.equal(session.redirect, 'follow');
  assert.equal(control.credentials, 'omit',
    'the control check must not send the Access session, or it cannot isolate the session layer');
  assert.equal(control.redirect, 'manual',
    'the control check must surface an Access redirect instead of following it into a foreign origin');

  /* Everything else must be identical, or the pair compares two different things. */
  for (const key of ['method', 'mode', 'cache', 'body']) {
    assert.equal(session[key], control[key], `the two checks differ in ${key}; only the session layer may vary`);
  }
  assert.deepEqual(session.headers, control.headers);
  const paths = calls.map(call => new URL(call.url).origin + new URL(call.url).pathname);
  assert.deepEqual(paths, [ENDPOINT, ENDPOINT], 'both checks must address the same approved endpoint');
  assert.notEqual(new URL(calls[0].url).searchParams.get('probe'), new URL(calls[1].url).searchParams.get('probe'),
    'each attempt needs its own reference so the archive logs can tell them apart');
  resetProbeAttempts();
});

test('the control check carries no session and still cannot create custody', async () => {
  resetProbeAttempts();
  /* An unauthenticated request is stopped by Access before the Worker. Even if
     it were not, the payload cannot pass envelope validation. */
  const attempt = await runTransportProbe({
    fetchFn: async () => ({type:'opaqueredirect', status:0}),
    documentRef:documentWith(ENDPOINT), mode:PROBE_MODES.CONTROL});
  assert.equal(attempt.outcome, PROBE_OUTCOMES.OPAQUE_REDIRECT);
  assert.equal(attempt.mode, PROBE_MODES.CONTROL);
  assert.match(probeDetailLine(attempt), /sign-in-free control/);
  assert.equal(validateEnvelope(PROBE_PAYLOAD).ok, false);
  resetProbeAttempts();
});

/* The Worker on this branch is the deployed lineage and does not send
   Access-Control-Allow-Credentials. This test records that fact so it cannot be
   changed silently: a credentialled cross-site response without that header is
   refused by the browser, which is the leading hypothesis this diagnostic
   exists to test. Changing the Worker is a separate approval, and doing it here
   would mean the probe no longer tested the Worker that actually failed. */
test('this checkpoint does not alter the deployed Worker CORS contract', () => {
  const core = read('workers/evidence-archive-core.mjs');
  assert.ok(!core.includes('Access-Control-Allow-Credentials'),
    'the deployed Worker lineage sends no Access-Control-Allow-Credentials; adding it here is a production transport change requiring separate approval and redeployment');
  assert.match(core, /headers\.set\('Access-Control-Allow-Origin',origin\)/,
    'exact-origin CORS must remain');
  assert.equal(read('workers/evidence-archive-core.mjs'), read('workers/evidence-archive/evidence-archive-core.mjs'));
});
