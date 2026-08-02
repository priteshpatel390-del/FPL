import { S, recordIssues } from '../state.mjs';
import { $, el, setChildren } from '../util.mjs';
import { api } from '../providers/transport.mjs';
import { validateStandings, validatePicks, collapseIssues } from '../providers/validate.mjs';
import { mySquad } from '../squad.mjs';
import { initMiniLeagueState, mergeDiscoveredMiniLeagues, selectedMiniLeague, miniLeagueMembership, upsertMiniLeague, removeMiniLeague, selectMiniLeague, selectMiniLeagueRival, togglePinnedMiniLeagueRival, miniLeagueSelectedRivalId, miniLeaguePinnedRivals, miniLeagueId } from './mini-leagues-state.mjs';

const MINI_LEAGUE_PAGE_SIZE=50;
let miniLeagueStandingsRequest=0;
let miniLeagueRivalRequest=0;
let miniLeagueReady=false;
S.miniLeagueData={standings:{},rivals:{}};

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
function miniLeagueManagerName(row){ return row?.entry_name||row?.player_name||`Manager ${row?.entry||''}`; }
function miniLeaguePlayerName(id){ return S.byId?.[id]?.web_name||`Player ${id}`; }
function miniLeagueNavigate(route){ globalThis.__teamsheetNavigate?.(route); }
function miniLeagueSelectedData(){ const league=selectedMiniLeague(); return league?S.miniLeagueData.standings[league.id]||null:null; }
function miniLeagueSetBusy(node,busy){ if(node){node.setAttribute('aria-busy',busy?'true':'false');} }
function miniLeagueAnnounce(text){ const node=$('leagueLiveStatus'); if(node) node.textContent=text; }

function miniLeagueSuggestedRivals(data){
  if(!data) return [];
  const nearest=miniLeagueNearestRows(data.rows,S.teamId); const pinned=miniLeaguePinnedRivals(data.league.id);
  const byId=new Map(data.rows.map(row=>[String(row.entry),row])); const out=[]; const seen=new Set([String(S.teamId)]);
  const add=row=>{ if(!row||seen.has(String(row.entry))||out.length>=3) return; seen.add(String(row.entry)); out.push(row); };
  pinned.forEach(item=>add(byId.get(String(item.id)))); add(nearest.above); add(nearest.below); add(nearest.leader);
  return out;
}
function miniLeagueButton(label,attrs={}){ return el('button',{class:'btn ghost sm',type:'button',...attrs},label); }
function miniLeagueLink(label,route,cls='btn ghost'){ return el('a',{class:cls,href:route},label); }
function miniLeagueEmpty(title,copy,action){ return el('div',{class:'empty'},el('strong',{},title),copy,action?el('div',{class:'mt-12'},action):null); }

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
async function loadMiniLeagueRival({force=false}={}){
  const league=selectedMiniLeague(),data=miniLeagueSelectedData(); if(!league||!data||!S.currentGW) return null;
  const rivalId=miniLeagueSelectedRivalId(league.id); if(!rivalId) return null;
  const key=`${league.id}|${rivalId}|${S.currentGW}`; if(S.miniLeagueData.rivals[key]&&!force) return S.miniLeagueData.rivals[key];
  const row=data.rows.find(item=>String(item.entry)===String(rivalId)); if(!row) return null;
  const token=++miniLeagueRivalRequest; miniLeagueAnnounce(`Loading comparison with ${miniLeagueManagerName(row)}.`); miniLeagueSetBusy($('leagueRivalOut'),true);
  const raw=await api(`/entry/${rivalId}/event/${S.currentGW}/picks/`,{optional:true,timeout:9000}); const validated=validatePicks(raw,'/entry/event/picks/ (selected rival)');
  if(token!==miniLeagueRivalRequest) return null;
  recordIssues('fpl','/entry/event/picks/ (selected rival)',validated.issues);
  S.miniLeagueData.rivals[key]={row,picks:validated.value,updatedAt:Date.now(),error:validated.value?null:'unavailable'};
  renderMiniLeagues('#/leagues/rival'); miniLeagueSetBusy($('leagueRivalOut'),false);
  miniLeagueAnnounce(validated.value?`Rival comparison loaded for ${miniLeagueManagerName(row)}.`:`This rival's public squad is not available for the selected Gameweek.`);
  return S.miniLeagueData.rivals[key];
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
  const hero=el('section',{class:'league-hero','aria-label':`${data.league.name} official position`},
    el('div',{class:'league-hero-head'},el('div',{},el('span',{class:'eyebrow'},status.label),el('h3',{},data.league.name)),miniLeagueButton('Refresh',{onclick:()=>loadMiniLeagueStandings({force:true})})),
    rank!==null?el('div',{class:'league-position'},el('strong',{},miniLeagueOrdinal(rank)),el('span',{},total!==null?`${total} points`:'Official points unavailable')):el('div',{class:'league-position'},el('strong',{},'Position unavailable'),el('span',{},'Your connected team was not found on the loaded standings pages.')),
    el('p',{class:'league-status-copy'},status.copy),
    el('p',{class:'league-status-copy'},miniLeagueAgeLabel(data.updatedAt)),
    data.stale?el('div',{class:'note plain'},'Refresh failed. Showing the last standings loaded in this session; this view may be out of date.'):null,
    el('span',{class:`flag ${movement.direction==='up'?'rise':movement.direction==='down'?'fall':'dark'}`},movement.label));
  const gaps=el('div',{class:'league-gap-grid'},
    el('div',{class:'league-gap'},el('span',{},'Above'),el('strong',{},nearest.above&&user?`${miniLeagueGap(user,nearest.above)} pts`:'—'),nearest.above?el('small',{},miniLeagueManagerName(nearest.above)):null),
    el('div',{class:'league-gap current'},el('span',{},'You'),el('strong',{},total??'—'),el('small',{},rank!==null?miniLeagueOrdinal(rank):'Not located')),
    el('div',{class:'league-gap'},el('span',{},'Below'),el('strong',{},nearest.below&&user?`${miniLeagueGap(user,nearest.below)} pts`:'—'),nearest.below?el('small',{},miniLeagueManagerName(nearest.below)):null));
  const rivals=miniLeagueSuggestedRivals(data); const rivalSection=el('section',{class:'league-section'},el('div',{class:'league-section-head'},el('h3',{},'Nearest rivals'),miniLeagueLink('View standings','#/leagues/standings','league-text-link')),
    rivals.length?el('div',{class:'league-rival-list'},rivals.map(row=>renderMiniLeagueRivalCard(row,user,data.league.id))):el('p',{class:'status'},'No nearby rival rows were available on the loaded standings pages.'));
  const actions=el('div',{class:'league-actions'},miniLeagueLink('View standings','#/leagues/standings','btn'),miniLeagueLink('Manage leagues','#/leagues/manage','btn ghost'),miniLeagueLink('Review Team','#/team','btn ghost'),miniLeagueLink('Review Transfers','#/transfers','btn ghost'));
  setChildren(out,hero,gaps,rivalSection,actions);
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
    return el('article',{class:`league-standing-row${mine?' mine':''}`,'aria-label':`${mine?'Your team, ':''}${miniLeagueOrdinal(row.rank)}, ${miniLeagueManagerName(row)}, ${row.total??'points unavailable'} points, ${movement.label}`},
      el('span',{class:'league-standing-rank'},miniLeagueOrdinal(row.rank)),el('span',{class:'league-standing-name'},el('strong',{},miniLeagueManagerName(row)),el('small',{},row.player_name&&row.player_name!==row.entry_name?row.player_name:movement.label)),el('span',{class:'league-standing-points'},row.total??'—'),
      mine?el('span',{class:'flag info'},'Your team'):miniLeagueButton('Compare',{onclick:async()=>{await selectMiniLeagueRival(data.league.id,{id:row.entry,name:miniLeagueManagerName(row)});miniLeagueNavigate('#/leagues/rival');}}));
  })),data.browseHasNext?el('div',{class:'mt-12'},miniLeagueButton('Load more standings',{onclick:()=>loadNextMiniLeagueStandingsPage()})):null,
    data.hasNext?el('p',{class:'status mt-12'},'More standings exist. Teamsheet loads them only when requested and does not scan every rival squad.'):null);
}
function renderMiniLeagueRival(){
  const out=$('leagueRivalOut'),league=selectedMiniLeague(),data=miniLeagueSelectedData(); if(!out) return;
  if(!league||!data){ setChildren(out,miniLeagueEmpty('No rival selected','Load a league and choose a manager to compare.',miniLeagueLink('Back to League','#/leagues','btn'))); return; }
  const rivalId=miniLeagueSelectedRivalId(league.id),row=data.rows.find(item=>String(item.entry)===String(rivalId));
  if(!row){ setChildren(out,miniLeagueEmpty('Rival unavailable','The selected rival is not present in the loaded standings pages.',miniLeagueLink('View standings','#/leagues/standings','btn'))); return; }
  const key=`${league.id}|${rivalId}|${S.currentGW}`,record=S.miniLeagueData.rivals[key];
  if(!record){ setChildren(out,el('section',{class:'league-rival-summary'},el('h3',{},miniLeagueManagerName(row)),el('p',{},`${miniLeagueOrdinal(row.rank)} · ${row.total??'—'} points`),miniLeagueButton('Load public squad comparison',{onclick:()=>loadMiniLeagueRival({force:true})}))); return; }
  if(record.error||!record.picks){ setChildren(out,miniLeagueEmpty('Rival squad unavailable',"This rival's public squad is not available for the selected Gameweek. Standings remain official and usable.",miniLeagueButton('Try again',{onclick:()=>loadMiniLeagueRival({force:true})}))); return; }
  const comparison=miniLeagueCompareSquads(mySquad(),record.picks.picks),captain=record.picks.picks.find(item=>item.is_captain||Number(item.multiplier)>1),vice=record.picks.picks.find(item=>item.is_vice_captain),myCaptain=mySquad().find(item=>item.is_captain||Number(item.multiplier)>1);
  const playerList=(title,ids)=>el('section',{class:'league-player-differences'},el('h3',{},title),ids.length?el('ul',{},ids.map(id=>el('li',{},miniLeaguePlayerName(id)))):el('p',{class:'status'},'None in the published comparison.'));
  setChildren(out,el('section',{class:'league-rival-summary'},el('span',{class:'eyebrow'},'Official public picks'),el('h3',{},miniLeagueManagerName(row)),el('p',{},`${miniLeagueOrdinal(row.rank)} · ${row.total??'—'} points`),
    el('div',{class:'league-comparison-facts'},el('div',{},el('span',{},'Squad overlap'),el('strong',{},`${comparison.overlap.length} of ${Math.max(comparison.ownCount,comparison.rivalCount,15)}`)),el('div',{},el('span',{},'Captain'),el('strong',{},captain?miniLeaguePlayerName(captain.element):'Unavailable')),el('div',{},el('span',{},'Captain context'),el('strong',{},captain&&myCaptain?Number(captain.element)===Number(myCaptain.p.id)?'Same captain':'Different captains':'Incomplete')),record.picks.active_chip?el('div',{},el('span',{},'Active chip'),el('strong',{},String(record.picks.active_chip))):null),
    vice?el('p',{class:'status'},`Vice-captain: ${miniLeaguePlayerName(vice.element)}.`):null,
    comparison.rivalCount<15?el('div',{class:'note plain'},`Comparison uses ${comparison.rivalCount} of 15 published picks. Missing players are excluded.`):null),
    el('div',{class:'league-difference-grid'},playerList('Only in your squad',comparison.onlyOwn),playerList("Only in this rival's squad",comparison.onlyRival)),
    el('div',{class:'note plain'},'These are factual squad differences, not transfer or differential recommendations. Low ownership alone is not a recommendation.'),
    el('div',{class:'league-actions'},miniLeagueLink('Review captain on Team','#/team','btn'),miniLeagueLink('Review squad in Transfers','#/transfers','btn ghost')));
}
function renderLeagueManageList(){
  const out=$('leagueManageList'); if(!out) return; const state=S.miniLeagues;
  if(!state.saved.length){ setChildren(out,el('p',{class:'status'},'No saved leagues yet. Connect a public FPL team or add a league ID.')); return; }
  setChildren(out,el('div',{class:'league-manage-list'},state.saved.map(row=>el('article',{class:`league-manage-row${row.id===state.selectedLeagueId?' selected':''}`},
    el('div',{},el('strong',{},row.name||`League ${row.id}`),el('span',{class:'status'},row.primary?'Primary league':row.id===state.selectedLeagueId?'Currently selected':'Saved locally')),
    el('div',{class:'league-manage-actions'},miniLeagueButton(row.id===state.selectedLeagueId?'Selected':'Select',{disabled:row.id===state.selectedLeagueId,onclick:async()=>{await selectMiniLeague(row.id);renderMiniLeagues();miniLeagueNavigate('#/leagues');}}),miniLeagueButton(row.primary?'Primary':'Make primary',{disabled:row.primary,onclick:async()=>{await upsertMiniLeague(row.id,row.name,{primary:true,select:true});renderMiniLeagues();}}),miniLeagueButton('Remove',{'aria-label':`Remove ${row.name||`league ${row.id}`}`,onclick:async()=>{await removeMiniLeague(row.id);delete S.miniLeagueData.standings[row.id];renderMiniLeagues();}}))))));
}
function renderMiniLeagues(route=globalThis.location?.hash||'#/leagues'){
  if(!miniLeagueReady) return; renderLeaguePickerSummary(); renderLeagueManageList();
  const sections=[['#/leagues',$('leagueLanding')],['#/leagues/standings',$('leagueStandings')],['#/leagues/rival',$('leagueRival')],['#/leagues/manage',$('leagueManage')]];
  const resolved=sections.some(([key])=>key===route)?route:'#/leagues'; sections.forEach(([key,node])=>{if(node) node.hidden=key!==resolved;});
  renderMiniLeagueLanding(); renderMiniLeagueStandings(); renderMiniLeagueRival();
}
function renderLeagueChips(){
  if(Array.isArray(S.leagues)&&S.leagues!==S.miniLeagues.saved) S.miniLeagues={...S.miniLeagues,saved:S.leagues};
  const legacy=$('leagueChips');
  if(legacy) setChildren(legacy,(S.miniLeagues.saved||[]).map(row=>el('button',{class:'chip',type:'button'},row.name||row.id)));
  renderLeagueManageList();
}
async function initMiniLeagues(legacyConfig={}){
  await initMiniLeagueState(legacyConfig); miniLeagueReady=true;
  const picker=$('leaguePickerButton'); picker?.addEventListener('click',()=>miniLeagueNavigate('#/leagues/manage'));
  $('leagueRefreshButton')?.addEventListener('click',()=>loadMiniLeagueStandings({force:true}));
  $('leagueManageForm')?.addEventListener('submit',async event=>{event.preventDefault();const id=miniLeagueId($('leagueId')?.value),name=$('leagueName')?.value?.trim()||'';if(!id){miniLeagueAnnounce("Add a valid league ID first — it is the number in the league's URL.");return;}await upsertMiniLeague(id,name,{select:true});if($('leagueId'))$('leagueId').value='';if($('leagueName'))$('leagueName').value='';renderMiniLeagues();miniLeagueNavigate('#/leagues');});
  document.addEventListener('teamsheet:route-change',event=>{const route=event.detail?.route||'#/leagues';if(!route.startsWith('#/leagues')) return;renderMiniLeagues(route);if(selectedMiniLeague()&&!miniLeagueSelectedData()) void loadMiniLeagueStandings();if(route==='#/leagues/rival') void loadMiniLeagueRival();});
  document.addEventListener('teamsheet:data-rendered',async()=>{await mergeDiscoveredMiniLeagues(S.entry);renderMiniLeagues();const route=globalThis.location?.hash||'';if(route.startsWith('#/leagues')&&selectedMiniLeague()) void loadMiniLeagueStandings({force:true});});
  renderMiniLeagues();
}

export { MINI_LEAGUE_PAGE_SIZE, miniLeagueOrdinal, miniLeagueMovement, miniLeagueNearestRows, miniLeagueCompareSquads, miniLeagueStatusCopy, initMiniLeagues, renderMiniLeagues, renderLeagueChips, loadMiniLeagueStandings, loadNextMiniLeagueStandingsPage, loadMiniLeagueRival };
