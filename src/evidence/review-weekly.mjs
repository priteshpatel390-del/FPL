import { canonicalise,deepFreeze,assertEvidenceSafe } from './snapshot.mjs';
import { evaluationSampleStatus } from './metrics.mjs';
import {
  OPERATING_REVIEW_SCHEMA_VERSION,OPERATING_REVIEW_VERSION,OPERATING_REVIEW_RULES,operatingReviewLatestMetadata,
  operatingReviewSnapshotStatus,operatingReviewOutcomeStatus,operatingReviewEvaluationStatus,operatingReviewDecoratePlayerRows,
  operatingReviewDecorateMinuteRows,operatingReviewPlayerMaps,operatingReviewTransferStatus,operatingReviewCorrectionSummary,operatingReviewWarnings,operatingReviewIso,operatingReviewUnique
} from './review-common.mjs';

function buildWeeklyOperatingReview({
  gameweek,snapshot=null,snapshotMetadata=[],outcome=null,outcomeMetadata=[],evaluation=null,
  transferEvaluations=[],availableEvaluationGameweeks=[],revisionRows=[]
}={}){
  const resolvedGameweek=Number(gameweek??evaluation?.gameweek??outcome?.gameweek??snapshot?.gameweek);
  if(!Number.isInteger(resolvedGameweek)||resolvedGameweek<1||resolvedGameweek>38) throw new Error('Weekly operating review requires a valid Gameweek');
  const snapshotMeta=(snapshot&&snapshotMetadata||[]).find(row=>row.snapshotId===snapshot?.identity?.snapshotId)||operatingReviewLatestMetadata(snapshotMetadata,resolvedGameweek);
  const outcomeMeta=operatingReviewLatestMetadata(outcomeMetadata,resolvedGameweek,{currentOnly:true});
  const snapshotStatus=operatingReviewSnapshotStatus(snapshot,snapshotMeta),outcomeStatus=operatingReviewOutcomeStatus(outcome,outcomeMeta),evaluationStatus=operatingReviewEvaluationStatus(evaluation,outcomeStatus);
  const playerRows=operatingReviewDecoratePlayerRows(evaluation,snapshot),minuteRows=operatingReviewDecorateMinuteRows(evaluation,snapshot),playerMaps=operatingReviewPlayerMaps(snapshot),frozenModel=snapshot?.outputs?.squad?.modelDecision;
  const frozenDecision=frozenModel?canonicalise({formation:frozenModel.formation||null,xiProjectedPoints:frozenModel.xiProjectedPoints??null,selectedXIPlayerIds:frozenModel.bestXIPlayerIds||[],benchPlayerIds:frozenModel.benchPlayerIds||[],captainId:frozenModel.captainId??null,captainName:playerMaps.playerNames.get(Number(frozenModel.captainId))||null,viceCaptainId:frozenModel.viceCaptainId??null,viceCaptainName:playerMaps.playerNames.get(Number(frozenModel.viceCaptainId))||null}):null;
  const sample=evaluationSampleStatus(playerRows.length,evaluation?1:0),transfer=operatingReviewTransferStatus(evaluation,transferEvaluations,availableEvaluationGameweeks),corrections=operatingReviewCorrectionSummary(resolvedGameweek,outcome,evaluation,revisionRows);
  const fullEvidence=Boolean(snapshot&&outcome&&evaluation),reviewComplete=Boolean(evaluation?.completeness?.complete);
  const missingReasons=[];
  if(!snapshot) missingReasons.push('snapshot_full_record_unavailable');
  if(!outcome) missingReasons.push('outcome_full_record_unavailable');
  if(!evaluation) missingReasons.push('evaluation_unavailable');
  for(const [key,value] of Object.entries(evaluation?.completeness?.missingReasons||{})) if(Number(value)>0) missingReasons.push(`${key}:${value}`);
  const review=canonicalise({
    recordType:'weeklyOperatingReview',schemaVersion:OPERATING_REVIEW_SCHEMA_VERSION,reviewVersion:OPERATING_REVIEW_VERSION,
    season:String(evaluation?.season||outcome?.season||snapshot?.season||''),gameweek:resolvedGameweek,
    deadlineTime:operatingReviewIso(evaluation?.deadlineTime||outcome?.officialDeadlineIdentity?.deadlineTime||snapshot?.deadlineTime),
    status:{snapshot:snapshotStatus,outcome:outcomeStatus,evaluation:evaluationStatus,transferHorizon:transfer.status},
    completeness:{status:fullEvidence&&reviewComplete?'complete':'partial',fullEvidence,reviewComplete,missingReasons:operatingReviewUnique(missingReasons)},
    sourceRefs:{
      snapshotId:snapshot?.identity?.snapshotId||snapshotMeta?.snapshotId||null,snapshotContentHash:snapshot?.identity?.contentHash||snapshotMeta?.contentHash||null,
      outcomeId:outcome?.identity?.outcomeId||outcomeMeta?.outcomeId||null,outcomeContentHash:outcome?.identity?.contentHash||outcomeMeta?.contentHash||null,
      evaluationId:evaluation?.identity?.evaluationId||null,evaluationContentHash:evaluation?.identity?.contentHash||null
    },
    coverage:evaluation?.coverage||null,reports:evaluation?.reports||null,
    headline:evaluation?{
      observations:evaluation.reports?.player?.n??playerRows.length,
      playerMae:evaluation.reports?.player?.mae??null,playerRmse:evaluation.reports?.player?.rmse??null,playerBias:evaluation.reports?.player?.bias??null,
      predictedMean:evaluation.reports?.player?.predictedMean??null,observedMean:evaluation.reports?.player?.observedMean??null,
      withinTwo:evaluation.reports?.player?.withinTwo??null,matchedPlayers:evaluation.coverage?.matchedPlayers??playerRows.length,
      coverage:evaluation.coverage?.coverage??null,scheduleAlignedPlayers:evaluation.coverage?.scheduleAlignedPlayers??null
    }:null,
    players:playerRows,minuteFixtures:minuteRows,frozenDecision,decisions:evaluation?.decisions||null,
    providerContext:(snapshot?.providers||[]).slice().sort((a,b)=>OPERATING_REVIEW_RULES.providerOrder.indexOf(a.provider)-OPERATING_REVIEW_RULES.providerOrder.indexOf(b.provider)),
    transferHorizon:transfer,corrections,sample,warnings:[]
  });
  review.warnings=operatingReviewWarnings({evaluation,snapshot,outcome,sample,transfer,corrections});
  assertEvidenceSafe(review);
  return deepFreeze(canonicalise(review));
}

export { buildWeeklyOperatingReview };
