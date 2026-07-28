# CHANGELOG.md
Purpose: professional change record (Keep a Changelog conventions). Audience: all.
Last updated: 2026-07-28. Related: STAGE_HISTORY.md for engineering detail.

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
### Verification and merge
- 220/220 tests passing and deterministic two-build comparison passed.
- Merged through PR #8 at `eb08c7af43a2e8040ea65064fc725ba8d1778882`.

## [Stage 3 complete] — 2026-07-28 — Security and provider hardening
### Added
- Fixture validation and deduplication, per-endpoint schema validation and atomic hydration.
- Bounded transient-only retries with provider-specific ceilings and metadata.
