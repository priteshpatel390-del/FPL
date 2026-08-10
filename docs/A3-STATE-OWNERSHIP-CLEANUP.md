# A3 State-Ownership Cleanup

Status: **implementation candidate on draft PR #112; not merged and not accepted yet.**

Baseline for this checkpoint is GitHub `main` `5a1a036082aba1a9c297e8d6194cc1ae4f476041`, merge of PR #111 (A3 Production-Bundle Safeguards). Exact-main Verify Teamsheet run #159 / `31422588548` passed **859 tests, 859 passed, 0 failed, 0 skipped, 0 cancelled** together with committed build provenance, production build, deterministic rebuild, root/deployable equality, build identity and production-output preservation.

## Investigation outcome

The state-ownership investigation found no critical or high-severity ownership defect and no evidence requiring a general state-management rewrite. Distributed state remains intentional where modules have distinct lifetimes and responsibilities.

Two medium architectural risks were confirmed:

1. `S` was not a complete explicit inventory of cross-module mutable state. Legitimate provider, calibration and Mini-League slots were introduced by later modules, so a new shared slot could be missed by lifecycle review even when its semantic owner was otherwise clear.
2. Mini-League preferences had two writable runtime representations. `S.miniLeagues` was intended to be canonical, but the legacy `S.leagues` compatibility path could diverge and `renderLeagueChips()` could copy that divergent value back into canonical preferences.

Neither risk was classified as a demonstrated user-visible defect.

## Approved implementation boundary

Pritesh approved the narrow hardening option on 10 August 2026. The candidate may only:

- declare the legitimate cross-module `S` slots centrally as an inventory;
- keep semantic ownership with the existing domain modules;
- add a zero-dependency source regression that rejects undeclared direct `S.<key>` / static `S['key']` usage and proves refresh-owned keys remain an explicit subset;
- make the Mini-League compatibility alias one-way so `S.miniLeagues` remains the only writable runtime preference representation;
- add a focused regression proving an attempted legacy alias write cannot replace canonical preferences;
- reconcile stale canonical checkpoint/baseline wording left after PR #111;
- regenerate deployables only through the existing deterministic build.

## Ownership contract

`src/state.mjs` is the **shared-state inventory**, not the semantic owner of every value in `S`.

Semantic ownership remains distributed:

- core accepted Official FPL state and refresh-owned accepted slices: `state.mjs` / refresh commit boundary;
- Provider Health: provider registry;
- supporting-provider accepted values and recomputation lifecycle: provider application modules;
- durable browser records and persistence warnings: storage boundary;
- navigation/history/focus: app shell/router;
- decision previews: decision-preview module;
- Transfers Worker/controller state: transfer-performance module;
- manual squad interactions: manual-squad runtime, with storage as durable-record owner;
- Mini-League preferences: `mini-leagues-state.mjs`;
- fetched Mini-League standings/rival/exposure session data: `mini-leagues-view.mjs`;
- Stage 10 snapshots, outcomes, metrics and review: evidence modules, preserving the one-way evidence boundary.

A declared `S` key therefore means only that the value is intentionally shared across production modules. It does not authorise unrelated modules to write it.

## Mini-League compatibility rule

`S.miniLeagues` is canonical. `S.leagues` is a read-only compatibility bridge for legacy readers and resolves to `S.miniLeagues.saved`. Runtime assignments to `S.leagues` are intentionally non-authoritative and cannot replace canonical preferences.

The persisted v3 Mini-League record and its migration/season-compatibility rules are unchanged.

## Explicit exclusions

This checkpoint does not change:

- projection/model, expected-minutes, fixture, captaincy, squad, transfer-strategy, rank or Mini-League intelligence calculations;
- provider/data-source acquisition, validation, fallback, cadence or security;
- Atomic Foreground Refresh ordering or rollback semantics;
- browser persistence formats or error-boundary ownership;
- route-aware rendering/performance;
- UI design or navigation;
- bundler/module order/workflows;
- framework/dependency architecture;
- Stage 10 evidence feedback rules.

## Validation gate

Before this checkpoint can be called complete, the final candidate must retain all 859 baseline tests and add the focused ownership regressions, then pass:

- `./run-tests.sh`;
- complete production build;
- deterministic rebuild byte comparison;
- root/deployable equality;
- exact build identity and committed provenance;
- all PR #111 production-bundle safeguards.

Physical iPhone testing is not required by default because the approved package has no intended visual/device interaction change. If final review finds a user-visible runtime change, device acceptance becomes separately required.

No merge is authorised by this document. PR #112 remains draft until evidence is complete and Pritesh explicitly approves merge.
