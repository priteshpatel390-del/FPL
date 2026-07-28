# CLAUDE.md — onboarding for every future development session
Read this first. GitHub `main` is the permanent source of truth; repository evidence overrides conversations and old uploads. Last updated: 2026-07-28.

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
Stage 9.2 is merged into `main` through PR #18 at `4cbbe588697845677e6aef5992e15f13f47c6281`. Checkpoint 9.3 — Player detail and uncertainty is implemented and verified on draft PR #20 from branch `agent/stage9-3-player-detail-uncertainty`. Tapping a player opens a mobile bottom sheet or desktop side panel with decision summary, expected minutes, confidence/source, P25–P75 and expanded P10–P90 ranges, outcome probabilities and the preserved projection breakdown. Owner-approved spread labels are Tight ≤2.0, Moderate >2.0–5.0 and Wide >5.0 points; labels are suppressed in pre-season and for reduced-quality inputs. Verified source `40dde666fc776e0fdcf1bab6c8dad30138825d08` passes **295/295** tests with deterministic builds; generated artefacts are committed at `ae7f7f35bd69c17686e776b97d416d4be56ae8df`. No model, provider, simulation, squad, captaincy or optimiser behaviour changed. Owner review and explicit merge approval remain required before checkpoint 9.4.

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
- `style-src-attr 'unsafe-inline'` remains an explicit Stage 9 concession until checkpoint 9.6.
- Meta `frame-ancestors` is ineffective on Pages; a hashed frame-buster compensates until serverless headers.

## Completion report for every item
Report what changed, what deliberately did not change, exact test count/result, build and reproducibility evidence, documentation updates, judgement calls, remaining limitations, branch/commit and draft PR link.
