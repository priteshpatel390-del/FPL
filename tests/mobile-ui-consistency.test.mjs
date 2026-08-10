import test from 'node:test';
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

test('empty Leagues live status contributes no pre-header vertical space',()=>{
  assert.match(app,/#leagueLiveStatus:empty\{display:none\}/);
  assert.match(app,/<div id="leagueDataWarning"><\/div>\s*<p class="status" id="leagueLiveStatus" aria-live="polite"><\/p>\s*<section class="panel league-route" id="leagueHub"/);
});
