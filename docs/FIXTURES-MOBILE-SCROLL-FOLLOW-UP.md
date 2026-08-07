# Fixtures Mobile Scroll Follow-up

Status: approved implementation in review. Physical iPhone Safari retest is still required before Fixtures can be accepted.

## Trigger

During populated Fixtures acceptance on 7 August 2026, the six-Gameweek view fit on the owner's iPhone and the bottom of the page cleared the fixed dock. Expanding the horizon to 12 Gameweeks proved horizontal scrolling worked, but exposed three presentation defects:

1. the sticky team column did not remain visually coherent while the fixture cells travelled underneath it, and the TEAM header was not part of the sticky column;
2. the fallback explanation was rendered inside the horizontal scroll content, so swiping to later Gameweeks moved the explanation away and left a large empty area above the table;
3. the static introductory sentence claimed model attack/defence difficulty even while the live fallback correctly used Official FPL's overall 1–5 difficulty.

## Approved behaviour

- Keep the current fixture calculations, Official-FPL fallback, sort order, blank/double handling and projection behaviour unchanged.
- Keep the fallback explanation outside the horizontal scroller so it stays readable while the table moves.
- Make TEAM header and team rows one visually coherent sticky first column.
- Remove the scroller gutter that exposed travelled fixture cells to the left of the sticky team column.
- Use introductory wording that is true both when validated attack/defence strengths exist and when Official FPL difficulty is the fallback.

## Explicit exclusions

No changes to `src/model/fixtures.mjs`, `runScore`, `fixtureDifficulty`, team-strength inputs, Understat, odds, provider transport, player projections, transfer logic, captaincy, squad selection, rank, Mini-League logic or strategy. No model/golden expectation change is authorised.

## Automated validation

**Branch verification:** 656 passed, 0 failed, 0 skipped, 0 cancelled.

Focused regressions cover truthful copy, fallback-note placement outside the scroll container, shared sticky TEAM header/body structure and removal of the left scrolling gutter. The permanent PR verification workflow must still pass against the exact review head.

## Physical acceptance still required

On the deployed iPhone Safari build, repeat the 12-Gameweek view and confirm:

- GW1–GW12 can be reached by horizontal swipe;
- TEAM remains readable and fixed as fixture columns move behind it;
- no previous fixture cell appears to the left of TEAM;
- the Overall FPL difficulty explanation remains in place above the table;
- the final rows, legend and swing notes remain clear of the fixed bottom navigation.

Until that retest passes, Fixtures remains open under FPL-2 and Leagues does not become the active acceptance checkpoint.


<!-- FIXTURES-GW38-HORIZON-2026-08-07 -->
## GW38 horizon follow-up

Owner retest after PR #85 deployment confirmed that the corrected fallback explanation remains above the table and the sticky TEAM column now stays coherent while swiping. A separate issue was then reproduced: entering `23` in the horizon field left `23` visible but runtime silently clamped the calculation/render span to 12.

Approved behaviour:
- label the control as `Gameweeks`, default 6;
- allow 1–38 Gameweeks while never rendering or scoring beyond GW38;
- when the requested span would cross the season boundary, synchronise the visible value to the actual remaining-season span;
- keep `runScore`, fixture difficulty, Official-FPL fallback, blank/double treatment and projection formulas unchanged;
- suppress the existing three-plus-three Gameweek swing comparison when its later window would extend beyond GW38.

Validation: **660 passed, 0 failed, 0 skipped, 0 cancelled** on the implementation branch. Focused model regressions exercise 13-, 23- and 38-Gameweek spans and prove the existing attack-run and Official-FPL fallback formulas are unchanged. Physical iPhone Safari retest is still required after deployment before Fixtures can be accepted.
