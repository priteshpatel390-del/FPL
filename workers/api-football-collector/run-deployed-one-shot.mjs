// Protected executor for the deployed one-shot shadow collection. Dormant: dispatch is separately owner-gated.
// Mutations: one Deployment of the exact reviewed Version, workers.dev on/off, bounded runtime enable/disable.
// Exactly one trigger request. No Version upload, Cron, route, domain, Preview or secret mutation exists here.
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {EXPECTED_D1_DATABASE_ID} from '../data-platform/phase4b/live-contract.mjs';
import {runApiFootballActivationLivePreflight} from './activation-live-preflight.mjs';
import {deployedOneShotPreflightEnv} from './deployed-one-shot-readonly.mjs';
import {
  DEPLOYED_ONE_SHOT_CLOUDFLARE_MUTATION_CEILINGS,DEPLOYED_ONE_SHOT_EXECUTION_VERSION,DEPLOYED_ONE_SHOT_MAX_D1_CALLS,DEPLOYED_ONE_SHOT_MAX_D1_ROWS_CHANGED,
  DEPLOYED_ONE_SHOT_MAX_TRIGGER_REQUESTS,DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE,DEPLOYED_ONE_SHOT_READINESS_DELAYS_MS,DEPLOYED_ONE_SHOT_REQUEST_TIMEOUT_MS,
  DEPLOYED_ONE_SHOT_RUNTIME_SQL,DEPLOYED_ONE_SHOT_TRIGGER_TIMEOUT_MS,DEPLOYED_ONE_SHOT_VERSION_ID,DEPLOYED_ONE_SHOT_WORKER,
  buildDeploymentBody,deployedOneShotAdmissionDiagnostic,deploymentListState,deploymentSelectsExactVersion,deriveWorkersDevTarget,
  runDeployedOneShot,validateDeployedOneShotAdmissionHandoff,workerSignatureMatches
} from './deployed-one-shot.mjs';

const API='https://api.cloudflare.com/client/v4';
const HEX40=/^[0-9a-f]{40}$/;
const HEX64=/^[0-9a-f]{64}$/;
const fail=code=>{throw new Error(code);};
const digest=value=>createHash('sha256').update(String(value)).digest('hex');
const delay=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const required=(env,name)=>typeof env[name]==='string'&&env[name]?env[name]:fail('DEPLOYED_ONE_SHOT_ENVIRONMENT_INCOMPLETE');
const statusClass=status=>Number.isInteger(status)&&status>=100&&status<=599?`${Math.floor(status/100)}XX`:'UNKNOWN';
async function boundedText(response,maxBytes=32){
  const declared=Number(response.headers?.get?.('content-length'));if(Number.isFinite(declared)&&declared>maxBytes)return null;
  let text;try{text=await response.text();}catch{return null;}return Buffer.byteLength(text)<=maxBytes?text:null;
}

export function deployedOneShotCloudflarePaths(accountId){
  const script=`/accounts/${encodeURIComponent(accountId)}/workers/scripts/${DEPLOYED_ONE_SHOT_WORKER}`;
  return Object.freeze({deployments:`${script}/deployments`,subdomain:`${script}/subdomain`,
    d1:`/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(EXPECTED_D1_DATABASE_ID)}/query`});
}
// Closed endpoint allowlist. Anything else (Version upload, schedules, routes, domains, DELETE) is refused before network.
export function assertDeployedOneShotRequestAllowed(method,requestPath,{accountId}={}){
  const paths=deployedOneShotCloudflarePaths(accountId),verb=String(method).toUpperCase();
  if(verb==='POST'&&[paths.deployments,paths.subdomain,paths.d1].includes(requestPath))return 'MUTATION';
  if(verb==='GET'&&requestPath===paths.deployments)return 'READ';
  return fail('DEPLOYED_ONE_SHOT_ENDPOINT_FORBIDDEN');
}

export function deployedOneShotCriticalRecheckDiagnostic(report,identity){
  const diagnostic=deployedOneShotAdmissionDiagnostic(report,identity);
  return diagnostic?'DEPLOYED_ONE_SHOT_CRITICAL_STATE_DRIFT__'+diagnostic.toUpperCase():null;
}

export async function executeDeployedOneShot({env=process.env,fetchImpl=globalThis.fetch,criticalRecheck=runApiFootballActivationLivePreflight,wait=delay}={}){
  const accountId=required(env,'CLOUDFLARE_ACCOUNT_ID'),fingerprint=required(env,'CLOUDFLARE_ACCOUNT_FINGERPRINT');
  const readToken=required(env,'CLOUDFLARE_ATTENDED_READ_TOKEN'),mutationToken=required(env,'CLOUDFLARE_ATTENDED_MUTATION_TOKEN');
  const approvedSha=required(env,'APPROVED_SHA'),trigger=required(env,'API_FOOTBALL_ATTENDED_TRIGGER_SECRET');
  if(readToken===mutationToken)fail('DEPLOYED_ONE_SHOT_CREDENTIAL_SEPARATION_REQUIRED');
  if(trigger===readToken||trigger===mutationToken||trigger.length<32)fail('DEPLOYED_ONE_SHOT_TRIGGER_SECRET_INVALID');
  if(!HEX40.test(approvedSha))fail('DEPLOYED_ONE_SHOT_APPROVED_SHA_INVALID');
  if(!HEX64.test(fingerprint)||digest(accountId)!==fingerprint)fail('DEPLOYED_ONE_SHOT_ACCOUNT_IDENTITY_MISMATCH');
  const admission=JSON.parse(fs.readFileSync(required(env,'API_FOOTBALL_DEPLOYED_ONE_SHOT_ADMISSION_PATH'),'utf8'));
  validateDeployedOneShotAdmissionHandoff(admission,{approvedSha,accountFingerprint:fingerprint});

  // Fresh critical recheck with the protected read credential immediately before the first mutation.
  const critical=await criticalRecheck({env:deployedOneShotPreflightEnv({accountId,accountFingerprint:fingerprint,readToken,approvedSha}),fetchImpl,stage:DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE});
  const drift=deployedOneShotCriticalRecheckDiagnostic(critical,{approvedSha,accountFingerprint:fingerprint});if(drift)fail(drift);
  const target=deriveWorkersDevTarget({accountSubdomain:critical.inventory.accountSubdomain});

  const paths=deployedOneShotCloudflarePaths(accountId);
  const mutations={createDeployment:0,enableWorkersDev:0,disableWorkersDev:0};
  let d1Calls=0,d1RowsChanged=0,triggerRequests=0,readinessAttempts=0,collectionEnableSucceeded=false;
  let deployment={outcome:'NOT_ATTEMPTED',deploymentId:null,readbackExact:null};
  let readiness={outcome:'NOT_STARTED',attempts:0,lastHttpStatus:null,workerSignatureProved:false};
  const countMutation=kind=>{mutations[kind]+=1;if(mutations[kind]>DEPLOYED_ONE_SHOT_CLOUDFLARE_MUTATION_CEILINGS[kind])fail('DEPLOYED_ONE_SHOT_MUTATION_CEILING_EXCEEDED');};

  // Returns {kind:'OK',result} | {kind:'REJECTED'} | {kind:'AMBIGUOUS'}. Never retries.
  const cloudflare=async(method,requestPath,{body=null,token=mutationToken,headers={}}={})=>{
    assertDeployedOneShotRequestAllowed(method,requestPath,{accountId});
    let response;
    try{response=await fetchImpl(API+requestPath,{method,headers:{Authorization:'Bearer '+token,Accept:'application/json',...(body===null?{}:{'content-type':'application/json'}),...headers},
      ...(body===null?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(DEPLOYED_ONE_SHOT_REQUEST_TIMEOUT_MS)});}
    catch{return {kind:'AMBIGUOUS'};}
    let payload;try{payload=await response.json();}catch{return {kind:'AMBIGUOUS'};}
    if(response.ok&&payload?.success===true)return {kind:'OK',result:payload.result};
    if(response.status>=400&&response.status<500&&payload?.success===false)return {kind:'REJECTED'};
    return {kind:'AMBIGUOUS'};
  };
  const subdomain=async(enabled)=>{
    countMutation(enabled?'enableWorkersDev':'disableWorkersDev');
    const outcome=await cloudflare('POST',paths.subdomain,{body:{enabled,previews_enabled:false},headers:{'Cloudflare-Workers-Script-Api-Date':'2025-08-01'}});
    const label=enabled?'ENABLE':'DISABLE';
    if(outcome.kind==='REJECTED')fail(`DEPLOYED_ONE_SHOT_WORKERS_DEV_${label}_REJECTED`);
    if(outcome.kind!=='OK')fail(`DEPLOYED_ONE_SHOT_WORKERS_DEV_${label}_AMBIGUOUS`);
    if(outcome.result?.enabled!==enabled||outcome.result?.previews_enabled!==false)fail(`DEPLOYED_ONE_SHOT_WORKERS_DEV_${label}_STATE_MISMATCH`);
  };
  const runtime=async(statement,label)=>{
    d1Calls+=1;if(d1Calls>DEPLOYED_ONE_SHOT_MAX_D1_CALLS)fail('DEPLOYED_ONE_SHOT_D1_BUDGET_EXCEEDED');
    const outcome=await cloudflare('POST',paths.d1,{body:{sql:statement.sql,params:[...statement.params]}});
    if(outcome.kind==='REJECTED')fail(`DEPLOYED_ONE_SHOT_COLLECTION_${label}_REJECTED`);
    if(outcome.kind!=='OK')fail(`DEPLOYED_ONE_SHOT_COLLECTION_${label}_AMBIGUOUS`);
    const rows=outcome.result,changes=Number(rows?.[0]?.meta?.changes);
    if(!Array.isArray(rows)||rows.length!==1||rows[0]?.success!==true||!statement.allowedChanges.includes(changes))fail(`DEPLOYED_ONE_SHOT_COLLECTION_${label}_AMBIGUOUS`);
    d1RowsChanged+=changes;if(d1RowsChanged>DEPLOYED_ONE_SHOT_MAX_D1_ROWS_CHANGED)fail('DEPLOYED_ONE_SHOT_D1_BUDGET_EXCEEDED');
  };

  const result=await runDeployedOneShot({admissionValid:true,ops:{
    createDeployment:async()=>{
      countMutation('createDeployment');
      const outcome=await cloudflare('POST',paths.deployments,{body:buildDeploymentBody(approvedSha)});
      if(outcome.kind==='REJECTED'){deployment={outcome:'REJECTED',deploymentId:null,readbackExact:null};fail('DEPLOYED_ONE_SHOT_DEPLOYMENT_REJECTED');}
      if(outcome.kind!=='OK'||!deploymentSelectsExactVersion(outcome.result)){deployment={outcome:'AMBIGUOUS',deploymentId:null,readbackExact:null};fail('DEPLOYED_ONE_SHOT_DEPLOYMENT_AMBIGUOUS');}
      deployment={outcome:'CREATED',deploymentId:outcome.result.id,readbackExact:null};
    },
    verifyDeployment:async()=>{
      const outcome=await cloudflare('GET',paths.deployments,{token:readToken});
      const state=outcome.kind==='OK'?deploymentListState(outcome.result):null;
      const exact=Boolean(state?.exactSingle&&state.deploymentId===deployment.deploymentId);
      deployment={...deployment,readbackExact:exact};
      if(!exact)fail('DEPLOYED_ONE_SHOT_DEPLOYMENT_READBACK_MISMATCH');
    },
    enableWorkersDev:()=>subdomain(true),
    proveReadiness:async()=>{
      for(let index=0;index<DEPLOYED_ONE_SHOT_READINESS_DELAYS_MS.length;index++){
        if(DEPLOYED_ONE_SHOT_READINESS_DELAYS_MS[index]>0)await wait(DEPLOYED_ONE_SHOT_READINESS_DELAYS_MS[index]);
        readinessAttempts+=1;
        let response;
        try{response=await fetchImpl(target,{method:'GET',redirect:'error',signal:AbortSignal.timeout(DEPLOYED_ONE_SHOT_REQUEST_TIMEOUT_MS)});}
        catch{readiness={outcome:'TRANSPORT_FAILURE',attempts:readinessAttempts,lastHttpStatus:null,workerSignatureProved:false};continue;}
        const body=await boundedText(response);
        const proved=workerSignatureMatches({status:response.status,body,cacheControl:response.headers.get('cache-control'),contentType:response.headers.get('content-type')});
        readiness={outcome:proved?'WORKER_SIGNATURE_PROVED':'HTTP_RESPONSE_MISMATCH',attempts:readinessAttempts,lastHttpStatus:Number.isInteger(response.status)?response.status:null,workerSignatureProved:proved};
        if(proved)return;
      }
      fail('DEPLOYED_ONE_SHOT_READINESS_NOT_PROVEN');
    },
    enableCollection:async()=>{await runtime(DEPLOYED_ONE_SHOT_RUNTIME_SQL.enable,'ENABLE');collectionEnableSucceeded=true;},
    triggerOnce:async()=>{
      if(triggerRequests>=DEPLOYED_ONE_SHOT_MAX_TRIGGER_REQUESTS)fail('DEPLOYED_ONE_SHOT_SECOND_TRIGGER_FORBIDDEN');
      triggerRequests+=1;
      let response;
      try{response=await fetchImpl(target,{method:'POST',headers:{'x-teamsheet-attended-trigger':trigger},redirect:'error',signal:AbortSignal.timeout(DEPLOYED_ONE_SHOT_TRIGGER_TIMEOUT_MS)});}
      catch{return {requestCount:1,outcome:'AMBIGUOUS',diagnostic:'DEPLOYED_ONE_SHOT_TRIGGER_TRANSPORT_AMBIGUOUS'};}
      const body=await boundedText(response);
      if(response.status===202&&body==='Accepted')return {requestCount:1,outcome:'ACCEPTED',diagnostic:'DEPLOYED_ONE_SHOT_WORKER_ACCEPTED'};
      if(response.status===404&&body==='Not found')return {requestCount:1,outcome:'REJECTED',diagnostic:'DEPLOYED_ONE_SHOT_TRIGGER_REJECTED'};
      if(response.status===409&&body==='Not accepted')return {requestCount:1,outcome:'REJECTED',diagnostic:'DEPLOYED_ONE_SHOT_COLLECTION_NOT_ACCEPTED'};
      return {requestCount:1,outcome:'REJECTED',diagnostic:`DEPLOYED_ONE_SHOT_TRIGGER_HTTP_${statusClass(response.status)}`};
    },
    disableCollection:()=>runtime(DEPLOYED_ONE_SHOT_RUNTIME_SQL.disable,'DISABLE'),
    disableWorkersDev:()=>subdomain(false)
  }});
  return Object.freeze({...result,approvedSha,deployment:Object.freeze({...deployment}),readiness:Object.freeze({...readiness}),
    triggerRequests,collectionEnableSucceeded,mutations:Object.freeze({...mutations}),controlBudget:Object.freeze({d1Calls,d1RowsChanged})});
}

export function buildDeployedOneShotExecutionEvidence(result,{approvedSha=null}={}){
  if(![0,1].includes(result?.triggerRequests))fail('DEPLOYED_ONE_SHOT_TRIGGER_ACCOUNTING_INVALID');
  return Object.freeze({
    version:DEPLOYED_ONE_SHOT_EXECUTION_VERSION,approvedSha,versionId:DEPLOYED_ONE_SHOT_VERSION_ID,ok:result.ok===true,
    classification:result.classification??null,diagnostic:result.diagnostic??null,primaryFailure:result.primaryFailure??null,cleanupFailure:result.cleanupFailure??null,
    stagesReached:result.stagesReached??[],deployment:result.deployment??null,readiness:result.readiness??null,
    triggerRequests:result.triggerRequests,trigger:result.trigger??null,collectionEnableSucceeded:result.collectionEnableSucceeded===true,
    cleanup:result.cleanup??null,mutations:result.mutations??null,controlBudget:result.controlBudget??null,retryAuthorized:false,
    evidence:Object.freeze({apiFootballRequestsByExecutor:0,secretValuesSerialized:0})
  });
}

export function buildDeployedOneShotPreMutationFailure(error,{approvedSha=null}={}){
  const message=String(error?.message??'');
  return Object.freeze({version:DEPLOYED_ONE_SHOT_EXECUTION_VERSION,approvedSha,versionId:DEPLOYED_ONE_SHOT_VERSION_ID,ok:false,
    classification:'DEPLOYED_ONE_SHOT_STOPPED_BEFORE_MUTATION',diagnostic:/^DEPLOYED_ONE_SHOT_[A-Z0-9_]{1,128}$/.test(message)?message:'DEPLOYED_ONE_SHOT_UNEXPECTED_FAILURE',
    primaryFailure:null,cleanupFailure:null,stagesReached:[],deployment:{outcome:'NOT_ATTEMPTED',deploymentId:null,readbackExact:null},readiness:null,
    triggerRequests:0,trigger:null,collectionEnableSucceeded:false,cleanup:null,mutations:{createDeployment:0,enableWorkersDev:0,disableWorkersDev:0},
    controlBudget:{d1Calls:0,d1RowsChanged:0},retryAuthorized:false,evidence:{apiFootballRequestsByExecutor:0,secretValuesSerialized:0}});
}

export async function main(){
  const approvedSha=process.env.APPROVED_SHA??null;let output;
  try{output=buildDeployedOneShotExecutionEvidence(await executeDeployedOneShot(),{approvedSha});}
  catch(error){output=buildDeployedOneShotPreMutationFailure(error,{approvedSha});}
  const outputPath=process.env.API_FOOTBALL_DEPLOYED_ONE_SHOT_EXECUTION_REPORT_PATH;
  if(outputPath)fs.writeFileSync(outputPath,JSON.stringify(output,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({ok:output.ok,classification:output.classification,diagnostic:output.diagnostic,triggerRequests:output.triggerRequests,retryAuthorized:false}));
  return output.ok?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
