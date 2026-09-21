# API-Football Collector — Inactive Worker Version / Production D1 Binding Staging Proposal

Status: **LIVE INACTIVE STAGING COMPLETE — ZERO DEPLOYMENTS / ZERO PROVIDER EGRESS**

Prepared: **21 September 2026**

## Live closeout — 21 September 2026

Owner-attended workflow run `35645387203`, attempt 1, completed successfully on exact `main` `302dc21cc4b821ac8b224d176765a29c0724a244`.

- fresh admission: `READY_FOR_REPOSITORY_INFRASTRUCTURE_STAGING`
- Worker shell: definite success
- inactive Version upload: definite success
- candidate Version: `e49ac8f2-4289-46bc-9f0b-87a20cd7be62`
- workers.dev: disabled
- Preview URLs: disabled
- Deployment count: **0**
- Cron / routes / custom domains: **0 / 0 / 0**
- secret bindings: **0**
- activation: `REPOSITORY_ONLY_BLOCKED`
- D1 mutations: **0**
- API-Football requests: **0**
- final read-only D1 rows read: **38,703**, rows written 0
- request attempts / generations / fixture revisions: **0 / 0 / 0**

Artifacts:
- admission `10660381729`, SHA-256 `e53fe027c5c0a059c917c0a1d405672a39da06847cf7c4e579b61bd6068f4864`
- staging `10659703499`, SHA-256 `199aa79fd363c6d4396d970e7a7db5915e695247be59de62d0052c9a7dfa9cf2`
- closeout `10659194310`, SHA-256 `6549d1950a2144041d330089c52dbdab034179e6b865102a587cc6c29ed53324`

The generic activation reader historically emitted `inventory.deployed=true` whenever the Worker/script endpoints existed. That label did not inspect or prove a Deployment and became misleading once this intentionally inactive Worker existed. The repository closeout changes the report contract to `workerPresent` plus a separate `deploymentCount`.

No Deployment, provider credential, runtime enablement, Cron, API-Football request, workload ingestion or model/product use is authorized by this closeout.

## Outcome of the prerequisite gate

The corrected activation read-only production preflight has passed.

Authoritative evidence:

- workflow: `API-Football Collector Activation Read-Only Preflight`
- run: `35634186433`
- run attempt: `1`
- exact protected `main`: `d88312eb6263a3ef0e5de1be3e79b647a797b830`
- classification: `READY_FOR_REPOSITORY_INFRASTRUCTURE_STAGING`
- artifact: `10655278906`
- artifact SHA-256: `5da299cc5b0bec4064ad7d839e40e05e2b2ad9dde41f7eed785534dfa9bb501b`
- migrations: exact 0001–0006
- foreign-key violations: 0
- Official FPL authority: fresh exact-20
- private mapping: current head, `COMMITTED`, 20 members, 20 distinct provider IDs, 20 distinct FPL IDs
- current canonical FPL team coverage: exact match
- historical mapping provenance: present
- collector runtime: collection disabled, credential `UNPROVISIONED`, no active lease
- request attempts / generations / fixture revisions: 0 / 0 / 0
- live collector Worker: absent
- live collector Cron: 0
- live collector API-key binding: absent
- model/UI collector imports: 0
- D1 rows read: 38,703
- production mutations: 0
- API-Football requests: 0
- secret values read: 0

The earlier STOP run `35631979158` is consumed and must never be rerun.

## Repository implementation approval

Pritesh approved repository implementation only of one dormant, manual-only infrastructure-staging workflow that may later, under a separate execution approval:

1. create the previously absent `teamsheet-api-football-shadow-collector` Worker shell with both `workers.dev` and Version Preview URLs disabled;
2. upload exactly one **inactive** Worker Version;
3. bind that inactive Version to the existing production `teamsheet-data` D1 database;
4. keep `EIA_2I5D_ACTIVATION=REPOSITORY_ONLY_BLOCKED`;
5. keep Cron empty;
6. include no `API_FOOTBALL_API_KEY` binding;
7. create no Deployment and route no traffic.

This approval does **not** authorize live execution, protected-environment creation/configuration, secret provisioning, Worker/Version mutation, Deployment, runtime enablement, Cron or provider egress until Pritesh separately approves those gates.

## Why the Worker shell is a separate first primitive

Cloudflare separates Workers, Versions and Deployments. A Version can be uploaded without deployment, but Version Preview URLs may be routable when previews are enabled. The collector does not currently exist as a live Worker, so there is no previously proven script-level subdomain state to inherit.

The safest first-version sequence is therefore:

### Primitive A — inert Worker shell

Create exactly one Worker object named:

`teamsheet-api-football-shadow-collector`

Required shell configuration:

- `subdomain.enabled = false`
- `subdomain.previews_enabled = false`
- observability enabled, matching repository intent
- no Deployment
- no Cron
- no route/custom domain
- no secret
- no provider request

Cloudflare's current Workers API exposes explicit Worker creation with subdomain controls. This avoids creating a first Version before proving the Worker cannot be reached through `workers.dev` or a Version Preview URL.

### Primitive B — one inactive Version

Only after Primitive A is re-read and proven inert may the workflow submit one Version Upload request.

Cloudflare's stable Workers Scripts Version Upload endpoint explicitly uploads a Version **without deploying it to Cloudflare's network**. The Version and Deployment concepts remain separate.

## Exact inactive Version contract

### Identity

- Worker name: `teamsheet-api-football-shadow-collector`
- entry module: `collector.mjs`
- compatibility date: `2026-09-16`
- repository revision: exact owner-approved current `main`
- annotations must bind the Version to the exact repository SHA and an `api-football-collector-inactive-<12-char-sha>` tag

### Plain-text runtime variables

Exactly:

- `API_FOOTBALL_FPL_SEASON=2026-27`
- `API_FOOTBALL_PROVIDER_SEASON=2026`
- `EIA_2I5D_ACTIVATION=REPOSITORY_ONLY_BLOCKED`

No other plain-text variable is admitted.

### D1 binding

Exactly one D1 binding:

- name: `TEAMSHEET_DATA_DB`
- type: `d1`
- database name: `teamsheet-data`
- database ID: the canonical production D1 identity already pinned by `workers/data-platform/phase4b/live-contract.mjs`

The upload must use an explicit D1 binding. There is no previous collector Version from which to inherit a binding.

The production D1 database itself is not mutated by Version upload. Cloudflare Versions capture binding configuration; D1 data changes are separate state changes.

### Secret bindings

Exactly **zero** secret bindings.

In particular:

- no `API_FOOTBALL_API_KEY`
- no owner crosswalk
- no Anthropic key
- no Odds key
- no unrelated application secret

### Cron and routability

Must remain:

- Worker Deployment count: 0
- Cron schedule count: 0
- `workers.dev`: disabled
- Preview URLs: disabled
- custom domains/routes: none

A Version that fails any of those checks is quarantined and may not be deployed.

## Module graph

The future implementation must build a closed deterministic ES-module graph rooted at:

`workers/api-football-collector/collector.mjs`

The graph must include only repository-owned relative modules reachable from that entry point, including the collector orchestration/persistence/planner/validation modules and their Decision Intelligence dependencies.

Permanent tests must:

- resolve the transitive import graph deterministically;
- reject `http:`, `https:`, `npm:`, `node_modules/` and unresolved imports;
- reject unreviewed extra modules;
- hash every uploaded module;
- bind the graph and metadata hashes to the exact approved repository SHA.

No runtime package install or npm registry access is allowed.

## Credential proposal

### New protected environment

Use a dedicated environment:

`api-football-collector-version-upload`

Do not reuse a data-platform deployment environment by default.

### Proposed secrets / variables

- `CLOUDFLARE_COLLECTOR_WORKER_UPLOAD_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_ACCOUNT_FINGERPRINT` as a protected variable or equivalent non-secret identity pin

No API-Football provider credential is present in this environment.

### Permission boundary

The Cloudflare token should be limited to the minimum account/resource scope that can:

- create/read the named Worker shell;
- inspect/update its subdomain state;
- list/read its Versions, Deployments and Schedules;
- upload one Worker Version.

Cloudflare currently documents `Workers Scripts Write` as sufficient for Worker creation, Worker Version upload and deployment APIs. The token is therefore mutation-capable at the API permission level even though this stage allows no Deployment. The executable request allowlist is a second mandatory boundary.

No D1 write permission is required. Live D1 admission remains in the separate `data-steward-readonly` job.

## Workflow architecture

The future workflow should be manual-only and `run_attempt == 1`.

### Job 1 — repository gate

Before any protected credential:

- require `workflow_dispatch`
- require `refs/heads/main`
- require exact supplied/dispatch SHA to equal remote current `main`
- require clean checkout
- require successful exact-head `Tests and deterministic build`
- run focused infrastructure-staging tests

### Job 2 — fresh read-only admission

Use existing environment:

`data-steward-readonly`

Run the already-accepted activation live preflight contract again immediately before mutation.

It must return:

`READY_FOR_REPOSITORY_INFRASTRUCTURE_STAGING`

Anything else stops before the upload environment becomes eligible.

This read-only stage must still report:

- production mutations: 0
- API-Football requests: 0
- secret values read: 0

### Job 3 — protected inactive staging

Use:

`api-football-collector-version-upload`

Before either mutation:

- reconfirm exact current `main`
- verify the collector Worker is still absent
- verify no Deployment
- verify no Cron
- verify no collector API-key binding
- verify account fingerprint
- verify exact module/metadata identity

Then execute Primitive A followed by an immediate readback.

Only if the Worker shell is proven:

- correct name
- no deployment
- subdomain disabled
- previews disabled
- no schedules

may Primitive B execute.

## Mutation allowlist

The future helper must have a closed method/path allowlist.

The only proposed mutating operations are:

1. **one Worker-shell create**
   - `POST /accounts/{account}/workers/workers`
   - body fixes the collector name and disables subdomain + previews

2. **one inactive Version upload**
   - `POST /accounts/{account}/workers/scripts/teamsheet-api-football-shadow-collector/versions`
   - no Deployment request
   - explicit bindings; no binding inheritance required for the first collector Version

No other POST/PUT/PATCH/DELETE endpoint is allowed.

Explicitly forbidden:

- `POST .../deployments`
- any Schedules mutation
- any Worker secret mutation
- any route/domain mutation
- any D1 mutation
- any Access mutation
- any provider request

## Response ambiguity and retry policy

### Worker shell creation

- definite 4xx rejection: STOP; no retry
- success with exact returned Worker identity: continue only after readback
- timeout / connection loss / malformed response / 5xx: **ambiguous**
  - no second create request
  - read-only reconciliation must determine whether the named Worker now exists
  - if state cannot be proven exact, stop for owner review

### Version upload

- definite 4xx rejection: STOP; no retry
- success with a new exact Version ID: perform postflight
- timeout / connection loss / malformed response / 5xx: **ambiguous**
  - no second upload request
  - reconcile Version history read-only
  - never blind retry

This mirrors the repository's established no-retry mutation discipline.

## Postflight acceptance

A successful staging run must independently prove:

- exactly one collector Worker exists with the expected name;
- workers.dev disabled;
- previews disabled;
- no Deployment;
- no Cron;
- exactly one new inactive candidate Version attributable to the approved SHA;
- candidate compatibility date exactly `2026-09-16`;
- candidate module graph/hash identity exact;
- candidate bindings exactly:
  - `TEAMSHEET_DATA_DB` -> expected production D1
  - three reviewed plain-text vars
- candidate secret-binding count 0;
- `EIA_2I5D_ACTIVATION=REPOSITORY_ONLY_BLOCKED`;
- D1 migrations/FK/mapping/runtime evidence remains unchanged under a final read-only observation;
- request attempts / generations / fixture revisions remain 0;
- API-Football requests remain 0.

The workflow must retain only sanitized evidence and exact non-secret identifiers/hashes needed for later deployment approval.

## Failure / fallback behaviour

No automatic destructive cleanup is proposed.

If only the Worker shell exists after a failed/ambiguous Version upload, it remains inert with subdomain/previews disabled and no Deployment/Cron. Owner review is required before any next mutation.

If an inactive Version exists but postflight fails, it is quarantined. It must not be deployed and must not be automatically deleted.

If any Deployment, Cron, preview exposure, secret binding, D1 mutation or provider request is detected, treat it as an incident rather than a normal rollback case. The staging helper has no authority to repair those states automatically.

## Tests required before merge

Repository implementation must add permanent tests for:

- exact Worker name and shell-create body;
- workers.dev and previews both false;
- no Deployment path in implementation;
- no Schedules mutation path;
- no secret mutation path;
- no API-Football origin in staging helper/workflow;
- exact first-Version metadata and binding set;
- exact D1 identity;
- exact three plain-text vars and blocked activation;
- zero API-key binding;
- transitive module graph closure and module hashes;
- exact-main / exact-head Verify workflow gate;
- first-attempt-only workflow;
- fresh `READY_FOR_REPOSITORY_INFRASTRUCTURE_STAGING` admission before mutation;
- definite rejection no retry;
- ambiguous shell create no retry + reconciliation;
- ambiguous Version upload no retry + reconciliation;
- success postflight proving no deployment/Cron/routability/secret;
- browser/model/product isolation unchanged.

Full `./run-tests.sh`, production build, deterministic rebuilds and exact manifest identity remain mandatory.

## Risks and trade-offs

### Beta Worker-shell API

The explicit Worker-object creation API currently sits under Cloudflare's Workers Beta API. It is attractive because it can set `subdomain.enabled=false` and `subdomain.previews_enabled=false` before any Version exists. The trade-off is using a Beta control-plane API for the shell creation primitive.

The implementation must pin exact response shape and fail closed on drift. If repository investigation finds a stable API path that can guarantee the same pre-Version subdomain state, prefer that instead.

### Broader upload token capability

`Workers Scripts Write` is broader than the two allowed requests. Structural request allowlisting, a dedicated protected environment and manual approval remain necessary.

### Inactive does not mean harmless if previews are exposed

Cloudflare documents that Version Preview URLs can be publicly routable when previews are enabled even without a production Deployment. This is why preview disablement is an admission invariant, not a post-hoc convenience.

### D1 binding is production connectivity

Although an inactive Version receives no scheduled production execution, binding it to production D1 is still a meaningful infrastructure mutation. That is why it is owner-gated and why the Version remains blocked, uncredentialed, unscheduled and undeployed.

## Deliberate exclusions

This stage does not include:

- Worker Deployment;
- traffic;
- API-Football key provisioning;
- D1 runtime `credential_state=AVAILABLE`;
- D1 `collection_enabled=1`;
- `ATTENDED_ONE_SHOT_DISCOVERY`;
- `PRELIVE_PLANNER_ONLY`;
- Cron;
- API-Football requests;
- provider response persistence;
- fixture collection;
- model/calculation changes;
- expected-minutes changes;
- squad/captaincy/transfers/rank/Mini-League changes;
- UI changes.

## Approval sequence after this design

1. **This design/docs PR** — documentation only.
2. **Repository implementation approval** — adds dormant workflow/helper/tests; no live mutation.
3. Merge + exact-main verification.
4. Fresh read-only admission.
5. **Live inactive-staging execution approval** — exactly the two bounded mutation primitives above.
6. Read-only closeout and owner review.
7. Only then may a later Worker Deployment proposal be prepared.

Upload success does not authorize Deployment. Deployment would not authorize API-key provisioning, runtime enablement, Cron or provider egress.

## Current Cloudflare references checked 21 September 2026

- Workers Versions & Deployments:
  https://developers.cloudflare.com/workers/versions-and-deployments/
- Upload Version API:
  https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/create/
- Worker creation API:
  https://developers.cloudflare.com/api/resources/workers/subresources/beta/subresources/workers/methods/create/
- Preview URLs:
  https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/
- Worker Script Subdomain API:
  https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/subdomain/


## Repository implementation candidate — 21 September 2026

Branch `codex/api-football-inactive-version-staging` implements the dormant gate without dispatching it. The candidate adds:

- `.github/workflows/api-football-collector-inactive-version-staging.yml` with repository, fresh read-only admission, protected staging and final read-only closeout jobs;
- `workers/api-football-collector/stage-inactive-version.mjs` with exact shell/Version contracts, deterministic transitive graph construction, SHA-bound module/metadata identity, a two-endpoint mutation allowlist and no-retry ambiguity reconciliation;
- `tests/api-football-collector-inactive-version-staging.test.mjs` with permanent repository-only coverage;
- canonical documentation updates.

Current first-party Cloudflare documentation was rechecked before implementation. Pre-Version Worker creation with explicit `subdomain.enabled=false` and `subdomain.previews_enabled=false` still uses the Workers Beta Create Worker API. The stable Scripts Version Upload endpoint remains the upload primitive and explicitly creates a Version without deploying it. Current multipart metadata documents D1 bindings with `database_id`.

No staging workflow dispatch, Cloudflare mutation, D1 mutation, API-Football request, provider-secret action, Deployment, Cron or route/domain mutation occurred during repository implementation. Live execution remains a separate owner gate after merge and exact-main verification.

### Runtime mapping graph minimisation

Repository implementation narrows the future Worker upload graph so it does not carry mapping-issuance code or private provider/FPL anchor pairs. `planner-orchestrator.mjs` uses `mapping-runtime.mjs` to read the already-persisted mapping. That reader still requires the approved immutable qualification/provenance hashes, validates every mapping identity and receipt shape, recomputes the durable persistence integrity hash across all 20 rows, and requires exact current Official FPL team coverage. The private mapping rows themselves remain in D1 and are absent from retained staging evidence.
