# Stage 1 — Characterisation tests (complete)

## What changed
- No application code changed. app.js / index.html byte-identical to the previous deploy.
- Added `tests/harness.mjs` (stubbed-DOM loader + deterministic synthetic league),
  `tests/characterisation.test.mjs` (77 assertions via node:test),
  `tests/golden.json` (pinned outputs, 32 stable + 6 expected-to-change keys),
  `run-tests.sh`, `docs/AUDIT.md` (full data-source audit).
- Runner: `./run-tests.sh` or `node --test tests/*.test.mjs`. Node ≥18, zero dependencies.
- Golden regeneration (deliberate act only): `UPDATE_GOLDEN=1 node --test tests/*.test.mjs`, then review the diff.

## How the suite is organised
- `stable` — behaviour Stage 2 extraction must preserve exactly (fixture model incl. Understat/odds
  blending, per-position projections and their component parts, availability scaling, calibration
  application, pre-season fallback, best-XI legality and totals, sell-price rounding, Poisson/odds
  maths, CSV parsing, name mapping, Understat page decoding).
- `expectedToChange` — behaviour pinned but known-incorrect, keyed to docs/AUDIT.md issue ids
  (MIN1 crude minutes model, DEN1 gameweek-as-denominator, SCOR1 linear stepped-rule
  approximations, SCOR2 BPS-derived bonus, FIX1 arbitrary blank/double constants). When the fixing
  stage lands, the golden values for that id are expected to move; update them as part of that
  stage's review, not silently.
- LEAK-1 (calibration fitted on reported sample) and TRF-1 (unvalidated "all free" claim) are
  procedural/UI behaviours — registered in AUDIT.md, addressed in Stages 7 and 6 respectively.

## Assumptions
- The synthetic league (20 teams, linear strength spread, fixed archetypes) exercises the value
  ranges the real data hits; golden values are model outputs on that world, not real-world truths.
- Floating-point pinned to 6 dp; Node 22 used; determinism verified across repeated runs.

## Data limitations carried forward
- Defensive-contribution history exists only from 2025-26 → components split at validation time into
  multi-season-validated vs 2025-26-only vs provisional (per owner instruction).
- Historical bookmaker odds unavailable on free tier → odds-layer ablation must be prospective
  (logged through 2026-27), not historical. Odds weight remains labelled unvalidated until then.

## Immediate flag requiring no stage to wait
- SEC-1: odds key currently transits public CORS relays in the fallback path (app.js:221).
  Scheduled for Stage 3, but if you want it hot-fixed into the current deployable ahead of the
  refactor, say so — it is a two-line change (drop relay fallback for the odds call).

## Next
Stage 2 — module extraction (state, storage/cache-versioning, providers: fpl/understat/odds/claude,
fixture model, minutes model, scoring, xP, calibration/backtest, squad selection, transfer
optimisation, views, format/sanitise) + deterministic build script emitting index.html. Behaviour
frozen by this suite; the only allowed diffs are the expected-to-change register, and none of those
are scheduled for Stage 2.
