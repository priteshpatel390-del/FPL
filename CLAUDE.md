# CLAUDE.md — onboarding for every future development session

<!-- TRANSFERS-TRACK-A-2026-08-06 -->
> **Current Track A review — Transfers exact performance and persistence:** Owner-approved Track A is implemented on `agent/transfers-exact-performance` (draft PR #70), stacked on draft PR #69 without changing PR #69 itself. Transfers calculates automatically for a complete legal squad and valid assumptions, keeps one exact browser-worker calculation alive across internal navigation, restores progress/results on return, and reuses unchanged completed results. **The first physical iPhone Safari test failed:** the automatic exact six-Gameweek search exhausted the unchanged 2,000,000 evaluation ceiling and reported *"Exact search did not complete."* The owner-approved corrective change rebuilds the exact search around position-quota score prefix sums, per-formation admissible bounds, price-capped optimistic completion tables and descending-gain stopping rules. The approved football problem, comparator, candidate universe, horizon, Top 8, transfer depth and evaluation ceiling are unchanged, and `exhaustiveTransferSearch()` remains an independent oracle. Automated verification is **606 passed, 0 failed, 0 skipped** with deterministic exact-identity builds and root/deployable equality. Model remains `2.4.0`; rules remain `2026-27.3`. **The corrected search has not yet been physically retested on iPhone Safari.** Do not merge PR #69 or PR #70 without Pritesh's explicit approval.

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
Teamsheet 2.0.7 is complete and merged through PR #68 at `2f7e4ba6978ccd68e9d6c36b56d4063cea06beaf`. Approved Scope FPL-T1 is implemented for review on draft PR #69, and approved Track A (exact persistent Transfers) is stacked on it as draft PR #70. Track A's first physical iPhone Safari test failed on the evaluation ceiling; the approved corrective search architecture is implemented and automatically verified at **606 passed, 0 failed, 0 skipped**, but physical retest is still outstanding — read `docs/TRANSFERS-EXACT-PERFORMANCE.md` before touching the optimiser. The owner-controlled Cloudflare Worker is deployed at the stable production origin, the built app is pinned to its exact `/fpl` base, and Pritesh verified a live 2026/27 Official FPL bootstrap response on physical iPhone Safari. The verified branch baseline is **590 passed, 0 failed, 0 skipped** with deterministic exact-identity builds and root/deployable equality; transfer optimisation now uses an explicit cancellable browser Web Worker with actual-model parity coverage, while model remains `2.4.0` and rules remain `2026-27.3`. Full populated Teamsheet acceptance for squad, transfers, fixtures, Player Detail and leagues remains pending. Do not merge PR #69 without Pritesh's explicit approval after that review.

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
