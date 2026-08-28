import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {
  assessDeployments,classifyApiResponse,extractD1DatabaseDetails,extractD1QueryResult,
  extractDeploymentsResult,extractSchedulesResult,extractWorkersDomains,validateReadOnlySql
} from '../phase0/readonly-preflight.mjs';
import {PHASE0_QUERIES} from '../phase0/queries.mjs';
import {PHASE1_QUERIES} from '../phase1/migrate-0002.mjs';
import {
  WORKER_NAME,extractCloudflareError,extractVersions,validateActiveVersion,
  validatePostPhase1State,validateUploadedVersion
} from './upload-version.mjs';

export const CANDIDATE_VERSION_ID='733093ef-e01f-43a8-828a-0c8c67e7626f';
export const ROLLBACK_VERSION_ID='3a2b065a-6527-4887-9bf8-b08e82e81133';
export const EXPECTED_CRON='*/30 * * * *';
export const EXPECTED_PRODUCTION_HOSTNAME='data.fpltsheet.co.uk';
export const EXPECTED_COMPATIBILITY_DATE='2026-08-22';
export const EXPECTED_SEASON='2026-27';
export const EXPECTED_D1_SIZE_BYTES=151552;
export const REQUEST_TIMEOUT_MS=15000;
export const EXPECTED_BINDINGS=Object.freeze(new Map([
  ['TEAMSHEET_DATA_DB','d1'],['DATA_S1_HTTP_AUTH_TOKEN','secret_text'],['DATA_S2_SEASON','plain_text']
]));

export function assertCronMutation(method,path,workerBase){
  if(method!=='PUT'||path!==`${workerBase}/schedules`)throw new Error('phase4b_cron_mutation_endpoint_forbidden');
  return true;
}
export function activationBody(){return [{cron:EXPECTED_CRON}];}
export function validateSchedules(result,expected){
  const rows=extractSchedulesResult(result);
  if(!Array.isArray(rows)||rows.some(row=>!row||typeof row.cron!=='string'))throw new Error('phase4b_cron_contract_invalid');
  const crons=rows.map(row=>row.cron).sort();
  if(JSON.stringify(crons)!==JSON.stringify([...expected].sort()))throw new Error('phase4b_cron_state_drift');
  return crons;
}
export function classifyScheduleReconciliation(result){
  try{
    const rows=extractSchedulesResult(result);
    if(rows.length===0)return 'ABSENT';
    if(rows.length===1&&rows[0]?.cron===EXPECTED_CRON)return 'TARGET_PRESENT';
    return 'UNEXPECTED';
  }catch{return 'UNPROVABLE';}
}
export async function fetchTextBounded({fetchFn=fetch,url,options={},mutation=false,timeoutMs=REQUEST_TIMEOUT_MS,timeoutSignal=AbortSignal.timeout}){
  if(typeof fetchFn!=='function'||typeof url!=='string'||!url||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||typeof timeoutSignal!=='function')throw new Error('phase4b_cron_bounded_fetch_input_invalid');
  try{
    const response=await fetchFn(url,{...options,signal:timeoutSignal(timeoutMs)});
    return {response,text:await response.text()};
  }catch{
    if(mutation)throw new Error('phase4b_cron_mutation_ambiguous');
    throw new Error('phase4b_cron_api_transport_failed');
  }
}
export async function executeScheduleActivation({mutate,readSchedules,postflight}){
  if(typeof mutate!=='function'||typeof readSchedules!=='function'||typeof postflight!=='function')throw new Error('phase4b_cron_activation_input_invalid');
  try{await mutate();}
  catch(error){
    if(error.message!=='phase4b_cron_mutation_ambiguous')throw error;
    const state=classifyScheduleReconciliation(await readSchedules().catch(()=>null));
    if(state!=='TARGET_PRESENT')throw new Error(`phase4b_cron_ambiguous_${state.toLowerCase()}_stop_no_retry`);
  }
  await postflight();
}
export function validateVersionHistory(before,after){
  if(before?.[0]!==CANDIDATE_VERSION_ID||!before.includes(ROLLBACK_VERSION_ID))throw new Error('phase4b_cron_version_history_drift');
  if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('phase4b_cron_worker_version_created');
  return true;
}
export function validateDeployment(deployment,before){
  if(!deployment?.deploymentId||deployment.versionId!==CANDIDATE_VERSION_ID)throw new Error('phase4b_cron_active_deployment_drift');
  if(before&&(deployment.deploymentId!==before.deploymentId||deployment.versionId!==before.versionId))throw new Error('phase4b_cron_deployment_changed');
  return deployment;
}
export function validateDomains(result){
  const names=extractWorkersDomains(result).filter(row=>row?.service===WORKER_NAME).map(row=>row.hostname).sort();
  if(JSON.stringify(names)!==JSON.stringify([EXPECTED_PRODUCTION_HOSTNAME]))throw new Error('phase4b_cron_custom_domain_drift');
  return names;
}

async function main(){
  const token=process.env.CLOUDFLARE_PHASE4B_CRON_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
  const healthToken=process.env.DATA_S1_HTTP_AUTH_TOKEN,accessId=process.env.CF_ACCESS_CLIENT_ID,accessSecret=process.env.CF_ACCESS_CLIENT_SECRET;
  const approvedSha=process.env.APPROVED_SHA,sensitive=[token,account,healthToken,accessId,accessSecret];
  if(sensitive.some(value=>!value)||!/^[0-9a-f]{40}$/.test(approvedSha||''))throw new Error('phase4b_cron_required_credentials_or_identity_missing');
  for(const value of sensitive)process.stdout.write(`::add-mask::${value}\n`);
  const base='https://api.cloudflare.com/client/v4',workerBase=`/accounts/${encodeURIComponent(account)}/workers/scripts/${WORKER_NAME}`;
  let databaseId,mutationCount=0,outcome='STOP',detail='preflight stopped before mutation';
  const summary=()=>fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,[
    '## DATA-S2B Phase 4B — Cron activation','',`- Outcome: **${outcome}**`,`- Repository SHA: \`${approvedSha}\``,
    `- Schedule target: \`${EXPECTED_CRON}\``,`- Schedule mutations submitted: ${mutationCount}`,
    '- Version/Deployment/D1/Access/secret/route/domain mutation: none','- Collector invocation: none',`- Detail: ${detail}`,'',
    'No raw Cloudflare response, database identity, or secret value is persisted.'
  ].join('\n')+'\n');
  const request=async(path,{method='GET',body,mutation=false}={})=>{
    const headers={Authorization:`Bearer ${token}`};if(body!==undefined)headers['Content-Type']='application/json';
    const {response,text}=await fetchTextBounded({url:`${base}${path}`,options:{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error'},mutation});
    let parsed;try{parsed=JSON.parse(text);}catch{if(mutation)throw new Error('phase4b_cron_mutation_ambiguous');throw new Error('phase4b_cron_api_json_invalid');}
    const classified=classifyApiResponse(response.status,parsed);
    if(!classified.ok){if(mutation&&response.status>=500)throw new Error('phase4b_cron_mutation_ambiguous');throw new Error(extractCloudflareError(response.status,text,[...sensitive,databaseId]));}
    return classified.result;
  };
  const readDeployment=async()=>validateDeployment(assessDeployments(extractDeploymentsResult(await request(`${workerBase}/deployments`))));
  const readVersions=async()=>extractVersions(await request(`${workerBase}/versions?deployable=true`));
  const readSchedulesResult=async()=>request(`${workerBase}/schedules`);
  const readDomains=async()=>validateDomains(await request(`/accounts/${encodeURIComponent(account)}/workers/domains`));
  const readD1=async()=>{
    const d1Base=`/accounts/${encodeURIComponent(account)}/d1/database/${encodeURIComponent(databaseId)}`;
    const database=extractD1DatabaseDetails(await request(`${d1Base}?fields=uuid,name,file_size`),{uuid:databaseId});
    if(Number(database.file_size)!==EXPECTED_D1_SIZE_BYTES)throw new Error('phase4b_cron_d1_size_drift');
    const query=async sql=>extractD1QueryResult(await request(`${d1Base}/query`,{method:'POST',body:{sql:validateReadOnlySql(sql)}}));
    const state={migrations:await query(PHASE0_QUERIES.migrations),sourceRows:await query(PHASE1_QUERIES.source),revisionRows:await query(PHASE1_QUERIES.revision),counts:(await query(PHASE0_QUERIES.counts))[0],official:(await query(PHASE0_QUERIES.officialHistory))[0]};
    validatePostPhase1State(state);return {database,state};
  };
  const health=async()=>{
    let response,text,body;
    try{
      ({response,text}=await fetchTextBounded({url:`https://${EXPECTED_PRODUCTION_HOSTNAME}/v1/health`,options:{headers:{Authorization:`Bearer ${healthToken}`,'CF-Access-Client-Id':accessId,'CF-Access-Client-Secret':accessSecret},redirect:'error'}}));
      body=JSON.parse(text);
    }catch{throw new Error('phase4b_cron_health_transport_failed');}
    if(response.status!==200||body?.ok!==true||body?.mode!=='shadow_only')throw new Error('phase4b_cron_health_failed');return {ok:true,mode:'shadow_only'};
  };
  const snapshot=async(expectedSchedules,before)=>{
    const deployment=validateDeployment(await readDeployment(),before?.deployment);
    const versions=await readVersions();validateVersionHistory(before?.versions??versions,versions);
    const active=await request(`${workerBase}/versions/${CANDIDATE_VERSION_ID}`);
    if(!databaseId)databaseId=validateActiveVersion(active,{activeVersionId:CANDIDATE_VERSION_ID}).databaseId;
    validateUploadedVersion(active,{uploadedId:CANDIDATE_VERSION_ID,databaseId});
    if(!versions.includes(ROLLBACK_VERSION_ID))throw new Error('phase4b_cron_rollback_version_missing');
    const domains=await readDomains();if(before&&JSON.stringify(domains)!==JSON.stringify(before.domains))throw new Error('phase4b_cron_domain_changed');
    validateSchedules(await readSchedulesResult(),expectedSchedules);
    const d1=await readD1();if(before&&JSON.stringify(d1)!==JSON.stringify(before.d1))throw new Error('phase4b_cron_d1_changed');
    const healthState=await health();return {deployment,versions,domains,d1,health:healthState};
  };
  let before;
  try{before=await snapshot([]);process.stdout.write(`::add-mask::${databaseId}\n`);before=await snapshot([],before);}
  catch(error){detail=error.message;summary();throw error;}
  try{
    const endpoint=`${workerBase}/schedules`;assertCronMutation('PUT',endpoint,workerBase);mutationCount++;
    await executeScheduleActivation({
      mutate:()=>request(endpoint,{method:'PUT',body:activationBody(),mutation:true}),
      readSchedules:readSchedulesResult,
      postflight:async()=>{await snapshot([EXPECTED_CRON],before);await snapshot([EXPECTED_CRON],before);}
    });
    outcome='PASS';detail='exact target schedule confirmed and immutable postflight passed';summary();
  }catch(error){detail=error.message;summary();throw error;}
}

if(import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{process.stderr.write(`Phase 4B Cron activation stopped: ${error.message}\n`);process.exitCode=1;});
