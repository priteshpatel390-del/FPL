import test from 'node:test';
import assert from 'node:assert/strict';
import * as canonical from '../workers/data-platform/official-fpl-canonical.mjs';
import * as worker from '../workers/data-platform/official-fpl-history.mjs';

const FETCHED='2026-08-26T08:00:00.000Z';
const RUN_ID=`data-s2:2026-27:${FETCHED}`;
const REVISION={source_revision_id:'official-fpl-r1',source_key:'official-fpl',source_kind:'official_fpl',rights_classification:'durable_allowed',retention_allowed:1,shadow_ingest_allowed:1,attribution_required:0};

function world(players=626,fixtureCount=380){
  const events=Array.from({length:38},(_,i)=>({id:i+1,name:`Gameweek ${i+1}`,deadline_time:new Date(Date.UTC(2026,7,15+i*7,10)).toISOString()}));
  const teams=Array.from({length:20},(_,i)=>({id:i+1,name:`Team ${i+1}`,short_name:`T${String(i+1).padStart(2,'0')}`,strength:1000+i,strength_overall_home:1001+i,strength_overall_away:999+i,strength_attack_home:1002+i,strength_attack_away:998+i,strength_defence_home:1003+i,strength_defence_away:997+i}));
  const elements=Array.from({length:players},(_,i)=>({id:i+1,team:i%20+1,element_type:i%4+1,web_name:`Player ${i+1}`,now_cost:45+i%100,status:'a',chance_of_playing_next_round:null,chance_of_playing_this_round:null,news:'',news_added:null,selected_by_percent:String((i%500)/10)}));
  const fixtures=Array.from({length:fixtureCount},(_,i)=>{const team_h=i%20+1,team_a=(i+7)%20+1;return {id:i+1,event:i%38+1,kickoff_time:new Date(Date.UTC(2026,7,15+i,14)).toISOString(),team_h,team_a,team_h_difficulty:2+i%4,team_a_difficulty:2+(i+1)%4};});
  return {bootstrap:{events,teams,elements,element_types:[1,2,3,4].map(id=>({id}))},fixtures};
}

const normalise=value=>canonical.normaliseOfficialFplHistory({...value,season:'2026-27',fetchedAt:FETCHED});
const stored=rows=>rows.map(row=>({...row,value_boolean:row.value_type==='boolean'?Number(row.value_boolean):row.value_boolean}));

test('Worker adapter re-exports the one canonical implementation',()=>{
  for(const name of ['deriveOfficialFplSeason','normaliseOfficialFplHistory','diffOfficialFplHistory','materialiseOfficialFplChanges'])assert.equal(worker[name],canonical[name]);
  assert.equal(worker.DATA_S2_SOURCE_REVISION_ID,canonical.DATA_S2_SOURCE_REVISION_ID);
});

test('representative production shape remains exactly 9860 deterministically ordered facts',()=>{
  const first=normalise(world()),second=normalise(world());
  assert.deepEqual(first.counts,{events:38,teams:20,players:626,fixtures:380});
  assert.equal(first.candidates.length,9860);
  assert.deepEqual(second,first);
  assert.equal(new Set(first.candidates.map(row=>row.logical_key)).size,9860);
});

test('baseline, unchanged, scalar deltas, nulls and disappearance preserve exact fact semantics',()=>{
  const before=normalise(world());
  assert.deepEqual(canonical.diffOfficialFplHistory(before.candidates,[]),[...before.candidates].sort((a,b)=>a.logical_key.localeCompare(b.logical_key)));
  assert.deepEqual(canonical.diffOfficialFplHistory(before.candidates,stored(before.candidates)),[]);
  const changed=world();
  changed.bootstrap.elements[0].now_cost+=1;changed.bootstrap.elements[0].status='d';changed.bootstrap.elements[0].news='Injured';changed.bootstrap.elements[0].news_added='2026-08-26T07:30:00Z';
  changed.bootstrap.teams[0].strength+=1;changed.fixtures[0].kickoff_time=null;changed.fixtures[0].team_h_difficulty=null;changed.bootstrap.events[0].deadline_time='2026-08-15T11:00:00Z';
  changed.bootstrap.elements.pop();
  const delta=canonical.diffOfficialFplHistory(normalise(changed).candidates,stored(before.candidates));
  assert.deepEqual(delta.map(row=>row.logical_key),[...delta.map(row=>row.logical_key)].sort());
  for(const metric of ['now_cost','status','news','news_added'])assert.ok(delta.some(row=>row.subject_type==='player'&&row.metric===metric));
  for(const metric of ['kickoff_time','team_h_difficulty'])assert.equal(delta.find(row=>row.subject_type==='fixture'&&row.metric===metric).value_text,canonical.DATA_S2_NULL);
  assert.ok(delta.some(row=>row.subject_type==='event'&&row.metric==='deadline_time'));
  assert.ok(delta.some(row=>row.subject_type==='team'&&row.metric==='strength'));
  assert.ok(delta.some(row=>row.subject_entity_id.endsWith(':player:626')&&row.metric==='present'&&row.value_boolean===false));
});

test('strict validation rejects missing fields, invalid relationships and duplicate logical identities',()=>{
  let input=world();delete input.bootstrap.elements[0].status;assert.throws(()=>normalise(input),/player_status_missing/);
  input=world();input.bootstrap.elements[0].team=99;assert.throws(()=>normalise(input),/player_team_invalid/);
  input=world();input.fixtures[0].team_a=input.fixtures[0].team_h;assert.throws(()=>normalise(input),/fixture_team_invalid/);
  input=world();input.bootstrap.elements[1].id=input.bootstrap.elements[0].id;assert.throws(()=>normalise(input),/player_duplicate_id/);
});

test('boolean, number, text and unit variants retain their canonical slots',()=>{
  const rows=normalise(world()).candidates;
  const present=rows.find(row=>row.metric==='present'),price=rows.find(row=>row.metric==='now_cost'),name=rows.find(row=>row.metric==='web_name');
  assert.deepEqual([present.value_type,present.value_boolean,present.value_number,present.value_text],['boolean',true,null,null]);
  assert.deepEqual([price.value_type,price.unit,price.value_text],['number','tenths_gbp',null]);
  assert.deepEqual([name.value_type,name.value_number,name.value_boolean],['text',null,null]);
});

test('observation material and SHA-256 IDs are byte-stable regression goldens',async()=>{
  const facts=normalise(world()).candidates;
  const options={runId:RUN_ID,sourceRevision:REVISION,fetchedAt:FETCHED};
  const first=await canonical.materialiseOfficialFplChanges([facts[0],facts.at(-1)],options);
  const second=await canonical.materialiseOfficialFplChanges([facts[0],facts.at(-1)],options);
  assert.deepEqual(second,first);
  assert.deepEqual(first.map(row=>row.observation_id),['697a1fef3c8c6c478f24db7bdff7d79d9a09fb8b58cbf893ffc0090c4ecba0dd','dde266c5fe6ed5bad698e7202470e92a2e1622136aaa691734f77373dc0d0881']);
  assert.equal(JSON.stringify(first),JSON.stringify(second));
});

test('bounded write guard remains in the canonical contract',async()=>{
  await assert.rejects(canonical.materialiseOfficialFplChanges(Array.from({length:canonical.MAX_CHANGED_OBSERVATIONS_PER_RUN+1},()=>({})),{runId:RUN_ID,sourceRevision:REVISION,fetchedAt:FETCHED}),/write_budget_exceeded/);
});
