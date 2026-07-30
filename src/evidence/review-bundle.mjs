import { canonicalise,stableStringify,sha256Hex,deepFreeze,assertEvidenceSafe } from './snapshot.mjs';
import {
  OPERATING_REVIEW_SCHEMA_VERSION,OPERATING_REVIEW_VERSION,OPERATING_EXPORT_FORMAT_VERSION,operatingReviewRecordId,
  operatingReviewLogicalKey,operatingReviewRecordTime,operatingReviewSortRecords,operatingReviewCurrentRecords,
  operatingReviewMetadataRecordId,operatingReviewMetadataType,operatingReviewMetadataGameweek,operatingReviewMetadataTime,
  operatingReviewRevision,operatingReviewUnique
} from './review-common.mjs';
import { buildWeeklyOperatingReview } from './review-weekly.mjs';
import { buildSeasonOperatingReview } from './review-season.mjs';

function operatingReviewManifestEntry(record,{current=true,fullRecordAvailable=true,origin='local',includedInBundle=true}={}){
  const id=operatingReviewRecordId(record),type=record?.recordType;
  return canonicalise({
    recordType:type,recordId:id,logicalKey:operatingReviewLogicalKey(record),rootRecordId:record?.identity?.rootOutcomeId||record?.identity?.rootEvaluationId||record?.identity?.rootTransferEvaluationId||id,
    season:record?.season||null,gameweek:Number(record?.gameweek??record?.startGameweek)||null,horizon:record?.horizon??null,
    schemaVersion:record?.schemaVersion||null,metricVersion:record?.metricVersion||null,segmentationVersion:record?.segmentationVersion||null,
    revision:operatingReviewRevision(record),current:Boolean(current),status:record?.status||record?.completeness?.status||null,origin,fullRecordAvailable:Boolean(fullRecordAvailable),
    includedInBundle:Boolean(includedInBundle),contentHash:record?.identity?.contentHash||null,dataHash:record?.identity?.outcomeDataHash||record?.identity?.metricDataHash||null,
    supersedesRecordId:record?.identity?.supersedesOutcomeId||record?.identity?.supersedesEvaluationId||record?.identity?.supersedesTransferEvaluationId||null,
    recordedAt:operatingReviewRecordTime(record),availabilityReason:fullRecordAvailable?null:'full_record_pruned'
  });
}
function operatingReviewMetadataManifestEntry(row,fullIds,includedIds){
  const id=operatingReviewMetadataRecordId(row),type=operatingReviewMetadataType(row);
  return canonicalise({
    recordType:type,recordId:id,logicalKey:row?.logicalKey||row?.rootOutcomeId||id,rootRecordId:row?.rootOutcomeId||id,
    season:row?.season||null,gameweek:operatingReviewMetadataGameweek(row),horizon:row?.horizon??null,schemaVersion:null,metricVersion:null,segmentationVersion:null,
    revision:Math.max(1,Number(row?.revision)||1),current:row?.current!==false,status:row?.status||row?.timingGrade||null,origin:row?.origin||'local',
    fullRecordAvailable:fullIds.has(id),includedInBundle:includedIds.has(id),contentHash:row?.contentHash||null,dataHash:row?.outcomeDataHash||null,supersedesRecordId:null,
    recordedAt:operatingReviewMetadataTime(row),availabilityReason:fullIds.has(id)?null:'full_record_pruned'
  });
}
function operatingReviewBuildManifest(records,metadataRows,includedRecords=records){
  const fullIds=new Set((records||[]).map(operatingReviewRecordId).filter(Boolean)),includedIds=new Set((includedRecords||[]).map(operatingReviewRecordId).filter(Boolean)),entries=new Map();
  for(const record of records||[]) entries.set(operatingReviewRecordId(record),operatingReviewManifestEntry(record,{includedInBundle:includedIds.has(operatingReviewRecordId(record))}));
  for(const row of metadataRows||[]){
    const id=operatingReviewMetadataRecordId(row); if(!id) continue;
    const existing=entries.get(id),metadata=operatingReviewMetadataManifestEntry(row,fullIds,includedIds);
    entries.set(id,existing?canonicalise({...existing,current:metadata.current,origin:metadata.origin,fullRecordAvailable:true,includedInBundle:metadata.includedInBundle}):metadata);
  }
  return [...entries.values()].sort((a,b)=>String(a.recordType).localeCompare(String(b.recordType))||String(a.logicalKey).localeCompare(String(b.logicalKey))||a.revision-b.revision||String(a.recordId).localeCompare(String(b.recordId)));
}
function operatingReviewEvidenceThrough(records){
  return (records||[]).map(operatingReviewRecordTime).filter(Boolean).sort().at(-1)||new Date(0).toISOString();
}
function operatingReviewVersionSets(records){
  return canonicalise({
    snapshotSchemas:operatingReviewUnique((records||[]).filter(row=>row.recordType==='preDeadlineSnapshot').map(row=>row.schemaVersion)),
    outcomeSchemas:operatingReviewUnique((records||[]).filter(row=>row.recordType==='gameweekOutcome').map(row=>row.schemaVersion)),
    evaluationSchemas:operatingReviewUnique((records||[]).filter(row=>row.recordType==='gameweekEvaluation').map(row=>row.schemaVersion)),
    transferEvaluationSchemas:operatingReviewUnique((records||[]).filter(row=>row.recordType==='transferHorizonEvaluation').map(row=>row.schemaVersion)),
    model:operatingReviewUnique((records||[]).map(row=>row.versions?.model||row.build?.modelVersion)),rules:operatingReviewUnique((records||[]).map(row=>row.versions?.rules||row.build?.rulesVersion)),
    metrics:operatingReviewUnique((records||[]).map(row=>row.metricVersion)),segmentation:operatingReviewUnique((records||[]).map(row=>row.segmentationVersion)),
    review:[OPERATING_REVIEW_VERSION],exportFormat:[OPERATING_EXPORT_FORMAT_VERSION]
  });
}
function operatingReviewBundleHashMaterial(bundle){
  const copy=canonicalise(bundle); if(copy.identity){delete copy.identity.contentHash;delete copy.identity.bundleId;} return copy;
}
async function buildOperatingReviewBundle({
  profile='season_review',season=null,fromGameweek=null,toGameweek=null,
  snapshots=[],outcomes=[],evaluations=[],transferEvaluations=[],snapshotMetadata=[],outcomeMetadata=[],metricMetadata=[],cryptoImpl=globalThis.crypto
}={}){
  if(!['weekly_evidence','season_review'].includes(profile)) throw new Error('Operating review profile is not supported');
  const allRecords=operatingReviewSortRecords([...snapshots,...outcomes,...evaluations,...transferEvaluations]),allMetadata=[...snapshotMetadata,...outcomeMetadata,...metricMetadata];
  const availableGameweeks=operatingReviewUnique([
    ...allRecords.map(row=>Number(row?.gameweek??row?.startGameweek)).filter(Number.isFinite),
    ...allMetadata.map(row=>Number(row?.gameweek)).filter(Number.isFinite)
  ]).map(Number).sort((a,b)=>a-b);
  const resolvedFrom=Number(fromGameweek??availableGameweeks[0]),resolvedTo=Number(toGameweek??availableGameweeks.at(-1));
  if(!Number.isInteger(resolvedFrom)||!Number.isInteger(resolvedTo)||resolvedFrom<1||resolvedTo>38||resolvedFrom>resolvedTo) throw new Error('Operating review range is invalid');
  const scopeGameweeks=Array.from({length:resolvedTo-resolvedFrom+1},(_,index)=>resolvedFrom+index),filterRecord=record=>{
    const gameweek=Number(record?.gameweek??record?.startGameweek); return gameweek>=resolvedFrom&&gameweek<=resolvedTo;
  };
  const scopedSnapshots=operatingReviewSortRecords(snapshots.filter(filterRecord)),scopedOutcomes=operatingReviewSortRecords(outcomes.filter(filterRecord)),scopedEvaluations=operatingReviewSortRecords(evaluations.filter(filterRecord)),scopedTransfers=operatingReviewSortRecords(transferEvaluations.filter(filterRecord));
  const currentOutcomeIds=new Set(outcomeMetadata.filter(row=>row.origin==='local_collection'&&row.current!==false).map(row=>row.outcomeId));
  const currentMetricIds=new Set(metricMetadata.filter(row=>row.current!==false).map(row=>row.recordId));
  const currentOutcomes=outcomeMetadata.length?scopedOutcomes.filter(record=>currentOutcomeIds.has(record.identity?.outcomeId)):operatingReviewCurrentRecords(scopedOutcomes,'gameweekOutcome');
  const currentEvaluations=metricMetadata.length?scopedEvaluations.filter(record=>currentMetricIds.has(record.identity?.evaluationId)):operatingReviewCurrentRecords(scopedEvaluations,'gameweekEvaluation');
  const currentTransfers=metricMetadata.length?scopedTransfers.filter(record=>currentMetricIds.has(record.identity?.transferEvaluationId)):operatingReviewCurrentRecords(scopedTransfers,'transferHorizonEvaluation');
  const fullWeeklyReviews=scopeGameweeks.map(gameweek=>{
    const metadataBySnapshot=new Map(snapshotMetadata.filter(row=>Number(row.gameweek)===gameweek).map(row=>[row.snapshotId,row]));
    const snapshot=scopedSnapshots.filter(row=>Number(row.gameweek)===gameweek).sort((a,b)=>{const am=metadataBySnapshot.get(a.identity?.snapshotId),bm=metadataBySnapshot.get(b.identity?.snapshotId),local=Number(bm?.origin==='local_capture')-Number(am?.origin==='local_capture');if(local)return local;const official=Number(Boolean(bm?.officialEligible))-Number(Boolean(am?.officialEligible));if(official)return official;return Date.parse(operatingReviewRecordTime(b))-Date.parse(operatingReviewRecordTime(a));})[0]||null;
    const outcome=currentOutcomes.find(row=>Number(row.gameweek)===gameweek)||null,evaluation=currentEvaluations.find(row=>Number(row.gameweek)===gameweek)||null;
    return buildWeeklyOperatingReview({gameweek,snapshot,snapshotMetadata:snapshotMetadata.filter(row=>Number(row.gameweek)===gameweek),outcome,outcomeMetadata:outcomeMetadata.filter(row=>Number(row.gameweek)===gameweek),evaluation,transferEvaluations:currentTransfers,availableEvaluationGameweeks:currentEvaluations.map(row=>row.gameweek),revisionRows:allMetadata});
  });
  const weeklyReviews=profile==='season_review'?fullWeeklyReviews.map(review=>canonicalise({...review,players:[],minuteFixtures:[],rowDetailsOmitted:true})):fullWeeklyReviews;
  const availableRecords=[...scopedSnapshots,...scopedOutcomes,...scopedEvaluations,...scopedTransfers],includedRecords=[...scopedSnapshots,...(profile==='weekly_evidence'?[...scopedOutcomes,...scopedEvaluations]:[]),...scopedTransfers];
  const manifest=operatingReviewBuildManifest(availableRecords,allMetadata.filter(row=>Number(row.gameweek)>=resolvedFrom&&Number(row.gameweek)<=resolvedTo),includedRecords);
  const missingFullRecordIds=manifest.filter(row=>!row.fullRecordAvailable).map(row=>row.recordId),missingEvaluationGameweeks=scopeGameweeks.filter(gameweek=>!currentEvaluations.some(row=>Number(row.gameweek)===gameweek));
  const selectedSeason=String(season||currentEvaluations[0]?.season||currentOutcomes[0]?.season||scopedSnapshots[0]?.season||'');
  const draft=canonicalise({
    recordType:'operatingReviewBundle',schemaVersion:OPERATING_REVIEW_SCHEMA_VERSION,exportFormatVersion:OPERATING_EXPORT_FORMAT_VERSION,reviewVersion:OPERATING_REVIEW_VERSION,
    profile,scope:{season:selectedSeason,fromGameweek:resolvedFrom,toGameweek:resolvedTo,gameweeks:scopeGameweeks,currentRevisionPolicy:'local_current_pointer_else_highest_valid_revision',includeSupersededMetadata:true,includeAvailableSupersededRecords:true},
    evidenceThrough:operatingReviewEvidenceThrough([...scopedSnapshots,...scopedOutcomes,...scopedEvaluations,...scopedTransfers]),
    build:{commits:operatingReviewUnique([...scopedSnapshots,...scopedOutcomes,...scopedEvaluations,...scopedTransfers].map(row=>row.build?.commit)),sourceHashes:operatingReviewUnique([...scopedSnapshots,...scopedOutcomes,...scopedEvaluations,...scopedTransfers].map(row=>row.build?.sourceHash))},
    versions:operatingReviewVersionSets([...scopedSnapshots,...scopedOutcomes,...scopedEvaluations,...scopedTransfers]),
    completeness:{status:missingFullRecordIds.length||missingEvaluationGameweeks.length?'partial':'complete',missingFullRecordIds,profileExcludedRecordIds:manifest.filter(row=>row.fullRecordAvailable&&!row.includedInBundle).map(row=>row.recordId),missingEvaluationGameweeks,pendingTransferHorizons:weeklyReviews.filter(row=>row.transferHorizon?.status==='in_progress').map(row=>row.gameweek)},
    manifest:{records:manifest},
    records:{snapshots:scopedSnapshots,outcomes:profile==='weekly_evidence'?scopedOutcomes:[],gameweekEvaluations:profile==='weekly_evidence'?scopedEvaluations:[],transferHorizonEvaluations:scopedTransfers},
    weeklyReviews,cumulativeReview:buildSeasonOperatingReview(currentEvaluations,currentTransfers),
    identity:{manifestHash:null,reviewDataHash:null,contentHash:null,bundleId:null}
  });
  assertEvidenceSafe(draft);
  const manifestHash=await sha256Hex(stableStringify(draft.manifest),cryptoImpl),reviewDataHash=await sha256Hex(stableStringify({weeklyReviews:draft.weeklyReviews,cumulativeReview:draft.cumulativeReview}),cryptoImpl);
  const withHashes=canonicalise({...draft,identity:{...draft.identity,manifestHash,reviewDataHash}}),contentHash=await sha256Hex(stableStringify(operatingReviewBundleHashMaterial(withHashes)),cryptoImpl),bundleId=`operating-review-${selectedSeason}-gw${String(resolvedFrom).padStart(2,'0')}-gw${String(resolvedTo).padStart(2,'0')}-${contentHash.slice(0,16)}`;
  const bundle=canonicalise({...withHashes,identity:{...withHashes.identity,contentHash,bundleId}}); assertEvidenceSafe(bundle); return deepFreeze(bundle);
}

export { buildOperatingReviewBundle };
