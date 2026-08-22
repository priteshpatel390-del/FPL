PRAGMA foreign_keys = ON;

CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, applied_at TEXT NOT NULL);
INSERT INTO schema_migrations VALUES (1, 'shadow_data_foundation', '2026-08-22T00:00:00.000Z');

CREATE TABLE data_sources (
 source_id TEXT PRIMARY KEY, source_key TEXT NOT NULL UNIQUE, source_name TEXT NOT NULL,
 source_kind TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE data_source_revisions (
 source_revision_id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES data_sources(source_id), revision INTEGER NOT NULL,
 schema_version TEXT NOT NULL, rights_classification TEXT NOT NULL CHECK(rights_classification IN ('durable_allowed','attribution_required','local_research_only','durable_blocked','unknown_fail_closed')),
 retention_allowed INTEGER NOT NULL CHECK(retention_allowed IN (0,1)), redistribution_allowed INTEGER NOT NULL CHECK(redistribution_allowed IN (0,1)),
 attribution_required INTEGER NOT NULL CHECK(attribution_required IN (0,1)), attribution_text TEXT, terms_reference TEXT, terms_reviewed_at TEXT,
 acquisition_status TEXT NOT NULL, shadow_ingest_allowed INTEGER NOT NULL CHECK(shadow_ingest_allowed IN (0,1)),
 supersedes_revision_id TEXT REFERENCES data_source_revisions(source_revision_id), created_at TEXT NOT NULL,
 UNIQUE(source_id, revision)
);
CREATE TABLE ingestion_runs (
 run_id TEXT PRIMARY KEY, source_revision_id TEXT NOT NULL REFERENCES data_source_revisions(source_revision_id), run_type TEXT NOT NULL,
 mode TEXT NOT NULL CHECK(mode='shadow_only'), started_at TEXT NOT NULL, completed_at TEXT, status TEXT NOT NULL, safe_endpoint_class TEXT,
 parser_version TEXT NOT NULL, transform_version TEXT NOT NULL, schema_version TEXT NOT NULL,
 records_seen INTEGER NOT NULL DEFAULT 0, records_accepted INTEGER NOT NULL DEFAULT 0, records_quarantined INTEGER NOT NULL DEFAULT 0,
 records_rejected INTEGER NOT NULL DEFAULT 0, error_class TEXT, created_at TEXT NOT NULL
);
CREATE TABLE canonical_entities (
 canonical_entity_id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, season TEXT NOT NULL, canonical_system TEXT NOT NULL,
 canonical_external_id TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(entity_type, season, canonical_system, canonical_external_id)
);
CREATE TABLE entity_mappings (
 mapping_id TEXT PRIMARY KEY, source_revision_id TEXT NOT NULL REFERENCES data_source_revisions(source_revision_id), provider_entity_type TEXT NOT NULL,
 provider_entity_id TEXT NOT NULL, canonical_entity_id TEXT NOT NULL REFERENCES canonical_entities(canonical_entity_id),
 mapping_method TEXT NOT NULL CHECK(mapping_method IN ('provider_id_crosswalk','manually_verified')),
 mapping_status TEXT NOT NULL CHECK(mapping_status IN ('verified','unresolved','ambiguous','quarantined')),
 valid_from TEXT, valid_to TEXT, verified_at TEXT, mapping_version INTEGER NOT NULL,
 supersedes_mapping_id TEXT REFERENCES entity_mappings(mapping_id), created_at TEXT NOT NULL,
 UNIQUE(source_revision_id, provider_entity_type, provider_entity_id, mapping_version)
);
CREATE TABLE shadow_observations (
 observation_id TEXT PRIMARY KEY, logical_key TEXT NOT NULL, ingestion_run_id TEXT NOT NULL REFERENCES ingestion_runs(run_id),
 source_revision_id TEXT NOT NULL REFERENCES data_source_revisions(source_revision_id), category TEXT NOT NULL, subject_type TEXT NOT NULL,
 subject_entity_id TEXT NOT NULL REFERENCES canonical_entities(canonical_entity_id), fixture_entity_id TEXT REFERENCES canonical_entities(canonical_entity_id),
 competition_entity_id TEXT REFERENCES canonical_entities(canonical_entity_id), metric TEXT NOT NULL,
 value_type TEXT NOT NULL CHECK(value_type IN ('number','text','boolean')),
 value_number REAL, value_text TEXT, value_boolean INTEGER CHECK(value_boolean IN (0,1)), unit TEXT,
 observed_at TEXT NOT NULL, effective_at TEXT NOT NULL, fetched_at TEXT NOT NULL, expires_at TEXT, source_timestamp TEXT,
 provider_record_id TEXT, transform_version TEXT NOT NULL, validation_version TEXT NOT NULL, input_revision TEXT NOT NULL,
 admission_state TEXT NOT NULL CHECK(admission_state IN ('accepted','quarantined')),
 quality_state TEXT NOT NULL CHECK(quality_state IN ('fresh','stale','conflicting','uncertain')), conflict_group_id TEXT,
 mode TEXT NOT NULL CHECK(mode='shadow_only'), created_at TEXT NOT NULL,
 CHECK((value_type='number' AND value_number IS NOT NULL AND value_text IS NULL AND value_boolean IS NULL) OR
       (value_type='text' AND value_number IS NULL AND value_text IS NOT NULL AND value_boolean IS NULL) OR
       (value_type='boolean' AND value_number IS NULL AND value_text IS NULL AND value_boolean IS NOT NULL))
);
CREATE UNIQUE INDEX shadow_observation_idempotency ON shadow_observations(source_revision_id, logical_key, input_revision);
CREATE INDEX shadow_observation_replay ON shadow_observations(fetched_at, logical_key);
CREATE TABLE observation_relations (
 relation_id TEXT PRIMARY KEY, from_observation_id TEXT NOT NULL REFERENCES shadow_observations(observation_id),
 to_observation_id TEXT NOT NULL REFERENCES shadow_observations(observation_id),
 relation_type TEXT NOT NULL CHECK(relation_type IN ('supersedes','corrects','duplicates','conflicts_with')), created_at TEXT NOT NULL,
 UNIQUE(from_observation_id,to_observation_id,relation_type)
);
CREATE TABLE observation_heads (logical_key TEXT PRIMARY KEY, observation_id TEXT NOT NULL REFERENCES shadow_observations(observation_id), updated_at TEXT NOT NULL);
CREATE TABLE observation_rejections (
 rejection_id TEXT PRIMARY KEY, run_id TEXT REFERENCES ingestion_runs(run_id), source_revision_id TEXT REFERENCES data_source_revisions(source_revision_id),
 reason_code TEXT NOT NULL CHECK(reason_code IN ('rights_unknown','durable_storage_blocked','local_research_only','attribution_missing','secret_detected','keyed_url_detected','mapping_unresolved','mapping_ambiguous','schema_invalid','value_invalid','mode_invalid')),
 category TEXT, subject_type TEXT, safe_fingerprint TEXT, created_at TEXT NOT NULL
);
