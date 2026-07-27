// tests/schema.test.mjs — Stage 3 item 2 (D-14): per-endpoint schema validation.
// Mostly pure validator tests; the hydrate() integration cases use the same
// minimal DOM stub as resilience.test.mjs because hydrate touches a <select>.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBootstrap, bootstrapStructure, validateEntry, validatePicks,
  validateHistory, validateStandings, validateUnderstat, validateOdds,
  validateArchiveHeader, collapseIssues, issueSummary, hasFatal
} from '../src/providers/validate.mjs';

const fatalOf = r => r.issues.filter(i => i.severity === 'fatal').map(i => i.code);
const partialOf = r => r.issues.filter(i => i.severity === 'partial').map(i => i.code);
const only = (r, code) => r.issues.find(i => i.code === code);

/* Realistic minimal shapes, using only the fields consumers actually read. */
const team = id => ({ id, name: 'Team ' + id, short_name: 'T' + id,
  strength_attack_home: 1200, strength_attack_away: 1150,
  strength_defence_home: 1180, strength_defence_away: 1140 });
const element = id => ({ id, web_name: 'P' + id, team: 1, element_type: 3,
  now_cost: 50, minutes: 900, status: 'a' });
const evt = id => ({ id, deadline_time: '2026-08-21T17:30:00Z', is_current: id === 1,
  is_next: id === 2, finished: id < 1, name: 'GW' + id });
const etype = id => ({ id, singular_name_short: 'MID', singular_name: 'Midfielder' });
const bootstrap = (o = {}) => ({ events: [evt(1), evt(2)], teams: [team(1), team(2)],
  elements: [element(101), element(102)], element_types: [etype(3)], ...o });

/* ===================== FPL /bootstrap-static/ ===================== */

test('schema/bootstrap: a valid payload passes clean and preserves unknown fields', () => {
  const payload = bootstrap({ total_players: 11000000, game_settings: { foo: 1 } });
  const r = validateBootstrap(payload);
  assert.deepEqual(r.issues, []);
  assert.equal(r.value.elements.length, 2);
  assert.equal(r.value.total_players, 11000000, 'unknown top-level fields tolerated');
  assert.deepEqual(r.value.game_settings, { foo: 1 }, 'and passed through untouched');
});

test('schema/bootstrap: a non-object top-level payload is fatal', () => {
  for (const bad of [null, undefined, 'nope', 42, []]) {
    const r = validateBootstrap(bad);
    assert.equal(r.value, null, 'no value invented from ' + JSON.stringify(bad));
    assert.deepEqual(fatalOf(r), ['bootstrap_not_object']);
  }
});

test('schema/bootstrap: a missing required collection is fatal and names the fields', () => {
  const r = validateBootstrap(bootstrap({ teams: undefined, elements: 'not-an-array' }));
  assert.equal(r.value, null);
  const f = only(r, 'bootstrap_missing_collection');
  assert.equal(f.severity, 'fatal');
  assert.deepEqual(f.fields.sort(), ['elements', 'teams']);
  assert.equal(f.provider, 'fpl');
  assert.equal(f.endpoint, '/bootstrap-static/');
});

test('schema/bootstrap: invalid and duplicate rows are dropped, valid rows retained', () => {
  const good = element(101), dup = element(101), other = element(102);
  const r = validateBootstrap(bootstrap({
    elements: [good, null, 'junk', { web_name: 'no id' }, other, dup]
  }));
  assert.equal(r.value.elements.length, 2, 'two valid, distinct rows survive');
  assert.equal(r.value.elements[0], good, 'first valid row retained by reference');
  assert.equal(only(r, 'bootstrap_invalid_rows').count, 3);
  assert.equal(only(r, 'bootstrap_invalid_rows').field, 'elements');
  assert.equal(only(r, 'bootstrap_duplicate_rows').count, 1);
  assert.ok(!hasFatal(r.issues), 'row-level damage is partial, never fatal');
});

test('schema/bootstrap: the provider payload is never mutated', () => {
  const payload = bootstrap({ elements: [element(101), null, element(101)] });
  const before = JSON.stringify(payload);
  validateBootstrap(payload);
  assert.equal(JSON.stringify(payload), before);
  assert.equal(payload.elements.length, 3, 'caller’s array still intact');
});

test('schema/bootstrap: bootstrapStructure is fatal-only and does not filter rows', () => {
  const ok = bootstrapStructure(bootstrap({ elements: [element(1), null] }));
  assert.equal(ok.ok, true, 'bad rows are not its concern');
  assert.deepEqual(ok.issues, []);
  assert.equal(bootstrapStructure({ events: [] }).ok, false);
});

/* ===================== FPL /entry/{id}/ ===================== */

test('schema/entry: valid entry passes; a null (not found) is not a failure', () => {
  const e = { name: 'My Team', player_first_name: 'A', player_last_name: 'B',
    summary_overall_rank: 120000, last_deadline_bank: 12 };
  const r = validateEntry(e);
  assert.deepEqual(r.issues, []);
  assert.equal(r.value, e);
  assert.deepEqual(validateEntry(null), { value: null, issues: [] });
});

test('schema/entry: non-object is fatal; a missing name degrades to partial', () => {
  assert.deepEqual(fatalOf(validateEntry([1, 2])), ['entry_not_object']);
  const r = validateEntry({ summary_overall_rank: 5 });
  assert.deepEqual(partialOf(r), ['entry_missing_field']);
  assert.deepEqual(only(r, 'entry_missing_field').fields, ['name']);
  assert.equal(r.value.summary_overall_rank, 5, 'usable remainder retained');
  assert.equal(r.value.name, undefined, 'and no name is manufactured');
});

/* ===================== FPL picks (own and rival) ===================== */

const pick = (element, position, extra = {}) => ({ element, position, multiplier: 1, ...extra });

test('schema/picks: a valid payload passes and tolerates unknown fields', () => {
  const p = { active_chip: null, entry_history: { bank: 5 },
    picks: [pick(101, 1, { is_captain: true }), pick(102, 2)] };
  const r = validatePicks(p);
  assert.deepEqual(r.issues, []);
  assert.equal(r.value.picks.length, 2);
  assert.deepEqual(r.value.entry_history, { bank: 5 });
});

test('schema/picks: non-object and missing picks[] are both fatal', () => {
  assert.deepEqual(fatalOf(validatePicks('nope')), ['picks_not_object']);
  assert.deepEqual(fatalOf(validatePicks({ active_chip: null })), ['picks_missing_collection']);
  assert.equal(validatePicks({ picks: 'no' }).value, null);
  assert.deepEqual(validatePicks(null), { value: null, issues: [] }, 'optional null is fine');
});

test('schema/picks: mixed rows — invalid dropped, first of a duplicate element kept', () => {
  const first = pick(101, 1), dupe = pick(101, 9), ok2 = pick(102, 2);
  const payload = { picks: [first, null, { element: 103 }, dupe, ok2, 'junk'] };
  const before = JSON.stringify(payload);
  const r = validatePicks(payload);
  assert.deepEqual(r.value.picks.map(p => p.element), [101, 102]);
  assert.equal(r.value.picks[0], first, 'first valid row retained, not the later duplicate');
  assert.equal(only(r, 'picks_invalid_rows').count, 3);
  assert.equal(only(r, 'picks_duplicate_element').count, 1);
  assert.equal(JSON.stringify(payload), before, 'input untouched');
});

test('schema/picks: the rival endpoint label is carried through onto the issues', () => {
  const r = validatePicks({ picks: [null] }, '/entry/event/picks/ (rival)');
  assert.equal(only(r, 'picks_invalid_rows').endpoint, '/entry/event/picks/ (rival)');
});

/* ===================== FPL /entry/{id}/history/ ===================== */

test('schema/history: chips absent is legitimate, not an issue', () => {
  const r = validateHistory({ current: [], past: [] });
  assert.deepEqual(r.issues, []);
  assert.deepEqual(r.value.past, []);
});

test('schema/history: a wrong-typed chips field degrades to an empty list, reported', () => {
  const payload = { chips: { wildcard: true } };
  const r = validateHistory(payload);
  assert.deepEqual(partialOf(r), ['history_chips_not_array']);
  assert.deepEqual(r.value.chips, []);
  assert.deepEqual(payload.chips, { wildcard: true }, 'original untouched');
  assert.deepEqual(fatalOf(validateHistory(7)), ['history_not_object']);
});

test('schema/history: invalid chip rows are dropped, valid ones retained', () => {
  const good = { name: 'wildcard', event: 8 };
  const r = validateHistory({ chips: [good, null, { event: 9 }, 'bench'] });
  assert.deepEqual(r.value.chips, [good]);
  assert.equal(only(r, 'history_invalid_chip_rows').count, 3);
});

/* ===================== FPL /leagues-classic/{id}/standings/ ===================== */

test('schema/standings: valid payload passes; missing results[] is fatal', () => {
  const good = { league: { name: 'Work League' },
    standings: { results: [{ entry: 11, rank: 1 }, { entry: 12, rank: 2 }] } };
  assert.deepEqual(validateStandings(good).issues, []);
  assert.equal(validateStandings(good).value.standings.results.length, 2);
  assert.deepEqual(fatalOf(validateStandings({ league: {} })), ['standings_missing_results']);
  assert.deepEqual(fatalOf(validateStandings([])), ['standings_not_object']);
});

test('schema/standings: invalid and duplicate rows are partial, valid rows survive', () => {
  const first = { entry: 11, rank: 1 };
  const payload = { standings: { results: [first, null, { rank: 3 }, { entry: 11, rank: 9 }, { entry: 12 }] } };
  const before = JSON.stringify(payload);
  const r = validateStandings(payload);
  assert.deepEqual(r.value.standings.results.map(x => x.entry), [11, 12]);
  assert.equal(r.value.standings.results[0], first);
  assert.equal(only(r, 'standings_invalid_rows').count, 2);
  assert.equal(only(r, 'standings_duplicate_entry').count, 1);
  assert.equal(JSON.stringify(payload), before);
});

/* ===================== Understat ===================== */

const ustatTeam = (title, n = 6) => ({ title,
  history: Array.from({ length: n }, () => ({ xG: 1.4, xGA: 1.1 })) });

test('schema/understat: valid map passes; unusable teams are dropped as partial', () => {
  const good = { 1: ustatTeam('Arsenal'), 2: ustatTeam('Chelsea') };
  assert.deepEqual(validateUnderstat(good).issues, []);
  const r = validateUnderstat({ 1: ustatTeam('Arsenal'), 2: { title: 'No history' },
    3: null, 4: { history: [] } });
  assert.equal(Object.keys(r.value).length, 1);
  assert.equal(only(r, 'understat_invalid_teams').count, 3);
  assert.equal(only(r, 'understat_invalid_teams').provider, 'understat');
});

test('schema/understat: no usable teams is fatal so the FPL-ratings fallback engages', () => {
  const r = validateUnderstat({ 1: null, 2: 'broken' });
  assert.equal(r.value, null, 'null is the signal loadUnderstat already falls back on');
  assert.ok(hasFatal(r.issues));
  assert.deepEqual(validateUnderstat(null), { value: null, issues: [] });
  assert.deepEqual(fatalOf(validateUnderstat([1])), ['understat_not_object']);
});

/* ===================== The Odds API ===================== */

const oddsEvent = (o = {}) => ({ id: 'e1', home_team: 'Arsenal', away_team: 'Chelsea',
  commence_time: '2026-08-21T14:00:00Z', bookmakers: [], ...o });

test('schema/odds: valid array passes; bad events dropped without killing the feed', () => {
  const good = oddsEvent();
  const r = validateOdds([good, null, { home_team: 'X' }, oddsEvent({ bookmakers: {} }), oddsEvent({ id: 'e2' })]);
  assert.equal(r.value.length, 2, 'usable events retained');
  assert.equal(r.value[0], good);
  assert.equal(only(r, 'odds_invalid_events').count, 3);
  assert.ok(!hasFatal(r.issues), 'a partly broken odds feed still prices what it can');
});

test('schema/odds: a non-array payload is fatal and yields no events', () => {
  const r = validateOdds({ message: 'quota exceeded' });
  assert.equal(r.value, null);
  assert.deepEqual(fatalOf(r), ['odds_not_array']);
  assert.deepEqual(validateOdds(null), { value: null, issues: [] });
});

/* ===================== Historical archive CSV ===================== */

test('schema/archive: a valid header passes; missing columns are fatal and named', () => {
  const head = ['name', 'position', 'minutes', 'total_points', 'GW', 'xP'];
  assert.deepEqual(validateArchiveHeader(head).issues, []);
  const r = validateArchiveHeader(['name', 'GW']);
  assert.equal(r.value, null);
  assert.deepEqual(only(r, 'archive_missing_columns').fields, ['position', 'minutes', 'total_points']);
  assert.deepEqual(fatalOf(validateArchiveHeader(undefined)), ['archive_no_header']);
});

/* ===================== Cross-cutting ===================== */

test('schema/issues: pooled fan-out collapses to one issue per provider+endpoint+code', () => {
  const many = Array.from({ length: 20 }, () =>
    validatePicks({ picks: [null] }, '/entry/event/picks/ (rival)').issues[0]);
  const collapsed = collapseIssues(many);
  assert.equal(collapsed.length, 1, '20 bad rival squads → one issue');
  assert.equal(collapsed[0].count, 20, 'with the counts summed');
  assert.deepEqual(collapseIssues([]), []);
});

test('schema/issues: summaries stay payload-free across every endpoint', () => {
  const issues = [
    ...validateBootstrap(bootstrap({ elements: [element(1), null] })).issues,
    ...validatePicks({ picks: [{ element: 101, position: 1 }, 'junk'] }).issues,
    ...validateStandings({ standings: { results: [null] } }).issues,
    ...validateOdds([oddsEvent(), null]).issues,
    ...validateEntry({ summary_overall_rank: 5 }).issues
  ];
  const sum = issueSummary(issues);
  assert.deepEqual(Object.keys(sum).sort(), ['counts', 'ok', 'worst']);
  assert.equal(sum.worst, 'partial');

  // Structural, not substring-based: issue CODES legitimately contain domain
  // words (standings_duplicate_entry), so grepping for 'entry' proves nothing.
  // What matters is that only stable code names and numeric counts appear.
  for (const [code, n] of Object.entries(sum.counts)) {
    assert.match(code, /^[a-z][a-z0-9_]*$/, 'counts are keyed by stable code names only');
    assert.equal(typeof n, 'number');
    assert.ok(Number.isFinite(n));
  }
  // And that no provider-supplied VALUE reaches the summary.
  const blob = JSON.stringify(sum);
  for (const leak of ['Arsenal', 'Chelsea', 'web_name', 'My Team', 'apiKey', 'summary_overall_rank'])
    assert.ok(!blob.includes(leak), `summary must not contain ${leak}`);
});

test('schema/issues: every issue carries the machine-readable identity fields', () => {
  const issues = [
    ...validateBootstrap('bad').issues,
    ...validatePicks({}).issues,
    ...validateUnderstat({ 1: null }).issues,
    ...validateOdds('bad').issues,
    ...validateArchiveHeader(['name']).issues
  ];
  assert.ok(issues.length >= 5);
  for (const i of issues) {
    assert.equal(typeof i.provider, 'string');
    assert.equal(typeof i.endpoint, 'string');
    assert.equal(typeof i.code, 'string');
    assert.ok(i.severity === 'fatal' || i.severity === 'partial');
    assert.equal(typeof i.count, 'number');
  }
});
