# DATA-S2B — Phase 2 Inactive Worker Version Upload Execution

Status: **LIVE ATTEMPTS #1 AND #2 SAFE-FAILED BEFORE VERSION CREATION — diagnostic remediation round #2 is repository-only and attempt #3 is not authorized**
Prepared: **26 August 2026**; failed-attempt reconciliation: **27 August 2026**
Approved preparation baseline: `cb31d51c953615efeb1071374ced961270032462`

## Outcome and scope

DATA-S2B Phase 1 closed PASS on the baseline above. The owner has approved preparation of the Phase 2 execution path in the repository only. This change does not upload a Worker version and does not authorize dispatch of the new workflow.

Phase 2 has one future mutation, after a separate live approval: create one new **inactive** version of `teamsheet-data-platform` containing the exact reviewed DATA-S2A Worker modules and the approved `DATA_S2_SEASON=2026-27` binding.

Phase 2 explicitly does **not**:

- create a Worker deployment or move production traffic;
- activate or edit Cron triggers;
- change routes, custom domains, Access, workers.dev or preview settings;
- create, update, delete or reveal Worker secrets;
- mutate D1 schema or rows;
- run the Official FPL collector;
- change a provider, the application, projections, fixtures, expected minutes, squad, captaincy, transfers, rank or Mini-League logic.

Phase 3 deployment and Phase 4 Cron activation remain separately owner-gated.

### Live attempt #1 reconciliation

Manual workflow run `33040517494` ran against exact `main` SHA `173370cf11f5437d993f9d6f44a5904d49d20743`. Repository gate job `98412809419` passed. The protected Phase 2 job `98412837803` then recorded a PASS pre-upload checkpoint: exact repository identity, active deployment/version, empty Cron set, absent live `DATA_S2_SEASON` and exact Phase 1 D1 post-state were all established, and no upload had yet been submitted.

The immediately following Version Upload POST returned HTTP 400. Owner Cloudflare dashboard evidence after the failure showed active version `5edbe951-4be4-46bc-b2cf-17b550396105`, Version History still totaling nine with no new version, and no new deployment or visible traffic change. Attempt #1 is therefore classified **SAFE FAIL BEFORE VERSION CREATION**: no deployment, traffic, Cron or D1 change occurred. The workflow must not be rerun without a separate owner review and approval.

### Live attempt #2 reconciliation

Manual workflow run `33047287546` ran against exact `main` SHA `851614dcbcb154a8921e79a12f9589c8ceacb4e0`. Its repository gate passed. The protected job then recorded a PASS pre-upload checkpoint proving exact repository identity, active deployment `10f7a065-3d82-4b34-9fb1-dc6c3a0be524`, active version `5edbe951-4be4-46bc-b2cf-17b550396105`, empty Cron, absent live `DATA_S2_SEASON`, exact Phase 1 D1 post-state and that no upload had yet been submitted.

The immediately following Version Upload POST again returned HTTP 400. Owner Cloudflare evidence after the failure showed the same active version and unchanged Version History, with no new Worker Version and no deployment or visible traffic change. Attempt #2 is therefore also **SAFE FAIL BEFORE VERSION CREATION**. No deployment, traffic, Cron or D1 change was observed. **Attempt #3 is not authorized.**

## Reuse Before Build

| Primitive | Classification | Decision |
|---|---|---|
| Phase 1 exact-main / exact-head CI repository gate | **Adopt** | Reuse before any mutation-capable credential becomes available. |
| Cloudflare Workers **Version Upload API** | **Adopt** | Use the official inactive-version primitive directly. A Version is created; no Deployment is created. |
| `bindings_inherit=strict` | **Adopt** | Inherit the existing D1 and retained HTTP-auth secret from the exact active version and fail if either cannot be resolved. |
| Active Worker deployment/settings/schedules reads | **Adopt** | Re-prove the live Phase 1 post-state immediately before and after the version upload. |
| Phase 1 fixed D1 SELECT contracts | **Adopt** | Re-prove migration/governance/history counts with read-only SQL before and after upload. |
| `npx wrangler` / npm registry install | **Reject** | The repository remains zero-dependency and assumes no npm registry access. |
| `wrangler deploy`, Versions deploy or trigger deploy | **Reject for Phase 2** | They would cross later approval boundaries. |
| Secret material copied into GitHub or upload metadata | **Reject** | The existing secret is inherited by name from the exact active version; its value is never read. |

### Why the implementation uses the API instead of the CLI command named in the acceptance plan

`DATA-S2B-LIVE-DEPLOYMENT-ACCEPTANCE-PLAN.md` correctly requires the **Workers Versions** primitive and names `wrangler versions upload` as the intended command. The execution helper uses Cloudflare's official Version Upload REST endpoint directly because the repository's accepted operating constraint is zero dependency / no npm registry access.

This changes the client mechanism, not the Phase 2 safety boundary: Cloudflare documents the endpoint as uploading a Worker Version **without deploying it to Cloudflare's network**. A deployment remains a separate resource and approval step.

The endpoint used is:

`POST /accounts/{account_id}/workers/scripts/teamsheet-data-platform/versions?bindings_inherit=strict`

Cloudflare currently documents `Workers Scripts Write` as sufficient for the version-upload mutation itself. The helper also performs D1 read-only reconciliation, so the dedicated token additionally needs D1 read capability. D1 write is neither needed nor approved.

First-party references:

- https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/create/
- https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/get/
- https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/list/
- https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/
- https://developers.cloudflare.com/workers/versions-and-deployments/

## Repository candidate contract

Before any Cloudflare credential is available, the workflow's exact-SHA gate and normal Verify Teamsheet gate must pass. The Phase 2 helper then fails closed unless `workers/data-platform/wrangler.jsonc` is still exactly the reviewed candidate shape:

- Worker `teamsheet-data-platform`;
- main module `data-platform-rpc.mjs`;
- compatibility date `2026-08-22`;
- `workers_dev=false`;
- preview URLs disabled;
- observability enabled;
- exactly one non-secret var: `DATA_S2_SEASON=2026-27`;
- repository target Cron exactly `0 * * * *`;
- exactly one D1 declaration: `TEAMSHEET_DATA_DB -> teamsheet-data` with migration directory `migrations`;
- no extra top-level configuration such as routes or assets.

The Cron declaration is checked only as repository identity. It is **not sent** by the Phase 2 upload request and is not activated in this phase.

The upload module set is pinned to exactly four repository files:

1. `data-platform-rpc.mjs`;
2. `data-platform.mjs`;
3. `data-platform-core.mjs`;
4. `official-fpl-history.mjs`.

No bundler, package install or generated upload source is used.

## Live pre-upload gate

A future live dispatch must stop before mutation unless all of the following remain true:

- the dispatch is for `refs/heads/main` in `priteshpatel390-del/FPL`;
- the supplied `approved_sha` is the exact current `main` SHA;
- that exact SHA has a successful GitHub Actions `Tests and deterministic build` check;
- the checkout is exact and clean;
- a rollback-capable active Worker deployment/version is unambiguous;
- active Worker bindings are exactly:
  - `TEAMSHEET_DATA_DB` — `d1`;
  - `DATA_S1_HTTP_AUTH_TOKEN` — `secret_text`;
- `DATA_S2_SEASON` is still absent from the active Worker;
- the live Cron set is empty;
- the D1 binding resolves by UUID to exact database `teamsheet-data`;
- Phase 1 migration/governance/history post-state still matches exactly;
- ingestion runs, shadow observations, observation heads and canonical entities remain zero.

Requiring the retained HTTP secret is deliberately stricter than the earlier Phase 0 migration preflight, where that binding could be optional because Phase 1 did not deploy code. A Phase 2 version intended for later health-checked deployment must preserve the existing authenticated HTTP rollback surface. The helper checks only the binding name and type; it never reads the secret value.

## Diagnostic remediation round #2 and exact version-upload contract

Cloudflare's current first-party OpenAPI contract declares `multipart/form-data`, with `metadata` encoded as `application/json`, and its direct REST example sends that JSON as a normal form field rather than a file upload. The failed helper instead appended a Node `Blob` with filename `metadata`; Node serialized it with `Content-Disposition: form-data; name="metadata"; filename="metadata"`. That file disposition does not match the documented metadata-field contract. The same current Version Upload schema does not permit `observability` in version metadata, and Cloudflare's first-party Wrangler version-upload implementation explicitly omits it because observability is a non-versioned script setting. The failed request included it. These were the two concrete request-contract defects present at the HTTP 400 boundary; the deliberately suppressed response prevents attributing the server's 400 to only one of them, so the remediation removes both rather than guessing which validation ran first.

Attempt #2 proved that the first remediation was insufficient. Comparison with current first-party Workers SDK source at Cloudflare `workers-sdk` commit `fe265f87347ce253ed9ef00302f4cd2cdcb2bb19` found two remaining request-parity differences:

1. Wrangler's `createWorkerUploadForm` encodes an inherited binding as only `{name,type:"inherit"}` and does not send `version_id`. Cloudflare's current Versions API schema explicitly permits the optional `version_id` field, so its presence in the failed requests is not proven invalid and is not evidence of the HTTP 400 cause. Removing it eliminates a request-parity difference with Wrangler; it does not establish server-side causation.
2. Wrangler creates runtime `FormData`, sets metadata with `formData.set("metadata", JSON.stringify(metadata))`, creates every module as a `File`, and gives that `FormData` directly to fetch. The failed helper used a custom `Uint8Array` serializer, chose its own boundary, added an explicit metadata-part `Content-Type`, and set the request `Content-Type` itself. Although the custom bytes reparsed semantically, this unnecessary transport difference remained at the rejection boundary.

Round #2 removes both differences rather than continuing to guess. The helper now uses only Node 24's runtime `FormData` and `File` APIs, leaves boundary and transfer/content-length handling to Node/Undici, and passes the form directly to fetch. Metadata is a string field with no filename; every module remains a file field whose field name, filename and MIME type are the exact module name and `application/javascript+module`. Tests inspect the semantic `Request.formData()` result and do not pin random boundary bytes.

The metadata JSON contains:

- main module `data-platform-rpc.mjs`;
- compatibility date `2026-08-22`;
- `TEAMSHEET_DATA_DB` inherited from the latest version, after proving that version is the exact active version;
- `DATA_S1_HTTP_AUTH_TOKEN` inherited from that same proven latest-and-active version;
- `DATA_S2_SEASON` added as plain text `2026-27`;
- a non-secret message/tag containing the approved repository SHA.

The inherited bindings deliberately omit the API-permitted optional `version_id` to match current Wrangler. Cloudflare documents omitted inheritance as resolving against the latest version, and documents the first List Versions item as latest. The helper therefore fails closed before constructing or submitting the upload unless the ordered deployable-version list has the active deployment version at index zero. An active version that is merely present later in the list is rejected with `phase2_latest_version_not_active`; an absent active version retains `phase2_active_version_missing_from_version_list`. This prevents silent inheritance from a newer inactive version. The `bindings_inherit=strict` query remains mandatory so a missing or invalid inherited binding is fatal instead of silently dropped. No secret value or D1 identifier is copied into upload metadata.

Repository observability remains required and the active setting remains part of the read-only settings contract, but Phase 2 does not send or mutate that non-versioned setting.

The request contains no trigger, deployment, route, domain or secret-write configuration.

## Required immediate post-upload proof

An HTTP/API success alone is not acceptance. A PASS requires all of the following after the one version upload:

- the returned version ID is new and differs from the active version;
- the version list changed by exactly that one version ID;
- Get Version Detail reports compatibility date `2026-08-22`;
- the new inactive version has exactly:
  - `TEAMSHEET_DATA_DB` bound to the same D1 UUID;
  - `DATA_S1_HTTP_AUTH_TOKEN` as `secret_text`, with no secret value exposed;
  - `DATA_S2_SEASON=2026-27` as `plain_text`;
- the active deployment ID, active version ID and deployment timestamp remain unchanged;
- the active Worker binding set remains unchanged and still has no live `DATA_S2_SEASON`;
- live Cron remains empty;
- the live D1 binding remains unchanged;
- Phase 1 migration/governance/history post-state remains exact;
- D1 database size remains unchanged during this narrowly bounded operation.

Any mismatch is a STOP. The workflow does not try to repair state, delete the uploaded version, deploy it, modify triggers or roll back D1 automatically.

## Workflow and credential boundary

The manual workflow is:

`.github/workflows/data-s2b-phase2-version-upload.yml`

It has only `workflow_dispatch` and one required immutable input: `approved_sha`.

The credential-free `repository-gate` runs first. Only the dependent Phase 2 job references the protected environment:

`data-s2b-phase2-version-upload`

Before any future live dispatch, that environment should be configured with required owner review, administrator bypass disabled and deployment branch restricted to `main`.

Required environment secrets:

- `CLOUDFLARE_WORKER_UPLOAD_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Recommended dedicated token scope:

- **Workers Scripts Write** — upload/read the Worker version and read current Worker state;
- **D1 Read** — execute the fixed read-only reconciliation queries and database identity read.

Do not grant D1 Write/Edit for Phase 2. Do not reuse or widen the Phase 1 D1-write token merely for convenience.

## Output and secret handling

The token, account ID and D1 UUID are masked. Raw Cloudflare API responses are no longer written to disk, printed, summarized or uploaded as artifacts.

On an API failure, the helper parses the response in memory and emits only the HTTP status plus numeric Cloudflare error codes and sanitized messages attached to numeric codes. Before a message can be emitted it redacts the exact token, account ID and known D1 database ID; Authorization/Bearer values; UUIDs; and long hexadecimal identifiers. Control characters, oversized messages, malformed JSON, an unexpected error envelope, or an error without a valid numeric code fail closed to status only (or status plus the numeric code when that alone is safe). Multiple valid Cloudflare errors are preserved without printing the raw envelope.

This improves the next authorized diagnostic from an unhelpful `HTTP_400` while retaining the rule that uncertain content is not logged. It does not authorize another live request.

The public job summary may contain only non-secret acceptance evidence: repository SHA, active deployment/version IDs, new inactive version ID, binding names/types, fixed season/compatibility values, aggregate D1 invariants and confirmation that deployment/Cron/D1 state did not change.

## Approval gate after this repository change

Repository preparation, tests, build success, merge and environment setup are **not** authority to run Phase 2.

After this change is merged, a separate owner approval must identify the exact then-current `main` SHA and authorize dispatch of the Phase 2 workflow for that SHA. Only that dispatch may create the one inactive Worker version.

A successful Phase 2 upload still does not authorize Phase 3 deployment or Phase 4 Cron activation.
