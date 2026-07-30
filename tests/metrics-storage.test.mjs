import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { buildGameweekEvaluation, METRIC_RULES } from '../src/evidence/metrics.mjs';
import {
  K_METRIC_INDEX,K_METRIC_PREFIX,K_METRIC_JOURNAL,normaliseMetricIndex,loadMetricIndex,loadMetricRecord,
  storeMetricRecord,recoverMetricJournal,clearMetricStorage,metricCurrentMetadata
} from '../src/ui/metrics.mjs';
import { rawEvidenceSet,rawEvidenceGet,encodeEvidenceRecord } from '../src/ui/evidence.mjs';

class MemoryStorage{
  constructor(){this.map=new Map();this.fail=false;}
  get length(){return this.map.size;}
  key(index){return [...this.map.keys()][index]??null;}
  getItem(key){return this.map.has(key)?this.map.get(key):null;}
  setItem(key,value){if(this.fail) throw new Error('quota');this.map.set(key,String(value));}
  removeItem(key){this.map.delete(key);}
}
const managerRef='mgr-0123456789abcdef0123456789abcdef',deadline='2026-08-21T17:30:00.000Z',contentHash='a'.repeat(64);
function reset(){globalThis.localStorage=new MemoryStorage();delete globalThis.window;}
function snapshot(gameweek=1){return {recordType:'preDeadlineSnapshot',managerRef,season:'2026-27',gameweek,deadlineTime:deadline,timing:{officialEligible:true},completeness:{complete:true},identity:{snapshotId:`predeadline-gw${gameweek}-0123456789abcdef`,contentHash},providers:[],modelInputs:{fixtures:[{id:10,event:gameweek,team_h:1,team_a:2,team_h_difficulty:2,team_a_difficulty:4}]},outputs:{players:[{playerId:1,clubId:1,position:3,nowCost:75,status:'a',minutes:{pStart:.8,pAppear:.9,p60:.7,expMin:75,confidenceLabel:'High',source:'detailed'},nextGameweek:{gw:gameweek,total:5},perGameweek:[{gw:gameweek,total:5}],uncertainty:{status:'available',p10:1,p25:3,p75:7,p90:10,blankProbability:.2,returnProbability:.5,haulProbability:.1,megaHaulProbability:.02},sourceUsage:{}}],squad:{status:'not_available'}}};}
function outcome(gameweek=1,points=6,revision=1,status='complete'){return {recordType:'gameweekOutcome',managerRef,season:'2026-27',gameweek,status,officialDeadlineIdentity:{deadlineTime:deadline},relatedSnapshot:{status:'matched_official',snapshotId:`predeadline-gw${gameweek}-0123456789abcdef`,contentHash},fixtureOutcomes:{records:[{fixtureId:10,event:gameweek,homeTeamId:1,awayTeamId:2,finished:true}]},allPlayerOutcomes:{records:[{playerId:1,totalPoints:points,minutes:90,starts:1,appeared:true,reachedSixty:true,perFixture:[{fixtureId:10,points,officialStats:[{identifier:'minutes',value:90,points:0},{identifier:'starts',value:1,points:0}]}]}]},realSquadOutcome:{status:'not_available',picks:[]},completeness:{complete:true},identity:{outcomeId:`outcome-2026-27-gw${gameweek}-r${revision}-${String(revision).padStart(16,'0')}`,outcomeDataHash:String(revision).padStart(64,'b'),revision}};}
async function record(points=6,previous=null){return (await buildGameweekEvaluation(snapshot(),outcome(1,points,previous?2:1,previous?'corrected':'complete'),{previousRecord:previous,cryptoImpl:webcrypto})).record;}

test('metric storage verifies, reloads and keeps one current revision',async()=>{
  reset();const first=await record();const stored=await storeMetricRecord(first);assert.equal(stored.stored,true);
  assert.equal((await loadMetricRecord(first.identity.evaluationId)).identity.contentHash,first.identity.contentHash);
  const index=await loadMetricIndex();assert.equal(index.length,1);assert.equal(index[0].current,true);assert.equal(metricCurrentMetadata(index,'2026-27|gw1').recordId,first.identity.evaluationId);
});

test('identical metrics deduplicate while corrections retain immutable superseded data',async()=>{
  reset();const first=await record();await storeMetricRecord(first);assert.equal((await storeMetricRecord(first)).stored,false);
  const second=await record(9,first);await storeMetricRecord(second);const index=await loadMetricIndex();assert.equal(index.filter(row=>row.current).length,1);assert.equal(metricCurrentMetadata(index,'2026-27|gw1').recordId,second.identity.evaluationId);
  assert.equal((await loadMetricRecord(first.identity.evaluationId)).observations.players[0].observedPoints,6);
});

test('interrupted metric writes recover through the journal',async()=>{
  reset();const first=await record();await rawEvidenceSet(K_METRIC_PREFIX+first.identity.evaluationId,await encodeEvidenceRecord(first));await rawEvidenceSet(K_METRIC_JOURNAL,JSON.stringify({recordId:first.identity.evaluationId,contentHash:first.identity.contentHash,startedAt:new Date().toISOString()}));
  assert.equal((await loadMetricIndex()).length,0);await recoverMetricJournal();assert.equal((await loadMetricIndex())[0].recordId,first.identity.evaluationId);assert.equal(await rawEvidenceGet(K_METRIC_JOURNAL),null);
});

test('tampered metric records fail validation on reload',async()=>{
  reset();const first=await record();await storeMetricRecord(first);const changed=structuredClone(first);changed.gameweek=2;await rawEvidenceSet(K_METRIC_PREFIX+first.identity.evaluationId,JSON.stringify(changed));assert.equal(await loadMetricRecord(first.identity.evaluationId),null);
});

test('metric metadata is deterministic and bounded',()=>{
  const rows=Array.from({length:85},(_,i)=>({recordId:`evaluation-2026-27-gw1-r${i+1}-${String(i).padStart(16,'0')}`,recordType:'gameweekEvaluation',logicalKey:`2026-27|gw${(i%38)+1}`,season:'2026-27',gameweek:(i%38)+1,revision:i+1,contentHash:String(i).padStart(64,'a'),createdAt:new Date(1000+i).toISOString(),current:false,hasFullRecord:false}));
  assert.equal(normaliseMetricIndex(rows).length,METRIC_RULES.localIndexLimit);
  assert.equal(normaliseMetricIndex(rows)[0].revision,85);
});

test('quota failures are surfaced and deletion is isolated from source evidence',async()=>{
  reset();const first=await record();globalThis.localStorage.fail=true;await assert.rejects(()=>storeMetricRecord(first),/quota/);globalThis.localStorage.fail=false;
  await storeMetricRecord(first);await rawEvidenceSet('fpl:evidence-manager-ref',managerRef);await rawEvidenceSet('fpl:evidence-outcome:index:v1','source');await clearMetricStorage();assert.deepEqual(await loadMetricIndex(),[]);assert.equal(await loadMetricRecord(first.identity.evaluationId),null);assert.equal(await rawEvidenceGet('fpl:evidence-manager-ref'),managerRef);assert.equal(await rawEvidenceGet('fpl:evidence-outcome:index:v1'),'source');assert.equal(await rawEvidenceGet(K_METRIC_INDEX),null);
});

// Stage 10.5 metric journal reconciliation

test('Stage 10.5 metric journal recovery leaves exactly one current revision',async()=>{
  reset();const first=await record();await storeMetricRecord(first);const second=await record(9,first);
  await rawEvidenceSet(K_METRIC_PREFIX+second.identity.evaluationId,await encodeEvidenceRecord(second));
  await rawEvidenceSet(K_METRIC_JOURNAL,JSON.stringify({recordType:'gameweekEvaluation',recordId:second.identity.evaluationId,contentHash:second.identity.contentHash,logicalKey:second.identity.logicalKey,origin:'local_derivation',priorCurrentId:first.identity.evaluationId,phase:'payload_verified',startedAt:new Date().toISOString()}));
  await recoverMetricJournal();const index=await loadMetricIndex();assert.equal(index.filter(row=>row.current).length,1);assert.equal(metricCurrentMetadata(index,'2026-27|gw1').recordId,second.identity.evaluationId);
});

test('Stage 10.5 malformed metric journal fails closed',async()=>{
  reset();await rawEvidenceSet(K_METRIC_JOURNAL,'{"recordId":"bad"}');await recoverMetricJournal();assert.deepEqual(await loadMetricIndex(),[]);assert.equal(await rawEvidenceGet(K_METRIC_JOURNAL),null);
});
