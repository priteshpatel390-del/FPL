import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HEALTH_STATES } from '../src/providers/registry.mjs';
import { ageLabel, providerHealthCompactModel, providerHealthFlagClass } from '../src/main.mjs';

test('provider health age labels remain compact and deterministic',()=>{
  assert.equal(ageLabel(null),'');
  assert.equal(ageLabel(0),'now');
  assert.equal(ageLabel(59*60000),'59m ago');
  assert.equal(ageLabel(47*60*60000),'47h ago');
  assert.equal(ageLabel(72*60*60000),'3d ago');
});

test('compact provider health waits honestly before the first response',()=>{
  assert.deepEqual(providerHealthCompactModel([]),{
    label:'Waiting',state:'Waiting',ariaLabel:'Provider Health: waiting for first data load'
  });
});

test('compact provider health reports all-live without inventing a score',()=>{
  const model=providerHealthCompactModel([
    {provider:'fpl',state:HEALTH_STATES.LIVE},
    {provider:'understat',state:HEALTH_STATES.LIVE}
  ]);
  assert.equal(model.label,'All live');
  assert.equal(model.state,HEALTH_STATES.LIVE);
  assert.match(model.ariaLabel,/FPL Live, Understat Live/);
});

test('compact provider health surfaces the most consequential existing state',()=>{
  const model=providerHealthCompactModel([
    {provider:'fpl',state:HEALTH_STATES.CACHED},
    {provider:'understat',state:HEALTH_STATES.FALLBACK},
    {provider:'odds',state:HEALTH_STATES.DISABLED}
  ]);
  assert.equal(model.label,HEALTH_STATES.FALLBACK);
  assert.equal(model.state,HEALTH_STATES.FALLBACK);
});

test('provider health state classes reuse the established status palette',()=>{
  assert.equal(providerHealthFlagClass(HEALTH_STATES.LIVE),'rise');
  assert.equal(providerHealthFlagClass(HEALTH_STATES.PARTIAL),'doubt');
  assert.equal(providerHealthFlagClass(HEALTH_STATES.UNAVAILABLE),'out');
  assert.equal(providerHealthFlagClass(HEALTH_STATES.DISABLED),'dark');
});

test('Provider Health detail remains under Settings without a global header pill',()=>{
  const source=readFileSync(new URL('../src/ui/app-shell.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/providerHealthCompact/);
  assert.match(source,/providerHealthDetail/);
  assert.match(source,/providerHealthRows/);
  assert.match(source,/#\/settings\/data/);
  assert.match(source,/__teamsheetNavigate/);
  assert.doesNotMatch(source,/moreTab\.click\(\)/);
});
