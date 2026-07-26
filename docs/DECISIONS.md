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
