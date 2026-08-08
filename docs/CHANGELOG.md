# CHANGELOG.md

Purpose: high-level change record. Current operational status lives in `PROJECT_CONTEXT.md`; detailed acceptance and merge evidence is indexed in `HISTORICAL_RECORDS.md`. Last reconciled: 8 August 2026.

## 2026-08-08 — Refresh-Load R1 prepared for draft review

- Made the separate minute-history cache revision-aware: matching schema/model/season, validated rows, unchanged checked-fixture identity and a seven-day correction backstop now suppress repeated requests.
- Loads only missing/due histories with the active squad first, stops a systemic outage after two failed four-player batches and never advances successful timestamps on failure.
- Added validated normalised Understat persistence with completed-match/24-hour cadence and six-hour failure cooldown; raw HTML is never stored and the parser is unchanged.
- Added validated key-free derived Odds persistence with hourly refresh inside 48 hours, six-hour refresh otherwise, six-hour maximum model use and secret-free failure cooldowns.
- Manual Load Data and explicit optional-source changes bypass provider cooldowns; Provider Health separates detailed-minute cache age/use from core Official FPL freshness.
- Added 12 focused acquisition/cache/security tests. Exact source `ac02aca03e3de0fe72e83a332b14abfbe0848a6d` passes 679/679 without changing a model or golden expectation; two stamped production builds are byte-identical, root equals deployable and manifest identity is exact. Remote and physical-device gates remain pending before merge.

## 2026-08-08 — Safe Hygiene A2 merged

- Removed obsolete 75-line `tools/split.py`, declaration-only `reviewRound`, `reviewSegmentValue` and provider-registry `scale`, unused transport `BASE` plus its export, and four unused imports — an exact 85-line net source/tool reduction.
- Reconciled the merged PR #94/667-test status and corrected the remaining Blueprint navigation sentence without changing historical decisions.
- Exact source commit `ed4517900caaf26d711bccf66bbe3459e574fd5b` passed 667/667 tests; focused affected-area coverage passed 143/143.
- Two exact-source builds were byte-identical, root/deployable equality passed and manifest identity matched; generated outputs were produced only by `build.mjs`.
- Connector-created PR #95 head `c1ebd7610b9a81f893457b8bb1bb41316de80dc0` preserved the verified tree, passed permanent run `31256999867` and merged at `2eee62b77291af06552e3d1952b6e1a6355ca7e0`.
- No provider behaviour, data source, formula, route, navigation, state, persistence, Cloudflare, security boundary, UI or golden expectation changed.

## 2026-08-08 — Repository Truth A1 merged

- PR #94 merged at `cdc3cb709d97b858f29234678e7860baab918b78` from exact remote head `1a8af48c96a4aa5ed9d856061be7e95e98f1b3d4`.
- Reconciled canonical status, added a maintainer README and complete historical-record index, assigned unique decision/limitation IDs and added three documentation-integrity tests.
- Permanent Verify Teamsheet run `31255585665` passed 667 tests — the unchanged 664 application tests plus the three new guidance checks — with deterministic double builds, root/deployable equality and exact manifest identity.
- Changed no application behaviour, generated deployable, provider, calculation or infrastructure.

## 2026-08-08 — Leagues pre-season acceptance recorded

- PR #93 merged at `931a3aa8ba54ef45e30056e3e1e03d8b6a443497` and added `LEAGUES-PRESEASON-ACCEPTANCE.md` only.
- Recorded physical iPhone Safari acceptance of the all-league hub, selection/switching, primary persistence, navigation, honest pre-season standings/exposure states and Official FPL-versus-manual management.
- Deferred published rank, populated standings/gaps, real rival comparisons/exposure and relevant pagination until post-Gameweek Official FPL data exists.
- Changed no application source, generated deployable, provider, calculation or infrastructure.

## 2026-08-08 — Official FPL League management clarified

- PR #92 merged at `6f0501ffc0aff368f9a60aae6de0d552ec2c44a5` from exact reviewed head `130b0a298d4b21c2758e3199b9a82e2e3b0fc58f`.
- Distinguished connected Official FPL memberships from manually added leagues and withheld misleading Remove controls where membership is official or cannot be verified.
- Preserved the hub-first League architecture, targeted standings, explicitly loaded rivals, providers and every football calculation.
- Permanent Verify Teamsheet run `31247061412` passed 664 tests plus deterministic double-build, root/deployable equality and exact manifest-identity checks.

## 2026-08-07 — Team and Fixtures populated acceptance completed

- Team follow-ups merged through PR #83 and passed the recorded startup, availability, reserve-goalkeeper and outfield-bench iPhone checks.
- Fixtures follow-ups merged through PR #86 and passed horizontal-scroll and remaining-season/GW38 iPhone checks.
- No prediction, provider, transfer, rank or Mini-League strategy formula changed.

## 2026-08-06 — Transfers Track A correction: exact search architecture (historical pre-merge entry)

- Recorded the first physical iPhone Safari failure honestly: the automatic exact six-Gameweek search exhausted the unchanged 2,000,000 evaluation ceiling and reported "Exact search did not complete."
- Rebuilt the exact search around position-quota score prefix sums, zero placeholders for unfilled incoming slots, per-formation and node-aware admissible bounds, price-capped optimistic completion tables, a joint-budget price cap and descending identity-gain stopping rules.
- Materialised canonical transfers, plan signatures and per-Gameweek best-XI detail only for genuine contenders or exact ties.
- Left the football problem untouched: no projection, minutes, scoring, fixture, captaincy, affordability, hit, free-transfer, roll-value, comparator or ordering change, no candidate filter, and no change to the six-Gameweek default, Top 8, depth three or the 2,000,000 ceiling.
- Kept `exhaustiveTransferSearch()` independent and free of the new pruning, and added controlled-pool differential coverage across seven adversarial shapes plus an Official-scale completion and fail-closed suite.
- A Node reproduction of the failure shape that previously took 13 minutes 38 seconds over 9,480,866 partial nodes now completes in about 1.2 seconds over 880,555 nodes, and a head-to-head run of both implementations on that input returned identical complete top-8 results.
- At this interim point, verification was **606 passed, 0 failed, 0 skipped** with deterministic exact-identity builds and root/deployable equality. PR #70 was then draft and device retest remained required; the later integrated entry records successful merge and physical acceptance.

## 2026-08-05 — FPL-T1 live gateway deployment review (historical pre-merge entry)
- Deployed the owner-controlled allowlisted Cloudflare Worker and configured the exact production `/fpl` base in Teamsheet.
- Verified live 2026/27 Official FPL bootstrap JSON on physical iPhone Safari.
- Rejected every upstream redirect explicitly, retained credential-free requests and added redacted observability plus deployment/CSP contracts.
- At this interim point, verification was **547 passed, 0 failed, 0 skipped** with deterministic exact-identity builds and root/deployable equality. PR #69 was then draft; the later integrated entry records its merge and tested transport/Transfers acceptance.

## 2026-08-02 — Teamsheet 2.0.3: Transfers Decision Workspace

- Replaced the wide transfer table with mobile decision cards.
- Made the zero-transfer baseline, hits, FT utility and affordability limits explicit.
- Added synchronized persisted transfer assumptions and corrected display limits to 8/15/20.
- Repaired Team preview navigation through the central router.
- Removed the stale isolated-swap renderer.
- Added automated presentation, validation, routing and build contracts.
- Left all transfer/model/provider/security calculations unchanged.

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

## 2026-08-02 — Teamsheet 2.0.4 Mini Leagues (historical implementation-branch entry)
- Replaced the sampled effective-ownership report with an Official FPL Mini-League foundation.
- Added primary/saved leagues, deterministic legacy migration and minimal selected/pinned rival persistence.
- Added ID-free League landing, standings, rival and manage routes.
- Added official position/movement, points gaps, targeted/incremental standings and one-selected-rival public picks comparison.
- Removed automatic top-N squad fan-out and unsupported threat/differential strategy wording.
- Added strict displayed-field validation, stale/incomplete states and mobile/accessibility contracts.
- Applied the owner-approved compact mobile hierarchy, added breathing room below the position card and made standings rows full-row touch/keyboard actions with a quiet `Open ›` affordance.
- No provider, model, rank-prediction, strategy, Team or Transfers calculation changed.
- At this checkpoint the source suite was 493/493 and device acceptance remained pending. Later PRs #90–#93 established the hub-first pre-season path and its physical acceptance; populated post-Gameweek evidence remains deferred.


## 2026-08-05 — Teamsheet 2.0.7 merged

- Implemented final mobile semantic controls, touch targets, route/focus/scroll restoration, restricted states, Ask resilience, Fixture render isolation, table semantics and wording precision.
- Preserved model `2.4.0`, rules `2026-27.3`, providers, calculations, deterministic build and advisory/no-write boundaries.
- Corrected iPhone Safari foreground resume so unsuccessful loads respect the automatic cooldown and background refreshes do not freeze interaction.
- PR #68 merged at `2f7e4ba6978ccd68e9d6c36b56d4063cea06beaf`; the Safari resume retest passed.
- VoiceOver is not a project acceptance gate. Later feature-specific iPhone evidence is recorded in the relevant acceptance records rather than reopening 2.0.7.
- FPL-T1 owner-controlled Official FPL gateway work followed as a separate approved checkpoint without calculation changes.

<!-- TRANSFERS-TRACK-A-2026-08-06 -->
## 2026-08-06 — Transfers Track A implemented for review (historical pre-acceptance entry)

- Replaced normal manual Calculate/Recalculate flow with automatic exact calculation after a complete legal squad and valid assumptions exist.
- Added one app-scoped worker controller that continues across internal navigation and restores current progress or an unchanged completed result.
- Restricted cancellation/restart to material input/data changes, explicit cancellation, superseding work and the page-session boundary.
- Preserved the complete eligible player universe, zero-transfer baseline, 0–3 depth, six-Gameweek default, two-million evaluation ceiling, selling-price/hit/free-transfer/roll formulas, comparator and ordering.
- Added exact performance preparation: player score matrices, outgoing-core reuse, lower-allocation exact XI totals, retained-plan-only materialisation, promising branch order and conservative safe bounds.
- Retained the independent exhaustive search as the differential oracle and added exactness, position/enabler and persistent-controller tests.
- Verified 594 passed, 0 failed, 0 skipped with byte-identical exact-identity builds and root/deployable equality.
- No model, rules, provider, data-source, Cloudflare, captaincy, bench, Mini-League or rank logic changed. Physical iPhone performance acceptance was open at this interim point and later passed, as recorded in the integrated entry.

## 2026-08-06 — Concurrent continuation reconciliation

### Reconciled
- Retained Claude's corrected exact position-pool and budget-bound search architecture.
- Settled cancelled and superseded Worker waits to release old in-session calculation chains.
- Made partial signature bounds universally optimistic for mixed-width player IDs.

### Verification
- 609 tests pass with zero failures or skips.
- Existing independent exhaustive-oracle and Official-scale coverage remains intact.
- Deterministic production builds and root/deployable equality retained.
- Physical iPhone Safari retest was pending at this interim point and subsequently passed on the integrated Track A path.

## 2026-08-06 — Transfers plain-language zero-hit copy

- Replaced confusing **“−0”** transfer-cost output with **“No hit”** across baseline cards, plan summaries and review details.
- Added a production-bundle regression that forbids negative-zero hit copy.
- Recorded populated iPhone Safari evidence: six-Gameweek completion in about 15 seconds, navigation persistence, cancellation/restart, app-switch stability and stale-result protection.
- No optimiser, projection, scoring, ranking, candidate or transfer-rule behaviour changed.

## 2026-08-06 — FPL-T1 and Track A integrated

- Merged the approved stack in order: PR #69 (`00a35bacd2396a125a8a914bff9980b4f18b257f`), PR #70 (`78b2729c51419a36c5e6f757fa54830100b5435c`), PR #72 (`be742e1eb707b3892f6405adf5d8769e084eee65`).
- Confirmed final `main` has the identical tree `3794e8e7ab9859717950296766dc9d64c9e5473f` as the verified PR #72 head.
- Preserved the 613-test deterministic-build evidence and recorded populated iPhone Safari acceptance for the tested Transfers lifecycle and final **No hit** wording.
- No Track B intelligence, provider expansion, prediction formula or accuracy claim was introduced.
