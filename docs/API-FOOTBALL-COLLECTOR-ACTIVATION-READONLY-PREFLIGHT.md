# API-Football Collector Activation Read-Only Preflight

## Approval and purpose

Pritesh approved the next collector-activation gate after PR #278: establish fresh production evidence for **repository/infrastructure staging admission only**.

This checkpoint prepares a new manual read-only workflow. It does not upload or deploy a Worker, bind production D1 to the collector, provision or inspect the API-Football key, mutate runtime state, create Cron, call API-Football, or change model/product/UI behaviour.

The historical `API-Football Live Storage Read-Only Preflight` remains unchanged. It is not reused as the activation classifier because it was intentionally designed to stop on mapping/collector state that is valid after Migration 0006.

## Exact admission target

The new workflow may return only the activation foundation's existing repository-stage classification:

`READY_FOR_REPOSITORY_INFRASTRUCTURE_STAGING`

That classification requires:

- exact migration ledger 0001–0006;
- zero D1 foreign-key violations;
- fresh <=48-hour Official FPL authority with exact 20-team current `present=true` shape;
- one current committed 20/20 API-Football mapping head;
- exactly 20 mapping members, 20 distinct provider IDs and 20 distinct FPL IDs;
- API-Football runtime collection disabled;
- credential state only `UNPROVISIONED` or `AVAILABLE`;
- no active request lease;
- no attempt-2 state, no reserved request attempt and no STAGING generation requiring reconciliation;
- bounded prior request/generation/revision counts;
- zero production model/UI imports;
- shipped collector Wrangler still `REPOSITORY_ONLY_BLOCKED`, empty-Cron, Workers.dev false, preview URLs false and all-zero placeholder D1 ID;
- live collector Worker absent at this repository/infrastructure-staging stage;
- no API-Football secret binding.

A STOP result is evidence, not permission to repair state.

## Read authority and bounded surface

The workflow uses the existing protected `data-steward-readonly` environment only after:

1. manual `workflow_dispatch`;
2. `run_attempt == 1`;
3. exact `refs/heads/main`;
4. exact-current-main verification before and after protected-environment admission;
5. exact-head successful `Tests and deterministic build`;
6. focused preflight tests before the Cloudflare read credential is introduced.

The live executable permits exactly five Cloudflare metadata/settings GETs and one D1 query POST containing ten fixed read-only statements. SQL is limited to `SELECT` and `PRAGMA foreign_key_check`; mutation keywords, semicolons and SQL comments are rejected before transport. Every returned D1 statement must report `rows_written == 0`.

The workflow references only:

- `DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID`;
- `DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT`;
- `DATA_STEWARD_CLOUDFLARE_READ_TOKEN`.

It never references `API_FOOTBALL_API_KEY`, the private crosswalk, deployment/upload credentials or a D1 write credential.

## Sanitized evidence

The seven-day artifact contains only bounded admission facts: classification, migration/FK counts, authority team count/fresh timestamp, mapping cardinalities, disabled runtime state, collector attempt/generation/revision counts, live collector presence/Cron/secret-binding booleans, repository config booleans, model/UI import count and aggregate D1 rows read.

It excludes account IDs, database IDs, provider/FPL mapping pairs, qualification IDs, secret values, API-Football responses and raw Cloudflare payloads.

The permanent counters remain:

- production mutations: **0**;
- API-Football requests: **0**;
- secret values read: **0**.

## Next gate

A successful live `READY_FOR_REPOSITORY_INFRASTRUCTURE_STAGING` result would establish evidence for a later separately approved inactive collector Worker Version upload/binding preparation.

It would **not** authorize that upload, deployment, production binding, secret provisioning, runtime enablement, Cron or provider egress.

Any such mutation remains a new owner gate after review of the fresh read-only evidence.
