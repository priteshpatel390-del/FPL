import { S } from '../state.mjs';
import { clamp, num } from '../util.mjs';
import { FPL_RULES, GOAL_PTS, CS_PTS, ASSIST_PTS, BASE_GOALS, SCORING_RULES } from '../config.mjs';
import { teamFixtures } from './fixtures.mjs';
import { expectedMinutes, minutesEstimate, completedTeamMatches, aggregateMinutes } from './minutes.mjs';
import { expectedGroupedPoints, expectedThresholdPoints, shrunkRate } from './scoring-rules.mjs';
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
function priceBaseline(p){
  const price = p.now_cost/10, pos = p.element_type;
  const table = {1: 2.30 + (price-4.0)*0.60, 2: 2.45 + (price-4.0)*0.72,
                 3: 2.20 + (price-4.5)*0.78, 4: 2.35 + (price-4.5)*0.74};
  const base = table[pos] !== undefined ? table[pos] : 1.6 + (price-4.0)*0.4;
  const ownTilt = 1 + clamp(num(p.selected_by_percent), 0, 45)/450;
  return clamp(base, 0.6, 9) * ownTilt;
}

function played90(p){ return Math.max(SCORING_RULES.minimumExposure90, num(p.minutes)/90); }
function seasonAppearances(p){
  const rows = Array.isArray(S.minuteHistory?.[p.id]) ? S.minuteHistory[p.id] : [];
  const detailed = rows.filter(r => num(r.minutes) > 0).length;
  if(detailed) return detailed;
  const matches = completedTeamMatches(p.team);
  const aggregate = aggregateMinutes(p, matches);
  if(aggregate) return matches * aggregate.pAppear;
  return Math.max(num(p.starts), num(p.minutes)/90, 0);
}
function positionPlayers(pos){ return (S.boot?.elements || []).filter(p => p.element_type === pos); }
function populationRate(pos, field){
  let events = 0, exposure = 0;
  positionPlayers(pos).forEach(p => { events += Math.max(0,num(p[field])); exposure += Math.max(0,num(p.minutes))/90; });
  return exposure > 0 ? events/exposure : 0;
}
function rareRate(p, field){
  return shrunkRate(p[field], played90(p), populationRate(p.element_type, field), SCORING_RULES.rareEventPriorMatches);
}
function populationBonusPerAppearance(pos){
  let bonus = 0, apps = 0;
  positionPlayers(pos).forEach(p => { bonus += Math.max(0,num(p.bonus)); apps += seasonAppearances(p); });
  return apps > 0 ? bonus/apps : 0;
}
function bonusPerAppearance(p){
  const apps = seasonAppearances(p), priorApps = SCORING_RULES.bonusPriorAppearances;
  const prior = populationBonusPerAppearance(p.element_type);
  return (Math.max(0,num(p.bonus)) + priorApps*prior) / Math.max(1e-9, apps + priorApps);
}
function penaltyMissRate(p){
  const order = p.penalties_order;
  const prior = populationRate(p.element_type, 'penalties_missed');
  if(order === null) return prior;
  const rate = rareRate(p, 'penalties_missed');
  if(order === undefined || SCORING_RULES.penaltyRoleOrders.includes(num(order))) return rate;
  return prior;
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

  const mins = minutesEstimate(p);
  const mFactor = mins.expMin/90;
  const pAny = mins.pAppear;
  const p60 = mins.p60;

  parts['Appearance'] = pAny * FPL_RULES.appearance.any + p60 * FPL_RULES.appearance.sixtyMinutes;

  const xg = Math.max(0,per90(p,'expected_goals_per_90')) * mFactor * ctx.atk;
  const xa = Math.max(0,per90(p,'expected_assists_per_90')) * mFactor * ctx.atk;
  parts['Goals'] = xg * (GOAL_PTS[pos] ?? 4);
  parts['Assists'] = xa * ASSIST_PTS;

  if(CS_PTS[pos]) parts['Clean sheet'] = ctx.cs * CS_PTS[pos] * p60;
  if(FPL_RULES.goalsConceded.positions.includes(pos)){
    const lambdaConceded = Math.max(0,ctx.xGA) * mFactor;
    parts['Goals conceded'] = expectedGroupedPoints(lambdaConceded,
      FPL_RULES.goalsConceded.groupSize,FPL_RULES.goalsConceded.pointsPerGroup);
  }

  if(pos === 1){
    const saves90 = Math.max(0,num(p.saves))/played90(p);
    const lambdaSaves = saves90 * Math.max(0,ctx.xGA/BASE_GOALS) * mFactor;
    parts['Saves'] = expectedGroupedPoints(lambdaSaves,FPL_RULES.saves.groupSize,FPL_RULES.saves.pointsPerGroup);
  }

  const threshold = FPL_RULES.defensiveContribution.thresholds[pos];
  if(threshold){
    let dc90 = Math.max(0,per90(p,'defensive_contribution_per_90'));
    if(!dc90 && p.defensive_contribution !== undefined) dc90 = Math.max(0,num(p.defensive_contribution))/played90(p);
    if(dc90 && pAny > 0){
      const conditionalMinutes = clamp(mins.expMin/Math.max(pAny,1e-9),0,90);
      const lambdaDc = dc90 * conditionalMinutes/90;
      parts['Defensive contributions'] = pAny * expectedThresholdPoints(lambdaDc,threshold,
        FPL_RULES.defensiveContribution.points);
    }
  }

  parts['Bonus'] = pAny * bonusPerAppearance(p);

  const yellow = rareRate(p,'yellow_cards') * mFactor;
  if(yellow) parts['Yellow cards'] = yellow * FPL_RULES.cards.yellow;
  const red = rareRate(p,'red_cards') * mFactor;
  if(red) parts['Red cards'] = red * FPL_RULES.cards.red;
  const ownGoal = rareRate(p,'own_goals') * mFactor;
  if(ownGoal) parts['Own goals'] = ownGoal * FPL_RULES.ownGoal;
  const penaltyMiss = penaltyMissRate(p) * mFactor;
  if(penaltyMiss) parts['Penalty misses'] = penaltyMiss * FPL_RULES.penaltyMiss;
  if(pos === 1){
    const penaltySave = rareRate(p,'penalties_saved') * mFactor;
    if(penaltySave) parts['Penalty saves'] = penaltySave * FPL_RULES.penaltySave;
  }

  let total = 0;
  Object.keys(parts).forEach(k => { if(!isFinite(parts[k])) parts[k] = 0; total += parts[k]; });
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

export { availability, per90, expectedMinutes, priceBaseline, playerFixtureXP, projectXP, xpOf, clearXP,
  played90, seasonAppearances, populationRate, rareRate, bonusPerAppearance, penaltyMissRate };
