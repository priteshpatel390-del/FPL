import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(ROOT, path), 'utf8');

const CANONICAL_DOCUMENTS = Object.freeze([
  'CLAUDE.md',
  'docs/PROJECT_CONTEXT.md',
  'docs/ARCHITECTURE.md',
  'docs/DECISIONS.md',
  'docs/ROADMAP.md',
  'docs/KNOWN_LIMITATIONS.md',
  'docs/TEAMSHEET2-PRODUCT-BLUEPRINT.md',
  'docs/TESTING.md',
  'docs/PROJECTION_MODEL.md',
  'docs/DATA_SOURCES.md',
  'docs/SECURITY.md',
  'docs/HISTORICAL_RECORDS.md'
]);

function localMarkdownTargets(sourcePath) {
  const source = read(sourcePath);
  const sourceDirectory = dirname(resolve(ROOT, sourcePath));
  const targets = [];
  for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(raw)) continue;
    const path = raw.split('#', 1)[0];
    if (!path.endsWith('.md')) continue;
    targets.push(resolve(sourceDirectory, path));
  }
  return targets;
}

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated].sort();
}

test('maintainer entry points reference every canonical document and all local links resolve', () => {
  const entryText = `${read('README.md')}\n${read('CLAUDE.md')}`;
  for (const path of CANONICAL_DOCUMENTS) {
    assert.ok(existsSync(resolve(ROOT, path)), `missing canonical document: ${path}`);
    assert.ok(entryText.includes(`(${path})`), `maintainer entry points do not reference: ${path}`);
  }

  for (const source of ['README.md', 'CLAUDE.md', 'docs/HISTORICAL_RECORDS.md']) {
    for (const target of localMarkdownTargets(source)) {
      assert.ok(existsSync(target), `${source} links to missing file: ${relative(ROOT, target)}`);
    }
  }
});

test('historical index accounts for every Markdown record in docs', () => {
  const indexed = new Set(localMarkdownTargets('docs/HISTORICAL_RECORDS.md').map(path => relative(ROOT, path)));
  const records = readdirSync(resolve(ROOT, 'docs'))
    .filter(name => name.endsWith('.md') && name !== 'HISTORICAL_RECORDS.md')
    .map(name => `docs/${name}`)
    .sort();
  const missing = records.filter(path => !indexed.has(path));
  assert.deepEqual(missing, [], `documentation records missing from historical index: ${missing.join(', ')}`);
});

/* The live Stage 10 operating procedure is followed on a phone during a real deadline window,
   so a navigation path it names must actually exist. `More` was renamed to `Settings` and its
   evidence surfaces moved under `#/settings/evidence/*`; the doc kept sending the operator to
   a menu that is no longer reachable. This pins every owner path it names to a declared route
   title, so a future navigation change cannot silently strand the procedure again. */
test('the live Stage 10 operating procedure names owner paths that still exist', () => {
  const procedure = read('docs/STAGE10-OPERATIONS.md');
  const shell = read('src/ui/app-shell.mjs');

  assert.doesNotMatch(procedure, /\bMore\s*→/, 'the More menu no longer exists in the application');

  const titles = new Set([...shell.matchAll(/title:'([^']+)'/g)].map(match => match[1]));
  assert.ok(titles.has('Settings'), 'the route title parser found no Settings route');

  const paths = [...procedure.matchAll(/Settings(?:\s*→\s*[A-Za-z][A-Za-z &]*[A-Za-z])+/g)].map(match => match[0]);
  assert.ok(paths.length >= 2, 'the operating procedure should name the owner path for its evidence steps');
  for (const path of paths) {
    for (const segment of path.split('→').map(part => part.trim())) {
      assert.ok(titles.has(segment), `Stage 10 operations names a route that no longer exists: ${segment} (in "${path}")`);
    }
  }
});

/* Current-state reconciliation guards.
   ------------------------------------
   Documentation went stale twice in the same way: a merged `main` SHA and a test
   baseline were copied into several current-state headers, then only some of them were
   updated at the next merge. The durable fix was structural — canonical current-state
   sections no longer restate the merged `main` SHA at all, and name the current test
   baseline once. These tests hold that shape.

   They deliberately apply only to the CURRENT-STATE prose of the operational spine.
   Historical records, checkpoint records and the historical sections inside the spine
   legitimately state the SHAs, counts and merge states that were true at their own
   checkpoint; rewriting those would destroy permanent evidence. `currentStateSection()`
   therefore stops at the first heading whose text marks a historical block. */

const OPERATIONAL_SPINE = Object.freeze([
  'CLAUDE.md', 'README.md', 'docs/PROJECT_CONTEXT.md', 'docs/ROADMAP.md',
  'docs/ARCHITECTURE.md', 'docs/TESTING.md', 'docs/KNOWN_LIMITATIONS.md'
]);
const CURRENT_TEST_BASELINE = 934;
const HISTORICAL_HEADING = /^#{2,4}\s+.*\b(historical|superseded|previous checkpoint)\b/i;

// The prose before the first historical heading: everything that claims to be current.
function currentStateSection(path) {
  const lines = read(path).split(/\r?\n/);
  const end = lines.findIndex(line => HISTORICAL_HEADING.test(line));
  return (end === -1 ? lines : lines.slice(0, end)).join('\n');
}

test('no current-state section restates a merged main commit SHA as the current baseline', () => {
  // Any 7+ hex-character token introduced as the latest/current `main`.
  const claim = /(latest merged|current)\s+(github\s+)?`?main`?[^.\n]{0,40}?\b[0-9a-f]{7,40}\b/i;
  for (const path of OPERATIONAL_SPINE) {
    const section = currentStateSection(path);
    const match = claim.exec(section);
    assert.equal(match, null,
      `${path} pins a merged main SHA in its current-state section, which goes stale on the next merge: ${match?.[0]}`);
  }
});

test('current-state sections agree on one repository test baseline', () => {
  const superseded = [907, 904, 898, 883, 868, 866, 864, 859, 856, 842, 835, 832, 803];
  for (const path of OPERATIONAL_SPINE) {
    const section = currentStateSection(path);
    for (const count of superseded) {
      // A superseded count may still appear as evidence for a named earlier PR.
      for (const line of section.split(/\r?\n/)) {
        if (!new RegExp(`\\b${count}\\b`).test(line)) continue;
        // Naming a PR is not enough — "PR #118 … that tree passes 883 tests" still asserts
        // the count as current. Require an explicit marker that the count is not current.
        assert.match(line, /then-current|historical|superseded|not current|earlier count|Earlier counts/i,
          `${path} states a superseded ${count}-test baseline as current; the baseline is ${CURRENT_TEST_BASELINE}`);
      }
    }
  }
  const declared = OPERATIONAL_SPINE.filter(path =>
    new RegExp(`${CURRENT_TEST_BASELINE}\\s*(tests|/\\s*${CURRENT_TEST_BASELINE})`).test(currentStateSection(path)));
  assert.ok(declared.length >= 3,
    `the current ${CURRENT_TEST_BASELINE}-test baseline should be stated in the operational spine, found in ${declared.length} file(s)`);
});

test('current-state sections name the delivered GW1 readiness checkpoint, not a superseded one', () => {
  for (const path of OPERATIONAL_SPINE) {
    const section = currentStateSection(path);
    assert.match(section, /PR #121|GW1 readiness/i,
      `${path} does not mention the GW1 readiness checkpoint in its current-state section`);
    for (const line of section.split(/\r?\n/)) {
      if (!/PR #120|documentation reconciliation/i.test(line)) continue;
      assert.doesNotMatch(line, /\bcurrent checkpoint\b|\bthis checkpoint\b|— current\b/i,
        `${path} still presents the PR #120 documentation reconciliation as the current checkpoint`);
    }
  }
});

test('PR #119 is consistently described as unmerged, unaccepted and not a GW1 blocker', () => {
  for (const path of OPERATIONAL_SPINE) {
    const section = currentStateSection(path);
    if (!/PR #119/.test(section)) continue;
    assert.match(section, /unmerged|not merged|draft/i,
      `${path} mentions PR #119 without recording that it is draft and unmerged`);
    assert.match(section, /acceptance[- ]incomplete|not accepted|outstanding|pending/i,
      `${path} mentions PR #119 without recording that its acceptance is outstanding`);
    assert.doesNotMatch(section, /PR #119 (is|was) merged/i, `${path} claims PR #119 is merged`);
  }
});

test('D1 is not described as wholly deferred anywhere in current guidance', () => {
  for (const path of [...OPERATIONAL_SPINE, 'docs/DATA-ARCHITECTURE-D1.md', 'docs/HISTORICAL_RECORDS.md']) {
    for (const line of currentStateSection(path).split(/\r?\n/)) {
      if (!/\bD1\b/.test(line)) continue;
      assert.doesNotMatch(line, /implementation remains deferred|remains wholly deferred|D1 is deferred/i,
        `${path} still claims D1 implementation is deferred, contradicting the merged GW1-P1 foundation`);
    }
  }
});

test('planning states the GW5 to GW6 international break, never GW2 to GW3', () => {
  const roadmap = read('docs/ROADMAP.md');
  assert.match(roadmap, /GW5\s*(→|->|to|and)\s*GW6/i, 'the roadmap must name the GW5 → GW6 review opportunity');
  assert.match(roadmap, /GW1[–-]GW5|GW1\s*(→|-|to)\s*GW5/i, 'the roadmap must name the GW1–GW5 evidence period');
  for (const path of OPERATIONAL_SPINE) {
    for (const line of read(path).split(/\r?\n/)) {
      if (!/international break/i.test(line)) continue;
      if (!/GW2/.test(line)) continue;
      // GW2 may only appear while explicitly correcting the superseded assumption.
      assert.match(line, /not GW2|was incorrect|previous planning assumption/i,
        `${path} still presents a GW2 → GW3 international break as current planning`);
    }
  }
});

/* CHANGELOG currency guard.
   -------------------------
   The high-level change record silently fell more than twenty merged checkpoints behind the
   rest of the documentation: its reconciliation marker still read 9 August while the whole
   operational spine had been reconciled to 12 August. Nothing detected that, because every
   individual document was internally consistent.

   This compares declared metadata dates only — never prose, PR numbers or test counts — so it
   stays durable and cannot falsely reject a historical record. It fires exactly when the
   CHANGELOG stops being reconciled alongside the guidance it summarises. Both accepted
   formats are the ones already used in the tree: `12 August 2026` and `2026-08-12`. */

const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];

function declaredDate(text) {
  const iso = /\b(?:Last reconciled|Last updated|Current as of):\s*(\d{4})-(\d{2})-(\d{2})/i.exec(text);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const long = /\b(?:Last reconciled|Last updated|Current as of):\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i.exec(text);
  if (!long) return null;
  const month = MONTHS.indexOf(long[2].toLowerCase());
  return month === -1 ? null : Date.UTC(Number(long[3]), month, Number(long[1]));
}

const asDay = value => new Date(value).toISOString().slice(0, 10);

test('the CHANGELOG is reconciled no earlier than the guidance it summarises', () => {
  const changelog = read('docs/CHANGELOG.md');
  const reconciled = declaredDate(changelog);
  assert.notEqual(reconciled, null, 'docs/CHANGELOG.md declares no parseable reconciliation date');

  // Its own newest dated entry cannot be newer than its reconciliation marker.
  const entryDates = [...changelog.matchAll(/^##\s+(?:\[[^\]]+\]\s+—\s+)?(\d{4})-(\d{2})-(\d{2})\b/gm)]
    .map(match => Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  assert.ok(entryDates.length >= 10, 'the CHANGELOG entry-date parser found too few entries');
  const newestEntry = Math.max(...entryDates);
  assert.ok(reconciled >= newestEntry,
    `docs/CHANGELOG.md records an entry dated ${asDay(newestEntry)} but declares "Last reconciled: ${asDay(reconciled)}"`);

  // Nor may it lag behind the current-state spine it is meant to summarise.
  for (const path of OPERATIONAL_SPINE) {
    const declared = declaredDate(read(path));
    if (declared === null) continue;
    assert.ok(reconciled >= declared,
      `${path} was reconciled on ${asDay(declared)} but docs/CHANGELOG.md still declares ${asDay(reconciled)}; the change record is behind the guidance`);
  }
});

test('decision and limitation identifiers are unique', () => {
  const decisionIds = read('docs/DECISIONS.md').split(/\r?\n/).flatMap(line => {
    const match = /^(?:#{2,3}\s+|\*\*)(D-[A-Za-z0-9.-]+)\b/.exec(line);
    return match ? [match[1]] : [];
  });
  assert.ok(decisionIds.length >= 35, 'decision declaration parser found too few records');
  assert.deepEqual(duplicates(decisionIds), [], 'duplicate decision identifiers remain');

  const limitationIds = read('docs/KNOWN_LIMITATIONS.md').split(/\r?\n/).flatMap(line => {
    const match = /^\|\s*([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)\s*\|/.exec(line);
    return match ? [match[1]] : [];
  });
  assert.ok(limitationIds.length >= 50, 'limitation declaration parser found too few records');
  assert.deepEqual(duplicates(limitationIds), [], 'duplicate limitation identifiers remain');
});
