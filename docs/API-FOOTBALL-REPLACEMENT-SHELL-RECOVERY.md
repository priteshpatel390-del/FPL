# API-Football replacement shell-only recovery

Status: repository-only recovery candidate after consumed live run `36770767679`. No new Cloudflare mutation or workflow dispatch is authorized by this document or its merge.

## Consumed live evidence

Replacement-foundation run `36770767679`, attempt 1, on exact main `9ccb474f484c24c7b72c70bdc6cc911fc9bfb80b` passed repository gating and fresh read-only admission. Protected execution then created the deterministic replacement Worker shell `teamsheet-api-football-shadow-collector-v2` with Worker ID `af6b59302acf49728e7deeb2f951397f`.

The sanitized execution artifact recorded:

- shell creation submitted exactly once and returned a definite identity;
- Version upload count `0`;
- Preview cleanup count `1`, disposition `DEFINITE`, final `previewDisabled:true`;
- original collector unchanged;
- zero Deployments, workers.dev enablements, route/domain/Cron/Access/D1 mutations;
- zero API-Football requests and zero trigger-bearing requests;
- `retryAuthorized:false`.

The execution stopped as `replacement_shell_reconciliation_failed`. Independent read-only reconciliation then stopped as `replacement_reconciliation_script_absent`.

## Repository defect

Cloudflare's modern Worker inventory proves the new Worker object exists before its first Version is uploaded, while the legacy Scripts inventory may not contain a row for that zero-Version shell. The foundation validators incorrectly required the legacy Scripts row immediately after shell creation and therefore could not classify the known shell-only state.

This is a repository validation defect. It is not evidence that the Worker shell is deployed, routable through workers.dev, or has a Version.

## Recovery target

Recovery is allowed to address only the exact existing replacement shell:

`af6b59302acf49728e7deeb2f951397f`

under the deterministic name:

`teamsheet-api-football-shadow-collector-v2`

The recovery path must fail closed before mutation unless fresh read-only admission proves:

- exact Worker name and exact Worker ID;
- zero Versions;
- workers.dev disabled;
- Preview/Version URLs disabled;
- zero Deployments;
- zero Cron triggers;
- zero routes and custom domains;
- the original collector still has its exact three inactive Versions and pristine runtime/provider state.

A missing legacy Scripts row is valid only while the replacement has zero Versions. Once a Version exists, the Scripts row is required again for route-count proof.

## Recovery mutations

The recovery path contains no Worker-create primitive and cannot delete or recreate the shell. Its only possible mutations are bounded independently to one each:

1. set the exact existing replacement shell to `{enabled:false, previews_enabled:true}`;
2. upload exactly one reviewed replacement Version;
3. restore `{enabled:false, previews_enabled:false}`.

There is no Deployment, workers.dev enablement, route, domain, Cron, Access, D1, provider, delete or second-Version primitive.

The Preview enablement is needed only because the consumed run correctly restored Preview disabled after the foundation stopped. The shell was originally created with Preview enabled, so creation-time provisioning has already occurred. Whether re-enabling Preview before the shell's first Version upload is sufficient for the Version URL to route remains a live hypothesis to be tested by the separately gated recovery run; repository work does not claim that outcome in advance.

## Version and routing contract

The one Version uses the same reviewed 17-module attended runtime, compatibility date and binding contract as the replacement foundation. It carries the existing API-Football key and attended trigger secret only as Cloudflare `secret_text` bindings.

After upload, the recovery proves exact stable/Beta Version identity, then sends only two header-free GETs:

- `GET /`
- `GET /__teamsheet/api-football/attended-one-shot`

Routing is accepted only if both return the immutable Worker rejection signature: HTTP 404, body exactly `Not found`, `cache-control: no-store`, and text/plain content type.

No trigger-bearing request or API-Football request exists in this recovery path.

## Cleanup and ambiguity

Preview disable remains mandatory after any path that enabled Preview, whether upload/probe succeeds or fails. Mutation ambiguity is resolved only with read-only state reconciliation and never by blind resubmission.

Terminal states are:

- `REPLACEMENT_SHELL_RECOVERY_RECONCILIATION_REQUIRED`: exactly one reviewed inactive Version, both routing probes proved, Preview disabled;
- `REPLACEMENT_SHELL_RECOVERY_CLEAN_SAFE_STOP`: objective not achieved but exact inactive `SHELL_ONLY` or `ONE_VERSION` state proved with Preview disabled;
- `REPLACEMENT_SHELL_RECOVERY_OWNER_ATTENTION_REQUIRED`: exact state or cleanup cannot be proved.

All outcomes are non-retryable by default. A red GitHub workflow may still represent a clean safe stop; the independent reconciliation artifact is authoritative.

## Workflow boundary

`.github/workflows/api-football-replacement-shell-recovery.yml` is manual, exact-current-main and first-attempt-only. It requires exact-head `Tests and deterministic build` success, then:

1. uses `data-steward-readonly` to re-prove the original collector and the exact shell-only replacement state;
2. uses the existing `api-football-replacement-foundation` protected environment only for the bounded recovery mutations;
3. returns to `data-steward-readonly` for independent final reconciliation.

Repository merge does not authorize dispatch. A future live recovery dispatch requires separate explicit owner approval after exact-main verification.

## Deliberate exclusions

This recovery changes no model, projection, expected-minutes, fixture, squad, transfer, captaincy, rank, Mini-League, Decision Intelligence or product behavior. It adds no provider or data source and does not change API-Football request planning. It cannot mutate D1 or invoke API-Football.
