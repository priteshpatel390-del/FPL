# Fixtures Mobile Scroll and GW38 Follow-up

Status: **Complete, merged, deployed and physically accepted on iPhone Safari.**

## Trigger

Populated Fixtures acceptance on 7 August 2026 first showed that six Gameweeks fit the owner's iPhone and that the final rows/notes cleared the fixed dock. Expanding the horizon exposed two separate issues in sequence.

### PR #85 — mobile horizontal-scroll presentation

At 12 Gameweeks horizontal scrolling worked, but the TEAM column/header became visually incoherent, the fallback explanation travelled with the table, and the static intro copy contradicted the active Official-FPL fallback.

Approved and merged behaviour:
- keep fixture calculations, Official-FPL fallback, sort order, blanks/doubles and projections unchanged;
- keep the fallback explanation outside the horizontal scroller;
- make TEAM header and team rows one coherent sticky first column;
- remove the left scrolling gutter;
- use intro wording that is true in both strength and Official-FPL fallback modes.

Merge evidence:
- PR #85 merge commit: `01c16588b63bf41b099adc64b6a1c9044eba9eec`;
- exact reviewed head: `6b111ce7a8a748204e458890798361f59b9dac80`;
- branch verification: **656 passed, 0 failed, 0 skipped, 0 cancelled**;
- deterministic build and exact build identity passed.

The deployed correction was physically confirmed on the owner's iPhone Safari during the next acceptance step: TEAM remained fixed/readable beyond GW12 and the fallback explanation stayed above the table.

### PR #86 — remaining-season horizon through GW38

The PR #85 retest then exposed a separate defect: Safari could display a typed value such as `23` while runtime silently clamped the calculation/render span to 12.

Approved and merged behaviour:
- label the control `Gameweeks`, default 6;
- allow 1–38 Gameweeks;
- cap the actual span at the remaining season so no GW39+ period is rendered or scored;
- synchronise the visible value to the actual remaining-season span;
- preserve `runScore`, fixture difficulty, Official-FPL fallback, blanks/doubles and projection formulas;
- suppress the existing three-plus-three swing comparison when its later window would extend beyond GW38.

Merge/verification evidence:
- PR #86 merge commit/current application checkpoint: `e49599a75bbb77618292fdb6100fcffd81685c44`;
- exact reviewed head: `be90b4f25b90472a3f30b3b765e56d23d8d95862`;
- reviewed head and merge commit share Git tree `007ef40c5b4810777cfefec027cc80bf90fc19e0`;
- permanent Verify Teamsheet run `31198545580`: **660 tests, 660 passed, 0 failed, 0 skipped, 0 cancelled**;
- deterministic byte-identical double build, root/deployable equality and exact manifest identity passed;
- GitHub Pages deployment for `e49599a75bbb77618292fdb6100fcffd81685c44` succeeded.

## Physical acceptance passed

Pritesh performed the deployed iPhone Safari check and confirmed:
- From GW1, `Gameweeks = 23` remains 23 and the ticker reaches GW23;
- horizontal scrolling beyond GW12 keeps TEAM fixed/readable;
- From GW30, requesting 23 normalises the visible horizon to 9;
- the table stops at GW38 and does not expose GW39+.

This is owner-performed physical evidence. It is not an assistant/device-lab claim.

## Explicit exclusions

No changes were made to `fixtureDifficulty`, `runScore`, Official-FPL fallback mathematics, blank/double treatment, player projections, provider/source behaviour, transfers, captaincy, squad selection, rank, Mini-League calculations or strategy logic. No prediction-accuracy improvement is claimed.

## Current status

Fixtures populated/live acceptance is complete. UI-15 and UI-16 are closed. FPL-2 remains open for **Leagues only**; ML-3 remains the Leagues physical/live acceptance gate. `docs/FIXTURES-ACCEPTANCE-MERGE-RECORD.md` is the authoritative checkpoint summary.
