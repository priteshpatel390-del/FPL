// Protected, one-time Gate C executor for the corrected, promoted Version. Repository-only until separately
// authorised live dispatch. No Deployment/Version/Cron/route/domain/Preview mutation. One trigger, cleanup always.
// Reuses the audited continuation orchestration and control-plane mutation allowlist.
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {runApiFootballActivationLivePreflight} from './activation-live-preflight.mjs';
import {deployedOneShotPreflightEnv} from './deployed-one-shot-readonly.mjs';
import {readReplacementRouteTopology} from './replacement-reconciliation.mjs';
import {
  DEPLOYED_ONE_SHOT_CONTINUATION_EXECUTION_VERSION,DEPLOYED_ONE_SHOT_CONTINUATION_MUTATION_CEILINGS,DEPLOYED_ONE_SHOT_EXISTING_DEPLOYMENT_ID,
  DEPLOYED_ONE_SHOT_MAX_D1_CALLS,DEPLOYED_ONE_SHOT_MAX_D1_ROWS_CHANGED,DEPLOYED_ONE_SHOT_MAX_TRIGGER_REQUESTS,DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE,
  DEPLOYED_ONE_SHOT_READINESS_DELAYS_MS,DEPLOYED_ONE_SHOT_REQUEST_TIMEOUT_MS,DEPLOYED_ONE_SHOT_RUNTIME_SQL,DEPLOYED_ONE_SHOT_TRIGGER_TIMEOUT_MS,
  DEPLOYED_ONE_SHOT_WORKER,deriveWorkersDevTarget,
  runDeployedOneShotContinuation,validateDeployedOneShotContinuationAdmissionHandoff,workerSignatureMatches
} from './deployed-one-shot.mjs';
import {boundedText,deployedOneShotCloudflarePaths,deployedOneShotFinalRouteScan,statusClass} from './run-deployed-one-shot.mjs';
import {ATTENDED_TRANSPORT_DIAGNOSTIC_HEADER} from './collector.mjs';
import {isApiFootballTransportDiagnostic} from '../../src/decision-intelligence/api-football-foundation.mjs';
import {PROMOTION_CANDIDATE_VERSION_ID,promotionPostStateExact} from './transport-remediated-deployment-promotion.mjs';
import {readPromotionVersions} from './transport-remediated-deployment-promotion-readonly.mjs';
import {gateCAdmissionDiagnostic,gateCDeploymentDiagnostic,validateGateCAdmissionHandoff,
  GATE_C_EXECUTION_VERSION,GATE_C_ACTIVE_DEPLOYMENT_ID} from './gate-c.mjs';

const API='https://api.cloudflare.com/client/v4';
const HEX40=/^[0-9a-f]{40}$/;
const HEX64=/^[0-9a-f]{64}$/;
const fail=code=>{throw new Error(code);};
const digest=value=>createHash('sha256').update(String(value)).digest('hex');
const delay=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const required=(env,name)=>typeof env[name]==='string'&&env[name]?env[name]:fail('DEPLOYED_ONE_SHOT_ENVIRONMENT_INCOMPLETE');

// Closed endpoint allowlist: Deployment POST is deliberately absent.
export function assertGateCRequestAllowed(method,requestPath,{accountId}={}){
  const paths=deployedOneShotCloudflarePaths(accountId),verb=String(method).toUpperCase();
  if(verb==='POST'&&[paths.subdomain,paths.d1].includes(requestPath))return 'MUTATION';
  if(verb==='GET'&&requestPath===paths.deployments)return 'READ';
  return fail('DEPLOYED_ONE_SHOT_ENDPOINT_FORBIDDEN');
}

export function gateCCriticalRecheckDiagnostic(report,deployments,versions,topology,identity){
  const diagnostic=gateCAdmissionDiagnostic({report,deploymentRows:deployments,versions,topology,
    approvedSha:identity.approvedSha,accountFingerprint:identity.accountFingerprint,utcDay:identity.utcDay});
  return diagnostic?'GATE_C_CRITICAL_STATE_DRIFT__'+diagnostic.toUpperCase():null;
}

export async function executeGateC({env=process.env,fetchImpl=globalThis.fetch,criticalRecheck=runApiFootballActivationLivePreflight,routeScan=readReplacementRouteTopology,wait=delay}={}){
  // Every credential is required before any network request.
  const accountId=required(env,'CLOUDFLARE_ACCOUNT_ID'),fingerprint=required(env,'CLOUDFLARE_ACCOUNT_FINGERPRINT');
  const readToken=required(env,'CLOUDFLARE_ATTENDED_READ_TOKEN'),mutationToken=required(env,'CLOUDFLARE_ATTENDED_MUTATION_TOKEN');
  const approvedSha=required(env,'APPROVED_SHA'),trigger=required(env,'API_FOOTBALL_ATTENDED_TRIGGER_SECRET');
  const topologyToken=required(env,'CLOUDFLARE_TOPOLOGY_READ_TOKEN');
  if(readToken===mutationToken||topologyToken===mutationToken||topologyToken===readToken)fail('DEPLOYED_ONE_SHOT_CREDENTIAL_SEPARATION_REQUIRED');
  if(trigger===readToken||trigger===mutationToken||trigger===topologyToken||trigger.length<32)fail('DEPLOYED_ONE_SHOT_TRIGGER_SECRET_INVALID');
  if(!HEX40.test(approvedSha))fail('DEPLOYED_ONE_SHOT_APPROVED_SHA_INVALID');
  if(!HEX64.test(fingerprint)||digest(accountId)!==fingerprint)fail('DEPLOYED_ONE_SHOT_ACCOUNT_IDENTITY_MISMATCH');
  if(env.GITHUB_RUN_ATTEMPT!=='1')fail('GATE_C_RERUN_FORBIDDEN');
  const admission=JSON.parse(fs.readFileSync(required(env,'API_FOOTBALL_GATE_C_ADMISSION_PATH'),'utf8'));
  const utcDay=new Date().toISOString().slice(0,10);
  validateGateCAdmissionHandoff(admission,{approvedSha,accountFingerprint:fingerprint,utcDay});

  const paths=deployedOneShotCloudflarePaths(accountId);
  const mutations={createDeployment:0,enableWorkersDev:0,disableWorkersDev:0};
  let d1Calls=0,d1RowsChanged=0,triggerRequests=0,readinessAttempts=0,collectionEnableSucceeded=false;
  let deployment={outcome:'NOT_VERIFIED',deploymentId:null,readbackExact:null};
  let readiness={outcome:'NOT_STARTED',attempts:0,lastHttpStatus:null,workerSignatureProved:false};
  const countMutation=kind=>{mutations[kind]+=1;if(mutations[kind]>DEPLOYED_ONE_SHOT_CONTINUATION_MUTATION_CEILINGS[kind])fail('DEPLOYED_ONE_SHOT_MUTATION_CEILING_EXCEEDED');};
  const cloudflare=async(method,requestPath,{body=null,token=mutationToken,headers={}}={})=>{
    assertGateCRequestAllowed(method,requestPath,{accountId});
    let response;
    try{response=await fetchImpl(API+requestPath,{method,headers:{Authorization:'Bearer '+token,Accept:'application/json',...(body===null?{}:{'content-type':'application/json'}),...headers},
      ...(body===null?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(DEPLOYED_ONE_SHOT_REQUEST_TIMEOUT_MS)});}
    catch{return {kind:'AMBIGUOUS'};}
    let payload;try{payload=await response.json();}catch{return {kind:'AMBIGUOUS'};}
    if(response.ok&&payload?.success===true)return {kind:'OK',result:payload.result};
    if(response.status>=400&&response.status<500&&payload?.success===false)return {kind:'REJECTED'};
    return {kind:'AMBIGUOUS'};
  };
  // Fresh Deployment GET: exactly one Deployment, exact ID, exact reviewed Version at 100%. Never repairs, recreates or deletes.
  const readDeployment=async()=>{
    const outcome=await cloudflare('GET',paths.deployments,{token:readToken});
    if(outcome.kind!=='OK')return null;
    const rows=outcome.result?.deployments??outcome.result;
    // Promotion's reader normalises Cloudflare rows and verifies the exact two-row strategy.
    return Array.isArray(rows)?rows.map(row=>({id:row.id,strategy:row.strategy,createdOn:row.created_on??null,
      versions:Array.isArray(row.versions)?row.versions.map(v=>({versionId:v.version_id,percentage:Number(v.percentage)})):[]})):null;
  };

  // Final pre-mutation proof: bound admission, fresh critical state, fresh Deployment GET, fresh authoritative zone route scan.
  const critical=await criticalRecheck({env:deployedOneShotPreflightEnv({accountId,accountFingerprint:fingerprint,readToken,approvedSha}),fetchImpl,stage:DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE});
  const preDeployments=await readDeployment();
  const preVersions=await readPromotionVersions({accountId,readToken,fetchImpl});
  const finalRouteScan=await deployedOneShotFinalRouteScan({accountId,topologyToken,fetchImpl,routeScan});
  const drift=gateCCriticalRecheckDiagnostic(critical,preDeployments,preVersions,finalRouteScan,
    {approvedSha,accountFingerprint:fingerprint,utcDay});
  if(drift)fail(drift);
  const target=deriveWorkersDevTarget({accountSubdomain:critical.inventory.accountSubdomain});

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

  const result=await runDeployedOneShotContinuation({admissionValid:true,ops:{
    verifyDeployment:async()=>{
      const state=await readDeployment();
      const exact=gateCDeploymentDiagnostic(state,critical)===null&&promotionPostStateExact(state);
      deployment={outcome:exact?'CORRECTED_VERIFIED':'CORRECTED_MISMATCH',deploymentId:exact?GATE_C_ACTIVE_DEPLOYMENT_ID:null,readbackExact:exact};
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
      if(new Date().toISOString().slice(0,10)!==admission.utcDay)fail('GATE_C_UTC_DAY_CHANGED_BEFORE_TRIGGER');
      if(triggerRequests>=DEPLOYED_ONE_SHOT_MAX_TRIGGER_REQUESTS)fail('DEPLOYED_ONE_SHOT_SECOND_TRIGGER_FORBIDDEN');
      triggerRequests+=1;
      let response;
      try{response=await fetchImpl(target,{method:'POST',headers:{'x-teamsheet-attended-trigger':trigger},redirect:'error',signal:AbortSignal.timeout(DEPLOYED_ONE_SHOT_TRIGGER_TIMEOUT_MS)});}
      catch{return {requestCount:1,outcome:'AMBIGUOUS',diagnostic:'DEPLOYED_ONE_SHOT_TRIGGER_TRANSPORT_AMBIGUOUS'};}
      const body=await boundedText(response);
      if(response.status===202&&body==='Accepted')return {requestCount:1,outcome:'ACCEPTED',diagnostic:'DEPLOYED_ONE_SHOT_WORKER_ACCEPTED'};
      if(response.status===404&&body==='Not found')return {requestCount:1,outcome:'REJECTED',diagnostic:'DEPLOYED_ONE_SHOT_TRIGGER_REJECTED'};
      if(response.status===409&&body==='Not accepted'){
        // Closed allowlist only: any other header value (or none) records null, never remote text.
        let headerValue=null;try{headerValue=response.headers?.get?.(ATTENDED_TRANSPORT_DIAGNOSTIC_HEADER)??null;}catch{headerValue=null;}
        const providerTransportDiagnostic=isApiFootballTransportDiagnostic(headerValue)?headerValue:null;
        return {requestCount:1,outcome:'REJECTED',diagnostic:'DEPLOYED_ONE_SHOT_COLLECTION_NOT_ACCEPTED',providerTransportDiagnostic};
      }
      return {requestCount:1,outcome:'REJECTED',diagnostic:`DEPLOYED_ONE_SHOT_TRIGGER_HTTP_${statusClass(response.status)}`};
    },
    disableCollection:()=>runtime(DEPLOYED_ONE_SHOT_RUNTIME_SQL.disable,'DISABLE'),
    disableWorkersDev:()=>subdomain(false)
  }});
  return Object.freeze({...result,approvedSha,finalRouteScan,deployment:Object.freeze({...deployment}),readiness:Object.freeze({...readiness}),
    triggerRequests,collectionEnableSucceeded,mutations:Object.freeze({...mutations}),controlBudget:Object.freeze({d1Calls,d1RowsChanged})});
}

export function buildGateCExecutionEvidence(result,{approvedSha=null}={}){
  if(![0,1].includes(result?.triggerRequests))fail('DEPLOYED_ONE_SHOT_TRIGGER_ACCOUNTING_INVALID');
  return Object.freeze({
    version:GATE_C_EXECUTION_VERSION,approvedSha,versionId:PROMOTION_CANDIDATE_VERSION_ID,ok:result.ok===true,
    classification:result.classification??null,diagnostic:result.diagnostic??null,primaryFailure:result.primaryFailure??null,cleanupFailure:result.cleanupFailure??null,
    stagesReached:result.stagesReached??[],finalRouteScan:result.finalRouteScan??null,deployment:result.deployment??null,readiness:result.readiness??null,
    triggerRequests:result.triggerRequests,trigger:result.trigger??null,collectionEnableSucceeded:result.collectionEnableSucceeded===true,
    cleanup:result.cleanup??null,mutations:result.mutations??null,controlBudget:result.controlBudget??null,retryAuthorized:false,
    evidence:Object.freeze({apiFootballRequestsByExecutor:0,secretValuesSerialized:0})
  });
}

export function buildGateCPreMutationFailure(error,{approvedSha=null}={}){
  const message=String(error?.message??'');
  return Object.freeze({version:GATE_C_EXECUTION_VERSION,approvedSha,versionId:PROMOTION_CANDIDATE_VERSION_ID,ok:false,
    classification:'DEPLOYED_ONE_SHOT_STOPPED_BEFORE_MUTATION',diagnostic:/^DEPLOYED_ONE_SHOT_[A-Z0-9_]{1,128}$/.test(message)?message:'DEPLOYED_ONE_SHOT_UNEXPECTED_FAILURE',
    primaryFailure:null,cleanupFailure:null,stagesReached:[],finalRouteScan:null,deployment:{outcome:'NOT_VERIFIED',deploymentId:null,readbackExact:null},readiness:null,
    triggerRequests:0,trigger:null,collectionEnableSucceeded:false,cleanup:null,mutations:{createDeployment:0,enableWorkersDev:0,disableWorkersDev:0},
    controlBudget:{d1Calls:0,d1RowsChanged:0},retryAuthorized:false,evidence:{apiFootballRequestsByExecutor:0,secretValuesSerialized:0}});
}

export async function main(){
  const approvedSha=process.env.APPROVED_SHA??null;let output;
  try{output=buildGateCExecutionEvidence(await executeGateC(),{approvedSha});}
  catch(error){output=buildGateCPreMutationFailure(error,{approvedSha});}
  const outputPath=process.env.API_FOOTBALL_GATE_C_EXECUTION_REPORT_PATH;
  if(outputPath)fs.writeFileSync(outputPath,JSON.stringify(output,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({ok:output.ok,classification:output.classification,diagnostic:output.diagnostic,triggerRequests:output.triggerRequests,retryAuthorized:false}));
  return output.ok?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
