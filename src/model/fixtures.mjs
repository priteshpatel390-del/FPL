import { S, validTeamStrength, teamStrengthsValid } from '../state.mjs';
import { clamp } from '../util.mjs';
import { BASE_GOALS, HOME_TILT } from '../config.mjs';
/* ---------------------------------------------------------------------
   FIXTURE MODEL — expected goals for and against, from team strength
   ratings rather than the official 1–5 difficulty.

   When Official FPL has not published finite team-strength fields, player
   projections use a neutral multiplier and the Fixtures view/sort uses the
   provider's explicit 1–5 difficulty. Invalid values never become NaN.
   --------------------------------------------------------------------- */
function neutralMatchContext(home){
  return {xGF:BASE_GOALS, xGA:BASE_GOALS, cs:Math.exp(-BASE_GOALS),
    atk:1, def:1, home, strengthAvailable:false};
}
function matchContext(teamId, oppId, home){
  const t = S.teams[teamId], o = S.teams[oppId], A = S.avg;
  const averagesValid = A && ['atkH','atkA','defH','defA'].every(key => validTeamStrength(A[key]));
  if(!t || !o || !S.strengthsAvailable || !averagesValid ||
     !teamStrengthsValid(t) || !teamStrengthsValid(o)) return neutralMatchContext(home);
  const tAtk = Number(home ? t.strength_attack_home : t.strength_attack_away);
  const tDef = Number(home ? t.strength_defence_home : t.strength_defence_away);
  const oAtk = Number(home ? o.strength_attack_away : o.strength_attack_home);
  const oDef = Number(home ? o.strength_defence_away : o.strength_defence_home);
  const avgAtkT = Number(home ? A.atkH : A.atkA), avgDefT = Number(home ? A.defH : A.defA);
  const avgAtkO = Number(home ? A.atkA : A.atkH), avgDefO = Number(home ? A.defA : A.defH);

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
  if(![xGF,xGA].every(Number.isFinite)) return neutralMatchContext(home);
  // Preserve the long-standing public result shape when valid inputs exist.
  return {xGF, xGA, cs:Math.exp(-xGA), atk:xGF/BASE_GOALS, def:BASE_GOALS/xGA, home};
}

function officialFixtureDifficulty(game){
  const value = Number(game?.officialDiff);
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
}
function fixtureAnalysisMode(){
  return S.strengthsAvailable ? 'team-strengths' : 'official-fpl-difficulty';
}
function fixtureDifficulty(game, lens){
  const official = officialFixtureDifficulty(game);
  if(lens === 'official' || game?.ctx?.strengthAvailable === false) return official ?? 3;
  return multToDiff(lens === 'defence' ? game.ctx.def : game.ctx.atk);
}
function fixtureLensState(requestedLens='attack'){
  const fallback = fixtureAnalysisMode() === 'official-fpl-difficulty';
  const lens = fallback ? 'official' : requestedLens;
  return {lens, fallback, lowerIsEasier:lens === 'official'};
}
function averageOfficialDifficulty(teamId, fromGW, span){
  const runs = teamFixtures(teamId, fromGW, span);
  let total = 0, count = 0;
  runs.forEach(games => games.forEach(game => {
    const difficulty = officialFixtureDifficulty(game);
    if(difficulty !== null){ total += difficulty; count += 1; }
  }));
  return count ? total / count : null;
}
function compareFixtureRunScores(left, right, sort, lens){
  const a = Number(left), b = Number(right);
  const aFinite = Number.isFinite(a), bFinite = Number.isFinite(b);
  if(!aFinite || !bFinite){
    if(aFinite) return -1;
    if(bFinite) return 1;
    return 0;
  }
  const lowerIsEasier = fixtureLensState(lens).lowerIsEasier;
  if(sort === 'ease') return lowerIsEasier ? a - b : b - a;
  if(sort === 'hard') return lowerIsEasier ? b - a : a - b;
  return 0;
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
  m = Number(m);
  if(!Number.isFinite(m)) return 3;
  if(m >= 1.28) return 1;
  if(m >= 1.10) return 2;
  if(m >= 0.93) return 3;
  if(m >= 0.78) return 4;
  return 5;
}
function runScore(teamId, fromGW, span, requestedLens){
  const {lens, fallback} = fixtureLensState(requestedLens);
  if(fallback || lens === 'official') return averageOfficialDifficulty(teamId, fromGW, span);
  const runs = teamFixtures(teamId, fromGW, span);
  let total = 0;
  runs.forEach(games => games.forEach(game => {
    const value = lens === 'defence' ? game.ctx.def : game.ctx.atk;
    total += Number.isFinite(value) ? value : 1;
  }));
  return total/Math.max(1,span);
}

export {
  neutralMatchContext, matchContext, teamFixtures, multToDiff, runScore,
  officialFixtureDifficulty, fixtureDifficulty, fixtureAnalysisMode,
  fixtureLensState, averageOfficialDifficulty, compareFixtureRunScores
};
