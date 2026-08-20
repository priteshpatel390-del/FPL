/* GW1-P2D-P1A — settings route activation regressions.
   ------------------------------------------------------
   PR #136 added the diagnostic Connection check as a settings card and a
   settings content section, but never registered its route in
   TEAMSHEET_ROUTE_TABLE. normaliseTeamsheetRoute() collapses any unregistered
   `#/settings/<section>/...` path back to the section menu, so tapping the card
   re-activated `#/settings/data` and the destination section stayed hidden. On
   a real iPhone that is indistinguishable from "nothing happens".

   PR #136's own tests missed it because they asserted that the route string
   appeared in the shell source. It did — in the card and in the section — just
   not in the registry that decides whether a route exists. These tests execute
   the real shell instead: they build a DOM, run the real setupAppShell(), and
   emulate a real tap, so a rendered destination that cannot actually be
   reached fails here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Element, documentRef } from './route-dom.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(ROOT, path), 'utf8');
const CONNECTION_CHECK = '#/settings/data/connection-check';

/* One shared shell. setupAppShell() is idempotent per document and the tests
   below only navigate, so they share the built DOM and reset the route. */
const hashListeners = [];
function installBrowser(){
  const el = (tag, id, cls) => { const n = new Element(tag); if(id) n.setAttribute('id', id); if(cls) n.className = cls; return n; };
  documentRef.body.children.length = 0;
  documentRef.body.appendChild(el('header'));
  const main = el('main');
  documentRef.body.appendChild(main);
  for(const id of ['view-squad','view-transfers','view-fixtures','view-league','view-players','view-ask'])
    main.appendChild(el('section', id, 'view'));
  for(const id of ['setupPanel','evidencePanel','manualWrap','squadOut']) main.appendChild(el('div', id));
  documentRef.body.appendChild(el('nav', null, 'tabs'));

  globalThis.document = documentRef;
  globalThis.location = {hash:'#/team'};
  globalThis.history = {replaceState(_state,_title,url){ globalThis.location.hash = url; }};
  globalThis.scrollTo = () => {};
  globalThis.scrollX = 0;
  globalThis.scrollY = 0;
  globalThis.CustomEvent = class { constructor(type, init = {}){ this.type = type; this.detail = init.detail; } };
  globalThis.addEventListener = (type, handler) => { if(type === 'hashchange') hashListeners.push(handler); };
  globalThis.queueMicrotask = fn => fn();
}
installBrowser();
const shell = await import('../src/ui/app-shell.mjs');
shell.setupAppShell();

/* Exactly what Safari does when a same-document anchor is tapped: the click
   propagates, then the browser writes the anchor's raw href into location.hash
   and fires hashchange. The application never sees a normalised value here —
   which is precisely how the defect escaped. */
function tap(anchor){
  anchor.dispatchEvent({type:'click', target:anchor});
  globalThis.location.hash = anchor.getAttribute('href');
  hashListeners.forEach(handler => handler({type:'hashchange'}));
}
function goTo(route){
  globalThis.location.hash = route;
  hashListeners.forEach(handler => handler({type:'hashchange'}));
}
const sectionFor = route => documentRef.body.querySelectorAll('[data-settings-route]')
  .find(node => node.getAttribute('data-settings-route') === route) || null;
const cardFor = route => documentRef.body.querySelectorAll('a.settings-card')
  .find(node => node.getAttribute('href') === route) || null;

test('the Connection check card is rendered inside the Data & Diagnostics menu', () => {
  const menu = sectionFor('#/settings/data');
  assert.ok(menu, 'the Data & Diagnostics menu section should exist');
  const card = menu.querySelectorAll('a.settings-card').find(node => node.getAttribute('href') === CONNECTION_CHECK);
  assert.ok(card, 'Connection check must be reachable from Data & Diagnostics');
  assert.match(card.textContent, /Connection check/);
  assert.ok(/Sends no evidence/i.test(card.textContent),
    'the card must say it sends no evidence, so it cannot be mistaken for evidence upload');
});

test('the rendered control is an activatable in-app link the shell router listens for', () => {
  const card = cardFor(CONNECTION_CHECK);
  assert.equal(card.tagName, 'A');
  assert.equal(card.getAttribute('href'), CONNECTION_CHECK);
  /* The shell delegates navigation through document click with this exact
     selector. A control the selector cannot match is dead on a phone. */
  assert.ok(card.closest('a[href^="#/"]'), 'the card must match the shell navigation selector');
});

test('the diagnostic route is registered, so it no longer collapses to the section menu', () => {
  assert.equal(shell.normaliseTeamsheetRoute(CONNECTION_CHECK), CONNECTION_CHECK);
  const meta = shell.teamsheetRouteMeta(CONNECTION_CHECK);
  assert.equal(meta.title, 'Connection check');
  assert.equal(meta.primary, 'settings');
  assert.equal(meta.settings, 'data');
  assert.equal(meta.parent, '#/settings/data');
  assert.equal(shell.teamsheetRouteParent(CONNECTION_CHECK), '#/settings/data');
});

/* The decisive regression: this is the physical failure, executed. */
test('tapping Connection check opens the diagnostic screen', () => {
  goTo('#/settings/data');
  const destination = sectionFor(CONNECTION_CHECK);
  assert.ok(destination, 'the Connection check section should be built');
  assert.equal(destination.hidden, true, 'it should start hidden');

  tap(cardFor(CONNECTION_CHECK));

  assert.equal(globalThis.location.hash, CONNECTION_CHECK,
    'the shell must not rewrite the hash back to the section menu');
  assert.equal(destination.hidden, false, 'the Connection check screen must become visible');
  assert.equal(destination.getAttribute('aria-hidden'), 'false');
  assert.equal(sectionFor('#/settings/data').hidden, true, 'the menu it came from must close');
  assert.equal(documentRef.title, 'Connection check — Teamsheet');
  assert.equal(documentRef.body.dataset.route, 'settings/data/connection-check');
});

test('the diagnostic host and its panel are present once the route is active', () => {
  goTo(CONNECTION_CHECK);
  const host = documentRef.getElementById('evidenceTransportProbeHost');
  assert.ok(host, 'the diagnostic host must exist on the active route');
  assert.equal(host.closest('[data-settings-route]')?.getAttribute('data-settings-route'), CONNECTION_CHECK,
    'the host must live on the Connection check route, not on an evidence surface');
});

test('back navigation from Connection check returns to Data & Diagnostics', () => {
  goTo(CONNECTION_CHECK);
  const destination = sectionFor(CONNECTION_CHECK);
  const back = destination.querySelector('a.route-back');
  assert.ok(back, 'the destination needs a back control');
  assert.equal(back.getAttribute('href'), '#/settings/data');

  tap(back);

  assert.equal(globalThis.location.hash, '#/settings/data');
  assert.equal(sectionFor('#/settings/data').hidden, false, 'the menu must reopen');
  assert.equal(destination.hidden, true, 'the diagnostic screen must close');
});

/* The durable guard. The defect class is "the shell renders a destination the
   router does not know about". This catches every future instance, not just
   this one, by executing the real normaliser over everything the shell links
   to and everything it builds. */
test('every settings destination the shell renders resolves to itself', () => {
  const destinations = documentRef.body.querySelectorAll('[data-settings-route]')
    .map(node => node.getAttribute('data-settings-route'));
  assert.ok(destinations.length >= 20, 'the settings section parser found too few destinations');
  for(const route of destinations){
    assert.equal(shell.normaliseTeamsheetRoute(route), route,
      `${route} is rendered as a destination but is not a registered route, so navigating to it silently falls back`);
    assert.ok(shell.teamsheetRouteMeta(route).title, `${route} has no route title`);
  }

  const links = documentRef.body.querySelectorAll('a[href^="#/"]').map(node => node.getAttribute('href'));
  assert.ok(links.length >= 20, 'the shell link parser found too few links');
  for(const href of new Set(links)){
    assert.equal(shell.normaliseTeamsheetRoute(href), href,
      `a rendered link points at ${href}, which the router does not resolve to itself`);
  }
});

test('the diagnostic route is the only settings route this checkpoint adds', () => {
  const dataRoutes = Object.keys(shell.TEAMSHEET_ROUTE_TABLE).filter(route => route.startsWith('#/settings/data/')).sort();
  assert.deepEqual(dataRoutes, [
    '#/settings/data/calibration',
    '#/settings/data/connection-check',
    '#/settings/data/optional-sources',
    '#/settings/data/providers',
    '#/settings/data/recovery',
    '#/settings/data/storage'
  ], 'Data & Diagnostics gained or lost an unexpected route');
  /* Unrelated sections stay exactly as they were. */
  for(const [section, expected] of [['team-account',2],['research',1],['evidence',5],['help',6]]){
    const count = Object.keys(shell.TEAMSHEET_ROUTE_TABLE).filter(r => r.startsWith(`#/settings/${section}/`)).length;
    assert.equal(count, expected, `#/settings/${section} route count changed`);
  }
});

test('the generated bundle carries the registered route, not only the card', () => {
  const bundle = read('dist/app.bundle.js');
  assert.ok(bundle.includes(`'${CONNECTION_CHECK}':Object.freeze(`),
    'the generated bundle must contain the route-table registration, which is what actually makes the screen reachable');
  assert.ok(bundle.includes(`href:'${CONNECTION_CHECK}'`) || bundle.includes(CONNECTION_CHECK),
    'the generated bundle must contain the card wiring');
  assert.ok(bundle.includes('evidenceTransportProbeHost'), 'the generated bundle must contain the diagnostic host');
});

/* The physical procedure told the owner to expect the PR head on the phone.
   It never can: generated output is committed as a child of the source commit
   it was built from, so the manifest — and therefore the About-this-build
   screen — records that source commit. Both identities are correct; they are
   simply different things. This pins the relationship so a future procedure
   cannot quietly go back to comparing the wrong one. */
test('the in-app build identity is the manifest source commit, not the PR head', () => {
  const manifest = JSON.parse(read('dist/manifest.json'));
  assert.match(manifest.commit, /^[0-9a-f]{40}$|^unversioned$/);
  const shellSource = read('src/ui/app-shell.mjs');
  assert.match(shellSource, /\['Commit',info\.commit\]/,
    'About this build must render BUILD_INFO.commit, which is the manifest commit');
  assert.ok(read('dist/app.bundle.js').includes(`"commit":"${manifest.commit}"`),
    'the generated bundle must carry the same commit the manifest records');

  const procedure = read('docs/GW1-P2D-DIAGNOSTIC-TRANSPORT-PROBE.md');
  assert.match(procedure, /priteshpatel390-del\.github\.io\/FPL\//,
    'the physical procedure must name the project-site URL that actually serves Teamsheet');
  /* The user-site root may only be named where the text warns against it. */
  for(const line of procedure.split(/\r?\n/)){
    if(!/priteshpatel390-del\.github\.io\/(?!FPL)/.test(line)) continue;
    assert.match(line, /404|never be used/i,
      `the procedure names the user-site root without warning against it: ${line.trim()}`);
  }
  assert.match(procedure, /source commit/i,
    'the procedure must tell the owner that the phone shows the source commit');
});
