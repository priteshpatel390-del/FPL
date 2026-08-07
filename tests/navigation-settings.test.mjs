import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TEAMSHEET_PRIMARY_ROUTES, normaliseTeamsheetRoute, teamsheetRouteMeta, teamsheetRouteParent } from '../src/ui/app-shell.mjs';

const shellSource=readFileSync(new URL('../src/ui/app-shell.mjs',import.meta.url),'utf8');
const appHtml=readFileSync(new URL('../app.html',import.meta.url),'utf8');
const viewsSource=readFileSync(new URL('../src/ui/views.mjs',import.meta.url),'utf8');
const evidenceSource=readFileSync(new URL('../src/ui/evidence.mjs',import.meta.url),'utf8');
const navStart=appHtml.indexOf('<nav class="tabs"');
const navEnd=appHtml.indexOf('</nav>',navStart);
const staticNav=navStart>=0&&navEnd>=0?appHtml.slice(navStart,navEnd+6):'';
const includesAll=(source,values)=>values.forEach(value=>assert.equal(source.includes(value),true,`Missing ${value}`));
const excludesAll=(source,values)=>values.forEach(value=>assert.equal(source.includes(value),false,`Unexpected ${value}`));

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
  assert.equal(normaliseTeamsheetRoute('#/leagues/not-a-real-screen'),'#/leagues');
});

test('Settings subroutes keep Settings as the active primary destination',()=>{
  assert.deepEqual(teamsheetRouteMeta('#/settings/evidence'),{route:'#/settings/evidence',title:'Evidence & Performance',primary:'settings',settings:'evidence',parent:'#/settings'});
  assert.equal(teamsheetRouteParent('#/settings/evidence/metrics'),'#/settings/evidence');
  assert.equal(teamsheetRouteMeta('#/ask').primary,null);
});

test('route addresses never encode account, provider-key or evidence identities',()=>{
  const routes=TEAMSHEET_PRIMARY_ROUTES.map(item=>item.route).concat(['#/ask','#/settings/team-account','#/settings/research/players','#/settings/evidence','#/settings/data','#/settings/help']);
  for(const route of routes){
    for(const forbidden of ['teamId','leagueId','odds','key','record','snapshot','manager']) assert.equal(route.toLowerCase().includes(forbidden.toLowerCase()),false);
  }
});

test('static deployable navigation uses exactly five real links',()=>{
  assert.equal(staticNav.includes('aria-label="Primary"'),true);
  assert.equal((staticNav.match(/class="tab"/g)||[]).length,5);
  includesAll(staticNav,['href="#/team"','href="#/transfers"','href="#/fixtures"','href="#/leagues"','href="#/settings"']);
  excludesAll(staticNav,['>Players<','>More<','>Ask<','role="tablist"','role="tab"']);
});

test('bottom navigation uses controlled monochrome SVG icons rather than emoji glyphs',()=>{
  assert.equal((staticNav.match(/class="nav-icon"/g)||[]).length,5);
  assert.equal(shellSource.includes("createElementNS('http://www.w3.org/2000/svg','svg')"),true);
  excludesAll(staticNav,['⚙','◈','⇄','▦','⚑']);
  assert.equal(shellSource.includes("icon:'⚙'"),false);
});

test('router owns history and active navigation instead of legacy click-to-hide wiring',()=>{
  includesAll(shellSource,["'hashchange'",'replaceState','aria-current']);
  excludesAll(viewsSource,["document.querySelectorAll('.tab')","behavior:'smooth'"]);
});

test('global Ask Teamsheet composer replaces header Data and Evidence controls',()=>{
  includesAll(shellSource,['askTeamsheetGlobalInput','askTeamsheetGlobalSend',"placeholder:'Ask Teamsheet…'","'aria-label':'Send question'","'↑'"]);
  excludesAll(shellSource,['providerHealthCompact','askTeamsheetCompact','askCallout','headerActions']);
  assert.equal(shellSource.includes('globalDataWarning'),true);
  assert.equal(evidenceSource.includes('evidenceCompact'),false);
});

test('global Ask carries the typed question into the full Ask route and preserves origin',()=>{
  includesAll(shellSource,['fullQuestion.value=question','askView.dataset.originRoute=origin','originMeta.title',"document.getElementById('askBtn')?.click?.()"]);
});

test('Settings headings retain programmatic focus without a visible blue outline',()=>{
  assert.equal(shellSource.includes("heading?.setAttribute?.('tabindex','-1')"),true);
  assert.equal(appHtml.includes('h2[tabindex="-1"]:focus{outline:none}'),true);
});

test('Settings subsections use one accessible parent-aware arrow-only back control',()=>{
  includesAll(shellSource,['teamsheetRouteParent(route)',"'aria-label':`Back to ${parentTitle}`","'←'"]);
  excludesAll(shellSource,['← Settings',"teamsheetRouteHeader('Settings'","teamsheetRouteHeader('Settings · Research Tools'"]);
});

test('iPhone dock has one fixed safe-area grid and keyboard recovery contract',()=>{
  includesAll(appHtml,['nav.tabs{position:fixed;inset:auto 0 0 0','grid-template-columns:repeat(5,minmax(0,1fr))','env(safe-area-inset-bottom,0px)','html.keyboard-open nav.tabs']);
  assert.equal(shellSource.includes('visualViewport'),true);
});

test('Team keeps the current free-transfer and bank controls pending the separate FPL authority gate',()=>{
  assert.equal(shellSource.includes('teamContext'),true);
  includesAll(appHtml,['id="ftCount"','id="bankIn"']);
});

test('Settings remains an organised five-section menu',()=>{
  includesAll(shellSource,['Team & Account','Research Tools','Evidence & Performance','Data & Diagnostics','Help & About']);
  excludesAll(shellSource,["id:'view-more'",'>More<']);
});

test('Fixtures and Leagues remain primary while Player Explorer stays under Research Tools',()=>{
  includesAll(shellSource,['#/fixtures','#/leagues','#/settings/research/players',"playersView.classList.remove('view')"]);
});

test('Evidence and Provider Health detail remain available through Settings only',()=>{
  assert.equal(evidenceSource.includes('#/settings/evidence'),true);
  includesAll(shellSource,['#/settings/data','providerHealthDetail']);
  assert.equal(evidenceSource.includes('data-view="more"'),false);
});


test('League subroutes are ID-free and keep Leagues active',()=>{
  for(const route of ['#/leagues/detail','#/leagues/standings','#/leagues/rival','#/leagues/exposure','#/leagues/manage']){
    assert.equal(normaliseTeamsheetRoute(route),route);
    assert.equal(teamsheetRouteMeta(route).primary,'leagues');
    for(const forbidden of ['leagueId','managerId','entryId']) assert.equal(route.includes(forbidden),false);
  }
});
