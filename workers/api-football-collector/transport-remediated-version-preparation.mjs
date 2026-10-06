// Transport-remediated reviewed Version preparation: pure admission, upload-outcome and reconciliation contracts.
// Repository presence authorizes nothing live. A live run needs a separate explicit owner approval after merge.
// The path may submit exactly ONE Worker Version upload POST and nothing else; the existing Deployment is never touched.
import {buildImmutableAttendedVersionIdentity,validateReviewedAttendedVersion} from './attended-version.mjs';
import {
  DEPLOYED_ONE_SHOT_CLONE_APPROVED_SHA,DEPLOYED_ONE_SHOT_CLONE_VERSION_ID,DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_REASON,
  DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_STOP,DEPLOYED_ONE_SHOT_EXISTING_DEPLOYMENT_ID,DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE,
  DEPLOYED_ONE_SHOT_VERSION_APPROVED_SHA,DEPLOYED_ONE_SHOT_VERSION_ID,DEPLOYED_ONE_SHOT_WORKER,DEPLOYED_ONE_SHOT_WORKER_ID,validateZoneTopology
} from './deployed-one-shot.mjs';
import {API_FOOTBALL_ATTENDED_DISCOVERY_ACTIVATION} from './runtime-contracts.mjs';
import {
  TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS,buildTransportRemediatedVersionIdentity,validateTransportRemediatedVersion
} from './transport-remediated-version.mjs';

export const TRANSPORT_REMEDIATED_ADMISSION_VERSION='api-football-transport-remediated-version-admission-v1';
export const TRANSPORT_REMEDIATED_EXECUTION_VERSION='api-football-transport-remediated-version-execution-v1';
export const TRANSPORT_REMEDIATED_RECONCILIATION_VERSION='api-football-transport-remediated-version-reconciliation-v1';
export const TRANSPORT_REMEDIATED_READY='READY_FOR_TRANSPORT_REMEDIATED_VERSION_UPLOAD';
export const TRANSPORT_REMEDIATED_PREPARED='TRANSPORT_REMEDIATED_VERSION_PREPARED_NOT_DEPLOYED';
export const TRANSPORT_REMEDIATED_CLEAN_STOP='TRANSPORT_REMEDIATED_VERSION_CLEAN_STOP_NO_VERSION_CREATED';
export const TRANSPORT_REMEDIATED_OWNER_ATTENTION='TRANSPORT_REMEDIATED_VERSION_OWNER_ATTENTION_REQUIRED';
export const TRANSPORT_REMEDIATED_WORKER=DEPLOYED_ONE_SHOT_WORKER;
export const TRANSPORT_REMEDIATED_RETAINED_DEPLOYMENT_ID=DEPLOYED_ONE_SHOT_EXISTING_DEPLOYMENT_ID;
export const TRANSPORT_REMEDIATED_RETAINED_VERSION_ID=DEPLOYED_ONE_SHOT_VERSION_ID;
// Scoped to THIS checkpoint (Gate A, before any promotion): exactly one retained Deployment. A later Gate B promotion
// adds Deployment history and needs its own admission; this constant must not be reused there.
export const TRANSPORT_REMEDIATED_EXPECTED_DEPLOYMENT_COUNT=1;
export const TRANSPORT_REMEDIATED_UPLOAD_OUTCOMES=Object.freeze(['CREATED','APPLIED_CONFIRMED_BY_READBACK','REJECTED','NOT_APPLIED','AMBIGUOUS_OWNER_ATTENTION']);
export const TRANSPORT_REMEDIATED_MAX_VERSION_UPLOADS=1;
export const TRANSPORT_REMEDIATED_READBACK_DELAYS_MS=Object.freeze([0,2_000,5_000]);
// Exact consumed history left by continuation run 37511401491 (one attempt, TRANSPORT_UNKNOWN, one failed generation).
export const TRANSPORT_REMEDIATED_CONSUMED_HISTORY=Object.freeze({
  requestAttempts:1,attempt1Count:1,attempt2Count:0,succeededAttemptCount:0,transportUnknownCount:1,generations:1,failedGenerationCount:1,
  committedGenerationCount:0,fixtureRevisions:0,reservedAttemptCount:0,stagingGenerationCount:0,authFailureCount:0,quotaBlockedCount:0,
  timeoutCount:0,schemaFailureCount:0,httpFailureCount:0,persistenceUncertainCount:0,completionUncertainCount:0,membershipConsistentCount:0,headMatchCount:0
});

const HEX40=/^[0-9a-f]{40}$/;
const HEX64=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUBDOMAIN=/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const DIAGNOSTIC=/^TRANSPORT_REMEDIATED_[A-Z0-9_]{1,96}$/;
const safe=value=>Object.freeze(value);
const SECRET_NAMES=Object.freeze(['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET']);
const REPOSITORY_DIAGNOSTIC=/^collector_transport_remediated_[a-z0-9_]{1,96}$/;
export const closedDiagnostic=error=>{
  const message=typeof error==='string'?error:error?.message;
  if(typeof message==='string'&&DIAGNOSTIC.test(message))return message;
  if(typeof message==='string'&&REPOSITORY_DIAGNOSTIC.test(message))return message.replace(/^collector_/,'').toUpperCase();
  return 'TRANSPORT_REMEDIATED_UNEXPECTED_FAILURE';
};

// ---- Active Deployment reader (scoped to this path; historical workflows keep their own exact-single assumptions) ----
// Cloudflare retains Deployment history, so the ACTIVE Deployment is the latest by created_on. With one row it is that row.
// With several rows it is proven only if every created_on parses and all are distinct; otherwise ordering is unproven.
export function activeDeploymentState(result){
  const rows=Array.isArray(result?.deployments)?result.deployments:Array.isArray(result)?result:null;
  if(!rows)return null;
  if(rows.some(row=>!row||typeof row!=='object'||typeof row.id!=='string'||!row.id)||new Set(rows.map(row=>row.id)).size!==rows.length)return null;
  let active=null;
  if(rows.length===1)active=rows[0];
  else if(rows.length>1){
    const stamps=rows.map(row=>Date.parse(row.created_on));
    if(stamps.every(Number.isFinite)&&new Set(stamps).size===stamps.length)active=rows[stamps.indexOf(Math.max(...stamps))];
  }
  const versions=active&&Array.isArray(active.versions)?active.versions:[];
  const selectsRetainedVersionAt100=Boolean(active&&active.strategy==='percentage'&&versions.length===1&&
    versions[0]?.version_id===TRANSPORT_REMEDIATED_RETAINED_VERSION_ID&&Number(versions[0]?.percentage)===100);
  return safe({
    count:rows.length,orderingProven:rows.length<=1||active!==null,activeDeploymentId:active?.id??null,
    activeVersionIds:Object.freeze(versions.map(row=>row?.version_id).filter(id=>typeof id==='string')),selectsRetainedVersionAt100
  });
}
function retainedDeploymentIntact(state){
  return Boolean(state&&state.count===TRANSPORT_REMEDIATED_EXPECTED_DEPLOYMENT_COUNT&&state.orderingProven===true&&
    state.activeDeploymentId===TRANSPORT_REMEDIATED_RETAINED_DEPLOYMENT_ID&&state.selectsRetainedVersionAt100===true);
}

const sameNames=names=>Array.isArray(names)&&JSON.stringify(names)===JSON.stringify(SECRET_NAMES);
export function consumedHistoryDiagnostic(prior){
  if(!prior||typeof prior!=='object')return 'history_unreadable';
  const expected=TRANSPORT_REMEDIATED_CONSUMED_HISTORY;
  if(prior.attempt2Count!==0)return 'retry_attempt_detected';
  if(prior.succeededAttemptCount!==0||prior.committedGenerationCount!==0||prior.fixtureRevisions!==0)return 'history_has_collection_success';
  if(prior.reservedAttemptCount!==0||prior.stagingGenerationCount!==0)return 'history_unresolved_reservation_or_staging';
  if(Object.entries(expected).some(([key,value])=>prior[key]!==value))return 'history_not_the_exact_consumed_shape';
  return null;
}

// Shared foundational-state checks from observed fields only. The generic lifecycle preflight is not a verdict here.
function foundationDiagnostic(report,{approvedSha,accountFingerprint,requireVersionInventory}){
  const inventory=report?.inventory||{},mapping=report?.mapping||{};
  if(report?.approvedSha!==approvedSha||report?.versionApprovedSha!==DEPLOYED_ONE_SHOT_VERSION_APPROVED_SHA||
    report?.cloneApprovedSha!==DEPLOYED_ONE_SHOT_CLONE_APPROVED_SHA||report?.accountFingerprint!==accountFingerprint||
    report?.stage!==DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE)return 'preflight_identity_mismatch';
  if(report.migrationCount!==6||report.foreignKeyViolations!==0)return 'migration_or_foreign_key_drift';
  if(report.officialFplAuthority?.valid!==true||report.officialFplAuthority?.teamCount!==20)return 'official_fpl_authority_invalid';
  if(mapping.state!=='COMMITTED'||mapping.mappingCount!==20||mapping.memberCount!==20||mapping.distinctProviderIds!==20||mapping.distinctFplIds!==20||
    mapping.canonicalCoverageMatches!==true||mapping.historicalAuthorityProvenancePresent!==true)return 'mapping_drift';
  if(inventory.reviewedVersionId!==DEPLOYED_ONE_SHOT_VERSION_ID)return 'version_identity_mismatch';
  if(requireVersionInventory&&(inventory.versionIdentityExact!==true||inventory.versionInventoryExact!==true||
    inventory.cloneVersionId!==DEPLOYED_ONE_SHOT_CLONE_VERSION_ID||inventory.cloneVersionIdentityExact!==true))return 'version_identity_mismatch';
  if(inventory.reviewedWorkerId!==DEPLOYED_ONE_SHOT_WORKER_ID||inventory.workerPresent!==true)return 'worker_identity_mismatch';
  if(inventory.activation!==API_FOOTBALL_ATTENDED_DISCOVERY_ACTIVATION||inventory.productionBindingProven!==true||inventory.configurationExact!==true||
    inventory.databaseIdPlaceholder!==false||inventory.previewUrlIdentityExact!==true)return 'collector_configuration_mismatch';
  if(inventory.secretBindingPresent!==true||!sameNames(inventory.secretBindingNames))return 'secret_binding_mismatch';
  if(typeof inventory.accountSubdomain!=='string'||!SUBDOMAIN.test(inventory.accountSubdomain))return 'account_subdomain_invalid';
  if(report.modelUiImportCount!==0||report.rawPayloadStoragePresent!==false)return 'model_isolation_mismatch';
  if(report.evidence?.productionMutations!==0||report.evidence?.apiFootballRequests!==0||report.evidence?.secretValuesRead!==0)return 'preflight_evidence_mismatch';
  const runtime=report.runtime||{};
  if(inventory.workersDev!==false||inventory.previewUrls!==false||inventory.cronCount!==0||inventory.routeCount!==0||inventory.customDomainCount!==0)return 'collector_topology_mismatch';
  if(runtime.collectionEnabled!==0)return 'collection_not_disabled';
  if(runtime.credentialState!=='AVAILABLE')return 'credential_not_available';
  if(runtime.activeLease!==false)return 'active_lease';
  return consumedHistoryDiagnostic(report.priorState);
}

// Pre-upload admission. The generic lifecycle preflight necessarily STOPs because a Deployment now exists; that stale
// zero-Deployment STOP is consumed only against the exact observed fields above. Any other verdict is refused.
export function transportRemediatedAdmissionDiagnostic(report,deployments,{approvedSha,accountFingerprint}={}){
  if(!HEX40.test(String(approvedSha||''))||!HEX64.test(String(accountFingerprint||'')))return 'admission_identity_invalid';
  if(report?.ok!==false||report.classification!==DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_STOP||report.reason!==DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_REASON)return 'preflight_not_expected_post_deployment_state';
  const foundation=foundationDiagnostic(report,{approvedSha,accountFingerprint,requireVersionInventory:true});if(foundation)return foundation;
  if(!deployments||!Number.isSafeInteger(deployments.count))return 'deployment_state_unreadable';
  if(report.inventory.deploymentCount!==deployments.count)return 'deployment_state_inconsistent';
  if(!retainedDeploymentIntact(deployments))return 'deployment_identity_unexpected';
  return null;
}

export function buildTransportRemediatedAdmission({report,deployments,topology,approvedSha,accountFingerprint,topologyFailure=null}={}){
  let reason=transportRemediatedAdmissionDiagnostic(report,deployments,{approvedSha,accountFingerprint});
  if(!reason&&topologyFailure)reason='zone_route_topology_unreadable';
  if(!reason&&!validateZoneTopology(topology))reason='zone_route_topology_not_inert';
  const ok=reason===null;
  return safe({
    version:TRANSPORT_REMEDIATED_ADMISSION_VERSION,ok,approvedSha:approvedSha??null,accountFingerprint:accountFingerprint??null,
    workerId:DEPLOYED_ONE_SHOT_WORKER_ID,retainedVersionId:TRANSPORT_REMEDIATED_RETAINED_VERSION_ID,retainedDeploymentId:TRANSPORT_REMEDIATED_RETAINED_DEPLOYMENT_ID,
    classification:ok?TRANSPORT_REMEDIATED_READY:'STOP_TRANSPORT_REMEDIATED_ADMISSION_REVIEW_REQUIRED',reason,
    preflightClassification:report?.classification??null,preflightReason:report?.reason??null,
    deployments:deployments?safe({count:deployments.count,orderingProven:deployments.orderingProven,activeDeploymentId:deployments.activeDeploymentId,
      activeVersionIds:deployments.activeVersionIds,selectsRetainedVersionAt100:deployments.selectsRetainedVersionAt100}):null,
    topology:topology?safe({proof:topology.proof,zoneCount:topology.zoneCount,routeRowCount:topology.routeRowCount,routeCount:topology.routeCount}):null,
    preflight:report??null,retryAuthorized:false,
    evidence:safe({productionMutations:0,apiFootballRequests:0,secretValuesRead:0})
  });
}

export function validateTransportRemediatedAdmissionHandoff(admission,{approvedSha,accountFingerprint}={}){
  const invalid=()=>{throw new Error('TRANSPORT_REMEDIATED_ADMISSION_HANDOFF_INVALID');};
  if(admission?.version!==TRANSPORT_REMEDIATED_ADMISSION_VERSION||admission.ok!==true||admission.classification!==TRANSPORT_REMEDIATED_READY||
    admission.approvedSha!==approvedSha||admission.accountFingerprint!==accountFingerprint||admission.workerId!==DEPLOYED_ONE_SHOT_WORKER_ID||
    admission.retainedVersionId!==TRANSPORT_REMEDIATED_RETAINED_VERSION_ID||admission.retainedDeploymentId!==TRANSPORT_REMEDIATED_RETAINED_DEPLOYMENT_ID||
    !validateZoneTopology(admission.topology)||admission.retryAuthorized!==false||admission.evidence?.productionMutations!==0||
    admission.evidence?.apiFootballRequests!==0||admission.evidence?.secretValuesRead!==0)invalid();
  if(transportRemediatedAdmissionDiagnostic(admission.preflight,admission.deployments,{approvedSha,accountFingerprint}))invalid();
  return true;
}

// ---- Version upload: submitted at most once, never resent. Ambiguity is resolved by bounded read-only readback only. ----
const sameIds=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&new Set(a).size===a.length&&a.every(id=>b.includes(id));
export async function submitTransportRemediatedVersionUpload({post,readVersions,beforeIds,wait=async()=>{}}={}){
  if(typeof post!=='function'||typeof readVersions!=='function'||!Array.isArray(beforeIds)||!sameIds(beforeIds,TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS))
    throw new Error('TRANSPORT_REMEDIATED_UPLOAD_OPERATIONS_INVALID');
  let submitted;
  try{submitted=await post();}catch{submitted={kind:'AMBIGUOUS'};}
  if(submitted?.kind==='REJECTED')return safe({outcome:'REJECTED',versionId:null,readbackAttempts:0});
  const returnedId=submitted?.kind==='OK'&&typeof submitted.result?.id==='string'&&UUID.test(submitted.result.id)&&!beforeIds.includes(submitted.result.id)?submitted.result.id:null;
  const accepted=returnedId!==null,definiteOk=submitted?.kind==='OK';
  let readbackAttempts=0,lastReadable=false,added=null,malformed=false;
  for(const delay of TRANSPORT_REMEDIATED_READBACK_DELAYS_MS){
    if(delay>0)await wait(delay);
    readbackAttempts+=1;
    let ids=null;try{ids=await readVersions();}catch{ids=null;}
    if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string'||!UUID.test(id))||new Set(ids).size!==ids.length){malformed=true;continue;}
    lastReadable=true;
    const fresh=ids.filter(id=>!beforeIds.includes(id));
    const retained=beforeIds.every(id=>ids.includes(id));
    if(fresh.length===1&&retained&&ids.length===beforeIds.length+1){added=fresh[0];break;}
    if(fresh.length>0||!retained||ids.length<beforeIds.length)return safe({outcome:'AMBIGUOUS_OWNER_ATTENTION',versionId:null,readbackAttempts});
  }
  if(added!==null){
    if(accepted&&added!==returnedId)return safe({outcome:'AMBIGUOUS_OWNER_ATTENTION',versionId:null,readbackAttempts});
    return safe({outcome:accepted?'CREATED':'APPLIED_CONFIRMED_BY_READBACK',versionId:added,readbackAttempts});
  }
  // No new Version was observed after bounded readback. A definite acceptance without a visible Version is never trusted as NOT_APPLIED.
  if(!definiteOk&&lastReadable&&!malformed)return safe({outcome:'NOT_APPLIED',versionId:null,readbackAttempts});
  return safe({outcome:'AMBIGUOUS_OWNER_ATTENTION',versionId:null,readbackAttempts});
}

// ---- Execution evidence (sanitized; no secret value, no raw response) ----
export const TRANSPORT_REMEDIATED_EXECUTION_KEYS=Object.freeze([
  'apiFootballRequests','approvedSha','classification','d1Mutations','deploymentMutations','diagnostic','finalRouteScan','identity','ok','outcome',
  'previewMutations','productionMutations','readbackAttempts','retryAuthorized','secretValuesSerialized','version','versionId','versionUploadAttempts',
  'workersDevMutations'
]);
export function buildTransportRemediatedExecutionEvidence({approvedSha=null,outcome='NOT_SUBMITTED',versionId=null,readbackAttempts=0,diagnostic=null,
  finalRouteScan=null,identity=null,counters={}}={}){
  const versionUploadAttempts=counters.versionUploadAttempts??0;
  const created=['CREATED','APPLIED_CONFIRMED_BY_READBACK'].includes(outcome);
  return safe({
    version:TRANSPORT_REMEDIATED_EXECUTION_VERSION,approvedSha,ok:created,
    classification:created?'TRANSPORT_REMEDIATED_VERSION_UPLOAD_SUBMITTED_RECONCILIATION_REQUIRED':outcome==='NOT_SUBMITTED'?'TRANSPORT_REMEDIATED_STOPPED_BEFORE_MUTATION':'TRANSPORT_REMEDIATED_VERSION_UPLOAD_NOT_CONFIRMED_RECONCILIATION_REQUIRED',
    diagnostic,outcome,versionId:created?versionId:null,readbackAttempts,
    identity:identity?safe({graphSha256:identity.graphSha256,metadataSha256:identity.metadataSha256,moduleCount:Object.keys(identity.moduleSha256).length}):null,
    finalRouteScan,versionUploadAttempts,productionMutations:versionUploadAttempts,deploymentMutations:counters.deploymentMutations??0,
    d1Mutations:counters.d1Mutations??0,workersDevMutations:counters.workersDevMutations??0,previewMutations:counters.previewMutations??0,
    apiFootballRequests:counters.apiFootballRequests??0,secretValuesSerialized:0,retryAuthorized:false
  });
}
export function validateTransportRemediatedExecutionEvidence(evidence,{approvedSha}={}){
  if(!evidence||typeof evidence!=='object'||JSON.stringify(Object.keys(evidence).sort())!==JSON.stringify([...TRANSPORT_REMEDIATED_EXECUTION_KEYS].sort()))return false;
  if(evidence.version!==TRANSPORT_REMEDIATED_EXECUTION_VERSION||evidence.approvedSha!==approvedSha||evidence.retryAuthorized!==false)return false;
  if(![...TRANSPORT_REMEDIATED_UPLOAD_OUTCOMES,'NOT_SUBMITTED'].includes(evidence.outcome))return false;
  if(![0,1].includes(evidence.versionUploadAttempts)||evidence.productionMutations!==evidence.versionUploadAttempts)return false;
  if(evidence.deploymentMutations!==0||evidence.d1Mutations!==0||evidence.workersDevMutations!==0||evidence.previewMutations!==0||
    evidence.apiFootballRequests!==0||evidence.secretValuesSerialized!==0)return false;
  const created=['CREATED','APPLIED_CONFIRMED_BY_READBACK'].includes(evidence.outcome);
  if(created&&(evidence.versionUploadAttempts!==1||!UUID.test(String(evidence.versionId||''))))return false;
  if(!created&&evidence.versionId!==null)return false;
  if(evidence.outcome==='NOT_SUBMITTED'&&evidence.versionUploadAttempts!==0)return false;
  if(evidence.outcome!=='NOT_SUBMITTED'&&evidence.versionUploadAttempts!==1)return false;
  return true;
}

// ---- Independent post-run classification from read-only state only ----
// Success: exactly one new Version, exact to the remediated identity, created but NOT deployed; every other surface unchanged.
export function classifyTransportRemediatedReconciliation({report,versionIds,candidate,attended,deployments,topology,execution,approvedSha,accountFingerprint,identity}={}){
  const base={version:TRANSPORT_REMEDIATED_RECONCILIATION_VERSION,retryAuthorized:false};
  const stop=reason=>safe({...base,ok:false,classification:TRANSPORT_REMEDIATED_OWNER_ATTENTION,reason});
  if(!report||typeof report!=='object'||!report.inventory||!report.runtime||!report.priorState)return stop('preflight_unreadable');
  if(!HEX40.test(String(approvedSha||''))||!HEX64.test(String(accountFingerprint||'')))return stop('reconciliation_identity_invalid');
  const foundation=foundationDiagnostic(report,{approvedSha,accountFingerprint,requireVersionInventory:false});if(foundation)return stop(foundation);
  if(!validateZoneTopology(topology))return stop('route_present_or_unproven');
  if(!deployments||!Number.isSafeInteger(deployments.count))return stop('deployment_state_unreadable');
  if(report.inventory.deploymentCount!==deployments.count)return stop('deployment_state_inconsistent');
  if(!retainedDeploymentIntact(deployments))return stop('deployment_identity_unexpected');
  if(!Array.isArray(versionIds)||versionIds.some(id=>typeof id!=='string'||!UUID.test(id))||new Set(versionIds).size!==versionIds.length)return stop('version_inventory_unreadable');
  const historicalIntact=TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS.every(id=>versionIds.includes(id));
  if(!historicalIntact)return stop('historical_version_missing');
  const fresh=versionIds.filter(id=>!TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS.includes(id));
  const executionValid=validateTransportRemediatedExecutionEvidence(execution,{approvedSha});

  if(fresh.length===0){
    if(report.inventory.versionInventoryExact!==true||report.inventory.versionIdentityExact!==true||report.inventory.cloneVersionIdentityExact!==true)return stop('historical_version_inventory_not_exact');
    if(executionValid&&['CREATED','APPLIED_CONFIRMED_BY_READBACK'].includes(execution.outcome))return stop('execution_claims_version_but_none_exists');
    return safe({...base,ok:false,classification:TRANSPORT_REMEDIATED_CLEAN_STOP,
      reason:executionValid?(execution.outcome==='NOT_SUBMITTED'?'stopped_before_upload':execution.outcome==='REJECTED'?'upload_rejected':execution.outcome==='NOT_APPLIED'?'upload_not_applied':'upload_ambiguous_but_no_version_observed'):'execution_evidence_unavailable',
      candidateVersionId:null});
  }
  if(fresh.length!==1||versionIds.length!==TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS.length+1)return stop('unexpected_version_count');
  const candidateId=fresh[0];
  if(!candidate||candidate.versionId!==candidateId||!attended)return stop('candidate_detail_unreadable');
  let expected;try{expected=identity??buildTransportRemediatedVersionIdentity(approvedSha);}catch{return stop('candidate_identity_unavailable');}
  try{validateTransportRemediatedVersion({stableVersion:candidate.stable,betaVersion:candidate.beta,versionId:candidateId,identity:expected});}
  catch(error){return stop(String(error?.message||'candidate_identity_drift').replace(/^collector_transport_remediated_/,''));}
  try{validateReviewedAttendedVersion({stableVersion:attended.stable,betaVersion:attended.beta,versionId:DEPLOYED_ONE_SHOT_VERSION_ID,identity:buildImmutableAttendedVersionIdentity()});}
  catch{return stop('retained_attended_version_drift');}
  if(!executionValid)return stop('execution_evidence_unavailable');
  if(execution.versionUploadAttempts!==1||(execution.versionId!==null&&execution.versionId!==candidateId)||['REJECTED','NOT_SUBMITTED','NOT_APPLIED'].includes(execution.outcome))return stop('execution_evidence_inconsistent');
  return safe({...base,ok:true,classification:TRANSPORT_REMEDIATED_PREPARED,reason:null,candidateVersionId:candidateId});
}
