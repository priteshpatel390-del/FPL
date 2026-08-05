# PROJECT_CONTEXT.md

> **Teamsheet 2.0.7 review branch:** Scope S-2.0.7 is implemented on draft PR #68 from main `0f9e6c879859a2584ab8d7b9d4879a84efbfaf5d`. Verified source `5a61ec5510c447580afa6070a5a9815516babe86` passes **533 passed, 0 failed, 0 skipped**; generated deployables are committed at `71397382911a4e32633de15200ad59cfb26dc439`. Two exact-identity production builds were byte-identical, root `index.html` equals `dist/index.html`, model remains `2.4.0` and rules remain `2026-27.3`. This checkpoint is not merged or fully accepted. Physical iPhone Safari, VoiceOver and live populated-data acceptance remain pending; do not merge without Pritesh’s explicit approval.
Purpose: master overview — the first document any new developer or session reads after CLAUDE.md.
Audience: anyone joining the project. Last updated: 2026-08-05. Related: ARCHITECTURE.md, ROADMAP.md, DECISIONS.md, TEAMSHEET2-PRODUCT-BLUEPRINT.md.

## What this is
**Teamsheet — FPL Decision Desk.** A single-file, mobile-first web app that helps Fantasy Premier League managers maximise the performance of their own complete 15-player squad through intelligent, explainable, team-level recommendations.

Teamsheet is team-first rather than player-first and decision-first rather than data-first. Its primary purpose is to answer the manager's weekly questions about the best XI, captaincy, bench, transfers, rank and Mini-League position. Advanced research, evidence and diagnostics remain available progressively without dominating the ordinary workflow.

The owner-approved canonical product direction is `TEAMSHEET2-PRODUCT-BLUEPRINT.md`.

## Current status
- Live on GitHub Pages from repository `priteshpatel390-del/FPL`.
- The 2026/27 season starts 21 August 2026; the app remains in pre-season mode until live GW1 data exists.
- Stages 1–9 and Stage 10.1–10.5 are complete and merged. Stage 10.5 merged through PR #45 at `0605ba5a02c49a5b599eba1ed00c443fa1889c92` after explicit owner approval. The complete Stage 10 design is owner-approved and its collection/evaluation infrastructure is complete.
- The Teamsheet 2.0 Product Blueprint was approved by Pritesh on 30 July 2026. Owner-approved 2.0.1 amendments on 31 July 2026 add Fixtures as a primary destination, shorten Mini Leagues to Leagues, keep free transfers and bank on Team, and promote Ask Teamsheet as a global/Team action.
- Teamsheet 2.0.1 implements hash routing, browser history/deep links, Team/Transfers/Fixtures/Leagues/Settings navigation and the five-section Settings hierarchy without changing formulas or providers. Verified baseline: **445/445 tests** with deterministic exact-identity builds and root/deployable equality.
- Teamsheet 2.0.2 implements the pitch-first Team decision home and is merged through PR #49 at `d01e6a36af47f8ce7962820f36174274af382493`. Its final verified source passed **459/459 tests** with deterministic exact-identity builds and root/deployable equality.
- Teamsheet 2.0.3 implements the Transfers Decision Workspace and is merged through PR #55 at `c82a883f3ae8eebc8a3017e9181748e562dd9ba8`. Verified baseline: **467/467 tests**, deterministic builds, root/deployable equality and owner iPhone visual acceptance; VoiceOver acceptance remains unperformed.
- Teamsheet 2.0.4 implements the official Mini-League foundation and is merged through PR #59 at `a2841b0831193f645548cfc4155809b82a520d92`: primary/saved leagues, ID-free subroutes, official position/movement, points gaps, nearby standings, pinned rivals and one-rival-at-a-time public squad comparison. Verified baseline: **493/493 tests** with deterministic exact-identity builds and root/deployable equality. Physical testing of the actual repository build on an iPhone, VoiceOver acceptance and live populated-data acceptance were not separately performed; the approved sample preview established design direction but was not equivalent to full repository-device acceptance.
- Teamsheet 2.0.5 implements factual selected-rival Mini-League intelligence and is merged through PR #63 at `0b04dd68194207d301667a7100c3ed804ec1e056`: explicit maximum-five selected rivals, on-demand current-Gameweek public picks, concurrency two, exact complete/fresh selected-rival exposure, stale/incomplete/unavailable separation, ID-free `#/leagues/exposure`, version-2 minimal persistence and stricter optional-field validation. Verified baseline: **510/510 tests** with deterministic exact-identity builds and root/deployable equality. Projected or strategic Mini-League intelligence remains excluded. Physical iPhone, VoiceOver and live populated-data acceptance remain unperformed.
- Teamsheet 2.0.6 implements Research, Evidence and Diagnostics Organisation and is complete and merged through PR #65 at `cd1ad52ea4d13a247a82bc90f80f2db0b6f77aa4`. It separates each Settings goal into route-owned landings and children, gives Stage 10 UI modules explicit hosts, keeps healthy Provider Health out of the header, surfaces only material core-data warnings, completes Help & About and adapts Player Explorer for narrow screens. Verified baseline: **520 passed, 0 failed, 0 skipped** with deterministic exact-identity builds and root/deployable equality. It changed no provider, data source, model, fixture, scoring, squad, captaincy, simulation, optimiser, rank or Mini-League calculation. Physical iPhone Safari, VoiceOver and live populated-data acceptance remain unperformed.
- Stage 9.5 merged through PR #24 at `a5ac5fcc12bb492948365851587d4e1cd2f30301`, adding Settings and globally visible Provider Health without changing provider behaviour.
- Stage 9.6 merged through PR #25 at `c52f6f08f51bff5bfe7702bfec58265647afe439`, completing class-only presentation, CSP tightening and final responsive/accessibility review. The verified Stage 9 baseline is **313/313 tests passing** with deterministic builds.
- Stage 10.1 merged through PR #27 at `da76c81f552fd9da5c518e73ccc0fbe966c74444` after physical iPhone acceptance. Verified source `eb3497ec405d6c7b8ce09105614fcb8280abc34b` passes **349/349 tests** with exact-identity builds; generated artefacts are committed at `1259e7b5f7505d3330c772e89c77720251552287`.
- Stage 10.2 merged through PR #29 at `4b1b2acf9bda81afb63414dd41b509e80b3945c7`. Verified source `e84e7f1bf05ed1f3e574f78101e4a6e413273306` passes **376/376 tests** with exact-identity builds; generated artefacts are committed at `9d81210b493ab40a542c50709733b14e448a481c`.
- Stage 10.3 merged through PR #32 at `2c703be2ccebc9bd0c4d782ad07b5324b1ed0997` after owner approval. It derives immutable correction-aware player, fixture-minutes, uncertainty, frozen-squad, captaincy, bench and frozen-transfer evaluations only from exact Stage 10.1/10.2 records. Verified source `3eaae862b8a8277e450af062ff4bcecd15b12f3f` passes **397/397 tests** with deterministic exact-identity builds; generated artefacts are committed at `8c4b60a367b9858146b42ff8710d888856462c21`.
- Stage 10.4 merged through PR #35 at `6a96096cfa59fd3476aa89c191cc8ca6400d358b`. It provides downstream-only weekly/cumulative operating review plus deterministic JSON, Markdown and eight CSV exports from exact Stage 10.1–10.3 evidence. Verified source `1eca9a8817da41597d0632c819142237d31627fb` passes **413/413 tests** with exact-identity builds; generated artefacts `1af7dac5383c91e915587218e7551c2f619cec8f` embed source hash `d1773a1ae9e36ae28adef232148a3f7e315f21baf989e03e0158c9beefe729ed`. No formula, provider or automatic Google Sheets integration changed.
- Stage 10.5 merged through PR #45 at `0605ba5a02c49a5b599eba1ed00c443fa1889c92`. It hardens transactional recovery, schema/import security, bounded deadline retry, honest downloads and live-season operations without changing production formulas or providers. Verified source `0302c54e3eb1d77657b3d892bebb33c90438fa92` passes **428/428 tests** with deterministic exact-identity builds; generated artefacts are `421e532629cbd1b82b19b3ea349ab23571221f00` with source hash `3efb94912e21be8ee8aaa29b4834d992c485e36ed9c70e9a8e88fbbe5f598a40`. Physical iPhone acceptance was not independently recorded.
- The historical 2025/26 aggregate r=0.80 result is method-flattered and must not be presented as validated out-of-sample accuracy.

## Product vision and principles
1. Optimise and explain the complete 15-player team rather than isolated players.
2. Lead with the decision and reveal advanced data progressively.
3. Treat doing nothing and rolling a transfer as valid recommendations.
4. Make every primary screen answer one main user question.
5. Separate confirmed Official FPL results from projected values.
6. Make Mini Leagues a flagship destination covering global and private-league performance.
7. Preserve honest uncertainty and known limitations.
8. Deliver a polished, fast football application rather than a technical dashboard.

## Implemented Teamsheet 2.0 information architecture
The primary navigation is:

1. **Team**
2. **Transfers**
3. **Fixtures**
4. **Leagues**
5. **Settings**

Players is available under Settings → Research Tools rather than primary navigation. More is replaced by an organised Settings menu. Ask Teamsheet is a prominent Team and global action with its own route. Free transfers and bank remain visible on Team.

## Engineering goals and priorities
1. Reliable expected-points projections.
2. Accurate expected minutes.
3. Sound clean-sheet and attacking probabilities.
4. Correct availability information.
5. Sustainable, legal data collection.
6. Graceful fallback.
7. Avoid unnecessary complexity and noisy data.
8. Preserve verified engineering while migrating the product incrementally.

The overriding principle is the simplest reliable data stack that supports good team decisions, not the largest feature set.

## Design philosophy
- Each checkpoint is isolated, approved where required, tested, reviewable and deployable.
- Known limitations are documented rather than hidden.
- Formula changes require prior review and explicit approval.
- No prediction-improvement claim without genuine holdout evidence.
- Mobile-first operation is mandatory because the owner primarily uses an iPhone.
- The Teamsheet 2.0 blueprint supersedes Stage 9 information architecture for future work, while Stage 9 remains the valid historical engineering record.
- Stage 10 metrics remain descriptive until sufficient genuinely pre-deadline observations exist.

## Platform, stack and deployment
Vanilla JavaScript ES modules, no framework and zero runtime dependencies. Node 18 or newer runs the custom deterministic bundler and `node:test` suite. `node build.mjs` emits `dist/index.html`, the single deployable uploaded through the GitHub web interface. The custom bundler strips complete static module declarations, rejects surviving module syntax and embeds model, rules, source-hash and commit identity.

## Completed, current and next
Completed and merged: Stage 1 characterisation/audit, SEC-1, Stage 2 modularisation, repository handover, Stage 3 security/provider hardening, Stage 4 expected minutes, Stage 5 scoring corrections, Stage 6 transfer optimiser, Stage 7 walk-forward backtest, Stage 8 uncertainty/squad simulation, all six Stage 9 UI-integration checkpoints, Stage 10.1–10.5 prospective-validation infrastructure and Teamsheet 2.0.1–2.0.6.

Approved product direction: Teamsheet 2.0 Product Blueprint and migration checkpoints 2.0.1–2.0.7.

Current operational work: pre-season readiness and prospective 2026/27 evidence collection. Stage 10 infrastructure is complete; accuracy and calibration validation remain in progress.

Current development item: **Teamsheet 2.0.7 — Final Mobile Polish and Acceptance** is implemented for review on draft PR #68. Automated repository verification and generated-artifact finalisation are complete. Physical iPhone Safari, VoiceOver and live populated-data acceptance remain outstanding, and merge requires Pritesh’s explicit approval. Do not begin a new product checkpoint.

## Teamsheet 2.0 migration checkpoints
1. Teamsheet 2.0.1 — Navigation and Settings architecture.
2. Teamsheet 2.0.2 — Team decision home.
3. Teamsheet 2.0.3 — Transfer decision experience.
4. Teamsheet 2.0.4 — Global rank and Mini-League foundation.
5. Teamsheet 2.0.5 — Mini-League intelligence.
6. Teamsheet 2.0.6 — Research, evidence and diagnostics organisation.
7. Teamsheet 2.0.7 — Final mobile polish and acceptance.

Every checkpoint remains independently designed, approved, tested, reviewed and deployable.

## Major risks
Public relay dependence for some provider traffic; undocumented FPL schema drift; Understat scraping fragility and terms-of-service uncertainty; limited odds quota; model accuracy not yet proven prospectively; simulation probability calibration still prospective; small and clustered early samples; selected-rival data that is deliberately not representative of a whole league; projected rank and strategic Mini-League intelligence still unapproved; and single-maintainer phone-first operations.

## Known assumptions
The public FPL API and pinned vaastav archive remain available; the owner accepts the temporary client-side odds-key posture; Anthropic keys remain banned client-side; GitHub Pages remains the host until an approved serverless trigger; detailed Stage 8 simulation remains disabled in pre-season rather than manufacturing precise distributions; local evidence storage remains recovery rather than a permanent archive; and Teamsheet 2.0 will preserve the existing framework-free deterministic foundation unless separately approved evidence justifies a change.

## Approval and implementation boundary
Teamsheet 2.0.6 is complete and merged through PR #65 at `cd1ad52ea4d13a247a82bc90f80f2db0b6f77aa4`. It changed Settings organisation, routes, focus, responsive presentation and consequence-led status wording only. Projection, fixture, captaincy, squad, transfer, simulation, rank, Mini-League, provider and data-source behaviour remain unchanged. The verified baseline is **520 passed, 0 failed, 0 skipped** with deterministic exact-identity builds and root/deployable equality. Prospective validation remains in progress; physical iPhone Safari, VoiceOver and live populated-data acceptance remain unperformed. Teamsheet 2.0.7 Scope S-2.0.7 is owner-approved and implemented on a review branch. Automated verification is complete; physical iPhone Safari, VoiceOver and live populated-data acceptance remain the next gate before completion or merge.
