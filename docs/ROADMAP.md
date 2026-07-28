# ROADMAP.md — living roadmap
Purpose: stage plan with status. Audience: session planning. Last updated: 2026-07-28.
Related: STAGE_HISTORY.md, STAGE3-DESIGN.md, STAGE4-DESIGN.md, STAGE5-DESIGN.md, STAGE6-DESIGN.md, DECISIONS.md.

## Completed
- **Stage 1 — Characterisation and audit** · DONE.
- **SEC-1 hot-fix** · Odds key never transits relays · DONE and deployed.
- **Stage 2 — Module extraction** · ES modules, deterministic build, provider registry and backtest provenance · DONE.
- **Documentation handover** · Repository established as permanent source of truth · DONE.
- **Stage 3 — Security and provider hardening** · DONE and merged through PR #6.
- **Stage 4 — Expected-minutes model** · Detailed histories, aggregate/prior fallback, pStart/pAppear/p60/expMin/confidence and Provider Health integration · DONE and merged through PR #8 at `eb08c7af43a2e8040ea65064fc725ba8d1778882`. Verified baseline: 220 passing tests and deterministic builds.
- **Stage 5 — Scoring corrections** · DONE and merged through PR #9 at `68877333ebf13060e764b82b91dfc0c9752a78c8`.
  - Implemented: 2026/27 rules configuration; stepped saves and goals conceded; defensive-contribution threshold probability; empirical bonus; sparse disciplinary/penalty events; penalty-role gating; real blank/double fixture-run scoring.
  - Verified source commit `aee6d0fee7cc177622a046f37885b554013debbd`: **241/241 tests passed**, committed goldens unchanged, deterministic two-build comparison passed and independent CSP recomputation passed.

## Current
- **Stage 6 — Transfer optimiser** · implemented and verified on draft PR #14; awaiting owner review and explicit merge approval.
  - Exact 0–3 transfer plans with a mandatory zero-transfer baseline.
  - Complete 15-player legality, position quotas, inherited club-quota repair and pooled affordability.
  - Exact sell prices when purchase prices are known; clearly labelled estimated mode otherwise.
  - Free transfers, four-point hits, next-Gameweek transfer count and versioned 0.5-point roll value.
  - Per-Gameweek legal best-XI scoring across the selected horizon; captaincy excluded.
  - Unavailable purchases excluded; doubtful players allowed with warnings.
  - Deterministic ordering, fail-closed evaluation ceiling and production safe pruning checked against an independent exhaustive reference.
  - Verified source commit `5181299c8773c118220bdd8c18e80eb053eaf592`: **254/254 tests passed** and deterministic two-build comparison passed.
  - Remaining gate: verified generated artefacts, temporary workflow removal, owner review and explicit merge approval. Do not begin Stage 7 yet.

## Upcoming
- **Stage 7 — Walk-forward backtest** · deadline-information-only replay, train/calibrate/holdout split, metrics, provider ablations, dataset pinning and prospective odds logging.
- **Stage 8 — Uncertainty and squad simulation** · percentiles, appearance/haul probabilities, auto-sub simulation and captain floor/upside.
- **Stage 9 — UI integration** · FPL-style squad home page, shirts, settings, health-strip placement and inline-style migration.

## Current blockers
1. Owner review and explicit merge approval for Stage 6 draft PR #14.
2. BT-1 historical dataset pin for Stage 7.
3. Live-season data requirements beginning with GW1 on 21 August 2026.