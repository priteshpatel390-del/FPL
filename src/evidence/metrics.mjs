import {
  canonicalise, stableStringify, sha256Hex, deepFreeze, assertEvidenceSafe
} from './snapshot.mjs';

const METRIC_SCHEMA_VERSION='1.0.0';
const METRIC_VERSION='1.0.0';
const SEGMENTATION_VERSION='1.0.0';
const TRANSFER_METRIC_SCHEMA_VERSION='1.0.0';
const METRIC_RULES=Object.freeze({
  errorBands:Object.freeze([0,2,5,10,Infinity]),
  reliabilityBins:Object.freeze([0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1]),
  uncertainty:Object.freeze({blankMaximum:2,returnMinimum:5,haulMinimum:10,megaHaulMinimum:15}),
  samples:Object.freeze({rawMaximum:29,descriptiveMaximum:199,stableMinimum:200,stableGameweeks:10,probabilityBinMinimum:30,probabilityPreferred:500,decisionMinimum:10,providerMinimumGameweeks:5,providerMinimumObservations:100}),
  localIndexLimit:80,
  supersededFullLimit:6,
  maxEncodedBytes:3*1024*1024
});

function finite(value){ const n=Number(value); return Number.isFinite(n)?n:null; }
function mean(values){ return values.length?values.reduce((a,b)=>a+b,0)/values.length:null; }
function sameArray(a,b){ return a.length===b.length&&a.every((value,index)=>value===b[index]); }
function sortedNumbers(values){ return [...new Set((values||[]).map(Number).filter(Number.isFinite))].sort((a,b)=>a-b); }
function setEqual(a,b){ return sameArray(sortedNumbers(a),sortedNumbers(b)); }
function roundMetric(value){ return Number.isFinite(value)?Number(value.toFixed(8)):null; }
function positionLabel(position){ return ({1:'GKP',2:'DEF',3:'MID',4:'FWD'})[Number(position)]||'Unknown'; }
function seasonPeriod(gameweek){ const gw=Number(gameweek); return gw<1?'pre-season':gw<=6?'early':gw<=12?'transition':'mature'; }
function priceBand(position,nowCost){
  const price=Number(nowCost)/10, pos=Number(position);
  if(!Number.isFinite(price)) return 'unknown';
  if(pos===1||pos===2) return price<=4.4?'up_to_4.4':price<=5.4?'4.5_to_5.4':'5.5_plus';
  if(pos===3) return price<=5.4?'up_to_5.4':price<=7.4?'5.5_to_7.4':price<=9.9?'7.5_to_9.9':'10.0_plus';
  if(pos===4) return price<=5.4?'up_to_5.4':price<=7.4?'5.5_to_7.4':price<=9.4?'7.5_to_9.4':'9.5_plus';
  return 'unknown';
}
function availabilityLabel(status){
  const value=String(status||'');
  if(['i','u','s','n'].includes(value)) return 'unavailable';
  if(value==='d') return 'doubtful';
  if(value==='a') return 'available';
  return 'unknown';
}
function errorBand(error){
  const value=Math.abs(Number(error));
  if(value===0) return 'exact';
  if(value<=2) return 'small';
  if(value<=5) return 'material';
  if(value<=10) return 'large';
  return 'very_large';
}
function pearson(xs,ys){
  if(xs.length!==ys.length||xs.length<3) return null;
  const mx=mean(xs),my=mean(ys); let sxy=0,sxx=0,syy=0;
  for(let i=0;i<xs.length;i++){ const dx=xs[i]-mx,dy=ys[i]-my; sxy+=dx*dy;sxx+=dx*dx;syy+=dy*dy; }
  return sxx&&syy?roundMetric(sxy/Math.sqrt(sxx*syy)):null;
}
function averageRanks(values){
  const indexed=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value||a.index-b.index),ranks=Array(values.length);
  for(let i=0;i<indexed.length;){
    let j=i+1; while(j<indexed.length&&indexed[j].value===indexed[i].value) j++;
    const rank=(i+1+j)/2; for(let k=i;k<j;k++) ranks[indexed[k].index]=rank; i=j;
  }
  return ranks;
}
function spearman(xs,ys){ return xs.length===ys.length&&xs.length>=3?pearson(averageRanks(xs),averageRanks(ys)):null; }
function metricSummary(rows,predictedKey='predicted',observedKey='observed'){
  const clean=(rows||[]).map(row=>({predicted:finite(row?.[predictedKey]),observed:finite(row?.[observedKey])})).filter(row=>row.predicted!==null&&row.observed!==null);
  if(!clean.length) return {n:0,mae:null,rmse:null,bias:null,pearson:null,spearman:null,predictedMean:null,observedMean:null,within15:null,within30:null};
  const errors=clean.map(row=>row.predicted-row.observed),xs=clean.map(row=>row.predicted),ys=clean.map(row=>row.observed);
  return canonicalise({
    n:clean.length,
    mae:roundMetric(mean(errors.map(Math.abs))),
    rmse:roundMetric(Math.sqrt(mean(errors.map(value=>value*value)))),
    bias:roundMetric(mean(errors)),
    pearson:pearson(xs,ys),spearman:spearman(xs,ys),
    predictedMean:roundMetric(mean(xs)),observedMean:roundMetric(mean(ys)),
    within15:roundMetric(mean(errors.map(value=>Math.abs(value)<=15?1:0))),
    within30:roundMetric(mean(errors.map(value=>Math.abs(value)<=30?1:0)))
  });
}
function brierScore(rows,probabilityKey='probability',outcomeKey='outcome'){
  const clean=(rows||[]).map(row=>({probability:finite(row?.[probabilityKey]),outcome:finite(row?.[outcomeKey])})).filter(row=>row.probability!==null&&row.probability>=0&&row.probability<=1&&(row.outcome===0||row.outcome===1));
  if(!clean.length) return {n:0,brier:null,predictedRate:null,observedRate:null,gap:null};
  const errors=clean.map(row=>(row.probability-row.outcome)**2),predictedRate=mean(clean.map(row=>row.probability)),observedRate=mean(clean.map(row=>row.outcome));
  return canonicalise({n:clean.length,brier:roundMetric(mean(errors)),predictedRate:roundMetric(predictedRate),observedRate:roundMetric(observedRate),gap:roundMetric(predictedRate-observedRate)});
}
function reliabilityBins(rows,probabilityKey='probability',outcomeKey='outcome'){
  const clean=(rows||[]).map(row=>({probability:finite(row?.[probabilityKey]),outcome:finite(row?.[outcomeKey])})).filter(row=>row.probability!==null&&row.probability>=0&&row.probability<=1&&(row.outcome===0||row.outcome===1));
  const edges=METRIC_RULES.reliabilityBins;
  return edges.slice(0,-1).map((lower,index)=>{
    const upper=edges[index+1],last=index===edges.length-2;
    const bin=clean.filter(row=>row.probability>=lower&&(last?row.probability<=upper:row.probability<upper));
    const predicted=mean(bin.map(row=>row.probability)),observed=mean(bin.map(row=>row.outcome));
    return canonicalise({lower,upper,inclusiveUpper:last,n:bin.length,eventCount:bin.reduce((sum,row)=>sum+row.outcome,0),meanPredicted:roundMetric(predicted),observedFrequency:bin.length>=METRIC_RULES.samples.probabilityBinMinimum?roundMetric(observed):null,gap:bin.length>=METRIC_RULES.samples.probabilityBinMinimum?roundMetric(predicted-observed):null,display:bin.length>=METRIC_RULES.samples.probabilityBinMinimum?'descriptive':'insufficient'});
  });
}
function intervalSummary(rows,lowerKey,upperKey,observedKey='observed'){
  const clean=(rows||[]).map(row=>({lower:finite(row?.[lowerKey]),upper:finite(row?.[upperKey]),observed:finite(row?.[observedKey])})).filter(row=>row.lower!==null&&row.upper!==null&&row.observed!==null&&row.lower<=row.upper);
  return canonicalise({n:clean.length,coverage:clean.length?roundMetric(mean(clean.map(row=>row.observed>=row.lower&&row.observed<=row.upper?1:0))):null,width:clean.length?roundMetric(mean(clean.map(row=>row.upper-row.lower))):null});
}
function sampleStatus(observationCount,gameweekCount,{kind='general'}={}){
  const n=Math.max(0,Number(observationCount)||0),gws=Math.max(0,Number(gameweekCount)||0),rules=METRIC_RULES.samples;
  if(kind==='decision') return canonicalise({level:n<rules.decisionMinimum?'raw_only':'descriptive',message:n<rules.decisionMinimum?'Fewer than ten relevant decisions — individual records only.':'Descriptive decision sample — no significance claim.'});
  if(kind==='provider'){
    const ready=n>=rules.providerMinimumObservations&&gws>=rules.providerMinimumGameweeks;
    return canonicalise({level:ready?'descriptive':'raw_only',message:ready?'Descriptive provider-state sample — observational, not causal.':'Provider comparison needs at least 100 observations across five affected Gameweeks.'});
  }
  if(n<30) return canonicalise({level:'raw_only',message:'Very small sample — values are recorded but should not be interpreted.'});
  if(n<rules.stableMinimum||gws<rules.stableGameweeks) return canonicalise({level:'descriptive',message:'Descriptive sample — results may move substantially as more Gameweeks are added.'});
  return canonicalise({level:'potentially_stable',message:'Potentially stable descriptive sample — not a formal validation or significance claim.'});
}
function fixtureStat(detail,identifier){ return finite(detail?.officialStats?.find(row=>row.identifier===identifier)?.value); }
function fixturesForClub(fixtures,clubId,gameweek){
  return (fixtures||[]).filter(row=>Number(row.event)===Number(gameweek)&&(Number(row.team_h)===Number(clubId)||Number(row.team_a)===Number(clubId))).sort((a,b)=>Number(a.id)-Number(b.id));
}
function outcomeFixturesForClub(fixtures,clubId){
  return (fixtures||[]).filter(row=>Number(row.homeTeamId)===Number(clubId)||Number(row.awayTeamId)===Number(clubId)).sort((a,b)=>Number(a.fixtureId)-Number(b.fixtureId));
}
function fixtureContext(frozenFixtures,clubId){
  if(!frozenFixtures.length) return {fixtureClass:'blank',homeAway:'blank',fdrContext:'blank',fixtureIds:[]};
  const venues=frozenFixtures.map(row=>Number(row.team_h)===Number(clubId)?'home':'away');
  const fdr=frozenFixtures.map(row=>Number(row.team_h)===Number(clubId)?row.team_h_difficulty:row.team_a_difficulty);
  return {fixtureClass:frozenFixtures.length===1?'single':'double',homeAway:new Set(venues).size===1?venues[0]:'mixed',fdrContext:fdr.map(value=>value==null?'?':String(value)).join('+'),fixtureIds:frozenFixtures.map(row=>Number(row.id))};
}
function observedRole(outcome){
  if(!outcome||Number(outcome.minutes)<=0) return 'dnp';
  const starts=finite(outcome.starts);
  if(starts===null) return 'appeared_unknown_start';
  const fixtures=Math.max(1,(outcome.perFixture||[]).length);
  if(starts>=fixtures) return fixtures>1?'all_started':'started';
  if(starts>0) return 'mixed';
  return 'substitute_only';
}
function allocateMinuteFixtures(prediction,outcome,frozenFixtures,finalFixtures){
  const details=new Map((outcome?.perFixture||[]).map(row=>[Number(row.fixtureId),row]));
  const totalMinutes=finite(outcome?.minutes),totalStarts=finite(outcome?.starts),frozenIds=frozenFixtures.map(row=>Number(row.id));
  const alignedIds=new Set(finalFixtures.map(row=>Number(row.fixtureId)));
  const knownMinutes=frozenIds.map(id=>fixtureStat(details.get(id),'minutes'));
  const knownStarts=frozenIds.map(id=>fixtureStat(details.get(id),'starts'));
  const minuteKnownSum=knownMinutes.filter(value=>value!==null).reduce((a,b)=>a+b,0),startKnownSum=knownStarts.filter(value=>value!==null).reduce((a,b)=>a+b,0);
  const missingMinuteIndexes=knownMinutes.map((value,index)=>value===null?index:-1).filter(index=>index>=0),missingStartIndexes=knownStarts.map((value,index)=>value===null?index:-1).filter(index=>index>=0);
  if(frozenIds.length===1&&knownMinutes[0]===null&&totalMinutes!==null) knownMinutes[0]=totalMinutes;
  else if(totalMinutes!==null&&missingMinuteIndexes.length&&minuteKnownSum===totalMinutes) missingMinuteIndexes.forEach(index=>knownMinutes[index]=0);
  if(frozenIds.length===1&&knownStarts[0]===null&&totalStarts!==null) knownStarts[0]=totalStarts;
  else if(totalStarts!==null&&missingStartIndexes.length&&startKnownSum===totalStarts) missingStartIndexes.forEach(index=>knownStarts[index]=0);
  return frozenFixtures.map((fixture,index)=>{
    const fixtureId=Number(fixture.id),scheduleAligned=alignedIds.has(fixtureId),minutes=knownMinutes[index];
    const observedMinutes=minutes===null&&!scheduleAligned?0:minutes;
    const starts=knownStarts[index]===null&&!scheduleAligned&&totalStarts!==null?0:knownStarts[index];
    const validMinutes=observedMinutes!==null&&observedMinutes>=0&&observedMinutes<=90;
    return canonicalise({
      playerId:Number(prediction.playerId),fixtureId,scheduleAligned,
      predictedMinutes:finite(prediction.minutes?.expMin),observedMinutes:validMinutes?observedMinutes:null,
      pStart:finite(prediction.minutes?.pStart),started:starts===null?null:starts>0?1:0,
      pAppear:finite(prediction.minutes?.pAppear),appeared:validMinutes?(observedMinutes>0?1:0):null,
      p60:finite(prediction.minutes?.p60),reachedSixty:validMinutes?(observedMinutes>=60?1:0):null,
      allocation:details.has(fixtureId)?'official_per_fixture':observedMinutes!==null?'reconciled_or_single':'unallocatable'
    });
  });
}
function formationCounts(ids,positions){
  const counts={1:0,2:0,3:0,4:0}; (ids||[]).forEach(id=>{ const position=Number(positions.get(Number(id))); if(counts[position]!==undefined) counts[position]++; }); return counts;
}
function legalXIIds(ids,positions){ const c=formationCounts(ids,positions); return ids.length===11&&c[1]===1&&c[2]>=3&&c[3]>=2&&c[4]>=1; }
function combinations(values,size,start=0,chosen=[],out=[]){
  if(chosen.length===size){ out.push(chosen.slice()); return out; }
  for(let i=start;i<=values.length-(size-chosen.length);i++){ chosen.push(values[i]);combinations(values,size,i+1,chosen,out);chosen.pop(); }
  return out;
}
function enumerateLegalXIs(squadIds,positions){ return combinations(sortedNumbers(squadIds),11).filter(ids=>legalXIIds(ids,positions)); }
function benchOrderForXI(squadIds,xiIds,positions,scoreById){
  const selected=new Set(xiIds.map(Number)),bench=squadIds.filter(id=>!selected.has(Number(id)));
  const goalkeeper=bench.filter(id=>Number(positions.get(Number(id)))===1).sort((a,b)=>a-b);
  const outfield=bench.filter(id=>Number(positions.get(Number(id)))!==1).sort((a,b)=>(Number(scoreById.get(Number(b)))||0)-(Number(scoreById.get(Number(a)))||0)||Number(a)-Number(b));
  return [...goalkeeper,...outfield];
}
function applyRealisedAutosubs(starterIds,benchIds,positions,outcomeById){
  const active=starterIds.map(Number),used=[],replacements=[];
  const appeared=id=>Boolean(outcomeById.get(Number(id))?.appeared),missingOutfield=()=>active.map((id,index)=>({id,index})).filter(row=>Number(positions.get(row.id))!==1&&!appeared(row.id));
  const goalkeeperIndex=active.findIndex(id=>Number(positions.get(id))===1&&!appeared(id));
  if(goalkeeperIndex>=0){ const reserve=benchIds.map(Number).find(id=>Number(positions.get(id))===1&&appeared(id)); if(reserve!=null){ replacements.push({playerOut:active[goalkeeperIndex],playerIn:reserve});active[goalkeeperIndex]=reserve;used.push(reserve); } }
  for(const substitute of benchIds.map(Number).filter(id=>Number(positions.get(id))!==1)){
    if(!appeared(substitute)||used.includes(substitute)) continue;
    for(const candidate of missingOutfield()){
      const trial=active.slice();trial[candidate.index]=substitute;
      if(legalXIIds(trial,positions)){ replacements.push({playerOut:candidate.id,playerIn:substitute});active[candidate.index]=substitute;used.push(substitute);break; }
    }
  }
  const scoringXI=active.filter(appeared),basePoints=scoringXI.reduce((sum,id)=>sum+(finite(outcomeById.get(id)?.points)||0),0);
  return canonicalise({scoringXI,usedBenchIds:used,replacements,basePoints,autoSubContribution:used.reduce((sum,id)=>sum+(finite(outcomeById.get(id)?.points)||0),0)});
}
function captainPairScore(captainId,viceId,outcomeById){
  const captain=outcomeById.get(Number(captainId)),vice=outcomeById.get(Number(viceId));
  const effective=captain?.appeared?Number(captainId):vice?.appeared?Number(viceId):null;
  return canonicalise({captainId:Number(captainId)||null,viceId:Number(viceId)||null,effectiveCaptainId:effective,viceTookOver:effective===Number(viceId),doubledContribution:effective==null?0:finite(outcomeById.get(effective)?.points)||0});
}
function managerDecisionEvaluation(managerOutcome,playerRows,positions){
  if(!managerOutcome||managerOutcome.status==='not_available'||!Array.isArray(managerOutcome.picks)||managerOutcome.picks.length!==15)
    return canonicalise({status:'not_available',reason:managerOutcome?.reason||'public_manager_outcome_unavailable'});
  const points=new Map(playerRows.map(row=>[Number(row.playerId),Number(row.observedPoints)||0])),appeared=new Map(playerRows.map(row=>[Number(row.playerId),Boolean(row.appeared)]));
  const picks=managerOutcome.picks.slice().sort((a,b)=>Number(a.position)-Number(b.position)||Number(a.playerId)-Number(b.playerId));
  const starters=picks.filter(row=>Number(row.position)<=11).map(row=>Number(row.playerId)),bench=picks.filter(row=>Number(row.position)>11).map(row=>Number(row.playerId));
  const outcomeById=new Map(picks.map(row=>[Number(row.playerId),{points:points.get(Number(row.playerId))||0,appeared:appeared.get(Number(row.playerId))||false}]));
  const reconstructed=applyRealisedAutosubs(starters,bench,positions,outcomeById),officialSubs=(managerOutcome.automaticSubstitutions||[]).map(row=>({playerOut:Number(row.playerOut),playerIn:Number(row.playerIn)}));
  const officialPairs=officialSubs.map(row=>`${row.playerOut}>${row.playerIn}`).sort(),reconstructedPairs=reconstructed.replacements.map(row=>`${row.playerOut}>${row.playerIn}`).sort();
  const multiplierXI=picks.filter(row=>Number(row.multiplier)>0).map(row=>Number(row.playerId)),legal=legalXIIds(multiplierXI,positions),captain=managerOutcome.captain,vice=managerOutcome.viceCaptain;
  return canonicalise({status:legal&&sameArray(officialPairs,reconstructedPairs)?'available':'partial',legalRealisedXI:legal,startingXIPlayerIds:starters,benchOrder:bench,officialScoringPlayerIds:multiplierXI,reconstructedScoringPlayerIds:reconstructed.scoringXI,officialAutomaticSubstitutions:officialSubs,reconstructedAutomaticSubstitutions:reconstructed.replacements,automaticSubstitutionAgreement:sameArray(officialPairs,reconstructedPairs),reconstructedBasePoints:reconstructed.basePoints,officialGameweekPoints:managerOutcome.officialGameweekPoints,officialPointsOnBench:managerOutcome.officialPointsOnBench,activeChip:managerOutcome.activeChip,captain:captain||null,viceCaptain:vice||null,transferCount:managerOutcome.eventTransferCount,transferCost:managerOutcome.eventTransferCost,reconstruction:managerOutcome.reconstruction||null});
}
function decisionEvaluation(snapshot,playerRows){
  const squad=snapshot.outputs?.squad;
  if(squad?.status!=='available'||!squad.modelDecision) return canonicalise({status:'not_available',reason:'complete_frozen_squad_unavailable',squad:null,captaincy:null,bench:null,managerOutcome:null,transferBasis:null});
  const allPredictions=new Map((snapshot.outputs?.players||[]).map(row=>[Number(row.playerId),row]);
  const outcomeById=new Map(playerRows.map(row=>[Number(row.playerId),{points:row.observedPoints,appeared:row.appeared}]));
  const positions=new Map((snapshot.outputs?.players||[]).map(row=>[Number(row.playerId),Number(row.position)]));
  const squadIds=squad.players.map(row=>Number(row.playerId)),starters=squad.modelDecision.bestXIPlayerIds.map(Number),bench=squad.modelDecision.benchPlayerIds.map(Number);
  const selected=applyRealisedAutosubs(starters,bench,positions,outcomeById);
  const legalXIs=enumerateLegalXIs(squadIds,positions),predictedScore=id=>finite(allPredictions.get(Number(id))?.nextGameweek?.total)||0;
  const alternatives=legalXIs.map(ids=>{
    const scoreById=new Map(squadIds.map(id=>[id,predictedScore(id)])),orderedBench=benchOrderForXI(squadIds,ids,positions,scoreById),realised=applyRealisedAutosubs(ids,orderedBench,positions,outcomeById);
    return {playerIds:ids,formation:Object.values(formationCounts(ids,positions)).slice(1).join('-'),predictedPoints:roundMetric(ids.reduce((sum,id)=>sum+predictedScore(id),0)),realisedPoints:realised.basePoints,benchPlayerIds:orderedBench};
  }).sort((a,b)=>b.predictedPoints-a.predictedPoints||a.playerIds.join(',').localeCompare(b.playerIds.join(',')));
  const selectedKey=sortedNumbers(starters).join(','),realisedOrder=alternatives.slice().sort((a,b)=>b.realisedPoints-a.realisedPoints||a.playerIds.join(',').localeCompare(b.playerIds.join(','))),selectedRank=Math.max(0,realisedOrder.findIndex(row=>row.playerIds.join(',')===selectedKey))+1;
  const oracle=realisedOrder[0]||null;
  const rankedCandidates=starters.slice().sort((a,b)=>predictedScore(b)-predictedScore(a)||a-b),captainId=Number(squad.modelDecision.captainId),viceId=Number(squad.modelDecision.viceCaptainId);
  const selectedPair=captainPairScore(captainId,viceId,outcomeById),vicePair=captainPairScore(viceId,captainId,outcomeById);
  const candidateRows=rankedCandidates.map(id=>{ const alternateVice=rankedCandidates.find(other=>other!==id)??null; return {...captainPairScore(id,alternateVice,outcomeById),frozenRank:rankedCandidates.indexOf(id)+1,predictedPoints:predictedScore(id)}; });
  const unusedBench=bench.filter(id=>!selected.usedBenchIds.includes(id)),pointsLeftOnBench=unusedBench.reduce((sum,id)=>sum+(finite(outcomeById.get(id)?.points)||0),0);
  const providerPlans=squad.optimiser?.plans||[],baseline=squad.optimiser?.baseline||null,primaryPlan=providerPlans.find(plan=>Number(plan.transferCount)>0)||null;
  const transferIds=new Set([...(baseline?.finalSquadIds||[]),...providerPlans.flatMap(plan=>plan.finalSquadIds||[])]);
  const transferPlayers=[...transferIds].sort((a,b)=>a-b).map(id=>({playerId:id,position:positions.get(id)||null,perGameweek:(allPredictions.get(id)?.perGameweek||[]).map(row=>({gw:Number(row.gw),total:finite(row.total)||0}))}));
  return canonicalise({
    status:'available',
    squad:{frozenPlayerIds:sortedNumbers(squadIds),selectedXIPlayerIds:starters,selectedBenchPlayerIds:bench,selectedRealised:selected,topFrozenAlternatives:alternatives.slice(0,3),selectedRealisedRank:selectedRank,hindsightOracle:oracle?{label:'Hindsight oracle',playerIds:oracle.playerIds,formation:oracle.formation,realisedPoints:oracle.realisedPoints}:null},
    captaincy:{selected:selectedPair,selectedViceAsCaptain:vicePair,topThreeFrozenCandidates:candidateRows.slice(0,3),allFrozenCandidates:candidateRows,hindsightBest:candidateRows.slice().sort((a,b)=>b.doubledContribution-a.doubledContribution||a.captainId-b.captainId)[0]||null,userPreview:squad.userPreview||null},
    bench:{benchOrder:bench,automaticSubstitutions:selected.replacements,automaticSubstitutionContribution:selected.autoSubContribution,unusedBenchPlayerIds:unusedBench,pointsLeftOnBench},
    managerOutcome:null,
    transferBasis:squad.optimiser?{status:squad.optimiser.status,horizon:Number(squad.optimiser.horizon)||0,baseline,plans:providerPlans,primaryPlan,players:transferPlayers}:null
  });
}
function playerSegments(prediction,snapshot,squadSets,fixture,official,primaryTransfers){
  const providerStates=Object.fromEntries((snapshot.providers||[]).map(row=>[row.provider,row.state]));
  const id=Number(prediction.playerId),position=Number(prediction.position),owned=squadSets.owned.has(id),selected=squadSets.selected.has(id),bench=squadSets.bench.has(id);
  return canonicalise({
    allPlayers:'all',owned:owned?'owned':'not_owned',recommendation:selected?'selected_xi':bench?'bench':primaryTransfers.in.has(id)?'primary_transfer_in':primaryTransfers.out.has(id)?'primary_transfer_out':'other',
    position:positionLabel(position),priceBand:priceBand(position,prediction.nowCost),minutesSource:String(prediction.minutes?.source||'unknown'),minutesConfidence:String(prediction.minutes?.confidenceLabel||'Unknown'),providerStates,
    homeAway:fixture.homeAway,fdrContext:fixture.fdrContext,fixtureClass:fixture.fixtureClass,availability:availabilityLabel(prediction.status),observedRole:observedRole(official),seasonPeriod:seasonPeriod(snapshot.gameweek)
  });
}
function outcomeCoverage(predictions,outcomes,matchedRows,minuteRows){
  const predictedIds=new Set(predictions.map(row=>Number(row.playerId))),outcomeIds=new Set(outcomes.map(row=>Number(row.playerId)));
  const unmatchedPredictions=[...predictedIds].filter(id=>!outcomeIds.has(id)).sort((a,b)=>a-b),unmatchedOutcomes=[...outcomeIds].filter(id=>!predictedIds.has(id)).sort((a,b)=>a-b);
  return canonicalise({eligiblePredictions:predictions.length,officialOutcomes:outcomes.length,matchedPlayers:matchedRows.length,coverage:predictions.length?roundMetric(matchedRows.length/predictions.length):null,unmatchedPredictions,unmatchedOutcomes,minuteFixtureRows:minuteRows.length,unallocatableMinuteRows:minuteRows.filter(row=>row.observedMinutes===null).length,startLabelRows:minuteRows.filter(row=>row.started!==null).length,uncertaintyRows:matchedRows.filter(row=>row.uncertainty?.available).length,scheduleAlignedPlayers:matchedRows.filter(row=>row.scheduleAligned).length});
}
function playerReport(rows){
  const summary=metricSummary(rows,'predictedPoints','observedPoints');
  const bands={exact:0,small:0,material:0,large:0,very_large:0}; rows.forEach(row=>{ if(bands[row.errorBand]!==undefined) bands[row.errorBand]++; });
  return canonicalise({...summary,errorBands:bands,withinTwo:rows.length?roundMetric(mean(rows.map(row=>row.absError<=2?1:0))):null,withinFive:rows.length?roundMetric(mean(rows.map(row=>row.absError<=5?1:0))):null});
}
function minutesReport(rows){
  const usable=rows.filter(row=>row.observedMinutes!==null),started=rows.filter(row=>row.started!==null).map(row=>({probability:row.pStart,outcome:row.started})),appeared=rows.filter(row=>row.appeared!==null).map(row=>({probability:row.pAppear,outcome:row.appeared})),sixty=rows.filter(row=>row.reachedSixty!==null).map(row=>({probability:row.p60,outcome:row.reachedSixty}));
  return canonicalise({continuous:metricSummary(usable,'predictedMinutes','observedMinutes'),start:{...brierScore(started),reliability:reliabilityBins(started)},appearance:{...brierScore(appeared),reliability:reliabilityBins(appeared)},sixty:{...brierScore(sixty),reliability:reliabilityBins(sixty)}});
}
function uncertaintyReport(rows){
  const available=rows.filter(row=>row.uncertainty?.available).map(row=>({...row.uncertainty,observed:row.observedPoints}));
  const event=(probabilityKey,outcomeFn)=>{ const values=available.map(row=>({probability:row[probabilityKey],outcome:outcomeFn(row.observed)?1:0})); return {...brierScore(values),reliability:reliabilityBins(values)}; };
  return canonicalise({n:available.length,p10P90:intervalSummary(available,'p10','p90'),p25P75:intervalSummary(available,'p25','p75'),blank:event('blankProbability',value=>value<=METRIC_RULES.uncertainty.blankMaximum),return:event('returnProbability',value=>value>=METRIC_RULES.uncertainty.returnMinimum),haul:event('haulProbability',value=>value>=METRIC_RULES.uncertainty.haulMinimum),megaHaul:event('megaHaulProbability',value=>value>=METRIC_RULES.uncertainty.megaHaulMinimum)});
}
function evaluationDataMaterial(record){ return canonicalise({season:record.season,gameweek:record.gameweek,deadlineTime:record.deadlineTime,sources:record.sources,observations:record.observations,decisions:record.decisions,coverage:record.coverage,reports:record.reports,completeness:record.completeness}); }
function evaluationHashMaterial(record){ const copy=canonicalise(record); if(copy.identity){ delete copy.identity.contentHash;delete copy.identity.evaluationId; } return copy; }
async function buildGameweekEvaluation(snapshot,outcome,{previousRecord=null,cryptoImpl=globalThis.crypto}={}){
  if(!snapshot||snapshot.recordType!=='preDeadlineSnapshot') return {ok:false,reason:'snapshot_type'};
  if(!outcome||outcome.recordType!=='gameweekOutcome') return {ok:false,reason:'outcome_type'};
  if(!['complete','corrected'].includes(outcome.status)||!outcome.completeness?.complete) return {ok:false,reason:'outcome_not_authoritative'};
  if(!snapshot.timing?.officialEligible||!snapshot.completeness?.complete) return {ok:false,reason:'snapshot_not_official'};
  if(snapshot.season!==outcome.season||Number(snapshot.gameweek)!==Number(outcome.gameweek)||snapshot.deadlineTime!==outcome.officialDeadlineIdentity?.deadlineTime) return {ok:false,reason:'identity_mismatch'};
  if(outcome.relatedSnapshot?.status!=='matched_official'||outcome.relatedSnapshot.snapshotId!==snapshot.identity?.snapshotId||outcome.relatedSnapshot.contentHash!==snapshot.identity?.contentHash) return {ok:false,reason:'snapshot_link'};
  if(snapshot.managerRef!==outcome.managerRef) return {ok:false,reason:'manager_ref'};
  const predictions=(snapshot.outputs?.players||[]).slice().sort((a,b)=>Number(a.playerId)-Number(b.playerId)),outcomes=(outcome.allPlayerOutcomes?.records||[]).slice().sort((a,b)=>Number(a.playerId)-Number(b.playerId)),outcomeById=new Map(outcomes.map(row=>[Number(row.playerId),row]));
  if(new Set(predictions.map(row=>Number(row.playerId))).size!==predictions.length) return {ok:false,reason:'duplicate_prediction_player'};
  if(new Set(outcomes.map(row=>Number(row.playerId))).size!==outcomes.length) return {ok:false,reason:'duplicate_outcome_player'};
  const squad=snapshot.outputs?.squad,squadSets={owned:new Set(squad?.players?.map(row=>Number(row.playerId))||[]),selected:new Set(squad?.modelDecision?.bestXIPlayerIds?.map(Number)||[]),bench:new Set(squad?.modelDecision?.benchPlayerIds?.map(Number)||[])};
  const primary=squad?.optimiser?.plans?.find(plan=>Number(plan.transferCount)>0),primaryTransfers={in:new Set((primary?.transfers||[]).map(row=>Number(row.inPlayerId))),out:new Set((primary?.transfers||[]).map(row=>Number(row.outPlayerId)))};
  const playerRows=[],minuteRows=[];
  for(const prediction of predictions){
    const official=outcomeById.get(Number(prediction.playerId)); if(!official) continue;
    const frozenFixtures=fixturesForClub(snapshot.modelInputs?.fixtures,Number(prediction.clubId),snapshot.gameweek),finalFixtures=outcomeFixturesForClub(outcome.fixtureOutcomes?.records,Number(prediction.clubId)),fixture=fixtureContext(frozenFixtures,Number(prediction.clubId)),scheduleAligned=setEqual(frozenFixtures.map(row=>row.id),finalFixtures.map(row=>row.fixtureId));
    const predictedPoints=finite(prediction.nextGameweek?.total),observedPoints=finite(official.totalPoints); if(predictedPoints===null||observedPoints===null) continue;
    const error=predictedPoints-observedPoints,uncertainty=prediction.uncertainty?.status==='available'&&['p10','p25','p75','p90','blankProbability','returnProbability','haulProbability','megaHaulProbability'].every(key=>finite(prediction.uncertainty[key])!==null)?canonicalise({available:true,p10:prediction.uncertainty.p10,p25:prediction.uncertainty.p25,p75:prediction.uncertainty.p75,p90:prediction.uncertainty.p90,blankProbability:prediction.uncertainty.blankProbability,returnProbability:prediction.uncertainty.returnProbability,haulProbability:prediction.uncertainty.haulProbability,megaHaulProbability:prediction.uncertainty.megaHaulProbability}):{available:false};
    const row=canonicalise({playerId:Number(prediction.playerId),clubId:Number(prediction.clubId),position:Number(prediction.position),nowCost:Number(prediction.nowCost),predictedPoints,observedPoints,error:roundMetric(error),absError:roundMetric(Math.abs(error)),errorBand:errorBand(error),appeared:Number(official.minutes)>0,reachedSixty:Number(official.minutes)>=60,starts:official.starts==null?null:Number(official.starts),observedMinutes:Number(official.minutes),frozenFixtureIds:fixture.fixtureIds,officialFixtureIds:finalFixtures.map(item=>Number(item.fixtureId)),scheduleAligned,uncertainty,segments:playerSegments(prediction,snapshot,squadSets,fixture,official,primaryTransfers)});
    playerRows.push(row);minuteRows.push(...allocateMinuteFixtures(prediction,official,frozenFixtures,finalFixtures));
  }
  const decisions=decisionEvaluation(snapshot,playerRows);
  if(decisions.status==='available'){
    const positions=new Map((snapshot.outputs?.players||[]).map(row=>[Number(row.playerId),Number(row.position)]));
    decisions.managerOutcome=managerDecisionEvaluation(outcome.realSquadOutcome,playerRows,positions);
  }
  const coverage=outcomeCoverage(predictions,outcomes,playerRows,minuteRows),reports=canonicalise({player:playerReport(playerRows),minutes:minutesReport(minuteRows),uncertainty:uncertaintyReport(playerRows)}),logicalKey=`${snapshot.season}|gw${snapshot.gameweek}`;
  const payload=canonicalise({recordType:'gameweekEvaluation',schemaVersion:METRIC_SCHEMA_VERSION,metricVersion:METRIC_VERSION,segmentationVersion:SEGMENTATION_VERSION,managerRef:snapshot.managerRef,season:snapshot.season,gameweek:Number(snapshot.gameweek),deadlineTime:snapshot.deadlineTime,createdAt:new Date().toISOString(),rules:METRIC_RULES,sources:{snapshotId:snapshot.identity.snapshotId,snapshotContentHash:snapshot.identity.contentHash,outcomeId:outcome.identity.outcomeId,outcomeDataHash:outcome.identity.outcomeDataHash,outcomeRevision:outcome.identity.revision,outcomeStatus:outcome.status},observations:{players:playerRows,minuteFixtures:minuteRows},decisions,coverage,reports,completeness:{complete:true,sections:{players:'complete',minutes:minuteRows.some(row=>row.observedMinutes===null)?'partial':'complete',uncertainty:coverage.uncertaintyRows===playerRows.length?'complete':'partial',squad:decisions.status},missingReasons:{unmatchedPredictions:coverage.unmatchedPredictions.length,unmatchedOutcomes:coverage.unmatchedOutcomes.length,unallocatableMinuteRows:coverage.unallocatableMinuteRows}},identity:{logicalKey,revision:null,rootEvaluationId:null,supersedesEvaluationId:null,metricDataHash:null,sectionHashes:null,contentHash:null,evaluationId:null}});
  assertEvidenceSafe(payload);
  const candidateHash=await sha256Hex(stableStringify(evaluationDataMaterial(payload)),cryptoImpl);
  if(previousRecord?.identity?.metricDataHash===candidateHash&&previousRecord.sources?.outcomeId===payload.sources.outcomeId) return {ok:true,unchanged:true,record:previousRecord};
  const revision=Math.max(0,Number(previousRecord?.identity?.revision)||0)+1,rootEvaluationId=previousRecord?.identity?.rootEvaluationId||`evaluation-${snapshot.season}-gw${snapshot.gameweek}`;
  const sections={sources:payload.sources,players:payload.observations.players,minutes:payload.observations.minuteFixtures,decisions:payload.decisions,coverage:payload.coverage,reports:payload.reports};
  const sectionHashes=canonicalise(Object.fromEntries(await Promise.all(Object.entries(sections).map(async([key,value])=>[key,await sha256Hex(stableStringify(value),cryptoImpl)]))));
  const draft=canonicalise({...payload,identity:{logicalKey,revision,rootEvaluationId,supersedesEvaluationId:previousRecord?.identity?.evaluationId||null,metricDataHash:candidateHash,sectionHashes,contentHash:null,evaluationId:null}}),contentHash=await sha256Hex(stableStringify(evaluationHashMaterial(draft)),cryptoImpl),evaluationId=`evaluation-${snapshot.season}-gw${snapshot.gameweek}-r${revision}-${contentHash.slice(0,16)}`;
  const record=canonicalise({...draft,identity:{...draft.identity,contentHash,evaluationId}});assertEvidenceSafe(record);return {ok:true,unchanged:false,record:deepFreeze(record)};
}
function evaluationShapeError(record){
  if(!record||record.recordType!=='gameweekEvaluation') return 'record_type';
  if(record.schemaVersion!==METRIC_SCHEMA_VERSION||record.metricVersion!==METRIC_VERSION||record.segmentationVersion!==SEGMENTATION_VERSION) return 'version';
  if(!/^mgr-[0-9a-f]{32}$/.test(record.managerRef||'')) return 'manager_ref';
  if(!/^evaluation-\d{4}-\d{2}-gw\d+-r\d+-[0-9a-f]{16}$/.test(record.identity?.evaluationId||'')) return 'identity';
  if(!Array.isArray(record.observations?.players)||!Array.isArray(record.observations?.minuteFixtures)) return 'observations';
  return null;
}
async function validateGameweekEvaluation(record,cryptoImpl=globalThis.crypto){
  try{
    const shape=evaluationShapeError(record);if(shape) return {ok:false,reason:shape};assertEvidenceSafe(record);
    const dataHash=await sha256Hex(stableStringify(evaluationDataMaterial(record)),cryptoImpl);if(dataHash!==record.identity.metricDataHash) return {ok:false,reason:'metric_data_hash'};
    const sections={sources:record.sources,players:record.observations.players,minutes:record.observations.minuteFixtures,decisions:record.decisions,coverage:record.coverage,reports:record.reports};
    const hashes=canonicalise(Object.fromEntries(await Promise.all(Object.entries(sections).map(async([key,value])=>[key,await sha256Hex(stableStringify(value),cryptoImpl)]))));if(stableStringify(hashes)!==stableStringify(record.identity.sectionHashes)) return {ok:false,reason:'section_hash'};
    const contentHash=await sha256Hex(stableStringify(evaluationHashMaterial(record)),cryptoImpl);if(contentHash!==record.identity.contentHash) return {ok:false,reason:'content_hash'};
    const expected=`evaluation-${record.season}-gw${record.gameweek}-r${record.identity.revision}-${contentHash.slice(0,16)}`;if(record.identity.evaluationId!==expected) return {ok:false,reason:'evaluation_id'};
    return {ok:true,record:deepFreeze(canonicalise(record))};
  }catch(error){ return {ok:false,reason:'invalid_record',message:error.message}; }
}
function segmentValue(row,dimension){
  if(dimension==='overall') return 'all';
  if(dimension==='schedule') return row.scheduleAligned?'schedule_aligned':'schedule_changed';
  return row.segments?.[dimension]??'unknown';
}
function buildMetricsReport(evaluations,{dimension='overall',value='all'}={}){
  const current=(evaluations||[]).filter(record=>record?.recordType==='gameweekEvaluation'&&record.completeness?.complete),gameweeks=sortedNumbers(current.map(record=>record.gameweek));
  let players=current.flatMap(record=>(record.observations?.players||[]).map(row=>({...row,gameweek:record.gameweek})));
  if(dimension!=='overall'||value!=='all') players=players.filter(row=>String(segmentValue(row,dimension))===String(value));
  const playerKeys=new Set(players.map(row=>`${row.gameweek}|${row.playerId}`)),minutes=current.flatMap(record=>(record.observations?.minuteFixtures||[]).map(row=>({...row,gameweek:record.gameweek}))).filter(row=>playerKeys.has(`${row.gameweek}|${row.playerId}`));
  const playerGameweeks=new Set(players.map(row=>row.gameweek)).size,minuteGameweeks=new Set(minutes.map(row=>row.gameweek)).size;
  return canonicalise({dimension,value,gameweeks,player:{metrics:playerReport(players),sample:sampleStatus(players.length,playerGameweeks)},minutes:{metrics:minutesReport(minutes),sample:sampleStatus(minutes.filter(row=>row.observedMinutes!==null).length,minuteGameweeks)},uncertainty:{metrics:uncertaintyReport(players),sample:sampleStatus(players.filter(row=>row.uncertainty?.available).length,playerGameweeks)},coverage:{evaluationGameweeks:current.length,playerRows:players.length,minuteRows:minutes.length,missingPredictions:current.reduce((sum,row)=>sum+(row.coverage?.unmatchedPredictions?.length||0),0),missingOutcomes:current.reduce((sum,row)=>sum+(row.coverage?.unmatchedOutcomes?.length||0),0),unallocatableMinutes:minutes.filter(row=>row.observedMinutes===null).length}});
}
function transferDataMaterial(record){ return canonicalise({season:record.season,startGameweek:record.startGameweek,horizon:record.horizon,sources:record.sources,baseline:record.baseline,plans:record.plans,completeness:record.completeness}); }
function transferHashMaterial(record){ const copy=canonicalise(record);if(copy.identity){delete copy.identity.contentHash;delete copy.identity.transferEvaluationId;}return copy; }
function scoreFrozenSquad(playerIds,xiIds,projectionRows,outcomeRows){
  const positions=new Map(projectionRows.map(row=>[Number(row.playerId),Number(row.position)])),scoreById=new Map(projectionRows.map(row=>[Number(row.playerId),Number(row.projected)||0])),outcomeById=new Map(outcomeRows.map(row=>[Number(row.playerId),{points:Number(row.observedPoints)||0,appeared:Boolean(row.appeared)}]));
  const bench=benchOrderForXI(playerIds,xiIds,positions,scoreById);return applyRealisedAutosubs(xiIds,bench,positions,outcomeById);
}
async function buildTransferHorizonEvaluation(startEvaluation,evaluationsByGameweek,{previousRecord=null,cryptoImpl=globalThis.crypto}={}){
  const basis=startEvaluation?.decisions?.transferBasis;if(!basis||!basis.baseline||!Number.isInteger(Number(basis.horizon))||basis.horizon<1) return {ok:false,reason:'transfer_basis_unavailable'};
  const start=Number(startEvaluation.gameweek),horizon=Number(basis.horizon),required=Array.from({length:horizon},(_,index)=>start+index),records=required.map(gw=>evaluationsByGameweek.get(gw));
  if(records.some(record=>!record?.completeness?.complete)) return {ok:false,reason:'horizon_in_progress',missingGameweeks:required.filter((gw,index)=>!records[index]?.completeness?.complete)};
  const projectionByPlayer=new Map((basis.players||[]).map(row=>[Number(row.playerId),row]));
  const evaluatePlan=plan=>{
    const perGameweek=required.map((gw,index)=>{
      const xi=plan.perGameweekBestXI?.find(row=>Number(row.gw)===gw)?.playerIds?.map(Number)||[],squadIds=(plan.finalSquadIds||[]).map(Number),projectionRows=squadIds.map(id=>({playerId:id,position:projectionByPlayer.get(id)?.position,projected:projectionByPlayer.get(id)?.perGameweek?.find(row=>Number(row.gw)===gw)?.total||0})),outcomes=records[index].observations.players.filter(row=>squadIds.includes(Number(row.playerId)));
      const realised=scoreFrozenSquad(squadIds,xi,projectionRows,outcomes),scheduleChanged=outcomes.some(row=>!row.scheduleAligned);
      return {gw,xiPlayerIds:xi,benchPlayerIds:benchOrderForXI(squadIds,xi,new Map(projectionRows.map(row=>[row.playerId,row.position])),new Map(projectionRows.map(row=>[row.playerId,row.projected]))),realisedBasePoints:realised.basePoints,automaticSubstitutionContribution:realised.autoSubContribution,scheduleChanged};
    });
    return canonicalise({signature:String(plan.signature||''),transferCount:Number(plan.transferCount)||0,transfers:plan.transfers||[],hitCost:Number(plan.hitCost)||0,rollDifference:Number(plan.rollDifference)||0,freeTransfersNextGW:Number(plan.freeTransfersNextGW)||0,realisedBasePoints:perGameweek.reduce((sum,row)=>sum+row.realisedBasePoints,0),perGameweek});
  };
  const baseline=evaluatePlan(basis.baseline),plans=(basis.plans||[]).filter(plan=>Number(plan.transferCount)>0).map(evaluatePlan).map(plan=>({...plan,grossGain:plan.realisedBasePoints-baseline.realisedBasePoints,netGainAfterHits:plan.realisedBasePoints-baseline.realisedBasePoints-plan.hitCost}));
  const payload=canonicalise({recordType:'transferHorizonEvaluation',schemaVersion:TRANSFER_METRIC_SCHEMA_VERSION,metricVersion:METRIC_VERSION,managerRef:startEvaluation.managerRef,season:startEvaluation.season,startGameweek:start,horizon,createdAt:new Date().toISOString(),sources:{startEvaluationId:startEvaluation.identity.evaluationId,gameweekEvaluationIds:records.map(record=>record.identity.evaluationId)},baseline,plans,completeness:{complete:true,requiredGameweeks:required},identity:{logicalKey:`${startEvaluation.season}|transfer|gw${start}|h${horizon}`,revision:null,rootTransferEvaluationId:null,supersedesTransferEvaluationId:null,metricDataHash:null,contentHash:null,transferEvaluationId:null}});
  const dataHash=await sha256Hex(stableStringify(transferDataMaterial(payload)),cryptoImpl);if(previousRecord?.identity?.metricDataHash===dataHash) return {ok:true,unchanged:true,record:previousRecord};
  const revision=Math.max(0,Number(previousRecord?.identity?.revision)||0)+1,root=previousRecord?.identity?.rootTransferEvaluationId||`transfer-evaluation-${payload.season}-gw${start}-h${horizon}`,draft=canonicalise({...payload,identity:{...payload.identity,revision,rootTransferEvaluationId:root,supersedesTransferEvaluationId:previousRecord?.identity?.transferEvaluationId||null,metricDataHash:dataHash}}),contentHash=await sha256Hex(stableStringify(transferHashMaterial(draft)),cryptoImpl),transferEvaluationId=`transfer-evaluation-${payload.season}-gw${start}-h${horizon}-r${revision}-${contentHash.slice(0,16)}`;
  return {ok:true,unchanged:false,record:deepFreeze(canonicalise({...draft,identity:{...draft.identity,contentHash,transferEvaluationId}}))};
}
async function validateTransferHorizonEvaluation(record,cryptoImpl=globalThis.crypto){
  try{
    if(!record||record.recordType!=='transferHorizonEvaluation'||record.schemaVersion!==TRANSFER_METRIC_SCHEMA_VERSION) return {ok:false,reason:'record_type'};
    if(!/^transfer-evaluation-\d{4}-\d{2}-gw\d+-h\d+-r\d+-[0-9a-f]{16}$/.test(record.identity?.transferEvaluationId||'')) return {ok:false,reason:'identity'};
    const dataHash=await sha256Hex(stableStringify(transferDataMaterial(record)),cryptoImpl);if(dataHash!==record.identity.metricDataHash) return {ok:false,reason:'metric_data_hash'};
    const contentHash=await sha256Hex(stableStringify(transferHashMaterial(record)),cryptoImpl);if(contentHash!==record.identity.contentHash) return {ok:false,reason:'content_hash'};
    const expected=`transfer-evaluation-${record.season}-gw${record.startGameweek}-h${record.horizon}-r${record.identity.revision}-${contentHash.slice(0,16)}`;if(record.identity.transferEvaluationId!==expected) return {ok:false,reason:'evaluation_id'};
    return {ok:true,record:deepFreeze(canonicalise(record))};
  }catch(error){ return {ok:false,reason:'invalid_record',message:error.message}; }
}

export {
  METRIC_SCHEMA_VERSION,METRIC_VERSION,SEGMENTATION_VERSION,TRANSFER_METRIC_SCHEMA_VERSION,METRIC_RULES,
  mean,pearson,averageRanks,spearman,metricSummary,brierScore,reliabilityBins,intervalSummary,sampleStatus,errorBand,priceBand,seasonPeriod,
  allocateMinuteFixtures,formationCounts,legalXIIds,enumerateLegalXIs,benchOrderForXI,applyRealisedAutosubs,captainPairScore,managerDecisionEvaluation,
  playerReport,minutesReport,uncertaintyReport,buildGameweekEvaluation,validateGameweekEvaluation,buildMetricsReport,
  buildTransferHorizonEvaluation,validateTransferHorizonEvaluation
};
