# DATA-S2B — production collection capacity restoration (Package A)

Repository implementation only. Nothing in this package was executed against Cloudflare. No D1
request, no D1 read, no D1 mutation, no workflow dispatch, no production collection, no migration,
no index, no deployment, no Cron or schedule change, no environment change and no credential change
was performed while preparing it. The scheduled production workflow remains **owner-disabled** and
this package does not re-enable it.

It changes exactly one thing: the size of the internal per-cycle read envelope. It changes no SQL,
no query plan, no `EXPLAIN` contract, no migration, no index, no schema, no projection factor, no
write ceiling, no API-call ceiling, no integrity contract and no data semantics.

## Why the envelope had to move

**FACT — the integrity incident is closed.** The state scheduled run `33948145320` committed on
5 September 2026 has been proved to satisfy the existing production postflight contract. Workflow
`DATA-S2B Committed Run Integrity` (workflow `350897195`), run `33966125991`, run number 1,
attempt 1, event `workflow_dispatch`, head `main` `bfcac663f4bfb02274843caa8d4332d8622f68d7`,
conclusion **success**, both `repository-gate` and `committed-run-integrity` succeeding. That runner
returns `COMMITTED_STATE_VALID` on exactly one path — after the unchanged production postflight
validator has accepted the returned row — and its entry point rethrows for every other
classification, so a successful workflow is proof of that classification. The check was read-only:
one D1 API call, `rows_written` required to be exactly zero, `mutationIssued: false`, no mutation
builder importable from it. **This is a capacity package, not a repair package.**

**FACT — the previous envelope was operationally too tight.** PR #223 replaced a pre-mutation read
model that had been proven defective. The corrected model is deliberately conservative: it counts
mutation reads explicitly, amplifies only outstanding work by an INFERRED 1.35, adds a flat 2,000
reserve, and refuses **before** the start mutation. Applied to the governed population that run
`33948145320` left behind, that corrected projection returns **132,015** for a cycle of 264 changed
observations, and remains above 125,000 even for a cycle with **no changed observations at all**.
Under the superseded envelope the predictive gate therefore refused every realistic cycle before
mutation. A threshold that refuses everything protects nothing.

That is the whole justification. The model was corrected first, in PR #223, and only then was the
envelope resized. Resizing the envelope while the estimator was still dishonest would have been
permission to overrun further; resizing it now sits behind a projection that over-predicts.

## What is now enforced

Three distinct thresholds, where there were two and the predictive gate compared against the harder
of them.

| Threshold | Constant | Value | Input | When | Blocking |
|---|---|---|---|---|---|
| EXPECTED | `EXPECTED_D1_ROWS_READ_PER_CYCLE` | 150,000 | projection, structural total, and final actual rows | at each classification | **No** |
| SOFT | `SOFT_D1_ROWS_READ_PER_CYCLE` | 200,000 | the amplified provider projection | once, before the start mutation | **Yes** — `production_projected_read_budget_exceeded`, `mutation = none` |
| HARD | `MAX_D1_ROWS_READ_PER_CYCLE` | 250,000 | Cloudflare's own returned `meta.rows_read` | after every D1 call | **Yes** — `production_d1_budget_exceeded` |

Superseded: `EXPECTED_D1_ROWS_READ_PER_CYCLE = 100000` and `MAX_D1_ROWS_READ_PER_CYCLE = 125000`,
with `assertProjectedProviderReadBudget` comparing its projection directly against the 125,000 hard
ceiling. Those two numbers no longer describe the running system. They remain accurate as
statements about the 4 and 5 September 2026 runs, which executed under them, and permanent tests
pin them under the explicit names `SUPERSEDED_EXPECTED_CEILING` and `SUPERSEDED_HARD_CEILING` so
assertions about those runs keep meaning what they meant.

### The four bands

* **A — projection ≤ 150,000.** Normal. Classified `expected`.
* **B — projection above 150,000 and at most 200,000.** Admitted, and classified `above_expected`
  so the summary says plainly that the cycle is outside the comfortable band.
* **C — projection above 200,000.** Refused **before** any mutation, with `mutation = none` and
  nothing written.
* **D — actual provider accounting above 250,000.** The hard circuit breaker, independently, after
  a D1 call has returned.

C and D are deliberately not the same test. C is a prediction about work not yet done; D is a
measurement of work already billed. Keeping them 25% apart is the point of the package: it means a
cycle that clears the soft gate has room for the projection to be wrong before the breaker can fire
after a commit — which is exactly how run `33948145320` failed.

### Where each threshold is enforced

* `assertProjectedProviderReadBudget` — **SOFT**. The one predictive gate. It no longer reads the
  hard ceiling at all, and a permanent test reads the module source to prove the two comparisons
  name different constants and that neither has drifted onto the other.
* `enforce()` — **HARD**, unchanged in mechanism, over `meta.rows_read` returned by Cloudflare.
* `classifyRowsRead` — the cycle's final actual accounting: refuses above **HARD**, classifies
  against **EXPECTED**. Actual rows are never measured against SOFT, which governs a projection.
* `assertCycleReadBudget` and `assertStaticReadBudget` — **HARD**. These are structural
  impossibility guards over the raw model, not planning refusals: a cycle whose structural floor
  exceeds the absolute per-cycle maximum can never complete under any circumstance. In practice the
  amplified projection binds first, so the soft gate remains the operative pre-mutation refusal.

### Why the classification enum member was renamed

`hard_ceiling_headroom` became false the moment SOFT and HARD were different numbers. The three
call sites report against three different envelopes — the projection gate against SOFT, the
structural guard and the final actual classification against HARD — so a name promising headroom
against one named ceiling would have been wrong at two of them. The enum stays **closed** and stays
at **two members**; only the second one is renamed:

```
PRODUCTION_READ_CLASSIFICATIONS = ['expected', 'above_expected']
```

`above_expected` asserts only what every site can prove: the value cleared its own binding envelope
and sits above the comfortable band. Compatibility impact is confined to this repository — the
value appears in `population.readClassification`, `population.projectedReadClassification` and
`d1.readClassification` in the success report and in the workflow Step Summary. Nothing outside the
repository consumes it, no persisted record carries it, and failure sanitisation continues to emit
closed-enum values only.

## Telemetry

The bounded resource snapshot now carries all three read thresholds under explicit names, because a
single unqualified `rowsRead` ceiling could no longer say which envelope a refusal was measured
against:

```
ceilings: { rowsReadExpected: 150000, rowsReadSoft: 200000, rowsReadHard: 250000,
            rowsWritten: 40000, apiCalls: 8, requestBytes, storedCalls, statementsPerCall }
```

Everything else PR #223 added is preserved unchanged: the per-call and per-statement integer
accounting, the pre-mutation planning record (`structuralRowsRead`, `projectedProviderRows`,
`amplifiedRemainingRows`, `mutationRowsRead`, `remainingStructuralRows`, `amplification`, `reserve`,
`historicalObservations`, `currentHeads`, `changed`), the cumulative and last-call figures, and the
stored-call array bound to the production D1 call ceiling.

**Security.** The snapshot still holds only non-negative safe integers, bounded numeric planning
constants and closed enums. The three threshold values are reviewed repository constants, so adding
them introduces no new class of content. No SQL text, bound parameter, request URL, account id,
database id, account fingerprint, token, response body or returned row can reach it. The PR #215
identifier protections and the discard-the-original-error behaviour at every protected boundary are
untouched, and no Cloudflare credential or permission changes.

## What is deliberately unchanged

`PROVIDER_READ_AMPLIFICATION = 1.35`, `PROVIDER_READ_SAFETY_RESERVE = 2000`,
`ROUTINE_MUTATION_READ_AMPLIFICATION`, `estimateRoutineMutationRowsRead`,
`projectProviderCycleRowsRead` and `estimateStructuralCycleRowsRead` are all untouched. The
projection model is not recalibrated from theory here; the first attended live collection is what
will replace inferred factors with measured ones.

`MAX_D1_ROWS_WRITTEN_PER_CYCLE = 40000`, `MAX_D1_API_CALLS_PER_CYCLE = 8`,
`RESUME_MAX_D1_API_CALLS = 5`, `MAX_ROUTINE_CHANGED_OBSERVATIONS_PER_RUN = 4000` and
`MAX_OFFICIAL_RESPONSE_BYTES` are unchanged. The write estimator is unchanged.

No SQL constant changed: `HEADS_SQL`, `POSTFLIGHT_SQL`, the population statements and the
governance and run reads are byte-identical, and the O(N) current-head re-plan merged in PR #223
stands exactly as it was. No `EXPLAIN` contract changed. The migration set remains exactly
0001–0003 with five indexes; **migration 0004 was not created and no index was added**. That no
query-plan test needed touching is itself evidence the package stayed inside its scope.

`PRODUCTION_COLLECTION_SCHEDULE` and the scheduled workflow's single `17 1 * * *` cron are
unchanged, the scheduled workflow still declares no `workflow_dispatch`, and the workflow remains
owner-disabled.

## Capacity, stated honestly

Against the Cloudflare Workers Free daily allowance — **5,000,000 rows read per day**, **100,000
rows written per day**, resetting at 00:00 UTC, and hard-failing since Cloudflare began enforcing
those limits on 1 September 2026 — a 250,000-row per-cycle hard ceiling is **5.0%** of the daily
read allowance for the one approved cycle a day. The internal breaker stays far tighter than the
provider quota, which is the relationship it is supposed to have.

**LIMITATION — this is an operating envelope, not proof that collection works.** No production
collection has been run under it. One attended manual production collection, while the scheduler
stays disabled, is still required before any claim about restored collection capability.

**LIMITATION — 1.35 and 2,000 remain INFERRED** from a single measured sample. They are pinned in
tests so a later recalibration is one visible change.

**LIMITATION — no season-long capacity guarantee is claimed.** The structural model carries a `2H`
term over an append-only history, so per-cycle cost grows with cumulative observations. How long
this envelope lasts depends on the average number of changed observations per collection, which has
exactly one measurement (264, on 4 September 2026). Whether a query, index or validation-architecture
change is later warranted is a separate owner decision that should be informed by per-statement
telemetry from a first instrumented production validation, not by theory.

**LIMITATION — GitHub schedule-delivery lateness is a separate matter.** The observed delays of
approximately 3h21m and 4h31m on the two natural scheduled runs are upstream of everything this
package touches, and nothing here addresses or is affected by them.

## Explicitly not done

No D1 request of any kind. No production collection. No manual collection dispatch. No scheduled
collection. No Stage 0 re-run. No scheduler re-enable. No cron or cadence change. No SQL change. No
query-plan change. No `EXPLAIN` contract change. No migration 0004. No new index. No schema change.
No projection-factor change. No write or API ceiling change. No integrity-contract change. No
provider or data semantic change. No application, model or FPL calculation change. No merge.
