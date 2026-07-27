// tests/schema-state.test.mjs — D-14 integration: validation inside hydrate(),
// which is the single point both fresh and cached snapshots pass through.
import test from 'node:test';
import assert from 'node:assert/strict';
import { S, hydrate, recordIssues } from '../src/state.mjs';

// hydrate touches the position <select> at call time
globalThis.document = globalThis.document || {
  getElementById: () => ({ value: '', checked: false, options: { length: 9 },
    add() {}, innerHTML: '', addEventListener() {}, querySelectorAll() { return []; } }),
  querySelectorAll: () => [], addEventListener() {}, createElement: () => ({})
};
globalThis.window = globalThis.window || {};

const team = id => ({ id, name: 'Team ' + id, short_name: 'T' + id,
  strength_attack_home: 1200, strength_attack_away: 1150,
  strength_defence_home: 1180, strength_defence_away: 1140 });
const element = id => ({ id, web_name: 'P' + id, team: 1, element_type: 3, now_cost: 50, minutes: 900 });
const snapshot = (o = {}) => ({ at: 1753500000000,
  events: [{ id: 1, is_current: true, is_next: false, finished: false, name: 'GW1' },
           { id: 2, is_current: false, is_next: true, finished: false, name: 'GW2' }],
  teams: [team(1), team(2)],
  elements: [element(101), element(102)],
  element_types: [{ id: 3, singular_name_short: 'MID', singular_name: 'Midfielder' }],
  fixtures: [{ id: 1, event: 1, team_h: 1, team_a: 2, team_h_difficulty: 3, team_a_difficulty: 3 }],
  ...o });

const loadGood = () => hydrate(snapshot());

test('hydrate: a valid snapshot loads clean and reports no issues', () => {
  const r = loadGood();
  assert.equal(r.ok, true);
  assert.deepEqual(r.issues, []);
  assert.deepEqual(S.dataIssues, []);
  assert.equal(S.boot.elements.length, 2);
  assert.equal(S.fixtures.length, 1);
});

test('hydrate: a fatal cached snapshot is refused and does NOT poison existing state', () => {
  loadGood();
  const goodBoot = S.boot, goodTeams = S.teams, goodById = S.byId, goodFixtures = S.fixtures;

  // exactly what a truncated or half-written localStorage entry looks like
  const r = hydrate({ at: 1, events: [], teams: [team(1)], elements: undefined,
    element_types: [], fixtures: [] });

  assert.equal(r.ok, false, 'the load is refused');
  assert.ok(r.issues.some(i => i.severity === 'fatal' && i.code === 'bootstrap_missing_collection'));
  assert.equal(S.boot, goodBoot, 'S.boot untouched');
  assert.equal(S.teams, goodTeams, 'S.teams untouched');
  assert.equal(S.byId, goodById, 'S.byId untouched');
  assert.equal(S.fixtures, goodFixtures, 'S.fixtures untouched');
  assert.ok(S.dataIssues.length, 'but the failure is still reported');
});

test('hydrate: a non-object cached payload is fatal without throwing', () => {
  loadGood();
  const boot = S.boot;
  for (const bad of [null, undefined, 'corrupt', 7, []]) {
    const r = hydrate(bad);
    assert.equal(r.ok, false);
    assert.equal(S.boot, boot, 'previous good data survives ' + JSON.stringify(bad));
  }
});

test('hydrate: a fatal fixtures payload blocks the load rather than loading half of it', () => {
  loadGood();
  const boot = S.boot;
  const r = hydrate(snapshot({ fixtures: 'not-an-array' }));
  assert.equal(r.ok, false);
  assert.ok(r.issues.some(i => i.code === 'fixtures_not_array' && i.severity === 'fatal'));
  assert.equal(S.boot, boot, 'core state not partially replaced');
});

test('hydrate: partial row damage still loads, keeping every valid row', () => {
  const r = hydrate(snapshot({ elements: [element(101), null, 'junk', element(102)] }));
  assert.equal(r.ok, true, 'partial damage must not block the app');
  assert.equal(S.boot.elements.length, 2, 'valid rows retained');
  assert.ok(S.byId[101] && S.byId[102]);
  const issue = S.dataIssues.find(i => i.code === 'bootstrap_invalid_rows');
  assert.equal(issue.count, 2);
  assert.equal(issue.severity, 'partial');
});

test('hydrate: fixture and bootstrap issues are reported together on one load', () => {
  const dupe = { id: 1, event: 1, team_h: 1, team_a: 2, team_h_difficulty: 3, team_a_difficulty: 3 };
  const r = hydrate(snapshot({ elements: [element(101), null], fixtures: [dupe, { ...dupe }] }));
  assert.equal(r.ok, true);
  const codes = S.dataIssues.map(i => i.code).sort();
  assert.deepEqual(codes, ['bootstrap_invalid_rows', 'fixture_exact_duplicate']);
  assert.equal(S.fixtures.length, 1, 'D-13 dedupe still applies');
});

test('hydrate: resets issues each load so stale reports do not accumulate', () => {
  hydrate(snapshot({ elements: [element(101), null] }));
  assert.equal(S.dataIssues.length, 1);
  loadGood();
  assert.deepEqual(S.dataIssues, [], 'a clean load clears the previous report');
});

test('recordIssues: optional-provider reports are idempotent across repeat loads', () => {
  loadGood();
  const mk = n => [{ provider: 'odds', endpoint: 'v4/sports/soccer_epl/odds',
    code: 'odds_invalid_events', severity: 'partial', count: n }];

  recordIssues('odds', 'v4/sports/soccer_epl/odds', mk(3));
  recordIssues('odds', 'v4/sports/soccer_epl/odds', mk(3));
  const odds = S.dataIssues.filter(i => i.provider === 'odds');
  assert.equal(odds.length, 1, 'refreshing a panel replaces rather than appends');
  assert.equal(odds[0].count, 3);

  recordIssues('understat', 'league/EPL', [{ provider: 'understat', endpoint: 'league/EPL',
    code: 'understat_invalid_teams', severity: 'partial', count: 1 }]);
  assert.equal(S.dataIssues.length, 2, 'a different provider is kept alongside');

  recordIssues('odds', 'v4/sports/soccer_epl/odds', []);
  assert.equal(S.dataIssues.filter(i => i.provider === 'odds').length, 0,
    'a clean re-fetch clears that provider’s issues');
});
