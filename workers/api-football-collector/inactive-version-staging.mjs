import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {EXPECTED_D1_DATABASE_ID} from '../data-platform/phase4b/live-contract.mjs';

export const STAGING_CONTRACT_VERSION='api-football-inactive-version-staging-v1';
export const WORKER_NAME='teamsheet-api-football-shadow-collector';
export const CONFIG_PATH='workers/api-football-collector/wrangler.jsonc';
export const ENTRY_SOURCE_PATH='workers/api-football-collector/collector.mjs';
export const ENTRY_MODULE='collector.mjs';
export const COMPATIBILITY_DATE='2026-09-16';
export const EXPECTED_DATABASE_NAME='teamsheet-data';
export const EXPECTED_FPL_SEASON='2026-27';
export const EXPECTED_PROVIDER_SEASON='2026';
export const EXPECTED_ACTIVATION='REPOSITORY_ONLY_BLOCKED';
export const CLOUDFLARE_API_BASE='https://api.cloudflare.com/client/v4';
export const REQUEST_TIMEOUT_MS=20_000;

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

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const SHA40=/^[0-9a-f]{40}$/;
const HEX64=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATIC_IMPORT=/(?:\bimport\s+(?:[^'";]*?\sfrom\s*)?|\bexport\s+(?:[^'";]*?\sfrom\s*))['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT=/\bimport\s*\(/;
const sha256=value=>createHash('sha256').update(value).digest('hex');
const safe=value=>Object.freeze(value);
const exactKeys=(value,keys,code)=>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(code);
  const actual=Object.keys(value).sort(),expected=[...keys].sort();
  if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error(code);
  return value;
};
const canonical=value=>{
  if(value===null||typeof value==='string'||typeof value==='boolean')return value;
  if(typeof value==='number'){
    if(!Number.isFinite(value))throw new Error('collector_staging_identity_value_invalid');
    return Object.is(value,-0)?0:value;
  }
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,canonical(value[key])]));
  throw new Error('collector_staging_identity_value_invalid');
};
const stableStringify=value=>JSON.stringify(canonical(value));
const accountPath=(accountId,suffix)=>'/accounts/'+encodeURIComponent(accountId)+suffix;
const scriptBase=accountId=>accountPath(accountId,'/workers/scripts/'+encodeURIComponent(WORKER_NAME));
const betaWorkersBase=accountId=>accountPath(accountId,'/workers/workers');

export class MutationRejectedError extends Error{
  constructor(code='collector_staging_mutation_rejected'){super(code);this.name='MutationRejectedError';}
}
export class MutationAmbiguousError extends Error{
  constructor(code='collector_staging_mutation_ambiguous_reconciliation_required_no_retry'){super(code);this.name='MutationAmbiguousError';}
}

export function parseAndValidateConfig(text){
  let config;try{config=JSON.parse(text);}catch{throw new Error('collector_staging_config_json_invalid');}
  exactKeys(config,['$schema','name','main','compatibility_date','workers_dev','preview_urls','observability','vars','triggers','d1_databases'],'collector_staging_config_top_level_drift');
  if(config.$schema!=='node_modules/wrangler/config-schema.json'||config.name!==WORKER_NAME||config.main!==ENTRY_MODULE||
    config.compatibility_date!==COMPATIBILITY_DATE||config.workers_dev!==false||config.preview_urls!==false)throw new Error('collector_staging_config_identity_drift');
  exactKeys(config.observability,['enabled'],'collector_staging_observability_drift');
  if(config.observability.enabled!==true)throw new Error('collector_staging_observability_drift');
  exactKeys(config.vars,['API_FOOTBALL_FPL_SEASON','API_FOOTBALL_PROVIDER_SEASON','EIA_2I5D_ACTIVATION'],'collector_staging_vars_drift');
  if(config.vars.API_FOOTBALL_FPL_SEASON!==EXPECTED_FPL_SEASON||String(config.vars.API_FOOTBALL_PROVIDER_SEASON)!==EXPECTED_PROVIDER_SEASON||
    config.vars.EIA_2I5D_ACTIVATION!==EXPECTED_ACTIVATION)throw new Error('collector_staging_vars_drift');
  exactKeys(config.triggers,['crons'],'collector_staging_triggers_drift');
  if(!Array.isArray(config.triggers.crons)||config.triggers.crons.length!==0)throw new Error('collector_staging_triggers_drift');
  if(!Array.isArray(config.d1_databases)||config.d1_databases.length!==1)throw new Error('collector_staging_d1_config_drift');
  const d1=exactKeys(config.d1_databases[0],['binding','database_name','database_id','migrations_dir'],'collector_staging_d1_config_drift');
  if(d1.binding!=='TEAMSHEET_DATA_DB'||d1.database_name!==EXPECTED_DATABASE_NAME||d1.database_id!=='00000000-0000-0000-0000-000000000000'||
    d1.migrations_dir!=='../data-platform/migrations')throw new Error('collector_staging_d1_config_drift');
  return config;
}

export function staticImportSpecifiers(source){
  if(typeof source!=='string'||!source.trim())throw new Error('collector_staging_module_missing');
  if(DYNAMIC_IMPORT.test(source))throw new Error('collector_staging_dynamic_import_forbidden');
  const result=[];STATIC_IMPORT.lastIndex=0;
  for(const match of source.matchAll(STATIC_IMPORT))result.push(match[1]);
  return result;
}

export function resolveRelativeModule(sourcePath,specifier){
  if(typeof specifier!=='string'||(!specifier.startsWith('./')&&!specifier.startsWith('../')))throw new Error('collector_staging_external_module_dependency');
  if(/^(?:https?:|npm:|node:)/i.test(specifier)||specifier.includes('node_modules/'))throw new Error('collector_staging_external_module_dependency');
  const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath),specifier));
  if(resolved.startsWith('../')||path.posix.isAbsolute(resolved)||!resolved.endsWith('.mjs'))throw new Error('collector_staging_unresolved_module');
  return resolved;
}

export function buildUploadGraph(readFile=file=>fs.readFileSync(path.join(root,file),'utf8')){
  const queue=[ENTRY_SOURCE_PATH],sources=new Map();
  while(queue.length){
    const current=queue.shift();
    if(sources.has(current))continue;
    let source;try{source=readFile(current);}catch{throw new Error('collector_staging_unresolved_module');}
    sources.set(current,source);
    for(const specifier of staticImportSpecifiers(source)){
      const resolved=resolveRelativeModule(current,specifier);
      if(!sources.has(resolved)&&!queue.includes(resolved))queue.push(resolved);
    }
  }
  const actual=[...sources.keys()].sort(),reviewed=[...REVIEWED_MODULE_PATHS].sort();
  if(JSON.stringify(actual)!==JSON.stringify(reviewed))throw new Error('collector_staging_module_allowlist_drift');

  const pathByName=new Map();
  for(const sourcePath of actual){
    const name=path.posix.basename(sourcePath);
    if(pathByName.has(name))throw new Error('collector_staging_module_name_collision');
    pathByName.set(name,sourcePath);
  }
  const uploaded=new Map();
  for(const sourcePath of actual){
    STATIC_IMPORT.lastIndex=0;
    const rewritten=sources.get(sourcePath).replace(STATIC_IMPORT,(whole,specifier)=>{
      const resolved=resolveRelativeModule(sourcePath,specifier),name=path.posix.basename(resolved);
      if(pathByName.get(name)!==resolved)throw new Error('collector_staging_module_rewrite_invalid');
      return whole.replace(specifier,'./'+name);
    });
    for(const specifier of staticImportSpecifiers(rewritten)){
      if(!/^\.\/[A-Za-z0-9._-]+\.mjs$/.test(specifier)||!pathByName.has(specifier.slice(2)))throw new Error('collector_staging_flat_module_graph_invalid');
    }
    uploaded.set(path.posix.basename(sourcePath),rewritten);
  }
  if(!uploaded.has(ENTRY_MODULE)||uploaded.size!==REVIEWED_MODULE_PATHS.length)throw new Error('collector_staging_module_graph_invalid');
  return uploaded;
}

export function buildWorkerShellRequestBody(){
  return {name:WORKER_NAME,observability:{enabled:true},subdomain:{enabled:false,previews_enabled:false}};
}

export function buildVersionMetadata(approvedSha){
  if(typeof approvedSha!=='string'||!SHA40.test(approvedSha))throw new Error('collector_staging_approved_sha_invalid');
  return {
    main_module:ENTRY_MODULE,
    compatibility_date:COMPATIBILITY_DATE,
    bindings:[
      {name:'TEAMSHEET_DATA_DB',type:'d1',database_id:EXPECTED_D1_DATABASE_ID},
      {name:'API_FOOTBALL_FPL_SEASON',type:'plain_text',text:EXPECTED_FPL_SEASON},
      {name:'API_FOOTBALL_PROVIDER_SEASON',type:'plain_text',text:EXPECTED_PROVIDER_SEASON},
      {name:'EIA_2I5D_ACTIVATION',type:'plain_text',text:EXPECTED_ACTIVATION}
    ],
    annotations:{
      'workers/message':'API-Football inactive staging from '+approvedSha,
      'workers/tag':'api-football-collector-inactive-'+approvedSha.slice(0,12)
    }
  };
}

export function deterministicIdentity(metadata,modules,approvedSha){
  if(!metadata||!(modules instanceof Map)||typeof approvedSha!=='string'||!SHA40.test(approvedSha)||modules.size!==REVIEWED_MODULE_PATHS.length)throw new Error('collector_staging_identity_input_invalid');
  const hashes={};for(const name of [...modules.keys()].sort())hashes[name]=sha256(modules.get(name));
  const metadataSha256=sha256(stableStringify(metadata));
  const graphSha256=sha256(stableStringify({approvedSha,entryModule:ENTRY_MODULE,metadataSha256,modules:hashes}));
  return safe({approvedSha,metadataSha256,graphSha256,modules:safe(hashes)});
}

export function buildVersionUploadForm(metadata,modules){
  if(!metadata||!(modules instanceof Map))throw new Error('collector_staging_multipart_input_invalid');
  const form=new FormData();form.set('metadata',JSON.stringify(metadata));
  for(const name of [...modules.keys()].sort())form.set(name,new File([modules.get(name)],name,{type:'application/javascript+module'}));
  return form;
}

export function mutationPaths(accountId){
  return safe({
    createShell:betaWorkersBase(accountId),
    uploadVersion:scriptBase(accountId)+'/versions'
  });
}

export function assertMutationAllowed(method,pathValue,accountId){
  const paths=mutationPaths(accountId),key=String(method||'').toUpperCase()+' '+String(pathValue||'');
  if(key==='POST '+paths.createShell||key==='POST '+paths.uploadVersion)return true;
  throw new Error('collector_staging_mutation_endpoint_forbidden');
}

export function createCloudflareRequester({accountId,token,fetchImpl=globalThis.fetch,timeoutMs=REQUEST_TIMEOUT_MS}={}){
  if(typeof accountId!=='string'||!accountId||typeof token!=='string'||!token||typeof fetchImpl!=='function')throw new Error('collector_staging_request_environment_invalid');
  return async(pathValue,{method='GET',body,multipart,allow404=false}={})=>{
    const upper=String(method).toUpperCase(),mutation=upper!=='GET';
    if(mutation)assertMutationAllowed(upper,pathValue,accountId);
    const headers={Authorization:'Bearer '+token,Accept:'application/json'};let requestBody;
    if(multipart)requestBody=multipart;
    else if(body!==undefined){headers['Content-Type']='application/json';requestBody=JSON.stringify(body);}
    let response,text;
    try{
      response=await fetchImpl(CLOUDFLARE_API_BASE+pathValue,{method:upper,headers,body:requestBody,redirect:'error',signal:AbortSignal.timeout(timeoutMs)});
      text=await response.text();
    }catch{
      if(mutation)throw new MutationAmbiguousError();
      throw new Error('collector_staging_read_transport_failed');
    }
    if(!mutation&&allow404&&response.status===404)return safe({absent:true,status:404,result:null});
    if(mutation&&response.status>=400&&response.status<500)throw new MutationRejectedError('collector_staging_mutation_rejected_'+response.status);
    if(mutation&&response.status>=500)throw new MutationAmbiguousError();
    if(response.status<200||response.status>=300){
      if(mutation)throw new MutationAmbiguousError();
      throw new Error('collector_staging_read_http_failed');
    }
    let payload;try{payload=JSON.parse(text);}catch{
      if(mutation)throw new MutationAmbiguousError();
      throw new Error('collector_staging_read_json_invalid');
    }
    if(!payload||payload.success!==true){
      if(mutation)throw new MutationAmbiguousError();
      throw new Error('collector_staging_read_contract_invalid');
    }
    if(mutation&&payload.result==null)throw new MutationAmbiguousError();
    return safe({absent:false,status:response.status,result:payload.result});
  };
}

export function findWorkerByName(result){
  if(!Array.isArray(result))throw new Error('collector_staging_worker_inventory_invalid');
  const matches=result.filter(row=>row?.name===WORKER_NAME);
  if(matches.length>1)throw new Error('collector_staging_worker_inventory_invalid');
  return matches[0]||null;
}

export function validateInertWorker(worker){
  if(!worker||worker.name!==WORKER_NAME||typeof worker.id!=='string'||!worker.id)throw new Error('collector_staging_worker_identity_invalid');
  if(worker.subdomain?.enabled!==false||worker.subdomain?.previews_enabled!==false)throw new Error('collector_staging_worker_routability_invalid');
  if(worker.observability?.enabled!==true)throw new Error('collector_staging_worker_observability_drift');
  if(worker.deployed_on!==null&&worker.deployed_on!==undefined)throw new Error('collector_staging_worker_deployment_present');
  const references=worker.references;
  if(!references||typeof references!=='object'||Array.isArray(references))throw new Error('collector_staging_worker_references_invalid');
  for(const value of Object.values(references))if(!Array.isArray(value)||value.length!==0)throw new Error('collector_staging_worker_reference_present');
  return worker;
}

export function extractVersionIds(result){
  if(!result||!Array.isArray(result.items))throw new Error('collector_staging_versions_contract_invalid');
  const ids=result.items.map(row=>row?.id);
  if(ids.some(id=>typeof id!=='string'||!UUID.test(id))||new Set(ids).size!==ids.length)throw new Error('collector_staging_versions_contract_invalid');
  return ids;
}

export function validateVersionDelta(beforeIds,afterIds,returnedId=null){
  if(!Array.isArray(beforeIds)||!Array.isArray(afterIds))throw new Error('collector_staging_version_delta_invalid');
  const before=new Set(beforeIds),added=afterIds.filter(id=>!before.has(id));
  if(added.length!==1||afterIds.length!==beforeIds.length+1)throw new Error('collector_staging_version_ambiguous_owner_review_required');
  if(returnedId!==null&&added[0]!==returnedId)throw new Error('collector_staging_version_ambiguous_owner_review_required');
  return added[0];
}

function bindingMap(bindings){
  if(!Array.isArray(bindings))throw new Error('collector_staging_version_bindings_invalid');
  const map=new Map();
  for(const binding of bindings){
    if(!binding||typeof binding.name!=='string'||map.has(binding.name)||typeof binding.type!=='string')throw new Error('collector_staging_version_bindings_invalid');
    map.set(binding.name,binding);
  }
  return map;
}

export function validateVersionDetail(detail,{versionId,approvedSha,identity}={}){
  if(!detail||detail.id!==versionId||!UUID.test(String(versionId||''))||Number(detail.number)!==1)throw new Error('collector_staging_version_identity_invalid');
  if(detail.main_module!==ENTRY_MODULE||String(detail.compatibility_date).slice(0,10)!==COMPATIBILITY_DATE)throw new Error('collector_staging_version_runtime_drift');
  if(!Array.isArray(detail.urls)||detail.urls.length!==0)throw new Error('collector_staging_version_routable');
  if(detail.annotations?.['workers/tag']!=='api-football-collector-inactive-'+approvedSha.slice(0,12)||
    detail.annotations?.['workers/message']!=='API-Football inactive staging from '+approvedSha)throw new Error('collector_staging_version_annotation_drift');
  if(Array.isArray(detail.package_dependencies)&&detail.package_dependencies.length!==0)throw new Error('collector_staging_package_dependency_detected');

  const bindings=bindingMap(detail.bindings);
  if(bindings.size!==4)throw new Error('collector_staging_version_bindings_invalid');
  const d1=bindings.get('TEAMSHEET_DATA_DB');
  if(d1?.type!=='d1'||d1.database_id!==EXPECTED_D1_DATABASE_ID)throw new Error('collector_staging_version_d1_binding_drift');
  for(const [name,text] of [['API_FOOTBALL_FPL_SEASON',EXPECTED_FPL_SEASON],['API_FOOTBALL_PROVIDER_SEASON',EXPECTED_PROVIDER_SEASON],['EIA_2I5D_ACTIVATION',EXPECTED_ACTIVATION]]){
    const row=bindings.get(name);if(row?.type!=='plain_text'||String(row.text)!==text)throw new Error('collector_staging_version_plain_text_drift');
  }
  if([...bindings.values()].some(row=>row.type==='secret_text'||row.name==='API_FOOTBALL_API_KEY'))throw new Error('collector_staging_secret_binding_present');

  if(!identity||!identity.modules||!Array.isArray(detail.modules)||detail.modules.length!==Object.keys(identity.modules).length)throw new Error('collector_staging_uploaded_module_set_drift');
  const seen=new Set();
  for(const module of detail.modules){
    if(!module||typeof module.name!=='string'||seen.has(module.name)||typeof module.content_base64!=='string')throw new Error('collector_staging_uploaded_module_set_drift');
    seen.add(module.name);
    if(!['application/javascript+module','text/javascript+module'].includes(module.content_type))throw new Error('collector_staging_uploaded_module_type_drift');
    const expected=identity.modules[module.name];if(!expected)throw new Error('collector_staging_uploaded_module_set_drift');
    if(sha256(Buffer.from(module.content_base64,'base64'))!==expected)throw new Error('collector_staging_uploaded_module_hash_drift');
  }
  if(seen.size!==Object.keys(identity.modules).length)throw new Error('collector_staging_uploaded_module_set_drift');
  return true;
}

export function validatePostflightState({worker,subdomain,deployments,schedules,domains,scripts,versionDetail,versionIds,versionId,approvedSha,identity}={}){
  validateInertWorker(worker);
  if(subdomain?.enabled!==false||subdomain?.previews_enabled!==false)throw new Error('collector_staging_subdomain_drift');
  if(!Array.isArray(deployments?.deployments)||deployments.deployments.length!==0)throw new Error('collector_staging_deployment_present');
  if(!Array.isArray(schedules?.schedules)||schedules.schedules.length!==0)throw new Error('collector_staging_cron_present');
  if(!Array.isArray(domains)||domains.some(row=>row?.service===WORKER_NAME))throw new Error('collector_staging_custom_domain_present');
  if(!Array.isArray(scripts))throw new Error('collector_staging_script_inventory_invalid');
  const script=scripts.find(row=>row?.id===WORKER_NAME);
  if(!script)throw new Error('collector_staging_script_inventory_invalid');
  if(script.routes!=null&&(!Array.isArray(script.routes)||script.routes.length!==0))throw new Error('collector_staging_route_present');
  if(!Array.isArray(versionIds)||versionIds.length!==1||versionIds[0]!==versionId)throw new Error('collector_staging_version_count_invalid');
  validateVersionDetail(versionDetail,{versionId,approvedSha,identity});
  return true;
}

export async function performShellCreate({request,readWorker,accountId}={}){
  if(typeof request!=='function'||typeof readWorker!=='function')throw new Error('collector_staging_shell_dependencies_invalid');
  let disposition='definite';
  try{
    const response=await request(betaWorkersBase(accountId),{method:'POST',body:buildWorkerShellRequestBody()});
    if(response?.result?.name!==WORKER_NAME||typeof response.result.id!=='string'||!response.result.id)throw new MutationAmbiguousError();
  }catch(error){
    if(error instanceof MutationRejectedError)throw error;
    if(!(error instanceof MutationAmbiguousError))throw error;
    disposition='reconciled';
  }
  let worker;try{worker=await readWorker();validateInertWorker(worker);}catch{throw new Error('collector_staging_shell_ambiguous_owner_review_required');}
  return safe({worker,disposition});
}

export async function performVersionUpload({request,readVersions,accountId,multipart,beforeIds=[]}={}){
  if(typeof request!=='function'||typeof readVersions!=='function'||!(multipart instanceof FormData))throw new Error('collector_staging_upload_dependencies_invalid');
  let returnedId=null,disposition='definite';
  try{
    const response=await request(scriptBase(accountId)+'/versions',{method:'POST',multipart});
    const id=response?.result?.id;
    if(typeof id!=='string'||!UUID.test(id)||beforeIds.includes(id))throw new MutationAmbiguousError();
    returnedId=id;
  }catch(error){
    if(error instanceof MutationRejectedError)throw error;
    if(!(error instanceof MutationAmbiguousError))throw error;
    disposition='reconciled';
  }
  let afterIds;try{afterIds=await readVersions();}catch{throw new Error('collector_staging_version_ambiguous_owner_review_required');}
  const versionId=validateVersionDelta(beforeIds,afterIds,returnedId);
  return safe({versionId,afterIds,disposition});
}

export function sanitizedSummaryLines(report){
  return [
    '## API-Football Collector Inactive Version Staging','',
    '- Outcome: **'+report.outcome+'**',
    '- Repository SHA: `'+report.repositorySha+'`',
    '- Worker: `'+report.workerName+'`',
    '- Candidate Version: `'+report.candidateVersionId+'`',
    '- Worker shell mutation: '+report.shellDisposition,
    '- Version upload mutation: '+report.versionDisposition,
    '- Uploaded module count: '+report.moduleCount,
    '- Module graph SHA-256: `'+report.graphSha256+'`',
    '- Metadata SHA-256: `'+report.metadataSha256+'`',
    '- workers.dev / Preview URLs: disabled / disabled',
    '- Deployments / Cron / routes / custom domains / secrets: 0 / 0 / 0 / 0 / 0',
    '- Activation: `REPOSITORY_ONLY_BLOCKED`',
    '- D1 mutations: 0',
    '- API-Football requests: 0','',
    'No Deployment, Cron, route/domain, secret, D1 write or provider request was attempted.'
  ];
}

export async function runInactiveVersionStaging({env=process.env,fetchImpl=globalThis.fetch,readFile=file=>fs.readFileSync(path.join(root,file),'utf8')}={}){
  const token=env.CLOUDFLARE_COLLECTOR_WORKER_UPLOAD_TOKEN,accountId=env.CLOUDFLARE_ACCOUNT_ID;
  const fingerprint=env.CLOUDFLARE_ACCOUNT_FINGERPRINT,approvedSha=env.APPROVED_SHA;
  if(typeof token!=='string'||!token||typeof accountId!=='string'||!accountId||typeof fingerprint!=='string'||!HEX64.test(fingerprint)||
    typeof approvedSha!=='string'||!SHA40.test(approvedSha))throw new Error('collector_staging_environment_incomplete');
  if(sha256(accountId)!==fingerprint)throw new Error('collector_staging_account_identity_mismatch');

  parseAndValidateConfig(readFile(CONFIG_PATH));
  const modules=buildUploadGraph(readFile),metadata=buildVersionMetadata(approvedSha),identity=deterministicIdentity(metadata,modules,approvedSha);
  const request=createCloudflareRequester({accountId,token,fetchImpl});
  const listWorkers=async()=>{
    const value=await request(betaWorkersBase(accountId)+'?per_page=100&order_by=name&order=asc');
    if(!Array.isArray(value.result))throw new Error('collector_staging_worker_inventory_invalid');
    return value.result;
  };
  const readWorker=async()=>{
    const listed=findWorkerByName(await listWorkers());if(!listed)return null;
    return (await request(betaWorkersBase(accountId)+'/'+encodeURIComponent(listed.id))).result;
  };
  const readVersions=async()=>{
    const value=await request(scriptBase(accountId)+'/versions?deployable=true',{allow404:true});
    return value.absent?[]:extractVersionIds(value.result);
  };

  if(findWorkerByName(await listWorkers()))throw new Error('collector_staging_worker_already_exists_owner_review_required');
  const scriptBefore=await request(scriptBase(accountId)+'/settings',{allow404:true});
  if(!scriptBefore.absent)throw new Error('collector_staging_script_already_exists_owner_review_required');
  const domainsBefore=(await request(accountPath(accountId,'/workers/domains'))).result;
  if(!Array.isArray(domainsBefore)||domainsBefore.some(row=>row?.service===WORKER_NAME))throw new Error('collector_staging_domain_precondition_failed');

  const shell=await performShellCreate({request,readWorker,accountId});
  const deploymentsBefore=await request(scriptBase(accountId)+'/deployments',{allow404:true});
  if(!deploymentsBefore.absent&&(!Array.isArray(deploymentsBefore.result?.deployments)||deploymentsBefore.result.deployments.length!==0))throw new Error('collector_staging_shell_deployment_present');
  const schedulesBefore=await request(scriptBase(accountId)+'/schedules',{allow404:true});
  if(!schedulesBefore.absent&&(!Array.isArray(schedulesBefore.result?.schedules)||schedulesBefore.result.schedules.length!==0))throw new Error('collector_staging_shell_cron_present');

  const beforeIds=await readVersions();
  if(beforeIds.length!==0)throw new Error('collector_staging_first_version_precondition_failed');
  const upload=await performVersionUpload({request,readVersions,accountId,multipart:buildVersionUploadForm(metadata,modules),beforeIds});

  const worker=await readWorker();
  const subdomain=(await request(scriptBase(accountId)+'/subdomain')).result;
  const deployments=(await request(scriptBase(accountId)+'/deployments')).result;
  const schedules=(await request(scriptBase(accountId)+'/schedules')).result;
  const domains=(await request(accountPath(accountId,'/workers/domains'))).result;
  const scripts=(await request(accountPath(accountId,'/workers/scripts'))).result;
  const versionDetail=(await request(betaWorkersBase(accountId)+'/'+encodeURIComponent(worker.id)+'/versions/'+encodeURIComponent(upload.versionId)+'?include=modules')).result;
  validatePostflightState({worker,subdomain,deployments,schedules,domains,scripts,versionDetail,versionIds:upload.afterIds,versionId:upload.versionId,approvedSha,identity});

  return safe({
    version:STAGING_CONTRACT_VERSION,outcome:'PASS',repositorySha:approvedSha,workerName:WORKER_NAME,
    candidateVersionId:upload.versionId,shellDisposition:shell.disposition,versionDisposition:upload.disposition,
    moduleCount:modules.size,moduleSha256:identity.modules,graphSha256:identity.graphSha256,metadataSha256:identity.metadataSha256,
    workersDev:false,previewUrls:false,deploymentCount:0,cronCount:0,routeCount:0,customDomainCount:0,secretBindingCount:0,
    d1BindingExact:true,activation:EXPECTED_ACTIVATION,cloudflareMutationPrimitives:2,d1Mutations:0,apiFootballRequests:0
  });
}

export async function main(){
  const token=process.env.CLOUDFLARE_COLLECTOR_WORKER_UPLOAD_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
  for(const value of [token,account])if(typeof value==='string'&&value)process.stdout.write('::add-mask::'+value+'\n');
  const report=await runInactiveVersionStaging();
  const reportPath=process.env.API_FOOTBALL_STAGING_REPORT_PATH;
  if(typeof reportPath==='string'&&reportPath)fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  if(typeof process.env.GITHUB_STEP_SUMMARY==='string'&&process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,sanitizedSummaryLines(report).join('\n')+'\n');
  console.log(JSON.stringify({outcome:report.outcome,candidateVersionId:report.candidateVersionId,d1Mutations:0,apiFootballRequests:0}));
  return 0;
}

if(import.meta.url===pathToFileURL(process.argv[1]??'').href)main().catch(error=>{
  process.stderr.write('Inactive collector staging stopped: '+error.message+'\n');
  process.exitCode=1;
});
