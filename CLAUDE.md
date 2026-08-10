# CLAUDE.md — onboarding for every future development session

## 10 August 2026 — A3 error-boundary separation candidate (EB-1)

Pritesh approved implementation of Package EB-1 after investigation and design. The candidate is draft PR #108 on `agent/a3-error-boundary-separation`, based on `main` `d112c673310149a4463def1758242460450600dc`.

EB-1 fixes failure **ownership** only. A recovery-render failure after a genuine Official FPL collection failure is now recorded as a secondary `render_failed` beside the unchanged primary `collection_failed` instead of being swallowed by an empty catch. An unexpected exception escaping Understat, Odds or minute-history computation is now application-owned `internal_error`: it still passes through the one shared `applyProviderResult()` gate so Rule B's retain/clear decision is unchanged, but it no longer manufactures Understat/Odds/FPL Provider Health. Startup, manual and foreground refreshes own an otherwise escaping exception at a narrow lifecycle boundary that begins before `captureRefreshInputs()`; no global `window.onerror` or `unhandledrejection` layer was added.

Evidence: **856 passed, 0 failed, 0 skipped, 0 cancelled** against the 842-test `main` baseline, with all 842 retained. No provider endpoint, validation rule, retry cadence, weighting or model calculation changed. No physical iPhone testing was performed and none is claimed. PR #108 remains draft and must not be merged, or marked ready for review, without Pritesh's explicit approval. See [A3 error-boundary separation](docs/A3-ERROR-BOUNDARY-SEPARATION.md).


## 10 August 2026 — `fpl:calib` compatibility is merged

PR #107 is merged at `main` `d112c673310149a4463def1758242460450600dc`, over source/tests/docs commit `862eefc32b0edb070290ad9ce82d85b1123b0596`, generated-only child `69e539647ae687f49605633505e7147da76125e2` and documentation child `6ba905d`. Permanent Verify Teamsheet run #127 / `31396393124` passed every stage on the merge commit, on an 842-test baseline. The merged behaviour rejects every existing unverified `fpl:calib` record from active model state while preserving its bytes, uses standard uncalibrated projections, and keeps the Stage 7 walk-forward check diagnostic-only. No calibration values, raw model formula or production calibration methodology were added. PERSIST-4 is closed.


## 10 August 2026 — Post-A3 0C manual-squad dead-handler cleanup

Post-A3 Checkpoint 0 PR #105 is merged at `main` `dd74365256fe6d9338b720ffecf1913e48ac77eb`. Checkpoint 0A's new automatic push trigger was proven immediately: Verify Teamsheet run #110 / `31383479683` ran on the exact merge commit and passed every stage, on an 835-test baseline.

Pritesh explicitly approved the separate narrow **0C cleanup**. It removes only the two proven-unreachable per-button manual-squad listeners from `src/ui/views.mjs`, keeps the rendered `data-rm`/`data-add` hooks, keeps `src/ui/manual-squad-runtime.mjs` byte-unchanged as the sole validating interaction owner, and adds an ownership regression. One existing A3 test, `manual squad builder has no unchecked squad persistence path`, was re-pointed from the deleted code to the live runtime and made stricter on `views.mjs`; nothing was weakened, deleted or skipped. No football rule or model behaviour changes. See [Post-A3 0C cleanup](docs/POST-A3-0C-MANUAL-SQUAD-DEAD-HANDLER-CLEANUP.md).

`fpl:calib` compatibility and resilience remains the next substantive checkpoint after 0C and begins with investigation and design only, under the separate model gate.



## 10 August 2026 — A3 cache and persistence resilience is merged

PR #104 is merged at `main` `9b31f373a23d26c49f81c688a2ca6fde98086cbd`. Its reviewed head was `4e434b940e2bcb473374573db5da16f6a645d9eb`, over source/test commit `502a1f7ac0e0456743f3ddb0695433decf8976d1` and generated-only child `02216b8`, based on the former `main` `473cfdb3295d2b896a00c0aa7b1308814bf2e043`.

The checkpoint keeps Atomic Foreground Refresh ordering unchanged while adding a schema/season-bound main `fpl:cache`, verified user-owned saves, season-bound manual-squad and Mini-League preference records, and explicit session-only warnings when browser persistence fails. Independent review found and corrected one real defect: a failed authoritative storage-manager write could fall back to `localStorage` and be reported as a durable save even though no later read could return it. The Refresh-Load R1 supporting-cache cadence/compatibility rules and Stage 10 evidence stores are unchanged. Legacy `fpl:calib` remains deliberately untouched behind the separate model approval gate.

Evidence: **832 passing tests, 0 failed**, verified committed build provenance, two byte-identical production builds, and permanent Verify Teamsheet run #105 / `31377157889` on the reviewed head `4e434b9`. Pritesh **explicitly waived physical iPhone testing** for this checkpoint and explicitly approved the merge. No physical device testing was performed, and none is claimed.


## 10 August 2026 — PR #103 physical acceptance closeout

The final Small Mobile UI Consistency + Loading Viewport Fix application source is `646eee13960c343fbe07e3a76496717fd9837c0e`, with generated-only child `81cc9130ac2c7b8206f3bd5f6a2cf85bb5ba0777`. The final candidate retains every prior test and passes **803 tests, 0 failed**, deterministic byte-identical builds, root/deployable equality, exact build identity and reachable generated provenance. Permanent Verify Teamsheet run #90 / `31356255017` passed on the exact generated head.

Physical iPhone Safari acceptance is complete: the startup canvas reaches Safari chrome without a light strip; Team, Transfers, Fixtures, Leagues and Settings use the accepted shared header hierarchy; the refined editable/selectable controls are visually proportionate while retaining the no-focus-zoom behaviour; and the Leagues primary box now aligns vertically with the other primary screens. Pritesh explicitly approved PR #103 for merge on 10 August 2026.

No projection, expected-minutes, scoring, fixture, captaincy, squad, transfer, rank, Mini-League/rival, provider, data-source, Atomic Foreground Refresh, navigation, Team-renderer or Player Detail behaviour changed. At documentation closeout, GitHub `main` remained `d5f2572ee4d95c3c242ecbc97ee46802a6f0273d`; the eventual merge commit must be read from latest `main` rather than inferred from this pre-merge documentation commit.

## 10 August 2026 — current checkpoint

The current `main` is `d112c673310149a4463def1758242460450600dc`, the merge of `fpl:calib` compatibility PR #107. Post-A3 Checkpoint 0 (PR #105), the 0C manual-squad dead-handler cleanup (PR #106) and `fpl:calib` compatibility (PR #107) are all merged and verified. [PERSIST-4](docs/KNOWN_LIMITATIONS.md) is closed. Data Architecture D1 remains an approved future design only.

The current approved implementation is **A3 error-boundary separation, Package EB-1** — draft PR #108; see [A3 error-boundary separation](docs/A3-ERROR-BOUNDARY-SEPARATION.md). Nothing after it is pre-approved. The full sequence is in [Roadmap](docs/ROADMAP.md).

## 9 August 2026 reconciliation

The authoritative baseline is now `main` `6e725485564a51ee2a17bc08e5c8bf95e8c2778c`, merge of iPhone form-focus zoom PR #100. Its permanent verification passed **693 tests**. DTR-1 and the physical iPhone form-focus zoom checkpoint are complete and merged.

[Data Architecture D1](docs/DATA-ARCHITECTURE-D1.md) is approved as a documentation-only design decision: Cloudflare D1 for structured records, private R2 for exact immutable evidence, a separate authenticated data Worker, local browser fallback/outbox, and optional downstream Google Sheets reporting. No persistence implementation is approved.

**Atomic Foreground Refresh** is complete, physically accepted and merged through PR #102, after five design rounds (R2, R3, R3.1, R3.2, R3.3, R3.4) and the PR #102 correctness review. See [Atomic Foreground Refresh](docs/ATOMIC-FOREGROUND-REFRESH.md).

Read this first. GitHub `main` is the permanent source of truth; repository evidence overrides conversations, old uploads and generated deployables. Last reconciled: 10 August 2026.

## Current baseline

| Item | Current evidence |
|---|---|
| Repository head | `main` `d112c673310149a4463def1758242460450600dc`, merge of `fpl:calib` compatibility and resilience PR #107 |
| Latest merged application checkpoint | PR #107, source `862eefc32b0edb070290ad9ce82d85b1123b0596`, generated-only child `69e539647ae687f49605633505e7147da76125e2`, documentation child `6ba905d`. PR #106 was the narrow 0C cleanup; PR #105 changed CI configuration, tests and documentation only. |
| Permanent repository verification | 842 passed, 0 failed on `main` `d112c67…` — Verify Teamsheet run #127 / `31396393124`, event `push`, every stage passed on the merge commit itself. |
| Local reproduction at the merge commit | 842 passed, 0 failed at `d112c67…` |
| Current unmerged candidate | A3 error-boundary separation (EB-1), draft PR #108 — separates provider, commit, render, persistence and application-owned failures in `src/main.mjs` only; no provider endpoint, retry cadence, weighting or model change. 856 passed, 0 failed, 0 skipped, 0 cancelled, over the 842-test baseline. |
| Physical iPhone Safari acceptance | Tested paths accepted for Transfers, Player Detail, Team, Fixtures, the Leagues pre-season experience, R1 online/cached/manual/background/in-app-offline behaviour, Atomic Foreground Refresh (PR #102) and the PR #103 presentation checkpoint. For PR #104 physical testing was explicitly waived by Pritesh. No physical testing has been performed for PR #107 or the PR #108 candidate. |
| Deferred live-season acceptance | Published League rank/movement, populated standings and gaps, nearby/pairwise rivals, selected-rival squad/captain/vice/chip exposure, stale/incomplete rival handling and relevant large-league pagination |

[Leagues pre-season acceptance](docs/LEAGUES-PRESEASON-ACCEPTANCE.md) is authoritative for what was accepted and what remains deferred. The deferred checks are not defects while Official FPL has not published the required post-Gameweek facts.

## Current approval boundary

Repository Truth A1, Safe Hygiene A2 and Refresh-Load R1 are complete and merged through PRs #94, #95 and #96. R1 delivered:

- suppress valid minute-history requests until a checked-fixture revision or seven-day correction backstop changes;
- request only missing/due players, with the active squad first and a two-failed-batch outage guard;
- persist validated normalised Understat and key-free derived Odds inputs under the approved cadence and cooldown rules;
- disclose supporting-data cache age/use separately from core Official FPL freshness;
- preserve every model formula, provider endpoint, gateway rule and the existing complete-state orchestration.

Understat parser repair, atomic foreground-state replacement, core bootstrap reduction, new providers/endpoints and every formula or recommendation change remain excluded. R1 passed exact automated verification and the currently testable physical iPhone paths before Pritesh explicitly approved its merge. No future branch may be merged without Pritesh's explicit approval.

The first PR #96 iPhone pass accepted online startup, build identity, short background return, Provider Health, manual refresh, cached repeat launch and in-app offline resilience. It also proved that a full offline hard reload cannot load the static application shell, which remains outside R1. The in-app offline refresh exposed misleading fresh/live FPL disclosure; source `d1b6ac0…` stops before networking when Safari definitively reports offline, preserves the saved snapshot timestamp and labels FPL as Fallback. Pritesh physically retested and accepted that corrected path, then verified the same build identity after GitHub Pages returned to `main`.

Audit A3 and A3-R0 are complete and merged. A3-R0 binds generated files to all build inputs, requires their recorded source commit to be a reachable ancestor and reproduces committed deployables exactly before ordinary CI builds overwrite them.

DTR-1 is complete and merged through PR #99. Its exact generated build passed 691/691 tests, permanent CI, reachable two-commit provenance and populated physical iPhone Safari acceptance before Pritesh explicitly approved merge. The device pass exposed a pre-existing Safari form-focus zoom defect: editable controls inherited 15px text and the page remained enlarged after the keyboard closed.

The iPhone form-focus zoom correction is complete and merged through PR #100. It raised only editable text, number, search, password, select and textarea controls to 16px, preserved pinch zoom and left checkbox/file/range controls and all application logic unchanged. Its exact build passed automated, generated-provenance and physical iPhone gates before merge.

Data Architecture D1 investigation/design is complete and its decision is recorded in [Data Architecture D1](docs/DATA-ARCHITECTURE-D1.md). D1 persistence implementation is not approved. Atomic Foreground Refresh is merged: it stages collection, applies one synchronous no-throw commit, keys account carry-forward, corrects misleading Live disclosure to Partial on account failure or absence, and separates collection/commit/render/persistence errors. REFRESH-6 through REFRESH-10 are recorded as separately gated.

A3 cache and persistence resilience is merged through PR #104. It hardens the browser persistence boundary only: exact schema/season compatibility for the main `fpl:cache`, season/version ownership for user-owned records, verified writes that mean restorable, safe manual-squad/config ordering, and truthful session-only warnings when a write fails. Physical iPhone testing was explicitly waived by Pritesh for that checkpoint. The first completed and officially `data_checked` Gameweek remains an evidence gate for real minute history, Stage 10 outcomes and populated Leagues behaviour.

A3 error-boundary separation (EB-1) is the current owner-approved implementation, unmerged in draft PR #108. It changes failure ownership only. Provider transport and validation evidence keeps sole ownership of Provider Health; commit, render, persistence and unexpected application exceptions may not move it, and none of them causes a provider retry. `ownApplicationError()` wraps the shared `applyProviderResult()` gate so the Rule-B retain/clear decision stays identical for an application exception. The boundary is narrow — the verified-refresh lifecycle edge — and no global `window.onerror` or `unhandledrejection` layer exists. See [A3 error-boundary separation](docs/A3-ERROR-BOUNDARY-SEPARATION.md).

## Owner and communication

Pritesh is a non-developer but rigorous reviewer who primarily works from an iPhone. Lead with the outcome, then evidence, risks and recommendation. Distinguish fact, inference, proposal and limitation. Never claim success, accuracy, deployment or physical-device acceptance without evidence.

## Read in this order

1. [Project Context](docs/PROJECT_CONTEXT.md)
2. [Architecture](docs/ARCHITECTURE.md)
3. [Decisions](docs/DECISIONS.md)
4. [Roadmap](docs/ROADMAP.md)
5. [Known Limitations](docs/KNOWN_LIMITATIONS.md)
6. [Teamsheet 2.0 Product Blueprint](docs/TEAMSHEET2-PRODUCT-BLUEPRINT.md)
7. The current checkpoint design or acceptance record — currently [A3 error-boundary separation](docs/A3-ERROR-BOUNDARY-SEPARATION.md), over the merged [`fpl:calib` compatibility and resilience](docs/FPL-CALIB-COMPATIBILITY-RESILIENCE.md), [Post-A3 0C cleanup](docs/POST-A3-0C-MANUAL-SQUAD-DEAD-HANDLER-CLEANUP.md), [Post-A3 Checkpoint 0](docs/POST-A3-CHECKPOINT-0-HOUSEKEEPING.md) and [A3 cache and persistence resilience](docs/A3-CACHE-PERSISTENCE-RESILIENCE.md)
8. Before provider or security work: [Data Sources](docs/DATA_SOURCES.md) and [Security](docs/SECURITY.md)
9. Before model, projection, fixture, squad, captaincy, optimisation, rank or Mini-League calculation work: [Projection Model](docs/PROJECTION_MODEL.md) and [Testing](docs/TESTING.md)
10. Historical material only when needed: [Historical Records](docs/HISTORICAL_RECORDS.md)

## What Teamsheet is

Teamsheet is a team-first, decision-first FPL application for the manager's complete 15-player squad. The primary destinations are Team, Transfers, Fixtures, Leagues and Settings. Player research lives under Settings; Ask Teamsheet has a separate route but hosted AI remains disabled. Teamsheet is advisory and performs no FPL account write.

The app currently provides:

- a best XI, captain, vice-captain and bench order;
- exact legal zero-to-three-transfer comparisons with a mandatory no-transfer baseline;
- fixture-run and swing-window planning through GW38;
- an all-league hub, selected-league detail, targeted standings and explicitly loaded rival comparisons;
- settings, provider health, evidence, outcomes, descriptive metrics, review and deterministic exports.

It does not yet provide a validated projected-rank model, protect/balanced/chase strategy, cited team-news intelligence, automated Google Sheets sync or prospectively proven model accuracy.

## Non-negotiable engineering rules

- Never change projection, expected-minutes, scoring, fixture, captaincy, squad, simulation, transfer, rank, Mini-League or strategy logic without first presenting existing and proposed behaviour, inputs, fallbacks, assumptions, limitations, trade-offs and validating evidence, then receiving explicit approval.
- Never add a provider or data source without an approved purpose, field contract, reliability assessment, validation/ablation plan, fallback, security/privacy review, cost and tests.
- Never delete, weaken or skip a test to make a change pass.
- Never claim improved prediction accuracy without genuine out-of-sample validation. The historical aggregate r=0.80 is method-flattered.
- Transfer pruning must remain admissible, and `exhaustiveTransferSearch()` must remain independent of production pruning.
- Preserve deterministic builds, exact reachable `BUILD_COMMIT` identity, complete build-input identity, root/deployable equality and generated-file provenance.
- Preserve Vanilla JavaScript ES modules, the zero-dependency toolchain, Node built-in tests, the custom bundler, GitHub Pages and the single-file deployment unless separately approved.
- Generated `dist/` and root `index.html` files come only from `build.mjs`; never hand-edit them.
- Anthropic keys remain banned client-side. Odds requests remain direct-only and the key must never be relayed, logged, rendered or exposed in diagnostics.
- Understat remains team-level only. Optional-provider failure must degrade gracefully.
- Supporting caches contain only validated model inputs: no Understat HTML and no Odds key or keyed URL.
- Preserve mobile-first iPhone usability and the accepted physical behaviours touched by a future change.

## Current security and data boundaries

- Official FPL reads use the owner-controlled, allowlisted Cloudflare gateway and still pass client validators.
- Provider and user strings use DOM builders; AI output uses restricted Markdown.
- The Odds key is masked, direct-only, forgettable and scrubbed from diagnostics.
- The generated single script and style are SHA-256 locked by CSP.
- Runtime style APIs and style attributes are forbidden.
- Stage 10 evidence is allowlisted, hash-verified and recovery-oriented; exports are complete, unencrypted and owner controlled.
- League and manager identifiers stay out of routes, page titles, provider diagnostics and Stage 10 evidence.

## Workflow

1. Inspect latest `main` and read this file first.
2. State the exact baseline, scope, exclusions, risks and approval gate.
3. Obtain explicit approval where required.
4. Create a separate branch; never push directly to `main`.
5. Implement only the approved scope.
6. Add or update tests without weakening existing protection.
7. Run `./run-tests.sh` and the production build.
8. Verify two exact-identity builds, root/deployable equality and manifest identity where relevant.
9. Update affected canonical documentation.
10. Open a draft pull request with evidence and exclusions.
11. Merge only after explicit owner approval, then verify `main`.

## Completion report for every implementation item

Report the exact changes, deliberate exclusions, test count and result, deterministic-build evidence, root/deployable result, documentation updates, judgement calls, remaining limitations, physical-device evidence actually performed, branch, commit and draft pull-request link.
