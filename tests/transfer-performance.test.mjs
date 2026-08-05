import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TRANSFER_PERFORMANCE_CACHE_LIMIT,
  TRANSFER_PERFORMANCE_SCORE_BATCH,
  transferPerformanceRetainPlan,
  transferPerformanceBoundOptimiserSource,
  transferPerformanceWorkerSource,
  transferPerformanceWorkerPlayer
} from '../src/ui/transfer-performance.mjs';

const compare=(a,b)=>b.score-a.score||a.id-b.id;

test('bounded plan retention is exactly equivalent to full sort and slice',()=>{
  const stream=[
    {id:1,score:2},{id:2,score:9},{id:3,score:4},{id:4,score:9},
    {id:5,score:-1},{id:6,score:7},{id:7,score:5}
  ];
  const retained=[];
  stream.forEach(plan=>transferPerformanceRetainPlan(retained,plan,4,compare));
  assert.deepEqual(retained,stream.slice().sort(compare).slice(0,4));
  assert.equal(TRANSFER_PERFORMANCE_CACHE_LIMIT,4);
});

test('worker optimiser replacement changes one retention site and fails closed otherwise',()=>{
  const source='function optimiseTransfers(){if(plan) plans.push(plan);}';
  const bounded=transferPerformanceBoundOptimiserSource(source);
  assert.match(bounded,/transferPerformanceRetainPlan\(plans,plan,ctx\.maxResults,comparePlans\)/);
  assert.doesNotMatch(bounded,/if\(plan\) plans\.push\(plan\)/);
  assert.throws(()=>transferPerformanceBoundOptimiserSource('function x(){}'),/found 0/);
  assert.throws(()=>transferPerformanceBoundOptimiserSource(source+source),/found 2/);
});

test('worker source executes the optimiser only inside the background worker contract',()=>{
  const model='function optimiseTransfers(args){if(plan) plans.push(plan);return {status:"ok",plans:[]};}';
  const source=transferPerformanceWorkerSource(model,{maxResults:20});
  assert.match(source,/self\.onmessage/);
  assert.match(source,/self\.postMessage/);
  assert.match(source,/const result=optimiseTransfers/);
  assert.match(source,/transferPerformanceRetainPlan/);
  assert.doesNotMatch(source,/\beval\s*\(|new Function/);
});

test('worker payload retains only optimiser-required player fields',()=>{
  assert.deepEqual(transferPerformanceWorkerPlayer({
    id:'7',web_name:'Seven',team:'3',element_type:'2',now_cost:'55',
    status:'d',chance_of_playing_next_round:50,news:'not transferred'
  }),{
    id:7,web_name:'Seven',team:3,element_type:2,now_cost:55,
    status:'d',chance_of_playing_next_round:50
  });
});

test('projection preparation is deliberately batched before worker execution',()=>{
  assert.equal(TRANSFER_PERFORMANCE_SCORE_BATCH,12);
  const source=readFileSync(new URL('../src/ui/transfer-performance.mjs',import.meta.url),'utf8');
  assert.match(source,/await transferPerformanceYield\(\)/);
  assert.match(source,/Preparing projections/);
  assert.match(source,/new Worker\(url\)/);
  assert.doesNotMatch(source,/transferPerformanceOriginalRenderTransfers/);
});

test('Transfers opens as a lightweight explicit action and supports cancellation',()=>{
  const source=readFileSync(new URL('../src/ui/transfer-performance.mjs',import.meta.url),'utf8');
  assert.match(source,/Calculate transfers/);
  assert.match(source,/Cancel calculation/);
  assert.match(source,/teamsheet:before-route-change/);
  assert.match(source,/transferPerformanceWorker\?\.terminate/);
  assert.match(source,/renderTransfers=transferPerformanceRenderShell/);
});

test('build embeds the exact transfer model for the Blob worker and grants only worker execution',()=>{
  const build=readFileSync(new URL('../build.mjs',import.meta.url),'utf8');
  const viewIndex=build.indexOf("'src/ui/transfer-optimiser-view.mjs'");
  const performanceIndex=build.indexOf("'src/ui/transfer-performance.mjs'");
  const manualIndex=build.indexOf("'src/ui/manual-squad-runtime.mjs'");
  assert.ok(viewIndex>=0&&performanceIndex>viewIndex&&manualIndex>performanceIndex);
  assert.match(build,/TRANSFER_WORKER_MODEL_SOURCE/);
  assert.match(build,/worker-src 'self' blob:/);
  assert.doesNotMatch(build,/worker-src[^;\n]*https:/);
});

test('production bundle contains the responsive worker flow and no synchronous route fallback',()=>{
  const bundle=readFileSync(new URL('../dist/app.bundle.js',import.meta.url),'utf8');
  assert.match(bundle,/Calculate transfers/);
  assert.match(bundle,/Evaluating legal transfer plans in the background/);
  assert.match(bundle,/TRANSFER_WORKER_MODEL_SOURCE/);
  assert.match(bundle,/transferPerformanceRenderShell/);
});
