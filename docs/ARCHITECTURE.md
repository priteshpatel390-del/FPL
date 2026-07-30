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
  providers/            validation, transport, retry, health, outcome validation and optional data loaders
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
    snapshot.mjs        canonical pre-deadline records, deadline timing, hashes and validation
    outcome.mjs         canonical Official FPL outcome records, lifecycle, correction hashes and snapshot links
    metrics.mjs         immutable metric observations, exact joins, frozen decision evaluation and transfer horizons
    review.mjs          downstream weekly/cumulative operating review and deterministic export contracts
  squad.mjs             squad helpers and deterministic best-XI selection
  main.mjs              load orchestration; evidence capture can explicitly await optional providers
  ui/
    evidence.mjs        phone-first snapshot capture/status, compressed local recovery and JSON import/export
    outcomes.mjs        non-blocking outcome orchestration, bounded revisions and recovery-only restore
    metrics.mjs         metric storage, correction processing, transfer-horizon completion and descriptive reporting
    review.mjs          phone-first operating review controls and JSON/Markdown/CSV downloads
    ...                 app shell, Settings/Provider Health presentation, team-pitch helpers, player-detail controller, session-only decision-preview state, views, restricted Markdown and security wiring
tests/                  characterisation, model, simulation, provider, security, evidence, metric and build tests
docs/                   canonical project records
dist/                   generated deployable; never hand-edit
```

## Dependency flow
Configuration and state feed providers, storage and model modules. Official FPL element histories populate `S.minuteHistory`. `model/minutes.mjs` owns expected-minutes probabilities and aggregate fallback. `model/scoring.mjs` consumes that boundary and returns the unchanged deterministic `{total,perGW,games,parts}` projection surface.

`model/simulation.mjs` is downstream of fixtures, minutes and scoring. It samples around approved deterministic component expectations and never writes back into scoring or calibration. `model/squad-simulation.mjs` is downstream of player simulation and owns only FPL squad mechanics. Transfers continue to consume deterministic expected points; Stage 8 does not alter optimiser objectives.

Minutes never imports scoring. Scoring may reuse exported minutes helpers. Simulation imports both but neither imports simulation, preventing cycles.

The Stage 10 evidence dependency is one-way: snapshot observes model state; outcome observes post-deadline Official FPL facts; metrics observes only stored snapshot and outcome records; review observes only stored snapshot, outcome, evaluation and transfer-horizon records. Metrics and review do not import or execute current scoring, minutes, simulation or optimiser functions and never write into runtime model state.

## Build boundary
The bundler flattens application modules in a fixed, explicit order. Stage 8 modules are bundled after deterministic scoring and before downstream squad/transfer consumers. Stage 10 snapshot, outcome, metric and review modules are bundled after decision-preview state and before their UI orchestrators. Helper names in flattened scope remain unique.

`ui/team-pitch.mjs` remains visual-only; `ui/player-detail.mjs` owns dialog behaviour; `ui/decision-preview.mjs` owns temporary transfer/captain preview state. `ui/views.mjs` composes those helpers with existing model outputs. Dynamic projection bars use native progress elements and uncertainty geometry uses namespace-correct SVG attributes. `util.mjs` rejects style attributes and runtime style objects.

## Expected-minutes boundary
`model/minutes.mjs` returns `{pStart,pAppear,p60,expMin,confidence,confidenceLabel,source}`. Completed team fixtures are the aggregate denominator; detailed histories use recency weighting and shrinkage. Official availability is applied once.

## Deterministic scoring boundary
`FPL_RULES` records official 2026/27 point values. `SCORING_RULES` records judgement-based priors. `scoring.mjs` owns deterministic expectations for appearance, goals, assists, clean sheets, goals conceded, saves, defensive contributions, bonus and rare events. No full match-relative BPS simulation is attempted.

## Stage 8 uncertainty boundary
`SIMULATION_RULES` versions the uncertainty contract. `simulation.mjs` provides deterministic seed hashing, a repository-owned PRNG, five-state minutes reconstruction, bounded discrete sampling, independent appearance samples, P10/P25/median/P75/P90 summaries, blank/return/haul/mega-haul probabilities and fail-closed pre-season behaviour.

`squad-simulation.mjs` validates legal starting formations, processes the reserve goalkeeper separately, respects outfield bench order, preserves minimum formation rules and applies captain-to-vice fallback. Equal inputs and seeds produce equal outputs.

## Stage 9 UI boundary
`ui/app-shell.mjs` owns the four primary destinations, constructs the More/Settings hierarchy and provides globally visible Provider Health. `ui/team-pitch.mjs` owns visual grouping and shirt palette classes. `ui/player-detail.mjs` owns accessible detail-panel behaviour. `ui/decision-preview.mjs` owns session-scoped preview state and stale invalidation. The real squad, persisted configuration and model recommendation remain unchanged.

## Provider Health and storage
Provider Health remains session-scoped with Live, Cached, Stale, Fallback, Partial, Disabled and Unavailable states. Stage 9.5 changes only presentation. Minute histories use a separate schema/model-versioned cache. Stage 8 results and Stage 9.4 decision previews are session-computed and are not persisted.

## Build and deployment
`node build.mjs` emits `dist/app.bundle.js`, `dist/manifest.json`, single-file `dist/index.html` and a byte-identical root `index.html` deployment copy. Source hash, model/rules versions and exact `BUILD_COMMIT` identity are embedded. Same sources and identity must produce byte-identical artefacts, and the root deployment copy must match `dist/index.html` exactly.

## Security posture
Dynamic provider/user strings use DOM builders; AI output uses a restricted Markdown AST. Odds requests remain direct-only and diagnostics are scrubbed. The single inline production script and style element are SHA-256 hash locked by CSP. Stage 9.6 removes all source/generated style attributes, forbids runtime style APIs and removes both `style-src-attr` and `unsafe-inline`. Stage 10 metric records reuse allowlist construction, forbidden-secret checks, canonical hashes and recovery-only storage boundaries.

## Testing
Characterisation tests execute the built production bundle. Direct imports cover formulas and contracts. Stage 10.3 adds pure metric and storage suites covering exact calculations, identity/revision rules, blank/double/postponed fixtures, fixture-minute allocation, legal automatic substitutions, captain fallback, frozen transfer horizons, sample safeguards, deterministic serialisation, tamper detection and non-mutation. Existing production formula and golden suites remain unchanged.

## Future serverless architecture
Static UI shape can remain while selected provider calls move behind approved serverless functions for secret storage, headers, origin controls, rate limiting and server-side validation. This remains deferred until hosted AI or another approved trigger requires it.

## Stage 10 prospective-evidence boundary
`evidence/snapshot.mjs` reads already validated runtime state and existing model functions, then emits an explicit allowlisted record. It never serialises `S` or configuration wholesale. Every record includes exact build/model/rules identity, canonical inputs and outputs, provider consequences, whole-record SHA-256 and section/provider hashes. Import recomputes those hashes and fails closed on tampering or an unknown schema.

Capture uses the official FPL event deadline, samples same-origin HTTP `Date` before and after collection and applies the approved timing policy. This is timing evidence, not external timestamp notarisation. All-player live uncertainty retains 5,000 samples; invariant component reuse is performance-only.

`ui/evidence.mjs` keeps three small metadata rows and two compressed full recovery records. Writes and deletion are verified and failures are surfaced. Exports remain complete, canonical, unencrypted JSON. Local recovery is not the canonical long-term archive.

## Stage 10.1 verified-startup orchestration
`main.mjs` owns one concurrency-deduplicated verified refresh. Startup and qualifying foreground returns use the same path. Cached FPL data may be hydrated as fallback, but rendering is deferred while approved sources settle. The final state is rendered once, then a `teamsheet:data-verified` event supports awaited automatic evidence capture.

The foreground path retains previously rendered content but makes decision surfaces inert until activation, preventing reads from partially mutated runtime state. Provider transports, validators, retry budgets, caches and model consumers remain unchanged.

## Stage 10.2 official-outcome boundary
`providers/outcome-validate.mjs` owns strict endpoint-specific validation for Official FPL player totals, filtered fixtures and optional manager outcomes. Duplicate player IDs and conflicting fixture identities fail closed.

`evidence/outcome.mjs` normalises allowlisted facts, requires every assigned fixture plus official event `finished` and `data_checked` before finalisation, links to the eligible Stage 10.1 snapshot without mutating it and emits immutable provisional, complete or corrected revisions with deterministic hashes.

`ui/outcomes.mjs` runs after the verified render, deduplicates checks, processes missed Gameweeks sequentially and retains bounded gzip recovery. Outcome work never blocks access or writes into model state.

## Stage 10.3 metric boundary
`evidence/metrics.mjs` accepts only an officially eligible complete snapshot and a complete/corrected linked outcome with exact season, Gameweek, deadline, manager reference, snapshot ID and hash agreement. It creates immutable `gameweekEvaluation` revisions and later `transferHorizonEvaluation` revisions when every frozen horizon Gameweek is authoritative.

Player points remain player–Gameweek observations. Minutes/probability evaluation uses player–fixture opportunities, preserving doubles without comparing a per-fixture prediction against a two-fixture total. Missing start facts and unallocatable Double Gameweek minutes are excluded only from their affected denominator and remain visible as coverage reasons.

Frozen squad evaluation enumerates legal XIs, applies official-style goalkeeper and ordered outfield automatic substitutions, applies captain-to-vice fallback and labels the realised optimum from the same frozen 15 as a descriptive hindsight oracle. Frozen transfer plans are compared with the stored zero-transfer baseline over the exact stored horizon; realised net gain subtracts hits but not the optimiser's judgement-based roll value.

`ui/metrics.mjs` stores hash-verified compressed evaluation records with a journal, current pointers and bounded superseded revisions. It backfills from locally authoritative outcomes, processes corrections idempotently and renders descriptive metrics under Deadline evidence. It does not create a composite score, classify accuracy as good/bad or alter any recommendation.

## Stage 10.4 operating-review boundary
`evidence/review.mjs` validates retained Stage 10.1–10.3 records sequentially, selects only current evaluation revisions for analysis and retains known revision metadata for audit. Missing or pruned exact records make the review explicitly partial rather than being silently dropped. Unsupported source schemas fail closed.

Weekly review covers source identity, completeness, points, fixture-minutes, uncertainty, frozen XI/captaincy/bench/manager outcome, provider states, correction history and completed transfer horizons. Incomplete transfer horizons remain pending and expose no interim gain. Cumulative review presents all matched and schedule-aligned populations side by side and allows one approved segment dimension/value at a time. It creates no composite score, significance claim, calibration label or automatic model update.

The deterministic export boundary emits one hash-verifiable JSON evidence/review bundle, one Markdown review and eight individually selectable CSV tables. CSV is UTF-8 BOM + CRLF + RFC 4180, preserves numeric zero, leaves structural null blank and neutralises formula-like text including leading whitespace, tab and carriage return. Derived exports omit manager references; exact canonical source records remain unchanged inside JSON for hash verification. Exports warn above 10 MiB and fail above 25 MiB without truncation.

`ui/review.mjs` remains subordinate under More → Deadline evidence. It performs on-demand generation, keeps Google Sheets import manual and introduces no origin, authentication, backend, scheduler or persistent review cache. Verified source `1eca9a8817da41597d0632c819142237d31627fb` passes 413 tests with deterministic exact-identity builds.
