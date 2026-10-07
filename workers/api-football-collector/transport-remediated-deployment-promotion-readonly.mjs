// Read-only admission and independent reconciliation for the transport-remediated Deployment promotion (Gate B).
// Zero mutations, zero provider requests, zero secret-value reads, no Worker invocation, no workers.dev/Preview dependency.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {runApiFootballActivationLivePreflight} from './activation-live-preflight.mjs';
import {ORIGINAL_BLOCKED_VERSION_ID} from './attended-version.mjs';
import {DEPLOYED_ONE_SHOT_CLONE_VERSION_ID,DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE} from './deployed-one-shot.mjs';
import {deployedOneShotPreflightEnv,readIdentity,readTopology,zero} from './deployed-one-shot-readonly.mjs';
import {extractVersionIds} from './stage-inactive-version.mjs';
import {
  PROMOTION_CANDIDATE_VERSION_ID,PROMOTION_RECONCILIATION_VERSION,PROMOTION_RETAINED_VERSION_ID,PROMOTION_WORKER,PROMOTION_WORKER_ID,
  buildPromotionAdmission,classifyPromotionReconciliation,promotionDeploymentRows
} from './transport-remediated-deployment-promotion.mjs';

const API='https://api.cloudflare.com/client/v4';
const enc=value=>encodeURIComponent(String(value));

export function promotionReadPaths(accountId){
  const script='/accounts/'+enc(accountId)+'/workers/scripts/'+PROMOTION_WORKER;
  return Object.freeze({
    deployments:script+'/deployments',versions:script+'/versions?deployable=true',stableVersion:id=>script+'/versions/'+enc(id),
    betaVersion:id=>'/accounts/'+enc(accountId)+'/workers/workers/'+enc(PROMOTION_WORKER_ID)+'/versions/'+enc(id)+'?include=modules'
  });
}

async function cloudflareGet(fetchImpl,requestPath,token){
  try{
    const response=await fetchImpl(API+requestPath,{method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15_000)});
    const payload=await response.json();
    return response.ok&&payload?.success===true?payload.result:null;
  }catch{return null;}
}

// Reads exactly the Version list plus stable detail for all four Versions and beta (module) detail for the three
// Versions whose module bytes are reproducible. GET only.
export async function readPromotionVersions({accountId,readToken,fetchImpl=globalThis.fetch}){
  const paths=promotionReadPaths(accountId);
  const list=await cloudflareGet(fetchImpl,paths.versions,readToken);
  let versionIds=null;if(list!==null){try{versionIds=extractVersionIds(list);}catch{versionIds=null;}}
  const [originalStable,attendedStable,attendedBeta,cloneStable,cloneBeta,candidateStable,candidateBeta]=await Promise.all([
    cloudflareGet(fetchImpl,paths.stableVersion(ORIGINAL_BLOCKED_VERSION_ID),readToken),
    cloudflareGet(fetchImpl,paths.stableVersion(PROMOTION_RETAINED_VERSION_ID),readToken),
    cloudflareGet(fetchImpl,paths.betaVersion(PROMOTION_RETAINED_VERSION_ID),readToken),
    cloudflareGet(fetchImpl,paths.stableVersion(DEPLOYED_ONE_SHOT_CLONE_VERSION_ID),readToken),
    cloudflareGet(fetchImpl,paths.betaVersion(DEPLOYED_ONE_SHOT_CLONE_VERSION_ID),readToken),
    cloudflareGet(fetchImpl,paths.stableVersion(PROMOTION_CANDIDATE_VERSION_ID),readToken),
    cloudflareGet(fetchImpl,paths.betaVersion(PROMOTION_CANDIDATE_VERSION_ID),readToken)
  ]);
  return Object.freeze({versionIds,originalStable,attended:{stable:attendedStable,beta:attendedBeta},clone:{stable:cloneStable,beta:cloneBeta},
    candidate:{stable:candidateStable,beta:candidateBeta}});
}

export async function readPromotionDeploymentRows({accountId,readToken,fetchImpl=globalThis.fetch}){
  const result=await cloudflareGet(fetchImpl,promotionReadPaths(accountId).deployments,readToken);
  return result===null?null:promotionDeploymentRows(result);
}

export async function runPromotionAdmission({env=process.env,fetchImpl=globalThis.fetch,preflight=runApiFootballActivationLivePreflight}={}){
  const identity=readIdentity(env);
  if(!identity)return buildPromotionAdmission({report:null,deploymentRows:null,versions:null,topology:null,approvedSha:env.APPROVED_SHA??null,accountFingerprint:null});
  const report=await preflight({env:deployedOneShotPreflightEnv(identity),fetchImpl,stage:DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE});
  const deploymentRows=await readPromotionDeploymentRows({accountId:identity.accountId,readToken:identity.readToken,fetchImpl});
  const versions=await readPromotionVersions({accountId:identity.accountId,readToken:identity.readToken,fetchImpl});
  const {topology,failure}=await readTopology(identity,fetchImpl);
  return buildPromotionAdmission({report,deploymentRows,versions,topology,topologyFailure:failure,approvedSha:identity.approvedSha,accountFingerprint:identity.accountFingerprint});
}

export async function runPromotionReconciliation({env=process.env,fetchImpl=globalThis.fetch,preflight=runApiFootballActivationLivePreflight,execution=null}={}){
  const identity=readIdentity(env);
  if(!identity)return Object.freeze({version:PROMOTION_RECONCILIATION_VERSION,ok:false,classification:'TRANSPORT_REMEDIATED_DEPLOYMENT_PROMOTION_OWNER_ATTENTION_REQUIRED',reason:'reconciliation_identity_invalid',retryAuthorized:false,observed:null,evidence:zero});
  const report=await preflight({env:deployedOneShotPreflightEnv(identity),fetchImpl,stage:DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE});
  const deploymentRows=await readPromotionDeploymentRows({accountId:identity.accountId,readToken:identity.readToken,fetchImpl});
  const versions=await readPromotionVersions({accountId:identity.accountId,readToken:identity.readToken,fetchImpl});
  const {topology}=await readTopology(identity,fetchImpl);
  const result=classifyPromotionReconciliation({report,deploymentRows,versions,topology,execution,approvedSha:identity.approvedSha,accountFingerprint:identity.accountFingerprint});
  return Object.freeze({...result,approvedSha:identity.approvedSha,
    observed:Object.freeze({
      preflightClassification:report?.classification??null,preflightReason:report?.reason??null,
      runtime:report?.runtime??null,priorState:report?.priorState??null,
      topology:Object.freeze({workersDev:report?.inventory?.workersDev??null,previewUrls:report?.inventory?.previewUrls??null,cronCount:report?.inventory?.cronCount??null,
        customDomainCount:report?.inventory?.customDomainCount??null,legacyRouteCount:report?.inventory?.routeCount??null,
        zoneRouteProof:topology?.proof??null,zoneRouteCount:topology?.routeCount??null}),
      deployments:Array.isArray(deploymentRows)?Object.freeze(deploymentRows.map(row=>Object.freeze({id:row.id,strategy:row.strategy,versions:row.versions}))):null,
      versionCount:Array.isArray(versions?.versionIds)?versions.versionIds.length:null,
      mapping:report?.mapping??null,officialFplAuthority:report?.officialFplAuthority??null,
      modelUiImportCount:report?.modelUiImportCount??null,rawPayloadStoragePresent:report?.rawPayloadStoragePresent??null
    }),
    evidence:zero});
}

export async function main(){
  const mode=process.env.API_FOOTBALL_DEPLOYMENT_PROMOTION_MODE,outputPath=process.env.API_FOOTBALL_DEPLOYMENT_PROMOTION_REPORT_PATH;
  let result;
  if(mode==='ADMISSION')result=await runPromotionAdmission();
  else if(mode==='RECONCILIATION'){
    const executionPath=process.env.API_FOOTBALL_DEPLOYMENT_PROMOTION_EXECUTION_PATH;
    const execution=executionPath?JSON.parse(fs.readFileSync(executionPath,'utf8')):null;
    result=await runPromotionReconciliation({execution});
  }else throw new Error('transport_remediated_promotion_mode_invalid');
  if(outputPath)fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({ok:result.ok,classification:result.classification,reason:result.reason??null,retryAuthorized:false,...zero}));
  return result.ok?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
