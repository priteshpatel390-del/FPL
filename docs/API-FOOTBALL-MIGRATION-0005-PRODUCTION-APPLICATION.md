## First attended dispatch — failed safely before production; remediation candidate

Owner-approved run `35496920942` executed on exact protected main `985cd1427dfa358c45be0e0dc54f1c746f16648d`. Dispatch identity, exact-main proof, exact-head Verify and all 27 focused migration tests passed. The repository-gate then failed `test -z "$(git status --porcelain)"`, so GitHub skipped the read-only production preflight, migration0005 mutation and postflight. Migration 0005 remains unapplied; the run made no production mutation and no API-Football request.

The failed workflow did not print the dirty path. The exact generated artefact is therefore unknown and must not be invented from inference. The approved narrow remediation isolates the local Wrangler/D1 migration harness in its own OS temp directory, resolves repository migration files to absolute paths, and adds regression coverage proving the harness leaves the checkout's git status unchanged. The workflow cleanliness guard is preserved. Candidate Verify Teamsheet run `35497159414` on head `158da28c0884c48f72931d798da389dc924611c7` passed 2,225/2,225 tests with byte-identical exact-identity production builds and exact manifest identity, including the new no-checkout-delta regression. After merge and exact-main verification, any new migration-0005 production application still requires a fresh explicit owner approval and a new manual dispatch; GitHub rerun of the failed run remains prohibited.

# API-Football Migration 0005 Production Application Foundation

Date: 20 September 2026  
Status: **repository implementation candidate only. Migration 0005 remains unapplied to production.**

## Outcome

This checkpoint adds a dormant, manual-only production application foundation for exactly `workers/data-platform/migrations/0005_api_football_shadow_runtime.sql`. It does not apply the migration. A future production dispatch remains a separate explicit owner gate after merge, exact-main verification and a fresh read-only production admission.

The foundation preserves the storage/runtime separation established by EIA-2I5D. Applying migration 0005 later would create only dormant API-Football runtime/provenance schema plus one disabled runtime row. It would not persist the private 20/20 team crosswalk, apply migration 0006, deploy or bind the collector Worker, provision `API_FOOTBALL_API_KEY`, create a Cron, make a provider request or affect any model/calculation/product path.

Baseline for this candidate is protected `main` `094409e5dd31ca71bef8ff4905d7dbd8ba9fba07`. Exact-main Verify Teamsheet run `35468057507` passed 2,214/2,214 tests with two byte-identical exact-identity production builds and build-input hash `7cafd62d767c0b98b919b505ec4ec4b48d69ad028b3b3f0e635fe516d235cbbc`; Pages run `35468056858` succeeded. The 20 September 01:17 UTC external Official FPL collection run `35481020246` also completed successfully, but that workflow success is not a substitute for the fresh migration-specific production preflight required before any later 0005 mutation.

## Exact migration identity

The only executable migration is:

- path: `workers/data-platform/migrations/0005_api_football_shadow_runtime.sql`;
- Git blob: `a65c57924a5e18ad8e72e491c376fe0f1c149e88`;
- UTF-8 bytes: 9,923;
- ledger version/name: `5 / api_football_shadow_runtime`;
- top-level statements: 20;
- trigger statements: 7.

The dedicated parser is quote-aware and trigger-aware because trigger `BEGIN ... END` bodies contain internal semicolons. No workflow input can supply SQL, path, version, table or migration name.

## Exact pre-state

Mutation is admitted only after the existing live-storage preflight reports `READY_FOR_MIGRATION_0005`, plus migration-specific checks that require:

- exact current protected main and successful exact-head Verify Teamsheet;
- exact migration ledger 0001 through 0004 and no 0005/0006;
- exact migration-0004 identity/rights objects and no migration-0005/later objects;
- `provider_participation_revisions.ingestion_run_id` absent;
- zero foreign-key violations and zero started ingestion runs;
- no API-Football data-source/revision seed already present;
- zero API-Football mappings, provider fixture identities and participation revisions;
- current valid/fresh Official FPL authority;
- API-Football collector Worker/deployment/Cron/API-key binding absent;
- historical direct `teamsheet-data-platform` Cron count exactly zero;
- conservative account-wide D1 daily write admission.

The daily write guard performs one fixed Cloudflare GraphQL analytics read for current-UTC-day D1 `rowsWritten` across the account and refuses mutation above 50,000 rows written. The Free-plan daily write limit is 100,000, so this reserves 50,000 rows of headroom before the migration is even reachable. Cloudflare's GraphQL Analytics API requires Account Analytics Read, so the workflow deliberately uses a separate future secret `DATA_STEWARD_CLOUDFLARE_ANALYTICS_TOKEN` rather than widening or reusing the existing Workers/D1 read token. This PR does **not** provision that token; absence fails closed and provisioning remains part of a later owner-approved execution prerequisite. Analytics is defence in depth, not a claim of zero-latency billing telemetry: any future attended dispatch must also recheck the Cloudflare dashboard immediately before approval.

## Execution and recovery

The write job shares `data-s2-production-collection` with Official FPL production writers and uses `cancel-in-progress: false`. The historical direct data-platform Worker Cron must remain absent, so no reviewed production writer can overlap the migration.

The runner:

1. independently reconciles the exact pre-state;
2. retrieves a D1 Time Travel bookmark and retains only its SHA-256 digest plus checkpoint time;
3. submits exactly one 20-statement transactional D1 batch;
4. never retries the mutation;
5. performs a common-schema reconciliation that can distinguish exact unchanged 0004 from exact 0005 without assuming newly-created tables exist;
6. only after exact 0005 schema is established reads the runtime/new-table postconditions;
7. optionally records a post-state bookmark digest.

Unlike migration 0004, this runner contains **no automatic Time Travel restore**. Migration 0005 is additive and one-shot; a partial or contradictory state after a transactional batch is owner-attention evidence rather than authority to overwrite the whole database automatically. The pre-mutation bookmark is retained for a separately attended recovery decision only. Production restore capability remains unexercised.

Accepted classifications are:

- `DEFINITELY_APPLIED_SUCCESSFULLY`;
- `DEFINITELY_ALREADY_APPLIED`;
- `DEFINITELY_NOT_APPLIED` when an uncertain mutation is reconciled to the exact original pre-state;
- `DEFINITELY_APPLIED_RESOURCE_REVIEW_REQUIRED` when exact 0005 is proven but observed migration-run D1 accounting exceeds its dedicated ceiling;
- `AMBIGUOUS_REQUIRES_OWNER_ATTENTION` for every other post-mutation state.

## Exact post-state

A successful application must prove all of the following:

- ledger exactly 0001 through 0005; migration 0006 absent;
- one exact API-Football data-source seed and one exact EIA-2I5A revision with the approved private-use rights fields;
- all 15 migration-0005 schema objects present on the reviewed tables;
- `provider_participation_revisions.ingestion_run_id` present;
- one runtime row with `collection_enabled=0`, disable reason `EIA_2I5D_REPOSITORY_ONLY`, credential `UNPROVISIONED`, quota `UNOBSERVED`, daily count zero and no lease/request timestamps;
- zero request attempts, discovery generations/heads, fixture revisions and generation membership;
- zero API-Football mappings, provider fixture identities and participation revisions;
- zero foreign-key violations;
- existing Official FPL/history populations unchanged except exactly one new data source, one new source revision and one new migration-ledger row;
- exact Official FPL authority unchanged across the mutation.

The application runner observes its own returned D1 accounting and uses a migration-specific ceiling of 1,000,000 rows read and 10,000 rows written. These are fail-closed operational bounds, not a claim that the migration is expected to consume those amounts.

## Security and activation boundary

The workflow never receives `API_FOOTBALL_API_KEY` and contains no API-Football host/request path. It changes no Worker, binding, route, Cron or secret. The shipped collector remains `REPOSITORY_ONLY_BLOCKED`, has no Cron, uses the inert all-zero D1 identifier and still exits before D1/credential access under its checked-in activation value.

Migration 0006 and private mapping persistence remain separate. The earlier GitHub `eia-api-football-qualification` secret was temporary attended qualification infrastructure and is not reused here.

## Tests

Permanent coverage pins migration bytes/blob/20-statement/7-trigger shape, exact pre/post schema classification, history/FK preservation, exact disabled runtime state, one-shot unknown-transport reconciliation, no automatic restore path, daily D1 write-headroom admission, historical direct-Cron hard stop, shared writer serialization, exact-main/CI gates, immutable action SHAs, sanitized evidence and complete credential/provider isolation.

The existing local D1 migration test remains authoritative for applying 0001-0006 against a populated local D1 and enforcing runtime/mapping constraints. Full `./run-tests.sh`, production build and exact-identity deterministic rebuilds are required at the candidate PR head.

## Explicit exclusions

This checkpoint does not authorize or implement:

- migration 0005 production dispatch;
- migration 0006;
- private 20/20 mapping persistence;
- API-Football collector deployment or production D1 binding;
- `API_FOOTBALL_API_KEY` provisioning/change;
- Cron activation;
- `PRELIVE_PLANNER_ONLY` activation;
- provider egress or workload ingestion;
- expected-minutes/projection/fixture/captaincy/squad/transfer/simulation/rank/Mini-League/rival/recommendation/alert logic;
- product/UI changes.

After merge and exact-main verification, the next gate remains a separately approved attended **migration 0005 production application**. A fresh read-only preflight and current D1 write-budget evidence are mandatory immediately before that mutation.
