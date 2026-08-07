from pathlib import Path
import re

MAIN = '385e5102c0e86e4b926503bffceba08bd6d831c3'
PR_HEAD = '990a85eb69319064038be458081d029d8a3b8828'
TREE = '70b38bf4bf5b5bdb0f295fa6738554266441e62b'


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def prepend_after_h1(path, marker, block):
    text = read(path)
    if marker in text:
        return
    first_nl = text.find('\n')
    if first_nl < 0:
        raise SystemExit(f'{path}: H1 newline missing')
    text = text[:first_nl + 1] + '\n' + block.rstrip() + '\n\n' + text[first_nl + 1:].lstrip('\n')
    write(path, text)


def replace_once(path, old, new):
    text = read(path)
    if old not in text:
        raise SystemExit(f'{path}: expected replacement text missing')
    write(path, text.replace(old, new, 1))


def replace_regex_once(path, pattern, replacement):
    text = read(path)
    new, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{path}: expected regex replacement count 1, got {count}')
    write(path, new)


current_banner = f'''<!-- TEAM-ACCEPTANCE-2026-08-07 -->
> **Current merged application checkpoint — Team populated acceptance complete:** PRs #80–#83 are merged, with current `main` `{MAIN}` from PR #83. The exact final PR #83 head `{PR_HEAD}` passed **652 tests, 0 failed, 0 skipped, 0 cancelled**, deterministic byte-identical double-build verification, root/deployable equality and exact manifest build identity. The final PR head and merge commit share Git tree `{TREE}`. GitHub Pages deployment for `{MAIN}` succeeded. Pritesh then physically accepted the populated Team path on iPhone Safari: startup/loading owns the viewport; availability is visible; the reserve goalkeeper occupies `GK`; outfield substitutes retain `1st` / `2nd` / `3rd`; and `Unavailable` is centred on one line without overlap. Normal Safari retained the saved manual squad; Private Browsing uses separate browser storage and is not currently a Teamsheet persistence defect. `docs/TEAM-UX-T01-T02-MERGE-RECORD.md` is authoritative for this Team follow-up sequence. Remaining populated live acceptance is **Fixtures, then Leagues**. No calculation, provider, data-source or security behaviour changed.'''

prepend_after_h1('CLAUDE.md', '<!-- TEAM-ACCEPTANCE-2026-08-07 -->', current_banner)
replace_regex_once(
    'CLAUDE.md',
    r'## Current checkpoint\n.*?\n\n## Non-negotiable rules',
    f'''## Current checkpoint
The current merged **application** checkpoint is PR #83 at `{MAIN}`. PRs #80–#83 complete the approved Team T-01/T-02 populated-iPhone follow-up sequence. The exact final PR #83 head `{PR_HEAD}` passed **652 passed, 0 failed, 0 skipped, 0 cancelled**, two byte-identical production builds, root `index.html` equality with `dist/index.html` and exact manifest identity; that head and merge commit share Git tree `{TREE}`. GitHub Pages deployment for the merge commit succeeded. Pritesh physically accepted the deployed Team path on 7 August 2026, including startup ownership, explicit availability, reserve-GK display, preserved outfield bench order and the centred one-line unavailable badge. The next substantive work is investigation-only populated live acceptance of **Fixtures**, followed by **Leagues**. No Fixtures implementation, model/provider change, UX-A3 or Track B work is approved by this checkpoint.

## Non-negotiable rules''')

prepend_after_h1('docs/PROJECT_CONTEXT.md', '<!-- TEAM-ACCEPTANCE-2026-08-07 -->', current_banner)
old_context = '''- The current merged **application** checkpoint is PR #78 at `ebb8838e7bfd081371a0639c9b4bdacfc9b92bc6`. It fixes only Player Detail layering above the unchanged primary dock. Accepted verification: **645 passed, 0 failed, 0 skipped, 0 cancelled**, deterministic byte-identical production builds, root/deployable equality and populated iPhone Safari acceptance for the corrected Player Detail path.
- GitHub Pages deployment succeeded from the PR #78 merged checkpoint, and the Cloudflare Workers production build succeeded for `teamsheet-fpl-gateway`.
- Transfers and Player Detail have populated iPhone Safari acceptance evidence for the tested paths. Remaining feature-specific populated live acceptance is **Team first, then Fixtures, then Leagues**.'''
new_context = f'''- The current merged **application** checkpoint is PR #83 at `{MAIN}`. The exact final PR #83 head `{PR_HEAD}` passed **652 tests, 0 failed, 0 skipped, 0 cancelled** with deterministic byte-identical production builds, root/deployable equality and exact manifest identity; the head and merge commit share Git tree `{TREE}`. No model/golden expectation changed.
- GitHub Pages deployment succeeded for exact merge commit `{MAIN}`. The Team follow-up added no Cloudflare Worker change.
- Transfers, Player Detail and the populated Team path now have physical iPhone Safari acceptance evidence for their tested paths. Remaining feature-specific populated live acceptance is **Fixtures, then Leagues**.'''
replace_once('docs/PROJECT_CONTEXT.md', old_context, new_context)

prepend_after_h1('docs/ROADMAP.md', '<!-- TEAM-ACCEPTANCE-2026-08-07 -->', current_banner)
replace_once(
    'docs/ROADMAP.md',
    '> **Current approved item:** documentation reconciliation after merged PR #78 only. No application behaviour, model, provider or live-acceptance implementation is included. After this reconciliation, the next substantive work is investigation-only populated live-acceptance planning for Team, then Fixtures, then Leagues.',
    '> **Current approved item:** documentation-only reconciliation of the merged Team T-01/T-02 follow-up through PR #83, followed by investigation-only populated live acceptance of **Fixtures**. Team populated acceptance is complete; the remaining sequence is **Fixtures, then Leagues**. This reconciliation authorises no application implementation, model change or provider change.'
)

prepend_after_h1('docs/TESTING.md', '<!-- TEAM-ACCEPTANCE-2026-08-07 -->', current_banner)
replace_regex_once(
    'docs/TESTING.md',
    r'## Current verified baseline\n.*?\n\n## Suites',
    f'''## Current verified baseline
The current merged application checkpoint is PR #83 at `{MAIN}`.

- exact final PR #83 head: `{PR_HEAD}`
- `./run-tests.sh`: **652 passed, 0 failed, 0 skipped, 0 cancelled**
- two exact-identity production builds: byte-identical
- root `index.html`: byte-identical to `dist/index.html`
- manifest build identity: exact to the verified PR head
- final PR head and merge commit Git tree: `{TREE}`
- GitHub Pages deployment: succeeded for exact merge commit `{MAIN}`
- populated physical iPhone Safari Team acceptance: passed on 7 August 2026 for startup ownership, availability visibility, reserve-GK display, preserved outfield bench order and the centred one-line `Unavailable` badge without overlap
- model/golden expectations: unchanged
- calculation, provider and data-source behaviour: unchanged

Transfers, Player Detail and Team have populated iPhone acceptance evidence for the tested paths. Remaining feature-specific live acceptance is **Fixtures, then Leagues**. VoiceOver is not a Teamsheet acceptance gate.

## Suites''')

prepend_after_h1('docs/KNOWN_LIMITATIONS.md', '<!-- TEAM-ACCEPTANCE-2026-08-07 -->', current_banner)
text = read('docs/KNOWN_LIMITATIONS.md')
lines = text.splitlines()
found_ui7 = found_fpl2 = False
for i, line in enumerate(lines):
    if line.startswith('| UI-7 |'):
        lines[i] = f'| UI-7 | Teamsheet 2.0.2 populated physical iPhone acceptance was not recorded | Final Team acceptance passed on 7 August 2026 after PRs #80–#83: startup ownership, availability wording, reserve-GK display slot, outfield bench order and narrow unavailable badge were physically confirmed. | Team feature-specific live acceptance | **CLOSED and merged 2026-08-07 through PR #83 (`{MAIN}`)** |'
        found_ui7 = True
    elif line.startswith('| FPL-2 |'):
        lines[i] = '| FPL-2 | Full populated Teamsheet behaviour has not yet been accepted across every live Official FPL account, fixture and league path | Gateway, Transfers, Player Detail and Team tested paths have passed. Remaining acceptance is Fixtures, then Leagues. | Feature-specific live acceptance | Open (acceptance gate) |'
        found_fpl2 = True
if not (found_ui7 and found_fpl2):
    raise SystemExit(f'KNOWN_LIMITATIONS rows missing: UI-7={found_ui7} FPL-2={found_fpl2}')
write('docs/KNOWN_LIMITATIONS.md', '\n'.join(lines) + ('\n' if text.endswith('\n') else ''))

replace_once(
    'docs/TEAM-UX-T01-T02-IMPLEMENTATION.md',
    'Status: **Implementation, automated verification and physical T-01 acceptance complete. Owner approved to merge. Not yet merged.**',
    'Status: **Merged through PR #83; automated verification and owner physical iPhone Safari acceptance are complete for the Team follow-up sequence.**'
)
replace_once(
    'docs/TEAM-UX-T01-T02-IMPLEMENTATION.md',
    'Physical iPhone confirmation remains required before merge.',
    'That pending gate was subsequently completed after PR #83 deployment; see the final merged Team acceptance record below.'
)
team_impl = read('docs/TEAM-UX-T01-T02-IMPLEMENTATION.md')
if '<!-- TEAM-UX-FINAL-ACCEPTANCE-2026-08-07 -->' not in team_impl:
    team_impl += f'''\n\n<!-- TEAM-UX-FINAL-ACCEPTANCE-2026-08-07 -->
## Final merged Team acceptance

PR #80 merged at `99c02593026ddd9f9ac99a21c413e9c996cea31b`, PR #81 at `2df2ec1ae46c094f74b10307aba399f7dc8384fb`, PR #82 at `11102516f8bc2f9c5b81ffe4868f510aeb014a53`, and PR #83 at current `main` `{MAIN}`. The exact final PR #83 head `{PR_HEAD}` passed **652 tests, 0 failed, 0 skipped, 0 cancelled**, deterministic byte-identical double-build verification, root/deployable equality and exact manifest build identity. That head and the merge commit share Git tree `{TREE}`. GitHub Pages deployment for the merge commit succeeded.

After deployment Pritesh physically accepted the populated Team path on iPhone Safari. The startup/loading screen owned the viewport; availability was visible for flagged players; the reserve goalkeeper was displayed in the `GK` bench slot; the three outfield substitutes retained their existing relative `1st` / `2nd` / `3rd` order; and Baleba's `Unavailable` badge was horizontally centred, remained on one line and did not overlap the player name, fixture or xP. The observed bench was Dúbravka — GK, Reinildo — 1st, Dasilva — 2nd and Baleba — 3rd.

Normal Safari retained and displayed the manually saved squad. Safari Private Browsing has separate browser storage, so absence of that normal-Safari squad in a private tab is not currently classified as a Teamsheet persistence defect.

No projection, expected-minutes, fixture, squad-selection, captaincy, transfer, Mini-League, provider, data-source or security behaviour changed in the Team presentation follow-ups. Team is therefore complete in the current populated live-acceptance sequence. **Fixtures is next, followed by Leagues.**
'''
    write('docs/TEAM-UX-T01-T02-IMPLEMENTATION.md', team_impl)

replace_once(
    'docs/TEAM-UX-T02-UNAVAILABLE-WRAP-FOLLOW-UP.md',
    'A focused regression is added to require the narrow-mobile `.bench-player .pitch-availability.out` rule to use single-line wrapping. The finalizer proves that regression fails against the pre-fix CSS before applying the correction, then runs the complete test suite and deterministic double build. Physical iPhone acceptance remains required after deployment.',
    f'''A focused regression requires the narrow-mobile `.bench-player .pitch-availability.out` rule to use single-line wrapping. The finalizer proved that regression failed against the pre-fix CSS before applying the correction, then the exact final PR #83 head `{PR_HEAD}` passed **652 tests, 0 failed, 0 skipped, 0 cancelled** and deterministic double-build verification. PR #83 merged at `{MAIN}` and GitHub Pages deployed that merge successfully. Pritesh then physically confirmed on normal iPhone Safari that `Unavailable` remained centred on one line without overlap while the corrected GK/outfield bench ordering remained intact. The physical acceptance gate is complete.'''
)

merge_record = f'''# Team UX T-01 / T-02 merge and acceptance record

## Outcome

The Team populated-live acceptance sequence is complete through PR #83. Current `main` is `{MAIN}`.

PR sequence:
- PR #80 — startup ownership and availability clarity — merged at `99c02593026ddd9f9ac99a21c413e9c996cea31b`.
- PR #81 — centred availability badges — merged at `2df2ec1ae46c094f74b10307aba399f7dc8384fb`.
- PR #82 — reserve-GK display slot and centred availability row — merged at `11102516f8bc2f9c5b81ffe4868f510aeb014a53`.
- PR #83 — narrow-iPhone one-line unavailable badge — merged at `{MAIN}`.

## Automated evidence

The exact final PR #83 head `{PR_HEAD}` passed:
- **652 tests, 0 failed, 0 skipped, 0 cancelled**;
- two byte-identical exact-identity production builds;
- root `index.html` equality with `dist/index.html`;
- exact manifest build identity.

The final PR head and merge commit share Git tree `{TREE}`, so the tested branch content is the content merged to `main`. No test was deleted, weakened or skipped and no golden/model expectation changed.

GitHub Pages deployment for exact merge commit `{MAIN}` completed successfully.

## Physical iPhone Safari acceptance

After deployment Pritesh physically accepted the populated Team path on normal iPhone Safari on 7 August 2026. He confirmed:
1. the startup/loading screen owns the viewport correctly;
2. availability status is visible for unavailable/doubtful players;
3. the reserve goalkeeper is displayed in the `GK` bench slot;
4. outfield substitutes retain their existing relative `1st` / `2nd` / `3rd` order;
5. `Unavailable` is horizontally centred;
6. `Unavailable` remains on one line on the narrow iPhone bench card;
7. no overlap with player name, fixture or xP was observed.

The final observed bench was Dúbravka — GK, Reinildo — 1st, Dasilva — 2nd and Baleba — 3rd, with Baleba's `Unavailable` badge centred on one line.

## Browser-storage clarification

Normal Safari retained and displayed the manually saved squad. Safari Private Browsing maintains separate browser storage, so a squad saved in normal Safari is not expected to appear in a private tab. The observed difference is therefore not currently classified as a Teamsheet persistence defect.

## Boundaries

The follow-ups are presentation-only. They do not alter projection, expected-minutes, scoring, fixture, best-XI, squad-selection, captaincy, transfer, simulation, rank, Mini-League, provider, data-source, persistence or security logic. The reserve goalkeeper change affects displayed bench order only; `bestXI()` and its calculated bench array remain unchanged.

## Next checkpoint

Team is complete in the current feature-specific populated live-acceptance sequence. The next approved work is **investigation-only populated live acceptance of Fixtures**, followed by Leagues. No Fixtures implementation or calculation change is approved by this record.
'''
Path('docs/TEAM-UX-T01-T02-MERGE-RECORD.md').write_text(merge_record)
