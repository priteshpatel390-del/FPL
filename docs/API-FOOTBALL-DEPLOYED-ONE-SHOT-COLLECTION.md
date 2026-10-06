# API-Football Controlled Deployed One-Shot Shadow Collection

Date: 6 October 2026

> **Consumed.** Workflow run `37505586273` ran this path once on main `a8d4e78f022259868208e097fc779f9de768b2f6`: its single Deployment POST applied (exact Deployment `2417a3e0-15db-4e45-a3c8-00b148a300f4`) although the response was classified ambiguous, and production finished inert with no provider request. It must never be rerun. Its zero-Deployment start assumption is superseded by [API-FOOTBALL-DEPLOYED-ONE-SHOT-CONTINUATION.md](API-FOOTBALL-DEPLOYED-ONE-SHOT-CONTINUATION.md); the text below is the historical design record.
Status: owner-approved **repository implementation only**. Nothing in this record has been executed live. Dispatch of the workflow, any Cloudflare Deployment, workers.dev change, D1 collection enablement, trigger request or API-Football request requires a separate explicit owner approval after draft-PR review, exact-head green CI, owner-approved merge and post-merge exact-main verification.

## Starting state

- Repository baseline: main `9b8e5ccc635c192512f2d4f94bb369e87c2c1f9a` (PR #310). Post-merge Verify Teamsheet run `37492679444` passed 2,467/2,467 tests with deterministic builds and exact manifest identity.
- Abandoned-replacement topology closeout run `37493107003` on that exact main returned `REPLACEMENT_ABANDONED_TOPOLOGY_SAFE` (`topologySafeProved: true`). Replacement-v2 recovery is closed as an active concern; it is not used, repaired or modified here.
- The original collector `teamsheet-api-football-shadow-collector` (Worker ID `ae69aec0b6484b8f89b44e96b5eb86b8`) holds exactly three inactive Versions: original blocked `e49ac8f2-…`, reviewed attended `04d79556-3070-429f-9944-b5b53d799842` (immutable provenance `69bb84fadbcce94e9fece3ff438d985866cce183`) and byte-identical Gate C clone `7405abc0-8358-4156-8226-b6cc7bcf244f` (provenance `cdb7d7ba140c38395893f223c42aee90d33b8b59`). It has zero Deployments, Cron, routes and custom domains, with workers.dev and Preview disabled.
- No successful production API-Football collection has ever occurred.

## What was implemented

| File | Purpose |
|---|---|
| `workers/api-football-collector/deployed-one-shot.mjs` | Pure contract: pinned identities, ceilings, closed runtime SQL, admission/reconciliation classifiers, trusted workers.dev target derivation, Deployment body/identity checks, and the pure orchestrator that always runs cleanup. |
| `workers/api-football-collector/deployed-one-shot-readonly.mjs` | Read-only admission and independent reconciliation. Reuses the existing `VERSION_URL_CREATION_EXPERIMENT_CLOSEOUT` live preflight (exact three-Version inventory, D1 foundational state) plus the existing independent zone-scoped Workers Routes scan and one Deployments read. |
| `workers/api-football-collector/run-deployed-one-shot.mjs` | Protected executor with a closed Cloudflare endpoint allowlist, fresh critical recheck, one Deployment, workers.dev on/off, bounded D1 enable/disable and exactly one trigger. |
| `.github/workflows/api-football-deployed-one-shot-collection.yml` | Dormant, manual, exact-main, first-attempt-only workflow: repository gate → read-only admission → protected execution → always-run read-only reconciliation. |
| `tests/api-football-deployed-one-shot.test.mjs` | Permanent regression coverage. |

The only shared-code change is that `readReplacementRouteTopology` accepts a `workerName` (default unchanged: the replacement Worker) so the same zone-route scan can count routes targeting the original collector.

No collector runtime, provider, validation, persistence, mapping, model or UI code changed. No new Worker and no new Version are created.

## Sequence (when separately approved and dispatched)

1. **Repository gate** — `workflow_dispatch` on `refs/heads/main`, `run_attempt == 1`, exact approved SHA equals event SHA, `HEAD` and remote main; clean tree; exact-head `Tests and deterministic build` success; focused tests.
2. **Fresh read-only admission** (`data-steward-readonly`) — the lifecycle-closeout preflight must classify `VERSION_URL_CREATION_EXPERIMENT_RECONCILED`, and the one-shot classifier independently requires: exact account fingerprint, approved SHA and both immutable Version provenances; migrations 0001–0006; zero FK violations; fresh valid 20-team Official FPL authority; committed exact-20 mapping with current coverage; exact attended Version identity and exact three-Version inventory; exact Worker ID; `ATTENDED_ONE_SHOT_DISCOVERY` activation binding; production D1 binding; secret bindings present **by name/type only** (`API_FOOTBALL_API_KEY`, `API_FOOTBALL_ATTENDED_TRIGGER_SECRET`); workers.dev and Preview disabled; zero Deployments, Cron, legacy routes and custom domains; collection disabled; credential `AVAILABLE`; no lease; pristine attempt/generation/fixture history; zero model/UI imports; no raw-payload table. The independent zone route scan must find zero routes targeting the collector. Output: `READY_FOR_DEPLOYED_ONE_SHOT_COLLECTION`, artifact SHA-256 bound into the next job.
3. **Protected execution** (`api-football-attended-acceptance`) — reconfirms exact main and the admission artifact hash, validates the handoff, then re-runs the same preflight with the protected read credential immediately before the first mutation. Any drift stops before mutation as `DEPLOYED_ONE_SHOT_CRITICAL_STATE_DRIFT__<reason>`. It then repeats the authoritative zone-scoped Workers Routes scan (`readReplacementRouteTopology` with `workerName` = the original collector, GET-only, using the distinct topology-read credential) and requires `ZONE_ROUTE_SCAN` proof with zero matching routes. A scan failure, malformed or ambiguous result, or any matching route stops before the first mutation as `DEPLOYED_ONE_SHOT_FINAL_ROUTE_SCAN_FAILED` / `DEPLOYED_ONE_SHOT_FINAL_ROUTE_SCAN_NOT_INERT`, with zero Deployment, workers.dev, D1 or trigger requests and no retry. This closes the gap between admission and Deployment.
   1. `POST /workers/scripts/{collector}/deployments` with `{strategy:"percentage", versions:[{version_id:"04d79556-…", percentage:100}]}` and a `workers/message` annotation naming the approved SHA. The response must select exactly that Version at 100%.
   2. `GET …/deployments` (read credential) must show exactly one Deployment with that ID and Version.
   3. `POST …/subdomain` `{enabled:true, previews_enabled:false}`; the response must echo exactly that state.
   4. Up to seven secret-free GETs (waits 0/2/5/10/20/30/45 s) to `https://teamsheet-api-football-shadow-collector.<account-subdomain>.workers.dev/__teamsheet/api-football/attended-one-shot` must observe the collector's own signature (404, `Not found`, `no-store`, `text/plain`). The hostname is derived only from the account subdomain returned by the critical preflight and closed repository constants.
   5. D1: `UPDATE api_football_runtime_state SET collection_enabled=1 WHERE provider=? AND collection_enabled=0 AND credential_state=? AND in_flight_attempt_id IS NULL` — exactly one row must change.
   6. Exactly one POST with `x-teamsheet-attended-trigger` to the same URL. The existing constant-time guard and `runScheduledCollector` composition perform at most the five existing discovery requests with existing quota, reservation, lease, byte/row ceilings, semantic validation and atomic generation persistence.
   7. **Cleanup on every exit path**: D1 `UPDATE … SET collection_enabled=0 WHERE provider=? AND collection_enabled=1` (0 or 1 changed rows accepted, because the collector may already have disabled itself), then `POST …/subdomain {enabled:false, previews_enabled:false}`. Both are always attempted, each independently.
4. **Independent read-only reconciliation** (`data-steward-readonly`, runs on any outcome) — re-reads the preflight state, the Deployments list and the zone route scan. Success is classified only from that read state.

## Safety boundary

- **Provider ceiling:** at most five discovery requests for the five already-approved competitions; no lineups, players, events, enrichment, arbitrary fixture IDs, new endpoint or retry beyond existing contracts. The executor itself makes zero provider requests and never holds `API_FOOTBALL_API_KEY`; the key exists only as a binding on the reviewed Version.
- **Cloudflare mutation ceiling:** one Deployment create, one workers.dev enable, one workers.dev disable. Closed endpoint allowlist: `POST deployments`, `GET deployments`, `POST subdomain`, `POST d1 query`. Version upload, schedules, routes, domains, Preview enablement, `PUT` and `DELETE` are refused before network.
- **D1 mutation ceiling:** two calls, two statements, two changed rows, both repository-owned and closed.
- **Trigger ceiling:** one request. Transport ambiguity, rejection or `409 Not accepted` never produce a second request.
- **No retry:** Deployment rejection, Deployment ambiguity (transport, unparseable, 5xx, wrong Version echoed), readback mismatch, workers.dev ambiguity, readiness failure and D1 ambiguity all stop without resubmission. `retryAuthorized` is always `false`.
- **Cleanup never manufactures success:** execution `ok` requires an accepted trigger **and** both cleanups succeeding. Primary failure and cleanup failure are recorded separately.
- **No destructive repair:** no automatic D1 rollback, Deployment deletion, Version deletion or replacement-v2 change.
- **Secrets:** the trigger secret and mutation/read tokens appear only in the protected step environment; evidence serializes only closed enums, counts, the Deployment ID and booleans. Read and mutation credentials must differ; the trigger secret must differ from both and be at least 32 characters.
- **Model/product isolation:** API-Football remains shadow-only; no import from production model/UI paths; the build and deployable are unaffected.

## Reconciliation classifications

- `DEPLOYED_ONE_SHOT_RECONCILED_SUCCESS` — workers.dev and Preview off, collection disabled, Cron 0, custom domains 0, legacy and zone routes 0, exactly one Deployment selecting the exact Version at 100% (matching the execution's Deployment ID), credential `AVAILABLE`, no lease, exactly five attempt-1 succeeded requests, no attempt 2, one committed generation with consistent membership and head, 0–2,500 fixture revisions, no reserved/staging/uncertain state, foundational state still exact, zero model/UI imports, no raw-payload table, and valid execution evidence recording exactly one trigger.
- `DEPLOYED_ONE_SHOT_CLEAN_STOP_NO_PROVIDER_REQUEST` — topology inert and history still pristine. Not success; no retry authorized; a later attempt needs a new owner gate.
- `DEPLOYED_ONE_SHOT_OWNER_ATTENTION_REQUIRED` — any other state, with a closed reason (e.g. `workers_dev_cleanup_incomplete`, `deployment_identity_unexpected`, `authentication_failure`, `quota_blocked`, `reserved_attempt_unresolved`, `collection_state_ambiguous`).

## Deployment lifecycle decision

- **Existing behaviour:** the original collector has never had a Deployment; every prior path used inactive Versions and the Preview mechanism.
- **Proposed post-run topology:** one Deployment selecting the reviewed attended Version at 100%, with workers.dev off, Preview off, Cron 0, routes 0, custom domains 0 and collection disabled.
- **Why it is retained:** Cloudflare documents Deployments as explicit, separate actions; a Deployment with no traffic surface receives no requests. With no Cron trigger the `scheduled()` handler cannot fire, and with workers.dev off and no route/domain the `fetch()` handler is unreachable. Even if invoked, the collector runs only with `collection_enabled=1` and a valid trigger secret. Deleting the Deployment would add a destructive mutation with no safety gain and would erase the exact serving evidence.
- **Rollback/recovery:** no automatic rollback. If cleanup is incomplete, reconciliation reports owner attention and the owner decides the manual remedy (for example disabling workers.dev or collection). Credential cleanup/revocation remains a separate gate.
- **What a later scheduled-shadow checkpoint inherits:** an inert production Deployment of the reviewed Version plus one committed shadow generation. Adding Cron, changing collection cadence or deploying a different Version are each separate future owner gates.

## Equipment / credentials

Reused, names only:

- `data-steward-readonly`: `DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID`, `DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT` (var), `DATA_STEWARD_CLOUDFLARE_READ_TOKEN`, `CLOUDFLARE_REPLACEMENT_TOPOLOGY_READ_TOKEN` (Zone Read + Workers Routes Read, proven by run `37493107003`).
- `api-football-attended-acceptance`: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ACCOUNT_FINGERPRINT` (var), `CLOUDFLARE_ATTENDED_READ_TOKEN`, `CLOUDFLARE_ATTENDED_MUTATION_TOKEN`, `API_FOOTBALL_ATTENDED_TRIGGER_SECRET`, plus `CLOUDFLARE_REPLACEMENT_TOPOLOGY_READ_TOKEN` (exposed as `CLOUDFLARE_TOPOLOGY_READ_TOKEN`, read-only, used only for the final pre-mutation route scan). This environment does not currently hold that secret; see the prerequisite below.

The mutation token already performed Script Subdomain and D1 control mutations in earlier attended runs. Cloudflare's Deployments create endpoint requires the same Workers Scripts edit capability as the Script Subdomain endpoint, so the existing token **appears** sufficient. The repository cannot read token scopes; the owner should confirm `CLOUDFLARE_ATTENDED_MUTATION_TOKEN` carries Workers Scripts Edit and D1 Edit on the production account before dispatch. If it does not, the Deployment step fails closed as `DEPLOYED_ONE_SHOT_DEPLOYMENT_REJECTED` before any traffic surface or D1 change, and cleanup runs.

## Limitations

- Not executed live. No Deployment, workers.dev change, D1 write, trigger or provider request has occurred.
- **Prerequisite:** `CLOUDFLARE_REPLACEMENT_TOPOLOGY_READ_TOKEN` was provisioned in `data-steward-readonly`. Before dispatch, the owner must also make the same read-only secret available to `api-football-attended-acceptance`. If it is absent, the executor stops before any network request as `DEPLOYED_ONE_SHOT_ENVIRONMENT_INCOMPLETE`.
- Readiness proves Worker routing on workers.dev only; it cannot prove provider availability.
- Success proves one shadow generation was persisted; it proves nothing about model value. Any model influence still requires prospective evidence, predeclared ablation and separate owner approval.

## Later outcome

The continuation run `37511401491` reached the single trigger and ended with attempt 1 `TRANSPORT_UNKNOWN`. Investigation and repository remediation: [transport-unknown remediation](API-FOOTBALL-TRANSPORT-UNKNOWN-REMEDIATION.md).
