# PROJECT_CONTEXT.md
Purpose: master overview — the first document any new developer or Claude session reads after CLAUDE.md.
Audience: anyone joining the project. Last updated: 2026-07-28. Related: ARCHITECTURE.md, ROADMAP.md, DECISIONS.md.

## What this is
**Teamsheet — FPL decision desk.** A single-file, mobile-first web app that helps one manager (the
owner, Pritesh) make Fantasy Premier League decisions: fixture difficulty, per-position projected
points, squad review with best-XI and captaincy, transfer costing, mini-league effective ownership,
and an on-device backtest that calibrates the model against real historical seasons.

## Current status (2026-07-28)
- Live at https://priteshpatel390-del.github.io/FPL/ (GitHub Pages, repo `priteshpatel390-del/FPL`).
- Season 2026-27 starts 21 Aug 2026; app is in pre-season mode (price-implied projections; squad/
  league features dormant until GW1 picks publish).
- Codebase refactored into ES modules with a deterministic bundler; Stage 3.5 is merged through PR #3.
  The implementation record reports 194 automated tests passing and deterministic builds.
- Backtested on 2025-26: r=0.80, ±0.5 pts/GW (aggregate method — superseded by walk-forward in a
  future stage), per-position calibration applied (notably FWD ×1.17).
- Stage 3 (security hardening) is IN PROGRESS. Items 1–5 are merged. Stage 3.6 AI/Markdown
  sanitisation is not implemented and requires design approval before work begins.

## Goals & priorities (owner-stated, in order)
1. Reliable expected-points projections  2. Accurate expected-minutes  3. Clean-sheet / attacking
probabilities  4. Correct availability info  5. Sustainable, legal data collection  6. Graceful
fallback  7. Avoid complexity and noisy data. Overriding principle: **the simplest reliable data
stack that produces accurate decisions**, not the most features.

## Design philosophy
- Staged development: each stage isolated, tested, independently reviewable and deployable.
- Honesty over polish: known-incorrect behaviour is pinned in tests and documented, never hidden.
- No claimed accuracy improvement without out-of-sample evidence.
- Formula changes require prior review (existing formula → proposed → inputs → fallback →
  assumptions → limitations → validating tests).
- Mobile-first; owner operates entirely from an iPhone.

## Platform / stack / deployment
Vanilla JS ES modules, zero runtime dependencies, no framework (see DECISIONS D-02). Node ≥18 for
build/tests (node:test; no npm registry access assumed). Build: `node build.mjs` → `dist/index.html`
(single deployable). Deploy: owner uploads `dist/index.html` as `index.html` via GitHub web UI on
mobile. The app also runs inside Claude's artifact preview (keyless Ask tab works only there).

## Completed / current / upcoming
Completed: Stage 1 (characterisation tests + data audit), SEC-1 hot-fix, Stage 2 (module
extraction, provider registry, provenance, build identity), the documentation handover, and Stage 3
items 1–5 including Provider Health and DOM-builder rendering. Current: Stage 3 security hardening.
Next: Stage 3.6 AI/Markdown sanitisation design approval, then remaining odds-key/CSP work → owner
architecture review → Stages 4–9 modelling and UI (ROADMAP.md).

## Major risks
Public CORS-relay dependence for FPL/Understat transport (R1); undocumented FPL API schema drift
(R2); Understat scraping fragility and ToS-grey status (R3); odds free-tier quota 500 credits/mo ≈
250 calls (R4); model accuracy unproven out-of-sample under the current aggregate backtest (R5);
single-maintainer, phone-only ops (R6).

## Known assumptions
FPL API remains publicly reachable and tolerated; vaastav archive remains available (pinning owed,
KNOWN_LIMITATIONS BT-1); owner accepts client-side odds key temporarily; Anthropic key is BANNED
client-side (serverless is a prerequisite for hosted AI); GitHub Pages remains the host until
serverless is required.
