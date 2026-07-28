# ROADMAP.md — living roadmap
Purpose: stage plan with status. Audience: session planning. Last updated: 2026-07-28.
Related: STAGE_HISTORY.md, STAGE3-DESIGN.md, STAGE4-DESIGN.md, STAGE5-DESIGN.md, STAGE6-DESIGN.md, STAGE7-DESIGN.md, DECISIONS.md.

## Completed
- **Stage 1 — Characterisation and audit** · DONE.
- **SEC-1 hot-fix** · Odds key never transits relays · DONE and deployed.
- **Stage 2 — Module extraction** · ES modules, deterministic build, provider registry and backtest provenance · DONE.
- **Documentation handover** · Repository established as permanent source of truth · DONE.
- **Stage 3 — Security and provider hardening** · DONE and merged through PR #6.
- **Stage 4 — Expected-minutes model** · DONE and merged through PR #8 at `eb08c7af43a2e8040ea65064fc725ba8d1778882`; verified baseline 220 tests and deterministic builds.
- **Stage 5 — Scoring corrections** · DONE and merged through PR #9 at `68877333ebf13060e764b82b91dfc0c9752a78c8`; verified source baseline 241 tests and deterministic builds.
- **Stage 6 — Transfer optimiser** · DONE and merged through PR #14 at `df9bb72cb2167a092acbfbe0300c3be21caea155`.
  - Exact 0–3 transfer plans with mandatory zero-transfer baseline.
  - Complete squad legality, pooled affordability, free-transfer/hit handling and per-Gameweek legal best-XI scoring.
  - Verified source commit `5181299c8773c118220bdd8c18e80eb053eaf592`: **254/254 tests passed** and deterministic two-build comparison passed.
  - Verified generated artefacts committed at `212b071687aa1ec6fc99e2006db824eb99291657`; temporary workflow removed at `026848dc5b11dded156e0e7fc873d5a457f59067`.

## Current
- **Stage 7 — Walk-forward backtest** · implementation and verification complete on draft PR #15; awaiting owner review and explicit merge approval.
  - Approved design: `docs/STAGE7-DESIGN.md`.
  - Pure chronological train/calibration/holdout folds with future-information rejection.
  - Fold-only position calibration; no changes to production formulas, persisted `S.calib`, captaincy or optimiser behaviour.
  - Immutable vaastav 2025/26 source commit `f9ed3e8839b0f970e0d5d4a83c5628f6eaee755a`; exact downloaded bytes are SHA-256 hashed at runtime.
  - Deadline-safe archive replay aggregates double Gameweeks, counts malformed rows and never manufactures missing required values.
  - MAE, RMSE, bias, Pearson correlation, segmentation and identical-key ablation support.
  - Backtest UI no longer claims exact live-model replay, automatic correction or validated prediction accuracy.
  - Verified source commit `42d3106fcb15f2e68db7409e0ae96fd27cd4f61a`: **274/274 tests passed**, successful build, deterministic two-build comparison and build-identity checks passed.
  - Verified generated artefacts committed at `d2f1e7d93cf200e5a1d6d1a2d96829e750740ff9`.
  - Historical odds, Understat, detailed expected-minutes inputs and production fixture-rating snapshots remain unavailable and are reported rather than reconstructed.
  - Remaining gate: owner review and explicit merge approval. Do not begin Stage 8 before merge.

## Upcoming
- **Stage 8 — Uncertainty and squad simulation** · percentiles, appearance/haul probabilities, auto-sub simulation and captain floor/upside.
- **Stage 9 — UI integration** · FPL-style squad home page, shirts, settings, health-strip placement and inline-style migration.

## Current blockers
1. Owner review and explicit merge approval for Stage 7 draft PR #15.
2. Free historical odds and other missing pre-deadline provider snapshots require prospective 2026/27 logging.
3. Live-season prospective data requirements begin with GW1 on 21 August 2026.
