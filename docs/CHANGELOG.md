# CHANGELOG.md
Purpose: professional change record (Keep a Changelog conventions). Audience: all.
Last updated: 2026-07-29. Related: STAGE_HISTORY.md and stage item records for engineering detail.

## [Stage 10.3] — 2026-07-29 — Metrics
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
- Implemented on `agent/stage10-3-metrics`; draft PR #32 awaits owner review and explicit merge approval.

## [Stage 10.2] — 2026-07-29 — Official outcome collection
### Added
- Automatic Official FPL player, fixture and optional manager outcome collection after app access.
- Immutable provisional, complete and corrected revisions with deterministic section/data/content hashes.
- Strict duplicate-player and conflicting-fixture quarantine, official `data_checked` finalisation and correction monitoring.
- Bounded compressed storage, interrupted-write recovery, complete JSON export/restore and recovery-only imports.
- Focused outcome collection/storage suites.

### Verification
- Verified source `e84e7f1bf05ed1f3e574f78101e4a6e413273306`: **376/376 tests passed** with deterministic exact-identity builds.
- Generated artefacts `9d81210b493ab40a542c50709733b14e448a481c`.

### Unchanged
- No model formula, calibration, provider blend, captaincy, squad or optimiser change.

### Status
- Merged through PR #29 at `4b1b2acf9bda81afb63414dd41b509e80b3945c7` after owner approval.

## [Stage 10.1] — 2026-07-29 — Deadline-safe snapshot foundation
### Added
- Immutable anonymised pre-deadline evidence with official deadline timing, network-clock grades, deterministic whole-record/section hashes and verified JSON import/export.
- All-player projections, expected minutes, live uncertainty summaries, provider/source provenance and available squad/decision/optimiser evidence.
- Silent startup/foreground verification, one complete render and automatic eligible evidence capture.
- Bounded compressed local recovery with export/restore/delete controls.

### Changed
- Approved providers settle before one final render; no intermediate mixed dataset is exposed.
- Monte Carlo invariant fixture components are reused while the approved 5,000 samples and output distribution remain unchanged.

### Verification
- Verified source `eb3497ec405d6c7b8ce09105614fcb8280abc34b`: **349/349 tests passed** with deterministic exact-identity builds.
- Generated artefacts `1259e7b5f7505d3330c772e89c77720251552287`.
- Physical iPhone acceptance passed.

### Unchanged
- No projection, expected-minutes, scoring, fixture, simulation distribution, captaincy, squad, provider blend, calibration or optimiser objective changed.

### Status
- Merged through PR #27 at `da76c81f552fd9da5c518e73ccc0fbe966c74444`.

## [Stage 9.6] — 2026-07-29 — Style migration, CSP and final UI polish
- Replaced source/generated style attributes and runtime style APIs with classes, progress and SVG attributes.
- Removed `style-src-attr` and every `unsafe-inline` token from emitted CSP.
- Verified source `4a4b14c1d0f422088c080e714ee259efbd7cc39d`: **313/313 tests passed** with deterministic builds.
- Merged through PR #25 at `c52f6f08f51bff5bfe7702bfec58265647afe439`.

## [Stage 9.1–9.5] — 2026-07-28 to 2026-07-29 — Mobile application integration
- Added the four-destination app shell, football pitch, repository-owned shirts, player detail, uncertainty presentation, temporary decision previews, Settings and global/full Provider Health.
- Preserved existing recommendation/model behaviour and session-only preview boundaries.
- Merged through PRs #17, #18, #20, #23 and #24. Detailed commits and verification are recorded in `ROADMAP.md` and `STAGE_HISTORY.md`.

## [Stage 8] — 2026-07-28 — Uncertainty and squad simulation
- Added deterministic seeded player uncertainty and legal squad simulation with automatic substitutions and captain fallback.
- Disabled detailed pre-season simulation rather than presenting false precision.
- Verified **284/284 tests**; merged through PR #16.

## [Stage 7] — 2026-07-28 — Walk-forward backtest
- Added chronological train/calibration/holdout folds, fold-only calibration and pinned historical replay.
- Replaced in-sample validation claims with explicit deadline-safe limitations.
- Verified **274/274 tests**; merged through PR #15.

## [Stage 6] — 2026-07-28 — Transfer optimiser
- Added exact 0–3 transfer plans, mandatory zero-transfer baseline, legality, affordability, hits and deterministic ordering.
- Verified **254/254 tests**; merged through PR #14.

## [Stage 5] — 2026-07-28 — Scoring corrections
- Implemented official stepped scoring expectations, genuine blank/double handling and explicit judgement-based priors.
- Verified **241/241 tests**; merged through PR #9.

## [Stage 4] — 2026-07-28 — Expected-minutes model
- Replaced current-GW denominators with completed-team fixtures and detailed recency/shrinkage histories.
- Verified **220/220 tests**; merged through PR #8.

## [Stages 1–3.6] — 2026-07-26 to 2026-07-28 — Audit, modularisation, providers and security
- Characterised the application, established deterministic ES-module builds and repository documentation.
- Added provider validation, fixture deduplication, bounded retry, Provider Health, direct-only odds-key protection, restricted Markdown, text-node rendering and deterministic CSP.
- Detailed records, alternatives and exact commits remain in `DECISIONS.md`, `STAGE_HISTORY.md` and the stage design documents.
