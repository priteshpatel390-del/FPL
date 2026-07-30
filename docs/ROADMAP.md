# ROADMAP.md — living roadmap
Purpose: stage plan with status. Audience: session planning. Last updated: 2026-07-30.
Related: STAGE_HISTORY.md, STAGE3-DESIGN.md, STAGE4-DESIGN.md, STAGE5-DESIGN.md, STAGE6-DESIGN.md, STAGE7-DESIGN.md, STAGE8-DESIGN.md, STAGE9-DESIGN.md, STAGE10-DESIGN.md, DECISIONS.md.

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
  - Verified source `5181299c8773c118220bdd8c18e80eb053eaf592`: **254/254 tests passed** with deterministic builds.
- **Stage 7 — Walk-forward backtest** · DONE and merged through PR #15 at `78b42e09d2ad3b8338b587ba2b89e815cfc0c45a`.
  - Deadline-safe chronological train/calibration/holdout folds and fold-only calibration.
  - Immutable pinned historical archive with runtime SHA-256 verification.
  - Verified baseline: **274/274 tests passed** with deterministic builds.
- **Stage 8 — Uncertainty and squad simulation** · DONE and merged through PR #16 at `b0f6e1683b1bdb38c9cb233024a8d0bfd652caa8`.
  - Deterministic seeded player and legal squad simulations.
  - P10/P25/median/P75/P90 plus blank/return/haul probabilities.
  - Reserve-goalkeeper handling, ordered legal auto-subs and captain-to-vice fallback.
  - Verified baseline: **284/284 tests passed** with deterministic builds.
- **Checkpoint 9.1 — App shell and primary navigation** · DONE and merged through PR #17 at `9f4333e3f2e8d71d02355389f8c7d2115d3d17e4`.
- **Checkpoint 9.2 — Team pitch and shirts** · DONE and merged through PR #18 at `4cbbe588697845677e6aef5992e15f13f47c6281`.
- **Checkpoint 9.3 — Player detail and uncertainty** · DONE and merged through PR #20 at `eb636d023bed6706f46f5a03366485ede9b15c89`.
- **Checkpoint 9.4 — Temporary decision previews** · DONE and merged through PR #23 at `5e62f2f65d6e21d86ca3f0ef8dd0b7112fd4a8c8`.
- **Checkpoint 9.5 — More, Settings and Provider Health** · DONE and merged through PR #24 at `a5ac5fcc12bb492948365851587d4e1cd2f30301`.
- **Checkpoint 9.6 — Inline-style migration, CSP tightening and final UI polish** · DONE and merged through PR #25 at `c52f6f08f51bff5bfe7702bfec58265647afe439`.
  - Verified source `4a4b14c1d0f422088c080e714ee259efbd7cc39d`: **313/313 tests passed** with deterministic exact-identity builds; generated deployables `7fb09142156a8061adc375a72bf3d7e2a1b25985`.
- **Stage 10.1 — Deadline-safe snapshot foundation** · DONE and merged through PR #27 at `da76c81f552fd9da5c518e73ccc0fbe966c74444`.
  - Verified source `eb3497ec405d6c7b8ce09105614fcb8280abc34b`: **349/349 tests passed** with deterministic exact-identity builds; generated artefacts `1259e7b5f7505d3330c772e89c77720251552287`.
- **Stage 10.2 — Official outcome collection** · DONE and merged through PR #29 at `4b1b2acf9bda81afb63414dd41b509e80b3945c7`.
  - Automatic Official FPL player, fixture and optional public manager outcomes with immutable provisional/complete/corrected revisions.
  - Verified source `e84e7f1bf05ed1f3e574f78101e4a6e413273306`: **376/376 tests passed** with byte-identical exact-identity builds; generated artefacts `9d81210b493ab40a542c50709733b14e448a481c`.
- **Stage 10.3 — Metrics** · DONE and merged through PR #32 at `2c703be2ccebc9bd0c4d782ad07b5324b1ed0997` after owner approval.
  - Immutable player, fixture-minutes, uncertainty, frozen-squad, captaincy, bench and frozen-transfer evaluations remain descriptive only.
  - Verified source `3eaae862b8a8277e450af062ff4bcecd15b12f3f`: **397/397 tests passed** with byte-identical exact-identity builds; generated artefacts `8c4b60a367b9858146b42ff8710d888856462c21`.
- **Stage 10.4 — Operating review/export** · DONE and merged through PR #35 at `6a96096cfa59fd3476aa89c191cc8ca6400d358b` after owner approval.
  - Downstream weekly/cumulative review with deterministic JSON, Markdown and eight CSV exports.
  - Verified source `1eca9a8817da41597d0632c819142237d31627fb`: **413/413 tests passed** with exact-identity builds; generated artefacts `1af7dac5383c91e915587218e7551c2f619cec8f`.

## Current
- **Stage 10.5 — Hardening and documentation** · IMPLEMENTED AND VERIFIED on `agent/stage10-5-hardening-documentation` after owner approval; draft PR and physical iPhone acceptance remain pending.
- Verified source `0302c54e3eb1d77657b3d892bebb33c90438fa92`: **428/428 tests passed** with byte-identical exact-identity builds.
- Storage recovery, schema/security parity, bounded retry, honest downloads and live-season operations are hardened without model/provider changes.

## Upcoming
1. Inspect the merged Stage 10.1–10.4 operational and recovery boundaries.
2. Present the exact Stage 10.5 failure-recovery, migration, security-review and operational-guidance scope and exclusions.
3. Obtain explicit owner approval before implementation.

## Current blockers
1. Stage 10.5 exact scope and approval are not yet recorded.
2. A persistent screenshot-regression suite is absent; visual changes still require human device checks.
3. Free historical odds and other missing pre-deadline provider snapshots require prospective 2026/27 logging.
4. Prospective sample size begins at zero; Stage 10 infrastructure does not establish model accuracy or calibration.
