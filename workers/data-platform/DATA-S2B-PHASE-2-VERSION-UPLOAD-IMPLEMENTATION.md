# DATA-S2B — Phase 2 Inactive Worker Version Upload Execution

Status: **ATTEMPT #3 CREATED THE APPROVED INACTIVE VERSION; WORKFLOW FALSE-FAILED DURING POSTFLIGHT — read-only closeout remediation is repository-only and Phase 3 remains unapproved**  
Prepared: **26 August 2026**; attempts #1–#3 reconciled: **27 August 2026**

## Current outcome

DATA-S2B Phase 2 has performed exactly one successful Worker Version creation.

Authoritative attempt #3 evidence:

- workflow run: `33050859823` (`DATA-S2B Phase 2 Inactive Version Upload` #3);
- approved repository SHA: `403f4318eda368d8b981f63cd861ddcb2c963c47`;
- repository gate: PASS;
- pre-existing active deployment: `10f7a065-3d82-4b34-9fb1-dc6c3a0be524`;
- pre-existing active version: `5edbe951-4be4-46bc-b2cf-17b550396105`;
- created inactive Phase 2 version: `3a2b065a-6527-4887-9bf8-b08e82e81133`;
- Phase 2 tag observed in Cloudflare Version History: `data-s2b-phase2-403f4318eda3`.

The Version Upload POST succeeded. Before the later failure, the helper fetched and validated the returned version detail, proved an exact +1 version delta and re-read deployments successfully. The workflow then stopped at `phase2_active_binding_set_drift` because its postflight called `GET /workers/scripts/{script}/settings` and incorrectly treated that script-and-version settings response as the bindings of the version serving the active deployment.

Owner Cloudflare dashboard evidence immediately after the run showed the new Phase 2 version in Version History while the prior version remained the active deployment. The dashboard's runtime-variable view also showed `DATA_S2_SEASON=2026-27`, consistent with the latest saved version configuration rather than evidence that production traffic had moved.

**Attempt #3 is therefore classified: VERSION UPLOAD SUCCEEDED / POSTFLIGHT FALSE-FAILED.** It must not be rerun. Phase 3 deployment and Phase 4 Cron activation remain separately owner-gated.

## Why the postflight failed

Cloudflare separates Worker **Versions** from **Deployments**:

- a Version captures code, bindings and compatibility configuration;
- a Deployment determines which version or versions serve traffic.

The Cloudflare API exposes both explicit Version Detail (`GET .../versions/{version_id}`) and Deployments (`GET .../deployments`). It also exposes `GET .../settings` under the Script And Version Settings API. After an inactive version becomes the newest saved version, that `/settings` response cannot safely be used as proof of the bindings attached to the separately identified active deployment version.

The pre-upload check was not unsafe because the workflow had already proved that the latest deployable version was exactly the active version. After upload, however, latest and active intentionally diverged. The post-upload `/settings` assertion therefore became semantically invalid.

The remediation makes the authority explicit:

1. **Deployments** identifies the active version.
2. **Get Version Detail for that exact active version ID** proves its bindings.
3. **Get Version Detail for the exact uploaded Phase 2 version ID** proves the candidate bindings.
4. `/settings` is not used for active-version proof.

First-party references:

- https://developers.cloudflare.com/workers/versions-and-deployments/
- https://developers.cloudflare.com/api/resources/workers/subresources/scripts/
- https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/get/
- https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/list/
- https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/script_and_version_settings/methods/get/

## Historical failed attempts

### Attempt #1

Run `33040517494` on exact main `173370cf11f5437d993f9d6f44a5904d49d20743` passed its pre-upload checkpoint and then received HTTP 400. Cloudflare Version History remained unchanged. No version was created.

### Attempt #2

Run `33047287546` on exact main `851614dcbcb154a8921e79a12f9589c8ceacb4e0` again passed its pre-upload checkpoint and then received HTTP 400. Cloudflare Version History remained unchanged. No version was created.

The subsequent request-parity remediation aligned the request with current Wrangler: runtime `FormData`/`File`, metadata as a string form field, no manual multipart boundary, no versioned observability field, and inherited bindings without optional `version_id`. Cloudflare permits optional `version_id`; its earlier presence was never established as the HTTP 400 cause.

### Attempt #3

Run `33050859823` on exact main `403f4318eda368d8b981f63cd861ddcb2c963c47` passed the exact-main/CI gate and protected-environment review. The request succeeded and created `3a2b065a-6527-4887-9bf8-b08e82e81133`. The later postflight `/settings` assumption caused the workflow conclusion to be failure even though the intended Phase 2 mutation had already succeeded.

No fourth upload is authorized or required.

## Approved Phase 2 artifact contract

The created version is intended to contain exactly:

- main module `data-platform-rpc.mjs`;
- compatibility date `2026-08-22`;
- `TEAMSHEET_DATA_DB` inherited from the pre-existing active version;
- `DATA_S1_HTTP_AUTH_TOKEN` inherited without reading or exposing its value;
- `DATA_S2_SEASON=2026-27` as `plain_text`;
- the exact four reviewed repository modules:
  - `data-platform-rpc.mjs`;
  - `data-platform.mjs`;
  - `data-platform-core.mjs`;
  - `official-fpl-history.mjs`.

The upload request contains no trigger, deployment, route, domain or secret-write configuration. `bindings_inherit=strict` remains mandatory.

## Upload helper remediation

`workers/data-platform/phase2/upload-version.mjs` is corrected so both pre- and post-upload active-binding checks use explicit Version Detail for the version ID identified by Deployments.

Before mutation it still requires:

- exact current main and exact-head Verify Teamsheet via the workflow gate;
- exact reviewed repository config/module graph;
- rollback-capable active deployment;
- active version bindings exactly `TEAMSHEET_DATA_DB` (`d1`) plus `DATA_S1_HTTP_AUTH_TOKEN` (`secret_text`), with no `DATA_S2_SEASON`;
- empty live Cron;
- exact Phase 1 D1 migration/governance/count state;
- ordered deployable version list whose first/latest version is the active version.

After a successful upload it must prove:

- returned uploaded version ID is new;
- uploaded version detail matches the exact three-binding Phase 2 contract;
- version-list delta is exactly +1;
- deployment ID/version/timestamp are unchanged;
- explicit detail for the still-active version has the same D1 and retained secret and no season binding;
- Cron remains empty;
- Phase 1 D1 migration/governance/count state remains exact;
- D1 file size is unchanged during the bounded upload operation.

It does not use `/settings` for post-upload active-version proof.

## Attempt #3 read-only closeout

Because attempt #3 stopped before the final Cron/D1 postflight reads, a separate manual **read-only** workflow is prepared:

`.github/workflows/data-s2b-phase2-readonly-closeout.yml`

Helper:

`workers/data-platform/phase2/readonly-closeout.mjs`

It performs no Worker Version upload and uses the existing protected Phase 0 read-only environment `data-s2b-phase0-readonly`, whose credential boundary is Workers Scripts Read + D1 Read.

The closeout is pinned to the observed attempt #3 state and fails closed unless:

- active deployment remains `10f7a065-3d82-4b34-9fb1-dc6c3a0be524`;
- active version remains `5edbe951-4be4-46bc-b2cf-17b550396105`;
- latest deployable version remains the Phase 2 artifact `3a2b065a-6527-4887-9bf8-b08e82e81133`;
- the old active version remains present in Version History;
- explicit active-version detail has exactly D1 + retained HTTP secret and no season binding;
- explicit Phase 2 version detail has exactly D1 + retained HTTP secret + `DATA_S2_SEASON=2026-27` and compatibility date `2026-08-22`;
- both versions reference the same D1 UUID;
- live Cron remains empty;
- Phase 1 migration/governance/count state remains exact and contains no ingestion/observation/head data;
- current D1 file size remains `151552` bytes, matching the recorded Phase 1 closeout baseline.

The 151,552-byte comparison is historical accounting evidence, not a reconstructed immediate-before/after Phase 2 measurement. Attempt #3's in-memory pre-upload size was not emitted before the workflow stopped, so an exact immediate size pair cannot be recovered after the fact. The closeout must state this limitation rather than overclaim it.

The D1 query endpoint uses HTTP POST because that is Cloudflare's read-query transport, but every SQL statement is a fixed repository `SELECT` passed through `validateReadOnlySql`. No D1 write token is used.

## Security and mutation boundary

The read-only closeout:

- uses `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from `data-s2b-phase0-readonly`;
- does not reference `CLOUDFLARE_WORKER_UPLOAD_TOKEN` or a D1 write token;
- masks token, account ID and D1 UUID;
- persists no raw Cloudflare response and uploads no artifact;
- has no Worker POST/PUT/PATCH/DELETE request;
- has no deployment, trigger, route/domain, secret or Time Travel mutation;
- runs no collector and makes no Official FPL acquisition;
- changes no application, provider, model or calculation behavior.

## Approval and completion gate

This repository change does **not** itself complete Phase 2 and does not authorize Phase 3.

Required sequence:

1. review this remediation candidate;
2. exact-head Verify Teamsheet PASS;
3. explicit owner merge approval;
4. merge and exact-main Verify Teamsheet PASS;
5. obtain a **separate explicit owner approval** authorizing dispatch of the manual read-only closeout for that exact main SHA;
6. only after that approval, release `data-s2b-phase0-readonly` and run the read-only closeout;
7. record its live result;
8. only after a clean Phase 2 closeout may Phase 3 deployment be proposed for separate owner approval.

No additional Worker Version upload is part of that sequence.
