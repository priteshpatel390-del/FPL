// Transport-remediated Deployment promotion (Gate B): pure admission, promotion-outcome and reconciliation contracts.
// Repository presence authorizes nothing live. A live run needs a separate explicit owner approval after merge.
//
// Gate A (run 37680114065, consumed) created the corrected reviewed Version 4171f3cf-953e-452e-9e5f-068df9a3ca47 on main
// f01ccff5b13a4bbc98d7927cf620f69f46c4c54c. That creation SHA is IMMUTABLE provenance. Gate B executes on a later main SHA;
// the execution SHA is execution provenance only and is never used to rebuild the candidate's identity.
//
// The path may submit exactly ONE Deployment POST selecting the candidate at 100% and nothing else. It never uploads a
// Version, never edits or deletes the historical Deployment, never enables workers.dev or Preview, never touches D1, Cron,
// routes or domains, never invokes the Worker and never calls API-Football. There is no automatic rollback.
import {ATTENDED_VERSION_ID,ORIGINAL_BLOCKED_VERSION_ID,buildLifecycleCloneIdentity,validateLifecycleExperimentInventory} from './attended-version.mjs';
import {
  DEPLOYED_ONE_SHOT_CLONE_APPROVED_SHA,DEPLOYED_ONE_SHOT_CLONE_VERSION_ID,DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_REASON,
  DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_STOP,DEPLOYED_ONE_SHOT_EXISTING_DEPLOYMENT_ID,DEPLOYED_ONE_SHOT_VERSION_ID,
  DEPLOYED_ONE_SHOT_WORKER,DEPLOYED_ONE_SHOT_WORKER_ID,validateZoneTopology
} from './deployed-one-shot.mjs';
import {foundationDiagnostic} from './transport-remediated-version-preparation.mjs';
import {
  TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS,TRANSPORT_REMEDIATED_VERSION_CONTRACT,TRANSPORT_REMEDIATED_VERSION_MODULE_SHA256,
  buildTransportRemediatedVersionIdentity,validateTransportRemediatedVersion
} from './transport-remediated-version.mjs';

// ---- Immutable Gate A candidate provenance (live Cloudflare state since run 37680114065) ----
export const PROMOTION_GATE_A_RUN_ID='37680114065';
export const PROMOTION_CANDIDATE_VERSION_ID='4171f3cf-953e-452e-9e5f-068df9a3ca47';
export const PROMOTION_CANDIDATE_CREATION_SHA='f01ccff5b13a4bbc98d7927cf620f69f46c4c54c';
export const PROMOTION_CANDIDATE_GRAPH_SHA256='03db54c4faf0bfc08f52382e56fc165cadccb7337786581053328e07f2f8f6cc';
export const PROMOTION_CANDIDATE_METADATA_SHA256='67097c838c1e0f9a5f2c765ea17dff3eb690bb4e646688c35cab4c66055b1119';
export const PROMOTION_CANDIDATE_MODULE_COUNT=17;

export const PROMOTION_ADMISSION_VERSION='api-football-transport-remediated-deployment-promotion-admission-v1';
export const PROMOTION_EXECUTION_VERSION='api-football-transport-remediated-deployment-promotion-execution-v1';
export const PROMOTION_RECONCILIATION_VERSION='api-football-transport-remediated-deployment-promotion-reconciliation-v1';
export const PROMOTION_READY='READY_FOR_TRANSPORT_REMEDIATED_DEPLOYMENT_PROMOTION';
export const PROMOTION_ADMISSION_STOP='STOP_TRANSPORT_REMEDIATED_DEPLOYMENT_PROMOTION_ADMISSION_REVIEW_REQUIRED';
// Success: the corrected Version is promoted at 100% but the Worker is still unreachable (every traffic surface off).
export const PROMOTION_PROMOTED_INERT='TRANSPORT_REMEDIATED_DEPLOYMENT_PROMOTED_INERT';
export const PROMOTION_CLEAN_STOP='TRANSPORT_REMEDIATED_DEPLOYMENT_PROMOTION_CLEAN_STOP_NOT_PROMOTED';
export const PROMOTION_OWNER_ATTENTION='TRANSPORT_REMEDIATED_DEPLOYMENT_PROMOTION_OWNER_ATTENTION_REQUIRED';
export const PROMOTION_WORKER=DEPLOYED_ONE_SHOT_WORKER;
export const PROMOTION_WORKER_ID=DEPLOYED_ONE_SHOT_WORKER_ID;
export const PROMOTION_RETAINED_DEPLOYMENT_ID=DEPLOYED_ONE_SHOT_EXISTING_DEPLOYMENT_ID;
export const PROMOTION_RETAINED_VERSION_ID=DEPLOYED_ONE_SHOT_VERSION_ID;
// Exactly the four Versions left by Gate A: original blocked, old attended, Gate C clone, corrected candidate.
export const PROMOTION_EXPECTED_VERSION_IDS=Object.freeze([...TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS,PROMOTION_CANDIDATE_VERSION_ID]);
export const PROMOTION_PRE_DEPLOYMENT_COUNT=1;
export const PROMOTION_POST_DEPLOYMENT_COUNT=2;
export const PROMOTION_OUTCOMES=Object.freeze(['CREATED','APPLIED_CONFIRMED_BY_READBACK','REJECTED','AMBIGUOUS_OWNER_ATTENTION','NOT_SUBMITTED']);
export const PROMOTION_MAX_DEPLOYMENT_POSTS=1;
export const PROMOTION_READBACK_DELAYS_MS=Object.freeze([0,2_000,5_000]);
// Conservative bound for Cloudflare's Deployment message annotation; the deterministic message never exceeds it.
export const PROMOTION_MESSAGE_MAX_LENGTH=100;
// Every Cloudflare mutation class this path could conceivably touch. Only the Deployment POST is non-zero.
export const PROMOTION_MUTATION_CEILINGS=Object.freeze({
  deploymentPost:1,versionUpload:0,workersDev:0,preview:0,d1:0,schedules:0,routes:0,domains:0,workerShell:0,delete:0,put:0,patch:0,apiFootball:0,workerInvocation:0
});

const HEX40=/^[0-9a-f]{40}$/;
const HEX64=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIAGNOSTIC=/^TRANSPORT_REMEDIATED_PROMOTION_[A-Z0-9_]{1,96}$/;
const REPOSITORY_DIAGNOSTIC=/^transport_remediated_promotion_[a-z0-9_]{1,96}$/;
const safe=value=>Object.freeze(value);
const fail=code=>{throw new Error(code);};
export const closedDiagnostic=error=>{
  const message=typeof error==='string'?error:error?.message;
  if(typeof message==='string'&&DIAGNOSTIC.test(message))return message;
  if(typeof message==='string'&&REPOSITORY_DIAGNOSTIC.test(message))return message.toUpperCase();
  return 'TRANSPORT_REMEDIATED_PROMOTION_UNEXPECTED_FAILURE';
};

// ---- Candidate identity: ALWAYS rebuilt from the immutable creation SHA, never from the execution SHA ----
export function buildPromotionCandidateIdentity(creationSha=PROMOTION_CANDIDATE_CREATION_SHA,options={}){
  if(creationSha!==PROMOTION_CANDIDATE_CREATION_SHA)fail('transport_remediated_promotion_candidate_provenance_invalid');
  let identity;
  try{identity=buildTransportRemediatedVersionIdentity(PROMOTION_CANDIDATE_CREATION_SHA,options);}
  catch{return fail('transport_remediated_promotion_candidate_identity_drift');}
  if(identity.contract!==TRANSPORT_REMEDIATED_VERSION_CONTRACT||identity.approvedSha!==PROMOTION_CANDIDATE_CREATION_SHA||
    identity.graphSha256!==PROMOTION_CANDIDATE_GRAPH_SHA256||identity.metadataSha256!==PROMOTION_CANDIDATE_METADATA_SHA256||
    Object.keys(identity.moduleSha256).length!==PROMOTION_CANDIDATE_MODULE_COUNT||
    JSON.stringify(identity.moduleSha256)!==JSON.stringify(Object.fromEntries(Object.entries(TRANSPORT_REMEDIATED_VERSION_MODULE_SHA256).sort(([a],[b])=>a.localeCompare(b)))))
    fail('transport_remediated_promotion_candidate_identity_drift');
  return identity;
}

// Four-Version inventory. Historical Versions stay under their existing contracts (original via stable bindings,
// old attended and Gate C clone via exact stable + beta module bytes); the candidate under its immutable Gate A identity.
export function promotionVersionInventoryDiagnostic({versionIds,originalStable,attended,clone,candidate}={}){
  if(!Array.isArray(versionIds)||versionIds.some(id=>typeof id!=='string'||!UUID.test(id))||new Set(versionIds).size!==versionIds.length)return 'version_inventory_unreadable';
  if(versionIds.length<PROMOTION_EXPECTED_VERSION_IDS.length)return 'version_missing';
  if(versionIds.length>PROMOTION_EXPECTED_VERSION_IDS.length)return 'unexpected_extra_version';
  if(!PROMOTION_EXPECTED_VERSION_IDS.every(id=>versionIds.includes(id)))return 'version_inventory_mismatch';
  try{
    validateLifecycleExperimentInventory({
      versionIds:versionIds.filter(id=>TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS.includes(id)),originalStable,
      attendedStable:attended?.stable,attendedBeta:attended?.beta,cloneVersionId:DEPLOYED_ONE_SHOT_CLONE_VERSION_ID,
      cloneStable:clone?.stable,cloneBeta:clone?.beta,cloneIdentity:buildLifecycleCloneIdentity(DEPLOYED_ONE_SHOT_CLONE_APPROVED_SHA)
    });
  }catch{return 'historical_version_drift';}
  let identity;try{identity=buildPromotionCandidateIdentity();}catch{return 'candidate_identity_unavailable';}
  try{validateTransportRemediatedVersion({stableVersion:candidate?.stable,betaVersion:candidate?.beta,versionId:PROMOTION_CANDIDATE_VERSION_ID,identity});}
  catch(error){return 'candidate_'+String(error?.message||'drift').replace(/^collector_transport_remediated_/,'');}
  return null;
}

// ---- Deployment list. Cloudflare returns the latest (active) Deployment FIRST; never infer order from created_on. ----
export function promotionDeploymentRows(result){
  const rows=Array.isArray(result?.deployments)?result.deployments:Array.isArray(result)?result:null;
  if(!rows)return null;
  const out=[];
  for(const row of rows){
    if(!row||typeof row!=='object'||typeof row.id!=='string'||!row.id||!Array.isArray(row.versions))return null;
    const versions=[];
    for(const entry of row.versions){
      const percentage=Number(entry?.percentage);
      if(!entry||typeof entry.version_id!=='string'||!Number.isFinite(percentage))return null;
      versions.push(safe({versionId:entry.version_id,percentage}));
    }
    out.push(safe({id:row.id,strategy:typeof row.strategy==='string'?row.strategy:null,versions:safe(versions),
      createdOn:typeof row.created_on==='string'?row.created_on:null}));
  }
  if(new Set(out.map(row=>row.id)).size!==out.length)return null;
  return safe(out);
}
const selectsOnly=(row,versionId)=>Boolean(row&&row.strategy==='percentage'&&row.versions.length===1&&row.versions[0].versionId===versionId&&row.versions[0].percentage===100);
export function retainedDeploymentExact(row){return Boolean(row&&row.id===PROMOTION_RETAINED_DEPLOYMENT_ID&&selectsOnly(row,PROMOTION_RETAINED_VERSION_ID));}
export function candidateDeploymentExact(row){
  return Boolean(row&&UUID.test(row.id)&&row.id!==PROMOTION_RETAINED_DEPLOYMENT_ID&&selectsOnly(row,PROMOTION_CANDIDATE_VERSION_ID));
}
// Pre-promotion: exactly one Deployment, the historical one, selecting the old attended Version at 100%.
export function promotionPreStateExact(rows,{retainedCreatedOn}={}){
  return Boolean(Array.isArray(rows)&&rows.length===PROMOTION_PRE_DEPLOYMENT_COUNT&&retainedDeploymentExact(rows[0])&&
    (retainedCreatedOn===undefined||rows[0].createdOn===retainedCreatedOn));
}
// Post-promotion: exactly two rows; the first (active) is a NEW Deployment selecting only the candidate at 100%, and the
// historical Deployment is retained unchanged. No third Deployment.
export function promotionPostStateExact(rows,{retainedCreatedOn}={}){
  return Boolean(Array.isArray(rows)&&rows.length===PROMOTION_POST_DEPLOYMENT_COUNT&&candidateDeploymentExact(rows[0])&&
    retainedDeploymentExact(rows[1])&&(retainedCreatedOn===undefined||rows[1].createdOn===retainedCreatedOn));
}

// ---- Admission (read-only) ----
// The generic lifecycle preflight necessarily STOPs once a Deployment exists; that stale STOP is consumed only against the
// exact observed fields (shared with Gate A). The preflight cannot prove a four-Version inventory, so Gate B proves it itself.
export function promotionAdmissionDiagnostic({report,deploymentRows,versions}={},{approvedSha,accountFingerprint}={}){
  if(!HEX40.test(String(approvedSha||''))||!HEX64.test(String(accountFingerprint||'')))return 'admission_identity_invalid';
  if(report?.ok!==false||report.classification!==DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_STOP||report.reason!==DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_REASON)return 'preflight_not_expected_post_deployment_state';
  const foundation=foundationDiagnostic(report,{approvedSha,accountFingerprint,requireVersionInventory:false});if(foundation)return foundation;
  if(!Array.isArray(deploymentRows))return 'deployment_state_unreadable';
  if(report.inventory.deploymentCount!==deploymentRows.length)return 'deployment_state_inconsistent';
  if(deploymentRows.length===0)return 'deployment_missing';
  if(deploymentRows.length!==PROMOTION_PRE_DEPLOYMENT_COUNT)return 'deployment_count_unexpected';
  if(!promotionPreStateExact(deploymentRows))return 'deployment_identity_unexpected';
  return promotionVersionInventoryDiagnostic(versions);
}

const deploymentSummary=rows=>Array.isArray(rows)?safe(rows.map(row=>safe({id:row.id,strategy:row.strategy,createdOn:row.createdOn,
  versions:safe(row.versions.map(entry=>safe({versionId:entry.versionId,percentage:entry.percentage})))}))):null;
const candidateSummary=()=>safe({versionId:PROMOTION_CANDIDATE_VERSION_ID,creationSha:PROMOTION_CANDIDATE_CREATION_SHA,gateARunId:PROMOTION_GATE_A_RUN_ID,
  graphSha256:PROMOTION_CANDIDATE_GRAPH_SHA256,metadataSha256:PROMOTION_CANDIDATE_METADATA_SHA256,moduleCount:PROMOTION_CANDIDATE_MODULE_COUNT});

export function buildPromotionAdmission({report,deploymentRows,versions,topology,approvedSha,accountFingerprint,topologyFailure=null}={}){
  let reason=promotionAdmissionDiagnostic({report,deploymentRows,versions},{approvedSha,accountFingerprint});
  if(!reason&&topologyFailure)reason='zone_route_topology_unreadable';
  if(!reason&&!validateZoneTopology(topology))reason='zone_route_topology_not_inert';
  const ok=reason===null;
  return safe({
    version:PROMOTION_ADMISSION_VERSION,ok,approvedSha:approvedSha??null,accountFingerprint:accountFingerprint??null,
    workerId:PROMOTION_WORKER_ID,candidate:candidateSummary(),
    retainedDeploymentId:PROMOTION_RETAINED_DEPLOYMENT_ID,retainedVersionId:PROMOTION_RETAINED_VERSION_ID,
    classification:ok?PROMOTION_READY:PROMOTION_ADMISSION_STOP,reason,
    preflightClassification:report?.classification??null,preflightReason:report?.reason??null,
    versionIds:Array.isArray(versions?.versionIds)?safe([...versions.versionIds].sort()):null,versionInventoryExact:ok,
    deployments:deploymentSummary(deploymentRows),
    topology:topology?safe({proof:topology.proof,zoneCount:topology.zoneCount,routeRowCount:topology.routeRowCount,routeCount:topology.routeCount}):null,
    preflight:report??null,retryAuthorized:false,
    evidence:safe({productionMutations:0,apiFootballRequests:0,secretValuesRead:0})
  });
}

export function validatePromotionAdmissionHandoff(admission,{approvedSha,accountFingerprint}={}){
  const invalid=()=>fail('TRANSPORT_REMEDIATED_PROMOTION_ADMISSION_HANDOFF_INVALID');
  if(admission?.version!==PROMOTION_ADMISSION_VERSION||admission.ok!==true||admission.classification!==PROMOTION_READY||admission.reason!==null||
    admission.approvedSha!==approvedSha||admission.accountFingerprint!==accountFingerprint||admission.workerId!==PROMOTION_WORKER_ID||
    JSON.stringify(admission.candidate)!==JSON.stringify(candidateSummary())||admission.retainedDeploymentId!==PROMOTION_RETAINED_DEPLOYMENT_ID||
    admission.retainedVersionId!==PROMOTION_RETAINED_VERSION_ID||admission.versionInventoryExact!==true||
    JSON.stringify(admission.versionIds)!==JSON.stringify([...PROMOTION_EXPECTED_VERSION_IDS].sort())||
    !validateZoneTopology(admission.topology)||admission.retryAuthorized!==false||admission.evidence?.productionMutations!==0||
    admission.evidence?.apiFootballRequests!==0||admission.evidence?.secretValuesRead!==0)invalid();
  const rows=admission.deployments;
  if(!Array.isArray(rows)||!promotionPreStateExact(rows))invalid();
  const report=admission.preflight;
  if(report?.ok!==false||report.classification!==DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_STOP||report.reason!==DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_REASON||
    foundationDiagnostic(report,{approvedSha,accountFingerprint,requireVersionInventory:false})||report.inventory.deploymentCount!==rows.length)invalid();
  return true;
}

// ---- Exact Deployment body: candidate only, 100%, percentage strategy, no force, deterministic sanitized message ----
// v= immutable candidate Version, c= its immutable creation SHA (prefix; the full SHA is pinned above), x= execution main SHA.
export function buildPromotionDeploymentMessage(approvedSha){
  if(!HEX40.test(String(approvedSha||'')))fail('TRANSPORT_REMEDIATED_PROMOTION_APPROVED_SHA_INVALID');
  const message='GateB v='+PROMOTION_CANDIDATE_VERSION_ID+' c='+PROMOTION_CANDIDATE_CREATION_SHA.slice(0,8)+' x='+approvedSha;
  if(message.length>PROMOTION_MESSAGE_MAX_LENGTH)fail('TRANSPORT_REMEDIATED_PROMOTION_MESSAGE_TOO_LONG');
  return message;
}
export function buildPromotionDeploymentBody(approvedSha){
  return safe({strategy:'percentage',versions:safe([safe({version_id:PROMOTION_CANDIDATE_VERSION_ID,percentage:100})]),
    annotations:safe({'workers/message':buildPromotionDeploymentMessage(approvedSha)})});
}
export function serializePromotionDeploymentBody(approvedSha){return JSON.stringify(buildPromotionDeploymentBody(approvedSha));}

// ---- Deployment POST: submitted at most once and NEVER resent. Ambiguity is resolved only by bounded GET readback. ----
// Bounded absence is never proof that an ambiguous POST did not apply: old-only readback stays AMBIGUOUS_OWNER_ATTENTION.
export async function submitPromotionDeployment({post,readDeployments,retainedCreatedOn,wait=async()=>{}}={}){
  if(typeof post!=='function'||typeof readDeployments!=='function')fail('TRANSPORT_REMEDIATED_PROMOTION_OPERATIONS_INVALID');
  let submitted;
  try{submitted=await post();}catch{submitted={kind:'AMBIGUOUS'};}
  if(submitted?.kind==='REJECTED')return safe({outcome:'REJECTED',deploymentId:null,readbackAttempts:0});
  const returned=submitted?.kind==='OK'?promotionDeploymentRows([submitted.result])?.[0]??null:null;
  if(returned&&candidateDeploymentExact(returned))return safe({outcome:'CREATED',deploymentId:returned.id,readbackAttempts:0});
  const returnedId=submitted?.kind==='OK'&&typeof submitted.result?.id==='string'?submitted.result.id:null;
  // An accepted response that names a different Version/split contradicts the request: readback can never clear that.
  const contradicted=returned!==null;
  let readbackAttempts=0;
  for(const delay of PROMOTION_READBACK_DELAYS_MS){
    if(delay>0)await wait(delay);
    readbackAttempts+=1;
    let rows=null;try{rows=await readDeployments();}catch{rows=null;}
    if(!Array.isArray(rows))continue;
    if(promotionPostStateExact(rows,{retainedCreatedOn})){
      if(contradicted||(returnedId!==null&&returnedId!==rows[0].id))return safe({outcome:'AMBIGUOUS_OWNER_ATTENTION',deploymentId:null,readbackAttempts});
      return safe({outcome:'APPLIED_CONFIRMED_BY_READBACK',deploymentId:rows[0].id,readbackAttempts});
    }
    if(promotionPreStateExact(rows,{retainedCreatedOn}))continue;
    // Third Deployment, wrong new Version, historical Deployment missing/changed, split traffic: stop for the owner.
    return safe({outcome:'AMBIGUOUS_OWNER_ATTENTION',deploymentId:null,readbackAttempts});
  }
  return safe({outcome:'AMBIGUOUS_OWNER_ATTENTION',deploymentId:null,readbackAttempts});
}

// ---- Execution evidence (sanitized; no credential, no secret, no raw response) ----
export const PROMOTION_EXECUTION_KEYS=Object.freeze([
  'apiFootballRequests','approvedSha','candidateCreationSha','candidateVersionId','classification','d1Mutations','deploymentId','deploymentMutations',
  'deploymentPostAttempts','diagnostic','domainMutations','finalRouteScan','ok','outcome','previewMutations','productionMutations','readbackAttempts',
  'retryAuthorized','routeMutations','scheduleMutations','secretValuesSerialized','version','versionUploads','workerInvocations','workersDevMutations'
]);
const applied=outcome=>['CREATED','APPLIED_CONFIRMED_BY_READBACK'].includes(outcome);
export function buildPromotionExecutionEvidence({approvedSha=null,outcome='NOT_SUBMITTED',deploymentId=null,readbackAttempts=0,diagnostic=null,finalRouteScan=null,deploymentPostAttempts=0}={}){
  const created=applied(outcome);
  return safe({
    version:PROMOTION_EXECUTION_VERSION,approvedSha,candidateVersionId:PROMOTION_CANDIDATE_VERSION_ID,candidateCreationSha:PROMOTION_CANDIDATE_CREATION_SHA,
    ok:created,
    classification:created?'TRANSPORT_REMEDIATED_DEPLOYMENT_PROMOTION_SUBMITTED_RECONCILIATION_REQUIRED':
      outcome==='NOT_SUBMITTED'?'TRANSPORT_REMEDIATED_DEPLOYMENT_PROMOTION_STOPPED_BEFORE_MUTATION':'TRANSPORT_REMEDIATED_DEPLOYMENT_PROMOTION_NOT_CONFIRMED_RECONCILIATION_REQUIRED',
    diagnostic,outcome,deploymentId:created?deploymentId:null,readbackAttempts,finalRouteScan,
    deploymentPostAttempts,deploymentMutations:deploymentPostAttempts,productionMutations:deploymentPostAttempts,
    versionUploads:0,d1Mutations:0,workersDevMutations:0,previewMutations:0,scheduleMutations:0,routeMutations:0,domainMutations:0,
    workerInvocations:0,apiFootballRequests:0,secretValuesSerialized:0,retryAuthorized:false
  });
}
export function validatePromotionExecutionEvidence(evidence,{approvedSha}={}){
  if(!evidence||typeof evidence!=='object'||JSON.stringify(Object.keys(evidence).sort())!==JSON.stringify([...PROMOTION_EXECUTION_KEYS].sort()))return false;
  if(evidence.version!==PROMOTION_EXECUTION_VERSION||evidence.approvedSha!==approvedSha||evidence.retryAuthorized!==false||
    evidence.candidateVersionId!==PROMOTION_CANDIDATE_VERSION_ID||evidence.candidateCreationSha!==PROMOTION_CANDIDATE_CREATION_SHA)return false;
  if(!PROMOTION_OUTCOMES.includes(evidence.outcome))return false;
  if(![0,1].includes(evidence.deploymentPostAttempts)||evidence.deploymentMutations!==evidence.deploymentPostAttempts||evidence.productionMutations!==evidence.deploymentPostAttempts)return false;
  for(const key of ['versionUploads','d1Mutations','workersDevMutations','previewMutations','scheduleMutations','routeMutations','domainMutations','workerInvocations','apiFootballRequests','secretValuesSerialized'])
    if(evidence[key]!==0)return false;
  if(applied(evidence.outcome)&&(evidence.deploymentPostAttempts!==1||!UUID.test(String(evidence.deploymentId||''))||evidence.deploymentId===PROMOTION_RETAINED_DEPLOYMENT_ID))return false;
  if(!applied(evidence.outcome)&&evidence.deploymentId!==null)return false;
  if((evidence.outcome==='NOT_SUBMITTED')!==(evidence.deploymentPostAttempts===0))return false;
  return true;
}

// ---- Independent post-run classification from read-only state only ----
export function classifyPromotionReconciliation({report,deploymentRows,versions,topology,execution,approvedSha,accountFingerprint}={}){
  const base={version:PROMOTION_RECONCILIATION_VERSION,retryAuthorized:false};
  const stop=reason=>safe({...base,ok:false,classification:PROMOTION_OWNER_ATTENTION,reason,activeDeploymentId:null});
  if(!report||typeof report!=='object'||!report.inventory||!report.runtime||!report.priorState)return stop('preflight_unreadable');
  if(!HEX40.test(String(approvedSha||''))||!HEX64.test(String(accountFingerprint||'')))return stop('reconciliation_identity_invalid');
  const foundation=foundationDiagnostic(report,{approvedSha,accountFingerprint,requireVersionInventory:false});if(foundation)return stop(foundation);
  if(!validateZoneTopology(topology))return stop('route_present_or_unproven');
  if(!Array.isArray(deploymentRows))return stop('deployment_state_unreadable');
  if(report.inventory.deploymentCount!==deploymentRows.length)return stop('deployment_state_inconsistent');
  const inventory=promotionVersionInventoryDiagnostic(versions);if(inventory)return stop(inventory);
  const executionValid=validatePromotionExecutionEvidence(execution,{approvedSha});

  if(promotionPreStateExact(deploymentRows)){
    if(executionValid&&applied(execution.outcome))return stop('execution_claims_promotion_but_none_active');
    if(executionValid&&execution.outcome==='AMBIGUOUS_OWNER_ATTENTION')return stop('promotion_ambiguous_no_new_deployment_observed');
    return safe({...base,ok:false,classification:PROMOTION_CLEAN_STOP,activeDeploymentId:PROMOTION_RETAINED_DEPLOYMENT_ID,
      reason:executionValid?(execution.outcome==='NOT_SUBMITTED'?'stopped_before_promotion':'promotion_rejected'):'execution_evidence_unavailable'});
  }
  if(!promotionPostStateExact(deploymentRows))return stop('deployment_identity_unexpected');
  if(!executionValid)return stop('execution_evidence_unavailable');
  if(execution.deploymentPostAttempts!==1||['REJECTED','NOT_SUBMITTED'].includes(execution.outcome)||
    (execution.deploymentId!==null&&execution.deploymentId!==deploymentRows[0].id))return stop('execution_evidence_inconsistent');
  return safe({...base,ok:true,classification:PROMOTION_PROMOTED_INERT,reason:null,activeDeploymentId:deploymentRows[0].id});
}

// Exported for tests and documentation: the three historical Version IDs retained beside the candidate.
export const PROMOTION_HISTORICAL_VERSION_IDS=Object.freeze([ORIGINAL_BLOCKED_VERSION_ID,ATTENDED_VERSION_ID,DEPLOYED_ONE_SHOT_CLONE_VERSION_ID]);
