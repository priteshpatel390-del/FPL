import test from 'node:test';
import assert from 'node:assert/strict';
import { finaliseSnapshotRecord, SNAPSHOT_SCHEMA_VERSION, stableStringify } from '../src/evidence/snapshot.mjs';
import {
  OUTBOX_RULES, OUTBOX_STATES, DELIVERY_OUTCOMES, ARCHIVE_VERSION,
  blockedProviderRetention, outboxRow, rowFromRecord, usableOutboxRow, normaliseOutbox,
  pinnedSnapshotIds, releasedRows, enqueueRecord, deliveryEnvelope, envelopeText,
  backoffDelayMs, classifyResponse, applyDeliveryOutcome, dueRow, resumePausedRows, outboxSummary
} from '../src/evidence/outbox.mjs';
import { validateEnvelope } from '../workers/evidence-archive.mjs';

const deadline = Date.parse('2026-08-15T10:00:00.000Z');
const network = at => ({status:'available',serverAt:at,clientMidpointAt:at,skewMs:0,
  requestStartedAt:at-10,responseReceivedAt:at+10,roundTripMs:20,source:'same_origin_http_date'});
function payload(gameweek,capturedAt,overrides={}){
  return {
    recordType:'preDeadlineSnapshot',schemaVersion:SNAPSHOT_SCHEMA_VERSION,metricVersion:'1.0.0',segmentationVersion:'1.0.0',
    managerRef:'mgr-0123456789abcdef0123456789abcdef',season:'2026-27',gameweek,
    deadlineTime:new Date(deadline+gameweek*86400000).toISOString(),
    build:{modelVersion:'2.4.0',rulesVersion:'2026-27.3',sourceHash:'abc',commit:'def',moduleOrder:[]},
    versions:{model:'2.4.0',rules:'2026-27.3',simulation:'1.0.0',snapshot:SNAPSHOT_SCHEMA_VERSION},
    rules:{fpl:{season:'2026-27'},minutes:{},scoring:{},transfer:{},simulation:{version:'1.0.0'},odds:{},fixture:{baseGoals:1.42,homeTilt:1.1}},
    providers:['fpl','understat','odds','archive'].map(name=>({provider:name,state:name==='fpl'?'Live':'Disabled',
      included:name==='fpl',didAffectModel:name==='fpl',acceptedRecordCount:name==='fpl'?1:0,rejectedRecordCount:0,
      recordedAt:new Date(capturedAt-1000).toISOString(),lastSuccessAt:name==='fpl'?new Date(capturedAt-1000).toISOString():null,
      ageMs:name==='fpl'?0:null,thresholdMs:null,note:'',consequence:''})),
    completeness:{complete:true,sections:{coreInputs:'complete',playerProjections:'complete'},fatalFplIssue:false,playerCount:1,expectedPlayerCount:1},
    capture:{startedAt:new Date(capturedAt-2000).toISOString(),projectionStartedAt:new Date(capturedAt-1500).toISOString(),projectionCompletedAt:new Date(capturedAt-1000).toISOString(),horizon:1},
    modelInputs:{players:[{id:1}],teams:[],events:[],fixtures:[],minuteHistory:{},calibration:null,understat:null,odds:null},
    outputs:{players:[{playerId:1}],squad:{status:'not_available'}},retries:[],issues:[],
    quality:{projectionDurationMs:1,simulationSamplesPerAvailablePlayer:5000,seasonLive:true},...overrides
  };
}
async function record(gameweek,capturedAt,overrides={}){
  return finaliseSnapshotRecord(payload(gameweek,capturedAt,overrides),{
    captureStartedAt:capturedAt-2000,captureCompletedAt:capturedAt,
    networkBefore:network(capturedAt-1500),networkAfter:network(capturedAt)
  });
}
const base = deadline - 30*60000;

test('an enqueued row carries the exact archive envelope contract and a content-hash idempotency key',async()=>{
  const item = await record(1,base);
  const row = rowFromRecord(item,{enqueuedAt:base+1000});
  assert.equal(row.state,OUTBOX_STATES.PENDING);
  assert.equal(row.idempotencyKey,item.identity.contentHash);
  assert.equal(row.contentHash,item.identity.contentHash);
  assert.match(row.idempotencyKey,/^[A-Za-z0-9._:-]{16,128}$/);
  assert.equal(row.archiveVersion,ARCHIVE_VERSION);
  assert.equal(row.origin,'local_capture');
  const envelope = deliveryEnvelope(row,item);
  const checked = validateEnvelope(envelope);
  assert.equal(checked.ok,true,checked.reason);
  assert.deepEqual(Object.keys(envelope).sort(),['archiveVersion','enqueuedAt','idempotencyKey','origin','record']);
});

test('delivery never alters the canonical evidence bytes or hash',async()=>{
  const item = await record(2,base);
  const before = stableStringify(item);
  const row = rowFromRecord(item,{enqueuedAt:base});
  const text = envelopeText(row,item);
  const posted = JSON.parse(text).record;
  assert.equal(stableStringify(posted),before);
  assert.equal(posted.identity.contentHash,item.identity.contentHash);
  assert.equal(stableStringify(item),before);
});

test('an envelope refuses a record that does not match its row',async()=>{
  const one = await record(3,base), two = await record(4,base);
  assert.throws(()=>deliveryEnvelope(rowFromRecord(one,{enqueuedAt:base}),two),/does not match/);
});

test('enqueue time is fixed once and never rewritten by a delayed retry',async()=>{
  const item = await record(5,base);
  let row = rowFromRecord(item,{enqueuedAt:base});
  const enqueuedAt = row.enqueuedAt;
  for(const outcome of [DELIVERY_OUTCOMES.SERVICE_UNAVAILABLE,DELIVERY_OUTCOMES.RATE_LIMITED,DELIVERY_OUTCOMES.NETWORK_UNAVAILABLE]){
    row = applyDeliveryOutcome(row,outcome,{now:base+86400000,random:()=>0.5});
    assert.equal(row.enqueuedAt,enqueuedAt);
  }
  row = applyDeliveryOutcome(row,DELIVERY_OUTCOMES.ACCEPTED,{now:base+172800000,
    manifest:{contentHash:item.identity.contentHash,r2UploadedAt:new Date(base+172800000).toISOString(),
      serverPredeadlineReceived:false,timingGrade:'network_attested'}});
  assert.equal(row.enqueuedAt,enqueuedAt);
  assert.equal(row.state,OUTBOX_STATES.SENT);
  assert.equal(row.receipt.r2UploadedAt,new Date(base+172800000).toISOString());
});

test('a 201 archives and a 200 duplicate is an equally terminal success',async()=>{
  const item = await record(6,base);
  const row = rowFromRecord(item,{enqueuedAt:base});
  const manifest = {contentHash:item.identity.contentHash,r2UploadedAt:new Date(base).toISOString(),
    serverPredeadlineReceived:true,timingGrade:'network_attested'};
  const sent = applyDeliveryOutcome(row,classifyResponse({status:201}),{now:base,manifest});
  const duplicate = applyDeliveryOutcome(row,classifyResponse({status:200}),{now:base,manifest});
  assert.equal(sent.state,OUTBOX_STATES.SENT);
  assert.equal(duplicate.state,OUTBOX_STATES.DUPLICATE);
  for(const done of [sent,duplicate]){
    assert.equal(done.nextAttemptAt,null);
    assert.equal(done.receipt.serverPredeadlineReceived,true);
    assert.equal(dueRow([done],{now:base+86400000}),null);
  }
});

test('permanent contract rejections are never retried',async()=>{
  const item = await record(7,base);
  const row = rowFromRecord(item,{enqueuedAt:base});
  for(const status of [400,404,405,409,422]){
    const next = applyDeliveryOutcome(row,classifyResponse({status,workerError:'snapshot_content_hash'}),{now:base});
    assert.equal(next.state,OUTBOX_STATES.REJECTED,`status ${status}`);
    assert.equal(next.nextAttemptAt,null);
    assert.equal(dueRow([next],{now:base+31*86400000}),null);
  }
  const large = applyDeliveryOutcome(row,classifyResponse({status:413}),{now:base});
  assert.equal(large.state,OUTBOX_STATES.REJECTED);
});

test('a retention rejection blocks automatically and only an explicit request may resume it',async()=>{
  const item = await record(8,base);
  const row = rowFromRecord(item,{enqueuedAt:base});
  const blocked = applyDeliveryOutcome(row,classifyResponse({status:422,workerError:'understat_retention_not_approved'}),{now:base});
  assert.equal(blocked.state,OUTBOX_STATES.BLOCKED_RETENTION);
  assert.equal(blocked.nextAttemptAt,null);
  assert.equal(dueRow([blocked],{now:base+86400000}),null);
  assert.equal(resumePausedRows([blocked],{now:base})[0].state,OUTBOX_STATES.BLOCKED_RETENTION);
  assert.equal(resumePausedRows([blocked],{now:base,includeBlocked:true})[0].state,OUTBOX_STATES.PENDING);
});

test('the client mirrors the fail-closed provider gate without mutating the record',async()=>{
  const included = await record(9,base,{providers:['fpl','understat','odds','archive'].map(name=>({provider:name,
    state:name==='odds'?'Disabled':'Live',included:name!=='odds',didAffectModel:name!=='odds',
    acceptedRecordCount:name==='odds'?0:1,rejectedRecordCount:0,recordedAt:new Date(base-1000).toISOString(),
    lastSuccessAt:name==='odds'?null:new Date(base-1000).toISOString(),ageMs:name==='odds'?0:null,
    thresholdMs:null,note:'',consequence:''}))});
  assert.equal(blockedProviderRetention(included),'understat');
  const retained = await record(10,base,{modelInputs:{players:[{id:1}],teams:[],events:[],fixtures:[],
    minuteHistory:{},calibration:null,understat:null,odds:{'1|2':{home:0.4}}}});
  assert.equal(blockedProviderRetention(retained),'odds');
  const clean = await record(11,base);
  assert.equal(blockedProviderRetention(clean),null);
  const before = stableStringify(retained);
  const row = rowFromRecord(retained,{enqueuedAt:base});
  assert.equal(row.state,OUTBOX_STATES.BLOCKED_RETENTION);
  assert.equal(row.blockedProvider,'odds');
  assert.equal(stableStringify(retained),before,'a blocked record must never be stripped or re-hashed');
});

test('429 honours Retry-After and transient failures back off within bounds',async()=>{
  const item = await record(12,base);
  let row = rowFromRecord(item,{enqueuedAt:base});
  const limited = applyDeliveryOutcome(row,classifyResponse({status:429}),{now:base,retryAfterMs:60000});
  assert.equal(limited.state,OUTBOX_STATES.PENDING);
  assert.equal(Date.parse(limited.nextAttemptAt)-base,60000);
  let previous = 0;
  for(let attempt=1;attempt<OUTBOX_RULES.maxTransientAttempts;attempt++){
    row = applyDeliveryOutcome(row,DELIVERY_OUTCOMES.SERVICE_UNAVAILABLE,{now:base,random:()=>0.5});
    assert.equal(row.state,OUTBOX_STATES.PENDING);
    const delay = Date.parse(row.nextAttemptAt)-base;
    assert.ok(delay>=OUTBOX_RULES.baseBackoffMs);
    assert.ok(delay<=OUTBOX_RULES.maxBackoffMs*(1+OUTBOX_RULES.jitterRatio));
    assert.ok(delay>=previous,'backoff must not shrink');
    previous = Math.min(delay,OUTBOX_RULES.maxBackoffMs);
  }
  row = applyDeliveryOutcome(row,DELIVERY_OUTCOMES.SERVICE_UNAVAILABLE,{now:base,random:()=>0.5});
  assert.equal(row.state,OUTBOX_STATES.PAUSED,'the transient budget is bounded');
  assert.equal(resumePausedRows([row],{now:base})[0].state,OUTBOX_STATES.PENDING);
  assert.ok(backoffDelayMs(1)>=OUTBOX_RULES.baseBackoffMs);
  assert.ok(backoffDelayMs(40)<=OUTBOX_RULES.maxBackoffMs*(1+OUTBOX_RULES.jitterRatio));
});

test('an authentication gap uses its own slow schedule and never consumes the transient budget',async()=>{
  const item = await record(13,base);
  let row = rowFromRecord(item,{enqueuedAt:base});
  row = applyDeliveryOutcome(row,DELIVERY_OUTCOMES.AUTH_UNAVAILABLE,{now:base});
  assert.equal(row.state,OUTBOX_STATES.PENDING);
  assert.equal(row.attemptCount,0,'authentication is not a delivery attempt failure');
  assert.equal(row.authAttemptCount,1);
  assert.equal(Date.parse(row.nextAttemptAt)-base,OUTBOX_RULES.authRetryMs);
  for(let i=1;i<OUTBOX_RULES.maxAuthAttempts;i++) row = applyDeliveryOutcome(row,DELIVERY_OUTCOMES.AUTH_UNAVAILABLE,{now:base});
  assert.equal(row.state,OUTBOX_STATES.PAUSED,'authentication retries are bounded too');
});

test('a Worker configuration defect never enters the indefinite authentication retry path',async()=>{
  const item = await record(14,base);
  const row = rowFromRecord(item,{enqueuedAt:base});
  for(const code of ['origin_not_allowed','auth_not_configured','storage_not_configured','route_not_allowed','method_not_allowed']){
    const outcome = classifyResponse({status:403,workerError:code});
    assert.equal(outcome,DELIVERY_OUTCOMES.CONFIGURATION,code);
    const next = applyDeliveryOutcome(row,outcome,{now:base});
    assert.equal(next.state,OUTBOX_STATES.PAUSED,code);
    assert.equal(next.nextAttemptAt,null);
    assert.equal(next.authAttemptCount,0);
  }
  /* Cloudflare Access answers ahead of the Worker, so no Worker JSON error
     body exists: that is identity, not configuration. */
  assert.equal(classifyResponse({status:403,workerError:null}),DELIVERY_OUTCOMES.AUTH_UNAVAILABLE);
  assert.equal(classifyResponse({status:401}),DELIVERY_OUTCOMES.AUTH_UNAVAILABLE);
  assert.equal(classifyResponse({networkError:true}),DELIVERY_OUTCOMES.NETWORK_UNAVAILABLE);
  assert.equal(classifyResponse({status:500}),DELIVERY_OUTCOMES.SERVICE_UNAVAILABLE);
  assert.equal(classifyResponse({status:503,workerError:'archive_failed'}),DELIVERY_OUTCOMES.SERVICE_UNAVAILABLE);
});

test('a non-terminal row is pinned and an over-limit release is recorded rather than silent',async()=>{
  let rows = [];
  const records = [];
  for(let gw=1;gw<=OUTBOX_RULES.pinLimit+2;gw++){
    const item = await record(gw,base+gw*1000);
    records.push(item);
    rows = enqueueRecord(rows,item,{enqueuedAt:base+gw*1000}).rows;
  }
  const pinned = pinnedSnapshotIds(rows);
  assert.equal(pinned.length,OUTBOX_RULES.pinLimit);
  const expired = rows.filter(row=>row.state===OUTBOX_STATES.EXPIRED_LOCAL);
  assert.equal(expired.length,2,'released rows are recorded, never dropped in silence');
  for(const row of expired) assert.equal(row.lastOutcome,DELIVERY_OUTCOMES.RECORD_UNAVAILABLE);
  const newest = records.slice(-OUTBOX_RULES.pinLimit).map(item=>item.identity.snapshotId);
  assert.deepEqual(pinned.slice().sort(),newest.slice().sort(),'the newest pending evidence is retained');
  assert.deepEqual(releasedRows(rows,{pinLimit:OUTBOX_RULES.pinLimit}),rows,'releasing twice is stable');
});

test('enqueue is idempotent for an identical record and bounded overall',async()=>{
  const item = await record(20,base);
  const first = enqueueRecord([],item,{enqueuedAt:base});
  assert.equal(first.added,true);
  const second = enqueueRecord(first.rows,item,{enqueuedAt:base+5000});
  assert.equal(second.added,false);
  assert.equal(second.rows.length,1);
  assert.equal(second.rows[0].enqueuedAt,first.rows[0].enqueuedAt);
  let rows = [];
  for(let gw=1;gw<=OUTBOX_RULES.rowLimit+4;gw++) rows = enqueueRecord(rows,await record(gw,base+gw*1000),{enqueuedAt:base+gw*1000}).rows;
  assert.equal(rows.length,OUTBOX_RULES.rowLimit);
});

test('incompatible, foreign-season and corrupt rows are dropped rather than migrated',async()=>{
  const item = await record(21,base);
  const row = rowFromRecord(item,{enqueuedAt:base});
  assert.ok(usableOutboxRow(row));
  assert.equal(usableOutboxRow({...row,outboxVersion:99}),null);
  assert.equal(usableOutboxRow({...row,archiveVersion:'9.9.9'}),null);
  assert.equal(usableOutboxRow({...row,snapshotSchemaVersion:'2.0.0'}),null);
  assert.equal(usableOutboxRow({...row,origin:'recovery_import'}),null);
  assert.equal(usableOutboxRow({...row,contentHash:'nope'}),null);
  assert.equal(usableOutboxRow({...row,snapshotId:'not-a-snapshot'}),null);
  assert.equal(usableOutboxRow(null),null);
  assert.equal(usableOutboxRow('gzip-base64:junk'),null);
  assert.deepEqual(normaliseOutbox('not an array'),[]);
  assert.deepEqual(normaliseOutbox([row,{broken:true},null]),[row]);
  assert.deepEqual(normaliseOutbox([row],{season:'2099-00'}),[],'a foreign season is never delivered');
  assert.deepEqual(normaliseOutbox([row,row]),[row],'a duplicate content hash cannot be queued twice');
});

test('a terminal row is pruned after its retention window and a pending row is not',async()=>{
  const item = await record(22,base);
  const pending = rowFromRecord(item,{enqueuedAt:base});
  const done = applyDeliveryOutcome(pending,DELIVERY_OUTCOMES.ACCEPTED,{now:base,manifest:{contentHash:item.identity.contentHash}});
  const later = base + OUTBOX_RULES.terminalRetentionMs + 86400000;
  assert.deepEqual(normaliseOutbox([done],{now:later}),[]);
  assert.equal(normaliseOutbox([pending],{now:later}).length,1,'unfinished delivery is never aged out');
});

test('the due-row selector respects backoff and drains oldest evidence first',async()=>{
  const first = rowFromRecord(await record(23,base),{enqueuedAt:base});
  const second = rowFromRecord(await record(24,base),{enqueuedAt:base+1000});
  const rows = [second,first];
  assert.equal(dueRow(rows,{now:base+1000}).contentHash,first.contentHash,'oldest evidence drains first');
  assert.equal(dueRow([second],{now:base}),null,'a row is not due before its own enqueue time');
  const waiting = applyDeliveryOutcome(first,DELIVERY_OUTCOMES.SERVICE_UNAVAILABLE,{now:base,random:()=>0.5});
  assert.equal(dueRow([second,waiting],{now:base+1000}).contentHash,second.contentHash,
    'a backed-off row does not block newer evidence');
  assert.equal(dueRow([waiting],{now:base}),null);
  assert.equal(dueRow([waiting],{now:base+OUTBOX_RULES.maxBackoffMs*2}).contentHash,waiting.contentHash);
});

test('the outbox summary reports only bounded, non-identifying delivery categories',async()=>{
  const item = await record(25,base);
  const row = rowFromRecord(item,{enqueuedAt:base});
  const summary = outboxSummary([
    row,
    applyDeliveryOutcome(row,DELIVERY_OUTCOMES.ACCEPTED,{now:base,manifest:{contentHash:item.identity.contentHash}}),
    applyDeliveryOutcome(row,DELIVERY_OUTCOMES.RETENTION_BLOCKED,{now:base})
  ]);
  assert.equal(summary.total,3);
  assert.equal(summary.archived,1);
  assert.equal(summary.blockedRetention,1);
  assert.ok(Object.values(DELIVERY_OUTCOMES).includes(summary.lastOutcome)||summary.lastOutcome===null);
  const text = JSON.stringify(summary);
  for(const forbidden of ['Cf-Access','cookie','Authorization','cloudflareaccess','workers.dev'])
    assert.equal(text.toLowerCase().includes(forbidden.toLowerCase()),false,forbidden);
});

test('every stored outcome string is a fixed local category, never server text',async()=>{
  const item = await record(26,base);
  const row = rowFromRecord(item,{enqueuedAt:base});
  const allowed = new Set(Object.values(DELIVERY_OUTCOMES));
  for(const status of [200,201,400,401,403,404,405,409,413,422,429,500,502,503]){
    for(const workerError of [null,'archive_failed','origin_not_allowed','understat_retention_not_approved','sk-secret-leak https://team.cloudflareaccess.com']){
      const outcome = classifyResponse({status,workerError});
      assert.ok(allowed.has(outcome),`${status}/${workerError}`);
      const next = applyDeliveryOutcome(row,outcome,{now:base,random:()=>0.5});
      assert.ok(next.lastOutcome===null||allowed.has(next.lastOutcome));
      assert.equal(JSON.stringify(next).includes('sk-secret-leak'),false);
      assert.equal(JSON.stringify(next).includes('cloudflareaccess'),false);
    }
  }
});
