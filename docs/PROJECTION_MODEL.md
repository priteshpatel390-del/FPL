# PROJECTION_MODEL.md — projection engine reference
Purpose: precise record of the current Stage 5 projection engine.
Audience: anyone touching model code. Last updated: 2026-07-28.
Related: STAGE5-DESIGN.md, AUDIT.md, KNOWN_LIMITATIONS.md, DECISIONS.md, src/model/*.

## Versions and configuration
- `MODEL_VERSION`: `2.2.0`
- `RULES_VERSION`: `2026-27.1`
- `FPL_RULES`: official point values and thresholds for 2026/27
- `MINUTES_RULES`: Stage 4 history, decay, prior and confidence constants
- `SCORING_RULES`: Stage 5 rare-event and bonus shrinkage constants
- `ODDS_RULES`: unvalidated market inclusion/staleness configuration

## Layer 1 — team strengths to match context
For team t against opponent o, venue-specific FPL strengths are league-average normalised:

`xGF = clamp(BASE_GOALS × attack ratio × opposition-defence ratio × venue tilt, 0.25, 4)`

`xGA` is calculated symmetrically. Team-level Understat blends at 45% when both sides have data. A sufficiently supported odds quote blends at 65%. These weights remain unvalidated under D-09.

The context exposes `xGF`, `xGA`, `P(clean sheet) = exp(-xGA)`, attacking multiplier and defensive multiplier.

## Layer 2 — expected minutes
`model/minutes.mjs` owns `{pStart,pAppear,p60,expMin,confidence,confidenceLabel,source}`.

Completed team fixtures are the season aggregate denominator. The newest eight detailed player opportunities use 0.9 recency decay and four-match shrinkage toward aggregate behaviour. Official availability is applied once. The no-history prior remains pStart 0.50, pAppear 0.70, p60 0.40, expMin 45 and confidence 0.20.

Logical guards enforce pStart ≤ pAppear, p60 ≤ pAppear, probabilities in 0–1 and expected minutes in 0–90.

## Layer 3 — per-fixture expected points
For a live season fixture:

- Appearance: `pAppear + p60`.
- Goals: non-negative xG/90 × expected-minutes factor × attacking context × positional goal points.
- Assists: non-negative xA/90 × expected-minutes factor × attacking context × 3.
- Clean sheet: clean-sheet probability × p60 × positional points.
- Goals conceded: Poisson expected value of one deduction per complete pair conceded for goalkeepers and defenders, using pitch-time-scaled xGA.
- Saves: goalkeeper saves/90, opponent xGA context and expected minutes feed the Poisson expected value of complete groups of three saves.
- Defensive contributions: appearance-weighted Poisson probability of reaching the official positional threshold, capped at two points.
- Bonus: awarded season bonus per estimated appearance, shrunk toward the positional population prior and multiplied by pAppear. No fixture multiplier is added.
- Yellow cards, red cards, own goals, penalty misses and goalkeeper penalty saves: explicit sparse-event expectations with positional shrinkage.
- Penalty order gates penalty-miss treatment only; set-piece metadata does not add speculative attacking uplift.

Detailed history appearance counts are preferred for the bonus denominator. Without detailed history, aggregate appearances reuse the Stage 4 model: completed team matches × aggregate pAppear. This prevents the scoring layer from deriving impossible appearances from minutes/60.

All components are inspectable. Non-finite components are zeroed. Position calibration remains inherited and the final calibrated total is floored at zero.

## Pre-season fallback
Before the season is live, projections continue to use the established price-implied positional baseline, ownership tilt and fixture adjustment. Neutral expected-minutes priors do not replace that path.

## Multi-Gameweek projection and fixture runs
`projectXP` sums actual fixtures across the requested span. Doubles add both matches; blanks contribute zero. `runScore` sums real fixture values and divides by requested Gameweeks, with no arbitrary blank or double constants.

Squad review, best XI, captaincy, transfers, Ask context and backtest continue to consume `{total, perGW, games, parts}`.

## Assumptions and limitations
Poisson and shrinkage constants are judgement-based pending Stage 7. Bonus is empirical rather than match-relative BPS simulation. Clean-sheet retention after substitution remains simplified. Second-yellow overlap cannot be separated from aggregate FPL fields. Defensive-contribution history begins in 2025/26. Existing positional calibration was fitted against the prior scoring model and is intentionally not refitted until walk-forward validation.

No prediction-accuracy improvement is claimed.
