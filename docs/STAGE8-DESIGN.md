# STAGE8-DESIGN.md — Uncertainty and squad simulation

Status: **historical record — complete and merged.** Approved and implemented through PR #16; the Stage 8 uncertainty and squad-simulation layer shipped and remains production behaviour. The "draft PR" wording was true only at this checkpoint. Last updated: 2026-07-28.

## Scope

Stage 8 adds a deterministic uncertainty layer around the existing expected-points model. It does not replace or refit `projectXP()`. The implementation provides seeded player samples, P10/P25/median/P75/P90 summaries, blank/return/haul probabilities, legal squad auto-substitution and captain-to-vice fallback.

## Approved boundaries

- Existing deterministic scoring, expected-minutes, calibration and transfer-optimiser objectives remain unchanged.
- No new provider or historical data source is introduced.
- Detailed simulation is disabled in pre-season because the price-implied fallback does not expose credible event-level rates.
- No hidden captain composite is introduced. Consumers can compare mean, floor, upside and threshold probabilities directly.
- Chips, ownership/rank simulation, a full BPS engine and Stage 9 pitch/shirt UI work are excluded.

## Architecture

`src/model/simulation.mjs` owns deterministic seed hashing, the repository PRNG, minutes-state reconstruction, discrete component sampling and summaries.

`src/model/squad-simulation.mjs` owns legal XI checks, ordered bench auto-subs, reserve-goalkeeper handling, captain/vice fallback and squad summaries.

`SIMULATION_RULES` in `src/config.mjs` versions the simulation contract, sample limits and probability thresholds. Both modules are included in the deterministic bundle after scoring and before downstream consumers.

## Minutes model

The current `{pStart,pAppear,p60,expMin}` boundary is reconstructed into five mutually exclusive states:

1. DNP
2. substitute under 60
3. substitute reaching 60
4. starter under 60
5. starter reaching 60

The start-and-60 overlap is `min(pStart,p60)`. State minute means are deterministically allocated inside legal ranges to preserve `expMin` where feasible. Inconsistent inputs are bounded and labelled `reduced`; probabilities are not silently changed.

## Player outcomes

Appearance points follow sampled minutes. Goals, assists, saves, conceded groups, defensive contributions, bonus and rare events are sampled from the existing component expectations. The current expected-points formula remains available separately and unchanged.

Definitions:

- blank: points <= 2
- return: points >= 5
- haul: points >= 10
- mega-haul: points >= 15
- floor: P25
- upside: P90

The simulator records appearance independently from points so a zero-point appearance cannot trigger an incorrect auto-sub or vice-captain takeover.

## Squad rules

A valid input contains a legal 11-player starting XI and four ordered substitutes. The reserve goalkeeper can replace only the starting goalkeeper. Outfield substitutes are considered in bench order and used only when the resulting XI preserves at least three defenders, two midfielders and one forward. Captaincy remains with an appearing captain; otherwise it passes to an appearing vice-captain.

## Determinism and limits

The production default is 5,000 samples with a hard ceiling of 25,000. Seeds include the simulation version, Gameweek, fixture/player/squad identities and armband choices. Equal inputs produce equal samples and summaries.

## Validation

Direct tests cover deterministic randomness, minutes marginals, expected-minutes convergence, reduced-quality bounds, percentile ordering, probability thresholds, legal formations, goalkeeper substitution, ordered outfield substitution and captain fallback. The complete repository suite and deterministic two-build comparison remain mandatory.

## Limitations

- Samples describe uncertainty conditional on the current model, not all real-world uncertainty.
- Player attacking events are not strictly allocated from a complete match score.
- Bonus remains empirical rather than match-relative BPS ranking.
- Goal timing, tactical substitutions and match state are not fully simulated.
- Historical provider gaps prevent full retrospective probability calibration.
- Prospective 2026/27 observations are required before any calibration or accuracy claim.
