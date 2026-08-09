# CLAUDE.md — onboarding for every future development session


## 9 August 2026 current checkpoint

Current GitHub `main` at the start of this checkpoint is `d5f2572ee4d95c3c242ecbc97ee46802a6f0273d`, merge of Atomic Foreground Refresh PR #102. PR #102 is merged and verified at **792 passed, 0 failed, 0 skipped**, with deterministic/generated provenance, independent re-review and physical iPhone Safari acceptance. The current approved implementation candidate is **Small Mobile UI Consistency + Loading Viewport Fix**. Its reviewed source is `0e3a0674416aa069a0f06ebee87854df41907ed0` and generated-only child is `b53c8026a5485936582da1ea2374f9bad799e44d`. Six focused regressions raise the candidate suite to **798 tests**; the publication gate passed the complete suite, deterministic double build, root/deployable equality and reachable generated provenance. Physical iPhone Safari acceptance of this UI candidate remains required before merge. This current-state block supersedes older 9 August wording below where it describes PR #102 as unmerged or cites the 691/693-test application baseline.

## 9 August 2026 reconciliation

The authoritative baseline is now `main` `6e725485564a51ee2a17bc08e5c8bf95e8c2778c`, merge of iPhone form-focus zoom PR #100. Its permanent verification passed **693 tests**. DTR-1 and the physical iPhone form-focus zoom checkpoint are complete and merged.

[Data Architecture D1](docs/DATA-ARCHITECTURE-D1.md) is approved as a documentation-only design decision: Cloudflare D1 for structured records, private R2 for exact immutable evidence, a separate authenticated data Worker, local browser fallback/outbox, and optional downstream Google Sheets reporting. No persistence implementation is approved.

**Atomic Foreground Refresh** is implemented as a merge-gated candidate on `claude/atomic-foreground-refresh-h7umfj` after five design rounds (R2, R3, R3.1, R3.2, R3.3, R3.4) and the PR #102 correctness review. The corrected candidate passes 792 tests (all prior 790 retained plus two rollback regressions); deterministic/generated verification remains a required publication gate. Merge and physical iPhone Safari acceptance remain owner-gated and are not claimed. See [Atomic Foreground Refresh](docs/ATOMIC-FOREGROUND-REFRESH.md).

Read this first. GitHub `main` is the permanent source of truth; repository evidence overrides conversations, old uploads and generated deployables. Last reconciled: 9 August 2026.

## Current baseline

| Item | Current evidence |
|---|---|
| Repository head | `main` `deb4ea26ba96112dba07660e23a61f04d4b6596d`, merge of D1 design closeout PR #101 |
| Latest application checkpoint | iPhone form-focus zoom PR #100, merge `6e725485564a51ee2a17bc08e5c8bf95e8c2778c`; DTR-1 remains complete through PR #99 |
| Permanent repository verification | 693 passed on `main`; corrected Atomic Foreground Refresh candidate baseline is 792 (all prior 790 retained + 2 rollback regressions); permanent CI/generated provenance required on the published correction |
| Application tree identity | The accepted PR #100 application tree is preserved by merge `6e725485564a51ee2a17bc08e5c8bf95e8c2778c` |
| Physical iPhone Safari acceptance | Tested paths accepted for Transfers, Player Detail, Team, Fixtures, the Leagues pre-season experience and R1 online/cached/manual/background/in-app-offline behaviour |
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

Data Architecture D1 investigation/design is complete and its decision is recorded in [Data Architecture D1](docs/DATA-ARCHITECTURE-D1.md). D1 persistence implementation is not approved. Atomic Foreground Refresh is implemented as a merge-gated candidate: it stages collection, applies one synchronous no-throw commit, keys account carry-forward, corrects misleading Live disclosure to Partial on account failure or absence, and separates collection/commit/render/persistence errors. REFRESH-6 through REFRESH-10 are recorded as separately gated. The first completed and officially `data_checked` Gameweek remains an evidence gate for real minute history, Stage 10 outcomes and populated Leagues behaviour.

## Owner and communication

Pritesh is a non-developer but rigorous reviewer who primarily works from an iPhone. Lead with the outcome, then evidence, risks and recommendation. Distinguish fact, inference, proposal and limitation. Never claim success, accuracy, deployment or physical-device acceptance without evidence.

## Read in this order

1. [Project Context](docs/PROJECT_CONTEXT.md)
2. [Architecture](docs/ARCHITECTURE.md)
3. [Decisions](docs/DECISIONS.md)
4. [Roadmap](docs/ROADMAP.md)
5. [Known Limitations](docs/KNOWN_LIMITATIONS.md)
6. [Teamsheet 2.0 Product Blueprint](docs/TEAMSHEET2-PRODUCT-BLUEPRINT.md)
7. The current checkpoint design or acceptance record — currently [Atomic Foreground Refresh](docs/ATOMIC-FOREGROUND-REFRESH.md)
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
