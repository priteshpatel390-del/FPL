// Gate C: pure, fail-closed contracts for one NEW-DAY shadow discovery using the already promoted immutable Version.
// Repository-only. Never use historical Gate C clone or consumed continuation as invocation authority.
import {foundationDiagnostic,TRANSPORT_REMEDIATED_CONSUMED_HISTORY} from './transport-remediated-version-preparation.mjs';
import {promotionPostStateExact,promotionVersionInventoryDiagnostic,PROMOTION_CANDIDATE_VERSION_ID,PROMOTION_CANDIDATE_CREATION_SHA,
  PROMOTION_RETAINED_DEPLOYMENT_ID,PROMOTION_WORKER_ID,PROMOTION_EXPECTED_VERSION_IDS} from './transport-remediated-deployment-promotion.mjs';
import {validateZoneTopology,DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_STOP,DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_REASON} from './deployed-one-shot.mjs';

export const GATE_C_ADMISSION_VERSION='api-football-gate-c-admission-v1';
export const GATE_C_EXECUTION_VERSION='api-football-gate-c-execution-v1';
export const GATE_C_RECONCILIATION_VERSION='api-football-gate-c-reconciliation-v1';
export const GATE_C_READY='READY_FOR_GATE_C_NEW_DAY_COLLECTION';
export const GATE_C_SUCCESS='GATE_C_NEW_DAY_SHADOW_GENERATION_COMMITTED_INERT';
export const GATE_C_STOP='STOP_GATE_C_ADMISSION_REVIEW_REQUIRED';
export const GATE_C_OWNER_ATTENTION='GATE_C_OWNER_ATTENTION_REQUIRED';
export const GATE_C_CLEAN_STOP='GATE_C_CLEAN_STOP_NO_NEW_COLLECTION';
export const GATE_C_ACTIVE_DEPLOYMENT_ID='9b48b57a-e505-4213-9547-fe44835a9bdb';
export const GATE_C_EARLIEST_UTC_DAY='2026-10-08';
export const GATE_C_MAX_PROVIDER_REQUESTS=5;
export const GATE_C_MAX_TRIGGER_REQUESTS=1;
export const GATE_C_MUTATION_CEILINGS=Object.freeze({deploymentPost:0,versionUpload:0,workersDevEnable:1,workersDevDisable:1,controlD1Calls:2,triggerPost:1,preview:0,cron:0,routes:0,domains:0});
const safe=x=>Object.freeze(x);
const hex40=x=>typeof x==='string'&&/^[0-9a-f]{40}$/.test(x);
const hex64=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const keys=Object.keys(TRANSPORT_REMEDIATED_CONSUMED_HISTORY);
const nonNegative=x=>Number.isSafeInteger(x)&&x>=0;

export function gateCHistoryDiagnostic(history,{phase='admission'}={}){
  if(!history||typeof history!=='object'||keys.some(key=>!nonNegative(history[key])))return 'history_unreadable';
  if(phase==='admission'){
    if(keys.some(key=>history[key]!==TRANSPORT_REMEDIATED_CONSUMED_HISTORY[key]))return 'consumed_history_drift';
    return null;
  }
  if(phase!=='reconciliation')return 'phase_invalid';
  if(history.attempt2Count!==0||history.transportUnknownCount!==1||history.failedGenerationCount!==1||
    history.authFailureCount!==0||history.quotaBlockedCount!==0||history.timeoutCount!==0||
    history.schemaFailureCount!==0||history.httpFailureCount!==0||history.persistenceUncertainCount!==0||
    history.completionUncertainCount!==0||history.reservedAttemptCount!==0||history.stagingGenerationCount!==0)return 'history_unsafe_or_failed';
  if(history.requestAttempts!==6||history.attempt1Count!==6||history.succeededAttemptCount!==5||
    history.generations!==2||history.committedGenerationCount!==1||
    history.membershipConsistentCount!==1||history.headMatchCount!==1||
    history.fixtureRevisions>2500)return 'new_generation_not_exactly_committed';
  return null;
}

// foundationDiagnostic retains the original consumed-history contract for Gates A/B. We test actual
// Gate C history FIRST, then replace that single dimension only to reuse all other strict foundation
// checks without widening any historical gate.
function foundational(report,identity,phase){
  const history=gateCHistoryDiagnostic(report?.priorState,{phase});
  if(history)return history;
  return foundationDiagnostic({...report,priorState:TRANSPORT_REMEDIATED_CONSUMED_HISTORY},
    {...identity,requireVersionInventory:false});
}
export function gateCDeploymentDiagnostic(rows,report){
  if(!Array.isArray(rows)||!promotionPostStateExact(rows)||rows[0]?.id!==GATE_C_ACTIVE_DEPLOYMENT_ID||
    rows[1]?.id!==PROMOTION_RETAINED_DEPLOYMENT_ID)return 'promoted_deployment_drift';
  if(report?.inventory?.deploymentCount!==2)return 'deployment_count_mismatch';
  return null;
}
export function gateCDayLedgerDiagnostic(ledger,{phase='admission',utcDay}={}){
  if(!ledger||ledger.utcDay!==utcDay||!/^\\d{4}-\\d{2}-\\d{2}$/.test(String(utcDay||'')))return 'day_ledger_unavailable';
  for(const field of ['attempts','succeeded','attempt2','generations','committed','headMatches'])
    if(!nonNegative(ledger[field]))return 'day_ledger_unreadable';
  if(phase==='admission'){
    if(['attempts','succeeded','attempt2','generations','committed','headMatches'].some(field=>ledger[field]!==0))
      return 'new_day_already_consumed';
  }else if(phase==='reconciliation'){
    if(ledger.attempts!==5||ledger.succeeded!==5||ledger.attempt2!==0||
      ledger.generations!==1||ledger.committed!==1||ledger.headMatches!==1)return 'day_generation_not_exactly_committed';
  }else return 'day_phase_invalid';
  return null;
}
export function gateCAdmissionDiagnostic({report,deploymentRows,versions,topology,approvedSha,accountFingerprint,utcDay,dayLedger}={}){
  if(!hex40(approvedSha)||!hex64(accountFingerprint))return 'execution_identity_invalid';
  if(typeof utcDay!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(utcDay)||utcDay<GATE_C_EARLIEST_UTC_DAY)return 'new_utc_day_not_approved';
  if(report?.ok!==false||report.classification!==DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_STOP||
    report.reason!==DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_REASON)return 'preflight_unexpected';
  const basis=foundational(report,{approvedSha,accountFingerprint},'admission');if(basis)return basis;
  const deployment=gateCDeploymentDiagnostic(deploymentRows,report);if(deployment)return deployment;
  const inventory=promotionVersionInventoryDiagnostic(versions);if(inventory)return inventory;
  if(!validateZoneTopology(topology))return 'route_present_or_unproven';
  const day=gateCDayLedgerDiagnostic(dayLedger,{phase:'admission',utcDay});if(day)return day;
  return null;
}
export function buildGateCAdmission(input={}){
  const reason=gateCAdmissionDiagnostic(input);
  const ok=reason===null;
  return safe({
    version:GATE_C_ADMISSION_VERSION,ok,classification:ok?GATE_C_READY:GATE_C_STOP,reason,
    approvedSha:input.approvedSha??null,accountFingerprint:input.accountFingerprint??null,utcDay:input.utcDay??null,
    workerId:PROMOTION_WORKER_ID,versionId:PROMOTION_CANDIDATE_VERSION_ID,versionCreationSha:PROMOTION_CANDIDATE_CREATION_SHA,
    deploymentId:GATE_C_ACTIVE_DEPLOYMENT_ID,
    versionIds:Array.isArray(input.versions?.versionIds)?safe([...input.versions.versionIds].sort()):null,
    deployments:Array.isArray(input.deploymentRows)?safe(input.deploymentRows):null,
    topology:input.topology??null,dayLedger:input.dayLedger??null,preflight:input.report??null,retryAuthorized:false,
    evidence:safe({productionMutations:0,apiFootballRequests:0,secretValuesRead:0})
  });
}
export function validateGateCAdmissionHandoff(admission,{approvedSha,accountFingerprint,utcDay}={}){
  if(admission?.version!==GATE_C_ADMISSION_VERSION||admission.ok!==true||admission.classification!==GATE_C_READY||
    admission.reason!==null||admission.approvedSha!==approvedSha||admission.accountFingerprint!==accountFingerprint||
    admission.utcDay!==utcDay||admission.workerId!==PROMOTION_WORKER_ID||admission.versionId!==PROMOTION_CANDIDATE_VERSION_ID||
    admission.versionCreationSha!==PROMOTION_CANDIDATE_CREATION_SHA||admission.deploymentId!==GATE_C_ACTIVE_DEPLOYMENT_ID||
    JSON.stringify(admission.versionIds)!==JSON.stringify([...PROMOTION_EXPECTED_VERSION_IDS].sort())||
    gateCDeploymentDiagnostic(admission.deployments,admission.preflight)||
    foundational(admission.preflight,{approvedSha,accountFingerprint},'admission')||
    !validateZoneTopology(admission.topology)||gateCDayLedgerDiagnostic(admission.dayLedger,{phase:'admission',utcDay})||admission.retryAuthorized!==false||
    admission.evidence?.productionMutations!==0||admission.evidence?.apiFootballRequests!==0||admission.evidence?.secretValuesRead!==0)
    throw new Error('GATE_C_ADMISSION_HANDOFF_INVALID');
  return true;
}
export function classifyGateCReconciliation({report,deploymentRows,versions,topology,execution,approvedSha,accountFingerprint,admission,dayLedger}={}){
  const base={version:GATE_C_RECONCILIATION_VERSION,retryAuthorized:false};
  const stop=reason=>safe({...base,ok:false,classification:GATE_C_OWNER_ATTENTION,reason});
  if(!hex40(approvedSha)||!hex64(accountFingerprint))return stop('execution_identity_invalid');
  if(!admission||admission.approvedSha!==approvedSha||admission.accountFingerprint!==accountFingerprint||
    admission.classification!==GATE_C_READY)return stop('admission_missing');
  if(!report?.inventory||!report?.runtime||!report?.priorState)return stop('preflight_unreadable');
  const dep=gateCDeploymentDiagnostic(deploymentRows,report);if(dep)return stop(dep);
  const inventory=promotionVersionInventoryDiagnostic(versions);if(inventory)return stop(inventory);
  if(!validateZoneTopology(topology))return stop('route_present_or_unproven');
  const history=report.priorState;
  const day=gateCDayLedgerDiagnostic(dayLedger,{phase:'reconciliation',utcDay:admission.utcDay});
  const executionValid=execution?.version===GATE_C_EXECUTION_VERSION&&execution.approvedSha===approvedSha&&
    execution.versionId===PROMOTION_CANDIDATE_VERSION_ID&&execution.deployment?.deploymentId===GATE_C_ACTIVE_DEPLOYMENT_ID&&
    execution.mutations?.createDeployment===0&&execution.triggerRequests===1&&execution.retryAuthorized===false&&
    execution.evidence?.apiFootballRequestsByExecutor===0&&execution.evidence?.secretValuesSerialized===0;
  const gateCGeneration=gateCHistoryDiagnostic(history,{phase:'reconciliation'});
  if(gateCGeneration){
    const clean=gateCHistoryDiagnostic(history,{phase:'admission'})===null&&
      gateCDayLedgerDiagnostic(dayLedger,{phase:'admission',utcDay:admission.utcDay})===null&&
      foundationDiagnostic({...report,priorState:TRANSPORT_REMEDIATED_CONSUMED_HISTORY},
        {approvedSha,accountFingerprint,requireVersionInventory:false})===null;
    return clean?safe({...base,ok:false,classification:GATE_C_CLEAN_STOP,reason:'no_new_generation',triggerRequests:execution?.triggerRequests??null}):stop(gateCGeneration);
  }
  if(day)return stop(day);
  const basis=foundational(report,{approvedSha,accountFingerprint},'reconciliation');if(basis)return stop(basis);
  if(!executionValid||execution.ok!==true||execution.cleanup?.collectionDisable?.outcome!=='SUCCEEDED'||
    execution.cleanup?.workersDevDisable?.outcome!=='SUCCEEDED'||execution.controlBudget?.d1Calls>2||
    execution.mutations?.enableWorkersDev!==1||execution.mutations?.disableWorkersDev!==1)
    return stop('execution_evidence_inconsistent');
  return safe({...base,ok:true,classification:GATE_C_SUCCESS,reason:null,
    deploymentId:GATE_C_ACTIVE_DEPLOYMENT_ID,providerRequests:GATE_C_MAX_PROVIDER_REQUESTS,
    committedGenerationCount:1,fixtureRevisions:history.fixtureRevisions});
}
