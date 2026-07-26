# PROJECTION_MODEL.md — the Stage-4 reference document
Purpose: precise record of the CURRENT projection engine (v2.0.0). Documents, does not change.
Audience: anyone touching model code — read fully first. Last updated: 2026-07-26.
Related: AUDIT.md §3 (issue ids), KNOWN_LIMITATIONS.md, DECISIONS D-09/D-11, src/model/*.

## Constants (src/config.mjs)
GOAL_PTS {GKP/DEF:6, MID:5, FWD:4} · CS_PTS {GKP/DEF:4, MID:1, FWD:0} · ASSIST_PTS 3 ·
DC_THRESH {DEF:10, MID/FWD:12} · BASE_GOALS 1.42 · HOME_TILT 1.10 · calibration S.calib[pos]
(from backtest; currently applied from the 2025-26 aggregate run).

## Layer 1 — team strengths → match context (model/fixtures.mjs · matchContext)
For team t vs opponent o, venue-specific FPL strengths, league-average normalised:
```
xGF = clamp( BASE · (tAtk/avgAtk) · (avgDefOpp/oDef) · tilt , 0.25, 4 )   tilt = 1.10 home, 1/1.10 away
xGA = symmetric
```
Layer 2 (if Understat has BOTH teams): u_xGF = BASE · uAtk_t / uDef_o · tilt; blend 0.55·static+0.45·u.
Layer 3 (if a confident odds quote matched this fixture): blend 0.35·model+0.65·market.
Outputs: {xGF, xGA, cs = e^(−xGA), atk = xGF/BASE, def = BASE/xGA}.
Weights are configuration, UNVALIDATED (D-09). Poisson clean-sheet assumes independence.

## Expected minutes (model/scoring.mjs · expectedMinutes) — KNOWN-CRUDE (MIN-1/DEN-1)
`expMin = clamp(season_minutes / max(1, currentGW), 0, 90)`; null pre-season.
Derived: mFactor = (expMin/90)·avail; pAny = clamp(expMin/28,0,.98)·avail; p60 = clamp((expMin−18)/55,0,.97)·avail.
avail: a→1; d→chance/100 (default .5); i/u/s/n→0. Whole per-fixture score is availability-scaled.

## Per-fixture expected points (playerFixtureXP), by component
- Appearance: pAny + p60.
- Goals: xG90 · mFactor · ctx.atk · GOAL_PTS[pos]  (attacking rates scale with team goal expectation).
- Assists: xA90 · mFactor · ctx.atk · 3.
- Clean sheet (GKP/DEF 4, MID 1): ctx.cs · CS_PTS · p60.
- Goals conceded (GKP/DEF): −(ctx.xGA/2) · mFactor · 0.72   ← linear proxy for floor(GC/2) (SCOR-1).
- Saves (GKP): (saves90/3) · (ctx.xGA/BASE) · mFactor        ← linear proxy for floor(saves/3) (SCOR-1).
- Defensive contribution: 2 · sigmoid((dc90 − thresh)/2.2) · p60 (shallow by design) (SCOR-1).
- Bonus: clamp((bps90 − 16)/20, 0, 1.8) · mFactor · (1 + (ctx.atk−1)·0.3)  ← BPS-derived,
  double-counts scored events (SCOR-2); calibrated so ~40+ bps/90 ≈ 1.2–1.3/game.
- Cards: −yc90 · mFactor.
- Final: total = max(0, Σ components) · S.calib[pos] (calibration shown as its own breakdown bar).
per90 denominators use max(0.5, minutes/90) for saves/bps/cards/dc (small-sample guard); xG/xA use
the API's per-90 fields directly.

## Pre-season fallback (priceBaseline)
No match data → price-implied base per position (linear in price) × ownership tilt
(1 + clamp(own,0,45)/450), fixture-adjusted by def^0.55 (GKP/DEF) or atk^0.65 (MID/FWD), ×avail.
Prices are FPL's own expectation encoding — a stated prior, labelled in the UI.

## Multi-GW projection & cache
projectXP sums playerFixtureXP over teamFixtures(from, span) (doubles add, blanks contribute 0);
memoised by (playerId, fromGW, span); clearXP on any input change.

## Consumers
Ranker (xP/GW, per-£m), squad review + best-XI (legal-formation exhaustive search over 1-GW xP),
captaincy (2× top XI xP, coin-toss note <0.6), transfer planner (single-swap Δ over horizon vs −4;
TRF-1 applies), Ask context, backtest replica of the same formulas.

## Run-score (ticker ease)
Mean over span of atk/def multipliers (lens), blanks contribute 0.55, doubles +0.45 (FIX-1).

## Known weaknesses (authoritative list = KNOWN_LIMITATIONS.md)
MIN-1/DEN-1 minutes; SCOR-1 stepped rules; SCOR-2 bonus; FIX-1 constants; LEAK-1 calibration
provenance (r=0.80 is an in-sample-flattered upper bound — never quote it as validated accuracy);
no set-piece/penalty modelling; no uncertainty output (point estimates only); position-level
calibration only.

## Stage-4+ improvement map
Minutes model (Stage 4) → stepped-rule distributions, bonus-per-start with shrinkage, penalties,
weight/prior configs (Stage 5) → plan-level optimiser (Stage 6) → walk-forward validation & ablation
(Stage 7) → uncertainty & auto-sub simulation (Stage 8). Formula-change protocol: PROPOSE (existing
→ proposed → inputs → fallback → assumptions → limitations → tests) BEFORE implementing.
