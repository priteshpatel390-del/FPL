import test from 'node:test';
import assert from 'node:assert/strict';
import { S, hydrate } from '../src/state.mjs';
import { expectedGroupedPoints, expectedThresholdPoints, poissonTail, shrunkRate } from '../src/model/scoring-rules.mjs';
import { playerFixtureXP, bonusPerAppearance, penaltyMissRate, rareRate, seasonAppearances, clearXP } from '../src/model/scoring.mjs';
import { matchContext, runScore } from '../src/model/fixtures.mjs';
import { FPL_RULES, MODEL_VERSION, RULES_VERSION } from '../src/config.mjs';
import { syntheticWorld } from './harness.mjs';

globalThis.document = globalThis.document || { getElementById: () => ({ value:'', checked:false,
  options:{length:9}, add(){}, innerHTML:'', addEventListener(){}, querySelectorAll(){return []} }),
  querySelectorAll: () => [], addEventListener(){}, createElement: () => ({}) };
globalThis.window = globalThis.window || {};
globalThis.localStorage = globalThis.localStorage ||
  { _d:{}, getItem(k){ return this._d[k] ?? null; }, setItem(k,v){ this._d[k]=v; } };

syntheticWorld({ hydrate, S, clearXP: () => {} });
clearXP();

const fixtureFor = (team, opp, home=true) => ({ctx:matchContext(team,opp,home)});

test('Stage 8 model and rules versions are explicit', () => {
  assert.equal(MODEL_VERSION, '2.4.0');
  assert.equal(RULES_VERSION, '2026-27.3');
  assert.equal(FPL_RULES.season, '2026-27');
  assert.deepEqual(FPL_RULES.bonus, [3,2,1]);
});

test('Poisson tail handles zero and threshold bounds', () => {
  assert.equal(poissonTail(0,1), 0);
  assert.equal(poissonTail(2,0), 1);
  assert.ok(poissonTail(4,3) > poissonTail(2,3));
});

test('save groups are stepped rather than lambda divided by three', () => {
  const low = expectedGroupedPoints(2.9,3,1);
  const high = expectedGroupedPoints(3.1,3,1);
  assert.ok(low < 2.9/3);
  assert.ok(high > low);
});

test('goals-conceded groups apply negative points per complete pair', () => {
  const one = expectedGroupedPoints(1,2,-1);
  const three = expectedGroupedPoints(3,2,-1);
  assert.ok(one <= 0);
  assert.ok(three < one);
});

test('defensive-contribution threshold remains bounded by two points', () => {
  assert.equal(expectedThresholdPoints(0,10,2), 0);
  const value = expectedThresholdPoints(14,10,2);
  assert.ok(value > 0 && value <= 2);
});

test('rare-event shrinkage remains finite with no player exposure', () => {
  assert.equal(shrunkRate(0,0,0.1,10), 0.1);
  assert.ok(Number.isFinite(shrunkRate(1,0.5,0.01,10)));
});

test('goalkeeper scoring exposes stepped saves and conceded parts', () => {
  const p = {...S.byId[109], penalties_saved:1, red_cards:0, own_goals:0, penalties_missed:0};
  const r = playerFixtureXP(p, fixtureFor(p.team,1,false));
  assert.ok(r.parts.Saves >= 0);
  assert.ok(r.parts['Goals conceded'] <= 0);
  assert.ok('Penalty saves' in r.parts);
  assert.ok(!('Penalty misses' in r.parts));
});

test('outfield scoring exposes explicit disciplinary components', () => {
  const p = {...S.byId[104], yellow_cards:4, red_cards:1, own_goals:1, penalties_missed:1, penalties_order:1};
  const r = playerFixtureXP(p, fixtureFor(p.team,20,true));
  assert.ok(r.parts['Yellow cards'] < 0);
  assert.ok(r.parts['Red cards'] < 0);
  assert.ok(r.parts['Own goals'] < 0);
  assert.ok(r.parts['Penalty misses'] < 0);
});

test('penalty role gates unlisted takers to the population prior', () => {
  const listed = {...S.byId[104], penalties_missed:1, penalties_order:1};
  const unlisted = {...listed, penalties_order:null};
  assert.ok(penaltyMissRate(listed) >= penaltyMissRate(unlisted));
});

test('bonus uses awarded bonus per appearance without fixture multiplier', () => {
  const p = {...S.byId[101], bonus:20};
  const a = bonusPerAppearance(p);
  const easy = playerFixtureXP(p, fixtureFor(p.team,20,true)).parts.Bonus;
  const hard = playerFixtureXP(p, fixtureFor(p.team,1,false)).parts.Bonus;
  assert.ok(a > 0);
  assert.equal(easy, hard);
});

test('aggregate bonus appearances reuse the Stage 4 appearance estimate', () => {
  const fixtures = S.fixtures;
  const history = S.minuteHistory;
  try {
    S.fixtures = Array.from({length:10}, (_,i) => ({id:9000+i,event:i+1,team_h:999,team_a:1,finished:true}));
    S.minuteHistory = {};
    const p = {id:9999,team:999,minutes:900,starts:10};
    const apps = seasonAppearances(p);
    assert.equal(apps, 9.8);
    assert.ok(apps <= 10);
  } finally {
    S.fixtures = fixtures;
    S.minuteHistory = history;
  }
});

test('defensive contributions use appearance probability rather than p60 eligibility', () => {
  const p = {...S.byId[105], defensive_contribution_per_90:20, minutes:300, starts:0};
  const r = playerFixtureXP(p, fixtureFor(p.team,1,false));
  assert.ok(r.parts['Defensive contributions'] > 0);
  assert.ok(r.parts['Defensive contributions'] <= 2);
});

test('fixture run score gives a genuine blank zero and a double both fixtures', () => {
  const fixtures = S.fixtures;
  try {
    S.fixtures = fixtures.filter(f => !(f.event === 11 && (f.team_h === 6 || f.team_a === 6)));
    assert.equal(runScore(6,11,1,'attack'), 0);
    const double = runScore(5,11,1,'attack');
    assert.ok(double > 0);
    assert.equal(S.fixtures.filter(f => f.event === 11 && (f.team_h === 5 || f.team_a === 5)).length, 2);
  } finally {
    S.fixtures = fixtures;
  }
});

test('rare-rate helper uses position population shrinkage', () => {
  const p = {...S.byId[104], red_cards:1, minutes:90};
  const rate = rareRate(p,'red_cards');
  assert.ok(rate > 0 && rate < 1);
});
