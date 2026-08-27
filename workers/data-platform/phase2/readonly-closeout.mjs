import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {
  assessCron,assessDeployments,classifyApiResponse,extractD1DatabaseDetails,extractD1QueryResult,
  extractDeploymentsResult,extractSchedulesResult,validateReadOnlySql
} from '../phase0/readonly-preflight.mjs';
import {PHASE0_QUERIES} from '../phase0/queries.mjs';
import {PHASE1_QUERIES} from '../phase1/migrate-0002.mjs';
import {
  WORKER_NAME,extractCloudflareError,extractVersions,validateActiveVersion,validatePostPhase1State,
  validateUploadedVersion
} from './upload-version.mjs';

export const EXPECTED_PHASE2_VERSION_ID='3a2b065a-6527-4887-9bf8-b08e82e81133';
export const EXPECTED_ACTIVE_DEPLOYMENT_ID='10f7a065-3d82-4b34-9fb1-dc6c3a0be524';
export const EXPECTED_ACTIVE_VERSION_ID='5edbe951-4be4-46bc-b2cf-17b550396105';
export const PHASE1_D1_SIZE_BYTES=151552;

export function validateCloseoutDeployment(deployment){
  if(!deployment||deployment.deploymentId!==EXPECTED_ACTIVE_DEPLOYMENT_ID||deployment.versionId!==EXPECTED_ACTIVE_VERSION_ID)throw new Error('phase2_closeout_active_deployment_drift');
  return deployment;
}

export function validateCloseoutVersions(versionIds){
  if(!Array.isArray(versionIds)||versionIds[0]!==EXPECTED_PHASE2_VERSION_ID)throw new Error('phase2_closeout_latest_version_drift');
  if(!versionIds.includes(EXPECTED_ACTIVE_VERSION_ID))throw new Error('phase2_closeout_active_version_missing');
  if(EXPECTED_PHASE2_VERSION_ID===EXPECTED_ACTIVE_VERSION_ID)throw new Error('phase2_closeout_version_identity_invalid');
  return true;
}

export function validateCloseoutDatabaseSize(database){
  if(!database||Number(database.file_size)!==PHASE1_D1_SIZE_BYTES)throw new Error('phase2_closeout_d1_size_drift');
  return true;
}

async function main(){
  const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID,approvedSha=process.env.APPROVED_SHA;
  if(!token||!account||!approvedSha)throw new Error('required_phase2_closeout_credentials_or_identity_missing');
  if(!/^[0-9a-f]{40}$/.test(approvedSha))throw new Error('approved_sha_invalid');
  process.stdout.write(`::add-mask::${token}\n::add-mask::${account}\n`);

  const base='https://api.cloudflare.com/client/v4';
  let databaseId;
  const request=async(path,{method='GET',body}={})=>{
    const headers={Authorization:`Bearer ${token}`};
    let requestBody;
    if(body!==undefined){headers['Content-Type']='application/json';requestBody=JSON.stringify(body);}
    const response=await fetch(`${base}${path}`,{method,headers,body:requestBody,redirect:'error'});
    const text=await response.text();
    const sensitive=[token,account,databaseId];
    let parsed;try{parsed=JSON.parse(text);}catch{throw new Error(response.ok?'api_json_invalid':extractCloudflareError(response.status,text,sensitive));}
    const outcome=classifyApiResponse(response.status,parsed);
    if(!outcome.ok)throw new Error(extractCloudflareError(response.status,text,sensitive));
    return outcome.result;
  };

  const workerBase=`/accounts/${encodeURIComponent(account)}/workers/scripts/${WORKER_NAME}`;
  const deployment=validateCloseoutDeployment(assessDeployments(extractDeploymentsResult(await request(`${workerBase}/deployments`))));
  const versions=extractVersions(await request(`${workerBase}/versions?deployable=true`));
  validateCloseoutVersions(versions);

  const activeDetail=await request(`${workerBase}/versions/${encodeURIComponent(EXPECTED_ACTIVE_VERSION_ID)}`);
  databaseId=validateActiveVersion(activeDetail,{activeVersionId:EXPECTED_ACTIVE_VERSION_ID}).databaseId;
  process.stdout.write(`::add-mask::${databaseId}\n`);
  const uploadedDetail=await request(`${workerBase}/versions/${encodeURIComponent(EXPECTED_PHASE2_VERSION_ID)}`);
  validateUploadedVersion(uploadedDetail,{uploadedId:EXPECTED_PHASE2_VERSION_ID,databaseId});

  const schedules=extractSchedulesResult(await request(`${workerBase}/schedules`));
  assessCron(schedules);

  const d1Base=`/accounts/${encodeURIComponent(account)}/d1/database/${encodeURIComponent(databaseId)}`;
  const database=extractD1DatabaseDetails(await request(`${d1Base}?fields=uuid,name,file_size`),{uuid:databaseId});
  validateCloseoutDatabaseSize(database);
  const query=async sql=>extractD1QueryResult(await request(`${d1Base}/query`,{method:'POST',body:{sql:validateReadOnlySql(sql)}}));
  validatePostPhase1State({
    migrations:await query(PHASE0_QUERIES.migrations),
    sourceRows:await query(PHASE1_QUERIES.source),
    revisionRows:await query(PHASE1_QUERIES.revision),
    counts:(await query(PHASE0_QUERIES.counts))[0],
    official:(await query(PHASE0_QUERIES.officialHistory))[0]
  });

  const summary=[
    '## DATA-S2B Phase 2 — Read-only postflight closeout',
    '',
    '- Outcome: **PASS**',
    `- Repository SHA: \`${approvedSha}\``,
    `- Phase 2 inactive Worker version: \`${EXPECTED_PHASE2_VERSION_ID}\``,
    `- Active deployment/version unchanged from attempt #3 prestate: \`${deployment.deploymentId}\` / \`${deployment.versionId}\``,
    '- Latest deployable version is the Phase 2 artifact and is not the active deployment version',
    '- Active version bindings: exact retained D1 + HTTP secret; no DATA_S2_SEASON',
    '- Phase 2 version bindings: retained D1 + HTTP secret + DATA_S2_SEASON=2026-27',
    '- Live Cron expressions: none',
    '- D1 Phase 1 schema/governance/count state: unchanged',
    `- D1 database size: ${database.file_size} bytes (matches recorded Phase 1 baseline ${PHASE1_D1_SIZE_BYTES})`,
    '',
    'This closeout is read-only. It performs no Worker Version upload, deployment, trigger, route/domain, secret or D1 mutation.',
    'The Phase 1 file-size comparison is historical accounting evidence, not an immediate-before/after Phase 2 size measurement.'
  ];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`${summary.join('\n')}\n`);
}

if(import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{
  process.stderr.write(`Phase 2 closeout stopped: ${error.message}\n`);
  process.exitCode=1;
});
