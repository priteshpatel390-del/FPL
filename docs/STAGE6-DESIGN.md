# Stage 6 — Transfer Optimiser

Status: owner-approved, implemented and verified on draft PR #14; awaiting explicit owner merge approval.

## Objective
Replace isolated swap suggestions with exact, deterministic search of complete legal zero-to-three-transfer plans.

## Approved behaviour
- The zero-transfer plan is always scored first and remains a first-class candidate.
- Search covers complete plans containing 0, 1, 2 or 3 transfers.
- Final squads must contain exactly 2 goalkeepers, 5 defenders, 5 midfielders and 3 forwards.
- Normal final squads may contain at most three players per club. An inherited over-quota state may only be repaired, never worsened.
- Affordability uses integer tenths, pooled selling proceeds and bank. Selling price retains half of price rises rounded down.
- Exact purchase prices are used where recorded; public-picks squads remain explicitly estimated because the public feed does not expose purchase prices.
- Paid transfers equal `max(0, transfers - freeTransfers)` and cost four points each.
- Next-Gameweek free transfers equal `min(5, max(0, freeTransfers - transfers) + 1)`.
- Ranking sums the separately selected best legal XI in every Gameweek of the selected horizon.
- Captaincy, auto-subs and uncertainty simulation remain excluded.
- Blanks and doubles use the existing projection engine without optimiser-specific constants.
- Officially unavailable players are excluded as purchases. Doubtful players remain eligible because official availability is already applied by expected minutes; warnings are shown.
- The objective is squad xP gain minus hits plus a terminal roll adjustment of 0.5 points per next-Gameweek free transfer difference versus rolling.
- Full precision determines ordering. Deterministic tie-breaks prefer gross score, lower hits, fewer transfers, more next-GW free transfers, more bank, fewer doubtful purchases and canonical numeric signatures.
- Production search uses only safe position-feasibility, minimum-cost and partial club-impossibility pruning.
- Production results must match an independent exhaustive reference on reduced pools.
- Exact search must fail closed if its deterministic evaluation ceiling is reached. A partial incumbent must never be presented as optimal.

## Inputs
Validated FPL bootstrap players, current or manual 15-player squad, bank, free-transfer count, recorded purchase prices where available, selected start Gameweek and planning horizon, and the unchanged Stage 5 projection surface.

## Explicit exclusions
No projection, expected-minutes, scoring, fixture, calibration, captaincy or ownership formula changes. No Wildcard, Free Hit, Bench Boost, multi-period future transfer path, price-rise prediction, external solver, new provider or Stage 9 redesign.

## Verification
Verified source commit `5181299c8773c118220bdd8c18e80eb053eaf592` passed **254/254 tests** and deterministic two-build comparison. Production safe pruning matches an independent exhaustive reference on reduced pools. Null and missing purchase prices use current price and force explicit estimated mode. Generated artefacts were committed at `212b071687aa1ec6fc99e2006db824eb99291657`; the temporary workflow was removed at `026848dc5b11dded156e0e7fc873d5a457f59067`.

## Limitations
The optimiser is exact only under its supplied point projections and supported search boundary. It does not improve prediction accuracy. Estimated selling prices can overstate affordability. Bench emergency value, automatic substitutions, captaincy and future-week transfer sequencing remain unmodelled. The 0.5 roll value is a judgement parameter pending Stage 7 evaluation.