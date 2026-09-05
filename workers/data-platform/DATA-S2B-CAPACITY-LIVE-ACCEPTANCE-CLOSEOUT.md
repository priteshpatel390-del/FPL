# DATA-S2B — capacity restoration live acceptance closeout

**Verdict: PASS.** The first attended production collection under the restored capacity envelope
completed successfully, with a clean postflight state and provider accounting comfortably inside
every threshold.

This record is documentation and evidence only. Preparing it performed **no** Cloudflare request, D1
read, D1 mutation, Official FPL collection, workflow dispatch, re-run, migration, index, schema,
threshold, cron, scheduler, deployment, environment or credential change.

## Baseline

* `main` at acceptance: **`2ef79bf961eb22d9d86d75e99abe9ca769aebcf8`** — the merge of PR #224.
* Exact-`main` Verify: **Verify Teamsheet #611**, run `33989822673`, event `push`, head
  `2ef79bf961eb22d9d86d75e99abe9ca769aebcf8`, conclusion **success**.
* Capacity envelope in force: **EXPECTED 150,000 / SOFT 200,000 / HARD 250,000**.

## How the two packages relate

**PR #223 corrected the model. PR #224 resized the envelope. The order is the justification**, and
this run is the first measurement of the result.

1. Scheduled run `33948145320` (5 September) committed production state and then failed
   `production_d1_budget_exceeded` in phase `postflight_read`, with
   `productionMutation: 'definite_completed'`. The postflight read ran; postflight validation did
   not. The owner disabled the scheduled workflow.
2. Stage 0 — workflow `DATA-S2B Committed Run Integrity` (workflow `350897195`), run
   `33966125991`, event `workflow_dispatch`, head `bfcac663f4bfb02274843caa8d4332d8622f68d7`,
   conclusion **success** — proved that committed state satisfies the existing production postflight
   contract. That runner rethrows for every classification other than `COMMITTED_STATE_VALID`, and
   it was read-only: one D1 call, `rows_written` required to be exactly zero.
3. **PR #223** corrected the pre-mutation read model (explicit mutation-read estimator, INFERRED
   provider amplification 1.35 and a 2,000-row reserve, a predictive soft gate separated from the
   hard breaker), added bounded per-call and per-statement telemetry, and re-planned current-head
   retrieval from O(H) to O(N).
4. **PR #224** resized the envelope to three distinct thresholds and pointed the predictive gate at
   SOFT rather than at the hard ceiling.
5. Verify #611 passed on the exact merge commit.
6. **This run** then completed a real production cycle under that envelope.

## The run

| | |
|---|---|
| Workflow | `DATA-S2 Production Collection via D1 REST` (workflow `348625053`) |
| Run | `33990959542`, run number 3, attempt 1 |
| Event | `workflow_dispatch` (attended, owner-approved) |
| Head SHA | `2ef79bf961eb22d9d86d75e99abe9ca769aebcf8` |
| Conclusion | **success** — both `repository-gate` and `collect` |
| Production step | `Reconfirm identity and remote main, then collect Official FPL to D1 REST` — success |

Because `runProductionCollection` returns only after its synchronous postflight has validated the
exact completed run, the `collect` job's success is itself proof that postflight validation ran and
passed. That is the specific thing run `33948145320` never reached.

The scheduled workflow was **not** used and was **not** enabled. It remained `disabled_manually`
throughout.

## Measured result

Owner-supplied from the run's GitHub Step Summary. Exact provider `meta` reaches only the Step
Summary and is not retrievable through the GitHub API available to this repository's tooling, so
these figures are recorded as reported. Every one of them has been independently reconciled against
the repository's own models and against the per-call breakdown — see **Reconciliation** below.

**Outcome**

| Field | Value |
|---|---|
| `result` | `changed` |
| `mutation` | `definite_completed` |
| `changed` | 141 |
| `recordsSeen` | 10,157 |

**Committed state**

| Field | Value |
|---|---|
| `status` | `completed` |
| `runObservations` | 141 |
| `observations` | 11,278 |
| `heads` | 10,157 |
| `logicalKeys` | 10,157 |
| `orphanHeads` | **0** |
| `quarantined` | **0** |
| `rejected` | **0** |

**Population and planning**

| Field | Value |
|---|---|
| `historicalObservations` (H) | 11,137 |
| `currentHeads` (N) | 10,146 |
| `changed` (D) | 141 |
| `structuralRowsRead` | 93,924 |
| `readClassification` | `expected` |
| `remainingStructuralRows` | 42,139 |
| `mutationRowsRead` | 1,266 |
| `amplifiedRemainingRows` | 58,597 |
| `projectedProviderRows` | 121,902 |
| `projectedReadClassification` | `expected` |
| `providerReadAmplification` | 1.35 |
| `providerReadReserve` | 2,000 |

**Provider accounting**

| Field | Value |
|---|---|
| `apiCalls` | 6 |
| `rowsRead` | **113,352** |
| `rowsWritten` | 1,005 |
| `readClassification` | `expected` |
| `requestBytes` | 209,511 |
| `storedCalls` | 6 |
| `lastCallRowsRead` / `lastCallRowsWritten` / `lastCallRequestBytes` | 51,351 / 0 / 1,612 |

**Envelope carried in the snapshot**

`rowsReadExpected` 150,000 · `rowsReadSoft` 200,000 · `rowsReadHard` 250,000 · `rowsWritten` 40,000 ·
`apiCalls` 8 · `requestBytes` 16,777,216 · `storedCalls` 8 · `statementsPerCall` 40.

## Per-call telemetry

The first per-call and per-statement production measurement this repository has ever held. It is
what PR #223's Stage 2 was built for.

| Call | Kind | rowsRead | rowsWritten | requestBytes | What it is |
|---|---|---|---|---|---|
| 1 | read | 3 | 0 | 320 | governance |
| 2 | read | 0 | 0 | 370 | run read (no prior row) |
| 3 | read | 61,302 | 0 | 508 | current heads + both population counts |
| 4 | mutation | 0 | 3 | 622 | start ledger row |
| 5 | mutation | 696 | 1,002 | 206,079 | commit batch |
| 6 | read | 51,351 | 0 | 1,612 | postflight |

**Call 3, per statement:** 40,019 (`HEADS_SQL`) + 11,137 (observation population) + 10,146 (head
population) = 61,302.

**Call 5, per statement:** 1 read / 3 written / 1 change (entity insert) · 423 / 705 / 141
(observations) · 271 / 293 / 141 (heads) · 1 / 1 / 1 (completion).

## Reconciliation — every figure reconstructs from the repository's own models

This is not transcription. Each reported number was recomputed from the merged code and the
per-call breakdown, and each matched exactly.

* **Structural model.** `2H + 7N + 4D + 64` at H = 11,137, N = 10,146, D = 141 gives exactly
  **93,924**.
* **Postflight term.** `(H + D) + 3(N + D)` gives exactly **42,139**.
* **Mutation-read model.** `newHeads = 10,157 − 10,146 = 11`, `updatedHeads = 141 − 11 = 130`, and
  `mutationRowsRead = 1,266` implies exactly **one** fresh canonical entity — which the commit
  batch's own first statement confirms (3 rows written = one entity insert).
* **Projection.** Rows billed before the gate were 3 + 0 + 61,302 = **61,305**, and
  `61,305 + ceil((42,139 + 1,266) × 1.35) + 2,000 = 61,305 + 58,597 + 2,000 = 121,902` — the
  reported figure exactly.
* **Totals.** The six per-call figures sum to exactly 113,352 rows read, 1,005 rows written and
  209,511 request bytes.
* **Write model, matched exactly for a second time, now including the head split.** The commit
  estimate `3×1 + 5×141 + 3×11 + 2×130 + 1 = 1,002` equals call 5's measured `rowsWritten`, and the
  heads statement's `3×11 + 2×130 = 293` equals its measured written rows. Adding the start row's 3
  gives the reported 1,005. This is a fact about the write model on a second sample; it remains
  **not** evidence of any particular Cloudflare per-index billing law, and it is not generalised
  into one.

## Projection versus actual

| | |
|---|---|
| Projected provider rows | 121,902 |
| Actual provider rows | 113,352 |
| Projection − actual | **8,550** |

The projection was **conservative** — it over-predicted, which is the safe direction and the
direction it was designed to err in.

State the two percentages against their own denominators and do not mix them:

* 8,550 / 113,352 ≈ **7.54%** above actual;
* 8,550 / 121,902 ≈ **7.01%** of the projected value.

**Headroom**

| Against | Value |
|---|---|
| Hard ceiling 250,000 − 113,352 actual | **136,648** |
| Hard-envelope utilisation | 113,352 / 250,000 ≈ **45.34%** |
| Expected band 150,000 − 113,352 actual | 36,648 |
| Soft threshold 200,000 − 121,902 projected | 78,098 |
| Write ceiling 40,000 − 1,005 | 38,995 |
| API-call ceiling 8 − 6 | 2 |

**The 150,000 / 200,000 / 250,000 envelope did not bind this cycle at any point.** Both the
projection and the actual accounting classified `expected`, the lowest band.

## What the per-statement measurement shows, and what it does not

These are first observations from **one** sample. They are recorded because they are what a future
optimisation decision would rest on. They are not a recalibration and nothing is changed on their
basis.

* **The population counts billed exactly their structural cost** — 11,137 rows for the observation
  count and 10,146 for the head count, precisely H and N. That accounting is **consistent with** the
  index-only plans the repository's `EXPLAIN` contracts already enforce for both statements. It is
  not independent proof of the physical plan: provider `rowsRead` reports how many rows were billed,
  not which access path SQLite chose, and a different plan that happened to touch the same number of
  rows would bill the same. The plan itself is established by the `EXPLAIN` contract, and this
  measurement agrees with it.
* **`HEADS_SQL` billed 40,019 against a structural 3N = 30,438**, a ratio of about 1.315.
* **The postflight billed 51,351 against a structural 42,139**, a ratio of about 1.219.
* **The commit's mutation reads were 696 against a modelled 1,266** — the mutation-read model
  over-predicted by roughly a factor of 1.8, again in the conservative direction.
* **Whole-cycle actual over structural was 113,352 / 93,924 ≈ 1.2068**, below the 1.35 planning
  assumption. It is **not** comparable with the 1.311944 measured on 4 September: that run executed
  the superseded O(H) current-head plan, and this one executes the O(N) plan.
* An earlier design hypothesis — that every non-covering index probe costs one extra row visit —
  would have predicted roughly 5N ≈ 50,730 for `HEADS_SQL` and about 73,991 for the postflight.
  Both measured figures are materially lower, so that hypothesis is **over-pessimistic** as stated.
  **These measurements weaken the earlier pessimistic upper-bound case for migration 0004, but they
  do not measure the counterfactual savings of a covering index.** This cycle executed the current
  plan, not an indexed one; no covering-index plan has ever been run, so no saving figure — larger
  or smaller — is established by it. Sizing that saving would need its own evidence. No schema
  change is proposed here.

**Correct summary: the first instrumented live sample supports the current conservative projection
assumptions.** It does **not** prove the provider amplification correct, and the model is **not**
calibrated. One sample is not a distribution, and `PROVIDER_READ_AMPLIFICATION = 1.35`,
`PROVIDER_READ_SAFETY_RESERVE = 2000` and `ROUTINE_MUTATION_READ_AMPLIFICATION` are all unchanged.

## State integrity

`orphanHeads`, `quarantined` and `rejected` were each **0**; `heads` equalled `logicalKeys` at
10,157; `runObservations` equalled `changed` at 141; `status` was `completed`. Observations grew
from 11,137 to 11,278, exactly the 141 appended, and heads grew from 10,146 to 10,157, exactly the
11 new logical keys — the append-only history behaved as designed.

## Verdict, and its exact scope

**The DATA-S2B capacity-restoration live acceptance is PASS.** This closes the immediate D1
capacity-restoration incident that began with scheduled run `33948145320`.

It does **not** prove:

* **season-long capacity** — the structural model carries a `2H` term over an append-only history,
  so per-cycle cost grows with cumulative observations; how long this envelope lasts depends on the
  average changed-observation count per collection, which now has two measurements (264 and 141) and
  no distribution;
* **exact future provider billing** — Cloudflare's accounting for a future cycle depends on that
  cycle's own population, changed-observation count and Official FPL state of the day;
* **GitHub schedule reliability** — see below;
* **that 1.35 and 2,000 are optimal** — they remain INFERRED, deliberately pessimistic, and
  unchanged;
* **that no later optimisation will ever be needed.**

## Scheduler, and the separate scheduling question

The permanent repository cron is unchanged at **`17 1 * * *`**, and the scheduled workflow
`350014371` was verified through the GitHub Actions API during this closeout as still
**`disabled_manually`**. This closeout does not enable it, and re-enabling it is a separate owner
gate.

**GitHub schedule delivery is best-effort and is a separate, unresolved matter.** The cron minute is
an opportunity, never a guaranteed collection instant: the two natural scheduled runs to date were
created approximately **3h21m** (4 September) and **4h31m** (5 September) after their nominal
minutes. Those delays are upstream of every resource threshold in this record and are neither
addressed nor affected by capacity acceptance. Re-enabling the scheduler means accepting that
documented timing limitation.

## Explicitly not done in this closeout

No production collection. No workflow dispatch or re-run. No D1 request, read or mutation. No
Official FPL collection. No scheduler enable. No cron change. No threshold change. No SQL, query
plan or `EXPLAIN` contract change. No migration (still exactly 0001–0003, five indexes, no migration
0004) and no index. No schema or data semantic change. No projection-factor recalibration. No write,
API-call or request-byte ceiling change. No postflight weakening. No application, model or FPL
calculation change. No merge.
