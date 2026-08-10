import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadApp, syntheticWorld } from './harness.mjs';

const walk = root => {
  const nodes=[]; const visit=n=>{ nodes.push(n); (n?.children||[]).forEach(visit); }; visit(root); return nodes;
};
const visibleText = root => walk(root).filter(n=>n.nodeType===3).map(n=>n.textContent).join('');
const assertInert = (root,payload) => {
  const nodes=walk(root);
  assert.ok(visibleText(root).includes(payload),`payload should be visible text: ${payload}`);
  assert.equal(nodes.some(n=>['SCRIPT','IMG'].includes(n.tagName)),false);
  assert.equal(nodes.some(n=>Object.keys(n.attrs||{}).some(k=>/^on/i.test(k))),false);
};

const payloads=['<script>alert(1)</script>','<img src=x onerror=alert(1)>','\"quoted\" <angle>'];

test('XSS-1: hostile team, player and provider values are inert across core rendering', () => {
  const {T,doc}=loadApp(); syntheticWorld(T);
  T.S.teams[1].short_name=payloads[0]; T.S.teams[1].name=payloads[1];
  T.S.boot.elements[0].web_name=payloads[1]; T.S.ustatNote=payloads[2];
  T.renderTicker(); T.renderPlayers(); T.renderAll();
  assertInert(doc.ticker,payloads[0]);
  assertInert(doc.playerTable,payloads[1]);
  assertInert(doc.srcStatus,payloads[2]);
});

test('XSS-1: hostile entry and saved-league names render as text nodes', () => {
  const {T,doc}=loadApp(); syntheticWorld(T);
  T.S.entry={name:payloads[0]};
  // Canonical Mini-League preferences are the only writable representation.
  T.S.miniLeagues={...T.S.miniLeagues,saved:[{id:'1',name:payloads[1]}]};
  // The legacy alias stays non-authoritative, so this write must not render.
  T.S.leagues=[{id:'2',name:payloads[0]}];
  T.renderAll(); T.renderLeagueChips();
  assertInert(doc.gwstrip,payloads[0]);
  assertInert(doc.leagueChips,payloads[1]);
  assert.equal(visibleText(doc.leagueChips).includes(payloads[0]),false,
    'a legacy S.leagues write must not reach saved-league rendering');
});

test('XSS-1: manual squad pills and player-search results keep hostile names inert', () => {
  const {T,doc}=loadApp(); syntheticWorld(T);
  T.S.boot.elements[0].web_name=payloads[0]; T.S.manual=[{id:T.S.boot.elements[0].id,bought:100}];
  T.renderManual(); T.searchPlayers('script');
  assertInert(doc.manualList,payloads[0]);
  assertInert(doc.pResults,payloads[0]);
});

test('XSS-1: squad, captain and transfer rendering keep hostile player text inert', () => {
  const {T,doc}=loadApp({useManual:true}); const world=syntheticWorld(T);
  const extras=[2,2,2,3].map((type,i)=>({...world.elements.find(p=>p.element_type===type),id:900+i,web_name:`Extra ${i}`,team:10+i}));
  T.S.boot.elements.push(...extras); extras.forEach(p=>T.S.byId[p.id]=p);
  T.S.boot.elements[0].web_name=payloads[1];
  T.S.manual=T.S.boot.elements.map(p=>({id:p.id,bought:p.now_cost}));
  const target={...world.elements[0],id:999,web_name:payloads[1],now_cost:40,expected_goals_per_90:5};
  T.S.boot.elements.push(target); T.S.byId[target.id]=target;
  T.renderSquad(); T.renderTransfers();
  assertInert(doc.squadOut,payloads[1]);
  assert.match(visibleText(doc.transferOut),/Updating transfer advice/);
  assert.match(visibleText(doc.transferOut),/Preparing projections/);
  doc.transferOut.appendChild(T.transferPlannerMoveList({transfers:[
    {outPlayerId:T.S.boot.elements[0].id,inPlayerId:target.id}
  ]}));
  assertInert(doc.transferOut,payloads[1]);
});

test('XSS-1: approved Stage 3.5 source has no innerHTML sink outside the excluded Ask renderer', () => {
  const source=readFileSync(new URL('../src/ui/views.mjs',import.meta.url),'utf8');
  const sinks=source.split('\n').filter(line=>line.includes('.innerHTML'));
  assert.equal(sinks.length,1);
  assert.match(sinks[0],/thread/);
  for(const file of ['../src/main.mjs','../src/model/backtest.mjs'])
    assert.doesNotMatch(readFileSync(new URL(file,import.meta.url),'utf8'),/\.innerHTML/);
});
