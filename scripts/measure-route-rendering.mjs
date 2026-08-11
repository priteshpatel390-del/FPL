#!/usr/bin/env node
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { loadApp, syntheticWorld } from '../tests/harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE_PATH = join(ROOT, 'dist/app.bundle.js');
const STARTUP_MARKER = '(async function init(){';
const LATE_RUNTIME_MARKER = '/* ===== src/ui/manual-squad-runtime.mjs ===== */';
const DEFAULT_PLAYER_COUNT = 600;

const PROBED_FUNCTIONS = [
  'renderAll',
  'renderTicker',
  'renderPlayers',
  'renderSquad',
  'renderTransfers',
  'renderManual',
  'renderMiniLeagues',
  'renderMiniLeagueHub',
  'renderMiniLeagueLanding',
  'renderMiniLeagueStandings',
  'renderMiniLeagueRival',
  'renderMiniLeagueExposure',
  'transferPerformanceScores'
];

function probeInstallSource(){
  const names = JSON.stringify(PROBED_FUNCTIONS);
  return `\n/* ===== test-only route-render performance probe ===== */\n
const __teamsheetPerfNames=${names};
const __teamsheetPerfRecords=[];
let __teamsheetPerfSequence=0;
let __teamsheetPerfDomWrites=0;
let __teamsheetPerfXpCalls=0;
let __teamsheetPerfRunScoreCalls=0;
const __teamsheetPerfNow=()=>typeof globalThis.performance?.now==='function'?globalThis.performance.now():Date.now();
const __teamsheetPerfRoute=()=>String(globalThis.location?.hash||'').split('?')[0]||'#/team';
function __teamsheetPerfActive(name,route){
  if(name==='renderAll') return true;
  if(name==='renderTicker') return route==='#/fixtures';
  if(name==='renderPlayers') return route==='#/settings/research/players';
  if(name==='renderSquad') return route==='#/team';
  if(name==='renderTransfers'||name==='transferPerformanceScores') return route==='#/transfers';
  if(name==='renderManual') return route==='#/settings/team-account/manual-squad';
  if(name==='renderMiniLeagues'||name==='renderMiniLeagueHub') return route.startsWith('#/leagues');
  if(name==='renderMiniLeagueLanding') return route==='#/leagues/detail';
  if(name==='renderMiniLeagueStandings') return route==='#/leagues/standings';
  if(name==='renderMiniLeagueRival') return route==='#/leagues/rival';
  if(name==='renderMiniLeagueExposure') return route==='#/leagues/exposure';
  return null;
}
function __teamsheetPerfWrap(name,fn){
  if(typeof fn!=='function') return fn;
  return function(...args){
    const route=__teamsheetPerfRoute();
    const record={
      sequence:++__teamsheetPerfSequence,
      name,
      route,
      active:__teamsheetPerfActive(name,route),
      startedAt:__teamsheetPerfNow(),
      durationMs:null,
      domWritesBefore:__teamsheetPerfDomWrites,
      xpCallsBefore:__teamsheetPerfXpCalls,
      runScoreCallsBefore:__teamsheetPerfRunScoreCalls
    };
    __teamsheetPerfRecords.push(record);
    const finish=()=>{
      if(record.durationMs!==null) return;
      record.durationMs=Math.max(0,__teamsheetPerfNow()-record.startedAt);
      record.domWrites=__teamsheetPerfDomWrites-record.domWritesBefore;
      record.xpCalls=__teamsheetPerfXpCalls-record.xpCallsBefore;
      record.runScoreCalls=__teamsheetPerfRunScoreCalls-record.runScoreCallsBefore;
    };
    try{
      const value=fn.apply(this,args);
      if(value&&typeof value.then==='function') return value.finally(finish);
      finish();
      return value;
    }catch(error){
      finish();
      throw error;
    }
  };
}
const __teamsheetPerfOriginalSetChildren=setChildren;
setChildren=function(...args){ __teamsheetPerfDomWrites++; return __teamsheetPerfOriginalSetChildren.apply(this,args); };
const __teamsheetPerfOriginalXpOf=xpOf;
xpOf=function(...args){ __teamsheetPerfXpCalls++; return __teamsheetPerfOriginalXpOf.apply(this,args); };
const __teamsheetPerfOriginalRunScore=runScore;
runScore=function(...args){ __teamsheetPerfRunScoreCalls++; return __teamsheetPerfOriginalRunScore.apply(this,args); };
for(const name of __teamsheetPerfNames){
  if(name==='renderAll') renderAll=__teamsheetPerfWrap(name,renderAll);
  else if(name==='renderTicker') renderTicker=__teamsheetPerfWrap(name,renderTicker);
  else if(name==='renderPlayers') renderPlayers=__teamsheetPerfWrap(name,renderPlayers);
  else if(name==='renderSquad') renderSquad=__teamsheetPerfWrap(name,renderSquad);
  else if(name==='renderTransfers') renderTransfers=__teamsheetPerfWrap(name,renderTransfers);
  else if(name==='renderManual') renderManual=__teamsheetPerfWrap(name,renderManual);
  else if(name==='renderMiniLeagues') renderMiniLeagues=__teamsheetPerfWrap(name,renderMiniLeagues);
  else if(name==='renderMiniLeagueHub') renderMiniLeagueHub=__teamsheetPerfWrap(name,renderMiniLeagueHub);
  else if(name==='renderMiniLeagueLanding') renderMiniLeagueLanding=__teamsheetPerfWrap(name,renderMiniLeagueLanding);
  else if(name==='renderMiniLeagueStandings') renderMiniLeagueStandings=__teamsheetPerfWrap(name,renderMiniLeagueStandings);
  else if(name==='renderMiniLeagueRival') renderMiniLeagueRival=__teamsheetPerfWrap(name,renderMiniLeagueRival);
  else if(name==='renderMiniLeagueExposure') renderMiniLeagueExposure=__teamsheetPerfWrap(name,renderMiniLeagueExposure);
  else if(name==='transferPerformanceScores') transferPerformanceScores=__teamsheetPerfWrap(name,transferPerformanceScores);
}
globalThis.__TEAMSHEET_ROUTE_PERF__={
  reset(){
    __teamsheetPerfRecords.length=0;
    __teamsheetPerfSequence=0;
    __teamsheetPerfDomWrites=0;
    __teamsheetPerfXpCalls=0;
    __teamsheetPerfRunScoreCalls=0;
  },
  snapshot(){
    return {
      records:__teamsheetPerfRecords.map(row=>({...row})),
      counters:{domWrites:__teamsheetPerfDomWrites,xpCalls:__teamsheetPerfXpCalls,runScoreCalls:__teamsheetPerfRunScoreCalls}
    };
  }
};
globalThis.__TEAMSHEET_ROUTE_PERF_INIT_MINI__=initMiniLeagues;
/* ===== end test-only route-render performance probe ===== */\n`;
}

function instrumentedRuntimeBundle(bundle){
  const start = bundle.indexOf(STARTUP_MARKER);
  const lateRuntime = bundle.indexOf(LATE_RUNTIME_MARKER);
  if(start < 0) throw new Error('generated bundle is missing the production startup marker');
  if(lateRuntime <= start) throw new Error('generated bundle is missing the late runtime marker after startup');
  if(bundle.indexOf(STARTUP_MARKER,start+STARTUP_MARKER.length)!==-1)
    throw new Error('generated bundle contains more than one production startup marker');
  return bundle.slice(0,start) + probeInstallSource() + bundle.slice(lateRuntime);
}

function addRepresentativePlayers(T,total=DEFAULT_PLAYER_COUNT){
  const target=Math.max(15,Math.trunc(Number(total)||DEFAULT_PLAYER_COUNT));
  const base=T.S.boot.elements;
  let id=1000;
  const make=(position,index)=>({
    id:id++,web_name:`M1-${id}`,element_type:position,team:(index%20)+1,now_cost:45+(index%70),
    status:'a',chance_of_playing_next_round:100,minutes:900,starts:10,total_points:40+(index%50),form:String(2+(index%7)),
    selected_by_percent:String(1+(index%40)),goals_scored:index%8,assists:index%7,clean_sheets:index%9,saves:position===1?20+(index%50):0,
    bonus:index%15,bps:150+(index%250),expected_goals_per_90:position>=3?0.08+(index%40)/100:0.03,
    expected_assists_per_90:position>=2?0.05+(index%30)/100:0.01,defensive_contribution_per_90:position<=3?5+(index%12):0,
    news:'',cost_change_event:0,transfers_in_event:0,transfers_out_event:0,yellow_cards:index%5,penalties_order:null
  });
  let index=0;
  while(base.length<target){
    const position=[1,2,2,3,3,4][index%6];
    const player=make(position,index++);
    base.push(player);
    T.S.byId[player.id]=player;
  }

  const quotas={1:2,2:5,3:5,4:3};
  const manual=[];
  for(const [position,count] of Object.entries(quotas)){
    const candidates=base.filter(player=>Number(player.element_type)===Number(position));
    for(let i=0;i<count;i++) manual.push({id:candidates[i].id,bought:45});
  }
  T.S.manual=manual;
  return manual;
}

function roundMs(value){ return value==null?null:+Number(value).toFixed(3); }
function summarise(snapshot){
  const records=snapshot.records||[];
  const byName={};
  for(const row of records){
    const entry=byName[row.name]||(byName[row.name]={calls:0,inactiveCalls:0,totalMs:0,maxMs:0,domWrites:0,xpCalls:0,runScoreCalls:0});
    entry.calls++;
    if(row.active===false) entry.inactiveCalls++;
    if(Number.isFinite(row.durationMs)){
      entry.totalMs+=row.durationMs;
      entry.maxMs=Math.max(entry.maxMs,row.durationMs);
    }
    entry.domWrites+=Number(row.domWrites)||0;
    entry.xpCalls+=Number(row.xpCalls)||0;
    entry.runScoreCalls+=Number(row.runScoreCalls)||0;
  }
  for(const entry of Object.values(byName)){
    entry.totalMs=roundMs(entry.totalMs);
    entry.maxMs=roundMs(entry.maxMs);
  }
  return {byName,counters:{...snapshot.counters},records:records.map(row=>({...row,durationMs:roundMs(row.durationMs)}))};
}

async function settle(turns=8){
  for(let i=0;i<turns;i++) await new Promise(resolve=>setTimeout(resolve,0));
}

function withRealTimersLoad(target){
  const previousTarget=process.env.APP_TARGET;
  const previousTimers={setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval};
  process.env.APP_TARGET=target;
  globalThis.setTimeout=()=>0;
  globalThis.clearTimeout=()=>{};
  globalThis.setInterval=()=>0;
  globalThis.clearInterval=()=>{};
  try{ return loadApp({trHorizon:'6',trTop:'8',useManual:true},{interactive:true}); }
  finally{
    globalThis.setTimeout=previousTimers.setTimeout;
    globalThis.clearTimeout=previousTimers.clearTimeout;
    globalThis.setInterval=previousTimers.setInterval;
    globalThis.clearInterval=previousTimers.clearInterval;
    if(previousTarget===undefined) delete process.env.APP_TARGET;
    else process.env.APP_TARGET=previousTarget;
  }
}

async function measureFlow(app,name,action,{settleTurns=8,cancelTransfers=true}={}){
  const probe=globalThis.__TEAMSHEET_ROUTE_PERF__;
  probe.reset();
  await action();
  await settle(settleTurns);
  if(cancelTransfers) app.T.transferPerformanceCancel('',{render:false,explicit:false});
  await settle(2);
  return [name,summarise(probe.snapshot())];
}

export async function runRouteRenderMeasurements({playerCount=DEFAULT_PLAYER_COUNT}={}){
  const bundle=readFileSync(BUNDLE_PATH,'utf8');
  const relativeTarget=`dist/.route-render-performance-${process.pid}-${Date.now()}.js`;
  const absoluteTarget=join(ROOT,relativeTarget);
  writeFileSync(absoluteTarget,instrumentedRuntimeBundle(bundle));
  try{
    const app=withRealTimersLoad(relativeTarget);
    globalThis.location.hash='#/team';
    await globalThis.__TEAMSHEET_ROUTE_PERF_INIT_MINI__({});
    syntheticWorld(app.T);
    addRepresentativePlayers(app.T,playerCount);
    app.doc.useManual.checked=true;
    app.T.S.nextGW=11;

    const flows={};
    for(const [name,result] of [
      await measureFlow(app,'cold-like verified render',async()=>{ globalThis.location.hash='#/team'; app.T.renderAll(); },{settleTurns:Math.max(12,Math.ceil(playerCount/12)+6)}),
      await measureFlow(app,'Team → Transfers',async()=>{ globalThis.location.hash='#/transfers'; app.dispatch('teamsheet:route-change',{route:'#/transfers',primary:'transfers'}); }),
      await measureFlow(app,'Transfers → Leagues',async()=>{ globalThis.location.hash='#/leagues'; app.dispatch('teamsheet:route-change',{route:'#/leagues',primary:'leagues'}); }),
      await measureFlow(app,'Leagues → Settings',async()=>{ globalThis.location.hash='#/settings'; app.dispatch('teamsheet:route-change',{route:'#/settings',primary:'settings'}); }),
      await measureFlow(app,'foreground render on Team',async()=>{ globalThis.location.hash='#/team'; app.T.renderAll(); },{settleTurns:Math.max(12,Math.ceil(playerCount/12)+6)}),
      await measureFlow(app,'foreground render on Transfers',async()=>{ globalThis.location.hash='#/transfers'; app.T.renderAll(); },{settleTurns:Math.max(12,Math.ceil(playerCount/12)+6)}),
      await measureFlow(app,'manual squad data-rendered fan-out',async()=>{
        globalThis.location.hash='#/team';
        app.T.renderManual();
        app.T.renderSquad();
        app.dispatch('teamsheet:data-rendered',{});
      },{settleTurns:Math.max(12,Math.ceil(playerCount/12)+6)})
    ]) flows[name]=result;

    return {
      environment:{kind:'Node stub-DOM production-bundle probe',playerCount,routeTimingPrecision:'rough; not browser or physical-device evidence'},
      flows
    };
  }finally{
    delete globalThis.__TEAMSHEET_ROUTE_PERF__;
    delete globalThis.__TEAMSHEET_ROUTE_PERF_INIT_MINI__;
    unlinkSync(absoluteTarget);
  }
}

async function main(){
  const arg=process.argv.find(value=>value.startsWith('--players='));
  const playerCount=arg?Number(arg.split('=')[1]):DEFAULT_PLAYER_COUNT;
  const report=await runRouteRenderMeasurements({playerCount});
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{ console.error(error); process.exitCode=1; });
}
