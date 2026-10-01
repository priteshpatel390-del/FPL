import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {REPLACEMENT_COLLECTOR,REPLACEMENT_RECOVERY_WORKER_ID} from './replacement-foundation.mjs';
import {readReplacementState} from './replacement-reconciliation.mjs';

export const REPLACEMENT_ONE_VERSION_RECONCILIATION_VERSION='api-football-replacement-one-version-reconciliation-v1';
export const REPLACEMENT_LIVE_VERSION_ID='995b0396-a61e-4bee-a405-aa6b3f765e5c';
export const REPLACEMENT_LIVE_VERSION_APPROVED_SHA='18f5748ff88403cdbd89019ca3306706364962ea';
export const REPLACEMENT_LIVE_RECOVERY_RUN_ID='36820805445';

const HEX40=/^[0-9a-f]{40}$/;
const HEX64=/^[0-9a-f]{64}$/;
const fail=code=>{throw new Error(code);};
const digest=value=>createHash('sha256').update(String(value)).digest('hex');
const knownFailure=error=>{
  const message=String(error?.message??'');
  if(/^replacement_one_version_[A-Za-z0-9_]{1,96}$/.test(message)||/^replacement_reconciliation_[A-Za-z0-9_]{1,96}$/.test(message))return message;
  return 'replacement_one_version_failed_unknown';
};

function commonOneVersionState(state){
  return state?.present===true&&state.workerName===REPLACEMENT_COLLECTOR&&state.workerId===REPLACEMENT_RECOVERY_WORKER_ID&&
    state.workerDeployedOnNull===true&&state.workersDev===false&&state.versionId===REPLACEMENT_LIVE_VERSION_ID&&state.versionCount===1&&
    state.versionInventoryExact===true&&state.versionIdentityExact===true&&state.deploymentCount===0&&state.cronCount===0&&
    state.routeCount===0&&state.routeProof==='ZONE_ROUTE_SCAN'&&Number.isInteger(state.topologyZoneCount)&&state.topologyZoneCount>=0&&
    state.customDomainCount===0;
}
export function validateReplacementOneVersionInactiveState(state){
  if(!commonOneVersionState(state)||state.previewUrls!==false)fail('replacement_one_version_state_invalid');
  return true;
}

export async function runReplacementOneVersionReconciliation({env=process.env,fetchImpl=globalThis.fetch}={}){
  const account=env.CLOUDFLARE_ACCOUNT_ID,fingerprint=env.CLOUDFLARE_ACCOUNT_FINGERPRINT,approvedSha=env.APPROVED_SHA;
  const readToken=env.CLOUDFLARE_REPLACEMENT_READ_TOKEN,topologyToken=env.CLOUDFLARE_REPLACEMENT_TOPOLOGY_READ_TOKEN;
  if(typeof account!=='string'||!account||!HEX64.test(String(fingerprint||''))||digest(account)!==fingerprint||!HEX40.test(String(approvedSha||''))||
    typeof readToken!=='string'||!readToken||typeof topologyToken!=='string'||!topologyToken||readToken===topologyToken)fail('replacement_one_version_identity_invalid');
  let replacement=null;
  try{
    replacement=await readReplacementState({account,token:readToken,topologyToken,versionId:REPLACEMENT_LIVE_VERSION_ID,approvedSha,
      versionApprovedSha:REPLACEMENT_LIVE_VERSION_APPROVED_SHA,fetchImpl});
    if(commonOneVersionState(replacement)&&replacement.previewUrls===true){
      return Object.freeze({version:REPLACEMENT_ONE_VERSION_RECONCILIATION_VERSION,approvedSha,sourceRunId:REPLACEMENT_LIVE_RECOVERY_RUN_ID,
        classification:'REPLACEMENT_ONE_VERSION_PREVIEW_ENABLED_OWNER_ATTENTION',reason:'replacement_one_version_preview_still_enabled',ok:false,safeStateProved:false,
        replacementWorker:REPLACEMENT_COLLECTOR,workerId:REPLACEMENT_RECOVERY_WORKER_ID,versionId:REPLACEMENT_LIVE_VERSION_ID,
        versionApprovedSha:REPLACEMENT_LIVE_VERSION_APPROVED_SHA,replacement,productionMutations:0,apiFootballRequests:0,secretValuesRead:0,retryAuthorized:false});
    }
    validateReplacementOneVersionInactiveState(replacement);
    return Object.freeze({version:REPLACEMENT_ONE_VERSION_RECONCILIATION_VERSION,approvedSha,sourceRunId:REPLACEMENT_LIVE_RECOVERY_RUN_ID,
      classification:'REPLACEMENT_ONE_VERSION_INACTIVE_RECONCILED',reason:null,ok:true,safeStateProved:true,replacementWorker:REPLACEMENT_COLLECTOR,
      workerId:REPLACEMENT_RECOVERY_WORKER_ID,versionId:REPLACEMENT_LIVE_VERSION_ID,versionApprovedSha:REPLACEMENT_LIVE_VERSION_APPROVED_SHA,replacement,
      productionMutations:0,apiFootballRequests:0,secretValuesRead:0,retryAuthorized:false});
  }catch(error){
    return Object.freeze({version:REPLACEMENT_ONE_VERSION_RECONCILIATION_VERSION,approvedSha,sourceRunId:REPLACEMENT_LIVE_RECOVERY_RUN_ID,
      classification:'REPLACEMENT_ONE_VERSION_OWNER_ATTENTION_REQUIRED',reason:knownFailure(error),ok:false,safeStateProved:false,
      replacementWorker:REPLACEMENT_COLLECTOR,workerId:REPLACEMENT_RECOVERY_WORKER_ID,versionId:REPLACEMENT_LIVE_VERSION_ID,
      versionApprovedSha:REPLACEMENT_LIVE_VERSION_APPROVED_SHA,replacement,productionMutations:0,apiFootballRequests:0,secretValuesRead:0,retryAuthorized:false});
  }
}

export async function main(){
  let result;
  try{result=await runReplacementOneVersionReconciliation();}
  catch(error){result={version:REPLACEMENT_ONE_VERSION_RECONCILIATION_VERSION,approvedSha:process.env.APPROVED_SHA??null,sourceRunId:REPLACEMENT_LIVE_RECOVERY_RUN_ID,
    classification:'REPLACEMENT_ONE_VERSION_OWNER_ATTENTION_REQUIRED',reason:knownFailure(error),ok:false,safeStateProved:false,replacementWorker:REPLACEMENT_COLLECTOR,
    workerId:REPLACEMENT_RECOVERY_WORKER_ID,versionId:REPLACEMENT_LIVE_VERSION_ID,versionApprovedSha:REPLACEMENT_LIVE_VERSION_APPROVED_SHA,replacement:null,
    productionMutations:0,apiFootballRequests:0,secretValuesRead:0,retryAuthorized:false};}
  if(process.env.API_FOOTBALL_REPLACEMENT_ONE_VERSION_RECONCILIATION_PATH)fs.writeFileSync(process.env.API_FOOTBALL_REPLACEMENT_ONE_VERSION_RECONCILIATION_PATH,JSON.stringify(result,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({classification:result.classification,reason:result.reason,ok:result.ok,safeStateProved:result.safeStateProved,retryAuthorized:false}));
  return result.ok?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
