// DATA-OPS-A1.2 — the observation run: who watches the watcher, and the one place the three
// sentinels are combined into a verdict.
//
// TWO RULES GOVERN EVERYTHING HERE.
//
// 1. A CRASHED SENTINEL IS NEVER GREEN. An observation run declares up front which sentinels it
//    requires. If any required sentinel did not complete, or completed but with evidence that is
//    stale, unavailable or failed, the run cannot report health at all — it reports RED. Silence
//    from an observer is treated as the absence of proof it is, never as the absence of a problem.
//
// 2. OBSERVATION IS NOT AUTHORIZATION. This module produces a deterministic verdict and the
//    evidence behind it. It does not decide, execute, repair, retry, dispatch, re-run, redeploy,
//    merge or mutate anything, and it registers no new autonomy class. The verdict is handed to
//    A1.1, which remains the sole classification and policy authority; A1.1's registered rules
//    decide GREEN or RED, and A1.2 supplies only the observation those rules read.
//
// AMBER IS NOT PRODUCED ANYWHERE. `NOT_EVALUATED` is an evaluation phase, not a third operational
// state and not an autonomous remediation class: when the day's collection is not yet due, or a
// later scheduled opportunity still remains, this module raises no incident at all rather than
// inventing a middle state.
import {canonicalise,deepFreeze,sha256Hex,stableStringify} from '../../../src/decision-intelligence/canonical.mjs';
import {createObservation,isProvingObservation,observationEvidenceRow,PROVING_OBSERVATION_STATE}
  from './observation-contract.mjs';
import {EVALUATION_DUE,MAX_EVIDENCE_AGE_MS,evaluationPhase,utcDayWindow}
  from './production-chain-contract.mjs';

export const OBSERVATION_RUN_VERSION='data-ops-a1.2-run-v1';
export const REQUIRED_SENTINELS=deepFreeze(['github','cloudflare','d1']);

export const VERDICT_HEALTHY='HEALTHY';
export const VERDICT_UNHEALTHY='UNHEALTHY';
export const VERDICT_NOT_EVALUATED='NOT_EVALUATED';
export const VERDICTS=deepFreeze([VERDICT_HEALTHY,VERDICT_UNHEALTHY,VERDICT_NOT_EVALUATED]);

// The closed set of reasons this module may report. Nothing outside it is ever emitted, so no
// provider text, run id, URL, account id or credential can reach a report through a reason.
export const VERDICT_REASONS=deepFreeze([
  'HEALTHY_EXPECTED_STATE',
  'EVALUATION_NOT_DUE',
  'AWAITING_LATER_OPPORTUNITY',
  'SENTINEL_RUN_INCOMPLETE',
  'SENTINEL_EVIDENCE_UNAVAILABLE',
  'SENTINEL_EVIDENCE_STALE',
  'CLOUDFLARE_CRON_SET_MISMATCH',
  'GITHUB_RUN_STATE_UNRECOGNIZED',
  'OPPORTUNITY_GUARD_AMBIGUOUS',
  'OPPORTUNITY_GUARD_CONTRADICTORY',
  'WORKFLOW_B_UNEXPECTED_FAILURE',
  'GUARD_REFUSAL_WITHOUT_COLLECTION',
  'DUPLICATE_PRODUCTION_COLLECTION',
  'D1_COMMIT_ABSENT_AFTER_SUCCESSFUL_RUN',
  'D1_RUN_UNRESOLVED',
  'D1_GOVERNANCE_MISMATCH',
  'D1_STATE_INCONSISTENT',
  'PRODUCTION_COLLECTION_NOT_PROVEN'
]);

export class ObservationRunError extends Error{
  constructor(code){super(code);this.name='ObservationRunError';this.code=code;}
}
const fail=code=>{throw new ObservationRunError(code);};

const verdict=(state,reasonCode)=>{
  if(!VERDICTS.includes(state)||!VERDICT_REASONS.includes(reasonCode))fail('observation_run_reason_invalid');
  return deepFreeze({verdict:state,reasonCode});
};

// ---------------------------------------------------------------- the heartbeat contract

// Opens an observation run. The identity is deterministic over the required sentinel set and the
// start instant, so two runs of the same cycle over the same inputs are the same run, and a run
// that never completed is distinguishable from one that did.
export async function openObservationRun({startedAt,sentinels=REQUIRED_SENTINELS},
  {cryptoImpl=globalThis.crypto}={}){
  if(typeof startedAt!=='string'||!Number.isFinite(Date.parse(startedAt)))fail('observation_run_start_invalid');
  if(!Array.isArray(sentinels)||sentinels.length===0
    ||!sentinels.every(id=>REQUIRED_SENTINELS.includes(id))
    ||new Set(sentinels).size!==sentinels.length)fail('observation_run_sentinels_invalid');
  const required=deepFreeze([...sentinels].sort());
  const runId=await sha256Hex(stableStringify({version:OBSERVATION_RUN_VERSION,startedAt,required}),cryptoImpl);
  return deepFreeze({runId,version:OBSERVATION_RUN_VERSION,startedAt,required});
}

// Closes an observation run over the envelopes its sentinels produced. It proves the heartbeat
// facts an A1.2 execution must be able to show: that the run started, which sentinels were
// required, which completed and which did not, when, how fresh their evidence was, and a
// deterministic hash over the whole record.
export async function closeObservationRun({run,observations,completedAt},
  {cryptoImpl=globalThis.crypto,maxEvidenceAgeMs=MAX_EVIDENCE_AGE_MS}={}){
  if(!run||typeof run!=='object'||typeof run.runId!=='string')fail('observation_run_invalid');
  if(typeof completedAt!=='string'||!Number.isFinite(Date.parse(completedAt)))fail('observation_run_complete_invalid');
  if(observations===null||typeof observations!=='object'||Array.isArray(observations))fail('observation_run_invalid');
  const sentinels=run.required.map(sentinelId=>{
    const observation=observations[sentinelId]??null;
    const present=observation!==null&&typeof observation==='object';
    const proving=present&&isProvingObservation(observation,maxEvidenceAgeMs);
    return Object.freeze({sentinelId,
      completed:present,
      state:present?observation.observationState:'NOT_EVALUATED',
      observedAt:present?observation.observedAt:null,
      freshnessAgeMs:present?observation.freshnessAgeMs:null,
      evidenceHash:present?observation.evidenceHash:null,
      proving});
  });
  const record=canonicalise({version:OBSERVATION_RUN_VERSION,runId:run.runId,startedAt:run.startedAt,
    completedAt,required:run.required,sentinels,
    allCompleted:sentinels.every(entry=>entry.completed),
    allProving:sentinels.every(entry=>entry.proving)});
  const heartbeatHash=await sha256Hex(stableStringify(record),cryptoImpl);
  return deepFreeze(canonicalise({...record,heartbeatHash}));
}

// ---------------------------------------------------------------- cross-source causality

// The whole verdict, as one pure function over the three decoded sentinel views, the heartbeat and
// the clock. Every branch is deterministic and every exit carries a registered reason code.
//
// The order matters and is deliberate: the watcher is checked before anything it watched, hard
// anomalies are checked before the evaluation phase (a duplicate collection is wrong at 01:30 UTC
// just as it is at 05:00), and the phase only ever decides what an ABSENCE means.
export function evaluateProductionChain({heartbeat,github,cloudflare,d1,now}){
  if(!Number.isSafeInteger(now)||now<0)fail('observation_run_now_invalid');
  if(!heartbeat||typeof heartbeat!=='object')return verdict(VERDICT_UNHEALTHY,'SENTINEL_RUN_INCOMPLETE');

  // 1. The watcher first. A missing sentinel, a failed read, an unavailable fact or evidence too
  //    old to still be load-bearing all stop here, and none of them can become health.
  if(!heartbeat.allCompleted)return verdict(VERDICT_UNHEALTHY,'SENTINEL_RUN_INCOMPLETE');
  const stale=heartbeat.sentinels.some(entry=>
    entry.state===PROVING_OBSERVATION_STATE&&!entry.proving);
  if(stale)return verdict(VERDICT_UNHEALTHY,'SENTINEL_EVIDENCE_STALE');
  if(!heartbeat.allProving)return verdict(VERDICT_UNHEALTHY,'SENTINEL_EVIDENCE_UNAVAILABLE');
  if(!github?.ok||!cloudflare?.ok||!d1?.ok)return verdict(VERDICT_UNHEALTHY,'SENTINEL_EVIDENCE_UNAVAILABLE');

  // 2. Configuration identity. The live Cron Trigger set is the only Cloudflare fact this
  //    checkpoint can prove, so a set that is not exactly the three approved opportunities is a
  //    failure of the automatic clock itself.
  if(cloudflare.cronSetExpected!==true)return verdict(VERDICT_UNHEALTHY,'CLOUDFLARE_CRON_SET_MISMATCH');

  // 3. Hard anomalies, in any evaluation phase.
  const day=github.day;
  if(day.unclassified>0)return verdict(VERDICT_UNHEALTHY,'GITHUB_RUN_STATE_UNRECOGNIZED');
  // A guard ambiguity is itself a production-control-plane incident. A successful earlier
  // collection cannot forgive it. Likewise, AVAILABLE paired with a failed guard step is an
  // explicit contradiction rather than a benign refusal.
  if(day.guardAmbiguous>0)return verdict(VERDICT_UNHEALTHY,'OPPORTUNITY_GUARD_AMBIGUOUS');
  if(day.guardContradictory>0)return verdict(VERDICT_UNHEALTHY,'OPPORTUNITY_GUARD_CONTRADICTORY');
  if(day.duplicateCollection)return verdict(VERDICT_UNHEALTHY,'DUPLICATE_PRODUCTION_COLLECTION');
  if(d1.runs.completed>1)return verdict(VERDICT_UNHEALTHY,'DUPLICATE_PRODUCTION_COLLECTION');
  if(d1.runs.unresolved>0)return verdict(VERDICT_UNHEALTHY,'D1_RUN_UNRESOLVED');
  // The guard only reports a day consumed when a `collect` actually executed. A refusal with no
  // execution anywhere in the day contradicts the guard's own rule and is never explained away.
  if(day.refusedOpportunityConsumed>0&&day.collectExecutions===0)
    return verdict(VERDICT_UNHEALTHY,'GUARD_REFUSAL_WITHOUT_COLLECTION');
  // GitHub reporting a successful collection while production D1 holds no matching completed run
  // is the one case where a green workflow must not be believed.
  if(day.collected>0&&d1.runs.completed===0)
    return verdict(VERDICT_UNHEALTHY,'D1_COMMIT_ABSENT_AFTER_SUCCESSFUL_RUN');

  const collected=day.collected>0&&d1.runs.completed===1;

  // 4. A workflow B run that failed at the gate for any reason OTHER than the opportunity guard is
  //    an unexpected failure — unless the day's collection is independently proven, in which case
  //    a later run refused for a different reason changed nothing.
  if(day.gateRefusedOther>0&&!collected)return verdict(VERDICT_UNHEALTHY,'WORKFLOW_B_UNEXPECTED_FAILURE');

  // 5. The healthy day. One collection executed, one completed run persisted, and every later
  //    automatic attempt correctly refused. A GitHub run whose overall conclusion is `failure`
  //    purely because the guard refused an already-consumed day is counted here as healthy, which
  //    is the whole point of classifying on the guard outcome rather than the run conclusion.
  if(collected)return verdict(VERDICT_HEALTHY,'HEALTHY_EXPECTED_STATE');

  // 6. Absence. Only now does the evaluation phase decide what it means.
  const {phase}=evaluationPhase(now);
  if(phase===EVALUATION_DUE)return verdict(VERDICT_UNHEALTHY,'PRODUCTION_COLLECTION_NOT_PROVEN');
  return verdict(VERDICT_NOT_EVALUATED,
    phase==='NOT_DUE'?'EVALUATION_NOT_DUE':'AWAITING_LATER_OPPORTUNITY');
}

// ---------------------------------------------------------------- A1.1 handover

export const STEWARD_DETECTOR_ID='steward.production.chain';
export const STEWARD_DETECTOR_VERSION='data-ops-a1.2-v1';
export const STEWARD_DOMAIN='observation';

// The verdict, wrapped as its own hash-identified envelope so the reason behind a classification
// is itself evidence rather than a claim in a log line.
export async function verdictObservation({outcome,now,dayDate,heartbeat},{cryptoImpl=globalThis.crypto}={}){
  return createObservation({
    sourceType:'steward',
    sourceIdentity:STEWARD_DETECTOR_ID,
    subjectIdentity:`chain/${dayDate}`,
    observedAt:new Date(now).toISOString(),
    subjectTime:null,
    observationState:PROVING_OBSERVATION_STATE,
    reasonCode:outcome.reasonCode,
    normalizedState:{verdict:outcome.verdict,heartbeatHash:heartbeat.heartbeatHash,
      sentinelsCompleted:heartbeat.sentinels.filter(entry=>entry.completed).length,
      sentinelsRequired:heartbeat.required.length},
    provenance:[`steward:heartbeat/${heartbeat.runId.slice(0,32)}`],
    freshnessAgeMs:0
  },{cryptoImpl});
}

// Builds the exact input `createIncident` accepts, and nothing more.
//
// A1.2 states only what it observed. It supplies `{status:'healthy'}` as the expected state and
// either the same value or `{status:'unhealthy'}` as the observed one, and A1.1's registered
// `healthy` rule decides GREEN or RED from that pair alone. A1.2 supplies no confidence, no
// severity, no suggested action, no recovery proof and no classification of its own, because a
// proposer's evidence must never be able to authorize anything.
//
// A NOT_EVALUATED verdict deliberately produces NO incident: an open evaluation window is not an
// operational state and must not enter the incident stream as one.
export function incidentInputFor({outcome,mainSha,now,observations,verdictEnvelope}){
  if(outcome.verdict===VERDICT_NOT_EVALUATED)return null;
  const evidence=[...observations,verdictEnvelope].map(observationEvidenceRow);
  return deepFreeze({
    detectorId:STEWARD_DETECTOR_ID,
    detectorVersion:STEWARD_DETECTOR_VERSION,
    detectedAt:new Date(now).toISOString(),
    domain:STEWARD_DOMAIN,
    expectedState:{status:'healthy'},
    observedState:{status:outcome.verdict===VERDICT_HEALTHY?'healthy':'unhealthy'},
    evidence,
    conditionId:'healthy',
    mainSha:typeof mainSha==='string'&&/^[0-9a-f]{40}$/.test(mainSha)?mainSha:null,
    actionHistory:[],
    finalDisposition:null
  });
}

export const observationDayDate=now=>utcDayWindow(now).date;
