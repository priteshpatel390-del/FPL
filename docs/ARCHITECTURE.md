# ARCHITECTURE.md
Purpose: detailed technical architecture. Audience: developers/Claude before changing code.
Last updated: 2026-07-28. Related: PROJECT_CONTEXT.md, DATA_SOURCES.md, TESTING.md, SECURITY.md.

## Directory structure
```
app.html            UI shell/template (script tag replaced at build)
build.mjs           deterministic bundler (emits dist/)
run-tests.sh        build + full test suite
src/
  config.mjs        scoring constants, versions, ODDS_RULES, MINUTES_RULES
  util.mjs          $, num, clamp, fmt1, escapeHTML, el, setChildren
  state.mjs         S, bootstrap slimming/hydration, minuteHistory session state
  storage.mjs       config/cache access plus separate minutes-history cache key
  providers/
    retry.mjs       bounded transient-failure retry policies + safe endpoint labels
    validate.mjs    core per-endpoint payload validation and fixture normalisation
    registry.mjs    six quality descriptors + seven-state runtime Provider Health
    transport.mjs   fetchT, relay cascade, api(), fetchVia(), pool()
    minutes-history.mjs official FPL element-summary validation, cohort, cache and loading
    common.mjs      NAME_ALIASES, mapTeamName
    understat.mjs   team last-6 xG/xGA only
    odds.mjs        poissonOver, solveLambda, direct-only loadOdds
  model/
    fixtures.mjs    matchContext, teamFixtures, multToDiff, runScore
    minutes.mjs     Stage 4 pStart/pAppear/p60/expMin/confidence estimator
    scoring.mjs     availability, rates, points components and projection cache
    xp.mjs          re-export shim of projection surface
    backtest.mjs    parseCSV, pearson, computeBacktest, runBacktest
  squad.mjs         flagsFor, priceMomentum, newsAge, sellPrice, mySquad, bestXI
  main.mjs          load orchestration and Provider Health strip
  ui/views.mjs      views and wiring; monolithic until Stage 9
tests/              220-test Stage 4 draft baseline including minutes-model.test.mjs
docs/               canonical documentation and stage records
dist/               generated deployable; never hand-edit
```

## Dependency flow
Configuration and state feed provider, storage and model modules. `providers/minutes-history.mjs`
loads validated official-FPL histories into `S.minuteHistory`. `model/minutes.mjs` consumes player,
fixture and history state and exposes an estimate object. `model/scoring.mjs` consumes that object;
minutes never imports scoring, preventing a circular dependency. Squad, captaincy, transfers and UI
remain downstream of the unchanged projection surface.

The bundler flattens modules in a fixed order. Direct ES imports remain the test contract. Unique
bundle-scope names, named exports and single-line export lists remain required.

## Stage 4 history flow
1. Core bootstrap and fixtures load through the existing cache/live/fallback path.
2. Detailed histories load asynchronously after the first usable render, alongside optional providers.
3. Squad/manual players are prioritised, followed by approximately 80 players ordered by ownership,
   price and id. Limited concurrency uses the existing transport pool.
4. Element-summary payloads are reduced to bounded history rows. Malformed rows are dropped and
   reported without payload leakage.
5. A separate schema/model-versioned cache preserves usable histories; a failed refresh does not
   remove aggregate/prior fallback.
6. Mixed detailed/fallback coverage marks FPL Provider Health Partial unless core FPL is already in a
   stronger failure state such as Fallback or Unavailable.

## Expected-minutes boundary
`model/minutes.mjs` owns all Stage 4 minutes behaviour and returns `{pStart,pAppear,p60,expMin,
confidence,confidenceLabel,source}`. The model uses completed team fixtures rather than GW number,
last-eight weighted histories where available, four-match shrinkage and deterministic aggregate/prior
fallbacks. Official availability is applied once. Scoring no longer invents probabilities from a
single average.

## Provider Health
Runtime state remains descriptive: Live, Cached, Stale, Fallback, Partial, Disabled and Unavailable.
Health is session-scoped. Detailed histories are an FPL enrichment, not a new provider.

## Storage
Core season snapshot, configuration, squad and calibration keys remain. `fpl:minutes-history` is a
separate schema/model-versioned envelope so detailed histories do not bloat or alter the provenance of
the bootstrap snapshot. Provider Health remains unpersisted.

## Build and deployment
`node build.mjs` emits `dist/app.bundle.js`, `dist/manifest.json` and single-file `dist/index.html`.
The source hash, model/rules versions and BUILD_COMMIT identity are embedded. Same sources and explicit
identity produce byte-identical artefacts. Deployment remains one `dist/index.html` upload to GitHub
Pages.

## Security posture
Dynamic provider/user strings use DOM builders; AI uses restricted Markdown AST rendering. Odds
requests remain direct-only and key diagnostics are scrubbed. The generated single inline script and
style are hash-locked by CSP; the Stage 9 style-attribute concession and Pages frame limitation remain.
Stage 4 introduces no secret and no new provider origin.

## Testing
Characterisation runs against the built production bundle. Direct-import tests cover model formulas,
providers and storage. Stage 4 adds focused denominator, role, availability, shrinkage, invariant and
history-validation tests. Golden changes are restricted to MIN-1/DEN-1 consequences.

## Future serverless architecture
Static UI can later retain its shape while provider base URLs move to serverless functions for secret
storage, headers, origin checks, rate limiting and server-side schema validation. This remains deferred
until hosted AI or another approved trigger requires it.
