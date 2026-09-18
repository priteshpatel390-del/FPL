# API-Football Live Storage Foundation — Read-Only Preflight

Date: 19 September 2026  
Status: **owner-approved read-only preflight implementation candidate only**. No production mutation is authorized by this document.

## Outcome

The next approved API-Football checkpoint is live storage foundation, but production mutation must not begin until current Cloudflare/D1 state is observed directly.

This repository candidate adds one manual-only, exact-current-main, read-only preflight that reuses the existing protected `data-steward-readonly` environment. Its Cloudflare token contract is already limited to **Workers Scripts Read + D1 Read**. The preflight performs no D1 write, migration, Worker deployment, secret change, Cron change or API-Football request.

The preflight exists to answer the storage-state questions that repository configuration alone cannot prove:

- authoritative production `teamsheet-data` D1 identity;
- live `teamsheet-data-platform` `TEAMSHEET_DATA_DB` binding;
- exact `schema_migrations` ledger;
- presence of migration 0004/0005/0006 objects;
- foreign-key violations;
- sanitized API-Football mapping/runtime/request/discovery/fixture counts;
- current Official FPL authority validity/freshness;
- whether the API-Football collector Worker exists;
- collector D1 binding/activation if it exists;
- collector Cron count;
- whether an `API_FOOTBALL_API_KEY` secret binding is present.

## Mandatory 0004 stop gate

Migration `0005_api_football_shadow_runtime.sql` extends schema introduced by `0004_api_football_shadow_identity.sql`.

The approved live-storage checkpoint names 0005 and 0006. It does **not** silently authorize applying 0004.

Therefore:

- if the live ledger proves exact migration 0004 is already applied and its required identity tables exist, the preflight may report `READY_FOR_MIGRATION_0005`;
- if the live ledger stops at 0003, the preflight reports `STOP_0004_NOT_APPLIED`;
- if 0005 exists without 0004, 0006 exists without 0005, a migration name differs, or the expected schema objects are incomplete, the preflight fails closed for review.

No migration is applied by this preflight.

## Read-only Cloudflare boundary

The workflow is `.github/workflows/api-football-live-storage-preflight.yml`.

It is:

- manual `workflow_dispatch` only;
- accepted only from `refs/heads/main`;
- rejected on GitHub UI reruns via `github.run_attempt == 1`;
- checked out at the exact dispatch SHA;
- revalidated against remote current `main` after protected-environment admission and again immediately before Cloudflare reads;
- pinned to immutable action SHAs;
- executed under the existing `data-steward-readonly` environment;
- limited to one reviewed production account fingerprint.

The runtime adapter is `workers/api-football-collector/live-storage-preflight.mjs`.

It issues only five fixed Cloudflare GETs:

1. production D1 metadata;
2. `teamsheet-data-platform` settings;
3. API-Football collector settings;
4. API-Football collector schedules;
5. API-Football collector deployments.

It issues at most two D1 query API calls. Every D1 statement is from a closed repository registry and is either `SELECT` or `PRAGMA foreign_key_check`. Mutation keywords, statement separators and SQL comments are rejected before transport. The adapter additionally rejects any D1 result whose metadata reports a written row.

## Sanitized D1 evidence

The first fixed D1 batch reads:

- the ordered `schema_migrations` ledger;
- only API-Football-related `sqlite_master` object names;
- `PRAGMA foreign_key_check`;
- the latest completed Official FPL run;
- the 20 current Official FPL team-head provenance rows required to reconstruct the authority digest;
- the count of API-Football team mapping rows.

A second batch is constructed only from closed predeclared queries whose referenced tables were observed to exist. It may read counts/state for:

- `api_football_runtime_state`;
- `api_football_request_attempts`;
- `api_football_discovery_generations`;
- `api_football_discovery_heads`;
- `api_football_fixture_revisions`;
- `api_football_generation_fixtures`;
- `api_football_team_mapping_qualifications`;
- `api_football_team_mapping_heads`;
- `api_football_team_mapping_members`.

Private mapping pairs are never selected for output. Member verification exposes counts only: total, unique provider IDs and unique Official FPL IDs.

The sanitized artifact may contain qualification IDs, counts, migration names/timestamps, authority and qualification hashes, runtime flags and pass/fail state. It must not contain account credentials, secret values, raw Cloudflare responses, provider payloads or private mapping pairs.

## Unexpected live-state hard stops

The preflight stops the mutation sequence on any of the following evidence:

- production D1 identity mismatch;
- deployed data-platform binding mismatch;
- foreign-key violation;
- migration name/order/schema mismatch;
- 0005 without 0004;
- 0006 without 0005;
- invalid Official FPL authority;
- missing/invalid runtime row after 0005;
- `collection_enabled != 0`;
- disable reason other than `EIA_2I5D_REPOSITORY_ONLY`;
- an API-Football collector Worker unexpectedly existing;
- missing/mismatched collector D1 binding if that Worker exists;
- collector activation other than `REPOSITORY_ONLY_BLOCKED`;
- any collector Cron;
- any collector `API_FOOTBALL_API_KEY` secret binding.

The collector-existence/secret checks are intentionally stricter than merely verifying that execution is disabled. Canonical state says neither is live; unexpected presence must be reviewed before storage mutation.

## Evidence states

The preflight emits one next-action enum:

- `STOP_0004_NOT_APPLIED`
- `READY_FOR_MIGRATION_0005`
- `READY_FOR_MIGRATION_0006`
- `READY_FOR_PRIVATE_MAPPING_PERSISTENCE`
- `EXISTING_MAPPING_STATE_REQUIRES_RECONCILIATION`
- `STOP_REVIEW_REQUIRED`

These are preflight classifications only. None performs or authorizes its named mutation.

## After merge

Only after this repository candidate is merged and exact-main Verify passes should the owner dispatch the workflow once from current `main`.

The resulting sanitized evidence must be reviewed before any production mutation.

If the result is `STOP_0004_NOT_APPLIED`, the live-storage sequence stops and migration 0004 requires a separate owner decision. It must not be applied implicitly.

If the result admits 0005, a separate production-mutation implementation sequence still needs exact migration application/reconciliation controls, post-write verification and rollback handling before execution.

## Explicit exclusions

This checkpoint does not:

- apply migration 0004, 0005 or 0006;
- write the private 20/20 mapping;
- create/update/delete any D1 row;
- deploy or enable the API-Football collector;
- create/update/read an API-Football secret value;
- create/change Cron;
- activate `PRELIVE_PLANNER_ONLY`;
- call API-Football;
- perform fixture discovery or workload ingestion;
- alter expected minutes, projections, squad, transfers, captaincy, simulations, rank, Mini Leagues, rivals, strategy, recommendations, alerts or UI.

API-Football remains private, shadow-only and `owner_risk_accepted_private_use`. Official FPL remains authoritative for Premier League identity.
