import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessCron} from '../workers/data-platform/phase0/readonly-preflight.mjs';
import {
  EXPECTED_COMPATIBILITY_DATE,EXPECTED_SEASON,validatePostPhase1State,validateUploadedVersion
} from '../workers/data-platform/phase2/upload-version.mjs';
import {
  EXPECTED_ACTIVE_DEPLOYMENT_ID,EXPECTED_ACTIVE_VERSION_ID,EXPECTED_PHASE2_VERSION_ID,
  validateCloseoutDeployment
} from '../workers/data-platform/phase2/readonly-closeout.mjs';

const workflow=fs.readFileSync('.github/workflows/data-s2b-phase2-readonly-closeout.yml','utf8');
const helper=fs.readFileSync('workers/data-platform/phase2/readonly-closeout.mjs','utf8');
const databaseId='33333333-3333-4333-8333-333333333333';

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
const phase1State={
  migrations:[
    {version:1,name:'shadow_data_foundation',applied_at:'2026-08-22T00:00:00.000Z'},
    {version:2,name:'official_fpl_structured_history',applied_at:'2026-08-26T00:00:00.000Z'}
  ],
  sourceRows:[sourceRow],revisionRows:[revisionRow],
  counts:{data_sources:1,data_source_revisions:1,ingestion_runs:0,shadow_observations:0,observation_heads:0,canonical_entities:0},
  official:{ingestion_runs:0,shadow_observations:0,observation_heads:0}
};

function uploadedDetail(id=EXPECTED_PHASE2_VERSION_ID){
  return {id,resources:{
    script_runtime:{compatibility_date:EXPECTED_COMPATIBILITY_DATE},
    bindings:[
      {name:'TEAMSHEET_DATA_DB',type:'d1',database_id:databaseId},
      {name:'DATA_S1_HTTP_AUTH_TOKEN',type:'secret_text'},
      {name:'DATA_S2_SEASON',type:'plain_text',text:EXPECTED_SEASON}
    ]
  }};
}

test('closeout rejects a mismatched uploaded version identity',()=>{
  assert.equal(validateUploadedVersion(uploadedDetail(),{uploadedId:EXPECTED_PHASE2_VERSION_ID,databaseId}),true);
  assert.throws(
    ()=>validateUploadedVersion(uploadedDetail('wrong-version'),{uploadedId:EXPECTED_PHASE2_VERSION_ID,databaseId}),
    /phase2_version_detail_invalid/
  );
});

test('closeout fails closed if the uploaded Phase 2 version becomes active',()=>{
  const accidentallyActive={
    deploymentId:EXPECTED_ACTIVE_DEPLOYMENT_ID,
    versionId:EXPECTED_PHASE2_VERSION_ID,
    timestamp:'2026-08-27T00:00:00.000Z',
    rollback:'PASS'
  };
  assert.notEqual(EXPECTED_PHASE2_VERSION_ID,EXPECTED_ACTIVE_VERSION_ID);
  assert.throws(()=>validateCloseoutDeployment(accidentallyActive),/phase2_closeout_active_deployment_drift/);
});

test('closeout Cron validation fails closed on hourly or any other trigger drift',()=>{
  assert.deepEqual(assessCron([]),[]);
  assert.throws(()=>assessCron([{cron:'0 * * * *'}]),/unexpected_data_s2_hourly_cron/);
  assert.throws(()=>assessCron([{cron:'15 * * * *'}]),/unexpected_cron_drift/);
});

test('closeout Phase 1 D1 contract fails closed on collection or history drift',()=>{
  assert.equal(validatePostPhase1State(phase1State),true);
  assert.throws(
    ()=>validatePostPhase1State({...phase1State,counts:{...phase1State.counts,ingestion_runs:1}}),
    /post_table_count_drift/
  );
  assert.throws(
    ()=>validatePostPhase1State({...phase1State,official:{...phase1State.official,shadow_observations:1}}),
    /post_official_history_drift/
  );
});

test('read-only closeout executable contains no upload, deploy, promote, split, rollback, schedule or secret mutation path',()=>{
  const executable=`${workflow}\n${helper}`;
  assert.doesNotMatch(executable,/bindings_inherit=strict/i);
  assert.doesNotMatch(executable,/\bwrangler\s+(?:deploy|versions\s+deploy|triggers\s+deploy|secret)\b/i);
  assert.doesNotMatch(executable,/\b(?:promote|split\s+versions?|split\s+traffic|rollback)\b/i);
  assert.doesNotMatch(helper,/\/deployments[^\n]*method:\s*['"](?:POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(helper,/\/versions[^\n]*method:\s*['"](?:POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(helper,/\/schedules[^\n]*method:\s*['"](?:POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(helper,/\/secrets?[^\n]*method:\s*['"](?:POST|PUT|PATCH|DELETE)/i);
  assert.match(helper,/body:\{sql:validateReadOnlySql\(sql\)\}/);
});
