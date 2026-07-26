# CHANGELOG.md
Purpose: professional change record (Keep a Changelog conventions). Audience: all.
Last updated: 2026-07-26. Related: STAGE_HISTORY.md for engineering detail.

## [2.0.0-docs] — 2026-07-26 (documentation stage)
### Added
- /docs system (12 documents) + root CLAUDE.md onboarding; repository declared source of truth.
### Fixed
- Misleading resilience-test title (duplicate fixtures ARE double-counted on malformed feeds —
  pinned limitation; dedupe proposed in STAGE3-DESIGN).

## [2.0.0] — 2026-07-26 (Stage 2)
### Added
- ES-module architecture (17 modules), deterministic bundler, dist/manifest.json + BUILD_INFO.
- Provider registry: six-attribute quality descriptors + runtime health marks.
- Odds provider provenance (event id, kickoff, fetchedAt, books, markets, confidence), devig,
  median outlier rejection, staleness cut, thin-market inclusion rules (ODDS_RULES, config-defined),
  fixture matching by teams + kickoff proximity.
- Pure computeBacktest with prediction provenance (modelVersion, rulesVersion, dataset ref,
  predictedAt); versioned cache envelope; escapeHTML helper; unit (direct-import) + resilience suites.
### Changed
- slim() retains fixture id, kickoff_time, started, provisional_start_time.
### Security
- SEC-1 (shipped as prior hot-fix, re-verified post-extraction): odds key direct-only, never relayed.
### Known issues
- See KNOWN_LIMITATIONS.md (BT-1 pinning, SEC-2 serverless deferral, CSP-1 pending, DUP-1 etc.).

## [1.x] — 2026-07-26 (pre-refactor product evolution, single conversation)
### Added
- Fixture ticker (attack/defence/official lenses, swings, blanks/doubles); per-position projected-
  points engine with tap-through breakdowns; squad review with best-XI/captaincy; transfer planner
  with −4 maths; multi-mini-league effective-ownership comparison; manual squad builder; saved
  leagues; Understat team layer; bookmaker-odds layer; on-device backtest vs 2025-26 (r=0.80,
  ±0.5/GW — aggregate method, see D-11) with per-position calibration; persistence hardening
  (save-on-input); cached-data fallback; deadline countdown.
### Fixed
- Availability discount not applied to attacking returns; bonus over-projection; settings lost on
  failed load; capitalised Index.html deployment 404.
