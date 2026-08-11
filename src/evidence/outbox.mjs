/* GW1-P2 — pure evidence-outbox contract.

   This module owns the delivery state machine and nothing else: no DOM, no
   storage, no fetch. Recommendation code never reaches it, and it never
   reaches Cloudflare. Keeping it transport-independent is deliberate — if the
   direct cross-origin transport is replaced, only src/ui/evidence-delivery.mjs
   changes and every rule below is preserved.

   Canonical Stage 10 identity is immutable here. A row references a record by
   its content hash; it never carries, rewrites or re-canonicalises evidence
   bytes, and enqueuedAt is fixed once so a delayed upload can never disguise
   itself as an earlier capture. Server custody time comes only from R2. */

import { canonicalise, stableStringify } from './snapshot.mjs';

const OUTBOX_VERSION = 1;
const ARCHIVE_VERSION = '1.0.0';
const OUTBOX_SNAPSHOT_SCHEMA_VERSION = '1.0.0';
const OUTBOX_ORIGIN = 'local_capture';

/* PROVISIONAL — pinLimit is the durable-retention guarantee and is the one
   value measured evidence must settle. See docs/GW1-P2-BROWSER-EVIDENCE-DELIVERY.md:
   one stored record measured 484.8 KB (gzip+base64), so pinning six would put
   ~2.9 MB of evidence beside ~1.6 MB of existing supporting stores. */
const OUTBOX_RULES = Object.freeze({
  rowLimit:6,
  pinLimit:4,
  terminalRetentionMs:30 * 24 * 60 * 60 * 1000,
  baseBackoffMs:60 * 1000,
  maxBackoffMs:6 * 60 * 60 * 1000,
  jitterRatio:0.2,
  maxTransientAttempts:10,
  authRetryMs:30 * 60 * 1000,
  maxAuthAttempts:48,
  leaseMs:2 * 60 * 1000,
  maxCanonicalBytes:20 * 1024 * 1024
});

/* Non-terminal rows are retried; terminal rows never are. blocked_retention is
   terminal for automatic delivery only: a governance change is a deliberate
   owner action, so it is retried on explicit request and never on a timer. */
const OUTBOX_STATES = Object.freeze({
  PENDING:'pending',
  PAUSED:'paused',
  SENT:'sent',
  DUPLICATE:'duplicate',
  REJECTED:'rejected',
  BLOCKED_RETENTION:'blocked_retention',
  EXPIRED_LOCAL:'expired_local'
});
const NON_TERMINAL_STATES = Object.freeze([OUTBOX_STATES.PENDING,OUTBOX_STATES.PAUSED]);
const TERMINAL_STATES = Object.freeze([
  OUTBOX_STATES.SENT,OUTBOX_STATES.DUPLICATE,OUTBOX_STATES.REJECTED,
  OUTBOX_STATES.BLOCKED_RETENTION,OUTBOX_STATES.EXPIRED_LOCAL
]);

/* Delivery outcome categories. These are the only strings that may reach a
   stored row or a diagnostic: each is a fixed literal chosen here, never a
   server message, header, URL or exception text. */
const DELIVERY_OUTCOMES = Object.freeze({
  ACCEPTED:'accepted',
  DUPLICATE:'duplicate',
  AUTH_UNAVAILABLE:'auth_unavailable',
  CONFIGURATION:'configuration',
  RETENTION_BLOCKED:'retention_blocked',
  REJECTED_PERMANENT:'rejected_permanent',
  RATE_LIMITED:'rate_limited',
  SERVICE_UNAVAILABLE:'service_unavailable',
  NETWORK_UNAVAILABLE:'network_unavailable',
  RECORD_UNAVAILABLE:'record_unavailable',
  PAYLOAD_TOO_LARGE:'payload_too_large'
});

/* Amendment 4 — a Worker origin/configuration defect is NOT an identity
   problem and must never enter the indefinite authentication retry path. The
   two are separated by the Worker's own JSON error code where one is
   available; where Cloudflare Access intercepts ahead of the Worker there is
   no Worker body at all, which is itself the signal for auth_unavailable. */
const WORKER_CONFIGURATION_ERRORS = Object.freeze([
  'origin_not_allowed','origin_required','method_not_allowed',
  'route_not_allowed','auth_not_configured','storage_not_configured'
]);
const RETENTION_ERRORS = Object.freeze([
  'understat_retention_not_approved','odds_retention_not_approved'
]);

function isoOrNull(value){
  if(value === null || value === undefined) return null;
  const ms = value instanceof Date ? value.getTime()
    : typeof value === 'number' ? value
    : Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
function outboxIdempotencyKey(contentHash){
  if(!/^[0-9a-f]{64}$/.test(String(contentHash||''))) throw new Error('Evidence content hash is invalid');
  return String(contentHash);
}

/* Client mirror of the Worker's fail-closed retention gate. It is an
   optimisation only: it prevents pointless authenticated traffic for evidence
   the archive will certainly reject. The Worker's 422 stays authoritative,
   and neither side may strip provider material to make a record archivable —
   that would change the canonical hash and destroy the evidence. */
function retainedProviderMaterial(record,name){
  const value = record?.modelInputs?.[name];
  if(value === null || value === undefined) return false;
  if(Array.isArray(value)) return value.length > 0;
  if(typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}
function providerWasIncluded(record,name){
  return Boolean((record?.providers||[]).find(row => row?.provider === name)?.included);
}
function blockedProviderRetention(record){
  for(const name of ['understat','odds']){
    if(providerWasIncluded(record,name) || retainedProviderMaterial(record,name)) return name;
  }
  return null;
}

function outboxRow({
  snapshotId,contentHash,season,gameweek,enqueuedAt,
  state = OUTBOX_STATES.PENDING,attemptCount = 0,authAttemptCount = 0,
  lastAttemptAt = null,nextAttemptAt = null,lastOutcome = null,
  blockedProvider = null,receipt = null
}){
  if(!/^predeadline-gw\d+-[0-9a-f]{16}$/.test(String(snapshotId||''))) throw new Error('Evidence snapshot ID is invalid');
  if(!TERMINAL_STATES.includes(state) && !NON_TERMINAL_STATES.includes(state)) throw new Error('Evidence outbox state is not supported');
  const enqueued = isoOrNull(enqueuedAt);
  if(!enqueued) throw new Error('Evidence outbox enqueue time is invalid');
  return canonicalise({
    outboxVersion:OUTBOX_VERSION,
    archiveVersion:ARCHIVE_VERSION,
    snapshotSchemaVersion:OUTBOX_SNAPSHOT_SCHEMA_VERSION,
    origin:OUTBOX_ORIGIN,
    snapshotId:String(snapshotId),
    contentHash:outboxIdempotencyKey(contentHash),
    idempotencyKey:outboxIdempotencyKey(contentHash),
    season:String(season||''),
    gameweek:Number(gameweek),
    enqueuedAt:enqueued,
    state,
    attemptCount:Math.max(0,Math.trunc(Number(attemptCount)||0)),
    authAttemptCount:Math.max(0,Math.trunc(Number(authAttemptCount)||0)),
    lastAttemptAt:isoOrNull(lastAttemptAt),
    nextAttemptAt:isoOrNull(nextAttemptAt),
    lastOutcome:lastOutcome === null ? null : String(lastOutcome),
    blockedProvider:blockedProvider === null ? null : String(blockedProvider),
    receipt:receipt === null ? null : canonicalise(receipt)
  });
}

function rowFromRecord(record,{enqueuedAt = Date.now()} = {}){
  const blocked = blockedProviderRetention(record);
  return outboxRow({
    snapshotId:record?.identity?.snapshotId,
    contentHash:record?.identity?.contentHash,
    season:record?.season,
    gameweek:record?.gameweek,
    enqueuedAt,
    state:blocked ? OUTBOX_STATES.BLOCKED_RETENTION : OUTBOX_STATES.PENDING,
    lastOutcome:blocked ? DELIVERY_OUTCOMES.RETENTION_BLOCKED : null,
    blockedProvider:blocked,
    nextAttemptAt:blocked ? null : enqueuedAt
  });
}

/* A stored row is trusted only when every compatibility field still matches
   this build. Anything else is dropped rather than migrated: a silently
   coerced delivery record is worse than an absent one. */
function usableOutboxRow(value){
  if(!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if(value.outboxVersion !== OUTBOX_VERSION) return null;
  if(value.archiveVersion !== ARCHIVE_VERSION) return null;
  if(value.snapshotSchemaVersion !== OUTBOX_SNAPSHOT_SCHEMA_VERSION) return null;
  if(value.origin !== OUTBOX_ORIGIN) return null;
  try{ return outboxRow(value); }catch(error){ return null; }
}
function normaliseOutbox(value,{season = null,now = Date.now()} = {}){
  if(!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .map(usableOutboxRow)
    .filter(row => {
      if(!row || seen.has(row.contentHash)) return false;
      if(season && row.season !== season) return false;
      if(TERMINAL_STATES.includes(row.state) &&
         now - Date.parse(row.enqueuedAt) > OUTBOX_RULES.terminalRetentionMs) return false;
      seen.add(row.contentHash);
      return true;
    })
    .sort((a,b) => Date.parse(b.enqueuedAt) - Date.parse(a.enqueuedAt) || a.contentHash.localeCompare(b.contentHash))
    .slice(0,OUTBOX_RULES.rowLimit);
}

function nonTerminalRows(rows){ return (rows||[]).filter(row => NON_TERMINAL_STATES.includes(row.state)); }

/* Rows whose canonical record must survive local eviction. Ordered newest
   first so an over-limit release always drops the oldest pending evidence,
   never the record most likely still to be archivable. */
function pinnedSnapshotIds(rows,{pinLimit = OUTBOX_RULES.pinLimit} = {}){
  return nonTerminalRows(rows).slice(0,Math.max(0,Math.trunc(pinLimit))).map(row => row.snapshotId);
}
function releasedRows(rows,{pinLimit = OUTBOX_RULES.pinLimit,now = Date.now()} = {}){
  const pending = nonTerminalRows(rows);
  const released = pending.slice(Math.max(0,Math.trunc(pinLimit)));
  if(!released.length) return rows;
  const releasedIds = new Set(released.map(row => row.contentHash));
  return rows.map(row => releasedIds.has(row.contentHash)
    ? outboxRow({...row,state:OUTBOX_STATES.EXPIRED_LOCAL,nextAttemptAt:null,
      lastOutcome:DELIVERY_OUTCOMES.RECORD_UNAVAILABLE,lastAttemptAt:new Date(now).toISOString()})
    : row);
}

function enqueueRecord(rows,record,{enqueuedAt = Date.now(),pinLimit = OUTBOX_RULES.pinLimit} = {}){
  const existing = normaliseOutbox(rows,{now:enqueuedAt});
  const contentHash = record?.identity?.contentHash;
  const already = existing.find(row => row.contentHash === contentHash);
  if(already) return {rows:existing,row:already,added:false};
  const row = rowFromRecord(record,{enqueuedAt});
  const next = releasedRows(
    normaliseOutbox([row,...existing],{now:enqueuedAt}),
    {pinLimit,now:enqueuedAt}
  );
  return {rows:next,row:next.find(item => item.contentHash === contentHash) || row,added:true};
}

function deliveryEnvelope(row,record){
  if(record?.identity?.contentHash !== row.contentHash) throw new Error('Evidence record does not match its outbox row');
  return canonicalise({
    archiveVersion:ARCHIVE_VERSION,
    enqueuedAt:row.enqueuedAt,
    idempotencyKey:row.idempotencyKey,
    origin:OUTBOX_ORIGIN,
    record
  });
}
function envelopeText(row,record){ return stableStringify(deliveryEnvelope(row,record)); }

function backoffDelayMs(attemptCount,{random = Math.random} = {}){
  const attempt = Math.max(1,Math.trunc(Number(attemptCount)||1));
  const base = Math.min(OUTBOX_RULES.maxBackoffMs,OUTBOX_RULES.baseBackoffMs * Math.pow(2,attempt - 1));
  const jitter = base * OUTBOX_RULES.jitterRatio * (random() * 2 - 1);
  return Math.max(OUTBOX_RULES.baseBackoffMs,Math.round(base + jitter));
}

/* Map an HTTP result onto exactly one delivery outcome. `workerError` is the
   Worker's own JSON `error` code when the response carried one; a null value
   means no Worker body was available — the Cloudflare Access interception
   case, which is an identity problem rather than a Worker defect. */
function classifyResponse({status,workerError = null,networkError = false} = {}){
  if(networkError) return DELIVERY_OUTCOMES.NETWORK_UNAVAILABLE;
  const code = workerError === null || workerError === undefined ? null : String(workerError);
  if(status === 201) return DELIVERY_OUTCOMES.ACCEPTED;
  if(status === 200) return DELIVERY_OUTCOMES.DUPLICATE;
  if(code && RETENTION_ERRORS.includes(code)) return DELIVERY_OUTCOMES.RETENTION_BLOCKED;
  if(code && WORKER_CONFIGURATION_ERRORS.includes(code)) return DELIVERY_OUTCOMES.CONFIGURATION;
  if(status === 401 || status === 403) return DELIVERY_OUTCOMES.AUTH_UNAVAILABLE;
  if(status === 413) return DELIVERY_OUTCOMES.PAYLOAD_TOO_LARGE;
  if(status === 429) return DELIVERY_OUTCOMES.RATE_LIMITED;
  if(status === 400 || status === 404 || status === 405 || status === 409 || status === 422)
    return DELIVERY_OUTCOMES.REJECTED_PERMANENT;
  if(status === 503) return DELIVERY_OUTCOMES.SERVICE_UNAVAILABLE;
  if(status >= 500) return DELIVERY_OUTCOMES.SERVICE_UNAVAILABLE;
  return DELIVERY_OUTCOMES.SERVICE_UNAVAILABLE;
}

function safeReceipt(manifest,{acknowledgedAt}){
  return canonicalise({
    contentHash:String(manifest?.contentHash||''),
    r2UploadedAt:isoOrNull(manifest?.r2UploadedAt),
    serverPredeadlineReceived:Boolean(manifest?.serverPredeadlineReceived),
    timingGrade:String(manifest?.timingGrade||''),
    acknowledgedAt:new Date(acknowledgedAt).toISOString()
  });
}

/* The single transition function. Every delivery result — success, rejection,
   auth gap, backend fault — resolves here, so no caller can invent a state. */
function applyDeliveryOutcome(row,outcome,{
  now = Date.now(),manifest = null,retryAfterMs = null,random = Math.random
} = {}){
  const attemptedAt = new Date(now).toISOString();
  const base = {...row,lastAttemptAt:attemptedAt,lastOutcome:outcome};
  if(outcome === DELIVERY_OUTCOMES.ACCEPTED || outcome === DELIVERY_OUTCOMES.DUPLICATE){
    return outboxRow({...base,
      state:outcome === DELIVERY_OUTCOMES.ACCEPTED ? OUTBOX_STATES.SENT : OUTBOX_STATES.DUPLICATE,
      nextAttemptAt:null,attemptCount:row.attemptCount + 1,
      receipt:manifest ? safeReceipt(manifest,{acknowledgedAt:now}) : row.receipt});
  }
  if(outcome === DELIVERY_OUTCOMES.RETENTION_BLOCKED){
    return outboxRow({...base,state:OUTBOX_STATES.BLOCKED_RETENTION,nextAttemptAt:null,
      attemptCount:row.attemptCount + 1,blockedProvider:row.blockedProvider});
  }
  if(outcome === DELIVERY_OUTCOMES.REJECTED_PERMANENT || outcome === DELIVERY_OUTCOMES.PAYLOAD_TOO_LARGE){
    return outboxRow({...base,state:OUTBOX_STATES.REJECTED,nextAttemptAt:null,attemptCount:row.attemptCount + 1});
  }
  if(outcome === DELIVERY_OUTCOMES.RECORD_UNAVAILABLE){
    return outboxRow({...base,state:OUTBOX_STATES.EXPIRED_LOCAL,nextAttemptAt:null,attemptCount:row.attemptCount + 1});
  }
  /* Amendment 4 — a proven Worker origin/configuration defect pauses instead
     of retrying forever against a service that cannot accept the request. */
  if(outcome === DELIVERY_OUTCOMES.CONFIGURATION){
    return outboxRow({...base,state:OUTBOX_STATES.PAUSED,nextAttemptAt:null,attemptCount:row.attemptCount + 1});
  }
  if(outcome === DELIVERY_OUTCOMES.AUTH_UNAVAILABLE){
    const authAttemptCount = row.authAttemptCount + 1;
    if(authAttemptCount >= OUTBOX_RULES.maxAuthAttempts)
      return outboxRow({...base,state:OUTBOX_STATES.PAUSED,authAttemptCount,nextAttemptAt:null});
    return outboxRow({...base,state:OUTBOX_STATES.PENDING,authAttemptCount,
      nextAttemptAt:new Date(now + OUTBOX_RULES.authRetryMs).toISOString()});
  }
  const attemptCount = row.attemptCount + 1;
  if(attemptCount >= OUTBOX_RULES.maxTransientAttempts)
    return outboxRow({...base,state:OUTBOX_STATES.PAUSED,attemptCount,nextAttemptAt:null});
  const delay = Number.isFinite(Number(retryAfterMs)) && Number(retryAfterMs) > 0
    ? Math.max(OUTBOX_RULES.baseBackoffMs,Math.trunc(Number(retryAfterMs)))
    : backoffDelayMs(attemptCount,{random});
  return outboxRow({...base,state:OUTBOX_STATES.PENDING,attemptCount,
    nextAttemptAt:new Date(now + delay).toISOString()});
}

function dueRow(rows,{now = Date.now()} = {}){
  return (rows||[])
    .filter(row => row.state === OUTBOX_STATES.PENDING)
    .filter(row => !row.nextAttemptAt || Date.parse(row.nextAttemptAt) <= now)
    .sort((a,b) => Date.parse(a.enqueuedAt) - Date.parse(b.enqueuedAt))[0] || null;
}
/* An owner action is the only way out of paused/blocked: retention approval
   and deployment repair are both deliberate decisions, never timers. */
function resumePausedRows(rows,{now = Date.now(),includeBlocked = false} = {}){
  return (rows||[]).map(row => {
    const resumable = row.state === OUTBOX_STATES.PAUSED ||
      (includeBlocked && row.state === OUTBOX_STATES.BLOCKED_RETENTION);
    return resumable
      ? outboxRow({...row,state:OUTBOX_STATES.PENDING,attemptCount:0,authAttemptCount:0,
        nextAttemptAt:new Date(now).toISOString()})
      : row;
  });
}
function outboxSummary(rows){
  const list = rows||[];
  const count = state => list.filter(row => row.state === state).length;
  return canonicalise({
    total:list.length,
    pending:count(OUTBOX_STATES.PENDING),
    paused:count(OUTBOX_STATES.PAUSED),
    archived:count(OUTBOX_STATES.SENT) + count(OUTBOX_STATES.DUPLICATE),
    rejected:count(OUTBOX_STATES.REJECTED),
    blockedRetention:count(OUTBOX_STATES.BLOCKED_RETENTION),
    expiredLocal:count(OUTBOX_STATES.EXPIRED_LOCAL),
    lastOutcome:list.find(row => row.lastOutcome)?.lastOutcome || null
  });
}

export {
  OUTBOX_VERSION,ARCHIVE_VERSION,OUTBOX_SNAPSHOT_SCHEMA_VERSION,OUTBOX_ORIGIN,
  OUTBOX_RULES,OUTBOX_STATES,NON_TERMINAL_STATES,TERMINAL_STATES,
  DELIVERY_OUTCOMES,WORKER_CONFIGURATION_ERRORS,RETENTION_ERRORS,
  outboxIdempotencyKey,blockedProviderRetention,outboxRow,rowFromRecord,
  usableOutboxRow,normaliseOutbox,nonTerminalRows,pinnedSnapshotIds,releasedRows,
  enqueueRecord,deliveryEnvelope,envelopeText,backoffDelayMs,classifyResponse,
  applyDeliveryOutcome,dueRow,resumePausedRows,outboxSummary
};
