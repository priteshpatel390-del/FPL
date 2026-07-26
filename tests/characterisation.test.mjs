// tests/characterisation.test.mjs — Stage 1: pins CURRENT behaviour before refactor.
// Run: node --test tests/            Regenerate golden: UPDATE_GOLDEN=1 node --test tests/
//
// Two golden sections:
//   stable            — behaviour we intend to preserve through extraction (Stage 2)
//   expectedToChange  — behaviour captured but KNOWN-INCORRECT (docs/AUDIT.md issue ids);
//                       these tests document today's output and MUST be updated when the
//                       relevant stage lands. Do not treat a diff here as a regression
//                       once its stage ships — treat it as the fix arriving.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { loadApp, syntheticWorld, roundDeep } from './harness.mjs';

const GOLDEN_PATH = new URL('./golden.json', import.meta.url);
const UPDATE = process.env.UPDATE_GOLDEN === '1';

const { T } = loadApp();
syntheticWorld(T);

/* ---------- build the observed-behaviour object ---------- */
const obs = { stable: {}, expectedToChange: {} };
const S = T.S;

// fixture model (layer 1 only)
S.ustat = null; S.odds = null;
obs.stable.matchContext_strong_home = T.matchContext(1, 20, true);
obs.stable.matchContext_weak_away   = T.matchContext(20, 1, false);
obs.stable.multToDiff_boundaries = [1.30,1.28,1.27,1.10,1.09,0.93,0.92,0.78,0.77].map(T.multToDiff);
obs.stable.runScore_attack_t1 = T.runScore(1, 11, 6, 'attack');
obs.stable.runScore_def_t1    = T.runScore(1, 11, 6, 'defence');
obs.stable.double_gw11_team5  = T.teamFixtures(5, 11, 1)[0].length;

// layer blending
S.ustat = { 1:{atk:1.6,def:1.2}, 20:{atk:0.8,def:0.7} };
obs.stable.matchContext_with_ustat = T.matchContext(1, 20, true);
S.odds = { '1|20': { xGH: 2.6, xGA: 0.7 } };
obs.stable.matchContext_with_odds_home = T.matchContext(1, 20, true);
obs.stable.matchContext_with_odds_awayPerspective = T.matchContext(20, 1, false);
S.ustat = null; S.odds = null; T.clearXP();

// projections per archetype (season live)
const by = id => S.byId[id];
for (const [label, id] of [['eliteFWD',101],['goodFWD',102],['budgetFWD',103],['eliteMID',104],
  ['dcMID',105],['eliteDEF',106],['weakDEF',107],['eliteGKP',108],['busyGKP',109]]) {
  const x = T.projectXP(by(id), 11, 6);
  obs.stable['xp_' + label] = { total: x.total, perGW: x.perGW, parts: x.parts };
}
obs.stable.xp_injured_isZero = T.projectXP(by(111), 11, 6).total;
obs.stable.xp_doubt75_scaled = T.projectXP(by(110), 11, 6).total;
obs.stable.availability_states = ['a','d','i','s','u','n'].map(st =>
  T.availability({ status: st, chance_of_playing_next_round: st === 'd' ? 75 : 100 }));

// calibration application
S.calib = { 4: 1.2 };
obs.stable.xp_eliteFWD_calibrated_ratio =
  T.projectXP(by(101), 11, 6).total / obs.stable.xp_eliteFWD.total;
S.calib = null;

// pre-season fallback
S.seasonLive = false; T.clearXP();
obs.stable.preseason_priceBaseline_ordering =
  T.priceBaseline({ now_cost:140, element_type:4, selected_by_percent:'30' }) >
  T.priceBaseline({ now_cost:45,  element_type:4, selected_by_percent:'5' });
obs.stable.preseason_xp_eliteFWD = T.projectXP(by(101), 11, 6).total;
S.seasonLive = true; T.clearXP();

// best XI + sell price
const squad = [108,109,106,107, 101,102,103, 104,105,110, 111]
  .concat([/* pad with clones */]).map((id,i) => ({ p: by(id), position: i+1, multiplier: 1 }));
// build a legal 15: 2 GKP, 5 DEF, 5 MID, 3 FWD using clones of existing archetypes
const clone = (id, nid, type) => { const c = { ...by(id), id: nid, element_type: type, web_name:'C'+nid }; S.byId[nid]=c; return c; };
const full15 = [ by(108), by(109),
  by(106), by(107), clone(106,201,2), clone(107,202,2), clone(106,203,2),
  by(104), by(105), by(110), clone(104,204,3), clone(105,205,3),
  by(101), by(102), by(103) ].map((p,i) => ({ p, position:i+1, multiplier:1 }));
const xi = T.bestXI(full15, 11);
obs.stable.bestXI = { shape: xi.shape, tot: xi.tot, xiSize: xi.xi.length, benchSize: xi.bench.length,
  gkInXI: xi.xi.filter(s => s.p.element_type === 1).length };
obs.stable.sellPrice_cases = [
  T.sellPrice({ p:{now_cost:50}, bought:50 }), T.sellPrice({ p:{now_cost:52}, bought:50 }),
  T.sellPrice({ p:{now_cost:51}, bought:50 }), T.sellPrice({ p:{now_cost:48}, bought:50 }) ];

// utilities
obs.stable.poisson_over25_at27 = T.poissonOver(2.7, 2.5);
obs.stable.solveLambda_inverts = T.poissonOver(T.solveLambda(0.55, 2.5), 2.5);
obs.stable.csv_quoted = T.parseCSV('name,v\n"Smith, John",5\n"O""Brien",3\n')[1][0];
obs.stable.pearson_correlated = T.pearson([1,2,3,4,5],[2.1,3.9,6.2,7.8,10.1]);
obs.stable.mapTeamName = [T.mapTeamName('Manchester United'), T.mapTeamName('Tottenham Hotspur'),
  T.mapTeamName('Nottingham Forest'), T.mapTeamName('Real Madrid')];
obs.stable.parseUnderstat_decodes = (() => {
  const page = `var teamsData = JSON.parse('\\x7B\\x221\\x22\\x3A\\x7B\\x22title\\x22\\x3A\\x22Manchester United\\x22,\\x22history\\x22\\x3A\\x5B\\x7B\\x22xG\\x22\\x3A1.5,\\x22xGA\\x22\\x3A0.8\\x7D\\x5D\\x7D\\x7D');`;
  const d = T.parseUnderstat(page); return d?.['1']?.title ?? null; })();

/* ---------- expected-to-change (AUDIT.md issue ids) ---------- */
// MIN-1: crude minutes model — season minutes / current GW
obs.expectedToChange['MIN1_expectedMinutes_900min_gw10'] =
  T.expectedMinutes({ minutes: 900 });                          // = 90, ignores recency
obs.expectedToChange['MIN1_expectedMinutes_bencher_450min'] =
  T.expectedMinutes({ minutes: 450 });                          // = 45 "half games" fiction
// DEN-1: denominator is current GW even if club played fewer matches
obs.expectedToChange['DEN1_gamesPlayed_equals_currentGW'] = S.gamesPlayed === S.currentGW;
// SCOR-1: linear stepped-rule approximations (capture representative components)
obs.expectedToChange['SCOR1_gk_parts'] =
  { saves: obs.stable.xp_busyGKP.parts['Saves'], conceded: obs.stable.xp_busyGKP.parts['Goals conceded'] };
// SCOR-2: bonus from BPS/90 heuristic
obs.expectedToChange['SCOR2_bonus_eliteFWD'] = obs.stable.xp_eliteFWD.parts['Bonus'];
// FIX-1: arbitrary blank/double constants
obs.expectedToChange['FIX1_blank_penalty_probe'] = T.runScore(6, 11, 1, 'attack'); // team with plain single fixture baseline
// LEAK-1 is procedural (backtest method), pinned by BT snapshot below and documented; no unit value.

const observed = roundDeep(obs, 6);

/* ---------- golden compare / update ---------- */
if (UPDATE || !existsSync(GOLDEN_PATH)) {
  writeFileSync(GOLDEN_PATH, JSON.stringify(observed, null, 2));
  console.log('golden.json ' + (UPDATE ? 'updated' : 'created') + ' — review and commit it.');
}
const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'));

function assertSection(name) {
  for (const key of Object.keys(golden[name])) {
    test(`${name}: ${key}`, () => assert.deepEqual(observed[name][key], golden[name][key]));
  }
  for (const key of Object.keys(observed[name]))
    test(`${name}: ${key} present in golden`, () => assert.ok(key in golden[name]));
}
assertSection('stable');
assertSection('expectedToChange');

test('meta: expectedToChange keys carry audit issue ids', () => {
  for (const k of Object.keys(golden.expectedToChange))
    assert.match(k, /^(MIN1|DEN1|SCOR1|SCOR2|FIX1|LEAK1|TRF1|UST1|ODDS1|BT1)/);
});
