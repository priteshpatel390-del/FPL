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
6. The current stage design document
7. Before provider/security work: `docs/DATA_SOURCES.md` and `docs/SECURITY.md`
8. Before model/projection/squad/optimisation work: `docs/PROJECTION_MODEL.md` and `docs/TESTING.md`
9. History only when needed: `docs/STAGE_HISTORY.md`, `docs/CHANGELOG.md`, earlier stage/audit records

## Current checkpoint
Stage 10.4 — Operating review/export is complete and merged through PR #35 at `6a96096cfa59fd3476aa89c191cc8ca6400d358b` after explicit owner approval. It remains a downstream-only consumer of exact Stage 10.1–10.3 evidence and does not alter production formulas or providers. Verified source `1eca9a8817da41597d0632c819142237d31627fb` passes **413/413 tests** with byte-identical exact-identity builds; generated artefacts are committed at `1af7dac5383c91e915587218e7551c2f619cec8f` with source hash `d1773a1ae9e36ae28adef232148a3f7e315f21baf989e03e0158c9beefe729ed`. The next checkpoint is **Stage 10.5 — Hardening and documentation**, investigation and exact-scope approval only; no Stage 10.5 implementation has begun.

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
