PRAGMA foreign_keys = ON;

INSERT INTO schema_migrations (version, name, applied_at)
VALUES (4, 'api_football_shadow_identity', '2026-09-16T00:00:00.000Z');

CREATE TABLE provider_rights_admissions (
 source_revision_id TEXT PRIMARY KEY,
 rights_classification TEXT NOT NULL CHECK(rights_classification='owner_risk_accepted_private_use'),
 provider TEXT NOT NULL CHECK(provider='api-football'), owner_approval_id TEXT NOT NULL,
 allowed_use TEXT NOT NULL CHECK(allowed_use='private_noncommercial_research'),
 retention_allowed INTEGER NOT NULL CHECK(retention_allowed=1), redistribution_allowed INTEGER NOT NULL CHECK(redistribution_allowed=0),
 public_use_allowed INTEGER NOT NULL CHECK(public_use_allowed=0), commercial_use_allowed INTEGER NOT NULL CHECK(commercial_use_allowed=0),
 raw_payload_retention_allowed INTEGER NOT NULL CHECK(raw_payload_retention_allowed=0), stop_on_objection INTEGER NOT NULL CHECK(stop_on_objection=1),
 created_at TEXT NOT NULL
);

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
 source_revision_id TEXT NOT NULL REFERENCES provider_rights_admissions(source_revision_id), input_revision TEXT NOT NULL,
 supersedes_revision_id TEXT REFERENCES provider_participation_revisions(participation_revision_id), fetched_at TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(provider_fixture_identity, provider_player_id, input_revision),
 CHECK(appearance_state<>'NOT_USED' OR (lineup_role='BENCH' AND direct_minutes=0 AND substitution_on=0))
);

CREATE INDEX provider_participation_history ON provider_participation_revisions(provider_fixture_identity, provider_player_id, fetched_at);
