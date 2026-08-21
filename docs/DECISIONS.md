# DECISIONS.md — Architectural decision record

<!-- GW1-P2C2-CURRENT-2026-08-21 -->
## 21 August 2026 — GW1-P2C2 sibling same-site custom-domain transport

**Decision:** stop iterating the failed `github.io` → `workers.dev` Option A transport after the controlled physical diagnostic in which the corrected OPTIONS preflight reached the Worker and returned 204 but the POST never arrived. Prepare, in the repository only, sibling hosts `app.fpltsheet.co.uk` and `archive.fpltsheet.co.uk`.

**Preserved behaviour:** immutable Stage 10 evidence, content-hash identity, durable local outbox, retry/idempotency/fail-closed retention semantics, Access authentication, exact credentialled CORS, and complete separation from recommendation/model/provider calculations. PR #119 is not merged wholesale; only its transport-independent browser outbox/delivery work is carried forward. PR #137 remains the sole adapter-level credentialled-CORS authority.

**Migration/rollback:** the Official FPL gateway exact allowlist may contain both `https://priteshpatel390-del.github.io` and `https://app.fpltsheet.co.uk` during migration. The production build candidate emits only `https://archive.fpltsheet.co.uk/v1/evidence/predeadline` for archive delivery; the exhausted archive `workers.dev` origin is not retained in generated CSP.

**Not decided or approved here:** live DNS, Pages domain activation, Worker Custom Domain/Access deployment, removal of the rollback origin, physical Safari acceptance, any provider/data-source addition, or any model/calculation change.


## D-XIF1 · 2026-08-12 · Accepted · External intelligence is provider-neutral and shadow-only before it can ever influence a recommendation

**Decision:** future external football information enters Teamsheet only through a provider-neutral normalised observation contract, and its first implementation must be `shadow_only`. The required flow is `external fact -> validate -> normalise -> rights/retention gate -> shadow store -> evaluate -> separate approval -> optional production use`. There is no path from shadow storage into fixture context, expected minutes, scoring, best XI, captaincy, transfers, simulation, rank or Mini-Leagues until a later owner-approved change explicitly creates one, and a shadow failure must not alter production behaviour or manufacture Provider Health.

**Reason:** the cheapest way to damage a deterministic, explainable model is to let an interesting new source write directly into it. Keeping acquisition, normalisation and evaluation separate from production consumption means a candidate source can be measured against the information the model already has, instead of being adopted because its standalone correlation looks good. Nine distinct layers — structural team strength, recent performance, market expectation, availability and expected minutes, calendar and workload, set-piece and role, matchup microstats, transfer economics and competitive strategy — must stay separate rather than collapsing into one confidence score, because they carry different double-counting risks and answer different questions.

**Approach:** normalised observations carry explicit identity, value, timing, source, quality, provenance, rights and boundary sections. Timing is first-class and `observedAt`, `effectiveAt` and `fetchedAt` must never be collapsed, because a fact learned after a deadline cannot be treated as though the model knew it before. Canonical identity uses Official FPL IDs; display-name-only joins are rejected. Every source receives one rights/retention classification before persistence, and an unresolved position fails closed. Ablation variants are predeclared before outcomes are inspected.

**Rejected:** blending each new strength-like source into the existing prior by assumption rather than testing it standalone; converting congestion or public team news into an invented fatigue or team-goals penalty when the market may already price it; adding a fixed set-piece points bonus on top of historical xG that already contains penalties; and letting ownership, rank or rival exposure alter football expected points.

**Boundary:** documentation and research only. This decision approves no provider, endpoint, API key, acquisition cadence, retention right, weighting, model, expected-minutes, fixture, squad, captaincy, transfer, optimiser, simulation, rank or Mini-League change, and it does not alter the pre-GW1 freeze. `APPROVED_PROVIDER_NAMES` remains exactly `fpl`, `understat`, `odds`, `archive`. Understat stays team-level only under D-05, the Odds direct-only key boundary stays unchanged under D-06/SEC-1, the unvalidated 45% and 65% blend weights stay unchanged under D-09, and ClubElo remains an unimplemented candidate prior/anchor under D-10. Recording a source in the research matrix is not approval to use it; every step of the post-GW1 sequence needs its own evidence-led proposal and explicit approval. The free-source research is dated 12 August 2026 and must be re-verified from first-party sources before any implementation approval. See [External Intelligence Foundation](EXTERNAL-INTELLIGENCE-FOUNDATION.md).

## D-GW1R1 · 2026-08-12 · Accepted · Teamsheet does not present a weekly transfer optimiser during a period when Official FPL charges nothing for a transfer

**Decision:** before the first Official FPL deadline of a season, the Transfers screen presents no weekly optimiser result, no free-transfer count, no hit cost and no ranked plan, collects no free-transfer or bank assumption, and instead states that initial squad changes are unlimited and points the manager at Team and the Team-setup manual squad builder. Normal weekly behaviour resumes at the deadline instant and for every later Gameweek.

**Reason:** Official FPL allows unlimited changes to the initial squad until the first deadline, so free transfers, transfer costs and points hits do not exist in that window. A `−4 hit` or a `keep 2 free transfers` statement describes rules that are not yet in force, which is actively misleading rather than merely unhelpful. The GW1 readiness audit raised it as a should-fix item.

**Approach:** the window is derived only from verified Official FPL event data already held in state — `nextGW` is 1, no Gameweek is current, none is finished, the GW1 event's `deadline_time` parses, and the current instant is strictly before it. No season calendar date is hard-coded, and a permanent test rejects any dated literal in either Transfers module. Every path that cannot prove the window falls back to the existing weekly behaviour; it never invents an unlimited-change state. A single runtime guard is consulted by route rendering, the ensure path, calculation start and the automatic scheduling timer, and claiming the screen cancels in-flight work and clears the result cache, the recorded optimiser result and any previewed plan.

**Rejected:** hard-coding the season's first deadline date, which would silently rot; treating the deadline instant as still inside the window, which would misstate the rules for the Gameweek that has just begun; and inferring the window from `is_next` alone without the corroborating current/finished conditions, which would trust a contradictory feed.

**Boundary:** presentation and scheduling only. `optimiseTransfers()`, `exhaustiveTransferSearch()`, `transferHit()`, pruning, admissibility, the free-transfer rollover utility and the embedded worker model source are byte-unchanged, and the guard cannot enter the optimiser. No projection, expected-minutes, scoring, fixture, deadline-calculation, squad-legality, captaincy, bench, simulation, rank, Mini-League, provider, routing or hosting behaviour changes. The guard asserts nothing about squad legality, budget or the correctness of the initial 15 players.

**Status:** delivered on **PR #121**, physically accepted by Pritesh on iPhone Safari at head `f72023043813566fe8b11da2d959e374d34bca39`, which passed Verify Teamsheet #262 / `31583716004` with **898/898 tests** — the then-current count for that application head — and the deterministic/provenance/build-identity gates. Its three residual limitations are registered as `GW1R-1` to `GW1R-3`. See [GW1 readiness safety guard](GW1-READINESS-SAFETY-GUARD.md).

## D-GW1P2 · 2026-08-12 · Accepted · The browser reaches the evidence archive through a durable outbox, and delivery is never a recommendation dependency

**Decision:** connect the existing Stage 10 browser capture path to the merged GW1-P1 archive through a durable local outbox and a transport-independent delivery state machine. The canonical record is delivered exactly as stored — delivery must not re-canonicalise, re-hash, strip, restamp or regenerate it — and content-hash idempotency, bounded retry/backoff, single-flight concurrency and fail-closed provider retention are owned by the client. Cloud custody stays a one-way side effect: the recommendation never reads, waits for or fails because of the archive, and a record that cannot be archived stays saved on the device.

**Reason:** GW1-P1 deliberately built the server custody, validation and failure contract first. With that contract proven, the browser half can inherit it rather than define a competing one. A durable outbox is required because an iPhone Safari session is frequently interrupted, so upload cannot be assumed to complete inside the capturing session.

**Boundary:** the direct credentialled cross-origin transport is approved as a **feasibility implementation only**, not as the accepted permanent iPhone transport. No model, expected-minutes, fixture, simulation, squad, captaincy, transfer, rank, Mini-League or provider-acquisition behaviour changes. `OUTBOX_RULES.pinLimit` is held at **4** as a conservative first-cycle policy; the usable device storage ceiling is not evidenced, so that value is not claimed to be proven safe, and no alternative persistence technology may be introduced without a separate proposal.

**Current status:** delivered on draft PR #119 over base `main` `58b834a1824c4977a442e7b3e309e2bbf3d05da1`, exact head `252c5eba0381c8aa5afb7bda1686dd102326c6df`, Verify Teamsheet #255 / `31537859087` passing 931/931. **PR #119 is unmerged and acceptance-incomplete.** The decisive gate is the owner's physical iPhone Safari test with **Prevent Cross-Site Tracking ON** once a genuine Stage 10 record can exist, from **20 August 2026 at 18:30 BST**. If it fails, stop and return with an evidence-led Option B versus Option C comparison; do not make disabling that Safari setting a product requirement and do not implement either alternative without separate approval. See [GW1-P2 Browser evidence delivery](GW1-P2-BROWSER-EVIDENCE-DELIVERY.md).

## D-GW1P1 · 2026-08-11 · Accepted · The D1 evidence architecture is implemented backend-first, with the browser deliberately not connected

**Decision:** implement the backend half of the 2026-08-09 D1 design as a separate Cloudflare Access-authenticated `teamsheet-evidence-archive` Worker with private content-addressed R2 canonical objects and a minimal D1 manifest/receipt/index. The Worker independently revalidates the frozen Stage 10 record, recomputes canonical SHA-256 identity, writes and verifies R2 **before** D1 may claim custody, makes duplicate ingestion idempotent and recovers `R2 success / D1 failure` orphans without fabricating earlier custody. Understat- and Odds-derived permanent archival stays fail-closed.

**Reason:** the existing Stage 10 pre-deadline snapshot needed a secure permanent destination before any client integration was designed. Building the custody, validation and failure contract first means the later browser work inherits a proven server contract instead of defining one.

**Boundary:** backend only. No `src/` change, no Stage 10 capture/local-persistence change, no provider acquisition/weighting change and no model, fixture, minutes, squad, captaincy, transfer, simulation, rank or Mini-League change. The Teamsheet browser does **not** call this service under this decision: automatic client upload and the persistent pending-upload/outbox were GW1-P2 and were separately approval-gated when this decision was recorded. Backend availability is never a recommendation dependency — cloud persistence is a one-way side effect. See [GW1-P1 — Cloudflare Evidence Foundation](GW1-P1-CLOUDFLARE-EVIDENCE-FOUNDATION.md).

**Delivery wording as recorded on 2026-08-11 (historical):** *"Delivered on draft PR #118 over base `main` `43f109b306071aa0c3c1c45985876fecb3da7aa5`; PR #118 is unmerged and requires Pritesh's explicit merge approval."*

**Current status:** Pritesh approved the merge and **PR #118 is merged** at `main` `58b834a1824c4977a442e7b3e309e2bbf3d05da1`. The architectural decision above is unchanged; only its delivery status has moved on. The browser connection it deferred has since been separately approved and implemented as **D-GW1P2** above, which remains unmerged and acceptance-incomplete.

## D-SO1 · 2026-08-10 · Accepted · Shared-state inventory is explicit while semantic ownership stays distributed

**Decision:** `src/state.mjs` declares the legitimate cross-module `S` slot inventory, but it does not become the semantic owner of every value. Existing domain modules retain their established ownership. `S.miniLeagues` is the only writable runtime Mini-League preference representation; the legacy `S.leagues` alias is a one-way read-only compatibility bridge. Zero-dependency source regressions reject undeclared direct `S.key` / static `S['key']` access and require refresh-owned keys to remain an explicit subset of the declared inventory.

**Reason:** A3 State-Ownership investigation found two medium architectural risks but no critical/high ownership defect and no evidence for a general state-management rewrite. The cross-module `S` object lacked a complete mechanically enforceable shared-slot inventory, and the writable Mini-League compatibility alias could become conditionally authoritative over canonical preferences.

**Boundary:** this is narrow ownership hardening, not a new state framework, reducer or central runtime capability system. The source regression is not a general JavaScript data-flow proof for arbitrary computed property access; that remains an accepted limitation. PR #112 merged at `main` `691d9f929284d51c233b61d099c34cafe1030db6` from reviewed head `620daf14d1c354668b16df74daf05e29d8a1eb25`. Post-merge Verify Teamsheet run #167 / `31430700053` passed **864 tests, 864 passed, 0 failed, 0 skipped, 0 cancelled** plus committed provenance, deterministic rebuild, root/deployable equality and exact build identity. No model, provider, persistence-format, error-boundary, Atomic Foreground Refresh, routing-performance or bundler behaviour changed. No physical iPhone testing was performed or claimed. See [A3 State-Ownership Cleanup](A3-STATE-OWNERSHIP-CLEANUP.md).

## D-EB1 · 2026-08-10 · Accepted · Failure ownership is explicit and provider evidence is never fabricated

**Decision:** every failure in the refresh lifecycle has exactly one owner, and only genuine provider transport or validation evidence may move Provider Health. Unexpected application exceptions — including ones escaping optional supporting-provider computation — are classified `internal_error` and are never converted into provider degradation. A recovery-render failure after a genuine collection failure is recorded as a secondary `render_failed` beside the primary `collection_failed` instead of being swallowed.

**Reason:** two confirmed defects. An empty catch on the failure-path render made a real UI failure invisible while the app still claimed the previous verified state was on screen. Separately, any internal exception thrown while computing Understat or Odds was collapsed into a generic provider `fallback`, so an application bug was reported to the user as a named provider being degraded. Provider Health is evidence about the outside world; application code throwing is not evidence about a provider.

**Boundary:** the ownership wrapper `ownApplicationError()` wraps rather than replaces `applyProviderResult()`, so Rule B's retain/clear decision is byte-for-byte the ordinary one and an incompatible old supporting value can never be kept alive because application code threw. Where Rule B clears, the stale provider row is removed rather than published as a false result; a cleared detailed-minute layer removes only the minute detail from the core FPL row. The application boundary is deliberately narrow — the verified-refresh lifecycle edge, beginning before `captureRefreshInputs()` — with **no** global `window.onerror` or `unhandledrejection` layer, because a global swallowing layer would hide real defects. Raw exception text never reaches the user; the error stays on the returned report for tests and diagnostics. No provider endpoint, validation rule, retry cadence, weighting or model calculation changed. See [A3 error-boundary separation](A3-ERROR-BOUNDARY-SEPARATION.md).

## 2026-08-09 — D1 historical/live data platform

**Decision:** use Cloudflare D1 for structured records, private R2 for exact immutable canonical evidence, and a separate authenticated data Worker. Preserve local browser fallback/outbox. Keep Google Sheets optional and downstream. Exclude KV and Durable Objects from the core MVP.

**Reason:** Teamsheet needs relational querying, idempotent revisions and exact evidence larger than D1's single-row limit without coupling recommendations to persistence or a mutable Sheet.

**Boundary:** design/documentation only. See [Data Architecture D1](DATA-ARCHITECTURE-D1.md). Implementation requires later explicit approval. That later approval was given separately on 11 August 2026 and is recorded as **D-GW1P1** above; it authorised the backend half only. The browser half was approved separately again and is recorded as **D-GW1P2** above.
Purpose: permanent chronological log of approved decisions. Audience: all future sessions.
Last updated: 2026-08-12. Related: PROJECT_CONTEXT.md, ROADMAP.md, TEAMSHEET2-PRODUCT-BLUEPRINT.md. Status values: Accepted/Superseded.

ID reconciliation note: on 8 August 2026 the later duplicate `D-36` and `D-37` labels were reassigned to `D-38` and `D-39`. The underlying decision dates, wording and meaning are unchanged.

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

**D-38 · 2026-08-05 · Accepted · Teamsheet 2.0.7 merge with explicit limitation disposition**

Reason: PR #68 passed 533 tests, deterministic builds and physical Safari foreground-resume retest. VoiceOver remained unverified and live populated-data acceptance was externally blocked by FPL-1.

Approach: merge PR #68 after Pritesh's explicit approval, record VoiceOver as an accepted unverified limitation and move the live transport blocker into separately approved FPL-T1 rather than claiming those tests were performed.

Consequences: Teamsheet 2.0.7 is complete at merge `2f7e4ba6978ccd68e9d6c36b56d4063cea06beaf`; no calculation or provider change is implied.

**D-37 · 2026-08-05 · Accepted · Owner-controlled narrow Official FPL gateway**

Reason: Official FPL data is available but the static browser cannot reliably read it through anonymous CORS relays, blocking live populated-data operation and acceptance.

Approach: retain Official FPL as the provider; add one owner-controlled Cloudflare Worker with a closed read-only endpoint/query allowlist, exact-origin CORS, no credential forwarding, five-minute shared caching only for bootstrap/unfiltered fixtures and existing device-cache/restricted fallback. Anonymous relays leave the Official FPL path and remain only for optional Understat transport.

Consequences: no source fields or model/fixture/scoring/squad/captaincy/simulation/optimiser/rank/Mini-League calculation changes. Deployment hostname, full verification and physical live-data acceptance are mandatory before merge.

<!-- TRANSFERS-TRACK-A-2026-08-06 -->
**D-TRF-A · 2026-08-06 · Accepted · Exact persistent on-device Transfers architecture**

Reason: physical iPhone Safari proved that moving the unchanged exhaustive optimiser off the interface thread prevented freezing but did not make its normal workload acceptable; more than five minutes and roughly 1.06 million evaluated plans had not completed depth two, while route exit deliberately discarded valid work.

Decision: preserve the exact Stage 6 football objective and broad candidate universe, but make calculation automatic and application-scoped, keep one worker alive across internal navigation, reuse exact completed results and optimise the search only through mathematically result-preserving preparation, core reuse, low-allocation exact scoring, promising ordering and conservative bounds. `exhaustiveTransferSearch()` remains the independent oracle. Cloudflare remains Official FPL transport only.

Consequences: the normal Calculate/Recalculate buttons are removed; route rendering cannot own or terminate the active calculation; material inputs are fingerprinted; partial work is never called optimal; no heuristic universe or progressive recommendation is introduced. Automated equality and lifecycle contracts pass, but physical iPhone duration, memory and repeated-run acceptance remain mandatory before completion or merge. No prediction-accuracy claim is created.

**D-TRF-B · 2026-08-06 · Accepted · Corrected exact Transfers search after physical iPhone failure**

Reason: the first physical iPhone Safari test of D-TRF-A failed. With verified data, a complete squad, one free transfer, an empty bank, the six-Gameweek horizon and Top 8, the automatic exact search exhausted the unchanged 2,000,000 evaluation ceiling and reported "Exact search did not complete." Fail-closed behaviour was correct, but the product outcome was unusable. Investigation found three causes: partial nodes cost roughly 70–90 microseconds each because they rebuilt and re-sorted squad rows, allocated per candidate and eagerly built an optimistic completion signature; the identity bound mixed the best formation's base with the smallest threshold across formations against a branch-level padded pool, making a candidate's optimistic gain its entire horizon score; and failed candidates were skipped individually rather than ending the enumeration, so every partial node still walked its whole position pool while the optimistic completion allowed each outstanding slot the entire remaining budget.

Decision: keep the approved football problem, comparator, candidate universe, horizon, result limit, transfer depth and evaluation ceiling exactly as they are, and correct only the search architecture. Position-quota score prefix sums replace per-node squad rebuilding; unfilled incoming slots are zero placeholders; bounds become per-formation and node-aware with an explicit threshold-delta correction that stays admissible when projections are negative; optimistic completions are drawn from price-capped tables built once per position and are capped by a joint-budget price limit; descending identity-gain order turns the bound test into a stopping rule; and canonical transfer lists, signatures and per-Gameweek detail are built only for genuine contenders or exact ties. `exhaustiveTransferSearch()` is untouched and shares none of the new pruning.

Consequences: no projection, minutes, scoring, fixture, captaincy, squad, affordability, hit, free-transfer, roll-value or ordering change; no candidate filter of any kind; no ceiling, horizon, depth or Top-8 change; fail-closed behaviour is unchanged. A Node reproduction of the failure shape that previously took 13 minutes 38 seconds over 9,480,866 partial nodes now completes in about 1.2 seconds over 880,555 nodes with `status: 'ok'`, a head-to-head run of both implementations on that input returned identical complete top-8 results, and equality with the independent oracle is proved on controlled pools across seven adversarial shapes. Reduced evaluation counts are a search-efficiency result only and create no prediction-accuracy claim. The corrected search has not yet been physically retested on iPhone Safari, so Track A remains unaccepted and unapproved for merge.

## 2026-08-06 — Concurrent continuation reconciliation

**Decision:** preserve Claude's corrected exact-search architecture and add explicit Worker-wait settlement plus universally optimistic partial signatures.

**Reason:** Worker termination alone does not guarantee promise settlement, and numeric player-ID order is not universally equivalent to locale string order for mixed-width IDs.

**Consequence:** cancellation remains a paused/non-failure state, stale results remain rejected, the final comparator is unchanged and partial tie pruning is deliberately conservative. Permanent runtime and exhaustive-oracle regressions enforce the decision.

## 2026-08-06 — Plain-language decision information

**Decision:** user-facing FPL information must be simple, relevant and immediately understandable. A zero transfer-points cost is displayed as **“No hit”**, never as the mathematically awkward **“−0”**. Paid transfer costs retain their actual deduction, such as **“−4”** or **“−8”**. This is a presentation rule only and does not alter optimiser values, scoring or ranking.


**D-39 · 2026-08-07 · Accepted · Leagues opens with an all-league hub before selected-league detail**

Reason: populated iPhone review showed that opening Leagues directly into one preselected league hides the user's competitive context across their other leagues. The owner wants the first Leagues screen to resemble Official FPL's league directory: every league visible at a glance, then deeper information after choosing one.

Approach: `#/leagues` becomes a lightweight all-league hub using the already-loaded Official FPL classic-league membership list plus locally saved leagues. Positive published membership ranks and supplied previous ranks are shown without fetching every standings table; unpublished pre-season rank remains `Not ranked yet`. Tapping a row persists the existing selected league and opens new ID-free `#/leagues/detail`. Existing standings, rival and selected-rival exposure routes become children of that detail route. Manage leagues is secondary from the hub.

Consequences: no full-league or all-league standings fanout, no provider/endpoint/authentication change, no rank projection, effective ownership, rival prediction, protect/balanced/chase strategy, transfer, squad, fixture or projection-model change. Large-league targeted pages and on-demand rival public-picks loading remain unchanged. Physical iPhone Safari acceptance is required before the Leagues live/populated checkpoint closes. See `docs/LEAGUES-HUB-DESIGN.md`.

**D-40 · 2026-08-08 · Accepted · Refresh-Load R1 uses validated revision-aware supporting caches**

Reason: runtime instrumentation proved that a fresh minute-history cache still generated 95 logical detail requests for a connected squad, an outage could produce 190 physical attempts, Understat was repeatedly loading pages that did not map in the measured response shape, and configured Odds consumed another metered call every eligible cycle. The existing age values described freshness but did not control acquisition.

Decision: preserve Official FPL, Understat and The Odds API as the same approved providers with the same endpoints, validators, retries, model consumers and fallbacks, but make request eligibility explicit. Detailed histories require matching schema/model/season, validated player entries, an unchanged finished-and-data-checked fixture revision and a seven-day correction backstop; only missing/due players are requested, active squad first, and two completely failed four-player batches stop further fan-out. Understat persists only validated normalised team inputs and refreshes after a completed match or 24 hours, with a six-hour failure cooldown. Odds persists only validated key-free derived fixture inputs and refreshes hourly inside 48 hours of a deadline/kickoff or every six hours otherwise; inputs older than six hours do not affect the model. Manual refresh and explicit source-setting changes bypass provider cooldowns. Provider Health keeps the approved seven states and separates detailed-minute age/use from core FPL freshness.

Consequences: a connected unchanged-cache refresh is expected to fall from roughly 102 browser requests to the five core/account requests, while a total minute-history outage stops after eight logical optional calls (at most sixteen physical attempts under the existing two-attempt optional transport). Historical corrections without a fixture revision can remain cached for at most seven days; cached Odds can be up to one hour old near deadlines and six hours old otherwise. No prediction formula, source weight, provider/endpoint/origin, gateway, recommendation, route or golden expectation changes. Understat parser repair, core bootstrap reduction and atomic foreground-state replacement remain separately gated. Physical iPhone live/cached/stale/offline acceptance is required before merge.

**D-41 · 2026-08-09 · Accepted · Reachable two-commit generated-build provenance (A3-R0)**

Reason: the tracked R1 deployable reproduced exactly but recorded a local generating commit that no longer resolves in canonical GitHub history, while the module-only source hash omitted the HTML template and bundler implementation. Decision: preserve `sourceHash` for runtime-module compatibility, add a complete ordered `buildInputHash`, and finalise application checkpoints as a reachable source commit followed by a generated-only commit. CI verifies ancestry, exact source-input equality and byte-for-byte committed-artifact reproduction before running any build that overwrites tracked outputs. Alternatives rejected: stamping the generated commit itself, which is circular; treating a PR head as the source when it does not contain the reviewed build inputs; replacing the custom bundler. Consequences: no application behaviour changes; documentation-only commits may continue after a generated checkpoint when build inputs are unchanged; every later build-input change must regenerate deployables through the same sequence.

**D-42 · 2026-08-09 · Accepted and merged · Direct Team renderer ownership (DTR-1)**

Reason: the accepted Team screen was produced by a full legacy render followed by runtime function replacement, text/class-based node extraction, node reordering, annotation and a second commit. The first pass also owned preview synchronisation and event handlers, while build correctness depended on the async startup yield. Decision: retain one stable `renderSquad()` adapter and make `team-decision-home.mjs` directly create the accepted final Team and support DOM from existing primitives, with explicit Player Detail, flag, rerender and Transfers callbacks. Load the direct renderer before `views.mjs`, and load manual runtime after the stable adapter. Preserve the current visual captaincy stable-order tie behaviour separately from the decision summary's existing player-ID tie-break. Consequences: legacy Team construction, runtime reassignment and post-render DOM surgery are removed; calculations, providers, data sources, routes, CSS, product design, persistence and golden expectations remain unchanged. PR #99 passed permanent CI, reachable two-commit generated provenance and populated physical iPhone Safari acceptance before Pritesh explicitly approved merge at `09e595c275b4f3614c09fb502291de6831813999`.

**D-43 · 2026-08-09 · Accepted · Preserve browser zoom while preventing iPhone form-focus enlargement**

Reason: physical DTR-1 testing showed that focusing a Team resource field enlarged the Safari page and closing the keyboard did not restore its scale. Source inspection found that ordinary editable controls inherited the 15px body size, the global search field separately declared 15px and the password control retained the browser's smaller default; iPhone Safari commonly enlarges focused text-entry controls below 16px. Decision: set the current text, number, search, password, select and textarea control families to 16px, leave checkbox/file/range controls unchanged and retain the unrestricted viewport so browser pinch zoom remains available. Consequences: a small editable-control typography increase applies consistently across routes; no body typography, layout architecture, calculation, provider, persistence, route or account-write behaviour changes. Physical iPhone Safari acceptance passed on PR #100. PR #103 later retained the 16px focus-safety declaration while refining perceived glyph size and control chrome; the owner physically reconfirmed both visual proportion and no-focus-zoom behaviour.

**D-44 · 2026-08-09 · Accepted and merged · Atomic Foreground Refresh**

Decision: foreground, startup and manual refreshes stage all fetched and derived data during a pure collection phase, then apply it through a single synchronous, no-throw, non-reentrant commit. Users see either the previously accepted generation or the completely validated new one, never a mixture.

Reason: `REFRESH-2` allowed a user to observe and act on mixed state during an interactive foreground refresh. Investigation additionally proved that a transient account-endpoint failure erased a valid squad while reporting a successful **Live** refresh, and that a manual **Load data** during an in-flight refresh was silently downgraded.

Approach: collection writes nothing to `S`, the health registry or diagnostics. The commit performs plain assignments only and carries a four-domain rollback journal (`S`, cloned `retryStats`, the module-private health registry, the module-private pending recomputation `Set`). `xpCache` is deliberately outside that journal: failed commits leave the previously accepted cache untouched so its exact values and object identities survive; successful commits invalidate it only at the commit tail. Provider results pass through one shared gate applying two independent rules — a computation signature for in-flight results, and R1's own usability predicates for values already live. Account slices resolve independently against compatibility keys, with `entry` as the root. A persisted `pageshow` advances a page-lifecycle epoch that discards staged work in full. Collection, commit, render and persistence failures are classified separately.

Rejected: a refresh-level generation counter — `verifiedRefreshPromise` already makes refreshes a singleton, so it would guard an unreachable scenario. A hash of the Odds key in signatures — recoverable for low-entropy keys; an opaque in-memory counter carries no key material. A minute-history usage expiry — R1's seven-day rule is a correction backstop, and expiry would degrade the model whenever a correction failed.

Consequences: **account failure or requested absence now reports Partial rather than a misleading Live.** A transient account failure carries the previous squad forward under a matching key instead of deleting it. Presentation and storage failures are no longer attributed to the Official FPL feed. Manual refresh is queued rather than downgraded. No projection, expected-minutes, scoring, fixture, captaincy, squad, transfer, rank or Mini-League formula changes; no provider, endpoint, origin or gateway change; no R1 cadence, cooldown or fallback change; no change to the approved provider registry or the seven health states; `S.minuteHistory` keeps its model-facing shape so Stage 10 evidence structure is unchanged.

Evidence: final PR #102 passed 792 tests (all prior 790 retained, plus two rollback regressions), deterministic/generated provenance, permanent Verify Teamsheet run `31335711523`, independent re-review and physical iPhone Safari acceptance. PR #102 merged to `main` at `d5f2572ee4d95c3c242ecbc97ee46802a6f0273d`.


**D-45 · 2026-08-09 · Accepted · Mobile loading viewport and primary presentation consistency**

Reason: physical iPhone Safari acceptance after PR #102 exposed a light page strip beneath the dark startup experience and a separate pre-existing primary-screen hierarchy inconsistency, most visibly the oversized Transfers heading/intro. Source inspection showed that startup colour belonged only to a fixed overlay while the underlying body retained the light app canvas and 100px dock reserve; the gate also mixed fixed inset geometry with `min-height:100dvh`. Team/Fixtures/Settings headings received the intended 17px panel rule, while nested Transfers and Leagues headings bypassed it.

Decision: make the startup-pending document itself own the dark canvas, remove the normal dock reserve during startup, retain a fixed-position fallback and use `100dvh` where supported, account for all four safe-area insets, and preserve the existing single centred startup composition with the normal shell hidden. After the first physical failure, require an explicit opaque `#10251A` document/gate background colour beneath the gradient so Safari safe-area canvas exposure cannot fall through to the light app background. Establish one structural `primary-page-header` box contract across Team, Transfers, Fixtures, Leagues and Settings—shared inset, border, background, 17px title, 13px intro and spacing—while retaining Leagues' Manage action and each screen's content-specific structure.

Evidence: the first source `0e3a0674416aa069a0f06ebee87854df41907ed0` / generated child `b53c8026a5485936582da1ea2374f9bad799e44d` passed 798 tests and permanent run `31338489146` but failed physical iPhone Safari acceptance. The startup/header correction reached 800 tests and passed device retest; the subsequent form-control refinement retained the 16px focus-safety contract and passed visual/no-zoom device retest; the final Leagues alignment source `646eee13960c343fbe07e3a76496717fd9837c0e` with generated-only child `81cc9130ac2c7b8206f3bd5f6a2cf85bb5ba0777` passes **803 tests**, deterministic/root/provenance gates and permanent Verify Teamsheet run #90 / `31356255017`. Physical iPhone Safari acceptance passed the final Leagues alignment and Pritesh explicitly approved PR #103 for merge on 10 August 2026.

Consequences: presentation only. No projection, expected-minutes, fixture, captaincy, squad, transfer, rank, League, provider, data-source, Atomic Foreground Refresh, refresh cadence, Team-renderer, route, navigation-information-architecture or Player Detail behaviour changes.
