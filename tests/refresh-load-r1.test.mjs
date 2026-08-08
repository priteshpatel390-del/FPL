import test from 'node:test';
import assert from 'node:assert/strict';
import { S } from '../src/state.mjs';
import { MODEL_VERSION, SCHEMA_VERSION, MINUTES_RULES, SUPPORTING_REFRESH_RULES } from '../src/config.mjs';
import { K_MINUTES, K_UNDERSTAT, K_ODDS } from '../src/storage.mjs';
import { HEALTH_STATES, getHealth, markLive, resetHealth } from '../src/providers/registry.mjs';
import {
  cohort, completedDataRevision, minuteCacheDecision, loadMinuteHistories
} from '../src/providers/minutes-history.mjs';
import {
  understatCacheDecision, understatFixtureRevision, loadUnderstat
} from '../src/providers/understat.mjs';
import {
  oddsRefreshInterval, oddsCacheDecision, oddsCooldownMs, loadOdds
} from '../src/providers/odds.mjs';

const HOUR=60*60*1000,DAY=24*HOUR;
const fields={useManual:{checked:false},useUstat:{checked:true},oddsKey:{value:'test-key'}};
globalThis.document={getElementById:id=>fields[id]||{value:'',checked:false}};
globalThis.window={};

function world({players=100}={}){
  S.boot={
    events:[
      {id:1,deadline_time:'2026-08-15T10:00:00Z',finished:true,data_checked:true},
      {id:2,deadline_time:'2026-08-22T10:00:00Z',finished:false,data_checked:false,is_next:true}
    ],
    teams:Array.from({length:20},(_,index)=>({id:index+1,name:`Team ${index+1}`,short_name:`T${index+1}`})),
    elements:Array.from({length:players},(_,index)=>({id:index+1,team:index%20+1,selected_by_percent:String(players-index),now_cost:50+index%10}))
  };
  S.fixtures=[
    {id:11,event:1,team_h:1,team_a:2,finished:true,kickoff_time:'2026-08-10T10:00:00Z'},
    {id:12,event:2,team_h:3,team_a:4,finished:false,kickoff_time:'2026-08-20T10:00:00Z'}
  ];
  S.seasonLive=true;
  S.picks={picks:Array.from({length:15},(_,index)=>({element:players-index}))};
  S.manual=Array.from({length:15},(_,index)=>({id:index+1}));
  S.minuteHistory={};
  S.dataIssues=[];
  S.retryStats={};
  fields.useManual.checked=false;
  fields.useUstat.checked=true;
  fields.oddsKey.value='test-key';
  resetHealth();
  markLive('fpl','core','current',Date.now());
}

function history(id){return [{fixture:1000+id,round:1,minutes:90,starts:1,kickoff_time:'2026-08-10T10:00:00Z'}];}
function minuteEnvelope(now,revision=completedDataRevision()){
  return {
    schemaVersion:SCHEMA_VERSION,modelVersion:MODEL_VERSION,season:'2026-27',
    fetchedAt:now,revision,
    players:Object.fromEntries(cohort().map(player=>[player.id,{fetchedAt:now,revision,history:history(player.id)}]))
  };
}
function memory(initial={}){
  const values=new Map(Object.entries(initial));
  return {
    values,
    getStorage:async key=>values.get(key)??null,
    setStorage:async(key,value)=>{values.set(key,value);}
  };
}

test.beforeEach(()=>world());

test('active squad is requested first and a different inactive manual squad does not enlarge the 80-player research cohort',()=>{
  const connected=cohort();
  assert.equal(connected.length,95);
  assert.deepEqual(connected.slice(0,15).map(player=>player.id),S.picks.picks.map(pick=>pick.element));
  fields.useManual.checked=true;
  const manual=cohort();
  assert.equal(manual.length,95);
  assert.deepEqual(manual.slice(0,15).map(player=>player.id),S.manual.map(player=>player.id));
});

test('minute revision advances only for fixtures in finished and data-checked Gameweeks',()=>{
  assert.equal(completedDataRevision(),'checked:1|fixtures:11');
  S.fixtures[1].finished=true;
  assert.equal(completedDataRevision(),'checked:1|fixtures:11');
  S.boot.events[1].finished=true;S.boot.events[1].data_checked=true;
  assert.equal(completedDataRevision(),'checked:1,2|fixtures:11,12');
});

test('fresh valid minute histories suppress all detail requests and preserve the successful timestamp',async()=>{
  const now=10*DAY,env=minuteEnvelope(now-DAY),store=memory({[K_MINUTES]:env});
  let requests=0;
  const report=await loadMinuteHistories({...store,nowFn:()=>now,fetchSummary:async()=>{requests++;return null;}});
  assert.equal(requests,0);
  assert.deepEqual(report,{loaded:0,failed:0,cached:95,requested:0,deferred:0});
  assert.equal(store.values.get(K_MINUTES).fetchedAt,env.fetchedAt);
  assert.equal(getHealth('fpl').detail.state,HEALTH_STATES.CACHED);
});

test('minute refresh requests only a missing entry and stamps only that successful player',async()=>{
  const now=10*DAY,env=minuteEnvelope(now-DAY),missing=cohort()[20].id;
  delete env.players[missing];
  const store=memory({[K_MINUTES]:env}),requested=[];
  const report=await loadMinuteHistories({...store,nowFn:()=>now,fetchSummary:async id=>{requested.push(id);return {history:history(id)};}});
  assert.deepEqual(requested,[missing]);
  assert.equal(report.loaded,1);
  assert.equal(report.cached,94);
  assert.equal(store.values.get(K_MINUTES).players[missing].fetchedAt,now);
});

test('fixture revision change makes histories due while the seven-day backstop independently limits corrections',()=>{
  const now=10*DAY,revision=completedDataRevision(),entry={fetchedAt:now-DAY,revision,history:history(1)};
  assert.equal(minuteCacheDecision(entry,{revision},{revision,now}).due,false);
  assert.equal(minuteCacheDecision(entry,{revision},{revision:'new',now}).reason,'fixture_revision');
  assert.equal(minuteCacheDecision({...entry,fetchedAt:now-MINUTES_RULES.cacheMaxAgeMs-1},{revision},{revision,now}).reason,'age_backstop');
});

test('two failed four-player minute batches stop a systemic outage without advancing cache success time',async()=>{
  const now=10*DAY,old=now-2*DAY,env=minuteEnvelope(old,'old-revision'),store=memory({[K_MINUTES]:env});
  let requests=0;
  const report=await loadMinuteHistories({...store,nowFn:()=>now,fetchSummary:async()=>{requests++;return null;}});
  assert.equal(requests,8);
  assert.equal(report.failed,8);
  assert.equal(report.deferred,87);
  assert.equal(report.cached,95);
  assert.equal(store.values.get(K_MINUTES).fetchedAt,old);
  assert.ok(Object.values(store.values.get(K_MINUTES).players).every(entry=>entry.fetchedAt===old));
  assert.equal(getHealth('fpl').state,HEALTH_STATES.LIVE,'optional minute failure does not relabel current core FPL data');
  assert.equal(getHealth('fpl').detail.state,HEALTH_STATES.PARTIAL);
});

test('Understat uses a validated cache until a completed-match revision or 24-hour age makes it due',()=>{
  const now=10*DAY,revision=understatFixtureRevision();
  const env={schemaVersion:SCHEMA_VERSION,modelVersion:MODEL_VERSION,season:'2026-27',fixtureRevision:revision,
    fetchedAt:now-HOUR,teams:{1:{xg:1.5,xga:1,atk:1.2,def:1.1}}};
  assert.equal(understatCacheDecision(env,{revision,now}).due,false);
  assert.equal(understatCacheDecision(env,{revision:'changed',now}).due,true);
  assert.equal(understatCacheDecision({...env,fetchedAt:now-SUPPORTING_REFRESH_RULES.understat.maxAgeMs-1},{revision,now}).usable,false);
});

test('Understat shape failure persists a six-hour cooldown and the next automatic cycle makes no request',async()=>{
  const now=10*DAY,store=memory();let requests=0;
  const first=await loadUnderstat({...store,nowFn:()=>now,fetchPage:async()=>{requests++;return '<html>changed</html>';}});
  assert.equal(first.requested,2);
  assert.equal(requests,2);
  assert.equal(store.values.get(K_UNDERSTAT).retryAfterAt,now+6*HOUR);
  const second=await loadUnderstat({...store,nowFn:()=>now+HOUR,fetchPage:async()=>{requests++;return null;}});
  assert.equal(second.cooling,true);
  assert.equal(requests,2);
});

test('Understat persists only normalised team inputs, reuses them automatically and lets manual refresh bypass cadence',async()=>{
  const now=10*DAY,store=memory();let requests=0;
  const parsed=Object.fromEntries(S.boot.teams.map(team=>[team.id,{title:team.name,history:[{xG:'1.2',xGA:'0.8'},{xG:'1.4',xGA:'1.0'}]}]));
  const encoded=[...JSON.stringify(parsed)].map(char=>'\\x'+char.charCodeAt(0).toString(16).padStart(2,'0')).join('');
  const page=`teamsData = JSON.parse('${encoded}')`;
  const fetchPage=async()=>{requests++;return page;};
  const first=await loadUnderstat({...store,nowFn:()=>now,fetchPage});
  assert.equal(first.loaded,20);
  assert.equal(requests,1);
  const saved=store.values.get(K_UNDERSTAT);
  assert.equal(Object.keys(saved.teams).length,20);
  assert.equal(JSON.stringify(saved).includes('teamsData'),false);
  assert.equal(JSON.stringify(saved).includes('history'),false);
  const second=await loadUnderstat({...store,nowFn:()=>now+HOUR,fetchPage});
  assert.equal(second.source,'cache');
  assert.equal(requests,1);
  await loadUnderstat({...store,nowFn:()=>now+HOUR,fetchPage,force:true});
  assert.equal(requests,2);
});

test('Odds cadence is hourly within 48 hours and six-hourly otherwise; data older than six hours is inactive',()=>{
  const near=Date.parse('2026-08-20T09:00:00Z');
  assert.equal(oddsRefreshInterval(near),HOUR);
  assert.equal(oddsRefreshInterval(Date.parse('2026-08-01T09:00:00Z')),6*HOUR);
  const env={schemaVersion:SCHEMA_VERSION,modelVersion:MODEL_VERSION,season:'2026-27',checkedAt:near-HOUR+1,
    fetchedAt:near-HOUR,derived:{'1|2':{hId:1,aId:2,xGH:1.5,xGA:1,kickoff:near+DAY}}};
  assert.equal(oddsCacheDecision(env,{now:near,refreshMs:HOUR}).due,false);
  assert.equal(oddsCacheDecision({...env,fetchedAt:near-6*HOUR-1},{now:near,refreshMs:HOUR}).usable,false);
  assert.equal(oddsCacheDecision({...env,derived:{'1|2':{hId:2,aId:1,xGH:1.5,xGA:1}}},{now:near,refreshMs:HOUR}).due,true);
});

test('fresh Odds cache suppresses a call and persisted rejection cooldown contains no API key',async()=>{
  const now=Date.parse('2026-08-20T09:00:00Z');
  const cached={schemaVersion:SCHEMA_VERSION,modelVersion:MODEL_VERSION,season:'2026-27',checkedAt:now-1000,
    fetchedAt:now-1000,derived:{'1|2':{hId:1,aId:2,xGH:1.5,xGA:1,kickoff:now+DAY}}};
  let store=memory({[K_ODDS]:cached});
  const originalFetch=globalThis.fetch;let requests=0;
  globalThis.fetch=async()=>{requests++;throw new Error('must not fetch');};
  try{
    const report=await loadOdds({...store,nowFn:()=>now});
    assert.equal(report.source,'cache');
    assert.equal(requests,0);
    assert.equal(getHealth('odds').state,HEALTH_STATES.CACHED);

    store=memory();
    globalThis.fetch=async()=>({ok:false,status:401,json:async()=>({})});
    await loadOdds({...store,nowFn:()=>now,force:true});
    const saved=store.values.get(K_ODDS);
    assert.equal(saved.retryAfterAt,now+oddsCooldownMs(401));
    assert.equal(JSON.stringify(saved).includes(fields.oddsKey.value),false);

    store=memory({[K_ODDS]:{...cached,apiKey:fields.oddsKey.value,keyedUrl:'https://example.invalid/?apiKey='+fields.oddsKey.value}});
    await loadOdds({...store,nowFn:()=>now,force:true});
    assert.equal(JSON.stringify(store.values.get(K_ODDS)).includes(fields.oddsKey.value),false);
  }finally{globalThis.fetch=originalFetch;}
});

test('Odds persists validated derived inputs without its key and reuses them until the approved cadence is due',async()=>{
  const now=Date.parse('2026-08-20T09:00:00Z'),store=memory(),originalFetch=globalThis.fetch;
  S.fixtures.push({id:13,event:2,team_h:1,team_a:2,finished:false,kickoff_time:'2026-08-20T10:00:00Z'});
  const outcomes=[{name:'Team 1',price:2},{name:'Draw',price:3.4},{name:'Team 2',price:4}];
  const totals=[{name:'Over',price:1.9,point:2.5},{name:'Under',price:1.9,point:2.5}];
  const payload=[{id:'market-1',home_team:'Team 1',away_team:'Team 2',commence_time:'2026-08-20T10:00:00Z',bookmakers:[
    {last_update:'2026-08-20T08:50:00Z',markets:[{key:'h2h',outcomes},{key:'totals',outcomes:totals}]},
    {last_update:'2026-08-20T08:55:00Z',markets:[{key:'h2h',outcomes},{key:'totals',outcomes:totals}]}
  ]}];
  let requests=0;
  globalThis.fetch=async()=>{requests++;return {ok:true,status:200,json:async()=>payload};};
  try{
    const first=await loadOdds({...store,nowFn:()=>now,force:true});
    assert.equal(first.loaded,1);
    assert.equal(requests,1);
    const saved=store.values.get(K_ODDS);
    assert.equal(Object.keys(saved.derived).length,1);
    assert.equal(JSON.stringify(saved).includes(fields.oddsKey.value),false);
    const second=await loadOdds({...store,nowFn:()=>now+30*60*1000});
    assert.equal(second.source,'cache');
    assert.equal(requests,1);
  }finally{globalThis.fetch=originalFetch;S.fixtures.pop();}
});
