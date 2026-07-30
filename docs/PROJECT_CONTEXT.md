# PROJECT_CONTEXT.md
Purpose: master overview — the first document any new developer or session reads after CLAUDE.md.
Audience: anyone joining the project. Last updated: 2026-07-30. Related: ARCHITECTURE.md, ROADMAP.md, DECISIONS.md.

## What this is
**Teamsheet — FPL Decision Desk.** A single-file, mobile-first web app that helps one manager, Pritesh, make Fantasy Premier League decisions: fixture difficulty, projected points, squad review, best XI, captaincy, transfer costing, mini-league effective ownership and on-device prospective model evaluation.

## Current status
- Live on GitHub Pages from repository `priteshpatel390-del/FPL`.
- The 2026/27 season starts 21 August 2026; the app remains in pre-season mode until live GW1 data exists.
- Stages 1–9 and Stage 10.1–10.4 are complete and merged. Stage 10.4 merged through PR #35 at `6a96096cfa59fd3476aa89c191cc8ca6400d358b` after explicit owner approval. The complete Stage 10 design is owner-approved.
- Stage 9.5 merged through PR #24 at `a5ac5fcc12bb492948365851587d4e1cd2f30301`, adding Settings and globally visible Provider Health without changing provider behaviour.
- Stage 9.6 merged through PR #25 at `c52f6f08f51bff5bfe7702bfec58265647afe439`, completing class-only presentation, CSP tightening and final responsive/accessibility review. The verified Stage 9 baseline is **313/313 tests passing** with deterministic builds.
- Stage 10.1 merged through PR #27 at `da76c81f552fd9da5c518e73ccc0fbe966c74444` after physical iPhone acceptance. Verified source `eb3497ec405d6c7b8ce09105614fcb8280abc34b` passes **349/349 tests** with exact-identity builds; generated artefacts are committed at `1259e7b5f7505d3330c772e89c77720251552287`.
- Stage 10.2 merged through PR #29 at `4b1b2acf9bda81afb63414dd41b509e80b3945c7`. Verified source `e84e7f1bf05ed1f3e574f78101e4a6e413273306` passes **376/376 tests** with exact-identity builds; generated artefacts are committed at `9d81210b493ab40a542c50709733b14e448a481c`.
- Stage 10.3 merged through PR #32 at `2c703be2ccebc9bd0c4d782ad07b5324b1ed0997` after owner approval. It derives immutable correction-aware player, fixture-minutes, uncertainty, frozen-squad, captaincy, bench and frozen-transfer evaluations only from exact Stage 10.1/10.2 records. Verified source `3eaae862b8a8277e450af062ff4bcecd15b12f3f` passes **397/397 tests** with deterministic exact-identity builds; generated artefacts are committed at `8c4b60a367b9858146b42ff8710d888856462c21`.
- Stage 10.4 merged through PR #35 at `6a96096cfa59fd3476aa89c191cc8ca6400d358b`. It provides downstream-only weekly/cumulative operating review plus deterministic JSON, Markdown and eight CSV exports from exact Stage 10.1–10.3 evidence. Verified source `1eca9a8817da41597d0632c819142237d31627fb` passes **413/413 tests** with exact-identity builds; generated artefacts `1af7dac5383c91e915587218e7551c2f619cec8f` embed source hash `d1773a1ae9e36ae28adef232148a3f7e315f21baf989e03e0158c9beefe729ed`. No formula, provider or automatic Google Sheets integration changed.
- The historical 2025/26 aggregate r=0.80 result is method-flattered and must not be presented as validated out-of-sample accuracy.

## Goals and priorities
1. Reliable expected-points projections.
2. Accurate expected minutes.
3. Sound clean-sheet and attacking probabilities.
4. Correct availability information.
5. Sustainable, legal data collection.
6. Graceful fallback.
7. Avoid unnecessary complexity and noisy data.

The overriding principle is the simplest reliable data stack that supports good decisions, not the largest feature set.

## Design philosophy
- Each stage is isolated, tested, reviewable and deployable.
- Known limitations are documented rather than hidden.
- Formula changes require prior review and explicit approval.
- No prediction-improvement claim without genuine holdout evidence.
- Mobile-first operation is mandatory because the owner primarily uses an iPhone.
- Stage 9 presentation should remain minimalist, polished and football-first: decisions lead, secondary diagnostics stay subordinate.
- Stage 10 metrics remain descriptive until sufficient genuinely pre-deadline observations exist.

## Platform, stack and deployment
Vanilla JavaScript ES modules, no framework and zero runtime dependencies. Node 18 or newer runs the custom deterministic bundler and `node:test` suite. `node build.mjs` emits `dist/index.html`, the single deployable uploaded through the GitHub web interface. The custom bundler strips complete static module declarations, rejects surviving module syntax and embeds model, rules, source-hash and commit identity.

## Completed, current and next
Completed and merged: Stage 1 characterisation/audit, SEC-1, Stage 2 modularisation, repository handover, Stage 3 security/provider hardening, Stage 4 expected minutes, Stage 5 scoring corrections, Stage 6 transfer optimiser, Stage 7 walk-forward backtest, Stage 8 uncertainty/squad simulation, all six Stage 9 UI-integration checkpoints, Stage 10.1 deadline-safe snapshot foundation, Stage 10.2 official outcome collection, Stage 10.3 metrics and Stage 10.4 operating review/export.

Current: Stage 10.5 — Hardening and documentation is the next investigation and exact-scope approval checkpoint. No Stage 10.5 implementation has begun.

Next: define failure recovery, migration discipline, security review and final operational guidance. Production formulas, thresholds and validation claims remain outside scope unless separately evidenced and approved.

## Major risks
Public relay dependence for some provider traffic; undocumented FPL schema drift; Understat scraping fragility and terms-of-service uncertainty; limited odds quota; model accuracy not yet proven prospectively; simulation probability calibration still prospective; small and clustered early samples; and single-maintainer phone-first operations.

## Known assumptions
The public FPL API and pinned vaastav archive remain available; the owner accepts the temporary client-side odds-key posture; Anthropic keys remain banned client-side; GitHub Pages remains the host until an approved serverless trigger; detailed Stage 8 simulation remains disabled in pre-season rather than manufacturing precise distributions; and local evidence storage remains recovery rather than a permanent archive.

## Stage 10.5 implementation candidate
Stage 10.5 is implemented and verified on `agent/stage10-5-hardening-documentation` at source `0302c54e3eb1d77657b3d892bebb33c90438fa92`. It hardens browser recovery, version/import security, bounded snapshot retry, honest downloads and owner operations only. Draft PR review and physical iPhone acceptance remain required before merge. Stage 10 completion still means infrastructure complete while prospective validation remains in progress.
