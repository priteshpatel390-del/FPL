# A3-SC-1 Small Stale-Code Cleanup

Status: **complete, merged and post-merge verified through PR #116.**

## Baseline and purpose

A3-SC-1 is the narrow reviewed-deletion checkpoint that followed Route-Aware Rendering and Performance M1. Its authoritative base was GitHub `main` `02ea634464cc415ac43d4b9cb13b4005fc276646`, merge of PR #115. Permanent Verify Teamsheet run #183 / `31459954883` succeeded on that exact base, on an **866-test** baseline.

The checkpoint removes only two Mini-League convenience helpers proven unreachable after the earlier State-Ownership Cleanup:

- `rememberLeague()` and its export from `src/ui/mini-leagues-state.mjs`;
- `renderLeagueChips()` and its export from `src/ui/mini-leagues-view.mjs`.

The old `#leagueChips` DOM target is already absent. Live ownership remains with `upsertMiniLeague()` / `selectMiniLeague()` for Mini-League preference state and `renderMiniLeagues()` / `renderLeagueManageList()` for the rendered management path.

## Investigation finding

The original investigation searched application source, the generated bundle, `app.html`, runtime replacements and event wiring, and found no consumer of either helper. That search was **incomplete**: it did not cover the test tree. Two test-side consumers existed and are the sole cause of the first CI failure recorded below.

Future stale-code investigations must therefore search production source, test source, shared harness/export lists, mocks/fixtures, runtime replacement mechanisms, generated bundle/deployable surfaces and DOM/event references before treating a symbol as safely unreachable.

## Retained false positives

The investigation also examined, and deliberately **retained**, code that superficially looks unused but is live or intentionally kept:

`escapeHTML` / `ESC_MAP`, the one-way `S.leagues` compatibility bridge, legacy Mini-League persistence/migration inputs, legacy route redirects for old Players/League/More routes, the late `renderThread` runtime replacement, `src/ui/backtest-copy.mjs`, `src/model/xp.mjs`, `src/ui/security-wiring.mjs`, and the route-render duplication measured by M1.

A3-SC-1 is not a general cleanup exercise and must not be broadened.

## First CI failure and correction

Verify Teamsheet run #192 / `31466740132` failed the complete-suite stage on PR head `6d5ac63cc62a3529605177630acaf5f7a9f51e32`, reporting **791 tests, 754 passed, 37 failed**. The production build, deterministic rebuild, build identity and output-preservation stages were skipped because the suite failed first. Committed deployment provenance passed.

The root cause was a single stale reference, not a defect in the approved deletion. `tests/harness.mjs` `loadApp()` evaluates the generated bundle and then re-exports a fixed list of bundle identifiers by name. That list still contained `rememberLeague` and `renderLeagueChips`, so the appended `Object.assign(...)` threw `ReferenceError: rememberLeague is not defined` inside `loadApp()`. Because every bundle-executing suite calls `loadApp()`, the failure fanned out across the suite and aborted whole test files, which is why the reported total fell from 866 to 791.

The corrections are confined to the test tree:

- `tests/harness.mjs` no longer re-exports the two deleted helpers. It now exposes `initMiniLeagues` and `renderMiniLeagues`, which are live bundle identifiers.
- `tests/rendering-security.test.mjs` — `XSS-1: hostile entry and saved-league names render as text nodes` previously exercised the deleted `renderLeagueChips()` and asserted on the removed `#leagueChips` target. It is **re-pointed to the live renderer** rather than weakened: it now initialises the Mini-League runtime, renders through `renderMiniLeagues()`, and asserts on `leagueManageList`. Both original guarantees are preserved unchanged — a hostile saved-league name must render as inert visible text, and a legacy `S.leagues` write must not reach saved-league rendering.

A second failure then surfaced: `documentation-integrity.test.mjs` requires every Markdown record under `docs/` to be linked from `docs/HISTORICAL_RECORDS.md`, and this record was not indexed. It is now indexed.

No test or golden was deleted, weakened, regenerated or skipped.

## Permanent regression boundary

`tests/stale-code-cleanup.test.mjs` requires the two stale helper names and the old `#leagueChips` target to remain absent while asserting that the live state and rendering owners remain present: `renderLeagueManageList()`, `renderMiniLeagues()`, `upsertMiniLeague()`, and `selectMiniLeague()` delegating to canonical `upsertMiniLeague()`.

A second regression pins the failure mode CI actually found: the deleted helpers must remain absent from **both** the generated `dist/app.bundle.js` and `tests/harness.mjs`, so a future stale harness entry is caught directly instead of as a suite-wide `ReferenceError`.

The tests are structural by design: this checkpoint removes unreachable code and does not alter Mini-League calculations, network behaviour, persistence formats or user-facing rendering.

The existing brittle `selectMiniLeague` exact-source-string assertion remains deliberately untouched. It is deferred test-hardening debt only and is not part of this cleanup or A3 documentation closeout.

## Generated-output provenance

The approved source revision is `87ddea69810fa33498bf732aec37ab20b46f21b3`. The four generated deployables were produced from that reachable source revision by `build.mjs`. The committed manifest records source hash `4e9b40f7b51e15e9485e4300353a214b5d9a95927a563a2062bcbe9588038b56`, build-input hash `14a385f18531f6d111b3020d2153967f3356d0aa237171d6563f1392da0d6bd2`, and source commit `87ddea69810fa33498bf732aec37ab20b46f21b3`.

The generated child is `e02990b8bf8b2ab7350d473d0629d04569e6e228`. `scripts/verify-build-provenance.mjs` reproduces the committed outputs exactly from that source revision.

The CI correction changed only `tests/` and `docs/` files. Neither is a build input — the manifest's 54 build inputs are `src/**`, `app.html`, `build.mjs` and `build-utils.mjs` — so the generated deployables are unchanged by the correction and were **not** rebuilt or hand-edited.

A temporary branch-only workflow, used earlier to bridge a restricted execution environment that could not clone GitHub, was removed before the final diff. `.github/workflows/` contains only `verify.yml` on `main`, on the reviewed PR head and in the merged tree, and the repository security test rejecting write-enabled workflow permissions is unchanged.

## Verification status

Local verification on the corrected candidate tree: `./run-tests.sh` passed **868 tests, 868 passed, 0 failed, 0 skipped, 0 cancelled**, and `scripts/verify-build-provenance.mjs` verified committed provenance from the reachable source revision. That is 866 inherited from the PR #115 base plus the two A3-SC-1 structural regressions.

Permanent candidate evidence is Verify Teamsheet run #193 / `31469449540` on exact reviewed head `097fabb6065afc4c322238985eb7f237a503a7c3`: **868 tests, 868 passed, 0 failed, 0 skipped, 0 cancelled**, committed provenance, production build, deterministic rebuild, root/deployable equality, exact build identity and production-output preservation all passed.

PR #116 subsequently merged using a merge commit. The A3 engineering baseline entering documentation closeout is `1060e60d3affadabdf97924c7ece85cc62d8e360`. Permanent post-merge Verify Teamsheet run #194 / `31470879289` passed the repository verification gate on that exact merge commit, and GitHub Pages run #120 / `31470878300` succeeded for the same merge commit.

No physical iPhone testing was performed or claimed for PR #116. This cleanup has no intended visual or interaction change; automated evidence is the governing evidence for this checkpoint.

## Explicit exclusions

A3-SC-1 does not change model, projection, expected-minutes, fixture, captaincy, squad, transfer, optimiser, rank, Mini-League/rival intelligence, provider/data-source behaviour, persistence formats, navigation, route-aware optimisation, state architecture, error ownership, bundler/module order, dependencies or framework/toolchain.

`escapeHTML`, legacy Mini-League migration inputs, the one-way `S.leagues` compatibility bridge, legacy route redirects, late runtime replacements and bundle-order contracts remain intentionally untouched.

## Limitations

The deletion is proven unreachable by source, bundle, DOM and harness search plus the full automated suite. That is not a runtime proof on a physical device, and none is claimed.

The exact-source-string `selectMiniLeague` test assertion remains brittle by design for now. Hardening it is a separate, future narrow test task and does not reopen A3-SC-1.

## Closeout status

Pritesh approved the narrow A3-SC-1 implementation and subsequently approved its merge. PR #116 is merged and closed. A3-SC-1 is therefore complete. The documentation/architecture reconciliation that follows is the final A3 closeout layer rather than further engineering remediation; separately tracked future work does not reopen A3-SC-1.
