// Protected single-POST uploader for a FUTURE separately owner-approved workflow dispatch.
// No write is performed by importing this module. Cloudflare, D1 and API-Football are NEVER called by repository CI.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {
  buildCorrectedVersionIdentity,buildCorrectedUploadForm,submitCorrectedVersionOnce,validateCorrectedAdmission,
  CORRECTED_EXECUTION_CONTRACT,CORRECTED_HISTORICAL_VERSION_IDS,CORRECTED_MAX_VERSION_UPLOADS
} from './corrected-version-preparation.mjs';
import {readCorrectedVersions} from './corrected-version-readonly.mjs';
import {readPromotionDeploymentRows} from './transport-remediated-deployment-promotion-readonly.mjs';
import {promotionPostStateExact} from './transport-remediated-deployment-promotion.mjs';
import {readReplacementRouteTopology} from './replacement-reconciliation.mjs';
import {validateZoneTopology} from './deployed-one-shot.mjs';
import {readFreshTransportRemediatedInertState,transportRemediatedPaths} from './run-transport-remediated-version-upload.mjs';

const API='https://api.cloudflare.com/client/v4',fail=code=>{throw new Error(code);};
const required=(env,name)=>typeof env[name]==='string'&&env[name]?env[name]:fail('CORRECTED_ENV_INCOMPLETE');
const sha=s=>createHash('sha256').update(s).digest('hex');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const hex40=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const hex64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const zero=Object.freeze({deploymentMutations:0,d1Mutations:0,workersDevMutations:0,previewMutations:0,
  cronMutations:0,routeMutations:0,domainMutations:0,workerInvocations:0,apiFootballRequests:0,secretValuesSerialized:0});
export function createCorrectedGuardedFetch({accountId,readToken,uploadToken,topologyToken,uploadForm,fetchImpl=globalThis.fetch}={}){
  if(!accountId||!readToken||!uploadToken||!topologyToken||new Set([readToken,uploadToken,topologyToken]).size!==3||
    !(uploadForm instanceof FormData))fail('CORRECTED_GUARD_INVALID');
  const exact='/accounts/'+encodeURIComponent(accountId)+'/workers/scripts/teamsheet-api-football-shadow-collector/versions';
  const counters={versionUploadAttempts:0,blockedEgress:0};
  const guarded=async(input,init={})=>{
    const deny=()=>{counters.blockedEgress++;fail('CORRECTED_EGRESS_FORBIDDEN');};
    let url;try{url=new URL(String(input));}catch{return deny();}
    if(url.origin!==API||url.username||url.password||!url.pathname.startsWith('/client/v4/'))return deny();
    const method=String(init.method||'GET').toUpperCase(),path=url.pathname.slice('/client/v4'.length)+url.search;
    const auth=init.headers?.Authorization??init.headers?.authorization;
    const authorization=(token)=>auth==='Bearer '+token;
    if(method==='GET'){
      if(!authorization(readToken)&&!authorization(topologyToken))return deny();
      // Never let the upload token be used for reads or permit arbitrary CF endpoints.
      if(path.includes('/d1/')||path.includes('/secrets')||path.includes('/subdomain?')||path.includes('/settings'))return deny();
      const accountPrefix='/accounts/'+encodeURIComponent(accountId)+'/';
      const zone=(path.startsWith('/zones?account.id='+encodeURIComponent(accountId)+'&page=')&&path.includes('&per_page=')&&path.includes('&type=')) || /^\/zones\/[a-z0-9_-]+\/workers\/routes(?:\?.*)?$/i.test(path);
      const inventory=path.startsWith(accountPrefix)&&(
        /^\/accounts\/[^/]+\/workers\/scripts\/teamsheet-api-football-shadow-collector\/(?:deployments|schedules|subdomain|versions\?deployable=true|versions\/[a-f0-9-]{36})(?:\?.*)?$/i.test(path)||
        /^\/accounts\/[^/]+\/workers\/workers\/[^/]+\/versions\/[a-f0-9-]{36}\?include=modules$/i.test(path)||
        path===accountPrefix+'workers/domains');
      if(!(authorization(topologyToken)&&zone||authorization(readToken)&&inventory))return deny();
      return fetchImpl(String(input),init);
    }
    if(method==='POST'&&path===exact&&authorization(uploadToken)&&init.body===uploadForm&&
      counters.versionUploadAttempts<CORRECTED_MAX_VERSION_UPLOADS){
      counters.versionUploadAttempts++;return fetchImpl(String(input),init);
    }
    return deny();
  };
  return Object.freeze({fetch:guarded,counters});
}
export async function executeCorrectedVersionUpload({env=process.env,fetchImpl=globalThis.fetch,delay=wait}={}){
  let identity=null,guard=null,approvedSha=null,admission=null;
  const evidence=(outcome,versionId=null,readbackAttempts=0,reason=null)=>Object.freeze({
    version:CORRECTED_EXECUTION_CONTRACT,approvedSha,identity:identity?Object.freeze({creationSha:identity.creationSha,
      graphSha256:identity.graphSha256,metadataSha256:identity.metadataSha256,moduleCount:17}):null,
    outcome,versionId,readbackAttempts,reason,versionUploadAttempts:guard?.counters.versionUploadAttempts??0,
    productionMutations:guard?.counters.versionUploadAttempts??0,admission,
    retryAuthorized:false,...zero
  });
  try{
    if(env.GITHUB_RUN_ATTEMPT!=='1')fail('CORRECTED_RERUN_FORBIDDEN');
    approvedSha=required(env,'APPROVED_SHA');
    if(!hex40(approvedSha))fail('CORRECTED_SHA_INVALID');
    const accountId=required(env,'CLOUDFLARE_ACCOUNT_ID'),fingerprint=required(env,'CLOUDFLARE_ACCOUNT_FINGERPRINT');
    if(!hex64(fingerprint)||sha(accountId)!==fingerprint)fail('CORRECTED_ACCOUNT_MISMATCH');
    const readToken=required(env,'CLOUDFLARE_ATTENDED_READ_TOKEN'),uploadToken=required(env,'CLOUDFLARE_ATTENDED_VERSION_UPLOAD_TOKEN');
    const topologyToken=required(env,'CLOUDFLARE_TOPOLOGY_READ_TOKEN'),apiKey=required(env,'API_FOOTBALL_API_KEY');
    const triggerSecret=required(env,'API_FOOTBALL_ATTENDED_TRIGGER_SECRET');
    if(new Set([readToken,uploadToken,topologyToken,apiKey,triggerSecret]).size!==5)fail('CORRECTED_SECRETS_NOT_DISTINCT');
    const admissionBytes=fs.readFileSync(required(env,'API_FOOTBALL_CORRECTED_ADMISSION_PATH'));
    if(sha(admissionBytes)!==required(env,'API_FOOTBALL_CORRECTED_ADMISSION_SHA256'))fail('CORRECTED_ADMISSION_HASH_INVALID');
    admission=JSON.parse(admissionBytes.toString('utf8'));
    validateCorrectedAdmission(admission,{approvedSha,accountFingerprint:fingerprint});
    identity=buildCorrectedVersionIdentity(approvedSha);
    const form=buildCorrectedUploadForm(identity,{apiKey,triggerSecret});
    guard=createCorrectedGuardedFetch({accountId,readToken,uploadToken,topologyToken,uploadForm:form,fetchImpl});
    const paths=transportRemediatedPaths(accountId);
    const inert=await readFreshTransportRemediatedInertState({guardedFetch:guard.fetch,paths,readToken});
    if(!inert||inert.workersDev!==false||inert.previewUrls!==false||inert.cronCount!==0||inert.customDomainCount!==0)
      fail('CORRECTED_TOPOLOGY_DRIFT');
    const deployments=await readPromotionDeploymentRows({accountId,readToken,fetchImpl:guard.fetch});
    if(!promotionPostStateExact(deployments)||!same(deployments,admission.deployments))fail('CORRECTED_DEPLOYMENT_DRIFT');
    const topology=await readReplacementRouteTopology({account:accountId,topologyToken,fetchImpl:guard.fetch,workerName:'teamsheet-api-football-shadow-collector'});
    if(!validateZoneTopology(topology)||!same(topology,admission.topology))fail('CORRECTED_ZONE_ROUTE_DRIFT');
    const versions=await readCorrectedVersions({accountId,readToken,fetchImpl:guard.fetch});
    if(!versions||versions.identityExact!==true||
      !same([...versions.versionIds].sort(),[...CORRECTED_HISTORICAL_VERSION_IDS].sort()))
      fail('CORRECTED_VERSION_INVENTORY_DRIFT');
    const beforeIds=versions.versionIds;
    const post=async()=>{
      try{
        const response=await guard.fetch(API+paths.versions,{method:'POST',headers:{Authorization:'Bearer '+uploadToken,Accept:'application/json'},
          body:form,redirect:'manual',signal:AbortSignal.timeout(30_000)});
        const payload=await response.json();
        if(response.status>=400&&response.status<500&&payload?.success===false)return {kind:'REJECTED'};
        if(response.ok&&payload?.success===true)return {kind:'OK',result:payload.result};
      }catch{}
      return {kind:'AMBIGUOUS'};
    };
    const readVersions=async()=>{
      // Re-use the read-only Version inventory, never the mutation credential.
      const after=await readCorrectedVersions({accountId,readToken,fetchImpl:guard.fetch});
      if(!after||after.identityExact!==true)throw new Error('CORRECTED_VERSION_READ_FAILED');
      return after.versionIds;
    };
    const result=await submitCorrectedVersionOnce({post,readVersions,beforeIds,wait:delay});
    return evidence(result.outcome,result.versionId,result.readbackAttempts);
  }catch(error){
    return evidence((guard?.counters.versionUploadAttempts??0)>0?'AMBIGUOUS_OWNER_ATTENTION':'NOT_SUBMITTED',null,0,
      /^CORRECTED_[A-Z0-9_]{1,100}$/.test(error?.message)?error.message:'CORRECTED_UNEXPECTED_STOP');
  }
}
export async function main(){
  for(const name of ['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_ATTENDED_READ_TOKEN','CLOUDFLARE_ATTENDED_VERSION_UPLOAD_TOKEN',
    'CLOUDFLARE_TOPOLOGY_READ_TOKEN','API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET']){
    if(process.env[name])process.stdout.write('::add-mask::'+process.env[name]+'\n');
  }
  const result=await executeCorrectedVersionUpload();
  if(process.env.API_FOOTBALL_CORRECTED_EXECUTION_PATH)
    fs.writeFileSync(process.env.API_FOOTBALL_CORRECTED_EXECUTION_PATH,JSON.stringify(result,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({outcome:result.outcome,versionUploadAttempts:result.versionUploadAttempts,retryAuthorized:false}));
  return ['CREATED','APPLIED_CONFIRMED_BY_READBACK'].includes(result.outcome)?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)main().then(x=>{process.exitCode=x;}).catch(()=>{
  console.error('CORRECTED_UPLOAD_STOP');process.exitCode=1;});
