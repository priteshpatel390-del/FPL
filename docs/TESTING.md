# TESTING.md

<!-- TRANSFERS-TRACK-A-2026-08-06 -->
> **Current Track A review — Transfers exact performance and persistence:** Owner-approved Track A is implemented on `agent/transfers-exact-performance`, stacked on draft PR #69 without changing PR #69 itself. Transfers now calculates automatically for a complete legal squad and valid assumptions, keeps one exact browser-worker calculation alive across internal navigation, restores progress/results on return, and reuses unchanged completed results. The exact search reuses prepared scores and unchanged squad cores, avoids full result construction for losing candidates and applies conservative mathematically safe bounds while retaining `exhaustiveTransferSearch()` as an independent reduced-pool oracle. Automated verification is **594 passed, 0 failed, 0 skipped** with deterministic exact-identity builds and root/deployable equality. Model remains `2.4.0`; rules remain `2026-27.3`. Physical iPhone Safari completion time, memory pressure, cancellation latency and repeated-run acceptance remain required. Do not merge PR #69 or the Track A branch without Pritesh's explicit approval.


> **FPL-T1 review verification:** The deployed owner-controlled Official FPL gateway and exact Pages configuration pass **590 passed, 0 failed, 0 skipped**. Two exact-identity production builds are byte-identical, root `index.html` equals `dist/index.html`, the manifest points to the reviewed source, CSP permits only the stable production Worker origin, model remains `2.4.0` and rules remain `2026-27.3`. Physical iPhone Safari returned live 2026/27 bootstrap JSON. Full populated application and VoiceOver acceptance remain outside automated evidence; PR #69 stays draft until explicit owner approval.
Purpose: test architecture and rules of engagement. Audience: every session before coding.
Last updated: 2026-08-05. Related: tests/, CLAUDE.md, STAGE8-DESIGN.md, STAGE10-ITEM3.md.

## Stack
`node:test` only, zero dependencies, Node 18 or newer. Entry point: `./run-tests.sh`. It builds first because the generated production bundle is itself a test target.

## Current verified baseline
FPL-T1 review verification completed **590/590 passing tests**, zero failures and zero skipped. The exact production Worker base is embedded in source and generated HTML, its origin is independently required by CSP tests, and anonymous Official FPL browser relays are absent. Worker contracts cover route/query allowlisting, methods, CORS, credential non-forwarding, JSON/schema failure, bounded cache policy, redirect rejection and redacted diagnostics. Two exact-identity production builds were byte-identical and root `index.html` matched `dist/index.html`. Physical iPhone Safari established live bootstrap transport only; populated Team, Transfers, Fixtures, Player Detail and Leagues acceptance remains pending.

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
16. `provider-health-ui.test.mjs` — Provider Health age/status palette, saved-core-data materiality, quiet healthy/optional states and Settings/full-detail wiring.
17. Stage 9.6 coverage in `team-pitch.test.mjs` and `security-completion.test.mjs` — deterministic palette classes, DOM-helper style rejection, progress/SVG wiring, CSP concession removal and source/deployable scans.
18. `build-bundle.test.mjs` — generated-bundle guard plus direct fixture tests for import/export stripping and surviving module syntax.
19. `evidence-snapshot.test.mjs` and `evidence-storage.test.mjs` — Stage 10.1 deadline boundaries, network-clock grades, provider cutoff, immutable hashes, strict approved-provider import validation, privacy, chunking, compression, bounded recovery, non-official restore, quota failures and delete/reset.
20. `startup-refresh.test.mjs` — silent startup gate, refresh-age rule, shared startup/foreground orchestration, deferred provider settlement, non-blocking automatic evidence and recovery-only UI wiring.
21. `outcome-collection.test.mjs` — Stage 10.2 endpoint validation, blank/double/postponed Gameweeks, delayed checking, corrections, squad facts, snapshot-safe records and tamper detection.
22. `outcome-storage.test.mjs` — immutable revision pointers, recovery-only imports, journal recovery, bounds, quota failure, cadence and deletion isolation.
23. `metrics.test.mjs` — exact player/minutes/probability/interval calculations; zero and signed errors; Pearson/Spearman ties and zero variance; approved error/price/season boundaries; singles, doubles and postponements; legal automatic substitutions, goalkeeper and captain fallback; authoritative joins, corrections, tamper detection, non-mutation, segmentation, frozen transfer horizons, public record-field contracts and static no-model-recomputation guards.
24. `metrics-storage.test.mjs` — verified compressed metric writes, deterministic metadata, current/superseded revision pointers, correction retention, interrupted-write journal recovery, tamper rejection, bounds, quota failure and deletion isolation from source evidence.
25. `stage10-hardening.test.mjs` — dangerous-key rejection, diagnostic redaction, strict journals/current reconciliation, transfer-version parity, line-feed spreadsheet protection, honest download requests and bounded retry/orchestration wiring.
26. `navigation-settings.test.mjs` — primary order, hash normalisation, legacy aliases, safe fallback, Settings hierarchy, Team resource relocation, Fixtures/Leagues promotion, Ask Teamsheet access, shortcut routes and removal of legacy click-to-hide navigation.
27. `team-decision-home.test.mjs` — legal-squad gating, Official/manual/cache provenance, explicit base-XI/captain forecast, risk priority, advisory deadline actions, neutral close-captaincy wording, placeholder pitch and presentation-only wiring.
28. `mini-leagues.test.mjs`, `mini-leagues-ui.test.mjs` and `mini-leagues-intelligence.test.mjs` — versioned migration, classic-league discovery, official movement/gap helpers, exact squad and selected-rival set arithmetic, ID-free routes, targeted/incremental pagination, explicit on-demand fetching, concurrency two, selection-race invalidation, stale/incomplete/unavailable wording, mobile layout, accessibility and no-strategy/model guards.
29. `settings-organisation.test.mjs` — Teamsheet 2.0.6 nested route hierarchy, nearest-parent fallback, explicit Stage 10 mount ownership, export/recovery/deletion separation, consequence-led warnings, Help/About truth, build identity, identifier-free routes, mobile Player Explorer metadata and focus-restoration contracts.
30. `fpl-gateway-worker.test.mjs`, `retry-transport.test.mjs` and `fpl-gateway-deployment.test.mjs` — fixed upstream/endpoint allowlist, exact CORS, method and query rejection, credential isolation, redirect refusal, cache boundaries, diagnostic redaction, exact production meta configuration and CSP origin pinning.

## Teamsheet 2.0.6 merged verification
The reviewed source `72bb55d484d3033a859ee51f2c3f3e7aa6bc55e6` passes **520/520 tests**, zero failures and zero skipped. New checks verify route-owned Settings destinations, explicit module hosts, warning materiality, Help/About content, identifier-free URLs and responsive Player Explorer metadata. A headless Chromium smoke check additionally exercises direct deep links, active Settings state, exact heading focus, Back restoration, dynamic module mounts, duplicate-ID absence and saved-core-data warning output. Production builds were deterministic, root `index.html` matched `dist/index.html`, and PR #65 merged at `cd1ad52ea4d13a247a82bc90f80f2db0b6f77aa4`.

This evidence does not replace physical iPhone Safari, VoiceOver or live populated-data acceptance. Those remain explicit Teamsheet 2.0.7 acceptance limitations.

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
6. Commit verified generated artefacts for implementation checkpoints; documentation-only pull requests must confirm generated files are absent from their diff.
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
Stage 10.5 adds deterministic fault-injection coverage for snapshot/outcome/metric journals, corrupt journals, duplicate-current reconciliation, compression fallback, dangerous JSON keys, version parity, diagnostic redaction, line-feed formula injection, bounded automatic retry, immediate outcome-to-metric orchestration and honest delayed-cleanup downloads. Verified source `0302c54e3eb1d77657b3d892bebb33c90438fa92` passes **428/428 tests** with byte-identical exact-identity builds and root/deployable equality.

## Teamsheet 2.0.1 navigation verification
The Teamsheet 2.0.1 baseline is **445/445 tests** with zero failures and zero skipped. Coverage verifies the exact five-destination order, URL aliases and safe fallback, browser-history wiring, `aria-current`, static link semantics, no account/key/evidence identities in routes, free transfers and bank on Team, Player Explorer under Research Tools, purpose-led Settings sections, direct evidence/provider shortcuts and Ask Teamsheet as a global/Team action rather than a sixth tab.

Automated checks cannot independently prove exact iPhone Safari rendering or thumb comfort. PR #48 is merged; its historical physical findings remain recorded, while populated-data transport is tracked separately and the complete end-to-end rehearsal remains deferred to Teamsheet 2.0.7.

## Teamsheet 2.0.1 physical-review regression coverage
The navigation suite verifies the persistent global Ask composer and internal arrow, absence of global Data/Evidence pills, controlled SVG dock icons, one fixed five-column safe-area contract, keyboard visual-viewport recovery, invisible focus presentation for programmatically focused headings, and arrow-only Settings subsection navigation. Automated checks still cannot prove physical iPhone placement or populated FPL behaviour.

## Teamsheet 2.0.2 Team decision-home verification
The final Teamsheet 2.0.2 merged baseline is **459/459 tests** with zero failures and zero skipped. Coverage verifies legal-15 gating, immediate placeholder/connected pitch structure, explicit provenance, base XI plus captain uplift arithmetic, deterministic material-risk priority, advisory/no-submission deadline wording, preview distinction, neutral ownership context, preserved routes and absence of model/optimiser/persistence calls from the presentation wrapper.

Completion also required two byte-identical builds using the exact verified source commit, root/deployable equality and the existing CSP/build-identity suites. Automated checks cannot prove physical iPhone pitch position, text scaling, VoiceOver order or thumb comfort.

## Teamsheet 2.0.4 Mini-League verification
Teamsheet 2.0.4 is merged through PR #59 at `a2841b0831193f645548cfc4155809b82a520d92`. The verified source suite is **493/493 passing tests**. Coverage includes:
- deterministic migration from `fpl:config.leagueId` and `fpl:leagues` into version-1 minimal state;
- deduplicated league records and five-rival pin cap;
- public classic-league discovery and strict displayed-field validation;
- ordinal/movement wording, nearest-above/below selection and exact squad set arithmetic;
- pre-season, provisional and checked Official FPL labels;
- semantic ID-free League landing/standings/rival/manage routes and League-active navigation;
- page 1, pages around official rank and explicit load-more contracts without rival fan-out;
- one selected public rival picks request, incomplete comparisons and stale session fallback;
- absence of legacy threat/differential thresholds, projected-rank language and protect/chase logic;
- iPhone-width wrapping/touch-target structure, route focus, live regions and reduced motion;
- deterministic bundle ordering and unchanged model/rules boundaries.

Two exact-identity production builds were byte-identical and root `index.html` matched `dist/index.html`. Automated tests do not prove real Official FPL availability, physical iPhone density or VoiceOver reading order. Physical testing of the actual repository build on an iPhone was not separately performed, VoiceOver acceptance was not performed, and live populated-data acceptance was not performed. The approved sample preview established design direction but was not equivalent to full repository-device acceptance.

## Teamsheet 2.0.5 Mini-League intelligence verification
Teamsheet 2.0.5 is complete and merged through PR #63 at `0b04dd68194207d301667a7100c3ed804ec1e056`. The verified suite is **510 passed, 0 failed, 0 skipped**. Coverage verifies:

- deterministic version-1 to version-2 Mini-League state migration;
- an explicit maximum-five selected-rival group with no automatic picks requests;
- two-request maximum concurrency and current-session reuse;
- exact set arithmetic and selected-rival owner/captain/vice/chip counts;
- aggregate denominators containing only complete, fresh 15-player squads;
- distinct not-loaded, stale, incomplete, unavailable and outside-loaded-standings behaviour;
- optional Official FPL rank, Gameweek-total, multiplier, captain, vice and chip validation;
- ID-free `#/leagues/exposure` routing, history and focus contracts;
- privacy boundaries keeping fetched standings and picks session-only;
- accessibility and narrow-screen source contracts;
- selection-key race invalidation and immediate busy-state cleanup;
- absence of projection, scoring, simulation, rank and transfer-optimiser calls.

Two production builds using the exact verified identity were byte-identical, root `index.html` equalled `dist/index.html`, model version remained `2.4.0`, and rules version remained `2026-27.3`.

Physical testing of the actual repository build on an iPhone was not performed. VoiceOver acceptance was not performed. Live populated-data acceptance was not performed. Automated source, test and build evidence cannot prove those acceptance conditions.


## Teamsheet 2.0.7 implementation verification

The approved implementation adds `final-mobile-polish.test.mjs` and updates existing presentation contracts for native controls, touch targets, restricted states, route focus/scroll, Player Detail route closure, Ask resilience, Fixture render isolation, table semantics and Transfers wording. The branch verification completed **533 passed, 0 failed, 0 skipped**, deterministic exact-identity builds and root/deployable equality for source commit `5a61ec5510c447580afa6070a5a9815516babe86`. Physical iPhone Safari, VoiceOver and live populated-data acceptance remain unperformed and must not be inferred from this automated evidence.


## Safari foreground-resume correction verification

Physical iPhone testing exposed an untested failure path: unsuccessful startup attempts did not start the automatic refresh cooldown, and foreground refreshes temporarily made the application inert. Regression coverage now verifies failed-attempt cooldown, hidden-page suppression, foreground interactivity and in-flight deduplication while preserving immediate manual refresh. Source `5a61ec5510c447580afa6070a5a9815516babe86` completed **533 passed, 0 failed, 0 skipped**, two byte-identical builds and root/deployable equality. Physical iPhone retesting remains an evidence gate.

## FPL-T1 gateway verification
Gateway tests cover exact route/query allowlisting, CORS, unsupported methods, credential/header non-forwarding, cache boundaries, generic upstream failures and invalid JSON. Client transport tests cover configured/unconfigured behaviour, bounded retries, optional 404 handling, relay exclusion for Official FPL and retained optional Understat fallback. Completion additionally requires the full suite, deterministic two-build output, root/deployable equality, exact configured CSP origin and physical live-data iPhone acceptance.

## PR #69 populated-data regression coverage
`live-preseason-regressions.test.mjs` verifies next-Gameweek public-picks derivation, no invented Gameweek, explicit unavailable/manual copy, missing-strength issue reporting, Official FPL difficulty fallback, finite neutral pre-season projections and unchanged activation of the normal strength model when all required fields are valid. Physical owner retest remains required because public pre-deadline picks availability is controlled by Official FPL.

## Truthful FDR fallback coverage
The live pre-season regression suite verifies that missing strengths force the overall lens, the displayed run value is the direct average Official FPL difficulty, lower values sort as easier, higher values sort as harder, and valid-strength mode retains the established attacker/defender model contract. The correction does not activate historical data or change normal valid-input projections.


## Transfers background performance correction
The PR #69 performance correction moves the exact transfer search into a deterministic Blob Web Worker. Transfers now paints a lightweight shell first, calculation is explicit, projection preparation yields in fixed batches, route exit/input refresh cancels obsolete work, unchanged session inputs reuse the exact completed result, and the search retains only the comparator-defined top result set. The production search formula, transfer depth, horizon, evaluation ceiling, legality, selling prices, hits, free-transfer utility and ordering remain unchanged.

### Defect found in the first implementation
The first attempt assembled the worker by rewriting the embedded model source at runtime, replacing the single string `if(plan) plans.push(plan);`. That string occurs **twice** in `src/model/transfers.mjs` — once in `exhaustiveTransferSearch()` and once in `optimiseTransfers()` — so the assembly threw before any worker was created and **Calculate transfers could never succeed in the shipped deployable**. The suite was green because no test built the worker from the real model; the only coverage fed the assembler a synthetic one-line stub.

The correction removes runtime source rewriting entirely:

- bounded top-K retention now lives in `src/model/transfers.mjs` as `retainPlan()`, used at the single retention site inside `optimiseTransfers()`;
- `exhaustiveTransferSearch()` is unchanged and remains the independent oracle;
- the worker embeds the reviewed stripped model **verbatim**, so the background search and a direct `optimiseTransfers()` call execute identical code;
- the previously duplicated synchronous `renderTransfers()` in `transfer-optimiser-view.mjs` is deleted. That module is now presentation-only and there is exactly one Transfers renderer, declared in `transfer-performance.mjs` and never reassigned at runtime.

### Retention equivalence
`comparePlans()` is a total order: its final tiebreak is the plan signature, signatures are unique per transfer set, and they contain only ASCII digits, `>` and `|`, so two distinct plans never compare equal. With a total order, retaining the best `maxResults` plans as they are produced returns exactly the same plans in exactly the same order as retaining every plan, sorting once and slicing. The zero-transfer baseline participates as an ordinary member and is evicted exactly where a full sort and slice would evict it. No comparator, ranking, eligibility, pricing, hit, free-transfer or evaluation-count semantics changed, and no accuracy improvement is claimed.

### Coverage added
`transfer-performance.test.mjs` and `transfer-performance-runtime.test.mjs` now cover:

- bounded versus exhaustive equality across 60 deterministic synthetic cases, all transfer depths 0–3, comparator-tie fixtures, and every `maxResults` from 1 to 20 including values that evict the baseline;
- worker versus direct `optimiseTransfers()` equality across 25 deterministic cases, executed from the assembled worker source;
- the same check against the **shipped** `dist/app.bundle.js` embed, so a deployable that cannot build or run its own worker fails the suite;
- fail-closed `search-incomplete` behaviour through the worker boundary;
- the progress hook proven inert — identical plans, evaluations and pruning with and without it — and throttled rather than posted per evaluation;
- route rendering that constructs no worker and records no optimiser result; explicit calculation; cancel, route exit, verified-data change and superseding calculations all terminating real workers; stale results unable to render or become `S.lastOptimiser`;
- session-cache reuse and invalidation for horizon, return limit, free transfers, bank, Gameweek, purchase price and squad identity;
- honest failure when `Worker` is unavailable, with internal reasons kept out of the interface;
- re-rendering the workspace cancelling work that belongs to the previous inputs before reading a new snapshot;
- deployable CSP granting exactly `worker-src 'self' blob:` with no remote, `data:`, wildcard, `child-src` or `unsafe-eval` concession, an unchanged hash-locked `script-src`, and a single inline script with no separately deployed asset.

`tests/harness.mjs` gains an opt-in `interactive` mode supplying a document event registry, `CustomEvent`, a hash location and a controllable `Worker`/`Blob`/`URL` trio. Default loads keep the original inert stubs, so existing suites are unaffected. The harness truncates the bundle at the `init()` boundary, so `manual-squad-runtime.mjs` route wiring remains covered by its own source-level suite rather than the bundle harness.

One existing assertion was replaced rather than removed: `transfer-optimiser-view.test.mjs` previously required that module to call `optimiseTransfers({...})` directly. That call *was* the synchronous main-thread search, so the assertion is now the stronger pair — the presentation module must not be able to enter the optimiser at all, and the worker must be the only entry point. `final-mobile-polish.test.mjs` and `settings-organisation.test.mjs` now read both Transfers modules so their wording and route-warning contracts still apply after the split.

The verified suite is **590 passed, 0 failed, 0 skipped** with two byte-identical exact-source builds and root/deployable equality. Physical iPhone calculation duration, memory pressure and cancellation latency remain an acceptance gate, and Blob-Worker acceptance under the live Pages CSP is unproven until that device test.

## 2026-08-06 — Transfers exact-search corrective evidence

The first physical iPhone Safari Test 1 reached the unchanged 2,000,000-evaluation ceiling. Expected fail-closed behaviour was observed: `search-incomplete` produced no partial recommendation.

Corrective automated coverage now includes:

- production search versus the independent exhaustive oracle;
- official-scale-shaped pools with all four positions and six Gameweeks;
- tie-heavy comparator paths;
- negative and tied projection values;
- unchanged safety-ceiling fail-closed behaviour;
- deterministic profiling and exact plan ordering.

The repository gate passes **597 tests** with zero failures or skips. A 650-candidate, six-Gameweek synthetic benchmark completed with **11,128 exact leaf evaluations**, **122 identity-bound prunes** and **117 materialised contenders**. This benchmark is not physical-device acceptance evidence.

Physical retest must verify automatic start, completion, responsive navigation, worker persistence, cancellation, cached reuse and VoiceOver status announcements.
