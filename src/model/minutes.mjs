import { S } from '../state.mjs';
import { clamp, num } from '../util.mjs';
import { MINUTES_RULES } from '../config.mjs';

function availabilityFactor(p){
  if(['i','u','s','n'].includes(p.status)) return 0;
  if(p.status === 'd') return clamp((p.chance_of_playing_next_round ?? 50)/100, 0, 1);
  return 1;
}

function completedTeamMatches(team){
  return (S.fixtures || []).filter(f => f.finished && (f.team_h === team || f.team_a === team)).length;
}

function aggregateMinutes(p, teamMatches){
  const t = Math.max(0, teamMatches);
  if(!t) return null;
  const expMin = clamp(num(p.minutes) / t, 0, 90);
  const pStart = clamp(num(p.starts) / t, 0, 1);
  const pAppear = clamp(Math.max(pStart, expMin / 28), 0, .98);
  const p60 = clamp(Math.min(pAppear, (expMin - 18) / 55), 0, .97);
  return {pStart,pAppear,p60,expMin};
}

function weightedRate(rows, key, fallback, prior){
  const decay = MINUTES_RULES.recencyDecay;
  let weighted = 0, weight = 0;
  rows.forEach((row, idx) => {
    const w = Math.pow(decay, idx);
    if(row[key] === null || row[key] === undefined) return;
    weighted += w * row[key]; weight += w;
  });
  return (weighted + prior * fallback) / Math.max(1e-9, weight + prior);
}

function roleStability(rows){
  if(rows.length < 2) return 0.5;
  const starts = rows.filter(r => r.started !== null).map(r => r.started);
  if(starts.length < 2) return 0.5;
  const mean = starts.reduce((a,b)=>a+b,0)/starts.length;
  const variance = starts.reduce((a,b)=>a + Math.pow(b-mean,2),0)/starts.length;
  return clamp(1 - variance * 4, 0, 1);
}

function minutesEstimate(p){
  const avail = availabilityFactor(p);
  if(avail === 0) return {pStart:0,pAppear:0,p60:0,expMin:0,confidence:0.35,confidenceLabel:'Low',source:'availability'};

  const teamMatches = completedTeamMatches(p.team);
  const aggregate = aggregateMinutes(p, teamMatches);
  const rawHistory = Array.isArray(S.minuteHistory?.[p.id]) ? S.minuteHistory[p.id] : [];
  const rows = rawHistory.slice().sort((a,b) => {
    const ak = Date.parse(a.kickoff_time || '') || num(a.round) * 1e6 + num(a.fixture);
    const bk = Date.parse(b.kickoff_time || '') || num(b.round) * 1e6 + num(b.fixture);
    return bk - ak;
  }).slice(0, MINUTES_RULES.historyWindow).map(r => ({
    minutes:clamp(num(r.minutes),0,90),
    appeared:num(r.minutes) > 0 ? 1 : 0,
    sixty:num(r.minutes) >= 60 ? 1 : 0,
    started:r.starts === undefined || r.starts === null ? null : (num(r.starts) > 0 ? 1 : 0),
    kickoff_time:r.kickoff_time,
    round:r.round,
    fixture:r.fixture
  }));

  if(!aggregate && !rows.length){
    const q = MINUTES_RULES.prior;
    return {pStart:q.pStart*avail,pAppear:q.pAppear*avail,p60:q.p60*avail,expMin:q.expMin*avail,
      confidence:q.confidence,confidenceLabel:'Low',source:'prior'};
  }

  const base = aggregate || MINUTES_RULES.prior;
  const prior = MINUTES_RULES.priorMatches;
  let pStart = weightedRate(rows, 'started', base.pStart, prior);
  let pAppear = weightedRate(rows, 'appeared', base.pAppear, prior);
  let p60 = weightedRate(rows, 'sixty', base.p60, prior);
  let expMin = weightedRate(rows, 'minutes', base.expMin, prior);
  pAppear = Math.max(pAppear, pStart);
  p60 = Math.min(p60, pAppear);

  const coverage = clamp(rows.length / MINUTES_RULES.historyWindow, 0, 1);
  const detail = rows.length ? 1 : aggregate ? 0.55 : 0.25;
  const newest = rows[0]?.kickoff_time ? Date.parse(rows[0].kickoff_time) : NaN;
  const freshness = Number.isFinite(newest) ? clamp(1 - (Date.now()-newest)/(28*24*60*60*1000),0,1) : (rows.length ? 0.5 : 0.25);
  let confidence = clamp(0.40*coverage + 0.20*freshness + 0.25*detail + 0.15*roleStability(rows),0,1);
  const returning = rows.length >= 2 && rows[0].minutes > 0 && rows[0].minutes < 45 && rows.slice(1,3).some(r => r.minutes === 0);
  if(returning) confidence = Math.min(confidence, 0.74);

  pStart = clamp(pStart * avail,0,1);
  pAppear = clamp(pAppear * avail,0,1);
  p60 = clamp(p60 * avail,0,pAppear);
  expMin = clamp(expMin * avail,0,90);
  const confidenceLabel = confidence >= MINUTES_RULES.confidence.high ? 'High' : confidence >= MINUTES_RULES.confidence.medium ? 'Medium' : 'Low';
  return {pStart,pAppear,p60,expMin,confidence,confidenceLabel,source:rows.length?'detailed':aggregate?'aggregate':'prior'};
}

function expectedMinutes(p){ return S.seasonLive ? minutesEstimate(p).expMin : null; }

export { availabilityFactor, completedTeamMatches, aggregateMinutes, minutesEstimate, expectedMinutes };
