// tests/resilience.test.mjs — adjustment 7: failure-mode behaviour pinned
// before the deeper refactors. Mix of direct imports and harness where DOM is touched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { S, hydrate } from '../src/state.mjs';
import { sget, sset, cacheGet, cachePut } from '../src/storage.mjs';
import { parseCSV, computeBacktest } from '../src/model/backtest.mjs';
import { teamFixtures, matchContext } from '../src/model/fixtures.mjs';
import { projectXP, clearXP } from '../src/model/scoring.mjs';
import { bestXI } from '../src/squad.mjs';
import { mapTeamName } from '../src/providers/common.mjs';
import { parseUnderstat } from '../src/providers/understat.mjs';
import { escapeHTML } from '../src/util.mjs';
import { loadApp, syntheticWorld } from './harness.mjs';

// minimal DOM stub: hydrate touches the position <select> at call time
globalThis.document = globalThis.document || { getElementById: () => ({ value:'', checked:false,
  options:{length:9}, add(){}, innerHTML:'', addEventListener(){}, querySelectorAll(){return []} }),
  querySelectorAll: () => [], addEventListener(){}, createElement: () => ({}) };
globalThis.window = globalThis.window || {};
globalThis.localStorage = globalThis.localStorage ||
  { _d:{}, getItem(k){ return this._d[k] ?? null; }, setItem(k,v){ this._d[k]=v; } };

syntheticWorld({ hydrate, S, clearXP: () => {} }); clearXP();

test('resilience: corrupted cache JSON reads as null, not a crash', async () => {
  localStorage.setItem('t:bad', '{not json!!');
  assert.equal(await sget('t:bad'), null);
  localStorage.setItem('t:bad2', JSON.stringify('just-a-string'));
  assert.equal(await cacheGet('t:bad2'), null, 'non-envelope shape rejected');
});

test('resilience: missing optional player fields default safely', () => {
  const bare = { id: 9001, web_name:'Bare', team: 1, element_type: 3, now_cost: 50,
    status:'a', minutes: 450 }; // no xG/xA/bps/saves/dc/cards fields at all
  S.byId[9001] = bare;
  const x = projectXP(bare, 11, 3);
  assert.ok(isFinite(x.total) && x.total >= 0, 'projects finite non-negative: ' + x.total);
});

test('resilience: malformed provider responses do not poison state', () => {
  assert.equal(parseUnderstat('<html>redesigned page, no teamsData</html>'), null);
  assert.equal(parseUnderstat(`teamsData = JSON.parse('\x7Bbroken')`), null);
  assert.throws(() => computeBacktest('wrong,headers\n1,2\n'), /archive format changed/);
});

test('resilience: odds provider outage → no data, fallback note, key never relayed', async () => {
  const { T, doc, setFetch } = loadApp({ oddsKey: 'k' });
  syntheticWorld(T);
  doc['oddsKey'].value = 'sk-live-SECRET';
  const urls = [];
  setFetch(async u => { urls.push(String(u)); throw new Error('down'); });
  await globalThis.loadOdds();
  assert.equal(T.S.odds, null);
  assert.match(T.S.oddsNote, /internal team model/i);
  assert.ok(urls.every(u => u.startsWith('https://api.the-odds-api.com/')));
});

// FORMERLY A PINNED LIMITATION (DUP-1). Until Stage 3 / D-13 this test asserted
// the OPPOSITE — that duplicate fixture rows were visibly double-counted — and
// was pinned as documented known-bad behaviour. DUP-1 is now closed by
// normaliseFixtures() in hydrate(); this test characterises the fixed behaviour.
// The assertion that genuine doubles STILL appear is the more valuable half:
// a dedupe that quietly ate real double gameweeks would be far worse than the
// original bug.
test('resilience: duplicate fixture rows are collapsed, genuine doubles preserved (DUP-1 closed)', () => {
  const ELEMENT_TYPES = [{id:1,singular_name_short:'GKP',singular_name:'Goalkeeper'},
    {id:2,singular_name_short:'DEF',singular_name:'Defender'},
    {id:3,singular_name_short:'MID',singular_name:'Midfielder'},
    {id:4,singular_name_short:'FWD',singular_name:'Forward'}];
  const world = syntheticWorld({ hydrate, S, clearXP: () => {} });

  // team 1's single genuine GW12 game, duplicated verbatim in the payload
  const real = world.fixtures.find(f => f.event === 12 && (f.team_h === 1 || f.team_a === 1));
  assert.ok(real, 'synthetic world has a GW12 fixture for team 1');
  const payload = world.fixtures.concat([{ ...real }]);

  hydrate({ at: 1753500000000, events: world.events, teams: world.teams,
    elements: world.elements, element_types: ELEMENT_TYPES, fixtures: payload });

  assert.equal(teamFixtures(1, 12, 1)[0].length, 1,
    'the duplicated row is collapsed — no phantom double for team 1');
  assert.equal(S.dataIssues.find(i => i.code === 'fixture_exact_duplicate').count, 1,
    'and the collapse is reported rather than silent');

  // team 5 has a REAL double in GW11 (16-v-5 plus the extra 5-v-12 row)
  assert.equal(teamFixtures(5, 11, 1)[0].length, 2,
    'genuine double gameweek still reported after dedupe');
  assert.equal(teamFixtures(12, 11, 1)[0].length, 2,
    'and for the other side of that same extra fixture');

  syntheticWorld({ hydrate, S, clearXP: () => {} }); clearXP();   // restore
});

test('resilience: unmapped team name returns null and blend degrades cleanly', () => {
  assert.equal(mapTeamName('FC Nowhere United'), null);
  S.ustat = { 1: {atk:1.2, def:1.1} };        // opponent 20 missing entirely
  const ctx = matchContext(1, 20, true);
  assert.ok(isFinite(ctx.xGF), 'partial understat coverage → static layer used');
  S.ustat = null;
});

test('resilience: HTML escaping covers quotes, tags and ampersands', () => {
  const nasty = `Bob & Alice <script>alert("x")</script> O'Neil`;
  const safe = escapeHTML(nasty);
  assert.ok(!safe.includes('<script>') && !safe.includes('"') && safe.includes('&amp;'));
});

test('resilience: bench handling — keeper cannot be outfield sub and vice versa', () => {
  const clone = (id,nid,t)=>{ const c={...S.byId[id], id:nid, element_type:t}; S.byId[nid]=c; return c; };
  const squad = [S.byId[108], S.byId[109],
    S.byId[106], S.byId[107], clone(106,401,2), clone(107,402,2), clone(106,403,2),
    S.byId[104], S.byId[105], S.byId[110], clone(104,404,3), clone(105,405,3),
    S.byId[101], S.byId[102], S.byId[103]].map((p,i)=>({p, position:i+1, multiplier:1}));
  const xi = bestXI(squad, 11);
  const benchGK = xi.bench.filter(s => s.p.element_type === 1);
  assert.equal(benchGK.length, 1, 'exactly one keeper on the bench');
  // current bench-order behaviour: keeper is sorted last among bench players
  assert.equal(xi.bench[xi.bench.length - 1].p.element_type, 1,
    'keeper occupies the final bench slot (current behaviour, pinned)');
});
