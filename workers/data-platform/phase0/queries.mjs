export const PHASE0_QUERIES=Object.freeze({
  schema:`SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN ('schema_migrations','data_sources','data_source_revisions','ingestion_runs','shadow_observations','observation_heads','canonical_entities') ORDER BY name`,
  migrations:`SELECT version, name, applied_at FROM schema_migrations ORDER BY version`,
  governance:`SELECT
    (SELECT COUNT(*) FROM data_sources WHERE source_id = 'source-official-fpl') AS source_official_fpl,
    (SELECT COUNT(*) FROM data_source_revisions WHERE source_revision_id = 'official-fpl-r1') AS official_fpl_r1`,
  counts:`SELECT
    (SELECT COUNT(*) FROM data_sources) AS data_sources,
    (SELECT COUNT(*) FROM data_source_revisions) AS data_source_revisions,
    (SELECT COUNT(*) FROM ingestion_runs) AS ingestion_runs,
    (SELECT COUNT(*) FROM shadow_observations) AS shadow_observations,
    (SELECT COUNT(*) FROM observation_heads) AS observation_heads,
    (SELECT COUNT(*) FROM canonical_entities) AS canonical_entities`,
  officialHistory:`SELECT
    (SELECT COUNT(*) FROM ingestion_runs WHERE source_revision_id = 'official-fpl-r1') AS ingestion_runs,
    (SELECT COUNT(*) FROM shadow_observations WHERE source_revision_id = 'official-fpl-r1') AS shadow_observations,
    (SELECT COUNT(*) FROM observation_heads h JOIN shadow_observations o ON o.observation_id = h.observation_id WHERE o.source_revision_id = 'official-fpl-r1') AS observation_heads`
});
