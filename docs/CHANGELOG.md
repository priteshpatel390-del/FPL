# CHANGELOG.md
Purpose: professional change record (Keep a Changelog conventions). Audience: all.
Last updated: 2026-07-28. Related: STAGE_HISTORY.md for engineering detail.

## [Stage 9.2] — 2026-07-28 — Team pitch and shirts
### Added
- Portrait, mobile-first football pitch for the unchanged model-selected starting XI.
- Repository-owned CSS shirt shapes and deterministic club palettes with safe fallbacks.
- Direct captain and vice-captain badges, compact fixture/xP cards and preserved bench order.
- Four focused tests for formation grouping, captaincy identity and shirt-palette determinism.
### Changed
- The Team surface now leads with projected score, shape, squad value, free transfers and the football-first pitch rather than legacy flat player cards.
- The existing captain ranking and six-Gameweek squad table remain available below the pitch.
### Verification
- Verified source commit `02d59e6e6bbdc0fe9480642d717bfcfa4f9367ad`.
- Full suite: **288/288 passing**.
- Production build succeeded; deterministic two-build comparison and exact build-identity checks passed.
- Verified generated artefacts committed at `372576324b049972b88437540046c3c1f85457d5`.
### Unchanged
- `bestXI()`, bench ordering, projections, expected minutes, scoring, fixtures, simulation, captain ranking, transfer optimisation, providers, storage and security behaviour.
- No official FPL or club artwork and no prediction-accuracy claim.
### Status
- Implemented and verified on draft PR #18; awaiting owner review and explicit merge approval.

## [Stage 9.1] — 2026-07-28 — App shell and primary navigation
### Added
- Four primary destinations: Team, Players, Transfers and More, with Team as the default landing screen.
### Status
- Merged through PR #17 at `9f4333e3f2e8d71d02355389f8c7d2115d3d17e4`.

## [Stage 7] — 2026-07-28 — Walk-forward backtest
### Added
- Deterministic chronological train/calibration/holdout fold engine with future-information rejection.
- MAE, RMSE, bias and Pearson metrics with position, Gameweek, prediction-band and variant segmentation.
- Fold-only bounded position calibration fitted exclusively from each prior calibration window.
- Immutable 2025/26 vaastav archive pin at `f9ed3e8839b0f970e0d5d4a83c5628f6eaee755a` with SHA-256 of exact downloaded bytes.
- Deadline-safe archive replay, double-Gameweek aggregation, malformed-row counting and focused Stage 7 tests.
### Changed
- The visible backtest now presents an honest walk-forward scoring diagnostic rather than the method-flattered H1/H2 calibration report.
- The legacy diagnostic is retained only for regression comparison and no longer applies corrections to production projections.
- Missing historical odds, Understat, detailed expected-minutes inputs and production fixture snapshots are reported as unavailable rather than reconstructed.
### Verification
- Verified source commit `42d3106fcb15f2e68db7409e0ae96fd27cd4f61a`.
- Full suite: **274/274 passing**.
- Production build succeeded; deterministic two-build comparison and build-identity checks passed.
- Verified generated artefacts committed at `d2f1e7d93cf200e5a1d6d1a2d96829e750740ff9`.
### Unchanged
- No production projection, expected-minutes, scoring, fixture, captaincy, squad or transfer-optimiser formula changed.
- No persisted `S.calib` behaviour or provider blend weight changed.
- No prediction-accuracy improvement is claimed.
### Status
- Implemented and verified on draft PR #15; awaiting owner review and explicit merge approval.

## [Stage 5] — 2026-07-28 — Scoring corrections
### Added
- Explicit 2026/27 FPL rule configuration and versioned Stage 5 shrinkage constants.
- Pure Poisson grouped-points, threshold-probability and sparse-rate helpers.
- Explicit red-card, own-goal, penalty-miss and goalkeeper penalty-save projection components.
- Direct build-regression fixtures for single-line and multi-line imports/exports, unterminated declarations and unsupported surviving module syntax.
- Genuine blank-Gameweek and aggregate bonus-appearance regressions.
### Changed
- Saves and goals-conceded now use stepped expected values rather than linear approximations.
- Defensive contributions use the official threshold probability rather than a logistic heuristic.
- Bonus uses awarded bonus per estimated appearance with positional shrinkage and no fixture multiplier.
- Aggregate bonus appearances reuse Stage 4 completed matches × aggregate pAppear.
- Fixture-run ranking removes arbitrary blank/double constants; blanks are zero and doubles add both fixtures.
- Custom bundler strips complete static module declarations and fails closed if unsupported syntax survives.
### Verification
- Verified source commit `aee6d0fee7cc177622a046f37885b554013debbd`.
- Full suite against committed goldens: **241/241 passing**.
- Deterministic two-build comparison and independent CSP recomputation passed.
- Generated artefacts embed the exact verified source identity.
- Temporary verification workflow removed at `99d9cf8184589ef5ed79b8fdad2bff13a9f96552`.
### Unchanged
- No provider, fixture-blend weight, positional calibration, captaincy, squad, transfer optimiser, walk-forward validation, uncertainty simulation or Stage 9 UI behaviour changed.
- No prediction-accuracy improvement is claimed.
### Status
- Merged through PR #9 at `68877333ebf13060e764b82b91dfc0c9752a78c8`.

## [Stage 4] — 2026-07-28 — Expected-minutes model
### Added
- Validated detailed current-season element histories, bounded cache and Provider Health integration.
- pStart, pAppear, p60, expMin and confidence outputs with aggregate/prior fallbacks.
### Changed
- Completed team fixtures replace current-GW denominators.
- Scoring consumes the expected-minutes boundary without inventing separate probabilities.
