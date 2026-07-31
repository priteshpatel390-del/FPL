# TEAMSHEET2-ITEM2.md — Team Decision Home

Status: **Owner-approved implementation completed on the dedicated 2.0.2 branch; awaiting physical iPhone review and merge approval.**

Purpose: record the exact Teamsheet 2.0.2 presentation boundary, behaviour, exclusions and verification requirements.

## Outcome

Team is now a pitch-first decision home. The existing legal best XI, captain, vice-captain, bench order, deterministic projections and session-only previews are presented in one compact hierarchy without changing their calculations.

The route leads with:

1. Team identity, Gameweek, data/squad provenance, deadline, overall rank where available, manual free transfers and manual bank.
2. One decision summary covering the recommended XI, captaincy, bench, forecast, main risk and deadline action.
3. The existing football pitch and attached bench.
4. Existing preview controls and links to Transfers or manual squad setup.
5. Team setup/resources and collapsed supporting captaincy/all-15 detail.

## State contract

- A football pitch remains visible for connected, unconnected, invalid, incomplete-manual and unavailable-data states.
- Placeholder shirts are decorative and never imply a calculated XI.
- A recommendation requires a complete legal 15-player squad.
- Squad provenance is labelled as Official FPL public picks, user-entered squad, verified cache/fallback or unavailable.
- Free transfers and bank remain editable manual inputs pending the separate account-authority checkpoint.
- Previously verified core data remains usable under the existing Stage 10.1 fallback boundary; foreground interaction locking is unchanged.

## Decision summary contract

- `Starting XI xP` is the unchanged deterministic legal-XI total before captain doubling.
- `Captain uplift` is the unchanged selected captain next-Gameweek xP.
- `Including captain` is their explicit sum.
- A transfer or captaincy preview is labelled `User preview`; it does not replace or persist the model recommendation.
- The main risk uses a presentation-only priority over existing data state, official availability/blank facts and the existing close-captaincy display boundary.
- A clear Team state does not claim the optimiser recommends rolling. The manager is directed to Transfers for the separate zero-transfer comparison.
- Ownership is context only. No protect, balanced, chase or rank-climbing strategy is inferred.

## Accessibility and mobile contract

- Team route focus remains owned by the 2.0.1 hash router.
- Decision text precedes the pitch in assistive-technology order.
- Pitch players remain real buttons with full captain/vice, fixture, xP and availability labels.
- Empty placeholders are one labelled image rather than fifteen meaningless controls.
- Risk and deadline action do not depend on colour.
- Focus is restored where possible after a rerendered preview interaction.
- Touch targets, safe-area dock behaviour, software-keyboard recovery and reduced-motion behaviour are preserved.

## Explicit exclusions

No projection, expected-minutes, fixture, captaincy, bench, squad, simulation, optimiser, rank, league, provider, authentication, bank/free-transfer authority, foreground-refresh, persistence, route, player-detail, framework or dependency behaviour changes.

## Verification

- `./run-tests.sh`: **454/454 tests passing**.
- Production build successful under the exact verified source commit.
- Two same-identity builds byte-identical for `dist/index.html`, `dist/app.bundle.js` and `dist/manifest.json`.
- Root `index.html` identical to `dist/index.html`.
- Model/rules remain `2.4.0` / `2026-27.3`.
- Physical populated/unconnected/loading iPhone acceptance remains required before merge.

## Physical iPhone review findings

- Startup wording was simplified to `Loading your team`.
- A first-run Official FPL transport failure correctly withheld recommendations, but exposed that the manual editor also requires the verified player catalogue.
- Team and Settings now disable and explain unavailable manual controls instead of presenting them as an independent fallback.
- A fictional, storage-isolated sample route is used only to review the populated layout. It is not part of the production deployable or recommendation data.
- Production fallback options and their separate approval gate are recorded in `TEAMSHEET2-MANUAL-FALLBACK-INVESTIGATION.md`.

