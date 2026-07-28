# TESTING.md
Purpose: test architecture and rules of engagement. Audience: every session before coding.
Last updated: 2026-07-28. Related: tests/, CLAUDE.md, STAGE7-DESIGN.md.

## Stack
`node:test` only, zero dependencies, Node 18 or newer. Entry point: `./run-tests.sh`. It builds first because the generated production bundle is itself a test target.

Stage 7 verified baseline: **274/274 passing tests**, successful production build, deterministic two-build comparison and build-identity checks passed. Verified source commit: `42d3106fcb15f2e68db7409e0ae96fd27cd4f61a`. Verified generated artefacts were committed at `d2f1e7d93cf200e5a1d6d1a2d96829e750740ff9`.

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
10. `transfer-optimiser.test.mjs` — Stage 6 legality, affordability, hit accounting, search completeness and deterministic ordering.
11. `walk-forward.test.mjs` and `archive-replay.test.mjs` — Stage 7 fold chronology, leakage rejection, train-only calibration, metrics, immutable dataset provenance, malformed rows, double Gameweeks and deadline-safe replay.
12. `build-bundle.test.mjs` — generated-bundle guard plus direct fixture tests for single-line and multi-line imports/exports, unterminated declarations and unsupported surviving module syntax.

## Golden discipline
Goldens are reviewed repository data, not verification output. `UPDATE_GOLDEN=1` may be used only during an explicitly reviewed stage update. Final verification runs against committed goldens without regenerating them.

Stage 7 changed no projection formula and required no golden regeneration.

## Harness
`tests/harness.mjs` stubs DOM, storage and fetch, then loads `dist/app.bundle.js`. Characterisation therefore exercises the production bundling path rather than a separate test-only implementation.

## Required checks before completion
1. Run `./run-tests.sh` with every committed test green and no golden regeneration.
2. Build twice with the same exact source commit in `BUILD_COMMIT`.
3. Compare `dist/index.html`, `dist/app.bundle.js` and `dist/manifest.json` byte-for-byte.
4. Independently verify CSP/build identity through the committed security tests and emitted manifest.
5. Confirm `BUILD_INFO`, manifest module order, source hash, commit identity and generated files agree.
6. Commit verified generated artefacts.
7. Remove temporary verification workflows before merge.

## Philosophy
Never delete or weaken a test to make a change pass. A green suite proves deterministic agreement with encoded contracts; it does not prove improved prediction accuracy. Stage 7 provides an honest deadline-safe archive scoring diagnostic, but missing historical provider snapshots mean it is not full validation of every live production input.
