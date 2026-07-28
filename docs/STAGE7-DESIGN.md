# Stage 7 — Walk-Forward Backtest

Status: **APPROVED for implementation on 2026-07-28**.

## Outcome

Replace the method-flattered half-season calibration report with a deterministic, deadline-information-only walk-forward evaluation framework. Stage 7 measures honest holdout performance; it does not claim that the model has improved and it does not silently change production formulas.

## Existing behaviour

`computeBacktest()` currently builds first-half per-90 profiles, uses each player's real second-half minutes, projects the whole second half under an average fixture, evaluates and derives position calibration on the same sample. This is useful as a scoring diagnostic but is not out-of-sample validation. It leaks future minutes and fits calibration against the period it reports.

## Approved scope

1. Add pure walk-forward fold construction with strict chronological train, calibration and holdout separation.
2. Validate and normalise historical observations without manufacturing missing values.
3. Reject future information at every fold boundary.
4. Calculate deterministic MAE, RMSE, bias and Pearson correlation with explicit sample counts.
5. Report position and prediction-band segments where samples exist.
6. Support isolated named ablations supplied as prediction variants; no provider or formula is changed by the evaluator.
7. Pin every evaluated dataset through immutable provenance: season, source commit/ref and SHA-256 checksum.
8. Count malformed archive rows instead of silently losing them.
9. Represent unavailable historical odds as `not_available`, never as reconstructed data.
10. Emit stable machine-readable results suitable for committed fixtures and UI presentation.
11. Preserve the legacy diagnostic only as clearly labelled legacy output until the production replay adapter supplies full deadline snapshots.

## Walk-forward protocol

The engine consumes observations shaped as:

```js
{
  playerId, position, gameweek, predicted, actual,
  informationGameweek, variant
}
```

`informationGameweek` is the latest Gameweek whose information contributed to the prediction. For a holdout at Gameweek `H`, every accepted prediction must satisfy `informationGameweek < H`.

Default folds use:

- minimum training Gameweeks: 8
- calibration window: 4 Gameweeks
- holdout window: 1 Gameweek
- step: 1 Gameweek

For holdout Gameweek `H`:

- training Gameweeks end before the calibration window;
- calibration Gameweeks immediately precede `H`;
- holdout contains only `H`;
- no row from `H` or later may influence train or calibration inputs.

The first eligible holdout therefore requires at least 12 completed prior Gameweeks. Configuration is explicit and included in provenance.

## Calibration policy

Stage 7 evaluates two separate variants where data is supplied:

- `raw`: the prediction as produced before any fold-specific correction;
- `fold_calibrated`: a correction fitted only on that fold's calibration rows.

The evaluator includes a bounded multiplicative position calibration helper. It may be used by the replay adapter only within each fold. It does not update `S.calib`, production configuration or persisted application calibration.

## Metrics

Primary metrics:

- MAE — average absolute player/Gameweek error;
- RMSE — penalises large misses;
- bias — signed mean predicted minus actual;
- sample count and coverage.

Secondary metric:

- Pearson correlation, reported only with at least three non-degenerate observations.

Segments:

- position;
- configured predicted-points bands;
- holdout Gameweek;
- named ablation variant.

No single metric is treated as proof of future accuracy.

## Dataset pinning

A dataset is considered pinned only when provenance includes:

- a season;
- an immutable source reference or commit SHA;
- a 64-character lowercase SHA-256 checksum;
- row counts and malformed-row counts.

Branch names such as `master` or `main` alone are not immutable and must fail the pin check. The fetch adapter must use a commit-addressed archive URL before Stage 7 results are described as reproducible.

## Ablations

The evaluator accepts already-generated prediction variants and compares them on identical holdout keys. Initial approved labels are:

- `fpl_only`;
- `understat_blend`;
- `existing_calibration`;
- `fold_calibrated`;
- `minutes_aggregate`;
- `minutes_detailed`;
- `odds_blend` only for genuinely pre-deadline logged snapshots.

Stage 7 does not introduce a provider, alter an existing weight or fabricate historical odds.

## Failure behaviour

Fail closed when:

- dataset provenance is not pinned for a reproducible run;
- observations contain non-finite prediction/actual values;
- duplicate player/Gameweek/variant keys conflict;
- a prediction uses information from its own or a later Gameweek;
- fold configuration is impossible;
- fewer than the configured minimum holdout observations exist.

Malformed raw rows may be dropped only when counted and surfaced in provenance.

## Tests

Tests must cover:

- fold chronology and exact window boundaries;
- explicit rejection of future-information leakage;
- deterministic metric calculations;
- position and band segmentation;
- bounded train-only calibration;
- identical-key ablation comparison;
- dataset pin validation and checksum format;
- duplicate/conflicting observation handling;
- deterministic serialisation;
- insufficient-data and malformed-input failure paths;
- absence of odds represented explicitly rather than inferred.

## Explicit exclusions

- No expected-minutes formula change.
- No scoring, fixture, calibration, captaincy or optimiser formula change.
- No change to Understat or odds blend weights.
- No new provider.
- No Stage 8 uncertainty simulation.
- No Stage 9 UI redesign.
- No prediction-improvement claim.

## Acceptance bar

Stage 7 is complete only when the pure engine, replay adapter and presentation are covered by the full suite; the production build succeeds; two builds with the same exact `BUILD_COMMIT` are byte-identical; generated artefacts carry matching identity; documentation records the dataset pin and remaining coverage limits; and a draft pull request is open for owner review.