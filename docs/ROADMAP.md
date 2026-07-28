# ROADMAP.md — living roadmap
Purpose: stage plan with status. Audience: session planning. Last updated: 2026-07-28.
Related: STAGE_HISTORY.md, STAGE3-DESIGN.md, STAGE4-DESIGN.md, STAGE5-DESIGN.md, DECISIONS.md.

## Completed
- **Stage 1 — Characterisation and audit** · DONE.
- **SEC-1 hot-fix** · Odds key never transits relays · DONE and deployed.
- **Stage 2 — Module extraction** · ES modules, deterministic build, provider registry and backtest provenance · DONE.
- **Documentation handover** · Repository established as permanent source of truth · DONE.
- **Stage 3 — Security and provider hardening** · DONE and merged through PR #6.
- **Stage 4 — Expected-minutes model** · Detailed histories, aggregate/prior fallback, pStart/pAppear/p60/expMin/confidence and Provider Health integration · DONE and merged through PR #8 at `eb08c7af43a2e8040ea65064fc725ba8d1778882`. Verified baseline: 220 passing tests and deterministic builds.

## Current
- **Stage 5 — Scoring corrections** · Owner-approved implementation on draft PR #9 from branch `agent/stage5-scoring-corrections`.
  - Implemented: 2026/27 rules configuration; stepped saves and goals conceded; defensive-contribution threshold probability; empirical bonus; sparse disciplinary/penalty events; penalty-role gating; real blank/double fixture-run scoring.
  - Review fixes implemented: complete multi-line import/export stripping with fail-closed guard; direct bundler fixture tests; Stage 4 aggregate appearance denominator for bonus; genuine blank-Gameweek regression; verification no longer regenerates goldens.
  - Remaining gates: clean full-suite/deterministic/CSP verification on the final reviewed source, verified artefact commit, temporary workflow removal, final review and explicit owner merge approval.
  - **Do not merge and do not begin Stage 6 yet.**

## Upcoming
- **Stage 6 — Transfer optimiser** · complete legal 0–3 move plans, squad-level ranking, roll-value configuration and pruning verified against exhaustive search.
- **Stage 7 — Walk-forward backtest** · deadline-information-only replay, train/calibrate/holdout split, metrics, provider ablations, dataset pinning and prospective odds logging.
- **Stage 8 — Uncertainty and squad simulation** · percentiles, appearance/haul probabilities, auto-sub simulation and captain floor/upside.
- **Stage 9 — UI integration** · FPL-style squad home page, shirts, settings, health-strip placement and inline-style migration.

## Current blockers
1. Final Stage 5 clean verification and artefact closeout.
2. Owner review and explicit merge approval for PR #9.
3. BT-1 historical dataset pin for Stage 7.
4. Live-season data requirements beginning with GW1 on 21 August 2026.
