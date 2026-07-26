// tests/unit.test.mjs — adjustment 8: model modules tested via direct ES import,
// no DOM harness. (Modules that touch the DOM at call time stay harness-tested.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { S, hydrate } from '../src/state.mjs';
import { matchContext, multToDiff, teamFixtures } from '../src/model/fixtures.mjs';
import { availability, priceBaseline, projectXP, clearXP } from '../src/model/scoring.mjs';
import { bestXI, sellPrice } from '../src/squad.mjs';
import { poissonOver, solveLambda } from '../src/providers/odds.mjs';
import { computeBacktest, parseCSV, pearson } from '../src/model/backtest.mjs';
import { mapTeamName } from '../src/providers/common.mjs';
import { cachePut, cacheGet } from '../src/storage.mjs';
import { escapeHTML } from '../src/util.mjs';
import { PROVIDER_QUALITY, markHealth, getHealth } from '../src/providers/registry.mjs';
import { MODEL_VERSION, RULES_VERSION, ODDS_RULES } from '../src/config.mjs';
import { syntheticWorld } from './harness.mjs';

// minimal globals for modules that reach for storage at call time
// minimal DOM stub: hydrate touches the position <select> at call time
globalThis.document = globalThis.document || { getElementById: () => ({ value:'', checked:false,
  options:{length:9}, add(){}, innerHTML:'', addEventListener(){}, querySelectorAll(){return []} }),
  querySelectorAll: () => [], addEventListener(){}, createElement: () => ({}) };
globalThis.window = globalThis.window || {};
globalThis.localStorage = globalThis.localStorage ||
  { _d:{}, getItem(k){ return this._d[k] ?? null; }, setItem(k,v){ this._d[k]=v; } };

syntheticWorld({ hydrate, S, clearXP: () => {} });
clearXP();

test('direct import: fixture model strength ordering', () => {
  const strong = matchContext(1, 20, true), weak = matchContext(20, 1, false);
  assert.ok(strong.xGF > weak.xGF);
  assert.ok(strong.cs > 0 && strong.cs < 1);
  assert.equal(multToDiff(1.30), 1);
  assert.equal(multToDiff(0.77), 5);
});

test('direct import: projection archetypes sane and parts sum', () => {
  const fwd = S.byId[101], x = projectXP(fwd, 11, 6);
  assert.ok(x.perGW > 4 && x.perGW < 12, 'elite FWD range: ' + x.perGW);
  const sum = Object.values(x.parts).reduce((a,b)=>a+b,0);
  assert.ok(Math.abs(sum - x.total) < 1e-9);
  assert.equal(projectXP(S.byId[111], 11, 6).total, 0, 'injured → zero');
});

test('direct import: availability scale', () => {
  assert.equal(availability({status:'a'}), 1);
  assert.equal(availability({status:'i'}), 0);
  assert.equal(availability({status:'d', chance_of_playing_next_round:25}), 0.25);
});

test('direct import: bestXI legality and sellPrice rounding', () => {
  // legal 15 assembled from archetypes + clones (same ids the harness registers)
  const clone = (id,nid,t)=>{ const c={...S.byId[id], id:nid, element_type:t}; S.byId[nid]=c; return c; };
  const squad = [S.byId[108], S.byId[109],
    S.byId[106], S.byId[107], clone(106,301,2), clone(107,302,2), clone(106,303,2),
    S.byId[104], S.byId[105], S.byId[110], clone(104,304,3), clone(105,305,3),
    S.byId[101], S.byId[102], S.byId[103]].map((p,i)=>({p, position:i+1, multiplier:1}));
  const xi = bestXI(squad, 11);
  assert.equal(xi.xi.length, 11);
  assert.equal(xi.xi.filter(s=>s.p.element_type===1).length, 1, 'exactly one keeper');
  assert.equal(sellPrice({p:{now_cost:52}, bought:50}), 51);
  assert.equal(sellPrice({p:{now_cost:48}, bought:50}), 48);
});

test('direct import: odds maths invertible', () => {
  const lam = solveLambda(0.55, 2.5);
  assert.ok(Math.abs(poissonOver(lam, 2.5) - 0.55) < 0.005);
});

test('direct import: computeBacktest recovers planted biases with provenance', () => {
  // compact synthetic season: formula-generated truth × known position bias
  const BIAS = {2:1.15, 3:0.9, 4:1.05, 1:1.0};
  let seed = 7; const rnd = () => (seed = (seed*16807)%2147483647) / 2147483647;
  const pos = {1:'GK',2:'DEF',3:'MID',4:'FWD'};
  let csv = 'name,position,minutes,total_points,GW,expected_goals,expected_assists,saves,bps,yellow_cards,defensive_contribution\n';
  for (let p = 1; p <= 4; p++) for (let i = 0; i < 30; i++) {
    const xg90 = p===4?0.3+rnd()*0.4 : p===3?0.1+rnd()*0.4 : p===2?0.03+rnd()*0.1 : 0;
    const xa90 = p>=3?0.1+rnd()*0.25 : 0.05, sv90 = p===1?2.5+rnd()*2.5:0;
    const bps90 = 15+rnd()*25, dc90 = p===2?7+rnd()*7 : p===3?4+rnd()*9 : 0, mins = 75+rnd()*15;
    for (let gw = 1; gw <= 38; gw++) {
      let pts = 0;
      if (gw >= 20) {
        const mF = mins/90, pAny = Math.min(.98, mins/28), p60 = Math.min(.97, (mins-18)/55);
        let xp = pAny + p60 + xg90*mF*({1:6,2:6,3:5,4:4}[p]) + xa90*mF*3;
        if ({1:4,2:4,3:1}[p]) xp += Math.exp(-1.42)*({1:4,2:4,3:1}[p])*p60;
        if (p <= 2) xp -= (1.42/2)*mF*0.72;
        if (p === 1) xp += (sv90/3)*mF;
        const thr = {2:10,3:12}[p];
        if (thr && dc90) xp += 2*(1/(1+Math.exp(-(dc90-thr)/2.2)))*p60;
        xp += Math.max(0, Math.min(1.8, (bps90-16)/20))*mF;
        pts = Math.round(xp*BIAS[p] + (rnd()-0.5)*3);
      }
      csv += `${pos[p]}_${i},${pos[p]},${mins.toFixed(0)},${pts},${gw},${(xg90*mins/90).toFixed(3)},${(xa90*mins/90).toFixed(3)},${Math.round(sv90*mins/90)},${Math.round(bps90*mins/90)},0,${Math.round(dc90*mins/90)}\n`;
    }
  }
  const { calib, backtest } = computeBacktest(csv, { season:'unit-synth', url:'unit://csv', now: 1753500000000 });
  assert.ok(Math.abs(calib[2] - 1.15) < 0.06, 'DEF: ' + calib[2]);
  assert.ok(Math.abs(calib[3] - 0.90) < 0.06, 'MID: ' + calib[3]);
  assert.ok(Math.abs(calib[4] - 1.05) < 0.06, 'FWD: ' + calib[4]);
  // adjustment 6: provenance present and reproducible
  assert.equal(backtest.provenance.modelVersion, MODEL_VERSION);
  assert.equal(backtest.provenance.rulesVersion, RULES_VERSION);
  assert.equal(backtest.provenance.dataset.url, 'unit://csv');
  assert.equal(backtest.provenance.predictedAt, 1753500000000);
  assert.equal(backtest.provenance.dataset.pinned, false);
});

test('direct import: cache envelope invalidates on schema/season change', async () => {
  await cachePut('t:cache', { a: 1 }, '2026-27');
  assert.deepEqual(await cacheGet('t:cache', '2026-27'), { a: 1 });
  assert.equal(await cacheGet('t:cache', '2027-28'), null, 'season change invalidates');
});

test('direct import: registry carries six quality attributes per provider', () => {
  for (const p of ['fpl','understat','odds','archive']) {
    const q = PROVIDER_QUALITY[p];
    for (const attr of ['dataAuthority','transportAvailability','schemaStability',
      'freshness','historicalReproducibility','licensingConfidence'])
      assert.ok(['low','medium','high'].includes(q[attr]), `${p}.${attr}`);
  }
  markHealth('odds', false, 'test', true);
  assert.equal(getHealth('odds').usingFallback, true);
});

test('direct import: ODDS_RULES defined before any formula change', () => {
  for (const k of ['minH2hBooks','minTotalsBooks','outlierProbDeviation',
    'maxQuoteAgeHours','kickoffMatchWindowHours','lowConfidenceBooks'])
    assert.ok(typeof ODDS_RULES[k] === 'number', k);
});

test('direct import: escapeHTML neutralises the usual suspects', () => {
  assert.equal(escapeHTML(`<img src=x onerror="a('b')">`),
    '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;');
});
