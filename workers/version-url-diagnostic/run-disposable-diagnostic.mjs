// Owner-gated disposable Version URL diagnostic.
//
// Creates one throwaway Worker (never the API-Football collector), changes one
// variable at a time, probes the same Version URL after each change, deletes the
// throwaway Worker, and proves every other Worker in the account is unchanged.
// Retains only closed enums, bounded integers and format-validated identifiers.
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {DIAGNOSTIC_SIGNATURE_BODY,DIAGNOSTIC_SIGNATURE_HEADER} from './diagnostic.mjs';

export const DIAGNOSTIC_CONTRACT_VERSION='version-url-disposable-diagnostic-v1';
export const DIAGNOSTIC_WORKER='teamsheet-version-url-diagnostic';
export const DIAGNOSTIC_MODULE='diagnostic.mjs';
export const DIAGNOSTIC_COMPATIBILITY_DATE='2026-09-16';
export const COLLECTOR_WORKER='teamsheet-api-football-shadow-collector';
export const COLLECTOR_WORKER_ID='ae69aec0b6484b8f89b44e96b5eb86b8';
export const COLLECTOR_VERSION_IDS=Object.freeze([
  'e49ac8f2-4289-46bc-9f0b-87a20cd7be62',
  '04d79556-3070-429f-9944-b5b53d799842',
  '7405abc0-8358-4156-8226-b6cc7bcf244f'
]);
export const READINESS_DELAYS_MS=Object.freeze([0,2_000,5_000,10_000,20_000,30_000,45_000]);
export const PROBE_TIMEOUT_MS=15_000;
export const REQUEST_TIMEOUT_MS=20_000;
export const MUTATION_CEILINGS=Object.freeze({createShell:1,uploadVersion:1,subdomain:2,deployment:1,deleteWorker:1});
export const PHASES=Object.freeze([
  Object.freeze({id:'A_ZERO_DEPLOYMENT_WORKERS_DEV_OFF',workersDev:false,deployed:false}),
  Object.freeze({id:'B_ZERO_DEPLOYMENT_WORKERS_DEV_ON',workersDev:true,deployed:false}),
  Object.freeze({id:'C_DEPLOYED_WORKERS_DEV_ON',workersDev:true,deployed:true})
]);

const API='https://api.cloudflare.com/client/v4';
const HEX40=/^[0-9a-f]{40}$/;
const HEX64=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CF_RAY=/^[0-9a-f]{16}-[A-Z]{3}$/;
const ERROR_CODE_BODY=/^error code: (1\d{3})$/;
const here=path.dirname(fileURLToPath(import.meta.url));
const enc=value=>encodeURIComponent(String(value));
const fail=code=>{throw new Error(code);};
const sha256=value=>createHash('sha256').update(value).digest('hex');
const waitDefault=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));

export function diagnosticPaths(accountId){
  if(typeof accountId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(accountId))fail('diagnostic_account_invalid');
  const base='/accounts/'+enc(accountId)+'/workers';
  const script=base+'/scripts/'+DIAGNOSTIC_WORKER;
  return Object.freeze({
    base,
    createShell:base+'/workers',
    uploadVersion:script+'/versions',
    subdomain:script+'/subdomain',
    deployments:script+'/deployments',
    deleteWorker:script,
    betaWorkers:base+'/workers?per_page=100&order_by=name&order=asc',
    scripts:base+'/scripts',
    accountSubdomain:base+'/subdomain',
    collector:base+'/scripts/'+COLLECTOR_WORKER
  });
}

// The only mutations this module can issue. Every one targets the disposable
// Worker by exact path; nothing can address the collector or any other Worker.
export function mutationKind(method,requestPath,{accountId}={}){
  const paths=diagnosticPaths(accountId),upper=String(method).toUpperCase();
  if(upper==='POST'&&requestPath===paths.createShell)return 'createShell';
  if(upper==='POST'&&requestPath===paths.uploadVersion)return 'uploadVersion';
  if(upper==='POST'&&requestPath===paths.subdomain)return 'subdomain';
  if(upper==='POST'&&requestPath===paths.deployments)return 'deployment';
  if(upper==='DELETE'&&requestPath===paths.deleteWorker)return 'deleteWorker';
  return fail('diagnostic_mutation_forbidden');
}

export function assertReadAllowed(requestPath,{accountId}={}){
  const paths=diagnosticPaths(accountId);
  if(typeof requestPath!=='string'||!requestPath.startsWith(paths.base+'/'))fail('diagnostic_read_forbidden');
  return true;
}

export function buildShellBody(){
  return Object.freeze({name:DIAGNOSTIC_WORKER,subdomain:Object.freeze({enabled:false,previews_enabled:false})});
}

export function buildDiagnosticMetadata(approvedSha){
  if(!HEX40.test(String(approvedSha||'')))fail('diagnostic_approved_sha_invalid');
  return {
    main_module:DIAGNOSTIC_MODULE,
    compatibility_date:DIAGNOSTIC_COMPATIBILITY_DATE,
    bindings:[],
    annotations:{'workers/commit_sha':approvedSha,'workers/message':'Disposable Version URL diagnostic '+approvedSha}
  };
}

export function readDiagnosticSource(readFile=fs.readFileSync){
  return readFile(path.join(here,DIAGNOSTIC_MODULE),'utf8');
}

export function buildUploadForm(approvedSha,source){
  if(typeof source!=='string'||!source.includes(DIAGNOSTIC_SIGNATURE_BODY)||/\bimport\b/.test(source))fail('diagnostic_source_invalid');
  const form=new FormData();
  form.set('metadata',JSON.stringify(buildDiagnosticMetadata(approvedSha)));
  form.set(DIAGNOSTIC_MODULE,new File([source],DIAGNOSTIC_MODULE,{type:'application/javascript+module'}));
  return form;
}

export function deploymentBody(versionId){
  if(!UUID.test(String(versionId||''))||COLLECTOR_VERSION_IDS.includes(versionId))fail('diagnostic_deployment_target_invalid');
  return {strategy:'percentage',versions:[{version_id:versionId,percentage:100}]};
}

// Closed classification of an HTTP response. No body text, header value or URL is retained.
export function contentTypeFamily(value){
  if(typeof value!=='string'||!value)return 'ABSENT';
  const type=value.split(';')[0].trim().toLowerCase();
  if(type==='text/plain')return 'TEXT_PLAIN';
  if(type==='text/html')return 'TEXT_HTML';
  if(type==='application/json')return 'APPLICATION_JSON';
  return 'OTHER';
}
export function bodyLengthBucket(bytes){
  if(!Number.isInteger(bytes)||bytes<0)return 'UNKNOWN';
  if(bytes===0)return 'EMPTY';
  if(bytes<=64)return 'B1_64';
  if(bytes<=1024)return 'B65_1024';
  if(bytes<=16384)return 'B1025_16384';
  return 'OVER_16384';
}
export function classifyResponse({status,headers,body}){
  const text=typeof body==='string'?body:'';
  const bytes=typeof body==='string'?Buffer.byteLength(body):null;
  const errorMatch=ERROR_CODE_BODY.exec(text.trim());
  const family=contentTypeFamily(headers?.get?.('content-type'));
  const signatureProved=status===200&&text===DIAGNOSTIC_SIGNATURE_BODY&&headers?.get?.(DIAGNOSTIC_SIGNATURE_HEADER)==='1';
  let bodyKind='OTHER';
  if(signatureProved)bodyKind='DIAGNOSTIC_SIGNATURE';
  else if(errorMatch)bodyKind='CLOUDFLARE_ERROR_CODE';
  else if(bytes===0)bodyKind='EMPTY';
  else if(/^\s*<(!doctype html|html)[\s>]/i.test(text))bodyKind='HTML_DOCUMENT';
  const ray=headers?.get?.('cf-ray');
  return Object.freeze({
    outcome:'HTTP_RESPONSE',
    httpStatus:Number.isInteger(status)&&status>=100&&status<=599?status:null,
    contentTypeFamily:family,
    bodyKind,
    cloudflareErrorCode:errorMatch?Number(errorMatch[1]):null,
    bodyLengthBucket:bodyLengthBucket(bytes),
    cfRay:typeof ray==='string'&&CF_RAY.test(ray)?ray:null,
    signatureProved
  });
}

export async function probeOnce(url,{fetchImpl}){
  try{
    const response=await fetchImpl(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(PROBE_TIMEOUT_MS)});
    let body;try{body=await response.text();}catch{body=null;}
    return classifyResponse({status:response.status,headers:response.headers,body});
  }catch(error){
    return Object.freeze({outcome:error?.name==='TimeoutError'||error?.name==='AbortError'?'TIMEOUT':'TRANSPORT_FAILURE',
      httpStatus:null,contentTypeFamily:'ABSENT',bodyKind:'NONE',cloudflareErrorCode:null,bodyLengthBucket:'UNKNOWN',cfRay:null,signatureProved:false});
  }
}

// Probes one URL on the fixed readiness schedule, stopping at the first proved signature.
export async function probeWithReadiness(url,{fetchImpl,wait=waitDefault,now=()=>Date.now()}){
  const attempts=[];const started=now();
  for(const delay of READINESS_DELAYS_MS){
    if(delay>0)await wait(delay);
    const result=await probeOnce(url,{fetchImpl});
    attempts.push(Object.freeze({...result,elapsedSeconds:Math.max(0,Math.round((now()-started)/1000))}));
    if(result.signatureProved)break;
  }
  return Object.freeze({signatureProved:attempts.some(row=>row.signatureProved),attemptCount:attempts.length,attempts:Object.freeze(attempts)});
}

export function validateVersionUrl(versionUrl,{versionId,accountSubdomain}){
  const suffix='-'+DIAGNOSTIC_WORKER+'.'+accountSubdomain+'.workers.dev';
  let url;try{url=new URL(versionUrl);}catch{return fail('diagnostic_version_url_invalid');}
  if(url.protocol!=='https:'||url.port||url.username||url.password||url.search||url.hash||url.pathname!=='/'||
    url.hostname!==versionId.slice(0,8)+suffix)fail('diagnostic_version_url_invalid');
  return url.origin+'/';
}

export function classifyDiagnostic(phaseResults){
  const passed=id=>phaseResults.find(row=>row.phase===id)?.versionUrl?.signatureProved===true;
  const ran=id=>phaseResults.some(row=>row.phase===id&&row.versionUrl);
  if(passed(PHASES[0].id))return 'ZERO_DEPLOYMENT_HYPOTHESIS_REFUTED';
  if(!ran(PHASES[0].id))return 'DIAGNOSTIC_INCOMPLETE';
  if(passed(PHASES[1].id))return 'WORKERS_DEV_ROUTE_REQUIRED_SUPPORTED';
  if(!ran(PHASES[1].id))return 'DIAGNOSTIC_INCOMPLETE';
  if(passed(PHASES[2].id))return 'FIRST_DEPLOYMENT_REQUIRED_SUPPORTED';
  if(!ran(PHASES[2].id))return 'DIAGNOSTIC_INCOMPLETE';
  return 'FAILS_BEYOND_DEPLOYMENT_AND_WORKERS_DEV';
}

export function scriptSnapshot(result){
  if(!Array.isArray(result))fail('diagnostic_scripts_inventory_invalid');
  const rows=result.map(row=>({name:row?.id,modifiedOn:row?.modified_on}));
  if(rows.some(row=>typeof row.name!=='string'||typeof row.modifiedOn!=='string')||new Set(rows.map(row=>row.name)).size!==rows.length)fail('diagnostic_scripts_inventory_invalid');
  return Object.freeze(Object.fromEntries(rows.sort((a,b)=>a.name.localeCompare(b.name)).map(row=>[row.name,row.modifiedOn])));
}

export function collectorState({subdomain,deployments,versions,betaWorkers}){
  const deploymentRows=Array.isArray(deployments?.deployments)?deployments.deployments:Array.isArray(deployments)?deployments:null;
  const versionIds=Array.isArray(versions?.items)?versions.items.map(row=>row?.id).sort():null;
  const worker=Array.isArray(betaWorkers)?betaWorkers.find(row=>row?.name===COLLECTOR_WORKER):null;
  return Object.freeze({
    workerIdExact:worker?.id===COLLECTOR_WORKER_ID,
    workersDevEnabled:subdomain?.enabled===true,
    versionUrlsEnabled:subdomain?.previews_enabled===true,
    deploymentCount:deploymentRows?deploymentRows.length:null,
    versionInventoryExact:JSON.stringify(versionIds)===JSON.stringify([...COLLECTOR_VERSION_IDS].sort())
  });
}
const collectorPristine=state=>state.workerIdExact&&!state.workersDevEnabled&&!state.versionUrlsEnabled&&state.deploymentCount===0&&state.versionInventoryExact;

export function createRequester({accountId,token,fetchImpl}){
  if(typeof token!=='string'||!token)fail('diagnostic_token_missing');
  const counts={createShell:0,uploadVersion:0,subdomain:0,deployment:0,deleteWorker:0};
  const request=async(requestPath,{method='GET',body,multipart,headers:extra={}}={})=>{
    const upper=String(method).toUpperCase(),mutation=upper!=='GET';
    let kind=null;
    if(mutation){
      kind=mutationKind(upper,requestPath,{accountId});
      if(counts[kind]>=MUTATION_CEILINGS[kind])fail('diagnostic_mutation_ceiling_'+kind);
      if(kind==='createShell'&&JSON.stringify(body)!==JSON.stringify(buildShellBody()))fail('diagnostic_shell_body_invalid');
      counts[kind]+=1;
    }else assertReadAllowed(requestPath,{accountId});
    const headers={Authorization:'Bearer '+token,Accept:'application/json',...extra};
    let requestBody;
    if(multipart)requestBody=multipart;else if(body!==undefined){headers['Content-Type']='application/json';requestBody=JSON.stringify(body);}
    let response,payload;
    try{
      response=await fetchImpl(API+requestPath,{method:upper,headers,body:requestBody,redirect:'error',signal:AbortSignal.timeout(REQUEST_TIMEOUT_MS)});
      payload=await response.json();
    }catch{return fail(mutation?'diagnostic_mutation_ambiguous_'+kind:'diagnostic_read_failed');}
    if(!response.ok||payload?.success!==true)fail(mutation?(response.status>=400&&response.status<500?'diagnostic_mutation_rejected_'+kind:'diagnostic_mutation_ambiguous_'+kind):'diagnostic_read_failed');
    return payload.result;
  };
  return Object.freeze({request,counts});
}

const KNOWN_FAILURES=/^diagnostic_[A-Za-z0-9_]{1,80}$/;
const failureCode=error=>KNOWN_FAILURES.test(String(error?.message))?error.message:'diagnostic_failed_unknown';

export async function runDisposableDiagnostic({env=process.env,fetchImpl=globalThis.fetch,wait=waitDefault,now=()=>Date.now(),readSource=readDiagnosticSource}={}){
  const account=env.CLOUDFLARE_ACCOUNT_ID,fingerprint=env.CLOUDFLARE_ACCOUNT_FINGERPRINT,approvedSha=env.APPROVED_SHA;
  if(typeof account!=='string'||!account||!HEX64.test(String(fingerprint||''))||sha256(account)!==fingerprint)fail('diagnostic_account_identity_mismatch');
  if(!HEX40.test(String(approvedSha||'')))fail('diagnostic_approved_sha_invalid');
  const paths=diagnosticPaths(account);
  const {request,counts}=createRequester({accountId:account,token:env.CLOUDFLARE_DIAGNOSTIC_TOKEN,fetchImpl});
  const readCollector=async()=>collectorState({
    subdomain:await request(paths.collector+'/subdomain'),
    deployments:await request(paths.collector+'/deployments'),
    versions:await request(paths.collector+'/versions?deployable=true'),
    betaWorkers:await request(paths.betaWorkers)
  });
  const findDiagnostic=async()=>{
    const rows=await request(paths.betaWorkers);
    if(!Array.isArray(rows))fail('diagnostic_worker_inventory_invalid');
    const matches=rows.filter(row=>row?.name===DIAGNOSTIC_WORKER);
    if(matches.length>1)fail('diagnostic_worker_inventory_invalid');
    return matches[0]??null;
  };
  const readSubdomain=async()=>{const result=await request(paths.subdomain);return Object.freeze({workersDevEnabled:result?.enabled===true,versionUrlsEnabled:result?.previews_enabled===true});};
  const setSubdomain=async({workersDev,versionUrls})=>request(paths.subdomain,{method:'POST',headers:{'Cloudflare-Workers-Script-Api-Date':'2025-08-01'},body:{enabled:workersDev,previews_enabled:versionUrls}});

  // Preflight: exact account, disposable Worker absent, collector pristine.
  const beforeScripts=scriptSnapshot(await request(paths.scripts));
  if(!Object.hasOwn(beforeScripts,COLLECTOR_WORKER))fail('diagnostic_collector_absent_wrong_account');
  if(Object.hasOwn(beforeScripts,DIAGNOSTIC_WORKER)||await findDiagnostic())fail('diagnostic_worker_preexists');
  const collectorBefore=await readCollector();
  if(!collectorPristine(collectorBefore))fail('diagnostic_collector_not_pristine');
  const accountSubdomain=(await request(paths.accountSubdomain))?.subdomain;
  if(typeof accountSubdomain!=='string'||!/^[a-z0-9-]+$/.test(accountSubdomain))fail('diagnostic_account_subdomain_invalid');

  const phaseResults=[];let shellAttempted=false,versionId=null,failure=null;
  try{
    shellAttempted=true;
    const shell=await request(paths.createShell,{method:'POST',body:buildShellBody()});
    if(shell?.name!==DIAGNOSTIC_WORKER||typeof shell?.id!=='string'||shell.id===COLLECTOR_WORKER_ID)fail('diagnostic_shell_identity_invalid');
    await setSubdomain({workersDev:false,versionUrls:true});
    const version=await request(paths.uploadVersion,{method:'POST',multipart:buildUploadForm(approvedSha,readSource())});
    versionId=version?.id;
    if(!UUID.test(String(versionId||''))||COLLECTOR_VERSION_IDS.includes(versionId))fail('diagnostic_version_identity_invalid');
    let versionUrl=null;
    for(let read=1;read<=5&&!versionUrl;read++){
      const detail=await request(paths.createShell+'/'+enc(shell.id)+'/versions/'+enc(versionId));
      if(Array.isArray(detail?.urls)&&detail.urls.length===1)versionUrl=validateVersionUrl(detail.urls[0],{versionId,accountSubdomain});
      else if(read<5)await wait(1_000);
    }
    if(!versionUrl)fail('diagnostic_version_url_unpublished');
    const productionUrl='https://'+DIAGNOSTIC_WORKER+'.'+accountSubdomain+'.workers.dev/';
    for(const phase of PHASES){
      if(phase.id===PHASES[1].id)await setSubdomain({workersDev:true,versionUrls:true});
      if(phase.deployed)await request(paths.deployments,{method:'POST',body:deploymentBody(versionId)});
      const settings=await readSubdomain();
      if(settings.workersDevEnabled!==phase.workersDev||!settings.versionUrlsEnabled)fail('diagnostic_settings_readback_mismatch');
      const deploymentsResult=await request(paths.deployments);
      const deploymentRows=Array.isArray(deploymentsResult?.deployments)?deploymentsResult.deployments:[];
      if(deploymentRows.length!==(phase.deployed?1:0))fail('diagnostic_deployment_readback_mismatch');
      const versionProbe=await probeWithReadiness(versionUrl,{fetchImpl,wait,now});
      const productionProbe=phase.workersDev?await probeOnce(productionUrl,{fetchImpl}):null;
      phaseResults.push(Object.freeze({phase:phase.id,settingsReadback:settings,deploymentCount:deploymentRows.length,versionUrl:versionProbe,productionRoute:productionProbe}));
      if(versionProbe.signatureProved)break;
    }
  }catch(error){failure=failureCode(error);}

  // Cleanup: delete the disposable Worker whenever creation was attempted.
  let cleanup='NOT_REQUIRED';
  if(shellAttempted){
    try{
      if(await findDiagnostic())await request(paths.deleteWorker,{method:'DELETE'});
      cleanup=(await findDiagnostic())?'DISPOSABLE_WORKER_STILL_PRESENT':'DISPOSABLE_WORKER_DELETED';
    }catch(error){cleanup='CLEANUP_FAILED';failure=failure??failureCode(error);}
  }

  // Postflight: collector and every other Worker unchanged.
  let collectorAfter=null,otherWorkersUnchanged=false;
  try{
    collectorAfter=await readCollector();
    const afterScripts=scriptSnapshot(await request(paths.scripts));
    const strip=snapshot=>JSON.stringify(Object.fromEntries(Object.entries(snapshot).filter(([name])=>name!==DIAGNOSTIC_WORKER)));
    otherWorkersUnchanged=strip(beforeScripts)===strip(afterScripts)&&!Object.hasOwn(afterScripts,DIAGNOSTIC_WORKER);
  }catch(error){failure=failure??failureCode(error);}

  const collectorUnchanged=Boolean(collectorAfter)&&JSON.stringify(collectorBefore)===JSON.stringify(collectorAfter)&&collectorPristine(collectorAfter);
  const safe=collectorUnchanged&&otherWorkersUnchanged&&(cleanup==='DISPOSABLE_WORKER_DELETED'||cleanup==='NOT_REQUIRED');
  return Object.freeze({
    version:DIAGNOSTIC_CONTRACT_VERSION,approvedSha,
    classification:failure?'DIAGNOSTIC_INCOMPLETE':classifyDiagnostic(phaseResults),
    failure,diagnosticVersionId:versionId,phases:Object.freeze(phaseResults),
    mutationCounts:Object.freeze({...counts}),cleanup,collectorUnchanged,otherWorkersUnchanged,safe,
    collectorMutations:0,d1Mutations:0,providerRequests:0,retryAuthorized:false
  });
}

async function main(){
  let report;
  try{report=await runDisposableDiagnostic();}
  catch(error){report={version:DIAGNOSTIC_CONTRACT_VERSION,classification:'DIAGNOSTIC_REFUSED_BEFORE_MUTATION',failure:failureCode(error),safe:true,retryAuthorized:false};}
  const reportPath=process.env.VERSION_URL_DIAGNOSTIC_REPORT_PATH;
  if(reportPath)fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
  // The report holds only closed enums, bounded integers and format-validated identifiers.
  console.log(JSON.stringify(report));
  return report.safe===true&&report.classification!=='DIAGNOSTIC_INCOMPLETE'&&report.classification!=='DIAGNOSTIC_REFUSED_BEFORE_MUTATION'?0:1;
}

if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
