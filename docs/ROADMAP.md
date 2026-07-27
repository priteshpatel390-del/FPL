# ROADMAP.md — living roadmap
Purpose: stage plan with status. Audience: session planning. Last updated: 2026-07-27.
Related: STAGE_HISTORY.md (past detail), STAGE3-DESIGN.md (current), DECISIONS.md.

## Completed
- **Stage 1 — Characterisation & audit** · Objective: freeze behaviour + audit sources.
  Deliverables: 77-test suite, golden snapshots, docs/AUDIT.md. Success: independent owner run
  green. Status: DONE (owner-verified).
- **SEC-1 hot-fix** · odds key never transits relays; regression-tested. Status: DONE, deployed.
- **Stage 2 — Module extraction** · ES modules, deterministic build+manifest, provider registry
  (six quality attributes), odds schema/matching rules, pure backtest with provenance, unit +
  resilience suites (96 total at Stage-2 close). Success: characterisation green against built bundle. Status: DONE
  (owner-approved).
- **Documentation handover** · Repository established as the source of truth with the `/docs`
  set and root onboarding. Status: DONE.

## Current
- **Stage 3 — Security & provider hardening** · IN PROGRESS under the approved
  docs/STAGE3-DESIGN.md (incl. two judgement calls: fixture-id dedupe in validation; style-src-attr
  concession). D-13 and items 1–3 are complete: fixture deduplication, Anthropic-key removal,
  per-endpoint schema validation and bounded retry. Next checkpoint: item 4, the seven-state
  provider-health model, which requires owner design approval before implementation.

## Upcoming (order fixed; later stages depend on earlier)
- **Stage 3 remaining work** · provider health, DOM-builder rendering, AI-output sanitisation,
  odds-key hygiene (“Forget key”, scrubber), and hash-based CSP.
- **Owner architecture review gate** (owner-mandated pause before any model work).
- **Stage 4 — Expected-minutes model** · tiered per-player histories (squad+~top-80 detailed,
  aggregate elsewhere), pStart/pAppear/p60/expMin/confidence; replaces AUDIT MIN-1/DEN-1.
- **Stage 5 — Scoring corrections** · season rules config; stepped-rule distributions (floor GC/2,
  floor saves/3, DC threshold probability); bonus via historical-per-start with shrinkage; penalty/
  set-piece roles; fixture-model weights → versioned config with early-season priors.
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
1. Stage 3 item 4 design approval (owner). 2. BT-1 dataset SHA (owner `git ls-remote` or Stage-7 ETag).
3. Season data realities: squad/league features and prospective odds logging need GW1 (21 Aug 2026).
