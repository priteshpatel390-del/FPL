import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {EXPECTED_D1_DATABASE_ID} from '../data-platform/phase4b/live-contract.mjs';

export const WORKER_NAME='teamsheet-api-football-shadow-collector';
export const CONFIG_PATH='workers/api-football-collector/wrangler.jsonc';
export const ENTRY_PATH='workers/api-football-collector/collector.mjs';
export const ENTRY_MODULE='collector.mjs';
export const EXPECTED_COMPATIBILITY_DATE='2026-09-16';
export const EXPECTED_DATABASE_NAME='teamsheet-data';
export const EXPECTED_BINDING_NAME='TEAMSHEET_DATA_DB';
export const EXPECTED_ACTIVATION='REPOSITORY_ONLY_BLOCKED';
export const EXPECTED_PLAIN_TEXT_VARS=Object.freeze({
  API_FOOTBALL_FPL_SEASON:'2026-27',
  API_FOOTBALL_PROVIDER_SEASON:'2026',
  EIA_2I5D_ACTIVATION:EXPECTED_ACTIVATION
});
export const REVIEWED_MODULE_PATHS=Object.freeze([
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

const API_BASE='https://api.cloudflare.com/client/v4';
const CONFIG_KEYS=Object.freeze(['$schema','name','main','compatibility_date','workers_dev','preview_urls','observability','vars','triggers','d1_databases']);
const STATIC_SPECIFIER=/\b(?:import|export)\s+(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT=/\bimport\s*\(/;
const SAFE_MODULE_NAME=/^[A-Za-z0-9_.\/-]+$/;
const HEX40=/^[0-9a-f]{40}$/;
const HEX64=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const sha256=value=>createHash('sha256').update(value).digest('hex');
const exactKeys=(value,expected,code)=>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(code);
  if(JSON.stringify(Object.keys(value).sort())!==JSON.stringify([...expected].sort()))throw new Error(code);
  return value;
};
const canonicalModuleName=repoPath=>repoPath===ENTRY_PATH?ENTRY_MODULE:`modules/${repoPath}`;
const fail=code=>{throw new Error(code);};

export function parseAndValidateConfig(text){
  let config;try{config=JSON.parse(text);}catch{fail('collector_staging_config_json_invalid');}
  exactKeys(config,CONFIG_KEYS,'collector_staging_config_top_level_drift');
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
  if(d1.binding!==EXPECTED_BINDING_NAME||d1.database_name!==EXPECTED_DATABASE_NAME||d1.database_id!=='00000000-0000-0000-0000-000000000000'||d1.migrations_dir!=='../data-platform/migrations')fail('collector_staging_d1_config_drift');
  return config;
}

export function moduleSpecifiers(source){
  if(typeof source!=='string'||!source.trim())fail('collector_staging_module_missing');
  if(DYNAMIC_IMPORT.test(source))fail('collector_staging_dynamic_import_forbidden');
  const specifiers=[];STATIC_SPECIFIER.lastIndex=0;let match;
  while((match=STATIC_SPECIFIER.exec(source)))specifiers.push(match[1]);
  return Object.freeze(specifiers);
}

export function resolveModuleGraph({readFile=repoPath=>fs.readFileSync(repoPath,'utf8')}={}){
  const reviewed=new Set(REVIEWED_MODULE_PATHS),seen=new Set(),sources=new Map(),queue=[ENTRY_PATH];
  while(queue.length){
    const repoPath=queue.shift();
    if(seen.has(repoPath))continue;
    if(!reviewed.has(repoPath))fail('collector_staging_unreviewed_module');
    let source;try{source=readFile(repoPath);}catch{fail('collector_staging_module_missing');}
    const specifiers=moduleSpecifiers(source);
    for(const specifier of specifiers){
      if(!specifier.startsWith('./')&&!specifier.startsWith('../'))fail('collector_staging_external_module_dependency');
      if(/^(?:https?:|npm:|node:)/i.test(specifier)||specifier.includes('node_modules/'))fail('collector_staging_external_module_dependency');
      const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(repoPath),specifier));
      if(resolved.startsWith('../')||path.posix.isAbsolute(resolved)||!resolved.endsWith('.mjs'))fail('collector_staging_unresolved_import');
      if(!reviewed.has(resolved))fail('collector_staging_unreviewed_module');
      queue.push(resolved);
    }
    seen.add(repoPath);sources.set(repoPath,source);
  }
  const actual=[...seen].sort(),expected=[...REVIEWED_MODULE_PATHS].sort();
  if(JSON.stringify(actual)!==JSON.stringify(expected))fail('collector_staging_reviewed_graph_not_exact');
  return new Map(actual.map(repoPath=>[repoPath,sources.get(repoPath)]));
}

function rewriteModule(repoPath,source){
  STATIC_SPECIFIER.lastIndex=0;
  const rewritten=source.replace(STATIC_SPECIFIER,(whole,specifier)=>{
    if(!specifier.startsWith('./')&&!specifier.startsWith('../'))fail('collector_staging_external_module_dependency');
    const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(repoPath),specifier));
    const target=canonicalModuleName(resolved);
    const from=path.posix.dirname(canonicalModuleName(repoPath));
    let relative=path.posix.relative(from,target);if(!relative.startsWith('.'))relative=`./${relative}`;
    return whole.replace(specifier,relative);
  });
  if(DYNAMIC_IMPORT.test(rewritten))fail('collector_staging_dynamic_import_forbidden');
  return rewritten;
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
    compatibility_date:EXPECTED_COMPATIBILITY_DATEe_dependency');
    const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(repoPath),specifier));
    const target=canonicalModuleName(resolved);
    const from=path.posix.dirname(canonicalModuleName(repoPath));
    let relative=path.posix.relative(from,target);if(!relative.startsWith('.'))relative=`./${relative}`;
    return whole.replace(specifier,relative);
  });
  if(DYNAMIC_IMPORT.test(rewritten))fail('collector_staging_dynamic_import_forbidden');
  return rewritten;
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
      'workers/message':`API-Football collector inactive staging from ${approvedSha}`,
      'workers/tag':`api-football-collector-inactive-${approvedSha.slice(0,12)}`
    }
  };
}

export function deterministicIdentity(metadata,modules,approvedSha){
  if(!metadata||!(modules instanceof Map)||!HEX40.test(String(approvedSha||'')))fail('collector_staging_identity_input_invalid');
  const moduleHashes=Object.fromEntries([...modules.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([name,source])=>[name,sha256(source)]));
  const metadataSha256=sha256(JSON.stringify(metadata));
  const graphSha256=sha256(JSON.stringify({approvedSha,entry:ENTRY_MODULE,metadataSha256,modules:moduleHashes}));
  return Object.freeze({approved_sha:approvedSha,entry_module:ENTRY_MODULE,metadata_sha256:metadataSha256,module_sha256:Object.freeze(moduleHashes),graph_sha256:graphSha256});
}

export function buildVersionUploadForm(metadata,modules){
  const form=new FormData();form.set('metadata',JSON.stringify(metadata));
  for(const [name,source] of [...modules.entries()].sort(([a],[b])=>a.localeCompare(b)))form.set(name,new File([source],name,{type:'application/javascript+module'}));
  return form;
}

export function mutationPaths(accountId){
  const account=encodeURIComponent(accountId),script=encodeURIComponent(WORKER_NAME);
  return Object.freeze({
    createShell:`/accounts/${account}/workers/workers`,
    uploadVersion:`/accounts/${account}/workers/scripts/${script}/versions`
  });
}

export function assertMutationAllowed(method,requestPath,{accountId}={}){
  const paths=mutationPaths(accountId),allowed=new Set([`POST ${paths.createShell}`,`POST ${paths.uploadVersion}`]);
  if(!allowed.has(`${String(method).toUpperCase()} ${requestPath}`))fail('collector_staging_mutation_endpoint_forbidden');
  return true;
}

export function validateWorkerShell(worker){
  if(!worker||worker.name!==WORKER_NAME||typeof worker.id!=='string'||!worker.id||worker.deployed_on!=null||
    worker.subdomain?.enabled!==false||worker.subdomain?.previews_enabled!==false||worker.observability?.enabled!==true)fail('collector_staging_worker_shell_invalid');
  const refs=worker.references;
  if(!refs||!Array.isArray(refs.domains)||refs.domains.length!==0||Object.values(refs).some(value=>!Array.isArray(value)||value.length!==0))fail('collector_staging_worker_reference_present');
  return Object.freeze({workerId:worker.id});