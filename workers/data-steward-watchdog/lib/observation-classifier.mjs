// DATA-OPS-A1.4 — turns one decoded GitHub Actions job outcome for the observer's own workflow,
// plus (when read) its semantic summary evaluation, into the closed `healthState`/`reasonCode`
// pair the watchdog persists and the heartbeat classifier consumes. Pure and dependency-free.
import {deepFreeze} from './canonical.mjs';
import {SUMMARY_OUTCOME_CONTRADICTORY,SUMMARY_OUTCOME_FAILED,SUMMARY_OUTCOME_INVALID,
  SUMMARY_OUTCOME_NOT_EVALUATED_OK,SUMMARY_OUTCOME_SUCCESS,SUMMARY_OUTCOME_UNHEALTHY,
  evaluateObserverSummary} from './observer-summary-contract.mjs';

export const HEALTH_SUCCESS='SUCCESS';
export const HEALTH_NOT_EVALUATED_OK='NOT_EVALUATED_OK';
export const HEALTH_FAILED='FAILED';
export const HEALTH_SKIPPED='SKIPPED';
export const HEALTH_IN_FLIGHT='IN_FLIGHT';
export const HEALTH_SUMMARY_INVALID='SUMMARY_INVALID';
export const HEALTH_SUMMARY_UNHEALTHY='SUMMARY_UNHEALTHY';
export const HEALTH_SUMMARY_CONTRADICTORY='SUMMARY_CONTRADICTORY';
export const HEALTH_UNCLASSIFIED='UNCLASSIFIED';

export const OBSERVATION_HEALTH_STATES=deepFreeze([HEALTH_SUCCESS,HEALTH_NOT_EVALUATED_OK,
  HEALTH_FAILED,HEALTH_SKIPPED,HEALTH_IN_FLIGHT,HEALTH_SUMMARY_INVALID,HEALTH_SUMMARY_UNHEALTHY,
  HEALTH_SUMMARY_CONTRADICTORY,HEALTH_UNCLASSIFIED]);

const OUTCOME_TO_CLASSIFICATION=deepFreeze({
  [SUMMARY_OUTCOME_SUCCESS]:Object.freeze({healthState:HEALTH_SUCCESS,reasonCode:'OBSERVER_HEARTBEAT_HEALTHY'}),
  [SUMMARY_OUTCOME_NOT_EVALUATED_OK]:Object.freeze({healthState:HEALTH_NOT_EVALUATED_OK,
    reasonCode:'OBSERVER_SUMMARY_NOT_EVALUATED'}),
  [SUMMARY_OUTCOME_FAILED]:Object.freeze({healthState:HEALTH_FAILED,reasonCode:'OBSERVER_JOB_FAILED'}),
  [SUMMARY_OUTCOME_INVALID]:Object.freeze({healthState:HEALTH_SUMMARY_INVALID,
    reasonCode:'OBSERVER_SUMMARY_INVALID'}),
  [SUMMARY_OUTCOME_UNHEALTHY]:Object.freeze({healthState:HEALTH_SUMMARY_UNHEALTHY,
    reasonCode:'OBSERVER_SUMMARY_UNHEALTHY'}),
  [SUMMARY_OUTCOME_CONTRADICTORY]:Object.freeze({healthState:HEALTH_SUMMARY_CONTRADICTORY,
    reasonCode:'OBSERVER_SUMMARY_CONTRADICTORY'})
});

// `jobHealth` comes from `classifyJobHealth()`. `summaryAttempted` is true only when a job-log
// read was actually issued for this run (bounded to the single freshest SUCCESS-or-FAILED run per
// cycle); `summary` is the structurally-decoded object, or `null` if the read failed or decoded to
// nothing. The raw GitHub job conclusion is deliberately not accepted here — see the normalization
// note below for why `jobHealth` is the only classification this function trusts.
export function classifyObserverRun({jobHealth,summaryAttempted,summary}){
  if(jobHealth==='IN_FLIGHT')
    return deepFreeze({healthState:HEALTH_IN_FLIGHT,reasonCode:'OBSERVER_HEARTBEAT_INCOMPLETE'});
  if(jobHealth==='SKIPPED')
    return deepFreeze({healthState:HEALTH_SKIPPED,reasonCode:'OBSERVER_JOB_SKIPPED'});
  if(jobHealth==='SUCCESS'||jobHealth==='FAILED'){
    if(!summaryAttempted){
      return jobHealth==='SUCCESS'
        ?deepFreeze({healthState:HEALTH_SUCCESS,reasonCode:'OBSERVER_HEARTBEAT_HEALTHY'})
        :deepFreeze({healthState:HEALTH_FAILED,reasonCode:'OBSERVER_JOB_FAILED'});
    }
    // `evaluateObserverSummary()` only accepts exactly `'success'`/`'failure'`, but GitHub's raw
    // job conclusion can also be `'cancelled'` or `'timed_out'` (both already folded into
    // `jobHealth==='FAILED'` by `classifyJobHealth()`). Normalize from the already-classified
    // `jobHealth` rather than passing the raw conclusion string through, so a cancelled or
    // timed-out job is checked for contradiction exactly like any other failure.
    const normalizedConclusion=jobHealth==='SUCCESS'?'success':'failure';
    const outcome=evaluateObserverSummary({summary,jobConclusion:normalizedConclusion});
    return deepFreeze(OUTCOME_TO_CLASSIFICATION[outcome]);
  }
  // The observer's own job could not even be identified in the run's job listing (an unexpected
  // shape). Never trusted as evidence of anything, healthy included.
  return deepFreeze({healthState:HEALTH_UNCLASSIFIED,reasonCode:'OBSERVER_SUMMARY_INVALID'});
}
