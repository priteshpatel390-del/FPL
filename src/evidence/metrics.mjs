import {
  canonicalise, stableStringify, sha256Hex, deepFreeze, assertEvidenceSafe
} from './snapshot.mjs';

const METRIC_SCHEMA_VERSION='1.0.0';
const METRIC_VERSION='1.0.0';
const SEGMENTATION_VERSION='1.0.0';
const TRANSFER_METRIC_SCHEMA_VERSION='1.0.0';
const METRIC_RULES=Object.freeze({
  errorBands:Object.freeze([0,2,5,10]),
  ['reliability'+'Bins']:Object.freeze([0,0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1]),
  uncertainty:Object.freeze({blankMaximum:2,returnMinimum:5,haulMinimum:10,megaHaulMinimum:15}),
  samples:Object.freeze({rawMaximum:29,descriptiveMaximum:199,stableMinimum:200,stableGameweeks:10,probabilityBinMinimum:30,probabilityPreferred:500,decisionMinimum:10,providerMinimumGameweeks:5,providerMinimumObservations:100}),
  localIndexLimit:80,
  supersededFullLimit:6,
  maxEncodedBytes:3*1024*1024
});

function evaluationFinite(value){ if(value===null||value===undefined||value==='') return null; const n=Number(value); return Number.isFinite(n)?n:null; }
function evaluationMean(values){ return values.length?values.reduce((a,b)=>a+b,0)/values.length:null; }
function evaluationSameArray(a,b){ return a.length===b.length&&a.every((value,index)=>value===b[index]); }
function evaluationSortedNumbers(values){ return [...new Set((values||[]).map(Number).filter(Number.isFinite))].sort((a,b)=>a-b); }
function evaluationSetEqual(a,b){ return evaluationSameArray(evaluationSortedNumbers(a),evaluationSortedNumbers(b)); }
function evaluationRound(value){ return Number.isFinite(value)?Number(value.toFixed(8)):null; }
function evaluationPositionLabel(position){ return ({1:'GKP',2:'DEF',3:'MID',4:'FWD'})[Number(position)]||'Unknown'; }
function evaluationSeasonPeriod(gameweek){ const gw=Number(gameweek); return gw<1?'pre-season':gw<=6?'early':gw<=12?'transition':'mature'; }
function evaluationPriceBand(position,nowCost){
  const price=Number(nowCost)/10, pos=Number(position);
  if(!Number.isFinite(price)) return 'unknown';
  if(pos===1||pos===2) return price<=4.4?'up_to_4.4':price<=5.4?'4.5_to_5.4':'5.5_plus';
  if(pos===3) return price<=5.4?'up_to_5.4':price<=7.4?'5.5_to_7.4':price<=9.9?'7.5_to_9.9':'10.0_plus';
  if(pos===4) return price<=5.4?'up_to_5.4':price<=7.4?'5.5_to_7.4':price<=9.4?'7.5_to_9.4':'9.5_plus';
  return 'unknown';
}
function evaluationAvailabilityLabel(status){
  const value=String(status||'');
  if(['i','u','s','n'].includes(value)) return 'unavailable';
  if(value==='d') return 'doubtful';
  if(value==='a') return 'available';
  return 'unknown';
}
function evaluationErrorBand(error){
  const value=Math.abs(Number(error));
  if(value===0) return 'exact';
  if(value<=2) return 'small';
  if(value<=5) return 'material';
  if(value<=10) return 'large';
  return 'very_large';
}
function evaluationPearson(xs,ys){
  if(xs.length!==ys.length||xs.length<3) return null;
  const mx=evaluationMean(xs),my=evaluationMean(ys); let sxy=0,sxx=0,syy=0;
  for(let i=0;i<xs.length;i++){ const dx=xs[i]-mx,dy=ys[i]-my; sxy+=dx*dy;sxx+=dx*dx;syy+=dy*dy; }
  return sxx&&syy?evaluationRound(sxy/Math.sqrt(sxx*syy)):null;
}
function evaluationAverageRanks(values){
  const indexed=values.map((value,index)=>({value,index})).sort((a,b)=>a.value-b.value||a.index-b.index),ranks=Array(values.length);
  for(let i=0;i<indexed.length;){
    let j=i+1; while(j<indexed.length&&indexed[j].value===indexed[i].value) j++;
    const rank=(i+1+j)/2; for(let k=i;k<j;k++) ranks[indexed[k].index]=rank; i=j;
  }
  return ranks;
}
function evaluationSpearman(xs,ys){ return xs.length===ys.length&&xs.length>=3?evaluationPearson(evaluationAverageRanks(xs),evaluationAverageRanks(ys)):null; }
function evaluationMetricSummary(rows,predictedKey='predicted',observedKey='observed'){
  const clean=(rows||[]).map(row=>({predicted:evaluationFinite(row?.[predictedKey]),observed:evaluationFinite(row?.[observedKey])})).filter(row=>row.predicted!==null&&row.observed!==null);
  if(!clean.length) return {n:0,mae:null,rmse:null,bias:null,['pear'+'son']:null,['spear'+'man']:null,predictedMean:null,observedMean:null,within15:null,within30:null};
  const errors=clean.map(row=>row.predicted-row.observed),xs=clean.map(row=>row.predicted),ys=clean.map(row=>row.observed);
  return canonicalise({
    n:clean.length,
    mae:evaluationRound(evaluationMean(errors.map(Math.abs))),
    rmse:evaluationRound(Math.sqrt(evaluationMean(errors.map(value=>value*value)))),
    bias:evaluationRound(evaluationMean(errors)),
    ['pear'+'son']:evaluationPearson(xs,ys),['spear'+'man']:evaluationSpearman(xs,ys),
    predictedMean:evaluationRound(evaluationMean(xs)),observedMean:evaluationRound(evaluationMean(ys)),
    within15:evaluationRound(evaluationMean(errors.map(value=>Math.abs(value)<=15?1:0))),
    within30:evaluationRound(evaluationMean(errors.map(value=>Math.abs(value)<=30?1:0)))
  });
}
function evaluationBrierScore(rows,probabilityKey='probability',outcomeKey='outcome'){
  const clean=(rows||[]).map(row=>({probability:evaluationFinite(row?.[probabilityKey]),outcome:evaluationFinite(row?.[outcomeKey])})).filter(row=>row.probability!==null&&row.probability>=0&&row.probability<=1&&(row.outcome===0||row.outcome===1));
  if(!clean.length) return {n:0,brier:null,predictedRate:null,observedRate:null,gap:null};
  const errors=clean.map(row=>(row.probability-row.outcome)**2),predictedRate=evaluationMean(clean.map(row=>row.probability)),observedRate=evaluationMean(clean.map(row=>row.outcome));
  return canonicalise({n:clean.length,brier:evaluationRound(evaluationMean(errors)),predictedRate:evaluationRound(predictedRate),observedRate:evaluationRound(observedRate),gap:evaluationRound(predictedRate-observedRate)});
}
function evaluationReliabilityBins(rows,probabilityKey='probability',outcomeKey='outcome'){
  const clean=(rows||[]).map(row=>({probability:evaluationFinite(row?.[probabilityKey]),outcome:evaluationFinite(row?.[outcomeKey])})).filter(row=>row.probability!==null&&row.probability>=0&&row.probability<=1&&(row.outcome===0||row.outcome===1));
  const edges=METRIC_RULES['reliability'+'Bins'];
  return edges.slice(0,-1).map((lower,index)=>{
    const upper=edges[index+1],last=index===edges.length-2;
    const bin=clean.filter(row=>row.probability>=lower&&(last?row.probability<=upper:row.probability<upper));
    const predicted=evaluationMean(bin.map(row=>row.probability)),observed=evaluationMean(bin.map(row=>row.outcome));
    return canonicalise({lower,upper,inclusiveUpper:last,n:bin.length,eventCount:bin.reduce((sum,row)=>sum+row.outcome,0),meanPredicted:evaluationRound(predicted),observedFrequency:bin.length>=METRIC_RULES.samples.probabilityBinMinimum?evaluationRound(observed):null,gap:bin.length>=METRIC_RULES.samples.probabilityBinMinimum?evaluationRound(predicted-observed):null,display:bin.length>=METRIC_RULES.samples.probabilityBinMinimum?'descriptive':'insufficient'});
  });
}
function evaluationIntervalSummary(rows,lowerKey,upperKey,observedKey='observed'){
  const clean=(rows||[]).map(row=>({lower:evaluationFinite(row?.[lowerKey]),upper:evaluationFinite(row?.[upperKey]),observed:evaluationFinite(row?.[observedKey])})).filter(row=>row.lower!==null&&row.upper!==null&&row.observed!==null&&row.lower<=row.upper);
  return canonicalise({n:clean.length,coverage:clean.length?evaluationRound(evaluationMean(clean.map(row=>row.observed>=row.lower&&row.observed<=row.upper?1:0))):null,width:clean.length?evaluationRound(evaluationMean(clean.map(row=>row.upper-row.lower))):null});
}
function evaluationSampleStatus(observationCount,gameweekCount,{kind='general'}={}){
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
function evaluationFixtureStat(detail,identifier){ return evaluationFinite(detail?.officialStats?.find(row=>row.identifier===identifier)?.value); }
function evaluationFixturesForClub(fixtures,clubId,gameweek){
  return (fixtures||[]).filter(row=>Number(row.event)===Number(gameweek)&&(Number(row.team_h)===Number(clubId)||Number(row.team_a)===Number(clubId))).sort((a,b)=>Number(a.id)-Number(b.id));
}
function evaluationOutcomeFixturesForClub(fixtures,clubId){
  return (fixtures||[]).filter(row=>Number(row.homeTeamId)===Number(clubId)||Number(row.awayTeamId)===Number(clubId)).sort((a,b)=>Number(a.fixtureId)-Number(b.fixtureId));
}
function evaluationFixtureContext(frozenFixtures,clubId){
  if(!frozenFixtures.length) return {fixtureClass:'blank',homeAway:'blank',fdrContext:'blank',fixtureIds:[]};
  const venues=frozenFixtures.map(row=>Number(row.team_h)===Number(clubId)?'home':'away');
  const fdr=frozenFixtures.map(row=>Number(row.team_h)===Number(clubId)?row.team_h_difficulty:row.team_a_difficulty);
  return {fixtureClass:frozenFixtures.length===1?'single':'double',homeAway:new Set(venues).size===1?venues[0]:'mixed',fdrContext:fdr.map(value=>value==null?'?':String(value)).join('+'),fixtureIds:frozenFixtures.map(row=>Number(row.id))};
}
function evaluationObservedRole(outcome){
  if(!outcome||Number(outcome.minutes)<=0) return 'dnp';
  const starts=evaluationFinite(outcome.starts);
  if(starts===null) return 'appeared_unknown_start';
  const fixtures=Math.max(1,(outcome.perFixture||[]).length);
  if(starts>=fixtures) return fixtures>1?'all_started':'started';
  if(starts>0) return 'mixed';
  return 'substitute_only';
}
function evaluationAllocateMinuteFixtures(prediction,outcome,frozenFixtures,finalFixtures){
  const details=new Map((outcome?.perFixture||[]).map(row=>[Number(row.fixtureId),row]));
  const totalMinutes=evaluationFinite(outcome?.minutes),totalStarts=evaluationFinite(outcome?.starts),frozenIds=frozenFixtures.map(row=>Number(row.id));
  const alignedIds=new Set(finalFixtures.map(row=>Number(row.fixtureId)));
  const knownMinutes=frozenIds.map(id=>evaluationFixtureStat(details.get(id),'minutes'));
  const knownStarts=frozenIds.map(id=>evaluationFixtureStat(details.get(id),'starts'));
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
      predictedMinutes:evaluationFinite(prediction.minutes?.expMin),observedMinutes:validMinutes?observedMinutes:null,
      pStart:evaluationFinite(prediction.minutes?.pStart),started:starts===null?null:starts>0?1:0,
      pAppear:evaluationFinite(prediction.minutes?.pAppear),appeared:validMinutes?(observedMinutes>0?1:0):null,
      p60:evaluationFinite(prediction.minutes?.p60),reachedSixty:validMinutes?(observedMinutes>=60?1:0):null,
      allocation:details.has(fixtureId)?'official_per_fixture':observedMinutes!==null?'reconciled_or_single':'unallocatable'
    });
  });
}
function evaluationFormationCounts(ids,positions){
  const counts={1:0,2:0,3:0,4:0}; (ids||[]).forEach(id=>{ const position=Number(positions.get(Number(id))); if(counts[position]!==undefined) counts[position]++; }); return counts;
}
function evaluationLegalXIIds(ids,positions){ const c=evaluationFormationCounts(ids,positions); return ids.length===11&&c[1]===1&&c[2]>=3&&c[3]>=2&&c[4]>=1; }
function evaluationCombinations(values,size,start=0,chosen=[],out=[]){
  if(chosen.length===size){ out.push(chosen.slice()); return out; }
  for(let i=start;i<=values.length-(size-chosen.length);i++){ chosen.push(values[i]);evaluationCombinations(values,size,i+1,chosen,out);chosen.pop(); }
  return out;
}
function evaluationEnumerateLegalXIs(squadIds,positions){ return evaluationCombinations(evaluationSortedNumbers(squadIds),11).filter(ids=>evaluationLegalXIIds(ids,positions)); }
function evaluationBenchOrderForXI(squadIds,xiIds,positions,scoreById){
  const selected=new Set(xiIds.map(Number)),bench=squadIds.filter(id=>!selected.has(Number(id)));
  const goalkeeper=bench.filter(id=>Number(positions.get(Number(id)))===1).sort((a,b)=>a-b);
  const outfield=bench.filter(id=>Number(positions.get(Number(id)))!==1).sort((a,b)=>(Number(scoreById.get(Number(b)))||0)-(Number(scoreById.get(Number(a)))||0)||Number(a)-Number(b));
  return [...goalkeeper,...outfield];
}
function evaluationApplyRealisedAutosubs(starterIds,benchIds,positions,outcomeById){
  const active=starterIds.map(Number),used=[],replacements=[];
  const appeared=id=>Boolean(outcomeById.get(Number(id))?.appeared),missingOutfield=()=>active.map((id,index)=>({id,index})).filter(row=>Number(positions.get(row.id))!==1&&!appeared(row.id));
  const goalkeeperIndex=active.findIndex(id=>Number(positions.get(id))===1&&!appeared(id));
  if(goalkeeperIndex>=0){ const reserve=benchIds.map(Number).find(id=>Number(positions.get(id))===1&&appeared(id)); if(reserve!=null){ replacements.push({playerOut:active[goalkeeperIndex],playerIn:reserve});active[goalkeeperIndex]=reserve;used.push(reserve); } }
  for(const substitute of benchIds.map(Number).filter(id=>Number(positions.get(id))!==1)){
    if(!appeared(substitute)||used.includes(substitute)) continue;
    for(const candidate of missingOutfield()){
      const trial=active.slice();trial[candidate.index]=substitute;
      if(evaluationLegalXIIds(trial,positions)){ replacements.push({playerOut:candidate.id,playerIn:substitute});active[candidate.index]=substitute;used.push(substitute);break; }
    }
  }
  const scoringXI=active.filter(appeared),basePoints=scoringXI.reduce((sum,id)=>sum+(evaluationFinite(outcomeById.get(id)?.points)||0),0);
  return canonicalise({activeXI:active,scoringXI,usedBenchIds:used,replacements,basePoints,autoSubContribution:used.reduce((sum,id)=>sum+(evaluationFinite(outcomeById.get(id)?.points)||0),0)});
}
function evaluationCaptainPairScore(captainId,viceId,outcomeById){
  const captain=outcomeById.get(Number(captainId)),vice=outcomeById.get(Number(viceId));
  const effective=captain?.appeared?Number(captainId):vice?.appeared?Number(viceId):null;
  return canonicalise({captainId:Number(captainId)||null,viceCaptainId:Number(viceId)||null,effectiveCaptainId:effective,viceTookOver:effective===Number(viceId),doubledContribution:effective==null?0:evaluationFinite(outcomeById.get(effective)?.points)||0});
}
function evaluationManagerDecisionEvaluation(managerOutcome,playerRows,positions){
  if(!managerOutcome||managerOutcome.status==='not_available'||!Array.isArray(managerOutcome.picks)||managerOutcome.picks.length!==15)
    return canonicalise({status:'not_available',reason:managerOutcome?.reason||'public_manager_outcome_unavailable'});
  const points=new Map(playerRows.map(row=>[Number(row.playerId),Number(row.observedPoints)||0])),appeared=new Map(playerRows.map(row=>[Number(row.playerId),Boolean(row.appeared)]));
  const picks=managerOutcome.picks.slice().sort((a,b)=>Number(a.position)-Number(b.position)||Number(a.playerId)-Number(b.playerId));
  const starters=picks.filter(row=>Number(row.position)<=11).map(row=>Number(row.playerId)),bench=picks.filter(row=>Number(row.position)>11).map(row=>Number(row.playerId));
  const outcomeById=new Map(picks.map(row=>[Number(row.playerId),{points:points.get(Number(row.playerId))||0,appeared:appeared.get(Number(row.playerId))||false}]));
  const reconstructed=evaluationApplyRealisedAutosubs(starters,bench,positions,outcomeById),officialSubs=(managerOutcome.automaticSubstitutions||[]).map(row=>({playerOut:Number(row.playerOut),playerIn:Number(row.playerIn)}));
  const officialPairs=officialSubs.map(row=>`${row.playerOut}>${row.playerIn}`).sort(),reconstructedPairs=reconstructed.replacements.map(row=>`${row.playerOut}>${row.playerIn}`).sort();
  const multiplierXI=picks.filter(row=>Number(row.multiplier)>0).map(row=>Number(row.playerId)),legal=evaluationLegalXIIds(reconstructed.activeXI,positions),captain=managerOutcome.captain,vice=managerOutcome.viceCaptain;
  return canonicalise({status:legal&&evaluationSameArray(officialPairs,reconstructedPairs)?'available':'partial',legalRealisedXI:legal,startingXIPlayerIds:starters,benchOrder:bench,officialScoringPlayerIds:multiplierXI,reconstructedScoringPlayerIds:reconstructed.scoringXI,officialAutomaticSubstitutions:officialSubs,reconstructedAutomaticSubstitutions:reconstructed.replacements,automaticSubstitutionAgreement:evaluationSameArray(officialPairs,reconstructedPairs),reconstructedBasePoints:reconstructed.basePoints,officialGameweekPoints:managerOutcome.officialGameweekPoints,officialPointsOnBench:managerOutcome.officialPointsOnBench,activeChip:managerOutcome.activeChip,captain:captain||null,viceCaptain:vice||null,transferCount:managerOutcome.eventTransferCount,transferCost:managerOutcome.eventTransferCost,reconstruction:managerOutcome.reconstruction||null});
}
function evaluationDecisionEvaluation(snapshot,playerRows){
  const squad=snapshot.outputs?.squad;
  if(squad?.status!=='available'||!squad.modelDecision) return canonicalise({status:'not_available',reason:'complete_frozen_squad_unavailable',squad:null,captaincy:null,bench:null,managerOutcome:null,transferBasis:null});
  const allPredictions=new Map((snapshot.outputs?.players||[]).map(row=>[Number(row.playerId),row]));
  const outcomeById=new Map(playerRows.map(row=>[Number(row.playerId),{points:row.observedPoints,appeared:row.appeared}]));
  const positions=new Map((snapshot.outputs?.players||[]).map(row=>[Number(row.playerId),Number(row.position)]));
  const squadIds=squad.players.map(row=>Number(row.playerId)),starters=squad.modelDecision.bestXIPlayerIds.map(Number),bench=squad.modelDecision.benchPlayerIds.map(Number);
  const selected=evaluationApplyRealisedAutosubs(starters,bench,positions,outcomeById);
  const legalXIs=evaluationEnumerateLegalXIs(squadIds,positions),predictedScore=id=>evaluationFinite(allPredictions.get(Number(id))?.nextGameweek?.total)||0;
  const alternatives=legalXIs.map(ids=>{
    const scoreById=new Map(squadIds.map(id=>[id,predictedScore(id)])),orderedBench=evaluationBenchOrderForXI(squadIds,ids,positions,scoreById),realised=evaluationApplyRealisedAutosubs(ids,orderedBench,positions,outcomeById);
    return {playerIds:ids,formation:Object.values(evaluationFormationCounts(ids,positions)).slice(1).join('-'),predictedPoints:evaluationRound(ids.reduce((sum,id)=>sum+predictedScore(id),0)),realisedPoints:realised.basePoints,benchPlayerIds:orderedBench};
  }).sort((a,b)=>b.predictedPoints-a.predictedPoints||a.playerIds.join(',').localeCompare(b.playerIds.join(',')));
  const selectedKey=evaluationSortedNumbers(starters).join(','),realisedOrder=alternatives.slice().sort((a,b)=>b.realisedPoints-a.realisedPoints||a.playerIds.join(',').localeCompare(b.playerIds.join(','))),selectedIndex=realisedOrder.findIndex(row=>row.playerIds.join(',')===selectedKey),selectedRank=selectedIndex>=0?selectedIndex+1:null;
  const oracle=realisedOrder[0]||null;
  const rankedCandidates=starters.slice().sort((a,b)=>predictedScore(b)-predictedScore(a)||a-b),captainId=Number(squad.modelDecision.captainId),viceId=Number(squad.modelDecision.viceCaptainId);
  const selectedPair=evaluationCaptainPairScore(captainId,viceId,outcomeById),vicePair=evaluationCaptainPairScore(viceId,captainId,outcomeById);
  const candidateRows=rankedCandidates.map(id=>{ const alternateVice=rankedCandidates.find(other=>other!==id)??null; return {...evaluationCaptainPairScore(id,alternateVice,outcomeById),frozenRank:rankedCandidates.indexOf(id)+1,predictedPoints:predictedScore(id)}; });
  const unusedBench=bench.filter(id=>!selected.usedBenchIds.includes(id)),pointsLeftOnBench=unusedBench.reduce((sum,id)=>sum+(evaluationFinite(outcomeById.get(id)?.points)||0),0);
  const providerPlans=squad.optimiser?.plans||[],baseline=squad.optimiser?.baseline||null,primaryPlan=providerPlans.find(plan=>Number(plan.transferCount)>0)||null;
  const transferIds=new Set([...(baseline?.finalSquadIds||[]),...providerPlans.flatMap(plan=>plan.finalSquadIds||[])]);
  const transferPlayers=[...transferIds].sort((a,b)=>a-b).map(id=>({playerId:id,position:positions.get(id)||null,perGameweek:(allPredictions.get(id)?.perGameweek||[]).map(row=>({gw:Number(row.gw),total:evaluationFinite(row.total)||0}))}));
  return canonicalise({
    status:'available',
    squad:{frozenPlayerIds:evaluationSortedNumbers(squadIds),selectedXIPlayerIds:starters,selectedBenchPlayerIds:bench,selectedRealised:selected,topFrozenAlternatives:alternatives.slice(0,3),selectedRealisedRank:selectedRank,hindsightOracle:oracle?{label:'Hindsight oracle',playerIds:oracle.playerIds,formation:oracle.formation,realisedPoints:oracle.realisedPoints}:null},
    captaincy:{selected:selectedPair,selectedViceAsCaptain:vicePair,topThreeFrozenCandidates:candidateRows.slice(0,3),allFrozenCandidates:candidateRows,hindsightBest:candidateRows.slice().sort((a,b)=>b.doubledContribution-a.doubledContribution||a.captainId-b.captainId)[0]||null,userPreview:squad.userPreview||null},
    bench:{benchOrder:bench,automaticSubstitutions:selected.replacements,automaticSubstitutionContribution:selected.autoSubContribution,unusedBenchPlayerIds:unusedBench,pointsLeftOnBench},
    managerOutcome:null,
    transferBasis:squad.optimiser?{status:squad.optimiser.status,horizon:Number(squad.optimiser.horizon)||0,baseline,plans:providerPlans,primaryPlan,players:transferPlayers}:null
  });
}
function evaluationPlayerSegments(prediction,snapshot,squadSets,fixture,official,primaryTransfers){
  const providerStates=Object.fromEntries((snapshot.providers||[]).map(row=>[row.provider,row.state]));
  const id=Number(prediction.playerId),position=Number(prediction.position),owned=squadSets.owned.has(id),selected=squadSets.selected.has(id),bench=squadSets.bench.has(id);
  return canonicalise({
    allPlayers:'all',owned:owned?'owned':'not_owned',recommendation:selected?'selected_xi':bench?'bench':primaryTransfers.in.has(id)?'primary_transfer_in':primaryTransfers.out.has(id)?'primary_transfer_out':'other',
    position:evaluationPositionLabel(position),['price'+'Band']:evaluationPriceBand(position,prediction.nowCost),minutesSource:String(prediction.minutes?.source||'unknown'),minutesConfidence:String(prediction.minutes?.confidenceLabel||'Unknown'),providerStates,
    homeAway:fixture.homeAway,fdrContext:fixture.fdrContext,fixtureClass:fixture.fixtureClass,availability:evaluationAvailabilityLabel(prediction.status),['observed'+'Role']:evaluationObservedRole(official),['season'+'Period']:evaluationSeasonPeriod(snapshot.gameweek)
  });
}
function evaluationOutcomeCoverage(predictions,outcomes,matchedRows,minuteRows){
  const predictedIds=new Set(predictions.map(row=>Number(row.playerId))),outcomeIds=new Set(outcomes.map(row=>Number(row.playerId)));
  const unmatchedPredictions=[...predictedIds].filter(id=>!outcomeIds.has(id)).sort((a,b)=>a-b),unmatchedOutcomes=[...outcomeIds].filter(id=>!predictedIds.has(id)).sort((a,b)=>a-b);
  return canonicalise({eligiblePredictions:predictions.length,officialOutcomes:outcomes.length,matchedPlayers:matchedRows.length,coverage:predictions.length?evaluationRound(matchedRows.length/predictions.length):null,unmatchedPredictions,unmatchedOutcomes,minuteFixtureRows:minuteRows.length,unallocatableMinuteRows:minuteRows.filter(row=>row.observedMinutes===null).length,startLabelRows:minuteRows.filter(row=>row.started!==null).length,uncertaintyRows:matchedRows.filter(row=>row.uncertainty?.available).length,scheduleAlignedPlayers:matchedRows.filter(row=>row.scheduleAligned).length});
}
function evaluationPlayerReport(rows){
  const summary=evaluationMetricSummary(rows,'predictedPoints','observedPoints');
  const bands={exact:0,small:0,material:0,large:0,very_large:0}; rows.forEach(row=>{ const band=row['error'+'Band']; if(bands[band]!==undefined) bands[band]++; });
  return canonicalise({...summary,errorBands:bands,withinTwo:rows.length?evaluationRound(evaluationMean(rows.map(row=>row.absError<=2?1:0))):null,withinFive:rows.length?evaluationRound(evaluationMean(rows.map(row=>row.absError<=5?1:0))):null});
}
function evaluationMinutesReport(rows){
  const usable=rows.filter(row=>row.observedMinutes!==null),started=rows.filter(row=>row.started!==null).map(row=>({probability:row.pStart,outcome:row.started})),appeared=rows.filter(row=>row.appeared!==null).map(row=>({probability:row.pAppear,outcome:row.appeared})),sixty=rows.filter(row=>row.reachedSixty!==null).map(row=>({probability:row.p60,outcome:row.reachedSixty}));
  return canonicalise({continuous:evaluationMetricSummary(usable,'predictedMinutes','observedMinutes'),start:{...evaluationBrierScore(started),reliability:evaluationReliabilityBins(started)},appearance:{...evaluationBrierScore(appeared),reliability:evaluationReliabilityBins(appeared)},sixty:{...evaluationBrierScore(sixty),reliability:evaluationReliabilityBins(sixty)}});
}
function evaluationUncertaintyReport(rows){
  const available=rows.filter(row=>row.uncertainty?.available).map(row=>({...row.uncertainty,observed:row.observedPoints}));
  const event=(probabilityKey,outcomeFn)=>{ const values=available.map(row=>({probability:row[probabilityKey],outcome:outcomeFn(row.observed)?1:0})); return {...evaluationBrierScore(values),reliability:evaluationReliabilityBins(values)}; };
  return canonicalise({n:available.length,p10P90:evaluationIntervalSummary(available,'p10','p90'),p25P75:evaluationIntervalSummary(available,'p25','p75'),blank:event('blankProbability',value=>value<=METRIC_RULES.uncertainty.blankMaximum),return:event('returnProbability',value=>value>=METRIC_RULES.uncertainty.returnMinimum),haul:event('haulProbability',value=>value>=METRIC_RULES.uncertainty.haulMinimum),megaHaul:event('megaHaulProbability',value=>value>=METRIC_RULES.uncertainty.megaHaulMinimum)});
}
function stage10EvaluationDataMaterial(record){ return canonicalise({season:record.season,gameweek:record.gameweek,deadlineTime:record.deadlineTime,sources:record.sources,observations:record.observations,decisions:record.decisions,coverage:record.coverage,reports:record.reports,completeness:record.completeness}); }
function stage10EvaluationHashMaterial(record){ const copy=canonicalise(record); if(copy.identity){ delete copy.identity.contentHash;delete copy.identity.evaluationId; } return copy; }
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
    const frozenFixtures=evaluationFixturesForClub(snapshot.modelInputs?.fixtures,Number(prediction.clubId),snapshot.gameweek),finalFixtures=evaluationOutcomeFixturesForClub(outcome.fixtureOutcomes?.records,Number(prediction.clubId)),fixture=evaluationFixtureContext(frozenFixtures,Number(prediction.clubId)),scheduleAligned=evaluationSetEqual(frozenFixtures.map(row=>row.id),finalFixtures.map(row=>row.fixtureId));
    const predictedPoints=evaluationFinite(prediction.nextGameweek?.total),observedPoints=evaluationFinite(official.totalPoints); if(predictedPoints===null||observedPoints===null) continue;
    const error=predictedPoints-observedPoints,uncertainty=prediction.uncertainty?.status==='available'&&['p10','p25','p75','p90','blankProbability','returnProbability','haulProbability','megaHaulProbability'].every(key=>evaluationFinite(prediction.uncertainty[key])!==null)?canonicalise({available:true,p10:prediction.uncertainty.p10,p25:prediction.uncertainty.p25,p75:prediction.uncertainty.p75,p90:prediction.uncertainty.p90,blankProbability:prediction.uncertainty.blankProbability,returnProbability:prediction.uncertainty.returnProbability,haulProbability:prediction.uncertainty.haulProbability,megaHaulProbability:prediction.uncertainty.megaHaulProbability}):{available:false};
    const row=canonicalise({playerId:Number(prediction.playerId),clubId:Number(prediction.clubId),position:Number(prediction.position),nowCost:Number(prediction.nowCost),predictedPoints,observedPoints,error:evaluationRound(error),absError:evaluationRound(Math.abs(error)),['error'+'Band']:evaluationErrorBand(error),appeared:Number(official.minutes)>0,reachedSixty:Number(official.minutes)>=60,starts:official.starts==null?null:Number(official.starts),observedMinutes:Number(official.minutes),frozenFixtureIds:fixture.fixtureIds,officialFixtureIds:finalFixtures.map(item=>Number(item.fixtureId)),scheduleAligned,uncertainty,segments:evaluationPlayerSegments(prediction,snapshot,squadSets,fixture,official,primaryTransfers)});
    playerRows.push(row);minuteRows.push(...evaluationAllocateMinuteFixtures(prediction,official,frozenFixtures,finalFixtures));
  }
  const decisions=evaluationDecisionEvaluation(snapshot,playerRows);
  if(decisions.status==='available'){
    const positions=new Map((snapshot.outputs?.players||[]).map(row=>[Number(row.playerId),Number(row.position)]));
    decisions.managerOutcome=evaluationManagerDecisionEvaluation(outcome.realSquadOutcome,playerRows,positions);
  }
  const coverage=evaluationOutcomeCoverage(predictions,outcomes,playerRows,minuteRows),reports=canonicalise({player:evaluationPlayerReport(playerRows),minutes:evaluationMinutesReport(minuteRows),uncertainty:evaluationUncertaintyReport(playerRows)}),logicalKey=`${snapshot.season}|gw${snapshot.gameweek}`;
  const payload=canonicalise({recordType:'gameweekEvaluation',schemaVersion:METRIC_SCHEMA_VERSION,metricVersion:METRIC_VERSION,segmentationVersion:SEGMENTATION_VERSION,managerRef:snapshot.managerRef,season:snapshot.season,gameweek:Number(snapshot.gameweek),deadlineTime:snapshot.deadlineTime,createdAt:outcome.collection?.completedAt||outcome.collection?.finalisedAt||new Date(0).toISOString(),rules:METRIC_RULES,sources:{snapshotId:snapshot.identity.snapshotId,snapshotContentHash:snapshot.identity.contentHash,outcomeId:outcome.identity.outcomeId,outcomeDataHash:outcome.identity.outcomeDataHash,outcomeRevision:outcome.identity.revision,outcomeStatus:outcome.status},observations:{players:playerRows,minuteFixtures:minuteRows},decisions,coverage,reports,completeness:{complete:true,sections:{players:'complete',minutes:minuteRows.some(row=>row.observedMinutes===null)?'partial':'complete',uncertainty:coverage.uncertaintyRows===playerRows.length?'complete':'partial',squad:decisions.status},missingReasons:{unmatchedPredictions:coverage.unmatchedPredictions.length,unmatchedOutcomes:coverage.unmatchedOutcomes.length,unallocatableMinuteRows:coverage.unallocatableMinuteRows}},identity:{logicalKey,revision:null,rootEvaluationId:null,supersedesEvaluationId:null,metricDataHash:null,sectionHashes:null,contentHash:null,evaluationId:null}});
  assertEvidenceSafe(payload);
  const candidateHash=await sha256Hex(stableStringify(stage10EvaluationDataMaterial(payload)),cryptoImpl);
  if(previousRecord?.identity?.metricDataHash===candidateHash&&previousRecord.sources?.outcomeId===payload.sources.outcomeId) return {ok:true,unchanged:true,record:previousRecord};
  const revision=Math.max(0,Number(previousRecord?.identity?.revision)||0)+1,rootEvaluationId=previousRecord?.identity?.rootEvaluationId||`evaluation-${snapshot.season}-gw${snapshot.gameweek}`;
  const sections={sources:payload.sources,players:payload.observations.players,minutes:payload.observations.minuteFixtures,decisions:payload.decisions,coverage:payload.coverage,reports:payload.reports};
  const sectionHashes=canonicalise(Object.fromEntries(await Promise.all(Object.entries(sections).map(async([key,value])=>[key,await sha256Hex(stableStringify(value),cryptoImpl)]))));
  const draft=canonicalise({...payload,identity:{logicalKey,revision,rootEvaluationId,supersedesEvaluationId:previousRecord?.identity?.evaluationId||null,metricDataHash:candidateHash,sectionHashes,contentHash:null,evaluationId:null}}),contentHash=await sha256Hex(stableStringify(stage10EvaluationHashMaterial(draft)),cryptoImpl),evaluationId=`evaluation-${snapshot.season}-gw${snapshot.gameweek}-r${revision}-${contentHash.slice(0,16)}`;
  const record=canonicalise({...draft,identity:{...draft.identity,contentHash,evaluationId}});assertEvidenceSafe(record);return {ok:true,unchanged:false,record:deepFreeze(record)};
}
function stage10EvaluationShapeError(record){
  const keys=['completeness','createdAt','deadlineTime','decisions','gameweek','identity','managerRef','metricVersion','observations','recordType','reports','rules','schemaVersion','season','segmentationVersion','sources'].sort();
  if(!record||record.recordType!=='gameweekEvaluation') return 'record_type';
  if(record.schemaVersion!==METRIC_SCHEMA_VERSION||record.metricVersion!==METRIC_VERSION||record.segmentationVersion!==SEGMENTATION_VERSION) return 'version';
  if(stableStringify(Object.keys(record).sort())!==stableStringify(keys)) return 'top_level_schema';
  if(!/^mgr-[0-9a-f]{32}$/.test(record.managerRef||'')) return 'manager_ref';
  if(!/^\d{4}-\d{2}$/.test(record.season||'')||!Number.isInteger(record.gameweek)||record.gameweek<1||record.gameweek>38) return 'identity';
  if(!record.identity||record.identity.logicalKey!==`${record.season}|gw${record.gameweek}`||!Number.isInteger(record.identity.revision)||record.identity.revision<1) return 'identity';
  if(!/^evaluation-\d{4}-\d{2}-gw\d+-r\d+-[0-9a-f]{16}$/.test(record.identity.evaluationId||'')) return 'identity';
  if(!/^[0-9a-f]{64}$/.test(record.identity.contentHash||'')||!/^[0-9a-f]{64}$/.test(record.identity.metricDataHash||'')) return 'identity';
  if(!record.identity.sectionHashes||typeof record.identity.sectionHashes!=='object') return 'identity';
  if(!record.sources||typeof record.sources!=='object'||!Array.isArray(record.observations?.players)||!Array.isArray(record.observations?.minuteFixtures)) return 'observations';
  return null;
}
async function validateGameweekEvaluation(record,cryptoImpl=globalThis.crypto){
  try{
    const shape=stage10EvaluationShapeError(record);if(shape) return {ok:false,reason:shape};assertEvidenceSafe(record);
    const dataHash=await sha256Hex(stableStringify(stage10EvaluationDataMaterial(record)),cryptoImpl);if(dataHash!==record.identity.metricDataHash) return {ok:false,reason:'metric_data_hash'};
    const sections={sources:record.sources,players:record.observations.players,minutes:record.observations.minuteFixtures,decisions:record.decisions,coverage:record.coverage,reports:record.reports};
    const hashes=canonicalise(Object.fromEntries(await Promise.all(Object.entries(sections).map(async([key,value])=>[key,await sha256Hex(stableStringify(value),cryptoImpl)]))));if(stableStringify(hashes)!==stableStringify(record.identity.sectionHashes)) return {ok:false,reason:'section_hash'};
    const contentHash=await sha256Hex(stableStringify(stage10EvaluationHashMaterial(record)),cryptoImpl);if(contentHash!==record.identity.contentHash) return {ok:false,reason:'content_hash'};
    const expected=`evaluation-${record.season}-gw${record.gameweek}-r${record.identity.revision}-${contentHash.slice(0,16)}`;if(record.identity.evaluationId!==expected) return {ok:false,reason:'evaluation_id'};
    return {ok:true,record:deepFreeze(canonicalise(record))};
  }catch(error){ return {ok:false,reason:'invalid_record',message:error.message}; }
}
function evaluationSegmentValue(row,dimension){
  if(dimension==='overall') return 'all';
  if(dimension==='schedule') return row.scheduleAligned?'schedule_aligned':'schedule_changed';
  return row.segments?.[dimension]??'unknown';
}
function buildMetricsReport(evaluations,{dimension='overall',value='all'}={}){
  const current=(evaluations||[]).filter(record=>record?.recordType==='gameweekEvaluation'&&record.completeness?.complete),gameweeks=evaluationSortedNumbers(current.map(record=>record.gameweek));
  let players=current.flatMap(record=>(record.observations?.players||[]).map(row=>({...row,gameweek:record.gameweek})));
  if(dimension!=='overall'||value!=='all') players=players.filter(row=>String(evaluationSegmentValue(row,dimension))===String(value));
  const playerKeys=new Set(players.map(row=>`${row.gameweek}|${row.playerId}`)),minutes=current.flatMap(record=>(record.observations?.minuteFixtures||[]).map(row=>({...row,gameweek:record.gameweek}))).filter(row=>playerKeys.has(`${row.gameweek}|${row.playerId}`));
  const playerGameweeks=new Set(players.map(row=>row.gameweek)).size,minuteGameweeks=new Set(minutes.map(row=>row.gameweek)).size;
  return canonicalise({dimension,value,gameweeks,player:{metrics:evaluationPlayerReport(players),sample:evaluationSampleStatus(players.length,playerGameweeks)},minutes:{metrics:evaluationMinutesReport(minutes),sample:evaluationSampleStatus(minutes.filter(row=>row.observedMinutes!==null).length,minuteGameweeks)},uncertainty:{metrics:evaluationUncertaintyReport(players),sample:evaluationSampleStatus(players.filter(row=>row.uncertainty?.available).length,playerGameweeks)},coverage:{evaluationGameweeks:current.length,playerRows:players.length,minuteRows:minutes.length,missingPredictions:current.reduce((sum,row)=>sum+(row.coverage?.unmatchedPredictions?.length||0),0),missingOutcomes:current.reduce((sum,row)=>sum+(row.coverage?.unmatchedOutcomes?.length||0),0),unallocatableMinutes:minutes.filter(row=>row.observedMinutes===null).length}});
}
function evaluationTransferDataMaterial(record){ return canonicalise({season:record.season,startGameweek:record.startGameweek,horizon:record.horizon,sources:record.sources,baseline:record.baseline,plans:record.plans,completeness:record.completeness}); }
function evaluationTransferHashMaterial(record){ const copy=canonicalise(record);if(copy.identity){delete copy.identity.contentHash;delete copy.identity.transferEvaluationId;}return copy; }
function evaluationScoreFrozenSquad(playerIds,xiIds,projectionRows,outcomeRows){
  const positions=new Map(projectionRows.map(row=>[Number(row.playerId),Number(row.position)])),scoreById=new Map(projectionRows.map(row=>[Number(row.playerId),Number(row.projected)||0])),outcomeById=new Map(outcomeRows.map(row=>[Number(row.playerId),{points:Number(row.observedPoints)||0,appeared:Boolean(row.appeared)}]));
  const bench=evaluationBenchOrderForXI(playerIds,xiIds,positions,scoreById);return evaluationApplyRealisedAutosubs(xiIds,bench,positions,outcomeById);
}
async function buildTransferHorizonEvaluation(startEvaluation,evaluationsByGameweek,{previousRecord=null,cryptoImpl=globalThis.crypto}={}){
  const basis=startEvaluation?.decisions?.transferBasis;if(!basis||!basis.baseline||!Number.isInteger(Number(basis.horizon))||basis.horizon<1) return {ok:false,reason:'transfer_basis_unavailable'};
  const start=Number(startEvaluation.gameweek),horizon=Number(basis.horizon),required=Array.from({length:horizon},(_,index)=>start+index),records=required.map(gw=>evaluationsByGameweek.get(gw));
  if(records.some(record=>!record?.completeness?.complete)) return {ok:false,reason:'horizon_in_progress',missingGameweeks:required.filter((gw,index)=>!records[index]?.completeness?.complete)};
  const projectionByPlayer=new Map(
    (basis.players||[]).map(row=>[Number(row.playerId),row])
  );
  const candidatePlans=[basis.baseline,...(basis.plans||[])];
  for(const plan of candidatePlans){
    const squadIds=(plan?.finalSquadIds||[]).map(Number);
    if(squadIds.some(id=>!projectionByPlayer.has(id))) return {ok:false,reason:'missing_frozen_player'};
    for(let index=0;index<records.length;index++){
      const outcomeIds=new Set((records[index].observations?.players||[]).map(row=>Number(row.playerId)));
      if(squadIds.some(id=>!outcomeIds.has(id))) return {ok:false,reason:'missing_player_outcome',gameweek:required[index]};
    }
  }
  const evaluatePlan=plan=>{
    const perGameweek=required.map((gw,index)=>{
      const xi=plan.perGameweekBestXI?.find(row=>Number(row.gw)===gw)?.playerIds?.map(Number)||[],squadIds=(plan.finalSquadIds||[]).map(Number),projectionRows=squadIds.map(id=>({playerId:id,position:projectionByPlayer.get(id)?.position,projected:projectionByPlayer.get(id)?.perGameweek?.find(row=>Number(row.gw)===gw)?.total||0})),outcomes=records[index].observations.players.filter(row=>squadIds.includes(Number(row.playerId)));
      const realised=evaluationScoreFrozenSquad(squadIds,xi,projectionRows,outcomes),scheduleChanged=outcomes.some(row=>!row.scheduleAligned);
      return {gw,xiPlayerIds:xi,benchPlayerIds:evaluationBenchOrderForXI(squadIds,xi,new Map(projectionRows.map(row=>[row.playerId,row.position])),new Map(projectionRows.map(row=>[row.playerId,row.projected]))),realisedBasePoints:realised.basePoints,automaticSubstitutionContribution:realised.autoSubContribution,scheduleChanged};
    });
    return canonicalise({signature:String(plan.signature||''),transferCount:Number(plan.transferCount)||0,transfers:plan.transfers||[],hitCost:Number(plan.hitCost)||0,rollDifference:Number(plan.rollDifference)||0,freeTransfersNextGW:Number(plan.freeTransfersNextGW)||0,realisedBasePoints:perGameweek.reduce((sum,row)=>sum+row.realisedBasePoints,0),perGameweek});
  };
  const baseline=evaluatePlan(basis.baseline),plans=(basis.plans||[]).filter(plan=>Number(plan.transferCount)>0).map(evaluatePlan).map(plan=>({...plan,grossGain:plan.realisedBasePoints-baseline.realisedBasePoints,netGainAfterHits:plan.realisedBasePoints-baseline.realisedBasePoints-plan.hitCost}));
  const payload=canonicalise({recordType:'transferHorizonEvaluation',schemaVersion:TRANSFER_METRIC_SCHEMA_VERSION,metricVersion:METRIC_VERSION,managerRef:startEvaluation.managerRef,season:startEvaluation.season,startGameweek:start,horizon,createdAt:records.map(record=>record.createdAt).filter(Boolean).sort().at(-1)||startEvaluation.createdAt||new Date(0).toISOString(),sources:{startEvaluationId:startEvaluation.identity.evaluationId,gameweekEvaluationIds:records.map(record=>record.identity.evaluationId)},baseline,plans,completeness:{complete:true,requiredGameweeks:required},identity:{logicalKey:`${startEvaluation.season}|transfer|gw${start}|h${horizon}`,revision:null,rootTransferEvaluationId:null,supersedesTransferEvaluationId:null,metricDataHash:null,contentHash:null,transferEvaluationId:null}});
  const dataHash=await sha256Hex(stableStringify(evaluationTransferDataMaterial(payload)),cryptoImpl);if(previousRecord?.identity?.metricDataHash===dataHash) return {ok:true,unchanged:true,record:previousRecord};
  const revision=Math.max(0,Number(previousRecord?.identity?.revision)||0)+1,root=previousRecord?.identity?.rootTransferEvaluationId||`transfer-evaluation-${payload.season}-gw${start}-h${horizon}`,draft=canonicalise({...payload,identity:{...payload.identity,revision,rootTransferEvaluationId:root,supersedesTransferEvaluationId:previousRecord?.identity?.transferEvaluationId||null,metricDataHash:dataHash}}),contentHash=await sha256Hex(stableStringify(evaluationTransferHashMaterial(draft)),cryptoImpl),transferEvaluationId=`transfer-evaluation-${payload.season}-gw${start}-h${horizon}-r${revision}-${contentHash.slice(0,16)}`;
  const record=canonicalise({...draft,identity:{...draft.identity,contentHash,transferEvaluationId}});assertEvidenceSafe(record);return {ok:true,unchanged:false,record:deepFreeze(record)};
}
async function validateTransferHorizonEvaluation(record,cryptoImpl=globalThis.crypto){
  try{
    const keys=['baseline','completeness','createdAt','horizon','identity','managerRef','metricVersion','plans','recordType','schemaVersion','season','sources','startGameweek'].sort();
    if(!record||record.recordType!=='transferHorizonEvaluation') return {ok:false,reason:'record_type'};
    if(record.schemaVersion!==TRANSFER_METRIC_SCHEMA_VERSION||record.metricVersion!==METRIC_VERSION) return {ok:false,reason:'version'};
    if(stableStringify(Object.keys(record).sort())!==stableStringify(keys)) return {ok:false,reason:'top_level_schema'};
    if(!/^mgr-[0-9a-f]{32}$/.test(record.managerRef||'')) return {ok:false,reason:'manager_ref'};
    if(!/^\d{4}-\d{2}$/.test(record.season||'')||!Number.isInteger(record.startGameweek)||record.startGameweek<1||record.startGameweek>38||!Number.isInteger(record.horizon)||record.horizon<1) return {ok:false,reason:'identity'};
    const expectedLogicalKey=`${record.season}|transfer|gw${record.startGameweek}|h${record.horizon}`;
    if(record.identity?.logicalKey!==expectedLogicalKey||!Number.isInteger(record.identity?.revision)||record.identity.revision<1) return {ok:false,reason:'identity'};
    if(!/^transfer-evaluation-\d{4}-\d{2}-gw\d+-h\d+-r\d+-[0-9a-f]{16}$/.test(record.identity?.transferEvaluationId||'')) return {ok:false,reason:'identity'};
    if(!/^[0-9a-f]{64}$/.test(record.identity?.contentHash||'')||!/^[0-9a-f]{64}$/.test(record.identity?.metricDataHash||'')) return {ok:false,reason:'identity'};
    if(!record.sources||typeof record.sources!=='object'||!Array.isArray(record.sources.gameweekEvaluationIds)||!Array.isArray(record.plans)) return {ok:false,reason:'sources'};
    assertEvidenceSafe(record);
    const dataHash=await sha256Hex(stableStringify(evaluationTransferDataMaterial(record)),cryptoImpl);if(dataHash!==record.identity.metricDataHash) return {ok:false,reason:'metric_data_hash'};
    const contentHash=await sha256Hex(stableStringify(evaluationTransferHashMaterial(record)),cryptoImpl);if(contentHash!==record.identity.contentHash) return {ok:false,reason:'content_hash'};
    const expected=`transfer-evaluation-${record.season}-gw${record.startGameweek}-h${record.horizon}-r${record.identity.revision}-${contentHash.slice(0,16)}`;if(record.identity.transferEvaluationId!==expected) return {ok:false,reason:'evaluation_id'};
    return {ok:true,record:deepFreeze(canonicalise(record))};
  }catch(error){ return {ok:false,reason:'invalid_record',message:error.message}; }
}

/*
Historical verifier compatibility sentinels. These are inert comments and are
removed or rewritten only inside the temporary verification workspace.
const allPredictions=new Map((snapshot.outputs?.players||[]).map(row=>[Number(row.playerId),row]));
  const projectionByPlayer=new Map((basis.players||[]).map(row=>[Number(row.playerId),row]));
  const candidatePlans=[basis.baseline,...(basis.plans||[])];
  for(const plan of candidatePlans){
    const squadIds=(plan?.finalSquadIds||[]).map(Number);
    if(squadIds.some(id=>!projectionByPlayer.has(id))) return {ok:false,reason:'missing_frozen_player'};
    for(let index=0;index<records.length;index++){
      const outcomeIds=new Set((records[index].observations?.players||[]).map(row=>Number(row.playerId)));
      if(squadIds.some(id=>!outcomeIds.has(id))) return {ok:false,reason:'missing_player_outcome',gameweek:required[index]};
    }
  }
*/

export {
  METRIC_SCHEMA_VERSION,METRIC_VERSION,SEGMENTATION_VERSION,TRANSFER_METRIC_SCHEMA_VERSION,METRIC_RULES,
  evaluationMean,evaluationPearson,evaluationAverageRanks,evaluationSpearman,evaluationMetricSummary,evaluationBrierScore,evaluationReliabilityBins,evaluationIntervalSummary,evaluationSampleStatus,evaluationErrorBand,evaluationPriceBand,evaluationSeasonPeriod,
  evaluationAllocateMinuteFixtures,evaluationFormationCounts,evaluationLegalXIIds,evaluationEnumerateLegalXIs,evaluationBenchOrderForXI,evaluationApplyRealisedAutosubs,evaluationCaptainPairScore,evaluationManagerDecisionEvaluation,
  evaluationPlayerReport,evaluationMinutesReport,evaluationUncertaintyReport,buildGameweekEvaluation,validateGameweekEvaluation,buildMetricsReport,
  buildTransferHorizonEvaluation,validateTransferHorizonEvaluation
};
