> **Current state after Gate B:** the original `TRANSPORT_UNKNOWN` provider attempt remains consumed and unchanged. Gate A prepared the corrected Version; Gate B run `37688525299` promoted it through active Deployment `9b48b57a-e505-4213-9547-fe44835a9bdb` and independently reconciled `TRANSPORT_REMEDIATED_DEPLOYMENT_PROMOTED_INERT`. Gate B made no Worker invocation or API-Football request, so this remediation is **not yet live-proven against provider transport**. Gate C remains separate and unimplemented. See [Gate B live closeout](API-FOOTBALL-TRANSPORT-REMEDIATED-DEPLOYMENT-PROMOTION-CLOSEOUT.md).

# API-Football Transport-Unknown Investigation and Repository Remediation

> **Current state (Gate A complete):** consumed Gate A run `37680114065` created corrected Version `4171f3cf-953e-452e-9e5f-068df9a3ca47`, prepared but not deployed. Historical Deployment `2417a3e0…` still selects `04d79556…`. Promotion is the separately gated [transport-remediated Deployment promotion](API-FOOTBALL-TRANSPORT-REMEDIATED-DEPLOYMENT-PROMOTION.md) (Gate B); Gate C remains separate.

> **Next checkpoint:** [remediated reviewed Version preparation](API-FOOTBALL-REMEDIATED-REVIEWED-VERSION-PREPARATION.md) (Gate A, repository only) prepares the corrected collector as a new, separately identified Version. The old Version `04d79556` stays live and unchanged.

Repository-only checkpoint following consumed continuation run `37511401491`. Owner approval covers investigation and repository diagnostic remediation only. **No live Cloudflare or API-Football action is authorized or was taken.** This adds no provider request, no attempt 2, no workflow dispatch, no trigger, no workers.dev change, no D1 mutation, no Worker Version upload, no Deployment change, no secret change and no merge.

Starting main: `c632ea3cb6adb85cf7f1858c0f3192decfbd631e` (PR #312).

## 1. Authoritative record of run 37511401491 (consumed; must never be rerun)

Workflow `API-Football Deployed One-Shot Continuation`, attempt 1, exact main `c632ea3…`.

- Repository gate: PASS. Fresh read-only continuation admission: PASS.
- Protected execution re-proved the exact existing Deployment `2417a3e0-15db-4e45-a3c8-00b148a300f4` (Version `04d79556-3070-429f-9944-b5b53d799842` at 100%), ran the final zone-route scan, enabled workers.dev, proved Worker readiness/signature and enabled D1 collection.
- It sent exactly **one** trigger POST. The Worker answered **HTTP 409 `Not accepted`**. Execution classification `DEPLOYED_ONE_SHOT_EXECUTION_RECONCILIATION_REQUIRED`, diagnostic `DEPLOYED_ONE_SHOT_COLLECTION_NOT_ACCEPTED`, `triggerRequests:1`. No Deployment mutation.
- Cleanup succeeded: collection disabled, workers.dev disabled.
- Independent final read-only reconciliation: `DEPLOYED_ONE_SHOT_OWNER_ATTENTION_REQUIRED`, reason `transport_unknown_attempt_consumed`, `retryAuthorized:false`. (Its `apiFootballRequests:0` field counts requests made by the reconciliation runner itself, not by the Worker.)
- Observed end state: retained Deployment and Version unchanged; workers.dev OFF; Preview OFF; Cron, routes, custom domains all 0; collection disabled; credential `AVAILABLE`; no active lease.
- Durable history: request attempts 1 (attempt 1 count 1, attempt 2 count 0); succeeded 0; transport-unknown 1; generations 1 (failed 1, committed 0); fixture revisions 0; unresolved RESERVED 0; unresolved STAGING 0.
- Mapping 20/20 and Official FPL authority (20 teams) remain valid. No model/UI path. No raw provider payload stored.

Correct statement: **a provider transport attempt occurred, but whether the HTTP request reached API-Football cannot be proven from the available run evidence.** It is not "no provider request". Production is inert again. The run is consumed and no retry is authorized.

## 2. What `TRANSPORT_UNKNOWN` meant in the deployed code

In the deployed Version, `sendApiFootballRequest()` mapped every non-timeout exception thrown by the outbound `fetch()` to `transport_failure`. `executeProviderTransport()` then persisted it as `TRANSPORT_UNKNOWN` with quota state `QUOTA_UNCERTAIN`, and the orchestrator failed the generation with `failure_class='transport_failure'`. The run therefore records only that a `fetch()` call threw. It recorded no error class.

## 3. Investigation findings

### 3.1 Proven

1. **The deployed Version contains `redirect:'error'` on the provider request.** The attended Version module identity is pinned by SHA-256 and re-proved live by admission. Its `api-football-foundation.mjs` hash is `fecb1e70…a2b9d`, byte-identical to main `c632ea3` before this checkpoint. That source builds the request as `{method:'GET', redirect:'error', headers:{'x-apisports-key', accept:'application/json'}}`.
2. **The Cloudflare Workers runtime rejects `redirect:'error'` unconditionally.** In first-party workerd source (`src/workerd/api/http.c++`), `Request::tryParseRedirect` accepts only `follow` and `manual`. The Request constructor (used by `fetch(url, init)`) throws `TypeError: Invalid redirect value, must be one of "follow" or "manual" ("error" won't be implemented since it does not make sense at the edge; use "manual" and check the response status code).` No compatibility flag changes this.
3. **This same failure already happened live in this account.** On 30 August 2026 the DATA-S2B data-platform collector failed in production with error class `Invalid_redirect_value__must_be_one_of__follow__or__manual…` for the same option. That incident is recorded in `workers/data-platform/DATA-S2B-PHASE-4B-OFFICIAL-FPL-REDIRECT-REMEDIATION.md`.
4. Repository tests did not catch it because Node/undici accepts `redirect:'error'`, and every fetch double was permissive. The GitHub-runner qualification runs (Node) used the same request init and succeeded. That proves the contract works under Node, not under Workers.

### 3.2 Inferred (strong, not observed for this run)

In the deployed Worker, `fetch(url, {redirect:'error', …})` throws that TypeError while constructing the Request, before any socket or HTTP I/O. The deployed `settleApiFootballFetch` catches it, and the result maps to `transport_failure`, then `TRANSPORT_UNKNOWN`. On that path the provider request never left the Worker. This explains run `37511401491` completely.

It is an inference because the deployed code captured no error class. Under the existing safety contract the attempt stays consumed and is **not** reinterpreted as definitely unsent.

The same inference has a direct consequence: **every provider request the deployed Version `04d79556` attempts will fail the same way.** Another attempt against that Version gains nothing and burns quota/history state.

### 3.3 Unknown

- Whether some other cause also existed. The exception class was not recorded, so it cannot be ruled out from run evidence alone.
- Whether API-Football would have accepted the deployed headers. The request was most likely never sent.

### 3.4 API-Football request contract (first-party)

API-Football's official documentation (api-football.com, documentation-v3) says the API is configured for **GET requests only** and accepts **only the `x-apisports-key` header**. Non-GET requests or headers not on that list "will receive an error from the API". It also warns that some JS/Node frameworks add extra headers that must be removed. This was read through first-party search excerpts; the documentation host is blocked by this session's egress proxy, so the page could not be fetched directly.

Assessment of `accept: application/json`:
- It is **not on the documented allowlist**.
- The documented consequence is an **API error response**, not a thrown `fetch()`. So the Accept header **cannot explain a transport exception** and is **not the cause** of run `37511401491`.
- Live Node qualification runs that sent it (Node also adds its own default headers) succeeded, so in practice it was tolerated.
- It is removed anyway on a minimal-contract rationale: the request now sends exactly the documented header. No user-agent spoofing, browser emulation, proxy, alternate hostname, retry library or provider change.

### 3.5 Cloudflare outbound-fetch findings

- The Cloudflare Request reference page lists `error` as a redirect mode. That **contradicts** the runtime source and this account's 30 August live failure. The runtime is authoritative; the page is wrong for Workers.
- With redirect mode `follow`, Workers forwards every request header, including credentials, to the redirect destination, even on another host. So `follow` is unsafe for a credential header. `manual` returns the 3xx response unfollowed, and the code now rejects it as `redirect_rejected` (`HTTP_FAILURE` outcome, response obtained, never followed).
- Workers imposes few header restrictions on subrequests. Cloudflare adds its own `CF-Worker` header to Worker subrequests and may request compression automatically. These are platform behaviour the Worker cannot remove; they are not documented as problems for this endpoint.
- The only error detail Worker code gets from a failed `fetch()` is the thrown value: its constructor `name` and a free-text `message`. Cloudflare guarantees neither a stable message vocabulary nor a structured error code for network-layer failures. The classification therefore uses only exact `name` values plus one fixed repository-owned message prefix for the known runtime rejection.

## 4. Repository remediation

### 4.1 Request contract (`apiFootballRequestInit`)

`{method:'GET', redirect:'manual', headers:{'x-apisports-key': key}}`, pinned by `API_FOOTBALL_REQUEST_REDIRECT_MODE` and `API_FOOTBALL_REQUEST_HEADER_NAMES`.

Every 3xx is rejected and never followed:
- in the collector: `redirect_rejected` / `HTTP_FAILURE`;
- in discovery: the existing `redirect_rejected`;
- in the known-ID client: `redirect_rejected`.

Unchanged: origin, endpoint allowlist, query shape, 15-second timeout and request ceilings. GitHub-runner Cloudflare-API scripts still use `redirect:'error'`; that is valid under Node and not Worker-reachable.

### 4.2 Closed transport diagnostic (safety decision kept separate)

`classifyApiFootballTransportException()` maps a thrown value to exactly one repository-owned enum. It reads only an exact `name` string (≤32 chars) inside a try/catch, plus one fixed message-prefix comparison for TypeError (≤512 chars).

| Thrown value | Diagnostic |
|---|---|
| timeout | `TRANSPORT_TIMEOUT` |
| TypeError starting with the Workers invalid-redirect text | `TRANSPORT_RUNTIME_REDIRECT_MODE_REJECTED` |
| other TypeError | `TRANSPORT_FETCH_TYPE_ERROR` |
| AbortError | `TRANSPORT_ABORTED` |
| plain Error | `TRANSPORT_GENERIC_ERROR` |
| non-object thrown | `TRANSPORT_NON_ERROR_THROWN` |
| anything else (unknown or long names, throwing getters, Proxies) | `TRANSPORT_EXCEPTION_UNKNOWN` |

No message, stack, cause, URL, header, key or request object is ever copied.

The **safety decision is unchanged**:
- `reason` stays `provider_timeout` / `transport_failure`;
- the persisted attempt outcome stays `TIMEOUT` / `TRANSPORT_UNKNOWN` with `QUOTA_UNCERTAIN`;
- the attempt is consumed;
- the generation fails with the same `failure_class`;
- no fetch is repeated and no retry exists.

A specific diagnostic never makes an attempt retryable or proves it unsent.

### 4.3 Where the diagnostic goes (no schema change)

The smallest useful channel, with **no D1 migration**:
- the collector result carries `transportDiagnostic`;
- the `sanitizedEvent` allowlist accepts it only as an allowlisted enum;
- an **authenticated** attended trigger that ends 409 adds response header `x-teamsheet-provider-transport-diagnostic` only when the value is allowlisted. Unauthenticated callers still get the generic 404 with no header.

The continuation executor reads that header through the same allowlist into `trigger.providerTransportDiagnostic`, which is otherwise `null`. Durable D1 attempt and generation rows are unchanged. A durable column would need a migration and is deliberately not proposed now.

### 4.4 Immutable Version reality

Repository changes **do not change** live Version `04d79556-3070-429f-9944-b5b53d799842`. It keeps the old transport code (`redirect:'error'`, Accept header, no diagnostic).

To keep that immutable identity provable, the two changed reviewed modules are now read from verbatim, SHA-256-pinned byte snapshots in `workers/api-football-collector/reviewed-attended-module-snapshots/` by the historical module-graph reader. Snapshot drift fails closed. Pinned module hashes are unchanged.

A future Version that carries the remediated code needs its own separately approved reviewed-Version path:
- new module identity and provenance;
- secret bindings;
- inactive-topology proof;
- a Deployment update or replacement strategy;
- an exact owner-gated live plan.

None of this is implemented or executed here.

## 5. Consumed attempt and future options (not implemented)

The history from run `37511401491` is durable and is not deleted, reset or rewritten. No "clear failed attempt" path exists.

- `classifyPriorAttempt` refuses any prior non-success attempt as `prior_attempt_consumed`.
- Same-day `QUOTA_UNCERTAIN` blocks reservation.
- Deployed one-shot and continuation admissions require pristine history, so they now refuse.

Discovery logical-request identity is keyed by UTC day and league.

| Option | Retry? | Quota | Persistence | Ambiguity risk | Evidence gained | Assessment |
|---|---|---|---|---|---|---|
| A. Attempt 2 on the same logical request | Yes | +1, same day blocked by `QUOTA_UNCERTAIN` | needs attempt-2 policy change | high: original attempt still unresolved | none with Version `04d79556` (same TypeError) | not recommended |
| B. New logical opportunity (new UTC day) | No (new identity) | +1 to 5 on a new day | new attempt/generation rows; admissions need a non-pristine-history policy | moderate | none with `04d79556`; full evidence with a new Version | only with a new reviewed Version and new owner gate |
| C. Owner-approved single diagnostic transport probe outside normal collection | No | +1 | separate evidence channel; no collection rows | low if probe-only | proves transport and request contract | possible later design; needs its own gate and Version |
| D. No provider call until a natural new opportunity | — | 0 | none | none | none | current safe default |

**Recommendation:** make no provider call with Version `04d79556`. The next live step should be a separately owner-approved new reviewed Worker Version carrying this remediation, plus an admission policy that accounts for the consumed history (B, or a C-style single probe). Both are new owner gates.

## 6. Verification

- New suite `tests/api-football-transport-diagnostics.test.mjs`.
- Collector/generation regressions in `tests/api-football-collector-activation-foundation.test.mjs`.
- Updated request-contract assertions (`redirect:'manual'`, exact single header) in the EIA-2I1 / EIA-2I5B / EIA-2I5E / team-mapping suites.
- Full suite 2,527/2,527 on Node 24.19.0. Two byte-identical production builds, root/deployable equality and manifest identity verified. App build inputs are unchanged.
