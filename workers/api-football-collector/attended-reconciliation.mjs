import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {ATTENDED_PREVIEW_READINESS_MAX_ATTEMPTS} from './attended-acceptance.mjs';
import {runApiFootballActivationLivePreflight} from './activation-live-preflight.mjs';

export const ATTENDED_RECONCILIATION_VERSION='api-football-attended-reconciliation-v1';
export const ATTENDED_CLEAN_READINESS_STOP='ATTENDED_ACCEPTANCE_CLEAN_READINESS_STOP';
const safe=value=>Object.freeze(value);

export function classifyAttendedReconciliation(report,{executionEvidence}={}){
  const runtime=report?.runtime||{},history=report?.priorState||{},inventory=report?.inventory||{},mapping=report?.mapping||{};
  const base={ok:false,version:ATTENDED_RECONCILIATION_VERSION,retryAuthorized:false};
  const stop=reason=>safe({...base,classification:'ATTENDED_ACCEPTANCE_RECONCILIATION_REQUIRED',reason});
  if(inventory.previewUrls!==false)return stop('preview_cleanup_incomplete');
  if(runtime.collectionEnabled!==0)return stop('collection_cleanup_incomplete');
  if(inventory.versionInventoryExact!==true||inventory.versionIdentityExact!==true)return stop('version_inventory_unexpected');
  if(inventory.workersDev!==false||inventory.deploymentCount!==0||inventory.cronCount!==0||inventory.routeCount!==0||inventory.customDomainCount!==0)return stop('infrastructure_state_unexpected');
  if(runtime.activeLease!==false)return stop('active_or_expired_lease_requires_review');
  if(runtime.credentialState==='INVALID'||history.authFailureCount>0)return stop('authentication_failure');
  if(history.quotaBlockedCount>0)return stop('quota_blocked');
  if(history.timeoutCount>0)return stop('timeout_attempt_consumed');
  if(history.transportUnknownCount>0)return stop('transport_unknown_attempt_consumed');
  if(history.schemaFailureCount>0)return stop('schema_failure');
  if(history.httpFailureCount>0)return stop('http_failure');
  if(history.persistenceUncertainCount>0)return stop('persistence_uncertainty');
  if(history.completionUncertainCount>0)return stop('completion_uncertainty');
  if(history.reservedAttemptCount>0)return stop('reserved_attempt_requires_review');
  if(history.stagingGenerationCount>0)return stop(history.succeededAttemptCount===5?'generation_commit_uncertain':'generation_staging_requires_review');

  const cleanPristineState=report?.ok===true&&report?.stage==='ATTENDED_ACCEPTANCE'&&report?.classification==='READY_FOR_SEPARATELY_APPROVED_ATTENDED_ACCEPTANCE'&&
    runtime.credentialState==='AVAILABLE'&&history.requestAttempts===0&&history.generations===0&&history.fixtureRevisions===0&&history.attempt1Count===0&&history.attempt2Count===0&&
    report?.migrationCount===6&&report?.foreignKeyViolations===0&&report?.officialFplAuthority?.valid===true&&report?.officialFplAuthority?.teamCount===20&&
    mapping.state==='COMMITTED'&&mapping.mappingCount===20&&mapping.memberCount===20&&mapping.distinctProviderIds===20&&mapping.distinctFplIds===20&&
    mapping.canonicalCoverageMatches===true&&mapping.historicalAuthorityProvenancePresent===true&&inventory.productionBindingProven===true&&inventory.configurationExact===true&&
    inventory.previewUrlIdentityExact===true&&inventory.secretBindingPresent===true&&JSON.stringify(inventory.secretBindingNames)===JSON.stringify(['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET'])&&
    report?.modelUiImportCount===0&&report?.rawPayloadStoragePresent===false&&report?.evidence?.productionMutations===0&&report?.evidence?.apiFootballRequests===0&&report?.evidence?.secretValuesRead===0;
  const readiness=executionEvidence?.readinessEvidence;
  const cleanReadinessExecution=executionEvidence?.version==='api-football-attended-execution-v2'&&executionEvidence.approvedSha===report?.approvedSha&&
    executionEvidence.versionId===inventory.reviewedVersionId&&executionEvidence.ok===false&&executionEvidence.classification==='ATTENDED_EXECUTION_RECONCILIATION_REQUIRED'&&
    executionEvidence.reason==='attended_execution_requires_reconciliation'&&['ATTENDED_PREVIEW_ENDPOINT_UNSUPPORTED_4XX','ATTENDED_PREVIEW_READINESS_DNS_TRANSPORT_FAILURE','ATTENDED_PREVIEW_READINESS_TIMEOUT','ATTENDED_PREVIEW_READINESS_TRANSPORT_AMBIGUOUS'].includes(executionEvidence.diagnostic)&&
    executionEvidence.providerInvocations===0&&executionEvidence.invocationAttempted===false&&executionEvidence.collectionEnableSucceeded===false&&executionEvidence.retryAuthorized===false&&
    Number.isInteger(executionEvidence.versionUrlReads)&&executionEvidence.versionUrlReads>=1&&executionEvidence.versionUrlReads<=3&&
    readiness&&['HTTP_RESPONSE_MISMATCH','TRANSPORT_FAILURE','TIMEOUT'].includes(readiness.outcome)&&readiness.workerSignatureProved===false&&
    Number.isInteger(readiness.attempts)&&readiness.attempts===executionEvidence.previewReadinessAttempts&&readiness.attempts===ATTENDED_PREVIEW_READINESS_MAX_ATTEMPTS&&
    (readiness.lastHttpStatus===null||(Number.isInteger(readiness.lastHttpStatus)&&readiness.lastHttpStatus>=100&&readiness.lastHttpStatus<=599))&&
    [null,'STATUS','BODY','CACHE_CONTROL','CONTENT_TYPE'].includes(readiness.mismatch)&&executionEvidence.controlBudget?.d1Calls===1&&executionEvidence.controlBudget?.d1Statements===1&&executionEvidence.controlBudget?.d1RowsChanged===0;
  if(cleanPristineState&&cleanReadinessExecution)return safe({...base,classification:ATTENDED_CLEAN_READINESS_STOP,reason:'preview_readiness_not_proven'});

  const historyLooksSuccessful=runtime.credentialState==='AVAILABLE'&&history.requestAttempts===5&&history.attempt1Count===5&&history.attempt2Count===0&&
    history.succeededAttemptCount===5&&history.generations===1&&history.committedGenerationCount===1&&history.failedGenerationCount===0&&
    history.membershipConsistentCount===1&&history.headMatchCount===1&&Number.isInteger(history.fixtureRevisions)&&history.fixtureRevisions>=0&&history.fixtureRevisions<=2500&&
    report.modelUiImportCount===0&&report.rawPayloadStoragePresent===false;
  const expectedPostRunPreflightStop=report?.ok===false&&report?.stage==='ATTENDED_ACCEPTANCE'&&
    report?.classification==='STOP_ATTENDED_ACCEPTANCE_REVIEW_REQUIRED'&&report?.reason==='first_acceptance_history_not_pristine'&&
    report?.migrationCount===6&&report?.foreignKeyViolations===0&&report?.officialFplAuthority?.valid===true&&report?.officialFplAuthority?.teamCount===20&&
    mapping.state==='COMMITTED'&&mapping.mappingCount===20&&mapping.memberCount===20&&mapping.distinctProviderIds===20&&mapping.distinctFplIds===20&&
    mapping.canonicalCoverageMatches===true&&mapping.historicalAuthorityProvenancePresent===true&&
    inventory.productionBindingProven===true&&inventory.configurationExact===true&&inventory.previewUrlIdentityExact===true&&inventory.secretBindingPresent===true&&
    JSON.stringify(inventory.secretBindingNames)===JSON.stringify(['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET'])&&
    report?.evidence?.productionMutations===0&&report?.evidence?.apiFootballRequests===0&&report?.evidence?.secretValuesRead===0;
  if(historyLooksSuccessful&&!expectedPostRunPreflightStop)return stop('foundational_preflight_unexpected');
  return historyLooksSuccessful?safe({ok:true,version:ATTENDED_RECONCILIATION_VERSION,classification:'ATTENDED_ACCEPTANCE_RECONCILED_SUCCESS',retryAuthorized:false}):stop('acceptance_state_ambiguous');
}
export async function runAttendedReconciliation(options={}){
  const observed=await runApiFootballActivationLivePreflight({...options,stage:'ATTENDED_ACCEPTANCE'});
  const report=safe({...observed});
  return safe({report,result:classifyAttendedReconciliation(report,{executionEvidence:options.executionEvidence})});
}

export async function main(){
  const executionPath=process.env.API_FOOTBALL_ATTENDED_EXECUTION_REPORT_PATH;const executionEvidence=executionPath?JSON.parse(fs.readFileSync(executionPath,'utf8')):null;
  const {report,result}=await runAttendedReconciliation({executionEvidence});
  const output=safe({version:result.version,observedAt:report.observedAt,approvedSha:report.approvedSha,versionApprovedSha:report.versionApprovedSha,stage:report.stage,
    classification:result.classification,reason:result.reason??null,retryAuthorized:false,migrationCount:report.migrationCount,
    foreignKeyViolations:report.foreignKeyViolations,officialFplAuthority:report.officialFplAuthority,mapping:report.mapping,
    runtime:report.runtime,priorState:report.priorState,inventory:report.inventory,modelUiImportCount:report.modelUiImportCount,rawPayloadStoragePresent:report.rawPayloadStoragePresent,
    evidence:safe({...report.evidence,productionMutations:0,apiFootballRequests:0,secretValuesRead:0})});
  const outputPath=process.env.API_FOOTBALL_ATTENDED_RECONCILIATION_REPORT_PATH;if(outputPath)fs.writeFileSync(outputPath,JSON.stringify(output,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({ok:result.ok,classification:result.classification,reason:result.reason??null,retryAuthorized:false}));return result.ok?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
