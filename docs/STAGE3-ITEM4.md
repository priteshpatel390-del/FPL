# Stage 3 item 4 — Provider Health

Status: implemented on `stage3-item4-provider-health`; pending owner review.
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

## Verification

The focused tests, full `./run-tests.sh` suite and deterministic two-build comparison must all be
recorded in the draft PR before owner approval. The temporary verification workflow used to obtain
that evidence is removed from the final diff.

## Remaining limitations

- Public relay dependence remains until serverless migration.
- Health is in-memory for the current app session; only the underlying cached snapshot persists.
- Provider health reports current consequence; it is not a long-term incident log.
