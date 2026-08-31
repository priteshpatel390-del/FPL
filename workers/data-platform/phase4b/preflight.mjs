import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {
  assessCron,classifyApiResponse,extractD1DatabaseDetails,extractD1QueryResult,
  extractDeploymentsResult,extractSchedulesResult,extractWorkersDomains,validateReadOnlySql
} from '../phase0/readonly-preflight.mjs';
import {PHASE0_QUERIES} from '../phase0/queries.mjs';
import {PHASE1_QUERIES} from '../phase1/migrate-0002.mjs';
import {EXPECTED_ACTIVE_DEPLOYMENT_ID,EXPECTED_ACTIVE_VERSION_ID,EXPECTED_CRON,EXPECTED_D1_DATABASE_ID,EXPECTED_ROLLBACK_VERSION_ID,POST_ACTIVATION_RUNS_QUERY,RETAINED_OLDER_VERSION_ID,validateExactCron,validatePostActivationState} from './live-contract.mjs';

export const WORKER_NAME='teamsheet-data-platform';
export const EXPECTED_PRODUCTION_HOSTNAME='data.fpltsheet.co.uk';
export {EXPECTED_ACTIVE_DEPLOYMENT_ID,EXPECTED_ACTIVE_VERSION_ID,EXPECTED_CRON,EXPECTED_D1_DATABASE_ID,EXPECTED_ROLLBACK_VERSION_ID,RETAINED_OLDER_VERSION_ID};
export const EXPECTED_COMPATIBILITY_DATE='2026-08-22';
export const EXPECTED_SEASON='2026-27';
const EXPECTED_BINDINGS=Object.freeze(new Map([
  ['TEAMSHEET_DATA_DB','d1'],
  ['DATA_S1_HTTP_AUTH_TOKEN','secret_text'],
  ['DATA_S2_SEASON','plain_text']
]));

export function assertReadOnlyApiRequest({method='GET',path,workerBase,d1Base,sql}){
  if(typeof path!=='string'||typeof workerBase!=='string'||typeof d1Base!=='string')throw new Error('phase4b_preflight_request_invalid');
  const workerReads=new Set([
    `${workerBase}/deployments`,`${workerBase}/versions?deployable=true`,`${workerBase}/schedules`
  ]);
  const versionDetail=new RegExp(`^${escapeRegex(workerBase)}/versions/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$`);
  const accountBase=workerBase.split('/workers/scripts/')[0];
  const domainRead=path===`${accountBase}/workers/domains`;
  const validD1Base=/^\/accounts\/[^/]+\/d1\/database\/[^/]+$/.test(d1Base);
  const d1Metadata=validD1Base&&path===`${d1Base}?fields=uuid,name,file_size`;
  if(method==='GET'&&(workerReads.has(path)||versionDetail.test(path)||domainRead||d1Metadata))return {method:'GET'};
  if(method==='POST'&&validD1Base&&path===`${d1Base}/query`){return {method:'POST',body:{sql:validateReadOnlySql(sql)}};}
  throw new Error('phase4b_preflight_endpoint_forbidden');
}
function escapeRegex(value){return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}

export function validateDeployment(result){
  const rows=extractDeploymentsResult(result);
  if(rows.length<2)throw new Error('phase4b_preflight_rollback_deployment_missing');
  const current=rows[0];
  if(!current||typeof current.id!=='string'||!current.id||!Array.isArray(current.versions)||current.versions.length!==1)throw new Error('phase4b_preflight_active_deployment_invalid');
  const only=current.versions[0];
  if(only?.version_id!==EXPECTED_ACTIVE_VERSION_ID||only?.percentage!==100)throw new Error('phase4b_preflight_active_version_drift');
  if(current.id!==EXPECTED_ACTIVE_DEPLOYMENT_ID)throw new Error('phase4b_preflight_active_deployment_drift');
  return {deploymentId:current.id,versionId:only.version_id};
}

export function extractVersions(result){
  if(!result||!Array.isArray(result.items))throw new Error('phase4b_preflight_versions_contract_invalid');
  const ids=result.items.map(row=>row?.id);
  if(ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length)throw new Error('phase4b_preflight_versions_contract_invalid');
  return ids;
}

export function validateVersions(ids){
  if(!Array.isArray(ids)||ids[0]!==EXPECTED_ACTIVE_VERSION_ID)throw new Error('phase4b_preflight_latest_active_drift');
  if(!ids.includes(EXPECTED_ROLLBACK_VERSION_ID)||!ids.includes(RETAINED_OLDER_VERSION_ID))throw new Error('phase4b_preflight_rollback_version_missing');
  return ids;
}

export function validateActiveVersion(detail){
  if(!detail||detail.id!==EXPECTED_ACTIVE_VERSION_ID||!detail.resources)throw new Error('phase4b_preflight_version_detail_invalid');
  if(detail.resources.script_runtime?.compatibility_date!==EXPECTED_COMPATIBILITY_DATE)throw new Error('phase4b_preflight_compatibility_drift');
  const bindings=detail.resources.bindings;
  if(!Array.isArray(bindings)||bindings.length!==EXPECTED_BINDINGS.size)throw new Error('phase4b_preflight_binding_set_drift');
  const seen=new Set();let databaseId;
  for(const binding of bindings){
    if(!binding||typeof binding.name!=='string'||seen.has(binding.name)||binding.type!==EXPECTED_BINDINGS.get(binding.name))throw new Error('phase4b_preflight_binding_set_drift');
    seen.add(binding.name);
    if(binding.name==='TEAMSHEET_DATA_DB'){
      if(typeof binding.database_id!=='string'||!binding.database_id)throw new Error('phase4b_preflight_d1_binding_invalid');
      databaseId=binding.database_id;if(databaseId!==EXPECTED_D1_DATABASE_ID)throw new Error('phase4b_preflight_d1_binding_invalid');
    }
    if(binding.name==='DATA_S1_HTTP_AUTH_TOKEN'&&Object.hasOwn(binding,'text'))throw new Error('phase4b_preflight_secret_exposed');
    if(binding.name==='DATA_S2_SEASON'&&binding.text!==EXPECTED_SEASON)throw new Error('phase4b_preflight_season_drift');
  }
  if(seen.size!==EXPECTED_BINDINGS.size||!databaseId)throw new Error('phase4b_preflight_binding_set_drift');
  return {databaseId,bindings:[...EXPECTED_BINDINGS.entries()].map(([name,type])=>({name,type}))};
}

export function validateDomains(result){
  const hostnames=extractWorkersDomains(result).filter(row=>row?.service===WORKER_NAME).map(row=>row?.hostname).filter(Boolean).sort();
  if(JSON.stringify(hostnames)!==JSON.stringify([EXPECTED_PRODUCTION_HOSTNAME]))throw new Error('phase4b_preflight_domain_drift');
  return hostnames;
}

export function validateCron(result){return validateExactCron(extractSchedulesResult(result));}

export function validateDatabase(database,databaseId){
  const exact=extractD1DatabaseDetails(database,{uuid:databaseId});
  if(exact.uuid!==EXPECTED_D1_DATABASE_ID||exact.name!=='teamsheet-data')throw new Error('phase4b_preflight_d1_identity_drift');
  return exact;
}

export function validateD1State(state){return validatePostActivationState(state);}

export function validateHealth(status,body){
  if(status!==200||body?.ok!==true||body?.mode!=='shadow_only')throw new Error('phase4b_preflight_health_failed');
  return true;
}

export function buildSanitizedSummary({approvedSha,deploymentId,counts,d1Size}){
  if(!/^[0-9a-f]{40}$/.test(approvedSha||'')||typeof deploymentId!=='string'||!deploymentId)throw new Error('phase4b_preflight_summary_input_invalid');
  const lines=[
    '## DATA-S2B Phase 4B — Mutation-Free Live Preflight','', '- Outcome: **PASS**',
    `- Repository SHA: \`${approvedSha}\``,`- Production Deployment ID: \`${deploymentId}\``,
    `- Active Version ID: \`${EXPECTED_ACTIVE_VERSION_ID}\``,`- Rollback Version present: \`${EXPECTED_ROLLBACK_VERSION_ID}\``,
    `- Production hostname: \`${EXPECTED_PRODUCTION_HOSTNAME}\``,'- Bindings: `TEAMSHEET_DATA_DB` (d1), `DATA_S1_HTTP_AUTH_TOKEN` (secret_text; value not read), `DATA_S2_SEASON` (plain_text)',
    `- Compatibility date: \`${EXPECTED_COMPATIBILITY_DATE}\``,`- Season: \`${EXPECTED_SEASON}\``,`- Cron expression: \`${EXPECTED_CRON}\``,'- D1 post-activation acceptance contract: PASS',
    `- DATA-S2 history counts: ingestion_runs=${counts.ingestion_runs}, shadow_observations=${counts.shadow_observations}, observation_heads=${counts.observation_heads}, canonical_entities=${counts.canonical_entities}`,
    `- D1 size: ${d1Size} bytes`,'- Authenticated production health: PASS','',
    '- Worker Version uploads: 0','- Deployments: 0','- Cron mutations: 0','- D1 writes/migrations: 0','- Route/domain mutations: 0','- Access mutations: 0','- Secret mutations: 0','- Collector executions: 0','',
    'This preflight is read-only. Raw Cloudflare responses and secret values are not persisted or uploaded.'
  ];
  return `${lines.join('\n')}\n`;
}

async function main(){
  const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID,approvedSha=process.env.APPROVED_SHA;
  const healthToken=process.env.DATA_S1_HTTP_AUTH_TOKEN,accessId=process.env.CF_ACCESS_CLIENT_ID,accessSecret=process.env.CF_ACCESS_CLIENT_SECRET;
  const sensitive=[token,account,healthToken,accessId,accessSecret];
  if(sensitive.some(value=>!value)||!/^[0-9a-f]{40}$/.test(approvedSha||''))throw new Error('phase4b_preflight_required_credentials_or_identity_missing');
  for(const value of sensitive)process.stdout.write(`::add-mask::${value}\n`);

  const api='https://api.cloudflare.com/client/v4';
  const workerBase=`/accounts/${encodeURIComponent(account)}/workers/scripts/${WORKER_NAME}`;
  let databaseId,d1Base='';
  const request=async(path,{method='GET',sql}={})=>{
    const allowed=assertReadOnlyApiRequest({method,path,workerBase,d1Base,sql});
    const headers={Authorization:`Bearer ${token}`};
    if(allowed.body)headers['Content-Type']='application/json';
    let response,text;
    try{response=await fetch(`${api}${path}`,{method:allowed.method,headers,body:allowed.body?JSON.stringify(allowed.body):undefined,redirect:'error'});text=await response.text();}
    catch{throw new Error('phase4b_preflight_api_transport_failed');}
    let parsed;try{parsed=JSON.parse(text);}catch{throw new Error(response.ok?'phase4b_preflight_api_json_invalid':`HTTP_${response.status}`);}
    const outcome=classifyApiResponse(response.status,parsed);
    if(!outcome.ok)throw new Error(outcome.diagnostic);
    return outcome.result;
  };
  const health=async()=>{
    let response,body;
    try{response=await fetch(`https://${EXPECTED_PRODUCTION_HOSTNAME}/v1/health`,{headers:{Authorization:`Bearer ${healthToken}`,'CF-Access-Client-Id':accessId,'CF-Access-Client-Secret':accessSecret},redirect:'error'});body=await response.json();}
    catch{throw new Error('phase4b_preflight_health_transport_failed');}
    validateHealth(response.status,body);
  };

  const deploymentBefore=validateDeployment(await request(`${workerBase}/deployments`));
  const versionsBefore=validateVersions(extractVersions(await request(`${workerBase}/versions?deployable=true`)));
  validateDomains(await request(`/accounts/${encodeURIComponent(account)}/workers/domains`));
  const active=validateActiveVersion(await request(`${workerBase}/versions/${EXPECTED_ACTIVE_VERSION_ID}`));
  databaseId=active.databaseId;process.stdout.write(`::add-mask::${databaseId}\n`);
  d1Base=`/accounts/${encodeURIComponent(account)}/d1/database/${encodeURIComponent(databaseId)}`;
  validateCron(await request(`${workerBase}/schedules`));
  const databaseBefore=validateDatabase(await request(`${d1Base}?fields=uuid,name,file_size`),databaseId);
  const query=async sql=>extractD1QueryResult(await request(`${d1Base}/query`,{method:'POST',sql}));
  const readD1=async()=>({migrations:await query(PHASE0_QUERIES.migrations),sourceRows:await query(PHASE1_QUERIES.source),revisionRows:await query(PHASE1_QUERIES.revision),counts:(await query(PHASE0_QUERIES.counts))[0],official:(await query(PHASE0_QUERIES.officialHistory))[0],runs:await query(POST_ACTIVATION_RUNS_QUERY)});
  const d1Before=await readD1();validateD1State(d1Before);await health();

  const deploymentAfter=validateDeployment(await request(`${workerBase}/deployments`));
  if(JSON.stringify(deploymentAfter)!==JSON.stringify(deploymentBefore))throw new Error('phase4b_preflight_deployment_changed_during_read');
  const versionsAfter=validateVersions(extractVersions(await request(`${workerBase}/versions?deployable=true`)));
  if(JSON.stringify(versionsAfter)!==JSON.stringify(versionsBefore))throw new Error('phase4b_preflight_versions_changed_during_read');
  validateDomains(await request(`/accounts/${encodeURIComponent(account)}/workers/domains`));
  validateActiveVersion(await request(`${workerBase}/versions/${EXPECTED_ACTIVE_VERSION_ID}`));
  validateCron(await request(`${workerBase}/schedules`));
  const d1After=await readD1();validateD1State(d1After);
  if(JSON.stringify(d1After)!==JSON.stringify(d1Before))throw new Error('phase4b_preflight_d1_changed_during_read');
  const databaseAfter=validateDatabase(await request(`${d1Base}?fields=uuid,name,file_size`),databaseId);
  if(databaseAfter.file_size!==databaseBefore.file_size)throw new Error('phase4b_preflight_d1_size_changed_during_read');
  await health();

  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,buildSanitizedSummary({approvedSha,deploymentId:deploymentAfter.deploymentId,counts:d1After.counts,d1Size:databaseAfter.file_size}));
}

if(import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{process.stderr.write(`Phase 4B read-only preflight stopped: ${error.message}\n`);process.exitCode=1;});
