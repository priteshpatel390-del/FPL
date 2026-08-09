import test from 'node:test';
import assert from 'node:assert/strict';

const fields = {useManual:{checked:false}, useUstat:{checked:true}, oddsKey:{value:''},
  teamId:{value:''}, ftCount:{value:'1'}, bankIn:{value:'0'}, trHorizon:{value:'6'}, trTop:{value:'8'},
  plPos:{options:{length:1}, add(){}}, status:{textContent:''}, ticker:{}, fxFrom:{value:''}, fxSpan:{value:'6', max:'38'}};
globalThis.document = {getElementById:id => fields[id] || {value:'', checked:false},
  activeElement:null, addEventListener(){}, dispatchEvent(){ return true; }, querySelector(){ return null; },
  body:{classList:{toggle(){}, add(){}, remove(){}, contains(){ return false; }}, setAttribute(){}, dataset:{}}};
globalThis.window = {addEventListener(){}};
globalThis.CustomEvent = class { constructor(type, options){ this.type = type; this.detail = options?.detail; } };
globalThis.localStorage = {_d:{}, getItem(k){ return this._d[k] ?? null; },
  setItem(k, v){ this._d[k] = String(v); }, removeItem(k){ delete this._d[k]; }};

const {S, prepareCore, assignCore, slim} = await import('../src/state.mjs');
const {SCHEMA_VERSION, MODEL_VERSION} = await import('../src/config.mjs');
const {resetHealth, markLive, getHealth, HEALTH_STATES} = await import('../src/providers/registry.mjs');
const {xpOf, clearXP, xpCacheValueSnapshot, xpCacheRefSnapshot} = await import('../src/model/scoring.mjs');
const applied = await import('../src/providers/applied.mjs');
const main = await import('../src/main.mjs');

function team(id, name){
  return {id, name, short_name:name.slice(0,3).toUpperCase(),
    strength_attack_home:1200, strength_attack_away:1150,
    strength_defence_home:1180, strength_defence_away:1120};
}
function payload(){
  return {
    events:[{id:1, deadline_time:'2026-08-14T17:30:00Z', is_current:false, is_next:true,
      finished:false, data_checked:false, name:'Gameweek 1'}],
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
function coreOf(){
  const prepared=prepareCore(slim(payload(),fixtures()));
  assert.equal(prepared.ok,true);
  return prepared.core;
}
const ustatMap=()=>({1:{xg:1.5,xga:1.1,atk:1.05,def:0.95},2:{xg:1.2,xga:1.4,atk:0.9,def:1.1}});
function appliedRecord(core,fetchedAt){
  return {signature:'accepted-signature',season:core.season,schemaVersion:SCHEMA_VERSION,
    modelVersion:MODEL_VERSION,fetchedAt};
}
function resetWorld(){
  resetHealth();
  applied.resetProviderTokens();
  applied.resetOddsKeyEpoch();
  clearXP();
  S.boot=null; S.fixtures=null; S.entry=null; S.picks=null; S.history=null;
  S.picksGameweek=0; S.picksStatus='idle'; S.chipsUsed=[];
  S.ustat=null; S.ustatNote=''; S.odds=null; S.oddsNote='';
  S.minuteHistory={}; S.minuteHistoryMeta={}; S.providerApplied={understat:null,odds:null};
  S.dataIssues=[]; S.retryStats={}; S.manual=[]; S.teamId='';
  S.__accountKeys={entry:null,picks:null,history:null};
}
test.beforeEach(resetWorld);

test('failed commit preserves xpCache values/references and restores the exact pre-existing recomputation queue', () => {
  const core=coreOf();
  assignCore(core,[]);
  S.source='accepted';
  S.nextGW=1; S.seasonLive=false; S.avg=core.avg; S.strengthsAvailable=true;
  S.entry={name:'Accepted'};
  S.__accountKeys={entry:'old-entry',picks:'old-picks',history:'old-history'};
  S.ustat=ustatMap();
  S.providerApplied={understat:appliedRecord(core,900),odds:null};
  markLive('understat','accepted','accepted',900);

  xpOf(core.elements[0],1,1);
  const xpValuesBefore=xpCacheValueSnapshot();
  const xpRefsBefore=xpCacheRefSnapshot();
  assert.equal(xpRefsBefore.length,1,'the regression must begin with a populated cache');

  applied.queueRecomputation('odds');
  const queueBefore=applied.snapshotPendingRecomputation();
  assert.deepEqual(queueBefore.values,['odds']);

  let sawMismatchQueue=false;
  const laterFailureIssues={
    [Symbol.iterator](){
      const during=applied.snapshotPendingRecomputation();
      sawMismatchQueue=during.queue===queueBefore.queue &&
        during.values.length===2 && during.values[0]==='odds' && during.values[1]==='understat';
      throw new Error('forced-late-commit-failure');
    }
  };
  const staged={core,coreIssues:[],corePartial:false,source:'new',retryRecords:[],slimmed:{},
    inputs:{teamId:'7',useUstat:true,useManual:false,oddsKey:'',manualIds:[],lifecycleEpoch:0},
    account:{entry:{outcome:'value',value:{name:'New'}},picks:{outcome:'value',value:{picks:[]}},
      history:{outcome:'value',value:{chips:[]}},picksGameweek:1,issues:laterFailureIssues,retryRecords:[]},
    understat:{outcome:'value',value:ustatMap(),signature:'stale-provider-signature',fetchedAt:950,
      healthMark:{kind:'live'},issues:[],retryRecords:[],persist:null},
    odds:{outcome:'clear',issues:[],retryRecords:[],persist:null},
    minutes:{outcome:'clear',issues:[],retryRecords:[],persist:null,cohortIds:[]}};

  const result=main.applyRefreshCommit(staged,{now:1000});
  assert.equal(result.ok,false);
  assert.equal(result.reason,'commit_failed');
  assert.equal(result.error?.message,'forced-late-commit-failure');
  assert.equal(sawMismatchQueue,true,'the provider mismatch must queue during the commit before the later failure');

  assert.deepEqual(xpCacheValueSnapshot(),xpValuesBefore,'cached values must be byte-for-byte equivalent after rollback');
  const xpRefsAfter=xpCacheRefSnapshot();
  assert.equal(xpRefsAfter.length,xpRefsBefore.length);
  xpRefsBefore.forEach(([key,ref],index)=>{
    assert.equal(xpRefsAfter[index][0],key);
    assert.equal(xpRefsAfter[index][1],ref,'rollback must retain each existing cached object identity');
  });

  const queueAfter=applied.snapshotPendingRecomputation();
  assert.equal(queueAfter.queue,queueBefore.queue,'rollback must retain the same Set object');
  assert.deepEqual(queueAfter.values,queueBefore.values,'rollback must restore exactly the pre-commit queue contents');
  assert.deepEqual(S.entry,{name:'Accepted'});
  assert.equal(getHealth('understat',{},1000).state,HEALTH_STATES.LIVE);
  assert.equal(getHealth('understat',{},1000).note,'accepted');
});

test('pending recomputation snapshot restores contents in place without replacing the Set', () => {
  applied.queueRecomputation('odds');
  const before=applied.snapshotPendingRecomputation();
  applied.queueRecomputation('minutes');
  assert.deepEqual(applied.snapshotPendingRecomputation().values,['odds','minutes']);
  applied.restorePendingRecomputation(before);
  const after=applied.snapshotPendingRecomputation();
  assert.equal(after.queue,before.queue);
  assert.deepEqual(after.values,['odds']);
});
