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

function validateIdentity({accountId,accountFingerprint,databaseId,token}){
  if(typeof accountId!=='string'||!accountId||typeof token!=='string'||!token||
    !/^[0-9a-f]{64}$/.test(accountFingerprint)||sha256(accountId)!==accountFingerprint||databaseId!==EXPECTED_D1_DATABASE_ID)
    throw fixedError('migration_0006_identity_invalid');
}

async function sendBatch({transport,url,token,statements,mutation}){
  const body=JSON.stringify({batch:statements.map(statement=>({sql:statement.sql,params:statement.params}))});
  let response;
  try{response=await transport(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json'},body,redirect:'error',signal:AbortSignal.timeout(TIMEOUT_MS)});}
  catch{const error=fixedError(mutation?'migration_0006_mutation_outcome_unknown':'migration_0006_read_failed');error.outcomeUnknown=mutation;throw error;}
  if(response?.status===401||response?.status===403)throw fixedError('migration_0006_auth_failed');
  if(!response?.ok)throw fixedError(mutation?'migration_0006_mutation_outcome_unknown':'migration_0006_read_failed');
  let payload;try{payload=await response.json();}catch{throw fixedError(mutation?'migration_0006_mutation_outcome_unknown':'migration_0006_read_failed');}
  if(payload?.success!==true||!Array.isArray(payload.result)||payload.result.length!==statements.length||payload.result.some(row=>row?.success!==true))
    throw fixedError(mutation?'migration_0006_mutation_outcome_unknown':'migration_0006_read_failed');
  return payload.result.map(row=>row.results??[]);
}

export function createParameterizedD1Adapter({accountId,accountFingerprint,databaseId=EXPECTED_D1_DATABASE_ID,token,transport=globalThis.fetch}){
  validateIdentity({accountId,accountFingerprint,databaseId,token});
  if(typeof transport!=='function')throw fixedError('migration_0006_transport_invalid');
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
      return sendBatch({transport,url,token,statements,mutation:true});
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
  {key:'mappingCounts',sql:'SELECT (SELECT COUNT(*) FROM api_football_team_mapping_qualifications) AS qualifications,(SELECT COUNT(*) FROM api_football_team_mapping_members) AS members,(SELECT COUNT(*) FROM api_football_team_mapping_heads) AS heads'}
]);

async function readState(db,{beforeSchema=false}={}){
  const statements=beforeSchema?READ_STATE.slice(0,3):READ_STATE;
  const rows=await Promise.all(statements.map(async row=>[row.key,(await db.prepare(row.sql).all()).results]));
  const result=Object.fromEntries(rows);
  const mappingCounts=beforeSchema?{qualifications:0,members:0,heads:0}:result.mappingCounts?.[0];
  return Object.freeze({
    classification:classifyMigration0006State({ledger:result.ledger,objects:result.objects,mappingCounts}),
    ledger:result.ledger.map(row=>`${row.version}:${row.name}`),foreignKeyViolations:result.foreignKeys.length,
    mappingCounts:Object.freeze({qualifications:Number(mappingCounts?.qualifications??0),members:Number(mappingCounts?.members??0),heads:Number(mappingCounts?.heads??0)})
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
  return Object.freeze({qualificationCount:state?.mappingCounts?.qualifications??null,memberCount:state?.mappingCounts?.members??null,headCount:state?.mappingCounts?.heads??null,
    completeTwentyClubCoverage:state?.mappingCounts?.members===20,persistenceIntegrityHash:plan?.persistenceIntegrityHash??null,
    crosswalkIntegrityHash:plan?.crosswalkIntegrityHash??null,providerUniverseRevision:plan?.providerUniverseRevision??null,
    officialFplAuthorityDigest:plan?.officialFplAuthorityDigest??null,officialFplAuthorityFetchedAt:plan?.officialFplAuthorityFetchedAt??null});
}
function mappingReport(classification,{ok=false,mutationIssued=false,state=null,plan=null,note=null,officialFplRequests=0}={}){
  return Object.freeze({ok,classification,mutationIssued,recoveryIssued:false,automaticRestorePermitted:false,note,
    mapping:sanitizedPrivateMappingEvidence({state,plan}),
    officialFplRequests,apiFootballRequests:0,workerCronSecretChanges:0
  });
}

export async function persistPrivateMapping0006(options){
  const {crosswalkJson,providerUniverse,now=()=>new Date().toISOString(),officialFetch=globalThis.fetch,...identity}=options??{};
  const db=createParameterizedD1Adapter(identity);
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
  if(state?.classification===MIGRATION_0006_POST_WITH_MAPPING&&state.foreignKeyViolations===0&&verified?.ok&&verified.persistenceIntegrityHash===plan.persistenceIntegrityHash)
    return mappingReport('DEFINITELY_APPLIED_SUCCESSFULLY',{ok:true,mutationIssued:true,state,plan,note:mutationError?'reconciled_after_unknown_transport':null,officialFplRequests});
  return mappingReport('AMBIGUOUS_REQUIRES_OWNER_ATTENTION',{mutationIssued:true,state,plan,note:'owner_attention_required',officialFplRequests});
}
