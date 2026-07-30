import { canonicalise,deepFreeze,assertEvidenceSafe } from './snapshot.mjs';
import { buildMetricsReport,evaluationPlayerReport,evaluationSampleStatus } from './metrics.mjs';
import { OPERATING_REVIEW_SCHEMA_VERSION,OPERATING_REVIEW_VERSION,OPERATING_REVIEW_RULES,operatingReviewUnique,operatingReviewCurrentRecords,operatingReviewRevision } from './review-common.mjs';

function operatingReviewSegmentDimension(dimension){
  const value=String(dimension||'overall');
  return OPERATING_REVIEW_RULES.approvedSegments.includes(value)?value:'overall';
}
function operatingReviewProviderSummary(evaluations){
  const current=operatingReviewCurrentRecords(evaluations,'gameweekEvaluation');
  const rows=current.flatMap(record=>(record.observations?.players||[]).map(row=>({...row,gameweek:record.gameweek})));
  const summaries=[];
  for(const provider of OPERATING_REVIEW_RULES.providerOrder){
    const states=operatingReviewUnique(rows.map(row=>row.segments?.providerStates?.[provider]||'unknown'));
    for(const state of states){
      const selected=rows.filter(row=>String(row.segments?.providerStates?.[provider]||'unknown')===state),gameweeks=new Set(selected.map(row=>row.gameweek)).size;
      summaries.push(canonicalise({provider,state,observations:selected.length,gameweeks,metrics:evaluationPlayerReport(selected),sample:evaluationSampleStatus(selected.length,gameweeks,{kind:'provider'}),warning:'Provider-state comparisons are observational and clustered by Gameweek; they are not causal.'}));
    }
  }
  return summaries;
}
function operatingReviewSelectedReport(current,dimension,value){
  if(dimension!=='providerState') return buildMetricsReport(current,{dimension,value});
  const [provider,state]=String(value||'').split('=');
  if(!OPERATING_REVIEW_RULES.providerOrder.includes(provider)||!state) return buildMetricsReport([],{dimension:'overall',value:'all'});
  const filtered=current.map(record=>{
    const players=(record.observations?.players||[]).filter(row=>String(row.segments?.providerStates?.[provider]||'unknown')===state),ids=new Set(players.map(row=>Number(row.playerId)));
    return canonicalise({...record,observations:{...record.observations,players,minuteFixtures:(record.observations?.minuteFixtures||[]).filter(row=>ids.has(Number(row.playerId)))}});
  });
  return buildMetricsReport(filtered,{dimension:'overall',value:'all'});
}
function buildSeasonOperatingReview(evaluations,transferEvaluations=[],{dimension='overall',value='all'}={}){
  const current=operatingReviewCurrentRecords(evaluations,'gameweekEvaluation').filter(record=>record?.completeness?.complete),resolvedDimension=operatingReviewSegmentDimension(dimension),resolvedValue=resolvedDimension==='overall'?'all':String(value??'all');
  const overall=buildMetricsReport(current,{dimension:'overall',value:'all'}),scheduleAligned=buildMetricsReport(current,{dimension:'schedule',value:'schedule_aligned'}),selected=operatingReviewSelectedReport(current,resolvedDimension,resolvedValue);
  const coverageTrend=current.map(record=>canonicalise({
    gameweek:Number(record.gameweek),evaluationId:record.identity?.evaluationId||null,revision:operatingReviewRevision(record),outcomeStatus:record.sources?.outcomeStatus||null,
    matchedPlayers:record.coverage?.matchedPlayers??0,eligiblePredictions:record.coverage?.eligiblePredictions??0,coverage:record.coverage?.coverage??null,
    scheduleAlignedPlayers:record.coverage?.scheduleAlignedPlayers??0,minuteFixtureRows:record.coverage?.minuteFixtureRows??0,
    unallocatableMinuteRows:record.coverage?.unallocatableMinuteRows??0,startLabelRows:record.coverage?.startLabelRows??0,
    uncertaintyRows:record.coverage?.uncertaintyRows??0,missingPredictions:record.coverage?.unmatchedPredictions?.length??0,missingOutcomes:record.coverage?.unmatchedOutcomes?.length??0,
    managerOutcomeStatus:record.decisions?.managerOutcome?.status||'not_available',corrected:operatingReviewRevision(record)>1||record.sources?.outcomeStatus==='corrected'
  })).sort((a,b)=>a.gameweek-b.gameweek);
  const transfers=operatingReviewCurrentRecords(transferEvaluations,'transferHorizonEvaluation').map(record=>canonicalise({
    transferEvaluationId:record.identity?.transferEvaluationId||null,revision:operatingReviewRevision(record),startGameweek:Number(record.startGameweek),horizon:Number(record.horizon),
    requiredGameweeks:record.completeness?.requiredGameweeks||[],baseline:record.baseline,plans:record.plans,
    warning:'Frozen horizons may overlap or represent alternatives and are not summed into a season transfer score.'
  }));
  const review=canonicalise({
    recordType:'seasonOperatingReview',schemaVersion:OPERATING_REVIEW_SCHEMA_VERSION,reviewVersion:OPERATING_REVIEW_VERSION,
    season:String(current[0]?.season||''),gameweeks:current.map(record=>Number(record.gameweek)).sort((a,b)=>a-b),
    status:{evaluatedGameweeks:current.length,correctedGameweeks:coverageTrend.filter(row=>row.corrected).length},
    overall,scheduleAligned,selected:{dimension:resolvedDimension,value:resolvedValue,report:selected},
    coverageTrend,providerStateContext:operatingReviewProviderSummary(current),transferHorizons:transfers,
    safeguards:{compositeScore:false,oneSegmentAtATime:true,approvedSegments:OPERATING_REVIEW_RULES.approvedSegments,
      warning:'Results are descriptive. Small samples, schedule changes, corrections and missing evidence remain visible; no validated-accuracy claim is made.'}
  });
  assertEvidenceSafe(review);
  return deepFreeze(review);
}

export { buildSeasonOperatingReview };
