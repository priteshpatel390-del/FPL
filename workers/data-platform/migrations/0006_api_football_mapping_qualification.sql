INSERT INTO schema_migrations (version, name, applied_at)
VALUES (6, 'api_football_mapping_qualification', '2026-09-18T00:00:00.000Z');

CREATE TABLE api_football_team_mapping_qualifications (
 qualification_id TEXT PRIMARY KEY,
 fpl_season TEXT NOT NULL,
 provider TEXT NOT NULL CHECK(provider='api-football'),
 source_revision_id TEXT NOT NULL REFERENCES data_source_revisions(source_revision_id),
 approval_qualification_integrity_hash TEXT NOT NULL CHECK(length(approval_qualification_integrity_hash)=64),
 current_qualification_integrity_hash TEXT NOT NULL CHECK(length(current_qualification_integrity_hash)=64),
 persistence_integrity_hash TEXT NOT NULL CHECK(length(persistence_integrity_hash)=64),
 crosswalk_integrity_hash TEXT NOT NULL CHECK(length(crosswalk_integrity_hash)=64),
 provider_universe_revision TEXT NOT NULL,
 provider_universe_integrity_hash TEXT NOT NULL CHECK(length(provider_universe_integrity_hash)=64),
 provider_universe_observed_at TEXT NOT NULL,
 owner_review_reference TEXT NOT NULL,
 owner_reviewed_at TEXT NOT NULL,
 official_fpl_authority_digest TEXT NOT NULL CHECK(length(official_fpl_authority_digest)=64),
 official_fpl_authority_fetched_at TEXT NOT NULL,
 mapping_count INTEGER NOT NULL CHECK(mapping_count=20),
 state TEXT NOT NULL CHECK(state IN ('STAGING','COMMITTED')),
 committed_at TEXT,
 created_at TEXT NOT NULL,
 UNIQUE(fpl_season,persistence_integrity_hash),
 CHECK(state<>'COMMITTED' OR committed_at IS NOT NULL)
);

CREATE TABLE api_football_team_mapping_members (
 qualification_id TEXT NOT NULL REFERENCES api_football_team_mapping_qualifications(qualification_id) ON DELETE CASCADE,
 mapping_id TEXT NOT NULL REFERENCES entity_mappings(mapping_id),
 provider_team_id TEXT NOT NULL,
 canonical_fpl_team_id TEXT NOT NULL REFERENCES canonical_entities(canonical_entity_id),
 receipt_integrity_hash TEXT NOT NULL CHECK(length(receipt_integrity_hash)=64),
 PRIMARY KEY(qualification_id,mapping_id),
 UNIQUE(qualification_id,provider_team_id),
 UNIQUE(qualification_id,canonical_fpl_team_id)
);

CREATE TRIGGER api_football_mapping_member_insert
BEFORE INSERT ON api_football_team_mapping_members
WHEN NOT EXISTS (
 SELECT 1 FROM api_football_team_mapping_qualifications q
 JOIN entity_mappings m ON m.mapping_id=NEW.mapping_id
 WHERE q.qualification_id=NEW.qualification_id
   AND q.state='STAGING'
   AND m.source_revision_id=q.source_revision_id
   AND m.provider_entity_type='team'
   AND m.provider_entity_id=NEW.provider_team_id
   AND m.canonical_entity_id=NEW.canonical_fpl_team_id
   AND m.mapping_status='verified'
   AND m.mapping_method IN ('provider_id_crosswalk','manually_verified')
   AND m.mapping_version=1
)
BEGIN SELECT RAISE(ABORT,'api_football_mapping_member_invalid'); END;

CREATE TRIGGER api_football_mapping_qualification_commit
BEFORE UPDATE OF state ON api_football_team_mapping_qualifications
WHEN NEW.state='COMMITTED' AND (
  OLD.state<>'STAGING'
  OR (SELECT COUNT(*) FROM api_football_team_mapping_members WHERE qualification_id=NEW.qualification_id)<>20
  OR NOT EXISTS (
    SELECT 1 FROM api_football_team_mapping_members
    WHERE qualification_id=NEW.qualification_id
      AND provider_team_id='49'
      AND canonical_fpl_team_id=NEW.fpl_season||':fpl:team:6'
  )
  OR NOT EXISTS (
    SELECT 1 FROM api_football_team_mapping_members
    WHERE qualification_id=NEW.qualification_id
      AND provider_team_id='63'
      AND canonical_fpl_team_id=NEW.fpl_season||':fpl:team:13'
  )
)
BEGIN SELECT RAISE(ABORT,'api_football_mapping_qualification_incomplete'); END;

CREATE TRIGGER api_football_mapping_qualification_immutable
BEFORE UPDATE ON api_football_team_mapping_qualifications
WHEN OLD.state='COMMITTED' AND (
  NEW.qualification_id<>OLD.qualification_id
  OR NEW.fpl_season<>OLD.fpl_season
  OR NEW.provider<>OLD.provider
  OR NEW.source_revision_id<>OLD.source_revision_id
  OR NEW.approval_qualification_integrity_hash<>OLD.approval_qualification_integrity_hash
  OR NEW.current_qualification_integrity_hash<>OLD.current_qualification_integrity_hash
  OR NEW.persistence_integrity_hash<>OLD.persistence_integrity_hash
  OR NEW.crosswalk_integrity_hash<>OLD.crosswalk_integrity_hash
  OR NEW.provider_universe_revision<>OLD.provider_universe_revision
  OR NEW.provider_universe_integrity_hash<>OLD.provider_universe_integrity_hash
  OR NEW.provider_universe_observed_at<>OLD.provider_universe_observed_at
  OR NEW.owner_review_reference<>OLD.owner_review_reference
  OR NEW.owner_reviewed_at<>OLD.owner_reviewed_at
  OR NEW.official_fpl_authority_digest<>OLD.official_fpl_authority_digest
  OR NEW.official_fpl_authority_fetched_at<>OLD.official_fpl_authority_fetched_at
  OR NEW.mapping_count<>OLD.mapping_count
  OR NEW.state<>'COMMITTED'
  OR NEW.committed_at<>OLD.committed_at
  OR NEW.created_at<>OLD.created_at
)
BEGIN SELECT RAISE(ABORT,'api_football_mapping_qualification_immutable'); END;

CREATE TRIGGER api_football_mapping_member_update_immutable
BEFORE UPDATE ON api_football_team_mapping_members
WHEN EXISTS (SELECT 1 FROM api_football_team_mapping_qualifications q WHERE q.qualification_id=OLD.qualification_id AND q.state='COMMITTED')
BEGIN SELECT RAISE(ABORT,'api_football_mapping_member_immutable'); END;

CREATE TRIGGER api_football_mapping_member_delete_immutable
BEFORE DELETE ON api_football_team_mapping_members
WHEN EXISTS (SELECT 1 FROM api_football_team_mapping_qualifications q WHERE q.qualification_id=OLD.qualification_id AND q.state='COMMITTED')
BEGIN SELECT RAISE(ABORT,'api_football_mapping_member_immutable'); END;

CREATE TABLE api_football_team_mapping_heads (
 fpl_season TEXT PRIMARY KEY,
 qualification_id TEXT NOT NULL REFERENCES api_football_team_mapping_qualifications(qualification_id),
 updated_at TEXT NOT NULL
);

CREATE TRIGGER api_football_mapping_head_insert
BEFORE INSERT ON api_football_team_mapping_heads
WHEN NOT EXISTS (
 SELECT 1 FROM api_football_team_mapping_qualifications q
 WHERE q.qualification_id=NEW.qualification_id AND q.fpl_season=NEW.fpl_season AND q.state='COMMITTED' AND q.mapping_count=20
)
BEGIN SELECT RAISE(ABORT,'api_football_mapping_head_not_committed'); END;

CREATE TRIGGER api_football_mapping_head_update
BEFORE UPDATE ON api_football_team_mapping_heads
WHEN NOT EXISTS (
 SELECT 1 FROM api_football_team_mapping_qualifications q
 WHERE q.qualification_id=NEW.qualification_id AND q.fpl_season=NEW.fpl_season AND q.state='COMMITTED' AND q.mapping_count=20
)
BEGIN SELECT RAISE(ABORT,'api_football_mapping_head_not_committed'); END;

CREATE INDEX api_football_mapping_members_provider ON api_football_team_mapping_members(provider_team_id,qualification_id);
