# PROJECTION_MODEL.md — projection engine reference
Purpose: precise record of the current deterministic projection engine, expected-minutes boundary and Stage 8 uncertainty layer.
Audience: anyone touching model code. Last updated: 2026-07-29.
Related: STAGE5-DESIGN.md, STAGE8-DESIGN.md, STAGE10-ITEM3.md, AUDIT.md, KNOWN_LIMITATIONS.md, DECISIONS.md, src/model/*.

## Versions and configuration
- `MODEL_VERSION`: `2.4.0`
- `RULES_VERSION`: `2026-27.3`
- `FPL_RULES`: official point values and thresholds for 2026/27
- `MINUTES_RULES`: Stage 4 history, decay, prior and confidence constants
- `SCORING_RULES`: Stage 5 rare-event and bonus shrinkage constants
- `TRANSFER_RULES`: Stage 6 optimiser limits and official squad rules
- `SIMULATION_RULES`: Stage 8 sample limits, thresholds and seed version
- `ODDS_RULES`: unvalidated market inclusion/staleness configuration

Stage 10.3 introduces separate metric schema/version constants in `evidence/metrics.mjs`; they are evidence/reporting contracts and are not model or rules versions.

## Deterministic layers
### Team strengths to match context
For team t against opponent o, venue-specific FPL strengths are league-average normalised:

`xGF = clamp(BASE_GOALS × attack ratio × opposition-defence ratio × venue tilt, 0.25, 4)`

`xGA` is calculated symmetrically. Team-level Understat blends at 45% when both sides have data. A sufficiently supported odds quote blends at 65%. These weights remain unvalidated under D-09.

### Expected minutes
`model/minutes.mjs` owns `{pStart,pAppear,p60,expMin,confidence,confidenceLabel,source}`.

Completed team fixtures are the season aggregate denominator. The newest eight detailed player opportunities use 0.9 recency decay and four-match shrinkage toward aggregate behaviour. Official availability is applied once. The no-history prior remains pStart 0.50, pAppear 0.70, p60 0.40, expMin 45 and confidence 0.20.

### Per-fixture expected points
For a live-season fixture:

- Appearance: `pAppear + p60`.
- Goals: non-negative xG/90 × expected-minutes factor × attacking context × positional goal points.
- Assists: non-negative xA/90 × expected-minutes factor × attacking context × 3.
- Clean sheet: clean-sheet probability × p60 × positional points.
- Goals conceded: Poisson expected value of one deduction per complete pair conceded for goalkeepers and defenders, using pitch-time-scaled xGA.
- Saves: goalkeeper saves/90, opponent xGA context and expected minutes feed the Poisson expected value of complete groups of three saves.
- Defensive contributions: appearance-weighted Poisson probability of reaching the official positional threshold, capped at two points.
- Bonus: awarded season bonus per estimated appearance, shrunk toward the positional population prior and multiplied by pAppear.
- Yellow cards, red cards, own goals, penalty misses and goalkeeper penalty saves: explicit sparse-event expectations with positional shrinkage.

All components are inspectable. Non-finite components are zeroed. Position calibration remains inherited and the final calibrated total is floored at zero.

## Pre-season fallback
Before the season is live, deterministic projections continue to use the established price-implied positional baseline, ownership tilt and fixture adjustment. Stage 8 detailed simulation is disabled in pre-season because this path does not expose sufficiently credible event-level rates for precise distributions.

## Multi-Gameweek projection and fixture runs
`projectXP` sums actual fixtures across the requested span. Doubles add both matches; blanks contribute zero. `runScore` sums real fixture values and divides by requested Gameweeks, with no arbitrary blank or double constants.

Squad review, best XI, captaincy, transfers, Ask context and backtest continue to consume `{total, perGW, games, parts}`. Stage 8 and Stage 10 do not change that contract.

## Stage 8 uncertainty layer
`model/simulation.mjs` sits downstream of deterministic scoring. It reconstructs five mutually exclusive minutes states from pStart, pAppear, p60 and expMin, then samples discrete scoring outcomes using the existing component expectations.

The approved minutes overlap is `min(pStart,p60)`. State means are bounded to legal ranges and adjusted to preserve expMin where feasible. Inconsistent inputs are labelled `reduced` rather than silently altering the probabilities.

Outputs include:

- sample mean;
- P10, P25, median, P75 and P90;
- appearance and 60-minute probabilities;
- blank probability (`points <= 2`);
- return probability (`points >= 5`);
- haul probability (`points >= 10`);
- mega-haul probability (`points >= 15`).

A repository-owned seeded PRNG makes equal inputs deterministic. Appearance is recorded separately from points, so a zero-point appearance remains an appearance for auto-subs and captaincy.

`model/squad-simulation.mjs` applies official formation constraints, ordered bench substitutions, reserve-goalkeeper handling and captain-to-vice fallback. It does not change deterministic best-XI selection or the transfer optimiser.

## Assumptions and limitations
Poisson and shrinkage constants remain judgement-based. Bonus is empirical rather than match-relative BPS simulation. Player attacking events are not strictly allocated from a full simulated team score. Tactical substitutions, detailed match state and second-yellow overlap are not fully modelled. Defensive-contribution history begins in 2025/26. Historical provider gaps prevent full retrospective probability calibration.

No prediction-accuracy or probability-calibration improvement is claimed. Prospective 2026/27 observations are required before such claims.

## Stage 10.1 snapshot interaction
Stage 10.1 observes this model; it does not alter it. For every player it stores the existing next-Gameweek component projection, horizon totals, expected-minutes outputs and deterministic live-season uncertainty summary. The raw Monte Carlo arrays are discarded after summarisation, while the unchanged 5,000 sample count, seed and percentiles/probabilities are retained.

The simulation implementation precomputes invariant fixture component expectations before sampling. This removes repeated deterministic work only: random seed, minutes states, Poisson/Bernoulli draws, scoring rules and summary thresholds are unchanged. Prospective outcomes are required before any calibration or accuracy conclusion.

The Stage 10.1 startup amendment changes only when a fully validated provider state becomes visible. It does not change any projection component, expected-minutes input, blend weight, simulation draw, captaincy choice or optimiser objective.

## Stage 10.2 outcome interaction
Stage 10.2 observes Official FPL results after the relevant deadline and does not feed them into runtime projections, expected minutes, calibration, uncertainty, captaincy, squad selection or transfers. Outcome records link to, but never rewrite, the frozen Stage 10.1 snapshot.

## Stage 10.3 metric interaction
Stage 10.3 evaluates the exact stored prediction surface; it does not rerun the production model after the deadline.

The player-points prediction is the frozen `outputs.players[].nextGameweek.total`. The simulation mean is not substituted. Minutes and probabilities use the frozen `{pStart,pAppear,p60,expMin}` values. Uncertainty uses the frozen P10/P25/P75/P90 and blank/return/haul/mega-haul probabilities. Frozen squad, captain and transfer evidence uses the exact stored player IDs, bench order, decision context, optimiser baseline, plans and horizon.

`evidence/metrics.mjs` deliberately does not import or invoke `projectXP`, `minutesEstimate`, `simulatePlayerGameweek` or `optimiseTransfers`. This prevents post-deadline inputs from leaking into an old prediction record. Corrections recompute only the descriptive evaluation from the already frozen prediction fields and a newer immutable Official FPL outcome revision.

Stage 10.3 retains the existing production probability thresholds exactly:

- blank: points `<=2`;
- return: points `>=5`;
- haul: points `>=10`;
- mega-haul: points `>=15`.

Their use as outcome labels is evaluation of current behaviour, not a threshold change.

Transfer evaluation uses realised plan points minus the frozen zero-transfer baseline and subtracts frozen hits. It does not treat the optimiser's judgement-based `0.5 × rollDifference` as realised FPL points and does not alter the optimiser formula itself.

Metric outputs are downstream descriptive evidence. They are not read by projections, expected minutes, calibration, simulation, squad selection, captaincy or transfer optimisation. No automatic model update exists. Any future formula, threshold or recommendation change requires a separately approved evidence and validation item.
