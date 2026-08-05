# DECISIONS.md — Architectural decision record
Purpose: permanent chronological log of approved decisions. Audience: all future sessions.
Last updated: 2026-08-04. Related: PROJECT_CONTEXT.md, ROADMAP.md, TEAMSHEET2-PRODUCT-BLUEPRINT.md. Status values: Accepted/Superseded.

**D-01 · 2026-07-26 · Accepted · Single-file deployable on GitHub Pages retained (Stage 2 prep)**
Reason: owner deploys from a phone; one-file upload is the only friction-free path. Alternatives: Netlify Drop, Cloudflare Pages (deferred, see D-08), Claude-artifact-only (blocked network). Consequences: no server code, no headers (frame-ancestors ineffective), meta-CSP only, relays needed.

**D-02 · 2026-07-26 · Accepted · No framework; vanilla JS ES modules (Stage 2)**
Reason: zero-dependency environment (no npm registry access), longevity, auditability. Alternatives: Vite+framework (owner-proposed, adapted by agreement). Consequences: custom bundler, naming discipline (unique top-level names), hand-rolled reactivity in views.

**D-03 · 2026-07-26 · Accepted · Deterministic custom bundler with build identity (Stage 2, adj. 9)**
Reason: reproducible deployables; artefact provenance. Alternatives: no build (monolith), Vite. Consequences: import/export stripping contract; manifest + BUILD_INFO; build is a test dependency.

**D-04 · 2026-07-26 · Accepted · Stage-based development with characterisation-test freeze (Stage 1)**
Reason: refactor safety; independent reviewability. Consequences: golden snapshots; expected-to-change quarantine keyed to AUDIT ids; every stage ships docs + tests + deployable.

**D-05 · 2026-07-26 · Accepted · Understat is TEAM-LEVEL ONLY (Stage 3 adjustments, item 3)**
Reason: player xG already Opta-grade via FPL API; player-level Understat would mix providers and needs its own ablation + name-matching strategy. Consequences: any future player-level source is a separately gated decision.

**D-06 · 2026-07-26 · Accepted · Odds requests are direct-only; secrets never transit relays (SEC-1)**
Reason: relay operators could read the key. Consequences: odds unavailable when direct fetch fails; internal model fallback with reduced-confidence labelling; structural (tested), not just policy.

**D-07 · 2026-07-26 · Accepted · Security-first ordering: architecture complete before model changes**
Reason: owner requirement; foundations before formulas. Consequences: Stages 3 and documentation precede Stage 4+ modelling; owner review gate after Stage 3.

**D-08 · 2026-07-26 · Accepted · Serverless migration deferred; Anthropic key BANNED client-side**
Reason: only a low-value odds key exists today; hosted AI is the trigger that makes serverless a prerequisite, not an enhancement. Consequences: Ask works keylessly only inside Claude preview; Stage 3 removes the frontend key field/storage entirely.

**D-09 · 2026-07-26 · Accepted · Market/Understat blend weights are configuration, labelled unvalidated**
Reason: 45%/65% weights were judgement, not evidence; historical odds unavailable on free tier so odds ablation must be prospective. Consequences: ODDS_RULES + weights are versioned; no accuracy claims until out-of-sample results exist (ties to D-11).

**D-10 · 2026-07-26 · Accepted · ClubElo is a candidate prior/anchor, not an xG-layer replacement**
Reason: owner adjustment 4. Consequences: enters future ablation as an early-season prior or promoted-team anchor only.

**D-11 · 2026-07-26 · Accepted · No claimed prediction improvement without out-of-sample validation**
Reason: the historical backtest fitted and reported on the same sample (AUDIT LEAK-1). Consequences: chronological holdout evidence is required; documentation must label historical r=0.80 as method-flattered.

**D-12 · 2026-07-26 · Accepted · Documentation-driven workflow; repository is the source of truth**
Reason: conversation-length limits and continuity across sessions. Consequences: the `/docs` system, CLAUDE.md onboarding, stage-specific chats and documentation updates are mandatory.

**D-13 · 2026-07-26 · Accepted · Fixture deduplication in the Stage-3 validation layer (DUP-1 closed)**
Reason: duplicate fixture rows would inflate projections, fake double-gameweek styling and chip-window notes, and propagate into captaincy, best XI and transfers. Key strategy: provider fixture `id` primary, composite `event+team_h+team_a` fallback only when `id` is absent; genuine doubles are preserved because their rows carry distinct IDs. Conflicting rows sharing one identity are reported as `partial`, never silently resolved; rows with no safe identity are excluded rather than invented. Consequences: `normaliseFixtures` runs in `hydrate()` for fresh and cached data; raw-shaped cache provenance remains; issues surface through Provider Health.

**D-14 · 2026-07-27 · Accepted · Per-endpoint schema validation at the provider boundary (Stage 3 item 2)**
Reason: provider schema drift previously failed silently or crashed consumers mid-render. Approach: one focused pure validator per endpoint returns `{value, issues}`, never mutates provider input and never manufactures identifiers or values. FATAL means the payload cannot be consumed; PARTIAL drops unusable rows while preserving usable data. Core FPL data is validated inside `hydrate()` so fresh and cached inputs share the same path. Optional provider failures degrade to existing fallbacks and do not block core data. Consequences: malformed rows no longer reach consumers and no scoring, projection, calibration or optimisation formula changes.

**D-15 · 2026-07-27 · Accepted · Bounded retry for transient provider failures (Stage 3 item 3)**
Reason: a single transient failure could remove an entire data layer, while unbounded relay retries could make a phone app unusably slow. Approach: deterministic injectable retry with attempt ceilings, capped jittered backoff and elapsed-time budgets. Retryable failures are network/timeout/429/selected 5xx; permanent 4xx, parse and schema-FATAL failures do not retry. One relay cascade is one attempt. Odds 401/429 do not retry. Consequences: healthy providers fetch once; failure paths retain the same fallback; retry metadata is endpoint-normalised and secret-safe. No scoring, projection, calibration or optimisation code changed.

**D-17 · 2026-07-28 · Accepted · Text-node-first rendering for dynamic non-AI views (Stage 3.5)**
Reason: API/provider/user strings were interpolated into `innerHTML`. Approach: shared `el()` and `setChildren()` primitives convert every non-node child to a text node across the approved non-AI inventory. Ask output remains a separately governed restricted-Markdown surface. Consequences: XSS-1 is closed for API/provider/user rendering; adversarial tests and a sink inventory guard the boundary. No model formula, provider behaviour, dependency or layout changed.

**D-18 · 2026-07-28 · Accepted · Deterministic seeded uncertainty and legal squad simulation (Stage 8)**
Reason: expected points alone hide non-appearance risk, tail outcomes, auto-subs and captain fallback. Approach: a separate seeded Monte Carlo layer reconstructs five minutes states from pStart/pAppear/p60/expMin, samples approved scoring components, reports percentiles and explicit blank/return/haul thresholds, and simulates legal bench/captain mechanics. Deterministic `projectXP`, calibration and transfer objectives remain unchanged. Detailed pre-season simulation is disabled rather than manufactured. Consequences: equal inputs produce equal outputs; uncertainty remains model-conditional and needs prospective calibration.

**D-19 · 2026-07-28 · Accepted · Stage 9.3 uncertainty labels are presentation-only absolute widths**
Reason: percentage spreads behave poorly when median is near zero. Pritesh approved Tight ≤2.0 points, Moderate >2.0–5.0 and Wide >5.0. Labels are suppressed when detailed simulation is unavailable or quality is reduced. Consequences: presentation only; Stage 8 sampling, probabilities, projections, captaincy, squad selection and optimisation remain unchanged.

**D-20 · 2026-07-28 · Accepted · Session-only decision previews (Stage 9.4)**
Reason: the owner needs to inspect optimiser and captaincy alternatives without changing the recommendation, saved squad or FPL account. Approach: module-memory preview state applies exact optimiser final squads to cloned entries and routes them through unchanged best-XI logic. Signatures invalidate stale state. Consequences: refresh clears previews; no persistence or FPL submission exists; formulas remain unchanged.

**D-21 · 2026-07-29 · Accepted · Provider Health presentation is global-summary plus More detail (Stage 9.5)**
Reason: degradation must remain visible without crowding the primary workflow. Approach: compact highest-attention state links to full current-session rows under More; setup controls are labelled Settings. Consequences: presentation only; provider states, thresholds, transports, retries, fallbacks and persistence remain unchanged.

**D-22 · 2026-07-29 · Accepted · Class-only presentation and no style-attribute CSP concession (Stage 9.6)**
Reason: runtime style attributes required a broad CSP exception. Approach: static classes, progress and SVG attributes replace runtime style APIs; DOM helpers and build guards reject style attributes. Consequences: no `style-src-attr` or `unsafe-inline`; deterministic visual values; no model/provider/storage/optimiser change. Verified source `4a4b14c1d0f422088c080e714ee259efbd7cc39d` passed 313/313 tests.

**D-23 · 2026-07-29 · Accepted · Deadline-safe prospective evidence and anonymised owner-controlled export (Stage 10)**
Reason: retrospective archives cannot prove what production knew before a deadline. Approach: immutable pre-deadline JSON uses official deadline, two same-origin network-clock observations, 60-second skew limit and two-minute cutoff. Complete network-attested records alone can become official. Records freeze allowlisted inputs/outputs/provider consequences and decisions while excluding account identifiers, configuration and secrets. Hashes detect tampering. Consequences: local storage is bounded recovery and JSON is owner-controlled durable evidence; no external timestamp notarisation; no formula or accuracy claim change.

**D-24 · 2026-07-29 · Accepted · Preserve 5,000 uncertainty samples through invariant-component reuse (Stage 10.1)**
Reason: the first 620-player benchmark exceeded three minutes. Reducing samples would violate the approved design. Approach: calculate deterministic fixture components once, reuse them inside unchanged sampling, omit raw arrays only for summary-only evidence callers and yield projection work in browser-sized batches. Consequences: seed, distributions, sample count, scoring and summaries remain unchanged; physical iPhone acceptance remained required.

**D-25 · 2026-07-29 · Accepted · Verified startup gate, approved-source allowlist and automatic deadline evidence (Stage 10.1 amendment)**
Reason: the owner should enter with one complete verified dataset and not manually manage routine data. Approach: a minimalist startup/foreground gate runs the existing validated source stack, suppresses mixed intermediate renders and releases one final state. Runtime providers are closed to Official FPL, Understat, The Odds API and the versioned archive. Eligible evidence captures automatically; recovery imports remain non-official. Consequences: critical FPL failure restricts recommendations; optional sources retain graceful fallback; static Pages cannot refresh while fully closed. No provider endpoint or formula change.

**D-26 · 2026-07-29 · Accepted · Official FPL-only immutable outcome collection (Stage 10.2)**
Reason: prospective evaluation needs realised facts corresponding to each frozen snapshot without another provider or post-match mutation of predictions. Approach: `/event/{gw}/live/`, filtered fixtures and official event completion are globally authoritative; optional public picks/history supply manager outcomes. Finalisation requires both finished fixtures and official `data_checked`. In-flight facts are provisional; later changed complete facts append corrected revisions. Duplicate players and conflicting fixtures fail closed. Consequences: facts only, recovery imports remain non-current, Team ID is request-only, no model behaviour changes.

**D-27 · 2026-07-29 · Accepted · Immutable descriptive prospective metrics (Stage 10.3)**
Reason: Teamsheet needs to evaluate exact pre-deadline predictions and frozen decisions without recreating them after outcomes are known, leaking post-deadline inputs, collapsing unlike questions into a composite score or presenting hindsight as advice.

Approach: `evidence/metrics.mjs` joins only a complete officially eligible local snapshot to a complete/corrected linked Official FPL outcome with exact season, Gameweek, deadline, manager reference, snapshot ID/hash and unique player/fixture identity. Player points remain player–Gameweek observations; expected minutes and start/appearance/60 probabilities are evaluated per player–fixture opportunity. Metrics include MAE, RMSE, prediction-minus-outcome bias, Pearson, average-rank Spearman, means, coverage/error bands, Brier/reliability and percentile coverage/width. Frozen squad mechanics apply legal goalkeeper/outfield substitutions and captain fallback; the realised optimum from the same frozen squad is labelled `Hindsight oracle`. Frozen optimiser plans are compared with the exact zero-transfer baseline over their stored horizon; realised net gain subtracts hits but not the judgement-based roll-value term.

Corrections append immutable evaluation revisions. Metric storage is compressed, hash-verified, journal-protected and bounded. Early samples display raw-only/descriptive/potentially-stable warnings; provider comparison requires both 100 observations and five affected Gameweeks. The metric engine does not import or execute production projection, expected-minutes, simulation or optimiser functions.

Consequences: no projection, minutes, scoring, fixture, uncertainty, captaincy, squad or transfer formula/threshold changes; no composite score, significance claim, automatic calibration or model update. Actual manager transfer identities are excluded because Stage 10.2 does not store them. Provider comparisons are observational, not causal. The historical r=0.80 remains method-flattered. Verified source `3eaae862b8a8277e450af062ff4bcecd15b12f3f` passes **397/397 tests** with generated artefacts at `8c4b60a367b9858146b42ff8710d888856462c21`.

## D-10.4 — Operating review and export
- **Decision:** Stage 10.4 is a pure downstream review/export layer over immutable Stage 10.1–10.3 records. It may not call production projection, expected-minutes, simulation, squad or optimiser functions.
- **Decision:** current evaluation revisions drive analysis; all known revision metadata remains auditable; missing/pruned exact records produce an explicit partial status.
- **Decision:** show all matched and schedule-aligned cumulative views side by side, with one selected segment at a time and existing descriptive sample safeguards.
- **Decision:** no composite score, significance claim, good/bad classification, calibration claim, causal provider claim or automatic model update.
- **Decision:** exports are deterministic JSON, Markdown and eight separate CSVs; no XLSX, ZIP or one-click multi-download.
- **Decision:** CSV is BOM/CRLF/RFC 4180, keeps numeric zero distinct from blank null and neutralises spreadsheet formulas while preserving genuine negative numbers.
- **Decision:** exact JSON source records retain canonical manager references for hash verification; derived review, Markdown and CSV omit them.
- **Decision:** Google Sheets import remains manual and targets the live 2026/27 workbook only. Automatic sync, OAuth, backend and scheduling require a separate approved stage.
- **Decision:** 10 MiB warning and 25 MiB hard rejection, with no silent truncation or splitting.
- **Evidence:** source `1eca9a8817da41597d0632c819142237d31627fb`, generated `1af7dac5383c91e915587218e7551c2f619cec8f`, 413/413 tests, deterministic exact-identity builds.

## D-Stage10.5 — Explicit recovery, no migration engine
Approved 2026-07-30. Current version-1 Stage 10 records have no older supported schema requiring conversion. Unknown versions fail closed; immutable records are never silently repaired or rewritten. A future migration must be separately approved, deterministic, one-way, fixture-tested and preserve the original exact record. Snapshot retries are five-minute visible checks capped at three per verified dataset/window priority.

**D-28 · 2026-07-30 · Accepted · Teamsheet 2.0 team-first product blueprint and incremental migration**
Reason: the verified application had accumulated strong model, provider, evidence and UI foundations, but its Stage 9 information architecture remained tool-oriented and did not consistently centre the manager's complete team, weekly decisions or Mini-League competition.

Approach: adopt `TEAMSHEET2-PRODUCT-BLUEPRINT.md` as the authoritative future product direction. Teamsheet becomes explicitly team-first, decision-first, explainable, mobile-first and progressively disclosed. Primary navigation becomes Team, Transfers, Mini Leagues and Settings. More is replaced by Settings; Players leaves primary navigation; replacement discovery moves into Transfers; advanced exploration moves to Settings → Research Tools. Mini Leagues becomes a flagship destination. Doing nothing and rolling remain valid recommendations. Official results and projections remain distinct. The migration proceeds through independently designed and approved checkpoints 2.0.1–2.0.7.

Consequences: the Stage 9 information architecture is superseded for future development, but its historical decisions and engineering foundation remain valid. This decision changes no application code, formula, provider, Provider Health state, evidence contract, framework, build or deployment boundary. Teamsheet 2.0.1 — Navigation and Settings architecture is the next separate design and approval gate. Any protect, balanced or chase strategy model, projected-rank model or formula change requires its own explicit approval.

**D-29 · 2026-07-31 · Accepted · Teamsheet 2.0.1 five-destination navigation and hash routing**
Reason: the manager needs weekly resources and fixtures immediately available, Leagues must fit cleanly on iPhone, Ask Teamsheet is regularly used, and the Stage 9 click-to-hide/More hierarchy could not support refresh-safe deep links, Back/Forward navigation or an organised Settings menu.

Approach: primary navigation is Team, Transfers, Fixtures, Leagues and Settings. Free transfers and bank remain visible on Team. Players moves to Settings → Research Tools. Ask Teamsheet is a full `#/ask` destination reached from Team and a global header action rather than a sixth bottom tab. A central hash router owns route normalisation, legacy aliases, browser history, active navigation, title, focus and safe fallback. Existing stateful DOM nodes move into the five Settings categories without cloning. The historical Stage 10.5 physical rehearsal remains recorded, but its outstanding standalone rehearsal gate is superseded by checkpoint-level iPhone checks and final 2.0.7 acceptance.

Consequences: fixture, league, provider, evidence and model behaviour remain unchanged. Hashes are used because direct path routes can fail on static GitHub Pages. URLs contain no account IDs, keys or evidence identities. Player-detail URL routing, Team/Transfers redesign, rank intelligence and Mini-League strategy remain excluded and separately gated.

## Teamsheet 2.0.1 physical-review decisions — 31 July 2026

- Use one compact Ask Teamsheet field with an internal claret upward arrow on every route; do not use separate Data, Evidence or Ask header pills.
- Use a fixed five-column iPhone safe-area dock with controlled monochrome SVG icons.
- Preserve programmatic route-heading focus but suppress the visible focus outline on non-interactive headings.
- Use one arrow-only Settings back control without duplicate Settings labels.
- Treat foreground refresh, populated-preview transport and authoritative bank/free-transfer retrieval as separate investigation gates; this approval does not authorise their implementation.

**D-30 · 2026-07-31 · Accepted · Teamsheet 2.0.2 pitch-first Team decision home**
Reason: the verified Team route had a strong pitch, best-XI, captaincy, bench and preview foundation, but setup, forecast and warning blocks pushed the pitch down and no-squad states removed it entirely. Existing copy also overstated the transfer conclusion and inferred protect/chase captain strategy from ownership.

Approach: wrap the unchanged Team renderer with a presentation-only decision hierarchy. Show provenance, recommended XI/captain/vice/bench, explicit base-XI and captain-uplift forecast, one material risk, advisory deadline action and the immediate pitch. Preserve a labelled placeholder pitch when a legal 15 is unavailable. Move setup and supporting detail below the immediate decision. Treat close captaincy as model uncertainty; ownership remains context only. Direct the separate roll/transfer decision to Transfers.

Consequences: no projection, expected-minutes, fixture, squad, captaincy, bench, simulation, optimiser, rank, league, provider, authentication, refresh, persistence, route or player-detail behaviour changes. D-21's historical More placement is superseded by D-29's Settings architecture; its provider-state principle remains valid. Verified baseline: **454/454 tests**, deterministic exact-identity builds, root/deployable equality, model `2.4.0`, rules `2026-27.3`.

### D-31 — Transfer decisions use an explicit zero-transfer comparison

**Decision:** Present the optimiser's required zero-transfer baseline as a first-class option, label net output as a model comparison, expose hit and free-transfer utility separately, and avoid claiming that making no transfer is optimal when no comparable legal plan was returned.

**Reason:** The previous wide table obscured the decision and could overstate incomplete evidence. This change improves interpretation without changing any calculation.

**Boundary:** No transfer, projection, squad, provider, rank or Mini-League formula changes. Physical iPhone and VoiceOver acceptance remains separate.

**D-32 · 2026-08-02 · Accepted · Teamsheet 2.0.4 official Mini-League foundation with ID-free routes**

Reason: the previous Leagues route sampled the top 10–30 managers, fanned out public picks requests and labelled threshold-based ownership tables as threats/differentials. It did not reliably answer the manager's official position, movement, nearest gaps or selected-rival context and could overstate an incomplete sample.

Approach: use only existing public Official FPL entry, classic standings and picks endpoints. Persist minimal league/rival choices under a versioned local state contract; keep fetched standings and squads session-only. Present official current position, supplied movement, simple points gaps, nearby standings and one selected rival's captaincy/squad overlap. Use semantic `#/leagues/*` routes without identifiers. Remove unsupported threat, covered-template and win/lose claims. Large leagues use targeted and user-requested pages rather than automatic full scans.

Consequences: no provider, origin, authentication, projected-rank model, effective-ownership model, differential score, protect/balanced/chase strategy or Team/Transfers/model calculation changes. 2.0.5 remains the separate intelligence gate. Physical iPhone and VoiceOver acceptance remain required before merge.

**D-33 · 2026-08-02 · Accepted · Explicit selected-rival factual exposure without strategy modelling**

Reason: the merged 2.0.4 foundation could compare one public rival accurately, but it did not show which exact squad, captain and chip differences recur across the small set of managers the user actually cares about. A full-league scan, ownership percentage or tactical label would overstate partial public data and create unacceptable phone, relay and privacy costs.

Approach: add ID-free `#/leagues/exposure` for no more than five explicitly selected rivals. Public current-Gameweek picks load only after a user action, with concurrency two and current-session reuse. Aggregate player/captain/vice/chip counts include only fresh complete 15-player squads; not-loaded, incomplete, unavailable and stale records remain explicit. Counts are labelled as selected-rival facts, not whole-league ownership. Version-2 local state persists only the explicit IDs and labels. Optional Official FPL context fields are validated before aggregation, and invalid context degrades without discarding otherwise valid ownership.

Consequences: no provider, origin, authentication, full-league fan-out, projected rank, rival-score prediction, remaining-player simulation, effective-ownership strategy, differential recommendation, protect/balanced/chase logic or Team/Transfers/model calculation change. Physical iPhone, VoiceOver and live populated-data acceptance remain separate review gates. The implementation must not merge without explicit owner approval.

**D-34 · 2026-08-04 · Accepted · Route-owned advanced content and consequence-led provider warnings**

Reason: the approved five-part Settings hierarchy existed, but evidence, outcomes, metrics, review, exports, recovery and provider controls were still assembled into broad technical pages through DOM relocation and sibling-order assumptions. Healthy provider status and engineering detail should not compete with weekly FPL decisions.

Approach: give each Settings goal an identifier-free route-owned landing and child route; create explicit mount hosts for Stage 10 UI modules; move exports to Evidence & Performance and recovery/deletion to Data & Diagnostics; keep full seven-state Provider Health under Settings; show primary warnings only when core Official FPL availability materially affects the current action; complete Help & About from existing repository truth; preserve Player Explorer calculations while using mobile result cards; and restore focus to the opener through hash history.

Consequences: D-21's global compact Provider Health presentation is superseded. Provider state vocabulary, thresholds, transport, retries, fallbacks, persistence, evidence schemas, export formats and every model/fixture/squad/captaincy/optimiser/Mini-League calculation remain unchanged. Routes contain no account, league, manager, key or evidence-record identity. Physical iPhone, VoiceOver and live populated-data acceptance remain separate merge gates.

**D-35 · 2026-08-04 · Accepted · Teamsheet 2.0.6 completion and 2.0.7 approval boundary**

Reason: PR #65 was explicitly approved and merged after the 2.0.6 implementation documentation had already been finalised for draft review, leaving canonical status records inconsistent with repository history.

Approach: record Teamsheet 2.0.6 as complete and merged through PR #65 at `cd1ad52ea4d13a247a82bc90f80f2db0b6f77aa4`, with the verified **520 passed, 0 failed, 0 skipped** baseline, deterministic builds, root/deployable equality, model `2.4.0` and rules `2026-27.3`. Preserve the fact that no provider, data source or calculation changed. Carry physical iPhone Safari, VoiceOver and live populated-data acceptance forward as explicit Teamsheet 2.0.7 limitations rather than reopening 2.0.6.

Consequences: this decision is documentation-only and changes no application source, test, generated file, provider, data source, model, fixture, scoring, squad, captaincy, simulation, optimiser, rank or Mini-League calculation. Teamsheet 2.0.7 is the next formal checkpoint, beginning with investigation and design only. Implementation requires a separately approved exact scope.


## Teamsheet 2.0.7 approved implementation boundary — 4 August 2026

Pritesh approved Scope S-2.0.7 for final mobile polish and acceptance. The implementation is limited to semantic controls, 44-pixel targets, restricted-state completion, route/focus/scroll behaviour, Player Detail route safety, Ask presentation resilience, Fixture render isolation, table semantics, exact Transfers wording and evidence-led responsive corrections. Football calculations, providers, data sources, persistence schemas, trust boundaries and account-write behaviour remain unchanged. Physical iPhone Safari, VoiceOver and live populated-data acceptance remain mandatory before completion.


## D-36 · 2026-08-05 · Accepted · Safari foreground-resume refresh correction

Reason: physical iPhone acceptance found that returning to Safari after an unsuccessful startup load could immediately start another blocking Official FPL refresh, making the app appear frozen.

Approach: timestamp every completed refresh attempt for the existing ten-minute automatic cooldown, retain in-flight promise deduplication for paired Safari resume events, keep foreground refresh interaction non-blocking, and preserve the force-enabled manual **Load data** retry.

Consequences: this is refresh orchestration and interaction behaviour only. It changes no provider, endpoint, data source, model, fixture, scoring, squad, captaincy, simulation, optimiser, rank, Mini-League, persistence or security logic. Physical iPhone retesting remains required.

**D-36 · 2026-08-05 · Accepted · Teamsheet 2.0.7 merge with explicit limitation disposition**

Reason: PR #68 passed 533 tests, deterministic builds and physical Safari foreground-resume retest. VoiceOver remained unverified and live populated-data acceptance was externally blocked by FPL-1.

Approach: merge PR #68 after Pritesh's explicit approval, record VoiceOver as an accepted unverified limitation and move the live transport blocker into separately approved FPL-T1 rather than claiming those tests were performed.

Consequences: Teamsheet 2.0.7 is complete at merge `2f7e4ba6978ccd68e9d6c36b56d4063cea06beaf`; no calculation or provider change is implied.

**D-37 · 2026-08-05 · Accepted · Owner-controlled narrow Official FPL gateway**

Reason: Official FPL data is available but the static browser cannot reliably read it through anonymous CORS relays, blocking live populated-data operation and acceptance.

Approach: retain Official FPL as the provider; add one owner-controlled Cloudflare Worker with a closed read-only endpoint/query allowlist, exact-origin CORS, no credential forwarding, five-minute shared caching only for bootstrap/unfiltered fixtures and existing device-cache/restricted fallback. Anonymous relays leave the Official FPL path and remain only for optional Understat transport.

Consequences: no source fields or model/fixture/scoring/squad/captaincy/simulation/optimiser/rank/Mini-League calculation changes. Deployment hostname, full verification and physical live-data acceptance are mandatory before merge.
