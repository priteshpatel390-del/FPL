import { FPL_RULES } from '../config.mjs';
import { S } from '../state.mjs';
import { sgetResult, ssetVerified, setPersistenceWarning, clearPersistenceWarning } from '../storage.mjs';

const MINI_LEAGUE_STATE_VERSION = 3;
const K_MINI_LEAGUES = 'fpl:mini-leagues';
const K_LEGACY_LEAGUES = 'fpl:leagues';
const MAX_PINNED_RIVALS = 5;
const MAX_COMPARISON_RIVALS = 5;

function miniLeagueId(value){
  const id=String(value??'').replace(/\D/g,'');
  return id && id.length<=12 && Number(id)>0 ? id : '';
}
function miniLeagueText(value,max=100){ return typeof value==='string' ? value.trim().slice(0,max) : ''; }
function miniLeagueRecord(value={}){
  const id=miniLeagueId(value.id??value.leagueId);
  if(!id) return null;
  return {id,name:miniLeagueText(value.name??value.localName,100),primary:Boolean(value.primary)};
}
function miniLeagueRivalRecord(value={}){
  const id=miniLeagueId(value.id??value.entry);
  if(!id) return null;
  return {id,name:miniLeagueText(value.name??value.entry_name??value.player_name,100)};
}
function uniqueLeagueRecords(values=[]){
  const map=new Map();
  values.forEach(value=>{
    const row=miniLeagueRecord(value); if(!row) return;
    const previous=map.get(row.id);
    if(previous) map.set(row.id,{...previous,name:previous.name||row.name,primary:previous.primary||row.primary});
    else map.set(row.id,row);
  });
  return [...map.values()];
}
function uniqueRivalRecords(values=[],limit=MAX_COMPARISON_RIVALS){
  const rows=[]; const seen=new Set();
  (Array.isArray(values)?values:[]).forEach(value=>{
    const row=miniLeagueRivalRecord(value);
    if(row&&!seen.has(row.id)&&rows.length<limit){seen.add(row.id);rows.push(row);}
  });
  return rows;
}
function emptyMiniLeagueState(){
  return {version:MINI_LEAGUE_STATE_VERSION,season:FPL_RULES.season,selectedLeagueId:'',selectedRivalByLeague:{},comparisonRivalsByLeague:{},saved:[],pinnedRivals:{}};
}
function normaliseMiniLeagueState(value={}){
  const base=emptyMiniLeagueState();
  if(!value||typeof value!=='object'||Array.isArray(value)) return base;
  const saved=uniqueLeagueRecords(value.saved);
  let selectedLeagueId=miniLeagueId(value.selectedLeagueId);
  if(selectedLeagueId&&!saved.some(row=>row.id===selectedLeagueId)) saved.unshift({id:selectedLeagueId,name:'',primary:false});
  if(!selectedLeagueId) selectedLeagueId=saved.find(row=>row.primary)?.id||saved[0]?.id||'';
  const selectedRivalByLeague={};
  for(const [leagueId,rivalId] of Object.entries(value.selectedRivalByLeague||{})){
    const lid=miniLeagueId(leagueId),rid=miniLeagueId(rivalId); if(lid&&rid) selectedRivalByLeague[lid]=rid;
  }
  const pinnedRivals={};
  for(const [leagueId,rivals] of Object.entries(value.pinnedRivals||{})){
    const lid=miniLeagueId(leagueId); if(!lid) continue;
    const rows=uniqueRivalRecords(rivals,MAX_PINNED_RIVALS); if(rows.length) pinnedRivals[lid]=rows;
  }
  const comparisonRivalsByLeague={};
  for(const [leagueId,rivals] of Object.entries(value.comparisonRivalsByLeague||{})){
    const lid=miniLeagueId(leagueId); if(!lid) continue;
    const rows=uniqueRivalRecords(rivals,MAX_COMPARISON_RIVALS); if(rows.length) comparisonRivalsByLeague[lid]=rows;
  }
  if(saved.some(row=>row.primary)){
    let seenPrimary=false;
    saved.forEach(row=>{ if(row.primary&&!seenPrimary) seenPrimary=true; else row.primary=false; });
  }
  return {version:MINI_LEAGUE_STATE_VERSION,season:FPL_RULES.season,selectedLeagueId,selectedRivalByLeague,comparisonRivalsByLeague,saved,pinnedRivals};
}
function entryClassicLeagues(entry=S.entry){
  const rows=entry?.leagues?.classic;
  if(!Array.isArray(rows)) return [];
  return uniqueLeagueRecords(rows.map(row=>({id:row.id,name:row.name,primary:false})));
}
function miniLeagueStoredCompatibility(stored,season=FPL_RULES.season){
  if(!stored||typeof stored!=='object'||Array.isArray(stored)) return {ok:false,reason:'missing'};
  if(stored.version!==MINI_LEAGUE_STATE_VERSION) return {ok:false,reason:'unsupported_or_legacy_version'};
  if(stored.season!==season) return {ok:false,reason:'season_mismatch'};
  return {ok:true,state:normaliseMiniLeagueState(stored)};
}
function migrateMiniLeagueState({stored,legacyConfig,legacyLeagues,entry}={}){
  const compatible=miniLeagueStoredCompatibility(stored);
  if(compatible.ok) return compatible.state;
  const discovered=entryClassicLeagues(entry);
  return normaliseMiniLeagueState({saved:discovered,selectedLeagueId:discovered[0]?.id||''});
}

/* `S.miniLeagues` is the only writable runtime preference representation.
   `S.leagues` remains as a read-only compatibility bridge for legacy readers;
   assigning to it cannot replace canonical preferences after initialisation. */
function installMiniLeagueAlias(){
  Object.defineProperty(S,'leagues',{
    enumerable:true,
    configurable:true,
    get(){ return Array.isArray(S.miniLeagues?.saved) ? S.miniLeagues.saved : []; },
    set(){ /* legacy compatibility writes are intentionally ignored */ }
  });
}
function syncMiniLeagueAlias(){ return S.leagues; }
async function persistMiniLeagueState(options={}){
  const state=normaliseMiniLeagueState(S.miniLeagues);
  S.miniLeagues=state;
  syncMiniLeagueAlias();
  const result=await ssetVerified(K_MINI_LEAGUES,state);
  if(result.ok) clearPersistenceWarning('mini-leagues');
  else setPersistenceWarning('mini-leagues','Mini-League changes are active for this session, but Teamsheet could not save them on this device. They may revert after reload.');
  return options.withResult?{state,result}:state;
}
async function initMiniLeagueState(legacyConfig={}){
  const storedResult=await sgetResult(K_MINI_LEAGUES);
  const legacyResult=await sgetResult(K_LEGACY_LEAGUES);
  const stored=storedResult.ok&&storedResult.found?storedResult.value:null;
  const legacyLeagues=legacyResult.ok&&legacyResult.found?legacyResult.value:null;
  const compatibility=miniLeagueStoredCompatibility(stored);
  S.miniLeagues=migrateMiniLeagueState({stored,legacyConfig,legacyLeagues,entry:S.entry});
  syncMiniLeagueAlias();
  const persisted=await persistMiniLeagueState({withResult:true});
  if(persisted.result.ok&&((storedResult.found&&!compatibility.ok)||(!storedResult.ok&&storedResult.reason==='malformed')))
    setPersistenceWarning('mini-leagues','Saved Mini-League and rival preferences could not be verified for the current season and were not restored. Current leagues will be rediscovered from Official FPL.');
  return S.miniLeagues;
}
async function mergeDiscoveredMiniLeagues(entry=S.entry){
  const state=normaliseMiniLeagueState(S.miniLeagues);
  const discovered=entryClassicLeagues(entry);
  const names=new Map(discovered.map(row=>[row.id,row.name]));
  state.saved=uniqueLeagueRecords([...state.saved,...discovered]).map(row=>({...row,name:row.name||names.get(row.id)||''}));
  if(!state.selectedLeagueId) state.selectedLeagueId=state.saved.find(row=>row.primary)?.id||state.saved[0]?.id||'';
  S.miniLeagues=state; return persistMiniLeagueState();
}
function selectedMiniLeague(){
  const state=normaliseMiniLeagueState(S.miniLeagues);
  return state.saved.find(row=>row.id===state.selectedLeagueId)||null;
}
function miniLeagueMembership(leagueId,entry=S.entry){
  const id=miniLeagueId(leagueId);
  return (entry?.leagues?.classic||[]).find(row=>miniLeagueId(row?.id)===id)||null;
}
async function upsertMiniLeague(id,name='',options={}){
  id=miniLeagueId(id); if(!id) return null;
  const state=normaliseMiniLeagueState(S.miniLeagues);
  const existing=state.saved.find(row=>row.id===id);
  if(existing){ if(miniLeagueText(name)) existing.name=miniLeagueText(name); }
  else state.saved.push({id,name:miniLeagueText(name),primary:false});
  if(options.primary){ state.saved.forEach(row=>row.primary=row.id===id); }
  if(options.select!==false) state.selectedLeagueId=id;
  S.miniLeagues=state; await persistMiniLeagueState(); return selectedMiniLeague();
}
async function rememberLeague(id,name){ return upsertMiniLeague(id,name,{select:true}); }
async function selectMiniLeague(id){ return upsertMiniLeague(id,'',{select:true}); }
async function removeMiniLeague(id){
  id=miniLeagueId(id); const state=normaliseMiniLeagueState(S.miniLeagues);
  state.saved=state.saved.filter(row=>row.id!==id); delete state.selectedRivalByLeague[id]; delete state.pinnedRivals[id]; delete state.comparisonRivalsByLeague[id];
  if(state.selectedLeagueId===id) state.selectedLeagueId=state.saved.find(row=>row.primary)?.id||state.saved[0]?.id||'';
  S.miniLeagues=state; return persistMiniLeagueState();
}
async function selectMiniLeagueRival(leagueId,rival){
  const lid=miniLeagueId(leagueId),row=miniLeagueRivalRecord(rival); if(!lid||!row) return null;
  const state=normaliseMiniLeagueState(S.miniLeagues); state.selectedRivalByLeague[lid]=row.id; S.miniLeagues=state; await persistMiniLeagueState(); return row;
}
async function togglePinnedMiniLeagueRival(leagueId,rival){
  const lid=miniLeagueId(leagueId),row=miniLeagueRivalRecord(rival); if(!lid||!row) return false;
  const state=normaliseMiniLeagueState(S.miniLeagues); const rows=state.pinnedRivals[lid]||[]; const index=rows.findIndex(item=>item.id===row.id);
  if(index>=0) rows.splice(index,1); else if(rows.length<MAX_PINNED_RIVALS) rows.push(row); else return false;
  if(rows.length) state.pinnedRivals[lid]=rows; else delete state.pinnedRivals[lid];
  S.miniLeagues=state; await persistMiniLeagueState(); return index<0;
}
async function setMiniLeagueComparisonRivals(leagueId,rivals){
  const lid=miniLeagueId(leagueId); if(!lid) return [];
  const state=normaliseMiniLeagueState(S.miniLeagues),rows=uniqueRivalRecords(rivals,MAX_COMPARISON_RIVALS);
  if(rows.length) state.comparisonRivalsByLeague[lid]=rows; else delete state.comparisonRivalsByLeague[lid];
  S.miniLeagues=state; await persistMiniLeagueState(); return rows;
}
async function clearMiniLeagueComparisonRivals(leagueId){ return setMiniLeagueComparisonRivals(leagueId,[]); }
function miniLeagueSelectedRivalId(leagueId){ return normaliseMiniLeagueState(S.miniLeagues).selectedRivalByLeague[miniLeagueId(leagueId)]||''; }
function miniLeaguePinnedRivals(leagueId){ return normaliseMiniLeagueState(S.miniLeagues).pinnedRivals[miniLeagueId(leagueId)]||[]; }
function miniLeagueComparisonRivals(leagueId){ return normaliseMiniLeagueState(S.miniLeagues).comparisonRivalsByLeague[miniLeagueId(leagueId)]||[]; }

S.miniLeagues=emptyMiniLeagueState();
installMiniLeagueAlias();
export { MINI_LEAGUE_STATE_VERSION, K_MINI_LEAGUES, MAX_PINNED_RIVALS, MAX_COMPARISON_RIVALS, miniLeagueId, miniLeagueRecord, miniLeagueRivalRecord, uniqueRivalRecords, normaliseMiniLeagueState, miniLeagueStoredCompatibility, entryClassicLeagues, migrateMiniLeagueState, initMiniLeagueState, mergeDiscoveredMiniLeagues, persistMiniLeagueState, selectedMiniLeague, miniLeagueMembership, upsertMiniLeague, rememberLeague, selectMiniLeague, removeMiniLeague, selectMiniLeagueRival, togglePinnedMiniLeagueRival, setMiniLeagueComparisonRivals, clearMiniLeagueComparisonRivals, miniLeagueSelectedRivalId, miniLeaguePinnedRivals, miniLeagueComparisonRivals };
