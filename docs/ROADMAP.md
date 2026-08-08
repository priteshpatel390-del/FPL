# ROADMAP.md — current and proposed checkpoints

Purpose: open, next and deferred work only. Historical stage and merge records are indexed in [Historical Records](HISTORICAL_RECORDS.md). Last reconciled: 8 August 2026.

## Baseline

- Repository baseline at this checkpoint: `main` `cdc3cb709d97b858f29234678e7860baab918b78` (Repository Truth A1 merge through PR #94).
- Latest substantive application checkpoint: PR #92, merge `6f0501ffc0aff368f9a60aae6de0d552ec2c44a5`, exact reviewed head `130b0a298d4b21c2758e3199b9a82e2e3b0fc58f`.
- Repository verification: 667 passed, 0 failed, 0 skipped, 0 cancelled — the unchanged 664 application tests plus three documentation-integrity tests; deterministic double build; root/deployable equality; exact manifest identity.
- Transfers, Player Detail, Team and Fixtures tested paths are physically accepted on iPhone Safari.
- Leagues is accepted for the currently available pre-season data. Populated post-Gameweek acceptance remains deferred, not failed.
- Safe Hygiene A2 is approved; no product, calculation, provider-behaviour or infrastructure checkpoint is approved.

## Current approved checkpoint — Safe Hygiene A2

**Status:** approved for a separate maintenance pull request. Draft publication and merge remain owner-gated.

**Objective:** close A1's post-merge status gap and remove only the audit's smallest proven-unused source/tool items without changing behaviour.

**Why it matters:** current guidance still describes merged A1 as pending, while a one-off Stage 2 migration tool and a handful of declaration-only names add avoidable repository and bundle noise.

**Exact scope:**

- record PR #94, merge `cdc3cb709d97b858f29234678e7860baab918b78` and the 667-test repository baseline in affected canonical status;
- correct the remaining Blueprint navigation sentence to Team, Transfers, Fixtures, Leagues and Settings;
- delete obsolete 75-line `tools/split.py`;
- remove declaration-only `reviewRound`, `reviewSegmentValue` and provider-registry `scale`;
- remove unused transport `BASE` and its export;
- remove the unused `S`, Fixtures `num`, and Odds `num`/`clamp` imports;
- regenerate tracked deployables only through `build.mjs`.

**Exclusions:** every additional deletion; provider acquisition or fallback behaviour; data sources; formulas; routes; navigation; persistence; Cloudflare; Pages architecture; dependencies; directory moves; CSS; state; harness/test-only helpers; UI rendering; and golden changes.

**Risks:** mistaking an externally consumed export for dead code, allowing generated files to drift from source, or overstating behaviour-neutral maintenance as a product or security improvement.

**Test requirements:** all 667 existing tests, focused provider/review/build checks, two exact-identity production builds, root/deployable equality, exact manifest identity and exact changed-file review. No test or golden may be removed or weakened.

**Physical acceptance:** no iPhone retest is required because rendered and interactive behaviour is unchanged.

**Approval gate:** Pritesh reviews the draft pull request and explicitly approves merge. Live refresh-load hardening is not included.

## Proposed before-GW1 checkpoint — Live refresh-load hardening

**Status:** proposed, not approved.

**Objective:** prevent detailed and optional data acquisition from unnecessarily delaying or repeatedly loading the weekly workflow.

**Why it matters:** once live-season conditions activate, detailed minute histories can create roughly 80–95 requests during an eligible refresh, while a configured seven-day cache-age rule is not currently enforcing runtime freshness.

**Exact scope:**

- measure startup time and request counts with live, cached and unavailable data;
- define freshness rules for detailed minute histories, Understat and Odds;
- preserve honestly labelled cached/stale fallback;
- prioritise the current squad and decision-relevant candidates if evidence supports it;
- retain manual refresh and current Provider Health consequences.

**Exclusions:** expected-minutes formulas, projection weights, provider addition, new endpoints, Team/Transfers redesign and gateway generalisation.

**Risks:** data could become older than intended near a deadline, or a new policy could hide a provider failure.

**Dependencies:** real live-season measurements and an approved acquisition/fallback contract.

**Test requirements:** request counts, cache age, stale/fallback behaviour, foreground resume, provider state and startup ordering, followed by the permanent full verification gate.

**Physical acceptance:** iPhone startup plus Team, Transfers, Player Detail and Provider Health under live, cached and offline scenarios.

**Approval gate:** present the current and proposed acquisition policy, sources, fallback, limitations, cost and measured before/after evidence before implementation.

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

Stages 1–10.5, Teamsheet 2.0.1–2.0.7, the Official FPL gateway, exact persistent Transfers, UX-A1, UX-A2, Team populated acceptance, Fixtures populated acceptance, the Leagues pre-season checkpoint and Repository Truth A1 are complete and merged. Their exact records remain in [Historical Records](HISTORICAL_RECORDS.md); they are not repeated here as open work.
