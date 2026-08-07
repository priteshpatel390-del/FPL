# PROJECT_CONTEXT.md

<!-- TEAM-ACCEPTANCE-2026-08-07 -->
> **Current merged application checkpoint — Team populated acceptance complete:** PRs #80–#83 are merged, with current `main` `385e5102c0e86e4b926503bffceba08bd6d831c3` from PR #83. The exact final PR #83 head `990a85eb69319064038be458081d029d8a3b8828` passed **652 tests, 0 failed, 0 skipped, 0 cancelled**, deterministic byte-identical double-build verification, root/deployable equality and exact manifest build identity. The final PR head and merge commit share Git tree `70b38bf4bf5b5bdb0f295fa6738554266441e62b`. GitHub Pages deployment for `385e5102c0e86e4b926503bffceba08bd6d831c3` succeeded. Pritesh then physically accepted the populated Team path on iPhone Safari: startup/loading owns the viewport; availability is visible; the reserve goalkeeper occupies `GK`; outfield substitutes retain `1st` / `2nd` / `3rd`; and `Unavailable` is centred on one line without overlap. Normal Safari retained the saved manual squad; Private Browsing uses separate browser storage and is not currently a Teamsheet persistence defect. `docs/TEAM-UX-T01-T02-MERGE-RECORD.md` is authoritative for this Team follow-up sequence. Remaining populated live acceptance is **Fixtures, then Leagues**. No calculation, provider, data-source or security behaviour changed.

<!-- UX-A2-DOCK-LAYERING-CONTEXT-2026-08-07 -->
> **Current merged application checkpoint:** PR #78 corrected the post-merge Player Detail stacking conflict found by Pritesh on physical iPhone Safari. The backdrop and panel now layer above the unchanged fixed primary dock. PR #78 was physically accepted on populated iPhone Safari and merged at `ebb8838e7bfd081371a0639c9b4bdacfc9b92bc6`. Automated verification is **645 passed, 0 failed, 0 skipped, 0 cancelled** with deterministic byte-identical builds and root/deployable equality. GitHub Pages deployment succeeded and the Cloudflare Workers production build succeeded for `teamsheet-fpl-gateway`. `UI-14` is closed. No model, provider, route, navigation sizing or Player Detail information change was included.


<!-- UX-A2-2026-08-06 -->
> **UX-A2 Player Detail Scroll and Rotation Correction — complete and merged:** PR #76 merged to `main` at `bffcba8e9231adfc216125913f8ab83c042c3e10` from approved branch head `ad1dd4611c042591a3f03dea77a1a9b59101d9ba`, based on verified `main` `2738a0500b9be20a723f0940df0a93766b29c05d`. It corrects how the existing Player Detail dialog scrolls, locks the background, restores the page position and sizes itself when a phone rotates, and fixes root text-size adjustment at 100% so Safari cannot enlarge text after a rotation cycle. Player Detail's information architecture, the routing architecture and every calculation are unchanged. Verification is **644 passed, 0 failed, 0 skipped** with deterministic production outputs. **Populated physical iPhone Safari review passed on 6 August 2026**, including a successful retest of the corrected rotation behaviour; `UI-13` is closed and any earlier "pending" wording is superseded. Whether Player Detail shows too much information is a separate future proposal. UX-A3 and Workstream B remain outside scope and unapproved. `UX-A2-MERGE-RECORD.md` is authoritative for this original PR #76 checkpoint; the later dock-layering correction is authoritative in `UX-A2-DOCK-LAYERING-FOLLOW-UP.md`.

<!-- UX-A1-2026-08-06 -->
> **Historical status superseded — UX-A1 Team Resources and Bench Clarity is complete and merged:** PR #74 merged to `main` at `15aa01a07a5645f5df9ec2f2f429aefa52965c94` after **624 passed, 0 failed, 0 skipped**, deterministic production outputs and populated physical iPhone Safari acceptance on 6 August 2026. The Team resource bar and separate `GK`, `1st`, `2nd`, `3rd` bench roles preserve the bench array, order, Player Detail behaviour and all calculations. `UX-A1-MERGE-RECORD.md` is authoritative for that checkpoint.


<!-- TRANSFERS-TRACK-A-2026-08-06 -->
> **Current Track A status — complete and merged:** FPL-T1 and Track A are integrated on `main` through PR #69 (`00a35bacd2396a125a8a914bff9980b4f18b257f`), PR #70 (`78b2729c51419a36c5e6f757fa54830100b5435c`) and PR #72 (`be742e1eb707b3892f6405adf5d8769e084eee65`). The final `main` merge commit and the verified PR #72 head (`7257e8601b4a4f2fae80ce30a787f7069974a926`) have the identical repository tree `3794e8e7ab9859717950296766dc9d64c9e5473f`. The accepted branch baseline is **613 passed, 0 failed, 0 skipped** with deterministic production builds and root/deployable equality. On populated physical iPhone Safari, the six-Gameweek exact calculation completed in about 15 seconds; completed and active navigation persistence, prompt cancellation/restart, Safari app switching, stale-result protection, the separate no-transfer baseline and the final **“No hit”** wording all passed. VoiceOver testing is not a project acceptance requirement. No prediction-accuracy improvement is claimed, and Track B football intelligence remains unapproved and unimplemented.


> **FPL-T1 and Track A:** Complete and merged through PR #69 (`00a35bacd2396a125a8a914bff9980b4f18b257f`), PR #70 (`78b2729c51419a36c5e6f757fa54830100b5435c`) and PR #72 (`be742e1eb707b3892f6405adf5d8769e084eee65`). The owner-controlled Official FPL gateway remains transport-only, and the exact browser-worker optimiser remains local to the app. The final accepted automated baseline is **613 passed, 0 failed, 0 skipped** with deterministic builds; the tested populated iPhone Safari Transfers paths passed. Remaining live populated acceptance outside those tested paths stays separately recorded.

> **Teamsheet 2.0.7:** Complete and merged through PR #68. Its Safari foreground-resume correction passed owner retest. VoiceOver testing is not required for Teamsheet and is not an acceptance gate; earlier wording describing it as accepted-unverified is superseded by `VOICEOVER-DECISION.md`.

Purpose: master overview — the first document any new developer or session reads after CLAUDE.md.
Audience: anyone joining the project. Last updated: 2026-08-07. Related: ARCHITECTURE.md, ROADMAP.md, DECISIONS.md, TEAMSHEET2-PRODUCT-BLUEPRINT.md.

## What this is
**Teamsheet — FPL Decision Desk.** A single-file, mobile-first web app that helps Fantasy Premier League managers maximise the performance of their own complete 15-player squad through intelligent, explainable, team-level recommendations.

Teamsheet is team-first rather than player-first and decision-first rather than data-first. Its primary purpose is to answer the manager's weekly questions about the best XI, captaincy, bench, transfers, rank and Mini-League position. Advanced research, evidence and diagnostics remain available progressively without dominating the ordinary workflow.

The owner-approved canonical product direction is `TEAMSHEET2-PRODUCT-BLUEPRINT.md`.

## Current status
- The current merged **application** checkpoint is PR #83 at `385e5102c0e86e4b926503bffceba08bd6d831c3`. The exact final PR #83 head `990a85eb69319064038be458081d029d8a3b8828` passed **652 tests, 0 failed, 0 skipped, 0 cancelled** with deterministic byte-identical production builds, root/deployable equality and exact manifest identity; the head and merge commit share Git tree `70b38bf4bf5b5bdb0f295fa6738554266441e62b`. No model/golden expectation changed.
- GitHub Pages deployment succeeded for exact merge commit `385e5102c0e86e4b926503bffceba08bd6d831c3`. The Team follow-up added no Cloudflare Worker change.
- Transfers, Player Detail and the populated Team path now have physical iPhone Safari acceptance evidence for their tested paths. Remaining feature-specific populated live acceptance is **Fixtures, then Leagues**.
- Live on GitHub Pages from repository `priteshpatel390-del/FPL`.
- The 2026/27 season starts 21 August 2026; the app remains in pre-season mode until live GW1 data exists.
- Stages 1–9 and Stage 10.1–10.5 are complete and merged. Stage 10.5 merged through PR #45 at `0605ba5a02c49a5b599eba1ed00c443fa1889c92` after explicit owner approval. The complete Stage 10 design is owner-approved and its collection/evaluation infrastructure is complete.
- The Teamsheet 2.0 Product Blueprint was approved by Pritesh on 30 July 2026. Owner-approved 2.0.1 amendments on 31 July 2026 add Fixtures as a primary destination, shorten Mini Leagues to Leagues, keep free transfers and bank on Team, and promote Ask Teamsheet as a global/Team action.
- Teamsheet 2.0.1 implements hash routing, browser history/deep links, Team/Transfers/Fixtures/Leagues/Settings navigation and the five-section Settings hierarchy without changing formulas or providers. Verified baseline: **445/445 tests** with deterministic exact-identity builds and root/deployable equality.
- Teamsheet 2.0.2 implements the pitch-first Team decision home and is merged through PR #49 at `d01e6a36af47f8ce7962820f36174274af382493`. Its final verified source passed **459/459 tests** with deterministic exact-identity builds and root/deployable equality.
- Teamsheet 2.0.3 implements the Transfers Decision Workspace and is merged through PR #55 at `c82a883f3ae8eebc8a3017e9181748e562dd9ba8`. Verified baseline: **467/467 tests**, deterministic builds, root/deployable equality and owner iPhone visual acceptance; no VoiceOver claim is made.
- Teamsheet 2.0.4 implements the official Mini-League foundation and is merged through PR #59 at `a2841b0831193f645548cfc4155809b82a520d92`: primary/saved leagues, ID-free subroutes, official position/movement, points gaps, nearby standings, pinned rivals and one-rival-at-a-time public squad comparison. Verified baseline: **493/493 tests** with deterministic exact-identity builds and root/deployable equality. Physical testing of the actual repository build on an iPhone and live populated-data acceptance were not separately performed; the approved sample preview established design direction but was not equivalent to full repository-device acceptance.
- Teamsheet 2.0.5 implements factual selected-rival Mini-League intelligence and is merged through PR #63 at `0b04dd68194207d301667a7100c3ed804ec1e056`: explicit maximum-five selected rivals, on-demand current-Gameweek public picks, concurrency two, exact complete/fresh selected-rival exposure, stale/incomplete/unavailable separation, ID-free `#/leagues/exposure`, version-2 minimal persistence and stricter optional-field validation. Verified baseline: **510/510 tests** with deterministic exact-identity builds and root/deployable equality. Projected or strategic Mini-League intelligence remains excluded. Physical iPhone and live populated-data acceptance remain unperformed.
- Teamsheet 2.0.6 implements Research, Evidence and Diagnostics Organisation and is complete and merged through PR #65 at `cd1ad52ea4d13a247a82bc90f80f2db0b6f77aa4`. It separates each Settings goal into route-owned landings and children, gives Stage 10 UI modules explicit hosts, keeps healthy Provider Health out of the header, surfaces only material core-data warnings, completes Help & About and adapts Player Explorer for narrow screens. Verified baseline: **520 passed, 0 failed, 0 skipped** with deterministic exact-identity builds and root/deployable equality. It changed no provider, data source, model, fixture, scoring, squad, captaincy, simulation, optimiser, rank or Mini-League calculation. Physical iPhone Safari and live populated-data acceptance remain unperformed for the relevant untested paths.
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
Completed and merged: Stage 1 characterisation/audit, SEC-1, Stage 2 modularisation, repository handover, Stage 3 security/provider hardening, Stage 4 expected minutes, Stage 5 scoring corrections, Stage 6 transfer optimiser, Stage 7 walk-forward backtest, Stage 8 uncertainty/squad simulation, all six Stage 9 UI-integration checkpoints, Stage 10.1–10.5 prospective-validation infrastructure, Teamsheet 2.0.1–2.0.7, UX-A1, UX-A2 and the PR #78 Player Detail dock-layering correction.

Approved product direction: Teamsheet 2.0 Product Blueprint and migration checkpoints 2.0.1–2.0.7.

Current operational work: pre-season readiness and prospective 2026/27 evidence collection. Stage 10 infrastructure is complete; accuracy and calibration validation remain in progress.

Current development position: **no application implementation checkpoint is approved.** The PR #78 application checkpoint is merged and its documentation is being reconciled without runtime changes. The next substantive work is investigation-only populated live-acceptance planning in this order: **Team → Fixtures → Leagues**. Transfers and Player Detail are excluded from that remaining plan because populated iPhone acceptance evidence already exists for their tested paths. Any new product implementation, provider, model, UX-A3 or Track B work requires investigation, exact scope and Pritesh's explicit approval.

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
The current merged application checkpoint is PR #78 at `ebb8838e7bfd081371a0639c9b4bdacfc9b92bc6`, with **645 passed, 0 failed, 0 skipped, 0 cancelled**, deterministic byte-identical builds, root/deployable equality and populated iPhone Safari acceptance for the corrected Player Detail path. `UI-14` is closed. This documentation reconciliation changes no provider, data source, model, fixture, scoring, squad, captaincy, simulation, optimiser, rank, Mini-League, routing, Cloudflare or Pages behaviour. VoiceOver is not a project acceptance gate. The next substantive item is investigation-only populated live-acceptance planning for Team, Fixtures and Leagues; application changes remain separately gated.

## 2026-08-06 — Concurrent continuation reconciliation

Claude's substantive exact-search correction was pushed concurrently and is retained in full. Reconciliation added two complementary Track A safeguards: intentional Worker cancellation now settles the associated pending promise, and partial-node signature bounds no longer depend on numeric and locale string ordering being equivalent.

The final combined repository gate is 609 passing tests. A deterministic Official-scale seed-7 profile completed with 21 exact leaf evaluations across 575 outgoing branches. This is automated search evidence, not physical-device acceptance.

## Track A device acceptance update — 2026-08-06

The reconciled exact Transfers flow has passed its core physical iPhone Safari checks on populated data: six-Gameweek completion in about 15 seconds, cached navigation restoration, prompt cancellation/restart, active-navigation persistence, Safari app-switch stability and stale-result protection. The final approved display correction replaces confusing zero-cost **“−0”** text with **“No hit”** everywhere. That interim state was subsequently verified and merged through PRs #69, #70 and #72 at final `main` `be742e1eb707b3892f6405adf5d8769e084eee65`, as recorded below.

## Track A integrated checkpoint — 2026-08-06

PR #69 merged at `00a35bacd2396a125a8a914bff9980b4f18b257f`, PR #70 at `78b2729c51419a36c5e6f757fa54830100b5435c` and PR #72 at `be742e1eb707b3892f6405adf5d8769e084eee65`. The final merge tree `3794e8e7ab9859717950296766dc9d64c9e5473f` is identical to the verified PR #72 head tree, so integration introduced no content drift. The accepted runtime/build evidence remains 613 passing tests, deterministic production builds and the recorded populated iPhone Safari checks. VoiceOver was not tested, and no physical screen-reader claim is made. Track B remains unapproved.