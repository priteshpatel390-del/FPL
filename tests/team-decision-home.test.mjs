import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TEAM_DECISION_HOME_VERSION,
  TEAM_RESOURCES_BENCH_CLARITY_VERSION,
  TEAM_DECISION_BENCH_LABELS,
  teamDecisionForecast,
  teamDecisionSquadReady,
  teamDecisionSourceLabel,
  teamDecisionRisk,
  teamDecisionAction,
  teamDecisionCloseCaptainCopy,
  teamDecisionBenchLabel
} from '../src/ui/team-decision-home.mjs';
import { HEALTH_STATES } from '../src/providers/registry.mjs';

const player=(id,pos,status='a',chance=100,xp=5)=>({p:{id,element_type:pos,status,chance_of_playing_next_round:chance,web_name:`P${id}`},xp});
const legalSquad=()=>[
  player(1,1),player(2,1),
  ...Array.from({length:5},(_,i)=>player(10+i,2)),
  ...Array.from({length:5},(_,i)=>player(20+i,3)),
  ...Array.from({length:3},(_,i)=>player(30+i,4))
];

test('Team decision home is versioned as the approved checkpoint',()=>{
  assert.equal(TEAM_DECISION_HOME_VERSION,'2.0.2');
  assert.equal(TEAM_RESOURCES_BENCH_CLARITY_VERSION,'UX-A1');
});

test('forecast keeps starting-XI points and captain uplift explicit',()=>{
  assert.deepEqual(teamDecisionForecast(54.2,7.4),{base:54.2,uplift:7.4,total:61.6});
});

test('only a complete legal FPL squad can produce the decision home',()=>{
  assert.equal(teamDecisionSquadReady(legalSquad()),true);
  assert.equal(teamDecisionSquadReady(legalSquad().slice(0,14)),false);
  const illegal=legalSquad(); illegal[14]=player(99,3);
  assert.equal(teamDecisionSquadReady(illegal),false);
});

test('bench labels distinguish the reserve goalkeeper from ordered outfield substitutes',()=>{
  assert.deepEqual(TEAM_DECISION_BENCH_LABELS,['GK','1st','2nd','3rd']);
  assert.deepEqual(Array.from({length:4},(_,index)=>teamDecisionBenchLabel(index)),['GK','1st','2nd','3rd']);
});

test('source wording separates Official FPL, manual and verified fallback states',()=>{
  assert.equal(teamDecisionSourceLabel({manual:true,hasPicks:true,fplState:HEALTH_STATES.LIVE}),'User-entered squad');
  assert.equal(teamDecisionSourceLabel({hasPicks:true,fplState:HEALTH_STATES.LIVE}),'Official FPL public picks');
  assert.match(teamDecisionSourceLabel({hasPicks:true,fplState:HEALTH_STATES.FALLBACK,cachedAt:1_700_000_000_000}),/Official FPL public picks · verified fallback/);
});

test('risk priority protects data integrity, captaincy and selected starters in that order',()=>{
  assert.equal(teamDecisionRisk({dataState:HEALTH_STATES.UNAVAILABLE}).kind,'data-unavailable');
  assert.equal(teamDecisionRisk({dataState:HEALTH_STATES.FALLBACK}).kind,'data-stale');
  const starters=[player(1,3,'i',0,8),player(2,3,'d',50,9),player(3,3,'a',100,7)];
  assert.equal(teamDecisionRisk({dataState:HEALTH_STATES.LIVE,captain:{id:1},starters}).kind,'captain-unavailable');
  assert.equal(teamDecisionRisk({dataState:HEALTH_STATES.LIVE,captain:{id:3},starters}).kind,'starter-unavailable');
});

test('close captaincy is uncertainty context, not protect or chase strategy',()=>{
  const risk=teamDecisionRisk({dataState:HEALTH_STATES.LIVE,starters:[player(1,3),player(2,3)],closeCaptain:{firstName:'A',secondName:'B',gap:0.4}});
  assert.equal(risk.kind,'close-captaincy');
  const copy=teamDecisionCloseCaptainCopy('A','B',0.4);
  assert.match(copy,/close model call/);
  assert.doesNotMatch(copy,/protects your rank|rank-climbing play/);
});

test('clear Team state does not pretend the transfer optimiser has recommended a roll',()=>{
  const risk=teamDecisionRisk({dataState:HEALTH_STATES.LIVE,starters:[player(1,3)],captain:{id:1}});
  assert.equal(risk.kind,'none');
  assert.doesNotMatch(risk.text,/transfer|roll/i);
  const action=teamDecisionAction({hasSquad:true,riskKind:risk.kind});
  assert.match(action,/Use Transfers for the separate roll-or-transfer decision/);
});

test('deadline actions remain advisory and distinguish user previews',()=>{
  assert.match(teamDecisionAction({hasSquad:true,previewActive:true}),/user preview/);
  assert.match(teamDecisionAction({hasSquad:true,deadlinePassed:true}),/deadline has passed/);
  assert.match(teamDecisionAction({hasSquad:false,riskKind:'data-unavailable'}),/Manual squad editing also needs the verified player list/);
  assert.doesNotMatch(teamDecisionAction({hasSquad:false,riskKind:'data-unavailable'}),/complete a legal manual|build your 15/i);
  assert.doesNotMatch(teamDecisionAction({hasSquad:true}),/submitted|changed your FPL/i);
});

test('production wiring wraps the verified renderer without changing model modules or routes',()=>{
  const source=readFileSync(new URL('../src/ui/team-decision-home.mjs',import.meta.url),'utf8');
  const build=readFileSync(new URL('../build.mjs',import.meta.url),'utf8');
  const app=readFileSync(new URL('../app.html',import.meta.url),'utf8');
  const bundle=readFileSync(new URL('../dist/app.bundle.js',import.meta.url),'utf8');
  assert.match(source,/const legacyRenderSquad=renderSquad/);
  assert.match(source,/legacyRenderSquad\(\)/);
  assert.match(source,/teamDecisionPlaceholderStage/);
  assert.match(source,/Open Transfers/);
  assert.match(source,/User-entered squad|Official FPL public picks/);
  assert.match(build,/src\/ui\/team-decision-home\.mjs/);
  assert.match(app,/Teamsheet 2\.0\.2 — pitch-first Team decision home/);
  assert.match(source,/sub\.textContent='Loading your team'/);
  assert.doesNotMatch(source,/Preparing your decision home/);
  assert.match(source,/manualToggle\.disabled=!available/);
  assert.match(source,/Manual squad editing is unavailable until verified Official FPL player data loads/);
  assert.match(source,/teamDecisionRelabelBench\(stage\)/);
  assert.match(bundle,/\['GK','1st','2nd','3rd'\]/);
  assert.doesNotMatch(app,/Load your team ID above|build your 15 by hand below/);
  assert.doesNotMatch(source,/optimiseTransfers\(|simulatePlayerGameweek\(|localStorage|sessionStorage|sset\(/);
});
