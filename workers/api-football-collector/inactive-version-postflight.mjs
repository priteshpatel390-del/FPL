import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {
  ACTIVATION_QUERIES,EXPECTED_DATABASE_NAME,EXPECTED_FPL_SEASON,EXPECTED_MIGRATIONS,
  assertActivationReadOnlySql,buildAuthority,productionModelUiImportCount
} from './activation-live-preflight.mjs';
import {validateAuthority} from './runtime-contracts.mjs';
import {EXPECTED_D1_DATABASE_ID} from '../data-platform/phase4b/live-contract.mjs';
import {
  API_BASE,WORKER_NAME,PLAIN_TEXT,buildMetadata,deterministicIdentity,resolveModuleGraph,validateVersion
} from './inactive-version-staging.mjs';

export const POSTFLIGHT_CONTRACT_VERSION='api-football-inactive-version-postflight-v1';
const fail=code=>{const error=new Error(code);error.code=code;throw error;};
const sha256=value=>createHash('sha256').update(value).digest('hex');
const accountBase=id=>'/accounts/'+encodeURIComponent(id);
const scriptBase=id=>accountBase(id)+'/workers/scripts/'+encodeURIComponent(WORKER_NAME);
const betaBase=id=>accountBase(id)+'/workers/workers';
const d1Base=id=>accountBase(id)+'/d1/database/'+encodeURIComponent(EXPECTED_D1_DATABASE_ID);

function exactReadPath(requestPath,accountId,{workerId,versionId}={}){
  const script=scriptBase(accountId);
  const exact=new Set([
    script+'/schedules',script+'/deployments',script+'/subdomain',
    script+'/versions?deployable=true&per_page=100',
    accountBase(accountId)+'/workers/domains',
    d1Base(accountId)+'?fields=uuid,name,file_size'
  ]);
  if(exact.has(requestPath))return true;
  if(workerId&&requestPath===betaBase(accountId)+'/'+encodeURIComponent(workerId))return true;
  if(workerId&&versionId&&requestPath===betaBase(accountId)+'/'+encodeURIComponent(workerId)+'/versions/'+encodeURIComponent(versionId)+'?include=modules')return true;
  fail('postflight_read_endpoint_forbidden');
}
async function api(fetchImpl,{token,accountId,requestPath,workerId,versionId,method='GET',body}){
  if(method==='GET')exactReadPath(requestPath,accountId,{workerId,versionId});
  else if(method==='POST'&&requestPath===d1Base(accountId)+'/query'){}
  else fail('postflight_mutation_endpoint_forbidden');
  const headers={Authorization:'Bearer '+token,Accept:'application/json'};
  if(body!==undefined)headers['Content-Type']='application/json';
  let response;
  try{
    response=await fetchImpl(API_BASE+requestPath,{
      method,headers,body:body===undefined?undefined:JSON.stringify(body),
      redirect:'error',signal:AbortSignal.timeout(15000)
    });
  }catch{fail('postflight_transport_failed');}
  if(response.status!==200)fail('postflight_http_'+response.status);
  let payload;try{payload=JSON.parse(await response.text());}catch{fail('postflight_response_malformed');}
  if(payload?.success!==true)fail('postflight_response_failed');
  return payload.result;
}
function rows(result,name){
  if(Array.isArray(result))return result;
  if(Array.isArray(result?.[name]))return result[name];
  fail('postflight_'+name+'_invalid');
}
function versions(result){
  const list=Array.isArray(result?.items)?result.items:Array.isArray(result)?result:null;
  if(!list)fail('postflight_versions_invalid');
  const ids=list.map(row=>row?.id);
  if(ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length)fail('postflight_versions_invalid');
  return ids;
}
function one(value,code){if(!Array.isArray(value)||value.length!==1)fail(code);return value[0];}
function integer(value){const n=Number(value);return Number.isSafeInteger(n)&&n>=0?n:null;}
function iso(value){return typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;}

async function readD1(fetchImpl,{token,accountId}){
  const entries=Object.entries(ACTIVATION_QUERIES);
  const batch=entries.map(([,sql])=>({sql:assertActivationReadOnlySql(sql),params:[]}));
  const result=await api(fetchImpl,{token,accountId,requestPath:d1Base(accountId)+'/query',method:'POST',body:{batch}});
  if(!Array.isArray(result)||result.length!==entries.length)fail('postflight_d1_contract_invalid');
  const data={};let rowsRead=0;
  for(let i=0;i<entries.length;i++){
    const statement=result[i];
    if(statement?.success!==true||!Array.isArray(statement.results))fail('postflight_d1_statement_failed');
    const read=integer(statement.meta?.rows_read??0),written=integer(statement.meta?.rows_written??0);
    if(read===null||written===null)fail('postflight_d1_metadata_invalid');
    if(written!==0)fail('postflight_d1_write_detected');
    rowsRead+=read;
    data[entries[i][0]]=statement.results;
  }
  return {data,rowsRead};
}
export function validateD1State(data,{now}={}){
  const ledger=(data.ledger||[]).map(row=>[integer(row.version),String(row.name||'')]);
  if(JSON.stringify(ledger)!==JSON.stringify(EXPECTED_MIGRATIONS))fail('postflight_migration_ledger_drift');
  if((data.foreignKeys||[]).length!==0)fail('postflight_foreign_key_violation');
  const authority=buildAuthority(data.officialRun,data.officialTeams);
  if(!authority)fail('postflight_authority_invalid');
  const authorityCheck=validateAuthority(authority,{now,season:EXPECTED_FPL_SEASON});
  if(!authorityCheck.ok)fail('postflight_'+authorityCheck.reason);

  const mapping=one(data.mappingHead,'postflight_mapping_head_invalid');
  const members=one(data.mappingMembers,'postflight_mapping_members_invalid');
  if(mapping.state!=='COMMITTED'||integer(mapping.mapping_count)!==20||integer(members.member_count)!==20||
     integer(members.distinct_provider_ids)!==20||integer(members.distinct_fpl_ids)!==20)fail('postflight_mapping_incomplete');
  if(!/^[0-9a-f]{64}$/.test(mapping.official_fpl_authority_digest||'')||!iso(mapping.official_fpl_authority_fetched_at))fail('postflight_mapping_provenance_invalid');
  const mapped=String(members.canonical_fpl_team_ids||'').split('|').filter(Boolean).sort();
  if(mapped.length!==20||new Set(mapped).size!==20||JSON.stringify(mapped)!==JSON.stringify(authority.teamIds.slice().sort()))fail('postflight_mapping_current_coverage_drift');

  const runtime=one(data.runtime,'postflight_runtime_invalid');
  if(runtime.provider!=='api-football'||integer(runtime.collection_enabled)!==0||runtime.credential_state!=='UNPROVISIONED'||
     runtime.in_flight_attempt_id!==null||runtime.in_flight_lease_expires_at!==null)fail('postflight_runtime_drift');
  const attempts=one(data.attempts,'postflight_attempts_invalid');
  const generations=one(data.generations,'postflight_generations_invalid');
  const revisions=one(data.fixtureRevisions,'postflight_revisions_invalid');
  if(integer(attempts.total)!==0||integer(attempts.attempt2_count??0)!==0||integer(attempts.reserved_count??0)!==0||
     integer(generations.total)!==0||integer(generations.staging_count??0)!==0||integer(revisions.total)!==0)fail('postflight_history_not_pristine');
  if(productionModelUiImportCount()!==0)fail('postflight_model_ui_integration_detected');
  return Object.freeze({authorityTeamCount:20,mappingCount:20,requestAttempts:0,generations:0,fixtureRevisions:0});
}

export async function runInactiveVersionPostflight({env=process.env,fetchImpl=globalThis.fetch,now=()=>new Date().toISOString()}={}){
  const token=env.DATA_STEWARD_CLOUDFLARE_READ_TOKEN;
  const accountId=env.DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID;
  const fingerprint=env.DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT;
  const approvedSha=env.APPROVED_SHA;
  const workerId=env.STAGED_WORKER_ID,versionId=env.STAGED_VERSION_ID;
  const expectedGraph=env.STAGED_GRAPH_SHA256,expectedMetadata=env.STAGED_METADATA_SHA256;
  if(!token||!accountId||!/^[0-9a-f]{64}$/.test(fingerprint||'')||!/^[0-9a-f]{40}$/.test(approvedSha||'')||
     !workerId||!versionId||!/^[0-9a-f]{64}$/.test(expectedGraph||'')||!/^[0-9a-f]{64}$/.test(expectedMetadata||''))fail('postflight_environment_incomplete');
  if(sha256(accountId)!==fingerprint)fail('postflight_account_identity_mismatch');
  for(const value of [token,accountId,EXPECTED_D1_DATABASE_ID])process.stdout.write('::add-mask::'+value+'\n');

  const sources=resolveModuleGraph(),metadata=buildMetadata(approvedSha),identity=deterministicIdentity(metadata,sources);
  if(identity.graphSha256!==expectedGraph||identity.metadataSha256!==expectedMetadata)fail('postflight_repository_identity_drift');

  const database=await api(fetchImpl,{token,accountId,requestPath:d1Base(accountId)+'?fields=uuid,name,file_size'});
  if(database?.uuid!==EXPECTED_D1_DATABASE_ID||database?.name!==EXPECTED_DATABASE_NAME)fail('postflight_d1_identity_drift');

  const worker=await api(fetchImpl,{token,accountId,requestPath:betaBase(accountId)+'/'+encodeURIComponent(workerId),workerId});
  if(worker?.id!==workerId||worker?.name!==WORKER_NAME||worker?.observability?.enabled!==true||
     worker?.subdomain?.enabled!==false||worker?.subdomain?.previews_enabled!==false||worker?.deployed_on!==null)fail('postflight_worker_drift');

  const script=scriptBase(accountId);
  const schedules=rows(await api(fetchImpl,{token,accountId,requestPath:script+'/schedules'}),'schedules');
  const deployments=rows(await api(fetchImpl,{token,accountId,requestPath:script+'/deployments'}),'deployments');
  const versionIds=versions(await api(fetchImpl,{token,accountId,requestPath:script+'/versions?deployable=true&per_page=100'}));
  const domains=rows(await api(fetchImpl,{token,accountId,requestPath:accountBase(accountId)+'/workers/domains'}),'domains')
    .filter(row=>row?.service===WORKER_NAME||row?.service_name===WORKER_NAME||row?.worker===WORKER_NAME);
  if(schedules.length||deployments.length||domains.length||versionIds.length!==1||versionIds[0]!==versionId)fail('postflight_inventory_drift');
  const subdomain=await api(fetchImpl,{token,accountId,requestPath:script+'/subdomain'});
  if(subdomain?.enabled!==false||subdomain?.previews_enabled!==false)fail('postflight_subdomain_drift');

  const detail=await api(fetchImpl,{
    token,accountId,workerId,versionId,
    requestPath:betaBase(accountId)+'/'+encodeURIComponent(workerId)+'/versions/'+encodeURIComponent(versionId)+'?include=modules'
  });
  validateVersion(detail,{versionId,approvedSha,sources,requireModules:true});
  if(Array.isArray(detail.urls)&&detail.urls.length)fail('postflight_routable_url_present');

  const d1=await readD1(fetchImpl,{token,accountId});
  const state=validateD1State(d1.data,{now:now()});
  return Object.freeze({
    ok:true,contract:POSTFLIGHT_CONTRACT_VERSION,repositorySha:approvedSha,workerId,versionId,identity,state,
    inventory:Object.freeze({workersDev:false,previewUrls:false,deployments:0,cron:0,customDomains:0,secretBindings:0,versionCount:1,activation:PLAIN_TEXT.EIA_2I5D_ACTIVATION}),
    evidence:Object.freeze({d1RowsRead:d1.rowsRead,productionMutations:0,apiFootballRequests:0,secretValuesRead:0})
  });
}
export async function main(){
  const report=await runInactiveVersionPostflight();
  const output=process.env.API_FOOTBALL_INACTIVE_POSTFLIGHT_REPORT_PATH;
  if(output)writeFileSync(output,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  process.stdout.write(JSON.stringify({ok:true,productionMutations:0,apiFootballRequests:0,secretValuesRead:0})+'\n');
  return 0;
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href)main().catch(error=>{
  process.stderr.write('Inactive collector postflight stopped: '+(error?.code||error?.message||'postflight_unclassified_stop')+'\n');
  process.exitCode=1;
});
