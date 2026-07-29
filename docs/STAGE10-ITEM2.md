# Stage 10.2 — Official Outcome Collection

Status: **complete and merged through PR #29 at `4b1b2acf9bda81afb63414dd41b509e80b3945c7` after owner approval.** Approved and accepted 29 July 2026.

## Objective
Collect immutable Official FPL facts after each Gameweek so a later Stage 10.3 item can compare them with the correct frozen pre-deadline snapshot. This item records outcomes only and calculates no model-evaluation metric.

## Delivered scope
- Official FPL `/event/{gw}/live/` all-player Gameweek outcomes.
- Official FPL `/fixtures/?event={gw}` fixture identity, scores, completion and allowlisted match statistics.
- Official event `finished` plus `data_checked` finalisation; `finished` alone is insufficient.
- Optional public manager picks/history outcome with captain, vice, bench, multipliers, automatic substitutions, chips and transfer-cost context, without persisting Team ID.
- Explicit provisional, complete and corrected immutable revisions.
- Strict duplicate-player quarantine and conflicting-fixture rejection.
- Deterministic section hashes, outcome-data hashes, whole-record hashes and revision IDs.
- Strict matching to locally eligible Stage 10.1 snapshots; unmatched outcomes remain valid factual records.
- Automatic non-blocking startup/foreground collection, 15-minute provisional checks, 14-day correction checks and bounded six-Gameweek catch-up.
- Verified compressed local writes, interrupted-write journal, 50-row metadata bound, current-season full records, six superseded revisions and a 3 MiB encoded target.
- Complete unencrypted JSON export/restore with recovery imports forced non-current.
- Subordinate Official outcomes status and recovery controls under More > Deadline evidence.

## Source hierarchy
1. `/event/{gw}/live/` — canonical all-player Gameweek totals and per-fixture explanations.
2. `/fixtures/?event={gw}` — canonical fixture assignment and completion.
3. `/bootstrap-static/` event row — deadline, `finished` and `data_checked`.
4. `/entry/{id}/event/{gw}/picks/` — optional detailed real-squad outcome.
5. `/entry/{id}/history/` — optional manager-summary cross-check and catch-up support.

No new provider, authentication, FPL write action, transfer-history archive or all-player element-summary fan-out was added.

## Lifecycle
- `provisional`: valid official facts exist but the Gameweek is not fully finished and checked, player detail is incomplete, or an assigned fixture remains unresolved.
- `complete`: every assigned fixture is finished, the event is finished and data-checked, and all-player totals pass validation.
- `corrected`: a later complete Official FPL result differs from an earlier complete/corrected revision.

Every accepted revision is immutable. Identical rechecks update check metadata without creating duplicate full records.

## Verification
- Full suite: **376/376 passing**.
- Production build succeeded.
- Two exact-identity builds were byte-identical.
- Root `index.html` matched `dist/index.html` exactly.
- Existing tests were not weakened or regenerated.
- Verified source: `e84e7f1bf05ed1f3e574f78101e4a6e413273306`; generated artefacts: `9d81210b493ab40a542c50709733b14e448a481c`.
- Merged through PR #29 at `4b1b2acf9bda81afb63414dd41b509e80b3945c7` after owner approval.

## Deliberately unchanged
No projection, expected-minutes, scoring, fixture-strength, calibration, simulation, captaincy, best-XI, squad-selection, transfer-optimiser, provider-blend or FPL-account behaviour changed. No Stage 10.3 metric or retrospective recommendation was implemented.

## Known limitations
- The browser cannot run while fully closed or suspended; catch-up begins when Teamsheet next opens.
- The undocumented live 2026/27 endpoint still requires first-live-GW operational observation; validators fail closed on schema drift.
- Local evidence is bounded recovery, not a permanent server archive. Exports are complete but unencrypted.
- A manager outcome can be unavailable while the global player/fixture outcome remains complete.
- Outcome collection proves collection integrity, not model accuracy.
