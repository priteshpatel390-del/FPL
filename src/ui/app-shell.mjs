// Teamsheet 2.0.1 app shell — primary navigation, URL routing and Settings hierarchy.
// Reorganises existing DOM nodes without changing model, provider or persistence behaviour.

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
  '#/settings/help',
  '#/leagues/standings',
  '#/leagues/rival',
  '#/leagues/manage'
]);

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
  return '#/team';
}

function teamsheetRouteMeta(value=''){
  const route=normaliseTeamsheetRoute(value);
  const table={
    '#/team':{title:'Team',primary:'team'},
    '#/transfers':{title:'Transfers',primary:'transfers'},
    '#/fixtures':{title:'Fixtures',primary:'fixtures'},
    '#/leagues':{title:'Leagues',primary:'leagues'},
    '#/leagues/standings':{title:'League table',primary:'leagues'},
    '#/leagues/rival':{title:'Rival comparison',primary:'leagues'},
    '#/leagues/manage':{title:'Manage leagues',primary:'leagues'},
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

function teamsheetRouteHeader(title,hint){
  return teamsheetElement('div',{class:'route-header'},
    teamsheetElement('a',{class:'route-back',href:'#/settings','aria-label':'Back to Settings'},
      teamsheetElement('span',{'aria-hidden':'true'},'←')),
    teamsheetElement('h2',{tabindex:'-1'},title),
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
      teamsheetElement('span',{class:'status'},'Free transfers and bank stay visible on Team.')));
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
  if(leaguesHint) leaguesHint.textContent='Official position, points gaps and factual public-squad comparisons. Projected rank and protect/chase strategy are not included.';
  const playersHeading=playersView.querySelector('h2');
  const playersEyebrow=playersView.querySelector('.eyebrow');
  if(playersHeading) playersHeading.textContent='Player Explorer';
  if(playersEyebrow) playersEyebrow.textContent='Research tools';
  const askHeading=askView.querySelector('h2');
  const askEyebrow=askView.querySelector('.eyebrow');
  if(askHeading) askHeading.textContent='Ask Teamsheet';
  if(askEyebrow) askEyebrow.textContent='Decision assistant';
  const askRouteBack=teamsheetElement('a',{id:'askRouteBack',class:'route-back',href:'#/team','aria-label':'Back to Team'},
    teamsheetElement('span',{'aria-hidden':'true'},'←'));
  askView.insertBefore(askRouteBack,askView.firstChild);

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
    teamsheetRouteHeader('Team & Account','Manual squad controls live here. Team ID, free transfers and bank remain visible on Team because they directly affect weekly decisions.'));
  const manualPanel=teamsheetElement('section',{class:'panel'},
    teamsheetElement('span',{class:'eyebrow'},'Squad setup'),
    teamsheetElement('h2',{},'Manual squad'),
    teamsheetElement('p',{class:'hint'},'Build or correct the 15-player squad used when manual mode is enabled. The verified Official FPL player list is required.'),
    teamsheetElement('p',{id:'manualEditorAvailability',class:'status'},'Checking player data…'));
  if(manualWrap){
    manualWrap.open=true;
    manualPanel.appendChild(manualWrap);
  }else manualPanel.appendChild(teamsheetElement('p',{class:'status'},'Manual squad controls are unavailable.'));
  settingsTeam.appendChild(manualPanel);

  const settingsResearch=teamsheetElement('section',{id:'settings-research-players',class:'settings-subview',hidden:'hidden'},
    teamsheetRouteHeader('Player Explorer','Research individual projections without restoring Players to primary navigation.'));
  playersView.classList.remove('view');
  playersView.hidden=false;
  settingsResearch.appendChild(playersView);

  const settingsEvidence=teamsheetElement('section',{id:'settings-evidence',class:'settings-subview',hidden:'hidden'},
    teamsheetRouteHeader('Evidence & Performance','Prospective records, official outcomes, descriptive metrics, operating review and owner-controlled exports.'));
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
    teamsheetRouteHeader('Data & Diagnostics','Provider status, optional source controls and calibration detail.'));
  settingsData.append(healthPanel,setupPanel);

  const settingsHelp=teamsheetElement('section',{id:'settings-help',class:'settings-subview',hidden:'hidden'},
    teamsheetRouteHeader('Help & About','Plain-English guidance about recommendations, limitations, privacy and this build.'),
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

  const globalAsk=header?teamsheetElement('form',{id:'askTeamsheetGlobal',class:'global-ask',role:'search'}):null;
  const globalAskInput=globalAsk?teamsheetElement('input',{id:'askTeamsheetGlobalInput',type:'search',placeholder:'Ask Teamsheet…',autocomplete:'off','aria-label':'Ask Teamsheet'}):null;
  const globalAskSend=globalAsk?teamsheetElement('button',{id:'askTeamsheetGlobalSend',class:'global-ask-send',type:'submit','aria-label':'Send question',disabled:'disabled'},
    teamsheetElement('span',{'aria-hidden':'true'},'↑')):null;
  if(globalAsk&&globalAskInput&&globalAskSend){
    globalAsk.append(globalAskInput,globalAskSend);
    header.appendChild(globalAsk);
    globalAskInput.addEventListener('input',()=>{ globalAskSend.disabled=!globalAskInput.value.trim(); });
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
      const active=route.startsWith('#/settings')?view===settingsView:route.startsWith('#/leagues')?view===leaguesView:view===routeNodes.get(route);
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
      const activeNode=route.startsWith('#/settings')?(settingsSubviews.get(route)||settingsView):route.startsWith('#/leagues')?(leaguesView.querySelector(`[data-league-route="${route}"]`)||leaguesView):(routeNodes.get(route)||teamView);
      const heading=activeNode.querySelector('h2');
      heading?.setAttribute?.('tabindex','-1');
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
