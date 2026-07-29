# ARCHITECTURE.md
Purpose: detailed technical architecture. Audience: developers before changing code.
Last updated: 2026-07-29. Related: PROJECT_CONTEXT.md, DATA_SOURCES.md, TESTING.md, SECURITY.md.

## Directory structure
```
app.html                UI shell/template
build.mjs               deterministic bundler and CSP emitter
build-utils.mjs         tested static import/export stripping and module-syntax guard
run-tests.sh            production build + complete node:test suite
src/
  config.mjs            model/rules versions and FPL, minutes, scoring, transfer, simulation, odds rules
  util.mjs              shared parsing and DOM-builder primitives
  state.mjs             core state, bootstrap slimming/hydration, minute histories and last rendered optimiser result
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
  evidence/
    snapshot.mjs        canonical Stage 10 records, deadline timing, hashes and validation
  squad.mjs             squad helpers and deterministic best-XI selection
  main.mjs              load orchestration; evidence capture can explicitly await optional providers
  ui/
    evidence.mjs        phone-first capture/status, compressed local recovery and JSON import/export
    ...                 app shell, Settings/Provider Health presentation, team-pitch helpers, player-detail controller, session-only decision-preview state, views, restricted Markdown and security wiring
tests/                  characterisation, model, simulation, provider, security, UI-helper and build tests
docs/                   canonical project records
dist/                   generated deployable; never hand-edit
```

## Dependency flow
Configuration and state feed providers, storage and model modules. Official FPL element histories populate `S.minuteHistory`. `model/minutes.mjs` owns expected-minutes probabilities and aggregate fallback. `model/scoring.mjs` consumes that boundary and returns the unchanged deterministic `{total,perGW,games,parts}` projection surface.

`model/simulation.mjs` is downstream of fixtures, minutes and scoring. It samples around approved deterministic component expectations and never writes back into scoring or calibration. `model/squad-simulation.mjs` is downstream of player simulation and owns only FPL squad mechanics. Transfers continue to consume deterministic expected points; Stage 8 does not alter optimiser objectives.

Minutes never imports scoring. Scoring may reuse exported minutes helpers. Simulation imports both but neither imports simulation, preventing cycles.

## Build boundary
The bundler flattens application modules in a fixed, explicit order. Stage 8 modules are bundled after deterministic scoring and before downstream squad/transfer consumers. `ui/team-pitch.mjs` remains visual-only; `ui/player-detail.mjs` owns dialog behaviour; `ui/decision-preview.mjs` is bundled before the views and owns only session-scoped preview state and pure transformation helpers. `ui/views.mjs` composes those helpers with existing model outputs. Direct ES imports remain the source/test contract. The build rejects surviving module syntax and requires unique top-level names in the flattened scope.

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
`ui/app-shell.mjs` owns the four primary destinations, constructs the More/Settings hierarchy and provides the globally visible compact Provider Health control plus its full-detail destination. `ui/team-pitch.mjs` owns deterministic visual grouping and repository-owned shirt palette classes. `ui/player-detail.mjs` owns accessible detail-panel behaviour. `ui/decision-preview.mjs` owns temporary transfer/captain preview state, exact application of optimiser `finalSquadIds`, role swapping and stale-preview invalidation. `ui/views.mjs` renders either the real squad or a derived preview copy through the existing `bestXI()` and captain-ranking functions. Dynamic projection bars use native progress elements and uncertainty geometry uses namespace-correct SVG attributes. `util.mjs` rejects style attributes and runtime style objects. The real squad, persisted configuration and model recommendation remain unchanged.

## Provider Health and storage
Provider Health remains session-scoped with Live, Cached, Stale, Fallback, Partial, Disabled and Unavailable states. Stage 9.5 changes only presentation: the highest-attention current state is visible globally and every active provider row, age, note and consequence is shown under More. Minute histories use a separate schema/model-versioned cache. Stage 8 results and Stage 9.4 decision previews are session-computed and are not persisted.

## Build and deployment
`node build.mjs` emits `dist/app.bundle.js`, `dist/manifest.json`, single-file `dist/index.html` and a byte-identical root `index.html` deployment copy. Source hash, model/rules versions and exact `BUILD_COMMIT` identity are embedded. Same sources and identity must produce byte-identical artefacts, and the root deployment copy must match `dist/index.html` exactly.

## Security posture
Dynamic provider/user strings use DOM builders; AI output uses a restricted Markdown AST. Odds requests remain direct-only and diagnostics are scrubbed. The single inline production script and style element are SHA-256 hash locked by CSP. Stage 9.6 removes all source and generated style attributes, forbids runtime style APIs at the DOM-helper boundary and removes both `style-src-attr` and `unsafe-inline` from the emitted policy. No provider, transport, storage, secret or FPL-write surface changed.

## Testing
Characterisation tests execute the built production bundle. Direct imports cover formulas and contracts. Stage 8 adds player-simulation and squad-simulation suites. Stage 9.2 covers formation grouping and shirt palettes; Stage 9.3 covers player-detail and uncertainty presentation; Stage 9.4 covers safe decision previews; Stage 9.5 covers Settings/Provider Health; Stage 9.6 adds class-only palette determinism plus source, DOM-helper, CSP and generated-deployable guards against style attributes and runtime style APIs. Build tests directly exercise module stripping. Goldens may change only for approved user-visible consequences and final verification runs without regeneration.

## Future serverless architecture
Static UI shape can remain while selected provider calls move behind approved serverless functions for secret storage, headers, origin controls, rate limiting and server-side validation. This remains deferred until hosted AI or another approved trigger requires it.

## Stage 10 prospective-evidence boundary
`evidence/snapshot.mjs` reads the already validated runtime state and existing model functions, then emits an explicit allowlisted record. It never serialises `S` or configuration wholesale. Every record includes exact build/model/rules identity, canonical inputs and outputs, provider consequences, whole-record SHA-256 and section/provider hashes. Import recomputes those hashes and fails closed on tampering or an unknown schema.

Capture uses the official FPL event deadline, samples the same-origin HTTP `Date` before and after collection and applies the approved 24-hour/60-minute/20–10-minute/two-minute timing policy. The CSP therefore permits same-origin `connect-src` in addition to the established provider allowlist. This is timing evidence, not external timestamp notarisation.

All-player live uncertainty retains the approved 5,000 samples. `simulation.mjs` now precomputes invariant player/fixture expected components once before the sample loop and can omit raw arrays from a caller that needs summaries only; default callers and all formulas remain unchanged. Snapshot projection work yields every 20 players. A matching optimiser result already rendered for the same squad, horizon, bank and free-transfer context is reused rather than recomputed.

`ui/evidence.mjs` keeps three small metadata rows and two compressed full recovery records. Writes and deletion are verified and failures are surfaced. Exports remain complete, canonical, unencrypted JSON. Local recovery is not the canonical long-term archive.
