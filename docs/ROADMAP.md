# ROADMAP.md — living roadmap
Purpose: stage plan with status. Audience: session planning. Last updated: 2026-07-28.
Related: STAGE_HISTORY.md (past detail), STAGE3-DESIGN.md, DECISIONS.md.

## Completed
- **Stage 1 — Characterisation & audit** · Objective: freeze behaviour + audit sources.
  Deliverables: 77-test suite, golden snapshots, docs/AUDIT.md. Status: DONE (owner-verified).
- **SEC-1 hot-fix** · Odds key never transits relays; regression-tested. Status: DONE, deployed.
- **Stage 2 — Module extraction** · ES modules, deterministic build+manifest, provider registry,
  odds schema/matching rules, pure backtest with provenance and resilience coverage. Status: DONE.
- **Documentation handover** · Repository established as the permanent source of truth. Status: DONE.
- **Stage 3 — Security & provider hardening** · Fixture deduplication, Anthropic-key removal,
  per-endpoint schema validation, bounded retry, Provider Health, DOM-builder rendering,
  AI/Markdown sanitisation, odds-key hygiene and hash-based CSP. Status: IMPLEMENTED on draft PR #6;
  verification baseline is 210 passing tests with deterministic two-build comparison.

## Current
- **Owner architecture review gate** · No model work begins until the owner reviews the completed
  Stage 3 architecture and explicitly approves progression.
- **PR #6 remains draft** · Do not merge until owner review and approval. The temporary verification
  workflow must be absent from the final merge commit.

## Upcoming (order fixed; later stages depend on earlier)
- **Stage 4 — Expected-minutes model** · tiered per-player histories (squad+~top-80 detailed,
  aggregate elsewhere), pStart/pAppear/p60/expMin/confidence; replaces AUDIT MIN-1/DEN-1.
- **Stage 5 — Scoring corrections** · season rules config; stepped-rule distributions, bonus,
  set-piece roles and fixture-model configuration with approved validation.
- **Stage 6 — Transfer optimiser** · complete legal plans (0–3 moves), squad-level ranking,
  roll-value configuration and pruning verified against exhaustive search.
- **Stage 7 — Walk-forward backtest** · deadline-information-only replay, train/calibrate/holdout,
  metric battery, provider ablations, dataset pinning and prospective odds logging.
- **Stage 8 — Uncertainty & squad simulation** · percentiles, appearance/haul probabilities,
  auto-sub simulation and captain floor/upside.
- **Stage 9 — UI integration** · FPL-style squad home page with shirts, settings page, health-strip
  placement and inline-style-to-class migration, which removes the CSP style-attribute concession.

## Current blockers
1. Owner review and approval of draft PR #6.
2. Owner architecture review gate before Stage 4.
3. BT-1 dataset SHA (owner `git ls-remote` or Stage-7 ETag).
4. Season data realities: squad/league features and prospective odds logging need GW1 (21 Aug 2026).
