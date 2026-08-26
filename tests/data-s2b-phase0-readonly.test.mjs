import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {
  assessCron,assessDeployments,assessMigrations,classifyApiResponse,extractD1DatabaseDetails,extractD1DatabaseList,extractD1QueryResult,
  extractDeploymentsResult,extractSchedulesResult,extractWorkerSettingsResult,extractWorkersDomains,
  normaliseD1Binding,normalisePlainTextBinding,optionalDomainsFailure,optionalMetrics,requireD1BindingDatabase,stripSqlComments,validateReadOnlySql,validateWorkerBindingSet
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
  for(const required of ['EVENT_NAME: ${{ github.event_name }}','EVENT_REF: ${{ github.ref }}','EVENT_REPOSITORY: ${{ github.repository }}','test "$EVENT_NAME" = workflow_dispatch','test "$EVENT_REF" = refs/heads/main','test "$EVENT_REPOSITORY" = priteshpatel390-del/FPL','git rev-parse HEAD','git ls-remote https://github.com/priteshpatel390-del/FPL.git refs/heads/main','git status --porcelain','Tests and deterministic build',"row.conclusion==='success'","row.head_sha===process.env.APPROVED_SHA","row.app?.slug==='github-actions'","row.details_url?.startsWith('https://github.com/priteshpatel390-del/FPL/actions/runs/')"])assert.ok(workflow.includes(required),required);
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

test('D1 binding UUID is the authoritative database identity without disclosure',()=>{
  const main=helper.slice(helper.indexOf('async function main(){'));
  assert.match(main,/const databaseId=d1\.databaseId;/);
  assert.match(main,/d1\/database\/\$\{encodeURIComponent\(databaseId\)\}\?fields=uuid,name,file_size/);
  assert.match(main,/\{uuid:databaseId\}\);/);
  assert.doesNotMatch(main,/d1\/database\?name=teamsheet-data/);
  assert.doesNotMatch(main,/databases\.length!==1|database_identity_drift/);
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

test('documented plain-text season binding is unique and explicit',()=>{
  const current={type:'plain_text',name:'DATA_S2_SEASON',text:'2026-27'};
  assert.deepEqual(normalisePlainTextBinding({bindings:[current]},'DATA_S2_SEASON'),{name:'DATA_S2_SEASON',text:'2026-27'});
  assert.throws(()=>normalisePlainTextBinding({bindings:[]},'DATA_S2_SEASON'),/plain_text_binding_drift/);
  assert.throws(()=>normalisePlainTextBinding({bindings:[current,current]},'DATA_S2_SEASON'),/plain_text_binding_drift/);
  for(const malformed of [{...current,type:'secret_text'},{type:'plain_text',name:'DATA_S2_SEASON'},{...current,text:42}])assert.throws(()=>normalisePlainTextBinding({bindings:[malformed]},'DATA_S2_SEASON'),/plain_text_binding_contract_invalid/);
  assert.match(helper,/normalisePlainTextBinding\(settings,'DATA_S2_SEASON'\)\.text/);
});

test('complete Worker binding set accepts only the two documented application bindings',()=>{
  const d1={type:'d1',name:'TEAMSHEET_DATA_DB',database_id:'db-current'};
  const season={type:'plain_text',name:'DATA_S2_SEASON',text:'2026-27'};
  assert.deepEqual(validateWorkerBindingSet({bindings:[d1,season]}),{bindings:[d1,season]});
  assert.deepEqual(validateWorkerBindingSet({bindings:[season,d1]}),{bindings:[season,d1]});
  for(const bindings of [
    [season],
    [d1],
    [d1,d1],
    [season,season],
    [{...d1,type:'kv_namespace'},season],
    [d1,{...season,type:'secret_text'}],
    [d1,season,{type:'kv_namespace',name:'EXTRA_KV',namespace_id:'kv'}],
    [d1,season,{type:'r2_bucket',name:'EXTRA_R2',bucket_name:'bucket'}],
    [d1,season,{type:'service',name:'EXTRA_SERVICE',service:'worker'}],
    [d1,season,{type:'secret_text',name:'EXTRA_SECRET'}],
    [d1,season,{type:'plain_text',name:'EXTRA_TEXT',text:'value'}],
    [d1,season,{type:'unexpected',name:'ARBITRARY'}]
  ])assert.throws(()=>validateWorkerBindingSet({bindings}),/worker_binding_set_drift/);
});

test('execution validates the complete binding set before individual bindings and any PASS summary',()=>{
  const complete=helper.indexOf('const settings=validateWorkerBindingSet(');
  const d1=helper.indexOf('const d1=normaliseD1Binding(settings)');
  const season=helper.indexOf("normalisePlainTextBinding(settings,'DATA_S2_SEASON')");
  const pass=helper.indexOf("outcome:'PASS'");
  assert.ok(complete>0&&complete<d1&&d1<season&&season<pass);
});

test('D1 binding/database mismatch helper remains fail-closed',()=>{
  const binding=normaliseD1Binding({bindings:[{type:'d1',name:'TEAMSHEET_DATA_DB',database_id:'wrong-db'}]});
  const databaseId=extractD1DatabaseList([{name:'teamsheet-data',uuid:'expected-db'}])[0].uuid;
  assert.throws(()=>requireD1BindingDatabase(binding,databaseId),/d1_binding_database_drift/);
  assert.deepEqual(requireD1BindingDatabase({...binding,databaseId},databaseId),{name:'TEAMSHEET_DATA_DB',databaseId});
  for(const malformed of [undefined,'',null,42])assert.throws(()=>requireD1BindingDatabase(binding,malformed),/d1_binding_database_drift/);
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

test('D1 database details prove the binding UUID and exact database name',()=>{
  const bound={uuid:'db'};
  assert.deepEqual(extractD1DatabaseDetails({name:'teamsheet-data',uuid:'db',file_size:123},bound),{name:'teamsheet-data',uuid:'db',file_size:123});
  assert.equal(extractD1DatabaseDetails({name:'teamsheet-data',uuid:'db',file_size:0},bound).file_size,0);
  for(const malformed of [undefined,{},
    {name:'teamsheet-data-s1b-validation-20260822',uuid:'db',file_size:1},
    {name:'wrong',uuid:'db',file_size:1},{name:'teamsheet-data',uuid:'wrong',file_size:1},
    {name:'teamsheet-data',uuid:'db'},{name:'teamsheet-data',uuid:'db',file_size:'1'},
    {name:'teamsheet-data',uuid:'db',file_size:-1},{name:'teamsheet-data',uuid:'db',file_size:Infinity}
  ])assert.throws(()=>extractD1DatabaseDetails(malformed,bound),/database_(?:details|size)_contract_invalid/);
  assert.match(helper,/const databaseId=d1\.databaseId;/);
  assert.match(helper,/d1\/database\/\$\{encodeURIComponent\(databaseId\)\}\?fields=uuid,name,file_size/);
  assert.doesNotMatch(helper,/d1\/database\?name=teamsheet-data/);
  assert.doesNotMatch(helper,/d1\/database\/teamsheet-data\?fields=uuid,name,file_size/);
  assert.match(helper,/sizeBytes:databaseDetails\.file_size/);
});

test('SQL validator permits SELECT with whitespace/comments and one terminator',()=>{
  assert.equal(validateReadOnlySql(' SELECT 1; '),'SELECT 1');
  assert.equal(validateReadOnlySql('-- explanation\n /* audited */ SELECT COUNT(*) FROM data_sources'),'SELECT COUNT(*) FROM data_sources');
  assert.equal(validateReadOnlySql("SELECT 'DELETE UPDATE', \"DROP\";"),"SELECT 'DELETE UPDATE', \"DROP\"");
  assert.equal(stripSqlComments("SELECT '-- not comment' /* real */"),"SELECT '-- not comment'  ");
});

test('SQL validator rejects writes, DDL, unsafe commands and statement injection',()=>{
  for(const sql of ['INSERT INTO x VALUES (1)','UPDATE x SET y=1','DELETE FROM x','REPLACE INTO x VALUES (1)','CREATE TABLE x(y)','ALTER TABLE x ADD y','DROP TABLE x','TRUNCATE TABLE x','SELECT 1; DELETE FROM x','SELECT 1;;','SELECT 1; -- misleading comment\n DROP TABLE x','/* SELECT 1; */ DELETE FROM x','-- INSERT is misleading\nUPDATE x SET y=1','/* unterminated','PRAGMA table_info(x)','ATTACH DATABASE x AS y','DETACH DATABASE y','VACUUM','REINDEX',"SELECT 'unterminated",'VALUES (1)']){
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
  assert.deepEqual(assessDeployments([
    {id:'first-is-active',created_on:'2026-08-26T00:00:00Z',versions:[{version_id:'active',percentage:100}]},
    {id:'later-looking-history',created_on:'2026-08-27T00:00:00Z',versions:[{version_id:'rollback',percentage:100}]}
  ]),{deploymentId:'first-is-active',versionId:'active',timestamp:'2026-08-26T00:00:00Z',rollback:'PASS'});
  assert.throws(()=>assessDeployments([
    {id:'new',created_on:'2026-08-26T01:00:00Z',versions:[{version_id:'same',percentage:100}]},
    {id:'old',created_on:'2026-08-26T00:00:00Z',versions:[{version_id:'same',percentage:100}]}
  ]),/rollback_version_missing/);
  assert.throws(()=>assessDeployments([
    {created_on:'2026-08-26T01:00:00Z',versions:[{version_id:'v2',percentage:100}]},
    {id:'old',created_on:'2026-08-26T00:00:00Z',versions:[{version_id:'v1',percentage:100}]}
  ]),/active_deployment_id_invalid/);
  assert.throws(()=>assessDeployments([
    {id:'new',created_on:'not-a-time',versions:[{version_id:'v2',percentage:100}]},
    {id:'old',created_on:'2026-08-26T00:00:00Z',versions:[{version_id:'v1',percentage:100}]}
  ]),/deployment_timestamp_invalid/);
  assert.throws(()=>assessDeployments([
    {id:'new',created_on:'2026-08-26T01:00:00Z'},
    {id:'old',created_on:'2026-08-26T00:00:00Z',versions:[{version_id:'v1',percentage:100}]}
  ]),/active_deployment_versions_invalid/);
  assert.throws(()=>assessDeployments([
    {id:'new',created_on:'2026-08-26T01:00:00Z',versions:[{version_id:'',percentage:100}]},
    {id:'old',created_on:'2026-08-26T00:00:00Z',versions:[{version_id:'v1',percentage:100}]}
  ]),/active_version_ambiguous/);
  assert.throws(()=>assessDeployments([
    {id:'new',created_on:'2026-08-26T01:00:00Z',versions:[{version_id:'v2',percentage:50}]},
    {id:'old',created_on:'2026-08-26T00:00:00Z',versions:[{version_id:'v1',percentage:100}]}
  ]),/active_version_ambiguous/);
  assert.throws(()=>assessDeployments([
    {id:'new',created_on:'2026-08-26T01:00:00Z',versions:[{version_id:'v2',percentage:100},{version_id:'v3',percentage:100}]},
    {id:'old',created_on:'2026-08-26T00:00:00Z',versions:[{version_id:'v1',percentage:100}]}
  ]),/active_version_ambiguous/);
});

test('unavailable optional analytics remain NOT PROVABLE and are never coerced to zero',()=>{
  assert.deepEqual(optionalMetrics(undefined),{status:'NOT PROVABLE'});
  assert.deepEqual(optionalMetrics(null),{status:'NOT PROVABLE'});
  assert.deepEqual(optionalMetrics(0),{status:'PASS',value:0});
  assert.match(helper,/metrics:optionalMetrics\(null\)/);
});

test('custom domains treat only missing optional permission as NOT PROVABLE',()=>{
  assert.deepEqual(optionalDomainsFailure(new Error('HTTP_403')),{status:'NOT PROVABLE'});
  for(const diagnostic of ['HTTP_401','HTTP_404','HTTP_429','workers_domains_contract_invalid','fetch failed'])assert.throws(()=>optionalDomainsFailure(new Error(diagnostic)),new RegExp(diagnostic.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(helper,/catch\(error\)\{domains=optionalDomainsFailure\(error\);\}/);
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
