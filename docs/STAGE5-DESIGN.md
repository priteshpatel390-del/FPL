# Stage 5 — Scoring corrections

Status: owner-approved, implemented and verified on draft PR #9; awaiting explicit owner merge approval.

## Objective
Make the live projection rule-aware where FPL applies stepped or threshold scoring, while preserving the public projection surface and avoiding unsupported match simulation.

## Approved formulas
- Appearance: `pAppear + p60`.
- Goals and assists: linear expected values using per-90 rates, expected minutes and attacking fixture context.
- Clean sheets: `P(clean sheet) × p60 × position points`.
- Goals conceded: Poisson expected value of one deduction per complete pair conceded while expected on the pitch.
- Saves: Poisson expected value of one point per complete group of three saves.
- Defensive contributions: appearance-mixture Poisson probability of reaching the official positional threshold, capped at two points.
- Bonus: awarded bonus per estimated appearance, shrunk toward the positional population and multiplied by `pAppear`, with no fixture multiplier.
- Yellow cards, red cards, own goals, penalty misses and penalty saves: explicit expected-value components using positional shrinkage.
- Penalty order: used only to gate penalty-miss risk; no speculative xG/xA uplift.
- Fixture-run score: sum actual fixture values across requested Gameweeks and divide by requested Gameweeks; blanks contribute zero and doubles add both fixtures.

## Appearance evidence used by bonus
Detailed current-season history is preferred and counts actual appearances. Where detailed history is unavailable, Stage 5 reuses the Stage 4 aggregate boundary: completed team matches × aggregate `pAppear`. A final no-fixture fallback uses the greater of starts and minutes/90. Scoring does not derive season appearances from minutes/60.

## Configuration
`FPL_RULES` records official 2026/27 values. `SCORING_RULES` records judgement-based constants: rare-event prior 10 played-90 exposures, bonus prior 8 appearances, minimum exposure 0.5 played-90, and active penalty orders 1 and 2. These are not validated optima and remain Stage 7 candidates.

## Bundler review correction
The Stage 5 module addition exposed a pre-existing custom-bundler weakness. The correction now strips complete single-line and multi-line imports and export lists, fails on unterminated declarations, rejects unsupported surviving module syntax and is guarded by direct fixture-based tests.

## Explicit exclusions
No provider, fixture blend, calibration, captaincy, squad, transfer optimiser, walk-forward backtest, uncertainty simulation or Stage 9 UI change. No full BPS match-rank simulation. No prediction-accuracy claim.

## Verification evidence
Verified source commit: `aee6d0fee7cc177622a046f37885b554013debbd`.

- Full suite against committed goldens: **241/241 passing**.
- Deterministic two-build comparison: passed for all generated artefacts.
- Independent CSP hash recomputation: passed.
- Generated artefacts embed the exact verified source commit as `BUILD_COMMIT`.
- Temporary verification workflow removed at `99d9cf8184589ef5ed79b8fdad2bff13a9f96552`.

## Remaining limitations
Poisson is an approximation; bonus is empirical rather than match-relative; clean-sheet retention after substitution remains simplified; second-yellow overlap cannot be separated from aggregate FPL fields; set-piece roles do not add attacking uplift; inherited positional calibration remains unrefitted until Stage 7.
