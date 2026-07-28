import { clamp, num } from '../util.mjs';
import { SIMULATION_RULES } from '../config.mjs';
import { createSeed, createRng, simulatePlayerGameweek, summariseSamples } from './simulation.mjs';

function formationCounts(entries){
  const counts={1:0,2:0,3:0,4:0};
  entries.forEach(entry => { if(entry?.p?.element_type) counts[entry.p.element_type]++; });
  return counts;
}
function legalXI(entries){
  const c=formationCounts(entries);
  return entries.length===11 && c[1]===1 && c[2]>=3 && c[3]>=2 && c[4]>=1;
}
function applyAutosubs(starters,bench,outcomes){
  const active=starters.slice();
  const used=[];
  const goalkeeperIndex=active.findIndex(entry => entry.p.element_type===1 && !outcomes.get(entry.p.id)?.appeared);
  if(goalkeeperIndex>=0){
    const reserve=bench.find(entry => entry.p.element_type===1 && outcomes.get(entry.p.id)?.appeared);
    if(reserve){ used.push(reserve); active[goalkeeperIndex]=reserve; }
  }
  const missing=()=>active.map((entry,index)=>({entry,index})).filter(row => row.entry.p.element_type!==1 && !outcomes.get(row.entry.p.id)?.appeared);
  for(const substitute of bench.filter(entry => entry.p.element_type!==1)){
    if(used.length>=4 || !outcomes.get(substitute.p.id)?.appeared) continue;
    const candidates=missing();
    let replaced=false;
    for(const candidate of candidates){
      const trial=active.slice(); trial[candidate.index]=substitute;
      if(legalXI(trial)){ active[candidate.index]=substitute; used.push(substitute); replaced=true; break; }
    }
    if(replaced && !missing().length) break;
  }
  return {scoringXI:active.filter(entry => outcomes.get(entry.p.id)?.appeared),used};
}
function applyCaptainFallback(captainId,viceCaptainId,outcomes){
  if(outcomes.get(captainId)?.appeared) return captainId;
  if(outcomes.get(viceCaptainId)?.appeared) return viceCaptainId;
  return null;
}
function simulateSquadGameweek(input){
  const samples=clamp(Math.floor(num(input.samples)||SIMULATION_RULES.productionSamples),1,SIMULATION_RULES.maxSamples);
  const starters=input.starters||[], bench=input.bench||[];
  const all=[...starters,...bench];
  if(all.length!==15 || starters.length!==11 || !legalXI(starters)) return {available:false,reason:'invalid-squad'};
  const seed=input.seed??createSeed(SIMULATION_RULES.version,input.gw,samples,all.map(x=>x.p.id).join(','),input.captainId,input.viceCaptainId);
  const playerResults=new Map();
  all.forEach(entry => playerResults.set(entry.p.id,simulatePlayerGameweek(entry.p,input.gw,{samples,seed:createSeed(seed,entry.p.id)})));
  if([...playerResults.values()].some(result=>!result.available)) return {available:false,reason:'pre-season',quality:'baseline-only'};
  const totals=[], autosubTotals=[], viceTakeovers=[];
  for(let i=0;i<samples;i++){
    const outcomes=new Map();
    all.forEach(entry => {
      const points=playerResults.get(entry.p.id).samples[i];
      outcomes.set(entry.p.id,{points,appeared:points!==0 || playerResults.get(entry.p.id).appearanceProbability===1});
    });
    const applied=applyAutosubs(starters,bench,outcomes);
    let total=applied.scoringXI.reduce((sum,entry)=>sum+num(outcomes.get(entry.p.id)?.points),0);
    const base=starters.filter(entry=>outcomes.get(entry.p.id)?.appeared).reduce((sum,entry)=>sum+num(outcomes.get(entry.p.id)?.points),0);
    const armband=applyCaptainFallback(input.captainId,input.viceCaptainId,outcomes);
    if(armband) total+=num(outcomes.get(armband)?.points);
    totals.push(total); autosubTotals.push(total-base-(armband?num(outcomes.get(armband)?.points):0));
    viceTakeovers.push(armband===input.viceCaptainId?1:0);
  }
  return {available:true,seed,samples:totals,expectedAutoSubPoints:autosubTotals.reduce((a,b)=>a+b,0)/samples,viceTakeoverProbability:viceTakeovers.reduce((a,b)=>a+b,0)/samples,...summariseSamples(totals)};
}
function compareCaptains(input,candidateIds){
  return candidateIds.map(captainId=>({captainId,...simulateSquadGameweek({...input,captainId})}));
}
export { formationCounts, legalXI, applyAutosubs, applyCaptainFallback, simulateSquadGameweek, compareCaptains };
