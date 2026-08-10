import { $ } from './util.mjs';
import { normaliseFixtures, validateBootstrap, hasFatal } from './providers/validate.mjs';

/* Shared cross-module state inventory.

   Declaring a slot here does not make state.mjs its semantic owner. Domain
   modules still own the values they write (providers, calibration,
   Mini-Leagues, and so on). This object is only the explicit inventory of
   mutable values intentionally shared through S; tests reject undeclared
   direct S.<key> usage so lifecycle ownership cannot silently expand. */
const S = {
  boot:null, fixtures:null, entry:null, picks:null, history:null,
  picksGameweek:0, picksStatus:'idle', strengthsAvailable:false,
  teams:{}, byId:{}, posName:{}, posFull:{}, avg:null,
  teamId:'', currentGW:0, nextGW:1, seasonLive:false, gamesPlayed:1,
  source:'', cachedAt:null, manual:[], chipsUsed:[], thread:[],
  dataIssues:[],
  retryStats:{},
  minuteHistory:{},
  // R3.4 E2 — same key set as minuteHistory; carries the provenance each entry
  // needs once entries are retained individually across a commit. Element ids
  // are reused between seasons, so an id match alone proves nothing.
  minuteHistoryMeta:{},
  // R3.4 E4 — in-memory provenance for the applied Understat/Odds values.
  // Rule B reads this, never persisted storage: the commit is synchronous so
  // it cannot await, and after a persist_failed memory is the newer record.
  providerApplied:{understat:null, odds:null},
  __accountKeys:{entry:null,picks:null,history:null},
  lastOptimiser:null,

  // Supporting-provider runtime slices. providers/* remains their owner.
  ustat:null, ustatNote:'', odds:null, oddsNote:'',
  // Historical calibration/backtest runtime mirrors. model/backtest.mjs owns
  // their lifecycle; verified browser persistence remains owned by storage.mjs.
  calib:null, backtest:null,
  // Mini-League preferences are owned by mini-leagues-state.mjs; fetched
  // standings/rival/exposure session data is owned by mini-leagues-view.mjs.
  miniLeagues:null, leagues:[], miniLeagueData:null
};
const SHARED_STATE_KEYS = Object.freeze(Object.keys(S));

/* ---------------------------------------------------------------------
   SLIM + CACHE — bootstrap is far too large to store whole, so only the
   fields the model uses are kept.
   --------------------------------------------------------------------- */
const TEAM_STRENGTH_FIELDS = Object.freeze([
  'strength_attack_home','strength_attack_away','strength_defence_home','strength_defence_away'
]);
function validTeamStrength(value){
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}
function teamStrengthsValid(team){
  return Boolean(team) && TEAM_STRENGTH_FIELDS.every(field => validTeamStrength(team[field]));
}

const KEEP = ['id','web_name','team','element_type','now_cost','total_points','form','points_per_game',
  'selected_by_percent','minutes','starts','goals_scored','assists','clean_sheets','saves','bonus','bps',
  'expected_goals_per_90','expected_assists_per_90','expected_goal_involvements_per_90',
  'expected_goals_conceded_per_90','defensive_contribution','defensive_contribution_per_90',
  'status','chance_of_playing_next_round','news','news_added','cost_change_event','cost_change_start',
  'transfers_in_event','transfers_out_event','penalties_order','direct_freekicks_order',
  'corners_and_indirect_freekicks_order','ep_next','yellow_cards','red_cards','own_goals',
  'penalties_missed','penalties_saved'];

function slim(boot, fixtures){
  return {
    at: Date.now(),
    events: boot.events.map(e => ({id:e.id, deadline_time:e.deadline_time, is_current:e.is_current,
      is_next:e.is_next, finished:e.finished, data_checked:e.data_checked, name:e.name})),
    teams: boot.teams.map(t => ({id:t.id, name:t.name, short_name:t.short_name,
      strength_attack_home:t.strength_attack_home, strength_attack_away:t.strength_attack_away,
      strength_defence_home:t.strength_defence_home, strength_defence_away:t.strength_defence_away})),
    element_types: boot.element_types.map(t => ({id:t.id, singular_name_short:t.singular_name_short, singular_name:t.singular_name})),
    elements: boot.elements.map(p => { const o = {}; KEEP.forEach(k => { if(p[k] !== undefined) o[k] = p[k]; }); return o; }),
    fixtures: fixtures.map(f => ({event:f.event, id:f.id, team_h:f.team_h, team_a:f.team_a,
      team_h_difficulty:f.team_h_difficulty, team_a_difficulty:f.team_a_difficulty,
      kickoff_time:f.kickoff_time, started:f.started, finished:f.finished,
      provisional_start_time:f.provisional_start_time}))
  };
}

/* D-13 + D-14: the snapshot is validated on EVERY load, fresh or cached,
   before a single assignment is made. A fatal payload returns early with
   state untouched — a half-populated S is worse than no refresh at all.

   R3 — prepareCore() is the pure half: it validates and derives, returning the
   values rather than assigning them, so the refresh can stage a complete core
   without touching S. hydrate() is the assigning half and keeps its exact
   previous behaviour for the cached-startup path and existing callers. */
function prepareCore(d){
  const bv = validateBootstrap(d);
  const fx = bv.value === null ? { fixtures: [], issues: [] }
                               : normaliseFixtures(bv.value.fixtures);
  const issues = bv.issues.concat(fx.issues);
  if(bv.value === null || hasFatal(issues)) return { ok:false, issues, core:null };
  const v = bv.value;
  const invalidStrengthTeams = v.teams.filter(team => !teamStrengthsValid(team)).length;
  if(invalidStrengthTeams) issues.push({
    provider:'fpl', endpoint:'/bootstrap-static/', code:'team_strengths_unavailable',
    severity:'partial', count:invalidStrengthTeams, fields:TEAM_STRENGTH_FIELDS.slice()
  });
  const teams = {}; v.teams.forEach(t => teams[t.id] = t);
  const byId = {}; v.elements.forEach(p => byId[p.id] = p);
  const posName = {}, posFull = {};
  v.element_types.forEach(t => { posName[t.id] = t.singular_name_short; posFull[t.id] = t.singular_name; });

  const cur  = v.events.find(e => e.is_current);
  const next = v.events.find(e => e.is_next) || v.events.find(e => !e.finished);
  const currentGW = cur ? cur.id : 0;
  const nextGW = next ? next.id : 38;
  const seasonLive = v.events.some(e => e.finished);

  const ts = v.teams;
  const strengthsAvailable = ts.length > 0 && ts.every(teamStrengthsValid);
  const mean = key => {
    const values = ts.map(team => Number(team[key])).filter(validTeamStrength);
    return values.length ? values.reduce((sum,value) => sum + value, 0) / values.length : null;
  };
  const year = +(v.events?.[0]?.deadline_time || '').slice(0,4);
  return { ok:true, issues, core:{
    boot:{events:v.events, teams:v.teams, elements:v.elements, element_types:v.element_types},
    events:v.events, teams:v.teams, elements:v.elements, element_types:v.element_types,
    fixtures:fx.fixtures, teamsById:teams, byId, posName, posFull,
    currentGW, nextGW, seasonLive, gamesPlayed:Math.max(1, currentGW), cachedAt:v.at,
    strengthsAvailable,
    avg:{atkH:mean('strength_attack_home'), atkA:mean('strength_attack_away'),
         defH:mean('strength_defence_home'), defA:mean('strength_defence_away')},
    season:Number.isFinite(year) && year > 2000 ? year + '-' + String((year+1)%100).padStart(2,'0') : 'unknown'
  }};
}

function hydrate(d){
  const prepared = prepareCore(d);
  if(!prepared.ok){ S.dataIssues = prepared.issues; return { ok:false, issues:prepared.issues }; }
  assignCore(prepared.core, prepared.issues);
  populatePositionFilter(prepared.core.element_types);
  return { ok:true, issues:prepared.issues };
}

/* The core half of the synchronous commit: plain assignments from an
   already-validated prepared core. No validation, no DOM, no awaits. */
function assignCore(core, issues){
  S.boot = core.boot;
  S.fixtures = core.fixtures;
  S.dataIssues = issues;
  S.teams = core.teamsById;
  S.byId = core.byId;
  S.posName = core.posName;
  S.posFull = core.posFull;
  S.currentGW = core.currentGW;
  S.nextGW = core.nextGW;
  S.seasonLive = core.seasonLive;
  S.gamesPlayed = core.gamesPlayed;
  S.cachedAt = core.cachedAt;
  S.strengthsAvailable = core.strengthsAvailable;
  S.avg = core.avg;
}

/* R3 §4 — extracted from hydrate(). This is a DOM write, so it can throw and
   it mutates the document; neither belongs inside the synchronous, no-throw
   commit. It runs in the post-commit render phase instead, which both the
   cached and live paths reach. Behaviour is otherwise identical. */
function populatePositionFilter(elementTypes = S.boot?.element_types){
  if(typeof document === 'undefined' || !Array.isArray(elementTypes)) return false;
  const sel = $('plPos');
  if(!sel || sel.options.length > 1) return false;
  elementTypes.forEach(t => sel.add(new Option(t.singular_name_short, t.id)));
  return true;
}

function recordIssues(provider, endpoint, issues){
  S.dataIssues = S.dataIssues.filter(i => !(i.provider === provider && i.endpoint === endpoint));
  if(issues && issues.length) S.dataIssues = S.dataIssues.concat(issues);
}

function recordRetry(record){
  if(!record || !record.provider) return;
  S.retryStats[record.provider + '|' + record.endpoint] = record;
}

/* R3 A2 / R3.4 E5 — the refresh commit journal.

   Every key the commit may write, and nothing else. User-owned state (manual,
   thread, calib, backtest, mini-league selections) and navigation state are
   deliberately absent: the commit never touches them, so they must survive it.

   retryStats is CLONED rather than referenced. recordRetry() writes into the
   existing object in place, so snapshotting the reference would restore
   nothing. The commit assigns a fresh object for the same reason. */
const REFRESH_OWNED_KEYS = Object.freeze([
  'boot','fixtures','teams','byId','posName','posFull','currentGW','nextGW',
  'seasonLive','gamesPlayed','cachedAt','avg','strengthsAvailable','source','teamId',
  'entry','picks','history','picksGameweek','picksStatus','chipsUsed',
  'ustat','ustatNote','odds','oddsNote','minuteHistory','minuteHistoryMeta',
  'providerApplied','__accountKeys','dataIssues'
]);
function captureStateJournal(){
  const state = {};
  REFRESH_OWNED_KEYS.forEach(key => { state[key] = S[key]; });
  return { state, retryStats:{ ...S.retryStats } };
}
function restoreStateJournal(journal){
  if(!journal) return;
  REFRESH_OWNED_KEYS.forEach(key => { S[key] = journal.state[key]; });
  S.retryStats = { ...journal.retryStats };
}

export {
  S, SHARED_STATE_KEYS, KEEP, TEAM_STRENGTH_FIELDS, validTeamStrength, teamStrengthsValid,
  slim, hydrate, prepareCore, assignCore, populatePositionFilter, recordIssues, recordRetry,
  REFRESH_OWNED_KEYS, captureStateJournal, restoreStateJournal
};