# API-Football Migration 0004 Production Application Foundation

Status: **repository candidate only — draft PR #262. Migration 0004 is not applied to production.**

Baseline reviewed from protected `main`:

- source commit: `22c58f87571393422f38f24615eae1b8cc01da32`;
- exact-main Verify Teamsheet run: `35427541775` — SUCCESS, 2,203/2,203 tests, production build PASS, exact-identity rebuilds byte-identical;
- attended read-only live-storage preflight: `35427688308` — SUCCESS, `STOP_0004_NOT_APPLIED`, zero hard stops, zero production mutations, zero API-Football requests;
- live ledger: exactly 0001 `shadow_data_foundation`, 0002 `official_fpl_structured_history`, 0003 `production_query_plan_indexes`;
- migrations 0004/0005/0006 absent;
- foreign-key violations 0;
- API-Football mapping/runtime/request/discovery/fixture/mapping-qualification state empty;
- API-Football collector Worker absent;
- Official FPL authority valid/fresh with exactly 20 canonical present-team heads.

This document describes a **future application boundary**. Nothing in this checkpoint authorizes dispatching it.

## Scope

The only mutation this foundation can ever submit is the repository-owned file:

`workers/data-platform/migrations/0004_api_football_shadow_identity.sql`

The migration is pinned by Git blob SHA:

`293cb9a0f3cb797c3df162336f3d427ce49f7db5`

The runner additionally requires the reviewed 40-statement shape, including the two trigger bodies. There is no workflow or runtime input for a migration path, SQL text, table, version, provider mapping, source revision, credential, endpoint or model setting.

Migration 0004:

- keeps foreign-key enforcement active and uses `PRAGMA defer_foreign_keys = ON`;
- adds ledger version 4 `api_football_shadow_identity`;
- rebuilds the connected shadow graph and copies its existing rows;
- extends `data_source_revisions` only with the narrow owner-risk/private-use provenance fields;
- recreates the five current production indexes;
- creates the two owner-risk source-consistency triggers;
- creates provider fixture identity and participation-history tables/index.

It does **not** activate collection and does not create migration-0005/0006 runtime or mapping-qualification state.

## Production write serialization

The workflow uses the existing GitHub Actions concurrency group:

`data-s2-production-collection`

That group already serializes the attended collection, external collection, resume and prior migration paths. The current automatic 01:17 UTC production clock is the isolated Cloudflare `teamsheet-data-s2-dispatcher`; it does not write D1 directly. It dispatches `data-s2-production-external.yml`, whose actual D1 writer is in the same concurrency group.

There is one important bypass risk: the historical `teamsheet-data-platform` Worker still has a repository configuration declaring a 30-minute Cron even though canonical production evidence records that live trigger as deliberately removed. The migration-specific preflight therefore reads that Worker's live schedules and requires **zero Cron triggers**. A restored legacy trigger is a hard stop because it could write D1 outside the GitHub lock.

## Pre-write admission

A future dispatch is manual-only, attempt 1 only and accepts only `approved_sha`.

Before any write credential is introduced, the workflow requires:

1. exact repository `priteshpatel390-del/FPL`;
2. `refs/heads/main`;
3. the approved SHA equals checked-out HEAD;
4. remote protected `main` still equals the approved SHA;
5. an exact-head successful `Tests and deterministic build` check;
6. focused migration-0004 foundation tests.

The separate `data-steward-readonly` job then reruns the existing API-Football live-storage preflight and requires:

- exact production D1 identity and deployed binding;
- exact ledger 0001-0003 with 0004/0005/0006 absent;
- zero foreign-key violations;
- fresh valid 20-team Official FPL authority;
- zero API-Football mapping rows;
- no runtime/request/discovery/fixture/mapping-qualification state;
- no API-Football collector/deployment/Cron/API-key binding;
- no hard stops;
- final `STOP_0004_NOT_APPLIED`;
- historical `teamsheet-data-platform` Cron count exactly 0.

This job is mutation-free.

## Exact application

Only after read-only admission does the protected `data-s2-production-collection` job receive the existing D1 write credential.

Immediately before the runner, remote `main` is resolved again and must still equal the approved SHA.

The runner independently rechecks D1 rather than trusting the earlier job. The exact pre-state requires:

- the prior ledger is exactly 0001-0003;
- the five production indexes exist on their expected tables;
- no 0004 objects or rights columns exist;
- no known 0005/0006 objects exist;
- `PRAGMA foreign_key_check` returns zero rows;
- no `ingestion_runs.status='started'` row exists;
- API-Football `entity_mappings` rows are zero;
- protected counts/integrity facts are readable;
- the latest Official FPL authority is fresh and contains exactly the 20 canonical `present=true` team heads.

The runner then obtains the current D1 Time Travel bookmark. The raw bookmark is kept only in process memory; output retains only its SHA-256 digest plus a checkpoint timestamp.

Exactly one D1 mutation request may then be made. It contains exactly the 40 pinned statements in one D1 batch. Cloudflare documents D1 batch statements as transactional: if one statement fails, the sequence aborts and rolls back.

## Post-write acceptance

Whether the mutation response is definite or transport-ambiguous, the runner performs a fresh reconciliation.

Successful acceptance requires:

- ledger exactly 0001-0004 and version 4 has the expected name;
- all nine owner-risk rights/provenance columns exist;
- both expected source-consistency triggers exist;
- `provider_fixture_identities`, `provider_participation_revisions` and `provider_participation_history` exist on the expected tables;
- the five existing production indexes still exist;
- no known migration-0005/0006 objects exist;
- every protected existing table population count is unchanged;
- accepted logical-key count is unchanged;
- orphan/invalid head counts remain zero;
- no active started run appears;
- foreign-key violations remain zero;
- API-Football mapping rows remain zero;
- both new provider tables remain empty;
- the exact Official FPL authority snapshot is unchanged.

A successful state captures a new current Time Travel bookmark digest.

The final read-only job then reruns the existing live-storage preflight contract. A successful application must produce `READY_FOR_MIGRATION_0005`; a failed application that restored or never committed may produce `STOP_0004_NOT_APPLIED`. Any other state is a stop.

## Recovery design

Primary recovery is Cloudflare D1 Time Travel.

Cloudflare currently documents that Time Travel:

- is always enabled for D1 databases on the production storage backend;
- can retrieve the current bookmark or the nearest bookmark at/before a timestamp;
- restores the database **in place as a whole database**;
- retains point-in-time history for 7 days on Workers Free and 30 days on Workers Paid;
- returns a previous bookmark on restore so the restore itself can be reversed if necessary.

References:

- https://developers.cloudflare.com/d1/reference/time-travel/
- https://developers.cloudflare.com/api/resources/d1/subresources/database/subresources/time_travel/methods/get_bookmark/
- https://developers.cloudflare.com/api/resources/d1/subresources/database/subresources/time_travel/methods/restore/
- https://developers.cloudflare.com/d1/platform/limits/

The live application does not assume Time Travel merely from documentation. **The write is blocked unless the production database successfully returns a current bookmark immediately before mutation.** That is the execution-time capability check.

Because a Time Travel restore overwrites the complete database, it is never treated as a harmless table-level rollback. It is safe to automate only while the production writer concurrency lock is still held and the legacy direct Worker Cron has been proved absent.

If exact post-write acceptance fails after the mutation was issued, the runner:

1. issues no second migration attempt;
2. makes at most one restore request to the exact raw pre-mutation bookmark held in memory and never retries it, even if the restore response is lost;
3. performs a fresh exact-pre reconciliation regardless of whether the restore response was received;
4. requires zero FK violations, identical protected counts and identical Official FPL authority.

If that proof succeeds, the run is classified `RECOVERED_TO_EXACT_PRESTATE` and still fails operationally so owner review is mandatory. Migration 0004 is then unapplied.

If either restore or the recovery reconciliation cannot be proved, the classification is `AMBIGUOUS_REQUIRES_OWNER_ATTENTION`. No retry is permitted in that run. The artifact retains the checkpoint timestamp and pre-bookmark digest but not the raw bookmark. Before any later manual Time Travel recovery, an operator must resolve the bookmark at/before that timestamp and require its digest to match the recorded digest. A mismatched digest is a hard stop because whole-database recovery could otherwise erase unrelated writes.

### Recovery limitation

The repository cannot prevent a separately privileged human or an unreviewed out-of-band D1 writer from changing the database after an ambiguous workflow ends. Therefore a later recovery after the workflow lock is released is not automatically safe. It requires a fresh owner-attended read-only reconciliation and proof that the recovery target still corresponds to the recorded checkpoint. If that cannot be established, do not restore.

## Security and product boundary

This foundation preserves:

- Official FPL as authoritative Premier League source;
- API-Football `owner_risk_accepted_private_use`;
- private one-user non-commercial normalized research only;
- no raw provider payload retention;
- no public/commercial use;
- stop-on-objection;
- no API-Football credential access or provider request;
- the earlier GitHub `eia-api-football-qualification` key was an attended qualification-only boundary, not a production-runtime precedent; any future collector credential remains restricted by canonical security policy to Cloudflare Worker secret `API_FOOTBALL_API_KEY`;
- no private 20/20 crosswalk or receipt exposure;
- no client-side secret;
- no collector deployment or Cron change.

Migration 0004 has no path into pStart, pAppear, p60, expected minutes, projected points, captaincy, squad, transfers, simulations, rank, Mini Leagues, rivals, strategy, recommendations, alerts, Provider Health or visible UI.

## Explicit stop after 0004

A later successful application of migration 0004 authorizes nothing beyond migration 0004. Migration 0005, migration 0006, private mapping persistence, API-Football runtime activation and provider collection remain separate owner gates.
