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
`d1-rest-client.mjs`, canonical identities/normalisation/diff/materialisation, 4,000-change
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
five minutes. The approved routine contract has a 100,000-row expected read target, a 125,000-row
hard read ceiling, a 40,000-row hard write ceiling, 8 D1 calls, 40 statements, 16 MiB per D1 request, and 8 MiB per Official response.

The old estimate of approximately 9,862 reads counted logical rows rather than D1 index/table
rows scanned and is superseded. Schema-0003's conservative synchronous full-integrity model is
`7N + 64`, or 69,084 structural visits at 9,860 facts. This is local plan/estimate evidence, not
an exact Cloudflare bill. Routine writes use index-aware amplification: entity insert 3,
observation insert 5, new head 3, existing-head update 2, run start 3 and completion update 1.
The routine delta limit is 4,000; the worst fresh-entity/new-head estimate is 35,196 including
start, below the unchanged 40,000 cap. A true baseline is not executable under this contract. A transport-
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
approved 125,000 hard reads, 40,000 writes, eight API calls, 40 statements, 16 MiB D1 request and 8 MiB
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

### Approved resource-contract rebaseline

Owner approval retains the normalized append-only architecture and synchronous global postflight.
The read contract is now a 100,000-row expected acceptance target and a 125,000-row hard cycle
ceiling. At current scale, the conservative `7N + 64` plan model is 69,084 structural visits.
SQLite `EXPLAIN QUERY PLAN` proves access shape only; repository estimates are conservative; only
Cloudflare response `meta.rows_read` and `meta.rows_written` are provider accounting evidence.
The hard provider ceilings remain post-execution checks.

The routine write contract remains 40,000 rows, but the changed-observation maximum is 4,000. A
pre-commit estimator accounts for table/index amplification: three rows per fresh entity, five per
new observation, three per new head, two per existing-head update, three for a new run, and one
for completion. The maximum worst-case routine shape is 35,196 including 1,064 fresh entities and
4,000 new heads. A 4,001st change fails before any mutation. Returned `meta.rows_written` remains
independently enforced.

Postflight remains synchronous and consolidated: one materialized governed-observation aggregate,
one head traversal with indexed observation/run lookups, and one indexed rejection range. It
retains exact completed run/counters, run-owned delta, append-only history, logical-key/head
coverage, orphan/invalid-head, acceptance/quarantine/rejection, completed-owner, and null-error
checks. No audit workflow or stale audit marker is introduced.

Future live query-plan acceptance is repository-controlled: a fixed trusted `EXPLAIN QUERY PLAN`
wraps the exact current-head SELECT and accepts only a result containing migration-3's
`observation_heads_observation_id`, with neither `SCAN h` nor an automatic index. It has no SQL
input surface. It must run only after separate owner approval and migration-3 reconciliation; it
was not executed here.

A future true baseline/recovery requires a separate owner-approved resource contract, isolation
from other substantial writes that UTC day, and exact provider accounting. No 90,000-row baseline
allowance is executable in this checkpoint. The existing production baseline means the exact
started first run can eventually resume under the 4,000-delta routine gate; a larger delta stops
before commit and returns to the owner gate.

### Whole-cycle read model over append-only history

The earlier gate estimated only `7N + 64` from the incoming fact count `N`. That is valid only near
the initial state where the append-only observation population `H` is approximately equal to the
current head population `N`, and it is not a complete-cycle model once history grows. The corrected
model is derived from the exact fixed repository SQL and its local schema-0003
`EXPLAIN QUERY PLAN` shape, counting one structural visit per row touched per table reference:

| Traversal | Plan evidence at schema 0003 | Structural visits |
| --- | --- | --- |
| current-head read, driving table | `SEARCH o USING INDEX shadow_observation_idempotency (source_revision_id=?)` | `H` |
| current-head read, run probe | `SEARCH r USING INDEX sqlite_autoindex_ingestion_runs_2` | `H` |
| current-head read, head probe | `SEARCH h USING COVERING INDEX observation_heads_observation_id (observation_id=?)` | `H` |
| postflight `observation_state` | `SEARCH shadow_observations USING INDEX shadow_observation_idempotency (source_revision_id=?)` | `H + D` |
| postflight `head_state` | `SCAN h`, then one `o` probe and one `ir` probe per head | `3(N + D)` |
| postflight `rejection_state`, governance, run read, outer probe, one-row CTE scans | bounded | fixed reserve `64` |
| population probe, observations | `SEARCH shadow_observations USING COVERING INDEX shadow_observation_idempotency (source_revision_id=?)` | `H` |
| population probe, heads | `SCAN observation_heads USING COVERING INDEX observation_heads_observation_id` | `N` |

`H` is the pre-commit governed observation population, `N` the pre-commit head population and `D`
the observations this cycle will append. Postflight runs after the commit, so it is charged the
post-commit populations `H + D` and, worst case, `N + D` when every change creates a new logical key.

- cycle term, excluding the probe: `3H + (H + D) + 3(N + D) + 64` = `4H + 3N + 4D + 64`
- at `H = N`, `D = 0` this collapses to **`7N + 64`**, reconciling exactly with the established
  69,084-visit baseline at 9,860 facts
- probe term: `H + N`
- **complete planned total: `5H + 4N + 4D + 64`**

At today's `H = N = 9,860` with `D = 0` the complete planned total is **88,804**, inside the 100,000
expected target. Holding `N = 9,860` and the maximum routine `D = 4,000`, the last admitted history
is **`H = 13,899`** (124,999) and `H = 13,900` (125,004) fails closed. Growth alone can therefore
reject a cycle while the incoming fact count is unchanged, which is the intended behaviour.

These remain repository plan estimates. Cloudflare `meta.rows_read` stays independently enforced
after every request, and neither ceiling was raised.

#### Obtaining `H` without undercount

Two mechanisms were evaluated.

**Ingestion-run ledger totals were rejected.** Summing `records_accepted` over completed runs cannot
be proved to bound `H` from below in every admitted repository state. Observations can exist that no
completed run's counter covers: the disposable-D1 evidence records two intentional pre-existing
affinity observations that the E2C-B reconciliation contract admits alongside the 9,860 analogue
rows, and a transport-ambiguous commit can leave observations under a run whose ledger row is not
`completed`. A mechanism that can undercount `H` would understate the cycle and defeat the gate, so
ledger inference is not used and a permanent test asserts the population statements reference
neither `ingestion_runs` nor `records_accepted`.

**A fixed repository-owned count is used.** `SELECT COUNT(*) AS observations FROM shadow_observations
WHERE source_revision_id=?` and `SELECT COUNT(*) AS heads FROM observation_heads` carry no arbitrary
SQL surface and are proved covering-index only with no automatic index at schema 0003. Their own
cost is charged in the model as the probe term above, and they are carried as statements two and
three of the **same** trusted plan as the current-head read, so the API-call ceiling of eight is
unchanged on both the normal and the reconciliation path. A malformed or negative count is rejected
as `production_population_contract_invalid` rather than being treated as zero.

The gate runs after the diff and before the start and commit mutations. It rejects when the complete
structural total exceeds 125,000, and also when the reads Cloudflare has already billed plus the
still-outstanding synchronous postflight would exceed it.

### Post-commit resource and acceptance semantics

The run is completed by the commit batch and postflight is read afterwards, so a cumulative
`rows_read` overage or a postflight mismatch can occur when the mutation has definitely happened.
Reporting that as an ordinary failure would imply nothing was written. Every failure now carries an
explicit classification:

| Classification | Meaning | Recovery |
| --- | --- | --- |
| `none` | failed before any mutation was dispatched | none needed |
| `unknown` | a start or commit dispatch could not be reconciled to a definite outcome | owner reconciliation, never blind retry |
| `definite_completed` | the commit call returned successfully, so the run is completed; the resource or acceptance check then failed | owner review of the completed run, never blind retry |

`definite_completed` is raised for a post-commit budget overage (`commit_resource`), a failed
postflight read (`postflight_read`), a postflight integrity mismatch (`postflight_acceptance`) and a
failure while reporting the accepted state (`postflight_report`). `ok:true` is returned only after
the synchronous postflight has validated, and the resume runner writes the sanitized classification
to the workflow summary before rethrowing, so a stopped run is never presented as a no-write. Every
classification is non-retryable; the workflow additionally refuses any attempt after the first.
Prevention remains the conservative pre-mutation whole-cycle gate; these semantics exist because a
repository estimate is not exact provider billing.

### Branch reconciliation with main

After this candidate was prepared, `main` advanced from `287c89be40a5908cbb29422747500f5106f40fb1`
to `3981d7c1c3074edb54464127b091cdce7520af67` through PR #212, which added a development-agent
skill pack under `.agents/skills/`, `.claude/skills/` and `skills-lock.json`. That pack is agent
tooling only: it is absent from `dist/manifest.json`'s 62 build inputs, changes no product,
runtime or DATA-S2B behaviour, and is unrelated to this checkpoint.

The candidate branch was reconciled by a normal merge of `main` into it, with no history rewrite,
force push, or replacement pull request, and no conflict occurred. The skill-pack files are
carried through unchanged and appear nowhere in this checkpoint's diff against current `main`.
Because the merge changed no build input, the committed deployable retains its exact recorded
source provenance and was deliberately not regenerated.
