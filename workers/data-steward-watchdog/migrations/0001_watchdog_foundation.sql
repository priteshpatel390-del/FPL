-- DATA-OPS-A1.4 — isolated Data Steward Watchdog D1 foundation.
--
-- This database is exclusively the watchdog's own operational state: bounded observation
-- history, incident lifecycle and notification delivery/deduplication records. It holds no
-- Official FPL data, no application/model data and no production collection history, and nothing
-- outside `workers/data-steward-watchdog/` ever reads or writes it.

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
    ('SUCCESS','FAILED','SKIPPED','IN_FLIGHT','UNCLASSIFIED','READ_FAILURE')),
  reason_code TEXT NOT NULL,
  evidence_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_watchdog_observations_observed_at ON watchdog_observations(observed_at);
CREATE INDEX idx_watchdog_observations_success_lookup
  ON watchdog_observations(event_type, health_state, run_completed_at);

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
  last_evidence_observed_at TEXT NOT NULL,
  last_evidence_observation_id TEXT,
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
