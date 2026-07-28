# Stage 6 — Transfer Optimiser
Status: implemented from the explicitly approved design on 2026-07-28.

## Approved judgement calls A–J
A. Search legal plans containing zero, one, two or three transfers. B. Validate the complete resulting 15-player squad, including 2 GK, 5 DEF, 5 MID and 3 FWD. C. Reject duplicate players and more than three players per club. D. Combine actual selling prices and entered bank. E. Paid transfers are `max(0, transfer count - available free transfers)` at four points each. F. Next-Gameweek free transfers are `min(5, max(0, free transfers - transfer count) + 1)`. G. Sum projected best-XI points separately for every Gameweek in the horizon. H. Rank by best-XI xP minus hits plus `1.0 × next free transfers`. I. Doubtful incoming players remain eligible under existing availability; unavailable players do not. J. Exhaustive search is the reference and exact branch-and-bound is production; ordering is deterministic and there is no top-N candidate pruning.

## Exact production bound and fallback
Production prunes illegal budget/club branches and uses an optimistic upper bound once the requested completed-result set is full: the best eleven individual projected scores available at each Gameweek, deliberately ignoring formation, uniqueness, club and budget restrictions. It can only overstate a branch, so cannot remove a better legal plan. The UI fails closed and returns only the zero-transfer baseline if exact optimisation cannot complete and the starting squad is valid.

## Exclusions and limitations
There is no captaincy, autosub, bench-percentage or uncertainty weight. Projection, expected-minutes, fixture and captaincy formulas are unchanged. Search is synchronous and limited to the approved maximum of three transfers. Public picks use API `selling_price`; manual squads use the shared FPL calculation from their recorded purchase price: current price after a fall, otherwise purchase price plus half the profit rounded down to £0.1m.
