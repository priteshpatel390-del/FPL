import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BUILD_SYSTEM_INPUTS,
  hashNamedInputs,
  buildInputFiles,
  hashBuildInputs
} from '../build-utils.mjs';

test('named build hashes are deterministic and bind path, content and order', () => {
  const inputs = [{path:'a',content:'one'}, {path:'b',content:'two'}];
  assert.equal(hashNamedInputs(inputs), hashNamedInputs(inputs));
  assert.notEqual(hashNamedInputs(inputs), hashNamedInputs([...inputs].reverse()));
  assert.notEqual(hashNamedInputs(inputs), hashNamedInputs([{path:'a',content:'changed'}, inputs[1]]));
  assert.notEqual(hashNamedInputs(inputs), hashNamedInputs([{path:'renamed',content:'one'}, inputs[1]]));
});

test('complete build identity covers ordered modules, template and bundler implementation', () => {
  const modules = ['src/a.mjs', 'src/b.mjs'];
  assert.deepEqual(buildInputFiles(modules), [...modules, ...BUILD_SYSTEM_INPUTS]);
  assert.deepEqual(BUILD_SYSTEM_INPUTS, ['app.html', 'build.mjs', 'build-utils.mjs']);
});

test('generated manifest carries the exact complete build-input identity', () => {
  const manifest = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
  assert.deepEqual(manifest.buildInputFiles, buildInputFiles(manifest.moduleOrder));
  assert.match(manifest.buildInputHash, /^[0-9a-f]{64}$/);
  assert.equal(manifest.buildInputHash, hashBuildInputs(manifest.moduleOrder));
});

test('CI verifies committed provenance before any test build overwrites generated files', () => {
  const workflow = readFileSync('.github/workflows/verify.yml', 'utf8');
  assert.match(workflow, /fetch-depth:\s*0/);
  const provenance = workflow.indexOf('node scripts/verify-build-provenance.mjs');
  const suite = workflow.indexOf('./run-tests.sh');
  assert.ok(provenance > -1 && suite > -1 && provenance < suite);
});

test('CI verifies every merge commit on main, not only pull-request heads', () => {
  const workflow = readFileSync('.github/workflows/verify.yml', 'utf8');
  const triggers = workflow.slice(workflow.indexOf('\non:'), workflow.indexOf('\npermissions:'));
  assert.match(triggers, /^\s*pull_request:/m);
  assert.match(triggers, /^\s*push:\s*\n\s*branches:\s*\n\s*-\s*main\s*$/m);
  assert.match(triggers, /^\s*workflow_dispatch:/m);
});

test('only pull-request verifications are cancellable, so no permanent record is destroyed', () => {
  const workflow = readFileSync('.github/workflows/verify.yml', 'utf8');
  // A push to main and a manual run share the refs/heads/main concurrency
  // group, so neither may cancel: either one cancelling would discard the
  // other's permanent verification of an exact revision.
  assert.match(workflow, /cancel-in-progress:\s*\$\{\{\s*github\.event_name\s*==\s*'pull_request'\s*\}\}/);
  assert.doesNotMatch(workflow, /cancel-in-progress:\s*true/);
});

test('the verified revision resolves to the merge commit on a push to main', () => {
  const workflow = readFileSync('.github/workflows/verify.yml', 'utf8');
  // github.sha is the merge commit for a push event, and the pull-request head
  // otherwise, so both trigger paths verify the exact revision they name.
  const fallbacks = workflow.match(/github\.event\.pull_request\.head\.sha \|\| github\.sha/g) || [];
  assert.equal(fallbacks.length, 2);
  assert.match(workflow, /BUILD_COMMIT: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
  assert.match(workflow, /test "\$\(git rev-parse HEAD\)" = "\$BUILD_COMMIT"/);
});
