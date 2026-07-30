# DECISIONS.md — Architectural decision record
Purpose: permanent chronological log of approved decisions. Audience: all future sessions.
Last updated: 2026-07-29. Related: PROJECT_CONTEXT.md, ROADMAP.md. Status values: Accepted/Superseded.

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
