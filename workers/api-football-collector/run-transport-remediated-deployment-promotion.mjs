// Protected executor for ONE transport-remediated Deployment promotion (Gate B). Dormant: dispatch is separately owner-gated.
// The only Cloudflare mutation representable here is POST .../workers/scripts/<collector>/deployments with the exact
// candidate-at-100% body, submitted at most once and never resent. There is no Version upload, workers.dev, Preview, D1,
// Cron, route, domain, Worker shell, DELETE, PUT or PATCH path, no Worker invocation and no API-Football egress: a guarded
// fetch refuses every other host, method, path, credential and body before any network I/O. There is no automatic rollback.
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {readReplacementRouteTopology} from './replacement-reconciliation.mjs';
import {validateZoneTopology} from './deployed-one-shot.mjs';
import {
  PROMOTION_MAX_DEPLOYMENT_POSTS,PROMOTION_WORKER,PROMOTION_WORKER_ID,buildPromotionCandidateIdentity,buildPromotionExecutionEvidence,
  closedDiagnostic,promotionDeploymentRows,promotionPreStateExact,promotionVersionInventoryDiagnostic,serializePromotionDeploymentBody,
  submitPromotionDeployment,validatePromotionAdmissionHandoff
} from './transport-remediated-deployment-promotion.mjs';
import {promotionReadPaths,readPromotionVersions} from './transport-remediated-deployment-promotion-readonly.mjs';

const API_HOST='api.cloudflare.com',API_PREFIX='/client/v4';
const HEX40=/^[0-9a-f]{40}$/;
const HEX64=/^[0-9a-f]{64}$/;
const ID=/^[A-Za-z0-9_-]{1,128}$/;
const fail=code=>{throw new Error(code);};
const digest=value=>createHash('sha256').update(String(value)).digest('hex');
const enc=value=>encodeURIComponent(String(value));
const delay=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const required=(env,name)=>typeof env[name]==='string'&&env[name]?env[name]:fail('TRANSPORT_REMEDIATED_PROMOTION_ENVIRONMENT_INCOMPLETE');
export const PROMOTION_POST_TIMEOUT_MS=30_000;
export const PROMOTION_REQUEST_TIMEOUT_MS=15_000;
// The protected job must hold no provider or Worker-trigger secret at all.
export const PROMOTION_FORBIDDEN_ENV=Object.freeze(['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET','CLOUDFLARE_ATTENDED_VERSION_UPLOAD_TOKEN','CLOUDFLARE_ATTENDED_MUTATION_TOKEN']);

export function promotionPaths(accountId){
  if(typeof accountId!=='string'||!ID.test(accountId))fail('TRANSPORT_REMEDIATED_PROMOTION_ACCOUNT_INVALID');
  const account='/accounts/'+enc(accountId),script=account+'/workers/scripts/'+PROMOTION_WORKER;
  return Object.freeze({
    deployments:script+'/deployments',subdomain:script+'/subdomain',schedules:script+'/schedules',domains:account+'/workers/domains',
    script,account,betaVersions:account+'/workers/workers/'+enc(PROMOTION_WORKER_ID)+'/versions/'
  });
}

// Read endpoints the executor may GET with the read credential. Everything else is refused before network.
function readPathAllowed(requestPath,paths){
  const uuid='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return [
    new RegExp('^'+escape(paths.deployments)+'$'),new RegExp('^'+escape(paths.subdomain)+'$'),new RegExp('^'+escape(paths.schedules)+'$'),
    new RegExp('^'+escape(paths.domains)+'$'),new RegExp('^'+escape(paths.script)+'/versions\\?deployable=true$'),
    new RegExp('^'+escape(paths.script)+'/versions/'+uuid+'$','i'),new RegExp('^'+escape(paths.betaVersions)+uuid+'\\?include=modules$','i')
  ].some(pattern=>pattern.test(requestPath));
}
// Topology reads (Zone Read + Workers Routes Read) use only the topology credential.
function topologyPathAllowed(requestPath){return /^\/zones\?account\.id=[^&]+&page=\d+&per_page=\d+&type=[A-Za-z0-9%,]+$/.test(requestPath)||/^\/zones\/[0-9a-f]{32}\/workers\/routes$/.test(requestPath);}

// The single mutation endpoint: the exact Deployment POST on the original collector, with the promotion credential only.
export function assertPromotionMutationAllowed(method,requestPath,{accountId}={}){
  if(String(method).toUpperCase()==='POST'&&requestPath===promotionPaths(accountId).deployments)return true;
  return fail('TRANSPORT_REMEDIATED_PROMOTION_ENDPOINT_FORBIDDEN');
}

export function createPromotionGuardedFetch({accountId,readToken,promotionToken,topologyToken,expectedBody,fetchImpl=globalThis.fetch}={}){
  const paths=promotionPaths(accountId);
  if(typeof expectedBody!=='string'||!expectedBody)fail('TRANSPORT_REMEDIATED_PROMOTION_BODY_INVALID');
  const counters={deploymentPostAttempts:0,blockedEgress:0};
  const refuse=code=>{counters.blockedEgress+=1;return fail(code);};
  const guarded=async(input,init={})=>{
    let url;try{url=new URL(String(input));}catch{return refuse('TRANSPORT_REMEDIATED_PROMOTION_EGRESS_FORBIDDEN');}
    if(url.protocol!=='https:'||url.hostname!==API_HOST||url.port||url.username||url.password||url.hash||!url.pathname.startsWith(API_PREFIX+'/'))return refuse('TRANSPORT_REMEDIATED_PROMOTION_EGRESS_FORBIDDEN');
    const method=String(init.method||'GET').toUpperCase(),requestPath=url.pathname.slice(API_PREFIX.length)+url.search;
    const authorization=init.headers?.Authorization??init.headers?.authorization;
    if(/\/d1\//.test(requestPath))return refuse('TRANSPORT_REMEDIATED_PROMOTION_D1_FORBIDDEN');
    if(method==='GET'){
      if(init.body!==undefined&&init.body!==null)return refuse('TRANSPORT_REMEDIATED_PROMOTION_ENDPOINT_FORBIDDEN');
      if(authorization==='Bearer '+promotionToken)return refuse('TRANSPORT_REMEDIATED_PROMOTION_CREDENTIAL_READ_FORBIDDEN');
      if(readPathAllowed(requestPath,paths)){
        if(authorization!=='Bearer '+readToken)return refuse('TRANSPORT_REMEDIATED_PROMOTION_READ_CREDENTIAL_REQUIRED');
        return fetchImpl(String(input),init);
      }
      if(topologyPathAllowed(requestPath)){
        if(authorization!=='Bearer '+topologyToken)return refuse('TRANSPORT_REMEDIATED_PROMOTION_TOPOLOGY_CREDENTIAL_REQUIRED');
        return fetchImpl(String(input),init);
      }
      return refuse('TRANSPORT_REMEDIATED_PROMOTION_ENDPOINT_FORBIDDEN');
    }
    if(method==='POST'&&requestPath===paths.deployments){
      assertPromotionMutationAllowed(method,requestPath,{accountId});
      if(authorization!=='Bearer '+promotionToken)return refuse('TRANSPORT_REMEDIATED_PROMOTION_CREDENTIAL_REQUIRED');
      if(init.body!==expectedBody)return refuse('TRANSPORT_REMEDIATED_PROMOTION_BODY_FORBIDDEN');
      if(counters.deploymentPostAttempts>=PROMOTION_MAX_DEPLOYMENT_POSTS)return refuse('TRANSPORT_REMEDIATED_PROMOTION_POST_CEILING_EXCEEDED');
      counters.deploymentPostAttempts+=1;
      return fetchImpl(String(input),init);
    }
    return refuse('TRANSPORT_REMEDIATED_PROMOTION_ENDPOINT_FORBIDDEN');
  };
  return Object.freeze({fetch:guarded,counters});
}

async function cloudflareGet(guardedFetch,requestPath,token){
  try{
    const response=await guardedFetch('https://'+API_HOST+API_PREFIX+requestPath,{method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(PROMOTION_REQUEST_TIMEOUT_MS)});
    if(response.status>=300&&response.status<400)return null;
    const payload=await response.json();
    return response.ok&&payload?.success===true?payload.result:null;
  }catch(error){
    if(String(error?.message).startsWith('TRANSPORT_REMEDIATED_PROMOTION_'))throw error;
    return null;
  }
}

export async function readFreshPromotionInertState({guardedFetch,paths,readToken}={}){
  const [subdomain,schedules,domains]=await Promise.all([
    cloudflareGet(guardedFetch,paths.subdomain,readToken),cloudflareGet(guardedFetch,paths.schedules,readToken),cloudflareGet(guardedFetch,paths.domains,readToken)
  ]);
  const scheduleRows=Array.isArray(schedules?.schedules)?schedules.schedules:Array.isArray(schedules)?schedules:null;
  if(!subdomain||!scheduleRows||!Array.isArray(domains))return null;
  return Object.freeze({workersDev:subdomain.enabled,previewUrls:subdomain.previews_enabled,cronCount:scheduleRows.length,
    customDomainCount:domains.filter(row=>row?.service===PROMOTION_WORKER).length});
}

export async function executeTransportRemediatedDeploymentPromotion({env=process.env,fetchImpl=globalThis.fetch,routeScan=readReplacementRouteTopology,wait=delay}={}){
  let approvedSha=null,guard=null,finalRouteScan=null;
  const evidence=fields=>buildPromotionExecutionEvidence({approvedSha,finalRouteScan,deploymentPostAttempts:guard?.counters.deploymentPostAttempts??0,...fields});
  try{
    // Every credential and identity is validated before any network request. A GitHub re-run is refused outright.
    if(env.GITHUB_RUN_ATTEMPT!==undefined&&env.GITHUB_RUN_ATTEMPT!=='1')fail('TRANSPORT_REMEDIATED_PROMOTION_RERUN_FORBIDDEN');
    if(PROMOTION_FORBIDDEN_ENV.some(name=>env[name]!==undefined&&env[name]!==''))fail('TRANSPORT_REMEDIATED_PROMOTION_FORBIDDEN_SECRET_PRESENT');
    const accountId=required(env,'CLOUDFLARE_ACCOUNT_ID'),fingerprint=required(env,'CLOUDFLARE_ACCOUNT_FINGERPRINT');
    const readToken=required(env,'CLOUDFLARE_ATTENDED_READ_TOKEN'),promotionToken=required(env,'CLOUDFLARE_REMEDIATED_DEPLOYMENT_PROMOTION_TOKEN');
    const topologyToken=required(env,'CLOUDFLARE_TOPOLOGY_READ_TOKEN');
    approvedSha=required(env,'APPROVED_SHA');
    if(!HEX40.test(approvedSha))fail('TRANSPORT_REMEDIATED_PROMOTION_APPROVED_SHA_INVALID');
    if(new Set([readToken,promotionToken,topologyToken]).size!==3)fail('TRANSPORT_REMEDIATED_PROMOTION_CREDENTIAL_SEPARATION_REQUIRED');
    if(!HEX64.test(fingerprint)||digest(accountId)!==fingerprint)fail('TRANSPORT_REMEDIATED_PROMOTION_ACCOUNT_IDENTITY_MISMATCH');
    const admission=JSON.parse(fs.readFileSync(required(env,'API_FOOTBALL_DEPLOYMENT_PROMOTION_ADMISSION_PATH'),'utf8'));
    validatePromotionAdmissionHandoff(admission,{approvedSha,accountFingerprint:fingerprint});
    const retainedCreatedOn=admission.deployments[0].createdOn;
    // Immutable candidate identity (from the Gate A creation SHA, never the execution SHA) and the exact body are
    // built before any network request: reviewed-source drift sends nothing.
    buildPromotionCandidateIdentity();
    const body=serializePromotionDeploymentBody(approvedSha);

    guard=createPromotionGuardedFetch({accountId,readToken,promotionToken,topologyToken,expectedBody:body,fetchImpl});
    const paths=promotionPaths(accountId);
    // Fresh pre-mutation proof is Cloudflare-only. D1/history truth is carried by the hash-bound read-only admission artifact;
    // this protected executor has no D1 endpoint at all.
    const inert=await readFreshPromotionInertState({guardedFetch:guard.fetch,paths,readToken});
    if(!inert||inert.workersDev!==false||inert.previewUrls!==false||inert.cronCount!==0||inert.customDomainCount!==0)fail('TRANSPORT_REMEDIATED_PROMOTION_CLOUDFLARE_STATE_NOT_INERT');
    const readDeployments=async()=>{const result=await cloudflareGet(guard.fetch,paths.deployments,readToken);return result===null?null:promotionDeploymentRows(result);};
    const before=await readDeployments();
    if(!before||!promotionPreStateExact(before,{retainedCreatedOn}))fail('TRANSPORT_REMEDIATED_PROMOTION_DEPLOYMENT_STATE_DRIFT');
    let topology;
    try{topology=await routeScan({account:accountId,topologyToken,fetchImpl:guard.fetch,workerName:PROMOTION_WORKER});}
    catch(error){if(String(error?.message).startsWith('TRANSPORT_REMEDIATED_PROMOTION_'))throw error;fail('TRANSPORT_REMEDIATED_PROMOTION_FINAL_ROUTE_SCAN_FAILED');}
    if(!validateZoneTopology(topology))fail('TRANSPORT_REMEDIATED_PROMOTION_FINAL_ROUTE_SCAN_NOT_INERT');
    finalRouteScan=Object.freeze({proof:topology.proof,zoneCount:topology.zoneCount,routeRowCount:topology.routeRowCount,routeCount:topology.routeCount});
    const versions=await readPromotionVersions({accountId,readToken,fetchImpl:guard.fetch});
    const versionDiagnostic=promotionVersionInventoryDiagnostic(versions);
    if(versionDiagnostic)fail('TRANSPORT_REMEDIATED_PROMOTION_VERSION_STATE_DRIFT');

    const post=async()=>{
      let response,payload;
      try{
        response=await guard.fetch('https://'+API_HOST+API_PREFIX+paths.deployments,{method:'POST',
          headers:{Authorization:'Bearer '+promotionToken,Accept:'application/json','Content-Type':'application/json'},body,redirect:'manual',signal:AbortSignal.timeout(PROMOTION_POST_TIMEOUT_MS)});
        payload=await response.json();
      }catch(error){
        if(String(error?.message).startsWith('TRANSPORT_REMEDIATED_PROMOTION_'))throw error;
        return {kind:'AMBIGUOUS'};
      }
      if(response.status>=400&&response.status<500&&payload?.success===false&&Array.isArray(payload?.errors))return {kind:'REJECTED'};
      if(response.ok&&payload?.success===true)return {kind:'OK',result:payload.result};
      return {kind:'AMBIGUOUS'};
    };
    const result=await submitPromotionDeployment({post,readDeployments,retainedCreatedOn,wait});
    return evidence({outcome:result.outcome,deploymentId:result.deploymentId,readbackAttempts:result.readbackAttempts,
      diagnostic:['CREATED','APPLIED_CONFIRMED_BY_READBACK'].includes(result.outcome)?'TRANSPORT_REMEDIATED_PROMOTION_SUBMITTED':'TRANSPORT_REMEDIATED_PROMOTION_'+result.outcome});
  }catch(error){
    const attempts=guard?.counters.deploymentPostAttempts??0;
    return evidence({outcome:attempts>0?'AMBIGUOUS_OWNER_ATTENTION':'NOT_SUBMITTED',diagnostic:closedDiagnostic(error)});
  }
}

export async function main(){
  for(const name of ['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_ATTENDED_READ_TOKEN','CLOUDFLARE_REMEDIATED_DEPLOYMENT_PROMOTION_TOKEN','CLOUDFLARE_TOPOLOGY_READ_TOKEN']){
    const value=process.env[name];if(typeof value==='string'&&value)process.stdout.write('::add-mask::'+value+'\n');
  }
  const output=await executeTransportRemediatedDeploymentPromotion();
  const outputPath=process.env.API_FOOTBALL_DEPLOYMENT_PROMOTION_EXECUTION_REPORT_PATH;
  if(outputPath)fs.writeFileSync(outputPath,JSON.stringify(output,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({ok:output.ok,classification:output.classification,outcome:output.outcome,diagnostic:output.diagnostic,deploymentPostAttempts:output.deploymentPostAttempts,retryAuthorized:false}));
  return output.ok?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
