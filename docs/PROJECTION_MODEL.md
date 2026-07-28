# PROJECTION_MODEL.md — projection engine reference
Purpose: precise record of the CURRENT projection engine on the Stage 4 branch.
Audience: anyone touching model code — read fully first. Last updated: 2026-07-28.
Related: STAGE4-DESIGN.md, AUDIT.md, KNOWN_LIMITATIONS.md, DECISIONS D-09/D-11, src/model/*.

## Constants (src/config.mjs)
GOAL_PTS {GKP/DEF:6, MID:5, FWD:4} · CS_PTS {GKP/DEF:4, MID:1, FWD:0} · ASSIST_PTS 3 ·
DC_THRESH {DEF:10, MID/FWD:12} · BASE_GOALS 1.42 · HOME_TILT 1.10 · calibration S.calib[pos].
MODEL_VERSION is 2.1.0. MINUTES_RULES records the approved Stage 4 history, decay, prior and
confidence constants.

## Layer 1 — team strengths → match context
For team t vs opponent o, venue-specific FPL strengths, league-average normalised:
`xGF = clamp(BASE · (tAtk/avgAtk) · (avgDefOpp/oDef) · tilt, 0.25, 4)` with home tilt 1.10 and
symmetric xGA. Understat blends 45% where both teams are present; confident odds blend 65% where a
quote matches. These weights remain unvalidated configuration under D-09.

## Stage 4 expected minutes (model/minutes.mjs)
The former `season minutes / current GW` formula is removed. Completed team fixtures are the aggregate
denominator. Detailed current-season histories are loaded for the owner's squad/manual players and a
deterministic approximately top-80 cohort by ownership, price and player id.

For the newest eight completed player opportunities, `w_i = 0.9^i`. Each output is shrunk toward its
season aggregate with a four-match prior:

`estimate = (sum(w_i * observed_i) + 4 * aggregateEstimate) / (sum(w_i) + 4)`

Outputs are:
- `pStart`: probability of starting.
- `pAppear`: probability of any appearance.
- `p60`: probability of reaching 60 minutes.
- `expMin`: expected minutes.
- `confidence`: evidence-quality heuristic, plus High/Medium/Low label and detailed/aggregate/prior
  source. It is not a calibrated probability of correctness.

Logical guards enforce pStart <= pAppear, p60 <= pAppear, probabilities in 0–1 and expMin in 0–90.
Official FPL availability status/chance is applied exactly once. No-history fallback is pStart 0.50,
pAppear 0.70, p60 0.40, expMin 45 and confidence 0.20. Detailed-history failure uses validated cache,
then aggregate fields, then this prior.

## Per-fixture expected points
Appearance points are now `pAppear + p60`; attacking, goals-conceded, saves, bonus and card components
use `expMin/90`; clean-sheet and defensive-action eligibility use p60. All other component formulas,
fixture layers, calibration and consumers are unchanged from model v2.0.0.

- Goals: xG90 · minutes factor · ctx.atk · GOAL_PTS[pos].
- Assists: xA90 · minutes factor · ctx.atk · 3.
- Clean sheet: ctx.cs · CS_PTS · p60.
- Goals conceded, saves, defensive contribution, bonus and cards retain their existing Stage 5-bound
  approximations.
- Final total remains max(0, component sum) × position calibration.

## Pre-season fallback
Pre-season projections continue to use the existing price-implied position baseline, ownership tilt
and fixture adjustment. Stage 4 neutral minutes priors do not silently replace that path.

## Multi-GW projection and consumers
projectXP sums playerFixtureXP over teamFixtures; doubles add and blanks contribute zero. Ranker,
squad review, best XI, captaincy, transfers, Ask context and backtest continue to consume the same
projection surface.

## Limitations
No improved accuracy is claimed. The Stage 4 constants and confidence heuristic are judgement-based
until Stage 7 walk-forward validation. Cross-season player identity, predicted line-ups, manager
comments, congestion and uncertainty simulation are excluded. SCOR-1, SCOR-2, FIX-1, LEAK-1 and BT-1
remain open as recorded in KNOWN_LIMITATIONS.md.
