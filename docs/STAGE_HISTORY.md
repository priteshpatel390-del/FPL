# STAGE_HISTORY.md — engineering diary
Purpose: permanent per-stage record. Audience: retrospective/context. Last updated: 2026-07-28.
Related: STAGE1.md, STAGE2.md, STAGE3-DESIGN.md, AUDIT.md (all retained verbatim in /docs).

## Stage 3.5 — DOM-builder rendering (IMPLEMENTED; owner review pending)
Introduced shared text-node-first DOM primitives and migrated the complete approved inventory:
gameweek/source/chip status, ticker and swing notes, player table and drawer, squad/captain/best-XI,
transfers, league output and controls, manual squad/search, core failure states and backtest output.
Hostile provider/user strings now become text nodes rather than HTML. Ask Markdown was explicitly
restored to its Stage 3.4 baseline because AI sanitisation belongs to separately approved Stage 3.6.
Five adversarial checks bring the suite from 189 to 194; formulas and golden results are unchanged.

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

## Stage 3 — Security & hardening (IN PROGRESS)
Design: docs/STAGE3-DESIGN.md (8 deliverables), approved with CSP intentionally specified last.
First implementation: D-13 fixture validation/deduplication in `hydrate()`; DUP-1 closed and suite
96 → 108. Second implementation (2026-07-27): SEC-3 closed — Anthropic key field, persistence,
key headers and hosted browser request removed; one-time stored-config migration added; keyless
Claude-preview path retained. Five focused tests bring the suite to 113. Third implementation:
D-14 per-endpoint schema validation, atomic hydrate and safe issue reporting; VAL-1 closed and suite
113 → 146. Fourth implementation: D-15 bounded transient-only retry with attempt/time ceilings and
normalised metadata for the health model; suite 146 → 179.

Fifth implementation: D-16 Provider Health. The Stage-2 boolean marker was replaced with Live,
Cached, Stale, Fallback, Partial, Disabled and Unavailable while retaining derived `ok` and
`usingFallback` fields for backwards compatibility. FPL, Understat and Odds now report distinct
consequences; provider-specific stale thresholds are derived on read; a compact strip is inserted
into the existing settings panel with DOM nodes. Ten tests bring the suite 179 → 189. The first CI
run correctly caught the removed `usingFallback` compatibility field; the field was restored as a
derived value rather than weakening the old test. Full suite and deterministic two-build comparison
then passed. Item remains in draft PR #2 pending owner review; next is rendering safety.

Owner architecture-review gate remains after Stage 3, before any model work.

## Documentation stage (DONE, 2026-07-26)
Objective: repository becomes source of truth; conversation becomes disposable. Changes: /docs
system (12 files) + CLAUDE.md; no code. Lessons: a several-hundred-turn founding conversation is a
liability; decision records should have started at turn one.
