import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {EXPECTED_D1_DATABASE_ID} from '../workers/data-platform/phase4b/live-contract.mjs';
import {productionModelUiImportCount} from '../workers/api-football-collector/activation-live-preflight.mjs';
import {
  EXPECTED_ACTIVATION,EXPECTED_COMPATIBILITY_DATE,EXPECTED_PLAIN_TEXT_VARS,MutationAmbiguousError,MutationRejectedError,
  REVIEWED_MODULE_PATHS,WORKER_NAME,assertMutationAllowed,buildUploadModules,buildVersionMetadata,buildWorkerShellBody,
  createRequester,deterministicIdentity,performShellCreate,performVersionUpload,resolveModuleGraph,
  validateBetaVersionDetail,validatePostflight,validateReadOnlyCloseoutReport,validateStableVersionDetail
} from '../workers/api-football-collector/stage-inactive-version.mjs';

const root=path.resolve(import.meta.dirname,'..');
const helper=fs.readFileSync(path.join(root,'workers/api-football-collector/stage-inactive-version.mjs'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/api-football-collector-inactive-version-staging.yml'),'utf8');
const SHA='a'.repeat(40);
const VERSION='11111111-1111-4111-8111-111111111111';
const WORKER_ID='worker-id';
const sources=resolveModuleGraph();
const modules=buildUploadModules(sources);
const metadata=buildVersionMetadata(SHA);
const identity=deterministicIdentity(metadata,modules,SHA);

function inertWorker(){return {
  id:WORKER_ID,name:WORKER_NAME,deployed_on:null,observability:{enabled:true},subdomain:{enabled:false,previews_enabled:false},
  references:{dispatch_namespace_outbounds:[],domains:[],durable_objects:[],queues:[],workers:[]}
};}
function stableVersion(){return {
  id:VERSION,resources:{script_runtime:{compatibility_date:EXPECTED_COMPATIBILITY_DATE},bindings:[
    {name:'TEAMSHEET_DATA_DB',type:'d1',database_id:EXPECTED_D1_DATABASE_ID},
    {name:'API_FOOTBALL_FPL_SEASON',type:'plain_text',text:'2026-27'},
    {name:'API_FOOTBALL_PROVIDER_SEASON',type:'plain_text',text:'2026'},
    {name:'EIA_2I5D_ACTIVATION',type:'plain_text',text:EXPECTED_ACTIVATION}
  ]}
};}
function betaVersion(){return {
  id:VERSION,number:1,main_module:'collector.mjs',compatibility_date:EXPECTED_COMPATIBILITY_DATE,urls:[],package_dependencies:[],
  annotations:{'workers/message':'API-Football collector inactive staging from '+SHA,'workers/tag':'api-football-collector-inactive-'+SHA.slice(0,12),'workers/triggered_by':'upload'},
  modules:[...modules.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([name,source])=>({name,content_type:'application/javascript+module',content_base64:Buffer.from(source).toString('base64')}))
};}
function postflight(){return {
  worker:inertWorker(),subdomain:{enabled:false,previews_enabled:false},deployments:{deployments:[]},schedules:{schedules:[]},domains:[],
  scripts:[{id:WORKER_NAME,routes:[]}],stableVersion:stableVersion(),betaVersion:betaVersion(),versionIds:[VERSION],versionId:VERSION,approvedSha:SHA,identity
};}

test('Worker shell identity and pre-Version routability controls are exact',()=>{
  assert.equal(WORKER_NAME,'teamsheet-api-football-shadow-collector');
  assert.deepEqual(buildWorkerShellBody(),{name:WORKER_NAME,observability:{enabled:true},subdomain:{enabled:false,previews_enabled:false}});
});

test('first inactive Version has exact compatibility date D1 and three plain-text bindings with zero secret binding',()=>{
  assert.equal(metadata.main_module,'collector.mjs');
  assert.equal(metadata.compatibility_date,'2026-09-16');
  assert.deepEqual(metadata.bindings,[
    {name:'TEAMSHEET_DATA_DB',type:'d1',database_id:EXPECTED_D1_DATABASE_ID},
    {name:'API_FOOTBALL_FPL_SEASON',type:'plain_text',text:'2026-27'},
    {name:'API_FOOTBALL_PROVIDER_SEASON',type:'plain_text',text:'2026'},
    {name:'EIA_2I5D_ACTIVATION',type:'plain_text',text:'REPOSITORY_ONLY_BLOCKED'}
  ]);
  assert.deepEqual(EXPECTED_PLAIN_TEXT_VARS,{API_FOOTBALL_FPL_SEASON:'2026-27',API_FOOTBALL_PROVIDER_SEASON:'2026',EIA_2I5D_ACTIVATION:'REPOSITORY_ONLY_BLOCKED'});
  assert.equal(JSON.stringify(metadata).includes('API_FOOTBALL_API_KEY'),false);
  assert.equal(JSON.stringify(metadata).includes('secret_text'),false);
  assert.equal(metadata.annotations['workers/commit_sha'],SHA);
});

test('closed transitive module graph is exact deterministic and repository-relative only',()=>{
  assert.equal(sources.size,REVIEWED_MODULE_PATHS.length);
  assert.equal(modules.size,REVIEWED_MODULE_PATHS.length);
  assert.deepEqual([...sources.keys()].sort(),[...REVIEWED_MODULE_PATHS].sort());
  assert.ok(modules.has('collector.mjs'));
  for(const source of modules.values())assert.doesNotMatch(source,/\b(?:import|export)\s+[^;]*?from\s*['"](?:https?:|npm:|node:|[^'"]*node_modules\/)/);
});

test('module graph rejects external or unreviewed additions',()=>{
  const actual=repoPath=>fs.readFileSync(path.join(root,repoPath),'utf8');
  assert.throws(()=>resolveModuleGraph({readFile:repoPath=>repoPath.endsWith('/collector.mjs')?actual(repoPath)+"\nimport 'https://example.invalid/x.mjs';\n":actual(repoPath)}),/external_module_dependency/);
  assert.throws(()=>resolveModuleGraph({readFile:repoPath=>repoPath.endsWith('/collector.mjs')?actual(repoPath)+"\nimport '.\/unreviewed.mjs';\n":actual(repoPath)}),/unreviewed_module/);
});

test('module and metadata hashes bind deterministically to approved SHA',()=>{
  const again=deterministicIdentity(buildVersionMetadata(SHA),buildUploadModules(resolveModuleGraph()),SHA);
  assert.deepEqual(again,identity);
  assert.match(identity.metadataSha256,/^[0-9a-f]{64}$/);
  assert.match(identity.graphSha256,/^[0-9a-f]{64}$/);
  for(const value of Object.values(identity.moduleSha256))assert.match(value,/^[0-9a-f]{64}$/);
  assert.notEqual(deterministicIdentity(metadata,modules,'b'.repeat(40)).graphSha256,identity.graphSha256);
});

test('closed mutation allowlist permits only shell creation and inactive Version upload',()=>{
  const accountId='account';
  assert.equal(assertMutationAllowed('POST','/accounts/account/workers/workers',{accountId}),true);
  assert.equal(assertMutationAllowed('POST','/accounts/account/workers/scripts/'+WORKER_NAME+'/versions',{accountId}),true);
  for(const [method,url] of [
    ['POST','/accounts/account/workers/scripts/'+WORKER_NAME+'/deployments'],['PUT','/accounts/account/workers/scripts/'+WORKER_NAME+'/schedules'],
    ['POST','/accounts/account/workers/scripts/'+WORKER_NAME+'/secrets'],['PUT','/accounts/account/workers/domains'],
    ['POST','/accounts/account/access/apps'],['POST','/accounts/account/d1/database/x/query'],['DELETE','/accounts/account/workers/scripts/'+WORKER_NAME]
  ])assert.throws(()=>assertMutationAllowed(method,url,{accountId}),/mutation_endpoint_forbidden/);
});

test('request adapter classifies 4xx definite and 5xx or malformed success as ambiguous without retry',async()=>{
  let calls=0;
  const rejected=createRequester({accountId:'account',token:'token',fetchImpl:async()=>{calls++;return new Response(JSON.stringify({success:false,errors:[]}),{status:400});}});
  await assert.rejects(()=>rejected('/accounts/account/workers/workers',{method:'POST',body:buildWorkerShellBody()}),MutationRejectedError);
  assert.equal(calls,1);
  calls=0;
  const server=createRequester({accountId:'account',token:'token',fetchImpl:async()=>{calls++;return new Response('{}',{status:503});}});
  await assert.rejects(()=>server('/accounts/account/workers/workers',{method:'POST',body:buildWorkerShellBody()}),MutationAmbiguousError);
  assert.equal(calls,1);
  calls=0;
  const malformed=createRequester({accountId:'account',token:'token',fetchImpl:async()=>{calls++;return new Response('not-json',{status:200});}});
  await assert.rejects(()=>malformed('/accounts/account/workers/workers',{method:'POST',body:buildWorkerShellBody()}),MutationAmbiguousError);
  assert.equal(calls,1);
});

test('definite shell rejection stops without reconciliation or retry',async()=>{
  let mutations=0,reads=0;
  await assert.rejects(()=>performShellCreate({accountId:'account',request:async()=>{mutations++;throw new MutationRejectedError();},readWorker:async()=>{reads++;return inertWorker();}}),MutationRejectedError);
  assert.deepEqual({mutations,reads},{mutations:1,reads:0});
});

test('ambiguous or malformed shell create never retries and requires exact inert read-only reconciliation',async()=>{
  let mutations=0,reads=0;
  const result=await performShellCreate({accountId:'account',request:async()=>{mutations++;throw new MutationAmbiguousError();},readWorker:async()=>{reads++;return inertWorker();}});
  assert.equal(result.disposition,'reconciled');assert.deepEqual({mutations,reads},{mutations:1,reads:1});
  mutations=0;reads=0;
  const malformed=await performShellCreate({accountId:'account',request:async()=>{mutations++;return {result:{name:WORKER_NAME}};},readWorker:async()=>{reads++;return inertWorker();}});
  assert.equal(malformed.disposition,'reconciled');assert.deepEqual({mutations,reads},{mutations:1,reads:1});
  await assert.rejects(()=>performShellCreate({accountId:'account',request:async()=>{throw new MutationAmbiguousError();},readWorker:async()=>null}),/shell_ambiguous_owner_review_required/);
});

test('ambiguous Version upload never retries and requires one exact new Version delta',async()=>{
  let mutations=0,reads=0;
  const result=await performVersionUpload({accountId:'account',multipart:new FormData(),beforeIds:[],request:async()=>{mutations++;throw new MutationAmbiguousError();},readVersions:async()=>{reads++;return [VERSION];}});
  assert.equal(result.disposition,'reconciled');assert.equal(result.versionId,VERSION);assert.deepEqual({mutations,reads},{mutations:1,reads:1});
  await assert.rejects(()=>performVersionUpload({accountId:'account',multipart:new FormData(),beforeIds:[],request:async()=>{throw new MutationAmbiguousError();},readVersions:async()=>[VERSION,'22222222-2222-4222-8222-222222222222']}),/ambiguous_owner_review_required/);
});

test('stable and Beta version readbacks prove runtime exact binding set no Preview URL and module bytes',()=>{
  assert.equal(validateStableVersionDetail(stableVersion(),{versionId:VERSION}),true);
  assert.equal(validateBetaVersionDetail(betaVersion(),{versionId:VERSION,approvedSha:SHA,identity}),true);
  const changed=betaVersion();changed.modules=changed.modules.map((row,index)=>index?row:{...row,content_base64:Buffer.from('changed').toString('base64')});
  assert.throws(()=>validateBetaVersionDetail(changed,{versionId:VERSION,approvedSha:SHA,identity}),/uploaded_module_hash_drift/);
});

test('postflight rejects Deployment Cron routability route domain secret or extra Version drift',()=>{
  assert.equal(validatePostflight(postflight()),true);
  const mutations=[
    x=>{x.deployments={deployments:[{id:'x'}]};},x=>{x.schedules={schedules:[{cron:'* * * * *'}]};},
    x=>{x.worker={...x.worker,subdomain:{enabled:true,previews_enabled:false}};},x=>{x.subdomain={enabled:false,previews_enabled:true};},
    x=>{x.scripts=[{id:WORKER_NAME,routes:[{id:'r'}]}];},x=>{x.domains=[{service:WORKER_NAME,hostname:'example.invalid'}];},
    x=>{x.stableVersion={...x.stableVersion,resources:{...x.stableVersion.resources,bindings:[...x.stableVersion.resources.bindings,{name:'API_FOOTBALL_API_KEY',type:'secret_text'}]}};},
    x=>{x.versionIds=[VERSION,'22222222-2222-4222-8222-222222222222'];}
  ];
  for(const mutate of mutations){const value=postflight();mutate(value);assert.throws(()=>validatePostflight(value));}
});

test('read-only closeout requires migrations mapping runtime and zero-history evidence unchanged',()=>{
  const report={
    reason:'repository_stage_inventory_unexpected',migrationCount:6,foreignKeyViolations:0,officialFplAuthority:{teamCount:20},
    mapping:{state:'COMMITTED',mappingCount:20,memberCount:20,distinctProviderIds:20,distinctFplIds:20,canonicalCoverageMatches:true,historicalAuthorityProvenancePresent:true},
    runtime:{collectionEnabled:0,credentialState:'UNPROVISIONED',activeLease:false},
    priorState:{requestAttempts:0,generations:0,fixtureRevisions:0,attempt2Count:0,reservedAttemptCount:0,stagingGenerationCount:0},
    modelUiImportCount:0,evidence:{productionMutations:0,apiFootballRequests:0,secretValuesRead:0}
  };
  assert.equal(validateReadOnlyCloseoutReport(report),true);
  assert.throws(()=>validateReadOnlyCloseoutReport({...report,priorState:{...report.priorState,requestAttempts:1}}),/closeout_history_drift/);
});

test('manual workflow is first-attempt exact-main exact-Verify gated before protected credentials',()=>{
  for(const expected of [/workflow_dispatch:/,/approved_sha:/,/github\.run_attempt == 1/,/refs\/heads\/main/,/test "\$EVENT_SHA" = "\$APPROVED_SHA"/,/git ls-remote/,/git status --porcelain/,/Tests and deterministic build/,/node-version: 24\.19\.0/,/persist-credentials: false/])assert.match(workflow,expected);
  assert.doesNotMatch(workflow,/^\s{2}(?:push|schedule|pull_request|pull_request_target|workflow_run|repository_dispatch|issue_comment):/m);
  const gate=workflow.indexOf('repository-gate:'),readonly=workflow.indexOf('fresh-readonly-admission:'),protectedJob=workflow.indexOf('protected-inactive-staging:'),closeout=workflow.indexOf('final-readonly-closeout:');
  assert.ok(gate>=0&&readonly>gate&&protectedJob>readonly&&closeout>protectedJob);
  assert.ok(workflow.indexOf('READY_FOR_REPOSITORY_INFRASTRUCTURE_STAGING')<workflow.indexOf('name: api-football-collector-version-upload'));
});

test('protected upload environment has dedicated upload credential and no provider secret',()=>{
  assert.match(workflow,/name: api-football-collector-version-upload/);
  assert.match(workflow,/CLOUDFLARE_COLLECTOR_WORKER_UPLOAD_TOKEN: \$\{\{ secrets\.CLOUDFLARE_COLLECTOR_WORKER_UPLOAD_TOKEN \}\}/);
  assert.match(workflow,/CLOUDFLARE_ACCOUNT_ID: \$\{\{ secrets\.CLOUDFLARE_ACCOUNT_ID \}\}/);
  assert.match(workflow,/CLOUDFLARE_ACCOUNT_FINGERPRINT: \$\{\{ vars\.CLOUDFLARE_ACCOUNT_FINGERPRINT \}\}/);
  assert.doesNotMatch(workflow,/API_FOOTBALL_API_KEY|OWNER_CROSSWALK|CLOUDFLARE_D1_WRITE_TOKEN|CLOUDFLARE_PHASE3_DEPLOY_TOKEN/);
});

test('staging helper and workflow contain no Deployment Cron secret route domain or D1 mutation primitive',()=>{
  const combined=helper+'\n'+workflow;
  assert.doesNotMatch(helper,/method:\s*['"](?:PUT|PATCH|DELETE)['"]/);
  assert.doesNotMatch(combined,/wrangler\s+(?:deploy|versions|triggers)|d1\s+execute|v3\.football\.api-sports\.io/);
  assert.doesNotMatch(helper,/\/deployments[^\n]{0,120}method:\s*['"]POST|\/schedules[^\n]{0,120}method:\s*['"](?:POST|PUT)|\/secrets[^\n]{0,120}method:\s*['"]POST/);
});

test('workflow invokes only staging and read-only executables and cannot dispatch sibling API-Football workflows',()=>{
  const executables=[...workflow.matchAll(/node\s+(workers\/[^\s]+\.mjs)/g)].map(row=>row[1]);
  assert.deepEqual([...new Set(executables)].sort(),[
    'workers/api-football-collector/activation-live-preflight.mjs',
    'workers/api-football-collector/stage-inactive-version.mjs'
  ]);
  assert.doesNotMatch(workflow,/gh\s+workflow\s+run|workflow_call|repository_dispatch|mapping-0006|migration-000[456]|owner-mapping|team-universe/);
});

test('production model and browser graph remains isolated from collector staging',()=>{
  assert.equal(productionModelUiImportCount(),0);
});
