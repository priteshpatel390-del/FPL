# ROADMAP.md — living roadmap

> **Teamsheet 2.0.6 merged baseline:** Research, Evidence and Diagnostics Organisation is complete and merged through PR #65 at `cd1ad52ea4d13a247a82bc90f80f2db0b6f77aa4`. It adds nested Settings routes, explicit evidence/recovery/export/storage hosts, consequence-led core-data warnings, complete Help & About guidance, real build identity and mobile Player Explorer cards without changing providers, persistence or calculations. Verification established **520 passed, 0 failed, 0 skipped**, deterministic exact-identity production builds and root `index.html` equal to `dist/index.html`; model remains `2.4.0` and rules remain `2026-27.3`. Physical iPhone Safari, VoiceOver and live populated-data acceptance remain unperformed. The next formal checkpoint is Teamsheet 2.0.7 — Final Mobile Polish and Acceptance, beginning with investigation and design only; implementation requires explicit owner approval.
Purpose: stage plan with status. Audience: session planning. Last updated: 2026-08-04.
Related: STAGE_HISTORY.md, TEAMSHEET2-PRODUCT-BLUEPRINT.md, STAGE3-DESIGN.md, STAGE4-DESIGN.md, STAGE5-DESIGN.md, STAGE6-DESIGN.md, STAGE7-DESIGN.md, STAGE8-DESIGN.md, STAGE9-DESIGN.md, STAGE10-DESIGN.md, DECISIONS.md.

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
- **Stage 10.5 — Hardening and documentation** · DONE and merged through PR #45 at `0605ba5a02c49a5b599eba1ed00c443fa1889c92` after owner approval.
  - Transactional recovery, schema/import security, bounded deadline retry, honest downloads and live-season operations.
  - Verified source `0302c54e3eb1d77657b3d892bebb33c90438fa92`: **428/428 tests passed** with deterministic exact-identity builds; generated artefacts `421e532629cbd1b82b19b3ea349ab23571221f00`. Physical iPhone acceptance was not independently recorded.
- **Teamsheet 2.0 Product Blueprint** · APPROVED by Pritesh on 30 July 2026 and recorded in `TEAMSHEET2-PRODUCT-BLUEPRINT.md`.
  - Establishes team-first, decision-first, explainable and mobile-first product direction.
  - Originally approved Team, Transfers, Mini Leagues and Settings; owner-approved 2.0.1 amendments implement Team, Transfers, Fixtures, Leagues and Settings.
  - Supersedes the Stage 9 information architecture for future development while preserving the Stage 9 engineering foundation and historical record.
  - Defines independently gated migration checkpoints 2.0.1–2.0.7 and authorises no application implementation by itself.
- **Teamsheet 2.0.1 — Navigation and Settings architecture** · MERGED through PR #48 at `0ed9c89c63852fe9d97d0e1ffcc64660228aeb7b`.
- **Teamsheet 2.0.2 — Team decision home** · MERGED through PR #49 at `d01e6a36af47f8ce7962820f36174274af382493`; final verified source 459/459 tests.
- **Teamsheet 2.0.3 — Transfers Decision Workspace** · MERGED through PR #55 at `c82a883f3ae8eebc8a3017e9181748e562dd9ba8`; 467/467 tests, deterministic builds and owner iPhone visual acceptance. VoiceOver was not performed.
- **Teamsheet 2.0.4 — Mini Leagues** · MERGED through PR #59 at `a2841b0831193f645548cfc4155809b82a520d92`.
  - Primary/saved league selection and deterministic legacy migration.
  - Official current position, supplied movement and simple points gaps.
  - Targeted nearby standings with user-requested pagination.
  - Pinned rivals and one-rival-at-a-time public picks comparison.
  - Exact squad overlap, captain/vice/active-chip context and honest incomplete/stale states.
  - No projected rank, differential scoring, protect/chase strategy, provider or model change.
  - Verified baseline: **493/493 tests**, deterministic exact-identity builds and root/deployable equality.
  - Physical testing of the actual repository build on an iPhone, VoiceOver acceptance and live populated-data acceptance were not separately performed; the approved sample preview established design direction but was not equivalent to full repository-device acceptance.
- **Teamsheet 2.0.5 — Mini-League Intelligence** · MERGED through PR #63 at `0b04dd68194207d301667a7100c3ed804ec1e056`.
  - Explicit maximum-five selected-rival groups and ID-free `#/leagues/exposure`.
  - Public picks load only on user request, with concurrency two and current-session reuse.
  - Aggregate counts include only fresh complete 15-player squads; stale, incomplete, unavailable and not-loaded states remain explicit.
  - Exact player, captain, vice and chip counts describe selected rivals only, never the whole league or an outcome prediction.
  - Version-2 persistence stores choices only; fetched standings, picks and derivations remain session-only.
  - Projected rank, rival-score prediction, remaining-player simulation, effective-ownership strategy and protect/balanced/chase recommendations remain separately gated and unapproved.
  - Verified baseline: **510 passed, 0 failed, 0 skipped**, deterministic exact-identity builds and root/deployable equality.
  - Physical iPhone, VoiceOver and live populated-data acceptance were not performed.
- **Teamsheet 2.0.6 — Research, Evidence and Diagnostics Organisation** · COMPLETE AND MERGED through PR #65 at `cd1ad52ea4d13a247a82bc90f80f2db0b6f77aa4`.
  - Nested route-owned Settings destinations separate Team & Account, Research, Evidence & Performance, Data & Diagnostics and Help & About goals.
  - Explicit hosts replace DOM-order coupling across evidence, outcomes, metrics, review, exports, recovery and local deletion.
  - Healthy Provider Health remains in Settings; only material core Official FPL issues create primary warnings.
  - Player Explorer uses mobile cards on narrow screens while preserving ranking and Player Detail behaviour.
  - Providers, data sources, persistence and all calculations remain unchanged.
  - Verified baseline: **520 passed, 0 failed, 0 skipped**, deterministic exact-identity builds and root/deployable equality.
  - Physical iPhone Safari, VoiceOver and live populated-data acceptance remain unperformed.

## Current
- **Teamsheet 2.0.7 — Final Mobile Polish and Acceptance** · IMPLEMENTED FOR REVIEW.
  - Scope S-2.0.7 is owner-approved and limited to presentation, interaction, accessibility, resilience and acceptance work.
  - Automated verification is complete; physical iPhone Safari, VoiceOver and live populated-data acceptance remain pending.
- **Live-season readiness and prospective validation** remains operational. Genuine pre-deadline evidence collection begins with the 2026/27 season.

## Teamsheet 2.0 migration sequence
1. **Teamsheet 2.0.1 — Navigation and Settings architecture** · COMPLETE AND MERGED.
   - Team, Transfers, Fixtures, Leagues and Settings.
   - Player Explorer under Settings; Ask Teamsheet as a global/Team action.
   - URL routing, browser history, focus and responsive navigation.
2. **Teamsheet 2.0.2 — Team decision home** · COMPLETE AND MERGED.
   - Pitch-first connected/setup/degraded states with unchanged XI, captaincy, bench and projection logic.
   - Concise forecast, one material risk, advisory deadline action and progressive detail.
3. **Teamsheet 2.0.3 — Transfer decision experience** · COMPLETE AND MERGED.
   - Leads with the zero-transfer baseline, honest model comparison and whole-squad consequences.
4. **Teamsheet 2.0.4 — Mini Leagues foundation** · COMPLETE AND MERGED.
   - Establishes confirmed private-league position, movement, gaps, nearby standings and factual rival comparison.
   - Global/projected rank calculation remains excluded and unimplemented.
5. **Teamsheet 2.0.5 — Mini-League Intelligence** · COMPLETE AND MERGED.
   - Adds selected-rival factual exposure, exact complete/fresh counts and honest partial states; strategy modelling remains separately gated.
6. **Teamsheet 2.0.6 — Research, evidence and diagnostics completion** · COMPLETE AND MERGED.
   - Route-owned Settings hierarchy, explicit mounts, consequence-led warnings, complete help/build detail and mobile research presentation merged through PR #65.
7. **Teamsheet 2.0.7 — Final mobile polish and acceptance** · NEXT FORMAL CHECKPOINT.
   - Begin with investigation and design only after the documentation correction is approved, merged and latest `main` is verified.
   - Complete hierarchy, performance, accessibility, full pre-season rehearsal and physical-device acceptance.
   - Implementation requires explicit owner approval.

Every checkpoint requires its own investigation, exact scope, exclusions, owner approval where required, branch, complete verification, documentation and draft PR.

## Upcoming
1. Review the Teamsheet 2.0.7 draft implementation and automated evidence.
2. Perform physical iPhone Safari, VoiceOver and live populated-data acceptance; record any external blocker honestly.
3. Operate pre-deadline snapshots and durable owner-controlled exports during the 2026/27 season.
4. Complete checkpoint-specific iPhone checks and the final Teamsheet 2.0.7 end-to-end rehearsal.
5. Collect official outcomes and descriptive metrics prospectively; do not claim accuracy or calibration until approved sample safeguards are met.

## Current blockers and gates
1. Teamsheet 2.0.6 physical iPhone Safari, VoiceOver and live populated-data acceptance remain unperformed and must be addressed or explicitly recorded through 2.0.7 acceptance.
2. A persistent screenshot-regression suite is absent; visual changes still require human device checks.
3. Teamsheet 2.0.6 automated and headless-browser checks do not independently prove physical iPhone density, Safari interaction, VoiceOver reading order or live populated-data behaviour.
4. Teamsheet 2.0.7 may begin only with investigation and design after the documentation correction merges; implementation requires explicit owner approval.
5. The old standalone Stage 10.5 rehearsal gate is superseded by checkpoint-specific checks and final 2.0.7 rehearsal; its historical record remains intact.
6. Free historical odds and other missing pre-deadline provider snapshots require prospective 2026/27 logging.
7. Prospective sample size begins at zero; Stage 10 infrastructure does not establish model accuracy or calibration.
8. Projected live rank, projected rival outcomes, remaining-player simulations and protect/balanced/chase strategy logic require separate designs and explicit approval.
9. Official FPL endpoints remain undocumented and public transport limitations can block live populated-data acceptance.

## Post-merge Teamsheet 2.0.1 investigations

- The global Ask composer, stable dock/icons, focus presentation and simplified Settings hierarchy were merged through PR #48.
- Non-blocking foreground refresh, reliable populated Official FPL transport and authoritative read-only bank/free-transfer retrieval remain separately gated investigations.
- These unresolved data/account items do not reopen the completed 2.0.1 navigation scope.


## Teamsheet 2.0.7 current handover

Scope S-2.0.7 was approved by Pritesh on 4 August 2026 and implemented on a separate branch from `0f9e6c879859a2584ab8d7b9d4879a84efbfaf5d`. Automated verification is **__TEST_COUNT__ passed, 0 failed, 0 skipped** with deterministic exact-identity builds and root/deployable equality. Model remains `2.4.0`; rules remain `2026-27.3`. Physical iPhone Safari, VoiceOver and live populated-data acceptance remain pending; do not call the checkpoint complete or merge without owner approval.
