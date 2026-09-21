# API-Football migration 0006 and private mapping production foundation

## Status

Migration 0006 schema is live. Private mapping persistence is not accepted as complete. Runs `35575463178` and `35587588095` each submitted one mutation and ended `AMBIGUOUS_REQUIRES_OWNER_ATTENTION`; both remain consumed and must never be rerun. Full 43-statement execution against a database migrated through 0006 proved the deterministic defect: the qualification insert declared 18 placeholders while the writer bound 17 values. D1 batch transaction semantics therefore prevented complete persistence. The repository-only remediation corrects that mismatch; no production action is authorized by the correction.

The writer now retains only closed non-sensitive outcome facts: category, bounded statement/request/result counts, response-presence/status, failed statement index and validated numeric provider code. It never retains SQL, parameters, messages, raw bodies, URLs, credentials, account/database identifiers, private IDs, crosswalk contents, mapping pairs or receipts. Comprehensive reconciliation includes aggregate relevant `entity_mappings`; explicit rejection is definite non-application only with exact empty reread. Transport uncertainty, malformed/lost response, partial state and reread uncertainty stay ambiguous. No retry or automatic restore exists.

Repository implementation now includes a separate dormant, manual mapping-persistence-only workflow. A future dispatch needs separate explicit owner approval after merge, exact-current-main verification, exact-head Verify Teamsheet success, validation of that approved reconciliation artifact and fresh production admission evidence.

No API-Football request occurred. The collector remains disabled, unconfigured and undeployed; `API_FOOTBALL_API_KEY`, Cron and `PRELIVE_PLANNER_ONLY` remain outside scope. No model, calculation or product path changed.

## Two-phase boundary

`.github/workflows/api-football-migration-0006.yml` applies two ordered, independently reconciled phases under the shared `data-s2-production-collection` lock.

1. **Schema:** a fresh read-only preflight must prove `READY_FOR_MIGRATION_0006`, exact migrations 0001–0005, current 20-team Official FPL authority, zero foreign-key violations, disabled runtime and absent collector/Cron/API-key binding. Account-wide D1 rows written must not exceed 50,000. The runner pins the 6,632-byte, 12-statement migration blob, obtains a D1 Time Travel checkpoint, submits the batch once, never automatically restores, and reconciles actual D1 state after any uncertain result. Independent postflight must prove `READY_FOR_PRIVATE_MAPPING_PERSISTENCE`, exact migrations 0001–0006 and zero mapping rows.
2. **Private mapping:** another fresh read-only admission and write-budget check runs before the secret enters scope. Only the mutation step receives `API_FOOTBALL_OWNER_CROSSWALK_JSON`. It revalidates the hash-bound owner crosswalk, qualification receipts, provider-universe provenance, trusted anchors and a freshly fetched two-request Official FPL authority in memory. It sends private values only as D1 parameter bindings, commits only an exact 20/20 bijection, then independently validates the durable qualification/head. It makes zero API-Football requests.

Reruns are refused. Exact protected current `main` and exact-head Verify success are mandatory. Mutation transport uncertainty stops further mutation, triggers read-only reconciliation and yields either a definite classification or `AMBIGUOUS_REQUIRES_OWNER_ATTENTION`. No blind retry or automatic production restore exists.

## Evidence boundary

Reports and retained artifacts contain only classifications, aggregate counts, approved integrity hashes/provenance, Official FPL authority digest/time, closed bounded D1 outcome fields and zero-request/change counters. They omit crosswalk rows, provider IDs, SQL parameters/text, raw request/response bodies or messages, URLs, credentials, account/database identifiers, private IDs, mapping plans and receipt bodies. Persistence hashes are authority-snapshot-bound and may legitimately change between fresh attempts; reconciliation validates dynamic hash shape, qualification-ID binding, fixed provenance, member relationships and exact cardinality rather than pinning one earlier attempt's hash.

## Future owner gate

Before any dispatch, independently prove: merged exact current `main`; successful exact-head Verify Teamsheet; protected-environment and secret availability without reading secret values; fresh `READY_FOR_MIGRATION_0006` production state; exact accepted migration 0005 predecessor; current 20-team Official FPL authority; zero foreign-key violations; disabled runtime; absent collector deployment/Cron/API-key binding; account-wide D1 rows written at or below 50,000; and reviewed D1 Time Travel availability. Owner must then explicitly approve one new attempt. Failure after either mutation requires reconciliation and new owner review, never a GitHub rerun.

## Independent read-only admission workflow

A dedicated manual-only workflow, `.github/workflows/api-football-migration-0006-readonly-preflight.yml`, can collect fresh `schema_pre` evidence without starting the mutation-capable migration workflow. It requires exact current `main`, an exact-head successful `Tests and deterministic build` check, and the existing `data-steward-readonly` environment. It reuses `workers/data-platform/migration6/preflight.mjs`, including the 50,000-row current-UTC-day D1 admission ceiling, and retains only the sanitized preflight report.

The workflow has no production D1 write token, private crosswalk secret, `API_FOOTBALL_API_KEY`, migration runner, deployment command, schedule/secret mutation or API-Football egress. Its successful result can establish fresh `READY_FOR_MIGRATION_0006` admission evidence, but it cannot apply migration 0006 or persist the private mapping.

D1 Time Travel checkpoint availability is intentionally not probed by this read-only workflow. The existing production runner obtains the checkpoint immediately before mutation using the separately gated production identity. Therefore Time Travel availability remains a distinct attended execution precondition and must not be inferred from read-only preflight success.


## Attended mapping-persistence-only gate

`.github/workflows/api-football-mapping-0006-persistence.yml` is distinct from both consumed executions. Before protected writer credentials become eligible, it requires first workflow attempt, exact protected current `main`, exact-head `Tests and deterministic build` success, exact reconciliation run/artifact identity and archive hash, exact `NO_SUBMITTED_MAPPING_STATE_VISIBLE` classification with zero reported mutations/provider requests, pinned provider-universe archive and payload integrity, and fresh independent `mapping_pre`. The protected crosswalk must be nonempty and enters only the persistence step. That step invokes `workers/data-platform/run-migration-0006.mjs` with `MIGRATION_0006_PHASE: mapping`; no schema phase exists. Independent read-only `mapping_post` runs after any non-skipped persistence attempt and retains sanitized evidence. Remediation requires no workflow or security-boundary change.

The workflow contains no `API_FOOTBALL_API_KEY`, provider endpoint, schema execution, automatic restore, deployment, secret/Cron mutation, collector activation or product/model path. Creating or merging it does not authorize dispatch.
