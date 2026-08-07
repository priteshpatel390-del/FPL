from pathlib import Path
import os
import subprocess
import sys

MARKER = '<!-- FIXTURES-GW38-HORIZON-2026-08-07 -->'


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}')
    p.write_text(text.replace(old, new, 1))


def apply_changes():
    replace_once(
        'app.html',
        '<label class="fld">Games<input type="number" id="fxSpan" min="3" max="12" value="6" class="input-w-72"></label>',
        '<label class="fld">Gameweeks<input type="number" id="fxSpan" min="1" max="38" value="6" class="input-w-72"></label>'
    )
    replace_once(
        'src/ui/views.mjs',
        "  const from = clamp(parseInt($('fxFrom').value) || S.nextGW, 1, 38);\n  const span = clamp(parseInt($('fxSpan').value) || 6, 3, 12);",
        "  const from = clamp(parseInt($('fxFrom').value) || S.nextGW, 1, 38);\n  const requestedSpan = clamp(parseInt($('fxSpan').value) || 6, 1, 38);\n  const span = Math.min(requestedSpan, 39 - from);\n  $('fxFrom').value = String(from);\n  $('fxSpan').max = String(39 - from);\n  $('fxSpan').value = String(span);"
    )
    replace_once(
        'src/ui/views.mjs',
        "  const swings = Object.values(S.teams).map(t => {\n    const now = runScore(t.id, from, 3, lens), later = runScore(t.id, from+3, 3, lens);\n    return {t, delta: later - now};\n  });",
        "  const canCompareSwings = from + 5 <= 38;\n  const swings = canCompareSwings ? Object.values(S.teams).map(t => {\n    const now = runScore(t.id, from, 3, lens), later = runScore(t.id, from+3, 3, lens);\n    return {t, delta: later - now};\n  }) : [];"
    )

    unit = Path('tests/unit.test.mjs')
    text = unit.read_text()
    old_import = "import { matchContext, multToDiff, teamFixtures } from '../src/model/fixtures.mjs';"
    new_import = "import { matchContext, multToDiff, teamFixtures, runScore, averageOfficialDifficulty } from '../src/model/fixtures.mjs';"
    if text.count(old_import) != 1:
        raise SystemExit('tests/unit.test.mjs: fixture import contract changed')
    text = text.replace(old_import, new_import, 1)
    marker = 'direct import: fixture runs support horizons through GW38 with unchanged scoring semantics'
    if marker in text:
        raise SystemExit('tests/unit.test.mjs: GW38 regression already present')
    text += """

test('direct import: fixture runs support horizons through GW38 with unchanged scoring semantics', () => {
  const gw38 = { event:38, team_h:1, team_a:2, team_h_difficulty:2, team_a_difficulty:4, finished:false };
  S.fixtures.push(gw38);
  const strengthsAvailable = S.strengthsAvailable;
  try {
    for (const span of [13, 23, 38]) assert.equal(teamFixtures(1, 1, span).length, span, `span ${span}`);
    const runs = teamFixtures(1, 1, 38);
    assert.equal(runs[37].length, 1, 'GW38 fixture remains reachable');
    const manual = runs.flat().reduce((total, game) => total + (Number.isFinite(game.ctx.atk) ? game.ctx.atk : 1), 0) / 38;
    assert.ok(Math.abs(runScore(1, 1, 38, 'attack') - manual) < 1e-12, 'long horizon keeps existing attack runScore formula');
    S.strengthsAvailable = false;
    assert.equal(runScore(1, 1, 38, 'attack'), averageOfficialDifficulty(1, 1, 38), 'fallback remains direct Official-FPL average');
  } finally {
    S.strengthsAvailable = strengthsAvailable;
    S.fixtures.pop();
  }
});
"""
    unit.write_text(text)

    presentation = Path('tests/fixtures-mobile-presentation.test.mjs')
    text = presentation.read_text()
    marker = 'Fixtures horizon control exposes the remaining season through GW38'
    if marker in text:
        raise SystemExit('fixtures-mobile-presentation: GW38 regressions already present')
    text += r"""

test('Fixtures horizon control exposes the remaining season through GW38',()=>{
  assert.match(app,/<label class="fld">Gameweeks<input type="number" id="fxSpan" min="1" max="38" value="6"/);
  assert.doesNotMatch(app,/id="fxSpan"[^>]*max="12"/);
});

test('Fixtures renderer accepts long horizons and synchronises the visible value to the season boundary',()=>{
  assert.match(views,/const requestedSpan = clamp\(parseInt\(\$\('fxSpan'\)\.value\) \|\| 6, 1, 38\);/);
  assert.match(views,/const span = Math\.min\(requestedSpan, 39 - from\);/);
  assert.match(views,/\$\('fxSpan'\)\.max = String\(39 - from\);/);
  assert.match(views,/\$\('fxSpan'\)\.value = String\(span\);/);
  assert.doesNotMatch(views,/clamp\(parseInt\(\$\('fxSpan'\)\.value\) \|\| 6, 3, 12\)/);
});

test('Fixtures late-season swing notes never evaluate a three-Gameweek window beyond GW38',()=>{
  assert.match(views,/const canCompareSwings = from \+ 5 <= 38;/);
  assert.match(views,/const swings = canCompareSwings \? Object\.values\(S\.teams\)\.map/);
});
"""
    presentation.write_text(text)


def insert_after_title(path, block):
    p = Path(path)
    text = p.read_text()
    if MARKER in text:
        raise SystemExit(f'{path}: GW38 marker already present')
    first, rest = text.split('\n', 1)
    p.write_text(first + '\n\n' + block + '\n\n' + rest.lstrip('\n'))


def record_docs():
    passed = os.environ['PASS']
    insert_after_title('CLAUDE.md', f"""{MARKER}
> **Approved Fixtures GW38 horizon follow-up — implementation in review:** owner testing after PR #85 deployment confirmed the mobile sticky-column/fallback-note correction and exposed a separate silent 12-Gameweek cap: Safari could display a typed value such as 23 while the renderer clamped it to 12. The approved follow-up exposes the remaining season through GW38, synchronises the visible horizon to the actual rendered span, prevents post-GW38 swing windows, and preserves every existing fixture difficulty, `runScore`, blank/double and projection formula. Branch verification: **{passed} passed, 0 failed, 0 skipped, 0 cancelled**. Physical iPhone retest remains required before Fixtures acceptance closes.""")
    insert_after_title('docs/TESTING.md', f"""{MARKER}
> **Fixtures GW38 horizon follow-up:** focused regressions cover the 38-Gameweek control contract, visible-value/season-boundary synchronisation, the no-post-GW38 swing guard and unchanged long-horizon `runScore`/Official-FPL fallback semantics at 13, 23 and 38 Gameweeks. Branch verification: **{passed} passed, 0 failed, 0 skipped, 0 cancelled**. No model formula, provider, source or golden expectation changed; physical iPhone verification remains required after deployment.""")
    insert_after_title('docs/ROADMAP.md', f"""{MARKER}
> **Current Fixtures acceptance follow-up:** PR #85's mobile horizontal-scroll correction is merged and deployed. Owner retest then exposed a separate silent 12-Gameweek horizon cap. GW38 horizon support is approved and in review with **{passed} passing tests**; Fixtures remains open until the deployed long-horizon path is physically accepted. Leagues remains next and must not be pulled forward.""")
    insert_after_title('docs/KNOWN_LIMITATIONS.md', f"""{MARKER}
> **Fixtures horizon follow-up in review:** merged PR #85 fixed the sticky TEAM/fallback-note presentation, but owner retest exposed that the `Gameweeks` request could visually accept values above 12 while runtime silently clamped to 12. The approved branch removes that mismatch and permits the remaining season through GW38 without changing scoring formulas. Until deployed/physically retested, long-horizon Fixtures acceptance remains open.""")

    p = Path('docs/FIXTURES-MOBILE-SCROLL-FOLLOW-UP.md')
    text = p.read_text()
    if MARKER in text:
        raise SystemExit('Fixtures follow-up: GW38 marker already present')
    text += f"""

{MARKER}
## GW38 horizon follow-up

Owner retest after PR #85 deployment confirmed that the corrected fallback explanation remains above the table and the sticky TEAM column now stays coherent while swiping. A separate issue was then reproduced: entering `23` in the horizon field left `23` visible but runtime silently clamped the calculation/render span to 12.

Approved behaviour:
- label the control as `Gameweeks`, default 6;
- allow 1–38 Gameweeks while never rendering or scoring beyond GW38;
- when the requested span would cross the season boundary, synchronise the visible value to the actual remaining-season span;
- keep `runScore`, fixture difficulty, Official-FPL fallback, blank/double treatment and projection formulas unchanged;
- suppress the existing three-plus-three Gameweek swing comparison when its later window would extend beyond GW38.

Validation: **{passed} passed, 0 failed, 0 skipped, 0 cancelled** on the implementation branch. Focused model regressions exercise 13-, 23- and 38-Gameweek spans and prove the existing attack-run and Official-FPL fallback formulas are unchanged. Physical iPhone Safari retest is still required after deployment before Fixtures can be accepted.
"""
    p.write_text(text)

    p = Path('docs/PROJECTION_MODEL.md')
    text = p.read_text()
    old = '`projectXP` sums actual fixtures across the requested span. Doubles add both matches; blanks contribute zero. `runScore` sums real fixture values and divides by requested Gameweeks, with no arbitrary blank or double constants.'
    new = old + ' The Fixtures UI may expose any remaining-season horizon through GW38; this expands only the requested span and does not change either calculation formula.'
    if text.count(old) != 1:
        raise SystemExit('PROJECTION_MODEL multi-Gameweek contract changed')
    p.write_text(text.replace(old, new, 1))


def guard_scope():
    allowed = {
        '.github/workflows/fixtures-gw38-reconcile.yml', '.github/fixtures-gw38-reconcile.py',
        'CLAUDE.md', 'app.html', 'src/ui/views.mjs',
        'tests/unit.test.mjs', 'tests/fixtures-mobile-presentation.test.mjs',
        'docs/FIXTURES-MOBILE-SCROLL-FOLLOW-UP.md', 'docs/TESTING.md', 'docs/ROADMAP.md',
        'docs/KNOWN_LIMITATIONS.md', 'docs/PROJECTION_MODEL.md',
        'dist/app.bundle.js', 'dist/index.html', 'dist/manifest.json', 'index.html'
    }
    changed = {line.strip() for line in subprocess.check_output(['git', 'diff', '--name-only', 'HEAD']).decode().splitlines() if line.strip()}
    unexpected = changed - allowed
    required = {'app.html', 'src/ui/views.mjs', 'tests/unit.test.mjs', 'tests/fixtures-mobile-presentation.test.mjs', 'dist/app.bundle.js', 'dist/index.html', 'dist/manifest.json', 'index.html'}
    missing = required - changed
    if unexpected:
        raise SystemExit('unexpected changed paths: ' + ', '.join(sorted(unexpected)))
    if missing:
        raise SystemExit('required changed paths missing: ' + ', '.join(sorted(missing)))
    print('Approved changed paths:')
    for path in sorted(changed):
        print('-', path)


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else ''
    if mode == 'apply':
        apply_changes()
    elif mode == 'docs':
        record_docs()
    elif mode == 'guard':
        guard_scope()
    else:
        raise SystemExit('usage: fixtures-gw38-reconcile.py apply|docs|guard')
