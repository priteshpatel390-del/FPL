import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { finaliseSnapshotRecord, SNAPSHOT_SCHEMA_VERSION, stableStringify } from '../src/evidence/snapshot.mjs';
import { OUTBOX_RULES, OUTBOX_STATES, DELIVERY_OUTCOMES } from '../src/evidence/outbox.mjs';

/* The delivery layer is loaded without a document, so its UI wiring stays
   inert and every assertion below exercises storage and transport only. */
delete globalThis.document;
globalThis.window = {};
globalThis.localStorage = {
  data:{},
  getItem(key){ return Object.prototype.hasOwnProperty.call(this.data,key)?this.data[key]:null; },
  setItem(key,value){ this.data[key]=String(value); },
  removeItem(key){ delete this.data[key]; },
  get length(){ return Object.keys(this.data).length; },
  key(index){ return Object.keys(this.data)[index]??null; }
};
const evidence = await import('../src/ui/evidence.mjs?delivery-test');
const delivery = await import('../src/ui/evidence-delivery.mjs?delivery-test');

const deadline = Date.parse('2026-08-15T10:00:00.000Z');
const ENDPOINT = 'https://teamsheet-evidence-archive.fpltsheet.workers.dev/v1/evidence/predeadline';
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
function reset(){ globalThis.localStorage.data = {}; globalThis.__TEAMSHEET_EVIDENCE_ARCHIVE__ = ENDPOINT; }
function jsonResponse(status,body,headers={}){
  return {status,type:'cors',headers:{get:name=>({'content-type':'application/json; charset=utf-8',...headers})[String(name).toLowerCase()]??null},
    json:async()=>body};
}
function manifestFor(record){
  return {contentHash:record.identity.contentHash,r2UploadedAt:new Date(base).toISOString(),
    serverPredeadlineReceived:true,timingGrade:record.timing.grade};
}
async function seed(gameweek,capturedAt=base){
  const item = await record(gameweek,capturedAt);
  await evidence.storeEvidenceRecord(item,{origin:evidence.EVIDENCE_ORIGINS.LOCAL});
  await delivery.enqueueEvidenceForDelivery(item);
  return item;
}

test('the archive endpoint contract accepts only the exact approved ingestion URL',()=>{
  assert.equal(delivery.normaliseArchiveEndpoint(ENDPOINT),ENDPOINT);
  for(const bad of ['','http://teamsheet-evidence-archive.fpltsheet.workers.dev/v1/evidence/predeadline',
    'https://teamsheet-evidence-archive.fpltsheet.workers.dev/v1/health',
    'https://teamsheet-evidence-archive.fpltsheet.workers.dev/v1/evidence/predeadline?x=1',
    'https://teamsheet-evidence-archive.fpltsheet.workers.dev/v1/admin/reconcile',
    'https://user:pass@teamsheet-evidence-archive.fpltsheet.workers.dev/v1/evidence/predeadline','not a url'])
    assert.equal(delivery.normaliseArchiveEndpoint(bad),null,bad);
  assert.equal(delivery.archiveSignInUrl(ENDPOINT),'https://teamsheet-evidence-archive.fpltsheet.workers.dev/v1/health');
});

test('a successful upload posts the exact canonical record and stores an acknowledgement',async()=>{
  reset();
  const item = await seed(1);
  const canonical = stableStringify(item);
  const calls = [];
  const fetchFn = async(url,init)=>{ calls.push({url,init}); return jsonResponse(201,{ok:true,duplicate:false,manifest:manifestFor(item)}); };
  const result = await delivery.flushOutbox({fetchFn});
  assert.equal(result.delivered,1);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,ENDPOINT);
  assert.equal(calls[0].init.method,'POST');
  assert.equal(calls[0].init.credentials,'include');
  assert.equal(calls[0].init.mode,'cors');
  assert.equal(calls[0].init.headers['Content-Type'],'application/json');
  const envelope = JSON.parse(calls[0].init.body);
  assert.equal(envelope.origin,'local_capture');
  assert.equal(envelope.idempotencyKey,item.identity.contentHash);
  assert.equal(stableStringify(envelope.record),canonical,'the posted record is byte-identical to the stored record');
  const rows = await delivery.loadOutbox();
  assert.equal(rows[0].state,OUTBOX_STATES.SENT);
  assert.equal(rows[0].receipt.contentHash,item.identity.contentHash);
  const stored = await evidence.loadEvidenceRecord(item.identity.snapshotId);
  assert.equal(stableStringify(stored),canonical,'delivery never rewrites the local record');
});

test('a duplicate acknowledgement is a terminal success and is not retried',async()=>{
  reset();
  const item = await seed(2);
  let calls = 0;
  const fetchFn = async()=>{ calls++; return jsonResponse(200,{ok:true,duplicate:true,manifest:manifestFor(item)}); };
  await delivery.flushOutbox({fetchFn});
  assert.equal((await delivery.loadOutbox())[0].state,OUTBOX_STATES.DUPLICATE);
  await delivery.flushOutbox({fetchFn});
  assert.equal(calls,1,'a completed record is never re-posted');
});

test('offline stays pending, survives a restart and later succeeds without a new snapshot',async()=>{
  reset();
  const item = await seed(3);
  const canonical = stableStringify(item);
  const offline = async()=>{ throw new TypeError('Failed to fetch'); };
  await delivery.flushOutbox({fetchFn:offline});
  let rows = await delivery.loadOutbox();
  assert.equal(rows[0].state,OUTBOX_STATES.PENDING);
  assert.equal(rows[0].lastOutcome,DELIVERY_OUTCOMES.NETWORK_UNAVAILABLE);
  const enqueuedAt = rows[0].enqueuedAt;

  /* Restart: a fresh module instance reading the same persisted storage. */
  const restarted = await import('../src/ui/evidence-delivery.mjs?restart-test');
  rows = await restarted.loadOutbox();
  assert.equal(rows.length,1);
  assert.equal(rows[0].state,OUTBOX_STATES.PENDING);
  assert.equal(rows[0].enqueuedAt,enqueuedAt,'a restart does not restamp evidence');

  const posted = [];
  const online = async(url,init)=>{ posted.push(JSON.parse(init.body)); return jsonResponse(201,{ok:true,manifest:manifestFor(item)}); };
  await restarted.flushOutbox({fetchFn:online,nowFn:()=>base+OUTBOX_RULES.maxBackoffMs*4});
  assert.equal(posted.length,1);
  assert.equal(posted[0].enqueuedAt,enqueuedAt);
  assert.equal(stableStringify(posted[0].record),canonical,'the record is delivered, never regenerated');
  assert.equal((await restarted.loadOutbox())[0].state,OUTBOX_STATES.SENT);
});

test('Cloudflare Access interception without a Worker body is treated as an identity gap',async()=>{
  reset();
  await seed(4);
  const fetchFn = async()=>({status:403,type:'cors',headers:{get:()=>'text/html'},json:async()=>{ throw new Error('not json'); }});
  await delivery.flushOutbox({fetchFn});
  const row = (await delivery.loadOutbox())[0];
  assert.equal(row.state,OUTBOX_STATES.PENDING);
  assert.equal(row.lastOutcome,DELIVERY_OUTCOMES.AUTH_UNAVAILABLE);
  assert.equal(row.attemptCount,0,'an identity gap is not a transient delivery failure');
  assert.equal(row.authAttemptCount,1);
});

test('an opaque redirect to the Access sign-in page is an identity gap, not a rejection',async()=>{
  reset();
  await seed(5);
  await delivery.flushOutbox({fetchFn:async()=>({type:'opaqueredirect',status:0})});
  assert.equal((await delivery.loadOutbox())[0].lastOutcome,DELIVERY_OUTCOMES.AUTH_UNAVAILABLE);
});

test('a Worker origin/configuration rejection pauses instead of retrying against a closed service',async()=>{
  reset();
  await seed(6);
  await delivery.flushOutbox({fetchFn:async()=>jsonResponse(403,{error:'origin_not_allowed'})});
  const row = (await delivery.loadOutbox())[0];
  assert.equal(row.state,OUTBOX_STATES.PAUSED);
  assert.equal(row.lastOutcome,DELIVERY_OUTCOMES.CONFIGURATION);
  assert.equal(row.nextAttemptAt,null);
  assert.equal(row.authAttemptCount,0);
});

test('a 4xx contract rejection is permanent and a 5xx or 429 is retried',async()=>{
  reset();
  await seed(7);
  await delivery.flushOutbox({fetchFn:async()=>jsonResponse(422,{error:'snapshot_section_hash'})});
  assert.equal((await delivery.loadOutbox())[0].state,OUTBOX_STATES.REJECTED);

  reset();
  await seed(8);
  await delivery.flushOutbox({fetchFn:async()=>jsonResponse(500,{error:'archive_failed'})});
  let row = (await delivery.loadOutbox())[0];
  assert.equal(row.state,OUTBOX_STATES.PENDING);
  assert.equal(row.lastOutcome,DELIVERY_OUTCOMES.SERVICE_UNAVAILABLE);

  reset();
  await seed(9);
  await delivery.flushOutbox({fetchFn:async()=>jsonResponse(429,{error:'rate_limited'},{'retry-after':'60'})});
  row = (await delivery.loadOutbox())[0];
  assert.equal(row.state,OUTBOX_STATES.PENDING);
  assert.equal(row.lastOutcome,DELIVERY_OUTCOMES.RATE_LIMITED);
  assert.ok(Date.parse(row.nextAttemptAt)-Date.parse(row.lastAttemptAt)>=60000);
});

test('an R2 or D1 backend fault leaves the record pending and recoverable',async()=>{
  for(const error of ['r2_verification_failed','d1_verification_failed']){
    reset();
    const item = await seed(10);
    await delivery.flushOutbox({fetchFn:async()=>jsonResponse(500,{error})});
    assert.equal((await delivery.loadOutbox())[0].state,OUTBOX_STATES.PENDING,error);
    const retried = [];
    await delivery.flushOutbox({fetchFn:async(url,init)=>{ retried.push(JSON.parse(init.body)); return jsonResponse(200,{ok:true,duplicate:true,manifest:manifestFor(item)}); },
      nowFn:()=>base+OUTBOX_RULES.maxBackoffMs*4});
    assert.equal(retried[0].idempotencyKey,item.identity.contentHash,'the retry is idempotent by content hash');
    assert.equal((await delivery.loadOutbox())[0].state,OUTBOX_STATES.DUPLICATE,error);
  }
});

test('provider-retention material is blocked locally and never uploaded or stripped',async()=>{
  reset();
  const item = await record(11,base,{modelInputs:{players:[{id:1}],teams:[],events:[],fixtures:[],
    minuteHistory:{},calibration:null,understat:{1:{xg:1.2}},odds:null}});
  const canonical = stableStringify(item);
  await evidence.storeEvidenceRecord(item,{origin:evidence.EVIDENCE_ORIGINS.LOCAL});
  await delivery.enqueueEvidenceForDelivery(item);
  let called = 0;
  await delivery.flushOutbox({fetchFn:async()=>{ called++; return jsonResponse(201,{ok:true,manifest:manifestFor(item)}); }});
  assert.equal(called,0,'blocked evidence is never sent to the archive');
  const row = (await delivery.loadOutbox())[0];
  assert.equal(row.state,OUTBOX_STATES.BLOCKED_RETENTION);
  assert.equal(row.blockedProvider,'understat');
  assert.equal(stableStringify(await evidence.loadEvidenceRecord(item.identity.snapshotId)),canonical,
    'a blocked record keeps its exact canonical identity');
});

test('a recovery-imported record is never offered to the archive',async()=>{
  reset();
  const item = await record(12,base);
  await evidence.storeEvidenceRecord(item,{origin:evidence.EVIDENCE_ORIGINS.RECOVERY});
  assert.deepEqual(await delivery.loadOutbox(),[]);
  const stored = JSON.stringify(globalThis.localStorage.data[evidence.K_EVIDENCE_OUTBOX] ?? null);
  assert.equal(stored,'null','a restored file never creates prospective server evidence');
});

test('a pending record survives the bounded local retention sweep',async()=>{
  reset();
  const first = await seed(13,base);
  const kept = [first.identity.snapshotId];
  for(let gw=14;gw<=16;gw++) kept.push((await seed(gw,base+(gw-13)*1000)).identity.snapshotId);
  const pinned = await delivery.pinnedEvidenceIds();
  assert.equal(pinned.length,Math.min(4,OUTBOX_RULES.pinLimit));
  for(const snapshotId of kept.slice(-OUTBOX_RULES.pinLimit)){
    const stored = await evidence.loadEvidenceRecord(snapshotId);
    assert.ok(stored,`pending evidence ${snapshotId} must survive the two-record local limit`);
  }
});

test('an over-limit pending record is released visibly and reported as no longer stored',async()=>{
  reset();
  const created = [];
  for(let gw=20;gw<20+OUTBOX_RULES.pinLimit+1;gw++) created.push(await seed(gw,base+(gw-20)*1000));
  const rows = await delivery.loadOutbox();
  const expired = rows.filter(row=>row.state===OUTBOX_STATES.EXPIRED_LOCAL);
  assert.equal(expired.length,1);
  assert.equal(expired[0].snapshotId,created[0].identity.snapshotId,'the oldest pending evidence is released first');
  assert.equal(expired[0].lastOutcome,DELIVERY_OUTCOMES.RECORD_UNAVAILABLE);
  assert.equal(delivery.deliveryCopyKey({expiredLocal:1,blockedRetention:0,paused:0,pending:0,rejected:0,archived:0},true),'expired');
});

test('a delivery row whose record has gone is closed rather than retried forever',async()=>{
  reset();
  const item = await seed(30);
  await evidence.rawEvidenceDelete(evidence.K_EVIDENCE_PREFIX+item.identity.snapshotId);
  let called = 0;
  await delivery.flushOutbox({fetchFn:async()=>{ called++; return jsonResponse(201,{ok:true}); }});
  assert.equal(called,0);
  const row = (await delivery.loadOutbox())[0];
  assert.equal(row.state,OUTBOX_STATES.EXPIRED_LOCAL);
});

test('a corrupt outbox degrades to empty without throwing and never blocks capture',async()=>{
  reset();
  await evidence.rawEvidenceSet(evidence.K_EVIDENCE_OUTBOX,'{not json');
  assert.deepEqual(await delivery.loadOutbox(),[]);
  assert.deepEqual(await delivery.pinnedEvidenceIds(),[]);
  const item = await record(31,base);
  await evidence.storeEvidenceRecord(item,{origin:evidence.EVIDENCE_ORIGINS.LOCAL});
  assert.ok(await evidence.loadEvidenceRecord(item.identity.snapshotId),'capture succeeds despite a corrupt outbox');
});

test('an unwritable outbox never fails the verified local evidence write',async()=>{
  reset();
  const item = await record(32,base);
  const setItem = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = function(key,value){
    if(key===evidence.K_EVIDENCE_OUTBOX) throw new Error('QuotaExceededError');
    return setItem.call(this,key,value);
  };
  try{
    await evidence.storeEvidenceRecord(item,{origin:evidence.EVIDENCE_ORIGINS.LOCAL});
    assert.equal(await delivery.enqueueEvidenceForDelivery(item),null);
    assert.ok(await evidence.loadEvidenceRecord(item.identity.snapshotId),'the record is still saved locally');
  }finally{ globalThis.localStorage.setItem = setItem; }
});

test('delivery does not run when the archive is unconfigured or the browser reports offline',async()=>{
  reset();
  await seed(33);
  globalThis.__TEAMSHEET_EVIDENCE_ARCHIVE__ = null;
  let called = 0;
  const fetchFn = async()=>{ called++; return jsonResponse(201,{ok:true}); };
  assert.equal((await delivery.flushOutbox({fetchFn})).reason,'not_configured');
  globalThis.__TEAMSHEET_EVIDENCE_ARCHIVE__ = ENDPOINT;
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis,'navigator');
  Object.defineProperty(globalThis,'navigator',{value:{onLine:false},configurable:true,writable:true});
  assert.equal((await delivery.flushOutbox({fetchFn})).reason,'offline');
  if(navigatorDescriptor) Object.defineProperty(globalThis,'navigator',navigatorDescriptor);
  else delete globalThis.navigator;
  assert.equal(called,0);
  assert.equal((await delivery.loadOutbox())[0].state,OUTBOX_STATES.PENDING);
});

test('concurrent flushes send each record at most once',async()=>{
  reset();
  const item = await seed(34);
  const bodies = [];
  const fetchFn = async(url,init)=>{
    bodies.push(JSON.parse(init.body).idempotencyKey);
    await new Promise(resolve=>setTimeout(resolve,5));
    return jsonResponse(201,{ok:true,manifest:manifestFor(item)});
  };
  await Promise.all([delivery.flushOutbox({fetchFn}),delivery.flushOutbox({fetchFn}),delivery.flushOutbox({fetchFn})]);
  assert.equal(bodies.length,1,'the single-flight lease prevents a duplicate in-flight upload');
});

test('an archive fault never changes recommendation state or evidence capture',async()=>{
  reset();
  const item = await seed(35);
  const before = stableStringify(item);
  for(const fetchFn of [
    async()=>{ throw new Error('network down'); },
    async()=>jsonResponse(500,{error:'archive_failed'}),
    async()=>jsonResponse(403,{error:'origin_not_allowed'}),
    async()=>{ throw new TypeError('Failed to fetch'); }
  ]){
    const result = await delivery.flushOutbox({fetchFn});
    assert.ok(result,'flushOutbox always resolves');
    assert.equal(stableStringify(await evidence.loadEvidenceRecord(item.identity.snapshotId)),before);
  }
});

test('no Access token, cookie, endpoint or secret is ever persisted by the delivery layer',async()=>{
  reset();
  const item = await seed(36);
  await delivery.flushOutbox({fetchFn:async()=>jsonResponse(201,{ok:true,
    manifest:{...manifestFor(item),note:'CF_Authorization=leak sk-secret-value https://team.cloudflareaccess.com'}})});
  const stored = JSON.stringify(globalThis.localStorage.data);
  for(const forbidden of ['CF_Authorization','Cf-Access-Jwt-Assertion','cloudflareaccess','sk-secret-value',
    'workers.dev','POLICY_AUD','TEAM_DOMAIN','set-cookie'])
    assert.equal(stored.toLowerCase().includes(forbidden.toLowerCase()),false,forbidden);
});

test('the delivery layer never sees an FPL Team ID, manager name or league identifier',async()=>{
  reset();
  const item = await seed(37);
  await delivery.flushOutbox({fetchFn:async(url,init)=>{
    const body = init.body;
    for(const forbidden of ['teamId','entryId','leagueId','managerName'])
      assert.equal(body.includes(`"${forbidden}"`),false,forbidden);
    return jsonResponse(201,{ok:true,manifest:manifestFor(item)});
  }});
  assert.equal((await delivery.loadOutbox())[0].state,OUTBOX_STATES.SENT);
});

test('user-facing delivery copy stays generic and exposes no security detail',()=>{
  const text = Object.values(delivery.DELIVERY_COPY).flat().join(' ');
  for(const forbidden of ['403','401','JWT','cookie','Cloudflare','Access','CORS','origin','token','D1','R2','Worker'])
    assert.equal(text.includes(forbidden),false,forbidden);
  assert.equal(delivery.deliveryCopyKey({expiredLocal:0,blockedRetention:0,paused:0,pending:0,rejected:0,archived:0},false),'not_configured');
  assert.equal(delivery.deliveryCopyKey({expiredLocal:0,blockedRetention:0,paused:1,pending:0,rejected:0,archived:0,
    lastOutcome:DELIVERY_OUTCOMES.AUTH_UNAVAILABLE},true),'auth');
  assert.equal(delivery.deliveryCopyKey({expiredLocal:0,blockedRetention:1,paused:0,pending:0,rejected:0,archived:0},true),'blocked');
  assert.equal(delivery.deliveryCopyKey({expiredLocal:0,blockedRetention:0,paused:0,pending:0,rejected:0,archived:2},true),'archived');
});

test('the browser is permitted to reach the evidence archive and nothing wider',()=>{
  const html = readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const policy = /Content-Security-Policy"\s+content="([^"]+)"/.exec(html)?.[1] || '';
  const connect = policy.split(';').map(part=>part.trim()).find(part=>part.startsWith('connect-src')) || '';
  assert.ok(connect.includes('https://teamsheet-evidence-archive.fpltsheet.workers.dev'));
  assert.equal(connect.includes('*-teamsheet-evidence-archive'),false,'no preview or version hostname');
  assert.equal(connect.includes('*.workers.dev'),false);
  const app = readFileSync(new URL('../app.html',import.meta.url),'utf8');
  assert.match(app,/name="teamsheet-evidence-archive" content="https:\/\/teamsheet-evidence-archive\.fpltsheet\.workers\.dev\/v1\/evidence\/predeadline"/);
  const build = readFileSync(new URL('../build.mjs',import.meta.url),'utf8');
  assert.ok(build.indexOf('src/evidence/outbox.mjs')<build.indexOf('src/ui/evidence-delivery.mjs'));
  assert.ok(build.indexOf('src/ui/evidence.mjs')<build.indexOf('src/ui/evidence-delivery.mjs'));
});

test('the production bundle carries the delivery surface and keeps capture independent of it',()=>{
  const bundle = readFileSync(new URL('../dist/app.bundle.js',import.meta.url),'utf8');
  assert.ok(bundle.includes('src/evidence/outbox.mjs'));
  assert.ok(bundle.includes('src/ui/evidence-delivery.mjs'));
  assert.ok(bundle.includes('teamsheet:evidence-stored'));
  const source = readFileSync(new URL('../src/ui/evidence.mjs',import.meta.url),'utf8');
  assert.equal(source.includes('evidence-delivery.mjs'),false,
    'Stage 10 capture must not depend on the delivery layer');
  assert.equal(source.includes('fetch('),false,'Stage 10 capture must not contact the archive');
});

test('storage evidence is read-only, never writes and degrades without an estimate API',async()=>{
  reset();
  await seed(25);
  const before = JSON.stringify(globalThis.localStorage.data);
  const bytes = delivery.teamsheetStorageBytes();
  assert.ok(Number.isFinite(bytes) && bytes > 0,'Teamsheet storage use is reported');
  assert.equal(JSON.stringify(globalThis.localStorage.data),before,'reading storage evidence writes nothing');

  /* No navigator.storage: the reading is reported as unavailable rather than
     invented, and nothing throws. */
  assert.equal(await delivery.browserStorageEstimate(),null);
  let line = await delivery.storageEvidenceLine();
  assert.match(line,/Teamsheet data on this device: /);
  assert.match(line,/does not report a storage estimate/);

  const descriptor = Object.getOwnPropertyDescriptor(globalThis,'navigator');
  Object.defineProperty(globalThis,'navigator',
    {value:{storage:{estimate:async()=>({usage:1234567,quota:52428800})}},configurable:true,writable:true});
  try{
    assert.deepEqual(await delivery.browserStorageEstimate(),{usage:1234567,quota:52428800});
    line = await delivery.storageEvidenceLine();
    assert.match(line,/browser reports 1\.2 MB used of 50\.0 MB available/);
  }finally{
    if(descriptor) Object.defineProperty(globalThis,'navigator',descriptor);
    else delete globalThis.navigator;
  }
  assert.equal(JSON.stringify(globalThis.localStorage.data),before,'the estimate path writes nothing either');
});

test('a failing storage estimate never breaks the evidence panel',async()=>{
  reset();
  const descriptor = Object.getOwnPropertyDescriptor(globalThis,'navigator');
  Object.defineProperty(globalThis,'navigator',
    {value:{storage:{estimate:async()=>{ throw new Error('not allowed'); }}},configurable:true,writable:true});
  try{
    assert.equal(await delivery.browserStorageEstimate(),null);
    assert.match(await delivery.storageEvidenceLine(),/does not report a storage estimate/);
  }finally{
    if(descriptor) Object.defineProperty(globalThis,'navigator',descriptor);
    else delete globalThis.navigator;
  }
  assert.equal(delivery.formatBytes(null),'unavailable');
  assert.equal(delivery.formatBytes(512),'512 B');
  assert.equal(delivery.formatBytes(1024*1024),'1.0 MB');
});

test('no persistence technology beyond the existing string store is introduced',()=>{
  for(const path of ['../src/evidence/outbox.mjs','../src/ui/evidence-delivery.mjs']){
    const source = readFileSync(new URL(path,import.meta.url),'utf8');
    for(const forbidden of ['indexedDB','IDBDatabase','openDatabase','caches.open','FileSystemHandle'])
      assert.equal(source.includes(forbidden),false,`${path} must not introduce ${forbidden}`);
  }
});
