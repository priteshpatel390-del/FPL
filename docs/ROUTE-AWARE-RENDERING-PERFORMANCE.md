# Route-Aware Rendering and Performance

Status: **M1 measurement instrumentation approved and implemented as a review candidate; route-aware optimisation remains unapproved.**

Base investigated: GitHub `main` `5b177d35842e73bfdc47944263ef7a807f5430a5`, merge of PR #114. At the investigation gate there were 864 tests on `main`, Verify Teamsheet run #181 and GitHub Pages run #118 were successful on that exact commit, and no open PR overlapped this checkpoint.

## Outcome of the investigation

A material user-visible performance problem was **not demonstrated**. Ordinary primary-route navigation is already structurally cheap: the app-shell router changes route visibility/history/focus and emits `teamsheet:route-change`; it does not call the global `renderAll()` path merely because the user changes primary route.

However, real avoidable work was demonstrated after shared-data/state renders:

- `renderAll()` still invokes Fixtures, Player Explorer, Team, Manual and Mini-League rendering regardless of the active route. The shipped manual-squad runtime already defers hidden Transfers DOM rendering.
- Player Explorer performs full-pool filtering/projection/sorting work when reached through `renderAll()` even while its Settings subroute is inactive.
- Fixtures rebuilds its team/Gameweek table and derived run/swing calculations when reached through `renderAll()` even while inactive.
- `teamsheet:data-rendered` invalidates and schedules Transfers calculation work even when Transfers is hidden. Exact optimisation remains in a Web Worker, but full-player projection preparation is main-thread work and yields in batches.
- `renderAll()` calls `renderMiniLeagues()`, then its `teamsheet:data-rendered` event causes the Mini-League runtime to merge discovered leagues and call `renderMiniLeagues()` again. A single `renderMiniLeagues()` also refreshes all nested League surfaces rather than only the visible nested route.
- Transfers currently has two route-change paths that reach its renderer when the Transfers route opens. Existing runtime tests prove the second render reconnects to the same in-flight Worker rather than creating a duplicate exact search.

These are demonstrated architecture/call-path findings, not proof of perceptible iPhone lag.

## Approved M1 boundary

Pritesh approved **M1 measurement instrumentation only** on 10 August 2026. M1 must not optimise or alter route scheduling.

The implementation deliberately stays outside every production build input. `scripts/measure-route-rendering.mjs` reads the exact generated `dist/app.bundle.js`, removes only the live startup IIFE using the same production-bundle boundary already protected by the test suite, inserts a temporary test-only probe before late runtime replacements, executes that instrumented copy through the existing zero-dependency harness, records measurements, and deletes the temporary file.

The probe records:

- render-call counts;
- inactive-route render-call counts;
- rough elapsed duration per observed function;
- `setChildren()` calls as a practical DOM-write/churn proxy;
- `xpOf()` calls as a projection-work proxy;
- `runScore()` calls as a fixture-derived-work proxy;
- hidden-versus-active `transferPerformanceScores()` execution;
- current route at every observation.

Observed boundaries include `renderAll`, Fixtures, Player Explorer, Team, Transfers, Manual squad, Mini Leagues and its nested surfaces, plus Transfers score preparation.

Representative synthetic flows are:

- cold-like verified render on Team;
- Team → Transfers;
- Transfers → Leagues;
- Leagues → Settings;
- foreground-style global render on Team;
- foreground-style global render on Transfers;
- manual-squad `teamsheet:data-rendered` fan-out.

The default command uses a synthetic 600-player pool:

```bash
node scripts/measure-route-rendering.mjs
```

A smaller explicit pool can be used for focused harness work:

```bash
node scripts/measure-route-rendering.mjs --players=120
```

The output is JSON so later checkpoints can retain and compare runs without adding a dependency or product UI.

## Evidence contract

The Node stub-DOM timing values are **rough relative harness evidence only**. They must never be described as browser timings, iPhone timings, paint/layout timings or proof of user-visible responsiveness.

Call counts, inactive-route classification and observed calculation/write proxies are stronger evidence because they describe which production-bundle paths execute under controlled flows. Browser DevTools/Safari Web Inspector and physical-device observation remain required before claiming a user-visible performance improvement.

No fixed millisecond budget is approved before a real browser/device baseline exists. A future optimisation should require repeatable evidence such as a meaningful main-thread delay, dropped interaction frame, significant inactive-route share of a global render, hidden Transfers preparation interfering with another route, or a demonstrably substantial reduction from removing duplicated work.

## M1 regression boundary

`tests/route-render-performance.test.mjs` must prove that:

- the production-bundle probe can observe the known route/render relationships;
- ordinary route navigation does not become a global render;
- inactive Fixtures and Player Explorer work is observable on Team global renders;
- duplicate Mini-League rendering is observable;
- hidden Transfers projection preparation is observable;
- the existing two Transfers route-render owners remain visible without asserting a duplicate Worker;
- practical DOM/projection work counters are populated;
- the four generated production outputs are byte-for-byte unchanged before and after the measurement run;
- M1 tooling remains outside `manifest.buildInputFiles`.

Because no build input changes, M1 requires **no generated-only commit**. The committed deployables must remain exactly the pre-M1 bytes and normal provenance/deterministic build CI must prove that they are still exactly reproducible from the unchanged production inputs.

## Explicit exclusions

M1 does not change:

- route scheduling, lazy rendering or dirty-generation behaviour;
- app-shell navigation/history/focus;
- Team, Transfers, Fixtures, Leagues, Settings or Player Detail UX;
- model/projection/expected-minutes/fixture/captaincy/squad/transfer/rank logic;
- Transfers exact optimiser or Worker ownership;
- Mini-League intelligence, standings/rival/exposure calculations or request policy;
- provider/data-source behaviour;
- persistence formats;
- Atomic Foreground Refresh sequencing or rollback;
- error-boundary ownership;
- shared-state architecture;
- bundler/module order, dependencies or framework/toolchain.

## Future recheck trigger

Do **not** rerun the full route/performance investigation simply because time has passed. Reconsider it when evidence or workload materially changes, especially:

1. once live-season Mini-League standings/rival/exposure data is genuinely populated and representative of normal use;
2. after a substantial rendering/app-shell/route ownership change;
3. after material growth in Transfers or Mini-League computation/workload;
4. if physical iPhone use shows delayed taps, navigation stutter, refresh hitching or temporary unresponsiveness;
5. after several feature checkpoints accumulate enough rendering work that the current baseline may no longer represent the app.

If none of those triggers occurs and M1 measurements remain marginal, the correct decision is to leave the rendering architecture alone rather than optimise for theoretical efficiency.

## Approval status after M1

M1 measurement tooling is approved. **No route-aware optimisation is approved.** Any future deduplication, active-route/dirty-generation rendering, hidden-Transfers scheduling change or Mini-League render narrowing requires a separate evidence-backed proposal and explicit owner approval.
