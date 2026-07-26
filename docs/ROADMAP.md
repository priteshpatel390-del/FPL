# ROADMAP.md — living roadmap
Purpose: stage plan with status. Audience: session planning. Last updated: 2026-07-26.
Related: STAGE_HISTORY.md (past detail), STAGE3-DESIGN.md (current), DECISIONS.md.

## Completed
- **Stage 1 — Characterisation & audit** · Objective: freeze behaviour + audit sources.
  Deliverables: 77-test suite, golden snapshots, docs/AUDIT.md. Success: independent owner run
  green. Status: DONE (owner-verified).
- **SEC-1 hot-fix** · odds key never transits relays; regression-tested. Status: DONE, deployed.
- **Stage 2 — Module extraction** · ES modules, deterministic build+manifest, provider registry
  (six quality attributes), odds schema/matching rules, pure backtest with provenance, unit +
  resilience suites (96 total). Success: characterisation green against built bundle. Status: DONE
  (owner-approved).

## Current
- **Documentation stage (this)** · Objective: repository becomes source of truth; any fresh Claude
  session onboards from CLAUDE.md. Deliverables: /docs set + CLAUDE.md + workflow recommendation.
  Success criteria: owner can close the founding conversation permanently. Status: IN PROGRESS.

## Upcoming (order fixed; later stages depend on earlier)
- **Stage 3 — Security & provider hardening** · DESIGNED, awaiting owner approval of
  docs/STAGE3-DESIGN.md (incl. two judgement calls: fixture-id dedupe in validation; style-src-attr
  concession). Scope: DOM-builder rendering, AI-output sanitisation pipeline + battery, hash-based
  CSP, per-endpoint schema validation, retry policy, 7-state health, Anthropic key removal,
  odds-key hygiene (“Forget key”, scrubber). Blocker: owner approval.
- **Owner architecture review gate** (owner-mandated pause before any model work).
- **Stage 4 — Expected-minutes model** · tiered per-player histories (squad+~top-80 detailed,
  aggregate elsewhere), pStart/pAppear/p60/expMin/confidence; replaces AUDIT MIN-1/DEN-1.
- **Stage 5 — Scoring corrections** · season rules config; stepped-rule distributions (floor GC/2,
  floor saves/3, DC threshold probability); bonus via historical-per-start with shrinkage; penalty/
  set-piece roles; fixture-model weights → versioned config with early-season priors; fixture dedupe
  if not landed in Stage 3.
- **Stage 6 — Transfer optimiser** · complete legal plans (0–3 moves, −4/−8 secondary), squad-level
  ranking incl. XI/captain/bench, roll-value config, pruning verified against exhaustive search.
- **Stage 7 — Walk-forward backtest** · deadline-information-only replay; train/calibrate/holdout
  seasons; metric battery incl. baselines (ep_next, form, PPG); source ablations (FPL-only vs
  +Understat vs +Elo variants); dataset pinning (BT-1); prospective odds logging starts.
- **Stage 8 — Uncertainty & squad simulation** · percentiles, haul/appearance probabilities,
  auto-sub simulation, captain floor/upside.
- **Stage 9 — UI integration** · FPL-style squad home page with shirts, settings page, health strip
  placement, inline-style→classes (deletes CSP concession), docs refresh.

## Current blockers
1. Stage 3 design approval (owner). 2. BT-1 dataset SHA (owner `git ls-remote` or Stage-7 ETag).
3. Season data realities: squad/league features and prospective odds logging need GW1 (21 Aug 2026).
