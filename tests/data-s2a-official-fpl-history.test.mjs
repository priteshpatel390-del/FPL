import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DATA_S2_NULL,DATA_S2_SOURCE_REVISION_ID,MAX_CHANGED_OBSERVATIONS_PER_RUN,MAX_FINAL_BATCH_STATEMENTS,
  buildOfficialFplCommitPlan,diffOfficialFplHistory,materialiseOfficialFplChanges,normaliseOfficialFplHistory
} from '../workers/data-platform/official-fpl-history.mjs';

const FETCHED='2026-08-26T08:00:00.000Z';
const SEASON='2026-27';
const revision={
  source_revision_id:DATA_S2_SOURCE_REVISION_ID,source_key:'official-fpl',source_kind:'official_fpl',
  rights_classification:'durable_allowed',retention_allowed:1,shadow_ingest_allowed:1,attribution_required:0
};

function syntheticOfficialFpl(){
  const events=Array.from({length:38},(_,i)=>({id:i+1,name:`Gameweek ${i+1}`,deadline_time:new Date(Date.UTC(2026,7,15+i*7,10)).toISOString()}));
  const teams=Array.from({length:20},(_,i)=>({
    id:i+1,name:`Team ${i+1}`,short_name:`T${String(i+1).padStart(2,'0')}`,
    strength:1000+i,strength_overall_home:1001+i,strength_overall_away:999+i,
    strength_attack_home:1002+i,strength_attack_away:998+i,strength_defence_home:1003+i,strength_defence_away:997+i
  }));
  const element_types=[1,2,3,4].map(id=>({id}));
  const elements=Array.from({length:401},(_,i)=>({
    id:i+1,team:i%20+1,element_type:i%4+1,web_name:`Player ${i+1}`,now_cost:45+i%100,status:'a',
    chance_of_playing_next_round:null,chance_of_playing_this_round:null,news:'',news_added:null,
    selected_by_percent:String((i%500)/10)
  }));
  const fixtures=Array.from({length:300},(_,i)=>{
    const home=i%20+1;const away=(i+7)%20+1;
    return {id:i+1,event:i%38+1,kickoff_time:new Date(Date.UTC(2026,7,15+i,14)).toISOString(),team_h:home,team_a:away,team_h_difficulty:2+i%4,team_a_difficulty:2+(i+1)%4};
  });
  return {bootstrap:{events,teams,elements,element_types},fixtures};
}

function normalised(world=syntheticOfficialFpl(),fetchedAt=FETCHED){return normaliseOfficialFplHistory({...world,season:SEASON,fetchedAt});}
function asStored(rows){return rows.map(row=>({...row,value_boolean:row.value_type==='boolean'?Number(row.value_boolean):row.value_boolean}));}

test('DATA-S2A normalises only the allowlisted Official FPL core with canonical identities',()=>{
  const result=normalised();
  assert.deepEqual(result.counts,{events:38,teams:20,players:401,fixtures:300});
  assert.equal(result.candidates.length,6825);
  assert.equal(new Set(result.candidates.map(row=>row.logical_key)).size,result.candidates.length);
  assert.ok(result.entities.some(row=>row.canonical_entity_id==='2026-27:fpl:player:1'));
  assert.ok(result.entities.some(row=>row.canonical_entity_id==='2026-27:fpl:fixture:1'));
  assert.ok(result.entities.some(row=>row.canonical_entity_id==='2026-27:fpl:event:1'));
  assert.equal(result.candidates.some(row=>/points|minutes|captain|transfer|league|manager/i.test(row.metric)),false);
});

test('explicit Official FPL nulls are preserved and missing required fields fail closed',()=>{
  let world=syntheticOfficialFpl();
  world.fixtures[0].event=null;world.fixtures[0].kickoff_time=null;
  const result=normalised(world);
  const fixtureRows=result.candidates.filter(row=>row.subject_entity_id==='2026-27:fpl:fixture:1');
  assert.equal(fixtureRows.find(row=>row.metric==='event').value_text,DATA_S2_NULL);
  assert.equal(fixtureRows.find(row=>row.metric==='kickoff_time').value_text,DATA_S2_NULL);
  world=syntheticOfficialFpl();delete world.fixtures[0].event;
  assert.throws(()=>normalised(world),/fixture_event_missing/);
  world=syntheticOfficialFpl();delete world.bootstrap.elements[0].team;
  assert.throws(()=>normalised(world),/player_team_missing/);
});

test('identical scheduled state creates zero historical changes',()=>{
  const result=normalised();
  assert.deepEqual(diffOfficialFplHistory(result.candidates,asStored(result.candidates)),[]);
});

test('only the changed player fact is appended rather than rewriting the player snapshot',()=>{
  const before=normalised();
  const world=syntheticOfficialFpl();world.bootstrap.elements[0].selected_by_percent='7.7';
  const after=normalised(world,'2026-08-26T09:00:00.000Z');
  const changes=diffOfficialFplHistory(after.candidates,asStored(before.candidates));
  assert.equal(changes.length,1);
  assert.equal(changes[0].logical_key,'official-fpl|2026-27|player|1|selected_by_percent');
  assert.equal(changes[0].value_number,7.7);
});

test('player club reassignment and fixture rescheduling are represented as precise changes',()=>{
  const before=normalised();
  const world=syntheticOfficialFpl();
  world.bootstrap.elements[0].team=2;
  world.fixtures[0].event=null;
  world.fixtures[0].kickoff_time=null;
  const after=normalised(world,'2026-08-26T09:00:00.000Z');
  const changes=diffOfficialFplHistory(after.candidates,asStored(before.candidates));
  const keys=changes.map(row=>row.logical_key);
  assert.deepEqual(keys,[
    'official-fpl|2026-27|fixture|1|event',
    'official-fpl|2026-27|fixture|1|kickoff_time',
    'official-fpl|2026-27|player|1|team'
  ]);
  assert.equal(changes.find(row=>row.metric==='event').value_text,DATA_S2_NULL);
});

test('disappearing canonical entities append only a present=false lifecycle observation',()=>{
  const before=normalised();
  const world=syntheticOfficialFpl();world.bootstrap.elements=world.bootstrap.elements.filter(row=>row.id!==1);
  const after=normalised(world,'2026-08-26T09:00:00.000Z');
  const changes=diffOfficialFplHistory(after.candidates,asStored(before.candidates));
  const player1=changes.filter(row=>row.subject_entity_id==='2026-27:fpl:player:1');
  assert.equal(player1.length,1);
  assert.equal(player1[0].metric,'present');
  assert.equal(player1[0].value_boolean,false);
});

test('materialised change observations retain append-only run identity and deterministic validation',async()=>{
  const before=normalised();const world=syntheticOfficialFpl();world.bootstrap.elements[0].now_cost+=1;
  const after=normalised(world,'2026-08-26T09:00:00.000Z');
  const changes=diffOfficialFplHistory(after.candidates,asStored(before.candidates));
  const rows=await materialiseOfficialFplChanges(changes,{runId:'data-s2:test',sourceRevision:revision,fetchedAt:'2026-08-26T09:00:00.000Z'});
  assert.equal(rows.length,1);assert.match(rows[0].observation_id,/^[0-9a-f]{64}$/);
  assert.equal(rows[0].ingestion_run_id,'data-s2:test');assert.equal(rows[0].mode,'shadow_only');
  assert.equal(rows[0].input_revision,'data-s2:test');
});

test('write budget rejects implausible deltas before hashing or storage',async()=>{
  const changes=Array.from({length:MAX_CHANGED_OBSERVATIONS_PER_RUN+1},()=>({}));
  await assert.rejects(materialiseOfficialFplChanges(changes,{runId:'x',sourceRevision:revision,fetchedAt:FETCHED}),/write_budget_exceeded/);
});

test('bulk JSON commit plan stays below the Free Worker D1 query budget even for a full baseline',()=>{
  const observations=Array.from({length:12000},(_,i)=>({logical_key:`k${i}`,observation_id:String(i).padStart(64,'0')}));
  const entities=Array.from({length:1200},(_,i)=>({canonical_entity_id:`e${i}`,entity_type:'player',season:SEASON,canonical_system:'fpl',canonical_external_id:String(i),created_at:FETCHED}));
  const plan=buildOfficialFplCommitPlan({entities,previousRows:[],observations,completedAt:FETCHED,recordsSeen:12000,runId:'run',sourceRevisionId:DATA_S2_SOURCE_REVISION_ID});
  assert.ok(plan.length<=MAX_FINAL_BATCH_STATEMENTS);
  assert.ok(plan.length<40);
  assert.ok(plan.some(row=>/json_each\(\?\)/.test(row.sql)));
  assert.ok(plan.at(-1).sql.includes("status='completed'"));
});

test('repository candidate declares one half-hour schedule check and no credential or application data dependency',()=>{
  const config=fs.readFileSync('workers/data-platform/wrangler.jsonc','utf8');
  assert.match(config,/"crons"\s*:\s*\["\*\/30 \* \* \* \*"\]/);
  assert.match(config,/"DATA_S2_SEASON"\s*:\s*"2026-27"/);
  assert.doesNotMatch(config,/token|secret|password|api[_-]?key/i);
  const appFiles=['src/main.mjs','src/state.mjs','src/model/fixtures.mjs','src/model/scoring.mjs','src/model/transfers.mjs'];
  for(const path of appFiles)assert.doesNotMatch(fs.readFileSync(path,'utf8'),/official-fpl-history|DATA_S2_SOURCE_REVISION_ID|TEAMSHEET_DATA_DB/);
});

test('Official FPL source governance is durable internal shadow history with redistribution disabled',()=>{
  const migration=fs.readFileSync('workers/data-platform/migrations/0002_official_fpl_structured_history.sql','utf8');
  assert.match(migration,/official-fpl-r1/);assert.match(migration,/'durable_allowed',\s*1,\s*0,/);
  assert.match(migration,/approved_internal_shadow_history/);
  assert.doesNotMatch(migration,/redistribution_allowed[^\n]*1/);
});

test('scheduled wiring uses the existing D1-bound Worker directly and does not revive RPC as collection transport',()=>{
  const entry=fs.readFileSync('workers/data-platform/data-platform-rpc.mjs','utf8');
  const collector=fs.readFileSync('workers/data-platform/official-fpl-history.mjs','utf8');
  assert.match(entry,/scheduledOfficialFplHistory/);assert.match(entry,/scheduled/);
  assert.match(collector,/TEAMSHEET_DATA_DB/);assert.match(collector,/db\.batch\(statements\)/);
  assert.doesNotMatch(collector,/DATA_S1_HTTP_AUTH_TOKEN|Service Binding|DataPlatformReadEntrypoint|DataPlatformIngestEntrypoint/);
  assert.doesNotMatch(collector,/console\./);
});
