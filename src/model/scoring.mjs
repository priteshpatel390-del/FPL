import { S } from '../state.mjs';
import { clamp, num } from '../util.mjs';
import { GOAL_PTS, CS_PTS, ASSIST_PTS, DC_THRESH, BASE_GOALS } from '../config.mjs';
import { teamFixtures } from './fixtures.mjs';
/* ---------------------------------------------------------------------
   PLAYER MODEL — projected points, built separately per position.
   Returns a breakdown so every number is inspectable.
   --------------------------------------------------------------------- */
function availability(p){
  if(['i','u','s','n'].includes(p.status)) return 0;
  if(p.status === 'd') return clamp((p.chance_of_playing_next_round ?? 50)/100, 0, 1);
  return 1;
}
function per90(p, key){
  if(p[key] !== undefined && p[key] !== null) return num(p[key]);
  return 0;
}
function expectedMinutes(p){
  if(!S.seasonLive) return null;                    // no data yet
  const mins = num(p.minutes), gp = S.gamesPlayed;
  return clamp(mins / gp, 0, 90);
}
// pre-season only: FPL sets prices against expected output, so price is the prior
function priceBaseline(p){
  const price = p.now_cost/10, pos = p.element_type;
  const table = {1: 2.30 + (price-4.0)*0.60, 2: 2.45 + (price-4.0)*0.72,
                 3: 2.20 + (price-4.5)*0.78, 4: 2.35 + (price-4.5)*0.74};
  const base = table[pos] !== undefined ? table[pos] : 1.6 + (price-4.0)*0.4;
  const ownTilt = 1 + clamp(num(p.selected_by_percent), 0, 45)/450;
  return clamp(base, 0.6, 9) * ownTilt;
}

function playerFixtureXP(p, g){
  const pos = p.element_type, ctx = g.ctx, avail = availability(p);
  const parts = {};
  if(avail === 0) return {total:0, parts:{unavailable:0}};

  if(!S.seasonLive){
    const base = priceBaseline(p);
    const lensMult = (pos === 1 || pos === 2) ? Math.pow(ctx.def, 0.55) : Math.pow(ctx.atk, 0.65);
    parts['Price-implied base'] = base;
    parts['Fixture adjustment'] = base * (lensMult - 1);
    const total = base * lensMult * avail;
    return {total, parts};
  }

  const expMins = expectedMinutes(p);
  // every component is discounted by the chance he actually features, not just
  // the minutes ones — a 25% doubt must not keep a full goal projection
  const mFactor = (expMins/90) * avail;
  const pAny = clamp(expMins/28, 0, .98) * avail;
  const p60  = clamp((expMins-18)/55, 0, .97) * avail;

  // appearance
  parts['Appearance'] = pAny + p60;

  // attacking returns, scaled by how many goals the team is expected to score
  const xg = per90(p,'expected_goals_per_90') * mFactor * ctx.atk;
  const xa = per90(p,'expected_assists_per_90') * mFactor * ctx.atk;
  parts['Goals'] = xg * (GOAL_PTS[pos] ?? 4);
  parts['Assists'] = xa * ASSIST_PTS;

  // clean sheets (needs 60 minutes) and goals conceded
  if(CS_PTS[pos]) parts['Clean sheet'] = ctx.cs * CS_PTS[pos] * p60;
  if(pos === 1 || pos === 2) parts['Goals conceded'] = -(ctx.xGA/2) * mFactor * 0.72;

  // saves
  if(pos === 1){
    const played90 = Math.max(0.5, num(p.minutes)/90);
    const saves90 = num(p.saves)/played90;
    parts['Saves'] = (saves90 * (ctx.xGA/BASE_GOALS) / 3) * mFactor;
  }

  // defensive contribution points
  const thr = DC_THRESH[pos];
  if(thr){
    let dc90 = per90(p,'defensive_contribution_per_90');
    if(!dc90 && p.defensive_contribution !== undefined){
      const played90 = Math.max(0.5, num(p.minutes)/90);
      dc90 = num(p.defensive_contribution)/played90;
    }
    // a season average above the threshold doesn't mean hitting it every week,
    // so the curve is deliberately shallow
    if(dc90) parts['Defensive actions'] = 2 * (1/(1+Math.exp(-(dc90-thr)/2.2))) * p60;
  }

  // bonus, nudged by how comfortable the fixture is
  const played90b = Math.max(0.5, num(p.minutes)/90);
  const bps90 = num(p.bps)/played90b;
  // calibrated so a 40+ bps/90 elite lands near 1.2–1.3 bonus a game, not 2+
  parts['Bonus'] = clamp((bps90-16)/20, 0, 1.8) * mFactor * (1 + (ctx.atk-1)*0.3);

  // cards
  const cards90 = num(p.yellow_cards)/played90b;
  if(cards90) parts['Cards'] = -cards90 * mFactor;

  let total = 0;
  Object.keys(parts).forEach(k => { if(!isFinite(parts[k])) parts[k] = 0; total += parts[k]; });
  // backtest-derived per-position correction
  const cal = S.calib?.[pos];
  if(cal && cal !== 1){ parts['Calibration'] = total*(cal-1); total *= cal; }
  return {total: Math.max(0, total), parts};
}

function projectXP(p, fromGW, span){
  const runs = teamFixtures(p.team, fromGW, span);
  let total = 0, games = 0;
  const agg = {};
  runs.forEach(gwGames => gwGames.forEach(g => {
    const r = playerFixtureXP(p, g);
    total += r.total; games++;
    Object.entries(r.parts).forEach(([k,v]) => agg[k] = (agg[k]||0) + v);
  }));
  return {total, perGW: total/Math.max(1,span), games, parts:agg};
}

const xpCache = new Map();
function xpOf(p, fromGW, span){
  const key = p.id + ':' + fromGW + ':' + span;
  if(!xpCache.has(key)) xpCache.set(key, projectXP(p, fromGW, span));
  return xpCache.get(key);
}
const clearXP = () => xpCache.clear();

export { availability, per90, expectedMinutes, priceBaseline, playerFixtureXP, projectXP, xpOf, clearXP };
