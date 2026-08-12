# Stage 3 item 4 — Provider Health

Status: **historical record — complete.** Provider Health shipped with Stage 3 and remains a live application surface. The "pending owner review" wording below was true only on the original `stage3-item4-provider-health` branch and is not current state.
Date: 2026-07-27.
Decision: D-16.

## Scope delivered

- Replaced the legacy boolean runtime health mark with the approved seven states: Live, Cached,
  Stale, Fallback, Partial, Disabled and Unavailable.
- Added provider-specific stale thresholds: FPL 30 minutes during live gameweeks / 6 hours
  otherwise, Understat 24 hours and odds 6 hours.
- Every health entry carries `lastSuccess`, current age, an internal note and a user-facing
  consequence line.
- FPL distinguishes fresh live data, cached data while refreshing, stale cache, saved-data
  fallback and total unavailability.
- Understat distinguishes enabled live/partial data, fallback to FPL ratings and user-disabled.
- Odds distinguishes live/partial market coverage, no-key disabled, invalid-key unavailable,
  quota/network/empty-feed fallback to the internal model.
- A compact Provider Health strip is built with DOM nodes inside the existing settings panel.
- Added ten direct-import transition tests in `tests/provider-health.test.mjs`.

## Deliberately unchanged

- No projection, scoring, expected-minutes, fixture-difficulty, calibration, squad, captaincy,
  transfer or backtest formula changed.
- No provider was added or removed.
- The major settings/navigation redesign remains Stage 9.
- The health model does not invent a single 0–100 score; the approved descriptive state plus
  consequence is more transparent for this app.

## Judgement calls

1. `Disabled` is neutral and cannot age into `Stale` or be styled as a failure.
2. A provider can be `Partial` only when usable data is active; a substitute model is `Fallback`.
3. `lastSuccess` survives later fallback/unavailable states so the strip can still report when the
   provider last supplied usable data.
4. The strip is inserted dynamically beside the existing source status rather than pulling the
   Stage 9 settings-page redesign forward.
5. Stage-2 `ok` and `usingFallback` fields remain as derived compatibility values. The first full
   suite run exposed that contract; the old test was preserved and the implementation corrected.

## Verification

- `./run-tests.sh`: **189 passed, 0 failed**.
- Build completed successfully and regenerated `dist/index.html`, `dist/app.bundle.js` and
  `dist/manifest.json` from source.
- A second `node build.mjs` produced byte-identical copies of all three generated files.
- The generated deployable files are committed to the feature branch.
- The temporary GitHub Actions verification workflow was removed from the final product diff.

## Remaining limitations

- Public relay dependence remains until serverless migration.
- Health is in-memory for the current app session; only the underlying cached snapshot persists.
- Provider health reports current consequence; it is not a long-term incident log.
- RET-2 transport-level circuit suppression remains open; this item delivered the health state it
  depends on without silently expanding into a separate transport-policy change.
