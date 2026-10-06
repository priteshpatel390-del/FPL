// Protected executor for ONE transport-remediated reviewed Worker Version upload. Dormant: dispatch is separately owner-gated.
// The only Cloudflare mutation representable here is POST .../workers/scripts/<collector>/versions, submitted at most once and never resent.
// There is no Deployment, workers.dev, Preview, D1 write, Cron, route, domain, DELETE or PUT path, no Worker invocation and no
// API-Football egress: a guarded fetch refuses every other host, method and path before any network I/O.
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {assertActivationReadOnlySql,runApiFootballActivationLivePreflight} from './activation-live-preflight.mjs';
import {DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE,DEPLOYED_ONE_SHOT_WORKER} from './deployed-one-shot.mjs';
import {deployedOneShotPreflightEnv} from './deployed-one-shot-readonly.mjs';
import {readReplacementRouteTopology} from './replacement-reconciliation.mjs';
import {deployedOneShotFinalRouteScan} from './run-deployed-one-shot.mjs';
import {extractVersionIds} from './stage-inactive-version.mjs';
import {EXPECTED_D1_DATABASE_ID} from '../data-platform/phase4b/live-contract.mjs';
import {
  TRANSPORT_REMEDIATED_MAX_VERSION_UPLOADS,activeDeploymentState,buildTransportRemediatedExecutionEvidence,
  closedDiagnostic,submitTransportRemediatedVersionUpload,transportRemediatedAdmissionDiagnostic,validateTransportRemediatedAdmissionHandoff
} from './transport-remediated-version-preparation.mjs';
import {
  TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS,buildTransportRemediatedVersionIdentity,buildTransportRemediatedVersionUploadForm,validateTransportRemediatedSecretMaterial
} from './transport-remediated-version.mjs';

const API_HOST='api.cloudflare.com',API_PREFIX='/client/v4';
const HEX40=/^[0-9a-f]{40}$/;
const HEX64=/^[0-9a-f]{64}$/;
const fail=code=>{throw new Error(code);};
const digest=value=>createHash('sha256').update(String(value)).digest('hex');
const enc=value=>encodeURIComponent(String(value));
const delay=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const required=(env,name)=>typeof env[name]==='string'&&env[name]?env[name]:fail('TRANSPORT_REMEDIATED_ENVIRONMENT_INCOMPLETE');
export const TRANSPORT_REMEDIATED_UPLOAD_TIMEOUT_MS=30_000;
export const TRANSPORT_REMEDIATED_REQUEST_TIMEOUT_MS=15_000;

export function transportRemediatedPaths(accountId){
  if(typeof accountId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(accountId))fail('TRANSPORT_REMEDIATED_ACCOUNT_INVALID');
  const account='/accounts/'+enc(accountId),script=account+'/workers/scripts/'+DEPLOYED_ONE_SHOT_WORKER;
  return Object.freeze({versions:script+'/versions',versionList:script+'/versions?deployable=true',deployments:script+'/deployments',d1:account+'/d1/database/'+enc(EXPECTED_D1_DATABASE_ID)+'/query'});
}

// The ONLY mutation endpoint: the Version upload. Every other method/path (Deployment, subdomain, D1, schedules, routes,
// domains, Worker shell, DELETE, PUT) is refused before network.
export function assertTransportRemediatedMutationAllowed(method,requestPath,{accountId}={}){
  if(String(method).toUpperCase()==='POST'&&requestPath===transportRemediatedPaths(accountId).versions)return true;
  return fail('TRANSPORT_REMEDIATED_ENDPOINT_FORBIDDEN');
}

// Network-level allowlist. Reads: GET on the Cloudflare API only. Writes: the single Version POST (upload credential only, ceiling 1)
// and the read-only critical-recheck D1 query (read credential only, SELECT/PRAGMA foreign_key_check only). Anything else throws.
export function createTransportRemediatedGuardedFetch({accountId,readToken,uploadToken,fetchImpl=globalThis.fetch}={}){
  const paths=transportRemediatedPaths(accountId);
  const counters={versionUploadAttempts:0,d1ReadQueries:0,blockedEgress:0};
  const refuse=code=>{counters.blockedEgress+=1;return fail(code);};
  const guarded=async(input,init={})=>{
    let url;try{url=new URL(String(input));}catch{return refuse('TRANSPORT_REMEDIATED_EGRESS_FORBIDDEN');}
    if(url.protocol!=='https:'||url.hostname!==API_HOST||url.port||url.username||url.password||!url.pathname.startsWith(API_PREFIX+'/'))return refuse('TRANSPORT_REMEDIATED_EGRESS_FORBIDDEN');
    const method=String(init.method||'GET').toUpperCase(),requestPath=url.pathname.slice(API_PREFIX.length)+url.search;
    const authorization=init.headers?.Authorization??init.headers?.authorization;
    if(method==='GET'){
      if(authorization==='Bearer '+uploadToken)return refuse('TRANSPORT_REMEDIATED_UPLOAD_CREDENTIAL_READ_FORBIDDEN');
      return fetchImpl(String(input),init);
    }
    if(method==='POST'&&requestPath===paths.versions){
      assertTransportRemediatedMutationAllowed(method,requestPath,{accountId});
      if(authorization!=='Bearer '+uploadToken)return refuse('TRANSPORT_REMEDIATED_UPLOAD_CREDENTIAL_REQUIRED');
      if(counters.versionUploadAttempts>=TRANSPORT_REMEDIATED_MAX_VERSION_UPLOADS)return refuse('TRANSPORT_REMEDIATED_UPLOAD_CEILING_EXCEEDED');
      counters.versionUploadAttempts+=1;
      return fetchImpl(String(input),init);
    }
    if(method==='POST'&&requestPath===paths.d1){
      let statements;try{statements=JSON.parse(init.body).batch;}catch{return refuse('TRANSPORT_REMEDIATED_D1_QUERY_FORBIDDEN');}
      if(authorization!=='Bearer '+readToken||!Array.isArray(statements)||statements.length===0)return refuse('TRANSPORT_REMEDIATED_D1_QUERY_FORBIDDEN');
      try{for(const statement of statements)assertActivationReadOnlySql(statement?.sql);}catch{return refuse('TRANSPORT_REMEDIATED_D1_QUERY_FORBIDDEN');}
      counters.d1ReadQueries+=1;
      return fetchImpl(String(input),init);
    }
    return refuse('TRANSPORT_REMEDIATED_ENDPOINT_FORBIDDEN');
  };
  return Object.freeze({fetch:guarded,counters});
}

async function cloudflareGet(guardedFetch,requestPath,token){
  try{
    const response=await guardedFetch('https://'+API_HOST+API_PREFIX+requestPath,{method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(TRANSPORT_REMEDIATED_REQUEST_TIMEOUT_MS)});
    if(response.status>=300&&response.status<400)return null;
    const payload=await response.json();
    return response.ok&&payload?.success===true?payload.result:null;
  }catch{return null;}
}

export async function executeTransportRemediatedVersionUpload({env=process.env,fetchImpl=globalThis.fetch,criticalRecheck=runApiFootballActivationLivePreflight,routeScan=readReplacementRouteTopology,wait=delay}={}){
  let approvedSha=null,guard=null,identity=null;
  const evidence=(fields)=>buildTransportRemediatedExecutionEvidence({approvedSha,identity,counters:{versionUploadAttempts:guard?.counters.versionUploadAttempts??0},...fields});
  try{
    // Every credential, secret and identity is validated before any network request. A GitHub re-run is refused outright.
    if(env.GITHUB_RUN_ATTEMPT!==undefined&&env.GITHUB_RUN_ATTEMPT!=='1')fail('TRANSPORT_REMEDIATED_RERUN_FORBIDDEN');
    const accountId=required(env,'CLOUDFLARE_ACCOUNT_ID'),fingerprint=required(env,'CLOUDFLARE_ACCOUNT_FINGERPRINT');
    const readToken=required(env,'CLOUDFLARE_ATTENDED_READ_TOKEN'),uploadToken=required(env,'CLOUDFLARE_ATTENDED_VERSION_UPLOAD_TOKEN');
    const topologyToken=required(env,'CLOUDFLARE_TOPOLOGY_READ_TOKEN');
    const apiKey=required(env,'API_FOOTBALL_API_KEY'),triggerSecret=required(env,'API_FOOTBALL_ATTENDED_TRIGGER_SECRET');
    approvedSha=required(env,'APPROVED_SHA');
    if(!HEX40.test(approvedSha))fail('TRANSPORT_REMEDIATED_APPROVED_SHA_INVALID');
    if(new Set([readToken,uploadToken,topologyToken]).size!==3)fail('TRANSPORT_REMEDIATED_CREDENTIAL_SEPARATION_REQUIRED');
    try{validateTransportRemediatedSecretMaterial({apiKey,triggerSecret});}catch{fail('TRANSPORT_REMEDIATED_SECRET_MATERIAL_INVALID');}
    if([apiKey,triggerSecret].some(secret=>[readToken,uploadToken,topologyToken].includes(secret)))fail('TRANSPORT_REMEDIATED_SECRET_MATERIAL_INVALID');
    if(!HEX64.test(fingerprint)||digest(accountId)!==fingerprint)fail('TRANSPORT_REMEDIATED_ACCOUNT_IDENTITY_MISMATCH');
    const admission=JSON.parse(fs.readFileSync(required(env,'API_FOOTBALL_TRANSPORT_REMEDIATED_ADMISSION_PATH'),'utf8'));
    validateTransportRemediatedAdmissionHandoff(admission,{approvedSha,accountFingerprint:fingerprint});
    // Current-tree identity and upload form are built before any network request: reviewed-source drift sends nothing.
    identity=buildTransportRemediatedVersionIdentity(approvedSha);
    const form=buildTransportRemediatedVersionUploadForm(approvedSha,{apiKey,triggerSecret});

    guard=createTransportRemediatedGuardedFetch({accountId,readToken,uploadToken,fetchImpl});
    const paths=transportRemediatedPaths(accountId);
    // Final pre-mutation proof: fresh critical state, fresh active Deployment, fresh authoritative zone route scan, fresh Version inventory.
    const critical=await criticalRecheck({env:deployedOneShotPreflightEnv({accountId,accountFingerprint:fingerprint,readToken,approvedSha}),fetchImpl:guard.fetch,stage:DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE});
    const deploymentsResult=await cloudflareGet(guard.fetch,paths.deployments,readToken);
    const deployments=deploymentsResult===null?null:activeDeploymentState(deploymentsResult);
    const drift=transportRemediatedAdmissionDiagnostic(critical,deployments,{approvedSha,accountFingerprint:fingerprint});
    if(drift)fail('TRANSPORT_REMEDIATED_CRITICAL_STATE_DRIFT__'+drift.toUpperCase());
    const finalRouteScan=await deployedOneShotFinalRouteScan({accountId,topologyToken,fetchImpl:guard.fetch,routeScan}).catch(error=>fail(String(error?.message).replace(/^DEPLOYED_ONE_SHOT_/,'TRANSPORT_REMEDIATED_')));
    const readVersions=async()=>{const result=await cloudflareGet(guard.fetch,paths.versionList,readToken);if(result===null)fail('TRANSPORT_REMEDIATED_VERSION_READ_FAILED');return extractVersionIds(result);};
    const beforeIds=await readVersions();
    if(beforeIds.length!==TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS.length||!TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS.every(id=>beforeIds.includes(id)))fail('TRANSPORT_REMEDIATED_START_VERSION_INVENTORY_DRIFT');

    const post=async()=>{
      let response,payload;
      try{
        response=await guard.fetch('https://'+API_HOST+API_PREFIX+paths.versions,{method:'POST',headers:{Authorization:'Bearer '+uploadToken,Accept:'application/json'},body:form,redirect:'manual',signal:AbortSignal.timeout(TRANSPORT_REMEDIATED_UPLOAD_TIMEOUT_MS)});
        payload=await response.json();
      }catch(error){
        if(String(error?.message).startsWith('TRANSPORT_REMEDIATED_'))throw error;
        return {kind:'AMBIGUOUS'};
      }
      if(response.status>=400&&response.status<500&&payload?.success===false)return {kind:'REJECTED'};
      if(response.ok&&payload?.success===true)return {kind:'OK',result:payload.result};
      return {kind:'AMBIGUOUS'};
    };
    const result=await submitTransportRemediatedVersionUpload({post,readVersions,beforeIds,wait});
    return evidence({outcome:result.outcome,versionId:result.versionId,readbackAttempts:result.readbackAttempts,finalRouteScan,
      diagnostic:['CREATED','APPLIED_CONFIRMED_BY_READBACK'].includes(result.outcome)?'TRANSPORT_REMEDIATED_VERSION_UPLOAD_SUBMITTED':'TRANSPORT_REMEDIATED_VERSION_UPLOAD_'+result.outcome});
  }catch(error){
    const attempts=guard?.counters.versionUploadAttempts??0;
    return evidence({outcome:attempts>0?'AMBIGUOUS_OWNER_ATTENTION':'NOT_SUBMITTED',diagnostic:closedDiagnostic(error)});
  }
}

export async function main(){
  for(const name of ['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_ATTENDED_READ_TOKEN','CLOUDFLARE_ATTENDED_VERSION_UPLOAD_TOKEN','CLOUDFLARE_TOPOLOGY_READ_TOKEN','API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET']){
    const value=process.env[name];if(typeof value==='string'&&value)process.stdout.write('::add-mask::'+value+'\n');
  }
  const output=await executeTransportRemediatedVersionUpload();
  const outputPath=process.env.API_FOOTBALL_TRANSPORT_REMEDIATED_EXECUTION_REPORT_PATH;
  if(outputPath)fs.writeFileSync(outputPath,JSON.stringify(output,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({ok:output.ok,classification:output.classification,outcome:output.outcome,diagnostic:output.diagnostic,versionUploadAttempts:output.versionUploadAttempts,retryAuthorized:false}));
  return output.ok?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
