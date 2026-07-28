# ROADMAP.md — living roadmap
Purpose: stage plan with status. Audience: session planning. Last updated: 2026-07-28.
Related: STAGE_HISTORY.md, STAGE3-DESIGN.md, STAGE4-DESIGN.md, STAGE5-DESIGN.md, STAGE6-DESIGN.md, STAGE7-DESIGN.md, STAGE8-DESIGN.md, DECISIONS.md.

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
- **Stage 7 — Walk-forward backtest** · DONE and merged through PR #15 at `78b42e09d2ad3b8338b587ba2b89e815cfc0c45a`.
  - Deadline-safe chronological train/calibration/holdout folds and fold-only calibration.
  - Immutable pinned historical archive with runtime SHA-256 verification.
  - Honest replay limitations and deterministic outputs.
  - Verified baseline: **274/274 tests passed**, successful build, deterministic two-build comparison and build-identity checks.

## Current
- **Stage 8 — Uncertainty and squad simulation** · implemented on draft PR #16; verification and owner review gate remain.
  - Approved design: `docs/STAGE8-DESIGN.md`.
  - Deterministic seeded player simulations with P10/P25/median/P75/P90 and blank/return/haul probabilities.
  - Five-state minutes reconstruction preserving pStart/pAppear/p60 and expected minutes where feasible.
  - Legal auto-substitution, reserve-goalkeeper handling and captain-to-vice fallback.
  - Existing deterministic `projectXP()` and transfer-optimiser objectives remain unchanged.
  - Detailed pre-season simulation is disabled rather than presented with false precision.

## Upcoming
- **Stage 9 — UI integration** · FPL-style squad home page, shirts, settings, health-strip placement and inline-style migration.

## Current blockers
1. Stage 8 full verification, generated artefact commit and owner review before merge.
2. Free historical odds and other missing pre-deadline provider snapshots require prospective 2026/27 logging.
3. Live-season prospective data requirements begin with GW1 on 21 August 2026.
