import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  MIGRATION_PATH,MIGRATION_SHA256,MIGRATION_STATEMENT_COUNT,extractBookmark,extractMutationBatchResult,migrationDigest,
  sameDeployment,splitPinnedMigration,validatePinnedMigration,validatePostState,validatePreState
} from '../workers/data-platform/phase1/migrate-0002.mjs';

const workflowPath='.github/workflows/data-s2b-phase1-migration-0002.yml';
const helperPath='workers/data-platform/phase1/migrate-0002.mjs';
const workflow=fs.readFileSync(workflowPath,'utf8');
const helper=fs.readFileSync(helperPath,'utf8');
const migration=fs.readFileSync(MIGRATION_PATH,'utf8');

function runBlocks(source){return [...source.matchAll(/^\s+run: \|\n((?:\s{10}.*\n?)*)/gm)].map(match=>match[1]).join('\n');}

const preMigrations=[{version:1,name:'shadow_data_foundation',applied_at:'2026-08-22T00:00:00.000Z'}];
const zeroCounts={data_sources:0,data_source_revisions:0,ingestion_runs:0,shadow_observations:0,observation_heads:0,canonical_entities:0};
const zeroOfficial={ingestion_runs:0,shadow_observations:0,observation_heads:0};
const sourceRow={
  source_id:'source-official-fpl',source_key:'official-fpl',source_name:'Official FPL API',
  source_kind:'official_fpl',created_at:'2026-08-26T00:00:00.000Z'
};
const revisionRow={
  source_revision_id:'official-fpl-r1',source_id:'source-official-fpl',revision:1,schema_version:'data-s2a-v1',
  rights_classification:'durable_allowed',retention_allowed:1,redistribution_allowed:0,attribution_required:0,
  attribution_text:null,terms_reference:'docs/DATA_SOURCES.md',terms_reviewed_at:'2026-08-26T00:00:00.000Z',
  acquisition_status:'approved_internal_shadow_history',shadow_ingest_allowed:1,supersedes_revision_id:null,
  created_at:'2026-08-26T00:00:00.000Z'
};

test('Phase 1 workflow is manual-only with one immutable SHA input',()=>{
  assert.match(workflow,/^on:\n  workflow_dispatch:\n    inputs:\n      approved_sha:/m);
  assert.match(workflow,/approved_sha:[\s\S]{0,220}required: true/);
  assert.doesNotMatch(workflow,/^\s{2}(?:push|pull_request|pull_request_target|schedule):/m);
  assert.deepEqual([...workflow.matchAll(/^\s{6}([a-z_]+):\n\s{8}description:/gm)].map(row=>row[1]),['approved_sha']);
  assert.match(workflow,/grep -Eq '\^\[0-9a-f\]\{40\}\$'/);
  assert.match(workflow,/ref: \$\{\{ inputs\.approved_sha \}\}/);
});

test('repository identity and exact-head CI gates complete before Phase 1 credentials exist',()=>{
  const gate=workflow.indexOf('repository-gate:'),mutation=workflow.indexOf('phase1-migration:');
  assert.ok(gate>0&&gate<mutation);
  assert.match(workflow,/phase1-migration:\n    needs: repository-gate/);
  assert.doesNotMatch(workflow.slice(gate,mutation),/environment:|secrets\.|CLOUDFLARE_/);
  assert.match(workflow.slice(mutation),/name: data-s2b-phase1-migration/);
  assert.match(workflow.slice(mutation),/CLOUDFLARE_D1_WRITE_TOKEN: \$\{\{ secrets\.CLOUDFLARE_D1_WRITE_TOKEN \}\}/);
  assert.match(workflow.slice(mutation),/CLOUDFLARE_ACCOUNT_ID: \$\{\{ secrets\.CLOUDFLARE_ACCOUNT_ID \}\}/);
  for(const required of [
    'test "$EVENT_NAME" = workflow_dispatch','test "$EVENT_REF" = refs/heads/main',
    'test "$EVENT_REPOSITORY" = priteshpatel390-del/FPL','git ls-remote https://github.com/priteshpatel390-del/FPL.git refs/heads/main',
    'git status --porcelain','Tests and deterministic build',"row.conclusion==='success'",
    "row.head_sha===process.env.APPROVED_SHA","row.app?.slug==='github-actions'"
  ])assert.ok(workflow.includes(required),required);
});

test('Phase 1 executable mutation surface is one explicit D1 transaction batch only',()=>{
  const executable=`${runBlocks(workflow)}\n${helper}`;
  for(const forbidden of [
    /\bwrangler\b/i,/\/workers\/scripts\/[^/]+\/(?:versions|schedules)[^\n]*(?:POST|PUT|PATCH|DELETE)/i,
    /\/time_travel\/restore/i,/\bfetch\([^)]*\{[^}]*method:\s*['"](?:PUT|PATCH|DELETE)['"]/i,
    /\b(?:route|domain|access|secret)\b[^\n]*(?:create|update|delete|put)/i
  ])assert.doesNotMatch(executable,forbidden);
  assert.match(helper,/const batch=splitPinnedMigration\(migration\)\.map\(sql=>\(\{sql\}\)\);/);
  assert.match(helper,/request\(`\$\{d1Base\}\/query`,\{method:'POST',body:\{batch\}\}\)/);
  assert.equal((helper.match(/body:\{batch\}/g)??[]).length,1);
  assert.doesNotMatch(helper,/body:\{sql:migration\}/);
  assert.doesNotMatch(workflow,/CLOUDFLARE_API_TOKEN/);
});

test('migration SQL is repository-pinned and split into exactly four reviewed batch statements',()=>{
  assert.equal(MIGRATION_PATH,'workers/data-platform/migrations/0002_official_fpl_structured_history.sql');
  assert.equal(MIGRATION_STATEMENT_COUNT,4);
  assert.equal(migrationDigest(migration),MIGRATION_SHA256);
  assert.doesNotThrow(()=>validatePinnedMigration(migration));
  assert.throws(()=>validatePinnedMigration(`${migration}\n-- drift`),/migration_content_drift/);
  const statements=splitPinnedMigration(migration);
  assert.equal(statements.length,MIGRATION_STATEMENT_COUNT);
  assert.equal(statements[0],'PRAGMA foreign_keys = ON');
  assert.equal(statements.filter(statement=>/\bINSERT\s+INTO\b/i.test(statement)).length,3);
  assert.ok(statements.some(statement=>/INSERT INTO schema_migrations/.test(statement)));
  assert.ok(statements.some(statement=>/INSERT INTO data_sources/.test(statement)));
  assert.ok(statements.some(statement=>/INSERT INTO data_source_revisions/.test(statement)));
  assert.doesNotMatch(migration,/\b(?:UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP|TRUNCATE|ATTACH|DETACH|VACUUM|REINDEX)\b/i);
  assert.doesNotMatch(workflow,/inputs\.[a-z_]*sql|github\.event\.inputs\.[a-z_]*sql/i);
  assert.match(helper,/fs\.readFileSync\(MIGRATION_PATH,'utf8'\)/);
});

test('pre-mutation state must remain exactly the owner-approved zero-history state',()=>{
  const state={migrations:preMigrations,governance:{source_official_fpl:0,official_fpl_r1:0},counts:zeroCounts,official:zeroOfficial};
  assert.equal(validatePreState(state),true);
  assert.throws(()=>validatePreState({...state,migrations:[...preMigrations,{version:2,name:'official_fpl_structured_history'}]}),/migration_drift/);
  assert.throws(()=>validatePreState({...state,governance:{source_official_fpl:1,official_fpl_r1:0}}),/pre_governance_drift/);
  assert.throws(()=>validatePreState({...state,counts:{...zeroCounts,ingestion_runs:1}}),/pre_table_count_drift/);
  assert.throws(()=>validatePreState({...state,official:{...zeroOfficial,shadow_observations:1}}),/pre_official_history_drift/);
});

test('Time Travel bookmark is mandatory and captured before the live migration request',()=>{
  assert.equal(extractBookmark({bookmark:'bookmark-1'}),'bookmark-1');
  for(const malformed of [undefined,{},null,{bookmark:''},{bookmark:42}])assert.throws(()=>extractBookmark(malformed),/time_travel_bookmark_invalid/);
  const bookmarkIndex=helper.indexOf('/time_travel/bookmark');
  const checkpointIndex=helper.indexOf('Pre-mutation checkpoint');
  const mutationIndex=helper.indexOf("body:{batch}");
  assert.ok(bookmarkIndex>0&&bookmarkIndex<checkpointIndex&&checkpointIndex<mutationIndex);
  assert.match(helper,/phase1-bookmark\.txt/);
  assert.match(workflow,/trap 'rm -f "\$RUNNER_TEMP"\/phase1-\*\.json "\$RUNNER_TEMP"\/phase1-bookmark\.txt' EXIT/);
  assert.doesNotMatch(helper,/bookmark[^;\n]*(?:GITHUB_STEP_SUMMARY|console|stderr)/i);
});

test('migration batch response requires one success result per reviewed statement',()=>{
  const success=Array.from({length:MIGRATION_STATEMENT_COUNT},()=>({success:true}));
  assert.deepEqual(extractMutationBatchResult(success),success);
  for(const malformed of [undefined,{},[],success.slice(0,-1),[...success.slice(0,-1),{success:false}], [...success,{success:true}]]){
    assert.throws(()=>extractMutationBatchResult(malformed),/migration_batch_contract_invalid/);
  }
});

test('post-mutation state proves exact governance rows and no observation or head writes',()=>{
  const state={
    migrations:[...preMigrations,{version:2,name:'official_fpl_structured_history',applied_at:'2026-08-26T00:00:00.000Z'}],
    sourceRows:[sourceRow],revisionRows:[revisionRow],
    counts:{...zeroCounts,data_sources:1,data_source_revisions:1},official:zeroOfficial
  };
  assert.equal(validatePostState(state),true);
  assert.throws(()=>validatePostState({...state,sourceRows:[{...sourceRow,source_key:'wrong'}]}),/post_source_governance_drift/);
  assert.throws(()=>validatePostState({...state,revisionRows:[{...revisionRow,redistribution_allowed:1}]}),/post_revision_governance_drift/);
  assert.throws(()=>validatePostState({...state,counts:{...state.counts,shadow_observations:1}}),/post_table_count_drift/);
  assert.throws(()=>validatePostState({...state,official:{...zeroOfficial,observation_heads:1}}),/post_official_history_drift/);
});

test('Worker deployment must remain unchanged during migration',()=>{
  const before={deploymentId:'d1',versionId:'v1',timestamp:'2026-08-25T00:00:00Z'};
  assert.equal(sameDeployment(before,{...before}),true);
  for(const changed of [{...before,deploymentId:'d2'},{...before,versionId:'v2'},{...before,timestamp:'2026-08-26T00:00:00Z'}])assert.throws(()=>sameDeployment(before,changed),/worker_deployment_changed_during_migration/);
});

test('postchecks run after migration and re-prove Cron, season, binding and deployment invariants',()=>{
  const mutation=helper.indexOf("body:{batch}");
  const post=helper.indexOf('validatePostState(post)');
  const settingsAfter=helper.indexOf('const settingsAfter=');
  const deploymentAfter=helper.indexOf('const deploymentsAfter=');
  assert.ok(mutation>0&&mutation<post&&post<settingsAfter&&settingsAfter<deploymentAfter);
  assert.match(helper,/assertPreMutationWorkerState\(settingsAfter,schedulesAfter\)/);
  assert.match(helper,/if\(d1After\.databaseId!==databaseId\)throw new Error\('d1_binding_database_drift'\)/);
  assert.match(helper,/sameDeployment\(deploymentsBefore,deploymentsAfter\)/);
});

test('credentials and live identifiers are masked and raw Cloudflare responses are temporary only',()=>{
  assert.match(helper,/::add-mask::\$\{token\}/);
  assert.match(helper,/::add-mask::\$\{account\}/);
  assert.match(helper,/::add-mask::\$\{databaseId\}/);
  assert.match(helper,/::add-mask::\$\{bookmark\}/);
  assert.match(helper,/fs\.writeFileSync\(`\$\{temp\}\/phase1-\$\{crypto\.randomUUID\(\)\}\.json`,text,\{mode:0o600\}\)/);
  assert.doesNotMatch(helper,/console\.log|set -x|process\.env\)/);
  assert.doesNotMatch(workflow,/upload-artifact|artifacts:/i);
  assert.doesNotMatch(helper,/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
});

test('Phase 1 code never auto-restores D1 on failure',()=>{
  assert.doesNotMatch(helper,/\/time_travel\/restore/);
  assert.doesNotMatch(helper,/\brestore\b[^'"\n]*(?:POST|fetch|request)/i);
  assert.match(helper,/main\(\)\.catch\(error=>/);
  assert.match(helper,/Phase 1 stopped:/);
});
