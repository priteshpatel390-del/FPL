// DATA-OPS-A1.4 — the watchdog cycle: the one place every module in this package is wired
// together.
//
// Everything this function can do is: claim exclusive ownership of one logical Cron firing, read
// bounded GitHub Actions evidence about the A1.3 observer's own recent runs, read/write this
// Worker's own isolated D1 state, and send at most a small, deterministic number of
// owner-notification emails through the one narrow transport. It cannot dispatch a workflow,
// write anywhere outside its own database, or send to any recipient other than the one the
// `send_email` binding itself is configured with. Nothing here decides to repair, retry, redeploy
// or mutate any part of the production chain A1.2/A1.3 observe — this module produces a
// lifecycle transition and, at most, a notification decision.
//
// FAILURE DISCIPLINE: this function throws a `WatchdogExecutionError` (or lets an unexpected
// exception from a module it calls propagate) on every genuine runtime failure — a D1 read/write
// error, a config/environment problem, a persistence or lifecycle bug. The Worker entry point
// (`watchdog.mjs`) lets that exception fail the `scheduled()` handler's promise, so Cloudflare's
// own Cron invocation history records a real failure rather than a falsely successful run. The
// one deliberate exception is a lost single-writer claim: that is an expected, healthy outcome
// (another execution of the same logical event is handling it) and resolves normally.
import {deepFreeze,sha256Hex,stableStringify} from './lib/canonical.mjs';
import {ENVIRONMENT_INCOMPLETE,resolveWatchdogEnvironment} from './lib/environment-contract.mjs';
import {readObserverEvidence} from './lib/github-evidence-reader.mjs';
import {classifyHeartbeat} from './lib/heartbeat.mjs';
import {incidentFingerprint} from './lib/incident-fingerprint.mjs';
import {reduceIncidentLifecycle,TRANSITION_NONE} from './lib/lifecycle-reducer.mjs';
import {classifyObserverRun} from './lib/observation-classifier.mjs';
import {latestExpectedOpportunity} from './lib/opportunity-schedule.mjs';
import {decideNotification} from './notification/decision.mjs';
import {buildNotificationMessage} from './notification/message.mjs';
import {sendOwnerNotification} from './notification/transport.mjs';
import {claimScheduledEvent,ensureBootstrap,getIncident,markIncidentNotified,
  opportunityEvidenceSince,pruneRetention,recordNotificationDelivery,recordObservation,
  reserveNotification,saveIncident} from './persistence/repository.mjs';

export const WATCHDOG_RUN_VERSION='data-ops-a1.4-watchdog-v2';

export class WatchdogExecutionError extends Error{
  constructor(code){super(code);this.name='WatchdogExecutionError';this.code=code;}
}
const fail=code=>{throw new WatchdogExecutionError(code);};

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
    const summaryAttempted=index===0&&(run.jobHealth==='SUCCESS'||run.jobHealth==='FAILED');
    const classified=classifyObserverRun({jobHealth:run.jobHealth,summaryAttempted,summary:run.summary});
    const eventType=run.event==='schedule'||run.event==='workflow_dispatch'?run.event:'unknown';
    const observationId=await hashId('obs',{workflowRunId:run.id,healthState:classified.healthState},cryptoImpl);
    const evidenceHash=await sha256Hex(stableStringify({workflowRunId:run.id,eventType,
      healthState:classified.healthState,reasonCode:classified.reasonCode,headSha:run.headSha}),cryptoImpl);
    await recordObservation(db,{observationId,sourceKind:eventType==='schedule'?'scheduled_run':'manual_run',
      eventType,workflowRunId:run.id,runAttempt:run.runAttempt,observedAt:nowIso,runCreatedAt:run.createdAt,
      runCompletedAt:run.jobCompletedAt,headSha:run.headSha,healthState:classified.healthState,
      reasonCode:classified.reasonCode,evidenceHash,createdAt:nowIso});
  }
}

// The schedule-aware heartbeat evaluation, bootstrap-clamped. Reads durable D1 state
// (`ensureBootstrap`, `opportunityEvidenceSince`) rather than only this cycle's own GitHub read,
// which is what lets heartbeat detection survive a transient GitHub-unavailable cycle.
async function evaluateHeartbeat(db,now,nowIso){
  const bootstrapIso=await ensureBootstrap(db,nowIso);
  const bootstrapAt=Date.parse(bootstrapIso);
  const opportunityAt=latestExpectedOpportunity({now,bootstrapAt});
  let evidenceRow=null;
  if(opportunityAt!==null)evidenceRow=await opportunityEvidenceSince(db,at(opportunityAt));
  const opportunityEvidence=evidenceRow===null?null:
    {healthState:evidenceRow.healthState,createdAt:evidenceRow.createdAt};
  const heartbeat=classifyHeartbeat({opportunityAt,opportunityEvidence,now});
  return {heartbeat,evidenceRow};
}

// Reserves, builds and attempts delivery of exactly one notification for one lifecycle
// transition. The D1 unique constraint on `idempotencyKey` is the actual idempotency primitive:
// a reservation that affects zero rows means an equivalent decision over this exact evidence was
// already made (by this same cycle running again, a retry, or duplicate Cron delivery), and no
// second email is ever attempted for it. A transport failure is recorded truthfully as `FAILED`
// and never propagated as a fatal execution error — it is expected, self-heals on the next cycle
// (see `decideNotification`'s reminder policy) and must never cause an alert storm of retries.
async function deliverNotification(deps,identity,incident,notificationTransition,nowIso){
  const {db,email,EmailMessageCtor,cryptoImpl}=deps;
  const idempotencyKey=await hashId('notif',
    {fingerprint:identity.fingerprint,notificationTransition,evidenceObservedAt:nowIso},cryptoImpl);
  const reservation=await reserveNotification(db,{idempotencyKey,fingerprint:identity.fingerprint,
    transition:notificationTransition,decidedAt:nowIso,
    evidenceObservationId:incident.evidenceRef?.observationId??null,createdAt:nowIso});
  if(!reservation.reserved)return false;
  const evidenceRef=incident.evidenceRef;
  const message=buildNotificationMessage({fingerprint:identity.fingerprint,
    transition:notificationTransition,problemClass:identity.problemClass,component:identity.component,
    reasonCode:incident.reasonCode,lastKnownHealthyOrScheduledAt:evidenceRef?.observedAt??null,
    ageMs:evidenceRef?.observedAt?Date.parse(nowIso)-Date.parse(evidenceRef.observedAt):null,
    workflowRunId:evidenceRef?.workflowRunId??null,headSha:evidenceRef?.headSha??null,
    occurrenceCount:incident.occurrenceCount,reopenedCount:incident.reopenedCount});
  let delivery;
  try{
    delivery=await sendOwnerNotification({binding:email,subject:message.subject,body:message.body,
      EmailMessageCtor});
  }catch{delivery=Object.freeze({delivered:false});}
  await recordNotificationDelivery(db,idempotencyKey,delivery.delivered?'SENT':'FAILED',nowIso);
  if(delivery.delivered)await markIncidentNotified(db,identity.fingerprint,nowIso);
  return delivery.delivered;
}

// One problem's whole cycle: identity, replay-safe lifecycle reduction, persistence (with real
// evidence provenance), and — only on a notification-worthy transition — the notification
// decision and delivery attempt.
async function evaluateProblem(deps,problemKey,{active,reasonCode,nowIso,evidenceRef}){
  const {db,cryptoImpl}=deps;
  const identity=await incidentFingerprint(problemKey,{cryptoImpl});
  const previous=await getIncident(db,identity.fingerprint);
  const {transition,next}=reduceIncidentLifecycle({fingerprint:identity.fingerprint,previous,
    evaluation:{active,reasonCode:active?reasonCode:null,evidenceObservedAt:nowIso,now:nowIso,
      evidenceRef:evidenceRef??null}});
  if(transition===TRANSITION_NONE)return deepFreeze({transition,notified:false});
  await saveIncident(db,{problemClass:identity.problemClass,component:identity.component,next,
    updatedAt:nowIso});
  const decision=decideNotification({transition,lastNotifiedAt:previous?.lastNotifiedAt??null,
    now:Date.parse(nowIso)});
  const notified=decision.shouldNotify
    ?await deliverNotification(deps,identity,next,decision.notificationTransition,nowIso)
    :false;
  return deepFreeze({transition,notified});
}

export async function runWatchdogCycle({env,fetchImpl=globalThis.fetch,now=Date.now(),
  scheduledTime=now,cryptoImpl=globalThis.crypto,EmailMessageCtor}={}){
  const resolved=resolveWatchdogEnvironment(env);
  if(!resolved.ok)fail(ENVIRONMENT_INCOMPLETE);
  const nowIso=at(now);

  // The single-writer claim, first, before any other work. A lost claim means another execution
  // of this exact logical Cron firing is already handling it (true concurrency, a retried
  // delivery, or a re-fired event) — this execution does nothing further and resolves normally.
  const claim=await claimScheduledEvent(resolved.db,at(scheduledTime),nowIso);
  if(!claim.claimed){
    return deepFreeze({ok:true,version:WATCHDOG_RUN_VERSION,duplicate:true,
      reasonCode:'WATCHDOG_DUPLICATE_SCHEDULED_EVENT'});
  }

  const deps=Object.freeze({db:resolved.db,email:resolved.email,EmailMessageCtor,cryptoImpl});

  const evidence=await readObserverEvidence({token:resolved.githubToken,fetchImpl,now});
  await recordEvidence(resolved.db,evidence,nowIso,cryptoImpl);

  const {heartbeat,evidenceRow}=await evaluateHeartbeat(resolved.db,now,nowIso);
  const heartbeatEvidenceRef=evidenceRow===null?null:deepFreeze({
    observationId:evidenceRow.observationId,workflowRunId:evidenceRow.workflowRunId,
    runAttempt:evidenceRow.runAttempt,headSha:evidenceRow.headSha,
    observedAt:evidenceRow.completedAt??new Date(evidenceRow.createdAt).toISOString()});

  const heartbeatResult=await evaluateProblem(deps,'OBSERVER_HEARTBEAT',
    {active:heartbeat.active,reasonCode:heartbeat.reasonCode,nowIso,evidenceRef:heartbeatEvidenceRef});
  const evidenceResult=await evaluateProblem(deps,'GITHUB_EVIDENCE',
    {active:!evidence.ok,reasonCode:evidence.ok?null:evidence.reasonCode,nowIso,evidenceRef:null});

  await pruneRetention(resolved.db,now);

  return deepFreeze({ok:true,version:WATCHDOG_RUN_VERSION,now:nowIso,duplicate:false,
    githubEvidenceOk:evidence.ok,
    heartbeat:Object.freeze({state:heartbeat.state,reasonCode:heartbeat.reasonCode,
      opportunityAt:heartbeat.opportunityAt}),
    incidents:Object.freeze({
      observerHeartbeat:Object.freeze({transition:heartbeatResult.transition,notified:heartbeatResult.notified}),
      githubEvidence:Object.freeze({transition:evidenceResult.transition,notified:evidenceResult.notified})})});
}
