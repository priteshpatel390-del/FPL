import {createHash} from 'node:crypto';
import {E2_BODY_PROFILE_TARGETS,buildAffinityPlan,buildAtomicityCase,buildAtomicityReconciliation,buildBodySizeProfile,buildFullWriteReconciliation,buildFullWriteRunStart,buildFullWriteRunStartReconciliation,buildSchemaInspectionPlan,buildStatementProfile,buildStorageAffinityMutation,buildStorageAffinityReconciliation,buildSyntheticFullWriteAnalogue,buildSyntheticSchemaSetupPlan,classifyAtomicityRows,reconcileFullWrite,reconcileFullWriteRunStart,serializedBodyBytes} from './e2-d1-rest-validation-plan.mjs';
import {validateDisposableIdentity} from './e2-d1-rest-validation-harness.mjs';
import {assembleE2SchemaMetadata,validateInitialLiveObjects,validateSetupLiveSchema} from './e2-live-schema-contract.mjs';
import {createE2LiveHttpAdapter} from './e2-live-http-adapter.mjs';
import {E2_LIVE_RESPONSE_CLASS} from './e2-live-response-decoder.mjs';

export {E2_LIVE_RESPONSE_CLASS};
export const E2_RECONCILIATION_CLASS=Object.freeze(['INITIAL','COMPLETE_SETUP','PARTIAL_OR_DRIFTED','FULL_ROLLBACK','PARTIAL_WRITE','COMPLETE_SUCCESS','STARTED','COMPLETED','ABSENT','AMBIGUOUS']);
const RESPONSE_SET=new Set(Object.values(E2_LIVE_RESPONSE_CLASS)),RECONCILIATION_SET=new Set(E2_RECONCILIATION_CLASS);
const MUTATIONS=new Set(['F-SCHEMA-SETUP','A01','A02','A03','P-STORAGE-WRITE','W00','W01']);
const COUNT_KEYS=Object.freeze(['e2_atomicity','e2_entities','e2_observations','e2_heads','e2_runs']);
const sha=value=>createHash('sha256').update(value).digest('hex');
const bodyOf=plan=>JSON.stringify(plan.statements.length===1?plan.statements[0]:{batch:plan.statements});
const boundedInteger=(value,max=1000000)=>Number.isSafeInteger(value)&&value>=0&&value<=max?value:null;
const boundedCounts=value=>{if(value===null||value===undefined)return null;if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!COUNT_KEYS.includes(key))||Object.values(value).some(count=>!Number.isSafeInteger(count)||count<0||count>1000000))return null;return Object.freeze(Object.fromEntries(Object.entries(value)));};
const runner=value=>{if(typeof value!=='string'||!/^[A-Za-z0-9._:-]{1,64}$/.test(value))throw Object.assign(new Error('e2_runner_identity_invalid'),{code:'e2_runner_identity_invalid'});return value;};
const timestamp=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)||new Date(value).toISOString()!==value)throw Object.assign(new Error('e2_evidence_timestamp_invalid'),{code:'e2_evidence_timestamp_invalid'});return value;};
const ambiguous=classification=>![E2_LIVE_RESPONSE_CLASS.SUCCESS,E2_LIVE_RESPONSE_CLASS.SQL_FAILURE].includes(classification);
const exactKeys=(row,keys)=>row&&typeof row==='object'&&!Array.isArray(row)&&Object.keys(row).length===keys.length&&keys.every(key=>Object.hasOwn(row,key));
const same=(actual,expected)=>Object.is(actual,expected)||(typeof actual==='number'&&typeof expected==='number'&&actual===expected);
export function validateE2AffinityRows(rowsByStatement){
  if(!Array.isArray(rowsByStatement)||rowsByStatement.length!==11)return false;
  const direct=['42','3.125','0042','0','1','2026-09-01T12:34:56.000Z','{"safe":true}','true','false'];
  const numeric=[42,3.125,42,0,1,2026,0,0,0],types=['integer','real','integer','integer','integer','integer','integer','integer','integer'];
  const keys=['bound_type','exact_value','numeric_value','numeric_type','text_equal','numeric_equal'];
  for(let index=0;index<direct.length;index++){const rows=rowsByStatement[index];if(!Array.isArray(rows)||rows.length!==1||!exactKeys(rows[0],keys))return false;const row=rows[0];if(row.bound_type!=='text'||row.exact_value!==direct[index]||!same(row.numeric_value,numeric[index])||row.numeric_type!==types[index]||row.text_equal!==1||row.numeric_equal!==1)return false;}
  const ordering=rowsByStatement[9];if(!Array.isArray(ordering)||ordering.length!==1||!exactKeys(ordering[0],['left_value','right_value','text_order','numeric_order'])||ordering[0].left_value!=='0042'||ordering[0].right_value!=='42'||ordering[0].text_order!==1||ordering[0].numeric_order!==0)return false;
  const expected=[['integer','integer','integer',42],['real','real','real',3.125],['string','text','text','0042'],['boolean','true','integer',1],['null','null','null',null]],json=rowsByStatement[10];
  return Array.isArray(json)&&json.length===5&&json.every((row,index)=>exactKeys(row,['kind','json_value_type','sqlite_value_type','exact_value'])&&[row.kind,row.json_value_type,row.sqlite_value_type,row.exact_value].every((value,key)=>same(value,expected[index][key])));
}
export function validateE2StorageAffinityRows(rows){const expected=[{observation_id:'e2-affinity-0042',number_type:'real',value_number:42,text_type:'text',value_text:'0042'},{observation_id:'e2-affinity-42',number_type:'real',value_number:42,text_type:'text',value_text:'42'}];const keys=['observation_id','number_type','value_number','text_type','value_text'];return Array.isArray(rows)&&rows.length===2&&rows.every((row,index)=>exactKeys(row,keys)&&keys.every(key=>same(row[key],expected[index][key])));}
export function finalizeE2Evidence(evidence,endedAt){
  const end=timestamp(endedAt);if(!Array.isArray(evidence))throw Object.assign(new Error('e2_evidence_invalid'),{code:'e2_evidence_invalid'});
  return Object.freeze(evidence.map(item=>{if(!item||typeof item!=='object'||Array.isArray(item)||Object.hasOwn(item,'endedAt')||Date.parse(end)<Date.parse(timestamp(item.startedAt)))throw Object.assign(new Error('e2_evidence_timestamp_invalid'),{code:'e2_evidence_timestamp_invalid'});return Object.freeze({...item,endedAt:end});}));
}

/** Repository-testable ordering contract. It receives only narrow query and reconciliation ports. */
export async function runE2LiveContract(options){
  const allowed=['sourceSha','approvedSourceSha','runnerIdentity','identity','initialObjects','query','reconcile','startedAt'];
  const evidence=[],dispatches=new Map();
  const stop=code=>{const error=new Error(code);error.code=code;error.evidence=Object.freeze(evidence.map(item=>Object.freeze({...item})));throw error;};
  if(!options||Object.keys(options).some(key=>!allowed.includes(key))||typeof options.query!=='function'||typeof options.reconcile!=='function')stop('e2_runner_config_invalid');
  const runnerIdentity=runner(options.runnerIdentity);
  const startedAt=timestamp(options.startedAt);
  if(!/^[0-9a-f]{40}$/.test(options.sourceSha||'')||options.sourceSha!==options.approvedSourceSha)stop('e2_source_sha_rejected');
  validateDisposableIdentity(options.identity);if((options.initialObjects||[]).length)stop('e2_initial_schema_not_empty');
  const dispatch=async plan=>{
    const count=(dispatches.get(plan.caseId)||0)+1;dispatches.set(plan.caseId,count);if(MUTATIONS.has(plan.caseId)&&count>1)stop('e2_mutation_repeat_rejected');
    const raw=bodyOf(plan),begin=Date.now();let outcome;try{outcome=await options.query(plan);}catch{outcome={classification:plan.mutation?E2_LIVE_RESPONSE_CLASS.UNKNOWN:E2_LIVE_RESPONSE_CLASS.TRANSPORT};}
    const classification=RESPONSE_SET.has(outcome?.classification)?outcome.classification:(plan.mutation?E2_LIVE_RESPONSE_CLASS.UNKNOWN:E2_LIVE_RESPONSE_CLASS.MALFORMED);
    const item={evidenceSchemaVersion:'e2c-b-v1',sourceSha:options.sourceSha,runnerIdentity,testCaseId:plan.caseId,startedAt,accountFingerprint:options.identity.accountFingerprint.slice(0,4)+'…',databaseName:options.identity.databaseName,databaseFingerprint:options.identity.databaseFingerprint.slice(0,4)+'…',schemaPhase:plan.phase||null,repositoryDdlFingerprint:plan.schemaFingerprint||null,semanticLiveSchemaFingerprint:typeof outcome?.semanticLiveSchemaFingerprint==='string'&&/^sha256:[0-9a-f]{64}$/.test(outcome.semanticLiveSchemaFingerprint)?outcome.semanticLiveSchemaFingerprint:null,statementCount:plan.statements.length,serializedRequestBytes:serializedBodyBytes(plan),requestSha256:`sha256:${sha(raw)}`,wallDurationMs:boundedInteger(Math.max(0,Date.now()-begin),600000),providerTimingMs:boundedInteger(outcome?.providerTimingMs,600000),totalAttempts:boundedInteger(outcome?.totalAttempts),responseClassification:classification,reconciliationClassification:null,rowsRead:boundedInteger(outcome?.rowsRead),rowsWritten:boundedInteger(outcome?.rowsWritten),changes:boundedInteger(outcome?.changes),syntheticTableCounts:boundedCounts(outcome?.syntheticTableCounts),dispatchCount:count,cleanupState:'NOT_PERFORMED_BY_E2C_B'};evidence.push(item);return {classification,outcome,item};
  };
  const reconcile=async(plan,item,derive)=>{let result;try{result=await options.reconcile(plan);}catch{result=null;}const classification=derive?derive(result):RECONCILIATION_SET.has(result?.classification)?result.classification:'AMBIGUOUS';item.reconciliationClassification=RECONCILIATION_SET.has(classification)?classification:'AMBIGUOUS';return result;};
  const mutationStage=async(plan,reconciliationPlan,derive)=>{const mutation=await dispatch(plan);const state=await reconcile(reconciliationPlan,mutation.item,result=>derive(result,mutation.outcome));if(ambiguous(mutation.classification))stop(`e2_${plan.caseId.toLowerCase()}_ambiguous`);return {...mutation,state,reconciliation:mutation.item.reconciliationClassification};};

  const classifySchema=result=>{try{if(Array.isArray(result?.metadata)){validateSetupLiveSchema(result.metadata);return 'COMPLETE_SETUP';}if(Array.isArray(result?.objects)){validateInitialLiveObjects(result.objects);return 'INITIAL';}}catch{return 'PARTIAL_OR_DRIFTED';}return 'AMBIGUOUS';};
  const setup=await mutationStage(buildSyntheticSchemaSetupPlan(),buildSchemaInspectionPlan(),classifySchema);if(setup.classification!==E2_LIVE_RESPONSE_CLASS.SUCCESS||setup.reconciliation!=='COMPLETE_SETUP')stop('e2_setup_failed');
  const affinity=await dispatch(buildAffinityPlan());if(affinity.classification!==E2_LIVE_RESPONSE_CLASS.SUCCESS||!validateE2AffinityRows(affinity.outcome?.rowsByStatement))stop('e2_affinity_failed');
  for(const count of [1,10,24,35,40])if((await dispatch(buildStatementProfile(count))).classification!==E2_LIVE_RESPONSE_CLASS.SUCCESS)stop('e2_statement_profile_failed');
  for(const bytes of E2_BODY_PROFILE_TARGETS)if((await dispatch(buildBodySizeProfile(bytes))).classification!==E2_LIVE_RESPONSE_CLASS.SUCCESS)stop('e2_body_profile_failed');
  for(const caseId of ['A01','A02','A03']){const stage=await mutationStage(buildAtomicityCase(caseId),buildAtomicityReconciliation(caseId),result=>classifyAtomicityRows(result?.rows));const expectedResponse=caseId==='A01'?E2_LIVE_RESPONSE_CLASS.SUCCESS:E2_LIVE_RESPONSE_CLASS.SQL_FAILURE;const expectedState=caseId==='A01'?'COMPLETE_SUCCESS':'FULL_ROLLBACK';if(stage.classification!==expectedResponse||stage.reconciliation!==expectedState)stop(`e2_${caseId.toLowerCase()}_rejected`);}
  const storage=await mutationStage(buildStorageAffinityMutation(),buildStorageAffinityReconciliation(),result=>result?.classification==='COMPLETE_SUCCESS'&&validateE2StorageAffinityRows(result?.rows)?'COMPLETE_SUCCESS':'PARTIAL_OR_DRIFTED');if(storage.classification!==E2_LIVE_RESPONSE_CLASS.SUCCESS||storage.reconciliation!=='COMPLETE_SUCCESS')stop('e2_storage_affinity_reconciliation_failed');
  const w00=await mutationStage(buildFullWriteRunStart(),buildFullWriteRunStartReconciliation(),result=>reconcileFullWriteRunStart(result?.rows)?'STARTED':Array.isArray(result?.rows)?'ABSENT':'AMBIGUOUS');if(w00.classification!==E2_LIVE_RESPONSE_CLASS.SUCCESS||w00.reconciliation!=='STARTED')stop('e2_w00_reconciliation_failed');
  const w01=await mutationStage(buildSyntheticFullWriteAnalogue(),buildFullWriteReconciliation(),(result,outcome)=>reconcileFullWrite(result?.rows,outcome?.completionChanges)?'COMPLETED':'AMBIGUOUS');if(w01.classification!==E2_LIVE_RESPONSE_CLASS.SUCCESS||w01.reconciliation!=='COMPLETED')stop('e2_w01_reconciliation_failed');
  return Object.freeze({state:'STOP',evidence:Object.freeze(evidence.map(item=>Object.freeze({...item}))),dispatchCounts:Object.freeze(Object.fromEntries(dispatches))});
}

/** Closed future composition: callers provide authority/fetch inputs, never SQL, bodies or classifications. */
export async function runE2LiveHttpContract(options){
  const {accountId,databaseId,token,fetchImpl,identity,...runOptions}=options||{};const adapter=createE2LiveHttpAdapter({accountId,databaseId,token,fetchImpl,identity});
  const reconcile=async plan=>{const decoded=await adapter.execute(plan);if(decoded.classification!==E2_LIVE_RESPONSE_CLASS.SUCCESS)return {};
    if(plan.caseId==='SCHEMA-RECONCILE')return {metadata:assembleE2SchemaMetadata(decoded.rowsByStatement,plan.tables)};
    if(plan.caseId?.startsWith('A04-')||plan.caseId==='W00-R'||plan.caseId==='W01-R')return {rows:decoded.rowsByStatement[0]||[]};
    if(plan.caseId==='P-STORAGE-READ')return {classification:validateE2StorageAffinityRows(decoded.rowsByStatement[0])?'COMPLETE_SUCCESS':'PARTIAL_OR_DRIFTED',rows:decoded.rowsByStatement[0]||[]};return {};
  };
  const metadata=await adapter.readExactMetadata();if(metadata.classification!==E2_LIVE_RESPONSE_CLASS.SUCCESS)throw Object.assign(new Error('e2_database_metadata_rejected'),{code:'e2_database_metadata_rejected'});
  const initialPlan=buildSchemaInspectionPlan(),initial=await adapter.execute(initialPlan);if(initial.classification!==E2_LIVE_RESPONSE_CLASS.SUCCESS)throw Object.assign(new Error('e2_initial_schema_inspection_failed'),{code:'e2_initial_schema_inspection_failed'});
  try{validateInitialLiveObjects(initial.rowsByStatement[0]);}catch{throw Object.assign(new Error('e2_initial_schema_rejected'),{code:'e2_initial_schema_rejected'});}
  return runE2LiveContract({...runOptions,identity,initialObjects:[],query:plan=>adapter.execute(plan),reconcile});
}
