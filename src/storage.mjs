import { $, num } from './util.mjs';
import { SCHEMA_VERSION, FPL_RULES } from './config.mjs';
/* ---------------------------------------------------------------------
   STORAGE
   --------------------------------------------------------------------- */
const K_CFG = 'fpl:config', K_SQUAD = 'fpl:squad', K_CACHE = 'fpl:cache', K_CAL = 'fpl:calib',
  K_MINUTES = 'fpl:minutes-history', K_UNDERSTAT = 'fpl:understat-team-inputs', K_ODDS = 'fpl:odds-derived-inputs';

const MAIN_CACHE_VERSION = 1;
const CONFIG_STATE_VERSION = 1;
const MANUAL_SQUAD_STATE_VERSION = 1;
const MAIN_CACHE_RECORD_TYPE = 'teamsheet.main-fpl-cache';
const MANUAL_SQUAD_RECORD_TYPE = 'teamsheet.manual-squad';
const persistenceWarnings = new Map();
let manualSquadPersistenceReady = true;

function persistenceWarningSnapshot(){ return Object.fromEntries(persistenceWarnings); }
function renderPersistenceWarnings(documentRef=globalThis.document){
  if(!documentRef?.getElementById || !documentRef?.createElement) return;
  const messages=[...persistenceWarnings.values()].filter(Boolean);
  let node=documentRef.getElementById('persistenceStatus');
  if(!messages.length){ if(node) node.hidden=true; return; }
  if(!node){
    node=documentRef.createElement('div');
    if(!node) return;
    node.id='persistenceStatus';
    node.className='note bad';
    node.setAttribute?.('role','status');
    node.setAttribute?.('aria-live','polite');
    node.setAttribute?.('aria-atomic','true');
    const host=documentRef.querySelector?.('main')||documentRef.body;
    if(typeof host?.prepend==='function') host.prepend(node);
    else if(typeof host?.insertBefore==='function') host.insertBefore(node,host.firstChild||null);
    else return;
  }
  node.hidden=false;
  node.textContent=messages.join(' ');
}
function setPersistenceWarning(scope,message,documentRef=globalThis.document){
  if(scope&&message) persistenceWarnings.set(String(scope),String(message));
  renderPersistenceWarnings(documentRef);
}
function clearPersistenceWarning(scope,documentRef=globalThis.document){
  persistenceWarnings.delete(String(scope));
  renderPersistenceWarnings(documentRef);
}

function currentSeasonYears(season=FPL_RULES.season){
  const match=/^(\d{4})-(\d{2})$/.exec(String(season||''));
  if(!match) return null;
  const start=Number(match[1]);
  let end=Math.floor(start/100)*100+Number(match[2]);
  if(end<start) end+=100;
  return Number.isInteger(start)&&Number.isInteger(end)&&end===start+1?{start,end}:null;
}
function knownLegacyMainCacheShape(value){
  return Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&Number.isFinite(Number(value.at))&&
    Array.isArray(value.events)&&Array.isArray(value.teams)&&Array.isArray(value.element_types)&&
    Array.isArray(value.elements)&&Array.isArray(value.fixtures));
}
function legacyMainCacheMatchesSeason(value,season=FPL_RULES.season){
  const years=currentSeasonYears(season);
  if(!years||!knownLegacyMainCacheShape(value)||!value.events.length) return false;
  const deadlineYears=value.events.map(event=>{
    const time=Date.parse(event?.deadline_time||'');
    return Number.isFinite(time)?new Date(time).getUTCFullYear():null;
  }).filter(Number.isInteger);
  if(!deadlineYears.length) return false;
  return deadlineYears.every(year=>year===years.start||year===years.end)&&deadlineYears.includes(years.start);
}
function mainCacheEnvelope(payload,{season=FPL_RULES.season,now=Date.now()}={}){
  return {
    recordType:MAIN_CACHE_RECORD_TYPE,
    cacheVersion:MAIN_CACHE_VERSION,
    schemaVersion:SCHEMA_VERSION,
    season,
    fetchedAt:Number.isFinite(Number(payload?.at))?Number(payload.at):now,
    payload
  };
}
function decodeMainCacheRecord(value,{season=FPL_RULES.season}={}){
  if(value?.recordType===MAIN_CACHE_RECORD_TYPE){
    if(value.cacheVersion!==MAIN_CACHE_VERSION) return {ok:false,reason:'unsupported_version'};
    if(value.schemaVersion!==SCHEMA_VERSION) return {ok:false,reason:'unsupported_schema'};
    if(value.season!==season) return {ok:false,reason:'season_mismatch'};
    if(!value.payload||typeof value.payload!=='object'||Array.isArray(value.payload)) return {ok:false,reason:'invalid_payload'};
    return {ok:true,value:value.payload,legacy:false};
  }
  if(knownLegacyMainCacheShape(value)){
    if(legacyMainCacheMatchesSeason(value,season)) return {ok:true,value,legacy:true};
    return {ok:false,reason:'legacy_season_unverified'};
  }
  return {ok:false,reason:'invalid_payload'};
}

function manualSquadEnvelope(value,{season=FPL_RULES.season}={}){
  if(!Array.isArray(value)) return null;
  const players=[];
  for(const entry of value){
    const id=Number(entry?.id),bought=Number(entry?.bought);
    if(!Number.isInteger(id)||id<=0||!Number.isFinite(bought)||bought<0) return null;
    players.push({id,bought:Math.trunc(bought)});
  }
  return {recordType:MANUAL_SQUAD_RECORD_TYPE,version:MANUAL_SQUAD_STATE_VERSION,season,players};
}
function decodeManualSquadRecord(value,{season=FPL_RULES.season}={}){
  if(Array.isArray(value)) return {ok:false,reason:'legacy_unversioned'};
  if(!value||typeof value!=='object'||value.recordType!==MANUAL_SQUAD_RECORD_TYPE) return {ok:false,reason:'invalid_payload'};
  if(value.version!==MANUAL_SQUAD_STATE_VERSION) return {ok:false,reason:'unsupported_version'};
  if(value.season!==season) return {ok:false,reason:'season_mismatch'};
  const envelope=manualSquadEnvelope(value.players,{season});
  if(!envelope) return {ok:false,reason:'invalid_payload'};
  return {ok:true,value:envelope.players};
}

function stripDeprecatedSecrets(value){
  if(!value || typeof value !== 'object' || Array.isArray(value) ||
     !Object.prototype.hasOwnProperty.call(value, 'claudeKey'))
    return { config:value, changed:false };
  const config = { ...value };
  delete config.claudeKey;
  return { config, changed:true };
}
function own(value,key){ return Object.prototype.hasOwnProperty.call(value||{},key); }
function configPreferences(value={}){
  const out={};
  if(own(value,'useUstat')&&typeof value.useUstat==='boolean') out.useUstat=value.useUstat;
  if(own(value,'transferHorizon')&&Number.isFinite(Number(value.transferHorizon))) out.transferHorizon=Number(value.transferHorizon);
  if(own(value,'transferResults')&&Number.isFinite(Number(value.transferResults))) out.transferResults=Number(value.transferResults);
  if(own(value,'oddsKey')&&typeof value.oddsKey==='string'&&value.oddsKey.trim()) out.oddsKey=value.oddsKey.trim();
  return out;
}
function configAccount(value={},season=FPL_RULES.season){
  const out={season};
  let fields=0;
  if(own(value,'teamId')){ out.teamId=String(value.teamId??'').replace(/\D/g,''); fields++; }
  if(own(value,'ft')&&Number.isFinite(Number(value.ft))){ out.ft=Number(value.ft); fields++; }
  if(own(value,'bank')&&Number.isFinite(Number(value.bank))){ out.bank=Number(value.bank); fields++; }
  if(own(value,'useManual')&&typeof value.useManual==='boolean'){ out.useManual=value.useManual; fields++; }
  return fields?out:null;
}
function configEnvelope(value={},season=FPL_RULES.season){
  if(!value||typeof value!=='object'||Array.isArray(value)) return null;
  return {version:CONFIG_STATE_VERSION,preferences:configPreferences(value),account:configAccount(value,season)};
}
function decodeConfigAccount(account,season=FPL_RULES.season){
  if(account===null||account===undefined) return {ok:true,value:{}};
  if(!account||typeof account!=='object'||Array.isArray(account)) return {ok:false,reason:'account_invalid'};
  if(account.season!==season) return {ok:false,reason:'account_season_mismatch'};
  const out={};
  if(own(account,'teamId')){
    const id=String(account.teamId??'');
    if(!/^\d*$/.test(id)) return {ok:false,reason:'account_invalid'};
    out.teamId=id;
  }
  if(own(account,'ft')){
    const ft=Number(account.ft);
    if(!Number.isInteger(ft)||ft<0||ft>5) return {ok:false,reason:'account_invalid'};
    out.ft=ft;
  }
  if(own(account,'bank')){
    const bank=Number(account.bank);
    if(!Number.isFinite(bank)||bank<0) return {ok:false,reason:'account_invalid'};
    out.bank=bank;
  }
  if(own(account,'useManual')){
    if(typeof account.useManual!=='boolean') return {ok:false,reason:'account_invalid'};
    out.useManual=account.useManual;
  }
  return {ok:true,value:out};
}
function decodeConfigRecord(value,{season=FPL_RULES.season}={}){
  if(!value||typeof value!=='object'||Array.isArray(value)) return {ok:false,reason:'invalid_payload',config:null};
  if(own(value,'version')){
    if(value.version!==CONFIG_STATE_VERSION) return {ok:false,reason:'unsupported_version',config:null};
    const preferences=configPreferences(value.preferences||{});
    const account=decodeConfigAccount(value.account,season);
    return account.ok
      ? {ok:true,config:{...preferences,...account.value},reason:null,legacy:false}
      : {ok:true,config:preferences,reason:account.reason,legacy:false};
  }
  const migrated=stripDeprecatedSecrets(value);
  return {ok:true,config:configPreferences(migrated.config||{}),reason:'legacy_unversioned',legacy:true,secretRemoved:migrated.changed};
}
function preserveManualModeForPersistence(config,previous={},ready=manualSquadPersistenceReady){
  if(ready||!config||typeof config!=='object'||!own(config,'useManual')) return {...config};
  const next={...config};
  if(own(previous,'useManual')) next.useManual=Boolean(previous.useManual);
  else delete next.useManual;
  return next;
}
function setManualSquadPersistenceReady(value){ manualSquadPersistenceReady=Boolean(value); }
function isManualSquadPersistenceReady(){ return manualSquadPersistenceReady; }

async function rawStoredText(key){
  if(globalThis.window?.storage){
    try{
      const result=await globalThis.window.storage.get(key);
      const text=result?.value;
      return {ok:true,found:text!==null&&text!==undefined,text:text??null,via:'manager'};
    }catch(error){}
  }
  try{
    if(!globalThis.localStorage||typeof globalThis.localStorage.getItem!=='function') return {ok:false,found:false,text:null,reason:'unavailable'};
    const text=globalThis.localStorage.getItem(key);
    return {ok:true,found:text!==null&&text!==undefined,text:text??null,via:'local'};
  }catch(error){ return {ok:false,found:false,text:null,reason:'unavailable'}; }
}
/* A3 — authoritative-backend durability.
   rawStoredText() only consults localStorage when the storage manager read is
   itself unusable. So after a manager write failure a localStorage copy is
   restorable only when the manager cannot serve the read either; otherwise the
   copy is divergent and permanently invisible to every later read. This probe
   asks the real read order which backend is authoritative for the key, so a
   fallback is only attempted — and only reported as saved — when the value can
   actually be read back. */
async function localFallbackReachable(key){
  const probe=await rawStoredText(key);
  return probe.via==='local';
}
async function readStoredJson(key){
  const raw=await rawStoredText(key);
  if(!raw.ok||!raw.found) return {...raw,value:null};
  try{ return {...raw,value:JSON.parse(raw.text)}; }
  catch(error){ return {...raw,ok:false,value:null,reason:'malformed'}; }
}
function decodeStoredValue(key,value){
  if(key===K_CACHE) return decodeMainCacheRecord(value);
  if(key===K_SQUAD) return decodeManualSquadRecord(value);
  return {ok:true,value};
}
async function sgetResult(key){
  const read=await readStoredJson(key);
  if(!read.ok||!read.found) return read;
  const decoded=decodeStoredValue(key,read.value);
  return {...read,...decoded};
}
function reportReadResult(key,result){
  if(key===K_CACHE){
    if(result.ok){ clearPersistenceWarning('cache'); return; }
    if(result.found||result.reason==='malformed')
      setPersistenceWarning('cache','Saved Official FPL data could not be verified for the current season and was ignored. Teamsheet will use live data if available.');
    return;
  }
  if(key===K_SQUAD){
    if(result.ok&&result.found){ setManualSquadPersistenceReady(true); clearPersistenceWarning('manual-squad'); return; }
    setManualSquadPersistenceReady(false);
    const manualControl=globalThis.document?.getElementById?.('useManual');
    const manualRequested=Boolean(manualControl?.checked);
    if(manualRequested) manualControl.checked=false;
    if(manualRequested){
      setPersistenceWarning('manual-squad','Manual team mode was disabled because no compatible current-season manual squad could be restored. Official FPL picks will be used where available.');
    }else if(result.found||result.reason==='malformed'){
      setPersistenceWarning('manual-squad','A saved manual squad could not be verified for the current season and was not restored. Rebuild or resave it before relying on it after reload.');
    }
  }
}
async function sget(key){
  const result=await sgetResult(key);
  reportReadResult(key,result);
  return result.ok&&result.found?result.value:null;
}
async function sset(key, val){
  const s = JSON.stringify(val);
  if(window.storage){ try{ await window.storage.set(key, s); return; }catch(e){} }
  try{ localStorage.setItem(key, s); }catch(e){}
}

function checkedStoredValue(key,val){
  if(key===K_CACHE) return {ok:true,value:mainCacheEnvelope(val)};
  if(key===K_SQUAD){
    const record=manualSquadEnvelope(val);
    return record?{ok:true,value:record}:{ok:false,reason:'invalid_value'};
  }
  if(key===K_CFG){
    const record=configEnvelope(val);
    return record?{ok:true,value:record}:{ok:false,reason:'invalid_value'};
  }
  return {ok:true,value:val};
}
function checkedSerialisation(key,val){
  const prepared=checkedStoredValue(key,val);
  if(!prepared.ok) return prepared;
  try{ return {ok:true,text:JSON.stringify(prepared.value),value:prepared.value}; }
  catch(error){ return {ok:false,reason:'serialise'}; }
}
function reportCacheWriteResult(result){
  if(result.ok) clearPersistenceWarning('cache');
  else setPersistenceWarning('cache','Fresh Official FPL data is active for this session, but Teamsheet could not update the saved offline copy. A reload may fall back to older saved data.');
}

/* R3.1 B4 / R3.2 C7 — a separate refresh-only write surface. sset() above is
   deliberately untouched, including JSON.stringify outside every guard, so no
   existing caller's behaviour changes. The refresh persistence phase needs a
   reportable outcome instead: an unobservable failure cannot be classified as
   persist_failed. The small duplication is the price of that guarantee. */
async function ssetChecked(key, val){
  const serialised=checkedSerialisation(key,val);
  if(!serialised.ok){
    const result={ok:false,reason:serialised.reason};
    if(key===K_CACHE) reportCacheWriteResult(result);
    return result;
  }
  const s=serialised.text;
  let result;
  if(globalThis.window?.storage){
    try{ await globalThis.window.storage.set(key, s); result={ok:true,via:'manager'}; }
    catch(e){ if(!await localFallbackReachable(key)) result={ok:false,reason:'manager_write_failed'}; }
  }
  if(!result){
    try{ globalThis.localStorage.setItem(key, s); result={ok:true,via:'local'}; }
    catch(e){ result={ok:false,reason:'quota_or_unavailable'}; }
  }
  if(key===K_CACHE) reportCacheWriteResult(result);
  return result;
}

async function ssetVerified(key,val){
  const serialised=checkedSerialisation(key,val);
  if(!serialised.ok){
    const result={ok:false,reason:serialised.reason};
    if(key===K_SQUAD){ setManualSquadPersistenceReady(false); setPersistenceWarning('manual-squad','The manual-squad change is active for this session, but Teamsheet could not save it. It may revert after reload.'); }
    return result;
  }
  const text=serialised.text;
  const manager=globalThis.window?.storage;
  if(manager){
    try{
      await manager.set(key,text);
      const verified=await manager.get(key);
      if(verified?.value===text){
        const result={ok:true,via:'manager'};
        if(key===K_SQUAD){ setManualSquadPersistenceReady(true); clearPersistenceWarning('manual-squad'); }
        return result;
      }
      const result={ok:false,reason:'verify_failed'};
      if(key===K_SQUAD){ setManualSquadPersistenceReady(false); setPersistenceWarning('manual-squad','The manual-squad change is active for this session, but Teamsheet could not verify that it was saved. It may revert after reload.'); }
      return result;
    }catch(error){
      if(!await localFallbackReachable(key)){
        const result={ok:false,reason:'manager_unverified'};
        if(key===K_SQUAD){ setManualSquadPersistenceReady(false); setPersistenceWarning('manual-squad','The manual-squad change is active for this session, but Teamsheet could not verify that it was saved. It may revert after reload.'); }
        return result;
      }
    }
  }
  try{
    if(!globalThis.localStorage||typeof globalThis.localStorage.setItem!=='function'||typeof globalThis.localStorage.getItem!=='function') throw new Error('unavailable');
    globalThis.localStorage.setItem(key,text);
    if(globalThis.localStorage.getItem(key)!==text){
      const result={ok:false,reason:'verify_failed'};
      if(key===K_SQUAD){ setManualSquadPersistenceReady(false); setPersistenceWarning('manual-squad','The manual-squad change is active for this session, but Teamsheet could not verify that it was saved. It may revert after reload.'); }
      return result;
    }
    const result={ok:true,via:'local'};
    if(key===K_SQUAD){ setManualSquadPersistenceReady(true); clearPersistenceWarning('manual-squad'); }
    return result;
  }catch(error){
    const result={ok:false,reason:'quota_or_unavailable'};
    if(key===K_SQUAD){ setManualSquadPersistenceReady(false); setPersistenceWarning('manual-squad','The manual-squad change is active for this session, but Teamsheet could not save it on this device. It may revert after reload.'); }
    return result;
  }
}

async function loadCfg(){
  const read=await readStoredJson(K_CFG);
  if(!read.ok){
    if(read.reason==='malformed') setPersistenceWarning('configuration-compatibility','Saved settings were unreadable and were not restored. Re-enter any season/account values you still need.');
    else if(read.reason==='unavailable') setPersistenceWarning('configuration','Browser storage is unavailable. Settings changes can work for this session but may revert after reload.');
    return null;
  }
  if(!read.found) return null;
  const decoded=decodeConfigRecord(read.value);
  if(!decoded.ok){
    setPersistenceWarning('configuration-compatibility','Saved settings use an unsupported format and were not restored. Re-enter any season/account values you still need.');
    return null;
  }
  if(decoded.legacy){
    setPersistenceWarning('configuration-compatibility','Older unversioned team/account values could not be verified for the current season and were not restored. Re-enter your Team ID and current resources if needed.');
    const write=await ssetVerified(K_CFG,decoded.config);
    if(!write.ok) setPersistenceWarning('configuration','Season-independent settings were recovered, but Teamsheet could not save the upgraded settings record. Changes may revert after reload.');
  }else if(decoded.reason==='account_season_mismatch'){
    setPersistenceWarning('configuration-compatibility','Saved team/account values belong to another season and were not restored. Season-independent settings were kept.');
  }else if(decoded.reason==='account_invalid'){
    setPersistenceWarning('configuration-compatibility','Saved team/account values were invalid and were not restored. Season-independent settings were kept.');
  }
  return decoded.config;
}
function currentConfig(){
  const config = {
    teamId: $('teamId').value.replace(/\D/g,''),
    ft: num($('ftCount').value),
    bank: num($('bankIn').value),
    useManual: $('useManual').checked,
    useUstat: $('useUstat').checked,
    transferHorizon: Number($('trHorizon')?.value || 6),
    transferResults: Number($('trTop')?.value || 8)
  };
  const oddsKey = $('oddsKey').value.trim();
  if(oddsKey) config.oddsKey = oddsKey;
  return config;
}
async function previousPersistedConfig(){
  const read=await readStoredJson(K_CFG);
  if(!read.ok||!read.found) return {};
  const decoded=decodeConfigRecord(read.value);
  return decoded.ok?decoded.config||{}:{};
}
async function saveCfg(){
  const previous=manualSquadPersistenceReady?{}:await previousPersistedConfig();
  const config=preserveManualModeForPersistence(currentConfig(),previous,manualSquadPersistenceReady);
  const result=await ssetVerified(K_CFG,config);
  if(result.ok) clearPersistenceWarning('configuration');
  else setPersistenceWarning('configuration','Settings changed for this session, but Teamsheet could not save them on this device. They may revert after reload.');
  return result;
}

export {
  K_CFG, K_SQUAD, K_CACHE, K_CAL, K_MINUTES, K_UNDERSTAT, K_ODDS,
  MAIN_CACHE_VERSION, CONFIG_STATE_VERSION, MANUAL_SQUAD_STATE_VERSION,
  MAIN_CACHE_RECORD_TYPE, MANUAL_SQUAD_RECORD_TYPE,
  sget, sgetResult, sset, ssetChecked, ssetVerified, saveCfg, currentConfig,
  stripDeprecatedSecrets, loadCfg, mainCacheEnvelope, decodeMainCacheRecord, legacyMainCacheMatchesSeason,
  manualSquadEnvelope, decodeManualSquadRecord, configEnvelope, decodeConfigRecord,
  preserveManualModeForPersistence, setManualSquadPersistenceReady, isManualSquadPersistenceReady,
  setPersistenceWarning, clearPersistenceWarning, persistenceWarningSnapshot
};

export async function cachePut(key, payload, season){
  await sset(key, { schemaVersion: SCHEMA_VERSION, season, fetchedAt: Date.now(), payload });
}
export async function cacheGet(key, season){
  const env = await sget(key);
  if(!env || typeof env !== 'object') return null;
  if(env.schemaVersion !== SCHEMA_VERSION) return null;
  if(season && env.season && env.season !== season) return null;
  return env.payload ?? null;
}