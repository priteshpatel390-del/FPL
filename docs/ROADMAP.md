# ROADMAP.md — current and proposed checkpoints


## 10 August 2026 — A3 cache and persistence resilience is merged

PR #104 is merged at `main` `9b31f373a23d26c49f81c688a2ca6fde98086cbd`, from reviewed head `4e434b940e2bcb473374573db5da16f6a645d9eb` over source/test commit `502a1f7ac0e0456743f3ddb0695433decf8976d1` and generated-only child `02216b8`.

It keeps Atomic Foreground Refresh ordering unchanged while adding a schema/season-bound main `fpl:cache`, verified user-owned saves, season-bound manual-squad and Mini-League preference records, and explicit session-only warnings when browser persistence fails. Independent review found and corrected one real defect: a failed authoritative storage-manager write could fall back to `localStorage` and be reported as a durable save even though no later read could return it. The Refresh-Load R1 supporting-cache cadence/compatibility rules and Stage 10 evidence stores are unchanged. Legacy `fpl:calib` remains deliberately untouched behind the separate model approval gate.

Evidence: **832 passing tests, 0 failed**, verified committed build provenance, two byte-identical production builds, and permanent Verify Teamsheet run #105 / `31377157889` on the reviewed head. Pritesh explicitly waived physical iPhone testing and explicitly approved the merge. No physical device testing was performed, and none is claimed.


## 10 August 2026 — PR #103 physical acceptance closeout

The final Small Mobile UI Consistency + Loading Viewport Fix application source is `646eee13960c343fbe07e3a76496717fd9837c0e`, with generated-only child `81cc9130ac2c7b8206f3bd5f6a2cf85bb5ba0777`. The final candidate retains every prior test and passes **803 tests, 0 failed**, deterministic byte-identical builds, root/deployable equality, exact build identity and reachable generated provenance. Permanent Verify Teamsheet run #90 / `31356255017` passed on the exact generated head.

Physical iPhone Safari acceptance is complete: the startup canvas reaches Safari chrome without a light strip; Team, Transfers, Fixtures, Leagues and Settings use the accepted shared header hierarchy; the refined editable/selectable controls are visually proportionate while retaining the no-focus-zoom behaviour; and the Leagues primary box now aligns vertically with the other primary screens. Pritesh explicitly approved PR #103 for merge on 10 August 2026.

No projection, expected-minutes, scoring, fixture, captaincy, squad, transfer, rank, Mini-League/rival, provider, data-source, Atomic Foreground Refresh, navigation, Team-renderer or Player Detail behaviour changed. At documentation closeout, GitHub `main` remained `d5f2572ee4d95c3c242ecbc97ee46802a6f0273d`; the eventual merge commit must be read from latest `main` rather than inferred from this pre-merge documentation commit.

## 10 August 2026 — current checkpoint

Post-A3 Checkpoint 0 is merged through PR #105 at `dd74365256fe6d9338b720ffecf1913e48ac77eb`, which is the current `main`. Data Architecture D1 remains an approved future design only.

The current work is the separate narrow **0C manual-squad dead-handler cleanup**, explicitly approved for implementation after Checkpoint 0C's investigation established that the legacy per-button listeners are unreachable. See [Post-A3 0C cleanup](POST-A3-0C-MANUAL-SQUAD-DEAD-HANDLER-CLEANUP.md). `fpl:calib` is deliberately excluded from it.

After 0C is merged and verified, the next checkpoint is **`fpl:calib` compatibility and resilience**, which begins with investigation and design and is separately model-gated. A3 error-boundary separation follows it. Neither is pre-approved.

## Completed before the current sequence

- **Data Architecture D1 design — complete:** approved architecture is recorded in [DATA-ARCHITECTURE-D1.md](DATA-ARCHITECTURE-D1.md); no infrastructure or runtime implementation exists.
- **Atomic Foreground Refresh — complete and merged:** PR #102 is merged and physically accepted. See [Atomic Foreground Refresh](ATOMIC-FOREGROUND-REFRESH.md).
- **Cache and persistence resilience — complete and merged** through PR #104; 832 tests, committed build provenance, deterministic double-build validation, permanent Verify Teamsheet run #105 and independent review of the final diff all passed. Physical iPhone testing was explicitly waived by the owner.

## Current sequence

Nothing below item 1 is approved for implementation. Each entry begins with investigation and design, and each requires explicit owner approval before any code is written.

1. **Post-A3 Checkpoint 0 housekeeping — complete and merged through PR #105.** Automatic Verify Teamsheet verification of `main`, post-merge documentation reconciliation and the duplicate manual-squad handler investigation. See [Post-A3 Checkpoint 0](POST-A3-CHECKPOINT-0-HOUSEKEEPING.md). Its 0C investigation produced the separately approved cleanup described below, which is the current work.
2. **`fpl:calib` compatibility and resilience — next.** Investigation and design first. This checkpoint is **separately model-gated**: `fpl:calib` feeds projections, so any change to how a legacy calibration record is accepted, rejected or identified crosses the model approval gate and requires the full existing/proposed behaviour, inputs, fallbacks, assumptions, limitations, trade-offs and validating-evidence presentation before approval. A3 cache and persistence resilience deliberately left `fpl:calib` untouched; [PERSIST-4](KNOWN_LIMITATIONS.md) records that gap and is **retained as open until this checkpoint completes**. No implementation is approved.
3. **A3 error-boundary separation — after `fpl:calib`.** Investigation and design first. Not pre-approved.
4. **Production-bundle safeguards.**
5. **State-ownership cleanup.**
6. **Route-aware rendering and performance work.**
7. **Small stale-code cleanup and remaining reviewed deletion work.**
8. **A3 documentation and architecture closeout.**

### Separate approved narrow checkpoint — duplicate manual-squad handler correction (0C)

Recorded here as its own candidate so it is **not** absorbed into item 2 or item 3. Pritesh explicitly approved this narrow implementation after Checkpoint 0 merged. It remains deliberately unnumbered because it is a small intervening cleanup rather than a new A3 remediation item.

Post-A3 Checkpoint 0C established, with empirical evidence, that the per-button manual-squad add and remove listeners in `src/ui/views.mjs` are unreachable, because `src/ui/manual-squad-runtime.mjs` installs a capture-phase document listener on the same selectors and calls `stopImmediatePropagation()`. The dead path omits the position, club and budget checks and the FPL-T1 optimiser deferral, so it is a latent hazard rather than a live defect. The proposed correction removes the dead listeners, leaves `manual-squad-runtime.mjs` as the single owner, and adds a regression test proving the validating implementation runs.

It touches manual-squad handling and therefore sits inside the squad-legality approval boundary. The original findings are in [Post-A3 Checkpoint 0](POST-A3-CHECKPOINT-0-HOUSEKEEPING.md); the approved implementation, its test-ownership judgement call and its verification are in [Post-A3 0C cleanup](POST-A3-0C-MANUAL-SQUAD-DEAD-HANDLER-CLEANUP.md).

## Deferred beyond the current sequence

Longer-horizon product work, unchanged and unsequenced relative to the eight items above. None is approved.

- Understat repair.
- Odds API repair.
- Approved D1 persistent historical/live implementation.
- Claude-to-ChatGPT migration.
- Cloudflare automation expansion.
- AI agents and richer external intelligence.

Small stale-code cleanup remains low priority. Live-Gameweek evidence gates remain unchanged.

Purpose: open, next and deferred work only. Historical stage and merge records are indexed in [Historical Records](HISTORICAL_RECORDS.md). Last reconciled: 10 August 2026.

## Historical baseline — D1 design closeout era

Retained as the scope/evidence record of that checkpoint. **This is not the current baseline.** Current repository head, verification and acceptance evidence are in [Project Context](PROJECT_CONTEXT.md) and `CLAUDE.md`.

- Repository head at that checkpoint: `main` `deb4ea26ba96112dba07660e23a61f04d4b6596d` (D1 design closeout through PR #101).
- Latest substantive application checkpoint at that time: DTR-1 PR #99, reviewed source `a15443f3de889561fd301c4aa1792d19f7b21c83`, generated head `b45f89baf45e12de09cdb1ad34826756e9e5378b`, merge `09e595c275b4f3614c09fb502291de6831813999`.
- Permanent repository verification at that time: run `31301475598`; 691 passed, 0 failed, 0 skipped, 0 cancelled; reachable-source reproduction; deterministic double build; root/deployable equality; exact source and complete build-input identity. The current suite is 835 passing.
- Transfers, Player Detail, Team and Fixtures tested paths are physically accepted on iPhone Safari.
- Leagues is accepted for the currently available pre-season data. Populated post-Gameweek acceptance remains deferred, not failed.
- Refresh-Load R1 is merged, deployed from `main` and physically accepted for every currently testable iPhone path. Live minute-history reuse awaits a completed checked Gameweek; Odds reuse awaits an enabled Odds configuration.

## Historical checkpoint — iPhone form-focus zoom correction

**Status:** complete, permanently verified, physically accepted and merged through PR #100 at `6e725485564a51ee2a17bc08e5c8bf95e8c2778c`. Retained below as the scope/evidence record.

**Scope:** render text, number, search, password, select and textarea controls at a minimum 16px so iPhone Safari does not auto-zoom on focus. Preserve browser pinch zoom and leave checkbox, file and range controls unchanged.

**Finalisation (as performed):** reviewed source/test/documentation changes were committed first, built with that reachable commit as `BUILD_COMMIT`, then the four generated deployables were committed. Permanent CI passed and focus, keyboard close, scale recovery and save behaviour were physically verified on the exact PR build before owner merge approval.

**Exclusions:** disabling zoom through viewport restrictions; body typography changes; control redesign; calculation, provider, data source, cache, persistence, route, navigation, security-origin or dependency changes; D1 and later roadmap work.

**Evidence:** physical DTR-1 testing showed the resource field triggered strong Safari zoom and remained enlarged after the keyboard closed. Source inspection found the 15px inherited control size across the app and a separate 15px global search override. Focused regressions require every current text-entry control family to be 16px while rejecting viewport zoom suppression.

## Completed checkpoint — DTR-1 Direct Team renderer

**Status:** complete and merged through PR #99 at `09e595c275b4f3614c09fb502291de6831813999` after 691/691 permanent tests, exact generated provenance, deterministic builds, populated physical iPhone Safari acceptance and explicit owner approval.

DTR-1 replaced the legacy Team render/reconstruct boundary with one direct renderer while preserving the accepted design, calculations, providers, data sources, routes and persistence. Its exact-device pass exposed the separate pre-existing form-focus zoom issue now isolated above.

## Completed checkpoint — A3-R0 durable build provenance

**Status:** complete and merged through PR #98 at `5ee735f864aaea2b6c423dfaeb267f18f5fe3b2f`.

The generated manifest now carries complete build-input identity. CI requires the generating commit to be a reachable ancestor, verifies exact source inputs and reproduces committed deployables before ordinary builds overwrite them. Permanent run `31283849251` passed 685/685 with deterministic builds and root/deployable equality. No application behaviour changed.

## Completed checkpoint — Refresh-Load R1

**Status:** complete and merged through PR #96 at `2ddb33c81fa2092598f290d60320364f2e0c35dc`. The first iPhone pass exposed and bounded an offline-disclosure defect; corrected source `d1b6ac0…` passed exact remote verification and the focused device retest before owner-approved merge.

**Objective:** stop unchanged validated supporting inputs from being fetched again on every eligible startup/foreground cycle while preserving honest age, fallback and manual-refresh behaviour.

**Why it matters:** a connected live-season cycle can otherwise make roughly 102 requests, including 95 detailed histories, even when its seven-day cache is fresh. Optional outages also repeat retry latency and can consume Odds quota.

**Exact scope:**

- minute histories require matching schema/model/season, validated player entries, an unchanged finished-and-data-checked fixture revision and a maximum seven-day age;
- load the active connected or manual squad first, then the unchanged 80-player research cohort, requesting only missing/invalid/due players;
- stop after two completely failed four-player batches and never advance successful timestamps on failure;
- persist validated normalised Understat team inputs only, refresh after a completed match or 24 hours and use a six-hour automatic failure cooldown;
- persist validated key-free derived Odds inputs only, refresh hourly within 48 hours of a deadline/kickoff or six-hourly otherwise, and exclude inputs older than six hours;
- persist secret-free Odds cooldown state for rejected keys, quota exhaustion and transient failure;
- let manual Load Data and explicit optional-source setting changes bypass provider cooldowns;
- keep all seven Provider Health states and show detailed-minute age/cache use separately from core Official FPL freshness;
- reconcile merged A2 status and regenerate deployables only through `build.mjs`.

**Exclusions:** Understat parser repair/replacement; atomic foreground-state redesign; core bootstrap reduction; new provider/endpoint/origin; gateway change; formula, model, ranking or recommendation change; navigation redesign; golden change.

**Risks:** historical player corrections can arrive without a fixture revision, cached Odds may be up to one/six hours old, and cooldowns can delay automatic recovery. The seven-day backstop, six-hour maximum Odds use and manual bypass bound those risks.

**Test requirements:** all 667 prior tests plus request count/order, revision/age, missing-only refresh, outage guard, unchanged timestamp, Understat/Odds cadence/cache/cooldown/key-free persistence and manual-bypass coverage; deterministic double build, root/deployable equality, exact manifest identity and remote CI. No test or golden may be removed or weakened.

**Physical acceptance:** online startup, exact build identity, short background return, Provider Health, manual refresh, cached repeat launch and in-app offline resilience passed on iPhone Safari. The focused corrected-build retest also passed: FPL showed Fallback, explicit offline copy and the unchanged saved-data time, and the same accepted build identity was verified after Pages returned to `main`. Minute-history reuse cannot yet be physically exercised before a completed Gameweek; Odds reuse cannot be exercised while Odds is disabled. Full offline hard reload is outside R1 because the static Pages shell is not available without a service worker.

**Completion evidence:** exact remote head `967856246a0c17972c43eaf444651bceb8b9f728`, reviewed/merged tree `fd40deff72c458286e77f44a66b79a0e720e700c`, permanent run `31265107597`, 681/681 tests, deterministic builds, root/deployable equality, exact manifest identity, focused physical retest and explicit owner merge approval. Parser repair, offline-shell/service-worker support and atomic-state work remain separate proposals.

## Next investigation — Data Architecture D1

**Status:** investigation/design only after DTR-1; implementation is not pre-approved.

**Objective:** define the correct historical and live data platform for Teamsheet. Compare Cloudflare D1, KV, R2, Durable Objects and Google Sheets against retention, query, update, cost, reliability, privacy, export and iPhone-operation requirements. Treat the existing Sheets as field prototypes; classify each field as persist, derive, export or remove. Google Sheets is a potential human-readable reporting/analysis layer, not an assumed core database.

**Boundary:** do not repair Understat or Odds, change providers/calculations, implement storage or migrate AI during the investigation. Present a field contract, architecture options, trade-offs, fallbacks, security and implementation approval gate first.

## Deferred live-evidence checkpoint — First live evidence and Leagues acceptance

**Status:** evidence-gated, not an implementation approval.

**Objective:** test the paths that pre-season Official FPL data cannot exercise.

**Exact scope:**

- execute the deferred Leagues script using published rank and standings;
- verify real movement, points gaps, nearby rivals, pairwise comparison and explicitly loaded selected-rival exposure;
- exercise relevant targeted pagination and stale/incomplete public-picks handling;
- confirm Stage 10 outcome capture and Official FPL `data_checked` handling;
- record observed defects without changing calculations.

**Exclusions:** projected League strategy, model tuning, new providers, full-league fan-out and synthetic closure of unavailable data paths.

**Risks:** provisional or corrected Official FPL facts could be mistaken for an app defect.

**Dependencies:** a completed Gameweek, official checking and a relevant connected League membership.

**Test requirements:** existing suite plus redacted fixture shapes for each real defect before a correction is approved.

**Physical acceptance:** all items in [Leagues pre-season acceptance](LEAGUES-PRESEASON-ACCEPTANCE.md), plus a weekly Team/Transfers/Fixtures smoke check.

**Approval gate:** investigation report first; every correction receives its own scope and approval.

## Proposed product checkpoint — Weekly action and primary navigation

**Status:** after live weekly use, not approved.

**Objective:** decide whether Fixtures remains a fifth primary destination and make the most important weekly action easier to identify.

**Why it matters:** current code and the approved 31 July blueprint use five tabs, while later product direction names Team, Transfers, Leagues and Settings. This is a product decision, not evidence that Fixtures is defective.

**Exact scope:** compare five-tab, contextual Fixtures and nested Fixtures wireflows; review the dormant hosted Ask affordance; prototype one honest weekly action summary while preserving every accepted capability.

**Exclusions:** model, provider, projected-rank or strategy changes.

**Risks:** hiding fixture planning, overloading Team, breaking route/back/focus behaviour or presenting projections as certainty.

**Dependencies:** real weekly usage evidence and Pritesh's explicit information-architecture choice.

**Test requirements:** routes, aliases, focus, dock, Settings and every feature entry point.

**Physical acceptance:** complete one-handed primary-navigation workflow on iPhone Safari.

**Approval gate:** approve the wireflow and exact wording before code.

## Proposed evidence checkpoint — Prospective calibration review

**Status:** after several completed Gameweeks; evaluation only.

**Objective:** assess expected points, expected minutes, captaincy, squad decisions and transfer horizons without automatic tuning.

**Exact scope:** approved metrics by relevant segment; probability reliability; frozen decision versus outcome; completed transfer horizons; provider-state comparison with existing safeguards.

**Exclusions:** automatic model updates, retrospective cherry-picking, small-sample accuracy claims and formula changes hidden inside analysis.

**Risks:** clustered samples, revised outcomes, incomplete horizons and observational provider comparisons.

**Dependencies:** enough immutable pre-deadline snapshots, complete/corrected outcomes and retained evidence.

**Test requirements:** evidence identity, schedule alignment, correction revision and deterministic export contracts.

**Physical acceptance:** review/export readability only; formula acceptance remains a separate model gate.

**Approval gate:** evidence report first. Every proposed input or formula change requires the full model approval package.

## Proposed later checkpoint — Google Sheets archive automation

**Status:** later, not approved.

**Objective:** create an idempotent downstream season archive after the manual export schema survives live use.

**Exact scope:** map existing review/export tables, append after official completion, append corrections without duplicating identities and retain manual export fallback.

**Exclusions:** Sheets as a live application database, model feedback, client-side OAuth secrets and dependency of weekly recommendations on Drive availability.

**Risks:** duplicate rows, partial writes, OAuth/token exposure, formula injection, quota failures and schema drift.

**Dependencies:** stable export schemas plus approved authentication, ownership, retention and cost design.

**Test requirements:** schema, idempotency, revision, injection, retry and fallback coverage.

**Physical acceptance:** export/sync status on iPhone and direct review of the target Sheet by Pritesh.

**Approval gate:** provider/security/cost proposal before implementation.

## Proposed later checkpoint — Cited football-news intelligence pilot

**Status:** later, shadow evaluation only unless separately promoted.

**Objective:** test whether predicted line-ups, press-conference news and non-Premier-League congestion materially improve expected-minutes decisions.

**Exact scope:** source/licensing review; provenance and freshness; player/team identity mapping; deterministic rest/congestion fields; citation-backed AI summary; prospective shadow capture and ablation.

**Exclusions:** uncited rumours, direct AI probability overrides, autonomous tuning and recommendation changes before evidence.

**Risks:** licensing, misinformation, late team-news changes, false confidence, cost and identity errors.

**Dependencies:** an approved provider/data contract and enough prospective outcomes.

**Test requirements:** schema, provenance, stale/contradiction fallback, identity mapping, ablation and reviewed golden examples.

**Physical acceptance:** explanation clarity, source visibility and degraded-state honesty if promoted into the product.

**Approval gate:** approve source and shadow evaluation first; separately approve any effect on recommendations.

## Deliberately deferred

- framework or package-manager migration;
- mass source/test/document directory moves;
- generated root/dist redesign;
- projection, scoring, fixture or simulation consolidation without numeric identity evidence;
- transfer optimiser rewrite or removal of the independent oracle;
- Mini-League migration-key removal without a deprecation plan;
- broad CSS/component abstraction;
- automatic AI tuning or unvalidated new providers;
- tactical protect/balanced/chase recommendations without a separately validated strategy model.

## Completed foundation summary

Stages 1–10.5, Teamsheet 2.0.1–2.0.7, the Official FPL gateway, exact persistent Transfers, UX-A1, UX-A2, Team populated acceptance, Fixtures populated acceptance, the Leagues pre-season checkpoint, Repository Truth A1, Safe Hygiene A2 and Refresh-Load R1 are complete and merged. Their exact records remain in the repository history and [Historical Records](HISTORICAL_RECORDS.md); they are not open implementation work.
