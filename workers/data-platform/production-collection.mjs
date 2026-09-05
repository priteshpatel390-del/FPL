import {createHash} from 'node:crypto';
import {createD1RestClient,D1_REST_REQUEST_LIMIT_BYTES} from './d1-rest-client.mjs';
import {buildCommitBatch,buildCompleteUnchangedMutation,buildFirstRunReconciliationRead,buildProductionGovernanceRead,buildProductionPopulationAndHeadsRead,buildProductionPostflightRead,buildRunRead,buildStartRunMutation,D1_MAX_BATCH_STATEMENTS,estimateRoutineCommitRowsWritten,ROUTINE_WRITE_AMPLIFICATION} from './official-fpl-d1-rest-plan.mjs';
import {exactGovernance,exactUntouchedStartedRun,FIRST_RUN_RECONCILIATION_MAX_ROWS_READ,FIRST_RUN_RECONCILIATION_STATEMENT_COUNT,firstRunReconciliationClassification,RESUME_RECONCILIATION_SAFE,validateFirstRunReconciliation} from './resume/first-run-reconciliation-contract.mjs';
import {DATA_S2_SCHEMA_VERSION,DATA_S2_SOURCE_REVISION_ID,DATA_S2_TRANSFORM_VERSION,DATA_S2_VALIDATION_VERSION,diffOfficialFplHistory,materialiseOfficialFplChanges,normaliseOfficialFplHistory} from './official-fpl-canonical.mjs';

// The one approved production collection cadence: a single best-effort full collection
// opportunity each UTC day, offered by GitHub Actions in
// `.github/workflows/data-s2-production-scheduled.yml`. It is a cron opportunity, not a
// guaranteed execution instant, and it is deliberately not a Cloudflare Cron trigger.
//
// The permanent approved cadence, restored after the temporary 4 September 2026 acceptance
// windows. The third of those windows, '17 14 * * *' (14:17 UTC / 15:17 BST), produced the first
// successful natural scheduled production run: GitHub Actions run 33901634593, event `schedule`,
// attempt 1, head `main` dac27b3860428bc55c6d505e8a817a207d30f904, both jobs successful. GitHub
// created that run at 17:38:15Z, approximately 3h21m after its nominal minute, so a cron minute is
// an opportunity and not a guaranteed execution instant. The workflow declares no `timezone:`
// field, so GitHub interprets this cron in UTC and 01:17 UTC is 02:17 BST while the UK is on
// British Summer Time. Exactly one daily opportunity exists, and this constant and the workflow's
// single cron are bound together by a permanent test.
export const PRODUCTION_COLLECTION_SCHEDULE='17 1 * * *';
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
// The O(N) current-head statement visits one covering head-index entry, one observation row and
// one ingestion-run row per current governed head. The superseded O(H) statement charged the same
// three visits per row of the append-only history instead; that constant is retained only so the
// permanent regression can state the superseded coefficient explicitly.
export const STRUCTURAL_HEAD_READ_VISITS_PER_HEAD=3;
export const SUPERSEDED_STRUCTURAL_HEAD_READ_VISITS_PER_OBSERVATION=3;
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

// ---------------------------------------------------------------------------------------------
// DATA-S2B read-budget remediation — measured provider calibration.
//
// MEASURED. Every number below is Cloudflare's own returned accounting for the first successful
// natural scheduled production run, GitHub Actions run 33901634593, event `schedule`, attempt 1,
// head `main` dac27b3860428bc55c6d505e8a817a207d30f904, taken from that run's Step Summary. It is
// a single sample, not a distribution, and it is never restated as an exact per-statement bill.
//
// The write estimate matched `rowsWritten` exactly on this run. That is a fact about the write
// model. It is NOT evidence that any particular Cloudflare index or table visit is billed in one
// particular way, and it must not be generalised into one.
//
// The read model, by contrast, is proven defective: the structural estimate was 94,844 and
// Cloudflare billed 124,430, a delta of 29,586 (an underestimate of about 31.19%). The
// attribution of that delta is only partly known. It is known that the structural estimator
// modelled no mutation-read usage at all, that the dispatch counts provider `rows_read` from
// every D1 call including the commit, and that the current-head statement carried O(H) work. The
// exact split between those causes and any further provider-side amplification is NOT known and
// is deliberately not invented here; better attribution needs the per-call telemetry this
// remediation adds and a further instrumented production run.
export const MEASURED_PROVIDER_READ_CALIBRATION=Object.freeze({
  source:'github_actions_run_33901634593',
  event:'schedule',
  historicalObservations:10628,
  currentHeads:10146,
  changed:264,
  structuralRowsRead:94844,
  providerRowsRead:124430,
  providerRowsWritten:1852,
  apiCalls:6,
  requestBytes:385821
});

// INFERRED, not measured. A conservative multiplier applied to modelled remaining work before it
// is compared with the read ceiling. The measured sample gives an observed provider-to-structural
// ratio of 124,430 / 94,844 = 1.311944 with no mutation reads modelled at all; once mutation reads
// are modelled explicitly the residual ratio for that sample is about 1.28. 1.35 is chosen to sit
// conservatively above both, so the projection over-predicts rather than under-predicts on the
// only sample that exists. It is one sample: this constant is a deliberately pessimistic planning
// assumption, never a proven provider constant, and it is expected to be recalibrated once the
// per-call telemetry this remediation adds has been observed live.
export const PROVIDER_READ_AMPLIFICATION=1.35;

// INFERRED, not measured. A flat absolute reserve added on top of the amplified projection so a
// cycle never plans to finish flush against the ceiling. The measured sample finished 570 rows
// below 125,000, which is not a safety margin.
export const PROVIDER_READ_SAFETY_RESERVE=2000;

// INFERRED, not measured. Routine mutation-read amplification: the index and row visits a
// mutation statement is assumed to charge as `rows_read` while locating the rows it writes. These
// are deliberately conservative upper assumptions derived from the schema's declared keys,
// indexes and foreign keys, in the same disciplined shape as `ROUTINE_WRITE_AMPLIFICATION` — they
// are NOT provider-confirmed per-row costs, and no observation to date attributes a specific
// number of read rows to a specific mutation statement.
//   startInsert       INSERT OR IGNORE ingestion_runs: primary key, UNIQUE(run_id,source_revision_id),
//                     and the data_source_revisions foreign key.
//   entityInsert      INSERT OR IGNORE canonical_entities: primary key and the four-column UNIQUE.
//   observationInsert  shadow_observations: primary key, shadow_observation_idempotency,
//                     shadow_observation_replay, and the canonical_entities and ingestion_runs
//                     foreign keys.
//   headInsert        observation_heads: primary key, observation_heads_observation_id and the
//                     shadow_observations foreign key.
//   headUpdate        the same, plus reading the conflicting row that ON CONFLICT DO UPDATE replaces.
//   completionUpdate  ingestion_runs: the primary-key probe and the row it updates.
export const ROUTINE_MUTATION_READ_AMPLIFICATION=Object.freeze({
  startInsert:3,entityInsert:3,observationInsert:5,headInsert:3,headUpdate:4,completionUpdate:2
});

// The routine mutation-read estimator. It mirrors the write estimator's inputs exactly — fresh
// entities, observations, new heads, updated heads, the start row and the completion row — so the
// two models can never disagree about the shape of the cycle they describe.
export function estimateRoutineMutationRowsRead({freshEntities,observations,newHeads,updatedHeads,resumeStarted=false}){
  for(const value of [freshEntities,observations,newHeads,updatedHeads])
    if(!Number.isSafeInteger(value)||value<0)throw new Error('production_mutation_read_model_invalid');
  if(typeof resumeStarted!=='boolean')throw new Error('production_mutation_read_model_invalid');
  if(newHeads+updatedHeads!==observations)throw new Error('production_mutation_read_model_invalid');
  const a=ROUTINE_MUTATION_READ_AMPLIFICATION;
  // A resume never inserts a start row, so it is never charged for one.
  const start=resumeStarted?0:a.startInsert;
  const rowsRead=start+freshEntities*a.entityInsert+observations*a.observationInsert
    +newHeads*a.headInsert+updatedHeads*a.headUpdate+a.completionUpdate;
  return Object.freeze({freshEntities,observations,newHeads,updatedHeads,start,rowsRead});
}

// The pre-mutation provider-read projection. Distinct from the structural model on purpose:
// `estimateStructuralCycleRowsRead` answers "how many rows does the repository SQL visit", this
// answers "how many rows is Cloudflare expected to bill for the rest of this cycle, pessimistically".
// Diagnostic reporting keeps both, so a future recalibration can separate a plan change from an
// amplification change.
//
// Already-consumed provider rows are taken exactly as Cloudflare billed them and are never
// amplified again. Only the still-outstanding work — the remaining structural reads and the
// modelled mutation reads — is amplified, and the flat reserve is added last.
export function projectProviderCycleRowsRead({rowsReadSoFar,remainingStructuralRows,mutationRowsRead,
  amplification=PROVIDER_READ_AMPLIFICATION,reserve=PROVIDER_READ_SAFETY_RESERVE}){
  for(const value of [rowsReadSoFar,remainingStructuralRows,mutationRowsRead,reserve])
    if(!Number.isSafeInteger(value)||value<0)throw new Error('production_provider_read_projection_invalid');
  if(typeof amplification!=='number'||!Number.isFinite(amplification)||amplification<1)throw new Error('production_provider_read_projection_invalid');
  const amplified=Math.ceil((remainingStructuralRows+mutationRowsRead)*amplification);
  const projectedProviderRows=rowsReadSoFar+amplified+reserve;
  if(!Number.isSafeInteger(projectedProviderRows))throw new Error('production_provider_read_projection_invalid');
  return Object.freeze({rowsReadSoFar,remainingStructuralRows,mutationRowsRead,amplification,reserve,
    amplifiedRemainingRows:amplified,projectedProviderRows});
}

// The predictive soft gate. It is deliberately NOT the hard circuit breaker:
//   * the soft gate runs once, before the start mutation, over a projection of work not yet done,
//     and refuses with `production_projected_read_budget_exceeded` and `mutation = none`;
//   * the hard circuit breaker runs after every D1 call, over Cloudflare's own returned
//     accounting, and refuses with `production_d1_budget_exceeded`.
// Both compare against the same unchanged `MAX_D1_ROWS_READ_PER_CYCLE = 125000`. Neither replaces
// the other: the soft gate exists so a cycle cannot pass a predictive check, mutate production,
// and only then discover the envelope was already impossible — which is exactly what run
// 33948145320 did on 5 September 2026.
export function assertProjectedProviderReadBudget(projection){
  if(!Number.isSafeInteger(projection?.projectedProviderRows))throw new Error('production_provider_read_projection_invalid');
  if(projection.projectedProviderRows>MAX_D1_ROWS_READ_PER_CYCLE)throw new Error('production_projected_read_budget_exceeded');
  return Object.freeze({...projection,
    classification:projection.projectedProviderRows<=EXPECTED_D1_ROWS_READ_PER_CYCLE?'expected':'hard_ceiling_headroom'});
}

const fp=value=>createHash('sha256').update(value).digest('hex');
const rows=result=>result.results[0].results??[];
const statementRows=(result,index)=>result.results[index].results??[];
const population=(result,index,key)=>{const value=Number(statementRows(result,index)[0]?.[key]);if(!Number.isSafeInteger(value)||value<0)throw new Error('production_population_contract_invalid');return value;};
export const productionRunIdFor=value=>`gha-${fp(`${DATA_S2_SOURCE_REVISION_ID}:${value}`).slice(0,40)}`;
const runIdFor=productionRunIdFor;

export async function runProductionCollection(options){
  const telemetry=createProductionResourceTelemetry();
  try{return await collectProduction(options,telemetry);}
  // Every failure carries the bounded resource snapshot as it stood when the cycle stopped, so a
  // resource refusal can be diagnosed from the sanitized summary alone without a further live run.
  catch(error){throw attachProductionResourceTelemetry(classifyProductionFailure(error,PRODUCTION_MUTATION_NONE),telemetry);}
}

async function collectProduction(options,telemetry=createProductionResourceTelemetry()){
  const allowed=['accountId','accountFingerprint','databaseId','season','token','scheduledAt','transport','fetchImpl','cryptoImpl','resumeStarted','clock'];
  if(!options||Object.keys(options).some(k=>!allowed.includes(k)))throw new Error('production_config_invalid');
  const {accountId,accountFingerprint,databaseId,season,token,transport,fetchImpl,cryptoImpl=globalThis.crypto,resumeStarted=false,clock=()=>new Date()}=options;
  if(!/^[0-9a-f]{64}$/.test(accountFingerprint||'')||fp(accountId||'')!==accountFingerprint)throw new Error('production_account_fingerprint_mismatch');
  if(databaseId!==PRODUCTION_D1_ID)throw new Error('production_d1_identity_mismatch');
  if(season!==PRODUCTION_SEASON)throw new Error('production_season_mismatch');
  const scheduledAt=new Date(options.scheduledAt).toISOString();
  const client=createD1RestClient({accountId,databaseId,token,transport});let calls=0,read=0,written=0,bytes=0,mutations=0;
  const callCeiling=resumeStarted?RESUME_MAX_D1_API_CALLS:MAX_D1_API_CALLS_PER_CYCLE;
  const dispatch=async plan=>{if(++calls>callCeiling)throw new Error('production_api_budget_exceeded');const out=await client.run(plan);read+=out.usage.rowsRead;written+=out.usage.rowsWritten;bytes+=out.requestBytes;telemetry.record(plan.kind,out);return out;};
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
  // The predictive soft gate, before any mutation. `writeEstimate` already carries the exact shape
  // of the commit this cycle would issue, so the mutation-read model is built from the same
  // counts rather than from a second, possibly divergent, derivation. Already-billed provider rows
  // are taken as measured; only the outstanding postflight read and the modelled mutation reads
  // are amplified. A refusal here throws before the start mutation, so nothing is written and the
  // failure classifies as `mutation = none`.
  const mutationReadEstimate=estimateRoutineMutationRowsRead({freshEntities:writeEstimate.freshEntities,
    observations:writeEstimate.newHeads+writeEstimate.updatedHeads,newHeads:writeEstimate.newHeads,
    updatedHeads:writeEstimate.updatedHeads,resumeStarted});
  const projection=assertProjectedProviderReadBudget(projectProviderCycleRowsRead({rowsReadSoFar:read,
    remainingStructuralRows:readEstimate.postflight,mutationRowsRead:mutationReadEstimate.rowsRead}));
  telemetry.plan({structuralRowsRead:readEstimate.totalRows,projection,
    population:{historicalObservations,currentHeads,changed:observations.length}});
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
    return Object.freeze({ok:true,result,runId,changed:Number(changed),recordsSeen:Number(recordsSeen),executionAt,mutation:PRODUCTION_MUTATION_DEFINITE_COMPLETED,state:Object.freeze({status:state.status,runObservations:Number(state.run_observations),observations:Number(state.observations),heads:Number(state.heads),logicalKeys:Number(state.logical_keys),orphanHeads:Number(state.orphan_heads),quarantined:Number(state.records_quarantined),rejected:Number(state.records_rejected)}),reconciliation:reconciliation?Object.freeze({classification:reconciliation.classification,run:reconciliation.run,integrity:reconciliation.integrity}):null,population:Object.freeze({historicalObservations,currentHeads,structuralRowsRead:readEstimate.totalRows,readClassification:readBudget.classification,projectedProviderRows:projection.projectedProviderRows,projectedReadClassification:projection.classification,mutationRowsRead:mutationReadEstimate.rowsRead,providerReadAmplification:projection.amplification,providerReadReserve:projection.reserve}),d1:Object.freeze({apiCalls:calls,rowsRead:read,rowsWritten:written,readClassification:classifyRowsRead(read),requestBytes:bytes,telemetry:telemetry.snapshot()})});
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
//   current-head read      : SCAN h over N, then one indexed o probe and one indexed r probe each  -> 3N
//   postflight observations: SEARCH shadow_observations over the post-commit population           -> H + D
//   postflight heads       : SCAN h over the post-commit heads, one o probe and one ir probe each  -> 3(N + D)
//   population probe       : one covering index entry per observation and per head                 -> H + N
// At H = N and D = 0 the cycle term collapses to the established 7N + 64 structural baseline, which
// is unchanged by the O(N) re-plan. What changes is the coefficient on the append-only history:
// the whole-cycle total is now 2H + 7N + 4D + 64, where it was 5H + 4N + 4D + 64, so growth in H
// costs two structural visits per historical observation instead of five.
//
// This is repository plan evidence, never an exact Cloudflare bill. Measured provider accounting
// materially exceeds it — see `MEASURED_PROVIDER_READ_CALIBRATION` and the provider projection
// below, which is the value the pre-mutation gate actually compares against the ceiling.
export function estimateStructuralCycleRowsRead({observations,heads,changed}){
  for(const value of [observations,heads,changed])if(!Number.isSafeInteger(value)||value<0)throw new Error('production_structural_read_model_invalid');
  const populationProbe=(observations+heads)*STRUCTURAL_POPULATION_PROBE_VISITS_PER_ROW;
  const currentHeadRead=heads*STRUCTURAL_HEAD_READ_VISITS_PER_HEAD;
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
// ---------------------------------------------------------------------------------------------
// DATA-S2B — bounded production resource telemetry.
//
// Run 33948145320 stopped at `production_d1_budget_exceeded` and its sanitized summary could say
// only that some read ceiling had been crossed: the client aggregated every statement's metadata
// into one scalar and discarded the breakdown, so which call and which resource dimension
// exhausted the envelope was unrecoverable. This recorder keeps that breakdown.
//
// SECURITY. Everything it holds is an integer or a fixed enum from a closed set. It never touches
// SQL text, bound parameters, a request URL, an account id, a database id, an account
// fingerprint, a token, a response body or a returned row. It is fed only from
// `d1-rest-client.mjs`'s already-validated integer accounting and from the repository's own
// models, so there is no path by which provider text could reach it. The per-call and
// per-statement arrays are bounded by the cycle's own eight-call and forty-statement ceilings.
const TELEMETRY_MAX_CALLS=64;
const TELEMETRY_MAX_STATEMENTS_PER_CALL=D1_MAX_BATCH_STATEMENTS;
const TELEMETRY_PLAN_KINDS=Object.freeze(['read','mutation']);

export function createProductionResourceTelemetry(){
  const calls=[];
  let cumulativeRowsRead=0,cumulativeRowsWritten=0,cumulativeRequestBytes=0;
  let plan=null;
  const integer=value=>Number.isSafeInteger(value)&&value>=0?value:0;
  return Object.freeze({
    record(kind,out){
      const rowsRead=integer(out?.usage?.rowsRead),rowsWritten=integer(out?.usage?.rowsWritten);
      const requestBytes=integer(out?.requestBytes);
      cumulativeRowsRead+=rowsRead;cumulativeRowsWritten+=rowsWritten;cumulativeRequestBytes+=requestBytes;
      if(calls.length>=TELEMETRY_MAX_CALLS)return;
      const statements=Array.isArray(out?.statements)?out.statements.slice(0,TELEMETRY_MAX_STATEMENTS_PER_CALL)
        .map(entry=>Object.freeze({rowsRead:integer(entry?.rowsRead),rowsWritten:integer(entry?.rowsWritten),
          changes:integer(entry?.changes)})):[];
      calls.push(Object.freeze({
        call:calls.length+1,
        kind:TELEMETRY_PLAN_KINDS.includes(kind)?kind:'read',
        rowsRead,rowsWritten,requestBytes,
        statements:Object.freeze(statements)
      }));
    },
    // The one pre-mutation planning record: what the repository predicted before it decided to
    // mutate, kept beside what the provider then actually charged.
    plan(record){
      plan=Object.freeze({
        structuralRowsRead:integer(record?.structuralRowsRead),
        projectedProviderRows:integer(record?.projection?.projectedProviderRows),
        amplifiedRemainingRows:integer(record?.projection?.amplifiedRemainingRows),
        mutationRowsRead:integer(record?.projection?.mutationRowsRead),
        remainingStructuralRows:integer(record?.projection?.remainingStructuralRows),
        amplification:typeof record?.projection?.amplification==='number'&&Number.isFinite(record.projection.amplification)
          ?record.projection.amplification:PROVIDER_READ_AMPLIFICATION,
        reserve:integer(record?.projection?.reserve),
        historicalObservations:integer(record?.population?.historicalObservations),
        currentHeads:integer(record?.population?.currentHeads),
        changed:integer(record?.population?.changed)
      });
    },
    snapshot(){
      const last=calls[calls.length-1]??null;
      return Object.freeze({
        apiCalls:calls.length,cumulativeRowsRead,cumulativeRowsWritten,cumulativeRequestBytes,
        lastCallRowsRead:last?last.rowsRead:0,
        lastCallRowsWritten:last?last.rowsWritten:0,
        lastCallRequestBytes:last?last.requestBytes:0,
        // Which unchanged ceiling each dimension stands against, so a failure summary names the
        // dimension that failed instead of leaving it to be inferred.
        ceilings:Object.freeze({rowsRead:MAX_D1_ROWS_READ_PER_CYCLE,rowsWritten:MAX_D1_ROWS_WRITTEN_PER_CYCLE,
          apiCalls:MAX_D1_API_CALLS_PER_CYCLE,requestBytes:D1_REST_REQUEST_LIMIT_BYTES}),
        plan,
        calls:Object.freeze(calls.map(entry=>entry))
      });
    }
  });
}

export function attachProductionResourceTelemetry(error,telemetry){
  const carried=error instanceof Error?error:new Error(String(error));
  if(carried.productionResources===undefined&&typeof telemetry?.snapshot==='function')
    carried.productionResources=telemetry.snapshot();
  return carried;
}

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
    // Bounded integers and fixed enums only. Absent when the cycle stopped before any telemetry
    // existed, never fabricated.
    resources:error?.productionResources??null,
    retryable:false
  });
}
