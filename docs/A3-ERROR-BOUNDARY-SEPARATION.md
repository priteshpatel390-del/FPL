# A3 Error-Boundary Separation

Status: **complete, physically accepted on the executable iPhone Safari paths, merged and post-merge verified.** Package EB-1 merged through PR #108 at `main` `ba5daa2000345ddde3d8e6f6d381d44603e7cd29` from reviewed head `13224f53d7df95a295ee5f69124e99eb64e7a9e9`.

Post-merge verification: permanent Verify Teamsheet run #154 / `31410817472` completed successfully on the exact merge commit. The complete merged suite remains **856 tests, 856 passed, 0 failed, 0 skipped, 0 cancelled**; committed deployment provenance, the production build, deterministic rebuild, root/deployable equality, exact build identity and production-output preservation all passed.

Production-Bundle Safeguards and the later A3 State-Ownership Cleanup are now complete and merged. The next substantive A3 checkpoint is **Route-Aware Rendering and Performance**, beginning with investigation, measurement and evidence only; implementation is not approved.

## Candidate selection and merge

Two independent EB-1 implementations were produced concurrently and both reached a passing permanent `Verify Teamsheet` run: one on `agent/a3-error-boundary-separation` (848 tests, run #150 / `31405674786`) and one on `claude/a3-error-boundary-separation-zqx6hs` (856 tests, run #152 / `31407039275`). They converged on the same design and the same failure-ownership contract.

Pritesh selected the second on 10 August 2026 and it was consolidated onto `agent/a3-error-boundary-separation`. It was chosen because it keeps the literal `applyProviderResult()` call sites in the commit path — leaving the pre-existing shared-gate contract test completely untouched rather than rewriting it around a new wrapper name — because it appends the supporting-data note to the truthful Official FPL status line instead of replacing that line, and because it carries broader regression coverage. Before selection, the one regression the superseded candidate had and this one lacked, covering the Rule-B **retain** branch under an application exception, was ported across so no proven behaviour was lost.

The consolidated exact head `13224f53d7df95a295ee5f69124e99eb64e7a9e9` passed permanent Verify Teamsheet run #153 / `31408465921`, received the physical iPhone acceptance recorded below, and merged through PR #108. The two now-redundant EB-1 working branches were deleted after merge; the commits and review history remain preserved by GitHub.

## Purpose

Separate provider evidence from downstream application failures without changing provider acquisition policy, model behaviour, persistence contracts or Atomic Foreground Refresh orchestration.

The checkpoint fixes **who owns a failure**, not how any provider behaves.

## Confirmed defects addressed

**EB-1A — recovery-render errors were swallowed.** After a genuine Official FPL collection failure with an existing verified snapshot, the failure-path render ran inside `if(S.boot){ try{ renderVerifiedState(); }catch(error){} }`. The provider failure stayed visible, but a secondary UI failure disappeared entirely: the app reported that the previous verified data was on screen when it might not have been.

**EB-1B — unexpected supporting-provider computation errors masqueraded as provider evidence.** Any exception escaping `computeUnderstat()`, `computeOdds()` or `computeMinuteHistories()` was caught as `{outcome:'fallback', reason:'threw'}`. That result then flowed through the ordinary apply gate and published a provider-owned Fallback row, so an application bug was reported to the user as Understat or Odds being degraded.

## Contract

Only genuine provider evidence may move Provider Health.

| Failure | Class | Provider Health | State | Retry |
|---|---|---|---|---|
| Official FPL transport/gateway failure | `collection_failed` | Fallback with a verified snapshot, Unavailable without one | previous verified state stays active when one exists | transport-owned only |
| Official FPL validation/shape failure | `collection_failed`, `feedShape` | Unavailable on genuine validation evidence | restricted; no unverified core admitted | none |
| Supporting-provider transport/parse/mapping failure | not an application error | that provider's row only | Rule B retain or clear | provider cadence and cooldowns only |
| Atomic commit failure | `commit_failed` | restored exactly by the commit journal | exact rollback of commit-owned state | none |
| Render failure after a successful commit | `render_failed` | unchanged | committed data stays accepted | none |
| Persistence failure | `persist_failed` | unchanged | accepted state stays active for the session | none |
| Collection failure plus recovery-render failure | `collection_failed` primary, `secondaryErrorClass:'render_failed'` | the real provider classification survives | previous verified state stays active | none |
| Unexpected supporting-layer computation exception | `internal_error` | **not mutated** | Rule B still decides retain or clear | none |
| Unexpected refresh-lifecycle exception | `internal_error` | unchanged | previously accepted data stays active | none |

Additional rules:

- Detailed-minute degradation continues to affect only the detailed-minute health detail and never relabels the core Official FPL feed.
- Commit rollback keeps the approved exact Atomic Foreground Refresh contract, including state, Provider Health, XP cache values and references, and pending-recomputation Set identity.
- Persistence keeps every PR #104 guarantee.
- No global `window.onerror` or `unhandledrejection` swallowing layer is introduced.

## Implementation

The change is small and confined to `src/main.mjs`. No new error framework or runtime module was added.

**`internalProviderResult(name, error, extra)`** builds the application-owned result used when supporting computation throws. It carries `applicationOwned:true`, the underlying `internalError`, and a neutral note that describes the effect without blaming the provider.

**`ownApplicationError(name, result, apply)`** wraps — deliberately does not replace — the single shared `applyProviderResult()` gate. For an ordinary provider result it simply calls through. For an application-owned result it snapshots Provider Health, runs the same gate so Rule B's retain/clear decision is unchanged, then restores the pre-application health. If Rule B cleared an Understat or Odds value, that provider's row is removed rather than left describing a superseded provider result as active; if it cleared the minute layer, only the minute detail is removed from the otherwise truthful core FPL row. Because the wrapper takes the ordinary call as a thunk, the literal `applyProviderResult('understat' | 'odds' | 'minutes'` call sites stay in the commit path and the pre-existing shared-gate contract test needed no change.

**`reportCollectionFailure()`** now computes its status text and restricted-state copy first, then performs every render inside one guard. A throw is recorded in `renderError` and returned as `secondaryErrorClass:'render_failed'` beside the unchanged primary `collection_failed`. The function still never rethrows and never re-enters acquisition.

**`reportUnexpectedApplicationError()`** classifies an otherwise escaping lifecycle exception as `internal_error` with fixed safe copy, mutating no Provider Health.

**`runVerifiedRefresh()`** moves the startup gate, interaction lock, startup phase and `captureRefreshInputs()` inside the boundary, so ownership begins at the start of the refresh lifecycle rather than after input capture. The existing `finally` block still releases the lock, the gate and the refresh promise, and still runs a queued manual refresh.

## User-facing consequences

Provider failures keep their existing provider language. Application failures use application/display language:

- render failure after accepted data: `Data updated but the display failed to refresh.`
- collection failure plus display failure: the previous verified data remains active **and** the display failure is disclosed;
- unexpected supporting processing failure: the truthful Official FPL summary line is retained and a neutral note is appended — `· a supporting data layer could not be processed` — rather than falsely blaming Understat or Odds;
- otherwise escaping refresh-lifecycle exception: Teamsheet reports an application error and says whether previously accepted data remains active.

Raw exception messages are retained only on the returned diagnostic/test objects and are never rendered.

The global FPL data warning is unchanged and was not turned into a generic application-error banner.

## Automated verification

**856 tests, 856 passed, 0 failed, 0 skipped, 0 cancelled**, against the 842-test pre-EB-1 `main` baseline. All 842 were retained; the fourteen additions are in `tests/error-boundary-separation.test.mjs`. Three pinned assertions in `tests/atomic-foreground-refresh.test.mjs` were updated in place and none was weakened — see [Testing](TESTING.md) for the exact accounting, including why the shared-gate test 73 needed no change and why test 63 is now stricter than the empty-catch string it used to pin.

The candidate exact head passed permanent Verify Teamsheet run #153 / `31408465921`. After merge, run #154 / `31410817472` repeated the permanent gate on exact `main` merge commit `ba5daa2000345ddde3d8e6f6d381d44603e7cd29` and passed every stage.

## Physical iPhone Safari acceptance

Physical acceptance was performed against the exact PR #108 candidate temporarily published through GitHub Pages, then Pages was restored to `main` before merge.

Passed executable paths:

- **normal online startup:** the Team screen reached a usable state with truthful Official FPL status and no application-error/supporting-layer warning;
- **manual online refresh:** Official FPL refreshed successfully and the app remained usable; the observed Understat unavailable/cooldown wording remained a genuine provider fallback rather than an application error;
- **in-app offline refresh with saved verified data:** Teamsheet reported `Offline — still showing saved data from 10 Aug at 17:38.`, retained the accepted core state and remained usable;
- **return online and recover:** a subsequent manual refresh restored the live Official FPL summary and removed the offline warning without a page reload.

One device path was **not physically executable rather than failed**: in a new Private Safari tab with the phone already offline, Safari itself could not load the uncached GitHub Pages application shell. Therefore the no-core/clean-offline application state remains automated-test evidence, not physical-device evidence. This matches the already-known static-Pages limitation without a service worker.

The manual squad in the acceptance session was incomplete, so the offline device pass proves retained verified core data but does **not** independently prove survival of a previously available recommendation. The automated regressions remain the evidence for the full state contract.

## Explicit exclusions

No change to projections, calibration, expected minutes, scoring, fixtures, captaincy, squad selection, transfers, optimisation, simulation, chips, Global Rank, Mini-League/rival logic or strategy. No change to provider endpoints, provider weighting, retry cadence, Understat parsing or mapping policy, Odds methodology, provider/data-source architecture, D1/Cloudflare, Google Sheets, AI/agent architecture, navigation, Team Home, Transfers, renderer design, Production-Bundle Safeguards, State Ownership Cleanup or route-aware performance work. No later A3 remediation task was pulled forward.

## Remaining limitations

- The application boundary is narrow by design. An unexpected exception raised by an event handler outside the verified-refresh lifecycle still surfaces as an ordinary uncaught browser error; installing a global handler was deliberately rejected because it would hide real defects.
- The clean private-tab offline-first application state could not be physically exercised because Safari could not load the uncached static Pages shell while offline; automated coverage owns that path.
- The acceptance session used an incomplete manual squad, so recommendation-survival under offline refresh was not separately observed on device; verified core-state retention was observed.
- See ERR-1 to ERR-4 in [Known Limitations](KNOWN_LIMITATIONS.md).
