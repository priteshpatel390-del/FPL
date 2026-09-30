import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {ATTENDED_ACCEPTANCE_PATH} from './collector.mjs';
import {
  ATTENDED_VERSION_APPROVED_SHA,ATTENDED_VERSION_ID,ATTENDED_VERSION_MODULE_SHA256,ORIGINAL_BLOCKED_VERSION_ID,
  buildLifecycleCloneIdentity,buildLifecycleCloneVersionUploadForm,validateLifecycleCloneVersion
} from './attended-version.mjs';
import {extractVersionIds,MutationAmbiguousError,MutationRejectedError} from './stage-inactive-version.mjs';
import {probeVersionUrl,validateLifecycleProbeEvidence} from './run-version-url-lifecycle-observation.mjs';

export const REPLACEMENT_FOUNDATION_VERSION='api-football-replacement-inactive-collector-foundation-v1';
export const ORIGINAL_COLLECTOR='teamsheet-api-football-shadow-collector';
export const ORIGINAL_COLLECTOR_ID='ae69aec0b6484b8f89b44e96b5eb86b8';
export const REPLACEMENT_COLLECTOR='teamsheet-api-football-shadow-collector-v2';
export const REPLACEMENT_RECOVERY_WORKER_ID='af6b59302acf49728e7deeb2f951397f';
export const GATE_C_CLONE_VERSION_ID='7405abc0-8358-4156-8226-b6cc7bcf244f';
export const ORIGINAL_VERSION_IDS=Object.freeze([ORIGINAL_BLOCKED_VERSION_ID,ATTENDED_VERSION_ID,GATE_C_CLONE_VERSION_ID]);
export const REPLACEMENT_MUTATION_CEILINGS=Object.freeze({createShell:1,uploadVersion:1,disablePreview:1});
export const REPLACEMENT_REQUEST_TIMEOUT_MS=20_000;

const API='https://api.cloudflare.com/client/v4';
const HEX40=/^[0-9a-f]{40}$/;
const HEX64=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=code=>{throw new Error(code);};
const enc=value=>encodeURIComponent(String(value));
const digest=value=>createHash('sha256').update(String(value)).digest('hex');

export function replacementPaths(accountId){
  if(typeof accountId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(accountId))fail('replacement_account_invalid');
  const root='/accounts/'+enc(accountId)+'/workers',original=root+'/scripts/'+ORIGINAL_COLLECTOR,replacement=root+'/scripts/'+REPLACEMENT_COLLECTOR;
  return Object.freeze({
    root,createShell:root+'/workers',betaWorkers:root+'/workers?per_page=100&order_by=name&order=asc',scripts:root+'/scripts',domains:root+'/domains',accountSubdomain:root+'/subdomain',
    original,originalSubdomain:original+'/subdomain',originalDeployments:original+'/deployments',originalSchedules:original+'/schedules',originalVersions:original+'/versions?deployable=true',
    replacement,replacementSubdomain:replacement+'/subdomain',replacementDeployments:replacement+'/deployments',replacementSchedules:replacement+'/schedules',replacementVersions:replacement+'/versions?deployable=true',replacementUpload:replacement+'/versions'
  });
}

export function buildReplacementShellBody(){
  return Object.freeze({name:REPLACEMENT_COLLECTOR,observability:Object.freeze({enabled:true}),subdomain:Object.freeze({enabled:false,previews_enabled:true})});
}

export function replacementMutationKind(method,requestPath,{accountId,body}={}){
  const paths=replacementPaths(accountId),verb=String(method).toUpperCase();
  if(verb==='POST'&&requestPath===paths.createShell){
    if(JSON.stringify(body)!==JSON.stringify(buildReplacementShellBody()))fail('replacement_shell_body_invalid');
    return 'createShell';
  }
  if(verb==='POST'&&requestPath===paths.replacementUpload)return 'uploadVersion';
  if(verb==='POST'&&requestPath===paths.replacementSubdomain){
    if(JSON.stringify(body)!==JSON.stringify({enabled:false,previews_enabled:false}))fail('replacement_preview_disable_body_invalid');
    return 'disablePreview';
  }
  fail('replacement_mutation_forbidden');
}

export function buildReplacementIdentity(approvedSha,options={}){
  const identity=buildLifecycleCloneIdentity(approvedSha,options);
  return Object.freeze({...identity,
    message:'API-Football replacement inactive collector from '+approvedSha,
    tag:'api-football-replacement-'+approvedSha.slice(0,12)
  });
}

export function buildReplacementUploadForm(approvedSha,secrets,{readFile}={}){
  const form=buildLifecycleCloneVersionUploadForm(approvedSha,secrets,readFile?{readFile}:{});
  const metadata=JSON.parse(form.get('metadata'));
  const identity=buildReplacementIdentity(approvedSha,readFile?{readFile}:{});
  metadata.annotations={'workers/message':identity.message,'workers/tag':identity.tag};
  form.set('metadata',JSON.stringify(metadata));
  return form;
}

function rows(value,key){
  const result=Array.isArray(value)?value:Array.isArray(value?.[key])?value[key]:null;
  if(!result)fail('replacement_inventory_invalid');
  return result;
}
function exactIds(actual,expected){return JSON.stringify([...actual].sort())===JSON.stringify([...expected].sort());}
function findWorker(betaWorkers,name){
  const matches=rows(betaWorkers,'items').filter(row=>row?.name===name);
  if(matches.length>1)fail('replacement_worker_inventory_invalid');
  return matches[0]??null;
}
function routeCount(scripts,name,{allowAbsent=false}={}){
  const row=rows(scripts,'items').find(item=>item?.id===name);
  if(!row)return allowAbsent?0:null;
  return Array.isArray(row.routes)?row.routes.length:null;
}
function domainCount(domains,name){return rows(domains,'items').filter(row=>row?.service===name).length;}
function zeroTopology({subdomain,deployments,schedules,scripts,domains,name,preview,allowMissingScript=false}){
  return subdomain?.enabled===false&&subdomain?.previews_enabled===preview&&rows(deployments,'deployments').length===0&&rows(schedules,'schedules').length===0&&routeCount(scripts,name,{allowAbsent:allowMissingScript})===0&&domainCount(domains,name)===0;
}

export function validateOriginalCollectorSnapshot(snapshot){
  const worker=findWorker(snapshot.betaWorkers,ORIGINAL_COLLECTOR);
  const versionIds=extractVersionIds(snapshot.versions);
  if(worker?.id!==ORIGINAL_COLLECTOR_ID||!exactIds(versionIds,ORIGINAL_VERSION_IDS)||
    !zeroTopology({...snapshot,name:ORIGINAL_COLLECTOR,preview:false}))fail('replacement_original_collector_drift');
  return Object.freeze({workerId:worker.id,versionIds:Object.freeze([...versionIds].sort()),workersDev:false,previewUrls:false,deploymentCount:0,cronCount:0,routeCount:0,customDomainCount:0});
}

export function validateReplacementAbsent(snapshot){
  if(findWorker(snapshot.betaWorkers,REPLACEMENT_COLLECTOR)||rows(snapshot.scripts,'items').some(row=>row?.id===REPLACEMENT_COLLECTOR))fail('replacement_worker_preexists');
  return true;
}

export function validateReplacementShell(snapshot,{workerId,preview=true}={}){
  const worker=findWorker(snapshot.betaWorkers,REPLACEMENT_COLLECTOR),versionIds=extractVersionIds(snapshot.versions);
  if(!worker||worker.id!==workerId||worker.name!==REPLACEMENT_COLLECTOR||worker.deployed_on!=null||worker.subdomain?.enabled!==false||worker.subdomain?.previews_enabled!==preview||
    !zeroTopology({...snapshot,name:REPLACEMENT_COLLECTOR,preview,allowMissingScript:versionIds.length===0})||versionIds.length!==0)fail('replacement_shell_reconciliation_failed');
  return true;
}

export function validateReplacementVersion({stableVersion,betaVersion,versionId,identity}){
  validateLifecycleCloneVersion({stableVersion,betaVersion,versionId,identity});
  if(JSON.stringify(identity.moduleSha256)!==JSON.stringify(ATTENDED_VERSION_MODULE_SHA256))fail('replacement_version_source_drift');
  return true;
}

export function validateReplacementProbe(probe){
  return validateLifecycleProbeEvidence(probe)&&probe.outcome==='HTTP_RESPONSE'&&probe.workerSignatureProved===true;
}

function createRequester({accountId,readToken,mutationToken,fetchImpl}){
  if(typeof readToken!=='string'||!readToken||typeof mutationToken!=='string'||!mutationToken||readToken===mutationToken)fail('replacement_credential_separation_required');
  const counts={createShell:0,uploadVersion:0,disablePreview:0};
  const request=async(requestPath,{method='GET',body,multipart,allow404=false}={})=>{
    const verb=String(method).toUpperCase(),mutation=verb!=='GET';let kind=null;
    if(mutation){kind=replacementMutationKind(verb,requestPath,{accountId,body});if(counts[kind]>=REPLACEMENT_MUTATION_CEILINGS[kind])fail('replacement_mutation_ceiling_'+kind);counts[kind]+=1;}
    const headers={Authorization:'Bearer '+(mutation?mutationToken:readToken),Accept:'application/json'};let requestBody;
    if(multipart)requestBody=multipart;else if(body!==undefined){headers['content-type']='application/json';requestBody=JSON.stringify(body);}
    let response,text;
    try{response=await fetchImpl(API+requestPath,{method:verb,headers,body:requestBody,redirect:'error',signal:AbortSignal.timeout(REPLACEMENT_REQUEST_TIMEOUT_MS)});text=await response.text();}
    catch{if(mutation)throw new MutationAmbiguousError('replacement_mutation_transport_ambiguous_'+kind);fail('replacement_read_transport_failed');}
    if(!mutation&&allow404&&response.status===404)return Object.freeze({absent:true,result:null});
    let payload;try{payload=JSON.parse(text);}catch{if(mutation)throw new MutationAmbiguousError('replacement_mutation_response_invalid_'+kind);fail('replacement_read_response_invalid');}
    if(mutation&&response.status>=400&&response.status<500)throw new MutationRejectedError('replacement_mutation_rejected_'+kind);
    if(mutation&&(response.status>=500||payload?.success!==true))throw new MutationAmbiguousError('replacement_mutation_ambiguous_'+kind);
    if(!mutation&&(!response.ok||payload?.success!==true))fail('replacement_read_failed');
    return Object.freeze({absent:false,result:payload.result});
  };
  return Object.freeze({request,counts});
}

async function readWorkerSnapshot(request,paths,name,workerId=null){
  const prefix=name===ORIGINAL_COLLECTOR?'original':'replacement';
  const betaWorkers=(await request(paths.betaWorkers)).result,scripts=(await request(paths.scripts)).result,domains=(await request(paths.domains)).result;
  const base=paths[prefix],subdomain=(await request(paths[prefix+'Subdomain'],{allow404:true})),deployments=(await request(paths[prefix+'Deployments'],{allow404:true})),schedules=(await request(paths[prefix+'Schedules'],{allow404:true})),versions=(await request(paths[prefix+'Versions'],{allow404:true}));
  if(subdomain.absent||deployments.absent||schedules.absent||versions.absent)return Object.freeze({betaWorkers,scripts,domains,absent:true});
  return Object.freeze({betaWorkers,scripts,domains,subdomain:subdomain.result,deployments:deployments.result,schedules:schedules.result,versions:versions.result,base,workerId,absent:false});
}

async function resolveVersionUrl(request,paths,{workerId,versionId,accountSubdomain}){
  const detail=(await request(paths.createShell+'/'+enc(workerId)+'/versions/'+enc(versionId))).result;
  if(detail?.id!==versionId||!Array.isArray(detail.urls)||detail.urls.length!==1||typeof detail.urls[0]!=='string')fail('replacement_version_url_unavailable');
  const suffix='-'+REPLACEMENT_COLLECTOR+'.'+accountSubdomain+'.workers.dev';let url;
  try{url=new URL(detail.urls[0]);}catch{return fail('replacement_version_url_invalid');}
  if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash||url.username||url.password||url.port||url.hostname!==versionId.slice(0,8)+suffix)fail('replacement_version_url_invalid');
  return url;
}

const knownFailure=error=>/^replacement_[A-Za-z0-9_]{1,96}$/.test(String(error?.message))?error.message:'replacement_failed_unknown';

export const REPLACEMENT_CLASSIFICATIONS=Object.freeze({
  success:'REPLACEMENT_INACTIVE_COLLECTOR_FOUNDATION_RECONCILIATION_REQUIRED',
  safeStop:'REPLACEMENT_INACTIVE_COLLECTOR_CLEAN_SAFE_STOP',
  ownerAttention:'REPLACEMENT_INACTIVE_COLLECTOR_OWNER_ATTENTION_REQUIRED'
});
export const REPLACEMENT_STATES=Object.freeze(['ABSENT','SHELL_ONLY','ONE_VERSION']);
const DISABLED=state=>state?.enabled===false&&state?.previews_enabled===false;

// Bounded cleanup obligation: once the replacement shell is known to exist, Preview must be
// restored to disabled whether or not routing was proved. At most one disable submission; an
// ambiguous or rejected submission is resolved only by a read-only subdomain reread.
async function restorePreviewDisabled(request,paths){
  let before=null;
  try{before=(await request(paths.replacementSubdomain)).result;}catch{}
  if(DISABLED(before))return Object.freeze({disposition:'ALREADY_DISABLED',disabled:true});
  try{await request(paths.replacementSubdomain,{method:'POST',body:{enabled:false,previews_enabled:false}});return Object.freeze({disposition:'DEFINITE',disabled:true});}
  catch{
    let state=null;
    try{state=(await request(paths.replacementSubdomain)).result;}catch{}
    return DISABLED(state)?Object.freeze({disposition:'RECONCILED',disabled:true}):Object.freeze({disposition:'UNRESOLVED',disabled:false});
  }
}

async function proveReplacementFinalState(request,paths,{workerId,versionId,expectedVersionIds,identity}){
  const final=await readWorkerSnapshot(request,paths,REPLACEMENT_COLLECTOR,workerId);
  const worker=findWorker(final.betaWorkers,REPLACEMENT_COLLECTOR);
  if(final.absent||!worker||worker.id!==workerId||worker.deployed_on!=null||!zeroTopology({...final,name:REPLACEMENT_COLLECTOR,preview:false,allowMissingScript:expectedVersionIds.length===0})||
    !exactIds(extractVersionIds(final.versions),expectedVersionIds))fail('replacement_final_topology_invalid');
  if(expectedVersionIds.length===1){
    const stableVersion=(await request(paths.replacement+'/'+enc(versionId))).result;
    const betaVersion=(await request(paths.createShell+'/'+enc(workerId)+'/versions/'+enc(versionId)+'?include=modules')).result;
    validateReplacementVersion({stableVersion,betaVersion,versionId,identity});
    return 'ONE_VERSION';
  }
  return 'SHELL_ONLY';
}

export async function runReplacementFoundation({env=process.env,fetchImpl=globalThis.fetch}={}){
  const account=env.CLOUDFLARE_ACCOUNT_ID,fingerprint=env.CLOUDFLARE_ACCOUNT_FINGERPRINT,approvedSha=env.APPROVED_SHA;
  if(typeof account!=='string'||!account||!HEX64.test(String(fingerprint||''))||digest(account)!==fingerprint||!HEX40.test(String(approvedSha||'')))fail('replacement_execution_identity_invalid');
  if(env.API_FOOTBALL_ATTENDED_TRIGGER_HEADER)fail('replacement_trigger_header_forbidden');
  const apiKey=env.API_FOOTBALL_API_KEY,triggerSecret=env.API_FOOTBALL_ATTENDED_TRIGGER_SECRET;
  const identity=buildReplacementIdentity(approvedSha),uploadForm=buildReplacementUploadForm(approvedSha,{apiKey,triggerSecret});
  const paths=replacementPaths(account),{request,counts}=createRequester({accountId:account,readToken:env.CLOUDFLARE_REPLACEMENT_READ_TOKEN,mutationToken:env.CLOUDFLARE_REPLACEMENT_MUTATION_TOKEN,fetchImpl});
  const originalBeforeRaw=await readWorkerSnapshot(request,paths,ORIGINAL_COLLECTOR);const originalBefore=validateOriginalCollectorSnapshot(originalBeforeRaw);
  const absent=await readWorkerSnapshot(request,paths,REPLACEMENT_COLLECTOR);validateReplacementAbsent(absent);
  const accountSubdomain=(await request(paths.accountSubdomain)).result?.subdomain;
  if(typeof accountSubdomain!=='string'||!/^[a-z0-9-]+$/.test(accountSubdomain))fail('replacement_account_subdomain_invalid');
  let shellDisposition=null,versionDisposition=null,workerId=null,versionId=null,rootProbe=null,attendedProbe=null,routingProved=false,shellKnown=false,failure=null;
  try{
    try{
      const created=(await request(paths.createShell,{method:'POST',body:buildReplacementShellBody()})).result;
      workerId=created?.id;
      if(created?.name!==REPLACEMENT_COLLECTOR||typeof workerId!=='string'||workerId===ORIGINAL_COLLECTOR_ID){workerId=null;shellDisposition='IDENTITY_INVALID';fail('replacement_shell_identity_invalid');}
      shellDisposition='DEFINITE';shellKnown=true;
    }catch(error){
      if(error instanceof MutationRejectedError){shellDisposition='REJECTED';throw error;}
      if(!(error instanceof MutationAmbiguousError))throw error;
      shellDisposition='UNRESOLVED';
      const rows=(await request(paths.betaWorkers)).result;const worker=findWorker(rows,REPLACEMENT_COLLECTOR);
      if(typeof worker?.id!=='string'||worker.id===ORIGINAL_COLLECTOR_ID)throw error;
      workerId=worker.id;shellKnown=true;shellDisposition='RECONCILED';
      const reconciled=await readWorkerSnapshot(request,paths,REPLACEMENT_COLLECTOR,workerId);validateReplacementShell(reconciled,{workerId});
    }
    const shell=await readWorkerSnapshot(request,paths,REPLACEMENT_COLLECTOR,workerId);validateReplacementShell(shell,{workerId});
    const beforeIds=extractVersionIds(shell.versions);
    try{
      const uploaded=(await request(paths.replacementUpload,{method:'POST',multipart:uploadForm})).result;versionId=uploaded?.id;
      if(!UUID.test(String(versionId||''))){versionId=null;versionDisposition='UNRESOLVED';fail('replacement_version_identity_invalid');}
      versionDisposition='DEFINITE';
    }catch(error){
      if(error instanceof MutationRejectedError){versionDisposition='REJECTED';throw error;}
      if(!(error instanceof MutationAmbiguousError)){versionDisposition='UNRESOLVED';throw error;}
      versionDisposition='UNRESOLVED';
      const current=await readWorkerSnapshot(request,paths,REPLACEMENT_COLLECTOR,workerId);const afterIds=extractVersionIds(current.versions),added=afterIds.filter(id=>!beforeIds.includes(id));
      if(afterIds.length===0){versionDisposition='RECONCILED_ABSENT';fail('replacement_version_upload_reconciled_absent');}
      if(added.length!==1||afterIds.length!==1)throw error;versionId=added[0];versionDisposition='RECONCILED';
    }
    const current=await readWorkerSnapshot(request,paths,REPLACEMENT_COLLECTOR,workerId);
    if(!exactIds(extractVersionIds(current.versions),[versionId])||!zeroTopology({...current,name:REPLACEMENT_COLLECTOR,preview:true}))fail('replacement_preprobe_topology_invalid');
    const stableVersion=(await request(paths.replacement+'/'+enc(versionId))).result;
    const betaVersion=(await request(paths.createShell+'/'+enc(workerId)+'/versions/'+enc(versionId)+'?include=modules')).result;
    validateReplacementVersion({stableVersion,betaVersion,versionId,identity});
    const base=await resolveVersionUrl(request,paths,{workerId,versionId,accountSubdomain});
    rootProbe=await probeVersionUrl(new URL('/',base),{fetchImpl});
    attendedProbe=await probeVersionUrl(new URL(ATTENDED_ACCEPTANCE_PATH,base),{fetchImpl});
    if(!validateReplacementProbe(rootProbe)||!validateReplacementProbe(attendedProbe))fail('replacement_routing_signature_not_proved');
    routingProved=true;
  }catch(error){failure=knownFailure(error);}

  // Cleanup runs on every path once the exact replacement shell is known, success or not.
  const previewCleanup=shellKnown?await restorePreviewDisabled(request,paths):Object.freeze({disposition:'NOT_REQUIRED',disabled:false});
  let replacementState=null,finalStateReason=null;
  try{
    if(shellKnown){
      if(!previewCleanup.disabled)fail('replacement_preview_cleanup_unresolved');
      const expectedVersionIds=['DEFINITE','RECONCILED'].includes(versionDisposition)?[versionId]:[null,'REJECTED','RECONCILED_ABSENT'].includes(versionDisposition)?[]:null;
      if(!expectedVersionIds)fail('replacement_version_state_unresolved');
      replacementState=await proveReplacementFinalState(request,paths,{workerId,versionId,expectedVersionIds,identity});
    }else if(shellDisposition==='REJECTED'){
      validateReplacementAbsent(await readWorkerSnapshot(request,paths,REPLACEMENT_COLLECTOR));replacementState='ABSENT';
    }else fail('replacement_shell_state_unresolved');
  }catch(error){finalStateReason=knownFailure(error);replacementState=null;}
  let originalUnchanged=false;
  try{originalUnchanged=JSON.stringify(originalBefore)===JSON.stringify(validateOriginalCollectorSnapshot(await readWorkerSnapshot(request,paths,ORIGINAL_COLLECTOR)));}catch{}
  const complete=failure===null&&routingProved&&previewCleanup.disabled&&replacementState==='ONE_VERSION'&&originalUnchanged&&
    counts.createShell===1&&counts.uploadVersion===1&&validateReplacementProbe(rootProbe)&&validateReplacementProbe(attendedProbe);
  const safeStop=!complete&&failure!==null&&replacementState!==null&&originalUnchanged&&counts.disablePreview<=1;
  const classification=complete?REPLACEMENT_CLASSIFICATIONS.success:safeStop?REPLACEMENT_CLASSIFICATIONS.safeStop:REPLACEMENT_CLASSIFICATIONS.ownerAttention;
  return Object.freeze({
    version:REPLACEMENT_FOUNDATION_VERSION,approvedSha,replacementWorker:REPLACEMENT_COLLECTOR,workerId,versionId,
    classification,reason:complete?'replacement_created_routing_proved_and_preview_disabled':failure??finalStateReason??'replacement_final_state_unproved',
    complete,safeStop,routingProved,replacementState,finalStateReason,shellDisposition,versionDisposition,
    rootProbe,attendedProbe,previewCleanup:previewCleanup.disposition,previewDisabled:previewCleanup.disabled,originalUnchanged,mutationCounts:Object.freeze({...counts}),
    deploymentsCreated:0,workersDevEnabled:0,cronRouteDomainMutations:0,accessMutations:0,d1Mutations:0,providerRequests:0,triggerHeaderRequests:0,retryAuthorized:false
  });
}

const EXECUTION_ZERO_KEYS=['deploymentsCreated','workersDevEnabled','cronRouteDomainMutations','accessMutations','d1Mutations','providerRequests','triggerHeaderRequests'];
export function validateOriginalReport(originalReport){
  if(originalReport?.stage!=='VERSION_URL_CREATION_EXPERIMENT_CLOSEOUT'||originalReport?.ok!==true||originalReport?.inventory?.versionInventoryExact!==true||originalReport?.inventory?.cloneVersionIdentityExact!==true||
    originalReport?.inventory?.workersDev!==false||originalReport?.inventory?.previewUrls!==false||originalReport?.inventory?.deploymentCount!==0||originalReport?.inventory?.cronCount!==0||originalReport?.inventory?.routeCount!==0||originalReport?.inventory?.customDomainCount!==0||
    originalReport?.runtime?.collectionEnabled!==0||originalReport?.runtime?.credentialState!=='AVAILABLE'||originalReport?.runtime?.activeLease!==false||originalReport?.priorState?.requestAttempts!==0||originalReport?.priorState?.generations!==0||originalReport?.priorState?.fixtureRevisions!==0)fail('replacement_reconciliation_original_invalid');
}
function inactiveReplacement(replacement,execution){
  return replacement?.present===true&&replacement?.workerName===REPLACEMENT_COLLECTOR&&typeof execution.workerId==='string'&&replacement?.workerId===execution.workerId&&
    replacement?.workersDev===false&&replacement?.previewUrls===false&&replacement?.deploymentCount===0&&replacement?.cronCount===0&&replacement?.routeCount===0&&replacement?.customDomainCount===0;
}
function oneVersionReplacement(replacement,execution){
  return inactiveReplacement(replacement,execution)&&typeof execution.versionId==='string'&&replacement?.versionId===execution.versionId&&replacement?.versionCount===1&&replacement?.versionInventoryExact===true&&replacement?.versionIdentityExact===true;
}

export function validateReplacementReconciliation({execution,originalReport,replacement}={}){
  const counts=execution?.mutationCounts;
  if(!execution||EXECUTION_ZERO_KEYS.some(key=>execution[key]!==0)||execution.retryAuthorized!==false||execution.originalUnchanged!==true||
    !counts||counts.createShell>1||counts.uploadVersion>1||counts.disablePreview>1)fail('replacement_reconciliation_execution_invalid');
  const success=execution.classification===REPLACEMENT_CLASSIFICATIONS.success&&execution.complete===true&&execution.safeStop===false&&execution.routingProved===true&&execution.previewDisabled===true&&execution.replacementState==='ONE_VERSION';
  const safeStop=execution.classification===REPLACEMENT_CLASSIFICATIONS.safeStop&&execution.complete===false&&execution.safeStop===true&&REPLACEMENT_STATES.includes(execution.replacementState)&&
    (execution.replacementState==='ABSENT'||execution.previewDisabled===true);
  if(!success&&!safeStop)fail('replacement_reconciliation_execution_invalid');
  validateOriginalReport(originalReport);
  const state=success?'ONE_VERSION':execution.replacementState;
  const candidateExact=state==='ABSENT'?replacement?.present===false&&execution.workerId===null&&execution.versionId===null:
    state==='SHELL_ONLY'?inactiveReplacement(replacement,execution)&&execution.versionId===null&&replacement?.versionId===null&&replacement?.versionCount===0&&replacement?.versionInventoryExact===true:
    oneVersionReplacement(replacement,execution);
  if(!candidateExact)fail('replacement_reconciliation_candidate_invalid');
  return Object.freeze({
    classification:success?'REPLACEMENT_INACTIVE_COLLECTOR_FOUNDATION_RECONCILED':'REPLACEMENT_INACTIVE_COLLECTOR_SAFE_STOP_RECONCILED',
    replacementWorker:REPLACEMENT_COLLECTOR,replacementState:state,workerId:execution.workerId,versionId:execution.versionId,foundationSucceeded:success,retryAuthorized:false
  });
}

export async function main(){
  let report;try{report=await runReplacementFoundation();}catch(error){report={version:REPLACEMENT_FOUNDATION_VERSION,approvedSha:process.env.APPROVED_SHA??null,replacementWorker:REPLACEMENT_COLLECTOR,workerId:null,versionId:null,classification:REPLACEMENT_CLASSIFICATIONS.ownerAttention,reason:knownFailure(error),complete:false,safeStop:false,routingProved:false,replacementState:null,finalStateReason:null,shellDisposition:null,versionDisposition:null,rootProbe:null,attendedProbe:null,previewCleanup:'NOT_REQUIRED',previewDisabled:false,originalUnchanged:false,mutationCounts:{createShell:0,uploadVersion:0,disablePreview:0},deploymentsCreated:0,workersDevEnabled:0,cronRouteDomainMutations:0,accessMutations:0,d1Mutations:0,providerRequests:0,triggerHeaderRequests:0,retryAuthorized:false};}
  if(process.env.API_FOOTBALL_REPLACEMENT_REPORT_PATH)fs.writeFileSync(process.env.API_FOOTBALL_REPLACEMENT_REPORT_PATH,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({classification:report.classification,reason:report.reason,complete:report.complete,safeStop:report.safeStop,replacementState:report.replacementState,previewDisabled:report.previewDisabled,retryAuthorized:false}));return report.complete?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
