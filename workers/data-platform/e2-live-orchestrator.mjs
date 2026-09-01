import {createHash} from 'node:crypto';
import {E2_BODY_PROFILE_TARGETS,buildAffinityPlan,buildAtomicityCase,buildAtomicityReconciliation,buildBodySizeProfile,buildFullWriteReconciliation,buildFullWriteRunStart,buildFullWriteRunStartReconciliation,buildStatementProfile,buildStorageAffinityMutation,buildStorageAffinityReconciliation,buildSyntheticFullWriteAnalogue,buildSyntheticSchemaSetupPlan,classifyAtomicityRows,reconcileFullWrite,reconcileFullWriteRunStart,serializedBodyBytes} from './e2-d1-rest-validation-plan.mjs';
import {validateDisposableIdentity} from './e2-d1-rest-validation-harness.mjs';

const MUTATIONS=new Set(['F-SCHEMA-SETUP','A01','A02','A03','P-STORAGE-WRITE','W00','W01']);
const sha=value=>createHash('sha256').update(value).digest('hex');
const bodyOf=plan=>JSON.stringify(plan.statements.length===1?plan.statements[0]:{batch:plan.statements});
const stop=code=>{const error=new Error(code);error.code=code;throw error;};
const acceptedAtomicity=(caseId,state)=>caseId==='A01'?state==='COMPLETE_SUCCESS':state==='FULL_ROLLBACK';

/** Repository-testable ordering contract. It receives only narrow query and reconciliation ports. */
export async function runE2LiveContract(options){
  const allowed=['sourceSha','approvedSourceSha','runnerIdentity','identity','initialObjects','query','reconcile','startedAt','endedAt'];
  if(!options||Object.keys(options).some(key=>!allowed.includes(key))||typeof options.query!=='function'||typeof options.reconcile!=='function')stop('e2_runner_config_invalid');
  if(!/^[0-9a-f]{40}$/.test(options.sourceSha||'')||options.sourceSha!==options.approvedSourceSha)stop('e2_source_sha_rejected');
  validateDisposableIdentity(options.identity);
  if((options.initialObjects||[]).length)stop('e2_initial_schema_not_empty');
  const dispatches=new Map(),evidence=[];
  const dispatch=async(plan,readOnly=false)=>{
    const count=(dispatches.get(plan.caseId)||0)+1;dispatches.set(plan.caseId,count);
    if(MUTATIONS.has(plan.caseId)&&count>1)stop('e2_mutation_repeat_rejected');
    const raw=bodyOf(plan),begin=Date.now();let outcome;
    try{outcome=await options.query(plan);}catch{outcome={classification:plan.mutation?'AMBIGUOUS':'FAILED'};}
    evidence.push(Object.freeze({evidenceSchemaVersion:'e2c-a-v1',sourceSha:options.sourceSha,runnerIdentity:options.runnerIdentity,testCaseId:plan.caseId,startedAt:options.startedAt||'2026-09-01T00:00:00.000Z',endedAt:options.endedAt||'2026-09-01T00:00:00.000Z',accountFingerprint:options.identity.accountFingerprint.slice(0,4)+'…',databaseName:options.identity.databaseName,databaseFingerprint:options.identity.databaseFingerprint.slice(0,4)+'…',schemaPhase:plan.phase||null,repositoryDdlFingerprint:plan.schemaFingerprint||null,semanticLiveSchemaFingerprint:outcome?.semanticLiveSchemaFingerprint||null,statementCount:plan.statements.length,serializedRequestBytes:serializedBodyBytes(plan),requestSha256:`sha256:${sha(raw)}`,wallDurationMs:Math.max(0,Date.now()-begin),providerTimingMs:Number.isFinite(outcome?.providerTimingMs)?Math.max(0,Math.min(600000,outcome.providerTimingMs)):null,responseClassification:outcome?.classification||'AMBIGUOUS',reconciliationClassification:null,rowsRead:Number(outcome?.rowsRead)||0,rowsWritten:Number(outcome?.rowsWritten)||0,changes:Number(outcome?.changes)||0,syntheticTableCounts:outcome?.syntheticTableCounts||null,dispatchCount:count,cleanupState:'NOT_PERFORMED_BY_E2C_A'}));
    return outcome||{classification:'AMBIGUOUS'};
  };
  const reconcile=async plan=>options.reconcile(plan);
  const setup=await dispatch(buildSyntheticSchemaSetupPlan());if(setup.classification!=='SUCCESS')stop('e2_setup_failed');
  if(!(await reconcile({caseId:'SCHEMA-RECONCILE'}))?.accepted)stop('e2_setup_reconciliation_failed');
  if((await dispatch(buildAffinityPlan(),true)).classification!=='SUCCESS')stop('e2_affinity_failed');
  for(const count of [1,10,24,35,40])if((await dispatch(buildStatementProfile(count),true)).classification!=='SUCCESS')stop('e2_statement_profile_failed');
  for(const bytes of E2_BODY_PROFILE_TARGETS)if((await dispatch(buildBodySizeProfile(bytes),true)).classification!=='SUCCESS')stop('e2_body_profile_failed');
  for(const caseId of ['A01','A02','A03']){
    const mutation=await dispatch(buildAtomicityCase(caseId));const rows=(await reconcile(buildAtomicityReconciliation(caseId)))?.rows;
    if(mutation.classification!=='SUCCESS')stop(`e2_${caseId.toLowerCase()}_ambiguous`);
    const state=classifyAtomicityRows(rows);if(!acceptedAtomicity(caseId,state))stop(`e2_${caseId.toLowerCase()}_${state.toLowerCase()}`);
  }
  if((await dispatch(buildStorageAffinityMutation())).classification!=='SUCCESS')stop('e2_storage_affinity_ambiguous');if(!(await reconcile(buildStorageAffinityReconciliation()))?.accepted)stop('e2_storage_affinity_reconciliation_failed');
  const start=await dispatch(buildFullWriteRunStart());const w00=await reconcile(buildFullWriteRunStartReconciliation());if(start.classification!=='SUCCESS'||!reconcileFullWriteRunStart(w00?.rows))stop('e2_w00_reconciliation_failed');
  const w01=await dispatch(buildSyntheticFullWriteAnalogue());const final=await reconcile(buildFullWriteReconciliation());if(!reconcileFullWrite(final?.rows,w01?.completionChanges))stop('e2_w01_reconciliation_failed');
  return Object.freeze({state:'STOP',evidence:Object.freeze(evidence),dispatchCounts:Object.freeze(Object.fromEntries(dispatches))});
}
