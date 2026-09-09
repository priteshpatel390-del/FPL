// DATA-OPS-A1.4 — the incident lifecycle reducer.
//
// One pure function decides NEW / ONGOING / CHANGED / RECOVERED / REOPENED / NONE from the
// persisted incident row (or `null` for a fingerprint never seen before) and the current cycle's
// evaluation. It touches no D1, sends no email and reads no clock beyond the timestamp the caller
// supplies, so the whole lifecycle contract is provable from fixtures.
//
// Two safety rules live here rather than in the caller:
//
//   1. OUT-OF-ORDER / REPLAYED EVIDENCE NEVER MOVES STATE BACKWARDS. If the evidence this cycle
//      observed is not newer than the evidence already reflected in the persisted row, the
//      reducer returns `NONE` and the unchanged row — older evidence can never overwrite a newer
//      incident state, and identical evidence replayed by a retry is a safe no-op.
//   2. A FINGERPRINT'S REASON CODE, NOT ITS PRESENCE ALONE, DECIDES ONGOING VERSUS CHANGED. Two
//      cycles that both find the same active problem with the same reason code are the same
//      unchanged incident; a reason-code change while still active is a material change and is
//      reported as `CHANGED` so the owner is told what shifted.
import {deepFreeze} from './canonical.mjs';

export const LIFECYCLE_STATE_ACTIVE='ACTIVE';
export const LIFECYCLE_STATE_RECOVERED='RECOVERED';

export const TRANSITION_NEW='NEW';
export const TRANSITION_ONGOING='ONGOING';
export const TRANSITION_CHANGED='CHANGED';
export const TRANSITION_RECOVERED='RECOVERED';
export const TRANSITION_REOPENED='REOPENED';
export const TRANSITION_NONE='NONE';
export const TRANSITIONS=deepFreeze([TRANSITION_NEW,TRANSITION_ONGOING,TRANSITION_CHANGED,
  TRANSITION_RECOVERED,TRANSITION_REOPENED,TRANSITION_NONE]);

export class LifecycleError extends Error{
  constructor(code){super(code);this.name='LifecycleError';this.code=code;}
}
const fail=code=>{throw new LifecycleError(code);};

const iso=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  &&Number.isFinite(Date.parse(value));
const reasonPattern=/^[A-Z][A-Z0-9_]{1,63}$/;
const shaPattern=/^[0-9a-f]{40}$/;

// An opaque, caller-defined provenance pointer the reducer carries through unchanged — it never
// interprets these fields, only validates their shape and passes them on, which is what lets
// `saveIncident()` persist genuine evidence (a real observation id, run id, attempt, head SHA and
// the evidence's own timestamp) instead of a placeholder.
function validEvidenceRef(value){
  if(value===null)return true;
  if(!value||typeof value!=='object')return false;
  return typeof value.observationId==='string'&&value.observationId!==''
    &&(value.workflowRunId===null||Number.isSafeInteger(value.workflowRunId))
    &&(value.runAttempt===null||(Number.isSafeInteger(value.runAttempt)&&value.runAttempt>=1))
    &&(value.headSha===null||shaPattern.test(value.headSha))
    &&iso(value.observedAt);
}

function validPrevious(previous){
  if(previous===null)return true;
  if(!previous||typeof previous!=='object')return false;
  return typeof previous.fingerprint==='string'
    &&[LIFECYCLE_STATE_ACTIVE,LIFECYCLE_STATE_RECOVERED].includes(previous.lifecycleState)
    &&reasonPattern.test(previous.reasonCode)
    &&iso(previous.firstSeenAt)&&iso(previous.lastSeenAt)
    &&(previous.recoveredAt===null||iso(previous.recoveredAt))
    &&Number.isSafeInteger(previous.occurrenceCount)&&previous.occurrenceCount>=0
    &&Number.isSafeInteger(previous.reopenedCount)&&previous.reopenedCount>=0
    &&iso(previous.lastEvidenceObservedAt)
    &&validEvidenceRef(previous.evidenceRef===undefined?null:previous.evidenceRef);
}

// `evaluation.active` is true when the fingerprint's problem is currently present; `reasonCode`
// is required when active and must be `null` otherwise. `evidenceObservedAt` is the timestamp of
// the observation this evaluation was derived from, used only for the monotonic replay guard.
// `evidenceRef` is optional real provenance for the decisive evidence (or `null` when there is
// none, e.g. a PENDING/no-opportunity-yet evaluation).
function validEvaluation(evaluation){
  if(!evaluation||typeof evaluation!=='object')return false;
  if(typeof evaluation.active!=='boolean')return false;
  if(evaluation.active&&!reasonPattern.test(evaluation.reasonCode))return false;
  if(!evaluation.active&&evaluation.reasonCode!==null)return false;
  if(!validEvidenceRef(evaluation.evidenceRef===undefined?null:evaluation.evidenceRef))return false;
  return iso(evaluation.evidenceObservedAt)&&iso(evaluation.now);
}

export function reduceIncidentLifecycle({fingerprint,previous,evaluation}){
  if(typeof fingerprint!=='string'||fingerprint==='')fail('lifecycle_fingerprint_invalid');
  if(!validPrevious(previous))fail('lifecycle_previous_invalid');
  if(!validEvaluation(evaluation))fail('lifecycle_evaluation_invalid');
  if(previous!==null&&previous.fingerprint!==fingerprint)fail('lifecycle_fingerprint_mismatch');

  const {active,reasonCode,evidenceObservedAt,now}=evaluation;
  const evidenceRef=evaluation.evidenceRef===undefined?null:evaluation.evidenceRef;

  // Replay guard: evidence no newer than what is already persisted changes nothing. Strictly
  // older evidence and byte-identical replays of the same evidence both take this exit.
  if(previous!==null&&Date.parse(evidenceObservedAt)<=Date.parse(previous.lastEvidenceObservedAt)){
    return deepFreeze({transition:TRANSITION_NONE,next:previous});
  }

  if(!active){
    if(previous===null||previous.lifecycleState===LIFECYCLE_STATE_RECOVERED){
      // Nothing active, and nothing was active before (or it is already recovered): no incident
      // exists to report on, and none is created for a healthy observation.
      return deepFreeze({transition:TRANSITION_NONE,next:previous});
    }
    return deepFreeze({transition:TRANSITION_RECOVERED,next:deepFreeze({
      fingerprint,lifecycleState:LIFECYCLE_STATE_RECOVERED,reasonCode:previous.reasonCode,
      firstSeenAt:previous.firstSeenAt,lastSeenAt:now,recoveredAt:now,
      occurrenceCount:previous.occurrenceCount,reopenedCount:previous.reopenedCount,
      lastEvidenceObservedAt:evidenceObservedAt,evidenceRef})});
  }

  if(previous===null){
    return deepFreeze({transition:TRANSITION_NEW,next:deepFreeze({
      fingerprint,lifecycleState:LIFECYCLE_STATE_ACTIVE,reasonCode,
      firstSeenAt:now,lastSeenAt:now,recoveredAt:null,occurrenceCount:1,reopenedCount:0,
      lastEvidenceObservedAt:evidenceObservedAt,evidenceRef})});
  }

  if(previous.lifecycleState===LIFECYCLE_STATE_RECOVERED){
    return deepFreeze({transition:TRANSITION_REOPENED,next:deepFreeze({
      fingerprint,lifecycleState:LIFECYCLE_STATE_ACTIVE,reasonCode,
      firstSeenAt:previous.firstSeenAt,lastSeenAt:now,recoveredAt:null,
      occurrenceCount:previous.occurrenceCount+1,reopenedCount:previous.reopenedCount+1,
      lastEvidenceObservedAt:evidenceObservedAt,evidenceRef})});
  }

  // Already active. Same reason code: no material change. Different reason code: the same
  // fingerprint's condition has materially changed and the owner should be told what shifted.
  const transition=previous.reasonCode===reasonCode?TRANSITION_ONGOING:TRANSITION_CHANGED;
  return deepFreeze({transition,next:deepFreeze({
    fingerprint,lifecycleState:LIFECYCLE_STATE_ACTIVE,reasonCode,
    firstSeenAt:previous.firstSeenAt,lastSeenAt:now,recoveredAt:null,
    occurrenceCount:previous.occurrenceCount+1,reopenedCount:previous.reopenedCount,
    lastEvidenceObservedAt:evidenceObservedAt,evidenceRef})});
}
