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
- **Stage 7 — Walk-forward backtest** · approved and implementation in progress on branch `agent/stage7-walk-forward-backtest`.
  - Approved design: `docs/STAGE7-DESIGN.md`.
  - Pure deadline-information-only fold engine added with train/calibration/holdout separation.
  - Dataset pin validation, leakage rejection, deterministic metrics, segmentation and ablation-key matching added.
  - Focused tests and deterministic bundle integration added.
  - Remaining before completion: production historical replay adapter, immutable archive pin/checksum, UI presentation, full-suite verification, committed generated artefacts, documentation closure and owner review.

## Upcoming
- **Stage 8 — Uncertainty and squad simulation** · percentiles, appearance/haul probabilities, auto-sub simulation and captain floor/upside.
- **Stage 9 — UI integration** · FPL-style squad home page, shirts, settings, health-strip placement and inline-style migration.

## Current blockers
1. Stage 7 requires an immutable historical dataset commit and checksum before results can be described as reproducible.
2. Free historical odds remain unavailable; odds/blend ablation must use prospective pre-deadline logging.
3. Live-season prospective data requirements begin with GW1 on 21 August 2026.