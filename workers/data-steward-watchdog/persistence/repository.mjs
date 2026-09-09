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
import {deepFreeze} from '../../../src/decision-intelligence/canonical.mjs';
import {assertAllowedStatement,INSERT_NOTIFICATION,INSERT_OBSERVATION,PRUNE_INCIDENTS,
  PRUNE_NOTIFICATIONS,PRUNE_OBSERVATIONS,SELECT_INCIDENT,SELECT_LAST_SCHEDULED_SUCCESS,
  UPDATE_INCIDENT_LAST_NOTIFIED,UPDATE_NOTIFICATION_DELIVERY,UPSERT_INCIDENT} from './statements.mjs';

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

// Inserts one bounded observation row. `ON CONFLICT ... DO NOTHING` makes this idempotent: the
// same GitHub run observed again by a retry, a duplicate Cron delivery, or a re-run of the same
// cycle produces exactly one stored row, never a duplicate.
export async function recordObservation(db,observation){
  let result;
  try{
    result=await run(db,INSERT_OBSERVATION,[observation.observationId,observation.sourceKind,
      observation.eventType,observation.workflowRunId,observation.runAttempt,observation.observedAt,
      observation.runCreatedAt,observation.runCompletedAt,observation.headSha,
      observation.healthState,observation.reasonCode,observation.evidenceHash,observation.createdAt]);
  }catch{fail('watchdog_observation_write_failed');}
  if(!result?.success)fail('watchdog_observation_write_failed');
  return Object.freeze({inserted:(result.meta?.changes??0)>0});
}

// The durable freshness fact the heartbeat classifier reads: the most recent SUCCESS among
// SCHEDULED observations ever recorded, whether or not this cycle's own GitHub read succeeded.
// That is what makes heartbeat detection independent of any single cycle's GitHub reachability.
export async function lastScheduledSuccessAt(db){
  let row;
  try{row=await first(db,SELECT_LAST_SCHEDULED_SUCCESS,[]);}
  catch{fail('watchdog_heartbeat_read_failed');}
  const value=row?.last_success_at;
  return typeof value==='string'&&value!==''?value:null;
}

const incidentFromRow=row=>row===null||row===undefined?null:deepFreeze({
  fingerprint:row.fingerprint,problemClass:row.problem_class,component:row.component,
  lifecycleState:row.lifecycle_state,reasonCode:row.reason_code,firstSeenAt:row.first_seen_at,
  lastSeenAt:row.last_seen_at,recoveredAt:row.recovered_at??null,
  occurrenceCount:row.occurrence_count,reopenedCount:row.reopened_count,
  lastEvidenceObservedAt:row.last_evidence_observed_at,
  lastEvidenceObservationId:row.last_evidence_observation_id??null,
  lastNotifiedAt:row.last_notified_at??null});

export async function getIncident(db,fingerprint){
  let row;
  try{row=await first(db,SELECT_INCIDENT,[fingerprint]);}
  catch{fail('watchdog_incident_read_failed');}
  return incidentFromRow(row);
}

// Persists the lifecycle reducer's `next` state. This is the ONLY write path into
// `watchdog_incidents`, so the reducer's replay/ordering guarantees are exactly what ends up
// durable — the repository adds no independent business logic of its own.
export async function saveIncident(db,{problemClass,component,next,evidenceObservationId,updatedAt}){
  let result;
  try{
    result=await run(db,UPSERT_INCIDENT,[next.fingerprint,problemClass,component,
      next.lifecycleState,next.reasonCode,next.firstSeenAt,next.lastSeenAt,next.recoveredAt,
      next.occurrenceCount,next.reopenedCount,next.lastEvidenceObservedAt,
      evidenceObservationId??null,null,updatedAt]);
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
  evidenceObservationId,createdAt}){
  let result;
  try{
    result=await run(db,INSERT_NOTIFICATION,[idempotencyKey,fingerprint,transition,decidedAt,
      evidenceObservationId??null,createdAt]);
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
