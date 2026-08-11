# A3-SC-1 Small Stale-Code Cleanup

Status: **implementation candidate in draft PR #116; not merged.**

## Baseline and purpose

A3-SC-1 is the narrow reviewed-deletion checkpoint that follows Route-Aware Rendering and Performance M1. The authoritative base is GitHub `main` `02ea634464cc415ac43d4b9cb13b4005fc276646`, merge of PR #115. Permanent Verify Teamsheet run #183 / `31459954883` and GitHub Pages run #119 succeeded on that exact base.

The checkpoint removes only two Mini-League convenience helpers proven unreachable after the earlier State-Ownership Cleanup:

- `rememberLeague()` and its export from `src/ui/mini-leagues-state.mjs`;
- `renderLeagueChips()` and its export from `src/ui/mini-leagues-view.mjs`.

The old `#leagueChips` DOM target is already absent. Live ownership remains with `upsertMiniLeague()` / `selectMiniLeague()` for Mini-League preference state and `renderMiniLeagues()` / `renderLeagueManageList()` for the rendered management path.

## Permanent regression boundary

`tests/stale-code-cleanup.test.mjs` requires the two stale helper names and old `#leagueChips` target to remain absent while asserting that the live state and rendering owners remain present. The test is structural by design: this checkpoint removes unreachable code and does not alter Mini-League calculations, network behaviour, persistence formats or user-facing rendering.

## Generated-output provenance

The approved source/test revision is `87ddea69810fa33498bf732aec37ab20b46f21b3`. The four generated deployables were regenerated from that reachable source revision by `build.mjs`; two builds were compared byte-for-byte before publication. The committed manifest records source hash `4e9b40f7b51e15e9485e4300353a214b5d9a95927a563a2062bcbe9588038b56`, build-input hash `14a385f18531f6d111b3020d2153967f3356d0aa237171d6563f1392da0d6bd2`, and source commit `87ddea69810fa33498bf732aec37ab20b46f21b3`.

The generated child is `e02990b8bf8b2ab7350d473d0629d04569e6e228`. A temporary branch-only workflow used to bridge the restricted execution environment was removed in that same generated commit and is not part of the PR diff.

## Verification status

Final permanent Verify Teamsheet evidence is still required on the complete clean PR head before this checkpoint may be called complete. Earlier helper/workflow runs are not substitutes for that permanent repository gate.

No physical iPhone testing has been performed or claimed. This cleanup has no intended visual or interaction change.

## Explicit exclusions

A3-SC-1 does not change model, projection, expected-minutes, fixture, captaincy, squad, transfer, optimiser, rank, Mini-League/rival intelligence, provider/data-source behaviour, persistence formats, navigation, route-aware optimisation, state architecture, error ownership, bundler/module order, dependencies or framework/toolchain.

`escapeHTML`, legacy Mini-League migration inputs, the one-way `S.leagues` compatibility bridge, legacy route redirects, late runtime replacements and bundle-order contracts remain intentionally untouched.

## Approval boundary

Pritesh approved this narrow implementation and factual stale-documentation reconciliation. **Merge remains separately approval-gated.** Do not merge PR #116 until permanent verification is green and Pritesh explicitly approves the merge.
