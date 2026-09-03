# DATA-S2B — migration 0003 protected production runner

**Status: repository runner ready for owner review. Migration 0003 remains UNAPPLIED in
production.** Preparing this record performed no Cloudflare request, no workflow dispatch, no D1
read or mutation, no deployment, no schedule change and no credential or environment change.

## Why a dedicated runner

`workers/data-platform/migrations/0003_production_query_plan_indexes.sql` was reviewed and merged,
but the repository had no mechanism that could ever apply it to production. The historical
migration-0002 executable (`workers/data-platform/phase1/migrate-0002.mjs` and its workflow)
remains permanent evidence of that one application and is deliberately **not** generalised: making
it accept a second migration would turn a single-purpose reviewed artefact into a generic
migration executor. This runner is a separate, single-purpose mechanism for migration 0003 only,
and reuses the current production D1 REST identity and credential architecture rather than the
Phase 1 Worker-settings identity path.

## Files

| File | Role |
| --- | --- |
| `workers/data-platform/migration3/migration-0003-contract.mjs` | Pure pinned contract: path, size, digest, the four reviewed statements, index/ledger semantics, the three permitted live states, state classification, post-state acceptance and the migration-only resource model |
| `workers/data-platform/migration3/apply-migration-0003.mjs` | Orchestrator: identity proof, pinned migration read, bounded pre-reconciliation, budget gate, one migration request, ambiguity reconciliation, postflight acceptance, sanitized classification |
| `workers/data-platform/run-migration-0003.mjs` | Protected entry point: single attempt, masks live identifiers, writes only a bounded sanitized summary |
| `.github/workflows/data-s2b-migration-0003.yml` | Manual-only protected workflow with a repository/CI gate that completes before credentials exist |
| `workers/data-platform/official-fpl-d1-rest-plan.mjs` | Gains two additive trusted plans: the fixed reconciliation read and the migration mutation, which accepts only the byte-exact reviewed statements |
| `tests/data-s2b-migration-0003-runner.test.mjs` | Permanent protection for every property below, including a local SQLite proof against migrations 0001-0003 |

## Pinned migration semantics

Migration 0003 is unchanged. No defect was found in it. It creates
`observation_heads_observation_id` on `observation_heads(observation_id)`,
`shadow_observations_ingestion_run` on
`shadow_observations(ingestion_run_id, source_revision_id)` and
`observation_rejections_source_revision` on `observation_rejections(source_revision_id)`, then
inserts exactly one ledger row: version `3`, name `production_query_plan_indexes`, applied at
`2026-09-02T00:00:00.000Z`. It deliberately carries no `IF NOT EXISTS` and no conflict-ignore
behaviour, and a permanent test proves that fail-closed property and that reapplication fails
without duplicating the ledger row. Migrations 0001 and 0002 remain byte-for-byte unchanged, and
their exact sizes are pinned.

The runner reads the migration file itself and proves its byte length (506), its SHA-256
(`608a9c9c04cf9685494f7c500622d03eb46b3b32c2aa23a30694b9466c6ebcb1`), its four-statement count and
byte-exact equality with the reviewed statements before anything is dispatched.

## Executable mutation surface

Exactly one reviewed migration request, containing exactly the four repository-owned statements
with no bound parameters. `buildMigration0003Mutation()` rejects anything else, so no caller and
no workflow input can introduce arbitrary SQL, a different migration, a different version, or a
table or index name of its own. The workflow's only input is `approved_sha`. There is no SQL
input, no migration path or version input, no dynamic migration selection, no generic
"apply migration N" mechanism, no shell-constructed SQL and no Wrangler migration execution —
the workflow removes any Wrangler binary before running the entry point.

## Pre-mutation reconciliation

One bounded read-only request returns the complete migration ledger, only the three reviewed index
objects from `sqlite_master`, and one aggregate application-data and integrity row. It resolves to
exactly one of three states.

| State | Meaning | Action |
| --- | --- | --- |
| `exact_pre_state` | Ledger is exactly versions 1 and 2 with their exact names and timestamps; version 3 absent; none of the three indexes present | The only state that may permit the mutation |
| `already_applied` | Ledger carries exactly one version-3 row with the exact name and timestamp, and all three indexes exist with their exact `CREATE INDEX` text and table | No migration SQL is issued; the run completes on this bounded readback and reports `DEFINITELY_ALREADY_APPLIED`. No live `EXPLAIN` is run |
| `inconsistent` | Anything else — indexes without the ledger row, the ledger row without its indexes, a partial index set, a same-named index over the wrong table, columns or column order, a wrong version-3 name or timestamp, or unexpected ledger ordering | Fail closed, no mutation, sanitized report, owner attention required |

## Remote-main double gate

The repository gate proves the approved SHA equals remote `main` before the credentialled job is
admitted, but protected-environment admission can wait indefinitely and `main` may advance in that
window. The credentialled job therefore resolves remote `main` **again**, from the remote and never
from a value carried out of the gate job, in the same shell and immediately before the production
entry point — after the Node, HEAD and clean-tree reconfirmations and with nothing between the
check and the entry point. It requires the resolved value to be non-empty and exactly equal to the
approved SHA, so a `main` that moved during the approval wait stops the run before the runner is
invoked and before any Cloudflare request is made. The check reaches GitHub only. A permanent test
executes the exact shell of that step against stubbed `git` and `node` binaries and proves the
runner is reached when remote `main` still matches and is never reached when it has moved or
cannot be resolved.

## Ambiguous mutation outcome

A lost connection, a timeout, a malformed body, an unexpected result cardinality or any other
outcome that cannot prove completion makes the mutation state **unknown**. The runner never infers
success from HTTP 200 and never infers a no-write from a thrown request error. It immediately
performs one bounded read-only reconciliation and classifies exactly one of:

- `DEFINITELY_APPLIED_SUCCESSFULLY`
- `DEFINITELY_ALREADY_APPLIED`
- `DEFINITELY_NOT_APPLIED`
- `AMBIGUOUS_REQUIRES_OWNER_ATTENTION`

No second migration mutation is ever issued inside one execution, no classification is retryable,
and a workflow re-run is refused (`workflow_retry_forbidden`). A retry is only ever a future
separately approved dispatch whose own fresh reconciliation proves the complete exact pre-state
again. A run whose migration definitely completed but whose postflight or resource check then
failed is reported as `AMBIGUOUS_REQUIRES_OWNER_ATTENTION`, never as a no-write.

## Post-mutation validation

Once the single migration request has been issued — whether its response was definite, malformed or
lost, and whether or not a resource ceiling has already been crossed — the resulting production
state is always established. The runner performs exactly one fixed bounded read-only
reconciliation before classifying anything. A resource overrun never skips that read, and that read
never converts a resource overrun into successful acceptance: a definite migration whose postflight
is exact but whose provider accounting crossed this runner's ceiling remains
`AMBIGUOUS_REQUIRES_OWNER_ATTENTION` with an explicit `postflight_resource` phase and the accounting
attached. A definite migration whose postflight is inconsistent likewise remains owner attention.
The reconciliation is read-only and never makes the mutation retryable; the maximum mutation count
stays exactly one and no fourth D1 request is reachable on any path.

Success therefore requires all three of a definite exactly-shaped response, an exact proved
post-state, and provider accounting inside this runner's own ceilings. The post-state requires: exactly one version-3 ledger row, version exactly `3`, name exactly
`production_query_plan_indexes`, applied at exactly `2026-09-02T00:00:00.000Z`, all three indexes
present with their exact definitions, and migrations 0001/0002 intact. Every protected
application-data fact must be identical across the mutation — `ingestion_runs`,
`shadow_observations`, `observation_heads`, `observation_rejections`, `canonical_entities`,
`data_sources`, `data_source_revisions`, accepted distinct logical keys, orphan heads, started runs
and completed runs — with exactly one additional `schema_migrations` row as the only permitted
change. Append-only observation count is never equated with head count; they are separate facts.
The unresolved first production `started` run is only counted: the runner contains no `UPDATE` and
no `DELETE`, so it can never touch it.

## Resource accounting

Cloudflare's returned `meta.rows_read`, `meta.rows_written` and `changes` are the only provider
accounting, summed across every live request and enforced independently. Migration and index DDL
cost is treated as provider-observed, never claimed from logical table counts.

The routine production collection contract is unchanged and is **not** reinterpreted as a
migration allowance: 100,000 expected reads, 125,000 hard reads, 40,000 hard writes, 4,000 maximum
routine changed observations, eight D1 API calls, 16 MiB maximum D1 REST request and 8 MiB maximum
Official FPL response all stand as they are. This runner reasons its own narrow bound from its own
fixed statements: at most **three** D1 REST calls, at most **150,000** rows read and at most
**40,000** rows written. Before the mutation it derives a structural estimate from the live
population — two visits per observation, three per head and one per canonical entity for each
reconciliation read, plus one pass per indexed table for the index build, and one index entry per
source row plus the ledger row for writes — and fails closed if the complete planned migration
would not fit. At the current populated baseline of roughly 9,860 observations, 9,860 heads and
1,064 entities that model is about 120,528 rows read and 19,723 rows written. These are
conservative repository plan estimates, never an exact Cloudflare bill.

## Identity, credentials and disclosure

Identity uses the existing approved production mechanism unchanged: the runtime account is hashed
and must equal the repository-approved production account fingerprint, and the database must equal
the pinned production D1 identity. The workflow requests the existing
`data-s2-production-collection` GitHub Environment and its existing `CLOUDFLARE_ACCOUNT_ID` and
`CLOUDFLARE_D1_TOKEN` secrets and `CLOUDFLARE_PRODUCTION_*` variables. Requesting that environment
is what this repository can establish; whether it enforces required reviewers or any other
protection rule is owner-side GitHub configuration that repository evidence cannot prove, and the
remote-main double gate above does not depend on it. No credential is created,
rotated or widened, and no new secret name is introduced. Token, account and database identifiers
are masked before any request; the sanitized result and summary contain none of them. Raw
Cloudflare payloads stay in memory for the request only — they are never written to disk and never
uploaded as an artifact. It shares the production collection concurrency group, so a migration can
never run beside a collection or a first-run resume.

**Least-privilege limitation.** Whether the existing production D1 token may execute `CREATE INDEX`
through the D1 REST query endpoint is not proved here and cannot be proved without a live request.
If it cannot, the runner fails closed on the migration request, reconciles read-only, and reports
`DEFINITELY_NOT_APPLIED`. Permissions must not be widened in response; return to the owner.

## No live EXPLAIN

This runner never issues `EXPLAIN QUERY PLAN` against production, in any state. The fixed
current-head live-plan acceptance remains a separate later owner-approved gate. Query-plan
behaviour before and after migration 0003 continues to be proved locally against real SQLite by
`tests/data-s2-production-query-plan.test.mjs`.

## What remains blocked

Migration 0003 is not applied. The migration workflow has not been dispatched. The unresolved
first production run has not been resumed. No normal collection has been run. GitHub scheduling
remains disabled — no schedule trigger exists on any collection or migration workflow. Cloudflare
Cron remains intentionally absent and must not be restored. No production data, credential or
environment configuration was altered.

## Next gate

After merge and exact-main Verify Teamsheet, the next step is **explicit owner approval for one
migration-0003 production application** through this workflow, dispatched against the exact
approved `main` SHA. Live `EXPLAIN QUERY PLAN` acceptance, resuming the unresolved first
production run, normal production collection, GitHub scheduling and any Cron decision each remain
separate later gates.
