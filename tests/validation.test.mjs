// tests/validation.test.mjs — Stage 3 / D-13 input-integrity layer.
// Pure module tests: validate.mjs imports nothing, so no DOM stub is needed.
// The hydrate()/teamFixtures() integration is covered in resilience.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseFixtures, fixtureIdentity, issueSummary } from '../src/providers/validate.mjs';

const F = (o = {}) => ({ event: 11, team_h: 5, team_a: 12,
  team_h_difficulty: 2, team_a_difficulty: 4, kickoff_time: '2026-08-21T14:00:00Z',
  started: false, finished: false, ...o });

const codes = issues => issues.map(i => i.code);
const find  = (issues, code) => issues.find(i => i.code === code);

test('validation: exact duplicates collapse to the first occurrence', () => {
  const a = F({ id: 100 });
  const { fixtures, issues } = normaliseFixtures([a, { ...a }, { ...a }]);
  assert.equal(fixtures.length, 1, 'three identical rows → one');
  assert.equal(fixtures[0], a, 'the FIRST row is the one kept');
  assert.equal(find(issues, 'fixture_exact_duplicate').count, 2);
  assert.equal(find(issues, 'fixture_exact_duplicate').severity, 'partial');
});

test('validation: genuine doubles survive — distinct ids, same teams and gameweek', () => {
  const first  = F({ id: 100, team_h: 5, team_a: 12 });
  const second = F({ id: 101, team_h: 12, team_a: 5 });   // reverse tie, same GW
  const { fixtures, issues } = normaliseFixtures([first, second]);
  assert.equal(fixtures.length, 2, 'a real double gameweek is NOT collapsed');
  assert.deepEqual(codes(issues), [], 'and raises no issue');
});

test('validation: genuine doubles survive when rows carry no id (composite distinct)', () => {
  const { fixtures, issues } = normaliseFixtures([
    F({ team_h: 5, team_a: 12 }),
    F({ team_h: 16, team_a: 5 })       // team 5 plays twice in the same event
  ]);
  assert.equal(fixtures.length, 2);
  assert.deepEqual(codes(issues), []);
});

test('validation: conflicting duplicate keeps the first and names the offending fields', () => {
  const first = F({ id: 100, team_h_difficulty: 2 });
  const clash = F({ id: 100, team_h_difficulty: 5, kickoff_time: '2026-08-22T16:30:00Z' });
  const { fixtures, issues } = normaliseFixtures([first, clash]);
  assert.equal(fixtures.length, 1);
  assert.equal(fixtures[0].team_h_difficulty, 2, 'first occurrence wins');
  const c = find(issues, 'fixture_conflicting_duplicate');
  assert.equal(c.count, 1);
  assert.deepEqual(c.conflicts[0].fields.sort(), ['kickoff_time', 'team_h_difficulty']);
  assert.equal(c.conflicts[0].identity, 'id:100');
});

test('validation: a conflict is partial, never fatal — the app still loads', () => {
  const { issues } = normaliseFixtures([F({ id: 1 }), F({ id: 1, event: 12 })]);
  assert.equal(find(issues, 'fixture_conflicting_duplicate').severity, 'partial');
  assert.equal(issueSummary(issues).worst, 'partial');
});

test('validation: rows with no safe identity are excluded and reported', () => {
  const { fixtures, issues } = normaliseFixtures([
    F({ id: 100 }),
    { team_h: 5, team_a: 12 },            // no id, no event
    { event: 11, team_a: 12 },            // no id, no team_h
    null, 'nonsense', 42
  ]);
  assert.equal(fixtures.length, 1, 'only the identifiable row survives');
  assert.equal(find(issues, 'fixture_missing_identity').count, 5);
});

test('validation: identity is never invented for an id-less row with a null event', () => {
  assert.equal(fixtureIdentity({ event: null, team_h: 5, team_a: 12 }), null);
  const { fixtures, issues } = normaliseFixtures([{ event: null, team_h: 5, team_a: 12 }]);
  assert.equal(fixtures.length, 0);
  assert.deepEqual(codes(issues), ['fixture_missing_identity']);
});

test('validation: an unscheduled fixture WITH an id is kept untouched, no false alarm', () => {
  // The live FPL feed carries postponed/TBD rows as event:null. These must not
  // be discarded, and must not fire a validation warning on every single load.
  const tbd = F({ id: 442, event: null, kickoff_time: null });
  const { fixtures, issues } = normaliseFixtures([F({ id: 100 }), tbd]);
  assert.equal(fixtures.length, 2);
  assert.equal(fixtures[1], tbd, 'row passed through by reference, unmodified');
  assert.deepEqual(codes(issues), [], 'no issue raised for a legitimately unscheduled row');
});

test('validation: started/finished differences are immaterial, not a conflict', () => {
  const { fixtures, issues } = normaliseFixtures([
    F({ id: 100, started: false, finished: false }),
    F({ id: 100, started: true,  finished: true  })
  ]);
  assert.equal(fixtures.length, 1);
  assert.deepEqual(codes(issues), ['fixture_exact_duplicate'],
    'treated as a benign in-flight artefact');
  assert.equal(find(issues, 'fixture_conflicting_duplicate'), undefined);
});

test('validation: a non-array payload is fatal and yields an empty fixture list', () => {
  for (const bad of [null, undefined, {}, 'fixtures', 7]) {
    const { fixtures, issues } = normaliseFixtures(bad);
    assert.deepEqual(fixtures, [], 'no fixtures invented from a broken payload');
    assert.equal(issues[0].code, 'fixtures_not_array');
    assert.equal(issues[0].severity, 'fatal');
    assert.equal(issueSummary(issues).worst, 'fatal');
  }
});

test('validation: the input array and its rows are never mutated', () => {
  const a = F({ id: 100 }), b = F({ id: 100, team_h_difficulty: 5 }), c = { junk: true };
  const input = [a, b, c];
  const before = JSON.stringify(input);
  normaliseFixtures(input);
  assert.equal(JSON.stringify(input), before, 'input untouched');
  assert.equal(input.length, 3, 'no rows removed from the caller’s array');
});

test('validation: issueSummary is payload-free and safe to render', () => {
  const { issues } = normaliseFixtures([
    F({ id: 100 }), F({ id: 100 }),                    // exact dupe
    F({ id: 200 }), F({ id: 200, event: 12 }),         // conflict
    { nothing: true }                                   // unidentifiable
  ]);
  const sum = issueSummary(issues);
  assert.deepEqual(Object.keys(sum).sort(), ['counts', 'ok', 'worst']);
  assert.equal(sum.ok, false);
  assert.equal(sum.worst, 'partial');
  assert.deepEqual(sum.counts, { fixture_exact_duplicate: 1,
    fixture_conflicting_duplicate: 1, fixture_missing_identity: 1 });
  const blob = JSON.stringify(sum);
  assert.ok(!blob.includes('id:200'), 'no identities leak into the summary');
  assert.ok(!blob.includes('event'), 'no field names or team ids leak either');
  assert.deepEqual(issueSummary([]), { ok: true, worst: 'none', counts: {} });
});
