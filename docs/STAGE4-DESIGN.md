# Stage 4 — Expected Minutes

Status: **historical record — complete.** The Stage 4 expected-minutes model shipped and remains the production boundary described in `PROJECTION_MODEL.md`. The "implementation in progress" wording referred only to the original `stage4-expected-minutes` branch and is not current state.

## Existing behaviour replaced
Live-season expected minutes were `season minutes / current GW`, clamped to 0–90. Appearance and
60-minute probabilities were then inferred from that one average. This created postponement bias and
could not distinguish starters, substitutes and rotation.

## Approved model
- Official FPL data only.
- Detailed current-season histories for the owner's squad/manual players plus approximately 80
  additional players selected deterministically by ownership, price and player id.
- Last eight completed team opportunities with 0.90 recency decay.
- Four-match shrinkage toward season aggregates.
- Outputs: `pStart`, `pAppear`, `p60`, `expMin`, `confidence`, confidence label and source.
- Availability uses official FPL status/chance and is applied once.
- Neutral no-history prior: pStart 0.50, pAppear 0.70, p60 0.40, expMin 45, confidence 0.20.
- Detailed-history failures fall back to validated cache, then season aggregates, then the neutral
  prior. Mixed detailed/fallback coverage is reported as FPL Provider Health `Partial`.

## Formula
For each recent opportunity, newest first, weight `w_i = 0.9^i`.

`estimate = (sum(w_i * observed_i) + 4 * aggregateEstimate) / (sum(w_i) + 4)`

The formula is applied independently to starts, appearances, 60-minute appearances and minutes.
Logical guards enforce pStart <= pAppear, p60 <= pAppear, probabilities in 0–1 and expMin in 0–90.

## Confidence
Confidence describes evidence quality, not calibrated prediction accuracy. It combines history
coverage, freshness, detailed-vs-aggregate source quality and role stability. It must not be described
as an out-of-sample probability of correctness.

## Explicit exclusions
No scoring-rule, fixture, calibration, captaincy, squad, optimiser, Understat, odds, ClubElo,
previous-season identity, predicted-line-up, news-scraping, uncertainty-simulation or UI-redesign
changes. No improved-accuracy claim is permitted before Stage 7 walk-forward validation.

## Validation
Focused tests cover denominators, stable starters, substitutes, rotation, limited history,
availability, invariants and malformed player-history payloads. Completion also requires the full
suite, successful build, deterministic two-build comparison, generated artefact verification and
removal of the temporary verification workflow before merge.
