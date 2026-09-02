-- Additive, online-safe lookup support for the repository-owned production reads.
CREATE INDEX observation_heads_observation_id ON observation_heads(observation_id);
CREATE INDEX shadow_observations_ingestion_run ON shadow_observations(ingestion_run_id, source_revision_id);
CREATE INDEX observation_rejections_source_revision ON observation_rejections(source_revision_id);
INSERT INTO schema_migrations (version, name, applied_at)
VALUES (3, 'production_query_plan_indexes', '2026-09-02T00:00:00.000Z');
