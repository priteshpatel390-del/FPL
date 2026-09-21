import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {runApiFootballActivationLivePreflight} from './activation-live-preflight.mjs';
import {
  WORKER_NAME,buildUploadGraph,buildVersionMetadata,deterministicIdentity,
  createCloudflareRequester,findWorkerByName,extractVersionIds,validatePostflightState
} from './inactive-version-staging.mjs';

export const CLOSEOUT_CONTRACT_VERSION='api-football-inactive-version-closeout-v1';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const SHA40=/^[0-9a-f]{40}$/;
const HEX64=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256=value=>createHash('sha256').update(String(value)).digest('hex');
const accountPath=(accountId,suffix)=>'/accounts/'+encodeURIComponent(accountId)+suffix;
const scriptBase=accountId=>accountPath(accountId,'/workers/scripts/'+encodeURIComponent(WORKER_NAME));
const betaWorkersBase=accountId=>accountPath(accountId,'/workers/workers');

export function validateReadOnlyD1Closeout(report){
  if(!report||report.reason!=='repository_stage_inventory_unexpected')throw new Error('collector_closeout_expected_inventory_transition_missing');
  if(report.migrationCount!==6||report.foreignKeyViolations!==0||report.officialFplAuthority?.teamCount!==20||
    report.mapping?.state!=='COMMITTED'||report.mapping?.mappingCount!==20||report.mapping?.memberCount!==20||
    report.mapping?.distinctProviderIds!==20||report.mapping?.distinctFplIds!==20||report.mapping?.canonicalCoverageMatches!==true||
    report.mapping?.historicalAuthorityProvenancePresent!==true)throw new Error('collector_closeout_d1_foundation_drift');
  if(report.runtime?.collectionEnabled!==0||report.runtime?.credentialState!=='UNPROVISIONED'||report.runtime?.activeLease!==false)throw new Error('collector_closeout_runtime_drift');
  if(report.priorState?.requestAttempts!==0||report.priorState?.generations!==0||report.priorState?.fixtureRevisions!==0||
    report.priorState?.attempt2Count!==0||report.priorState?.reservedAttemptCount!==0||report.priorState?.stagingGenerationCount!==0)throw new Error('collector_closeout_history_drift');
  if(report.modelUiImportCount!==0||report.evidence?.productionMutations!==0||report.evidence?.apiFootballRequests!==0||
    report.evidence?.secretValuesRead!==0)throw new Error('collector_closeout_isolation_drift');
  return true;
}

export async function runInactiveVersionCloseout({env=process.env,fetchImpl=globalThis.fetch,readFile=file=>fs.readFileSync(path.join(root,file),'utf8')}={}){
  const accountId=env.DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID,fingerprint=env.DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT;
  const token=env.DATA_STEWARD_CLOUDFLARE_READ_TOKEN,approvedSha=env.APPROVED_SHA,versionId=env.CANDIDATE_VERSION_ID;
  if(typeof accountId!=='string'||!accountId||typeof fingerprint!=='string'||!HEX64.test(fingerprint)||sha256(accountId)!==fingerprint||
    typeof token!=='string'||!token||typeof approvedSha!=='string'||!SHA40.test(approvedSha)||typeof versionId!=='string'||!UUID.test(versionId))throw new Error('collector_closeout_environment_invalid');

  const d1Report=await runApiFootballActivationLivePreflight({
    env:{
      DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID:accountId,
      DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT:fingerprint,
      DATA_STEWARD_CLOUDFLARE_READ_TOKEN:token
    },fetchImpl
  });
  validateReadOnlyD1Closeout(d1Report);

  const modules=buildUploadGraph(readFile),metadata=buildVersionMetadata(approvedSha),identity=deterministicIdentity(metadata,modules,approvedSha);
  const request=createCloudflareRequester({accountId,token,fetchImpl});
  const workers=(await request(betaWorkersBase(accountId)+'?per_page=100&order_by=name&order=asc')).result;
  const listed=findWorkerByName(workers);if(!listed)throw new Error('collector_closeout_worker_missing');
  const worker=(await request(betaWorkersBase(accountId)+'/'+encodeURIComponent(listed.id))).result;
  const versions=extractVersionIds((await request(scriptBase(accountId)+'/versions?deployable=true')).result);
  const subdomain=(await request(scriptBase(accountId)+'/subdomain')).result;
  const deployments=(await request(scriptBase(accountId)+'/deployments')).result;
  const schedules=(await request(scriptBase(accountId)+'/schedules')).result;
  const domains=(await request(accountPath(accountId,'/workers/domains'))).result;
  const scripts=(await request(accountPath(accountId,'/workers/scripts'))).result;
  const versionDetail=(await request(betaWorkersBase(accountId)+'/'+encodeURIComponent(worker.id)+'/versions/'+encodeURIComponent(versionId)+'?include=modules')).result;
  validatePostflightState({worker,subdomain,deployments,schedules,domains,scripts,versionDetail,versionIds:versions,versionId,approvedSha,identity});

  return Object.freeze({
    version:CLOSEOUT_CONTRACT_VERSION,outcome:'PASS',repositorySha:approvedSha,candidateVersionId:versionId,
    migrationCount:6,foreignKeyViolations:0,mappingMembers:20,requestAttempts:0,generations:0,fixtureRevisions:0,
    deploymentCount:0,cronCount:0,routeCount:0,customDomainCount:0,workersDev:false,previewUrls:false,
    secretBindingCount:0,moduleCount:modules.size,graphSha256:identity.graphSha256,metadataSha256:identity.metadataSha256,
    d1Mutations:0,apiFootballRequests:0,secretValuesRead:0
  });
}

export function sanitizedCloseoutSummaryLines(report){
  return [
    '## API-Football inactive staging read-only closeout','',
    '- Outcome: **PASS**',
    '- Repository SHA: `'+report.repositorySha+'`',
    '- Candidate Version: `'+report.candidateVersionId+'`',
    '- D1 migrations: 0001-0006',
    '- Foreign-key violations: 0',
    '- Mapping members: 20',
    '- Request attempts / generations / fixture revisions: 0 / 0 / 0',
    '- Deployments / Cron / routes / custom domains / secrets: 0 / 0 / 0 / 0 / 0',
    '- workers.dev / Preview URLs: disabled / disabled',
    '- D1 mutations: 0',
    '- API-Football requests: 0',
    '- Secret values read: 0'
  ];
}

export async function main(){
  const report=await runInactiveVersionCloseout();
  const reportPath=process.env.API_FOOTBALL_CLOSEOUT_REPORT_PATH;
  if(typeof reportPath==='string'&&reportPath)fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  if(typeof process.env.GITHUB_STEP_SUMMARY==='string'&&process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,sanitizedCloseoutSummaryLines(report).join('\n')+'\n');
  console.log(JSON.stringify({outcome:'PASS',candidateVersionId:report.candidateVersionId,d1Mutations:0,apiFootballRequests:0,secretValuesRead:0}));
  return 0;
}

if(import.meta.url===pathToFileURL(process.argv[1]??'').href)main().catch(error=>{
  process.stderr.write('Inactive collector closeout stopped: '+error.message+'\n');
  process.exitCode=1;
});
