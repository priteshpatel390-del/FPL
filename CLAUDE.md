# CLAUDE.md — onboarding for every future development session

<!-- VOICEOVER-DECISION-2026-08-06 -->
> **Owner decision — 6 August 2026:** VoiceOver testing is not required for Teamsheet and is not an acceptance gate. `docs/VOICEOVER-DECISION.md` supersedes earlier current-status wording that treated it as pending or accepted-unverified. Standard accessibility safeguards—including semantic controls, labels, focus behaviour, reduced motion, contrast, touch targets and keyboard behaviour—remain required where applicable.

<!-- UX-A2-2026-08-06 -->
> **UX-A2 Player Detail Scroll and Rotation Correction — complete and merged:** PR #76 merged to `main` at `bffcba8e9231adfc216125913f8ab83c042c3e10` from approved branch head `ad1dd4611c042591a3f03dea77a1a9b59101d9ba`, based on verified `main` `2738a0500b9be20a723f0940df0a93766b29c05d`. The merge commit and approved branch head have the identical repository tree. Scope is behaviour correction only for the existing Player Detail dialog: internal scrolling, root plus body scroll locking, exact background-position restoration on a normal close, route-driven close that unlocks without replaying stale scroll or focus, viewport-height fallback before `dvh`, compact-landscape sizing, four-sided safe areas, `preventScroll` focus handling and root text-size adjustment fixed at 100% so Safari cannot inflate text on rotation. Player Detail's information architecture, the routing architecture and every calculation are unchanged. Automated verification is **644 passed, 0 failed, 0 skipped** with deterministic exact-identity builds and root/deployable equality. **Populated physical iPhone Safari acceptance passed on 6 August 2026**, including a successful retest of the corrected rotation behaviour; this supersedes all earlier wording describing that acceptance as pending. `UI-13` is closed. VoiceOver is not an acceptance gate. `docs/UX-A2-MERGE-RECORD.md` is the authoritative checkpoint record and supersedes any pre-merge wording elsewhere; `docs/UX-A2-ACCEPTANCE.md` records the acceptance detail and `docs/UX-A2-SCOPE.md` the scope and evidence. Making Player Detail more concise is a **separate future proposal**, not part of UX-A2. UX-A3 and Workstream B remain unapproved and must not start.

<!-- UX-A1-2026-08-06 -->
> **UX-A1 Team Resources and Bench Clarity — complete and merged:** PR #74 merged to `main` at `15aa01a07a5645f5df9ec2f2f429aefa52965c94` from approved branch head `3435c1dda12055c72ecab1a28d463b35d4278c09`. The Team screen has one labelled manual-resource bar immediately above the pitch and separate `GK`, `1st`, `2nd`, `3rd` bench roles, with the existing squad order, calculations and Player Detail behaviour preserved. Automated verification is **624 passed, 0 failed, 0 skipped** with deterministic exact-identity builds and root/deployable equality. Populated physical iPhone Safari acceptance passed on 6 August 2026. `docs/UX-A1-MERGE-RECORD.md` is the authoritative checkpoint record and supersedes any pre-merge wording elsewhere. Workstreams A3 and B remain unapproved and must not start; UX-A2 has since been separately completed and merged (see the UX-A2 banner above).


<!-- TRANSFERS-TRACK-A-2026-08-06 -->
> **Current Track A status — complete and merged:** FPL-T1 and Track A are integrated on `main` through PR #69 (`00a35bacd2396a125a8a914bff9980b4f18b257f`), PR #70 (`78b2729c51419a36c5e6f757fa54830100b5435c`) and PR #72 (`be742e1eb707b3892f6405adf5d8769e084eee65`). The final `main` merge commit and the verified PR #72 head (`7257e8601b4a4f2fae80ce30a787f7069974a926`) have the identical repository tree `3794e8e7ab9859717950296766dc9d64c9e5473f`. The accepted branch baseline is **613 passed, 0 failed, 0 skipped** with deterministic production builds and root/deployable equality. On populated physical iPhone Safari, the six-Gameweek exact calculation completed in about 15 seconds; completed and active navigation persistence, prompt cancellation/restart, Safari app switching, stale-result protection, the separate no-transfer baseline and the final **“No hit”** wording all passed. VoiceOver testing is not a project acceptance requirement. No prediction-accuracy improvement is claimed, and Track B football intelligence remains unapproved and unimplemented.

Read this first. GitHub `main` is the permanent source of truth; repository evidence overrides conversations and old uploads. Last updated: 2026-08-06.

## Owner
Pritesh is a non-developer but rigorous reviewer who primarily works from an iPhone. Lead with outcomes, explain technical decisions plainly, distinguish facts from proposals and never claim success without evidence.

## Read in this order
1. `docs/UX-A2-MERGE-RECORD.md` for the current merged checkpoint and its supersession note, then `docs/UX-A1-MERGE-RECORD.md` for the preceding one
2. `docs/PROJECT_CONTEXT.md`
3. `docs/ARCHITECTURE.md`
4. `docs/DECISIONS.md`
5. `docs/ROADMAP.md`
6. `docs/KNOWN_LIMITATIONS.md`
7. `docs/TEAMSHEET2-PRODUCT-BLUEPRINT.md`
8. The current checkpoint design document
9. Before provider/security work: `docs/DATA_SOURCES.md` and `docs/SECURITY.md`
10. Before model/projection/squad/optimisation work: `docs/PROJECTION_MODEL.md` and `docs/TESTING.md`
11. History only when needed: `docs/STAGE_HISTORY.md`, `docs/CHANGELOG.md`, earlier stage/audit records

## Current checkpoint
UX-A2 Player Detail Scroll and Rotation Correction is complete and merged through PR #76 at `bffcba8e9231adfc216125913f8ab83c042c3e10`. Its approved branch head `ad1dd4611c042591a3f03dea77a1a9b59101d9ba` and the merge commit have the identical repository tree. The accepted automated baseline is **644 passed, 0 failed, 0 skipped**, with deterministic exact-identity builds and root `index.html` equal to `dist/index.html`. Populated physical iPhone Safari acceptance passed on 6 August 2026, including a successful retest of the corrected Safari rotation text-inflation behaviour; `UI-13` is closed. `docs/UX-A2-MERGE-RECORD.md` is the authoritative checkpoint record. UX-A1 remains complete and merged through PR #74 at `15aa01a07a5645f5df9ec2f2f429aefa52965c94` at a **624** baseline, and FPL-T1 and Track A through PRs #69, #70 and #72. VoiceOver testing is not a project acceptance requirement. Current operational work is pre-season readiness and prospective 2026/27 evidence collection. Workstreams A3, Track B, every provider/model change and the separate proposal to make Player Detail more concise remain unapproved; begin any later development with investigation, exact scope and Pritesh's explicit approval.

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

## Handover update — 2026-08-06

- PR #72 core populated-data iPhone Safari checks passed: six-GW exact completion ~15 seconds; completed and active navigation persistence; prompt cancel/restart; Safari app-switch stability; stale-result protection.
- PR #74 UX-A1 Team Resources and Bench Clarity merged at `15aa01a07a5645f5df9ec2f2f429aefa52965c94` after 624 passing tests, deterministic builds and populated iPhone Safari acceptance.
- VoiceOver testing is not required for Teamsheet and is not an acceptance gate.
- Product wording rule: user-facing FPL information must be simple and immediately understandable. Zero transfer cost is **“No hit”**, never **“−0”**.
- UX-A2 is approved only for the Player Detail scroll, lock, restoration, viewport, rotation, safe-area and focus behaviour recorded in `docs/UX-A2-SCOPE.md`; no A3, Track B, optimiser, football-model, ranking or provider work is approved without a new explicit gate.
