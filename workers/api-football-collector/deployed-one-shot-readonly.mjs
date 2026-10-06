// Read-only admission and independent reconciliation for the deployed one-shot shadow collection.
// Zero mutations, zero provider requests, zero secret-value reads.
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {runApiFootballActivationLivePreflight} from './activation-live-preflight.mjs';
import {readReplacementRouteTopology} from './replacement-reconciliation.mjs';
import {
  DEPLOYED_ONE_SHOT_CLONE_APPROVED_SHA,DEPLOYED_ONE_SHOT_CLONE_VERSION_ID,DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE,DEPLOYED_ONE_SHOT_RECONCILIATION_VERSION,
  DEPLOYED_ONE_SHOT_VERSION_APPROVED_SHA,DEPLOYED_ONE_SHOT_VERSION_ID,DEPLOYED_ONE_SHOT_WORKER,
  buildDeployedOneShotAdmission,classifyDeployedOneShotReconciliation,deploymentListState
} from './deployed-one-shot.mjs';

const API='https://api.cloudflare.com/client/v4';
const HEX40=/^[0-9a-f]{40}$/;
const HEX64=/^[0-9a-f]{64}$/;
const digest=value=>createHash('sha256').update(String(value)).digest('hex');
const zero=Object.freeze({productionMutations:0,apiFootballRequests:0,secretValuesRead:0});

export function deployedOneShotPreflightEnv({accountId,accountFingerprint,readToken,approvedSha}){
  return Object.freeze({
    DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID:accountId,DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT:accountFingerprint,DATA_STEWARD_CLOUDFLARE_READ_TOKEN:readToken,
    API_FOOTBALL_PREFLIGHT_STAGE:DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE,APPROVED_SHA:approvedSha,
    API_FOOTBALL_ATTENDED_VERSION_ID:DEPLOYED_ONE_SHOT_VERSION_ID,API_FOOTBALL_ATTENDED_VERSION_APPROVED_SHA:DEPLOYED_ONE_SHOT_VERSION_APPROVED_SHA,
    API_FOOTBALL_LIFECYCLE_CLONE_VERSION_ID:DEPLOYED_ONE_SHOT_CLONE_VERSION_ID,API_FOOTBALL_LIFECYCLE_CLONE_APPROVED_SHA:DEPLOYED_ONE_SHOT_CLONE_APPROVED_SHA
  });
}

function readIdentity(env){
  const accountId=env.DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID,accountFingerprint=env.DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT;
  const readToken=env.DATA_STEWARD_CLOUDFLARE_READ_TOKEN,topologyToken=env.CLOUDFLARE_TOPOLOGY_READ_TOKEN,approvedSha=env.APPROVED_SHA;
  if(typeof accountId!=='string'||!accountId||!HEX64.test(String(accountFingerprint||''))||digest(accountId)!==accountFingerprint||
    typeof readToken!=='string'||!readToken||typeof topologyToken!=='string'||!topologyToken||readToken===topologyToken||!HEX40.test(String(approvedSha||'')))return null;
  return Object.freeze({accountId,accountFingerprint,readToken,topologyToken,approvedSha});
}

async function readTopology(identity,fetchImpl){
  try{return {topology:await readReplacementRouteTopology({account:identity.accountId,topologyToken:identity.topologyToken,fetchImpl,workerName:DEPLOYED_ONE_SHOT_WORKER}),failure:null};}
  catch{return {topology:null,failure:'zone_route_topology_unreadable'};}
}

export async function readDeploymentState({accountId,readToken,fetchImpl=globalThis.fetch}){
  let response,payload;
  try{
    response=await fetchImpl(`${API}/accounts/${encodeURIComponent(accountId)}/workers/scripts/${DEPLOYED_ONE_SHOT_WORKER}/deployments`,
      {method:'GET',headers:{Authorization:'Bearer '+readToken,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15_000)});
    payload=await response.json();
  }catch{return null;}
  if(!response.ok||payload?.success!==true)return null;
  return deploymentListState(payload.result);
}

export async function runDeployedOneShotAdmission({env=process.env,fetchImpl=globalThis.fetch,preflight=runApiFootballActivationLivePreflight}={}){
  const identity=readIdentity(env);
  if(!identity)return buildDeployedOneShotAdmission({report:null,topology:null,approvedSha:env.APPROVED_SHA??null,accountFingerprint:null});
  const report=await preflight({env:deployedOneShotPreflightEnv(identity),fetchImpl,stage:DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE});
  const {topology,failure}=await readTopology(identity,fetchImpl);
  return buildDeployedOneShotAdmission({report,topology,topologyFailure:failure,approvedSha:identity.approvedSha,accountFingerprint:identity.accountFingerprint});
}

export async function runDeployedOneShotReconciliation({env=process.env,fetchImpl=globalThis.fetch,preflight=runApiFootballActivationLivePreflight,execution=null}={}){
  const identity=readIdentity(env);
  if(!identity)return Object.freeze({version:DEPLOYED_ONE_SHOT_RECONCILIATION_VERSION,ok:false,classification:'DEPLOYED_ONE_SHOT_OWNER_ATTENTION_REQUIRED',reason:'reconciliation_identity_invalid',retryAuthorized:false,observed:null,evidence:zero});
  const report=await preflight({env:deployedOneShotPreflightEnv(identity),fetchImpl,stage:DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE});
  const deployments=await readDeploymentState({accountId:identity.accountId,readToken:identity.readToken,fetchImpl});
  const {topology}=await readTopology(identity,fetchImpl);
  const result=classifyDeployedOneShotReconciliation({report,deployments,topology,execution,approvedSha:identity.approvedSha,accountFingerprint:identity.accountFingerprint});
  return Object.freeze({...result,approvedSha:identity.approvedSha,
    observed:Object.freeze({
      preflightClassification:report?.classification??null,preflightReason:report?.reason??null,
      runtime:report?.runtime??null,priorState:report?.priorState??null,
      topology:Object.freeze({workersDev:report?.inventory?.workersDev??null,previewUrls:report?.inventory?.previewUrls??null,cronCount:report?.inventory?.cronCount??null,
        customDomainCount:report?.inventory?.customDomainCount??null,legacyRouteCount:report?.inventory?.routeCount??null,
        zoneRouteProof:topology?.proof??null,zoneRouteCount:topology?.routeCount??null,deploymentCount:deployments?.count??null,deploymentExact:deployments?.exactSingle??null,deploymentId:deployments?.deploymentId??null}),
      versionInventoryExact:report?.inventory?.versionInventoryExact??null,mapping:report?.mapping??null,officialFplAuthority:report?.officialFplAuthority??null,
      modelUiImportCount:report?.modelUiImportCount??null,rawPayloadStoragePresent:report?.rawPayloadStoragePresent??null
    }),
    evidence:zero});
}

export async function main(){
  const mode=process.env.API_FOOTBALL_DEPLOYED_ONE_SHOT_MODE,outputPath=process.env.API_FOOTBALL_DEPLOYED_ONE_SHOT_REPORT_PATH;
  let result;
  if(mode==='ADMISSION')result=await runDeployedOneShotAdmission();
  else if(mode==='RECONCILIATION'){
    const executionPath=process.env.API_FOOTBALL_DEPLOYED_ONE_SHOT_EXECUTION_PATH;
    const execution=executionPath?JSON.parse(fs.readFileSync(executionPath,'utf8')):null;
    result=await runDeployedOneShotReconciliation({execution});
  }else throw new Error('deployed_one_shot_mode_invalid');
  if(outputPath)fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({ok:result.ok,classification:result.classification,reason:result.reason??null,retryAuthorized:false,...zero}));
  return result.ok?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
