PRAGMA foreign_keys = OFF;

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

INSERT INTO data_source_revisions_new (
 source_revision_id,source_id,revision,schema_version,rights_classification,retention_allowed,redistribution_allowed,
 attribution_required,attribution_text,terms_reference,terms_reviewed_at,acquisition_status,shadow_ingest_allowed,
 supersedes_revision_id,created_at
) SELECT source_revision_id,source_id,revision,schema_version,rights_classification,retention_allowed,redistribution_allowed,
 attribution_required,attribution_text,terms_reference,terms_reviewed_at,acquisition_status,shadow_ingest_allowed,
 supersedes_revision_id,created_at FROM data_source_revisions;
DROP TABLE data_source_revisions;
ALTER TABLE data_source_revisions_new RENAME TO data_source_revisions;

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

PRAGMA foreign_keys = ON;
