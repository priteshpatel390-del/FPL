# Stage 3 item 5 — DOM-builder rendering (Stage 3.5)
Purpose: implementation and review record. Date: 2026-07-28. Status: IMPLEMENTED; OWNER REVIEW PENDING.
Related: STAGE3-DESIGN §5, DECISIONS D-17, SECURITY, TESTING.

## Approved boundary
Stage 3.5 covers DOM construction for dynamic API-, provider- and user-controlled values only. It
explicitly excludes Ask/AI Markdown sanitisation, CSP, secrets and odds-key handling, provider/model
changes, formulas, UI redesign, dependencies and golden updates.

## Implementation
`src/util.mjs` provides `el(tag, attrs, ...children)` and `setChildren(parent, ...children)`.
Non-node children are appended with `createTextNode`; attributes and event listeners remain explicit.
The following rendering paths were migrated:

1. Gameweek/deadline/season/team strip; source/provider and chip status.
2. Fixture ticker table, opponents, swings and chip-window notes.
3. Player ranker table, flags, team metadata and expandable breakdown drawer.
4. Squad empty state, KPIs, entry/status text, problem notes, captain cards, best XI, bench and table.
5. Transfer empty/top-move notes, verdicts and comparison table.
6. Mini-league load/error states, league metadata, threats/differentials tables and saved controls.
7. Manual-squad pills/count and player-search results.
8. Core FPL feed failure states and the backtest progress, errors, KPIs and result table.

The Ask renderer is the sole remaining `innerHTML` sink in these modules and is unchanged from the
Stage 3.4 baseline by explicit instruction; it belongs to Stage 3.6.

## Verification
Five adversarial tests inject script tags, image/onerror text, quotes and angle brackets through
representative player, team, entry, saved-league and provider values. They assert the payload remains
visible text and creates neither SCRIPT/IMG elements nor event-handler attributes. A source inventory
test rejects any non-Ask `innerHTML` sink in `views.mjs`, `main.mjs` or `backtest.mjs`.

Full result: 194/194 tests passing. Golden files and all projection/scoring outputs are unchanged.
Production build and deterministic byte comparison are required before review handoff.
