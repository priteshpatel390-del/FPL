import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {buildFirstRunReconciliationRead,inspectOfficialFplD1RestPlan} from '../workers/data-platform/official-fpl-d1-rest-plan.mjs';
import {
  exactUntouchedStartedRun,FIRST_RUN_RECONCILIATION_COUNTERS,FIRST_RUN_RECONCILIATION_MAX_D1_API_CALLS,
  FIRST_RUN_RECONCILIATION_MAX_ROWS_PER_STATEMENT,FIRST_RUN_RECONCILIATION_MAX_ROWS_READ,
  FIRST_RUN_RECONCILIATION_MAX_ROWS_WRITTEN,FIRST_RUN_RECONCILIATION_STATEMENT_COUNT,
  firstRunReconciliationClassification,RESUME_RECONCILIATION_AMBIGUOUS,RESUME_RECONCILIATION_BLOCKED,
  RESUME_RECONCILIATION_SAFE,validateFirstRunReconciliation
} from '../workers/data-platform/resume/first-run-reconciliation-contract.mjs';
import {reconcileFirstProductionRun} from '../workers/data-platform/resume/reconcile-first-production-run.mjs';
import {
  estimateStructuralCycleRowsRead,EXPECTED_D1_ROWS_READ_PER_CYCLE,FIRST_PRODUCTION_RUN_SCHEDULED_AT,
  MAX_D1_API_CALLS_PER_CYCLE,MAX_D1_ROWS_READ_PER_CYCLE,MAX_D1_ROWS_WRITTEN_PER_CYCLE,
  PRODUCTION_D1_ID,PRODUCTION_SEASON,productionRunIdFor,RESUME_MAX_D1_API_CALLS,
  RESUME_MAX_MUTATION_REQUESTS,RESUME_REFERENCE_POPULATION,runProductionCollection
} from '../workers/data-platform/production-collection.mjs';
import {
  DATA_S2_SCHEMA_VERSION,DATA_S2_SOURCE_REVISION_ID,DATA_S2_TRANSFORM_VERSION,DATA_S2_VALIDATION_VERSION
} from '../workers/data-platform/official-fpl-canonical.mjs';
import {resolveProductionIdentity} from '../workers/data-platform/production-identity.mjs';

const uncommented=source=>source.split('\n').filter(line=>!/^\s*(#|\/\/)/.test(line)).join('\n');
const read=file=>fs.readFileSync(file,'utf8');

const contractPath='workers/data-platform/resume/first-run-reconciliation-contract.mjs';
const helperPath='workers/data-platform/resume/reconcile-first-production-run.mjs';
const entryPath='workers/data-platform/run-first-run-reconciliation.mjs';
const resumeEntryPath='workers/data-platform/run-production-resume.mjs';
const reconciliationWorkflowPath='.github/workflows/data-s2-first-run-reconciliation.yml';
const resumeWorkflowPath='.github/workflows/data-s2-production-resume.yml';

const contractSource=read(contractPath);
const helperSource=read(helperPath);
const entrySource=read(entryPath);
const resumeEntrySource=read(resumeEntryPath);
const identitySource=read('workers/data-platform/production-identity.mjs');
const executableCode=uncommented(`${contractSource}\n${helperSource}\n${entrySource}`);
const reconciliationWorkflow=read(reconciliationWorkflowPath);
const resumeWorkflow=read(resumeWorkflowPath);

const ACCOUNT='data-s2b-first-run-reconciliation-account';
const FINGERPRINT=createHash('sha256').update(ACCOUNT).digest('hex');
const TOKEN='data-s2b-first-run-reconciliation-token';
const RUN_ID=productionRunIdFor(FIRST_PRODUCTION_RUN_SCHEDULED_AT);

/* --------------------------------------------------------------- expected pre-state */

const governanceRow=()=>({migration_version:3,migration_name:'production_query_plan_indexes',
  source_revision_id:DATA_S2_SOURCE_REVISION_ID,schema_version:DATA_S2_SCHEMA_VERSION,
  rights_classification:'durable_allowed',retention_allowed:1,redistribution_allowed:0,
  shadow_ingest_allowed:1,acquisition_status:'approved_internal_shadow_history',
  source_key:'official-fpl',source_kind:'official_fpl'});

const startedRow=(overrides={})=>({run_id:RUN_ID,source_revision_id:DATA_S2_SOURCE_REVISION_ID,
  run_type:'official_fpl_structured_history',mode:'shadow_only',
  started_at:FIRST_PRODUCTION_RUN_SCHEDULED_AT,completed_at:null,status:'started',
  safe_endpoint_class:'official_fpl_public_core',parser_version:DATA_S2_VALIDATION_VERSION,
  transform_version:DATA_S2_TRANSFORM_VERSION,schema_version:DATA_S2_SCHEMA_VERSION,
  records_seen:0,records_accepted:0,records_quarantined:0,records_rejected:0,error_class:null,
  ...overrides});

const integrityRow=(overrides={})=>({run_observations:0,run_heads:0,run_rejections:0,
  revision_runs:3,started_runs:1,completed_runs:1,other_runs:1,...overrides});

const safeState=(overrides={})=>[[governanceRow()],[startedRow(overrides.run)],[integrityRow(overrides.integrity)]];
const validate=statements=>validateFirstRunReconciliation(statements,
  {runId:RUN_ID,startedAt:FIRST_PRODUCTION_RUN_SCHEDULED_AT});
const thrown=statements=>{
  try{validate(statements);}catch(error){return error;}
  throw new Error('the contract accepted a state it must reject');
};
const classify=statements=>firstRunReconciliationClassification(thrown(statements)).classification;

/* ------------------------------------------------------------------- plan builder */

test('the reconciliation read is trusted, read-only and takes no SQL, table or statement input',()=>{
  const plan=buildFirstRunReconciliationRead({runId:RUN_ID,sourceRevisionId:DATA_S2_SOURCE_REVISION_ID});
  assert.equal(inspectOfficialFplD1RestPlan(plan),plan);
  assert.equal(plan.kind,'read');
  assert.equal(plan.mutation,false);
  assert.equal(plan.statements.length,FIRST_RUN_RECONCILIATION_STATEMENT_COUNT);
  assert.ok(Object.isFrozen(plan)&&Object.isFrozen(plan.statements));
  for(const statement of plan.statements){
    assert.ok(statement.sql.startsWith('SELECT '),statement.sql.slice(0,24));
    assert.doesNotMatch(statement.sql,/\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|REPLACE|PRAGMA|ATTACH|EXPLAIN)\b/);
  }
  // Only the two identifiers the production SQL already binds are accepted, and only as params.
  const injected=buildFirstRunReconciliationRead({runId:RUN_ID,sourceRevisionId:DATA_S2_SOURCE_REVISION_ID,
    sql:'DROP TABLE observation_heads',statements:[{sql:'DELETE FROM shadow_observations'}],table:'x'});
  assert.deepEqual(injected.statements.map(row=>row.sql),plan.statements.map(row=>row.sql));
  for(const bad of [{runId:'',sourceRevisionId:DATA_S2_SOURCE_REVISION_ID},{runId:RUN_ID,sourceRevisionId:''},{}])
    assert.throws(()=>buildFirstRunReconciliationRead(bad),/official_fpl_plan_(run|source_revision)_invalid/);
  // Identity is pinned: the run and revision only ever appear as bound parameters.
  for(const statement of plan.statements)assert.ok(!statement.sql.includes(RUN_ID));
  assert.deepEqual([...plan.statements[1].params],[RUN_ID,DATA_S2_SOURCE_REVISION_ID]);
});

test('no mutation verb, plan or repair surface is reachable from the reconciliation mechanism',()=>{
  assert.doesNotMatch(executableCode,/\b(INSERT INTO|UPDATE |DELETE FROM|CREATE INDEX|CREATE TABLE|DROP |ALTER )/);
  for(const forbidden of [/buildCommitBatch/,/buildStartRunMutation/,/buildFailRunMutation/,
    /buildCompleteUnchangedMutation/,/buildMigration0003Mutation/,/runProductionCollection/,
    /applyMigration0003/,/wrangler/i,/schedules/,/cron/i,/deployments/,/versions/])
    assert.doesNotMatch(executableCode,forbidden,String(forbidden));
  // The only D1 plan the helper can build is the fixed reconciliation read.
  assert.deepEqual([...new Set([...uncommented(helperSource).matchAll(/build[A-Za-z0-9]+/g)].map(row=>row[0]))],
    ['buildFirstRunReconciliationRead']);
  assert.match(helperSource,/resumed:false/);
});

/* ------------------------------------------------- local SQLite proof of the fixed SQL */

const migration=name=>read(`workers/data-platform/migrations/${name}`);
const sqlite=(db,input)=>{const out=spawnSync('sqlite3',[db],{input,encoding:'utf8'});if(out.status!==0)throw new Error(out.stderr);return out.stdout;};

function database(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'data-s2b-reconcile-')),db=path.join(dir,'schema.db');
  sqlite(db,migration('0001_shadow_data_foundation.sql')+migration('0002_official_fpl_structured_history.sql')
    +migration('0003_production_query_plan_indexes.sql'));
  sqlite(db,`INSERT INTO ingestion_runs VALUES('${RUN_ID}','${DATA_S2_SOURCE_REVISION_ID}','official_fpl_structured_history','shadow_only','${FIRST_PRODUCTION_RUN_SCHEDULED_AT}',NULL,'started','official_fpl_public_core','${DATA_S2_VALIDATION_VERSION}','${DATA_S2_TRANSFORM_VERSION}','${DATA_S2_SCHEMA_VERSION}',0,0,0,0,NULL,'${FIRST_PRODUCTION_RUN_SCHEDULED_AT}');`);
  return {db,dir};
}

test('the fixed integrity statement runs against the real schema and answers zero for the pinned run',()=>{
  const {db,dir}=database();
  try{
    const plan=inspectOfficialFplD1RestPlan(buildFirstRunReconciliationRead(
      {runId:RUN_ID,sourceRevisionId:DATA_S2_SOURCE_REVISION_ID}));
    let index=0;
    const sql=plan.statements[2].sql.replace(/\?/g,()=>`'${plan.statements[2].params[index++]}'`);
    const values=sqlite(db,`.mode list\n.headers on\n${sql};`).trim().split('\n');
    assert.deepEqual(values[0].split('|'),[...FIRST_RUN_RECONCILIATION_COUNTERS]);
    assert.deepEqual(values[1].split('|'),['0','0','0','1','1','0','0']);
    // The high-volume paths are index-supported, so the proof never scans a population table.
    // The small ingestion_runs counters have no source-revision-leading index and are bounded by
    // the reconciliation's provider rows-read ceiling instead, so they are not asserted here.
    const explained=sqlite(db,`EXPLAIN QUERY PLAN ${sql};`);
    assert.doesNotMatch(explained,/SCAN shadow_observations\b/);
    assert.doesNotMatch(explained,/SCAN observation_heads\b/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

/* --------------------------------------------------------------------- classification */

test('the exact expected pre-state is the only SAFE classification and pins the run identity',()=>{
  const state=validate(safeState());
  assert.equal(state.classification,RESUME_RECONCILIATION_SAFE);
  assert.equal(state.runId,RUN_ID);
  assert.equal(state.startedAt,FIRST_PRODUCTION_RUN_SCHEDULED_AT);
  assert.deepEqual({...state.integrity},integrityRow());
  assert.equal(state.run.status,'started');
  assert.equal(state.run.recordsAccepted,0);
  // A different run id or a different immutable start time is never the pinned run.
  for(const identity of [{runId:'gha-other',startedAt:FIRST_PRODUCTION_RUN_SCHEDULED_AT},
    {runId:RUN_ID,startedAt:'2026-09-02T17:42:00.000Z'}])
    assert.throws(()=>validateFirstRunReconciliation(safeState(),identity),/run_row_not_untouched/);
  assert.equal(exactUntouchedStartedRun(startedRow(),{runId:RUN_ID,startedAt:FIRST_PRODUCTION_RUN_SCHEDULED_AT}),true);
});

test('a partially written, completed, failed or drifted run is BLOCKED and never repaired',()=>{
  const cases=[
    [safeState({integrity:{run_observations:1}}),/partial_run_observations/],
    [safeState({integrity:{run_heads:1}}),/partial_run_heads/],
    [safeState({integrity:{run_rejections:1}}),/partial_run_rejections/],
    [safeState({integrity:{started_runs:2}}),/unresolved_run_population_unexpected/],
    [safeState({integrity:{started_runs:0}}),/unresolved_run_population_unexpected/],
    [safeState({integrity:{revision_runs:0}}),/run_population_unexpected/],
    [safeState({run:{status:'completed'}}),/run_already_completed/],
    [safeState({run:{status:'failed'}}),/run_status_unexpected/],
    [safeState({run:{records_accepted:5}}),/run_row_not_untouched/],
    [safeState({run:{records_seen:1}}),/run_row_not_untouched/],
    [safeState({run:{completed_at:'2026-09-02T18:00:00.000Z'}}),/run_row_not_untouched/],
    [safeState({run:{error_class:'d1_result_contract_invalid'}}),/run_row_not_untouched/],
    [safeState({run:{schema_version:'other'}}),/run_row_not_untouched/],
    [[[governanceRow()],[],[integrityRow()]],/run_row_absent/],
    [[[],[startedRow()],[integrityRow()]],/governance_absent/],
    [[[{...governanceRow(),migration_version:2}],[startedRow()],[integrityRow()]],/governance_mismatch/],
    [[[{...governanceRow(),retention_allowed:0}],[startedRow()],[integrityRow()]],/governance_mismatch/]
  ];
  for(const [statements,code] of cases){
    assert.throws(()=>validate(statements),code,String(code));
    assert.equal(classify(statements),RESUME_RECONCILIATION_BLOCKED,String(code));
  }
  // Nothing in the contract can repair, complete or delete anything.
  assert.doesNotMatch(uncommented(contractSource),/repair|complete\(|DELETE|UPDATE/i);
});

test('a malformed, unbounded or undecidable result fails closed as owner attention',()=>{
  const oversized=Array.from({length:FIRST_RUN_RECONCILIATION_MAX_ROWS_PER_STATEMENT+1},()=>integrityRow());
  const cases=[
    'not-an-array',
    [[governanceRow()],[startedRow()]],
    [[governanceRow()],[startedRow()],[integrityRow()],[integrityRow()]],
    [[governanceRow()],[startedRow()],[]],
    [[governanceRow()],[startedRow()],oversized],
    [[governanceRow()],[startedRow()],[integrityRow({run_observations:-1})]],
    [[governanceRow()],[startedRow()],[integrityRow({run_observations:'many'})]],
    [[governanceRow()],[startedRow()],[integrityRow({started_runs:null})]],
    [[governanceRow()],[startedRow()],['not-a-row']],
    [[governanceRow()],['not-a-row'],[integrityRow()]]
  ];
  for(const statements of cases)assert.equal(classify(statements),RESUME_RECONCILIATION_AMBIGUOUS,JSON.stringify(statements).slice(0,60));
  for(const identity of [{runId:'',startedAt:FIRST_PRODUCTION_RUN_SCHEDULED_AT},{runId:RUN_ID,startedAt:''}])
    assert.equal(firstRunReconciliationClassification(
      (()=>{try{validateFirstRunReconciliation(safeState(),identity);}catch(error){return error;}})()).classification,
      RESUME_RECONCILIATION_AMBIGUOUS);
  // An unclassified or hostile failure defaults to owner attention and is never retryable.
  const unknown=firstRunReconciliationClassification(new Error('Bearer sk-live-secret leaked'));
  assert.deepEqual(unknown,{classification:RESUME_RECONCILIATION_AMBIGUOUS,phase:null,code:'unclassified',
    d1:null,retryable:false});
});

/* ------------------------------------------------------------- read-only executable */

const response=(statements,meta={})=>({status:200,json:async()=>({success:true,
  result:statements.map((rows,index)=>({success:true,results:rows,
    meta:{rows_read:index===0?meta.rows_read??2:0,rows_written:index===0?meta.rows_written??0:0,changes:0}}))})});

const reconcile=(step,overrides={})=>{
  const requests=[];
  const transport=async request=>{
    requests.push({...JSON.parse(request.body),__url:request.url,__method:request.method});
    return typeof step==='function'?step():step;
  };
  return {requests,promise:reconcileFirstProductionRun({accountId:ACCOUNT,accountFingerprint:FINGERPRINT,
    databaseId:PRODUCTION_D1_ID,token:TOKEN,transport,...overrides})};
};

test('exactly one read-only request is issued and the SAFE result is bounded and sanitized',async()=>{
  const {requests,promise}=reconcile(response(safeState()));
  const result=await promise;
  assert.equal(result.classification,RESUME_RECONCILIATION_SAFE);
  assert.equal(result.mutationIssued,false);
  assert.equal(result.resumed,false);
  assert.equal(result.d1.apiCalls,FIRST_RUN_RECONCILIATION_MAX_D1_API_CALLS);
  assert.equal(result.d1.rowsWritten,0);
  assert.equal(requests.length,1);
  assert.equal(requests[0].__method,'POST');
  assert.match(requests[0].__url,/^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/[^/]+\/d1\/database\/[^/]+\/query$/);
  const sent=(requests[0].batch??[requests[0]]).map(entry=>entry.sql);
  assert.equal(sent.length,FIRST_RUN_RECONCILIATION_STATEMENT_COUNT);
  for(const sql of sent)assert.ok(sql.startsWith('SELECT '),sql.slice(0,24));
  const rendered=JSON.stringify(result);
  for(const secret of [TOKEN,ACCOUNT,PRODUCTION_D1_ID,FINGERPRINT])assert.ok(!rendered.includes(secret),secret);
});

test('identity and configuration surfaces fail closed before any request',async()=>{
  for(const [overrides,code] of [
    [{databaseId:'not-the-production-database'},/production_d1_identity_mismatch/],
    [{accountFingerprint:'0'.repeat(64)},/production_account_fingerprint_mismatch/],
    [{accountFingerprint:'nothex'},/production_account_fingerprint_mismatch/],
    [{season:PRODUCTION_SEASON},/first_run_reconciliation_config_invalid/]
  ]){
    const {requests,promise}=reconcile(response(safeState()),overrides);
    await assert.rejects(promise,code);
    assert.equal(requests.length,0);
  }
});

test('a written row, a resource overrun or a lost response is never accepted and never retried',async()=>{
  for(const [step,code] of [
    [response(safeState(),{rows_written:1}),/first_run_reconciliation_read_only_violation/],
    [response(safeState(),{rows_read:FIRST_RUN_RECONCILIATION_MAX_ROWS_READ+1}),/first_run_reconciliation_resource_ceiling_exceeded/],
    [response(safeState().slice(0,2)),/d1_result_contract_invalid|first_run_reconciliation_statement_cardinality_invalid/],
    [()=>{throw new Error('boom');},/d1_transport_failed/],
    [{status:500},/d1_http_failed/]
  ]){
    const {requests,promise}=reconcile(step);
    const error=await promise.then(()=>null,failure=>failure);
    assert.match(String(error.message),code);
    const classification=firstRunReconciliationClassification(error);
    assert.equal(classification.classification,RESUME_RECONCILIATION_AMBIGUOUS);
    assert.equal(classification.retryable,false);
    // Exactly one request on every path; the runner never retries inside an execution.
    assert.equal(requests.length,FIRST_RUN_RECONCILIATION_MAX_D1_API_CALLS);
  }
});

test('a BLOCKED live state is reported as blocked and still issues exactly one request',async()=>{
  const {requests,promise}=reconcile(response(safeState({integrity:{run_observations:7}})));
  const error=await promise.then(()=>null,failure=>failure);
  assert.equal(firstRunReconciliationClassification(error).classification,RESUME_RECONCILIATION_BLOCKED);
  assert.equal(firstRunReconciliationClassification(error).phase,'acceptance');
  assert.equal(requests.length,1);
});

test('the reconciliation resource contract is separate from and far below the routine ceilings',()=>{
  assert.equal(FIRST_RUN_RECONCILIATION_MAX_D1_API_CALLS,1);
  assert.equal(FIRST_RUN_RECONCILIATION_MAX_ROWS_WRITTEN,0);
  assert.ok(FIRST_RUN_RECONCILIATION_MAX_ROWS_READ<MAX_D1_ROWS_READ_PER_CYCLE/100);
  // The routine collection ceilings are untouched by this checkpoint.
  assert.equal(MAX_D1_ROWS_READ_PER_CYCLE,125000);
  assert.equal(MAX_D1_ROWS_WRITTEN_PER_CYCLE,40000);
  assert.equal(MAX_D1_API_CALLS_PER_CYCLE,8);
});

/* --------------------------------------------------------------- resume runtime gate */

function world(){
  const events=Array.from({length:38},(_,i)=>({id:i+1,name:`GW ${i+1}`,deadline_time:new Date(Date.UTC(2026,7,15+i*7)).toISOString()}));
  const teams=Array.from({length:20},(_,i)=>({id:i+1,name:`Team ${i+1}`,short_name:`T${i+1}`,strength:1,strength_overall_home:1,strength_overall_away:1,strength_attack_home:1,strength_attack_away:1,strength_defence_home:1,strength_defence_away:1}));
  const elements=Array.from({length:400},(_,i)=>({id:i+1,team:i%20+1,element_type:i%4+1,web_name:`P${i}`,now_cost:50,status:'a',chance_of_playing_next_round:null,chance_of_playing_this_round:null,news:'',news_added:null,selected_by_percent:'1'}));
  const fixtures=Array.from({length:300},(_,i)=>({id:i+1,event:i%38+1,kickoff_time:new Date(Date.UTC(2026,8,1+i)).toISOString(),team_h:i%20+1,team_a:(i+1)%20+1,team_h_difficulty:2,team_a_difficulty:2}));
  return [{events,teams,elements,element_types:[{id:1},{id:2},{id:3},{id:4}]},fixtures];
}
const okBody=json=>({status:200,arrayBuffer:async()=>new TextEncoder().encode(JSON.stringify(json)).buffer});
const officialFetch=async url=>okBody(world()[url.includes('fixtures')?1:0]);
const d1=(results,meta={})=>({status:200,json:async()=>({success:true,
  result:results.map(rows=>({success:true,results:rows,meta:{rows_read:meta.rows_read??1,rows_written:meta.rows_written??0,changes:0}}))})});

function resumeHarness(steps){
  const plans=[];
  const transport=async request=>{
    const body=JSON.parse(request.body);
    plans.push((body.batch??[body]).map(entry=>entry.sql));
    const step=steps[plans.length-1];
    if(!step)throw new Error(`unexpected_request_${plans.length}`);
    return typeof step==='function'?step():step;
  };
  return {plans,run:overrides=>runProductionCollection({accountId:ACCOUNT,accountFingerprint:FINGERPRINT,
    databaseId:PRODUCTION_D1_ID,season:PRODUCTION_SEASON,token:TOKEN,
    scheduledAt:FIRST_PRODUCTION_RUN_SCHEDULED_AT,resumeStarted:true,transport,fetchImpl:officialFetch,
    clock:()=>new Date('2026-09-03T09:00:00.000Z'),...overrides})};
}

test('a resume proves the unresolved run read-only before it fetches or mutates anything',async()=>{
  const {plans,run}=resumeHarness([d1(safeState()),d1([[],[{observations:0}],[{heads:0}]])]);
  // The population read is reached only because the reconciliation classified SAFE. The run then
  // stops at the pre-commit write gate, so no mutation is ever dispatched.
  await assert.rejects(run(),/write_budget_exceeded/);
  assert.equal(plans.length,2);
  assert.ok(!plans.flat().some(sql=>/INSERT|UPDATE|DELETE/.test(sql)));
  assert.equal(plans[0].length,FIRST_RUN_RECONCILIATION_STATEMENT_COUNT);
  for(const sql of plans[0])assert.ok(sql.startsWith('SELECT '),sql.slice(0,24));
});

test('a resume is blocked before any Official FPL fetch when reconciliation is not SAFE',async()=>{
  const blocked=[
    safeState({integrity:{run_observations:1}}),
    safeState({integrity:{run_heads:2}}),
    safeState({integrity:{run_rejections:1}}),
    safeState({integrity:{started_runs:2}}),
    safeState({run:{status:'completed'}}),
    safeState({run:{records_accepted:9860}}),
    [[],[startedRow()],[integrityRow()]]
  ];
  for(const statements of blocked){
    let fetched=0;
    const {plans,run}=resumeHarness([d1(statements)]);
    await assert.rejects(run({fetchImpl:async url=>{fetched+=1;return officialFetch(url);}}),
      /production_resume_reconciliation_not_safe/,JSON.stringify(statements[2]));
    assert.equal(plans.length,1);
    assert.equal(fetched,0);
  }
});

test('a resume rejects a written row, a malformed shape and a moved identity before mutation',async()=>{
  for(const [steps,code,overrides] of [
    [[d1(safeState(),{rows_written:1})],/production_resume_reconciliation_read_only_violation/,{}],
    [[d1(safeState(),{rows_read:FIRST_RUN_RECONCILIATION_MAX_ROWS_READ+1})],/production_resume_reconciliation_resource_ceiling_exceeded/,{}],
    [[d1(safeState().slice(0,2))],/d1_result_contract_invalid|production_resume_reconciliation_cardinality_invalid/,{}],
    [[d1([[governanceRow()],[startedRow()],['not-a-row']])],/production_resume_reconciliation_not_safe/,{}],
    [[d1(safeState())],/production_resume_state_mismatch/,{scheduledAt:'2026-09-02T17:42:00.000Z'}]
  ]){
    const {run}=resumeHarness(steps);
    await assert.rejects(run(overrides),code,String(code));
  }
});

test('the resume envelope caps its calls and permits exactly one mutation request',()=>{
  assert.equal(RESUME_MAX_D1_API_CALLS,5);
  assert.equal(RESUME_MAX_MUTATION_REQUESTS,1);
  assert.ok(RESUME_MAX_D1_API_CALLS<MAX_D1_API_CALLS_PER_CYCLE);
  const source=read('workers/data-platform/production-collection.mjs');
  assert.match(source,/production_resume_mutation_budget_exceeded/);
  // The commit is the only mutation the resume path can reach; the start insert is skipped.
  assert.match(source,/if\(!resumeStarted\)\{const start=buildStartRunMutation/);
  assert.match(source,/committed=await mutate\(commit\)/);
});

/* ------------------------------------------------------------------ resource envelope */

test('the resume read envelope is stated from repository truth and stays inside the ceilings',()=>{
  assert.equal(RESUME_REFERENCE_POPULATION,9860);
  const estimate=estimateStructuralCycleRowsRead(
    {observations:RESUME_REFERENCE_POPULATION,heads:RESUME_REFERENCE_POPULATION,changed:0});
  assert.equal(estimate.totalRows,88804);
  const envelope=estimate.totalRows+FIRST_RUN_RECONCILIATION_MAX_ROWS_READ;
  assert.equal(envelope,89804);
  assert.ok(envelope<EXPECTED_D1_ROWS_READ_PER_CYCLE);
  assert.ok(envelope<MAX_D1_ROWS_READ_PER_CYCLE);
  // The hard ceiling plus the reconciliation guard is the minimum daily headroom a future
  // approval must assume; the repository proves no live remaining quota.
  assert.equal(MAX_D1_ROWS_READ_PER_CYCLE+FIRST_RUN_RECONCILIATION_MAX_ROWS_READ,126000);
  assert.doesNotMatch(executableCode,/quota|allowance|remaining/i);
});

/* --------------------------------------------------------------------- entry points */

test('both entry points are single-attempt, resolve identity centrally and persist no payload',()=>{
  for(const source of [entrySource,resumeEntrySource]){
    assert.match(source,/GITHUB_RUN_ATTEMPT!=='1'\)throw new Error\('workflow_retry_forbidden'\)/);
    assert.match(source,/maskProductionIdentity\(resolveProductionIdentity\(process\.env\)\)/);
    assert.deepEqual([...new Set([...source.matchAll(/fs\.[a-zA-Z]+/g)].map(row=>row[0]))],['fs.appendFileSync']);
    assert.doesNotMatch(uncommented(source),/writeFileSync|upload-artifact|result\.results|out\.results/);
  }
  assert.match(entrySource,/classification!==RESUME_RECONCILIATION_SAFE/);
  assert.doesNotMatch(uncommented(entrySource),/runProductionCollection|resumeStarted/);
});

/* ------------------------------------------------------- production identifier logging */

const jobBlock=(workflow,job)=>{
  const start=workflow.indexOf(`  ${job}:\n`);
  assert.ok(start>0,job);
  return workflow.slice(start);
};

const CREDENTIALLED=[
  ['.github/workflows/data-s2-first-run-reconciliation.yml','first-run-reconciliation'],
  ['.github/workflows/data-s2-production-resume.yml','first-run-resume'],
  ['.github/workflows/data-s2b-explain-acceptance.yml','explain-acceptance'],
  ['.github/workflows/data-s2b-migration-0003.yml','migration-0003'],
  ['.github/workflows/data-s2-production-collection.yml','collect'],
  ['.github/workflows/data-s2-scheduled-environment-preflight.yml','preflight']
];

test('no production identifier variable is materialised into a log-visible pre-step env block',()=>{
  for(const [file,job] of CREDENTIALLED){
    const workflow=read(file);
    // GitHub echoes the resolved env of every step, so a `vars.*` identifier declared at
    // workflow or job level is written to the log before Node can mask it.
    assert.doesNotMatch(workflow,/CLOUDFLARE_PRODUCTION_D1_ID/,file);
    const block=jobBlock(workflow,job);
    const jobEnv=block.slice(block.indexOf('\n    env:\n'),block.indexOf('\n    steps:\n'));
    assert.doesNotMatch(jobEnv,/vars\./,file);
    assert.doesNotMatch(workflow.slice(0,workflow.indexOf('jobs:')),/vars\./,file);
    // The only remaining `vars.*` reference is the fingerprint, on the final production step.
    const references=[...new Set([...workflow.matchAll(/vars\.([A-Z0-9_]+)/g)].map(row=>row[1]))];
    assert.deepEqual(references,['CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT'],file);
    const fingerprint=workflow.indexOf('vars.CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT');
    const mask=workflow.indexOf('- name: Register production identifier masks before any other step');
    assert.ok(mask>0&&mask<fingerprint,file);
    // The mask step is the credentialled job's first step and derives the value from the
    // already-masked account credential, so it materialises no unmasked identifier itself.
    assert.match(block,/    steps:\n(?:      #[^\n]*\n)*      - name: Register production identifier masks before any other step\n/,file);
    assert.ok(block.includes(`printf '::add-mask::%s\\n' "$(printf '%s' "$CLOUDFLARE_ACCOUNT_ID" | sha256sum | cut -d' ' -f1)"`),file);
  }
});

test('the token and every raw identifier stay out of the workflow body and the reported evidence',()=>{
  for(const [file] of CREDENTIALLED){
    const workflow=read(file);
    assert.doesNotMatch(workflow,/echo .*CLOUDFLARE_D1_TOKEN|print.*\$CLOUDFLARE_D1_TOKEN[^"]*"\s*$/,file);
    assert.ok(!workflow.includes(PRODUCTION_D1_ID),file);
    const secrets=[...new Set([...workflow.matchAll(/secrets\.([A-Z0-9_]+)/g)].map(row=>row[1]))].sort();
    assert.deepEqual(secrets,['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_D1_TOKEN'],file);
  }
  // The runtime mask remains as defence in depth and covers the token first.
  assert.match(identitySource,/::add-mask::\$\{identity\.token\}/);
  assert.doesNotMatch(identitySource,/console\.log|writeFileSync/);
});

test('production identity resolves from the reviewed constant and rejects a redirected database',()=>{
  const base={CLOUDFLARE_ACCOUNT_ID:ACCOUNT,CLOUDFLARE_D1_TOKEN:TOKEN,
    CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT:FINGERPRINT};
  assert.deepEqual({...resolveProductionIdentity(base)},
    {accountId:ACCOUNT,token:TOKEN,accountFingerprint:FINGERPRINT,databaseId:PRODUCTION_D1_ID});
  assert.equal(resolveProductionIdentity({...base,CLOUDFLARE_PRODUCTION_D1_ID:PRODUCTION_D1_ID}).databaseId,PRODUCTION_D1_ID);
  assert.throws(()=>resolveProductionIdentity({...base,CLOUDFLARE_PRODUCTION_D1_ID:'other'}),/production_d1_identity_mismatch/);
  for(const name of ['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_D1_TOKEN','CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT'])
    assert.throws(()=>resolveProductionIdentity({...base,[name]:''}),new RegExp(`missing_${name.toLowerCase()}`));
  // Masking never derives the fingerprint it validates, so the account check stays independent.
  assert.doesNotMatch(uncommented(identitySource),/accountFingerprint=derivedAccountFingerprint|accountFingerprint:derived/);
});

/* ------------------------------------------------------------------- workflow gates */

test('both production workflows are manual-only with one immutable approved-SHA input',()=>{
  for(const workflow of [reconciliationWorkflow,resumeWorkflow]){
    assert.match(workflow,/^on:\n  workflow_dispatch:\n    inputs:\n      approved_sha:/m);
    assert.match(workflow,/approved_sha:[\s\S]{0,240}required: true/);
    assert.doesNotMatch(workflow,/^\s{2}(?:push|pull_request|pull_request_target|schedule|repository_dispatch):/m);
    assert.deepEqual([...new Set([...workflow.matchAll(/inputs\.([a-z_]+)/g)].map(row=>row[1]))],['approved_sha']);
    assert.match(workflow,/grep -Eq '\^\[0-9a-f\]\{40\}\$'/);
    assert.match(workflow,/if: github\.event_name == 'workflow_dispatch'/);
    assert.match(workflow,/concurrency:\n  group: data-s2-production-collection\n  cancel-in-progress: false/);
    assert.match(workflow,/permissions:\n  contents: read\n  checks: read/);
  }
});

test('exact-main and exact-head Verify gates complete before production credentials exist',()=>{
  for(const [workflow,job] of [[reconciliationWorkflow,'first-run-reconciliation:'],[resumeWorkflow,'first-run-resume:']]){
    const gate=workflow.indexOf('repository-gate:'),execution=workflow.indexOf(job);
    assert.ok(gate>0&&gate<execution,job);
    assert.match(workflow,new RegExp(`${job}\\n    needs: repository-gate`));
    const gateBlock=workflow.slice(gate,execution);
    assert.doesNotMatch(gateBlock,/environment:|secrets\.CLOUDFLARE|CLOUDFLARE_/);
    for(const required of [
      'test "$EVENT_NAME" = workflow_dispatch','test "$EVENT_REF" = refs/heads/main',
      'test "$EVENT_REPOSITORY" = priteshpatel390-del/FPL',
      'test "$(git rev-parse HEAD)" = "$APPROVED_SHA"','test "$remote_main" = "$APPROVED_SHA"',
      'test -z "$(git status --porcelain)"',"row.name==='Tests and deterministic build'",
      "row.conclusion==='success'","row.app?.slug==='github-actions'"])
      assert.ok(gateBlock.includes(required),`${job} ${required}`);
    assert.match(workflow.slice(execution),/environment:\n      name: data-s2-production-collection/);
  }
});

// The exact shell each credentialled job runs immediately before its production entry point.
function credentialledRunBlock(workflow,marker){
  const start=workflow.indexOf(marker);
  assert.ok(start>0,marker);
  const block=workflow.slice(workflow.indexOf('run: |',start)+'run: |\n'.length);
  return block.split('\n').filter(line=>line.startsWith('          ')||line.trim()==='')
    .map(line=>line.slice(10)).join('\n').trimEnd();
}

const RUN_BLOCKS=[
  [reconciliationWorkflow,'      - name: Reconfirm identity and remote main, then reconcile read-only',
    'node workers/data-platform/run-first-run-reconciliation.mjs'],
  [resumeWorkflow,'      - name: Reconfirm identity and remote main, then resume only the deterministic first run',
    'node workers/data-platform/run-production-resume.mjs']
];

test('remote main is proved by the repository gate and independently again under credentials',()=>{
  const resolve=/remote_main="\$\(git ls-remote https:\/\/github\.com\/priteshpatel390-del\/FPL\.git refs\/heads\/main \| cut -f1\)"/;
  for(const [workflow,marker,entry] of RUN_BLOCKS){
    const gate=workflow.slice(workflow.indexOf('repository-gate:'),workflow.indexOf(marker));
    assert.match(gate,resolve);
    assert.equal([...workflow.matchAll(new RegExp(resolve.source,'g'))].length,2,marker);
    assert.doesNotMatch(workflow,/outputs:[\s\S]{0,400}remote_main/);
    const block=credentialledRunBlock(workflow,marker).split('\n').map(line=>line.trim()).filter(Boolean);
    assert.equal(block.at(-1),entry);
    assert.equal(block.at(-2),'test "$remote_main" = "$APPROVED_SHA"');
    assert.equal(block.at(-3),'test -n "$remote_main"');
    assert.match(block.at(-4),/^remote_main="\$\(git ls-remote /);
    assert.equal(block[0],'set -euo pipefail');
    assert.ok(block.some(line=>line.startsWith('rm -f node_modules/.bin/wrangler')));
    assert.ok(block.includes('test "$(node --version)" = v24.19.0'));
    assert.ok(block.includes('test "$(git rev-parse HEAD)" = "$APPROVED_SHA"'));
    assert.ok(block.includes('test -z "$(git status --porcelain)"'));
    // The recheck reaches only GitHub; no Cloudflare request precedes it.
    assert.ok(!block.slice(0,block.length-1).some(line=>/cloudflare|curl|api\.cloudflare/i.test(line)),marker);
  }
});

test('a main that moved after the repository gate stops before the production runner',()=>{
  const approved='0123456789abcdef0123456789abcdef01234567';
  for(const [workflow,marker] of RUN_BLOCKS){
    const script=credentialledRunBlock(workflow,marker);
    const attempt=liveMain=>{
      const dir=fs.mkdtempSync(path.join(os.tmpdir(),'resume-gate-'));
      const bin=path.join(dir,'bin');
      fs.mkdirSync(bin);
      fs.writeFileSync(path.join(bin,'node'),`#!/bin/sh\nif [ "$1" = "--version" ]; then echo v24.19.0; exit 0; fi\necho "$@" > "${dir}/invoked"\nexit 0\n`,{mode:0o755});
      fs.writeFileSync(path.join(bin,'git'),`#!/bin/sh\ncase "$1" in\n  rev-parse) echo ${approved};;\n  status) : ;;\n  ls-remote) printf '%s\\trefs/heads/main\\n' ${liveMain};;\n  *) exit 1;;\nesac\nexit 0\n`,{mode:0o755});
      const out=spawnSync('bash',['-c',script],{cwd:dir,encoding:'utf8',
        env:{PATH:`${bin}:${process.env.PATH}`,APPROVED_SHA:approved}});
      const invoked=fs.existsSync(path.join(dir,'invoked'));
      fs.rmSync(dir,{recursive:true,force:true});
      return {status:out.status,invoked};
    };
    assert.deepEqual(attempt(approved),{status:0,invoked:true},marker);
    const moved=attempt('fedcba9876543210fedcba9876543210fedcba98');
    assert.notEqual(moved.status,0,marker);
    assert.equal(moved.invoked,false,marker);
    const empty=attempt("''");
    assert.notEqual(empty.status,0,marker);
    assert.equal(empty.invoked,false,marker);
  }
});

test('a workflow re-run is refused by every production entry point',()=>{
  for(const source of [entrySource,resumeEntrySource,read('workers/data-platform/run-production-explain.mjs'),
    read('workers/data-platform/run-migration-0003.mjs'),read('workers/data-platform/run-production-collection.mjs')])
    assert.match(source,/GITHUB_RUN_ATTEMPT!=='1'\)throw new Error\('workflow_retry_forbidden'\)/);
});

test('neither workflow adds a Wrangler, Cron, schedule, deployment or migration surface',()=>{
  for(const [workflow,,entry] of RUN_BLOCKS){
    const body=uncommented(workflow);
    for(const forbidden of [/run-migration-0003/,/run-production-collection/,/wrangler deploy/,
      /^\s*schedule:/m,/cron/i,/versions/,/deployments/,/secrets:\s*inherit/])
      assert.doesNotMatch(body,forbidden,String(forbidden));
    assert.deepEqual([...body.matchAll(/node workers\/data-platform\/[a-z0-9-]+\.mjs/g)].map(row=>row[0]),
      [entry]);
    for(const line of body.split('\n').filter(line=>/wrangler/i.test(line)))
      assert.match(line.trim(),/^rm -(f|rf) /,line);
    // The only network host either workflow contacts itself is GitHub.
    assert.deepEqual([...new Set([...body.matchAll(/https:\/\/([a-z.]+)\//g)].map(row=>row[1]))].sort(),
      ['api.github.com','github.com']);
  }
  // Scheduling stays disabled and the historical Cron declaration is untouched.
  assert.match(read('workers/data-platform/wrangler.jsonc'),/"crons": \["\*\/30 \* \* \* \*"\]/);
  assert.doesNotMatch(read('.github/workflows/data-s2-production-collection.yml'),/^\s*schedule:/m);
});
