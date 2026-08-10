# `fpl:calib` compatibility and resilience

Status: implementation candidate under review. Owner-approved design package: fail closed on legacy/unverified calibration. This record must not be treated as merged or accepted until PR verification and owner review complete.

## Baseline

Implementation branch starts from `main` `b2d390db80f033d5cfade8dbd79f69523eef0990`, merge of PR #106. Baseline evidence at that merge: 836 passed, 0 failed, 0 skipped, 0 cancelled; Verify Teamsheet run #113 succeeded on the exact merge SHA.

## Confirmed pre-change defect

`fpl:calib` was the remaining PERSIST-4 exception to the A3 persistence compatibility boundary. Startup read the record through generic JSON storage and, for any truthy parsed value, assigned `cal.calib` directly to `S.calib`. No target-season, model, rules, persistence-version, methodology, dataset-identity or factor-shape contract was enforced before the stored values could affect live-season projected points.

The current Stage 7 walk-forward check is diagnostic-only. It writes `S.backtest` for the session but does not write `fpl:calib`, assign production `S.calib`, or change current projections. The older production calibration writer was removed when Stage 7 replaced the method-flattered H1/H2 diagnostic path.

## Approved contract

The approved narrow package is compatibility safety only:

- every currently stored `fpl:calib` record is treated as unverified and rejected from active model state;
- rejected bytes are preserved rather than migrated, rewritten or deleted;
- startup receives no calibration record, so `S.calib` remains null unless a future separately approved production compatibility contract exists;
- standard uncalibrated projections remain active;
- the user receives a fixed truthful local warning when rejected or malformed calibration bytes are present;
- the existing production calibration formula is not changed;
- the current walk-forward diagnostic remains manual and diagnostic-only;
- no production calibration generator, methodology or calibration values are introduced.

This intentionally does **not** implement the proposed future versioned calibration envelope. A future production record must define and approve target season, model/rules ownership, methodology identity, dataset identity and factor validation before any record may be accepted.

## Cache behaviour

No new calibration can activate in this package, so there is no new mid-session calibration transition to invalidate. Startup rejection happens before the legacy assignment in `views.mjs`; existing `renderAll()` continues to clear `xpCache` on normal data renders. If production calibration activation is reintroduced later, that future checkpoint must explicitly clear `xpCache` and invalidate dependent Transfers calculation state.

## User-facing fallback

When saved calibration cannot be verified, Teamsheet states that it is not being applied and that standard uncalibrated projections are active. The rest of the application and provider state remain available. Calibration storage failure or rejection is not reported as an Official FPL/provider failure.

## Validation package

Focused regressions cover:

- legacy calibration bytes fail closed and remain byte-for-byte preserved;
- malformed calibration JSON fails closed without replacement;
- speculative versioned records remain rejected until a production methodology is approved;
- startup can assign calibration only if the storage compatibility gate returns a record;
- current walk-forward code has no calibration persistence writer and does not assign `S.calib`;
- the existing scoring calibration formula remains unchanged.

The full repository suite, deterministic double build, provenance and build-identity gates remain mandatory before this checkpoint may be called complete.

## Model and accuracy statement

This checkpoint changes whether an unverified saved multiplier may be applied, so it passed the project model approval gate before implementation. It does not tune the projection model and makes no claim of improved predictive accuracy or FPL performance. Historical aggregate correlation and the legacy H1/H2 calibration are not out-of-sample proof.

## Exclusions

No changes to raw projection weights, expected minutes, fixture scoring, captaincy, squad selection, Transfers optimisation, chips, simulation, rank, Mini-League intelligence, providers, Understat, Odds, D1/Cloudflare persistence, Google Sheets, AI assistant/agents, Error-Boundary Separation, Production-Bundle Safeguards, State Ownership Cleanup or route-aware rendering.
