# A3 Error-Boundary Separation

Status: owner-approved implementation candidate (Package EB-1) on `agent/a3-error-boundary-separation`, draft PR #108. Investigation and design are complete and implementation was explicitly approved. **Merge is not approved.**

Baseline: `main` `d112c673310149a4463def1758242460450600dc`, the merge of `fpl:calib` compatibility PR #107.

## Candidate selection

Two independent EB-1 implementations were produced concurrently and both reached a passing permanent `Verify Teamsheet` run: one on `agent/a3-error-boundary-separation` (848 tests, run #150 / `31405674786`) and one on `claude/a3-error-boundary-separation-zqx6hs` (856 tests, run #152 / `31407039275`). They converged on the same design and the same failure-ownership contract.

Pritesh selected the second on 10 August 2026 and it is now the single canonical candidate on `agent/a3-error-boundary-separation`. It was chosen because it keeps the literal `applyProviderResult()` call sites in the commit path — leaving the pre-existing shared-gate contract test completely untouched rather than rewriting it around a new wrapper name — because it appends the supporting-data note to the truthful Official FPL status line instead of replacing that line, and because it carries broader regression coverage. Before selection, the one regression the superseded candidate had and this one lacked, covering the Rule-B **retain** branch under an application exception, was ported across so no proven behaviour was lost. The superseded branch is retained unmodified as history.

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

## Tests

**856 tests, 856 passed, 0 failed, 0 skipped, 0 cancelled**, against the 842-test `main` baseline. All 842 are retained; the fourteen additions are in `tests/error-boundary-separation.test.mjs`. Three pinned assertions in `tests/atomic-foreground-refresh.test.mjs` were updated in place and none was weakened — see [Testing](TESTING.md) for the exact accounting, including why the shared-gate test 73 needed no change and why test 63 is now stricter than the empty-catch string it used to pin.

## Explicit exclusions

No change to projections, calibration, expected minutes, scoring, fixtures, captaincy, squad selection, transfers, optimisation, simulation, chips, Global Rank, Mini-League/rival logic or strategy. No change to provider endpoints, provider weighting, retry cadence, Understat parsing or mapping policy, Odds methodology, provider/data-source architecture, D1/Cloudflare, Google Sheets, AI/agent architecture, navigation, Team Home, Transfers, renderer design, Production-Bundle Safeguards, State Ownership Cleanup or route-aware performance work. No later A3 remediation task was pulled forward.

## Limitations

- No physical iPhone Safari acceptance has been performed for this checkpoint, and none is claimed. The changed copy is user-visible on failure paths, so an owner device pass is advisable before merge if the owner wants the new failure wording confirmed on the device.
- The application boundary is narrow by design. An unexpected exception raised by an event handler outside the verified-refresh lifecycle still surfaces as an ordinary uncaught browser error; installing a global handler was deliberately rejected because it would hide real defects.
- See ERR-1 to ERR-4 in [Known Limitations](KNOWN_LIMITATIONS.md).
