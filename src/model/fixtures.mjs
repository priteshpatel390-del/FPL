import { S } from '../state.mjs';
import { clamp, num } from '../util.mjs';
import { BASE_GOALS, HOME_TILT } from '../config.mjs';
/* ---------------------------------------------------------------------
   FIXTURE MODEL — expected goals for and against, from team strength
   ratings rather than the official 1–5 difficulty.
   --------------------------------------------------------------------- */
function matchContext(teamId, oppId, home){
  const t = S.teams[teamId], o = S.teams[oppId], A = S.avg;
  if(!t || !o) return {xGF:BASE_GOALS, xGA:BASE_GOALS, cs:Math.exp(-BASE_GOALS), atk:1, def:1, home};
  const tAtk = home ? t.strength_attack_home : t.strength_attack_away;
  const tDef = home ? t.strength_defence_home : t.strength_defence_away;
  const oAtk = home ? o.strength_attack_away : o.strength_attack_home;
  const oDef = home ? o.strength_defence_away : o.strength_defence_home;
  const avgAtkT = home ? A.atkH : A.atkA, avgDefT = home ? A.defH : A.defA;
  const avgAtkO = home ? A.atkA : A.atkH, avgDefO = home ? A.defA : A.defH;

  let xGF = clamp(BASE_GOALS * (tAtk/avgAtkT) * (avgDefO/oDef) * (home ? HOME_TILT : 1/HOME_TILT), .25, 4);
  let xGA = clamp(BASE_GOALS * (oAtk/avgAtkO) * (avgDefT/tDef) * (home ? 1/HOME_TILT : HOME_TILT), .25, 4);

  // layer 2: Understat rolling last-6 xG — 45% weight when both sides have data
  if(S.ustat && S.ustat[teamId] && S.ustat[oppId]){
    const uF = clamp(BASE_GOALS * S.ustat[teamId].atk / S.ustat[oppId].def * (home ? HOME_TILT : 1/HOME_TILT), .25, 4);
    const uA = clamp(BASE_GOALS * S.ustat[oppId].atk / S.ustat[teamId].def * (home ? 1/HOME_TILT : HOME_TILT), .25, 4);
    xGF = xGF*0.55 + uF*0.45;
    xGA = xGA*0.55 + uA*0.45;
  }
  // layer 3: bookmaker odds — the market wins 65/35 where it has a quote
  if(S.odds){
    const q = home ? S.odds[teamId + '|' + oppId] : S.odds[oppId + '|' + teamId];
    if(q){
      const mF = home ? q.xGH : q.xGA, mA = home ? q.xGA : q.xGH;
      xGF = xGF*0.35 + mF*0.65;
      xGA = xGA*0.35 + mA*0.65;
    }
  }
  return {xGF, xGA, cs:Math.exp(-xGA), atk:xGF/BASE_GOALS, def:BASE_GOALS/xGA, home};
}

function teamFixtures(teamId, fromGW, span){
  const out = [];
  for(let gw = fromGW; gw < fromGW + span; gw++){
    const games = S.fixtures.filter(f => f.event === gw && (f.team_h === teamId || f.team_a === teamId));
    out.push(games.map(f => {
      const home = f.team_h === teamId;
      const opp = home ? f.team_a : f.team_h;
      return {gw, home, oppId:opp, opp:S.teams[opp],
              officialDiff: home ? f.team_h_difficulty : f.team_a_difficulty,
              ctx: matchContext(teamId, opp, home)};
    }));
  }
  return out;
}

// 1 (easiest) – 5 (hardest) from a multiplier where >1 is favourable
function multToDiff(m){
  if(m >= 1.28) return 1;
  if(m >= 1.10) return 2;
  if(m >= 0.93) return 3;
  if(m >= 0.78) return 4;
  return 5;
}
function runScore(teamId, fromGW, span, lens){
  const runs = teamFixtures(teamId, fromGW, span);
  let total = 0, n = 0;
  runs.forEach(games => {
    if(!games.length){ total += 0.55; n += 1; return; }           // blank hurts
    games.forEach(g => {
      total += lens === 'defence' ? g.ctx.def
             : lens === 'official' ? (6 - g.officialDiff)/3
             : g.ctx.atk;
      n += 1;
    });
    if(games.length > 1) total += 0.45;                            // double bonus
  });
  return n ? total/n : 1;
}

export { matchContext, teamFixtures, multToDiff, runScore };
