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
