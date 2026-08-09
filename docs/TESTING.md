# TESTING.md


## 9 August 2026 physical UI correction

The first PR #103 candidate (`0e3a0674416aa069a0f06ebee87854df41907ed0` source, `b53c8026a5485936582da1ea2374f9bad799e44d` generated) passed 798 automated tests and permanent Verify Teamsheet run `31338489146`, but **failed physical iPhone Safari acceptance**: the light startup strip remained and the five primary-route header boxes still presented inconsistent structure/rhythm. The corrected review source is `aec0c4f55ac051fd5016d7e93a70415de2dbc308` with generated-only child `a7bea9e1a96fda958239099a3ec64aef8cc30874`. It adds two regressions, retains all 798 prior tests and passes **800 tests** before publication. The correction gives Safari an explicit opaque dark startup background colour beneath the gradient and gives Team, Transfers, Fixtures, Leagues and Settings one shared `primary-page-header` box/title/intro contract while preserving the Leagues Manage action. Physical iPhone Safari retest remains required; merge is not approved.


## 9 August 2026 current verification state

Current GitHub `main` at the start of this checkpoint is `d5f2572ee4d95c3c242ecbc97ee46802a6f0273d`, merge of Atomic Foreground Refresh PR #102. PR #102 is merged and verified at **792 passed, 0 failed, 0 skipped**, with deterministic/generated provenance, independent re-review and physical iPhone Safari acceptance. The current approved implementation candidate is **Small Mobile UI Consistency + Loading Viewport Fix**. Its reviewed source is `0e3a0674416aa069a0f06ebee87854df41907ed0` and generated-only child is `b53c8026a5485936582da1ea2374f9bad799e44d`. Six focused regressions raise the candidate suite to **798 tests**; the publication gate passed the complete suite, deterministic double build, root/deployable equality and reachable generated provenance. Physical iPhone Safari acceptance of this UI candidate remains required before merge. This current-state block supersedes older 9 August wording below where it describes PR #102 as unmerged or cites the 691/693-test application baseline. Permanent PR verification must still pass on the final documented head; automated evidence cannot prove Safari chrome/safe-area rendering.

## D1 design closeout and future verification

[Data Architecture D1](DATA-ARCHITECTURE-D1.md) is documentation-only and does not add a runtime test claim. Its later implementation gates require schema/migration checks, idempotent duplicate and revision tests, season mismatch rejection, D1/R2 partial-failure and orphan reconciliation, authentication/CORS/CSRF/rate/secret tests, outage tests proving recommendations remain usable, backup/restore, full deterministic verification and physical iPhone acceptance for saved/pending/failed/offline/export states. Existing live-season evidence gates remain unchanged.

<!-- FIXTURES-ACCEPTANCE-2026-08-07 -->
> **Historical Fixtures acceptance verification:** PR #86 exact head `be90b4f25b90472a3f30b3b765e56d23d8d95862` passed **660 tests, 660 passed, 0 failed, 0 skipped, 0 cancelled** in permanent Verify Teamsheet run `31198545580`, with deterministic byte-identical double builds, root/deployable equality and exact manifest identity. The merged tree was deployed at `e49599a75bbb77618292fdb6100fcffd81685c44`; owner iPhone Safari acceptance passed for GW23 reachability, sticky TEAM behaviour beyond GW12 and GW38 boundary normalisation. No model formula, provider, source or golden expectation changed.

<!-- FIXTURES-MOBILE-SCROLL-TESTING-2026-08-07 -->
> **Historical PR #85 verification — accepted:** four focused regressions cover truthful fallback-aware copy, a non-scrolling mode explanation, a shared sticky TEAM header/body column and removal of the left scrolling gutter. PR #85 reached **656 passed, 0 failed, 0 skipped, 0 cancelled** and its deployed mobile path was physically confirmed during the subsequent Fixtures acceptance sequence.

<!-- TEAM-ACCEPTANCE-2026-08-07 -->
> **Historical Team populated-acceptance checkpoint:** PRs #80–#83 merged through `385e5102c0e86e4b926503bffceba08bd6d831c3`. Exact PR #83 head `990a85eb69319064038be458081d029d8a3b8828` passed **652 tests, 0 failed, 0 skipped, 0 cancelled**, deterministic byte-identical double-build verification, root/deployable equality and exact manifest build identity. Pritesh physically accepted startup ownership, availability, reserve-goalkeeper display, outfield bench order and narrow unavailable-label presentation on iPhone Safari. Fixtures and the Leagues pre-season path were accepted later. No calculation, provider, data-source or security behaviour changed.

<!-- T02-BENCH-GK-AVAILABILITY-FOLLOW-UP-2026-08-07 -->
> **Historical T-02 bench/availability follow-up state — superseded by the Team merge record:** physical iPhone evidence after PR #81 exposed a visual bench-role mismatch and incomplete availability centring. The approved review branch changes display ordering only: reserve GK first, then the pre-existing outfield bench order; `bestXI().bench` remains unchanged. Availability becomes its own centred intrinsic-width row. Verification is **651 passed, 0 failed, 0 skipped, 0 cancelled** before deterministic production-build verification. Final physical iPhone acceptance subsequently passed after PR #83 deployment; see the current Team acceptance record above.


<!-- PR80-REPOSITORY-VERIFICATION-2026-08-07 -->
> **Repository PR verification - introduced with Team UX PR #80:** The verify.yml workflow runs the existing completion gate automatically for pull requests and supports manual workflow dispatch. It checks out the exact PR revision, runs the complete test suite, performs two production builds with that revision as build identity, compares generated outputs byte-for-byte, verifies root/deployable equality and manifest identity, and retains verified production outputs as a short-lived review artifact. It has read-only repository permission, performs no deployment and adds no project dependency. Corrected T-01/T-02 source reached **649 passed, 0 failed, 0 skipped, 0 cancelled** with deterministic builds. A 390x844 first-paint mobile rendering with script execution disabled showed only the startup gate; header, main and the fixed dock were hidden. **Physical iPhone Safari T-01 acceptance subsequently passed on 7 August 2026** against the corrected PR #80 preview: the startup experience owned the viewport and no bottom navigation dock was visible during loading. T-02 could not be physically exercised on the owner's current squad because no player was flagged; that visual check is unperformed rather than claimed, while its starting/bench availability and accessibility wording remain covered by focused automated regressions.

<!-- UX-A2-DOCK-LAYERING-TESTING-2026-08-07 -->
> **Historical merged baseline — PR #78 dock-layering correction:** the focused regression first failed against the pre-correction merged ordering, then passed after the narrow CSS correction. The complete suite is **645 passed, 0 failed, 0 skipped, 0 cancelled**. Two builds using exact source `44154da4190d35b6d6b747f537c19a060892bc14` are byte-identical for all generated outputs, and root `index.html` equals `dist/index.html`. Populated physical iPhone Safari acceptance passed on 7 August 2026. PR #78 merged at `ebb8838e7bfd081371a0639c9b4bdacfc9b92bc6`; GitHub Pages deployment succeeded and the Cloudflare Workers production build succeeded for `teamsheet-fpl-gateway`. `UI-14` is closed.


<!-- UX-A2-2026-08-06 -->
> **UX-A2 Player Detail Scroll and Rotation Correction — merged verification:** UX-A2 merged through PR #76 to `main` at `bffcba8e9231adfc216125913f8ab83c042c3e10`; the branch adds twenty focused behaviour and CSS-contract tests in one new file without deleting, weakening or skipping any existing test and without changing a golden/model expectation. The complete baseline moves from **624** to **644 passed, 0 failed, 0 skipped**. Two production builds using the exact reviewed source commit are byte-identical for `dist/index.html`, `dist/app.bundle.js` and `dist/manifest.json`; root `index.html` equals `dist/index.html`. Automated evidence covers exact background-offset capture and restoration, root plus body locking, internal scroll reset, `preventScroll` focus on open and on close, close-button/backdrop/Escape parity, player replacement while open, route-driven close without stale scroll or focus restoration, detached and hidden trigger rejection, viewport-property fallback, flex-scroll constraints, `vh`-before-`dvh` ordering, compact-landscape sizing, four-sided safe areas, the dialog-not-a-route boundary, the root text-size-adjustment contract that stops Safari inflating text on rotation, and the no-inline-style and no-data-reach guards. **Physical populated iPhone Safari acceptance passed on 6 August 2026** and is recorded in `UX-A2-ACCEPTANCE.md`; the rotation text-inflation defect it exposed was corrected and physically retested successfully. The device script below is retained as the reusable procedure, not as an outstanding gate. VoiceOver is not a Teamsheet acceptance gate.


<!-- UX-A1-2026-08-06 -->
> **Historical status superseded — UX-A1 Team Resources and Bench Clarity:** the original review branch added eleven focused presentation contracts without changing a golden/model expectation and reached **624 passed, 0 failed, 0 skipped** with deterministic builds and root/deployable equality. Populated physical iPhone Safari acceptance subsequently passed on 6 August 2026 and PR #74 merged. Earlier wording describing device acceptance as pending is superseded by `UX-A1-MERGE-RECORD.md`. VoiceOver is not a Teamsheet acceptance gate.


<!-- TRANSFERS-TRACK-A-2026-08-06 -->
> **Historical Track A review state — superseded by the merged checkpoint:** the first populated iPhone Safari exact-search attempt exposed the evaluation ceiling and a later retest exposed the separately returned zero-transfer baseline presentation defect. Those issues were corrected without changing the approved football problem, comparator, candidate universe, horizon or evaluation ceiling. The final accepted Track A checkpoint is merged through PRs #69, #70 and #72 with **613 passed, 0 failed, 0 skipped**, deterministic builds and populated iPhone Safari acceptance for the tested calculation, lifecycle, stale-result and **No hit** paths. VoiceOver is not a project acceptance gate. That Track A checkpoint and the later PR #78 baseline are historical; the current repository baseline is recorded below.


> **Historical FPL-T1 review verification:** the owner-controlled Official FPL gateway review reached **590 passed, 0 failed, 0 skipped** with deterministic builds, exact Worker/CSP configuration and successful physical iPhone live bootstrap transport. FPL-T1 subsequently merged through PR #69 and Track A through PRs #70 and #72. This historical 590-test checkpoint is not the current repository baseline.
Purpose: test architecture and rules of engagement. Audience: every session before coding.
Last reconciled: 2026-08-09. Related: tests/, CLAUDE.md, STAGE8-DESIGN.md, STAGE10-ITEM3.md.

## Stack
`node:test` only, zero dependencies, Node 18 or newer. Entry point: `./run-tests.sh`. It builds first because the generated production bundle is itself a test target.

## Current verified baseline

The latest merged repository and application checkpoint is DTR-1 PR #99 at `09e595c275b4f3614c09fb502291de6831813999`. The iPhone form-focus zoom correction is the current unmerged presentation candidate.

- exact reviewed PR #99 source: `a15443f3de889561fd301c4aa1792d19f7b21c83`
- exact PR #99 generated head: `b45f89baf45e12de09cdb1ad34826756e9e5378b`
- permanent Verify Teamsheet run: `31301475598`, completed successfully
- merged complete suite: **691 tests, 691 passed, 0 failed, 0 skipped, 0 cancelled**
- DTR-1 production builds: byte-identical; root equals deployable; exact module-source and complete build-input identity; committed deployables reproduced from reachable source before the test build
- form-focus candidate: **693 tests, 693 passed, 0 failed, 0 skipped, 0 cancelled** locally
- `iphone-form-focus-zoom.test.mjs` adds two source contracts; no existing test or golden expectation is removed, weakened, regenerated or skipped
- model, calculation, provider identity/endpoint and data-source behaviour: unchanged

PR #94 was documentation/test-infrastructure only and preserved the then-current PR #92 application baseline. Its three documentation-integrity tests raised the repository suite from 664 to 667 without creating a new application-behaviour claim.

Transfers, Player Detail, Team and Fixtures have populated iPhone acceptance evidence for their tested paths. Leagues has pre-season physical acceptance; post-Gameweek populated checks are deliberately deferred. VoiceOver is not a Teamsheet acceptance gate.

The form-focus candidate changes editable-control typography across Team setup/resources, Fixtures, Transfers, player search, Leagues and Ask. Automated contracts cannot prove Safari's native focus scale, keyboard close or viewport recovery; the exact PR build therefore requires the focused device script below before merge.

### DTR-1 direct-renderer merged evidence

- `team-direct-renderer-runtime.test.mjs` runs the production bundle and verifies final ready/placeholder order, no legacy Team summary, 15 direct player actions, GK/1st/2nd/3rd display roles, captain selection/reset, valid and invalid transfer previews, incoming/clear behaviour, bench and all-15 Player Detail horizons, stable module ownership and removal of runtime renderer replacement.
- `rendering-security.test.mjs` now reaches the shipped direct renderer because `team-decision-home.mjs` is bundled before the `views.mjs` async-initialiser harness boundary.
- the Team resource, availability, preview, manual-runtime and architecture suites now assert final behaviour and direct ownership instead of requiring the removed post-render DOM surgery.
- the complete result is 691/691. Permanent CI, exact source/generated provenance and physical iPhone acceptance passed before PR #99 merged at `09e595c275b4f3614c09fb502291de6831813999`.

### iPhone form-focus zoom candidate

- `iphone-form-focus-zoom.test.mjs` requires the complete current text-entry control inventory—text, number, search, password, select and textarea—to render at a minimum 16px.
- the viewport must retain normal browser magnification: `maximum-scale` and `user-scalable=no` remain forbidden.
- checkbox, file and range controls remain outside the text-entry typography selector.
- the change adds no JavaScript, state, persistence, calculation, provider, route or account-write behaviour.
- focused automated coverage can establish the CSS contract only. Physical iPhone Safari testing must focus a numeric resource field, close the keyboard without pinching and confirm the page remains at normal scale and still saves the value.

### Repository Truth A1 merged evidence

- Exact remote PR #94 head `1a8af48c96a4aa5ed9d856061be7e95e98f1b3d4` passed **667 tests, 667 passed, 0 failed, 0 skipped, 0 cancelled** in permanent Verify Teamsheet run `31255585665`.
- The unchanged 664 application tests plus three documentation-integrity tests make up that total.
- Two exact-head production builds were byte-identical for `dist/app.bundle.js`, `dist/index.html`, `dist/manifest.json` and root `index.html`.
- Root `index.html` equalled `dist/index.html`, manifest identity matched the exact PR head and the verified tree merged unchanged at `cdc3cb709d97b858f29234678e7860baab918b78`.
- A1 changed no application behaviour or tracked generated deployable.

### Safe Hygiene A2 merged evidence

- Focused review/export, provider, transport, fixture, Odds, storage, build and documentation-integrity coverage passed **143/143**.
- Exact source commit `ed4517900caaf26d711bccf66bbe3459e574fd5b` passed **667 tests, 667 passed, 0 failed, 0 skipped, 0 cancelled** without removing, weakening or skipping a test or changing a golden expectation.
- Two production builds stamped with that exact source commit were byte-identical for `dist/app.bundle.js`, `dist/index.html`, `dist/manifest.json` and root `index.html`.
- Root `index.html` equalled `dist/index.html`; manifest identity matched the exact source commit; generated source hash was `9581b55c94eba9fc2948d56651e581ebc064fae5163d834a15329e8c8f1b9d77`.
- Connector-created PR #95 head `c1ebd7610b9a81f893457b8bb1bb41316de80dc0` preserved the verified tree exactly and passed permanent Verify Teamsheet run `31256999867`.
- PR #95 merged at `2eee62b77291af06552e3d1952b6e1a6355ca7e0`. Physical iPhone testing was unnecessary because no rendered or interactive behaviour changed.

### Refresh-Load R1 merged evidence

- The 667 prior tests remain unchanged and all pass. Twelve tests in `refresh-load-r1.test.mjs` plus two iPhone-found offline-disclosure regressions in `startup-refresh.test.mjs` raise the corrected candidate suite to **681 tests, 681 passed, 0 failed, 0 skipped, 0 cancelled**.
- New coverage proves active-squad-first 95-player ordering, checked-fixture revision identity, fresh-cache zero requests, missing-player-only refresh, seven-day backstop, two-failed-batch outage stop, unchanged success timestamps, separate minute-health detail, Understat 24-hour/completed-match cadence and six-hour cooldown, normalised-only storage/manual bypass, Odds one/six-hour cadence, six-hour maximum use, key-free derived storage, rejection cooldown and fresh-cache reuse.
- The offline regressions prove that only an explicit browser `onLine === false` signal is treated as definitely offline and that the acquisition path stops before networking, preserves saved FPL data, reports FPL Fallback and uses explicit offline copy rather than a gateway-loaded claim.
- All model, expected-minutes, projection, scoring, fixture, captaincy, transfer, rank, League and golden expectations remain unchanged.
- Corrected exact source commit `d1b6ac0527d7b785962d7c7a02a7f266f42ba209` passed **681 tests, 681 passed, 0 failed, 0 skipped, 0 cancelled** without removing, weakening or skipping a test or changing a golden expectation.
- Two production builds stamped with that exact source commit were byte-identical for `dist/app.bundle.js`, `dist/index.html`, `dist/manifest.json` and root `index.html`. Root equalled deployable; the manifest recorded the exact source commit and source hash `95d57ddc3b63494cef850a034ec6be0ab50fcbb3193c736225d3ecf3f6e3bf7a`.
- Exact remote head `967856246a0c17972c43eaf444651bceb8b9f728` preserved reviewed tree `fd40deff72c458286e77f44a66b79a0e720e700c`, passed permanent Verify Teamsheet run `31265107597` and merged through PR #96 at `2ddb33c81fa2092598f290d60320364f2e0c35dc` with the same tree.
- The first physical iPhone pass accepted online startup, build identity, short background return, Provider Health, manual refresh, cached repeat launch and in-app offline resilience. It also proved that a full offline hard reload cannot load the static app shell. The focused corrected-build retest then accepted explicit FPL Fallback/offline wording with the original saved timestamp; Pages on `main` served the same accepted build identity after merge.
- Minute-history revision/reuse remains physically unexercised until a Gameweek is complete and officially checked. Odds cadence/reuse remains physically unexercised while Odds is disabled. These are deferred evidence boundaries, not failed automated contracts.

## Coverage map
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
20. `startup-refresh.test.mjs` — silent startup gate, refresh-age rule, shared startup/foreground orchestration, definite-offline acquisition/disclosure, deferred provider settlement, non-blocking automatic evidence and recovery-only UI wiring.
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
31. `transfer-exact-performance.test.mjs` and `transfer-exact-scale.test.mjs` — prepared-versus-oracle equality across varied Gameweek score shapes, materialisation bounds, deterministic profiling, evaluation-ceiling fail-closed behaviour and tie-heavy scale ordering.
32. `transfer-exact-correction.test.mjs` — the Track A correction. Controlled-pool equality with the independent `exhaustiveTransferSearch()` oracle across seven adversarial shapes (mixed, goalkeeper-only, cheap enablers, doubtful-heavy, exact price boundaries, inherited club excess and fully tied projections) at 45 deterministic seeds each; oracle equality at each fixed depth of one, two and three transfers; re-scoring every retained plan from its own final squad through the reviewed scorer; prefix-sum pool totals against the reviewed best-XI scoring; canonical bank, doubtful-count and signature tie-breaking on a fully tied pool; zero-transfer ranking agreement; Official-scale six-Gameweek completion below the unchanged 2,000,000 ceiling with `status: 'ok'`; deterministic Official-scale profiling; and Official-scale fail-closed behaviour when the ceiling is genuinely exceeded.
33. `transfer-baseline-presentation.test.mjs` — Worker-result and cache regressions for a separately returned mandatory zero-transfer baseline when it falls outside the unchanged ranked Top K, plus fail-closed handling of a missing or malformed baseline.
34. `team-resources-bench-clarity.test.mjs` — UX-A1 resource-bar adjacency and exact labels, honest manual provenance and edit route, compact-chip removal/non-duplication, separate exact bench roles, index-preserving order, two-line names, fixture/xP readability, complete accessible labels, Player Detail tapping and a presentation-only dependency guard.
35. `player-detail-scroll-rotation.test.mjs` — UX-A2 dialog scroll behaviour and PR #78 stacking regression. Exact background-offset capture on a fresh open and restoration on a normal close, proved against a simulated mobile-Safari lock that clamps the page to the top; root and body lock application and removal; internal scroll reset on every open; `preventScroll` focus on the close control and on the restored trigger; identical close/backdrop/Escape outcomes; player replacement while open preserving the original offset and trigger; route-driven close that unlocks but restores neither scroll nor focus; a no-op route change while closed; detached and hidden trigger rejection; documented viewport-property fallback; and the CSS contracts for flex scrolling with `min-height:0`, `vh` declared before `dvh`, compact-landscape full-height sizing, four-sided safe areas, **Player Detail layering above the fixed primary dock**, the dialog-not-a-route boundary, no runtime inline styling and no data/model reach.
36. `refresh-load-r1.test.mjs` — detailed-history request suppression/delta ordering/outage guard/timestamp preservation, Understat normalised cache/cadence/cooldown/manual bypass, Odds key-free derived cache/near-deadline cadence/expiry/cooldown and supporting-data health separation.
37. `documentation-integrity.test.mjs` — canonical maintainer references, local Markdown link resolution, complete documentation indexing and unique decision/limitation identifiers. This is repository guidance protection only and does not exercise or alter application behaviour.

Two forms of Transfers evidence are deliberately separate. Oracle equality is proved only on controlled pools, where an exhaustive comparison is tractable. On the Official-scale pool the claim is only that the exact search completes below the unchanged ceiling and returns `status: 'ok'`; it is not an exactness proof, and a lower evaluation count is never presented as improved prediction accuracy.

## Teamsheet 2.0.6 merged verification
The reviewed source `72bb55d484d3033a859ee51f2c3f3e7aa6bc55e6` passes **520/520 tests**, zero failures and zero skipped. New checks verify route-owned Settings destinations, explicit module hosts, warning materiality, Help/About content, identifier-free URLs and responsive Player Explorer metadata. A headless Chromium smoke check additionally exercises direct deep links, active Settings state, exact heading focus, Back restoration, dynamic module mounts, duplicate-ID absence and saved-core-data warning output. Production builds were deterministic, root `index.html` matched `dist/index.html`, and PR #65 merged at `cd1ad52ea4d13a247a82bc90f80f2db0b6f77aa4`.

This historical evidence does not replace physical iPhone Safari or live populated-data acceptance for untested features. VoiceOver is not a Teamsheet acceptance gate. Remaining feature-specific live acceptance is tracked under FPL-2.

## Golden discipline
Goldens are reviewed repository data, not verification output. `UPDATE_GOLDEN=1` may be used only during an explicitly reviewed stage update. Final verification runs against committed goldens without regenerating them.

Stages 8–10.3 change no deterministic projection formula and require no golden regeneration. Stage 10.3 adds downstream evaluation and presentation only.

## Harness
`tests/harness.mjs` stubs DOM, storage and fetch, then loads `dist/app.bundle.js`. Characterisation therefore exercises the production bundling path rather than a separate test-only implementation.

## Required checks before completion
1. Run `./run-tests.sh` with every committed test green and no golden regeneration.
2. For a generated checkpoint, verify the committed manifest source resolves, is an ancestor of the artifact commit, matches every declared build input and reproduces all tracked generated files byte-for-byte.
3. Build twice with the same exact source commit in `BUILD_COMMIT`.
4. Compare `dist/index.html`, `dist/app.bundle.js` and `dist/manifest.json` byte-for-byte, then verify the generated root `index.html` deployment copy is identical to `dist/index.html`.
5. Independently verify CSP/build identity through the committed security tests and emitted manifest.
6. Confirm `BUILD_INFO`, manifest module order, module-source hash, complete build-input hash, commit identity and generated files agree.
7. Commit reviewed inputs first, then commit only verified generated artefacts; documentation-only pull requests must confirm generated files are absent from their diff.
8. Remove temporary verification workflows before merge.

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

Automated checks cannot independently prove exact iPhone Safari rendering or thumb comfort. PR #48 is merged; its historical physical findings remain recorded, while populated-data transport is tracked separately and remaining feature acceptance is tracked under FPL-2.

## Teamsheet 2.0.1 physical-review regression coverage
The navigation suite verifies the persistent global Ask composer and internal arrow, absence of global Data/Evidence pills, controlled SVG dock icons, one fixed five-column safe-area contract, keyboard visual-viewport recovery, invisible focus presentation for programmatically focused headings, and arrow-only Settings subsection navigation. Automated checks still cannot prove every physical iPhone placement or populated FPL behaviour.

## Teamsheet 2.0.2 Team decision-home verification
The final Teamsheet 2.0.2 merged baseline is **459/459 tests** with zero failures and zero skipped. Coverage verifies legal-15 gating, immediate placeholder/connected pitch structure, explicit provenance, base XI plus captain uplift arithmetic, deterministic material-risk priority, advisory/no-submission deadline wording, preview distinction, neutral ownership context, preserved routes and absence of model/optimiser/persistence calls from the presentation wrapper.

Completion also required two byte-identical builds using the exact verified source commit, root/deployable equality and the existing CSP/build-identity suites. Automated checks cannot prove physical iPhone pitch position, text scaling or thumb comfort. At that checkpoint Team device acceptance remained open; it subsequently passed through PR #83. VoiceOver is not a Teamsheet acceptance gate.

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

Two exact-identity production builds were byte-identical and root `index.html` matched `dist/index.html`. Automated tests do not prove real Official FPL availability or physical iPhone density. Physical testing had not been performed at this 2.0.4 checkpoint; the later PR #92/#93 Leagues sequence established pre-season iPhone acceptance while correctly deferring post-Gameweek populated evidence. VoiceOver is not a Teamsheet acceptance gate.

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

Physical testing had not been performed at this 2.0.5 checkpoint. The later PR #92/#93 Leagues sequence established pre-season iPhone acceptance; published standings, gaps and real selected-rival exposure remain deferred until post-Gameweek data exists. VoiceOver is not a Teamsheet acceptance gate, and automated source/build evidence still cannot substitute for those deferred real-data checks.


## Teamsheet 2.0.7 implementation verification

Teamsheet 2.0.7 is complete and merged through PR #68. Its approved final-polish implementation added `final-mobile-polish.test.mjs` and updated presentation contracts for native controls, touch targets, restricted states, route focus/scroll, Player Detail route closure, Ask resilience, Fixture render isolation, table semantics and Transfers wording. The historical implementation branch completed **533 passed, 0 failed, 0 skipped**, deterministic exact-identity builds and root/deployable equality for source commit `5a61ec5510c447580afa6070a5a9815516babe86`. The Safari foreground-resume correction subsequently passed owner retest. VoiceOver is not a Teamsheet acceptance gate. Remaining populated live acceptance is tracked by feature rather than reopening 2.0.7.


## Safari foreground-resume correction verification

Physical iPhone testing exposed an untested failure path: unsuccessful startup attempts did not start the automatic refresh cooldown, and foreground refreshes temporarily made the application inert. Regression coverage verifies failed-attempt cooldown, hidden-page suppression, foreground interactivity and in-flight deduplication while preserving immediate manual refresh. The correction completed automated deterministic-build verification and then passed the owner's physical iPhone Safari app-switch retest before PR #68 was merged. `REFRESH-1` is closed.

## FPL-T1 gateway verification
Gateway tests cover exact route/query allowlisting, CORS, unsupported methods, credential/header non-forwarding, cache boundaries, generic upstream failures and invalid JSON. Client transport tests cover configured/unconfigured behaviour, bounded retries, optional 404 handling, relay exclusion for Official FPL and retained optional Understat fallback. The owner-controlled gateway subsequently passed physical live-data iPhone transport acceptance and merged through PR #69. Feature-specific populated acceptance remains separately tracked under FPL-2.

## PR #69 populated-data regression coverage
`live-preseason-regressions.test.mjs` verifies next-Gameweek public-picks derivation, no invented Gameweek, explicit unavailable/manual copy, missing-strength issue reporting, Official FPL difficulty fallback, finite neutral pre-season projections and unchanged activation of the normal strength model when all required fields are valid. The tested live transport/Transfers path subsequently passed owner acceptance; Team and Fixtures later passed their recorded paths, and Leagues passed pre-season acceptance with post-Gameweek evidence deferred under FPL-2/ML-3.

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

The historical PR #69 implementation baseline was **590 passed, 0 failed, 0 skipped** with two byte-identical exact-source builds and root/deployable equality. Subsequent Track A corrections and regressions moved the accepted merged checkpoint to **613 passed, 0 failed, 0 skipped** and populated physical iPhone Safari acceptance for the tested calculation/lifecycle paths. The current substantive application baseline is PR #96 with **681 passing tests**, recorded at the top of this document.

## 2026-08-06 — Concurrent continuation reconciliation

The reconciled branch passes **609 tests**. Added contracts prove that explicit cancellation and force-start supersession settle their pending calculation promises, and that mixed-width player IDs with reversed input order preserve exact production-versus-exhaustive results.

Claude's controlled-shape, fixed-depth, re-score, prefix-sum, tied-comparator and Official-scale suites remain intact. The seed-7 automated profile completed with **21 exact leaf evaluations** across **575 outgoing branches**. Automated timing is not physical-iPhone evidence.

## 2026-08-06 — Track A physical iPhone Safari evidence

Pritesh physically tested the reconciled PR #72 preview on iPhone Safari with populated Official FPL data. The default six-Gameweek exact calculation completed in approximately **15 seconds** and displayed both the highest-ranked transfer plan and the separate no-transfer baseline. Internal navigation preserved completed results; cancellation and restart responded promptly; an active calculation survived navigation; leaving and returning to Safari caused no freeze or reload; and a newer three-Gameweek request was not overwritten by the older eight-Gameweek result.

VoiceOver was not tested and must not be claimed as physically verified. A final production-bundle regression requires every zero transfer cost to render as **“No hit”** and forbids **“−0”** anywhere in the displayed transfer result.

## 2026-08-06 — Track A merged checkpoint

- Approved stack merged in order: PR #69 at `00a35bacd2396a125a8a914bff9980b4f18b257f`, PR #70 at `78b2729c51419a36c5e6f757fa54830100b5435c`, and PR #72 at `be742e1eb707b3892f6405adf5d8769e084eee65`.
- The final `main` tree `3794e8e7ab9859717950296766dc9d64c9e5473f` exactly matches the verified PR #72 head tree, proving the merge introduced no file-content drift.
- The accepted pre-merge gate remains **613 passed, 0 failed, 0 skipped**, with deterministic production builds and root/deployable equality. No new runtime test run is claimed after the merge; the tree-identity check ties that merged checkpoint directly to the verified content.
- Populated physical iPhone Safari passed the six-Gameweek exact calculation in about 15 seconds, result restoration, active navigation, cancel/restart, Safari background/return, stale-result protection, separate no-transfer comparison and final **No hit** wording.
- VoiceOver was not tested and is not claimed.

## UX-A1 populated iPhone Safari owner test script
**Completed and passed by the owner on 6 August 2026.** The script is retained as the reusable procedure for future Team resource/bench presentation changes.

Use a populated legal 15-player team and the production deployment. Record portrait and landscape separately.

1. Open Team in portrait with Safari's address bar expanded. Confirm **Free transfers** and **Money in bank** are readable without zoom and the resource bar sits directly above the pitch.
2. Confirm the entered values are visually prominent, **Entered manually** is visible but secondary, and no compact conflicting FT/bank chip appears in the Team header.
3. Use **Edit resources**, change both existing manual inputs, return to Team and confirm the resource bar reflects the new values once each.
4. Confirm the bench roles are immediately understandable as **GK**, **1st**, **2nd**, **3rd**, with each role visually separate from the player name.
5. Check real long player names. Confirm they remain identifiable over up to two lines and do not obscure fixture or projected-points text.
6. Tap each of the four bench cards and confirm the correct Player Detail opens; close it and confirm the same Team position is retained.
7. Confirm captain and vice-captain badges remain clear and are not crowded by the resource or bench changes.
8. Repeat steps 1–7 with Safari's address bar collapsed.
9. Rotate to landscape and repeat the resource, bench-role, long-name, fixture/xP and tap checks with both address-bar states where available.
10. Record any overlap, clipped text, accidental tap, horizontal scroll or confusing duplicate value. VoiceOver is outside this UX-A1 device script and is not a Teamsheet acceptance gate.

## UX-A2 populated iPhone Safari owner test script
**Completed and passed by the owner on 6 August 2026.** Every step below passed. Step 10 initially exposed Safari automatically enlarging text on the return to portrait; root text-size adjustment is now fixed at 100% in the production stylesheet and the owner physically retested the corrected behaviour successfully, with scrolling and closing still intact. The script is retained below as the reusable procedure for future Player Detail changes. The later PR #78 dock-layering correction was separately physically accepted on 7 August 2026.

Use a populated legal 15-player team and the production deployment. Record portrait and landscape separately, and repeat with Safari's browser controls expanded and collapsed.

1. Open Team or Players in portrait and scroll the surface partway down — far enough that the top of the page is off screen.
2. Open Player Detail from a player that is visible at that scroll position.
3. Confirm the background page does not move, jump or scroll behind the dialog while it is open, including when you drag on the backdrop.
4. Scroll inside Player Detail all the way to its final section and confirm nothing is cut off or unreachable.
5. Close with the close button and confirm the background returns to the **exact** position you left, not the top of the page.
6. Reopen the same player and confirm the detail starts at the top rather than where you had scrolled it.
7. Repeat steps 1–6 with Safari's browser controls collapsed, then again with them expanded.
8. With Player Detail open, rotate from portrait to landscape.
9. In landscape, confirm the close button is fully visible and tappable and that you can still scroll to the last section.
10. Rotate back from landscape to portrait and confirm the dialog is still usable and nothing is clipped.
11. Close after rotating and confirm the background position is still correct.
12. Repeat the close checks using the backdrop and, on an external keyboard if available, Escape. All three must behave identically.
13. Open Player Detail and press browser Back once.
14. Confirm one Back press leaves the previous underlying route — no second Back needed, no stale scroll jump and no Player Detail URL.
15. Record any clipped close button, unreachable content, background jump, wrong restored position, horizontal scroll or rotation glitch. VoiceOver is outside this script; it is not a Teamsheet acceptance gate.

## T-02 availability-badge centring follow-up — 7 August 2026

Physical iPhone Safari review exposed a right-shifted standalone availability badge caused by the generic `.flag` horizontal margin. The follow-up regression is required to fail before the centring override and pass after `.pitch-availability{margin-left:0}` is applied. Full-suite and deterministic-build evidence is recorded on the follow-up pull request.

## iPhone form-focus zoom owner test script — 9 August 2026

Use the exact draft-PR build in normal iPhone Safari. Do not pinch zoom during the native-recovery checks.

1. Open Team and tap **Edit resources**.
2. Focus **Free transfers**, change the value, close the keyboard using **Done**, and confirm the page stays at its normal scale.
3. Save and confirm the resource bar updates once; restore the original value afterward.
4. Repeat the focus/Done check for **Money in bank**.
5. Open Settings → Team & Account and focus a text or number field; confirm no focus enlargement and normal save behaviour.
6. Open Transfers and focus each editable assumption; confirm no enlargement, clipping or horizontal overflow.
7. Open Fixtures and focus a number field and a select; confirm the interface remains at normal scale after dismissal.
8. Open Settings → Data & Providers, focus the masked Odds API key password field without changing or revealing its value, dismiss the keyboard and confirm normal scale is retained.
9. Confirm ordinary pinch zoom still works, then return to normal scale.
10. Rotate portrait → landscape → portrait and repeat one resource-field focus/Done cycle.
11. Record any enlarged scale, clipped field, layout shift, accidental value change, duplicate save or failure to recover. VoiceOver is not a Teamsheet acceptance gate.

## Atomic Foreground Refresh

`tests/atomic-foreground-refresh.test.mjs` retains its 96 cases covering the numbered R3.4 contract and the first PR #102 correction regressions. `tests/atomic-foreground-refresh-runtime.test.mjs` retains the production-bundle focus test. `tests/atomic-refresh-rollback-regression.test.mjs` adds two rollback regressions, taking the candidate to 792 tests while retaining all 790 previously passing tests.

Coverage groups:

- **Collection purity** — deep state-snapshot comparison across `S`, the health registry and `xpCache`; frozen staged inputs; live typed minute transport; no in-place `S.retryStats`/source write; health marks returned as data.
- **Rule A / Rule B separation** — a revision change keeps a usable value active and Cached; only provenance and R1 age bounds clear a slice; a club rename and a kickoff swap invalidate the computation signature.
- **Bounded recomputation** — one requeue per provider per apply cycle on a signature mismatch; none for a current-input failure, a cooling skip or a disabled provider.
- **Minute provenance** — season id reuse, schema/model mismatch and missing metadata all fail closed; the seven-day backstop leaves an entry usable; non-cohort players stay persisted but inactive.
- **Typed transport** — 404 is notfound; a 200 carrying `detail` or failing endpoint validation is failed and therefore carries compatible account state forward.
- **Account slices and health** — carry keys; entry as the root; Live only on a clean core and clean replacement of every requested slice.
- **Commit and rollback** — no `await`, dispatch, DOM or storage call inside the commit; an actual later forced failure restores account keys and every commit-owned/module-private mutation, preserves `xpCache` byte-for-byte with the same cached object references, and restores the pending recomputation `Set` in place with its exact prior contents; re-entrancy rejected.
- **Error classification** — only `collection_failed` may mark FPL Fallback or Unavailable.
- **Invariants** — the D-13 ordering invariant that made the withdrawn A5-3 finding a non-defect; `S` exposes only data properties.
- **Race and persistence regressions** — complete later-refresh and direct-wrapper coverage for Understat, Odds and minutes; core/configuration/manual-cohort invalidation; source-time precedence; rejected-result no-write behaviour.
- **Focused production render** — the actual built bundle preserves `document.activeElement` and the raw focused `fxFrom`/`fxSpan` value through `renderAll()`.

`tests/startup-refresh.test.mjs` line 77–79 previously pinned the pre-atomic provider call shape (`loadUnderstat({force:Boolean(options.forceSupporting)})`). Providers now receive the staged core and captured configuration, so those three assertions were replaced with ones that pin the staged context **as well as** the `forceSupporting` propagation they always covered. No assertion was removed or weakened.
