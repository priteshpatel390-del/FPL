# ROADMAP.md — living roadmap
Purpose: stage plan with status. Audience: session planning. Last updated: 2026-07-29.
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
- **Checkpoint 9.1 — App shell and primary navigation** · DONE and merged through PR #17 at `9f4333e3f2e8d71d02355389f8c7d2115d3d17e4`.
  - Four primary destinations: Team, Players, Transfers and More.
  - Team is the default landing screen; existing supporting tools are regrouped under More.
  - Verified baseline: **284/284 tests passed**, successful build and deterministic build checks.
- **Checkpoint 9.2 — Team pitch and shirts** · DONE and merged through PR #18 at `4cbbe588697845677e6aef5992e15f13f47c6281`.
  - Portrait pitch, repository-owned CSS shirts, captain/vice treatment and preserved bench order.
  - Verified source `38bb08e2e8f903deeb39dc4e1a4db070da4d4870`: **288/288 tests passed** with deterministic builds.
- **Checkpoint 9.3 — Player detail and uncertainty** · DONE and merged through PR #20 at `eb636d023bed6706f46f5a03366485ede9b15c89`.
  - Accessible mobile bottom sheet and desktop side panel with expected minutes and approved uncertainty presentation.
  - Verified source `40dde666fc776e0fdcf1bab6c8dad30138825d08`: **295/295 tests passed** with deterministic builds.
- **Checkpoint 9.4 — Temporary decision previews** · DONE and merged through PR #23 at `5e62f2f65d6e21d86ca3f0ef8dd0b7112fd4a8c8`.
  - Session-only optimiser-plan and captain/vice previews with stale-state invalidation and no persistence.
  - Verified source `849ff757c68c35e92744dc96efc34848110fa19e`: **304/304 tests passed** with deterministic builds.

- **Checkpoint 9.5 — More, Settings and Provider Health** · DONE and merged through PR #24 at `a5ac5fcc12bb492948365851587d4e1cd2f30301`.
  - Settings and global/full Provider Health presentation with unchanged provider behaviour.
  - Verified source `da8258df25e196af1f1521c025edefde23612abd`: **310/310 tests passed** with deterministic builds.
- **Checkpoint 9.6 — Inline-style migration, CSP tightening and final UI polish** · DONE and merged through PR #25 at `c52f6f08f51bff5bfe7702bfec58265647afe439`.
  - All source and generated style attributes/runtime style APIs are removed and guarded.
  - `style-src-attr` and every `unsafe-inline` token are removed from the emitted CSP.
  - Representative mobile and desktop browser review passed with no console errors.
  - Verified source `4a4b14c1d0f422088c080e714ee259efbd7cc39d`: **313/313 tests passed**, successful build, deterministic two-build comparison and build-identity check.
  - Verified generated deployables committed at `7fb09142156a8061adc375a72bf3d7e2a1b25985`.

## Current
- **Stage 10.1 — Deadline-safe snapshot foundation** · amended and locally verified on draft PR #27; owner review and physical iPhone startup/foreground/recovery acceptance pending.
- Approved scope: immutable all-player pre-deadline records plus automatic approved-source startup/foreground verification, one consistent final render, automatic eligible capture, deterministic hashes and non-official recovery restore.
- Verified source `eb3497ec405d6c7b8ce09105614fcb8280abc34b`: **349/349 tests passing**, successful production build, byte-identical two-build output and exact build identity.
- No projection, expected-minutes, scoring, fixture, simulation, captaincy, squad, provider-blend or optimiser-objective change.

## Upcoming
1. Complete owner review and the physical iPhone capture/export/import acceptance check for Stage 10.1.
2. Merge Stage 10.1 only after explicit owner approval.
3. Begin separately scoped Stage 10.2 official-outcome collection before evaluating any prospective metrics.

## Current blockers
1. Stage 10.1 requires owner review and physical iPhone acceptance before merge.
2. A persistent screenshot-regression suite is absent; future visual changes still need human device checks.
3. Free historical odds and other missing pre-deadline provider snapshots require prospective 2026/27 logging.
4. Live-season prospective data requirements begin with GW1 on 21 August 2026.
