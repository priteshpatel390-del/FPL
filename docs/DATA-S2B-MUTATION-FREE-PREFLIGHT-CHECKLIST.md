# DATA-S2B — Mutation-Free Preflight Checklist

Status: **read-only investigation checklist; no mutation authorised**

Use this checklist against the live Cloudflare account before requesting approval for DATA-S2B mutation.

## Repository

- [ ] Confirm latest `main` SHA.
- [ ] Confirm exact `main` Verify Teamsheet run is green.
- [ ] Confirm deployment source checkout is exactly that SHA and clean.
- [ ] Recheck current first-party Cloudflare Workers/D1 limits and pricing.

## Worker — `teamsheet-data-platform`

- [ ] Record current deployed version ID and deployment ID.
- [ ] Record deployment time/source.
- [ ] Record current bindings; confirm `TEAMSHEET_DATA_DB` targets `teamsheet-data`.
- [ ] Record current custom-domain/route state.
- [ ] Record current relevant vars/secrets without exposing secret values.
- [ ] Record current Cron Trigger set.
- [ ] Confirm no unexplained DATA-S2 Cron is active.
- [ ] Record current Worker error/outcome baseline.
- [ ] Record CPU-time baseline.
- [ ] Record account Workers plan and current Cron count.

## D1 — `teamsheet-data`

- [ ] List remote pending/applied migrations.
- [ ] Read `schema_migrations`.
- [ ] Confirm DATA-S1 schema required by DATA-S2A exists and is compatible.
- [ ] Check whether `source-official-fpl` exists.
- [ ] Check whether `official-fpl-r1` exists.
- [ ] Count `data_sources`.
- [ ] Count `data_source_revisions`.
- [ ] Count `ingestion_runs`.
- [ ] Count `shadow_observations`.
- [ ] Count `observation_heads`.
- [ ] Count `canonical_entities`.
- [ ] Count any existing rows attributable to `official-fpl-r1`.
- [ ] Record current database size.
- [ ] Record recent rows read/written and query activity.

## Stop conditions

Stop before mutation if any of the following is observed:

- unexpected Worker version/config/binding drift;
- unexpected active Cron;
- migration 0001 absent/incompatible;
- migration 0002 partly/fully applied without recorded approval;
- conflicting `official-fpl` or `official-fpl-r1` governance rows;
- unexplained Official FPL shadow observations/heads already present;
- current Free limits materially below the accepted design assumptions;
- inability to identify a safe previous Worker deployment for rollback.

## Evidence to present for owner approval

Before live mutation, report:

1. exact repository SHA;
2. exact current Worker version/deployment;
3. exact current binding/domain/Cron state;
4. exact pending migration state;
5. exact D1 governance and row counts;
6. current D1 usage/storage baseline;
7. current Worker CPU/error baseline;
8. current first-party Free limits;
9. exact planned mutation sequence;
10. exact rollback/stop sequence.

Do not apply migrations, upload/deploy a version or change triggers during this checklist.