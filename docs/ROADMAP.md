# ROADMAP.md — current and proposed checkpoints

Purpose: open, next and deferred work only. Historical stage and merge records are indexed in [Historical Records](HISTORICAL_RECORDS.md). Last reconciled: 8 August 2026.

## Baseline

- Repository baseline at this checkpoint: `main` `2eee62b77291af06552e3d1952b6e1a6355ca7e0` (Safe Hygiene A2 merge through PR #95).
- Latest substantive application checkpoint: PR #92, merge `6f0501ffc0aff368f9a60aae6de0d552ec2c44a5`, exact reviewed head `130b0a298d4b21c2758e3199b9a82e2e3b0fc58f`.
- Permanent repository verification: 667 passed, 0 failed, 0 skipped, 0 cancelled; deterministic double build; root/deployable equality; exact manifest identity.
- Refresh-Load R1 corrected exact source `d1b6ac0527d7b785962d7c7a02a7f266f42ba209`: 681/681 tests passed with deterministic double-build, root/deployable and manifest-identity verification before republication.
- Transfers, Player Detail, Team and Fixtures tested paths are physically accepted on iPhone Safari.
- Leagues is accepted for the currently available pre-season data. Populated post-Gameweek acceptance remains deferred, not failed.
- Refresh-Load R1 is approved for implementation and draft PR #96. Merge remains unapproved pending corrected exact remote verification and the focused offline-disclosure iPhone retest.

## Current approved checkpoint — Refresh-Load R1

**Status:** implemented as a review candidate on `agent/refresh-load-r1`; the first iPhone pass exposed and bounded an offline-disclosure defect, corrected source `d1b6ac0…` is locally verified, draft republication is approved and merge remains owner-gated.

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

**Physical acceptance:** online startup, exact build identity, short background return, Provider Health, manual refresh, cached repeat launch and in-app offline resilience passed on iPhone Safari. Minute-history reuse cannot yet be physically exercised before a completed Gameweek; Odds reuse cannot be exercised while Odds is disabled. The first offline in-app refresh exposed misleading fresh/live disclosure; the corrected build must show FPL Fallback, explicit offline copy and the unchanged saved-data time. Full offline hard reload is outside R1 because the static Pages shell is not available without a service worker.

**Approval gate:** republish the corrected exact tree to draft PR #96 and verify its remote head/CI. Pritesh then performs the focused offline-disclosure retest and explicitly approves merge. Parser repair, offline-shell/service-worker support and atomic-state work remain separate proposals.

## Proposed after-GW1 checkpoint — First live evidence and Leagues acceptance

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

## Proposed structural checkpoint — Direct Team renderer

**Status:** later, not approved.

**Objective:** replace the legacy-render-then-reconstruct Team boundary with one renderer while preserving accepted output.

**Why it matters:** this is the clearest substantial maintainability and duplicate-DOM opportunity, but it touches a physically accepted path.

**Exact scope:** one Team renderer using existing squad, pitch and decision primitives; explicit dependencies; itemised removal of superseded Team DOM manipulation only after equivalence evidence.

**Exclusions:** new Team features, calculation changes, transfer recommendations, navigation changes and visual redesign.

**Risks:** ordering, focus, manual squad, unavailable-label wrapping, Player Detail or mobile layout regression.

**Dependencies:** stable live data and a frozen behaviour/DOM contract.

**Test requirements:** Team, manual-squad, startup, Player Detail, navigation and security suites; add rendered-behaviour coverage; run the complete build gate.

**Physical acceptance:** full populated Team flow on iPhone Safari, including manual squad and Player Detail.

**Approval gate:** approve the before/after ownership map and exact deletion ledger before implementation.

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

Stages 1–10.5, Teamsheet 2.0.1–2.0.7, the Official FPL gateway, exact persistent Transfers, UX-A1, UX-A2, Team populated acceptance, Fixtures populated acceptance, the Leagues pre-season checkpoint, Repository Truth A1 and Safe Hygiene A2 are complete and merged. Their exact records remain in [Historical Records](HISTORICAL_RECORDS.md); they are not repeated here as open work.
