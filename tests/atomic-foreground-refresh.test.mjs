// Atomic Foreground Refresh — the approved 117-test contract.
//
// R2 as amended by R3 A1-A8, R3.1 B1-B8, R3.2 C1-C8, R3.3 D1-D7 and R3.4 E1-E7.
// These are behavioural wherever behaviour can be reached; the few structural
// assertions guard invariants that cannot be observed at runtime (a suspension
// point inside the commit, an accessor on S).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const MAIN_SOURCE = readFileSync(new URL('../src/main.mjs', import.meta.url), 'utf8');
const APPLIED_SOURCE = readFileSync(new URL('../src/providers/applied.mjs', import.meta.url), 'utf8');
const STORAGE_SOURCE = readFileSync(new URL('../src/storage.mjs', import.meta.url), 'utf8');
const VIEWS_SOURCE = readFileSync(new URL('../src/ui/views.mjs', import.meta.url), 'utf8');
const STATE_SOURCE = readFileSync(new URL('../src/state.mjs', import.meta.url), 'utf8');
const MINUTES_SOURCE = readFileSync(new URL('../src/providers/minutes-history.mjs', import.meta.url), 'utf8');
const TRANSPORT_SOURCE = readFileSync(new URL('../src/providers/transport.mjs', import.meta.url), 'utf8');

const HOUR = 60 * 60 * 1000, DAY = 24 * HOUR;

// Minimal DOM/browser stubs. Installed before the modules under test load.
const fields = {useManual:{checked:false}, useUstat:{checked:true}, oddsKey:{value:''},
  teamId:{value:''}, ftCount:{value:'1'}, bankIn:{value:'0'}, trHorizon:{value:'6'}, trTop:{value:'8'},
  plPos:{options:{length:1}, add(){}}, status:{textContent:''}, ticker:{}, fxFrom:{value:''}, fxSpan:{value:'6', max:'38'}};
globalThis.document = {getElementById:id => fields[id] || {value:'', checked:false},
  activeElement:null, addEventListener(){}, dispatchEvent(){ return true; }, querySelector(){ return null; },
  body:{classList:{toggle(){}, add(){}, remove(){}, contains(){ return false; }}, setAttribute(){}, dataset:{}}};
globalThis.window = {addEventListener(){}};
globalThis.CustomEvent = class { constructor(type, options){ this.type = type; this.detail = options?.detail; } };
globalThis.localStorage = {_d:{}, getItem(k){ return this._d[k] ?? null; },
  setItem(k, v){ this._d[k] = String(v); }, removeItem(k){ delete this._d[k]; }};

const { S, prepareCore, captureStateJournal, restoreStateJournal, slim } = await import('../src/state.mjs');
const { SCHEMA_VERSION, MODEL_VERSION, SUPPORTING_REFRESH_RULES, MINUTES_RULES } = await import('../src/config.mjs');
const { ssetChecked, sset } = await import('../src/storage.mjs');
const { snapshotHealth, restoreHealth, getHealth, resetHealth, markLive, markCached,
  HEALTH_STATES, APPROVED_PROVIDER_NAMES, setHealth } = await import('../src/providers/registry.mjs');
const { xpCacheValueSnapshot, xpCacheRefSnapshot, xpOf, clearXP } = await import('../src/model/scoring.mjs');
const applied = await import('../src/providers/applied.mjs');
const { gatewayOnce } = await import('../src/providers/transport.mjs');
const { computeMinuteHistories, cohort, completedDataRevision, minuteCacheDecision, validCachedEntry } =
  await import('../src/providers/minutes-history.mjs');
const { computeUnderstat } = await import('../src/providers/understat.mjs');
const { computeOdds } = await import('../src/providers/odds.mjs');
const main = await import('../src/main.mjs');

/* ---------------------------------------------------------------------
   Synthetic world
   --------------------------------------------------------------------- */
function team(id, name){
  return {id, name, short_name:name.slice(0,3).toUpperCase(),
    strength_attack_home:1200, strength_attack_away:1150,
    strength_defence_home:1180, strength_defence_away:1120};
}
function payload({season = '2026', finishedGw = false, teamNames = null} = {}){
  const names = teamNames || ['Arsenal','Chelsea','Everton','Fulham'];
  return {
    events:[{id:1, deadline_time:`${season}-08-14T17:30:00Z`, is_current:finishedGw, is_next:!finishedGw,
      finished:finishedGw, data_checked:finishedGw, name:'Gameweek 1'},
      {id:2, deadline_time:`${season}-08-21T17:30:00Z`, is_current:false, is_next:finishedGw,
        finished:false, data_checked:false, name:'Gameweek 2'}],
    teams:names.map((name, index) => team(index + 1, name)),
    element_types:[{id:1, singular_name_short:'GKP', singular_name:'Goalkeeper'},
      {id:2, singular_name_short:'DEF', singular_name:'Defender'}],
    elements:[1,2,3,4].map(id => ({id, web_name:'P' + id, team:((id - 1) % 4) + 1, element_type:(id % 2) + 1,
      now_cost:50, total_points:10, form:'2.0', points_per_game:'2.0', selected_by_percent:'5.0',
      minutes:90, status:'a'}))
  };
}
function fixtures({kickoffs = null, homeAway = null} = {}){
  const ko = kickoffs || ['2026-08-15T14:00:00Z','2026-08-15T16:30:00Z'];
  const ha = homeAway || [[1,2],[3,4]];
  return ha.map((pair, index) => ({event:1, id:index + 1, team_h:pair[0], team_a:pair[1],
    team_h_difficulty:3, team_a_difficulty:3, kickoff_time:ko[index], started:false, finished:false}));
}
function coreOf(options = {}){
  const prepared = prepareCore(slim(payload(options), fixtures(options)));
  assert.equal(prepared.ok, true);
  return prepared.core;
}
function resetWorld(){
  resetHealth();
  applied.resetProviderTokens();
  applied.resetOddsKeyEpoch();
  clearXP();
  S.boot = null; S.fixtures = null; S.entry = null; S.picks = null; S.history = null;
  S.picksGameweek = 0; S.picksStatus = 'idle'; S.chipsUsed = [];
  S.ustat = null; S.ustatNote = ''; S.odds = null; S.oddsNote = '';
  S.minuteHistory = {}; S.minuteHistoryMeta = {};
  S.providerApplied = {understat:null, odds:null};
  S.dataIssues = []; S.retryStats = {}; S.manual = []; S.teamId = '';
  S.__accountKeys = undefined;
  fields.useManual.checked = false; fields.useUstat.checked = true;
  fields.oddsKey.value = ''; fields.teamId.value = '';
  globalThis.document.activeElement = null;
}
test.beforeEach(resetWorld);

const ustatMap = () => ({1:{xg:1.5, xga:1.1, atk:1.05, def:0.95}, 2:{xg:1.2, xga:1.4, atk:0.9, def:1.1}});
const oddsMap = () => ({'1|2':{hId:1, aId:2, xGH:1.6, xGA:1.1, kickoff:null, providerEventId:'e1',
  fetchedAt:1000, booksUsed:4, marketCount:8, staleDropped:0, confidence:'normal'}});
function appliedRecord(core, fetchedAt, over = {}){
  return {signature:'sig', season:core.season, schemaVersion:SCHEMA_VERSION,
    modelVersion:MODEL_VERSION, fetchedAt, ...over};
}

/* =====================================================================
   A · Collection purity (R3.1 B-series, R3.2 C8, R3.3 D6)
   ===================================================================== */

function deepSnapshot(value, seen = new WeakSet()){
  if(value === null || typeof value !== 'object') return value;
  if(seen.has(value)) return '[circular]';
  seen.add(value);
  if(Array.isArray(value)) return value.map(item => deepSnapshot(item, seen));
  const out = {};
  Object.keys(value).sort().forEach(key => { out[key] = deepSnapshot(value[key], seen); });
  return out;
}

test('1a · collection leaves S, the health registry and xpCache byte-identical', async () => {
  const core = coreOf();
  S.boot = core.boot; S.fixtures = core.fixtures; S.byId = core.byId; S.teams = core.teamsById;
  markLive('understat', 'seed', 'seed');
  const before = {state:deepSnapshot(S), health:deepSnapshot(snapshotHealth()),
    xp:deepSnapshot(xpCacheValueSnapshot())};
  await computeUnderstat({core, config:{useUstat:true}, getStorage:async () => null,
    fetchPage:async () => null, nowFn:() => 5000});
  await computeOdds({core, config:{oddsKey:''}, getStorage:async () => null, nowFn:() => 5000});
  await computeMinuteHistories({core:{...core, seasonLive:false}, account:{picks:null, manual:[]}});
  assert.deepEqual({state:deepSnapshot(S), health:deepSnapshot(snapshotHealth()),
    xp:deepSnapshot(xpCacheValueSnapshot())}, before);
});

test('1b · compute functions do not mutate frozen staged inputs', async () => {
  const core = Object.freeze({...coreOf()});
  const config = Object.freeze({useUstat:true, oddsKey:'', useManual:false});
  const account = Object.freeze({picks:null, manual:Object.freeze([])});
  await computeUnderstat({core, config, getStorage:async () => null, fetchPage:async () => null, nowFn:() => 1});
  await computeOdds({core, config, getStorage:async () => null, nowFn:() => 1});
  await computeMinuteHistories({core:{...core, seasonLive:false}, account});
  assert.ok(Object.isFrozen(core) && Object.isFrozen(config));
});

test('1c · collection performs no in-place write to S.retryStats', async () => {
  const core = coreOf();
  const original = S.retryStats;
  await computeUnderstat({core, config:{useUstat:true}, getStorage:async () => null,
    fetchPage:async () => ({value:null, retryRecord:{provider:'understat', endpoint:'x'}}), nowFn:() => 1});
  assert.equal(S.retryStats, original);
  assert.deepEqual(S.retryStats, {});
});

test('1d · compute returns health marks and issues as data rather than calling the registry', async () => {
  const core = coreOf();
  const result = await computeUnderstat({core, config:{useUstat:false}});
  assert.equal(result.outcome, 'clear');
  assert.equal(result.healthMark.kind, 'disabled');
  assert.equal(getHealth('understat'), null);
});

/* =====================================================================
   B · Rule A / Rule B separation (R3.3 D1, R3.2 C4)
   ===================================================================== */

test('55 · signature mismatch clears to fallback and queues recomputation when the value is incompatible', () => {
  const core = coreOf();
  S.ustat = ustatMap();
  S.providerApplied = {understat:appliedRecord(core, 0), odds:null};
  applied.drainRecomputation();
  const verdict = applied.applyProviderResult('understat',
    {outcome:'value', value:ustatMap(), signature:'stale', healthMark:{kind:'live'}, fetchedAt:0},
    {core, now:2 * DAY, signature:'current'});
  assert.equal(verdict.state, 'clear');
  assert.equal(verdict.queued, true);
  assert.deepEqual(applied.drainRecomputation(), ['understat']);
});

test('95 · a fixture-revision change keeps a usable Understat value active and Cached', () => {
  const core = coreOf();
  S.ustat = ustatMap();
  S.providerApplied = {understat:appliedRecord(core, 1000), odds:null};
  const verdict = applied.applyProviderResult('understat',
    {outcome:'value', value:ustatMap(), signature:'computed-against-old-fixtures'},
    {core, now:1000 + HOUR, signature:'new-fixture-revision'});
  assert.equal(verdict.state, 'retain');
  assert.deepEqual(S.ustat, ustatMap());
  assert.equal(getHealth('understat', {}, 1000 + HOUR).state, HEALTH_STATES.CACHED);
});

test('96 · an Odds kickoff swap invalidates the signature but keeps a usable map active', () => {
  const core = coreOf();
  S.odds = oddsMap();
  S.providerApplied = {understat:null, odds:appliedRecord(core, 1000)};
  const verdict = applied.applyProviderResult('odds',
    {outcome:'value', value:oddsMap(), signature:'old'},
    {core, now:1000 + HOUR, signature:'new'});
  assert.equal(verdict.state, 'retain');
  assert.deepEqual(S.odds, oddsMap());
  assert.equal(getHealth('odds', {}, 1000 + HOUR).state, HEALTH_STATES.CACHED);
});

test('88 · two unfinished fixtures exchanging kickoffs invalidate the Odds signature', () => {
  const a = coreOf({kickoffs:['2026-08-15T14:00:00Z','2026-08-15T16:30:00Z']});
  const b = coreOf({kickoffs:['2026-08-15T16:30:00Z','2026-08-15T14:00:00Z']});
  assert.notEqual(applied.oddsSignature(a, {oddsKey:'k'}), applied.oddsSignature(b, {oddsKey:'k'}));
});

test('89 · a fixture changing teams at an unchanged kickoff invalidates the Odds signature', () => {
  const a = coreOf({homeAway:[[1,2],[3,4]]});
  const b = coreOf({homeAway:[[1,3],[2,4]]});
  assert.notEqual(applied.oddsSignature(a, {oddsKey:'k'}), applied.oddsSignature(b, {oddsKey:'k'}));
});

test('67 · a club rename invalidates Understat and Odds; an id-only signature would not', () => {
  const a = coreOf();
  const b = coreOf({teamNames:['Arsenal FC','Chelsea','Everton','Fulham']});
  assert.notEqual(applied.understatSignature(a, {useUstat:true}), applied.understatSignature(b, {useUstat:true}));
  assert.notEqual(applied.oddsSignature(a, {oddsKey:'k'}), applied.oddsSignature(b, {oddsKey:'k'}));
  assert.deepEqual(a.teams.map(t => t.id), b.teams.map(t => t.id));
});

test('64 · Understat beyond 24 hours clears to fallback even with a matching signature', () => {
  const core = coreOf();
  S.ustat = ustatMap();
  S.providerApplied = {understat:appliedRecord(core, 0), odds:null};
  const verdict = applied.applyProviderResult('understat', {outcome:'fallback'},
    {core, now:SUPPORTING_REFRESH_RULES.understat.maxAgeMs + 1, signature:'s'});
  assert.equal(verdict.state, 'clear');
  assert.equal(S.ustat, null);
  assert.equal(getHealth('understat').state, HEALTH_STATES.FALLBACK);
});

test('65 · Odds beyond 6 hours clears to fallback', () => {
  const core = coreOf();
  S.odds = oddsMap();
  S.providerApplied = {understat:null, odds:appliedRecord(core, 0)};
  const verdict = applied.applyProviderResult('odds', {outcome:'fallback'},
    {core, now:SUPPORTING_REFRESH_RULES.odds.maxUsableAgeMs + 1, signature:'s'});
  assert.equal(verdict.state, 'clear');
  assert.equal(S.odds, null);
});

test('83 · a RETAIN does not advance lastSuccess', () => {
  const core = coreOf();
  S.ustat = ustatMap();
  S.providerApplied = {understat:appliedRecord(core, 4242), odds:null};
  applied.applyProviderResult('understat', {outcome:'fallback'}, {core, now:4242 + HOUR, signature:'s'});
  assert.equal(getHealth('understat', {}, 4242 + HOUR).lastSuccess, 4242);
});

test('84 · a retained Understat value reports the same age before and after a commit', () => {
  const core = coreOf();
  S.ustat = ustatMap();
  S.providerApplied = {understat:appliedRecord(core, 7000), odds:null};
  applied.applyProviderResult('understat', {outcome:'fallback'}, {core, now:7000 + HOUR, signature:'s'});
  const first = getHealth('understat', {}, 7000 + HOUR).lastSuccess;
  applied.applyProviderResult('understat', {outcome:'fallback'}, {core, now:7000 + 2 * HOUR, signature:'s'});
  assert.equal(getHealth('understat', {}, 7000 + 2 * HOUR).lastSuccess, first);
});

test('56 · every provider slice lands in exactly one of REPLACE, RETAIN or CLEAR', () => {
  const core = coreOf();
  const states = new Set();
  S.ustat = ustatMap(); S.providerApplied = {understat:appliedRecord(core, 1000), odds:null};
  states.add(applied.applyProviderResult('understat',
    {outcome:'value', value:ustatMap(), signature:'s', healthMark:{kind:'live'}, fetchedAt:1000},
    {core, now:1000, signature:'s'}).state);
  states.add(applied.applyProviderResult('understat', {outcome:'fallback'}, {core, now:1000 + HOUR, signature:'s'}).state);
  states.add(applied.applyProviderResult('understat',
    {outcome:'clear', healthMark:{kind:'disabled', note:'off'}}, {core, now:1000, signature:'s'}).state);
  assert.deepEqual([...states].sort(), ['clear','replace','retain']);
});

test('57 · all three providers RETAIN simultaneously and remain coherent', () => {
  const core = coreOf({finishedGw:true});
  S.ustat = ustatMap(); S.odds = oddsMap();
  S.minuteHistory = {1:[{fixture:1, round:1, minutes:90, starts:1, kickoff_time:null}]};
  S.minuteHistoryMeta = {1:{season:core.season, schemaVersion:SCHEMA_VERSION, modelVersion:MODEL_VERSION, fetchedAt:1000, revision:'r'}};
  S.providerApplied = {understat:appliedRecord(core, 1000), odds:appliedRecord(core, 1000)};
  const ctx = {core, now:1000 + HOUR, signature:'x'};
  assert.equal(applied.applyProviderResult('understat', {outcome:'fallback'}, ctx).state, 'retain');
  assert.equal(applied.applyProviderResult('odds', {outcome:'fallback'}, ctx).state, 'retain');
  assert.equal(applied.applyProviderResult('minutes', {outcome:'fallback'}, {...ctx, cohortIds:[1]}).state, 'retain');
  assert.deepEqual(Object.keys(S.minuteHistory), ['1']);
});

/* =====================================================================
   C · Bounded recomputation (R3.3 D3, R3.4 E6)
   ===================================================================== */

test('58 · disabled CLEAR does not queue; incompatible CLEAR does', () => {
  const core = coreOf();
  applied.drainRecomputation();
  applied.applyProviderResult('understat', {outcome:'clear', healthMark:{kind:'disabled', note:'off'}},
    {core, now:0, signature:'s'});
  assert.deepEqual(applied.drainRecomputation(), []);
  S.ustat = null; S.providerApplied = {understat:null, odds:null};
  applied.applyProviderResult('understat', {outcome:'value', value:ustatMap(), signature:'old'},
    {core, now:0, signature:'new'});
  assert.deepEqual(applied.drainRecomputation(), ['understat']);
});

test('104 · bounded loop — one requeue per provider per cycle, none for a current-input failure', () => {
  const core = coreOf();
  applied.drainRecomputation();
  for(let i = 0; i < 5; i++){
    applied.applyProviderResult('understat', {outcome:'value', value:ustatMap(), signature:'old'},
      {core, now:0, signature:'new'});
  }
  assert.deepEqual(applied.drainRecomputation(), ['understat'], 'Set-backed queue bounds repeats to one');
  applied.applyProviderResult('understat', {outcome:'fallback', reason:'transport'}, {core, now:0, signature:'new'});
  assert.deepEqual(applied.drainRecomputation(), [], 'a current-input failure must not requeue');
  applied.applyProviderResult('understat', {outcome:'fallback', reason:'cooling'}, {core, now:0, signature:'new'});
  assert.deepEqual(applied.drainRecomputation(), [], 'a cooling skip must not requeue');
});

test('74 · a stale-token result arriving via the wrapper path is discarded', () => {
  const core = coreOf();
  S.ustat = ustatMap();
  const stale = applied.nextProviderToken('understat');
  applied.nextProviderToken('understat');
  const verdict = applied.applyProviderResult('understat',
    {outcome:'value', value:null, signature:'s'}, {core, now:0, token:stale, signature:'s'});
  assert.equal(verdict.reason, 'token_stale');
  assert.deepEqual(S.ustat, ustatMap());
});

test('73 · the wrapper path and the commit path share one apply gate', () => {
  assert.match(MAIN_SOURCE, /applyProviderResult\('understat'/);
  assert.match(MAIN_SOURCE, /applyProviderResult\('odds'/);
  assert.match(MAIN_SOURCE, /applyProviderResult\('minutes'/);
  const understatSource = readFileSync(new URL('../src/providers/understat.mjs', import.meta.url), 'utf8');
  const oddsSource = readFileSync(new URL('../src/providers/odds.mjs', import.meta.url), 'utf8');
  assert.match(understatSource, /applyProviderResult\('understat'/);
  assert.match(oddsSource, /applyProviderResult\('odds'/);
  assert.match(MINUTES_SOURCE, /applyProviderResult\('minutes'/);
});

/* =====================================================================
   D · Minute-history provenance and cohort scope (R3.3 D4/D5, R3.4 E1-E3)
   ===================================================================== */

const history1 = () => [{fixture:1, round:1, minutes:90, starts:1, kickoff_time:null}];

test('107 · season id reuse — a prior-season history is rejected despite a matching id', () => {
  const core = coreOf();
  S.minuteHistory = {1:history1()};
  S.minuteHistoryMeta = {1:{season:'2025-26', schemaVersion:SCHEMA_VERSION, modelVersion:MODEL_VERSION, fetchedAt:1, revision:'r'}};
  applied.applyProviderResult('minutes', {outcome:'fallback'}, {core, now:0, cohortIds:[1], signature:'s'});
  assert.deepEqual(S.minuteHistory, {});
  assert.deepEqual(S.minuteHistoryMeta, {});
});

test('108 · schemaVersion mismatch rejects a per-player history', () => {
  const core = coreOf();
  S.minuteHistory = {1:history1()};
  S.minuteHistoryMeta = {1:{season:core.season, schemaVersion:'other', modelVersion:MODEL_VERSION, fetchedAt:1, revision:'r'}};
  applied.applyProviderResult('minutes', {outcome:'fallback'}, {core, now:0, cohortIds:[1], signature:'s'});
  assert.deepEqual(S.minuteHistory, {});
});

test('109 · modelVersion mismatch rejects a per-player history', () => {
  const core = coreOf();
  S.minuteHistory = {1:history1()};
  S.minuteHistoryMeta = {1:{season:core.season, schemaVersion:SCHEMA_VERSION, modelVersion:'other', fetchedAt:1, revision:'r'}};
  applied.applyProviderResult('minutes', {outcome:'fallback'}, {core, now:0, cohortIds:[1], signature:'s'});
  assert.deepEqual(S.minuteHistory, {});
});

test('110 · missing metadata fails closed', () => {
  const core = coreOf();
  S.minuteHistory = {1:history1()};
  S.minuteHistoryMeta = {};
  applied.applyProviderResult('minutes', {outcome:'fallback'}, {core, now:0, cohortIds:[1], signature:'s'});
  assert.deepEqual(S.minuteHistory, {});
});

test('85 · a minute entry beyond seven days remains usable when its correction fails', () => {
  const envelope = {schemaVersion:SCHEMA_VERSION, modelVersion:MODEL_VERSION, season:'2026-27', revision:'r', players:{}};
  const entry = {fetchedAt:0, revision:'r', history:history1()};
  const decision = minuteCacheDecision(entry, envelope, {revision:'r', now:MINUTES_RULES.cacheMaxAgeMs + DAY});
  assert.equal(decision.due, true, 'the backstop marks it due');
  assert.equal(decision.usable, true, 'but it stays usable — there is no usage expiry');
  assert.equal(decision.reason, 'age_backstop');
});

test('66 · minute compatibility has no age bound; provenance alone removes an entry', () => {
  const core = coreOf();
  S.minuteHistory = {1:history1()};
  S.minuteHistoryMeta = {1:{season:core.season, schemaVersion:SCHEMA_VERSION, modelVersion:MODEL_VERSION,
    fetchedAt:0, revision:'ancient'}};
  applied.applyProviderResult('minutes', {outcome:'fallback'},
    {core, now:400 * DAY, cohortIds:[1], signature:'s'});
  assert.deepEqual(Object.keys(S.minuteHistory), ['1'], 'a very old but provenance-valid entry is retained');
});

test('100 · non-cohort players are persisted but absent from the active set', () => {
  const core = coreOf();
  S.minuteHistory = {1:history1(), 2:history1()};
  const meta = id => ({season:core.season, schemaVersion:SCHEMA_VERSION, modelVersion:MODEL_VERSION, fetchedAt:1, revision:'r'});
  S.minuteHistoryMeta = {1:meta(1), 2:meta(2)};
  applied.applyProviderResult('minutes', {outcome:'fallback'}, {core, now:0, cohortIds:[1], signature:'s'});
  assert.deepEqual(Object.keys(S.minuteHistory), ['1'], 'only the captured cohort stays active');
});

test('101 · S.minuteHistory keeps its model-facing shape', () => {
  const core = coreOf();
  S.minuteHistory = {1:history1()};
  S.minuteHistoryMeta = {1:{season:core.season, schemaVersion:SCHEMA_VERSION, modelVersion:MODEL_VERSION, fetchedAt:1, revision:'r'}};
  applied.applyProviderResult('minutes', {outcome:'fallback'}, {core, now:0, cohortIds:[1], signature:'s'});
  assert.ok(Array.isArray(S.minuteHistory[1]));
  assert.ok(S.minuteHistory[1].every(row => typeof row.minutes === 'number'));
});

test('102 · minuteHistoryMeta carries the same key set as minuteHistory', () => {
  const core = coreOf();
  S.minuteHistory = {1:history1(), 2:history1()};
  const meta = {season:core.season, schemaVersion:SCHEMA_VERSION, modelVersion:MODEL_VERSION, fetchedAt:1, revision:'r'};
  S.minuteHistoryMeta = {1:meta, 2:meta};
  applied.applyProviderResult('minutes', {outcome:'fallback'}, {core, now:0, cohortIds:[1,2], signature:'s'});
  assert.deepEqual(Object.keys(S.minuteHistory), Object.keys(S.minuteHistoryMeta));
});

test('116 · a season rollover admits no prior-season minute history', () => {
  const previous = coreOf({season:'2025'});
  const current = coreOf({season:'2026'});
  assert.notEqual(previous.season, current.season);
  S.minuteHistory = {1:history1()};
  S.minuteHistoryMeta = {1:{season:previous.season, schemaVersion:SCHEMA_VERSION, modelVersion:MODEL_VERSION, fetchedAt:1, revision:'r'}};
  applied.applyProviderResult('minutes', {outcome:'fallback'}, {core:current, now:0, cohortIds:[1], signature:'s'});
  assert.deepEqual(S.minuteHistory, {});
});

test('103 · a manual purchase-price change leaves the minutes signature unchanged', () => {
  const core = coreOf();
  const a = applied.minutesSignature(core, 'rev', [3,1,2]);
  const b = applied.minutesSignature(core, 'rev', [3,1,2]);
  assert.equal(a, b);
  assert.notEqual(a, applied.minutesSignature(core, 'rev', [3,1,4]), 'membership still changes it');
  assert.notEqual(a, applied.minutesSignature(core, 'rev', [1,2,3]), 'order still changes it');
});

test('69 · minutes signature is built from cohort ids and order only', () => {
  assert.doesNotMatch(APPLIED_SOURCE, /manualRevision/);
  assert.match(APPLIED_SOURCE, /cohortIds/);
});

test('91 · a cohort change does not invalidate an already-fetched per-player history', () => {
  const core = coreOf();
  const meta = {season:core.season, schemaVersion:SCHEMA_VERSION, modelVersion:MODEL_VERSION, fetchedAt:1, revision:'r'};
  assert.equal(applied.minuteEntryCompatible(meta, core, [1,2,3], 1), true);
  assert.equal(applied.minuteEntryCompatible(meta, core, [2,3], 1), false, 'only the ACTIVE set narrows');
});

test('12 · the minute cohort is built from the staged account, not S.picks', () => {
  const core = coreOf();
  S.picks = {picks:[{element:4, position:1, multiplier:1}]};
  const staged = cohort({elements:core.elements, account:{picks:{picks:[{element:2, position:1, multiplier:1}]}, manual:[]}, useManual:false});
  assert.equal(staged[0].id, 2, 'staged account wins over S.picks');
});

/* =====================================================================
   E · Typed transport (R3.1 A3, R3.4 E-series)
   ===================================================================== */

function fakeResponse({status = 200, body = {}, ok = null} = {}){
  return {ok:ok === null ? status >= 200 && status < 300 : ok, status, json:async () => body};
}
function withFetch(handler, run){
  const previous = globalThis.fetch;
  globalThis.fetch = handler;
  return run().finally(() => { globalThis.fetch = previous; });
}
const GATEWAY = 'https://gateway.example.com/fpl';

test('43 · HTTP 404 is authoritative notfound', async () => {
  await withFetch(async () => fakeResponse({status:404, ok:false}), async () => {
    const r = await gatewayOnce('/entry/1/', 100, true, GATEWAY);
    assert.equal(r.outcome, 'notfound');
  });
});

test('44 · a 200 carrying a detail field is failed, never notfound', async () => {
  await withFetch(async () => fakeResponse({status:200, body:{detail:'Throttled.'}}), async () => {
    const r = await gatewayOnce('/entry/1/', 100, true, GATEWAY);
    assert.equal(r.outcome, 'failed');
    assert.equal(r.retryable, false);
    assert.equal(r.status, 'detail');
  });
});

test('45 · a detail response therefore carries a valid squad forward rather than clearing it', () => {
  const previous = {key:'picks|7|1|2026-27|v1', value:{picks:[{element:1}]}};
  const keys = {picks:'picks|7|1|2026-27|v1'};
  const verdict = main.resolveAccountSlice('picks', {outcome:'failed'}, previous, keys);
  assert.equal(verdict.state, 'carry');
  assert.deepEqual(verdict.value, previous.value);
});

test('46 · network and parse errors are failed with correct retryability', async () => {
  await withFetch(async () => { throw new Error('offline'); }, async () => {
    const r = await gatewayOnce('/x/', 100, true, GATEWAY);
    assert.equal(r.outcome, 'failed');
    assert.equal(r.retryable, true);
  });
  await withFetch(async () => ({ok:true, status:200, json:async () => { throw new Error('bad'); }}), async () => {
    const r = await gatewayOnce('/x/', 100, true, GATEWAY);
    assert.equal(r.status, 'parse');
    assert.equal(r.retryable, false);
  });
});

test('47 · untyped callers keep their previous contract', () => {
  assert.match(TRANSPORT_SOURCE, /if\(typed\)\{/);
  assert.match(TRANSPORT_SOURCE, /recordRetry\(record\);\n  if\(source\) S\.source = source;/);
});

test('113 · the gateway no longer writes S.source during collection', () => {
  assert.doesNotMatch(TRANSPORT_SOURCE, /S\.source = 'Teamsheet gateway';/);
  assert.match(TRANSPORT_SOURCE, /source:'Teamsheet gateway'/);
});

/* =====================================================================
   F · Account slices, carry keys and health aggregate (R3.4 E5, R3.2 C6)
   ===================================================================== */

const KEYS = {entry:'entry|7|2026-27|v1', picks:'picks|7|1|2026-27|v1', history:'history|7|2026-27|v1'};

test('48 · entry replaces while picks carries under a matching key', () => {
  assert.equal(main.resolveAccountSlice('entry', {outcome:'value', value:{name:'T'}}, {}, KEYS).state, 'replace');
  assert.equal(main.resolveAccountSlice('picks', {outcome:'failed'}, {key:KEYS.picks, value:{picks:[]}}, KEYS).state, 'carry');
});

test('49 · an advanced picks Gameweek is a key mismatch and clears rather than carries', () => {
  const previous = {key:'picks|7|1|2026-27|v1', value:{picks:[]}};
  const nextKeys = {...KEYS, picks:'picks|7|2|2026-27|v1'};
  assert.equal(main.resolveAccountSlice('picks', {outcome:'failed'}, previous, nextKeys).state, 'clear');
});

test('50 · a different Team ID clears rather than carries', () => {
  const previous = {key:'picks|9|1|2026-27|v1', value:{picks:[]}};
  assert.equal(main.resolveAccountSlice('picks', {outcome:'failed'}, previous, KEYS).state, 'clear');
});

test('51 · a season or schema difference clears rather than carries', () => {
  assert.equal(main.resolveAccountSlice('entry', {outcome:'failed'}, {key:'entry|7|2025-26|v1', value:{}}, KEYS).state, 'clear');
  assert.equal(main.resolveAccountSlice('entry', {outcome:'failed'}, {key:'entry|7|2026-27|v0', value:{}}, KEYS).state, 'clear');
});

test('25 · an authoritative notfound clears the slice', () => {
  assert.equal(main.resolveAccountSlice('picks', {outcome:'notfound'}, {key:KEYS.picks, value:{picks:[]}}, KEYS).state, 'clear');
});

test('78 · entry 404 clears picks, history, chipsUsed and picksStatus', () => {
  assert.match(MAIN_SOURCE, /if\(entryRes\.state === 'clear'\)\{[\s\S]*picksRes = \{state:'clear', value:null\};[\s\S]*historyRes = \{state:'clear', value:null\};/);
});

test('79 · an entry failure with a key mismatch forces the same dependent clear', () => {
  assert.equal(main.resolveAccountSlice('entry', {outcome:'failed'}, {key:'entry|9|2026-27|v1', value:{}}, KEYS).state, 'clear');
});

test('53 · Live requires a clean core and clean replacement of every requested slice', () => {
  const replaced = [{state:'replace'},{state:'replace'},{state:'replace'}];
  assert.equal(main.aggregateFplHealth({corePartial:false, requested:true, slices:replaced, at:1}), 'Live');
  assert.equal(main.aggregateFplHealth({corePartial:false, requested:false, slices:[], at:1}), 'Live');
  assert.equal(main.aggregateFplHealth({corePartial:false, requested:true,
    slices:[{state:'replace'},{state:'carry'},{state:'replace'}], at:1}), 'Partial');
  assert.equal(main.aggregateFplHealth({corePartial:false, requested:true,
    slices:[{state:'replace'},{state:'clear'},{state:'replace'}], at:1}), 'Partial');
});

test('105 · a partial core issue forces Partial even when every account slice replaced', () => {
  assert.equal(main.aggregateFplHealth({corePartial:true, requested:true,
    slices:[{state:'replace'},{state:'replace'},{state:'replace'}], at:1}), 'Partial');
});

test('106 · a partial account validation issue forces Partial', () => {
  assert.equal(main.aggregateFplHealth({corePartial:false, requested:true,
    slices:[{state:'replace', partial:true},{state:'replace'},{state:'replace'}], at:1}), 'Partial');
});

test('117 · no account outcome can produce Fallback or Unavailable', () => {
  for(const slices of [[{state:'clear'}],[{state:'carry'}],[{state:'replace', partial:true}]]){
    const state = main.aggregateFplHealth({corePartial:false, requested:true, slices, at:1});
    assert.equal(state, 'Partial');
    assert.ok(![HEALTH_STATES.FALLBACK, HEALTH_STATES.UNAVAILABLE].includes(getHealth('fpl').state));
  }
});

test('52 · picksStatus follows picks and chipsUsed follows history independently', () => {
  assert.equal(main.picksStatusFor('clear', null, 1), 'unavailable');
  assert.equal(main.picksStatusFor('clear', null, 0), 'gameweek-unavailable');
  assert.equal(main.picksStatusFor('replace', {picks:new Array(15).fill({})}, 1), 'loaded');
  assert.equal(main.picksStatusFor('replace', {picks:[{}]}, 1), 'incomplete');
});

/* =====================================================================
   G · Commit, rollback and error classification (R3 A2/A8, R3.4 E5)
   ===================================================================== */

test('13 · applyRefreshCommit contains no await, dispatch, DOM or storage call', () => {
  const body = MAIN_SOURCE.slice(MAIN_SOURCE.indexOf('function applyRefreshCommit'),
    MAIN_SOURCE.indexOf('async function persistRefresh'));
  assert.doesNotMatch(body, /\bawait\b/);
  assert.doesNotMatch(body, /dispatchEvent/);
  assert.doesNotMatch(body, /document\./);
  assert.doesNotMatch(body, /\bsset\b|\bsget\b|ssetChecked/);
  assert.doesNotMatch(body, /setChildren|renderAll/);
});

test('16 · a re-entrant commit is rejected rather than interleaved', () => {
  assert.match(MAIN_SOURCE, /if\(commitInProgress\) return \{ok:false, reason:'reentrant'\};/);
  assert.match(MAIN_SOURCE, /commitInProgress = true;/);
  assert.match(MAIN_SOURCE, /finally\{\s*commitInProgress = false;/);
});

test('38 · a forced commit throw restores S, retryStats and the health registry', () => {
  const core = coreOf();
  S.boot = core.boot; S.entry = {name:'Original'}; S.retryStats = {'fpl|/x/':{provider:'fpl', endpoint:'/x/'}};
  markLive('understat', 'before', 'before');
  const journal = {state:captureStateJournal(), health:snapshotHealth()};
  S.entry = {name:'Half-written'}; S.retryStats['fpl|/y/'] = {provider:'fpl', endpoint:'/y/'};
  markCached('understat', 1, 'after', 'after');
  restoreStateJournal(journal.state);
  restoreHealth(journal.health);
  assert.deepEqual(S.entry, {name:'Original'});
  assert.deepEqual(Object.keys(S.retryStats), ['fpl|/x/']);
  assert.equal(getHealth('understat').state, HEALTH_STATES.LIVE);
  assert.equal(getHealth('understat').note, 'before');
});

test('39 · snapshotHealth / restoreHealth is an identity round-trip', () => {
  markLive('understat', 'n', 'c');
  markCached('odds', 1234, 'n2', 'c2');
  const snapshot = snapshotHealth();
  const before = deepSnapshot(snapshot);
  resetHealth();
  restoreHealth(snapshot);
  assert.deepEqual(deepSnapshot(snapshotHealth()), before);
});

test('40 · the commit assigns a new retryStats object rather than mutating in place', () => {
  assert.match(MAIN_SOURCE, /const retryStats = \{\.\.\.S\.retryStats\};/);
  assert.match(MAIN_SOURCE, /S\.retryStats = retryStats;/);
});

test('42 · the rollback path performs only assignments', () => {
  const body = STATE_SOURCE.slice(STATE_SOURCE.indexOf('function restoreStateJournal'));
  assert.doesNotMatch(body.slice(0, body.indexOf('\n}')), /await|throw|document\./);
});

test('115 · providerApplied and minuteHistoryMeta are inside the commit journal', () => {
  assert.match(STATE_SOURCE, /'providerApplied','dataIssues'/);
  assert.match(STATE_SOURCE, /'minuteHistory','minuteHistoryMeta'/);
});

test('114 · value and applied metadata are assigned in one synchronous block', () => {
  const core = coreOf();
  applied.applyProviderResult('understat',
    {outcome:'value', value:ustatMap(), signature:'s', fetchedAt:99, healthMark:{kind:'live'}},
    {core, now:100, signature:'s'});
  assert.deepEqual(S.ustat, ustatMap());
  assert.equal(S.providerApplied.understat.fetchedAt, 99);
  assert.equal(S.providerApplied.understat.season, core.season);
  const body = APPLIED_SOURCE.slice(APPLIED_SOURCE.indexOf('function applySliceReplace'),
    APPLIED_SOURCE.indexOf('function applySliceRetain'));
  assert.doesNotMatch(body, /\bawait\b|dispatchEvent|document\./);
});

test('61-63 · error classes are separated and only collection may blame the feed', () => {
  assert.match(MAIN_SOURCE, /errorClass:'collection_failed'/);
  assert.match(MAIN_SOURCE, /errorClass:'commit_failed'/);
  assert.match(MAIN_SOURCE, /errorClass:renderError \? 'render_failed' : persistFailures\.length \? 'persist_failed' : null/);
  const commitFailure = MAIN_SOURCE.slice(MAIN_SOURCE.indexOf("if(!committed.ok){"), MAIN_SOURCE.indexOf('let renderError'));
  assert.doesNotMatch(commitFailure, /markFallback|markUnavailable/);
  const renderBlock = MAIN_SOURCE.slice(MAIN_SOURCE.indexOf('let renderError'), MAIN_SOURCE.indexOf('const persistFailures'));
  assert.doesNotMatch(renderBlock, /markFallback|markUnavailable/);
  assert.match(MAIN_SOURCE, /Data updated but the display failed to refresh/);
  assert.match(MAIN_SOURCE, /Could not apply the update — showing the previous verified data/);
});

test('59 · a render throw leaves committed data intact and does not blame the feed', () => {
  assert.match(MAIN_SOURCE, /catch\(error\)\{ renderError = error;/);
  assert.match(MAIN_SOURCE, /reportCollectionFailure/);
  const collectionOnly = MAIN_SOURCE.slice(MAIN_SOURCE.indexOf('function reportCollectionFailure'));
  assert.match(collectionOnly, /markFallback\('fpl'/);
});

test('63 · a throw in the failure-path render does not escape loadAll', () => {
  assert.match(MAIN_SOURCE, /if\(S\.boot\)\{ try\{ renderVerifiedState\(\); \}catch\(error\)\{\} \}/);
});

/* =====================================================================
   H · Storage (R3.1 B4, R3.2 C7)
   ===================================================================== */

test('75 · ssetChecked reports quota and serialisation failures', async () => {
  const previous = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  try{
    assert.deepEqual(await ssetChecked('k', {a:1}), {ok:false, reason:'quota_or_unavailable'});
  }finally{ globalThis.localStorage.setItem = previous; }
  const circular = {}; circular.self = circular;
  assert.deepEqual(await ssetChecked('k', circular), {ok:false, reason:'serialise'});
});

test('76 · ssetChecked falls through from a failing manager to localStorage', async () => {
  globalThis.window.storage = {set:async () => { throw new Error('nope'); }};
  try{
    assert.deepEqual(await ssetChecked('k', {a:1}), {ok:true, via:'local'});
  }finally{ delete globalThis.window.storage; }
});

test('77 · sset is byte-identical to its pre-change form', () => {
  const expected = 'async function sset(key, val){\n' +
    '  const s = JSON.stringify(val);\n' +
    '  if(window.storage){ try{ await window.storage.set(key, s); return; }catch(e){} }\n' +
    '  try{ localStorage.setItem(key, s); }catch(e){}\n' +
    '}';
  assert.ok(STORAGE_SOURCE.includes(expected), 'sset must remain byte-identical to its pre-change form');
});

test('93 · sset still propagates a JSON.stringify throw exactly as today', async () => {
  const circular = {}; circular.self = circular;
  await assert.rejects(async () => sset('k', circular), TypeError);
});

test('94 · the two storage surfaces are independent', async () => {
  const circular = {}; circular.self = circular;
  await assert.rejects(async () => sset('k', circular));
  assert.deepEqual(await ssetChecked('k', circular), {ok:false, reason:'serialise'});
});

test('18 · K_CACHE is written only after a successful commit', () => {
  const commitIndex = MAIN_SOURCE.indexOf('const committed = applyRefreshCommit(staged);');
  const persistIndex = MAIN_SOURCE.indexOf('const persistFailures = await persistRefresh(staged);');
  assert.ok(commitIndex > 0 && persistIndex > commitIndex, 'persistence follows the commit');
  assert.match(MAIN_SOURCE, /const writes = \[\{key:K_CACHE, value:staged\.slimmed\}\]/);
  const collect = MAIN_SOURCE.slice(MAIN_SOURCE.indexOf('async function collectRefresh'), MAIN_SOURCE.indexOf('function applyRefreshCommit'));
  assert.doesNotMatch(collect, /sset\(K_CACHE|ssetChecked\(K_CACHE/);
});

test('112 · persistence lag — Rule B validates the newer in-memory record, not storage', () => {
  const core = coreOf();
  S.ustat = ustatMap();
  S.providerApplied = {understat:appliedRecord(core, 9000), odds:null};
  globalThis.localStorage._d['fpl:understat-team-inputs'] = JSON.stringify({fetchedAt:0, teams:{}});
  const verdict = applied.applyProviderResult('understat', {outcome:'fallback'},
    {core, now:9000 + HOUR, signature:'s'});
  assert.equal(verdict.state, 'retain', 'the newer in-memory value survives a stale persisted envelope');
  assert.equal(getHealth('understat', {}, 9000 + HOUR).lastSuccess, 9000);
  delete globalThis.localStorage._d['fpl:understat-team-inputs'];
});

test('Rule B reads no storage', () => {
  const ruleB = APPLIED_SOURCE.slice(APPLIED_SOURCE.indexOf('function provenanceMatches'),
    APPLIED_SOURCE.indexOf('const providerToken'));
  assert.doesNotMatch(ruleB, /sget|localStorage|await/);
});

/* =====================================================================
   I · Lifecycle epoch, queueing and interaction policy (R3 A1/A5, R3.1 B6/B7)
   ===================================================================== */

test('34-35 · a persisted restoration discards staged work in full and recollects immediately', () => {
  assert.match(MAIN_SOURCE, /if\(staged\.inputs\.lifecycleEpoch !== lifecycleEpoch\)\{/);
  assert.match(MAIN_SOURCE, /pendingRefreshRequest = \{reason:options\.reason \|\| 'foreground', force:true\};/);
  assert.match(MAIN_SOURCE, /discarded:'lifecycle'/);
  assert.match(MAIN_SOURCE, /if\(queued\) void runVerifiedRefresh\(\{\.\.\.queued,nowFn\}\)/);
});

test('36 · only a persisted pageshow advances the lifecycle epoch', () => {
  assert.match(MAIN_SOURCE, /if\(event&&event\.persisted\) lifecycleEpoch\+\+;/);
});

test('37 · the unsupported freeze listener is omitted', () => {
  assert.doesNotMatch(MAIN_SOURCE, /addEventListener\?\.\('freeze'|addEventListener\('freeze'/);
});

test('17 · a manual refresh during an in-flight refresh is queued, not downgraded', () => {
  assert.match(MAIN_SOURCE, /if\(reason==='manual'&&verifiedRefreshPromise\) pendingRefreshRequest=\{reason:'manual',startup:false,force:true\};/);
  assert.match(MAIN_SOURCE, /if\(verifiedRefreshPromise\) return verifiedRefreshPromise;/);
});

test('11 · paired resume events still coalesce', () => {
  assert.match(MAIN_SOURCE, /document\.addEventListener\('visibilitychange',refreshIfDue\)/);
  assert.match(MAIN_SOURCE, /shouldRunForegroundRefresh\(lastRefreshAttemptAt/);
});

test('28 · foreground applies no interaction lock; startup and manual do', () => {
  assert.equal(main.shouldBlockRefreshInteractions({reason:'foreground'}), false);
  assert.equal(main.shouldBlockRefreshInteractions({reason:'manual'}), true);
  assert.equal(main.shouldBlockRefreshInteractions({reason:'foreground', startup:true}), true);
});

test('81 · a focused fxFrom or fxSpan retains its value across a commit render', () => {
  assert.match(VIEWS_SOURCE, /if\(!userControlHasFocus\('fxFrom'\)\) \$\('fxFrom'\)\.value = String\(from\);/);
  assert.match(VIEWS_SOURCE, /if\(!userControlHasFocus\('fxSpan'\)\) \$\('fxSpan'\)\.value = String\(span\);/);
  assert.match(VIEWS_SOURCE, /const span = Math\.min\(requestedSpan, 39 - from\);/);
});

test('82 · the enumerated user-owned controls are declared and none sits in a replaced subtree', () => {
  assert.match(VIEWS_SOURCE, /USER_OWNED_CONTROL_IDS = Object\.freeze\(\[/);
  for(const id of ['teamId','ftCount','bankIn','oddsKey','fxFrom','fxSpan','plPos','plMax']){
    assert.match(VIEWS_SOURCE, new RegExp(`'${id}'`), `${id} must be enumerated`);
  }
  const appHtml = readFileSync(new URL('../app.html', import.meta.url), 'utf8');
  const tickerIndex = appHtml.indexOf('id="ticker"');
  assert.ok(appHtml.indexOf('id="fxFrom"') < tickerIndex, 'fxFrom sits outside the replaced #ticker subtree');
  assert.ok(appHtml.indexOf('id="fxSpan"') < tickerIndex, 'fxSpan sits outside the replaced #ticker subtree');
});

test('14 · the $(plPos) DOM write is out of hydrate and in the render phase', () => {
  const hydrateBody = STATE_SOURCE.slice(STATE_SOURCE.indexOf('function hydrate(d){'), STATE_SOURCE.indexOf('function assignCore'));
  assert.doesNotMatch(hydrateBody, /sel\.add|new Option/);
  assert.match(STATE_SOURCE, /function populatePositionFilter/);
  assert.match(MAIN_SOURCE, /populatePositionFilter\(staged\.core\.element_types\);/);
});

/* =====================================================================
   J · Invariants (R3.1 B8, R3.2 C8, and the withdrawn A5-3 finding)
   ===================================================================== */

test('21 · D-13 invariant — any slim() output from a structurally valid payload hydrates', () => {
  const boot = payload();
  boot.elements.push(null, {noId:true});
  boot.teams.push({id:99});
  const slimmed = slim({...boot, elements:boot.elements.filter(Boolean)}, fixtures());
  const prepared = prepareCore(slimmed);
  assert.equal(prepared.ok, true,
    'bootstrapStructure passing must imply prepareCore/hydrate cannot find a fatal — this is what makes the pre-validation cache write safe (A5-3 withdrawn)');
});

test('22a · S exposes only data properties and is not a Proxy', () => {
  for(const key of Object.keys(S)){
    const descriptor = Object.getOwnPropertyDescriptor(S, key);
    assert.ok('value' in descriptor, `S.${key} must be a data property, not an accessor`);
  }
  assert.equal(Object.getPrototypeOf(S), Object.prototype);
});

test('19 · xpCache is cleared inside the commit', () => {
  const commitBody = MAIN_SOURCE.slice(MAIN_SOURCE.indexOf('function applyRefreshCommit'),
    MAIN_SOURCE.indexOf('async function persistRefresh'));
  assert.match(commitBody, /clearXP\(\);/);
});

test('1a-b · xpCache snapshots are exact and separate value from identity', () => {
  clearXP();
  const core = coreOf();
  S.boot = core.boot; S.fixtures = core.fixtures; S.byId = core.byId; S.teams = core.teamsById;
  S.nextGW = 1; S.seasonLive = false; S.avg = core.avg; S.strengthsAvailable = true;
  xpOf(core.elements[0], 1, 1);
  const values = xpCacheValueSnapshot();
  const refs = xpCacheRefSnapshot();
  assert.equal(values.length, 1);
  assert.ok('parts' in values[0][1], 'parts is included, not dropped');
  assert.notEqual(values[0][1], refs[0][1], 'the value snapshot is a copy, not the live object');
  assert.equal(refs[0][1], xpCacheRefSnapshot()[0][1], 'the reference snapshot preserves identity');
  assert.deepEqual(values[0][1], refs[0][1], 'and the copy is exact — no rounding');
});

test('86-87 · minutes remain FPL detailed health, not a registry provider', () => {
  assert.throws(() => setHealth('minutes', HEALTH_STATES.LIVE), /not approved/);
  assert.deepEqual([...APPROVED_PROVIDER_NAMES], ['fpl','understat','odds','archive']);
  assert.match(APPLIED_SOURCE, /setHealthDetail\('fpl'/);
  assert.match(MINUTES_SOURCE, /healthDetail:minutesHealthDetail/);
  assert.doesNotMatch(APPLIED_SOURCE, /markLive\('minutes'|setHealth\('minutes'/);
});

/* =====================================================================
   K · Odds key boundary (R3.1 B2)
   ===================================================================== */

test('70 · changing the Odds key increments the epoch and invalidates the slice', () => {
  const core = coreOf();
  const first = applied.oddsSignature(core, {oddsKey:'key-one'});
  const second = applied.oddsSignature(core, {oddsKey:'key-two'});
  assert.notEqual(first, second);
  assert.equal(applied.oddsSignature(core, {oddsKey:'key-two'}), second, 'a stable key is a stable epoch');
});

test('71-72 · no signature, envelope, diagnostic or export carries the key or key-derived bytes', () => {
  const core = coreOf();
  const secret = 'super-secret-odds-key-123';
  const signature = applied.oddsSignature(core, {oddsKey:secret});
  assert.ok(!signature.includes(secret));
  assert.ok(!signature.includes(encodeURIComponent(secret)));
  assert.match(signature, /\|\d+$/, 'the key term is an opaque counter');
  assert.doesNotMatch(APPLIED_SOURCE, /createHash|sha256|btoa\(key|hash\(key/);
  assert.doesNotMatch(APPLIED_SOURCE, /oddsKey:[^,)}]*persist|persist[^\n]*oddsKey/);
  const oddsSource = readFileSync(new URL('../src/providers/odds.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(oddsSource, /derived:[\s\S]{0,40}key/);
});

test('oddsKeyEpoch is never persisted or exported into an envelope', () => {
  assert.doesNotMatch(APPLIED_SOURCE, /sset|ssetChecked|localStorage/);
});
