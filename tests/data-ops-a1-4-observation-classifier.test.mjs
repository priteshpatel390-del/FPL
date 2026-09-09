import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyObserverRun,HEALTH_FAILED,HEALTH_IN_FLIGHT,HEALTH_NOT_EVALUATED_OK,
  HEALTH_SKIPPED,HEALTH_SUCCESS,HEALTH_SUMMARY_CONTRADICTORY,HEALTH_SUMMARY_INVALID,
  HEALTH_SUMMARY_UNHEALTHY,HEALTH_UNCLASSIFIED,OBSERVATION_HEALTH_STATES}
  from '../workers/data-steward-watchdog/lib/observation-classifier.mjs';

const summary=(overrides={})=>({dayDate:'2026-09-09',verdict:'HEALTHY',
  evaluationReason:'HEALTHY_EXPECTED_STATE',heartbeat:'COMPLETE',escalationRequired:false,...overrides});

test('a skipped job is SKIPPED without any summary check',()=>{
  const result=classifyObserverRun({jobHealth:'SKIPPED',summaryAttempted:false,summary:null});
  assert.equal(result.healthState,HEALTH_SKIPPED);
  assert.equal(result.reasonCode,'OBSERVER_JOB_SKIPPED');
});

test('an in-flight job is IN_FLIGHT without any summary check',()=>{
  const result=classifyObserverRun({jobHealth:'IN_FLIGHT',summaryAttempted:false,summary:null});
  assert.equal(result.healthState,HEALTH_IN_FLIGHT);
});

test('a successful job with no summary read attempted trusts GitHub alone (bounded read budget)',()=>{
  const result=classifyObserverRun({jobHealth:'SUCCESS',summaryAttempted:false,summary:null});
  assert.equal(result.healthState,HEALTH_SUCCESS);
});

test('a failed job with no summary read attempted trusts GitHub alone',()=>{
  const result=classifyObserverRun({jobHealth:'FAILED',summaryAttempted:false,summary:null});
  assert.equal(result.healthState,HEALTH_FAILED);
});

test('a successful job with a healthy summary is SUCCESS',()=>{
  const result=classifyObserverRun({jobHealth:'SUCCESS',summaryAttempted:true,summary:summary()});
  assert.equal(result.healthState,HEALTH_SUCCESS);
});

test('a successful job with a NOT_EVALUATED summary is NOT_EVALUATED_OK, not plain SUCCESS',()=>{
  const result=classifyObserverRun({jobHealth:'SUCCESS',summaryAttempted:true,
    summary:summary({verdict:'NOT_EVALUATED'})});
  assert.equal(result.healthState,HEALTH_NOT_EVALUATED_OK);
  assert.equal(result.reasonCode,'OBSERVER_SUMMARY_NOT_EVALUATED');
});

test('a successful job with an escalated summary is SUMMARY_CONTRADICTORY',()=>{
  const result=classifyObserverRun({jobHealth:'SUCCESS',summaryAttempted:true,
    summary:summary({escalationRequired:true,verdict:'UNHEALTHY'})});
  assert.equal(result.healthState,HEALTH_SUMMARY_CONTRADICTORY);
});

test('a successful job whose summary log could not be decoded is SUMMARY_INVALID',()=>{
  const result=classifyObserverRun({jobHealth:'SUCCESS',summaryAttempted:true,summary:null});
  assert.equal(result.healthState,HEALTH_SUMMARY_INVALID);
});

test('a cancelled or timed-out job is checked for contradiction exactly like an ordinary failure',()=>{
  // classifyJobHealth() folds cancelled/timed_out into 'FAILED' before this function ever sees it;
  // this proves the summary check still runs correctly off that normalized value.
  const consistent=classifyObserverRun({jobHealth:'FAILED',summaryAttempted:true,
    summary:summary({verdict:'UNHEALTHY',escalationRequired:true,heartbeat:'INCOMPLETE'})});
  assert.equal(consistent.healthState,HEALTH_FAILED);
  const contradictory=classifyObserverRun({jobHealth:'FAILED',summaryAttempted:true,summary:summary()});
  assert.equal(contradictory.healthState,HEALTH_SUMMARY_CONTRADICTORY);
});

test('an unidentifiable observer job is UNCLASSIFIED, never trusted as healthy',()=>{
  const result=classifyObserverRun({jobHealth:'UNCLASSIFIED',summaryAttempted:false,summary:null});
  assert.equal(result.healthState,HEALTH_UNCLASSIFIED);
});

test('every reachable health state is in the closed enum',()=>{
  const cases=[
    {jobHealth:'SKIPPED',summaryAttempted:false,summary:null},
    {jobHealth:'IN_FLIGHT',summaryAttempted:false,summary:null},
    {jobHealth:'SUCCESS',summaryAttempted:false,summary:null},
    {jobHealth:'FAILED',summaryAttempted:false,summary:null},
    {jobHealth:'SUCCESS',summaryAttempted:true,summary:summary()},
    {jobHealth:'SUCCESS',summaryAttempted:true,summary:summary({verdict:'NOT_EVALUATED'})},
    {jobHealth:'UNCLASSIFIED',summaryAttempted:false,summary:null}
  ];
  for(const input of cases)
    assert.ok(OBSERVATION_HEALTH_STATES.includes(classifyObserverRun(input).healthState));
});
