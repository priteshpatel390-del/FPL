# Stage 2 — Module extraction (complete) + SEC-1 hot-fix

## SEC-1 hot-fix (shipped separately, before extraction)
Relay fallback removed from the odds request: key-bearing calls are direct-only; on failure the
internal team model takes over with a visible reduced-confidence note. Regression test
(tests/sec1.test.mjs) spies on every fetch URL and asserts no relay host ever receives the key,
under total network failure. The hot-fixed monolith was shipped as a deployable before extraction
began, and the extracted odds module carries the same guarantee (re-tested in resilience suite).

## What changed
- app.js split into 17 ES modules under src/ (config, util, state, storage, providers/{registry,
  transport, common, understat, odds}, model/{fixtures, minutes, scoring, xp, backtest}, squad,
  main, ui/views). Bodies moved verbatim except the sanctioned edits below.
- Deterministic bundler (build.mjs): fixed module order, import/export stripping, SHA-256 source
  hash; emits dist/app.bundle.js + dist/index.html + dist/manifest.json. Verified byte-identical
  across repeated builds. BUILD_COMMIT env stamps commit identity (adjustment 9); BUILD_INFO is
  embedded in the deployable.
- Test architecture (adjustment 8): characterisation + SEC-1 run through the DOM harness against
  the BUILT BUNDLE (proving extraction faithful); model/provider/storage logic tested by direct
  ES-module import (tests/unit.test.mjs); failure modes in tests/resilience.test.mjs
  (adjustment 7: corrupted cache JSON, missing optional fields, malformed provider responses,
  provider outage incl. key-never-relayed, duplicate fixtures, name-mapping failure, HTML
  escaping, GK/outfield bench handling). Suite total: 96 passing.

## Sanctioned behaviour-affecting edits (everything else verbatim)
1. Odds provider (adjustment 5): retains providerEventId, kickoff, fetchedAt, booksUsed,
   marketCount, staleDropped, confidence per event. Devig per book (overround normalised),
   median-based outlier rejection, staleness cut, thin-market inclusion rules — all thresholds
   DEFINED in config (ODDS_RULES) before any formula change; lambda/split formula itself is
   unchanged (average of devigged probabilities, exponent 0.45, both still labelled unvalidated).
   Fixture matching now teams + kickoff proximity (72h window), falling back to pair-only when a
   cached fixture lacks kickoff_time. Effect: healthy markets produce identical numbers; thin or
   stale markets are now skipped rather than trusted.
2. slim() retains fixture id, kickoff_time, started, provisional_start_time (CACHE-1 partial;
   required by odds matching). Cache envelope added (schemaVersion + season, storage.cachePut/Get)
   — old cached snapshots invalidate once on first load after deploy; a fresh fetch replaces them.
3. computeBacktest extracted pure from runBacktest; results carry provenance (adjustment 6):
   modelVersion, rulesVersion, dataset {url, season, rows, pinned:false — SHA pinning still owed,
   AUDIT BT-1}, predictedAt, method. Verified reproducible in unit tests with injected clock.
4. Provider registry (adjustment 2): six-attribute quality descriptors (data authority, transport
   availability, schema stability, freshness, historical reproducibility, licensing confidence)
   for fpl/understat/odds/archive + runtime health marks (live/fallback/down) now recorded by the
   understat and odds providers. UI surfacing of the full health strip lands with Stage 9.
5. escapeHTML added to util (used by resilience tests); full innerHTML replacement remains Stage 3
   scope as planned. Understat stays team-level only (adjustment 3) — no player-level fields
   touched. ClubElo not integrated (adjustment 4): registered as a candidate prior/anchor for the
   Stage-5/7 ablation, not a drop-in xG replacement.

## Assumptions & limitations
- Bundler contract: unique top-level names across modules (inherited from the monolith's single
  scope); no default exports; import lines single-line. Documented in README-BUILD.md.
- Dataset pinning (BT-1) still open: raw.githubusercontent is robots-blocked from my sandbox so I
  cannot resolve a commit SHA myself; either run `git ls-remote` from any computer and give me the
  SHA, or I pin it at Stage 7 via the app itself recording the ETag of its first download.
- Views module remains monolithic by design this stage; it is bundle-tested (characterisation)
  rather than direct-imported. Splitting views further is Stage 9 work alongside the redesign.

## Deploy note
dist/index.html is functionally identical to the hot-fixed monolith (77/77 characterisation on
both, plus the odds-provider hardening). Either deployable is safe; dist/ is now canonical.

## Next: Stage 3 (security & API hardening within static-hosting limits)
Full innerHTML → textContent/escapeHTML sweep, CSP meta, schema validation of FPL responses with
degraded-data warnings, retry/backoff policy, health strip surfacing, and the documented
Cloudflare/Netlify migration path with /api/... provider switch points.
