# ARCHITECTURE.md
Purpose: detailed technical architecture. Audience: developers before changing code.
Last updated: 2026-07-28. Related: PROJECT_CONTEXT.md, DATA_SOURCES.md, TESTING.md, SECURITY.md.

## Directory structure
```
app.html                UI shell/template
build.mjs               deterministic bundler and CSP emitter
build-utils.mjs         tested static import/export stripping and module-syntax guard
run-tests.sh            production build + complete node:test suite
src/
  config.mjs            model/rules versions, FPL_RULES, MINUTES_RULES, SCORING_RULES, ODDS_RULES
  util.mjs              shared parsing and DOM-builder primitives
  state.mjs             core state, bootstrap slimming/hydration, minute histories
  storage.mjs           configuration and cache envelopes
  providers/            validation, transport, retry, health and optional data loaders
  model/
    fixtures.mjs        match context, fixture lists and run scoring
    minutes.mjs         pStart/pAppear/p60/expMin/confidence estimator
    scoring-rules.mjs   pure Poisson, threshold and shrinkage helpers
    scoring.mjs         rule-aware player components and projection cache
    xp.mjs              projection re-export shim
    backtest.mjs        historical evaluation utilities
  squad.mjs             squad helpers and best-XI selection
  main.mjs              load orchestration
  ui/                    views, restricted Markdown and security wiring
tests/                  characterisation, direct-module, security, provider, minutes, scoring and build tests
docs/                   canonical project records
dist/                   generated deployable; never hand-edit
```

## Dependency flow
Configuration and state feed providers, storage and model modules. Official FPL element histories populate `S.minuteHistory`. `model/minutes.mjs` owns expected-minutes probabilities and aggregate fallback. `model/scoring.mjs` consumes that boundary, plus pure functions from `model/scoring-rules.mjs`. Squad, captaincy, transfers and UI remain downstream of the unchanged `{total, perGW, games, parts}` projection surface.

Minutes never imports scoring, preventing a circular dependency. Scoring may reuse exported minutes helpers for historical appearance denominators rather than inventing a separate aggregate model.

## Build boundary
The bundler flattens application modules in a fixed, explicit order. Direct ES imports remain the source/test contract. `build-utils.mjs` removes complete static import declarations, including multi-line default/named forms, and complete export lists. Declaration exports such as `export const` and `export function` are converted to bundle-scope declarations. The build fails if an import or export declaration survives.

Focused fixture tests cover single-line imports, multi-line named imports, default-plus-named imports, export/re-export lists, unterminated declarations and unsupported surviving syntax. Unique top-level bundle names remain required because the output is one script scope.

## Expected-minutes boundary
`model/minutes.mjs` returns `{pStart,pAppear,p60,expMin,confidence,confidenceLabel,source}`. Completed team fixtures are the aggregate denominator; detailed current-season histories use recency weighting and shrinkage. Official availability is applied once. Aggregate season appearances required by scoring are derived from completed matches × aggregate `pAppear`; detailed history is preferred where available.

## Stage 5 scoring boundary
`FPL_RULES` records official 2026/27 point values. `SCORING_RULES` records judgement-based priors. `scoring-rules.mjs` provides deterministic Poisson grouped points, threshold probabilities and shrinkage. `scoring.mjs` owns appearance, goals, assists, clean sheets, goals conceded, saves, defensive contributions, bonus and rare events. No full match-relative BPS simulation or uncertainty simulation is attempted.

## Provider Health and storage
Provider Health remains session-scoped with Live, Cached, Stale, Fallback, Partial, Disabled and Unavailable states. Minute histories use a separate schema/model-versioned cache so enrichment data does not alter core FPL snapshot provenance.

## Build and deployment
`node build.mjs` emits `dist/app.bundle.js`, `dist/manifest.json` and single-file `dist/index.html`. Source hash, model/rules versions and exact `BUILD_COMMIT` identity are embedded. Same sources and identity must produce byte-identical artefacts. Deployment remains one `dist/index.html` upload to GitHub Pages.

## Security posture
Dynamic provider/user strings use DOM builders; AI output uses a restricted Markdown AST. Odds requests remain direct-only and diagnostics are scrubbed. The single inline production script and style are SHA-256 hash locked by CSP. The Stage 9 style-attribute concession and GitHub Pages frame-header limitation remain.

## Testing
Characterisation tests execute the built production bundle. Direct imports cover formulas and provider/storage contracts. Stage 5 adds scoring-rule and real blank/double tests. Build tests directly exercise module stripping rather than checking only today’s generated bundle. Golden changes remain limited to approved stage consequences and verification must run against committed goldens without rewriting them.

## Future serverless architecture
Static UI shape can later remain while selected provider calls move behind approved serverless functions for secret storage, headers, origin controls, rate limiting and server-side validation. This remains deferred until hosted AI or another approved trigger requires it.
