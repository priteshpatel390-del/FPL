import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  EXPECTED_ACTIVE_VERSION_ID,EXPECTED_COMPATIBILITY_DATE,EXPECTED_D1_SIZE_BYTES,
  EXPECTED_PRODUCTION_HOSTNAME,EXPECTED_ROLLBACK_VERSION_ID,EXPECTED_SEASON,WORKER_NAME,
  assertReadOnlyApiRequest,buildSanitizedSummary,extractVersions,validateActiveVersion,
  validateCron,validateD1State,validateDatabase,validateDeployment,validateDomains,validateHealth,validateVersions
} from '../workers/data-platform/phase4b/preflight.mjs';

const helper=fs.readFileSync('workers/data-platform/phase4b/preflight.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/data-s2b-phase4b-readonly-preflight.yml','utf8');
const workerBase='/accounts/account-id/workers/scripts/teamsheet-data-platform';
const d1Base='/accounts/account-id/d1/database/database-id';
const activeBindingRows=[
  {name:'TEAMSHEET_DATA_DB',type:'d1',database_id:'database-id'},
  {name:'DATA_S1_HTTP_AUTH_TOKEN',type:'secret_text'},
  {name:'DATA_S2_SEASON',type:'plain_text',text:'2026-27'}
];
const activeDetail={id:EXPECTED_ACTIVE_VERSION_ID,resources:{script_runtime:{compatibility_date:'2026-08-22'},bindings:activeBindingRows}};
const deploymentResult={deployments:[
  {id:'current-deployment',versions:[{version_id:EXPECTED_ACTIVE_VERSION_ID,percentage:100}]},
  {id:'prior-deployment',versions:[{version_id:EXPECTED_ROLLBACK_VERSION_ID,percentage:100}]}
]};
const versionsResult={items:[{id:EXPECTED_ACTIVE_VERSION_ID},{id:EXPECTED_ROLLBACK_VERSION_ID}]};
const postState={
  migrations:[{version:1,name:'shadow_data_foundation'},{version:2,name:'official_fpl_structured_history'}],
  sourceRows:[{source_id:'source-official-fpl',source_key:'official-fpl',source_name:'Official FPL API',source_kind:'official_fpl',created_at:'2026-08-26T00:00:00.000Z'}],
  revisionRows:[{source_revision_id:'official-fpl-r1',source_id:'source-official-fpl',revision:1,schema_version:'data-s2a-v1',rights_classification:'durable_allowed',retention_allowed:1,redistribution_allowed:0,attribution_required:0,attribution_text:null,terms_reference:'docs/DATA_SOURCES.md',terms_reviewed_at:'2026-08-26T00:00:00.000Z',acquisition_status:'approved_internal_shadow_history',shadow_ingest_allowed:1,supersedes_revision_id:null,created_at:'2026-08-26T00:00:00.000Z'}],
  counts:{data_sources:1,data_source_revisions:1,ingestion_runs:0,shadow_observations:0,observation_heads:0,canonical_entities:0},
  official:{ingestion_runs:0,shadow_observations:0,observation_heads:0}
};

test('Phase 4B preflight constants pin the accepted production contract',()=>{
  assert.equal(WORKER_NAME,'teamsheet-data-platform');
  assert.equal(EXPECTED_PRODUCTION_HOSTNAME,'data.fpltsheet.co.uk');
  assert.equal(EXPECTED_ACTIVE_VERSION_ID,'3a2b065a-6527-4887-9bf8-b08e82e81133');
  assert.equal(EXPECTED_ROLLBACK_VERSION_ID,'5edbe951-4be4-46bc-b2cf-17b550396105');
  assert.equal(EXPECTED_COMPATIBILITY_DATE,'2026-08-22');
  assert.equal(EXPECTED_SEASON,'2026-27');
  assert.equal(EXPECTED_D1_SIZE_BYTES,151552);
});

test('active Deployment is exactly the expected sole Version at 100 percent',()=>{
  assert.deepEqual(validateDeployment(deploymentResult),{deploymentId:'current-deployment',versionId:EXPECTED_ACTIVE_VERSION_ID});
  assert.throws(()=>validateDeployment({deployments:[{id:'current',versions:[{version_id:EXPECTED_ACTIVE_VERSION_ID,percentage:50},{version_id:'other',percentage:50}]},{id:'prior',versions:[{version_id:EXPECTED_ROLLBACK_VERSION_ID,percentage:100}]}]}),/active_deployment_invalid/);
  assert.throws(()=>validateDeployment({deployments:[{id:'current',versions:[{version_id:'other',percentage:100}]},{id:'prior',versions:[{version_id:EXPECTED_ROLLBACK_VERSION_ID,percentage:100}]}]}),/active_version_drift/);
});

test('deployable Version list requires active latest and retained rollback present',()=>{
  assert.deepEqual(validateVersions(extractVersions(versionsResult)),[EXPECTED_ACTIVE_VERSION_ID,EXPECTED_ROLLBACK_VERSION_ID]);
  assert.throws(()=>validateVersions([EXPECTED_ACTIVE_VERSION_ID]),/rollback_version_missing/);
  assert.throws(()=>validateVersions([EXPECTED_ROLLBACK_VERSION_ID,EXPECTED_ACTIVE_VERSION_ID]),/latest_active_drift/);
});

test('active Version Detail requires exact compatibility and binding set',()=>{
  assert.deepEqual(validateActiveVersion(activeDetail).bindings,[{name:'TEAMSHEET_DATA_DB',type:'d1'},{name:'DATA_S1_HTTP_AUTH_TOKEN',type:'secret_text'},{name:'DATA_S2_SEASON',type:'plain_text'}]);
  assert.throws(()=>validateActiveVersion({...activeDetail,resources:{...activeDetail.resources,script_runtime:{compatibility_date:'2026-08-23'}}}),/compatibility_drift/);
  assert.throws(()=>validateActiveVersion({...activeDetail,resources:{...activeDetail.resources,bindings:activeBindingRows.slice(0,2)}}),/binding_set_drift/);
});

test('season is exact and retained secret value can never be exposed',()=>{
  const seasonDrift=activeBindingRows.map(row=>row.name==='DATA_S2_SEASON'?{...row,text:'2025-26'}:row);
  assert.throws(()=>validateActiveVersion({...activeDetail,resources:{...activeDetail.resources,bindings:seasonDrift}}),/season_drift/);
  const exposed=activeBindingRows.map(row=>row.name==='DATA_S1_HTTP_AUTH_TOKEN'?{...row,text:'secret-value'}:row);
  assert.throws(()=>validateActiveVersion({...activeDetail,resources:{...activeDetail.resources,bindings:exposed}}),/secret_exposed/);
});

test('Custom Domain and D1 size are exact',()=>{
  assert.deepEqual(validateDomains([{service:WORKER_NAME,hostname:EXPECTED_PRODUCTION_HOSTNAME}]),[EXPECTED_PRODUCTION_HOSTNAME]);
  assert.throws(()=>validateDomains([{service:WORKER_NAME,hostname:'other.example'}]),/domain_drift/);
  assert.equal(validateDatabase({uuid:'database-id',name:'teamsheet-data',file_size:151552},'database-id').file_size,151552);
  assert.throws(()=>validateDatabase({uuid:'database-id',name:'teamsheet-data',file_size:151553},'database-id'),/d1_size_drift/);
});

test('live Cron must be exactly empty',()=>{
  assert.deepEqual(validateCron({schedules:[]}),[]);
  assert.throws(()=>validateCron({schedules:[{cron:'*/30 * * * *'}]}),/unexpected_cron_drift/);
});

test('D1 migration, governance and zero-history state are exact',()=>{
  assert.equal(validateD1State(postState),true);
  assert.throws(()=>validateD1State({...postState,counts:{...postState.counts,ingestion_runs:1}}),/post_table_count_drift/);
});

test('authenticated health requires exact HTTP 200 ok true shadow_only contract',()=>{
  assert.equal(validateHealth(200,{ok:true,mode:'shadow_only'}),true);
  for(const [status,body] of [[401,{ok:true,mode:'shadow_only'}],[200,{ok:false,mode:'shadow_only'}],[200,{ok:true,mode:'write'}]])assert.throws(()=>validateHealth(status,body),/health_failed/);
});

test('API guard permits only the exact required GET surfaces',()=>{
  const allowed=[`${workerBase}/deployments`,`${workerBase}/versions?deployable=true`,`${workerBase}/versions/${EXPECTED_ACTIVE_VERSION_ID}`,`${workerBase}/schedules`,'/accounts/account-id/workers/domains',`${d1Base}?fields=uuid,name,file_size`];
  for(const path of allowed)assert.deepEqual(assertReadOnlyApiRequest({method:'GET',path,workerBase,d1Base}),{method:'GET'});
});

test('D1 query POST is the sole POST and validates SQL before transport',()=>{
  assert.deepEqual(assertReadOnlyApiRequest({method:'POST',path:`${d1Base}/query`,workerBase,d1Base,sql:'SELECT 1'}),{method:'POST',body:{sql:'SELECT 1'}});
  assert.throws(()=>assertReadOnlyApiRequest({method:'POST',path:'/query',workerBase,d1Base:'',sql:'SELECT 1'}),/endpoint_forbidden/);
  for(const sql of ['INSERT INTO x VALUES (1)','UPDATE x SET y=1','DELETE FROM x','PRAGMA table_info(x)'])assert.throws(()=>assertReadOnlyApiRequest({method:'POST',path:`${d1Base}/query`,workerBase,d1Base,sql}),/sql_must_start_select|sql_unsafe_verb/);
});

test('API guard rejects every Worker and control-plane mutation class',()=>{
  const forbidden=[`${workerBase}/versions`,`${workerBase}/deployments`,`${workerBase}/schedules`,workerBase,`${workerBase}/secrets`,'/accounts/account-id/workers/domains','/accounts/account-id/access/apps',`${d1Base}/time_travel/restore`];
  for(const path of forbidden)assert.throws(()=>assertReadOnlyApiRequest({method:'POST',path,workerBase,d1Base,sql:'SELECT 1'}),/endpoint_forbidden/);
  assert.throws(()=>assertReadOnlyApiRequest({method:'PUT',path:`${workerBase}/schedules`,workerBase,d1Base}),/endpoint_forbidden/);
});

test('sanitized summary reports exact zero mutation accounting without sensitive identifiers',()=>{
  const summary=buildSanitizedSummary({approvedSha:'a'.repeat(40),deploymentId:'deployment-id',counts:postState.counts,d1Size:151552});
  for(const line of ['Worker Version uploads: 0','Deployments: 0','Cron mutations: 0','D1 writes/migrations: 0','Route/domain mutations: 0','Access mutations: 0','Secret mutations: 0','Collector executions: 0'])assert.match(summary,new RegExp(line));
  for(const sensitive of ['account-id','database-id','secret-value','CF_ACCESS_CLIENT_SECRET','CLOUDFLARE_API_TOKEN'])assert.equal(summary.includes(sensitive),false);
});

test('helper is structurally standalone read-only with no collector or Official acquisition path',()=>{
  assert.doesNotMatch(helper,/upload-version\.mjs|deploy-version\.mjs|official-fpl-history\.mjs/);
  assert.doesNotMatch(helper,/bootstrap-static|fixtures|scheduled\s*\(|collectOfficial|wrangler\s+(?:deploy|triggers)/);
  assert.doesNotMatch(helper,/bindings_inherit|multipart|FormData|\/time_travel\//);
});

test('workflow is manual exact-main exact-CI gated before protected credentials',()=>{
  for(const expected of [/workflow_dispatch:/,/approved_sha:/,/refs\/heads\/main/,/priteshpatel390-del\/FPL/,/\^\[0-9a-f\]\{40\}\$/,/git ls-remote/,/git status --porcelain/,/Tests and deterministic build/,/environment:\s*\n\s+name: data-s2b-phase0-readonly/,/node-version: 24\.19\.0/])assert.match(workflow,expected);
  assert.ok(workflow.indexOf('repository-gate:')<workflow.indexOf('CLOUDFLARE_API_TOKEN'));
});

test('workflow invokes only the standalone preflight and no mutation or collector helper',()=>{
  assert.match(workflow,/node workers\/data-platform\/phase4b\/preflight\.mjs/);
  assert.doesNotMatch(workflow,/upload-version\.mjs|deploy-version\.mjs|readonly-closeout\.mjs|wrangler\s+(?:deploy|triggers)|official-fpl-history|bootstrap-static|fixtures/);
  assert.doesNotMatch(workflow,/CLOUDFLARE_WORKER_UPLOAD_TOKEN|CLOUDFLARE_PHASE3_DEPLOY_TOKEN|CLOUDFLARE_D1_WRITE_TOKEN/);
});
