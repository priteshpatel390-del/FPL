# Transfers Track A — Exact Performance and Persistent Calculation

<!-- TRANSFERS-TRACK-A-2026-08-06 -->
Status: **Owner-approved and implemented for review on `agent/transfers-exact-performance`; stacked on draft PR #69. No merge is approved.**

## Product outcome

Transfers begins calculating automatically once Teamsheet has verified data, a complete legal 15-player squad and valid planning assumptions. The ordinary experience has no Calculate or Recalculate button. One exact calculation continues while the manager moves between internal destinations, and returning to Transfers restores the current progress or reuses the completed result immediately.

This item addresses search execution and lifecycle only. It does not claim that the underlying projections or football recommendations are more accurate.

## Previous and implemented behaviour

| Area | Previous PR #69 behaviour | Track A behaviour |
|---|---|---|
| Start | Explicit Calculate transfers action | Automatic after valid inputs |
| Navigation | Leaving Transfers terminated the worker | Internal navigation keeps the same job alive |
| Return | In-flight work restarted from zero | Existing progress/result is restored |
| Completed result | Session reuse after explicit completion | Immediate exact reuse for the full material fingerprint |
| Search leaf | Rebuilt, validated, scored and materialised the full plan | Reuses prepared/core state and materialises full detail only for a retained contender |
| Search ordering | Primarily player-ID traversal | Promising exact branches are considered earlier without excluding any branch |
| Pruning | Position, minimum cost and club impossibility | Existing pruning plus conservative mathematically safe score bounds |
| Exactness oracle | Independent reduced-pool exhaustive search | Preserved as an independent oracle |

## Exact calculation controller

The application owns one controller rather than tying worker lifetime to the Transfers route. Its material job identity covers the verified dataset and prepared projection values, current Gameweek, complete squad and purchase prices, player prices and availability, bank, free transfers, horizon, result limit, search limits and build/model/rules identity.

A material change supersedes the current job and starts the newly required calculation. Internal route changes and unrelated renders do not. An explicit Cancel action stops the current work; Resume starts the same still-valid snapshot again. Retry is shown only after a genuine worker/preparation failure. Page close or reload remains an intentional session boundary.

## Exact search architecture

The optimiser still evaluates the approved complete 0–3 transfer problem. Performance work consists of:

1. preparing every eligible player's exact per-Gameweek score once;
2. grouping candidates and immutable numeric metadata once;
3. reusing the unchanged squad core for each outgoing combination;
4. maintaining affordability, uniqueness and club counts incrementally;
5. computing exact best-XI totals through compact position score lists;
6. avoiding full transfer/final-squad/per-Gameweek result construction for candidates that cannot enter retained top K;
7. visiting promising branches earlier so a useful exact retention threshold is available sooner;
8. pruning only when a conservative optimistic bound proves the branch cannot enter the retained exact results.

Equality is determined by the existing full-precision comparator and canonical signature. A branch capable of a relevant tie is not removed. The production search continues to fail closed at the unchanged evaluation ceiling; no partial incumbent is presented as optimal.

## Football and data boundary

Unchanged:

- model `2.4.0` and rules `2026-27.3`;
- Official FPL, team-level Understat, Odds and archive provider boundaries;
- candidate eligibility and unavailable/doubtful treatment;
- selling prices, pooled affordability and club/position legality;
- free transfers, hits and 0.5 terminal roll utility;
- maximum transfer depth, horizon limits and two-million evaluation ceiling;
- best-XI objective, comparator and result ordering;
- zero-transfer as a genuine candidate;
- no captain doubling, bench points, auto-subs or future transfer sequencing in the optimiser;
- no Cloudflare calculation and no player-level Understat.

Cheap players, defenders and goalkeepers remain in the broad eligible universe. No price, ownership, recent-points or arbitrary top-N threshold is introduced.

## Automated evidence

- Complete repository result: **594 passed, 0 failed, 0 skipped**.
- Production search versus independent exhaustive-oracle equality on controlled deterministic pools.
- Exact retained ordering and zero-transfer behaviour.
- Goalkeeper, defender, cheap-enabler and no-transfer scenarios.
- Automatic start, single-worker ownership, route persistence, progress restoration, material invalidation, cancellation, stale-result rejection and exact session reuse.
- Two builds using the same exact source identity are byte-identical for `dist/index.html`, `dist/app.bundle.js` and `dist/manifest.json`.
- Root `index.html` equals `dist/index.html`.

Automated equality proves implementation agreement with the approved objective. It does not prove prediction accuracy or physical-device speed.

## Remaining acceptance gate

Physical iPhone Safari must still verify:

- immediate Transfers opening;
- automatic start without a manual Calculate button;
- continued progress through repeated internal navigation;
- no Safari freeze, reload or excessive memory pressure;
- prompt explicit cancellation;
- immediate reuse of a completed result;
- default six-Gameweek completion time, ideally well below 30 seconds;
- repeated runs and material input changes;
- VoiceOver announcement of major state changes without noisy progress repetition;
- exact final plans/order matching the frozen reference input.

Until that evidence is recorded, Track A is implemented and automatically verified but not product-accepted or approved for merge.
