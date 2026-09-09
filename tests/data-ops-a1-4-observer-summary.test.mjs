import test from 'node:test';
import assert from 'node:assert/strict';
import {ObserverSummaryContractError,SUMMARY_OUTCOME_CONTRADICTORY,SUMMARY_OUTCOME_FAILED,
  SUMMARY_OUTCOME_INVALID,SUMMARY_OUTCOME_NOT_EVALUATED_OK,SUMMARY_OUTCOME_SUCCESS,
  evaluateObserverSummary} from '../workers/data-steward-watchdog/lib/observer-summary-contract.mjs';

const summary=(overrides={})=>({dayDate:'2026-09-09',verdict:'HEALTHY',
  evaluationReason:'HEALTHY_EXPECTED_STATE',heartbeat:'COMPLETE',escalationRequired:false,
  sentinelCount:3,...overrides});

test('a healthy, complete, non-escalated summary on a successful job is SUCCESS',()=>{
  assert.equal(evaluateObserverSummary({summary:summary(),jobConclusion:'success'}),
    SUMMARY_OUTCOME_SUCCESS);
});

test('NOT_EVALUATED with no escalation on a successful job is acceptable, never a failure',()=>{
  const outcome=evaluateObserverSummary({summary:summary({verdict:'NOT_EVALUATED',
    evaluationReason:'EVALUATION_NOT_DUE'}),jobConclusion:'success'});
  assert.equal(outcome,SUMMARY_OUTCOME_NOT_EVALUATED_OK);
});

test('escalationRequired true on a successful job is contradictory — that combination cannot happen if A1.3 behaves as documented',()=>{
  const outcome=evaluateObserverSummary({summary:summary({escalationRequired:true,verdict:'UNHEALTHY'}),
    jobConclusion:'success'});
  assert.equal(outcome,SUMMARY_OUTCOME_CONTRADICTORY);
});

test('an incomplete heartbeat on a successful job is contradictory',()=>{
  const outcome=evaluateObserverSummary({summary:summary({heartbeat:'INCOMPLETE'}),jobConclusion:'success'});
  assert.equal(outcome,SUMMARY_OUTCOME_CONTRADICTORY);
});

test('verdict UNHEALTHY on a successful job is contradictory even if escalationRequired says false',()=>{
  const outcome=evaluateObserverSummary({summary:summary({verdict:'UNHEALTHY',escalationRequired:false}),
    jobConclusion:'success'});
  assert.equal(outcome,SUMMARY_OUTCOME_CONTRADICTORY);
});

test('a failed job whose summary confirms escalation and UNHEALTHY is a consistent FAILED',()=>{
  const outcome=evaluateObserverSummary({
    summary:summary({verdict:'UNHEALTHY',escalationRequired:true,heartbeat:'INCOMPLETE'}),
    jobConclusion:'failure'});
  assert.equal(outcome,SUMMARY_OUTCOME_FAILED);
});

test('a failed job whose summary claims healthy is contradictory, never trusted as evidence of health',()=>{
  const outcome=evaluateObserverSummary({summary:summary(),jobConclusion:'failure'});
  assert.equal(outcome,SUMMARY_OUTCOME_CONTRADICTORY);
});

test('no decodable summary on a successful job is SUMMARY_INVALID',()=>{
  assert.equal(evaluateObserverSummary({summary:null,jobConclusion:'success'}),SUMMARY_OUTCOME_INVALID);
});

test('no decodable summary on a failed job is a plain FAILED, not a contradiction — most failure points precede the summary being printed at all',()=>{
  assert.equal(evaluateObserverSummary({summary:null,jobConclusion:'failure'}),SUMMARY_OUTCOME_FAILED);
});

test('rejects a conclusion outside success/failure',()=>{
  assert.throws(()=>evaluateObserverSummary({summary:summary(),jobConclusion:'skipped'}),
    ObserverSummaryContractError);
});

test('rejects a malformed summary shape',()=>{
  assert.throws(()=>evaluateObserverSummary({summary:'not-an-object',jobConclusion:'success'}),
    ObserverSummaryContractError);
  assert.throws(()=>evaluateObserverSummary({summary:[],jobConclusion:'success'}),
    ObserverSummaryContractError);
});
