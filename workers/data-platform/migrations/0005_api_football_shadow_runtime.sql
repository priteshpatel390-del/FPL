INSERT INTO schema_migrations (version, name, applied_at)
VALUES (5, 'api_football_shadow_runtime', '2026-09-16T00:00:00.000Z');

INSERT OR IGNORE INTO data_sources (source_id, source_key, source_name, source_kind, created_at)
VALUES ('source:api-football', 'api-football', 'API-Football', 'external_provider', '2026-09-16T00:00:00.000Z');

INSERT OR IGNORE INTO data_source_revisions (
 source_revision_id,source_id,revision,schema_version,rights_classification,retention_allowed,
 redistribution_allowed,attribution_required,attribution_text,terms_reference,terms_reviewed_at,
 acquisition_status,shadow_ingest_allowed,supersedes_revision_id,created_at,provider,source_key,
 owner_approval_id,allowed_use,normalized_facts_only,public_use_allowed,commercial_use_allowed,
 raw_payload_retention_allowed,stop_on_objection
) VALUES (
 'api-football:eia-2i5a:1','source:api-football',1,'api-football-v3-foundation-1',
 'owner_risk_accepted_private_use',1,0,0,NULL,'https://www.api-football.com/terms',
 '2026-09-16T00:00:00.000Z','repository_only_disabled',1,NULL,'2026-09-16T00:00:00.000Z',
 'api-football','api-football','EIA-2I5A','private_noncommercial_research',1,0,0,0,1
);

CREATE TABLE api_football_runtime_state (
 provider TEXT PRIMARY KEY CHECK(provider='api-football'),
 collection_enabled INTEGER NOT NULL DEFAULT 0 CHECK(collection_enabled IN (0,1)),
 disable_reason TEXT, credential_state TEXT NOT NULL DEFAULT 'UNPROVISIONED' CHECK(credential_state IN ('UNPROVISIONED','AVAILABLE','INVALID','UNKNOWN')),
 quota_state TEXT NOT NULL DEFAULT 'UNOBSERVED' CHECK(quota_state IN ('UNOBSERVED','PROBE_REQUIRED','KNOWN','QUOTA_UNCERTAIN','BLOCKED_429','CEILING_REACHED')),
 quota_utc_day TEXT, daily_attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(daily_attempt_count BETWEEN 0 AND 100),
 observed_daily_limit INTEGER, observed_daily_remaining INTEGER, observed_minute_limit INTEGER, observed_minute_remaining INTEGER,
 quota_observed_at TEXT, in_flight_attempt_id TEXT, in_flight_lease_expires_at TEXT,
 earliest_next_request_at TEXT, last_429_at TEXT, last_successful_request_at TEXT, updated_at TEXT NOT NULL,
 CHECK((in_flight_attempt_id IS NULL)=(in_flight_lease_expires_at IS NULL)),
 CHECK(observed_daily_limit IS NULL OR observed_daily_limit>=0), CHECK(observed_daily_remaining IS NULL OR observed_daily_remaining>=0),
 CHECK(observed_minute_limit IS NULL OR observed_minute_limit>=0), CHECK(observed_minute_remaining IS NULL OR observed_minute_remaining>=0)
);
INSERT INTO api_football_runtime_state (provider,collection_enabled,disable_reason,updated_at)
VALUES ('api-football',0,'EIA_2I5D_REPOSITORY_ONLY','2026-09-16T00:00:00.000Z');

CREATE TABLE api_football_discovery_generations (
 generation_id TEXT PRIMARY KEY, logical_opportunity TEXT NOT NULL UNIQUE, state TEXT NOT NULL CHECK(state IN ('STAGING','COMMITTED','FAILED')),
 fpl_season TEXT NOT NULL, provider_season INTEGER NOT NULL, ingestion_run_id TEXT NOT NULL,
 source_revision_id TEXT NOT NULL REFERENCES data_source_revisions(source_revision_id),
 official_fpl_authority_digest TEXT NOT NULL, official_fpl_authority_run_id TEXT NOT NULL,
 competition_count INTEGER NOT NULL DEFAULT 0 CHECK(competition_count BETWEEN 0 AND 5),
 fixture_count INTEGER NOT NULL DEFAULT 0 CHECK(fixture_count>=0), mapping_coverage_count INTEGER NOT NULL DEFAULT 0 CHECK(mapping_coverage_count BETWEEN 0 AND 20),
 admitted_count INTEGER NOT NULL DEFAULT 0 CHECK(admitted_count>=0), conflicted_count INTEGER NOT NULL DEFAULT 0 CHECK(conflicted_count>=0),
 failure_class TEXT, started_at TEXT NOT NULL, completed_at TEXT, created_at TEXT NOT NULL,
 FOREIGN KEY(ingestion_run_id,source_revision_id) REFERENCES ingestion_runs(run_id,source_revision_id),
 CHECK(state<>'COMMITTED' OR (competition_count=5 AND completed_at IS NOT NULL AND failure_class IS NULL)),
 CHECK(state<>'FAILED' OR failure_class IS NOT NULL)
);

CREATE TABLE api_football_discovery_heads (
 fpl_season TEXT PRIMARY KEY, generation_id TEXT NOT NULL REFERENCES api_football_discovery_generations(generation_id), updated_at TEXT NOT NULL
);
CREATE TRIGGER api_football_committed_head_insert BEFORE INSERT ON api_football_discovery_heads
WHEN NOT EXISTS (SELECT 1 FROM api_football_discovery_generations WHERE generation_id=NEW.generation_id AND state='COMMITTED' AND fpl_season=NEW.fpl_season)
BEGIN SELECT RAISE(ABORT,'api_football_head_not_committed'); END;
CREATE TRIGGER api_football_committed_head_update BEFORE UPDATE ON api_football_discovery_heads
WHEN NOT EXISTS (SELECT 1 FROM api_football_discovery_generations WHERE generation_id=NEW.generation_id AND state='COMMITTED' AND fpl_season=NEW.fpl_season)
BEGIN SELECT RAISE(ABORT,'api_football_head_not_committed'); END;
CREATE TRIGGER api_football_committed_generation_immutable BEFORE UPDATE OF state,fpl_season ON api_football_discovery_generations
WHEN OLD.state='COMMITTED' AND (NEW.state<>'COMMITTED' OR NEW.fpl_season<>OLD.fpl_season)
BEGIN SELECT RAISE(ABORT,'api_football_committed_generation_immutable'); END;

CREATE TABLE api_football_request_attempts (
 attempt_id TEXT PRIMARY KEY, logical_request_id TEXT NOT NULL, attempt_number INTEGER NOT NULL CHECK(attempt_number BETWEEN 1 AND 2),
 operation_class TEXT NOT NULL CHECK(operation_class IN ('DISCOVERY','PRE_MATCH','FINALITY','FINAL_ENRICHMENT','CORRECTION','MANUAL_BACKFILL')),
 endpoint_class TEXT NOT NULL CHECK(endpoint_class IN ('fixtures_discovery','fixture','lineups','players','events')),
 generation_id TEXT REFERENCES api_football_discovery_generations(generation_id), ingestion_run_id TEXT,
 source_revision_id TEXT, quota_utc_day TEXT NOT NULL, reserved_at TEXT NOT NULL, lease_expires_at TEXT NOT NULL,
 completed_at TEXT, outcome TEXT NOT NULL CHECK(outcome IN ('RESERVED','SUCCEEDED','HTTP_FAILURE','TIMEOUT','TRANSPORT_UNKNOWN','SCHEMA_FAILURE','QUOTA_BLOCKED')),
 http_class TEXT, timeout INTEGER NOT NULL DEFAULT 0 CHECK(timeout IN (0,1)), quota_state TEXT,
 observed_daily_limit INTEGER, observed_daily_remaining INTEGER, observed_minute_limit INTEGER, observed_minute_remaining INTEGER,
 FOREIGN KEY(ingestion_run_id,source_revision_id) REFERENCES ingestion_runs(run_id,source_revision_id),
 UNIQUE(logical_request_id,attempt_number)
);
CREATE INDEX api_football_attempt_retention ON api_football_request_attempts(reserved_at,attempt_id);

CREATE TABLE api_football_fixture_revisions (
 fixture_revision_id TEXT PRIMARY KEY, provider_fixture_identity TEXT NOT NULL REFERENCES provider_fixture_identities(provider_fixture_identity),
 generation_id TEXT REFERENCES api_football_discovery_generations(generation_id), ingestion_run_id TEXT NOT NULL,
 source_revision_id TEXT NOT NULL REFERENCES data_source_revisions(source_revision_id), provider_kickoff TEXT NOT NULL,
 provider_status TEXT NOT NULL, qualification_state TEXT NOT NULL CHECK(qualification_state IN ('DISCOVERED','PROVIDER_QUALIFIED','CROSS_SOURCE_VERIFIED','AMBIGUOUS','CONFLICTED','REJECTED')),
 mapping_provenance TEXT NOT NULL, authoritative_duration INTEGER CHECK(authoritative_duration IS NULL OR authoritative_duration BETWEEN 1 AND 130),
 extra_time_state TEXT NOT NULL CHECK(extra_time_state IN ('TRUE','FALSE','UNKNOWN')), extra_time_evidence TEXT,
 input_revision TEXT NOT NULL, input_hash TEXT NOT NULL CHECK(length(input_hash)=64),
 supersedes_revision_id TEXT REFERENCES api_football_fixture_revisions(fixture_revision_id), fetched_at TEXT NOT NULL, created_at TEXT NOT NULL,
 FOREIGN KEY(ingestion_run_id,source_revision_id) REFERENCES ingestion_runs(run_id,source_revision_id),
 UNIQUE(provider_fixture_identity,input_revision), CHECK(supersedes_revision_id IS NULL OR supersedes_revision_id<>fixture_revision_id)
);
CREATE INDEX api_football_fixture_revision_history ON api_football_fixture_revisions(provider_fixture_identity,fetched_at);
CREATE TRIGGER api_football_fixture_supersession_insert BEFORE INSERT ON api_football_fixture_revisions
WHEN NEW.supersedes_revision_id IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM api_football_fixture_revisions previous
 WHERE previous.fixture_revision_id=NEW.supersedes_revision_id AND previous.provider_fixture_identity=NEW.provider_fixture_identity
)
BEGIN SELECT RAISE(ABORT,'api_football_fixture_supersession_invalid'); END;

CREATE TABLE api_football_generation_fixtures (
 generation_id TEXT NOT NULL REFERENCES api_football_discovery_generations(generation_id) ON DELETE CASCADE,
 provider_fixture_identity TEXT NOT NULL REFERENCES provider_fixture_identities(provider_fixture_identity),
 fixture_revision_id TEXT NOT NULL REFERENCES api_football_fixture_revisions(fixture_revision_id),
 PRIMARY KEY(generation_id,provider_fixture_identity)
);
CREATE TRIGGER api_football_generation_fixture_consistency BEFORE INSERT ON api_football_generation_fixtures
WHEN NOT EXISTS (
 SELECT 1 FROM api_football_fixture_revisions revision
 WHERE revision.fixture_revision_id=NEW.fixture_revision_id AND revision.provider_fixture_identity=NEW.provider_fixture_identity
)
BEGIN SELECT RAISE(ABORT,'api_football_generation_fixture_mismatch'); END;

ALTER TABLE provider_participation_revisions ADD COLUMN ingestion_run_id TEXT REFERENCES ingestion_runs(run_id);
CREATE TRIGGER api_football_participation_run_insert BEFORE INSERT ON provider_participation_revisions
WHEN NEW.ingestion_run_id IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM ingestion_runs run WHERE run.run_id=NEW.ingestion_run_id AND run.source_revision_id=NEW.source_revision_id
)
BEGIN SELECT RAISE(ABORT,'api_football_participation_run_mismatch'); END;
CREATE TRIGGER api_football_participation_run_update BEFORE UPDATE OF ingestion_run_id,source_revision_id ON provider_participation_revisions
WHEN NEW.ingestion_run_id IS NOT NULL AND NOT EXISTS (
 SELECT 1 FROM ingestion_runs run WHERE run.run_id=NEW.ingestion_run_id AND run.source_revision_id=NEW.source_revision_id
)
BEGIN SELECT RAISE(ABORT,'api_football_participation_run_mismatch'); END;
