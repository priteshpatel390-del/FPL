# Stage 10.3 — Metrics

Status: **complete and merged through PR #32 at `2c703be2ccebc9bd0c4d782ad07b5324b1ed0997`.** Approved by Pritesh on 30 July 2026.

Related: `STAGE10-DESIGN.md`, `STAGE10-ITEM1.md`, `STAGE10-ITEM2.md`, `PROJECTION_MODEL.md`, `TESTING.md`, `KNOWN_LIMITATIONS.md`.

## Objective

Evaluate the immutable Stage 10.1 pre-deadline record against authoritative Stage 10.2 Official FPL outcomes without recreating historical predictions, changing any production formula or presenting hindsight as a recommendation.

Stage 10.3 is descriptive evidence infrastructure. It does not establish that Teamsheet is accurate or calibrated and it does not update the model.

## Delivered scope

- Immutable, correction-aware `gameweekEvaluation` records linked by exact snapshot and outcome identities and hashes.
- Player-points MAE, RMSE, prediction-minus-outcome bias, predicted/observed means, Pearson, average-rank Spearman, coverage and approved error bands.
- Player–fixture minutes MAE, RMSE, bias, within-15 and within-30-minute rates.
- Brier scores and fixed-decile reliability summaries for starting, appearing and reaching 60 minutes.
- P10–P90 and P25–P75 coverage and width plus Brier/reliability for the unchanged blank, return, haul and mega-haul events.
- Frozen Teamsheet XI evaluation with legal goalkeeper and ordered outfield automatic substitutions.
- Exhaustive frozen legal-XI alternatives and a prominently labelled descriptive hindsight oracle from the same frozen 15-player squad.
- Captain/vice fallback, top-three frozen candidate comparison and descriptive hindsight comparison.
- Bench order, automatic-substitution contribution and signed points left on unused bench players.
- Immutable `transferHorizonEvaluation` records comparing frozen optimiser plans with the mandatory frozen zero-transfer baseline over the exact stored horizon.
- Gross transfer gain and net gain after frozen points hits; the optimiser roll value remains context only and is not treated as realised FPL points.
- Bounded compressed local metric storage with verified writes, interrupted-write journal, current revision pointers and six retained superseded full revisions.
- Mobile-first descriptive reporting under More → Deadline evidence → Metrics.

## Exact contracts

For frozen prediction `p`, observed Official FPL points `y` and error `e = p - y`:

- MAE is mean `|e|`.
- RMSE is square root of mean `e²`.
- Bias is mean `e`; positive values mean Teamsheet overpredicted.
- Pearson is `null` below three observations or where either side has zero variance.
- Spearman assigns average ranks to ties and applies Pearson to those ranks.

The points prediction field is `outputs.players[].nextGameweek.total`; the observed field is `allPlayerOutcomes.records[].totalPoints`. Simulation mean is not substituted for the production deterministic prediction.

Approved absolute-error bands are exact `0`, small `>0–2`, material `>2–5`, large `>5–10` and very large `>10`.

Minutes use player–fixture opportunities because `pStart`, `pAppear`, `p60` and `expMin` are per-fixture estimates. Starts are included only when Official FPL supplies an official start fact; they are never inferred from minutes. For doubles, a missing fixture is filled with zero only when the available per-fixture data reconciles exactly to the official aggregate. Otherwise that minutes row is unallocatable while the player-points row remains usable.

Brier score is mean `(probability - outcome)²`. Reliability uses `[0.0,0.1)` through `[0.9,1.0]` bins. Bins below 30 observations retain counts but suppress observed-frequency interpretation.

Interval coverage uses inclusive bounds. Uncertainty evaluates the exact unchanged production events: blank `<=2`, return `>=5`, haul `>=10`, mega-haul `>=15`.

The descriptive oracle is the highest realised legal base-points XI from the same frozen 15-player squad. It excludes captain doubling, chips and transfers and is always labelled `Hindsight oracle`.

Frozen transfer gross gain is realised plan base points minus realised zero-transfer base points. Net gain after hits subtracts the plan's frozen hit cost. Captaincy, chips and the judgement-based roll-value term are excluded from realised transfer gain.

## Matching and leakage controls

An official evaluation requires a complete, locally captured and officially eligible Stage 10.1 snapshot; a complete or corrected Stage 10.2 outcome; exact season, Gameweek, deadline, snapshot ID, snapshot hash and anonymous manager-reference agreement; and unique Official FPL player/fixture identities.

Recovery-only, late, incomplete, deadline-mismatched or invalid snapshots produce no official metric. Provisional outcomes produce no authoritative metric. Corrected outcomes append a new immutable evaluation revision and supersede the current pointer without rewriting the earlier record. Identical source data creates no duplicate metric revision.

The metric engine consumes only stored snapshot values. It does not import or execute `projectXP`, `minutesEstimate`, `simulatePlayerGameweek` or `optimiseTransfers`, preventing post-deadline recomputation leakage.

## Segmentation and safeguards

Supported descriptive segments include all/schedule-aligned players, ownership and frozen role, primary transfer in/out, position, approved position-aware frozen-price band, expected-minutes source/confidence, provider state, venue/FDR context, blank/single/double Gameweek, frozen availability, observed role and approved season period.

The interface exposes one primary segment at a time. Arbitrary subgroup cross-products and a composite accuracy score remain excluded.

Sample language is fixed:

- fewer than 30 observations: raw-only warning;
- 30–199: descriptive;
- 200+ across at least ten Gameweeks: potentially stable descriptive sample;
- probability bins require 30 observations;
- captain/transfer aggregates require ten decisions;
- provider-state comparison requires both 100 observations and five affected Gameweeks.

No significance, confidence interval, validated-accuracy or calibrated-probability claim is made.

## Verification

- Verified source commit: `3eaae862b8a8277e450af062ff4bcecd15b12f3f`.
- Full `./run-tests.sh`: **397/397 passing**, zero failures, zero skipped.
- Production build succeeded.
- Two builds with the exact verified source identity were byte-identical.
- `dist/index.html`, `dist/app.bundle.js` and `dist/manifest.json` matched across builds.
- Root `index.html` matched `dist/index.html` exactly.
- Manifest and deployable embed source commit `3eaae862b8a8277e450af062ff4bcecd15b12f3f`.
- Verified generated artefacts commit: `8c4b60a367b9858146b42ff8710d888856462c21`.
- Merge commit: `2c703be2ccebc9bd0c4d782ad07b5324b1ed0997`.
- Existing model and characterisation tests were not weakened or regenerated.

## Files changed

- `src/evidence/metrics.mjs`
- `src/ui/metrics.mjs`
- `tests/metrics.test.mjs`
- `tests/metrics-storage.test.mjs`
- `build.mjs`
- generated `dist/app.bundle.js`, `dist/manifest.json`, `dist/index.html` and root `index.html`
- affected canonical documentation.

## Deliberately unchanged

No projection, expected-minutes, scoring, calibration, fixture, uncertainty, captaincy, best-XI, squad-selection or transfer-optimiser formula changed. No provider, database, serverless service, Google Sheets authentication, FPL write action, composite score, automatic model update, actual-transfer identity inference, formal significance work or Stage 10.4 export workflow was added.

## Remaining limitations

- Prospective sample size begins near zero.
- Blank zeroes can flatter all-player results; schedule-aligned and fixture-class segments must be read alongside them.
- Provider-state comparisons are observational and clustered by Gameweek.
- Starts and Double Gameweek per-fixture minutes can have lower coverage than points.
- Manager outcomes remain optional.
- Actual transfer identities cannot be evaluated from the approved Stage 10.2 record.
- Local browser storage remains recovery rather than a permanent archive.
- The historical r=0.80 result remains method-flattered and is not a live validation benchmark.

## Next checkpoint

Stage 10.4 — Operating review/export remains a separate future scope. Investigation and exact-scope approval must happen before implementation.