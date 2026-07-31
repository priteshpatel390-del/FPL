#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, content):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one exact match, found {count}')
    write(path, text.replace(old, new, 1))


def sub_once(path, pattern, replacement, flags=0):
    text = read(path)
    match = re.search(pattern, text, flags)
    if not match:
        raise RuntimeError(f'{path}: pattern not found: {pattern[:100]}')
    updated = re.sub(pattern, lambda _match: replacement, text, count=1, flags=flags)
    write(path, updated)


APP_SHELL = r'''// Teamsheet 2.0.1 app shell — primary navigation, URL routing and Settings hierarchy.
// Reorganises existing DOM nodes without changing model, provider or persistence behaviour.

const TEAMSHEET_PRIMARY_ROUTES = Object.freeze([
  Object.freeze({route:'#/team',key:'team',icon:'◈',label:'Team'}),
  Object.freeze({route:'#/transfers',key:'transfers',icon:'⇄',label:'Transfers'}),
  Object.freeze({route:'#/fixtures',key:'fixtures',icon:'▦',label:'Fixtures'}),
  Object.freeze({route:'#/leagues',key:'leagues',icon:'⚑',label:'Leagues'}),
  Object.freeze({route:'#/settings',key:'settings',icon:'⚙',label:'Settings'})
]);

const TEAMSHEET_ROUTE_ALIASES = Object.freeze({
  '':'#/team',
  '#':'#/team',
  '#team':'#/team',
  '#squad':'#/team',
  '#players':'#/settings/research/players',
  '#transfers':'#/transfers',
  '#fixtures':'#/fixtures',
  '#league':'#/leagues',
  '#mini-leagues':'#/leagues',
  '#more':'#/settings',
  '#settings':'#/settings',
  '#ask':'#/ask',
  '#/players':'#/settings/research/players',
  '#/league':'#/leagues',
  '#/mini-leagues':'#/leagues',
  '#/more':'#/settings',
  '#/settings/research':'#/settings/research/players'
});

const TEAMSHEET_VALID_ROUTES = new Set([
  ...TEAMSHEET_PRIMARY_ROUTES.map(item=>item.route),
  '#/ask',
  '#/settings/team-account',
  '#/settings/research/players',
  '#/settings/evidence',
  '#/settings/data',
  '#/settings/help'
]);

function normaliseTeamsheetRoute(value=''){
  let route=String(value??'').trim();
  if(Object.prototype.hasOwnProperty.call(TEAMSHEET_ROUTE_ALIASES,route)) return TEAMSHEET_ROUTE_ALIASES[route];
  if(route.startsWith('/')&&!route.startsWith('#/')) route='#'+route;
  else if(route.startsWith('#')&&!route.startsWith('#/')) route='#/'+route.slice(1).replace(/^\/+/, '');
  else if(!route.startsWith('#/')) route='#/'+route.replace(/^\/+/, '');
  route=route.replace(/\/+$/,'');
  if(Object.prototype.hasOwnProperty.call(TEAMSHEET_ROUTE_ALIASES,route)) return TEAMSHEET_ROUTE_ALIASES[route];
  return TEAMSHEET_VALID_ROUTES.has(route)?route:'#/team';
}

function teamsheetRouteMeta(value=''){
  const route=normaliseTeamsheetRoute(value);
  const table={
    '#/team':{title:'Team',primary:'team'},
    '#/transfers':{title:'Transfers',primary:'transfers'},
    '#/fixtures':{title:'Fixtures',primary:'fixtures'},
    '#/leagues':{title:'Leagues',primary:'leagues'},
    '#/settings':{title:'Settings',primary:'settings'},
    '#/settings/team-account':{title:'Team & Account',primary:'settings',settings:'team-account'},
    '#/settings/research/players':{title:'Player Explorer',primary:'settings',settings:'research-players'},
    '#/settings/evidence':{title:'Evidence & Performance',primary:'settings',settings:'evidence'},
    '#/settings/data':{title:'Data & Diagnostics',primary:'settings',settings:'data'},
    '#/settings/help':{title:'Help & About',primary:'settings',settings:'help'},
    '#/ask':{title:'Ask Teamsheet',primary:null}
  };
  return Object.freeze({route,...table[route]});
}

function teamsheetElement(tag,attributes={},...children){
  const node=document.createElement(tag);
  Object.entries(attributes).forEach(([key,value])=>{
    if(value===null||value===undefined||value===false) return;
    if(key==='class') node.className=String(value);
    else if(key==='text') node.textContent=String(value);
    else node.setAttribute(key,String(value));
  });
  children.flat(Infinity).filter(child=>child!==null&&child!==undefined&&child!==false).forEach(child=>{
    node.appendChild(child?.nodeType?child:document.createTextNode(String(child)));
  });
  return node;
}

function teamsheetRouteHeader(eyebrow,title,hint){
  const header=teamsheetElement('div',{class:'route-header'},
    teamsheetElement('a',{class:'route-back',href:'#/settings'},'← Settings'),
    teamsheetElement('span',{class:'eyebrow'},eyebrow),
    teamsheetElement('h2',{tabindex:'-1'},title),
    teamsheetElement('p',{class:'hint'},hint));
  return header;
}

function teamsheetSettingsCard(route,icon,title,copy){
  return teamsheetElement('a',{class:'settings-card',href:route},
    teamsheetElement('span',{class:'settings-card-icon','aria-hidden':'true'},icon),
    teamsheetElement('span',{class:'settings-card-copy'},
      teamsheetElement('h3',{},title),
      teamsheetElement('span',{class:'settings-card-description'},copy)),
    teamsheetElement('span',{class:'settings-card-arrow','aria-hidden':'true'},'›'));
}

function setupAppShell(){
  if(typeof document==='undefined'||
     typeof document.querySelector!=='function'||
     typeof document.getElementById!=='function'||
     typeof document.createElement!=='function'||
     typeof document.createTextNode!=='function') return;

  const nav=document.querySelector('nav.tabs');
  const main=document.querySelector('main');
  const header=document.querySelector('header');
  const teamView=document.getElementById('view-squad');
  const transfersView=document.getElementById('view-transfers');
  const fixturesView=document.getElementById('view-fixtures');
  const leaguesView=document.getElementById('view-league');
  const playersView=document.getElementById('view-players');
  const askView=document.getElementById('view-ask');
  const setupPanel=document.getElementById('setupPanel');
  const evidencePanel=document.getElementById('evidencePanel');
  const manualWrap=document.getElementById('manualWrap');
  const squadOut=document.getElementById('squadOut');

  if(!nav||!main||!teamView||!transfersView||!fixturesView||!leaguesView||!playersView||!askView||!setupPanel||!evidencePanel) return;

  nav.textContent='';
  nav.removeAttribute('role');
  nav.setAttribute('aria-label','Primary');
  const navLinks=TEAMSHEET_PRIMARY_ROUTES.map(item=>{
    const link=teamsheetElement('a',{class:'tab',href:item.route,'data-primary':item.key},
      teamsheetElement('span',{class:'ic','aria-hidden':'true'},item.icon),
      teamsheetElement('span',{class:'tab-label'},item.label));
    nav.appendChild(link);
    return link;
  });

  const teamHeading=teamView.querySelector('h2');
  const teamHint=teamView.querySelector('.hint');
  if(teamHeading) teamHeading.textContent='Team';
  if(teamHint) teamHint.textContent='Your XI, captaincy, bench and weekly FPL resources in one place.';

  const setupRows=Array.from(setupPanel.children).filter(child=>child.classList?.contains('row'));
  const teamContext=teamsheetElement('section',{id:'teamContext',class:'team-context','aria-labelledby':'teamContextTitle'},
    teamsheetElement('div',{class:'team-context-head'},
      teamsheetElement('div',{},
        teamsheetElement('span',{class:'eyebrow'},'Weekly resources'),
        teamsheetElement('h3',{id:'teamContextTitle'},'Your FPL context')),
      teamsheetElement('span',{class:'status'},'Free transfers and bank stay visible on Team.')));
  setupRows.slice(0,2).forEach(row=>teamContext.appendChild(row));
  ['status','srcStatus','chipState'].map(id=>document.getElementById(id)).filter(Boolean).forEach(node=>teamContext.appendChild(node));
  if(squadOut) teamView.insertBefore(teamContext,squadOut);
  else teamView.appendChild(teamContext);

  const askCallout=teamsheetElement('aside',{class:'ask-callout','aria-labelledby':'askCalloutTitle'},
    teamsheetElement('div',{},
      teamsheetElement('span',{class:'eyebrow'},'Regular decision support'),
      teamsheetElement('h3',{id:'askCalloutTitle'},'Ask Teamsheet'),
      teamsheetElement('p',{},'Ask about captaincy, transfers, injuries, rotation or chip timing using your current squad context.')),
    teamsheetElement('a',{class:'btn claret',href:'#/ask'},'Ask Teamsheet'));
  if(teamContext.nextSibling) teamView.insertBefore(askCallout,teamContext.nextSibling);
  else teamView.appendChild(askCallout);

  const fixturesHeading=fixturesView.querySelector('h2');
  if(fixturesHeading) fixturesHeading.textContent='Fixtures';
  const leaguesHeading=leaguesView.querySelector('h2');
  const leaguesEyebrow=leaguesView.querySelector('.eyebrow');
  const leaguesHint=leaguesView.querySelector('.hint');
  if(leaguesHeading) leaguesHeading.textContent='Leagues';
  if(leaguesEyebrow) leaguesEyebrow.textContent='Mini leagues';
  if(leaguesHint) leaguesHint.textContent='Compare your squad with saved FPL mini leagues. Rank movement and deeper league intelligence arrive in later Teamsheet 2.0 checkpoints.';
  const playersHeading=playersView.querySelector('h2');
  const playersEyebrow=playersView.querySelector('.eyebrow');
  if(playersHeading) playersHeading.textContent='Player Explorer';
  if(playersEyebrow) playersEyebrow.textContent='Research tools';
  const askHeading=askView.querySelector('h2');
  const askEyebrow=askView.querySelector('.eyebrow');
  if(askHeading) askHeading.textContent='Ask Teamsheet';
  if(askEyebrow) askEyebrow.textContent='Decision assistant';
  askView.insertBefore(teamsheetElement('a',{class:'route-back',href:'#/team'},'← Team'),askView.firstChild);

  const settingsView=teamsheetElement('section',{id:'view-settings',class:'view settings-view',hidden:'hidden'});
  const settingsHeader=teamsheetElement('div',{class:'panel settings-header'},
    teamsheetElement('span',{class:'eyebrow'},'Organised controls'),
    teamsheetElement('h2',{id:'settingsTitle',tabindex:'-1'},'Settings'),
    teamsheetElement('p',{class:'hint'},'Team setup, research, evidence, provider detail and help—separated by purpose rather than one long page.'));
  const settingsLanding=teamsheetElement('div',{id:'settingsLanding',class:'settings-grid'},
    teamsheetSettingsCard('#/settings/team-account','◈','Team & Account','Manual squad editing and account setup guidance.'),
    teamsheetSettingsCard('#/settings/research/players','↗','Research Tools','Explore player projections and supporting detail.'),
    teamsheetSettingsCard('#/settings/evidence','✓','Evidence & Performance','Deadline records, official outcomes, metrics, reviews and exports.'),
    teamsheetSettingsCard('#/settings/data','⌁','Data & Diagnostics','Provider Health, optional sources, calibration and recovery detail.'),
    teamsheetSettingsCard('#/settings/help','?','Help & About','How Teamsheet works, limitations, privacy and build information.'));
  settingsView.append(settingsHeader,settingsLanding);

  const settingsTeam=teamsheetElement('section',{id:'settings-team-account',class:'settings-subview',hidden:'hidden'},
    teamsheetRouteHeader('Settings','Team & Account','Manual squad controls live here. Team ID, free transfers and bank remain visible on Team because they directly affect weekly decisions.'));
  const manualPanel=teamsheetElement('section',{class:'panel'},
    teamsheetElement('span',{class:'eyebrow'},'Squad setup'),
    teamsheetElement('h2',{},'Manual squad'),
    teamsheetElement('p',{class:'hint'},'Build or correct the 15-player squad used when manual mode is enabled.'));
  if(manualWrap){
    manualWrap.open=true;
    manualPanel.appendChild(manualWrap);
  }else manualPanel.appendChild(teamsheetElement('p',{class:'status'},'Manual squad controls are unavailable.'));
  settingsTeam.appendChild(manualPanel);

  const settingsResearch=teamsheetElement('section',{id:'settings-research-players',class:'settings-subview',hidden:'hidden'},
    teamsheetRouteHeader('Settings · Research Tools','Player Explorer','Research individual projections without restoring Players to primary navigation.'));
  playersView.classList.remove('view');
  playersView.hidden=false;
  settingsResearch.appendChild(playersView);

  const settingsEvidence=teamsheetElement('section',{id:'settings-evidence',class:'settings-subview',hidden:'hidden'},
    teamsheetRouteHeader('Settings','Evidence & Performance','Prospective records, official outcomes, descriptive metrics, operating review and owner-controlled exports.'));
  evidencePanel.hidden=false;
  settingsEvidence.appendChild(evidencePanel);

  const healthPanel=teamsheetElement('section',{id:'providerHealthDetail',class:'panel',tabindex:'-1','aria-labelledby':'providerHealthTitle'},
    teamsheetElement('span',{class:'eyebrow'},'Current session'),
    teamsheetElement('h2',{id:'providerHealthTitle'},'Provider Health'),
    teamsheetElement('p',{class:'hint'},'Which approved data source is active, how fresh it is and what any fallback changes.'),
    teamsheetElement('div',{id:'providerHealthRows'}));
  const setupEyebrow=setupPanel.querySelector('.eyebrow');
  const setupHeading=setupPanel.querySelector('h2');
  const setupHint=setupPanel.querySelector('.hint');
  if(setupEyebrow) setupEyebrow.textContent='Data & diagnostics';
  if(setupHeading) setupHeading.textContent='Optional data and calibration';
  if(setupHint) setupHint.textContent='Manage optional provider inputs and the existing historical calibration control.';
  const settingsData=teamsheetElement('section',{id:'settings-data',class:'settings-subview',hidden:'hidden'},
    teamsheetRouteHeader('Settings','Data & Diagnostics','Provider status, optional source controls and calibration detail.'));
  settingsData.append(healthPanel,setupPanel);

  const settingsHelp=teamsheetElement('section',{id:'settings-help',class:'settings-subview',hidden:'hidden'},
    teamsheetRouteHeader('Settings','Help & About','Plain-English guidance about recommendations, limitations, privacy and this build.'),
    teamsheetElement('section',{class:'panel'},
      teamsheetElement('span',{class:'eyebrow'},'About Teamsheet'),
      teamsheetElement('h2',{},'FPL Decision Desk'),
      teamsheetElement('p',{class:'hint'},'Teamsheet is advisory. It does not submit transfers, captaincy or squad changes to Official FPL.'),
      teamsheetElement('div',{class:'note plain'},
        teamsheetElement('b',{},'Current limitation: '),
        'Ask Teamsheet works keylessly only in the approved artifact-preview environment until a separately approved serverless migration.'),
      teamsheetElement('div',{class:'note plain'},
        teamsheetElement('b',{},'Evidence wording: '),
        'Prospective metrics remain descriptive until enough genuine pre-deadline observations exist.'),
      teamsheetElement('p',{class:'status mono'},'Build identity is recorded in the generated manifest and deployable.')));

  [settingsTeam,settingsResearch,settingsEvidence,settingsData,settingsHelp].forEach(section=>settingsView.appendChild(section));
  main.appendChild(settingsView);

  const headerActions=header?teamsheetElement('div',{id:'headerActions',class:'header-actions'}):null;
  if(headerActions) header.appendChild(headerActions);
  if(headerActions&&!document.getElementById('providerHealthCompact')){
    const compact=teamsheetElement('button',{id:'providerHealthCompact',type:'button',class:'chip','aria-controls':'providerHealthDetail','aria-label':'Provider Health: waiting for first data load'},
      'Data ',teamsheetElement('span',{class:'flag dark'},'Waiting'));
    compact.addEventListener('click',()=>{
      globalThis.__teamsheetNavigate?.('#/settings/data');
      setTimeout(()=>healthPanel.focus?.({preventScroll:true}),0);
    });
    headerActions.appendChild(compact);
  }
  if(headerActions){
    headerActions.appendChild(teamsheetElement('a',{id:'askTeamsheetCompact',class:'chip',href:'#/ask','aria-label':'Open Ask Teamsheet'},'Ask Teamsheet'));
  }

  const topLevelViews=[teamView,transfersView,fixturesView,leaguesView,settingsView,askView];
  const settingsSubviews=new Map([
    ['#/settings/team-account',settingsTeam],
    ['#/settings/research/players',settingsResearch],
    ['#/settings/evidence',settingsEvidence],
    ['#/settings/data',settingsData],
    ['#/settings/help',settingsHelp]
  ]);
  const routeNodes=new Map([
    ['#/team',teamView],
    ['#/transfers',transfersView],
    ['#/fixtures',fixturesView],
    ['#/leagues',leaguesView],
    ['#/settings',settingsView],
    ['#/ask',askView]
  ]);

  const activateRoute=(requested,{focus=false}={})=>{
    const route=normaliseTeamsheetRoute(requested);
    const meta=teamsheetRouteMeta(route);
    if(globalThis.location?.hash!==route) globalThis.history?.replaceState?.(null,'',route);

    topLevelViews.forEach(view=>{
      const active=route.startsWith('#/settings')?view===settingsView:view===routeNodes.get(route);
      view.hidden=!active;
      view.setAttribute('aria-hidden',active?'false':'true');
    });
    settingsLanding.hidden=route!=='#/settings';
    settingsSubviews.forEach((section,sectionRoute)=>{ section.hidden=sectionRoute!==route; });
    navLinks.forEach(link=>{
      if(link.dataset.primary===meta.primary) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    });
    document.body.dataset.route=route.slice(2);
    document.title=`${meta.title} — Teamsheet`;
    globalThis.scrollTo?.({top:0,left:0});
    if(focus){
      const activeNode=route.startsWith('#/settings')?(settingsSubviews.get(route)||settingsView):(routeNodes.get(route)||teamView);
      const heading=activeNode.querySelector('h2');
      heading?.focus?.({preventScroll:true});
    }
    document.dispatchEvent?.(new CustomEvent('teamsheet:route-change',{detail:{route,primary:meta.primary}}));
    return route;
  };

  const navigateTeamsheetRoute=(requested,{replace=false}={})=>{
    const route=normaliseTeamsheetRoute(requested);
    if(replace){
      globalThis.history?.replaceState?.(null,'',route);
      activateRoute(route,{focus:true});
    }else if(globalThis.location?.hash===route) activateRoute(route,{focus:true});
    else if(globalThis.location) globalThis.location.hash=route;
    return route;
  };
  globalThis.__teamsheetNavigate=navigateTeamsheetRoute;
  globalThis.addEventListener?.('hashchange',()=>activateRoute(globalThis.location?.hash,{focus:true}));

  const initial=normaliseTeamsheetRoute(globalThis.location?.hash||'');
  if(globalThis.location?.hash!==initial) globalThis.history?.replaceState?.(null,'',initial);
  activateRoute(initial);
}

setupAppShell();

export { TEAMSHEET_PRIMARY_ROUTES, normaliseTeamsheetRoute, teamsheetRouteMeta, setupAppShell };
'''
write('src/ui/app-shell.mjs', APP_SHELL)

# app.html: route-aware navigation and the approved responsive hierarchy.
replace_once(
    'app.html',
    ".tab[aria-selected=true]{color:var(--claret);background:#F7EEF0}\n.view[hidden]{display:none}",
    ".tab[aria-selected=true],.tab[aria-current=page]{color:var(--claret);background:#F7EEF0}\n.tab{text-decoration:none;min-width:0}.tab-label{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.view[hidden],.settings-subview[hidden],#settingsLanding[hidden]{display:none}"
)

TEAMSHEET_CSS = r'''

/* Teamsheet 2.0.1 — route hierarchy, five-tab navigation and Settings menu */
.header-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#providerHealthCompact,#evidenceCompact,#askTeamsheetCompact{margin-top:10px;min-height:38px;background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.28);color:#fff;text-decoration:none}
#providerHealthCompact:hover,#evidenceCompact:hover,#askTeamsheetCompact:hover{background:rgba(255,255,255,.16);color:#fff}
.team-context{border:1px solid var(--line);border-radius:var(--r);background:#F7F9F5;padding:14px;margin:14px 0}
.team-context-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:10px}
.team-context-head h3{font-size:16px}.team-context-head>.status{max-width:300px;text-align:right}
.ask-callout{border:1px solid #E3D3D7;border-radius:var(--r);background:#F7EEF0;padding:14px;margin:0 0 14px;display:flex;gap:14px;align-items:center;justify-content:space-between}
.ask-callout p{margin:4px 0 0;color:var(--ink-soft);font-size:13px}.ask-callout .btn{flex:0 0 auto;text-decoration:none}
.settings-header{margin-bottom:12px}.settings-grid{display:grid;gap:10px}
.settings-card{display:grid;grid-template-columns:40px minmax(0,1fr) 18px;align-items:center;gap:10px;min-height:82px;padding:14px;border:1px solid var(--line);border-radius:var(--r);background:var(--panel);box-shadow:var(--shadow);color:var(--ink);text-decoration:none}
.settings-card:hover{background:#F7F9F5;border-color:#BFC7BC}.settings-card:focus-visible{outline:2.5px solid var(--info);outline-offset:2px}
.settings-card-icon{display:grid;place-items:center;width:40px;height:40px;border-radius:10px;background:#EAF0EB;color:var(--pitch);font-size:19px;font-weight:800}
.settings-card-copy{min-width:0}.settings-card h3{font-size:15px;margin:0}.settings-card-description{display:block;color:var(--ink-soft);font-size:12.5px;margin-top:2px}
.settings-card-arrow{font-size:25px;color:var(--ink-soft)}
.route-header{margin-bottom:12px}.route-header h2{font-size:20px;margin-top:5px}.route-header .hint{margin:3px 0 0;color:var(--ink-soft);font-size:13px}
.route-back{display:inline-flex;min-height:44px;align-items:center;color:var(--claret);font-weight:700;text-decoration:none;margin:0 0 6px}
.route-back:hover{text-decoration:underline}
.settings-subview>.panel:last-child{margin-bottom:0}
@media(min-width:720px){.settings-grid{grid-template-columns:1fr 1fr}.settings-card:last-child{grid-column:1/-1}}
'''
replace_once('app.html', '\n@media(max-width:520px){', TEAMSHEET_CSS + '\n@media(max-width:520px){')
replace_once(
    'app.html',
    "  main{padding:12px}.panel{padding:14px}.row{align-items:stretch}.row>label.fld{flex:1 1 135px}\n  .row>.btn:not(.sm){flex:1 1 100%}.bar{grid-template-columns:minmax(86px,112px) 1fr 42px;gap:6px}",
    "  main{padding:12px}.panel{padding:14px}.row{align-items:stretch}.row>label.fld{flex:1 1 135px}\n  nav.tabs{padding-left:2px;padding-right:2px}.tab{font-size:9px;padding-left:0;padding-right:0}.tab .ic{font-size:15px}\n  .team-context-head>.status{text-align:left}.ask-callout{align-items:stretch;flex-direction:column}.ask-callout .btn{text-align:center}\n  .row>.btn:not(.sm){flex:1 1 100%}.bar{grid-template-columns:minmax(86px,112px) 1fr 42px;gap:6px}"
)

OLD_NAV = '''<nav class="tabs" role="tablist">
  <button class="tab" role="tab" data-view="fixtures" aria-selected="true"><span class="ic">▦</span>Fixtures</button>
  <button class="tab" role="tab" data-view="players" aria-selected="false"><span class="ic">↗</span>Points</button>
  <button class="tab" role="tab" data-view="squad" aria-selected="false"><span class="ic">◈</span>Squad</button>
  <button class="tab" role="tab" data-view="transfers" aria-selected="false"><span class="ic">⇄</span>Transfers</button>
  <button class="tab" role="tab" data-view="league" aria-selected="false"><span class="ic">⚑</span>League</button>
  <button class="tab" role="tab" data-view="ask" aria-selected="false"><span class="ic">✎</span>Ask</button>
</nav>'''
NEW_NAV = '''<nav class="tabs" aria-label="Primary">
  <a class="tab" href="#/team"><span class="ic" aria-hidden="true">◈</span><span class="tab-label">Team</span></a>
  <a class="tab" href="#/transfers"><span class="ic" aria-hidden="true">⇄</span><span class="tab-label">Transfers</span></a>
  <a class="tab" href="#/fixtures"><span class="ic" aria-hidden="true">▦</span><span class="tab-label">Fixtures</span></a>
  <a class="tab" href="#/leagues"><span class="ic" aria-hidden="true">⚑</span><span class="tab-label">Leagues</span></a>
  <a class="tab" href="#/settings"><span class="ic" aria-hidden="true">⚙</span><span class="tab-label">Settings</span></a>
</nav>'''
replace_once('app.html', OLD_NAV, NEW_NAV)
replace_once('app.html', '<h2>Fixture ticker</h2>', '<h2>Fixtures</h2>')
replace_once('app.html', '<h2>Mini-league read</h2>', '<h2>Leagues</h2>')
replace_once('app.html', '<h2>Ask about a decision</h2>', '<h2>Ask Teamsheet</h2>')

# The router exclusively owns destination changes. Ordinary question chips are scoped explicitly.
OLD_TAB_WIRING = '''document.querySelectorAll('.tab').forEach((t, i, all) => {
  t.addEventListener('click', () => {
    all.forEach(x => x.setAttribute('aria-selected', x === t));
    document.querySelectorAll('.view').forEach(v => v.hidden = v.id !== 'view-' + t.dataset.view);
    window.scrollTo({top:0, behavior:'smooth'});
  });
  t.addEventListener('keydown', e => {
    if(e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = all[(i + (e.key === 'ArrowRight' ? 1 : all.length-1)) % all.length];
    next.focus(); next.click();
  });
});
document.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => { $('q').value = c.dataset.q; ask(); }));'''
NEW_TAB_WIRING = '''// Teamsheet 2.0.1: app-shell.mjs owns hash routing, history and focus.
document.querySelectorAll('[data-q]').forEach(c => c.addEventListener('click', () => { $('q').value = c.dataset.q; ask(); }));'''
replace_once('src/ui/views.mjs', OLD_TAB_WIRING, NEW_TAB_WIRING)
replace_once('src/ui/views.mjs', 'For now, the Ask tab is available only inside Claude\'s artifact preview;', 'For now, Ask Teamsheet is available only inside Claude\'s artifact preview;')

OLD_EVIDENCE_OPEN = '''function openEvidencePanel(){
  document.querySelector('nav.tabs .tab[data-view="more"]')?.click();
  const panel=$('evidencePanel');
  setTimeout(()=>{ panel?.scrollIntoView?.({block:'start'}); panel?.focus?.({preventScroll:true}); },0);
}'''
NEW_EVIDENCE_OPEN = '''function openEvidencePanel(){
  if(typeof globalThis.__teamsheetNavigate==='function') globalThis.__teamsheetNavigate('#/settings/evidence');
  else if(globalThis.location) globalThis.location.hash='#/settings/evidence';
}'''
replace_once('src/ui/evidence.mjs', OLD_EVIDENCE_OPEN, NEW_EVIDENCE_OPEN)
replace_once('src/ui/evidence.mjs', '  header.appendChild(button);', "  ($('headerActions')||header).appendChild(button);")

# Update the existing Provider Health presentation test and add the new route contract suite.
provider_test = read('tests/provider-health-ui.test.mjs')
provider_test = re.sub(
    r"test\('app shell exposes global compact health and full More detail inside Settings flow',[\s\S]*?\n\}\);\n?$",
    """test('app shell exposes global compact health and full Settings data detail',()=>{\n  const source=readFileSync(new URL('../src/ui/app-shell.mjs',import.meta.url),'utf8');\n  assert.match(source,/providerHealthCompact/);\n  assert.match(source,/providerHealthDetail/);\n  assert.match(source,/providerHealthRows/);\n  assert.match(source,/#\\/settings\\/data/);\n  assert.match(source,/__teamsheetNavigate/);\n  assert.doesNotMatch(source,/moreTab\\.click\\(\\)/);\n});\n""",
    provider_test,
    count=1
)
write('tests/provider-health-ui.test.mjs', provider_test)

NAV_TEST = r'''import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TEAMSHEET_PRIMARY_ROUTES, normaliseTeamsheetRoute, teamsheetRouteMeta } from '../src/ui/app-shell.mjs';

const shellSource=readFileSync(new URL('../src/ui/app-shell.mjs',import.meta.url),'utf8');
const appHtml=readFileSync(new URL('../app.html',import.meta.url),'utf8');
const viewsSource=readFileSync(new URL('../src/ui/views.mjs',import.meta.url),'utf8');
const evidenceSource=readFileSync(new URL('../src/ui/evidence.mjs',import.meta.url),'utf8');

test('primary navigation follows the approved five-destination order',()=>{
  assert.deepEqual(TEAMSHEET_PRIMARY_ROUTES.map(item=>item.label),['Team','Transfers','Fixtures','Leagues','Settings']);
  assert.deepEqual(TEAMSHEET_PRIMARY_ROUTES.map(item=>item.route),['#/team','#/transfers','#/fixtures','#/leagues','#/settings']);
});

test('legacy hashes resolve to the new information architecture',()=>{
  assert.equal(normaliseTeamsheetRoute('#players'),'#/settings/research/players');
  assert.equal(normaliseTeamsheetRoute('#league'),'#/leagues');
  assert.equal(normaliseTeamsheetRoute('#more'),'#/settings');
  assert.equal(normaliseTeamsheetRoute('#fixtures'),'#/fixtures');
});

test('unknown and empty destinations fail safely to Team',()=>{
  assert.equal(normaliseTeamsheetRoute(''),'#/team');
  assert.equal(normaliseTeamsheetRoute('#/not-a-real-screen'),'#/team');
});

test('Settings subroutes keep Settings as the active primary destination',()=>{
  assert.deepEqual(teamsheetRouteMeta('#/settings/evidence'),{
    route:'#/settings/evidence',title:'Evidence & Performance',primary:'settings',settings:'evidence'
  });
  assert.equal(teamsheetRouteMeta('#/ask').primary,null);
});

test('route addresses never encode account, provider-key or evidence identities',()=>{
  const routes=TEAMSHEET_PRIMARY_ROUTES.map(item=>item.route).concat([
    '#/ask','#/settings/team-account','#/settings/research/players','#/settings/evidence','#/settings/data','#/settings/help'
  ]);
  routes.forEach(route=>assert.doesNotMatch(route,/teamId|leagueId|odds|key|record|snapshot|manager/i));
});

test('static deployable navigation uses links and omits Players, More and Ask as bottom tabs',()=>{
  const nav=/<nav class="tabs"[\s\S]*?<\/nav>/.exec(appHtml)?.[0]||'';
  assert.match(nav,/aria-label="Primary"/);
  assert.match(nav,/href="#\/team"/);
  assert.match(nav,/href="#\/fixtures"/);
  assert.match(nav,/href="#\/leagues"/);
  assert.doesNotMatch(nav,/>Players</);
  assert.doesNotMatch(nav,/>More</);
  assert.doesNotMatch(nav,/>Ask</);
  assert.doesNotMatch(nav,/role="tablist"|role="tab"/);
});

test('router owns history and active navigation instead of legacy click-to-hide wiring',()=>{
  assert.match(shellSource,/addEventListener\?\.\('hashchange'/);
  assert.match(shellSource,/replaceState/);
  assert.match(shellSource,/aria-current/);
  assert.doesNotMatch(viewsSource,/document\.querySelectorAll\('\.tab'\)/);
  assert.doesNotMatch(viewsSource,/behavior:'smooth'/);
});

test('Team keeps free transfers and bank in the visible weekly context',()=>{
  assert.match(shellSource,/teamContext/);
  assert.match(shellSource,/'ftCount','bankIn'/);
  assert.match(shellSource,/Free transfers and bank stay visible on Team/);
});

test('Settings is an organised five-section menu rather than a long More page',()=>{
  ['Team & Account','Research Tools','Evidence & Performance','Data & Diagnostics','Help & About']
    .forEach(label=>assert.match(shellSource,new RegExp(label.replace('&','&'))));
  assert.doesNotMatch(shellSource,/id:'view-more'|>More</);
});

test('Fixtures and Leagues remain primary while Player Explorer moves under Research Tools',()=>{
  assert.match(shellSource,/#\/fixtures/);
  assert.match(shellSource,/#\/leagues/);
  assert.match(shellSource,/#\/settings\/research\/players/);
  assert.match(shellSource,/playersView\.classList\.remove\('view'\)/);
});

test('Ask Teamsheet is a prominent global and Team action without becoming a sixth bottom tab',()=>{
  assert.match(shellSource,/askTeamsheetCompact/);
  assert.match(shellSource,/askCallout/);
  assert.match(shellSource,/#\/ask/);
  assert.equal(TEAMSHEET_PRIMARY_ROUTES.length,5);
});

test('evidence and Provider Health shortcuts enter their exact Settings routes',()=>{
  assert.match(evidenceSource,/#\/settings\/evidence/);
  assert.match(shellSource,/#\/settings\/data/);
  assert.doesNotMatch(evidenceSource,/data-view="more"/);
});
'''
write('tests/navigation-settings.test.mjs', NAV_TEST)

ITEM_DOC = r'''# TEAMSHEET2-ITEM1.md — Navigation and Settings Architecture

Status: **Approved by Pritesh on 31 July 2026 and implemented for review.**

Purpose: record the exact Teamsheet 2.0.1 behaviour, exclusions, route contract, relocation map and verification requirements.

## Outcome

Teamsheet now has five primary destinations:

1. Team
2. Transfers
3. Fixtures
4. Leagues
5. Settings

Players leaves primary navigation. More is removed. Ask Teamsheet remains a full destination but is reached through prominent Team and global actions rather than a cramped sixth bottom tab.

## Owner-approved amendments to the original blueprint

- Free transfers and bank are core weekly FPL information and remain visible on Team.
- Fixtures is a primary destination because fixture runs, blanks, doubles and swings are routinely used by an FPL manager.
- The shorter primary label is Leagues; the underlying product area remains focused on FPL mini leagues.
- Ask Teamsheet is regularly used and must be accessible from Team and the global header.
- The old standalone Stage 10.5 physical rehearsal is superseded by checkpoint-specific iPhone checks and a final Teamsheet 2.0 end-to-end rehearsal.

## Route contract

Teamsheet uses a hash router because it remains a single-file GitHub Pages application. Hash routes survive direct opening and refresh without requiring server rewrite rules.

Primary routes:

- `#/team`
- `#/transfers`
- `#/fixtures`
- `#/leagues`
- `#/settings`

Secondary routes:

- `#/ask`
- `#/settings/team-account`
- `#/settings/research/players`
- `#/settings/evidence`
- `#/settings/data`
- `#/settings/help`

Legacy aliases are retained for `#players`, `#fixtures`, `#league`, `#more`, `#settings` and `#ask`. Unknown routes fail safely to Team. Routes contain no Team ID, league ID, provider key, manager reference or evidence identity.

The router owns active-screen visibility, `aria-current`, document title, top-of-screen positioning, focus after navigation and browser Back/Forward behaviour. The previous click handler that directly hid `.view` elements is removed.

## Relocation map

### Team

- Team ID and load control
- free transfers
- bank
- manual-mode switch
- load/source/chip status
- existing squad pitch and recommendations
- prominent Ask Teamsheet action

This checkpoint does not redesign the Team decision home; that remains 2.0.2.

### Transfers

The existing transfer planner remains functionally unchanged.

### Fixtures

The existing fixture ticker, Gameweek range, lens, sort, blanks, doubles and swing notes become a dedicated primary destination. Fixture calculations are unchanged.

### Leagues

The existing saved-league and rival comparison surface becomes a primary destination. It is honestly labelled as the current comparison foundation; rank movement and new intelligence remain 2.0.4–2.0.5.

### Settings

Settings has five purpose-led sections:

1. Team & Account — manual squad editing and setup guidance.
2. Research Tools — Player Explorer.
3. Evidence & Performance — deadline evidence, outcomes, metrics, operating review and exports.
4. Data & Diagnostics — Provider Health, optional providers, calibration and recovery detail.
5. Help & About — advisory boundary, limitations, privacy and build identity.

Existing stateful controls are moved as DOM nodes rather than cloned. Their IDs, listeners, persistence and model/provider consumers are preserved.

### Ask Teamsheet

Ask Teamsheet remains `#/ask`. It is linked from Team and the header. Its provider and hosted-build limitation are unchanged.

## Explicit exclusions

- no Team home redesign;
- no Transfers redesign;
- no new fixture calculation;
- no global-rank or Gameweek-rank calculation;
- no new Mini-League intelligence, projections or strategy logic;
- no player-detail redesign or player URL deep links;
- no provider, data-source, security or persistence change;
- no projection, expected-minutes, scoring, captaincy, squad, simulation or optimiser change;
- no deletion or reset-all action;
- no framework, dependency, build or deployment change.

## Accessibility and mobile contract

- primary navigation is a labelled navigation landmark using real links and `aria-current`;
- all five labels remain visible at narrow iPhone widths;
- touch targets retain the existing minimum sizes and safe-area padding;
- Settings subroutes provide a clear back link;
- browser Back/Forward and deep links work;
- route headings receive focus after user navigation;
- inactive routes are hidden from interaction and assistive technology;
- player-detail dialog focus and Escape behaviour remain unchanged.

Physical-device evidence remains an owner acceptance step. Automated tests cannot prove exact iPhone rendering, browser chrome behaviour or thumb comfort.

## Verification

Completion requires the full existing suite plus route, hierarchy, relocation and shortcut tests; a production build; two byte-identical builds using the same exact source commit; root/deployable equality; CSP/build-identity verification; updated canonical documentation; a separate branch and draft PR.
'''
write('docs/TEAMSHEET2-ITEM1.md', ITEM_DOC)

# Canonical documentation updates. The test count is inserted by the workflow after preflight.
sub_once(
    'CLAUDE.md',
    r"## Current checkpoint\n[\s\S]*?\n\n## Non-negotiable rules",
    """## Current checkpoint
Teamsheet 2.0.1 — Navigation and Settings architecture is implemented through the owner-approved five-destination structure: Team, Transfers, Fixtures, Leagues and Settings. Ask Teamsheet is a prominent global/Team action. Hash routing, browser history, deep links and the organised Settings hierarchy are now part of the UI boundary. The next separately designed checkpoint is **Teamsheet 2.0.2 — Team decision home**. Stage 10 collection and evaluation infrastructure remains complete; prospective validation is still in progress. The verified Teamsheet 2.0.1 baseline is **__TEST_COUNT__/__TEST_COUNT__ tests** with deterministic exact-identity builds and root/deployable equality.

## Non-negotiable rules""",
    flags=re.M
)

project = read('docs/PROJECT_CONTEXT.md').replace('Last updated: 2026-07-30.', 'Last updated: 2026-07-31.', 1)
project = project.replace(
    '- The Teamsheet 2.0 Product Blueprint was approved by Pritesh on 30 July 2026. It supersedes the Stage 9 information architecture for future development while preserving the Stage 9 engineering foundation and historical record.\n',
    '- The Teamsheet 2.0 Product Blueprint was approved by Pritesh on 30 July 2026. Owner-approved 2.0.1 amendments on 31 July 2026 add Fixtures as a primary destination, shorten Mini Leagues to Leagues, keep free transfers and bank on Team, and promote Ask Teamsheet as a global/Team action.\n- Teamsheet 2.0.1 implements hash routing, browser history/deep links, Team/Transfers/Fixtures/Leagues/Settings navigation and the five-section Settings hierarchy without changing formulas or providers. Verified baseline: **__TEST_COUNT__/__TEST_COUNT__ tests** with deterministic exact-identity builds and root/deployable equality.\n',
    1
)
project = re.sub(
    r"## Approved future information architecture[\s\S]*?\n## Engineering goals and priorities",
    """## Implemented Teamsheet 2.0 information architecture
The primary navigation is:

1. **Team**
2. **Transfers**
3. **Fixtures**
4. **Leagues**
5. **Settings**

Players is available under Settings → Research Tools rather than primary navigation. More is replaced by an organised Settings menu. Ask Teamsheet is a prominent Team and global action with its own route. Free transfers and bank remain visible on Team.

## Engineering goals and priorities""",
    project,
    count=1
)
project = re.sub(
    r"Next development item: \*\*Teamsheet 2\.0\.1[\s\S]*?No Teamsheet 2\.0\.1 code is authorised by the blueprint integration item\.",
    "Next development item: **Teamsheet 2.0.2 — Team decision home.** Teamsheet 2.0.1 is implemented and verified; later work remains separately gated and must not be pulled forward.",
    project,
    count=1
)
project = re.sub(
    r"## Approval and implementation boundary[\s\S]*$",
    """## Approval and implementation boundary
Teamsheet 2.0.1 implements only the approved navigation, routing and Settings relocation. It does not change recommendation formulas, provider behaviour, global rank, league intelligence, player detail or the Team/Transfers decision designs. Teamsheet 2.0.2 is the next separate design and approval gate. Prospective validation remains in progress, and the verified engineering baseline is **__TEST_COUNT__/__TEST_COUNT__ tests** with deterministic exact-identity builds.""",
    project,
    count=1
)
write('docs/PROJECT_CONTEXT.md', project)

sub_once(
    'docs/ARCHITECTURE.md',
    r"## Stage 9 UI boundary[\s\S]*?\n## Provider Health and storage",
    """## Teamsheet 2.0.1 UI and routing boundary
`ui/app-shell.mjs` owns the implemented Team, Transfers, Fixtures, Leagues and Settings primary destinations, the secondary Ask Teamsheet route, hash normalisation, legacy aliases, browser history, active-link state, route focus and the five-section Settings hierarchy. The old direct click-to-hide navigation in `ui/views.mjs` is removed.

Existing functional nodes are relocated rather than cloned: weekly Team ID/free-transfer/bank context moves into Team; Player Explorer moves under Settings → Research Tools; evidence/outcomes/metrics/review remain under Settings → Evidence & Performance; Provider Health and optional provider/calibration controls live under Settings → Data & Diagnostics; the existing League comparison and Fixtures ticker become primary destinations. Ask Teamsheet remains functionally unchanged and is linked globally and from Team.

The router stores no account, provider-key or evidence identity in the URL. It does not own model state, provider state or persisted configuration. Player detail remains an accessible dialog rather than a URL route. The owner-approved Teamsheet 2.0.1 boundary changes presentation and navigation only.

## Provider Health and storage""",
    flags=re.M
)

with (ROOT / 'docs/DECISIONS.md').open('a', encoding='utf-8') as handle:
    handle.write(r'''

**D-29 · 2026-07-31 · Accepted · Teamsheet 2.0.1 five-destination navigation and hash routing**
Reason: the manager needs weekly resources and fixtures immediately available, Leagues must fit cleanly on iPhone, Ask Teamsheet is regularly used, and the Stage 9 click-to-hide/More hierarchy could not support refresh-safe deep links, Back/Forward navigation or an organised Settings menu.

Approach: primary navigation is Team, Transfers, Fixtures, Leagues and Settings. Free transfers and bank remain visible on Team. Players moves to Settings → Research Tools. Ask Teamsheet is a full `#/ask` destination reached from Team and a global header action rather than a sixth bottom tab. A central hash router owns route normalisation, legacy aliases, browser history, active navigation, title, focus and safe fallback. Existing stateful DOM nodes move into the five Settings categories without cloning. The historical Stage 10.5 physical rehearsal remains recorded, but its outstanding standalone rehearsal gate is superseded by checkpoint-level iPhone checks and final 2.0.7 acceptance.

Consequences: fixture, league, provider, evidence and model behaviour remain unchanged. Hashes are used because direct path routes can fail on static GitHub Pages. URLs contain no account IDs, keys or evidence identities. Player-detail URL routing, Team/Transfers redesign, rank intelligence and Mini-League strategy remain excluded and separately gated.
''')

roadmap = read('docs/ROADMAP.md').replace('Last updated: 2026-07-30.', 'Last updated: 2026-07-31.', 1)
roadmap = roadmap.replace('Approves Team, Transfers, Mini Leagues and Settings as future primary navigation.', 'Originally approved Team, Transfers, Mini Leagues and Settings; owner-approved 2.0.1 amendments implement Team, Transfers, Fixtures, Leagues and Settings.', 1)
roadmap = re.sub(
    r"## Current[\s\S]*?\n## Upcoming",
    """## Current
- **Teamsheet 2.0.1 — Navigation and Settings architecture** · IMPLEMENTED AND VERIFIED FOR REVIEW.
  - Primary navigation: Team, Transfers, Fixtures, Leagues and Settings.
  - Hash routes support direct opening, refresh and browser Back/Forward.
  - Free transfers and bank remain on Team; Ask Teamsheet is a prominent Team/global action.
  - Existing functional surfaces are preserved under purpose-led Settings routes.
  - Verified baseline: **__TEST_COUNT__/__TEST_COUNT__ tests**, deterministic exact-identity builds and root/deployable equality.
- **Live-season readiness and prospective validation** remains operational. Genuine pre-deadline evidence collection begins with the 2026/27 season.
- The next development checkpoint is **Teamsheet 2.0.2 — Team decision home**, requiring separate investigation, design and explicit approval.

## Teamsheet 2.0 migration sequence
1. **Teamsheet 2.0.1 — Navigation and Settings architecture** · COMPLETE FOR REVIEW.
   - Team, Transfers, Fixtures, Leagues and Settings.
   - Player Explorer under Settings; Ask Teamsheet as a global/Team action.
   - URL routing, browser history, focus and responsive navigation.
2. **Teamsheet 2.0.2 — Team decision home**
   - Make the pitch immediately visible and add XI, captaincy, bench, projection, risk and deadline-action summaries.
3. **Teamsheet 2.0.3 — Transfer decision experience**
   - Lead with roll/transfer/hit guidance, preserve the zero-transfer baseline and explain whole-squad consequences.
4. **Teamsheet 2.0.4 — Global rank and Leagues foundation**
   - Establish confirmed global and private-league performance, movement and comparison foundations.
5. **Teamsheet 2.0.5 — League intelligence**
   - Add supported rival exposure, overlap, differential and tactical insight; strategy modelling remains separately gated.
6. **Teamsheet 2.0.6 — Research, evidence and diagnostics completion**
   - Complete remaining content organisation and relocate persistent healthy Provider Health from the main header.
7. **Teamsheet 2.0.7 — Final mobile polish and acceptance**
   - Complete hierarchy, performance, accessibility, full pre-season rehearsal and physical-device acceptance.

Every checkpoint requires its own investigation, exact scope, exclusions, owner approval where required, branch, complete verification, documentation and draft PR.

## Upcoming""",
    roadmap,
    count=1
)
roadmap = re.sub(
    r"## Upcoming[\s\S]*?\n## Current blockers and gates",
    """## Upcoming
1. Owner review and merge decision for Teamsheet 2.0.1.
2. Design Teamsheet 2.0.2 without pulling forward Transfers, rank or League intelligence.
3. Operate pre-deadline snapshots and durable owner-controlled exports during the 2026/27 season.
4. Complete checkpoint-specific iPhone checks and the final Teamsheet 2.0.7 end-to-end rehearsal.
5. Collect official outcomes and descriptive metrics prospectively; do not claim accuracy or calibration until approved sample safeguards are met.

## Current blockers and gates""",
    roadmap,
    count=1
)
roadmap = re.sub(
    r"## Current blockers and gates[\s\S]*$",
    """## Current blockers and gates
1. Teamsheet 2.0.2 has no approved implementation design.
2. A persistent screenshot-regression suite is absent; visual changes still require human device checks.
3. Teamsheet 2.0.1 automated checks cannot independently prove physical iPhone rendering; owner device acceptance remains required before merge.
4. The old standalone Stage 10.5 rehearsal gate is superseded by checkpoint-specific checks and final 2.0.7 rehearsal; its historical record remains intact.
5. Free historical odds and other missing pre-deadline provider snapshots require prospective 2026/27 logging.
6. Prospective sample size begins at zero; Stage 10 infrastructure does not establish model accuracy or calibration.
7. Projected live rank, projected rival outcomes and protect/balanced/chase strategy logic require separate designs and explicit approval.""",
    roadmap,
    count=1
)
write('docs/ROADMAP.md', roadmap)

limitations = read('docs/KNOWN_LIMITATIONS.md').replace('Last updated: 2026-07-30.', 'Last updated: 2026-07-31.', 1)
limitations = limitations.replace(
    '| UI-2 | The implemented primary navigation remains Team, Players, Transfers and More | The approved Teamsheet 2.0 Team/Transfers/Mini Leagues/Settings architecture is documented but not yet implemented | Teamsheet 2.0.1 | Open (expected) |',
    '| UI-2 | Stage 9 primary navigation remained Team, Players, Transfers and More | Replaced by Team, Transfers, Fixtures, Leagues and Settings with Ask Teamsheet as a global/Team action | Teamsheet 2.0.1 | **CLOSED and verified 2026-07-31** |'
)
limitations = limitations.replace(
    '| UI-3 | Current Settings and supporting tools remain distributed through the Stage 9 More hierarchy | Research, evidence, diagnostics and help are not yet organised into the approved five-section Settings menu | Teamsheet 2.0.1 and 2.0.6 | Open (expected) |',
    '| UI-3 | Settings and supporting tools were distributed through the Stage 9 More hierarchy | Existing surfaces are now organised into Team & Account, Research Tools, Evidence & Performance, Data & Diagnostics and Help & About; later content polish remains 2.0.6 | Teamsheet 2.0.1/2.0.6 | Partially closed; architecture verified |\n| UI-5 | Physical iPhone rendering of the five-tab navigation is not independently automated | Static responsive, route and accessibility contracts pass, but exact device chrome, text scaling and thumb comfort require owner review | Teamsheet 2.0.1 review and 2.0.7 | Open (acceptance gate) |'
)
limitations = limitations.replace(
    '| ML-1 | Mini Leagues is not yet a flagship primary destination | Global and private-league performance, movement and tactical explanation remain limited and secondary | Teamsheet 2.0.4–2.0.5 | Open (expected) |',
    '| ML-1 | Leagues is now a primary destination but still exposes only the existing comparison foundation | Global/private performance, movement and tactical explanation remain incomplete and must not be manufactured | Teamsheet 2.0.4–2.0.5 | Open (expected) |'
)
limitations = limitations.replace(
    '- The approved blueprint is product direction, not implemented behaviour.\n- Stage 9 remains the current application structure until Teamsheet 2.0.1 is separately designed, approved, implemented and merged.',
    '- Teamsheet 2.0.1 implements the approved navigation and Settings architecture; later Team, Transfers, rank and League intelligence remain product direction rather than implemented behaviour.\n- The Stage 9 engineering foundation remains valid, while its primary information architecture is superseded.'
)
limitations = limitations.replace(
    '- Static phone-first tests pass, but physical iPhone acceptance remains an owner review step before merge.',
    '- Static phone-first tests pass, but physical iPhone acceptance remains an owner review step before merge. The old standalone Stage 10.5 rehearsal gate is superseded by checkpoint-specific checks and final Teamsheet 2.0.7 rehearsal.'
)
write('docs/KNOWN_LIMITATIONS.md', limitations)

blueprint = read('docs/TEAMSHEET2-PRODUCT-BLUEPRINT.md')
blueprint = blueprint.replace(
    'Status: **Approved by Pritesh on 30 July 2026.** This document is the authoritative product direction for future Teamsheet 2.0 work.',
    'Status: **Approved by Pritesh on 30 July 2026; navigation amendments approved 31 July 2026.** This document is the authoritative product direction for Teamsheet 2.0 work.'
)
blueprint = re.sub(
    r"### 5\.1 Approved primary navigation[\s\S]*?\n### 5\.2 Team",
    """### 5.1 Approved primary navigation

1. **Team**
2. **Transfers**
3. **Fixtures**
4. **Leagues**
5. **Settings**

This owner-approved 31 July 2026 amendment recognises fixtures as an everyday FPL decision surface and uses the shorter Leagues label for mobile navigation. Ask Teamsheet is a prominent global and Team action with its own route rather than a sixth bottom tab. Players leaves primary navigation and More is replaced by Settings.

### 5.2 Team""",
    blueprint,
    count=1
)
blueprint = blueprint.replace(
    'The pitch is the dominant visual and appears immediately. Setup states should preserve the pitch and explain the next connection step rather than replacing the product with a form.',
    'The pitch is the dominant visual and appears immediately. Free transfers and bank remain visible because they directly affect weekly decisions. Setup states should preserve the pitch and explain the next connection step rather than replacing the product with a form.'
)
blueprint = blueprint.replace(
    '### 5.4 Mini Leagues\n',
    """### 5.4 Fixtures

Fixtures is a primary destination because fixture runs, blanks, doubles, difficulty lenses and swing windows are routinely used to plan FPL decisions. The destination supports Team and Transfers without changing fixture calculations.

### 5.5 Leagues
""",
    1
)
blueprint = blueprint.replace('### 5.5 Settings\n', '### 5.6 Settings\n', 1)
blueprint = blueprint.replace(
    '- FPL Team ID\n- free transfers\n- bank\n- manual squad\n- saved Mini Leagues',
    '- manual squad\n- account and connection guidance\n- saved-league guidance and links'
)
blueprint = blueprint.replace(
    '- player explorer\n- fixture explorer\n- watchlist or shortlist\n- detailed comparisons',
    '- player explorer\n- watchlist or shortlist\n- detailed comparisons\n\nFixture exploration is a primary Fixtures destination rather than a hidden research tool.'
)
blueprint = re.sub(
    r"### Teamsheet 2\.0\.1 — Navigation and Settings architecture[\s\S]*?\n### Teamsheet 2\.0\.2",
    """### Teamsheet 2.0.1 — Navigation and Settings architecture

- Replace primary navigation with Team, Transfers, Fixtures, Leagues and Settings.
- Remove Players from primary navigation and replace More with the organised Settings hierarchy.
- Keep Team ID, free transfers and bank visible on Team.
- Make Ask Teamsheet a prominent Team/global action with its own route.
- Add hash routing, browser history, deep links, focus and legacy aliases.
- Preserve access to every existing functional surface without changing formulas or providers.
- Record and test navigation, focus, responsive and no-regression behaviour.

This checkpoint was explicitly approved on 31 July 2026.

### Teamsheet 2.0.2""",
    blueprint,
    count=1
)
write('docs/TEAMSHEET2-PRODUCT-BLUEPRINT.md', blueprint)

testing = read('docs/TESTING.md').replace('Last updated: 2026-07-30.', 'Last updated: 2026-07-31.', 1)
testing = re.sub(
    r"Stage 10\.3 verified source[\s\S]*?The previous Stage 10\.2 baseline was 376/376 at source `e84e7f1bf05ed1f3e574f78101e4a6e413273306`\.\n",
    "Teamsheet 2.0.1 verification completes **__TEST_COUNT__/__TEST_COUNT__ passing tests**, a successful production build, byte-identical two-build artefact verification, exact build identity and root/deployable equality. It changes navigation and presentation only; model/provider correctness continues to rely on the preserved suites and the Stage 10.5 428-test baseline.\n",
    testing,
    count=1
)
testing = testing.replace(
    '25. `stage10-hardening.test.mjs` — dangerous-key rejection, diagnostic redaction, strict journals/current reconciliation, transfer-version parity, line-feed spreadsheet protection, honest download requests and bounded retry/orchestration wiring.',
    '25. `stage10-hardening.test.mjs` — dangerous-key rejection, diagnostic redaction, strict journals/current reconciliation, transfer-version parity, line-feed spreadsheet protection, honest download requests and bounded retry/orchestration wiring.\n26. `navigation-settings.test.mjs` — primary order, hash normalisation, legacy aliases, safe fallback, Settings hierarchy, Team resource relocation, Fixtures/Leagues promotion, Ask Teamsheet access, shortcut routes and removal of legacy click-to-hide navigation.'
)
testing += r'''

## Teamsheet 2.0.1 navigation verification
The Teamsheet 2.0.1 baseline is **__TEST_COUNT__/__TEST_COUNT__ tests** with zero failures and zero skipped. Coverage verifies the exact five-destination order, URL aliases and safe fallback, browser-history wiring, `aria-current`, static link semantics, no account/key/evidence identities in routes, free transfers and bank on Team, Player Explorer under Research Tools, purpose-led Settings sections, direct evidence/provider shortcuts and Ask Teamsheet as a global/Team action rather than a sixth tab.

Automated checks cannot independently prove exact iPhone Safari rendering or thumb comfort. Physical owner acceptance remains required before merge, with the complete end-to-end pre-season rehearsal deferred to Teamsheet 2.0.7.
'''
write('docs/TESTING.md', testing)

print('Applied Teamsheet 2.0.1 source, tests and documentation changes.')
