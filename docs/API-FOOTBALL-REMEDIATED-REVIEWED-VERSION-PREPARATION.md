> **Superseded in part (8 October 2026):** the statements below that the remediated builder reads the **current tree** describe the original Gate A implementation. The deployed Version `4171f3cf` is now verified from SHA-256-verified byte snapshots of its 17 reviewed modules at `f01ccff5` (see [Gate C forensic remediation](API-FOOTBALL-GATE-C-FORENSIC-REMEDIATION.md)); the module pins, graph hash and metadata hash are unchanged. The current tree is a different identity (`corrected-version-candidate.mjs`).

> **Current state after Gate B:** Gate A run `37680114065` remains consumed. Gate B run `37688525299` successfully promoted its corrected Version `4171f3cf-953e-452e-9e5f-068df9a3ca47` through active Deployment `9b48b57a-e505-4213-9547-fe44835a9bdb`, with final classification `TRANSPORT_REMEDIATED_DEPLOYMENT_PROMOTED_INERT`. Gate B is also consumed. No provider request occurred; Gate C remains separate and unimplemented. See [Gate B live closeout](API-FOOTBALL-TRANSPORT-REMEDIATED-DEPLOYMENT-PROMOTION-CLOSEOUT.md).

# API-Football Remediated Reviewed Version Preparation (Gate A, repository only)

> **Live closeout — Gate A complete and CONSUMED.** Run `37680114065`, attempt 1, exact main `f01ccff5b13a4bbc98d7927cf620f69f46c4c54c`, succeeded. It uploaded exactly one Version, `4171f3cf-953e-452e-9e5f-068df9a3ca47` (graph SHA-256 `03db54c4faf0bfc08f52382e56fc165cadccb7337786581053328e07f2f8f6cc`, metadata SHA-256 `67097c838c1e0f9a5f2c765ea17dff3eb690bb4e646688c35cab4c66055b1119`, 17 modules), outcome `CREATED`, with zero Deployment, D1, workers.dev, Preview and API-Football activity and zero secret values serialized. Independent reconciliation classified `TRANSPORT_REMEDIATED_VERSION_PREPARED_NOT_DEPLOYED`: four Versions, the historical Deployment `2417a3e0…` unchanged and still selecting `04d79556…` at 100%, every traffic surface off, collection disabled, credential `AVAILABLE`, no lease and the consumed history unchanged. **Gate A must never be rerun**; its workflow carries a `CONSUMED` header and its three-Version admission can no longer admit the live state. The present-tense "nothing uploaded" statements below describe the pre-run repository checkpoint and are retained as history. The corrected Version is not active until Gate B; see the [transport-remediated Deployment promotion](API-FOOTBALL-TRANSPORT-REMEDIATED-DEPLOYMENT-PROMOTION.md).

Repository-only checkpoint after merged PR #313 (main `53f94ab4e3a2970075ae09eeef921a1f5b334f43`). Owner approval covers investigation, repository implementation, tests, canonical documentation and a draft PR only.

**No Worker Version has been uploaded. No Deployment, workers.dev, Preview, Cron, route, domain, D1, secret or credential change occurred. No API-Football request was made. No workflow was dispatched. The consumed history of runs `37505586273` and `37511401491` is untouched.** The live collector still selects the old immutable Version `04d79556-3070-429f-9944-b5b53d799842` at 100% through Deployment `2417a3e0-15db-4e45-a3c8-00b148a300f4`, and that Version still carries the broken `redirect:'error'` provider request.

## 1. Why a new Version is needed, and why the old builder must not be reused

Version `04d79556` is immutable. PR #313 corrected the repository provider request (GET, `redirect:'manual'`, exactly one `x-apisports-key` header, explicit 3xx rejection) and, to keep the old Version reproducible, made the **historical** reviewed module graph read two modules (`src/decision-intelligence/api-football-foundation.mjs`, `workers/api-football-collector/collector.mjs`) from SHA-256-pinned snapshots. Those snapshots exist only to reproduce `04d79556` byte-for-byte.

Consequently `resolveModuleGraph()` default, `buildReviewedAttendedIdentity`, `buildAttendedVersionUploadForm`, `buildLifecycleCloneVersionUploadForm` and `prepareFinalAttendedVersion` all rebuild the OLD bytes. **Using any of them for a new Version would upload the old broken code again.** The remediated path therefore has its own contract and never imports a historical builder.

## 2. Two separate contracts

| | Historical contract | Remediated contract |
|---|---|---|
| Module | `attended-version.mjs` + `stage-inactive-version.mjs` | `transport-remediated-version.mjs` |
| Module source | pinned snapshots for two paths | **current tree**, all 17 reviewed paths |
| Identity constant | `ATTENDED_VERSION_MODULE_SHA256` | `TRANSPORT_REMEDIATED_VERSION_MODULE_SHA256` |
| Purpose | reproduce / validate immutable `04d79556` and clone `7405abc0` | create and validate the one future corrected Version |
| Changed by this checkpoint | no | new |

Only two of the 17 module hashes differ (`modules/src/decision-intelligence/api-football-foundation.mjs`, `collector.mjs`); the other 15 are identical. Permanent tests prove the historical builder still returns snapshot bytes, the remediated builder returns the corrected working tree, the two graphs differ, and old `04d79556` remains reproducible.

## 3. Remediated candidate identity (`api-football-transport-remediated-version-v1`)

`buildTransportRemediatedVersionIdentity(approvedSha)` is deterministic and fails closed:

- reads the current tree for exactly the 17 reviewed modules through the existing resolver (dynamic imports, unreviewed specifiers and external/npm/node dependencies are rejected; specifier rewriting is unchanged);
- asserts the corrected request contract in the exact bytes (`API_FOOTBALL_REQUEST_REDIRECT_MODE='manual'`, `{method:'GET', redirect:…, headers:{'x-apisports-key':apiKey}}`, no `redirect:'error'`, no `accept` header);
- compares every module hash to the pinned constant, so **any** module change fails with `collector_transport_remediated_source_drift` until a new reviewed pin is committed;
- derives `metadataSha256` from secret-free public metadata and `graphSha256` from contract, SHA, entry module, metadata hash and module hashes;
- uses message `API-Football transport-remediated attended Version from <sha>` and tag `api-football-transport-remediated-<sha12>`, distinct from the attended and lifecycle-clone annotations.

Preserved from the existing attended contract: worker `teamsheet-api-football-shadow-collector`, main module `collector.mjs`, compatibility date `2026-09-16`, D1 binding `TEAMSHEET_DATA_DB` to the production database, plain-text `API_FOOTBALL_FPL_SEASON=2026-27`, `API_FOOTBALL_PROVIDER_SEASON=2026`, `EIA_2I5D_ACTIVATION=ATTENDED_ONE_SHOT_DISCOVERY`, and exactly two secret binding names `API_FOOTBALL_API_KEY` and `API_FOOTBALL_ATTENDED_TRIGGER_SECRET`.

Secret values appear only inside the one upload form built in the protected executor. They never enter the identity, hashes, annotations, evidence, artifacts or logs. The trigger secret must be at least 32 characters, the two secrets must differ, and neither may equal any Cloudflare credential. Tests use synthetic secrets only.

## 4. Fresh read-only admission (not pristine-history admission)

`transportRemediatedAdmissionDiagnostic` consumes the stale generic zero-Deployment lifecycle STOP (`STOP_VERSION_URL_CREATION_EXPERIMENT_CLOSEOUT_REVIEW_REQUIRED` / `lifecycle_clone_inventory_unexpected`) only against independently observed exact fields, as the continuation does. It requires:

- Worker/Versions: exact original Worker ID; exactly the three historical Versions (`e49ac8f2…`, `04d79556…`, `7405abc0…`) with exact identities, which also proves **no remediated candidate exists yet**;
- Deployment: exactly one Deployment `2417a3e0-15db-4e45-a3c8-00b148a300f4`, active, selecting `04d79556…` at 100%;
- topology: workers.dev off, Preview off, Cron 0, custom domains 0, legacy route count 0, authoritative zone route scan 0;
- runtime: collection disabled, credential `AVAILABLE`, no lease;
- **exact consumed history**: attempts 1 (attempt 1 count 1, attempt 2 count 0), succeeded 0, `TRANSPORT_UNKNOWN` 1, generations 1 (failed 1, committed 0), fixture revisions 0, RESERVED 0, STAGING 0, and zero auth/quota/timeout/schema/HTTP/uncertainty counts;
- foundation: six migrations, zero FK violations, Official FPL authority valid (20 teams), qualified mapping 20/20, model/UI import 0, raw payload storage false, zero preflight mutations/provider requests/secret reads.

Pristine history, attempt 2, two attempts, success, extra generation, RESERVED/STAGING, fixture revisions, any traffic surface, enabled collection, invalid credential, lease, mapping/authority drift, wrong/extra/missing Deployment or Version each stop admission before any mutation.

### Active Deployment reader

`activeDeploymentState()` is scoped to this path. Cloudflare retains Deployment history and documents the first row of the Deployments list as the latest Deployment actively serving traffic, so the reader uses that API ordering directly and never reconstructs activity from `created_on` timestamps. For this Gate A path the policy constant `TRANSPORT_REMEDIATED_EXPECTED_DEPLOYMENT_COUNT=1` additionally requires exactly the one retained Deployment before and after the upload; it must not be reused by Gate B. Historical workflows keep their historical exact-single assumptions and are unchanged.

## 5. Protected Version-upload-only executor

`run-transport-remediated-version-upload.mjs`:

- validates everything before any network request: exact approved SHA, GitHub re-run refusal (`GITHUB_RUN_ATTEMPT` must be `1`), account/fingerprint, **three distinct credentials** (`CLOUDFLARE_ATTENDED_READ_TOKEN`, `CLOUDFLARE_ATTENDED_VERSION_UPLOAD_TOKEN`, `CLOUDFLARE_TOPOLOGY_READ_TOKEN`), secret material, and the bound admission artifact (hash-bound in the workflow);
- builds the current-tree identity and upload form **before** any network request, so reviewed-source drift sends nothing;
- trusts D1/history only through the hash-bound read-only admission artifact, then freshly re-proves Cloudflare-only inert state (workers.dev, Preview, Cron, custom domains), active Deployment, authoritative zone route scan and the exact three-Version inventory immediately before the POST;
- submits the single POST through a **guarded fetch** that refuses every non-`api.cloudflare.com` host (so API-Football and any Worker/workers.dev invocation are impossible), every non-GET method except the one Version POST (upload credential only, ceiling 1), and every D1 endpoint. Deployment/subdomain/Preview/D1/schedule/route/domain/Worker-shell mutations, DELETE, PUT and secret mutations are unrepresentable and refused before network.

### One POST, never resent

`submitTransportRemediatedVersionUpload`: definite rejection stops (`REJECTED`, no readback). Otherwise up to three bounded read-only Version inventory reads (0 s, 2 s, 5 s). A new single Version equal to a returned id is `CREATED`; a new Version after an ambiguous response is `APPLIED_CONFIRMED_BY_READBACK`. If no new Version is visible after an ambiguous/opaque POST, the result remains `AMBIGUOUS_OWNER_ATTENTION`: bounded absence is not proof that the mutation did not apply. `NOT_APPLIED` is reserved for genuinely authoritative non-application evidence and is not inferred by this executor. Malformed/duplicate/removed/extra ids or unreadable inventory are also owner-attention. A second POST is structurally impossible (ceiling 1 in the guarded fetch).

### Evidence

Sanitized, closed shape: `versionUploadAttempts`, `productionMutations` (equal), `deploymentMutations`, `d1Mutations`, `workersDevMutations`, `previewMutations`, `apiFootballRequests`, `secretValuesSerialized`, `outcome`, `versionId`, identity hashes, `retryAuthorized:false`. Successful preparation is exactly one Version upload and every other counter 0.

## 6. Independent read-only reconciliation

Success (`TRANSPORT_REMEDIATED_VERSION_PREPARED_NOT_DEPLOYED`) requires, from read-only state only: exactly one new Version not equal to any historical id; exact module set and byte hashes; exact metadata/annotations, D1 binding, plain-text vars and secret binding **names** (no `text`); no Version URL; the three historical Versions present and the retained attended Version still exactly its pinned identity; the **existing Deployment unchanged** and still selecting `04d79556…` at 100%; workers.dev and Preview off; Cron/routes/domains 0; collection disabled; no lease; the consumed history identical; no provider activity; no D1 activity. The new Version is created but **not deployed**.

No new Version plus unchanged state is `TRANSPORT_REMEDIATED_VERSION_CLEAN_STOP_NO_VERSION_CREATED` (non-success, never retry authority). Anything else is `TRANSPORT_REMEDIATED_VERSION_OWNER_ATTENTION_REQUIRED`. Cloudflare Version-detail APIs are used; **no Version URL, Preview or workers.dev probe** is made.

## 7. Dormant workflow

`.github/workflows/api-football-remediated-version-preparation.yml`, `API-Football Transport-Remediated Reviewed Version Preparation`: manual `workflow_dispatch` only, exact `approved_sha`, attempt 1 only, exact current main before and after each environment wait, exact-head Verify Teamsheet, pinned action SHAs, shared non-cancelling collector concurrency group, jobs `repository-gate` → `fresh-readonly-admission` (`data-steward-readonly`) → `protected-version-upload` (new owner-provisioned environment `api-football-remediated-version-upload`) → `final-readonly-reconciliation`. Admission and execution artifacts are SHA-256-bound across jobs. No schedule, no automatic rerun, no D1 write token, no Deployment/Preview/workers.dev credential.

## 8. Future gates (not implemented; kept separate)

1. **Gate A (this design)** — a later separately approved one-time live upload of the corrected Version while everything stays inert, then reconciliation.
2. **Gate B** — a separately approved Deployment promotion of the new Version to 100%.
3. **Gate C** — a separately approved new logical discovery opportunity using the remediated Version. No attempt 2 is ever created for the consumed history; any live use needs an owner-gated admission policy for it.

Merge authorizes none of these. Gate A requires merge, exact-main verification, owner provisioning of `api-football-remediated-version-upload`, and a further explicit approval.

## 9. Limitations

- Historical Versions other than the retained attended Version are validated by id and (pre-upload) by the existing exact preflight, not re-read byte-for-byte post-upload; Cloudflare Versions are immutable.
- bounded readback absence after an ambiguous upload remains `AMBIGUOUS_OWNER_ATTENTION`; it is never promoted to `NOT_APPLIED` or retry authority. `NOT_APPLIED` remains reserved for authoritative future evidence.
- Repository tests prove the contract against fakes. Live Cloudflare Version-upload response shapes remain unproven until Gate A.
- The remediated provider request itself is not proven against the real Workers runtime or API-Football until Gate C.
