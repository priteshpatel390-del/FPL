import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {EXPECTED_D1_DATABASE_ID} from '../data-platform/phase4b/live-contract.mjs';
import {
  ATTENDED_CREDENTIAL_PREPARATION_MAX_D1_CALLS,
  ATTENDED_CREDENTIAL_PREPARATION_MAX_D1_STATEMENTS,
  ATTENDED_CREDENTIAL_PREPARATION_MAX_ROWS_CHANGED,
  credentialLifecycleMutation
} from './attended-acceptance.mjs';
import {
  ORIGINAL_BLOCKED_VERSION_ID,
  buildReviewedAttendedIdentity,
  prepareFinalAttendedVersion
} from './attended-version.mjs';
import {
  MutationAmbiguousError,
  MutationRejectedError,
  WORKER_NAME,
  extractVersionIds
} from './stage-inactive-version.mjs';
import {
  COLLECTOR_ATTENDED_STAGE_READY,
  COLLECTOR_PREPARATION_START_READY,
  COLLECTOR_PREPARATION_VERSION_READY,
  COLLECTOR_PREFLIGHT_PREPARATION_CLOSEOUT_STAGE,
  COLLECTOR_PREFLIGHT_PREPARATION_START_STAGE,
  COLLECTOR_PREFLIGHT_PREPARATION_VERSION_STAGE
} from './activation-preflight.mjs';

export const ATTENDED_PREPARATION_VERSION='api-football-attended-preparation-v1';
export const VERSION_PREPARATION_CLASSIFICATION='ATTENDED_VERSION_PREPARED_RECONCILIATION_REQUIRED';
export const CREDENTIAL_PREPARATION_SUCCESS='ATTENDED_CREDENTIAL_PREPARATION_SUBMITTED_SUCCESS';
export const CREDENTIAL_PREPARATION_AMBIGUOUS='ATTENDED_CREDENTIAL_PREPARATION_AMBIGUOUS_RECONCILIATION_REQUIRED';
export const CREDENTIAL_PREPARATION_REJECTED='ATTENDED_CREDENTIAL_PREPARATION_REJECTED';
export const CREDENTIAL_PREPARATION_NOOP='ATTENDED_CREDENTIAL_PREPARATION_NOOP_OR_DRIFT';
export const PREPARATION_VERSION_MAX_MUTATIONS=1;
export const PREPARATION_PROVIDER_MAX_REQUESTS=0;

const API='https://api.cloudflare.com/client/v4';
const HEX40=/^[0-9a-f]{40}$/;
const HEX64=/^[0-9a-f]{64}$/;
const fail=code=>{throw new Error(code);};
const digest=value=>createHash('sha256').update(String(value)).digest('hex');
const enc=value=>encodeURIComponent(String(value));
const required=(env,name)=>typeof env[name]==='string'&&env[name]?env[name]:fail('attended_preparation_environment_incomplete');
const safe=value=>Object.freeze(value);

function exactReadOnlyEvidence(report){
  return report?.evidence?.productionMutations===0&&report?.evidence?.apiFootballRequests===0&&report?.evidence?.secretValuesRead===0;
}

function exactFoundation(report){
  const mapping=report?.mapping||{},prior=report?.priorState||{};
  return report?.migrationCount===6&&report?.foreignKeyViolations===0&&report?.officialFplAuthority?.valid===true&&
    report?.officialFplAuthority?.teamCount===20&&mapping.state==='COMMITTED'&&mapping.mappingCount===20&&mapping.memberCount===20&&
    mapping.distinctProviderIds===20&&mapping.distinctFplIds===20&&mapping.canonicalCoverageMatches===true&&
    mapping.historicalAuthorityProvenancePresent===true&&report?.runtime?.collectionEnabled===0&&report?.runtime?.activeLease===false&&
    prior.requestAttempts===0&&prior.generations===0&&prior.fixtureRevisions===0&&prior.attempt2Count===0&&
    prior.reservedAttemptCount===0&&prior.stagingGenerationCount===0&&report?.modelUiImportCount===0&&
    report?.rawPayloadStoragePresent===false&&exactReadOnlyEvidence(report);
}

export function validatePreparationAdmission(report,{approvedSha,accountFingerprint,phase,versionId=null}={}){
  if(!HEX40.test(String(approvedSha||''))||!HEX64.test(String(accountFingerprint||''))||report?.approvedSha!==approvedSha||
    report?.accountFingerprint!==accountFingerprint||!exactFoundation(report))fail('attended_preparation_handoff_invalid');
  const inventory=report.inventory||{};
  if(phase==='START'){
    if(report.ok!==true||report.stage!==COLLECTOR_PREFLIGHT_PREPARATION_START_STAGE||report.classification!==COLLECTOR_PREPARATION_START_READY||
      report.runtime?.credentialState!=='UNPROVISIONED'||inventory.reviewedVersionId!==ORIGINAL_BLOCKED_VERSION_ID||
      inventory.originalVersionIdentityExact!==true||inventory.versionIdentityExact!==true||inventory.versionInventoryExact!==true||
      inventory.workerPresent!==true||inventory.deploymentCount!==0||inventory.workersDev!==false||inventory.previewUrls!==false||
      inventory.cronCount!==0||inventory.routeCount!==0||inventory.customDomainCount!==0||inventory.secretBindingPresent!==false||
      !Array.isArray(inventory.secretBindingNames)||inventory.secretBindingNames.length!==0)return fail('attended_preparation_start_not_ready');
    return true;
  }
  if(phase==='VERSION'){
    if(report.ok!==true||report.stage!==COLLECTOR_PREFLIGHT_PREPARATION_VERSION_STAGE||report.classification!==COLLECTOR_PREPARATION_VERSION_READY||
      report.runtime?.credentialState!=='UNPROVISIONED'||inventory.reviewedVersionId!==versionId||inventory.originalVersionIdentityExact!==true||
      inventory.versionIdentityExact!==true||inventory.versionInventoryExact!==true||inventory.workerPresent!==true||inventory.deploymentCount!==0||
      inventory.workersDev!==false||inventory.previewUrls!==false||inventory.cronCount!==0||inventory.routeCount!==0||inventory.customDomainCount!==0||
      inventory.secretBindingPresent!==true||JSON.stringify(inventory.secretBindingNames)!==JSON.stringify(['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET']))
      return fail('attended_preparation_version_not_ready');
    return true;
  }
  if(phase==='CLOSEOUT'){
    if(report.ok!==true||report.stage!==COLLECTOR_PREFLIGHT_PREPARATION_CLOSEOUT_STAGE||report.classification!==COLLECTOR_ATTENDED_STAGE_READY||
      report.runtime?.credentialState!=='AVAILABLE'||inventory.reviewedVersionId!==versionId||inventory.originalVersionIdentityExact!==true||
      inventory.versionIdentityExact!==true||inventory.versionInventoryExact!==true||inventory.workerPresent!==true||inventory.deploymentCount!==0||
      inventory.workersDev!==false||inventory.previewUrls!==false||inventory.cronCount!==0||inventory.routeCount!==0||inventory.customDomainCount!==0||
      inventory.secretBindingPresent!==true||JSON.stringify(inventory.secretBindingNames)!==JSON.stringify(['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET']))
      return fail('attended_preparation_closeout_not_ready');
    return true;
  }
  fail('attended_preparation_phase_invalid');
}

function versionPath(accountId){
  return '/accounts/'+enc(accountId)+'/workers/scripts/'+enc(WORKER_NAME)+'/versions';
}

export function assertPreparationVersionRequestAllowed(method,requestPath,{accountId}={}){
  const expected=versionPath(accountId),verb=String(method).toUpperCase();
  if((verb==='GET'&&requestPath===expected+'?deployable=true')||(verb==='POST'&&requestPath===expected))return true;
  fail('attended_preparation_version_endpoint_forbidden');
}

export function createPreparationVersionRequester({accountId,token,fetchImpl=globalThis.fetch,timeoutMs=20_000}={}){
  if(typeof accountId!=='string'||!accountId||typeof token!=='string'||!token||typeof fetchImpl!=='function')fail('attended_preparation_version_environment_invalid');
  let mutationSubmissions=0;
  const request=async(requestPath,{method='GET',multipart}={})=>{
    const upper=String(method).toUpperCase();assertPreparationVersionRequestAllowed(upper,requestPath,{accountId});
    if(upper==='POST'&&++mutationSubmissions>PREPARATION_VERSION_MAX_MUTATIONS)fail('attended_preparation_version_mutation_budget_exceeded');
    const headers={Authorization:'Bearer '+token,Accept:'application/json'};
    let response,text;
    try{
      response=await fetchImpl(API+requestPath,{method:upper,headers,body:upper==='POST'?multipart:undefined,redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
      text=await response.text();
    }catch{
      if(upper==='POST')throw new MutationAmbiguousError('attended_preparation_version_transport_ambiguous');
      fail('attended_preparation_version_read_failed');
    }
    if(upper==='POST'&&response.status>=400&&response.status<500)throw new MutationRejectedError('attended_preparation_version_rejected_'+response.status);
    if(upper==='POST'&&(response.status>=500||response.status<200||response.status>=300))throw new MutationAmbiguousError('attended_preparation_version_transport_ambiguous');
    if(upper==='GET'&&(response.status<200||response.status>=300))fail('attended_preparation_version_read_failed');
    let payload;try{payload=JSON.parse(text);}catch{
      if(upper==='POST')throw new MutationAmbiguousError('attended_preparation_version_response_ambiguous');
      fail('attended_preparation_version_read_failed');
    }
    if(payload?.success!==true){
      if(upper==='POST')throw new MutationAmbiguousError('attended_preparation_version_response_ambiguous');
      fail('attended_preparation_version_read_failed');
    }
    return safe({result:payload.result,status:response.status});
  };
  return safe({request,mutationSubmissions:()=>mutationSubmissions});
}

export async function runVersionPreparation({env=process.env,fetchImpl=globalThis.fetch,admission}={}){
  const accountId=required(env,'CLOUDFLARE_ACCOUNT_ID'),fingerprint=required(env,'CLOUDFLARE_ACCOUNT_FINGERPRINT');
  const token=required(env,'CLOUDFLARE_ATTENDED_VERSION_UPLOAD_TOKEN'),approvedSha=required(env,'APPROVED_SHA');
  const apiKey=required(env,'API_FOOTBALL_API_KEY'),triggerSecret=required(env,'API_FOOTBALL_ATTENDED_TRIGGER_SECRET');
  if(!HEX64.test(fingerprint)||digest(accountId)!==fingerprint||!HEX40.test(approvedSha))fail('attended_preparation_identity_invalid');
  validatePreparationAdmission(admission,{approvedSha,accountFingerprint:fingerprint,phase:'START'});
  const requester=createPreparationVersionRequester({accountId,token,fetchImpl});
  const listPath=versionPath(accountId)+'?deployable=true';
  const readVersions=async()=>extractVersionIds((await requester.request(listPath)).result);
  const result=await prepareFinalAttendedVersion({
    request:requester.request,readVersions,accountId,approvedSha,secrets:{apiKey,triggerSecret},beforeIds:[ORIGINAL_BLOCKED_VERSION_ID]
  });
  const identity=buildReviewedAttendedIdentity(approvedSha);
  if(requester.mutationSubmissions()!==1)fail('attended_preparation_version_mutation_budget_exceeded');
  return safe({
    version:ATTENDED_PREPARATION_VERSION,ok:true,classification:VERSION_PREPARATION_CLASSIFICATION,retryAuthorized:false,
    approvedSha,accountFingerprint:fingerprint,attendedVersionId:result.versionId,mutationDisposition:result.disposition,
    versionMutationSubmissions:1,versionInventoryCount:result.afterIds.length,moduleCount:Object.keys(identity.moduleSha256).length,
    mainModule:identity.mainModule,compatibilityDate:identity.compatibilityDate,
    secretBindingNames:Object.freeze(['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET']),
    deploymentMutations:0,previewMutations:0,cronRouteDomainMutations:0,d1Mutations:0,apiFootballRequests:0
  });
}

function d1Path(accountId){
  return '/accounts/'+enc(accountId)+'/d1/database/'+enc(EXPECTED_D1_DATABASE_ID)+'/query';
}
export function assertPreparationCredentialRequestAllowed(method,requestPath,{accountId}={}){
  if(String(method).toUpperCase()==='POST'&&requestPath===d1Path(accountId))return true;
  fail('attended_preparation_credential_endpoint_forbidden');
}

export async function submitCredentialPreparation({accountId,token,fetchImpl=globalThis.fetch,evidence}={}){
  const contract=credentialLifecycleMutation('MARK_AVAILABLE',evidence);
  if(contract?.expectedChanges!==1||contract.maxD1Calls!==ATTENDED_CREDENTIAL_PREPARATION_MAX_D1_CALLS||
    contract.maxD1Statements!==ATTENDED_CREDENTIAL_PREPARATION_MAX_D1_STATEMENTS||contract.maxRowsChanged!==ATTENDED_CREDENTIAL_PREPARATION_MAX_ROWS_CHANGED)
    fail('attended_preparation_credential_contract_invalid');
  const requestPath=d1Path(accountId);assertPreparationCredentialRequestAllowed('POST',requestPath,{accountId});
  const body=JSON.stringify({sql:contract.sql,params:[]});
  let response,text;
  try{
    response=await fetchImpl(API+requestPath,{method:'POST',headers:{Authorization:'Bearer '+token,Accept:'application/json','Content-Type':'application/json'},body,redirect:'error',signal:AbortSignal.timeout(20_000)});
    text=await response.text();
  }catch{
    return safe({ok:false,classification:CREDENTIAL_PREPARATION_AMBIGUOUS,reason:'credential_mutation_transport_ambiguous',retryAuthorized:false,d1Calls:1,d1Statements:1,rowsChanged:null});
  }
  if(response.status>=400&&response.status<500)return safe({ok:false,classification:CREDENTIAL_PREPARATION_REJECTED,reason:'credential_mutation_rejected',retryAuthorized:false,d1Calls:1,d1Statements:1,rowsChanged:0});
  if(response.status>=500||response.status<200||response.status>=300)return safe({ok:false,classification:CREDENTIAL_PREPARATION_AMBIGUOUS,reason:'credential_mutation_http_ambiguous',retryAuthorized:false,d1Calls:1,d1Statements:1,rowsChanged:null});
  let payload;try{payload=JSON.parse(text);}catch{return safe({ok:false,classification:CREDENTIAL_PREPARATION_AMBIGUOUS,reason:'credential_mutation_response_ambiguous',retryAuthorized:false,d1Calls:1,d1Statements:1,rowsChanged:null});}
  if(payload?.success!==true)return safe({ok:false,classification:CREDENTIAL_PREPARATION_REJECTED,reason:'credential_mutation_rejected',retryAuthorized:false,d1Calls:1,d1Statements:1,rowsChanged:0});
  const result=payload.result;
  if(!Array.isArray(result)||result.length!==1||result[0]?.success!==true)return safe({ok:false,classification:CREDENTIAL_PREPARATION_REJECTED,reason:'credential_mutation_statement_rejected',retryAuthorized:false,d1Calls:1,d1Statements:1,rowsChanged:0});
  const changes=Number(result[0]?.meta?.changes);
  const rowsWritten=result[0]?.meta?.rows_written===undefined?changes:Number(result[0].meta.rows_written);
  if(changes===0&&rowsWritten===0)return safe({ok:false,classification:CREDENTIAL_PREPARATION_NOOP,reason:'credential_mutation_noop',retryAuthorized:false,d1Calls:1,d1Statements:1,rowsChanged:0});
  if(changes!==1||rowsWritten!==1)return safe({ok:false,classification:CREDENTIAL_PREPARATION_AMBIGUOUS,reason:'credential_mutation_budget_or_result_ambiguous',retryAuthorized:false,d1Calls:1,d1Statements:1,rowsChanged:Number.isFinite(changes)?changes:null});
  return safe({ok:true,classification:CREDENTIAL_PREPARATION_SUCCESS,retryAuthorized:false,d1Calls:1,d1Statements:1,rowsChanged:1});
}

export async function runCredentialPreparation({env=process.env,fetchImpl=globalThis.fetch,admission}={}){
  const accountId=required(env,'CLOUDFLARE_ACCOUNT_ID'),fingerprint=required(env,'CLOUDFLARE_ACCOUNT_FINGERPRINT');
  const token=required(env,'CLOUDFLARE_ATTENDED_D1_MUTATION_TOKEN'),approvedSha=required(env,'APPROVED_SHA');
  const versionId=required(env,'API_FOOTBALL_ATTENDED_VERSION_ID');
  if(!HEX64.test(fingerprint)||digest(accountId)!==fingerprint||!HEX40.test(approvedSha))fail('attended_preparation_identity_invalid');
  validatePreparationAdmission(admission,{approvedSha,accountFingerprint:fingerprint,phase:'VERSION',versionId});
  const result=await submitCredentialPreparation({
    accountId,token,fetchImpl,
    evidence:{collectionEnabled:0,activeLease:false,versionInventoryExact:true,secretBearingVersionPresent:true}
  });
  return safe({
    version:ATTENDED_PREPARATION_VERSION,...result,approvedSha,accountFingerprint:fingerprint,attendedVersionId:versionId,
    apiFootballRequests:0,providerRequests:0,versionMutations:0,deploymentMutations:0,previewMutations:0,cronRouteDomainMutations:0
  });
}

function writeReport(path,value){
  if(typeof path==='string'&&path)fs.writeFileSync(path,JSON.stringify(value,null,2)+'\n',{mode:0o600});
}
function mask(value){if(typeof value==='string'&&value)process.stdout.write('::add-mask::'+value+'\n');}

export async function main(){
  const operation=process.env.API_FOOTBALL_ATTENDED_PREPARATION_OPERATION;
  if(operation==='VERSION'){
    for(const value of [
      process.env.CLOUDFLARE_ACCOUNT_ID,process.env.CLOUDFLARE_ATTENDED_VERSION_UPLOAD_TOKEN,
      process.env.API_FOOTBALL_API_KEY,process.env.API_FOOTBALL_ATTENDED_TRIGGER_SECRET
    ])mask(value);
    const admission=JSON.parse(fs.readFileSync(required(process.env,'API_FOOTBALL_PREPARATION_ADMISSION_PATH'),'utf8'));
    const result=await runVersionPreparation({admission});
    writeReport(process.env.API_FOOTBALL_ATTENDED_VERSION_PREPARATION_REPORT_PATH,result);
    console.log(JSON.stringify({ok:result.ok,classification:result.classification,attendedVersionId:result.attendedVersionId,mutationDisposition:result.mutationDisposition,retryAuthorized:false,versionMutationSubmissions:1,apiFootballRequests:0}));
    return 0;
  }
  if(operation==='CREDENTIAL'){
    for(const value of [process.env.CLOUDFLARE_ACCOUNT_ID,process.env.CLOUDFLARE_ATTENDED_D1_MUTATION_TOKEN])mask(value);
    const admission=JSON.parse(fs.readFileSync(required(process.env,'API_FOOTBALL_PREPARATION_ADMISSION_PATH'),'utf8'));
    const result=await runCredentialPreparation({admission});
    writeReport(process.env.API_FOOTBALL_ATTENDED_CREDENTIAL_PREPARATION_REPORT_PATH,result);
    console.log(JSON.stringify({ok:result.ok,classification:result.classification,retryAuthorized:false,d1Calls:result.d1Calls,d1Statements:result.d1Statements,rowsChanged:result.rowsChanged,apiFootballRequests:0}));
    return result.ok?0:1;
  }
  fail('attended_preparation_operation_invalid');
}

if(import.meta.url===pathToFileURL(process.argv[1]??'').href)main().catch(error=>{
  process.stderr.write('Attended preparation stopped: '+error.message+'\n');
  process.exitCode=1;
});
