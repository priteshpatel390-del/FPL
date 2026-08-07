import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app=readFileSync(new URL('../app.html',import.meta.url),'utf8');
const view=readFileSync(new URL('../src/ui/mini-leagues-view.mjs',import.meta.url),'utf8');
const state=readFileSync(new URL('../src/ui/mini-leagues-state.mjs',import.meta.url),'utf8');
const shell=readFileSync(new URL('../src/ui/app-shell.mjs',import.meta.url),'utf8');
const build=readFileSync(new URL('../build.mjs',import.meta.url),'utf8');
const includesAll=(source,values)=>values.forEach(value=>assert.equal(source.includes(value),true,`Missing ${value}`));
const excludesAll=(source,values)=>values.forEach(value=>assert.equal(source.includes(value),false,`Unexpected ${value}`));

test('Leagues has separate all-league hub, selected-league overview, standings, rival and manage surfaces',()=>{
  includesAll(app,['id="leagueHub"','data-league-route="#/leagues"','id="leagueLanding"','data-league-route="#/leagues/detail"','id="leagueStandings"','id="leagueRival"','id="leagueManage"','data-league-route="#/leagues/standings"','data-league-route="#/leagues/rival"']);
  includesAll(view,["id:'leagueExposure'","'data-league-route':'#/leagues/exposure'"]);
  excludesAll(app,['id="lgN"','id="lgBtn"','id="leagueOut"','Top 30','effective ownership against your rivals']);
});

test('League subroutes remain semantic and identifiers stay in local state',()=>{
  includesAll(shell,["'#/leagues/detail'","'#/leagues/standings'","'#/leagues/rival'","'#/leagues/exposure'","'#/leagues/manage'","route.startsWith('#/leagues')"]);
  excludesAll(shell,[':leagueId',':managerId','leagueId/rival','managerId']);
  includesAll(state,["'fpl:mini-leagues'",'MINI_LEAGUE_STATE_VERSION = 2','selectedLeagueId','selectedRivalByLeague','comparisonRivalsByLeague','pinnedRivals']);
});

test('League persistence stores choices only, not standings or rival squads',()=>{
  const persisted=state.slice(state.indexOf('function emptyMiniLeagueState'),state.indexOf('function normaliseMiniLeagueState'));
  includesAll(persisted,['selectedLeagueId','selectedRivalByLeague','comparisonRivalsByLeague','saved','pinnedRivals']);
  excludesAll(persisted,['standings','picks','points','captain']);
  assert.equal(view.includes('S.miniLeagueData={standings:{},rivals:{},exposure:{}}'),true);
});

test('large leagues use targeted pages and explicit incremental loading',()=>{
  includesAll(view,['MINI_LEAGUE_PAGE_SIZE=50','rankPage-1','rankPage+1','page_standings=${page}','loadNextMiniLeagueStandingsPage','Load more standings']);
  excludesAll(view,['pool(rivals','Top 10','Top 20','Top 30']);
});

test('rival comparison loads one selected public squad and uses exact sets',()=>{
  includesAll(view,['miniLeagueSelectedRivalId','/entry/${rival.id}/event/${S.currentGW}/picks/','miniLeagueCompareSquads','Only in your squad',"Only in this rival's squad"]);
  excludesAll(view,['effective ownership','own >= 35','own <= 25','xpOf(','optimiseTransfers(']);
});

test('official, provisional, stale and incomplete wording is explicit',()=>{
  includesAll(view,['Official FPL — provisional','Official FPL — GW${S.currentGW} complete','Refresh failed. Showing the last standings loaded in this session','Comparison uses ${facts.count} of 15 validated published picks','public squad is not available']);
  excludesAll(view,['accuracy','confidence score','projected rank','likely rank']);
});

test('decision links navigate without changing Team or Transfers calculations',()=>{
  includesAll(view,["miniLeagueLink('Review captain on Team','#/team'","miniLeagueLink('Review squad in Transfers','#/transfers'",'factual squad differences, not transfer or differential recommendations']);
  excludesAll(view,['src/model/transfers.mjs','src/model/scoring.mjs','src/model/simulation.mjs','TRANSFER_RULES','SIMULATION_RULES']);
});

test('mobile layout avoids the generic horizontally scrolling data table',()=>{
  includesAll(app,['.league-gap-grid{display:grid','.league-standing-row{grid-template-columns','@media(max-width:520px)','min-height:44px','overflow-wrap:anywhere']);
  assert.equal(view.includes("class:'scroll'"),false);
  assert.equal(view.includes("class:'data'"),false);
});


test('Leagues opens with a lightweight all-league standings hub before selected-league detail',()=>{
  const hubStart=view.indexOf('function miniLeagueHubCategory(league){');
  const hub=view.slice(hubStart,view.indexOf('function renderLeaguePickerSummary',hubStart));
  includesAll(app,['id="leagueHub"','id="leagueHubOut"','Your current position across every connected classic league','href="#/leagues/manage"','.league-hub-row{appearance:none']);
  includesAll(hub,['Invitational leagues','General leagues','Saved leagues','entry_rank','entry_last_rank',"league_type||''","miniLeagueNavigate('#/leagues/detail')"]);
  excludesAll(hub,['loadMiniLeagueStandings','/standings/?page_standings']);
  const routeHandler=view.slice(view.indexOf("document.addEventListener('teamsheet:route-change'"),view.indexOf("document.addEventListener('teamsheet:data-rendered'"));
  includesAll(routeHandler,["['#/leagues/detail','#/leagues/standings','#/leagues/rival','#/leagues/exposure'].includes(route)",'needsStandings']);
});

test('League accessibility has route focus, live status and named back controls',()=>{
  includesAll(app,['id="leagueLiveStatus" aria-live="polite"','aria-label="Back to Leagues"','<h2 tabindex="-1">League table</h2>','<h2 tabindex="-1">Rival comparison</h2>']);
  includesAll(shell,['data-league-route','heading?.focus?.({preventScroll:true})']);
  includesAll(view,["'aria-label':`${mine?'Your team, ':'Open rival comparison, '}","role:'button'","tabindex:'0'","event.key==='Enter'||event.key===' '",'Your team','Loading ${league.name||\'selected league\'} standings']);
});


test('standings and rival requests invalidate independently and failed empty records are not stale fallbacks',()=>{
  includesAll(view,['miniLeagueStandingsRequest','miniLeagueRivalRequest',"existing&&!existing.error&&Array.isArray(existing.rows)&&existing.rows.length"]);
  excludesAll(view,['let miniLeagueRequest=0']);
});

test('narrow League header stacks the picker and the dark hero keeps refresh readable',()=>{
  includesAll(app,['@media(max-width:520px){.league-topbar{grid-template-columns:1fr;align-items:stretch}', '.league-picker{max-width:none;width:100%}', '.league-hero .btn.ghost{color:#fff', '.league-position-line{display:flex']);
  includesAll(shell,['Official position, points gaps, pairwise comparisons and on-demand selected-rival exposure. Projected rank and protect/chase strategy are not included.']);
  excludesAll(shell,['Rank movement and deeper league intelligence arrive in later Teamsheet 2.0 checkpoints.']);
});


test('owner-approved compact League hierarchy keeps primary context visible without duplicate landing actions',()=>{
  const landing=view.slice(view.indexOf('function renderMiniLeagueLanding'),view.indexOf('function renderMiniLeagueRivalCard'));
  includesAll(app,['.league-position-line{display:flex','.league-status-row{display:flex','.league-gap-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:12px','#leagueLandingOut>.league-section,#leagueLandingOut>.league-actions{margin-top:9px']);
  includesAll(landing,['league-position-line','league-status-row',"class:'league-actions single'","miniLeagueLink('View standings','#/leagues/standings','btn')"]);
  excludesAll(landing,["miniLeagueLink('Manage leagues','#/leagues/manage','btn ghost')","miniLeagueLink('Review Team'","miniLeagueLink('Review Transfers'"]);
});

test('standings use full-row touch and keyboard actions with a quiet trailing affordance',()=>{
  const standingsStart=view.indexOf('function renderMiniLeagueStandings');
  const standings=view.slice(standingsStart,view.indexOf('function renderMiniLeagueRival(){',standingsStart));
  includesAll(app,['.league-standing-row.interactive{cursor:pointer','.league-standing-row.interactive:focus-visible','.league-standing-action{justify-self:end']);
  includesAll(standings,["class:`league-standing-row${mine?' mine':' interactive'}`","role:'button'","tabindex:'0'","event.key==='Enter'||event.key===' '","class:'league-standing-action'","class:'chev'",'Open']);
  excludesAll(standings,["miniLeagueButton('Compare'"]);
});

test('new modules are in the deterministic bundle before the startup view',()=>{
  const stateIndex=build.indexOf("'src/ui/mini-leagues-state.mjs'");
  const viewIndex=build.indexOf("'src/ui/mini-leagues-view.mjs'");
  const viewsIndex=build.indexOf("'src/ui/views.mjs'");
  assert.ok(stateIndex>0&&viewIndex>stateIndex&&viewsIndex>viewIndex);
});

test('Mini-League intelligence adds an ID-free on-demand exposure route',()=>{
  includesAll(shell,['#/leagues/exposure',"title:'Rival exposure'","primary:'leagues'"]);
  includesAll(view,["id:'leagueExposure'","'data-league-route':'#/leagues/exposure'",'MAX_COMPARISON_RIVALS','loadMiniLeagueExposure','pool(group,async row=>','},2)','selected rivals only','No public squad request is made until you press Load rival exposure']);
  includesAll(state,['MINI_LEAGUE_STATE_VERSION = 2','comparisonRivalsByLeague','MAX_COMPARISON_RIVALS = 5']);
  const routeHandler=view.slice(view.indexOf("document.addEventListener('teamsheet:route-change'"),view.indexOf("document.addEventListener('teamsheet:data-rendered'"));
  excludesAll(routeHandler,['loadMiniLeagueExposure']);
  excludesAll(view,['projected rival score','projected league position','must protect','must chase','effective ownership','optimiseTransfers(','xpOf(']);
});

test('exposure persistence stores only explicit rival choices while fetched squads remain session-only',()=>{
  includesAll(state,['comparisonRivalsByLeague','setMiniLeagueComparisonRivals','clearMiniLeagueComparisonRivals']);
  includesAll(view,['S.miniLeagueData={standings:{},rivals:{},exposure:{}}','excluded from aggregate denominators','membership and rank cannot be confirmed']);
  excludesAll(state,['event_total','active_chip','captainCount','public picks']);
});
