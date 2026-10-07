> **AUTHORITATIVE LIVE CLOSEOUT — 7 October 2026:** Gate B run `37688525299`, attempt 1, exact main `2516eeec669f3b44001f9cc5d22135dcbe0e235e`, completed successfully and is **consumed**. Exactly one Deployment POST applied and was independently reconciled as `TRANSPORT_REMEDIATED_DEPLOYMENT_PROMOTED_INERT`. Active Deployment `9b48b57a-e505-4213-9547-fe44835a9bdb` selects corrected Version `4171f3cf-953e-452e-9e5f-068df9a3ca47` at 100%; historical Deployment `2417a3e0-15db-4e45-a3c8-00b148a300f4` is retained unchanged. No Worker invocation or API-Football request occurred. The Gate B workflow must never be rerun. The pre-dispatch/repository-candidate wording below is retained as the historical design record and is superseded for current state by the [Gate B live closeout](API-FOOTBALL-TRANSPORT-REMEDIATED-DEPLOYMENT-PROMOTION-CLOSEOUT.md).

# API-Football Transport-Remediated Deployment Promotion (Gate B, repository only)

Repository-only checkpoint after merged PR #314 (main `f01ccff5b13a4bbc98d7927cf620f69f46c4c54c`) and the completed, consumed Gate A live run `37680114065`. Owner approval covers investigation, canonical recording of the Gate A outcome, repository implementation, tests, canonical documentation and a draft PR only.

**No Deployment has been created or changed. No Version was uploaded or changed. No workers.dev, Preview, Cron, route, domain, D1, secret or credential change occurred. No Worker was invoked and no API-Football request was made. No workflow was dispatched. Nothing was merged.** The live collector still selects the old immutable Version `04d79556-3070-429f-9944-b5b53d799842` at 100% through historical Deployment `2417a3e0-15db-4e45-a3c8-00b148a300f4`. The corrected Version `4171f3cf-953e-452e-9e5f-068df9a3ca47` exists but is **not active** until a later, separately approved Gate B live run.

## 1. Gate A live outcome — authoritative consumed history

Run `37680114065`, workflow `API-Football Transport-Remediated Reviewed Version Preparation`, attempt 1, exact execution main `f01ccff5b13a4bbc98d7927cf620f69f46c4c54c`, conclusion success (all four jobs: `repository-gate`, `fresh-readonly-admission`, `protected-version-upload`, `final-readonly-reconciliation`). **The run is consumed and must never be rerun.** Its workflow file now carries a `CONSUMED` header, and its admission can no longer admit the live state (it requires exactly three Versions).

Execution evidence (sanitized artifact, SHA-256 `a0f0c44b2ca0c00a266a50928bd0226fa678a7c571d62cbc2a839090cb101b1b`):

| Field | Value |
|---|---|
| classification | `TRANSPORT_REMEDIATED_VERSION_UPLOAD_SUBMITTED_RECONCILIATION_REQUIRED` |
| outcome | `CREATED` |
| new Version ID | `4171f3cf-953e-452e-9e5f-068df9a3ca47` |
| Version upload attempts | 1 |
| graph SHA-256 | `03db54c4faf0bfc08f52382e56fc165cadccb7337786581053328e07f2f8f6cc` |
| metadata SHA-256 | `67097c838c1e0f9a5f2c765ea17dff3eb690bb4e646688c35cab4c66055b1119` |
| module count | 17 |
| final route scan | `ZONE_ROUTE_SCAN`, route count 0 |
| production mutations | 1 (the Version upload) |
| Deployment / D1 / workers.dev / Preview mutations | 0 / 0 / 0 / 0 |
| API-Football requests | 0 |
| secret values serialized | 0 |
| retryAuthorized | false |

Independent read-only reconciliation (job log line, independently re-read for this record): `TRANSPORT_REMEDIATED_VERSION_PREPARED_NOT_DEPLOYED`, `ok:true`, `productionMutations:0`, `apiFootballRequests:0`, `secretValuesRead:0`. Its sanitized artifact additionally proved: candidate `4171f3cf…`; Version count 4; one active Deployment `2417a3e0…` still selecting the retained old Version at 100%; workers.dev false; Preview false; Cron 0; custom domains 0; legacy routes 0; zone routes 0; collection disabled; credential `AVAILABLE`; no lease; mapping 20/20 `COMMITTED`; Official FPL authority valid with 20 teams; model/UI imports 0; raw payload storage false.

Consumed provider history is unchanged: request attempts 1 (attempt 1 count 1, attempt 2 count 0), succeeded 0, `TRANSPORT_UNKNOWN` 1, generations 1 (failed 1, committed 0), fixture revisions 0, RESERVED 0, STAGING 0, persistence-uncertain 0, completion-uncertain 0.

Repository tooling could not download the artifact archives through this environment's proxy; the artifact-level values above are the owner-supplied sanitized evidence, and run identity, job conclusions, execution artifact hash and the reconciliation classification line were independently re-read from GitHub. No workflow has run against the collector since.

## 2. Immutable candidate provenance

Gate B never rebuilds the candidate identity from its own execution SHA. Pinned in `transport-remediated-deployment-promotion.mjs`:

| Constant | Value |
|---|---|
| `PROMOTION_CANDIDATE_VERSION_ID` | `4171f3cf-953e-452e-9e5f-068df9a3ca47` |
| `PROMOTION_CANDIDATE_CREATION_SHA` | `f01ccff5b13a4bbc98d7927cf620f69f46c4c54c` |
| `PROMOTION_CANDIDATE_GRAPH_SHA256` | `03db54c4…f8f6cc` |
| `PROMOTION_CANDIDATE_METADATA_SHA256` | `67097c83…5b1119` |
| `PROMOTION_CANDIDATE_MODULE_COUNT` | 17 |
| `PROMOTION_GATE_A_RUN_ID` | `37680114065` |

`buildPromotionCandidateIdentity()` calls `buildTransportRemediatedVersionIdentity(PROMOTION_CANDIDATE_CREATION_SHA)` and fails closed unless graph hash, metadata hash, module count and the 17 pinned module hashes all equal the live Gate A values. Passing any other SHA (including the Gate B execution SHA) is refused. The later execution main SHA is execution provenance only: it appears in the admission/execution evidence and the Deployment message, never in candidate identity. A candidate execution SHA different from the creation SHA is valid and expected; tests prove that an identity rebuilt from the execution SHA has different hashes and annotations and can never validate the candidate.

**None of the 17 reviewed Worker module bytes changed in this checkpoint.** If any of them changes, the identity becomes unavailable and every Gate B step stops before mutation.

## 3. Four-Version read-only admission

`transport-remediated-deployment-promotion-readonly.mjs` (`ADMISSION` mode, `data-steward-readonly`) reads the existing activation preflight, the Deployment list, the Version list, stable detail for all four Versions, module (beta) detail for the old attended Version, the Gate C clone and the candidate, and the authoritative zone route scan. `promotionAdmissionDiagnostic` requires:

- **preflight**: exactly the stale lifecycle STOP (`STOP_VERSION_URL_CREATION_EXPERIMENT_CLOSEOUT_REVIEW_REQUIRED` / `lifecycle_clone_inventory_unexpected`), consumed only against the observed fields through the same foundation checks Gate A used. With four Versions that preflight cannot prove its three-Version lifecycle inventory, so Gate B proves the Version inventory itself;
- **Versions**: exactly the four IDs — original blocked `e49ac8f2…`, old attended `04d79556…`, Gate C clone `7405abc0…`, candidate `4171f3cf…`; no fifth, none missing. Historical Versions stay under their existing contracts (`validateLifecycleExperimentInventory`: original via exact stable bindings, old attended and clone via exact stable + module bytes). The candidate is validated with `validateTransportRemediatedVersion` against the immutable Gate A identity: stable and beta id, compatibility date, exact D1/plain-text bindings, secret binding names and types with no value, main module, annotations, no Version URL, no package dependency, exact 17 module byte hashes;
- **Deployment**: exactly one row, the historical `2417a3e0…`, `percentage` strategy selecting only `04d79556…` at 100%, consistent with the preflight's Deployment count. Cloudflare returns the latest (active) Deployment first; the reader never infers activity from `created_on`;
- **topology**: workers.dev off, Preview off, Cron 0, custom domains 0, legacy routes 0, authoritative zone route scan 0;
- **runtime**: collection disabled, credential `AVAILABLE`, no lease;
- **consumed history**: exactly the shape above (attempts 1, attempt 1 count 1, attempt 2 count 0, succeeded 0, transport-unknown 1, generations 1, failed 1, committed 0, fixture revisions 0, RESERVED 0, STAGING 0, persistence/completion uncertain 0, zero auth/quota/timeout/schema/HTTP counts);
- **identity and isolation**: six migrations, zero FK violations, Official FPL authority valid (20 teams), mapping `COMMITTED` 20/20 with 20 distinct provider and FPL ids, model/UI imports 0, raw payload storage false.

Any mismatch stops before mutation with a closed reason. The sanitized admission artifact (`api-football-transport-remediated-deployment-promotion-admission-v1`) records the candidate provenance, sorted Version IDs, the normalized Deployment row (id, strategy, versions, `created_on`), topology and the preflight report; it contains no module content, credential or secret.

## 4. Exact Deployment body

`buildPromotionDeploymentBody(executionSha)`:

```json
{"strategy":"percentage","versions":[{"version_id":"4171f3cf-953e-452e-9e5f-068df9a3ca47","percentage":100}],
 "annotations":{"workers/message":"GateB v=4171f3cf-953e-452e-9e5f-068df9a3ca47 c=f01ccff5b13a4bbc98d7927cf620f69f46c4c54c x=<execution main SHA>"}}
```

One Version only, 100%, `percentage` strategy, no old Version, no split, no gradual rollout, **no `force`**. The message is deterministic and carries the full immutable provenance: `v=` immutable candidate Version, `c=` its full immutable 40-character creation SHA, `x=` the full execution main SHA. Cloudflare's Deployment API allows `workers/message` up to 1000 bytes, so no provenance field needs truncation. It contains no credential or secret. The serialized body is built before any network request and the guarded fetch accepts only that exact byte string.

## 5. Protected Deployment-promotion executor

`run-transport-remediated-deployment-promotion.mjs`, run only in the new protected environment `api-football-remediated-deployment-promotion`:

- before any network: GitHub re-run refusal (`GITHUB_RUN_ATTEMPT` must be `1`); refusal if `API_FOOTBALL_API_KEY`, `API_FOOTBALL_ATTENDED_TRIGGER_SECRET`, `CLOUDFLARE_ATTENDED_VERSION_UPLOAD_TOKEN` or `CLOUDFLARE_ATTENDED_MUTATION_TOKEN` is present; account fingerprint; **three distinct credentials**; exact approved SHA; the hash-bound admission artifact; the immutable candidate identity; the exact body;
- fresh Cloudflare-only recheck immediately before the POST: workers.dev/Preview off, Cron 0, custom domains 0, Deployment list still exactly the one historical row (same `created_on` as admission), authoritative zone route scan 0, exact four-Version inventory with candidate and historical identities. D1/history truth comes only from the admission artifact; the executor has **no D1 endpoint**. Any drift stops with zero POST;
- one POST through the guarded fetch, never resent.

### Guarded fetch

Allowed: `GET` with the read credential to exactly the collector's `/deployments`, `/subdomain`, `/schedules`, `/versions?deployable=true`, `/versions/<uuid>`, the beta `/workers/workers/<collector id>/versions/<uuid>?include=modules` and account `/workers/domains`; `GET` with the topology credential to the zone list and `/zones/<id>/workers/routes`; and exactly one `POST` to `/accounts/<account>/workers/scripts/teamsheet-api-football-shadow-collector/deployments` with the promotion credential and the exact body. Refused before network: a second Deployment POST, any other body, Version POST, every `/d1/` path, subdomain/workers.dev, Preview, schedules, routes, domains, Worker shell, DELETE, PUT, PATCH, any non-`api.cloudflare.com` host (so API-Football and workers.dev/Worker invocation are impossible), arbitrary URLs, the promotion credential on any GET, and the read/topology credentials on the POST.

Mutation ceiling (`PROMOTION_MUTATION_CEILINGS`): Deployment POST 1; Version upload, workers.dev, Preview, D1, schedules, routes, domains, Worker shell, DELETE, PUT, PATCH, API-Football and Worker invocation all 0.

## 6. Response classification

| Situation | Outcome |
|---|---|
| executor stopped before the POST | `NOT_SUBMITTED` |
| authoritative 4xx with a valid `success:false` + `errors[]` envelope | `REJECTED` (no readback, no second POST) |
| 2xx `success:true` whose result is a NEW Deployment id selecting only the candidate at 100% | `CREATED` (reconciliation still required) |
| transport failure, timeout, malformed body, invalid JSON, unclear envelope, 5xx, or accepted response without exact identity | bounded GET-only Deployment readback (0 s, 2 s, 5 s) |
| readback: exactly two rows, first a new id selecting only the candidate at 100%, second the unchanged historical row | `APPLIED_CONFIRMED_BY_READBACK` |
| readback still shows only the historical row after all attempts | `AMBIGUOUS_OWNER_ATTENTION` — **never** `NOT_APPLIED` |
| unreadable readback, three Deployments, wrong new Version, split, historical row missing or changed, accepted response contradicting the request or naming another id | `AMBIGUOUS_OWNER_ATTENTION` |

`NOT_APPLIED` is not an outcome of this path: bounded absence is not proof that an ambiguous POST did not apply. No outcome authorizes a retry.

### No automatic rollback

There is no rollback path. If the promotion definitely or possibly applied but the final state cannot be proven, the run stops for owner attention. A second Deployment selecting the old Version is never submitted, because every traffic surface remains off: an unproven promotion is safer to inspect read-only than to compound with another mutation. The only Deployment body the repository can build selects the candidate.

### Evidence

Closed sanitized shape (`api-football-transport-remediated-deployment-promotion-execution-v1`): execution SHA, immutable candidate id and creation SHA, outcome, new Deployment id, readback attempts, final route scan, `deploymentPostAttempts` = `deploymentMutations` = `productionMutations` (0 or 1), and `versionUploads`, `d1Mutations`, `workersDevMutations`, `previewMutations`, `scheduleMutations`, `routeMutations`, `domainMutations`, `workerInvocations`, `apiFootballRequests`, `secretValuesSerialized` all 0, `retryAuthorized:false`.

## 7. Independent post-promotion reconciliation

`RECONCILIATION` mode in `data-steward-readonly` reads state only. Success, **`TRANSPORT_REMEDIATED_DEPLOYMENT_PROMOTED_INERT`** — corrected Version promoted at 100% but still unreachable — requires:

- Versions: exactly the four, candidate exact to its immutable Gate A identity, historical Versions unchanged;
- Deployments: exactly two rows; the first (active) is a new id, not `2417a3e0…`, selecting only `4171f3cf…` at 100%; the second is `2417a3e0…` still selecting `04d79556…` at 100%; no third row;
- topology still inert: workers.dev off, Preview off, Cron 0, domains 0, legacy and zone routes 0;
- runtime/history unchanged: collection disabled, credential `AVAILABLE`, no lease, exact consumed history;
- isolation unchanged: mapping 20/20, Official FPL authority valid, model/UI imports 0, raw payload storage false;
- valid execution evidence with exactly one Deployment POST, a non-`REJECTED`/`NOT_SUBMITTED` outcome, a matching Deployment id where one was returned, and every other mutation counter and API-Football request at 0.

Unchanged one-row state with `NOT_SUBMITTED` or `REJECTED` evidence is `TRANSPORT_REMEDIATED_DEPLOYMENT_PROMOTION_CLEAN_STOP_NOT_PROMOTED` (non-success, no retry authority). Unchanged state after an ambiguous POST, evidence claiming a promotion that is not visible, and every partial or unsafe alternative is `TRANSPORT_REMEDIATED_DEPLOYMENT_PROMOTION_OWNER_ATTENTION_REQUIRED`.

## 8. Dormant manual workflow

`.github/workflows/api-football-remediated-deployment-promotion.yml`, `API-Football Transport-Remediated Deployment Promotion`: `workflow_dispatch` only with exact `approved_sha`; attempt 1 only on every job; exact current main before and after each environment wait; exact-head `Tests and deterministic build` success; pinned action SHAs; the shared non-cancelling collector concurrency group; jobs `repository-gate` → `fresh-readonly-admission` (`data-steward-readonly`) → `protected-deployment-promotion` (`api-football-remediated-deployment-promotion`) → `final-readonly-reconciliation` (`data-steward-readonly`). Admission and execution artifacts are SHA-256-bound across jobs. No schedule, automatic retry or rerun path, Worker probe, workers.dev/Preview enable, D1 mutation or provider request.

### Future protected environment (owner-provisioned; not created by repository work)

`api-football-remediated-deployment-promotion` — environment secrets `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ATTENDED_READ_TOKEN`, `CLOUDFLARE_REMEDIATED_DEPLOYMENT_PROMOTION_TOKEN`, `CLOUDFLARE_REPLACEMENT_TOPOLOGY_READ_TOKEN`; environment variable `CLOUDFLARE_ACCOUNT_FINGERPRINT`. It must **not** hold `API_FOOTBALL_API_KEY` or `API_FOOTBALL_ATTENDED_TRIGGER_SECRET` (the executor refuses to run if either is present).

`CLOUDFLARE_REMEDIATED_DEPLOYMENT_PROMOTION_TOKEN` should be a new dedicated token with only the minimum permission to create Worker Deployments. Cloudflare's Create Worker Deployment API lists **Workers Scripts Write** as the accepted API-token permission. In Cloudflare's newer Workers role UI, the equivalent edit capability is the **Editor** role and can be scoped to selected existing Workers; where that UI is available, scope it only to `teamsheet-api-football-shadow-collector`. Do not add Workers Routes, Zone, D1, Account Settings or other permissions. It must differ from both read credentials. Repository work created, rotated or read no token.

## 9. Gates

1. **Gate A** — complete and consumed (run `37680114065`).
2. **Gate B (this repository work)** — merge needs owner approval. After merge and exact-main verification: (a) owner provisions the protected environment and dedicated token; (b) owner explicitly approves the one-time live dispatch.
3. **Gate C** — a separately owner-gated new-day collection with an owner-gated admission for the consumed history. Not implemented: no workers.dev enable, readiness probe, collection enable, trigger secret, provider attempt, attempt 2 or shadow persistence exists on this path.

## 10. Limitations

- Repository tests prove the contracts against fakes. Live Cloudflare Deployment POST and list response shapes for a two-row history remain unproven until the Gate B live run.
- The original blocked Version is checked by exact stable bindings only (its full module bytes are not reproducible in-repository), as in every earlier checkpoint.
- The Deployment message carries the full immutable candidate creation SHA and full execution SHA; Cloudflare's 1000-byte message limit is ample, so provenance is not truncated.
- A successful Gate B leaves the corrected Version active but unreachable; the remediated provider request is not proven against the Workers runtime or API-Football until Gate C.
