import test from 'node:test';
import assert from 'node:assert/strict';

const input = {value:'',checked:false,options:{length:9},add(){},textContent:'',classList:{toggle(){},add(){},remove(){}}};
globalThis.document = {
  getElementById(){ return input; },
  querySelector(){ return null; },
  querySelectorAll(){ return []; },
  addEventListener(){},
  createElement(){ return {}; },
  body:{classList:{toggle(){},add(){},remove(){}},setAttribute(){}}
};
globalThis.window = {addEventListener(){}};
globalThis.localStorage = {getItem(){return null;},setItem(){},removeItem(){}};

const state = await import('../src/state.mjs');
const fixtures = await import('../src/model/fixtures.mjs');
const scoring = await import('../src/model/scoring.mjs');
const main = await import('../src/main.mjs');
const teamHome = await import('../src/ui/team-decision-home.mjs');
const {S,hydrate} = state;

function preSeasonWorld(){
  return {
    at:Date.now(),
    events:[{id:1,is_current:false,is_next:true,finished:false,deadline_time:'2026-08-21T17:30:00Z'}],
    teams:[
      {id:1,name:'Alpha',short_name:'ALP',strength_attack_home:null,strength_attack_away:null,strength_defence_home:null,strength_defence_away:null},
      {id:2,name:'Beta',short_name:'BET',strength_attack_home:null,strength_attack_away:null,strength_defence_home:null,strength_defence_away:null}
    ],
    element_types:[{id:1,singular_name_short:'GKP',singular_name:'Goalkeeper'}],
    elements:[{id:10,web_name:'Keeper',team:1,element_type:1,now_cost:45,selected_by_percent:'5',status:'a'}],
    fixtures:[{id:1,event:1,team_h:1,team_a:2,team_h_difficulty:2,team_a_difficulty:4,kickoff_time:'2026-08-21T19:00:00Z'}]
  };
}

test('pre-season public picks use the next Gameweek and never invent one', () => {
  const events=[{id:1,is_next:true},{id:2,is_next:false}];
  assert.equal(main.publicPicksGameweek(events,0),1);
  assert.equal(main.publicPicksGameweek(events,5),5);
  assert.equal(main.publicPicksGameweek([{id:0,is_next:true}],0),0);
  assert.equal(main.publicPicksGameweek([],0),0);
});

test('missing team strengths are reported and disable the strength layer', () => {
  const result=hydrate(preSeasonWorld());
  assert.equal(result.ok,true);
  assert.equal(S.strengthsAvailable,false);
  assert.ok(result.issues.some(issue=>issue.code==='team_strengths_unavailable'));
});

test('fixture fallback remains finite and uses Official FPL difficulty', () => {
  hydrate(preSeasonWorld());
  const game=fixtures.teamFixtures(1,1,1)[0][0];
  assert.equal(game.ctx.strengthAvailable,false);
  assert.equal(game.ctx.atk,1);
  assert.equal(game.ctx.def,1);
  assert.equal(fixtures.fixtureDifficulty(game,'attack'),2);
  assert.equal(fixtures.fixtureDifficulty(game,'defence'),2);
  assert.equal(fixtures.fixtureAnalysisMode(),'official-fpl-difficulty');
  assert.deepEqual(fixtures.fixtureLensState('attack'),{lens:'official',fallback:true,lowerIsEasier:true});
  assert.equal(fixtures.runScore(1,1,1,'attack'),2);
  assert.equal(fixtures.multToDiff(Number.NaN),3);
});

test('overall fallback displays the direct average FDR and sorts lower as easier', () => {
  const world=preSeasonWorld();
  world.events=Array.from({length:6},(_,index)=>({id:index+1,is_current:false,is_next:index===0,finished:false}));
  const difficulties=[3,3,4,3,2,2];
  world.fixtures=difficulties.map((difficulty,index)=>({
    id:index+1,event:index+1,team_h:1,team_a:2,
    team_h_difficulty:difficulty,team_a_difficulty:6-difficulty
  }));
  hydrate(world);
  assert.equal(fixtures.averageOfficialDifficulty(1,1,6),17/6);
  assert.equal(fixtures.runScore(1,1,6,'defence'),17/6);
  assert.ok(fixtures.compareFixtureRunScores(2.83,3.17,'ease','official')<0);
  assert.ok(fixtures.compareFixtureRunScores(2.83,3.17,'hard','official')>0);
});

test('pre-season player projection uses a neutral finite fixture multiplier', () => {
  hydrate(preSeasonWorld());
  const result=scoring.projectXP(S.byId[10],1,1);
  assert.equal(Number.isFinite(result.total),true);
  assert.equal(Number.isFinite(result.perGW),true);
  assert.ok(result.total>0);
});

test('valid strength data keeps the established match-context result contract', () => {
  const world=preSeasonWorld();
  for(const [index,team] of world.teams.entries()){
    team.strength_attack_home=1200-index*100;
    team.strength_attack_away=1150-index*100;
    team.strength_defence_home=1100+index*100;
    team.strength_defence_away=1120+index*100;
  }
  hydrate(world);
  const game=fixtures.teamFixtures(1,1,1)[0][0];
  assert.equal(S.strengthsAvailable,true);
  assert.deepEqual(Object.keys(game.ctx).sort(),['atk','cs','def','home','xGA','xGF'].sort());
  assert.equal(Number.isFinite(game.ctx.atk),true);
  assert.equal(Number.isFinite(game.ctx.def),true);
  assert.equal(fixtures.fixtureDifficulty(game,'attack'),fixtures.multToDiff(game.ctx.atk));
  assert.equal(fixtures.fixtureAnalysisMode(),'team-strengths');
});

test('unavailable public pre-season squad copy is explicit and manual-safe', () => {
  const action=teamHome.teamDecisionAction({hasSquad:false,squadStatus:'unavailable',squadGameweek:1});
  assert.match(action,/Load data/);
  assert.match(action,/manually/);
  const source=teamHome.teamDecisionSourceLabel({hasPicks:true,picksGameweek:1});
  assert.match(source,/locked GW1/);
});
