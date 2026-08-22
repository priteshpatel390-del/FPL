# DATA-S1B — Live Cloudflare Deployment and Acceptance Plan

Status: **design only; separately owner-gated; no live action approved**
Predecessor: DATA-S1 repository foundation merged in PR #145 and repository-verified
Required predecessor checkpoint: DATA-S1A control reconciliation independently reviewed and merged

## Control boundary and sequence

DATA-S1B is the next checkpoint after DATA-S1A. It must safely deploy and accept the isolated DATA-S1 foundation before DATA-S2 is allowed to depend on it. The sequence is therefore:

`DATA-S1 (merged repository foundation) -> DATA-S1A (current control reconciliation) -> DATA-S1B (future live preflight/deployment/acceptance) -> DATA-S2 (Official FPL structured history) -> DATA-S3 (Official outcomes automation) -> DATA-S4 (provider trials/evaluation) -> DATA-S5 (downstream Sheets automation)`.

Every arrow is a separate owner gate. This record authorises no Cloudflare mutation, deployment, provider acquisition, DATA-S2 work, production/model read path or browser integration.

## Mandatory mutation-free preflight

Before any live mutation, record all of the following without exposing credentials or account identifiers in public evidence:

1. valid Cloudflare authentication and exact account identity;
2. read-only Worker and D1 inventories;
3. read-only DNS, Custom Domain, route, Access application and policy inventories;
4. read-only Workers Builds/Git-integration inventory;
5. current account limits, usage, plan availability and expected cost;
6. collision-free confirmation for every proposed name, hostname, binding and route;
7. exact current GitHub `main` SHA and a green Verify Teamsheet run on that exact SHA;
8. an already-installed, owner-approved Wrangler executable and its exact version; and
9. an explicit demonstration that resource auto-provisioning is controlled before dry-run or deploy.

No registry-fetched “latest Wrangler” invocation, implicit download or registry-dependent production command is acceptable. This DATA-S1A environment has **no installed `wrangler` executable**, so an approved installation/version is a hard DATA-S1B prerequisite; DATA-S1A does not install one.

## Fixed live architecture and security contract

- Worker: `teamsheet-data-platform`; D1: `teamsheet-data`; binding: `TEAMSHEET_DATA_DB`; migrations directory: `migrations`.
- D1-only and `shadow_only`: no R2, provider, cron, browser, CORS, production/model read, Provider Health, Google Sheets or evidence-archive coupling.
- Keep `workers_dev: false` and `preview_urls: false` and verify the deployed routes after deployment.
- Use the Custom Domain `data.fpltsheet.co.uk`; do not create an additional route or public hostname.
- Protect the single Worker with Worker-level Cloudflare Access set to **All traffic**. Current first-party Cloudflare guidance says this covers that Worker's routes, Custom Domains, `workers.dev` hostname and previews. Configure exactly one **Service Auth** policy with **Include: dedicated DATA-S1 Service Token**. Do not configure a human-identity Allow policy, Bypass policy, public health exception, shared evidence-archive token or permanent browser credential. `/v1/health` and all other Worker traffic remain protected. The documented Worker-level WebSocket limitation is irrelevant because DATA-S1 has no WebSocket path.
- No public bypass and no CORS headers. Access and route behaviour require live negative as well as positive verification.

No rate-limit rule is required for the first deployment. Access service-token enforcement, bounded requests/pages and D1 constraints already address the accepted initial service boundary. Copying the evidence archive's approximate request rate would have no DATA-S1 evidence basis and could add plan/cost and false-denial risk. Reconsider a rule only after measured traffic or abuse evidence identifies its purpose, key/actor, threshold, failure response, cost and account-plan availability.

## Deterministic D1 provisioning

Wrangler now documents automatic provisioning when a deploy-time binding omits a resource ID, including D1 creation and configuration write-back. Therefore the repository's ID-free design config must never be used for production deployment.

1. Reconfirm that neither `teamsheet-data` nor a colliding binding exists.
2. With separate owner approval, explicitly create exactly one production `teamsheet-data` D1 and capture its returned UUID.
3. Create an owner-controlled, reviewed production Wrangler overlay/config derived from the repository config. It must contain `binding: "TEAMSHEET_DATA_DB"`, `database_name: "teamsheet-data"`, the exact captured `database_id`, and `migrations_dir: "migrations"`.
4. Re-run inventory and prove that exactly one matching D1 exists and the reviewed config resolves to its UUID. Preserve the pre/post D1 inventories. A missing or mismatched UUID is a hard stop.
5. Before any production-capable dry-run, deploy or resource-binding operation, verify the exact provisioning-control syntax of the already-installed, owner-approved, pinned Wrangler version. Automatic resource provisioning is active in current Wrangler when deploy-time bindings omit resource IDs. Use the pinned Wrangler version with automatic provisioning explicitly disabled using its documented negative provisioning flag (currently `--no-x-provision`, subject to exact-version verification immediately before execution). The exact captured `database_id` and pre/post D1 inventories are additional mandatory controls, not substitutes for disabling provisioning. Missing exact UUID, unsupported provisioning-control behaviour, or inability to disable provisioning is a hard stop. No interactive resource-creation prompt may be accepted or answered affirmatively.
6. Dry-run the Worker deployment without mutation and archive sanitized resolved-binding evidence.
7. Apply migration 0001 with D1 migrations tooling, then verify the migration record and exact tables, indexes, foreign keys and checks.
8. Deploy the Worker, create the Custom Domain and Worker-level Access only within the approved runbook order, then verify the exact binding, deployment SHA/version, domains/routes, Access coverage and absence of public endpoints.
9. Re-run D1 inventory after every command capable of deployment and prove no second D1 was silently created.

**Database-ID decision:** use option **B**, an owner-controlled production deployment config, rather than committing an account-specific UUID to the repository's portable design config. The UUID is not secret, but the overlay makes the owner-reviewed account binding an explicit deployment input, avoids pretending repository configuration is live state, and preserves reusable repository tests. The sanitized deployment closeout must record a hash of the reviewed config and the exact non-secret UUID; committing it later requires a separate infrastructure-as-code ownership decision.

## One disposable D1 validation database

DATA-S1B requires separate approval to create one unmistakably named disposable validation D1 before production. Apply the unchanged migration 0001 with real D1 migrations tooling and verify the exact schema, indexes and foreign-key state; valid seed insertion; invalid `CHECK` insertion failure; invalid simple and composite foreign-key insertion failure; idempotency-index enforcement; accepted-only replay; and real Worker binding behaviour. POST the fixture below once for `inserted`, repeat it byte-for-byte for `existing`, then change `value_boolean` while retaining the same idempotency tuple for `idempotency_conflict`.

Do not create a broken migration. Cloudflare documents D1 foreign keys as enforced within migrations/implicit transactions and documents batch rollback on statement failure; the acceptance evidence needed here is the real unchanged migration and its actual constraints, not a manufactured destructive failure. Delete the disposable database only after evidence is captured and under the same approved checkpoint.

## Exact synthetic acceptance fixture

At execution time replace `{{ACTUAL_FETCHED_AT_UTC}}` and `{{ACTUAL_CREATED_AT_UTC}}` with the truthful current UTC instants from the controlled 2026 acceptance run. They must not be `2099` timestamps. The `2099-00` namespace is only a permanent collision-resistant synthetic identity boundary.

```sql
INSERT INTO data_sources (source_id,source_key,source_name,source_kind,created_at)
VALUES ('source:synthetic-acceptance','synthetic-acceptance','DATA-S1 synthetic acceptance','synthetic_internal','{{ACTUAL_CREATED_AT_UTC}}');
INSERT INTO data_source_revisions (source_revision_id,source_id,revision,schema_version,rights_classification,retention_allowed,redistribution_allowed,attribution_required,attribution_text,terms_reference,terms_reviewed_at,acquisition_status,shadow_ingest_allowed,supersedes_revision_id,created_at)
VALUES ('source-revision:synthetic-acceptance:1','source:synthetic-acceptance',1,'1','durable_allowed',1,0,0,NULL,'internal synthetic acceptance fixture','{{ACTUAL_CREATED_AT_UTC}}','synthetic_only',1,NULL,'{{ACTUAL_CREATED_AT_UTC}}');
INSERT INTO canonical_entities (canonical_entity_id,entity_type,season,canonical_system,canonical_external_id,created_at)
VALUES ('2099-00:synthetic:player:acceptance-1','player','2099-00','synthetic_acceptance','acceptance-1','{{ACTUAL_CREATED_AT_UTC}}');
INSERT INTO entity_mappings (mapping_id,source_revision_id,provider_entity_type,provider_entity_id,canonical_entity_id,mapping_method,mapping_status,valid_from,valid_to,verified_at,mapping_version,supersedes_mapping_id,created_at)
VALUES ('mapping:synthetic-acceptance:player:1','source-revision:synthetic-acceptance:1','player','synthetic-player-acceptance-1','2099-00:synthetic:player:acceptance-1','manually_verified','verified',NULL,NULL,'{{ACTUAL_CREATED_AT_UTC}}',1,NULL,'{{ACTUAL_CREATED_AT_UTC}}');
INSERT INTO ingestion_runs (run_id,source_revision_id,run_type,mode,started_at,completed_at,status,safe_endpoint_class,parser_version,transform_version,schema_version,records_seen,records_accepted,records_quarantined,records_rejected,error_class,created_at)
VALUES ('run:synthetic-acceptance:1','source-revision:synthetic-acceptance:1','acceptance','shadow_only','{{ACTUAL_CREATED_AT_UTC}}',NULL,'running','synthetic_internal','acceptance-1','acceptance-1','1',1,0,0,0,NULL,'{{ACTUAL_CREATED_AT_UTC}}');
```

```json
{
  "logical_key": "synthetic_acceptance:player:acceptance-1:available",
  "ingestion_run_id": "run:synthetic-acceptance:1",
  "source_revision_id": "source-revision:synthetic-acceptance:1",
  "category": "availability",
  "subject_type": "player",
  "subject_entity_id": "2099-00:synthetic:player:acceptance-1",
  "subject_mapping_id": "mapping:synthetic-acceptance:player:1",
  "provenance_kind": "mapped_provider",
  "metric": "synthetic_available",
  "value_type": "boolean",
  "value_boolean": true,
  "observed_at": "2099-01-01T00:00:00.000Z",
  "effective_at": "2099-01-01T00:00:00.000Z",
  "fetched_at": "{{ACTUAL_FETCHED_AT_UTC}}",
  "transform_version": "acceptance-1",
  "validation_version": "acceptance-1",
  "input_revision": "synthetic-acceptance-r1",
  "admission_state": "accepted",
  "quality_state": "fresh",
  "mode": "shadow_only"
}
```

The fixture is provider-neutral and contains no football, personal, account, manager, league, Official FPL, Understat, Odds, secret or credential material. Replay acceptance must prove it appears at/after its truthful `fetched_at`, is absent before that instant, and excludes a separately inserted quarantined synthetic row.

## Stop conditions and closeout evidence

Stop before mutation on missing credentials, uncertain account, collision, non-green exact-main, unavailable/unapproved Wrangler, unresolved auto-provision behaviour, unsupported plan/cost, or inability to guarantee all-traffic Access. Stop after mutation on an unexpected resource, public route, binding mismatch, schema mismatch or acceptance failure. Rollback/deletion requires an approved, resource-specific action; do not improvise.

DATA-S1B closes only with sanitized before/after inventories, exact commands and tool version, D1 UUID/config hash, migration/schema evidence, Worker version/SHA and binding evidence, Access positive and unauthenticated negative checks, domain/route checks, synthetic insert/duplicate/conflict/replay evidence, usage/cost evidence and explicit owner acceptance. It still authorises no DATA-S2 acquisition, provider or production/model path.
