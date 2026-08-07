# CLAUDE.md — onboarding for every future development session

<!-- FIXTURES-GW38-HORIZON-2026-08-07 -->
> **Approved Fixtures GW38 horizon follow-up — implementation in review:** owner testing after PR #85 deployment confirmed the mobile sticky-column/fallback-note correction and exposed a separate silent 12-Gameweek cap: Safari could display a typed value such as 23 while the renderer clamped it to 12. The approved follow-up exposes the remaining season through GW38, synchronises the visible horizon to the actual rendered span, prevents post-GW38 swing windows, and preserves every existing fixture difficulty, `runScore`, blank/double and projection formula. Branch verification: **660 passed, 0 failed, 0 skipped, 0 cancelled**. Physical iPhone retest remains required before Fixtures acceptance closes.

<!-- FIXTURES-MOBILE-SCROLL-FOLLOW-UP-2026-08-07 -->
> **Approved implementation in review — Fixtures mobile horizontal-scroll presentation:** populated iPhone Safari review proved 12-Gameweek horizontal scrolling works but exposed a broken sticky TEAM presentation, a fallback explanation that travelled with the table, and static intro copy that contradicted the active Official-FPL fallback. The approved branch is presentation-only: fixture calculations, fallback mathematics, providers, projections and strategy stay unchanged. `docs/FIXTURES-MOBILE-SCROLL-FOLLOW-UP.md` is the focused record. Automated verification is recorded there; physical iPhone retest remains required before Fixtures is accepted and the project moves to Leagues.

<!-- TEAM-ACCEPTANCE-2026-08-07 -->
> **Current merged application checkpoint — Team populated acceptance complete:** PRs #80–#83 are merged, with current `main` `385e5102c0e86e4b926503bffceba08bd6d831c3` from PR #83. The exact final PR #83 head `990a85eb69319064038be458081d029d8a3b8828` passed **652 tests, 0 failed, 0 skipped, 0 cancelled**, deterministic byte-identical double-build verification, root/deployable equality and exact manifest build identity. The final PR head and merge commit share Git tree `70b38bf4bf5b5bdb0f295fa6738554266441e62b`. GitHub Pages deployment for `385e5102c0e86e4b926503bffceba08bd6d831c3` succeeded. Pritesh then physically accepted the populated Team path on iPhone Safari: startup/loading owns the viewport; availability is visible; the reserve goalkeeper occupies `GK`; outfield substitutes retain `1st` / `2nd` / `3rd`; and `Unavailable` is centred on one line without overlap. Normal Safari retained the saved manual squad; Private Browsing uses separate browser storage and is not currently a Teamsheet persistence defect. `docs/TEAM-UX-T01-T02-MERGE-RECORD.md` is authoritative for this Team follow-up sequence. Remaining populated live acceptance is **Fixtures, then Leagues**. No calculation, provider, data-source or security behaviour changed.

<!-- UX-A2-DOCK-LAYERING-2026-08-07 -->
> **Preceding merged checkpoint — PR #78 Player Detail dock-layering correction:** PR #78 was physically accepted on populated iPhone Safari and merged to `main` at `ebb8838e7bfd081371a0639c9b4bdacfc9b92bc6`. It raises only the existing Player Detail backdrop and panel above the unchanged fixed primary dock so the final projection line cannot be covered. Verification is **645 passed, 0 failed, 0 skipped, 0 cancelled** with deterministic exact-identity builds and root/deployable equality. GitHub Pages deployment succeeded and the Cloudflare Workers production build succeeded for `teamsheet-fpl-gateway`. Every FPL calculation, Player Detail content, route and navigation dimension is unchanged. `UI-14` is closed. `docs/UX-A2-DOCK-LAYERING-FOLLOW-UP.md` is authoritative for this correction; UX-A3 and Track B remain unapproved.


<!-- VOICEOVER-DECISION-2026-08-06 -->
> **Owner decision — 6 August 2026:** VoiceOver testing is not required for Teamsheet and is not an acceptance gate. `docs/VOICEOVER-DECISION.md` supersedes earlier current-status wording that treated it as pending or accepted-unverified. Standard accessibility safeguards—including semantic controls, labels, focus behaviour, reduced motion, contrast, touch targets and keyboard behaviour—remain required where applicable.

<!-- UX-A2-2026-08-06 -->
> **UX-A2 Player Detail Scroll and Rotation Correction — complete and merged:** PR #76 merged to `main` at `bffcba8e9231adfc216125913f8ab83c042c3e10` from approved branch head `ad1dd4611c042591a3f03dea77a1a9b59101d9ba`, based on verified `main` `2738a0500b9be20a723f0940df0a93766b29c05d`. The merge commit and approved branch head have the identical repository tree. Scope is behaviour correction only for the existing Player Detail dialog: internal scrolling, root plus body scroll locking, exact background-position restoration on a normal close, route-driven close that unlocks without replaying stale scroll or focus, viewport-height fallback before `dvh`, compact-landscape sizing, four-sided safe areas, `preventScroll` focus handling and root text-size adjustment fixed at 100% so Safari cannot inflate text on rotation. Player Detail's information architecture, the routing architecture and every calculation are unchanged. Automated verification is **644 passed, 0 failed, 0 skipped** with deterministic exact-identity builds and root/deployable equality. **Populated physical iPhone Safari acceptance passed on 6 August 2026**, including a successful retest of the corrected rotation behaviour; this supersedes all earlier wording describing that acceptance as pending. `UI-13` is closed. VoiceOver is not an acceptance gate. `docs/UX-A2-MERGE-RECORD.md` is the authoritative record for the original PR #76 checkpoint; the later PR #78 dock-layering correction is authoritative in `docs/UX-A2-DOCK-LAYERING-FOLLOW-UP.md`. `docs/UX-A2-ACCEPTANCE.md` records the original acceptance detail and `docs/UX-A2-SCOPE.md` the scope and evidence. Making Player Detail more concise is a **separate future proposal**, not part of UX-A2. UX-A3 and Workstream B remain unapproved and must not start.

<!-- UX-A1-2026-08-06 -->
> **UX-A1 Team Resources and Bench Clarity — complete and merged:** PR #74 merged to `main` at `15aa01a07a5645f5df9ec2f2f429aefa52965c94` from approved branch head `3435c1dda12055c72ecab1a28d463b35d4278c09`. The Team screen has one labelled manual-resource bar immediately above the pitch and separate `GK`, `1st`, `2nd`, `3rd` bench roles, with the existing squad order, calculations and Player Detail behaviour preserved. Automated verification is **624 passed, 0 failed, 0 skipped** with deterministic exact-identity builds and root/deployable equality. Populated physical iPhone Safari acceptance passed on 6 August 2026. `docs/UX-A1-MERGE-RECORD.md` is the authoritative checkpoint record and supersedes any pre-merge wording elsewhere. Workstreams A3 and B remain unapproved and must not start; UX-A2 has since been separately completed and merged (see the UX-A2 records above).


<!-- TRANSFERS-TRACK-A-2026-08-06 -->
> **Current Track A status — complete and merged:** FPL-T1 and Track A are integrated on `main` through PR #69 (`00a35bacd2396a125a8a914bff9980b4f18b257f`), PR #70 (`78b2729c51419a36c5e6f757fa54830100b5435c`) and PR #72 (`be742e1eb707b3892f6405adf5d8769e084eee65`). The final `main` merge commit and the verified PR #72 head (`7257e8601b4a4f2fae80ce30a787f7069974a926`) have the identical repository tree `3794e8e7ab9859717950296766dc9d64c9e5473f`. The accepted branch baseline is **613 passed, 0 failed, 0 skipped** with deterministic production builds and root/deployable equality. On populated physical iPhone Safari, the six-Gameweek exact calculation completed in about 15 seconds; completed and active navigation persistence, prompt cancellation/restart, Safari app switching, stale-result protection, the separate no-transfer baseline and the final **“No hit”** wording all passed. VoiceOver testing is not a project acceptance requirement. No prediction-accuracy improvement is claimed, and Track B football intelligence remains unapproved and unimplemented.

Read this first. GitHub `main` is the permanent source of truth; repository evidence overrides conversations and old uploads. Last updated: 2026-08-07.

## Owner
Pritesh is a non-developer but rigorous reviewer who primarily works from an iPhone. Lead with outcomes, explain technical decisions plainly, distinguish facts from proposals and never claim success without evidence.

## Read in this order
1. `docs/TEAM-UX-T01-T02-MERGE-RECORD.md` — authoritative record for the current merged Team populated-acceptance checkpoint
2. `docs/UX-A2-DOCK-LAYERING-FOLLOW-UP.md` — authoritative record for the preceding PR #78 dock-layering correction
3. `docs/UX-A2-MERGE-RECORD.md` — authoritative record for the preceding PR #76 UX-A2 checkpoint
4. `docs/UX-A1-MERGE-RECORD.md` — preceding UX-A1 checkpoint
5. `docs/PROJECT_CONTEXT.md`
6. `docs/ARCHITECTURE.md`
7. `docs/DECISIONS.md`
8. `docs/ROADMAP.md`
9. `docs/KNOWN_LIMITATIONS.md`
10. `docs/TEAMSHEET2-PRODUCT-BLUEPRINT.md`
11. The current checkpoint design document
12. Before provider/security work: `docs/DATA_SOURCES.md` and `docs/SECURITY.md`
13. Before model/projection/squad/optimisation work: `docs/PROJECTION_MODEL.md` and `docs/TESTING.md`
14. History only when needed: `docs/STAGE_HISTORY.md`, `docs/CHANGELOG.md`, earlier stage/audit records

## Current checkpoint
The current merged **application** checkpoint is PR #83 at `385e5102c0e86e4b926503bffceba08bd6d831c3`. PRs #80–#83 complete the approved Team T-01/T-02 populated-iPhone follow-up sequence. The exact final PR #83 head `990a85eb69319064038be458081d029d8a3b8828` passed **652 tests, 0 failed, 0 skipped, 0 cancelled**, two byte-identical production builds, root `index.html` equality with `dist/index.html` and exact manifest identity; that head and merge commit share Git tree `70b38bf4bf5b5bdb0f295fa6738554266441e62b`. GitHub Pages deployment for the merge commit succeeded. Pritesh physically accepted the deployed Team path on 7 August 2026, including startup ownership, explicit availability, reserve-GK display, preserved outfield bench order and the centred one-line unavailable badge. The next substantive work is investigation-only populated live acceptance of **Fixtures**, followed by **Leagues**. No Fixtures implementation, model/provider change, UX-A3 or Track B work is approved by this checkpoint.

## Non-negotiable rules
- Never change projection, minutes, scoring, fixture, captaincy, squad or optimisation formulas without presenting existing behaviour, proposed behaviour, inputs, fallback, assumptions, limitations and validating tests, then receiving owner approval.
- Never delete or weaken an existing test to make work pass.
- Never claim improved prediction accuracy without genuine out-of-sample validation. The historical r=0.80 is method-flattered.
- Run `./run-tests.sh` before describing implementation as complete.
- Transfer search pruning must be admissible. Every bound must relax constraints only in the optimistic direction, must never remove a branch that could enter the retained top K under the complete comparator, and must leave `exhaustiveTransferSearch()` independent of production pruning.
- Preserve deterministic builds and exact `BUILD_COMMIT` identity.
- Preserve vanilla ES modules, zero dependencies, GitHub Pages and the single-file `dist/index.html` deploy workflow.
- Generated `dist/` files come from `build.mjs`; never hand-edit them.
- Anthropic keys are banned client-side.
- Odds requests remain direct-only; the key must never be relayed, logged, exposed in errors or rendered into UI diagnostics.
- Understat remains team-level only.
- No new provider without an approved validation and ablation plan.
- Stage discipline: inspect → scope/exclusions → owner approval where required → branch → implementation → full verification → docs → draft PR → owner review → merge only with explicit approval.
- Teamsheet 2.0 checkpoints remain independently designed, approved, tested, reviewed and deployable. Do not silently pull later checkpoints forward.

## Current security and build posture
- Provider/user rendering uses DOM builders.
- AI output uses restricted Markdown AST rendering.
- Odds key is masked, omitted when empty, one-action forgettable and scrubbed from diagnostics.
- Build emits and independently verifies SHA-256 CSP hashes for the single inline script/style.
- The custom bundler strips complete static import/export declarations and fails if raw module syntax survives.
- Style attributes and runtime style APIs are forbidden by DOM helpers, source guards and deployable tests; CSP permits only the hash-locked style element and approved Google Fonts stylesheet.
- Meta `frame-ancestors` is ineffective in meta CSP on GitHub Pages; a hashed frame-buster compensates until serverless headers.

## Completion report for every item
Report what changed, what deliberately did not change, exact test count/result, build and reproducibility evidence, documentation updates, judgement calls, remaining limitations, branch/commit and draft PR link.

## 2026-08-06 — Concurrent continuation reconciliation

- Claude's corrected exact-search commits landed on PR #70 while a separate continuation audit was in progress. The reconciliation preserves Claude's position-pool, price-capped and stopping-rule architecture.
- The app-scoped controller now settles the pending Worker result promise on explicit cancellation, material invalidation and force-start supersession, preventing orphaned in-session calculation chains.
- Partial-node signature ties now use the universally optimistic empty string; exact canonical signatures remain unchanged and are evaluated only for complete branches.
- Mixed-width player IDs, explicit cancellation settlement and supersession settlement are permanent regressions.
- Interim reconciliation verification was 609 passed with deterministic builds. That pending device gate was subsequently completed on PR #72 and is superseded by the accepted 613-test merged checkpoint above.

## Handover update — 2026-08-07

- PR #72 core populated-data iPhone Safari checks passed: six-GW exact completion ~15 seconds; completed and active navigation persistence; prompt cancel/restart; Safari app-switch stability; stale-result protection.
- PR #74 UX-A1 Team Resources and Bench Clarity merged at `15aa01a07a5645f5df9ec2f2f429aefa52965c94` after 624 passing tests, deterministic builds and populated iPhone Safari acceptance.
- PR #76 UX-A2 Player Detail scroll/rotation correction merged after 644 passing tests and populated iPhone Safari acceptance; PR #78 then fixed the post-merge dock-layering defect, passed the 645-test gate, received populated iPhone Safari acceptance and merged at `ebb8838e7bfd081371a0639c9b4bdacfc9b92bc6`.
- VoiceOver testing is not required for Teamsheet and is not an acceptance gate.
- Product wording rule: user-facing FPL information must be simple and immediately understandable. Zero transfer cost is **“No hit”**, never **“−0”**.
- The next substantive work is investigation-only populated live-acceptance planning for Team, then Fixtures, then Leagues. Transfers and Player Detail are excluded from that remaining plan because their tested populated iPhone paths already have acceptance evidence. No A3, Track B, optimiser, football-model, ranking or provider implementation is approved without a new explicit gate.