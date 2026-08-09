import test from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, syntheticWorld } from './harness.mjs';

test('a production render preserves the focused fixture field, raw value and active element', () => {
  const {T,doc}=loadApp({fxFrom:'7',fxSpan:'5'},{interactive:true});
  syntheticWorld(T);
  const from=doc.fxFrom;
  from.value='007';
  from.focus();
  T.renderAll();
  assert.equal(globalThis.document.activeElement,from);
  assert.equal(from.value,'007');

  const span=doc.fxSpan;
  span.value='05';
  span.focus();
  T.renderAll();
  assert.equal(globalThis.document.activeElement,span);
  assert.equal(span.value,'05');
});
