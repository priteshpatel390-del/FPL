// DATA-OPS A1.4 — schedule-aware heartbeat classifier for one daily 04:17 UTC observation.
// Success at the latest due opportunity stays healthy until the next opportunity. Pending exists
// only inside the bounded Cloudflare-to-GitHub delivery window; at the 30-minute deadline itself,
// absent or still-in-flight evidence is missing/incomplete.
import {deepFreeze} from './canonical.mjs';
import {OBSERVER_DELIVERY_TOLERANCE_MS} from './opportunity-schedule.mjs';

export const HEARTBEAT_STATE_HEALTHY='HEALTHY';
export const HEARTBEAT_STATE_PENDING='PENDING';
export const HEARTBEAT_STATE_FAILED='FAILED';
export const HEARTBEAT_STATE_SKIPPED='SKIPPED';
export const HEARTBEAT_STATE_MISSING='MISSING';
export const HEARTBEAT_STATE_MALFORMED='MALFORMED';
export const HEARTBEAT_STATES=deepFreeze([HEARTBEAT_STATE_HEALTHY,HEARTBEAT_STATE_PENDING,
  HEARTBEAT_STATE_FAILED,HEARTBEAT_STATE_SKIPPED,HEARTBEAT_STATE_MISSING,HEARTBEAT_STATE_MALFORMED]);

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

export function classifyHeartbeat({opportunityAt,opportunityEvidence,now}){
  if(!safeInstant(now))fail('heartbeat_now_invalid');
  if(opportunityAt!==null&&!safeInstant(opportunityAt))fail('heartbeat_opportunity_invalid');
  if(!validEvidence(opportunityEvidence))fail('heartbeat_evidence_invalid');

  if(opportunityAt===null){
    return deepFreeze({state:HEARTBEAT_STATE_PENDING,active:false,reasonCode:null,
      opportunityAt:null});
  }

  if(opportunityEvidence===null){
    if(now<opportunityAt+OBSERVER_DELIVERY_TOLERANCE_MS){
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
    if(now<opportunityAt+OBSERVER_DELIVERY_TOLERANCE_MS){
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
