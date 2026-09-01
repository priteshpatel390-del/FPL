import {MAX_CHANGED_OBSERVATIONS_PER_RUN} from './official-fpl-canonical.mjs';

export const D1_MAX_SQL_BYTES=100000;
export const D1_MAX_BOUND_PARAMETERS=100;
export const D1_MAX_VALUE_BYTES=2000000;
export const D1_MAX_BATCH_STATEMENTS=40;

const trustedPlans=new WeakSet();
const encoder=new TextEncoder();
const SOURCE_REVISION_SQL=`SELECT r.*,s.source_key,s.source_kind FROM data_source_revisions r JOIN data_sources s ON s.source_id=r.source_id WHERE r.source_revision_id=?`;
const RUN_SQL=`SELECT run_id,source_revision_id,status,records_seen,records_accepted,records_quarantined,records_rejected,error_class FROM ingestion_runs WHERE run_id=? AND source_revision_id=?`;
const HEADS_SQL=`SELECT o.* FROM observation_heads h JOIN shadow_observations o ON o.observation_id=h.observation_id JOIN ingestion_runs r ON r.run_id=o.ingestion_run_id AND r.source_revision_id=o.source_revision_id WHERE o.source_revision_id=? AND r.status='completed'`;
const START_SQL=`INSERT OR IGNORE INTO ingestion_runs (run_id,source_revision_id,run_type,mode,started_at,completed_at,status,safe_endpoint_class,parser_version,transform_version,schema_version,records_seen,records_accepted,records_quarantined,records_rejected,error_class,created_at) VALUES (?,?,'official_fpl_structured_history','shadow_only',?,NULL,'started',?,?,?,?,0,0,0,0,NULL,?)`;
const FAIL_SQL=`UPDATE ingestion_runs SET completed_at=?,status='failed',error_class=? WHERE run_id=? AND source_revision_id=?`;
const COMPLETE_SQL=`UPDATE ingestion_runs SET completed_at=?,status='completed',records_seen=?,records_accepted=?,records_quarantined=0,records_rejected=0,error_class=NULL WHERE run_id=? AND source_revision_id=?`;
const ENTITY_SQL=`INSERT OR IGNORE INTO canonical_entities (canonical_entity_id,entity_type,season,canonical_system,canonical_external_id,created_at)\nSELECT json_extract(value,'$.canonical_entity_id'),json_extract(value,'$.entity_type'),json_extract(value,'$.season'),json_extract(value,'$.canonical_system'),json_extract(value,'$.canonical_external_id'),json_extract(value,'$.created_at') FROM json_each(?)`;
const OBSERVATION_SQL=`INSERT INTO shadow_observations (observation_id,logical_key,ingestion_run_id,source_revision_id,category,subject_type,subject_entity_id,fixture_entity_id,competition_entity_id,subject_mapping_id,fixture_mapping_id,competition_mapping_id,provenance_kind,metric,value_type,value_number,value_text,value_boolean,unit,observed_at,effective_at,fetched_at,expires_at,source_timestamp,provider_record_id,transform_version,validation_version,input_revision,admission_state,quality_state,conflict_group_id,mode,created_at)\nSELECT json_extract(value,'$.observation_id'),json_extract(value,'$.logical_key'),json_extract(value,'$.ingestion_run_id'),json_extract(value,'$.source_revision_id'),json_extract(value,'$.category'),json_extract(value,'$.subject_type'),json_extract(value,'$.subject_entity_id'),json_extract(value,'$.fixture_entity_id'),json_extract(value,'$.competition_entity_id'),json_extract(value,'$.subject_mapping_id'),json_extract(value,'$.fixture_mapping_id'),json_extract(value,'$.competition_mapping_id'),json_extract(value,'$.provenance_kind'),json_extract(value,'$.metric'),json_extract(value,'$.value_type'),json_extract(value,'$.value_number'),json_extract(value,'$.value_text'),json_extract(value,'$.value_boolean'),json_extract(value,'$.unit'),json_extract(value,'$.observed_at'),json_extract(value,'$.effective_at'),json_extract(value,'$.fetched_at'),json_extract(value,'$.expires_at'),json_extract(value,'$.source_timestamp'),json_extract(value,'$.provider_record_id'),json_extract(value,'$.transform_version'),json_extract(value,'$.validation_version'),json_extract(value,'$.input_revision'),json_extract(value,'$.admission_state'),json_extract(value,'$.quality_state'),json_extract(value,'$.conflict_group_id'),json_extract(value,'$.mode'),json_extract(value,'$.created_at') FROM json_each(?)`;
const HEAD_SQL=`INSERT INTO observation_heads (logical_key,observation_id,updated_at)\nSELECT json_extract(value,'$.logical_key'),json_extract(value,'$.observation_id'),json_extract(value,'$.updated_at') FROM json_each(?) WHERE 1\nON CONFLICT(logical_key) DO UPDATE SET observation_id=excluded.observation_id,updated_at=excluded.updated_at`;
const chunk=(rows,size)=>{const out=[];for(let i=0;i<rows.length;i+=size)out.push(rows.slice(i,i+size));return out;};
const required=(value,name)=>{if(typeof value!=='string'||!value)throw new Error(`official_fpl_plan_${name}_invalid`);return value;};
const number=value=>{if(!Number.isSafeInteger(value)||value<0)throw new Error('official_fpl_plan_counter_invalid');return String(value);};
const json=value=>JSON.stringify(value);

function create(kind,mutation,statements){
  if(!['read','mutation'].includes(kind)||typeof mutation!=='boolean'||!Array.isArray(statements)||statements.length<1||statements.length>D1_MAX_BATCH_STATEMENTS)throw new Error('official_fpl_plan_invalid');
  const safe=statements.map(({sql,params=[]})=>{
    if(typeof sql!=='string'||encoder.encode(sql).byteLength>D1_MAX_SQL_BYTES||!Array.isArray(params)||params.length>D1_MAX_BOUND_PARAMETERS)throw new Error('official_fpl_plan_limit_exceeded');
    const values=params.map(value=>{if(typeof value!=='string'||encoder.encode(value).byteLength>D1_MAX_VALUE_BYTES)throw new Error('official_fpl_plan_parameter_invalid');return value;});
    return Object.freeze({sql,params:Object.freeze(values)});
  });
  const plan=Object.freeze({kind,mutation,statements:Object.freeze(safe)});trustedPlans.add(plan);return plan;
}

export function inspectOfficialFplD1RestPlan(plan){return trustedPlans.has(plan)?plan:null;}
export const buildSourceRevisionRead=({sourceRevisionId})=>create('read',false,[{sql:SOURCE_REVISION_SQL,params:[required(sourceRevisionId,'source_revision')]}]);
export const buildRunRead=({runId,sourceRevisionId})=>create('read',false,[{sql:RUN_SQL,params:[required(runId,'run'),required(sourceRevisionId,'source_revision')]}]);
export const buildCurrentHeadsRead=({sourceRevisionId})=>create('read',false,[{sql:HEADS_SQL,params:[required(sourceRevisionId,'source_revision')]}]);
export const buildStartRunMutation=({runId,sourceRevisionId,startedAt,safeEndpointClass,parserVersion,transformVersion,schemaVersion})=>create('mutation',true,[{sql:START_SQL,params:[required(runId,'run'),required(sourceRevisionId,'source_revision'),required(startedAt,'timestamp'),required(safeEndpointClass,'endpoint'),required(parserVersion,'parser'),required(transformVersion,'transform'),required(schemaVersion,'schema'),startedAt]}]);
export const buildFailRunMutation=({completedAt,errorClass,runId,sourceRevisionId})=>create('mutation',true,[{sql:FAIL_SQL,params:[required(completedAt,'timestamp'),required(errorClass,'error').slice(0,64),required(runId,'run'),required(sourceRevisionId,'source_revision')]}]);
export const buildCompleteUnchangedMutation=({completedAt,recordsSeen,runId,sourceRevisionId})=>create('mutation',true,[{sql:COMPLETE_SQL,params:[required(completedAt,'timestamp'),number(recordsSeen),'0',required(runId,'run'),required(sourceRevisionId,'source_revision')]}]);
export function buildCommitBatch({entities,previousRows,observations,completedAt,recordsSeen,runId,sourceRevisionId}){
  if(!Array.isArray(entities)||!Array.isArray(previousRows)||!Array.isArray(observations))throw new Error('official_fpl_plan_rows_invalid');
  if(observations.length>MAX_CHANGED_OBSERVATIONS_PER_RUN)throw new Error('write_budget_exceeded');
  const previous=new Set(previousRows.map(row=>row.subject_entity_id));const statements=[];
  const fresh=entities.filter(row=>!previous.has(row.canonical_entity_id));if(fresh.length)statements.push({sql:ENTITY_SQL,params:[json(fresh)]});
  for(const rows of chunk(observations,600))statements.push({sql:OBSERVATION_SQL,params:[json(rows)]});
  const heads=observations.map(row=>({logical_key:row.logical_key,observation_id:row.observation_id,updated_at:completedAt}));
  for(const rows of chunk(heads,2000))statements.push({sql:HEAD_SQL,params:[json(rows)]});
  statements.push({sql:COMPLETE_SQL,params:[required(completedAt,'timestamp'),number(recordsSeen),number(observations.length),required(runId,'run'),required(sourceRevisionId,'source_revision')]});
  return create('mutation',true,statements);
}
