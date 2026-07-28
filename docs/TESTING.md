# TESTING.md
Purpose: test architecture and rules of engagement. Audience: every session before coding.
Last updated: 2026-07-28. Related: tests/, CLAUDE.md, STAGE5-DESIGN.md.

## Stack
`node:test` only, zero dependencies, Node 18 or newer. Entry point: `./run-tests.sh`. It builds first because the generated production bundle is itself a test target.

The Stage 5 branch currently contains 241 tests. A passing count is not recorded here until the clean verification workflow has run against committed goldens and exact source identity.

## Suites
1. `characterisation.test.mjs` — production-bundle behaviour and reviewed goldens.
2. `sec1.test.mjs` — odds key never reaches relays.
3. `unit.test.mjs` and `resilience.test.mjs` — core model/provider/storage behaviour and fallbacks.
4. Validation and schema suites — fixture identity, payload filtering and state integration.
5. Retry and transport suites — bounded retry, endpoint scrubbing and metadata.
6. Provider Health suite — seven-state vocabulary and transitions.
7. Rendering, Markdown and security-completion suites — hostile input, secret handling and CSP.
8. `minutes-model.test.mjs` — Stage 4 denominators, histories, probabilities, shrinkage and invariants.
9. `scoring-rules.test.mjs` — Stage 5 rule configuration, Poisson groups, defensive thresholds, rare events, bonus denominator, penalty-role gating and genuine blank/double behaviour.
10. `build-bundle.test.mjs` — generated-bundle guard plus direct fixture tests for single-line and multi-line imports/exports, unterminated declarations and unsupported surviving module syntax.

## Golden discipline
Goldens are reviewed repository data, not verification output. `UPDATE_GOLDEN=1` may be used only during an explicitly reviewed stage update. The final verification workflow must run `./run-tests.sh` against committed goldens without regenerating them.

Stage 5 golden changes are limited to SCOR-1, SCOR-2 and FIX-1 consequences plus downstream totals directly caused by the approved scoring formulas. No unrelated golden churn is permitted.

## Harness
`tests/harness.mjs` stubs DOM, storage and fetch, then loads `dist/app.bundle.js`. Characterisation therefore exercises the production bundling path rather than a separate test-only implementation.

## Required checks before completion
1. Run `./run-tests.sh` with every committed test green and no golden regeneration.
2. Build twice with the same exact source commit in `BUILD_COMMIT`.
3. Compare `dist/index.html`, `dist/app.bundle.js` and `dist/manifest.json` byte-for-byte.
4. Independently recompute CSP hashes from emitted inline script/style bytes.
5. Confirm `BUILD_INFO`, manifest module order, source hash, commit identity and generated files agree.
6. Commit the verified generated artefacts.
7. Remove the temporary verification workflow before merge.
8. Confirm the final branch remains mergeable and differs from the verified source only by documented closeout changes.

## Philosophy
Never delete or weaken a test to make a change pass. A green suite proves deterministic agreement with the encoded contracts; it does not prove improved prediction accuracy. Accuracy claims require Stage 7 walk-forward holdout evidence.
