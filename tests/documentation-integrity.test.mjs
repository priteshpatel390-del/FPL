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
