# STAGE_HISTORY.md — engineering diary
Purpose: permanent per-stage record. Audience: retrospective/context. Last updated: 2026-07-28.
Related: STAGE1.md, STAGE2.md, STAGE3-DESIGN.md, STAGE4-DESIGN.md, STAGE5-DESIGN.md, AUDIT.md.

## Stage 5 — Scoring corrections (MERGED 2026-07-28)
Implemented the owner-approved 2026/27 scoring rulebook, deterministic Poisson grouped scoring for saves and goals conceded, defensive-contribution threshold probability, empirical awarded-bonus shrinkage, explicit rare disciplinary/penalty events, penalty-role gating and real blank/double fixture-run scoring. The public projection surface and downstream squad/captaincy/transfer contracts remained unchanged.

Review identified four justified corrections. The custom bundler now strips complete single-line and multi-line static imports and export lists, fails on unterminated declarations and rejects surviving module syntax; direct fixture tests guard the boundary. Aggregate bonus appearances now reuse the Stage 4 completed-match × aggregate-pAppear model rather than minutes/60. The fixture test now creates a genuine blank. Final verification no longer regenerates goldens.

Verified source commit `aee6d0fee7cc177622a046f37885b554013debbd`: 241/241 tests passing against committed goldens, deterministic two-build comparison passed and independent CSP verification passed. Generated artefacts embed that exact identity. Temporary workflow removed at `99d9cf8184589ef5ed79b8fdad2bff13a9f96552`. Merged through PR #9 at `68877333ebf13060e764b82b91dfc0c9752a78c8`. No accuracy improvement is claimed.

## Stage 4 — Expected minutes (MERGED 2026-07-28)
Replaced season-minutes/current-GW and GW-number denominators with completed-team fixtures, validated detailed current-season histories, recency weighting, aggregate/prior fallbacks and explicit pStart/pAppear/p60/expMin/confidence outputs. Official availability is applied once and scoring consumes the minutes boundary without circular dependency. Verified baseline: 220/220 tests and deterministic builds. Merged through PR #8 at `eb08c7af43a2e8040ea65064fc725ba8d1778882`.

## Stage 3.6 — AI/Markdown sanitisation (MERGED 2026-07-28)
Replaced the Ask surface's string-to-HTML Markdown path with a bounded, default-deny parser and DOM renderer. The supported subset is deliberately small: paragraphs, `##`/`###` headings, unordered lists, bold, italic and absolute HTTP(S) links. Raw HTML and unsupported Markdown remain inert text. Unsafe, relative, protocol-relative, encoded, entity-obscured and control-character URL targets are rejected while preserving visible labels.

Eight adversarial tests bring the suite from 194 to 202. GitHub Actions run `30336857903` passed the full `./run-tests.sh` step and deterministic two-build byte comparison. A temporary verification workflow was removed before merge, so no CI-policy change remains in the product diff. No model, provider, retry, key-handling, CSP, formula or visual-design behaviour changed.

## Stage 3.5 — DOM-builder rendering (MERGED 2026-07-28)
Introduced shared text-node-first DOM primitives and migrated the complete approved inventory:
gameweek/source/chip status, ticker and swing notes, player table and drawer, squad/captain/best-XI,
transfers, league output and controls, manual squad/search, core failure states and backtest output.
Hostile provider/user strings now become text nodes rather than HTML. Ask Markdown was explicitly
restored to its Stage 3.4 baseline because AI sanitisation belongs to separately approved Stage 3.6.
Five adversarial checks bring the suite from 189 to 194; formulas and golden results are unchanged.
The work landed through PR #3: implementation commit `138f2b826487c487733cd32546a577d515459646`,
merge commit `5623abb594159916b4041e6bd3c44be80f714ce7`. The recorded implementation run was
194/194 with deterministic builds; no GitHub Actions run is attached to the merge.

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
