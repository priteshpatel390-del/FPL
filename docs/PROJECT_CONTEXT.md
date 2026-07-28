# PROJECT_CONTEXT.md
Purpose: master overview — the first document any new developer or session reads after CLAUDE.md.
Audience: anyone joining the project. Last updated: 2026-07-28. Related: ARCHITECTURE.md, ROADMAP.md, DECISIONS.md.

## What this is
**Teamsheet — FPL Decision Desk.** A single-file, mobile-first web app that helps one manager, Pritesh, make Fantasy Premier League decisions: fixture difficulty, projected points, squad review, best XI, captaincy, transfer costing, mini-league effective ownership and on-device model evaluation.

## Current status
- Live on GitHub Pages from repository `priteshpatel390-del/FPL`.
- The 2026/27 season starts 21 August 2026; the app remains in pre-season mode until live GW1 data exists.
- Stage 3 security/provider hardening is complete.
- Stage 4 expected minutes is complete and merged through PR #8 at `eb08c7af43a2e8040ea65064fc725ba8d1778882`.
- Stage 5 scoring corrections are implemented and verified on draft PR #9. Source commit `aee6d0fee7cc177622a046f37885b554013debbd` passed 241/241 tests, deterministic builds and independent CSP verification. Generated artefacts embed that exact identity; the temporary workflow has been removed.
- The only remaining Stage 5 gate is explicit owner merge approval. Stage 6 must not begin before merge.
- The historical 2025/26 aggregate backtest result, r=0.80 and approximately ±0.5 points/GW, is method-flattered and must not be presented as validated out-of-sample accuracy.

## Goals and priorities
1. Reliable expected-points projections.
2. Accurate expected minutes.
3. Sound clean-sheet and attacking probabilities.
4. Correct availability information.
5. Sustainable, legal data collection.
6. Graceful fallback.
7. Avoid unnecessary complexity and noisy data.

The overriding principle is the simplest reliable data stack that supports good decisions, not the largest feature set.

## Design philosophy
- Each stage is isolated, tested, reviewable and deployable.
- Known limitations are documented rather than hidden.
- Formula changes require prior review and explicit approval.
- No prediction-improvement claim without genuine holdout evidence.
- Mobile-first operation is mandatory because the owner primarily uses an iPhone.

## Platform, stack and deployment
Vanilla JavaScript ES modules, no framework and zero runtime dependencies. Node 18 or newer runs the custom deterministic bundler and `node:test` suite. `node build.mjs` emits `dist/index.html`, the single deployable uploaded through the GitHub web interface. The custom bundler strips complete static module declarations, rejects surviving module syntax and embeds model, rules, source-hash and commit identity.

## Completed, current and next
Completed: Stage 1 characterisation/audit, SEC-1, Stage 2 modularisation, repository handover, Stage 3 security/provider hardening and Stage 4 expected minutes.

Current: Stage 5 scoring corrections on draft PR #9, verified and awaiting owner merge approval.

Next after merge approval: Stage 6 transfer optimiser.

## Major risks
Public relay dependence for some provider traffic; undocumented FPL schema drift; Understat scraping fragility and terms-of-service uncertainty; limited odds quota; model accuracy not yet proven out of sample; and single-maintainer phone-first operations.

## Known assumptions
The public FPL API and vaastav archive remain available; the historical dataset pin is still owed for Stage 7; the owner accepts the temporary client-side odds-key posture; Anthropic keys remain banned client-side; GitHub Pages remains the host until an approved serverless trigger.
