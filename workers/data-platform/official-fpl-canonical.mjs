import {observationIdentity,validateObservation} from './data-platform-core.mjs';
import {
  DATA_S2_NULL,DATA_S2_TRANSFORM_VERSION,DATA_S2_VALIDATION_VERSION,canonicalOfficialFplInstant
} from '../../src/decision-intelligence/official-fpl-history-canonical.mjs';

export {
  DATA_S2_NULL,DATA_S2_SCHEMA_VERSION,DATA_S2_SOURCE_REVISION_ID,DATA_S2_TRANSFORM_VERSION,DATA_S2_VALIDATION_VERSION,
  canonicalOfficialFplInstant,deriveOfficialFplSeason,normaliseOfficialFplHistory
} from '../../src/decision-intelligence/official-fpl-history-canonical.mjs';

export const MAX_CHANGED_OBSERVATIONS_PER_RUN=15000;

const iso=canonicalOfficialFplInstant;

function sameScalar(a,b){
  if(!a||!b||a.value_type!==b.value_type)return false;
  if(a.value_type==='number')return Number(a.value_number)===Number(b.value_number);
  if(a.value_type==='boolean')return Boolean(Number(a.value_boolean))===Boolean(b.value_boolean);
  return String(a.value_text??'')===String(b.value_text??'');
}

export function diffOfficialFplHistory(candidates,previousRows=[]){
  const previous=new Map(previousRows.map(row=>[row.logical_key,row]));
  const currentPresent=new Set(candidates.filter(row=>row.metric==='present').map(row=>row.logical_key));
  const changes=[];
  for(const row of candidates)if(!sameScalar(row,previous.get(row.logical_key)))changes.push(row);
  for(const row of previousRows){
    if(row.metric!=='present'||!Boolean(Number(row.value_boolean))||currentPresent.has(row.logical_key))continue;
    changes.push({...row,value_type:'boolean',value_boolean:false,value_number:null,value_text:null,unit:null,
      fixture_entity_id:null,competition_entity_id:null,subject_mapping_id:null,fixture_mapping_id:null,competition_mapping_id:null,
      provenance_kind:'canonical_native_fpl'});
  }
  changes.sort((a,b)=>a.logical_key.localeCompare(b.logical_key));
  return changes;
}

export async function materialiseOfficialFplChanges(changes,{runId,sourceRevision,fetchedAt,cryptoImpl=globalThis.crypto}={}){
  if(changes.length>MAX_CHANGED_OBSERVATIONS_PER_RUN)throw new Error('write_budget_exceeded');
  const fetched=iso(fetchedAt);
  return Promise.all(changes.map(async change=>{
    const input={...change,ingestion_run_id:runId,source_revision_id:sourceRevision.source_revision_id,
      observed_at:null,effective_at:null,fetched_at:fetched,expires_at:null,source_timestamp:null,
      transform_version:DATA_S2_TRANSFORM_VERSION,validation_version:DATA_S2_VALIDATION_VERSION,input_revision:runId,
      admission_state:'accepted',quality_state:'fresh',conflict_group_id:null,mode:'shadow_only'};
    const verdict=validateObservation(input,sourceRevision);if(!verdict.ok)throw new Error(`observation_${verdict.reason}`);
    const row={...verdict.observation};row.observation_id=await observationIdentity(row,cryptoImpl);row.created_at=fetched;return row;
  }));
}
