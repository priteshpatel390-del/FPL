import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('operating review remains subordinate, phone-first and manual-Sheets only',()=>{
  const source=readFileSync(new URL('../src/ui/review.mjs',import.meta.url),'utf8');
  for(const text of ['Operating review','Download selected CSV','Google Sheets import remains manual','Hindsight oracle','No composite score']) assert.ok(source.includes(text),text);
  assert.equal(source.includes('data-view="review"'),false);assert.equal(source.includes('OAuth'),false);
});

test('review engine is downstream-only and does not call production model functions',()=>{
  const source=readFileSync(new URL('../src/evidence/review.mjs',import.meta.url),'utf8');
  for(const forbidden of ['projectXP','minutesEstimate','simulatePlayerGameweek','optimiseTransfers']) assert.equal(source.includes(forbidden),false,forbidden);
});

test('build order places review after metrics and UI review after metric storage',()=>{
  const source=readFileSync(new URL('../build.mjs',import.meta.url),'utf8'),metric=source.indexOf("'src/evidence/metrics.mjs'"),review=source.indexOf("'src/evidence/review.mjs'"),metricUi=source.indexOf("'src/ui/metrics.mjs'"),reviewUi=source.indexOf("'src/ui/review.mjs'");
  assert.ok(metric>=0&&review>metric);assert.ok(metricUi>=0&&reviewUi>metricUi);
});

test('review source preserves the class-only CSP boundary',()=>{
  const source=readFileSync(new URL('../src/ui/review.mjs',import.meta.url),'utf8')+readFileSync(new URL('../src/evidence/review.mjs',import.meta.url),'utf8');
  for(const forbidden of ['.style','setAttribute(\'style\'','setAttribute("style"','cssText','style:']) assert.equal(source.includes(forbidden),false,forbidden);
});
