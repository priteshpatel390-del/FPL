import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {
  assessCron,assessDeployments,assessMigrations,classifyApiResponse,extractD1DatabaseList,extractD1QueryResult,
  extractDeploymentsResult,extractSchedulesResult,extractWorkerSettingsResult,extractWorkersDomains,
  normaliseD1Binding,optionalMetrics,requireD1BindingDatabase,stripSqlComments,validateReadOnlySql
} from '../workers/data-platform/phase0/readonly-preflight.mjs';
import {PHASE0_QUERIES} from '../workers/data-platform/phase0/queries.mjs';

const workflowPath='.github/workflows/data-s2b-phase0-readonly.yml';
const helperPath='workers/data-platform/phase0/readonly-preflight.mjs';
const queryPath='workers/data-platform/phase0/queries.mjs';
const workflow=fs.readFileSync(workflowPath,'utf8');
const helper=fs.readFileSync(helperPath,'utf8');

function runBlocks(source){return [...source.matchAll(/^\s+run: \|\n((?:\s{10}.*\n?)*)/gm)].map(match=>match[1]).join('\n');}

test('Phase 0 workflow is manual-only with one required immutable SHA input',()=>{
  assert.match(workflow,/^on:\n  workflow_dispatch:\n    inputs:\n      approved_sha:/m);
  assert.match(workflow,/approved_sha:[\s\S]{0,180}required: true/);
  assert.doesNotMatch(workflow,/^\s{2}(?:push|pull_request|pull_request_target|schedule):/m);
  assert.deepEqual([...workflow.matchAll(/^\s{6}([a-z_]+):\n\s{8}description:/gm)].map(row=>row[1]),['approved_sha']);
  assert.match(workflow,/grep -Eq '\^\[0-9a-f\]\{40\}\$'/);
  assert.match(workflow,/ref: \$\{\{ inputs\.approved_sha \}\}/);
});

test('repository identity and exact-head CI gates complete before environment secrets exist',()=>{
  const gate=workflow.indexOf('repository-gate:'),cloud=workflow.indexOf('cloudflare-readonly:');
  assert.ok(gate>0&&gate<cloud);
  assert.match(workflow,/cloudflare-readonly:\n    needs: repository-gate/);
  assert.doesNotMatch(workflow.slice(gate,cloud),/environment:|secrets\.|CLOUDFLARE_/);
  assert.match(workflow.slice(cloud),/name: data-s2b-phase0-readonly/);
  for(const required of ['git rev-parse HEAD','git ls-remote https://github.com/priteshpatel390-del/FPL.git refs/heads/main','git status --porcelain','Tests and deterministic build',"row.conclusion==='success'","row.head_sha===process.env.APPROVED_SHA"])assert.ok(workflow.includes(required),required);
});

test('Phase 0 executable surfaces contain no mutating Cloudflare command',()=>{
  const executable=`${runBlocks(workflow)}\n${helper}`;
  const forbidden=[
    /\bwrangler\s+deploy\b/i,/\bwrangler\s+versions\s+upload\b/i,/\bwrangler\s+versions\s+deploy\b/i,
    /\bwrangler\s+triggers\s+(?:deploy|delete)\b/i,/\bwrangler\s+d1\s+migrations\s+apply\b/i,
    /\bwrangler\s+(?:secret|route|domain)\s+(?:put|delete|create|update)\b/i,
    /\/access\/(?:apps|policies)[^\n]*(?:POST|PUT|PATCH|DELETE)/i
  ];
  for(const pattern of forbidden)assert.doesNotMatch(executable,pattern);
  assert.doesNotMatch(workflow,/permissions:[\s\S]{0,100}\bwrite\b/);
});

test('all repository Phase 0 SQL is fixed, audited and read-only',()=>{
  assert.ok(Object.keys(PHASE0_QUERIES).length>=5);
  for(const [name,sql] of Object.entries(PHASE0_QUERIES))assert.doesNotThrow(()=>validateReadOnlySql(sql),name);
  assert.doesNotMatch(workflow,/sql\s*:/i);
  assert.doesNotMatch(workflow,/inputs\.[a-z_]*sql|github\.event\.inputs\.[a-z_]*sql/i);
  assert.doesNotMatch(fs.readFileSync(queryPath,'utf8'),/\$\{|process\.env|process\.argv/);
});

test('D1 binding identity is compared to the uniquely resolved expected database without disclosure',()=>{
  assert.match(helper,/databases\.length!==1\|\|databases\[0\]\?\.name!=='teamsheet-data'/);
  assert.match(helper,/requireD1BindingDatabase\(d1,databaseId\)/);
  assert.doesNotMatch(helper,/databaseId[^\n]*(?:console|stderr|summary|GITHUB_STEP_SUMMARY)/i);
});

test('documented deployments wrapper is extracted before deployment assessment',()=>{
  const result={deployments:[
    {id:'new',created_on:'2026-08-26T01:00:00Z',versions:[{version_id:'v2',percentage:100}]},
    {id:'old',created_on:'2026-08-26T00:00:00Z',versions:[{version_id:'v1',percentage:100}]}
  ]};
  assert.equal(assessDeployments(extractDeploymentsResult(result)).versionId,'v2');
  for(const malformed of [undefined,{},[],{deployments:{}},{deployments:null}])assert.throws(()=>extractDeploymentsResult(malformed),/deployments_contract_invalid/);
});

test('documented schedules wrapper is extracted before fail-closed Cron assessment',()=>{
  assert.deepEqual(assessCron(extractSchedulesResult({schedules:[]})),[]);
  assert.throws(()=>assessCron(extractSchedulesResult({schedules:[{cron:'0 * * * *'}]})),/unexpected_data_s2_hourly_cron/);
  for(const malformed of [undefined,{},[],{schedules:{}},{schedules:null}])assert.throws(()=>extractSchedulesResult(malformed),/schedules_contract_invalid/);
});

test('documented Worker settings D1 binding uses type d1 and database_id',()=>{
  const settings={bindings:[{type:'d1',name:'TEAMSHEET_DATA_DB',database_id:'db-current'}]};
  assert.equal(extractWorkerSettingsResult(settings),settings);
  assert.deepEqual(normaliseD1Binding(settings),{name:'TEAMSHEET_DATA_DB',databaseId:'db-current'});
  for(const missing of [{bindings:[]},{bindings:[{type:'plain_text',name:'DATA_S2_SEASON',text:'2026-27'}]}])assert.throws(()=>normaliseD1Binding(missing),/d1_binding_drift/);
  assert.throws(()=>normaliseD1Binding({bindings:[...settings.bindings,...settings.bindings]}),/d1_binding_drift/);
  for(const malformed of [
    {bindings:[{type:'d1',name:'TEAMSHEET_DATA_DB'}]},
    {bindings:[{type:'d1',name:'TEAMSHEET_DATA_DB',database_id:''}]},
    {bindings:[{type:'d1',name:'TEAMSHEET_DATA_DB',database_id:42}]},
    {bindings:[{type:'d1_namespace',name:'TEAMSHEET_DATA_DB',id:'db-legacy'}]}
  ])assert.throws(()=>normaliseD1Binding(malformed),/d1_binding_contract_invalid/);
  assert.doesNotMatch(helper,/type:'d1_namespace'|d1\[0\]\?\.id/);
  for(const malformedSettings of [undefined,{},[],{bindings:{}},{bindings:null}])assert.throws(()=>extractWorkerSettingsResult(malformedSettings),/settings_contract_invalid/);
});

test('D1 binding database identity mismatch remains fail-closed in the execution path',()=>{
  const binding=normaliseD1Binding({bindings:[{type:'d1',name:'TEAMSHEET_DATA_DB',database_id:'wrong-db'}]});
  const databaseId=extractD1DatabaseList([{name:'teamsheet-data',uuid:'expected-db'}])[0].uuid;
  assert.throws(()=>requireD1BindingDatabase(binding,databaseId),/d1_binding_database_drift/);
  assert.deepEqual(requireD1BindingDatabase({...binding,databaseId},databaseId),{name:'TEAMSHEET_DATA_DB',databaseId});
  for(const malformed of [undefined,'',null,42])assert.throws(()=>requireD1BindingDatabase(binding,malformed),/d1_binding_database_drift/);
  assert.match(helper,/requireD1BindingDatabase\(d1,databaseId\)/);
});

test('documented D1 list, D1 query array and Workers domains results are normalized',()=>{
  const databases=[{name:'teamsheet-data',uuid:'db'}];
  assert.equal(extractD1DatabaseList(databases),databases);
  assert.deepEqual(extractD1QueryResult([{success:true,results:[{count:3}],meta:{rows_read:1}}]),[{count:3}]);
  const domains=[{service:'teamsheet-data-platform',hostname:'data.example.test'}];
  assert.equal(extractWorkersDomains(domains),domains);
  for(const malformed of [undefined,{},null]){
    assert.throws(()=>extractD1DatabaseList(malformed),/database_list_contract_invalid/);
    assert.throws(()=>extractWorkersDomains(malformed),/workers_domains_contract_invalid/);
  }
  for(const malformed of [undefined,{},[],[{success:true,results:[]} ,{success:true,results:[]}],[{success:false,results:[]}],[{success:true,results:{}}]])assert.throws(()=>extractD1QueryResult(malformed),/d1_query_contract_invalid/);
});

test('SQL validator permits SELECT with whitespace/comments and one terminator',()=>{
  assert.equal(validateReadOnlySql(' SELECT 1; '),'SELECT 1');
  assert.equal(validateReadOnlySql('-- explanation\n /* audited */ SELECT COUNT(*) FROM data_sources'),'SELECT COUNT(*) FROM data_sources');
  assert.equal(stripSqlComments("SELECT '-- not comment' /* real */"),"SELECT '-- not comment'  ");
});

test('SQL validator rejects writes, DDL, unsafe commands and statement injection',()=>{
  for(const sql of ['INSERT INTO x VALUES (1)','UPDATE x SET y=1','DELETE FROM x','CREATE TABLE x(y)','DROP TABLE x','SELECT 1; DELETE FROM x','SELECT 1;;','SELECT 1; -- misleading comment\n DROP TABLE x','/* SELECT 1; */ DELETE FROM x','-- INSERT is misleading\nUPDATE x SET y=1','PRAGMA table_info(x)','ATTACH DATABASE x AS y','VACUUM','REINDEX']){
    assert.throws(()=>validateReadOnlySql(sql),undefined,sql);
  }
});

test('credential absence fails closed before any API request',()=>{
  const result=spawnSync(process.execPath,[helperPath],{encoding:'utf8',env:{...process.env,RUNNER_TEMP:'/tmp',CLOUDFLARE_API_TOKEN:'',CLOUDFLARE_ACCOUNT_ID:''}});
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/required_cloudflare_credentials_missing/);
  assert.doesNotMatch(result.stdout,/Authorization|Bearer/);
});

test('401 and 403 API outcomes fail closed without retaining response content',()=>{
  assert.deepEqual(classifyApiResponse(401,{errors:[{message:'private'}]}),{ok:false,diagnostic:'HTTP_401'});
  assert.deepEqual(classifyApiResponse(403,{errors:[{message:'private'}]}),{ok:false,diagnostic:'HTTP_403'});
});

test('unexpected Cron, migration drift and missing rollback evidence fail closed',()=>{
  assert.throws(()=>assessCron([{cron:'0 * * * *'}]),/unexpected_data_s2_hourly_cron/);
  assert.throws(()=>assessCron([{cron:'30 2 * * *'}]),/unexpected_cron_drift/);
  assert.deepEqual(assessCron([]),[]);
  assert.throws(()=>assessMigrations([]),/migration_drift/);
  assert.throws(()=>assessMigrations([{version:1,name:'shadow_data_foundation'},{version:2,name:'official_fpl_structured_history'}]),/migration_drift/);
  assert.deepEqual(assessMigrations([{version:1,name:'shadow_data_foundation'}]).map(row=>row.status),['applied','pending']);
  assert.throws(()=>assessDeployments([{id:'only',created_on:'2026-08-26T00:00:00Z',versions:[{version_id:'v1',percentage:100}]}]),/rollback_version_missing/);
});

test('deployment history requires one current version and a real prior rollback version',()=>{
  const result=assessDeployments([
    {id:'new',created_on:'2026-08-26T01:00:00Z',versions:[{version_id:'v2',percentage:100}]},
    {id:'old',created_on:'2026-08-26T00:00:00Z',versions:[{version_id:'v1',percentage:100}]}
  ]);
  assert.deepEqual(result,{deploymentId:'new',versionId:'v2',timestamp:'2026-08-26T01:00:00Z',rollback:'PASS'});
});

test('unavailable optional analytics remain NOT PROVABLE and are never coerced to zero',()=>{
  assert.deepEqual(optionalMetrics(undefined),{status:'NOT PROVABLE'});
  assert.deepEqual(optionalMetrics(null),{status:'NOT PROVABLE'});
  assert.deepEqual(optionalMetrics(0),{status:'PASS',value:0});
  assert.match(helper,/metrics:optionalMetrics\(null\)/);
});

test('Phase 0 redaction and debug policy excludes unsafe output and artifacts',()=>{
  const executable=`${runBlocks(workflow)}\n${helper}`;
  for(const pattern of [/^\s*set -x/m,/^\s*env\s*$/m,/curl[^\n]*(?:--verbose|-v\b)/i,/console\.log\s*\(\s*process\.env/i,/actions\/upload-artifact/i,/Authorization.*GITHUB_STEP_SUMMARY/i])assert.doesNotMatch(executable,pattern);
  assert.match(helper,/::add-mask::\$\{token\}/);
  assert.match(helper,/::add-mask::\$\{account\}/);
  assert.match(helper,/RUNNER_TEMP/);
  assert.doesNotMatch(helper,/databaseId[^\n]*(?:summary|GITHUB_STEP_SUMMARY)/i);
  assert.deepEqual([...new Set([...workflow.matchAll(/secrets\.([A-Z0-9_]+)/g)].map(row=>row[1]))].sort(),['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN']);
});

test('Phase 0 introduces no application, provider, model or runtime dependency and preserves 6,825',()=>{
  const changedSurfaces=[workflowPath,helperPath,queryPath];
  assert.equal(changedSurfaces.some(path=>path.startsWith('src/')),false);
  const history=fs.readFileSync('tests/data-s2a-official-fpl-history.test.mjs','utf8');
  assert.match(history,/assert\.equal\(result\.candidates\.length,6825\)/);
  assert.equal(JSON.parse(fs.readFileSync('workers/data-platform/wrangler.jsonc','utf8')).vars.DATA_S2_SEASON,'2026-27');
});
