from pathlib import Path
import re
import subprocess
import sys

BASE = 'e49599a75bbb77618292fdb6100fcffd81685c44'
EXPECTED_DOCS = {
    'CLAUDE.md',
    'docs/PROJECT_CONTEXT.md',
    'docs/ROADMAP.md',
    'docs/KNOWN_LIMITATIONS.md',
    'docs/TESTING.md',
    'docs/FIXTURES-MOBILE-SCROLL-FOLLOW-UP.md',
    'docs/FIXTURES-ACCEPTANCE-MERGE-RECORD.md',
}


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one exact match, found {count}')
    write(path, text.replace(old, new, 1))


def replace_all_required(path, old, new):
    text = read(path)
    count = text.count(old)
    if count < 1:
        raise SystemExit(f'{path}: expected at least one exact match')
    write(path, text.replace(old, new))


def replace_regex_once(path, pattern, new):
    text = read(path)
    updated, count = re.subn(pattern, new, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{path}: expected one regex match, found {count}')
    write(path, updated)


def insert_after_title(path, marker, block):
    text = read(path)
    if marker in text:
        raise SystemExit(f'{path}: marker already present')
    first, rest = text.split('\n', 1)
    write(path, first + '\n\n' + block.rstrip() + '\n\n' + rest.lstrip('\n'))


def apply_claude():
    replace_regex_once(
        'CLAUDE.md',
        r'<!-- FIXTURES-GW38-HORIZON-2026-08-07 -->\n> .*?\n\n',
        """<!-- FIXTURES-ACCEPTANCE-2026-08-07 -->
> **Current merged application checkpoint — Fixtures populated acceptance complete:** PR #85 fixed the mobile horizontal-scroll presentation and merged at `01c16588b63bf41b099adc64b6a1c9044eba9eec`. PR #86 removed the silent 12-Gameweek horizon cap and merged at current `main` `e49599a75bbb77618292fdb6100fcffd81685c44`. The exact PR #86 head `be90b4f25b90472a3f30b3b765e56d23d8d95862` passed **660 tests, 660 passed, 0 failed, 0 skipped, 0 cancelled**, deterministic byte-identical double-build verification, root/deployable equality and exact manifest build identity; the reviewed head and merge commit share Git tree `007ef40c5b4810777cfefec027cc80bf90fc19e0`. GitHub Pages deployment of the merge commit succeeded. Pritesh then physically accepted the populated Fixtures path on iPhone Safari: a 23-Gameweek request remains 23 and reaches GW23, horizontal scrolling beyond GW12 keeps TEAM fixed/readable, and from GW30 a 23-Gameweek request normalises to 9 and stops at GW38 with no post-season column. `docs/FIXTURES-ACCEPTANCE-MERGE-RECORD.md` is authoritative. Remaining feature-specific populated live acceptance is **Leagues only**. No fixture formula, provider, projection, transfer, rank, Mini-League or strategy logic changed.

"""
    )
    replace_regex_once(
        'CLAUDE.md',
        r'<!-- FIXTURES-MOBILE-SCROLL-FOLLOW-UP-2026-08-07 -->\n> .*?\n\n',
        """<!-- FIXTURES-MOBILE-SCROLL-FOLLOW-UP-2026-08-07 -->
> **Historical Fixtures mobile follow-up — complete:** PR #85 corrected the sticky TEAM column/header, kept the fallback explanation outside the horizontal scroller and made the intro copy truthful in Official-FPL fallback mode. The deployed correction was physically confirmed on iPhone Safari during the subsequent long-horizon acceptance. PR #86 then completed the separate GW38 horizon follow-up. See `docs/FIXTURES-ACCEPTANCE-MERGE-RECORD.md` for the authoritative current record.

"""
    )

    old_order = """1. `docs/TEAM-UX-T01-T02-MERGE-RECORD.md` — authoritative record for the current merged Team populated-acceptance checkpoint
2. `docs/UX-A2-DOCK-LAYERING-FOLLOW-UP.md` — authoritative record for the preceding PR #78 dock-layering correction
3. `docs/UX-A2-MERGE-RECORD.md` — authoritative record for the preceding PR #76 UX-A2 checkpoint
4. `docs/UX-A1-MERGE-RECORD.md` — preceding UX-A1 checkpoint
5. `docs/PROJECT_CONTEXT.md`
6. `docs/ARCHITECTURE.md`
7. `docs/DECISIONS.md`
8. `docs/ROADMAP.md`
9. `docs/KNOWN_LIMITATIONS.md`
10. `docs/TEAMSHEET2-PRODUCT-BLUEPRINT.md`
11. The current checkpoint design document
12. Before provider/security work: `docs/DATA_SOURCES.md` and `docs/SECURITY.md`
13. Before model/projection/squad/optimisation work: `docs/PROJECTION_MODEL.md` and `docs/TESTING.md`
14. History only when needed: `docs/STAGE_HISTORY.md`, `docs/CHANGELOG.md`, earlier stage/audit records"""
    new_order = """1. `docs/FIXTURES-ACCEPTANCE-MERGE-RECORD.md` — authoritative record for the current merged Fixtures populated-acceptance checkpoint
2. `docs/TEAM-UX-T01-T02-MERGE-RECORD.md` — authoritative record for the preceding Team populated-acceptance checkpoint
3. `docs/UX-A2-DOCK-LAYERING-FOLLOW-UP.md` — authoritative record for the preceding PR #78 dock-layering correction
4. `docs/UX-A2-MERGE-RECORD.md` — authoritative record for the preceding PR #76 UX-A2 checkpoint
5. `docs/UX-A1-MERGE-RECORD.md` — preceding UX-A1 checkpoint
6. `docs/PROJECT_CONTEXT.md`
7. `docs/ARCHITECTURE.md`
8. `docs/DECISIONS.md`
9. `docs/ROADMAP.md`
10. `docs/KNOWN_LIMITATIONS.md`
11. `docs/TEAMSHEET2-PRODUCT-BLUEPRINT.md`
12. The current checkpoint design document
13. Before provider/security work: `docs/DATA_SOURCES.md` and `docs/SECURITY.md`
14. Before model/projection/squad/optimisation/Mini-League work: `docs/PROJECTION_MODEL.md` and `docs/TESTING.md`
15. History only when needed: `docs/STAGE_HISTORY.md`, `docs/CHANGELOG.md`, earlier stage/audit records"""
    replace_once('CLAUDE.md', old_order, new_order)

    replace_regex_once(
        'CLAUDE.md',
        r'## Current checkpoint\nThe current merged \*\*application\*\* checkpoint is PR #83.*?\n\n## Non-negotiable rules',
        """## Current checkpoint
The current merged **application** checkpoint is PR #86 at `e49599a75bbb77618292fdb6100fcffd81685c44`. Its exact reviewed head `be90b4f25b90472a3f30b3b765e56d23d8d95862` passed **660 tests, 660 passed, 0 failed, 0 skipped, 0 cancelled**, two byte-identical exact-identity production builds, root `index.html` equality with `dist/index.html` and exact manifest identity. The reviewed head and merge commit share Git tree `007ef40c5b4810777cfefec027cc80bf90fc19e0`. GitHub Pages deployment of the merge commit succeeded. Pritesh physically accepted the deployed Fixtures path on 7 August 2026, including a 23-Gameweek horizon through GW23, coherent sticky TEAM behaviour beyond GW12 and late-season normalisation from GW30 to the remaining nine Gameweeks through GW38. Transfers, Player Detail, Team and Fixtures now have populated iPhone acceptance evidence for their tested paths. The next substantive work is investigation-only populated live acceptance of **Leagues**. FPL-2 and ML-3 remain open for Leagues; no Mini-League calculation, projected-rank, rival-prediction or strategy implementation is approved by this checkpoint.

## Non-negotiable rules"""
    )

    replace_once(
        'CLAUDE.md',
        '- The next substantive work is investigation-only populated live-acceptance planning for Team, then Fixtures, then Leagues. Transfers and Player Detail are excluded from that remaining plan because their tested populated iPhone paths already have acceptance evidence. No A3, Track B, optimiser, football-model, ranking or provider implementation is approved without a new explicit gate.',
        '- The next substantive work is investigation-only populated live acceptance of Leagues. Transfers, Player Detail, Team and Fixtures already have acceptance evidence for their tested populated iPhone paths. No A3, Track B, optimiser, football-model, projected-rank, Mini-League strategy or provider implementation is approved without a new explicit gate.'
    )


def apply_project_context():
    marker = '<!-- FIXTURES-ACCEPTANCE-2026-08-07 -->'
    block = """<!-- FIXTURES-ACCEPTANCE-2026-08-07 -->
> **Current merged application checkpoint — Fixtures populated acceptance complete:** PR #85 merged the mobile horizontal-scroll presentation correction at `01c16588b63bf41b099adc64b6a1c9044eba9eec`; PR #86 merged GW38 horizon support at current `main` `e49599a75bbb77618292fdb6100fcffd81685c44`. Exact PR #86 head `be90b4f25b90472a3f30b3b765e56d23d8d95862` passed **660/660 tests**, deterministic exact-identity builds, root/deployable equality and exact manifest identity, and shares Git tree `007ef40c5b4810777cfefec027cc80bf90fc19e0` with the merge commit. GitHub Pages deployment succeeded. Pritesh physically accepted the deployed iPhone Safari path: Gameweeks 23 reaches GW23, TEAM remains coherent beyond GW12, and From GW30 + 23 normalises to 9 and stops at GW38. `docs/FIXTURES-ACCEPTANCE-MERGE-RECORD.md` is authoritative. Remaining feature-specific populated live acceptance is **Leagues only**."""
    insert_after_title('docs/PROJECT_CONTEXT.md', marker, block)

    replace_regex_once(
        'docs/PROJECT_CONTEXT.md',
        r'## Current status\n- The current merged \*\*application\*\* checkpoint is PR #83.*?\n- Live on GitHub Pages',
        """## Current status
- The current merged **application** checkpoint is PR #86 at `e49599a75bbb77618292fdb6100fcffd81685c44`. Exact reviewed head `be90b4f25b90472a3f30b3b765e56d23d8d95862` passed **660 tests, 660 passed, 0 failed, 0 skipped, 0 cancelled**, deterministic byte-identical production builds, root/deployable equality and exact manifest identity. The head and merge commit share Git tree `007ef40c5b4810777cfefec027cc80bf90fc19e0`; no model/golden expectation changed.
- GitHub Pages deployment succeeded for exact merge commit `e49599a75bbb77618292fdb6100fcffd81685c44`.
- Transfers, Player Detail, Team and Fixtures now have physical iPhone Safari acceptance evidence for their tested paths. Remaining feature-specific populated live acceptance is **Leagues**.
- Live on GitHub Pages"""
    )
    replace_all_required(
        'docs/PROJECT_CONTEXT.md',
        'Remaining populated live acceptance is **Fixtures, then Leagues**.',
        'Remaining populated live acceptance is **Leagues**; Fixtures was subsequently accepted through PRs #85–#86.'
    )
    replace_all_required(
        'docs/PROJECT_CONTEXT.md',
        'Remaining feature-specific populated live acceptance is **Fixtures, then Leagues**.',
        'Remaining feature-specific populated live acceptance is **Leagues**.'
    )


def apply_roadmap():
    replace_regex_once(
        'docs/ROADMAP.md',
        r'<!-- FIXTURES-GW38-HORIZON-2026-08-07 -->\n> .*?\n\n',
        """<!-- FIXTURES-ACCEPTANCE-2026-08-07 -->
> **Fixtures populated acceptance complete:** PR #85 is merged/deployed for the mobile horizontal-scroll presentation; PR #86 is merged/deployed at current `main` `e49599a75bbb77618292fdb6100fcffd81685c44` for remaining-season horizons through GW38. Exact PR #86 head `be90b4f25b90472a3f30b3b765e56d23d8d95862` passed **660/660 tests** with deterministic exact-identity builds. Owner iPhone Safari acceptance passed for GW23 reachability, sticky TEAM behaviour beyond GW12 and GW30→GW38 boundary normalisation. Fixtures is closed; **Leagues is now the next populated live-acceptance checkpoint**.

"""
    )
    replace_regex_once(
        'docs/ROADMAP.md',
        r'<!-- FIXTURES-MOBILE-SCROLL-FOLLOW-UP-2026-08-07 -->\n> .*?\n\n',
        """<!-- FIXTURES-MOBILE-SCROLL-FOLLOW-UP-2026-08-07 -->
> **Historical Fixtures presentation follow-up — complete:** PR #85 corrected the sticky TEAM presentation, fallback-note placement and fallback-aware intro wording. Its deployed behaviour was physically confirmed during the subsequent PR #86 acceptance. No fixture formula, provider or projection behaviour changed.

"""
    )
    replace_once(
        'docs/ROADMAP.md',
        '> **Current approved item:** documentation-only reconciliation of the merged Team T-01/T-02 follow-up through PR #83, followed by investigation-only populated live acceptance of **Fixtures**. Team populated acceptance is complete; the remaining sequence is **Fixtures, then Leagues**. This reconciliation authorises no application implementation, model change or provider change.',
        '> **Current approved item:** documentation-only reconciliation of completed Fixtures acceptance through PRs #85–#86, followed by investigation-only populated live acceptance of **Leagues**. Team and Fixtures populated acceptance are complete. This reconciliation authorises no application implementation, Mini-League calculation/strategy change, projected-rank work or provider change.'
    )
    replace_all_required(
        'docs/ROADMAP.md',
        'Remaining populated live acceptance is **Fixtures, then Leagues**.',
        'Remaining populated live acceptance is **Leagues**.'
    )


def apply_limitations():
    replace_regex_once(
        'docs/KNOWN_LIMITATIONS.md',
        r'<!-- FIXTURES-GW38-HORIZON-2026-08-07 -->\n> .*?\n\n',
        """<!-- FIXTURES-ACCEPTANCE-2026-08-07 -->
> **Fixtures populated acceptance complete:** PR #85 corrected the mobile scroll presentation and PR #86 removed the silent 12-Gameweek horizon cap, with current `main` at `e49599a75bbb77618292fdb6100fcffd81685c44`. The PR #86 exact head passed **660/660 tests** with deterministic builds; the merged build was deployed successfully and physically accepted on iPhone Safari. The remaining feature-specific live acceptance gap under FPL-2 is **Leagues only**.

"""
    )
    replace_regex_once(
        'docs/KNOWN_LIMITATIONS.md',
        r'<!-- FIXTURES-MOBILE-SCROLL-LIMITATION-2026-08-07 -->\n> .*?\n\n',
        """<!-- FIXTURES-MOBILE-SCROLL-LIMITATION-2026-08-07 -->
> **Historical Fixtures mobile limitation — closed:** PR #85 fixed the incoherent sticky TEAM/header and travelling fallback explanation; owner iPhone Safari retest subsequently passed. See UI-15 and `docs/FIXTURES-ACCEPTANCE-MERGE-RECORD.md`.

"""
    )
    old_ui15 = '| UI-15 | Fixtures 12-Gameweek horizontal scrolling exposed an incoherent sticky TEAM column/header and a fallback explanation that travelled with the table | Approved presentation-only correction keeps fixture/model/provider behaviour unchanged; automated verification and physical iPhone retest required | Fixtures feature-specific live acceptance | Open (implementation/retest) |'
    new_ui15 = '| UI-15 | Fixtures 12-Gameweek horizontal scrolling exposed an incoherent sticky TEAM column/header and a fallback explanation that travelled with the table | PR #85 corrected the sticky TEAM header/body presentation, kept the fallback explanation outside the horizontal scroller and corrected fallback-aware intro copy; the deployed path was physically accepted on iPhone Safari during the PR #86 follow-up | Fixtures feature-specific live acceptance | **CLOSED and merged 2026-08-07 through PR #85 (`01c16588b63bf41b099adc64b6a1c9044eba9eec`)** |\n| UI-16 | Fixtures allowed a typed horizon above 12 while runtime silently clamped the calculation/render span to 12 | PR #86 exposes 1–38 Gameweeks, caps at the remaining season, synchronises the visible value and prevents post-GW38 swing windows without changing fixture formulas; owner verified GW23 reachability and GW38 boundary behaviour on deployed iPhone Safari | Fixtures feature-specific live acceptance | **CLOSED and merged 2026-08-07 through PR #86 (`e49599a75bbb77618292fdb6100fcffd81685c44`)** |'
    replace_once('docs/KNOWN_LIMITATIONS.md', old_ui15, new_ui15)
    replace_once(
        'docs/KNOWN_LIMITATIONS.md',
        '| FPL-2 | Full populated Teamsheet behaviour has not yet been accepted across every live Official FPL account, fixture and league path | Gateway, Transfers, Player Detail and Team tested paths have passed. Remaining acceptance is Fixtures, then Leagues. | Feature-specific live acceptance | Open (acceptance gate) |',
        '| FPL-2 | Full populated Teamsheet behaviour has not yet been accepted across every live Official FPL account and league path | Gateway, Transfers, Player Detail, Team and Fixtures tested paths have passed. Remaining acceptance is Leagues. | Feature-specific live acceptance | Open (acceptance gate — Leagues only) |'
    )
    replacements = {
        'Remaining feature-specific populated acceptance is tracked under FPL-2 for Team, Fixtures and Leagues.': 'Remaining feature-specific populated acceptance is tracked under FPL-2 for Leagues only; Team and Fixtures have since passed their tested populated iPhone paths.',
        'FPL-2 remains open only for the separately listed Team, Fixtures and Leagues populated-acceptance paths.': 'FPL-2 remains open only for the separately listed Leagues populated-acceptance path; Team and Fixtures have since passed.',
        'Remaining feature-specific live acceptance stays under FPL-2 for Team, Fixtures and Leagues.': 'Remaining feature-specific live acceptance stays under FPL-2 for Leagues only; Team and Fixtures have since passed.',
    }
    for old, new in replacements.items():
        replace_all_required('docs/KNOWN_LIMITATIONS.md', old, new)


def apply_testing():
    replace_regex_once(
        'docs/TESTING.md',
        r'<!-- FIXTURES-GW38-HORIZON-2026-08-07 -->\n> .*?\n\n',
        """<!-- FIXTURES-ACCEPTANCE-2026-08-07 -->
> **Fixtures acceptance verification complete:** PR #86 exact head `be90b4f25b90472a3f30b3b765e56d23d8d95862` passed **660 tests, 660 passed, 0 failed, 0 skipped, 0 cancelled** in permanent Verify Teamsheet run `31198545580`, with deterministic byte-identical double builds, root/deployable equality and exact manifest identity. The merged tree was deployed at `e49599a75bbb77618292fdb6100fcffd81685c44`; owner iPhone Safari acceptance passed for GW23 reachability, sticky TEAM behaviour beyond GW12 and GW38 boundary normalisation. No model formula, provider, source or golden expectation changed.

"""
    )
    replace_regex_once(
        'docs/TESTING.md',
        r'<!-- FIXTURES-MOBILE-SCROLL-TESTING-2026-08-07 -->\n> .*?\n\n',
        """<!-- FIXTURES-MOBILE-SCROLL-TESTING-2026-08-07 -->
> **Historical PR #85 verification — accepted:** four focused regressions cover truthful fallback-aware copy, a non-scrolling mode explanation, a shared sticky TEAM header/body column and removal of the left scrolling gutter. PR #85 reached **656 passed, 0 failed, 0 skipped, 0 cancelled** and its deployed mobile path was physically confirmed during the subsequent Fixtures acceptance sequence.

"""
    )
    replace_regex_once(
        'docs/TESTING.md',
        r'## Current verified baseline\nThe current merged application checkpoint is PR #83.*?\n\n## Suites',
        """## Current verified baseline
The current merged application checkpoint is PR #86 at `e49599a75bbb77618292fdb6100fcffd81685c44`.

- exact final PR #86 head: `be90b4f25b90472a3f30b3b765e56d23d8d95862`
- permanent Verify Teamsheet run: `31198545580`, completed successfully
- `./run-tests.sh`: **660 tests, 660 passed, 0 failed, 0 skipped, 0 cancelled**
- two exact-identity production builds: byte-identical
- root `index.html`: byte-identical to `dist/index.html`
- manifest build identity: exact to the verified PR head
- final PR head and merge commit Git tree: `007ef40c5b4810777cfefec027cc80bf90fc19e0`
- GitHub Pages deployment: succeeded for exact merge commit `e49599a75bbb77618292fdb6100fcffd81685c44`
- populated physical iPhone Safari Fixtures acceptance: passed on 7 August 2026 for a 23-Gameweek horizon through GW23, sticky TEAM presentation beyond GW12, and GW30 remaining-season normalisation to nine Gameweeks through GW38
- model/golden expectations: unchanged
- calculation, provider and data-source behaviour: unchanged

Transfers, Player Detail, Team and Fixtures have populated iPhone acceptance evidence for their tested paths. Remaining feature-specific live acceptance is **Leagues**. VoiceOver is not a Teamsheet acceptance gate.

## Suites"""
    )


def apply_fixtures_record():
    follow_up = """# Fixtures Mobile Scroll and GW38 Follow-up

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
"""
    write('docs/FIXTURES-MOBILE-SCROLL-FOLLOW-UP.md', follow_up)

    record_path = Path('docs/FIXTURES-ACCEPTANCE-MERGE-RECORD.md')
    if record_path.exists():
        raise SystemExit('Fixtures acceptance merge record already exists')
    record_path.write_text("""# Fixtures Populated Acceptance — Merge Record

Status: **Complete, merged, deployed and physically accepted on 7 August 2026.**

Purpose: authoritative checkpoint record for the completed Fixtures populated/live iPhone Safari acceptance sequence. This supersedes earlier current-status wording that described Fixtures, PR #85 or PR #86 as awaiting deployment or physical retest.

## Final application checkpoint

- Current `main`: `e49599a75bbb77618292fdb6100fcffd81685c44` — merge of PR #86, **Extend Fixtures horizon through GW38**.
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
""")


def apply_all():
    apply_claude()
    apply_project_context()
    apply_roadmap()
    apply_limitations()
    apply_testing()
    apply_fixtures_record()


def worktree_paths():
    out = subprocess.check_output(['git', 'status', '--porcelain']).decode().splitlines()
    paths = set()
    for line in out:
        if not line:
            continue
        path = line[3:]
        if ' -> ' in path:
            path = path.split(' -> ', 1)[1]
        paths.add(path)
    return paths


def guard_worktree():
    changed = worktree_paths()
    unexpected = changed - EXPECTED_DOCS
    missing = EXPECTED_DOCS - changed
    if unexpected:
        raise SystemExit('unexpected working-tree paths: ' + ', '.join(sorted(unexpected)))
    if missing:
        raise SystemExit('expected documentation paths missing: ' + ', '.join(sorted(missing)))
    print('Approved documentation paths:')
    for path in sorted(changed):
        print('-', path)


def guard_final():
    changed = set(subprocess.check_output(['git', 'diff', '--name-only', BASE + '..HEAD']).decode().splitlines())
    unexpected = changed - EXPECTED_DOCS
    missing = EXPECTED_DOCS - changed
    if unexpected:
        raise SystemExit('unexpected final branch paths: ' + ', '.join(sorted(unexpected)))
    if missing:
        raise SystemExit('expected final branch paths missing: ' + ', '.join(sorted(missing)))
    print('Final cumulative diff is documentation-only:')
    for path in sorted(changed):
        print('-', path)


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else ''
    if mode == 'apply':
        apply_all()
    elif mode == 'guard-worktree':
        guard_worktree()
    elif mode == 'guard-final':
        guard_final()
    else:
        raise SystemExit('usage: fixtures-acceptance-doc-reconcile.py apply|guard-worktree|guard-final')
