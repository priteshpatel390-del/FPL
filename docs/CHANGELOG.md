# CHANGELOG.md

## 2026-08-06 — Transfers Track A correction: exact search architecture

- Recorded the first physical iPhone Safari failure honestly: the automatic exact six-Gameweek search exhausted the unchanged 2,000,000 evaluation ceiling and reported "Exact search did not complete."
- Rebuilt the exact search around position-quota score prefix sums, zero placeholders for unfilled incoming slots, per-formation and node-aware admissible bounds, price-capped optimistic completion tables, a joint-budget price cap and descending identity-gain stopping rules.
- Materialised canonical transfers, plan signatures and per-Gameweek best-XI detail only for genuine contenders or exact ties.
- Left the football problem untouched: no projection, minutes, scoring, fixture, captaincy, affordability, hit, free-transfer, roll-value, comparator or ordering change, no candidate filter, and no change to the six-Gameweek default, Top 8, depth three or the 2,000,000 ceiling.
- Kept `exhaustiveTransferSearch()` independent and free of the new pruning, and added controlled-pool differential coverage across seven adversarial shapes plus an Official-scale completion and fail-closed suite.
- A Node reproduction of the failure shape that previously took 13 minutes 38 seconds over 9,480,866 partial nodes now completes in about 1.2 seconds over 880,555 nodes, and a head-to-head run of both implementations on that input returned identical complete top-8 results.
- Verified **606 passed, 0 failed, 0 skipped**, deterministic exact-identity builds and root/deployable equality. PR #70 remains draft and unmerged, and physical iPhone Safari retest remains required.

## 2026-08-05 — FPL-T1 live gateway deployment review
- Deployed the owner-controlled allowlisted Cloudflare Worker and configured the exact production `/fpl` base in Teamsheet.
- Verified live 2026/27 Official FPL bootstrap JSON on physical iPhone Safari.
- Rejected every upstream redirect explicitly, retained credential-free requests and added redacted observability plus deployment/CSP contracts.
- Verified **547 passed, 0 failed, 0 skipped**, deterministic exact-identity builds and root/deployable equality. Full populated application acceptance remains pending; PR #69 is draft and unmerged.

## 2026-08-02 — Teamsheet 2.0.3: Transfers Decision Workspace

- Replaced the wide transfer table with mobile decision cards.
- Made the zero-transfer baseline, hits, FT utility and affordability limits explicit.
- Added synchronized persisted transfer assumptions and corrected display limits to 8/15/20.
- Repaired Team preview navigation through the central router.
- Removed the stale isolated-swap renderer.
- Added automated presentation, validation, routing and build contracts.
- Left all transfer/model/provider/security calculations unchanged.
Purpose: professional change record (Keep a Changelog conventions). Audience: all.
Last updated: 2026-07-30. Related: STAGE_HISTORY.md and stage item records for engineering detail.

## 2026-07-30 — Teamsheet 2.0 Product Blueprint integration
- Added the owner-approved canonical `TEAMSHEET2-PRODUCT-BLUEPRINT.md`.
- Recorded Teamsheet as a team-first, decision-first, explainable and mobile-first FPL product centred on the complete 15-player squad.
- Approved future primary navigation as Team, Transfers, Mini Leagues and Settings; More is replaced by Settings and Players leaves primary navigation.
- Defined the approved Settings sections, Team and Transfers decision questions, global/private Mini-League vision and progressive-disclosure UX standards.
- Recorded migration checkpoints Teamsheet 2.0.1–2.0.7, each requiring separate design, approval, testing, review and deployment.
- Updated onboarding, project context, architecture reference, decisions, roadmap, limitations and stage history.
- Clarified that the blueprint supersedes Stage 9 information architecture for future development while preserving Stage 9 engineering and historical records.
- No application, generated deployable, formula, optimiser, provider, evidence, security or Mini-League calculation changed. Teamsheet 2.0.1 implementation was not started.

## 2026-07-30 — Stage 10.5 hardening and documentation
- Added transactional snapshot recovery and consistent outcome/metric journal reconciliation.
- Added strict import/version/object-key validation, safer diagnostics and stronger spreadsheet-formula protection.
- Added bounded visible-page deadline retry, honest download wording and phone-first live-season/disaster-recovery guidance.
- Verified source `0302c54e3eb1d77657b3d892bebb33c90438fa92` with **428/428 tests passed**, zero failures and zero skipped, plus deterministic exact-identity builds.
- Generated artefacts `421e532629cbd1b82b19b3ea349ab23571221f00` embed source hash `3efb94912e21be8ee8aaa29b4834d992c485e36ed9c70e9a8e88fbbe5f598a40`.
- Merged through PR #45 at `0605ba5a02c49a5b599eba1ed00c443fa1889c92` after owner approval. Physical iPhone acceptance was not independently recorded.
- No production formula, provider, backend, automatic Google Sheets or later-stage behaviour changed; prospective validation remains in progress.

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
## 2026-07-30 — Stage 10.4 operating review/export
- Implemented downstream weekly and cumulative operating review from exact Stage 10.1–10.3 evidence.
- Added deterministic hash-verifiable JSON, descriptive Markdown and eight individual RFC 4180 CSV exports.
- Added explicit correction/pruning/missing-record handling, schedule-aligned views, transfer-horizon pending rules and provider/revision audit.
- Added spreadsheet-formula protection, manager-reference boundaries, 10/25 MiB size policy and manual-only live Google Sheets boundary.
- Added phone-first UI under Deadline evidence and 16 tests, bringing the verified suite to **413/413 passed**.
- Verified source `1eca9a8817da41597d0632c819142237d31627fb` and generated artefacts `1af7dac5383c91e915587218e7551c2f619cec8f` with byte-identical rebuilds. Merged through PR #35 at `6a96096cfa59fd3476aa89c191cc8ca6400d358b` after owner approval.

## 2026-07-31 — Teamsheet 2.0.2 Team decision home

- Reordered Team around an immediate connected or placeholder football pitch.
- Added explicit squad/data provenance, XI/captain/bench recommendation, base-XI plus captain forecast, one material risk and advisory deadline action.
- Moved setup/resources and captaincy/all-15 detail behind the immediate decision hierarchy.
- Removed unsupported no-transfer and protect/rank-climbing wording.
- Preserved all model, provider, preview, route, persistence and security contracts.
- Verified **454/454 tests**, deterministic exact-identity builds and root/deployable equality.

## 2026-08-02 — Teamsheet 2.0.4 Mini Leagues (implementation branch)
- Replaced the sampled effective-ownership report with an Official FPL Mini-League foundation.
- Added primary/saved leagues, deterministic legacy migration and minimal selected/pinned rival persistence.
- Added ID-free League landing, standings, rival and manage routes.
- Added official position/movement, points gaps, targeted/incremental standings and one-selected-rival public picks comparison.
- Removed automatic top-N squad fan-out and unsupported threat/differential strategy wording.
- Added strict displayed-field validation, stale/incomplete states and mobile/accessibility contracts.
- Applied the owner-approved compact mobile hierarchy, added breathing room below the position card and made standings rows full-row touch/keyboard actions with a quiet `Open ›` affordance.
- No provider, model, rank-prediction, strategy, Team or Transfers calculation changed.
- Current source suite: 493/493 passing tests; exact build finalisation and device acceptance pending.


## Unreleased — Teamsheet 2.0.7

- Implemented final mobile semantic controls, touch targets, route/focus/scroll restoration, restricted states, Ask resilience, Fixture render isolation, table semantics and wording precision.
- Preserved model `2.4.0`, rules `2026-27.3`, providers, calculations, deterministic build and advisory/no-write boundaries.
- Physical iPhone Safari, VoiceOver and live populated-data acceptance remain pending.

- Corrected iPhone Safari foreground resume so unsuccessful loads respect the automatic cooldown and background refreshes do not freeze interaction; physical-device retest remains pending.
- 2026-08-05: PR #68 merged Teamsheet 2.0.7 at `2f7e4ba6978ccd68e9d6c36b56d4063cea06beaf`; Safari resume retest passed. FPL-T1 owner-controlled Official FPL gateway approved and implementation started without calculation changes.

<!-- TRANSFERS-TRACK-A-2026-08-06 -->
## 2026-08-06 — Transfers Track A implemented for review

- Replaced normal manual Calculate/Recalculate flow with automatic exact calculation after a complete legal squad and valid assumptions exist.
- Added one app-scoped worker controller that continues across internal navigation and restores current progress or an unchanged completed result.
- Restricted cancellation/restart to material input/data changes, explicit cancellation, superseding work and the page-session boundary.
- Preserved the complete eligible player universe, zero-transfer baseline, 0–3 depth, six-Gameweek default, two-million evaluation ceiling, selling-price/hit/free-transfer/roll formulas, comparator and ordering.
- Added exact performance preparation: player score matrices, outgoing-core reuse, lower-allocation exact XI totals, retained-plan-only materialisation, promising branch order and conservative safe bounds.
- Retained the independent exhaustive search as the differential oracle and added exactness, position/enabler and persistent-controller tests.
- Verified 594 passed, 0 failed, 0 skipped with byte-identical exact-identity builds and root/deployable equality.
- No model, rules, provider, data-source, Cloudflare, captaincy, bench, Mini-League or rank logic changed. Physical iPhone performance acceptance remains open.
