import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripModuleSyntax, assertNoModuleSyntax } from '../build-utils.mjs';

test('build output contains no raw ES-module import or export declarations', () => {
  const bundle = readFileSync('dist/app.bundle.js', 'utf8');
  assert.doesNotMatch(bundle, /^\s*(?:import|export)\b/m);
  assert.match(bundle, /function projectXP\b/);
});

test('bundler strips single-line imports and export lists', () => {
  const source = "import { alpha } from './a.mjs';\nconst value = alpha;\nexport { value };";
  assert.equal(stripModuleSyntax(source), 'const value = alpha;');
});

test('bundler strips multi-line named imports as one declaration', () => {
  const source = [
    'import {',
    '  alpha,',
    '  beta',
    "} from './a.mjs';",
    'const value = alpha + beta;'
  ].join('\n');
  assert.equal(stripModuleSyntax(source), 'const value = alpha + beta;');
});

test('bundler strips default plus multi-line named imports', () => {
  const source = [
    'import defaultThing, {',
    '  alpha,',
    '  beta',
    "} from './a.mjs';",
    'const value = defaultThing(alpha, beta);'
  ].join('\n');
  assert.equal(stripModuleSyntax(source), 'const value = defaultThing(alpha, beta);');
});

test('bundler strips multi-line export lists and re-export lists', () => {
  const source = [
    'const alpha = 1;',
    'export {',
    '  alpha',
    '};',
    'export {',
    '  beta',
    "} from './b.mjs';",
    'const omega = 2;'
  ].join('\n');
  assert.equal(stripModuleSyntax(source), 'const alpha = 1;\nconst omega = 2;');
});

test('bundler rejects unterminated module declarations', () => {
  assert.throws(() => stripModuleSyntax("import {\n  alpha"), /unterminated import declaration/);
  assert.throws(() => stripModuleSyntax("export {\n  alpha"), /unterminated export list/);
});

test('bundler rejects unsupported surviving module syntax', () => {
  assert.throws(() => assertNoModuleSyntax('export default function nope() {}'), /unsupported module syntax/);
  assert.throws(() => assertNoModuleSyntax("export * from './x.mjs';"), /unsupported module syntax/);
});
