// Teamsheet 2.0.6 app shell — primary navigation, Settings information
// architecture, URL routing and route-owned focus. Existing data, model and
// persistence behaviour remains owned by the original feature modules.

const TEAMSHEET_PRIMARY_ROUTES = Object.freeze([
  Object.freeze({route:'#/team',key:'team',icon:'team',label:'Team'}),
  Object.freeze({route:'#/transfers',key:'transfers',icon:'transfers',label:'Transfers'}),
  Object.freeze({route:'#/fixtures',key:'fixtures',icon:'fixtures',label:'Fixtures'}),
  Object.freeze({route:'#/leagues',key:'leagues',icon:'leagues',label:'Leagues'}),
  Object.freeze({route:'#/settings',key:'settings',icon:'settings',label:'Settings'})
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
  '#/more':'#/settings'
});

const TEAMSHEET_ROUTE_TABLE = Object.freeze({
  '#/team':Object.freeze({title:'Team',primary:'team'}),
  '#/transfers':Object.freeze({title:'Transfers',primary:'transfers'}),
  '#/fixtures':Object.freeze({title:'Fixtures',primary:'fixtures'}),
  '#/leagues':Object.freeze({title:'Leagues',primary:'leagues'}),
  '#/leagues/detail':Object.freeze({title:'League overview',primary:'leagues',parent:'#/leagues'}),
  '#/leagues/standings':Object.freeze({title:'League table',primary:'leagues',parent:'#/leagues/detail'}),
  '#/leagues/rival':Object.freeze({title:'Rival comparison',primary:'leagues',parent:'#/leagues/detail'}),
  '#/leagues/exposure':Object.freeze({title:'Rival exposure',primary:'leagues',parent:'#/leagues/detail'}),
  '#/leagues/manage':Object.freeze({title:'Manage leagues',primary:'leagues',parent:'#/leagues'}),
  '#/settings':Object.freeze({title:'Settings',primary:'settings'}),
  '#/settings/team-account':Object.freeze({title:'Team & Account',primary:'settings',settings:'team-account',parent:'#/settings'}),
  '#/settings/team-account/manual-squad':Object.freeze({title:'Manual squad',primary:'settings',settings:'team-account',parent:'#/settings/team-account'}),
  '#/settings/team-account/connection':Object.freeze({title:'Connection guidance',primary:'settings',settings:'team-account',parent:'#/settings/team-account'}),
  '#/settings/research':Object.freeze({title:'Research Tools',primary:'settings',settings:'research',parent:'#/settings'}),
  '#/settings/research/players':Object.freeze({title:'Player Explorer',primary:'settings',settings:'research',parent:'#/settings/research'}),
  '#/settings/evidence':Object.freeze({title:'Evidence & Performance',primary:'settings',settings:'evidence',parent:'#/settings'}),
  '#/settings/evidence/deadline':Object.freeze({title:'Deadline evidence',primary:'settings',settings:'evidence',parent:'#/settings/evidence'}),
  '#/settings/evidence/outcomes':Object.freeze({title:'Official outcomes',primary:'settings',settings:'evidence',parent:'#/settings/evidence'}),
  '#/settings/evidence/metrics':Object.freeze({title:'Performance metrics',primary:'settings',settings:'evidence',parent:'#/settings/evidence'}),
  '#/settings/evidence/review':Object.freeze({title:'Operating review',primary:'settings',settings:'evidence',parent:'#/settings/evidence'}),
  '#/settings/evidence/exports':Object.freeze({title:'Exports',primary:'settings',settings:'evidence',parent:'#/settings/evidence'}),
  '#/settings/data':Object.freeze({title:'Data & Diagnostics',primary:'settings',settings:'data',parent:'#/settings'}),
  '#/settings/data/providers':Object.freeze({title:'Provider Health',primary:'settings',settings:'data',parent:'#/settings/data'}),
  '#/settings/data/optional-sources':Object.freeze({title:'Optional sources',primary:'settings',settings:'data',parent:'#/settings/data'}),
  '#/settings/data/calibration':Object.freeze({title:'Calibration',primary:'settings',settings:'data',parent:'#/settings/data'}),
  '#/settings/data/recovery':Object.freeze({title:'Recovery',primary:'settings',settings:'data',parent:'#/settings/data'}),
  '#/settings/data/storage':Object.freeze({title:'Local storage',primary:'settings',settings:'data',parent:'#/settings/data'}),
  '#/settings/help':Object.freeze({title:'Help & About',primary:'settings',settings:'help',parent:'#/settings'}),
  '#/settings/help/recommendations':Object.freeze({title:'Recommendations',primary:'settings',settings:'help',parent:'#/settings/help'}),
  '#/settings/help/uncertainty':Object.freeze({title:'Expected points & uncertainty',primary:'settings',settings:'help',parent:'#/settings/help'}),
  '#/settings/help/limitations':Object.freeze({title:'Known limitations',primary:'settings',settings:'help',parent:'#/settings/help'}),
  '#/settings/help/privacy':Object.freeze({title:'Privacy & data',primary:'settings',settings:'help',parent:'#/settings/help'}),
  '#/settings/help/about':Object.freeze({title:'About this build',primary:'settings',settings:'help',parent:'#/settings/help'}),
  '#/settings/help/operations':Object.freeze({title:'Live-season operations',primary:'settings',settings:'help',parent:'#/settings/help'}),
  '#/ask':Object.freeze({title:'Ask Teamsheet',primary:null})
});

const TEAMSHEET_VALID_ROUTES = new Set(Object.keys(TEAMSHEET_ROUTE_TABLE));

function normaliseTeamsheetRoute(value=''){
  let route=String(value??'').trim();
  if(Object.prototype.hasOwnProperty.call(TEAMSHEET_ROUTE_ALIASES,route)) return TEAMSHEET_ROUTE_ALIASES[route];
  if(route.startsWith('/')&&!route.startsWith('#/')) route='#'+route;
  else if(route.startsWith('#')&&!route.startsWith('#/')) route='#/'+route.slice(1).replace(/^\/+/, '');
  else if(!route.startsWith('#/')) route='#/'+route.replace(/^\/+/, '');
  route=route.replace(/\/+$/,'');
  if(Object.prototype.hasOwnProperty.call(TEAMSHEET_ROUTE_ALIASES,route)) return TEAMSHEET_ROUTE_ALIASES[route];
  if(TEAMSHEET_VALID_ROUTES.has(route)) return route;
  if(route.startsWith('#/leagues/')) return '#/leagues';
  for(const section of ['team-account','research','evidence','data','help']){
    const prefix=`#/settings/${section}/`;
    if(route.startsWith(prefix)) return `#/settings/${section}`;
  }
  if(route.startsWith('#/settings/')) return '#/settings';
  return '#/team';
}

function teamsheetRouteMeta(value=''){
  const route=normaliseTeamsheetRoute(value);
  return Object.freeze({route,...TEAMSHEET_ROUTE_TABLE[route]});
}

function teamsheetRouteParent(value=''){
  return teamsheetRouteMeta(value).parent||null;
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

function teamsheetNavIcon(name){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('class','nav-icon');
  svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('aria-hidden','true');
  svg.setAttribute('focusable','false');
  const shapes={
    team:[['path',{d:'M12 3 19 8 12 13 5 8Z'}],['path',{d:'m5 12 7 5 7-5'}],['path',{d:'m5 16 7 5 7-5'}]],
    transfers:[['path',{d:'M4 7h13'}],['path',{d:'m14 4 3 3-3 3'}],['path',{d:'M20 17H7'}],['path',{d:'m10 14-3 3 3 3'}]],
    fixtures:[['rect',{x:'4',y:'5',width:'16',height:'15',rx:'2'}],['path',{d:'M8 3v4M16 3v4M4 10h16M8 14h2M14 14h2M8 17h2M14 17h2'}]],
    leagues:[['path',{d:'M6 21V4'}],['path',{d:'M6 5h11l-2 4 2 4H6'}]],
    settings:[['circle',{cx:'12',cy:'12',r:'3'}],['path',{d:'M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1'}]]
  };
  (shapes[name]||shapes.team).forEach(([tag,attrs])=>{
    const shape=document.createElementNS('http://www.w3.org/2000/svg',tag);
    Object.entries(attrs).forEach(([key,value])=>shape.setAttribute(key,value));
    svg.appendChild(shape);
  });
  return svg;
}

function teamsheetRouteHeadingId(route){
  return `routeHeading-${String(route).replace(/^#\//,'').replaceAll('/','-')}`;
}

function teamsheetRouteHeader(route,title,hint){
  const parent=teamsheetRouteParent(route)||'#/settings';
  const parentTitle=teamsheetRouteMeta(parent).title;
  return teamsheetElement('div',{class:'route-header'},
    teamsheetElement('a',{class:'route-back',href:parent,'aria-label':`Back to ${parentTitle}`},
      teamsheetElement('span',{'aria-hidden':'true'},'←')),
    teamsheetElement('h2',{id:teamsheetRouteHeadingId(route),tabindex:'-1'},title),
    teamsheetElement('p',{class:'hint'},hint));
}

function teamsheetSettingsCard(route,icon,title,copy){
  return teamsheetElement('a',{class:'settings-card',href:route},
    teamsheetElement('span',{class:'settings-card-icon','aria-hidden':'true'},icon),
    teamsheetElement('span',{class:'settings-card-copy'},
      teamsheetElement('h3',{},title),
      teamsheetElement('span',{class:'settings-card-description'},copy)),
    teamsheetElement('span',{class:'settings-card-arrow','aria-hidden':'true'},'›'));
}

function teamsheetSettingsMenu(route,title,hint,cards){
  return teamsheetElement('section',{
    id:`settings-route-${route.replace(/^#\/settings\/?/,'').replaceAll('/','-')||'root'}`,
    class:'settings-subview',
    'data-settings-route':route,
    hidden:'hidden'
  },
  teamsheetRouteHeader(route,title,hint),
  teamsheetElement('div',{class:'settings-grid settings-subgrid'},cards));
}

function teamsheetSettingsContent(route,title,hint,...children){
  return teamsheetElement('section',{
    id:`settings-route-${route.replace(/^#\/settings\/?/,'').replaceAll('/','-')}`,
    class:'settings-subview',
    'data-settings-route':route,
    hidden:'hidden'
  },teamsheetRouteHeader(route,title,hint),children);
}

function teamsheetPanel(eyebrow,title,hint,...children){
  return teamsheetElement('section',{class:'panel settings-content-panel'},
    teamsheetElement('span',{class:'eyebrow'},eyebrow),
    teamsheetElement('h3',{},title),
    hint?teamsheetElement('p',{class:'hint'},hint):null,
    children);
}

function teamsheetBuildInfoPanel(){
  const info=typeof BUILD_INFO!=='undefined'&&BUILD_INFO&&typeof BUILD_INFO==='object'?BUILD_INFO:null;
  const rows=info?[
    ['Model',info.modelVersion],
    ['Rules',info.rulesVersion],
    ['Commit',info.commit],
    ['Source',String(info.sourceHash||'').slice(0,16)]
  ]:[['Build','Unavailable in this source view']];
  return teamsheetPanel('Version identity','This Teamsheet build','Public build identity helps confirm which reviewed source produced the page.',
    teamsheetElement('dl',{class:'build-identity'},rows.map(([label,value])=>[
      teamsheetElement('dt',{},label),teamsheetElement('dd',{class:'mono'},String(value||'unversioned'))
    ])));
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
      teamsheetElement('span',{class:'ic','aria-hidden':'true'},teamsheetNavIcon(item.icon)),
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
      teamsheetElement('span',{class:'status'},'Team ID, free transfers and bank stay visible because they affect weekly decisions.')));
  setupRows.slice(0,2).forEach(row=>teamContext.appendChild(row));
  ['status','srcStatus','chipState'].map(id=>document.getElementById(id)).filter(Boolean).forEach(node=>teamContext.appendChild(node));
  if(squadOut) teamView.insertBefore(teamContext,squadOut);
  else teamView.appendChild(teamContext);

  const fixturesHeading=fixturesView.querySelector('h2');
  if(fixturesHeading) fixturesHeading.textContent='Fixtures';
  const leaguesHeading=leaguesView.querySelector('h2');
  const leaguesEyebrow=leaguesView.querySelector('.eyebrow');
  const leaguesHint=leaguesView.querySelector('.hint');
  if(leaguesHeading) leaguesHeading.textContent='Leagues';
  if(leaguesEyebrow) leaguesEyebrow.textContent='Mini leagues';
  if(leaguesHint) leaguesHint.textContent='Official position, points gaps, pairwise comparisons and on-demand selected-rival exposure. Projected rank and protect/chase strategy are not included.';
  const playersHeading=playersView.querySelector('h3, h2');
  const playersEyebrow=playersView.querySelector('.eyebrow');
  if(playersHeading) playersHeading.textContent='Player Explorer';
  if(playersEyebrow) playersEyebrow.textContent='Research tool';
  const askHeading=askView.querySelector('h2');
  const askEyebrow=askView.querySelector('.eyebrow');
  if(askHeading) askHeading.textContent='Ask Teamsheet';
  if(askEyebrow) askEyebrow.textContent='Decision assistant';
  const askRouteBack=teamsheetElement('a',{id:'askRouteBack',class:'route-back',href:'#/team','aria-label':'Back to Team'},
    teamsheetElement('span',{'aria-hidden':'true'},'←'));
  askView.insertBefore(askRouteBack,askView.firstChild);

  const settingsView=teamsheetElement('section',{id:'view-settings',class:'view settings-view',hidden:'hidden'});
  const settingsHeader=teamsheetElement('div',{class:'panel settings-header primary-page-header'},
    teamsheetElement('div',{class:'primary-page-header-copy'},
      teamsheetElement('span',{class:'eyebrow'},'Advanced tools, kept out of the way'),
      teamsheetElement('h2',{id:'settingsTitle',tabindex:'-1'},'Settings'),
      teamsheetElement('p',{class:'hint'},'Connect your team, research players, review evidence and resolve data issues without cluttering weekly decisions.')));
  const settingsLanding=teamsheetElement('div',{id:'settingsLanding',class:'settings-grid'},
    teamsheetSettingsCard('#/settings/team-account','◈','Team & Account','Manual squad editing, connection guidance and account links.'),
    teamsheetSettingsCard('#/settings/research','↗','Research Tools','Player Explorer and supporting research outside the main decision journeys.'),
    teamsheetSettingsCard('#/settings/evidence','✓','Evidence & Performance','Deadline records, outcomes, metrics, review and exports.'),
    teamsheetSettingsCard('#/settings/data','⌁','Data & Diagnostics','Provider status, optional sources, recovery and local storage.'),
    teamsheetSettingsCard('#/settings/help','?','Help & About','Recommendation guidance, limitations, privacy and build identity.'));
  settingsView.append(settingsHeader,settingsLanding);

  const settingsRoutes=[];
  const addRoute=route=>{settingsRoutes.push(route);settingsView.appendChild(route);return route;};

  addRoute(teamsheetSettingsMenu('#/settings/team-account','Team & Account','Connection and squad setup live here; weekly bank and free-transfer assumptions remain on Team.',[
    teamsheetSettingsCard('#/settings/team-account/manual-squad','XI','Manual squad','Build or correct the 15-player squad used by manual mode.'),
    teamsheetSettingsCard('#/settings/team-account/connection','ID','Connection guidance','Find your Team ID and jump to saved-league management.')
  ]));

  const manualPanel=teamsheetPanel('Squad setup','Manual squad','Build or correct the 15-player squad used when manual mode is enabled. Verified Official FPL player data is required.',
    teamsheetElement('p',{id:'manualEditorAvailability',class:'status'},'Checking player data…'));
  if(manualWrap){manualWrap.open=true;manualPanel.appendChild(manualWrap);}
  else manualPanel.appendChild(teamsheetElement('p',{class:'status'},'Manual squad controls are unavailable.'));
  addRoute(teamsheetSettingsContent('#/settings/team-account/manual-squad','Manual squad','Edit the local 15-player fallback without changing anything in Official FPL.',manualPanel));

  addRoute(teamsheetSettingsContent('#/settings/team-account/connection','Connection guidance','Teamsheet reads public Official FPL identifiers only; it does not ask for an FPL password.',
    teamsheetPanel('Public connection','Find your Team ID','Open your team in Official FPL and copy the number after /entry/ in the address.',
      teamsheetElement('div',{class:'settings-action-links'},
        teamsheetElement('a',{class:'btn ghost',href:'#/team'},'Open Team setup'),
        teamsheetElement('a',{class:'btn ghost',href:'#/leagues/manage'},'Manage saved leagues')),
      teamsheetElement('div',{class:'note plain'},teamsheetElement('b',{},'Account boundary: '),'Free transfers and bank remain manual because the public feed cannot verify them without a separately approved authenticated integration.'),
      teamsheetElement('div',{class:'note plain'},teamsheetElement('b',{},'Saved leagues: '),'League IDs and local labels are managed inside Leagues. Settings links there rather than duplicating competitive controls.'))));

  addRoute(teamsheetSettingsMenu('#/settings/research','Research Tools','Supporting player research that does not belong in Team, Transfers or Fixtures.',[
    teamsheetSettingsCard('#/settings/research/players','↗','Player Explorer','Filter current projections and open the existing player detail view.')
  ]));
  playersView.classList.remove('view');
  playersView.hidden=false;
  addRoute(teamsheetSettingsContent('#/settings/research/players','Player Explorer','Research individual projections without restoring Players to primary navigation.',playersView));

  addRoute(teamsheetSettingsMenu('#/settings/evidence','Evidence & Performance','What was recorded, what happened and how Teamsheet has performed.',[
    teamsheetSettingsCard('#/settings/evidence/deadline','D','Deadline evidence','Prospective pre-deadline records and capture history.'),
    teamsheetSettingsCard('#/settings/evidence/outcomes','O','Official outcomes','Authoritative completed-Gameweek records and revisions.'),
    teamsheetSettingsCard('#/settings/evidence/metrics','M','Performance metrics','Descriptive points, minutes and uncertainty evaluation.'),
    teamsheetSettingsCard('#/settings/evidence/review','R','Operating review','Weekly and season evidence summaries.'),
    teamsheetSettingsCard('#/settings/evidence/exports','↓','Exports','Owner-controlled JSON, Markdown and CSV downloads.')
  ]));
  evidencePanel.hidden=false;
  addRoute(teamsheetSettingsContent('#/settings/evidence/deadline','Deadline evidence','Prospective records captured before the Official FPL deadline.',
    evidencePanel,
    teamsheetElement('div',{id:'evidenceDeliveryHost'})));
  addRoute(teamsheetSettingsContent('#/settings/evidence/outcomes','Official outcomes','Completed and corrected Official FPL outcome records.',teamsheetElement('div',{id:'outcomesHost'})));
  addRoute(teamsheetSettingsContent('#/settings/evidence/metrics','Performance metrics','Descriptive evaluation from matched official evidence only.',teamsheetElement('div',{id:'metricsHost'})));
  addRoute(teamsheetSettingsContent('#/settings/evidence/review','Operating review','Weekly and season summaries from immutable local evidence.',teamsheetElement('div',{id:'reviewHost'})));
  addRoute(teamsheetSettingsContent('#/settings/evidence/exports','Exports','Downloads are generated on demand and remain under your control.',
    teamsheetElement('div',{id:'evidenceExportHost'}),
    teamsheetElement('div',{id:'outcomeExportHost'}),
    teamsheetElement('div',{id:'reviewExportHost'})));

  const providerRow=document.getElementById('oddsKey')?.closest?.('.row')||null;
  const backtestRow=document.getElementById('btBtn')?.closest?.('.row')||null;
  const backtestHint=backtestRow?.nextElementSibling?.classList?.contains('hint')?backtestRow.nextElementSibling:null;
  const backtestOut=document.getElementById('btOut');
  const healthPanel=teamsheetPanel('Current session','Provider Health','Which approved source is active, how fresh it is and what any fallback changes.',teamsheetElement('div',{id:'providerHealthRows'}));
  healthPanel.id='providerHealthDetail';
  healthPanel.setAttribute('aria-labelledby','providerHealthTitle');
  healthPanel.querySelector('h3')?.setAttribute('id','providerHealthTitle');

  const optionalPanel=teamsheetPanel('Approved optional inputs','Optional sources','Optional providers may improve context, but their approved fallbacks keep core FPL decisions available.');
  if(providerRow) optionalPanel.appendChild(providerRow);
  else optionalPanel.appendChild(teamsheetElement('p',{class:'status'},'Optional-source controls are unavailable.'));
  const calibrationPanel=teamsheetPanel('Historical diagnostic','Calibration','The existing deadline-safe walk-forward check remains diagnostic and does not change live projections automatically.');
  if(backtestRow) calibrationPanel.appendChild(backtestRow);
  if(backtestHint) calibrationPanel.appendChild(backtestHint);
  if(backtestOut) calibrationPanel.appendChild(backtestOut);
  setupPanel.remove?.();

  addRoute(teamsheetSettingsMenu('#/settings/data','Data & Diagnostics','Current provider detail, optional inputs and recovery tools.',[
    teamsheetSettingsCard('#/settings/data/providers','●','Provider Health','Freshness, active source and fallback consequences.'),
    teamsheetSettingsCard('#/settings/data/optional-sources','+','Optional sources','Odds and Understat controls.'),
    teamsheetSettingsCard('#/settings/data/calibration','≈','Calibration','Deadline-safe historical diagnostic.'),
    teamsheetSettingsCard('#/settings/data/recovery','↺','Recovery','Restore verified backups and inspect recovery warnings.'),
    teamsheetSettingsCard('#/settings/data/storage','×','Local storage','Delete specific local evidence datasets.')
  ]));
  addRoute(teamsheetSettingsContent('#/settings/data/providers','Provider Health','Full technical source status remains here; healthy states do not occupy the main header.',healthPanel));
  addRoute(teamsheetSettingsContent('#/settings/data/optional-sources','Optional sources','Configure approved supporting inputs without changing provider transport or model rules.',optionalPanel));
  addRoute(teamsheetSettingsContent('#/settings/data/calibration','Calibration','Run the existing historical diagnostic without changing live recommendations.',calibrationPanel));
  addRoute(teamsheetSettingsContent('#/settings/data/recovery','Recovery','Restored files remain recovery-only and cannot silently become official or current.',
    teamsheetElement('div',{id:'evidenceRecoveryHost'}),
    teamsheetElement('div',{id:'outcomeRecoveryHost'}),
    teamsheetElement('div',{id:'stage10DiagnosticsHost'})));
  addRoute(teamsheetSettingsContent('#/settings/data/storage','Local storage','Delete one local dataset at a time. Downloaded files are outside Teamsheet and are not removed.',
    teamsheetElement('div',{id:'evidenceStorageHost'}),
    teamsheetElement('div',{id:'outcomeStorageHost'}),
    teamsheetElement('div',{id:'metricStorageHost'})));

  addRoute(teamsheetSettingsMenu('#/settings/help','Help & About','Plain-English guidance for interpreting Teamsheet and this build.',[
    teamsheetSettingsCard('#/settings/help/recommendations','?','Recommendations','What Teamsheet does and what remains your decision.'),
    teamsheetSettingsCard('#/settings/help/uncertainty','±','Expected points & uncertainty','How projections and ranges should be read.'),
    teamsheetSettingsCard('#/settings/help/limitations','!','Known limitations','Important gaps and evidence boundaries.'),
    teamsheetSettingsCard('#/settings/help/privacy','○','Privacy & data','Local storage, public identifiers and exports.'),
    teamsheetSettingsCard('#/settings/help/about','i','About this build','Model, rules, commit and source identity.'),
    teamsheetSettingsCard('#/settings/help/operations','✓','Live-season operations','What to check before and after a deadline.')
  ]));
  addRoute(teamsheetSettingsContent('#/settings/help/recommendations','Recommendations','Teamsheet supports decisions; it never submits changes to Official FPL.',
    teamsheetPanel('Decision support','You remain in control','Teamsheet compares the current verified inputs and presents a recommendation with its main risk. It does not log in to FPL, confirm transfers, set captaincy or change your squad.',
      teamsheetElement('div',{class:'note plain'},teamsheetElement('b',{},'Team: '),'Review the proposed XI, captain and bench, then reproduce any chosen action in Official FPL.'),
      teamsheetElement('div',{class:'note plain'},teamsheetElement('b',{},'Transfers: '),'Model comparisons are alternatives against making no transfer, not promised FPL points.'),
      teamsheetElement('div',{class:'note plain'},teamsheetElement('b',{},'Leagues: '),'Rival and exposure views report selected public facts; they do not infer protect or chase strategy.'))));
  addRoute(teamsheetSettingsContent('#/settings/help/uncertainty','Expected points & uncertainty','Projections are estimates, not confirmed outcomes or team news.',
    teamsheetPanel('Interpretation','Read the range, not only the headline','Expected points combine the approved model inputs for a defined Gameweek horizon. Player detail shows uncertainty where a valid distribution is available.',
      teamsheetElement('div',{class:'note plain'},'A narrow difference between players or captains is a close model call, not a certainty.'),
      teamsheetElement('div',{class:'note plain'},'Expected minutes are model estimates. Official availability flags and current team news still matter.'),
      teamsheetElement('div',{class:'note plain'},'Pre-season and missing-data states remain deliberately less precise rather than manufacturing detail.'))));
  addRoute(teamsheetSettingsContent('#/settings/help/limitations','Known limitations','The application states what has not been verified instead of treating automated tests as physical acceptance.',
    teamsheetPanel('Current boundaries','Important limitations','',
      teamsheetElement('ul',{class:'settings-readable-list'},
        teamsheetElement('li',{},'Prospective performance evidence remains descriptive until enough genuine pre-deadline observations exist.'),
        teamsheetElement('li',{},'Ask Teamsheet works keylessly only in the approved artifact-preview environment until a separately approved serverless migration.'),
        teamsheetElement('li',{},'Public Official FPL transport can be unavailable or return incomplete data.'),
        teamsheetElement('li',{},'Automated tests do not prove physical iPhone usability, VoiceOver behaviour or live endpoint availability.'),
        teamsheetElement('li',{},'Projected global rank, projected rival outcomes and protect/balanced/chase strategy are not implemented.')))));
  addRoute(teamsheetSettingsContent('#/settings/help/privacy','Privacy & data','Teamsheet uses public FPL identifiers and local browser storage; it does not request an FPL password.',
    teamsheetPanel('Local-first boundary','What is stored','Configuration, manual squad, approved caches, calibration and validated evidence are stored locally in the browser.',
      teamsheetElement('div',{class:'note plain'},'Exported JSON files are complete and unencrypted. Deleting browser records cannot remove files already saved to Files or Downloads.'),
      teamsheetElement('div',{class:'note plain'},'Restored evidence remains recovery-only and cannot alter recommendations or become the official prospective record.'),
      teamsheetElement('div',{class:'note plain'},'Odds keys remain browser-held, password-masked, direct-only and removable with one action. Anthropic keys are never stored client-side.'))));
  addRoute(teamsheetSettingsContent('#/settings/help/about','About this build','Confirm the reviewed model, rules and source identity used by this page.',teamsheetBuildInfoPanel()));
  addRoute(teamsheetSettingsContent('#/settings/help/operations','Live-season operations','A small set of checks protects the prospective evidence workflow.',
    teamsheetPanel('Before and after each deadline','Operational checklist','',
      teamsheetElement('ol',{class:'settings-readable-list'},
        teamsheetElement('li',{},'Before the deadline, open Teamsheet on a verified refresh and confirm Deadline Evidence is official-eligible.'),
        teamsheetElement('li',{},'After a complete or corrected Gameweek, allow Official Outcomes and Metrics to update.'),
        teamsheetElement('li',{},'Use Exports to save the required JSON, Markdown or CSV files and confirm they appear in Files or Downloads.'),
        teamsheetElement('li',{},'Use Recovery only for verified backups. Never clear browser data before durable files have been checked.'),
        teamsheetElement('li',{},'Google Sheets import remains manual; no automatic authentication or scheduled export is active.')))));

  main.appendChild(settingsView);

  const globalDataWarning=header?teamsheetElement('a',{id:'globalDataWarning',class:'global-data-warning',href:'#/settings/data/providers',hidden:'hidden','aria-live':'polite'}):null;
  if(globalDataWarning) header.appendChild(globalDataWarning);
  const askAvailable=Boolean(globalThis.window?.storage);
  const globalAsk=header?teamsheetElement('form',{id:'askTeamsheetGlobal',class:'global-ask',role:'search'}):null;
  const globalAskInput=globalAsk?teamsheetElement('input',{id:'askTeamsheetGlobalInput',type:'search',placeholder:'Ask Teamsheet…',autocomplete:'off','aria-label':'Ask Teamsheet',disabled:askAvailable?null:'disabled','aria-describedby':askAvailable?null:'askHostedStatus'}):null;
  const globalAskSend=globalAsk?teamsheetElement('button',{id:'askTeamsheetGlobalSend',class:'global-ask-send',type:'submit','aria-label':'Send question',disabled:'disabled'},
    teamsheetElement('span',{'aria-hidden':'true'},'↑')):null;
  if(globalAskInput&&!askAvailable) globalAskInput.setAttribute('placeholder','Ask unavailable in this hosted build');
  if(globalAsk&&globalAskInput&&globalAskSend){
    globalAsk.append(globalAskInput,globalAskSend);
    header.appendChild(globalAsk);
    if(askAvailable){
      globalAskInput.addEventListener('input',()=>{globalAskSend.disabled=!globalAskInput.value.trim();});
      globalAsk.addEventListener('submit',event=>{
        event.preventDefault();
        const question=globalAskInput.value.trim();
        if(!question) return;
        const current=normaliseTeamsheetRoute(globalThis.location?.hash||'#/team');
        const origin=current==='#/ask'?'#/team':current;
        const originMeta=teamsheetRouteMeta(origin);
        askRouteBack.setAttribute('href',origin);
        askRouteBack.setAttribute('aria-label',`Back to ${originMeta.title}`);
        askView.dataset.originRoute=origin;
        const fullQuestion=document.getElementById('q');
        if(fullQuestion) fullQuestion.value=question;
        navigateTeamsheetRoute('#/ask');
        setTimeout(()=>document.getElementById('askBtn')?.click?.(),0);
        globalAskInput.value='';
        globalAskSend.disabled=true;
      });
    }
  }

  const updateKeyboardState=()=>{
    const viewport=globalThis.visualViewport;
    const keyboardOpen=Boolean(viewport&&globalThis.innerHeight-viewport.height>160);
    document.documentElement.classList.toggle('keyboard-open',keyboardOpen);
  };
  globalThis.visualViewport?.addEventListener?.('resize',updateKeyboardState);
  globalThis.visualViewport?.addEventListener?.('scroll',updateKeyboardState);
  globalThis.addEventListener?.('pageshow',updateKeyboardState);
  document.addEventListener?.('focusin',updateKeyboardState);
  document.addEventListener?.('focusout',()=>setTimeout(updateKeyboardState,0));
  updateKeyboardState();

  const topLevelViews=[teamView,transfersView,fixturesView,leaguesView,settingsView,askView];
  const settingsRouteNodes=new Map(settingsRoutes.map(node=>[node.dataset.settingsRoute,node]));
  const routeNodes=new Map([
    ['#/team',teamView],
    ['#/transfers',transfersView],
    ['#/fixtures',fixturesView],
    ['#/leagues',leaguesView],
    ['#/settings',settingsView],
    ['#/ask',askView]
  ]);
  const rememberedFocus=new Map();
  const routeScrollPositions=new Map();
  let activeRoute=normaliseTeamsheetRoute(globalThis.location?.hash||'');
  let pendingNavigation=null;
  if(globalThis.history&&'scrollRestoration' in globalThis.history) globalThis.history.scrollRestoration='manual';

  const routeNodeFor=route=>route.startsWith('#/settings')
    ? (settingsRouteNodes.get(route)||settingsView)
    : route.startsWith('#/leagues')
      ? (leaguesView.querySelector(`[data-league-route="${route}"]`)||leaguesView)
      : (routeNodes.get(route)||teamView);
  const currentScroll=()=>({left:Number(globalThis.scrollX||0),top:Number(globalThis.scrollY||0)});
  const rememberRouteState=()=>routeScrollPositions.set(activeRoute,currentScroll());
  const focusCandidateVisible=node=>Boolean(node&&document.contains?.(node)&&!node.hidden&&!node.closest?.('[hidden],[aria-hidden="true"]'));

  document.addEventListener('click',event=>{
    const link=event.target?.closest?.('a[href^="#/"]');
    if(!link) return;
    const destination=normaliseTeamsheetRoute(link.getAttribute('href'));
    if(destination!==activeRoute){
      rememberedFocus.set(activeRoute,link);
      rememberRouteState();
      pendingNavigation={route:destination,kind:link.classList?.contains('route-back')?'return':'forward'};
    }
  },true);

  const focusRoute=(route,node,{preferRemembered=false}={})=>{
    const remembered=preferRemembered?rememberedFocus.get(route):null;
    if(remembered&&document.contains?.(remembered)&&focusCandidateVisible(remembered)){
      remembered.focus?.({preventScroll:true});
      return;
    }
    const heading=node?.querySelector?.(`#${teamsheetRouteHeadingId(route)}`)||node?.querySelector?.('h2');
    heading?.setAttribute?.('tabindex','-1');
    heading?.focus?.({preventScroll:true});
  };

  const activateRoute=(requested,{focus=false,restoreScroll=false,preferRemembered=false}={})=>{
    const route=normaliseTeamsheetRoute(requested);
    const meta=teamsheetRouteMeta(route);
    const previousRoute=activeRoute;
    if(globalThis.location?.hash!==route) globalThis.history?.replaceState?.(null,'',route);
    if(previousRoute!==route) document.dispatchEvent?.(new CustomEvent('teamsheet:before-route-change',{detail:{from:previousRoute,to:route}}));

    topLevelViews.forEach(view=>{
      const active=route.startsWith('#/settings')?view===settingsView:route.startsWith('#/leagues')?view===leaguesView:view===routeNodes.get(route);
      view.hidden=!active;
      view.setAttribute('aria-hidden',active?'false':'true');
    });
    settingsLanding.hidden=route!=='#/settings';
    settingsRouteNodes.forEach((section,sectionRoute)=>{section.hidden=sectionRoute!==route;section.setAttribute('aria-hidden',sectionRoute===route?'false':'true');});
    navLinks.forEach(link=>{
      if(link.dataset.primary===meta.primary) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    });
    document.body.dataset.route=route.slice(2);
    document.title=`${meta.title} — Teamsheet`;
    activeRoute=route;
    const position=restoreScroll?(routeScrollPositions.get(route)||{top:0,left:0}):{top:0,left:0};
    globalThis.scrollTo?.({top:position.top,left:position.left});
    if(focus) focusRoute(route,routeNodeFor(route),{preferRemembered});
    document.dispatchEvent?.(new CustomEvent('teamsheet:route-change',{detail:{route,primary:meta.primary,parent:meta.parent||null}}));
    return route;
  };

  const navigateTeamsheetRoute=(requested,{replace=false}={})=>{
    const route=normaliseTeamsheetRoute(requested);
    rememberRouteState();
    pendingNavigation={route,kind:'forward'};
    if(replace){
      globalThis.history?.replaceState?.(null,'',route);
      pendingNavigation=null;
      activateRoute(route,{focus:true});
    }else if(globalThis.location?.hash===route){
      pendingNavigation=null;
      activateRoute(route,{focus:true});
    }else if(globalThis.location) globalThis.location.hash=route;
    return route;
  };
  globalThis.__teamsheetNavigate=navigateTeamsheetRoute;
  globalThis.addEventListener?.('hashchange',()=>{
    const route=normaliseTeamsheetRoute(globalThis.location?.hash);
    const navigation=pendingNavigation?.route===route?pendingNavigation:null;
    pendingNavigation=null;
    const returning=!navigation||navigation.kind==='return';
    activateRoute(route,{focus:true,restoreScroll:returning,preferRemembered:returning});
  });

  const initial=normaliseTeamsheetRoute(globalThis.location?.hash||'');
  if(globalThis.location?.hash!==initial) globalThis.history?.replaceState?.(null,'',initial);
  activateRoute(initial);
  if(initial!=='#/team'){
    const focusInitial=()=>focusRoute(initial,routeNodeFor(initial));
    if(document.body?.classList?.contains('startup-pending')) document.addEventListener('teamsheet:startup-ready',focusInitial,{once:true});
    else globalThis.queueMicrotask?.(focusInitial);
  }
}

setupAppShell();

export {
  TEAMSHEET_PRIMARY_ROUTES,
  TEAMSHEET_ROUTE_TABLE,
  normaliseTeamsheetRoute,
  teamsheetRouteMeta,
  teamsheetRouteParent,
  setupAppShell
};
