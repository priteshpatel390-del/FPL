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
