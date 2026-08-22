export const PLATFORM_VERSION='1.0.0';
export const MODE='shadow_only';
export const MAX_REQUEST_BYTES=64*1024;
export const MAX_PAGE_SIZE=100;
export const RIGHTS=Object.freeze(['durable_allowed','attribution_required','local_research_only','durable_blocked','unknown_fail_closed']);
const FORBIDDEN_KEY=/^(?:api[-_]?key|api[-_]?token|token|secret|password|authorization|cf[-_]?access[-_]?jwt[-_]?assertion|cookie|openai[-_]?api[-_]?key|anthropic[-_]?api[-_]?key|odds[-_]?api[-_]?key|account[-_]?id|manager[-_]?id|team[-_]?id|league[-_]?id|rival[-_]?id)$/i;
const SECRET_VALUE=/(?:\bbearer\s+\S+|\b(?:sk|ant)-[A-Za-z0-9_-]{8,})/i;
const KEYED_URL=/https?:\/\/[^\s]*[?&](?:key|token|api_key|apikey|access_token)=/i;
const CREDENTIAL_URL=/https?:\/\/[^\s/:]+:[^\s/@]+@/i;

export function safetyReason(value){
  const visit=(entry)=>{
    if(typeof entry==='string') return KEYED_URL.test(entry)||CREDENTIAL_URL.test(entry)?'keyed_url_detected':SECRET_VALUE.test(entry)?'secret_detected':null;
    if(Array.isArray(entry)){for(const child of entry){const reason=visit(child);if(reason)return reason;}return null;}
    if(entry&&typeof entry==='object'){for(const [key,child] of Object.entries(entry)){if(FORBIDDEN_KEY.test(key))return 'secret_detected';const reason=visit(child);if(reason)return reason;}}
    return null;
  };return visit(value);
}
export function rightsAdmission(revision){
  if(!revision||!RIGHTS.includes(revision.rights_classification))return {ok:false,reason:'rights_unknown'};
  if(revision.rights_classification==='unknown_fail_closed')return {ok:false,reason:'rights_unknown'};
  if(revision.rights_classification==='local_research_only')return {ok:false,reason:'local_research_only'};
  if(revision.rights_classification==='durable_blocked'||!revision.retention_allowed||!revision.shadow_ingest_allowed)return {ok:false,reason:'durable_storage_blocked'};
  if(revision.rights_classification==='attribution_required'&&!String(revision.attribution_text||'').trim())return {ok:false,reason:'attribution_missing'};
  return {ok:true};
}
export function canonicalFplId({season,type,id}){
  if(!/^\d{4}-\d{2}$/.test(season||'')||!['player','team','fixture','competition'].includes(type)||!/^\d+$/.test(String(id)))throw new Error('canonical_identity_invalid');
  return `${season}:fpl:${type}:${id}`;
}
export function validateMapping(mapping){
  if(!mapping||!['provider_id_crosswalk','manually_verified'].includes(mapping.mapping_method))return {ok:false,reason:'mapping_unresolved'};
  if(!String(mapping.provider_entity_id||'').trim())return {ok:false,reason:'mapping_unresolved'};
  if(mapping.mapping_status==='ambiguous')return {ok:false,reason:'mapping_ambiguous'};
  if(mapping.mapping_status!=='verified')return {ok:false,reason:'mapping_unresolved'};
  return {ok:true};
}
export function validateObservation(value,revision){
  const unsafe=safetyReason(value);if(unsafe)return {ok:false,reason:unsafe};
  if(value?.mode!==MODE)return {ok:false,reason:'mode_invalid'};
  const rights=rightsAdmission(revision);if(!rights.ok)return rights;
  const required=['observation_id','logical_key','ingestion_run_id','source_revision_id','category','subject_type','subject_entity_id','metric','value_type','observed_at','effective_at','fetched_at','transform_version','validation_version','input_revision'];
  if(required.some(key=>!String(value?.[key]??'').trim()))return {ok:false,reason:'schema_invalid'};
  if(!['number','text','boolean'].includes(value.value_type)||!Number.isFinite(Date.parse(value.fetched_at)))return {ok:false,reason:'value_invalid'};
  const populated=['value_number','value_text','value_boolean'].filter(key=>value[key]!==null&&value[key]!==undefined);
  if(populated.length!==1||populated[0]!==`value_${value.value_type}`)return {ok:false,reason:'value_invalid'};
  return {ok:true};
}
export function replayAt(observations,asOf){const t=Date.parse(asOf);if(!Number.isFinite(t))throw new Error('as_of_invalid');return observations.filter(row=>Date.parse(row.fetched_at)<=t).sort((a,b)=>a.fetched_at.localeCompare(b.fetched_at));}
export function boundedLimit(raw){const n=Number(raw??50);return Number.isInteger(n)&&n>0?Math.min(n,MAX_PAGE_SIZE):50;}
