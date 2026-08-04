import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { playerDetailCanRestoreFocus } from '../src/ui/player-detail.mjs';

const app=readFileSync(new URL('../app.html',import.meta.url),'utf8');
const shell=readFileSync(new URL('../src/ui/app-shell.mjs',import.meta.url),'utf8');
const views=readFileSync(new URL('../src/ui/views.mjs',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.mjs',import.meta.url),'utf8');
const transfers=readFileSync(new URL('../src/ui/transfer-optimiser-view.mjs',import.meta.url),'utf8');
const leagues=readFileSync(new URL('../src/ui/mini-leagues-view.mjs',import.meta.url),'utf8');

test('player research and Team tables use native player-detail actions',()=>{
  assert.equal(views.includes("class:'clickable',dataset:{pid:p.id},onclick"),false);
  assert.equal(views.includes("class:'clickable',onclick:event=>openPlayerDetailView(s.p"),false);
  assert.match(views,/class:'player-row-action'/);
  assert.match(views,/class:'manual-player-result'/);
});

test('mobile action classes keep the 44 pixel contract',()=>{
  assert.match(app,/.btn.sm{min-height:44px}/);
  assert.match(app,/.chip{min-height:44px}/);
  assert.match(app,/width:44px;height:44px/);
  assert.match(app,/.player-row-action{[^}]*min-height:44px/);
});

test('fixture controls rerender only their dependent views',()=>{
  assert.match(views,/reFixtureDisplay = debounce(() => { renderTicker(); }, 180)/);
  assert.match(views,/reFixtureWindow = debounce(() => { clearXP(); renderTicker(); renderPlayers(); }, 180)/);
  assert.doesNotMatch(views,/reFixtures = debounce\([\s\S]*renderSquad\(\); renderTransfers\(\)/);
});

test('restricted startup state remains presentation-only and route complete',()=>{
  assert.match(main,/teamsheet:restricted/);
  assert.match(views,/function renderRestrictedAppState()/);
  assert.match(leagues,/Official FPL data is unavailable/);
  assert.doesNotMatch(views,/function renderRestrictedAppState\(\)[\s\S]*optimiseTransfers/);
});

test('Ask hosted mode is honest and failed prompts are retained',()=>{
  assert.match(app,/Ask Teamsheet is unavailable in this hosted build/);
  assert.match(app,/role="log"/);
  assert.match(app,/id="askStatus" aria-live="polite"/);
  assert.match(views,/your question has been kept/);
  assert.equal(views.includes('S.thread.pop();'),false);
  assert.match(views,/id:'retryAsk'|\$\('retryAsk'\)/);
  assert.doesNotMatch(main,/The Ask tab still works/);
});

test('route focus and browser history have an explicit scroll-restoration policy',()=>{
  assert.match(shell,/scrollRestoration='manual'/);
  assert.match(shell,/routeScrollPositions/);
  assert.match(shell,/teamsheet:startup-ready/);
  assert.match(shell,/teamsheet:before-route-change/);
  assert.match(shell,/restoreScroll:returning/);
});

test('Player Detail refuses hidden or detached focus restoration',()=>{
  const hidden={hidden:true,focus(){},getAttribute(){return null;},closest(){return null;}};
  assert.equal(playerDetailCanRestoreFocus(hidden),false);
  const ariaHidden={hidden:false,focus(){},getAttribute(name){return name==='aria-hidden'?'true':null;},closest(){return null;}};
  assert.equal(playerDetailCanRestoreFocus(ariaHidden),false);
});

test('fixture and player tables include captions and scoped headings',()=>{
  assert.match(views,/caption.*Fixture difficulty/);
  assert.match(views,/scope:'row'/);
  assert.match(views,/caption.*Player projections/);
  assert.match(views,/const head = .*scope='col'/);
});

test('Transfers wording distinguishes no hit and disclosed alternatives',()=>{
  assert.match(transfers,/:'No hit'/);
  assert.match(transfers,/Other legal options shown/);
  assert.match(transfers,/up to three additional alternatives/);
  assert.match(app,/Optimiser return limit/);
});

test('approved polish adds no service worker, framework or account-write path',()=>{
  const combined=[app,shell,views,main,transfers,leagues].join('\n');
  assert.doesNotMatch(combined,/serviceWorker.register/);
  assert.doesNotMatch(combined,/react|vue|angular/i);
  assert.doesNotMatch(combined,/fantasy\.premierleague\.com\/api\/[\s\S]*method:\s*['"](?:POST|PUT|PATCH|DELETE)/i);
});
