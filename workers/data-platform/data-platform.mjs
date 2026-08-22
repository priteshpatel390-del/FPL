import {MAX_REQUEST_BYTES,PLATFORM_VERSION,boundedLimit,validateObservation} from './data-platform-core.mjs';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
async function body(request){const length=Number(request.headers.get('content-length')||0);if(length>MAX_REQUEST_BYTES)throw new Error('request_too_large');const text=await request.text();if(new TextEncoder().encode(text).length>MAX_REQUEST_BYTES)throw new Error('request_too_large');return JSON.parse(text);}
async function fetchHandler(request,env){
  const url=new URL(request.url);if(request.method==='GET'&&url.pathname==='/v1/health')return json({ok:true,platformVersion:PLATFORM_VERSION,mode:'shadow_only'});
  if(!env.TEAMSHEET_DATA_DB)return json({error:'storage_unavailable'},503);
  if(request.method==='GET'&&url.pathname==='/v1/shadow/observations'){
    const asOf=url.searchParams.get('as_of');if(!asOf||!Number.isFinite(Date.parse(asOf)))return json({error:'as_of_invalid'},400);
    try{const result=await env.TEAMSHEET_DATA_DB.prepare('SELECT * FROM shadow_observations WHERE fetched_at <= ? ORDER BY fetched_at, observation_id LIMIT ?').bind(new Date(asOf).toISOString(),boundedLimit(url.searchParams.get('limit'))).all();return json({observations:result.results||[]});}catch{return json({error:'storage_read_failed'},503);}
  }
  if(request.method==='POST'&&url.pathname==='/v1/shadow/observations'){
    let input;try{input=await body(request);}catch(error){return json({error:error.message==='request_too_large'?'request_too_large':'invalid_json'},error.message==='request_too_large'?413:400);}
    let revision;try{revision=await env.TEAMSHEET_DATA_DB.prepare('SELECT * FROM data_source_revisions WHERE source_revision_id=?').bind(input?.source_revision_id).first();}catch{return json({error:'storage_read_failed'},503);}
    const verdict=validateObservation(input,revision);if(!verdict.ok)return json({error:verdict.reason},422);
    try{await env.TEAMSHEET_DATA_DB.prepare(`INSERT OR IGNORE INTO shadow_observations (observation_id,logical_key,ingestion_run_id,source_revision_id,category,subject_type,subject_entity_id,fixture_entity_id,competition_entity_id,metric,value_type,value_number,value_text,value_boolean,unit,observed_at,effective_at,fetched_at,expires_at,source_timestamp,provider_record_id,transform_version,validation_version,input_revision,admission_state,quality_state,conflict_group_id,mode,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(input.observation_id,input.logical_key,input.ingestion_run_id,input.source_revision_id,input.category,input.subject_type,input.subject_entity_id,input.fixture_entity_id??null,input.competition_entity_id??null,input.metric,input.value_type,input.value_number??null,input.value_text??null,input.value_boolean??null,input.unit??null,input.observed_at,input.effective_at,input.fetched_at,input.expires_at??null,input.source_timestamp??null,input.provider_record_id??null,input.transform_version,input.validation_version,input.input_revision,input.admission_state||'accepted',input.quality_state||'fresh',input.conflict_group_id??null,'shadow_only',input.created_at||new Date().toISOString()).run();return json({accepted:true,mode:'shadow_only'},201);}catch{return json({error:'storage_write_failed'},503);}
  }
  return json({error:'not_found'},404);
}
export default {fetch:fetchHandler};export {fetchHandler};
