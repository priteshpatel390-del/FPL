> **Current state after Gate B:** this continuation and provider attempt 1 remain consumed. Gate B run `37688525299` successfully promoted corrected Version `4171f3cf-953e-452e-9e5f-068df9a3ca47` through active Deployment `9b48b57a-e505-4213-9547-fe44835a9bdb`, final classification `TRANSPORT_REMEDIATED_DEPLOYMENT_PROMOTED_INERT`. It made no Worker invocation or provider request. Gate C is separate, unimplemented and requires new owner approval. See [Gate B live closeout](API-FOOTBALL-TRANSPORT-REMEDIATED-DEPLOYMENT-PROMOTION-CLOSEOUT.md).

# API-Football Deployed One-Shot Continuation from the Existing Inert Deployment

> **Current state (Gate A complete):** consumed Gate A run `37680114065` created corrected Version `4171f3cf-953e-452e-9e5f-068df9a3ca47`, prepared but not deployed. Historical Deployment `2417a3e0…` still selects `04d79556…`. Promotion is the separately gated [transport-remediated Deployment promotion](API-FOOTBALL-TRANSPORT-REMEDIATED-DEPLOYMENT-PROMOTION.md) (Gate B); Gate C remains separate.

> **Superseding next step:** this continuation is consumed. Any new live use needs the [remediated reviewed Version preparation](API-FOOTBALL-REMEDIATED-REVIEWED-VERSION-PREPARATION.md) (Gate A), a separate promotion (Gate B) and an owner-gated admission for the consumed history (Gate C).

Date: 6 October 2026
Status: owner-approved **repository implementation only**. Nothing here has been executed live. Dispatching the continuation workflow, enabling workers.dev, mutating D1, sending the trigger and every API-Football request each require a **new explicit owner approval** after draft-PR review, exact-head green CI, owner-approved merge and post-merge exact-main verification.

## Historical record — consumed run 37505586273

- Workflow `API-Football Deployed One-Shot Shadow Collection`, run `37505586273`, attempt 1, on exact main `a8d4e78f022259868208e097fc779f9de768b2f6` (PR #311). The run is **consumed and must never be rerun**; `retryAuthorized:false`.
- Repository gate and fresh read-only admission passed. The protected executor repeated the critical recheck and the authoritative `ZONE_ROUTE_SCAN` (zoneCount 1, routeRowCount 0, routeCount 0), then submitted **exactly one Deployment creation POST** and stopped fail-closed as `DEPLOYED_ONE_SHOT_DEPLOYMENT_AMBIGUOUS`. No Deployment retry occurred.
- Execution evidence: `stagesReached:["CREATE_DEPLOYMENT"]`, createDeployment 1, enableWorkersDev 0, triggerRequests 0, collection-enable never reached, collection-disable and workers.dev-disable cleanup both succeeded, d1Calls 1, d1RowsChanged 0, executor API-Football requests 0, secret values serialized 0.
- The independent final read-only reconciliation proved that the POST **did take effect**: classification `DEPLOYED_ONE_SHOT_CLEAN_STOP_NO_PROVIDER_REQUEST` / `stopped_before_trigger`. Exact Deployment `2417a3e0-15db-4e45-a3c8-00b148a300f4` selects reviewed attended Version `04d79556-3070-429f-9944-b5b53d799842` at 100%; workers.dev, Preview, Cron, custom domains, legacy routes and zone routes are all off/zero; collection disabled; credential `AVAILABLE`; no lease; request attempts, generations, fixture revisions and every failure counter 0; the 20/20 mapping and the 20-team Official FPL authority remain exact; model/UI imports 0; no raw-payload storage.
- The first run's history is retained as written. The inert Deployment is now accepted live state. It must not be deleted, recreated or modified.

## Root cause

1. The one-shot assumed a zero-Deployment start and a created-by-execution Deployment. Its Deployment step classified any response that was not a recognisable exact success as `AMBIGUOUS` and stopped, **without checking whether the mutation applied**. Cloudflare applied it. The repository cannot determine from stored evidence which response element failed the closed success check; it does not need to, because readback is the authority.
2. The generic lifecycle preflight (`VERSION_URL_CREATION_EXPERIMENT_CLOSEOUT`) still requires zero Deployments, so it now STOPs with `lifecycle_clone_inventory_unexpected`. That is a stale-expectation false negative, not drift.

## Remediation

### 1. Continuation from the existing Deployment (new, isolated)

| File | Purpose |
|---|---|
| `workers/api-football-collector/deployed-one-shot.mjs` | Adds the continuation constants, admission classifier, handoff validator, pure orchestrator without any Deployment operation, and `classifyDeployedOneShotContinuationReconciliation`. Historical zero-Deployment admission is untouched. |
| `workers/api-football-collector/deployed-one-shot-continuation-readonly.mjs` | Read-only continuation admission and reconciliation: lifecycle preflight, one Deployments GET (read credential), authoritative zone route scan (distinct topology credential). |
| `workers/api-football-collector/run-deployed-one-shot-continuation.mjs` | Protected executor with a closed endpoint allowlist that has **no Deployment POST**. |
| `.github/workflows/api-football-deployed-one-shot-continuation.yml` | Dormant manual workflow: repository gate, read-only admission, protected execution, always-run reconciliation. |
| `tests/api-football-deployed-one-shot-continuation.test.mjs` | Permanent regression coverage. |

**Admission** accepts the preflight report only when it is exactly `ok:false`, classification `STOP_VERSION_URL_CREATION_EXPERIMENT_CLOSEOUT_REVIEW_REQUIRED` with reason `lifecycle_clone_inventory_unexpected`, and the observed fields independently prove every other invariant: account/SHA/provenance identity, migrations 0001–0006, zero FK violations, exact reviewed Version and three-Version inventory, Worker identity, activation/production binding/configuration, secret bindings by name only, preview identity, fresh valid 20-team Official FPL authority, committed exact 20/20 mapping, model/UI imports 0, no raw-payload storage, collection disabled, credential `AVAILABLE`, no lease, pristine provider history, workers.dev/Preview off, Cron/legacy routes/custom domains 0, **exactly one Deployment with ID `2417a3e0-…`, selecting only the reviewed Version at 100%** (cross-checked between inventory and a direct Deployments read), and an independent zone route scan of zero. Any other stop reason, any malformed or unreadable state, any deviation fails closed. Other preflight stop reasons are never accepted.

**Execution** (`createDeployment: 0`, `enableWorkersDev: 1`, `disableWorkersDev: 1` executable ceilings):

1. Every credential (attended read, attended mutation, distinct topology read, trigger secret) is required, and separation is enforced, **before any network request**.
2. Bound admission handoff is validated; fresh critical foundational recheck; fresh Deployments GET; fresh authoritative zone route scan against the original collector.
3. A second fresh Deployments GET immediately before the first mutation proves exactly one Deployment, exact ID, exact Version at 100%. Unreadable, changed, missing or duplicated state stops with no mutation. There is no repair, recreation, deletion or retry.
4. workers.dev enabled once; collector signature proved by the existing bounded secret-free GETs; bounded D1 collection enable; exactly one trigger POST (existing five-request provider ceiling unchanged; transport ambiguity still consumes the attempt).
5. Cleanup is mandatory once workers.dev enable has been attempted: collection disable and workers.dev disable, each independent. Primary and cleanup failures remain separately visible and a cleanup failure is never success. The Deployment is retained.

**Reconciliation** judges success only from read-only state: exactly one Deployment with the exact ID and Version at 100%; workers.dev/Preview off; Cron, legacy routes, zone routes, domains 0; collection disabled; credential `AVAILABLE`; no lease; exactly five attempt-1 requests, all successful; attempt-2 0; exactly one committed generation with consistent membership/head and no RESERVED/STAGING; fixture revisions within the existing ceiling; unchanged mapping and authority; model/UI imports 0; no raw-payload surface; valid continuation execution evidence with exactly one trigger and `createDeployment: 0`. Pristine provider history is a **clean stop, never success**. Anything uncertain is owner attention; nothing retries.

### 2. Generic Deployment-creation ambiguity (future-proofing)

`createDeploymentWithReadback` (used by the original executor; not by the continuation) submits the creation POST **at most once** and never resends it. A definitive exact success continues (`CREATED`); a definitive 4xx rejection stops (`REJECTED`). Any ambiguous outcome (transport failure, 5xx, invalid JSON/envelope, malformed or non-exact result) triggers exactly **one** read-only readback: exactly one Deployment selecting exactly the requested Version → `APPLIED_CONFIRMED_BY_READBACK`; zero Deployments → `NOT_APPLIED`; anything else or unreadable → `AMBIGUOUS_OWNER_ATTENTION`. Its precondition is that the caller proved zero Deployments before the POST. The generic reconciliation also accepts `APPLIED_CONFIRMED_BY_READBACK` and still requires the exact Deployment ID.

## What did not change

Provider qualification, endpoint set, competition set, team mapping, fixture identity, participation, expected minutes, projections, fixture model, squad/transfer/captaincy/simulation/rank/Mini-League logic, recommendations and UI are unchanged. API-Football remains **shadow only**; no accuracy or predictive benefit is claimed. Collector runtime, scheduler, persistence and D1 schema are unchanged. Cron, routes, custom domains, Preview, Versions and secrets are untouched.

## Next gates (each separate)

1. Owner review and merge of the draft PR.
2. Post-merge exact-main Verify Teamsheet.
3. A new explicit owner approval to dispatch `API-Football Deployed One-Shot Continuation` once on that exact main (first-attempt-only; never rerun). Run `37505586273` and its workflow remain consumed.

## Consumed live run 37511401491

This continuation was dispatched once as run `37511401491` on exact main `c632ea3…`. Admission passed, Deployment and routing readiness were re-proved, collection was enabled and one trigger was sent. The Worker returned 409 `Not accepted`. Cleanup succeeded. Reconciliation found attempt 1 `TRANSPORT_UNKNOWN`, one failed generation, zero fixture revisions, no attempt 2 and `retryAuthorized:false`. The run is consumed and must never be rerun. Admission now refuses because history is no longer pristine. The 409 response now carries an allowlisted transport diagnostic header only from Worker code newer than Version `04d79556`. See [transport-unknown remediation](API-FOOTBALL-TRANSPORT-UNKNOWN-REMEDIATION.md).
