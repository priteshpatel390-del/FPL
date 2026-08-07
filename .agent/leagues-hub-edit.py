from pathlib import Path
import re


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one literal match, found {count}: {old[:100]!r}')
    write(path, text.replace(old, new, 1))


def sub_once(path, pattern, replacement):
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one regex match, found {count}: {pattern[:100]!r}')
    write(path, updated)


# ---------------------------------------------------------------------------
# Router: add an ID-free selected-league overview between the all-league hub
# and the existing standings/rival/exposure surfaces.
# ---------------------------------------------------------------------------
replace_once(
    'src/ui/app-shell.mjs',
    "  '#/leagues':Object.freeze({title:'Leagues',primary:'leagues'}),\n  '#/leagues/standings':Object.freeze({title:'League table',primary:'leagues',parent:'#/leagues'}),\n  '#/leagues/rival':Object.freeze({title:'Rival comparison',primary:'leagues',parent:'#/leagues'}),\n  '#/leagues/exposure':Object.freeze({title:'Rival exposure',primary:'leagues',parent:'#/leagues'}),\n  '#/leagues/manage':Object.freeze({title:'Manage leagues',primary:'leagues',parent:'#/leagues'}),",
    "  '#/leagues':Object.freeze({title:'Leagues',primary:'leagues'}),\n  '#/leagues/detail':Object.freeze({title:'League overview',primary:'leagues',parent:'#/leagues'}),\n  '#/leagues/standings':Object.freeze({title:'League table',primary:'leagues',parent:'#/leagues/detail'}),\n  '#/leagues/rival':Object.freeze({title:'Rival comparison',primary:'leagues',parent:'#/leagues/detail'}),\n  '#/leagues/exposure':Object.freeze({title:'Rival exposure',primary:'leagues',parent:'#/leagues/detail'}),\n  '#/leagues/manage':Object.freeze({title:'Manage leagues',primary:'leagues',parent:'#/leagues'}),"
)

# ---------------------------------------------------------------------------
# Static shell and mobile presentation.
# ---------------------------------------------------------------------------
replace_once(
    'app.html',
    ".league-topbar{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:9px}.league-picker{min-height:44px;max-width:240px;overflow-wrap:anywhere;text-align:left;padding:8px 11px}\n",
    ".league-topbar{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:9px}.league-picker{min-height:44px;max-width:240px;overflow-wrap:anywhere;text-align:left;padding:8px 11px}\n.league-hub-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.league-hub-head>div{min-width:0}.league-hub-head>.btn{flex:0 0 auto}.league-hub-groups{display:grid;gap:15px;margin-top:4px}.league-hub-group{display:grid;gap:7px}.league-hub-group h3{font-size:15px}.league-hub-list{display:grid;gap:6px}.league-hub-row{appearance:none;width:100%;display:grid;grid-template-columns:minmax(0,1fr) minmax(92px,auto) 16px;align-items:center;gap:9px;min-height:58px;padding:9px 10px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);font:inherit;text-align:left;cursor:pointer}.league-hub-row:hover{background:#F7F9F5}.league-hub-row:focus-visible{outline:2.5px solid var(--info);outline-offset:2px}.league-hub-copy{display:grid;gap:2px;min-width:0}.league-hub-copy strong{font-size:13px;line-height:1.2;overflow-wrap:anywhere}.league-hub-copy small{font-size:10.5px;color:var(--ink-soft)}.league-hub-rank{display:grid;gap:1px;text-align:right;justify-items:end}.league-hub-rank strong{font-size:13px;line-height:1.2;white-space:nowrap}.league-hub-rank small{max-width:150px;font-size:9.5px;line-height:1.2;color:var(--ink-soft);overflow-wrap:anywhere}.league-hub-chevron{font-size:19px;line-height:1;color:var(--claret);text-align:right}\n"
)
replace_once(
    'app.html',
    ".league-rival-actions,.league-manage-actions{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.league-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.league-actions .btn{text-align:center;min-height:44px;display:grid;place-items:center;text-decoration:none}\n",
    ".league-rival-actions,.league-manage-actions{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.league-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.league-actions.single{grid-template-columns:1fr}.league-actions .btn{text-align:center;min-height:44px;display:grid;place-items:center;text-decoration:none}\n"
)
replace_once(
    'app.html',
    "@media(max-width:520px){.league-topbar{grid-template-columns:1fr;align-items:stretch}.league-picker{max-width:none;width:100%}.league-rival-card,.league-manage-row{grid-template-columns:1fr}.league-rival-actions,.league-manage-actions{justify-content:flex-start}.league-standing-row{grid-template-columns:38px minmax(0,1fr) 44px 52px}.league-difference-grid{grid-template-columns:1fr}.league-manage-form{grid-template-columns:1fr}.league-manage-form .btn{min-height:44px}.league-actions{grid-template-columns:1fr 1fr}}\n",
    "@media(max-width:520px){.league-topbar{grid-template-columns:1fr;align-items:stretch}.league-picker{max-width:none;width:100%}.league-hub-head{align-items:flex-start}.league-hub-row{grid-template-columns:minmax(0,1fr) minmax(88px,auto) 14px;padding:9px}.league-hub-rank small{max-width:110px}.league-rival-card,.league-manage-row{grid-template-columns:1fr}.league-rival-actions,.league-manage-actions{justify-content:flex-start}.league-standing-row{grid-template-columns:38px minmax(0,1fr) 44px 52px}.league-difference-grid{grid-template-columns:1fr}.league-manage-form{grid-template-columns:1fr}.league-manage-form .btn{min-height:44px}.league-actions{grid-template-columns:1fr 1fr}.league-actions.single{grid-template-columns:1fr}}\n"
)

league_markup = '''  <!-- LEAGUES -->
  <section class="view league-view" id="view-league" hidden>
    <div id="leagueDataWarning"></div>
    <p class="status" id="leagueLiveStatus" aria-live="polite"></p>
    <section class="panel league-route" id="leagueHub" data-league-route="#/leagues">
      <div class="league-hub-head">
        <div><span class="eyebrow">Competitive context</span><h2 tabindex="-1">Leagues</h2><p class="hint">Your current position across every connected classic league. Tap a league for its table, nearby rivals and deeper context.</p></div>
        <a class="btn ghost sm" href="#/leagues/manage">Manage leagues</a>
      </div>
      <div id="leagueHubOut"><div class="empty"><strong>Loading your leagues</strong>Teamsheet will list the classic leagues attached to your connected FPL team.</div></div>
    </section>
    <section class="panel league-route" id="leagueLanding" data-league-route="#/leagues/detail" hidden>
      <a class="route-back" href="#/leagues" aria-label="Back to Leagues"><span aria-hidden="true">←</span></a>
      <div class="league-topbar">
        <div><span class="eyebrow">Competitive context</span><h2 tabindex="-1">League overview</h2><p class="hint">Official position, points gaps and factual squad differences. No projected rank or protect/chase strategy is implied.</p></div>
        <button class="btn ghost league-picker" id="leaguePickerButton" type="button">Choose a league</button>
      </div>
      <div id="leagueLandingOut" aria-busy="false"><div class="empty"><strong>Choose your Mini League</strong>Select a league from the Leagues hub.</div></div>
    </section>
    <section class="panel league-route" id="leagueStandings" data-league-route="#/leagues/standings" hidden>
      <a class="route-back" href="#/leagues/detail" aria-label="Back to League overview"><span aria-hidden="true">←</span></a>
      <span class="eyebrow">Official standings</span><h2 tabindex="-1">League table</h2><p class="hint">Nearby and loaded managers only. Large leagues are not scanned in full.</p>
      <div id="leagueStandingsOut"></div>
    </section>
    <section class="panel league-route" id="leagueRival" data-league-route="#/leagues/rival" hidden>
      <a class="route-back" href="#/leagues/detail" aria-label="Back to League overview"><span aria-hidden="true">←</span></a>
      <span class="eyebrow">Factual comparison</span><h2 tabindex="-1">Rival comparison</h2><p class="hint">Public picks, captaincy and exact squad overlap. Differences are not recommendations.</p>
      <div id="leagueRivalOut" aria-busy="false"></div>
    </section>
    <section class="panel league-route" id="leagueManage" data-league-route="#/leagues/manage" hidden>
      <a class="route-back" href="#/leagues" aria-label="Back to Leagues"><span aria-hidden="true">←</span></a>
      <span class="eyebrow">League selection</span><h2 tabindex="-1">Manage leagues</h2><p class="hint">Discovered public classic leagues and locally saved IDs. Identifiers stay out of the URL.</p>
      <form class="league-manage-form" id="leagueManageForm">
        <label class="fld">League ID<input type="text" id="leagueId" inputmode="numeric" autocomplete="off" placeholder="123456"></label>
        <label class="fld">Local name (optional)<input type="text" id="leagueName" maxlength="100" placeholder="Work league"></label>
        <button class="btn" type="submit">Add league</button>
      </form>
      <div id="leagueManageList" class="mt-12"></div>
    </section>
  </section>

  <!-- ASK -->'''
sub_once('app.html', r'  <!-- LEAGUES -->.*?  <!-- ASK -->', league_markup)

# ---------------------------------------------------------------------------
# Leagues behaviour: #/leagues is a lightweight all-league hub. Selecting a
# league persists the existing selectedLeagueId and enters #/leagues/detail.
# No standings request is initiated merely by opening the hub.
# ---------------------------------------------------------------------------
replace_once(
    'src/ui/mini-leagues-view.mjs',
    "    el('a',{class:'route-back',href:'#/leagues','aria-label':'Back to Leagues'},el('span',{'aria-hidden':'true'},'←')),",
    "    el('a',{class:'route-back',href:'#/leagues/detail','aria-label':'Back to League overview'},el('span',{'aria-hidden':'true'},'←')),"
)

hub_functions = r'''function miniLeagueHubCategory(league){
  const membership=miniLeagueMembership(league?.id);
  if(!membership) return 'saved';
  return String(membership.league_type||'').toLowerCase()==='x'?'invitational':'general';
}
function miniLeagueHubRank(membership){
  const rank=miniLeagueRank(membership?.entry_rank);
  if(rank!==null){
    const movement=miniLeagueMovement(rank,membership?.entry_last_rank);
    return {primary:miniLeagueOrdinal(rank),secondary:movement.delta===null?'Previous position unavailable':movement.label};
  }
  if(!membership) return {primary:'Open',secondary:'Saved locally'};
  return !S.seasonLive?{primary:'Not ranked yet',secondary:'Official FPL has not published positions yet.'}:{primary:'Position unavailable',secondary:'Official FPL position unavailable'};
}
function miniLeagueHubRow(league){
  const membership=miniLeagueMembership(league.id),rank=miniLeagueHubRank(membership),category=miniLeagueHubCategory(league);
  const context=league.primary?'Primary league':category==='invitational'?'Invitational classic':category==='general'?'General league':'Saved league';
  const open=async()=>{await selectMiniLeague(league.id);miniLeagueNavigate('#/leagues/detail');};
  return el('button',{class:'league-hub-row',type:'button','aria-label':`Open ${league.name||`League ${league.id}`}. ${rank.primary}.`,onclick:open},
    el('span',{class:'league-hub-copy'},el('strong',{},league.name||`League ${league.id}`),el('small',{},context)),
    el('span',{class:'league-hub-rank'},el('strong',{},rank.primary),el('small',{},rank.secondary)),
    el('span',{class:'league-hub-chevron','aria-hidden':'true'},'›'));
}
function miniLeagueHubSection(title,rows){
  return rows.length?el('section',{class:'league-hub-group'},el('h3',{},title),el('div',{class:'league-hub-list'},rows.map(miniLeagueHubRow))):null;
}
function renderMiniLeagueHub(){
  const out=$('leagueHubOut'); if(!out) return;
  const leagues=Array.isArray(S.miniLeagues?.saved)?S.miniLeagues.saved:[];
  if(!leagues.length){ setChildren(out,miniLeagueEmpty('No leagues found','Connect your FPL team to discover its classic leagues, or add a league manually.',miniLeagueLink('Manage leagues','#/leagues/manage','btn ghost'))); return; }
  const invitational=leagues.filter(row=>miniLeagueHubCategory(row)==='invitational');
  const general=leagues.filter(row=>miniLeagueHubCategory(row)==='general');
  const saved=leagues.filter(row=>miniLeagueHubCategory(row)==='saved');
  setChildren(out,el('div',{class:'league-hub-groups'},miniLeagueHubSection('Invitational leagues',invitational),miniLeagueHubSection('General leagues',general),miniLeagueHubSection('Saved leagues',saved)));
}

'''
replace_once('src/ui/mini-leagues-view.mjs', 'function renderLeaguePickerSummary(){', hub_functions + 'function renderLeaguePickerSummary(){')

replace_once(
    'src/ui/mini-leagues-view.mjs',
    "  const actions=el('div',{class:'league-actions'},miniLeagueLink('View standings','#/leagues/standings','btn'),miniLeagueLink('Manage leagues','#/leagues/manage','btn ghost'));",
    "  const actions=el('div',{class:'league-actions single'},miniLeagueLink('View standings','#/leagues/standings','btn'));"
)

# Child views return to the selected-league overview, not the all-league hub.
text = read('src/ui/mini-leagues-view.mjs')
text = text.replace("miniLeagueLink('Back to League','#/leagues','btn')", "miniLeagueLink('Back to League','#/leagues/detail','btn')")
write('src/ui/mini-leagues-view.mjs', text)

render_block = r'''function renderMiniLeagues(route=globalThis.location?.hash||'#/leagues'){
  renderRouteDataWarning('leagueDataWarning',{showUnavailable:true});
  if(!miniLeagueReady) return; ensureMiniLeagueExposureSection(); renderLeaguePickerSummary(); renderLeagueManageList();
  const sections=[['#/leagues',$('leagueHub')],['#/leagues/detail',$('leagueLanding')],['#/leagues/standings',$('leagueStandings')],['#/leagues/rival',$('leagueRival')],['#/leagues/exposure',$('leagueExposure')],['#/leagues/manage',$('leagueManage')]];
  const resolved=sections.some(([key])=>key===route)?route:'#/leagues'; sections.forEach(([key,node])=>{if(node) node.hidden=key!==resolved;});
  if(!S.boot&&resolved!=='#/leagues'&&resolved!=='#/leagues/manage'){
    const target=resolved==='#/leagues/detail'?$('leagueLandingOut'):resolved==='#/leagues/standings'?$('leagueStandingsOut'):resolved==='#/leagues/rival'?$('leagueRivalOut'):$('leagueExposureOut');
    setChildren(target,miniLeagueEmpty('Official FPL data is unavailable','League position and public rival facts cannot be verified until core Official FPL data loads.',miniLeagueLink('Back to Leagues','#/leagues','btn ghost')));
    renderMiniLeagueHub();
    return;
  }
  renderMiniLeagueHub(); renderMiniLeagueLanding(); renderMiniLeagueStandings(); renderMiniLeagueRival(); renderMiniLeagueExposure();
}
'''
sub_once('src/ui/mini-leagues-view.mjs', r"function renderMiniLeagues\(route=globalThis\.location\?\.hash\|\|'#/leagues'\)\{.*?\n\}\nfunction renderLeagueChips", render_block + 'function renderLeagueChips')

init_block = r'''async function initMiniLeagues(legacyConfig={}){
  ensureMiniLeagueExposureSection(); await initMiniLeagueState(legacyConfig); miniLeagueReady=true;
  const picker=$('leaguePickerButton'); picker?.addEventListener('click',()=>miniLeagueNavigate('#/leagues'));
  $('leagueRefreshButton')?.addEventListener('click',()=>loadMiniLeagueStandings({force:true}));
  $('leagueManageForm')?.addEventListener('submit',async event=>{event.preventDefault();const id=miniLeagueId($('leagueId')?.value),name=$('leagueName')?.value?.trim()||'';if(!id){miniLeagueAnnounce("Add a valid league ID first — it is the number in the league's URL.");return;}await upsertMiniLeague(id,name,{select:true});if($('leagueId'))$('leagueId').value='';if($('leagueName'))$('leagueName').value='';renderMiniLeagues();miniLeagueNavigate('#/leagues/detail');});
  document.addEventListener('teamsheet:route-change',event=>{const route=event.detail?.route||'#/leagues';if(!route.startsWith('#/leagues')) return;renderMiniLeagues(route);const needsStandings=['#/leagues/detail','#/leagues/standings','#/leagues/rival','#/leagues/exposure'].includes(route);if(needsStandings&&selectedMiniLeague()&&!miniLeagueSelectedData()) void loadMiniLeagueStandings();if(route==='#/leagues/rival') void loadMiniLeagueRival();});
  document.addEventListener('teamsheet:data-rendered',async()=>{await mergeDiscoveredMiniLeagues(S.entry);renderMiniLeagues();const route=globalThis.location?.hash||'';const needsStandings=['#/leagues/detail','#/leagues/standings','#/leagues/rival','#/leagues/exposure'].includes(route);if(needsStandings&&selectedMiniLeague()) void loadMiniLeagueStandings({force:true});});
  const initialRoute=globalThis.location?.hash||'#/leagues';
  renderMiniLeagues(initialRoute);
  if(initialRoute==='#/leagues/exposure') $('leagueExposure')?.querySelector?.('h2')?.focus?.({preventScroll:true});
}
'''
sub_once('src/ui/mini-leagues-view.mjs', r"async function initMiniLeagues\(legacyConfig=\{\}\)\{.*?\n\}\n\nexport \{", init_block + '\nexport {')

# Manage-list selection should open the chosen league overview.
replace_once(
    'src/ui/mini-leagues-view.mjs',
    "onclick:async()=>{await selectMiniLeague(row.id);renderMiniLeagues();miniLeagueNavigate('#/leagues');}",
    "onclick:async()=>{await selectMiniLeague(row.id);renderMiniLeagues();miniLeagueNavigate('#/leagues/detail');}"
)

# ---------------------------------------------------------------------------
# Tests: preserve all existing model/provider guards while asserting the new
# hub/detail hierarchy and the no-fetch-on-hub boundary.
# ---------------------------------------------------------------------------
replace_once(
    'tests/mini-leagues-ui.test.mjs',
    "test('Leagues has separate landing, standings, rival and manage surfaces',()=>{\n  includesAll(app,['id=\"leagueLanding\"','id=\"leagueStandings\"','id=\"leagueRival\"','id=\"leagueManage\"','data-league-route=\"#/leagues/standings\"','data-league-route=\"#/leagues/rival\"']);",
    "test('Leagues has separate all-league hub, selected-league overview, standings, rival and manage surfaces',()=>{\n  includesAll(app,['id=\"leagueHub\"','data-league-route=\"#/leagues\"','id=\"leagueLanding\"','data-league-route=\"#/leagues/detail\"','id=\"leagueStandings\"','id=\"leagueRival\"','id=\"leagueManage\"','data-league-route=\"#/leagues/standings\"','data-league-route=\"#/leagues/rival\"']);"
)
replace_once(
    'tests/mini-leagues-ui.test.mjs',
    "  includesAll(shell,[\"'#/leagues/standings'\",\"'#/leagues/rival'\",\"'#/leagues/exposure'\",\"'#/leagues/manage'\",\"route.startsWith('#/leagues')\"]);",
    "  includesAll(shell,[\"'#/leagues/detail'\",\"'#/leagues/standings'\",\"'#/leagues/rival'\",\"'#/leagues/exposure'\",\"'#/leagues/manage'\",\"route.startsWith('#/leagues')\"]);"
)
replace_once(
    'tests/mini-leagues-ui.test.mjs',
    "  includesAll(landing,['league-position-line','league-status-row',\"miniLeagueLink('View standings','#/leagues/standings','btn')\",\"miniLeagueLink('Manage leagues','#/leagues/manage','btn ghost')\"]);\n  excludesAll(landing,[\"miniLeagueLink('Review Team'\",\"miniLeagueLink('Review Transfers'\"]);",
    "  includesAll(landing,['league-position-line','league-status-row',\"class:'league-actions single'\",\"miniLeagueLink('View standings','#/leagues/standings','btn')\"]);\n  excludesAll(landing,[\"miniLeagueLink('Manage leagues','#/leagues/manage','btn ghost')\",\"miniLeagueLink('Review Team'\",\"miniLeagueLink('Review Transfers'\"]);"
)

hub_test = r'''
test('Leagues opens with a lightweight all-league standings hub before selected-league detail',()=>{
  const hubStart=view.indexOf('function renderMiniLeagueHub(){');
  const hub=view.slice(hubStart,view.indexOf('function renderLeaguePickerSummary',hubStart));
  includesAll(app,['id="leagueHub"','id="leagueHubOut"','Your current position across every connected classic league','href="#/leagues/manage"','.league-hub-row{appearance:none']);
  includesAll(hub,['Invitational leagues','General leagues','Saved leagues','entry_rank','entry_last_rank',"league_type||''","miniLeagueNavigate('#/leagues/detail')"]);
  excludesAll(hub,['loadMiniLeagueStandings','/standings/?page_standings']);
  const routeHandler=view.slice(view.indexOf("document.addEventListener('teamsheet:route-change'"),view.indexOf("document.addEventListener('teamsheet:data-rendered'"));
  includesAll(routeHandler,["['#/leagues/detail','#/leagues/standings','#/leagues/rival','#/leagues/exposure'].includes(route)",'needsStandings']);
});

'''
replace_once('tests/mini-leagues-ui.test.mjs', "test('League accessibility has route focus, live status and named back controls',()=>{", hub_test + "test('League accessibility has route focus, live status and named back controls',()=>{")

replace_once(
    'tests/navigation-settings.test.mjs',
    "  for(const route of ['#/leagues/standings','#/leagues/rival','#/leagues/exposure','#/leagues/manage']){",
    "  for(const route of ['#/leagues/detail','#/leagues/standings','#/leagues/rival','#/leagues/exposure','#/leagues/manage']){"
)

# ---------------------------------------------------------------------------
# Canonical design/decision documentation.
# ---------------------------------------------------------------------------
design = '''# Leagues Hub-First Design\n\nStatus: owner-approved implementation scope, 7 August 2026.\n\n## Outcome\n\n`#/leagues` is the user's all-league hub. It lists every classic league attached to the connected Official FPL entry, grouped into invitational and general leagues when Official FPL supplies the league type. A separately saved league that is not present in the connected entry remains visible under Saved leagues.\n\nEach row shows the league name and the user's Official FPL membership position/movement when a positive published rank exists. Rank `0`, null or otherwise unpublished values are never presented as a real position; pre-season uses **Not ranked yet**.\n\nTapping a league stores the existing selected league choice and opens the ID-free `#/leagues/detail` overview. Existing `#/leagues/standings`, `#/leagues/rival` and `#/leagues/exposure` remain deeper selected-league destinations. `#/leagues/manage` remains a secondary control from the hub.\n\n## Data and performance boundary\n\nThe hub uses only the already-loaded Official FPL entry/classic-league membership facts and locally saved league choices. Opening `#/leagues` does **not** fetch standings for every league. Standings requests begin only after a user opens a specific league or one of its deeper selected-league routes. Large-league targeted pagination and on-demand rival squad loading remain unchanged.\n\n## Exclusions\n\nNo provider, endpoint, authentication, rank projection, effective ownership, rival score prediction, strategy model, transfer logic, squad logic, fixture logic or projection formula changes are included. No league or manager identifier is added to the URL.\n\n## Acceptance\n\nAutomated coverage must prove the hub/detail route hierarchy, grouped league membership rows, rank/movement presentation, full-row keyboard/touch semantics, no standings fetch on the hub, existing targeted pagination and no-strategy/model guards. Physical iPhone Safari acceptance remains required for the new hub and selected-league transition before the Leagues populated/live checkpoint can close.\n'''
Path('docs/LEAGUES-HUB-DESIGN.md').write_text(design,encoding='utf-8')

architecture = read('docs/ARCHITECTURE.md')
needle = "`ui/app-shell.mjs` owns the implemented Team, Transfers, Fixtures, Leagues and Settings primary destinations, the secondary Ask Teamsheet route, hash normalisation, legacy aliases, browser history, active-link state, route focus and the five-section Settings hierarchy. The old direct click-to-hide navigation in `ui/views.mjs` is removed.\n"
if architecture.count(needle) != 1:
    raise SystemExit('ARCHITECTURE.md: routing boundary anchor not found exactly once')
architecture = architecture.replace(needle, needle + "\nWithin Leagues, `#/leagues` is a lightweight all-league membership hub and `#/leagues/detail` is the selected-league overview. The hub uses already-loaded entry membership facts and does not fan out standings requests; `#/leagues/standings`, `#/leagues/rival` and `#/leagues/exposure` remain ID-free child destinations that load only the selected league context.\n", 1)
write('docs/ARCHITECTURE.md',architecture)

decisions = read('docs/DECISIONS.md')
marker = '**D-37 · 2026-08-07 · Accepted · Leagues opens with an all-league hub before selected-league detail**'
if marker in decisions:
    raise SystemExit('DECISIONS.md: D-37 already exists')
decisions += '''\n\n**D-37 · 2026-08-07 · Accepted · Leagues opens with an all-league hub before selected-league detail**\n\nReason: populated iPhone review showed that opening Leagues directly into one preselected league hides the user's competitive context across their other leagues. The owner wants the first Leagues screen to resemble Official FPL's league directory: every league visible at a glance, then deeper information after choosing one.\n\nApproach: `#/leagues` becomes a lightweight all-league hub using the already-loaded Official FPL classic-league membership list plus locally saved leagues. Positive published membership ranks and supplied previous ranks are shown without fetching every standings table; unpublished pre-season rank remains `Not ranked yet`. Tapping a row persists the existing selected league and opens new ID-free `#/leagues/detail`. Existing standings, rival and selected-rival exposure routes become children of that detail route. Manage leagues is secondary from the hub.\n\nConsequences: no full-league or all-league standings fanout, no provider/endpoint/authentication change, no rank projection, effective ownership, rival prediction, protect/balanced/chase strategy, transfer, squad, fixture or projection-model change. Large-league targeted pages and on-demand rival public-picks loading remain unchanged. Physical iPhone Safari acceptance is required before the Leagues live/populated checkpoint closes. See `docs/LEAGUES-HUB-DESIGN.md`.\n'''
write('docs/DECISIONS.md',decisions)

print('Leagues hub edits applied successfully')
