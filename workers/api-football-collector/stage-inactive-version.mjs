import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {EXPECTED_D1_DATABASE_ID} from '../data-platform/phase4b/live-contract.mjs';

export const STAGING_CONTRACT_VERSION='api-football-inactive-version-staging-v1';
export const WORKER_NAME='teamsheet-api-football-shadow-collector';
export const CONFIG_PATH='workers/api-football-collector/wrangler.jsonc';
export const ENTRY_PATH='workers/api-football-collector/collector.mjs';
export const ENTRY_MODULE='collector.mjs';
export const EXPECTED_COMPATIBILITY_DATE='2026-09-16';
export const EXPECTED_DATABASE_NAME='teamsheet-data';
export const EXPECTED_BINDING_NAME='TEAMSHEET_DATA_DB';
export const EXPECTED_ACTIVATION='REPOSITORY_ONLY_BLOCKED';
export const ATTENDED_ACTIVATION='ATTENDED_ONE_SHOT_DISCOVERY';
export const ATTENDED_SECRET_BINDINGS=Object.freeze(['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET']);
export const EXPECTED_PLAIN_TEXT_VARS=Object.freeze({
  API_FOOTBALL_FPL_SEASON:'2026-27',
  API_FOOTBALL_PROVIDER_SEASON:'2026',
  EIA_2I5D_ACTIVATION:EXPECTED_ACTIVATION
});
export const REVIEWED_MODULE_PATHS=Object.freeze([
  'src/decision-intelligence/api-football-discovery.mjs',
  'src/decision-intelligence/api-football-foundation.mjs',
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
  'workers/api-football-collector/mapping-runtime.mjs',
  'workers/api-football-collector/planner-orchestrator.mjs',
  'workers/api-football-collector/runtime-contracts.mjs',
  'workers/api-football-collector/scheduler.mjs',
  'workers/api-football-collector/semantic-validation.mjs'
]);

const API_BASE='https://api.cloudflare.com/client/v4';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const HEX40=/^[0-9a-f]{40}$/;
const HEX64=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATIC_SPECIFIER=/\b(?:import|export)\s+(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT=/\bimport\s*\(/;
const SAFE_MODULE_NAME=/^[A-Za-z0-9_.\/-]+$/;
const fail=code=>{throw new Error(code);};
const sha256=value=>createHash('sha256').update(value).digest('hex');
const enc=value=>encodeURIComponent(String(value));

export class MutationRejectedError extends Error{constructor(code='collector_staging_mutation_rejected'){super(code);this.name='MutationRejectedError';}}
export class MutationAmbiguousError extends Error{constructor(code='collector_staging_mutation_ambiguous_reconciliation_required_no_retry'){super(code);this.name='MutationAmbiguousError';}}

function exactKeys(value,expected,code){
  if(!value||typeof value!=='object'||Array.isArray(value))fail(code);
  if(JSON.stringify(Object.keys(value).sort())!==JSON.stringify([...expected].sort()))fail(code);
  return value;
}
export function parseAndValidateConfig(text){
  let config;try{config=JSON.parse(text);}catch{fail('collector_staging_config_json_invalid');}
  exactKeys(config,['$schema','name','main','compatibility_date','workers_dev','preview_urls','observability','vars','triggers','d1_databases'],'collector_staging_config_top_level_drift');
  if(config.$schema!=='node_modules/wrangler/config-schema.json'||config.name!==WORKER_NAME||config.main!==ENTRY_MODULE||
    config.compatibility_date!==EXPECTED_COMPATIBILITY_DATE||config.workers_dev!==false||config.preview_urls!==false)fail('collector_staging_config_identity_drift');
  exactKeys(config.observability,['enabled'],'collector_staging_observability_drift');
  if(config.observability.enabled!==true)fail('collector_staging_observability_drift');
  exactKeys(config.vars,Object.keys(EXPECTED_PLAIN_TEXT_VARS),'collector_staging_vars_drift');
  if(Object.entries(EXPECTED_PLAIN_TEXT_VARS).some(([key,value])=>String(config.vars[key])!==String(value)))fail('collector_staging_vars_drift');
  exactKeys(config.triggers,['crons'],'collector_staging_triggers_drift');
  if(!Array.isArray(config.triggers.crons)||config.triggers.crons.length!==0)fail('collector_staging_triggers_drift');
  if(!Array.isArray(config.d1_databases)||config.d1_databases.length!==1)fail('collector_staging_d1_config_drift');
  const d1=exactKeys(config.d1_databases[0],['binding','database_name','database_id','migrations_dir'],'collector_staging_d1_config_drift');
  if(d1.binding!==EXPECTED_BINDING_NAME||d1.database_name!==EXPECTED_DATABASE_NAME||
    d1.database_id!=='00000000-0000-0000-0000-000000000000'||d1.migrations_dir!=='../data-platform/migrations')fail('collector_staging_d1_config_drift');
  return config;
}
export function moduleSpecifiers(source){
  if(typeof source!=='string'||!source.trim())fail('collector_staging_module_missing');
  if(DYNAMIC_IMPORT.test(source))fail('collector_staging_dynamic_import_forbidden');
  STATIC_SPECIFIER.lastIndex=0;const result=[];let match;
  while((match=STATIC_SPECIFIER.exec(source)))result.push(match[1]);
  return Object.freeze(result);
}
function resolveSpecifier(repoPath,specifier){
  if(typeof specifier!=='string'||(!specifier.startsWith('./')&&!specifier.startsWith('../')))fail('collector_staging_external_module_dependency');
  if(/^(?:https?:|npm:|node:)/i.test(specifier)||specifier.includes('node_modules/'))fail('collector_staging_external_module_dependency');
  const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(repoPath),specifier));
  if(resolved.startsWith('../')||path.posix.isAbsolute(resolved)||!resolved.endsWith('.mjs'))fail('collector_staging_unresolved_import');
  return resolved;
}
export function resolveModuleGraph({readFile=repoPath=>fs.readFileSync(path.join(root,repoPath),'utf8')}={}){
  const reviewed=new Set(REVIEWED_MODULE_PATHS),seen=new Set(),sources=new Map(),queue=[ENTRY_PATH];
  while(queue.length){
    const repoPath=queue.shift();if(seen.has(repoPath))continue;
    if(!reviewed.has(repoPath))fail('collector_staging_unreviewed_module');
    let source;try{source=readFile(repoPath);}catch{fail('collector_staging_module_missing');}
    for(const specifier of moduleSpecifiers(source)){
      const resolved=resolveSpecifier(repoPath,specifier);
      if(!reviewed.has(resolved))fail('collector_staging_unreviewed_module');
      if(!seen.has(resolved))queue.push(resolved);
    }
    seen.add(repoPath);sources.set(repoPath,source);
  }
  const actual=[...seen].sort(),expected=[...REVIEWED_MODULE_PATHS].sort();
  if(JSON.stringify(actual)!==JSON.stringify(expected))fail('collector_staging_reviewed_graph_not_exact');
  return new Map(actual.map(repoPath=>[repoPath,sources.get(repoPath)]));
}
const canonicalModuleName=repoPath=>repoPath===ENTRY_PATH?ENTRY_MODULE:'modules/'+repoPath;
function rewriteModule(repoPath,source){
  STATIC_SPECIFIER.lastIndex=0;
  return source.replace(STATIC_SPECIFIER,(whole,specifier)=>{
    const resolved=resolveSpecifier(repoPath,specifier);
    let relative=path.posix.relative(path.posix.dirname(canonicalModuleName(repoPath)),canonicalModuleName(resolved));
    if(!relative.startsWith('.'))relative='./'+relative;
    return whole.replace(specifier,relative);
  });
}
export function buildUploadModules(sources){
  if(!(sources instanceof Map))fail('collector_staging_module_graph_invalid');
  const modules=new Map();
  for(const repoPath of REVIEWED_MODULE_PATHS){
    const source=sources.get(repoPath);if(typeof source!=='string')fail('collector_staging_module_graph_invalid');
    const name=canonicalModuleName(repoPath);if(!SAFE_MODULE_NAME.test(name)||name.includes('../'))fail('collector_staging_upload_module_name_invalid');
    modules.set(name,rewriteModule(repoPath,source));
  }
  if(!modules.has(ENTRY_MODULE)||modules.size!==REVIEWED_MODULE_PATHS.length)fail('collector_staging_module_graph_invalid');
  return modules;
}
export function buildWorkerShellBody(){
  return Object.freeze({name:WORKER_NAME,observability:Object.freeze({enabled:true}),subdomain:Object.freeze({enabled:false,previews_enabled:false})});
}
export function buildVersionMetadata(approvedSha){
  if(typeof approvedSha!=='string'||!HEX40.test(approvedSha))fail('collector_staging_approved_sha_invalid');
  return {
    main_module:ENTRY_MODULE,
    compatibility_date:EXPECTED_COMPATIBILITY_DATE,
    bindings:[
      {name:EXPECTED_BINDING_NAME,type:'d1',database_id:EXPECTED_D1_DATABASE_ID},
      {name:'API_FOOTBALL_FPL_SEASON',type:'plain_text',text:EXPECTED_PLAIN_TEXT_VARS.API_FOOTBALL_FPL_SEASON},
      {name:'API_FOOTBALL_PROVIDER_SEASON',type:'plain_text',text:EXPECTED_PLAIN_TEXT_VARS.API_FOOTBALL_PROVIDER_SEASON},
      {name:'EIA_2I5D_ACTIVATION',type:'plain_text',text:EXPECTED_ACTIVATION}
    ],
    annotations:{
      'workers/commit_sha':approvedSha,
      'workers/message':'API-Football collector inactive staging from '+approvedSha,
      'workers/tag':'api-football-collector-inactive-'+approvedSha.slice(0,12)
    }
  };
}
function canonical(value){
  if(value===null||typeof value==='string'||typeof value==='boolean')return value;
  if(typeof value==='number'){if(!Number.isFinite(value))fail('collector_staging_identity_non_finite');return Object.is(value,-0)?0:value;}
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,canonical(value[key])]));
  fail('collector_staging_identity_value_invalid');
}
const stable=value=>JSON.stringify(canonical(value));
export function deterministicIdentity(metadata,modules,approvedSha){
  if(!metadata||!(modules instanceof Map)||!HEX40.test(String(approvedSha||'')))fail('collector_staging_identity_input_invalid');
  const moduleSha256=Object.fromEntries([...modules.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([name,source])=>[name,sha256(source)]));
  const metadataSha256=sha256(stable(metadata));
  const graphSha256=sha256(stable({approvedSha,entryModule:ENTRY_MODULE,metadataSha256,moduleSha256}));
  return Object.freeze({approvedSha,entryModule:ENTRY_MODULE,metadataSha256,moduleSha256:Object.freeze(moduleSha256),graphSha256});
}
export function buildVersionUploadForm(metadata,modules){
  const form=new FormData();form.set('metadata',JSON.stringify(metadata));
  for(const [name,source] of [...modules.entries()].sort(([a],[b])=>a.localeCompare(b)))form.set(name,new File([source],name,{type:'application/javascript+module'}));
  return form;
}
export function mutationPaths(accountId){
  const account=enc(accountId),script=enc(WORKER_NAME);
  return Object.freeze({createShell:'/accounts/'+account+'/workers/workers',uploadVersion:'/accounts/'+account+'/workers/scripts/'+script+'/versions'});
}
export function assertMutationAllowed(method,requestPath,{accountId}={}){
  const allowed=mutationPaths(accountId);
  if(String(method).toUpperCase()==='POST'&&(requestPath===allowed.createShell||requestPath===allowed.uploadVersion))return true;
  fail('collector_staging_mutation_endpoint_forbidden');
}
function accountPath(accountId,suffix){return '/accounts/'+enc(accountId)+suffix;}
function workerBase(accountId){return accountPath(accountId,'/workers/scripts/'+enc(WORKER_NAME));}
function betaWorkersBase(accountId){return accountPath(accountId,'/workers/workers');}
function decodeCloudflare(text,{mutation=false}={}){
  let payload;try{payload=JSON.parse(text);}catch{if(mutation)throw new MutationAmbiguousError();fail('collector_staging_read_json_invalid');}
  if(!payload||payload.success!==true){if(mutation)throw new MutationAmbiguousError();fail('collector_staging_read_contract_invalid');}
  return payload.result;
}
export function createRequester({accountId,token,fetchImpl=globalThis.fetch,timeoutMs=20000}={}){
  if(typeof accountId!=='string'||!accountId||typeof token!=='string'||!token||typeof fetchImpl!=='function')fail('collector_staging_request_environment_invalid');
  return async(requestPath,{method='GET',body,multipart,allow404=false}={})=>{
    const upper=String(method).toUpperCase(),mutation=upper!=='GET';
    if(mutation)assertMutationAllowed(upper,requestPath,{accountId});
    const headers={Authorization:'Bearer '+token,Accept:'application/json'};let requestBody;
    if(multipart)requestBody=multipart;else if(body!==undefined){headers['Content-Type']='application/json';requestBody=JSON.stringify(body);}
    let response,text;
    try{
      response=await fetchImpl(API_BASE+requestPath,{method:upper,headers,body:requestBody,redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
      text=await response.text();
    }catch{if(mutation)throw new MutationAmbiguousError();fail('collector_staging_read_transport_failed');}
    if(!mutation&&allow404&&response.status===404)return Object.freeze({absent:true,status:404,result:null});
    if(mutation&&response.status>=400&&response.status<500)throw new MutationRejectedError('collector_staging_mutation_rejected_'+response.status);
    if(mutation&&response.status>=500)throw new MutationAmbiguousError();
    if(response.status<200||response.status>=300){if(mutation)throw new MutationAmbiguousError();fail('collector_staging_read_http_failed');}
    const result=decodeCloudflare(text,{mutation});
    if(mutation&&result==null)throw new MutationAmbiguousError();
    return Object.freeze({absent:false,status:response.status,result});
  };
}
export function findWorkerByName(result){
  if(!Array.isArray(result))fail('collector_staging_worker_inventory_invalid');
  const matches=result.filter(row=>row?.name===WORKER_NAME);
  if(matches.length>1)fail('collector_staging_worker_inventory_invalid');
  return matches[0]||null;
}
export function validateWorkerShell(worker){
  if(!worker||worker.name!==WORKER_NAME||typeof worker.id!=='string'||!worker.id||worker.deployed_on!=null||
    worker.subdomain?.enabled!==false||worker.subdomain?.previews_enabled!==false||worker.observability?.enabled!==true)fail('collector_staging_worker_shell_invalid');
  const refs=worker.references;if(!refs||typeof refs!=='object')fail('collector_staging_worker_references_invalid');
  for(const value of Object.values(refs))if(!Array.isArray(value)||value.length!==0)fail('collector_staging_worker_reference_present');
  return Object.freeze({workerId:worker.id});
}
export function extractVersionIds(result){
  if(!result||!Array.isArray(result.items))fail('collector_staging_versions_contract_invalid');
  const ids=result.items.map(row=>row?.id);
  if(ids.some(id=>typeof id!=='string'||!UUID.test(id))||new Set(ids).size!==ids.length)fail('collector_staging_versions_contract_invalid');
  return ids;
}
export function validateVersionDelta(beforeIds,afterIds,returnedId=null){
  if(!Array.isArray(beforeIds)||!Array.isArray(afterIds))fail('collector_staging_version_delta_invalid');
  const before=new Set(beforeIds),added=afterIds.filter(id=>!before.has(id));
  if(added.length!==1||afterIds.length!==beforeIds.length+1)fail('collector_staging_version_delta_ambiguous_owner_review_required');
  if(returnedId!==null&&added[0]!==returnedId)fail('collector_staging_version_delta_ambiguous_owner_review_required');
  return added[0];
}
export async function performShellCreate({request,readWorker,accountId}={}){
  if(typeof request!=='function'||typeof readWorker!=='function')fail('collector_staging_shell_dependencies_invalid');
  let returnedWorker=null,disposition='definite';
  try{
    const response=await request(mutationPaths(accountId).createShell,{method:'POST',body:buildWorkerShellBody()});
    returnedWorker=response.result;
    try{validateWorkerShell(returnedWorker);}catch{returnedWorker=null;throw new MutationAmbiguousError();}
  }catch(error){
    if(error instanceof MutationRejectedError)throw error;
    if(!(error instanceof MutationAmbiguousError))throw error;
    disposition='reconciled';
  }
  let worker;try{worker=await readWorker();validateWorkerShell(worker);}catch{fail('collector_staging_shell_ambiguous_owner_review_required');}
  if(returnedWorker&&returnedWorker.id!==worker.id)fail('collector_staging_shell_ambiguous_owner_review_required');
  return Object.freeze({worker,disposition});
}
export async function performVersionUpload({request,readVersions,accountId,multipart,beforeIds=[]}={}){
  if(typeof request!=='function'||typeof readVersions!=='function'||!(multipart instanceof FormData))fail('collector_staging_upload_dependencies_invalid');
  let returnedId=null,disposition='definite';
  try{
    const response=await request(mutationPaths(accountId).uploadVersion,{method:'POST',multipart});
    const id=response?.result?.id;if(typeof id!=='string'||!UUID.test(id)||beforeIds.includes(id))throw new MutationAmbiguousError();
    returnedId=id;
  }catch(error){
    if(error instanceof MutationRejectedError)throw error;
    if(!(error instanceof MutationAmbiguousError))throw error;
    disposition='reconciled';
  }
  let afterIds;try{afterIds=await readVersions();}catch{fail('collector_staging_version_ambiguous_owner_review_required');}
  const versionId=validateVersionDelta(beforeIds,afterIds,returnedId);
  return Object.freeze({versionId,afterIds:Object.freeze([...afterIds]),disposition});
}
function bindingMap(bindings){
  if(!Array.isArray(bindings))fail('collector_staging_version_bindings_invalid');
  const map=new Map();for(const binding of bindings){
    if(!binding||typeof binding.name!=='string'||typeof binding.type!=='string'||map.has(binding.name))fail('collector_staging_version_bindings_invalid');
    map.set(binding.name,binding);
  }
  return map;
}
export function validateStableVersionDetail(detail,{versionId}={}){
  if(!detail||detail.id!==versionId||!UUID.test(String(versionId||'')))fail('collector_staging_version_identity_invalid');
  if(detail.resources?.script_runtime?.compatibility_date!==EXPECTED_COMPATIBILITY_DATE)fail('collector_staging_version_runtime_drift');
  const bindings=bindingMap(detail.resources?.bindings);if(bindings.size!==4)fail('collector_staging_version_bindings_invalid');
  const d1=bindings.get(EXPECTED_BINDING_NAME);
  if(d1?.type!=='d1'||d1.database_id!==EXPECTED_D1_DATABASE_ID)fail('collector_staging_version_d1_binding_drift');
  for(const [name,text] of Object.entries(EXPECTED_PLAIN_TEXT_VARS)){
    const row=bindings.get(name);if(row?.type!=='plain_text'||String(row.text)!==String(text))fail('collector_staging_version_plain_text_drift');
  }
  if([...bindings.values()].some(row=>row.type==='secret_text'||row.name==='API_FOOTBALL_API_KEY'))fail('collector_staging_secret_binding_present');
  return true;
}
export function validateBetaVersionDetail(detail,{versionId,approvedSha,identity}={}){
  if(!detail||detail.id!==versionId||!UUID.test(String(versionId||''))||detail.number!==1)fail('collector_staging_version_identity_invalid');
  if(detail.main_module!==ENTRY_MODULE||detail.compatibility_date!==EXPECTED_COMPATIBILITY_DATE)fail('collector_staging_version_runtime_drift');
  if(!Array.isArray(detail.urls)||detail.urls.length!==0)fail('collector_staging_version_routable');
  if(detail.annotations?.['workers/tag']!=='api-football-collector-inactive-'+approvedSha.slice(0,12)||
    detail.annotations?.['workers/message']!=='API-Football collector inactive staging from '+approvedSha)fail('collector_staging_version_annotation_drift');
  if(Array.isArray(detail.package_dependencies)&&detail.package_dependencies.length!==0)fail('collector_staging_package_dependency_detected');
  if(!Array.isArray(detail.modules)||detail.modules.length!==Object.keys(identity?.moduleSha256||{}).length)fail('collector_staging_uploaded_module_set_drift');
  const seen=new Set();for(const module of detail.modules){
    if(!module||typeof module.name!=='string'||seen.has(module.name)||typeof module.content_base64!=='string')fail('collector_staging_uploaded_module_set_drift');
    const expected=identity.moduleSha256[module.name];if(!expected)fail('collector_staging_uploaded_module_set_drift');
    if(sha256(Buffer.from(module.content_base64,'base64'))!==expected)fail('collector_staging_uploaded_module_hash_drift');
    seen.add(module.name);
  }
  if(seen.size!==Object.keys(identity.moduleSha256).length)fail('collector_staging_uploaded_module_set_drift');
  return true;
}
export function validatePostflight({worker,subdomain,deployments,schedules,domains,scripts,stableVersion,betaVersion,versionIds,versionId,approvedSha,identity}={}){
  validateWorkerShell(worker);
  if(subdomain?.enabled!==false||subdomain?.previews_enabled!==false)fail('collector_staging_subdomain_drift');
  if(!Array.isArray(deployments?.deployments)||deployments.deployments.length!==0)fail('collector_staging_deployment_present');
  const scheduleRows=Array.isArray(schedules?.schedules)?schedules.schedules:schedules;
  if(!Array.isArray(scheduleRows)||scheduleRows.length!==0)fail('collector_staging_cron_present');
  if(!Array.isArray(domains)||domains.some(row=>row?.service===WORKER_NAME))fail('collector_staging_custom_domain_present');
  if(!Array.isArray(scripts))fail('collector_staging_script_inventory_invalid');
  const script=scripts.find(row=>row?.id===WORKER_NAME),routes=Array.isArray(script?.routes)?script.routes:[];
  if(!script||routes.length!==0)fail('collector_staging_route_present');
  if(!Array.isArray(versionIds)||versionIds.length!==1||versionIds[0]!==versionId)fail('collector_staging_version_count_invalid');
  validateStableVersionDetail(stableVersion,{versionId});
  validateBetaVersionDetail(betaVersion,{versionId,approvedSha,identity});
  return true;
}
export function validateReadOnlyCloseoutReport(report){
  if(!report||report.reason!=='repository_stage_inventory_unexpected')fail('collector_staging_closeout_inventory_transition_unexpected');
  if(report.migrationCount!==6||report.foreignKeyViolations!==0||report.officialFplAuthority?.teamCount!==20||
    report.mapping?.state!=='COMMITTED'||report.mapping?.mappingCount!==20||report.mapping?.memberCount!==20||
    report.mapping?.distinctProviderIds!==20||report.mapping?.distinctFplIds!==20||report.mapping?.canonicalCoverageMatches!==true||
    report.mapping?.historicalAuthorityProvenancePresent!==true)fail('collector_staging_closeout_foundation_drift');
  if(report.runtime?.collectionEnabled!==0||report.runtime?.credentialState!=='UNPROVISIONED'||report.runtime?.activeLease!==false)fail('collector_staging_closeout_runtime_drift');
  if(report.inventory?.workerPresent!==true||report.inventory?.deploymentCount!==0||report.inventory?.cronCount!==0||
    report.inventory?.secretBindingPresent!==false)fail('collector_staging_closeout_inventory_drift');
  if(report.priorState?.requestAttempts!==0||report.priorState?.generations!==0||report.priorState?.fixtureRevisions!==0||
    report.priorState?.attempt2Count!==0||report.priorState?.reservedAttemptCount!==0||report.priorState?.stagingGenerationCount!==0)fail('collector_staging_closeout_history_drift');
  if(report.modelUiImportCount!==0||report.evidence?.productionMutations!==0||report.evidence?.apiFootballRequests!==0||report.evidence?.secretValuesRead!==0)fail('collector_staging_closeout_isolation_drift');
  return true;
}
export async function runInactiveVersionStaging({env=process.env,fetchImpl=globalThis.fetch,readFile=repoPath=>fs.readFileSync(path.join(root,repoPath),'utf8')}={}){
  const token=env.CLOUDFLARE_COLLECTOR_WORKER_UPLOAD_TOKEN,accountId=env.CLOUDFLARE_ACCOUNT_ID,fingerprint=env.CLOUDFLARE_ACCOUNT_FINGERPRINT,approvedSha=env.APPROVED_SHA;
  if(typeof token!=='string'||!token||typeof accountId!=='string'||!accountId||typeof fingerprint!=='string'||!HEX64.test(fingerprint)||typeof approvedSha!=='string'||!HEX40.test(approvedSha))fail('collector_staging_environment_incomplete');
  if(sha256(accountId)!==fingerprint)fail('collector_staging_account_identity_mismatch');
  parseAndValidateConfig(readFile(CONFIG_PATH));
  const sources=resolveModuleGraph({readFile}),modules=buildUploadModules(sources),metadata=buildVersionMetadata(approvedSha),identity=deterministicIdentity(metadata,modules,approvedSha);
  const request=createRequester({accountId,token,fetchImpl});
  const listWorkers=async()=>{const response=await request(betaWorkersBase(accountId)+'?per_page=100&order_by=name&order=asc');if(!Array.isArray(response.result))fail('collector_staging_worker_inventory_invalid');return response.result;};
  const readWorker=async()=>{const found=findWorkerByName(await listWorkers());if(!found)return null;return (await request(betaWorkersBase(accountId)+'/'+enc(found.id))).result;};
  const readVersions=async()=>{const response=await request(workerBase(accountId)+'/versions?deployable=true',{allow404:true});return response.absent?[]:extractVersionIds(response.result);};
  if(findWorkerByName(await listWorkers()))fail('collector_staging_worker_already_exists_owner_review_required');
  const scriptsBefore=(await request(accountPath(accountId,'/workers/scripts'))).result;
  if(!Array.isArray(scriptsBefore)||scriptsBefore.some(row=>row?.id===WORKER_NAME))fail('collector_staging_script_already_exists_owner_review_required');
  const domainsBefore=(await request(accountPath(accountId,'/workers/domains?service='+enc(WORKER_NAME)))).result;
  if(!Array.isArray(domainsBefore)||domainsBefore.length!==0)fail('collector_staging_domain_precondition_failed');
  const shell=await performShellCreate({request,readWorker,accountId});
  const subdomainBefore=(await request(workerBase(accountId)+'/subdomain')).result;
  if(subdomainBefore?.enabled!==false||subdomainBefore?.previews_enabled!==false)fail('collector_staging_shell_routability_invalid');
  const deploymentsBefore=(await request(workerBase(accountId)+'/deployments')).result;
  if(!Array.isArray(deploymentsBefore?.deployments)||deploymentsBefore.deployments.length!==0)fail('collector_staging_shell_deployment_present');
  const schedulesBefore=(await request(workerBase(accountId)+'/schedules')).result;
  const scheduleRows=Array.isArray(schedulesBefore?.schedules)?schedulesBefore.schedules:schedulesBefore;
  if(!Array.isArray(scheduleRows)||scheduleRows.length!==0)fail('collector_staging_shell_cron_present');
  const beforeIds=await readVersions();if(beforeIds.length!==0)fail('collector_staging_first_version_precondition_failed');
  const upload=await performVersionUpload({request,readVersions,accountId,multipart:buildVersionUploadForm(metadata,modules),beforeIds});
  const worker=await readWorker();
  const subdomain=(await request(workerBase(accountId)+'/subdomain')).result;
  const deployments=(await request(workerBase(accountId)+'/deployments')).result;
  const schedules=(await request(workerBase(accountId)+'/schedules')).result;
  const domains=(await request(accountPath(accountId,'/workers/domains?service='+enc(WORKER_NAME)))).result;
  const scripts=(await request(accountPath(accountId,'/workers/scripts'))).result;
  const stableVersion=(await request(workerBase(accountId)+'/versions/'+enc(upload.versionId))).result;
  const betaVersion=(await request(betaWorkersBase(accountId)+'/'+enc(worker.id)+'/versions/'+enc(upload.versionId)+'?include=modules')).result;
  validatePostflight({worker,subdomain,deployments,schedules,domains,scripts,stableVersion,betaVersion,versionIds:upload.afterIds,versionId:upload.versionId,approvedSha,identity});
  return Object.freeze({
    version:STAGING_CONTRACT_VERSION,outcome:'PASS',repositorySha:approvedSha,workerName:WORKER_NAME,candidateVersionId:upload.versionId,
    shellDisposition:shell.disposition,versionDisposition:upload.disposition,moduleCount:modules.size,moduleSha256:identity.moduleSha256,
    metadataSha256:identity.metadataSha256,graphSha256:identity.graphSha256,workersDev:false,previewUrls:false,deploymentCount:0,cronCount:0,
    routeCount:0,customDomainCount:0,secretBindingCount:0,activation:EXPECTED_ACTIVATION,d1BindingDatabaseId:EXPECTED_D1_DATABASE_ID,
    cloudflareMutationPrimitives:2,d1Mutations:0,apiFootballRequests:0
  });
}
function summaryLines(report){return [
  '## API-Football Collector Inactive Version Staging','',
  '- Outcome: **'+report.outcome+'**','- Repository SHA: '+report.repositorySha,'- Worker: '+report.workerName,
  '- Candidate Version: '+report.candidateVersionId,'- Worker shell mutation: '+report.shellDisposition,'- Version upload mutation: '+report.versionDisposition,
  '- Uploaded module count: '+report.moduleCount,'- Module graph SHA-256: '+report.graphSha256,'- Metadata SHA-256: '+report.metadataSha256,
  '- workers.dev: disabled','- Preview URLs: disabled','- Deployments: 0','- Cron schedules: 0','- Routes/custom domains: 0',
  '- Secret bindings: 0','- Activation: REPOSITORY_ONLY_BLOCKED','- D1 mutations: 0','- API-Football requests: 0','',
  'No Deployment, Cron, route/domain, secret, D1 write or provider request was attempted.'
];}
export async function main(){
  for(const value of [process.env.CLOUDFLARE_COLLECTOR_WORKER_UPLOAD_TOKEN,process.env.CLOUDFLARE_ACCOUNT_ID])if(typeof value==='string'&&value)process.stdout.write('::add-mask::'+value+'\n');
  const report=await runInactiveVersionStaging();
  if(typeof process.env.API_FOOTBALL_STAGING_REPORT_PATH==='string'&&process.env.API_FOOTBALL_STAGING_REPORT_PATH)fs.writeFileSync(process.env.API_FOOTBALL_STAGING_REPORT_PATH,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  if(typeof process.env.GITHUB_STEP_SUMMARY==='string'&&process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summaryLines(report).join('\n')+'\n');
  console.log(JSON.stringify({outcome:report.outcome,candidateVersionId:report.candidateVersionId,d1Mutations:0,apiFootballRequests:0}));
  return 0;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)main().catch(error=>{process.stderr.write('Inactive collector staging stopped: '+error.message+'\n');process.exitCode=1;});
