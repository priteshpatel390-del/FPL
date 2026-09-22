export const ATTENDED_ACCEPTANCE_CONTRACT_VERSION='api-football-attended-acceptance-v1';
export const ATTENDED_RUNTIME_ACTIONS=Object.freeze([
  'ENABLE_COLLECTION','INVOKE_ONCE','DISABLE_COLLECTION','RECONCILE'
]);
export const ATTENDED_CONTROL_MAX_D1_CALLS=2;
export const ATTENDED_CONTROL_MAX_D1_STATEMENTS=2;
export const ATTENDED_CONTROL_MAX_ROWS_CHANGED=2;
export const ATTENDED_CREDENTIAL_PREPARATION_MAX_D1_CALLS=1;
export const ATTENDED_CREDENTIAL_PREPARATION_MAX_D1_STATEMENTS=1;
export const ATTENDED_CREDENTIAL_PREPARATION_MAX_ROWS_CHANGED=1;
export const ATTENDED_CREDENTIAL_CLEANUP_MAX_D1_CALLS=1;
const safe=value=>Object.freeze(value);
const fail=reason=>safe({ok:false,reason});

export function runtimeMutationContract(action){
  const contracts={
    ENABLE_COLLECTION:{sql:"UPDATE api_football_runtime_state SET collection_enabled=1 WHERE provider='api-football' AND collection_enabled=0 AND credential_state='AVAILABLE' AND in_flight_attempt_id IS NULL",expectedChanges:1},
    DISABLE_COLLECTION:{sql:"UPDATE api_football_runtime_state SET collection_enabled=0 WHERE provider='api-football' AND collection_enabled=1",expectedChanges:1}
  };
  return contracts[action]?safe(contracts[action]):fail('attended_runtime_action_invalid');
}

export function credentialLifecycleMutation(action,evidence={}){
  if(evidence.collectionEnabled!==0||evidence.activeLease!==false)return fail('attended_credential_lifecycle_precondition_failed');
  if(action==='MARK_AVAILABLE'){
    if(evidence.versionInventoryExact!==true||evidence.secretBearingVersionPresent!==true)return fail('attended_secret_binding_not_proven');
    return safe({sql:"UPDATE api_football_runtime_state SET credential_state='AVAILABLE' WHERE provider='api-football' AND collection_enabled=0 AND credential_state='UNPROVISIONED' AND in_flight_attempt_id IS NULL",expectedChanges:1,maxD1Calls:ATTENDED_CREDENTIAL_PREPARATION_MAX_D1_CALLS,maxD1Statements:ATTENDED_CREDENTIAL_PREPARATION_MAX_D1_STATEMENTS,maxRowsChanged:ATTENDED_CREDENTIAL_PREPARATION_MAX_ROWS_CHANGED});
  }
  if(action==='RESET_UNPROVISIONED'){
    if(evidence.secretBearingVersionPresent!==false)return fail('attended_secret_removal_not_proven');
    return safe({sql:"UPDATE api_football_runtime_state SET credential_state='UNPROVISIONED' WHERE provider='api-football' AND collection_enabled=0 AND credential_state IN ('AVAILABLE','INVALID') AND in_flight_attempt_id IS NULL",expectedChanges:1,maxD1Calls:ATTENDED_CREDENTIAL_CLEANUP_MAX_D1_CALLS});
  }
  return fail('attended_credential_lifecycle_action_invalid');
}

export function validateAttendedAdmission(report,{versionId}={}){
  if(report?.ok!==true||report.stage!=='ATTENDED_ACCEPTANCE'||report.classification!=='READY_FOR_SEPARATELY_APPROVED_ATTENDED_ACCEPTANCE')return fail('attended_admission_not_ready');
  if(typeof versionId!=='string'||!versionId||report.inventory?.reviewedVersionId!==versionId||report.inventory?.versionIdentityExact!==true)return fail('attended_version_identity_unproven');
  if(report.runtime?.collectionEnabled!==0||report.runtime?.credentialState!=='AVAILABLE'||report.runtime?.activeLease!==false)return fail('attended_runtime_not_disabled');
  if(report.evidence?.productionMutations!==0||report.evidence?.apiFootballRequests!==0||report.evidence?.secretValuesRead!==0)return fail('attended_admission_not_read_only');
  return safe({ok:true});
}

export function classifyAcceptanceReconciliation(state){
  if(!state||state.collectionEnabled!==0||state.activeLease!==false)return fail('cleanup_or_lease_reconciliation_required');
  if(state.attempt2Count!==0)return fail('attempt_two_detected');
  if(state.requestAttempts===5&&state.succeededAttempts===5&&state.attemptOneCount===5&&state.generations===1&&
    state.committedGenerations===1&&state.headMatchesGeneration===true&&Number.isInteger(state.fixtureRevisions)&&
    state.fixtureRevisions>=0&&state.fixtureRevisions<=2500&&state.rawPayloadRows===0&&state.modelUiImportCount===0){
    return safe({ok:true,classification:'ATTENDED_ACCEPTANCE_SUCCEEDED'});
  }
  return safe({ok:false,reason:'attended_acceptance_requires_reconciliation',retryAuthorized:false});
}

export async function runAttendedAcceptance({admission,versionId,enablePreview,enableCollection,invokeOnce,disableCollection,disablePreview}={}){
  const admitted=validateAttendedAdmission(admission,{versionId});if(!admitted.ok)return admitted;
  if([enablePreview,enableCollection,invokeOnce,disableCollection,disablePreview].some(operation=>typeof operation!=='function'))return fail('attended_operations_incomplete');
  let invocation=null,error=null;
  try{
    await enablePreview(versionId);
    await enableCollection();
    invocation=await invokeOnce(versionId);
    if(!invocation||invocation.requestCount!==1||invocation.outcome!=='ACCEPTED')throw new Error('attended_invocation_ambiguous');
  }catch(caught){error=caught;}
  try{await disableCollection();}catch(caught){error=error||caught;}
  try{await disablePreview();}catch(caught){error=error||caught;}
  if(error)return safe({ok:false,classification:'ATTENDED_EXECUTION_RECONCILIATION_REQUIRED',reason:'attended_execution_requires_reconciliation',retryAuthorized:false,invocationAttempted:invocation!==null});
  return safe({ok:true,classification:'ATTENDED_INVOCATION_COMPLETE_RECONCILIATION_REQUIRED',retryAuthorized:false,requestCount:1});
}
