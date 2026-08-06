# ARCHITECTURE.md
Purpose: detailed technical architecture. Audience: developers before changing code.
Last updated: 2026-08-04. Related: PROJECT_CONTEXT.md, TEAMSHEET2-PRODUCT-BLUEPRINT.md, DATA_SOURCES.md, TESTING.md, SECURITY.md.

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
    data-warning.mjs    consequence-led core Official FPL warning classification and rendering
    evidence.mjs        phone-first snapshot status with explicit export/recovery/storage hosts
    outcomes.mjs        non-blocking outcome orchestration, bounded revisions and recovery-only restore
    metrics.mjs         metric storage, correction processing, transfer-horizon completion and descriptive reporting
    review.mjs          phone-first operating review controls and JSON/Markdown/CSV downloads
    mini-leagues-state.mjs versioned local League/rival choice state
    mini-leagues-view.mjs standings, pairwise comparison and selected-rival exposure
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

## Teamsheet 2.0.1 UI and routing boundary
`ui/app-shell.mjs` owns the implemented Team, Transfers, Fixtures, Leagues and Settings primary destinations, the secondary Ask Teamsheet route, hash normalisation, legacy aliases, browser history, active-link state, route focus and the five-section Settings hierarchy. The old direct click-to-hide navigation in `ui/views.mjs` is removed.

Existing functional nodes are relocated rather than cloned: weekly Team ID/free-transfer/bank context moves into Team; Player Explorer moves under Settings → Research Tools; evidence/outcomes/metrics/review remain under Settings → Evidence & Performance; Provider Health and optional provider/calibration controls live under Settings → Data & Diagnostics; the existing League comparison and Fixtures ticker become primary destinations. Ask Teamsheet remains functionally unchanged and is linked globally and from Team.

The router stores no account, provider-key or evidence identity in the URL. It does not own model state, provider state or persisted configuration. Player detail remains an accessible dialog rather than a URL route. The owner-approved Teamsheet 2.0.1 boundary changes presentation and navigation only.

## Teamsheet 2.0.6 Settings organisation boundary
`ui/app-shell.mjs` extends the 2.0.1 router with route-owned landings and child destinations under Team & Account, Research Tools, Evidence & Performance, Data & Diagnostics and Help & About. Unknown nested Settings paths fail to the nearest approved landing. Every child route owns an exact heading and parent link; browser history remains hash-based and a remembered opener restores focus when returning through Settings.

The shell creates explicit hosts for outcome, metric, review, export, recovery, diagnostic and dataset-deletion UI. `ui/evidence.mjs`, `ui/outcomes.mjs`, `ui/metrics.mjs` and `ui/review.mjs` mount only into those hosts rather than inferring placement from sibling order or `parentElement`. Their evidence engines, storage keys, schemas, hashes, revision rules and export bytes remain unchanged.

`ui/data-warning.mjs` translates only core Official FPL availability into primary consequences. Healthy, Partial and deliberately Disabled optional states stay in Settings. Cached, Stale or Fallback core data produces one saved-data warning; unavailable core data blocks only routes that require it. Full seven-state Provider Health remains session-scoped under `#/settings/data/providers`. This module does not change provider thresholds, transport, retry or fallback behaviour.

Player Explorer retains the same filters, projection ordering and Player Detail controller. CSS presents its existing rows as stacked cards on narrow screens. Help & About reads public `BUILD_INFO` fields and documents existing recommendation, uncertainty, privacy and operational boundaries without introducing state or network access.

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

`ui/metrics.mjs` stores hash-verified compressed evaluation records with a journal, current pointers and bounded superseded revisions. It backfills from locally authoritative outcomes, processes corrections idempotently and renders descriptive metrics under Settings → Evidence & Performance → Performance metrics. It does not create a composite score, classify accuracy as good/bad or alter any recommendation.

## Stage 10.4 operating-review boundary
`evidence/review.mjs` validates retained Stage 10.1–10.3 records sequentially, selects only current evaluation revisions for analysis and retains known revision metadata for audit. Missing or pruned exact records make the review explicitly partial rather than being silently dropped. Unsupported source schemas fail closed.

Weekly review covers source identity, completeness, points, fixture-minutes, uncertainty, frozen XI/captaincy/bench/manager outcome, provider states, correction history and completed transfer horizons. Incomplete transfer horizons remain pending and expose no interim gain. Cumulative review presents all matched and schedule-aligned populations side by side and allows one approved segment dimension/value at a time. It creates no composite score, significance claim, calibration label or automatic model update.

The deterministic export boundary emits one hash-verifiable JSON evidence/review bundle, one Markdown review and eight individually selectable CSV tables. CSV is UTF-8 BOM + CRLF + RFC 4180, preserves numeric zero, leaves structural null blank and neutralises formula-like text including leading whitespace, tab and carriage return. Derived exports omit manager references; exact canonical source records remain unchanged inside JSON for hash verification. Exports warn above 10 MiB and fail above 25 MiB without truncation.

`ui/review.mjs` remains subordinate under Settings → Evidence & Performance. It performs on-demand generation, keeps Google Sheets import manual and introduces no origin, authentication, backend, scheduler or persistent review cache. This is the current Teamsheet 2.0 placement and does not change the review architecture. Verified source `1eca9a8817da41597d0632c819142237d31627fb` passes 413 tests with deterministic exact-identity builds.

## Stage 10.5 recovery architecture
Stage 10 storage uses verified payload writes, phase journals, index/current-pointer commitment and bounded pruning. Recovery trusts local origin only when a valid journal links the candidate ID and hash; unproven or imported records remain recovery-only. Shared diagnostics expose corruption/storage states without raw payloads, URLs or secrets. Downloads are owner-controlled browser requests rather than acknowledged durable backups.

## Teamsheet 2.0.1 iPhone shell amendment

The global shell owns one persistent Ask composer, one fixed five-column safe-area navigation dock, controlled SVG navigation icons, route focus presentation and keyboard-viewport recovery. Data and Evidence remain full Settings destinations rather than global header controls. Provider transport and foreground-refresh orchestration are unchanged.

## Teamsheet 2.0.2 Team decision-home boundary

`ui/team-decision-home.mjs` wraps the existing verified `renderSquad()` output and reorganises its already-calculated nodes. It consumes unchanged `mySquad()`, `bestXI()`, `xpOf()`, team-pitch captaincy and session-preview contracts. It adds no football formula and does not invoke the transfer optimiser or simulation engine.

The wrapper requires a complete legal 15 before exposing a recommendation; otherwise it renders a labelled decorative pitch placeholder. Connected/manual/cache/preview provenance, base-XI xP, captain uplift, total including captain, one presentation-priority risk and an advisory deadline action are explicit. Team setup remains after the immediate pitch, while captaincy and all-15 research are collapsed progressively.

The existing Stage 10.1 verified startup and foreground interaction lock are unchanged. Official FPL transport reliability, authoritative bank/free-transfer retrieval and atomic non-blocking foreground refresh remain separately gated.

## Teamsheet 2.0.3 transfer presentation boundary

The durable route remains `#/transfers`. `src/ui/transfer-optimiser-view.mjs` is presentation-only: it owns assumptions synchronisation, presentation states, preview invalidation and vertical decision cards, and cannot enter the optimiser. `src/ui/transfer-performance.mjs` owns the single `renderTransfers()` renderer, the explicit calculate/cancel actions, batched projection preparation, the session result cache and the Blob Web Worker that runs the search off the UI thread. The worker embeds the reviewed `src/model/transfers.mjs` verbatim — the build emits it as `TRANSFER_WORKER_MODEL_SOURCE` — so the background search and a direct `optimiseTransfers()` call execute identical code and nothing rewrites the optimiser at runtime. `src/model/transfers.mjs` remains the sole calculation owner and bounds plan retention to the requested result count. Plans and previews are session-only; only free transfers, bank, horizon and result count persist.

## Teamsheet 2.0.4 Mini-League boundary

`src/ui/mini-leagues-state.mjs` owns version-1 local selection state only: selected league, saved/primary leagues, selected rival and at most five pinned rival identifiers per league. It migrates the previous `fpl:config.leagueId` and `fpl:leagues` records deterministically. Standings, points and rival squads remain session-only and are not written to persistent storage or Stage 10 evidence.

`src/ui/mini-leagues-view.mjs` owns `#/leagues`, `#/leagues/standings`, `#/leagues/rival` and `#/leagues/manage`. Routes contain no league or manager identifier. The view consumes the existing Official FPL transport and validators, loads page 1 plus pages surrounding the manager's official membership rank, and loads further standings only on request. Rival public picks are fetched one selected manager at a time. Points gaps and squad overlap are simple arithmetic/set derivations from official fields; no rank prediction, differential score, protect/chase strategy or model recommendation is introduced.

`validateEntry()` now filters public classic-league membership rows. `validateStandings()` requires the official rank, total, manager/team display names and validates pagination fields used by the UI. Missing or malformed rows degrade visibly. Existing provider retry, relay, security and core-data criticality are unchanged.

## Teamsheet 2.0.5 selected-rival intelligence boundary

`src/ui/mini-leagues-state.mjs` owns version-2 local choice state. It adds `comparisonRivalsByLeague`, capped at five minimal `{id,name}` records. Version-1 migration is deterministic and leaves the explicit comparison set empty; pinned rivals are suggestions rather than silent approval for public-picks requests. Removing a league removes its selected comparison group. Standings, scores, picks, captaincy, chips, freshness and derived exposure remain session-only.

`src/ui/mini-leagues-view.mjs` owns ID-free `#/leagues/exposure` in addition to the 2.0.4 routes. Opening the route does not request rival squads. An explicit user action loads only the selected current-Gameweek public picks, with at most two logical requests concurrently and reuse by league/rival/Gameweek. A deterministic selection key prevents late requests from changing a newer comparison. Previous valid current-session data may remain visible as stale after refresh failure, but stale records are excluded from the default fresh aggregate.

Aggregate exposure requires the user's squad and each included rival squad to contain 15 unique resolved player IDs in unique positions 1–15. Exact counts cover player ownership, captain, vice-captain and active-chip context across complete fresh selected rivals. Wording is `X of N loaded selected rivals`, never whole-league ownership, effective ownership, projected outcome or strategy advice. Not-loaded, incomplete, unavailable, stale and outside-loaded-standings states remain separate.

`validateEntry()`, `validateStandings()` and `validatePicks()` validate the optional rank, current-Gameweek total, multiplier, captain, vice and chip fields used by the feature. Invalid optional context degrades to unknown while retaining otherwise valid ownership IDs. The existing Official FPL provider, transport, retry, security, CSP and criticality boundaries are unchanged. No scoring, projection, expected-minutes, fixture, squad, captaincy, simulation, rank or transfer-optimiser module is imported or modified.


## Teamsheet 2.0.7 final-polish architecture

- Hash routes now retain per-route scroll positions for browser Back/Forward and restore route openers only when they remain visible.
- Nested direct links receive exact route-heading focus after the verified startup gate releases.
- Player Detail closes before an underlying route transition and never restores focus to a detached or hidden opener.
- No-core-data startup dispatches a presentation-only restricted state; no projection, XI, optimiser or League calculation is invoked without verified core data.
- Ask Teamsheet exposes an honest disabled hosted state while preserving the approved artifact-preview path and client-secret ban.
- Fixture display controls rerender only their dependent presentation surfaces.

- Foreground resume uses the timestamp of the last completed refresh attempt, not only the last successful verification; automatic retries retain the ten-minute cooldown and do not make the application inert.

## FPL-T1 Official FPL gateway boundary
The static GitHub Pages application remains unchanged as the UI host. `src/providers/transport.mjs` reads one exact HTTPS `/fpl` gateway base from a build-validated meta tag and never sends Official FPL traffic through anonymous public relays. `workers/fpl-gateway.mjs` accepts only approved read-only endpoint families, rebuilds the upstream request from an allowlist and returns JSON with exact-origin CORS. Existing validators, retry metadata, device cache, Provider Health and restricted-state behaviour remain downstream and authoritative.

<!-- TRANSFERS-TRACK-A-2026-08-06 -->
## Transfers Track A — exact persistent calculation boundary

`src/ui/transfer-performance.mjs` now owns one application-scoped transfer calculation controller. A route render is a subscriber to that controller rather than the owner of a worker. Once verified player data, a complete legal squad and valid bank/free-transfer/horizon assumptions exist, preparation and exact search begin automatically after the interface can paint. Internal Team, Fixtures, Leagues and Settings navigation does not terminate the job; returning to Transfers restores its current progress or exact completed result.

The controller fingerprints build/model/rules identity, verified-data revision, Gameweek, squad and purchase prices, player price/availability and prepared projection values, bank, free transfers, horizon, result limit and search limits. Material changes supersede and terminate obsolete work. Route changes and unrelated renders do not. One worker and one current job may exist; explicit cancellation is available, and Retry is reserved for a genuine failure. Full reload/page closure remains a session boundary.

`src/model/transfers.mjs` preserves the approved Stage 6 objective, comparator, candidate eligibility and evaluation ceiling. Exact performance work precomputes the player-by-Gameweek score surface, reuses each outgoing squad core, scores non-contending leaves through a lower-allocation exact XI path, materialises complete plan detail only when a candidate can enter retained top K, explores promising branches earlier and applies only conservative upper bounds that cannot remove a possible retained result. The independent `exhaustiveTransferSearch()` remains deliberately separate and unchanged in purpose for differential verification on reduced pools.

This boundary adds no provider, network origin, persistence database or Cloudflare optimisation. Projection, expected-minutes, fixture, scoring, selling-price, hit, free-transfer, roll-value, maximum-depth, horizon, captaincy, bench and result-order behaviour remain unchanged. Deadline evidence may still call the optimiser directly outside this UI controller and remains a separately documented main-thread path.

## 2026-08-06 — Exact-search bound correction

The Transfers worker still runs the canonical optimiser verbatim in one app-scoped Web Worker. The search remains complete and exact.

The search tree now combines two safe optimistic ceilings:

1. the existing relaxed per-position best-XI ceiling; and
2. an identity-preserving ceiling built from each remaining candidate's best possible marginal contribution across the horizon.

At each node, the tighter ceiling may prune only when the branch cannot beat the current top-K frontier under the full existing comparator. Equal-score pruning uses optimistic bank remaining, doubtful-incoming count and canonical signature. Affordability and club checks remain exact leaf constraints.

No candidate pre-filter, heuristic shortlist, approximate scoring path or altered evaluation ceiling was introduced.
