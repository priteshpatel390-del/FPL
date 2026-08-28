import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {
  assessCron,assessDeployments,classifyApiResponse,extractD1DatabaseDetails,extractD1QueryResult,
  extractDeploymentsResult,extractSchedulesResult,extractWorkersDomains,validateReadOnlySql
} from '../phase0/readonly-preflight.mjs';
import {PHASE0_QUERIES} from '../phase0/queries.mjs';
import {PHASE1_QUERIES,sameDeployment,validatePostState} from '../phase1/migrate-0002.mjs';

export const WORKER_NAME='teamsheet-data-platform';
export const CONFIG_PATH='workers/data-platform/wrangler.jsonc';
export const EXPECTED_COMPATIBILITY_DATE='2026-08-22';
export const EXPECTED_SEASON='2026-27';
export const EXPECTED_CRON='*/30 * * * *';
export const EXPECTED_ACTIVE_VERSION_ID='3a2b065a-6527-4887-9bf8-b08e82e81133';
export const EXPECTED_ROLLBACK_VERSION_ID='5edbe951-4be4-46bc-b2cf-17b550396105';
export const PHASE1_D1_SIZE_BYTES=151552;
export const EXPECTED_PRODUCTION_HOSTNAME='data.fpltsheet.co.uk';
export const MODULE_PATHS=Object.freeze([
  'workers/data-platform/data-platform-rpc.mjs',
  'workers/data-platform/data-platform.mjs',
  'workers/data-platform/data-platform-core.mjs',
  'workers/data-platform/official-fpl-history.mjs'
]);
const ACTIVE_BINDINGS=Object.freeze(new Map([
  ['TEAMSHEET_DATA_DB','d1'],
  ['DATA_S1_HTTP_AUTH_TOKEN','secret_text'],
  ['DATA_S2_SEASON','plain_text']
]));
const VERSION_BINDINGS=Object.freeze(new Map([
  ['TEAMSHEET_DATA_DB','d1'],
  ['DATA_S1_HTTP_AUTH_TOKEN','secret_text'],
  ['DATA_S2_SEASON','plain_text']
]));
const CONFIG_KEYS=Object.freeze([
  '$schema','name','main','compatibility_date','workers_dev','preview_urls','observability','vars','triggers','d1_databases'
]);

function numeric(value){const number=Number(value);if(!Number.isFinite(number))throw new Error('numeric_contract_invalid');return number;}
function exactKeys(value,expected,code){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(code);
  const actual=Object.keys(value).sort(),wanted=[...expected].sort();
  if(JSON.stringify(actual)!==JSON.stringify(wanted))throw new Error(code);
  return value;
}

export function parseAndValidateConfig(text){
  let config;try{config=JSON.parse(text);}catch{throw new Error('phase4b_config_json_invalid');}
  exactKeys(config,CONFIG_KEYS,'phase4b_config_top_level_drift');
  if(config.$schema!=='node_modules/wrangler/config-schema.json'||config.name!==WORKER_NAME||
     config.main!=='data-platform-rpc.mjs'||config.compatibility_date!==EXPECTED_COMPATIBILITY_DATE||
     config.workers_dev!==false||config.preview_urls!==false)throw new Error('phase4b_config_identity_drift');
  exactKeys(config.observability,['enabled'],'phase4b_observability_drift');
  if(config.observability.enabled!==true)throw new Error('phase4b_observability_drift');
  exactKeys(config.vars,['DATA_S2_SEASON'],'phase4b_vars_drift');
  if(config.vars.DATA_S2_SEASON!==EXPECTED_SEASON)throw new Error('phase4b_vars_drift');
  exactKeys(config.triggers,['crons'],'phase4b_triggers_drift');
  if(!Array.isArray(config.triggers.crons)||config.triggers.crons.length!==1||config.triggers.crons[0]!==EXPECTED_CRON)throw new Error('phase4b_triggers_drift');
  if(!Array.isArray(config.d1_databases)||config.d1_databases.length!==1)throw new Error('phase4b_d1_config_drift');
  const d1=exactKeys(config.d1_databases[0],['binding','database_name','migrations_dir'],'phase4b_d1_config_drift');
  if(d1.binding!=='TEAMSHEET_DATA_DB'||d1.database_name!=='teamsheet-data'||d1.migrations_dir!=='migrations')throw new Error('phase4b_d1_config_drift');
  return config;
}

export function validateActiveVersion(detail,{activeVersionId,databaseId}={}){
  if(!detail||typeof activeVersionId!=='string'||!activeVersionId||detail.id!==activeVersionId||!detail.resources)throw new Error('phase4b_active_version_detail_invalid');
  const bindings=detail.resources.bindings;
  if(!Array.isArray(bindings)||bindings.length!==ACTIVE_BINDINGS.size)throw new Error('phase4b_active_binding_set_drift');
  const seen=new Set();
  let resolvedDatabaseId=null;
  for(const binding of bindings){
    if(!binding||typeof binding.name!=='string'||seen.has(binding.name)||binding.type!==ACTIVE_BINDINGS.get(binding.name))throw new Error('phase4b_active_binding_set_drift');
    seen.add(binding.name);
    if(binding.name==='TEAMSHEET_DATA_DB'){
      if(typeof binding.database_id!=='string'||!binding.database_id)throw new Error('phase4b_active_d1_binding_invalid');
      resolvedDatabaseId=binding.database_id;
      if(databaseId!==undefined&&binding.database_id!==databaseId)throw new Error('phase4b_live_d1_binding_changed');
    }
    if(binding.name==='DATA_S2_SEASON'&&binding.text!==EXPECTED_SEASON)throw new Error('phase4b_active_season_drift');
    if(binding.name==='DATA_S1_HTTP_AUTH_TOKEN'&&Object.hasOwn(binding,'text'))throw new Error('phase4b_secret_exposed');
  }
  if(seen.size!==ACTIVE_BINDINGS.size||!resolvedDatabaseId)throw new Error('phase4b_active_binding_set_drift');
  return {databaseId:resolvedDatabaseId};
}

export function validateModuleGraph(readFile=path=>fs.readFileSync(path,'utf8')){
  const sources=new Map(MODULE_PATHS.map(path=>[path,readFile(path)]));
  for(const [path,source] of sources){if(typeof source!=='string'||!source.trim())throw new Error('phase4b_module_missing');if(/\b(?:import|export)\s*(?:\([^)]*\)|[^;]*?from\s*)?['"](?:https?:|npm:|node_modules\/)/.test(source))throw new Error('phase4b_external_module_dependency');}
  const entry=sources.get(MODULE_PATHS[0]);
  for(const dependency of ['./data-platform.mjs','./official-fpl-history.mjs'])if(!entry.includes(dependency))throw new Error('phase4b_entry_module_graph_drift');
  const platform=sources.get(MODULE_PATHS[1]);
  if(!platform.includes("'./data-platform-core.mjs'"))throw new Error('phase4b_entry_module_graph_drift');
  const history=sources.get(MODULE_PATHS[3]);
  if(!history.includes("'./data-platform-core.mjs'"))throw new Error('phase4b_entry_module_graph_drift');
  return sources;
}

export function validateDomains(rows){const names=extractWorkersDomains(rows).filter(row=>row?.service===WORKER_NAME).map(row=>row.hostname).sort();if(JSON.stringify(names)!==JSON.stringify([EXPECTED_PRODUCTION_HOSTNAME]))throw new Error('phase4b_custom_domain_drift');return names;}
export function sha256(value){return createHash('sha256').update(value).digest('hex');}
export function deterministicIdentity(metadata,sources){return {metadata_sha256:sha256(JSON.stringify(metadata)),modules:Object.fromEntries(MODULE_PATHS.map(path=>[path,sha256(sources.get(path))]))};}
export function assertUploadMutation(method,path,workerBase){if(method!=='POST'||path!==`${workerBase}/versions?bindings_inherit=strict`)throw new Error('phase4b_mutation_endpoint_forbidden');return true;}

export function buildVersionMetadata(activeVersionId,approvedSha){
  if(typeof activeVersionId!=='string'||!activeVersionId||typeof approvedSha!=='string'||!/^[0-9a-f]{40}$/.test(approvedSha))throw new Error('phase4b_version_metadata_input_invalid');
  return {
    main_module:'data-platform-rpc.mjs',
    compatibility_date:EXPECTED_COMPATIBILITY_DATE,
    bindings:[
      {name:'TEAMSHEET_DATA_DB',type:'inherit',version_id:'latest'},
      {name:'DATA_S1_HTTP_AUTH_TOKEN',type:'inherit',version_id:'latest'},
      {name:'DATA_S2_SEASON',type:'plain_text',text:EXPECTED_SEASON}
    ],
    annotations:{
      'workers/message':`DATA-S2B Phase 4B inactive upload from ${approvedSha}`,
      'workers/tag':`data-s2b-phase4b-${approvedSha.slice(0,12)}`
    }
  };
}

export function buildVersionUploadForm(metadata,sources){
  if(!metadata||typeof metadata!=='object'||Array.isArray(metadata)||!(sources instanceof Map))throw new Error('phase4b_multipart_input_invalid');
  const form=new FormData();
  form.set('metadata',JSON.stringify(metadata));
  for(const path of MODULE_PATHS){
    const name=path.split('/').at(-1),source=sources.get(path);
    if(typeof source!=='string')throw new Error('phase4b_multipart_input_invalid');
    form.set(name,new File([source],name,{type:'application/javascript+module'}));
  }
  return form;
}

function redactDiagnostic(value,sensitiveValues=[]){
  let text=value;
  for(const secret of sensitiveValues)if(typeof secret==='string'&&secret)text=text.split(secret).join('[REDACTED]');
  text=text
    .replace(/authorization\s*[:=]?\s*(?:bearer\s+)?[^\s,;]+/gi,'Authorization [REDACTED]')
    .replace(/bearer\s+[^\s,;]+/gi,'Bearer [REDACTED]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,'[REDACTED_ID]')
    .replace(/\b[0-9a-f]{32,}\b/gi,'[REDACTED_ID]');
  if(/[\u0000-\u001f\u007f]/.test(text))return null;
  text=text.trim().replace(/\s+/g,' ');
  return text&&text.length<=300?text:null;
}

export function extractCloudflareError(status,responseText,sensitiveValues=[]){
  const fallback=`HTTP_${Number.isInteger(status)?status:'UNKNOWN'}`;
  let parsed;try{parsed=JSON.parse(responseText);}catch{return fallback;}
  if(!parsed||typeof parsed!=='object'||!Array.isArray(parsed.errors))return fallback;
  const diagnostics=[];
  for(const error of parsed.errors){
    if(!error||typeof error!=='object')continue;
    const code=Number.isSafeInteger(error.code)&&error.code>=0?error.code:null;
    const message=typeof error.message==='string'?redactDiagnostic(error.message,sensitiveValues):null;
    if(code!==null)diagnostics.push(message?`CF_${code}: ${message}`:`CF_${code}`);
  }
  return diagnostics.length?`${fallback} ${diagnostics.join(' | ')}`:fallback;
}

export function extractVersions(result){
  if(!result||!Array.isArray(result.items))throw new Error('phase4b_versions_contract_invalid');
  const ids=result.items.map(row=>row?.id);
  if(ids.some(id=>typeof id!=='string'||!id))throw new Error('phase4b_versions_contract_invalid');
  if(new Set(ids).size!==ids.length)throw new Error('phase4b_versions_contract_invalid');
  return ids;
}

export function requireLatestActiveVersion(versionIds,activeVersionId){
  if(!Array.isArray(versionIds)||typeof activeVersionId!=='string'||!activeVersionId||!versionIds.includes(activeVersionId))throw new Error('phase4b_active_version_missing_from_version_list');
  if(versionIds[0]!==activeVersionId)throw new Error('phase4b_latest_version_not_active');
  return true;
}

export async function submitVersionUpload({request,workerBase,multipart,versionIds,activeVersionId}){
  if(typeof request!=='function'||typeof workerBase!=='string'||!workerBase||!(multipart instanceof FormData))throw new Error('phase4b_upload_submission_input_invalid');
  requireLatestActiveVersion(versionIds,activeVersionId);
  const path=`${workerBase}/versions?bindings_inherit=strict`;assertUploadMutation('POST',path,workerBase);return request(path,{method:'POST',multipart,ambiguous:true});
}

export function extractUploadedVersion(result,activeVersionId){
  const id=result?.id;
  if(typeof id!=='string'||!id||id===activeVersionId)throw new Error('phase4b_upload_result_invalid');
  return id;
}

export function validateVersionDelta(beforeIds,afterIds,uploadedId){
  if(!Array.isArray(beforeIds)||!Array.isArray(afterIds)||typeof uploadedId!=='string'||!uploadedId)throw new Error('phase4b_version_delta_invalid');
  if(beforeIds.includes(uploadedId)||!afterIds.includes(uploadedId))throw new Error('phase4b_version_delta_invalid');
  const before=new Set(beforeIds),added=afterIds.filter(id=>!before.has(id));
  if(added.length!==1||added[0]!==uploadedId||afterIds[0]!==uploadedId)throw new Error('phase4b_version_delta_invalid');
  if(!afterIds.includes(EXPECTED_ACTIVE_VERSION_ID)||!afterIds.includes(EXPECTED_ROLLBACK_VERSION_ID))throw new Error('phase4b_version_provenance_anchors_missing');
  return true;
}

export function capturePreUploadSnapshot({deployment,versionIds,databaseId,domains,schedules,database,state,health}){
  if(!deployment||typeof deployment.deploymentId!=='string'||deployment.versionId!==EXPECTED_ACTIVE_VERSION_ID)throw new Error('phase4b_preupload_snapshot_invalid');
  requireLatestActiveVersion(versionIds,deployment.versionId);
  if(!versionIds.includes(EXPECTED_ROLLBACK_VERSION_ID)||typeof databaseId!=='string'||!databaseId)throw new Error('phase4b_preupload_snapshot_invalid');
  return Object.freeze({
    deploymentId:deployment.deploymentId,activeVersionId:deployment.versionId,versionIds:Object.freeze([...versionIds]),
    expectedLatestVersionId:EXPECTED_ACTIVE_VERSION_ID,rollbackPresent:true,databaseId,
    cronCount:schedules.length,database:Object.freeze({...database}),d1State:state,
    hostname:domains[0],health:Object.freeze({...health})
  });
}

export function validateUploadedVersion(detail,{uploadedId,databaseId}){
  if(!detail||detail.id!==uploadedId||!detail.resources)throw new Error('phase4b_version_detail_invalid');
  const runtime=detail.resources.script_runtime;
  if(!runtime||runtime.compatibility_date!==EXPECTED_COMPATIBILITY_DATE)throw new Error('phase4b_version_runtime_drift');
  const bindings=detail.resources.bindings;
  if(!Array.isArray(bindings)||bindings.length!==VERSION_BINDINGS.size)throw new Error('phase4b_version_binding_set_drift');
  const seen=new Set();
  for(const binding of bindings){
    if(!binding||typeof binding.name!=='string'||seen.has(binding.name)||binding.type!==VERSION_BINDINGS.get(binding.name))throw new Error('phase4b_version_binding_set_drift');
    seen.add(binding.name);
    if(binding.name==='TEAMSHEET_DATA_DB'&&binding.database_id!==databaseId)throw new Error('phase4b_version_d1_binding_drift');
    if(binding.name==='DATA_S2_SEASON'&&binding.text!==EXPECTED_SEASON)throw new Error('phase4b_version_season_drift');
    if(binding.name==='DATA_S1_HTTP_AUTH_TOKEN'&&Object.hasOwn(binding,'text'))throw new Error('phase4b_secret_exposed');
  }
  if(seen.size!==VERSION_BINDINGS.size)throw new Error('phase4b_version_binding_set_drift');
  return true;
}

export function validatePostPhase1State({migrations,sourceRows,revisionRows,counts,official}){
  return validatePostState({migrations,sourceRows,revisionRows,counts,official});
}

async function main(){
  const token=process.env.CLOUDFLARE_WORKER_UPLOAD_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
  const approvedSha=process.env.APPROVED_SHA;
  const healthToken=process.env.DATA_S1_HTTP_AUTH_TOKEN,accessId=process.env.CF_ACCESS_CLIENT_ID,accessSecret=process.env.CF_ACCESS_CLIENT_SECRET;
  if(!token||!account||!approvedSha||!healthToken||!accessId||!accessSecret)throw new Error('required_phase4b_credentials_or_identity_missing');
  if(!/^[0-9a-f]{40}$/.test(approvedSha))throw new Error('approved_sha_invalid');
  for(const value of [token,account,healthToken,accessId,accessSecret])process.stdout.write(`::add-mask::${value}\n`);

  parseAndValidateConfig(fs.readFileSync(CONFIG_PATH,'utf8'));
  const sources=validateModuleGraph();
  const base='https://api.cloudflare.com/client/v4';
  let databaseId,scriptEtag=null;
  const request=async(path,{method='GET',body,multipart,ambiguous=false}={})=>{
    const headers={Authorization:`Bearer ${token}`};
    let requestBody;
    if(multipart){requestBody=multipart;}
    else if(body!==undefined){headers['Content-Type']='application/json';requestBody=JSON.stringify(body);}
    let response,text;try{response=await fetch(`${base}${path}`,{method,headers,body:requestBody,redirect:'error'});text=await response.text();}catch{if(ambiguous)throw new Error('phase4b_upload_outcome_ambiguous_reconciliation_required_no_retry');throw new Error('phase4b_api_transport_failed');}
    const sensitive=[token,account,databaseId];
    let parsed;try{parsed=JSON.parse(text);}catch{if(ambiguous)throw new Error('phase4b_upload_outcome_ambiguous_reconciliation_required_no_retry');throw new Error(response.ok?'api_json_invalid':extractCloudflareError(response.status,text,sensitive));}
    if(method==='POST'&&path===`${workerBase}/versions?bindings_inherit=strict`)scriptEtag=response.headers.get('etag');
    const outcome=classifyApiResponse(response.status,parsed);
    if(!outcome.ok){if(ambiguous&&response.status>=500)throw new Error('phase4b_upload_outcome_ambiguous_reconciliation_required_no_retry');throw new Error(extractCloudflareError(response.status,text,sensitive));}
    return outcome.result;
  };

  const workerBase=`/accounts/${encodeURIComponent(account)}/workers/scripts/${WORKER_NAME}`;
  const health=async()=>{const response=await fetch(`https://${EXPECTED_PRODUCTION_HOSTNAME}/v1/health`,{headers:{Authorization:`Bearer ${healthToken}`,'CF-Access-Client-Id':accessId,'CF-Access-Client-Secret':accessSecret},redirect:'error'});let body;try{body=await response.json();}catch{throw new Error('phase4b_health_response_invalid');}if(response.status!==200||body?.ok!==true||body?.mode!=='shadow_only')throw new Error('phase4b_health_failed');return {ok:true,mode:'shadow_only'};};
  const domainsBefore=validateDomains(await request(`/accounts/${encodeURIComponent(account)}/workers/domains`));
  const healthBefore=await health();
  const deploymentsBefore=assessDeployments(extractDeploymentsResult(await request(`${workerBase}/deployments`)));
  if(deploymentsBefore.versionId!==EXPECTED_ACTIVE_VERSION_ID)throw new Error('phase4b_active_version_drift');
  const activeDetailBefore=await request(`${workerBase}/versions/${encodeURIComponent(deploymentsBefore.versionId)}`);
  databaseId=validateActiveVersion(activeDetailBefore,{activeVersionId:deploymentsBefore.versionId}).databaseId;
  process.stdout.write(`::add-mask::${databaseId}\n`);
  const schedulesBefore=extractSchedulesResult(await request(`${workerBase}/schedules`));
  assessCron(schedulesBefore);
  const d1Base=`/accounts/${encodeURIComponent(account)}/d1/database/${encodeURIComponent(databaseId)}`;
  const databaseBefore=extractD1DatabaseDetails(await request(`${d1Base}?fields=uuid,name,file_size`),{uuid:databaseId});
  const query=async sql=>extractD1QueryResult(await request(`${d1Base}/query`,{method:'POST',body:{sql:validateReadOnlySql(sql)}}));
  const readPhase1State=async()=>({
    migrations:await query(PHASE0_QUERIES.migrations),
    sourceRows:await query(PHASE1_QUERIES.source),
    revisionRows:await query(PHASE1_QUERIES.revision),
    counts:(await query(PHASE0_QUERIES.counts))[0],
    official:(await query(PHASE0_QUERIES.officialHistory))[0]
  });
  const d1StateBefore=await readPhase1State();
  validatePostPhase1State(d1StateBefore);

  const metadata=buildVersionMetadata(deploymentsBefore.versionId,approvedSha);
  const identity=deterministicIdentity(metadata,sources);
  const multipart=buildVersionUploadForm(metadata,sources);

  // This is deliberately the final read before the single mutation. Cloudflare only
  // accepts `latest` for inherited bindings, so latest must still equal the exact
  // production-active Version after all slower preparation has completed.
  const finalDeploymentBefore=assessDeployments(extractDeploymentsResult(await request(`${workerBase}/deployments`)));
  sameDeployment(deploymentsBefore,finalDeploymentBefore);
  const versionsBefore=extractVersions(await request(`${workerBase}/versions?deployable=true`));
  requireLatestActiveVersion(versionsBefore,finalDeploymentBefore.versionId);
  if(!versionsBefore.includes(EXPECTED_ROLLBACK_VERSION_ID))throw new Error('phase4b_rollback_version_missing');
  const preUpload=capturePreUploadSnapshot({deployment:finalDeploymentBefore,versionIds:versionsBefore,databaseId,domains:domainsBefore,schedules:schedulesBefore,database:databaseBefore,state:d1StateBefore,health:healthBefore});
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `## DATA-S2B Phase 4B — Pre-upload checkpoint\n\n- Repository SHA: \`${approvedSha}\`\n- Active deployment/version: \`${deploymentsBefore.deploymentId}\` / \`${deploymentsBefore.versionId}\`\n- Cron expressions: none\n- Active-version DATA_S2_SEASON: 2026-27\n- D1 Phase 1 post-state: PASS\n- No version upload had been submitted at this checkpoint.\n\n`);

  let uploadedId;
  const uploadResult=await submitVersionUpload({request,workerBase,multipart,versionIds:preUpload.versionIds,activeVersionId:preUpload.activeVersionId});
  uploadedId=extractUploadedVersion(uploadResult,preUpload.activeVersionId);
  let databaseAfter;
  try{
    const versionsAfter=extractVersions(await request(`${workerBase}/versions?deployable=true`));
    validateVersionDelta(preUpload.versionIds,versionsAfter,uploadedId);
    const detail=await request(`${workerBase}/versions/${encodeURIComponent(uploadedId)}`);
    validateUploadedVersion(detail,{uploadedId,databaseId:preUpload.databaseId});

    await health();
    if(JSON.stringify(validateDomains(await request(`/accounts/${encodeURIComponent(account)}/workers/domains`)))!==JSON.stringify(domainsBefore))throw new Error('phase4b_domain_changed');
    const deploymentsAfter=assessDeployments(extractDeploymentsResult(await request(`${workerBase}/deployments`)));
    sameDeployment(deploymentsBefore,deploymentsAfter);
    const activeDetailAfter=await request(`${workerBase}/versions/${encodeURIComponent(deploymentsAfter.versionId)}`);
    validateActiveVersion(activeDetailAfter,{activeVersionId:deploymentsAfter.versionId,databaseId});
    const schedulesAfter=extractSchedulesResult(await request(`${workerBase}/schedules`));
    assessCron(schedulesAfter);
    validatePostPhase1State(await readPhase1State());
    databaseAfter=extractD1DatabaseDetails(await request(`${d1Base}?fields=uuid,name,file_size`),{uuid:databaseId});
    if(numeric(databaseBefore.file_size)!==PHASE1_D1_SIZE_BYTES)throw new Error('phase4b_d1_size_baseline_drift');
    if(numeric(databaseAfter.file_size)!==numeric(databaseBefore.file_size))throw new Error('phase4b_d1_size_changed');
    await health();
  }catch{
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`## DATA-S2B Phase 4B — Postflight blocked\n\n- Inactive candidate: \`${uploadedId}\`\n- Deployment authorization: **BLOCKED**\n- Required action: separate read-only reconciliation and owner review.\n- No retry, Deployment or automatic cleanup was attempted.\n`);
    throw new Error('phase4b_postflight_failed_candidate_quarantined_deployment_blocked');
  }

  const summary=[
    '## DATA-S2B Phase 4B — Inactive Worker Version Upload',
    '',
    '- Outcome: **PASS**',
    `- Repository SHA: \`${approvedSha}\``,
    `- Uploaded inactive Worker version: \`${uploadedId}\``,
    `- Metadata SHA-256: \`${identity.metadata_sha256}\``,
    `- Cloudflare script etag: ${scriptEtag?`\`${scriptEtag}\``:'not returned by API'}`,
    ...Object.entries(identity.modules).map(([path,hash])=>`- Module SHA-256 \`${path}\`: \`${hash}\``),
    '- Upload primitive: official Workers Version Upload API with `bindings_inherit=strict`',
    '- Uploaded modules: 4 exact repository ES modules',
    '- New version binding: `TEAMSHEET_DATA_DB` inherited from exact active version',
    '- New version binding: `DATA_S1_HTTP_AUTH_TOKEN` inherited from exact active version; secret value never read',
    '- New version binding: `DATA_S2_SEASON=2026-27`',
    '- New version compatibility date: `2026-08-22`',
    '- Active deployment/version: unchanged',
    '- Production traffic: unchanged by deployment evidence',
    '- Active-version DATA_S2_SEASON: 2026-27',
    '- Live Cron expressions: none',
    '- Active-version D1 binding: unchanged',
    '- D1 Phase 1 schema/governance/count state: unchanged',
    `- D1 database size before/after: ${databaseBefore.file_size} / ${databaseAfter.file_size}`,
    '',
    'No Worker deployment, trigger, route/domain, secret mutation or D1 write was performed.',
    'Raw Cloudflare responses are not persisted, logged or uploaded.'
  ];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`${summary.join('\n')}\n`);
}

if(import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{
  process.stderr.write(`Phase 4B stopped: ${error.message}\n`);
  process.exitCode=1;
});
