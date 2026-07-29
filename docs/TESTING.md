# TESTING.md
Purpose: test architecture and rules of engagement. Audience: every session before coding.
Last updated: 2026-07-29. Related: tests/, CLAUDE.md, STAGE8-DESIGN.md.

## Stack
`node:test` only, zero dependencies, Node 18 or newer. Entry point: `./run-tests.sh`. It builds first because the generated production bundle is itself a test target.

Stage 10.1 verified source `eb3497ec405d6c7b8ce09105614fcb8280abc34b`: **349/349 passing tests**, successful production build, byte-identical two-build artefact verification and exact build identity. Physical iPhone acceptance remains pending on draft PR #27. The merged Stage 9 baseline remains 313/313 at source `4a4b14c1d0f422088c080e714ee259efbd7cc39d`.

## Suites
1. `characterisation.test.mjs` — production-bundle behaviour and reviewed goldens.
2. `sec1.test.mjs` — odds key never reaches relays.
3. `unit.test.mjs` and `resilience.test.mjs` — core model/provider/storage behaviour and fallbacks.
4. Validation and schema suites — fixture identity, payload filtering and state integration.
5. Retry and transport suites — bounded retry, endpoint scrubbing and metadata.
6. Provider Health suite — seven-state vocabulary and transitions.
7. Rendering, Markdown and security-completion suites — hostile input, secret handling, class-only style boundaries, generated-deployable scans and CSP.
8. `minutes-model.test.mjs` — Stage 4 denominators, histories, probabilities, shrinkage and invariants.
9. `scoring-rules.test.mjs` — official rule configuration, Poisson groups, defensive thresholds, rare events, bonus denominator, penalty-role gating and genuine blank/double behaviour.
10. `transfer-optimiser.test.mjs` — Stage 6 legality, affordability, hit accounting, search completeness and deterministic ordering.
11. `walk-forward.test.mjs` and `archive-replay.test.mjs` — Stage 7 fold chronology, leakage rejection, train-only calibration, metrics, immutable dataset provenance, malformed rows, double Gameweeks and deadline-safe replay.
12. `simulation.test.mjs` — Stage 8 seeded randomness, minutes-state marginals, expected-minutes convergence, bounded inconsistent inputs, percentile ordering and probability thresholds.
13. `squad-simulation.test.mjs` — Stage 8 legal formations, goalkeeper substitution, ordered outfield substitutions and captain/vice fallback.
14. `player-detail.test.mjs` — Stage 9.3 spread thresholds, quality suppression, range geometry, official availability labels, dialog accessibility/focus and surface wiring.
15. `decision-preview.test.mjs` — Stage 9.4 transfer-copy non-mutation, optimiser-final-squad agreement, captain/vice rules, stale-state invalidation, deterministic signatures, score separation and no-persistence wiring.
16. `provider-health-ui.test.mjs` — Stage 9.5 compact age/status modelling, deterministic highest-attention state, status palette mapping and Settings/full-detail wiring.
17. Stage 9.6 coverage in `team-pitch.test.mjs` and `security-completion.test.mjs` — deterministic palette classes, DOM-helper style rejection, progress/SVG wiring, CSP concession removal and source/deployable scans.
18. `build-bundle.test.mjs` — generated-bundle guard plus direct fixture tests for import/export stripping and surviving module syntax.
19. `evidence-snapshot.test.mjs` and `evidence-storage.test.mjs` — Stage 10.1 deadline boundaries, network-clock grades, provider cutoff, immutable hashes, strict approved-provider import validation, privacy, chunking, compression, bounded recovery, non-official restore, quota failures and delete/reset.
20. `startup-refresh.test.mjs` — silent startup gate, refresh-age rule, shared startup/foreground orchestration, deferred provider settlement, non-blocking automatic evidence and recovery-only UI wiring.

## Golden discipline
Goldens are reviewed repository data, not verification output. `UPDATE_GOLDEN=1` may be used only during an explicitly reviewed stage update. Final verification runs against committed goldens without regenerating them.

Stages 8–9.6 change no deterministic projection formula and require no golden regeneration.

## Harness
`tests/harness.mjs` stubs DOM, storage and fetch, then loads `dist/app.bundle.js`. Characterisation therefore exercises the production bundling path rather than a separate test-only implementation.

## Required checks before completion
1. Run `./run-tests.sh` with every committed test green and no golden regeneration.
2. Build twice with the same exact source commit in `BUILD_COMMIT`.
3. Compare `dist/index.html`, `dist/app.bundle.js` and `dist/manifest.json` byte-for-byte, then verify the generated root `index.html` deployment copy is identical to `dist/index.html`.
4. Independently verify CSP/build identity through the committed security tests and emitted manifest.
5. Confirm `BUILD_INFO`, manifest module order, source hash, commit identity and generated files agree.
6. Commit verified generated artefacts.
7. Remove temporary verification workflows before merge.

## Philosophy
Never delete or weaken a test to make a change pass. A green suite proves deterministic agreement with encoded contracts; it does not prove improved prediction accuracy or calibrated uncertainty. Stage 8 probability coverage must be evaluated prospectively during 2026/27 before any calibration claim.

## Stage 10.1 evidence tests
`evidence-snapshot.test.mjs` covers canonical JSON, SHA-256, secret rejection, every approved deadline boundary, same-origin clock evidence, client-only/conflict/late grades, provider cutoffs, immutable identity, section tampering, deadline revisions, official selection, privacy, all-player output shape, chunked collection and bundle/UI wiring.

`evidence-storage.test.mjs` covers random stable anonymous references, gzip/plain recovery encoding, three-row metadata/two-record bounds, verified reload, recovery-import segregation, quota failure surfacing and explicit delete/reset. `startup-refresh.test.mjs` covers the automatic verified-data gate and foreground trigger contracts. Existing simulation, scoring and golden tests guard the performance refactor against model-output changes. Final verification requires `./run-tests.sh`, two byte-identical builds with the exact source commit and manifest/build identity checks.
