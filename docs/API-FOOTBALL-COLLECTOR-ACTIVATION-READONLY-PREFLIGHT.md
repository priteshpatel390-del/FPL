## Attended-stage extension

Live preflight can now select `ATTENDED_ACCEPTANCE` and an exact reviewed Version ID. It reads binding metadata without secret values and requires zero Deployments, Cron, routes and custom domains, disabled workers.dev/Preview URLs, exact production D1 and pristine disabled runtime before admission. See [attended acceptance foundation](API-FOOTBALL-ATTENDED-ACCEPTANCE-FOUNDATION.md).

## Post-staging terminology correction — 21 September 2026

Live inactive staging run `35645387203` demonstrated that the preflight's historical `inventory.deployed` label actually meant only “collector Worker/script inventory is present”: the run had a present Worker and inactive Version while the dedicated postflight proved **Deployment count 0**. The sanitized live-preflight report contract therefore moves to `workerPresent` plus explicit `deploymentCount`. This is a semantics/evidence correction, not a live infrastructure change.

# API-Football Collector Activation Read-Only Preflight

## Approval and purpose

Pritesh approved the next collector-activation gate after PR #278: establish fresh production evidence for **repository/infrastructure staging admission only**.

This checkpoint prepares a new manual read-only workflow. It does not upload or deploy a Worker, bind production D1 to the collector, provision or inspect the API-Football key, mutate runtime state, create Cron, call API-Football, or change model/product/UI behaviour.

The historical `API-Football Live Storage Read-Only Preflight` remains unchanged. It is not reused as the activation classifier because it was intentionally designed to stop on mapping/collector state that is valid after Migration 0006.

## First live result and provenance remediation

Owner-attended run `35631979158`, attempt 1, executed on exact protected main `c4b67cd1709f4c14d53c79896468fa07c632e70a`. Repository admission passed and the protected preflight stopped safely as `STOP_REPOSITORY_INFRASTRUCTURE_STAGING_REVIEW_REQUIRED` with reason `qualified_mapping_unavailable`. Sanitized evidence proved migrations 0001–0006, zero FK violations, fresh exact-20 Official FPL authority, committed 20/20 mapping cardinality, disabled runtime, zero attempts/generations/fixture revisions, absent collector/Cron/API-key binding, zero model/UI imports, 38,703 D1 rows read, 0 production mutations, 0 API-Football requests and 0 secret-value reads. Artifact `10655490002` has SHA-256 `6f7ae4318a61def0ec447da9d7232b634fffbdc848f23f2f84ce31828e3b7ddb`.

Investigation proved the stop was a repository false negative. Migration 0006 stores an immutable authority-provenance hash derived from the qualification-time authority, while activation preflight v2 compared that stored historical value directly with the latest live authority digest. Those values are not required to be equal and may differ structurally or because Official FPL has refreshed since qualification.

The corrected v3 contract therefore keeps both protections but separates their purpose:
- historical mapping authority provenance must remain present, well-formed and immutable;
- latest Official FPL authority must independently be fresh and exact-20;
- the committed mapping must independently contain exactly the same 20 canonical FPL team IDs as the latest authority;
- private provider IDs and mapping pairs remain absent from reports and retained evidence.

Run `35631979158` is consumed and must not be rerun. A fresh read-only dispatch after this remediation is merged and exact-main verified remains a separate owner gate.

## Accepted corrected live result

Corrected owner-attended run `35634186433`, attempt 1, executed on exact protected main `d88312eb6263a3ef0e5de1be3e79b647a797b830` and completed **SUCCESS** with:

`READY_FOR_REPOSITORY_INFRASTRUCTURE_STAGING`

Accepted artifact:

- artifact: `10655278906`
- SHA-256: `5da299cc5b0bec4064ad7d839e40e05e2b2ad9dde41f7eed785534dfa9bb501b`

The run proved exact migrations 0001–0006, zero FK violations, fresh exact-20 Official FPL authority, committed 20/20 mapping cardinality, exact current canonical-team coverage, valid historical mapping provenance, disabled collection, credential `UNPROVISIONED`, no active lease, zero request attempts/generations/fixture revisions, absent collector Worker/Cron/API-key binding, zero model/UI imports and 38,703 D1 rows read. Production mutations, API-Football requests and secret-value reads were all zero.

The earlier STOP run `35631979158` remains consumed and must never be rerun.

This PASS closes repository/infrastructure-staging admission only. It does not authorize Worker creation, Version upload, D1 binding, Deployment, secret provisioning, runtime enablement, Cron or provider egress. The next design record is [API-Football Collector — Inactive Worker Version / Production D1 Binding Staging Proposal](API-FOOTBALL-COLLECTOR-INACTIVE-VERSION-STAGING.md).

## Exact admission target

The new workflow may return only the activation foundation's existing repository-stage classification:

`READY_FOR_REPOSITORY_INFRASTRUCTURE_STAGING`

That classification requires:

- exact migration ledger 0001–0006;
- zero D1 foreign-key violations;
- fresh <=48-hour Official FPL authority with exact 20-team current `present=true` shape;
- one current committed 20/20 API-Football mapping head with valid historical authority provenance;
- exactly 20 mapping members, 20 distinct provider IDs and 20 distinct FPL IDs;
- exact equality between the mapping's 20 canonical FPL team IDs and the latest fresh Official FPL authority team-ID set, without requiring historical provenance digest equality;
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

It excludes account IDs, database IDs, provider/FPL mapping pairs, canonical team-ID lists, qualification IDs, authority digests, secret values, API-Football responses and raw Cloudflare payloads. It may retain only booleans confirming current canonical coverage and historical provenance presence.

The permanent counters remain:

- production mutations: **0**;
- API-Football requests: **0**;
- secret values read: **0**.

## Next gate

A successful live `READY_FOR_REPOSITORY_INFRASTRUCTURE_STAGING` result would establish evidence for a later separately approved inactive collector Worker Version upload/binding preparation.

It would **not** authorize that upload, deployment, production binding, secret provisioning, runtime enablement, Cron or provider egress.

Any such mutation remains a new owner gate after review of the fresh read-only evidence.
