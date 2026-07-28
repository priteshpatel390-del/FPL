import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('build output contains no raw ES-module import or export declarations', () => {
  const bundle = readFileSync('dist/app.bundle.js', 'utf8');
  assert.doesNotMatch(bundle, /^\s*(?:import|export)\b/m);
  assert.match(bundle, /function projectXP\b/);
});
