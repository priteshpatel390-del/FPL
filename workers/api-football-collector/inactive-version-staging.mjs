import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {EXPECTED_D1_DATABASE_ID} from '../data-platform/phase4b/live-contract.mjs';

export const STAGING_CONTRACT_VERSION='api-football-inactive-version-staging-v1';
export const API_BASE='https://api.cloudflare.com/client/v4';
export const WORKER_NAME='teamsheet-api-football-shadow-collector';
export const ENTRY_MODULE='workers/api-football-collector/collector.mjs';
export const COMPATIBILITY_DATE='2026-09-16';
export const PLAIN_TEXT=Object.freeze({
  API_FOOTBALL_FPL_SEASON:'2026-27',
  API_FOOTBALL_PROVIDER_SEASON:'2026',
  EIA_2I5D_ACTIVATION:'REPOSITORY_ONLY_BLOCKED'
});
export const MODULE_PATHS=Object.freeze([
  'src/decision-intelligence/api-football-discovery.mjs',
  'src/decision-intelligence/api-football-foundation.mjs',
  'src/decision-intelligence/api-football-owner-mapping.mjs',
  'src/decision-intelligence/api-football-prelive-qualification.mjs',
  'src/decision-intelligence/api-football-shadow-contracts.mjs',
  'src/decision-intelligence/canonical.mjs',
  'src/decision-intelligence/eia1-safety.mjs',
  'src/decision-intelligence/eia1-workload-contract.mjs',
  'src/decision-intelligence/observation.mjs',
  'src/decision-intelligence/official-fpl-history-canonical.mjs',
  'src/decision-intelligence/rights.mjs',
  'workers/api-football-collector/activation-orchestrator.mjs',
  'workers/api-football-collector/collector.mjs',
  'workers/api-football-collector/d1-persistence.mjs',
  'workers/api-football-collector/mapping-persistence.mjs',
  'workers/api-football-collector/planner-orchestrator.mjs',
  'workers/api-football-collector/runtime-contracts.mjs',
  'workers/api-football-collector/scheduler.mjs',
  'workers/api-football-collector/semantic-validation.mjs'
]);
export const SHELL_BODY=Object.freeze({
  name:WORKER_NAME,
  observability:Object.freeze({enabled:true}),
  subdomain:Object.freeze({enabled:false,previews_enabled:false})
});
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const sha256=value=>createHash('sha256').update(value).digest('hex');
const fail=code=>{const error=new Error(code);error.code=code;throw error;};
const accountBase=id=>'/accounts/'+encodeURIComponent(id);
const scriptBase=id=>accountBase(id)+'/workers/scripts/'+encodeURIComponent(WORKER_NAME);
const betaBase=id=>accountBase(id)+'/workers/workers';

function importSpecs(source){
  if(/\bimport\s*\(/.test(source))fail('staging_dynamic_import_forbidden');
  const out=[];
  const patterns=[
    /\bimport\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g
  ];
  for(const pattern of patterns){let match;while((match=pattern.exec(source)))out.push(match[1]);}
  return out;
}
function resolveRelative(from,specifier){
  if(!specifier.startsWith('./')&&!specifier.startsWith('../'))fail('staging_external_import_forbidden');
  if(/^(?:https?:|npm:|node:)/.test(specifier)||specifier.includes('node_modules/'))fail('staging_external_import_forbidden');
  const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(from),specifier));
  if(resolved.startsWith('../')||path.posix.isAbsolute(resolved)||!/\.(?:mjs|js)$/.test(resolved))fail('staging_import_path_invalid');
  return resolved;
}
export function resolveModuleGraph({load}={}){
  const loader=load||((repoPath)=>readFileSync(path.join(root,repoPath),'utf8'));
  const queue=[ENTRY_MODULE],sources=new Map();
  while(queue.length){
    const repoPath=queue.shift();
    if(sources.has(repoPath))continue;
    let source;try{source=loader(repoPath);}catch{fail('staging_module_unresolved');}
    if(typeof source!=='string'||!source.trim())fail('staging_module_unresolved');
    sources.set(repoPath,source);
    for(const specifier of importSpecs(source)){
      const resolved=resolveRelative(repoPath,specifier);
      if(!sources.has(resolved)&&!queue.includes(resolved))queue.push(resolved);
    }
    if(sources.size>100)fail('staging_module_graph_unbounded');
  }
  const actual=[...sources.keys()].sort();
  if(JSON.stringify(actual)!==JSON.stringify([...MODULE_PATHS]))fail('staging_module_graph_drift');
  return new Map(actual.map(repoPath=>[repoPath,sources.get(repoPath)]));
}
export function buildMetadata(approvedSha){
  if(!/^[0-9a-f]{40}$/.test(approvedSha||''))fail('staging_repository_sha_invalid');
  return {
    main_module:ENTRY_MODULE,
    compatibility_date:COMPATIBILITY_DATE,
    observability:{enabled:true},
    annotations:{
      'workers/commit_sha':approvedSha,
      'workers/message':'Inactive API-Football collector staging',
      'workers/tag':'api-football-collector-inactive-'+approvedSha.slice(0,12)
    },
    bindings:[
      {name:'TEAMSHEET_DATA_DB',type:'d1',database_id:EXPECTED_D1_DATABASE_ID},
      {name:'API_FOOTBALL_FPL_SEASON',type:'plain_text',text:PLAIN_TEXT.API_FOOTBALL_FPL_SEASON},
      {name:'API_FOOTBALL_PROVIDER_SEASON',type:'plain_text',text:PLAIN_TEXT.API_FOOTBALL_PROVIDER_SEASON},
      {name:'EIA_2I5D_ACTIVATION',type:'plain_text',text:PLAIN_TEXT.EIA_2I5D_ACTIVATION}
    ]
  };
}
export function deterministicIdentity(metadata,sources){
  const modules=Object.fromEntries([...sources].map(([repoPath,source])=>[repoPath,sha256(source)]));
  return Object.freeze({
    metadataSha256:sha256(JSON.stringify(metadata)),
    graphSha256:sha256(JSON.stringify({entry:ENTRY_MODULE,modules})),
    modules:Object.freeze(modules)
  });
}
export function buildMultipart(metadata,sources){
  const form=new FormData();
  form.set('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));
  for(const [repoPath,source] of sources)form.set(repoPath,new Blob([source],{type:'application/javascript+module'}),repoPath);
  return form;
}
export function assertMutation(method,requestPath,accountId){
  const allowed=new Set([
    'POST '+betaBase(accountId),
    'POST '+scriptBase(accountId)+'/versions'
  ]);
  if(!allowed.has(method+' '+requestPath))fail('staging_mutation_endpoint_forbidden');
  return true;
}
function readAllowed(requestPath,accountId,{workerId,versionId}={}){
  const script=scriptBase(accountId),beta=betaBase(accountId);
  const exact=new Set([
    script+'/settings',script+'/schedules',script+'/deployments',script+'/subdomain',
    script+'/versions?deployable=true&per_page=100',accountBase(accountId)+'/workers/domains'
  ]);
  if(exact.has(requestPath))return true;
  const escaped=beta.replace(/[|\\{}()[\]^$+*?.]/g,'\\$&');
  if(new RegExp('^'+escaped+'\\?page=\\d+&per_page=100&order_by=name&order=asc$').test(requestPath))return true;
  if(workerId&&requestPath===beta+'/'+encodeURIComponent(workerId))return true;
  if(workerId&&versionId&&requestPath===beta+'/'+encodeURIComponent(workerId)+'/versions/'+encodeURIComponent(versionId)+'?include=modules')return true;
  if(versionId&&requestPath===script+'/versions/'+encodeURIComponent(versionId))return true;
  fail('staging_read_endpoint_forbidden');
}
async function raw(fetchImpl,url,init){
  let response;try{response=await fetchImpl(url,{...init,redirect:'error',signal:AbortSignal.timeout(15000)});}
  catch{return {kind:'ambiguous',status:null,payload:null};}
  const status=response.status;let text;try{text=await response.text();}catch{return {kind:'ambiguous',status,payload:null};}
  let payload=null;try{payload=text?JSON.parse(text):null;}catch{return {kind:status>=400&&status<500?'rejected':'ambiguous',status,payload:null};}
  if(status>=200&&status<300&&payload?.success===true)return {kind:'success',status,payload};
  if(status>=400&&status<500)return {kind:'rejected',status,payload};
  return {kind:'ambiguous',status,payload};
}
async function read(fetchImpl,{token,accountId,requestPath,workerId,versionId}){
  readAllowed(requestPath,accountId,{workerId,versionId});
  return raw(fetchImpl,API_BASE+requestPath,{method:'GET',headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
}
async function mutate(fetchImpl,{token,accountId,requestPath,body,multipart}){
  assertMutation('POST',requestPath,accountId);
  const headers={Authorization:'Bearer '+token,Accept:'application/json'};
  let requestBody;
  if(multipart)requestBody=multipart;
  else {headers['Content-Type']='application/json';requestBody=JSON.stringify(body);}
  return raw(fetchImpl,API_BASE+requestPath,{method:'POST',headers,body:requestBody});
}
function extractVersions(outcome,{allow404=false}={}){
  if(allow404&&outcome.status===404)return [];
  if(outcome.kind!=='success')fail('staging_versions_unreadable');
  const rows=Array.isArray(outcome.payload.result?.items)?outcome.payload.result.items:Array.isArray(outcome.payload.result)?outcome.payload.result:null;
  if(!rows)fail('staging_versions_contract_invalid');
  const ids=rows.map(row=>row?.id);
  if(ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length)fail('staging_versions_contract_invalid');
  return ids;
}
function extractRows(outcome,name,{allow404=false}={}){
  if(allow404&&outcome.status===404)return [];
  if(outcome.kind!=='success')fail('staging_'+name+'_unreadable');
  const result=outcome.payload.result;
  if(Array.isArray(result))return result;
  if(Array.isArray(result?.[name]))return result[name];
  if(result&&typeof result==='object'&&typeof result.id==='string')return [result];
  fail('staging_'+name+'_contract_invalid');
}
function validateWorker(worker){
  if(!worker||typeof worker.id!=='string'||!worker.id||worker.name!==WORKER_NAME)fail('staging_worker_identity_drift');
  if(worker.observability?.enabled!==true)fail('staging_worker_observability_drift');
  if(worker.subdomain?.enabled!==false||worker.subdomain?.previews_enabled!==false)fail('staging_worker_routability_drift');
  if(worker.deployed_on!==null)fail('staging_worker_deployment_present');
  return worker;
}
export function validateVersion(detail,{versionId,approvedSha,sources,requireModules=false}={}){
  if(!detail||detail.id!==versionId)fail('staging_version_identity_drift');
  const compatibility=detail.compatibility_date||detail.resources?.script_runtime?.compatibility_date;
  if(String(compatibility||'').slice(0,10)!==COMPATIBILITY_DATE)fail('staging_version_runtime_drift');
  const bindings=Array.isArray(detail.bindings)?detail.bindings:detail.resources?.bindings;
  if(!Array.isArray(bindings)||bindings.length!==4)fail('staging_version_binding_set_drift');
  const map=new Map(bindings.map(binding=>[binding?.name,binding]));
  if(map.size!==4||map.get('TEAMSHEET_DATA_DB')?.type!=='d1'||map.get('TEAMSHEET_DATA_DB')?.database_id!==EXPECTED_D1_DATABASE_ID)fail('staging_version_d1_binding_drift');
  for(const [name,text] of Object.entries(PLAIN_TEXT)){
    const binding=map.get(name);if(binding?.type!=='plain_text'||binding.text!==text)fail('staging_version_plain_text_drift');
  }
  if(bindings.some(binding=>binding?.type==='secret_text'||binding?.name==='API_FOOTBALL_API_KEY'))fail('staging_secret_binding_present');
  if(approvedSha&&detail.annotations?.['workers/tag']!=='api-football-collector-inactive-'+approvedSha.slice(0,12))fail('staging_version_tag_drift');
  if(Array.isArray(detail.urls)&&detail.urls.length!==0)fail('staging_version_routable_url_present');
  if(requireModules){
    if(detail.main_module!==ENTRY_MODULE||!Array.isArray(detail.modules)||detail.modules.length!==MODULE_PATHS.length)fail('staging_version_modules_invalid');
    const observed=new Map();
    for(const module of detail.modules){
      if(typeof module?.name!=='string'||typeof module?.content_base64!=='string'||module.content_type!=='application/javascript+module')fail('staging_version_modules_invalid');
      observed.set(module.name,Buffer.from(module.content_base64,'base64').toString('utf8'));
    }
    if(JSON.stringify([...observed.keys()].sort())!==JSON.stringify([...MODULE_PATHS]))fail('staging_version_module_set_drift');
    for(const [repoPath,source] of sources)if(observed.get(repoPath)!==source)fail('staging_version_module_bytes_drift');
    if(Array.isArray(detail.package_dependencies)&&detail.package_dependencies.length)fail('staging_package_dependency_present');
  }
  return true;
}
async function listWorkers(fetchImpl,{token,accountId}){
  const all=[];
  for(let page=1;page<=100;page++){
    const requestPath=betaBase(accountId)+'?page='+page+'&per_page=100&order_by=name&order=asc';
    const outcome=await read(fetchImpl,{token,accountId,requestPath});
    if(outcome.kind!=='success'||!Array.isArray(outcome.payload.result))fail('staging_worker_inventory_unreadable');
    all.push(...outcome.payload.result);
    const total=Number(outcome.payload.result_info?.total_pages||1);
    if(!Number.isInteger(total)||total<1||total>100)fail('staging_worker_inventory_unbounded');
    if(page>=total)return all;
  }
  fail('staging_worker_inventory_unbounded');
}
async function stableState(fetchImpl,{token,accountId,allow404}){
  const script=scriptBase(accountId);
  const schedules=await read(fetchImpl,{token,accountId,requestPath:script+'/schedules'});
  const deployments=await read(fetchImpl,{token,accountId,requestPath:script+'/deployments'});
  const versions=await read(fetchImpl,{token,accountId,requestPath:script+'/versions?deployable=true&per_page=100'});
  const domains=await read(fetchImpl,{token,accountId,requestPath:accountBase(accountId)+'/workers/domains'});
  const scheduleRows=extractRows(schedules,'schedules',{allow404});
  const deploymentRows=extractRows(deployments,'deployments',{allow404});
  const versionIds=extractVersions(versions,{allow404});
  const domainRows=extractRows(domains,'domains').filter(row=>row?.service===WORKER_NAME||row?.service_name===WORKER_NAME||row?.worker===WORKER_NAME);
  return {scheduleRows,deploymentRows,versionIds,domainRows};
}
async function getWorker(fetchImpl,{token,accountId,workerId}){
  const requestPath=betaBase(accountId)+'/'+encodeURIComponent(workerId);
  const outcome=await read(fetchImpl,{token,accountId,requestPath,workerId});
  if(outcome.kind!=='success')fail('staging_worker_read_failed');
  return validateWorker(outcome.payload.result);
}
async function requireInert(fetchImpl,{token,accountId,workerId}){
  const worker=await getWorker(fetchImpl,{token,accountId,workerId});
  const state=await stableState(fetchImpl,{token,accountId,allow404:true});
  if(state.scheduleRows.length||state.deploymentRows.length||state.versionIds.length||state.domainRows.length)fail('staging_shell_not_inert');
  return worker;
}
async function reconcileShell(fetchImpl,{token,accountId}){
  const matches=(await listWorkers(fetchImpl,{token,accountId})).filter(row=>row?.name===WORKER_NAME);
  if(matches.length===0)fail('staging_shell_ambiguous_not_applied_no_retry');
  if(matches.length!==1)fail('staging_shell_ambiguous_owner_review');
  return requireInert(fetchImpl,{token,accountId,workerId:matches[0].id});
}
async function betaVersion(fetchImpl,{token,accountId,workerId,versionId,sources,approvedSha}){
  const requestPath=betaBase(accountId)+'/'+encodeURIComponent(workerId)+'/versions/'+encodeURIComponent(versionId)+'?include=modules';
  const outcome=await read(fetchImpl,{token,accountId,requestPath,workerId,versionId});
  if(outcome.kind!=='success')fail('staging_version_detail_unreadable');
  validateVersion(outcome.payload.result,{versionId,approvedSha,sources,requireModules:true});
  return outcome.payload.result;
}
async function reconcileVersion(fetchImpl,{token,accountId,workerId,beforeIds,approvedSha,sources}){
  const state=await stableState(fetchImpl,{token,accountId,allow404:false});
  const newIds=state.versionIds.filter(id=>!beforeIds.includes(id));
  if(newIds.length===0)fail('staging_version_ambiguous_not_applied_no_retry');
  if(newIds.length!==1||state.deploymentRows.length||state.scheduleRows.length||state.domainRows.length)fail('staging_version_ambiguous_owner_review');
  await betaVersion(fetchImpl,{token,accountId,workerId,versionId:newIds[0],sources,approvedSha});
  return newIds[0];
}
export async function runInactiveVersionStaging({env=process.env,fetchImpl=globalThis.fetch}={}){
  const token=env.CLOUDFLARE_COLLECTOR_WORKER_UPLOAD_TOKEN;
  const accountId=env.CLOUDFLARE_ACCOUNT_ID;
  const fingerprint=env.CLOUDFLARE_ACCOUNT_FINGERPRINT;
  const approvedSha=env.APPROVED_SHA;
  if(!token||!accountId||!/^[0-9a-f]{64}$/.test(fingerprint||'')||!/^[0-9a-f]{40}$/.test(approvedSha||''))fail('staging_environment_incomplete');
  if(sha256(accountId)!==fingerprint)fail('staging_account_identity_mismatch');
  for(const value of [token,accountId,EXPECTED_D1_DATABASE_ID])process.stdout.write('::add-mask::'+value+'\n');
  const sources=resolveModuleGraph();
  const metadata=buildMetadata(approvedSha);
  const identity=deterministicIdentity(metadata,sources);
  const preWorkers=await listWorkers(fetchImpl,{token,accountId});
  if(preWorkers.some(row=>row?.name===WORKER_NAME))fail('staging_collector_worker_already_exists');
  const pre=await stableState(fetchImpl,{token,accountId,allow404:true});
  if(pre.scheduleRows.length||pre.deploymentRows.length||pre.versionIds.length||pre.domainRows.length)fail('staging_pre_state_unexpected');

  const shellOutcome=await mutate(fetchImpl,{token,accountId,requestPath:betaBase(accountId),body:SHELL_BODY});
  let worker;
  if(shellOutcome.kind==='success')worker=validateWorker(shellOutcome.payload.result);
  else if(shellOutcome.kind==='rejected')fail('staging_shell_rejected_http_'+shellOutcome.status);
  else worker=await reconcileShell(fetchImpl,{token,accountId});
  await requireInert(fetchImpl,{token,accountId,workerId:worker.id});

  const before=await stableState(fetchImpl,{token,accountId,allow404:false});
  if(before.versionIds.length)fail('staging_first_version_precondition_failed');
  const versionOutcome=await mutate(fetchImpl,{token,accountId,requestPath:scriptBase(accountId)+'/versions',multipart:buildMultipart(metadata,sources)});
  let versionId;
  if(versionOutcome.kind==='success'){
    versionId=versionOutcome.payload.result?.id;
    if(typeof versionId!=='string'||!versionId)fail('staging_version_result_invalid');
  }else if(versionOutcome.kind==='rejected')fail('staging_version_rejected_http_'+versionOutcome.status);
  else versionId=await reconcileVersion(fetchImpl,{token,accountId,workerId:worker.id,beforeIds:before.versionIds,approvedSha,sources});

  const post=await stableState(fetchImpl,{token,accountId,allow404:false});
  if(post.deploymentRows.length||post.scheduleRows.length||post.domainRows.length||post.versionIds.length!==1||post.versionIds[0]!==versionId)fail('staging_post_inventory_drift');
  await getWorker(fetchImpl,{token,accountId,workerId:worker.id});
  const subdomain=await read(fetchImpl,{token,accountId,requestPath:scriptBase(accountId)+'/subdomain'});
  if(subdomain.kind!=='success'||subdomain.payload.result?.enabled!==false||subdomain.payload.result?.previews_enabled!==false)fail('staging_subdomain_drift');
  await betaVersion(fetchImpl,{token,accountId,workerId:worker.id,versionId,sources,approvedSha});
  const stableDetail=await read(fetchImpl,{token,accountId,requestPath:scriptBase(accountId)+'/versions/'+encodeURIComponent(versionId),versionId});
  if(stableDetail.kind!=='success')fail('staging_stable_version_detail_unreadable');
  validateVersion(stableDetail.payload.result,{versionId,sources,requireModules:false});

  return Object.freeze({
    ok:true,contract:STAGING_CONTRACT_VERSION,repositorySha:approvedSha,workerId:worker.id,versionId,identity,
    mutations:Object.freeze({workerShellCreates:1,versionUploads:1,deployments:0,cronMutations:0,secretMutations:0,d1Mutations:0,routeMutations:0,providerRequests:0}),
    postflight:Object.freeze({workersDev:false,previewUrls:false,deployments:0,cron:0,customDomains:0,secretBindings:0,versionCount:1,activation:PLAIN_TEXT.EIA_2I5D_ACTIVATION})
  });
}
export async function main(){
  const report=await runInactiveVersionStaging();
  const output=process.env.API_FOOTBALL_INACTIVE_STAGING_REPORT_PATH;
  if(output)writeFileSync(output,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  process.stdout.write(JSON.stringify({ok:true,workerShellCreates:1,versionUploads:1,deployments:0,cron:0,secretMutations:0,d1Mutations:0,providerRequests:0})+'\n');
  return 0;
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href)main().catch(error=>{
  process.stderr.write('Inactive collector staging stopped: '+(error?.code||error?.message||'staging_unclassified_stop')+'\n');
  process.exitCode=1;
});
