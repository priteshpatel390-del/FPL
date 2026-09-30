import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {
  REPLACEMENT_COLLECTOR,buildReplacementIdentity,replacementPaths,validateReplacementReconciliation,validateReplacementVersion
} from './replacement-foundation.mjs';

const API='https://api.cloudflare.com/client/v4';
const fail=code=>{throw new Error(code);};
const enc=value=>encodeURIComponent(String(value));

async function request(path,{account,token,fetchImpl}){
  let response,payload;
  try{response=await fetchImpl(API+path,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(20_000)});payload=await response.json();}
  catch{return fail('replacement_reconciliation_read_failed');}
  if(!response.ok||payload?.success!==true)fail('replacement_reconciliation_read_failed');
  return payload.result;
}
const list=(value,key)=>Array.isArray(value)?value:Array.isArray(value?.[key])?value[key]:fail('replacement_reconciliation_shape_invalid');

// Reads replacement state without assuming a Version exists: an absent replacement, an inactive
// shell with zero Versions and an inactive shell with exactly one reviewed Version are all provable.
export async function readReplacementState({account,token,versionId=null,approvedSha,fetchImpl=globalThis.fetch}){
  const paths=replacementPaths(account);
  const betaWorkers=await request(paths.betaWorkers,{account,token,fetchImpl});
  const scripts=await request(paths.scripts,{account,token,fetchImpl}),domains=await request(paths.domains,{account,token,fetchImpl});
  const workers=list(betaWorkers,'items').filter(row=>row?.name===REPLACEMENT_COLLECTOR);
  const script=list(scripts,'items').find(row=>row?.id===REPLACEMENT_COLLECTOR);
  const customDomainCount=list(domains,'items').filter(row=>row?.service===REPLACEMENT_COLLECTOR).length;
  if(workers.length>1)fail('replacement_reconciliation_worker_invalid');
  if(workers.length===0){
    if(script||customDomainCount!==0)fail('replacement_reconciliation_worker_invalid');
    return Object.freeze({present:false,workerName:null,workerId:null,versionId:null,versionIds:Object.freeze([]),versionIdentityExact:null,scriptPresent:false,workersDev:null,previewUrls:null,versionCount:0,versionInventoryExact:true,deploymentCount:0,cronCount:0,routeCount:0,customDomainCount:0});
  }
  const worker=workers[0];
  const subdomain=await request(paths.replacementSubdomain,{account,token,fetchImpl});
  const deployments=await request(paths.replacementDeployments,{account,token,fetchImpl}),schedules=await request(paths.replacementSchedules,{account,token,fetchImpl});
  const versionRows=list(await request(paths.replacementVersions,{account,token,fetchImpl}),'items'),versionIds=versionRows.map(row=>row?.id).filter(id=>typeof id==='string');
  if(!script&&versionRows.length>0)fail('replacement_reconciliation_script_absent');
  let versionIdentityExact=null;
  if(versionId!==null){
    const stableVersion=await request(paths.replacement+'/'+enc(versionId),{account,token,fetchImpl});
    const betaVersion=await request(paths.createShell+'/'+enc(worker.id)+'/versions/'+enc(versionId)+'?include=modules',{account,token,fetchImpl});
    versionIdentityExact=false;try{validateReplacementVersion({stableVersion,betaVersion,versionId,identity:buildReplacementIdentity(approvedSha)});versionIdentityExact=true;}catch{}
  }
  return Object.freeze({
    present:true,workerName:worker.name,workerId:worker.id,versionId,versionIds:Object.freeze([...versionIds]),versionIdentityExact,scriptPresent:Boolean(script),
    workersDev:subdomain?.enabled!==false,previewUrls:subdomain?.previews_enabled!==false,
    versionCount:versionRows.length,versionInventoryExact:versionId===null?versionRows.length===0:versionRows.length===1&&versionRows[0]?.id===versionId,
    deploymentCount:list(deployments,'deployments').length,cronCount:list(schedules,'schedules').length,
    routeCount:Array.isArray(script?.routes)?script.routes.length:0,customDomainCount
  });
}

const knownFailure=error=>/^replacement_[A-Za-z0-9_]{1,96}$/.test(String(error?.message))?error.message:'replacement_reconciliation_failed_unknown';

export async function runReplacementReconciliation({env=process.env,fetchImpl=globalThis.fetch}={}){
  const execution=JSON.parse(fs.readFileSync(env.API_FOOTBALL_REPLACEMENT_EXECUTION_PATH,'utf8'));
  const originalReport=JSON.parse(fs.readFileSync(env.API_FOOTBALL_REPLACEMENT_ORIGINAL_REPORT_PATH,'utf8'));
  if(execution.approvedSha!==env.APPROVED_SHA||originalReport.approvedSha!==env.APPROVED_SHA)fail('replacement_reconciliation_sha_mismatch');
  let replacement=null;
  try{
    replacement=await readReplacementState({account:env.CLOUDFLARE_ACCOUNT_ID,token:env.CLOUDFLARE_REPLACEMENT_READ_TOKEN,versionId:typeof execution.versionId==='string'?execution.versionId:null,approvedSha:execution.approvedSha,fetchImpl});
    const result=validateReplacementReconciliation({execution,originalReport,replacement});
    return Object.freeze({...result,ok:true,executionClassification:execution.classification,approvedSha:execution.approvedSha,replacement,retryAuthorized:false});
  }catch(error){
    return Object.freeze({classification:'REPLACEMENT_INACTIVE_COLLECTOR_OWNER_ATTENTION_REQUIRED',reason:knownFailure(error),ok:false,foundationSucceeded:false,
      executionClassification:typeof execution.classification==='string'?execution.classification:null,replacementWorker:REPLACEMENT_COLLECTOR,approvedSha:execution.approvedSha,replacement,retryAuthorized:false});
  }
}

export async function main(){
  const result=await runReplacementReconciliation();
  if(process.env.API_FOOTBALL_REPLACEMENT_RECONCILIATION_PATH)fs.writeFileSync(process.env.API_FOOTBALL_REPLACEMENT_RECONCILIATION_PATH,JSON.stringify(result,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({classification:result.classification,foundationSucceeded:result.foundationSucceeded,replacementWorker:result.replacementWorker,retryAuthorized:false}));return result.ok?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
