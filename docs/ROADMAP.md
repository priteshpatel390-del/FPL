# ROADMAP.md — living roadmap
Purpose: stage plan with status. Audience: session planning. Last updated: 2026-07-28.
Related: STAGE_HISTORY.md, STAGE3-DESIGN.md, STAGE4-DESIGN.md, STAGE5-DESIGN.md, STAGE6-DESIGN.md, STAGE7-DESIGN.md, STAGE8-DESIGN.md, STAGE9-DESIGN.md, DECISIONS.md.

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
- **Stage 8 — Uncertainty and squad simulation** · DONE and merged through PR #16 at `b0f6e1683b1bdb38c9cb233024a8d0bfd652caa8`.
  - Deterministic seeded player and legal squad simulations.
  - P10/P25/median/P75/P90 plus blank/return/haul probabilities.
  - Reserve-goalkeeper handling, ordered legal auto-subs and captain-to-vice fallback.
  - Verified baseline: **284/284 tests passed**, successful build and deterministic build checks.

## Current
- **Stage 9 — UI integration** · approved design in `docs/STAGE9-DESIGN.md`.
- **Checkpoint 9.1 — App shell and primary navigation** · implemented and verified on draft PR #17; owner review and explicit merge approval remain.
  - Four primary destinations: Team, Players, Transfers and More.
  - Team is the default landing screen.
  - Existing setup, fixtures, league and Ask surfaces are regrouped under More.
  - No model, simulation, optimiser, provider or feature behaviour changed.
  - Verified source commit `c75747fc6fc871a6a75991c8fb0c9be7ad572982`: **284/284 tests passed**, successful build, deterministic two-build comparison and build-identity check.

## Upcoming
1. **Checkpoint 9.2 — Pitch and shirts** · only after 9.1 is merged.
2. **Checkpoint 9.3 — Uncertainty presentation** · spread-label thresholds require separate owner approval before implementation.
3. **Checkpoint 9.4 — Decision previews** · temporary captain/vice and transfer-plan previews.
4. **Checkpoint 9.5 — Settings and Provider Health integration**.
5. **Checkpoint 9.6 — Inline-style migration, CSP tightening and final UI polish**.

## Current blockers
1. Owner review and explicit merge approval for Stage 9.1 draft PR #17.
2. Free historical odds and other missing pre-deadline provider snapshots require prospective 2026/27 logging.
3. Live-season prospective data requirements begin with GW1 on 21 August 2026.
