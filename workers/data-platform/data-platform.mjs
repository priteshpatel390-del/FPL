import {MAX_REQUEST_BYTES,OFFICIAL_FPL_SOURCE_KEY,PLATFORM_VERSION,boundedLimit,canonicalTimestamp,decodeCursor,encodeCursor,observationIdentity,validateMapping,validateObservation} from './data-platform-core.mjs';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
const authError=(body,status,challenge=false)=>{const response=json(body,status);if(challenge)response.headers.set('www-authenticate','Bearer');return response;};
async function authenticate(request,env){
  const secret=env?.DATA_S1_HTTP_AUTH_TOKEN;
  if(typeof secret!=='string'||!secret||/\s/.test(secret))return authError({error:'service_unavailable'},503);
  const cryptoImpl=env?.crypto||globalThis.crypto;
  if(typeof cryptoImpl?.subtle?.digest!=='function'||typeof cryptoImpl?.subtle?.timingSafeEqual!=='function')return authError({error:'service_unavailable'},503);
  const match=/^Bearer ([^\s]+)$/.exec(request.headers.get('authorization')||'');
  if(!match)return authError({error:'unauthorized'},401,true);
  try{
    const encode=value=>new TextEncoder().encode(value);
    const [presented,expected]=await Promise.all([cryptoImpl.subtle.digest('SHA-256',encode(match[1])),cryptoImpl.subtle.digest('SHA-256',encode(secret))]);
    return cryptoImpl.subtle.timingSafeEqual(presented,expected)?null:authError({error:'unauthorized'},401,true);
  }catch{return authError({error:'service_unavailable'},503);}
}
async function body(request){const length=Number(request.headers.get('content-length')||0);if(length>MAX_REQUEST_BYTES)throw new Error('request_too_large');const text=await request.text();if(new TextEncoder().encode(text).length>MAX_REQUEST_BYTES)throw new Error('request_too_large');return JSON.parse(text);}
async function safeRejection(db,input,reason,cryptoImpl){
  if(!input?.ingestion_run_id||!input?.source_revision_id)return;
  try{const now=new Date().toISOString();const id=await observationIdentity({logical_key:'rejection',ingestion_run_id:input.ingestion_run_id,source_revision_id:input.source_revision_id,input_revision:String(input.input_revision||''),fetched_at:now,mode:'shadow_only'},cryptoImpl);const contaminated=reason==='secret_detected'||reason==='keyed_url_detected';await db.prepare('INSERT INTO observation_rejections (rejection_id,run_id,source_revision_id,reason_code,category,subject_type,safe_fingerprint,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(id,input.ingestion_run_id,input.source_revision_id,reason,contaminated?null:String(input.category||'').slice(0,64)||null,contaminated?null:String(input.subject_type||'').slice(0,32)||null,id.slice(0,16),now).run();}catch{}
}
async function mappingFor(db,id){return id?db.prepare('SELECT * FROM entity_mappings WHERE mapping_id=?').bind(id).first():null;}
async function entityFor(db,id){return id?db.prepare('SELECT * FROM canonical_entities WHERE canonical_entity_id=?').bind(id).first():null;}
async function provenanceError(db,row,revision){
  const roles=[['subject_entity_id','subject_mapping_id',row.subject_type],['fixture_entity_id','fixture_mapping_id','fixture'],['competition_entity_id','competition_mapping_id','competition']];
  for(const [entityKey,,expectedType] of roles){if(!row[entityKey])continue;const entity=await entityFor(db,row[entityKey]);if(!entity||entity.entity_type!==expectedType)return 'entity_type_mismatch';}
  if(row.provenance_kind==='canonical_native_fpl'){for(const [entityKey] of roles){if(!row[entityKey])continue;const entity=await entityFor(db,row[entityKey]);if(entity.canonical_system!=='fpl')return 'mapping_unresolved';}return revision.source_key===OFFICIAL_FPL_SOURCE_KEY&&revision.source_kind==='official_fpl'?null:'mapping_unresolved';}
  if(row.provenance_kind!=='mapped_provider')return 'mapping_unresolved';
  for(const [entityKey,mappingKey,expectedType] of roles){
    if(!row[entityKey])continue;const mapping=await mappingFor(db,row[mappingKey]);const verdict=validateMapping(mapping,{sourceRevisionId:row.source_revision_id,canonicalEntityId:row[entityKey],providerEntityType:expectedType});if(!verdict.ok)return verdict.reason;
  }return null;
}
async function reconcileInsertFailure(db,row,identity){
  try{const existing=await db.prepare('SELECT observation_id FROM shadow_observations WHERE source_revision_id=? AND logical_key=? AND input_revision=?').bind(row.source_revision_id,row.logical_key,row.input_revision).first();if(existing?.observation_id===identity)return json({accepted:true,result:'existing',observation_id:identity},200);if(existing)return json({error:'idempotency_conflict'},409);}catch{}return json({error:'storage_write_failed'},503);
}
function insertStatement(){return `INSERT INTO shadow_observations (observation_id,logical_key,ingestion_run_id,source_revision_id,category,subject_type,subject_entity_id,fixture_entity_id,competition_entity_id,subject_mapping_id,fixture_mapping_id,competition_mapping_id,provenance_kind,metric,value_type,value_number,value_text,value_boolean,unit,observed_at,effective_at,fetched_at,expires_at,source_timestamp,provider_record_id,transform_version,validation_version,input_revision,admission_state,quality_state,conflict_group_id,mode,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;}
export function healthOperation(){return {status:200,body:{ok:true,platformVersion:PLATFORM_VERSION,mode:'shadow_only'}};}
export async function queryObservationsOperation(env,{as_of,cursor:cursorRaw=null,limit:rawLimit=null}={}){
  if(!env?.TEAMSHEET_DATA_DB)return {status:503,body:{error:'storage_unavailable'}};let asOf;try{asOf=canonicalTimestamp(as_of,{required:true});}catch{return {status:400,body:{error:'as_of_invalid'}};}const cursor=cursorRaw?decodeCursor(cursorRaw):null;if(cursorRaw&&(!cursor||cursor.asOf!==asOf))return {status:400,body:{error:'cursor_invalid'}};const limit=boundedLimit(rawLimit);const db=env.TEAMSHEET_DATA_DB;
  try{const sql=`SELECT * FROM shadow_observations WHERE admission_state='accepted' AND fetched_at <= ? ${cursor?'AND (fetched_at > ? OR (fetched_at = ? AND observation_id > ?))':''} ORDER BY fetched_at,observation_id LIMIT ?`;const args=cursor?[asOf,cursor.fetchedAt,cursor.fetchedAt,cursor.observationId,limit+1]:[asOf,limit+1];const rows=(await db.prepare(sql).bind(...args).all()).results||[];const more=rows.length>limit;const observations=rows.slice(0,limit);const last=observations.at(-1);return {status:200,body:{as_of:asOf,observations,next_cursor:more?encodeCursor({asOf,fetchedAt:last.fetched_at,observationId:last.observation_id}):null}};}catch{return {status:503,body:{error:'storage_read_failed'}};}
}
export async function ingestObservationOperation(env,input){
  if(!env?.TEAMSHEET_DATA_DB)return {status:503,body:{error:'storage_unavailable'}};const db=env.TEAMSHEET_DATA_DB;let revision,run;try{revision=await db.prepare('SELECT r.*,s.source_key,s.source_kind FROM data_source_revisions r JOIN data_sources s ON s.source_id=r.source_id WHERE r.source_revision_id=?').bind(input?.source_revision_id).first();run=await db.prepare('SELECT * FROM ingestion_runs WHERE run_id=? AND source_revision_id=?').bind(input?.ingestion_run_id,input?.source_revision_id).first();}catch{return {status:503,body:{error:'storage_read_failed'}};}
  const verdict=validateObservation(input,revision);if(!verdict.ok){await safeRejection(db,input,verdict.reason,env.crypto||globalThis.crypto);return {status:422,body:{error:verdict.reason}};}const row=verdict.observation;if(!run){await safeRejection(db,row,'schema_invalid',env.crypto||globalThis.crypto);return {status:422,body:{error:'run_source_mismatch'}};}let provenance;try{provenance=await provenanceError(db,row,revision);}catch{return {status:503,body:{error:'storage_read_failed'}};}if(provenance){await safeRejection(db,row,provenance,env.crypto||globalThis.crypto);return {status:422,body:{error:provenance}};}
  row.admission_state=row.admission_state||'accepted';row.quality_state=row.quality_state||'fresh';const identity=await observationIdentity(row,env.crypto||globalThis.crypto);if(input.observation_id&&input.observation_id!==identity)return {status:422,body:{error:'observation_identity_mismatch'}};row.observation_id=identity;
  try{const existing=await db.prepare('SELECT observation_id FROM shadow_observations WHERE source_revision_id=? AND logical_key=? AND input_revision=?').bind(row.source_revision_id,row.logical_key,row.input_revision).first();if(existing)return existing.observation_id===identity?{status:200,body:{accepted:true,result:'existing',observation_id:identity}}:{status:409,body:{error:'idempotency_conflict'}};
    const fields=[row.observation_id,row.logical_key,row.ingestion_run_id,row.source_revision_id,row.category,row.subject_type,row.subject_entity_id,row.fixture_entity_id??null,row.competition_entity_id??null,row.subject_mapping_id??null,row.fixture_mapping_id??null,row.competition_mapping_id??null,row.provenance_kind,row.metric,row.value_type,row.value_number??null,row.value_text??null,row.value_boolean===undefined?null:Number(row.value_boolean),row.unit??null,row.observed_at,row.effective_at,row.fetched_at,row.expires_at,row.source_timestamp,row.provider_record_id??null,row.transform_version,row.validation_version,row.input_revision,row.admission_state,row.quality_state,row.conflict_group_id??null,'shadow_only',new Date().toISOString()];let result;try{result=await db.prepare(insertStatement()).bind(...fields).run();}catch{const response=await reconcileInsertFailure(db,row,identity);return {status:response.status,body:await response.json()};}if(result?.meta?.changes!==1)return {status:503,body:{error:'storage_write_unconfirmed'}};const stored=await db.prepare('SELECT observation_id FROM shadow_observations WHERE observation_id=?').bind(identity).first();if(stored?.observation_id!==identity)return {status:503,body:{error:'storage_write_unconfirmed'}};return {status:201,body:{accepted:true,result:'inserted',observation_id:identity}};}catch{return {status:503,body:{error:'storage_write_failed'}};}
}
const operationResponse=result=>json(result.body,result.status);
async function fetchHandler(request,env){
  const authenticationFailure=await authenticate(request,env);if(authenticationFailure)return authenticationFailure;
  const url=new URL(request.url);if(request.method==='GET'&&url.pathname==='/v1/health')return operationResponse(healthOperation());
  if(request.method==='GET'&&url.pathname==='/v1/shadow/observations'){
    return operationResponse(await queryObservationsOperation(env,{as_of:url.searchParams.get('as_of'),cursor:url.searchParams.get('cursor'),limit:url.searchParams.get('limit')}));
  }
  if(request.method==='POST'&&url.pathname==='/v1/shadow/observations'){
    let input;try{input=await body(request);}catch(error){return json({error:error.message==='request_too_large'?'request_too_large':'invalid_json'},error.message==='request_too_large'?413:400);}return operationResponse(await ingestObservationOperation(env,input));
  }return json({error:'not_found'},404);
}
export default {fetch:fetchHandler};export {fetchHandler};
