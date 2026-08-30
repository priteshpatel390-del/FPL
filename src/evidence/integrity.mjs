import {MODEL_VERSION,RULES_VERSION} from '../config.mjs';
import {providerTrustError} from '../providers/registry.mjs';

const SNAPSHOT_SCHEMA_VERSION='1.0.0';
const OUTCOME_SCHEMA_VERSION='1.0.0';
const OUTCOME_STATUSES=new Set(['provisional','complete','corrected']);
const SAFETY_CUTOFF_MS=2*60*1000;
const CAPTURE_WINDOW_MS=24*60*60*1000;
const MAX_CLOCK_SKEW_MS=60*1000;
const FORBIDDEN_KEY=/^(?:api[-_]?key|odds[-_]?key|claude[-_]?key|anthropic[-_]?key|authorization|password|secret|access[-_]?token|refresh[-_]?token|token|team[-_]?id|entry(?:[-_]?id)?|league[-_]?id|manager[-_]?name|email|phone)$/i;
const RESTRICTED_SECRET_PREFIX=['sk','ant'].join('-')+'-';
const FORBIDDEN_VALUE=/(?:api[_-]?key\s*[:=]|authorization\s*[:=]\s*bearer)/i;

function canonicalise(value){
  if(value===null||typeof value==='string'||typeof value==='boolean')return value;
  if(typeof value==='number'){
    if(!Number.isFinite(value))throw new Error('Evidence records cannot contain non-finite numbers');
    return Object.is(value,-0)?0:value;
  }
  if(Array.isArray(value))return value.map(canonicalise);
  if(typeof value==='object'){
    const out={};
    Object.keys(value).sort().forEach(key=>{
      if(['__proto__','prototype','constructor'].includes(key))throw new Error(`Evidence records cannot contain unsafe object key: ${key}`);
      if(value[key]!==undefined)out[key]=canonicalise(value[key]);
    });
    return out;
  }
  throw new Error('Evidence records contain an unsupported value');
}
function stableStringify(value){return JSON.stringify(canonicalise(value));}
async function sha256Hex(text,cryptoImpl=globalThis.crypto){
  if(!cryptoImpl?.subtle||typeof TextEncoder==='undefined')throw new Error('SHA-256 is unavailable in this browser');
  const digest=await cryptoImpl.subtle.digest('SHA-256',new TextEncoder().encode(String(text)));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
function deepFreeze(value){if(!value||typeof value!=='object'||Object.isFrozen(value))return value;Object.freeze(value);Object.values(value).forEach(deepFreeze);return value;}
function findForbiddenEvidence(value,path='$',findings=[]){
  if(value===null||value===undefined)return findings;
  if(typeof value==='string'){if(value.includes(RESTRICTED_SECRET_PREFIX)||FORBIDDEN_VALUE.test(value))findings.push(`${path}:secret_value`);return findings;}
  if(Array.isArray(value)){value.forEach((entry,index)=>findForbiddenEvidence(entry,`${path}[${index}]`,findings));return findings;}
  if(typeof value==='object')Object.entries(value).forEach(([key,entry])=>{if(FORBIDDEN_KEY.test(key))findings.push(`${path}.${key}:secret_key`);findForbiddenEvidence(entry,`${path}.${key}`,findings);});
  return findings;
}
function assertEvidenceSafe(value){const findings=findForbiddenEvidence(value);if(findings.length)throw new Error(`Evidence safety check failed: ${findings.join(', ')}`);return true;}
function iso(value){const ms=value instanceof Date?value.getTime():Date.parse(value);return Number.isFinite(ms)?new Date(ms).toISOString():null;}
function clockSampleUsable(sample){return sample?.status==='available'&&Number.isFinite(Number(sample.serverAt))&&Number.isFinite(Number(sample.skewMs));}
function assessDeadlineTiming({deadlineTime,captureStartedAt,captureCompletedAt,networkBefore,networkAfter,providers=[],complete=false}={}){
  const deadlineMs=Date.parse(deadlineTime),startedMs=Number(captureStartedAt),completedMs=Number(captureCompletedAt);
  if(!Number.isFinite(deadlineMs)||!Number.isFinite(startedMs)||!Number.isFinite(completedMs))throw new Error('Deadline timing inputs are invalid');
  const cutoffMs=deadlineMs-SAFETY_CUTOFF_MS,beforeUsable=clockSampleUsable(networkBefore),afterUsable=clockSampleUsable(networkAfter);
  const skewConflict=(beforeUsable&&Math.abs(networkBefore.skewMs)>MAX_CLOCK_SKEW_MS)||(afterUsable&&Math.abs(networkAfter.skewMs)>MAX_CLOCK_SKEW_MS);
  const referenceCompletedAt=afterUsable?Number(networkAfter.serverAt):completedMs,includedProviders=(providers||[]).filter(row=>row.included);
  const lateProvider=includedProviders.find(row=>{const at=Date.parse(row.recordedAt);return !Number.isFinite(at)||at>=cutoffMs;});
  const reasons=[];if(referenceCompletedAt>deadlineMs)reasons.push('after_deadline');if(referenceCompletedAt>=cutoffMs)reasons.push('inside_safety_cutoff');if(deadlineMs-referenceCompletedAt>CAPTURE_WINDOW_MS)reasons.push('outside_capture_window');if(!complete)reasons.push('snapshot_incomplete');if(lateProvider)reasons.push(`provider_after_cutoff:${lateProvider.provider}`);if(!beforeUsable||!afterUsable)reasons.push('network_time_unavailable');if(skewConflict)reasons.push('clock_conflict');
  let grade='network_attested';if(referenceCompletedAt>=cutoffMs)grade='late';else if(skewConflict)grade='clock_conflict';else if(!beforeUsable||!afterUsable)grade='client_recorded';
  return canonicalise({grade,officialEligible:grade==='network_attested'&&reasons.length===0,reasons,deadlineTime:new Date(deadlineMs).toISOString(),safetyCutoffTime:new Date(cutoffMs).toISOString(),captureStartedAt:new Date(startedMs).toISOString(),captureCompletedAt:new Date(completedMs).toISOString(),networkBefore:networkBefore||{status:'unavailable'},networkAfter:networkAfter||{status:'unavailable'},referenceCompletedAt:new Date(referenceCompletedAt).toISOString(),includedProviderCount:includedProviders.length,allIncludedProvidersBeforeCutoff:!lateProvider,withinCaptureWindow:deadlineMs-referenceCompletedAt<=CAPTURE_WINDOW_MS&&referenceCompletedAt<deadlineMs,beforeSafetyCutoff:referenceCompletedAt<cutoffMs});
}
async function snapshotSectionHashes(payload,cryptoImpl){
  const players=payload.outputs?.players||[],sections={modelInputs:payload.modelInputs||null,playerProjections:players.map(row=>({playerId:row.playerId,nextGameweek:row.nextGameweek,perGameweek:row.perGameweek,aggregate:row.aggregate,sourceUsage:row.sourceUsage})),minutes:players.map(row=>({playerId:row.playerId,minutes:row.minutes})),uncertainty:players.map(row=>({playerId:row.playerId,uncertainty:row.uncertainty})),decisions:payload.outputs?.squad||null,providers:payload.providers||[],fplInputs:{events:payload.modelInputs?.events||[],teams:payload.modelInputs?.teams||[],players:payload.modelInputs?.players||[],fixtures:payload.modelInputs?.fixtures||[],minuteHistory:payload.modelInputs?.minuteHistory||{}},understatInputs:payload.modelInputs?.understat??null,oddsInputs:payload.modelInputs?.odds??null,archiveInputs:payload.modelInputs?.calibration??null,ruleConfiguration:payload.rules||null};
  return canonicalise(Object.fromEntries(await Promise.all(Object.entries(sections).map(async([name,value])=>[name,await sha256Hex(stableStringify(value),cryptoImpl)]))));
}
function snapshotHashMaterial(record){const copy=canonicalise(record);if(copy.identity){delete copy.identity.contentHash;delete copy.identity.snapshotId;}return copy;}
function snapshotShapeError(record){
  const required=['build','capture','completeness','deadlineTime','gameweek','identity','issues','managerRef','metricVersion','modelInputs','outputs','providers','quality','recordType','retries','rules','schemaVersion','season','segmentationVersion','timing','versions'];
  if(stableStringify(Object.keys(record||{}).sort())!==stableStringify(required.slice().sort()))return 'top_level_schema';
  if(!/^mgr-[0-9a-f]{32}$/.test(record.managerRef||''))return 'manager_ref';if(!/^\d{4}-\d{2}$/.test(record.season||''))return 'season';if(!Number.isInteger(record.gameweek)||record.gameweek<1||record.gameweek>38)return 'gameweek';if(!iso(record.deadlineTime))return 'deadline';if(!record.build||typeof record.build!=='object'||!record.versions||typeof record.versions!=='object')return 'build_identity';if(!Array.isArray(record.providers)||!Array.isArray(record.retries)||!Array.isArray(record.issues))return 'provider_schema';const providerError=providerTrustError(record.providers);if(providerError)return providerError;if(!record.modelInputs||typeof record.modelInputs!=='object'||!record.outputs||typeof record.outputs!=='object'||!Array.isArray(record.outputs.players))return 'payload_schema';if(!record.completeness||typeof record.completeness.complete!=='boolean')return 'completeness_schema';if(!record.timing||!['network_attested','client_recorded','clock_conflict','late'].includes(record.timing.grade)||typeof record.timing.officialEligible!=='boolean'||!Array.isArray(record.timing.reasons))return 'timing_schema';if(!record.identity||!/^predeadline-gw\d+-[0-9a-f]{16}$/.test(record.identity.snapshotId||'')||!/^[0-9a-f]{64}$/.test(record.identity.contentHash||''))return 'identity_schema';if(!record.identity.sectionHashes||typeof record.identity.sectionHashes!=='object'||!record.identity.ruleHashes||typeof record.identity.ruleHashes!=='object')return 'identity_schema';return null;
}
export async function validateSnapshotIntegrity(record,cryptoImpl=globalThis.crypto){
  try{if(!record||record.recordType!=='preDeadlineSnapshot')return {ok:false,reason:'record_type'};if(record.schemaVersion!==SNAPSHOT_SCHEMA_VERSION)return {ok:false,reason:'schema_version'};const shape=snapshotShapeError(record);if(shape)return {ok:false,reason:shape};assertEvidenceSafe(record);const sections=await snapshotSectionHashes(record,cryptoImpl);if(stableStringify(sections)!==stableStringify(record.identity.sectionHashes))return {ok:false,reason:'section_hash'};if(record.identity.ruleHashes.configuration!==sections.ruleConfiguration)return {ok:false,reason:'rule_hash'};const duplicate=[record.season,`gw${record.gameweek}`,record.deadlineTime,record.build?.sourceHash||'unknown',record.versions?.model||MODEL_VERSION,record.versions?.rules||RULES_VERSION].join('|');if(record.identity.duplicateKey!==duplicate)return {ok:false,reason:'duplicate_key'};const timing=assessDeadlineTiming({deadlineTime:record.deadlineTime,captureStartedAt:Date.parse(record.timing.captureStartedAt),captureCompletedAt:Date.parse(record.timing.captureCompletedAt),networkBefore:record.timing.networkBefore,networkAfter:record.timing.networkAfter,providers:record.providers,complete:record.completeness.complete});if(stableStringify(timing)!==stableStringify(record.timing))return {ok:false,reason:'timing_evidence'};const expected=await sha256Hex(stableStringify(snapshotHashMaterial(record)),cryptoImpl);if(expected!==record.identity.contentHash)return {ok:false,reason:'content_hash'};if(record.identity.snapshotId!==`predeadline-gw${record.gameweek}-${expected.slice(0,16)}`)return {ok:false,reason:'snapshot_id'};return {ok:true,record:deepFreeze(canonicalise(record))};}catch(error){return {ok:false,reason:'invalid_record',message:error.message};}
}

function outcomeDataMaterial(record){return canonicalise({season:record.season,gameweek:record.gameweek,status:record.status,officialDeadlineIdentity:record.officialDeadlineIdentity,sourceProvenance:{provider:record.sourceProvenance.provider,authority:record.sourceProvenance.authority,endpoints:record.sourceProvenance.endpoints.map(row=>({endpoint:row.endpoint,normalisedHash:row.normalisedHash}))},fixtureOutcomes:record.fixtureOutcomes,allPlayerOutcomes:record.allPlayerOutcomes,realSquadOutcome:record.realSquadOutcome,completeness:record.completeness});}
async function outcomeSectionHashes(record,cryptoImpl){const sections={deadline:record.officialDeadlineIdentity,provenance:record.sourceProvenance,fixtures:record.fixtureOutcomes,players:record.allPlayerOutcomes,squad:record.realSquadOutcome,snapshotLink:record.relatedSnapshot,completeness:record.completeness};return canonicalise(Object.fromEntries(await Promise.all(Object.entries(sections).map(async([key,value])=>[key,await sha256Hex(stableStringify(value),cryptoImpl)]))));}
function outcomeHashMaterial(record){const copy=canonicalise(record);if(copy.identity){delete copy.identity.contentHash;delete copy.identity.outcomeId;}return copy;}
function outcomeShapeError(record){const keys=['allPlayerOutcomes','build','collection','completeness','fixtureOutcomes','gameweek','identity','managerRef','officialDeadlineIdentity','realSquadOutcome','recordType','relatedSnapshot','schemaVersion','season','sourceProvenance','status','validation','versions'].sort();if(stableStringify(Object.keys(record||{}).sort())!==stableStringify(keys))return 'top_level_schema';if(!/^mgr-[0-9a-f]{32}$/.test(record.managerRef||''))return 'manager_ref';if(!/^\d{4}-\d{2}$/.test(record.season||''))return 'season';if(!Number.isInteger(record.gameweek)||record.gameweek<1||record.gameweek>38)return 'gameweek';if(!OUTCOME_STATUSES.has(record.status))return 'status';if(!record.identity||!/^outcome-\d{4}-\d{2}-gw\d+-r\d+-[0-9a-f]{16}$/.test(record.identity.outcomeId||''))return 'identity';if(!/^[0-9a-f]{64}$/.test(record.identity.contentHash||'')||!/^[0-9a-f]{64}$/.test(record.identity.outcomeDataHash||''))return 'identity';if(!record.identity.sectionHashes||typeof record.identity.sectionHashes!=='object')return 'identity';if(!Array.isArray(record.fixtureOutcomes?.records)||!Array.isArray(record.allPlayerOutcomes?.records))return 'outcome_sections';return null;}
export async function validateOutcomeIntegrity(record,cryptoImpl=globalThis.crypto){
  try{if(!record||record.recordType!=='gameweekOutcome')return {ok:false,reason:'record_type'};if(record.schemaVersion!==OUTCOME_SCHEMA_VERSION)return {ok:false,reason:'schema_version'};const shape=outcomeShapeError(record);if(shape)return {ok:false,reason:shape};assertEvidenceSafe(record);const sections=await outcomeSectionHashes(record,cryptoImpl);if(stableStringify(sections)!==stableStringify(record.identity.sectionHashes))return {ok:false,reason:'section_hash'};const dataHash=await sha256Hex(stableStringify(outcomeDataMaterial(record)),cryptoImpl);if(dataHash!==record.identity.outcomeDataHash)return {ok:false,reason:'outcome_data_hash'};const contentHash=await sha256Hex(stableStringify(outcomeHashMaterial(record)),cryptoImpl);if(contentHash!==record.identity.contentHash)return {ok:false,reason:'content_hash'};const id=`outcome-${record.season}-gw${record.gameweek}-r${record.identity.revision}-${contentHash.slice(0,16)}`;if(record.identity.outcomeId!==id)return {ok:false,reason:'outcome_id'};return {ok:true,record:deepFreeze(canonicalise(record))};}catch(error){return {ok:false,reason:'invalid_record',message:error.message};}
}
