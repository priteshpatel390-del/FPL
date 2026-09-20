import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {
  MIGRATION_0005_ALREADY_APPLIED,MIGRATION_0005_AMBIGUOUS,MIGRATION_0005_APPLIED,MIGRATION_0005_BASE_OBJECTS,MIGRATION_0005_GIT_BLOB_SHA,
  MIGRATION_0005_NOT_APPLIED,MIGRATION_0005_REQUIRED_OBJECTS,MIGRATION_0005_RIGHTS_COLUMNS,
  MIGRATION_0005_STATE_EXACT_POST,MIGRATION_0005_STATE_EXACT_PRE,
  assertPinnedMigration0005Statements,classifyMigration0005State,expectedApiFootballRevision,expectedApiFootballSource,
  splitMigration0005Sql,validateMigration0005Post,validateMigration0005Pre
} from '../workers/data-platform/migration5/migration-0005-contract.mjs';
import {applyMigration0005} from '../workers/data-platform/migration5/apply-migration-0005.mjs';
import {
  MIGRATION_0005_ACCOUNT_ROWS_WRITTEN_ADMISSION_MAX,runMigration0005Preflight,summarizeAccountD1WriteUsage
} from '../workers/data-platform/migration5/preflight.mjs';
import {EXPECTED_D1_DATABASE_ID} from '../workers/data-platform/phase4b/live-contract.mjs';

const blobSha=content=>createHash('sha1').update(`blob ${Buffer.byteLength(content,'utf8')}\0`).update(content).digest('hex');
const sha256=value=>createHash('sha256').update(String(value)).digest('hex');
const priorLedger=[
  {version:1,name:'shadow_data_foundation',applied_at:'2026-08-22T00:00:00.000Z'},
  {version:2,name:'official_fpl_structured_history',applied_at:'2026-08-26T00:00:00.000Z'},
  {version:3,name:'production_query_plan_indexes',applied_at:'2026-09-02T00:00:00.000Z'},
  {version:4,name:'api_football_shadow_identity',applied_at:'2026-09-16T00:00:00.000Z'}
];
const postLedger=[...priorLedger,{version:5,name:'api_football_shadow_runtime',applied_at:'2026-09-16T00:00:00.000Z'}];
const objectRows=list=>list.map(row=>({type:row.type,name:row.name,tbl_name:row.table}));
const preParticipationColumns=['participation_revision_id','source_revision_id'].map((name,cid)=>({cid,name}));
const postParticipationColumns=[...preParticipationColumns,{cid:2,name:'ingestion_run_id'}];
const rightsColumns=MIGRATION_0005_RIGHTS_COLUMNS.map((name,cid)=>({cid,name}));
const preCounts=Object.freeze({
  data_sources:1,data_source_revisions:1,canonical_entities:1100,ingestion_runs:21,entity_mappings:0,
  shadow_observations:13742,observation_relations:0,observation_heads:10256,observation_rejections:0,
  accepted_logical_keys:10256,orphan_heads:0,invalid_heads:0,started_runs:0,completed_runs:21,other_runs:0,
  provider_fixture_identities:0,provider_participation_revisions:0,schema_migrations:4
});
const postCounts=Object.freeze({...preCounts,data_sources:2,data_source_revisions:2,schema_migrations:5});
const officialRun=[{run_id:'official-run-1',completed_at:'2026-09-20T01:18:00.000Z',status:'completed'}];
const officialTeams=Array.from({length:20},(_,index)=>({
  subject_entity_id:`2026-27:fpl:team:${index+1}`,observation_id:String(index+1).padStart(64,'a'),
  input_revision:`revision-${index+1}`,logical_key:`official-fpl|2026-27|team|${index+1}|present`
}));
const sourceRows=[expectedApiFootballSource()];
const revisionRows=[expectedApiFootballRevision()];
const runtimeRows=[{
  provider:'api-football',collection_enabled:0,disable_reason:'EIA_2I5D_REPOSITORY_ONLY',credential_state:'UNPROVISIONED',
  quota_state:'UNOBSERVED',quota_utc_day:null,daily_attempt_count:0,in_flight_attempt_id:null,in_flight_lease_expires_at:null,
  earliest_next_request_at:null,last_429_at:null,last_successful_request_at:null,updated_at:'2026-09-16T00:00:00.000Z'
}];
const zero={count:0};

function response(result,status=200){return {status,json:async()=>({success:true,result})};}
function resultRow(results,{read=1,written=0}={}){return {success:true,results,meta:{rows_read:read,rows_written:written,changes:written}};}
function basePayload({post=false,inconsistent=false}={}){
  const objects=post
    ?[...MIGRATION_0005_BASE_OBJECTS,...MIGRATION_0005_REQUIRED_OBJECTS].filter(row=>!inconsistent||row.name!=='api_football_participation_run_update')
    :MIGRATION_0005_BASE_OBJECTS;
  return [
    post?postLedger:priorLedger,objectRows(objects),[],rightsColumns,post?postParticipationColumns:preParticipationColumns,
    [post?postCounts:preCounts],officialRun,officialTeams,post?sourceRows:[],post?revisionRows:[],[zero],[zero],[zero]
  ].map(value=>resultRow(value));
}
function postPayload({inconsistent=false,activeRuntime=false}={}){
  const rows=basePayload({post:true,inconsistent});
  const runtime=activeRuntime?[{...runtimeRows[0],collection_enabled:1,disable_reason:null,credential_state:'AVAILABLE'}]:runtimeRows;
  return [...rows,resultRow(runtime),resultRow([zero]),resultRow([zero]),resultRow([zero]),resultRow([zero]),resultRow([zero])];
}
function fakeTransport({unknownMutation=false,unknownLeavesPre=false,inconsistent=false,alreadyApplied=false,activeRuntime=false}={}){
  let queryCalls=0,mutationCalls=0,bookmarkCalls=0,restoreCalls=0;
  const transport=async request=>{
    const url=String(request.url);
    if(url.endsWith('/time_travel/bookmark')){bookmarkCalls+=1;return response({bookmark:`bookmark-${bookmarkCalls}`});}
    if(url.includes('/time_travel/restore')){restoreCalls+=1;assert.fail('migration 0005 must not restore automatically');}
    if(url.endsWith('/query')){
      const batch=JSON.parse(request.body).batch;queryCalls+=1;
      if(batch.length===20){mutationCalls+=1;if(unknownMutation||unknownLeavesPre)throw new Error('simulated_mutation_transport_loss');return response(batch.map(()=>resultRow([],{written:1})));}
      if(batch.length===13){
        if(queryCalls===1)return response(basePayload({post:alreadyApplied}));
        if(unknownLeavesPre)return response(basePayload({post:false}));
        return response(basePayload({post:true,inconsistent}));
      }
      if(batch.length===19)return response(postPayload({inconsistent,activeRuntime}));
      assert.fail(`unexpected batch length ${batch.length}`);
    }
    assert.fail(`unexpected request ${url}`);
  };
  return {transport,stats:()=>({queryCalls,mutationCalls,bookmarkCalls,restoreCalls})};
}

test('migration 0005 bytes are pinned and trigger-aware parsing yields exactly 20 statements',()=>{
  const sql=fs.readFileSync('workers/data-platform/migrations/0005_api_football_shadow_runtime.sql','utf8');
  assert.equal(Buffer.byteLength(sql,'utf8'),9923);assert.equal(blobSha(sql),MIGRATION_0005_GIT_BLOB_SHA);
  const statements=assertPinnedMigration0005Statements(splitMigration0005Sql(sql));
  assert.equal(statements.length,20);assert.equal(statements.filter(row=>row.startsWith('CREATE TRIGGER')).length,7);
  assert.match(statements[17],/^ALTER TABLE provider_participation_revisions ADD COLUMN ingestion_run_id/);
});

test('state contract admits only exact 0004 pre-state and exact 0005 post-state',()=>{
  assert.equal(classifyMigration0005State({ledger:priorLedger,objects:objectRows(MIGRATION_0005_BASE_OBJECTS),participationColumns:preParticipationColumns}),MIGRATION_0005_STATE_EXACT_PRE);
  assert.equal(classifyMigration0005State({ledger:postLedger,objects:objectRows([...MIGRATION_0005_BASE_OBJECTS,...MIGRATION_0005_REQUIRED_OBJECTS]),participationColumns:postParticipationColumns}),MIGRATION_0005_STATE_EXACT_POST);
  assert.equal(classifyMigration0005State({ledger:postLedger,objects:objectRows([...MIGRATION_0005_BASE_OBJECTS,...MIGRATION_0005_REQUIRED_OBJECTS.slice(0,-1)]),participationColumns:postParticipationColumns}),'inconsistent');
  assert.equal(classifyMigration0005State({ledger:priorLedger,objects:[...objectRows(MIGRATION_0005_BASE_OBJECTS),{type:'table',name:'api_football_team_mapping_heads',tbl_name:'api_football_team_mapping_heads'}],participationColumns:preParticipationColumns}),'inconsistent');
  assert.equal(classifyMigration0005State({ledger:priorLedger,objects:[...objectRows(MIGRATION_0005_BASE_OBJECTS),{type:'table',name:'api_football_rogue_future_object',tbl_name:'api_football_rogue_future_object'}],participationColumns:preParticipationColumns}),'inconsistent');
});

test('pre/post validators require empty provider state and preserve every existing history population',()=>{
  validateMigration0005Pre({state:MIGRATION_0005_STATE_EXACT_PRE,counts:preCounts,foreignKeys:[],rightsColumns,sourceRows:[],revisionRows:[],mappingRows:zero,fixtureRows:zero,participationRows:zero});
  validateMigration0005Post({state:MIGRATION_0005_STATE_EXACT_POST,preCounts,postCounts,foreignKeys:[],rightsColumns,sourceRows,revisionRows,runtimeRows,emptyCounts:{attempts:zero,generations:zero,discovery_heads:zero,fixture_revisions:zero,generation_fixtures:zero,mapping_rows:zero,fixture_identities:zero,participation_revisions:zero}});
  assert.throws(()=>validateMigration0005Pre({state:MIGRATION_0005_STATE_EXACT_PRE,counts:{...preCounts,started_runs:1},foreignKeys:[],rightsColumns,sourceRows:[],revisionRows:[],mappingRows:zero,fixtureRows:zero,participationRows:zero}),/collection_in_progress/);
  assert.throws(()=>validateMigration0005Post({state:MIGRATION_0005_STATE_EXACT_POST,preCounts,postCounts:{...postCounts,shadow_observations:13741},foreignKeys:[],rightsColumns,sourceRows,revisionRows,runtimeRows,emptyCounts:{attempts:zero}}),/history_not_preserved/);
});

test('application succeeds only through exact post reconciliation and never restores automatically',async()=>{
  const fake=fakeTransport();
  const report=await applyMigration0005({accountId:'account-1',accountFingerprint:sha256('account-1'),databaseId:EXPECTED_D1_DATABASE_ID,token:'token',transport:fake.transport,clock:()=>new Date('2026-09-20T02:00:00Z')});
  assert.equal(report.ok,true);assert.equal(report.classification,MIGRATION_0005_APPLIED);assert.equal(report.mutationIssued,true);assert.equal(report.recoveryIssued,false);assert.equal(report.automaticRestorePermitted,false);
  assert.deepEqual(fake.stats(),{queryCalls:4,mutationCalls:1,bookmarkCalls:2,restoreCalls:0});
});

test('already-applied state is accepted only after disabled runtime and empty provider state are proven',async()=>{
  const fake=fakeTransport({alreadyApplied:true});
  const report=await applyMigration0005({accountId:'account-1',accountFingerprint:sha256('account-1'),databaseId:EXPECTED_D1_DATABASE_ID,token:'token',transport:fake.transport,clock:()=>new Date('2026-09-20T02:00:00Z')});
  assert.equal(report.ok,false);assert.equal(report.classification,MIGRATION_0005_ALREADY_APPLIED);assert.equal(report.mutationIssued,false);
  assert.deepEqual(fake.stats(),{queryCalls:2,mutationCalls:0,bookmarkCalls:0,restoreCalls:0});
  const active=fakeTransport({alreadyApplied:true,activeRuntime:true});
  await assert.rejects(()=>applyMigration0005({accountId:'account-1',accountFingerprint:sha256('account-1'),databaseId:EXPECTED_D1_DATABASE_ID,token:'token',transport:active.transport,clock:()=>new Date('2026-09-20T02:00:00Z')}),/runtime_post_invalid/);
});

test('lost mutation response reconciles exact post-state without retry',async()=>{
  const fake=fakeTransport({unknownMutation:true});
  const report=await applyMigration0005({accountId:'account-1',accountFingerprint:sha256('account-1'),databaseId:EXPECTED_D1_DATABASE_ID,token:'token',transport:fake.transport,clock:()=>new Date('2026-09-20T02:00:00Z')});
  assert.equal(report.classification,MIGRATION_0005_APPLIED);assert.match(report.note,/unknown_mutation_transport/);assert.equal(fake.stats().mutationCalls,1);assert.equal(fake.stats().restoreCalls,0);
});

test('lost mutation response with exact unchanged pre-state is definitely not applied',async()=>{
  const fake=fakeTransport({unknownLeavesPre:true});
  const report=await applyMigration0005({accountId:'account-1',accountFingerprint:sha256('account-1'),databaseId:EXPECTED_D1_DATABASE_ID,token:'token',transport:fake.transport,clock:()=>new Date('2026-09-20T02:00:00Z')});
  assert.equal(report.ok,false);assert.equal(report.classification,MIGRATION_0005_NOT_APPLIED);assert.equal(report.recoveryIssued,false);assert.deepEqual(fake.stats(),{queryCalls:3,mutationCalls:1,bookmarkCalls:1,restoreCalls:0});
});

test('inconsistent post-state is owner attention and automatic destructive restore is unreachable',async()=>{
  const fake=fakeTransport({inconsistent:true});
  const report=await applyMigration0005({accountId:'account-1',accountFingerprint:sha256('account-1'),databaseId:EXPECTED_D1_DATABASE_ID,token:'token',transport:fake.transport,clock:()=>new Date('2026-09-20T02:00:00Z')});
  assert.equal(report.classification,MIGRATION_0005_AMBIGUOUS);assert.equal(report.recoveryIssued,false);assert.equal(fake.stats().restoreCalls,0);
});

test('account-wide D1 write usage is summed for the current UTC day and malformed analytics fail closed',()=>{
  const payload={data:{viewer:{accounts:[{d1AnalyticsAdaptiveGroups:[{sum:{rowsWritten:1200},dimensions:{date:'2026-09-20',databaseId:'a'}},{sum:{rowsWritten:300},dimensions:{date:'2026-09-20',databaseId:'b'}}]}]}}};
  assert.deepEqual(summarizeAccountD1WriteUsage(payload,{utcDate:'2026-09-20'}),{ok:true,utcDate:'2026-09-20',rowsWritten:1500});
  assert.equal(summarizeAccountD1WriteUsage({errors:[{message:'denied'}]},{utcDate:'2026-09-20'}).ok,false);
});

test('migration preflight requires READY_FOR_MIGRATION_0005, zero legacy Cron and conservative daily write headroom',async()=>{
  const env={MIGRATION_0005_PREFLIGHT_MODE:'pre',DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID:'account-1',DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT:sha256('account-1'),DATA_STEWARD_CLOUDFLARE_READ_TOKEN:'read-token'};
  const livePreflightImpl=async()=>({ok:true,observedAt:'2026-09-20T02:00:00Z',hardStops:[],nextAction:'READY_FOR_MIGRATION_0005',migrations:{ledger:priorLedger},foreignKeyViolations:0,officialFplAuthority:{valid:true,fresh:true,teamCount:20,completedAt:'2026-09-20T01:18:00Z'},apiFootballState:{mappingRowCount:0,runtimeState:{present:false},requestAttemptCount:0,fixtureRevisionCount:0,mappingQualifications:{total:0}},collector:{exists:false,deploymentCount:0,crons:[],apiFootballSecretBindingPresent:false},evidence:{cloudflareGets:5,d1QueryCalls:1,d1RowsRead:100}});
  const fetchImpl=async()=>response({schedules:[]});
  const pass=await runMigration0005Preflight({env,livePreflightImpl,fetchImpl,usageImpl:async()=>({ok:true,utcDate:'2026-09-20',rowsWritten:MIGRATION_0005_ACCOUNT_ROWS_WRITTEN_ADMISSION_MAX})});
  assert.equal(pass.ok,true);assert.equal(pass.writeBudget.reservedHeadroom,50000);
  const blocked=await runMigration0005Preflight({env,livePreflightImpl,fetchImpl,usageImpl:async()=>({ok:true,utcDate:'2026-09-20',rowsWritten:MIGRATION_0005_ACCOUNT_ROWS_WRITTEN_ADMISSION_MAX+1})});
  assert.equal(blocked.reason,'d1_daily_write_headroom_insufficient');
  const cron=await runMigration0005Preflight({env,livePreflightImpl,fetchImpl:async()=>response({schedules:[{cron:'*/30 * * * *'}]}),usageImpl:async()=>({ok:true,utcDate:'2026-09-20',rowsWritten:0})});
  assert.equal(cron.reason,'legacy_data_platform_cron_present');
});

test('workflow is manual, exact-main, serialized, migration-0005-only and credential-isolated',()=>{
  const workflow=fs.readFileSync('.github/workflows/api-football-migration-0005.yml','utf8');
  assert.match(workflow,/workflow_dispatch:/);assert.doesNotMatch(workflow,/\n\s+schedule:/);assert.match(workflow,/github\.run_attempt == 1/);
  assert.match(workflow,/group: data-s2-production-collection/);assert.match(workflow,/cancel-in-progress: false/);assert.match(workflow,/Require exact-head Verify Teamsheet success/);
  assert.match(workflow,/MIGRATION_0005_PREFLIGHT_MODE: pre/);assert.match(workflow,/node workers\/data-platform\/run-migration-0005\.mjs/);assert.match(workflow,/MIGRATION_0005_PREFLIGHT_MODE: post/);
  assert.doesNotMatch(workflow,/API_FOOTBALL_API_KEY|v3\.football\.api-sports\.io|migration_0006|team_mapping_qualification/);
  assert.doesNotMatch(workflow,/migration_path:|table_name:|migration_version:/);assert.doesNotMatch(workflow,/time_travel\/restore/);
  assert.match(workflow,/actions\/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09/);assert.match(workflow,/actions\/setup-node@a0853c24544627f65ddf259abe73b1d18a591444/);assert.match(workflow,/actions\/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f/);
  const jobLevelRunnerContext=/^ {0,6}\S[^\n]*\$\{\{\s*runner\./m;assert.doesNotMatch(workflow,jobLevelRunnerContext);
});
