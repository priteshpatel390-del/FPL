import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {
  BASE_QUERIES,OPTIONAL_QUERIES,assertReadOnlySql,evaluateStoragePreflight,
  optionalQueryKeysForObjects,summarizeCollectorSettings
} from '../workers/api-football-collector/live-storage-preflight.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const officialRun=[{run_id:'gha-'+('a'.repeat(40)),completed_at:'2026-09-18T12:00:00.000Z',status:'completed'}];
const officialTeams=Array.from({length:20},(_,index)=>({
  subject_entity_id:'2026-27:fpl:team:'+(index+1),
  observation_id:String(index+1).padStart(64,'0'),
  input_revision:'rev-'+(index+1),
  logical_key:'official-fpl|2026-27|team|'+String(index+1).padStart(2,'0')
}));
const baseRows={officialRun,officialTeams,mappingRows:[{count:0}]};
const DATA_SOURCE_REVISION_0004_COLUMNS=[
  'provider','source_key','owner_approval_id','allowed_use','normalized_facts_only','public_use_allowed',
  'commercial_use_allowed','raw_payload_retention_allowed','stop_on_objection'
];
const SCHEMA4_OBJECTS=[
  'provider_fixture_identities','provider_participation_revisions','provider_participation_history',
  'owner_risk_source_revision_insert','owner_risk_source_revision_update'
];
const SCHEMA5_OBJECTS=[
  'api_football_runtime_state','api_football_request_attempts','api_football_discovery_generations',
  'api_football_discovery_heads','api_football_fixture_revisions','api_football_generation_fixtures',
  'api_football_committed_head_insert','api_football_committed_head_update',
  'api_football_committed_generation_immutable','api_football_attempt_retention',
  'api_football_fixture_revision_history','api_football_fixture_supersession_insert',
  'api_football_generation_fixture_consistency','api_football_participation_run_insert',
  'api_football_participation_run_update'
];
const collectorAbsent={exists:false,deploymentCount:0,crons:[],d1BindingPresent:false,d1BindingMatchesProduction:false,activation:null,apiFootballSecretBindingPresent:false};
const baseLedger=Object.freeze([
  {version:1,name:'shadow_data_foundation',appliedAt:'2026-08-22T00:00:00.000Z'},
  {version:2,name:'official_fpl_structured_history',appliedAt:'2026-08-26T00:00:00.000Z'},
  {version:3,name:'production_query_plan_indexes',appliedAt:'2026-09-02T00:00:00.000Z'}
]);

function object(name){
  const type=name.includes('trigger')||name.includes('head_insert')||name.includes('head_update')||
    name.includes('immutable')||name.includes('supersession')||name.includes('consistency')||
    name.includes('run_insert')||name.includes('run_update')||name.includes('member_insert')||
    name.includes('qualification_commit')||name.includes('member_update')||name.includes('member_delete')
    ?'trigger':name.includes('history')||name.includes('retention')||name.includes('provider')&&name.includes('members_')
      ?'index':'table';
  return {type,name,tbl_name:name};
}
function baseRowsForLedger(ledger){
  const versions=new Set(ledger.map(row=>row.version));
  return {
    ...baseRows,
    dataSourceRevisionColumns:versions.has(4)?DATA_SOURCE_REVISION_0004_COLUMNS.map(name=>({name})):[],
    participationColumns:versions.has(5)?[{name:'ingestion_run_id'}]:[]
  };
}
function evaluate({ledger,objects=[],optionalRows={},collector=collectorAbsent,nowIso='2026-09-19T00:00:00.000Z'}){
  return evaluateStoragePreflight({
    ledger,objects,foreignKeys:[],baseRows:baseRowsForLedger(ledger),optionalRows,databaseIdentityMatch:true,
    dataPlatformBindingMatch:true,collector,nowIso
  });
}
function table(name){return object(name);}

test('live storage preflight SQL registry is read-only and rejects mutation/comment escape hatches',()=>{
  for(const sql of [...Object.values(BASE_QUERIES),...Object.values(OPTIONAL_QUERIES)])assert.equal(assertReadOnlySql(sql),sql);
  for(const sql of [
    'UPDATE schema_migrations SET name=name',
    'DELETE FROM schema_migrations',
    'SELECT 1; DELETE FROM schema_migrations',
    'SELECT 1 -- hidden',
    'SELECT 1 /* hidden */',
    'CREATE TABLE x(y)'
  ])assert.throws(()=>assertReadOnlySql(sql),/preflight_sql_invalid/);
});

test('optional D1 queries require every referenced table before execution',()=>{
  const onlyHeads=[table('api_football_team_mapping_heads')];
  assert.deepEqual(optionalQueryKeysForObjects(onlyHeads),[]);
  const completeHead=[...onlyHeads,table('api_football_team_mapping_qualifications')];
  assert.deepEqual(optionalQueryKeysForObjects(completeHead),['qualifications','mappingHeads']);
  const completeMembers=[...completeHead,table('api_football_team_mapping_members')];
  assert.deepEqual(optionalQueryKeysForObjects(completeMembers),['qualifications','mappingHeads','mappingMembers']);
});

test('collector settings reveal only secret binding presence, never secret value',()=>{
  const summary=summarizeCollectorSettings({bindings:[
    {name:'TEAMSHEET_DATA_DB',type:'d1',database_id:'01e2b4f9-313a-4a14-8ce6-86c5aecc50d7'},
    {name:'EIA_2I5D_ACTIVATION',type:'plain_text',text:'REPOSITORY_ONLY_BLOCKED'},
    {name:'API_FOOTBALL_API_KEY',type:'secret_text',text:'must-never-leak'}
  ]});
  assert.equal(summary.d1BindingMatchesProduction,true);
  assert.equal(summary.activation,'REPOSITORY_ONLY_BLOCKED');
  assert.equal(summary.apiFootballSecretBindingPresent,true);
  assert.doesNotMatch(JSON.stringify(summary),/must-never-leak/);
});

test('production ledger stopping at 0003 is a hard stop before the approved 0005 sequence',()=>{
  const report=evaluate({ledger:[...baseLedger]});
  assert.equal(report.nextAction,'STOP_0004_NOT_APPLIED');
  assert.equal(report.migrations.migration0004.applied,false);
  assert.deepEqual(report.hardStops,[]);
});

test('exact migration 0004 plus its required identity tables admits only the 0005 storage gate',()=>{
  const report=evaluate({
    ledger:[...baseLedger,{version:4,name:'api_football_shadow_identity',appliedAt:'2026-09-16T00:00:00.000Z'}],
    objects:SCHEMA4_OBJECTS.map(object)
  });
  assert.equal(report.nextAction,'READY_FOR_MIGRATION_0005');
  assert.equal(report.migrations.schema0004Present,true);
  assert.deepEqual(report.hardStops,[]);
});

test('0005 remains disabled and can advance only to 0006 when its schema is complete',()=>{
  const report=evaluate({
    ledger:[
      ...baseLedger,
      {version:4,name:'api_football_shadow_identity',appliedAt:'2026-09-16T00:00:00.000Z'},
      {version:5,name:'api_football_shadow_runtime',appliedAt:'2026-09-16T00:00:00.000Z'}
    ],
    objects:[...SCHEMA4_OBJECTS,...SCHEMA5_OBJECTS].map(object),
    optionalRows:{runtime:[{
      provider:'api-football',collection_enabled:0,disable_reason:'EIA_2I5D_REPOSITORY_ONLY',
      credential_state:'UNPROVISIONED',quota_state:'UNOBSERVED',daily_attempt_count:0,
      updated_at:'2026-09-16T00:00:00.000Z'
    }]}
  });
  assert.equal(report.nextAction,'READY_FOR_MIGRATION_0006');
  assert.equal(report.apiFootballState.runtimeState.collectionEnabled,0);
  assert.equal(report.apiFootballState.runtimeState.disableReason,'EIA_2I5D_REPOSITORY_ONLY');
  assert.deepEqual(report.hardStops,[]);
});

test('out-of-order or active runtime state fails closed',()=>{
  const outOfOrder=evaluate({
    ledger:[...baseLedger,{version:5,name:'api_football_shadow_runtime',appliedAt:'2026-09-16T00:00:00.000Z'}]
  });
  assert.equal(outOfOrder.nextAction,'STOP_REVIEW_REQUIRED');
  assert.ok(outOfOrder.hardStops.includes('migration_0005_without_0004'));

  const active=evaluate({
    ledger:[
      ...baseLedger,
      {version:4,name:'api_football_shadow_identity',appliedAt:'2026-09-16T00:00:00.000Z'},
      {version:5,name:'api_football_shadow_runtime',appliedAt:'2026-09-16T00:00:00.000Z'}
    ],
    objects:[
      table('provider_fixture_identities'),table('provider_participation_revisions'),
      table('api_football_runtime_state'),table('api_football_request_attempts'),
      table('api_football_discovery_generations'),table('api_football_discovery_heads'),
      table('api_football_fixture_revisions'),table('api_football_generation_fixtures')
    ],
    optionalRows:{runtime:[{
      provider:'api-football',collection_enabled:1,disable_reason:'unexpected',
      credential_state:'AVAILABLE',quota_state:'KNOWN',daily_attempt_count:1,
      updated_at:'2026-09-19T00:00:00.000Z'
    }]}
  });
  assert.equal(active.nextAction,'STOP_REVIEW_REQUIRED');
  assert.ok(active.hardStops.includes('collection_not_disabled'));
  assert.ok(active.hardStops.includes('runtime_disable_reason_unexpected'));
});


test('missing or ahead-of-repository base migration ledger fails closed',()=>{
  const missing=evaluate({ledger:[
    baseLedger[0],baseLedger[2],
    {version:4,name:'api_football_shadow_identity',appliedAt:'2026-09-16T00:00:00.000Z'}
  ],objects:SCHEMA4_OBJECTS.map(object)});
  assert.equal(missing.nextAction,'STOP_REVIEW_REQUIRED');
  assert.ok(missing.hardStops.includes('migration_0002_missing'));
  assert.ok(missing.hardStops.includes('migration_ledger_non_contiguous'));

  const ahead=evaluate({ledger:[...baseLedger,{version:4,name:'api_football_shadow_identity',appliedAt:'2026-09-16T00:00:00.000Z'},{version:7,name:'unexpected_future',appliedAt:'2026-09-19T00:00:00.000Z'}],objects:SCHEMA4_OBJECTS.map(object)});
  assert.equal(ahead.nextAction,'STOP_REVIEW_REQUIRED');
  assert.ok(ahead.hardStops.includes('migration_ledger_ahead_of_repository'));
});

test('partial 0004 schema and stale Official FPL authority both fail closed',()=>{
  const ledger=[...baseLedger,{version:4,name:'api_football_shadow_identity',appliedAt:'2026-09-16T00:00:00.000Z'}];
  const partial=evaluate({ledger,objects:[object('provider_fixture_identities'),object('provider_participation_revisions')]});
  assert.equal(partial.nextAction,'STOP_REVIEW_REQUIRED');
  assert.ok(partial.hardStops.includes('migration_0004_schema_incomplete'));

  const stale=evaluate({ledger,objects:SCHEMA4_OBJECTS.map(object),nowIso:'2026-09-21T13:00:00.000Z'});
  assert.equal(stale.nextAction,'STOP_REVIEW_REQUIRED');
  assert.ok(stale.hardStops.includes('official_fpl_authority_stale'));
});

test('preflight source contains no provider request or live mutation surface',()=>{
  const source=fs.readFileSync(path.join(root,'workers/api-football-collector/live-storage-preflight.mjs'),'utf8');
  assert.doesNotMatch(source,/v3\.football\.api-sports\.io|x-apisports-key/);
  assert.doesNotMatch(source,/wrangler\s+(deploy|secret)|\/secrets(?:\/|['"])/i);
  assert.doesNotMatch(source,/method\s*:\s*['"](?:PUT|PATCH|DELETE)['"]/i);
  assert.match(source,/productionMutations:0/);
  assert.match(source,/apiFootballRequests:0/);
});


test('unexpected deployed collector or secret is a storage hard stop',()=>{
  const report=evaluate({
    ledger:[...baseLedger,{version:4,name:'api_football_shadow_identity',appliedAt:'2026-09-16T00:00:00.000Z'}],
    objects:SCHEMA4_OBJECTS.map(object),
    collector:{
      exists:true,deploymentCount:1,crons:[],d1BindingPresent:true,d1BindingMatchesProduction:true,
      activation:'REPOSITORY_ONLY_BLOCKED',apiFootballSecretBindingPresent:true
    }
  });
  assert.equal(report.nextAction,'STOP_REVIEW_REQUIRED');
  assert.ok(report.hardStops.includes('collector_worker_present'));
  assert.ok(report.hardStops.includes('collector_secret_present'));
});

test('workflow is manual-only, exact-main gated and uses only the existing read-only Cloudflare environment',()=>{
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/api-football-live-storage-preflight.yml'),'utf8');
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/github\.run_attempt == 1/);
  assert.match(workflow,/refs\/heads\/main/);
  assert.match(workflow,/name: data-steward-readonly/);
  assert.match(workflow,/DATA_STEWARD_CLOUDFLARE_READ_TOKEN/);
  assert.doesNotMatch(workflow,/secrets\.API_FOOTBALL_API_KEY/);
  assert.doesNotMatch(workflow,/wrangler\s+(?:deploy|secret)|schedule:|push:|pull_request:/i);
  assert.match(workflow,/actions\/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09/);
  assert.match(workflow,/actions\/setup-node@a0853c24544627f65ddf259abe73b1d18a591444/);
  assert.match(workflow,/actions\/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f/);
});
