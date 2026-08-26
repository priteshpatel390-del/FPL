import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {PHASE0_QUERIES} from './queries.mjs';

export const REQUIRED_TABLES=Object.freeze(['canonical_entities','data_source_revisions','data_sources','ingestion_runs','observation_heads','schema_migrations','shadow_observations']);
export const EXPECTED_MIGRATIONS=Object.freeze([{version:1,name:'shadow_data_foundation'},{version:2,name:'official_fpl_structured_history'}]);
const UNSAFE=/\b(?:INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP|TRUNCATE|PRAGMA|ATTACH|DETACH|VACUUM|REINDEX)\b/i;

export function stripSqlComments(sql){
  let out='',quote=null;
  for(let i=0;i<sql.length;){
    const c=sql[i],n=sql[i+1];
    if(quote){out+=c;if(c===quote){if(sql[i+1]===quote){out+=sql[++i];}else quote=null;}i++;continue;}
    if(c==="'"||c==='"'||c==='`'){quote=c;out+=c;i++;continue;}
    if(c==='-'&&n==='-'){i+=2;while(i<sql.length&&sql[i]!=='\n')i++;out+='\n';continue;}
    if(c==='/'&&n==='*'){const end=sql.indexOf('*/',i+2);if(end<0)throw new Error('sql_comment_unterminated');i=end+2;out+=' ';continue;}
    out+=c;i++;
  }
  if(quote)throw new Error('sql_quote_unterminated');
  return out;
}

export function validateReadOnlySql(sql){
  if(typeof sql!=='string'||!sql.trim())throw new Error('sql_empty');
  const executable=stripSqlComments(sql).trim();
  if(!/^SELECT\b/i.test(executable))throw new Error('sql_must_start_select');
  const withoutStrings=executable.replace(/'(?:''|[^'])*'/g,"''").replace(/"(?:""|[^"])*"/g,'""');
  if(UNSAFE.test(withoutStrings))throw new Error('sql_unsafe_verb');
  const semicolons=[...withoutStrings.matchAll(/;/g)].map(match=>match.index);
  if(semicolons.length>1||(semicolons.length===1&&semicolonNotTrailing(withoutStrings,semicolons[0])))throw new Error('sql_multiple_statements');
  return executable.replace(/;\s*$/,'');
}
function semicolonNotTrailing(text,index){return text.slice(index+1).trim()!=='';}

export function classifyApiResponse(status,body){
  if(status===401||status===403)return {ok:false,diagnostic:`HTTP_${status}`};
  if(status<200||status>=300)return {ok:false,diagnostic:`HTTP_${Number.isInteger(status)?status:'UNKNOWN'}`};
  if(!body||body.success!==true)return {ok:false,diagnostic:'CLOUDFLARE_SUCCESS_FALSE'};
  return {ok:true,result:body.result};
}

export function extractDeploymentsResult(result){
  if(!result||!Array.isArray(result.deployments))throw new Error('deployments_contract_invalid');
  return result.deployments;
}

export function extractWorkerSettingsResult(result){
  if(!result||!Array.isArray(result.bindings))throw new Error('settings_contract_invalid');
  return result;
}

export function validateWorkerBindingSet(settings,phase='post'){
  const bindings=extractWorkerSettingsResult(settings).bindings;
  if(phase==='pre'){
    const allowed=new Map([['TEAMSHEET_DATA_DB','d1'],['DATA_S1_HTTP_AUTH_TOKEN','secret_text']]);
    const seen=new Set();
    let d1Present=false;
    for(const binding of bindings){
      if(!binding||typeof binding.name!=='string'||seen.has(binding.name))throw new Error('worker_binding_set_drift');
      seen.add(binding.name);
      if(binding.name==='DATA_S2_SEASON')throw new Error('season_var_unexpectedly_live');
      if(binding.type!==allowed.get(binding.name))throw new Error('worker_binding_set_drift');
      if(binding.name==='TEAMSHEET_DATA_DB')d1Present=true;
    }
    if(!d1Present)throw new Error('worker_binding_set_drift');
    return settings;
  }
  if(phase!=='post')throw new Error('worker_binding_phase_invalid');
  const expected=new Map([['TEAMSHEET_DATA_DB','d1'],['DATA_S2_SEASON','plain_text']]);
  if(bindings.length!==expected.size)throw new Error('worker_binding_set_drift');
  const seen=new Set();
  for(const binding of bindings){
    if(!binding||typeof binding.name!=='string'||seen.has(binding.name)||binding.type!==expected.get(binding.name))throw new Error('worker_binding_set_drift');
    seen.add(binding.name);
  }
  if(seen.size!==expected.size)throw new Error('worker_binding_set_drift');
  return settings;
}

export function extractSchedulesResult(result){
  if(!result||!Array.isArray(result.schedules))throw new Error('schedules_contract_invalid');
  return result.schedules;
}

export function extractD1DatabaseList(result){
  if(!Array.isArray(result))throw new Error('database_list_contract_invalid');
  return result;
}

export function extractD1DatabaseDetails(result,expected){
  if(!result||result.name!=='teamsheet-data'||typeof result.uuid!=='string'||!result.uuid||result.uuid!==expected?.uuid)throw new Error('database_details_contract_invalid');
  if(typeof result.file_size!=='number'||!Number.isFinite(result.file_size)||result.file_size<0)throw new Error('database_size_contract_invalid');
  return result;
}

export function extractD1QueryResult(result){
  if(!Array.isArray(result)||result.length!==1)throw new Error('d1_query_contract_invalid');
  const first=result[0];
  if(first?.success!==true||!Array.isArray(first.results))throw new Error('d1_query_contract_invalid');
  return first.results;
}

export function extractWorkersDomains(result){
  if(!Array.isArray(result))throw new Error('workers_domains_contract_invalid');
  return result;
}

export function normaliseD1Binding(settings,name='TEAMSHEET_DATA_DB'){
  const bindings=extractWorkerSettingsResult(settings).bindings.filter(row=>row?.name===name);
  if(bindings.length!==1)throw new Error('d1_binding_drift');
  const binding=bindings[0];
  if(binding.type!=='d1'||typeof binding.database_id!=='string'||!binding.database_id)throw new Error('d1_binding_contract_invalid');
  return {name:binding.name,databaseId:binding.database_id};
}

export function normalisePlainTextBinding(settings,name){
  const bindings=extractWorkerSettingsResult(settings).bindings.filter(row=>row?.name===name);
  if(bindings.length!==1)throw new Error('plain_text_binding_drift');
  const binding=bindings[0];
  if(binding.type!=='plain_text'||typeof binding.text!=='string')throw new Error('plain_text_binding_contract_invalid');
  return {name:binding.name,text:binding.text};
}

export function requireD1BindingDatabase(binding,databaseId){
  if(!binding||typeof databaseId!=='string'||!databaseId||binding.databaseId!==databaseId)throw new Error('d1_binding_database_drift');
  return binding;
}

export function assessDeployments(deployments){
  if(!Array.isArray(deployments)||deployments.length<2)throw new Error('rollback_version_missing');
  const dated=deployments.map(row=>({...row,time:Date.parse(row?.created_on)}));
  if(dated.some(row=>!Number.isFinite(row.time)))throw new Error('deployment_timestamp_invalid');
  const current=dated[0];
  if(typeof current.id!=='string'||!current.id)throw new Error('active_deployment_id_invalid');
  if(!Array.isArray(current.versions))throw new Error('active_deployment_versions_invalid');
  const active=current.versions.filter(row=>row?.percentage===100&&typeof row.version_id==='string'&&row.version_id);
  if(active.length!==1)throw new Error('active_version_ambiguous');
  const priorVersions=new Set(dated.slice(1).flatMap(row=>row.versions??[]).map(row=>row?.version_id).filter(id=>typeof id==='string'&&id&&id!==active[0].version_id));
  if(priorVersions.size<1)throw new Error('rollback_version_missing');
  return {deploymentId:current.id,versionId:active[0].version_id,timestamp:current.created_on,rollback:'PASS'};
}

export function assessCron(schedules){
  if(!Array.isArray(schedules))throw new Error('cron_contract_invalid');
  const expressions=schedules.map(row=>typeof row==='string'?row:row?.cron).filter(value=>typeof value==='string');
  if(expressions.length!==schedules.length)throw new Error('cron_contract_invalid');
  if(expressions.includes('0 * * * *'))throw new Error('unexpected_data_s2_hourly_cron');
  if(expressions.length)throw new Error('unexpected_cron_drift');
  return expressions;
}

export function assessMigrations(rows){
  if(!Array.isArray(rows))throw new Error('migration_contract_invalid');
  const applied=rows.map(row=>({version:Number(row.version),name:String(row.name)}));
  if(applied.length!==1||applied[0].version!==1||applied[0].name!==EXPECTED_MIGRATIONS[0].name)throw new Error('migration_drift');
  return EXPECTED_MIGRATIONS.map(item=>({...item,status:item.version===1?'applied':'pending'}));
}

export function optionalMetrics(value){return value==null?{status:'NOT PROVABLE'}:{status:'PASS',value};}

export function optionalDomainsFailure(error){
  if(error?.message==='HTTP_403')return {status:'NOT PROVABLE'};
  throw error;
}

async function main(){
  for(const query of Object.values(PHASE0_QUERIES))validateReadOnlySql(query);
  const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
  if(!token||!account)throw new Error('required_cloudflare_credentials_missing');
  process.stdout.write(`::add-mask::${token}\n::add-mask::${account}\n`);
  const temp=process.env.RUNNER_TEMP;
  if(!temp)throw new Error('runner_temp_missing');
  const base='https://api.cloudflare.com/client/v4';
  const request=async(path,{method='GET',body}={})=>{
    const response=await fetch(`${base}${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body&&JSON.stringify(body),redirect:'error'});
    const text=await response.text();
    fs.writeFileSync(`${temp}/phase0-${crypto.randomUUID()}.json`,text,{mode:0o600});
    let parsed;try{parsed=JSON.parse(text);}catch{throw new Error(response.ok?'api_json_invalid':`HTTP_${response.status}`);}
    const outcome=classifyApiResponse(response.status,parsed);
    if(!outcome.ok)throw new Error(outcome.diagnostic);
    return outcome.result;
  };
  const deploymentsResult=await request(`/accounts/${encodeURIComponent(account)}/workers/scripts/teamsheet-data-platform/deployments`);
  const deployments=assessDeployments(extractDeploymentsResult(deploymentsResult));
  const settings=validateWorkerBindingSet(extractWorkerSettingsResult(await request(`/accounts/${encodeURIComponent(account)}/workers/scripts/teamsheet-data-platform/settings`)),'pre');
  const d1=normaliseD1Binding(settings);
  const season=settings.bindings.some(row=>row?.name==='DATA_S2_SEASON')?normalisePlainTextBinding(settings,'DATA_S2_SEASON').text:null;
  if(season!==null)throw new Error('season_var_unexpectedly_live');
  const retainedDataS1Secret=settings.bindings.some(row=>row?.name==='DATA_S1_HTTP_AUTH_TOKEN');
  const schedulesResult=await request(`/accounts/${encodeURIComponent(account)}/workers/scripts/teamsheet-data-platform/schedules`);
  const crons=assessCron(extractSchedulesResult(schedulesResult));
  const databaseId=d1.databaseId;
  const databaseDetails=extractD1DatabaseDetails(await request(`/accounts/${encodeURIComponent(account)}/d1/database/${encodeURIComponent(databaseId)}?fields=uuid,name,file_size`),{uuid:databaseId});
  const query=async sql=>{
    const result=await request(`/accounts/${encodeURIComponent(account)}/d1/database/${encodeURIComponent(databaseId)}/query`,{method:'POST',body:{sql:validateReadOnlySql(sql)}});
    return extractD1QueryResult(result);
  };
  const schema=(await query(PHASE0_QUERIES.schema)).map(row=>row.name).sort();
  if(JSON.stringify(schema)!==JSON.stringify(REQUIRED_TABLES))throw new Error('data_s1_schema_drift');
  const migrations=assessMigrations(await query(PHASE0_QUERIES.migrations));
  const governance=(await query(PHASE0_QUERIES.governance))[0];
  const counts=(await query(PHASE0_QUERIES.counts))[0];
  const official=(await query(PHASE0_QUERIES.officialHistory))[0];
  if(governance.source_official_fpl!==0||governance.official_fpl_r1!==0||Object.values(official).some(Number))throw new Error('unexpected_official_fpl_history');
  let domains={status:'NOT PROVABLE'};
  try{const rows=extractWorkersDomains(await request(`/accounts/${encodeURIComponent(account)}/workers/domains`));domains={status:'PASS',hostnames:rows.filter(row=>row?.service==='teamsheet-data-platform').map(row=>row.hostname).filter(Boolean)};}catch(error){domains=optionalDomainsFailure(error);}
  const report={repositorySha:process.env.APPROVED_SHA,verifyTeamsheet:'PASS',worker:'teamsheet-data-platform',deployments,bindings:[{name:'TEAMSHEET_DATA_DB',type:'d1',database:'teamsheet-data'}],dataS2Season:'ABSENT',retainedDataS1Secret:retainedDataS1Secret?'PRESENT':'ABSENT',crons,domains,migrations,counts,officialHistory:official,database:{name:'teamsheet-data',sizeBytes:databaseDetails.file_size},metrics:optionalMetrics(null),outcome:'PASS'};
  const summary=['## DATA-S2B Phase 0 Read-Only Preflight','',`- Outcome: **${report.outcome}**`,`- Repository SHA: \`${report.repositorySha}\``,`- Verify Teamsheet: ${report.verifyTeamsheet}`,`- Worker: \`${report.worker}\``,`- Active deployment/version: \`${deployments.deploymentId}\` / \`${deployments.versionId}\``,`- Deployment timestamp: ${deployments.timestamp}`,`- Rollback evidence: ${deployments.rollback}`,'- D1 binding: `TEAMSHEET_DATA_DB` -> `teamsheet-data`',`- DATA_S2_SEASON: ${report.dataS2Season} (expected pre-mutation)`,`- Retained DATA_S1_HTTP_AUTH_TOKEN binding: ${report.retainedDataS1Secret}`,`- Cron expressions: ${crons.length?crons.map(value=>`\`${value}\``).join(', '):'none'}`,`- Custom domains: ${domains.status==='PASS'?(domains.hostnames.join(', ')||'none'):'NOT PROVABLE'}`,`- Migrations: ${migrations.map(row=>`${String(row.version).padStart(4,'0')} ${row.status}`).join(', ')}`,`- Table counts: ${Object.entries(counts).map(([key,value])=>`${key}=${value}`).join(', ')}`,`- official-fpl-r1 counts: ${Object.entries(official).map(([key,value])=>`${key}=${value}`).join(', ')}`,`- Database size: ${report.database.sizeBytes}`,`- Optional analytics metrics: ${report.metrics.status}`,'','Raw responses remain only in RUNNER_TEMP and are not uploaded.'];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`${summary.join('\n')}\n`);
}

if(import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{process.stderr.write(`Phase 0 stopped: ${error.message}\n`);process.exitCode=1;});
