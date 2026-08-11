PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL
);

INSERT OR IGNORE INTO schema_migrations(version,name,applied_at)
VALUES (1,'gw1-p1-cloudflare-evidence-foundation',CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS evidence_records (
  content_hash TEXT PRIMARY KEY CHECK(length(content_hash)=64),
  record_type TEXT NOT NULL CHECK(record_type='preDeadlineSnapshot'),
  stage10_record_id TEXT NOT NULL UNIQUE,
  schema_version TEXT NOT NULL,
  season TEXT NOT NULL,
  gameweek INTEGER NOT NULL CHECK(gameweek BETWEEN 1 AND 38),
  logical_key TEXT NOT NULL,
  deadline_time TEXT NOT NULL,
  capture_completed_at TEXT NOT NULL,
  origin TEXT NOT NULL CHECK(origin='local_capture'),
  timing_grade TEXT NOT NULL CHECK(timing_grade IN ('network_attested','client_recorded','clock_conflict','late')),
  client_official_eligible INTEGER NOT NULL CHECK(client_official_eligible IN (0,1)),
  server_predeadline_received INTEGER NOT NULL CHECK(server_predeadline_received IN (0,1)),
  build_commit TEXT NOT NULL,
  build_source_hash TEXT NOT NULL,
  model_version TEXT NOT NULL,
  rules_version TEXT NOT NULL,
  simulation_version TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  r2_uploaded_at TEXT NOT NULL,
  canonical_bytes INTEGER NOT NULL CHECK(canonical_bytes > 0),
  stored_bytes INTEGER NOT NULL CHECK(stored_bytes > 0),
  stored_sha256 TEXT NOT NULL CHECK(length(stored_sha256)=64),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS evidence_records_season_gw
  ON evidence_records(season,gameweek,record_type);
CREATE INDEX IF NOT EXISTS evidence_records_uploaded
  ON evidence_records(r2_uploaded_at);

CREATE TABLE IF NOT EXISTS ingest_receipts (
  idempotency_key TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  received_at TEXT NOT NULL,
  result TEXT NOT NULL CHECK(result IN ('accepted')),
  subject_hash TEXT NOT NULL CHECK(length(subject_hash)=64),
  FOREIGN KEY(content_hash) REFERENCES evidence_records(content_hash)
);

CREATE INDEX IF NOT EXISTS ingest_receipts_content_hash
  ON ingest_receipts(content_hash);

CREATE TABLE IF NOT EXISTS rate_limit_windows (
  subject_hash TEXT NOT NULL CHECK(length(subject_hash)=64),
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL CHECK(request_count > 0),
  PRIMARY KEY(subject_hash,window_start)
);
