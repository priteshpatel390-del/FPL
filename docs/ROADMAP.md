# ROADMAP.md — living roadmap

<!-- FIXTURES-MOBILE-SCROLL-FOLLOW-UP-2026-08-07 -->
> **Approved implementation in review — Fixtures mobile horizontal-scroll presentation:** populated iPhone Safari review proved 12-Gameweek horizontal scrolling works but exposed a broken sticky TEAM presentation, a fallback explanation that travelled with the table, and static intro copy that contradicted the active Official-FPL fallback. The approved branch is presentation-only: fixture calculations, fallback mathematics, providers, projections and strategy stay unchanged. `docs/FIXTURES-MOBILE-SCROLL-FOLLOW-UP.md` is the focused record. Automated verification is recorded there; physical iPhone retest remains required before Fixtures is accepted and the project moves to Leagues.

<!-- TEAM-ACCEPTANCE-2026-08-07 -->
> **Current merged application checkpoint — Team populated acceptance complete:** PRs #80–#83 are merged, with current `main` `385e5102c0e86e4b926503bffceba08bd6d831c3` from PR #83. The exact final PR #83 head `990a85eb69319064038be458081d029d8a3b8828` passed **652 tests, 0 failed, 0 skipped, 0 cancelled**, deterministic byte-identical double-build verification, root/deployable equality and exact manifest build identity. The final PR head and merge commit share Git tree `70b38bf4bf5b5bdb0f295fa6738554266441e62b`. GitHub Pages deployment for `385e5102c0e86e4b926503bffceba08bd6d831c3` succeeded. Pritesh then physically accepted the populated Team path on iPhone Safari: startup/loading owns the viewport; availability is visible; the reserve goalkeeper occupies `GK`; outfield substitutes retain `1st` / `2nd` / `3rd`; and `Unavailable` is centred on one line without overlap. Normal Safari retained the saved manual squad; Private Browsing uses separate browser storage and is not currently a Teamsheet persistence defect. `docs/TEAM-UX-T01-T02-MERGE-RECORD.md` is authoritative for this Team follow-up sequence. Remaining populated live acceptance is **Fixtures, then Leagues**. No calculation, provider, data-source or security behaviour changed.

<!-- UX-A2-DOCK-LAYERING-ROADMAP-2026-08-07 -->
> **Preceding merged checkpoint — PR #78:** the narrow Player Detail/modal stacking correction above the unchanged fixed primary dock was physically accepted on populated iPhone Safari and merged at `ebb8838e7bfd081371a0639c9b4bdacfc9b92bc6`. Automated verification is **645 passed, 0 failed, 0 skipped, 0 cancelled** with deterministic byte-identical builds and root/deployable equality. GitHub Pages deployment succeeded and the Cloudflare Workers production build succeeded for `teamsheet-fpl-gateway`. `UI-14` is closed. UX-A3, Track B and all model/provider work remain unapproved.


<!-- UX-A2-2026-08-06 -->
> **Preceding merged checkpoint — UX-A2 Player Detail Scroll and Rotation Correction:** complete and merged through PR #76 to `main` at `bffcba8e9231adfc216125913f8ab83c042c3e10` from approved branch head `ad1dd4611c042591a3f03dea77a1a9b59101d9ba`, based on verified `main` `2738a0500b9be20a723f0940df0a93766b29c05d`. Scope is behaviour correction only: internal Player Detail scrolling, root plus body scroll locking, exact background-position restoration on normal close, route-safe unlocking without stale restoration, viewport-height fallback before `dvh`, compact-landscape sizing, four-sided safe areas, focus handling with `preventScroll` and root text-size adjustment fixed at 100% against Safari rotation text inflation. Player Detail content is unchanged. Automated evidence is **644 passed, 0 failed, 0 skipped** plus deterministic exact-identity builds and root/deployable equality. **Populated physical iPhone Safari acceptance passed on 6 August 2026**, including a successful retest of the corrected rotation behaviour; `UI-13` is closed. Making Player Detail more concise is a separate future proposal, not part of UX-A2. `UX-A2-MERGE-RECORD.md` is authoritative for PR #76; `UX-A2-DOCK-LAYERING-FOLLOW-UP.md` is authoritative for the later PR #78 correction.

<!-- UX-A1-2026-08-06 -->
> **Historical status superseded — UX-A1 Team Resources and Bench Clarity is complete and merged:** PR #74 merged at `15aa01a07a5645f5df9ec2f2f429aefa52965c94` after **624 passed, 0 failed, 0 skipped**, deterministic exact-identity builds, root/deployable equality and populated physical iPhone Safari acceptance. Earlier wording describing the branch as in review or awaiting device acceptance is superseded by `UX-A1-MERGE-RECORD.md`.


<!-- TRANSFERS-TRACK-A-2026-08-06 -->
> **Current Track A status — complete and merged:** FPL-T1 and Track A are integrated on `main` through PR #69 (`00a35bacd2396a125a8a914bff9980b4f18b257f`), PR #70 (`78b2729c51419a36c5e6f757fa54830100b5435c`) and PR #72 (`be742e1eb707b3892f6405adf5d8769e084eee65`). The final `main` merge commit and the verified PR #72 head (`7257e8601b4a4f2fae80ce30a787f7069974a926`) have the identical repository tree `3794e8e7ab9859717950296766dc9d64c9e5473f`. The accepted branch baseline is **613 passed, 0 failed, 0 skipped** with deterministic production builds and root/deployable equality. On populated physical iPhone Safari, the six-Gameweek exact calculation completed in about 15 seconds; completed and active navigation persistence, prompt cancellation/restart, Safari app switching, stale-result protection, the separate no-transfer baseline and the final **“No hit”** wording all passed. VoiceOver testing is not a project acceptance requirement. No prediction-accuracy improvement is claimed, and Track B football intelligence remains unapproved and unimplemented.


> **Current approved item:** documentation-only reconciliation of the merged Team T-01/T-02 follow-up through PR #83, followed by investigation-only populated live acceptance of **Fixtures**. Team populated acceptance is complete; the remaining sequence is **Fixtures, then Leagues**. This reconciliation authorises no application implementation, model change or provider change.

> **Teamsheet 2.0.7:** Complete and merged through PR #68 at `2f7e4ba6978ccd68e9d6c36b56d4063cea06beaf`; the Safari foreground-resume correction passed owner retest. VoiceOver testing is not required for Teamsheet and is not an acceptance gate; earlier accepted-unverified wording is superseded by `VOICEOVER-DECISION.md`.
Purpose: stage plan with status. Audience: session planning. Last updated: 2026-08-07.
Related: STAGE_HISTORY.md, TEAMSHEET2-PRODUCT-BLUEPRINT.md, STAGE3-DESIGN.md, STAGE4-DESIGN.md, STAGE5-DESIGN.md, STAGE6-DESIGN.md, STAGE7-DESIGN.md, STAGE8-DESIGN.md, STAGE9-DESIGN.md, STAGE10-DESIGN.md, DECISIONS.md.

## Completed
- **FPL-T1 and Track A — Official FPL gateway plus exact persistent Transfers** · COMPLETE AND MERGED through PR #69 (`00a35bacd2396a125a8a914bff9980b4f18b257f`), PR #70 (`78b2729c51419a36c5e6f757fa54830100b5435c`) and PR #72 (`be742e1eb707b3892f6405adf5d8769e084eee65`). Final accepted evidence: 613 passing tests, deterministic builds, exact merge-tree identity and populated iPhone Safari acceptance for the tested Transfers paths; VoiceOver was not tested.
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
  - Physical testing of the actual repository build on an iPhone and live populated-data acceptance were not separately performed; the approved sample preview established design direction but was not equivalent to full repository-device acceptance.
- **Teamsheet 2.0.5 — Mini-League Intelligence** · MERGED through PR #63 at `0b04dd68194207d301667a7100c3ed804ec1e056`.
  - Explicit maximum-five selected-rival groups and ID-free `#/leagues/exposure`.
  - Public picks load only on user request, with concurrency two and current-session reuse.
  - Aggregate counts include only fresh complete 15-player squads; stale, incomplete, unavailable and not-loaded states remain explicit.
  - Exact player, captain, vice and chip counts describe selected rivals only, never the whole league or an outcome prediction.
  - Version-2 persistence stores choices only; fetched standings, picks and derivations remain session-only.
  - Projected rank, rival-score prediction, remaining-player simulation, effective-ownership strategy and protect/balanced/chase recommendations remain separately gated and unapproved.
  - Verified baseline: **510 passed, 0 failed, 0 skipped**, deterministic exact-identity builds and root/deployable equality.
  - Physical iPhone and live populated-data acceptance were not performed.
- **Teamsheet 2.0.6 — Research, Evidence and Diagnostics Organisation** · COMPLETE AND MERGED through PR #65 at `cd1ad52ea4d13a247a82bc90f80f2db0b6f77aa4`.
  - Nested route-owned Settings destinations separate Team & Account, Research, Evidence & Performance, Data & Diagnostics and Help & About goals.
  - Explicit hosts replace DOM-order coupling across evidence, outcomes, metrics, review, exports, recovery and local deletion.
  - Healthy Provider Health remains in Settings; only material core Official FPL issues create primary warnings.
  - Player Explorer uses mobile cards on narrow screens while preserving ranking and Player Detail behaviour.
  - Providers, data sources, persistence and all calculations remain unchanged.
  - Verified baseline: **520 passed, 0 failed, 0 skipped**, deterministic exact-identity builds and root/deployable equality.
  - Physical iPhone Safari and live populated-data acceptance remain unperformed for the relevant untested paths.
- **Teamsheet 2.0.7 — Final mobile polish and acceptance** · COMPLETE AND MERGED through PR #68.
  - Safari foreground-resume behaviour passed owner retest.
  - VoiceOver is not a project acceptance gate and no physical screen-reader claim is made.
- **UX-A1 Team Resources and Bench Clarity** · COMPLETE AND MERGED through PR #74 at `15aa01a07a5645f5df9ec2f2f429aefa52965c94`, with populated iPhone Safari acceptance.
- **UX-A2 Player Detail Scroll and Rotation Correction** · COMPLETE AND MERGED through PR #76 at `bffcba8e9231adfc216125913f8ab83c042c3e10`, with populated iPhone Safari acceptance; `UI-13` closed.
- **PR #78 Player Detail dock-layering correction** · COMPLETE AND MERGED at `ebb8838e7bfd081371a0639c9b4bdacfc9b92bc6`, with **645 passing tests**, deterministic builds, successful GitHub Pages/Cloudflare build evidence and populated iPhone Safari acceptance; `UI-14` closed.

## Current
- **Documentation reconciliation after PR #78** · APPROVED, documentation-only. It aligns canonical status records with the physically accepted and merged correction without changing application behaviour.
- **Pre-season readiness and prospective validation** · OPERATIONAL. Genuine pre-deadline evidence collection begins with the 2026/27 season.
- **Remaining populated live acceptance** · OPEN in this order: **Team → Fixtures → Leagues**. Transfers and Player Detail already have populated iPhone acceptance evidence for their tested paths.
- **Concise Player Detail information density** · NOT APPROVED. A separate future proposal raised during UX-A2 acceptance to review how much information Player Detail shows and how far it must be scrolled. Requires its own investigation, scope and explicit approval.
- **Later implementation work** · NOT APPROVED. A3, Track B and any provider/model change require a new investigation and approval gate.

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
7. **Teamsheet 2.0.7 — Final mobile polish and acceptance** · COMPLETE AND MERGED through PR #68.
   - Safari foreground-resume behaviour passed owner retest.
   - VoiceOver is not a project acceptance gate; no physical screen-reader claim is made.
   - Subsequent FPL-T1, Track A, UX-A1, UX-A2 and PR #78 work is complete; remaining live populated acceptance is tracked by feature rather than reopening a merged checkpoint.

Every checkpoint requires its own investigation, exact scope, exclusions, owner approval where required, branch, complete verification, documentation and draft PR.

## Upcoming
1. Complete this documentation-only PR #78 reconciliation and merge it only after explicit owner approval.
2. Then perform investigation-only populated live-acceptance planning in this exact order: **Team**, **Fixtures**, **Leagues**.
3. Operate pre-deadline snapshots and durable owner-controlled exports during the 2026/27 season.
4. Collect Official outcomes and descriptive metrics prospectively; do not claim accuracy or calibration until approved sample safeguards are met.
5. Investigate any new product, provider, model or Track B proposal before defining scope or implementation. No new application implementation item is currently approved.

## Current blockers and gates
1. Populated iPhone/live acceptance is not yet recorded for every **Team, Fixtures and Leagues** path; accepted Transfers and Player Detail evidence must not be generalised beyond the tested paths.
2. VoiceOver is not a project acceptance gate. No physical screen-reader verification is claimed unless it is separately performed.
3. A persistent screenshot-regression suite is absent; visual changes still require human device checks.
4. Free historical odds and other missing pre-deadline provider snapshots require prospective 2026/27 logging.
5. Prospective sample size begins at zero; Stage 10 infrastructure does not establish model accuracy or calibration.
6. Projected live rank, projected rival outcomes, remaining-player simulations and protect/balanced/chase strategy logic require separate designs and explicit approval.
7. Official FPL endpoints remain undocumented and can drift; validation must continue to fail closed.
8. Bank and available free transfers remain manual rather than proven authoritative account values.

## Post-merge Teamsheet 2.0.1 investigations

- The global Ask composer, stable dock/icons, focus presentation and simplified Settings hierarchy were merged through PR #48.
- Non-blocking foreground refresh and reliable Official FPL transport are implemented and merged; authoritative read-only bank/free-transfer retrieval remains separately gated.
- These unresolved data/account items do not reopen the completed 2.0.1 navigation scope.


## Teamsheet 2.0.7 final handover

Scope S-2.0.7 is complete and merged through PR #68. Its Safari foreground-resume correction passed owner retest. VoiceOver is not a project acceptance gate and no physical screen-reader claim is made. Subsequent FPL-T1 and Track A work is complete and merged through PR #69 (`00a35bacd2396a125a8a914bff9980b4f18b257f`), PR #70 (`78b2729c51419a36c5e6f757fa54830100b5435c`) and PR #72 (`be742e1eb707b3892f6405adf5d8769e084eee65`), with later UX-A1, UX-A2 and PR #78 checkpoints also merged. Remaining live populated acceptance is Team, Fixtures and Leagues and does not reopen the completed 2.0.7 checkpoint.

## Transfers Track A final status — 2026-08-06

- [x] Record the first physical iPhone Safari evaluation-ceiling failure and its root cause.
- [x] Rebuild the exact search with admissible position-quota, price-capped and joint-budget bounds plus descending-gain stopping rules.
- [x] Preserve the independent exhaustive oracle and prove exactness on controlled adversarial pools.
- [x] Complete Official-scale exact-search verification below the unchanged ceiling.
- [x] Correct Worker cancellation/supersession settlement and mixed-width-ID partial tie bounds.
- [x] Correct the separate no-transfer baseline presentation contract without changing ranked Top K.
- [x] Replace zero-cost **“−0”** copy with **“No hit”**.
- [x] Pass the final 613-test gate with deterministic production builds and root/deployable equality.
- [x] Pass the populated physical iPhone Safari calculation and lifecycle checks, including the final wording confirmation.
- [x] Receive explicit stacked integration approval and merge PR #69, PR #70 and PR #72 in order.

Final `main` for that Track A checkpoint is `be742e1eb707b3892f6405adf5d8769e084eee65` and has the identical tree `3794e8e7ab9859717950296766dc9d64c9e5473f` as the verified PR #72 head. VoiceOver was not tested. Track B football-intelligence changes remain outside this checkpoint and unapproved.

## 2026-08-06 — Concurrent continuation reconciliation

- [x] Assess and retain Claude's concurrent exact-search correction.
- [x] Reconcile explicit cancellation and force-start promise settlement.
- [x] Harden partial signature bounds for mixed-width IDs.
- [x] Complete the combined 609-test interim verification, followed by the final 613-test baseline/presentation/copy gate.
- [x] Publish and physically test the combined preview on populated iPhone Safari.
- [x] Record duration, responsiveness, cancellation, persistence, cache reuse, app-switch and stale-result evidence.
- [x] Obtain explicit approval and complete the stacked integration sequence.

VoiceOver was deliberately not tested and is not an acceptance claim.

### Track A acceptance update — 2026-08-06

Core populated-data iPhone Safari acceptance passed for the exact six-Gameweek calculation and tested lifecycle paths, and the final **“No hit”** wording was visually confirmed. The accepted repository gate is 613 passing tests with deterministic builds. The approved stack is merged through final `main` `be742e1eb707b3892f6405adf5d8769e084eee65`. VoiceOver was not physically tested and is not an acceptance claim for this release.

## Track A merge record — 2026-08-06

The approved stack merged in order: PR #69 → `00a35bacd2396a125a8a914bff9980b4f18b257f`, PR #70 → `78b2729c51419a36c5e6f757fa54830100b5435c`, PR #72 → `be742e1eb707b3892f6405adf5d8769e084eee65`. Final `main` for that checkpoint has the same tree `3794e8e7ab9859717950296766dc9d64c9e5473f` as the verified PR #72 head. No Track B work was pulled forward.