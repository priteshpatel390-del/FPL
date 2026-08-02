import { S, recordIssues } from '../state.mjs';
import { $, el, setChildren } from '../util.mjs';
import { api, pool } from '../providers/transport.mjs';
import { validateStandings, validatePicks, collapseIssues } from '../providers/validate.mjs';
import { mySquad } from '../squad.mjs';
import { initMiniLeagueState, mergeDiscoveredMiniLeagues, selectedMiniLeague, miniLeagueMembership, upsertMiniLeague, removeMiniLeague, selectMiniLeague, selectMiniLeagueRival, togglePinnedMiniLeagueRival, setMiniLeagueComparisonRivals, clearMiniLeagueComparisonRivals, miniLeagueSelectedRivalId, miniLeaguePinnedRivals, miniLeagueComparisonRivals, miniLeagueId, MAX_COMPARISON_RIVALS } from './mini-leagues-state.mjs';

const MINI_LEAGUE_PAGE_SIZE=50;
let miniLeagueStandingsRequest=0;
let miniLeagueRivalRequest=0;
let miniLeagueExposureRequest=0;
let miniLeagueReady=false;
const miniLeagueRivalLoads=new Map();
S.miniLeagueData={standings:{},rivals:{},exposure:{}};

function miniLeagueNumber(value){ if(value===null||value===undefined||value==='') return null; const n=Number(value); return Number.isFinite(n)?n:null; }
function miniLeagueOrdinal(value){
  const n=miniLeagueNumber(value); if(n===null) return '—';
  const v=Math.abs(Math.trunc(n)),mod100=v%100,suffix=mod100>=11&&mod100<=13?'th':v%10===1?'st':v%10===2?'nd':v%10===3?'rd':'th';
  return `${v}${suffix}`;
}
function miniLeagueMovement(current,last){
  const c=miniLeagueNumber(current),l=miniLeagueNumber(last);
  if(c===null||l===null) return {delta:null,label:'Previous position unavailable',direction:'unknown'};
  const delta=l-c;
  if(delta>0) return {delta,label:`Up ${delta} place${delta===1?'':'s'}`,direction:'up'};
  if(delta<0) return {delta,label:`Down ${Math.abs(delta)} place${delta===-1?'':'s'}`,direction:'down'};
  return {delta:0,label:'No position change',direction:'same'};
}
function miniLeagueNearestRows(rows,userEntry){
  const user=rows.find(row=>String(row.entry)===String(userEntry));
  if(!user) return {user:null,above:null,below:null,leader:rows.slice().sort((a,b)=>Number(a.rank)-Number(b.rank))[0]||null};
  const sorted=rows.slice().sort((a,b)=>Number(a.rank)-Number(b.rank)); const index=sorted.findIndex(row=>String(row.entry)===String(userEntry));
  return {user,above:index>0?sorted[index-1]:null,below:index>=0&&index<sorted.length-1?sorted[index+1]:null,leader:sorted[0]||null};
}
function miniLeagueCompareSquads(ownSquad,rivalPicks){
  const own=[...new Set((ownSquad||[]).map(row=>Number(row?.p?.id??row?.element)).filter(Number.isFinite))];
  const rival=[...new Set((rivalPicks||[]).map(row=>Number(row?.element)).filter(Number.isFinite))];
  const ownSet=new Set(own),rivalSet=new Set(rival);
  return {overlap:own.filter(id=>rivalSet.has(id)),onlyOwn:own.filter(id=>!rivalSet.has(id)),onlyRival:rival.filter(id=>!ownSet.has(id)),ownCount:own.length,rivalCount:rival.length};
}
function miniLeaguePickFacts(picks,{byId=S.byId,activeChip=undefined}={}){
  const rows=Array.isArray(picks)?picks:[];
  const ids=[]; const idSet=new Set(); const positions=[]; let unresolved=0;
  const captainIds=[]; const viceIds=[];
  rows.forEach(row=>{
    const id=Number(row?.p?.id??row?.element),position=Number(row?.position);
    if(!Number.isFinite(id)||idSet.has(id)) return;
    idSet.add(id); ids.push(id);
    if(Number.isInteger(position)&&position>=1&&position<=15) positions.push(position);
    const resolved=row?.p?.id?Boolean(row.p):Boolean(byId?.[id]); if(!resolved) unresolved++;
    if(row?.is_captain===true||Number(row?.multiplier)>1) captainIds.push(id);
    if(row?.is_vice_captain===true) viceIds.push(id);
  });
  const positionSet=new Set(positions);
  const chipKnown=activeChip===null||typeof activeChip==='string';
  return {
    ids,
    count:ids.length,
    complete:ids.length===15&&positionSet.size===15&&positions.every(position=>position>=1&&position<=15)&&unresolved===0,
    unresolved,
    captainId:captainIds.length===1?captainIds[0]:null,
    captainComplete:captainIds.length===1,
    viceId:viceIds.length===1?viceIds[0]:null,
    viceComplete:viceIds.length===1,
    activeChip:chipKnown?(activeChip||null):undefined,
    chipKnown
  };
}
function miniLeagueExposureLabel(count,total){
  if(!count||!total) return 'No loaded selected rivals';
  if(total>=2&&count===total) return 'All selected rivals';
  if(total>=3&&count>total/2) return 'Majority of selected rivals';
  if(count>=2) return 'Multiple selected rivals';
  return 'One selected rival';
}
function miniLeagueExposureSummary(ownSquad,records,{byId=S.byId}={}){
  const own=miniLeaguePickFacts(ownSquad,{byId});
  const statuses=[]; const included=[];
  (Array.isArray(records)?records:[]).forEach(record=>{
    const facts=record?.picks?miniLeaguePickFacts(record.picks.picks,{byId,activeChip:record.picks.active_chip}):miniLeaguePickFacts([],{byId});
    const status=record?.error?'unavailable':record?.stale?'stale':facts.complete?'complete':'incomplete';
    const item={...record,facts,status}; statuses.push(item); if(status==='complete') included.push(item);
  });
  const owners=new Map();
  const ensure=id=>{
    if(!owners.has(id)) owners.set(id,{id,owners:[],captains:[],viceCaptains:[]});
    return owners.get(id);
  };
  included.forEach(item=>{
    item.facts.ids.forEach(id=>ensure(id).owners.push(item.rival));
    if(item.facts.captainComplete) ensure(item.facts.captainId).captains.push(item.rival);
    if(item.facts.viceComplete) ensure(item.facts.viceId).viceCaptains.push(item.rival);
  });
  const ownSet=new Set(own.ids),total=included.length;
  const rows=[...owners.values()].map(row=>({...row,count:row.owners.length,captainCount:row.captains.length,viceCount:row.viceCaptains.length,label:miniLeagueExposureLabel(row.owners.length,total)}));
  rows.sort((a,b)=>b.captainCount-a.captainCount||b.count-a.count||String(byId?.[a.id]?.web_name||a.id).localeCompare(String(byId?.[b.id]?.web_name||b.id)));
  const rivalOnly=rows.filter(row=>!ownSet.has(row.id));
  const chips=new Map(); let chipKnownCount=0;
  included.forEach(item=>{
    if(!item.facts.chipKnown) return;
    chipKnownCount++;
    const key=item.facts.activeChip||'No active chip';
    chips.set(key,(chips.get(key)||0)+1);
  });
  return {
    own,
    statuses,
    included,
    total,
    rows,
    rivalOnly,
    sharedRivalOnly:rivalOnly.filter(row=>row.count>=2),
    singleRivalOnly:rivalOnly.filter(row=>row.count===1),
    uniqueToYou:own.ids.filter(id=>!owners.has(id)),
    captainRows:rows.filter(row=>row.captainCount>0),
    viceRows:rows.filter(row=>row.viceCount>0),
    chips:[...chips.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)),
    chipKnownCount,
    completeCount:included.length,
    staleCount:statuses.filter(item=>item.status==='stale').length,
    incompleteCount:statuses.filter(item=>item.status==='incomplete').length,
    unavailableCount:statuses.filter(item=>item.status==='unavailable').length
  };
}
function miniLeagueStatusCopy(){
  if(!S.seasonLive) return {label:'Pre-season',copy:'No completed Gameweek yet. Official standings and public rival squads will appear when FPL publishes them.',provisional:false};
  const event=S.boot?.events?.find(row=>row.id===S.currentGW);
  if(event?.finished&&event?.data_checked) return {label:`Official FPL — GW${S.currentGW} complete`,copy:'Scores and positions are confirmed by the latest checked Official FPL response.',provisional:false};
  return {label:'Official FPL — provisional',copy:`Scores and positions may change while GW${S.currentGW||'—'} is live or awaiting final checks.`,provisional:true};
}
function miniLeagueAgeLabel(updatedAt){ const ms=Date.now()-Number(updatedAt||0); if(!Number.isFinite(ms)||ms<60000) return 'Updated now'; const mins=Math.floor(ms/60000); return mins<60?`Updated ${mins}m ago`:`Updated ${Math.floor(mins/60)}h ago`; }
function miniLeagueGap(user,row){
  const a=miniLeagueNumber(user?.total),b=miniLeagueNumber(row?.total); if(a===null||b===null) return null; return Math.abs(a-b);
}
function miniLeagueManagerName(row){ return row?.entry_name||row?.player_name||row?.name||`Manager ${row?.entry??row?.id??''}`; }
function miniLeaguePlayerName(id){ return S.byId?.[id]?.web_name||`Player ${id}`; }
function miniLeagueNavigate(route){ globalThis.__teamsheetNavigate?.(route); }
function miniLeagueSelectedData(){ const league=selectedMiniLeague(); return league?S.miniLeagueData.standings[league.id]||null:null; }
function miniLeagueSetBusy(node,busy){ if(node){node.setAttribute('aria-busy',busy?'true':'false');} }
function miniLeagueAnnounce(text){ const node=$('leagueLiveStatus'); if(node) node.textContent=text; }
function miniLeagueButton(label,attrs={}){ return el('button',{class:'btn ghost sm',type:'button',...attrs},label); }
function miniLeagueLink(label,route,cls='btn ghost'){ return el('a',{class:cls,href:route},label); }
function miniLeagueEmpty(title,copy,action){ return el('div',{class:'empty'},el('strong',{},title),copy,action?el('div',{class:'mt-12'},action):null); }

function miniLeagueSuggestedRivals(data){
  if(!data) return [];
  const nearest=miniLeagueNearestRows(data.rows,S.teamId); const pinned=miniLeaguePinnedRivals(data.league.id);
  const byId=new Map(data.rows.map(row=>[String(row.entry),row])); const out=[]; const seen=new Set([String(S.teamId)]);
  const add=row=>{ if(!row||seen.has(String(row.entry))||out.length>=3) return; seen.add(String(row.entry)); out.push(row); };
  pinned.forEach(item=>add(byId.get(String(item.id)))); add(nearest.above); add(nearest.below); add(nearest.leader);
  return out;
}
function miniLeagueRivalIdentity(leagueId,rivalId,data=miniLeagueSelectedData()){
  const id=miniLeagueId(rivalId); if(!id) return null;
  const loaded=data?.rows?.find(row=>String(row.entry)===id);
  if(loaded) return {id,name:miniLeagueManagerName(loaded),row:loaded,membershipVerified:true};
  const saved=[...miniLeagueComparisonRivals(leagueId),...miniLeaguePinnedRivals(leagueId)].find(row=>row.id===id);
  return {id,name:saved?.name||`Manager ${id}`,row:null,membershipVerified:false};
}
function miniLeagueExposureCandidates(data){
  if(!data) return [];
  const leagueId=data.league.id,group=miniLeagueComparisonRivals(leagueId),pinned=miniLeaguePinnedRivals(leagueId),nearest=miniLeagueNearestRows(data.rows,S.teamId);
  const byId=new Map(data.rows.map(row=>[String(row.entry),row])),out=[],seen=new Set([String(S.teamId)]);
  const add=(value,reason)=>{
    const id=miniLeagueId(value?.id??value?.entry); if(!id||seen.has(id)) return;
    seen.add(id); const row=byId.get(id)||null;
    out.push({id,name:miniLeagueManagerName(row||value),row,reason,membershipVerified:Boolean(row)});
  };
  group.forEach(row=>add(row,'Selected'));
  pinned.forEach(row=>add(row,'Pinned rival'));
  add(nearest.above,'Nearest above'); add(nearest.below,'Nearest below'); add(nearest.leader,'League leader');
  const selectedId=miniLeagueSelectedRivalId(leagueId); if(selectedId) add(miniLeagueRivalIdentity(leagueId,selectedId,data),'Current comparison');
  return out;
}
async function miniLeagueToggleExposureRival(leagueId,rival){
  const current=miniLeagueComparisonRivals(leagueId),index=current.findIndex(row=>row.id===rival.id);
  if(index>=0) current.splice(index,1);
  else if(current.length>=MAX_COMPARISON_RIVALS){ miniLeagueAnnounce(`Choose no more than ${MAX_COMPARISON_RIVALS} rivals for one exposure comparison.`); return false; }
  else current.push({id:rival.id,name:rival.name});
  await setMiniLeagueComparisonRivals(leagueId,current); miniLeagueExposureRequest++; delete S.miniLeagueData.exposure[leagueId]; renderMiniLeagues();
  miniLeagueAnnounce(index>=0?`${rival.name} removed from selected rivals.`:`${rival.name} added to selected rivals.`);
  return index<0;
}
function ensureMiniLeagueExposureSection(){
  let section=$('leagueExposure'); if(section) return section;
  const view=$('view-league'); if(!view) return null;
  section=el('section',{class:'panel league-route',id:'leagueExposure','data-league-route':'#/leagues/exposure',hidden:'hidden'},
    el('a',{class:'route-back',href:'#/leagues','aria-label':'Back to Leagues'},el('span',{'aria-hidden':'true'},'←')),
    el('span',{class:'eyebrow'},'Selected-rival facts'),
    el('h2',{tabindex:'-1'},'Rival exposure'),
    el('p',{class:'hint'},'Current public squads, captains and chips across up to five rivals you choose. Counts describe selected rivals, not the whole league or a prediction.'),
    el('div',{id:'leagueExposureOut','aria-busy':'false'}));
  view.appendChild(section); return section;
}

async function loadMiniLeagueStandings({force=false}={}){
  const league=selectedMiniLeague(); if(!league) return null;
  const existing=S.miniLeagueData.standings[league.id]; if(existing&&!force) return existing;
  const token=++miniLeagueStandingsRequest; miniLeagueAnnounce(`Loading ${league.name||'selected league'} standings.`); miniLeagueSetBusy($('leagueLandingOut'),true);
  const membership=miniLeagueMembership(league.id); const rank=miniLeagueNumber(membership?.entry_rank); const pages=[1];
  if(rank){ const rankPage=Math.ceil(rank/MINI_LEAGUE_PAGE_SIZE); pages.push(rankPage); if(rankPage>1) pages.push(rankPage-1); pages.push(rankPage+1); }
  const responses=[]; const issues=[];
  for(const page of [...new Set(pages)]){
    const value=await api(`/leagues-classic/${league.id}/standings/?page_standings=${page}`,{optional:true});
    const validated=validateStandings(value); issues.push(...validated.issues); if(validated.value) responses.push(validated.value);
  }
  if(token!==miniLeagueStandingsRequest) return null;
  recordIssues('fpl','/leagues-classic/standings/',collapseIssues(issues));
  if(!responses.length){
    if(existing&&!existing.error&&Array.isArray(existing.rows)&&existing.rows.length){ S.miniLeagueData.standings[league.id]={...existing,stale:true,refreshError:true}; miniLeagueSetBusy($('leagueLandingOut'),false); renderMiniLeagues(); miniLeagueAnnounce('Refresh failed. Showing the last standings loaded in this session.'); return existing; }
    S.miniLeagueData.standings[league.id]={league,error:'unavailable',updatedAt:Date.now(),rows:[],hasNext:false};
    miniLeagueSetBusy($('leagueLandingOut'),false); renderMiniLeagues(); miniLeagueAnnounce('League standings are unavailable through the public FPL data used by Teamsheet.'); return null;
  }
  const map=new Map(); responses.flatMap(value=>value.standings.results).forEach(row=>map.set(String(row.entry),row));
  const first=responses[0],resolvedName=league.name||first.league?.name||'';
  if(resolvedName!==league.name) await upsertMiniLeague(league.id,resolvedName,{select:true});
  const data={league:{id:league.id,name:resolvedName||`League ${league.id}`},rows:[...map.values()],hasNext:Boolean(first.standings?.has_next),browsePage:1,browseHasNext:Boolean(first.standings?.has_next),updatedAt:Date.now(),provisional:miniLeagueStatusCopy().provisional,stale:false,refreshError:false};
  S.miniLeagueData.standings[league.id]=data; renderMiniLeagues(); miniLeagueSetBusy($('leagueLandingOut'),false);
  const nearest=miniLeagueNearestRows(data.rows,S.teamId); miniLeagueAnnounce(nearest.user?`Standings loaded. Your position is ${miniLeagueOrdinal(nearest.user.rank)}.`:'Standings loaded. Your connected team was not found on the loaded pages.');
  return data;
}
async function loadNextMiniLeagueStandingsPage(){
  const league=selectedMiniLeague(),data=miniLeagueSelectedData(); if(!league||!data||!data.browseHasNext) return data;
  const page=(data.browsePage||1)+1,token=++miniLeagueStandingsRequest; miniLeagueAnnounce(`Loading standings page ${page}.`);
  const raw=await api(`/leagues-classic/${league.id}/standings/?page_standings=${page}`,{optional:true}); const validated=validateStandings(raw);
  if(token!==miniLeagueStandingsRequest) return null; recordIssues('fpl','/leagues-classic/standings/',validated.issues);
  if(!validated.value){ miniLeagueAnnounce('The next standings page is unavailable. Existing rows remain visible.'); return data; }
  const map=new Map(data.rows.map(row=>[String(row.entry),row])); validated.value.standings.results.forEach(row=>map.set(String(row.entry),row));
  Object.assign(data,{rows:[...map.values()],browsePage:page,browseHasNext:Boolean(validated.value.standings.has_next),updatedAt:Date.now(),stale:false,refreshError:false});
  renderMiniLeagues('#/leagues/standings'); miniLeagueAnnounce(`Standings page ${page} loaded.`); return data;
}
async function fetchMiniLeagueRivalRecord(league,rival,{force=false,endpoint='/entry/event/picks/ (selected rival)'}={}){
  const key=`${league.id}|${rival.id}|${S.currentGW}`,existing=S.miniLeagueData.rivals[key];
  if(existing&&!force) return {record:existing,issues:[]};
  if(miniLeagueRivalLoads.has(key)) return miniLeagueRivalLoads.get(key);
  const promise=(async()=>{
    const raw=await api(`/entry/${rival.id}/event/${S.currentGW}/picks/`,{optional:true,timeout:9000});
    const validated=validatePicks(raw,endpoint);
    let record;
    if(validated.value) record={rival,row:rival.row||existing?.row||null,picks:validated.value,updatedAt:Date.now(),error:null,stale:false,refreshError:false};
    else if(existing?.picks) record={...existing,rival,row:rival.row||existing.row||null,stale:true,refreshError:true,error:null};
    else record={rival,row:rival.row||null,picks:null,updatedAt:Date.now(),error:'unavailable',stale:false,refreshError:false};
    S.miniLeagueData.rivals[key]=record;
    return {record,issues:validated.issues};
  })().finally(()=>miniLeagueRivalLoads.delete(key));
  miniLeagueRivalLoads.set(key,promise); return promise;
}
async function loadMiniLeagueRival({force=false}={}){
  const league=selectedMiniLeague(),data=miniLeagueSelectedData(); if(!league||!S.currentGW) return null;
  const rivalId=miniLeagueSelectedRivalId(league.id); if(!rivalId) return null;
  const rival=miniLeagueRivalIdentity(league.id,rivalId,data); if(!rival) return null;
  const token=++miniLeagueRivalRequest; miniLeagueAnnounce(`Loading comparison with ${rival.name}.`); miniLeagueSetBusy($('leagueRivalOut'),true);
  const result=await fetchMiniLeagueRivalRecord(league,rival,{force,endpoint:'/entry/event/picks/ (selected rival)'});
  if(token!==miniLeagueRivalRequest) return null;
  recordIssues('fpl','/entry/event/picks/ (selected rival)',result.issues);
  renderMiniLeagues('#/leagues/rival'); miniLeagueSetBusy($('leagueRivalOut'),false);
  miniLeagueAnnounce(result.record?.picks?`Rival comparison loaded for ${rival.name}.`:`This rival's public squad is not available for the selected Gameweek.`);
  return result.record;
}
async function loadMiniLeagueExposure({force=false}={}){
  const league=selectedMiniLeague(),group=league?miniLeagueComparisonRivals(league.id):[];
  if(!league||!S.currentGW||!group.length) return [];
  const token=++miniLeagueExposureRequest,selectionKey=group.map(row=>row.id).sort().join('|');
  miniLeagueSetBusy($('leagueExposureOut'),true); miniLeagueAnnounce(`Loading public squads for ${group.length} selected rival${group.length===1?'':'s'}.`);
  const results=await pool(group,async row=>{
    const rival=miniLeagueRivalIdentity(league.id,row.id,miniLeagueSelectedData())||{...row,row:null,membershipVerified:false};
    return fetchMiniLeagueRivalRecord(league,rival,{force,endpoint:'/entry/event/picks/ (selected rivals)'});
  },2);
  if(token!==miniLeagueExposureRequest) return results;
  const currentKey=miniLeagueComparisonRivals(league.id).map(row=>row.id).sort().join('|');
  if(currentKey!==selectionKey) return results;
  recordIssues('fpl','/entry/event/picks/ (selected rivals)',collapseIssues(results.flatMap(result=>result?.issues||[])));
  S.miniLeagueData.exposure[league.id]={selectionKey,updatedAt:Date.now()};
  miniLeagueSetBusy($('leagueExposureOut'),false); renderMiniLeagues('#/leagues/exposure');
  const records=results.map(result=>result?.record).filter(Boolean),complete=records.filter(record=>!record.error&&!record.stale&&miniLeaguePickFacts(record.picks?.picks,{activeChip:record.picks?.active_chip}).complete).length;
  miniLeagueAnnounce(`Rival exposure loaded. ${complete} of ${group.length} selected rivals have complete fresh public squads.`);
  return results;
}

function renderLeaguePickerSummary(){
  const league=selectedMiniLeague(),button=$('leaguePickerButton'); if(!button) return;
  button.textContent=league?.name||'Choose a league'; button.setAttribute('aria-label',league?`Change league. Current league ${league.name||league.id}`:'Choose a Mini League');
}
function renderMiniLeagueLanding(){
  const out=$('leagueLandingOut'); if(!out) return; const league=selectedMiniLeague(),data=miniLeagueSelectedData(),status=miniLeagueStatusCopy(); renderLeaguePickerSummary();
  if(!league){ setChildren(out,miniLeagueEmpty('Choose your Mini League','Select a public classic league from your connected FPL entry, or add its numeric league ID.',miniLeagueLink('Choose league','#/leagues/manage','btn'))); return; }
  if(data?.error){ setChildren(out,miniLeagueEmpty('League standings unavailable','This league is unavailable through the public FPL data used by Teamsheet. Your saved league has not been removed.',miniLeagueButton('Try again',{onclick:()=>loadMiniLeagueStandings({force:true})}))); return; }
  if(!data){ setChildren(out,miniLeagueEmpty('Ready to check your league','Teamsheet will load official position, gaps and nearby rivals without scanning every squad.',miniLeagueButton('Load standings',{onclick:()=>loadMiniLeagueStandings({force:true})}))); return; }
  const membership=miniLeagueMembership(league.id),nearest=miniLeagueNearestRows(data.rows,S.teamId); const user=nearest.user;
  const rank=user?.rank??membership?.entry_rank??null,total=user?.total??S.entry?.summary_overall_points??null,last=user?.last_rank??membership?.entry_last_rank??null,movement=miniLeagueMovement(rank,last);
  const statusSummary=!S.seasonLive?'No completed Gameweek yet':status.provisional?'Scores and positions may still change':'Confirmed after official FPL checks';
  const position=rank!==null?el('div',{class:'league-position'},el('strong',{},miniLeagueOrdinal(rank)),el('span',{},total!==null?`${total} points`:'Official points unavailable')):el('div',{class:'league-position'},el('strong',{},'Position unavailable'),el('span',{},'Your connected team was not found on the loaded standings pages.'));
  const movementFlag=el('span',{class:`flag ${movement.direction==='up'?'rise':movement.direction==='down'?'fall':'dark'}`},movement.label);
  const hero=el('section',{class:'league-hero','aria-label':`${data.league.name} official position`},
    el('div',{class:'league-hero-head'},el('div',{},el('span',{class:'eyebrow'},status.label),el('h3',{},data.league.name)),miniLeagueButton('Refresh',{onclick:()=>loadMiniLeagueStandings({force:true})})),
    el('div',{class:'league-position-line'},position,movementFlag),
    el('div',{class:'league-status-row'},el('span',{},statusSummary),el('span',{},miniLeagueAgeLabel(data.updatedAt))),
    data.stale?el('div',{class:'note plain'},'Refresh failed. Showing the last standings loaded in this session; this view may be out of date.'):null);
  const gaps=el('div',{class:'league-gap-grid'},
    el('div',{class:'league-gap'},el('span',{},'Above'),el('strong',{},nearest.above&&user?`${miniLeagueGap(user,nearest.above)} pts`:'—'),nearest.above?el('small',{},miniLeagueManagerName(nearest.above)):null),
    el('div',{class:'league-gap current'},el('span',{},'You'),el('strong',{},total??'—'),el('small',{},rank!==null?miniLeagueOrdinal(rank):'Not located')),
    el('div',{class:'league-gap'},el('span',{},'Below'),el('strong',{},nearest.below&&user?`${miniLeagueGap(user,nearest.below)} pts`:'—'),nearest.below?el('small',{},miniLeagueManagerName(nearest.below)):null));
  const rivals=miniLeagueSuggestedRivals(data);
  const rivalSection=el('section',{class:'league-section'},el('div',{class:'league-section-head'},el('h3',{},'Nearest rivals'),miniLeagueLink('View standings','#/leagues/standings','league-text-link')),
    rivals.length?el('div',{class:'league-rival-list'},rivals.map(row=>renderMiniLeagueRivalCard(row,user,data.league.id))):el('p',{class:'status'},'No nearby rival rows were available on the loaded standings pages.'));
  const group=miniLeagueComparisonRivals(league.id);
  const exposureSection=el('section',{class:'league-section'},el('div',{class:'league-section-head'},el('h3',{},'Rival exposure'),miniLeagueLink(group.length?'View exposure':'Set up comparison','#/leagues/exposure','league-text-link')),
    el('p',{class:'status'},group.length?`${group.length} selected rival${group.length===1?'':'s'}. Public squads load only when you request the exposure view.`:'Choose up to five nearby, leading or pinned rivals. Teamsheet will count only the public squads you explicitly load.'));
  const actions=el('div',{class:'league-actions'},miniLeagueLink('View standings','#/leagues/standings','btn'),miniLeagueLink('Manage leagues','#/leagues/manage','btn ghost'));
  setChildren(out,hero,gaps,rivalSection,exposureSection,actions);
}
function renderMiniLeagueRivalCard(row,user,leagueId){
  const gap=user?miniLeagueGap(user,row):null,movement=miniLeagueMovement(row.rank,row.last_rank); const pinned=miniLeaguePinnedRivals(leagueId).some(item=>item.id===String(row.entry));
  return el('article',{class:'league-rival-card'},el('div',{class:'league-rival-copy'},el('strong',{},miniLeagueManagerName(row)),el('span',{},`${miniLeagueOrdinal(row.rank)} · ${row.total??'—'} points${gap!==null?` · ${gap} points ${Number(row.rank)<Number(user?.rank)?'above':'below'}`:''}`),el('small',{},movement.label)),
    el('div',{class:'league-rival-actions'},miniLeagueButton(pinned?'Unpin':'Pin',{onclick:async()=>{await togglePinnedMiniLeagueRival(leagueId,{id:row.entry,name:miniLeagueManagerName(row)});renderMiniLeagues();}}),miniLeagueButton('Compare',{onclick:async()=>{await selectMiniLeagueRival(leagueId,{id:row.entry,name:miniLeagueManagerName(row)});miniLeagueNavigate('#/leagues/rival');}})));
}
function renderMiniLeagueStandings(){
  const out=$('leagueStandingsOut'),data=miniLeagueSelectedData(); if(!out) return;
  if(!data){ setChildren(out,miniLeagueEmpty('No standings loaded','Return to the League overview and load the selected league.',miniLeagueLink('Back to League','#/leagues','btn'))); return; }
  const rows=data.rows.slice().sort((a,b)=>Number(a.rank)-Number(b.rank));
  setChildren(out,el('div',{class:'league-standings-list'},rows.map(row=>{
    const mine=String(row.entry)===String(S.teamId); const movement=miniLeagueMovement(row.rank,row.last_rank);
    const open=async()=>{await selectMiniLeagueRival(data.league.id,{id:row.entry,name:miniLeagueManagerName(row)});miniLeagueNavigate('#/leagues/rival');};
    const attrs={class:`league-standing-row${mine?' mine':' interactive'}`,'aria-label':`${mine?'Your team, ':'Open rival comparison, '}${miniLeagueOrdinal(row.rank)}, ${miniLeagueManagerName(row)}, ${row.total??'points unavailable'} points, ${movement.label}`};
    if(!mine) Object.assign(attrs,{role:'button',tabindex:'0',onclick:open,onkeydown:event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}}});
    return el('article',attrs,
      el('span',{class:'league-standing-rank'},miniLeagueOrdinal(row.rank)),el('span',{class:'league-standing-name'},el('strong',{},miniLeagueManagerName(row)),el('small',{},row.player_name&&row.player_name!==row.entry_name?row.player_name:movement.label)),el('span',{class:'league-standing-points'},row.total??'—'),
      mine?el('span',{class:'flag info'},'Your team'):el('span',{class:'league-standing-action','aria-hidden':'true'},'Open',el('span',{class:'chev'},'›')));
  })),data.browseHasNext?el('div',{class:'mt-12'},miniLeagueButton('Load more standings',{onclick:()=>loadNextMiniLeagueStandingsPage()})):null,
    data.hasNext?el('p',{class:'status mt-12'},'More standings exist. Teamsheet loads them only when requested and does not scan every rival squad.'):null);
}
function renderMiniLeagueRival(){
  const out=$('leagueRivalOut'),league=selectedMiniLeague(),data=miniLeagueSelectedData(); if(!out) return;
  if(!league){ setChildren(out,miniLeagueEmpty('No rival selected','Choose a league and manager to compare.',miniLeagueLink('Back to League','#/leagues','btn'))); return; }
  const rivalId=miniLeagueSelectedRivalId(league.id),rival=miniLeagueRivalIdentity(league.id,rivalId,data);
  if(!rival){ setChildren(out,miniLeagueEmpty('No rival selected','Choose a manager from the loaded standings.',miniLeagueLink('View standings','#/leagues/standings','btn'))); return; }
  const key=`${league.id}|${rivalId}|${S.currentGW}`,record=S.miniLeagueData.rivals[key],selected=miniLeagueComparisonRivals(league.id).some(item=>item.id===rival.id);
  const selectionAction=miniLeagueButton(selected?'Remove from exposure':'Add to exposure',{'aria-pressed':selected?'true':'false',onclick:()=>miniLeagueToggleExposureRival(league.id,rival)});
  if(!record){ setChildren(out,el('section',{class:'league-rival-summary'},el('h3',{},rival.name),rival.row?el('p',{},`${miniLeagueOrdinal(rival.row.rank)} · ${rival.row.total??'—'} points`):el('div',{class:'note plain'},'This saved rival is not present in the standings pages currently loaded. Current league membership and rank cannot be confirmed.'),el('div',{class:'league-actions'},miniLeagueButton('Load public squad comparison',{onclick:()=>loadMiniLeagueRival({force:true})}),selectionAction))); return; }
  if(record.error||!record.picks){ setChildren(out,miniLeagueEmpty('Rival squad unavailable',"This rival's public squad is not available for the selected Gameweek. Standings remain official and usable.",miniLeagueButton('Try again',{onclick:()=>loadMiniLeagueRival({force:true})})),el('div',{class:'league-actions'},selectionAction,miniLeagueLink('Rival exposure','#/leagues/exposure','btn ghost'))); return; }
  const ownSquad=mySquad(),comparison=miniLeagueCompareSquads(ownSquad,record.picks.picks),facts=miniLeaguePickFacts(record.picks.picks,{activeChip:record.picks.active_chip}),captain=facts.captainId,myCaptain=miniLeaguePickFacts(ownSquad).captainId;
  const playerList=(title,ids)=>el('section',{class:'league-player-differences'},el('h3',{},title),ids.length?el('ul',{},ids.map(id=>el('li',{},miniLeaguePlayerName(id)))):el('p',{class:'status'},'None in the published comparison.'));
  setChildren(out,el('section',{class:'league-rival-summary'},el('span',{class:'eyebrow'},'Official public picks'),el('h3',{},rival.name),rival.row?el('p',{},`${miniLeagueOrdinal(rival.row.rank)} · ${rival.row.total??'—'} points`):el('div',{class:'note plain'},'This saved rival is outside the standings pages currently loaded, so current league membership and rank are unverified.'),
    record.stale?el('div',{class:'note plain'},'Refresh failed. Showing the last public squad loaded in this session; it is excluded from fresh multi-rival exposure counts.'):null,
    el('div',{class:'league-comparison-facts'},el('div',{},el('span',{},'Squad overlap'),el('strong',{},`${comparison.overlap.length} of ${Math.max(comparison.ownCount,comparison.rivalCount,15)}`)),el('div',{},el('span',{},'Captain'),el('strong',{},captain?miniLeaguePlayerName(captain):'Unavailable')),el('div',{},el('span',{},'Captain context'),el('strong',{},captain&&myCaptain?captain===myCaptain?'Same captain':'Different captains':'Incomplete')),facts.chipKnown?el('div',{},el('span',{},'Active chip'),el('strong',{},facts.activeChip||'No active chip')):null),
    facts.viceComplete?el('p',{class:'status'},`Vice-captain: ${miniLeaguePlayerName(facts.viceId)}.`):null,
    !facts.complete?el('div',{class:'note plain'},`Comparison uses ${facts.count} of 15 validated published picks. This rival is excluded from aggregate exposure counts.`):null),
    el('div',{class:'league-difference-grid'},playerList('Only in your squad',comparison.onlyOwn),playerList("Only in this rival's squad",comparison.onlyRival)),
    el('div',{class:'note plain'},'These are factual squad differences, not transfer or differential recommendations. Low ownership alone is not a recommendation.'),
    el('div',{class:'league-actions'},selectionAction,miniLeagueLink('Rival exposure','#/leagues/exposure','btn ghost')),
    el('div',{class:'league-actions'},miniLeagueLink('Review captain on Team','#/team','btn'),miniLeagueLink('Review squad in Transfers','#/transfers','btn ghost')));
}
function exposurePlayerDetails(row,total){
  const owners=row.owners.map(rival=>rival.name).join(', '),captains=row.captains.map(rival=>rival.name).join(', '),vice=row.viceCaptains.map(rival=>rival.name).join(', ');
  const detail=[`Owned by ${owners}.`,captains?`Captained by ${captains}.`:'',vice?`Vice-captained by ${vice}.`:''].filter(Boolean).join(' ');
  return el('details',{},el('summary',{},`${miniLeaguePlayerName(row.id)} — ${row.count} of ${total} loaded selected rivals`),el('p',{class:'status'},detail));
}
function exposurePlayerSection(title,rows,total,emptyCopy){
  return el('section',{class:'league-player-differences'},el('h3',{},title),rows.length?el('div',{},rows.map(row=>exposurePlayerDetails(row,total))):el('p',{class:'status'},emptyCopy));
}
function renderMiniLeagueExposure(){
  const out=$('leagueExposureOut'),league=selectedMiniLeague(),data=miniLeagueSelectedData(); if(!out) return;
  if(!league){ setChildren(out,miniLeagueEmpty('Choose a Mini League','Select a league before choosing rivals.',miniLeagueLink('Choose league','#/leagues/manage','btn'))); return; }
  if(!data){ setChildren(out,miniLeagueEmpty('Load standings first','Teamsheet needs the selected league context before suggesting nearby rivals.',miniLeagueLink('Back to League','#/leagues','btn'))); return; }
  const group=miniLeagueComparisonRivals(league.id),selectedIds=new Set(group.map(row=>row.id)),candidates=miniLeagueExposureCandidates(data);
  const candidateList=el('section',{class:'league-section'},el('div',{class:'league-section-head'},el('h3',{},`Selected rivals · ${group.length}/${MAX_COMPARISON_RIVALS}`),group.length?miniLeagueButton('Clear',{'aria-label':'Clear selected rivals',onclick:async()=>{await clearMiniLeagueComparisonRivals(league.id);miniLeagueExposureRequest++;delete S.miniLeagueData.exposure[league.id];renderMiniLeagues();miniLeagueAnnounce('Selected rival group cleared.');}}):null),
    candidates.length?el('div',{class:'league-rival-list'},candidates.map(candidate=>{
      const selected=selectedIds.has(candidate.id);
      return el('article',{class:'league-rival-card'},el('div',{class:'league-rival-copy'},el('strong',{},candidate.name),el('span',{},candidate.row?`${miniLeagueOrdinal(candidate.row.rank)} · ${candidate.row.total??'—'} points`:candidate.reason),el('small',{},candidate.membershipVerified?candidate.reason:'Not present in loaded standings; membership and rank unverified')),
        el('div',{class:'league-rival-actions'},miniLeagueButton(selected?'Remove':'Add',{'aria-pressed':selected?'true':'false',disabled:!selected&&group.length>=MAX_COMPARISON_RIVALS,onclick:()=>miniLeagueToggleExposureRival(league.id,candidate)})));
    })):el('p',{class:'status'},'No nearby or pinned candidates are available. Open a manager from the loaded standings and add them from the rival comparison.'));
  if(!group.length){ setChildren(out,candidateList,el('div',{class:'note plain'},'Choose up to five rivals. No public squad request is made until you press Load rival exposure.')); return; }
  if(!S.currentGW){ setChildren(out,candidateList,el('div',{class:'note plain'},'Current Gameweek public picks are not available yet. Teamsheet will not substitute a previous Gameweek.')); return; }
  const records=group.map(rival=>{
    const key=`${league.id}|${rival.id}|${S.currentGW}`,record=S.miniLeagueData.rivals[key];
    return record?{...record,rival:{...rival,...record.rival}}:{rival,picks:null,error:null,stale:false,unrequested:true};
  });
  const requested=records.filter(record=>!record.unrequested).length,allRequested=requested===group.length;
  const controls=el('div',{class:'league-actions'},miniLeagueButton(allRequested?'Refresh rival exposure':'Load rival exposure',{onclick:()=>loadMiniLeagueExposure({force:allRequested})}),miniLeagueLink('View standings','#/leagues/standings','btn ghost'));
  if(!requested){ setChildren(out,candidateList,controls,el('div',{class:'note plain'},'Public squads load on demand with at most two concurrent requests. Counts will describe only complete, fresh squads from these selected rivals.')); return; }
  const summary=miniLeagueExposureSummary(mySquad(),records),status=miniLeagueStatusCopy();
  const summaryCard=el('section',{class:'league-rival-summary'},el('span',{class:'eyebrow'},status.label),el('h3',{},'Loaded selected-rival exposure'),
    el('div',{class:'league-comparison-facts'},
      el('div',{},el('span',{},'Selected'),el('strong',{},String(group.length))),
      el('div',{},el('span',{},'Complete fresh squads'),el('strong',{},String(summary.completeCount))),
      el('div',{},el('span',{},'Incomplete'),el('strong',{},String(summary.incompleteCount))),
      el('div',{},el('span',{},'Unavailable or stale'),el('strong',{},String(summary.unavailableCount+summary.staleCount)))),
    !summary.own.complete?el('div',{class:'note plain'},`Your current comparison squad contains ${summary.own.count} of 15 resolved players. Aggregate exposure remains unavailable until the user squad is complete.`):null,
    summary.staleCount?el('div',{class:'note plain'},`${summary.staleCount} stale rival squad${summary.staleCount===1?' is':'s are'} visible but excluded from the fresh aggregate.`):null,
    summary.incompleteCount||summary.unavailableCount?el('div',{class:'note plain'},'Incomplete and unavailable rivals are listed below and excluded from aggregate denominators.'):null);
  if(!summary.own.complete||!summary.total){
    const states=el('section',{class:'league-player-differences'},el('h3',{},'Rival data status'),el('ul',{},summary.statuses.map(item=>el('li',{},`${item.rival.name}: ${item.status}`))));
    setChildren(out,candidateList,controls,summaryCard,states); return;
  }
  const captainSection=exposurePlayerSection('Captain exposure',summary.captainRows,summary.total,'No valid selected-rival captain facts are available.');
  const chipSection=el('section',{class:'league-player-differences'},el('h3',{},'Active chips'),summary.chips.length?el('ul',{},summary.chips.map(item=>el('li',{},`${item.name}: ${item.count} of ${summary.chipKnownCount} selected rivals with known chip context`))):el('p',{class:'status'},'No validated chip context is available.'));
  const sharedSection=exposurePlayerSection('Shared rival-only players',summary.sharedRivalOnly,summary.total,'No player absent from your squad is owned by multiple complete selected rivals.');
  const uniqueSection=el('section',{class:'league-player-differences'},el('h3',{},'Unique to your squad'),summary.uniqueToYou.length?el('ul',{},summary.uniqueToYou.map(id=>el('li',{},miniLeaguePlayerName(id)))):el('p',{class:'status'},'Every player in your complete squad appears in at least one complete selected-rival squad.'));
  const singles=el('details',{},el('summary',{},`One-rival-only differences · ${summary.singleRivalOnly.length}`),summary.singleRivalOnly.length?el('div',{class:'league-player-differences'},summary.singleRivalOnly.map(row=>exposurePlayerDetails(row,summary.total))):el('p',{class:'status'},'None.'));
  const states=el('details',{},el('summary',{},'Missing, incomplete and stale rivals'),el('ul',{},summary.statuses.filter(item=>item.status!=='complete').map(item=>el('li',{},`${item.rival.name}: ${item.status}`))));
  setChildren(out,candidateList,controls,summaryCard,el('div',{class:'league-difference-grid'},captainSection,chipSection),el('div',{class:'league-difference-grid'},sharedSection,uniqueSection),singles,states,el('div',{class:'note plain'},'These counts describe the explicitly selected rivals only. They are not whole-league ownership, projected outcomes or protect/chase advice.'));
}
function renderLeagueManageList(){
  const out=$('leagueManageList'); if(!out) return; const state=S.miniLeagues;
  if(!state.saved.length){ setChildren(out,el('p',{class:'status'},'No saved leagues yet. Connect a public FPL team or add a league ID.')); return; }
  setChildren(out,el('div',{class:'league-manage-list'},state.saved.map(row=>el('article',{class:`league-manage-row${row.id===state.selectedLeagueId?' selected':''}`},
    el('div',{},el('strong',{},row.name||`League ${row.id}`),el('span',{class:'status'},row.primary?'Primary league':row.id===state.selectedLeagueId?'Currently selected':'Saved locally')),
    el('div',{class:'league-manage-actions'},miniLeagueButton(row.id===state.selectedLeagueId?'Selected':'Select',{disabled:row.id===state.selectedLeagueId,onclick:async()=>{await selectMiniLeague(row.id);renderMiniLeagues();miniLeagueNavigate('#/leagues');}}),miniLeagueButton(row.primary?'Primary':'Make primary',{disabled:row.primary,onclick:async()=>{await upsertMiniLeague(row.id,row.name,{primary:true,select:true});renderMiniLeagues();}}),miniLeagueButton('Remove',{'aria-label':`Remove ${row.name||`league ${row.id}`}`,onclick:async()=>{await removeMiniLeague(row.id);delete S.miniLeagueData.standings[row.id];delete S.miniLeagueData.exposure[row.id];renderMiniLeagues();}}))))));
}
function renderMiniLeagues(route=globalThis.location?.hash||'#/leagues'){
  if(!miniLeagueReady) return; ensureMiniLeagueExposureSection(); renderLeaguePickerSummary(); renderLeagueManageList();
  const sections=[['#/leagues',$('leagueLanding')],['#/leagues/standings',$('leagueStandings')],['#/leagues/rival',$('leagueRival')],['#/leagues/exposure',$('leagueExposure')],['#/leagues/manage',$('leagueManage')]];
  const resolved=sections.some(([key])=>key===route)?route:'#/leagues'; sections.forEach(([key,node])=>{if(node) node.hidden=key!==resolved;});
  renderMiniLeagueLanding(); renderMiniLeagueStandings(); renderMiniLeagueRival(); renderMiniLeagueExposure();
}
function renderLeagueChips(){
  if(Array.isArray(S.leagues)&&S.leagues!==S.miniLeagues.saved) S.miniLeagues={...S.miniLeagues,saved:S.leagues};
  const legacy=$('leagueChips');
  if(legacy) setChildren(legacy,(S.miniLeagues.saved||[]).map(row=>el('button',{class:'chip',type:'button'},row.name||row.id)));
  renderLeagueManageList();
}
async function initMiniLeagues(legacyConfig={}){
  ensureMiniLeagueExposureSection(); await initMiniLeagueState(legacyConfig); miniLeagueReady=true;
  const picker=$('leaguePickerButton'); picker?.addEventListener('click',()=>miniLeagueNavigate('#/leagues/manage'));
  $('leagueRefreshButton')?.addEventListener('click',()=>loadMiniLeagueStandings({force:true}));
  $('leagueManageForm')?.addEventListener('submit',async event=>{event.preventDefault();const id=miniLeagueId($('leagueId')?.value),name=$('leagueName')?.value?.trim()||'';if(!id){miniLeagueAnnounce("Add a valid league ID first — it is the number in the league's URL.");return;}await upsertMiniLeague(id,name,{select:true});if($('leagueId'))$('leagueId').value='';if($('leagueName'))$('leagueName').value='';renderMiniLeagues();miniLeagueNavigate('#/leagues');});
  document.addEventListener('teamsheet:route-change',event=>{const route=event.detail?.route||'#/leagues';if(!route.startsWith('#/leagues')) return;renderMiniLeagues(route);if(selectedMiniLeague()&&!miniLeagueSelectedData()) void loadMiniLeagueStandings();if(route==='#/leagues/rival') void loadMiniLeagueRival();});
  document.addEventListener('teamsheet:data-rendered',async()=>{await mergeDiscoveredMiniLeagues(S.entry);renderMiniLeagues();const route=globalThis.location?.hash||'';if(route.startsWith('#/leagues')&&selectedMiniLeague()) void loadMiniLeagueStandings({force:true});});
  renderMiniLeagues();
}

export { MINI_LEAGUE_PAGE_SIZE, miniLeagueOrdinal, miniLeagueMovement, miniLeagueNearestRows, miniLeagueCompareSquads, miniLeaguePickFacts, miniLeagueExposureLabel, miniLeagueExposureSummary, miniLeagueStatusCopy, initMiniLeagues, renderMiniLeagues, renderLeagueChips, loadMiniLeagueStandings, loadNextMiniLeagueStandingsPage, loadMiniLeagueRival, loadMiniLeagueExposure };
