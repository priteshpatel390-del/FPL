import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveOpportunityAttributions} from '../workers/data-steward-watchdog/lib/opportunity-attribution.mjs';

const A='2026-09-09T04:17:00.000Z';
const B='2026-09-09T08:17:00.000Z';
const overlap=[A,B];
const simplify=result=>({assignments:result.assignments.map(({workflowRunId,opportunityAt})=>
  ({workflowRunId,opportunityAt})),ambiguousRuns:[...result.ambiguousRuns],
ambiguousOpportunities:[...result.ambiguousOpportunities]});

test('two overlapping runs remain ambiguous independent of input order',()=>{
  const runs=[{workflowRunId:901,candidates:overlap},{workflowRunId:910,candidates:overlap}];
  const forward=simplify(resolveOpportunityAttributions({runs}));
  const reverse=simplify(resolveOpportunityAttributions({runs:[...runs].reverse()}));
  assert.deepEqual(forward,{assignments:[],ambiguousRuns:[901,910],ambiguousOpportunities:[A,B]});
  assert.deepEqual(reverse,forward);
});

test('one single-candidate run forces the overlapping run onto remaining opportunity',()=>{
  const result=simplify(resolveOpportunityAttributions({runs:[
    {workflowRunId:901,candidates:overlap},{workflowRunId:1000,candidates:[B]}]}));
  assert.deepEqual(result.assignments,[{workflowRunId:901,opportunityAt:A},
    {workflowRunId:1000,opportunityAt:B}]);
  assert.deepEqual(result.ambiguousRuns,[]);
});

test('persisted attribution stays fixed and forces remaining eligible run',()=>{
  const result=simplify(resolveOpportunityAttributions({runs:[
    {workflowRunId:901,candidates:overlap},{workflowRunId:910,candidates:overlap}],
  persisted:[{workflowRunId:901,opportunityAt:A}]}));
  assert.deepEqual(result.assignments,[{workflowRunId:901,opportunityAt:A},
    {workflowRunId:910,opportunityAt:B}]);
});

test('one run never receives two opportunities',()=>{
  const result=simplify(resolveOpportunityAttributions({runs:[{workflowRunId:901,candidates:overlap}]}));
  assert.deepEqual(result.assignments,[]);
  assert.deepEqual(result.ambiguousOpportunities,[A,B]);
});
