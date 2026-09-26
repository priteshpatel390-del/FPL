import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {EXPECTED_D1_DATABASE_ID} from '../data-platform/phase4b/live-contract.mjs';
import {ATTENDED_ACCEPTANCE_PATH} from './collector.mjs';
import {ATTENDED_CONTROL_MAX_D1_CALLS,ATTENDED_CONTROL_MAX_D1_STATEMENTS,ATTENDED_CONTROL_MAX_ROWS_CHANGED,runAttendedAcceptance} from './attended-acceptance.mjs';
import {ATTENDED_VERSION_APPROVED_SHA,deriveVersionPreviewUrl} from './attended-version.mjs';
import {runApiFootballActivationLivePreflight} from './activation-live-preflight.mjs';

const API='https://api.cloudflare.com/client/v4';
const WORKER='teamsheet-api-football-shadow-collector';
const HEX40=/^[0-9a-f]{40}$/;
const HEX64=/^[0-9a-f]{64}$/;
const fail=code=>{throw new Error(code);};
const required=(env,name)=>typeof env[name]==='string'&&env[name]?env[name]:fail('attended_environment_incomplete');
const digest=value=>createHash('sha256').update(String(value)).digest('hex');
const enc=value=>encodeURIComponent(String(value));

export function attendedCloudflarePaths(accountId){
  const base=`/accounts/${enc(accountId)}`;
  return Object.freeze({subdomain:`${base}/workers/scripts/${WORKER}/subdomain`,d1:`${base}/d1/database/${enc(EXPECTED_D1_DATABASE_ID)}/query`});
}
export function assertAttendedCloudflareRequestAllowed(method,requestPath,{accountId}={}){
  const paths=attendedCloudflarePaths(accountId),verb=String(method).toUpperCase();
  if(verb==='POST'&&(requestPath===paths.subdomain||requestPath===paths.d1))return true;
  fail('attended_cloudflare_endpoint_forbidden');
}

export function validateAdmissionHandoff(report,{approvedSha,versionId,versionApprovedSha,accountFingerprint}={}){
  if(!HEX40.test(String(approvedSha||''))||versionApprovedSha!==ATTENDED_VERSION_APPROVED_SHA||!HEX64.test(String(accountFingerprint||'')))fail('attended_handoff_identity_invalid');
  if(report?.ok!==true||report.approvedSha!==approvedSha||report.versionApprovedSha!==versionApprovedSha||!Number.isFinite(Date.parse(report.observedAt))||report.observedAt!==report.evidence?.observedAt||
    report.stage!=='ATTENDED_ACCEPTANCE'||report.classification!=='READY_FOR_SEPARATELY_APPROVED_ATTENDED_ACCEPTANCE'||
    report.inventory?.reviewedVersionId!==versionId||report.inventory?.versionIdentityExact!==true||
    report.inventory?.versionInventoryExact!==true||report.accountFingerprint!==accountFingerprint||
    report.evidence?.productionMutations!==0||report.evidence?.apiFootballRequests!==0||report.evidence?.secretValuesRead!==0)return fail('attended_handoff_evidence_invalid');
  return true;
}

const CRITICAL_PREFLIGHT_DIAGNOSTICS=Object.freeze({
  activation_preflight_environment_incomplete:'preflight_environment_incomplete',
  activation_production_account_identity_mismatch:'production_account_identity_mismatch',
  activation_production_d1_identity_mismatch:'production_d1_identity_mismatch',
  activation_data_platform_binding_mismatch:'data_platform_binding_mismatch',
  activation_attended_version_identity_invalid:'attended_version_identity_invalid',
  activation_attended_approved_sha_invalid:'approved_sha_invalid',
  activation_attended_version_approved_sha_invalid:'version_provenance_invalid',
  activation_attended_worker_identity_unavailable:'worker_identity_unavailable',
  activation_attended_inventory_unreadable:'inventory_unreadable',
  activation_collector_inventory_unreadable:'collector_inventory_unreadable',
  activation_repository_config_unreadable:'repository_config_unreadable',
  activation_d1_read_failed:'d1_read_failed',
  activation_d1_metadata_invalid:'d1_metadata_invalid',
  activation_d1_write_detected:'d1_write_detected',
  activation_migration_ledger_invalid:'migration_ledger_invalid',
  activation_official_authority_invalid:'official_authority_invalid',
  activation_state_incomplete:'state_incomplete',
  activation_now_invalid:'time_invalid',
  activation_cloudflare_get_count_unexpected:'cloudflare_get_count_unexpected'
});

export function attendedCriticalRecheckDiagnostic(report,{approvedSha,versionId,versionApprovedSha,accountFingerprint}={}){
  if(report?.ok!==true)return CRITICAL_PREFLIGHT_DIAGNOSTICS[report?.reason]??'preflight_failed_unknown';
  const inventory=report?.inventory||{},runtime=report?.runtime||{},prior=report?.priorState||{},mapping=report?.mapping||{};
  if(report.approvedSha!==approvedSha||report.versionApprovedSha!==versionApprovedSha||report.accountFingerprint!==accountFingerprint||
    report.stage!=='ATTENDED_ACCEPTANCE'||report.classification!=='READY_FOR_SEPARATELY_APPROVED_ATTENDED_ACCEPTANCE')return 'preflight_identity_or_classification_mismatch';
  if(report.migrationCount!==6||report.foreignKeyViolations!==0||report.officialFplAuthority?.valid!==true||report.officialFplAuthority?.teamCount!==20||
    mapping.state!=='COMMITTED'||mapping.mappingCount!==20||mapping.memberCount!==20||mapping.distinctProviderIds!==20||mapping.distinctFplIds!==20||
    mapping.canonicalCoverageMatches!==true||mapping.historicalAuthorityProvenancePresent!==true)return 'foundational_state_mismatch';
  if(inventory.reviewedVersionId!==versionId||inventory.versionIdentityExact!==true||inventory.versionInventoryExact!==true)return 'version_inventory_mismatch';
  if(inventory.productionBindingProven!==true||inventory.configurationExact!==true)return 'collector_configuration_mismatch';
  if(inventory.previewUrlIdentityExact!==true||typeof inventory.previewUrlSuffix!=='string'||typeof inventory.reviewedWorkerId!=='string'||typeof inventory.accountSubdomain!=='string')return 'preview_identity_mismatch';
  if(inventory.workerPresent!==true||inventory.workersDev!==false||inventory.previewUrls!==false||inventory.deploymentCount!==0||
    inventory.cronCount!==0||inventory.routeCount!==0||inventory.customDomainCount!==0)return 'collector_topology_mismatch';
  if(inventory.secretBindingPresent!==true||JSON.stringify(inventory.secretBindingNames)!==JSON.stringify(['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET']))return 'secret_binding_mismatch';
  if(runtime.collectionEnabled!==0||runtime.credentialState!=='AVAILABLE'||runtime.activeLease!==false||
    prior.requestAttempts!==0||prior.generations!==0||prior.fixtureRevisions!==0||prior.attempt2Count!==0||prior.reservedAttemptCount!==0||prior.stagingGenerationCount!==0)return 'runtime_history_mismatch';
  if(report.modelUiImportCount!==0||report.rawPayloadStoragePresent!==false)return 'model_isolation_mismatch';
  if(report.evidence?.productionMutations!==0||report.evidence?.apiFootballRequests!==0||report.evidence?.secretValuesRead!==0)return 'preflight_evidence_mismatch';
  return null;
}

export function validateCriticalRecheck(report,{approvedSha,versionId,versionApprovedSha,accountFingerprint}={}){
  if(!HEX40.test(String(approvedSha||''))||versionApprovedSha!==ATTENDED_VERSION_APPROVED_SHA||!HEX64.test(String(accountFingerprint||'')))fail('attended_critical_identity_invalid');
  const diagnostic=attendedCriticalRecheckDiagnostic(report,{approvedSha,versionId,versionApprovedSha,accountFingerprint});
  if(diagnostic)fail('attended_critical_state_drift__'+diagnostic);
  const inventory=report.inventory;
  return Object.freeze({previewUrlSuffix:inventory.previewUrlSuffix,reviewedWorkerId:inventory.reviewedWorkerId,accountSubdomain:inventory.accountSubdomain});
}

export async function executeLiveAttendedAcceptance({env=process.env,fetchImpl=globalThis.fetch,criticalRecheck=runApiFootballActivationLivePreflight}={}){
  const account=required(env,'CLOUDFLARE_ACCOUNT_ID'),fingerprint=required(env,'CLOUDFLARE_ACCOUNT_FINGERPRINT');
  const readToken=required(env,'CLOUDFLARE_ATTENDED_READ_TOKEN'),mutationToken=required(env,'CLOUDFLARE_ATTENDED_MUTATION_TOKEN'),approvedSha=required(env,'APPROVED_SHA');
  const versionId=required(env,'API_FOOTBALL_ATTENDED_VERSION_ID'),versionApprovedSha=required(env,'API_FOOTBALL_ATTENDED_VERSION_APPROVED_SHA'),trigger=required(env,'API_FOOTBALL_ATTENDED_TRIGGER_SECRET');
  if(readToken===mutationToken)fail('attended_credential_separation_required');
  if(!HEX64.test(fingerprint)||digest(account)!==fingerprint)fail('attended_production_account_identity_mismatch');
  const admission=JSON.parse(fs.readFileSync(required(env,'API_FOOTBALL_ATTENDED_ADMISSION_PATH'),'utf8'));
  validateAdmissionHandoff(admission,{approvedSha,versionId,versionApprovedSha,accountFingerprint:fingerprint});

  const critical=await criticalRecheck({
    env:{
      DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID:account,
      DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT:fingerprint,
      DATA_STEWARD_CLOUDFLARE_READ_TOKEN:readToken,
      API_FOOTBALL_PREFLIGHT_STAGE:'ATTENDED_ACCEPTANCE',
      API_FOOTBALL_ATTENDED_VERSION_ID:versionId,
      API_FOOTBALL_ATTENDED_VERSION_APPROVED_SHA:versionApprovedSha,
      APPROVED_SHA:approvedSha
    },
    fetchImpl,stage:'ATTENDED_ACCEPTANCE'
  });
  const previewIdentity=validateCriticalRecheck(critical,{approvedSha,versionId,versionApprovedSha,accountFingerprint:fingerprint});

  const headers={Authorization:'Bearer '+mutationToken,'content-type':'application/json'};
  const paths=attendedCloudflarePaths(account);let providerInvocations=0,d1Calls=0,d1Statements=0,d1RowsChanged=0,versionUrlReads=0,previewUrl=null;
  const cloudflare=async(requestPath,init={})=>{
    const method=init.method||'GET';assertAttendedCloudflareRequestAllowed(method,requestPath,{accountId:account});
    let response;try{response=await fetchImpl(API+requestPath,{...init,headers:{...headers,...init.headers},redirect:'error',signal:AbortSignal.timeout(15_000)});}catch{fail('attended_cloudflare_transport_ambiguous');}
    let body;try{body=await response.json();}catch{fail('attended_cloudflare_response_ambiguous');}
    if(!response.ok||body?.success!==true)fail('attended_cloudflare_operation_failed');return body.result;
  };
  const subdomain=enabled=>cloudflare(paths.subdomain,{method:'POST',headers:{'Cloudflare-Workers-Script-Api-Date':'2025-08-01'},body:JSON.stringify({enabled:false,previews_enabled:enabled})});
  const resolveVersionUrl=async()=>{
    versionUrlReads+=1;if(versionUrlReads!==1)fail('attended_version_url_read_budget_exceeded');
    const requestPath=`/accounts/${enc(account)}/workers/workers/${enc(previewIdentity.reviewedWorkerId)}/versions/${enc(versionId)}`;
    let response;try{response=await fetchImpl(API+requestPath,{method:'GET',headers:{Authorization:'Bearer '+readToken,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15_000)});}catch{fail('attended_version_url_read_failed');}
    let body;try{body=await response.json();}catch{fail('attended_version_url_read_failed');}
    const urls=body?.result?.urls;
    if(!response.ok||body?.success!==true||body.result?.id!==versionId||!Array.isArray(urls)||urls.length!==1||typeof urls[0]!=='string')fail('attended_version_url_unavailable');
    return deriveVersionPreviewUrl({versionId,versionUrl:urls[0],previewUrlSuffix:previewIdentity.previewUrlSuffix,accountSubdomain:previewIdentity.accountSubdomain,path:ATTENDED_ACCEPTANCE_PATH});
  };
  const runtime=async collectionEnabled=>{
    d1Calls+=1;d1Statements+=1;if(d1Calls>ATTENDED_CONTROL_MAX_D1_CALLS||d1Statements>ATTENDED_CONTROL_MAX_D1_STATEMENTS)fail('attended_control_budget_exceeded');
    const sql=collectionEnabled
      ?'UPDATE api_football_runtime_state SET collection_enabled=1 WHERE provider=? AND collection_enabled=0 AND credential_state=? AND in_flight_attempt_id IS NULL'
      :'UPDATE api_football_runtime_state SET collection_enabled=0 WHERE provider=? AND collection_enabled=1';
    const params=collectionEnabled?['api-football','AVAILABLE']:['api-football'];
    const result=await cloudflare(paths.d1,{method:'POST',body:JSON.stringify({sql,params})});
    const changes=Number(result?.[0]?.meta?.changes);if(!Array.isArray(result)||result.length!==1||result[0]?.success!==true||changes!==1)fail('attended_runtime_mutation_ambiguous');
    d1RowsChanged+=changes;if(d1RowsChanged>ATTENDED_CONTROL_MAX_ROWS_CHANGED)fail('attended_control_budget_exceeded');return result;
  };
  const result=await runAttendedAcceptance({admission,versionId,
    enablePreview:async()=>{await subdomain(true);previewUrl=await resolveVersionUrl();},disablePreview:()=>subdomain(false),enableCollection:()=>runtime(1),disableCollection:()=>runtime(0),
    invokeOnce:async()=>{if(providerInvocations!==0)fail('attended_second_invocation_forbidden');if(!(previewUrl instanceof URL))fail('attended_version_url_unavailable');providerInvocations+=1;
      let response;try{response=await fetchImpl(previewUrl,{method:'POST',headers:{'x-teamsheet-attended-trigger':trigger},redirect:'error',signal:AbortSignal.timeout(120_000)});}catch{return {requestCount:1,outcome:'AMBIGUOUS'};}
      return {requestCount:1,outcome:response.status===202?'ACCEPTED':'REJECTED'};
    }});
  return Object.freeze({...result,providerInvocations,versionUrlReads,controlBudget:Object.freeze({d1Calls,d1Statements,d1RowsChanged})});
}
export async function main(){const result=await executeLiveAttendedAcceptance();console.log(JSON.stringify({ok:result.ok===true,classification:result.classification??null,reason:result.reason??null,providerInvocations:result.providerInvocations,versionUrlReads:result.versionUrlReads,retryAuthorized:false,controlBudget:result.controlBudget??null}));return result.ok?0:1;}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
