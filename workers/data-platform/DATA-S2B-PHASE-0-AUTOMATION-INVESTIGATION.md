# DATA-S2B — Phase 0 Read-Only Automation Investigation

Status: **design complete; automation execution and all live mutation remain unapproved**  
Investigated: **26 August 2026**

> **Implementation update — 26 August 2026:** The owner subsequently approved repository implementation only. The resulting manual candidate is recorded in [DATA-S2B Phase 0 Read-Only GitHub Action Candidate](DATA-S2B-PHASE-0-READ-ONLY-IMPLEMENTATION.md). It has not been run with Cloudflare credentials and makes no live-state claim. This supersedes only the earlier “must not be added yet” implementation gate below; its least-privilege findings and live-execution gate remain authoritative.

## Outcome and stop condition

A manual, fail-closed GitHub Action is technically feasible, but it must **not be added or run yet**. The repository proves only that the existing `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` environment secrets were available to the separately protected DATA-S1C acceptance environment and that the token successfully read Worker deployment history. Repository and GitHub API access available during this investigation cannot enumerate the secrets or the token's permission policy. D1 Read, Workers configuration read, account analytics read and zone read permissions are therefore not evidenced.

This satisfies the project stop condition: implementing a useful Phase 0 action may require permissions that cannot currently be proven. The owner must first inspect the existing token policy, without sharing its value, and approve either reuse or a purpose-specific read-only token. No workflow is added by this record.

## Reuse Before Build classification

| Existing primitive | Classification | Decision |
|---|---|---|
| `Verify Teamsheet` exact-revision checkout and deterministic gate | **Adopt** | Reuse its immutable-SHA and clean-tree pattern. |
| DATA-S1C manual acceptance credential masking, REST response classification and PRE/POST topology reads | **Adapt** | Reuse the defensive shell/API pattern, not its remote RPC probe. |
| Wrangler `d1 migrations list --remote` and `d1 execute --remote --command <SELECT>` | **Adopt**, subject to a proven D1 Read token | These are mature Cloudflare primitives; allow only a fixed SQL allowlist. |
| Cloudflare Workers/D1 REST APIs | **Adopt** | Prefer documented GET endpoints for deployment, settings, schedules, domains/routes and database metadata. The D1 query endpoint is HTTP POST but can be constrained to read-only SQL. |
| Cloudflare GraphQL Analytics API | **Adapt**, subject to Analytics Read | Use fixed queries for Workers/D1 metrics; do not create a custom analytics service. |
| DATA-S1C ephemeral `wrangler dev --remote` probe | **Reject** | It executes Worker code and does not establish the required account/D1 inventory as safely as direct APIs. |
| A new custom Cloudflare control plane | **Reject** | Unnecessary and broader than Phase 0. |

## Existing repository infrastructure and credential evidence

The only Cloudflare-specific workflow is `.github/workflows/data-s1c-private-rpc-acceptance.yml`. It is `workflow_dispatch` only, has `contents: read`, uses the protected `data-s1c-private-acceptance` environment, pins Node `24.19.0` and Wrangler `4.125.0`, masks both credential values, and consumes secrets named `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. It reads `GET /accounts/{account}/workers/scripts/{script}/deployments` before and after its bounded probe.

That successful historical endpoint establishes only **Worker deployment-history read for the named account/scripts at that time**. Secret names do not prove present availability to a new environment, and a successful Workers endpoint does not prove D1, analytics, account subscription, zone, route or custom-domain scopes. GitHub refused this investigator's attempt to enumerate Actions secrets/variables with HTTP 403, so no broader claim is made.

## Check-to-primitive and permission map

| Evidence | Preferred primitive | Minimum capability to verify | Current evidence |
|---|---|---|---|
| deployed version/deployment ID and timestamp | Workers REST deployment/version GET | Workers Scripts Read | **Partly evidenced** by the DATA-S1C deployment GET |
| bindings, compatibility/config and non-secret vars | Workers REST script settings/version GET | Workers Scripts Read | Not proven |
| active Cron set | Workers REST schedules GET | Workers Scripts Read | Not proven |
| custom domains | account Workers domains GET | Workers Scripts Read | Not proven |
| zone routes | zone Workers routes GET | Workers Routes Read plus zone identity | Not proven; no zone secret is evidenced |
| D1 database identity, metadata and size | D1 REST database GET/list | D1 Read | Not proven |
| applied/pending migrations | pinned Wrangler `d1 migrations list teamsheet-data --remote --config ...` | D1 Read, if Wrangler accepts that scope | Not proven |
| schema, governance rows and counts | pinned Wrangler `d1 execute teamsheet-data --remote --command <fixed SELECT> --json --config ...`, or D1 REST query | D1 Read | Not proven |
| Worker outcome/error/CPU metrics | fixed GraphQL Analytics query | Account Analytics Read | Not proven |
| D1 rows read/written/query metrics | fixed GraphQL Analytics query; database dashboard remains fallback | Account Analytics Read and dataset availability | Not proven |
| account plan, aggregate Cron count and hard limits | documented APIs where exposed, otherwise owner dashboard plus current first-party limit docs | Account settings/subscription read may be required | Not proven; do not infer plan from token behavior |

Wrangler has no advantage for ordinary GET inventory. Use it only for its established migration-list and remote D1 execution contracts. `d1 execute` must receive one of the literal audited SELECT statements below; never accept arbitrary dispatch input. If Wrangler cannot prove that the token is read-only, use the D1 REST query API with the same SQL gate or stop.

## Proposed manual action (not implemented)

### Trigger and immutable identity

1. `workflow_dispatch` only, restricted to a new protected environment such as `data-s2b-phase0-readonly` with required owner approval.
2. Require an `approved_sha` input matching `^[0-9a-f]{40}$`.
3. Check out that SHA with `fetch-depth: 0`; require `HEAD == approved_sha`, a clean tree, and `git ls-remote ... refs/heads/main == approved_sha`.
4. Query GitHub's checks API for that exact SHA and require the completed `Verify Teamsheet / Tests and deterministic build` check to be successful before Cloudflare credentials are exposed.
5. Statically scan the checked-in action/helper for forbidden tokens: `deploy`, `versions upload`, `versions deploy`, `triggers deploy`, `migrations apply`, `secret`, and SQL write/DDL verbs. Keep Cloudflare credentials out of all earlier steps.

### Worker inventory

Using `curl --fail-with-body` with the bearer token only in an environment variable and response bodies in `$RUNNER_TEMP`:

1. GET deployment history and the active version for `teamsheet-data-platform`; require one unambiguous current deployment and retain at least one prior version ID for rollback evidence.
2. GET script/version settings; permit only the expected `TEAMSHEET_DATA_DB` binding, known compatibility settings and a small allowlist of non-secret vars. Report secret **names/types only**, never values.
3. GET schedules; require no `0 * * * *` DATA-S2 trigger and fail on any unexplained schedule.
4. GET account custom domains and, only if a separately evidenced zone ID/read scope exists, zone Worker routes. Otherwise mark route inspection `NOT PROVABLE` and stop rather than silently pass.

### D1 inventory

1. GET/list D1 metadata for the exact database name `teamsheet-data`; derive its ID from the API response rather than printing/accounting on a hard-coded secret. Record database UUID only in the restricted artifact; the public summary may use the database name and a short hash.
2. Run pinned Wrangler's remote migration list. Require `0001_shadow_data_foundation.sql` applied and `0002_official_fpl_structured_history.sql` pending; any other state fails closed.
3. Execute only fixed read statements. Before execution, a parser gate must trim comments/whitespace, require the first token `SELECT`, reject semicolons except one trailing terminator, and reject `INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP|TRUNCATE|PRAGMA|ATTACH|DETACH|VACUUM|REINDEX` case-insensitively.
4. Query `sqlite_master` for required DATA-S1 tables and `schema_migrations`; select the two governance identifiers; count `data_sources`, `data_source_revisions`, `ingestion_runs`, `shadow_observations`, `observation_heads` and `canonical_entities`; and use fixed joins/subqueries to count all revision/run/observation/head rows attributable to `official-fpl-r1`.
5. Obtain database size from D1 metadata. Do not use a write-affecting SQLite pragma.

The action must account for the fact that these SELECTs themselves consume D1 rows-read usage. It must report query metadata where returned and use bounded indexed predicates for governance checks.

### Metrics and limits

Use fixed Cloudflare GraphQL Analytics queries, only when Account Analytics Read is proven, for a bounded preflight window and filters limited to this Worker/database. Summarize invocation outcome/error counts, CPU quantiles where the dataset exposes them, and D1 query/rows-read/rows-written measures where exposed. Dataset/schema availability varies; missing metrics must be `NOT PROVABLE`, never zero. The current plan and aggregate account Cron usage should be read through a documented endpoint only if the token has an appropriate account-read scope; otherwise require sanitized owner dashboard evidence.

Recheck immediately before execution against Cloudflare's first-party [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Cron Trigger documentation](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [Workers analytics](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/) and [D1 analytics](https://developers.cloudflare.com/d1/observability/metrics-analytics/). On 26 August 2026 those sources still show Free Cron CPU **10 ms**, D1 queries per Free Worker invocation **50**, D1 rows read **5,000,000/day**, rows written **100,000/day**, database size **500 MB**, total storage **5 GB**, and **5 Cron Triggers/account** on Workers Free.

## Safe output and mandatory redaction

Safe in the sanitized job summary: exact repository SHA and check conclusion; Worker name; deployment/version IDs and timestamps; binding **name/type** and expected database name; Cron expressions; route/custom-domain hostnames already public; allowlisted non-secret vars such as season; table/count results; migration filenames/status; aggregate metrics; database size; limit values; and PASS/FAIL/NOT PROVABLE classifications.

Keep full raw API/GraphQL/Wrangler responses in a short-retention restricted artifact only after structured redaction. Mask or omit API token values, bearer headers, account ID, database UUID, zone ID, secret values, secret payloads, account secrets, session cookies, Access JWTs, service-token credentials, private credentials, request headers, GraphQL variables containing identifiers, and any provider/user data. Never enable shell tracing. Do not print `env`, generated curl commands, raw headers or URLs containing identifiers.

## Fail-closed rules

Fail before live reads if credentials are missing, the environment approval is absent, the checkout is not the approved current `main`, Verify Teamsheet is not green, the worktree is dirty, tooling hashes/versions differ, or the capability scan fails. Fail during reads on HTTP/network/schema errors, 401/403, ambiguous deployment, binding/domain/route/Cron drift, migration drift, missing DATA-S1 schema, conflicting governance identifiers, unexplained Official FPL history, missing rollback version, or any metric required for an approval claim being unavailable.

An insufficient permission is not a reason to broaden the token during a run. Stop, report the failed capability by name, and request separate owner action.

## Minimum credential decision for the owner

First inspect the existing token policy. If it does not already have the following read-only permissions, create neither scopes nor secrets without a separate decision. A purpose-specific Phase 0 token would need, at minimum:

- **Workers Scripts Read** for deployments, versions/settings, schedules and account Worker domains;
- **D1 Read** for database metadata and fixed SELECT queries/migration inspection;
- **Account Analytics Read** only if automated Workers/D1 metrics are required;
- **Workers Routes Read / Zone Read** only if route inventory cannot be established through account Worker-domain data and sanitized dashboard evidence.

Scope it to the single Cloudflare account and, where Cloudflare supports resource scoping, the relevant Worker/database/zone; store it only in the protected Phase 0 environment; require owner approval; rotate/revoke after acceptance. Read-only D1 still exposes retained shadow data and incurs rows-read usage, so it remains a sensitive credential. If Cloudflare cannot express the necessary least privilege, keep that check manual rather than granting edit scope.

## Deployment control and counting invariant

This investigation preserves the DATA-S2B promotion sequence: **do not use normal `wrangler deploy`** because the merged configuration declares the hourly Cron. After separate future mutation approval, use `wrangler versions upload` -> inspect -> `wrangler versions deploy` -> health verification -> `wrangler triggers deploy`. Phase 0 contains none of those commands.

The permanent synthetic regression invariant remains **6,825**. It is not a real-live baseline. Live acceptance must derive the candidate count from validated populations:

`events * 3 + teams * 10 + players * 11 + fixtures * 7`.
