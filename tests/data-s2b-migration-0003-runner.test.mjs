import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  applyMigration0003,classifyMigration0003Failure,migration0003Digest,
  migration0003FailureClassification,readPinnedMigration0003
} from '../workers/data-platform/migration3/apply-migration-0003.mjs';
import {
  assertMigration0003Budget,assertPinnedMigration0003Statements,classifyMigration0003State,
  estimateMigration0003Rows,MIGRATION_0003_ALREADY_APPLIED,MIGRATION_0003_AMBIGUOUS,
  MIGRATION_0003_APPLIED,MIGRATION_0003_APPLIED_AT,MIGRATION_0003_BYTES,MIGRATION_0003_INDEXES,
  MIGRATION_0003_LEDGER_WRITE_AMPLIFICATION,MIGRATION_0003_MAX_D1_API_CALLS,
  MIGRATION_0003_MAX_ROWS_READ,MIGRATION_0003_MAX_ROWS_WRITTEN,MIGRATION_0003_NAME,
  MIGRATION_0003_NOT_APPLIED,MIGRATION_0003_PATH,MIGRATION_0003_PRIOR_LEDGER,
  MIGRATION_0003_PROTECTED_COUNT_KEYS,MIGRATION_0003_SHA256,MIGRATION_0003_STATE_ALREADY_APPLIED,
  MIGRATION_0003_STATE_EXACT_PRE,MIGRATION_0003_STATE_INCONSISTENT,MIGRATION_0003_STATEMENT_COUNT,
  MIGRATION_0003_STATEMENTS,MIGRATION_0003_VERSION,splitPinnedMigration0003,
  validateMigration0003Counts,validateMigration0003PostState
} from '../workers/data-platform/migration3/migration-0003-contract.mjs';
import {
  buildMigration0003Mutation,buildMigration0003ReconciliationRead,
  MIGRATION_0003_RECONCILIATION_STATEMENT_COUNT,inspectOfficialFplD1RestPlan
} from '../workers/data-platform/official-fpl-d1-rest-plan.mjs';
import {PRODUCTION_D1_ID} from '../workers/data-platform/production-collection.mjs';

const workflowPath='.github/workflows/data-s2b-migration-0003.yml';
const contractPath='workers/data-platform/migration3/migration-0003-contract.mjs';
const applyPath='workers/data-platform/migration3/apply-migration-0003.mjs';
const entryPath='workers/data-platform/run-migration-0003.mjs';
const workflow=fs.readFileSync(workflowPath,'utf8');
// Prose comments explain what the runner deliberately never does; the executable-surface
// assertions below must read the code, not the explanation.
const uncommented=source=>source.split('\n').filter(line=>!/^\s*(#|\/\/)/.test(line)).join('\n');
const workflowBody=uncommented(workflow);
const contractSource=fs.readFileSync(contractPath,'utf8');
const applySource=fs.readFileSync(applyPath,'utf8');
const entrySource=fs.readFileSync(entryPath,'utf8');
const executable=`${contractSource}\n${applySource}\n${entrySource}`;
const executableCode=uncommented(executable);

const ACCOUNT='data-s2b-migration-0003-account';
const FINGERPRINT=createHash('sha256').update(ACCOUNT).digest('hex');
const TOKEN='data-s2b-migration-0003-token';

const PRIOR_LEDGER=MIGRATION_0003_PRIOR_LEDGER.map(row=>({...row}));
const THIRD={version:MIGRATION_0003_VERSION,name:MIGRATION_0003_NAME,applied_at:MIGRATION_0003_APPLIED_AT};
const INDEX_ROWS=MIGRATION_0003_INDEXES.map(index=>({name:index.name,tbl_name:index.table,sql:index.sql}));
const counts=(overrides={})=>({
  ingestion_runs:2,shadow_observations:9860,observation_heads:9860,observation_rejections:0,
  canonical_entities:1064,data_sources:1,data_source_revisions:1,accepted_logical_keys:9860,
  orphan_heads:0,started_runs:1,completed_runs:1,schema_migrations:2,...overrides
});
const preState=extra=>({ledger:PRIOR_LEDGER,indexes:[],counts:counts(extra)});
const postState=extra=>({ledger:[...PRIOR_LEDGER,THIRD],indexes:INDEX_ROWS,counts:counts({schema_migrations:3,...extra})});

// Cloudflare reports per-statement accounting; the fake attributes the whole request cost to the
// first statement so a multi-statement plan is never silently multiplied.
const ok=(resultSets,meta={})=>({status:200,json:async()=>({success:true,result:resultSets.map((rows,index)=>({
  success:true,results:rows,meta:{rows_read:index===0?meta.rows_read??0:0,
    rows_written:index===0?meta.rows_written??0:0,changes:0}}))})});
const reconciliation=state=>ok([state.ledger,state.indexes,[state.counts??counts()]],{rows_read:50404});
const mutationOk=()=>ok([[],[],[],[]],{rows_read:19720,rows_written:19723});

function harness(steps){
  const requests=[];
  const transport=async request=>{
    requests.push({...JSON.parse(request.body),__url:request.url,__method:request.method});
    const step=steps.shift();
    if(!step)throw new Error('unexpected_request');
    if(typeof step==='function')return step();
    return step;
  };
  return {requests,transport};
}
const run=(steps,overrides={})=>{
  const {requests,transport}=harness(steps);
  return {requests,promise:applyMigration0003({accountId:ACCOUNT,accountFingerprint:FINGERPRINT,
    databaseId:PRODUCTION_D1_ID,token:TOKEN,transport,...overrides})};
};
const statementsOf=body=>(body.batch??[body]).map(entry=>entry.sql);

/* ---------------------------------------------------------------- workflow contract */

test('migration 0003 workflow is manual-only with one immutable approved-SHA input',()=>{
  assert.match(workflow,/^on:\n  workflow_dispatch:\n    inputs:\n      approved_sha:/m);
  assert.match(workflow,/approved_sha:[\s\S]{0,220}required: true/);
  assert.doesNotMatch(workflow,/^\s{2}(?:push|pull_request|pull_request_target|schedule|repository_dispatch):/m);
  assert.deepEqual([...workflow.matchAll(/^\s{6}([a-z_]+):\n\s{8}description:/gm)].map(row=>row[1]),['approved_sha']);
  assert.match(workflow,/grep -Eq '\^\[0-9a-f\]\{40\}\$'/);
  assert.match(workflow,/ref: \$\{\{ inputs\.approved_sha \}\}/);
  assert.match(workflow,/if: github\.event_name == 'workflow_dispatch'/);
});

test('no workflow input can carry SQL, a migration path, a version or an object name',()=>{
  const inputs=[...workflow.matchAll(/^\s{6}([a-z_]+):\n\s{8}description:/gm)].map(row=>row[1]);
  assert.deepEqual(inputs,['approved_sha']);
  for(const forbidden of [/inputs\.sql/,/inputs\.statement/,/inputs\.migration/,/inputs\.version/,
    /inputs\.table/,/inputs\.index/,/inputs\.database/,/inputs\.account/])
    assert.doesNotMatch(workflow,forbidden);
  // The only workflow reference to the input is the validated, checked-out approved SHA.
  assert.deepEqual([...new Set([...workflow.matchAll(/inputs\.([a-z_]+)/g)].map(row=>row[1]))],['approved_sha']);
});

test('exact-main and exact-head Verify gates complete before production credentials exist',()=>{
  const gate=workflow.indexOf('repository-gate:'),mutation=workflow.indexOf('migration-0003:');
  assert.ok(gate>0&&gate<mutation);
  assert.match(workflow,/migration-0003:\n    needs: repository-gate/);
  const gateBlock=workflow.slice(gate,mutation);
  assert.doesNotMatch(gateBlock,/environment:|secrets\.CLOUDFLARE|CLOUDFLARE_/);
  for(const required of [
    'test "$EVENT_NAME" = workflow_dispatch','test "$EVENT_REF" = refs/heads/main',
    'test "$EVENT_REPOSITORY" = priteshpatel390-del/FPL',
    'test "$(git rev-parse HEAD)" = "$APPROVED_SHA"','test "$remote_main" = "$APPROVED_SHA"',
    'test -z "$(git status --porcelain)"',"name==='Tests and deterministic build'",
    "status==='completed'","conclusion==='success'",'row.head_sha===process.env.APPROVED_SHA',
    "row.app?.slug==='github-actions'"
  ])assert.ok(gateBlock.includes(required),required);
});

test('the credentialled job requires the protected production environment and re-proves identity',()=>{
  const mutation=workflow.slice(workflow.indexOf('migration-0003:'));
  assert.match(mutation,/environment:\n      name: data-s2-production-collection/);
  assert.match(mutation,/CLOUDFLARE_D1_TOKEN: \$\{\{ secrets\.CLOUDFLARE_D1_TOKEN \}\}/);
  assert.match(mutation,/CLOUDFLARE_ACCOUNT_ID: \$\{\{ secrets\.CLOUDFLARE_ACCOUNT_ID \}\}/);
  assert.match(mutation,/CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT: \$\{\{ vars\.CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT \}\}/);
  assert.match(mutation,/CLOUDFLARE_PRODUCTION_D1_ID: \$\{\{ vars\.CLOUDFLARE_PRODUCTION_D1_ID \}\}/);
  assert.ok(mutation.includes('test "$(git rev-parse HEAD)" = "$APPROVED_SHA"'));
  assert.ok(mutation.includes('test -z "$(git status --porcelain)"'));
  // No credential is created, rotated or widened, and no new secret name is introduced.
  const secrets=[...new Set([...workflow.matchAll(/secrets\.([A-Z0-9_]+)/g)].map(row=>row[1]))].sort();
  assert.deepEqual(secrets,['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_D1_TOKEN']);
});

test('the workflow runs exactly one repository-owned migration entry point and no Wrangler',()=>{
  assert.deepEqual([...workflowBody.matchAll(/node (workers\/[^\s]+)/g)].map(row=>row[1]),
    ['workers/data-platform/run-migration-0003.mjs']);
  assert.match(workflowBody,/rm -f node_modules\/\.bin\/wrangler/);
  for(const line of workflowBody.split('\n').filter(line=>/wrangler/i.test(line)))
    assert.match(line.trim(),/^rm -(f|rf) /,line);
  assert.doesNotMatch(executableCode,/wrangler/i);
});

test('the workflow performs no collection, resume, schedule, deployment or restore action',()=>{
  for(const forbidden of [/run-production-collection/,/run-production-resume/,/schedule/i,/cron/i,
    /deployments/,/versions/,/routes/,/domains/,/access/i,/time_travel/,/restore/i,/upload-artifact/,
    /EXPLAIN/i,/DROP /i,/DELETE /i,/UPDATE /i])
    assert.doesNotMatch(workflowBody,forbidden,String(forbidden));
});

/* ---------------------------------------------------------- pinned migration surface */

test('the reviewed migration file is pinned by path, size, digest and exact statements',()=>{
  assert.equal(MIGRATION_0003_PATH,'workers/data-platform/migrations/0003_production_query_plan_indexes.sql');
  const sql=fs.readFileSync(MIGRATION_0003_PATH,'utf8');
  assert.equal(Buffer.byteLength(sql,'utf8'),MIGRATION_0003_BYTES);
  assert.equal(migration0003Digest(sql),MIGRATION_0003_SHA256);
  assert.equal(MIGRATION_0003_STATEMENT_COUNT,4);
  assert.deepEqual(readPinnedMigration0003(),[...MIGRATION_0003_STATEMENTS]);
  // Migration 0003 deliberately keeps no IF NOT EXISTS or conflict-ignore escape.
  assert.doesNotMatch(sql,/IF NOT EXISTS/i);
  assert.doesNotMatch(sql,/OR IGNORE|OR REPLACE|ON CONFLICT/i);
  // Migrations 0001 and 0002 remain byte-for-byte unchanged.
  assert.equal(fs.readFileSync('workers/data-platform/migrations/0001_shadow_data_foundation.sql','utf8').length,6832);
  assert.equal(fs.readFileSync('workers/data-platform/migrations/0002_official_fpl_structured_history.sql','utf8').length,1162);
});

test('the four reviewed statements carry the exact migration-0003 semantics',()=>{
  assert.deepEqual([...MIGRATION_0003_STATEMENTS],[
    'CREATE INDEX observation_heads_observation_id ON observation_heads(observation_id)',
    'CREATE INDEX shadow_observations_ingestion_run ON shadow_observations(ingestion_run_id, source_revision_id)',
    'CREATE INDEX observation_rejections_source_revision ON observation_rejections(source_revision_id)',
    `INSERT INTO schema_migrations (version, name, applied_at)\nVALUES (3, 'production_query_plan_indexes', '2026-09-02T00:00:00.000Z')`
  ]);
  assert.equal(MIGRATION_0003_VERSION,3);
  assert.equal(MIGRATION_0003_NAME,'production_query_plan_indexes');
  assert.equal(MIGRATION_0003_APPLIED_AT,'2026-09-02T00:00:00.000Z');
  assert.deepEqual(MIGRATION_0003_INDEXES.map(index=>`${index.name}|${index.table}`).sort(),[
    'observation_heads_observation_id|observation_heads',
    'observation_rejections_source_revision|observation_rejections',
    'shadow_observations_ingestion_run|shadow_observations'
  ]);
  for(const index of MIGRATION_0003_INDEXES)assert.ok(MIGRATION_0003_STATEMENTS.includes(index.sql));
});

test('drifted migration content, statement count or statement text is rejected',()=>{
  assert.throws(()=>readPinnedMigration0003(()=>'CREATE INDEX x ON y(z);'),/migration_0003_content_drift/);
  assert.throws(()=>readPinnedMigration0003(()=>null),/migration_0003_content_drift/);
  const sql=fs.readFileSync(MIGRATION_0003_PATH,'utf8');
  assert.throws(()=>readPinnedMigration0003(()=>`${sql} `),/migration_0003_content_drift/);
  assert.throws(()=>splitPinnedMigration0003(sql.replace('(3,','(4,')),/migration_0003_statement_contract_invalid/);
  assert.throws(()=>splitPinnedMigration0003(`${sql}\nDROP TABLE shadow_observations;`),/migration_0003_statement_contract_invalid/);
  assert.throws(()=>assertPinnedMigration0003Statements(MIGRATION_0003_STATEMENTS.slice(0,3)),/migration_0003_statement_contract_invalid/);
  assert.throws(()=>assertPinnedMigration0003Statements([...MIGRATION_0003_STATEMENTS].reverse()),/migration_0003_statement_contract_invalid/);
});

test('the executable mutation surface is exactly one migration batch and admits no arbitrary SQL',()=>{
  const plan=inspectOfficialFplD1RestPlan(buildMigration0003Mutation([...MIGRATION_0003_STATEMENTS]));
  assert.equal(plan.kind,'mutation');
  assert.equal(plan.mutation,true);
  assert.equal(plan.statements.length,MIGRATION_0003_STATEMENT_COUNT);
  assert.deepEqual(plan.statements.map(entry=>entry.sql),[...MIGRATION_0003_STATEMENTS]);
  assert.ok(plan.statements.every(entry=>entry.params.length===0));
  for(const rejected of [['DROP TABLE shadow_observations'],[],['SELECT 1'],
    [...MIGRATION_0003_STATEMENTS,'DELETE FROM ingestion_runs'],
    ['CREATE INDEX observation_heads_observation_id ON observation_heads(logical_key)',
     ...MIGRATION_0003_STATEMENTS.slice(1)]])
    assert.throws(()=>buildMigration0003Mutation(rejected),/migration_0003_statement_contract_invalid/);
  // No dynamic migration selection exists anywhere in the executable surface.
  for(const forbidden of [/migrations\/\$\{/,/readdirSync/,/process\.argv/,
    /process\.env\.MIGRATION/,/0001_|0002_/])
    assert.doesNotMatch(executableCode,forbidden,String(forbidden));
});

test('the reconciliation read is bounded, read-only and never issues EXPLAIN',()=>{
  const plan=inspectOfficialFplD1RestPlan(buildMigration0003ReconciliationRead());
  assert.equal(plan.kind,'read');
  assert.equal(plan.mutation,false);
  assert.equal(plan.statements.length,MIGRATION_0003_RECONCILIATION_STATEMENT_COUNT);
  for(const {sql,params} of plan.statements){
    assert.match(sql,/^SELECT /);
    assert.deepEqual([...params],[]);
    assert.doesNotMatch(sql,/EXPLAIN|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|PRAGMA|ATTACH/i);
  }
  assert.match(plan.statements[0].sql,/FROM schema_migrations ORDER BY version$/);
  assert.match(plan.statements[1].sql,/FROM sqlite_master WHERE type='index' AND name IN \(/);
  for(const index of MIGRATION_0003_INDEXES)assert.ok(plan.statements[1].sql.includes(`'${index.name}'`));
  for(const key of MIGRATION_0003_PROTECTED_COUNT_KEYS)assert.ok(plan.statements[2].sql.includes(`AS ${key}`),key);
  // The append-only observation population is never equated with the head population.
  assert.ok(plan.statements[2].sql.includes('COUNT(DISTINCT logical_key)'));
  assert.notEqual(plan.statements[2].sql.indexOf('AS shadow_observations'),
    plan.statements[2].sql.indexOf('AS observation_heads'));
});

test('no live EXPLAIN QUERY PLAN is reachable from the migration-0003 runner',()=>{
  assert.doesNotMatch(executableCode,/EXPLAIN/i);
  assert.doesNotMatch(executableCode,/buildProductionCurrentHeadsExplainRead|validateProductionCurrentHeadsExplain/);
});

/* ------------------------------------------------------------------ state classification */

test('the exact expected pre-state is the only state that may permit the mutation',()=>{
  assert.equal(classifyMigration0003State(preState()),MIGRATION_0003_STATE_EXACT_PRE);
  assert.equal(classifyMigration0003State(postState()),MIGRATION_0003_STATE_ALREADY_APPLIED);
});

test('every partial or drifted state is classified inconsistent and never applied',()=>{
  const inconsistent=[
    {ledger:PRIOR_LEDGER,indexes:[INDEX_ROWS[0]]},
    {ledger:PRIOR_LEDGER,indexes:INDEX_ROWS},
    {ledger:[...PRIOR_LEDGER,THIRD],indexes:[]},
    {ledger:[...PRIOR_LEDGER,THIRD],indexes:INDEX_ROWS.slice(0,2)},
    {ledger:[...PRIOR_LEDGER,{...THIRD,name:'production_query_plan_index'}],indexes:INDEX_ROWS},
    {ledger:[...PRIOR_LEDGER,{...THIRD,applied_at:'2026-09-03T00:00:00.000Z'}],indexes:INDEX_ROWS},
    {ledger:[...PRIOR_LEDGER,{...THIRD,version:4}],indexes:INDEX_ROWS},
    {ledger:[PRIOR_LEDGER[0]],indexes:[]},
    {ledger:[PRIOR_LEDGER[1],PRIOR_LEDGER[0]],indexes:[]},
    {ledger:[{...PRIOR_LEDGER[0],applied_at:'2026-08-23T00:00:00.000Z'},PRIOR_LEDGER[1]],indexes:[]},
    {ledger:[...PRIOR_LEDGER,THIRD,{version:4,name:'x',applied_at:'y'}],indexes:INDEX_ROWS},
    // A same-named index over the wrong table, wrong columns or wrong column order is drift.
    {ledger:[...PRIOR_LEDGER,THIRD],indexes:INDEX_ROWS.map((row,i)=>i===0?{...row,tbl_name:'shadow_observations'}:row)},
    {ledger:[...PRIOR_LEDGER,THIRD],indexes:INDEX_ROWS.map((row,i)=>i===0?{...row,sql:'CREATE INDEX observation_heads_observation_id ON observation_heads(logical_key)'}:row)},
    {ledger:[...PRIOR_LEDGER,THIRD],indexes:INDEX_ROWS.map(row=>row.name==='shadow_observations_ingestion_run'
      ?{...row,sql:'CREATE INDEX shadow_observations_ingestion_run ON shadow_observations(source_revision_id, ingestion_run_id)'}:row)}
  ];
  for(const state of inconsistent)
    assert.equal(classifyMigration0003State(state),MIGRATION_0003_STATE_INCONSISTENT,JSON.stringify(state.ledger));
  for(const broken of [{ledger:'x',indexes:[]},{ledger:[{version:'x',name:'a',applied_at:'b'}],indexes:[]},
    {ledger:PRIOR_LEDGER,indexes:'x'},{ledger:PRIOR_LEDGER,indexes:[{name:1}]}])
    assert.throws(()=>classifyMigration0003State(broken),/migration_0003_reconciliation_contract_invalid/);
});

test('post-state acceptance proves the exact ledger, indexes and unchanged application data',()=>{
  assert.equal(validateMigration0003PostState({pre:preState(),post:postState()}),true);
  assert.throws(()=>validateMigration0003PostState({pre:preState(),post:{...postState(),indexes:INDEX_ROWS.slice(0,2)}}),/migration_0003_post_state_mismatch/);
  for(const key of MIGRATION_0003_PROTECTED_COUNT_KEYS.filter(name=>name!=='schema_migrations'))
    assert.throws(()=>validateMigration0003PostState({pre:preState(),post:postState({[key]:counts()[key]+1})}),
      /migration_0003_application_data_mutated/,key);
  // Exactly one additional ledger row is permitted, and no more.
  assert.throws(()=>validateMigration0003PostState({pre:preState(),post:postState({schema_migrations:4})}),/migration_0003_application_data_mutated/);
  assert.throws(()=>validateMigration0003PostState({pre:preState(),post:postState({schema_migrations:2})}),/migration_0003_application_data_mutated/);
  for(const bad of [{},{ingestion_runs:-1},{shadow_observations:'x'}])
    assert.throws(()=>validateMigration0003Counts({...counts(),...bad,...('ingestion_runs' in bad||'shadow_observations' in bad?bad:{ingestion_runs:undefined})}),/migration_0003_reconciliation_contract_invalid/);
});

/* --------------------------------------------------------------- resource contract */

test('the migration runner has its own bounded contract, not the routine collection allowance',()=>{
  assert.equal(MIGRATION_0003_MAX_D1_API_CALLS,3);
  assert.equal(MIGRATION_0003_MAX_ROWS_WRITTEN,40000);
  assert.ok(MIGRATION_0003_MAX_ROWS_READ>0);
  const estimate=estimateMigration0003Rows(counts());
  assert.equal(estimate.rowsWritten,9860+9860+0+MIGRATION_0003_LEDGER_WRITE_AMPLIFICATION);
  assert.equal(estimate.indexBuildRows,9860+9860+0);
  assert.equal(estimate.reconciliationRows,9860*2+9860*3+1064+64);
  assert.equal(estimate.outstandingRows,estimate.indexBuildRows+estimate.reconciliationRows);
  assert.deepEqual(assertMigration0003Budget({rowsReadSoFar:estimate.reconciliationRows,rowsWrittenSoFar:0,estimate}),
    {projectedRead:estimate.reconciliationRows+estimate.outstandingRows,projectedWrite:estimate.rowsWritten});
  // A materially larger population fails closed before any mutation.
  const huge=estimateMigration0003Rows(counts({shadow_observations:400000,observation_heads:400000,accepted_logical_keys:400000}));
  assert.throws(()=>assertMigration0003Budget({rowsReadSoFar:0,rowsWrittenSoFar:0,estimate:huge}),/migration_0003_budget_exceeded/);
  assert.throws(()=>assertMigration0003Budget({rowsReadSoFar:-1,rowsWrittenSoFar:0,estimate}),/migration_0003_budget_contract_invalid/);
});

/* ------------------------------------------------------------------ live behaviour */

test('the exact pre-state applies the migration once and proves the exact post-state',async()=>{
  const {requests,promise}=run([reconciliation(preState()),mutationOk(),reconciliation(postState())]);
  const result=await promise;
  assert.equal(result.classification,MIGRATION_0003_APPLIED);
  assert.equal(result.mutationIssued,true);
  assert.deepEqual(result.state,{before:MIGRATION_0003_STATE_EXACT_PRE,after:MIGRATION_0003_STATE_ALREADY_APPLIED});
  assert.deepEqual(result.ledger,['1:shadow_data_foundation','2:official_fpl_structured_history','3:production_query_plan_indexes']);
  assert.deepEqual([...result.indexes].sort(),MIGRATION_0003_INDEXES.map(index=>index.name).sort());
  assert.equal(result.d1.apiCalls,3);
  assert.equal(result.d1.rowsRead,50404*2+19720);
  assert.equal(result.d1.rowsWritten,19723);
  assert.equal(requests.length,3);
  // Exactly one mutation request, carrying exactly the four reviewed statements.
  const mutations=requests.filter(body=>Array.isArray(body.batch)&&statementsOf(body).some(sql=>/^CREATE INDEX/.test(sql)));
  assert.equal(mutations.length,1);
  assert.deepEqual(statementsOf(mutations[0]),[...MIGRATION_0003_STATEMENTS]);
  assert.ok(requests.every(body=>body.__method==='POST'&&body.__url.includes(`/d1/database/${PRODUCTION_D1_ID}/query`)));
});

test('the exact already-applied state issues no migration SQL and completes on bounded readback',async()=>{
  const {requests,promise}=run([reconciliation(postState())]);
  const result=await promise;
  assert.equal(result.classification,MIGRATION_0003_ALREADY_APPLIED);
  assert.equal(result.mutationIssued,false);
  assert.equal(result.d1.apiCalls,1);
  assert.equal(result.d1.rowsWritten,0);
  assert.equal(requests.length,1);
  assert.ok(requests.every(body=>!statementsOf(body).some(sql=>/CREATE INDEX|INSERT INTO/i.test(sql))));
});

test('an inconsistent pre-state fails closed with no mutation and no retry',async()=>{
  const {requests,promise}=run([reconciliation({ledger:PRIOR_LEDGER,indexes:[INDEX_ROWS[0]]})]);
  const error=await promise.then(()=>null,failure=>failure);
  assert.match(error.message,/migration_0003_state_inconsistent/);
  const classified=migration0003FailureClassification(error);
  assert.equal(classified.classification,MIGRATION_0003_NOT_APPLIED);
  assert.equal(classified.retryable,false);
  assert.equal(classified.phase,'pre_reconciliation_state');
  assert.equal(requests.length,1);
});

test('an ambiguous transport outcome triggers only read-only reconciliation and never a retry',async()=>{
  const cases=[
    {after:postState(),classification:MIGRATION_0003_APPLIED,ok:true},
    {after:preState(),classification:MIGRATION_0003_NOT_APPLIED,ok:false},
    {after:{ledger:PRIOR_LEDGER,indexes:[INDEX_ROWS[0]]},classification:MIGRATION_0003_AMBIGUOUS,ok:false}
  ];
  for(const scenario of cases){
    const {requests,promise}=run([reconciliation(preState()),()=>{throw new Error('socket hang up');},reconciliation(scenario.after)]);
    if(scenario.ok){
      const result=await promise;
      assert.equal(result.classification,scenario.classification);
      assert.equal(result.note,'reconciled_after_unknown_transport');
    }else{
      const error=await promise.then(()=>null,failure=>failure);
      const classified=migration0003FailureClassification(error);
      assert.equal(classified.classification,scenario.classification);
      assert.equal(classified.retryable,false);
    }
    // Three requests only, and exactly one of them was ever a mutation.
    assert.equal(requests.length,3);
    assert.equal(requests.filter(body=>statementsOf(body).some(sql=>/^CREATE INDEX/.test(sql))).length,1);
    assert.equal(requests.filter(body=>statementsOf(body).some(sql=>/^SELECT /.test(sql))).length,2);
  }
});

test('a definite request error is never read as a no-write and is reconciled, not retried',async()=>{
  const {requests,promise}=run([reconciliation(preState()),
    {status:500,json:async()=>({success:false,errors:[{code:1,message:'internal'}]})},
    reconciliation(postState())]);
  const result=await promise;
  assert.equal(result.classification,MIGRATION_0003_APPLIED);
  assert.equal(result.note,'reconciled_after_unknown_transport');
  assert.equal(requests.length,3);
  assert.equal(requests.filter(body=>statementsOf(body).some(sql=>/^CREATE INDEX/.test(sql))).length,1);
});

test('an HTTP 200 alone never proves success: cardinality and post-state must both hold',async()=>{
  // A 200 whose result cardinality is not the four reviewed statements is not a success. It is an
  // unproven outcome, so it reconciles read-only rather than being accepted or retried.
  for(const malformed of [ok([[],[],[]]),ok([[],[],[],[],[]]),
    {status:200,json:async()=>({success:true,result:[{success:true,meta:{}},{success:false,meta:{}},
      {success:true,meta:{}},{success:true,meta:{}}]})}]){
    const {requests,promise}=run([reconciliation(preState()),malformed,reconciliation(preState())]);
    const error=await promise.then(()=>null,failure=>failure);
    assert.ok(error,'a malformed migration response must never be accepted as success');
    assert.equal(migration0003FailureClassification(error).classification,MIGRATION_0003_NOT_APPLIED);
    assert.equal(migration0003FailureClassification(error).retryable,false);
    assert.equal(requests.filter(body=>statementsOf(body).some(sql=>/^CREATE INDEX/.test(sql))).length,1);
  }
  const unmoved=await run([reconciliation(preState()),mutationOk(),reconciliation(preState())])
    .promise.then(()=>null,failure=>failure);
  assert.match(unmoved.message,/migration_0003_post_state_mismatch/);
  assert.equal(migration0003FailureClassification(unmoved).classification,MIGRATION_0003_AMBIGUOUS);
  const mutated=await run([reconciliation(preState()),mutationOk(),reconciliation(postState({observation_heads:9861}))])
    .promise.then(()=>null,failure=>failure);
  assert.match(mutated.message,/migration_0003_application_data_mutated/);
  assert.equal(migration0003FailureClassification(mutated).classification,MIGRATION_0003_AMBIGUOUS);
});

test('a completed migration whose resource check then fails is never reported as a no-write',async()=>{
  const {promise}=run([reconciliation(preState()),
    ok([[],[],[],[]],{rows_read:900000}),reconciliation(postState())]);
  const error=await promise.then(()=>null,failure=>failure);
  const classified=migration0003FailureClassification(error);
  assert.notEqual(classified.classification,MIGRATION_0003_NOT_APPLIED);
  assert.equal(classified.classification,MIGRATION_0003_AMBIGUOUS);
  assert.equal(classified.retryable,false);
  assert.ok(classified.d1.rowsRead>MIGRATION_0003_MAX_ROWS_READ);
});

test('production account and database identity are proved before any request',async()=>{
  const {requests,transport}=harness([]);
  for(const options of [
    {accountFingerprint:createHash('sha256').update('other').digest('hex')},
    {accountFingerprint:'not-a-fingerprint'},
    {accountId:'other-account'}
  ])await assert.rejects(applyMigration0003({accountId:ACCOUNT,accountFingerprint:FINGERPRINT,
    databaseId:PRODUCTION_D1_ID,token:TOKEN,transport,...options}),/production_account_fingerprint_mismatch/);
  await assert.rejects(applyMigration0003({accountId:ACCOUNT,accountFingerprint:FINGERPRINT,
    databaseId:'00000000-0000-0000-0000-000000000000',token:TOKEN,transport}),/production_d1_identity_mismatch/);
  await assert.rejects(applyMigration0003({accountId:ACCOUNT,accountFingerprint:FINGERPRINT,
    databaseId:PRODUCTION_D1_ID,token:TOKEN,transport,sql:'DROP TABLE x'}),/migration_0003_config_invalid/);
  assert.equal(requests.length,0);
});

test('the API call ceiling is enforced and no fourth live call is reachable',async()=>{
  const {promise}=run([reconciliation(preState()),()=>{throw new Error('lost');},
    reconciliation({ledger:PRIOR_LEDGER,indexes:[INDEX_ROWS[0]]}),reconciliation(postState())]);
  await promise.then(()=>null,failure=>failure);
  const budget=await run([reconciliation(preState()),mutationOk(),
    ()=>{throw new Error('lost');},reconciliation(postState())]).promise.then(()=>null,failure=>failure);
  assert.equal(migration0003FailureClassification(budget).classification,MIGRATION_0003_AMBIGUOUS);
  assert.ok(migration0003FailureClassification(budget).d1.apiCalls<=MIGRATION_0003_MAX_D1_API_CALLS);
});

/* --------------------------------------------------------------------- disclosure */

test('no live secret or raw Cloudflare payload reaches the reported result or disk',async()=>{
  const result=await run([reconciliation(preState()),mutationOk(),reconciliation(postState())]).promise;
  const rendered=JSON.stringify(result);
  for(const secret of [TOKEN,ACCOUNT,PRODUCTION_D1_ID,FINGERPRINT])assert.ok(!rendered.includes(secret),secret);
  assert.match(entrySource,/::add-mask::\$\{token\}/);
  assert.match(entrySource,/::add-mask::\$\{accountId\}/);
  assert.match(entrySource,/::add-mask::\$\{databaseId\}/);
  // Raw responses stay in memory for the request only; nothing is written or uploaded.
  for(const source of [applySource,entrySource]){
    assert.doesNotMatch(source,/writeFileSync|createWriteStream|RUNNER_TEMP/);
    assert.doesNotMatch(source,/console\.log\(.*response/);
  }
  assert.match(entrySource,/appendFileSync\(process\.env\.GITHUB_STEP_SUMMARY/);
  assert.doesNotMatch(workflow,/upload-artifact/);
});

test('the entry point is single-attempt and takes its identity only from protected configuration',()=>{
  assert.match(entrySource,/GITHUB_RUN_ATTEMPT!=='1'\)throw new Error\('workflow_retry_forbidden'\)/);
  const required=[...entrySource.matchAll(/required\('([A-Z0-9_]+)'\)/g)].map(row=>row[1]).sort();
  assert.deepEqual(required,['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_D1_TOKEN',
    'CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT','CLOUDFLARE_PRODUCTION_D1_ID']);
  // The runner reuses the collection module only for the pinned production database identity.
  assert.match(applySource,/import \{PRODUCTION_D1_ID\} from '\.\.\/production-collection\.mjs';/);
  assert.doesNotMatch(executableCode,/runProductionCollection|runProductionResume|buildCommitBatch|buildStartRunMutation|buildCompleteUnchangedMutation|buildFailRunMutation/);
  assert.doesNotMatch(executableCode,/FIRST_PRODUCTION_RUN_SCHEDULED_AT|resumeStarted/);
  // The unresolved first production run is only counted, never updated or deleted.
  const plan=inspectOfficialFplD1RestPlan(buildMigration0003ReconciliationRead());
  assert.ok(plan.statements[2].sql.includes("WHERE status='started'"));
  assert.doesNotMatch(executableCode,/\bUPDATE ingestion_runs|\bDELETE FROM/i);
});

test('failure classification is total, sanitized and never retryable',()=>{
  const classified=migration0003FailureClassification(classifyMigration0003Failure(
    new Error('migration_0003_state_inconsistent'),MIGRATION_0003_NOT_APPLIED,'pre_reconciliation_state',
    {apiCalls:1,rowsRead:5,rowsWritten:0,requestBytes:10}));
  assert.deepEqual(classified,{classification:MIGRATION_0003_NOT_APPLIED,phase:'pre_reconciliation_state',
    code:'migration_0003_state_inconsistent',d1:{apiCalls:1,rowsRead:5,rowsWritten:0,requestBytes:10},retryable:false});
  // An unclassified or hostile failure defaults to owner attention, never to a no-write.
  const unknown=migration0003FailureClassification(new Error('Bearer sk-live-secret leaked'));
  assert.deepEqual(unknown,{classification:MIGRATION_0003_AMBIGUOUS,phase:null,code:'unclassified',d1:null,retryable:false});
  // A classification already carried is never overwritten by a later phase.
  const carried=classifyMigration0003Failure(new Error('a'),MIGRATION_0003_APPLIED,'mutation',null);
  assert.equal(classifyMigration0003Failure(carried,MIGRATION_0003_NOT_APPLIED,'later',null).migration0003Classification,MIGRATION_0003_APPLIED);
});

/* --------------------------------------------- local SQLite proof of the live contract */

test('the fixed reconciliation SQL classifies real pre, applied and partial schema states',()=>{
  const sqlite=(db,input)=>{const out=spawnSync('sqlite3',[db],{input,encoding:'utf8'});
    if(out.status!==0)throw new Error(out.stderr);return out.stdout;};
  const query=(db,sql)=>{const text=sqlite(db,`.mode json\n${sql};`).trim();return text?JSON.parse(text):[];};
  const migration=name=>fs.readFileSync(`workers/data-platform/migrations/${name}`,'utf8');
  const plan=inspectOfficialFplD1RestPlan(buildMigration0003ReconciliationRead());
  const observe=db=>{
    const [ledger,indexes,countRows]=plan.statements.map(entry=>query(db,entry.sql));
    return {ledger,indexes,counts:validateMigration0003Counts(countRows[0])};
  };
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'migration-0003-'));
  const db=path.join(dir,'schema.db');
  try{
    sqlite(db,migration('0001_shadow_data_foundation.sql')+migration('0002_official_fpl_structured_history.sql'));
    sqlite(db,`INSERT INTO ingestion_runs VALUES('run','official-fpl-r1','official_fpl_structured_history','shadow_only','2026-09-02T17:41:00.000Z',NULL,'started','official_fpl_public_core','p','t','data-s2a-v1',0,0,0,0,NULL,'2026-09-02T17:41:00.000Z');`);

    const before=observe(db);
    assert.equal(classifyMigration0003State(before),MIGRATION_0003_STATE_EXACT_PRE);
    assert.equal(before.counts.schema_migrations,2);
    assert.equal(before.counts.started_runs,1);
    assert.equal(before.indexes.length,0);

    // Exactly the four reviewed statements the mutation plan would submit, in plan order.
    const statements=inspectOfficialFplD1RestPlan(buildMigration0003Mutation([...MIGRATION_0003_STATEMENTS]))
      .statements.map(entry=>entry.sql);
    sqlite(db,`${statements.join(';\n')};`);

    const after=observe(db);
    assert.equal(classifyMigration0003State(after),MIGRATION_0003_STATE_ALREADY_APPLIED);
    assert.equal(validateMigration0003PostState({pre:before,post:after}),true);
    // sqlite_master returns the reviewed CREATE INDEX text verbatim, so the pinned index
    // definitions are proved against a real database rather than only asserted.
    assert.deepEqual(after.indexes.map(row=>`${row.name}|${row.tbl_name}|${row.sql}`).sort(),
      MIGRATION_0003_INDEXES.map(index=>`${index.name}|${index.table}|${index.sql}`).sort());
    assert.deepEqual(after.ledger.at(-1),{version:3,name:MIGRATION_0003_NAME,applied_at:MIGRATION_0003_APPLIED_AT});
    // The unresolved started run is untouched by the migration.
    assert.equal(after.counts.started_runs,before.counts.started_runs);

    // Reapplication is fail-closed: no IF NOT EXISTS, no conflict-ignore, no duplicate ledger row.
    assert.notEqual(spawnSync('sqlite3',[db],{input:`${statements.join(';\n')};`,encoding:'utf8'}).status,0);
    assert.equal(observe(db).counts.schema_migrations,3);

    // A partial state — index removed but the ledger row retained — fails closed.
    sqlite(db,'DROP INDEX observation_rejections_source_revision;');
    assert.equal(classifyMigration0003State(observe(db)),MIGRATION_0003_STATE_INCONSISTENT);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
