# CHANGELOG.md
Purpose: professional change record (Keep a Changelog conventions). Audience: all.
Last updated: 2026-07-27. Related: STAGE_HISTORY.md for engineering detail.

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

## [Unreleased] — Stage 3 (in progress)

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

### Item 2 — per-endpoint schema validation (D-14, VAL-1 closed)
#### Added
- Per-endpoint validators in `src/providers/validate.mjs`: `validateBootstrap` (+ fatal-only
  `bootstrapStructure`), `validateEntry`, `validatePicks`, `validateHistory`, `validateStandings`,
  `validateUnderstat`, `validateOdds`, `validateArchiveHeader`; shared `filterRows`/`mkIssue`
  primitives, `collapseIssues`, `hasFatal`. All pure, all non-mutating, all returning `{value, issues}`.
- `recordIssues(provider, endpoint, issues)` on state: replaces per provider+endpoint so repeated
  panel refreshes stay idempotent.
- `tests/schema.test.mjs` (25) and `tests/schema-state.test.mjs` (8).
#### Changed
- Issue objects now carry `{provider, endpoint, code, severity, count}`; the D-13 fixture issues were
  retro-tagged to the same shape.
- `hydrate()` validates the whole snapshot before any assignment and returns `{ok, issues}`; a fatal
  payload leaves state completely untouched instead of half-populated.
- `loadAll()` guards structurally before `slim()`, refuses to cache an unusable payload, and shows a
  distinct non-technical message for malformed-shape (as opposed to unreachable) feeds.
- Malformed cached snapshots are discarded and re-fetched rather than rendered.
- Optional providers (entry, picks, history, standings, rival picks, Understat, odds, archive) validate
  at their call sites and degrade to existing fallbacks.
#### Fixed
- VAL-1: provider schema drift no longer fails silently or crashes a consumer mid-render.
#### Unchanged
- No scoring, projection, minutes, fixture-difficulty, odds-weighting, backtest-correction, squad,
  transfer or captaincy logic touched; `scoring.mjs`, `fixtures.mjs`, `minutes.mjs`, `xp.mjs`,
  `squad.mjs` and `config.mjs` are byte-identical. Suite 113 -> 146; build byte-deterministic.
### Added
- `src/providers/validate.mjs`: fixture validation & normalisation. Identity by provider `id`,
  composite `event+team_h+team_a` fallback only. Reports `fixture_exact_duplicate`,
  `fixture_conflicting_duplicate`, `fixture_missing_identity` (all `partial`) and
  `fixtures_not_array` (`fatal`). Payload-free `issueSummary()` for health reporting.
- `S.dataIssues` populated on every load; 12 new tests (tests/validation.test.mjs).
### Fixed
- **DUP-1 (closed)**: duplicate fixture rows no longer double-count projections, fake
  double-gameweek ticker styling, or generate false chip-window notes. Genuine doubles preserved.
### Changed
- `hydrate()` normalises fixtures at the point of use (fresh AND cached snapshots); `slim()`
  deliberately preserves the raw-shaped list for provenance.
- Resilience test converted from pinned-limitation to characterisation of the fixed behaviour.
### Security
- **SEC-3 closed (D-08):** removed the Anthropic API-key field, save/restore logic, key headers and
  browser-access opt-in header. Hosted builds now stop before contacting Anthropic; Claude artifact
  preview keeps the approved keyless request path.
- Added a one-time configuration migration that deletes any legacy stored `claudeKey` value.
### Tests
- Added 5 focused Anthropic-removal tests; full suite is now 113 passing.
