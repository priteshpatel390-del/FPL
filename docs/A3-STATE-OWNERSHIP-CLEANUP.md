# A3 State-Ownership Cleanup

Status: **complete, merged, accepted and post-merge verified through PR #112.**

This checkpoint began from GitHub `main` `5a1a036082aba1a9c297e8d6194cc1ae4f476041`, merge of PR #111 (A3 Production-Bundle Safeguards). Exact-main Verify Teamsheet run #159 / `31422588548` passed **859 tests, 859 passed, 0 failed, 0 skipped, 0 cancelled** together with committed build provenance, production build, deterministic rebuild, root/deployable equality, build identity and production-output preservation.

The final reviewed PR #112 head was `620daf14d1c354668b16df74daf05e29d8a1eb25`. PR #112 merged to `main` as `691d9f929284d51c233b61d099c34cafe1030db6` on 10 August 2026. Post-merge Verify Teamsheet run #167 / `31430700053` completed successfully on that exact merge commit with **864 tests, 864 passed, 0 failed, 0 skipped, 0 cancelled**; committed deployment provenance, the complete suite, production build, deterministic rebuild, root/deployable equality, exact build identity and production-output preservation all passed. GitHub Pages deployment run #117 / `31430697347` also completed successfully on the same exact merge commit.

No physical iPhone testing was performed for this checkpoint and none is claimed. The checkpoint introduced no broad state-management rewrite and changed no model, provider, persistence-format, error-boundary, Atomic Foreground Refresh, routing-performance or bundler behaviour.

## Investigation outcome

The state-ownership investigation found no critical or high-severity ownership defect and no evidence requiring a general state-management rewrite. Distributed state remains intentional where modules have distinct lifetimes and responsibilities.

Two medium architectural risks were confirmed:

1. `S` was not a complete explicit inventory of cross-module mutable state. Legitimate provider, calibration and Mini-League slots were introduced by later modules, so a new shared slot could be missed by lifecycle review even when its semantic owner was otherwise clear.
2. Mini-League preferences had two writable runtime representations. `S.miniLeagues` was intended to be canonical, but the legacy `S.leagues` compatibility path could diverge and `renderLeagueChips()` could copy that divergent value back into canonical preferences.

Neither risk was classified as a demonstrated user-visible defect.

## Approved implementation boundary

Pritesh approved the narrow hardening option on 10 August 2026. The completed package only:

- declares the legitimate cross-module `S` slots centrally as an inventory;
- keeps semantic ownership with the existing domain modules;
- adds a zero-dependency source regression that rejects undeclared direct `S.<key>` / static `S['key']` usage and proves refresh-owned keys remain an explicit subset;
- makes the Mini-League compatibility alias one-way so `S.miniLeagues` remains the only writable runtime preference representation;
- adds a focused regression proving an attempted legacy alias write cannot replace canonical preferences;
- reconciles checkpoint/baseline documentation needed by the implementation candidate;
- regenerates deployables only through the existing deterministic build.

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

## Corrections found during implementation review

Reviewing the first candidate against a freshly built bundle found three defects, all corrected inside the approved boundary:

1. **A real regression.** `tests/rendering-security.test.mjs` seeded its hostile saved-league name through the legacy `S.leagues` alias. Once the alias became read-only that write was ignored, no chip rendered and the XSS assertion failed. The test now seeds canonical `S.miniLeagues.saved`, keeps both original inertness assertions unchanged, and additionally proves a legacy alias write never reaches saved-league rendering. Nothing was weakened, deleted or skipped.
2. **A stale documentation index.** `docs/A3-STATE-OWNERSHIP-CLEANUP.md` was not listed in [Historical Records](HISTORICAL_RECORDS.md), which the permanent documentation-integrity test requires.
3. **Residual reverse-authority code.** `renderLeagueChips()` still contained `S.miniLeagues={...S.miniLeagues,saved:S.leagues}`, and `syncMiniLeagueAlias()` had become a no-op with two dead call sites. Both were removed so the one-way rule is structural rather than merely unreachable. A source regression now rejects any module that rebuilds canonical Mini-League state from the legacy alias.

The trailing newline lost from `src/state.mjs` in the first candidate was also restored.

Each new regression was mutation-checked: restoring a writable alias, restoring the reverse-authority write and introducing an undeclared shared slot each fail the suite.

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

## Final validation evidence

The completed checkpoint retained all 859 baseline tests and added five focused ownership regressions. Final reviewed head `620daf14d1c354668b16df74daf05e29d8a1eb25` passed **864 tests, 864 passed, 0 failed, 0 skipped, 0 cancelled** together with:

- `./run-tests.sh`;
- complete production build;
- deterministic rebuild byte comparison;
- root/deployable equality;
- exact build identity and committed provenance;
- all PR #111 production-bundle safeguards.

Post-merge Verify Teamsheet run #167 / `31430700053` repeated the permanent repository gate successfully on exact merge commit `691d9f929284d51c233b61d099c34cafe1030db6`. GitHub Pages deployment run #117 / `31430697347` succeeded for that same commit.

Physical iPhone testing was not required because the approved package had no intended visual/device interaction change. No physical device testing was performed and none is claimed.

## Remaining limitations

- The shared-slot source regression covers direct `S.key` and static `S['key']` access. It is not a general JavaScript data-flow proof for arbitrary computed property access; the known dynamic access is the explicit `REFRESH_OWNED_KEYS` lifecycle loop, whose keys are separately required to be a subset of the declared shared inventory.
- `SHARED_STATE_KEYS` is captured when `state.mjs` initialises, so inventory equality describes the declared cross-module surface while semantic write ownership remains a module-level contract rather than a runtime capability system.
- Persisted v3 Mini-League records, migration and season-compatibility behaviour are unchanged; this checkpoint does not add new live-data or device evidence for those paths.
- The final candidate received automated, mutation and repository verification evidence; no physical iPhone testing is claimed.

PR #112 is a permanent completed checkpoint record. Any Route-Aware Rendering and Performance work remains separately approval-gated and must begin with investigation, measurement and evidence before any optimisation or implementation is proposed.
