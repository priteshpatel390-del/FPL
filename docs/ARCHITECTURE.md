# ARCHITECTURE.md

## 10 August 2026 — calibration persistence boundary candidate

PR #107 (draft) makes `fpl:calib` a fail-closed restore boundary: generic stored JSON no longer reaches `S.calib`; every currently stored calibration record is rejected as contract-unverified, left byte-for-byte in storage, and standard uncalibrated projection state remains active. The existing live scoring multiplier code is unchanged and the Stage 7 walk-forward path remains diagnostic-only. A future production calibration record requires a separately approved season/model/rules/methodology/dataset contract before any activation path may be added. Verified candidate head `69e539647ae687f49605633505e7147da76125e2` passed Verify Teamsheet run #123.



## Mobile viewport and primary-screen presentation boundary

**Physical correction:** the first candidate passed automation but failed iPhone Safari. The accepted boundary requires an explicit opaque startup document/gate background colour beneath the decorative gradient, and the five primary routes share one structural `primary-page-header` presentation block rather than only selector-level font tokens. Leagues retains its Manage action as an action variant. The later form-control visual refinement preserved the 16px focus-safety contract, and the empty Leagues live-status placeholder no longer contributes vertical space. Final physical iPhone Safari acceptance passed on 10 August 2026. This remains presentation-only.

The accepted PR #103 mobile presentation boundary keeps startup ownership in the existing gate: header, main and the primary dock remain hidden/inert until `teamsheet:startup-ready`. During startup the document canvas itself now carries the dark loading background with `100vh` fallback and `100dvh` modern sizing, while the fixed gate uses all four safe-area insets. Primary Team, Transfers, Fixtures, Leagues and Settings titles/intros use explicit shared presentation tokens instead of depending on whether an `h2` is a direct `.panel` child. This is presentation-only: routing, navigation information architecture, refresh orchestration and football calculations remain unchanged.

## Approved future persistence boundary (D1 design)

[Data Architecture D1](DATA-ARCHITECTURE-D1.md) selects Cloudflare D1 for relational/queryable records and private R2 for exact content-addressed evidence, mediated by a separate authenticated data Worker. This is a future boundary only: the existing Official FPL gateway and deterministic browser calculation path remain independent, and persistence failure must not change recommendations. Google Sheets is downstream reporting only. No infrastructure or runtime implementation is approved.
Purpose: detailed technical architecture. Audience: developers before changing code.
Last reconciled: 2026-08-08. Related: PROJECT_CONTEXT.md, TEAMSHEET2-PRODUCT-BLUEPRINT.md, DATA_SOURCES.md, TESTING.md, SECURITY.md.

## Directory structure
```
app.html                UI shell/template
build.mjs               deterministic bundler and CSP emitter
build-utils.mjs         tested static import/export stripping and module-syntax guard
run-tests.sh            production build + complete node:test suite
index.html              generated GitHub Pages deployment copy; never hand-edit
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
    transfers.mjs       exact 0–3 transfer optimiser and its position-quota search machinery
    xp.mjs              import-compatible re-export shim; deliberately excluded from the flat bundle
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
    app-shell.mjs       hash router, primary shell, Settings hierarchy and route focus/history
    data-warning.mjs    consequence-led core Official FPL warning classification and rendering
    team-decision-home.mjs direct owner of the accepted decision-first Team DOM
    team-pitch.mjs      visual pitch/player primitives
    player-detail.mjs   dialog lifecycle, focus, scroll and route-safe closing
    transfer-performance.mjs application-scoped Worker controller and sole Transfers renderer
    transfer-optimiser-view.mjs Transfers presentation helpers and assumption state
    evidence.mjs        phone-first snapshot status with explicit export/recovery/storage hosts
    outcomes.mjs        non-blocking outcome orchestration, bounded revisions and recovery-only restore
    metrics.mjs         metric storage, correction processing, transfer-horizon completion and descriptive reporting
    review.mjs          phone-first operating review controls and JSON/Markdown/CSV downloads
    mini-leagues-state.mjs versioned local League/rival choice state
    mini-leagues-view.mjs all-league hub, selected-league detail, standings, pairwise comparison and selected-rival exposure
    views.mjs           general screen rendering plus the stable Team-render adapter
    ...                 decision previews, manual squad routing, restricted Markdown, downloads, recovery and security wiring
tests/                  characterisation, model, simulation, provider, security, evidence, metric and build tests
docs/                   canonical guidance plus indexed historical project records
dist/                   generated deployable; never hand-edit
workers/                separately deployed, allowlisted Official FPL Cloudflare gateway
.github/workflows/      permanent exact-revision pull-request verification
```

Safe Hygiene A2 removed the former `tools/split.py` one-off Stage 2 migration script plus its fixed list of declaration-only helpers/constants and unused imports. It changed no runtime ownership or public behaviour and merged through PR #95.

## Dependency flow
Configuration and state feed providers, storage and model modules. Official FPL element histories populate `S.minuteHistory`. `model/minutes.mjs` owns expected-minutes probabilities and aggregate fallback. `model/scoring.mjs` consumes that boundary and returns the unchanged deterministic `{total,perGW,games,parts}` projection surface.

`model/transfers.mjs` holds two independent searches. `exhaustiveTransferSearch()` is the reduced-pool oracle and is deliberately unoptimised; it shares no pruning with production. `optimiseTransfers()` is the production exact search. Because every legal transfer is position-preserving, each node's position pool always holds exactly the position quota, so the search carries per-position, per-Gameweek descending score arrays and prefix sums instead of rebuilding squad rows; an unfilled incoming slot is a zero placeholder. Bounds are per-formation and node-aware, optimistic completions come from price-capped tables built once per position, and each position pool is enumerated in descending identity-gain order so a failed bound ends the enumeration rather than skipping one candidate. Full plan detail — canonical transfers, signature and per-Gameweek best XI — is materialised only for a genuine contender. The evaluation ceiling, comparator, candidate universe and result ordering are owned by the approved model, not by this machinery.

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

Within Leagues, `#/leagues` is a lightweight all-league membership hub and `#/leagues/detail` is the selected-league overview. The hub uses already-loaded entry membership facts and does not fan out standings requests; `#/leagues/standings`, `#/leagues/rival` and `#/leagues/exposure` remain ID-free child destinations that load only the selected league context.

Existing functional nodes are relocated rather than cloned: weekly Team ID/free-transfer/bank context moves into Team; Player Explorer moves under Settings → Research Tools; evidence/outcomes/metrics/review remain under Settings → Evidence & Performance; Provider Health and optional provider/calibration controls live under Settings → Data & Diagnostics; the existing League comparison and Fixtures ticker become primary destinations. Ask Teamsheet remains functionally unchanged and is linked globally and from Team.

The router stores no account, provider-key or evidence identity in the URL. It does not own model state, provider state or persisted configuration. Player detail remains an accessible dialog rather than a URL route. The owner-approved Teamsheet 2.0.1 boundary changes presentation and navigation only.

## Teamsheet 2.0.6 Settings organisation boundary
`ui/app-shell.mjs` extends the 2.0.1 router with route-owned landings and child destinations under Team & Account, Research Tools, Evidence & Performance, Data & Diagnostics and Help & About. Unknown nested Settings paths fail to the nearest approved landing. Every child route owns an exact heading and parent link; browser history remains hash-based and a remembered opener restores focus when returning through Settings.

The shell creates explicit hosts for outcome, metric, review, export, recovery, diagnostic and dataset-deletion UI. `ui/evidence.mjs`, `ui/outcomes.mjs`, `ui/metrics.mjs` and `ui/review.mjs` mount only into those hosts rather than inferring placement from sibling order or `parentElement`. Their evidence engines, storage keys, schemas, hashes, revision rules and export bytes remain unchanged.

`ui/data-warning.mjs` translates only core Official FPL availability into primary consequences. Healthy, Partial and deliberately Disabled optional states stay in Settings. Cached, Stale or Fallback core data produces one saved-data warning; unavailable core data blocks only routes that require it. Full seven-state Provider Health remains session-scoped under `#/settings/data/providers`. This module does not change provider thresholds, transport, retry or fallback behaviour.

Player Explorer retains the same filters, projection ordering and Player Detail controller. CSS presents its existing rows as stacked cards on narrow screens. Help & About reads public `BUILD_INFO` fields and documents existing recommendation, uncertainty, privacy and operational boundaries without introducing state or network access.

## Browser persistence boundary

`src/storage.mjs` owns every durable browser record other than the Stage 10 evidence stores. Persistence is a separate concern from data acquisition: a local write failure is a local persistence failure and never changes Official FPL or optional-provider health.

Records carry explicit compatibility identity. The main `fpl:cache` is written as a `teamsheet.main-fpl-cache` envelope with a cache version, the repository schema version, the exact `FPL_RULES.season` and a fetched timestamp; the immediately preceding raw shape is accepted only when its Official FPL event deadlines establish the current season. `fpl:config` version 1 separates season-independent preferences from a season-owned account section. `fpl:squad` version 1 and `fpl:mini-leagues` version 3 are season-owned and fail closed. Incompatible records are rejected before application state is mutated rather than promoted to current data. `fpl:calib` is deliberately unchanged and remains behind the model approval gate.

Three write surfaces exist and are not interchangeable. `sset()` is the untouched legacy fire-and-forget writer. `ssetChecked()` is the refresh persistence surface: it reports serialisation and browser write outcomes so the Atomic Foreground Refresh phase can classify `persist_failed`. `ssetVerified()` is the user-owned surface: it writes and reads the value back, so success means the record is actually restorable.

Both reporting surfaces respect backend authority. When a storage manager is selected it owns both the write and the subsequent read, and the read order only consults `localStorage` when the manager read is itself unusable. A `localStorage` fallback is therefore attempted only when it is the backend the next read will use; otherwise the write is reported as a failure and no divergent copy is created. A failed user-owned write leaves the change active for the current session and raises a persistence warning stating that it may revert after reload.

## Provider Health and storage
Provider Health remains session-scoped with Live, Cached, Stale, Fallback, Partial, Disabled and Unavailable states. Core Official FPL freshness remains the FPL row's primary state; R1 adds a separate detailed-minute age/cache-use detail so optional history failure cannot mislabel a current core feed.

R1 keeps three schema/model/season-bound supporting caches:

- detailed histories store validated per-player rows, successful timestamps and the finished-plus-data-checked fixture revision that produced them;
- Understat stores only validated normalised team inputs, completed-fixture revision and secret-free cooldown metadata—never raw HTML;
- Odds stores only validated derived fixture inputs, check/success times and secret-free cooldown metadata—never the API key or keyed URL.

The active connected/manual squad precedes the unchanged 80-player detailed-history research cohort. Only missing, invalid, revision-due or seven-day-backstop-due histories are requested. Two completely failed four-player batches stop a systemic fan-out. Understat refreshes after completed matches or 24 hours, with a six-hour automatic failure cooldown. Odds refreshes hourly inside the approved 48-hour deadline/kickoff window and six-hourly otherwise; derived inputs older than six hours do not enter the model. Explicit manual refresh bypasses supporting-provider cadence/cooldowns. Stage 8 results and Stage 9.4 decision previews remain session-computed and are not persisted.

When the browser definitively reports `navigator.onLine === false`, core refresh stops before any gateway or optional-provider request. An already hydrated verified snapshot remains active with FPL `Fallback`, explicit offline copy and its original success time; no cached HTTP response can be relabelled as a new live success. This is an in-app acquisition guard, not an offline application shell or service worker.

## Build and deployment
`node build.mjs` emits `dist/app.bundle.js`, `dist/manifest.json`, single-file `dist/index.html` and a byte-identical root `index.html` deployment copy. The existing `sourceHash` identifies the 50 ordered runtime modules. A separate `buildInputHash` identifies those modules plus `app.html`, `build.mjs` and `build-utils.mjs`, so template or bundler changes cannot retain an apparently unchanged build identity. Model/rules versions, exact `BUILD_COMMIT`, module order and the complete input list are embedded.

Committed deployables use a two-commit finalisation sequence. The first commit contains the reviewed source/build inputs; the build is stamped with that immutable source commit; a second commit contains only the generated outputs. CI requires the manifest source commit to resolve and be an ancestor of the reviewed head, confirms every declared build input matches that source commit and reproduces all four tracked outputs byte-for-byte before any ordinary test build can overwrite them. Same inputs and identity must produce byte-identical artefacts, and the root deployment copy must match `dist/index.html` exactly.

## Security posture
Dynamic provider/user strings use DOM builders; AI output uses a restricted Markdown AST. Odds requests remain direct-only and diagnostics are scrubbed. The single inline production script and style element are SHA-256 hash locked by CSP. Stage 9.6 removes all source/generated style attributes, forbids runtime style APIs and removes both `style-src-attr` and `unsafe-inline`. Stage 10 metric records reuse allowlist construction, forbidden-secret checks, canonical hashes and recovery-only storage boundaries.

## Testing
Characterisation tests execute the built production bundle. Direct imports cover formulas and contracts. R1 adds request-count/order, revision/age, missing-only refresh, outage-guard, timestamp, provider-cadence, cache-validation, secret-free persistence, manual-bypass and definite-offline disclosure coverage. Stage 10.3 retains pure metric and storage suites covering exact calculations, identity/revision rules, blank/double/postponed fixtures, fixture-minute allocation, legal automatic substitutions, captain fallback, frozen transfer horizons, sample safeguards, deterministic serialisation, tamper detection and non-mutation. Existing production formula and golden suites remain unchanged.

## Future serverless architecture
Static UI shape can remain while selected provider calls move behind approved serverless functions for secret storage, headers, origin controls, rate limiting and server-side validation. This remains deferred until hosted AI or another approved trigger requires it.

## Stage 10 prospective-evidence boundary
`evidence/snapshot.mjs` reads already validated runtime state and existing model functions, then emits an explicit allowlisted record. It never serialises `S` or configuration wholesale. Every record includes exact build/model/rules identity, canonical inputs and outputs, provider consequences, whole-record SHA-256 and section/provider hashes. Import recomputes those hashes and fails closed on tampering or an unknown schema.

Capture uses the official FPL event deadline, samples same-origin HTTP `Date` before and after collection and applies the approved timing policy. This is timing evidence, not external timestamp notarisation. All-player live uncertainty retains 5,000 samples; invariant component reuse is performance-only.

`ui/evidence.mjs` keeps three small metadata rows and two compressed full recovery records. Writes and deletion are verified and failures are surfaced. Exports remain complete, canonical, unencrypted JSON. Local recovery is not the canonical long-term archive.

## Stage 10.1 verified-startup orchestration
`main.mjs` owns one concurrency-deduplicated verified refresh. Startup and qualifying foreground returns use the same path. Cached FPL data may be hydrated as fallback, but rendering is deferred while approved sources settle. R1 changes which supporting requests are due, not this orchestration boundary. The final state is rendered once, then a `teamsheet:data-verified` event supports awaited automatic evidence capture.

Startup and explicit manual loading own the interaction gate. Foreground refresh keeps the previously rendered interface interactive while provider state is replaced before the final render; a fully atomic foreground-state replacement remains a separately gated structural improvement. R1 reduces the duration/frequency of that exposure but does not claim to solve it.

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

`src/ui/mini-leagues-state.mjs` owns local selection state only: selected league, saved/primary leagues, selected rival and at most five pinned rival identifiers per league. It migrates the previous `fpl:config.leagueId` and `fpl:leagues` records deterministically. The record is now version 3 and season-owned; a version-1/2 or season-mismatched record is not promoted, and current Official FPL league membership is rediscovered instead. Standings, points and rival squads remain session-only and are not written to persistent storage or Stage 10 evidence.

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

`src/model/transfers.mjs` preserves the approved Stage 6 objective, comparator, candidate eligibility and evaluation ceiling. After the physical iPhone Safari failure the exact search was rebuilt around position-quota score prefix sums, zero placeholders for unfilled incoming slots, per-formation and node-aware admissible bounds with a threshold-delta correction for negative projections, price-capped optimistic completion tables under a joint-budget price cap, descending identity-gain stopping rules, and materialisation of complete plan detail only for a genuine contender or an exact tie. Every bound is optimistic in the relaxed constraints, so no branch that could enter the retained top K is removed. The independent `exhaustiveTransferSearch()` remains deliberately separate, unoptimised and free of the production pruning for differential verification on reduced pools.

This boundary adds no provider, network origin, persistence database or Cloudflare optimisation. Projection, expected-minutes, fixture, scoring, selling-price, hit, free-transfer, roll-value, maximum-depth, horizon, captaincy, bench and result-order behaviour remain unchanged. Deadline evidence may still call the optimiser directly outside this UI controller and remains a separately documented main-thread path.

## 2026-08-06 — Concurrent continuation reconciliation

The reconciled architecture keeps Claude's exact position-pool prefix sums, admissible price-capped completion, joint-budget bounds and descending-gain stopping rules.

The app-scoped controller additionally owns a one-shot cancellation settlement callback for the currently awaited Worker result. Cancel, material invalidation and force-start replacement settle that wait with an internal `AbortError`; the existing outer controller treats it as intentional cancellation and releases the superseded job's retained data.

For comparator ties, a partial search node uses `''` as its optimistic signature because every real transfer signature is non-empty. The exact unchanged canonical signature is used once the branch is complete. This is more conservative pruning and cannot alter final ordering.

## Atomic Foreground Refresh

The refresh lifecycle is a four-phase pipeline: **collect → commit → render → persist**.

Collection is pure — it writes nothing to `S`, the health registry or diagnostics, and returns everything it would have mutated as data. The commit is synchronous, no-throw and non-reentrant, containing plain assignments only. Because it holds no suspension point, and `S` carries no accessor property or `Proxy`, no observer can see it part-way; that is what allows a foreground refresh to remain interactive without an inert lock.

`src/providers/applied.mjs` owns the supporting-provider boundary: per-provider tokens, computation signatures (Rule A), existing-value compatibility (Rule B, expressed in R1's own predicates), and `applyProviderResult()` — the single gate shared by the refresh commit and the exported provider wrappers.

Persistence follows the commit and uses `ssetChecked`, so a write failure is classified `persist_failed` rather than being silently swallowed. `sset` is unchanged for every other caller.

See [Atomic Foreground Refresh](ATOMIC-FOREGROUND-REFRESH.md) for the full design, the two-rule model, account compatibility keys, minute-history provenance and the error-classification table.
