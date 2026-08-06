# CLAUDE.md — onboarding for every future development session

<!-- TRANSFERS-TRACK-A-2026-08-06 -->
> **Current Track A review — Transfers exact performance and persistence:** Owner-approved Track A is implemented on `agent/transfers-exact-performance`, stacked on draft PR #69 without changing PR #69 itself. Transfers now calculates automatically for a complete legal squad and valid assumptions, keeps one exact browser-worker calculation alive across internal navigation, restores progress/results on return, and reuses unchanged completed results. The exact search reuses prepared scores and unchanged squad cores, avoids full result construction for losing candidates and applies conservative mathematically safe bounds while retaining `exhaustiveTransferSearch()` as an independent reduced-pool oracle. Automated verification is **594 passed, 0 failed, 0 skipped** with deterministic exact-identity builds and root/deployable equality. Model remains `2.4.0`; rules remain `2026-27.3`. Physical iPhone Safari completion time, memory pressure, cancellation latency and repeated-run acceptance remain required. Do not merge PR #69 or the Track A branch without Pritesh's explicit approval.

Read this first. GitHub `main` is the permanent source of truth; repository evidence overrides conversations and old uploads. Last updated: 2026-08-05.

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
Teamsheet 2.0.7 is complete and merged through PR #68 at `2f7e4ba6978ccd68e9d6c36b56d4063cea06beaf`. Approved Scope FPL-T1 is implemented for review on draft PR #69. The owner-controlled Cloudflare Worker is deployed at the stable production origin, the built app is pinned to its exact `/fpl` base, and Pritesh verified a live 2026/27 Official FPL bootstrap response on physical iPhone Safari. The verified branch baseline is **590 passed, 0 failed, 0 skipped** with deterministic exact-identity builds and root/deployable equality; transfer optimisation now uses an explicit cancellable browser Web Worker with actual-model parity coverage, while model remains `2.4.0` and rules remain `2026-27.3`. Full populated Teamsheet acceptance for squad, transfers, fixtures, Player Detail and leagues remains pending. Do not merge PR #69 without Pritesh's explicit approval after that review.

## Non-negotiable rules
- Never change projection, minutes, scoring, fixture, captaincy, squad or optimisation formulas without presenting existing behaviour, proposed behaviour, inputs, fallback, assumptions, limitations and validating tests, then receiving owner approval.
- Never delete or weaken an existing test to make work pass.
- Never claim improved prediction accuracy without genuine out-of-sample validation. The historical r=0.80 is method-flattered.
- Run `./run-tests.sh` before describing implementation as complete.
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
