// Controlled deployed one-shot shadow collection: pure contracts and orchestration.
// Repository presence authorizes nothing live. Every live step is separately owner-gated.
import {ATTENDED_ACCEPTANCE_PATH} from './collector.mjs';
import {isApiFootballTransportDiagnostic} from '../../src/decision-intelligence/api-football-foundation.mjs';
import {ATTENDED_VERSION_APPROVED_SHA,ATTENDED_VERSION_ID} from './attended-version.mjs';
import {API_FOOTBALL_ATTENDED_DISCOVERY_ACTIVATION} from './runtime-contracts.mjs';
import {COLLECTOR_LIFECYCLE_CLONE_CLOSEOUT_READY,COLLECTOR_PREFLIGHT_LIFECYCLE_CLONE_CLOSEOUT_STAGE} from './activation-preflight.mjs';
import {GATE_C_CLONE_VERSION_ID,ORIGINAL_COLLECTOR,ORIGINAL_COLLECTOR_ID} from './replacement-foundation.mjs';

export const DEPLOYED_ONE_SHOT_ADMISSION_VERSION='api-football-deployed-one-shot-admission-v1';
export const DEPLOYED_ONE_SHOT_EXECUTION_VERSION='api-football-deployed-one-shot-execution-v1';
export const DEPLOYED_ONE_SHOT_RECONCILIATION_VERSION='api-football-deployed-one-shot-reconciliation-v1';
export const DEPLOYED_ONE_SHOT_READY='READY_FOR_DEPLOYED_ONE_SHOT_COLLECTION';
export const DEPLOYED_ONE_SHOT_WORKER=ORIGINAL_COLLECTOR;
export const DEPLOYED_ONE_SHOT_WORKER_ID=ORIGINAL_COLLECTOR_ID;
export const DEPLOYED_ONE_SHOT_VERSION_ID=ATTENDED_VERSION_ID;
export const DEPLOYED_ONE_SHOT_VERSION_APPROVED_SHA=ATTENDED_VERSION_APPROVED_SHA;
export const DEPLOYED_ONE_SHOT_CLONE_VERSION_ID=GATE_C_CLONE_VERSION_ID;
export const DEPLOYED_ONE_SHOT_CLONE_APPROVED_SHA='cdb7d7ba140c38395893f223c42aee90d33b8b59';
export const DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE=COLLECTOR_PREFLIGHT_LIFECYCLE_CLONE_CLOSEOUT_STAGE;
export const DEPLOYED_ONE_SHOT_PATH=ATTENDED_ACCEPTANCE_PATH;
export const DEPLOYED_ONE_SHOT_SECRET_BINDINGS=Object.freeze(['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET']);
export const DEPLOYED_ONE_SHOT_CONTINUATION_ADMISSION_VERSION='api-football-deployed-one-shot-continuation-admission-v1';
export const DEPLOYED_ONE_SHOT_CONTINUATION_EXECUTION_VERSION='api-football-deployed-one-shot-continuation-execution-v1';
export const DEPLOYED_ONE_SHOT_CONTINUATION_RECONCILIATION_VERSION='api-football-deployed-one-shot-continuation-reconciliation-v1';
export const DEPLOYED_ONE_SHOT_CONTINUATION_READY='READY_FOR_DEPLOYED_ONE_SHOT_CONTINUATION';
// Run 37505586273 (consumed) submitted the single Deployment POST; independent readback proved this exact Deployment exists.
export const DEPLOYED_ONE_SHOT_EXISTING_DEPLOYMENT_ID='2417a3e0-15db-4e45-a3c8-00b148a300f4';
// The generic lifecycle preflight still expects zero Deployments and so STOPs with this exact reason once the Deployment exists.
export const DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_STOP='STOP_VERSION_URL_CREATION_EXPERIMENT_CLOSEOUT_REVIEW_REQUIRED';
export const DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_REASON='lifecycle_clone_inventory_unexpected';
export const DEPLOYED_ONE_SHOT_MAX_PROVIDER_REQUESTS=5;
export const DEPLOYED_ONE_SHOT_MAX_FIXTURE_REVISIONS=2500;
export const DEPLOYED_ONE_SHOT_MAX_TRIGGER_REQUESTS=1;
// Cloudflare mutation ceilings: one Deployment, one workers.dev enable, one workers.dev disable.
export const DEPLOYED_ONE_SHOT_CLOUDFLARE_MUTATION_CEILINGS=Object.freeze({createDeployment:1,enableWorkersDev:1,disableWorkersDev:1});
// Continuation reuses the existing inert Deployment: the Deployment mutation ceiling is zero.
export const DEPLOYED_ONE_SHOT_CONTINUATION_MUTATION_CEILINGS=Object.freeze({createDeployment:0,enableWorkersDev:1,disableWorkersDev:1});
// D1 ceiling: one bounded enable plus one idempotent cleanup disable, one row each.
export const DEPLOYED_ONE_SHOT_MAX_D1_CALLS=2;
export const DEPLOYED_ONE_SHOT_MAX_D1_ROWS_CHANGED=2;
export const DEPLOYED_ONE_SHOT_READINESS_DELAYS_MS=Object.freeze([0,2_000,5_000,10_000,20_000,30_000,45_000]);
export const DEPLOYED_ONE_SHOT_REQUEST_TIMEOUT_MS=15_000;
export const DEPLOYED_ONE_SHOT_TRIGGER_TIMEOUT_MS=120_000;
export const DEPLOYED_ONE_SHOT_RUNTIME_SQL=Object.freeze({
  enable:Object.freeze({sql:'UPDATE api_football_runtime_state SET collection_enabled=1 WHERE provider=? AND collection_enabled=0 AND credential_state=? AND in_flight_attempt_id IS NULL',params:Object.freeze(['api-football','AVAILABLE']),allowedChanges:Object.freeze([1])}),
  disable:Object.freeze({sql:'UPDATE api_football_runtime_state SET collection_enabled=0 WHERE provider=? AND collection_enabled=1',params:Object.freeze(['api-football']),allowedChanges:Object.freeze([0,1])})
});

const HEX40=/^[0-9a-f]{40}$/;
const HEX64=/^[0-9a-f]{64}$/;
const SUBDOMAIN=/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const DIAGNOSTIC=/^DEPLOYED_ONE_SHOT_[A-Z0-9_]{1,96}$/;
const safe=value=>Object.freeze(value);
export const closedDiagnostic=error=>{
  const message=typeof error==='string'?error:error?.message;
  return typeof message==='string'&&DIAGNOSTIC.test(message)?message:'DEPLOYED_ONE_SHOT_UNEXPECTED_FAILURE';
};

const sameNames=names=>Array.isArray(names)&&JSON.stringify(names)===JSON.stringify(DEPLOYED_ONE_SHOT_SECRET_BINDINGS);

// Shared foundational-state checks. Topology is checked separately because it differs pre/post run.
function foundationalDiagnostic(report,{approvedSha,accountFingerprint}){
  const inventory=report?.inventory||{},mapping=report?.mapping||{};
  if(report?.approvedSha!==approvedSha||report?.versionApprovedSha!==DEPLOYED_ONE_SHOT_VERSION_APPROVED_SHA||
    report?.cloneApprovedSha!==DEPLOYED_ONE_SHOT_CLONE_APPROVED_SHA||report?.accountFingerprint!==accountFingerprint||
    report?.stage!==DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE)return 'preflight_identity_mismatch';
  if(report.migrationCount!==6||report.foreignKeyViolations!==0)return 'migration_or_foreign_key_drift';
  if(report.officialFplAuthority?.valid!==true||report.officialFplAuthority?.teamCount!==20)return 'official_fpl_authority_invalid';
  if(mapping.state!=='COMMITTED'||mapping.mappingCount!==20||mapping.memberCount!==20||mapping.distinctProviderIds!==20||mapping.distinctFplIds!==20||
    mapping.canonicalCoverageMatches!==true||mapping.historicalAuthorityProvenancePresent!==true)return 'mapping_drift';
  if(inventory.reviewedVersionId!==DEPLOYED_ONE_SHOT_VERSION_ID||inventory.versionIdentityExact!==true||inventory.versionInventoryExact!==true||
    inventory.cloneVersionId!==DEPLOYED_ONE_SHOT_CLONE_VERSION_ID||inventory.cloneVersionIdentityExact!==true)return 'version_identity_mismatch';
  if(inventory.reviewedWorkerId!==DEPLOYED_ONE_SHOT_WORKER_ID||inventory.workerPresent!==true)return 'worker_identity_mismatch';
  if(inventory.activation!==API_FOOTBALL_ATTENDED_DISCOVERY_ACTIVATION||inventory.productionBindingProven!==true||inventory.configurationExact!==true)return 'collector_configuration_mismatch';
  if(inventory.secretBindingPresent!==true||!sameNames(inventory.secretBindingNames))return 'secret_binding_mismatch';
  if(typeof inventory.accountSubdomain!=='string'||!SUBDOMAIN.test(inventory.accountSubdomain))return 'account_subdomain_invalid';
  if(report.modelUiImportCount!==0||report.rawPayloadStoragePresent!==false)return 'model_isolation_mismatch';
  if(report.evidence?.productionMutations!==0||report.evidence?.apiFootballRequests!==0||report.evidence?.secretValuesRead!==0)return 'preflight_evidence_mismatch';
  return null;
}

// Pre-mutation admission: exact pristine original collector with no traffic surface.
export function deployedOneShotAdmissionDiagnostic(report,{approvedSha,accountFingerprint}={}){
  if(!HEX40.test(String(approvedSha||''))||!HEX64.test(String(accountFingerprint||'')))return 'admission_identity_invalid';
  if(report?.ok!==true||report.classification!==COLLECTOR_LIFECYCLE_CLONE_CLOSEOUT_READY)return 'preflight_not_ready';
  const foundational=foundationalDiagnostic(report,{approvedSha,accountFingerprint});if(foundational)return foundational;
  const inventory=report.inventory,runtime=report.runtime||{},prior=report.priorState||{};
  if(inventory.workersDev!==false||inventory.previewUrls!==false||inventory.deploymentCount!==0||inventory.cronCount!==0||
    inventory.routeCount!==0||inventory.customDomainCount!==0)return 'collector_topology_mismatch';
  if(runtime.collectionEnabled!==0)return 'collection_not_disabled';
  if(runtime.credentialState!=='AVAILABLE')return 'credential_not_available';
  if(runtime.activeLease!==false)return 'active_lease';
  if(prior.requestAttempts!==0||prior.generations!==0||prior.fixtureRevisions!==0||prior.attempt2Count!==0||
    prior.reservedAttemptCount!==0||prior.stagingGenerationCount!==0)return 'history_not_pristine';
  return null;
}

export function validateZoneTopology(topology){
  return topology?.proof==='ZONE_ROUTE_SCAN'&&Number.isSafeInteger(topology.zoneCount)&&topology.zoneCount>=0&&
    Number.isSafeInteger(topology.routeRowCount)&&topology.routeRowCount>=0&&topology.routeCount===0;
}

export function buildDeployedOneShotAdmission({report,topology,approvedSha,accountFingerprint,topologyFailure=null}={}){
  let reason=deployedOneShotAdmissionDiagnostic(report,{approvedSha,accountFingerprint});
  if(!reason&&topologyFailure)reason='zone_route_topology_unreadable';
  if(!reason&&!validateZoneTopology(topology))reason='zone_route_topology_not_inert';
  const ok=reason===null;
  return safe({
    version:DEPLOYED_ONE_SHOT_ADMISSION_VERSION,ok,approvedSha:approvedSha??null,accountFingerprint:accountFingerprint??null,
    versionId:DEPLOYED_ONE_SHOT_VERSION_ID,workerId:DEPLOYED_ONE_SHOT_WORKER_ID,
    classification:ok?DEPLOYED_ONE_SHOT_READY:'STOP_DEPLOYED_ONE_SHOT_ADMISSION_REVIEW_REQUIRED',reason,
    preflightClassification:report?.classification??null,preflightReason:report?.reason??null,
    topology:topology?safe({proof:topology.proof,zoneCount:topology.zoneCount,routeRowCount:topology.routeRowCount,routeCount:topology.routeCount}):null,
    preflight:report??null,retryAuthorized:false,
    evidence:safe({productionMutations:0,apiFootballRequests:0,secretValuesRead:0})
  });
}

export function validateDeployedOneShotAdmissionHandoff(admission,{approvedSha,accountFingerprint}={}){
  if(admission?.version!==DEPLOYED_ONE_SHOT_ADMISSION_VERSION||admission.ok!==true||admission.classification!==DEPLOYED_ONE_SHOT_READY||
    admission.approvedSha!==approvedSha||admission.accountFingerprint!==accountFingerprint||admission.versionId!==DEPLOYED_ONE_SHOT_VERSION_ID||
    admission.workerId!==DEPLOYED_ONE_SHOT_WORKER_ID||!validateZoneTopology(admission.topology)||admission.retryAuthorized!==false||
    admission.evidence?.productionMutations!==0||admission.evidence?.apiFootballRequests!==0||admission.evidence?.secretValuesRead!==0)throw new Error('DEPLOYED_ONE_SHOT_ADMISSION_HANDOFF_INVALID');
  const diagnostic=deployedOneShotAdmissionDiagnostic(admission.preflight,{approvedSha,accountFingerprint});
  if(diagnostic)throw new Error('DEPLOYED_ONE_SHOT_ADMISSION_HANDOFF_INVALID');
  return true;
}

// The only traffic surface: the Worker's own workers.dev hostname, derived from trusted metadata.
export function deriveWorkersDevTarget({accountSubdomain,workerName=DEPLOYED_ONE_SHOT_WORKER,path=DEPLOYED_ONE_SHOT_PATH}={}){
  if(typeof accountSubdomain!=='string'||!SUBDOMAIN.test(accountSubdomain)||workerName!==DEPLOYED_ONE_SHOT_WORKER||path!==DEPLOYED_ONE_SHOT_PATH)throw new Error('DEPLOYED_ONE_SHOT_TARGET_INVALID');
  const hostname=`${workerName}.${accountSubdomain}.workers.dev`;
  const url=new URL(`https://${hostname}${path}`);
  if(url.protocol!=='https:'||url.hostname!==hostname||url.pathname!==path||url.port||url.username||url.password||url.search||url.hash)throw new Error('DEPLOYED_ONE_SHOT_TARGET_INVALID');
  return url;
}

export function buildDeploymentBody(approvedSha){
  if(!HEX40.test(String(approvedSha||'')))throw new Error('DEPLOYED_ONE_SHOT_DEPLOYMENT_IDENTITY_INVALID');
  return safe({strategy:'percentage',versions:[safe({version_id:DEPLOYED_ONE_SHOT_VERSION_ID,percentage:100})],
    annotations:safe({'workers/message':'API-Football deployed one-shot shadow collection from '+approvedSha})});
}

export function deploymentSelectsExactVersion(deployment){
  return Boolean(deployment&&typeof deployment.id==='string'&&deployment.id&&deployment.strategy==='percentage'&&
    Array.isArray(deployment.versions)&&deployment.versions.length===1&&
    deployment.versions[0]?.version_id===DEPLOYED_ONE_SHOT_VERSION_ID&&Number(deployment.versions[0]?.percentage)===100);
}

export function deploymentListState(result){
  const rows=Array.isArray(result?.deployments)?result.deployments:Array.isArray(result)?result:null;
  if(!rows)return null;
  return safe({count:rows.length,exactSingle:rows.length===1&&deploymentSelectsExactVersion(rows[0]),deploymentId:rows.length===1&&typeof rows[0]?.id==='string'?rows[0].id:null});
}

// Deployment creation: the POST is submitted at most once and is never resent. An ambiguous immediate response is
// resolved by exactly one bounded read-only readback. Run 37505586273 showed a POST can apply while its response is
// classified ambiguous. Precondition: the caller proved zero Deployments before the POST.
export const DEPLOYMENT_CREATE_OUTCOMES=Object.freeze(['CREATED','APPLIED_CONFIRMED_BY_READBACK','REJECTED','NOT_APPLIED','AMBIGUOUS_OWNER_ATTENTION']);
export async function createDeploymentWithReadback({post,readback}={}){
  if(typeof post!=='function'||typeof readback!=='function')throw new Error('DEPLOYED_ONE_SHOT_OPERATIONS_INCOMPLETE');
  let submitted;
  try{submitted=await post();}catch{submitted={kind:'AMBIGUOUS'};}
  if(submitted?.kind==='REJECTED')return safe({outcome:'REJECTED',deploymentId:null,readbackPerformed:false});
  if(submitted?.kind==='OK'&&deploymentSelectsExactVersion(submitted.result))return safe({outcome:'CREATED',deploymentId:submitted.result.id,readbackPerformed:false});
  let state=null;
  try{state=await readback();}catch{state=null;}
  if(state&&Number.isSafeInteger(state.count)){
    if(state.count===0)return safe({outcome:'NOT_APPLIED',deploymentId:null,readbackPerformed:true});
    if(state.exactSingle===true&&typeof state.deploymentId==='string')return safe({outcome:'APPLIED_CONFIRMED_BY_READBACK',deploymentId:state.deploymentId,readbackPerformed:true});
  }
  return safe({outcome:'AMBIGUOUS_OWNER_ATTENTION',deploymentId:null,readbackPerformed:true});
}

export function workerSignatureMatches({status,body,cacheControl,contentType}){
  return status===404&&body==='Not found'&&cacheControl==='no-store'&&typeof contentType==='string'&&contentType.startsWith('text/plain');
}

// Pure orchestration. Cleanup always runs; cleanup failure never manufactures success.
export async function runDeployedOneShot({admissionValid=false,ops}={}){
  const required=['createDeployment','verifyDeployment','enableWorkersDev','proveReadiness','enableCollection','triggerOnce','disableCollection','disableWorkersDev'];
  if(admissionValid!==true)return safe({ok:false,classification:'DEPLOYED_ONE_SHOT_NOT_ADMITTED',diagnostic:'DEPLOYED_ONE_SHOT_NOT_ADMITTED',stagesReached:Object.freeze([]),retryAuthorized:false,cleanup:null,trigger:null});
  if(!ops||required.some(name=>typeof ops[name]!=='function'))return safe({ok:false,classification:'DEPLOYED_ONE_SHOT_OPERATIONS_INCOMPLETE',diagnostic:'DEPLOYED_ONE_SHOT_OPERATIONS_INCOMPLETE',stagesReached:Object.freeze([]),retryAuthorized:false,cleanup:null,trigger:null});
  const stagesReached=[];let primary=null,trigger=null;
  const step=async(name,operation)=>{stagesReached.push(name);await operation();};
  try{
    await step('CREATE_DEPLOYMENT',ops.createDeployment);
    await step('VERIFY_DEPLOYMENT',ops.verifyDeployment);
    await step('ENABLE_WORKERS_DEV',ops.enableWorkersDev);
    await step('PROVE_READINESS',ops.proveReadiness);
    await step('ENABLE_COLLECTION',ops.enableCollection);
    stagesReached.push('TRIGGER_ONCE');
    trigger=await ops.triggerOnce();
    if(!trigger||trigger.requestCount!==1)throw new Error('DEPLOYED_ONE_SHOT_TRIGGER_ACCOUNTING_INVALID');
    if(trigger.outcome!=='ACCEPTED')throw new Error(trigger.diagnostic||'DEPLOYED_ONE_SHOT_TRIGGER_AMBIGUOUS');
  }catch(error){primary=closedDiagnostic(error);}
  const cleanup={collectionDisable:null,workersDevDisable:null};
  try{await ops.disableCollection();cleanup.collectionDisable=safe({attempted:true,outcome:'SUCCEEDED',diagnostic:null});}
  catch(error){cleanup.collectionDisable=safe({attempted:true,outcome:'FAILED',diagnostic:closedDiagnostic(error)});}
  try{await ops.disableWorkersDev();cleanup.workersDevDisable=safe({attempted:true,outcome:'SUCCEEDED',diagnostic:null});}
  catch(error){cleanup.workersDevDisable=safe({attempted:true,outcome:'FAILED',diagnostic:closedDiagnostic(error)});}
  const cleanupOk=cleanup.collectionDisable.outcome==='SUCCEEDED'&&cleanup.workersDevDisable.outcome==='SUCCEEDED';
  const cleanupFailure=cleanupOk?null:(cleanup.collectionDisable.diagnostic??cleanup.workersDevDisable.diagnostic);
  const ok=primary===null&&cleanupOk;
  return safe({
    ok,classification:ok?'DEPLOYED_ONE_SHOT_TRIGGER_ACCEPTED_RECONCILIATION_REQUIRED':'DEPLOYED_ONE_SHOT_EXECUTION_RECONCILIATION_REQUIRED',
    diagnostic:primary??(cleanupOk?'DEPLOYED_ONE_SHOT_WORKER_ACCEPTED':null),primaryFailure:primary,cleanupFailure,
    stagesReached:Object.freeze([...stagesReached]),trigger:trigger?safe({requestCount:trigger.requestCount,outcome:trigger.outcome,diagnostic:trigger.diagnostic??null}):null,
    cleanup:safe(cleanup),retryAuthorized:false
  });
}

// Independent post-run classification from read-only state only.
export function classifyDeployedOneShotReconciliation(input={}){return classifyReconciliation(input,{continuation:false});}
// Continuation reconciliation: the one existing Deployment must remain exact and unmodified, and the execution made no Deployment mutation.
export function classifyDeployedOneShotContinuationReconciliation(input={}){return classifyReconciliation(input,{continuation:true});}

function classifyReconciliation({report,deployments,topology,execution,approvedSha,accountFingerprint}={},{continuation}){
  const base={version:continuation?DEPLOYED_ONE_SHOT_CONTINUATION_RECONCILIATION_VERSION:DEPLOYED_ONE_SHOT_RECONCILIATION_VERSION,retryAuthorized:false};
  const stop=reason=>safe({...base,ok:false,classification:'DEPLOYED_ONE_SHOT_OWNER_ATTENTION_REQUIRED',reason});
  // The pre-run classifier necessarily STOPs after a Deployment or history exists, so post-run
  // safety is judged from the observed fields themselves, never from that classification.
  if(!report||typeof report!=='object'||!report.inventory||!report.runtime||!report.priorState)return stop('preflight_unreadable');
  const foundational=foundationalDiagnostic(report,{approvedSha,accountFingerprint});if(foundational)return stop(foundational);
  const inventory=report.inventory,runtime=report.runtime||{},history=report.priorState||{};
  if(inventory.workersDev!==false)return stop('workers_dev_cleanup_incomplete');
  if(inventory.previewUrls!==false)return stop('preview_urls_enabled');
  if(runtime.collectionEnabled!==0)return stop('collection_cleanup_incomplete');
  if(inventory.cronCount!==0)return stop('cron_present');
  if(inventory.customDomainCount!==0)return stop('custom_domain_present');
  if(inventory.routeCount!==0||!validateZoneTopology(topology))return stop('route_present_or_unproven');
  if(!deployments||!Number.isSafeInteger(deployments.count))return stop('deployment_state_unreadable');
  if(deployments.count!==inventory.deploymentCount)return stop('deployment_state_inconsistent');
  if(deployments.count>1||(deployments.count===1&&deployments.exactSingle!==true))return stop('deployment_identity_unexpected');
  if(continuation&&(deployments.count!==1||deployments.exactSingle!==true||deployments.deploymentId!==DEPLOYED_ONE_SHOT_EXISTING_DEPLOYMENT_ID))return stop('deployment_identity_unexpected');
  if(['CREATED','APPLIED_CONFIRMED_BY_READBACK'].includes(execution?.deployment?.outcome)&&(deployments.count!==1||deployments.deploymentId!==execution.deployment.deploymentId))return stop('deployment_identity_unexpected');
  if(runtime.activeLease!==false)return stop('active_lease');
  if(runtime.credentialState==='INVALID'||history.authFailureCount>0)return stop('authentication_failure');
  if(history.quotaBlockedCount>0)return stop('quota_blocked');
  if(history.timeoutCount>0)return stop('timeout_attempt_consumed');
  if(history.transportUnknownCount>0)return stop('transport_unknown_attempt_consumed');
  if(history.schemaFailureCount>0)return stop('schema_failure');
  if(history.httpFailureCount>0)return stop('http_failure');
  if(history.persistenceUncertainCount>0)return stop('persistence_uncertainty');
  if(history.completionUncertainCount>0)return stop('completion_uncertainty');
  if(history.reservedAttemptCount>0)return stop('reserved_attempt_unresolved');
  if(history.stagingGenerationCount>0)return stop('staging_generation_unresolved');
  if(history.attempt2Count>0)return stop('retry_attempt_detected');
  if(runtime.credentialState!=='AVAILABLE')return stop('credential_state_unexpected');
  const executionValid=execution?.version===(continuation?DEPLOYED_ONE_SHOT_CONTINUATION_EXECUTION_VERSION:DEPLOYED_ONE_SHOT_EXECUTION_VERSION)&&execution.approvedSha===approvedSha&&
    execution.versionId===DEPLOYED_ONE_SHOT_VERSION_ID&&execution.retryAuthorized===false&&[0,1].includes(execution.triggerRequests)&&
    (!continuation||(execution.mutations?.createDeployment===0&&execution.deployment?.deploymentId===DEPLOYED_ONE_SHOT_EXISTING_DEPLOYMENT_ID));
  const pristine=history.requestAttempts===0&&history.generations===0&&history.fixtureRevisions===0&&history.attempt1Count===0;
  if(pristine)return safe({...base,ok:false,classification:'DEPLOYED_ONE_SHOT_CLEAN_STOP_NO_PROVIDER_REQUEST',
    reason:executionValid?(execution.triggerRequests===1?'trigger_sent_without_provider_activity':'stopped_before_trigger'):'execution_evidence_unavailable'});
  const successful=history.requestAttempts===DEPLOYED_ONE_SHOT_MAX_PROVIDER_REQUESTS&&history.attempt1Count===DEPLOYED_ONE_SHOT_MAX_PROVIDER_REQUESTS&&
    history.succeededAttemptCount===DEPLOYED_ONE_SHOT_MAX_PROVIDER_REQUESTS&&history.generations===1&&history.committedGenerationCount===1&&
    history.failedGenerationCount===0&&history.membershipConsistentCount===1&&history.headMatchCount===1&&
    Number.isSafeInteger(history.fixtureRevisions)&&history.fixtureRevisions>=0&&history.fixtureRevisions<=DEPLOYED_ONE_SHOT_MAX_FIXTURE_REVISIONS;
  if(!successful)return stop('collection_state_ambiguous');
  if(!executionValid||execution.triggerRequests!==1)return stop('execution_evidence_inconsistent');
  if(deployments.count!==1||deployments.exactSingle!==true)return stop('deployment_identity_unexpected');
  return safe({...base,ok:true,classification:'DEPLOYED_ONE_SHOT_RECONCILED_SUCCESS',reason:null});
}

// ---- Continuation from the one existing inert Deployment (run 37505586273 consumed; no recreate, no delete, no retry) ----

// Admission is judged from observed fields. The generic lifecycle preflight must STOP with exactly the stale zero-Deployment
// reason; any other classification, reason or readiness verdict is refused. Historical zero-Deployment admission is untouched.
export function deployedOneShotContinuationAdmissionDiagnostic(report,deployments,{approvedSha,accountFingerprint}={}){
  if(!HEX40.test(String(approvedSha||''))||!HEX64.test(String(accountFingerprint||'')))return 'admission_identity_invalid';
  if(report?.ok!==false||report.classification!==DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_STOP||report.reason!==DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_REASON)return 'preflight_not_continuation_state';
  const foundational=foundationalDiagnostic(report,{approvedSha,accountFingerprint});if(foundational)return foundational;
  const inventory=report.inventory,runtime=report.runtime||{},prior=report.priorState||{};
  if(inventory.databaseIdPlaceholder!==false||inventory.previewUrlIdentityExact!==true)return 'collector_configuration_mismatch';
  if(!deployments||!Number.isSafeInteger(deployments.count))return 'deployment_state_unreadable';
  if(deployments.count!==1||inventory.deploymentCount!==1||deployments.exactSingle!==true||deployments.deploymentId!==DEPLOYED_ONE_SHOT_EXISTING_DEPLOYMENT_ID)return 'deployment_identity_unexpected';
  if(inventory.workersDev!==false||inventory.previewUrls!==false||inventory.cronCount!==0||inventory.routeCount!==0||inventory.customDomainCount!==0)return 'collector_topology_mismatch';
  if(runtime.collectionEnabled!==0)return 'collection_not_disabled';
  if(runtime.credentialState!=='AVAILABLE')return 'credential_not_available';
  if(runtime.activeLease!==false)return 'active_lease';
  if(prior.requestAttempts!==0||prior.generations!==0||prior.fixtureRevisions!==0||prior.attempt1Count!==0||prior.attempt2Count!==0||
    prior.reservedAttemptCount!==0||prior.stagingGenerationCount!==0||prior.succeededAttemptCount!==0)return 'history_not_pristine';
  return null;
}

export function buildDeployedOneShotContinuationAdmission({report,deployments,topology,approvedSha,accountFingerprint,topologyFailure=null}={}){
  let reason=deployedOneShotContinuationAdmissionDiagnostic(report,deployments,{approvedSha,accountFingerprint});
  if(!reason&&topologyFailure)reason='zone_route_topology_unreadable';
  if(!reason&&!validateZoneTopology(topology))reason='zone_route_topology_not_inert';
  const ok=reason===null;
  return safe({
    version:DEPLOYED_ONE_SHOT_CONTINUATION_ADMISSION_VERSION,ok,approvedSha:approvedSha??null,accountFingerprint:accountFingerprint??null,
    versionId:DEPLOYED_ONE_SHOT_VERSION_ID,workerId:DEPLOYED_ONE_SHOT_WORKER_ID,deploymentId:DEPLOYED_ONE_SHOT_EXISTING_DEPLOYMENT_ID,
    classification:ok?DEPLOYED_ONE_SHOT_CONTINUATION_READY:'STOP_DEPLOYED_ONE_SHOT_CONTINUATION_ADMISSION_REVIEW_REQUIRED',reason,
    preflightClassification:report?.classification??null,preflightReason:report?.reason??null,
    deployments:deployments?safe({count:deployments.count,exactSingle:deployments.exactSingle,deploymentId:deployments.deploymentId}):null,
    topology:topology?safe({proof:topology.proof,zoneCount:topology.zoneCount,routeRowCount:topology.routeRowCount,routeCount:topology.routeCount}):null,
    preflight:report??null,retryAuthorized:false,
    evidence:safe({productionMutations:0,apiFootballRequests:0,secretValuesRead:0})
  });
}

export function validateDeployedOneShotContinuationAdmissionHandoff(admission,{approvedSha,accountFingerprint}={}){
  if(admission?.version!==DEPLOYED_ONE_SHOT_CONTINUATION_ADMISSION_VERSION||admission.ok!==true||admission.classification!==DEPLOYED_ONE_SHOT_CONTINUATION_READY||
    admission.approvedSha!==approvedSha||admission.accountFingerprint!==accountFingerprint||admission.versionId!==DEPLOYED_ONE_SHOT_VERSION_ID||
    admission.workerId!==DEPLOYED_ONE_SHOT_WORKER_ID||admission.deploymentId!==DEPLOYED_ONE_SHOT_EXISTING_DEPLOYMENT_ID||!validateZoneTopology(admission.topology)||
    admission.retryAuthorized!==false||admission.evidence?.productionMutations!==0||admission.evidence?.apiFootballRequests!==0||admission.evidence?.secretValuesRead!==0)throw new Error('DEPLOYED_ONE_SHOT_ADMISSION_HANDOFF_INVALID');
  if(deployedOneShotContinuationAdmissionDiagnostic(admission.preflight,admission.deployments,{approvedSha,accountFingerprint}))throw new Error('DEPLOYED_ONE_SHOT_ADMISSION_HANDOFF_INVALID');
  return true;
}

// Pure continuation orchestration. There is no createDeployment operation: a Deployment mutation is unrepresentable here.
export async function runDeployedOneShotContinuation({admissionValid=false,ops}={}){
  const required=['verifyDeployment','enableWorkersDev','proveReadiness','enableCollection','triggerOnce','disableCollection','disableWorkersDev'];
  const refuse=code=>safe({ok:false,classification:code,diagnostic:code,stagesReached:Object.freeze([]),retryAuthorized:false,cleanup:null,trigger:null});
  if(admissionValid!==true)return refuse('DEPLOYED_ONE_SHOT_NOT_ADMITTED');
  if(!ops||required.some(name=>typeof ops[name]!=='function')||Object.hasOwn(ops,'createDeployment'))return refuse('DEPLOYED_ONE_SHOT_OPERATIONS_INCOMPLETE');
  const stagesReached=[];let primary=null,trigger=null,workersDevTouched=false;
  const step=async(name,operation)=>{stagesReached.push(name);await operation();};
  try{
    await step('VERIFY_EXISTING_DEPLOYMENT',ops.verifyDeployment);
    workersDevTouched=true;
    await step('ENABLE_WORKERS_DEV',ops.enableWorkersDev);
    await step('PROVE_READINESS',ops.proveReadiness);
    await step('ENABLE_COLLECTION',ops.enableCollection);
    stagesReached.push('TRIGGER_ONCE');
    trigger=await ops.triggerOnce();
    if(!trigger||trigger.requestCount!==1)throw new Error('DEPLOYED_ONE_SHOT_TRIGGER_ACCOUNTING_INVALID');
    if(trigger.outcome!=='ACCEPTED')throw new Error(trigger.diagnostic||'DEPLOYED_ONE_SHOT_TRIGGER_AMBIGUOUS');
  }catch(error){primary=closedDiagnostic(error);}
  // Before the first mutation nothing was changed, so no cleanup is owed or attempted.
  const cleanup={collectionDisable:null,workersDevDisable:null};
  if(workersDevTouched){
    try{await ops.disableCollection();cleanup.collectionDisable=safe({attempted:true,outcome:'SUCCEEDED',diagnostic:null});}
    catch(error){cleanup.collectionDisable=safe({attempted:true,outcome:'FAILED',diagnostic:closedDiagnostic(error)});}
    try{await ops.disableWorkersDev();cleanup.workersDevDisable=safe({attempted:true,outcome:'SUCCEEDED',diagnostic:null});}
    catch(error){cleanup.workersDevDisable=safe({attempted:true,outcome:'FAILED',diagnostic:closedDiagnostic(error)});}
  }
  const cleanupOk=!workersDevTouched||(cleanup.collectionDisable.outcome==='SUCCEEDED'&&cleanup.workersDevDisable.outcome==='SUCCEEDED');
  const cleanupFailure=cleanupOk?null:(cleanup.collectionDisable.diagnostic??cleanup.workersDevDisable.diagnostic);
  const ok=primary===null&&cleanupOk;
  return safe({
    ok,classification:ok?'DEPLOYED_ONE_SHOT_TRIGGER_ACCEPTED_RECONCILIATION_REQUIRED':'DEPLOYED_ONE_SHOT_EXECUTION_RECONCILIATION_REQUIRED',
    diagnostic:primary??(cleanupOk?'DEPLOYED_ONE_SHOT_WORKER_ACCEPTED':null),primaryFailure:primary,cleanupFailure,
    stagesReached:Object.freeze([...stagesReached]),trigger:trigger?safe({requestCount:trigger.requestCount,outcome:trigger.outcome,diagnostic:trigger.diagnostic??null,providerTransportDiagnostic:isApiFootballTransportDiagnostic(trigger.providerTransportDiagnostic)?trigger.providerTransportDiagnostic:null}):null,
    cleanup:workersDevTouched?safe(cleanup):null,retryAuthorized:false
  });
}
