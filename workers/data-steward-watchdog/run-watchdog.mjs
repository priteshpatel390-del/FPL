// DATA-OPS-A1.4 — the watchdog cycle: the one place every module in this package is wired
// together.
//
// Everything this function can do is: read bounded GitHub Actions evidence about the A1.3
// observer's own recent runs, read/write this Worker's own isolated D1 state, and send at most a
// small, deterministic number of owner-notification emails through the one narrow transport. It
// cannot dispatch a workflow, write anywhere outside its own database, or send to any recipient
// other than the one the `send_email` binding itself is configured with. Nothing here decides to
// repair, retry, redeploy or mutate any part of the production chain A1.2/A1.3 observe — this
// module produces a lifecycle transition and, at most, a notification decision.
import {deepFreeze,sha256Hex,stableStringify} from '../../src/decision-intelligence/canonical.mjs';
import {resolveWatchdogEnvironment} from './lib/environment-contract.mjs';
import {readObserverEvidence} from './lib/github-evidence-reader.mjs';
import {classifyHeartbeat} from './lib/heartbeat.mjs';
import {incidentFingerprint} from './lib/incident-fingerprint.mjs';
import {reduceIncidentLifecycle,TRANSITION_NONE} from './lib/lifecycle-reducer.mjs';
import {classifyObserverRun} from './lib/observation-classifier.mjs';
import {decideNotification} from './notification/decision.mjs';
import {buildNotificationMessage} from './notification/message.mjs';
import {sendOwnerNotification} from './notification/transport.mjs';
import {getIncident,lastScheduledSuccessAt,markIncidentNotified,pruneRetention,
  recordNotificationDelivery,recordObservation,reserveNotification,saveIncident}
  from './persistence/repository.mjs';

export const WATCHDOG_RUN_VERSION='data-ops-a1.4-watchdog-v1';

const at=now=>new Date(now).toISOString();
const hashId=async(prefix,value,cryptoImpl)=>`${prefix}-${(await sha256Hex(stableStringify(value),cryptoImpl)).slice(0,24)}`;

// Records every decoded run this cycle observed as a bounded evidence row. Deterministic keying
// on (runId, healthState) is what makes this idempotent: identical evidence observed again
// (a retry, a duplicate Cron delivery, an unchanged run seen on the next cycle) writes the same
// row again and is silently ignored by the schema's own uniqueness constraint; a genuine state
// change (e.g. a run moving from in-flight to success) has a different key and is recorded as a
// new fact rather than overwriting or losing the earlier one.
async function recordEvidence(db,evidence,nowIso,cryptoImpl){
  if(!evidence.ok)return;
  for(const [index,run] of evidence.runs.entries()){
    const summaryAttempted=index===0&&run.jobHealth==='SUCCESS';
    const classified=classifyObserverRun({jobHealth:run.jobHealth,summaryAttempted,
      summaryValid:run.summary!==null});
    const eventType=run.event==='schedule'||run.event==='workflow_dispatch'?run.event:'unknown';
    const observationId=await hashId('obs',{workflowRunId:run.id,healthState:classified.healthState},cryptoImpl);
    const evidenceHash=await sha256Hex(stableStringify({workflowRunId:run.id,eventType,
      healthState:classified.healthState,reasonCode:classified.reasonCode,headSha:run.headSha}),cryptoImpl);
    await recordObservation(db,{observationId,sourceKind:eventType==='schedule'?'scheduled_run':'manual_run',
      eventType,workflowRunId:run.id,runAttempt:null,observedAt:nowIso,runCreatedAt:run.createdAt,
      runCompletedAt:run.jobCompletedAt,headSha:run.headSha,healthState:classified.healthState,
      reasonCode:classified.reasonCode,evidenceHash,createdAt:nowIso});
  }
}

// Reserves, builds and attempts delivery of exactly one notification for one lifecycle
// transition. The D1 unique constraint on `idempotencyKey` is the actual idempotency primitive:
// a reservation that affects zero rows means an equivalent decision over this exact evidence was
// already made (by this same cycle running again, a retry, or duplicate Cron delivery), and no
// second email is ever attempted for it.
async function deliverNotification(deps,identity,incident,notificationTransition,nowIso){
  const {db,email,EmailMessageCtor,cryptoImpl}=deps;
  const idempotencyKey=await hashId('notif',
    {fingerprint:identity.fingerprint,notificationTransition,evidenceObservedAt:nowIso},cryptoImpl);
  const reservation=await reserveNotification(db,{idempotencyKey,fingerprint:identity.fingerprint,
    transition:notificationTransition,decidedAt:nowIso,evidenceObservationId:null,createdAt:nowIso});
  if(!reservation.reserved)return false;
  const message=buildNotificationMessage({fingerprint:identity.fingerprint,
    transition:notificationTransition,problemClass:identity.problemClass,component:identity.component,
    reasonCode:incident.reasonCode,lastKnownHealthyOrScheduledAt:incident.lastEvidenceObservedAt??null,
    ageMs:null,workflowRunId:null,headSha:null,occurrenceCount:incident.occurrenceCount,
    reopenedCount:incident.reopenedCount});
  let delivery;
  try{
    delivery=await sendOwnerNotification({binding:email,subject:message.subject,body:message.body,
      EmailMessageCtor});
  }catch{delivery=Object.freeze({delivered:false});}
  await recordNotificationDelivery(db,idempotencyKey,delivery.delivered?'SENT':'FAILED',nowIso);
  if(delivery.delivered)await markIncidentNotified(db,identity.fingerprint,nowIso);
  return delivery.delivered;
}

// One problem's whole cycle: identity, replay-safe lifecycle reduction, persistence, and — only
// on a notification-worthy transition — the notification decision and delivery attempt.
async function evaluateProblem(deps,problemKey,{active,reasonCode,nowIso}){
  const {db,cryptoImpl}=deps;
  const identity=await incidentFingerprint(problemKey,{cryptoImpl});
  const previous=await getIncident(db,identity.fingerprint);
  const {transition,next}=reduceIncidentLifecycle({fingerprint:identity.fingerprint,previous,
    evaluation:{active,reasonCode:active?reasonCode:null,evidenceObservedAt:nowIso,now:nowIso}});
  if(transition===TRANSITION_NONE)return deepFreeze({transition,notified:false});
  await saveIncident(db,{problemClass:identity.problemClass,component:identity.component,next,
    evidenceObservationId:null,updatedAt:nowIso});
  const decision=decideNotification({transition,lastNotifiedAt:previous?.lastNotifiedAt??null,
    now:Date.parse(nowIso)});
  const notified=decision.shouldNotify
    ?await deliverNotification(deps,identity,next,decision.notificationTransition,nowIso)
    :false;
  return deepFreeze({transition,notified});
}

export async function runWatchdogCycle({env,fetchImpl=globalThis.fetch,now=Date.now(),
  cryptoImpl=globalThis.crypto,EmailMessageCtor}={}){
  const resolved=resolveWatchdogEnvironment(env);
  if(!resolved.ok)return deepFreeze({ok:false,reasonCode:resolved.reasonCode});
  const nowIso=at(now);
  const deps=Object.freeze({db:resolved.db,email:resolved.email,EmailMessageCtor,cryptoImpl});

  const evidence=await readObserverEvidence({token:resolved.githubToken,fetchImpl,now})
    .catch(()=>Object.freeze({ok:false,reasonCode:'GITHUB_EVIDENCE_UNAVAILABLE'}));
  await recordEvidence(resolved.db,evidence,nowIso,cryptoImpl);

  const lastSuccess=await lastScheduledSuccessAt(resolved.db);
  const heartbeat=classifyHeartbeat({lastScheduledSuccessAt:lastSuccess,now});

  const heartbeatResult=await evaluateProblem(deps,'OBSERVER_HEARTBEAT',
    {active:heartbeat.state!=='HEALTHY',reasonCode:heartbeat.reasonCode,nowIso});
  const evidenceResult=await evaluateProblem(deps,'GITHUB_EVIDENCE',
    {active:!evidence.ok,reasonCode:evidence.ok?null:evidence.reasonCode,nowIso});

  const pruned=await pruneRetention(resolved.db,now).catch(()=>null);

  return deepFreeze({ok:true,version:WATCHDOG_RUN_VERSION,now:nowIso,
    githubEvidenceOk:evidence.ok,
    heartbeat:Object.freeze({state:heartbeat.state,reasonCode:heartbeat.reasonCode}),
    incidents:Object.freeze({
      observerHeartbeat:Object.freeze({transition:heartbeatResult.transition,notified:heartbeatResult.notified}),
      githubEvidence:Object.freeze({transition:evidenceResult.transition,notified:evidenceResult.notified})}),
    pruned});
}
