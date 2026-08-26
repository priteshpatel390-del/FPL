# DATA-S2B — Phase 0 Read-Only GitHub Action Candidate

Status: **repository implementation complete; live execution NOT performed or approved**  
Implemented and first-party documentation rechecked: **26 August 2026**

## Outcome and boundary

The repository now contains the manual, fail-closed **DATA-S2B Phase 0 Read-Only Preflight** candidate. It is implementation evidence only: it has not been dispatched with Cloudflare credentials, has made no live Cloudflare read, proves no live account state and authorises no mutation.

The workflow has exactly one trigger (`workflow_dispatch`) and one required input (`approved_sha`, exactly 40 lowercase hexadecimal characters). A credential-free job checks out that SHA and requires exact `HEAD`, current remote `main`, a clean tree and successful exact-head `Verify Teamsheet / Tests and deterministic build`. Only its dependent job references protected environment `data-s2b-phase0-readonly`, so identity failure stops before Cloudflare credentials are available.

The protected job pins Node **24.19.0** and uses existing Cloudflare Workers/D1 REST primitives. It checks Worker deployment history, active deployment/version/timestamp, prior rollback evidence, bindings, allowlisted season, Cron state, custom domains where safely permitted, D1 identity/size, DATA-S1 tables, migration state, governance identifiers, table counts and `official-fpl-r1`-attributable counts. Expected pre-DATA-S2 state is read and enforced rather than assumed: 0001 applied, 0002 pending, no Official FPL governance/history, no hourly DATA-S2 Cron and a prior Worker version.

### Cloudflare response-contract correction

Independent review of the first candidate found two blocking response-shape mismatches before any live execution. The Cron endpoint returns `result: { schedules: [...] }`; the helper now extracts and validates that required `schedules` array before applying the unchanged fail-closed Cron assessment. Worker Settings represents the current D1 binding as `{ type: "d1", name, database_id }`; the helper now accepts exactly that documented form, requires exactly one `TEAMSHEET_DATA_DB`, and compares `database_id` with the unique `teamsheet-data` UUID returned by D1 metadata. The deprecated `type: "d1_namespace"` / `id` form is deliberately rejected rather than silently normalized.

The same audit added explicit extractors and behavioral fixtures for the documented deployment `{ deployments: [...] }` wrapper, settings object, schedule wrapper, D1 database result array, single-result D1 query array and Workers domains result array. Missing, malformed, duplicate and mismatched shapes remain fail-closed. These are repository tests only; the workflow remains unexecuted against Cloudflare.

Final pre-merge review found and corrected one further first-party contract mismatch: the D1 **list** record provides database identity but not `file_size`. The candidate now resolves exactly one `teamsheet-data` list record, verifies the binding against that UUID, then calls the documented read-only D1 **Get Database** UUID path with the already-resolved `databaseId` and explicit `uuid,name,file_size` fields. Details must repeat the expected name/UUID and return a finite non-negative numeric size; missing or inconsistent metadata fails closed rather than becoming `NOT PROVABLE`. The UUID is never summarized or logged. The optional custom-domain read treats only HTTP 403 (unavailable optional permission) as `NOT PROVABLE`; HTTP 401/404, transport failure and malformed domain results fail closed.

The same final review tightened existing gates without widening capability: the dispatch must originate from `refs/heads/main` in the canonical repository, the successful check run must be issued by the GitHub Actions app with the canonical Actions-run URL, and the allowlisted plain-text season binding must exist exactly once in its documented shape. Active Worker identity follows Cloudflare's defined deployments response ordering: array entry zero is the current deployment, never a custom maximum-timestamp inference. Its shape, ID, timestamp and single 100% version are validated, every returned timestamp must parse, and rollback evidence must contain a genuinely different version ID in a later array entry.

## Reuse Before Build

| Primitive | Classification | Decision |
|---|---|---|
| Verify Teamsheet immutable checkout/clean-tree gates | **Adopt** | Reuse exact-revision identity and exact-head check evidence. |
| DATA-S1C masking, protected environment and bounded response handling | **Adapt** | Retain defensive credential/response patterns, not its RPC probe. |
| Workers and D1 REST APIs | **Adopt** | Use mature inventory and fixed-query primitives; no custom control plane. |
| Wrangler migration listing | **Reference** | Avoid installing a mutation-capable CLI; derive applied/pending status from repository migrations plus the fixed `schema_migrations` read. |
| GraphQL Analytics and zone routes | **Reference** | Keep optional until their extra read scopes and identifiers are separately approved. |
| Remote RPC execution, arbitrary SQL, custom control plane | **Reject** | Unnecessary and wider than Phase 0. |

## Owner setup required — do not automate

Before a live run, the owner must separately approve and manually configure:

1. GitHub environment **`data-s2b-phase0-readonly`**, branch-restricted and protected by required owner review;
2. environment secret **`CLOUDFLARE_API_TOKEN`**, a dedicated account-scoped purpose-specific read-only token;
3. environment secret **`CLOUDFLARE_ACCOUNT_ID`**;
4. minimum permissions **Workers Scripts Read** and **D1 Read**;
5. optional **Account Analytics Read** only for a later approved metrics extension; and
6. optional **Workers Routes Read** plus **Zone Read** only if zone routes must be automated safely.

Do not grant Edit permission for convenience. If a needed fact cannot be read with read-only permission, keep it manual/`NOT PROVABLE`. Environment/secret creation and first dispatch are both outside this checkpoint.

## Safe output, SQL and mutation safety

The summary is limited to repository/check status, Worker name, deployment/version IDs and timestamp, binding names/types, expected database name, allowlisted season, Cron expressions, public custom-domain hostnames, migration status, aggregate counts, database size and PASS/FAIL/NOT PROVABLE.

The token, Authorization header, account ID, database UUID, zone ID, secret values, raw headers/URLs/responses and environment dumps are never summarized. Credentials are masked before requests. Raw bodies stay mode-restricted in `$RUNNER_TEMP`, are never uploaded and disappear with runner teardown. There is no `set -x`, `env`, verbose curl or artifact upload.

There is no dispatch SQL input. Literal queries live in `phase0/queries.mjs`. Before every execution the validator strips comments while respecting strings, requires first executable token `SELECT`, permits at most one trailing semicolon, and rejects `INSERT`, `UPDATE`, `DELETE`, `REPLACE`, `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `PRAGMA`, `ATTACH`, `DETACH`, `VACUUM` and `REINDEX`. Database size uses D1 metadata. Permanent tests scan executable workflow/helper content—not explanatory prose—for mutating Cloudflare commands.

Optional analytics are deliberately `NOT PROVABLE`: missing analytics are never represented as zero and do not make core inventory useless. Account custom domains are optional when permission is absent; zone routes remain manual unless separately scoped.

## Stop conditions and tests

Stop on identity/check failure; missing credentials; network/HTTP/JSON/API-contract failure; 401/403; ambiguous deployment; missing rollback version; binding/season/database/schema/migration drift; unexpected Cron; conflicting Official FPL governance/history; or any need for Edit scope, arbitrary SQL, broader security, live implementation testing, provider/model/runtime change or automated environment/secret creation.

Permanent tests cover manual-only dispatch, SHA validation, pre-credential identity/CI ordering, executable mutation absence, literal SQL and injection rejection, safe output, missing credentials, 401/403, documented Cloudflare wrapper/binding contracts, Cron drift, migration drift, rollback evidence, optional metrics, application/runtime isolation and the unchanged synthetic **6,825** invariant.

## First-party documentation recheck

Retrieved **26 August 2026**: [Cloudflare's first-party OpenAPI schemas](https://github.com/cloudflare/api-schemas), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [D1 Wrangler commands](https://developers.cloudflare.com/d1/wrangler-commands/) and [Workers deployment-list API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/deployments/methods/list/).

The recheck continues to show Free Cron CPU **10 ms**, D1 rows read **5,000,000/day**, rows written **100,000/day**, D1 database size **500 MB**, total storage **5 GB**, and **5 Cron Triggers/account**. These are dated evidence, not constants; recheck before execution. Nothing found contradicts the separately approval-gated Versions upload -> inspect -> Versions deploy -> health verification -> Triggers deploy sequence.

## Exclusions

No Worker upload/deployment, trigger change, D1 migration/mutation, route/domain/Access change, token/secret/environment creation, plan change, live Phase 0 execution, DATA-S3, provider/model/runtime or application behavior change is included.
