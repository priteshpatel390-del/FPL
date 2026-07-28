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
- Every approved Stage 3.5 dynamic rendering surface now uses DOM nodes: gameweek/source status,
  ticker, players and breakdowns, squad/captaincy, transfers, leagues, manual squad/search and
  backtest output.
### Unchanged
- Ask Markdown rendering remains at the Stage 3.4 baseline; its separate sanitisation design is
  deferred to Stage 3.6. No model, provider, key handling, CSP, formula or visual redesign changed.
### Verification and merge
- Recorded implementation result: 194/194 tests passing and deterministic builds green.
- Merged through PR #3 at merge commit `5623abb594159916b4041e6bd3c44be80f714ce7`.
- No GitHub Actions run is attached to the merge; the test/build result is implementation evidence.

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

## Stage 3 implementation history

### Item 4 — Provider Health (D-16)
#### Added
- Approved seven-state runtime model: Live, Cached, Stale, Fallback, Partial, Disabled and
  Unavailable.
- Provider-specific stale thresholds: FPL 30 minutes during live gameweeks / 6 hours otherwise,
  Understat 24 hours, odds 6 hours.
- Last-success age, internal note and user-facing consequence for every health entry.
- Compact Provider Health strip in the existing settings panel, rendered with DOM nodes.
- `tests/provider-health.test.mjs` (10 transition/compatibility tests).
- `docs/STAGE3-ITEM4.md` implementation record.
#### Changed
- FPL now distinguishes live, cached-refreshing, stale-cache, saved-data fallback and no-data states.
- Understat distinguishes user-disabled, live, partial coverage and fallback to FPL strengths.
- Odds distinguishes no-key disabled, invalid-key unavailable, partial/live coverage and fallback to
  the internal model for quota/network/empty/matching failures.
- Legacy `ok` and `usingFallback` fields remain as values derived from the richer state.
#### Unchanged
- No projection, scoring, expected-minutes, fixture-difficulty, calibration, squad, captaincy,
  transfer or backtest formula changed. No provider was added. Stage 9 layout work remains deferred.
#### Tests
- Suite 179 → 189. Full `./run-tests.sh` green and deterministic two-build byte comparison green.

### Item 3 — retry policy (D-15)
#### Added
- `src/providers/retry.mjs`: pure, dependency-free retry engine — `withRetry`, `policyFor`,
  `retryDelay`, `safeEndpoint`, `isRetryableStatus`/`isPermanentStatus`, `RETRY_POLICY`.
  All timing dependencies injectable; the loop is a bounded `for`, never recursion.
- Per-provider policies for fpl, understat, odds and archive, each with an attempt ceiling,
  a capped half-jitter backoff and an elapsed-time budget.
- `recordRetry()` on state; retry metadata exposed via `S.retryStats` in the shape the
  provider-health model (item 4) will consume. Nothing reads it yet.
- `tests/retry.test.mjs` (20) and `tests/retry-transport.test.mjs` (13).
#### Changed
- `transport.mjs`: the relay cascade is now one retry attempt (`cascadeOnce`), wrapped in a
  bounded retry. Optional endpoints get a reduced allowance so pooled rival lookups cannot
  amplify an outage. `fetchVia` retries on the same terms.
- `odds.mjs`: the direct request retries on network/5xx only. 401 and 429 remain permanent.
  SEC-1 is unaffected — only the direct request is retried, never a relayed one.
- `backtest.mjs`: the archive download retries once on transient failure before falling
  through to the next season, as before.
- `build.mjs`: `src/providers/retry.mjs` added to ORDER ahead of its consumers.
#### Unchanged
- Healthy providers are fetched exactly once and see no added latency (asserted by test).
- All failure fallbacks produce the same user-facing outcome as before.
- No scoring, projection, minutes, fixture-difficulty, odds-weighting, backtest-correction,
  squad, transfer or captaincy logic touched. Suite 146 -> 179; build byte-deterministic.
