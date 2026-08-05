// tests/harness.mjs — loads the current single-file app into a stubbed DOM so
// model functions can be exercised deterministically under node:test.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Opt-in browser affordances for runtime behaviour tests: a real document event registry,
// CustomEvent, a hash location and a controllable Worker/Blob/URL trio. Default loads keep
// the original inert stubs so existing suites are unaffected.
function interactiveGlobals(){
  const listeners = new Map();
  const workers = [];
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}){ this.type = type; this.detail = init.detail; }
  };
  globalThis.location = { hash:'#/transfers' };
  globalThis.Blob = class Blob { constructor(parts = [], options = {}){ this.parts = parts; this.type = options.type || ''; } };
  globalThis.URL = { createObjectURL: () => 'blob:teamsheet-test', revokeObjectURL(){} };
  globalThis.Worker = class Worker {
    constructor(url){ this.url = url; this.messages = []; this.terminated = false; workers.push(this); }
    postMessage(message){ this.messages.push(message); }
    terminate(){ this.terminated = true; }
  };
  return {
    workers,
    addEventListener(type, handler){
      if(!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    dispatchEvent(event){ (listeners.get(event?.type) || []).forEach(handler => handler(event)); return true; }
  };
}

export function loadApp(fieldValues = {}, { interactive = false } = {}) {
  const browser = interactive ? interactiveGlobals() : null;
  const defaults = { fxFrom:'4', fxSpan:'6', fxSort:'ease', fxLens:'attack', plHorizon:'6',
    ftCount:'1', bankIn:'0', oddsKey:'', useUstat:false, useManual:false,
    leagueId:'', leagueName:'', lgN:'20', teamId:'', plPos:'0', plMax:'15', plFit:true, plOwn:false,
    trHorizon:'6', trTop:'8', pSearch:'', q:'' };
  const vals = { ...defaults, ...fieldValues };
  const made = {};
  const mk = (id, tag = 'div') => ({ id, tagName:tag.toUpperCase(), attrs:{}, nodeType:1, value: vals[id] ?? '', checked: vals[id] === true, innerHTML:'', textContent:'', children:[],
    options:{length:9}, add(){}, hidden:false, dataset:{}, style:{}, listeners:{},
    addEventListener(type, handler){ if(!browser) return; (this.listeners[type] = this.listeners[type] || []).push(handler); },
    querySelectorAll(){ return []; }, after(){}, remove(){}, nextElementSibling:null,
    classList:{ contains(){ return false; } }, setAttribute(k,v){ this.attrs[k] = String(v); this[k] = String(v); }, focus(){},
    click(){ (this.listeners.click || []).forEach(handler => handler({ type:'click', target:this, preventDefault(){}, stopImmediatePropagation(){} })); },
    closest(){ return null; }, appendChild(child){ this.children.push(child); child.parentNode = this; return child; },
    append(...children){ children.forEach(child => this.appendChild(child)); },
    removeChild(child){ this.children.splice(this.children.indexOf(child), 1); }, get firstChild(){ return this.children[0] || null; },
    closest(){ return null; }, disabled:false });

  globalThis.document = { getElementById: id => made[id] || (made[id] = mk(id)),
    querySelectorAll: () => [],
    addEventListener: browser ? browser.addEventListener : function(){},
    ...(browser ? { dispatchEvent: browser.dispatchEvent } : {}),
    createElement: tag => mk('x', tag),
    createElementNS: (_namespace, tag) => mk('x', tag), createTextNode: text => ({nodeType:3, textContent:String(text), parentNode:null}) };
  globalThis.window = { scrollTo(){} };
  globalThis.localStorage = { _d:{}, getItem(k){ return this._d[k] ?? null; },
    setItem(k,v){ this._d[k]=v; }, removeItem(k){ delete this._d[k]; } };
  globalThis.__TEAMSHEET_FPL_GATEWAY_BASE__ = 'https://teamsheet.test/fpl';
  globalThis.fetch = async () => { throw new Error('network disabled in tests'); };
  globalThis.AbortController = class { constructor(){ this.signal = {}; } abort(){} };

  const target = process.env.APP_TARGET || 'dist/app.bundle.js';   // Stage 2: bundle is canonical
  const src = readFileSync(join(ROOT, target), 'utf8').replace(/\(async function init\(\)[\s\S]*$/, '');
  const exports = {};
  globalThis.__EXPORTS__ = exports;
  // eslint-disable-next-line no-eval
  (0, eval)(src + `\nObject.assign(globalThis.__EXPORTS__, { S, hydrate, matchContext, multToDiff, runScore,
    teamFixtures, playerFixtureXP, projectXP, priceBaseline, availability, expectedMinutes, bestXI,
    sellPrice, mySquad, parseCSV, pearson, poissonOver, solveLambda, mapTeamName, parseUnderstat,
    runBacktest, rememberLeague, renderLeagueChips, renderTicker, renderPlayers, renderSquad, renderTransfers,
    renderManual, searchPlayers, transferPlannerMoveList, renderAll, sget, sset, saveCfg, loadCfg, stripDeprecatedSecrets, ask,
    clearXP, flagsFor, priceMomentum, transferPerformanceStart, transferPerformanceCancel, transferPerformanceSnapshot });
    \nglobalThis.loadOdds = loadOdds; globalThis.loadUnderstat = loadUnderstat;`);
  delete globalThis.__EXPORTS__;
  return { T: exports, doc: made, workers: browser?.workers || [],
    dispatch: (type, detail) => globalThis.document.dispatchEvent(new globalThis.CustomEvent(type, {detail})),
    setFetch: f => { globalThis.fetch = f; } };
}

// Deterministic synthetic league shared by all characterisation tests.
export function syntheticWorld(T) {
  const teams = [];
  for (let i = 1; i <= 20; i++) teams.push({ id:i,
    name: i===1?'Man Utd': i===2?'Spurs': i===3?"Nott'm Forest" : 'Team '+i, short_name:'T'+i,
    strength_attack_home:1360-i*18, strength_attack_away:1310-i*18,
    strength_defence_home:1350-i*17, strength_defence_away:1300-i*17 });
  const fixtures = [];
  for (let gw = 1; gw <= 20; gw++) for (let i = 0; i < 10; i++) {
    const h = ((i*2+gw)%20)+1, a = ((i*2+gw+9)%20)+1;
    if (h !== a) fixtures.push({ event:gw, team_h:h, team_a:a, team_h_difficulty:3, team_a_difficulty:3, finished:gw<10 });
  }
  fixtures.push({ event:11, team_h:5, team_a:12, team_h_difficulty:2, team_a_difficulty:4, finished:false }); // double for team 5
  const events = [];
  for (let i = 1; i <= 38; i++) events.push({ id:i, deadline_time:'2026-08-21T17:30:00Z',
    is_current:i===10, is_next:i===11, finished:i<10, name:'GW'+i });
  const P = (id,name,type,team,cost,o) => Object.assign({ id, web_name:name, team, element_type:type,
    now_cost:cost, total_points:50, form:'5.0', selected_by_percent:'20', minutes:900, starts:10,
    goals_scored:5, assists:3, clean_sheets:4, saves:0, bonus:8, bps:250,
    expected_goals_per_90:0, expected_assists_per_90:0, defensive_contribution_per_90:0,
    status:'a', chance_of_playing_next_round:100, news:'', cost_change_event:0,
    transfers_in_event:0, transfers_out_event:0, yellow_cards:2, penalties_order:null }, o);
  const elements = [
    P(101,'EliteFWD',4,2,145,{expected_goals_per_90:0.85,expected_assists_per_90:0.20,bps:420}),
    P(102,'GoodFWD',4,5,80,{expected_goals_per_90:0.48,expected_assists_per_90:0.15,bps:270}),
    P(103,'BudgetFWD',4,17,45,{expected_goals_per_90:0.22,expected_assists_per_90:0.08,bps:150,minutes:600}),
    P(104,'EliteMID',3,3,130,{expected_goals_per_90:0.55,expected_assists_per_90:0.40,bps:430}),
    P(105,'DCMID',3,11,55,{expected_goals_per_90:0.05,expected_assists_per_90:0.10,defensive_contribution_per_90:14,bps:230}),
    P(106,'EliteDEF',2,1,65,{expected_goals_per_90:0.12,expected_assists_per_90:0.18,defensive_contribution_per_90:9,bps:300}),
    P(107,'WeakDEF',2,20,40,{expected_goals_per_90:0.02,expected_assists_per_90:0.03,defensive_contribution_per_90:8,bps:130}),
    P(108,'EliteGKP',1,1,55,{saves:32,bps:280}),
    P(109,'BusyGKP',1,20,45,{saves:58,bps:220}),
    P(110,'Doubt75',3,7,70,{status:'d',chance_of_playing_next_round:75,expected_goals_per_90:0.25,expected_assists_per_90:0.22,bps:250}),
    P(111,'Injured',3,8,70,{status:'i',expected_goals_per_90:0.3}),
  ];
  T.hydrate({ at: 1753500000000, events, teams, elements,
    element_types:[{id:1,singular_name_short:'GKP',singular_name:'Goalkeeper'},
      {id:2,singular_name_short:'DEF',singular_name:'Defender'},
      {id:3,singular_name_short:'MID',singular_name:'Midfielder'},
      {id:4,singular_name_short:'FWD',singular_name:'Forward'}], fixtures });
  return { teams, fixtures, events, elements };
}

export const round = (v, dp = 6) => typeof v === 'number' ? +v.toFixed(dp) : v;
export function roundDeep(x, dp = 6) {
  if (Array.isArray(x)) return x.map(v => roundDeep(v, dp));
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k,v]) => [k, roundDeep(v, dp)]));
  return round(x, dp);
}
