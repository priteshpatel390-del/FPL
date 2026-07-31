# CLAUDE.md — onboarding for every future development session
Read this first. GitHub `main` is the permanent source of truth; repository evidence overrides conversations and old uploads. Last updated: 2026-07-30.

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
Teamsheet 2.0.2 — Team decision home is implemented on the owner-approved presentation-only boundary: immediate pitch, concise XI/captain/bench forecast, one material risk, deadline action, honest setup/degraded states and progressive supporting detail. Existing model, provider, refresh, account and preview contracts remain unchanged. The next separately designed checkpoint is **Teamsheet 2.0.3 — Transfer decision experience**. Stage 10 collection and evaluation infrastructure remains complete; prospective validation is still in progress. The verified Teamsheet 2.0.2 baseline is **454/454 tests** with deterministic exact-identity builds and root/deployable equality.

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