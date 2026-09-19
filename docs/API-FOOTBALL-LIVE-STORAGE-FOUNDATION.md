# API-Football Live Storage Foundation — Read-Only Preflight

Date: 19 September 2026  
Status: **first live read completed; owner-approved read-only authority-remediation candidate only**. No production mutation is authorized by this document.

## Outcome

PR #260 merged the manual-only, exact-current-main, read-only preflight to protected `main` as `d71be7f95b31093d167ce8e33ad3e3fb41785650`. Owner-attended run `35426768910` then completed both jobs successfully under the existing `data-steward-readonly` environment, with zero production mutations and zero API-Football requests.

That first live read directly proved the reviewed production D1 identity and deployed data-platform binding match, the migration ledger is exactly 0001–0003, migrations 0004/0005/0006 are absent, foreign-key violations are zero, and the API-Football collector Worker/deployments/Cron/API-key secret binding are absent. It also exposed one repository validation defect: the Official FPL authority query selected every current team metric while the validator required exactly 20 rows. Canonical DATA-S2A stores ten team metrics per club, so the run's `official_fpl_authority_invalid` hard stop does not establish bad Official FPL data.

The owner-approved remediation remains read-only and repository-only: select only active `present=true` team heads, require exactly the canonical 20 `official-fpl|2026-27|team|<id>|present` logical keys, and add regression coverage for the real multi-metric DATA-S2A shape. No migration, D1 write, deployment, secret change, Cron change or API-Football request is authorized.

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

## First live preflight evidence

Run `35426768910`, dispatched by the owner on 19 September 2026 from exact protected main `d71be7f95b31093d167ce8e33ad3e3fb41785650`, established the following sanitized live state:

- production D1 identity: match;
- deployed data-platform D1 binding: match;
- migration ledger: 0001 `shadow_data_foundation`, 0002 `official_fpl_structured_history`, 0003 `production_query_plan_indexes`;
- migration 0004: not applied;
- migration 0005: not applied;
- migration 0006: not applied;
- foreign-key violations: 0;
- API-Football mapping rows: 0;
- API-Football runtime row: absent;
- API-Football request attempts: 0;
- API-Football collector Worker: absent;
- collector deployments: 0;
- collector Cron count: 0;
- collector `API_FOOTBALL_API_KEY` secret binding: absent;
- production mutations: 0;
- API-Football requests: 0.

The latest completed Official FPL run observed by the preflight was at `2026-09-19T01:18:00Z`, around five hours before the live preflight and therefore inside the repository's 48-hour authority freshness ceiling. The run nevertheless reported authority invalid because its query returned the full multi-metric team-head set. That classification is a validator defect under remediation, not evidence that Official FPL itself was stale or malformed.

## Mandatory 0004 stop gate

Migration `0005_api_football_shadow_runtime.sql` extends schema introduced by `0004_api_football_shadow_identity.sql`.

The approved live-storage checkpoint names 0005 and 0006. It does **not** silently authorize applying 0004.

Therefore:

- if the live ledger proves exact migration 0004 is already applied and its required rights columns, source-consistency triggers, participation index and identity tables exist, the preflight may report `READY_FOR_MIGRATION_0005`;
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

It issues at most two D1 query API calls. Every D1 statement is from a closed repository registry and is either `SELECT` or one of the fixed read-only PRAGMAs (`foreign_key_check` / `table_info`). Mutation keywords, statement separators and SQL comments are rejected before transport. The adapter additionally rejects any D1 result whose metadata reports a written row.

## Sanitized D1 evidence

The first fixed D1 batch reads:

- the ordered `schema_migrations` ledger;
- only API-Football-related `sqlite_master` object names;
- `PRAGMA foreign_key_check`;
- fixed `PRAGMA table_info` reads for migration-0004 rights/provenance columns and the participation table extended by migration 0005;
- the latest completed Official FPL run;
- the 20 current Official FPL team-head provenance rows required to reconstruct the authority digest;
- the count of API-Football team mapping rows.

A second batch is constructed only from closed predeclared queries whose referenced tables were observed to exist. It may read counts/state plus fixed `PRAGMA table_info` structure for the runtime and mapping tables:

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
- invalid or stale Official FPL authority;
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
