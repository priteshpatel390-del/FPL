# STAGE_HISTORY.md — engineering diary
Purpose: permanent per-stage record. Audience: retrospective/context. Last updated: 2026-07-26.
Related: STAGE1.md, STAGE2.md, STAGE3-DESIGN.md, AUDIT.md (all retained verbatim in /docs).

## Pre-stage era (v1.x, founding conversation)
Objective: working product. Changes: full app built iteratively (ticker → xP engine → transfers →
league → data layers → backtest → calibration → multi-league → persistence). Issues discovered &
fixed en route: availability discount missing from attacking returns (caught by synthetic tests);
bonus over-calibration; settings lost on failed load (save-on-input rewrite); GitHub Pages 404
(Index.html capitalisation); Claude-preview sandbox blocks network (moved to Pages). Lessons:
characterise before touching anything (→ Stage 1); test names must describe reality.

## Stage 1 — Characterisation & audit (DONE, owner-verified)
Objective: freeze behaviour; audit data stack. Changes: none to app. Files: tests/harness.mjs,
tests/characterisation.test.mjs, tests/golden.json, run-tests.sh, docs/AUDIT.md, docs/STAGE1.md.
Tests added: 77. Issues discovered: 13 (AUDIT §3) incl. SEC-1 key-via-relay, LEAK-1 calibration
leakage, MIN-1 minutes. Lessons: expected-to-change quarantine keeps honesty and refactor-safety
compatible. Outstanding: none (audit decisions delegated to owner).

## SEC-1 hot-fix (DONE, deployed)
Objective: stop the odds key transiting relays immediately. Changes: relay fallback removed from
loadOdds; degrade-to-internal-model note. Files: app.js (then src/providers/odds.mjs), tests/
sec1.test.mjs. Tests: +1 (fetch-spy). Lessons: security fixes ship separately from refactors.

## Stage 2 — Module extraction (DONE, owner-approved)
Objective: modular architecture without behaviour change. Changes: 17 src/ modules (verbatim moves
via tools/split.py + sanctioned edits: odds provenance/rules/kickoff-matching, slim() fixture
fields, cache envelope, pure computeBacktest + provenance, registry, escapeHTML). Files: src/**,
build.mjs, tests/unit.test.mjs, tests/resilience.test.mjs, README-BUILD.md. Tests: 96 total.
Issues discovered BY the suites during extraction: dropped final line of init IIFE (bundle syntax);
duplicate computeBacktest export; wrong relative import paths in generated headers; hydrate's DOM
touch breaking direct imports. All fixed same-stage. Lessons: the characterisation gate earned its
keep four times in one stage; generated code needs path tests. Outstanding: BT-1 pinning; views
module intentionally monolithic until Stage 9.

## Stage 3 — Security & hardening (DESIGNED, awaiting approval)
Design: docs/STAGE3-DESIGN.md (8 deliverables). Open judgement calls for owner: fixture-id dedupe
inside validation (DUP-1); style-src-attr concession. Issue resolved during design review:
misleading duplicate-fixture test title corrected (tests and audit now agree). Owner has mandated a
full architecture review gate after Stage 3, before any model work.

## Documentation stage (THIS, 2026-07-26)
Objective: repository becomes source of truth; conversation becomes disposable. Changes: /docs
system (12 files) + CLAUDE.md; no code. Lessons: a several-hundred-turn founding conversation is a
liability; decision records should have started at turn one.
