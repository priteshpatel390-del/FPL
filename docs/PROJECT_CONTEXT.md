# PROJECT_CONTEXT.md
Purpose: master overview — the first document any new developer or session reads after CLAUDE.md.
Audience: anyone joining the project. Last updated: 2026-07-29. Related: ARCHITECTURE.md, ROADMAP.md, DECISIONS.md.

## What this is
**Teamsheet — FPL Decision Desk.** A single-file, mobile-first web app that helps one manager, Pritesh, make Fantasy Premier League decisions: fixture difficulty, projected points, squad review, best XI, captaincy, transfer costing, mini-league effective ownership and on-device model evaluation.

## Current status
- Live on GitHub Pages from repository `priteshpatel390-del/FPL`.
- The 2026/27 season starts 21 August 2026; the app remains in pre-season mode until live GW1 data exists.
- Stages 1–8 and Stage 9 checkpoints 9.1–9.5 are complete and merged.
- Stage 9.5 merged through PR #24 at `a5ac5fcc12bb492948365851587d4e1cd2f30301`, adding Settings and globally visible Provider Health without changing provider behaviour.
- Stage 9.6 — Style migration, CSP and final polish is implemented and verified on draft PR #25 with 313 passing tests, deterministic builds, zero inline style attributes and browser-reviewed mobile/desktop layouts; owner review and explicit merge approval remain required.
- The historical 2025/26 aggregate r=0.80 result is method-flattered and must not be presented as validated out-of-sample accuracy.

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
- Stage 9 presentation should remain minimalist, polished and football-first: decisions lead, secondary diagnostics stay subordinate.

## Platform, stack and deployment
Vanilla JavaScript ES modules, no framework and zero runtime dependencies. Node 18 or newer runs the custom deterministic bundler and `node:test` suite. `node build.mjs` emits `dist/index.html`, the single deployable uploaded through the GitHub web interface. The custom bundler strips complete static module declarations, rejects surviving module syntax and embeds model, rules, source-hash and commit identity.

## Completed, current and next
Completed: Stage 1 characterisation/audit, SEC-1, Stage 2 modularisation, repository handover, Stage 3 security/provider hardening, Stage 4 expected minutes, Stage 5 scoring corrections, Stage 6 transfer optimiser, Stage 7 walk-forward backtest, Stage 8 uncertainty/squad simulation and Stage 9 checkpoints 9.1–9.5.

Current: Stage 9.6 implementation and owner review on draft PR #25. The application is class-only at the style-attribute boundary, the CSP concession is removed and final mobile/desktop review has passed.

Next after Stage 9.6 merge: Stage 9 is complete; operational focus moves to live-season prospective logging and evidence-led future roadmap decisions.

## Major risks
Public relay dependence for some provider traffic; undocumented FPL schema drift; Understat scraping fragility and terms-of-service uncertainty; limited odds quota; model accuracy not fully proven out of sample; simulation probability calibration still prospective; and single-maintainer phone-first operations.

## Known assumptions
The public FPL API and pinned vaastav archive remain available; the owner accepts the temporary client-side odds-key posture; Anthropic keys remain banned client-side; GitHub Pages remains the host until an approved serverless trigger; and detailed Stage 8 simulation remains disabled in pre-season rather than manufacturing precise distributions from the price baseline.