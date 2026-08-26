# DATA-S2B — Phase 0 Read-Only GitHub Action

Status: **implemented and live-read exercised; current D1 identity correction is under review in PR #164; no Cloudflare mutation authorised or performed**  
Originally implemented and first-party documentation rechecked: **26 August 2026**  
Current live-state evidence: [DATA-S2B Phase 0 Live-State Reconciliation](DATA-S2B-PHASE-0-LIVE-STATE-RECONCILIATION.md)

> **Current-state note — 26 August 2026:** this record has been reconciled after owner-approved read-only Runs #2 and #3. The earlier automation-investigation record remains useful historical design evidence, but statements there or in earlier revisions that the action has never run, that `DATA_S2_SEASON` must already be live during Phase 0, or that D1 identity should depend on unique name-search list cardinality are superseded by this record and the live-state reconciliation.

## Outcome and boundary

The repository contains the manual, fail-closed **DATA-S2B Phase 0 Read-Only Preflight**. Its purpose is to inspect the existing private `teamsheet-data-platform` Worker and `teamsheet-data` D1 before any DATA-S2 mutation proposal.

The workflow has exactly one trigger (`workflow_dispatch`) and one required input (`approved_sha`, exactly 40 lowercase hexadecimal characters). A credential-free job checks out that SHA and requires exact `HEAD`, current remote `main`, a clean tree and successful exact-head `Verify Teamsheet / Tests and deterministic build`. Only its dependent job references protected environment `data-s2b-phase0-readonly`, so repository/identity failure stops before Cloudflare credentials are available.

The protected environment is configured with required owner review, administrator bypass disabled, and deployment branch restricted to `main`. It holds a purpose-specific Cloudflare token with **Workers Scripts Read + D1 Read** and the account ID. The workflow does not create or modify those controls.

The protected job pins Node **24.19.0** and uses existing Cloudflare Workers/D1 REST primitives. It checks Worker deployment history and rollback evidence, pre-mutation binding state, Cron state, D1 identity/size, DATA-S1 tables, migration state, governance identifiers, table counts and `official-fpl-r1`-attributable counts. Custom domains are optional only when the dedicated read token receives the explicitly tolerated missing-permission response; optional analytics remain `NOT PROVABLE` rather than being invented.

No Worker upload/deployment, trigger change, D1 migration/write, route/domain/Access change, token/secret/environment creation, DATA-S3, provider/model/runtime or application behavior change is part of Phase 0.

## Live read-only execution history

Two owner-approved executions have reached Cloudflare and failed closed on repository-contract defects before mutation.

### Run #2 — pre-mutation Worker bindings

Run #2 proved that the live Worker prestate does **not** match the later post-deployment binding contract. Owner dashboard evidence showed:

- required D1 binding `TEAMSHEET_DATA_DB`;
- retained rollback secret `DATA_S1_HTTP_AUTH_TOKEN`;
- `DATA_S2_SEASON` absent pre-mutation.

PR #163 corrected Phase 0 to use an explicit pre-mutation binding contract while preserving the stricter post-deployment contract for later acceptance. The PR merged and its exact merge passed Verify Teamsheet.

Current Phase 0 pre-mutation binding rules are:

- require exactly one `TEAMSHEET_DATA_DB` of type `d1`;
- permit the known retained `DATA_S1_HTTP_AUTH_TOKEN` of type `secret_text` without reading its value;
- require `DATA_S2_SEASON` to be absent;
- fail closed on duplicate, wrong-type or unexplained extra bindings.

The post-mutation contract remains unchanged for later separately approved deployment acceptance: exactly `TEAMSHEET_DATA_DB` (`d1`) plus `DATA_S2_SEASON` (`plain_text`) and no extra binding.

### Run #3 — D1 identity

Run #3 passed the repository gate and corrected Worker/Cron prestate checks, then stopped at `database_identity_drift` before D1 schema/query inspection.

The then-current helper had treated `GET /d1/database?name=teamsheet-data` as a unique identity lookup and required the returned list to contain exactly one record. Subsequent owner dashboard inspection showed the genuine `teamsheet-data` database and a separate similarly named validation database. Independently opening the genuine database and clicking Worker `TEAMSHEET_DATA_DB` both led to the **same D1 UUID**. The live Worker binding is therefore correct; the list-cardinality check was the false-negative source.

The live UUID is intentionally not hard-coded or summarized.

## Current D1 identity contract

The current correction adopts Cloudflare's provider-native identity chain instead of building or maintaining a parallel registry:

1. read Worker settings;
2. normalize exactly one valid `TEAMSHEET_DATA_DB` binding and obtain its non-empty `database_id`;
3. use that binding UUID as the authoritative database identity for Phase 0;
4. call the documented read-only **Get D1 Database** endpoint for that exact UUID;
5. require the returned UUID to equal the bound UUID;
6. require the returned name to equal exactly `teamsheet-data`;
7. require a finite non-negative numeric `file_size`;
8. only then run the fixed audited SELECT queries against the same UUID.

The executable identity path no longer depends on the D1 list endpoint's `name` search or on search-result cardinality. A missing/invalid binding ID, exact-UUID lookup failure, UUID mismatch or wrong exact database name remains a STOP condition.

The D1 list response normalizer is retained as a tested utility/response contract, but it is not the authoritative execution path for database identity.

## Reuse Before Build

| Primitive | Classification | Decision |
|---|---|---|
| Verify Teamsheet immutable checkout/clean-tree gates | **Adopt** | Reuse exact-revision identity and exact-head check evidence. |
| DATA-S1C masking/protected-environment patterns | **Adapt** | Retain defensive credential handling, not its RPC probe. |
| Worker D1 binding `database_id` + Get Database-by-ID | **Adopt** | Use Cloudflare's own resource identity rather than a custom registry or name-search assumption. |
| Workers and D1 REST APIs | **Adopt** | Use mature inventory and fixed-query primitives; no custom control plane. |
| D1 name-search list cardinality as identity | **Reject** | Search results are unnecessary for proving the database actually bound to the Worker. |
| Hard-coded live D1 UUID | **Reject** | Discover identity from the current Worker binding every run. |
| Wrangler migration listing | **Reference** | Avoid installing a mutation-capable CLI for Phase 0; derive applied/pending state from repository migrations plus fixed `schema_migrations` reads. |
| GraphQL Analytics and zone routes | **Reference** | Keep optional until their extra read scopes and identifiers are separately approved. |
| Remote RPC execution, arbitrary SQL, custom control plane | **Reject** | Unnecessary and wider than Phase 0. |

## Cloudflare response contracts

The helper validates the provider response shape before trusting data:

- deployment endpoint: required `{ deployments: [...] }` wrapper;
- Worker settings: required settings object with bindings array;
- D1 Worker binding: current `{ type: "d1", name, database_id }` form; deprecated `d1_namespace` / `id` is rejected;
- schedules endpoint: required `{ schedules: [...] }` wrapper;
- Get D1 Database: exact bound UUID, exact name `teamsheet-data`, finite non-negative `file_size`;
- D1 query: exactly one successful result object with a results array;
- Workers domains: array shape, with only the approved optional-permission failure mapped to `NOT PROVABLE`.

Active Worker identity follows Cloudflare's documented deployments response ordering: array entry zero is treated as current. Its shape, ID, timestamp and single 100% version are validated, and rollback evidence must contain a genuinely different prior version.

## Safe output, SQL and mutation safety

The summary is limited to repository/check status, Worker name, deployment/version IDs and timestamp, binding names/types, expected database name, season presence/absence state, Cron expressions, public custom-domain hostnames, migration status, aggregate counts, database size and PASS/FAIL/NOT PROVABLE.

The token, Authorization header, account ID, database UUID, zone ID, secret values, raw headers/URLs/responses and environment dumps are never summarized. Credentials are masked before requests. Raw bodies stay mode-restricted in `$RUNNER_TEMP`, are never uploaded and disappear with runner teardown. There is no `set -x`, `env`, verbose curl or artifact upload.

There is no dispatch SQL input. Literal queries live in `phase0/queries.mjs`. Before every execution the validator strips comments while respecting strings, requires first executable token `SELECT`, permits at most one trailing semicolon, and rejects `INSERT`, `UPDATE`, `DELETE`, `REPLACE`, `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `PRAGMA`, `ATTACH`, `DETACH`, `VACUUM` and `REINDEX`.

Although Cloudflare's D1 query API uses HTTP POST, the repository permits only those fixed validated SELECT statements. Phase 0 contains no D1 mutation SQL or Cloudflare deployment/trigger/migration commands.

## Permanent tests

Permanent coverage includes:

- manual-only dispatch and exact immutable SHA input;
- canonical repository/current-main/exact-head Verify Teamsheet gates before environment secrets;
- executable mutation-command absence;
- fixed SQL allowlist and injection/write/DDL rejection;
- credential masking/redaction and missing-credential failure;
- 401/403 fail-closed handling;
- deployment/rollback, settings, schedules, D1 and domains response contracts;
- Phase 0 pre-mutation binding contract and strict later post-mutation binding contract;
- proof that the retained DATA-S1 secret value is never read;
- binding UUID as the executable D1 identity source;
- no `?name=teamsheet-data` dependency in the executable identity path;
- exact UUID and exact database-name checks;
- a regression fixture proving the similarly named `teamsheet-data-s1b-validation-20260822` database cannot satisfy the exact-name contract;
- Cron and migration drift;
- optional metrics semantics;
- application/runtime isolation;
- unchanged synthetic **6,825** DATA-S2A invariant.

Full acceptance is the repository's Verify Teamsheet **Tests and deterministic build** job, including the complete test suite, production build, byte-for-byte deterministic rebuild and build-identity/provenance checks.

## Remaining live Phase 0 gate

Run #3 stopped before D1 schema/query inspection. The complete live D1 prestate is therefore still unproved by the automated workflow. No further live run is authorised merely because this repository correction exists or passes CI.

Required sequence remains:

1. exact-head Verify Teamsheet success for the correction PR;
2. explicit owner approval before merge;
3. exact post-merge `main` verification and exact-merge Verify Teamsheet;
4. separate explicit owner approval for another read-only Phase 0 dispatch on that exact `main` SHA;
5. review the resulting complete Phase 0 evidence before any mutation proposal.

Migration 0002, Worker Versions upload/deployment and Cron activation remain separately approval-gated. The approved future promotion sequence remains **Versions upload -> inspect -> Versions deploy -> health verification -> Triggers deploy**, not a normal one-step `wrangler deploy`.

## First-party documentation basis

The Phase 0 design uses Cloudflare's first-party Workers/D1 API contracts and current limits documentation. Dated Free-limit evidence from 26 August 2026 remains a pre-mutation recheck requirement rather than a permanent constant. Relevant sources include Cloudflare Workers limits, D1 limits/pricing, Cron Trigger documentation and Workers/D1 API documentation.
