# DATA-S2B — read-budget remediation (P2+)

Repository implementation only. Nothing in this package was executed against Cloudflare. No D1
request, no workflow dispatch, no production collection, no migration, no deployment, no Cron or
schedule change, no environment change and no credential change was performed while preparing it.
The scheduled production workflow remains **owner-disabled** and this package does not re-enable
it.

## The incident

Two scheduled production runs bracket this work.

**Run `33901634593` — 4 September 2026, succeeded.** The first genuine natural scheduled
production collection. Event `schedule`, attempt 1, head `main`
`dac27b3860428bc55c6d505e8a817a207d30f904`, both jobs successful. Its Step Summary reported:

| Measure | Value |
|---|---|
| `historicalObservations` (H) | 10,628 |
| `currentHeads` (N) | 10,146 |
| `changed` (D) | 264 |
| `structuralRowsRead` (repository model) | 94,844 |
| `rowsRead` (Cloudflare `meta.rows_read`) | **124,430** |
| `rowsWritten` (Cloudflare `meta.rows_written`) | 1,852 |
| `apiCalls` | 6 |
| `requestBytes` | 385,821 |
| `status` / `orphanHeads` / `quarantined` / `rejected` | completed / 0 / 0 / 0 |

The run succeeded with **570 rows** of headroom below the 125,000 hard ceiling. That is not a
safety margin.

**Run `33948145320` — 5 September 2026, failed.** Event `schedule`, attempt 1, head `main`
`9a1c6a87e17de08ed2c5b650b05cdc3eab96291c`. GitHub created the run at `2026-09-05T05:48:05Z`
against a nominal minute of 01:17 UTC — approximately **4h31m** of schedule-event delivery delay,
consistent with the delivery behaviour already recorded as a permanent operational limitation, and
never a collection delay. `repository-gate` succeeded. `collect` failed with
`production_d1_budget_exceeded` in phase `postflight_read`, carrying
`productionMutation: 'definite_completed'` and `productionRetryable: false`.

The commit therefore **completed** and the synchronous postflight never ran. The state that run
left in production D1 has never been validated against the production postflight contract. That
unproven state is what Stage 0 exists to resolve, and it is not resolved by this package.

The owner disabled the scheduled workflow after that failure. It remains disabled.

## What is proven, and what is not

**FACT.** The write estimate matched the measured `rowsWritten` exactly on run `33901634593`:
`0 × 3 + 264 × 5 + 3 × 3 + 261 × 2 + 1 = 1,852`. That is a fact about the write model. It is **not**
evidence that any particular Cloudflare index or table visit is billed in one particular way, and
it is not generalised into one anywhere in this package.

**The read model is proven defective.** Actual `rowsRead` of 124,430 materially exceeded the
structural estimate of 94,844 — a delta of 29,586, an underestimate of about 31.19%. Four things
are known about why:

* the dispatch counts provider `rows_read` from **every** D1 call, including the commit;
* the structural estimator modelled **no** mutation-read usage at all;
* the current-head statement carried O(H) work over the append-only history;
* the pre-mutation gate compared only already-billed rows plus the raw structural postflight term,
  with no provider amplification and no reserve.

**The exact attribution of the 29,586 rows remains partly unknown.** No precise split between
mutation reads, current-head cost and further provider-side amplification is asserted here, and
none is invented. Better attribution needs the per-call telemetry this package adds and a further
instrumented production run.

## Stage 0 — committed-run integrity, repository only

`workers/data-platform/integrity/committed-run-integrity-contract.mjs`,
`workers/data-platform/integrity/verify-committed-run.mjs`,
`workers/data-platform/run-committed-run-integrity.mjs` and
`.github/workflows/data-s2b-committed-run-integrity.yml`.

**This workflow has NOT been dispatched.** It is implementation and tests only.

It answers exactly one question: does the state run `33948145320` committed satisfy the existing
production postflight contract? It issues **one** read-only D1 REST request carrying **one**
statement — the existing `POSTFLIGHT_SQL`, reused unchanged — and validates the returned row with
the existing `validateProductionPostflight`, also reused unchanged, so no second and weaker
definition of a valid committed state exists anywhere in the repository.

The run identity is derived, never supplied: `COMMITTED_RUN_SCHEDULED_AT = '2026-09-05T05:48:00.000Z'`
is a reviewed constant, and a permanent test pins that `productionRunIdFor` of it is exactly
`gha-e385726067648e08d44f8870df35ada41aa9b0f4`. The workflow takes only an approved SHA; it accepts
no SQL, table, column, statement, timestamp or database identifier.

It deliberately does **not** reuse the first-run reconciliation contract. That contract exists to
prove an **untouched `started`** ledger row and is pinned to `FIRST_PRODUCTION_RUN_SCHEDULED_AT`;
the run in question is `completed` and owns observations, so repurposing it would have inverted its
meaning. Its first-run pinning is left intact.

Resource contract: `workflow_dispatch` only, with no `schedule`, `push`, `pull_request`,
`repository_dispatch`, `workflow_call` or `workflow_run` trigger and no cron; at most one D1 API
call; `rows_written` must be exactly zero; `rows_read` bounded at 75,000, above the conservatively
amplified projection of the single postflight read and far below the unchanged 125,000 cycle
ceiling, which it does not reinterpret. No mutation plan builder is importable from it. Outcomes
are exactly `COMMITTED_STATE_VALID`, `COMMITTED_STATE_INVALID_REQUIRES_OWNER_ATTENTION` or
`AMBIGUOUS_REQUIRES_OWNER_ATTENTION`.

It uses the existing `data-s2-production-collection` protected environment and its existing
credentials; none were created, renamed, rotated or widened. The PR #215 identifier protections are
preserved: the fingerprint mask is registered by the credentialled job's first step before the
variable is materialised, the D1 id stays a repository constant absent from every workflow value,
and both the helper and the entry point discard the original runtime error object so no message
can carry a request URL into a log or a summary.

A `COMMITTED_STATE_VALID` outcome would be a fact about state that already exists. It is never an
authorisation to collect, to resume, or to re-enable the scheduler.

## Stage 1 — honest pre-mutation read model

The unchanged ceilings: `MAX_D1_ROWS_READ_PER_CYCLE = 125000`,
`EXPECTED_D1_ROWS_READ_PER_CYCLE = 100000`, `MAX_D1_ROWS_WRITTEN_PER_CYCLE = 40000`,
`MAX_D1_API_CALLS_PER_CYCLE = 8`. None moved.

**Measured calibration.** `MEASURED_PROVIDER_READ_CALIBRATION` records run `33901634593`'s reported
accounting verbatim as a permanent regression fixture, labelled MEASURED.

**Mutation-read estimator.** `estimateRoutineMutationRowsRead` mirrors the write estimator's inputs
exactly — fresh entities, observations, new heads, updated heads, start, completion — so the two
models can never disagree about the shape of the cycle they describe. Its constants are labelled
**INFERRED, not measured**: conservative upper assumptions derived from the schema's declared keys,
indexes and foreign keys, not provider-confirmed per-row costs. They are pinned in tests so a
future recalibration is a single visible change.

| Statement | Assumed read visits |
|---|---|
| `startInsert` | 3 |
| `entityInsert` | 3 |
| `observationInsert` | 5 |
| `headInsert` | 3 |
| `headUpdate` | 4 |
| `completionUpdate` | 2 |

**Provider projection.** `projectProviderCycleRowsRead` is deliberately distinct from the
structural model, and both stay separately reported, so a future recalibration can tell a plan
change from an amplification change. Already-billed provider rows are taken exactly as Cloudflare
billed them and are never amplified again; only outstanding work is:

```
projected = rowsReadSoFar + ceil((remainingStructuralRows + mutationRowsRead) × amplification) + reserve
```

`PROVIDER_READ_AMPLIFICATION = 1.35` and `PROVIDER_READ_SAFETY_RESERVE = 2000` are both **INFERRED**.
1.35 sits conservatively above both the raw observed ratio (124,430 / 94,844 = 1.311944) and the
residual ratio once mutation reads are modelled explicitly (about 1.28), so the projection
over-predicts rather than under-predicts on the only sample that exists. It is one sample; 1.35 is a
deliberately pessimistic planning assumption, never a proven provider constant.

Against the 4 September sample the projection returns **131,298** (new structural) and **133,250**
(superseded structural), both comfortably above the measured 124,430.

**Soft gate versus hard circuit breaker.** They are separate and share the one unchanged ceiling:

| | Soft predictive gate | Hard circuit breaker |
|---|---|---|
| Input | a projection of work not yet done | Cloudflare's returned accounting |
| When | once, before the start mutation | after every D1 call |
| Code | `production_projected_read_budget_exceeded` | `production_d1_budget_exceeded` |
| Classification | `mutation = none`, nothing written | whatever the cycle had already done |

The hard breaker is preserved unchanged. The soft gate exists so a cycle cannot pass a predictive
check, mutate production, and only then discover the envelope was already impossible — which is
exactly what run `33948145320` did.

## Stage 2 — bounded resource telemetry

The D1 client previously aggregated every statement's metadata into one scalar and discarded the
breakdown, so run `33948145320`'s summary could not say which call or which dimension exhausted the
envelope. The aggregate `usage` scalar is unchanged and remains what every existing caller and
ceiling reads; alongside it the per-statement integer breakdown is now preserved.

`createProductionResourceTelemetry` records per call: `kind` (a closed enum), `rowsRead`,
`rowsWritten`, `requestBytes` and the per-statement integers. Its snapshot carries `apiCalls`,
`cumulativeRowsRead`, `cumulativeRowsWritten`, `cumulativeRequestBytes`, `lastCallRowsRead`,
`lastCallRowsWritten`, `lastCallRequestBytes`, the ceiling each dimension stands against, and one
pre-mutation planning record — `structuralRowsRead`, `projectedProviderRows`,
`amplifiedRemainingRows`, `mutationRowsRead`, `remainingStructuralRows`, `amplification`, `reserve`,
`historicalObservations`, `currentHeads`, `changed`.

**Security.** Numbers and fixed enums only. No SQL text, no bound parameter, no request URL, no
account id, no database id, no fingerprint, no token, no response body and no returned row can reach
it: it is fed only from the client's already-validated integer accounting and from the repository's
own models, every field is coerced to a non-negative safe integer or a closed enum, and a permanent
test feeds it hostile values and asserts none survives. Every existing identifier mask and the
PR #215 sanitized-error behaviour are preserved. Success reporting keeps its existing shape and adds
to it; the sanitized failure classification now carries the snapshot as it stood when the cycle
stopped.

## Stage 3 — O(H) → O(N) current-head plan

`HEADS_SQL` previously let the planner drive `shadow_observations` through
`shadow_observation_idempotency` on `source_revision_id`, visiting every historical observation of
the revision and probing a head and a run for each — 3H, a cost that grows every day forever even
though the answer never exceeds N rows.

The replacement uses SQLite's `CROSS JOIN`, which suppresses the planner's table reordering without
altering the relational meaning of an inner join. `observation_heads` is always the outer loop and
the other two tables are always indexed probes from it:

```
SCAN h USING COVERING INDEX observation_heads_observation_id
SEARCH o USING INDEX sqlite_autoindex_shadow_observations_1 (observation_id=?)
SEARCH r USING INDEX sqlite_autoindex_ingestion_runs_2 (run_id=? AND source_revision_id=?)
```

Both join predicates and the `WHERE o.source_revision_id=? AND r.status='completed'` filter are
byte-identical, so a row qualifies under exactly the same conditions. **No migration. No new index.
No migration 0004.** The three migration-0003 indexes are unchanged and the migration set remains
0001–0003.

**Whole-cycle structural model.** `2H + 7N + 4D + 64`, where it was `5H + 4N + 4D + 64`. The
established `H = N`, `D = 0` baseline of `7N + 64` is unchanged by the re-plan; what changes is the
coefficient on the append-only history, from 5 to 2.

**Row-set equivalence** is proven by permanent tests against the real schema across seeded normal
completed heads, changed heads, multiple historical observations per logical key, an incomplete
`started` run, rows on a different source revision, an orphan-like head, a no-change state, an empty
population and a large-history/small-head shape. The exclusion scenarios are non-trivial — 30 of 60
heads excluded — and both statements agree exactly.

**EXPLAIN contract.** The previous contract rejected any `SCAN h`, because before migration 0003 the
only way `observation_heads` could be scanned was the catastrophic repeated inner scan. Under the
O(N) statement that blanket rule would reject the good plan and accept nothing, so it is **replaced
by a strictly stronger structural contract**, not removed. Accepted: exactly one access node on
`observation_heads`, and it is a covering-index scan of `observation_heads_observation_id`;
`shadow_observations` reached only as an indexed probe on `observation_id`; `ingestion_runs` reached
only through its unique index or primary key; exactly three access nodes. Rejected, each with its
own code: more than one head node; a plain table scan of `observation_heads`; any scan of
`shadow_observations` or `ingestion_runs`; any appearance of `shadow_observation_idempotency`; any
automatic index; an unindexed run probe. The superseded O(H) plan and the pre-migration-0003 plan
are therefore each rejected twice over, and permanent tests prove it.

## The honest outcome — Stage 3 alone is not sufficient

At the current population the re-plan saves `3(H − N) = 1,446` structural rows, because H and N are
currently close. Its value is that it removes the term that grows without bound, not that it
recovers headroom today. The remaining H-proportional terms are inherent to the questions being
asked: the population probe counts the history, and the postflight's observation CTE aggregates over
it.

Applying the corrected provider projection to the population run `33948145320` left behind gives a
figure **above** 125,000. **The soft gate will therefore refuse the next cycle** — with
`mutation = none`, writing nothing — rather than committing and then failing at postflight.

That is a strict improvement in safety and it is reported as such: it is **not** a restoration of
collection capability. Per the approval's stop condition, this is recorded rather than worked
around. The proposed postflight covering index remains out of scope, **migration 0004 is not
created**, and the read ceiling is not raised. Whether a schema change is warranted is a separate
owner decision that should be informed by the new telemetry and a first instrumented production
validation.

## Explicitly not done

No live D1 integrity dispatch. No production collection. No manual collection dispatch. No
scheduled collection. No scheduler re-enable. No cron or cadence change — `PRODUCTION_COLLECTION_SCHEDULE`
and the workflow's single trigger both remain `17 1 * * *`, and permanent tests pin that. No change
to the 125,000 read cap. No migration 0004. No covering-index migration. No provider or data
semantic change. No Package 3 redesign. No merge.
