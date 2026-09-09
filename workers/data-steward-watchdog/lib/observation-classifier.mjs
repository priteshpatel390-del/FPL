// DATA-OPS-A1.4 — turns one decoded GitHub Actions job outcome for the observer's own workflow
// into the closed (healthState, reasonCode) pair the watchdog persists. Pure and dependency-free.
import {deepFreeze} from '../../../src/decision-intelligence/canonical.mjs';

export const HEALTH_SUCCESS='SUCCESS';
export const HEALTH_FAILED='FAILED';
export const HEALTH_SKIPPED='SKIPPED';
export const HEALTH_IN_FLIGHT='IN_FLIGHT';
export const HEALTH_UNCLASSIFIED='UNCLASSIFIED';

// A job that GitHub reports as SUCCESS is only trusted as SUCCESS when either its sanitized
// summary log was not checked at all (bounded read budget means only the freshest run's summary
// is ever read) or it WAS checked and decoded cleanly. A job GitHub calls successful whose own
// emitted summary cannot be decoded fails closed to UNCLASSIFIED rather than being believed —
// the whole point of A1.3 printing that summary is for something downstream to be able to check
// it, and a watchdog that never actually looked would defeat that.
export function classifyObserverRun({jobHealth,summaryAttempted,summaryValid}){
  if(jobHealth===HEALTH_IN_FLIGHT)
    return deepFreeze({healthState:HEALTH_IN_FLIGHT,reasonCode:'OBSERVER_HEARTBEAT_INCOMPLETE'});
  if(jobHealth===HEALTH_FAILED)
    return deepFreeze({healthState:HEALTH_FAILED,reasonCode:'OBSERVER_JOB_FAILED'});
  if(jobHealth===HEALTH_SKIPPED)
    return deepFreeze({healthState:HEALTH_SKIPPED,reasonCode:'OBSERVER_JOB_SKIPPED'});
  if(jobHealth===HEALTH_SUCCESS){
    if(summaryAttempted&&!summaryValid)
      return deepFreeze({healthState:HEALTH_UNCLASSIFIED,reasonCode:'OBSERVER_SUMMARY_INVALID'});
    return deepFreeze({healthState:HEALTH_SUCCESS,reasonCode:'OBSERVER_HEARTBEAT_HEALTHY'});
  }
  return deepFreeze({healthState:HEALTH_UNCLASSIFIED,reasonCode:'OBSERVER_HEARTBEAT_INCOMPLETE'});
}
