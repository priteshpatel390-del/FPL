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

export async function readReplacementState({account,token,versionId,approvedSha,fetchImpl=globalThis.fetch}){
  const paths=replacementPaths(account);
  const betaWorkers=await request(paths.betaWorkers,{account,token,fetchImpl});
  const workers=list(betaWorkers,'items').filter(row=>row?.name===REPLACEMENT_COLLECTOR);
  if(workers.length!==1)fail('replacement_reconciliation_worker_invalid');
  const worker=workers[0],subdomain=await request(paths.replacementSubdomain,{account,token,fetchImpl});
  const deployments=await request(paths.replacementDeployments,{account,token,fetchImpl}),schedules=await request(paths.replacementSchedules,{account,token,fetchImpl});
  const versions=await request(paths.replacementVersions,{account,token,fetchImpl}),domains=await request(paths.domains,{account,token,fetchImpl}),scripts=await request(paths.scripts,{account,token,fetchImpl});
  const stableVersion=await request(paths.replacement+'/'+enc(versionId),{account,token,fetchImpl});
  const betaVersion=await request(paths.createShell+'/'+enc(worker.id)+'/versions/'+enc(versionId)+'?include=modules',{account,token,fetchImpl});
  let versionIdentityExact=false;try{validateReplacementVersion({stableVersion,betaVersion,versionId,identity:buildReplacementIdentity(approvedSha)});versionIdentityExact=true;}catch{}
  const script=list(scripts,'items').find(row=>row?.id===REPLACEMENT_COLLECTOR);if(!script)fail('replacement_reconciliation_script_absent');
  const versionRows=list(versions,'items');
  return Object.freeze({
    workerName:worker.name,workerId:worker.id,versionId,versionIdentityExact,
    workersDev:subdomain?.enabled===true,previewUrls:subdomain?.previews_enabled===true,
    versionCount:versionRows.length,versionInventoryExact:versionRows.length===1&&versionRows[0]?.id===versionId,
    deploymentCount:list(deployments,'deployments').length,cronCount:list(schedules,'schedules').length,
    routeCount:Array.isArray(script?.routes)?script.routes.length:0,customDomainCount:list(domains,'items').filter(row=>row?.service===REPLACEMENT_COLLECTOR).length
  });
}

export async function runReplacementReconciliation({env=process.env,fetchImpl=globalThis.fetch}={}){
  const execution=JSON.parse(fs.readFileSync(env.API_FOOTBALL_REPLACEMENT_EXECUTION_PATH,'utf8'));
  const originalReport=JSON.parse(fs.readFileSync(env.API_FOOTBALL_REPLACEMENT_ORIGINAL_REPORT_PATH,'utf8'));
  if(execution.approvedSha!==env.APPROVED_SHA||originalReport.approvedSha!==env.APPROVED_SHA)fail('replacement_reconciliation_sha_mismatch');
  const replacement=await readReplacementState({account:env.CLOUDFLARE_ACCOUNT_ID,token:env.CLOUDFLARE_REPLACEMENT_READ_TOKEN,versionId:execution.versionId,approvedSha:execution.approvedSha,fetchImpl});
  const result=validateReplacementReconciliation({execution,originalReport,replacement});
  return Object.freeze({...result,approvedSha:execution.approvedSha,replacement,retryAuthorized:false});
}

export async function main(){
  const result=await runReplacementReconciliation();
  if(process.env.API_FOOTBALL_REPLACEMENT_RECONCILIATION_PATH)fs.writeFileSync(process.env.API_FOOTBALL_REPLACEMENT_RECONCILIATION_PATH,JSON.stringify(result,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({classification:result.classification,replacementWorker:result.replacementWorker,retryAuthorized:false}));return 0;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
