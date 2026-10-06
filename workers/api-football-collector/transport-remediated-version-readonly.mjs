// Read-only admission and independent reconciliation for the transport-remediated Version preparation.
// Zero mutations, zero provider requests, zero secret-value reads, no Worker invocation, no Preview/workers.dev dependency.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {runApiFootballActivationLivePreflight} from './activation-live-preflight.mjs';
import {DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE,DEPLOYED_ONE_SHOT_VERSION_ID,DEPLOYED_ONE_SHOT_WORKER,DEPLOYED_ONE_SHOT_WORKER_ID} from './deployed-one-shot.mjs';
import {deployedOneShotPreflightEnv,readIdentity,readTopology,zero} from './deployed-one-shot-readonly.mjs';
import {extractVersionIds} from './stage-inactive-version.mjs';
import {
  TRANSPORT_REMEDIATED_RECONCILIATION_VERSION,activeDeploymentState,buildTransportRemediatedAdmission,classifyTransportRemediatedReconciliation
} from './transport-remediated-version-preparation.mjs';
import {TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS} from './transport-remediated-version.mjs';

const API='https://api.cloudflare.com/client/v4';
const enc=value=>encodeURIComponent(String(value));

export function transportRemediatedReadPaths(accountId){
  const script='/accounts/'+enc(accountId)+'/workers/scripts/'+DEPLOYED_ONE_SHOT_WORKER;
  return Object.freeze({
    deployments:script+'/deployments',versions:script+'/versions?deployable=true',stableVersion:id=>script+'/versions/'+enc(id),
    betaVersion:(workerId,id)=>'/accounts/'+enc(accountId)+'/workers/workers/'+enc(workerId)+'/versions/'+enc(id)+'?include=modules'
  });
}

async function cloudflareGet(fetchImpl,requestPath,token){
  try{
    const response=await fetchImpl(API+requestPath,{method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15_000)});
    const payload=await response.json();
    return response.ok&&payload?.success===true?payload.result:null;
  }catch{return null;}
}

export async function readActiveDeploymentState({accountId,readToken,fetchImpl=globalThis.fetch}){
  const result=await cloudflareGet(fetchImpl,transportRemediatedReadPaths(accountId).deployments,readToken);
  return result===null?null:activeDeploymentState(result);
}

export async function readVersionIds({accountId,readToken,fetchImpl=globalThis.fetch}){
  const result=await cloudflareGet(fetchImpl,transportRemediatedReadPaths(accountId).versions,readToken);
  if(result===null)return null;
  try{return extractVersionIds(result);}catch{return null;}
}

export async function runTransportRemediatedAdmission({env=process.env,fetchImpl=globalThis.fetch,preflight=runApiFootballActivationLivePreflight}={}){
  const identity=readIdentity(env);
  if(!identity)return buildTransportRemediatedAdmission({report:null,deployments:null,topology:null,approvedSha:env.APPROVED_SHA??null,accountFingerprint:null});
  const report=await preflight({env:deployedOneShotPreflightEnv(identity),fetchImpl,stage:DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE});
  const deployments=await readActiveDeploymentState({accountId:identity.accountId,readToken:identity.readToken,fetchImpl});
  const {topology,failure}=await readTopology(identity,fetchImpl);
  return buildTransportRemediatedAdmission({report,deployments,topology,topologyFailure:failure,approvedSha:identity.approvedSha,accountFingerprint:identity.accountFingerprint});
}

export async function runTransportRemediatedReconciliation({env=process.env,fetchImpl=globalThis.fetch,preflight=runApiFootballActivationLivePreflight,execution=null,identity:expectedIdentity}={}){
  const identity=readIdentity(env);
  if(!identity)return Object.freeze({version:TRANSPORT_REMEDIATED_RECONCILIATION_VERSION,ok:false,classification:'TRANSPORT_REMEDIATED_VERSION_OWNER_ATTENTION_REQUIRED',reason:'reconciliation_identity_invalid',retryAuthorized:false,observed:null,evidence:zero});
  const {accountId,readToken}=identity,paths=transportRemediatedReadPaths(accountId);
  const report=await preflight({env:deployedOneShotPreflightEnv(identity),fetchImpl,stage:DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE});
  const deployments=await readActiveDeploymentState({accountId,readToken,fetchImpl});
  const {topology}=await readTopology(identity,fetchImpl);
  const versionIds=await readVersionIds({accountId,readToken,fetchImpl});
  const fresh=Array.isArray(versionIds)?versionIds.filter(id=>!TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS.includes(id)):[];
  let candidate=null,attended=null;
  const workerId=report?.inventory?.reviewedWorkerId;
  if(fresh.length===1&&workerId===DEPLOYED_ONE_SHOT_WORKER_ID){
    const [stable,beta,attendedStable,attendedBeta]=await Promise.all([
      cloudflareGet(fetchImpl,paths.stableVersion(fresh[0]),readToken),cloudflareGet(fetchImpl,paths.betaVersion(workerId,fresh[0]),readToken),
      cloudflareGet(fetchImpl,paths.stableVersion(DEPLOYED_ONE_SHOT_VERSION_ID),readToken),cloudflareGet(fetchImpl,paths.betaVersion(workerId,DEPLOYED_ONE_SHOT_VERSION_ID),readToken)
    ]);
    candidate={versionId:fresh[0],stable,beta};attended={stable:attendedStable,beta:attendedBeta};
  }
  const result=classifyTransportRemediatedReconciliation({report,versionIds,candidate,attended,deployments,topology,execution,identity:expectedIdentity,
    approvedSha:identity.approvedSha,accountFingerprint:identity.accountFingerprint});
  return Object.freeze({...result,approvedSha:identity.approvedSha,
    observed:Object.freeze({
      preflightClassification:report?.classification??null,preflightReason:report?.reason??null,
      runtime:report?.runtime??null,priorState:report?.priorState??null,
      topology:Object.freeze({workersDev:report?.inventory?.workersDev??null,previewUrls:report?.inventory?.previewUrls??null,cronCount:report?.inventory?.cronCount??null,
        customDomainCount:report?.inventory?.customDomainCount??null,legacyRouteCount:report?.inventory?.routeCount??null,
        zoneRouteProof:topology?.proof??null,zoneRouteCount:topology?.routeCount??null}),
      deployments:Object.freeze({count:deployments?.count??null,activeDeploymentId:deployments?.activeDeploymentId??null,
        selectsRetainedVersionAt100:deployments?.selectsRetainedVersionAt100??null}),
      versionCount:Array.isArray(versionIds)?versionIds.length:null,candidateVersionId:fresh.length===1?fresh[0]:null,
      mapping:report?.mapping??null,officialFplAuthority:report?.officialFplAuthority??null,
      modelUiImportCount:report?.modelUiImportCount??null,rawPayloadStoragePresent:report?.rawPayloadStoragePresent??null
    }),
    evidence:zero});
}

export async function main(){
  const mode=process.env.API_FOOTBALL_TRANSPORT_REMEDIATED_MODE,outputPath=process.env.API_FOOTBALL_TRANSPORT_REMEDIATED_REPORT_PATH;
  let result;
  if(mode==='ADMISSION')result=await runTransportRemediatedAdmission();
  else if(mode==='RECONCILIATION'){
    const executionPath=process.env.API_FOOTBALL_TRANSPORT_REMEDIATED_EXECUTION_PATH;
    const execution=executionPath?JSON.parse(fs.readFileSync(executionPath,'utf8')):null;
    result=await runTransportRemediatedReconciliation({execution});
  }else throw new Error('transport_remediated_mode_invalid');
  if(outputPath)fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({ok:result.ok,classification:result.classification,reason:result.reason??null,retryAuthorized:false,...zero}));
  return result.ok?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
