import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FPL_RULES, SCHEMA_VERSION } from '../src/config.mjs';
import {
  K_CFG,K_SQUAD,K_CACHE,
  MAIN_CACHE_VERSION,CONFIG_STATE_VERSION,MANUAL_SQUAD_STATE_VERSION,
  MAIN_CACHE_RECORD_TYPE,MANUAL_SQUAD_RECORD_TYPE,
  sget,sgetResult,ssetChecked,ssetVerified,loadCfg,
  mainCacheEnvelope,decodeMainCacheRecord,legacyMainCacheMatchesSeason,
  manualSquadEnvelope,decodeManualSquadRecord,configEnvelope,decodeConfigRecord,
  preserveManualModeForPersistence,setManualSquadPersistenceReady,isManualSquadPersistenceReady,
  clearPersistenceWarning
} from '../src/storage.mjs';
import { S } from '../src/state.mjs';
import {
  MINI_LEAGUE_STATE_VERSION,K_MINI_LEAGUES,normaliseMiniLeagueState,miniLeagueStoredCompatibility,
  migrateMiniLeagueState,persistMiniLeagueState
} from '../src/ui/mini-leagues-state.mjs';
import { manualSquadCommitAddition } from '../src/ui/manual-squad-runtime.mjs';
import { forgetOddsKey } from '../src/providers/odds.mjs';

class MemoryStorage{
  constructor(){this.map=new Map();this.failWrites=false;this.lieOnRead=false;}
  get length(){return this.map.size;}
  key(index){return [...this.map.keys()][index]??null;}
  getItem(key){
    if(this.lieOnRead&&this.map.has(key)) return this.map.get(key)+'x';
    return this.map.has(key)?this.map.get(key):null;
  }
  setItem(key,value){if(this.failWrites) throw new Error('QuotaExceededError');this.map.set(key,String(value));}
  removeItem(key){this.map.delete(key);}
}

function currentCachePayload(){
  return {at:1786200000000,events:[
    {id:1,deadline_time:'2026-08-14T17:30:00Z'},
    {id:38,deadline_time:'2027-05-23T14:00:00Z'}
  ],teams:[],element_types:[],elements:[],fixtures:[]};
}
function previousCachePayload(){
  return {at:1754500000000,events:[
    {id:1,deadline_time:'2025-08-15T17:30:00Z'},
    {id:38,deadline_time:'2026-05-24T14:00:00Z'}
  ],teams:[],element_types:[],elements:[],fixtures:[]};
}
function resetStorage(){
  globalThis.window={};
  globalThis.localStorage=new MemoryStorage();
  setManualSquadPersistenceReady(true);
  for(const scope of ['cache','configuration','manual-squad','mini-leagues']) clearPersistenceWarning(scope);
}
test.beforeEach(resetStorage);

test('main FPL cache writes an explicit current-season compatibility envelope',async()=>{
  const payload=currentCachePayload();
  const result=await ssetChecked(K_CACHE,payload);
  assert.deepEqual(result,{ok:true,via:'local'});
  const stored=JSON.parse(globalThis.localStorage.getItem(K_CACHE));
  assert.equal(stored.recordType,MAIN_CACHE_RECORD_TYPE);
  assert.equal(stored.cacheVersion,MAIN_CACHE_VERSION);
  assert.equal(stored.schemaVersion,SCHEMA_VERSION);
  assert.equal(stored.season,FPL_RULES.season);
  assert.deepEqual(stored.payload,payload);
  assert.deepEqual(await sget(K_CACHE),payload);
});

test('previous-season and unsupported-schema main cache records are rejected before use',async()=>{
  const prior=mainCacheEnvelope(currentCachePayload(),{season:'2025-26'});
  globalThis.localStorage.setItem(K_CACHE,JSON.stringify(prior));
  const seasonResult=await sgetResult(K_CACHE);
  assert.equal(seasonResult.ok,false);
  assert.equal(seasonResult.reason,'season_mismatch');
  assert.equal(await sget(K_CACHE),null);

  const unsupported={...mainCacheEnvelope(currentCachePayload()),schemaVersion:SCHEMA_VERSION+1};
  globalThis.localStorage.setItem(K_CACHE,JSON.stringify(unsupported));
  const schemaResult=await sgetResult(K_CACHE);
  assert.equal(schemaResult.ok,false);
  assert.equal(schemaResult.reason,'unsupported_schema');
});

test('legacy main cache is accepted only when its event deadlines verify the current season',()=>{
  assert.equal(legacyMainCacheMatchesSeason(currentCachePayload()),true);
  assert.equal(legacyMainCacheMatchesSeason(previousCachePayload()),false);
  assert.equal(decodeMainCacheRecord(currentCachePayload()).ok,true);
  assert.equal(decodeMainCacheRecord(previousCachePayload()).reason,'legacy_season_unverified');
});

test('malformed main cache JSON is rejected without throwing',async()=>{
  globalThis.localStorage.setItem(K_CACHE,'{broken');
  const result=await sgetResult(K_CACHE);
  assert.equal(result.ok,false);
  assert.equal(result.reason,'malformed');
  assert.equal(await sget(K_CACHE),null);
});

test('failed main cache replacement preserves the previous valid bytes',async()=>{
  const first=currentCachePayload();
  assert.equal((await ssetChecked(K_CACHE,first)).ok,true);
  const before=globalThis.localStorage.getItem(K_CACHE);
  globalThis.localStorage.failWrites=true;
  const second={...first,at:first.at+1000};
  const result=await ssetChecked(K_CACHE,second);
  assert.equal(result.ok,false);
  assert.equal(result.reason,'quota_or_unavailable');
  assert.equal(globalThis.localStorage.getItem(K_CACHE),before);
});

test('storage-manager read failure falls back to localStorage',async()=>{
  globalThis.localStorage.setItem('plain',JSON.stringify({value:7}));
  globalThis.window.storage={get:async()=>{throw new Error('manager unavailable');}};
  assert.deepEqual(await sget('plain'),{value:7});
});

test('local storage unavailability is explicit through the result-bearing read surface',async()=>{
  delete globalThis.localStorage;
  const result=await sgetResult('plain');
  assert.equal(result.ok,false);
  assert.equal(result.reason,'unavailable');
});

test('verified writes surface quota and read-back verification failures',async()=>{
  globalThis.localStorage.failWrites=true;
  assert.deepEqual(await ssetVerified('plain',{a:1}),{ok:false,reason:'quota_or_unavailable'});
  globalThis.localStorage.failWrites=false;
  globalThis.localStorage.lieOnRead=true;
  assert.deepEqual(await ssetVerified('plain',{a:1}),{ok:false,reason:'verify_failed'});
});

test('legacy configuration retains only season-independent preferences and removes account state',async()=>{
  globalThis.localStorage.setItem(K_CFG,JSON.stringify({
    teamId:'1234567',ft:4,bank:1.7,useManual:true,useUstat:false,transferHorizon:7,transferResults:9,
    oddsKey:'local-key',claudeKey:'deprecated-secret'
  }));
  const cfg=await loadCfg();
  assert.deepEqual(cfg,{useUstat:false,transferHorizon:7,transferResults:9,oddsKey:'local-key'});
  const stored=JSON.parse(globalThis.localStorage.getItem(K_CFG));
  assert.equal(stored.version,CONFIG_STATE_VERSION);
  assert.equal(stored.account,null);
  assert.equal(JSON.stringify(stored).includes('deprecated-secret'),false);
});

test('current config restores account fields while a previous-season account is dropped',()=>{
  const current=configEnvelope({teamId:'123',ft:2,bank:1.5,useManual:true,useUstat:true});
  assert.deepEqual(decodeConfigRecord(current).config,{useUstat:true,teamId:'123',ft:2,bank:1.5,useManual:true});
  const previous={...current,account:{...current.account,season:'2025-26'}};
  const decoded=decodeConfigRecord(previous);
  assert.equal(decoded.ok,true);
  assert.equal(decoded.reason,'account_season_mismatch');
  assert.deepEqual(decoded.config,{useUstat:true});
});

test('manual-mode persistence preserves the prior durable flag while a squad write is unresolved',()=>{
  const current={teamId:'1',ft:1,bank:0,useManual:true,useUstat:true};
  assert.equal(preserveManualModeForPersistence(current,{useManual:false},false).useManual,false);
  const withoutPrior=preserveManualModeForPersistence(current,{},false);
  assert.equal(Object.prototype.hasOwnProperty.call(withoutPrior,'useManual'),false);
});

test('manual squad writes are versioned and season-bound',async()=>{
  const squad=[{id:1,bought:45},{id:2,bought:50}];
  assert.equal((await ssetVerified(K_SQUAD,squad)).ok,true);
  const stored=JSON.parse(globalThis.localStorage.getItem(K_SQUAD));
  assert.equal(stored.recordType,MANUAL_SQUAD_RECORD_TYPE);
  assert.equal(stored.version,MANUAL_SQUAD_STATE_VERSION);
  assert.equal(stored.season,FPL_RULES.season);
  assert.deepEqual(await sget(K_SQUAD),squad);
  assert.equal(isManualSquadPersistenceReady(),true);
});

test('legacy and previous-season manual squads fail closed',async()=>{
  globalThis.localStorage.setItem(K_SQUAD,JSON.stringify([{id:1,bought:45}]));
  assert.equal(await sget(K_SQUAD),null);
  assert.equal(isManualSquadPersistenceReady(),false);
  const old=manualSquadEnvelope([{id:1,bought:45}],{season:'2025-26'});
  globalThis.localStorage.setItem(K_SQUAD,JSON.stringify(old));
  assert.equal(decodeManualSquadRecord(old).reason,'season_mismatch');
  assert.equal(await sget(K_SQUAD),null);
});

test('manual addition remains active in memory but skips config persistence when squad saving fails',async()=>{
  const manual=[];
  const player={id:1,element_type:1,team:1,web_name:'Keeper',now_cost:45};
  let configCalls=0;
  const result=await manualSquadCommitAddition({
    manual,player,byId:{1:player},
    persist:async()=>({ok:false,reason:'quota_or_unavailable'}),
    saveConfiguration:async()=>{configCalls++;return {ok:true};}
  });
  assert.equal(result.ok,true);
  assert.equal(manual.length,1);
  assert.equal(result.persistence.squad.ok,false);
  assert.equal(result.persistence.configuration.reason,'skipped_after_squad_failure');
  assert.equal(configCalls,0);
});

test('manual addition reports config partial failure only after a durable squad save',async()=>{
  const manual=[];
  const player={id:1,element_type:1,team:1,web_name:'Keeper',now_cost:45};
  const result=await manualSquadCommitAddition({
    manual,player,byId:{1:player},
    persist:async()=>({ok:true,via:'local'}),
    saveConfiguration:async()=>({ok:false,reason:'quota_or_unavailable'})
  });
  assert.equal(result.persistence.squad.ok,true);
  assert.equal(result.persistence.configuration.ok,false);
});

test('Mini-League persistence is explicitly versioned and season-bound',()=>{
  const state=normaliseMiniLeagueState({selectedLeagueId:'7',saved:[{id:'7',name:'Work'}]});
  assert.equal(MINI_LEAGUE_STATE_VERSION,3);
  assert.equal(state.version,3);
  assert.equal(state.season,FPL_RULES.season);
  assert.equal(miniLeagueStoredCompatibility(state).ok,true);
  assert.equal(miniLeagueStoredCompatibility({...state,season:'2025-26'}).reason,'season_mismatch');
});

test('season-unknown Mini-League state is not promoted; only current Official FPL discovery survives',()=>{
  const legacy={version:2,selectedLeagueId:'99',saved:[{id:'99',name:'Old league'}],pinnedRivals:{99:[{id:'4',name:'Old rival'}]}};
  const state=migrateMiniLeagueState({stored:legacy,entry:{leagues:{classic:[{id:7,name:'Current league'}]}}});
  assert.deepEqual(state.saved.map(row=>row.id),['7']);
  assert.equal(state.selectedLeagueId,'7');
  assert.deepEqual(state.pinnedRivals,{});
  assert.equal(state.season,FPL_RULES.season);
});

test('Mini-League write failure keeps the session state and preserves the prior durable bytes',async()=>{
  const prior=normaliseMiniLeagueState({selectedLeagueId:'7',saved:[{id:'7',name:'Prior'}]});
  globalThis.localStorage.setItem(K_MINI_LEAGUES,JSON.stringify(prior));
  const before=globalThis.localStorage.getItem(K_MINI_LEAGUES);
  S.miniLeagues=normaliseMiniLeagueState({selectedLeagueId:'8',saved:[{id:'8',name:'Session'}]});
  globalThis.localStorage.failWrites=true;
  const state=await persistMiniLeagueState();
  assert.equal(state.selectedLeagueId,'8');
  assert.equal(S.miniLeagues.selectedLeagueId,'8');
  assert.equal(globalThis.localStorage.getItem(K_MINI_LEAGUES),before);
});

test('forgetting the Odds key decodes and rewrites the versioned config through verified persistence',async()=>{
  assert.equal((await ssetVerified(K_CFG,{teamId:'123',ft:2,bank:1.4,useManual:false,useUstat:true,oddsKey:'sentinel'})).ok,true);
  const field={value:'sentinel'};
  const result=await forgetOddsKey({field});
  assert.equal(field.value,'');
  assert.deepEqual(result,{useUstat:true,teamId:'123',ft:2,bank:1.4,useManual:false});
  assert.deepEqual(await loadCfg(),result);
  const stored=JSON.parse(globalThis.localStorage.getItem(K_CFG));
  assert.equal(stored.version,CONFIG_STATE_VERSION);
  assert.equal(Object.prototype.hasOwnProperty.call(stored.preferences,'oddsKey'),false);
  assert.equal(JSON.stringify(stored).includes('sentinel'),false);
});

test('manual squad builder has no unchecked squad persistence path',()=>{
  const source=readFileSync(new URL('../src/ui/views.mjs',import.meta.url),'utf8');
  const manual=source.slice(source.indexOf('function renderManual()'),source.indexOf('/* ---------------------------------------------------------------------\n   RENDER + WIRING'));
  assert.doesNotMatch(manual,/\bsset\(K_SQUAD/);
  assert.equal((manual.match(/ssetVerified\(K_SQUAD/g)||[]).length,2);
  assert.match(manual,/const persisted = await ssetVerified\(K_SQUAD, S\.manual\);[\s\S]*if\(persisted\.ok\) await saveCfg\(\);/);
});
