import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {
  assessCron,assessDeployments,classifyApiResponse,extractD1DatabaseDetails,extractD1QueryResult,
  extractDeploymentsResult,extractSchedulesResult,extractWorkersDomains,validateReadOnlySql
} from '../phase0/readonly-preflight.mjs';
import {PHASE0_QUERIES} from '../phase0/queries.mjs';
import {PHASE1_QUERIES} from '../phase1/migrate-0002.mjs';
import {WORKER_NAME,extractCloudflareError,extractVersions,validateActiveVersion,validatePostPhase1State,validateUploadedVersion} from '../phase2/upload-version.mjs';
import {EXPECTED_ACTIVE_DEPLOYMENT_ID,EXPECTED_ACTIVE_VERSION_ID,EXPECTED_PHASE2_VERSION_ID,PHASE1_D1_SIZE_BYTES} from '../phase2/readonly-closeout.mjs';

export const CANDIDATE_VERSION_ID=EXPECTED_PHASE2_VERSION_ID;
export const ROLLBACK_VERSION_ID=EXPECTED_ACTIVE_VERSION_ID;
export const EXPECTED_PRODUCTION_HOSTNAME='data.fpltsheet.co.uk';

export function deploymentBody(versionId){
  if(![CANDIDATE_VERSION_ID,ROLLBACK_VERSION_ID].includes(versionId))throw new Error('phase3_deployment_target_forbidden');
  return {strategy:'percentage',versions:[{version_id:versionId,percentage:100}]};
}

export function validatePreflightDeployment(deployment){
  if(!deployment||deployment.deploymentId!==EXPECTED_ACTIVE_DEPLOYMENT_ID||deployment.versionId!==ROLLBACK_VERSION_ID)throw new Error('phase3_active_deployment_drift');
  return deployment;
}

export function validateSoleActive(deployment,versionId){
  if(!deployment||deployment.versionId!==versionId||!deployment.deploymentId)throw new Error('phase3_active_version_unexpected');
  return deployment;
}

export function validateVersionHistory(before,after){
  const expected=[CANDIDATE_VERSION_ID,ROLLBACK_VERSION_ID];
  for(const [position,id] of expected.entries())if(before?.[position]!==id)throw new Error('phase3_version_history_drift');
  if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('phase3_unexpected_worker_version_created');
  return true;
}

export function validateDomains(rows){
  const hostnames=extractWorkersDomains(rows).filter(row=>row?.service===WORKER_NAME).map(row=>row.hostname).sort();
  if(JSON.stringify(hostnames)!==JSON.stringify([EXPECTED_PRODUCTION_HOSTNAME]))throw new Error('phase3_custom_domain_drift');
  return hostnames;
}

export function classifyMutationReconciliation(activeVersionId,targetVersionId,previousVersionId){
  if(activeVersionId===targetVersionId)return 'TARGET_ACTIVE';
  if(activeVersionId===previousVersionId)return 'PREVIOUS_ACTIVE';
  return 'UNRESOLVED';
}

export function classifyCandidateFailure(activeVersionId,{ambiguous=false}={}){
  if(activeVersionId===CANDIDATE_VERSION_ID)return 'ROLLBACK_REQUIRED';
  if(activeVersionId===ROLLBACK_VERSION_ID&&!ambiguous)return 'PHASE_3_FAIL';
  return 'UNRESOLVED';
}

export async function deployAfterOldHealth({invariantRead,health,deploy}){
  if(typeof invariantRead!=='function'||typeof health!=='function'||typeof deploy!=='function')throw new Error('phase3_preflight_health_gate_invalid');
  await invariantRead(ROLLBACK_VERSION_ID);
  await health();
  await invariantRead(ROLLBACK_VERSION_ID);
  return deploy(CANDIDATE_VERSION_ID);
}

async function main(){
  const token=process.env.CLOUDFLARE_PHASE3_DEPLOY_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
  const healthToken=process.env.DATA_S1_HTTP_AUTH_TOKEN,accessId=process.env.CF_ACCESS_CLIENT_ID,accessSecret=process.env.CF_ACCESS_CLIENT_SECRET;
  const approvedSha=process.env.APPROVED_SHA;
  const sensitive=[token,account,healthToken,accessId,accessSecret];
  if(sensitive.some(value=>!value)||!/^[0-9a-f]{40}$/.test(approvedSha||''))throw new Error('phase3_required_credentials_or_identity_missing');
  for(const value of sensitive)process.stdout.write(`::add-mask::${value}\n`);

  const base='https://api.cloudflare.com/client/v4';
  let databaseId,mutationCount=0,outcome='PHASE 3 FAIL',detail='preflight stopped before mutation';
  const summary=()=>fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,[
    '## DATA-S2B Phase 3 — Deployment gate','',`- Outcome: **${outcome}**`,`- Repository SHA: \`${approvedSha}\``,
    `- Candidate: \`${CANDIDATE_VERSION_ID}\` at 100% only`,`- Rollback target: \`${ROLLBACK_VERSION_ID}\` at 100% only`,
    `- Deployment mutations submitted: ${mutationCount}`,'- Cron/route/domain/Access/secret/D1 mutation: none',`- Detail: ${detail}`,'',
    'No raw Cloudflare response or secret value is persisted.'
  ].join('\n')+'\n');
  const request=async(path,{method='GET',body,ambiguous=false}={})=>{
    const headers={Authorization:`Bearer ${token}`};
    if(body!==undefined)headers['Content-Type']='application/json';
    let response,text;
    try{response=await fetch(`${base}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error'});text=await response.text();}
    catch(error){if(ambiguous)throw new Error('phase3_mutation_response_ambiguous');throw new Error('phase3_api_transport_failed');}
    let parsed;try{parsed=JSON.parse(text);}catch{if(ambiguous)throw new Error('phase3_mutation_response_ambiguous');throw new Error(response.ok?'phase3_api_json_invalid':extractCloudflareError(response.status,text,[...sensitive,databaseId]));}
    const classified=classifyApiResponse(response.status,parsed);
    if(!classified.ok){if(ambiguous&&response.status>=500)throw new Error('phase3_mutation_response_ambiguous');throw new Error(extractCloudflareError(response.status,text,[...sensitive,databaseId]));}
    return classified.result;
  };
  const workerBase=`/accounts/${encodeURIComponent(account)}/workers/scripts/${WORKER_NAME}`;
  const readDeployment=async()=>assessDeployments(extractDeploymentsResult(await request(`${workerBase}/deployments`)));
  const readVersions=async()=>extractVersions(await request(`${workerBase}/versions?deployable=true`));
  const readDomains=async()=>validateDomains(await request(`/accounts/${encodeURIComponent(account)}/workers/domains`));
  const readCron=async()=>assessCron(extractSchedulesResult(await request(`${workerBase}/schedules`)));
  const deploy=async(versionId)=>{mutationCount++;return request(`${workerBase}/deployments`,{method:'POST',body:deploymentBody(versionId),ambiguous:true});};
  const reconcileMutation=async(target,previous)=>classifyMutationReconciliation((await readDeployment()).versionId,target,previous);

  let versionsBefore,domainsBefore;
  const readD1State=async()=>{
    const d1Base=`/accounts/${encodeURIComponent(account)}/d1/database/${encodeURIComponent(databaseId)}`;
    const database=extractD1DatabaseDetails(await request(`${d1Base}?fields=uuid,name,file_size`),{uuid:databaseId});
    if(Number(database.file_size)!==PHASE1_D1_SIZE_BYTES)throw new Error('phase3_d1_size_drift');
    const query=async sql=>extractD1QueryResult(await request(`${d1Base}/query`,{method:'POST',body:{sql:validateReadOnlySql(sql)}}));
    validatePostPhase1State({migrations:await query(PHASE0_QUERIES.migrations),sourceRows:await query(PHASE1_QUERIES.source),revisionRows:await query(PHASE1_QUERIES.revision),counts:(await query(PHASE0_QUERIES.counts))[0],official:(await query(PHASE0_QUERIES.officialHistory))[0]});
  };
  const invariantRead=async expectedVersion=>{
    validateSoleActive(await readDeployment(),expectedVersion);
    const versions=await readVersions();validateVersionHistory(versionsBefore,versions);
    const detailResult=await request(`${workerBase}/versions/${encodeURIComponent(expectedVersion)}`);
    if(expectedVersion===CANDIDATE_VERSION_ID)validateUploadedVersion(detailResult,{uploadedId:expectedVersion,databaseId});
    else validateActiveVersion(detailResult,{activeVersionId:expectedVersion,databaseId});
    await readCron();
    if(JSON.stringify(await readDomains())!==JSON.stringify(domainsBefore))throw new Error('phase3_domain_changed');
    await readD1State();
  };
  const health=async()=>{
    const response=await fetch(`https://${EXPECTED_PRODUCTION_HOSTNAME}/v1/health`,{headers:{Authorization:`Bearer ${healthToken}`,'CF-Access-Client-Id':accessId,'CF-Access-Client-Secret':accessSecret},redirect:'error'});
    let body;try{body=await response.json();}catch{throw new Error('phase3_health_response_invalid');}
    if(response.status!==200||body?.ok!==true||body?.mode!=='shadow_only')throw new Error('phase3_health_failed');
  };

  try{
    validatePreflightDeployment(await readDeployment());
    versionsBefore=await readVersions();validateVersionHistory(versionsBefore,versionsBefore);
    const active=await request(`${workerBase}/versions/${encodeURIComponent(ROLLBACK_VERSION_ID)}`);
    databaseId=validateActiveVersion(active,{activeVersionId:ROLLBACK_VERSION_ID}).databaseId;process.stdout.write(`::add-mask::${databaseId}\n`);
    validateUploadedVersion(await request(`${workerBase}/versions/${encodeURIComponent(CANDIDATE_VERSION_ID)}`),{uploadedId:CANDIDATE_VERSION_ID,databaseId});
    await readCron();domainsBefore=await readDomains();await readD1State();
  }catch(error){detail=error.message;summary();throw error;}

  let candidateMutationAmbiguous=false;
  try{
    try{await deployAfterOldHealth({invariantRead,health,deploy});}catch(error){
      if(error.message!=='phase3_mutation_response_ambiguous')throw error;
      candidateMutationAmbiguous=true;
      const reconciliation=await reconcileMutation(CANDIDATE_VERSION_ID,ROLLBACK_VERSION_ID);
      if(reconciliation!=='TARGET_ACTIVE')throw new Error(`phase3_ambiguous_deploy_${reconciliation.toLowerCase()}`);
    }
    await invariantRead(CANDIDATE_VERSION_ID);await health();await invariantRead(CANDIDATE_VERSION_ID);
    outcome='PHASE 3 PASS';detail='candidate is sole active version; postflight passed';summary();
  }catch(deployError){
    if(mutationCount===0){detail=deployError.message;summary();throw deployError;}
    let active;
    try{active=(await readDeployment()).versionId;}catch{outcome='UNRESOLVED/STOP';detail='postflight failed and active deployment could not be reconciled';summary();throw deployError;}
    const failureState=classifyCandidateFailure(active,{ambiguous:candidateMutationAmbiguous});
    if(failureState==='PHASE_3_FAIL'){detail=`candidate Deployment was definitely rejected and approved old version remains active: ${deployError.message}`;summary();throw deployError;}
    if(failureState!=='ROLLBACK_REQUIRED'){outcome='UNRESOLVED/STOP';detail=`postflight failed with ambiguous or unexpected active state: ${deployError.message}`;summary();throw deployError;}
    try{
      try{await deploy(ROLLBACK_VERSION_ID);}catch(error){
        if(error.message!=='phase3_mutation_response_ambiguous')throw error;
        const reconciliation=await reconcileMutation(ROLLBACK_VERSION_ID,CANDIDATE_VERSION_ID);
        if(reconciliation!=='TARGET_ACTIVE')throw new Error(`phase3_ambiguous_rollback_${reconciliation.toLowerCase()}`);
      }
      await invariantRead(ROLLBACK_VERSION_ID);await health();await invariantRead(ROLLBACK_VERSION_ID);
      outcome='ROLLBACK PASS';detail=`candidate postflight failed (${deployError.message}); one-shot rollback restored the approved old version`;summary();
      throw new Error('phase3_candidate_failed_rollback_passed');
    }catch(rollbackError){
      if(rollbackError.message==='phase3_candidate_failed_rollback_passed')throw rollbackError;
      outcome='UNRESOLVED/STOP';detail=`candidate postflight failed (${deployError.message}); rollback unresolved (${rollbackError.message})`;summary();throw rollbackError;
    }
  }
}

if(import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{process.stderr.write(`Phase 3 stopped: ${error.message}\n`);process.exitCode=1;});
