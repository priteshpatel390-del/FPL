# STAGE6-DESIGN.md — Transfer Optimiser
Purpose: approved design and implementation record for Stage 6. Last updated: 2026-07-28.

## Status
Implemented on `agent/stage-6-transfer-optimiser` after explicit approval of the scope and judgement calls A–J. This stage changes transfer-plan construction and ranking only.

## Approved judgement calls A–J
A. Search includes doing nothing and every legal plan of one, two or three transfers.  
B. Legality is decided on the complete resulting 15: exactly 2 GK, 5 DEF, 5 MID and 3 FWD, unique players and at most three from a club.  
C. Affordability pools the entered bank with actual selling prices; public squads use `selling_price`, while manual squads retain their purchase-price calculation.  
D. Paid transfers are `max(0, moves − available FT)` and cost four points each.  
E. Next-GW FT is `min(5, max(0, FT − moves) + 1)` and is worth exactly 1.0 point.  
F. Each horizon Gameweek independently selects its projected legal best XI; no captain, autosub or bench percentage is added.  
G. Doubtful incoming players remain eligible under existing availability scaling; injured, unavailable, suspended and departed players are excluded.  
H. Invalid/incomplete squads fail closed. A zero-transfer-only answer is reserved for an exact-search failure after a valid baseline is evaluated.  
I. Exhaustive search is the test reference. Production uses exact branch-and-bound with a safe upper bound and no arbitrary candidate shortlist.  
J. Ranking is deterministic: objective descending, fewer transfers, then canonical player-id move key.

## Objective
`sum(projected best-XI points in each selected GW) − 4 × paid transfers + 1.0 × next-GW FT`

The search evaluates complete squads and consumes the existing one-Gameweek projection without changing projection, expected-minutes, fixture or scoring formulas.

## Exact search and fallback
The reference enumerates all valid outgoing and position-compatible incoming combinations. Production uses the same candidates and constraints, pruning only when a safe best-XI improvement bound cannot enter the requested result set. `Show` limits returned rows after exact consideration; it is not candidate pruning. Unexpected search failure returns only the evaluated baseline; invalid inputs return no plan.

## Explicit exclusions
No captaincy, autosubs, bench weighting, uncertainty weighting, chips, price forecasts, future transfer sequences, wildcard planning or Stage 7+ modelling is included.

## Verification contract
Controlled tests compare complete ordered production results with exhaustive search and cover legality, selling prices, 0–3 move arithmetic, availability and fail-closed behaviour.
