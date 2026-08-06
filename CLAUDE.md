# CLAUDE.md — onboarding for every future development session

<!-- VOICEOVER-DECISION-2026-08-06 -->
> **Owner decision — 6 August 2026:** VoiceOver testing is not required for Teamsheet and is not an acceptance gate. `docs/VOICEOVER-DECISION.md` supersedes earlier current-status wording that treated it as pending or accepted-unverified. Standard accessibility safeguards—including semantic controls, labels, focus behaviour, reduced motion, contrast, touch targets and keyboard behaviour—remain required where applicable.

<!-- UX-A1-2026-08-06 -->
> **Current approved review item — UX-A1 Team Resources and Bench Clarity:** implemented on `agent/ux-a1-team-resources-bench-clarity` from verified `main` `06e4a07d95c961af2ebbb90f1e142635a582e7b1`. The Team screen now has one labelled manual-resource bar immediately above the pitch and separate `GK`, `1st`, `2nd`, `3rd` bench roles, with the existing squad order, calculations and Player Detail behaviour preserved. Automated verification is **624 passed, 0 failed, 0 skipped** with deterministic exact-identity builds and root/deployable equality. Physical populated iPhone Safari acceptance passed on 6 August 2026. Workstreams A2, A3 and B remain unapproved and must not start. The draft PR must not be merged without Pritesh's explicit approval.


<!-- TRANSFERS-TRACK-A-2026-08-06 -->
> **Current Track A status — complete and merged:** FPL-T1 and Track A are integrated on `main` through PR #69 (`00a35bacd2396a125a8a914bff9980b4f18b257f`), PR #70 (`78b2729c51419a36c5e6f757fa54830100b5435c`) and PR #72 (`be742e1eb707b3892f6405adf5d8769e084eee65`). The final `main` merge commit and the verified PR #72 head (`7257e8601b4a4f2fae80ce30a787f7069974a926`) have the identical repository tree `3794e8e7ab9859717950296766dc9d64c9e5473f`. The accepted branch baseline is **613 passed, 0 failed, 0 skipped** with deterministic production builds and root/deployable equality. On populated physical iPhone Safari, the six-Gameweek exact calculation completed in about 15 seconds; completed and active navigation persistence, prompt cancellation/restart, Safari app switching, stale-result protection, the separate no-transfer baseline and the final **“No hit”** wording all passed. VoiceOver testing is not a project acceptance requirement. No prediction-accuracy improvement is claimed, and Track B football intelligence remains unapproved and unimplemented.

Read this first. GitHub `main` is the permanent source of truth; repository evidence overrides conversations and old uploads. Last updated: 2026-08-06.

## Owner
Pritesh is a non-developer but rigorous reviewer who primarily works from an iPhone. Lead with outcomes, explain technical decisions plainly, distinguish facts from proposals and never claim success without evidence.

## Read in this order
1. `docs/PROJECT_CONTEXT.md`
2. `docs/ARCHITECTURE.md`
3. `docs/DECISIONS.md`
4. `docs/ROADMAP.md`
5. `docs/KNOWN_LIMITATIONS.md`
6. `docs/TEAMSHEET2-PRODUCT-BLUEPRINT.md`
7. The current checkpoint design document
8. Before provider/security work: `docs/DATA_SOURCES.md` and `docs/SECURITY.md`
9. Before model/projection/squad/optimisation work: `docs/PROJECTION_MODEL.md` and `docs/TESTING.md`
10. History only when needed: `docs/STAGE_HISTORY.md`, `docs/CHANGELOG.md`, earlier stage/audit records

## Current checkpoint
FPL-T1 and Track A are complete and merged on `main` through PR #69 (`00a35bacd2396a125a8a914bff9980b4f18b257f`), PR #70 (`78b2729c51419a36c5e6f757fa54830100b5435c`) and PR #72 (`be742e1eb707b3892f6405adf5d8769e084eee65`). The final merge tree exactly matches the verified PR #72 tree `3794e8e7ab9859717950296766dc9d64c9e5473f`. The accepted automated baseline is **613 passed, 0 failed, 0 skipped**, with deterministic production builds and root `index.html` equal to `dist/index.html`. Populated iPhone Safari acceptance passed for the exact Transfers calculation and tested lifecycle paths. Full live populated acceptance outside the tested Transfers paths remains open where separately recorded, including other Team, Fixtures, Player Detail and Leagues flows. Current operational work is pre-season readiness and prospective 2026/27 evidence collection. UX-A1 Team Resources and Bench Clarity is the only approved implementation item and is in branch review. Workstreams A2, A3, Track B and every provider/model change remain unapproved; begin any later development with investigation, exact scope and Pritesh's explicit approval.

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
- VoiceOver testing is not required for Teamsheet and is not an acceptance gate.
- Product wording rule: user-facing FPL information must be simple and immediately understandable. Zero transfer cost is **“No hit”**, never **“−0”**.
- This final copy correction is presentation-only. Do not change optimiser, football model, ranking or transfer rules without a new approval gate.
- PRs #69, #70 and #72 were explicitly approved and merged in sequence; final `main` is `be742e1eb707b3892f6405adf5d8769e084eee65` and matches the verified PR #72 tree.
