import { S } from '../state.mjs';
import { api } from '../providers/transport.mjs';
import { FPL_RULES, MODEL_VERSION, RULES_VERSION, SIMULATION_RULES } from '../config.mjs';
import {
  canonicalise, stableStringify, sha256Hex, deepFreeze, assertEvidenceSafe, selectOfficialSnapshot
} from './snapshot.mjs';
import {
  validateOutcomeFixtures, validateOutcomeLive, validateOutcomePicks, validateOutcomeHistory
} from '../providers/outcome-validate.mjs';

const OUTCOME_SCHEMA_VERSION='1.0.0';
const OUTCOME_RULES=Object.freeze({
  provisionalRecheckMs:15*60*1000,
  foregroundMinAgeMs:10*60*1000,
  correctionWindowMs:14*24*60*60*1000,
  correctionRecheckMs:24*60*60*1000,
  batchLimit:6,
  localIndexLimit:50,
  supersededFullLimit:6,
  maxEncodedBytes:3*1024*1024
});
const OUTCOME_STATUSES=Object.freeze({PROVISIONAL:'provisional',COMPLETE:'complete',CORRECTED:'corrected'});

function outcomeBuildInfo(){
  const info=typeof BUILD_INFO!=='undefined'?BUILD_INFO:globalThis.BUILD_INFO;
  return canonicalise(info&&typeof info==='object'?info:{modelVersion:MODEL_VERSION,rulesVersion:RULES_VERSION,sourceHash:'unavailable',commit:'unversioned',moduleOrder:[]});
}
function outcomeIso(value){
  const ms=value instanceof Date?value.getTime():typeof value==='number'?value:Date.parse(value);
  return Number.isFinite(ms)?new Date(ms).toISOString():null;
}
function outcomeSafeRetryRows(){
  return Object.values(S.retryStats||{}).filter(row=>row?.provider==='fpl').map(row=>canonicalise({
    provider:'fpl',
    endpoint:String(row?.endpoint||'').replace(/\/entry\/\d+/g,'/entry/[redacted]').replace(/\d+/g,'{id}').slice(0,160),
    attempts:Number.isInteger(Number(row?.attempts))?Number(row.attempts):0,
    finalStatus:String(row?.finalStatus||row?.outcome||''),
    exhausted:Boolean(row?.exhausted),
    budgetExceeded:Boolean(row?.budgetExceeded)
  })).sort((a,b)=>a.endpoint.localeCompare(b.endpoint));
}
function snapshotRelation(snapshotRecords,gameweek,deadlineTime,snapshotMetadata=[]){
  const official=selectOfficialSnapshot(snapshotRecords,gameweek,deadlineTime);
  if(official) return canonicalise({
    status:'matched_official',
    snapshotId:official.identity.snapshotId,
    contentHash:official.identity.contentHash,
    deadlineTime:official.deadlineTime,
    timingGrade:official.timing.grade,
    buildCommit:official.build?.commit||'unversioned',
    modelVersion:official.versions?.model||null,
    rulesVersion:official.versions?.rules||null
  });
  const rows=(snapshotMetadata||[]).filter(row=>Number(row?.gameweek)===Number(gameweek));
  if(rows.some(row=>row.origin==='recovery_import')) return canonicalise({status:'recovery_only_available',snapshotId:null,contentHash:null,deadlineTime:outcomeIso(deadlineTime),timingGrade:null,buildCommit:null,modelVersion:null,rulesVersion:null});
  if(rows.some(row=>row.deadlineTime!==outcomeIso(deadlineTime))) return canonicalise({status:'deadline_mismatch',snapshotId:null,contentHash:null,deadlineTime:outcomeIso(deadlineTime),timingGrade:null,buildCommit:null,modelVersion:null,rulesVersion:null});
  if(rows.length) return canonicalise({status:'recorded_only_available',snapshotId:null,contentHash:null,deadlineTime:outcomeIso(deadlineTime),timingGrade:null,buildCommit:null,modelVersion:null,rulesVersion:null});
  return canonicalise({status:'no_snapshot',snapshotId:null,contentHash:null,deadlineTime:outcomeIso(deadlineTime),timingGrade:null,buildCommit:null,modelVersion:null,rulesVersion:null});
}
function fixtureAssignmentHashMaterial(records){
  return (records||[]).map(row=>({fixtureId:row.fixtureId,event:row.event,kickoffTime:row.kickoffTime,homeTeamId:row.homeTeamId,awayTeamId:row.awayTeamId}));
}
function outcomePlayerDetailIssues(players){
  const issues=[];
  for(const row of players||[]){
    if(row.perFixture?.length){
      const explained=row.perFixture.reduce((sum,item)=>sum+Number(item.points||0),0);
      if(explained!==Number(row.totalPoints)) issues.push({provider:'fpl',endpoint:'/event/{gw}/live/',code:'outcome_player_points_explain_mismatch',severity:'partial',count:1,playerId:row.playerId});
    }
  }
  return issues;
}
function outcomeHistoryForGameweek(historyValue,gameweek){
  return historyValue?.current?.find(row=>Number(row.event)===Number(gameweek))||null;
}
function buildSquadOutcome(picksValue,historyValue,gameweek,players){
  if(!picksValue) return canonicalise({status:'not_available',reason:'public_manager_outcome_unavailable',activeChip:null,officialGameweekPoints:null,officialTotalPoints:null,eventTransferCount:null,eventTransferCost:null,officialPointsOnBench:null,picks:[],captain:null,viceCaptain:null,bench:[],automaticSubstitutions:[],reconstruction:{pickMultiplierTotal:null,officialPointsDelta:null,agreement:'not_available'}});
  const pointsByPlayer=new Map((players||[]).map(row=>[Number(row.playerId),Number(row.totalPoints)]));
  const historyRow=outcomeHistoryForGameweek(historyValue,gameweek);
  const pickHistory=picksValue.entryHistory;
  const summary=pickHistory||historyRow;
  const picks=picksValue.picks.map(row=>{
    const basePoints=pointsByPlayer.has(row.playerId)?pointsByPlayer.get(row.playerId):null;
    return canonicalise({...row,basePoints,realisedContribution:basePoints==null?null:basePoints*row.multiplier});
  });
  const captain=picks.find(row=>row.isCaptain)||null;
  const vice=picks.find(row=>row.isViceCaptain)||null;
  const bench=picks.filter(row=>row.position>11);
  const pickMultiplierTotal=picks.every(row=>row.realisedContribution!=null)?picks.reduce((sum,row)=>sum+row.realisedContribution,0):null;
  const officialPoints=summary?.points??null;
  const delta=pickMultiplierTotal==null||officialPoints==null?null:officialPoints-pickMultiplierTotal;
  let agreement=delta==null?'not_available':delta===0?'agrees':'mismatch';
  if(pickHistory&&historyRow&&['points','totalPoints','eventTransferCount','eventTransferCost','pointsOnBench'].some(key=>pickHistory[key]!=null&&historyRow[key]!=null&&pickHistory[key]!==historyRow[key])) agreement='summary_conflict';
  return canonicalise({
    status:agreement==='summary_conflict'?'partial':'available',
    reason:agreement==='summary_conflict'?'manager_summary_conflict':null,
    activeChip:picksValue.activeChip,
    officialGameweekPoints:officialPoints,
    officialTotalPoints:summary?.totalPoints??null,
    eventTransferCount:summary?.eventTransferCount??null,
    eventTransferCost:summary?.eventTransferCost??null,
    officialPointsOnBench:summary?.pointsOnBench??null,
    picks,
    captain:captain?{playerId:captain.playerId,multiplier:captain.multiplier,basePoints:captain.basePoints,realisedContribution:captain.realisedContribution}:null,
    viceCaptain:vice?{playerId:vice.playerId,multiplier:vice.multiplier,basePoints:vice.basePoints,realisedContribution:vice.realisedContribution}:null,
    bench,
    automaticSubstitutions:picksValue.automaticSubstitutions,
    reconstruction:{pickMultiplierTotal,officialPointsDelta:delta,agreement}
  });
}
function outcomeCollectionStatus(event,fixturesValue,liveValue,expectedPlayerCount,detailIssues){
  const allFixturesFinished=Boolean(fixturesValue)&&fixturesValue.records.every(row=>row.finished===true);
  const playerComplete=Boolean(liveValue)&&liveValue.records.length===Number(expectedPlayerCount||liveValue.records.length)&&!detailIssues.length;
  return allFixturesFinished&&event?.finished===true&&event?.data_checked===true&&playerComplete?OUTCOME_STATUSES.COMPLETE:OUTCOME_STATUSES.PROVISIONAL;
}
async function collectOutcomePayload({
  managerRef,gameweek,event,fixturesPayload,livePayload,picksPayload=null,historyPayload=null,
  snapshotRecords=[],snapshotMetadata=[],trigger='automatic',mode='prospective_recheck',startedAt=Date.now(),completedAt=Date.now(),cryptoImpl=globalThis.crypto
}={}){
  if(!event||Number(event.id)!==Number(gameweek)||!event.deadline_time) return {ok:false,disposition:'rejected',reason:'event_alignment'};
  const fixturesV=validateOutcomeFixtures(fixturesPayload,gameweek);
  if(!fixturesV.value) return {ok:false,disposition:fixturesV.issues.some(row=>row.severity==='fatal')?'quarantined':'retry',reason:'fixtures_unusable',issues:fixturesV.issues};
  const fixtureIds=fixturesV.value.records.map(row=>row.fixtureId);
  const liveV=validateOutcomeLive(livePayload,fixtureIds);
  if(!liveV.value) return {ok:false,disposition:liveV.issues.some(row=>row.severity==='fatal')?'quarantined':'retry',reason:'live_unusable',issues:fixturesV.issues.concat(liveV.issues)};
  const picksV=validateOutcomePicks(picksPayload,gameweek);
  const historyV=validateOutcomeHistory(historyPayload);
  const detailIssues=outcomePlayerDetailIssues(liveV.value.records);
  const issues=fixturesV.issues.concat(liveV.issues,picksV.issues,historyV.issues,detailIssues);
  const status=outcomeCollectionStatus(event,fixturesV.value,liveV.value,S.boot?.elements?.length,detailIssues);
  const fixtureAssignmentHash=await sha256Hex(stableStringify(fixtureAssignmentHashMaterial(fixturesV.value.records)),cryptoImpl);
  const sourceProvenance=canonicalise({
    provider:'fpl',authority:'official',
    endpoints:[
      {endpoint:'/event/{gw}/live/',fetchedAt:outcomeIso(completedAt),normalisedHash:await sha256Hex(stableStringify(liveV.value),cryptoImpl)},
      {endpoint:'/fixtures/?event={gw}',fetchedAt:outcomeIso(completedAt),normalisedHash:await sha256Hex(stableStringify(fixturesV.value),cryptoImpl)},
      ...(picksPayload==null?[]:[{endpoint:'/entry/[redacted]/event/{gw}/picks/',fetchedAt:outcomeIso(completedAt),normalisedHash:await sha256Hex(stableStringify(picksV.value),cryptoImpl)}]),
      ...(historyPayload==null?[]:[{endpoint:'/entry/[redacted]/history/',fetchedAt:outcomeIso(completedAt),normalisedHash:await sha256Hex(stableStringify(historyV.value),cryptoImpl)}])
    ],
    retrySummary:outcomeSafeRetryRows()
  });
  const squad=buildSquadOutcome(picksV.value,historyV.value,gameweek,liveV.value.records);
  const payload=canonicalise({
    recordType:'gameweekOutcome',
    schemaVersion:OUTCOME_SCHEMA_VERSION,
    managerRef:String(managerRef||''),
    season:FPL_RULES.season,
    gameweek:Number(gameweek),
    status,
    collection:{startedAt:outcomeIso(startedAt),completedAt:outcomeIso(completedAt),finalisedAt:status===OUTCOME_STATUSES.COMPLETE?outcomeIso(completedAt):null,trigger:String(trigger),mode:String(mode),origin:'local_collection'},
    build:outcomeBuildInfo(),
    versions:{outcome:OUTCOME_SCHEMA_VERSION,snapshot:'1.0.0',model:MODEL_VERSION,rules:RULES_VERSION,simulation:SIMULATION_RULES.version},
    officialDeadlineIdentity:{eventId:Number(event.id),deadlineTime:outcomeIso(event.deadline_time),eventFinished:Boolean(event.finished),dataChecked:Boolean(event.data_checked),fixtureAssignmentHash},
    sourceProvenance,
    relatedSnapshot:snapshotRelation(snapshotRecords,gameweek,event.deadline_time,snapshotMetadata),
    fixtureOutcomes:{status:fixturesV.value.complete?'complete':'provisional',records:fixturesV.value.records},
    allPlayerOutcomes:{status:detailIssues.length?'partial':'complete',records:liveV.value.records},
    realSquadOutcome:squad,
    completeness:{
      complete:status===OUTCOME_STATUSES.COMPLETE,
      sections:{event:event.finished&&event.data_checked?'complete':'provisional',fixtures:fixturesV.value.complete?'complete':'provisional',players:detailIssues.length?'partial':'complete',squad:squad.status},
      fixtureCount:fixturesV.value.records.length,
      finishedFixtureCount:fixturesV.value.records.filter(row=>row.finished===true).length,
      playerCount:liveV.value.records.length,
      expectedPlayerCount:S.boot?.elements?.length??null,
      duplicateFixtureCount:issues.filter(row=>row.code?.includes('duplicate')).reduce((sum,row)=>sum+Number(row.count||1),0),
      duplicatePlayerCount:issues.filter(row=>row.code==='outcome_live_duplicate_player').reduce((sum,row)=>sum+Number(row.count||1),0)
    },
    validation:{disposition:status===OUTCOME_STATUSES.COMPLETE?'accepted':'provisional_acceptance',issues},
    identity:{logicalKey:`${FPL_RULES.season}|gw${Number(gameweek)}`,revision:null,rootOutcomeId:null,supersedesOutcomeId:null,outcomeDataHash:null,sectionHashes:null,contentHash:null,outcomeId:null}
  });
  assertEvidenceSafe(payload);
  return {ok:true,payload};
}
function outcomeDataMaterial(record){
  return canonicalise({
    season:record.season,gameweek:record.gameweek,status:record.status,
    officialDeadlineIdentity:record.officialDeadlineIdentity,
    sourceProvenance:{provider:record.sourceProvenance.provider,authority:record.sourceProvenance.authority,endpoints:record.sourceProvenance.endpoints.map(row=>({endpoint:row.endpoint,normalisedHash:row.normalisedHash}))},
    fixtureOutcomes:record.fixtureOutcomes,
    allPlayerOutcomes:record.allPlayerOutcomes,
    realSquadOutcome:record.realSquadOutcome,
    completeness:record.completeness
  });
}
async function computeOutcomeSectionHashes(record,cryptoImpl=globalThis.crypto){
  const sections={
    deadline:record.officialDeadlineIdentity,
    provenance:record.sourceProvenance,
    fixtures:record.fixtureOutcomes,
    players:record.allPlayerOutcomes,
    squad:record.realSquadOutcome,
    snapshotLink:record.relatedSnapshot,
    completeness:record.completeness
  };
  return canonicalise(Object.fromEntries(await Promise.all(Object.entries(sections).map(async([key,value])=>[key,await sha256Hex(stableStringify(value),cryptoImpl)]))));
}
function outcomeHashMaterial(record){
  const copy=canonicalise(record);
  if(copy.identity){ delete copy.identity.contentHash; delete copy.identity.outcomeId; }
  return copy;
}
async function finaliseOutcomeRecord(payload,{previousRecord=null}={},cryptoImpl=globalThis.crypto){
  assertEvidenceSafe(payload);
  const candidateDataHash=await sha256Hex(stableStringify(outcomeDataMaterial(payload)),cryptoImpl);
  if(previousRecord?.identity?.outcomeDataHash===candidateDataHash&&previousRecord.status===payload.status) return {unchanged:true,record:previousRecord};
  let status=payload.status;
  if([OUTCOME_STATUSES.COMPLETE,OUTCOME_STATUSES.CORRECTED].includes(previousRecord?.status)&&payload.status===OUTCOME_STATUSES.COMPLETE&&previousRecord.identity?.outcomeDataHash!==candidateDataHash) status=OUTCOME_STATUSES.CORRECTED;
  const outcomeDataHash=status===payload.status?candidateDataHash:await sha256Hex(stableStringify(outcomeDataMaterial({...payload,status})),cryptoImpl);
  const revision=Math.max(0,Number(previousRecord?.identity?.revision)||0)+1;
  const rootOutcomeId=previousRecord?.identity?.rootOutcomeId||`outcome-${payload.season}-gw${payload.gameweek}`;
  const sectionHashes=await computeOutcomeSectionHashes({...payload,status},cryptoImpl);
  const draft=canonicalise({...payload,status,collection:{...payload.collection,finalisedAt:[OUTCOME_STATUSES.COMPLETE,OUTCOME_STATUSES.CORRECTED].includes(status)?payload.collection.completedAt:null},validation:{...payload.validation,disposition:[OUTCOME_STATUSES.COMPLETE,OUTCOME_STATUSES.CORRECTED].includes(status)?'accepted':'provisional_acceptance'},identity:{logicalKey:payload.identity.logicalKey,revision,rootOutcomeId,supersedesOutcomeId:previousRecord?.identity?.outcomeId||null,outcomeDataHash,sectionHashes,contentHash:null,outcomeId:null}});
  const contentHash=await sha256Hex(stableStringify(outcomeHashMaterial(draft)),cryptoImpl);
  const outcomeId=`outcome-${payload.season}-gw${payload.gameweek}-r${revision}-${contentHash.slice(0,16)}`;
  const record=canonicalise({...draft,identity:{...draft.identity,contentHash,outcomeId}});
  assertEvidenceSafe(record);
  return {unchanged:false,record:deepFreeze(record)};
}
function outcomeShapeError(record){
  const keys=['allPlayerOutcomes','build','collection','completeness','fixtureOutcomes','gameweek','identity','managerRef','officialDeadlineIdentity','realSquadOutcome','recordType','relatedSnapshot','schemaVersion','season','sourceProvenance','status','validation','versions'].sort();
  if(stableStringify(Object.keys(record||{}).sort())!==stableStringify(keys)) return 'top_level_schema';
  if(!/^mgr-[0-9a-f]{32}$/.test(record.managerRef||'')) return 'manager_ref';
  if(!/^\d{4}-\d{2}$/.test(record.season||'')) return 'season';
  if(!Number.isInteger(record.gameweek)||record.gameweek<1||record.gameweek>38) return 'gameweek';
  if(!Object.values(OUTCOME_STATUSES).includes(record.status)) return 'status';
  if(!record.identity||!/^outcome-\d{4}-\d{2}-gw\d+-r\d+-[0-9a-f]{16}$/.test(record.identity.outcomeId||'')) return 'identity';
  if(!/^[0-9a-f]{64}$/.test(record.identity.contentHash||'')||!/^[0-9a-f]{64}$/.test(record.identity.outcomeDataHash||'')) return 'identity';
  if(!record.identity.sectionHashes||typeof record.identity.sectionHashes!=='object') return 'identity';
  if(!Array.isArray(record.fixtureOutcomes?.records)||!Array.isArray(record.allPlayerOutcomes?.records)) return 'outcome_sections';
  return null;
}
async function validateOutcomeRecord(record,cryptoImpl=globalThis.crypto){
  try{
    if(!record||record.recordType!=='gameweekOutcome') return {ok:false,reason:'record_type'};
    if(record.schemaVersion!==OUTCOME_SCHEMA_VERSION) return {ok:false,reason:'schema_version'};
    const shape=outcomeShapeError(record); if(shape) return {ok:false,reason:shape};
    assertEvidenceSafe(record);
    const sections=await computeOutcomeSectionHashes(record,cryptoImpl);
    if(stableStringify(sections)!==stableStringify(record.identity.sectionHashes)) return {ok:false,reason:'section_hash'};
    const dataHash=await sha256Hex(stableStringify(outcomeDataMaterial(record)),cryptoImpl);
    if(dataHash!==record.identity.outcomeDataHash) return {ok:false,reason:'outcome_data_hash'};
    const contentHash=await sha256Hex(stableStringify(outcomeHashMaterial(record)),cryptoImpl);
    if(contentHash!==record.identity.contentHash) return {ok:false,reason:'content_hash'};
    const expectedId=`outcome-${record.season}-gw${record.gameweek}-r${record.identity.revision}-${contentHash.slice(0,16)}`;
    if(record.identity.outcomeId!==expectedId) return {ok:false,reason:'outcome_id'};
    return {ok:true,record:deepFreeze(canonicalise(record))};
  }catch(error){ return {ok:false,reason:'invalid_record',message:error.message}; }
}
async function captureGameweekOutcome({
  managerRef,gameweek,previousRecord=null,snapshotRecords=[],snapshotMetadata=[],historyPayload=undefined,
  trigger='automatic',mode='prospective_recheck',apiFn=api,nowFn=Date.now,cryptoImpl=globalThis.crypto
}={}){
  const event=S.boot?.events?.find(row=>Number(row.id)===Number(gameweek));
  if(!event?.deadline_time) return {ok:false,disposition:'rejected',reason:'event_unavailable'};
  if(Date.parse(event.deadline_time)>nowFn()) return {ok:false,disposition:'not_due',reason:'deadline_not_passed'};
  const startedAt=nowFn();
  const [fixturesPayload,livePayload]=await Promise.all([
    apiFn(`/fixtures/?event=${gameweek}`,{optional:true}),
    apiFn(`/event/${gameweek}/live/`,{optional:true})
  ]);
  if(fixturesPayload==null||livePayload==null) return {ok:false,disposition:'retry',reason:'official_fpl_unavailable'};
  let picksPayload=null,managerHistory=historyPayload;
  if(S.teamId){
    picksPayload=await apiFn(`/entry/${S.teamId}/event/${gameweek}/picks/`,{optional:true});
    if(managerHistory===undefined) managerHistory=await apiFn(`/entry/${S.teamId}/history/`,{optional:true});
  }
  const completedAt=nowFn();
  const collected=await collectOutcomePayload({managerRef,gameweek,event,fixturesPayload,livePayload,picksPayload,historyPayload:managerHistory??null,snapshotRecords,snapshotMetadata,trigger,mode,startedAt,completedAt,cryptoImpl});
  if(!collected.ok) return collected;
  const finalised=await finaliseOutcomeRecord(collected.payload,{previousRecord},cryptoImpl);
  return {ok:true,...finalised};
}
function dueOutcomeGameweeks(events=[],now=Date.now()){
  return events.filter(event=>Number.isInteger(Number(event?.id))&&Number.isFinite(Date.parse(event?.deadline_time))&&Date.parse(event.deadline_time)<=now).map(event=>Number(event.id)).sort((a,b)=>a-b);
}

export {
  OUTCOME_SCHEMA_VERSION, OUTCOME_RULES, OUTCOME_STATUSES, outcomeBuildInfo, snapshotRelation,
  fixtureAssignmentHashMaterial, buildSquadOutcome, outcomeCollectionStatus, collectOutcomePayload,
  outcomeDataMaterial, computeOutcomeSectionHashes, finaliseOutcomeRecord, outcomeShapeError,
  validateOutcomeRecord, captureGameweekOutcome, dueOutcomeGameweeks
};
