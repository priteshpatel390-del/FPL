import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {
  MIGRATION_0006_BYTES,MIGRATION_0006_EXACT_POST_EMPTY,MIGRATION_0006_EXACT_PRE,MIGRATION_0006_GIT_BLOB_SHA,
  MIGRATION_0006_INCONSISTENT,MIGRATION_0006_NAME,MIGRATION_0006_PATH,MIGRATION_0006_POST_WITH_MAPPING,
  MIGRATION_0006_REQUIRED_OBJECTS,MIGRATION_0006_STATEMENT_COUNT,MIGRATION_0006_VERSION,
  classifyMigration0006State,readPinnedMigration0006
} from '../workers/data-platform/migration6/migration-0006-contract.mjs';
import {createParameterizedD1Adapter,sanitizedPrivateMappingEvidence} from '../workers/data-platform/migration6/production.mjs';
import {EXPECTED_D1_DATABASE_ID} from '../workers/data-platform/phase4b/live-contract.mjs';

const workflowPath='.github/workflows/api-football-migration-0006.yml';
const workflow=fs.readFileSync(workflowPath,'utf8');
const source=fs.readFileSync('workers/data-platform/migration6/production.mjs','utf8');
const runner=fs.readFileSync('workers/data-platform/run-migration-0006.mjs','utf8');
const ledger=[
  {version:1,name:'shadow_data_foundation'},{version:2,name:'official_fpl_structured_history'},
  {version:3,name:'production_query_plan_indexes'},{version:4,name:'api_football_shadow_identity'},
  {version:5,name:'api_football_shadow_runtime'}
];
const objects=MIGRATION_0006_REQUIRED_OBJECTS.map(([type,name,tbl_name])=>({type,name,tbl_name}));

test('migration 0006 exact immutable identity and 12-statement shape',()=>{
  assert.equal(MIGRATION_0006_PATH,'workers/data-platform/migrations/0006_api_football_mapping_qualification.sql');
  assert.equal(MIGRATION_0006_GIT_BLOB_SHA,'8d1212d3cae74de13c2d15dc20ac49d4588403b9');
  assert.equal(MIGRATION_0006_BYTES,6632);assert.equal(MIGRATION_0006_VERSION,6);assert.equal(MIGRATION_0006_NAME,'api_football_mapping_qualification');
  const statements=readPinnedMigration0006();assert.equal(statements.length,MIGRATION_0006_STATEMENT_COUNT);assert.equal(statements.length,12);
  assert.equal(execFileSync('git',['hash-object',MIGRATION_0006_PATH],{encoding:'utf8'}).trim(),MIGRATION_0006_GIT_BLOB_SHA);
});

test('migration 0006 pins exact tables, triggers, index and trusted anchors',()=>{
  assert.deepEqual(MIGRATION_0006_REQUIRED_OBJECTS.map(row=>row[1]),[
    'api_football_team_mapping_qualifications','api_football_team_mapping_members','api_football_mapping_member_insert',
    'api_football_mapping_qualification_commit','api_football_mapping_qualification_immutable',
    'api_football_mapping_member_update_immutable','api_football_mapping_member_delete_immutable',
    'api_football_team_mapping_heads','api_football_mapping_head_insert','api_football_mapping_head_update',
    'api_football_mapping_members_provider'
  ]);
  const sql=fs.readFileSync(MIGRATION_0006_PATH,'utf8');
  assert.match(sql,/provider_team_id='49'[\s\S]*fpl:team:6/);assert.match(sql,/provider_team_id='63'[\s\S]*fpl:team:13/);
});

test('state classifier admits only exact 0005, empty 0006, or exact persisted cardinality',()=>{
  assert.equal(classifyMigration0006State({ledger,objects:[],mappingCounts:{}}),MIGRATION_0006_EXACT_PRE);
  const post=[...ledger,{version:6,name:MIGRATION_0006_NAME,applied_at:'2026-09-18T00:00:00.000Z'}];
  assert.equal(classifyMigration0006State({ledger:post,objects,mappingCounts:{qualifications:0,members:0,heads:0}}),MIGRATION_0006_EXACT_POST_EMPTY);
  assert.equal(classifyMigration0006State({ledger:post,objects,mappingCounts:{qualifications:1,members:20,heads:1}}),MIGRATION_0006_POST_WITH_MAPPING);
  assert.equal(classifyMigration0006State({ledger:post,objects,mappingCounts:{qualifications:1,members:19,heads:1}}),MIGRATION_0006_INCONSISTENT);
});

test('D1 adapter keeps private values exclusively in parameter bindings',async()=>{
  const accountId='account';const bodies=[];
  const db=createParameterizedD1Adapter({accountId,accountFingerprint:await crypto.subtle.digest('SHA-256',new TextEncoder().encode(accountId)).then(value=>Buffer.from(value).toString('hex')),databaseId:EXPECTED_D1_DATABASE_ID,token:'secret',
    transport:async(_url,init)=>{bodies.push(init.body);return {ok:true,status:200,json:async()=>({success:true,result:[{success:true,results:[]}]})};}});
  const sentinelProvider='987654321987654321',sentinelFpl='2026-27:fpl:team:999999';
  await db.batch([db.prepare('INSERT INTO private_mapping(provider_id,fpl_id) VALUES(?,?)').bind(sentinelProvider,sentinelFpl)]);
  const body=JSON.parse(bodies[0]);assert.equal(body.batch[0].sql,'INSERT INTO private_mapping(provider_id,fpl_id) VALUES(?,?)');
  assert.deepEqual(body.batch[0].params,[sentinelProvider,sentinelFpl]);assert.doesNotMatch(body.batch[0].sql,/987654321|999999/);
});

test('workflow is one-shot exact-main exact-Verify and shares non-cancelling writer lock',()=>{
  assert.match(workflow,/on:\n  workflow_dispatch:/);assert.doesNotMatch(workflow,/\n  (push|schedule|pull_request):/);
  assert.match(workflow,/github\.run_attempt == 1/);assert.match(workflow,/git ls-remote[\s\S]*refs\/heads\/main/);
  assert.match(workflow,/Tests and deterministic build/);assert.match(workflow,/group: data-s2-production-collection/);
  assert.match(workflow,/cancel-in-progress: false/);
});

test('workflow separates schema and private mapping and admits each mutation freshly',()=>{
  assert.match(workflow,/MIGRATION_0006_PREFLIGHT_MODE: schema_pre/);assert.match(workflow,/MIGRATION_0006_PREFLIGHT_MODE: schema_post/);
  assert.match(workflow,/MIGRATION_0006_PREFLIGHT_MODE: mapping_pre/);assert.match(workflow,/MIGRATION_0006_PREFLIGHT_MODE: mapping_post/);assert.match(workflow,/needs: \[repository-gate, mapping-preflight\]/);
  assert.equal((workflow.match(/API_FOOTBALL_OWNER_CROSSWALK_JSON/g)||[]).length,2);
  assert.match(workflow,/API_FOOTBALL_OWNER_CROSSWALK_JSON: "\$\{\{ secrets\.API_FOOTBALL_OWNER_CROSSWALK_JSON \}\}"/);
  assert.doesNotMatch(workflow,/API_FOOTBALL_API_KEY|api-sports\.io|wrangler deploy|wrangler secret|wrangler triggers/);
});

test('preflight preserves 50,000 daily-write admission and runtime isolation',()=>{
  const preflight=fs.readFileSync('workers/data-platform/migration6/preflight.mjs','utf8');
  assert.match(preflight,/MIGRATION_0005_ACCOUNT_ROWS_WRITTEN_ADMISSION_MAX/);
  assert.match(preflight,/READY_FOR_MIGRATION_0006/);assert.match(preflight,/READY_FOR_PRIVATE_MAPPING_PERSISTENCE/);
  assert.match(preflight,/apiFootballRequests:0/);assert.match(preflight,/legacyDataPlatformCronCount:0/);
});

test('schema mutation is one-shot, reconciles unknown transport, and never auto-restores',()=>{
  assert.equal((source.match(/await db\.batch\(statements\.map/g)||[]).length,1);
  assert.match(source,/reconciled_after_unknown_transport/);assert.match(source,/AMBIGUOUS_REQUIRES_OWNER_ATTENTION/);
  assert.match(source,/automaticRestorePermitted:false/);assert.doesNotMatch(source,/time_travel\/restore|wrangler d1 time-travel restore/);
});

test('private report and failures are allowlisted and exclude plan rows and private identifiers',()=>{
  const sentinel='PRIVATE_SENTINEL_987654321';
  const serialized=JSON.stringify(sanitizedPrivateMappingEvidence({state:{mappingCounts:{qualifications:1,members:20,heads:1}},plan:{persistenceIntegrityHash:'a'.repeat(64),rows:[{providerTeamId:sentinel}],privateValue:sentinel}}));
  assert.doesNotMatch(serialized,new RegExp(sentinel));assert.doesNotMatch(serialized,/providerTeamId|rows|privateValue/);
  assert.match(source,/sanitizedPrivateMappingEvidence/);
  assert.doesNotMatch(runner,/console\.(log|error)\([^\n]*(crosswalk|providerUniverse|plan)/);
  assert.doesNotMatch(runner,/String\(error|error\.message/);assert.match(runner,/safeFailure/);
});

test('private persistence reuses strict mapping contract and performs exactly two Official FPL requests',()=>{
  assert.match(source,/prepareQualifiedTeamMappingPersistence/);assert.match(source,/persistQualifiedTeamMappingPlan/);assert.match(source,/readQualifiedTeamMappings/);
  assert.match(source,/officialFplRequests>=2/);assert.match(source,/officialFplRequests!==2/);
  assert.match(source,/apiFootballRequests:0/);assert.doesNotMatch(source,/API_FOOTBALL_API_KEY|api-sports\.io/);
});

test('production foundation does not touch product or model paths',()=>{
  const changed=execFileSync('git',['diff','--name-only','origin/main...HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
  const working=execFileSync('git',['status','--short'],{encoding:'utf8'}).trim().split('\n').filter(Boolean).map(row=>row.slice(3));
  assert.equal([...changed,...working].some(path=>path.startsWith('src/model/')||path.startsWith('src/ui/')),false);
});
