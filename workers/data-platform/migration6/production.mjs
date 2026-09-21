import {createHash} from 'node:crypto';
import {EXPECTED_D1_DATABASE_ID} from '../phase4b/live-contract.mjs';
import {
  MIGRATION_0006_EXACT_POST_EMPTY,MIGRATION_0006_EXACT_PRE,MIGRATION_0006_GIT_BLOB_SHA,
  MIGRATION_0006_PATH,MIGRATION_0006_POST_WITH_MAPPING,classifyMigration0006State,readPinnedMigration0006
} from './migration-0006-contract.mjs';
import {prepareQualifiedTeamMappingPersistence,persistQualifiedTeamMappingPlan,readQualifiedTeamMappings} from '../../api-football-collector/mapping-persistence.mjs';
import {fetchOfficialFplAuthority,OFFICIAL_FPL_BOOTSTRAP_URL,OFFICIAL_FPL_FIXTURES_URL} from '../../../src/decision-intelligence/api-football-prelive-qualification.mjs';

const API_BASE='https://api.cloudflare.com/client/v4';
const TIMEOUT_MS=120000;
const sha256=value=>createHash('sha256').update(String(value)).digest('hex');
const fixedError=code=>{const error=new Error(code);error.sanitized=true;return error;};
const queryUrl=(accountId,databaseId)=>`${API_BASE}/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`;
const safeInteger=(value,{min=0,max=1000000}={})=>Number.isSafeInteger(value)&&value>=min&&value<=max?value:null;
const safeProviderCode=value=>safeInteger(value,{max:999999});
const mutationDiagnostic=(category,{statementCount,requestBytes,responseReceived=false,httpStatus=null,resultCount=null,failedStatementIndex=null,providerErrorCode=null}={})=>Object.freeze({
  category,statementCount:safeInteger(statementCount,{min:1,max:1000}),requestBytes:safeInteger(requestBytes,{max:16*1024*1024}),responseReceived,
  httpStatus:safeInteger(httpStatus,{min:100,max:599}),resultCount:safeInteger(resultCount,{max:1000}),
  failedStatementIndex:safeInteger(failedStatementIndex,{max:999}),providerErrorCode:safeProviderCode(providerErrorCode)
});
const firstProviderCode=payload=>safeProviderCode(payload?.errors?.find(row=>safeProviderCode(row?.code)!==null)?.code);

function validateIdentity({accountId,accountFingerprint,databaseId,token}){
  if(typeof accountId!=='string'||!accountId||typeof token!=='string'||!token||
    !/^[0-9a-f]{64}$/.test(accountFingerprint)||sha256(accountId)!==accountFingerprint||databaseId!==EXPECTED_D1_DATABASE_ID)
    throw fixedError('migration_0006_identity_invalid');
}

async function sendBatch({transport,url,token,statements,mutation,onMutationDiagnostic=()=>{}}){
  const body=JSON.stringify({batch:statements.map(statement=>({sql:statement.sql,params:statement.params}))});
  const base={statementCount:statements.length,requestBytes:Buffer.byteLength(body,'utf8')};
  const report=(category,fields={})=>{if(mutation)onMutationDiagnostic(mutationDiagnostic(category,{...base,...fields}));};
  let response;
  try{response=await transport(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json'},body,redirect:'error',signal:AbortSignal.timeout(TIMEOUT_MS)});}
  catch{report('transport_uncertain');const error=fixedError(mutation?'migration_0006_mutation_outcome_unknown':'migration_0006_read_failed');error.outcomeUnknown=mutation;throw error;}
  const status=safeInteger(response?.status,{min:100,max:599});
  let payload;try{payload=await response.json();}catch{report('response_json_invalid',{responseReceived:true,httpStatus:status});throw fixedError(mutation?'migration_0006_mutation_outcome_unknown':'migration_0006_read_failed');}
  if(response?.status===401||response?.status===403){report('http_rejected',{responseReceived:true,httpStatus:status,providerErrorCode:firstProviderCode(payload)});throw fixedError('migration_0006_auth_failed');}
  if(!response?.ok){
    const explicit=response?.status===400&&payload?.success===false&&Array.isArray(payload?.errors)&&payload.errors.length>0;
    report(explicit?'d1_rejected':'http_uncertain',{responseReceived:true,httpStatus:status,providerErrorCode:firstProviderCode(payload)});
    throw fixedError(mutation?'migration_0006_mutation_outcome_unknown':'migration_0006_read_failed');
  }
  if(payload?.success!==true||!Array.isArray(payload.result)){
    report('response_envelope_invalid',{responseReceived:true,httpStatus:status,providerErrorCode:firstProviderCode(payload)});
    throw fixedError(mutation?'migration_0006_mutation_outcome_unknown':'migration_0006_read_failed');
  }
  if(payload.result.length!==statements.length){
    report('result_cardinality_invalid',{responseReceived:true,httpStatus:status,resultCount:payload.result.length});
    throw fixedError(mutation?'migration_0006_mutation_outcome_unknown':'migration_0006_read_failed');
  }
  const failedIndex=payload.result.findIndex(row=>row?.success===false);
  if(failedIndex!==-1){
    const failed=payload.result[failedIndex];
    report('statement_failed',{responseReceived:true,httpStatus:status,resultCount:payload.result.length,failedStatementIndex:failedIndex,providerErrorCode:safeProviderCode(failed?.error?.code??failed?.code)});
    throw fixedError(mutation?'migration_0006_mutation_rejected':'migration_0006_read_failed');
  }
  if(payload.result.some(row=>row?.success!==true)){
    report('result_entry_invalid',{responseReceived:true,httpStatus:status,resultCount:payload.result.length});
    throw fixedError(mutation?'migration_0006_mutation_outcome_unknown':'migration_0006_read_failed');
  }
  report('batch_success',{responseReceived:true,httpStatus:status,resultCount:payload.result.length});
  return payload.result.map(row=>row.results??[]);
}

export function createParameterizedD1Adapter({accountId,accountFingerprint,databaseId=EXPECTED_D1_DATABASE_ID,token,transport=globalThis.fetch,onMutationSubmitted=()=>{},onMutationDiagnostic=()=>{}}){
  validateIdentity({accountId,accountFingerprint,databaseId,token});
  if(typeof transport!=='function'||typeof onMutationSubmitted!=='function'||typeof onMutationDiagnostic!=='function')throw fixedError('migration_0006_transport_invalid');
  const url=queryUrl(accountId,databaseId);
  const prepared=(sql,params=[])=>Object.freeze({
    sql,params:Object.freeze([...params]),
    bind(...values){return prepared(sql,values);},
    async first(){return (await sendBatch({transport,url,token,statements:[{sql,params}],mutation:false}))[0][0]??null;},
    async all(){return Object.freeze({results:(await sendBatch({transport,url,token,statements:[{sql,params}],mutation:false}))[0]});}
  });
  return Object.freeze({
    prepare:sql=>prepared(sql),
    async batch(statements){
      if(!Array.isArray(statements)||statements.length<1||statements.some(row=>typeof row?.sql!=='string'||!Array.isArray(row?.params)))
        throw fixedError('migration_0006_parameterized_batch_invalid');
      onMutationSubmitted();
      return sendBatch({transport,url,token,statements,mutation:true,onMutationDiagnostic});
    },
    async checkpoint(){
      let response;
      try{response=await transport(url.replace(/\/query$/,'/time_travel/bookmark'),{method:'GET',headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(TIMEOUT_MS)});}catch{throw fixedError('migration_0006_checkpoint_failed');}
      let body;try{body=response?.ok?await response.json():null;}catch{throw fixedError('migration_0006_checkpoint_failed');}
      if(body?.success!==true||typeof body?.result?.bookmark!=='string'||!body.result.bookmark)throw fixedError('migration_0006_checkpoint_failed');
      return body.result.bookmark;
    }
  });
}

const READ_STATE=Object.freeze([
  {key:'ledger',sql:'SELECT version,name,applied_at FROM schema_migrations ORDER BY version'},
  {key:'objects',sql:"SELECT type,name,tbl_name FROM sqlite_master WHERE name LIKE 'api_football_%' ORDER BY type,name"},
  {key:'foreignKeys',sql:'PRAGMA foreign_key_check'},
  {key:'mappingCounts',sql:"SELECT (SELECT COUNT(*) FROM entity_mappings WHERE source_revision_id='api-football:eia-2i5a:1' AND provider_entity_type='team') AS entity_mappings,(SELECT COUNT(*) FROM api_football_team_mapping_qualifications) AS qualifications,(SELECT COUNT(*) FROM api_football_team_mapping_members) AS members,(SELECT COUNT(*) FROM api_football_team_mapping_heads) AS heads"}
]);

async function readState(db,{beforeSchema=false}={}){
  const statements=beforeSchema?READ_STATE.slice(0,3):READ_STATE;
  const rows=await Promise.all(statements.map(async row=>[row.key,(await db.prepare(row.sql).all()).results]));
  const result=Object.fromEntries(rows);
  const mappingCounts=beforeSchema?{entity_mappings:0,qualifications:0,members:0,heads:0}:result.mappingCounts?.[0];
  return Object.freeze({
    classification:classifyMigration0006State({ledger:result.ledger,objects:result.objects,mappingCounts}),
    ledger:result.ledger.map(row=>`${row.version}:${row.name}`),foreignKeyViolations:result.foreignKeys.length,
    mappingCounts:Object.freeze({entityMappings:Number(mappingCounts?.entity_mappings??0),qualifications:Number(mappingCounts?.qualifications??0),members:Number(mappingCounts?.members??0),heads:Number(mappingCounts?.heads??0)})
  });
}

const schemaReport=(classification,{mutationIssued=false,state=null,note=null,preBookmarkDigest=null,postBookmarkDigest=null}={})=>Object.freeze({
  ok:classification==='DEFINITELY_APPLIED_SUCCESSFULLY',classification,mutationIssued,recoveryIssued:false,
  automaticRestorePermitted:false,note,migration:Object.freeze({path:MIGRATION_0006_PATH,gitBlobSha:MIGRATION_0006_GIT_BLOB_SHA,statements:12}),
  recovery:Object.freeze({mechanism:'cloudflare_d1_time_travel_attended_only',preBookmarkDigest,postBookmarkDigest}),
  state,productionMutations:mutationIssued?1:0,apiFootballRequests:0,workerCronSecretChanges:0
});

export async function applyMigration0006Schema(options){
  const db=createParameterizedD1Adapter(options);
  const statements=readPinnedMigration0006(options.readFile);
  const before=await readState(db,{beforeSchema:true});
  if(before.foreignKeyViolations!==0||before.classification!==MIGRATION_0006_EXACT_PRE)
    return schemaReport(before.classification===MIGRATION_0006_EXACT_POST_EMPTY?'DEFINITELY_ALREADY_APPLIED':'DEFINITELY_NOT_APPLIED',{state:before});
  let preBookmarkDigest;
  try{preBookmarkDigest=sha256(await db.checkpoint());}catch{return schemaReport('DEFINITELY_NOT_APPLIED',{state:before,note:'time_travel_checkpoint_unavailable'});}
  let mutationError=null;
  try{await db.batch(statements.map(sql=>Object.freeze({sql,params:Object.freeze([])})));}catch(error){mutationError=error;}
  let after;try{after=await readState(db);}catch{return schemaReport('AMBIGUOUS_REQUIRES_OWNER_ATTENTION',{mutationIssued:true,state:before,note:'post_mutation_reconciliation_failed',preBookmarkDigest});}
  let postBookmarkDigest=null;try{postBookmarkDigest=sha256(await db.checkpoint());}catch{}
  if(after.classification===MIGRATION_0006_EXACT_POST_EMPTY&&after.foreignKeyViolations===0)
    return schemaReport('DEFINITELY_APPLIED_SUCCESSFULLY',{mutationIssued:true,state:after,note:mutationError?'reconciled_after_unknown_transport':postBookmarkDigest?null:'post_checkpoint_unavailable',preBookmarkDigest,postBookmarkDigest});
  if(after.classification===MIGRATION_0006_EXACT_PRE&&mutationError)
    return schemaReport('DEFINITELY_NOT_APPLIED',{mutationIssued:true,state:after,note:'reconciled_exact_prestate',preBookmarkDigest,postBookmarkDigest});
  return schemaReport('AMBIGUOUS_REQUIRES_OWNER_ATTENTION',{mutationIssued:true,state:after,note:'unexpected_post_mutation_state',preBookmarkDigest,postBookmarkDigest});
}

export function sanitizedPrivateMappingEvidence({state=null,plan=null}={}){
  return Object.freeze({entityMappingCount:state?.mappingCounts?.entityMappings??null,qualificationCount:state?.mappingCounts?.qualifications??null,memberCount:state?.mappingCounts?.members??null,headCount:state?.mappingCounts?.heads??null,
    completeTwentyClubCoverage:state?.mappingCounts?.members===20,persistenceIntegrityHash:plan?.persistenceIntegrityHash??null,
    crosswalkIntegrityHash:plan?.crosswalkIntegrityHash??null,providerUniverseRevision:plan?.providerUniverseRevision??null,
    officialFplAuthorityDigest:plan?.officialFplAuthorityDigest??null,officialFplAuthorityFetchedAt:plan?.officialFplAuthorityFetchedAt??null});
}
function mappingReport(classification,{ok=false,mutationIssued=false,state=null,plan=null,note=null,officialFplRequests=0,d1Outcome=null}={}){
  return Object.freeze({ok,classification,mutationIssued,recoveryIssued:false,automaticRestorePermitted:false,note,
    mapping:sanitizedPrivateMappingEvidence({state,plan}),d1Outcome,
    officialFplRequests,apiFootballRequests:0,workerCronSecretChanges:0
  });
}
export function classifyPrivateMappingReconciliation({state,verified,plan,mutationError,d1Outcome}){
  if(state?.classification===MIGRATION_0006_POST_WITH_MAPPING&&state.foreignKeyViolations===0&&verified?.ok&&verified.persistenceIntegrityHash===plan?.persistenceIntegrityHash)
    return Object.freeze({classification:'DEFINITELY_APPLIED_SUCCESSFULLY',ok:true,note:mutationError?'reconciled_after_unknown_transport':null});
  const exactEmpty=state?.classification===MIGRATION_0006_EXACT_POST_EMPTY&&state.foreignKeyViolations===0&&state.mappingCounts?.entityMappings===0;
  const definiteRejection=['http_rejected','d1_rejected','statement_failed'].includes(d1Outcome?.category);
  if(mutationError&&definiteRejection&&exactEmpty)
    return Object.freeze({classification:'DEFINITELY_NOT_APPLIED',ok:false,note:'explicit_rejection_reconciled_exact_prestate'});
  return Object.freeze({classification:'AMBIGUOUS_REQUIRES_OWNER_ATTENTION',ok:false,note:'owner_attention_required'});
}

export async function persistPrivateMapping0006(options){
  const {crosswalkJson,providerUniverse,now=()=>new Date().toISOString(),officialFetch=globalThis.fetch,...identity}=options??{};
  let d1Outcome=null;
  const db=createParameterizedD1Adapter({...identity,onMutationDiagnostic:value=>{d1Outcome=value;}});
  const before=await readState(db);
  if(before.foreignKeyViolations!==0||before.classification!==MIGRATION_0006_EXACT_POST_EMPTY)
    return mappingReport(before.classification===MIGRATION_0006_POST_WITH_MAPPING?'DEFINITELY_ALREADY_APPLIED':'DEFINITELY_NOT_APPLIED',{state:before});
  let crosswalk;try{crosswalk=JSON.parse(crosswalkJson);}catch{throw fixedError('private_mapping_secret_invalid');}
  const allowed=new Set([OFFICIAL_FPL_BOOTSTRAP_URL,OFFICIAL_FPL_FIXTURES_URL]);let officialFplRequests=0;
  const boundedFetch=async(url,init)=>{if(!allowed.has(String(url))||officialFplRequests>=2)throw fixedError('official_fpl_request_contract_invalid');officialFplRequests+=1;return officialFetch(url,init);};
  const authority=await fetchOfficialFplAuthority({fetchImpl:boundedFetch});
  if(!authority?.ok||officialFplRequests!==2)throw fixedError('official_fpl_authority_invalid');
  const plan=await prepareQualifiedTeamMappingPersistence({authority,providerUniverse,crosswalk,now:now()});
  crosswalk=null;
  if(!plan.ok)throw fixedError('private_mapping_plan_invalid');
  let mutationError=null;
  try{const result=await persistQualifiedTeamMappingPlan(db,plan);if(!result.ok)mutationError=fixedError('private_mapping_mutation_failed');}catch{mutationError=fixedError('private_mapping_mutation_outcome_unknown');}
  let verified=null,state=null;
  try{state=await readState(db);verified=await readQualifiedTeamMappings(db,{season:plan.fplSeason,authority});}catch{}
  const outcome=classifyPrivateMappingReconciliation({state,verified,plan,mutationError,d1Outcome});
  return mappingReport(outcome.classification,{ok:outcome.ok,mutationIssued:true,state,plan,note:outcome.note,officialFplRequests,d1Outcome});
}
