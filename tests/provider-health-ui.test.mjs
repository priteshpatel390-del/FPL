import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HEALTH_STATES } from '../src/providers/registry.mjs';
import { ageLabel, providerHealthFlagClass } from '../src/main.mjs';
import { materialDataAgeLabel, fplDataWarningModel } from '../src/ui/data-warning.mjs';

test('provider health age labels remain compact and deterministic',()=>{
  assert.equal(ageLabel(null),'');
  assert.equal(ageLabel(0),'now');
  assert.equal(ageLabel(59*60000),'59m ago');
  assert.equal(ageLabel(47*60*60000),'47h ago');
  assert.equal(ageLabel(72*60*60000),'3d ago');
});

test('material core-data age labels remain plain English',()=>{
  assert.equal(materialDataAgeLabel(null),'time unavailable');
  assert.equal(materialDataAgeLabel(0),'verified just now');
  assert.equal(materialDataAgeLabel(59*60000),'verified 59m ago');
  assert.equal(materialDataAgeLabel(48*60*60000),'verified 2d ago');
});

test('healthy and optional provider states do not create primary warnings',()=>{
  assert.equal(fplDataWarningModel({state:HEALTH_STATES.LIVE,hasCoreData:true}).kind,'clear');
  assert.equal(fplDataWarningModel({state:HEALTH_STATES.PARTIAL,hasCoreData:true}).kind,'clear');
  assert.equal(fplDataWarningModel({state:HEALTH_STATES.DISABLED,hasCoreData:true}).settingsOnly,true);
});

test('saved core FPL data creates one consequence-led warning',()=>{
  for(const state of [HEALTH_STATES.CACHED,HEALTH_STATES.STALE,HEALTH_STATES.FALLBACK]){
    const model=fplDataWarningModel({state,hasCoreData:true,ageMs:75*60000});
    assert.equal(model.kind,'saved-data');
    assert.equal(model.level,'warning');
    assert.match(model.title,/previously verified FPL data/);
    assert.match(model.detail,/live Official FPL refresh did not complete/);
    assert.doesNotMatch(model.detail,/Fallback|Cached|Stale/);
  }
});

test('missing core FPL data blocks route-level decisions without inventing a fallback',()=>{
  const model=fplDataWarningModel({state:HEALTH_STATES.UNAVAILABLE,hasCoreData:false});
  assert.equal(model.kind,'unavailable');
  assert.equal(model.level,'blocking');
  assert.match(model.detail,/cannot verify recommendations or fixture context/);
});

test('provider health state classes reuse the established status palette',()=>{
  assert.equal(providerHealthFlagClass(HEALTH_STATES.LIVE),'rise');
  assert.equal(providerHealthFlagClass(HEALTH_STATES.PARTIAL),'doubt');
  assert.equal(providerHealthFlagClass(HEALTH_STATES.UNAVAILABLE),'out');
  assert.equal(providerHealthFlagClass(HEALTH_STATES.DISABLED),'dark');
});

test('Provider Health detail remains under Settings without a healthy header pill',()=>{
  const shell=readFileSync(new URL('../src/ui/app-shell.mjs',import.meta.url),'utf8');
  const main=readFileSync(new URL('../src/main.mjs',import.meta.url),'utf8');
  const warning=readFileSync(new URL('../src/ui/data-warning.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(shell,/providerHealthCompact/);
  assert.doesNotMatch(main,/providerHealthCompact/);
  assert.match(shell,/providerHealthDetail/);
  assert.match(shell,/providerHealthRows/);
  assert.match(shell,/#\/settings\/data\/providers/);
  assert.match(warning,/visible=model\.kind==='saved-data'/);
  assert.doesNotMatch(warning,/All live/);
});
