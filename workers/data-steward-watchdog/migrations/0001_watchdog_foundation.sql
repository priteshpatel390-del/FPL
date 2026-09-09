-- DATA-OPS-A1.4 — isolated Data Steward Watchdog D1 foundation.
--
-- This database is exclusively the watchdog's own operational state: bounded observation
-- history, incident lifecycle, notification delivery/deduplication records, the single-writer
-- scheduled-event claim ledger and the one-row bootstrap marker. It holds no Official FPL data,
-- no application/model data and no production collection history, and nothing outside
-- `workers/data-steward-watchdog/` ever reads or writes it. This schema has never been applied to
-- a live database — see docs/DATA-OPS-A1-4-WATCHDOG-LIFECYCLE.md for the live-provisioning gate.

CREATE TABLE watchdog_bootstrap (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  bootstrapped_at TEXT NOT NULL
);

-- Enforces the single-writer claim on one logical Cron firing, identified by
-- `controller.scheduledTime` (an exact millisecond instant, formatted here as an ISO-8601
-- string). Exactly one execution of a given scheduled event can ever insert its own row; every
-- other concurrent or later attempt over the same scheduled_time affects zero rows and is a safe,
-- side-effect-free duplicate.
CREATE TABLE watchdog_scheduled_claims (
  scheduled_time TEXT PRIMARY KEY,
  claimed_at TEXT NOT NULL
);

CREATE TABLE watchdog_observations (
  observation_id TEXT PRIMARY KEY,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('scheduled_run','manual_run','read_failure')),
  event_type TEXT NOT NULL CHECK (event_type IN ('schedule','workflow_dispatch','unknown')),
  workflow_run_id INTEGER,
  run_attempt INTEGER,
  observed_at TEXT NOT NULL,
  run_created_at TEXT,
  run_completed_at TEXT,
  head_sha TEXT,
  health_state TEXT NOT NULL CHECK (health_state IN
    ('SUCCESS','NOT_EVALUATED_OK','FAILED','SKIPPED','IN_FLIGHT','SUMMARY_INVALID',
     'SUMMARY_UNHEALTHY','SUMMARY_CONTRADICTORY','UNCLASSIFIED','READ_FAILURE')),
  reason_code TEXT NOT NULL,
  evidence_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_watchdog_observations_observed_at ON watchdog_observations(observed_at);
CREATE INDEX idx_watchdog_observations_schedule_lookup
  ON watchdog_observations(event_type, run_created_at);

CREATE TABLE watchdog_incidents (
  fingerprint TEXT PRIMARY KEY,
  problem_class TEXT NOT NULL,
  component TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL CHECK (lifecycle_state IN ('ACTIVE','RECOVERED')),
  reason_code TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  recovered_at TEXT,
  occurrence_count INTEGER NOT NULL DEFAULT 0,
  reopened_count INTEGER NOT NULL DEFAULT 0,
  -- The watchdog cycle's own clock reading that produced this row. Used only for the reducer's
  -- monotonic replay guard; it is never shown to the owner.
  last_evidence_observed_at TEXT NOT NULL,
  -- Real, bounded, sanitized provenance for the evidence that decided this row — never a
  -- placeholder. `evidence_source_at` is the underlying observation's own timestamp (e.g. a run's
  -- completion instant), distinct from `last_evidence_observed_at` above.
  evidence_observation_id TEXT,
  evidence_workflow_run_id INTEGER,
  evidence_run_attempt INTEGER,
  evidence_head_sha TEXT,
  evidence_source_at TEXT,
  last_notified_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_watchdog_incidents_lifecycle_state ON watchdog_incidents(lifecycle_state);
CREATE INDEX idx_watchdog_incidents_recovered_at ON watchdog_incidents(recovered_at);

CREATE TABLE watchdog_notifications (
  idempotency_key TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  transition TEXT NOT NULL CHECK (transition IN ('NEW','CHANGED','RECOVERED','REOPENED','REMINDER')),
  decided_at TEXT NOT NULL,
  evidence_observation_id TEXT,
  delivery_status TEXT NOT NULL CHECK (delivery_status IN ('PENDING','SENT','FAILED')),
  delivered_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_watchdog_notifications_fingerprint ON watchdog_notifications(fingerprint);
CREATE INDEX idx_watchdog_notifications_decided_at ON watchdog_notifications(decided_at);
