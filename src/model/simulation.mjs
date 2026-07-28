import { S } from '../state.mjs';
import { clamp, num } from '../util.mjs';
import { FPL_RULES, SIMULATION_RULES } from '../config.mjs';
import { teamFixtures } from './fixtures.mjs';
import { minutesEstimate } from './minutes.mjs';
import { playerFixtureXP } from './scoring.mjs';

function hashSeed(value){
  let h = 2166136261 >>> 0;
  const text = String(value);
  for(let i=0;i<text.length;i++){
    h ^= text.charCodeAt(i);
    h = Math.imul(h,16777619) >>> 0;
  }
  return h || 1;
}
function createSeed(...parts){ return hashSeed(parts.join('|')); }
function createRng(seed){
  let state = (num(seed) >>> 0) || 1;
  return function(){
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function poisson(lambda,rng){
  const l = Math.max(0,num(lambda));
  if(l === 0) return 0;
  if(l < 30){
    const limit = Math.exp(-l); let product = 1, k = 0;
    do { k++; product *= rng(); } while(product > limit && k < 1000);
    return k-1;
  }
  const u1 = Math.max(rng(),1e-12), u2 = rng();
  return Math.max(0,Math.round(l + Math.sqrt(l)*Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2)));
}
function bernoulli(probability,rng){ return rng() < clamp(num(probability),0,1); }
function weightedChoice(rows,rng){
  const target = rng(); let total = 0;
  for(const row of rows){ total += row.probability; if(target < total) return row; }
  return rows[rows.length-1];
}
function buildMinutesDistribution(input){
  const pStart = clamp(num(input.pStart),0,1);
  const pAppear = clamp(Math.max(pStart,num(input.pAppear)),0,1);
  const p60 = clamp(Math.min(pAppear,num(input.p60)),0,1);
  const expMin = clamp(num(input.expMin),0,90);
  const startAnd60 = Math.min(pStart,p60);
  const states = [
    {key:'dnp',probability:1-pAppear,min:0,max:0},
    {key:'subUnder60',probability:pAppear-Math.max(pStart,p60),min:1,max:59},
    {key:'sub60',probability:p60-startAnd60,min:60,max:75},
    {key:'startUnder60',probability:pStart-startAnd60,min:1,max:59},
    {key:'start60',probability:startAnd60,min:60,max:90}
  ].map(row => ({...row,probability:Math.max(0,row.probability)}));
  const active = states.filter(row => row.probability > 0);
  const minMean = active.reduce((sum,row) => sum + row.probability*row.min,0);
  const maxMean = active.reduce((sum,row) => sum + row.probability*row.max,0);
  const target = clamp(expMin,minMean,maxMean);
  const fraction = maxMean > minMean ? (target-minMean)/(maxMean-minMean) : 0;
  states.forEach(row => row.mean = row.min + (row.max-row.min)*fraction);
  return {states,pStart,pAppear,p60,expMin,targetMean:target,quality:Math.abs(target-expMin) < 1e-9 ? 'full' : 'reduced'};
}
function sampleMinutes(distribution,rng){
  const row = weightedChoice(distribution.states,rng);
  if(row.max === 0) return {state:row.key,minutes:0};
  const centre = row.mean;
  const low = Math.max(row.min,2*centre-row.max);
  const high = Math.min(row.max,2*centre-row.min);
  const minutes = low === high ? low : low + rng()*(high-low);
  return {state:row.key,minutes:Math.round(clamp(minutes,row.min,row.max))};
}
function percentile(sorted,p){
  if(!sorted.length) return 0;
  const index = (sorted.length-1)*p;
  const lo = Math.floor(index), hi = Math.ceil(index);
  if(lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi]-sorted[lo])*(index-lo);
}
function summariseSamples(samples){
  const values = samples.map(num).sort((a,b) => a-b);
  const mean = values.reduce((a,b) => a+b,0)/Math.max(1,values.length);
  const count = threshold => values.filter(v => v >= threshold).length/Math.max(1,values.length);
  return {
    mean,p10:percentile(values,0.10),p25:percentile(values,0.25),median:percentile(values,0.50),
    p75:percentile(values,0.75),p90:percentile(values,0.90),
    blankProbability:values.filter(v => v <= SIMULATION_RULES.blankMaximum).length/Math.max(1,values.length),
    returnProbability:count(SIMULATION_RULES.returnMinimum),haulProbability:count(SIMULATION_RULES.haulMinimum),
    megaHaulProbability:count(SIMULATION_RULES.megaHaulMinimum)
  };
}
function componentMeans(player,fixture){
  const expected = playerFixtureXP(player,fixture);
  return {expected,parts:expected.parts || {}};
}
function sampleBoundedBonus(mean,rng){
  const value = clamp(num(mean),0,3), lower = Math.floor(value), upper = Math.ceil(value);
  if(lower === upper) return lower;
  return rng() < value-lower ? upper : lower;
}
function simulatePlayerFixture(player,fixture,rng,options={}){
  const mins = options.minutes || minutesEstimate(player);
  const distribution = options.distribution || buildMinutesDistribution(mins);
  const sampled = sampleMinutes(distribution,rng);
  if(sampled.minutes <= 0) return {points:0,minutes:0,appeared:false,reached60:false,state:sampled.state};
  const {expected,parts} = componentMeans(player,fixture);
  const appearMean = num(parts['Appearance']);
  const baseAppearance = sampled.minutes >= 60 ? 2 : 1;
  let points = baseAppearance;
  const ratio = mins.expMin > 0 ? sampled.minutes/mins.expMin : 0;
  const goalPts = FPL_RULES.goals[player.element_type] || 4;
  points += poisson(Math.max(0,num(parts['Goals'])/goalPts)*ratio,rng)*goalPts;
  points += poisson(Math.max(0,num(parts['Assists'])/FPL_RULES.assists)*ratio,rng)*FPL_RULES.assists;
  if(parts['Clean sheet']){
    const csProb = clamp(num(parts['Clean sheet'])/Math.max(1e-9,(FPL_RULES.cleanSheets[player.element_type]||0)*Math.max(num(mins.p60),1e-9)),0,1);
    if(sampled.minutes >= 60 && bernoulli(csProb,rng)) points += FPL_RULES.cleanSheets[player.element_type] || 0;
  }
  if(parts['Goals conceded'] < 0){
    const expectedGroups = Math.abs(num(parts['Goals conceded'])/FPL_RULES.goalsConceded.pointsPerGroup);
    points += Math.floor(poisson(expectedGroups*FPL_RULES.goalsConceded.groupSize*ratio,rng)/FPL_RULES.goalsConceded.groupSize)*FPL_RULES.goalsConceded.pointsPerGroup;
  }
  if(parts['Saves'] > 0) points += Math.floor(poisson(num(parts['Saves'])*FPL_RULES.saves.groupSize*ratio,rng)/FPL_RULES.saves.groupSize)*FPL_RULES.saves.pointsPerGroup;
  if(parts['Defensive contributions'] > 0){
    const probability = clamp(num(parts['Defensive contributions'])/FPL_RULES.defensiveContribution.points,0,1);
    if(bernoulli(probability,rng)) points += FPL_RULES.defensiveContribution.points;
  }
  points += sampleBoundedBonus(num(parts['Bonus'])/Math.max(num(mins.pAppear),1e-9),rng);
  const rare = ['Yellow cards','Red cards','Own goals','Penalty misses','Penalty saves'];
  rare.forEach(key => {
    const mean = num(parts[key]); if(!mean) return;
    const unit = key === 'Yellow cards' ? FPL_RULES.cards.yellow : key === 'Red cards' ? FPL_RULES.cards.red : key === 'Own goals' ? FPL_RULES.ownGoal : key === 'Penalty misses' ? FPL_RULES.penaltyMiss : FPL_RULES.penaltySave;
    const probability = clamp(Math.abs(mean/unit)*ratio,0,1);
    if(bernoulli(probability,rng)) points += unit;
  });
  const expectedOther = Math.max(0,num(expected.total)-appearMean-Object.entries(parts).filter(([key]) => ['Goals','Assists','Clean sheet','Goals conceded','Saves','Defensive contributions','Bonus','Yellow cards','Red cards','Own goals','Penalty misses','Penalty saves','Appearance'].includes(key)).reduce((sum,[,value]) => sum+num(value),0));
  points += expectedOther;
  return {points,minutes:sampled.minutes,appeared:true,reached60:sampled.minutes>=60,state:sampled.state,quality:distribution.quality};
}
function simulatePlayerGameweek(player,gw,options={}){
  const sampleCount = clamp(Math.floor(num(options.samples)||SIMULATION_RULES.productionSamples),1,SIMULATION_RULES.maxSamples);
  if(!S.seasonLive) return {available:false,reason:'pre-season',samples:[],appearanceSamples:[],quality:'baseline-only'};
  const fixtures = teamFixtures(player.team,gw,1).flat();
  if(!fixtures.length){
    const zeroes=Array(sampleCount).fill(0), appearances=Array(sampleCount).fill(false);
    return {available:true,samples:zeroes,appearanceSamples:appearances,quality:'full',...summariseSamples(zeroes)};
  }
  const seed = options.seed ?? createSeed(SIMULATION_RULES.version,player.id,gw,sampleCount,fixtures.map(f => f.fixture?.id || `${f.fixture?.team_h}-${f.fixture?.team_a}`).join(','));
  const rng = createRng(seed), mins = minutesEstimate(player), distribution = buildMinutesDistribution(mins), samples=[], appearanceSamples=[];
  for(let i=0;i<sampleCount;i++){
    let total = 0, appeared = false;
    for(const fixture of fixtures){
      const outcome=simulatePlayerFixture(player,fixture,rng,{minutes:mins,distribution});
      total += outcome.points;
      appeared = appeared || outcome.appeared;
    }
    samples.push(total);
    appearanceSamples.push(appeared);
  }
  return {available:true,samples,appearanceSamples,seed,quality:distribution.quality,appearanceProbability:mins.pAppear,sixtyProbability:mins.p60,...summariseSamples(samples)};
}

export { hashSeed, createSeed, createRng, poisson, bernoulli, buildMinutesDistribution, sampleMinutes, percentile, summariseSamples, simulatePlayerFixture, simulatePlayerGameweek };
