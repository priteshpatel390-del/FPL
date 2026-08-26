PRAGMA foreign_keys = ON;

INSERT INTO schema_migrations (version, name, applied_at)
VALUES (2, 'official_fpl_structured_history', '2026-08-26T00:00:00.000Z');

-- DATA-S2A is private shadow history only. This classification approves durable
-- internal retention of the allowlisted Official FPL facts in this checkpoint;
-- it does not approve public redistribution or production recommendation use.
INSERT INTO data_sources (source_id, source_key, source_name, source_kind, created_at)
VALUES ('source-official-fpl', 'official-fpl', 'Official FPL API', 'official_fpl', '2026-08-26T00:00:00.000Z');

INSERT INTO data_source_revisions (
  source_revision_id, source_id, revision, schema_version,
  rights_classification, retention_allowed, redistribution_allowed,
  attribution_required, attribution_text, terms_reference, terms_reviewed_at,
  acquisition_status, shadow_ingest_allowed, supersedes_revision_id, created_at
) VALUES (
  'official-fpl-r1', 'source-official-fpl', 1, 'data-s2a-v1',
  'durable_allowed', 1, 0,
  0, NULL, 'docs/DATA_SOURCES.md', '2026-08-26T00:00:00.000Z',
  'approved_internal_shadow_history', 1, NULL, '2026-08-26T00:00:00.000Z'
);
