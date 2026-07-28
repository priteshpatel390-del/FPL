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
  config.mjs            model/rules versions and FPL, minutes, scoring, transfer, simulation, odds rules
  util.mjs              shared parsing and DOM-builder primitives
  state.mjs             core state, bootstrap slimming/hydration, minute histories
  storage.mjs           configuration and cache envelopes
  providers/            validation, transport, retry, health and optional data loaders
  model/
    fixtures.mjs        match context, fixture lists and run scoring
    minutes.mjs         pStart/pAppear/p60/expMin/confidence estimator
    scoring-rules.mjs   pure Poisson, threshold and shrinkage helpers
    scoring.mjs         rule-aware deterministic player components and projection cache
    simulation.mjs      seeded player uncertainty, minutes states and percentiles
    squad-simulation.mjs legal auto-subs, captain fallback and squad distributions
    transfers.mjs       exact 0–3 transfer optimiser
    walk-forward.mjs    chronological evaluation and fold-only calibration
    archive-replay.mjs  pinned historical replay
    backtest.mjs        historical evaluation utilities
  squad.mjs             squad helpers and deterministic best-XI selection
  main.mjs              load orchestration
  ui/                    app shell, visual-only team-pitch helpers, player-detail controller, views, restricted Markdown and security wiring
tests/                  characterisation, model, simulation, provider, security, UI-helper and build tests
docs/                   canonical project records
dist/                   generated deployable; never hand-edit
```

## Dependency flow
Configuration and state feed providers, storage and model modules. Official FPL element histories populate `S.minuteHistory`. `model/minutes.mjs` owns expected-minutes probabilities and aggregate fallback. `model/scoring.mjs` consumes that boundary and returns the unchanged deterministic `{total,perGW,games,parts}` projection surface.

`model/simulation.mjs` is downstream of fixtures, minutes and scoring. It samples around approved deterministic component expectations and never writes back into scoring or calibration. `model/squad-simulation.mjs` is downstream of player simulation and owns only FPL squad mechanics. Transfers continue to consume deterministic expected points; Stage 8 does not alter optimiser objectives.

Minutes never imports scoring. Scoring may reuse exported minutes helpers. Simulation imports both but neither imports simulation, preventing cycles.

## Build boundary
The bundler flattens application modules in a fixed, explicit order. Stage 8 modules are bundled after deterministic scoring and before downstream squad/transfer consumers. `ui/team-pitch.mjs` remains visual-only; `ui/player-detail.mjs` is bundled before the main views and owns the dialog controller plus pure presentation helpers. `ui/views.mjs` composes those helpers with existing model outputs. Direct ES imports remain the source/test contract. The build rejects surviving module syntax and requires unique top-level names in the flattened scope.

## Expected-minutes boundary
`model/minutes.mjs` returns `{pStart,pAppear,p60,expMin,confidence,confidenceLabel,source}`. Completed team fixtures are the aggregate denominator; detailed histories use recency weighting and shrinkage. Official availability is applied once.

## Deterministic scoring boundary
`FPL_RULES` records official 2026/27 point values. `SCORING_RULES` records judgement-based priors. `scoring.mjs` owns deterministic expectations for appearance, goals, assists, clean sheets, goals conceded, saves, defensive contributions, bonus and rare events. No full match-relative BPS simulation is attempted.

## Stage 8 uncertainty boundary
`SIMULATION_RULES` versions the uncertainty contract. `simulation.mjs` provides:

- deterministic FNV-style seed hashing and a repository-owned PRNG;
- five-state minutes reconstruction from pStart/pAppear/p60/expMin;
- bounded discrete sampling of approved scoring components;
- independent appearance samples so zero-point appearances remain appearances;
- P10, P25, median, P75 and P90 summaries;
- blank, return, haul and mega-haul probabilities;
- fail-closed pre-season behaviour.

`squad-simulation.mjs` validates legal starting formations, processes the reserve goalkeeper separately, respects outfield bench order, preserves minimum formation rules and applies captain-to-vice fallback. Equal inputs and seeds produce equal outputs.

## Stage 9 UI boundary
`ui/app-shell.mjs` owns the four primary destinations. `ui/team-pitch.mjs` owns only deterministic visual grouping and repository-owned shirt palettes. `ui/player-detail.mjs` owns open/close behaviour, Escape handling, focus restoration/trapping, approved spread-label thresholds and range positioning; it does not calculate projections or simulation samples. `ui/views.mjs` calls the existing projection, expected-minutes and Stage 8 simulation functions, then renders their unchanged outputs in the portrait pitch and player detail panel. Captain/vice, squad and persisted state remain unchanged.

## Provider Health and storage
Provider Health remains session-scoped with Live, Cached, Stale, Fallback, Partial, Disabled and Unavailable states. Minute histories use a separate schema/model-versioned cache. Stage 8 results are session-computed and are not persisted.

## Build and deployment
`node build.mjs` emits `dist/app.bundle.js`, `dist/manifest.json` and single-file `dist/index.html`. Source hash, model/rules versions and exact `BUILD_COMMIT` identity are embedded. Same sources and identity must produce byte-identical artefacts.

## Security posture
Dynamic provider/user strings use DOM builders; AI output uses a restricted Markdown AST. Odds requests remain direct-only and diagnostics are scrubbed. The single inline production script and style are SHA-256 hash locked by CSP. Stage 9.3 adds no provider, storage or secret surface; the approved inline-style concession remains until checkpoint 9.6.

## Testing
Characterisation tests execute the built production bundle. Direct imports cover formulas and contracts. Stage 8 adds player-simulation and squad-simulation suites. Stage 9.2 covers formation grouping, captain/vice identity and deterministic shirt palettes. Stage 9.3 adds direct tests for exact spread thresholds, unavailable/reduced-quality suppression, range positioning, official availability labels, dialog semantics, Escape/focus restoration and removal of the legacy inline drawer. Build tests directly exercise module stripping. Goldens may change only for approved user-visible consequences and final verification runs without regeneration.

## Future serverless architecture
Static UI shape can remain while selected provider calls move behind approved serverless functions for secret storage, headers, origin controls, rate limiting and server-side validation. This remains deferred until hosted AI or another approved trigger requires it.
