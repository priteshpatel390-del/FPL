# DATA-S2B Option 3 — GitHub Actions to D1 REST collection

## Decision and execution contract

Option 3 is the approved repository direction. Automated collection executes as **GitHub
Actions → the two fixed Official FPL public-core endpoints → runner validation/diff/hash →
Cloudflare D1 REST**. It does not call `teamsheet-data-platform`, a Workers route, or a Worker
binding. D1 REST is Cloudflare's account API and therefore does not invoke the production
Worker: collection Worker CPU is **not applicable**. The production Cron is absent by design
after the owner-observed approximately 630 ms collection and must not be restored. Historical
Cron modules and records remain evidence, not the forward execution contract.

The first-release protected workflow has **only `workflow_dispatch`**: PR, push and schedule
events cannot start it. It retains read-only repository permission, environment
`data-s2-production-collection`, one non-cancelling concurrency group, an exact Node version,
no retry, and checkout of `main`. In particular, PR #209 contains no automatic schedule.

The approved later schedule target remains exactly `17 1 * * *`: one best-effort opportunity
daily at 01:17 UTC. The minute avoids GitHub's documented beginning-of-hour congestion while
retaining the intended 01:00 UTC daily window. It is **not activated here**. Half-hour schedule
checks are not a product requirement and would multiply reads and API activity by 48.

## Activation sequence

### Stage A — repository implementation

Merge PR #209 with the manual-only workflow. Merging it alone cannot schedule or automatically
run production collection.

### Stage B — owner configuration

Create/configure the protected `data-s2-production-collection` environment and add the minimum-
scope Cloudflare D1 token, account ID, account fingerprint and exact production D1 ID described
below. These are owner actions and are not performed by PR #209.

### Stage C — first live acceptance

The owner explicitly approves one manual `workflow_dispatch`. Inspect its exact D1 rows read and
written, changed count, ingestion-run bookkeeping, observation/head consistency and resource
budget. No automatic schedule exists at this stage.

### Stage D — schedule activation

Only after successful manual production acceptance, prepare a separate narrowly scoped PR that
adds `17 1 * * *`. That activation PR must contain no unrelated architecture or data-path change.

## Reuse and flow

The runner reuses the canonical E1/E2 `official-fpl-d1-rest-plan.mjs`,
`d1-rest-client.mjs`, canonical identities/normalisation/diff/materialisation, 15,000-change
guard, 40-statement/16 MiB request bounds, immutable observations, atomic head updates, and
reconcile-before-stop behaviour. There is no generic SQL or generic provider URL input.

Before mutation it requires SHA-256(account ID) to equal the protected account fingerprint,
the exact production D1 UUID `01e2b4f9-313a-4a14-8ce6-86c5aecc50d7`, exact season
`2026-27`, migration 2 and the exact Official-FPL governance/rights revision. It then:

1. reads governance and a deterministic run identity;
2. inserts one `started` ledger row (ambiguous response is read-reconciled, never retried);
3. fetches only `/api/bootstrap-static/` and `/api/fixtures/`, rejects redirects/non-200,
   caps each encoded response at 8 MiB and retains no raw response;
4. reads the current accepted heads once, validates the full population and season, diffs and
   hashes on the runner;
5. atomically completes either the zero-change ledger update or bounded observation/entity/
   head commit; and
6. on an ambiguous final mutation, reads that run and accepts only an exact completed count.

An unchanged cycle writes no observation or head and completes the run with `records_seen > 0`
and `records_accepted = 0`, closing `unchanged_cycle_proof`. A genuine changed fact appends only
changed immutable observations and advances matching heads in the same D1 batch. It can close
`changed_fact_proof` only after a natural Official change; no change is manufactured.
Concurrency is prevented first by the repository-wide Actions concurrency key. Deterministic
run IDs, `INSERT OR IGNORE`, existing-run validation and atomic D1 batches provide the second
layer. A non-completed pre-existing run stops rather than guessing ownership.

## Resource envelope and observability

Cloudflare's current first-party D1 Free limits rechecked 2 September 2026 are 5,000,000 rows
read/day, 100,000 rows written/day and 5 GB storage; the account API limit is 1,200 requests per
five minutes. The runner's stricter per-cycle stops are 25,000 rows read, 40,000 rows written,
8 D1 calls, 40 statements, 16 MiB per D1 request, and 8 MiB per Official response.

For the current 9,860-head population, a normal cycle reads approximately 9,862 rows
(governance + run + heads), makes 5 D1 calls, 2 Official calls, and writes 2 bookkeeping rows
(start plus completion). A current-shape all-facts baseline is approximately 9,860 observations
+ 9,860 heads + at most 1,064 entities + 2 ledger writes = **20,786 rows written**. The
contractual worst case is 15,000 observations + 15,000 heads + at most 1,064 entities + 2 =
**31,066 writes**, below both the 40,000 cycle cap and 100,000 daily Free allowance. A transport-
ambiguous mutation adds one reconciliation call/read, remaining within 8 calls. Normal changed
cycles grow storage only by new immutable observations (plus ledger rows); unchanged cycles add
one bounded ledger row. Absolute storage bytes depend on SQLite encoding, while the 16 MiB body
cap and D1 file size remain fail-closed operational evidence.

Every accepted D1 result's `meta.rows_read`, `rows_written`, and `changes` is validated,
aggregated, budget-checked, and emitted in a sanitized step summary with result and changed
count. Tokens, account/database IDs, SQL, raw payloads and provider bodies are not emitted.
GraphQL analytics is unnecessary. A fetch/validation failure after a definite start currently
leaves a visible `started` incident for owner reconciliation; it never converts uncertain work
to success or retries a write.

## Minimum authority and owner configuration

Create a Cloudflare API token with **Account → D1 → Edit** only, restricted to the exact
production Cloudflare account (and to `teamsheet-data` if Cloudflare's token UI offers a D1
resource selector). Do not grant Workers Scripts, Workers Tail, Account Settings, Access, DNS,
R2, Zone, or token-management permissions. Cloudflare currently exposes D1 write authority at
account scope where a per-database selector is unavailable; the runner's exact UUID gate is the
additional repository restriction.

Create protected GitHub environment `data-s2-production-collection`, restrict deployment to
`main`, require the owner reviewer, prevent self-review, and store `CLOUDFLARE_D1_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` as environment secrets. Store
`CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT` (lowercase SHA-256 of the exact account ID) and
`CLOUDFLARE_PRODUCTION_D1_ID` as environment variables. Do not place any of them at repository
scope. Approve the first manual execution only after merged exact-head Verify; that first
production mutation remains a separate owner gate. Do not add the schedule during configuration;
schedule activation is the later Stage D repository change.

Sources rechecked for this design: [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/),
[Cloudflare D1 Query API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/),
and [GitHub scheduled workflow semantics](https://docs.github.com/actions/using-workflows/events-that-trigger-workflows#schedule).

## First production attempt — reconciliation required

Manual run `33662554360` was dispatched once from exact verified `main`
`0fa955ec69449015c57fd4dc22115d3b779ea0a2` and required protected-environment approval. Its
original attempt 1 passed checkout, identity, governance, deterministic-run and start-ledger
gates, then fetched the fixed Official FPL inputs. It stopped while decoding provider accounting
for the current-head read with the sanitized classification `d1_result_contract_invalid`.
No current-head result was admitted and no observation/head/final-completion mutation was
attempted. The definite successful start mutation means the run has a visible unresolved
`started` ledger row; it must not be called complete or blindly retried.

The failure is classified as a repository observability defect until the invalid metadata field
and class are known. This candidate narrows future sanitized errors to the fixed provider field
(`rows_read`, `rows_written`, or `changes`) and either `type` or `range`, without including the
provider value, response, SQL, identifiers, payload, or credentials. It does not relax any
metadata or resource ceiling. A second production dispatch is not authorized by the first-run
approval: merge, exact-main Verify, explicit owner approval, and reconcile-before-stop review of
the unresolved first ledger row are required before any further production collection.

## First-run resume candidate (production continuation blocked)

PR #210 merged as `287c89be40a5908cbb29422747500f5106f40fb1`; exact-main Verify
`33665119244` passed. The unresolved row retains the immutable deterministic identity and
`started_at` `2026-09-02T17:41:00.000Z`. Resume admits only that exact untouched row and never
inserts a second start. Because the original response bodies were not retained, a continuation
performs a new fetch: its `fetched_at`, entity/head update time, observation creation time, and
completion time come from the runner's genuine current UTC clock and must be later than the
immutable start. The workflow accepts no identity or timestamp input.

Postflight is append-only and run-aware. It requires the exact completed run and counters, the
run-owned observation count equal to `records_accepted`, governed head count equal to distinct
accepted logical-key coverage, every governed head to resolve to an accepted observation with
the same logical key and a completed owning run, and zero orphan heads, retained non-accepted
observations, quarantined observations, rejection rows, quarantined/rejected counters, or error
class. Historical observation count is deliberately not compared with head count.

### D1 read-limit evidence and query-plan correction

The owner supplied a Cloudflare notification that this account exceeded the Workers Free D1
daily allowance of **5,000,000 rows_read**. Cloudflare stated that requests incurring reads are
blocked until `2026-09-03T00:00:00Z`. This proves account-level exhaustion, not that failed run
`33662554360` alone consumed five million reads, so no exact rows-read range is attributed to
that run. The reset does not authorize a dispatch. Production remains blocked until this
query-cost correction is merged, migration 0003 is separately approved/applied, and exact-head
verification and owner approval complete.

Local SQLite `EXPLAIN QUERY PLAN` against migrations 0001-0002 reproduced the defect in the exact
current-head SQL: the optimizer used `shadow_observation_idempotency` for each governed
observation and then `SCAN h` on `observation_heads`. At approximately 9,860 observations and
9,860 heads, that join shape can perform roughly 97 million head-row comparisons. Migration
`0003_production_query_plan_indexes.sql` adds the narrow reverse lookup
`observation_heads(observation_id)`; the same plan then reports `SEARCH h USING COVERING INDEX
observation_heads_observation_id (observation_id=?)`. Supporting indexes bound postflight's
run-owned observation and rejection lookups.

| Repository-owned production SELECT | Local schema-0003 classification |
| --- | --- |
| governance migration/revision/source | indexed bounded lookup |
| exact ingestion run | indexed bounded lookup |
| current governed heads | bounded output scan with indexed joins |
| postflight integrity aggregates | bounded governed/history scans with indexed joins |

The static safety gate is the exact migration-3 governance read before the current-head query,
and permanent tests reject the prior repeated head scan or SQLite automatic-index dependence.
This prevents this known query-plan regression but is not a hard pre-execution row-count
guarantee. Provider `meta.rows_read` accounting remains a separate post-execution ceiling; the
existing 25,000 reads, 40,000 writes, eight API calls, 40 statements, 16 MiB D1 request and 8 MiB
Official FPL response limits are not raised.

Migration 0003 is additive: it creates three indexes and one migration-ledger row, without data
rewrite, deletion, or reset. Index creation reads existing tables and writes index entries, so it
has a bounded one-time operational cost proportional to current rows and requires separate owner
approval. If any statement fails, continuation stays fail-closed because governance cannot find
the exact version-3 ledger contract; do not retry blindly. Reapplication fails on the existing
index/ledger uniqueness contract and leaves the recorded migration singular. Rollback is not an
automatic production action: retain the indexes, investigate from read-only evidence, and use a
separately reviewed forward migration if correction is required. No live migration or collection
was performed while preparing this repository change.

### Whole-cycle static read-cost blocker

Follow-up review found that removing the repeated `SCAN h` was necessary but not sufficient. D1
counts rows scanned in both tables and indexes. At the accepted scale of approximately 9,860
logical facts, the current-head query has three population-sized access legs: the governed
observation index range, observation-ID head lookups, and owning-run lookups. Its conservative
static shape is therefore approximately `3N`, already about 29,580 index/table row visits before
postflight. SQLite `EXPLAIN QUERY PLAN` is structural evidence only; it is not claimed as an exact
prediction of Cloudflare `meta.rows_read`.

The corrected postflight replaces five independent `shadow_observations` scalar aggregates with
one materialized conditional aggregate. It likewise computes head coverage, orphan and invalid
head state in one head traversal, and performs one bounded rejection-index range. This changes the
postflight structure from repeated independent governed-observation scans to one observation
range plus one head traversal with indexed observation/run lookups. It preserves run-owned,
historical, logical-key, admission, quarantine, rejection, orphan and completed-owner checks.

Even after consolidation, the complete structural model is conservatively `7N + 64`: three
population access legs for current heads, one for the observation summary, and three for the head
integrity summary, with 64 reserved for governance, exact-run and empty/bounded rejection point
or range work. At `N = 9,860`, that is 69,084 structural row visits, which cannot plausibly satisfy
the unchanged 25,000 complete-cycle ceiling. This is a static upper-safety model, not live D1
accounting and not an assertion that D1 would report exactly 69,084 rows read.

The runner now evaluates that model immediately after validating the fresh Official FPL bodies
and **before** creating a normal run, dispatching the current-head query, or committing anything.
At the accepted production scale it fails closed as `production_static_read_budget_impossible`.
For the unresolved resume it preserves the existing start row but similarly stops before the
current-head query or any new mutation. Consequently a successful commit cannot be followed by a
known-over-budget postflight false failure at the present scale.

This establishes an architectural/resource-contract blocker rather than disguising it by raising
the limit or deleting integrity checks. The 25,000-row ceiling remains unchanged. Production
migration, normal collection and resume remain unauthorized. A future separately reviewed design
must reduce the number of population traversals—for example through transactionally maintained,
independently auditable current-state summaries—before PR #211 can be considered ready for owner
merge approval or any production continuation.
