-- Cloudflare D1 keeps foreign-key enforcement enabled. Defer validation for this
-- transaction while the complete connected table graph is rebuilt. No statement
-- disables foreign keys.
PRAGMA defer_foreign_keys = ON;

INSERT INTO schema_migrations (version, name, applied_at)
VALUES (4, 'api_football_shadow_identity', '2026-09-16T00:00:00.000Z');

CREATE TABLE data_source_revisions_new (
 source_revision_id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES data_sources(source_id), revision INTEGER NOT NULL,
 schema_version TEXT NOT NULL, rights_classification TEXT NOT NULL CHECK(rights_classification IN ('durable_allowed','attribution_required','local_research_only','durable_blocked','unknown_fail_closed','owner_risk_accepted_private_use')),
 retention_allowed INTEGER NOT NULL CHECK(retention_allowed IN (0,1)), redistribution_allowed INTEGER NOT NULL CHECK(redistribution_allowed IN (0,1)),
 attribution_required INTEGER NOT NULL CHECK(attribution_required IN (0,1)), attribution_text TEXT, terms_reference TEXT, terms_reviewed_at TEXT,
 acquisition_status TEXT NOT NULL, shadow_ingest_allowed INTEGER NOT NULL CHECK(shadow_ingest_allowed IN (0,1)),
 supersedes_revision_id TEXT REFERENCES data_source_revisions_new(source_revision_id), created_at TEXT NOT NULL,
 provider TEXT, source_key TEXT, owner_approval_id TEXT, allowed_use TEXT,
 normalized_facts_only INTEGER CHECK(normalized_facts_only IS NULL OR normalized_facts_only IN (0,1)),
 public_use_allowed INTEGER CHECK(public_use_allowed IS NULL OR public_use_allowed IN (0,1)),
 commercial_use_allowed INTEGER CHECK(commercial_use_allowed IS NULL OR commercial_use_allowed IN (0,1)),
 raw_payload_retention_allowed INTEGER CHECK(raw_payload_retention_allowed IS NULL OR raw_payload_retention_allowed IN (0,1)),
 stop_on_objection INTEGER CHECK(stop_on_objection IS NULL OR stop_on_objection IN (0,1)),
 UNIQUE(source_id, revision),
 CHECK((rights_classification='attribution_required' AND attribution_required=1 AND length(trim(attribution_text))>0) OR
       (rights_classification<>'attribution_required' AND attribution_required=0)),
 CHECK((rights_classification='owner_risk_accepted_private_use' AND provider='api-football' AND source_key='api-football' AND
        owner_approval_id IN ('EIA-2I1','EIA-2I5A') AND allowed_use='private_noncommercial_research' AND normalized_facts_only=1 AND
        retention_allowed=1 AND redistribution_allowed=0 AND public_use_allowed=0 AND commercial_use_allowed=0 AND
        raw_payload_retention_allowed=0 AND stop_on_objection=1 AND shadow_ingest_allowed=1) OR
       (rights_classification<>'owner_risk_accepted_private_use' AND provider IS NULL AND source_key IS NULL AND owner_approval_id IS NULL AND
        allowed_use IS NULL AND normalized_facts_only IS NULL AND public_use_allowed IS NULL AND commercial_use_allowed IS NULL AND
        raw_payload_retention_allowed IS NULL AND stop_on_objection IS NULL))
);

CREATE TABLE ingestion_runs_new (
 run_id TEXT PRIMARY KEY, source_revision_id TEXT NOT NULL REFERENCES data_source_revisions_new(source_revision_id), run_type TEXT NOT NULL,
 mode TEXT NOT NULL CHECK(mode='shadow_only'), started_at TEXT NOT NULL, completed_at TEXT, status TEXT NOT NULL, safe_endpoint_class TEXT,
 parser_version TEXT NOT NULL, transform_version TEXT NOT NULL, schema_version TEXT NOT NULL,
 records_seen INTEGER NOT NULL DEFAULT 0, records_accepted INTEGER NOT NULL DEFAULT 0, records_quarantined INTEGER NOT NULL DEFAULT 0,
 records_rejected INTEGER NOT NULL DEFAULT 0, error_class TEXT, created_at TEXT NOT NULL,
 UNIQUE(run_id, source_revision_id)
);
CREATE TABLE entity_mappings_new (
 mapping_id TEXT PRIMARY KEY, source_revision_id TEXT NOT NULL REFERENCES data_source_revisions_new(source_revision_id), provider_entity_type TEXT NOT NULL,
 provider_entity_id TEXT NOT NULL, canonical_entity_id TEXT NOT NULL REFERENCES canonical_entities(canonical_entity_id),
 mapping_method TEXT NOT NULL CHECK(mapping_method IN ('provider_id_crosswalk','manually_verified')),
 mapping_status TEXT NOT NULL CHECK(mapping_status IN ('verified','unresolved','ambiguous','quarantined')),
 valid_from TEXT, valid_to TEXT, verified_at TEXT, mapping_version INTEGER NOT NULL,
 supersedes_mapping_id TEXT REFERENCES entity_mappings_new(mapping_id), created_at TEXT NOT NULL,
 UNIQUE(source_revision_id, provider_entity_type, provider_entity_id, mapping_version)
);
CREATE TABLE shadow_observations_new (
 observation_id TEXT PRIMARY KEY CHECK(length(observation_id)=64), logical_key TEXT NOT NULL, ingestion_run_id TEXT NOT NULL,
 source_revision_id TEXT NOT NULL, category TEXT NOT NULL, subject_type TEXT NOT NULL,
 subject_entity_id TEXT NOT NULL REFERENCES canonical_entities(canonical_entity_id), fixture_entity_id TEXT REFERENCES canonical_entities(canonical_entity_id),
 competition_entity_id TEXT REFERENCES canonical_entities(canonical_entity_id), metric TEXT NOT NULL,
 value_type TEXT NOT NULL CHECK(value_type IN ('number','text','boolean')),
 subject_mapping_id TEXT REFERENCES entity_mappings_new(mapping_id), fixture_mapping_id TEXT REFERENCES entity_mappings_new(mapping_id), competition_mapping_id TEXT REFERENCES entity_mappings_new(mapping_id),
 provenance_kind TEXT NOT NULL CHECK(provenance_kind IN ('mapped_provider','canonical_native_fpl')),
 value_number REAL, value_text TEXT, value_boolean INTEGER CHECK(value_boolean IN (0,1)), unit TEXT,
 observed_at TEXT, effective_at TEXT, fetched_at TEXT NOT NULL, expires_at TEXT, source_timestamp TEXT,
 provider_record_id TEXT, transform_version TEXT NOT NULL, validation_version TEXT NOT NULL, input_revision TEXT NOT NULL,
 admission_state TEXT NOT NULL CHECK(admission_state IN ('accepted','quarantined')),
 quality_state TEXT NOT NULL CHECK(quality_state IN ('fresh','stale','conflicting','uncertain')), conflict_group_id TEXT,
 mode TEXT NOT NULL CHECK(mode='shadow_only'), created_at TEXT NOT NULL,
 FOREIGN KEY(ingestion_run_id,source_revision_id) REFERENCES ingestion_runs_new(run_id,source_revision_id),
 CHECK((value_type='number' AND value_number IS NOT NULL AND value_text IS NULL AND value_boolean IS NULL) OR
       (value_type='text' AND value_number IS NULL AND value_text IS NOT NULL AND value_boolean IS NULL) OR
       (value_type='boolean' AND value_number IS NULL AND value_text IS NULL AND value_boolean IS NOT NULL))
);
CREATE TABLE observation_relations_new (
 relation_id TEXT PRIMARY KEY, from_observation_id TEXT NOT NULL REFERENCES shadow_observations_new(observation_id),
 to_observation_id TEXT NOT NULL REFERENCES shadow_observations_new(observation_id),
 relation_type TEXT NOT NULL CHECK(relation_type IN ('supersedes','corrects','duplicates','conflicts_with')), created_at TEXT NOT NULL,
 UNIQUE(from_observation_id,to_observation_id,relation_type)
);
CREATE TABLE observation_heads_new (logical_key TEXT PRIMARY KEY, observation_id TEXT NOT NULL REFERENCES shadow_observations_new(observation_id), updated_at TEXT NOT NULL);
CREATE TABLE observation_rejections_new (
 rejection_id TEXT PRIMARY KEY, run_id TEXT REFERENCES ingestion_runs_new(run_id), source_revision_id TEXT REFERENCES data_source_revisions_new(source_revision_id),
 reason_code TEXT NOT NULL CHECK(reason_code IN ('rights_unknown','rights_inconsistent','durable_storage_blocked','local_research_only','attribution_missing','secret_detected','keyed_url_detected','mapping_unresolved','mapping_ambiguous','mapping_source_mismatch','mapping_target_mismatch','mapping_type_mismatch','entity_type_mismatch','schema_invalid','timestamp_invalid','value_invalid','mode_invalid')),
 category TEXT, subject_type TEXT, safe_fingerprint TEXT, created_at TEXT NOT NULL
);

INSERT INTO data_source_revisions_new (source_revision_id,source_id,revision,schema_version,rights_classification,retention_allowed,redistribution_allowed,attribution_required,attribution_text,terms_reference,terms_reviewed_at,acquisition_status,shadow_ingest_allowed,supersedes_revision_id,created_at)
SELECT source_revision_id,source_id,revision,schema_version,rights_classification,retention_allowed,redistribution_allowed,attribution_required,attribution_text,terms_reference,terms_reviewed_at,acquisition_status,shadow_ingest_allowed,supersedes_revision_id,created_at FROM data_source_revisions;
INSERT INTO ingestion_runs_new SELECT * FROM ingestion_runs;
INSERT INTO entity_mappings_new SELECT * FROM entity_mappings;
INSERT INTO shadow_observations_new SELECT * FROM shadow_observations;
INSERT INTO observation_relations_new SELECT * FROM observation_relations;
INSERT INTO observation_heads_new SELECT * FROM observation_heads;
INSERT INTO observation_rejections_new SELECT * FROM observation_rejections;

DROP TABLE observation_relations;
DROP TABLE observation_heads;
DROP TABLE observation_rejections;
DROP TABLE shadow_observations;
DROP TABLE entity_mappings;
DROP TABLE ingestion_runs;
DROP TABLE data_source_revisions;

ALTER TABLE data_source_revisions_new RENAME TO data_source_revisions;
ALTER TABLE ingestion_runs_new RENAME TO ingestion_runs;
ALTER TABLE entity_mappings_new RENAME TO entity_mappings;
ALTER TABLE shadow_observations_new RENAME TO shadow_observations;
ALTER TABLE observation_relations_new RENAME TO observation_relations;
ALTER TABLE observation_heads_new RENAME TO observation_heads;
ALTER TABLE observation_rejections_new RENAME TO observation_rejections;

CREATE UNIQUE INDEX shadow_observation_idempotency ON shadow_observations(source_revision_id, logical_key, input_revision);
CREATE INDEX shadow_observation_replay ON shadow_observations(fetched_at, logical_key);
CREATE INDEX observation_heads_observation_id ON observation_heads(observation_id);
CREATE INDEX shadow_observations_ingestion_run ON shadow_observations(ingestion_run_id, source_revision_id);
CREATE INDEX observation_rejections_source_revision ON observation_rejections(source_revision_id);

CREATE TRIGGER owner_risk_source_revision_insert
BEFORE INSERT ON data_source_revisions
WHEN NEW.rights_classification='owner_risk_accepted_private_use' AND NOT EXISTS (
 SELECT 1 FROM data_sources WHERE source_id=NEW.source_id AND source_key='api-football' AND NEW.source_key=source_key
)
BEGIN SELECT RAISE(ABORT, 'owner_risk_source_mismatch'); END;

CREATE TRIGGER owner_risk_source_revision_update
BEFORE UPDATE ON data_source_revisions
WHEN NEW.rights_classification='owner_risk_accepted_private_use' AND NOT EXISTS (
 SELECT 1 FROM data_sources WHERE source_id=NEW.source_id AND source_key='api-football' AND NEW.source_key=source_key
)
BEGIN SELECT RAISE(ABORT, 'owner_risk_source_mismatch'); END;

CREATE TABLE provider_fixture_identities (
 provider_fixture_identity TEXT PRIMARY KEY, provider TEXT NOT NULL CHECK(provider='api-football'), provider_fixture_id TEXT NOT NULL,
 season TEXT NOT NULL, canonical_competition_id TEXT NOT NULL, provider_league_id TEXT NOT NULL,
 provider_home_team_id TEXT NOT NULL, provider_away_team_id TEXT NOT NULL,
 home_mapping_id TEXT REFERENCES entity_mappings(mapping_id), away_mapping_id TEXT REFERENCES entity_mappings(mapping_id),
 qualification_state TEXT NOT NULL CHECK(qualification_state IN ('DISCOVERED','PROVIDER_QUALIFIED','CROSS_SOURCE_VERIFIED','AMBIGUOUS','CONFLICTED','REJECTED')),
 qualification_provenance TEXT NOT NULL, identity_revision TEXT NOT NULL, first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL,
 UNIQUE(provider, season, provider_fixture_id), CHECK(provider_fixture_identity=season||':api-football:fixture:'||provider_fixture_id)
);

CREATE TABLE provider_participation_revisions (
 participation_revision_id TEXT PRIMARY KEY, provider_fixture_identity TEXT NOT NULL REFERENCES provider_fixture_identities(provider_fixture_identity),
 provider_player_id TEXT NOT NULL, canonical_player_entity_id TEXT REFERENCES canonical_entities(canonical_entity_id), player_mapping_id TEXT REFERENCES entity_mappings(mapping_id),
 lineup_role TEXT NOT NULL CHECK(lineup_role IN ('STARTER','BENCH','NO_LINEUP_EVIDENCE','UNKNOWN')),
 appearance_state TEXT NOT NULL CHECK(appearance_state IN ('STARTED','SUBBED_ON','NOT_USED','UNKNOWN')),
 direct_minutes INTEGER CHECK(direct_minutes IS NULL OR direct_minutes BETWEEN 0 AND 130),
 substitution_on INTEGER NOT NULL CHECK(substitution_on IN (0,1)), substitution_off INTEGER NOT NULL CHECK(substitution_off IN (0,1)),
 conflict_state TEXT NOT NULL CHECK(conflict_state IN ('NONE','CONFLICTED','RESOLVED')),
 substitution_evidence_state TEXT NOT NULL CHECK(substitution_evidence_state IN ('COMPLETE','MISSING','INVALID','UNKNOWN')),
 source_revision_id TEXT NOT NULL REFERENCES data_source_revisions(source_revision_id), input_revision TEXT NOT NULL,
 supersedes_revision_id TEXT REFERENCES provider_participation_revisions(participation_revision_id), fetched_at TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(provider_fixture_identity, provider_player_id, input_revision),
 CHECK(appearance_state<>'NOT_USED' OR (lineup_role='BENCH' AND direct_minutes=0 AND substitution_evidence_state='COMPLETE' AND substitution_on=0))
);

CREATE INDEX provider_participation_history ON provider_participation_revisions(provider_fixture_identity, provider_player_id, fetched_at);
