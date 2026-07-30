import { canonicalise } from './snapshot.mjs';

const OPERATING_REVIEW_SCHEMA_VERSION='1.0.0';
const OPERATING_REVIEW_VERSION='1.0.0';
const OPERATING_EXPORT_FORMAT_VERSION='1.0.0';
const OPERATING_REVIEW_RULES=Object.freeze({
  warningBytes:10*1024*1024,
  maximumBytes:25*1024*1024,
  providerOrder:Object.freeze(['fpl','understat','odds','archive']),
  approvedSegments:Object.freeze([
    'overall','schedule','owned','recommendation','position','priceBand','minutesSource',
    'minutesConfidence','providerState','homeAway','fdrContext','fixtureClass','availability',
    'observedRole','seasonPeriod'
  ])
});

function operatingReviewFinite(value){
  if(value===null||value===undefined||value==='') return null;
  const number=Number(value);
  return Number.isFinite(number)?number:null;
}
function operatingReviewIso(value){
  const milliseconds=value instanceof Date?value.getTime():typeof value==='number'?value:Date.parse(value);
  return Number.isFinite(milliseconds)?new Date(milliseconds).toISOString():null;
}
function operatingReviewUnique(values){
  return [...new Set((values||[]).filter(value=>value!==null&&value!==undefined&&value!==''))].sort((a,b)=>String(a).localeCompare(String(b)));
}
function operatingReviewRevision(record){ return Math.max(1,Number(record?.identity?.revision)||1); }
function operatingReviewRecordId(record){
  return record?.identity?.snapshotId||record?.identity?.outcomeId||record?.identity?.evaluationId||record?.identity?.transferEvaluationId||null;
}
function operatingReviewLogicalKey(record){
  return record?.identity?.logicalKey||record?.identity?.duplicateKey||operatingReviewRecordId(record)||null;
}
function operatingReviewRecordTime(record){
  return operatingReviewIso(record?.createdAt||record?.collection?.completedAt||record?.timing?.captureCompletedAt||record?.capture?.projectionCompletedAt||record?.deadlineTime)||new Date(0).toISOString();
}
function operatingReviewSortRecords(records){
  return (records||[]).slice().sort((a,b)=>{
    const season=String(a?.season||'').localeCompare(String(b?.season||''));
    if(season) return season;
    const gameweek=(Number(a?.gameweek??a?.startGameweek)||0)-(Number(b?.gameweek??b?.startGameweek)||0);
    if(gameweek) return gameweek;
    const type=String(a?.recordType||'').localeCompare(String(b?.recordType||''));
    if(type) return type;
    const revision=operatingReviewRevision(a)-operatingReviewRevision(b);
    if(revision) return revision;
    return String(operatingReviewRecordId(a)||'').localeCompare(String(operatingReviewRecordId(b)||''));
  });
}
function operatingReviewCurrentRecords(records,recordType=null){
  const selected=new Map();
  for(const record of records||[]){
    if(!record||recordType&&record.recordType!==recordType) continue;
    const key=operatingReviewLogicalKey(record); if(!key) continue;
    const prior=selected.get(key);
    if(!prior||operatingReviewRevision(record)>operatingReviewRevision(prior)||
      (operatingReviewRevision(record)===operatingReviewRevision(prior)&&operatingReviewRecordTime(record)>operatingReviewRecordTime(prior))) selected.set(key,record);
  }
  return operatingReviewSortRecords([...selected.values()]);
}
function operatingReviewMetadataRecordId(row){ return row?.snapshotId||row?.outcomeId||row?.recordId||null; }
function operatingReviewMetadataType(row){
  if(row?.snapshotId) return 'preDeadlineSnapshot';
  if(row?.outcomeId) return 'gameweekOutcome';
  return row?.recordType||null;
}
function operatingReviewMetadataGameweek(row){ return Number(row?.gameweek)||null; }
function operatingReviewMetadataTime(row){ return operatingReviewIso(row?.createdAt||row?.collectedAt||row?.capturedAt||row?.deadlineTime)||null; }
function operatingReviewLatestMetadata(rows,gameweek,{currentOnly=false}={}){
  return (rows||[]).filter(row=>Number(row?.gameweek)===Number(gameweek)&&(!currentOnly||row.current!==false))
    .sort((a,b)=>Number(Boolean(b.current))-Number(Boolean(a.current))||Number(b.revision||1)-Number(a.revision||1)||
      Date.parse(operatingReviewMetadataTime(b)||0)-Date.parse(operatingReviewMetadataTime(a)||0)||
      String(operatingReviewMetadataRecordId(a)||'').localeCompare(String(operatingReviewMetadataRecordId(b)||'')))[0]||null;
}
function operatingReviewPlayerMaps(snapshot){
  const playerNames=new Map(),clubNames=new Map();
  for(const row of snapshot?.modelInputs?.players||[]) playerNames.set(Number(row.id),String(row.web_name||''));
  for(const row of snapshot?.modelInputs?.teams||[]) clubNames.set(Number(row.id),String(row.short_name||row.name||''));
  return {playerNames,clubNames};
}
function operatingReviewSnapshotStatus(snapshot,metadata){
  const origin=metadata?.origin;
  if(origin==='recovery_import') return 'recovery_only';
  if(metadata){
    if(origin==='local_capture'&&metadata.officialEligible&&snapshot?.completeness?.complete) return 'official';
    return 'recorded_only';
  }
  if(snapshot?.timing?.officialEligible&&snapshot?.completeness?.complete) return 'official';
  if(snapshot) return 'recorded_only';
  return 'unavailable';
}

function operatingReviewOutcomeStatus(outcome,metadata){ return String(outcome?.status||metadata?.status||'unavailable'); }
function operatingReviewEvaluationStatus(evaluation,outcomeStatus){
  if(evaluation){
    if(operatingReviewRevision(evaluation)>1||outcomeStatus==='corrected'||evaluation.sources?.outcomeStatus==='corrected') return 'corrected';
    return 'current';
  }
  if(outcomeStatus==='provisional') return 'pending';
  if(['complete','corrected'].includes(outcomeStatus)) return 'excluded';
  return 'unavailable';
}
function operatingReviewDecoratePlayerRows(evaluation,snapshot){
  const {playerNames,clubNames}=operatingReviewPlayerMaps(snapshot);
  return (evaluation?.observations?.players||[]).map(row=>canonicalise({
    ...row,
    playerName:playerNames.get(Number(row.playerId))||null,
    clubName:clubNames.get(Number(row.clubId))||null
  })).sort((a,b)=>Number(b.absError)-Number(a.absError)||Number(a.playerId)-Number(b.playerId));
}
function operatingReviewDecorateMinuteRows(evaluation,snapshot){
  const {playerNames}=operatingReviewPlayerMaps(snapshot);
  return (evaluation?.observations?.minuteFixtures||[]).map(row=>canonicalise({
    ...row,
    playerName:playerNames.get(Number(row.playerId))||null,
    minutesError:row.observedMinutes==null||row.predictedMinutes==null?null:Number((Number(row.predictedMinutes)-Number(row.observedMinutes)).toFixed(8)),
    minutesAbsoluteError:row.observedMinutes==null||row.predictedMinutes==null?null:Number(Math.abs(Number(row.predictedMinutes)-Number(row.observedMinutes)).toFixed(8)),
    exclusionReason:row.observedMinutes==null?'unallocatable_minutes':null
  })).sort((a,b)=>Number(a.playerId)-Number(b.playerId)||Number(a.fixtureId)-Number(b.fixtureId));
}
function operatingReviewTransferStatus(evaluation,transferEvaluations,availableEvaluationGameweeks){
  const complete=(transferEvaluations||[]).filter(record=>Number(record?.startGameweek)===Number(evaluation?.gameweek))
    .sort((a,b)=>operatingReviewRevision(b)-operatingReviewRevision(a))[0]||null;
  if(complete) return canonicalise({status:'complete',record:complete,missingGameweeks:[]});
  const basis=evaluation?.decisions?.transferBasis;
  if(!basis?.horizon) return canonicalise({status:'unavailable',record:null,missingGameweeks:[]});
  const required=Array.from({length:Number(basis.horizon)},(_,index)=>Number(evaluation.gameweek)+index);
  const available=new Set((availableEvaluationGameweeks||[]).map(Number));
  return canonicalise({status:'in_progress',record:null,requiredGameweeks:required,missingGameweeks:required.filter(gameweek=>!available.has(gameweek))});
}
function operatingReviewCorrectionSummary(gameweek,outcome,evaluation,revisionRows){
  const rows=(revisionRows||[]).filter(row=>Number(row?.gameweek)===Number(gameweek));
  const superseded=rows.filter(row=>row.current===false);
  return canonicalise({
    corrected:Boolean(outcome?.status==='corrected'||operatingReviewRevision(outcome)>1||operatingReviewRevision(evaluation)>1),
    outcomeRevision:outcome?operatingReviewRevision(outcome):null,
    evaluationRevision:evaluation?operatingReviewRevision(evaluation):null,
    supersededRevisionCount:superseded.length,
    prunedSupersededRecordCount:superseded.filter(row=>row.hasFullRecord===false).length
  });
}
function operatingReviewWarnings({evaluation,snapshot,outcome,sample,transfer,corrections}){
  const warnings=[];
  if(sample?.message) warnings.push(sample.message);
  if(!snapshot) warnings.push('The full pre-deadline snapshot is not available on this device; historical predictions were not recreated.');
  if(!outcome) warnings.push('The full official outcome record is not available on this device.');
  if(!evaluation) warnings.push('No authoritative Gameweek evaluation is available.');
  if(evaluation?.coverage?.unallocatableMinuteRows) warnings.push(`${evaluation.coverage.unallocatableMinuteRows} minute rows are unallocatable and remain missing rather than zero.`);
  if((evaluation?.observations?.players||[]).some(row=>row.scheduleAligned===false)) warnings.push('The frozen and final fixture schedules differ for at least one player; use the schedule-aligned view alongside the overall result.');
  if(transfer?.status==='in_progress') warnings.push('The frozen transfer horizon is still in progress; no partial gain is calculated.');
  if(corrections?.corrected) warnings.push('A corrected official outcome or evaluation revision is current; earlier revisions remain audit evidence where retained.');
  return operatingReviewUnique(warnings);
}

export {
  OPERATING_REVIEW_SCHEMA_VERSION,OPERATING_REVIEW_VERSION,OPERATING_EXPORT_FORMAT_VERSION,OPERATING_REVIEW_RULES,
  operatingReviewFinite,operatingReviewIso,operatingReviewUnique,operatingReviewRevision,operatingReviewRecordId,
  operatingReviewLogicalKey,operatingReviewRecordTime,operatingReviewSortRecords,operatingReviewCurrentRecords,
  operatingReviewMetadataRecordId,operatingReviewMetadataType,operatingReviewMetadataGameweek,operatingReviewMetadataTime,
  operatingReviewLatestMetadata,operatingReviewPlayerMaps,operatingReviewSnapshotStatus,operatingReviewOutcomeStatus,
  operatingReviewEvaluationStatus,operatingReviewDecoratePlayerRows,operatingReviewDecorateMinuteRows,
  operatingReviewTransferStatus,operatingReviewCorrectionSummary,operatingReviewWarnings
};
