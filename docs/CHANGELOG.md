# CHANGELOG.md
Purpose: professional change record (Keep a Changelog conventions). Audience: all.
Last updated: 2026-07-29. Related: STAGE_HISTORY.md for engineering detail.


## [Stage 10.1] — 2026-07-29 — Deadline-safe snapshot foundation (draft)
### Added
- Immutable anonymised pre-deadline evidence with official FPL deadline timing, network-clock grades, deterministic whole-record/section hashes and verified JSON import/export.
- All-player projections, expected minutes, live uncertainty summaries, provider/source provenance and available squad/decision/optimiser evidence.
- Silent minimalist startup verification screen, automatic app-open/foreground refresh, one-shot verified rendering and automatic eligible evidence capture.
- Compact phone-first evidence status plus bounded compressed local recovery with explicit export/restore/delete controls.
- Focused deadline, tamper, privacy, chunking, compression, quota and storage tests.
### Changed
- Startup and foreground refresh now await every approved provider state before one final render; no intermediate mixed dataset is exposed.
- Eligible evidence capture starts automatically after verified data is ready but no longer holds the startup screen open.
- Runtime provider identity is allowlisted; restored JSON is recovery-only and cannot become official evidence.
- Monte Carlo fixture components are precomputed once per player/fixture and summary-only callers omit raw arrays; the approved 5,000 samples and outputs remain unchanged.
- `connect-src` permits same-origin timing evidence; the bundler injects script content through a callback to prevent replacement-string byte corruption.
### Verification
- Verified source `73cdca817f7070a745fb642e1070d77a6bdaca9b`: **349/349 passing**, successful production build, byte-identical two-build output and exact build identity. The generated root `index.html` deployment copy is byte-identical to `dist/index.html`.
- Synthetic 620-player/5,000-sample capture: roughly 2.8–3.5 seconds; canonical JSON about 2.2 MB and local gzip recovery about 153 KB.
- Physical iPhone startup, foreground refresh, automatic capture and recovery-restore acceptance remain the draft-PR gate before merge.
### Unchanged
- No projection, expected-minutes, scoring, fixture, simulation distribution, captaincy, squad, provider blend, calibration or optimiser objective changed.
- No retrospective accuracy or probability-calibration claim.

## [Stage 9.6] — 2026-07-29 — Style migration, CSP and final polish
### Added
- Static utility and club-palette classes replacing fixed and generated style attributes.
- Native progress elements for projection bars and namespace-correct SVG geometry for uncertainty ranges.
- Fail-closed DOM-helper, source, build and deployable guards against style attributes and runtime style APIs.
- Three focused regression additions covering deterministic palette classes and the tightened style/CSP boundary.
### Changed
- Removed `style-src-attr` and every `unsafe-inline` token from the emitted CSP while retaining the exact-hash-locked style element.
- Completed responsive/touch/accessibility polish and representative mobile/desktop browser review with no console errors.
### Verification
- Verified source commit `4a4b14c1d0f422088c080e714ee259efbd7cc39d`.
- Full suite: **313/313 passing**.
- Production build succeeded; deterministic two-build comparison and exact build-identity checks passed.
- Verified generated artefacts committed at `7fb09142156a8061adc375a72bf3d7e2a1b25985`.
- Source and deployed HTML contain zero application-created style attributes.
### Unchanged
- No projection, expected-minutes, scoring, simulation, best-XI, captaincy, optimiser, provider, storage or odds-key behaviour changed.
### Status
- Merged through PR #25 at `c52f6f08f51bff5bfe7702bfec58265647afe439`; Stage 9 is complete.

## [Stage 9.5] — 2026-07-29 — More, Settings and Provider Health
### Added
- Compact globally visible Provider Health status that opens the full detail surface under More.
- Full current-session provider rows showing the existing state, last-success age, note and fallback consequence.
- Six focused tests covering compact age/status modelling, deterministic state priority, palette mapping and shell wiring.
### Changed
- Existing team connection, transfer context and optional provider controls are now clearly presented as Settings under More.
- Provider Health presentation moved out of the legacy setup note without changing its seven-state registry or transitions.
### Verification
- Verified source commit `da8258df25e196af1f1521c025edefde23612abd`.
- Full suite: **310/310 passing**.
- Production build succeeded; deterministic two-build comparison and exact build-identity checks passed.
- Verified generated artefacts committed at `5401f2882f72b70c7034157c2e3a686dab966c64`.
### Unchanged
- No provider state, transport, retry, cache, fallback, odds-key, storage, security or model behaviour changed.
- No inline-style migration or CSP tightening; those remain checkpoint 9.6.
### Status
- Merged through PR #24 at `a5ac5fcc12bb492948365851587d4e1cd2f30301`.

## [Stage 9.4] — 2026-07-28 — Temporary decision previews
### Added
- Session-only transfer-plan previews launched directly from exact optimiser results.
- Temporary captain and vice-captain selection on eligible starting-XI pitch cards.
- Preview-only banners, incoming-player markers, model-versus-preview captaincy comparison and clear/reset actions.
- Nine focused tests covering non-mutation, final-squad identity, role swapping, bench rejection, invalidation, signatures, score separation, accessibility wiring and no persistence.
### Changed
- The Team pitch can render a derived preview squad through the unchanged `bestXI()` while the real squad remains authoritative.
- Optimiser input or result changes and real-squad changes clear stale previews automatically.
### Verification
- Verified source commit `849ff757c68c35e92744dc96efc34848110fa19e`.
- Full suite: **304/304 passing**.
- Production build succeeded; deterministic two-build comparison and exact build-identity checks passed.
- Verified generated artefacts committed at `ed275d2a148d90d09836199f8d1485394d72b6f5`.
### Unchanged
- No projection, expected-minutes, best-XI, captain-ranking, optimiser, provider, storage, security or FPL-account behaviour changed.
- No preview state is persisted or submitted to FPL.
### Status
- Merged through PR #23 at `5e62f2f65d6e21d86ca3f0ef8dd0b7112fd4a8c8`.

## [Stage 9.3] — 2026-07-28 — Player detail and uncertainty
### Added
- Accessible mobile bottom sheet and desktop side panel opened from the pitch, Players table and all-15 squad table.
- Decision summary, expected minutes, start/appearance/60-minute probabilities, confidence/source, compact P25–P75 and expanded P10–P90 ranges.
- Blank, return, haul and mega-haul probabilities with explicit model-conditional wording.
- Owner-approved Tight/Moderate/Wide presentation labels and safeguards for pre-season and reduced-quality inputs.
- Seven focused tests, including exact 2.0/5.0 boundaries, dialog focus/Escape behaviour and official doubtful-status presentation.
### Changed
- Replaced the legacy inline player-table breakdown row while preserving the existing projection component breakdown inside the new detail surface.
- Pitch players and all-15 rows are now keyboard-focusable player-detail triggers.
### Verification
- Verified source commit `40dde666fc776e0fdcf1bab6c8dad30138825d08`.
- Full suite: **295/295 passing**.
- Production build succeeded; deterministic two-build comparison and exact build-identity checks passed.
- Verified generated artefacts committed at `ae7f7f35bd69c17686e776b97d416d4be56ae8df`.
### Unchanged
- No projection, expected-minutes, scoring, fixture, simulation, best-XI, captaincy, bench, transfer-optimiser, provider, storage or security formula/behaviour changed.
- No prediction-accuracy or probability-calibration claim.
### Status
- Merged through PR #20 at `eb636d023bed6706f46f5a03366485ede9b15c89`.

## [Stage 9.2] — 2026-07-28 — Team pitch and shirts
### Added
- Portrait, mobile-first football pitch for the unchanged model-selected starting XI.
- Repository-owned CSS shirt shapes and deterministic club palettes with safe fallbacks.
- Direct captain and vice-captain badges, compact fixture/xP cards and preserved bench order.
- Four focused tests for formation grouping, captaincy identity and shirt-palette determinism.
### Changed
- The Team surface now leads with projected score, shape, squad value, free transfers and the football-first pitch rather than legacy flat player cards.
- The existing captain ranking and six-Gameweek squad table remain available below the pitch.
- On narrow iPhones, the projected score now leads in a full-width card with the three supporting facts in a separate uncluttered row.
### Verification
- Verified source commit `38bb08e2e8f903deeb39dc4e1a4db070da4d4870`.
- Full suite: **288/288 passing**.
- Production build succeeded; deterministic two-build comparison and exact build-identity checks passed.
- Verified generated artefacts committed at `a806ccc0`.
### Unchanged
- `bestXI()`, bench ordering, projections, expected minutes, scoring, fixtures, simulation, captain ranking, transfer optimisation, providers, storage and security behaviour.
- No official FPL or club artwork and no prediction-accuracy claim.
### Status
- Merged through PR #18 at `4cbbe588697845677e6aef5992e15f13f47c6281`.

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
### Verification and merge
- 220/220 tests passing and deterministic two-build comparison passed.
- Merged through PR #8 at `eb08c7af43a2e8040ea65064fc725ba8d1778882`.

## [Stage 3 complete] — 2026-07-28 — Security and provider hardening
### Added
- Fixture validation and deduplication, per-endpoint schema validation and atomic hydration.
- Bounded transient-only retries with provider-specific ceilings and metadata.
- Seven-state Provider Health: Live, Cached, Stale, Fallback, Partial, Disabled and Unavailable.
- Text-node-first DOM rendering for provider/user content and restricted Markdown rendering for AI output.
- Odds-key masking, empty-secret omission, one-action removal and diagnostic scrubbing.
- Deterministic SHA-256 hash-based meta CSP with independent final-HTML verification and a hashed frame-buster.
### Security
- Anthropic browser-key handling was removed.
- Odds traffic remains direct-only; the key is never relayed or exposed in diagnostics.
- Generated deployment files were checked byte-for-byte against the verified build artefact.
- The temporary verification workflow was removed before merge.
### Verification and merge
- Full `./run-tests.sh`: **210/210 passing**.
- Focused final security suite: 8/8 passing.
- Build succeeded and two builds with the same explicit `BUILD_COMMIT` compared byte-for-byte.
- Merged through PR #6 at merge commit `3f662b7e133ce2995da74c5e52165ae84744e120`.
### Unchanged
- No projection, expected-minutes, scoring, calibration, fixture, captaincy, squad or optimisation formula changed.
- No framework, runtime dependency, hosting platform or single-file deployment workflow changed.

## [Stage 3.6] — 2026-07-28 — AI/Markdown sanitisation
### Added
- A bounded, dependency-free restricted-Markdown parser and DOM renderer for the Ask surface.
- Eight adversarial tests covering unsafe schemes, encoded and entity-obscured URLs, hostile HTML-shaped input, permitted block syntax, input bounding and DOM-only rendering invariants.
- `docs/STAGE3-ITEM6.md` implementation and verification record.
### Changed
- Ask responses now render only paragraphs, `##`/`###` headings, unordered lists, bold, italic and absolute HTTP(S) links.
- Approved links open with `target="_blank"` and `rel="noopener noreferrer"`; rejected destinations remain inert visible text.
- The active Ask renderer no longer assigns untrusted AI output to `innerHTML`.
### Unchanged
- No projection, expected-minutes, scoring, calibration, fixture, captaincy, squad, transfer, provider, retry, key-handling, CSP or visual-design behaviour changed. No dependency was added.
### Verification
- Full `./run-tests.sh` passed with 202 tests.
- Deterministic two-build byte comparison passed in GitHub Actions run `30336857903`.
- The temporary verification workflow was removed before merge and is not part of the final product change.

## [Stage 3.5] — 2026-07-28 — DOM-builder rendering
### Added
- A text-node-first `el()` DOM builder and `setChildren()` replacement helper.
- Adversarial DOM tests for hostile player, team, entry, league and provider text.
### Changed
- Every approved Stage 3.5 dynamic rendering surface now uses DOM nodes: gameweek/source/chip status, ticker, players and breakdowns, squad/captaincy, transfers, leagues, manual squad/search and backtest output.
### Unchanged
- Ask Markdown rendering remains at the Stage 3.4 baseline; its separate sanitisation design is deferred to Stage 3.6. No model, provider, key handling, CSP, formula or visual redesign changed.
### Verification and merge
- Recorded implementation result: 194/194 tests passing and deterministic builds green.
- Merged through PR #3 at merge commit `5623abb594159916b4041e6bd3c44be80f714ce7`.
- No GitHub Actions run is attached to the merge; the test/build result is implementation evidence.

## [2.0.0-docs] — 2026-07-26 (documentation stage)
### Added
- /docs system (12 documents) + root CLAUDE.md onboarding; repository declared source of truth.
### Fixed
- Misleading resilience-test title (duplicate fixtures ARE double-counted on malformed feeds — pinned limitation; dedupe proposed in STAGE3-DESIGN).

## [2.0.0] — 2026-07-26 (Stage 2)
### Added
- ES-module architecture, deterministic bundler, dist manifest and build identity.
- Provider registry and odds provenance rules.
- Pure backtest provenance, versioned cache envelope and unit/resilience suites.
### Changed
- Fixture identity and kickoff fields retained for downstream providers.
### Security
- SEC-1 re-verified: odds key direct-only, never relayed.
### Known issues
- See KNOWN_LIMITATIONS.md.

## [1.x] — 2026-07-26 (pre-refactor product evolution)
### Added
- Initial working Teamsheet product and iterative feature set.

## 2026-07-28 — Stage 8 uncertainty and squad simulation
- Added deterministic player score percentiles and blank/return/haul probabilities.
- Added legal squad auto-substitution and captain/vice fallback simulation.
- Disabled detailed uncertainty output in pre-season rather than presenting false precision.