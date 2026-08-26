import {observationIdentity,rightsAdmission,validateObservation} from './data-platform-core.mjs';

export const DATA_S2_SOURCE_REVISION_ID='official-fpl-r1';
export const DATA_S2_SCHEMA_VERSION='data-s2a-v1';
export const DATA_S2_TRANSFORM_VERSION='data-s2a-official-fpl-history-v1';
export const DATA_S2_VALIDATION_VERSION='data-s2a-official-fpl-validation-v2';
export const DATA_S2_NULL='__teamsheet_explicit_null__';
export const MAX_CHANGED_OBSERVATIONS_PER_RUN=15000;
export const OBSERVATION_CHUNK_SIZE=600;
export const HEAD_CHUNK_SIZE=2000;
export const MAX_FINAL_BATCH_STATEMENTS=40;

const BOOTSTRAP_URL='https://fantasy.premierleague.com/api/bootstrap-static/';
const FIXTURES_URL='https://fantasy.premierleague.com/api/fixtures/';
const SOURCE_KEY='official-fpl';
const SOURCE_KIND='official_fpl';
const RUN_TYPE='official_fpl_structured_history';
const SAFE_ENDPOINT_CLASS='official_fpl_public_core';

const has=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const isObject=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const positiveId=value=>Number.isInteger(Number(value))&&Number(value)>0;
const iso=value=>{const ms=Date.parse(value);if(!Number.isFinite(ms))throw new Error('timestamp_invalid');return new Date(ms).toISOString();};
const canonicalEntityId=(season,type,id)=>`${season}:fpl:${type}:${Number(id)}`;
const logicalKey=(season,type,id,metric)=>`${SOURCE_KEY}|${season}|${type}|${Number(id)}|${metric}`;
const chunk=(rows,size)=>{const out=[];for(let i=0;i<rows.length;i+=size)out.push(rows.slice(i,i+size));return out;};
const asNullableText=value=>value===null?DATA_S2_NULL:String(value);
const asNullableNumber=value=>value===null?DATA_S2_NULL:Number(value);

function scalar(type,value){
  if(type==='boolean')return {value_type:'boolean',value_boolean:Boolean(value),value_number:null,value_text:null};
  if(type==='number'){
    if(!finite(value))throw new Error('value_invalid');
    return {value_type:'number',value_number:value,value_text:null,value_boolean:null};
  }
  if(type==='text')return {value_type:'text',value_text:String(value),value_number:null,value_boolean:null};
  throw new Error('value_invalid');
}

function candidate({season,type,id,category,metric,typeName,value,unit=null}){
  return {
    logical_key:logicalKey(season,type,id,metric),category,subject_type:type,
    subject_entity_id:canonicalEntityId(season,type,id),fixture_entity_id:null,competition_entity_id:null,
    subject_mapping_id:null,fixture_mapping_id:null,competition_mapping_id:null,
    provenance_kind:'canonical_native_fpl',metric,...scalar(typeName,value),unit,
    provider_record_id:String(Number(id))
  };
}

function required(row,keys,kind){
  if(!isObject(row))throw new Error(`${kind}_row_invalid`);
  for(const key of keys)if(!has(row,key))throw new Error(`${kind}_${key}_missing`);
  if(!positiveId(row.id))throw new Error(`${kind}_id_invalid`);
}

function uniqueRows(rows,kind){
  const seen=new Set();
  for(const row of rows){required(row,['id'],kind);const id=Number(row.id);if(seen.has(id))throw new Error(`${kind}_duplicate_id`);seen.add(id);}
  return seen;
}

function assertString(value,code){if(typeof value!=='string')throw new Error(code);return value;}
function assertNumber(value,code){const n=Number(value);if(!Number.isFinite(n))throw new Error(code);return n;}
function nullableNumber(value,code){if(value===null)return DATA_S2_NULL;return assertNumber(value,code);}
function nullableTimestamp(value,code){if(value===null)return DATA_S2_NULL;try{return iso(assertString(value,code));}catch{throw new Error(code);}}

export function deriveOfficialFplSeason(bootstrap){
  if(!isObject(bootstrap)||!Array.isArray(bootstrap.events))throw new Error('season_evidence_unavailable');
  const firstEvent=bootstrap.events.find(row=>isObject(row)&&Number(row.id)===1);
  if(!firstEvent||typeof firstEvent.deadline_time!=='string')throw new Error('season_evidence_unavailable');
  let deadline;
  try{deadline=iso(firstEvent.deadline_time);}catch{throw new Error('season_evidence_invalid');}
  const startYear=Number(deadline.slice(0,4));
  return `${startYear}-${String((startYear+1)%100).padStart(2,'0')}`;
}

function entity(season,type,id,createdAt){return {canonical_entity_id:canonicalEntityId(season,type,id),entity_type:type,season,canonical_system:'fpl',canonical_external_id:String(Number(id)),created_at:createdAt};}

export function normaliseOfficialFplHistory({bootstrap,fixtures,season,fetchedAt}){
  if(!/^\d{4}-\d{2}$/.test(String(season||'')))throw new Error('season_invalid');
  const fetched=iso(fetchedAt);
  if(!isObject(bootstrap))throw new Error('bootstrap_invalid');
  for(const key of ['events','teams','elements','element_types'])if(!Array.isArray(bootstrap[key]))throw new Error(`bootstrap_${key}_invalid`);
  if(!Array.isArray(fixtures))throw new Error('fixtures_invalid');
  if(bootstrap.events.length<30)throw new Error('event_population_implausible');
  if(bootstrap.teams.length!==20)throw new Error('team_population_implausible');
  if(bootstrap.elements.length<400)throw new Error('player_population_implausible');
  if(fixtures.length<300)throw new Error('fixture_population_implausible');
  if(deriveOfficialFplSeason(bootstrap)!==season)throw new Error('season_mismatch');

  const eventIds=uniqueRows(bootstrap.events,'event');
  const teamIds=uniqueRows(bootstrap.teams,'team');
  const playerIds=uniqueRows(bootstrap.elements,'player');
  const fixtureIds=uniqueRows(fixtures,'fixture');
  const typeIds=uniqueRows(bootstrap.element_types,'element_type');
  const candidates=[];const entities=[];
  const add=(type,row,category,metric,typeName,value,unit=null)=>candidates.push(candidate({season,type,id:row.id,category,metric,typeName,value,unit}));

  for(const row of bootstrap.events){
    required(row,['id','name','deadline_time'],'event');
    assertString(row.name,'event_name_invalid');
    const deadline=iso(assertString(row.deadline_time,'event_deadline_invalid'));
    entities.push(entity(season,'event',row.id,fetched));
    add('event',row,'official_fpl_event','present','boolean',true);
    add('event',row,'official_fpl_event','name','text',row.name);
    add('event',row,'official_fpl_event','deadline_time','text',deadline);
  }

  const teamFields=['strength','strength_overall_home','strength_overall_away','strength_attack_home','strength_attack_away','strength_defence_home','strength_defence_away'];
  for(const row of bootstrap.teams){
    required(row,['id','name','short_name',...teamFields],'team');
    assertString(row.name,'team_name_invalid');assertString(row.short_name,'team_short_name_invalid');
    entities.push(entity(season,'team',row.id,fetched));
    add('team',row,'official_fpl_team','present','boolean',true);
    add('team',row,'official_fpl_team','name','text',row.name);
    add('team',row,'official_fpl_team','short_name','text',row.short_name);
    for(const field of teamFields)add('team',row,'official_fpl_team',field,'number',assertNumber(row[field],`team_${field}_invalid`));
  }

  const playerRequired=['id','team','element_type','web_name','now_cost','status','chance_of_playing_next_round','chance_of_playing_this_round','news','news_added','selected_by_percent'];
  for(const row of bootstrap.elements){
    required(row,playerRequired,'player');
    if(!teamIds.has(Number(row.team)))throw new Error('player_team_invalid');
    if(!typeIds.has(Number(row.element_type)))throw new Error('player_element_type_invalid');
    assertString(row.web_name,'player_web_name_invalid');assertString(row.status,'player_status_invalid');assertString(row.news,'player_news_invalid');
    entities.push(entity(season,'player',row.id,fetched));
    add('player',row,'official_fpl_player','present','boolean',true);
    add('player',row,'official_fpl_player','team','number',assertNumber(row.team,'player_team_invalid'));
    add('player',row,'official_fpl_player','element_type','number',assertNumber(row.element_type,'player_element_type_invalid'));
    add('player',row,'official_fpl_player','web_name','text',row.web_name);
    add('player',row,'official_fpl_player','now_cost','number',assertNumber(row.now_cost,'player_now_cost_invalid'),'tenths_gbp');
    add('player',row,'official_fpl_player','status','text',row.status);
    const next=nullableNumber(row.chance_of_playing_next_round,'player_chance_next_invalid');
    add('player',row,'official_fpl_player','chance_of_playing_next_round',next===DATA_S2_NULL?'text':'number',next,'percent');
    const current=nullableNumber(row.chance_of_playing_this_round,'player_chance_current_invalid');
    add('player',row,'official_fpl_player','chance_of_playing_this_round',current===DATA_S2_NULL?'text':'number',current,'percent');
    add('player',row,'official_fpl_player','news','text',row.news);
    const newsAdded=nullableTimestamp(row.news_added,'player_news_added_invalid');
    add('player',row,'official_fpl_player','news_added','text',newsAdded);
    add('player',row,'official_fpl_player','selected_by_percent','number',assertNumber(row.selected_by_percent,'player_selected_by_percent_invalid'),'percent');
  }

  const fixtureRequired=['id','event','kickoff_time','team_h','team_a','team_h_difficulty','team_a_difficulty'];
  for(const row of fixtures){
    required(row,fixtureRequired,'fixture');
    if(!teamIds.has(Number(row.team_h))||!teamIds.has(Number(row.team_a))||Number(row.team_h)===Number(row.team_a))throw new Error('fixture_team_invalid');
    if(row.event!==null&&!eventIds.has(Number(row.event)))throw new Error('fixture_event_invalid');
    entities.push(entity(season,'fixture',row.id,fetched));
    add('fixture',row,'official_fpl_fixture','present','boolean',true);
    const eventValue=nullableNumber(row.event,'fixture_event_invalid');
    add('fixture',row,'official_fpl_fixture','event',eventValue===DATA_S2_NULL?'text':'number',eventValue);
    const kickoff=nullableTimestamp(row.kickoff_time,'fixture_kickoff_invalid');
    add('fixture',row,'official_fpl_fixture','kickoff_time','text',kickoff);
    add('fixture',row,'official_fpl_fixture','team_h','number',assertNumber(row.team_h,'fixture_team_h_invalid'));
    add('fixture',row,'official_fpl_fixture','team_a','number',assertNumber(row.team_a,'fixture_team_a_invalid'));
    const homeDifficulty=nullableNumber(row.team_h_difficulty,'fixture_team_h_difficulty_invalid');
    add('fixture',row,'official_fpl_fixture','team_h_difficulty',homeDifficulty===DATA_S2_NULL?'text':'number',homeDifficulty);
    const awayDifficulty=nullableNumber(row.team_a_difficulty,'fixture_team_a_difficulty_invalid');
    add('fixture',row,'official_fpl_fixture','team_a_difficulty',awayDifficulty===DATA_S2_NULL?'text':'number',awayDifficulty);
  }

  const keys=new Set();for(const row of candidates){if(keys.has(row.logical_key))throw new Error('logical_key_duplicate');keys.add(row.logical_key);}
  return {season,fetchedAt:fetched,candidates,entities,counts:{events:eventIds.size,teams:teamIds.size,players:playerIds.size,fixtures:fixtureIds.size}};
}

function sameScalar(a,b){
  if(!a||a.value_type!==b.value_type)return false;
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
  const response=await fetchImpl(url,{headers:{accept:'application/json'},redirect:'error'});
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

export async function scheduledOfficialFplHistory(controller,env){
  const result=await collectOfficialFplHistory(env,{scheduledTime:controller?.scheduledTime});
  if(!result.ok)throw new Error(`data_s2_${result.reason}`);
  return result;
}
