# DTR-1 — Direct Team Renderer

Purpose: implementation and acceptance record for replacing Team's legacy-render-then-reconstruct path with one direct renderer. Last reconciled: 9 August 2026.

## Status and approval boundary

DTR-1 was approved for implementation after an investigation traced the complete Team render path, implicit state synchronisation, DOM reuse, event ownership, build-order dependency and protecting tests. The implementation candidate is on `agent/dtr-1-direct-team-renderer`, based on GitHub `main` `5ee735f864aaea2b6c423dfaeb267f18f5fe3b2f`.

The branch is not merged or physically accepted. Permanent remote CI, exact generated provenance and populated iPhone Safari acceptance remain required. Pritesh must explicitly approve merge.

## Architectural change

Before DTR-1, `views.mjs` built a complete legacy Team tree. `team-decision-home.mjs` then captured and reassigned `renderSquad()`, invoked the legacy renderer, searched its children by class and heading text, moved selected nodes, discarded the remainder, reordered and relabelled bench nodes, annotated availability and rewrote the final Team tree.

The candidate keeps one stable public `renderSquad()` entry point. That adapter calls `renderTeamDecisionHome()` with explicit callbacks for Player Detail, shared flag nodes, Team rerendering and the existing Transfers renderer. The direct renderer now:

- clears or synchronises session preview state before presentation;
- validates transfer previews and clears invalid plans fail-closed;
- calls the unchanged squad, fixture, projection, pitch and captaincy primitives;
- creates the accepted final Team and support trees directly;
- creates reserve-GK/outfield bench display roles, availability and accessible wording at node creation;
- retains every pitch, bench, all-15, captain/vice, reset and preview-clear handler;
- captures and restores Team focus across rerenders;
- leaves `renderAll()` and manual-squad runtime ownership unchanged.

`team-decision-home.mjs` now precedes `views.mjs`, which precedes `manual-squad-runtime.mjs`, in the deterministic bundle. Runtime function replacement and async-initialiser timing are no longer dependencies.

## Preserved behaviour and deliberate exclusions

The candidate deliberately preserves the accepted Team design, final DOM order, classes, best XI, captain/vice behaviour, projections, bench calculation, reserve-goalkeeper display, outfield bench order, transfer preview, Player Detail horizons, navigation, startup ownership, manual squad behaviour, providers, data sources and persistence.

The existing exact-xP tie characteristic is preserved: the visual captaincy ranking retains stable starting-XI order, while decision summary/risk retains its existing player-ID tie-break. DTR-1 does not attempt to reconcile that difference.

No model, fixture, expected-minutes, scoring, squad, captaincy, transfer, simulation, rank, League, rival or strategy calculation changed. No provider, endpoint, origin, cache, storage schema, route, CSS rule, product copy design or golden expectation changed.

## Removed architecture

- the legacy Team DOM-building body in `views.mjs`;
- runtime capture and reassignment of `renderSquad()`;
- `teamDecisionEnhanceRenderedTeam()`;
- Team child extraction by class, heading text and sibling position;
- post-render bench node movement and relabelling;
- post-render availability annotation.

## Automated verification

The candidate adds six production-bundle runtime contracts and replaces obsolete source-pattern assertions with direct behaviour/ownership contracts. The harness now reaches the actual shipped Team renderer, closing the previous gap where Team XSS exercised only the discarded legacy renderer.

Local complete verification is **691 passed, 0 failed, 0 skipped, 0 cancelled**. Coverage includes final ready/placeholder structure, preview clearing and validation, captain selection/reset, bench roles and unchanged display ordering, Player Detail from bench and all-15 rows, transfer incoming/clear behaviour, module ownership and hostile-string inertness through the final renderer. No existing test or golden expectation was removed, weakened, regenerated or skipped.

Exact two-build reproducibility, root/deployable equality, manifest identity and reachable-source reproduction are recorded after the reviewed source commit is created and generated-only outputs are produced from it.

## Required physical iPhone Safari acceptance

Test the exact PR build with a populated legal squad:

1. Startup gate owns the viewport; no dock appears during loading.
2. Team header, decision summary, resources, pitch, controls and actions retain their accepted order and appearance.
3. Manual FT/bank editing updates once.
4. Captain/vice choose, swap and reset work; badges remain clear.
5. A transfer preview shows the incoming marker and clears correctly.
6. Bench shows GK, 1st, 2nd and 3rd without changing outfield order.
7. Doubtful/unavailable starter and bench badges remain centred and readable, including a narrow one-line `Unavailable` label.
8. Two-line names preserve fixture and xP rows.
9. Every bench card opens the correct Player Detail and closes to the exact Team position.
10. Portrait/landscape and expanded/collapsed Safari controls preserve Team and Player Detail behaviour.
11. Manual removal produces the placeholder; legal completion restores Team.
12. Team, Transfers and Settings navigation, Back, focus and scroll receive a smoke check.

VoiceOver is not a project acceptance gate and is not claimed. Post-Gameweek League, outcome, minute-history and accuracy evidence are outside DTR-1.
