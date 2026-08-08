# CLAUDE.md — onboarding for every future development session

Read this first. GitHub `main` is the permanent source of truth; repository evidence overrides conversations, old uploads and generated deployables. Last reconciled: 8 August 2026.

## Current baseline

| Item | Current evidence |
|---|---|
| Repository baseline | `main` `2eee62b77291af06552e3d1952b6e1a6355ca7e0`, merge of Safe Hygiene PR #95 |
| Latest substantive application checkpoint | PR #92, merge `6f0501ffc0aff368f9a60aae6de0d552ec2c44a5`; exact reviewed head `130b0a298d4b21c2758e3199b9a82e2e3b0fc58f` |
| Permanent repository verification | Verify Teamsheet run `31256999867`: 667 passed, 0 failed, 0 skipped, 0 cancelled; deterministic byte-identical double build; root/deployable equality; exact manifest identity |
| Current implementation candidate | Refresh-Load R1 corrected exact source `d1b6ac0527d7b785962d7c7a02a7f266f42ba209`: 681/681 tests passed; deterministic double build, root/deployable equality and manifest identity verified; PR #96 republication and the focused offline-disclosure iPhone retest remain required |
| Application tree identity | Reviewed head and PR #92 merge share Git tree `455cc281b5a7528d37884326708a63d22fe54c35` |
| Physical iPhone Safari acceptance | Tested paths accepted for Transfers, Player Detail, Team, Fixtures and the Leagues pre-season experience |
| Deferred live-season acceptance | Published League rank/movement, populated standings and gaps, nearby/pairwise rivals, selected-rival squad/captain/vice/chip exposure, stale/incomplete rival handling and relevant large-league pagination |

[Leagues pre-season acceptance](docs/LEAGUES-PRESEASON-ACCEPTANCE.md) is authoritative for what was accepted and what remains deferred. The deferred checks are not defects while Official FPL has not published the required post-Gameweek facts.

## Current approval boundary

Repository Truth A1 and Safe Hygiene A2 are complete and merged through PRs #94 and #95. Refresh-Load R1 is approved for implementation on a separate branch and a draft pull request only:

- suppress valid minute-history requests until a checked-fixture revision or seven-day correction backstop changes;
- request only missing/due players, with the active squad first and a two-failed-batch outage guard;
- persist validated normalised Understat and key-free derived Odds inputs under the approved cadence and cooldown rules;
- disclose supporting-data cache age/use separately from core Official FPL freshness;
- preserve every model formula, provider endpoint, gateway rule and the existing complete-state orchestration.

Understat parser repair, atomic foreground-state replacement, core bootstrap reduction, new providers/endpoints and every formula or recommendation change are excluded. R1 requires exact automated verification, a draft PR and physical iPhone live/cached/stale/offline acceptance before merge. No branch may be merged without Pritesh's explicit approval.

The first PR #96 iPhone pass accepted online startup, build identity, short background return, Provider Health, manual refresh, cached repeat launch and in-app offline resilience. It also proved that a full offline hard reload cannot load the static application shell, which remains outside R1. The in-app offline refresh exposed misleading fresh/live FPL disclosure; source `d1b6ac0…` now stops before networking when Safari definitively reports offline, preserves the saved snapshot timestamp and labels FPL as Fallback. That narrow device path must be retested before merge.

## Owner and communication

Pritesh is a non-developer but rigorous reviewer who primarily works from an iPhone. Lead with the outcome, then evidence, risks and recommendation. Distinguish fact, inference, proposal and limitation. Never claim success, accuracy, deployment or physical-device acceptance without evidence.

## Read in this order

1. [Project Context](docs/PROJECT_CONTEXT.md)
2. [Architecture](docs/ARCHITECTURE.md)
3. [Decisions](docs/DECISIONS.md)
4. [Roadmap](docs/ROADMAP.md)
5. [Known Limitations](docs/KNOWN_LIMITATIONS.md)
6. [Teamsheet 2.0 Product Blueprint](docs/TEAMSHEET2-PRODUCT-BLUEPRINT.md)
7. The current checkpoint design or acceptance record
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
- Preserve deterministic builds, exact `BUILD_COMMIT` identity, root/deployable equality and generated-file provenance.
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
