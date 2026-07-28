# ROADMAP.md — living roadmap
Purpose: stage plan with status. Audience: session planning. Last updated: 2026-07-28.
Related: STAGE_HISTORY.md, STAGE3-DESIGN.md, STAGE4-DESIGN.md, STAGE5-DESIGN.md, DECISIONS.md.

## Completed
- **Stage 1 — Characterisation & audit** · Objective: freeze behaviour + audit sources.
  Deliverables: 77-test suite, golden snapshots, docs/AUDIT.md. Status: DONE (owner-verified).
- **SEC-1 hot-fix** · Odds key never transits relays; regression-tested. Status: DONE, deployed.
- **Stage 2 — Module extraction** · ES modules, deterministic build+manifest, provider registry,
  odds schema/matching rules, pure backtest with provenance and resilience coverage. Status: DONE.
- **Documentation handover** · Repository established as the permanent source of truth. Status: DONE.
- **Stage 3 — Security & provider hardening** · Status: DONE and merged through PR #6.
- **Stage 4 — Expected-minutes model** · Tiered current-season histories, pStart/pAppear/p60/expMin/
  confidence, aggregate/prior fallbacks, history cache and Provider Health integration. Status: DONE and
  merged through PR #8 at `eb08c7af43a2e8040ea65064fc725ba8d1778882`; inherited verification baseline is
  220 passing tests with deterministic two-build comparison.

## Current
- **Stage 5 — Scoring corrections** · Owner-approved implementation on draft PR #9 from branch
  `agent/stage5-scoring-corrections`. 2026/27 rules configuration, stepped saves/goals-conceded
  distributions, defensive-contribution threshold probability, empirical bonus, sparse negative-event
  components, penalty-role gating and fixture-run correction are implemented. Repository-hosted full
  verification remains pending; do not merge.

## Upcoming (order fixed; later stages depend on earlier)
- **Stage 6 — Transfer optimiser** · complete legal plans (0–3 moves), squad-level ranking,
  roll-value configuration and pruning verified against exhaustive search.
- **Stage 7 — Walk-forward backtest** · deadline-information-only replay, train/calibrate/holdout,
  metric battery, provider ablations, dataset pinning and prospective odds logging.
- **Stage 8 — Uncertainty & squad simulation** · percentiles, appearance/haul probabilities,
  auto-sub simulation and captain floor/upside.
- **Stage 9 — UI integration** · FPL-style squad home page with shirts, settings page, health-strip
  placement and inline-style-to-class migration, which removes the CSP style-attribute concession.

## Current blockers
1. Stage 5 full-suite, deterministic-build and CSP verification evidence.
2. Owner review and explicit merge approval for draft PR #9 after verification.
3. BT-1 dataset SHA (owner `git ls-remote` or Stage-7 ETag).
4. Season data realities: squad/league features and prospective odds logging need GW1 (21 Aug 2026).
