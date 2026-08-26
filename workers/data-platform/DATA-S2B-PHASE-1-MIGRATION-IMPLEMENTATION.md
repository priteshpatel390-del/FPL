# DATA-S2B — Phase 1 Migration 0002 Execution

Status: **repository execution path prepared; no Phase 1 live mutation performed by this record**  
Prepared: **26 August 2026**  
Baseline before this change: `2fe46d5dd9f1c880df3450b37260946e910bc1e2`

## Outcome and scope

Phase 0 live read-only Run #4 (`32996481967`) passed on the exact baseline above. It proved the expected pre-mutation state: `TEAMSHEET_DATA_DB -> teamsheet-data`, no DATA-S2 Cron, `DATA_S2_SEASON` absent, migration 0001 applied, migration 0002 pending, zero current DATA-S1/history rows, rollback evidence present, and the intended custom domain present.

The owner has separately approved **DATA-S2B Phase 1 migration 0002 only**. This repository change prepares the controlled execution path for that approved mutation. It does not itself run the migration.

Phase 1 is limited to the already-reviewed file:

`workers/data-platform/migrations/0002_official_fpl_structured_history.sql`

That migration records schema migration 2 and creates exactly the approved `source-official-fpl` / `official-fpl-r1` governance rows. It does not create ingestion runs, shadow observations, observation heads or canonical entities.

Explicitly excluded:

- Worker upload or deployment;
- `DATA_S2_SEASON` activation;
- Cron/trigger activation;
- route/domain/Access changes;
- secret or environment-variable changes on Cloudflare;
- provider changes;
- application/model/calculation changes;
- automatic Time Travel restore.

## Reuse Before Build

| Primitive | Classification | Decision |
|---|---|---|
| Phase 0 exact-main / exact-head CI repository gate | **Adopt** | Reuse unchanged before any write credential becomes available. |
| Worker D1 binding `database_id` + exact Get Database-by-ID | **Adopt** | Resolve the live database from Cloudflare's own binding identity; never hard-code the UUID. |
| Cloudflare D1 Query REST API | **Adopt** | Execute the exact repository-pinned migration without adding npm/Wrangler as a dependency. |
| Cloudflare D1 Time Travel bookmark | **Adopt** | Prove a rollback checkpoint exists immediately before mutation. |
| Phase 0 prestate SELECTs | **Adapt** | Re-run the critical prestate checks immediately before mutation. |
| `npx wrangler` / npm registry install | **Reject** | Conflicts with the repository's zero-dependency/no-registry operating constraint. |
| SQL supplied through workflow input | **Reject** | Only the exact repository migration file may be executed. |
| Automatic restore on failure | **Reject** | Restore is a separate destructive mutation and requires owner review/approval. |

## Workflow boundary

The manual workflow is:

`.github/workflows/data-s2b-phase1-migration-0002.yml`

It has one trigger (`workflow_dispatch`) and one required immutable `approved_sha` input.

The credential-free `repository-gate` requires:

1. canonical repository and `refs/heads/main`;
2. exact 40-character approved SHA;
3. exact checkout;
4. remote `main` still equals that SHA;
5. clean tree;
6. successful exact-head Verify Teamsheet `Tests and deterministic build`.

Only the dependent mutation job references the protected environment:

`data-s2b-phase1-migration`

The environment must be configured manually before live dispatch with required owner review, administrator bypass disabled and deployment branch restricted to `main`.

Required environment secrets are:

- `CLOUDFLARE_D1_WRITE_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The Phase 0 environment/token must remain unchanged. Do **not** replace or widen the existing read-only Phase 0 token.

The dedicated Phase 1 token should be restricted to the account and carry only the permissions needed by this workflow:

- **Workers Scripts Read** — re-read Worker deployment/settings/schedules;
- **D1 Write** — Cloudflare accepts D1 Write for Get Database, Query and Time Travel bookmark operations, and it is the permission required for the approved D1 mutation.

No Worker Edit permission is required or approved.

## Fail-closed live prestate

Immediately before the migration, the helper re-proves:

- valid rollback-capable Worker deployment history;
- exact pre-mutation Worker binding set;
- `DATA_S2_SEASON` absent;
- no Cron expressions;
- valid `TEAMSHEET_DATA_DB` binding;
- exact bound D1 UUID resolves to exact name `teamsheet-data`;
- migration state is exactly 0001 applied / 0002 pending;
- `source-official-fpl` and `official-fpl-r1` are absent;
- `data_sources`, `data_source_revisions`, `ingestion_runs`, `shadow_observations`, `observation_heads` and `canonical_entities` are all still zero;
- `official-fpl-r1`-attributable history remains zero.

Any drift stops before the write.

## Exact migration identity

The helper reads the migration from the repository and requires its SHA-256 to be exactly:

`a217726d5f164c3d117afed83201194004451384493f089914a7c42c725fde83`

No migration SQL is accepted from workflow inputs, environment variables, command-line arguments or network content.

Cloudflare documents that a SQL string containing multiple semicolon-separated statements is executed as a batch; D1 batch execution is transactional and aborts/rolls back the sequence when a statement fails. The helper still performs full post-state verification rather than treating the HTTP success alone as acceptance.

## Rollback checkpoint

Immediately before submitting the migration, the helper requests the current D1 Time Travel bookmark and fails closed if a valid bookmark is unavailable.

The exact bookmark is masked and retained only in `$RUNNER_TEMP`. A pre-mutation UTC timestamp is written to the GitHub job summary **before** the migration request, so a rollback point remains identifiable even if a later postcheck fails.

The workflow never calls the Time Travel restore endpoint. If rollback is needed, stop and present the failure evidence for separate owner approval.

## Required post-state

A PASS requires all of the following:

- migration list is exactly 0001 + 0002;
- 0002 is named `official_fpl_structured_history`;
- `source-official-fpl` exists exactly once with the approved source fields;
- `official-fpl-r1` exists exactly once;
- revision rights equal the reviewed migration contract:
  - `durable_allowed`;
  - retention allowed;
  - redistribution disabled;
  - attribution not required;
  - terms reference `docs/DATA_SOURCES.md`;
  - acquisition status `approved_internal_shadow_history`;
  - shadow ingest allowed;
- total `data_sources=1` and `data_source_revisions=1`;
- `ingestion_runs=0`;
- `shadow_observations=0`;
- `observation_heads=0`;
- `canonical_entities=0`;
- all `official-fpl-r1` history counts remain zero;
- Worker D1 binding remains unchanged;
- Worker deployment/version remains unchanged;
- `DATA_S2_SEASON` remains absent;
- Cron set remains empty.

Only after this evidence passes may Phase 1 be called successful. Phase 2 Worker Versions upload remains a separate approval gate.

## Safety and output

The token, account ID, D1 UUID and exact Time Travel bookmark are masked. Raw Cloudflare responses are written mode-restricted under `$RUNNER_TEMP`, are never uploaded, and are deleted by an unconditional shell trap.

The public job summary contains only the exact repository SHA, migration identity/result, approved governance identifiers, aggregate counts/invariants, database size before/after, rollback timestamp and confirmation that Worker/Cron state did not change.

## First-party Cloudflare basis

- Query D1 Database: https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/
- Get D1 Database: https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/get/
- D1 Time Travel bookmark: https://developers.cloudflare.com/api/resources/d1/subresources/database/subresources/time_travel/methods/get_bookmark/
- D1 Time Travel and backups: https://developers.cloudflare.com/d1/reference/time-travel/
- D1 batch semantics: https://developers.cloudflare.com/d1/worker-api/d1-database/

The separate write token and live protected environment must be established and reviewed before dispatch. Repository preparation and CI success alone do not mutate Cloudflare and do not prove Phase 1 acceptance.
