import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const viewSource = readFileSync(new URL('../src/ui/mini-leagues-view.mjs', import.meta.url), 'utf8');
const stateSource = readFileSync(new URL('../src/ui/mini-leagues-state.mjs', import.meta.url), 'utf8');
const appHtml = readFileSync(new URL('../app.html', import.meta.url), 'utf8');

test('stale Mini-League convenience helpers stay removed while live owners remain', () => {
  assert.doesNotMatch(viewSource, /\brenderLeagueChips\b/);
  assert.doesNotMatch(stateSource, /\brememberLeague\b/);
  assert.doesNotMatch(appHtml, /\bid=["']leagueChips["']/);

  assert.match(viewSource, /function renderLeagueManageList\s*\(/);
  assert.match(viewSource, /function renderMiniLeagues\s*\(/);
  assert.match(viewSource, /renderLeaguePickerSummary\(\); renderLeagueManageList\(\);/);
  assert.match(stateSource, /async function upsertMiniLeague\s*\(/);
  assert.match(stateSource, /async function selectMiniLeague\s*\(id\)\{ return upsertMiniLeague\(id,''\,\{select:true\}\); \}/);
});
