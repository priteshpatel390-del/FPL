import test from 'node:test';
import assert from 'node:assert/strict';
import { finaliseSnapshotRecord, SNAPSHOT_SCHEMA_VERSION } from '../src/evidence/snapshot.mjs';

delete globalThis.document;
globalThis.window={};
globalThis.localStorage={
  data:{},
  getItem(key){ return Object.prototype.hasOwnProperty.call(this.data,key)?this.data[key]:null; },
  setItem(key,value){ this.data[key]=String(value); },
  removeItem(key){ delete this.data[key]; },
  get length(){ return Object.keys(this.data).length; },
  key(index){ return Object.keys(this.data)[index]??null; }
};
const evidence=await import('../src/ui/evidence.mjs?storage-test');

const deadline=Date.parse('2026-08-15T10:00:00.000Z');
const network=at=>({status:'available',serverAt:at,clientMidpointAt:at,skewMs:0,requestStartedAt:at-10,responseReceivedAt:at+10,roundTripMs:20,source:'same_origin_http_date'});
function payload(gameweek,capturedAt){
  return {
    recordType:'preDeadlineSnapshot',schemaVersion:SNAPSHOT_SCHEMA_VERSION,metricVersion:'1.0.0',segmentationVersion:'1.0.0',
    managerRef:'mgr-0123456789abcdef0123456789abcdef',season:'2026-27',gameweek,
    deadlineTime:new Date(deadline+gameweek*86400000).toISOString(),
    build:{modelVersion:'2.4.0',rulesVersion:'2026-27.3',sourceHash:'abc',commit:'def',moduleOrder:[]},
    versions:{model:'2.4.0',rules:'2026-27.3',simulation:'1.0.0',snapshot:SNAPSHOT_SCHEMA_VERSION},
    rules:{fpl:{season:'2026-27'},minutes:{},scoring:{},transfer:{},simulation:{version:'1.0.0'},odds:{},fixture:{baseGoals:1.42,homeTilt:1.1}},
    providers:['fpl','understat','odds','archive'].map(name=>({provider:name,state:name==='fpl'?'Live':'Disabled',included:name==='fpl',didAffectModel:name==='fpl',acceptedRecordCount:name==='fpl'?1:0,rejectedRecordCount:0,recordedAt:new Date(capturedAt-1000).toISOString(),lastSuccessAt:name==='fpl'?new Date(capturedAt-1000).toISOString():null,ageMs:name==='fpl'?0:null,thresholdMs:null,note:'',consequence:''})),
    completeness:{complete:true,sections:{coreInputs:'complete',playerProjections:'complete'},fatalFplIssue:false,playerCount:1,expectedPlayerCount:1},
    capture:{startedAt:new Date(capturedAt-2000).toISOString(),projectionStartedAt:new Date(capturedAt-1500).toISOString(),projectionCompletedAt:new Date(capturedAt-1000).toISOString(),horizon:1},
    modelInputs:{players:[{id:1}],teams:[],events:[],fixtures:[],minuteHistory:{},calibration:null,understat:null,odds:null},
    outputs:{players:[{playerId:1}],squad:{status:'not_available'}},retries:[],issues:[],quality:{projectionDurationMs:1,simulationSamplesPerAvailablePlayer:5000,seasonLive:true}
  };
}
async function record(gameweek,capturedAt){
  return finaliseSnapshotRecord(payload(gameweek,capturedAt),{
    captureStartedAt:capturedAt-2000,captureCompletedAt:capturedAt,
    networkBefore:network(capturedAt-1500),networkAfter:network(capturedAt)
  });
}

test('local recovery encoding compresses and restores a verified evidence record',async()=>{
  const item=await record(1,deadline-30*60000);
  const encoded=await evidence.encodeEvidenceRecord(item);
  assert.match(encoded,/^(?:gzip-base64:|\{)/);
  const decoded=JSON.parse(await evidence.decodeEvidenceRecord(encoded));
  assert.equal(decoded.identity.snapshotId,item.identity.snapshotId);
});

test('evidence manager reference is random, anonymised and stable on the device',async()=>{
  const first=await evidence.evidenceManagerRef();
  const second=await evidence.evidenceManagerRef();
  assert.match(first,/^mgr-[0-9a-f]{32}$/);
  assert.equal(second,first);
});

test('evidence storage keeps three metadata rows and only two full recovery records',async()=>{
  const captures=[deadline-50*60000,deadline-40*60000,deadline-30*60000];
  const records=[];
  for(let i=0;i<3;i++){
    const item=await record(i+1,captures[i]); records.push(item); await evidence.storeEvidenceRecord(item);
  }
  const index=await evidence.loadEvidenceIndex();
  assert.deepEqual(index.map(row=>row.gameweek),[3,2,1]);
  const storedKeys=Object.keys(localStorage.data).filter(key=>key.startsWith(evidence.K_EVIDENCE_PREFIX));
  assert.equal(storedKeys.length,2);
  assert.equal(await evidence.loadEvidenceRecord(records[0].identity.snapshotId),null);
  assert.equal((await evidence.loadEvidenceRecord(records[2].identity.snapshotId)).identity.snapshotId,records[2].identity.snapshotId);
});

test('evidence writes surface storage failures rather than silently claiming success',async()=>{
  const original=localStorage.setItem;
  localStorage.setItem=()=>{ throw new Error('quota full'); };
  await assert.rejects(()=>evidence.rawEvidenceSet('fpl:evidence:test','x'),/quota full/);
  localStorage.setItem=original;
});


test('restored evidence is retained as recovery-only and cannot become official locally',async()=>{
  const item=await record(4,deadline+4*86400000-25*60000);
  await evidence.storeEvidenceRecord(item,{origin:evidence.EVIDENCE_ORIGINS.RECOVERY});
  const row=(await evidence.loadEvidenceIndex()).find(entry=>entry.snapshotId===item.identity.snapshotId);
  assert.equal(row.origin,evidence.EVIDENCE_ORIGINS.RECOVERY);
  assert.equal(row.recordOfficialEligible,true);
  assert.equal(row.officialEligible,false);
});

test('local evidence can be deleted without touching exported files',async()=>{
  const item=await record(5,deadline-20*60000);
  await evidence.storeEvidenceRecord(item);
  const previousRef=await evidence.evidenceManagerRef();
  assert.ok(previousRef);
  await evidence.clearEvidenceStorage();
  assert.deepEqual(await evidence.loadEvidenceIndex(),[]);
  assert.equal(await evidence.loadEvidenceRecord(item.identity.snapshotId),null);
  assert.equal(await evidence.rawEvidenceGet(evidence.K_EVIDENCE_MANAGER),null);
});


test('legacy metadata without an origin fails closed as recovery-only',async()=>{
  const item=await record(6,deadline+6*86400000-20*60000);
  const row={
    snapshotId:item.identity.snapshotId,contentHash:item.identity.contentHash,gameweek:item.gameweek,season:item.season,
    deadlineTime:item.deadlineTime,capturedAt:item.timing.captureCompletedAt,timingGrade:item.timing.grade,
    officialEligible:true,complete:true,buildCommit:item.build.commit,modelVersion:item.versions.model,rulesVersion:item.versions.rules
  };
  localStorage.setItem(evidence.K_EVIDENCE_INDEX,JSON.stringify([row]));
  const migrated=(await evidence.loadEvidenceIndex())[0];
  assert.equal(migrated.origin,evidence.EVIDENCE_ORIGINS.RECOVERY);
  assert.equal(migrated.recordOfficialEligible,true);
  assert.equal(migrated.officialEligible,false);
});

test('corrupt local metadata is ignored and orphaned recovery records are removable',async()=>{
  localStorage.setItem(evidence.K_EVIDENCE_INDEX,JSON.stringify([{snapshotId:'bad',gameweek:99}]));
  localStorage.setItem(evidence.K_EVIDENCE_PREFIX+'orphan','orphaned');
  assert.deepEqual(await evidence.loadEvidenceIndex(),[]);
  await evidence.clearEvidenceStorage();
  assert.equal(localStorage.getItem(evidence.K_EVIDENCE_PREFIX+'orphan'),null);
});

// Stage 10.5 snapshot journal recovery

test('Stage 10.5 snapshot journal recovers a verified payload after an interrupted index write',async()=>{
  globalThis.localStorage.data={};
  const item=await record(7,deadline+7*86400000-18*60000);
  await evidence.rawEvidenceSet(evidence.K_EVIDENCE_PREFIX+item.identity.snapshotId,await evidence.encodeEvidenceRecord(item));
  await evidence.rawEvidenceSet(evidence.K_EVIDENCE_JOURNAL,JSON.stringify({recordType:'preDeadlineSnapshot',recordId:item.identity.snapshotId,contentHash:item.identity.contentHash,logicalKey:item.identity.duplicateKey,origin:evidence.EVIDENCE_ORIGINS.LOCAL,priorCurrentId:null,phase:'payload_verified',startedAt:new Date().toISOString()}));
  assert.deepEqual(await evidence.loadEvidenceIndex(),[]);
  await evidence.recoverEvidenceJournal();
  const recovered=await evidence.loadEvidenceIndex();
  assert.equal(recovered[0].snapshotId,item.identity.snapshotId);
  assert.equal(recovered[0].officialEligible,true);
  assert.equal(await evidence.rawEvidenceGet(evidence.K_EVIDENCE_JOURNAL),null);
});

test('Stage 10.5 malformed snapshot journal fails closed and is cleared',async()=>{
  globalThis.localStorage.data={};
  await evidence.rawEvidenceSet(evidence.K_EVIDENCE_JOURNAL,'{"recordId":"untrusted"}');
  await evidence.recoverEvidenceJournal();
  assert.equal(await evidence.rawEvidenceGet(evidence.K_EVIDENCE_JOURNAL),null);
  assert.deepEqual(await evidence.loadEvidenceIndex(),[]);
});

test('Stage 10.5 compression failure falls back to canonical plain JSON',async()=>{
  const original=globalThis.CompressionStream;
  globalThis.CompressionStream=class{constructor(){throw new Error('compression unavailable');}};
  try{const item=await record(8,deadline+8*86400000-18*60000);const encoded=await evidence.encodeEvidenceRecord(item);assert.ok(encoded.startsWith('{'));}
  finally{globalThis.CompressionStream=original;}
});
