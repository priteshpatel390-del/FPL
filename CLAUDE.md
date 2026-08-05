# CLAUDE.md — onboarding for every future development session
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
Teamsheet 2.0.7 — Final Mobile Polish and Acceptance is implemented for review on draft PR #68 from main `0f9e6c879859a2584ab8d7b9d4879a84efbfaf5d`. Approved Scope S-2.0.7 covers presentation, interaction, accessibility, resilience and acceptance preparation only. Verified source `5a61ec5510c447580afa6070a5a9815516babe86` passes **533 passed, 0 failed, 0 skipped**; generated deployables are committed at `__GENERATED_COMMIT__`. Two exact-identity production builds were byte-identical, root `index.html` equals `dist/index.html`, model remains `2.4.0` and rules remain `2026-27.3`. Physical iPhone Safari testing identified a foreground-resume defect; the approved correction is implemented and pending owner retest. VoiceOver and live populated-data acceptance remain pending. The checkpoint is not merged or fully accepted; do not merge without Pritesh’s explicit approval.

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
