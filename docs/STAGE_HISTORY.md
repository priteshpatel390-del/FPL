# STAGE_HISTORY.md — engineering diary
Purpose: permanent per-stage record. Audience: retrospective/context. Last updated: 2026-07-29.
Related: stage design and item records, ROADMAP.md, DECISIONS.md, CHANGELOG.md, AUDIT.md.

## Stage 10.3 — Metrics (IMPLEMENTED AND VERIFIED 2026-07-29; DRAFT PR #32)
Pritesh approved the exact Stage 10.3 decision paper before implementation. Work began from main commit `fedf8430ab79bcd40261ab2bb71bd67b0d8c4547` on `agent/stage10-3-metrics` and remained isolated from main.

The implementation adds a downstream metric evidence boundary rather than another model path. `evidence/metrics.mjs` joins only a complete officially eligible local Stage 10.1 snapshot to a complete/corrected linked Stage 10.2 outcome with exact season, Gameweek, deadline, manager reference, snapshot ID/hash and player/fixture identity. It creates immutable correction-aware `gameweekEvaluation` records and completed `transferHorizonEvaluation` records. It never imports or executes current `projectXP`, `minutesEstimate`, `simulatePlayerGameweek` or `optimiseTransfers` functions.

Player evaluation uses frozen deterministic next-Gameweek xP and Official FPL Gameweek points. Minutes/probabilities use player–fixture opportunities so doubles do not compare one per-fixture probability with a two-fixture total. Official starts remain nullable and are never inferred from minutes. Ambiguous Double Gameweek allocation fails closed while points evaluation remains available. Uncertainty evaluates the unchanged P10/P25/P75/P90 and blank/return/haul/mega-haul contracts.

Frozen squad evaluation applies reserve-goalkeeper handling, ordered outfield substitutions, minimum formation constraints and captain-to-vice fallback. All legal XIs from the same frozen 15 are enumerable; the highest realised base-points XI is explicitly labelled `Hindsight oracle`. Bench contribution and signed unused-bench points remain descriptive. Frozen optimiser plans are compared with their exact zero-transfer baseline over the stored horizon; realised net gain subtracts hits and excludes the judgement-based roll value from realised FPL points. Actual manager transfers are not inferred because Stage 10.2 does not retain their identities.

Metric records use compressed verified writes, an interrupted-write journal, current pointers and bounded superseded corrections. The More → Deadline evidence surface reports player, minutes, probability and frozen-decision results with coverage and raw-only/descriptive/potentially-stable sample warnings. Provider-state comparison requires both 100 observations and five affected Gameweeks.

Review caught and fixed several integration defects before completion: flattened-bundle helper collisions, a non-finite `Infinity` value in an immutable rule object, source-independent timestamps, null-to-zero numeric coercion, captain/vice public-field naming, missing frozen transfer outcomes and accidental renaming of approved public metric record keys. Dedicated tests now guard the public `pearson`, `spearman`, `reliabilityBins`, `errorBand`, `priceBand`, `observedRole` and `seasonPeriod` contract.

Verified source `3eaae862b8a8277e450af062ff4bcecd15b12f3f` passes **397/397 tests**, zero failures and zero skipped. Production build succeeds; two exact-identity builds are byte-identical; root `index.html` equals `dist/index.html`; generated artefacts are committed at `8c4b60a367b9858146b42ff8710d888856462c21`. Temporary verification files were removed. Draft PR #32 remains unmerged pending Pritesh's explicit approval. No production formula, threshold, provider, calibration, model update or Stage 10.4 work is included.

## Stage 10.2 — Official outcome collection (MERGED 2026-07-29)
Pritesh approved the Official FPL-only design. The implementation collects all-player live totals, filtered fixture outcomes and optional public manager facts after the app is usable; requires official `finished` plus `data_checked`; appends immutable provisional/complete/corrected revisions; links strictly to eligible deadline snapshots; and stores bounded compressed recovery with imports forced non-current. Duplicate players and conflicting fixtures fail closed.

Verified source `e84e7f1bf05ed1f3e574f78101e4a6e413273306` passes **376/376 tests** with deterministic exact-identity builds. Generated artefacts `9d81210b493ab40a542c50709733b14e448a481c`; merged through PR #29 at `4b1b2acf9bda81afb63414dd41b509e80b3945c7`. No metric/model/provider/backend/FPL-write behaviour changed.

## Stage 10.1 — Deadline-safe snapshot foundation (MERGED 2026-07-29)
The owner approved the complete Stage 10 design and sequence. Stage 10.1 added immutable anonymised pre-deadline records, official deadline timing/leakage controls, provider provenance, all-player projections/minutes/uncertainty, frozen squad/decision/optimiser context, whole-record/section hashes, bounded compressed recovery and complete JSON import/export.

The first 620-player benchmark exceeded three minutes. Review preserved 5,000 samples and removed repeated invariant fixture calculations, reducing the synthetic run to roughly 2.8–3.5 seconds. A later amendment added a silent startup gate, automatic startup/foreground verification, closed provider allowlist, one final render, non-blocking automatic capture and recovery-only imports. Pritesh accepted physical iPhone behaviour.

Verified source `eb3497ec405d6c7b8ce09105614fcb8280abc34b` passes **349/349 tests** with deterministic exact-identity builds. Generated artefacts `1259e7b5f7505d3330c772e89c77720251552287`; merged through PR #27 at `da76c81f552fd9da5c518e73ccc0fbe966c74444`. No formula or optimiser objective changed.

## Stage 9.6 — Style migration, CSP and final polish (MERGED 2026-07-29)
Removed every source/generated style attribute and runtime style API. Presentation uses utility/palette classes, native progress and SVG attributes. The DOM helper and build reject style APIs. CSP contains no `style-src-attr` or `unsafe-inline`; one inline style remains exact-hash locked. Representative mobile/desktop review had zero console errors.

Verified source `4a4b14c1d0f422088c080e714ee259efbd7cc39d`: **313/313 tests**; generated artefacts `7fb09142156a8061adc375a72bf3d7e2a1b25985`; merged through PR #25 at `c52f6f08f51bff5bfe7702bfec58265647afe439`.

## Stage 9.5 — More, Settings and Provider Health (MERGED 2026-07-29)
Reframed setup as Settings under More and added compact global Provider Health linked to full detail. Presentation reused the existing seven-state logic without a synthetic score. Verified source `da8258df25e196af1f1521c025edefde23612abd`: **310/310 tests**; merged through PR #24 at `a5ac5fcc12bb492948365851587d4e1cd2f30301`.

## Stage 9.4 — Temporary decision previews (MERGED 2026-07-29)
Added session-only transfer and captain previews while real squad, recommendations and persisted state remained authoritative. Exact plans apply to cloned squads, stale signatures invalidate previews and no FPL write/persistence exists. Verified source `849ff757c68c35e92744dc96efc34848110fa19e`: **304/304 tests**; merged through PR #23 at `5e62f2f65d6e21d86ca3f0ef8dd0b7112fd4a8c8`.

## Stage 9.3 — Player detail and uncertainty (MERGED 2026-07-28)
Added accessible mobile bottom sheet/desktop panel with expected points, expected minutes, percentile ranges and outcome probabilities. Pritesh approved Tight/Moderate/Wide presentation labels and review corrected doubtful-player wording. Verified source `40dde666fc776e0fdcf1bab6c8dad30138825d08`: **295/295 tests**; merged through PR #20 at `eb636d023bed6706f46f5a03366485ede9b15c89`.

## Stage 9.2 — Team pitch and shirts (MERGED 2026-07-28)
Added portrait pitch, repository-owned CSS shirts, captain/vice treatment and narrow-iPhone polish while preserving model-selected XI and bench order. **288/288 tests**; merged through PR #18 at `4cbbe588697845677e6aef5992e15f13f47c6281`.

## Stage 9.1 — App shell and primary navigation (MERGED 2026-07-28)
Added Team, Players, Transfers and More navigation with Team as the landing surface. Supporting tools moved under More without changing model behaviour. **284/284 tests**; merged through PR #17 at `9f4333e3f2e8d71d02355389f8c7d2115d3d17e4`.

## Stage 8 — Uncertainty and squad simulation (MERGED 2026-07-28)
Added deterministic seeded player distributions and legal squad simulation with percentiles, event probabilities, automatic substitutions and captain fallback. Detailed pre-season simulation is disabled honestly. **284/284 tests**; merged through PR #16 at `b0f6e1683b1bdb38c9cb233024a8d0bfd652caa8`.

## Stage 7 — Walk-forward backtest (MERGED 2026-07-28)
Replaced misleading live backtest presentation with chronological train/calibration/holdout folds, future-information rejection, fold-only calibration and pinned archive replay. Historical provider snapshots remain unavailable, so this is an honest scoring diagnostic rather than full validation. **274/274 tests**; merged through PR #15 at `78b42e09d2ad3b8338b587ba2b89e815cfc0c45a`.

## Stage 6 — Transfer optimiser (MERGED 2026-07-28)
Added exact 0–3 transfer search, mandatory zero-transfer baseline, squad legality, pooled affordability, free-transfer/hit rules, deterministic tie-breaking and per-Gameweek legal best-XI scoring. Verified source `5181299c8773c118220bdd8c18e80eb053eaf592`: **254/254 tests**; merged through PR #14 at `df9bb72cb2167a092acbfbe0300c3be21caea155`.

## Stage 5 — Scoring corrections (MERGED 2026-07-28)
Implemented official 2026/27 scoring values, deterministic grouped Poisson rules, defensive-contribution thresholds, empirical bonus shrinkage, rare-event expectations, penalty-role gating and genuine blank/double fixture runs. Review also hardened multi-line module stripping. **241/241 tests**; merged through PR #9 at `68877333ebf13060e764b82b91dfc0c9752a78c8`. No accuracy improvement claimed.

## Stage 4 — Expected minutes (MERGED 2026-07-28)
Replaced current-GW denominators with completed-team fixtures, detailed histories, recency weighting, shrinkage, aggregate/prior fallback and explicit pStart/pAppear/p60/expMin/confidence outputs. Official availability applies once. **220/220 tests**; merged through PR #8 at `eb08c7af43a2e8040ea65064fc725ba8d1778882`.

## Stage 3.6 — AI/Markdown sanitisation (MERGED 2026-07-28)
Replaced string-to-HTML Markdown with a bounded default-deny parser and DOM renderer. Raw HTML and unsafe links remain inert. **202/202 tests**; no model/provider/formula changes.

## Stage 3.5 — DOM-builder rendering (MERGED 2026-07-28)
Migrated approved dynamic non-AI views to text-node-first DOM primitives. Hostile provider/user strings render as text. **194/194 tests**; merged through PR #3 at `5623abb594159916b4041e6bd3c44be80f714ce7`.

## Stage 3 — Security and provider hardening (MERGED 2026-07-27)
Added provider validation, fixture identity/deduplication, bounded retry, Provider Health, direct-only odds transport, secret scrubbing, CSP and client-side Anthropic prohibition. Completed through PR #6; the verified Stage 3 baseline was **210 tests** with deterministic builds.

## Stage 2 — Module extraction and deterministic build (MERGED 2026-07-26)
Extracted vanilla ES modules, added the custom deterministic bundler, manifest/build identity, generated single-file deployment and direct module tests. No framework or npm dependency introduced.

## Stage 1 — Characterisation and audit (COMPLETED 2026-07-26)
Captured production behaviour in characterisation/golden tests, recorded security, provider, modelling and leakage findings, and established stage discipline before refactoring.

## Pre-stage era (v1.x)
Teamsheet was built iteratively from ticker and xP engine through transfers, league tools, data layers, calibration and persistence. Early lessons included availability-factor omissions, bonus over-calibration, save-on-input persistence, GitHub Pages filename sensitivity and preview-sandbox network restrictions. These discoveries motivated the audit, deterministic repository workflow and explicit evidence discipline.
