import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {ATTENDED_ACCEPTANCE_PATH} from './collector.mjs';
import {MutationAmbiguousError,MutationRejectedError} from './stage-inactive-version.mjs';
import {probeVersionUrl} from './run-version-url-lifecycle-observation.mjs';
import {
  REPLACEMENT_COLLECTOR,REPLACEMENT_RECOVERY_WORKER_ID,buildReplacementUploadForm,replacementPaths,
  validateReplacementProbe
} from './replacement-foundation.mjs';
import {readReplacementState} from './replacement-reconciliation.mjs';

export const REPLACEMENT_RECOVERY_VERSION='api-football-replacement-shell-recovery-v1';
export const REPLACEMENT_RECOVERY_MUTATION_CEILINGS=Object.freeze({enablePreview:1,uploadVersion:1,disablePreview:1});
export const REPLACEMENT_RECOVERY_CLASSIFICATIONS=Object.freeze({
  success:'REPLACEMENT_SHELL_RECOVERY_RECONCILIATION_REQUIRED',
  safeStop:'REPLACEMENT_SHELL_RECOVERY_CLEAN_SAFE_STOP',
  ownerAttention:'REPLACEMENT_SHELL_RECOVERY_OWNER_ATTENTION_REQUIRED'
});
const API='https://api.cloudflare.com/client/v4';
const HEX40=/^[0-9a-f]{40}$/;
const HEX64=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=code=>{throw new Error(code);};
const digest=value=>createHash('sha256').update(String(value)).digest('hex');
const enc=value=>encodeURIComponent(String(value));
const knownFailure=error=>{
  const message=String(error?.message??'');
  if(/^replacement_recovery_[A-Za-z0-9_]{1,96}$/.test(message))return message;
  if(/^replacement_reconciliation_[A-Za-z0-9_]{1,96}$/.test(message))return 'replacement_recovery_state_'+message.slice('replacement_reconciliation_'.length);
  return 'replacement_recovery_failed_unknown';
};

export function validateRecoveryShellState(state,{preview=false}={}){
  if(state?.present!==true||state.workerName!==REPLACEMENT_COLLECTOR||state.workerId!==REPLACEMENT_RECOVERY_WORKER_ID||
    state.workersDev!==false||state.previewUrls!==preview||state.versionCount!==0||state.versionInventoryExact!==true||
    state.deploymentCount!==0||state.cronCount!==0||state.routeCount!==0||state.customDomainCount!==0)fail('replacement_recovery_shell_state_invalid');
  return true;
}

export function recoveryMutationKind(method,requestPath,{accountId,body}={}){
  const paths=replacementPaths(accountId),verb=String(method).toUpperCase();
  if(verb==='POST'&&requestPath===paths.replacementUpload)return 'uploadVersion';
  if(verb==='POST'&&requestPath===paths.replacementSubdomain){
    if(JSON.stringify(body)===JSON.stringify({enabled:false,previews_enabled:true}))return 'enablePreview';
    if(JSON.stringify(body)===JSON.stringify({enabled:false,previews_enabled:false}))return 'disablePreview';
    fail('replacement_recovery_preview_body_invalid');
  }
  fail('replacement_recovery_mutation_forbidden');
}

function createRequester({accountId,readToken,mutationToken,fetchImpl}){
  if(typeof readToken!=='string'||!readToken||typeof mutationToken!=='string'||!mutationToken||readToken===mutationToken)fail('replacement_recovery_credential_separation_required');
  const counts={enablePreview:0,uploadVersion:0,disablePreview:0};
  const request=async(requestPath,{method='GET',body,multipart}={})=>{
    const verb=String(method).toUpperCase(),mutation=verb!=='GET';let kind=null;
    if(mutation){
      kind=recoveryMutationKind(verb,requestPath,{accountId,body});
      if(counts[kind]>=REPLACEMENT_RECOVERY_MUTATION_CEILINGS[kind])fail('replacement_recovery_mutation_ceiling_'+kind);
      counts[kind]+=1;
    }
    const headers={Authorization:'Bearer '+(mutation?mutationToken:readToken),Accept:'application/json'};
    let requestBody;
    if(multipart)requestBody=multipart;
    else if(body!==undefined){headers['content-type']='application/json';requestBody=JSON.stringify(body);}
    let response,text;
    try{response=await fetchImpl(API+requestPath,{method:verb,headers,body:requestBody,redirect:'error',signal:AbortSignal.timeout(20_000)});text=await response.text();}
    catch{if(mutation)throw new MutationAmbiguousError('replacement_recovery_mutation_transport_ambiguous_'+kind);fail('replacement_recovery_read_transport_failed');}
    let payload;try{payload=JSON.parse(text);}catch{if(mutation)throw new MutationAmbiguousError('replacement_recovery_mutation_response_invalid_'+kind);fail('replacement_recovery_read_response_invalid');}
    if(mutation&&response.status>=400&&response.status<500)throw new MutationRejectedError('replacement_recovery_mutation_rejected_'+kind);
    if(mutation&&(response.status>=500||payload?.success!==true))throw new MutationAmbiguousError('replacement_recovery_mutation_ambiguous_'+kind);
    if(!mutation&&(!response.ok||payload?.success!==true))fail('replacement_recovery_read_failed');
    return payload.result;
  };
  return Object.freeze({request,counts});
}

async function readState({account,readToken,approvedSha,versionId=null,fetchImpl}){
  return readReplacementState({account,token:readToken,versionId,approvedSha,fetchImpl});
}
function validateOneVersionState(state,{versionId,preview}={}){
  if(state?.present!==true||state.workerName!==REPLACEMENT_COLLECTOR||state.workerId!==REPLACEMENT_RECOVERY_WORKER_ID||
    state.workersDev!==false||state.previewUrls!==preview||state.versionId!==versionId||state.versionCount!==1||
    state.versionInventoryExact!==true||state.versionIdentityExact!==true||state.deploymentCount!==0||
    state.cronCount!==0||state.routeCount!==0||state.customDomainCount!==0)fail('replacement_recovery_version_state_invalid');
  return true;
}

export async function runReplacementRecoveryAdmission({env=process.env,fetchImpl=globalThis.fetch}={}){
  const account=env.CLOUDFLARE_ACCOUNT_ID,fingerprint=env.CLOUDFLARE_ACCOUNT_FINGERPRINT,approvedSha=env.APPROVED_SHA,readToken=env.CLOUDFLARE_REPLACEMENT_READ_TOKEN;
  if(typeof account!=='string'||!account||!HEX64.test(String(fingerprint||''))||digest(account)!==fingerprint||!HEX40.test(String(approvedSha||''))||typeof readToken!=='string'||!readToken)fail('replacement_recovery_admission_identity_invalid');
  const state=await readState({account,readToken,approvedSha,fetchImpl});
  validateRecoveryShellState(state,{preview:false});
  return Object.freeze({ok:true,approvedSha,replacementWorker:REPLACEMENT_COLLECTOR,workerId:REPLACEMENT_RECOVERY_WORKER_ID,replacementState:'SHELL_ONLY',
    scriptPresent:state.scriptPresent,versionCount:0,workersDev:false,previewUrls:false,deploymentCount:0,cronCount:0,routeCount:0,customDomainCount:0,
    productionMutations:0,apiFootballRequests:0,secretValuesRead:0,retryAuthorized:false});
}

async function resolveVersionUrl(request,paths,{versionId,accountSubdomain}){
  const detail=await request(paths.createShell+'/'+enc(REPLACEMENT_RECOVERY_WORKER_ID)+'/versions/'+enc(versionId));
  if(detail?.id!==versionId||!Array.isArray(detail.urls)||detail.urls.length!==1||typeof detail.urls[0]!=='string')fail('replacement_recovery_version_url_unavailable');
  let url;try{url=new URL(detail.urls[0]);}catch{return fail('replacement_recovery_version_url_invalid');}
  const suffix='-'+REPLACEMENT_COLLECTOR+'.'+accountSubdomain+'.workers.dev';
  if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash||url.username||url.password||url.port||url.hostname!==versionId.slice(0,8)+suffix)fail('replacement_recovery_version_url_invalid');
  return url;
}

async function enablePreview({request,account,readToken,approvedSha,fetchImpl,paths}){
  try{await request(paths.replacementSubdomain,{method:'POST',body:{enabled:false,previews_enabled:true}});}
  catch(error){
    if(!(error instanceof MutationRejectedError)&&!(error instanceof MutationAmbiguousError))throw error;
    const state=await readState({account,readToken,approvedSha,fetchImpl});
    try{validateRecoveryShellState(state,{preview:true});return Object.freeze({disposition:'RECONCILED',enabled:true});}catch{}
    validateRecoveryShellState(state,{preview:false});
    return Object.freeze({disposition:error instanceof MutationRejectedError?'REJECTED':'RECONCILED_UNAPPLIED',enabled:false});
  }
  const state=await readState({account,readToken,approvedSha,fetchImpl});validateRecoveryShellState(state,{preview:true});
  return Object.freeze({disposition:'DEFINITE',enabled:true});
}

async function readPreviewState({request,paths}){
  let workers,subdomain;
  try{workers=await request(paths.betaWorkers);subdomain=await request(paths.replacementSubdomain);}catch{return null;}
  const matches=Array.isArray(workers)?workers.filter(row=>row?.name===REPLACEMENT_COLLECTOR):[];
  if(matches.length!==1||matches[0]?.id!==REPLACEMENT_RECOVERY_WORKER_ID)return null;
  return Object.freeze({workersDev:subdomain?.enabled!==false,previewUrls:subdomain?.previews_enabled!==false});
}
async function restorePreviewDisabled({request,paths}){
  const before=await readPreviewState({request,paths});
  if(before?.workersDev===false&&before?.previewUrls===false)return Object.freeze({disposition:'ALREADY_DISABLED',disabled:true});
  try{await request(paths.replacementSubdomain,{method:'POST',body:{enabled:false,previews_enabled:false}});}
  catch(error){
    if(!(error instanceof MutationRejectedError)&&!(error instanceof MutationAmbiguousError))return Object.freeze({disposition:'UNRESOLVED',disabled:false});
    const after=await readPreviewState({request,paths});
    return after?.workersDev===false&&after?.previewUrls===false?
      Object.freeze({disposition:'RECONCILED',disabled:true}):Object.freeze({disposition:'UNRESOLVED',disabled:false});
  }
  const after=await readPreviewState({request,paths});
  return after?.workersDev===false&&after?.previewUrls===false?
    Object.freeze({disposition:'DEFINITE',disabled:true}):Object.freeze({disposition:'UNRESOLVED',disabled:false});
}

export async function runReplacementShellRecovery({env=process.env,fetchImpl=globalThis.fetch}={}){
  const account=env.CLOUDFLARE_ACCOUNT_ID,fingerprint=env.CLOUDFLARE_ACCOUNT_FINGERPRINT,approvedSha=env.APPROVED_SHA;
  if(typeof account!=='string'||!account||!HEX64.test(String(fingerprint||''))||digest(account)!==fingerprint||!HEX40.test(String(approvedSha||'')))fail('replacement_recovery_execution_identity_invalid');
  if(env.API_FOOTBALL_ATTENDED_TRIGGER_HEADER)fail('replacement_recovery_trigger_header_forbidden');
  const readToken=env.CLOUDFLARE_REPLACEMENT_READ_TOKEN,mutationToken=env.CLOUDFLARE_REPLACEMENT_MUTATION_TOKEN;
  const apiKey=env.API_FOOTBALL_API_KEY,triggerSecret=env.API_FOOTBALL_ATTENDED_TRIGGER_SECRET;
  const paths=replacementPaths(account),{request,counts}=createRequester({accountId:account,readToken,mutationToken,fetchImpl});
  validateRecoveryShellState(await readState({account,readToken,approvedSha,fetchImpl}),{preview:false});
  const accountSubdomain=(await request(paths.accountSubdomain))?.subdomain;
  if(typeof accountSubdomain!=='string'||!/^[a-z0-9-]+$/.test(accountSubdomain))fail('replacement_recovery_account_subdomain_invalid');

  let enableDisposition=null,versionDisposition=null,versionId=null,rootProbe=null,attendedProbe=null,routingProved=false,failure=null;
  try{
    const enabled=await enablePreview({request,account,readToken,approvedSha,fetchImpl,paths});enableDisposition=enabled.disposition;
    if(!enabled.enabled){
      failure=enabled.disposition==='REJECTED'?'replacement_recovery_preview_enable_rejected':'replacement_recovery_preview_enable_unapplied';
      throw new Error(failure);
    }
    const form=buildReplacementUploadForm(approvedSha,{apiKey,triggerSecret});
    try{
      const uploaded=await request(paths.replacementUpload,{method:'POST',multipart:form});versionId=uploaded?.id;
      if(!UUID.test(String(versionId||''))){versionId=null;versionDisposition='UNRESOLVED';fail('replacement_recovery_version_identity_invalid');}
      versionDisposition='DEFINITE';
    }catch(error){
      if(error instanceof MutationRejectedError){versionDisposition='REJECTED';throw new Error('replacement_recovery_version_upload_rejected');}
      if(!(error instanceof MutationAmbiguousError)){versionDisposition='UNRESOLVED';throw error;}
      const current=await readState({account,readToken,approvedSha,fetchImpl});
      if(current.versionCount===0){versionDisposition='RECONCILED_ABSENT';throw new Error('replacement_recovery_version_upload_reconciled_absent');}
      if(current.versionCount!==1||current.versionIds.length!==1){versionDisposition='UNRESOLVED';throw error;}
      versionId=current.versionIds[0];versionDisposition='RECONCILED';
    }
    validateOneVersionState(await readState({account,readToken,approvedSha,versionId,fetchImpl}),{versionId,preview:true});
    const base=await resolveVersionUrl(request,paths,{versionId,accountSubdomain});
    rootProbe=await probeVersionUrl(new URL('/',base),{fetchImpl});
    attendedProbe=await probeVersionUrl(new URL(ATTENDED_ACCEPTANCE_PATH,base),{fetchImpl});
    if(!validateReplacementProbe(rootProbe)||!validateReplacementProbe(attendedProbe))fail('replacement_recovery_routing_signature_not_proved');
    routingProved=true;
  }catch(error){if(failure===null)failure=knownFailure(error);}

  const previewCleanup=await restorePreviewDisabled({request,paths});
  let replacementState=null,finalStateReason=null;
  try{
    if(!previewCleanup.disabled)fail('replacement_recovery_preview_cleanup_unresolved');
    if(typeof versionId==='string'){
      validateOneVersionState(await readState({account,readToken,approvedSha,versionId,fetchImpl}),{versionId,preview:false});replacementState='ONE_VERSION';
    }else{
      validateRecoveryShellState(await readState({account,readToken,approvedSha,fetchImpl}),{preview:false});replacementState='SHELL_ONLY';
    }
  }catch(error){finalStateReason=knownFailure(error);replacementState=null;}

  const complete=failure===null&&routingProved&&previewCleanup.disabled&&replacementState==='ONE_VERSION'&&counts.enablePreview===1&&counts.uploadVersion===1&&counts.disablePreview<=1;
  const safeStop=!complete&&failure!==null&&replacementState!==null&&previewCleanup.disabled;
  const classification=complete?REPLACEMENT_RECOVERY_CLASSIFICATIONS.success:safeStop?REPLACEMENT_RECOVERY_CLASSIFICATIONS.safeStop:REPLACEMENT_RECOVERY_CLASSIFICATIONS.ownerAttention;
  return Object.freeze({version:REPLACEMENT_RECOVERY_VERSION,approvedSha,replacementWorker:REPLACEMENT_COLLECTOR,workerId:REPLACEMENT_RECOVERY_WORKER_ID,versionId,
    classification,reason:complete?'replacement_recovery_routing_proved_and_preview_disabled':failure??finalStateReason??'replacement_recovery_final_state_unproved',
    complete,safeStop,routingProved,replacementState,finalStateReason,enableDisposition,versionDisposition,rootProbe,attendedProbe,
    previewCleanup:previewCleanup.disposition,previewDisabled:previewCleanup.disabled,mutationCounts:Object.freeze({...counts}),
    createShellMutations:0,deploymentsCreated:0,workersDevEnabled:0,cronRouteDomainMutations:0,accessMutations:0,d1Mutations:0,providerRequests:0,triggerHeaderRequests:0,retryAuthorized:false});
}

export async function main(){
  let report;
  try{report=await runReplacementShellRecovery();}
  catch(error){report={version:REPLACEMENT_RECOVERY_VERSION,approvedSha:process.env.APPROVED_SHA??null,replacementWorker:REPLACEMENT_COLLECTOR,workerId:REPLACEMENT_RECOVERY_WORKER_ID,versionId:null,
    classification:REPLACEMENT_RECOVERY_CLASSIFICATIONS.ownerAttention,reason:knownFailure(error),complete:false,safeStop:false,routingProved:false,replacementState:null,finalStateReason:null,
    enableDisposition:null,versionDisposition:null,rootProbe:null,attendedProbe:null,previewCleanup:'NOT_REQUIRED',previewDisabled:false,mutationCounts:{enablePreview:0,uploadVersion:0,disablePreview:0},
    createShellMutations:0,deploymentsCreated:0,workersDevEnabled:0,cronRouteDomainMutations:0,accessMutations:0,d1Mutations:0,providerRequests:0,triggerHeaderRequests:0,retryAuthorized:false};}
  if(process.env.API_FOOTBALL_REPLACEMENT_RECOVERY_REPORT_PATH)fs.writeFileSync(process.env.API_FOOTBALL_REPLACEMENT_RECOVERY_REPORT_PATH,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({classification:report.classification,reason:report.reason,complete:report.complete,safeStop:report.safeStop,replacementState:report.replacementState,previewDisabled:report.previewDisabled,retryAuthorized:false}));
  return report.complete?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
