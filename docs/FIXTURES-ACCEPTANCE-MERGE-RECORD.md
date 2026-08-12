# Fixtures Populated Acceptance — Merge Record

Status: **Complete, merged, deployed and physically accepted on 7 August 2026.**

Purpose: authoritative checkpoint record for the completed Fixtures populated/live iPhone Safari acceptance sequence. This supersedes earlier current-status wording that described Fixtures, PR #85 or PR #86 as awaiting deployment or physical retest.

## Final application checkpoint

- `main` at this checkpoint: `e49599a75bbb77618292fdb6100fcffd81685c44` — merge of PR #86, **Extend Fixtures horizon through GW38**. Read the current `main` live with `git rev-parse origin/main`.
- Exact reviewed PR #86 head: `be90b4f25b90472a3f30b3b765e56d23d8d95862`.
- Reviewed head and merge commit share Git tree: `007ef40c5b4810777cfefec027cc80bf90fc19e0`.
- Permanent Verify Teamsheet run `31198545580`: **660 tests, 660 passed, 0 failed, 0 skipped, 0 cancelled**.
- Two exact-identity production builds were byte-identical.
- Root `index.html` equalled `dist/index.html`.
- `dist/manifest.json` matched the exact reviewed PR head identity.
- GitHub Pages deployed merge commit `e49599a75bbb77618292fdb6100fcffd81685c44` successfully.

## Accepted sequence

### PR #85 — horizontal-scroll presentation

PR #85 merged at `01c16588b63bf41b099adc64b6a1c9044eba9eec` from exact reviewed head `6b111ce7a8a748204e458890798361f59b9dac80` after **656 passing tests** and deterministic build verification. It changed presentation only: the fallback explanation remains outside the horizontal scroller, TEAM header/body behave as one sticky first column, the left scrolling gutter is removed, and the intro copy is truthful in Official-FPL fallback mode.

### PR #86 — horizon through GW38

Owner testing of PR #85 exposed a distinct UI/runtime mismatch: values above 12 could remain visible while the renderer silently used 12. PR #86 allows the requested horizon through GW38, caps at the remaining season and synchronises the visible control value. Existing fixture difficulty, `runScore`, Official-FPL fallback, blank/double and projection formulas are unchanged.

## Owner physical iPhone Safari acceptance

After PR #86 was deployed, Pritesh confirmed on the live iPhone Safari build:

1. From GW1, entering `Gameweeks = 23` leaves the field at 23 and allows the ticker to reach GW23.
2. Swiping beyond GW12 keeps TEAM fixed and readable; the earlier sticky-column defect does not recur.
3. From GW30, requesting 23 normalises the visible horizon to 9 and stops at GW38 with no GW39+ column.

Earlier acceptance evidence also established that the final Fixtures rows, legend and notes can clear the fixed bottom dock and that the Official-FPL fallback explanation remains visible above the horizontally scrolling table.

Physical acceptance was performed by the owner. No claim is made that the assistant independently operated or instrumented the device.

## Calculation/provider boundary

No fixture formula or provider/source change was made by the accepted follow-ups. Specifically unchanged:
- `fixtureDifficulty` and `runScore` mathematics;
- Official FPL overall-FDR fallback semantics;
- blank/double handling;
- player projection formulas;
- squad, captaincy and transfer calculations;
- provider transport, validation or data-source set;
- Mini-League, rival, projected-rank or strategy logic.

The GW38 work expanded only the user-requested span within the already documented formula contract. It does not create a prediction-accuracy claim.

## Closure and next checkpoint

- `UI-15` — Fixtures mobile sticky-column/fallback-note defect: **closed** through PR #85 and physical retest.
- `UI-16` — silent 12-Gameweek horizon cap: **closed** through PR #86 and physical retest.
- `FPL-2` — remains **open for Leagues only**.
- `ML-3` — remains **open** until Leagues receives physical iPhone/live populated-data acceptance.

The next substantive project checkpoint is **investigation-only Leagues populated/live acceptance**. Testing existing Leagues behaviour is authorised; implementation remains separately gated. No projected rank, rival-score prediction, effective-ownership strategy, differential recommendation or protect/balanced/chase logic may be introduced without the existing explicit approval gate.
