import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app=readFileSync(new URL('../app.html',import.meta.url),'utf8');
const team=readFileSync(new URL('../src/ui/team-decision-home.mjs',import.meta.url),'utf8');

test('startup pending owns the full document canvas and removes the normal dock reserve',()=>{
  assert.match(app,/body\.startup-pending\{[^}]*padding-bottom:0[^}]*min-height:100vh;min-height:100dvh[^}]*background:linear-gradient\(155deg,#10251A/);
});

test('startup gate uses a fixed fallback, dynamic viewport height and all four safe areas',()=>{
  const gate=/\.startup-gate\{([^}]*)\}/.exec(app)?.[1]||'';
  assert.match(gate,/position:fixed/);
  assert.match(gate,/inset:0/);
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
  assert.match(app,/#view-squad>h2,#view-fixtures>h2,#view-transfers \.transfer-workspace-head>h2,#leagueHub \.league-hub-head h2,\.settings-header>h2\{font-size:var\(--page-title-size\);line-height:1\.2;margin:0 0 2px\}/);
});

test('all five primary introductions share one typography and spacing rhythm',()=>{
  assert.match(app,/--page-intro-size:13px/);
  assert.match(app,/--page-head-gap:12px/);
  assert.match(app,/#view-squad>\.hint,#view-fixtures>\.hint,#view-transfers \.transfer-workspace-head>\.hint,#leagueHub>\.hint,\.settings-header>\.hint\{color:var\(--ink-soft\);font-size:var\(--page-intro-size\);margin:3px 0 var\(--page-head-gap\)\}/);
  assert.match(app,/\.settings-header>\.hint\{margin-bottom:0\}/);
  assert.doesNotMatch(app,/#view-squad>\.hint\{margin:3px 0 8px\}/);
});

test('Transfers no longer creates a separate grid-gap header hierarchy',()=>{
  assert.match(app,/\.transfer-workspace-head\{display:block;margin-bottom:0\}/);
  assert.doesNotMatch(app,/\.transfer-workspace-head\{[^}]*gap:/);
});
