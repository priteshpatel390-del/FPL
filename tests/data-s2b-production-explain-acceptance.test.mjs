import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  buildCurrentHeadsRead,buildProductionCurrentHeadsExplainRead,buildProductionExplainAcceptanceRead,
  buildProductionPopulationAndHeadsRead,buildProductionPostflightRead,inspectOfficialFplD1RestPlan
} from '../workers/data-platform/official-fpl-d1-rest-plan.mjs';
import {
  parseExplainDetail,PRODUCTION_EXPLAIN_ACCEPTED,PRODUCTION_EXPLAIN_AMBIGUOUS,
  PRODUCTION_EXPLAIN_MAX_D1_API_CALLS,PRODUCTION_EXPLAIN_MAX_ROWS_PER_STATEMENT,
  PRODUCTION_EXPLAIN_MAX_ROWS_READ,PRODUCTION_EXPLAIN_MAX_ROWS_WRITTEN,PRODUCTION_EXPLAIN_QUERIES,
  PRODUCTION_EXPLAIN_REJECTED,PRODUCTION_EXPLAIN_STATEMENT_COUNT,
  productionExplainFailureClassification,validateCurrentHeadsPlan,validateHeadPopulationPlan,
  validateObservationPopulationPlan,validatePostflightPlan,validateProductionExplainAcceptance
} from '../workers/data-platform/explain/production-explain-contract.mjs';
import {acceptProductionExplainPlans} from '../workers/data-platform/explain/accept-production-plans.mjs';
import {
  MAX_D1_API_CALLS_PER_CYCLE,MAX_D1_ROWS_READ_PER_CYCLE,MAX_D1_ROWS_WRITTEN_PER_CYCLE,
  PRODUCTION_D1_ID,productionRunIdFor
} from '../workers/data-platform/production-collection.mjs';
import {MIGRATION_0003_MAX_ROWS_READ} from '../workers/data-platform/migration3/migration-0003-contract.mjs';

const workflowPath='.github/workflows/data-s2b-explain-acceptance.yml';
const contractPath='workers/data-platform/explain/production-explain-contract.mjs';
const helperPath='workers/data-platform/explain/accept-production-plans.mjs';
const entryPath='workers/data-platform/run-production-explain.mjs';
const workflow=fs.readFileSync(workflowPath,'utf8');
// Prose comments explain what the mechanism deliberately never does; the executable-surface
// assertions must read the code, not the explanation.
const uncommented=source=>source.split('\n').filter(line=>!/^\s*(#|\/\/)/.test(line)).join('\n');
const contractSource=fs.readFileSync(contractPath,'utf8');
const helperSource=fs.readFileSync(helperPath,'utf8');
const entrySource=fs.readFileSync(entryPath,'utf8');
const executableCode=uncommented(`${contractSource}\n${helperSource}\n${entrySource}`);

const ACCOUNT='data-s2b-explain-acceptance-account';
const FINGERPRINT=createHash('sha256').update(ACCOUNT).digest('hex');
const TOKEN='data-s2b-explain-acceptance-token';
const REVISION='official-fpl-r1';

const rows=details=>details.map(detail=>({id:0,parent:0,notused:0,detail}));

/* ------------------------------------------------ local schema-0003 plan evidence */

const migrations=['0001_shadow_data_foundation.sql','0002_official_fpl_structured_history.sql','0003_production_query_plan_indexes.sql'];
const migration=name=>fs.readFileSync(`workers/data-platform/migrations/${name}`,'utf8');
const sqlite=(db,input)=>{const out=spawnSync('sqlite3',[db],{input,encoding:'utf8'});if(out.status!==0)throw new Error(out.stderr);return out.stdout;};

function database(count=100){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'data-s2b-explain-')),db=path.join(dir,'schema.db');
  sqlite(db,migration(migrations[0])+migration(migrations[1]));
  sqlite(db,`INSERT INTO ingestion_runs VALUES('run','${REVISION}','official_fpl_structured_history','shadow_only','2026-09-02T17:41:00.000Z','2026-09-02T18:00:00.000Z','completed','official_fpl_public_core','p','t','s',${count},${count},0,0,NULL,'2026-09-02T17:41:00.000Z');`);
  sqlite(db,Array.from({length:count},(_,i)=>`INSERT INTO canonical_entities VALUES('e${i}','player','2026-27','official_fpl','${i}','x');INSERT INTO shadow_observations(observation_id,logical_key,ingestion_run_id,source_revision_id,category,subject_type,subject_entity_id,provenance_kind,metric,value_type,value_number,transform_version,validation_version,input_revision,admission_state,quality_state,mode,fetched_at,created_at) VALUES('${String(i).padStart(64,'0')}','k${i}','run','${REVISION}','player','player','e${i}','canonical_native_fpl','cost','number',1,'t','v','i${i}','accepted','fresh','shadow_only','x','x');INSERT INTO observation_heads VALUES('k${i}','${String(i).padStart(64,'0')}','x');`).join('\n'));
  sqlite(db,migration(migrations[2]));
  return {db,dir};
}

// The sqlite3 CLI renders a plan as a `QUERY PLAN` header plus tree branches. D1 returns one row
// per node carrying the same `detail` text, so the branch glyphs are stripped to reconstruct the
// rows the live contract will actually receive.
function livePlanRows(db,statement){
  let index=0;
  const sql=statement.sql.replace(/\?/g,()=>`'${statement.params[index++]}'`);
  return sqlite(db,`${sql};`).trim().split('\n')
    .map(line=>line.replace(/^[\s|`-]+/,'').trim())
    .filter(line=>line&&line!=='QUERY PLAN')
    .map(detail=>({detail}));
}

function liveStatements(){
  const {db,dir}=database();
  try{
    const plan=inspectOfficialFplD1RestPlan(buildProductionExplainAcceptanceRead({sourceRevisionId:REVISION,runId:'run'}));
    return plan.statements.map(statement=>livePlanRows(db,statement));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}

/* ------------------------------------------------------------------- plan builder */

test('the acceptance read wraps the exact four production SELECTs without semantic drift',()=>{
  const plan=inspectOfficialFplD1RestPlan(buildProductionExplainAcceptanceRead({sourceRevisionId:REVISION,runId:'run'}));
  assert.equal(plan.statements.length,PRODUCTION_EXPLAIN_STATEMENT_COUNT);
  assert.equal(PRODUCTION_EXPLAIN_STATEMENT_COUNT,4);
  const probe=inspectOfficialFplD1RestPlan(buildProductionPopulationAndHeadsRead({sourceRevisionId:REVISION}));
  const postflight=inspectOfficialFplD1RestPlan(buildProductionPostflightRead({runId:'run',sourceRevisionId:REVISION}));
  const heads=inspectOfficialFplD1RestPlan(buildCurrentHeadsRead({sourceRevisionId:REVISION}));
  const expected=[heads.statements[0].sql,probe.statements[1].sql,probe.statements[2].sql,postflight.statements[0].sql];
  plan.statements.forEach((statement,index)=>{
    assert.ok(statement.sql.startsWith('EXPLAIN QUERY PLAN '),statement.sql.slice(0,40));
    assert.equal(statement.sql.slice('EXPLAIN QUERY PLAN '.length),expected[index]);
  });
  // Q1 stays byte-identical to the pre-existing single-statement live-plan builder.
  assert.equal(plan.statements[0].sql,
    inspectOfficialFplD1RestPlan(buildProductionCurrentHeadsExplainRead({sourceRevisionId:REVISION})).statements[0].sql);
  assert.deepEqual(plan.statements.map(statement=>[...statement.params]),
    [[REVISION],[REVISION],[],['run',REVISION,REVISION,REVISION,REVISION,'run',REVISION]]);
  assert.deepEqual([...postflight.statements[0].params],[...plan.statements[3].params]);
});

test('the acceptance read is trusted, read-only and takes no SQL, table or statement input',()=>{
  const plan=buildProductionExplainAcceptanceRead({sourceRevisionId:REVISION,runId:'run'});
  assert.equal(inspectOfficialFplD1RestPlan(plan),plan);
  assert.equal(plan.kind,'read');
  assert.equal(plan.mutation,false);
  assert.ok(Object.isFrozen(plan)&&Object.isFrozen(plan.statements));
  // Only the two identifiers the production SQL already binds are accepted, and only as params.
  const injected=buildProductionExplainAcceptanceRead({sourceRevisionId:REVISION,runId:'run',
    sql:'DROP TABLE observation_heads',statements:[{sql:'DELETE FROM shadow_observations'}],table:'x',index:'y'});
  assert.deepEqual(injected.statements.map(statement=>statement.sql),
    plan.statements.map(statement=>statement.sql));
  for(const bad of [{sourceRevisionId:'',runId:'run'},{sourceRevisionId:REVISION,runId:''},{}])
    assert.throws(()=>buildProductionExplainAcceptanceRead(bad),/official_fpl_plan_(source_revision|run)_invalid/);
  for(const statement of plan.statements)
    assert.doesNotMatch(statement.sql,/\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|REPLACE|PRAGMA|ATTACH)\b/);
});

test('no mutation verb, plan or migration surface is reachable from the acceptance mechanism',()=>{
  assert.doesNotMatch(executableCode,/\b(INSERT INTO|UPDATE |DELETE FROM|CREATE INDEX|CREATE TABLE|DROP |ALTER )/);
  for(const forbidden of [/buildCommitBatch/,/buildStartRunMutation/,/buildFailRunMutation/,
    /buildCompleteUnchangedMutation/,/buildMigration0003Mutation/,/runProductionCollection/,
    /applyMigration0003/,/wrangler/i,/schedules/,/deployments/,/versions/])
    assert.doesNotMatch(executableCode,forbidden);
  // The only D1 plan the helper can build is the fixed acceptance read.
  assert.deepEqual([...new Set([...uncommented(helperSource).matchAll(/build[A-Za-z0-9]+/g)].map(row=>row[0]))],
    ['buildProductionExplainAcceptanceRead']);
});

/* --------------------------------------------------------- live schema-0003 shapes */

test('the real schema-0003 plans for all four production statements are accepted',()=>{
  const statements=liveStatements();
  const evidence=validateProductionExplainAcceptance(statements);
  assert.equal(evidence.classification,PRODUCTION_EXPLAIN_ACCEPTED);
  assert.deepEqual(evidence.queries.map(entry=>entry.query),[...PRODUCTION_EXPLAIN_QUERIES]);
  for(const entry of evidence.queries){
    assert.ok(entry.rows>=1&&entry.rows<=PRODUCTION_EXPLAIN_MAX_ROWS_PER_STATEMENT);
    for(const node of entry.plan)assert.ok(['SCAN','SEARCH'].includes(node.op));
  }
  // The accepted live evidence names migration 0003's head index against observation_heads, and
  // never depends on shadow_observations_ingestion_run.
  const q1=evidence.queries[0].plan;
  assert.ok(q1.some(node=>node.op==='SEARCH'&&node.target==='h'&&node.index==='observation_heads_observation_id'));
  const named=evidence.queries.flatMap(entry=>entry.plan).map(node=>node.index);
  assert.ok(!named.includes('shadow_observations_ingestion_run'));
});

test('the local plan evidence is repository evidence only and is not a D1 acceptance claim',()=>{
  // A permanent reminder in the record itself; the live gate is the workflow, not this test.
  const record=fs.readFileSync('workers/data-platform/DATA-S2B-LIVE-EXPLAIN-ACCEPTANCE.md','utf8');
  assert.match(record,/LIVE EXPLAIN HAS NOT BEEN RUN/);
  assert.match(record,/local SQLite/i);
});

/* ------------------------------------------------------------------- Q1 contract */

const Q1=[
  'SEARCH o USING INDEX shadow_observation_idempotency (source_revision_id=?)',
  'SEARCH r USING INDEX sqlite_autoindex_ingestion_runs_2 (run_id=? AND source_revision_id=?)',
  'SEARCH h USING COVERING INDEX observation_heads_observation_id (observation_id=?)'
];
const nodes=details=>details.map(parseExplainDetail);

test('Q1 requires the migration-0003 head lookup bound to observation_heads and rejects scans',()=>{
  assert.equal(validateCurrentHeadsPlan(nodes(Q1)),true);
  // Older SQLite spells the same access with an explicit table and alias.
  assert.equal(validateCurrentHeadsPlan(nodes([
    'SEARCH TABLE shadow_observations AS o USING INDEX shadow_observation_idempotency (source_revision_id=?)',
    'SEARCH TABLE ingestion_runs AS r USING INDEX sqlite_autoindex_ingestion_runs_2 (run_id=?)',
    'SEARCH TABLE observation_heads AS h USING COVERING INDEX observation_heads_observation_id (observation_id=?)'
  ])),true);
  const cases=[
    [[Q1[0],Q1[1],'SCAN h'],/current_heads_head_scan|current_heads_head_index_lookup_missing/],
    [[Q1[0],Q1[1],'SCAN h USING COVERING INDEX observation_heads_observation_id'],
      /current_heads_head_scan|current_heads_head_index_lookup_missing/],
    [['SCAN o',Q1[1],Q1[2]],/current_heads_observation_scan|current_heads_observation_lookup_missing/],
    [['SCAN shadow_observations',Q1[1],Q1[2]],/current_heads_observation/],
    [[Q1[0],Q1[1],'SEARCH h USING AUTOMATIC COVERING INDEX (observation_id=?)'],/current_heads_automatic_index/],
    [[Q1[0],Q1[2]],/current_heads_run_lookup_missing/],
    [[Q1[1],Q1[2]],/current_heads_observation_lookup_missing/],
    [[Q1[0],Q1[1]],/current_heads_head_index_lookup_missing/]
  ];
  for(const [details,code] of cases)assert.throws(()=>validateCurrentHeadsPlan(nodes(details)),code,details.join(' | '));
});

test('the migration-0003 index against an unrelated operation cannot satisfy Q1',()=>{
  // The index name is present, but never as the observation_heads lookup.
  assert.throws(()=>validateCurrentHeadsPlan(nodes([
    Q1[0],Q1[1],
    'SEARCH r USING INDEX observation_heads_observation_id (run_id=?)',
    'SEARCH h USING INDEX sqlite_autoindex_observation_heads_1 (logical_key=?)'
  ])),/current_heads_head_index_lookup_missing/);
  // The old loose substring rule would have accepted exactly this.
  assert.ok(['SEARCH r USING INDEX observation_heads_observation_id (run_id=?)']
    .some(detail=>detail.includes('observation_heads_observation_id')));
});

/* ------------------------------------------------------------------- Q2 contract */

test('Q2 requires the covering source-revision index and rejects a table scan',()=>{
  assert.equal(validateObservationPopulationPlan(nodes([
    'SEARCH shadow_observations USING COVERING INDEX shadow_observation_idempotency (source_revision_id=?)'
  ])),true);
  const cases=[
    [['SCAN shadow_observations'],/observation_population/],
    [['SEARCH shadow_observations USING INDEX shadow_observation_idempotency (source_revision_id=?)'],
      /observation_population_covering_lookup_missing/],
    [['SEARCH shadow_observations USING AUTOMATIC COVERING INDEX (source_revision_id=?)'],
      /observation_population_automatic_index/]
  ];
  for(const [details,code] of cases)assert.throws(()=>validateObservationPopulationPlan(nodes(details)),code,details.join(' | '));
});

/* ------------------------------------------------------------------- Q3 contract */

test('Q3 requires the covering observation-head index scan and rejects a plain table scan',()=>{
  assert.equal(validateHeadPopulationPlan(nodes([
    'SCAN observation_heads USING COVERING INDEX observation_heads_observation_id'
  ])),true);
  const cases=[
    [['SCAN observation_heads'],/head_population_covering_scan_missing|head_population_table_scan/],
    [['SCAN observation_heads USING INDEX observation_heads_observation_id'],/head_population/],
    [['SCAN observation_heads USING AUTOMATIC COVERING INDEX'],/head_population_automatic_index/]
  ];
  for(const [details,code] of cases)assert.throws(()=>validateHeadPopulationPlan(nodes(details)),code,details.join(' | '));
});

/* ------------------------------------------------------------------- Q4 contract */

const Q4=[
  'MATERIALIZE observation_state',
  'USE TEMP B-TREE FOR count(DISTINCT)',
  'SEARCH shadow_observations USING INDEX shadow_observation_idempotency (source_revision_id=?)',
  'MATERIALIZE head_state',
  'SCAN h',
  'SEARCH o USING INDEX sqlite_autoindex_shadow_observations_1 (observation_id=?) LEFT-JOIN',
  'SEARCH ir USING INDEX sqlite_autoindex_ingestion_runs_2 (run_id=? AND source_revision_id=?) LEFT-JOIN',
  'MATERIALIZE rejection_state',
  'SEARCH observation_rejections USING COVERING INDEX observation_rejections_source_revision (source_revision_id=?)',
  'SEARCH r USING INDEX sqlite_autoindex_ingestion_runs_2 (run_id=? AND source_revision_id=?)',
  'SCAN os','SCAN hs','SCAN rs'
];

test('Q4 permits the head scan, requires every indexed probe and rejects re-evaluation',()=>{
  assert.equal(validatePostflightPlan(nodes(Q4)),true);
  const without=predicate=>Q4.filter(detail=>!predicate.test(detail));
  const cases=[
    // A second source-revision traversal means the materialized CTE is being re-evaluated.
    [[...Q4,'SEARCH shadow_observations USING INDEX shadow_observation_idempotency (source_revision_id=?)'],
      /postflight_repeated_observation_traversal/],
    [without(/shadow_observation_idempotency/),/postflight_observation_lookup_missing/],
    [without(/sqlite_autoindex_shadow_observations_1/),/postflight_observation_id_lookup_missing/],
    [without(/observation_rejections_source_revision/),/postflight_rejection_lookup_missing/],
    [without(/sqlite_autoindex_ingestion_runs_2/),/postflight_run_lookup_missing/],
    [[...Q4,'SCAN shadow_observations'],/postflight_observation_scan/],
    [Q4.map(detail=>detail==='SCAN h'?'SCAN o':detail),/postflight_observation_scan/],
    [[...Q4,'SEARCH h USING AUTOMATIC COVERING INDEX (observation_id=?)'],/postflight_automatic_index/]
  ];
  for(const [details,code] of cases)assert.throws(()=>validatePostflightPlan(nodes(details)),code,details.join(' | '));
  // The expected head scan on its own is never a failure.
  assert.ok(Q4.includes('SCAN h'));
});

test('the observation-id and ingestion-run probes also accept an explicit primary-key plan',()=>{
  assert.equal(validatePostflightPlan(nodes(Q4.map(detail=>
    detail.startsWith('SEARCH o USING')?'SEARCH o USING PRIMARY KEY (observation_id=?) LEFT-JOIN':detail))),true);
});

/* ------------------------------------------------- the index that is NOT required */

test('shadow_observations_ingestion_run is never required by any production plan gate',()=>{
  // It is proven present by the migration postflight, but the production predicates lead on
  // source_revision_id, so requiring it here would fail a correct database.
  assert.doesNotMatch(contractSource,/shadow_observations_ingestion_run/);
  const accepted=[nodes(Q1),nodes(['SEARCH shadow_observations USING COVERING INDEX shadow_observation_idempotency (source_revision_id=?)']),
    nodes(['SCAN observation_heads USING COVERING INDEX observation_heads_observation_id']),nodes(Q4)];
  const validators=[validateCurrentHeadsPlan,validateObservationPopulationPlan,validateHeadPopulationPlan,validatePostflightPlan];
  accepted.forEach((plan,index)=>assert.equal(validators[index](plan),true));
  assert.ok(!accepted.flat().some(node=>node.index==='shadow_observations_ingestion_run'));
});

/* ------------------------------------------------------ malformed and bounded rows */

test('malformed, oversized or wrong-cardinality plan results fail closed as ambiguous',()=>{
  const good=liveStatements();
  const thrown=input=>{
    try{validateProductionExplainAcceptance(input);}catch(error){return error;}
    throw new Error('the contract accepted a malformed result');
  };
  const ambiguous=input=>assert.equal(
    productionExplainFailureClassification(thrown(input)).classification,PRODUCTION_EXPLAIN_AMBIGUOUS);
  ambiguous(good.slice(0,3));
  ambiguous([...good,[{detail:'SCAN x'}]]);
  ambiguous('not-an-array');
  ambiguous([good[0],good[1],good[2],[]]);
  ambiguous([good[0],good[1],good[2],rows(Array.from({length:PRODUCTION_EXPLAIN_MAX_ROWS_PER_STATEMENT+1},()=>'SCAN os'))]);
  ambiguous([good[0],good[1],good[2],[{detail:null}]]);
  ambiguous([good[0],good[1],good[2],['SCAN os']]);
  ambiguous([good[0],good[1],good[2],[{detail:'x'.repeat(513)}]]);
  // A well-formed plan that violates the contract is a rejection, not an ambiguity.
  assert.equal(productionExplainFailureClassification(thrown([rows(['SCAN h']),good[1],good[2],good[3]])).classification,
    PRODUCTION_EXPLAIN_REJECTED);
});

/* ------------------------------------------------------------- read-only executable */

const response=(statements,meta={})=>({status:200,json:async()=>({success:true,
  result:statements.map((plan,index)=>({success:true,results:plan,
    meta:{rows_read:index===0?meta.rows_read??0:0,rows_written:index===0?meta.rows_written??0:0,changes:0}}))})});

function harness(step){
  const requests=[];
  return {requests,transport:async request=>{
    requests.push({...JSON.parse(request.body),__url:request.url,__method:request.method});
    return typeof step==='function'?step():step;
  }};
}
const accept=(step,overrides={})=>{
  const {requests,transport}=harness(step);
  return {requests,promise:acceptProductionExplainPlans({accountId:ACCOUNT,accountFingerprint:FINGERPRINT,
    databaseId:PRODUCTION_D1_ID,token:TOKEN,transport,...overrides})};
};

test('one read-only request is issued and the accepted result is bounded and sanitized',async()=>{
  const statements=liveStatements();
  const {requests,promise}=accept(response(statements,{rows_read:0}));
  const result=await promise;
  assert.equal(result.classification,PRODUCTION_EXPLAIN_ACCEPTED);
  assert.equal(result.mutationIssued,false);
  assert.equal(result.d1.apiCalls,PRODUCTION_EXPLAIN_MAX_D1_API_CALLS);
  assert.equal(result.d1.rowsWritten,0);
  assert.equal(requests.length,1);
  assert.equal(requests[0].__method,'POST');
  assert.match(requests[0].__url,/^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/[^/]+\/d1\/database\/[^/]+\/query$/);
  const sent=(requests[0].batch??[requests[0]]).map(entry=>entry.sql);
  assert.equal(sent.length,PRODUCTION_EXPLAIN_STATEMENT_COUNT);
  for(const sql of sent)assert.ok(sql.startsWith('EXPLAIN QUERY PLAN '),sql.slice(0,32));
  // The reported evidence carries no SQL, identifier or bound parameter value.
  const serialised=JSON.stringify(result.queries);
  assert.doesNotMatch(serialised,/SELECT|official-fpl-r1|gha-/);
  assert.equal(JSON.stringify(result).includes(TOKEN),false);
});

test('identity, configuration and repeat-dispatch surfaces fail closed before any request',async()=>{
  for(const [overrides,code] of [
    [{databaseId:'not-the-production-database'},/production_d1_identity_mismatch/],
    [{accountFingerprint:'0'.repeat(64)},/production_account_fingerprint_mismatch/],
    [{season:'2026-27'},/production_explain_config_invalid/]
  ]){
    const {requests,promise}=accept(response(liveStatements()),overrides);
    await assert.rejects(promise,code);
    assert.equal(requests.length,0);
  }
});

test('a written row, a resource overrun or a wrong result cardinality is never accepted',async()=>{
  const statements=liveStatements();
  for(const [step,code] of [
    [response(statements,{rows_written:1}),/production_explain_read_only_violation/],
    [response(statements,{rows_read:PRODUCTION_EXPLAIN_MAX_ROWS_READ+1}),/production_explain_resource_ceiling_exceeded/],
    [response(statements.slice(0,3)),/d1_result_contract_invalid|production_explain_statement_cardinality_invalid/],
    [()=>{throw new Error('boom');},/d1_transport_failed/]
  ]){
    const {requests,promise}=accept(step);
    const error=await promise.then(()=>null,failure=>failure);
    assert.match(String(error.message),code);
    const classification=productionExplainFailureClassification(error);
    assert.equal(classification.classification,PRODUCTION_EXPLAIN_AMBIGUOUS);
    assert.equal(classification.retryable,false);
    // Exactly one request on every path; the runner never retries inside an execution.
    assert.ok(requests.length<=PRODUCTION_EXPLAIN_MAX_D1_API_CALLS);
  }
});

test('a plan violation is reported as a rejection and still issues exactly one request',async()=>{
  const statements=liveStatements();
  const {requests,promise}=accept(response([rows(['SCAN h','SCAN o']),statements[1],statements[2],statements[3]]));
  const error=await promise.then(()=>null,failure=>failure);
  assert.equal(productionExplainFailureClassification(error).classification,PRODUCTION_EXPLAIN_REJECTED);
  assert.equal(productionExplainFailureClassification(error).phase,'acceptance');
  assert.equal(requests.length,1);
});

test('the EXPLAIN resource contract is separate from and far below the routine and migration ones',()=>{
  assert.equal(PRODUCTION_EXPLAIN_MAX_D1_API_CALLS,1);
  assert.equal(PRODUCTION_EXPLAIN_MAX_ROWS_WRITTEN,0);
  assert.ok(PRODUCTION_EXPLAIN_MAX_ROWS_READ<MAX_D1_ROWS_READ_PER_CYCLE/100);
  // The routine collection and migration ceilings are untouched by this checkpoint.
  assert.equal(MAX_D1_ROWS_READ_PER_CYCLE,125000);
  assert.equal(MAX_D1_ROWS_WRITTEN_PER_CYCLE,40000);
  assert.equal(MAX_D1_API_CALLS_PER_CYCLE,8);
  assert.equal(MIGRATION_0003_MAX_ROWS_READ,150000);
  // The deterministic first-run identifier is unchanged by exporting it.
  assert.match(productionRunIdFor('2026-09-02T17:41:00.000Z'),/^gha-[0-9a-f]{40}$/);
});

/* ------------------------------------------------------------------ entry point */

test('the entry point is single-attempt, masks identifiers and persists no raw payload',()=>{
  assert.match(entrySource,/GITHUB_RUN_ATTEMPT!=='1'\)throw new Error\('workflow_retry_forbidden'\)/);
  assert.match(entrySource,/::add-mask::\$\{token\}/);
  for(const name of ['accountId','databaseId'])assert.ok(entrySource.includes(`::add-mask::\${${name}}`));
  assert.match(entrySource,/classification!==PRODUCTION_EXPLAIN_ACCEPTED/);
  assert.match(entrySource,/throw error/);
  // Only the bounded sanitized summary is written; no artifact, no raw payload on disk.
  assert.deepEqual([...new Set([...entrySource.matchAll(/fs\.[a-zA-Z]+/g)].map(row=>row[0]))],['fs.appendFileSync']);
  assert.doesNotMatch(uncommented(entrySource),/writeFileSync|upload-artifact|result\.results|out\.results/);
});

/* -------------------------------------------------------------------- workflow */

test('the acceptance workflow is manual-only with one immutable approved-SHA input',()=>{
  assert.match(workflow,/^on:\n  workflow_dispatch:\n    inputs:\n      approved_sha:/m);
  assert.match(workflow,/approved_sha:[\s\S]{0,240}required: true/);
  assert.doesNotMatch(workflow,/^\s{2}(?:push|pull_request|pull_request_target|schedule|repository_dispatch):/m);
  assert.deepEqual([...new Set([...workflow.matchAll(/inputs\.([a-z_]+)/g)].map(row=>row[1]))],['approved_sha']);
  assert.match(workflow,/grep -Eq '\^\[0-9a-f\]\{40\}\$'/);
  assert.match(workflow,/if: github\.event_name == 'workflow_dispatch'/);
});

test('the acceptance workflow serializes against collection, resume and migration activity',()=>{
  assert.match(workflow,/concurrency:\n  group: data-s2-production-collection\n  cancel-in-progress: false/);
  for(const other of ['.github/workflows/data-s2-production-collection.yml',
    '.github/workflows/data-s2-production-resume.yml','.github/workflows/data-s2b-migration-0003.yml'])
    assert.match(fs.readFileSync(other,'utf8'),/group: data-s2-production-collection/);
});

test('exact-main and exact-head Verify gates complete before production credentials exist',()=>{
  const gate=workflow.indexOf('repository-gate:'),execution=workflow.indexOf('explain-acceptance:');
  assert.ok(gate>0&&gate<execution);
  assert.match(workflow,/explain-acceptance:\n    needs: repository-gate/);
  const gateBlock=workflow.slice(gate,execution);
  assert.doesNotMatch(gateBlock,/environment:|secrets\.CLOUDFLARE|CLOUDFLARE_/);
  for(const required of [
    'test "$EVENT_NAME" = workflow_dispatch','test "$EVENT_REF" = refs/heads/main',
    'test "$EVENT_REPOSITORY" = priteshpatel390-del/FPL',
    'test "$(git rev-parse HEAD)" = "$APPROVED_SHA"','test "$remote_main" = "$APPROVED_SHA"',
    'test -z "$(git status --porcelain)"',"row.name==='Tests and deterministic build'",
    "row.conclusion==='success'","row.app?.slug==='github-actions'"])
    assert.ok(gateBlock.includes(required),required);
  // The credentialled job uses only the existing protected environment and secret names.
  const execution2=workflow.slice(execution);
  assert.match(execution2,/environment:\n      name: data-s2-production-collection/);
  assert.deepEqual([...new Set([...execution2.matchAll(/secrets\.([A-Z0-9_]+)/g)].map(row=>row[1]))].sort(),
    ['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_D1_TOKEN']);
  assert.deepEqual([...new Set([...execution2.matchAll(/vars\.([A-Z0-9_]+)/g)].map(row=>row[1]))].sort(),
    ['CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT','CLOUDFLARE_PRODUCTION_D1_ID']);
});

// The exact shell the credentialled job runs immediately before the production entry point.
function credentialledRunBlock(){
  const marker='      - name: Reconfirm identity and remote main, then accept production plans only';
  const start=workflow.indexOf(marker);
  assert.ok(start>0,'the credentialled acceptance step must exist');
  const block=workflow.slice(workflow.indexOf('run: |',start)+'run: |\n'.length);
  return block.split('\n').filter(line=>line.startsWith('          ')||line.trim()==='')
    .map(line=>line.slice(10)).join('\n').trimEnd();
}

test('remote main is proved by the repository gate and independently again under credentials',()=>{
  const gate=workflow.slice(workflow.indexOf('repository-gate:'),workflow.indexOf('explain-acceptance:'));
  const credentialled=workflow.slice(workflow.indexOf('explain-acceptance:'));
  const resolve=/remote_main="\$\(git ls-remote https:\/\/github\.com\/priteshpatel390-del\/FPL\.git refs\/heads\/main \| cut -f1\)"/;
  for(const scope of [gate,credentialled]){
    assert.match(scope,resolve);
    assert.ok(scope.includes('test -n "$remote_main"'));
    assert.ok(scope.includes('test "$remote_main" = "$APPROVED_SHA"'));
  }
  assert.equal([...workflow.matchAll(new RegExp(resolve.source,'g'))].length,2);
  assert.doesNotMatch(workflow,/outputs:[\s\S]{0,400}remote_main/);
  const block=credentialledRunBlock().split('\n').map(line=>line.trim()).filter(Boolean);
  assert.equal(block.at(-1),'node workers/data-platform/run-production-explain.mjs');
  assert.equal(block.at(-2),'test "$remote_main" = "$APPROVED_SHA"');
  assert.equal(block.at(-3),'test -n "$remote_main"');
  assert.match(block.at(-4),/^remote_main="\$\(git ls-remote /);
  assert.equal(block[0],'set -euo pipefail');
  assert.ok(block.some(line=>line.startsWith('rm -f node_modules/.bin/wrangler')));
  // The recheck reaches only GitHub; no Cloudflare request precedes it.
  assert.ok(!block.slice(0,block.length-1).some(line=>/cloudflare|curl|api\.cloudflare/i.test(line)));
});

test('a main that moved after the repository gate stops before the acceptance runner',()=>{
  const script=credentialledRunBlock();
  const approved='0123456789abcdef0123456789abcdef01234567';
  const attempt=liveMain=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),'explain-gate-'));
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
  assert.deepEqual(attempt(approved),{status:0,invoked:true});
  const moved=attempt('fedcba9876543210fedcba9876543210fedcba98');
  assert.notEqual(moved.status,0);
  assert.equal(moved.invoked,false);
  const empty=attempt("''");
  assert.notEqual(empty.status,0);
  assert.equal(empty.invoked,false);
});

test('the acceptance workflow adds no migration, collection, resume, schedule or deployment surface',()=>{
  const body=uncommented(workflow);
  for(const forbidden of [/run-migration-0003/,/run-production-collection/,/run-production-resume/,
    /wrangler deploy/,/schedule:/,/cron/i,/versions/,/deployments/,/secrets:\s*inherit/])
    assert.doesNotMatch(body,forbidden);
  assert.deepEqual([...body.matchAll(/node workers\/data-platform\/[a-z0-9-]+\.mjs/g)].map(row=>row[0]),
    ['node workers/data-platform/run-production-explain.mjs']);
  assert.match(body,/permissions:\n  contents: read\n  checks: read/);
});
