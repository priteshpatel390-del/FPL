# API-Football Gate C — Controlled New-Day Shadow Collection (repository only)

Date: 8 October 2026
Status: **owner-approved repository implementation candidate only**. No live dispatch is approved. No Cloudflare, D1, Worker routing, provider, credential or model mutation occurred during repository implementation.

## Authority and prerequisites

Gate A live run `37680114065` and Gate B live run `37688525299` are complete and consumed. PR #316 was merged as `bf15082bee56d8a6d5382055e1d873c29258d639`; exact post-merge Verify `37691491606` passed 2,582/2,582 tests with reproducible production output. The authoritative Gate B closeout is [here](API-FOOTBALL-TRANSPORT-REMEDIATED-DEPLOYMENT-PROMOTION-CLOSEOUT.md).

Historical runs `37505586273`, `37511401491`, `37680114065`, and `37688525299` must **never** be rerun. Attempt 1 of the historical 6 October discovery is `TRANSPORT_UNKNOWN` and remains consumed. Gate B left original Worker `teamsheet-api-football-shadow-collector` with exactly four Versions and two Deployment history rows. Active Deployment `9b48b57a-e505-4213-9547-fe44835a9bdb` selects corrected immutable Version `4171f3cf-953e-452e-9e5f-068df9a3ca47` at 100%. Historical Deployment `2417a3e0-15db-4e45-a3c8-00b148a300f4` remains unchanged, selecting old Version `04d79556-3070-429f-9944-b5b53d799842` as history. The candidate was created from immutable SHA `f01ccff5b13a4bbc98d7927cf620f69f46c4c54c`, not the Gate C execution SHA.

**Critical boundary:** those observations come from the Gate B reconciliation on 7 October, not a fresh direct Cloudflare read on 8 October. No collector/provider success has been proven. Gate C must obtain new independent live inventory before any execution. The generic daily Data Steward D1 observer currently requires migration 3 and failed with `D1_GOVERNANCE_MISMATCH`; its result cannot replace the dedicated six-migration admission.

## Existing versus proposed behaviour

Before: corrected Version is selected by an inert Deployment; workers.dev and Preview off, Cron/routes/domains zero, collection disabled; one historical failed generation, one `TRANSPORT_UNKNOWN` request; no successful provider generation.

Repository candidate: dormant `.github/workflows/api-football-gate-c-new-day-collection.yml` with exact current-main and first-run-only guards, existing shared concurrency group, protected read-only admission, protected single executor, and always-run independent reconciliation. It uses `gate-c.mjs`, `gate-c-readonly.mjs`, `run-gate-c.mjs` and tests. No new Version, Deployment, Worker, source, dependency, or D1 migration. Historical workflows retain their distinct admission contracts.

## Sixteen live-safety decision dimensions

1. **State:** preflight reads all four immutable Versions and their reviewed module bytes, two exact Deployments, zero matching zone routes, disabled workers.dev/Preview/Cron/domains, six migrations, no FK violations, valid current Official FPL authority, 20/20 committed mapping, collection disabled, credential AVAILABLE, no active lease, and exact previously consumed counters. Drift denies execution.
2. **Change:** temporary workers.dev enabled only for the existing authenticated path; collection enabled only after signature readiness; both disabled independently after any attempted activation. No other traffic surface.
3. **Invocation:** one POST to `/__teamsheet/api-football/attended-one-shot` on the fixed Worker account subdomain, with high-entropy `x-teamsheet-attended-trigger` secret. Unauthenticated paths are generically rejected. Temporary workers.dev is publicly reachable and carries this acknowledged exposure risk.
4. **Provider ceiling:** exactly five approved serial `GET /fixtures?league=<2|3|848|45|48>&season=2026` discovery calls maximum, no retry. Their API key remains Worker-side, never executor-side. The GitHub executor makes zero API-Football requests.
5. **D1:** at most two executor control D1 calls for enable/disable and two rows changed. The existing collector alone reserves up to five new attempt-1 identities for a distinct UTC day, stages one generation, writes bounded normalized fixture identities/revisions/memberships, and commits exactly one new discovery head after all five successful responses. Existing collector ceiling: 43 mutation statements, 2,500 admitted fixture rows. No raw provider payload warehouse; no schema/mapping mutation.
6. **Secrets:** reuse `CLOUDFLARE_ATTENDED_READ_TOKEN`, `CLOUDFLARE_ATTENDED_MUTATION_TOKEN`, `CLOUDFLARE_REPLACEMENT_TOPOLOGY_READ_TOKEN`, `API_FOOTBALL_ATTENDED_TRIGGER_SECRET` and only the existing Worker-side `API_FOOTBALL_API_KEY`; verify distinct credentials and minimum 32-character trigger. No new secret/rotation without later approval.
7. **Concurrency:** GitHub Actions `api-football-collector-attended-acceptance` shared non-cancelling serial group, `github.run_attempt == 1`; D1 atomic reservation and 30-second lease. Duplicate, overlapping or previously consumed logical requests fail closed.
8. **Retry:** historical attempt 1 remains consumed. Gate C creates new date-scoped logical IDs, not historical attempt 2. One trigger maximum, no workflow rerun or automatic retry. Any later collection needs another owner decision.
9. **Ambiguity:** timeout, rejected/unknown trigger, 409, malformed provider payload, 429, 401/403, incomplete paging, schema failure or uncertain D1 commit stops. A timeout does not prove zero provider requests. Readback is authoritative; never infer success from HTTP 202 alone.
10. **Fallback:** collection off and workers.dev off attempted independently after exposure; a cleanup failure never counts as success. Teamsheet continues using existing Official FPL/model behaviour.
11. **Validation:** existing 720,896-byte/2,000-response-row limits, valid empty/error-free envelope, exact query parameters and one-page coverage, verified competition/season, fixture identities and 20-team crosswalk. Only normalized approved shadow fixture evidence may persist.
12. **Owner attention:** no automatic Deployment rollback, Version deletion, D1 restore, quota reset, generation deletion or retry. Stop, preserve non-sensitive artifacts, independently inventory all mutations and explicitly review recovery.
13. **Security:** exact-head CI, protected environments, separate read/write/topology tokens, hash-bound admission/execution artifacts and guarded allowlist: Cloudflare GET inventory, POST to the existing `subdomain` and exact D1 control only; one authenticated Worker POST. Preview/Cron/domains/routes remain off. Worker and provider keys do not appear in logs or artifacts.
14. **Tests:** permanent synthetic tests for four Version identities, two Deployment order/identity, consumed history, new UTC day, changed mappings/topology, one trigger and both cleanups, forbidden write endpoints, completion and uncertainty, evidence tampering, and dormant workflow. Full suite, deterministic production rebuilds and identity verification required before draft PR approval.
15. **Success:** independent readonly state must find corrected active Deployment unchanged, old Deployment retained, zero traffic surface and no lease, six cumulative attempt-1 rows (historical TRANSPORT_UNKNOWN + five new SUCCEEDED), zero attempt-2, two generations (one historical FAILED + one new COMMITTED), exact membership/head, 0–2,500 fixture revisions, no uncertain states, and execution evidence with exactly one trigger and successful cleanup. A zero-fixture generation proves transport/persistence mechanics but not useful workload coverage.
16. **Still unproven:** provider reliability, prospective workload/accuracy value, calendar coverage, schema durability, repeat scheduling, model usefulness and any production FPL decision benefit. Future recurring collection and model influence remain separately gated.

## Execution and evidence boundaries

Workflow jobs: `repository-gate` → `fresh-readonly-admission` → `protected-one-shot-execution` → `final-readonly-reconciliation` (always runs after repository admission). Every job checks the same exact GitHub main SHA; protected execution checks the SHA and sha256-handoff; the final reader receives both execution and admission artifacts and checks their hashes. The executor re-reads the entire critical current Cloudflare state, exact four-Version identity, two Deployment rows and zone-route topology before workers.dev; it then verifies the same Deployment again immediately before enabling workers.dev. It uses the audited existing one-shot orchestration for mandatory disable steps on all post-enable outcomes.

Distinct collection day must be 8 October 2026 or later; the executing UTC day must equal the admitted day. The workflow is dormant. Workflow presence is **not dispatch authority**.

Expected final classifications: `GATE_C_NEW_DAY_SHADOW_GENERATION_COMMITTED_INERT` (only if independent success), `GATE_C_CLEAN_STOP_NO_NEW_COLLECTION` (not success) or `GATE_C_OWNER_ATTENTION_REQUIRED`. Every report carries `retryAuthorized:false`.

## Approval gates and exclusions

The 8 October approval covers a separate branch, repository-only code, tests, canonical docs and a draft PR. Merge requires a later explicit decision. Even after merge and exact-main green verification, a new live gate must explicitly authorize its **single** dispatch and provider ceiling, confirm the current safe Cloudflare/D1 state and credential scopes, and define owner attendance/response if cleanup fails.

**No live dispatch is approved.** No Cloudflare mutation, provider invocation, secret operation, D1 change, Deployment/Version creation, route activation or merge is part of this repository approval. No expected minutes, projected points, XI, captaincy, transfers, rank, Mini Leagues, rivals, decision intelligence, recommendations, strategies or other model/UI logic may change as a result.
