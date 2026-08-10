import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { K_CAL, sget, sgetResult, clearPersistenceWarning, persistenceWarningSnapshot } from '../src/storage.mjs';

class MemoryStorage{
  constructor(){ this.map=new Map(); }
  getItem(key){ return this.map.has(key)?this.map.get(key):null; }
  setItem(key,value){ this.map.set(key,String(value)); }
  removeItem(key){ this.map.delete(key); }
}

function reset(){
  globalThis.window={};
  globalThis.localStorage=new MemoryStorage();
  globalThis.document=undefined;
  clearPersistenceWarning('calibration-compatibility');
}

test.beforeEach(reset);

test('legacy calibration bytes are preserved but fail closed',async()=>{
  const legacy={calib:{1:1.1,2:0.9,3:1.05,4:1},backtest:{season:'2025-26',r:0.8,maeGW:1.2}};
  const bytes=JSON.stringify(legacy);
  globalThis.localStorage.setItem(K_CAL,bytes);

  const result=await sgetResult(K_CAL);
  assert.equal(result.ok,false);
  assert.equal(result.reason,'calibration_contract_unverified');
  assert.equal(await sget(K_CAL),null);
  assert.equal(globalThis.localStorage.getItem(K_CAL),bytes,'rejected legacy evidence is not deleted or rewritten');
  assert.match(persistenceWarningSnapshot()['calibration-compatibility'],/not being applied/);
  assert.match(persistenceWarningSnapshot()['calibration-compatibility'],/Standard uncalibrated projections are active/);
});

test('malformed calibration JSON is rejected without throwing or replacement',async()=>{
  const bytes='{broken';
  globalThis.localStorage.setItem(K_CAL,bytes);
  assert.equal(await sget(K_CAL),null);
  assert.equal(globalThis.localStorage.getItem(K_CAL),bytes);
  assert.match(persistenceWarningSnapshot()['calibration-compatibility'],/could not be verified/);
});

test('speculative versioned calibration cannot activate before a production methodology is approved',async()=>{
  const speculative={
    recordType:'teamsheet.calibration',version:1,targetSeason:'2026-27',modelVersion:'2.4.0',rulesVersion:'2026-27.3',
    methodology:{id:'unapproved',version:1},values:{1:1,2:1,3:1,4:1}
  };
  globalThis.localStorage.setItem(K_CAL,JSON.stringify(speculative));
  const result=await sgetResult(K_CAL);
  assert.equal(result.ok,false);
  assert.equal(result.reason,'calibration_contract_unverified');
  assert.equal(await sget(K_CAL),null);
});

test('startup can only assign calibration after the storage compatibility gate returns a record',()=>{
  const source=readFileSync(new URL('../src/ui/views.mjs',import.meta.url),'utf8');
  assert.match(source,/const cal = await sget\(K_CAL\);\s*if\(cal\)\{\s*S\.calib = cal\.calib; S\.backtest = cal\.backtest;/);
});

test('current walk-forward check remains diagnostic-only and has no calibration persistence writer',()=>{
  const source=readFileSync(new URL('../src/model/backtest.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/sset\(K_CAL/);
  const run=source.slice(source.indexOf('async function runBacktest()'),source.indexOf('export { parseCSV'));
  assert.doesNotMatch(run,/S\.calib\s*=/);
  assert.match(run,/S\.backtest=evaluation/);
});

test('production calibration formula itself is unchanged by this checkpoint',()=>{
  const source=readFileSync(new URL('../src/model/scoring.mjs',import.meta.url),'utf8');
  assert.match(source,/const cal = S\.calib\?\.\[pos\];/);
  assert.match(source,/parts\['Calibration'\] = total\*\(cal-1\); total \*= cal;/);
});
