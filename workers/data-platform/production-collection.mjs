import {createHash} from 'node:crypto';
import {createD1RestClient,D1_REST_REQUEST_LIMIT_BYTES} from './d1-rest-client.mjs';
import {buildCommitBatch,buildCompleteUnchangedMutation,buildFirstRunReconciliationRead,buildProductionGovernanceRead,buildProductionPopulationAndHeadsRead,buildProductionPostflightRead,buildRunRead,buildStartRunMutation,estimateRoutineCommitRowsWritten,ROUTINE_WRITE_AMPLIFICATION} from './official-fpl-d1-rest-plan.mjs';
import {exactGovernance,exactUntouchedStartedRun,FIRST_RUN_RECONCILIATION_MAX_ROWS_READ,FIRST_RUN_RECONCILIATION_STATEMENT_COUNT,firstRunReconciliationClassification,RESUME_RECONCILIATION_SAFE,validateFirstRunReconciliation} from './resume/first-run-reconciliation-contract.mjs';
import {DATA_S2_SCHEMA_VERSION,DATA_S2_SOURCE_REVISION_ID,DATA_S2_TRANSFORM_VERSION,DATA_S2_VALIDATION_VERSION,diffOfficialFplHistory,materialiseOfficialFplChanges,normaliseOfficialFplHistory} from './official-fpl-canonical.mjs';

// The one approved production collection cadence: a single best-effort full collection
// opportunity each UTC day, offered by GitHub Actions in
// `.github/workflows/data-s2-production-scheduled.yml`. It is a cron opportunity, not a
// guaranteed execution instant, and it is deliberately not a Cloudflare Cron trigger.
//
// THIRD TEMPORARY owner-approved acceptance window for 4 September 2026: the cadence is 14:17 UTC
// (15:17 BST) instead of the permanent intended 01:17 UTC, so the first natural scheduled
// production run can be observed. The workflow declares no `timezone:` field, so GitHub interprets
// the cron in UTC and 14:17 UTC is 15:17 BST while the UK is on BST. The first window
// '17 10 * * *' (10:17 UTC / 11:17 BST) and the second window '30 11 * * *' (11:30 UTC /
// 12:30 BST) each produced zero scheduled runs, with no proven root cause. A separate reviewed
// restoration change returns this constant and the workflow together to '17 1 * * *'. Exactly one
// daily opportunity exists either way.
export const PRODUCTION_COLLECTION_SCHEDULE='17 14 * * *';
export const PRODUCTION_SEASON='2026-27';
export const PRODUCTION_D1_ID='01e2b4f9-313a-4a14-8ce6-86c5aecc50d7';
export const OFFICIAL_FPL_ENDPOINTS=Object.freeze(['https://fantasy.premierleague.com/api/bootstrap-static/','https://fantasy.premierleague.com/api/fixtures/']);
export const MAX_OFFICIAL_RESPONSE_BYTES=8*1024*1024;
export const EXPECTED_D1_ROWS_READ_PER_CYCLE=100000;
export const MAX_D1_ROWS_READ_PER_CYCLE=125000;
export const MAX_D1_ROWS_WRITTEN_PER_CYCLE=40000;
export const MAX_D1_API_CALLS_PER_CYCLE=8;
export const STATIC_D1_ROWS_PER_LOGICAL_FACT=7;
export const STATIC_D1_FIXED_READ_RESERVE=64;
export const STRUCTURAL_HEAD_READ_VISITS_PER_OBSERVATION=3;
export const STRUCTURAL_POSTFLIGHT_VISITS_PER_OBSERVATION=1;
export const STRUCTURAL_POSTFLIGHT_VISITS_PER_HEAD=3;
export const STRUCTURAL_POPULATION_PROBE_VISITS_PER_ROW=1;
export const PRODUCTION_MUTATION_NONE='none';
export const PRODUCTION_MUTATION_UNKNOWN='unknown';
export const PRODUCTION_MUTATION_DEFINITE_COMPLETED='definite_completed';
export const FIRST_PRODUCTION_RUN_SCHEDULED_AT='2026-09-02T17:41:00.000Z';

// The single-resume envelope. A resume is deliberately narrower than a routine cycle: it never
// inserts a start row, so it issues one reconciliation read, one population read, exactly one
// mutation request and one postflight read. The routine ceilings above are unchanged and are not
// reinterpreted by these.
export const RESUME_MAX_D1_API_CALLS=5;
export const RESUME_MAX_MUTATION_REQUESTS=1;
// The population the whole-cycle read model is evaluated at for the outstanding resume, taken
// from the last proven governed population. Repository plan evidence, never a Cloudflare bill.
export const RESUME_REFERENCE_POPULATION=9860;
const fp=value=>createHash('sha256').update(value).digest('hex');
const rows=result=>result.results[0].results??[];
const statementRows=(result,index)=>result.results[index].results??[];
const population=(result,index,key)=>{const value=Number(statementRows(result,index)[0]?.[key]);if(!Number.isSafeInteger(value)||value<0)throw new Error('production_population_contract_invalid');return value;};
export const productionRunIdFor=value=>`gha-${fp(`${DATA_S2_SOURCE_REVISION_ID}:${value}`).slice(0,40)}`;
const runIdFor=productionRunIdFor;

export async function runProductionCollection(options){
  try{return await collectProduction(options);}
  catch(error){throw classifyProductionFailure(error,PRODUCTION_MUTATION_NONE);}
}

async function collectProduction(options){
  const allowed=['accountId','accountFingerprint','databaseId','season','token','scheduledAt','transport','fetchImpl','cryptoImpl','resumeStarted','clock'];
  if(!options||Object.keys(options).some(k=>!allowed.includes(k)))throw new Error('production_config_invalid');
  const {accountId,accountFingerprint,databaseId,season,token,transport,fetchImpl,cryptoImpl=globalThis.crypto,resumeStarted=false,clock=()=>new Date()}=options;
  if(!/^[0-9a-f]{64}$/.test(accountFingerprint||'')||fp(accountId||'')!==accountFingerprint)throw new Error('production_account_fingerprint_mismatch');
  if(databaseId!==PRODUCTION_D1_ID)throw new Error('production_d1_identity_mismatch');
  if(season!==PRODUCTION_SEASON)throw new Error('production_season_mismatch');
  const scheduledAt=new Date(options.scheduledAt).toISOString();
  const client=createD1RestClient({accountId,databaseId,token,transport});let calls=0,read=0,written=0,bytes=0,mutations=0;
  const callCeiling=resumeStarted?RESUME_MAX_D1_API_CALLS:MAX_D1_API_CALLS_PER_CYCLE;
  const dispatch=async plan=>{if(++calls>callCeiling)throw new Error('production_api_budget_exceeded');const out=await client.run(plan);read+=out.usage.rowsRead;written+=out.usage.rowsWritten;bytes+=out.requestBytes;return out;};
  const enforce=out=>{if(read>MAX_D1_ROWS_READ_PER_CYCLE||written>MAX_D1_ROWS_WRITTEN_PER_CYCLE||out.requestBytes>D1_REST_REQUEST_LIMIT_BYTES)throw new Error('production_d1_budget_exceeded');return out;};
  const execute=async plan=>enforce(await dispatch(plan));
  const mutate=async plan=>{if(resumeStarted&&++mutations>RESUME_MAX_MUTATION_REQUESTS)throw new Error('production_resume_mutation_budget_exceeded');return dispatch(plan);};
  const runId=runIdFor(scheduledAt),readRun=()=>execute(buildRunRead({runId,sourceRevisionId:DATA_S2_SOURCE_REVISION_ID}));
  let governanceRow,reconciliation=null,existing=[];
  if(resumeStarted){
    // A resume mutates nothing until the unresolved first run has been proved, in the same
    // execution and by a fixed read-only plan, to be exactly the untouched start-ledger row it
    // was left as. Anything else is BLOCKED or AMBIGUOUS and stops here; nothing is repaired.
    if(scheduledAt!==FIRST_PRODUCTION_RUN_SCHEDULED_AT)throw new Error('production_resume_state_mismatch');
    const reconciled=await execute(buildFirstRunReconciliationRead({runId,sourceRevisionId:DATA_S2_SOURCE_REVISION_ID}));
    if(written!==0)throw new Error('production_resume_reconciliation_read_only_violation');
    if(read>FIRST_RUN_RECONCILIATION_MAX_ROWS_READ)throw new Error('production_resume_reconciliation_resource_ceiling_exceeded');
    if(reconciled.results.length!==FIRST_RUN_RECONCILIATION_STATEMENT_COUNT)throw new Error('production_resume_reconciliation_cardinality_invalid');
    let state;
    try{state=validateFirstRunReconciliation(reconciled.results.map(result=>result.results??[]),{runId,startedAt:scheduledAt});}
    catch(error){const classified=new Error('production_resume_reconciliation_not_safe');classified.reconciliation=firstRunReconciliationClassification(error);throw classified;}
    if(state.classification!==RESUME_RECONCILIATION_SAFE)throw new Error('production_resume_reconciliation_not_safe');
    governanceRow=state.governance;reconciliation=state;
  }else{
    const governance=rows(await execute(buildProductionGovernanceRead({sourceRevisionId:DATA_S2_SOURCE_REVISION_ID})));
    if(governance.length!==1||!exactGovernance(governance[0]))throw new Error('production_governance_mismatch');
    governanceRow=governance[0];
    existing=rows(await readRun());
    if(existing.length===1&&existing[0].status==='completed')throw new Error('production_run_already_completed');
    if(existing.length)throw new Error('production_run_state_ambiguous');
  }
  const executionAt=resumeStarted?canonicalExecutionTime(clock(),scheduledAt):scheduledAt;const fetched=[];
  for(const endpoint of OFFICIAL_FPL_ENDPOINTS){const response=await fetchImpl(endpoint,{method:'GET',redirect:'error',headers:{Accept:'application/json'}});if(response?.status!==200)throw new Error('official_fpl_http_failed');const body=await response.arrayBuffer();if(body.byteLength>MAX_OFFICIAL_RESPONSE_BYTES)throw new Error('official_fpl_payload_too_large');let json;try{json=JSON.parse(new TextDecoder().decode(body));}catch{throw new Error('official_fpl_json_invalid');}fetched.push(json);}
  const normal=normaliseOfficialFplHistory({bootstrap:fetched[0],fixtures:fetched[1],season,fetchedAt:executionAt});
  assertStaticReadBudget(normal.candidates.length);
  const populationAndHeads=await execute(buildProductionPopulationAndHeadsRead({sourceRevisionId:DATA_S2_SOURCE_REVISION_ID}));
  const previous=rows(populationAndHeads);const historicalObservations=population(populationAndHeads,1,'observations'),currentHeads=population(populationAndHeads,2,'heads');
  const changes=diffOfficialFplHistory(normal.candidates,previous);
  const observations=await materialiseOfficialFplChanges(changes,{runId,sourceRevision:governanceRow,fetchedAt:executionAt,cryptoImpl});
  const writeEstimate=changes.length?estimateRoutineCommitRowsWritten({entities:normal.entities,previousRows:previous,observations}):Object.freeze({freshEntities:0,newHeads:0,updatedHeads:0,rowsWritten:ROUTINE_WRITE_AMPLIFICATION.completionUpdate});
  const readEstimate=estimateStructuralCycleRowsRead({observations:historicalObservations,heads:currentHeads,changed:observations.length});
  const readBudget=assertCycleReadBudget({rowsReadSoFar:read,estimate:readEstimate});
  assertStaticWriteBudget({providerRowsWritten:written,resumeStarted,writeEstimate});
  if(!resumeStarted){const start=buildStartRunMutation({runId,sourceRevisionId:DATA_S2_SOURCE_REVISION_ID,startedAt:scheduledAt,safeEndpointClass:'official_fpl_public_core',parserVersion:DATA_S2_VALIDATION_VERSION,transformVersion:DATA_S2_TRANSFORM_VERSION,schemaVersion:DATA_S2_SCHEMA_VERSION});try{await execute(start);}catch(error){if(error?.code!=='d1_mutation_outcome_unknown')throw classifyProductionFailure(error,PRODUCTION_MUTATION_UNKNOWN,'start_dispatch');existing=rows(await readRun());if(existing.length!==1||!exactStarted(existing[0]))throw classifyProductionFailure(new Error('production_start_ambiguous'),PRODUCTION_MUTATION_UNKNOWN,'start_reconciliation');}}
  const commit=changes.length?buildCommitBatch({entities:normal.entities,previousRows:previous,observations,completedAt:executionAt,recordsSeen:normal.candidates.length,runId,sourceRevisionId:DATA_S2_SOURCE_REVISION_ID}):buildCompleteUnchangedMutation({completedAt:executionAt,recordsSeen:normal.candidates.length,runId,sourceRevisionId:DATA_S2_SOURCE_REVISION_ID});
  let committed=null;
  try{committed=await mutate(commit);}
  catch(error){
    if(error?.code!=='d1_mutation_outcome_unknown')throw classifyProductionFailure(error,PRODUCTION_MUTATION_UNKNOWN,'commit_dispatch');
    // Once the single commit mutation has been issued and its outcome is unknown, no later
    // failure may downgrade the operation to "no mutation". The one bounded read-back is
    // therefore classified before it can escape, and there is still no second mutation and no
    // retry of any kind.
    let reconciled;
    try{reconciled=rows(await readRun());}
    catch(error){throw classifyProductionFailure(error,PRODUCTION_MUTATION_UNKNOWN,'commit_reconciliation');}
    if(reconciled.length!==1||reconciled[0].status!=='completed'||Number(reconciled[0].records_accepted)!==observations.length)throw classifyProductionFailure(new Error('production_commit_ambiguous'),PRODUCTION_MUTATION_UNKNOWN,'commit_reconciliation');
    return finish(changes.length?'changed_reconciled':'unchanged_reconciled',observations.length,normal.candidates.length);
  }
  try{enforce(committed);}catch(error){throw classifyProductionFailure(error,PRODUCTION_MUTATION_DEFINITE_COMPLETED,'commit_resource');}
  return finish(changes.length?(previous.length?'changed':'baseline'):'unchanged',observations.length,normal.candidates.length);
  function exactStarted(row){return exactUntouchedStartedRun(row,{runId,startedAt:scheduledAt});}
  async function finish(result,changed,recordsSeen){
    let stateRows;
    try{stateRows=rows(await execute(buildProductionPostflightRead({runId,sourceRevisionId:DATA_S2_SOURCE_REVISION_ID})));}
    catch(error){throw classifyProductionFailure(error,PRODUCTION_MUTATION_DEFINITE_COMPLETED,'postflight_read');}
    try{validateProductionPostflight(stateRows,{runId,changed,recordsSeen});}
    catch(error){throw classifyProductionFailure(error,PRODUCTION_MUTATION_DEFINITE_COMPLETED,'postflight_acceptance');}
    try{return completed(stateRows[0],result,changed,recordsSeen);}
    catch(error){throw classifyProductionFailure(error,PRODUCTION_MUTATION_DEFINITE_COMPLETED,'postflight_report');}
  }
  function completed(state,result,changed,recordsSeen){
    return Object.freeze({ok:true,result,runId,changed:Number(changed),recordsSeen:Number(recordsSeen),executionAt,mutation:PRODUCTION_MUTATION_DEFINITE_COMPLETED,state:Object.freeze({status:state.status,runObservations:Number(state.run_observations),observations:Number(state.observations),heads:Number(state.heads),logicalKeys:Number(state.logical_keys),orphanHeads:Number(state.orphan_heads),quarantined:Number(state.records_quarantined),rejected:Number(state.records_rejected)}),reconciliation:reconciliation?Object.freeze({classification:reconciliation.classification,run:reconciliation.run,integrity:reconciliation.integrity}):null,population:Object.freeze({historicalObservations,currentHeads,structuralRowsRead:readEstimate.totalRows,readClassification:readBudget.classification}),d1:Object.freeze({apiCalls:calls,rowsRead:read,rowsWritten:written,readClassification:classifyRowsRead(read),requestBytes:bytes})});
  }
}

function canonicalExecutionTime(value,startedAt){const date=value instanceof Date?value:new Date(value);if(!Number.isFinite(date.getTime()))throw new Error('production_resume_execution_time_invalid');const iso=date.toISOString();if(iso<=startedAt)throw new Error('production_resume_execution_time_invalid');return iso;}

export function assertStaticReadBudget(candidateCount){if(!Number.isSafeInteger(candidateCount)||candidateCount<0||candidateCount*STATIC_D1_ROWS_PER_LOGICAL_FACT+STATIC_D1_FIXED_READ_RESERVE>MAX_D1_ROWS_READ_PER_CYCLE)throw new Error('production_static_read_budget_impossible');return true;}
export function classifyRowsRead(value){if(!Number.isSafeInteger(value)||value<0||value>MAX_D1_ROWS_READ_PER_CYCLE)throw new Error('production_d1_read_budget_exceeded');return value<=EXPECTED_D1_ROWS_READ_PER_CYCLE?'expected':'hard_ceiling_headroom';}
export function assertStaticWriteBudget({providerRowsWritten,resumeStarted,writeEstimate}){const startEstimate=resumeStarted?0:ROUTINE_WRITE_AMPLIFICATION.startInsert;if(!Number.isSafeInteger(providerRowsWritten)||providerRowsWritten<0||!Number.isSafeInteger(writeEstimate?.rowsWritten)||writeEstimate.rowsWritten<0||providerRowsWritten+startEstimate+writeEstimate.rowsWritten>MAX_D1_ROWS_WRITTEN_PER_CYCLE)throw new Error('production_static_write_budget_exceeded');return true;}
export function validateProductionPostflight(stateRows,{runId,changed,recordsSeen}){const state=stateRows?.[0];if(stateRows?.length!==1||state.run_id!==runId||state.status!=='completed'||Number(state.records_seen)!==Number(recordsSeen)||Number(state.records_accepted)!==Number(changed)||Number(state.run_observations)!==Number(changed)||Number(state.records_quarantined)!==0||Number(state.records_rejected)!==0||state.error_class!==null||Number(state.heads)!==Number(state.logical_keys)||Number(state.orphan_heads)!==0||Number(state.invalid_heads)!==0||Number(state.non_accepted)!==0||Number(state.quarantined_observations)!==0||Number(state.rejections)!==0)throw new Error('production_postflight_mismatch');return true;}
export const canonicalResumeExecutionTime=canonicalExecutionTime;

// Conservative whole-cycle structural read model, derived from the fixed repository SQL and its
// schema-0003 `EXPLAIN QUERY PLAN` shape. One structural visit is counted per row touched per table
// reference. H is the append-only governed observation population, N the current governed head
// population and D the observations this cycle will append.
//   current-head read      : SEARCH o over H, then one indexed r probe and one covering h probe each -> 3H
//   postflight observations: SEARCH shadow_observations over the post-commit population           -> H + D
//   postflight heads       : SCAN h over the post-commit heads, one o probe and one ir probe each  -> 3(N + D)
//   population probe       : one covering index entry per observation and per head                 -> H + N
// At H = N and D = 0 the cycle term collapses to the established 7N + 64 structural baseline.
// This is repository plan evidence, never an exact Cloudflare bill.
export function estimateStructuralCycleRowsRead({observations,heads,changed}){
  for(const value of [observations,heads,changed])if(!Number.isSafeInteger(value)||value<0)throw new Error('production_structural_read_model_invalid');
  const populationProbe=(observations+heads)*STRUCTURAL_POPULATION_PROBE_VISITS_PER_ROW;
  const currentHeadRead=observations*STRUCTURAL_HEAD_READ_VISITS_PER_OBSERVATION;
  const postflight=(observations+changed)*STRUCTURAL_POSTFLIGHT_VISITS_PER_OBSERVATION+(heads+changed)*STRUCTURAL_POSTFLIGHT_VISITS_PER_HEAD;
  const cycleRows=currentHeadRead+postflight+STATIC_D1_FIXED_READ_RESERVE;
  return Object.freeze({observations,heads,changed,populationProbe,currentHeadRead,postflight,cycleRows,totalRows:populationProbe+cycleRows});
}

// Fails closed before the start and commit mutations when the complete planned cycle is structurally
// incompatible with the approved hard read contract, or when the reads already billed by Cloudflare
// plus the still-outstanding synchronous postflight would cross it.
export function assertCycleReadBudget({rowsReadSoFar,estimate}){
  if(!Number.isSafeInteger(rowsReadSoFar)||rowsReadSoFar<0||!Number.isSafeInteger(estimate?.totalRows)||!Number.isSafeInteger(estimate?.postflight))throw new Error('production_cycle_read_budget_invalid');
  const projectedTotal=rowsReadSoFar+estimate.postflight;
  if(estimate.totalRows>MAX_D1_ROWS_READ_PER_CYCLE||projectedTotal>MAX_D1_ROWS_READ_PER_CYCLE)throw new Error('production_cycle_read_budget_exceeded');
  return Object.freeze({structuralTotal:estimate.totalRows,projectedTotal,classification:estimate.totalRows<=EXPECTED_D1_ROWS_READ_PER_CYCLE?'expected':'hard_ceiling_headroom'});
}

// Every failure carries an explicit mutation classification so a caller can never read a definite
// completed run as "nothing was written", and never treats any classification as retryable.
export function classifyProductionFailure(error,mutation,phase){
  const carried=error instanceof Error?error:new Error(String(error));
  if(typeof carried.productionMutation==='string')return carried;
  carried.productionMutation=mutation;
  carried.productionPhase=phase??null;
  carried.productionRetryable=false;
  return carried;
}

export function productionFailureClassification(error){
  const mutation=error?.productionMutation;
  return Object.freeze({
    mutation:[PRODUCTION_MUTATION_NONE,PRODUCTION_MUTATION_UNKNOWN,PRODUCTION_MUTATION_DEFINITE_COMPLETED].includes(mutation)?mutation:PRODUCTION_MUTATION_UNKNOWN,
    phase:typeof error?.productionPhase==='string'?error.productionPhase:null,
    code:/^[a-z0-9_]{1,64}$/.test(String(error?.code??error?.message??''))?String(error.code??error.message):'unclassified',
    retryable:false
  });
}
