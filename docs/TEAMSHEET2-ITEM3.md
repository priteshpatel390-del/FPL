# Teamsheet 2.0.3 — Transfers Decision Workspace

Status: implemented on the owner-approved draft branch; not merged.

Verified source commit: `f2f184fb9890a820e91ae240b27241e0d76f41ef`

## Outcome

Transfers now presents a mobile-first decision workspace rather than a wide technical table. It keeps the existing exact transfer optimiser and its zero-transfer baseline unchanged, while making assumptions, comparison limits, hits, free-transfer effects, affordability cautions and next-Gameweek consequences explicit.

## Approved scope delivered

- A first-class no-transfer baseline with honest roll/cap wording.
- A highest-ranked decision summary and vertical transfer-plan cards.
- Synchronized, persisted free-transfer and bank planning assumptions.
- Persisted horizon and result-count display controls.
- Corrected result choices of 8, 15 or 20; the previous Top 25 / 20-result mismatch is removed.
- Clear separation between gross best-XI gain, hit cost, free-transfer utility and net model comparison.
- Inline details and up to three additional legal alternatives.
- Preview navigation through the central `#/team` router.
- Explicit blocking and degraded states.
- Mobile, keyboard, screen-reader and reduced-motion presentation contracts.
- Removal of the stale isolated-swap renderer and duplicate transfer-control wiring.

## Verification

- `./run-tests.sh`: **467/467 tests passed**.
- Production build executed with the verified source commit identity.
- Two production builds were byte-identical.
- Root `index.html` matched `dist/index.html`.
- `dist/app.bundle.js` and `dist/manifest.json` were byte-identical across builds.
- `git diff --check` passed.
- Model version remains `2.4.0`.
- Rules version remains `2026-27.3`.

## Calculation boundary

No projection, minutes, scoring, fixture, captaincy, squad, transfer, simulation, rank, Mini-League, rival or strategy calculation changed. `src/model/transfers.mjs` and versioned transfer rules are untouched. The UI continues to consume the optimiser's existing plan objects.

“Net model comparison” remains:

`gross best-XI gain - hit cost + versioned free-transfer utility`

The free-transfer adjustment is labelled as decision utility, not an FPL score. Captain doubling and bench points remain outside the transfer optimiser comparison.

## Persistence and invalidation

Only free transfers, bank, horizon and result count persist. Plans, recommendation wording, expanded details and previews remain session-only. Any squad, verified-data or committed assumption change recomputes the comparison and invalidates an incompatible preview.

## Exclusions

- No Team Home or player-detail redesign.
- No new Mini-League or rank intelligence.
- No provider, transport, data-source or security change.
- No account-authority claim for bank or free transfers.
- No confidence score or accuracy claim.
- No framework or dependency change.
- No merge without owner approval.

## Remaining limitations

Physical iPhone and VoiceOver acceptance remains an owner review gate. Public FPL transport limitations can still prevent populated-data acceptance. Purchase-price availability may remain estimated and is labelled at the decision point.
