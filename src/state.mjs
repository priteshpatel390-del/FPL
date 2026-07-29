import { $ } from './util.mjs';
import { normaliseFixtures, validateBootstrap, hasFatal } from './providers/validate.mjs';
const S = {
  boot:null, fixtures:null, entry:null, picks:null, history:null,
  teams:{}, byId:{}, posName:{}, avg:null,
  teamId:'', currentGW:0, nextGW:1, seasonLive:false, gamesPlayed:1,
  source:'', cachedAt:null, manual:[], chipsUsed:[], thread:[],
  dataIssues:[],
  retryStats:{},
  minuteHistory:{},
  lastOptimiser:null
};

/* ---------------------------------------------------------------------
   SLIM + CACHE — bootstrap is far too large to store whole, so only the
   fields the model uses are kept.
   --------------------------------------------------------------------- */
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
   state untouched — a half-populated S is worse than no refresh at all. */
function hydrate(d){
  const bv = validateBootstrap(d);
  const fx = bv.value === null ? { fixtures: [], issues: [] }
                               : normaliseFixtures(bv.value.fixtures);
  const issues = bv.issues.concat(fx.issues);
  if(bv.value === null || hasFatal(issues)){
    S.dataIssues = issues;
    return { ok:false, issues };
  }
  const v = bv.value;
  S.boot = {events:v.events, teams:v.teams, elements:v.elements, element_types:v.element_types};
  S.fixtures = fx.fixtures;
  S.dataIssues = issues;
  S.teams = {}; v.teams.forEach(t => S.teams[t.id] = t);
  S.byId = {}; v.elements.forEach(p => S.byId[p.id] = p);
  S.posName = {}; S.posFull = {};
  v.element_types.forEach(t => { S.posName[t.id] = t.singular_name_short; S.posFull[t.id] = t.singular_name; });

  const cur  = v.events.find(e => e.is_current);
  const next = v.events.find(e => e.is_next) || v.events.find(e => !e.finished);
  S.currentGW = cur ? cur.id : 0;
  S.nextGW = next ? next.id : 38;
  S.seasonLive = v.events.some(e => e.finished);
  S.gamesPlayed = Math.max(1, S.currentGW);
  S.cachedAt = v.at;

  const ts = v.teams, n = ts.length || 1;
  const mean = k => ts.reduce((a,t) => a + (t[k]||1000), 0) / n;
  S.avg = {atkH:mean('strength_attack_home'), atkA:mean('strength_attack_away'),
           defH:mean('strength_defence_home'), defA:mean('strength_defence_away')};

  const sel = $('plPos');
  if(sel.options.length <= 1)
    v.element_types.forEach(t => sel.add(new Option(t.singular_name_short, t.id)));

  return { ok:true, issues };
}

function recordIssues(provider, endpoint, issues){
  S.dataIssues = S.dataIssues.filter(i => !(i.provider === provider && i.endpoint === endpoint));
  if(issues && issues.length) S.dataIssues = S.dataIssues.concat(issues);
}

function recordRetry(record){
  if(!record || !record.provider) return;
  S.retryStats[record.provider + '|' + record.endpoint] = record;
}

export { S, KEEP, slim, hydrate, recordIssues, recordRetry };
