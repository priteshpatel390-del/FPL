import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  EXPECTED_ACTIVE_DEPLOYMENT_ID,EXPECTED_ACTIVE_VERSION_ID,EXPECTED_COMPATIBILITY_DATE,EXPECTED_CRON,EXPECTED_D1_DATABASE_ID,
  EXPECTED_PRODUCTION_HOSTNAME,EXPECTED_ROLLBACK_VERSION_ID,EXPECTED_SEASON,WORKER_NAME,
  assertReadOnlyApiRequest,buildSanitizedSummary,extractVersions,validateActiveVersion,
  validateCron,validateD1State,validateDatabase,validateDeployment,validateDomains,validateHealth,validateVersions
} from '../workers/data-platform/phase4b/preflight.mjs';

const helper=fs.readFileSync('workers/data-platform/phase4b/preflight.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/data-s2b-phase4b-readonly-preflight.yml','utf8');
const workerBase='/accounts/account-id/workers/scripts/teamsheet-data-platform';
const d1Base=`/accounts/account-id/d1/database/${EXPECTED_D1_DATABASE_ID}`;
const activeBindingRows=[
  {name:'TEAMSHEET_DATA_DB',type:'d1',database_id:EXPECTED_D1_DATABASE_ID},
  {name:'DATA_S1_HTTP_AUTH_TOKEN',type:'secret_text'},
  {name:'DATA_S2_SEASON',type:'plain_text',text:'2026-27'}
];
const activeDetail={id:EXPECTED_ACTIVE_VERSION_ID,resources:{script_runtime:{compatibility_date:'2026-08-22'},bindings:activeBindingRows}};
const deploymentResult={deployments:[
  {id:EXPECTED_ACTIVE_DEPLOYMENT_ID,versions:[{version_id:EXPECTED_ACTIVE_VERSION_ID,percentage:100}]},
  {id:'prior-deployment',versions:[{version_id:'3a2b065a-6527-4887-9bf8-b08e82e81133',percentage:100}]}
]};
const versionsResult={items:[{id:EXPECTED_ACTIVE_VERSION_ID},{id:'3a2b065a-6527-4887-9bf8-b08e82e81133'}]};
const postState={
  migrations:[{version:1,name:'shadow_data_foundation'},{version:2,name:'official_fpl_structured_history'}],
  sourceRows:[{source_id:'source-official-fpl',source_key:'official-fpl',source_name:'Official FPL API',source_kind:'official_fpl',created_at:'2026-08-26T00:00:00.000Z'}],
  revisionRows:[{source_revision_id:'official-fpl-r1',source_id:'source-official-fpl',revision:1,schema_version:'data-s2a-v1',rights_classification:'durable_allowed',retention_allowed:1,redistribution_allowed:0,attribution_required:0,attribution_text:null,terms_reference:'docs/DATA_SOURCES.md',terms_reviewed_at:'2026-08-26T00:00:00.000Z',acquisition_status:'approved_internal_shadow_history',shadow_ingest_allowed:1,supersedes_revision_id:null,created_at:'2026-08-26T00:00:00.000Z'}],
  counts:{data_sources:1,data_source_revisions:1,ingestion_runs:2,shadow_observations:0,observation_heads:0,canonical_entities:0},
  official:{ingestion_runs:2,shadow_observations:0,observation_heads:0},
  runs:[1,2].map(run=>({run_id:`run-${run}`,source_revision_id:'official-fpl-r1',run_type:'official_fpl_structured_history',mode:'shadow_only',status:'failed',records_seen:0,records_accepted:0,records_quarantined:0,records_rejected:0,error_class:'TypeError'}))
};

test('Phase 4B preflight constants pin the accepted production contract',()=>{
  assert.equal(WORKER_NAME,'teamsheet-data-platform');
  assert.equal(EXPECTED_PRODUCTION_HOSTNAME,'data.fpltsheet.co.uk');
  assert.equal(EXPECTED_ACTIVE_VERSION_ID,'733093ef-e01f-43a8-828a-0c8c67e7626f');
  assert.equal(EXPECTED_ROLLBACK_VERSION_ID,'733093ef-e01f-43a8-828a-0c8c67e7626f');
  assert.equal(EXPECTED_COMPATIBILITY_DATE,'2026-08-22');
  assert.equal(EXPECTED_SEASON,'2026-27');
  assert.equal(EXPECTED_ACTIVE_DEPLOYMENT_ID,'06135b20-2508-4046-a21d-143077149825');
  assert.equal(EXPECTED_D1_DATABASE_ID,'01e2b4f9-313a-4a14-8ce6-86c5aecc50d7');
});

test('active Deployment is exactly the expected sole Version at 100 percent',()=>{
  assert.deepEqual(validateDeployment(deploymentResult),{deploymentId:EXPECTED_ACTIVE_DEPLOYMENT_ID,versionId:EXPECTED_ACTIVE_VERSION_ID});
  assert.throws(()=>validateDeployment({deployments:[{id:'current',versions:[{version_id:EXPECTED_ACTIVE_VERSION_ID,percentage:50},{version_id:'other',percentage:50}]},{id:'prior',versions:[{version_id:EXPECTED_ROLLBACK_VERSION_ID,percentage:100}]}]}),/active_deployment_invalid/);
  assert.throws(()=>validateDeployment({deployments:[{id:'current',versions:[{version_id:'other',percentage:100}]},{id:'prior',versions:[{version_id:EXPECTED_ROLLBACK_VERSION_ID,percentage:100}]}]}),/active_version_drift/);
});

test('deployable Version list requires active latest and retained rollback present',()=>{
  assert.deepEqual(validateVersions(extractVersions(versionsResult)),[EXPECTED_ACTIVE_VERSION_ID,'3a2b065a-6527-4887-9bf8-b08e82e81133']);
  assert.throws(()=>validateVersions([EXPECTED_ACTIVE_VERSION_ID]),/rollback_version_missing/);
  assert.throws(()=>validateVersions(['3a2b065a-6527-4887-9bf8-b08e82e81133',EXPECTED_ACTIVE_VERSION_ID]),/latest_active_drift/);
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

test('Custom Domain and D1 identity are exact',()=>{
  assert.deepEqual(validateDomains([{service:WORKER_NAME,hostname:EXPECTED_PRODUCTION_HOSTNAME}]),[EXPECTED_PRODUCTION_HOSTNAME]);
  assert.throws(()=>validateDomains([{service:WORKER_NAME,hostname:'other.example'}]),/domain_drift/);
  assert.equal(validateDatabase({uuid:EXPECTED_D1_DATABASE_ID,name:'teamsheet-data',file_size:200000},EXPECTED_D1_DATABASE_ID).file_size,200000);
  assert.throws(()=>validateDatabase({uuid:'drift',name:'teamsheet-data',file_size:200000},EXPECTED_D1_DATABASE_ID),/database_details_contract_invalid|d1_identity_drift/);
});

test('live Cron must be the sole exact cadence',()=>{
  assert.deepEqual(validateCron({schedules:[{cron:EXPECTED_CRON}]}),[EXPECTED_CRON]);
  for(const schedules of [[],[{cron:'0 * * * *'}],[{cron:EXPECTED_CRON},{cron:'0 * * * *'}]])assert.throws(()=>validateCron({schedules}),/cron_drift/);
});

test('D1 failed-run-only post-activation state is accepted and partial/success state fails closed',()=>{
  assert.equal(validateD1State(postState),true);
  assert.equal(validateD1State({...postState,counts:{...postState.counts,ingestion_runs:3},official:{...postState.official,ingestion_runs:3},runs:[...postState.runs,{...postState.runs[0],run_id:'run-3'}]}),true);
  assert.throws(()=>validateD1State({...postState,counts:{...postState.counts,shadow_observations:1}}),/partial_accepted_history|post_table_count_drift/);
  assert.throws(()=>validateD1State({...postState,runs:postState.runs.map((run,index)=>index?run:{...run,status:'completed',error_class:null})}),/unknown_failed_run_contract/);
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
  for(const expected of [/workflow_dispatch:/,/approved_sha:/,/refs\/heads\/main/,/priteshpatel390-del\/FPL/,/\^\[0-9a-f\]\{40\}\$/,/git ls-remote/,/git status --porcelain/,/Tests and deterministic build/,/environment:\s*\n\s+name: data-s2b-phase3-deployment/,/node-version: 24\.19\.0/])assert.match(workflow,expected);
  // Manual dispatch is the only trigger: no push, schedule or event-driven path can reach the protected credentials.
  assert.doesNotMatch(workflow,/^\s{2}(?:push|schedule|pull_request|pull_request_target|workflow_run|repository_dispatch|issue_comment):/m);
  for(const credential of ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_PHASE3_DEPLOY_TOKEN'])assert.ok(workflow.indexOf('repository-gate:')<workflow.indexOf(credential));
});

test('workflow invokes only the standalone preflight and no mutation or collector helper',()=>{
  assert.match(workflow,/node workers\/data-platform\/phase4b\/preflight\.mjs/);
  assert.doesNotMatch(workflow,/node\s+workers\/data-platform\/(?:phase4b\/(?:upload-version|deploy-version)|collector)\.mjs|readonly-closeout\.mjs|wrangler\s+(?:deploy|triggers(?:\s+deploy)?)|official-fpl-history|bootstrap-static|fixtures/);
  assert.match(workflow,/CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_PHASE3_DEPLOY_TOKEN \}\}/);
  assert.deepEqual([...new Set([...workflow.matchAll(/secrets\.([A-Z0-9_]+)/g)].map(row=>row[1]))].sort(),['CF_ACCESS_CLIENT_ID','CF_ACCESS_CLIENT_SECRET','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_PHASE3_DEPLOY_TOKEN','DATA_S1_HTTP_AUTH_TOKEN']);
  assert.doesNotMatch(workflow,/secrets\.CLOUDFLARE_API_TOKEN|CLOUDFLARE_WORKER_UPLOAD_TOKEN|CLOUDFLARE_D1_WRITE_TOKEN/);
});
