# Stage 10.3 — Metrics

Status: **implemented on `agent/stage10-3-metrics`; final verification and owner review pending.** Approved by Pritesh on 29 July 2026.

Related: `STAGE10-DESIGN.md`, `STAGE10-ITEM1.md`, `STAGE10-ITEM2.md`, `PROJECTION_MODEL.md`, `TESTING.md`, `KNOWN_LIMITATIONS.md`.

## Objective

Evaluate the immutable Stage 10.1 pre-deadline prediction record against authoritative Stage 10.2 Official FPL outcomes without recreating historical predictions, changing any production formula or presenting hindsight as a recommendation.

Stage 10.3 is descriptive evidence infrastructure. It does not establish that Teamsheet is accurate or calibrated, and it does not update the model.

## Delivered scope

- Immutable, correction-aware `gameweekEvaluation` records linked by exact snapshot and outcome hashes.
- Player-points MAE, RMSE, prediction-minus-outcome bias, predicted and observed means, Pearson correlation, average-rank Spearman correlation, coverage and approved absolute-error bands.
- Fixture-opportunity minutes MAE, RMSE, bias, within-15 and within-30-minute rates.
- Brier scores and fixed-decile reliability summaries for starting, appearing and reaching 60 minutes.
- P10–P90 and P25–P75 coverage and width.
- Brier and reliability evaluation for the unchanged production blank, return, haul and mega-haul events.
- Frozen Teamsheet XI evaluation using legal goalkeeper and ordered outfield automatic substitutions.
- Exhaustive frozen legal-XI alternatives and a prominently labelled descriptive hindsight oracle from the same frozen 15-player squad.
- Captain/vice fallback, top-three frozen candidate comparison and descriptive hindsight comparison.
- Bench order, automatic-substitution contribution and signed points left on unused bench players.
- Immutable `transferHorizonEvaluation` records comparing frozen optimiser plans with the mandatory frozen zero-transfer baseline over the exact stored horizon.
- Gross transfer gain and net gain after actual frozen points hits; the optimiser's judgement-based roll value remains context only and is not treated as realised FPL points.
- Bounded, compressed and journal-protected local metric storage with immutable superseded correction revisions.
- Mobile-first descriptive reporting under More → Deadline evidence → Metrics.

## Exact player-points contract

For prediction `p`, observed Official FPL points `y` and error `e = p - y`:

- MAE = mean `|e|`.
- RMSE = square root of mean `e²`.
- Bias = mean `e`; positive values mean Teamsheet overpredicted.
- Pearson uses paired frozen prediction and observed points and is `null` below three observations or where either side has zero variance.
- Spearman assigns average ranks to ties, then applies Pearson to those ranks.
- Predicted and observed means use the same matched observation set.

The prediction field is `outputs.players[].nextGameweek.total`. The observed field is `allPlayerOutcomes.records[].totalPoints`. Simulation mean is not substituted for the production deterministic prediction.

Approved absolute-error bands are:

- exact: 0;
- small: greater than 0 and up to 2;
- material: greater than 2 and up to 5;
- large: greater than 5 and up to 10;
- very large: greater than 10.

Blank, single and double Gameweeks remain separate segments. A schedule-aligned view is available beside realised results so post-deadline fixture changes do not silently distort interpretation.

## Minutes and probability contract

The observation unit is a player–fixture opportunity because `pStart`, `pAppear`, `p60` and `expMin` are per-fixture estimates.

Observed labels are:

- started: Official FPL per-fixture `starts > 0`;
- appeared: Official FPL per-fixture `minutes > 0`;
- reached 60: Official FPL per-fixture `minutes >= 60`.

Start Brier excludes rows where Official FPL supplies no start fact. Starts are never inferred from minutes.

For doubles, per-fixture official values are used. A missing assigned fixture is filled with zero only where the available per-fixture values reconcile exactly to the official aggregate. Otherwise the minute observation is labelled unallocatable and excluded from the continuous/probability denominator while player-points evaluation remains available.

Unused substitutes are zero-minute non-appearances. A zero-minute row with contradictory event facts is treated as an anomaly rather than manufactured into an appearance. Abandoned or unresolved fixtures remain provisional upstream and cannot enter authoritative metrics.

Brier score is mean `(probability - outcome)²`. Reliability uses fixed `[0.0,0.1)` through `[0.9,1.0]` bins. Bins below 30 observations retain counts but suppress observed-frequency interpretation.

## Uncertainty contract

Intervals use inclusive bounds:

- P10–P90 coverage = share of observed points inside `[P10,P90]`;
- P25–P75 coverage = share inside `[P25,P75]`;
- width = mean upper minus lower percentile.

Stage 10.3 evaluates the exact unchanged production event definitions:

- blank: points `<= 2`;
- return: points `>= 5`;
- haul: points `>= 10`;
- mega-haul: points `>= 15`.

These thresholds are observed, not modified.

## Squad, captain and bench contract

The frozen Teamsheet XI is evaluated from stored player IDs and positions. The reserve goalkeeper is processed separately. Outfield bench players enter in frozen order only where the resulting formation retains one goalkeeper, at least three defenders, at least two midfielders and at least one forward. A Double Gameweek player who appeared in either fixture blocks an automatic substitution.

All legal XIs from the same frozen 15-player squad are enumerated. The top three frozen alternatives are ranked by the stored pre-deadline projection. The descriptive oracle is the highest realised legal base-points XI from that same frozen squad, excluding captain doubling, chips and transfers. It is always labelled `Hindsight oracle`.

Captaincy applies normal captain-to-vice fallback. Alternative captain candidates are drawn only from the frozen selected XI and retain a deterministic frozen vice rule. Retrospective comparisons remain descriptive and never produce a replacement recommendation.

Points left on the bench are the signed Official FPL points of frozen bench players who did not enter through automatic substitutions. Negative bench points are retained.

Where public manager outcomes exist, official picks, multipliers, chips and automatic substitutions are reconstructed and cross-checked. Missing or conflicting manager facts make only the manager section partial; global player metrics remain available.

## Transfer contract

Stage 10.3 evaluates frozen optimiser plans, not inferred actual transfers. Stage 10.2 stores manager transfer count and cost but deliberately does not persist actual transfer identities.

Each frozen plan is compared with its frozen zero-transfer baseline across the exact stored horizon:

- gross gain = realised plan base points minus realised zero-transfer base points;
- net gain after hits = gross gain minus the plan's frozen hit cost.

Captain doubling and chips are excluded because they are not part of the optimiser objective. The production optimiser's 0.5-point roll value remains unchanged and is shown only as frozen planning context, not as realised FPL points. A horizon remains in progress until every required Gameweek has an authoritative evaluation. Missing player outcomes fail the affected horizon closed rather than being treated as a non-appearance.

## Matching and revisions

An official evaluation requires:

- a complete, locally captured and officially eligible Stage 10.1 snapshot;
- a complete or corrected Stage 10.2 outcome;
- exact season, Gameweek and deadline identity;
- exact linked snapshot ID and content hash;
- matching anonymous manager reference;
- unique numeric Official FPL player IDs;
- consistent official fixture IDs, Gameweek and teams.

Recovery-only, late, incomplete, deadline-mismatched or invalid snapshots produce no official metric. Provisional outcomes produce no authoritative metric. Corrected outcomes append a new immutable evaluation revision and supersede the current pointer without rewriting the earlier record. Identical source data creates no duplicate metric revision.

The metric engine consumes only stored snapshot values. It does not import or execute `projectXP`, `minutesEstimate`, `simulatePlayerGameweek` or `optimiseTransfers`, preventing post-deadline recomputation leakage.

## Segmentation

Supported descriptive segments include:

- all and schedule-aligned players;
- owned, frozen selected XI and bench;
- primary transfer-in and transfer-out;
- position and approved position-aware frozen-price band;
- expected-minutes source and confidence;
- provider state;
- home, away, mixed and blank;
- frozen FDR pattern;
- blank, single and double Gameweek;
- frozen availability;
- observed starter/substitute role;
- approved season period.

The interface exposes one primary segment at a time. Arbitrary multi-dimensional subgroup mining and a composite accuracy score remain excluded.

Approved season periods are pre-season, early GW1–6, transition GW7–12 and mature GW13–38.

Approved position-aware price bands are:

- GKP/DEF: up to £4.4m, £4.5m–£5.4m, £5.5m+;
- MID: up to £5.4m, £5.5m–£7.4m, £7.5m–£9.9m, £10.0m+;
- FWD: up to £5.4m, £5.5m–£7.4m, £7.5m–£9.4m, £9.5m+.

## Sample safeguards

- Fewer than 30 observations: raw-only with a very-small-sample warning.
- 30–199: descriptive only.
- 200 or more across at least ten Gameweeks: potentially stable descriptive sample.
- Probability-bin observed frequency requires at least 30 observations.
- Preferred probability sample is 500 observations across at least ten Gameweeks.
- Captain and transfer aggregates require ten relevant decisions.
- Provider-state comparison requires both 100 observations and five affected Gameweeks.

No stage uses good/bad accuracy colouring, statistical significance, confidence intervals or a validated/calibrated claim. Clustered resampling, multiple-comparison control and formal inference require a separately approved future scope.

## Storage and presentation

Metric records reuse the native browser storage and compression helpers. Writes are reloaded and hash-verified, an interrupted-write journal supports recovery, current revisions are retained, six superseded full revisions are bounded, and the encoded target is 3 MiB. Storage failures are surfaced.

The interface displays player, minutes and uncertainty summaries, coverage/missingness, latest frozen decision outcomes and completed frozen transfer horizons. Early samples display explicit warnings. The Metrics surface does not alter the Team, Players or Transfers recommendations.

Stage 10.3 does not add CSV, season bundles, Google Sheets integration or external publication; those remain Stage 10.4 concerns.

## Tests

New focused suites cover:

- exact MAE, RMSE, bias, Pearson and Spearman calculations;
- zero error, signed bias, ties and zero-variance correlation;
- error-band and price-band boundaries;
- Brier scores, reliability-bin boundaries and inclusive interval coverage;
- sample-size warning boundaries and the provider-state AND safeguard;
- missing starts, singles, doubles, unallocatable minutes and postponed fixtures;
- legal formations, goalkeeper substitutions, ordered automatic substitutions and captain fallback;
- authoritative joins, invalid/provisional rejection, correction revisions, tamper detection and non-mutation;
- schedule and ownership segmentation;
- zero-transfer baseline, points hits, frozen horizon completion and missing-player failure;
- verified storage, deduplication, journals, correction retention, bounds, quota failure and deletion isolation;
- approved public metric field names;
- static proof that the metric engine does not invoke production model functions.

Final completion requires the full `./run-tests.sh`, successful production build, byte-identical exact-identity rebuild, root/deployable equality and documentation closeout. The exact verified source, generated commit and test count will be recorded after that final run.

## Explicit exclusions

No production projection, expected-minutes, scoring, calibration, fixture, uncertainty, captaincy, best-XI, squad-selection or transfer-optimiser formula changes. No new provider, database, serverless service, Google Sheets authentication, FPL write action, composite score, automatic model update, actual-transfer identity inference, formal significance work or Stage 10.4 export workflow.

## Limitations

- Prospective sample size begins near zero.
- Blank zeroes can flatter all-player metrics, so schedule-aligned and fixture-class segments remain visible.
- Provider-state comparisons are observational and clustered by Gameweek.
- Start facts and Double Gameweek per-fixture minutes can have lower coverage than points.
- Manager outcomes remain optional.
- Actual transfer identities cannot be evaluated from the approved Stage 10.2 record.
- Schedule changes require careful realised versus schedule-aligned interpretation.
- Local browser storage remains recovery rather than a permanent archive.
- The historical r=0.80 result remains method-flattered and is not a live validation benchmark.
