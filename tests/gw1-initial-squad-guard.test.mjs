// GW1 readiness — pre-deadline Transfers safety guard.
//
// Official FPL allows unlimited changes to the initial squad until the first deadline of a
// season. Free transfers, transfer costs and points hits do not exist in that window, so the
// ordinary weekly Transfers optimiser must not run or present a ranked plan there. These tests
// pin the derivation rule, its boundaries, its fail-conservative behaviour and the runtime
// contract that no background optimiser work or stale preview survives while the guard owns
// the screen. The optimiser mathematics itself is unchanged and is covered elsewhere.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadApp, syntheticWorld } from './harness.mjs';

// Read at import time: the interactive harness replaces globalThis.URL with a Worker stub.
const VIEW_SOURCE = readFileSync(new URL('../src/ui/transfer-optimiser-view.mjs',import.meta.url),'utf8');
const PERFORMANCE_SOURCE = readFileSync(new URL('../src/ui/transfer-performance.mjs',import.meta.url),'utf8');
const APP_TEMPLATE = readFileSync(new URL('../app.html',import.meta.url),'utf8');
const BUNDLE = readFileSync(new URL('../dist/app.bundle.js',import.meta.url),'utf8');

const walk = root => { const nodes=[]; const visit=n=>{ if(!n) return; nodes.push(n); (n.children||[]).forEach(visit); }; visit(root); return nodes; };
const visibleText = root => walk(root).filter(n=>n.nodeType===3).map(n=>n.textContent).join('');
const settle = async (turns=8) => { for(let i=0;i<turns;i++) await new Promise(resolve=>setTimeout(resolve,0)); };

const DEADLINE = Date.parse('2026-08-21T17:30:00Z');
const preSeasonState = (overrides={}) => ({
  nextGW:1, currentGW:0, seasonLive:false,
  boot:{events:[{id:1,deadline_time:'2026-08-21T17:30:00Z'},{id:2,deadline_time:'2026-08-28T17:30:00Z'}]},
  ...overrides
});

// A legal 15-player squad drawn from the synthetic world, priced so affordability is exact.
function completeSquad(T){
  const need={1:2,2:5,3:5,4:3};
  const manual=[];
  let id=900;
  for(const [position,count] of Object.entries(need)){
    for(let i=0;i<count;i++){
      const player={id:id++,web_name:`S${id}`,element_type:Number(position),team:(i%3)+1,now_cost:45,
        status:'a',chance_of_playing_next_round:100,minutes:900,starts:10,total_points:40,form:'4.0',
        selected_by_percent:'10',goals_scored:2,assists:2,clean_sheets:2,saves:0,bonus:4,bps:200,
        expected_goals_per_90:0.2,expected_assists_per_90:0.2,defensive_contribution_per_90:0,
        news:'',cost_change_event:0,transfers_in_event:0,transfers_out_event:0,yellow_cards:0,penalties_order:null};
      T.S.boot.elements.push(player);
      T.S.byId[player.id]=player;
      manual.push({id:player.id,bought:45});
    }
  }
  T.S.manual=manual;
  return manual;
}

// Opens Transfers with a complete squad. `offsetMs` places the GW1 deadline relative to the
// real clock so the runtime rule is exercised deterministically without stubbing Date.
function openTransfers({gameweek=1,currentGW=0,seasonLive=false,offsetMs=24*60*60*1000,deadlineTime}={}){
  const app=loadApp({trHorizon:'1',trTop:'8',trFtCount:'1',trBankIn:'0',useManual:true},{interactive:true});
  syntheticWorld(app.T);
  completeSquad(app.T);
  app.doc.useManual.checked=true;
  app.T.S.nextGW=gameweek;
  app.T.S.currentGW=currentGW;
  app.T.S.seasonLive=seasonLive;
  const first=app.T.S.boot.events.find(event=>Number(event.id)===1);
  first.deadline_time=deadlineTime!==undefined?deadlineTime:new Date(Date.now()+offsetMs).toISOString();
  return app;
}

/* ---------------------------------------------------------------------
   Derivation rule
   --------------------------------------------------------------------- */

test('the unlimited-change window is open only before the official GW1 deadline',()=>{
  const {T}=loadApp();
  const open=T.initialSquadWindow(preSeasonState(),DEADLINE-1);
  assert.equal(open.active,true);
  assert.equal(open.reason,T.INITIAL_SQUAD_WINDOW_REASONS.OPEN);
  assert.equal(open.gameweek,T.INITIAL_SQUAD_WINDOW_GAMEWEEK);
  assert.equal(open.deadlineMs,DEADLINE);
  assert.equal(open.remainingMs,1);
});

test('the exact deadline instant and every later instant restore normal weekly behaviour',()=>{
  const {T}=loadApp();
  for(const now of [DEADLINE,DEADLINE+1,DEADLINE+7*24*3600*1000]){
    const state=T.initialSquadWindow(preSeasonState(),now);
    assert.equal(state.active,false,`the guard must not be active at ${now-DEADLINE}ms past the deadline`);
    assert.equal(state.reason,T.INITIAL_SQUAD_WINDOW_REASONS.DEADLINE_PASSED);
    assert.equal(state.deadlineMs,DEADLINE);
  }
});

test('any Gameweek context other than an unstarted GW1 keeps normal weekly behaviour',()=>{
  const {T}=loadApp();
  const cases=[
    ['a later next Gameweek',{nextGW:2}],
    ['a current Gameweek already running',{currentGW:1}],
    ['a season with finished Gameweeks',{seasonLive:true}],
    ['no next Gameweek at all',{nextGW:0}],
    ['an unusable next Gameweek',{nextGW:null}]
  ];
  for(const [label,overrides] of cases){
    const state=T.initialSquadWindow(preSeasonState(overrides),DEADLINE-1);
    assert.equal(state.active,false,`${label} must not open the unlimited-change window`);
    assert.equal(state.reason,T.INITIAL_SQUAD_WINDOW_REASONS.NOT_FIRST_GAMEWEEK);
    assert.equal(state.deadlineMs,null);
  }
});

test('missing or unusable deadline data never manufactures an unlimited-change claim',()=>{
  const {T}=loadApp();
  const cases=[
    ['no verified core at all',{boot:null}],
    ['no events array',{boot:{}}],
    ['events that are not a list',{boot:{events:{}}}],
    ['no GW1 event',{boot:{events:[{id:2,deadline_time:'2026-08-28T17:30:00Z'}]}}],
    ['a GW1 event without a deadline',{boot:{events:[{id:1}]}}],
    ['an unparseable GW1 deadline',{boot:{events:[{id:1,deadline_time:'not a date'}]}}],
    ['a null GW1 deadline',{boot:{events:[{id:1,deadline_time:null}]}}]
  ];
  for(const [label,overrides] of cases){
    const state=T.initialSquadWindow(preSeasonState(overrides),DEADLINE-1);
    assert.equal(state.active,false,`${label} must fail conservatively`);
    assert.equal(state.reason,T.INITIAL_SQUAD_WINDOW_REASONS.DEADLINE_UNAVAILABLE);
    assert.equal(state.deadlineMs,null);
  }
  const unusableClock=T.initialSquadWindow(preSeasonState(),Number.NaN);
  assert.equal(unusableClock.active,false,'an unusable clock must not open the window');
  assert.equal(unusableClock.reason,T.INITIAL_SQUAD_WINDOW_REASONS.DEADLINE_UNAVAILABLE);
});

/* ---------------------------------------------------------------------
   Guarded Transfers screen
   --------------------------------------------------------------------- */

test('before the GW1 deadline Transfers explains unlimited changes and starts no calculation',async()=>{
  const {T,doc,workers}=openTransfers();
  T.renderTransfers();
  await settle();
  const text=visibleText(doc.transferOut);
  assert.match(text,/Unlimited squad changes until the GW1 deadline/);
  assert.match(text,/until the first deadline of the season/);
  assert.match(text,/Weekly transfer planning starts after the first deadline/);
  assert.match(text,/Review your initial squad on Team/);
  assert.equal(workers.length,0,'the weekly optimiser must not run before the first deadline');
  assert.equal(T.S.lastOptimiser,null,'no transfer comparison may be claimed before the first deadline');
  assert.equal(doc.transferOut.attrs['aria-busy'],'false');
  assert.match(doc.transferStatus.textContent,/No transfer comparison applies yet/);
});

test('the guarded screen presents no free-transfer, hit or ranked-plan advice',async()=>{
  const {doc,T,workers}=openTransfers();
  T.renderTransfers();
  await settle();
  const text=visibleText(doc.transferOut);
  for(const forbidden of [
    /Make no transfer/,/Highest-ranked/,/Net model comparison/,/Preview on Team/,
    /No hit/,/point hit/,/free transfer[s]? for next Gameweek/,/Bank after/,/Updating transfer advice/
  ]) assert.doesNotMatch(text,forbidden,`guarded Transfers must not present ${forbidden}`);
  assert.equal(doc.transferAssumptions.hidden,true,'free-transfer and bank assumptions must not be collected yet');
  assert.equal(workers.length,0);
});

test('the guard does not let verified data changes restart background optimiser work',async()=>{
  const {T,doc,workers,dispatch}=openTransfers();
  T.renderTransfers();
  await settle();
  assert.equal(workers.length,0);
  dispatch('teamsheet:data-rendered',{});
  await settle();
  assert.equal(workers.length,0,'a verified data change must not start guarded optimiser work');
  assert.match(visibleText(doc.transferOut),/Unlimited squad changes/);
});

test('the guard cancels in-flight work and clears any stale result or previewed plan',async()=>{
  const app=openTransfers({gameweek:11,currentGW:10,seasonLive:true});
  app.T.renderTransfers();
  await settle();
  assert.equal(app.workers.length,1,'a normal Gameweek must still start exactly one background calculation');
  const running=app.workers[0];

  app.T.S.lastOptimiser={result:{status:'ok'},horizon:1};
  app.T.decisionPreviewSelectTransfer(
    {transferCount:1,transfers:[{outPlayerId:900,inPlayerId:101}],signature:'x'},
    app.T.mySquad(),'signature');
  assert.ok(app.T.decisionPreviewSnapshot().transfer,'the preview fixture must be active before the guard engages');

  app.T.S.nextGW=1; app.T.S.currentGW=0; app.T.S.seasonLive=false;
  app.T.renderTransfers();
  await settle();
  assert.equal(running.terminated,true,'guarded Transfers must not leave optimiser work running');
  assert.equal(app.workers.length,1,'the guard must not start replacement optimiser work');
  assert.equal(app.T.S.lastOptimiser,null,'a stale optimiser result must not survive the guard');
  assert.equal(app.T.decisionPreviewSnapshot().transfer,null,'a previewed transfer plan must not survive the guard');
  assert.match(visibleText(app.doc.transferOut),/Unlimited squad changes/);
});

/* ---------------------------------------------------------------------
   Normal weekly behaviour is unchanged
   --------------------------------------------------------------------- */

test('GW1 with a passed deadline runs the ordinary weekly optimiser',async()=>{
  const {T,doc,workers}=openTransfers({offsetMs:-1000});
  T.renderTransfers();
  await settle();
  assert.equal(workers.length,1,'after the first deadline the weekly optimiser must run normally');
  assert.equal(doc.transferAssumptions.hidden,false,'planning assumptions return once the deadline has passed');
  assert.doesNotMatch(visibleText(doc.transferOut),/Unlimited squad changes/);
});

test('GW1 without usable deadline data runs the ordinary weekly optimiser rather than claiming unlimited changes',async()=>{
  for(const deadlineTime of [null,'not a date']){
    const {T,doc,workers}=openTransfers({deadlineTime});
    T.renderTransfers();
    await settle();
    assert.equal(workers.length,1,'unusable deadline data must fall back to normal behaviour');
    assert.doesNotMatch(visibleText(doc.transferOut),/Unlimited squad changes/);
  }
});

test('a later Gameweek is completely unaffected by the guard',async()=>{
  const {T,doc,workers}=openTransfers({gameweek:11,currentGW:10,seasonLive:true});
  T.renderTransfers();
  await settle();
  assert.equal(workers.length,1);
  assert.equal(doc.transferAssumptions.hidden,false);
  assert.match(visibleText(doc.transferOut),/Updating transfer advice|Checking exact transfer plans/);
  assert.doesNotMatch(visibleText(doc.transferOut),/Unlimited squad changes/);
});

/* ---------------------------------------------------------------------
   Ownership and source contracts
   --------------------------------------------------------------------- */

test('the guard is derived from Official FPL event data, never from a hard-coded season date',()=>{
  const view=VIEW_SOURCE;
  const performance=PERFORMANCE_SOURCE;
  assert.match(view,/function initialSquadWindow\(/);
  assert.match(view,/deadline_time/,'the window must read the official event deadline');
  for(const source of [view,performance])
    assert.doesNotMatch(source,/20\d\d-\d\d-\d\dT/,'no season-specific deadline may be hard-coded into the guard');
  assert.doesNotMatch(view,/optimiseTransfers\s*\(/,'the guard must not enter the optimiser');
});

test('every runtime entry point that could start optimiser work checks the guard first',()=>{
  const source=PERFORMANCE_SOURCE;
  assert.match(source,/function transferPerformanceInitialSquadClaim\(/);
  const renderer=source.slice(source.indexOf('function renderTransfers(){'),source.indexOf('function installTransferPerformanceRuntime(){'));
  assert.match(renderer,/transferPerformanceInitialSquadClaim/,'route rendering must consult the guard');
  const starter=source.slice(source.indexOf('async function transferPerformanceStart('),source.indexOf('function transferPerformanceCancel('));
  assert.match(starter,/transferPerformanceInitialSquadClaim/,'starting a calculation must consult the guard');
  const auto=source.slice(source.indexOf('function transferPerformanceScheduleAuto(){'),source.indexOf('function renderTransfers(){'));
  assert.match(auto,/transferPerformanceInitialSquadClaim/,'automatic scheduling must consult the guard');
});

test('the production deployable ships the guard copy and its hidden assumptions hook',()=>{
  const bundle=BUNDLE;
  const app=APP_TEMPLATE;
  assert.match(bundle,/Unlimited squad changes until the GW\$\{INITIAL_SQUAD_WINDOW_GAMEWEEK\} deadline/);
  assert.match(bundle,/Weekly transfer planning starts after the first deadline/);
  assert.match(bundle,/function initialSquadWindow\(/);
  assert.match(app,/<fieldset class="transfer-assumptions" id="transferAssumptions"/);
});
