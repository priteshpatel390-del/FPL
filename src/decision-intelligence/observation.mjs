import {canonicalise,sha256Hex,stableStringify,secretFinding} from './canonical.mjs';
import {classifyRights,persistenceDecision} from './rights.mjs';

export const OBSERVATION_SCHEMA_VERSION='di-observation-v1';
export const VALIDATION_VERSION='di-validation-v1';
export const SUBJECT_TYPES=Object.freeze(['player','team','fixture','competition']);
export const QUALITY_STATES=Object.freeze(['accepted','rejected']);
export const CONFLICT_STATES=Object.freeze(['none','conflicting','resolved']);
const IDENTITY=/^(\d{4}-\d{2}):fpl:(player|team|fixture|competition):(\d+)$/;
const ISO_SEASON=/^\d{4}-\d{2}$/;

export function canonicalFplIdentity(season,subjectType,id){
  if(!ISO_SEASON.test(season)||!SUBJECT_TYPES.includes(subjectType)||!/^\d+$/.test(String(id)))throw new Error('canonical_identity_invalid');
  return `${season}:fpl:${subjectType}:${id}`;
}
function identityError(id,{season,type,optional=false}){
  if(optional&&(id===null||id===undefined))return null;
  const match=IDENTITY.exec(String(id||''));
  if(!match)return 'canonical_identity_invalid';
  if(match[1]!==season)return 'season_mismatch';
  if(match[2]!==type)return type==='fixture'?'fixture_mismatch':'subject_type_mismatch';
  return null;
}
export function validateIdentity(identity={}){
  if(identity.displayName&&!identity.canonicalSubjectId)return {ok:false,reason:'display_name_only_identity'};
  if(!ISO_SEASON.test(identity.season||'')||!SUBJECT_TYPES.includes(identity.subjectType))return {ok:false,reason:'identity_invalid'};
  const subjectError=identityError(identity.canonicalSubjectId,{season:identity.season,type:identity.subjectType});
  if(subjectError)return {ok:false,reason:subjectError};
  const fixtureError=identityError(identity.fixtureId,{season:identity.season,type:'fixture',optional:true});
  if(fixtureError)return {ok:false,reason:fixtureError};
  const competitionError=identityError(identity.competitionId,{season:identity.season,type:'competition',optional:true});
  if(competitionError)return {ok:false,reason:competitionError};
  return {ok:true};
}
function instant(value,required){
  if(value===null||value===undefined||value==='')return required?{error:'timing_required'}:{value:null};
  const ms=Date.parse(value);return Number.isFinite(ms)?{value:new Date(ms).toISOString(),ms}:{error:'timing_invalid'};
}
export function validateTiming(timing={},requiredFields=['observedAt','fetchedAt']){
  const result={};
  for(const key of ['sourcePublishedAt','effectiveAt','observedAt','fetchedAt','expiresAt']){
    const parsed=instant(timing[key],requiredFields.includes(key));if(parsed.error)return {ok:false,reason:`${key}_${parsed.error}`};result[key]=parsed;
  }
  if(result.observedAt.ms>result.fetchedAt.ms)return {ok:false,reason:'observed_after_fetched'};
  if(result.sourcePublishedAt.ms>result.fetchedAt.ms)return {ok:false,reason:'published_after_fetched'};
  if(result.expiresAt.ms!==undefined&&result.expiresAt.ms<=result.fetchedAt.ms)return {ok:false,reason:'expired_when_fetched'};
  return {ok:true,timing:canonicalise(Object.fromEntries(Object.entries(result).map(([key,row])=>[key,row.value])))};
}
export function eligibleAsOf(observation,deadline){
  const at=Date.parse(deadline),fetched=Date.parse(observation?.timing?.fetchedAt),published=Date.parse(observation?.timing?.sourcePublishedAt??observation?.timing?.fetchedAt),expires=Date.parse(observation?.timing?.expiresAt);
  return Number.isFinite(at)&&Number.isFinite(fetched)&&Number.isFinite(published)&&fetched<=at&&published<=at&&(!Number.isFinite(expires)||expires>at)&&observation?.quality?.state==='accepted';
}
function requiredText(value){return typeof value==='string'&&value.trim().length>0;}
export async function admitObservation(input,{signal,cryptoImpl=globalThis.crypto}={}){
  const unsafe=secretFinding(input);if(unsafe)return {ok:false,reason:'secret_material',detail:unsafe};
  if(!signal)return {ok:false,reason:'signal_unregistered'};
  const identity=validateIdentity(input?.identity);if(!identity.ok)return identity;
  if(input.identity.subjectType!==signal.subjectType||input.identity.category!==signal.domain)return {ok:false,reason:'signal_identity_mismatch'};
  const timing=validateTiming(input.timing,signal.requiredTimingFields);if(!timing.ok)return timing;
  const rights=classifyRights(input.rights);if(!rights.valid||rights.classification!==signal.rightsClassification)return {ok:false,reason:'rights_mismatch'};
  if(signal.persistenceAllowed&&!persistenceDecision(input.rights).ok)return {ok:false,reason:'retention_blocked'};
  if(!requiredText(input?.value?.metric)||!Object.hasOwn(input?.value||{},'value'))return {ok:false,reason:'value_invalid'};
  if(!requiredText(input?.source?.sourceKey)||input.source.sourceKey!==signal.sourceKey||!requiredText(input.source.recordId))return {ok:false,reason:'source_invalid'};
  if(!requiredText(input?.provenance?.inputRevision)||!requiredText(input?.provenance?.validationVersion))return {ok:false,reason:'provenance_invalid'};
  if(input.provenance.validationVersion!==VALIDATION_VERSION)return {ok:false,reason:'validation_version_mismatch'};
  const quality=input.quality||{};
  if(!QUALITY_STATES.includes(quality.state)||!CONFLICT_STATES.includes(quality.conflictState||'none'))return {ok:false,reason:'quality_invalid'};
  const base=canonicalise({schemaVersion:OBSERVATION_SCHEMA_VERSION,signal:{signalId:signal.signalId,version:signal.version},identity:input.identity,value:input.value,timing:timing.timing,source:input.source,quality:{state:quality.state,rejectionReasons:quality.rejectionReasons||[],confidence:quality.confidence??null,sourceQuality:quality.sourceQuality??null,conflictState:quality.conflictState||'none'},provenance:input.provenance,rights,boundary:{capability:'shadow_only'}});
  const hash=await sha256Hex(stableStringify(base),cryptoImpl);
  return {ok:true,observation:Object.freeze(canonicalise({...base,identity:{...base.identity,observationId:`obs-${hash}`}}))};
}
