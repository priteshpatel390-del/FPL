# CLAUDE.md — onboarding for every future Claude session
Purpose: read this FIRST, in full. The GitHub repository — not any conversation — is the project's
source of truth. Last updated: 2026-07-27.

## Who you're working with
Pritesh: the owner, working from an iPhone, non-developer but a rigorous reviewer who independently
runs the test suite and returns structured stage approvals with adjustments. He has asked for blunt
honesty: if something is a bad idea, say so plainly; never claim accuracy or success you cannot
evidence.

## Read in this order
1. docs/PROJECT_CONTEXT.md — what/why/status
2. docs/ARCHITECTURE.md — how it's built
3. docs/DECISIONS.md — settled questions (do not relitigate silently)
4. docs/ROADMAP.md — where we are; what's next; blockers
5. docs/KNOWN_LIMITATIONS.md — before promising anything
6. The current stage's design doc (today: docs/STAGE3-DESIGN.md; item 4 record: docs/STAGE3-ITEM4.md)
7. Before ANY model work: docs/PROJECTION_MODEL.md + docs/TESTING.md
8. Before provider/security work: docs/DATA_SOURCES.md + docs/SECURITY.md
9. History when needed: docs/STAGE_HISTORY.md, docs/CHANGELOG.md, docs/AUDIT.md, docs/STAGE1/2.md

## Current checkpoint
Stage 3 items 1–3 are merged. Item 4 Provider Health is implemented in draft PR #2 with 189 tests
and deterministic builds verified; it still requires owner review and explicit approval before merge.
The next planned item after approval is rendering safety (DOM builders + AI-output sanitisation).

## Non-negotiable rules
- Never modify projection logic without tests, and never change a formula without first presenting:
  existing formula → proposed formula → inputs → fallback → assumptions → limitations → validating
  tests — and receiving owner approval.
- Never remove existing tests. Retitle/re-home only with stated justification. The golden
  `expectedToChange` section moves only as part of the stage that fixes its issue id.
- Never claim improved prediction accuracy without out-of-sample validation (DECISIONS D-11). The
  published r=0.80 is in-sample-flattered; do not quote it as validated.
- Keep every stage independently deployable; run `./run-tests.sh` (build + 189 tests) green before
  presenting anything.
- Maintain deterministic builds (same sources → same bytes; BUILD_COMMIT stamps identity).
- Preserve mobile-first design and the owner's one-file deploy workflow (upload dist/index.html).
- Secrets: Anthropic keys NEVER client-side (D-08). Odds key: never logged, never in errors,
  never relayed (SEC-1 — regression-tested).
- Understat stays team-level (D-05). No new data sources without the ablation bar (AUDIT §7).
- Stage discipline: design → owner approval → implement → tests → docs updated → deployable +
  repo zip → stage record appended. An owner architecture-review gate sits after Stage 3.

## Practical environment notes
- Zero-dependency toolchain: node:test, custom bundler; assume NO npm registry and NO sandbox
  network. Historical data downloads happen in the USER'S browser (the app), not your sandbox.
- Tests: `./run-tests.sh`. Characterisation runs against dist/app.bundle.js via tests/harness.mjs.
- Bundler contract: unique top-level names, no default exports, single-line imports.
- The owner deploys by uploading dist/index.html via GitHub mobile web; give him exact tap-by-tap
  steps when a deploy is needed. The full repository is now committed; retain the one-file deploy workflow.

## Ending every stage
Update: ROADMAP (status), CHANGELOG, KNOWN_LIMITATIONS (close/open ids), STAGE_HISTORY (diary
entry), any doc whose facts changed, and the stage's own record. Then produce: deployable
dist/index.html + full repo zip + a short review summary with any judgement calls flagged.
