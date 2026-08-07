from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one match in {path}, found {count}: {old[:80]!r}")
    p.write_text(text.replace(old, new))


def insert_after(path, anchor, addition):
    p = Path(path)
    text = p.read_text()
    if addition.strip() in text:
        raise SystemExit(f"Addition already present in {path}")
    if anchor not in text:
        raise SystemExit(f"Anchor missing in {path}: {anchor!r}")
    p.write_text(text.replace(anchor, anchor + addition, 1))


# app.html — truthful copy, fixed note outside the horizontal scroller, and clean sticky first column.
replace_once(
    'app.html',
    ".ticker-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-inline:contain;margin:0 -16px;padding:0 16px}",
    ".ticker-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-inline:contain;margin:0;padding:0;isolation:isolate}"
)
replace_once(
    'app.html',
    "td.team,th.team{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:13px;white-space:nowrap;padding-right:6px;\n  position:sticky;left:0;background:var(--panel);z-index:2}",
    "td.team,th.team{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:13px;white-space:nowrap;padding-right:6px;\n  position:sticky;left:0;background:var(--panel);z-index:2;box-shadow:-8px 0 0 var(--panel),8px 0 8px -8px rgba(20,38,28,.28)}\ntable.ticker thead th.team{z-index:3}"
)
replace_once(
    'app.html',
    "    <p class=\"hint\">Difficulty from the model's own attack/defence ratings, not the official 1–5. Switch the lens to see who fixtures favour.</p>",
    "    <p class=\"hint\">Compare upcoming fixture difficulty across gameweeks. Teamsheet uses validated attack/defence strength ratings when available, otherwise Official FPL's 1–5 difficulty.</p>"
)
replace_once(
    'app.html',
    "    <div class=\"ticker-wrap\"><div id=\"ticker\"></div></div>",
    "    <div id=\"fixtureModeNote\"></div>\n    <div class=\"ticker-wrap\"><div id=\"ticker\"></div></div>"
)

# src/ui/views.mjs — keep the explanatory fallback note outside the scroller and make TEAM header sticky too.
replace_once(
    'src/ui/views.mjs',
    "  if(!S.fixtures){\n    if(warning.kind==='unavailable') setChildren($('ticker'),elNode('div',{class:'empty'},elNode('strong',{},'Fixtures are unavailable'),'Refresh Official FPL data before using the fixture view.'));\n    return;\n  }",
    "  if(!S.fixtures){\n    setChildren($('fixtureModeNote'));\n    if(warning.kind==='unavailable') setChildren($('ticker'),elNode('div',{class:'empty'},elNode('strong',{},'Fixtures are unavailable'),'Refresh Official FPL data before using the fixture view.'));\n    return;\n  }"
)
replace_once(
    'src/ui/views.mjs',
    "  const header = elNode('tr',{},head('Team','tm'));",
    "  const header = elNode('tr',{},head('Team','tm team'));"
)
old_ticker = """  const tickerNodes = [];
  if(lensState.fallback) tickerNodes.push(noteNode('plain',
    elNode('b',{},'Overall FPL difficulty.'),
    ' Lower is easier. Official FPL currently supplies one overall 1–5 rating, so separate attacker and defender lenses are hidden until genuine team-strength inputs are available.'));
  tickerNodes.push(elNode('table',{class:'ticker'},elNode('caption',{class:'sr-only'},`Fixture difficulty from GW${from} across ${span} Gameweeks`),elNode('thead',{},header),body));
  setChildren($('ticker'),tickerNodes);
"""
new_ticker = """  if(lensState.fallback) setChildren($('fixtureModeNote'),noteNode('plain',
    elNode('b',{},'Overall FPL difficulty.'),
    ' Lower is easier. Official FPL currently supplies one overall 1–5 rating, so separate attacker and defender lenses are hidden until genuine team-strength inputs are available.'));
  else setChildren($('fixtureModeNote'));
  setChildren($('ticker'),elNode('table',{class:'ticker'},elNode('caption',{class:'sr-only'},`Fixture difficulty from GW${from} across ${span} Gameweeks`),elNode('thead',{},header),body));
"""
replace_once('src/ui/views.mjs', old_ticker, new_ticker)

# Focused regression tests.
Path('tests/fixtures-mobile-presentation.test.mjs').write_text("""import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app=readFileSync(new URL('../app.html',import.meta.url),'utf8');
const views=readFileSync(new URL('../src/ui/views.mjs',import.meta.url),'utf8');

test('Fixtures intro wording remains truthful in strength and Official-FPL fallback modes',()=>{
  assert.match(app,/Compare upcoming fixture difficulty across gameweeks/);
  assert.match(app,/validated attack\/defence strength ratings when available/);
  assert.match(app,/otherwise Official FPL's 1–5 difficulty/);
  assert.doesNotMatch(app,/Difficulty from the model's own attack\/defence ratings, not the official 1–5/);
});

test('Fixtures fallback explanation is structurally outside the horizontal scroller',()=>{
  assert.match(app,/id=\"fixtureModeNote\"><\/div>\s*<div class=\"ticker-wrap\"><div id=\"ticker\"><\/div><\/div>/);
  assert.match(views,/setChildren\(\$\('fixtureModeNote'\),noteNode\('plain'/);
  assert.match(views,/else setChildren\(\$\('fixtureModeNote'\)\);/);
  assert.doesNotMatch(views,/const tickerNodes = \[\]/);
});

test('Fixtures TEAM header and body share one sticky first-column contract',()=>{
  assert.match(views,/head\('Team','tm team'\)/);
  assert.match(app,/td\.team,th\.team\{[^}]*position:sticky;left:0;background:var\(--panel\);z-index:2;box-shadow:-8px 0 0 var\(--panel\)/);
  assert.match(app,/table\.ticker thead th\.team\{z-index:3\}/);
});

test('Fixtures horizontal scroller has no left gutter that exposes travelled fixture cells',()=>{
  assert.match(app,/\.ticker-wrap\{[^}]*margin:0;padding:0;isolation:isolate\}/);
  assert.doesNotMatch(app,/\.ticker-wrap\{[^}]*margin:0 -16px;padding:0 16px/);
});
""")

# Canonical documentation — implementation is in review; physical retest remains pending.
fixture_doc = """# Fixtures Mobile Scroll Follow-up

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

__VERIFICATION__

Focused regressions cover truthful copy, fallback-note placement outside the scroll container, shared sticky TEAM header/body structure and removal of the left scrolling gutter. The permanent PR verification workflow must still pass against the exact review head.

## Physical acceptance still required

On the deployed iPhone Safari build, repeat the 12-Gameweek view and confirm:

- GW1–GW12 can be reached by horizontal swipe;
- TEAM remains readable and fixed as fixture columns move behind it;
- no previous fixture cell appears to the left of TEAM;
- the Overall FPL difficulty explanation remains in place above the table;
- the final rows, legend and swing notes remain clear of the fixed bottom navigation.

Until that retest passes, Fixtures remains open under FPL-2 and Leagues does not become the active acceptance checkpoint.
"""
Path('docs/FIXTURES-MOBILE-SCROLL-FOLLOW-UP.md').write_text(fixture_doc)

status_block = """\n<!-- FIXTURES-MOBILE-SCROLL-FOLLOW-UP-2026-08-07 -->
> **Approved implementation in review — Fixtures mobile horizontal-scroll presentation:** populated iPhone Safari review proved 12-Gameweek horizontal scrolling works but exposed a broken sticky TEAM presentation, a fallback explanation that travelled with the table, and static intro copy that contradicted the active Official-FPL fallback. The approved branch is presentation-only: fixture calculations, fallback mathematics, providers, projections and strategy stay unchanged. `docs/FIXTURES-MOBILE-SCROLL-FOLLOW-UP.md` is the focused record. Automated verification is recorded there; physical iPhone retest remains required before Fixtures is accepted and the project moves to Leagues.
"""
insert_after('CLAUDE.md', '# CLAUDE.md — onboarding for every future development session\n', status_block)
insert_after('docs/ROADMAP.md', '# ROADMAP.md — living roadmap\n', status_block)

testing_block = """\n<!-- FIXTURES-MOBILE-SCROLL-TESTING-2026-08-07 -->
> **Fixtures mobile presentation follow-up:** four focused regressions were added for truthful fallback-aware copy, a non-scrolling mode explanation, a shared sticky TEAM header/body column and removal of the left scrolling gutter. __VERIFICATION__ Physical iPhone Safari retest of the 12-Gameweek horizontal-scroll path remains required; no model, provider or golden expectation changed.
"""
insert_after('docs/TESTING.md', '# TESTING.md\n', testing_block)

limitations_block = """\n<!-- FIXTURES-MOBILE-SCROLL-LIMITATION-2026-08-07 -->
> **Fixtures acceptance follow-up in review:** the owner reproduced a 12-Gameweek mobile presentation defect in which the TEAM column/header and fallback explanation did not remain coherent during horizontal scrolling. A presentation-only correction is approved and under verification; physical iPhone retest remains required.
"""
insert_after('docs/KNOWN_LIMITATIONS.md', '# KNOWN_LIMITATIONS.md\n', limitations_block)
replace_once(
    'docs/KNOWN_LIMITATIONS.md',
    "| UI-8 | Teamsheet 2.0.6 physical iPhone and live populated-data acceptance is not recorded | Automated and headless-browser checks cover routes, focus, mounts, warning states and responsive CSS, but they do not establish iPhone Safari density, one-handed comfort or live transport behaviour. VoiceOver is not a Teamsheet acceptance gate. | Feature-specific live acceptance | Open (acceptance gate) |",
    "| UI-8 | Teamsheet 2.0.6 physical iPhone and live populated-data acceptance is not recorded | Automated and headless-browser checks cover routes, focus, mounts, warning states and responsive CSS, but they do not establish iPhone Safari density, one-handed comfort or live transport behaviour. VoiceOver is not a Teamsheet acceptance gate. | Feature-specific live acceptance | Open (acceptance gate) |\n| UI-15 | Fixtures 12-Gameweek horizontal scrolling exposed an incoherent sticky TEAM column/header and a fallback explanation that travelled with the table | Approved presentation-only correction keeps fixture/model/provider behaviour unchanged; automated verification and physical iPhone retest required | Fixtures feature-specific live acceptance | Open (implementation/retest) |"
)
