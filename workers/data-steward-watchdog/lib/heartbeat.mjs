// DATA-OPS-A1.4 — the schedule-aware heartbeat classifier.
//
// This is deliberately NOT an age-only rule. It answers one question: for the single most recent
// declared A1.3 opportunity that is due (see `opportunity-schedule.mjs`), what happened? The
// caller supplies `opportunityEvidence` — the outcome of the freshest scheduled-run observation
// whose `run_created_at` is at or after that opportunity instant, or `null` if none exists yet —
// and this module is a pure function from that plus explicit timestamps to a closed state.
//
// Two rules matter here, both load-bearing:
//
//   1. SUCCESS AT THE LATEST OPPORTUNITY IS ALWAYS HEALTHY, REGARDLESS OF HOW LONG AGO IT
//      HAPPENED. There is no "healthy for 12 hours" decay: the 08:17 success stays HEALTHY all
//      the way to 23:17 and beyond, because nothing new was due in between. This is what makes
//      the normal ~20-hour overnight gap a non-event instead of a nightly false alarm.
//   2. A DECISIVE OUTCOME (success, failure, skip, or a malformed/contradictory summary) NEVER
//      WAITS FOR GRACE. Grace exists only to cover ordinary GitHub schedule-delivery lateness
//      before any run for the opportunity has even been created; once a run has reached a
//      terminal GitHub state, there is nothing further to wait for.
import {deepFreeze} from './canonical.mjs';
import {OBSERVER_GRACE_MS} from './opportunity-schedule.mjs';

export const HEARTBEAT_STATE_HEALTHY='HEALTHY';
export const HEARTBEAT_STATE_PENDING='PENDING';
export const HEARTBEAT_STATE_FAILED='FAILED';
export const HEARTBEAT_STATE_SKIPPED='SKIPPED';
export const HEARTBEAT_STATE_MISSING='MISSING';
export const HEARTBEAT_STATE_MALFORMED='MALFORMED';
export const HEARTBEAT_STATES=deepFreeze([HEARTBEAT_STATE_HEALTHY,HEARTBEAT_STATE_PENDING,
  HEARTBEAT_STATE_FAILED,HEARTBEAT_STATE_SKIPPED,HEARTBEAT_STATE_MISSING,HEARTBEAT_STATE_MALFORMED]);

// Every decoded observation health state this module accepts as `opportunityEvidence.healthState`.
// `SUCCESS` and `NOT_EVALUATED_OK` both count as the opportunity having genuinely executed without
// escalation (see `observer-summary-contract.mjs` for why `NOT_EVALUATED` is acceptable); every
// other value is a decisive non-healthy outcome.
const HEALTHY_EVIDENCE_STATES=deepFreeze(['SUCCESS','NOT_EVALUATED_OK']);
const REASON_BY_EVIDENCE_STATE=deepFreeze({
  FAILED:'OBSERVER_JOB_FAILED',
  SKIPPED:'OBSERVER_JOB_SKIPPED',
  SUMMARY_INVALID:'OBSERVER_SUMMARY_INVALID',
  SUMMARY_UNHEALTHY:'OBSERVER_SUMMARY_UNHEALTHY',
  SUMMARY_CONTRADICTORY:'OBSERVER_SUMMARY_CONTRADICTORY',
  ATTRIBUTION_AMBIGUOUS:'OBSERVER_OPPORTUNITY_ATTRIBUTION_AMBIGUOUS',
  UNCLASSIFIED:'OBSERVER_SUMMARY_INVALID'
});
const STATE_BY_EVIDENCE_STATE=deepFreeze({
  FAILED:HEARTBEAT_STATE_FAILED,
  SKIPPED:HEARTBEAT_STATE_SKIPPED,
  SUMMARY_INVALID:HEARTBEAT_STATE_MALFORMED,
  SUMMARY_UNHEALTHY:HEARTBEAT_STATE_MALFORMED,
  SUMMARY_CONTRADICTORY:HEARTBEAT_STATE_MALFORMED,
  ATTRIBUTION_AMBIGUOUS:HEARTBEAT_STATE_MALFORMED,
  UNCLASSIFIED:HEARTBEAT_STATE_MALFORMED
});

export class HeartbeatError extends Error{
  constructor(code){super(code);this.name='HeartbeatError';this.code=code;}
}
const fail=code=>{throw new HeartbeatError(code);};

const safeInstant=value=>Number.isSafeInteger(value)&&value>=0;

function validEvidence(value){
  if(value===null)return true;
  if(!value||typeof value!=='object')return false;
  return typeof value.healthState==='string'&&safeInstant(value.createdAt);
}

// `opportunityAt` is `null` when no opportunity is yet due for this watchdog (before bootstrap, or
// — defensively — before the very first declared opportunity instant exists at all): that is
// never an incident, only the absence of anything to evaluate yet.
export function classifyHeartbeat({opportunityAt,opportunityEvidence,now}){
  if(!safeInstant(now))fail('heartbeat_now_invalid');
  if(opportunityAt!==null&&!safeInstant(opportunityAt))fail('heartbeat_opportunity_invalid');
  if(!validEvidence(opportunityEvidence))fail('heartbeat_evidence_invalid');

  if(opportunityAt===null){
    return deepFreeze({state:HEARTBEAT_STATE_PENDING,active:false,reasonCode:null,
      opportunityAt:null});
  }

  if(opportunityEvidence===null){
    if(now<=opportunityAt+OBSERVER_GRACE_MS){
      return deepFreeze({state:HEARTBEAT_STATE_PENDING,active:false,reasonCode:null,opportunityAt});
    }
    return deepFreeze({state:HEARTBEAT_STATE_MISSING,active:true,
      reasonCode:'OBSERVER_HEARTBEAT_MISSING',opportunityAt});
  }

  const {healthState}=opportunityEvidence;
  if(HEALTHY_EVIDENCE_STATES.includes(healthState)){
    return deepFreeze({state:HEARTBEAT_STATE_HEALTHY,active:false,
      reasonCode:'OBSERVER_HEARTBEAT_HEALTHY',opportunityAt});
  }
  if(healthState==='IN_FLIGHT'){
    if(now<=opportunityAt+OBSERVER_GRACE_MS){
      return deepFreeze({state:HEARTBEAT_STATE_PENDING,active:false,reasonCode:null,opportunityAt});
    }
    return deepFreeze({state:HEARTBEAT_STATE_MISSING,active:true,
      reasonCode:'OBSERVER_HEARTBEAT_INCOMPLETE',opportunityAt});
  }
  const state=STATE_BY_EVIDENCE_STATE[healthState];
  const reasonCode=REASON_BY_EVIDENCE_STATE[healthState];
  if(!state||!reasonCode)fail('heartbeat_evidence_state_unknown');
  return deepFreeze({state,active:true,reasonCode,opportunityAt});
}
