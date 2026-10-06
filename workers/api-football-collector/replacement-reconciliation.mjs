import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {
  REPLACEMENT_COLLECTOR,buildReplacementIdentity,replacementPaths,validateReplacementReconciliation,validateReplacementVersion
} from './replacement-foundation.mjs';

const API='https://api.cloudflare.com/client/v4';
const HEX40=/^[0-9a-f]{40}$/;
const ZONE_ID=/^[A-Za-z0-9_-]{1,32}$/;
const ZONE_PAGE_SIZE=50;
const MAX_ZONE_PAGES=20;
const fail=code=>{throw new Error(code);};
const enc=value=>encodeURIComponent(String(value));

async function request(path,{token,fetchImpl,failureCode='replacement_reconciliation_read_failed'}){
  let response,payload;
  try{response=await fetchImpl(API+path,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(20_000)});payload=await response.json();}
  catch{return fail(failureCode);}
  if(!response.ok||payload?.success!==true)fail(failureCode);
  return payload.result;
}
async function topologyRequest(path,{token,fetchImpl}){
  let response,payload;
  try{response=await fetchImpl(API+path,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(20_000)});payload=await response.json();}
  catch{return fail('replacement_reconciliation_topology_read_failed');}
  if(!response.ok||payload?.success!==true)fail('replacement_reconciliation_topology_read_failed');
  return payload;
}
const list=(value,key)=>Array.isArray(value)?value:Array.isArray(value?.[key])?value[key]:fail('replacement_reconciliation_shape_invalid');
const routeRows=value=>Array.isArray(value)?value:fail('replacement_reconciliation_zone_route_result_invalid');
function validateZoneRouteRow(row){
  if(!row||typeof row!=='object'||Array.isArray(row))fail('replacement_reconciliation_zone_route_row_invalid');
  if(typeof row.id!=='string')fail('replacement_reconciliation_zone_route_id_invalid');
  if(typeof row.pattern!=='string')fail('replacement_reconciliation_zone_route_pattern_invalid');
  if(row.script!==undefined&&row.script!==null&&typeof row.script!=='string')fail('replacement_reconciliation_zone_route_script_invalid');
  return row;
}

export async function readReplacementRouteTopology({account,topologyToken,fetchImpl=globalThis.fetch,workerName=REPLACEMENT_COLLECTOR}){
  if(typeof account!=='string'||!account||typeof topologyToken!=='string'||!topologyToken)fail('replacement_reconciliation_topology_identity_invalid');
  const zones=[];const seen=new Set();
  let page=1,totalPages=null;
  while(true){
    if(page>MAX_ZONE_PAGES)fail('replacement_reconciliation_zone_inventory_too_large');
    const payload=await topologyRequest('/zones?account.id='+enc(account)+'&page='+page+'&per_page='+ZONE_PAGE_SIZE+'&type=full%2Cpartial%2Csecondary%2Cinternal',{token:topologyToken,fetchImpl});
    const rows=list(payload?.result),info=payload?.result_info;
    const reportedPages=Number(info?.total_pages);
    if(!Number.isInteger(reportedPages)||reportedPages<0||reportedPages>MAX_ZONE_PAGES)fail('replacement_reconciliation_zone_inventory_invalid');
    if(totalPages===null)totalPages=reportedPages;else if(totalPages!==reportedPages)fail('replacement_reconciliation_zone_inventory_changed');
    if(totalPages===0){
      if(rows.length!==0||page!==1)fail('replacement_reconciliation_zone_inventory_invalid');
      break;
    }
    for(const zone of rows){
      const id=zone?.id;
      if(!ZONE_ID.test(String(id||''))||zone?.account?.id!==account||seen.has(id))fail('replacement_reconciliation_zone_inventory_invalid');
      seen.add(id);zones.push(id);
    }
    if(page>=totalPages)break;
    page+=1;
  }
  let routeCount=0,routeRowCount=0;
  for(const zoneId of zones){
    const payload=await topologyRequest('/zones/'+enc(zoneId)+'/workers/routes',{token:topologyToken,fetchImpl});
    const rows=routeRows(payload?.result);
    for(const raw of rows){
      const row=validateZoneRouteRow(raw);routeRowCount+=1;
      if(row.script===workerName)routeCount+=1;
    }
  }
  return Object.freeze({proof:'ZONE_ROUTE_SCAN',zoneCount:zones.length,routeRowCount,routeCount});
}

// Reads replacement state without assuming the legacy Scripts inventory has materialized.
// When a topologyToken is supplied, zone-scoped Workers Routes are independently enumerated
// and become authoritative for route-count proof.
export async function readReplacementState({account,token,topologyToken=null,versionId=null,approvedSha,versionApprovedSha=approvedSha,fetchImpl=globalThis.fetch}){
  const paths=replacementPaths(account);
  const betaWorkers=await request(paths.betaWorkers,{token,fetchImpl,failureCode:'replacement_reconciliation_worker_inventory_read_failed'});
  const scripts=await request(paths.scripts,{token,fetchImpl,failureCode:'replacement_reconciliation_legacy_scripts_read_failed'}),
    domains=await request(paths.domains,{token,fetchImpl,failureCode:'replacement_reconciliation_custom_domains_read_failed'});
  const workers=list(betaWorkers,'items').filter(row=>row?.name===REPLACEMENT_COLLECTOR);
  const script=list(scripts,'items').find(row=>row?.id===REPLACEMENT_COLLECTOR);
  const customDomainCount=list(domains,'items').filter(row=>row?.service===REPLACEMENT_COLLECTOR).length;
  if(workers.length>1)fail('replacement_reconciliation_worker_invalid');

  let topology=null;
  if(topologyToken!==null){
    if(typeof topologyToken!=='string'||!topologyToken||topologyToken===token)fail('replacement_reconciliation_topology_credential_separation_required');
    topology=await readReplacementRouteTopology({account,topologyToken,fetchImpl});
  }

  if(workers.length===0){
    if(script||customDomainCount!==0||(topology&&topology.routeCount!==0))fail('replacement_reconciliation_worker_invalid');
    return Object.freeze({present:false,workerName:null,workerId:null,versionId:null,versionIds:Object.freeze([]),versionIdentityExact:null,scriptPresent:false,
      workerDeployedOnNull:null,workersDev:null,previewUrls:null,versionCount:0,versionInventoryExact:true,deploymentCount:0,cronCount:0,
      routeCount:topology?.routeCount??0,routeProof:topology?.proof??'WORKER_ABSENT',topologyZoneCount:topology?.zoneCount??null,topologyRouteRowCount:topology?.routeRowCount??null,legacyRouteCount:null,customDomainCount:0});
  }

  const worker=workers[0];
  const subdomain=await request(paths.replacementSubdomain,{token,fetchImpl,failureCode:'replacement_reconciliation_subdomain_read_failed'});
  const deployments=await request(paths.replacementDeployments,{token,fetchImpl,failureCode:'replacement_reconciliation_deployments_read_failed'}),
    schedules=await request(paths.replacementSchedules,{token,fetchImpl,failureCode:'replacement_reconciliation_schedules_read_failed'});
  const versionRows=list(await request(paths.replacementVersions,{token,fetchImpl,failureCode:'replacement_reconciliation_version_inventory_read_failed'}),'items'),versionIds=versionRows.map(row=>row?.id).filter(id=>typeof id==='string');
  let legacyRouteCount=null;
  if(script){
    if(script.routes==null)legacyRouteCount=null;
    else if(!Array.isArray(script.routes))fail('replacement_reconciliation_legacy_route_inventory_invalid');
    else legacyRouteCount=script.routes.length;
  }
  let routeCount,routeProof,topologyZoneCount=null,topologyRouteRowCount=null;
  if(topology){
    routeCount=topology.routeCount;routeProof=topology.proof;topologyZoneCount=topology.zoneCount;topologyRouteRowCount=topology.routeRowCount;
    if(legacyRouteCount!==null&&legacyRouteCount!==routeCount)fail('replacement_reconciliation_route_inventory_mismatch');
  }else if(legacyRouteCount!==null){
    routeCount=legacyRouteCount;routeProof='LEGACY_SCRIPT_INVENTORY';
  }else if(versionRows.length===0){
    routeCount=0;routeProof='NO_VERSION_NO_SCRIPT';
  }else{
    fail('replacement_reconciliation_route_proof_required');
  }

  let versionIdentityExact=null;
  if(versionId!==null){
    if(!HEX40.test(String(versionApprovedSha||'')))fail('replacement_reconciliation_version_provenance_invalid');
    const stableVersion=await request(paths.replacement+'/'+enc(versionId),{token,fetchImpl,failureCode:'replacement_reconciliation_stable_version_read_failed'});
    const betaVersion=await request(paths.createShell+'/'+enc(worker.id)+'/versions/'+enc(versionId)+'?include=modules',{token,fetchImpl,failureCode:'replacement_reconciliation_beta_version_read_failed'});
    versionIdentityExact=false;try{validateReplacementVersion({stableVersion,betaVersion,versionId,identity:buildReplacementIdentity(versionApprovedSha)});versionIdentityExact=true;}catch{}
  }
  return Object.freeze({
    present:true,workerName:worker.name,workerId:worker.id,versionId,versionIds:Object.freeze([...versionIds]),versionIdentityExact,scriptPresent:Boolean(script),
    workerDeployedOnNull:worker.deployed_on==null,workersDev:subdomain?.enabled!==false,previewUrls:subdomain?.previews_enabled!==false,
    versionCount:versionRows.length,versionInventoryExact:versionId===null?versionRows.length===0:versionRows.length===1&&versionRows[0]?.id===versionId,
    deploymentCount:list(deployments,'deployments').length,cronCount:list(schedules,'schedules').length,
    routeCount,routeProof,topologyZoneCount,topologyRouteRowCount,legacyRouteCount,customDomainCount
  });
}

const knownFailure=error=>/^replacement_[A-Za-z0-9_]{1,96}$/.test(String(error?.message))?error.message:'replacement_reconciliation_failed_unknown';

export async function runReplacementReconciliation({env=process.env,fetchImpl=globalThis.fetch}={}){
  const execution=JSON.parse(fs.readFileSync(env.API_FOOTBALL_REPLACEMENT_EXECUTION_PATH,'utf8'));
  const originalReport=JSON.parse(fs.readFileSync(env.API_FOOTBALL_REPLACEMENT_ORIGINAL_REPORT_PATH,'utf8'));
  if(execution.approvedSha!==env.APPROVED_SHA||originalReport.approvedSha!==env.APPROVED_SHA)fail('replacement_reconciliation_sha_mismatch');
  let replacement=null;
  try{
    replacement=await readReplacementState({account:env.CLOUDFLARE_ACCOUNT_ID,token:env.CLOUDFLARE_REPLACEMENT_READ_TOKEN,
      topologyToken:env.CLOUDFLARE_REPLACEMENT_TOPOLOGY_READ_TOKEN??null,versionId:typeof execution.versionId==='string'?execution.versionId:null,
      approvedSha:execution.approvedSha,versionApprovedSha:execution.approvedSha,fetchImpl});
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
