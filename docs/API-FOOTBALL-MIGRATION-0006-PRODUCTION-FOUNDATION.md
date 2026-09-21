# API-Football migration 0006 and private mapping production foundation

## Status

Repository implementation only. Production migration 0006 has **not** been executed, and the private 20/20 mapping has **not** been persisted by this checkpoint. The workflow is dormant and manual-only. A future dispatch needs separate explicit owner approval after merge, exact-current-main verification, exact-head Verify Teamsheet success and fresh production admission evidence.

No API-Football request occurred. The collector remains disabled, unconfigured and undeployed; `API_FOOTBALL_API_KEY`, Cron and `PRELIVE_PLANNER_ONLY` remain outside scope. No model, calculation or product path changed.

## Two-phase boundary

`.github/workflows/api-football-migration-0006.yml` applies two ordered, independently reconciled phases under the shared `data-s2-production-collection` lock.

1. **Schema:** a fresh read-only preflight must prove `READY_FOR_MIGRATION_0006`, exact migrations 0001–0005, current 20-team Official FPL authority, zero foreign-key violations, disabled runtime and absent collector/Cron/API-key binding. Account-wide D1 rows written must not exceed 50,000. The runner pins the 6,632-byte, 12-statement migration blob, obtains a D1 Time Travel checkpoint, submits the batch once, never automatically restores, and reconciles actual D1 state after any uncertain result. Independent postflight must prove `READY_FOR_PRIVATE_MAPPING_PERSISTENCE`, exact migrations 0001–0006 and zero mapping rows.
2. **Private mapping:** another fresh read-only admission and write-budget check runs before the secret enters scope. Only the mutation step receives `API_FOOTBALL_OWNER_CROSSWALK_JSON`. It revalidates the hash-bound owner crosswalk, qualification receipts, provider-universe provenance, trusted anchors and a freshly fetched two-request Official FPL authority in memory. It sends private values only as D1 parameter bindings, commits only an exact 20/20 bijection, then independently validates the durable qualification/head. It makes zero API-Football requests.

Reruns are refused. Exact protected current `main` and exact-head Verify success are mandatory. Mutation transport uncertainty stops further mutation, triggers read-only reconciliation and yields either a definite classification or `AMBIGUOUS_REQUIRES_OWNER_ATTENTION`. No blind retry or automatic production restore exists.

## Evidence boundary

Reports and retained artifacts contain only classifications, counts, approved integrity hashes/provenance, Official FPL authority digest/time and zero-request/change counters. They omit crosswalk rows, provider IDs, SQL parameters, request bodies, mapping plans and receipt bodies. Fixed failure classifications prevent parsed secret values from entering logs or reports.

## Future owner gate

Before any dispatch, independently prove: merged exact current `main`; successful exact-head Verify Teamsheet; protected-environment and secret availability without reading secret values; fresh `READY_FOR_MIGRATION_0006` production state; exact accepted migration 0005 predecessor; current 20-team Official FPL authority; zero foreign-key violations; disabled runtime; absent collector deployment/Cron/API-key binding; account-wide D1 rows written at or below 50,000; and reviewed D1 Time Travel availability. Owner must then explicitly approve one new attempt. Failure after either mutation requires reconciliation and new owner review, never a GitHub rerun.

## Independent read-only admission workflow

A dedicated manual-only workflow, `.github/workflows/api-football-migration-0006-readonly-preflight.yml`, can collect fresh `schema_pre` evidence without starting the mutation-capable migration workflow. It requires exact current `main`, an exact-head successful `Tests and deterministic build` check, and the existing `data-steward-readonly` environment. It reuses `workers/data-platform/migration6/preflight.mjs`, including the 50,000-row current-UTC-day D1 admission ceiling, and retains only the sanitized preflight report.

The workflow has no production D1 write token, private crosswalk secret, `API_FOOTBALL_API_KEY`, migration runner, deployment command, schedule/secret mutation or API-Football egress. Its successful result can establish fresh `READY_FOR_MIGRATION_0006` admission evidence, but it cannot apply migration 0006 or persist the private mapping.

D1 Time Travel checkpoint availability is intentionally not probed by this read-only workflow. The existing production runner obtains the checkpoint immediately before mutation using the separately gated production identity. Therefore Time Travel availability remains a distinct attended execution precondition and must not be inferred from read-only preflight success.
