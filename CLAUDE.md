# CLAUDE.md — onboarding for every future development session

Read this first. GitHub `main` is the permanent source of truth; repository evidence overrides conversations, old uploads and generated deployables. Last reconciled: 8 August 2026.

## Current baseline

| Item | Current evidence |
|---|---|
| Repository baseline | `main` `cdc3cb709d97b858f29234678e7860baab918b78`, merge of documentation/test-infrastructure PR #94 |
| Latest substantive application checkpoint | PR #92, merge `6f0501ffc0aff368f9a60aae6de0d552ec2c44a5`; exact reviewed head `130b0a298d4b21c2758e3199b9a82e2e3b0fc58f` |
| Permanent repository verification | Verify Teamsheet run `31255585665`: 667 passed, 0 failed, 0 skipped, 0 cancelled — the unchanged 664 application tests plus three documentation-integrity tests; deterministic byte-identical double build; root/deployable equality; exact manifest identity |
| Application tree identity | Reviewed head and PR #92 merge share Git tree `455cc281b5a7528d37884326708a63d22fe54c35` |
| Physical iPhone Safari acceptance | Tested paths accepted for Transfers, Player Detail, Team, Fixtures and the Leagues pre-season experience |
| Deferred live-season acceptance | Published League rank/movement, populated standings and gaps, nearby/pairwise rivals, selected-rival squad/captain/vice/chip exposure, stale/incomplete rival handling and relevant large-league pagination |

[Leagues pre-season acceptance](docs/LEAGUES-PRESEASON-ACCEPTANCE.md) is authoritative for what was accepted and what remains deferred. The deferred checks are not defects while Official FPL has not published the required post-Gameweek facts.

## Current approval boundary

Repository Truth A1 is complete and merged through PR #94. Safe Hygiene A2 is approved for a separate branch and draft pull request only:

- reconcile canonical status with the PR #94 merge and 667-test repository baseline;
- delete the obsolete Stage 2 `tools/split.py` migration script;
- remove only `reviewRound`, `reviewSegmentValue`, provider-registry `scale`, transport `BASE` and the four approved unused imports;
- regenerate deployables only through `build.mjs` and preserve exact build identity.

A2 authorises no provider behaviour, data source, calculation, route, navigation, persistence, Cloudflare, security-boundary or user-experience change. Live refresh-load hardening, product work and every additional deletion remain separately gated. No branch may be merged without Pritesh's explicit approval.

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
