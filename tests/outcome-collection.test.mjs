import test from 'node:test';
import assert from 'node:assert/strict';
import { S } from '../src/state.mjs';
import {
  validateOutcomeFixtures, validateOutcomeLive, validateOutcomePicks, validateOutcomeHistory
} from '../src/providers/outcome-validate.mjs';
import {
  OUTCOME_SCHEMA_VERSION, OUTCOME_STATUSES, collectOutcomePayload, finaliseOutcomeRecord,
  validateOutcomeRecord, buildSquadOutcome, dueOutcomeGameweeks
} from '../src/evidence/outcome.mjs';

const managerRef='mgr-0123456789abcdef0123456789abcdef';
const event=(overrides={})=>({id:1,deadline_time:'2026-08-21T17:30:00.000Z',finished:true,data_checked:true,...overrides});
const fixture=(overrides={})=>({id:10,code:100,event:1,team_h:1,team_a:2,kickoff_time:'2026-08-22T14:00:00.000Z',started:true,finished:true,finished_provisional:true,team_h_score:1,team_a_score:0,minutes:90,provisional_start_time:false,stats:[],...overrides});
const player=(id=1,overrides={})=>({id,stats:{total_points:6,minutes:90,starts:1,goals_scored:0,assists:0,clean_sheets:1,goals_conceded:0,saves:0,bonus:0,bps:20,yellow_cards:0,red_cards:0,own_goals:0,penalties_missed:0,penalties_saved:0,defensive_contribution:0,...overrides.stats},explain:overrides.explain??[{fixture:10,stats:[{identifier:'total_points',points:6,value:6}]}]});
function setup(count=2){
  S.boot={events:[event()],elements:Array.from({length:count},(_,i)=>({id:i+1})),teams:[],element_types:[]};
  S.teamId=''; S.retryStats={};
}

setup();

test('Stage 10.2 fixture validator preserves genuine doubles and exact fixture identity',()=>{
  const result=validateOutcomeFixtures([fixture(),fixture({id:11,kickoff_time:'2026-08-25T19:00:00.000Z'})],1);
  assert.equal(result.value.records.length,2);
  assert.deepEqual(result.value.records.map(row=>row.fixtureId),[10,11]);
});

test('Stage 10.2 conflicting duplicate fixtures fail closed',()=>{
  const result=validateOutcomeFixtures([fixture(),fixture({team_a:3})],1);
  assert.equal(result.value,null);
  assert.ok(result.issues.some(row=>row.code==='outcome_fixture_conflicting_duplicate'&&row.severity==='fatal'));
});

test('Stage 10.2 duplicate players are quarantined rather than first-wins',()=>{
  const result=validateOutcomeLive({elements:[player(1),player(1)]},[10]);
  assert.equal(result.value,null);
  assert.ok(result.issues.some(row=>row.code==='outcome_live_duplicate_player'));
});

test('official starts remain null when the live endpoint does not provide them',()=>{
  const row=player(1); delete row.stats.starts;
  const result=validateOutcomeLive({elements:[row]},[10]);
  assert.equal(result.value.records[0].starts,null);
  assert.equal(result.value.records[0].appeared,true);
  assert.equal(result.value.records[0].reachedSixty,true);
});

test('manager validators retain only factual picks, auto-subs and Gameweek summaries',()=>{
  const picks=validateOutcomePicks({active_chip:null,picks:[{element:1,position:1,multiplier:2,is_captain:true,is_vice_captain:false},{element:2,position:12,multiplier:0,is_captain:false,is_vice_captain:true}],automatic_subs:[{element_in:2,element_out:1}],entry_history:{event:1,points:12,total_points:12,event_transfers:1,event_transfers_cost:0,points_on_bench:3}},1);
  const history=validateOutcomeHistory({current:[{event:1,points:12,total_points:12,event_transfers:1,event_transfers_cost:0,points_on_bench:3}],chips:[]});
  assert.equal(picks.value.picks[0].multiplier,2);
  assert.deepEqual(picks.value.automaticSubstitutions,[{playerIn:2,playerOut:1}]);
  assert.equal(history.value.current[0].points,12);
});

test('complete outcome requires all fixtures, event finished and data_checked',async()=>{
  setup(2);
  const result=await collectOutcomePayload({managerRef,gameweek:1,event:event(),fixturesPayload:[fixture()],livePayload:{elements:[player(1),player(2,{stats:{total_points:0},explain:[]})]},startedAt:1,completedAt:2});
  assert.equal(result.ok,true);
  assert.equal(result.payload.status,OUTCOME_STATUSES.COMPLETE);
  assert.equal(result.payload.completeness.complete,true);
});

test('finished alone is insufficient while official data checking is delayed',async()=>{
  setup(1);
  const result=await collectOutcomePayload({managerRef,gameweek:1,event:event({data_checked:false}),fixturesPayload:[fixture()],livePayload:{elements:[player(1)]},startedAt:1,completedAt:2});
  assert.equal(result.payload.status,OUTCOME_STATUSES.PROVISIONAL);
  assert.equal(result.payload.officialDeadlineIdentity.dataChecked,false);
});

test('postponed or unfinished fixtures keep the Gameweek provisional',async()=>{
  setup(1);
  const result=await collectOutcomePayload({managerRef,gameweek:1,event:event(),fixturesPayload:[fixture({finished:false,finished_provisional:false,team_h_score:null,team_a_score:null,minutes:0})],livePayload:{elements:[player(1,{stats:{total_points:0,minutes:0,starts:0},explain:[]})]},startedAt:1,completedAt:2});
  assert.equal(result.payload.status,'provisional');
  assert.equal(result.payload.completeness.finishedFixtureCount,0);
});

test('blank Gameweeks can complete without manufacturing fixtures',async()=>{
  setup(1);
  const result=await collectOutcomePayload({managerRef,gameweek:1,event:event(),fixturesPayload:[],livePayload:{elements:[player(1,{stats:{total_points:0,minutes:0,starts:0},explain:[]})]},startedAt:1,completedAt:2});
  assert.equal(result.payload.status,'complete');
  assert.equal(result.payload.fixtureOutcomes.records.length,0);
});

test('double Gameweek player detail must reconcile with aggregate points',async()=>{
  setup(1);
  const live=player(1,{stats:{total_points:9},explain:[{fixture:10,stats:[{identifier:'total_points',points:4,value:4}]},{fixture:11,stats:[{identifier:'total_points',points:5,value:5}]}]});
  const result=await collectOutcomePayload({managerRef,gameweek:1,event:event(),fixturesPayload:[fixture(),fixture({id:11})],livePayload:{elements:[live]},startedAt:1,completedAt:2});
  assert.equal(result.payload.status,'complete');
  assert.equal(result.payload.allPlayerOutcomes.records[0].perFixture.length,2);
});

test('unreconciled per-fixture points keep a record provisional',async()=>{
  setup(1);
  const live=player(1,{stats:{total_points:9},explain:[{fixture:10,stats:[{identifier:'total_points',points:4,value:4}]}]});
  const result=await collectOutcomePayload({managerRef,gameweek:1,event:event(),fixturesPayload:[fixture()],livePayload:{elements:[live]},startedAt:1,completedAt:2});
  assert.equal(result.payload.status,'provisional');
  assert.ok(result.payload.validation.issues.some(row=>row.code==='outcome_player_points_explain_mismatch'));
});

test('squad outcome applies official multipliers without changing the frozen decision record',()=>{
  const squad=buildSquadOutcome({activeChip:null,picks:[{playerId:1,position:1,multiplier:2,isCaptain:true,isViceCaptain:false},{playerId:2,position:12,multiplier:0,isCaptain:false,isViceCaptain:true}],automaticSubstitutions:[],entryHistory:{points:12,totalPoints:12,eventTransferCount:0,eventTransferCost:0,pointsOnBench:3}},null,1,[{playerId:1,totalPoints:6},{playerId:2,totalPoints:3}]);
  assert.equal(squad.captain.realisedContribution,12);
  assert.equal(squad.reconstruction.pickMultiplierTotal,12);
  assert.equal(squad.reconstruction.agreement,'agrees');
});

test('provisional-to-complete and complete-to-corrected transitions append immutable revisions',async()=>{
  setup(1);
  const provisional=(await collectOutcomePayload({managerRef,gameweek:1,event:event({data_checked:false}),fixturesPayload:[fixture()],livePayload:{elements:[player(1)]},startedAt:1,completedAt:2})).payload;
  const first=(await finaliseOutcomeRecord(provisional)).record;
  const complete=(await collectOutcomePayload({managerRef,gameweek:1,event:event(),fixturesPayload:[fixture()],livePayload:{elements:[player(1)]},startedAt:3,completedAt:4})).payload;
  const second=(await finaliseOutcomeRecord(complete,{previousRecord:first})).record;
  assert.equal(first.status,'provisional');
  assert.equal(second.status,'complete');
  assert.equal(second.identity.revision,2);
  const correctedPayload=(await collectOutcomePayload({managerRef,gameweek:1,event:event(),fixturesPayload:[fixture()],livePayload:{elements:[player(1,{stats:{total_points:7},explain:[{fixture:10,stats:[{identifier:'total_points',points:7,value:7}]}]})]},startedAt:5,completedAt:6})).payload;
  const third=(await finaliseOutcomeRecord(correctedPayload,{previousRecord:second})).record;
  assert.equal(third.status,'corrected');
  assert.equal(third.identity.supersedesOutcomeId,second.identity.outcomeId);
  assert.equal(first.allPlayerOutcomes.records[0].totalPoints,6);
});

test('identical official facts do not create a duplicate revision',async()=>{
  setup(1);
  const payload=(await collectOutcomePayload({managerRef,gameweek:1,event:event(),fixturesPayload:[fixture()],livePayload:{elements:[player(1)]},startedAt:1,completedAt:2})).payload;
  const first=(await finaliseOutcomeRecord(payload)).record;
  const duplicate={...payload,collection:{...payload.collection,startedAt:new Date(3).toISOString(),completedAt:new Date(4).toISOString()}};
  const result=await finaliseOutcomeRecord(duplicate,{previousRecord:first});
  assert.equal(result.unchanged,true);
  assert.equal(result.record.identity.outcomeId,first.identity.outcomeId);
});

test('outcome records are deterministic, immutable and tamper-evident',async()=>{
  setup(1);
  const payload=(await collectOutcomePayload({managerRef,gameweek:1,event:event(),fixturesPayload:[fixture()],livePayload:{elements:[player(1)]},startedAt:1,completedAt:2})).payload;
  const record=(await finaliseOutcomeRecord(payload)).record;
  assert.equal(record.schemaVersion,OUTCOME_SCHEMA_VERSION);
  assert.ok(Object.isFrozen(record));
  assert.equal((await validateOutcomeRecord(record)).ok,true);
  const tampered=JSON.parse(JSON.stringify(record)); tampered.allPlayerOutcomes.records[0].totalPoints=99;
  assert.equal((await validateOutcomeRecord(tampered)).reason,'section_hash');
});

test('records exclude Team ID, manager names, leagues, configuration and secrets',async()=>{
  setup(1); S.teamId='1234567';
  const first=(await collectOutcomePayload({managerRef,gameweek:1,event:event(),fixturesPayload:[fixture()],livePayload:{elements:[player(1)]},startedAt:1,completedAt:2})).payload;
  S.teamId='7654321';
  const second=(await collectOutcomePayload({managerRef,gameweek:1,event:event(),fixturesPayload:[fixture()],livePayload:{elements:[player(1)]},startedAt:1,completedAt:2})).payload;
  assert.deepEqual(second,first);
  assert.equal(/teamId|entryId|managerName|leagueId|oddsKey|apiKey/.test(JSON.stringify(first)),false);
});


test('due Gameweeks are selected only after their official deadlines',()=>{
  const events=[{id:1,deadline_time:'2026-08-01T10:00:00Z'},{id:2,deadline_time:'2026-08-08T10:00:00Z'}];
  assert.deepEqual(dueOutcomeGameweeks(events,Date.parse('2026-08-05T10:00:00Z')),[1]);
});
