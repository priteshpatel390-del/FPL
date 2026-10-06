// Read-only admission and independent reconciliation for the deployed one-shot CONTINUATION from the existing inert Deployment.
// Zero mutations, zero provider requests, zero secret-value reads. The one-Deployment state is accepted only here;
// the historical zero-Deployment admission is unchanged.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {runApiFootballActivationLivePreflight} from './activation-live-preflight.mjs';
import {
  DEPLOYED_ONE_SHOT_CONTINUATION_RECONCILIATION_VERSION,DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE,
  buildDeployedOneShotContinuationAdmission,classifyDeployedOneShotContinuationReconciliation
} from './deployed-one-shot.mjs';
import {deployedOneShotPreflightEnv,readDeploymentState,readIdentity,readTopology,zero} from './deployed-one-shot-readonly.mjs';

export async function runDeployedOneShotContinuationAdmission({env=process.env,fetchImpl=globalThis.fetch,preflight=runApiFootballActivationLivePreflight}={}){
  const identity=readIdentity(env);
  if(!identity)return buildDeployedOneShotContinuationAdmission({report:null,deployments:null,topology:null,approvedSha:env.APPROVED_SHA??null,accountFingerprint:null});
  const report=await preflight({env:deployedOneShotPreflightEnv(identity),fetchImpl,stage:DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE});
  const deployments=await readDeploymentState({accountId:identity.accountId,readToken:identity.readToken,fetchImpl});
  const {topology,failure}=await readTopology(identity,fetchImpl);
  return buildDeployedOneShotContinuationAdmission({report,deployments,topology,topologyFailure:failure,approvedSha:identity.approvedSha,accountFingerprint:identity.accountFingerprint});
}

export async function runDeployedOneShotContinuationReconciliation({env=process.env,fetchImpl=globalThis.fetch,preflight=runApiFootballActivationLivePreflight,execution=null}={}){
  const identity=readIdentity(env);
  if(!identity)return Object.freeze({version:DEPLOYED_ONE_SHOT_CONTINUATION_RECONCILIATION_VERSION,ok:false,classification:'DEPLOYED_ONE_SHOT_OWNER_ATTENTION_REQUIRED',reason:'reconciliation_identity_invalid',retryAuthorized:false,observed:null,evidence:zero});
  const report=await preflight({env:deployedOneShotPreflightEnv(identity),fetchImpl,stage:DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE});
  const deployments=await readDeploymentState({accountId:identity.accountId,readToken:identity.readToken,fetchImpl});
  const {topology}=await readTopology(identity,fetchImpl);
  const result=classifyDeployedOneShotContinuationReconciliation({report,deployments,topology,execution,approvedSha:identity.approvedSha,accountFingerprint:identity.accountFingerprint});
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
  if(mode==='ADMISSION')result=await runDeployedOneShotContinuationAdmission();
  else if(mode==='RECONCILIATION'){
    const executionPath=process.env.API_FOOTBALL_DEPLOYED_ONE_SHOT_EXECUTION_PATH;
    const execution=executionPath?JSON.parse(fs.readFileSync(executionPath,'utf8')):null;
    result=await runDeployedOneShotContinuationReconciliation({execution});
  }else throw new Error('deployed_one_shot_mode_invalid');
  if(outputPath)fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({ok:result.ok,classification:result.classification,reason:result.reason??null,retryAuthorized:false,...zero}));
  return result.ok?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
