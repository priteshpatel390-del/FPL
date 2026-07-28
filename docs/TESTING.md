# TESTING.md
Purpose: test architecture and rules of engagement. Audience: every session before coding.
Last updated: 2026-07-28. Related: tests/, CLAUDE.md, ACTIONS.md.

## Stack
`node:test` only, zero dependencies, Node 18 or newer. Entry point: `./run-tests.sh`. It builds first because the generated production bundle is itself a test target.

Current `main` baseline after Stage 9.1: **284/284 passing tests**, successful production build, deterministic two-build comparison and build-identity checks.

Repository-wide CI is defined permanently in `.github/workflows/repository-verification.yml`. It runs on pull requests to `main`, pushes to `main` and manual dispatch. Historical stage-named workflows were temporary verification scaffolding and remain visible only as old Actions records; see `docs/ACTIONS.md`.

## Suites
1. `characterisation.test.mjs` — production-bundle behaviour and reviewed goldens.
2. `sec1.test.mjs` — odds key never reaches relays.
3. `unit.test.mjs` and `resilience.test.mjs` — core model/provider/storage behaviour and fallbacks.
4. Validation and schema suites — fixture identity, payload filtering and state integration.
5. Retry and transport suites — bounded retry, endpoint scrubbing and metadata.
6. Provider Health suite — seven-state vocabulary and transitions.
7. Rendering, Markdown and security-completion suites — hostile input, secret handling and CSP.
8. `minutes-model.test.mjs` — Stage 4 denominators, histories, probabilities, shrinkage and invariants.
9. `scoring-rules.test.mjs` — official rule configuration, Poisson groups, defensive thresholds, rare events, bonus denominator, penalty-role gating and genuine blank/double behaviour.
10. `transfer-optimiser.test.mjs` — Stage 6 legality, affordability, hit accounting, search completeness and deterministic ordering.
11. `walk-forward.test.mjs` and `archive-replay.test.mjs` — Stage 7 fold chronology, leakage rejection, train-only calibration, metrics, immutable dataset provenance, malformed rows, double Gameweeks and deadline-safe replay.
12. `simulation.test.mjs` — Stage 8 seeded randomness, minutes-state marginals, expected-minutes convergence, bounded inconsistent inputs, percentile ordering and probability thresholds.
13. `squad-simulation.test.mjs` — Stage 8 legal formations, goalkeeper substitution, ordered outfield substitutions and captain/vice fallback.
14. `build-bundle.test.mjs` — generated-bundle guard plus direct fixture tests for import/export stripping and surviving module syntax.
15. Stage 9 UI suites — app-shell navigation, pitch formation grouping, captain/vice identity and deterministic repository-owned shirt palettes.

## Golden discipline
Goldens are reviewed repository data, not verification output. `UPDATE_GOLDEN=1` may be used only during an explicitly reviewed stage update. Final verification runs against committed goldens without regenerating them.

UI-only Stage 9 checkpoints do not alter deterministic projection formulas and require no golden regeneration unless a separately approved user-visible characterisation contract genuinely changes.

## Harness
`tests/harness.mjs` stubs DOM, storage and fetch, then loads `dist/app.bundle.js`. Characterisation therefore exercises the production bundling path rather than a separate test-only implementation.

## Required checks before completion
1. Run `./run-tests.sh` with every committed test green and no golden regeneration.
2. Build twice with the same exact source commit in `BUILD_COMMIT`.
3. Compare `dist/index.html`, `dist/app.bundle.js` and `dist/manifest.json` byte-for-byte.
4. Independently verify CSP/build identity through the committed security tests and emitted manifest.
5. Confirm `BUILD_INFO`, manifest module order, source hash, commit identity and generated files agree.
6. Commit verified generated artefacts.
7. Confirm the permanent Repository verification workflow is green for the pull request.
8. Do not add another stage-specific workflow unless the permanent workflow genuinely cannot exercise an approved check; any exception must be documented and removed before merge.

## CI failure behaviour
The test step uses Bash `pipefail` while writing a downloadable log. A failed test therefore fails the original step rather than being hidden by `continue-on-error` or a later synthetic failure step. Deterministic build, identity and CSP checks run only after the complete suite succeeds.

The permanent workflow checks out the exact pull-request head SHA and uses that value as `BUILD_COMMIT`. Successful builds are uploaded for short-lived review convenience, but the workflow does not write to the repository or commit generated files.

## Philosophy
Never delete or weaken a test to make a change pass. A green suite proves deterministic agreement with encoded contracts; it does not prove improved prediction accuracy or calibrated uncertainty. Stage 8 probability coverage must be evaluated prospectively during 2026/27 before any calibration claim.
