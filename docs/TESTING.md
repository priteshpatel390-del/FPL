# TESTING.md
Purpose: test architecture and rules of engagement. Audience: every session before coding.
Last updated: 2026-07-30. Related: tests/, CLAUDE.md, STAGE8-DESIGN.md, STAGE10-ITEM3.md.

## Stack
`node:test` only, zero dependencies, Node 18 or newer. Entry point: `./run-tests.sh`. It builds first because the generated production bundle is itself a test target.

Stage 10.3 verified source `3eaae862b8a8277e450af062ff4bcecd15b12f3f`: **397/397 passing tests**, successful production build, byte-identical two-build artefact verification, exact build identity and root/deployable equality. Generated artefacts are committed at `8c4b60a367b9858146b42ff8710d888856462c21`. The item merged through PR #32 at `2c703be2ccebc9bd0c4d782ad07b5324b1ed0997` after owner approval. The previous Stage 10.2 baseline was 376/376 at source `e84e7f1bf05ed1f3e574f78101e4a6e413273306`.

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
21. `outcome-collection.test.mjs` — Stage 10.2 endpoint validation, blank/double/postponed Gameweeks, delayed checking, corrections, squad facts, snapshot-safe records and tamper detection.
22. `outcome-storage.test.mjs` — immutable revision pointers, recovery-only imports, journal recovery, bounds, quota failure, cadence and deletion isolation.
23. `metrics.test.mjs` — exact player/minutes/probability/interval calculations; zero and signed errors; Pearson/Spearman ties and zero variance; approved error/price/season boundaries; singles, doubles and postponements; legal automatic substitutions, goalkeeper and captain fallback; authoritative joins, corrections, tamper detection, non-mutation, segmentation, frozen transfer horizons, public record-field contracts and static no-model-recomputation guards.
24. `metrics-storage.test.mjs` — verified compressed metric writes, deterministic metadata, current/superseded revision pointers, correction retention, interrupted-write journal recovery, tamper rejection, bounds, quota failure and deletion isolation from source evidence.
25. `stage10-hardening.test.mjs` — dangerous-key rejection, diagnostic redaction, strict journals/current reconciliation, transfer-version parity, line-feed spreadsheet protection, honest download requests and bounded retry/orchestration wiring.

## Golden discipline
Goldens are reviewed repository data, not verification output. `UPDATE_GOLDEN=1` may be used only during an explicitly reviewed stage update. Final verification runs against committed goldens without regenerating them.

Stages 8–10.3 change no deterministic projection formula and require no golden regeneration. Stage 10.3 adds downstream evaluation and presentation only.

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
Never delete or weaken a test to make a change pass. A green suite proves deterministic agreement with encoded contracts; it does not prove improved prediction accuracy or calibrated uncertainty. Stage 10 metrics must remain descriptive until enough genuine prospective observations exist.

## Stage 10.1 evidence tests
`evidence-snapshot.test.mjs` covers canonical JSON, SHA-256, secret rejection, every approved deadline boundary, same-origin clock evidence, client-only/conflict/late grades, provider cutoffs, immutable identity, section tampering, deadline revisions, official selection, privacy, all-player output shape, chunked collection and bundle/UI wiring.

`evidence-storage.test.mjs` covers random stable anonymous references, gzip/plain recovery encoding, three-row metadata/two-record bounds, verified reload, recovery-import segregation, quota failure surfacing and explicit delete/reset. `startup-refresh.test.mjs` covers the automatic verified-data gate and foreground trigger contracts.

## Stage 10.2 outcome verification
The Stage 10.2 baseline was **376/376 passing tests**, successful production build, byte-identical two-build comparison, exact build identity and root/deployable equality. Outcome tests cover strict player/fixture identity, blank and double Gameweeks, postponed fixtures, delayed bonus/data checking, provisional-to-complete and corrected revisions, snapshot matching boundaries, no-snapshot collection, manager availability, recovery imports, tamper detection, bounded storage, quota/interruption recovery, automatic startup/foreground checks and non-blocking access.

## Stage 10.3 metric verification
The final Stage 10.3 run completed **397/397 tests**, zero failures and zero skipped. It directly verifies:

- prediction-minus-outcome formula conventions and approved public field names;
- fixture-level minutes/probability evaluation and fail-closed ambiguous doubles;
- immutable correction revisions and exact snapshot/outcome linking;
- legal goalkeeper/outfield substitutions, captain fallback and descriptive oracle labelling;
- frozen transfer plans versus the exact zero-transfer baseline, with hits subtracted and roll value retained only as context;
- sample-warning boundaries, including provider comparisons requiring both 100 observations and five Gameweeks;
- deterministic ordering, canonical hashes, storage journals and source-record non-mutation;
- absence of production projection/minutes/simulation/optimiser calls from the metric engine;
- successful build, byte-identical exact-identity rebuild and root/deployable equality.

Verified source: `3eaae862b8a8277e450af062ff4bcecd15b12f3f`. Verified generated artefacts: `8c4b60a367b9858146b42ff8710d888856462c21`. Merge commit: `2c703be2ccebc9bd0c4d782ad07b5324b1ed0997`.
## Stage 10.4 review/export coverage
Stage 10.4 adds `operating-review.test.mjs`, `cumulative-review.test.mjs`, `review-export.test.mjs`, `review-ui.test.mjs` and shared canonical evidence fixtures. Coverage includes correction chains, current-revision selection, pruned/missing exact records, unsupported schemas, incomplete transfer horizons, null minutes, schedule changes, one-segment limits, deterministic bundle hashes/bytes, all eight CSV contracts, formula-injection cases, manager-reference boundaries, Markdown wording, class-only CSP rules and downstream-only imports.

A synthetic 38-Gameweek × 700-player case exercises 26,600 player rows and equivalent fixture-minute rows with a 10-second ceiling. Source `1eca9a8817da41597d0632c819142237d31627fb` ran `./run-tests.sh`: **413 tests passed, 0 failed, 0 skipped** in 4.58 seconds. A second build with the same `BUILD_COMMIT` was byte-identical for `dist/index.html`, `dist/app.bundle.js` and `dist/manifest.json`; root `index.html` matched the deployable exactly.

## Stage 10.5 hardening verification
Stage 10.5 adds deterministic fault-injection coverage for snapshot/outcome/metric journals, corrupt journals, duplicate-current reconciliation, compression fallback, dangerous JSON keys, version parity, diagnostic redaction, line-feed formula injection, bounded automatic retry, immediate outcome-to-metric orchestration and honest delayed-cleanup downloads. Verified source `__SOURCE_COMMIT__` passes **__TEST_COUNT__/__TEST_COUNT__ tests** with byte-identical exact-identity builds and root/deployable equality.
