export const PLATFORM_VERSION='1.0.1';
export const MODE='shadow_only';
export const MAX_REQUEST_BYTES=64*1024;
export const MAX_PAGE_SIZE=100;
export const RIGHTS=Object.freeze(['durable_allowed','attribution_required','local_research_only','durable_blocked','unknown_fail_closed']);
export const MAPPING_METHODS=Object.freeze(['provider_id_crosswalk','manually_verified']);
export const ADMISSION_STATES=Object.freeze(['accepted','quarantined']);
export const QUALITY_STATES=Object.freeze(['fresh','stale','conflicting','uncertain']);
export const VALUE_TYPES=Object.freeze(['number','text','boolean']);
const FORBIDDEN_KEY=/^(?:api[-_]?key|api[-_]?token|token|secret|client[-_]?secret|client[-_]?id|access[-_]?key|private[-_]?key|auth|auth[-_]?token|password|passwd|authorization|cf[-_]?access[-_]?jwt[-_]?assertion|cookie|openai[-_]?api[-_]?key|anthropic[-_]?api[-_]?key|odds[-_]?api[-_]?key|account[-_]?id|manager[-_]?id|team[-_]?id|league[-_]?id|rival[-_]?id)$/i;
const SECRET_VALUE=/(?:\bbearer\s+\S+|\b(?:sk|ant)-[A-Za-z0-9_-]{8,})/i;
const CREDENTIAL_PARAM=/^(?:key|token|api[_-]?key|apikey|access[_-]?token|access[_-]?key|auth|auth[_-]?token|client[_-]?secret|signature|sig)$/i;

function decoded(value){try{return decodeURIComponent(String(value).replace(/\+/g,' '));}catch{return String(value);}}
function credentialUrl(value){
  if(!/^https?:\/\//i.test(value))return false;
  try{const url=new URL(value);if(url.username||url.password)return true;for(const key of url.searchParams.keys())if(CREDENTIAL_PARAM.test(decoded(key)))return true;return false;}catch{return false;}
}
export function safetyReason(value){
  const visit=entry=>{
    if(typeof entry==='string')return credentialUrl(entry)?'keyed_url_detected':SECRET_VALUE.test(entry)?'secret_detected':null;
    if(Array.isArray(entry)){for(const child of entry){const reason=visit(child);if(reason)return reason;}return null;}
    if(entry&&typeof entry==='object'){for(const [key,child] of Object.entries(entry)){if(FORBIDDEN_KEY.test(key))return 'secret_detected';const reason=visit(child);if(reason)return reason;}}
    return null;
  };return visit(value);
}
export function validateRevision(revision){
  if(!revision||!RIGHTS.includes(revision.rights_classification))return {ok:false,reason:'rights_unknown'};
  const attribution=revision.rights_classification==='attribution_required';
  if(Boolean(revision.attribution_required)!==attribution)return {ok:false,reason:'rights_inconsistent'};
  if(attribution&&!String(revision.attribution_text||'').trim())return {ok:false,reason:'attribution_missing'};
  return {ok:true};
}
export function rightsAdmission(revision){
  const consistent=validateRevision(revision);if(!consistent.ok)return consistent;
  if(revision.rights_classification==='unknown_fail_closed')return {ok:false,reason:'rights_unknown'};
  if(revision.rights_classification==='local_research_only')return {ok:false,reason:'local_research_only'};
  if(revision.rights_classification==='durable_blocked'||!revision.retention_allowed||!revision.shadow_ingest_allowed)return {ok:false,reason:'durable_storage_blocked'};
  return {ok:true};
}
export function canonicalTimestamp(value,{required=false}={}){
  if(value===null||value===undefined||value===''){if(required)throw new Error('timestamp_required');return null;}
  const ms=Date.parse(value);if(!Number.isFinite(ms))throw new Error('timestamp_invalid');return new Date(ms).toISOString();
}
export function canonicalFplId({season,type,id}){if(!/^\d{4}-\d{2}$/.test(season||'')||!['player','team','fixture','competition'].includes(type)||!/^\d+$/.test(String(id)))throw new Error('canonical_identity_invalid');return `${season}:fpl:${type}:${id}`;}
export function validateMapping(mapping,{sourceRevisionId,canonicalEntityId}={}){
  if(!mapping||!MAPPING_METHODS.includes(mapping.mapping_method)||!String(mapping.provider_entity_id||'').trim())return {ok:false,reason:'mapping_unresolved'};
  if(mapping.mapping_status==='ambiguous')return {ok:false,reason:'mapping_ambiguous'};
  if(mapping.mapping_status!=='verified')return {ok:false,reason:'mapping_unresolved'};
  if(sourceRevisionId&&mapping.source_revision_id!==sourceRevisionId)return {ok:false,reason:'mapping_source_mismatch'};
  if(canonicalEntityId&&mapping.canonical_entity_id!==canonicalEntityId)return {ok:false,reason:'mapping_target_mismatch'};
  return {ok:true};
}
export function canonicaliseObservation(value){
  const out={...value};
  out.observed_at=canonicalTimestamp(value.observed_at);
  out.effective_at=canonicalTimestamp(value.effective_at);
  out.fetched_at=canonicalTimestamp(value.fetched_at,{required:true});
  out.expires_at=canonicalTimestamp(value.expires_at);
  out.source_timestamp=canonicalTimestamp(value.source_timestamp);
  out.mode=MODE;
  return out;
}
export function validateObservation(value,revision){
  const unsafe=safetyReason(value);if(unsafe)return {ok:false,reason:unsafe};
  if(value?.mode!==MODE)return {ok:false,reason:'mode_invalid'};
  const rights=rightsAdmission(revision);if(!rights.ok)return rights;
  const required=['logical_key','ingestion_run_id','source_revision_id','category','subject_type','subject_entity_id','metric','value_type','fetched_at','transform_version','validation_version','input_revision','provenance_kind'];
  if(required.some(key=>!String(value?.[key]??'').trim()))return {ok:false,reason:'schema_invalid'};
  if(!VALUE_TYPES.includes(value.value_type)||!ADMISSION_STATES.includes(value.admission_state||'accepted')||!QUALITY_STATES.includes(value.quality_state||'fresh'))return {ok:false,reason:'value_invalid'};
  const populated=['value_number','value_text','value_boolean'].filter(key=>value[key]!==null&&value[key]!==undefined);
  if(populated.length!==1||populated[0]!==`value_${value.value_type}`||value.value_type==='number'&&!Number.isFinite(value.value_number)||value.value_type==='boolean'&&typeof value.value_boolean!=='boolean')return {ok:false,reason:'value_invalid'};
  try{return {ok:true,observation:canonicaliseObservation(value)};}catch{return {ok:false,reason:'timestamp_invalid'};}
}
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])]));return value;}
export function observationIdentityMaterial(row){
  const fields=['logical_key','ingestion_run_id','source_revision_id','category','subject_type','subject_entity_id','fixture_entity_id','competition_entity_id','subject_mapping_id','fixture_mapping_id','competition_mapping_id','provenance_kind','metric','value_type','value_number','value_text','value_boolean','unit','observed_at','effective_at','fetched_at','expires_at','source_timestamp','provider_record_id','transform_version','validation_version','input_revision','admission_state','quality_state','conflict_group_id','mode'];
  return canonical(Object.fromEntries(fields.map(key=>[key,row[key]??null])));
}
export async function observationIdentity(row,cryptoImpl=globalThis.crypto){const bytes=new TextEncoder().encode(JSON.stringify(observationIdentityMaterial(row)));const digest=await cryptoImpl.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');}
export function replayAt(observations,asOf){const t=Date.parse(asOf);if(!Number.isFinite(t))throw new Error('as_of_invalid');return observations.filter(row=>Date.parse(row.fetched_at)<=t&&row.admission_state!=='quarantined').sort((a,b)=>Date.parse(a.fetched_at)-Date.parse(b.fetched_at)||String(a.observation_id).localeCompare(String(b.observation_id)));}
export function boundedLimit(raw){const n=Number(raw??50);return Number.isInteger(n)&&n>0?Math.min(n,MAX_PAGE_SIZE):50;}
export function encodeCursor({asOf,fetchedAt,observationId}){return btoa(JSON.stringify({v:1,a:asOf,f:fetchedAt,o:observationId}));}
export function decodeCursor(value){try{const row=JSON.parse(atob(value));if(row.v!==1||!row.a||!row.f||!row.o)return null;return {asOf:canonicalTimestamp(row.a,{required:true}),fetchedAt:canonicalTimestamp(row.f,{required:true}),observationId:String(row.o)};}catch{return null;}}
