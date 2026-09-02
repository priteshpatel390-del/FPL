import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DIAGNOSTIC_QUERIES,DIAGNOSTIC_ROWS,DIAGNOSTIC_STATUSES,EXPECTED_ACTIVE_VERSION_ID,EXPECTED_CRON,
  EXPECTED_D1_MIGRATIONS,REQUIRED_D1_TABLES,VERIFIED_FREE_PLAN_LIMITS,
  EXPECTED_D1_DATABASE_ID,EXPECTED_PRODUCTION_HOSTNAME,EXPECTED_ROLLBACK_VERSION_ID,FATAL_DIAGNOSTIC_CODES,
  MAX_ROWS,METRICS_UNAVAILABLE,RETAINED_OLDER_VERSION_ID,WORKER_NAME,
  assertAllowedDiagnosticSql,assertProductionIdentity,assertReadOnlyDiagnosticRequest,assertSanitizedOutput,
  buildDiagnosticJson,buildDiagnosticMatrix,buildDiagnosticReport,classifyBaselineIngestion,classifyBookkeeping,
  classifyBoundaries,classifyBootstrapEvidence,classifyChangedFact,classifyCollectorCadence,classifyConsistency,
  classifyCronCadence,classifyCronTriggers,classifyD1Accounting,classifyFetchTransport,classifyFixturesEvidence,
  classifyObservability,classifyResourceSuitability,classifyRollbackStop,classifySeasonValidation,
  classifyUnchangedCycle,classifyWorkerDeployment,diagnosticRow,extractActiveDeployment,extractCronExpressions,
  extractD1Metadata,extractDeployableVersions,extractObservability,extractVersionFacts,extractWorkerHostnames,
  isFatalDiagnostic,normaliseCategories,normaliseRunLedger,overallOutcome
} from '../workers/data-platform/phase4b/diagnostics-contract.mjs';
import {classifyReadResponse,guardedRow,healthOutcome,identityFingerprint} from '../workers/data-platform/phase4b/readonly-diagnostics.mjs';
import {DATA_S2_COLLECTION_CRON} from '../workers/data-platform/official-fpl-history.mjs';
import {validateReadOnlySql} from '../workers/data-platform/phase0/readonly-preflight.mjs';

const contract=fs.readFileSync('workers/data-platform/phase4b/diagnostics-contract.mjs','utf8');
const runner=fs.readFileSync('workers/data-platform/phase4b/readonly-diagnostics.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/data-s2b-phase4b-readonly-diagnostics.yml','utf8');

const ACCOUNT='account-id-value';
const workerBase=`/accounts/${ACCOUNT}/workers/scripts/${WORKER_NAME}`;
const d1Base=`/accounts/${ACCOUNT}/d1/database/${EXPECTED_D1_DATABASE_ID}`;

const versionDetail={id:EXPECTED_ACTIVE_VERSION_ID,resources:{
  script_runtime:{compatibility_date:'2026-08-22'},
  bindings:[
    {name:'TEAMSHEET_DATA_DB',type:'d1',database_id:EXPECTED_D1_DATABASE_ID},
    {name:'DATA_S1_HTTP_AUTH_TOKEN',type:'secret_text'},
    {name:'DATA_S2_SEASON',type:'plain_text',text:'2026-27'}
  ]}};
const deployments={deployments:[
  {id:'deployment-current',versions:[{version_id:EXPECTED_ACTIVE_VERSION_ID,percentage:100}]},
  {id:'deployment-prior',versions:[{version_id:EXPECTED_ROLLBACK_VERSION_ID,percentage:100}]}
]};
const deployableVersionIds=[EXPECTED_ACTIVE_VERSION_ID,EXPECTED_ROLLBACK_VERSION_ID,RETAINED_OLDER_VERSION_ID];
const facts=extractVersionFacts(versionDetail);

const run=(overrides={})=>({
  run_id:'run-a',run_type:'official_fpl_structured_history',mode:'shadow_only',status:'completed',
  safe_endpoint_class:'official_fpl_public_core',started_at:'2026-09-01T01:00:00.000Z',completed_at:'2026-09-01T01:00:04.000Z',
  records_seen:9860,records_accepted:9860,records_quarantined:0,records_rejected:0,error_class:null,
  schema_version:'data-s2a-v1',observations:9860,heads:9860,...overrides
});
const ledgerRows=[
  run({run_id:'run-c',started_at:'2026-09-02T01:00:00.000Z',completed_at:'2026-09-02T01:00:03.000Z',records_seen:9860,records_accepted:0,observations:0,heads:0}),
  run({run_id:'run-b',started_at:'2026-09-01T01:00:00.000Z',completed_at:'2026-09-01T01:00:05.000Z',records_seen:9860,records_accepted:4,observations:4,heads:4}),
  run({run_id:'run-a',started_at:'2026-08-31T01:00:00.000Z',completed_at:'2026-08-31T01:00:09.000Z'})
];
const ledger=normaliseRunLedger(ledgerRows);
const statusTotals=[{status:'completed',runs:3,records_seen:29580,records_accepted:9864,records_quarantined:0,records_rejected:0}];
const counts={data_sources:1,data_source_revisions:1,ingestion_runs:3,shadow_observations:9864,observation_heads:9860,canonical_entities:1064};
const official={ingestion_runs:3,shadow_observations:9864,observation_heads:9860};
const consistency={total_heads:9860,orphan_heads:0,foreign_heads:0,non_accepted_observations:0,non_shadow_observations:0,distinct_logical_keys:9860,unparented_observations:0};
const categories=normaliseCategories([
  {category:'official_fpl_event',subject_type:'event',observations:114,subjects:38},
  {category:'official_fpl_fixture',subject_type:'fixture',observations:2660,subjects:380},
  {category:'official_fpl_player',subject_type:'player',observations:6000,subjects:626},
  {category:'official_fpl_team',subject_type:'team',observations:1090,subjects:20}
]);
const seasons=[{season:'2026-27',entity_type:'player',entities:626},{season:'2026-27',entity_type:'team',entities:20}];
const revisions={revised_logical_keys:4,advanced_heads:4,distinct_input_revisions:3,contributing_runs:2};
const sourceRows=[{source_id:'source-official-fpl',source_key:'official-fpl',source_name:'Official FPL API',source_kind:'official_fpl'}];
const revisionRows=[{source_revision_id:'official-fpl-r1',rights_classification:'durable_allowed',retention_allowed:1,redistribution_allowed:0,shadow_ingest_allowed:1}];
const observability={enabled:'true',headSamplingRate:1,logpush:'false'};
const database={uuid:EXPECTED_D1_DATABASE_ID,name:'teamsheet-data',fileSize:2_400_000};
const schema=REQUIRED_D1_TABLES.map(name=>({name}));
const migrations=[{version:1,name:'shadow_data_foundation'},{version:2,name:'official_fpl_structured_history'}];
const governance={source_official_fpl:1,official_fpl_r1:1};

function fullMatrix({expressions=[EXPECTED_CRON]}={}){
  return buildDiagnosticMatrix([
    classifyWorkerDeployment({active:extractActiveDeployment(deployments),deployableVersionIds,versionFacts:facts}),
    classifyCronTriggers(expressions),
    classifyCollectorCadence({expressions,runLedger:ledger}),
    classifyFetchTransport(ledger),
    classifyBootstrapEvidence(categories),
    classifyFixturesEvidence(categories),
    classifySeasonValidation({seasons,versionFacts:facts}),
    classifyBaselineIngestion({counts,official,statusTotals,runLedger:ledger}),
    classifyUnchangedCycle(ledger),
    classifyChangedFact({revisions,runLedger:ledger}),
    classifyConsistency({consistency,counts,official}),
    classifyBookkeeping({runLedger:ledger,statusTotals,counts,official,rejections:[]}),
    classifyResourceSuitability({runLedger:ledger,metricsAvailability:METRICS_UNAVAILABLE}),
    classifyD1Accounting({database,counts,consistency,schema,migrations,governance}),
    classifyRollbackStop({deployableVersionIds,active:extractActiveDeployment(deployments),runLedger:ledger}),
    classifyObservability({observability,runLedger:ledger,metricsAvailability:METRICS_UNAVAILABLE}),
    classifyBoundaries({revisionRows,sourceRows,runLedger:ledger,consistency,categories})
  ]);
}
const statusOf=(matrix,id)=>matrix.find(row=>row.id===id).status;

test('the diagnostic surface is exactly the seventeen requested acceptance rows',()=>{
  assert.deepEqual([...DIAGNOSTIC_STATUSES],['PASS','FAIL','PARTIAL','PENDING','SUPERSEDED']);
  assert.deepEqual([...DIAGNOSTIC_ROWS],[
    'worker_version_deployment','cron_triggers','collector_cadence','fetch_transport',
    'bootstrap_static_evidence','fixtures_evidence','season_validation','baseline_ingestion',
    'unchanged_cycle_proof','changed_fact_proof','d1_observations_heads_orphans','ingestion_bookkeeping',
    'cpu_resource_suitability','d1_accounting','rollback_stop_evidence','observability',
    'provider_data_security_boundaries'
  ]);
  const matrix=fullMatrix();
  assert.deepEqual(matrix.map(row=>row.id),[...DIAGNOSTIC_ROWS]);
  for(const row of matrix)assert.ok(DIAGNOSTIC_STATUSES.includes(row.status));
});

test('a missing check becomes PENDING rather than removing a row from the bundle',()=>{
  const matrix=buildDiagnosticMatrix([classifyCronTriggers([EXPECTED_CRON])]);
  assert.equal(matrix.length,DIAGNOSTIC_ROWS.length);
  assert.equal(statusOf(matrix,'cron_triggers'),'PASS');
  assert.equal(statusOf(matrix,'changed_fact_proof'),'PENDING');
});

// ------------------------------------------------------------------ no mutation authority
test('no mutation, cleanup, collector or retry endpoint is reachable',()=>{
  const forbidden=[
    [`${workerBase}/versions`,'POST'],[`${workerBase}/deployments`,'POST'],[`${workerBase}/schedules`,'PUT'],
    [`${workerBase}/schedules`,'POST'],[workerBase,'PUT'],[workerBase,'DELETE'],[`${workerBase}/secrets`,'PUT'],
    [`${workerBase}/settings`,'PATCH'],[`${workerBase}/settings`,'POST'],[`/accounts/${ACCOUNT}/workers/domains`,'PUT'],
    [`/accounts/${ACCOUNT}/access/apps`,'POST'],[`${d1Base}/time_travel/restore`,'POST'],[d1Base,'DELETE'],
    [`/accounts/${ACCOUNT}/d1/database`,'POST'],[`${d1Base}/import`,'POST'],[`${d1Base}/query`,'GET']
  ];
  for(const [path,method] of forbidden){
    assert.throws(()=>assertReadOnlyDiagnosticRequest({method,path,workerBase,d1Base,sql:'SELECT 1'}),
      error=>isFatalDiagnostic(error)&&error.code==='diagnostics_endpoint_forbidden',`${method} ${path}`);
  }
});

test('only the exact read surface is permitted',()=>{
  const allowed=[
    `${workerBase}/deployments`,`${workerBase}/versions?deployable=true`,`${workerBase}/schedules`,
    `${workerBase}/settings`,`/accounts/${ACCOUNT}/workers/domains`,
    `${workerBase}/versions/${EXPECTED_ACTIVE_VERSION_ID}`,`${d1Base}?fields=uuid,name,file_size`
  ];
  for(const path of allowed)assert.deepEqual(assertReadOnlyDiagnosticRequest({method:'GET',path,workerBase,d1Base}),{method:'GET'});
  for(const path of [`${workerBase}/versions/not-a-uuid`,`${d1Base}?fields=uuid`,'/accounts/other/workers/domains',`${workerBase}`,'/user/tokens'])
    assert.throws(()=>assertReadOnlyDiagnosticRequest({method:'GET',path,workerBase,d1Base}),/diagnostics_endpoint_forbidden/);
});

test('the D1 query POST is the only write-shaped request and accepts no arbitrary SQL',()=>{
  const sql=validateReadOnlySql(DIAGNOSTIC_QUERIES.counts);
  assert.deepEqual(assertReadOnlyDiagnosticRequest({method:'POST',path:`${d1Base}/query`,workerBase,d1Base,sql}),{method:'POST',body:{sql}});
  // Membership is raw-text exact, so a comment-smuggled or re-spaced variant is refused
  // even when it would normalise to an allowlisted statement.
  const rejected=['SELECT 1','SELECT * FROM shadow_observations','INSERT INTO ingestion_runs VALUES (1)',
    'UPDATE observation_heads SET observation_id = 1','DELETE FROM shadow_observations','DROP TABLE ingestion_runs',
    'PRAGMA table_info(ingestion_runs)','SELECT 1; SELECT 2',`${DIAGNOSTIC_QUERIES.counts} -- appended`,
    `-- prefix\n${DIAGNOSTIC_QUERIES.counts}`,`${DIAGNOSTIC_QUERIES.counts} `,`${DIAGNOSTIC_QUERIES.counts};`,''];
  for(const candidate of rejected){
    assert.throws(()=>assertAllowedDiagnosticSql(candidate),error=>isFatalDiagnostic(error)&&error.code==='diagnostics_sql_forbidden',candidate);
    assert.throws(()=>assertReadOnlyDiagnosticRequest({method:'POST',path:`${d1Base}/query`,workerBase,d1Base,sql:candidate}),/diagnostics_sql_forbidden/);
  }
});

test('every pinned diagnostic query is a single bounded read-only SELECT',()=>{
  for(const [name,sql] of Object.entries(DIAGNOSTIC_QUERIES)){
    assert.equal(validateReadOnlySql(sql),assertAllowedDiagnosticSql(sql),name);
    assert.match(sql.trim(),/^SELECT\b/i,name);
    assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP|TRUNCATE|PRAGMA|ATTACH|DETACH|VACUUM|REINDEX)\b/i,name);
    const aggregateOnly=['governance','counts','officialHistory','consistency','revisions'].includes(name);
    const pinnedNarrow=['schema','migrations','source','revision'].includes(name);
    assert.ok(/LIMIT \d+/.test(sql)||aggregateOnly||pinnedNarrow,`${name} must be aggregate, primary-key pinned or LIMIT bounded`);
  }
  // Narrow pinned reads are bounded by the schema itself: seven allowlisted tables, two
  // migrations, and one governance row each. Every result is still capped on the way back.
  assert.equal(REQUIRED_D1_TABLES.length,7);
  assert.equal(EXPECTED_D1_MIGRATIONS.length,2);
  assert.match(DIAGNOSTIC_QUERIES.schema,/name IN \('schema_migrations'/);
  assert.match(DIAGNOSTIC_QUERIES.source,/WHERE source_id = 'source-official-fpl'/);
  assert.match(DIAGNOSTIC_QUERIES.revision,/WHERE source_revision_id = 'official-fpl-r1'/);
  // D1 free-tier daily row reads became enforced on 1 September 2026, so the ledger must
  // scan shadow_observations once and reach heads through their logical_key primary key.
  assert.doesNotMatch(DIAGNOSTIC_QUERIES.runLedger,/\(SELECT COUNT\(\*\) FROM shadow_observations/);
  assert.match(DIAGNOSTIC_QUERIES.runLedger,/LEFT JOIN observation_heads h ON h\.logical_key = o\.logical_key/);
  assert.match(DIAGNOSTIC_QUERIES.runLedger,/GROUP BY r\.run_id/);
});

test('the runner and contract carry no mutation, cleanup, retry or collector machinery',()=>{
  for(const source of [contract,runner]){
    assert.doesNotMatch(source,/method:'(?:PUT|PATCH|DELETE)'|method="(?:PUT|PATCH|DELETE)"/);
    assert.doesNotMatch(source,/time_travel|multipart|FormData|bindings_inherit|wrangler\s+(?:deploy|triggers)/);
    assert.doesNotMatch(source,/bootstrap-static|collectOfficialFplHistory|scheduled\s*\(/);
    assert.doesNotMatch(source,/upload-version\.mjs|deploy-version\.mjs|activate-cron\.mjs|official-fpl-d1-rest-plan\.mjs/);
    assert.doesNotMatch(source,/\bDROP\s+(?:TABLE|DATABASE)\b|deleteDatabase|unlinkSync|rmSync|rimraf|\brm -rf\b/i);
    assert.doesNotMatch(source,/setTimeout\(|retryCount|maxRetries|attempt\s*<\s*\d|\bwhile\s*\(true\)/);
  }
  assert.doesNotMatch(runner,/for\s*\(\s*let\s+attempt/);
});

// ------------------------------------------------------------------ fail-closed identity
test('production identity failures stop the run immediately',()=>{
  const base={accountId:ACCOUNT,accountFingerprint:identityFingerprint(ACCOUNT),expectedProductionFingerprint:'',
    workerName:WORKER_NAME,databaseId:EXPECTED_D1_DATABASE_ID,databaseName:'teamsheet-data',hostnames:[EXPECTED_PRODUCTION_HOSTNAME]};
  assert.deepEqual(assertProductionIdentity(base),{fingerprintCheck:'NOT PROVIDED',worker:WORKER_NAME,hostname:EXPECTED_PRODUCTION_HOSTNAME,database:'teamsheet-data'});
  assert.equal(assertProductionIdentity({...base,expectedProductionFingerprint:identityFingerprint(ACCOUNT)}).fingerprintCheck,'MATCHED');
  const cases=[
    [{accountId:''},'diagnostics_production_account_ambiguous'],
    [{accountFingerprint:'not-a-fingerprint'},'diagnostics_production_account_ambiguous'],
    [{expectedProductionFingerprint:identityFingerprint('a-different-account')},'diagnostics_production_account_ambiguous'],
    [{expectedProductionFingerprint:'sha256:short'},'diagnostics_production_account_ambiguous'],
    [{workerName:'teamsheet-evidence-archive'},'diagnostics_worker_identity_mismatch'],
    [{hostnames:['data.fpltsheet.co.uk','extra.example']},'diagnostics_worker_identity_mismatch'],
    [{hostnames:[]},'diagnostics_worker_identity_mismatch'],
    [{databaseId:'01e2b4f9-0000-0000-0000-000000000000'},'diagnostics_database_identity_mismatch'],
    [{databaseName:'teamsheet-evidence'},'diagnostics_database_identity_mismatch']
  ];
  for(const [override,code] of cases){
    assert.throws(()=>assertProductionIdentity({...base,...override}),
      error=>isFatalDiagnostic(error)&&error.code===code,JSON.stringify(override));
  }
});

test('an unauthorized or malformed provider response fails closed, a plain read failure does not',()=>{
  for(const status of [401,403])assert.throws(()=>classifyReadResponse(status,{success:false}),
    error=>isFatalDiagnostic(error)&&error.code==='diagnostics_api_unauthorized');
  assert.throws(()=>classifyReadResponse(200,null),error=>isFatalDiagnostic(error)&&error.code==='diagnostics_response_malformed');
  assert.deepEqual(classifyReadResponse(200,{success:true,result:{ok:1}}),{ok:true,result:{ok:1}});
  assert.equal(classifyReadResponse(500,{success:false}).ok,false);
  assert.equal(classifyReadResponse(429,{success:false}).outcome,'UNAVAILABLE (HTTP_429)');
  assert.equal(classifyReadResponse(200,{success:false}).outcome,'UNAVAILABLE (cloudflare_success_false)');
});

test('unbounded and malformed control-plane payloads fail closed',()=>{
  assert.throws(()=>extractActiveDeployment({deployments:Array.from({length:MAX_ROWS.deployments+1},()=>({id:'x',versions:[]}))}),
    error=>isFatalDiagnostic(error)&&error.code==='diagnostics_response_unbounded');
  assert.throws(()=>extractDeployableVersions({items:Array.from({length:MAX_ROWS.versions+1},(_,index)=>({id:`${index}`}))}),/unbounded|malformed/);
  assert.throws(()=>extractCronExpressions({schedules:Array.from({length:MAX_ROWS.schedules+1},()=>({cron:'* * * * *'}))}),/unbounded/);
  assert.throws(()=>extractWorkerHostnames(Array.from({length:MAX_ROWS.domains+1},()=>({service:WORKER_NAME}))),/unbounded/);
  for(const malformed of [null,{},{deployments:{}}])assert.throws(()=>extractActiveDeployment(malformed),/malformed/);
  for(const malformed of [null,{uuid:'x',name:'teamsheet-data'},{uuid:'x',name:'teamsheet-data',file_size:-1}])
    assert.throws(()=>extractD1Metadata(malformed),/malformed/);
});

test('a secret value inside a Version binding fails closed before anything is recorded',()=>{
  const exposed={...versionDetail,resources:{...versionDetail.resources,
    bindings:versionDetail.resources.bindings.map(row=>row.type==='secret_text'?{...row,text:'live-secret-value'}:row)}};
  assert.throws(()=>extractVersionFacts(exposed),error=>isFatalDiagnostic(error)&&error.code==='diagnostics_secret_exposure_risk');
  const noD1={...versionDetail,resources:{...versionDetail.resources,bindings:versionDetail.resources.bindings.filter(row=>row.type!=='d1')}};
  assert.throws(()=>extractVersionFacts(noD1),/database_identity_mismatch/);
});

test('every fatal code is declared and no other error may masquerade as fatal',()=>{
  assert.ok(FATAL_DIAGNOSTIC_CODES.includes('diagnostics_mutation_required'));
  assert.equal(isFatalDiagnostic(new Error('diagnostics_endpoint_forbidden')),false);
  assert.equal(isFatalDiagnostic(new TypeError('boom')),false);
});

// ------------------------------------------------------------------ safe continuation
test('a stale Cron expectation is recorded as evidence and never stops the read',()=>{
  assert.equal(classifyCronCadence([EXPECTED_CRON]),'matches_expectation');
  assert.equal(classifyCronCadence([]),'absent');
  assert.equal(classifyCronCadence(['0 1 * * *']),'daily_only');
  assert.equal(classifyCronCadence(['0 1 * * *','30 2 * * *']),'daily_only');
  assert.equal(classifyCronCadence(['0 */4 * * 1-5']),'unexpected');
  const drifted=fullMatrix({expressions:['0 1 * * *']});
  assert.equal(statusOf(drifted,'cron_triggers'),'FAIL');
  assert.equal(statusOf(drifted,'collector_cadence'),'FAIL');
  // The read continues: every later D1-derived row still carries its evidence.
  for(const id of ['d1_observations_heads_orphans','ingestion_bookkeeping','d1_accounting','provider_data_security_boundaries'])
    assert.notEqual(statusOf(drifted,id),'PENDING');
  assert.equal(statusOf(drifted,'d1_observations_heads_orphans'),'PASS');
  const row=drifted.find(entry=>entry.id==='cron_triggers');
  assert.ok(row.evidence.some(entry=>entry.includes('classification=daily_only')));
  assert.ok(row.evidence.some(entry=>entry.includes('no_schedule_mutation_performed')));
});

test('an active Version that differs from the repository pin is SUPERSEDED, not fatal',()=>{
  const promoted='9f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f';
  const active=extractActiveDeployment({deployments:[
    {id:'deployment-current',versions:[{version_id:promoted,percentage:100}]},
    {id:'deployment-prior',versions:[{version_id:EXPECTED_ACTIVE_VERSION_ID,percentage:100}]}
  ]});
  const row=classifyWorkerDeployment({active,deployableVersionIds:[promoted,EXPECTED_ACTIVE_VERSION_ID],versionFacts:{...facts,versionId:promoted}});
  assert.equal(row.status,'SUPERSEDED');
  assert.ok(row.evidence.some(entry=>entry===`active_version=${promoted}`));
  assert.ok(row.evidence.some(entry=>entry===`repository_pinned_version=${EXPECTED_ACTIVE_VERSION_ID}`));
  assert.ok(row.evidence.some(entry=>entry==='current_deployment_id=deployment-current'));
});

test('traffic ambiguity and binding drift are recorded as FAIL and continue',()=>{
  const split=extractActiveDeployment({deployments:[
    {id:'deployment-current',versions:[{version_id:EXPECTED_ACTIVE_VERSION_ID,percentage:60},{version_id:EXPECTED_ROLLBACK_VERSION_ID,percentage:40}]},
    {id:'deployment-prior',versions:[{version_id:EXPECTED_ROLLBACK_VERSION_ID,percentage:100}]}
  ]});
  assert.equal(classifyWorkerDeployment({active:split,deployableVersionIds,versionFacts:facts}).status,'FAIL');
  assert.equal(classifyWorkerDeployment({active:extractActiveDeployment(deployments),deployableVersionIds,
    versionFacts:{...facts,compatibilityDate:'2026-09-01'}}).status,'FAIL');
  assert.equal(classifyWorkerDeployment({active:extractActiveDeployment(deployments),deployableVersionIds,
    versionFacts:{...facts,season:'2025-26'}}).status,'FAIL');
});

test('a check that throws a non-fatal error degrades to a bounded FAIL row',()=>{
  const row=guardedRow('season_validation',()=>{throw new Error('nested raw value: Bearer super-secret');});
  assert.equal(row.status,'FAIL');
  assert.deepEqual(row.evidence,['note=check_could_not_be_evaluated','detail=[withheld]']);
  assert.throws(()=>guardedRow('season_validation',()=>assertProductionIdentity({accountId:''})),/production_account_ambiguous/);
});

// ------------------------------------------------------------------ evidence semantics
test('an unchanged cycle is proven only by a completed run that wrote no observation and no head',()=>{
  assert.equal(classifyUnchangedCycle(ledger).status,'PASS');
  const notProven=normaliseRunLedger([run({records_seen:9860,records_accepted:0,observations:3,heads:3})]);
  assert.equal(classifyUnchangedCycle(notProven).status,'PARTIAL');
  assert.equal(classifyUnchangedCycle(normaliseRunLedger([run()])).status,'PENDING');
  assert.equal(classifyUnchangedCycle([]).status,'PENDING');
  const zeroSeen=normaliseRunLedger([run({records_seen:0,records_accepted:0,observations:0,heads:0})]);
  assert.equal(classifyUnchangedCycle(zeroSeen).status,'PENDING');
});

test('a changed fact is proven only by an appended revision with a matching head advance',()=>{
  assert.equal(classifyChangedFact({revisions,runLedger:ledger}).status,'PASS');
  assert.equal(classifyChangedFact({revisions:{...revisions,advanced_heads:0},runLedger:ledger}).status,'PARTIAL');
  assert.equal(classifyChangedFact({revisions:{revised_logical_keys:0,advanced_heads:0,distinct_input_revisions:1,contributing_runs:1},runLedger:ledger}).status,'PENDING');
  assert.equal(classifyChangedFact({revisions:null,runLedger:ledger}).status,'PENDING');
  // No retained revision at all means the change has not happened yet: PENDING, not PARTIAL,
  // even when several runs have appended brand-new keys.
  assert.equal(classifyChangedFact({revisions:{revised_logical_keys:0,advanced_heads:0,distinct_input_revisions:2,contributing_runs:3},runLedger:ledger}).status,'PENDING');
  assert.equal(classifyChangedFact({revisions,runLedger:[ledger[1]]}).status,'PARTIAL');
});

test('baseline, bootstrap, fixtures and season evidence reflect real population thresholds',()=>{
  assert.equal(classifyBaselineIngestion({counts,official,statusTotals,runLedger:ledger}).status,'PASS');
  assert.equal(classifyBaselineIngestion({counts,official,statusTotals,runLedger:[]}).status,'PENDING');
  assert.equal(classifyBootstrapEvidence(categories).status,'PASS');
  assert.equal(classifyFixturesEvidence(categories).status,'PASS');
  assert.equal(classifyBootstrapEvidence([]).status,'PENDING');
  const thin=normaliseCategories([{category:'official_fpl_fixture',subject_type:'fixture',observations:10,subjects:5}]);
  assert.equal(classifyFixturesEvidence(thin).status,'PARTIAL');
  const rogue=normaliseCategories([...categories.map(row=>({category:row.category,subject_type:row.subjectType,observations:row.observations,subjects:row.subjects})),
    {category:'understat_team',subject_type:'team',observations:5,subjects:5}]);
  assert.equal(classifyBootstrapEvidence(rogue).status,'FAIL');
  assert.equal(classifySeasonValidation({seasons,versionFacts:facts}).status,'PASS');
  assert.equal(classifySeasonValidation({seasons:[{season:'2025-26',entity_type:'team',entities:20}],versionFacts:facts}).status,'FAIL');
  assert.equal(classifySeasonValidation({seasons:[],versionFacts:facts}).status,'PENDING');
});

test('head, orphan and bookkeeping contradictions are recorded as FAIL',()=>{
  assert.equal(classifyConsistency({consistency,counts,official}).status,'PASS');
  for(const breach of [{orphan_heads:1},{foreign_heads:2},{non_shadow_observations:1},{unparented_observations:4},{total_heads:99999}])
    assert.equal(classifyConsistency({consistency:{...consistency,...breach},counts,official}).status,'FAIL');
  assert.equal(classifyConsistency({consistency:{...consistency,total_heads:0,distinct_logical_keys:0},counts:{...counts,shadow_observations:0},official:{...official,observation_heads:0,shadow_observations:0}}).status,'PENDING');
  assert.equal(classifyBookkeeping({runLedger:ledger,statusTotals,counts,official,rejections:[]}).status,'PASS');
  const contradicted=normaliseRunLedger([run({records_seen:10,records_accepted:20})]);
  assert.equal(classifyBookkeeping({runLedger:contradicted,statusTotals,counts,official,rejections:[]}).status,'FAIL');
  const failedWrote=normaliseRunLedger([run({status:'failed',records_accepted:5,observations:5,error_class:'collection_failed'})]);
  assert.equal(classifyBookkeeping({runLedger:failedWrote,statusTotals,counts,official,rejections:[]}).status,'FAIL');
  assert.equal(classifyBookkeeping({runLedger:ledger,statusTotals,counts:{...counts,ingestion_runs:9},official,rejections:[]}).status,'FAIL');
});

test('transport, rollback and boundary rows read the retained live ledger',()=>{
  assert.equal(classifyFetchTransport(ledger).status,'PASS');
  const redirectAfter=normaliseRunLedger([run({run_id:'run-x',status:'failed',started_at:'2026-09-03T01:00:00.000Z',completed_at:null,
    records_seen:0,records_accepted:0,observations:0,heads:0,error_class:'Invalid_redirect_value__must_be_one_of__follow__or__manual____er'}),...ledgerRows]);
  assert.equal(classifyFetchTransport(redirectAfter).status,'FAIL');
  assert.equal(classifyFetchTransport([]).status,'PENDING');
  const active=extractActiveDeployment(deployments);
  assert.equal(classifyRollbackStop({deployableVersionIds,active,runLedger:ledger}).status,'PASS');
  assert.equal(classifyRollbackStop({deployableVersionIds:[EXPECTED_ACTIVE_VERSION_ID],active,runLedger:ledger}).status,'FAIL');
  assert.equal(classifyBoundaries({revisionRows,sourceRows,runLedger:ledger,consistency,categories}).status,'PASS');
  for(const drift of [{rights_classification:'unknown_fail_closed'},{redistribution_allowed:1},{retention_allowed:0},{shadow_ingest_allowed:0}])
    assert.equal(classifyBoundaries({revisionRows:[{...revisionRows[0],...drift}],sourceRows,runLedger:ledger,consistency,categories}).status,'FAIL');
});

test('CPU, D1 row and invocation metrics are reported unavailable rather than widened',()=>{
  const row=classifyResourceSuitability({runLedger:ledger,metricsAvailability:METRICS_UNAVAILABLE});
  assert.equal(row.status,'PENDING');
  for(const field of ['worker_cpu_time','d1_rows_read','d1_rows_written','cron_invocation_counts'])
    assert.ok(row.evidence.some(entry=>entry.startsWith(`${field}=NOT AVAILABLE`)),field);
  assert.ok(row.evidence.some(entry=>entry.includes('wall_clock_is_not_cpu_time')));
  // The owner asked for current first-party limits to be re-verified rather than
  // inherited: they are reported as context and never turned into a suitability verdict.
  assert.equal(VERIFIED_FREE_PLAN_LIMITS.verifiedOn,'2026-09-02');
  assert.equal(VERIFIED_FREE_PLAN_LIMITS.workerCpuPerCronTriggerMs,10);
  assert.equal(VERIFIED_FREE_PLAN_LIMITS.d1RowsReadPerDay,5000000);
  assert.equal(VERIFIED_FREE_PLAN_LIMITS.d1RowsWrittenPerDay,100000);
  assert.ok(row.evidence.some(entry=>entry.startsWith('free_plan_limits_reverified_on=2026-09-02')));
  assert.ok(row.evidence.some(entry=>entry.startsWith('free_plan_d1_rows_read_per_day=5000000')));
  assert.notEqual(row.status,'PASS');
  assert.ok(row.evidence.some(entry=>entry.includes('no_additional_analytics_permission_requested')));
  assert.doesNotMatch(contract,/graphql|analytics_engine|workersInvocationsAdaptive/i);
  assert.doesNotMatch(runner,/graphql|analytics_engine|workersInvocationsAdaptive/i);
  assert.equal(classifyD1Accounting({database,counts,consistency,schema,migrations,governance}).status,'PARTIAL');
  for(const drift of [{schema:schema.slice(1)},{migrations:migrations.slice(0,1)},{governance:{source_official_fpl:0,official_fpl_r1:1}}])
    assert.equal(classifyD1Accounting({database,counts,consistency,schema,migrations,governance,...drift}).status,'FAIL');
  assert.equal(classifyD1Accounting({database:null,counts,consistency,schema,migrations,governance}).status,'PENDING');
  assert.equal(classifyObservability({observability,runLedger:ledger,metricsAvailability:METRICS_UNAVAILABLE}).status,'PARTIAL');
});

// ------------------------------------------------------------------ sanitized output
test('schedule and D1 diagnostics stay bounded and structurally sanitized',()=>{
  assert.deepEqual(extractCronExpressions({schedules:[{cron:'0 1 * * *'},{cron:'secret\nvalue',token:'do-not-log'}]}),['0 1 * * *','[invalid]']);
  const hostile=normaliseRunLedger([run({run_id:'Bearer super-secret-token',error_class:'raw exception: Bearer abc',
    started_at:'not-a-time',safe_endpoint_class:'x'.repeat(200),schema_version:'v; DROP TABLE x'})]);
  const serialised=JSON.stringify(hostile);
  for(const value of ['Bearer','super-secret-token','raw exception','DROP TABLE'])assert.equal(serialised.includes(value),false,value);
  assert.equal(hostile[0].runId,'[invalid]');
  assert.equal(hostile[0].startedAt,'[invalid]');
  const row=diagnosticRow('cron_triggers','FAIL',Array.from({length:40},(_,index)=>`entry-${index}-${'x'.repeat(400)}`));
  assert.ok(row.evidence.length<=MAX_ROWS.evidence);
  for(const entry of row.evidence)assert.ok(entry.length<=160);
});

test('the retained report and JSON bundle cannot carry credentials or raw identifiers',()=>{
  const identity={worker:WORKER_NAME,hostname:EXPECTED_PRODUCTION_HOSTNAME,database:'teamsheet-data',fingerprintCheck:'MATCHED'};
  const matrix=fullMatrix();
  const args={approvedSha:'a'.repeat(40),identity,matrix,readOutcomes:[{name:'worker_deployments',outcome:'PASS'}],generatedAt:'2026-09-02T12:00:00.000Z'};
  const report=buildDiagnosticReport(args);
  const json=JSON.stringify(buildDiagnosticJson(args));
  const forbidden=[ACCOUNT,EXPECTED_D1_DATABASE_ID,'cloudflare-api-token-value','access-client-secret-value'];
  for(const text of [report,json]){
    assert.equal(assertSanitizedOutput(text,forbidden),text);
    for(const value of forbidden)assert.equal(text.includes(value),false,value);
  }
  assert.throws(()=>assertSanitizedOutput(`${report}\nAuthorization: Bearer leaked-token-value`,forbidden),
    error=>isFatalDiagnostic(error)&&error.code==='diagnostics_secret_exposure_risk');
  assert.throws(()=>assertSanitizedOutput(`${report}\naccount=${ACCOUNT}`,forbidden),/secret_exposure_risk/);
  assert.throws(()=>buildDiagnosticReport({...args,approvedSha:'not-a-sha'}),/repository_identity_missing/);
});

test('the report states zero mutation accounting and refuses to imply acceptance',()=>{
  const identity={worker:WORKER_NAME,hostname:EXPECTED_PRODUCTION_HOSTNAME,database:'teamsheet-data',fingerprintCheck:'NOT PROVIDED'};
  const args={approvedSha:'b'.repeat(40),identity,matrix:fullMatrix(),readOutcomes:[],generatedAt:'2026-09-02T12:00:00.000Z'};
  const report=buildDiagnosticReport(args);
  for(const line of ['Worker Version uploads: 0','Deployments: 0','Cron mutations: 0','D1 writes/migrations: 0',
    'Route/domain mutations: 0','Access mutations: 0','Secret mutations: 0','Collector executions: 0',
    'Cleanup operations: 0','Retries after ambiguous mutation: 0'])assert.ok(report.includes(line),line);
  assert.ok(report.includes('is **not** DATA-S2B production acceptance'));
  // Evidence joins values with a pipe; unescaped it would split the markdown table cell.
  const breached=buildDiagnosticReport({...args,matrix:buildDiagnosticMatrix([
    classifyConsistency({consistency:{...consistency,orphan_heads:1,foreign_heads:2},counts,official})])});
  const cells=breached.split('\n').filter(line=>line.startsWith('| `d1_observations_heads_orphans`'));
  assert.equal(cells.length,1);
  assert.ok(cells[0].includes('breaches=orphan_heads\\|foreign_source_heads'));
  assert.equal(cells[0].split(/(?<!\\)\|/).length-1,4);
  for(const id of DIAGNOSTIC_ROWS)assert.ok(report.includes(`\`${id}\``),id);
  assert.equal(buildDiagnosticJson(args).mutations.collectorExecutions,0);
  assert.equal(overallOutcome(fullMatrix()),'PARTIAL');
  assert.equal(overallOutcome(fullMatrix({expressions:[]})),'FAIL');
  assert.equal(overallOutcome([diagnosticRow('cron_triggers','PASS',[])]),'PASS');
});

test('the health read is bounded to an availability verdict',()=>{
  assert.equal(healthOutcome(200,{ok:true,mode:'shadow_only'}),'PASS (HTTP 200, ok, shadow_only)');
  assert.equal(healthOutcome(200,{ok:true,mode:'write'}),'UNAVAILABLE (HTTP_200)');
  assert.equal(healthOutcome(503,null),'UNAVAILABLE (HTTP_503)');
  assert.equal(healthOutcome(null,null),'UNAVAILABLE (transport)');
});

test('observability and settings reads never surface unbounded provider structure',()=>{
  assert.deepEqual(extractObservability({observability:{enabled:true,head_sampling_rate:1},logpush:false}),
    {enabled:'true',headSamplingRate:1,logpush:'false'});
  assert.deepEqual(extractObservability({}),{enabled:'[absent]',headSamplingRate:'[absent]',logpush:'[absent]'});
  assert.throws(()=>extractObservability(null),/malformed/);
});

// ------------------------------------------------------------------ workflow gating
test('the diagnostics workflow is manual, exact-main and exact-Verify gated before credentials',()=>{
  for(const expected of [/workflow_dispatch:/,/approved_sha:/,/refs\/heads\/main/,/priteshpatel390-del\/FPL/,
    /\^\[0-9a-f\]\{40\}\$/,/git ls-remote/,/git status --porcelain/,/Tests and deterministic build/,
    /environment:\s*\n\s+name: data-s2b-phase3-deployment/,/node-version: 24\.19\.0/])assert.match(workflow,expected);
  assert.doesNotMatch(workflow,/^\s{2}(?:push|schedule|pull_request|pull_request_target|workflow_run|repository_dispatch|issue_comment):/m);
  for(const credential of ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_PHASE3_DEPLOY_TOKEN'])
    assert.ok(workflow.indexOf('repository-gate:')<workflow.indexOf(credential));
  assert.match(workflow,/permissions:\s*\n\s+contents: read\s*\n\s+checks: read/);
});

test('the diagnostics workflow runs only the read-only helper and no mutation or collector step',()=>{
  assert.match(workflow,/node workers\/data-platform\/phase4b\/readonly-diagnostics\.mjs/);
  assert.doesNotMatch(workflow,/upload-version|deploy-version|activate-cron|migrate-0002|run-live-experiment|wrangler/);
  assert.doesNotMatch(workflow,/official-fpl-history|bootstrap-static|curl .*api\.cloudflare\.com/);
  assert.deepEqual([...new Set([...workflow.matchAll(/secrets\.([A-Z0-9_]+)/g)].map(row=>row[1]))].sort(),
    ['CF_ACCESS_CLIENT_ID','CF_ACCESS_CLIENT_SECRET','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_PHASE3_DEPLOY_TOKEN','DATA_S1_HTTP_AUTH_TOKEN']);
  assert.doesNotMatch(workflow,/secrets\.CLOUDFLARE_API_TOKEN|CLOUDFLARE_WORKER_UPLOAD_TOKEN|CLOUDFLARE_D1_WRITE_TOKEN|CLOUDFLARE_E2C/);
  assert.match(workflow,/PRODUCTION_ACCOUNT_FINGERPRINT: \$\{\{ vars\.CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT \}\}/);
});

test('the collector cadence row is derived from the deployed collector guard, not an assumption',()=>{
  assert.equal(DATA_S2_COLLECTION_CRON,EXPECTED_CRON);
  const compatible=classifyCollectorCadence({expressions:[EXPECTED_CRON],runLedger:ledger});
  assert.equal(compatible.status,'PASS');
  assert.ok(compatible.evidence.some(entry=>entry==='collector_accepts_live_schedule=true'));
  const daily=classifyCollectorCadence({expressions:['0 1 * * *'],runLedger:ledger});
  assert.equal(daily.status,'FAIL');
  assert.ok(daily.evidence.some(entry=>entry==='collector_guard=cron_unrecognised_no_collection'));
  assert.equal(classifyCollectorCadence({expressions:[EXPECTED_CRON],runLedger:[]}).status,'PENDING');
});
