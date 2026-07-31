import test from 'node:test';
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
  assert.match(appHtml,/id="ftCount"/);
  assert.match(appHtml,/id="bankIn"/);
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
