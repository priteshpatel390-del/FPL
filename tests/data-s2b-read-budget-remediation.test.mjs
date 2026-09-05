// DATA-S2B read-budget remediation — permanent regressions.
//
// Covers the corrected pre-mutation read model, the explicit mutation-read estimator, the
// separation of the predictive soft gate from the hard circuit breaker, the bounded resource
// telemetry and its sanitisation, and the strictly read-only committed-run integrity diagnostic.
// The O(N) current-head plan and its EXPLAIN contract are covered in
// `data-s2-production-query-plan.test.mjs` and `data-s2b-production-explain-acceptance.test.mjs`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {
  assertProjectedProviderReadBudget,createProductionResourceTelemetry,
  EXPECTED_D1_ROWS_READ_PER_CYCLE,estimateRoutineMutationRowsRead,estimateStructuralCycleRowsRead,
  MAX_D1_API_CALLS_PER_CYCLE,MAX_D1_ROWS_READ_PER_CYCLE,MAX_D1_ROWS_WRITTEN_PER_CYCLE,
  MEASURED_PROVIDER_READ_CALIBRATION,PRODUCTION_COLLECTION_SCHEDULE,PRODUCTION_D1_ID,
  PRODUCTION_MUTATION_NONE,productionFailureClassification,productionRunIdFor,
  projectProviderCycleRowsRead,PROVIDER_READ_AMPLIFICATION,PROVIDER_READ_SAFETY_RESERVE,
  RESUME_MAX_D1_API_CALLS,ROUTINE_MUTATION_READ_AMPLIFICATION,runProductionCollection,
  STRUCTURAL_HEAD_READ_VISITS_PER_HEAD,validateProductionPostflight
} from '../workers/data-platform/production-collection.mjs';
import {createD1RestClient} from '../workers/data-platform/d1-rest-client.mjs';
import {buildProductionPostflightRead,buildRunRead,D1_MAX_BATCH_STATEMENTS} from '../workers/data-platform/official-fpl-d1-rest-plan.mjs';
import {
  COMMITTED_RUN_INTEGRITY_CLASSIFICATIONS,COMMITTED_RUN_INTEGRITY_MAX_D1_API_CALLS,
  COMMITTED_RUN_INTEGRITY_MAX_ROWS_READ,COMMITTED_RUN_INTEGRITY_MAX_ROWS_WRITTEN,
  COMMITTED_RUN_INTEGRITY_STATEMENT_COUNT,COMMITTED_RUN_SCHEDULED_AT,COMMITTED_RUN_WORKFLOW_RUN,
  COMMITTED_STATE_AMBIGUOUS,COMMITTED_STATE_INVALID,COMMITTED_STATE_VALID,
  committedRunIntegrityClassification,validateCommittedRunIntegrity
} from '../workers/data-platform/integrity/committed-run-integrity-contract.mjs';
import {verifyCommittedProductionRun} from '../workers/data-platform/integrity/verify-committed-run.mjs';
import {DATA_S2_SOURCE_REVISION_ID,normaliseOfficialFplHistory} from '../workers/data-platform/official-fpl-canonical.mjs';

const ACCOUNT='data-s2b-read-budget-account';
const FINGERPRINT=createHash('sha256').update(ACCOUNT).digest('hex');
const TOKEN='data-s2b-read-budget-token';
const uncommented=source=>source.split('\n').filter(line=>!/^\s*(#|\/\/)/.test(line)).join('\n');

const contractPath='workers/data-platform/integrity/committed-run-integrity-contract.mjs';
const helperPath='workers/data-platform/integrity/verify-committed-run.mjs';
const entryPath='workers/data-platform/run-committed-run-integrity.mjs';
const workflowPath='.github/workflows/data-s2b-committed-run-integrity.yml';
const scheduledWorkflowPath='.github/workflows/data-s2-production-scheduled.yml';
const contractSource=fs.readFileSync(contractPath,'utf8');
const helperSource=fs.readFileSync(helperPath,'utf8');
const entrySource=fs.readFileSync(entryPath,'utf8');
const workflow=fs.readFileSync(workflowPath,'utf8');
const integrityExecutable=uncommented(`${contractSource}\n${helperSource}\n${entrySource}`);

/* ------------------------------------------------------------- measured calibration */

test('the 4 September measured provider sample is a permanent regression fixture',()=>{
  const sample=MEASURED_PROVIDER_READ_CALIBRATION;
  assert.equal(sample.source,'github_actions_run_33901634593');
  assert.equal(sample.event,'schedule');
  assert.equal(sample.historicalObservations,10628);
  assert.equal(sample.currentHeads,10146);
  assert.equal(sample.changed,264);
  assert.equal(sample.structuralRowsRead,94844);
  assert.equal(sample.providerRowsRead,124430);
  assert.equal(sample.providerRowsWritten,1852);
  assert.equal(sample.apiCalls,6);
  assert.equal(sample.requestBytes,385821);
  // The proven defect: Cloudflare billed materially more than the structural estimate. The exact
  // attribution of the 29,586-row delta is NOT known and is deliberately not asserted here.
  assert.equal(sample.providerRowsRead-sample.structuralRowsRead,29586);
  assert.ok(sample.providerRowsRead/sample.structuralRowsRead>1.31);
  // And it finished 570 rows below the ceiling, which is not a safety margin.
  assert.equal(MAX_D1_ROWS_READ_PER_CYCLE-sample.providerRowsRead,570);
});

test('the superseded structural model reproduced the measured sample exactly, and the new one is lower',()=>{
  const {historicalObservations:H,currentHeads:N,changed:D,structuralRowsRead}=MEASURED_PROVIDER_READ_CALIBRATION;
  // The superseded whole-cycle model was 5H + 4N + 4D + 64. It reproduces the reported figure,
  // which is what proves the reported 94,844 was that model's own output and not a stray number.
  assert.equal(5*H+4*N+4*D+64,structuralRowsRead);
  // The O(N) re-plan gives 2H + 7N + 4D + 64.
  const estimate=estimateStructuralCycleRowsRead({observations:H,heads:N,changed:D});
  assert.equal(estimate.totalRows,2*H+7*N+4*D+64);
  assert.equal(estimate.totalRows,93398);
  assert.equal(estimate.currentHeadRead,N*STRUCTURAL_HEAD_READ_VISITS_PER_HEAD);
  // The saving at this population is only 3(H - N), because H and N are currently close. The
  // value of the re-plan is that it removes the term that grows without bound, not that it
  // recovers headroom today.
  assert.equal(structuralRowsRead-estimate.totalRows,3*(H-N));
  assert.equal(structuralRowsRead-estimate.totalRows,1446);
});

test('the projection over-predicts the measured sample with meaningful headroom',()=>{
  const {historicalObservations:H,currentHeads:N,changed:D,providerRowsRead}=MEASURED_PROVIDER_READ_CALIBRATION;
  // The commit shape the write estimator implies for that sample: 264 observations, 3 new heads,
  // 261 updated heads, no fresh entities. 0*3 + 264*5 + 3*3 + 261*2 + 1 = 1,852, exactly the
  // measured rowsWritten. That is a fact about the WRITE model only.
  assert.equal(0*3+264*5+3*3+261*2+1,MEASURED_PROVIDER_READ_CALIBRATION.providerRowsWritten);
  const mutation=estimateRoutineMutationRowsRead({freshEntities:0,observations:D,newHeads:3,updatedHeads:261});
  const structural=estimateStructuralCycleRowsRead({observations:H,heads:N,changed:D});
  const projection=projectProviderCycleRowsRead({rowsReadSoFar:0,
    remainingStructuralRows:structural.totalRows,mutationRowsRead:mutation.rowsRead});
  assert.ok(projection.projectedProviderRows>=providerRowsRead,
    `${projection.projectedProviderRows} < ${providerRowsRead}`);
  assert.ok(projection.projectedProviderRows-providerRowsRead>=5000,
    `headroom ${projection.projectedProviderRows-providerRowsRead} is not meaningful`);
  // The same holds against the superseded structural model, so the calibration is not an artefact
  // of the re-plan.
  const superseded=projectProviderCycleRowsRead({rowsReadSoFar:0,
    remainingStructuralRows:MEASURED_PROVIDER_READ_CALIBRATION.structuralRowsRead,mutationRowsRead:mutation.rowsRead});
  assert.ok(superseded.projectedProviderRows>=providerRowsRead);
});

test('the calibration constants are declared conservative and are pinned for recalibration',()=>{
  assert.equal(PROVIDER_READ_AMPLIFICATION,1.35);
  assert.equal(PROVIDER_READ_SAFETY_RESERVE,2000);
  // Above both the raw observed ratio and the residual ratio once mutation reads are modelled.
  const {structuralRowsRead,providerRowsRead}=MEASURED_PROVIDER_READ_CALIBRATION;
  assert.ok(PROVIDER_READ_AMPLIFICATION>providerRowsRead/structuralRowsRead);
  const mutation=estimateRoutineMutationRowsRead({freshEntities:0,observations:264,newHeads:3,updatedHeads:261});
  assert.ok(PROVIDER_READ_AMPLIFICATION>providerRowsRead/(structuralRowsRead+mutation.rowsRead));
  // Measured versus inferred is stated in the source, not left to be guessed.
  const source=fs.readFileSync('workers/data-platform/production-collection.mjs','utf8');
  assert.match(source,/MEASURED\. Every number below is Cloudflare's own returned accounting/);
  assert.match(source,/INFERRED, not measured\./);
});

/* ------------------------------------------------------------ mutation-read estimator */

test('the mutation-read estimator mirrors the write estimator inputs and is conservative',()=>{
  assert.deepEqual({...ROUTINE_MUTATION_READ_AMPLIFICATION},
    {startInsert:3,entityInsert:3,observationInsert:5,headInsert:3,headUpdate:4,completionUpdate:2});
  const estimate=estimateRoutineMutationRowsRead({freshEntities:2,observations:10,newHeads:4,updatedHeads:6});
  assert.equal(estimate.rowsRead,3+2*3+10*5+4*3+6*4+2);
  assert.equal(estimate.start,ROUTINE_MUTATION_READ_AMPLIFICATION.startInsert);
  // A resume never inserts a start row and is never charged for one.
  const resume=estimateRoutineMutationRowsRead({freshEntities:2,observations:10,newHeads:4,updatedHeads:6,resumeStarted:true});
  assert.equal(resume.start,0);
  assert.equal(estimate.rowsRead-resume.rowsRead,ROUTINE_MUTATION_READ_AMPLIFICATION.startInsert);
  // An unchanged cycle still writes and therefore still reads a completion row.
  assert.equal(estimateRoutineMutationRowsRead({freshEntities:0,observations:0,newHeads:0,updatedHeads:0}).rowsRead,
    ROUTINE_MUTATION_READ_AMPLIFICATION.startInsert+ROUTINE_MUTATION_READ_AMPLIFICATION.completionUpdate);
  // A head is either new or updated, never both and never neither.
  for(const bad of [
    {freshEntities:0,observations:5,newHeads:2,updatedHeads:2},
    {freshEntities:0,observations:5,newHeads:6,updatedHeads:0},
    {freshEntities:-1,observations:0,newHeads:0,updatedHeads:0},
    {freshEntities:0,observations:1.5,newHeads:0,updatedHeads:0}
  ])assert.throws(()=>estimateRoutineMutationRowsRead(bad),/production_mutation_read_model_invalid/);
});

/* ---------------------------------------------------- projection and threshold split */

test('already-billed rows are never amplified twice and only outstanding work is',()=>{
  const projection=projectProviderCycleRowsRead({rowsReadSoFar:50000,remainingStructuralRows:10000,mutationRowsRead:1000});
  assert.equal(projection.rowsReadSoFar,50000);
  assert.equal(projection.amplifiedRemainingRows,Math.ceil(11000*PROVIDER_READ_AMPLIFICATION));
  assert.equal(projection.projectedProviderRows,50000+Math.ceil(11000*1.35)+PROVIDER_READ_SAFETY_RESERVE);
  // The structural model and the provider projection stay separately reportable, so a future
  // recalibration can distinguish a plan change from an amplification change.
  assert.equal(projection.remainingStructuralRows,10000);
  assert.equal(projection.mutationRowsRead,1000);
  assert.equal(projection.amplification,PROVIDER_READ_AMPLIFICATION);
  assert.equal(projection.reserve,PROVIDER_READ_SAFETY_RESERVE);
  for(const bad of [
    {rowsReadSoFar:-1,remainingStructuralRows:0,mutationRowsRead:0},
    {rowsReadSoFar:0,remainingStructuralRows:1.5,mutationRowsRead:0},
    {rowsReadSoFar:0,remainingStructuralRows:0,mutationRowsRead:-1},
    {rowsReadSoFar:0,remainingStructuralRows:0,mutationRowsRead:0,amplification:0.9}
  ])assert.throws(()=>projectProviderCycleRowsRead(bad),/production_provider_read_projection_invalid/);
});

test('the soft predictive gate and the hard circuit breaker are separate and share one ceiling',()=>{
  // Same unchanged ceiling, different inputs, different codes.
  assert.equal(MAX_D1_ROWS_READ_PER_CYCLE,125000);
  const inside=projectProviderCycleRowsRead({rowsReadSoFar:0,remainingStructuralRows:1000,mutationRowsRead:0});
  assert.equal(assertProjectedProviderReadBudget(inside).classification,'expected');
  const headroom=projectProviderCycleRowsRead({rowsReadSoFar:EXPECTED_D1_ROWS_READ_PER_CYCLE,
    remainingStructuralRows:1000,mutationRowsRead:0});
  assert.equal(assertProjectedProviderReadBudget(headroom).classification,'hard_ceiling_headroom');
  const over=projectProviderCycleRowsRead({rowsReadSoFar:MAX_D1_ROWS_READ_PER_CYCLE,
    remainingStructuralRows:1,mutationRowsRead:0});
  assert.throws(()=>assertProjectedProviderReadBudget(over),/production_projected_read_budget_exceeded/);
  // Exactly at the ceiling is admissible; one row above is not.
  const exact=projectProviderCycleRowsRead({rowsReadSoFar:MAX_D1_ROWS_READ_PER_CYCLE-PROVIDER_READ_SAFETY_RESERVE,
    remainingStructuralRows:0,mutationRowsRead:0});
  assert.equal(exact.projectedProviderRows,MAX_D1_ROWS_READ_PER_CYCLE);
  assert.equal(assertProjectedProviderReadBudget(exact).projectedProviderRows,MAX_D1_ROWS_READ_PER_CYCLE);
  const source=fs.readFileSync('workers/data-platform/production-collection.mjs','utf8');
  // The hard circuit breaker is preserved, not replaced.
  assert.match(source,/production_d1_budget_exceeded/);
  assert.match(source,/production_projected_read_budget_exceeded/);
});

test('the pinned 5 September reference population is refused by the soft gate before any mutation',()=>{
  // The state run 33948145320 left behind: the 4 September population plus that run's own commit.
  const H=MEASURED_PROVIDER_READ_CALIBRATION.historicalObservations+MEASURED_PROVIDER_READ_CALIBRATION.changed;
  const N=MEASURED_PROVIDER_READ_CALIBRATION.currentHeads;
  const structural=estimateStructuralCycleRowsRead({observations:H,heads:N,changed:264});
  const mutation=estimateRoutineMutationRowsRead({freshEntities:0,observations:264,newHeads:0,updatedHeads:264});
  // From the top of a cycle, with nothing yet billed, the projection is already over the ceiling.
  const projection=projectProviderCycleRowsRead({rowsReadSoFar:0,
    remainingStructuralRows:structural.totalRows,mutationRowsRead:mutation.rowsRead});
  assert.ok(projection.projectedProviderRows>MAX_D1_ROWS_READ_PER_CYCLE);
  assert.throws(()=>assertProjectedProviderReadBudget(projection),/production_projected_read_budget_exceeded/);
  // This is the honest, reported consequence of the remediation: at THIS analysed population and
  // change assumption the corrected model refuses before mutation rather than committing and then
  // failing. It pins the reference scenario, not a prediction about any future execution, whose
  // population, changed-observation count and already-billed rows are unknown until it runs.
  // Stage 3 alone does not restore collection capability, and nothing here raises the ceiling.
  assert.equal(MAX_D1_ROWS_READ_PER_CYCLE,125000);
});

/* ------------------------------------------------------------------------ telemetry */

test('bounded telemetry preserves per-call and per-statement integer accounting',()=>{
  const telemetry=createProductionResourceTelemetry();
  telemetry.record('read',{usage:{rowsRead:100,rowsWritten:0},requestBytes:500,
    statements:[{rowsRead:60,rowsWritten:0,changes:0},{rowsRead:40,rowsWritten:0,changes:0}]});
  telemetry.record('mutation',{usage:{rowsRead:20,rowsWritten:7},requestBytes:900,
    statements:[{rowsRead:20,rowsWritten:7,changes:7}]});
  const snapshot=telemetry.snapshot();
  assert.equal(snapshot.apiCalls,2);
  assert.equal(snapshot.storedCalls,2);
  assert.equal(snapshot.cumulativeRowsRead,120);
  assert.equal(snapshot.cumulativeRowsWritten,7);
  assert.equal(snapshot.cumulativeRequestBytes,1400);
  assert.equal(snapshot.lastCallRowsRead,20);
  assert.equal(snapshot.lastCallRowsWritten,7);
  assert.equal(snapshot.lastCallRequestBytes,900);
  assert.deepEqual(snapshot.calls.map(entry=>entry.kind),['read','mutation']);
  assert.deepEqual(snapshot.calls[0].statements.map(entry=>entry.rowsRead),[60,40]);
  // The ceilings each dimension stands against travel with the snapshot, so a failure summary
  // names the dimension that failed rather than leaving it to be inferred.
  assert.equal(snapshot.ceilings.rowsRead,MAX_D1_ROWS_READ_PER_CYCLE);
  assert.equal(snapshot.ceilings.rowsWritten,MAX_D1_ROWS_WRITTEN_PER_CYCLE);
  assert.equal(snapshot.ceilings.apiCalls,MAX_D1_API_CALLS_PER_CYCLE);
  // An unrecognised plan kind is coerced into the closed enum, never carried through.
  telemetry.record('../../etc/passwd',{usage:{rowsRead:1,rowsWritten:0},requestBytes:1,statements:[]});
  assert.equal(telemetry.snapshot().calls[2].kind,'read');
});

test('telemetry cannot retain more calls than the production D1 call ceiling',()=>{
  const telemetry=createProductionResourceTelemetry();
  // Far more calls than any cycle can issue: `dispatch` refuses beyond the ceiling long before the
  // recorder is reached, so this can only happen in a test. The storage bound must still hold.
  const attempts=MAX_D1_API_CALLS_PER_CYCLE*8;
  for(let i=0;i<attempts;i++)
    telemetry.record(i%2?'mutation':'read',{usage:{rowsRead:10,rowsWritten:1},requestBytes:5,
      statements:[{rowsRead:10,rowsWritten:1,changes:1}]});
  const snapshot=telemetry.snapshot();
  // The stored array is bound to the production cycle ceiling, and to that exactly — not to a
  // separate number of its own, which is what let the documented and enforced bounds drift apart.
  assert.equal(snapshot.calls.length,MAX_D1_API_CALLS_PER_CYCLE);
  assert.equal(snapshot.storedCalls,MAX_D1_API_CALLS_PER_CYCLE);
  assert.equal(snapshot.ceilings.storedCalls,MAX_D1_API_CALLS_PER_CYCLE);
  assert.ok(snapshot.calls.length<=snapshot.ceilings.apiCalls);
  // The cap truncates storage, never the accounting: cumulative totals and the true dispatched
  // count stay complete, so a capped snapshot can never make a failure summary under-report.
  assert.equal(snapshot.apiCalls,attempts);
  assert.equal(snapshot.cumulativeRowsRead,attempts*10);
  assert.equal(snapshot.cumulativeRowsWritten,attempts*1);
  assert.equal(snapshot.cumulativeRequestBytes,attempts*5);
  // Per-statement storage is bound by the batch statement ceiling for the same reason.
  const wide=createProductionResourceTelemetry();
  wide.record('mutation',{usage:{rowsRead:1,rowsWritten:1},requestBytes:1,
    statements:Array.from({length:500},()=>({rowsRead:1,rowsWritten:1,changes:1}))});
  assert.equal(wide.snapshot().calls[0].statements.length,wide.snapshot().ceilings.statementsPerCall);
  assert.ok(wide.snapshot().ceilings.statementsPerCall<=D1_MAX_BATCH_STATEMENTS);
  // A resume is stricter at runtime than this storage bound, and the storage bound never widens it.
  assert.ok(RESUME_MAX_D1_API_CALLS<MAX_D1_API_CALLS_PER_CYCLE);
});

test('telemetry carries bounded numeric values and fixed enums only, and never provider text',()=>{
  const telemetry=createProductionResourceTelemetry();
  // Everything a hostile response could try to smuggle in is either dropped or coerced.
  telemetry.record('read',{usage:{rowsRead:'not a number',rowsWritten:null},requestBytes:{},
    statements:[{rowsRead:'DROP TABLE',rowsWritten:-5,changes:Infinity,sql:'select 1',params:['x'],url:'https://api.cloudflare.com/x'}]});
  telemetry.plan({structuralRowsRead:'x',projection:{projectedProviderRows:null,amplification:'nope'},
    population:{historicalObservations:'y',currentHeads:undefined,changed:{}}});
  const snapshot=telemetry.snapshot();
  const json=JSON.stringify(snapshot);
  for(const forbidden of ['DROP TABLE','select 1','cloudflare.com','sql','params','url'])
    assert.ok(!json.includes(forbidden),`${forbidden} reached the telemetry snapshot`);
  const scalars=[snapshot.cumulativeRowsRead,snapshot.cumulativeRowsWritten,snapshot.cumulativeRequestBytes,
    snapshot.calls[0].rowsRead,snapshot.calls[0].statements[0].rowsRead,snapshot.calls[0].statements[0].rowsWritten,
    snapshot.calls[0].statements[0].changes,snapshot.plan.structuralRowsRead,snapshot.plan.projectedProviderRows,
    snapshot.plan.historicalObservations,snapshot.plan.currentHeads,snapshot.plan.changed];
  for(const value of scalars)assert.ok(Number.isSafeInteger(value)&&value>=0,String(value));
  // The one deliberate non-integer: the repository's own amplification factor. It is a bounded
  // finite number from this repository, never provider-derived, which is exactly why the contract
  // is "bounded numeric values and fixed enums" rather than "integers only".
  assert.equal(snapshot.plan.amplification,PROVIDER_READ_AMPLIFICATION);
  assert.ok(!Number.isInteger(PROVIDER_READ_AMPLIFICATION));
  assert.ok(Number.isFinite(snapshot.plan.amplification)&&snapshot.plan.amplification>=1&&snapshot.plan.amplification<10);
  // The whole snapshot is frozen, so a later stage cannot mutate the evidence.
  assert.ok(Object.isFrozen(snapshot)&&Object.isFrozen(snapshot.calls)&&Object.isFrozen(snapshot.plan));
});

test('the D1 client keeps the aggregate scalar and adds the per-statement breakdown',async()=>{
  const plan=buildRunRead({runId:'r',sourceRevisionId:DATA_S2_SOURCE_REVISION_ID});
  const client=createD1RestClient({accountId:ACCOUNT,databaseId:PRODUCTION_D1_ID,token:TOKEN,
    transport:async()=>({status:200,json:async()=>({success:true,result:[
      {success:true,results:[],meta:{rows_read:11,rows_written:0,changes:0}}
    ]})})});
  const out=await client.run(plan);
  assert.equal(out.usage.rowsRead,11);
  assert.deepEqual(out.statements.map(entry=>entry.rowsRead),[11]);
  assert.ok(Object.isFrozen(out.statements)&&Object.isFrozen(out.statements[0]));
  // The existing range and type contracts on provider metadata are unchanged.
  for(const meta of [{rows_read:1.5},{rows_read:-1},{rows_read:1000001}]){
    const bad=createD1RestClient({accountId:ACCOUNT,databaseId:PRODUCTION_D1_ID,token:TOKEN,
      transport:async()=>({status:200,json:async()=>({success:true,result:[{success:true,results:[],meta}]})})});
    await assert.rejects(()=>bad.run(plan),/d1_result_contract_invalid_rows_read/);
  }
});

/* ------------------------------------------- pre-mutation refusal writes nothing at all */

test('a predictive refusal writes nothing and classifies as mutation none',async()=>{
  // The incident scenario, wired through the real entry point. The population and the rows
  // Cloudflare has already billed are chosen so that the SUPERSEDED structural gate would let this
  // cycle through — 70,000 billed plus a 47,000-row postflight is 117,000, inside the ceiling —
  // while the corrected provider projection refuses it. That is precisely the gap run 33948145320
  // fell through: it passed the predictive check, mutated production, and only then discovered the
  // envelope was already impossible.
  //
  //   H = 14,000, N = 11,000, D = 0
  //   structural total    2H + 7N + 64                     = 105,064   (inside 125,000)
  //   postflight          (H + D) + 3(N + D)               =  47,000
  //   already billed                                       =  70,000
  //   superseded gate     70,000 + 47,000                  = 117,000   -> ACCEPTED
  //   corrected gate      70,000 + ceil(47,005 x 1.35) + 2,000 = 135,457 -> REFUSED
  const revision={migration_version:3,migration_name:'production_query_plan_indexes',
    source_revision_id:'official-fpl-r1',source_id:'source-official-fpl',revision:1,
    schema_version:'data-s2a-v1',rights_classification:'durable_allowed',retention_allowed:1,
    redistribution_allowed:0,attribution_required:0,attribution_text:null,
    terms_reference:'docs/DATA_SOURCES.md',terms_reviewed_at:'2026-08-26T00:00:00.000Z',
    acquisition_status:'approved_internal_shadow_history',shadow_ingest_allowed:1,
    supersedes_revision_id:null,created_at:'2026-08-26T00:00:00.000Z',
    source_key:'official-fpl',source_kind:'official_fpl'};
  const events=Array.from({length:38},(_,i)=>({id:i+1,name:`GW ${i+1}`,
    deadline_time:new Date(Date.UTC(2026,7,15+i*7)).toISOString()}));
  const teams=Array.from({length:20},(_,i)=>({id:i+1,name:`Team ${i+1}`,short_name:`T${i+1}`,strength:1,
    strength_overall_home:1,strength_overall_away:1,strength_attack_home:1,strength_attack_away:1,
    strength_defence_home:1,strength_defence_away:1}));
  const elements=Array.from({length:400},(_,i)=>({id:i+1,team:i%20+1,element_type:i%4+1,web_name:`P${i}`,
    now_cost:50,status:'a',chance_of_playing_next_round:null,chance_of_playing_this_round:null,
    news:'',news_added:null,selected_by_percent:'1'}));
  const fixtures=Array.from({length:300},(_,i)=>({id:i+1,event:i%38+1,
    kickoff_time:new Date(Date.UTC(2026,8,1+i)).toISOString(),team_h:i%20+1,team_a:(i+1)%20+1,
    team_h_difficulty:2,team_a_difficulty:2}));
  const bootstrap={events,teams,elements,element_types:[{id:1},{id:2},{id:3},{id:4}]};
  // Heads identical to the candidates, so this cycle changes nothing and the refusal is about the
  // read envelope alone rather than about the size of a commit.
  const normal=normaliseOfficialFplHistory({bootstrap,fixtures,season:'2026-27',
    fetchedAt:'2026-09-06T01:17:00.000Z'});
  const heads=normal.candidates.map(row=>({...row,
    value_boolean:row.value_type==='boolean'?Number(row.value_boolean):row.value_boolean}));
  const ok=(results,read)=>({status:200,json:async()=>({success:true,
    result:results.map((rows,index)=>({success:true,results:rows,
      meta:{rows_read:index?0:read,rows_written:0,changes:0}}))})});
  const sent=[];
  const transport=async request=>{
    sent.push(JSON.parse(request.body));
    const body=JSON.parse(request.body),statements=body.batch??[body],sql=statements[0].sql;
    if(sql.includes('schema_migrations'))return ok([[revision]],1);
    if(sql.startsWith('SELECT run_id'))return ok([[]],1);
    if(sql.startsWith('SELECT o.*'))return ok([heads,[{observations:14000}],[{heads:11000}]],70000);
    throw new Error('the cycle reached a request it should never have issued');
  };
  await assert.rejects(()=>runProductionCollection({accountId:ACCOUNT,accountFingerprint:FINGERPRINT,
    databaseId:PRODUCTION_D1_ID,season:'2026-27',token:TOKEN,scheduledAt:'2026-09-06T01:17:00.000Z',
    transport,fetchImpl:async url=>({status:200,
      arrayBuffer:async()=>new TextEncoder().encode(JSON.stringify(
        url.includes('fixtures')?fixtures:bootstrap)).buffer})}),error=>{
      const classification=productionFailureClassification(error);
      // The soft gate, specifically — not the pre-existing structural gate, which this cycle
      // deliberately passes.
      assert.equal(classification.code,'production_projected_read_budget_exceeded');
      // Refused before the start mutation, so nothing was written.
      assert.equal(classification.mutation,PRODUCTION_MUTATION_NONE);
      assert.equal(classification.retryable,false);
      // The bounded resource snapshot survives the failure, which is the whole point of Stage 2.
      assert.equal(classification.resources.cumulativeRowsWritten,0);
      assert.equal(classification.resources.cumulativeRowsRead,70002);
      assert.equal(classification.resources.apiCalls,3);
      assert.ok(!JSON.stringify(classification.resources).includes('SELECT'));
      return true;
    });
  // Exactly three reads were issued, and none of them was a mutation.
  assert.equal(sent.length,3);
  const sql=sent.flatMap(body=>(body.batch??[body]).map(statement=>statement.sql)).join('\n');
  assert.ok(!/\b(INSERT|UPDATE|DELETE|DROP|CREATE)\b/i.test(sql),sql);
  // And the superseded structural gate really would have admitted this cycle, which is what makes
  // the new gate a correction rather than a duplicate of an existing check.
  const structural=estimateStructuralCycleRowsRead({observations:14000,heads:11000,changed:0});
  assert.equal(structural.totalRows,105064);
  assert.ok(structural.totalRows<=MAX_D1_ROWS_READ_PER_CYCLE);
  assert.ok(70000+structural.postflight<=MAX_D1_ROWS_READ_PER_CYCLE);
});

/* -------------------------------------------------- Stage 0 committed-run integrity */

test('the committed run identity is derived from a reviewed constant, never supplied',()=>{
  assert.equal(COMMITTED_RUN_SCHEDULED_AT,'2026-09-05T05:48:00.000Z');
  assert.equal(COMMITTED_RUN_WORKFLOW_RUN,'33948145320');
  // Pinned: this derivation is exactly the run id the incident record names.
  assert.equal(productionRunIdFor(COMMITTED_RUN_SCHEDULED_AT),'gha-e385726067648e08d44f8870df35ada41aa9b0f4');
  // No SQL, table, statement, column or database identifier is accepted anywhere on the surface.
  assert.doesNotMatch(integrityExecutable,/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|PRAGMA)\b/);
  assert.doesNotMatch(integrityExecutable,/process\.env\.(?!GITHUB_STEP_SUMMARY|GITHUB_RUN_ATTEMPT|APPROVED_SHA)/);
  // It reuses the reviewed production D1 constant and never a workflow-supplied identifier.
  assert.match(helperSource,/databaseId!==PRODUCTION_D1_ID/);
  assert.doesNotMatch(workflow,/CLOUDFLARE_PRODUCTION_D1_ID/);
  assert.doesNotMatch(workflow,new RegExp(PRODUCTION_D1_ID));
});

test('the Stage 0 workflow is dispatch-only, protected and creates no credential',()=>{
  assert.match(workflow,/^on:\n  workflow_dispatch:/m);
  for(const trigger of ['schedule:','push:','pull_request:','repository_dispatch:','workflow_call:','workflow_run:'])
    assert.ok(!uncommented(workflow).includes(trigger),trigger);
  assert.doesNotMatch(uncommented(workflow),/cron/);
  // It reuses an existing protected environment; it does not create or widen one.
  assert.match(workflow,/environment:\n      name: data-s2-production-collection/);
  assert.match(workflow,/permissions:\n  contents: read\n  checks: read/);
  // The PR #215 identifier protections are preserved exactly: the fingerprint mask is registered
  // by the credentialled job's FIRST step, before the variable is ever materialised.
  const credentialled=workflow.slice(workflow.indexOf('committed-run-integrity:'));
  assert.ok(credentialled.indexOf('Register production identifier masks before any other step')
    <credentialled.indexOf('CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT'));
  // A workflow re-run is refused by the entry point, not by the workflow file.
  assert.match(entrySource,/GITHUB_RUN_ATTEMPT!=='1'/);
  assert.match(entrySource,/workflow_retry_forbidden/);
  // Nothing in it can deploy, migrate, collect, resume or touch a schedule.
  for(const forbidden of ['wrangler deploy','run-production-collection','run-production-resume','run-migration','schedule'])
    assert.ok(!uncommented(workflow).includes(forbidden),forbidden);
});

test('the Stage 0 runner is read-only, bounded, and imports no mutation builder',()=>{
  assert.equal(COMMITTED_RUN_INTEGRITY_STATEMENT_COUNT,1);
  assert.equal(COMMITTED_RUN_INTEGRITY_MAX_D1_API_CALLS,1);
  assert.equal(COMMITTED_RUN_INTEGRITY_MAX_ROWS_WRITTEN,0);
  // Bounded, and comfortably under the unchanged cycle ceiling it must never reinterpret.
  assert.equal(COMMITTED_RUN_INTEGRITY_MAX_ROWS_READ,75000);
  assert.ok(COMMITTED_RUN_INTEGRITY_MAX_ROWS_READ<MAX_D1_ROWS_READ_PER_CYCLE);
  // Above the conservatively amplified projection of the one postflight read it issues.
  const structural=estimateStructuralCycleRowsRead({observations:10892,heads:10146,changed:264});
  assert.ok(COMMITTED_RUN_INTEGRITY_MAX_ROWS_READ>Math.ceil(structural.postflight*PROVIDER_READ_AMPLIFICATION));
  // No mutation plan builder is reachable from the helper or the entry point.
  for(const source of [helperSource,entrySource])
    for(const builder of ['buildCommitBatch','buildStartRunMutation','buildFailRunMutation',
      'buildCompleteUnchangedMutation','buildMigration0003Mutation'])
      assert.ok(!source.includes(builder),builder);
  // It reuses the production postflight read and validator rather than defining its own.
  assert.match(helperSource,/buildProductionPostflightRead/);
  assert.match(helperSource,/validateProductionPostflight/);
  // And it deliberately does NOT reuse the first-run reconciliation contract, whose pinning to the
  // untouched `started` first run would be semantically wrong for a completed run.
  assert.ok(!helperSource.includes('first-run-reconciliation-contract'));
  assert.ok(!helperSource.includes('FIRST_PRODUCTION_RUN_SCHEDULED_AT'));
});

test('the Stage 0 classification set is fixed and every outcome falls inside it',()=>{
  assert.deepEqual([...COMMITTED_RUN_INTEGRITY_CLASSIFICATIONS],
    [COMMITTED_STATE_VALID,COMMITTED_STATE_INVALID,COMMITTED_STATE_AMBIGUOUS]);
  assert.equal(COMMITTED_STATE_VALID,'COMMITTED_STATE_VALID');
  assert.equal(COMMITTED_STATE_INVALID,'COMMITTED_STATE_INVALID_REQUIRES_OWNER_ATTENTION');
  assert.equal(COMMITTED_STATE_AMBIGUOUS,'AMBIGUOUS_REQUIRES_OWNER_ATTENTION');
  // An unrecognised or absent classification is ambiguous, never optimistically valid.
  for(const error of [new Error('x'),{},{integrityClassification:'COMMITTED_STATE_VALID_ISH'}])
    assert.equal(committedRunIntegrityClassification(error).classification,COMMITTED_STATE_AMBIGUOUS);
  // The sanitized shape carries no free-form text.
  const sanitized=committedRunIntegrityClassification(
    Object.assign(new Error('https://api.cloudflare.com/client/v4/accounts/secret/d1'),{integrityPhase:'dispatch'}));
  assert.equal(sanitized.code,'unclassified');
  assert.equal(sanitized.retryable,false);
  assert.ok(!JSON.stringify(sanitized).includes('cloudflare'));
});

test('the Stage 0 contract accepts a valid committed state and rejects every degraded one',()=>{
  const runId=productionRunIdFor(COMMITTED_RUN_SCHEDULED_AT);
  const valid={run_id:runId,status:'completed',records_seen:9000,records_accepted:264,
    records_quarantined:0,records_rejected:0,error_class:null,observations:10892,run_observations:264,
    logical_keys:10146,non_accepted:0,quarantined_observations:0,heads:10146,orphan_heads:0,
    invalid_heads:0,rejections:0};
  const state=validateCommittedRunIntegrity([valid],{runId,validateProductionPostflight});
  assert.equal(state.classification,COMMITTED_STATE_VALID);
  assert.equal(state.run.recordsAccepted,264);
  assert.equal(state.integrity.orphan_heads,0);
  assert.equal(state.integrity.heads,10146);
  // Every substantive postflight comparison still bites. The two that become tautological by
  // construction — records_seen and records_accepted — are excluded here on purpose and are
  // documented as such in the contract.
  const degraded=[
    ['status',{status:'started'}],['error_class',{error_class:'production_d1_budget_exceeded'}],
    ['run_observations',{run_observations:263}],['quarantined',{records_quarantined:1}],
    ['rejected',{records_rejected:1}],['non_accepted',{non_accepted:1}],
    ['quarantined_observations',{quarantined_observations:1}],['orphan_heads',{orphan_heads:1}],
    ['invalid_heads',{invalid_heads:1}],['rejections',{rejections:1}],
    ['heads versus logical keys',{heads:10145}]
  ];
  for(const [label,patch] of degraded)
    assert.throws(()=>validateCommittedRunIntegrity([{...valid,...patch}],{runId,validateProductionPostflight}),
      error=>error.integrityClassification===COMMITTED_STATE_INVALID,label);
  // Undecidable input is ambiguous, never invalid and never silently zero.
  for(const rows of [[],[valid,valid],[null],[{...valid,run_id:'gha-someone-else'}],
    [{...valid,observations:null}],[{...valid,heads:'lots'}]])
    assert.throws(()=>validateCommittedRunIntegrity(rows,{runId,validateProductionPostflight}),
      error=>error.integrityClassification===COMMITTED_STATE_AMBIGUOUS,JSON.stringify(rows));
});

test('the Stage 0 runner issues exactly one read-only request and refuses a written row',async()=>{
  const runId=productionRunIdFor(COMMITTED_RUN_SCHEDULED_AT);
  const row={run_id:runId,status:'completed',records_seen:9000,records_accepted:264,
    records_quarantined:0,records_rejected:0,error_class:null,observations:10892,run_observations:264,
    logical_keys:10146,non_accepted:0,quarantined_observations:0,heads:10146,orphan_heads:0,
    invalid_heads:0,rejections:0};
  const bodies=[];
  const respond=meta=>async request=>{bodies.push(JSON.parse(request.body));
    return {status:200,json:async()=>({success:true,result:[{success:true,results:[row],meta}]})};};
  const result=await verifyCommittedProductionRun({accountId:ACCOUNT,accountFingerprint:FINGERPRINT,
    databaseId:PRODUCTION_D1_ID,token:TOKEN,transport:respond({rows_read:42000,rows_written:0,changes:0})});
  assert.equal(result.classification,COMMITTED_STATE_VALID);
  assert.equal(result.mutationIssued,false);
  assert.equal(result.d1.apiCalls,1);
  assert.equal(result.d1.rowsWritten,0);
  assert.equal(bodies.length,1);
  assert.ok(!bodies[0].batch,'exactly one statement, not a batch');
  assert.equal(bodies[0].sql,
    buildProductionPostflightRead({runId,sourceRevisionId:DATA_S2_SOURCE_REVISION_ID}).statements[0].sql);
  // Any written row at all, and any read above the bound, fails closed as ambiguous.
  for(const [meta,code] of [
    [{rows_read:10,rows_written:1,changes:1},/read_only_violation/],
    [{rows_read:COMMITTED_RUN_INTEGRITY_MAX_ROWS_READ+1,rows_written:0,changes:0},/resource_ceiling_exceeded/]
  ]){
    await assert.rejects(()=>verifyCommittedProductionRun({accountId:ACCOUNT,accountFingerprint:FINGERPRINT,
      databaseId:PRODUCTION_D1_ID,token:TOKEN,transport:respond(meta)}),error=>{
        assert.match(error.message,code);
        assert.equal(error.integrityClassification,COMMITTED_STATE_AMBIGUOUS);
        return true;});
  }
  // Identity failures stop before any request is issued.
  const before=bodies.length;
  for(const options of [
    {accountId:ACCOUNT,accountFingerprint:'0'.repeat(64),databaseId:PRODUCTION_D1_ID,token:TOKEN,transport:respond({})},
    {accountId:ACCOUNT,accountFingerprint:FINGERPRINT,databaseId:'not-the-production-database',token:TOKEN,transport:respond({})}
  ])await assert.rejects(()=>verifyCommittedProductionRun(options),/production_(account_fingerprint|d1_identity)_mismatch/);
  assert.equal(bodies.length,before);
});

test('a transport failure never carries a request URL into the sanitized classification',async()=>{
  const leak=new Error('connect ECONNREFUSED https://api.cloudflare.com/client/v4/accounts/abc/d1/database/def/query');
  await assert.rejects(()=>verifyCommittedProductionRun({accountId:ACCOUNT,accountFingerprint:FINGERPRINT,
    databaseId:PRODUCTION_D1_ID,token:TOKEN,transport:async()=>{throw leak;}}),error=>{
      // The original error object is discarded rather than rethrown, so nothing derived from it
      // can reach a log or a summary.
      assert.notEqual(error,leak);
      assert.ok(!error.message.includes('cloudflare'));
      const sanitized=committedRunIntegrityClassification(error);
      assert.ok(!JSON.stringify(sanitized).includes('cloudflare'));
      assert.ok(!JSON.stringify(sanitized).includes(ACCOUNT));
      return true;});
  // The entry point likewise rethrows a fixed code, never the underlying object.
  assert.match(entrySource,/throw new Error\('committed_run_integrity_stopped'\)/);
});

/* ------------------------------------------------- the scheduler is untouched here */

test('this remediation changes no schedule, cron, ceiling or scheduler state',()=>{
  const scheduled=fs.readFileSync(scheduledWorkflowPath,'utf8');
  // The permanent approved cadence, unchanged, and still exactly one trigger.
  assert.equal(PRODUCTION_COLLECTION_SCHEDULE,'17 1 * * *');
  assert.match(scheduled,/^on:\n  schedule:\n    - cron: '17 1 \* \* \*'\n/m);
  assert.equal((uncommented(scheduled).match(/cron:/g)||[]).length,1);
  assert.equal((uncommented(scheduled).match(/- cron:/g)||[]).length,1);
  assert.ok(!uncommented(scheduled).includes('workflow_dispatch'));
  assert.match(scheduled,/test "\$EVENT_SCHEDULE" = '17 1 \* \* \*'/);
  // The unchanged ceilings.
  assert.equal(MAX_D1_ROWS_READ_PER_CYCLE,125000);
  assert.equal(EXPECTED_D1_ROWS_READ_PER_CYCLE,100000);
  assert.equal(MAX_D1_ROWS_WRITTEN_PER_CYCLE,40000);
  assert.equal(MAX_D1_API_CALLS_PER_CYCLE,8);
  // No migration 0004 exists, and no new index was introduced.
  const migrations=fs.readdirSync('workers/data-platform/migrations').filter(name=>/^\d{4}_/.test(name)).sort();
  assert.deepEqual(migrations,['0001_shadow_data_foundation.sql','0002_official_fpl_structured_history.sql',
    '0003_production_query_plan_indexes.sql']);
  const indexes=migrations.flatMap(name=>
    (fs.readFileSync(`workers/data-platform/migrations/${name}`,'utf8').match(/CREATE (?:UNIQUE )?INDEX (\w+)/g)||[]));
  assert.equal(indexes.length,5);
  // Cloudflare Cron stays intentionally absent from the forward path.
  assert.ok(!fs.readdirSync('.github/workflows').some(name=>/cron/.test(name)&&!/phase4b/.test(name)));
});
