import { S } from '../state.mjs';
import { sget, sset } from '../storage.mjs';

const MINI_LEAGUE_STATE_VERSION = 2;
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
  return {version:MINI_LEAGUE_STATE_VERSION,selectedLeagueId:'',selectedRivalByLeague:{},comparisonRivalsByLeague:{},saved:[],pinnedRivals:{}};
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
  return {version:MINI_LEAGUE_STATE_VERSION,selectedLeagueId,selectedRivalByLeague,comparisonRivalsByLeague,saved,pinnedRivals};
}
function entryClassicLeagues(entry=S.entry){
  const rows=entry?.leagues?.classic;
  if(!Array.isArray(rows)) return [];
  return uniqueLeagueRecords(rows.map(row=>({id:row.id,name:row.name,primary:false})));
}
function migrateMiniLeagueState({stored,legacyConfig,legacyLeagues,entry}={}){
  if(stored?.version===MINI_LEAGUE_STATE_VERSION) return normaliseMiniLeagueState(stored);
  if(stored?.version===1) return normaliseMiniLeagueState({...stored,version:MINI_LEAGUE_STATE_VERSION,comparisonRivalsByLeague:{}});
  const discovered=entryClassicLeagues(entry);
  const saved=uniqueLeagueRecords([...(Array.isArray(legacyLeagues)?legacyLeagues:[]),...discovered]);
  const legacySelected=miniLeagueId(legacyConfig?.leagueId);
  if(legacySelected&&!saved.some(row=>row.id===legacySelected)) saved.unshift({id:legacySelected,name:'',primary:false});
  return normaliseMiniLeagueState({version:MINI_LEAGUE_STATE_VERSION,selectedLeagueId:legacySelected||saved[0]?.id||'',saved});
}
function syncMiniLeagueAlias(){ S.leagues=S.miniLeagues.saved; }
async function persistMiniLeagueState(){
  const state=normaliseMiniLeagueState(S.miniLeagues);
  S.miniLeagues=state; syncMiniLeagueAlias(); await sset(K_MINI_LEAGUES,state); return state;
}
async function initMiniLeagueState(legacyConfig={}){
  const stored=await sget(K_MINI_LEAGUES);
  const legacyLeagues=await sget(K_LEGACY_LEAGUES);
  S.miniLeagues=migrateMiniLeagueState({stored,legacyConfig,legacyLeagues,entry:S.entry});
  syncMiniLeagueAlias(); await persistMiniLeagueState(); return S.miniLeagues;
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
S.leagues=[];
export { MINI_LEAGUE_STATE_VERSION, K_MINI_LEAGUES, MAX_PINNED_RIVALS, MAX_COMPARISON_RIVALS, miniLeagueId, miniLeagueRecord, miniLeagueRivalRecord, uniqueRivalRecords, normaliseMiniLeagueState, entryClassicLeagues, migrateMiniLeagueState, initMiniLeagueState, mergeDiscoveredMiniLeagues, persistMiniLeagueState, selectedMiniLeague, miniLeagueMembership, upsertMiniLeague, rememberLeague, selectMiniLeague, removeMiniLeague, selectMiniLeagueRival, togglePinnedMiniLeagueRival, setMiniLeagueComparisonRivals, clearMiniLeagueComparisonRivals, miniLeagueSelectedRivalId, miniLeaguePinnedRivals, miniLeagueComparisonRivals };
