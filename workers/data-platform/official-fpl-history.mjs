import {rightsAdmission} from './data-platform-core.mjs';
import {
  DATA_S2_NULL,DATA_S2_SCHEMA_VERSION,DATA_S2_SOURCE_REVISION_ID,DATA_S2_TRANSFORM_VERSION,DATA_S2_VALIDATION_VERSION,
  MAX_CHANGED_OBSERVATIONS_PER_RUN,diffOfficialFplHistory,materialiseOfficialFplChanges,normaliseOfficialFplHistory
} from './official-fpl-canonical.mjs';

export {
  DATA_S2_NULL,DATA_S2_SCHEMA_VERSION,DATA_S2_SOURCE_REVISION_ID,DATA_S2_TRANSFORM_VERSION,DATA_S2_VALIDATION_VERSION,
  MAX_CHANGED_OBSERVATIONS_PER_RUN,deriveOfficialFplSeason,diffOfficialFplHistory,materialiseOfficialFplChanges,normaliseOfficialFplHistory
} from './official-fpl-canonical.mjs';

export const OBSERVATION_CHUNK_SIZE=600;
export const HEAD_CHUNK_SIZE=2000;
export const MAX_FINAL_BATCH_STATEMENTS=40;
export const DATA_S2_COLLECTION_CRON='*/30 * * * *';
export const DATA_S2_DAILY_UTC_HOUR=1;
export const DATA_S2_DAILY_UTC_MINUTE=0;
export const DATA_S2_PRE_DEADLINE_WINDOW_MS=30*60*1000;
export const DATA_S2_OFFICIAL_FPL_REDIRECT_MODE='manual';

const BOOTSTRAP_URL='https://fantasy.premierleague.com/api/bootstrap-static/';
const FIXTURES_URL='https://fantasy.premierleague.com/api/fixtures/';
const SOURCE_KEY='official-fpl';
const SOURCE_KIND='official_fpl';
const SAFE_ENDPOINT_CLASS='official_fpl_public_core';
const iso=value=>{const ms=Date.parse(value);if(!Number.isFinite(ms))throw new Error('timestamp_invalid');return new Date(ms).toISOString();};
const chunk=(rows,size)=>{const out=[];for(let i=0;i<rows.length;i+=size)out.push(rows.slice(i,i+size));return out;};

const ENTITY_SQL=`INSERT OR IGNORE INTO canonical_entities (canonical_entity_id,entity_type,season,canonical_system,canonical_external_id,created_at)
SELECT json_extract(value,'$.canonical_entity_id'),json_extract(value,'$.entity_type'),json_extract(value,'$.season'),json_extract(value,'$.canonical_system'),json_extract(value,'$.canonical_external_id'),json_extract(value,'$.created_at') FROM json_each(?)`;
const OBSERVATION_SQL=`INSERT INTO shadow_observations (observation_id,logical_key,ingestion_run_id,source_revision_id,category,subject_type,subject_entity_id,fixture_entity_id,competition_entity_id,subject_mapping_id,fixture_mapping_id,competition_mapping_id,provenance_kind,metric,value_type,value_number,value_text,value_boolean,unit,observed_at,effective_at,fetched_at,expires_at,source_timestamp,provider_record_id,transform_version,validation_version,input_revision,admission_state,quality_state,conflict_group_id,mode,created_at)
SELECT json_extract(value,'$.observation_id'),json_extract(value,'$.logical_key'),json_extract(value,'$.ingestion_run_id'),json_extract(value,'$.source_revision_id'),json_extract(value,'$.category'),json_extract(value,'$.subject_type'),json_extract(value,'$.subject_entity_id'),json_extract(value,'$.fixture_entity_id'),json_extract(value,'$.competition_entity_id'),json_extract(value,'$.subject_mapping_id'),json_extract(value,'$.fixture_mapping_id'),json_extract(value,'$.competition_mapping_id'),json_extract(value,'$.provenance_kind'),json_extract(value,'$.metric'),json_extract(value,'$.value_type'),json_extract(value,'$.value_number'),json_extract(value,'$.value_text'),json_extract(value,'$.value_boolean'),json_extract(value,'$.unit'),json_extract(value,'$.observed_at'),json_extract(value,'$.effective_at'),json_extract(value,'$.fetched_at'),json_extract(value,'$.expires_at'),json_extract(value,'$.source_timestamp'),json_extract(value,'$.provider_record_id'),json_extract(value,'$.transform_version'),json_extract(value,'$.validation_version'),json_extract(value,'$.input_revision'),json_extract(value,'$.admission_state'),json_extract(value,'$.quality_state'),json_extract(value,'$.conflict_group_id'),json_extract(value,'$.mode'),json_extract(value,'$.created_at') FROM json_each(?)`;
const HEAD_SQL=`INSERT INTO observation_heads (logical_key,observation_id,updated_at)
SELECT json_extract(value,'$.logical_key'),json_extract(value,'$.observation_id'),json_extract(value,'$.updated_at') FROM json_each(?) WHERE 1
ON CONFLICT(logical_key) DO UPDATE SET observation_id=excluded.observation_id,updated_at=excluded.updated_at`;
const COMPLETE_RUN_SQL=`UPDATE ingestion_runs SET completed_at=?,status='completed',records_seen=?,records_accepted=?,records_quarantined=0,records_rejected=0,error_class=NULL WHERE run_id=? AND source_revision_id=?`;

export function buildOfficialFplCommitPlan({entities,previousRows,observations,completedAt,recordsSeen,runId,sourceRevisionId}){
  const previousEntities=new Set(previousRows.map(row=>row.subject_entity_id));
  const newEntities=entities.filter(row=>!previousEntities.has(row.canonical_entity_id));
  const plan=[];
  if(newEntities.length)plan.push({sql:ENTITY_SQL,args:[JSON.stringify(newEntities)]});
  for(const rows of chunk(observations,OBSERVATION_CHUNK_SIZE))plan.push({sql:OBSERVATION_SQL,args:[JSON.stringify(rows)]});
  const heads=observations.map(row=>({logical_key:row.logical_key,observation_id:row.observation_id,updated_at:completedAt}));
  for(const rows of chunk(heads,HEAD_CHUNK_SIZE))plan.push({sql:HEAD_SQL,args:[JSON.stringify(rows)]});
  plan.push({sql:COMPLETE_RUN_SQL,args:[completedAt,recordsSeen,observations.length,runId,sourceRevisionId]});
  if(plan.length>MAX_FINAL_BATCH_STATEMENTS)throw new Error('query_budget_exceeded');
  return plan;
}

async function fetchJson(fetchImpl,url){
  const response=await fetchImpl(url,{headers:{accept:'application/json'},redirect:DATA_S2_OFFICIAL_FPL_REDIRECT_MODE});
  if(Number(response?.status)>=300&&Number(response?.status)<400)throw new Error('official_fpl_redirect_rejected');
  if(!response?.ok)throw new Error('official_fpl_http_failed');
  try{return await response.json();}catch{throw new Error('official_fpl_json_invalid');}
}

async function markRunFailed(db,{runId,errorClass,completedAt,sourceRevisionId}){
  try{await db.prepare("UPDATE ingestion_runs SET completed_at=?,status='failed',error_class=? WHERE run_id=? AND source_revision_id=?").bind(completedAt,String(errorClass).slice(0,64),runId,sourceRevisionId).run();}catch{}
}

export async function collectOfficialFplHistory(env,{scheduledTime=null,fetchImpl=globalThis.fetch,now=()=>Date.now()}={}){
  const db=env?.TEAMSHEET_DATA_DB;if(!db)return {ok:false,reason:'storage_unavailable'};
  const season=String(env?.DATA_S2_SEASON||'');if(!/^\d{4}-\d{2}$/.test(season))return {ok:false,reason:'season_unavailable'};
  let revision;
  try{revision=await db.prepare('SELECT r.*,s.source_key,s.source_kind FROM data_source_revisions r JOIN data_sources s ON s.source_id=r.source_id WHERE r.source_revision_id=?').bind(DATA_S2_SOURCE_REVISION_ID).first();}catch{return {ok:false,reason:'storage_read_failed'};}
  if(!revision||revision.source_key!==SOURCE_KEY||revision.source_kind!==SOURCE_KIND||!rightsAdmission(revision).ok)return {ok:false,reason:'source_revision_unavailable'};

  const startedAt=new Date(now()).toISOString();
  const triggerMs=Number.isFinite(Number(scheduledTime))?Number(scheduledTime):Date.parse(startedAt);
  const runId=`data-s2:${season}:${new Date(triggerMs).toISOString()}`;
  try{
    const result=await db.prepare("INSERT OR IGNORE INTO ingestion_runs (run_id,source_revision_id,run_type,mode,started_at,completed_at,status,safe_endpoint_class,parser_version,transform_version,schema_version,records_seen,records_accepted,records_quarantined,records_rejected,error_class,created_at) VALUES (?,?,'official_fpl_structured_history','shadow_only',?,NULL,'started',?,?,?,?,0,0,0,0,NULL,?)")
      .bind(runId,DATA_S2_SOURCE_REVISION_ID,startedAt,SAFE_ENDPOINT_CLASS,DATA_S2_VALIDATION_VERSION,DATA_S2_TRANSFORM_VERSION,DATA_S2_SCHEMA_VERSION,startedAt).run();
    if(result?.meta?.changes!==1)return {ok:true,result:'duplicate_run',runId,changed:0};
  }catch{return {ok:false,reason:'run_start_failed'};}

  try{
    const [bootstrap,fixtures]=await Promise.all([fetchJson(fetchImpl,BOOTSTRAP_URL),fetchJson(fetchImpl,FIXTURES_URL)]);
    const fetchedAt=new Date(now()).toISOString();
    const normalised=normaliseOfficialFplHistory({bootstrap,fixtures,season,fetchedAt});
    const previousRows=((await db.prepare("SELECT o.* FROM observation_heads h JOIN shadow_observations o ON o.observation_id=h.observation_id JOIN ingestion_runs r ON r.run_id=o.ingestion_run_id AND r.source_revision_id=o.source_revision_id WHERE o.source_revision_id=? AND r.status='completed'").bind(DATA_S2_SOURCE_REVISION_ID).all()).results||[]);
    const changes=diffOfficialFplHistory(normalised.candidates,previousRows);
    if(changes.length>MAX_CHANGED_OBSERVATIONS_PER_RUN)throw new Error('write_budget_exceeded');
    if(changes.length===0){
      await db.prepare(COMPLETE_RUN_SQL).bind(fetchedAt,normalised.candidates.length,0,runId,DATA_S2_SOURCE_REVISION_ID).run();
      return {ok:true,result:'unchanged',runId,changed:0,recordsSeen:normalised.candidates.length};
    }
    const observations=await materialiseOfficialFplChanges(changes,{runId,sourceRevision:revision,fetchedAt,cryptoImpl:env.crypto||globalThis.crypto});
    const plan=buildOfficialFplCommitPlan({entities:normalised.entities,previousRows,observations,completedAt:fetchedAt,recordsSeen:normalised.candidates.length,runId,sourceRevisionId:DATA_S2_SOURCE_REVISION_ID});
    const statements=plan.map(item=>db.prepare(item.sql).bind(...item.args));
    await db.batch(statements);
    return {ok:true,result:previousRows.length?'changed':'baseline',runId,changed:observations.length,recordsSeen:normalised.candidates.length,batchStatements:plan.length};
  }catch(error){
    const completedAt=new Date(now()).toISOString();const code=['write_budget_exceeded','query_budget_exceeded'].includes(error?.message)?error.message:String(error?.message||'collection_failed').replace(/[^a-z0-9_-]/gi,'_').slice(0,64)||'collection_failed';
    await markRunFailed(db,{runId,errorClass:code,completedAt,sourceRevisionId:DATA_S2_SOURCE_REVISION_ID});
    return {ok:false,reason:code,runId};
  }
}

export function classifyOfficialFplSchedule({cron,scheduledTime,deadlineTime=null,actualTime=Date.now()}={}){
  if(cron!==DATA_S2_COLLECTION_CRON)return {collect:false,reason:'cron_unrecognised'};
  const scheduledMs=Number(scheduledTime);
  if(!Number.isFinite(scheduledMs))return {collect:false,reason:'scheduled_time_invalid'};
  const scheduled=new Date(scheduledMs);
  if(scheduled.getUTCHours()===DATA_S2_DAILY_UTC_HOUR&&scheduled.getUTCMinutes()===DATA_S2_DAILY_UTC_MINUTE)return {collect:true,reason:'daily'};
  if(deadlineTime===null||deadlineTime===undefined)return {collect:false,reason:'deadline_unavailable'};
  const deadlineMs=Date.parse(deadlineTime);
  if(!Number.isFinite(deadlineMs))return {collect:false,reason:'deadline_invalid'};
  const leadMs=deadlineMs-scheduledMs;
  const deadlineIso=new Date(deadlineMs).toISOString();
  if(!(leadMs>0&&leadMs<=DATA_S2_PRE_DEADLINE_WINDOW_MS))return {collect:false,reason:'outside_deadline_window',deadlineTime:deadlineIso};
  const actualMs=Number(actualTime);
  if(!Number.isFinite(actualMs)||actualMs>=deadlineMs)return {collect:false,reason:'deadline_elapsed',deadlineTime:deadlineIso};
  return {collect:true,reason:'pre_deadline',deadlineTime:deadlineIso,leadMs};
}

export async function readNextOfficialFplDeadline(env,{afterTime}={}){
  const db=env?.TEAMSHEET_DATA_DB;if(!db)throw new Error('schedule_storage_unavailable');
  const season=String(env?.DATA_S2_SEASON||'');if(!/^\d{4}-\d{2}$/.test(season))throw new Error('schedule_season_unavailable');
  const afterMs=Number(afterTime);if(!Number.isFinite(afterMs))throw new Error('schedule_time_invalid');
  const prefix=`${SOURCE_KEY}|${season}|event|`;
  const row=await db.prepare("SELECT o.value_text AS deadline_time FROM observation_heads h JOIN shadow_observations o ON o.observation_id=h.observation_id JOIN ingestion_runs r ON r.run_id=o.ingestion_run_id AND r.source_revision_id=o.source_revision_id WHERE h.logical_key>=? AND h.logical_key<? AND o.source_revision_id=? AND o.category='official_fpl_event' AND o.metric='deadline_time' AND o.value_type='text' AND o.value_text<>? AND o.value_text>? AND r.status='completed' ORDER BY o.value_text ASC LIMIT 1")
    .bind(prefix,`${prefix}\uffff`,DATA_S2_SOURCE_REVISION_ID,DATA_S2_NULL,new Date(afterMs).toISOString()).first();
  if(!row)return null;
  return iso(row.deadline_time);
}

function scheduleSkip(reason,scheduledTime){
  const value=Number(scheduledTime);
  return {ok:true,result:'schedule_skip',reason,scheduledTime:Number.isFinite(value)?value:null,changed:0};
}

async function runScheduledCollection(collectImpl,env,scheduledTime){
  const result=await collectImpl(env,{scheduledTime});
  if(!result?.ok)throw new Error(`data_s2_${result?.reason||'collection_failed'}`);
  return result;
}

export async function scheduledOfficialFplHistory(controller,env,{collectImpl=collectOfficialFplHistory,readDeadlineImpl=readNextOfficialFplDeadline,now=()=>Date.now()}={}){
  const cron=String(controller?.cron||'');
  const scheduledTime=controller?.scheduledTime;
  const initial=classifyOfficialFplSchedule({cron,scheduledTime,actualTime:now()});
  if(initial.reason==='cron_unrecognised'||initial.reason==='scheduled_time_invalid')return scheduleSkip(initial.reason,scheduledTime);
  if(initial.collect)return runScheduledCollection(collectImpl,env,scheduledTime);
  let deadlineTime;
  try{deadlineTime=await readDeadlineImpl(env,{afterTime:scheduledTime});}
  catch{throw new Error('data_s2_schedule_read_failed');}
  const decision=classifyOfficialFplSchedule({cron,scheduledTime,deadlineTime,actualTime:now()});
  if(!decision.collect)return scheduleSkip(decision.reason,scheduledTime);
  return runScheduledCollection(collectImpl,env,scheduledTime);
}
