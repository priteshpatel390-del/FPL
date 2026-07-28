# DECISIONS.md — Architectural decision record
Purpose: permanent chronological log of approved decisions. Audience: all future sessions.
Last updated: 2026-07-26. Related: PROJECT_CONTEXT.md, ROADMAP.md. Status values: Accepted/Superseded.

**D-01 · 2026-07-26 · Accepted · Single-file deployable on GitHub Pages retained (Stage 2 prep)**
Reason: owner deploys from a phone; one-file upload is the only friction-free path. Alternatives:
Netlify Drop, Cloudflare Pages (deferred, see D-08), Claude-artifact-only (blocked network).
Consequences: no server code, no headers (frame-ancestors ineffective), meta-CSP only, relays needed.

**D-02 · 2026-07-26 · Accepted · No framework; vanilla JS ES modules (Stage 2)**
Reason: zero-dependency environment (no npm registry access), longevity, auditability. Alternatives:
Vite+framework (owner-proposed, adapted by agreement). Consequences: custom bundler, naming
discipline (unique top-level names), hand-rolled reactivity in views.

**D-03 · 2026-07-26 · Accepted · Deterministic custom bundler with build identity (Stage 2, adj. 9)**
Reason: reproducible deployables; artefact provenance. Alternatives: no build (monolith), Vite.
Consequences: import/export stripping contract; manifest + BUILD_INFO; build is a test dependency.

**D-04 · 2026-07-26 · Accepted · Stage-based development with characterisation-test freeze (Stage 1)**
Reason: refactor safety; independent reviewability. Consequences: golden snapshots; expected-to-
change quarantine keyed to AUDIT ids; every stage ships docs + tests + deployable.

**D-05 · 2026-07-26 · Accepted · Understat is TEAM-LEVEL ONLY (Stage 3 adjustments, item 3)**
Reason: player xG already Opta-grade via FPL API; player-level Understat would mix providers and
needs its own ablation + name-matching strategy. Consequences: any future player-level source is a
separately gated decision.

**D-06 · 2026-07-26 · Accepted · Odds requests are direct-only; secrets never transit relays (SEC-1)**
Reason: relay operators could read the key. Consequences: odds unavailable when direct fetch fails;
internal model fallback with reduced-confidence labelling; structural (tested), not just policy.

**D-07 · 2026-07-26 · Accepted · Security-first ordering: architecture complete before model changes**
Reason: owner requirement; foundations before formulas. Consequences: Stages 3 (security) and this
documentation stage precede Stage 4+ modelling; owner review gate after Stage 3.

**D-08 · 2026-07-26 · Accepted · Serverless migration deferred; Anthropic key BANNED client-side**
Reason: only low-value odds key exists today; hosted AI is the trigger that makes serverless a
prerequisite, not an enhancement. Consequences: Ask tab works keylessly only inside Claude preview;
Stage 3 removes the frontend key field/storage entirely.

**D-09 · 2026-07-26 · Accepted · Market/Understat blend weights are configuration, labelled unvalidated**
Reason: 45%/65% weights were judgement, not evidence; historical odds unavailable on free tier so
odds ablation must be prospective. Consequences: ODDS_RULES + weights versioned in config; no
accuracy claims until out-of-sample results exist (ties to D-11).

**D-10 · 2026-07-26 · Accepted · ClubElo is a candidate prior/anchor, not an xG-layer replacement**
Reason: owner adjustment 4. Consequences: enters the Stage-5/7 ablation as early-season prior or
promoted-team anchor options only.

**D-11 · 2026-07-26 · Accepted · No claimed prediction improvement without out-of-sample validation**
Reason: current backtest fits and reports on the same sample (AUDIT LEAK-1). Consequences: walk-
forward with train/calibrate/holdout separation is the Stage-7 acceptance bar; documentation must
label the current r=0.80 as method-flattered.

**D-12 · 2026-07-26 · Accepted · Documentation-driven workflow; repository is the source of truth**
Reason: conversation-length limits; continuity across sessions. Consequences: this /docs system;
CLAUDE.md onboarding; every stage updates docs; fresh chat per stage (see CLAUDE.md workflow).

**D-13 · 2026-07-26 · Accepted · Fixture deduplication in the Stage-3 validation layer (DUP-1 closed)**
Reason: duplicate fixture rows would inflate projections, fake double-gameweek styling and chip-window
notes, and propagate into captaincy, best XI and transfers. Input-integrity fix; no formula, weight,
calibration, optimiser or ranking rule altered. Key strategy: provider fixture `id` primary, composite
`event+team_h+team_a` fallback only when `id` is absent; genuine doubles are preserved because their
rows carry distinct ids. Conflicting rows sharing one identity are reported as `partial`, never
silently resolved; rows with no safe identity are excluded and reported rather than having identity
invented. Alternatives considered: dedupe inside `teamFixtures` (rejected — repeated per call, and
hides the issue from health reporting); dedupe in `slim()` only (rejected — cached snapshots would
bypass validation and the issue would never be re-reported). Consequences: `normaliseFixtures` runs in
`hydrate()` on every load for both fresh and cached data; `slim()` deliberately preserves the
raw-shaped list for provenance; issues surface on `S.dataIssues` for the health strip.

**D-14 · 2026-07-27 · Accepted · Per-endpoint schema validation at the provider boundary (Stage 3 item 2)**
Reason: VAL-1 — no runtime validation of provider responses, so schema drift either failed silently or
crashed a consumer mid-render. Approach: one focused validator per endpoint in `src/providers/validate.mjs`,
extending the D-13 pattern rather than replacing it. Each returns `{value, issues}`, is pure, never mutates
provider input, and never manufactures identifiers, values or missing structures. Issues carry
`{provider, endpoint, code, severity, count}` plus at most a bounded diagnostic field (field names or a
received-type string) — never rows or payloads. FATAL means the payload cannot be safely consumed and
`value` is null; PARTIAL means bad rows are dropped and the usable remainder is retained. The first valid
row wins wherever duplicates are possible, consistent with D-13.
Placement: core FPL data (bootstrap + fixtures) is validated inside `hydrate()`, so cached and fresh
snapshots take the identical path; a fatal payload returns early with state untouched rather than leaving a
half-populated `S`. A separate fatal-only `bootstrapStructure()` guard runs before `slim()` on the fresh
path only, because `slim()` maps the four collections and would throw first — and because a payload that
broken must never reach the cache. Row-level filtering is deliberately NOT applied before `slim()`, so the
cached snapshot stays raw-shaped for provenance exactly as D-13 specified.
Optional providers (entry, picks, history, standings, rival picks, Understat, odds, archive) report through
`recordIssues(provider, endpoint, issues)`, which replaces rather than appends so repeated panel refreshes
stay idempotent; pooled fan-out is collapsed by provider+endpoint+code so twenty bad rival squads cannot
flood `S.dataIssues` with twenty near-identical entries.
Alternatives considered: a single generic schema-description validator (rejected — it hides the per-endpoint
assumptions that actually matter when a feed drifts, and every endpoint here has different fatal/partial
semantics); validating inside `transport.api()` (rejected — transport is endpoint-agnostic and would need a
registry mapping paths to schemas, adding indirection for no gain); throwing on fatal optional-provider
payloads (rejected — optional providers must degrade to their existing fallbacks, never block core data).
Consequences: malformed provider rows no longer reach consumers, so output can differ from Stage 2 only when
the feed itself is malformed. No scoring, projection, calibration or optimisation formula was touched.

**D-15 · 2026-07-27 · Accepted · Bounded retry for transient provider failures (Stage 3 item 3)**
Reason: a single dropped packet or momentary 503 cost the user a whole layer of data, with no
distinction drawn between "try again" and "this will never work". Approach: a pure retry engine in
`src/providers/retry.mjs`, integrated inside the transport layer so consumers never learn a retry
happened. `withRetry(task, policy, deps)` runs a plain bounded `for` loop — no recursion, and all
timing dependencies (`sleep`, `random`, `now`) are injectable so the whole engine is unit-testable
with a fake clock.
Classification: retryable = network error, timeout, 429, 500, 502, 503, 504. Non-retryable =
400/401/403/404, JSON parse failure, and schema-FATAL. The task closure classifies its own failure
rather than this layer catching generically, because only the caller can tell a dead socket from a
malformed body — collapsing that distinction is exactly how malformed payloads end up being retried.
D-14 validation runs after transport and its failures never re-enter the retry loop.
Bounding: three simultaneous limits — an attempt ceiling (clamped to 5 regardless of what a policy
asks for), a capped half-jitter exponential backoff, and an elapsed-time budget checked before each
sleep. The budget is the load-bearing one: an FPL relay cascade can take ~40s to fail, so an
attempt ceiling alone would have permitted a two-minute wait. Retry cheap failures, not expensive ones.
Placement: one relay cascade counts as ONE attempt. Rotating relays is transport selection and is
already the redundancy mechanism; retrying each of five relays three times would mean fifteen
requests per call. Optional FPL endpoints get 2 attempts rather than 3, because rival picks are
pooled twenty at a time and they already degrade gracefully.
Alternatives considered and rejected: honouring `Retry-After` (RET-1 — under a relay the header
describes the proxy, not the origin, and an arbitrary server-chosen delay conflicts with keeping a
phone app responsive); a per-provider circuit breaker (RET-2 — it needs the durable provider-down
signal that item 4 exists to produce, and duplicating that state privately inside transport would be
the wrong shape); retrying at the individual relay level (far too slow); retrying odds 429 (an
exhausted quota window is not transient, and retrying burns time for the same answer).
Consequences: healthy providers behave identically and are fetched exactly once — asserted by test.
Failure paths retry within bounds and then produce exactly the same fallback as before. Retry
metadata lands on `S.retryStats`, keyed by provider and a normalised endpoint (digit runs collapsed
to `{id}`, query strings stripped) so it can neither grow per manager nor carry the odds API key.
No scoring, projection, calibration or optimisation code was touched.

**D-17 · 2026-07-28 · Accepted · Text-node-first rendering for dynamic non-AI views (Stage 3.5)**
Reason: API, provider and user strings were interpolated into `innerHTML`, allowing names or notes to
be interpreted as markup. Approach: shared `el()` and `setChildren()` primitives convert every
non-node child to a text node. The complete approved inventory—gameweek/source status, ticker,
players and breakdowns, squad/captaincy, transfers, leagues, manual squad/search, core errors and
backtest output—uses real DOM nodes while retaining its existing classes, semantics and listeners.
Ask output is deliberately excluded and restored to the Stage 3.4 baseline; AI/Markdown policy is a
separate Stage 3.6 decision after design approval. Alternatives rejected: generic HTML sanitisation
(new policy and parser surface), escaping strings before `innerHTML` (easy to omit and contrary to
the approved construction model), and bundling CSP/AI/key work (stage-discipline violation).
Consequences: XSS-1 is closed for API/provider/user rendering; five adversarial tests and a static
sink inventory guard the boundary. No model formula, provider behaviour, dependency or layout changed.

**D-19 · 2026-07-28 · Accepted · Exact full-squad transfer optimisation (Stage 6)**
Plans contain zero to three transfers and rank by horizon best-XI xP minus four-point paid-transfer hits plus one point per next-Gameweek free transfer. Full 15-player legality and combined selling-value affordability are mandatory. Exhaustive search is the reference; production branch-and-bound uses safe upper bounds and never top-N candidate pruning. See `STAGE6-DESIGN.md`.
