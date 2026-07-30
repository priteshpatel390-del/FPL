import {
  canonicalise, stableStringify, sha256Hex, deepFreeze, assertEvidenceSafe, validateSnapshotRecord
} from './snapshot.mjs';
import { validateOutcomeRecord } from './outcome.mjs';
import {
  buildMetricsReport, evaluationSampleStatus, validateGameweekEvaluation, validateTransferHorizonEvaluation
} from './metrics.mjs';

const REVIEW_SCHEMA_VERSION='1.0.0';
const REVIEW_EXPORT_FORMAT_VERSION='1.0.0';
const REVIEW_VERSION='1.0.0';
const REVIEW_RULES=Object.freeze({
  warningBytes:10*1024*1024,
  maxBytes:25*1024*1024,
  csvTables:Object.freeze([
    'gameweeks','players','minute_fixtures','squad_decisions',
    'transfer_horizons','transfer_horizon_gameweeks','provider_states','revisions'
  ])
});

function reviewFinite(value){
  if(value===null||value===undefined||value==='') return null;
  const number=Number(value);
  return Number.isFinite(number)?number:null;
}
function reviewRound(value){return Number.isFinite(value)?Number(value.toFixed(8)):null;}
function reviewIso(value){const time=Date.parse(value);return Number.isFinite(time)?new Date(time).toISOString():null;}
function reviewSortNumbers(values){return [...new Set((values||[]).map(Number).filter(Number.isFinite))].sort((a,b)=>a-b);}
function reviewSortRecords(records){
  return [...(records||[])].sort((a,b)=>{
    const ag=Number(a?.gameweek??a?.startGameweek??0),bg=Number(b?.gameweek??b?.startGameweek??0);
    if(ag!==bg) return ag-bg;
    const ar=Number(a?.identity?.revision)||0,br=Number(b?.identity?.revision)||0;
    if(ar!==br) return ar-br;
    return String(reviewRecordId(a)||'').localeCompare(String(reviewRecordId(b)||''));
  });
}
function reviewRecordId(record){
  return record?.identity?.snapshotId||record?.identity?.outcomeId||record?.identity?.evaluationId||record?.identity?.transferEvaluationId||null;
}
function reviewLogicalKey(record){
  return record?.identity?.logicalKey||`${record?.season||'unknown'}|${record?.recordType||'record'}|gw${record?.gameweek??record?.startGameweek??'unknown'}`;
}
function reviewContentHash(record){return record?.identity?.contentHash||null;}
function reviewDataHash(record){return record?.identity?.metricDataHash||record?.identity?.outcomeDataHash||null;}
function reviewRecordTimestamp(record){
  const candidates=[
    record?.createdAt,record?.collection?.completedAt,record?.collection?.finalisedAt,
    record?.capture?.completedAt,record?.capture?.capturedAt,record?.capturedAt
  ].map(reviewIso).filter(Boolean).sort();
  return candidates.at(-1)||null;
}
function reviewBuildIdentity(input){
  const value=input&&typeof input==='object'?input:(typeof BUILD_INFO!=='undefined'?BUILD_INFO:globalThis.BUILD_INFO);
  return canonicalise({
    commit:String(value?.commit||'unversioned'),
    sourceHash:String(value?.sourceHash||'unavailable'),
    modelVersion:String(value?.modelVersion||'unavailable'),
    rulesVersion:String(value?.rulesVersion||'unavailable')
  });
}
function reviewCurrentRecords(records){
  const selected=new Map();
  for(const record of reviewSortRecords(records)){
    if(!record||typeof record!=='object') continue;
    const key=reviewLogicalKey(record),prior=selected.get(key);
    const revision=Number(record.identity?.revision)||0,priorRevision=Number(prior?.identity?.revision)||0;
    if(!prior||revision>priorRevision||(revision===priorRevision&&String(reviewRecordId(record)).localeCompare(String(reviewRecordId(prior)))>0)) selected.set(key,record);
  }
  return reviewSortRecords([...selected.values()]);
}
function reviewIndexById(records){return new Map((records||[]).map(record=>[reviewRecordId(record),record]).filter(([id])=>Boolean(id)));}
function reviewIndexSnapshots(records){return new Map((records||[]).map(record=>[record?.identity?.snapshotId,record]).filter(([id])=>Boolean(id)));}
function reviewIndexOutcomes(records){return new Map((records||[]).map(record=>[record?.identity?.outcomeId,record]).filter(([id])=>Boolean(id)));}
function reviewSegmentValue(row,dimension){
  if(dimension==='overall') return 'all';
  if(dimension==='schedule') return row?.scheduleAligned?'schedule_aligned':'schedule_changed';
  return row?.segments?.[dimension]??'unknown';
}
function reviewTransferForEvaluation(evaluation,transfers){
  return (transfers||[]).find(record=>record?.sources?.startEvaluationId===evaluation?.identity?.evaluationId)||null;
}
function reviewProviderRows(snapshot){
  return (snapshot?.providers||[]).map(row=>canonicalise({
    provider:String(row.provider||''),state:String(row.state||'Unavailable'),included:Boolean(row.included),
    didAffectModel:Boolean(row.didAffectModel),acceptedCount:reviewFinite(row.acceptedCount??row.acceptedRecordCount),rejectedCount:reviewFinite(row.rejectedCount??row.rejectedRecordCount),
    lastSuccessAt:reviewIso(row.lastSuccessAt),recordedAt:reviewIso(row.recordedAt),ageMs:reviewFinite(row.ageMs),thresholdMs:reviewFinite(row.thresholdMs),
    note:row.note==null?null:String(row.note),consequence:row.consequence==null?null:String(row.consequence)
  })).sort((a,b)=>a.provider.localeCompare(b.provider));
}
function reviewWarnings(evaluation,snapshot,outcome,transfer){
  const warnings=[];
  const sample=evaluationSampleStatus(evaluation?.observations?.players?.length||0,1);
  warnings.push(sample.message);
  const changed=(evaluation?.observations?.players||[]).filter(row=>!row.scheduleAligned).length;
  if(changed) warnings.push(`${changed} player row${changed===1?'':'s'} had a changed official fixture schedule; use the schedule-aligned view alongside the overall result.`);
  const unallocatable=Number(evaluation?.coverage?.unallocatableMinuteRows)||0;
  if(unallocatable) warnings.push(`${unallocatable} player-fixture minute row${unallocatable===1?'':'s'} could not be safely allocated and remain excluded only from the affected denominator.`);
  if(!snapshot) warnings.push('The full source snapshot is no longer available in browser recovery; the review is partial.');
  if(!outcome) warnings.push('The full source outcome is unavailable; the review is partial.');
  if(evaluation?.decisions?.managerOutcome?.status!=='available') warnings.push('Official manager outcome is unavailable; squad/captain/bench coverage may be lower than player coverage.');
  if(evaluation?.decisions?.transferBasis&&!transfer) warnings.push('The frozen transfer horizon is still in progress or its full record is unavailable; no interim gain is shown.');
  return warnings;
}
function buildWeeklyOperatingReview(evaluation,{snapshot=null,outcome=null,transferEvaluation=null}={}){
  if(!evaluation||evaluation.recordType!=='gameweekEvaluation') throw new Error('Weekly operating review requires a gameweekEvaluation record');
  const players=evaluation.observations?.players||[],minutes=evaluation.observations?.minuteFixtures||[];
  const sample=evaluationSampleStatus(players.length,1);
  const transfer=transferEvaluation?canonicalise({
    status:'complete',transferEvaluationId:transferEvaluation.identity?.transferEvaluationId||null,
    revision:Number(transferEvaluation.identity?.revision)||1,startGameweek:Number(transferEvaluation.startGameweek),horizon:Number(transferEvaluation.horizon),
    baseline:transferEvaluation.baseline||null,plans:transferEvaluation.plans||[],requiredGameweeks:transferEvaluation.completeness?.requiredGameweeks||[]
  }):evaluation.decisions?.transferBasis?canonicalise({
    status:'horizon_in_progress',startGameweek:Number(evaluation.gameweek),horizon:Number(evaluation.decisions.transferBasis.horizon)||null,
    requiredGameweeks:Number.isFinite(Number(evaluation.decisions.transferBasis.horizon))?Array.from({length:Number(evaluation.decisions.transferBasis.horizon)},(_,index)=>Number(evaluation.gameweek)+index):[],
    missingGameweeks:null
  }):{status:'not_available'};
  return canonicalise({
    season:evaluation.season,gameweek:Number(evaluation.gameweek),deadlineTime:evaluation.deadlineTime,
    sourceIdentity:{
      evaluationId:evaluation.identity?.evaluationId||null,evaluationRevision:Number(evaluation.identity?.revision)||1,evaluationContentHash:evaluation.identity?.contentHash||null,
      snapshotId:evaluation.sources?.snapshotId||null,snapshotContentHash:evaluation.sources?.snapshotContentHash||null,
      outcomeId:evaluation.sources?.outcomeId||null,outcomeRevision:Number(evaluation.sources?.outcomeRevision)||null,outcomeDataHash:evaluation.sources?.outcomeDataHash||null,outcomeStatus:evaluation.sources?.outcomeStatus||null
    },
    status:{
      snapshot:snapshot?'available':'missing_full_record',outcome:outcome?'available':'missing_full_record',evaluation:evaluation.completeness?.complete?'complete':'partial',
      sample
    },
    headline:{
      matchedPlayers:Number(evaluation.coverage?.matchedPlayers)||players.length,playerRows:players.length,minuteFixtureRows:minutes.length,
      playerMae:reviewFinite(evaluation.reports?.player?.mae),playerBias:reviewFinite(evaluation.reports?.player?.bias),withinTwo:reviewFinite(evaluation.reports?.player?.withinTwo),
      predictedMean:reviewFinite(evaluation.reports?.player?.predictedMean),observedMean:reviewFinite(evaluation.reports?.player?.observedMean),
      scheduleAlignedPlayers:Number(evaluation.coverage?.scheduleAlignedPlayers)||players.filter(row=>row.scheduleAligned).length,
      unallocatableMinuteRows:Number(evaluation.coverage?.unallocatableMinuteRows)||minutes.filter(row=>row.observedMinutes===null).length
    },
    points:evaluation.reports?.player||null,minutes:evaluation.reports?.minutes||null,uncertainty:evaluation.reports?.uncertainty||null,
    decisions:evaluation.decisions||{status:'not_available'},transfer,providers:reviewProviderRows(snapshot),
    completeness:{evaluation:evaluation.completeness||null,coverage:evaluation.coverage||null,partial:!snapshot||!outcome||!evaluation.completeness?.complete},
    warnings:reviewWarnings(evaluation,snapshot,outcome,transferEvaluation)
  });
}
function reviewProviderSummary(currentEvaluations,snapshotById){
  const rows=[];
  for(const evaluation of currentEvaluations){
    const snapshot=snapshotById.get(evaluation.sources?.snapshotId);
    for(const provider of reviewProviderRows(snapshot)) rows.push({...provider,gameweek:Number(evaluation.gameweek)});
  }
  const groups=new Map();
  for(const row of rows){
    const key=`${row.provider}|${row.state}`,current=groups.get(key)||{provider:row.provider,state:row.state,gameweeks:0,affectedGameweeks:0,acceptedCount:0,rejectedCount:0};
    current.gameweeks++;if(row.didAffectModel) current.affectedGameweeks++;current.acceptedCount+=Number(row.acceptedCount)||0;current.rejectedCount+=Number(row.rejectedCount)||0;groups.set(key,current);
  }
  return [...groups.values()].sort((a,b)=>a.provider.localeCompare(b.provider)||a.state.localeCompare(b.state));
}
function reviewDecisionSummary(evaluations,transfers){
  const available=evaluations.filter(record=>record.decisions?.status==='available'||record.decisions?.squad);
  const squadRows=available.map(record=>record.decisions?.squad).filter(Boolean),captainRows=available.map(record=>record.decisions?.captaincy).filter(Boolean),benchRows=available.map(record=>record.decisions?.bench).filter(Boolean);
  return canonicalise({
    gameweeks:available.length,
    squadDecisions:squadRows.length,captainDecisions:captainRows.length,benchDecisions:benchRows.length,
    transferHorizons:(transfers||[]).map(record=>({startGameweek:Number(record.startGameweek),horizon:Number(record.horizon),transferEvaluationId:record.identity?.transferEvaluationId||null,revision:Number(record.identity?.revision)||1,status:record.completeness?.complete?'complete':'partial',plans:(record.plans||[]).length})),
    note:'Decision and transfer records are descriptive. Hindsight oracle values are not recommendations, and overlapping transfer horizons are not summed.'
  });
}
function buildCumulativeOperatingReview(evaluations,{snapshots=[],transferEvaluations=[],dimension='overall',value='all'}={}){
  const current=reviewCurrentRecords((evaluations||[]).filter(record=>record?.recordType==='gameweekEvaluation'&&record.completeness?.complete));
  const transfers=reviewCurrentRecords((transferEvaluations||[]).filter(record=>record?.recordType==='transferHorizonEvaluation'&&record.completeness?.complete));
  const snapshotById=reviewIndexSnapshots(snapshots);
  const overall=buildMetricsReport(current,{dimension:'overall',value:'all'}),aligned=buildMetricsReport(current,{dimension:'schedule',value:'schedule_aligned'}),selected=buildMetricsReport(current,{dimension,value});
  const coverageTrend=current.map(record=>canonicalise({
    gameweek:Number(record.gameweek),evaluationId:record.identity?.evaluationId||null,matchedPlayers:Number(record.coverage?.matchedPlayers)||0,
    eligiblePredictions:Number(record.coverage?.eligiblePredictions)||0,coverage:reviewFinite(record.coverage?.coverage),minuteFixtureRows:Number(record.coverage?.minuteFixtureRows)||0,
    unallocatableMinuteRows:Number(record.coverage?.unallocatableMinuteRows)||0,startLabelRows:Number(record.coverage?.startLabelRows)||0,
    uncertaintyRows:Number(record.coverage?.uncertaintyRows)||0,scheduleAlignedPlayers:Number(record.coverage?.scheduleAlignedPlayers)||0
  }));
  return canonicalise({
    season:current[0]?.season||null,throughGameweek:current.length?Math.max(...current.map(record=>Number(record.gameweek))):null,
    gameweeks:reviewSortNumbers(current.map(record=>record.gameweek)),
    overall,scheduleAligned:aligned,selectedSegment:{dimension,value,report:selected},coverageTrend,
    decisions:reviewDecisionSummary(current,transfers),providerStates:reviewProviderSummary(current,snapshotById),
    limitations:[
      'All-player and schedule-aligned results must be read together because structural blank zeroes can flatter overall metrics.',
      'Provider-state comparisons are observational and clustered by Gameweek; they do not establish causal provider value.',
      'Transfer-horizon gains are alternatives with overlapping windows and are not aggregated into one season total.',
      'No composite score, significance claim, calibration claim or model update is produced.'
    ]
  });
}
function reviewManifestEntry(record,currentIds){
  const id=reviewRecordId(record);
  return canonicalise({
    recordType:record.recordType,recordId:id,logicalKey:reviewLogicalKey(record),season:record.season||null,
    gameweek:Number(record.gameweek??record.startGameweek)||null,revision:Number(record.identity?.revision)||1,
    current:currentIds.has(id),contentHash:reviewContentHash(record),dataHash:reviewDataHash(record),recordedAt:reviewRecordTimestamp(record),hasFullRecord:true
  });
}
function reviewManifest(records,metadata=[]){
  const all=reviewSortRecords(records),currentIds=new Set(reviewCurrentRecords(all).map(reviewRecordId)),byId=new Map();
  for(const row of metadata){const entry=reviewMetadataEntry(row);if(entry)byId.set(entry.recordId,entry);}
  for(const record of all) byId.set(reviewRecordId(record),reviewManifestEntry(record,currentIds));
  return [...byId.values()].sort((a,b)=>Number(a.gameweek)-Number(b.gameweek)||Number(a.revision)-Number(b.revision)||String(a.recordId).localeCompare(String(b.recordId)));
}
function reviewScopeLabel(scope){return scope?.gameweek?`gw${String(scope.gameweek).padStart(2,'0')}`:'season';}
function reviewBundleHashMaterial(bundle){
  const copy=canonicalise(bundle);
  if(copy.identity){delete copy.identity.bundleHash;delete copy.identity.bundleId;}
  return copy;
}
function reviewRecordVersionsValid(record){
  if(record.recordType==='preDeadlineSnapshot') return record.schemaVersion==='1.0.0';
  if(record.recordType==='gameweekOutcome') return record.schemaVersion==='1.0.0';
  if(record.recordType==='gameweekEvaluation') return record.schemaVersion==='1.0.0'&&record.metricVersion==='1.0.0'&&record.segmentationVersion==='1.0.0';
  if(record.recordType==='transferHorizonEvaluation') return record.schemaVersion==='1.0.0'&&record.metricVersion==='1.0.0';
  return false;
}
async function reviewValidateSourceRecord(record,cryptoImpl=globalThis.crypto){
  if(record.recordType==='preDeadlineSnapshot') return validateSnapshotRecord(record,cryptoImpl);
  if(record.recordType==='gameweekOutcome') return validateOutcomeRecord(record,cryptoImpl);
  if(record.recordType==='gameweekEvaluation') return validateGameweekEvaluation(record,cryptoImpl);
  if(record.recordType==='transferHorizonEvaluation') return validateTransferHorizonEvaluation(record,cryptoImpl);
  return {ok:false,reason:'record_type'};
}
function reviewMetadataRecordType(row){
  if(row?.recordType) return row.recordType;
  if(row?.snapshotId) return 'preDeadlineSnapshot';
  if(row?.outcomeId) return 'gameweekOutcome';
  return null;
}
function reviewMetadataEntry(row){
  const recordType=reviewMetadataRecordType(row),recordId=row?.recordId||row?.snapshotId||row?.outcomeId||null;
  if(!recordType||!recordId) return null;
  const timestamp=reviewIso(row.createdAt||row.collectedAt||row.capturedAt||row.finalisedAt);
  return canonicalise({
    recordType,recordId,logicalKey:row.logicalKey||`${row.season||'unknown'}|${recordType}|gw${row.gameweek??'unknown'}`,
    season:row.season||null,gameweek:Number(row.gameweek??row.startGameweek)||null,revision:Number(row.revision)||1,
    current:Boolean(row.current??row.officialEligible),contentHash:row.contentHash||null,dataHash:row.outcomeDataHash||row.metricDataHash||null,
    recordedAt:timestamp,hasFullRecord:Boolean(row.hasFullRecord)
  });
}
function reviewMetadataInScope(row,season,gameweek){
  if(row?.season&&row.season!==season) return false;
  if(gameweek&&Number(row?.gameweek??row?.startGameweek)!==Number(gameweek)) return false;
  return true;
}
async function buildOperatingReviewBundle({
  snapshots=[],outcomes=[],evaluations=[],transferEvaluations=[],sourceMetadata=[],scope=null,dimension='overall',value='all',build=null,cryptoImpl=globalThis.crypto
}={}){
  const records=[...(snapshots||[]),...(outcomes||[]),...(evaluations||[]),...(transferEvaluations||[])].filter(Boolean);
  if(records.some(record=>!reviewRecordVersionsValid(record))) throw new Error('Operating review cannot migrate an unsupported source-record version');
  for(const record of records){const checked=await reviewValidateSourceRecord(record,cryptoImpl);if(!checked.ok)throw new Error(`Operating review source record rejected: ${reviewRecordId(record)||record.recordType} (${checked.reason})`);}
  const currentEvaluations=reviewCurrentRecords(evaluations).filter(record=>record.recordType==='gameweekEvaluation'&&record.completeness?.complete);
  if(!currentEvaluations.length) throw new Error('Operating review requires at least one complete gameweek evaluation');
  const season=scope?.season||currentEvaluations[0].season;
  const selectedEvaluations=currentEvaluations.filter(record=>record.season===season&&(!scope?.gameweek||Number(record.gameweek)===Number(scope.gameweek)));
  if(!selectedEvaluations.length) throw new Error('No complete evaluation matches the requested operating-review scope');
  const selectedEvaluationIds=new Set(selectedEvaluations.map(record=>record.identity?.evaluationId));
  const selectedTransfers=reviewCurrentRecords(transferEvaluations).filter(record=>record.season===season&&(!scope?.gameweek||record.sources?.startEvaluationId===selectedEvaluations[0]?.identity?.evaluationId||record.sources?.gameweekEvaluationIds?.some(id=>selectedEvaluationIds.has(id))));
  const snapshotById=reviewIndexSnapshots(snapshots),outcomeById=reviewIndexOutcomes(outcomes),selectedGameweeks=new Set(selectedEvaluations.map(record=>Number(record.gameweek)));
  const requiredSnapshotIds=new Set(selectedEvaluations.map(record=>record.sources?.snapshotId).filter(Boolean)),requiredOutcomeIds=new Set(selectedEvaluations.map(record=>record.sources?.outcomeId).filter(Boolean));
  const selectedSnapshots=(snapshots||[]).filter(record=>requiredSnapshotIds.has(record.identity?.snapshotId));
  const selectedOutcomes=(outcomes||[]).filter(record=>record.season===season&&selectedGameweeks.has(Number(record.gameweek)));
  const selectedAllEvaluations=(evaluations||[]).filter(record=>record.season===season&&selectedEvaluations.some(current=>reviewLogicalKey(current)===reviewLogicalKey(record)));
  const exactRecords={
    snapshots:reviewSortRecords(selectedSnapshots),outcomes:reviewSortRecords(selectedOutcomes),
    evaluations:reviewSortRecords(selectedAllEvaluations),transferEvaluations:reviewSortRecords(selectedTransfers)
  };
  const allExact=[...exactRecords.snapshots,...exactRecords.outcomes,...exactRecords.evaluations,...exactRecords.transferEvaluations];
  const weeklyReviews=selectedEvaluations.map(evaluation=>buildWeeklyOperatingReview(evaluation,{
    snapshot:snapshotById.get(evaluation.sources?.snapshotId)||null,outcome:outcomeById.get(evaluation.sources?.outcomeId)||null,
    transferEvaluation:reviewTransferForEvaluation(evaluation,selectedTransfers)
  }));
  const cumulativeReview=buildCumulativeOperatingReview(selectedEvaluations,{snapshots:selectedSnapshots,transferEvaluations:selectedTransfers,dimension,value});
  const missingSnapshots=[...requiredSnapshotIds].filter(id=>!snapshotById.has(id)),missingOutcomes=[...requiredOutcomeIds].filter(id=>!outcomeById.has(id));
  const evidenceThrough=allExact.map(reviewRecordTimestamp).filter(Boolean).sort().at(-1)||selectedEvaluations.map(reviewRecordTimestamp).filter(Boolean).sort().at(-1)||new Date(0).toISOString();
  const selectedMetadata=(sourceMetadata||[]).filter(row=>reviewMetadataInScope(row,season,scope?.gameweek)),manifest=reviewManifest(allExact,selectedMetadata),profile=scope?.gameweek?'weekly':'season';
  const prunedRecordIds=manifest.filter(row=>!row.hasFullRecord).map(row=>row.recordId),isPartial=missingSnapshots.length>0||missingOutcomes.length>0||prunedRecordIds.length>0;
  const completeness=canonicalise({
    complete:!isPartial,status:isPartial?'partial':'complete',
    missingFullSnapshotIds:missingSnapshots,missingFullOutcomeIds:missingOutcomes,prunedRecordIds,
    note:isPartial?'Derived metrics remain usable, but the exact source-record bundle is incomplete because bounded browser recovery no longer holds every known source or superseded revision.':'All required exact source records and known retained revisions are included.'
  });
  const base=canonicalise({
    recordType:'operatingReviewBundle',schemaVersion:REVIEW_SCHEMA_VERSION,exportFormatVersion:REVIEW_EXPORT_FORMAT_VERSION,reviewVersion:REVIEW_VERSION,
    profile,scope:{season,gameweek:scope?.gameweek?Number(scope.gameweek):null,label:reviewScopeLabel(scope)},evidenceThrough,
    build:reviewBuildIdentity(build),versions:{reviewSchemaVersion:REVIEW_SCHEMA_VERSION,exportFormatVersion:REVIEW_EXPORT_FORMAT_VERSION,reviewVersion:REVIEW_VERSION},
    completeness,manifest,records:exactRecords,weeklyReviews,cumulativeReview,
    identity:{manifestHash:null,reviewHash:null,bundleHash:null,bundleId:null}
  });
  assertEvidenceSafe(base);
  const manifestHash=await sha256Hex(stableStringify(manifest),cryptoImpl),reviewHash=await sha256Hex(stableStringify({weeklyReviews,cumulativeReview,completeness}),cryptoImpl);
  const draft=canonicalise({...base,identity:{manifestHash,reviewHash,bundleHash:null,bundleId:null}}),bundleHash=await sha256Hex(stableStringify(reviewBundleHashMaterial(draft)),cryptoImpl),bundleId=`operating-review-${season}-${reviewScopeLabel(scope)}-${bundleHash.slice(0,16)}`;
  const bundle=canonicalise({...draft,identity:{...draft.identity,bundleHash,bundleId}});assertEvidenceSafe(bundle);
  const text=stableStringify(bundle)+'\n',bytes=reviewTextBytes(text);
  if(bytes>REVIEW_RULES.maxBytes) throw new Error('Operating review exceeds the 25 MB export limit; no truncated export was created');
  return deepFreeze(bundle);
}
function reviewTextBytes(value){return typeof TextEncoder!=='undefined'?new TextEncoder().encode(String(value)).length:String(value).length*2;}
function serialiseOperatingReviewBundle(bundle){
  const text=stableStringify(bundle)+'\n',bytes=reviewTextBytes(text);
  if(bytes>REVIEW_RULES.maxBytes) throw new Error('Operating review exceeds the 25 MB export limit; no truncated export was created');
  return {text,bytes,warning:bytes>REVIEW_RULES.warningBytes?'large_export':null};
}
async function validateOperatingReviewBundle(bundle,cryptoImpl=globalThis.crypto){
  try{
    if(!bundle||bundle.recordType!=='operatingReviewBundle') return {ok:false,reason:'record_type'};
    if(bundle.schemaVersion!==REVIEW_SCHEMA_VERSION||bundle.exportFormatVersion!==REVIEW_EXPORT_FORMAT_VERSION||bundle.reviewVersion!==REVIEW_VERSION) return {ok:false,reason:'version'};
    assertEvidenceSafe(bundle);
    const records=[...(bundle.records?.snapshots||[]),...(bundle.records?.outcomes||[]),...(bundle.records?.evaluations||[]),...(bundle.records?.transferEvaluations||[])];
    if(records.some(record=>!reviewRecordVersionsValid(record))) return {ok:false,reason:'source_version'};
    const manifestHash=await sha256Hex(stableStringify(bundle.manifest||[]),cryptoImpl);if(manifestHash!==bundle.identity?.manifestHash) return {ok:false,reason:'manifest_hash'};
    const reviewHash=await sha256Hex(stableStringify({weeklyReviews:bundle.weeklyReviews||[],cumulativeReview:bundle.cumulativeReview,completeness:bundle.completeness}),cryptoImpl);if(reviewHash!==bundle.identity?.reviewHash) return {ok:false,reason:'review_hash'};
    for(const record of records){const checked=await reviewValidateSourceRecord(record,cryptoImpl);if(!checked.ok)return {ok:false,reason:`source_${checked.reason}`};}
    const metadata=(bundle.manifest||[]).filter(row=>!row.hasFullRecord),expectedManifest=reviewManifest(records,metadata);if(stableStringify(expectedManifest)!==stableStringify(bundle.manifest||[])) return {ok:false,reason:'manifest_content'};
    const bundleHash=await sha256Hex(stableStringify(reviewBundleHashMaterial(bundle)),cryptoImpl);if(bundleHash!==bundle.identity?.bundleHash) return {ok:false,reason:'bundle_hash'};
    const expectedId=`operating-review-${bundle.scope?.season}-${reviewScopeLabel(bundle.scope)}-${bundleHash.slice(0,16)}`;if(bundle.identity?.bundleId!==expectedId) return {ok:false,reason:'bundle_id'};
    if(serialiseOperatingReviewBundle(bundle).bytes>REVIEW_RULES.maxBytes) return {ok:false,reason:'size'};
    return {ok:true,record:deepFreeze(canonicalise(bundle))};
  }catch(error){return {ok:false,reason:'invalid_record',message:error.message};}
}
function reviewCsvTextValue(value){
  const text=String(value??''),candidate=text.replace(/^[ \u00a0]+/,'');
  return /^[=+\-@\t\r]/.test(candidate)?`'${text}`:text;
}
function reviewCsvCell(value){
  if(value===null||value===undefined) return '';
  if(typeof value==='number'){if(!Number.isFinite(value)) return '';return String(Object.is(value,-0)?0:value);}
  if(typeof value==='boolean') return value?'true':'false';
  const text=reviewCsvTextValue(typeof value==='object'?stableStringify(value):value);
  return /[",\r\n\t]/.test(text)?`"${text.replaceAll('"','""')}"`:text;
}
function reviewCsvDocument(columns,rows){
  const lines=[columns.join(','),...rows.map(row=>columns.map(column=>reviewCsvCell(row[column])).join(','))];
  return '\uFEFF'+lines.join('\r\n')+'\r\n';
}
function reviewBundleMaps(bundle){
  const snapshots=reviewIndexSnapshots(bundle.records?.snapshots||[]),outcomes=reviewIndexOutcomes(bundle.records?.outcomes||[]),evaluations=reviewIndexById(bundle.records?.evaluations||[]),transfers=reviewIndexById(bundle.records?.transferEvaluations||[]);
  return {snapshots,outcomes,evaluations,transfers};
}
function reviewPlayerLookup(snapshot){
  const map=new Map();
  for(const row of snapshot?.outputs?.players||[]) map.set(Number(row.playerId),row);
  return map;
}
function reviewCommonEvaluationColumns(evaluation){
  return {
    season:evaluation.season,gameweek:Number(evaluation.gameweek),deadline_time:evaluation.deadlineTime,
    evaluation_id:evaluation.identity?.evaluationId||null,evaluation_revision:Number(evaluation.identity?.revision)||1,evaluation_content_hash:evaluation.identity?.contentHash||null,
    snapshot_id:evaluation.sources?.snapshotId||null,snapshot_content_hash:evaluation.sources?.snapshotContentHash||null,
    outcome_id:evaluation.sources?.outcomeId||null,outcome_revision:Number(evaluation.sources?.outcomeRevision)||null,outcome_status:evaluation.sources?.outcomeStatus||null,outcome_data_hash:evaluation.sources?.outcomeDataHash||null
  };
}
function reviewCsvRows(bundle,table){
  if(!REVIEW_RULES.csvTables.includes(table)) throw new Error('Unknown operating-review CSV table');
  const currentEvaluations=reviewCurrentRecords(bundle.records?.evaluations||[]).filter(record=>record.recordType==='gameweekEvaluation'),currentTransfers=reviewCurrentRecords(bundle.records?.transferEvaluations||[]).filter(record=>record.recordType==='transferHorizonEvaluation'),maps=reviewBundleMaps(bundle);
  if(table==='gameweeks') return currentEvaluations.map(evaluation=>{
    const sample=evaluationSampleStatus(evaluation.observations?.players?.length||0,1),common=reviewCommonEvaluationColumns(evaluation),player=evaluation.reports?.player||{};
    return {...common,player_rows:evaluation.observations?.players?.length||0,minute_fixture_rows:evaluation.observations?.minuteFixtures?.length||0,matched_players:evaluation.coverage?.matchedPlayers??null,schedule_aligned_players:evaluation.coverage?.scheduleAlignedPlayers??null,unallocatable_minute_rows:evaluation.coverage?.unallocatableMinuteRows??null,player_mae:player.mae??null,player_rmse:player.rmse??null,player_bias:player.bias??null,within_two:player.withinTwo??null,within_five:player.withinFive??null,predicted_mean:player.predictedMean??null,observed_mean:player.observedMean??null,sample_level:sample.level,sample_message:sample.message,completeness:evaluation.completeness?.complete?'complete':'partial'};
  });
  if(table==='players') return currentEvaluations.flatMap(evaluation=>{
    const common=reviewCommonEvaluationColumns(evaluation),snapshot=maps.snapshots.get(evaluation.sources?.snapshotId),names=reviewPlayerLookup(snapshot);
    return (evaluation.observations?.players||[]).slice().sort((a,b)=>Number(a.playerId)-Number(b.playerId)).map(row=>{
      const frozen=names.get(Number(row.playerId));return {...common,player_id:Number(row.playerId),player_name:frozen?.web_name||frozen?.name||null,club_id:Number(row.clubId),position:Number(row.position),now_cost:Number(row.nowCost),predicted_points:row.predictedPoints,observed_points:row.observedPoints,error:row.error,absolute_error:row.absError,error_band:row.errorBand,appeared:Boolean(row.appeared),reached_sixty:Boolean(row.reachedSixty),starts:row.starts,observed_minutes:row.observedMinutes,schedule_aligned:Boolean(row.scheduleAligned),frozen_fixture_ids:row.frozenFixtureIds,official_fixture_ids:row.officialFixtureIds,uncertainty_available:Boolean(row.uncertainty?.available),p10:row.uncertainty?.p10??null,p25:row.uncertainty?.p25??null,p75:row.uncertainty?.p75??null,p90:row.uncertainty?.p90??null,blank_probability:row.uncertainty?.blankProbability??null,return_probability:row.uncertainty?.returnProbability??null,haul_probability:row.uncertainty?.haulProbability??null,mega_haul_probability:row.uncertainty?.megaHaulProbability??null,segments:row.segments||null};
    });
  });
  if(table==='minute_fixtures') return currentEvaluations.flatMap(evaluation=>{
    const common=reviewCommonEvaluationColumns(evaluation);return (evaluation.observations?.minuteFixtures||[]).slice().sort((a,b)=>Number(a.playerId)-Number(b.playerId)||Number(a.fixtureId)-Number(b.fixtureId)).map(row=>({...common,player_id:Number(row.playerId),fixture_id:Number(row.fixtureId),schedule_aligned:Boolean(row.scheduleAligned),predicted_minutes:row.predictedMinutes,observed_minutes:row.observedMinutes,p_start:row.pStart,started:row.started,p_appear:row.pAppear,appeared:row.appeared,p_60:row.p60,reached_sixty:row.reachedSixty,allocation:row.allocation}));
  });
  if(table==='squad_decisions') return currentEvaluations.map(evaluation=>{
    const common=reviewCommonEvaluationColumns(evaluation),squad=evaluation.decisions?.squad||{},captain=evaluation.decisions?.captaincy||{},bench=evaluation.decisions?.bench||{},manager=evaluation.decisions?.managerOutcome||{};
    return {...common,decision_status:evaluation.decisions?.status||'not_available',selected_xi_player_ids:squad.selectedRealised?.playerIds||squad.selectedPlayerIds||null,scoring_xi_player_ids:squad.selectedRealised?.scoringXI||null,selected_realised_base_points:squad.selectedRealised?.basePoints??null,hindsight_oracle_player_ids:squad.hindsightOracle?.playerIds||null,hindsight_oracle_realised_points:squad.hindsightOracle?.realisedPoints??null,selected_realised_rank:squad.selectedRealisedRank??null,captain_id:captain.selected?.captainId??null,vice_captain_id:captain.selected?.viceCaptainId??null,effective_captain_id:captain.selected?.effectiveCaptainId??null,captain_doubled_contribution:captain.selected?.doubledContribution??null,vice_took_over:captain.selected?.viceTookOver??null,bench_player_ids:bench.benchPlayerIds||null,automatic_substitution_contribution:bench.automaticSubstitutionContribution??null,points_left_on_bench:bench.pointsLeftOnBench??null,manager_outcome_status:manager.status||'not_available',manager_actual_points:manager.actualPoints??manager.points??null};
  });
  if(table==='transfer_horizons') return currentTransfers.flatMap(record=>{
    const common={season:record.season,start_gameweek:Number(record.startGameweek),horizon:Number(record.horizon),transfer_evaluation_id:record.identity?.transferEvaluationId||null,transfer_evaluation_revision:Number(record.identity?.revision)||1,transfer_evaluation_content_hash:record.identity?.contentHash||null,start_evaluation_id:record.sources?.startEvaluationId||null,required_gameweeks:record.completeness?.requiredGameweeks||null};
    const baseline={...common,plan_kind:'baseline',plan_signature:record.baseline?.signature||null,transfer_count:record.baseline?.transferCount??0,transfers:record.baseline?.transfers||[],hit_cost:record.baseline?.hitCost??0,roll_difference:record.baseline?.rollDifference??0,realised_base_points:record.baseline?.realisedBasePoints??null,gross_gain:0,net_gain_after_hits:0};
    return [baseline,...(record.plans||[]).map(plan=>({...common,plan_kind:'alternative',plan_signature:plan.signature||null,transfer_count:plan.transferCount,transfers:plan.transfers||[],hit_cost:plan.hitCost,roll_difference:plan.rollDifference,realised_base_points:plan.realisedBasePoints,gross_gain:plan.grossGain,net_gain_after_hits:plan.netGainAfterHits}))];
  });
  if(table==='transfer_horizon_gameweeks') return currentTransfers.flatMap(record=>{
    const plans=[{kind:'baseline',value:record.baseline},...(record.plans||[]).map(value=>({kind:'alternative',value}))];
    return plans.flatMap(plan=>(plan.value?.perGameweek||[]).map(row=>({season:record.season,start_gameweek:Number(record.startGameweek),horizon:Number(record.horizon),transfer_evaluation_id:record.identity?.transferEvaluationId||null,transfer_evaluation_revision:Number(record.identity?.revision)||1,plan_kind:plan.kind,plan_signature:plan.value?.signature||null,gameweek:Number(row.gw),xi_player_ids:row.xiPlayerIds||[],bench_player_ids:row.benchPlayerIds||[],realised_base_points:row.realisedBasePoints,automatic_substitution_contribution:row.automaticSubstitutionContribution,schedule_changed:Boolean(row.scheduleChanged)})));
  });
  if(table==='provider_states') return currentEvaluations.flatMap(evaluation=>{
    const snapshot=maps.snapshots.get(evaluation.sources?.snapshotId),common=reviewCommonEvaluationColumns(evaluation);
    return reviewProviderRows(snapshot).map(row=>({...common,provider:row.provider,state:row.state,included:row.included,did_affect_model:row.didAffectModel,accepted_count:row.acceptedCount,rejected_count:row.rejectedCount,last_success_at:row.lastSuccessAt,recorded_at:row.recordedAt,age_ms:row.ageMs,threshold_ms:row.thresholdMs,note:row.note,consequence:row.consequence}));
  });
  return (bundle.manifest||[]).map(row=>({record_type:row.recordType,record_id:row.recordId,logical_key:row.logicalKey,season:row.season,gameweek:row.gameweek,revision:row.revision,current:row.current,content_hash:row.contentHash,data_hash:row.dataHash,recorded_at:row.recordedAt,has_full_record:row.hasFullRecord}));
}
const REVIEW_CSV_COLUMNS=Object.freeze({
  gameweeks:['season','gameweek','deadline_time','evaluation_id','evaluation_revision','evaluation_content_hash','snapshot_id','snapshot_content_hash','outcome_id','outcome_revision','outcome_status','outcome_data_hash','player_rows','minute_fixture_rows','matched_players','schedule_aligned_players','unallocatable_minute_rows','player_mae','player_rmse','player_bias','within_two','within_five','predicted_mean','observed_mean','sample_level','sample_message','completeness'],
  players:['season','gameweek','deadline_time','evaluation_id','evaluation_revision','evaluation_content_hash','snapshot_id','snapshot_content_hash','outcome_id','outcome_revision','outcome_status','outcome_data_hash','player_id','player_name','club_id','position','now_cost','predicted_points','observed_points','error','absolute_error','error_band','appeared','reached_sixty','starts','observed_minutes','schedule_aligned','frozen_fixture_ids','official_fixture_ids','uncertainty_available','p10','p25','p75','p90','blank_probability','return_probability','haul_probability','mega_haul_probability','segments'],
  minute_fixtures:['season','gameweek','deadline_time','evaluation_id','evaluation_revision','evaluation_content_hash','snapshot_id','snapshot_content_hash','outcome_id','outcome_revision','outcome_status','outcome_data_hash','player_id','fixture_id','schedule_aligned','predicted_minutes','observed_minutes','p_start','started','p_appear','appeared','p_60','reached_sixty','allocation'],
  squad_decisions:['season','gameweek','deadline_time','evaluation_id','evaluation_revision','evaluation_content_hash','snapshot_id','snapshot_content_hash','outcome_id','outcome_revision','outcome_status','outcome_data_hash','decision_status','selected_xi_player_ids','scoring_xi_player_ids','selected_realised_base_points','hindsight_oracle_player_ids','hindsight_oracle_realised_points','selected_realised_rank','captain_id','vice_captain_id','effective_captain_id','captain_doubled_contribution','vice_took_over','bench_player_ids','automatic_substitution_contribution','points_left_on_bench','manager_outcome_status','manager_actual_points'],
  transfer_horizons:['season','start_gameweek','horizon','transfer_evaluation_id','transfer_evaluation_revision','transfer_evaluation_content_hash','start_evaluation_id','required_gameweeks','plan_kind','plan_signature','transfer_count','transfers','hit_cost','roll_difference','realised_base_points','gross_gain','net_gain_after_hits'],
  transfer_horizon_gameweeks:['season','start_gameweek','horizon','transfer_evaluation_id','transfer_evaluation_revision','plan_kind','plan_signature','gameweek','xi_player_ids','bench_player_ids','realised_base_points','automatic_substitution_contribution','schedule_changed'],
  provider_states:['season','gameweek','deadline_time','evaluation_id','evaluation_revision','evaluation_content_hash','snapshot_id','snapshot_content_hash','outcome_id','outcome_revision','outcome_status','outcome_data_hash','provider','state','included','did_affect_model','accepted_count','rejected_count','last_success_at','recorded_at','age_ms','threshold_ms','note','consequence'],
  revisions:['record_type','record_id','logical_key','season','gameweek','revision','current','content_hash','data_hash','recorded_at','has_full_record']
});
function reviewExportFileName(bundle,extension,table=null){
  const season=String(bundle.scope?.season||'season'),label=reviewScopeLabel(bundle.scope),suffix=table?`-${table.replaceAll('_','-')}`:'';
  return `teamsheet-${season}-${label}-operating-review${suffix}.${extension}`;
}
function buildOperatingReviewCsv(bundle,table){
  const columns=REVIEW_CSV_COLUMNS[table];if(!columns) throw new Error('Unknown operating-review CSV table');
  const rows=reviewCsvRows(bundle,table),text=reviewCsvDocument(columns,rows),bytes=reviewTextBytes(text);
  if(bytes>REVIEW_RULES.maxBytes) throw new Error('CSV export exceeds the 25 MB export limit; no truncated export was created');
  return {table,filename:reviewExportFileName(bundle,'csv',table),text,bytes,warning:bytes>REVIEW_RULES.warningBytes?'large_export':null,rows:rows.length};
}
function reviewMarkdownNumber(value,digits=2){return value==null||!Number.isFinite(Number(value))?'—':Number(value).toFixed(digits);}
function reviewMarkdownPercent(value){return value==null||!Number.isFinite(Number(value))?'—':`${(Number(value)*100).toFixed(1)}%`;}
function buildOperatingReviewMarkdown(bundle){
  const lines=[`# Teamsheet operating review — ${bundle.scope.season} ${bundle.scope.gameweek?`GW${bundle.scope.gameweek}`:'season'}`,'',`Evidence through: ${bundle.evidenceThrough}`,`Bundle ID: ${bundle.identity.bundleId}`,`Completeness: ${bundle.completeness.status}`,''];
  for(const weekly of bundle.weeklyReviews||[]){
    lines.push(`## GW${weekly.gameweek}`,'',weekly.status.sample.message,'',`- Player rows: ${weekly.headline.playerRows}`,`- Player MAE: ${reviewMarkdownNumber(weekly.headline.playerMae)}`,`- Bias: ${reviewMarkdownNumber(weekly.headline.playerBias)} (positive means Teamsheet overpredicted)`,`- Within 2 points: ${reviewMarkdownPercent(weekly.headline.withinTwo)}`,`- Schedule-aligned players: ${weekly.headline.scheduleAlignedPlayers}`,`- Unallocatable minute rows: ${weekly.headline.unallocatableMinuteRows}`,'');
    if(weekly.decisions?.squad) lines.push(`Frozen XI realised base points: ${weekly.decisions.squad.selectedRealised?.basePoints??'—'}. Hindsight oracle: ${weekly.decisions.squad.hindsightOracle?.realisedPoints??'—'} (descriptive only).`,'');
    if(weekly.transfer?.status==='complete') lines.push(`Frozen transfer horizon: complete across ${weekly.transfer.horizon} Gameweeks. Overlapping plan gains are not summed.`,'');
    else if(weekly.transfer?.status==='horizon_in_progress') lines.push('Frozen transfer horizon: in progress. No interim gain is shown.','');
    if(weekly.warnings?.length) lines.push('### Warnings','',...weekly.warnings.map(value=>`- ${value}`),'');
  }
  const cumulative=bundle.cumulativeReview,overall=cumulative?.overall?.player?.metrics||{},aligned=cumulative?.scheduleAligned?.player?.metrics||{};
  lines.push('## Cumulative review','',cumulative?.overall?.player?.sample?.message||'No cumulative sample.','',`- Evaluated Gameweeks: ${cumulative?.gameweeks?.length||0}`,`- Overall player MAE: ${reviewMarkdownNumber(overall.mae)}`,`- Schedule-aligned player MAE: ${reviewMarkdownNumber(aligned.mae)}`,`- Overall bias: ${reviewMarkdownNumber(overall.bias)}`,`- Schedule-aligned bias: ${reviewMarkdownNumber(aligned.bias)}`,'','No composite score, significance claim, calibration claim or automatic model update is produced.','');
  const text=lines.join('\n')+'\n',bytes=reviewTextBytes(text);if(bytes>REVIEW_RULES.maxBytes) throw new Error('Markdown export exceeds the 25 MB export limit');
  return {filename:reviewExportFileName(bundle,'md'),text,bytes,warning:bytes>REVIEW_RULES.warningBytes?'large_export':null};
}

export {
  REVIEW_SCHEMA_VERSION,REVIEW_EXPORT_FORMAT_VERSION,REVIEW_VERSION,REVIEW_RULES,REVIEW_CSV_COLUMNS,
  reviewFinite,reviewIso,reviewCurrentRecords,reviewRecordTimestamp,reviewValidateSourceRecord,reviewMetadataEntry,reviewCsvTextValue,reviewCsvCell,reviewCsvDocument,reviewCsvRows,
  buildWeeklyOperatingReview,buildCumulativeOperatingReview,buildOperatingReviewBundle,serialiseOperatingReviewBundle,validateOperatingReviewBundle,
  reviewExportFileName,buildOperatingReviewCsv,buildOperatingReviewMarkdown
};
