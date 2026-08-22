import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STAGE10_ACCEPTANCE_SEASON,STAGE10_ACCEPTANCE_GAMEWEEK,STAGE10_ACCEPTANCE_MANAGER_REF,
  STAGE10_ACCEPTANCE_CONTENT_HASH,STAGE10_ACCEPTANCE_SNAPSHOT_ID,
  buildStage10AcceptanceFixture,isExactStage10AcceptanceIdentity
} from '../src/evidence/stage10-acceptance.mjs';
import { validateSnapshotRecord } from '../src/evidence/snapshot.mjs';
import { validateSnapshotRecord as validateWorkerSnapshot,r2KeyFor } from '../workers/evidence-archive-core.mjs';
import { rowFromRecord,normaliseOutbox,outboxRow } from '../src/evidence/outbox.mjs';
import { storeEvidenceRecord,K_EVIDENCE_INDEX,K_EVIDENCE_JOURNAL,K_EVIDENCE_PREFIX } from '../src/ui/evidence.mjs';
import { stage10AcceptanceGate,verifiedStage10AcceptanceFixture } from '../src/ui/stage10-acceptance.mjs';

const HASH=STAGE10_ACCEPTANCE_CONTENT_HASH;
const ID=STAGE10_ACCEPTANCE_SNAPSHOT_ID;

test('acceptance fixture is deterministic, unmistakably synthetic and passes unchanged client and Worker validators',async()=>{
  const first=await buildStage10AcceptanceFixture(),second=await buildStage10AcceptanceFixture();
  assert.deepEqual(first,second);
  assert.equal(first.season,'2099-00');assert.equal(first.gameweek,38);assert.equal(first.recordType,'preDeadlineSnapshot');
  assert.equal(first.schemaVersion,'1.0.0');assert.equal(first.managerRef,'mgr-000000000000000000000000000000c5');
  assert.equal(first.completeness.complete,false);assert.equal(first.timing.grade,'client_recorded');assert.equal(first.timing.officialEligible,false);
  assert.deepEqual(first.timing.reasons,['snapshot_incomplete','network_time_unavailable']);
  assert.equal(first.identity.contentHash,'ae9149da8e77faaaf1f25400310de7f5c2e7a1c2f20c9645e7ba99a9fa3c4408');
  assert.equal(first.identity.snapshotId,'predeadline-gw38-ae9149da8e77faaa');
  assert.match(first.identity.contentHash,/^[0-9a-f]{64}$/);assert.ok(isExactStage10AcceptanceIdentity(first));
  assert.deepEqual(first.providers.map(row=>row.provider),['fpl','understat','odds','archive']);
  first.providers.forEach(row=>{assert.equal(row.included,false);assert.equal(row.didAffectModel,false);assert.equal(row.state,'Disabled');});
  assert.deepEqual(first.modelInputs,{events:[],teams:[],players:[],fixtures:[],minuteHistory:{},calibration:null,understat:null,odds:null});
  assert.deepEqual(first.outputs.players,[]);assert.equal(first.outputs.squad.status,'not_available');
  assert.equal((await validateSnapshotRecord(first)).ok,true);
  assert.equal((await validateWorkerSnapshot(first)).ok,true);
  assert.equal(r2KeyFor(first),`evidence/v1/preDeadlineSnapshot/2099-00/gw38/${HASH}.json.gz`);
});

test('fixture builder has no runtime, user, browser, provider-cache or network dependencies',()=>{
  const source=readFileSync(new URL('../src/evidence/stage10-acceptance.mjs',import.meta.url),'utf8');
  const imports=[...source.matchAll(/^import .* from ['"]([^'"]+)['"];$/gm)].map(match=>match[1]);
  assert.deepEqual(imports,['./snapshot.mjs']);
  assert.match(source,/function buildStage10AcceptanceFixture\(cryptoImpl=globalThis\.crypto\)/);
  for(const pattern of [/\bS\./,/localStorage/,/document\./,/location\./,/cookie/i,/fetch\s*\(/,/evidenceManagerRef\s*\(/,/mySquad\s*\(/,/miniLeague/i,/current team picks/i])
    assert.doesNotMatch(source,pattern);
});

test('ordinary storage validates, journals, verifies, indexes and dispatches the normal evidence-stored event',async()=>{
  const values=new Map(),events=[];
  const original={localStorage:globalThis.localStorage,document:globalThis.document,CustomEvent:globalThis.CustomEvent};
  globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),key:index=>[...values.keys()][index]??null,get length(){return values.size;}};
  globalThis.document={dispatchEvent:event=>{events.push(event);return true;}};
  globalThis.CustomEvent=class {constructor(type,init){this.type=type;this.detail=init?.detail;}};
  try{
    const fixture=await buildStage10AcceptanceFixture();
    await storeEvidenceRecord(fixture);
    assert.ok(values.has(K_EVIDENCE_PREFIX+ID));assert.ok(values.has(K_EVIDENCE_INDEX));assert.equal(values.has(K_EVIDENCE_JOURNAL),false);
    assert.equal(events.length,1);assert.equal(events[0].type,'teamsheet:evidence-stored');
    assert.equal(events[0].detail.record.identity.contentHash,HASH);assert.equal(events[0].detail.origin,'local_capture');
  }finally{
    if(original.localStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=original.localStorage;
    if(original.document===undefined)delete globalThis.document;else globalThis.document=original.document;
    if(original.CustomEvent===undefined)delete globalThis.CustomEvent;else globalThis.CustomEvent=original.CustomEvent;
  }
});

test('only the exact immutable acceptance row bypasses the production-season outbox filter',async()=>{
  const fixture=await buildStage10AcceptanceFixture(),exact=rowFromRecord(fixture,{enqueuedAt:Date.parse('2099-05-23T18:00:02Z')});
  assert.equal(exact.idempotencyKey,HASH);
  const arbitrary2099=outboxRow({...exact,contentHash:'1'.repeat(64),idempotencyKey:'1'.repeat(64),snapshotId:'predeadline-gw38-'+ '1'.repeat(16)});
  const foreign=outboxRow({...exact,season:'2098-99',gameweek:37,contentHash:'2'.repeat(64),idempotencyKey:'2'.repeat(64),snapshotId:'predeadline-gw37-'+ '2'.repeat(16)});
  const current=outboxRow({...exact,season:'2026-27',gameweek:1,contentHash:'3'.repeat(64),idempotencyKey:'3'.repeat(64),snapshotId:'predeadline-gw1-'+ '3'.repeat(16)});
  const rows=normaliseOutbox([exact,arbitrary2099,foreign,current],{season:'2026-27',now:Date.parse('2099-05-23T18:00:03Z')});
  assert.deepEqual(new Set(rows.map(row=>row.contentHash)),new Set([HASH,'3'.repeat(64)]));
});

test('acceptance control is absent from normal navigation and requires exact query, route and production origin',async()=>{
  const location=(origin,search,hash)=>({origin,search,hash});
  assert.equal(stage10AcceptanceGate(location('https://app.fpltsheet.co.uk','','#/settings/evidence/deadline')),false);
  assert.equal(stage10AcceptanceGate(location('https://app.fpltsheet.co.uk','?stage10Acceptance=1','#/settings')),false);
  assert.equal(stage10AcceptanceGate(location('https://example.test','?stage10Acceptance=1','#/settings/evidence/deadline')),false);
  assert.equal(stage10AcceptanceGate(location('https://app.fpltsheet.co.uk','?stage10Acceptance=true','#/settings/evidence/deadline')),false);
  assert.equal(stage10AcceptanceGate(location('https://app.fpltsheet.co.uk','?stage10Acceptance=1','#/settings/evidence/deadline')),true);
  assert.ok(await verifiedStage10AcceptanceFixture());
  const shell=readFileSync(new URL('../src/ui/app-shell.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(shell,/stage10Acceptance|Run archive acceptance|Synthetic Stage 10 infrastructure acceptance/);
});

test('acceptance action uses ordinary storage and never directly flushes or posts evidence',()=>{
  const source=readFileSync(new URL('../src/ui/stage10-acceptance.mjs',import.meta.url),'utf8');
  assert.match(source,/await storeEvidenceRecord\(fixture\)/);
  assert.doesNotMatch(source,/flushOutbox|postEvidence|fetch\s*\(/);
  assert.match(source,/stage10AcceptanceComplete=true/);
  const delivery=readFileSync(new URL('../src/ui/evidence-delivery.mjs',import.meta.url),'utf8');
  assert.match(delivery,/addEventListener\('teamsheet:evidence-stored'/);
  assert.match(delivery,/enqueueEvidenceForDelivery\(record\)\.then\(\(\) => \{ scheduleDelivery\(\); \}\)/);
  assert.match(delivery,/mode:'cors'/);assert.match(delivery,/credentials:'include'/);assert.match(delivery,/cache:'no-store'/);
  const build=readFileSync(new URL('../build.mjs',import.meta.url),'utf8');
  assert.match(build,/https:\/\/archive\.fpltsheet\.co\.uk\/v1\/evidence\/predeadline/);
});
