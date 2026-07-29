import test from 'node:test';
import assert from 'node:assert/strict';
import { S } from '../src/state.mjs';
import { collectOutcomePayload, finaliseOutcomeRecord, OUTCOME_RULES } from '../src/evidence/outcome.mjs';
import {
  K_OUTCOME_INDEX,K_OUTCOME_PREFIX,K_OUTCOME_JOURNAL,OUTCOME_ORIGINS,
  normaliseOutcomeIndex,loadOutcomeIndex,loadOutcomeRecord,storeOutcomeRecord,
  recoverOutcomeJournal,clearOutcomeStorage,currentLocalMetadata,shouldCheckOutcome
} from '../src/ui/outcomes.mjs';
import { rawEvidenceSet, rawEvidenceGet, encodeEvidenceRecord } from '../src/ui/evidence.mjs';

class MemoryStorage {
  constructor(){ this.map=new Map(); this.fail=false; }
  get length(){ return this.map.size; }
  key(index){ return [...this.map.keys()][index]??null; }
  getItem(key){ return this.map.has(key)?this.map.get(key):null; }
  setItem(key,value){ if(this.fail) throw new Error('quota'); this.map.set(key,String(value)); }
  removeItem(key){ this.map.delete(key); }
}
const managerRef='mgr-0123456789abcdef0123456789abcdef';
async function recordFor(gameweek=1,points=6,previous=null,{checked=true,finished=true}={}){
  S.boot={events:[{id:gameweek,deadline_time:`2026-08-${String(20+gameweek).padStart(2,'0')}T17:30:00.000Z`,finished,data_checked:checked}],elements:[{id:1}],teams:[],element_types:[]};
  S.retryStats={}; S.teamId='';
  const fixture={id:gameweek*10,event:gameweek,team_h:1,team_a:2,kickoff_time:'2026-08-22T14:00:00.000Z',started:true,finished,finished_provisional:finished,team_h_score:finished?1:null,team_a_score:finished?0:null,minutes:finished?90:0,provisional_start_time:false,stats:[]};
  const live={elements:[{id:1,stats:{total_points:points,minutes:finished?90:0,starts:finished?1:0,goals_scored:0,assists:0,clean_sheets:finished?1:0,goals_conceded:0,saves:0,bonus:0,bps:20,yellow_cards:0,red_cards:0,own_goals:0,penalties_missed:0,penalties_saved:0,defensive_contribution:0},explain:finished?[{fixture:fixture.id,stats:[{identifier:'total_points',points,value:points}]}]:[]}]};
  const payload=(await collectOutcomePayload({managerRef,gameweek,event:S.boot.events[0],fixturesPayload:[fixture],livePayload:live,startedAt:1,completedAt:2})).payload;
  return (await finaliseOutcomeRecord(payload,{previousRecord:previous})).record;
}
function reset(){ globalThis.localStorage=new MemoryStorage(); delete globalThis.window; }

test('outcome storage verifies, reloads and marks one current local revision',async()=>{
  reset();
  const record=await recordFor();
  const stored=await storeOutcomeRecord(record);
  assert.equal(stored.stored,true);
  const loaded=await loadOutcomeRecord(record.identity.outcomeId);
  assert.equal(loaded.identity.contentHash,record.identity.contentHash);
  const index=await loadOutcomeIndex();
  assert.equal(index.length,1);
  assert.equal(index[0].current,true);
  assert.equal(index[0].origin,OUTCOME_ORIGINS.LOCAL);
});

test('same official outcome is deduplicated without another stored revision',async()=>{
  reset();
  const record=await recordFor();
  await storeOutcomeRecord(record);
  const second=await storeOutcomeRecord(record);
  assert.equal(second.stored,false);
  assert.equal((await loadOutcomeIndex()).length,1);
});

test('new local revision supersedes the earlier current pointer without mutating it',async()=>{
  reset();
  const first=await recordFor(); await storeOutcomeRecord(first);
  const second=await recordFor(1,7,first); await storeOutcomeRecord(second);
  const index=await loadOutcomeIndex();
  assert.equal(index.filter(row=>row.current).length,1);
  assert.equal(currentLocalMetadata(index,1).outcomeId,second.identity.outcomeId);
  assert.equal((await loadOutcomeRecord(first.identity.outcomeId)).allPlayerOutcomes.records[0].totalPoints,6);
});

test('recovery imports remain non-current and cannot replace a local official outcome',async()=>{
  reset();
  const local=await recordFor(); await storeOutcomeRecord(local);
  const recovery=await recordFor(2,8); await storeOutcomeRecord(recovery,{origin:OUTCOME_ORIGINS.RECOVERY});
  const index=await loadOutcomeIndex();
  assert.equal(index.find(row=>row.outcomeId===recovery.identity.outcomeId).current,false);
  assert.equal(currentLocalMetadata(index,1).outcomeId,local.identity.outcomeId);
});

test('interrupted verified writes recover an orphan record through the journal',async()=>{
  reset();
  const record=await recordFor();
  await rawEvidenceSet(K_OUTCOME_PREFIX+record.identity.outcomeId,await encodeEvidenceRecord(record));
  await rawEvidenceSet(K_OUTCOME_JOURNAL,JSON.stringify({outcomeId:record.identity.outcomeId,contentHash:record.identity.contentHash,startedAt:new Date().toISOString()}));
  assert.equal((await loadOutcomeIndex()).length,0);
  await recoverOutcomeJournal();
  assert.equal((await loadOutcomeIndex())[0].outcomeId,record.identity.outcomeId);
  assert.equal(await rawEvidenceGet(K_OUTCOME_JOURNAL),null);
});

test('tampered stored records fail validation on reload',async()=>{
  reset();
  const record=await recordFor(); await storeOutcomeRecord(record);
  const raw=JSON.stringify({...record,gameweek:2});
  await rawEvidenceSet(K_OUTCOME_PREFIX+record.identity.outcomeId,raw);
  assert.equal(await loadOutcomeRecord(record.identity.outcomeId),null);
});

test('metadata remains bounded to fifty rows',()=>{
  const rows=Array.from({length:55},(_,i)=>({outcomeId:`outcome-2026-27-gw${(i%38)+1}-r${i+1}-${String(i).padStart(16,'0')}`,rootOutcomeId:'root',logicalKey:`2026-27|gw${(i%38)+1}`,contentHash:String(i).padStart(64,'a'),outcomeDataHash:String(i).padStart(64,'b'),season:'2026-27',gameweek:(i%38)+1,revision:i+1,status:'provisional',collectedAt:new Date(1000+i).toISOString(),finalisedAt:null,deadlineTime:new Date(0).toISOString(),relatedSnapshotStatus:'no_snapshot',relatedSnapshotId:null,origin:OUTCOME_ORIGINS.LOCAL,current:false,hasFullRecord:false,lastCheckedAt:new Date(1000+i).toISOString()}));
  assert.equal(normaliseOutcomeIndex(rows).length,OUTCOME_RULES.localIndexLimit);
});

test('quota failures are surfaced and do not claim a successful write',async()=>{
  reset();
  const record=await recordFor();
  globalThis.localStorage.fail=true;
  await assert.rejects(()=>storeOutcomeRecord(record),/quota/);
  assert.equal((await loadOutcomeIndex()).length,0);
});

test('provisional outcomes recheck after fifteen minutes while complete records use the correction cadence',()=>{
  const now=Date.parse('2026-09-01T12:00:00Z');
  const provisional={status:'provisional',lastCheckedAt:new Date(now-OUTCOME_RULES.provisionalRecheckMs).toISOString(),collectedAt:new Date(now).toISOString()};
  assert.equal(shouldCheckOutcome(provisional,now),true);
  const complete={status:'complete',lastCheckedAt:new Date(now-OUTCOME_RULES.correctionRecheckMs+1).toISOString(),collectedAt:new Date(now-1000).toISOString(),finalisedAt:new Date(now-1000).toISOString()};
  assert.equal(shouldCheckOutcome(complete,now),false);
});

test('delete removes outcome records but leaves shared deadline-evidence identity untouched',async()=>{
  reset();
  const record=await recordFor(); await storeOutcomeRecord(record);
  await rawEvidenceSet('fpl:evidence-manager-ref',managerRef);
  await clearOutcomeStorage();
  assert.deepEqual(await loadOutcomeIndex(),[]);
  assert.equal(await loadOutcomeRecord(record.identity.outcomeId),null);
  assert.equal(await rawEvidenceGet('fpl:evidence-manager-ref'),managerRef);
});
