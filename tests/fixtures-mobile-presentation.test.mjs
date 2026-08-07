import test from 'node:test';
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
  assert.match(app,/id="fixtureModeNote"><\/div>\s*<div class="ticker-wrap"><div id="ticker"><\/div><\/div>/);
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
