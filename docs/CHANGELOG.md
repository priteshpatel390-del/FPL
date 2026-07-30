# CHANGELOG.md
Purpose: professional change record (Keep a Changelog conventions). Audience: all.
Last updated: 2026-07-30. Related: STAGE_HISTORY.md and stage item records for engineering detail.

## [Stage 10.3] — 2026-07-30 — Metrics
### Added
- Immutable, correction-aware `gameweekEvaluation` and frozen `transferHorizonEvaluation` records.
- Player-points MAE, RMSE, bias, Pearson, Spearman, means, coverage and approved error bands.
- Player–fixture minutes MAE/RMSE/bias, within-15/30 rates and Brier/reliability for start, appearance and 60 minutes.
- P10–P90/P25–P75 coverage and width plus Brier/reliability for blank, return, haul and mega-haul events.
- Legal frozen-XI automatic substitutions, goalkeeper handling, captain fallback, bench contribution, frozen alternatives and labelled hindsight oracle.
- Frozen optimiser-plan evaluation against the exact zero-transfer baseline over the stored horizon.
- Compressed, hash-verified and journal-protected metric storage with bounded correction revisions.
- Mobile-first Metrics reporting under More → Deadline evidence with coverage and sample warnings.
- `metrics.test.mjs` and `metrics-storage.test.mjs`.

### Changed
- The deterministic bundle now includes the metric evidence and UI modules.
- Complete/corrected outcomes can be evaluated automatically when their exact official snapshot remains available.
- Provider-state safeguards require both 100 observations and five affected Gameweeks.
- Realised transfer net gain subtracts hits but treats optimiser roll value as frozen planning context rather than realised FPL points.

### Verification
- Verified source `3eaae862b8a8277e450af062ff4bcecd15b12f3f`: **397/397 tests passed**, zero failures and zero skipped.
- Production build succeeded; two exact-identity builds were byte-identical.
- `dist/index.html`, `dist/app.bundle.js` and `dist/manifest.json` matched across builds; root `index.html` matched `dist/index.html`.
- Generated artefacts committed at `8c4b60a367b9858146b42ff8710d888856462c21`.

### Unchanged
- No projection, expected-minutes, scoring, calibration, fixture, uncertainty, captaincy, best-XI, squad-selection or transfer-optimiser formula or threshold changed.
- No new provider, database, serverless service, Google Sheets authentication, composite score, significance claim, actual-transfer inference or automatic model update.
- Prospective model validation remains in progress.

### Status
- Merged through PR #32 at `2c703be2ccebc9bd0c4d782ad07b5324b1ed0997` after owner approval.