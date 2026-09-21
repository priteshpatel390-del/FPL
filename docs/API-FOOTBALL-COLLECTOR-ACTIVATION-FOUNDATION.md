# API-Football Collector Activation Foundation

## Approval and outcome

Pritesh approved repository implementation only. This checkpoint adds a dormant, concrete D1-backed execution composition for one attended five-competition discovery generation. It does not authorize or perform provider access, secret access, production D1 access, deployment, binding, Cron, runtime enablement, workload ingestion, or model/product/UI use.

Shipped `wrangler.jsonc` remains inert: `EIA_2I5D_ACTIVATION` is `REPOSITORY_ONLY_BLOCKED`, Cron is empty, D1 ID is the all-zero placeholder, Workers.dev is false, and preview URLs are false. Future state is named `ATTENDED_ONE_SHOT_DISCOVERY`, but no shipped configuration selects it. `PRELIVE_PLANNER_ONLY` reads planning state only, never constructs execution dependencies, never reads provider key, and never calls provider transport.

## Single execution owner

`runOneShotDiscoveryGeneration()` is sole end-to-end owner:

`plan -> STAGING generation -> prior-attempt admission -> durable reservation -> bounded transport -> semantic validation -> generation-ceiling admission -> normalized D1 persistence -> durable attempt completion -> final generation/head commit`.

Transport performs no D1 work. Concrete repository performs no provider work. Exactly one reservation, persistence path, and completion exist per logical attempt. Production dependencies are constructed internally from Worker `env`; test injection exists only on separately exported orchestration helper.

HTTP 200 is transport evidence only. Discovery and known-fixture validators pin endpoint class, exact echoed parameters, provider season, approved five-competition registry, paging 1/1, fixture and participant IDs, status, kickoff, and current qualified 20/20 mappings. Both produce the same normalized durable fixture contract; raw provider rows cannot reach persistence.

## Concrete D1 lifecycle and crash semantics

Existing migrations 0005/0006 provide every required capability; migration 0007 is not needed. Repository adapter creates deterministic ingestion-run and generation identities from logical discovery opportunity, creates `STAGING`, reuses existing atomic lease/reservation contract, bulk-upserts provider identities, inserts immutable content-hash revisions with supersession, links revisions to generation, completes attempt only after persistence, and atomically commits generation/run/head only after five attempt-1 successes and exact membership count.

Persistence-before-completion failure leaves attempt `RESERVED`; completion-before-generation-commit failure leaves attempts `SUCCEEDED` and generation non-current. Either state blocks re-egress and requires reconciliation. Active and expired reservations, prior successes, timeouts, transport uncertainty, quota/auth failures, schema failures, and HTTP failures never create attempt 2.

## Generation ceiling and enforceable D1 exposure

Attended R7 evidence observed 1,131 rows. Twice that is 2,262; rounding upward to next 500 gives deterministic **2,500 normalized fixtures**. Ceiling is checked before each response persistence.

Concrete adapter uses fixed 1,250-row chunks. Each chunk has exactly three bulk statements: identity upsert, immutable revision insert, and generation membership upsert. Five responses can fragment 2,500 admitted rows into at most six chunks, so fixture persistence has at most **18 statements** and **7,500 rows written**. Chunk JSON is capped at 1,500,000 bytes, below repository-pinned 2,000,000-byte D1 parameter limit.

Successful generation control exposure is exact:

- staging run/generation: 2 mutation statements and 2 rows;
- five reservation batches: 10 mutation statements and 10 rows;
- five attempt completion batches: 10 mutation statements and 10 rows;
- final generation/run/head batch: 3 mutation statements and 3 rows;
- attempt and staging reconciliation: 6 read statements;
- maximum total: **43 mutation statements, 49 statements including reads, and 7,525 rows written**.

No retry multiplier exists. Operation accounting is enforced before D1 submission. Batch size is at most three statements and persistence chunk size at most 1,250 fixtures. Forty-nine total statements stay below repository-established 50-query invocation envelope. Returned D1 changes above admitted row ceiling fail closed. Safety never relies on unchanged fixtures or deduplication.

## Stage-aware activation preflight

Preflight remains repository-only and has two closed stages:

- `REPOSITORY_INFRASTRUCTURE_STAGING` returns `READY_FOR_REPOSITORY_INFRASTRUCTURE_STAGING` only for blocked activation, no Cron, placeholder/unbound undeployed inventory, disabled runtime, absent secret binding, exact migrations 0001–0006, zero FK violations, fresh authority, exact current 20/20 mapping, no lease, reconciled prior state, bounded history, and zero model/UI imports.
- `ATTENDED_ACCEPTANCE` returns `READY_FOR_SEPARATELY_APPROVED_ATTENDED_ACCEPTANCE` only for exact production D1 binding proof, exact deployed/configured attended collector, no Cron, secret-binding presence true without value access, runtime still disabled and credential state available, plus all shared data/reconciliation gates.

No live preflight ran.

## Preserved boundaries and next gate

API-Football remains shadow-only. Lineups, players, events, enrichment, correction, model influence, recommendations, browser reads, and UI reads remain blocked. Raw provider bodies, URLs, secrets, private mapping pairs, account IDs, and database IDs are not retained or logged.

After owner review and merge, any infrastructure staging or attended discovery acceptance requires separate explicit approval. Production activation remains separately owner-gated. This checkpoint grants no production/provider action.
