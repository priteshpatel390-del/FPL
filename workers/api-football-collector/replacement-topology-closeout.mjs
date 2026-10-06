import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {REPLACEMENT_COLLECTOR,REPLACEMENT_RECOVERY_WORKER_ID} from './replacement-foundation.mjs';
import {readReplacementState} from './replacement-reconciliation.mjs';

export const REPLACEMENT_TOPOLOGY_CLOSEOUT_VERSION='api-football-replacement-topology-closeout-v1';

const HEX40=/^[0-9a-f]{40}$/;
const HEX64=/^[0-9a-f]{64}$/;
const digest=value=>createHash('sha256').update(String(value)).digest('hex');
const closedReason=error=>{
  const message=String(error?.message??'');
  return /^replacement_reconciliation_[A-Za-z0-9_]{1,96}$/.test(message)?message:'replacement_topology_closeout_failed_unknown';
};

function sanitizedTopology(state){
  return Object.freeze({
    present:state?.present===true,
    workerIdentityExact:state?.present===true?state.workerName===REPLACEMENT_COLLECTOR&&state.workerId===REPLACEMENT_RECOVERY_WORKER_ID:null,
    workerDeployedOnNull:state?.workerDeployedOnNull??null,
    workersDev:state?.workersDev??null,
    previewUrls:state?.previewUrls??null,
    versionCount:Number.isSafeInteger(state?.versionCount)?state.versionCount:null,
    deploymentCount:Number.isSafeInteger(state?.deploymentCount)?state.deploymentCount:null,
    cronCount:Number.isSafeInteger(state?.cronCount)?state.cronCount:null,
    routeCount:Number.isSafeInteger(state?.routeCount)?state.routeCount:null,
    routeProof:typeof state?.routeProof==='string'?state.routeProof:null,
    topologyZoneCount:Number.isSafeInteger(state?.topologyZoneCount)?state.topologyZoneCount:null,
    topologyRouteRowCount:Number.isSafeInteger(state?.topologyRouteRowCount)?state.topologyRouteRowCount:null,
    legacyRouteCount:Number.isSafeInteger(state?.legacyRouteCount)?state.legacyRouteCount:null,
    customDomainCount:Number.isSafeInteger(state?.customDomainCount)?state.customDomainCount:null
  });
}

export function validateReplacementAbandonedTopology(state){
  if(!state||state.routeCount!==0||state.routeProof!=='ZONE_ROUTE_SCAN'||!Number.isInteger(state.topologyZoneCount)||state.topologyZoneCount<0||
    state.customDomainCount!==0)return false;
  if(state.present===false)return true;
  return state.present===true&&state.workerName===REPLACEMENT_COLLECTOR&&state.workerId===REPLACEMENT_RECOVERY_WORKER_ID&&
    state.workerDeployedOnNull===true&&state.workersDev===false&&state.previewUrls===false&&
    state.deploymentCount===0&&state.cronCount===0;
}

export async function runReplacementTopologyCloseout({env=process.env,fetchImpl=globalThis.fetch}={}){
  const account=env.CLOUDFLARE_ACCOUNT_ID,fingerprint=env.CLOUDFLARE_ACCOUNT_FINGERPRINT,approvedSha=env.APPROVED_SHA;
  const readToken=env.CLOUDFLARE_REPLACEMENT_READ_TOKEN,topologyToken=env.CLOUDFLARE_REPLACEMENT_TOPOLOGY_READ_TOKEN;
  if(typeof account!=='string'||!account||!HEX64.test(String(fingerprint||''))||digest(account)!==fingerprint||!HEX40.test(String(approvedSha||''))||
    typeof readToken!=='string'||!readToken||typeof topologyToken!=='string'||!topologyToken||readToken===topologyToken){
    return Object.freeze({version:REPLACEMENT_TOPOLOGY_CLOSEOUT_VERSION,approvedSha:approvedSha??null,classification:'REPLACEMENT_ABANDONED_TOPOLOGY_OWNER_ATTENTION',
      reason:'replacement_topology_closeout_identity_invalid',ok:false,topologySafeProved:false,topology:null,
      productionMutations:0,apiFootballRequests:0,secretValuesRead:0});
  }
  try{
    const state=await readReplacementState({account,token:readToken,topologyToken,versionId:null,approvedSha,fetchImpl});
    const topology=sanitizedTopology(state);
    const ok=validateReplacementAbandonedTopology(state);
    return Object.freeze({version:REPLACEMENT_TOPOLOGY_CLOSEOUT_VERSION,approvedSha,
      classification:ok?'REPLACEMENT_ABANDONED_TOPOLOGY_SAFE':'REPLACEMENT_ABANDONED_TOPOLOGY_OWNER_ATTENTION',
      reason:ok?null:'replacement_topology_not_inert',ok,topologySafeProved:ok,topology,
      productionMutations:0,apiFootballRequests:0,secretValuesRead:0});
  }catch(error){
    return Object.freeze({version:REPLACEMENT_TOPOLOGY_CLOSEOUT_VERSION,approvedSha,classification:'REPLACEMENT_ABANDONED_TOPOLOGY_OWNER_ATTENTION',
      reason:closedReason(error),ok:false,topologySafeProved:false,topology:null,
      productionMutations:0,apiFootballRequests:0,secretValuesRead:0});
  }
}

export async function main(){
  const result=await runReplacementTopologyCloseout();
  if(process.env.API_FOOTBALL_REPLACEMENT_TOPOLOGY_CLOSEOUT_PATH)fs.writeFileSync(process.env.API_FOOTBALL_REPLACEMENT_TOPOLOGY_CLOSEOUT_PATH,JSON.stringify(result,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({classification:result.classification,reason:result.reason,ok:result.ok,topologySafeProved:result.topologySafeProved}));
  return result.ok?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
