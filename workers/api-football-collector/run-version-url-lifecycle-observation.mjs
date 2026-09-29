import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {ATTENDED_ACCEPTANCE_PATH} from './collector.mjs';
import {ATTENDED_VERSION_APPROVED_SHA,deriveVersionPreviewUrl} from './attended-version.mjs';
import {runApiFootballActivationLivePreflight} from './activation-live-preflight.mjs';
import {validateAdmissionHandoff,validateCriticalRecheck} from './run-attended-acceptance.mjs';

export const VERSION_URL_LIFECYCLE_OBSERVATION_VERSION='api-football-version-url-lifecycle-observation-v1';
export const VERSION_URL_LIFECYCLE_MAX_READS=3;
export const VERSION_URL_LIFECYCLE_REQUEST_TIMEOUT_MS=15_000;
const API='https://api.cloudflare.com/client/v4';
const WORKER='teamsheet-api-football-shadow-collector';
const HEX64=/^[0-9a-f]{64}$/;
const fail=code=>{throw new Error(code);};
const required=(env,name)=>typeof env[name]==='string'&&env[name]?env[name]:fail('lifecycle_environment_incomplete');
const digest=value=>createHash('sha256').update(String(value)).digest('hex');
const enc=value=>encodeURIComponent(String(value));
const waitDefault=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const boundedStatus=status=>Number.isInteger(status)&&status>=100&&status<=599?status:null;
const transportOutcome=error=>error?.name==='TimeoutError'||error?.name==='AbortError'?'TIMEOUT':'TRANSPORT_FAILURE';

async function boundedText(response,maxBytes=32){
  const declared=Number(response.headers?.get?.('content-length'));
  if(Number.isFinite(declared)&&declared>maxBytes)return null;
  let text;try{text=await response.text();}catch{return null;}
  return Buffer.byteLength(text)<=maxBytes?text:null;
}

export function lifecycleControlPath(accountId){
  if(typeof accountId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(accountId))fail('lifecycle_account_invalid');
  return `/accounts/${enc(accountId)}/workers/scripts/${WORKER}/subdomain`;
}

export function assertLifecycleControlRequestAllowed(method,requestPath,{accountId}={}){
  if(String(method).toUpperCase()==='POST'&&requestPath===lifecycleControlPath(accountId))return true;
  fail('lifecycle_control_endpoint_forbidden');
}

function expectedMismatch(checks){
  if(!checks.statusMatches)return 'STATUS';
  if(!checks.bodyMatches)return 'BODY';
  if(!checks.cacheControlMatches)return 'CACHE_CONTROL';
  if(!checks.contentTypeMatches)return 'CONTENT_TYPE';
  return null;
}

export function validateLifecycleProbeEvidence(probe){
  const exactKeys=['lastHttpStatus','mismatch','outcome','signatureChecks','workerSignatureProved'];
  if(!probe||typeof probe!=='object'||JSON.stringify(Object.keys(probe).sort())!==JSON.stringify(exactKeys.sort()))return false;
  if(!['HTTP_RESPONSE','TRANSPORT_FAILURE','TIMEOUT'].includes(probe.outcome))return false;
  if(typeof probe.workerSignatureProved!=='boolean')return false;
  if(probe.outcome!=='HTTP_RESPONSE')return probe.lastHttpStatus===null&&probe.mismatch===null&&probe.signatureChecks===null&&probe.workerSignatureProved===false;
  const checks=probe.signatureChecks;
  if(!checks||JSON.stringify(Object.keys(checks).sort())!==JSON.stringify(['bodyMatches','cacheControlMatches','contentTypeMatches','statusMatches']))return false;
  if(!Object.values(checks).every(value=>typeof value==='boolean'))return false;
  const mismatch=expectedMismatch(checks);
  if(!Number.isInteger(probe.lastHttpStatus)||probe.lastHttpStatus<100||probe.lastHttpStatus>599||probe.mismatch!==mismatch||probe.workerSignatureProved!==(mismatch===null))return false;
  return true;
}

export function classifyLifecycleRouting({rootProbe,attendedProbe}={}){
  if(!validateLifecycleProbeEvidence(rootProbe)||!validateLifecycleProbeEvidence(attendedProbe))return 'LIFECYCLE_EVIDENCE_INVALID';
  const root=rootProbe.workerSignatureProved===true,attended=attendedProbe.workerSignatureProved===true;
  if(root&&attended)return 'EXISTING_VERSION_ROUTABLE_BOTH_PATHS';
  if(root)return 'EXISTING_VERSION_ROUTABLE_ROOT_ONLY';
  if(attended)return 'EXISTING_VERSION_ROUTABLE_ATTENDED_PATH_ONLY';
  return 'EXISTING_VERSION_ROUTABILITY_NOT_PROVEN';
}

async function probeVersionUrl(url,{fetchImpl}){
  try{
    const response=await fetchImpl(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(VERSION_URL_LIFECYCLE_REQUEST_TIMEOUT_MS)});
    const body=await boundedText(response);
    const signatureChecks=Object.freeze({
      statusMatches:response.status===404,
      bodyMatches:body==='Not found',
      cacheControlMatches:response.headers.get('cache-control')==='no-store',
      contentTypeMatches:response.headers.get('content-type')?.startsWith('text/plain')===true
    });
    const mismatch=expectedMismatch(signatureChecks);
    return Object.freeze({outcome:'HTTP_RESPONSE',lastHttpStatus:boundedStatus(response.status),mismatch,signatureChecks,workerSignatureProved:mismatch===null});
  }catch(error){
    return Object.freeze({outcome:transportOutcome(error),lastHttpStatus:null,mismatch:null,signatureChecks:null,workerSignatureProved:false});
  }
}

export async function runVersionUrlLifecycleObservation({env=process.env,fetchImpl=globalThis.fetch,criticalRecheck=runApiFootballActivationLivePreflight,wait=waitDefault}={}){
  const account=required(env,'CLOUDFLARE_ACCOUNT_ID'),fingerprint=required(env,'CLOUDFLARE_ACCOUNT_FINGERPRINT');
  const readToken=required(env,'CLOUDFLARE_ATTENDED_READ_TOKEN'),mutationToken=required(env,'CLOUDFLARE_ATTENDED_MUTATION_TOKEN');
  const approvedSha=required(env,'APPROVED_SHA'),versionId=required(env,'API_FOOTBALL_ATTENDED_VERSION_ID');
  const versionApprovedSha=required(env,'API_FOOTBALL_ATTENDED_VERSION_APPROVED_SHA');
  if(env.API_FOOTBALL_ATTENDED_TRIGGER_SECRET)fail('lifecycle_trigger_secret_forbidden');
  if(readToken===mutationToken)fail('lifecycle_credential_separation_required');
  if(!HEX64.test(fingerprint)||digest(account)!==fingerprint)fail('lifecycle_production_account_identity_mismatch');

  const admission=JSON.parse(fs.readFileSync(required(env,'API_FOOTBALL_ATTENDED_ADMISSION_PATH'),'utf8'));
  validateAdmissionHandoff(admission,{approvedSha,versionId,versionApprovedSha,accountFingerprint:fingerprint});
  const critical=await criticalRecheck({env:{
    DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID:account,
    DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT:fingerprint,
    DATA_STEWARD_CLOUDFLARE_READ_TOKEN:readToken,
    API_FOOTBALL_PREFLIGHT_STAGE:'ATTENDED_ACCEPTANCE',
    API_FOOTBALL_ATTENDED_VERSION_ID:versionId,
    API_FOOTBALL_ATTENDED_VERSION_APPROVED_SHA:versionApprovedSha,
    APPROVED_SHA:approvedSha
  },fetchImpl,stage:'ATTENDED_ACCEPTANCE'});
  const previewIdentity=validateCriticalRecheck(critical,{approvedSha,versionId,versionApprovedSha,accountFingerprint:fingerprint});

  let previewEnableAttempted=false,previewEnableSucceeded=false,previewDisableSucceeded=false,previewMutations=0,versionUrlReads=0;
  let rootProbe=null,attendedProbe=null,observationFailure=null;
  const controlPath=lifecycleControlPath(account);
  const setPreview=async enabled=>{
    assertLifecycleControlRequestAllowed('POST',controlPath,{accountId:account});
    let response;try{response=await fetchImpl(API+controlPath,{method:'POST',headers:{Authorization:'Bearer '+mutationToken,'content-type':'application/json','Cloudflare-Workers-Script-Api-Date':'2025-08-01'},body:JSON.stringify({enabled:false,previews_enabled:enabled}),redirect:'error',signal:AbortSignal.timeout(VERSION_URL_LIFECYCLE_REQUEST_TIMEOUT_MS)});}catch{return fail('lifecycle_preview_toggle_transport_ambiguous');}
    let body;try{body=await response.json();}catch{return fail('lifecycle_preview_toggle_response_invalid');}
    if(!response.ok||body?.success!==true)fail('lifecycle_preview_toggle_rejected');
    previewMutations+=1;
  };
  const resolveVersionUrl=async()=>{
    const requestPath=`/accounts/${enc(account)}/workers/workers/${enc(previewIdentity.reviewedWorkerId)}/versions/${enc(versionId)}`;
    for(let read=1;read<=VERSION_URL_LIFECYCLE_MAX_READS;read++){
      versionUrlReads+=1;
      let response;
      try{response=await fetchImpl(API+requestPath,{method:'GET',headers:{Authorization:'Bearer '+readToken,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(VERSION_URL_LIFECYCLE_REQUEST_TIMEOUT_MS)});}
      catch{if(read<VERSION_URL_LIFECYCLE_MAX_READS){await wait(1_000);continue;}fail('lifecycle_version_url_read_transport_ambiguous');}
      let body;try{body=await response.json();}catch{fail('lifecycle_version_url_response_invalid');}
      if(!response.ok||body?.success!==true||body.result?.id!==versionId)fail('lifecycle_version_url_identity_failure');
      const urls=body.result.urls;
      if(Array.isArray(urls)&&urls.length===1&&typeof urls[0]==='string')return urls[0];
      if(!Array.isArray(urls)||urls.length>1||urls.some(url=>typeof url!=='string'))fail('lifecycle_version_url_response_invalid');
      if(read<VERSION_URL_LIFECYCLE_MAX_READS){await wait(1_000);continue;}
    }
    fail('lifecycle_version_url_unavailable');
  };

  try{
    previewEnableAttempted=true;await setPreview(true);previewEnableSucceeded=true;
    const versionUrl=await resolveVersionUrl();
    const rootUrl=deriveVersionPreviewUrl({versionId,versionUrl,previewUrlSuffix:previewIdentity.previewUrlSuffix,accountSubdomain:previewIdentity.accountSubdomain,path:'/'});
    const attendedUrl=deriveVersionPreviewUrl({versionId,versionUrl,previewUrlSuffix:previewIdentity.previewUrlSuffix,accountSubdomain:previewIdentity.accountSubdomain,path:ATTENDED_ACCEPTANCE_PATH});
    rootProbe=await probeVersionUrl(rootUrl,{fetchImpl});
    attendedProbe=await probeVersionUrl(attendedUrl,{fetchImpl});
  }catch(error){
    const known=new Set(['lifecycle_preview_toggle_transport_ambiguous','lifecycle_preview_toggle_response_invalid','lifecycle_preview_toggle_rejected','lifecycle_version_url_read_transport_ambiguous','lifecycle_version_url_response_invalid','lifecycle_version_url_identity_failure','lifecycle_version_url_unavailable','collector_attended_preview_identity_invalid']);
    observationFailure=known.has(error?.message)?error.message:'lifecycle_observation_failed_unknown';
  }finally{
    if(previewEnableAttempted){
      try{await setPreview(false);previewDisableSucceeded=true;}
      catch{previewDisableSucceeded=false;}
    }
  }

  const probesComplete=validateLifecycleProbeEvidence(rootProbe)&&validateLifecycleProbeEvidence(attendedProbe);
  const cleanupSafe=previewEnableSucceeded===false||previewDisableSucceeded===true;
  const ok=probesComplete&&cleanupSafe;
  const routing=probesComplete?classifyLifecycleRouting({rootProbe,attendedProbe}):'LIFECYCLE_OBSERVATION_INCOMPLETE';
  return Object.freeze({
    version:VERSION_URL_LIFECYCLE_OBSERVATION_VERSION,approvedSha,versionId,ok,
    classification:ok?'LIFECYCLE_OBSERVATION_COMPLETE_RECONCILIATION_REQUIRED':'LIFECYCLE_OBSERVATION_RECONCILIATION_REQUIRED',
    reason:ok?'observation_complete_requires_reconciliation':(observationFailure??(cleanupSafe?'observation_incomplete':'preview_cleanup_unproved')),
    routing,versionUrlReads,previewMutations,previewEnableAttempted,previewEnableSucceeded,previewDisableSucceeded,
    rootProbe,attendedProbe,providerRequests:0,d1Mutations:0,versionMutations:0,triggerSecretReads:0,retryAuthorized:false
  });
}

export async function main(){
  let output;
  try{output=await runVersionUrlLifecycleObservation();}
  catch(error){
    const approvedSha=process.env.APPROVED_SHA??null,versionId=process.env.API_FOOTBALL_ATTENDED_VERSION_ID??null;
    output=Object.freeze({version:VERSION_URL_LIFECYCLE_OBSERVATION_VERSION,approvedSha,versionId,ok:false,classification:'LIFECYCLE_OBSERVATION_RECONCILIATION_REQUIRED',reason:'lifecycle_pre_mutation_gate_failed',routing:'LIFECYCLE_OBSERVATION_INCOMPLETE',versionUrlReads:0,previewMutations:0,previewEnableAttempted:false,previewEnableSucceeded:false,previewDisableSucceeded:false,rootProbe:null,attendedProbe:null,providerRequests:0,d1Mutations:0,versionMutations:0,triggerSecretReads:0,retryAuthorized:false});
  }
  const outputPath=process.env.API_FOOTBALL_VERSION_URL_LIFECYCLE_REPORT_PATH;
  if(outputPath)fs.writeFileSync(outputPath,JSON.stringify(output,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({ok:output.ok,classification:output.classification,reason:output.reason,routing:output.routing,retryAuthorized:false}));
  return output.ok?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
