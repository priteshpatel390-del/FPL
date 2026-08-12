import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { S } from '../src/state.mjs';
import {
  K_MINI_LEAGUES, normaliseMiniLeagueState, selectMiniLeague, selectedMiniLeague
} from '../src/ui/mini-leagues-state.mjs';

const viewSource = readFileSync(new URL('../src/ui/mini-leagues-view.mjs', import.meta.url), 'utf8');
const stateSource = readFileSync(new URL('../src/ui/mini-leagues-state.mjs', import.meta.url), 'utf8');
const appHtml = readFileSync(new URL('../app.html', import.meta.url), 'utf8');
const bundle = readFileSync(new URL('../dist/app.bundle.js', import.meta.url), 'utf8');
const harness = readFileSync(new URL('./harness.mjs', import.meta.url), 'utf8');

class MemoryStorage{
  constructor(){this.map=new Map();}
  get length(){return this.map.size;}
  key(index){return [...this.map.keys()][index]??null;}
  getItem(key){return this.map.has(key)?this.map.get(key):null;}
  setItem(key,value){this.map.set(key,String(value));}
  removeItem(key){this.map.delete(key);}
}

/* Returns the source text between the braces of a declared function, or null when no such
   function is declared. Brace matching keeps this independent of how the body is laid out,
   and deliberately avoids adding a parser to the zero-dependency toolchain. */
function functionBody(source, name) {
  const signature = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`);
  const match = signature.exec(source);
  if (!match) return null;
  let depth = 0;
  for (let i = match.index + match[0].length - 1; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(match.index + match[0].length, i);
  }
  return null;
}

/* The structural half of the selectMiniLeague contract.
   ----------------------------------------------------
   This replaced an assertion that pinned one exact source line, including its spacing, so a
   harmless reformat failed CI while behaviour was identical. Whitespace is stripped before
   matching, which makes line breaks, indentation and spacing irrelevant while keeping the
   contract that actually matters: selection is delegated to the canonical `upsertMiniLeague`
   owner with selection enabled, and this function never writes canonical state or persists
   on its own. `selectMiniLeagueContract` is exercised against mutants below, so its
   sensitivity is proven rather than assumed. */
function selectMiniLeagueContract(source) {
  const body = functionBody(source, 'selectMiniLeague');
  if (body === null) return 'selectMiniLeague is not declared as a function';
  const code = body.replace(/\s+/g, '');
  if (!/return(await)?upsertMiniLeague\(id[,)]/.test(code)) return 'selectMiniLeague does not delegate to upsertMiniLeague(id, …)';
  if (!/select:true/.test(code)) return 'selectMiniLeague does not enable selection';
  if (/select:false/.test(code)) return 'selectMiniLeague disables selection';
  if (/S\.miniLeagues=/.test(code)) return 'selectMiniLeague writes canonical Mini-League state directly';
  if (/persistMiniLeagueState\(/.test(code)) return 'selectMiniLeague persists directly instead of through upsertMiniLeague';
  return null;
}

test('stale Mini-League convenience helpers stay removed while live owners remain', () => {
  assert.doesNotMatch(viewSource, /\brenderLeagueChips\b/);
  assert.doesNotMatch(stateSource, /\brememberLeague\b/);
  assert.doesNotMatch(appHtml, /\bid=["']leagueChips["']/);

  assert.match(viewSource, /function renderLeagueManageList\s*\(/);
  assert.match(viewSource, /function renderMiniLeagues\s*\(/);
  assert.match(viewSource, /renderLeaguePickerSummary\(\); renderLeagueManageList\(\);/);
  assert.match(stateSource, /async function upsertMiniLeague\s*\(/);
  assert.equal(selectMiniLeagueContract(stateSource), null);
});

test('the removed Mini-League helpers leave no generated-bundle or test-harness consumer', () => {
  // The shipped single-file bundle is the canonical runtime surface.
  assert.doesNotMatch(bundle, /\brenderLeagueChips\b/);
  assert.doesNotMatch(bundle, /\brememberLeague\b/);
  // The shared harness re-exports bundle identifiers by name, so a stale entry
  // here throws a ReferenceError inside loadApp() and fails every bundle suite.
  assert.doesNotMatch(harness, /\brenderLeagueChips\b/);
  assert.doesNotMatch(harness, /\brememberLeague\b/);
});

/* The behavioural half. Each assertion is a consequence of delegating to
   upsertMiniLeague(id, '', {select:true}) rather than reimplementing selection:
   an empty name must not overwrite a stored one, an unknown league is added and
   selected, and an unusable identifier selects nothing. */
test('selectMiniLeague selects through the canonical Mini-League owner at runtime', async () => {
  delete globalThis.document;
  globalThis.window = {};
  globalThis.localStorage = new MemoryStorage();
  S.miniLeagues = normaliseMiniLeagueState({
    saved: [{ id: '11', name: 'Work' }, { id: '22', name: 'Family' }],
    selectedLeagueId: '11'
  });

  assert.equal((await selectMiniLeague('22'))?.id, '22');
  assert.equal(selectedMiniLeague()?.id, '22');
  // The empty name argument must leave an existing name intact.
  assert.equal(selectedMiniLeague()?.name, 'Family');
  // Selection is durable through the canonical verified-save path.
  assert.ok(globalThis.localStorage.getItem(K_MINI_LEAGUES), 'selection was not persisted');

  // An unknown league is added by the same owner, then selected.
  assert.equal((await selectMiniLeague('33'))?.id, '33');
  assert.equal(S.miniLeagues.saved.some(row => row.id === '33'), true);

  // An unusable identifier changes nothing.
  assert.equal(await selectMiniLeague('not-a-league'), null);
  assert.equal(selectedMiniLeague()?.id, '33');
});

/* Proves the structural contract is sensitive to real regressions and tolerant of
   formatting, so removing the old exact-source assertion did not weaken protection. */
test('the selectMiniLeague contract rejects regressions but tolerates reformatting', () => {
  const accepted = [
    "async function selectMiniLeague(id){ return upsertMiniLeague(id,'',{select:true}); }",
    "async function selectMiniLeague (id) {\n  return upsertMiniLeague(id, '', { select: true });\n}",
    "async function selectMiniLeague(id){\n\treturn await upsertMiniLeague(id, '', {select: true});\n}"
  ];
  for (const source of accepted) {
    assert.equal(selectMiniLeagueContract(source), null, `harmless formatting was rejected: ${source}`);
  }

  const rejected = [
    // the function disappears entirely
    "async function upsertMiniLeague(id,name,options){ return null; }",
    // selection is disabled
    "async function selectMiniLeague(id){ return upsertMiniLeague(id,'',{select:false}); }",
    // no longer delegates to the canonical owner
    "async function selectMiniLeague(id){ return null; }",
    // bypasses the owner and writes canonical state directly
    "async function selectMiniLeague(id){ const s=normaliseMiniLeagueState(S.miniLeagues); s.selectedLeagueId=id; S.miniLeagues=s; return persistMiniLeagueState(); }"
  ];
  for (const source of rejected) {
    assert.notEqual(selectMiniLeagueContract(source), null, `a meaningful regression was accepted: ${source}`);
  }
});
