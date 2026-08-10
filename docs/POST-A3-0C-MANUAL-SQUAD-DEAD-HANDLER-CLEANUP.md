# Post-A3 0C — manual-squad dead-handler cleanup

Status: **complete and merged through PR #106 at `main` `b2d390db80f033d5cfade8dbd79f69523eef0990`.** Reviewed head `be9141415aaa67f8da03c63b8c086999285397c7` retained all 835 baseline tests and added one focused ownership regression: **836 passed, 0 failed, 0 skipped, 0 cancelled**. Deterministic build/provenance gates passed. No physical device testing was performed or claimed for this checkpoint.

Historical baseline: GitHub `main` `dd74365256fe6d9338b720ffecf1913e48ac77eb`, merge of post-A3 Checkpoint 0 PR #105. That baseline had **835 passing tests** and, from Checkpoint 0A, automatic push-triggered Verify Teamsheet coverage of `main` — proven by run #110 / `31383479683` on the exact merge commit.

This checkpoint was deliberately narrow. It removed proven-unreachable code and changed no live behaviour.

## Existing behaviour (fact)

`renderManual()` and `searchPlayers()` in `src/ui/views.mjs` rendered the manual-squad controls **and** attached per-button `click` listeners to the rendered `[data-rm]` and `[data-add]` hooks.

`manualSquadInstallBrowserRuntime()` in `src/ui/manual-squad-runtime.mjs` already owned the same two selectors through a listener registered on `document` with the capture flag set:

```
documentRef.addEventListener('click',event=>{ … event.stopImmediatePropagation?.(); … },true);
```

A capture-phase listener on `document` runs before any bubble-phase listener attached to the button itself, and `stopImmediatePropagation()` halts dispatch entirely. The per-button listeners in `views.mjs` therefore never ran in the shipped bundle. `tests/manual-squad-runtime.test.mjs` independently proves the bundler emits `manual-squad-runtime.mjs` after `views.mjs`, so the runtime is always installed.

The dead implementation was materially weaker than the live one. It omitted:

- the approved position quota, three-per-club and squad-budget checks in `manualSquadAddDecision()`;
- the safe persistence ordering in `manualSquadCommitAddition()`, where the configuration save runs only after a durable squad write;
- `setManualSquadPersistenceReady()` and the session-only persistence warnings added by A3;
- the FPL-T1 route-aware optimiser deferral.

This was a latent regression hazard — a second, dormant, weaker implementation of an owner-facing interaction — not an observed live defect. No user-visible behaviour was affected while both existed.

## Approved correction

- Remove only the two unreachable per-button click-handler blocks from `src/ui/views.mjs`.
- Keep `renderManual()` and `searchPlayers()` rendering the existing `data-rm` and `data-add` hooks unchanged.
- Keep `src/ui/manual-squad-runtime.mjs` **byte-unchanged** as the sole owner of add/remove interactions.
- Add regression coverage that fails if the legacy listeners return, if the rendered hooks disappear, or if the validating runtime stops owning the capture-phase path.

## Test changes and one judgement call

`tests/manual-squad-runtime.test.mjs` gains one new case, `manual squad add/remove interaction has exactly one validating runtime owner`. It asserts that `views.mjs` still renders both hooks, that `views.mjs` owns no click listener on either hook, and that the runtime retains its capture-phase registration, `stopImmediatePropagation()`, the `[data-add],[data-rm]` delegation target and the `manualSquadAddDecision()` validation call.

One existing A3 test needed re-pointing rather than removal. `manual squad builder has no unchecked squad persistence path` in `tests/persistence-resilience.test.mjs` asserted that the manual-squad region of `views.mjs` contained exactly two `ssetVerified(K_SQUAD` calls and the `persisted.ok`-before-`saveCfg()` ordering. Those two call sites were inside the dead blocks, so the assertions described code that is being deleted.

The test was **not** weakened, deleted or skipped. Its guarantee — that manual-squad persistence is always verified and correctly ordered — was moved to the file that now actually owns it, and made stricter on the file it left:

- `views.mjs` must now contain **zero** squad-persistence calls of any kind in its manual region, checked or unchecked. Previously two verified calls were permitted there.
- `manual-squad-runtime.mjs` must contain no raw `sset(K_SQUAD`, exactly the two `ssetVerified(K_SQUAD` call sites, and the `squadPersistence.ok`-gated configuration save.

The behavioural half of the same guarantee is already independently protected by the existing A3 cases `manual addition remains active in memory but skips config persistence when squad saving fails` and `manual addition reports config partial failure only after a durable squad save`, both of which exercise `manualSquadCommitAddition()` directly and were left untouched.

## Behaviour intentionally unchanged

No position, club, budget, purchase-price, persistence, manual-mode, optimiser, projection, expected-minutes, captaincy, transfer, fixture, simulation, rank, Mini-League, provider, data-source, navigation, Team or Transfers behaviour changes. Atomic Foreground Refresh and Refresh-Load R1 are untouched. `fpl:calib` was untouched by this checkpoint and was separately resolved later through PR #107.

## Verification

- Complete repository suite: **836 tests, 836 passed, 0 failed, 0 skipped, 0 cancelled** — the 835 baseline tests plus the one new ownership regression.
- Deterministic double production build with byte-identical output, root/deployable equality, exact build identity and reachable committed generated provenance.
- Exact merged change: source/tests/docs commit `08d1c45285087527209e2c91c50e5e673b7e3af6`, generated-only child and reviewed head `be9141415aaa67f8da03c63b8c086999285397c7`, merge commit `b2d390db80f033d5cfade8dbd79f69523eef0990`.

Physical device status: **none performed and none claimed.** That is a recorded evidence limitation, not an assertion of physical Safari acceptance.
