import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CONFIG_PATH,EXPECTED_COMPATIBILITY_DATE,EXPECTED_CRON,EXPECTED_SEASON,MODULE_PATHS,WORKER_NAME,
  buildVersionMetadata,extractUploadedVersion,extractVersions,parseAndValidateConfig,validateActiveBindings,
  validateModuleGraph,validatePostPhase1State,validateUploadedVersion,validateVersionDelta
} from '../workers/data-platform/phase2/upload-version.mjs';

const workflowPath='.github/workflows/data-s2b-phase2-version-upload.yml';
const helperPath='workers/data-platform/phase2/upload-version.mjs';
const workflow=fs.readFileSync(workflowPath,'utf8');
const helper=fs.readFileSync(helperPath,'utf8');
const configText=fs.readFileSync(CONFIG_PATH,'utf8');
const approvedSha='0123456789abcdef0123456789abcdef01234567';
const activeVersion='11111111-1111-4111-8111-111111111111';
const uploadedVersion='22222222-2222-4222-8222-222222222222';
const databaseId='33333333-3333-4333-8333-333333333333';

function runBlocks(source){return [...source.matchAll(/^\s+run: \|\n((?:\s{10}.*\n?)*)/gm)].map(match=>match[1]).join('\n');}

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
const postState={
  migrations:[
    {version:1,name:'shadow_data_foundation',applied_at:'2026-08-22T00:00:00.000Z'},
    {version:2,name:'official_fpl_structured_history',applied_at:'2026-08-26T00:00:00.000Z'}
  ],
  sourceRows:[sourceRow],revisionRows:[revisionRow],
  counts:{data_sources:1,data_source_revisions:1,ingestion_runs:0,shadow_observations:0,observation_heads:0,canonical_entities:0},
  official:{ingestion_runs:0,shadow_observations:0,observation_heads:0}
};

test('Phase 2 workflow is manual-only with one immutable SHA input',()=>{
  assert.match(workflow,/^on:\n  workflow_dispatch:\n    inputs:\n      approved_sha:/m);
  assert.match(workflow,/approved_sha:[\s\S]{0,240}required: true/);
  assert.doesNotMatch(workflow,/^\s{2}(?:push|pull_request|pull_request_target|schedule):/m);
  assert.deepEqual([...workflow.matchAll(/^\s{6}([a-z_]+):\n\s{8}description:/gm)].map(row=>row[1]),['approved_sha']);
  assert.match(workflow,/grep -Eq '\^\[0-9a-f\]\{40\}\$'/);
  assert.match(workflow,/ref: \$\{\{ inputs\.approved_sha \}\}/);
});

test('repository identity and exact-head CI gates complete before Phase 2 credentials exist',()=>{
  const gate=workflow.indexOf('repository-gate:'),upload=workflow.indexOf('phase2-version-upload:');
  assert.ok(gate>0&&gate<upload);
  assert.match(workflow,/phase2-version-upload:\n    needs: repository-gate/);
  assert.doesNotMatch(workflow.slice(gate,upload),/environment:|secrets\.|CLOUDFLARE_/);
  assert.match(workflow.slice(upload),/name: data-s2b-phase2-version-upload/);
  assert.match(workflow.slice(upload),/CLOUDFLARE_WORKER_UPLOAD_TOKEN: \$\{\{ secrets\.CLOUDFLARE_WORKER_UPLOAD_TOKEN \}\}/);
  assert.match(workflow.slice(upload),/CLOUDFLARE_ACCOUNT_ID: \$\{\{ secrets\.CLOUDFLARE_ACCOUNT_ID \}\}/);
  for(const required of [
    'test "$EVENT_NAME" = workflow_dispatch','test "$EVENT_REF" = refs/heads/main',
    'test "$EVENT_REPOSITORY" = priteshpatel390-del/FPL','git ls-remote https://github.com/priteshpatel390-del/FPL.git refs/heads/main',
    'git status --porcelain','Tests and deterministic build',"row.conclusion==='success'",
    "row.head_sha===process.env.APPROVED_SHA","row.app?.slug==='github-actions'"
  ])assert.ok(workflow.includes(required),required);
});

test('Phase 2 executable has one Cloudflare mutation primitive and cannot deploy traffic, triggers, routes, secrets or D1 writes',()=>{
  const executable=`${runBlocks(workflow)}\n${helper}`;
  assert.match(helper,/\/versions\?bindings_inherit=strict/);
  assert.equal((helper.match(/\/versions\?bindings_inherit=strict/g)??[]).length,1);
  assert.doesNotMatch(executable,/\b(?:npm|npx|pnpm|yarn)\b/i);
  assert.doesNotMatch(executable,/\bwrangler\s+(?:deploy|versions\s+deploy|triggers\s+deploy|secret)/i);
  assert.doesNotMatch(helper,/\/deployments[^`'"\n]*['"`]?\s*,\s*\{\s*method:\s*['"](?:POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(helper,/\/schedules[^`'"\n]*['"`]?\s*,\s*\{\s*method:\s*['"](?:POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(helper,/\/(?:routes|domains|subdomain|secrets)(?:\/|`|'|")[^\n]*method:\s*['"](?:POST|PUT|PATCH|DELETE)/i);
  assert.doesNotMatch(helper,/\/time_travel\/restore/i);
  assert.doesNotMatch(helper,/body:\s*\{\s*(?:batch|sql\s*:\s*(?!validateReadOnlySql))/i);
  assert.match(helper,/body:\{sql:validateReadOnlySql\(sql\)\}/);
});

test('repository candidate configuration is pinned and drift fails closed',()=>{
  const config=parseAndValidateConfig(configText);
  assert.equal(config.name,WORKER_NAME);
  assert.equal(config.compatibility_date,EXPECTED_COMPATIBILITY_DATE);
  assert.equal(config.vars.DATA_S2_SEASON,EXPECTED_SEASON);
  assert.deepEqual(config.triggers.crons,[EXPECTED_CRON]);
  for(const mutated of [
    {...config,name:'wrong'},
    {...config,compatibility_date:'2026-08-23'},
    {...config,vars:{DATA_S2_SEASON:'2025-26'}},
    {...config,triggers:{crons:[]}},
    {...config,d1_databases:[{...config.d1_databases[0],database_name:'wrong'}]},
    {...config,routes:['example.com/*']}
  ])assert.throws(()=>parseAndValidateConfig(JSON.stringify(mutated)),/phase2_/);
});

test('Phase 2 requires the current D1 and retained HTTP secret before creating a deployable candidate',()=>{
  const settings={bindings:[
    {name:'TEAMSHEET_DATA_DB',type:'d1',database_id:databaseId},
    {name:'DATA_S1_HTTP_AUTH_TOKEN',type:'secret_text'}
  ]};
  assert.equal(validateActiveBindings(settings),settings);
  for(const bindings of [
    [settings.bindings[0]],
    [...settings.bindings,{name:'DATA_S2_SEASON',type:'plain_text',text:EXPECTED_SEASON}],
    [{...settings.bindings[0],type:'plain_text'},settings.bindings[1]],
    [...settings.bindings,{name:'EXTRA',type:'plain_text'}]
  ])assert.throws(()=>validateActiveBindings({bindings}),/phase2_active_binding_set_drift/);
});

test('upload metadata inherits exact active D1 and secret while adding only the approved season binding',()=>{
  const metadata=buildVersionMetadata(activeVersion,approvedSha);
  assert.equal(metadata.main_module,'data-platform-rpc.mjs');
  assert.equal(metadata.compatibility_date,EXPECTED_COMPATIBILITY_DATE);
  assert.deepEqual(metadata.observability,{enabled:true});
  assert.deepEqual(metadata.bindings,[
    {name:'TEAMSHEET_DATA_DB',type:'inherit',version_id:activeVersion},
    {name:'DATA_S1_HTTP_AUTH_TOKEN',type:'inherit',version_id:activeVersion},
    {name:'DATA_S2_SEASON',type:'plain_text',text:EXPECTED_SEASON}
  ]);
  assert.equal(metadata.bindings.filter(row=>row.type==='inherit').every(row=>row.version_id===activeVersion),true);
  assert.equal(Object.hasOwn(metadata,'triggers'),false);
  assert.equal(Object.hasOwn(metadata,'routes'),false);
  assert.equal(Object.hasOwn(metadata,'secrets'),false);
  assert.match(metadata.annotations['workers/message'],new RegExp(approvedSha));
  assert.equal(metadata.annotations['workers/tag'],`data-s2b-phase2-${approvedSha.slice(0,12)}`);
});

test('upload module graph is the exact four reviewed repository ES modules with no package or network imports',()=>{
  assert.deepEqual(MODULE_PATHS,[
    'workers/data-platform/data-platform-rpc.mjs',
    'workers/data-platform/data-platform.mjs',
    'workers/data-platform/data-platform-core.mjs',
    'workers/data-platform/official-fpl-history.mjs'
  ]);
  const sources=validateModuleGraph();
  assert.equal(sources.size,4);
  for(const source of sources.values())assert.doesNotMatch(source,/from\s+['"](?:https?:|npm:|node_modules\/)/);
});

test('version list, upload result and post-upload delta contracts fail closed',()=>{
  assert.deepEqual(extractVersions({items:[{id:activeVersion}]}),[activeVersion]);
  assert.throws(()=>extractVersions({}),/phase2_versions_contract_invalid/);
  assert.throws(()=>extractVersions({items:[{id:activeVersion},{id:activeVersion}]}),/phase2_versions_contract_invalid/);
  assert.equal(extractUploadedVersion({id:uploadedVersion},activeVersion),uploadedVersion);
  assert.throws(()=>extractUploadedVersion({id:activeVersion},activeVersion),/phase2_upload_result_invalid/);
  assert.equal(validateVersionDelta([activeVersion],[uploadedVersion,activeVersion],uploadedVersion),true);
  assert.throws(()=>validateVersionDelta([activeVersion],[uploadedVersion,'unexpected',activeVersion],uploadedVersion),/phase2_version_delta_invalid/);
});

test('uploaded version detail must contain exact D1, retained secret and season bindings with pinned runtime',()=>{
  const detail={id:uploadedVersion,resources:{
    script_runtime:{compatibility_date:EXPECTED_COMPATIBILITY_DATE},
    bindings:[
      {name:'TEAMSHEET_DATA_DB',type:'d1',database_id:databaseId},
      {name:'DATA_S1_HTTP_AUTH_TOKEN',type:'secret_text'},
      {name:'DATA_S2_SEASON',type:'plain_text',text:EXPECTED_SEASON}
    ]
  }};
  assert.equal(validateUploadedVersion(detail,{uploadedId:uploadedVersion,databaseId}),true);
  assert.throws(()=>validateUploadedVersion({...detail,resources:{...detail.resources,bindings:detail.resources.bindings.slice(0,2)}},{uploadedId:uploadedVersion,databaseId}),/phase2_version_binding_set_drift/);
  assert.throws(()=>validateUploadedVersion({...detail,resources:{...detail.resources,bindings:detail.resources.bindings.map(row=>row.name==='TEAMSHEET_DATA_DB'?{...row,database_id:'wrong'}:row)}},{uploadedId:uploadedVersion,databaseId}),/phase2_version_d1_binding_drift/);
  assert.throws(()=>validateUploadedVersion({...detail,resources:{...detail.resources,bindings:detail.resources.bindings.map(row=>row.name==='DATA_S1_HTTP_AUTH_TOKEN'?{...row,text:'should-never-be-returned'}:row)}},{uploadedId:uploadedVersion,databaseId}),/phase2_secret_exposed/);
});

test('Phase 1 governance/history post-state is re-used as the immutable D1 pre/post contract',()=>{
  assert.equal(validatePostPhase1State(postState),true);
  assert.throws(()=>validatePostPhase1State({...postState,counts:{...postState.counts,ingestion_runs:1}}),/post_table_count_drift/);
  assert.throws(()=>validatePostPhase1State({...postState,official:{...postState.official,shadow_observations:1}}),/post_official_history_drift/);
});

test('post-upload checks re-prove inactive deployment, live binding, Cron and D1 invariants after the version is created',()=>{
  const upload=helper.indexOf("/versions?bindings_inherit=strict");
  const detail=helper.indexOf('validateUploadedVersion(detail');
  const deploymentAfter=helper.indexOf('const deploymentsAfter=');
  const liveSettingsAfter=helper.indexOf('const settingsAfter=');
  const postStateAfter=helper.lastIndexOf('validatePostPhase1State(await readPhase1State())');
  assert.ok(upload>0&&upload<detail&&detail<deploymentAfter&&deploymentAfter<liveSettingsAfter&&liveSettingsAfter<postStateAfter);
  assert.match(helper,/sameDeployment\(deploymentsBefore,deploymentsAfter\)/);
  assert.match(helper,/validateActiveBindings\(extractWorkerSettingsResult\(await request\(`\$\{workerBase\}\/settings`\)\)\)/);
  assert.match(helper,/assessCron\(schedulesAfter\)/);
  assert.match(helper,/if\(d1After\.databaseId!==databaseId\)throw new Error\('phase2_live_d1_binding_changed'\)/);
  assert.match(helper,/phase2_d1_size_changed/);
});

test('credentials and provider identifiers are masked and raw responses are temporary only',()=>{
  assert.match(helper,/::add-mask::\$\{token\}/);
  assert.match(helper,/::add-mask::\$\{account\}/);
  assert.match(helper,/::add-mask::\$\{databaseId\}/);
  assert.match(helper,/fs\.writeFileSync\(`\$\{temp\}\/phase2-\$\{crypto\.randomUUID\(\)\}\.json`,text,\{mode:0o600\}\)/);
  assert.match(workflow,/trap 'rm -f "\$RUNNER_TEMP"\/phase2-\*\.json' EXIT/);
  assert.doesNotMatch(helper,/console\.log|set -x/);
  assert.doesNotMatch(workflow,/upload-artifact|artifacts:/i);
  assert.doesNotMatch(helper,/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
});
