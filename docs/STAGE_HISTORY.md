# STAGE_HISTORY.md — engineering diary
Purpose: permanent per-stage record. Audience: retrospective/context. Last updated: 2026-07-30.
Related: stage design and item records, ROADMAP.md, DECISIONS.md, CHANGELOG.md, AUDIT.md.

## Stage 10.4 — Operating review/export (MERGED 2026-07-30)
Pritesh approved the exact downstream operating-review/export scope before implementation. The item adds weekly and cumulative review over immutable Stage 10.1–10.3 evidence, deterministic hash-verifiable JSON and Markdown, and eight individual RFC 4180 CSV exports. It does not change production projection, expected-minutes, scoring, fixture, uncertainty, squad, captaincy, transfer-optimiser or provider behaviour. Google Sheets remains manual import only.

Verified source `1eca9a8817da41597d0632c819142237d31627fb` passes **413/413 tests**, zero failures and zero skipped, with byte-identical exact-identity builds. Generated artefacts are `1af7dac5383c91e915587218e7551c2f619cec8f`. PR #35 merged at `6a96096cfa59fd3476aa89c191cc8ca6400d358b` after explicit owner approval. Physical iPhone acceptance was not independently recorded; prospective validation remains in progress.

## Stage 10.3 — Metrics (MERGED 2026-07-30)
Pritesh approved the exact Stage 10.3 decision paper before implementation. Work began from main commit `fedf8430ab79bcd40261ab2bb71bd67b0d8c4547` on `agent/stage10-3-metrics` and remained isolated from main.

The implementation adds a downstream metric evidence boundary rather than another model path. `evidence/metrics.mjs` joins only a complete officially eligible local Stage 10.1 snapshot to a complete/corrected linked Stage 10.2 outcome with exact season, Gameweek, deadline, manager reference, snapshot ID/hash and player/fixture identity. It creates immutable correction-aware `gameweekEvaluation` records and completed `transferHorizonEvaluation` records. It never imports or executes current `projectXP`, `minutesEstimate`, `simulatePlayerGameweek` or `optimiseTransfers` functions.

Player evaluation uses frozen deterministic next-Gameweek xP and Official FPL Gameweek points. Minutes/probabilities use player–fixture opportunities so doubles do not compare one per-fixture probability with a two-fixture total. Official starts remain nullable and are never inferred from minutes. Ambiguous Double Gameweek allocation fails closed while points evaluation remains available. Uncertainty evaluates the unchanged P10/P25/P75/P90 and blank/return/haul/mega-haul contracts.

Frozen squad evaluation applies reserve-goalkeeper handling, ordered outfield substitutions, minimum formation constraints and captain-to-vice fallback. All legal XIs from the same frozen 15 are enumerable; the highest realised base-points XI is explicitly labelled `Hindsight oracle`. Bench contribution and signed unused-bench points remain descriptive. Frozen optimiser plans are compared with their exact zero-transfer baseline over the stored horizon; realised net gain subtracts hits and excludes the judgement-based roll value from realised FPL points. Actual manager transfers are not inferred because Stage 10.2 does not retain their identities.

Metric records use compressed verified writes, an interrupted-write journal, current pointers and bounded superseded corrections. The More → Deadline evidence surface reports player, minutes, probability and frozen-decision results with coverage and raw-only/descriptive/potentially-stable sample warnings. Provider-state comparison requires both 100 observations and five affected Gameweeks.

Review caught and fixed several integration defects before completion: flattened-bundle helper collisions, a non-finite `Infinity` value in an immutable rule object, source-independent timestamps, null-to-zero numeric coercion, captain/vice public-field naming, missing frozen transfer outcomes and accidental renaming of approved public metric record keys. Dedicated tests now guard the public `pearson`, `spearman`, `reliabilityBins`, `errorBand`, `priceBand`, `observedRole` and `seasonPeriod` contract.

Verified source `3eaae862b8a8277e450af062ff4bcecd15b12f3f` passes **397/397 tests**, zero failures and zero skipped. Production build succeeds; two exact-identity builds are byte-identical; root `index.html` equals `dist/index.html`; generated artefacts are committed at `8c4b60a367b9858146b42ff8710d888856462c21`. Temporary verification files were removed. The implementation merged through PR #32 at `2c703be2ccebc9bd0c4d782ad07b5324b1ed0997` after owner approval. No production formula, threshold, provider, calibration, model update or Stage 10.4 work is included.

## Stage 10.2 — Official outcome collection (MERGED 2026-07-29)
Pritesh approved the Official FPL-only design. The implementation collects all-player live totals, filtered fixture outcomes and optional public manager facts after the app is usable; requires official `finished` plus `data_checked`; appends immutable provisional/complete/corrected revisions; links strictly to eligible deadline snapshots; and stores bounded compressed recovery with imports forced non-current. Duplicate players and conflicting fixtures fail closed.

Verified source `e84e7f1bf05ed1f3e574f78101e4a6e413273306` passes **376/376 tests** with deterministic exact-identity builds. Generated artefacts `9d81210b493ab40a542c50709733b14e448a481c`; merged through PR #29 at `4b1b2acf9bda81afb63414dd41b509e80b3945c7`. No metric/model/provider/backend/FPL-write behaviour changed.

## Stage 10.1 — Deadline-safe snapshot foundation (MERGED 2026-07-29)
The owner approved the complete Stage 10 design and sequence. Stage 10.1 added immutable anonymised pre-deadline records, official deadline timing/leakage controls, provider provenance, all-player projections/minutes/uncertainty, frozen squad/decision/optimiser context, whole-record/section hashes, bounded compressed recovery and complete JSON import/export.

The first 620-player benchmark exceeded three minutes. Review preserved 5,000 samples and removed repeated invariant fixture calculations, reducing the synthetic run to roughly 2.8–3.5 seconds. A later amendment added a silent startup gate, automatic startup/foreground verification, closed provider allowlist, one final render, non-blocking automatic capture and recovery-only imports. Pritesh accepted physical iPhone behaviour.

Verified source `eb3497ec405d6c7b8ce09105614fcb8280abc34b` passes **349/349 tests** with deterministic exact-identity builds. Generated artefacts `1259e7b5f7505d3330c772e89c77720251552287`; merged through PR #27 at `da76c81f552fd9da5c518e73ccc0fbe966c74444`. No formula or optimiser objective changed.