// DATA-OPS A1.4 — independent watchdog over the single daily A1.3 automatic observation.
//
// Cloudflare owns both clocks but under separate Worker identities. The A1.3 dispatcher fires at
// 04:17 UTC and records the exact GitHub workflow-run id in its isolated receipt D1. This watchdog
// fires at 04:47 UTC, reads only the receipt for that exact logical opportunity, and if — and only
// if — it contains a DISPATCHED run id, reads that exact GitHub run. Ordinary manual dispatches,
// searches over recent history and timestamp guessing are therefore outside the health path.
import {deepFreeze,sha256Hex,stableStringify} from './lib/canonical.mjs';
import {ENVIRONMENT_INCOMPLETE,resolveWatchdogEnvironment} from './lib/environment-contract.mjs';
import {READ_OK} from './lib/github-evidence-reader.mjs';
import {classifyHeartbeat} from './lib/heartbeat.mjs';
import {incidentFingerprint} from './lib/incident-fingerprint.mjs';
import {reduceIncidentLifecycle,TRANSITION_NONE} from './lib/lifecycle-reducer.mjs';
import {classifyObserverRun} from './lib/observation-classifier.mjs';
import {readObserverClockReceipt} from './lib/observer-clock-reader.mjs';
import {latestExpectedOpportunity} from './lib/opportunity-schedule.mjs';
import {readTrustedObserverRun} from './lib/trusted-observer-run-reader.mjs';
import {decideNotification} from './notification/decision.mjs';
import {buildNotificationMessage} from './notification/message.mjs';
import {sendOwnerNotification} from './notification/transport.mjs';
import {claimScheduledEvent,ensureBootstrap,getFailedNotification,getIncident,
  markIncidentNotified,persistOpportunityAttribution,opportunityEvidenceSince,pruneRetention,
  recordNotificationDelivery,recordObservation,reserveNotification,saveIncident}
  from './persistence/repository.mjs';

export const WATCHDOG_RUN_VERSION='data-ops-a1.4-watchdog-v3-cloudflare-clock';

export class WatchdogExecutionError extends Error{
  constructor(code){super(code);this.name='WatchdogExecutionError';this.code=code;}
}
const fail=code=>{throw new WatchdogExecutionError(code);};
const at=instant=>new Date(instant).toISOString();
const hashId=async(prefix,value,cryptoImpl)=>
  `${prefix}-${(await sha256Hex(stableStringify(value),cryptoImpl)).slice(0,24)}`;

async function recordTrustedAutomaticEvidence(db,evidence,opportunityAtIso,nowIso,cryptoImpl){
  if(!evidence.ok||evidence.run===null)return;
  const run=evidence.run;
  const classified=classifyObserverRun({jobHealth:run.jobHealth,
    summaryAttempted:run.summaryAttempted,summary:run.summary});
  const attribution=await persistOpportunityAttribution(db,{workflowRunId:run.id,
    runAttempt:run.runAttempt,opportunityAt:opportunityAtIso,attributedAt:nowIso});
  if(!attribution.assigned)fail('WATCHDOG_TRUSTED_ATTRIBUTION_CONFLICT');

  const observationId=await hashId('obs',{provenance:'observer_clock_receipt',
    opportunityAt:opportunityAtIso,workflowRunId:run.id,runAttempt:run.runAttempt,
    healthState:classified.healthState},cryptoImpl);
  const evidenceHash=await sha256Hex(stableStringify({provenance:'observer_clock_receipt',
    logicalEvent:'schedule',rawGitHubEvent:run.event,opportunityAt:opportunityAtIso,
    workflowRunId:run.id,runAttempt:run.runAttempt,healthState:classified.healthState,
    reasonCode:classified.reasonCode,headSha:run.headSha}),cryptoImpl);
  await recordObservation(db,{observationId,sourceKind:'scheduled_run',eventType:'schedule',
    workflowRunId:run.id,runAttempt:run.runAttempt,observedAt:nowIso,runCreatedAt:run.createdAt,
    runCompletedAt:run.jobCompletedAt,opportunityAt:opportunityAtIso,headSha:run.headSha,
    healthState:classified.healthState,reasonCode:classified.reasonCode,evidenceHash,createdAt:nowIso});
}

async function evaluateHeartbeat(db,opportunityAt,now){
  let evidenceRow=null;
  if(opportunityAt!==null)evidenceRow=await opportunityEvidenceSince(db,at(opportunityAt));
  const opportunityEvidence=evidenceRow===null?null:
    {healthState:evidenceRow.healthState,createdAt:evidenceRow.createdAt};
  return {heartbeat:classifyHeartbeat({opportunityAt,opportunityEvidence,now}),evidenceRow};
}

async function deliverNotification(deps,identity,incident,notificationTransition,nowIso){
  const {db,email,EmailMessageCtor,cryptoImpl}=deps;
  const idempotencyKey=await hashId('notif',
    {fingerprint:identity.fingerprint,notificationTransition,evidenceObservedAt:nowIso},cryptoImpl);
  const reservation=await reserveNotification(db,{idempotencyKey,fingerprint:identity.fingerprint,
    transition:notificationTransition,decidedAt:nowIso,
    evidenceObservationId:incident.evidenceRef?.observationId??null,
    evidenceObservedAt:incident.lastEvidenceObservedAt,createdAt:nowIso});
  if(!reservation.reserved)return false;
  const evidenceRef=incident.evidenceRef;
  const message=buildNotificationMessage({fingerprint:identity.fingerprint,
    transition:notificationTransition,problemClass:identity.problemClass,component:identity.component,
    reasonCode:incident.reasonCode,lastKnownHealthyOrScheduledAt:evidenceRef?.observedAt??null,
    ageMs:evidenceRef?.observedAt?Date.parse(nowIso)-Date.parse(evidenceRef.observedAt):null,
    workflowRunId:evidenceRef?.workflowRunId??null,headSha:evidenceRef?.headSha??null,
    occurrenceCount:incident.occurrenceCount,reopenedCount:incident.reopenedCount});
  let delivery;
  try{delivery=await sendOwnerNotification({binding:email,subject:message.subject,body:message.body,
    EmailMessageCtor});}
  catch{delivery=Object.freeze({delivered:false});}
  await recordNotificationDelivery(db,idempotencyKey,delivery.delivered?'SENT':'FAILED',nowIso);
  if(delivery.delivered)await markIncidentNotified(db,identity.fingerprint,nowIso);
  return delivery.delivered;
}

async function retryFailedNotification(deps,identity,incident,failed,nowIso){
  const evidenceRef=incident.evidenceRef;
  const message=buildNotificationMessage({fingerprint:identity.fingerprint,
    transition:failed.transition,problemClass:identity.problemClass,component:identity.component,
    reasonCode:incident.reasonCode,lastKnownHealthyOrScheduledAt:evidenceRef?.observedAt??null,
    ageMs:evidenceRef?.observedAt?Date.parse(nowIso)-Date.parse(evidenceRef.observedAt):null,
    workflowRunId:evidenceRef?.workflowRunId??null,headSha:evidenceRef?.headSha??null,
    occurrenceCount:incident.occurrenceCount,reopenedCount:incident.reopenedCount});
  let delivery;
  try{delivery=await sendOwnerNotification({binding:deps.email,subject:message.subject,
    body:message.body,EmailMessageCtor:deps.EmailMessageCtor});}
  catch{delivery=Object.freeze({delivered:false});}
  await recordNotificationDelivery(deps.db,failed.idempotencyKey,
    delivery.delivered?'SENT':'FAILED',nowIso);
  if(delivery.delivered)await markIncidentNotified(deps.db,identity.fingerprint,nowIso);
  return delivery.delivered;
}

async function evaluateProblem(deps,problemKey,{active,reasonCode,nowIso,evidenceObservedAt,evidenceRef}){
  const {db,cryptoImpl}=deps;
  const identity=await incidentFingerprint(problemKey,{cryptoImpl});
  const previous=await getIncident(db,identity.fingerprint);
  const stableEvidenceAt=active&&previous?.lifecycleState==='ACTIVE'&&previous.reasonCode===reasonCode
    &&evidenceRef===null?previous.lastEvidenceObservedAt:evidenceObservedAt;
  const {transition,next}=reduceIncidentLifecycle({fingerprint:identity.fingerprint,previous,
    evaluation:{active,reasonCode:active?reasonCode:null,evidenceObservedAt:stableEvidenceAt,now:nowIso,
      evidenceRef:evidenceRef??null}});
  if(transition===TRANSITION_NONE){
    const failed=previous===null?null:await getFailedNotification(db,identity.fingerprint);
    const notified=failed===null||failed.evidenceObservedAt!==previous.lastEvidenceObservedAt?false
      :await retryFailedNotification(deps,identity,previous,failed,nowIso);
    return deepFreeze({transition,notified});
  }
  await saveIncident(db,{problemClass:identity.problemClass,component:identity.component,next,
    updatedAt:nowIso});
  const decision=decideNotification({transition,lastNotifiedAt:previous?.lastNotifiedAt??null,
    now:Date.parse(nowIso)});
  const notified=decision.shouldNotify
    ?await deliverNotification(deps,identity,next,decision.notificationTransition,nowIso):false;
  return deepFreeze({transition,notified});
}

export async function runWatchdogCycle({env,fetchImpl=globalThis.fetch,now=Date.now(),
  scheduledTime=now,cryptoImpl=globalThis.crypto,EmailMessageCtor}={}){
  const resolved=resolveWatchdogEnvironment(env);
  if(!resolved.ok)fail(ENVIRONMENT_INCOMPLETE);
  const nowIso=at(now);

  const claim=await claimScheduledEvent(resolved.db,at(scheduledTime),nowIso);
  if(!claim.claimed){
    return deepFreeze({ok:true,version:WATCHDOG_RUN_VERSION,duplicate:true,
      reasonCode:'WATCHDOG_DUPLICATE_SCHEDULED_EVENT'});
  }

  const deps=Object.freeze({db:resolved.db,email:resolved.email,EmailMessageCtor,cryptoImpl});

  // The logical 04:47 watchdog firing maps to the most recent declared opportunity at that
  // scheduled instant: 04:17 the same UTC day. Seeding bootstrap with that opportunity means the
  // first legitimate watchdog firing evaluates its own paired observer rather than skipping it.
  const firstOpportunity=latestExpectedOpportunity({now:scheduledTime,bootstrapAt:0});
  const bootstrapIso=await ensureBootstrap(resolved.db,at(firstOpportunity));
  const bootstrapAt=Date.parse(bootstrapIso);
  const opportunityAt=latestExpectedOpportunity({now:scheduledTime,bootstrapAt});

  let evidence=deepFreeze({ok:true,reasonCode:READ_OK,run:null});
  if(opportunityAt!==null){
    const receipt=await readObserverClockReceipt(resolved.clockDb,at(opportunityAt));
    if(receipt?.state==='DISPATCHED'){
      evidence=await readTrustedObserverRun({runId:receipt.workflowRunId,
        token:resolved.githubToken,fetchImpl});
      await recordTrustedAutomaticEvidence(resolved.db,evidence,at(opportunityAt),nowIso,cryptoImpl);
    }
  }

  const {heartbeat,evidenceRow}=await evaluateHeartbeat(resolved.db,opportunityAt,now);
  const heartbeatEvidenceRef=evidenceRow===null?null:deepFreeze({
    observationId:evidenceRow.observationId,workflowRunId:evidenceRow.workflowRunId,
    runAttempt:evidenceRow.runAttempt,headSha:evidenceRow.headSha,
    observedAt:evidenceRow.completedAt??new Date(evidenceRow.createdAt).toISOString()});

  const heartbeatResult=await evaluateProblem(deps,'OBSERVER_HEARTBEAT',
    {active:heartbeat.active,reasonCode:heartbeat.reasonCode,nowIso,evidenceRef:heartbeatEvidenceRef,
      evidenceObservedAt:evidenceRow?.completedAt??evidenceRow?.observedAt
        ??at(heartbeat.opportunityAt??bootstrapAt)});
  const evidenceResult=await evaluateProblem(deps,'GITHUB_EVIDENCE',
    {active:!evidence.ok,reasonCode:evidence.ok?null:evidence.reasonCode,nowIso,evidenceRef:null,
      evidenceObservedAt:nowIso});

  await pruneRetention(resolved.db,now);

  return deepFreeze({ok:true,version:WATCHDOG_RUN_VERSION,now:nowIso,duplicate:false,
    githubEvidenceOk:evidence.ok,
    heartbeat:Object.freeze({state:heartbeat.state,reasonCode:heartbeat.reasonCode,
      opportunityAt:heartbeat.opportunityAt}),
    incidents:Object.freeze({
      observerHeartbeat:Object.freeze({transition:heartbeatResult.transition,notified:heartbeatResult.notified}),
      githubEvidence:Object.freeze({transition:evidenceResult.transition,notified:evidenceResult.notified})})});
}
