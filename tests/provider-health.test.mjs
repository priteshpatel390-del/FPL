import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HEALTH_STATES, HEALTH_THRESHOLDS_MS, resetHealth, markLive, markCached,
  markFallback, markPartial, markDisabled, markUnavailable, markHealth,
  getHealth, healthRows, thresholdFor
} from '../src/providers/registry.mjs';

test.beforeEach(() => resetHealth());

test('exports the approved seven provider-health states', () => {
  assert.deepEqual(Object.values(HEALTH_STATES), [
    'Live','Cached','Stale','Fallback','Partial','Disabled','Unavailable'
  ]);
});

test('live success records lastSuccess and consequence', () => {
  const at = 1_000_000;
  const h = markLive('fpl', 'direct', 'core season data current', at);
  assert.equal(h.state, HEALTH_STATES.LIVE);
  assert.equal(h.lastSuccess, at);
  assert.equal(h.consequence, 'core season data current');
});

test('fresh cached FPL data becomes stale after the context-specific threshold', () => {
  const at = 1_000_000;
  markCached('fpl', at, 'saved snapshot', 'refreshing');
  assert.equal(getHealth('fpl', {seasonLive:false}, at + HEALTH_THRESHOLDS_MS.fplOther - 1).state, HEALTH_STATES.CACHED);
  assert.equal(getHealth('fpl', {seasonLive:false}, at + HEALTH_THRESHOLDS_MS.fplOther + 1).state, HEALTH_STATES.STALE);
});

test('FPL uses the shorter stale threshold during live gameweeks', () => {
  assert.equal(thresholdFor('fpl', {seasonLive:true}), 30 * 60 * 1000);
  assert.equal(thresholdFor('fpl', {seasonLive:false}), 6 * 60 * 60 * 1000);
});

test('Understat and odds use their approved provider-specific thresholds', () => {
  assert.equal(thresholdFor('understat'), 24 * 60 * 60 * 1000);
  assert.equal(thresholdFor('odds'), 6 * 60 * 60 * 1000);
});

test('disabled is a neutral user choice and never mutates into stale', () => {
  markDisabled('understat', 'turned off', 'FPL ratings used');
  const h = getHealth('understat', {}, Number.MAX_SAFE_INTEGER);
  assert.equal(h.state, HEALTH_STATES.DISABLED);
  assert.equal(h.lastSuccess, null);
});

test('fallback and unavailable remain distinct', () => {
  markFallback('odds', 'quota exhausted', 'internal model active');
  markUnavailable('fpl', 'all transports failed', 'season data cannot be shown');
  assert.equal(getHealth('odds').state, HEALTH_STATES.FALLBACK);
  assert.equal(getHealth('fpl').state, HEALTH_STATES.UNAVAILABLE);
});

test('partial preserves a usable success timestamp', () => {
  const at = 2_000_000;
  markPartial('understat', '18 teams mapped', 'FPL fills gaps', at);
  const h = getHealth('understat', {}, at + 1);
  assert.equal(h.state, HEALTH_STATES.PARTIAL);
  assert.equal(h.lastSuccess, at);
});

test('legacy boolean health calls map safely onto the richer model', () => {
  assert.equal(markHealth('archive', true, 'loaded').state, HEALTH_STATES.LIVE);
  assert.equal(markHealth('archive', false, 'failed').state, HEALTH_STATES.UNAVAILABLE);
  assert.equal(markHealth('archive', false, 'substitute active', true).state, HEALTH_STATES.FALLBACK);
});

test('healthRows reports stable provider order and calculated age', () => {
  markLive('odds', 'priced', 'market active', 1000);
  markDisabled('understat');
  const rows = healthRows({}, 4000);
  assert.deepEqual(rows.map(r => r.provider), ['understat','odds']);
  assert.equal(rows.find(r => r.provider === 'odds').ageMs, 3000);
});
