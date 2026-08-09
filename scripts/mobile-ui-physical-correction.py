from pathlib import Path
import os
import sys


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def source():
    app_path = Path('app.html')
    app = app_path.read_text()

    app = replace_once(
        app,
        "  --page-title-size:17px; --page-intro-size:13px; --page-head-gap:12px;",
        "  --page-title-size:17px; --page-intro-size:13px; --page-head-gap:12px; --page-header-bg:#F7F9F5;",
        'page presentation tokens')

    app = replace_once(
        app,
        "body.startup-pending{overflow:hidden;padding-bottom:0;min-height:100vh;min-height:100dvh;background:linear-gradient(155deg,#10251A 0%,#173B28 58%,#6A1D34 140%)}",
        "body.startup-pending{overflow:hidden;padding-bottom:0;min-height:100vh;min-height:100dvh;background-color:#10251A;background-image:linear-gradient(155deg,#10251A 0%,#173B28 58%,#6A1D34 140%)}",
        'startup document canvas')

    app = replace_once(
        app,
        ".startup-gate{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:calc(24px + env(safe-area-inset-top,0px)) calc(24px + env(safe-area-inset-right,0px)) calc(24px + env(safe-area-inset-bottom,0px)) calc(24px + env(safe-area-inset-left,0px));background:linear-gradient(155deg,#10251A 0%,#173B28 58%,#6A1D34 140%);color:#fff;text-align:center}",
        ".startup-gate{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:calc(24px + env(safe-area-inset-top,0px)) calc(24px + env(safe-area-inset-right,0px)) calc(24px + env(safe-area-inset-bottom,0px)) calc(24px + env(safe-area-inset-left,0px));background-color:#10251A;background-image:linear-gradient(155deg,#10251A 0%,#173B28 58%,#6A1D34 140%);color:#fff;text-align:center}",
        'startup gate canvas')

    old_contract = """#view-squad>h2,#view-fixtures>h2,#view-transfers .transfer-workspace-head>h2,#leagueHub .league-hub-head h2,.settings-header>h2{font-size:var(--page-title-size);line-height:1.2;margin:0 0 2px}
#view-squad>.hint,#view-fixtures>.hint,#view-transfers .transfer-workspace-head>.hint,#leagueHub>.hint,.settings-header>.hint{color:var(--ink-soft);font-size:var(--page-intro-size);margin:3px 0 var(--page-head-gap)}
.settings-header>.hint{margin-bottom:0}"""
    new_contract = """.primary-page-header{display:grid;gap:0;margin:0 0 var(--page-head-gap);padding:12px 13px;border:1px solid var(--line);border-radius:var(--r);background:var(--page-header-bg);box-shadow:none}
.primary-page-header-copy{min-width:0}
.primary-page-header .eyebrow{display:block;margin:0 0 3px}
.primary-page-header h2{font-size:var(--page-title-size);line-height:1.2;margin:0}
.primary-page-header .hint{color:var(--ink-soft);font-size:var(--page-intro-size);line-height:1.4;margin:3px 0 0}
.primary-page-header-action{grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:10px}
.primary-page-header-action>.btn{align-self:start}
#leagueHub{gap:0}"""
    app = replace_once(app, old_contract, new_contract, 'primary header contract')

    app = replace_once(
        app,
        ".transfer-workspace-head{display:block;margin-bottom:0}\n",
        "",
        'legacy transfer header layout')

    app = replace_once(
        app,
        ".league-hub-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.league-hub-head>div{min-width:0}",
        ".league-hub-head>div{min-width:0}",
        'legacy league header layout')

    fixtures_old = """  <section class=\"view panel\" id=\"view-fixtures\">
    <span class=\"eyebrow\">Signature view</span>
    <h2>Fixtures</h2>
    <p class=\"hint\">Compare upcoming fixture difficulty across gameweeks. Teamsheet uses validated attack/defence strength ratings when available, otherwise Official FPL's 1–5 difficulty.</p>"""
    fixtures_new = """  <section class=\"view panel\" id=\"view-fixtures\">
    <div class=\"primary-page-header\">
      <div class=\"primary-page-header-copy\">
        <span class=\"eyebrow\">Signature view</span>
        <h2>Fixtures</h2>
        <p class=\"hint\">Compare upcoming fixture difficulty across gameweeks. Teamsheet uses validated attack/defence strength ratings when available, otherwise Official FPL's 1–5 difficulty.</p>
      </div>
    </div>"""
    app = replace_once(app, fixtures_old, fixtures_new, 'Fixtures primary header')

    team_old = """  <section class=\"view panel\" id=\"view-squad\" hidden>
    <span class=\"eyebrow\">Gameweek plan</span>
    <h2>Team</h2>
    <p class=\"hint\">Your model-selected XI, captaincy and bench on one decision-first pitch.</p>"""
    team_new = """  <section class=\"view panel\" id=\"view-squad\" hidden>
    <div class=\"primary-page-header\">
      <div class=\"primary-page-header-copy\">
        <span class=\"eyebrow\">Gameweek plan</span>
        <h2>Team</h2>
        <p class=\"hint\">Your model-selected XI, captaincy and bench on one decision-first pitch.</p>
      </div>
    </div>"""
    app = replace_once(app, team_old, team_new, 'Team primary header')

    transfers_old = """  <section class=\"view panel\" id=\"view-transfers\" hidden>
    <div class=\"transfer-workspace-head\">
      <span class=\"eyebrow\">Decision workspace</span>
      <h2>Transfers</h2>
      <p class=\"hint\">Compare making no transfer with the strongest legal plans returned by the existing optimiser. Model comparisons are decision support, not promised FPL points.</p>
    </div>"""
    transfers_new = """  <section class=\"view panel\" id=\"view-transfers\" hidden>
    <div class=\"transfer-workspace-head primary-page-header\">
      <div class=\"primary-page-header-copy\">
        <span class=\"eyebrow\">Decision workspace</span>
        <h2>Transfers</h2>
        <p class=\"hint\">Compare making no transfer with the strongest legal plans returned by the existing optimiser. Model comparisons are decision support, not promised FPL points.</p>
      </div>
    </div>"""
    app = replace_once(app, transfers_old, transfers_new, 'Transfers primary header')

    leagues_old = """      <div class=\"league-hub-head\">
        <div><span class=\"eyebrow\">Competitive context</span><h2 tabindex=\"-1\">Leagues</h2></div>
        <a class=\"btn ghost sm\" href=\"#/leagues/manage\">Manage leagues</a>
      </div>
      <p class=\"hint\">Your current position across every connected classic league. Tap a league for its table, nearby rivals and deeper context.</p>"""
    leagues_new = """      <div class=\"league-hub-head primary-page-header primary-page-header-action\">
        <div class=\"primary-page-header-copy\"><span class=\"eyebrow\">Competitive context</span><h2 tabindex=\"-1\">Leagues</h2><p class=\"hint\">Your current position across every connected classic league. Tap a league for its table, nearby rivals and deeper context.</p></div>
        <a class=\"btn ghost sm\" href=\"#/leagues/manage\">Manage leagues</a>
      </div>"""
    app = replace_once(app, leagues_old, leagues_new, 'Leagues primary header')

    app_path.write_text(app)

    shell_path = Path('src/ui/app-shell.mjs')
    shell = shell_path.read_text()
    shell_old = """  const settingsHeader=teamsheetElement('div',{class:'panel settings-header'},
    teamsheetElement('span',{class:'eyebrow'},'Advanced tools, kept out of the way'),
    teamsheetElement('h2',{id:'settingsTitle',tabindex:'-1'},'Settings'),
    teamsheetElement('p',{class:'hint'},'Connect your team, research players, review evidence and resolve data issues without cluttering weekly decisions.'));"""
    shell_new = """  const settingsHeader=teamsheetElement('div',{class:'panel settings-header primary-page-header'},
    teamsheetElement('div',{class:'primary-page-header-copy'},
      teamsheetElement('span',{class:'eyebrow'},'Advanced tools, kept out of the way'),
      teamsheetElement('h2',{id:'settingsTitle',tabindex:'-1'},'Settings'),
      teamsheetElement('p',{class:'hint'},'Connect your team, research players, review evidence and resolve data issues without cluttering weekly decisions.')));"""
    shell = replace_once(shell, shell_old, shell_new, 'Settings primary header')
    shell_path.write_text(shell)

    tests = r'''import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app=readFileSync(new URL('../app.html',import.meta.url),'utf8');
const team=readFileSync(new URL('../src/ui/team-decision-home.mjs',import.meta.url),'utf8');
const shell=readFileSync(new URL('../src/ui/app-shell.mjs',import.meta.url),'utf8');

test('startup pending owns the full opaque document canvas and removes the normal dock reserve',()=>{
  assert.match(app,/body\.startup-pending\{[^}]*padding-bottom:0[^}]*min-height:100vh;min-height:100dvh[^}]*background-color:#10251A;background-image:linear-gradient\(155deg,#10251A/);
});

test('startup gate uses a fixed fallback, dynamic viewport height and all four safe areas',()=>{
  const gate=/\.startup-gate\{([^}]*)\}/.exec(app)?.[1]||'';
  assert.match(gate,/position:fixed/);
  assert.match(gate,/inset:0/);
  assert.match(gate,/background-color:#10251A/);
  assert.match(gate,/background-image:linear-gradient\(155deg,#10251A/);
  assert.doesNotMatch(gate,/min-height:100dvh/);
  for(const side of ['top','right','bottom','left']) assert.match(gate,new RegExp(`safe-area-inset-${side}`));
  assert.match(app,/@supports \(height:100dvh\)\{\.startup-gate\{inset:0 0 auto;height:100dvh\}\}/);
});

test('startup remains one centred composition while the normal shell is withheld',()=>{
  assert.match(app,/\.startup-gate\{[^}]*display:grid;place-items:center/);
  assert.match(app,/<div class="startup-card">[\s\S]*startup-wordmark">TEAMSHEET[\s\S]*startup-sub[\s\S]*startup-pitch[\s\S]*<\/div>\s*<\/section>/);
  assert.match(team,/\[document\.querySelector\('header'\),document\.querySelector\('main'\),document\.querySelector\('nav\.tabs'\)\]/);
  assert.match(team,/node\.hidden=Boolean\(owned\)/);
});

test('all five primary screens share one explicit page-title typography contract',()=>{
  assert.match(app,/--page-title-size:17px/);
  assert.match(app,/\.primary-page-header h2\{font-size:var\(--page-title-size\);line-height:1\.2;margin:0\}/);
});

test('all five primary introductions share one typography and spacing rhythm',()=>{
  assert.match(app,/--page-intro-size:13px/);
  assert.match(app,/--page-head-gap:12px/);
  assert.match(app,/\.primary-page-header \.hint\{color:var\(--ink-soft\);font-size:var\(--page-intro-size\);line-height:1\.4;margin:3px 0 0\}/);
  assert.match(app,/\.primary-page-header\{[^}]*margin:0 0 var\(--page-head-gap\)/);
});

test('Transfers no longer creates a separate header hierarchy',()=>{
  assert.match(app,/<div class="transfer-workspace-head primary-page-header">\s*<div class="primary-page-header-copy">/);
  assert.doesNotMatch(app,/\.transfer-workspace-head\{[^}]*display:/);
});

test('all five primary routes use the same visible header block structure',()=>{
  assert.match(app,/<section class="view panel" id="view-squad"[^>]*>\s*<div class="primary-page-header">\s*<div class="primary-page-header-copy">/);
  assert.match(app,/<section class="view panel" id="view-fixtures">\s*<div class="primary-page-header">\s*<div class="primary-page-header-copy">/);
  assert.match(app,/<section class="view panel" id="view-transfers"[^>]*>\s*<div class="transfer-workspace-head primary-page-header">\s*<div class="primary-page-header-copy">/);
  assert.match(app,/<div class="league-hub-head primary-page-header primary-page-header-action">\s*<div class="primary-page-header-copy">/);
  assert.match(shell,/class:'panel settings-header primary-page-header'[\s\S]*class:'primary-page-header-copy'/);
});

test('shared primary header box owns inset, border, background and action variant',()=>{
  const header=/\.primary-page-header\{([^}]*)\}/.exec(app)?.[1]||'';
  assert.match(header,/padding:12px 13px/);
  assert.match(header,/border:1px solid var\(--line\)/);
  assert.match(header,/border-radius:var\(--r\)/);
  assert.match(header,/background:var\(--page-header-bg\)/);
  assert.match(header,/box-shadow:none/);
  assert.match(app,/\.primary-page-header-action\{grid-template-columns:minmax\(0,1fr\) auto;align-items:start;gap:10px\}/);
  assert.match(app,/<a class="btn ghost sm" href="#\/leagues\/manage">Manage leagues<\/a>/);
});
'''
    Path('tests/mobile-ui-consistency.test.mjs').write_text(tests)


def prepend_section(path, heading, body):
    p = Path(path)
    text = p.read_text()
    marker = f"## {heading}"
    if marker in text:
        raise SystemExit(f"{path}: correction section already exists")
    first_newline = text.find('\n')
    if first_newline < 0:
        raise SystemExit(f"{path}: title line missing")
    section = f"\n\n## {heading}\n\n{body}\n"
    p.write_text(text[:first_newline+1] + section + text[first_newline+1:])


def docs():
    source_sha = os.environ['SOURCE_SHA']
    generated_sha = os.environ['GENERATED_SHA']
    shared = (
        f"The first PR #103 candidate (`0e3a0674416aa069a0f06ebee87854df41907ed0` source, "
        f"`b53c8026a5485936582da1ea2374f9bad799e44d` generated) passed 798 automated tests and permanent "
        f"Verify Teamsheet run `31338489146`, but **failed physical iPhone Safari acceptance**: the light startup "
        f"strip remained and the five primary-route header boxes still presented inconsistent structure/rhythm. The corrected "
        f"review source is `{source_sha}` with generated-only child `{generated_sha}`. It adds two regressions, retains all 798 "
        f"prior tests and passes **800 tests** before publication. The correction gives Safari an explicit opaque dark startup "
        f"background colour beneath the gradient and gives Team, Transfers, Fixtures, Leagues and Settings one shared "
        f"`primary-page-header` box/title/intro contract while preserving the Leagues Manage action. Physical iPhone Safari "
        f"retest remains required; merge is not approved."
    )
    for path in ['CLAUDE.md','docs/PROJECT_CONTEXT.md','docs/ROADMAP.md','docs/KNOWN_LIMITATIONS.md','docs/TESTING.md']:
        prepend_section(path, '9 August 2026 physical UI correction', shared)

    arch = Path('docs/ARCHITECTURE.md')
    arch_text = arch.read_text()
    arch_marker = "## Mobile viewport and primary-screen presentation boundary\n"
    arch_add = (
        "\n**Physical correction:** the first candidate passed automation but failed iPhone Safari. The corrected boundary now "
        "requires an explicit opaque startup document/gate background colour beneath the decorative gradient, and the five "
        "primary routes share one structural `primary-page-header` presentation block rather than only selector-level font tokens. "
        "Leagues retains its Manage action as an action variant. This remains presentation-only.\n"
    )
    if arch_add.strip() in arch_text:
        raise SystemExit('ARCHITECTURE correction already present')
    arch_text = replace_once(arch_text, arch_marker, arch_marker + arch_add, 'architecture correction location')
    arch.write_text(arch_text)

    decisions = Path('docs/DECISIONS.md')
    dec = decisions.read_text()
    old_decision = "Decision: make the startup-pending document itself own the dark canvas, remove the normal dock reserve during startup, retain a fixed-position fallback and use `100dvh` where supported, account for all four safe-area insets, and preserve the existing single centred startup composition with the normal shell hidden. Establish explicit shared 17px title, 13px intro and 12px spacing tokens across Team, Transfers, Fixtures, Leagues and Settings while retaining each screen's content-specific structure."
    new_decision = "Decision: make the startup-pending document itself own the dark canvas, remove the normal dock reserve during startup, retain a fixed-position fallback and use `100dvh` where supported, account for all four safe-area insets, and preserve the existing single centred startup composition with the normal shell hidden. After the first physical failure, require an explicit opaque `#10251A` document/gate background colour beneath the gradient so Safari safe-area canvas exposure cannot fall through to the light app background. Establish one structural `primary-page-header` box contract across Team, Transfers, Fixtures, Leagues and Settings—shared inset, border, background, 17px title, 13px intro and spacing—while retaining Leagues' Manage action and each screen's content-specific structure."
    dec = replace_once(dec, old_decision, new_decision, 'D-45 corrected decision')
    old_evidence = "Evidence: reviewed source `0e3a0674416aa069a0f06ebee87854df41907ed0` adds six focused regressions and passed the complete **798-test** suite. Generated-only child `b53c8026a5485936582da1ea2374f9bad799e44d` was produced twice from that exact source with byte-identical outputs, root/deployable equality and reachable generated provenance. Physical iPhone Safari acceptance remains pending and merge is not approved."
    new_evidence = (f"Evidence: the first source `0e3a0674416aa069a0f06ebee87854df41907ed0` / generated child "
                    f"`b53c8026a5485936582da1ea2374f9bad799e44d` passed 798 tests and permanent run `31338489146` but failed physical "
                    f"iPhone Safari acceptance for the remaining startup strip and inconsistent primary header boxes. Corrected source "
                    f"`{source_sha}` adds two physical-findings regressions, retains all 798 prior tests and passes **800 tests**; generated-only "
                    f"child `{generated_sha}` is deterministically reproduced with root/deployable equality and reachable provenance before publication. "
                    f"Corrected physical iPhone Safari retest remains pending and merge is not approved.")
    dec = replace_once(dec, old_evidence, new_evidence, 'D-45 corrected evidence')
    decisions.write_text(dec)


if __name__ == '__main__':
    if len(sys.argv) != 2 or sys.argv[1] not in {'source','docs'}:
        raise SystemExit('usage: mobile-ui-physical-correction.py source|docs')
    source() if sys.argv[1] == 'source' else docs()
