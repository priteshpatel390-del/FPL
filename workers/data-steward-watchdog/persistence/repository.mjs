// DATA-OPS-A1.4 — the watchdog's only D1 access surface.
//
// Every exported function here does exactly one thing: bind a fixed statement from
// `statements.mjs` and run it against the native D1 binding the Worker holds. Nothing in this
// module accepts a table name, a column name or SQL text from a caller, and every statement
// passes through `assertAllowedStatement()` before it is prepared, so a query outside the
// declared allowlist can never execute even if a future edit tried to add one inline.
//
// This is the isolated steward-only database. It has no relationship to production Official FPL
// D1, the evidence archive D1 or any other Teamsheet data store, and no other package imports
// this module.
//
// EVERY FUNCTION HERE THROWS ON A REAL D1 FAILURE. None of them swallow an exception into a
// quiet default — a D1 error is a genuine watchdog-runtime failure, and it is the caller's job
// (`run-watchdog.mjs`) to let that propagate all the way out of the Worker's `scheduled` handler
// so Cloudflare records the Cron invocation as failed, never as a silent success.
import {deepFreeze} from '../lib/canonical.mjs';
import {assertAllowedStatement,CLAIM_SCHEDULED_EVENT,INSERT_BOOTSTRAP,INSERT_NOTIFICATION,
  INSERT_OBSERVATION,PRUNE_INCIDENTS,PRUNE_NOTIFICATIONS,PRUNE_OBSERVATIONS,SELECT_BOOTSTRAP,
  SELECT_INCIDENT,SELECT_LATEST_SCHEDULED_SINCE,UPDATE_INCIDENT_LAST_NOTIFIED,
  INSERT_OPPORTUNITY_ATTRIBUTION,SELECT_RUN_OPPORTUNITY,SELECT_OPPORTUNITY_OWNER,SELECT_FAILED_NOTIFICATION,
  UPDATE_NOTIFICATION_DELIVERY,UPSERT_INCIDENT} from './statements.mjs';

export const RETENTION_OBSERVATIONS_MS=45*24*60*60*1000;
export const RETENTION_INCIDENTS_MS=365*24*60*60*1000;
export const RETENTION_NOTIFICATIONS_MS=90*24*60*60*1000;

export class RepositoryError extends Error{
  constructor(code){super(code);this.name='RepositoryError';this.code=code;}
}
const fail=code=>{throw new RepositoryError(code);};

function run(db,sql,args){
  assertAllowedStatement(sql);
  return db.prepare(sql).bind(...args).run();
}
function first(db,sql,args){
  assertAllowedStatement(sql);
  return db.prepare(sql).bind(...args).first();
}

// The single-writer claim. Returns `{claimed:true}` for exactly one execution of a given
// `scheduledTime`; every other concurrent or later attempt over the same value gets
// `{claimed:false}` and must do no further work — no GitHub read, no lifecycle mutation, no
// notification. This is the sole enforcement point; there is no separate check-then-set anywhere
// else in the package.
export async function claimScheduledEvent(db,scheduledTimeIso,claimedAtIso){
  let result;
  try{result=await run(db,CLAIM_SCHEDULED_EVENT,[scheduledTimeIso,claimedAtIso]);}
  catch{fail('watchdog_claim_write_failed');}
  if(!result?.success)fail('watchdog_claim_write_failed');
  return Object.freeze({claimed:(result.meta?.changes??0)>0});
}

// The bootstrap instant is set once, on the very first cycle ever to run against this database,
// and read back unchanged on every later cycle. It is what stops a freshly deployed watchdog from
// retroactively judging opportunities that occurred before it ever executed.
export async function ensureBootstrap(db,nowIso){
  let inserted;
  try{inserted=await run(db,INSERT_BOOTSTRAP,[nowIso]);}
  catch{fail('watchdog_bootstrap_write_failed');}
  if(!inserted?.success)fail('watchdog_bootstrap_write_failed');
  if((inserted.meta?.changes??0)>0)return nowIso;
  let row;
  try{row=await first(db,SELECT_BOOTSTRAP,[]);}
  catch{fail('watchdog_bootstrap_read_failed');}
  if(typeof row?.bootstrapped_at!=='string')fail('watchdog_bootstrap_read_failed');
  return row.bootstrapped_at;
}

// Inserts one bounded observation row. `ON CONFLICT ... DO NOTHING` makes this idempotent: the
// same GitHub run observed again by a retry, a duplicate Cron delivery, or a re-run of the same
// cycle produces exactly one stored row, never a duplicate.
export async function recordObservation(db,observation){
  let result;
  try{
    result=await run(db,INSERT_OBSERVATION,[observation.observationId,observation.sourceKind,
      observation.eventType,observation.workflowRunId,observation.runAttempt,observation.observedAt,
      observation.runCreatedAt,observation.runCompletedAt,observation.opportunityAt,
      observation.headSha,
      observation.healthState,observation.reasonCode,observation.evidenceHash,observation.createdAt]);
  }catch{fail('watchdog_observation_write_failed');}
  if(!result?.success)fail('watchdog_observation_write_failed');
  return Object.freeze({inserted:(result.meta?.changes??0)>0});
}

// The decisive evidence row for one expected opportunity: the freshest scheduled observation
// created at or after `opportunityAtIso`, or `null` if none exists yet. This is a durable D1 read,
// independent of whether this cycle's own GitHub read succeeded — which is what lets heartbeat
// detection survive a transient GitHub-unavailable cycle using history from an earlier one.
export async function opportunityEvidenceSince(db,opportunityAtIso){
  let row;
  try{row=await first(db,SELECT_LATEST_SCHEDULED_SINCE,[opportunityAtIso]);}
  catch{fail('watchdog_opportunity_read_failed');}
  if(row===null||row===undefined)return null;
  return Object.freeze({observationId:row.observation_id,healthState:row.health_state,
    createdAt:Date.parse(row.run_created_at),completedAt:row.run_completed_at??null,
    workflowRunId:row.workflow_run_id??null,runAttempt:row.run_attempt??null,
    headSha:row.head_sha??null,observedAt:row.observed_at,opportunityAt:row.opportunity_at});
}

export async function getAssignedOpportunity(db,workflowRunId){
  let existing;
  try{existing=await first(db,SELECT_RUN_OPPORTUNITY,[workflowRunId]);}
  catch{fail('watchdog_opportunity_read_failed');}
  return typeof existing?.opportunity_at==='string'?existing.opportunity_at:null;
}

export async function getOpportunityOwner(db,opportunityAt){
  let row;
  try{row=await first(db,SELECT_OPPORTUNITY_OWNER,[opportunityAt]);}
  catch{fail('watchdog_opportunity_read_failed');}
  return Number.isSafeInteger(row?.workflow_run_id)?row.workflow_run_id:null;
}

// Persists one already-resolved pair. A conflict is never resolved here by trying another
// opportunity: matching happened before this call. The authoritative ledger is re-read so a
// concurrent winner for this same workflow run can be reconciled, otherwise the caller fails
// closed on the unresolved conflict.
export async function persistOpportunityAttribution(db,{workflowRunId,runAttempt,opportunityAt,
  attributedAt}){
  let result;
  try{result=await run(db,INSERT_OPPORTUNITY_ATTRIBUTION,
    [opportunityAt,workflowRunId,runAttempt,attributedAt]);}
  catch{fail('watchdog_opportunity_write_failed');}
  if(!result?.success)fail('watchdog_opportunity_write_failed');
  const persisted=await getAssignedOpportunity(db,workflowRunId);
  return Object.freeze({assigned:persisted===opportunityAt,opportunityAt:persisted,
    conflict:persisted!==opportunityAt});
}

const incidentFromRow=row=>row===null||row===undefined?null:deepFreeze({
  fingerprint:row.fingerprint,problemClass:row.problem_class,component:row.component,
  lifecycleState:row.lifecycle_state,reasonCode:row.reason_code,firstSeenAt:row.first_seen_at,
  lastSeenAt:row.last_seen_at,recoveredAt:row.recovered_at??null,
  occurrenceCount:row.occurrence_count,reopenedCount:row.reopened_count,
  lastEvidenceObservedAt:row.last_evidence_observed_at,
  evidenceRef:row.evidence_observation_id===null||row.evidence_observation_id===undefined?null:
    deepFreeze({observationId:row.evidence_observation_id,
      workflowRunId:row.evidence_workflow_run_id??null,runAttempt:row.evidence_run_attempt??null,
      headSha:row.evidence_head_sha??null,observedAt:row.evidence_source_at}),
  lastNotifiedAt:row.last_notified_at??null});

export async function getIncident(db,fingerprint){
  let row;
  try{row=await first(db,SELECT_INCIDENT,[fingerprint]);}
  catch{fail('watchdog_incident_read_failed');}
  return incidentFromRow(row);
}

// Persists the lifecycle reducer's `next` state, including its real evidence pointer. This is the
// ONLY write path into `watchdog_incidents`, so the reducer's replay/ordering guarantees, and now
// its genuine provenance, are exactly what ends up durable.
export async function saveIncident(db,{problemClass,component,next,updatedAt}){
  const evidenceRef=next.evidenceRef??null;
  let result;
  try{
    result=await run(db,UPSERT_INCIDENT,[next.fingerprint,problemClass,component,
      next.lifecycleState,next.reasonCode,next.firstSeenAt,next.lastSeenAt,next.recoveredAt,
      next.occurrenceCount,next.reopenedCount,next.lastEvidenceObservedAt,
      evidenceRef?.observationId??null,evidenceRef?.workflowRunId??null,
      evidenceRef?.runAttempt??null,evidenceRef?.headSha??null,evidenceRef?.observedAt??null,
      updatedAt]);
  }catch{fail('watchdog_incident_write_failed');}
  if(!result?.success)fail('watchdog_incident_write_failed');
}

export async function markIncidentNotified(db,fingerprint,notifiedAt){
  let result;
  try{result=await run(db,UPDATE_INCIDENT_LAST_NOTIFIED,[notifiedAt,fingerprint]);}
  catch{fail('watchdog_incident_write_failed');}
  if(!result?.success)fail('watchdog_incident_write_failed');
}

// Idempotent notification reservation. The `idempotencyKey` carries a UNIQUE constraint in the
// schema; a conflicting insert affects zero rows, and that zero — never an exception, never a
// second email — is exactly how a duplicate decision (a retry, a replayed cycle, a duplicate Cron
// delivery) is told apart from a genuinely new one that should be delivered.
export async function reserveNotification(db,{idempotencyKey,fingerprint,transition,decidedAt,
  evidenceObservationId,evidenceObservedAt,createdAt}){
  let result;
  try{
    result=await run(db,INSERT_NOTIFICATION,[idempotencyKey,fingerprint,transition,decidedAt,
      evidenceObservationId??null,evidenceObservedAt,createdAt]);
  }catch{fail('watchdog_notification_write_failed');}
  if(!result?.success)fail('watchdog_notification_write_failed');
  return Object.freeze({reserved:(result.meta?.changes??0)>0});
}

export async function recordNotificationDelivery(db,idempotencyKey,status,deliveredAt){
  if(!['SENT','FAILED'].includes(status))fail('watchdog_notification_status_invalid');
  let result;
  try{result=await run(db,UPDATE_NOTIFICATION_DELIVERY,[status,deliveredAt,idempotencyKey]);}
  catch{fail('watchdog_notification_write_failed');}
  if(!result?.success)fail('watchdog_notification_write_failed');
}

export async function getFailedNotification(db,fingerprint){
  let row;
  try{row=await first(db,SELECT_FAILED_NOTIFICATION,[fingerprint]);}
  catch{fail('watchdog_notification_read_failed');}
  if(row===null||row===undefined)return null;
  return Object.freeze({idempotencyKey:row.idempotency_key,transition:row.transition,
    evidenceObservationId:row.evidence_observation_id??null,evidenceObservedAt:row.evidence_observed_at});
}

// Bounded, deterministic pruning. Observations feeding an ACTIVE incident's evidence pointer are
// excluded from their own cutoff so an open incident can never be pruned out from under itself.
export async function pruneRetention(db,now){
  const cut=ms=>new Date(now-ms).toISOString();
  const results={};
  try{
    results.observations=(await run(db,PRUNE_OBSERVATIONS,[cut(RETENTION_OBSERVATIONS_MS)])).meta?.changes??0;
    results.incidents=(await run(db,PRUNE_INCIDENTS,[cut(RETENTION_INCIDENTS_MS)])).meta?.changes??0;
    results.notifications=(await run(db,PRUNE_NOTIFICATIONS,[cut(RETENTION_NOTIFICATIONS_MS)])).meta?.changes??0;
  }catch{fail('watchdog_retention_prune_failed');}
  return deepFreeze(results);
}
