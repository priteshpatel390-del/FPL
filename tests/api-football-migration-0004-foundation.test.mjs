import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {
  MIGRATION_0004_APPLIED,MIGRATION_0004_BASE_OBJECTS,MIGRATION_0004_GIT_BLOB_SHA,
  MIGRATION_0004_RECOVERED,MIGRATION_0004_REQUIRED_OBJECTS,MIGRATION_0004_RIGHTS_COLUMNS,
  MIGRATION_0004_STATE_EXACT_POST,MIGRATION_0004_STATE_EXACT_PRE,
  assertSameOfficialFplAuthority,classifyMigration0004State,officialFplAuthoritySnapshot,
  splitMigration0004Sql,validateMigration0004Post,validateMigration0004Pre
} from '../workers/data-platform/migration4/migration-0004-contract.mjs';
import {applyMigration0004} from '../workers/data-platform/migration4/apply-migration-0004.mjs';
import {runMigration0004Preflight} from '../workers/data-platform/migration4/preflight.mjs';
import {EXPECTED_D1_DATABASE_ID} from '../workers/data-platform/phase4b/live-contract.mjs';

const blobSha=content=>createHash('sha1').update(`blob ${Buffer.byteLength(content,'utf8')}\0`).update(content).digest('hex');
const sha256=value=>createHash('sha256').update(String(value)).digest('hex');

const priorLedger=[
  {version:1,name:'shadow_data_foundation',applied_at:'2026-08-22T00:00:00.000Z'},
  {version:2,name:'official_fpl_structured_history',applied_at:'2026-08-26T00:00:00.000Z'},
  {version:3,name:'production_query_plan_indexes',applied_at:'2026-09-02T00:00:00.000Z'}
];
const postLedger=[...priorLedger,{version:4,name:'api_football_shadow_identity',applied_at:'2026-09-16T00:00:00.000Z'}];
const objectRows=list=>list.map(row=>({type:row.type,name:row.name,tbl_name:row.table}));
const baseColumns=['source_revision_id','source_id','revision','schema_version','rights_classification'].map((name,cid)=>({cid,name}));
const postColumns=[...baseColumns,...MIGRATION_0004_RIGHTS_COLUMNS.map((name,index)=>({cid:index+baseColumns.length,name}))];

const preCounts=Object.freeze({
  data_sources:1,data_source_revisions:1,canonical_entities:40,ingestion_runs:8,entity_mappings:0,
  shadow_observations:400,observation_relations:4,observation_heads:200,observation_rejections:2,
  accepted_logical_keys:200,orphan_heads:0,invalid_heads:0,started_runs:0,completed_runs:8,other_runs:0,
  schema_migrations:3
});
const postCounts=Object.freeze({...preCounts,schema_migrations:4});
const officialRun=[{run_id:'official-run-1',completed_at:'2026-09-19T01:18:00.000Z',status:'completed'}];
const officialTeams=Array.from({length:20},(_,index)=>({
  subject_entity_id:`2026-27:fpl:team:${index+1}`,
  observation_id:String(index+1).padStart(64,'a'),
  input_revision:`revision-${index+1}`,
  logical_key:`official-fpl|2026-27|team|${index+1}|present`
}));

function response(result,status=200){
  return {status,json:async()=>({success:true,result})};
}
function resultRow(results,{read=1,written=0}={}){
  return {success:true,results,meta:{rows_read:read,rows_written:written,changes:written}};
}
function reconciliationPayload({post=false,inconsistent=false}={}){
  const ledger=post?postLedger:priorLedger;
  const objects=post
    ?objectRows(inconsistent?MIGRATION_0004_REQUIRED_OBJECTS.filter(row=>row.name!=='owner_risk_source_revision_update'):MIGRATION_0004_REQUIRED_OBJECTS)
    :objectRows(MIGRATION_0004_BASE_OBJECTS);
  const columns=post?postColumns:baseColumns;
  const counts=post?postCounts:preCounts;
  const rows=[
    ledger,objects,[],[counts],columns,officialRun,officialTeams,[{count:0}]
  ];
  if(post)rows.push([{count:0}],[{count:0}]);
  return rows.map(value=>resultRow(value));
}

function fakeMigrationTransport({recover=false}={}){
  let queryCalls=0,bookmarkCalls=0,restoreCalls=0;
  const transport=async request=>{
    const url=String(request.url);
    if(url.endsWith('/time_travel/bookmark')){
      bookmarkCalls+=1;
      return response({bookmark:bookmarkCalls===1?'bookmark-before':'bookmark-after'});
    }
    if(url.includes('/time_travel/restore?bookmark=')){
      restoreCalls+=1;
      return response({bookmark:'bookmark-restored',previous_bookmark:'bookmark-after'});
    }
    if(url.endsWith('/query')){
      const body=JSON.parse(request.body),batch=body.batch;
      assert.ok(Array.isArray(batch));
      queryCalls+=1;
      if(batch.length===40)return response(batch.map(()=>resultRow([],{read:0,written:1})));
      if(batch.length===10)return response(reconciliationPayload({post:true,inconsistent:recover}));
      if(batch.length===8){
        if(recover&&queryCalls>=4)return response(reconciliationPayload({post:false}));
        return response(reconciliationPayload({post:false}));
      }
      assert.fail(`unexpected batch length ${batch.length}`);
    }
    assert.fail(`unexpected request ${url}`);
  };
  return {transport,stats:()=>({queryCalls,bookmarkCalls,restoreCalls})};
}

test('migration 0004 bytes are pinned and split into the reviewed 40 statements',()=>{
  const sql=fs.readFileSync('workers/data-platform/migrations/0004_api_football_shadow_identity.sql','utf8');
  assert.equal(blobSha(sql),MIGRATION_0004_GIT_BLOB_SHA);
  const statements=splitMigration0004Sql(sql);
  assert.equal(statements.length,40);
  assert.equal(statements[0],'PRAGMA defer_foreign_keys = ON');
  assert.match(statements[35],/^CREATE TRIGGER owner_risk_source_revision_insert/);
  assert.match(statements[35],/BEGIN SELECT RAISE\(ABORT, 'owner_risk_source_mismatch'\); END$/);
  assert.match(statements[36],/^CREATE TRIGGER owner_risk_source_revision_update/);
  assert.equal(statements.at(-1),'CREATE INDEX provider_participation_history ON provider_participation_revisions(provider_fixture_identity, provider_player_id, fetched_at)');
});

test('state classifier admits only exact 0001-0003 pre-state or exact 0004 post-state',()=>{
  assert.equal(classifyMigration0004State({
    ledger:priorLedger,objects:objectRows(MIGRATION_0004_BASE_OBJECTS),dataSourceRevisionColumns:baseColumns
  }),MIGRATION_0004_STATE_EXACT_PRE);
  assert.equal(classifyMigration0004State({
    ledger:postLedger,objects:objectRows(MIGRATION_0004_REQUIRED_OBJECTS),dataSourceRevisionColumns:postColumns
  }),MIGRATION_0004_STATE_EXACT_POST);
  assert.equal(classifyMigration0004State({
    ledger:postLedger,objects:objectRows(MIGRATION_0004_REQUIRED_OBJECTS.slice(0,-1)),dataSourceRevisionColumns:postColumns
  }),'inconsistent');
  assert.equal(classifyMigration0004State({
    ledger:priorLedger,objects:[],dataSourceRevisionColumns:baseColumns
  }),'inconsistent');
});

test('pre/post validators preserve the rebuilt graph and reject active collection or count drift',()=>{
  validateMigration0004Pre({state:MIGRATION_0004_STATE_EXACT_PRE,counts:preCounts,foreignKeys:[],providerRows:{count:0}});
  validateMigration0004Post({
    state:MIGRATION_0004_STATE_EXACT_POST,preCounts,postCounts,foreignKeys:[],providerRows:{count:0},
    fixtureRows:{count:0},participationRows:{count:0}
  });
  assert.throws(()=>validateMigration0004Pre({
    state:MIGRATION_0004_STATE_EXACT_PRE,counts:{...preCounts,started_runs:1},foreignKeys:[],providerRows:{count:0}
  }),/collection_in_progress/);
  assert.throws(()=>validateMigration0004Post({
    state:MIGRATION_0004_STATE_EXACT_POST,preCounts,postCounts:{...postCounts,shadow_observations:399},
    foreignKeys:[],providerRows:{count:0},fixtureRows:{count:0},participationRows:{count:0}
  }),/history_not_preserved/);
});

test('Official FPL authority requires the exact 20 canonical present heads and remains byte-stable',()=>{
  const before=officialFplAuthoritySnapshot(officialRun,officialTeams,'2026-09-19T02:00:00.000Z');
  const after=officialFplAuthoritySnapshot(officialRun,[...officialTeams].reverse(),'2026-09-19T02:00:00.000Z');
  assert.equal(assertSameOfficialFplAuthority(before,after),true);
  assert.throws(()=>officialFplAuthoritySnapshot(officialRun,officialTeams.map((row,index)=>
    index===0?{...row,logical_key:'official-fpl|2026-27|team|01|present'}:row
  ),'2026-09-19T02:00:00.000Z'),/official_authority_invalid/);
});

test('application succeeds only after exact post-state reconciliation and captures Time Travel digests',async()=>{
  const fake=fakeMigrationTransport();
  const report=await applyMigration0004({
    accountId:'account-1',accountFingerprint:sha256('account-1'),databaseId:EXPECTED_D1_DATABASE_ID,
    token:'token',transport:fake.transport,clock:()=>new Date('2026-09-19T02:00:00.000Z')
  });
  assert.equal(report.ok,true);
  assert.equal(report.classification,MIGRATION_0004_APPLIED);
  assert.equal(report.mutationIssued,true);
  assert.equal(report.recoveryIssued,false);
  assert.match(report.recovery.preBookmarkDigest,/^[0-9a-f]{64}$/);
  assert.match(report.recovery.postBookmarkDigest,/^[0-9a-f]{64}$/);
  assert.deepEqual(fake.stats(),{queryCalls:3,bookmarkCalls:2,restoreCalls:0});
});

test('invalid applied post-state triggers one Time Travel restore and proves exact pre-state',async()=>{
  const fake=fakeMigrationTransport({recover:true});
  const report=await applyMigration0004({
    accountId:'account-1',accountFingerprint:sha256('account-1'),databaseId:EXPECTED_D1_DATABASE_ID,
    token:'token',transport:fake.transport,clock:()=>new Date('2026-09-19T02:00:00.000Z')
  });
  assert.equal(report.ok,false);
  assert.equal(report.classification,MIGRATION_0004_RECOVERED);
  assert.equal(report.mutationIssued,true);
  assert.equal(report.recoveryIssued,true);
  assert.equal(report.state.after,MIGRATION_0004_STATE_EXACT_PRE);
  assert.deepEqual(fake.stats(),{queryCalls:4,bookmarkCalls:1,restoreCalls:1});
});

test('migration-specific read-only preflight blocks a restored legacy data-platform Cron',async()=>{
  const env={
    MIGRATION_0004_PREFLIGHT_MODE:'pre',
    DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID:'account-1',
    DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT:sha256('account-1'),
    DATA_STEWARD_CLOUDFLARE_READ_TOKEN:'read-token'
  };
  const livePreflightImpl=async()=>({
    ok:true,observedAt:'2026-09-19T02:00:00.000Z',hardStops:[],nextAction:'STOP_0004_NOT_APPLIED',
    migrations:{ledger:priorLedger},foreignKeyViolations:0,
    officialFplAuthority:{valid:true,fresh:true,teamCount:20,completedAt:'2026-09-19T01:18:00.000Z'},
    apiFootballState:{mappingRowCount:0,runtimeState:{present:false},requestAttemptCount:0,fixtureRevisionCount:0,mappingQualifications:{total:0}},
    collector:{exists:false,deploymentCount:0,crons:[],apiFootballSecretBindingPresent:false},
    evidence:{cloudflareGets:5,d1QueryCalls:1,d1RowsRead:100}
  });
  const noCron=await runMigration0004Preflight({
    env,livePreflightImpl,fetchImpl:async()=>response({schedules:[]})
  });
  assert.equal(noCron.ok,true);
  const cronPresent=await runMigration0004Preflight({
    env,livePreflightImpl,fetchImpl:async()=>response({schedules:[{cron:'*/30 * * * *'}]})
  });
  assert.equal(cronPresent.ok,false);
  assert.equal(cronPresent.reason,'legacy_data_platform_cron_present');
});

test('workflow is manual-only, exact-main gated, one-shot, serialized and has no arbitrary SQL input',()=>{
  const workflow=fs.readFileSync('.github/workflows/api-football-migration-0004.yml','utf8');
  assert.match(workflow,/workflow_dispatch:/);
  assert.doesNotMatch(workflow,/\n\s+schedule:/);
  assert.match(workflow,/github\.run_attempt == 1/);
  assert.match(workflow,/group: data-s2-production-collection/);
  assert.match(workflow,/approved_sha:/);
  assert.doesNotMatch(workflow,/migration_path:|sql:.*description:|table_name:|migration_version:/);
  assert.match(workflow,/Require exact-head Verify Teamsheet success/);
  assert.match(workflow,/MIGRATION_0004_PREFLIGHT_MODE: pre/);
  assert.match(workflow,/node workers\/data-platform\/run-migration-0004\.mjs/);
  assert.match(workflow,/MIGRATION_0004_PREFLIGHT_MODE: post/);
  assert.match(workflow,/actions\/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09/);
  assert.match(workflow,/actions\/setup-node@a0853c24544627f65ddf259abe73b1d18a591444/);
  assert.match(workflow,/actions\/upload-artifact@b7c566a772e6b6bfb58ed0dc250532a479d7789f/);
});
