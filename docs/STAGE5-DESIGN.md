# Stage 5 — Scoring corrections

Status: owner-approved and implemented on draft PR #9; full repository verification pending.

## Objective

Make the live projection rule-aware where FPL applies stepped or threshold scoring, while preserving the public projection surface and avoiding unsupported match simulation.

## Approved formulas

- Appearance: `pAppear + p60`.
- Goals and assists: linear expected values using per-90 rates, `expMin/90` and attacking fixture context.
- Clean sheets: `P(clean sheet) × p60 × position points`.
- Goals conceded: Poisson expected value of one deduction per complete pair conceded while the player is expected on the pitch.
- Saves: Poisson expected value of one point per complete group of three saves.
- Defensive contributions: appearance-mixture Poisson probability of reaching the official positional threshold, capped at two points.
- Bonus: shrunk awarded bonus per estimated appearance, multiplied by `pAppear`, with no extra fixture multiplier.
- Yellow cards, red cards, own goals, penalty misses and penalty saves: explicit expected-value components using position-prior shrinkage for sparse events.
- Penalty order: used only to gate penalty-miss risk; no speculative xG/xA uplift.
- Fixture-run score: sum real fixture values across the requested Gameweeks and divide by Gameweeks; blanks contribute zero and doubles add both fixtures.

## Configuration

`FPL_RULES` records the 2026/27 scoring values. `SCORING_RULES` records the judgement-based shrinkage constants:

- rare-event prior: 10 matches;
- bonus prior: 8 appearances;
- minimum exposure: 0.5 played-90;
- active penalty orders: 1 and 2.

These constants are not validated optima and remain Stage 7 validation candidates.

## Explicit exclusions

No provider, fixture blend, calibration, captaincy, squad, transfer optimiser, walk-forward backtest, uncertainty simulation or Stage 9 UI change. No full BPS match-rank simulation. No prediction-accuracy claim.

## Validation contract

Focused tests cover rule configuration, Poisson helpers, stepped saves/conceding, defensive thresholds, sparse-event shrinkage, explicit negative events, penalty-role gating, empirical bonus and fixture-run blanks/doubles. Characterisation changes are limited to Stage 5-authorised scoring outputs and downstream totals.

## Remaining limitations

Poisson is an approximation; bonus is empirical rather than match-relative; clean-sheet retention after substitution remains simplified; second-yellow overlap cannot be separated from aggregate FPL fields; set-piece roles do not add attacking uplift; inherited positional calibration was fitted against the earlier model and is not refitted until Stage 7.
