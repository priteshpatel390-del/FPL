import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* A minimal but genuinely working node. The restricted no-core path builds real
   DOM through setChildren()/el(), so an inert placeholder would throw and
   disguise itself as the very render failure these tests are separating. */
function domNode(){
  const node={children:[],attributes:{},dataset:{},className:'',textContent:'',hidden:false,nodeType:1,
    classList:{add(){},remove(){},toggle(){},contains(){return false;}},
    get firstChild(){return node.children[0]||null;},
    appendChild(child){node.children.push(child);return child;},
    removeChild(child){node.children=node.children.filter(item=>item!==child);return child;},
    setAttribute(name,value){node.attributes[name]=value;},
    addEventListener(){},prepend(){}};
  return node;
}
const fields={
  useManual:{checked:false},useUstat:{checked:false},oddsKey:{value:''},teamId:{value:''},
  ftCount:{value:'1'},bankIn:{value:'0'},trHorizon:{value:'6'},trTop:{value:'8'},
  plPos:{options:{length:1},add(){}},status:{textContent:''},ticker:domNode(),globalDataWarning:null,
  providerHealthRows:null,persistenceStatus:null,startupGate:{hidden:false}
};
const bodyClasses=new Set();
globalThis.Option=class { constructor(text,value){this.text=text;this.value=value;} };
globalThis.CustomEvent=class { constructor(type,options={}){this.type=type;this.detail=options.detail;} };
globalThis.document={
  getElementById(id){return fields[id]??null;},
  activeElement:null,
  visibilityState:'visible',
  addEventListener(){},
  dispatchEvent(){return true;},
  querySelector(){return null;},
  createElement(){return domNode();},
  createTextNode(text){return {textContent:text,nodeType:3};},
  body:{
    classList:{
      toggle(name,value){if(value)bodyClasses.add(name);else bodyClasses.delete(name);},
      add(name){bodyClasses.add(name);},remove(name){bodyClasses.delete(name);},contains(name){return bodyClasses.has(name);}
    },
    setAttribute(){},dataset:{}
  }
};
globalThis.window={addEventListener(){}};
globalThis.localStorage={
  _d:{},
  getItem(key){return Object.prototype.hasOwnProperty.call(this._d,key)?this._d[key]:null;},
  setItem(key,value){this._d[key]=String(value);},
  removeItem(key){delete this._d[key];}
};
globalThis.renderAll=()=>{};

const {S}=await import('../src/state.mjs');
const {resetHealth,getHealth,HEALTH_STATES}=await import('../src/providers/registry.mjs');
const applied=await import('../src/providers/applied.mjs');
const main=await import('../src/main.mjs');

const MAIN_SOURCE=readFileSync(new URL('../src/main.mjs',import.meta.url),'utf8');

function team(id,name){
  return {id,name,short_name:name.slice(0,3).toUpperCase(),
    strength_attack_home:1200,strength_attack_away:1150,
    strength_defence_home:1180,strength_defence_away:1120};
}
function bootstrap(){
  return {
    events:[{id:1,deadline_time:'2026-08-14T17:30:00Z',is_current:false,is_next:true,
      finished:false,data_checked:false,name:'Gameweek 1'}],
    teams:['Arsenal','Chelsea','Everton','Fulham'].map((name,index)=>team(index+1,name)),
    element_types:[{id:1,singular_name_short:'GKP',singular_name:'Goalkeeper'},
      {id:2,singular_name_short:'DEF',singular_name:'Defender'}],
    elements:[1,2,3,4].map(id=>({id,web_name:'P'+id,team:((id-1)%4)+1,element_type:(id%2)+1,
      now_cost:50,total_points:10,form:'2.0',points_per_game:'2.0',selected_by_percent:'5.0',minutes:90,status:'a'}))
  };
}
function fixtures(){
  return [{event:1,id:1,team_h:1,team_a:2,team_h_difficulty:3,team_a_difficulty:3,
    kickoff_time:'2026-08-15T14:00:00Z',started:false,finished:false},
    {event:1,id:2,team_h:3,team_a:4,team_h_difficulty:3,team_a_difficulty:3,
    kickoff_time:'2026-08-15T16:30:00Z',started:false,finished:false}];
}
async function apiSuccess(path){
  if(path==='/bootstrap-static/') return {outcome:'value',value:bootstrap(),status:200,source:'Teamsheet gateway',retryRecord:null};
  if(path==='/fixtures/') return {outcome:'value',value:fixtures(),status:200,source:'Teamsheet gateway',retryRecord:null};
  throw new Error('unexpected endpoint '+path);
}
async function apiFailure(path){
  if(path==='/bootstrap-static/'||path==='/fixtures/') return {outcome:'failed',status:'network',retryable:true,retryRecord:null};
  throw new Error('unexpected endpoint '+path);
}
/* Detailed minute history only runs once a Gameweek has finished, so the
   minute-layer regressions need a core with a completed Gameweek. */
function liveBootstrap(){
  const value=bootstrap();
  value.events=[
    {id:1,deadline_time:'2026-08-07T17:30:00Z',is_current:true,is_next:false,finished:true,data_checked:true,name:'Gameweek 1'},
    {id:2,deadline_time:'2026-08-14T17:30:00Z',is_current:false,is_next:true,finished:false,data_checked:false,name:'Gameweek 2'}
  ];
  return value;
}
function liveFixtures(){
  return fixtures().map(fixture=>({...fixture,started:true,finished:true}));
}
async function apiLive(path){
  if(path==='/bootstrap-static/') return {outcome:'value',value:liveBootstrap(),status:200,source:'Teamsheet gateway',retryRecord:null};
  if(path==='/fixtures/') return {outcome:'value',value:liveFixtures(),status:200,source:'Teamsheet gateway',retryRecord:null};
  throw new Error('unexpected endpoint '+path);
}
function resetWorld(){
  resetHealth();
  applied.resetProviderTokens();
  applied.resetOddsKeyEpoch();
  globalThis.localStorage._d={};
  bodyClasses.clear();
  fields.useManual.checked=false;
  fields.useUstat.checked=false;
  fields.oddsKey.value='';
  fields.teamId.value='';
  fields.ftCount.value='1';
  fields.bankIn.value='0';
  fields.trHorizon.value='6';
  fields.trTop.value='8';
  fields.plPos.options.length=1;
  fields.status.textContent='';
  fields.ticker=domNode();
  globalThis.renderAll=()=>{};
  S.boot=null;S.fixtures=null;S.entry=null;S.picks=null;S.history=null;
  S.picksGameweek=0;S.picksStatus='idle';S.strengthsAvailable=false;
  S.teams={};S.byId={};S.posName={};S.avg=null;S.teamId='';S.currentGW=0;S.nextGW=1;
  S.seasonLive=false;S.gamesPlayed=1;S.source='';S.cachedAt=null;S.manual=[];S.chipsUsed=[];
  S.dataIssues=[];S.retryStats={};S.minuteHistory={};S.minuteHistoryMeta={};
  S.providerApplied={understat:null,odds:null};S.__accountKeys={entry:null,picks:null,history:null};
  S.ustat=null;S.ustatNote='';S.odds=null;S.oddsNote='';
}
test.beforeEach(resetWorld);

test('successful acquisition and commit followed by render failure stays application-owned',async()=>{
  const forced=new Error('forced-render-failure');
  globalThis.renderAll=()=>{throw forced;};
  const report=await main.loadAll({apiFn:apiSuccess});
  assert.equal(report.ok,true);
  assert.equal(report.errorClass,'render_failed');
  assert.equal(report.renderError,forced);
  assert.ok(S.boot,'the accepted core remains active after a display failure');
  assert.equal(getHealth('fpl').state,HEALTH_STATES.LIVE);
  assert.equal(fields.status.textContent,'Data updated but the display failed to refresh.');
});

test('provider collection failure plus recovery render failure preserves both error owners',async()=>{
  const initial=await main.loadAll({apiFn:apiSuccess});
  assert.equal(initial.ok,true);
  const acceptedBoot=S.boot;
  const forced=new Error('forced-fallback-render-failure');
  globalThis.renderAll=()=>{throw forced;};
  const report=await main.loadAll({apiFn:apiFailure});
  assert.equal(report.errorClass,'collection_failed');
  assert.equal(report.secondaryErrorClass,'render_failed');
  assert.equal(report.renderError,forced);
  assert.equal(S.boot,acceptedBoot,'previously accepted core stays active');
  assert.equal(getHealth('fpl').state,HEALTH_STATES.FALLBACK,'real FPL acquisition evidence still owns FPL health');
  assert.match(fields.status.textContent,/previous verified data remains active, but the display also failed/i);
});

test('unexpected Understat computation exception does not manufacture Understat provider health',async()=>{
  fields.useUstat.checked=true;
  const forced=new Error('forced-understat-internal-error');
  const report=await main.loadAll({apiFn:apiSuccess,understatDeps:{getStorage:async()=>{throw forced;}}});
  assert.equal(report.ok,true);
  assert.equal(report.errorClass,'internal_error');
  assert.equal(report.internalErrors.length,1);
  assert.equal(report.internalErrors[0].layer,'understat');
  assert.equal(report.internalErrors[0].error,forced);
  assert.equal(getHealth('understat'),null,'an application exception is not provider evidence');
  assert.equal(getHealth('fpl').state,HEALTH_STATES.LIVE);
  assert.match(S.ustatNote,/Supporting team-form processing failed/);
  assert.match(fields.status.textContent,/supporting data layer could not be processed/i);
});

test('unexpected Odds computation exception does not manufacture Odds provider health',async()=>{
  fields.oddsKey.value='test-key';
  const forced=new Error('forced-odds-internal-error');
  const report=await main.loadAll({apiFn:apiSuccess,oddsDeps:{getStorage:async()=>{throw forced;}}});
  assert.equal(report.ok,true);
  assert.equal(report.errorClass,'internal_error');
  assert.equal(report.internalErrors.length,1);
  assert.equal(report.internalErrors[0].layer,'odds');
  assert.equal(report.internalErrors[0].error,forced);
  assert.equal(getHealth('odds'),null,'an application exception is not provider evidence');
  assert.equal(getHealth('fpl').state,HEALTH_STATES.LIVE);
  assert.match(S.oddsNote,/Supporting market processing failed/);
});

test('refresh lifecycle owns unexpected application rejection without a global swallowing boundary',()=>{
  assert.match(MAIN_SOURCE,/verifiedRefreshPromise=\(async\(\)=>\{\s*try\{\s*if\(startup\)[\s\S]*?const refreshInputs=captureRefreshInputs\(\);\s*const report=await loadAll/);
  assert.match(MAIN_SOURCE,/catch\(error\)\{\s*const report=reportUnexpectedApplicationError\(error\);/);
  assert.match(MAIN_SOURCE,/errorClass:'internal_error',error/);
  assert.doesNotMatch(MAIN_SOURCE,/window\.onerror\s*=/);
  assert.doesNotMatch(MAIN_SOURCE,/unhandledrejection/);
  assert.match(MAIN_SOURCE,/secondaryErrorClass:renderError\?'render_failed':null/);
  /* Ownership wraps the one shared apply gate rather than replacing it, so the
     literal applyProviderResult() call sites stay in the commit path. */
  assert.match(MAIN_SOURCE,/ownApplicationError\('understat', staged\.understat, \(\) =>\s*applyProviderResult\('understat'/);
  assert.match(MAIN_SOURCE,/ownApplicationError\('odds', staged\.odds, \(\) =>\s*applyProviderResult\('odds'/);
  assert.match(MAIN_SOURCE,/ownApplicationError\('minutes', staged\.minutes, \(\) =>\s*applyProviderResult\('minutes'/);
});

/* Detailed minutes only run once a Gameweek has finished, so this exception
   needs a live-season core rather than the pre-season one above. */
test('unexpected minute-history processing exception leaves core Official FPL health truthful',async()=>{
  const forced=new Error('forced-minutes-internal-error');
  const report=await main.loadAll({apiFn:apiLive,minutesDeps:{getStorage:async()=>{throw forced;}}});
  assert.equal(report.ok,true);
  assert.equal(report.errorClass,'internal_error');
  assert.deepEqual(report.internalErrors.map(item=>item.layer),['minutes']);
  assert.equal(report.internalErrors[0].error,forced);
  const fpl=getHealth('fpl');
  assert.equal(fpl.state,HEALTH_STATES.LIVE,'a minute-processing exception must not relabel the core feed');
  assert.equal(fpl.detail,null,'no fabricated detailed-minute evidence survives an application exception');
  assert.equal(getHealth('understat').state,HEALTH_STATES.DISABLED,'the minute layer must not touch other rows');
  assert.equal(getHealth('odds').state,HEALTH_STATES.DISABLED);
});

test('a normal Understat provider failure still changes only the Understat row',async()=>{
  fields.useUstat.checked=true;
  const report=await main.loadAll({apiFn:apiSuccess,understatDeps:{fetchPage:async()=>null}});
  assert.equal(report.ok,true);
  assert.equal(report.errorClass,null,'a provider failure is not an application error');
  assert.deepEqual(report.internalErrors,[]);
  /* The contrast with the internal-exception regression above is the point: a
     genuine provider failure still publishes a provider-owned Understat row,
     where an application exception publishes none at all. */
  const understat=getHealth('understat');
  assert.equal(understat.state,HEALTH_STATES.FALLBACK,'genuine provider evidence still owns its row');
  assert.equal(understat.note,'saved team form is no longer compatible');
  assert.equal(getHealth('fpl').state,HEALTH_STATES.LIVE);
  assert.equal(getHealth('odds').state,HEALTH_STATES.DISABLED,'no Odds key was supplied, so nothing else moved');
});

test('a normal Odds provider failure still changes only the Odds row',async()=>{
  fields.oddsKey.value='test-key';
  const previousFetch=globalThis.fetch;
  globalThis.fetch=async()=>({status:429,ok:false,async json(){return null;}});
  let report;
  try{ report=await main.loadAll({apiFn:apiSuccess}); }
  finally{ globalThis.fetch=previousFetch; }
  assert.equal(report.ok,true);
  assert.equal(report.errorClass,null,'a provider failure is not an application error');
  assert.deepEqual(report.internalErrors,[]);
  const odds=getHealth('odds');
  assert.equal(odds.state,HEALTH_STATES.FALLBACK,'genuine provider evidence still owns its row');
  assert.equal(odds.note,'saved market inputs are no longer compatible');
  assert.equal(getHealth('fpl').state,HEALTH_STATES.LIVE);
  assert.equal(getHealth('understat').state,HEALTH_STATES.DISABLED,'Understat stays off, so nothing else moved');
});

test('a gateway failure with no usable cache stays provider-owned and restricted',async()=>{
  const report=await main.loadAll({apiFn:apiFailure});
  assert.equal(report.ok,false);
  assert.equal(report.criticalReady,false);
  assert.equal(report.errorClass,'collection_failed');
  assert.equal(report.secondaryErrorClass,null);
  assert.equal(report.source,'unavailable');
  assert.equal(getHealth('fpl').state,HEALTH_STATES.UNAVAILABLE);
  assert.equal(S.boot,null,'no unverified core may become active');
});

test('a fatal feed-shape failure stays acquisition-owned and triggers no application retry',async()=>{
  let bootstrapCalls=0;
  const shapeApi=async path=>{
    if(path==='/bootstrap-static/'){ bootstrapCalls++; return {outcome:'value',value:{events:[],teams:[],elements:[]},status:200,source:'Teamsheet gateway',retryRecord:null}; }
    return apiSuccess(path);
  };
  const report=await main.loadAll({apiFn:shapeApi});
  assert.equal(report.errorClass,'collection_failed');
  assert.equal(report.error?.feedShape,true,'a validation failure keeps its provider-owned shape marker');
  assert.equal(getHealth('fpl').state,HEALTH_STATES.UNAVAILABLE);
  assert.equal(bootstrapCalls,1,'a fatal validation failure must not drive a generic application retry');
});

test('a no-core failure-state render exception keeps the provider classification and never escapes',async()=>{
  const forced=new Error('forced-restricted-render-failure');
  globalThis.document.dispatchEvent=()=>{throw forced;};
  try{
    const report=await main.loadAll({apiFn:apiFailure});
    assert.equal(report.errorClass,'collection_failed','the real provider failure stays primary');
    assert.equal(report.secondaryErrorClass,'render_failed');
    assert.equal(report.renderError,forced);
    assert.equal(getHealth('fpl').state,HEALTH_STATES.UNAVAILABLE);
    assert.match(fields.status.textContent,/could not refresh the error display/i);
  }finally{ globalThis.document.dispatchEvent=()=>true; }
});

/* captureRefreshInputs() must sit INSIDE the boundary: a throw during input
   capture is the earliest lifecycle-edge failure, and it previously escaped
   runVerifiedRefresh() entirely. */
test('an unexpected refresh-lifecycle error is owned and releases the gate, lock and promise',async()=>{
  const forced=new Error('forced-input-capture-failure');
  const realGetElementById=globalThis.document.getElementById;
  globalThis.document.getElementById=id=>{ if(id==='teamId') throw forced; return realGetElementById.call(globalThis.document,id); };
  let report;
  try{ report=await main.runVerifiedRefresh({reason:'startup',startup:true,force:true}); }
  finally{ globalThis.document.getElementById=realGetElementById; }
  assert.equal(report.errorClass,'internal_error');
  assert.equal(report.error,forced);
  assert.equal(report.criticalReady,false);
  assert.equal(bodyClasses.has('startup-pending'),false,'the startup gate must be released');
  assert.equal(bodyClasses.has('data-refreshing'),false,'the interaction lock must be released');
  assert.equal(fields.startupGate.hidden,true);
  assert.equal(getHealth('fpl'),null,'an application error is not provider evidence and starts no acquisition');
  assert.match(fields.status.textContent,/application error/i);
  assert.doesNotMatch(fields.status.textContent,/forced-input-capture-failure/,'raw exception text must not reach the user');
  /* The promise slot must be released, or every later refresh would resolve to
     the failed attempt instead of consulting the ordinary cooldown. */
  const next=await main.runVerifiedRefresh({reason:'manual'});
  assert.equal(next.skipped,true);
  assert.equal(next.reason,'recently_attempted');
});

test('a manual refresh during an in-flight refresh is still queued after an application error',()=>{
  const lifecycle=MAIN_SOURCE.slice(MAIN_SOURCE.indexOf('async function runVerifiedRefresh'),
    MAIN_SOURCE.indexOf('function installVerifiedRefreshTriggers'));
  /* Queueing and every lifecycle release live in finally, so the application
     boundary cannot skip them, and the boundary itself starts no new load. */
  assert.match(lifecycle,/\}finally\{[\s\S]*?verifiedRefreshPromise=null;[\s\S]*?if\(queued\) void runVerifiedRefresh/);
  assert.match(lifecycle,/\}finally\{[\s\S]*?setRefreshInteractionLock\(false,\{startup\}\)/);
  assert.match(lifecycle,/\}finally\{[\s\S]*?setStartupGateVisible\(false\)/);
  const boundary=lifecycle.slice(lifecycle.indexOf('const report=reportUnexpectedApplicationError'),
    lifecycle.indexOf('}finally{'));
  assert.doesNotMatch(boundary,/loadAll|collectRefresh|runVerifiedRefresh/);
});
