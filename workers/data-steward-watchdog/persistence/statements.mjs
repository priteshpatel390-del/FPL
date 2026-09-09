// DATA-OPS-A1.4 — the whole allowlisted SQL surface of the watchdog D1 database.
//
// Every statement the watchdog can ever issue is a fixed string literal in this module, bound
// with `?` placeholders and nothing else. There is no string concatenation, no template
// interpolation of a caller-supplied value into SQL text, and no function anywhere in this
// package that accepts raw SQL from a caller. `assertAllowedStatement()` is a second, structural
// line of defence: it checks that the exact string about to run is one of the frozen statements
// declared here, by reference equality against this file's own exports, so a future edit cannot
// quietly add an unreviewed query without also being caught by the permanent test that walks this
// allowlist.
import {deepFreeze} from '../lib/canonical.mjs';

// Single-writer scheduled-event claim: the whole enforcement mechanism is this one atomic insert.
// `scheduled_time` is `controller.scheduledTime` (formatted as ISO-8601), the exact logical
// identity of one Cron firing, so two concurrent invocations of the SAME firing race this one
// statement; exactly one affects a row.
export const CLAIM_SCHEDULED_EVENT=
  `INSERT INTO watchdog_scheduled_claims (scheduled_time,claimed_at) VALUES (?,?)
   ON CONFLICT(scheduled_time) DO NOTHING`;

export const SELECT_BOOTSTRAP=`SELECT bootstrapped_at FROM watchdog_bootstrap WHERE id=1`;
export const INSERT_BOOTSTRAP=
  `INSERT INTO watchdog_bootstrap (id,bootstrapped_at) VALUES (1,?) ON CONFLICT(id) DO NOTHING`;

export const INSERT_OBSERVATION=
  `INSERT INTO watchdog_observations
     (observation_id,source_kind,event_type,workflow_run_id,run_attempt,observed_at,
      run_created_at,run_completed_at,opportunity_at,head_sha,health_state,reason_code,evidence_hash,created_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
   ON CONFLICT(observation_id) DO NOTHING`;

// The single most recent scheduled observation created at or after one opportunity instant. Under
// the expected-opportunity model this row is unambiguous evidence for exactly that opportunity,
// because by construction nothing else was scheduled between the opportunity and `now`.
export const SELECT_LATEST_SCHEDULED_SINCE=
  `SELECT observation_id,health_state,run_created_at,run_completed_at,workflow_run_id,run_attempt,
      head_sha,observed_at,opportunity_at
   FROM watchdog_observations
   WHERE event_type='schedule' AND opportunity_at=?
   ORDER BY run_attempt DESC,
     CASE health_state WHEN 'IN_FLIGHT' THEN 0 ELSE 1 END DESC,
     COALESCE(run_completed_at,observed_at) DESC, observed_at DESC, observation_id DESC LIMIT 1`;

export const SELECT_RUN_OPPORTUNITY=
  `SELECT opportunity_at FROM watchdog_opportunity_attributions
   WHERE workflow_run_id=?`;
export const SELECT_OPPORTUNITY_OWNER=
  `SELECT workflow_run_id FROM watchdog_opportunity_attributions WHERE opportunity_at=?`;
export const INSERT_OPPORTUNITY_ATTRIBUTION=
  `INSERT INTO watchdog_opportunity_attributions
     (opportunity_at,workflow_run_id,run_attempt,attributed_at) VALUES (?,?,?,?)
   ON CONFLICT DO NOTHING`;

export const SELECT_INCIDENT=
  `SELECT fingerprint,problem_class,component,lifecycle_state,reason_code,first_seen_at,
      last_seen_at,recovered_at,occurrence_count,reopened_count,last_evidence_observed_at,
      evidence_observation_id,evidence_workflow_run_id,evidence_run_attempt,evidence_head_sha,
      evidence_source_at,last_notified_at
   FROM watchdog_incidents WHERE fingerprint=?`;

export const UPSERT_INCIDENT=
  `INSERT INTO watchdog_incidents
     (fingerprint,problem_class,component,lifecycle_state,reason_code,first_seen_at,last_seen_at,
      recovered_at,occurrence_count,reopened_count,last_evidence_observed_at,
      evidence_observation_id,evidence_workflow_run_id,evidence_run_attempt,evidence_head_sha,
      evidence_source_at,last_notified_at,updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
   ON CONFLICT(fingerprint) DO UPDATE SET
     lifecycle_state=excluded.lifecycle_state,
     reason_code=excluded.reason_code,
     last_seen_at=excluded.last_seen_at,
     recovered_at=excluded.recovered_at,
     occurrence_count=excluded.occurrence_count,
     reopened_count=excluded.reopened_count,
     last_evidence_observed_at=excluded.last_evidence_observed_at,
     evidence_observation_id=excluded.evidence_observation_id,
     evidence_workflow_run_id=excluded.evidence_workflow_run_id,
     evidence_run_attempt=excluded.evidence_run_attempt,
     evidence_head_sha=excluded.evidence_head_sha,
     evidence_source_at=excluded.evidence_source_at,
     updated_at=excluded.updated_at`;

export const UPDATE_INCIDENT_LAST_NOTIFIED=
  `UPDATE watchdog_incidents SET last_notified_at=? WHERE fingerprint=?`;

export const INSERT_NOTIFICATION=
  `INSERT INTO watchdog_notifications
     (idempotency_key,fingerprint,transition,decided_at,evidence_observation_id,evidence_observed_at,delivery_status,
      delivered_at,created_at)
   VALUES (?,?,?,?,?,?,'PENDING',NULL,?)
   ON CONFLICT(idempotency_key) DO NOTHING`;

export const UPDATE_NOTIFICATION_DELIVERY=
  `UPDATE watchdog_notifications SET delivery_status=?,delivered_at=? WHERE idempotency_key=?`;
export const SELECT_FAILED_NOTIFICATION=
  `SELECT idempotency_key,transition,evidence_observation_id,evidence_observed_at FROM watchdog_notifications
   WHERE fingerprint=? AND delivery_status='FAILED'
   ORDER BY decided_at DESC,idempotency_key DESC LIMIT 1`;

export const PRUNE_OBSERVATIONS=
  `DELETE FROM watchdog_observations
   WHERE observed_at<? AND observation_id NOT IN (
     SELECT evidence_observation_id FROM watchdog_incidents
     WHERE lifecycle_state='ACTIVE' AND evidence_observation_id IS NOT NULL)`;

export const PRUNE_INCIDENTS=
  `DELETE FROM watchdog_incidents WHERE lifecycle_state='RECOVERED' AND recovered_at<?`;

export const PRUNE_NOTIFICATIONS=`DELETE FROM watchdog_notifications WHERE decided_at<?`;

export const ALLOWED_STATEMENTS=deepFreeze([CLAIM_SCHEDULED_EVENT,SELECT_BOOTSTRAP,INSERT_BOOTSTRAP,
  INSERT_OBSERVATION,SELECT_LATEST_SCHEDULED_SINCE,SELECT_RUN_OPPORTUNITY,SELECT_OPPORTUNITY_OWNER,
  INSERT_OPPORTUNITY_ATTRIBUTION,SELECT_INCIDENT,UPSERT_INCIDENT,
  UPDATE_INCIDENT_LAST_NOTIFIED,INSERT_NOTIFICATION,UPDATE_NOTIFICATION_DELIVERY,PRUNE_OBSERVATIONS,
  SELECT_FAILED_NOTIFICATION,PRUNE_INCIDENTS,PRUNE_NOTIFICATIONS]);

export class StatementNotAllowedError extends Error{
  constructor(){super('watchdog_sql_not_allowlisted');this.name='StatementNotAllowedError';
    this.code='watchdog_sql_not_allowlisted';}
}

export function assertAllowedStatement(sql){
  if(!ALLOWED_STATEMENTS.includes(sql))throw new StatementNotAllowedError();
  return sql;
}
