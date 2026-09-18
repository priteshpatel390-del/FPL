## Post-20/20 repository completion addendum — 18 September 2026

The earlier EIA-2I5D runtime foundation remains dormant, but two prerequisites have since closed: the response byte ceiling is qualified at 720,896 bytes and the Premier League team identity gate is GO 20/20. The owner has now approved repository-only completion of the remaining pre-live design gap. Migration 0006 adds private qualified-mapping provenance/head constraints without modifying 0005, and a pre-egress planner/orchestrator connects the existing scheduler to the already-closed request contracts while still refusing provider execution. Current Wrangler remains `REPOSITORY_ONLY_BLOCKED`; migration 0005/0006 live application, real mapping persistence, Cloudflare provisioning, secret provisioning, Worker deployment, Cron, provider egress, workload ingestion and model/UI influence remain separate gates. See [pre-live runtime completion](API-FOOTBALL-PRELIVE-RUNTIME-COMPLETION.md).

# EIA-2I5D — Repository-Only API-Football Shadow Runtime and Persistence

Date: 16 September 2026
Base: `f2ad6410d847109f8fa9032224e91d19004bdc80` (merge of PR #249 / EIA-2I5B).

## Outcome

EIA-2I5D adds repository-ready, dormant infrastructure for a future private API-Football shadow collector. It adds migration 0005, a dedicated scheduled-only Worker package, durable D1 quota/lease/generation/revision contracts, a DATA-S2A-backed Official FPL authority reader, bounded scheduling rules, sanitized observability and permanent security/model-isolation tests. Repository-ready does not mean provisioned, deployed, credentialed, scheduled or live accepted.

No API-Football request, credential access or provisioning, live D1 migration, Worker deployment, Cron activation, model change, recommendation change or UI change occurred.

Post-merge closeout (EIA-2I5E, 17 September 2026): PR #250 merged to `main` as `6309dae3614aa06e7c021bfab0f138cac2437a2b`. Exact-main Verify Teamsheet run `35152280445` (run number 735) passed. The collector remains not deployed, migration 0005 is not applied live, no credential is provisioned, Cron is not active, collection stays disabled, and the response-byte ceiling remains `null`. See [EIA-2I5E](EIA-2I5E-PRELIVE-API-FOOTBALL-EVIDENCE-QUALIFICATION.md).

EIA-2I5F repository implementation (17 September 2026): after EIA-2I5E R7 formally qualified response size from attended run `35248079758`, the approved production ceiling is exactly **720,896 bytes**. EIA-2I5F writes only that qualified value into `API_FOOTBALL_MAX_RESPONSE_BYTES`, binds it permanently to the attended evidence in tests, and updates repository documentation. It does **not** provision D1, apply migration 0005 live, create or access a Worker secret, enable collection, declare Cron, deploy the collector, expand the 2/20 mapping, or change model/UI behaviour. See [EIA-2I5F](EIA-2I5F-QUALIFIED-RESPONSE-CEILING.md).

## Migration 0005

`0005_api_football_shadow_runtime.sql` extends migration 0004. It seeds only the canonical API-Football source/revision with the existing `owner_risk_accepted_private_use` restrictions and creates:

- `api_football_runtime_state`: one disabled provider row; UTC daily attempt accounting; normalized quota telemetry; 30-second global lease; spacing and 429/fault state. No credential column exists.
- `api_football_request_attempts`: reservation-before-egress provenance, separate retry attempts, closed endpoint/operation/outcome enums and bounded-retention index. It stores no key, headers, raw URL or payload.
- `api_football_discovery_generations`: deterministic opportunity, DATA-S2A authority provenance and `STAGING`/`COMMITTED`/`FAILED` lifecycle.
- `api_football_discovery_heads`: season head protected by triggers that accept only a matching committed generation.
- `api_football_fixture_revisions`: immutable provider kickoff/status/qualification/duration/input revisions with explicit supersession.
- `api_football_generation_fixtures`: exact generation membership without duplicating fixture identity.
- one nullable `ingestion_run_id` provenance link on migration 0004's `provider_participation_revisions`.

No provider-player/team warehouse or venue, round, logo, image, referee, arbitrary JSON or raw-payload store is added.

## Runtime and credential boundary

`workers/api-football-collector/` is separate from `teamsheet-data-platform` and the Official FPL dispatcher. Its default export contains only `scheduled`; there is no `fetch` handler, public route or custom domain. Wrangler disables `workers_dev` and preview URLs, declares no Cron, uses an all-zero non-live D1 identifier and contains no secret value. A future credential may exist only as Worker secret `API_FOOTBALL_API_KEY`.

The runtime reuses EIA-2I5B's pinned origin, closed endpoint/query builder, GET-only request init, redirect rejection and 15-second timeout. Local input validation precedes D1 reservation, and the declared endpoint class must exactly match discovery or known-ID endpoint/query shape. D1 absence, kill switch off, missing/stale/conflicted Official FPL authority, quota uncertainty, active lease, request spacing, authentication block, 429 block or daily ceiling all deny provider egress.

## Quota and concurrency

Teamsheet's ceiling is 100 HTTP attempts per UTC day. It is an internal safety limit, not provider entitlement. Every retry is a distinct durable attempt. Runtime-state lease/count mutation and request-attempt provenance insertion execute in one atomic D1 batch: both commit or both roll back before egress. Duplicate/failed attempt insertion therefore cannot consume count or strand a lease. Timeout, transport ambiguity and crash after a successful reservation remain consumed. Stale leases may expire but never refund attempts. Minimum spacing remains one second; valid minute telemetry can only increase that gap.

First required request on a new UTC day is one bounded header probe. Missing or malformed normalized headers enters `QUOTA_UNCERTAIN`, blocking further unattended requests. HTTP 429 is never retried and enters `BLOCKED_429` until the next UTC day without guessing the exhausted provider window.

HTTP 401/403 is a distinct, non-retryable `AUTH_FAILURE`. Completion atomically records the safe attempt outcome, sets `credential_state='INVALID'`, disables collection with a closed reason and enters `AUTH_BLOCKED`; even valid quota headers cannot keep collection open. Provider bodies and credential material remain unread and unpersisted. Credential rotation/reactivation remains a separate controlled action.

## Official FPL authority

The adapter reads only completed `official-fpl-r1` DATA-S2A history from canonical D1 heads. It requires season 2026-27, exactly 20 unique canonical team identities, successful run provenance and age no greater than 48 hours. Its SHA-256 digest is content-bound to current team observation identities/input revisions and the completed run. Caller-supplied arrays cannot create this receipt. API-Football never fetches Official FPL.

## Planner and atomicity

The intended future planner wake-up is `15 * * * *`, but repository configuration declares no Cron. Logical identities cover one daily five-competition discovery generation, T-24h/T-3h fixture checks, kickoff+150m finality with at most three hourly checks, final four-endpoint enrichment, +24h correction and conditional +72h correction only for changed/incomplete/conflicted evidence. Postponed/abandoned fixtures receive no zero-minute inference.

A generation head can advance only after all five competition queries succeed and the generation becomes `COMMITTED` in the same D1 batch. Failed or staged data cannot become current. Valid HTTP 200 zero-row competitions still count as successful logical queries. Unchanged fixture input hashes create no revision; changed input appends a revision and retains/supersedes the prior row.

## Raw-response activation gate

Responses are streamed through a byte-counting decoder and row cap before durable admission. Oversize bodies and row amplification fail closed. EIA-2I5E R7 formally qualified the response-size boundary from 11 canonical attended requests: observed maximum 347,982 bytes, doubled maximum 695,964 bytes, rounded to the next 65,536-byte quantum = **720,896 bytes**. EIA-2I5F implements that exact value as `API_FOOTBALL_MAX_RESPONSE_BYTES`. This closes only the response-size repository gate; every separate infrastructure, collection, mapping, authority, quota and security gate remains in force.

## Preserved boundaries

Exactly five EIA-2I5B competitions, FPL season 2026-27, provider season 2026, identity/bijection/conflict rules, serial requests, retry ceilings, raw-payload transience and EIA-2I3 participation/duration semantics remain unchanged. Shadow evidence has no browser, model, expected-minutes, xP, fixture-difficulty, squad, captaincy, transfer, simulation, rank, Mini-League, rival, strategy, alert or recommendation read path.

## Verification and limitations

Permanent tests cover runtime safety, atomic reservation rollback, duplicate identities, conservative post-reservation crash accounting, quota/authentication states, UTC reset, stale leases, genuine two- and five-promise races, exact endpoint-class mapping, bounded decoding, scheduler identities, sanitized output, Worker closure, secret absence, migration compatibility, head atomicity, uniqueness and production/browser isolation. EIA-2I5F additionally binds the runtime constant to the immutable R7 attended evidence and proves the default decoder rejects a declared response one byte over the ceiling. Full-suite and deterministic-build results belong in the draft PR at its exact head.

Remaining live gates require separate owner approval: prove all 20 provider-to-FPL mappings; provision the existing D1 binding; apply migration 0005 live; create the Worker secret; enable the kill switch; declare/activate Cron; deploy; run bounded acceptance; and separately consider any model/UI use. None is approved here.
