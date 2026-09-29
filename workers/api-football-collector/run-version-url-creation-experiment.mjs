import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {ATTENDED_ACCEPTANCE_PATH} from './collector.mjs';
import {
  ATTENDED_VERSION_APPROVED_SHA,ATTENDED_VERSION_ID,ORIGINAL_BLOCKED_VERSION_ID,
  buildLifecycleCloneIdentity,buildLifecycleCloneVersionUploadForm,deriveVersionPreviewUrl,validateLifecycleCloneVersion
} from './attended-version.mjs';
import {
  MutationAmbiguousError,MutationRejectedError,WORKER_NAME,extractVersionIds,performVersionUpload
} from './stage-inactive-version.mjs';
import {validateAdmissionHandoff} from './run-attended-acceptance.mjs';
import {
  VERSION_URL_LIFECYCLE_MAX_READS,classifyLifecycleRouting,probeVersionUrl,validateLifecycleProbeEvidence
} from './run-version-url-lifecycle-observation.mjs';

export const VERSION_URL_CREATION_EXPERIMENT_VERSION='api-football-version-url-creation-experiment-v1';
export const VERSION_URL_CREATION_EXPERIMENT_TIMEOUT_MS=20_000;
const API='https://api.cloudflare.com/client/v4';
const HEX40=/^[0-9a-f]{40}$/;
const HEX64=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=code=>{throw new Error(code);};
const required=(env,name)=>typeof env[name]==='string'&&env[name]?env[name]:fail('lifecycle_creation_environment_incomplete');
const digest=value=>createHash('sha256').update(String(value)).digest('hex');
const enc=value=>encodeURIComponent(String(value));
const waitDefault=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));

export function lifecycleCreationPaths(accountId){
  if(typeof accountId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(accountId))fail('lifecycle_creation_account_invalid');
  const base='/accounts/'+enc(accountId);
  return Object.freeze({
    subdomain:base+'/workers/scripts/'+WORKER_NAME+'/subdomain',
    versions:base+'/workers/scripts/'+WORKER_NAME+'/versions',
    betaWorkers:base+'/workers/workers'
  });
}

export function assertLifecycleCreationMutationAllowed(method,requestPath,{accountId}={}){
  const paths=lifecycleCreationPaths(accountId),verb=String(method).toUpperCase();
  if(verb==='POST'&&(requestPath===paths.subdomain||requestPath===paths.versions))return true;
  fail('lifecycle_creation_mutation_endpoint_forbidden');
}

function exactTwoVersionStart(ids){
  return Array.isArray(ids)&&ids.length===2&&new Set(ids).size===2&&
    ids.includes(ORIGINAL_BLOCKED_VERSION_ID)&&ids.includes(ATTENDED_VERSION_ID);
}

function experimentComparison(oldRouting,cloneRouting){
  if(oldRouting==='EXISTING_VERSION_ROUTABILITY_NOT_PROVEN'&&cloneRouting==='EXISTING_VERSION_ROUTABLE_BOTH_PATHS')return 'OLD_NOT_PROVEN_NEW_ROUTABLE_BOTH_PATHS';
  if(oldRouting===cloneRouting)return 'OLD_AND_NEW_ROUTING_CLASSIFICATION_MATCH';
  return 'OLD_AND_NEW_ROUTING_CLASSIFICATION_DIFFER';
}

export async function runVersionUrlCreationExperiment({env=process.env,fetchImpl=globalThis.fetch,wait=waitDefault}={}){
  const account=required(env,'CLOUDFLARE_ACCOUNT_ID'),fingerprint=required(env,'CLOUDFLARE_ACCOUNT_FINGERPRINT');
  const token=required(env,'CLOUDFLARE_ATTENDED_VERSION_UPLOAD_TOKEN'),approvedSha=required(env,'APPROVED_SHA');
  const apiKey=required(env,'API_FOOTBALL_API_KEY'),triggerSecret=required(env,'API_FOOTBALL_ATTENDED_TRIGGER_SECRET');
  const admissionPath=required(env,'API_FOOTBALL_ATTENDED_ADMISSION_PATH');
  if(!HEX40.test(approvedSha)||!HEX64.test(fingerprint)||digest(account)!==fingerprint)fail('lifecycle_creation_identity_invalid');
  const admission=JSON.parse(fs.readFileSync(admissionPath,'utf8'));
  validateAdmissionHandoff(admission,{approvedSha,versionId:ATTENDED_VERSION_ID,versionApprovedSha:ATTENDED_VERSION_APPROVED_SHA,accountFingerprint:fingerprint});
  const previewIdentity=admission.inventory||{};
  if(previewIdentity.previewUrlIdentityExact!==true||typeof previewIdentity.previewUrlSuffix!=='string'||typeof previewIdentity.accountSubdomain!=='string'||typeof previewIdentity.reviewedWorkerId!=='string'||
    previewIdentity.previewUrlSuffix!=='-'+WORKER_NAME+'.'+previewIdentity.accountSubdomain+'.workers.dev')fail('lifecycle_creation_preview_identity_invalid');

  const cloneIdentity=buildLifecycleCloneIdentity(approvedSha);
  const cloneForm=buildLifecycleCloneVersionUploadForm(approvedSha,{apiKey,triggerSecret});
  const paths=lifecycleCreationPaths(account);
  let previewEnableAttempted=false,previewEnableSucceeded=false,previewDisableSucceeded=false;
  let previewMutationSubmissions=0,versionMutationSubmissions=0,cloneVersionId=null,versionUploadDisposition=null;
  let oldVersionUrlReads=0,cloneVersionUrlReads=0,oldRootProbe=null,oldAttendedProbe=null,cloneRootProbe=null,cloneAttendedProbe=null;
  let failure=null;

  const request=async(requestPath,{method='GET',body,multipart}={})=>{
    const verb=String(method).toUpperCase(),mutation=verb!=='GET';
    if(mutation){
      assertLifecycleCreationMutationAllowed(verb,requestPath,{accountId:account});
      if(requestPath===paths.versions)versionMutationSubmissions+=1;
      if(requestPath===paths.subdomain)previewMutationSubmissions+=1;
    }
    const headers={Authorization:'Bearer '+token,Accept:'application/json'};let requestBody;
    if(multipart)requestBody=multipart;
    else if(body!==undefined){headers['content-type']='application/json';requestBody=JSON.stringify(body);}
    let response,text;
    try{
      response=await fetchImpl(API+requestPath,{method:verb,headers,body:requestBody,redirect:'error',signal:AbortSignal.timeout(VERSION_URL_CREATION_EXPERIMENT_TIMEOUT_MS)});
      text=await response.text();
    }catch{
      if(mutation)throw new MutationAmbiguousError('lifecycle_creation_mutation_transport_ambiguous');
      fail('lifecycle_creation_read_transport_failed');
    }
    let payload;try{payload=JSON.parse(text);}catch{
      if(mutation)throw new MutationAmbiguousError('lifecycle_creation_mutation_response_invalid');
      fail('lifecycle_creation_read_response_invalid');
    }
    if(mutation&&response.status>=400&&response.status<500)throw new MutationRejectedError('lifecycle_creation_mutation_rejected_'+response.status);
    if(mutation&&(response.status>=500||payload?.success!==true))throw new MutationAmbiguousError('lifecycle_creation_mutation_ambiguous');
    if(!mutation&&(response.status<200||response.status>=300||payload?.success!==true))fail('lifecycle_creation_read_failed');
    return Object.freeze({result:payload.result,status:response.status});
  };

  const readVersions=async()=>{
    const result=(await request(paths.versions+'?deployable=true')).result;
    return extractVersionIds(result);
  };
  const setPreview=async enabled=>{
    await request(paths.subdomain,{method:'POST',body:{enabled:false,previews_enabled:enabled}});
  };
  const readVersion=async versionId=>(await request(paths.versions+'/'+enc(versionId))).result;
  const readBetaVersion=async versionId=>(await request(paths.betaWorkers+'/'+enc(previewIdentity.reviewedWorkerId)+'/versions/'+enc(versionId)+'?include=modules')).result;

  const resolveVersionUrl=async(versionId,counter)=>{
    const requestPath=paths.betaWorkers+'/'+enc(previewIdentity.reviewedWorkerId)+'/versions/'+enc(versionId);
    for(let read=1;read<=VERSION_URL_LIFECYCLE_MAX_READS;read++){
      counter.count+=1;
      const result=(await request(requestPath)).result;
      if(result?.id!==versionId)fail('lifecycle_creation_version_url_identity_failure');
      const urls=result.urls;
      if(Array.isArray(urls)&&urls.length===1&&typeof urls[0]==='string')return urls[0];
      if(!Array.isArray(urls)||urls.length>1||urls.some(url=>typeof url!=='string'))fail('lifecycle_creation_version_url_response_invalid');
      if(read<VERSION_URL_LIFECYCLE_MAX_READS)await wait(1_000);
    }
    fail('lifecycle_creation_version_url_unavailable');
  };

  try{
    const startSubdomain=(await request(paths.subdomain)).result;
    const beforeIds=await readVersions();
    if(startSubdomain?.enabled!==false||startSubdomain?.previews_enabled!==false||!exactTwoVersionStart(beforeIds))fail('lifecycle_creation_start_state_drift');

    previewEnableAttempted=true;
    await setPreview(true);
    previewEnableSucceeded=true;

    const upload=await performVersionUpload({request,readVersions,accountId:account,multipart:cloneForm,beforeIds});
    cloneVersionId=upload.versionId;versionUploadDisposition=upload.disposition;
    if(!UUID.test(cloneVersionId)||cloneVersionId===ATTENDED_VERSION_ID||cloneVersionId===ORIGINAL_BLOCKED_VERSION_ID||upload.afterIds.length!==3)fail('lifecycle_creation_version_delta_invalid');

    const [cloneStable,cloneBeta]=await Promise.all([readVersion(cloneVersionId),readBetaVersion(cloneVersionId)]);
    validateLifecycleCloneVersion({stableVersion:cloneStable,betaVersion:cloneBeta,versionId:cloneVersionId,identity:cloneIdentity});

    const oldCounter={count:0},cloneCounter={count:0};
    const [oldVersionUrl,cloneVersionUrl]=await Promise.all([
      resolveVersionUrl(ATTENDED_VERSION_ID,oldCounter),
      resolveVersionUrl(cloneVersionId,cloneCounter)
    ]);
    oldVersionUrlReads=oldCounter.count;cloneVersionUrlReads=cloneCounter.count;
    const urls={
      oldRoot:deriveVersionPreviewUrl({versionId:ATTENDED_VERSION_ID,versionUrl:oldVersionUrl,previewUrlSuffix:previewIdentity.previewUrlSuffix,accountSubdomain:previewIdentity.accountSubdomain,path:'/'}),
      oldAttended:deriveVersionPreviewUrl({versionId:ATTENDED_VERSION_ID,versionUrl:oldVersionUrl,previewUrlSuffix:previewIdentity.previewUrlSuffix,accountSubdomain:previewIdentity.accountSubdomain,path:ATTENDED_ACCEPTANCE_PATH}),
      cloneRoot:deriveVersionPreviewUrl({versionId:cloneVersionId,versionUrl:cloneVersionUrl,previewUrlSuffix:previewIdentity.previewUrlSuffix,accountSubdomain:previewIdentity.accountSubdomain,path:'/'}),
      cloneAttended:deriveVersionPreviewUrl({versionId:cloneVersionId,versionUrl:cloneVersionUrl,previewUrlSuffix:previewIdentity.previewUrlSuffix,accountSubdomain:previewIdentity.accountSubdomain,path:ATTENDED_ACCEPTANCE_PATH})
    };
    [oldRootProbe,oldAttendedProbe,cloneRootProbe,cloneAttendedProbe]=await Promise.all([
      probeVersionUrl(urls.oldRoot,{fetchImpl}),probeVersionUrl(urls.oldAttended,{fetchImpl}),
      probeVersionUrl(urls.cloneRoot,{fetchImpl}),probeVersionUrl(urls.cloneAttended,{fetchImpl})
    ]);
  }catch(error){
    const known=new Set([
      'lifecycle_creation_start_state_drift','lifecycle_creation_version_delta_invalid','collector_lifecycle_clone_source_drift',
      'collector_lifecycle_clone_identity_invalid','collector_attended_version_identity_drift','collector_attended_runtime_drift',
      'collector_attended_binding_drift','collector_attended_annotation_drift','collector_attended_module_set_drift',
      'collector_attended_module_content_drift','lifecycle_creation_version_url_identity_failure',
      'lifecycle_creation_version_url_response_invalid','lifecycle_creation_version_url_unavailable',
      'collector_attended_preview_identity_invalid','collector_staging_version_ambiguous_owner_review_required',
      'collector_staging_version_delta_ambiguous_owner_review_required'
    ]);
    failure=known.has(error?.message)?error.message:
      error instanceof MutationRejectedError?'lifecycle_creation_mutation_rejected':
      error instanceof MutationAmbiguousError?'lifecycle_creation_mutation_ambiguous':'lifecycle_creation_failed_unknown';
  }finally{
    if(previewEnableAttempted){
      try{await setPreview(false);previewDisableSucceeded=true;}catch{previewDisableSucceeded=false;}
    }
  }

  const probes=[oldRootProbe,oldAttendedProbe,cloneRootProbe,cloneAttendedProbe];
  const probesComplete=probes.every(probe=>validateLifecycleProbeEvidence(probe)&&probe.outcome==='HTTP_RESPONSE');
  const oldRouting=probesComplete?classifyLifecycleRouting({rootProbe:oldRootProbe,attendedProbe:oldAttendedProbe}):'LIFECYCLE_OBSERVATION_INCOMPLETE';
  const cloneRouting=probesComplete?classifyLifecycleRouting({rootProbe:cloneRootProbe,attendedProbe:cloneAttendedProbe}):'LIFECYCLE_OBSERVATION_INCOMPLETE';
  const cleanupSafe=previewEnableAttempted===false||previewDisableSucceeded===true;
  const ok=Boolean(cloneVersionId)&&versionMutationSubmissions===1&&previewEnableSucceeded&&cleanupSafe&&probesComplete;
  return Object.freeze({
    version:VERSION_URL_CREATION_EXPERIMENT_VERSION,approvedSha,sourceVersionId:ATTENDED_VERSION_ID,sourceVersionApprovedSha:ATTENDED_VERSION_APPROVED_SHA,
    cloneVersionId,ok,
    classification:ok?'VERSION_URL_CREATION_EXPERIMENT_COMPLETE_RECONCILIATION_REQUIRED':'VERSION_URL_CREATION_EXPERIMENT_RECONCILIATION_REQUIRED',
    reason:ok?'experiment_complete_requires_reconciliation':(failure??(cleanupSafe?'experiment_incomplete':'preview_cleanup_unproved')),
    comparison:probesComplete?experimentComparison(oldRouting,cloneRouting):'LIFECYCLE_OBSERVATION_INCOMPLETE',
    oldRouting,cloneRouting,oldVersionUrlReads,cloneVersionUrlReads,
    previewEnableAttempted,previewEnableSucceeded,previewDisableSucceeded,previewMutationSubmissions,
    versionMutationSubmissions,versionUploadDisposition,
    oldRootProbe,oldAttendedProbe,cloneRootProbe,cloneAttendedProbe,
    secretBindingsSubmitted:2,triggerSecretRequestEgress:0,providerRequests:0,d1Mutations:0,deploymentMutations:0,cronRouteDomainMutations:0,
    retryAuthorized:false
  });
}

export async function main(){
  let output;
  try{output=await runVersionUrlCreationExperiment();}
  catch{
    output=Object.freeze({
      version:VERSION_URL_CREATION_EXPERIMENT_VERSION,approvedSha:process.env.APPROVED_SHA??null,
      sourceVersionId:ATTENDED_VERSION_ID,sourceVersionApprovedSha:ATTENDED_VERSION_APPROVED_SHA,cloneVersionId:null,ok:false,
      classification:'VERSION_URL_CREATION_EXPERIMENT_RECONCILIATION_REQUIRED',reason:'lifecycle_creation_pre_mutation_gate_failed',
      comparison:'LIFECYCLE_OBSERVATION_INCOMPLETE',oldRouting:'LIFECYCLE_OBSERVATION_INCOMPLETE',cloneRouting:'LIFECYCLE_OBSERVATION_INCOMPLETE',
      oldVersionUrlReads:0,cloneVersionUrlReads:0,previewEnableAttempted:false,previewEnableSucceeded:false,previewDisableSucceeded:false,
      previewMutationSubmissions:0,versionMutationSubmissions:0,versionUploadDisposition:null,
      oldRootProbe:null,oldAttendedProbe:null,cloneRootProbe:null,cloneAttendedProbe:null,
      secretBindingsSubmitted:0,triggerSecretRequestEgress:0,providerRequests:0,d1Mutations:0,deploymentMutations:0,cronRouteDomainMutations:0,retryAuthorized:false
    });
  }
  const outputPath=process.env.API_FOOTBALL_VERSION_URL_CREATION_EXPERIMENT_REPORT_PATH;
  if(outputPath)fs.writeFileSync(outputPath,JSON.stringify(output,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({ok:output.ok,classification:output.classification,reason:output.reason,comparison:output.comparison,oldRouting:output.oldRouting,cloneRouting:output.cloneRouting,retryAuthorized:false}));
  return output.ok?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
