import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {EXPECTED_D1_DATABASE_ID} from '../workers/data-platform/phase4b/live-contract.mjs';
import {productionModelUiImportCount} from '../workers/api-football-collector/activation-live-preflight.mjs';
import {
  REVIEWED_MODULE_PATHS,WORKER_NAME,COMPATIBILITY_DATE,EXPECTED_ACTIVATION,EXPECTED_FPL_SEASON,EXPECTED_PROVIDER_SEASON,
  MutationAmbiguousError,MutationRejectedError,assertMutationAllowed,buildUploadGraph,buildVersionMetadata,buildWorkerShellRequestBody,
  createCloudflareRequester,deterministicIdentity,performShellCreate,performVersionUpload,resolveRelativeModule,runInactiveVersionStaging,
  validatePostflightState,validateVersionDetail
} from '../workers/api-football-collector/inactive-version-staging.mjs';
import {validateReadOnlyD1Closeout} from '../workers/api-football-collector/inactive-version-closeout.mjs';

const root=path.resolve(import.meta.dirname,'..');
const helper=fs.readFileSync(path.join(root,'workers/api-football-collector/inactive-version-staging.mjs'),'utf8');
const closeout=fs.readFileSync(path.join(root,'workers/api-football-collector/inactive-version-closeout.mjs'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/api-football-collector-inactive-version-staging.yml'),'utf8');
const planner=fs.readFileSync(path.join(root,'workers/api-football-collector/planner-orchestrator.mjs'),'utf8');
const mappingRuntime=fs.readFileSync(path.join(root,'workers/api-football-collector/mapping-runtime.mjs'),'utf8');
const wrangler=fs.readFileSync(path.join(root,'workers/api-football-collector/wrangler.jsonc'),'utf8');
const SHA='a'.repeat(40);
const VERSION='11111111-1111-4111-8111-111111111111';
const WORKER_ID='worker-immutable-id';
const modules=buildUploadGraph();
const metadata=buildVersionMetadata(SHA);
const identity=deterministicIdentity(metadata,modules,SHA);
const inertWorker=()=>({
  id:WORKER_ID,name:WORKER_NAME,deployed_on:null,observability:{enabled:true},
  subdomain:{enabled:false,previews_enabled:false},references:{}
});
const versionDetail=()=>({
  id:VERSION,number:1,main_module:'collector.mjs',compatibility_date:COMPATIBILITY_DATE,urls:[],
  annotations:{'workers/tag':'api-football-collector-inactive-'+SHA.slice(0,12),'workers/message':'API-Football inactive staging from '+SHA,'workers/triggered_by':'upload'},
  bindings:[
    {name:'TEAMSHEET_DATA_DB',type:'d1',database_id:EXPECTED_D1_DATABASE_ID},
    {name:'API_FOOTBALL_FPL_SEASON',type:'plain_text',text:EXPECTED_FPL_SEASON},
    {name:'API_FOOTBALL_PROVIDER_SEASON',type:'plain_text',text:EXPECTED_PROVIDER_SEASON},
    {name:'EIA_2I5D_ACTIVATION',type:'plain_text',text:EXPECTED_ACTIVATION}
  ],
  modules:[...modules.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([name,source])=>({
    name,content_type:'application/javascript+module',content_base64:Buffer.from(source).toString('base64')
  })),
  package_dependencies:[]
});
const postflight=()=>({
  worker:inertWorker(),subdomain:{enabled:false,previews_enabled:false},deployments:{deployments:[]},schedules:{schedules:[]},
  domains:[],scripts:[{id:WORKER_NAME,routes:[]}],versionDetail:versionDetail(),versionIds:[VERSION],versionId:VERSION,approvedSha:SHA,identity
});

function jsonResponse(status,result,{success=status>=200&&status<300,text=null}={}){
  return new Response(text??JSON.stringify({success,result}),{status,headers:{'content-type':'application/json'}});
}

test('repository Wrangler remains blocked, unroutable and uncredentialed',()=>{
  const config=JSON.parse(wrangler);
  assert.equal(config.name,WORKER_NAME);assert.equal(config.main,'collector.mjs');assert.equal(config.compatibility_date,COMPATIBILITY_DATE);
  assert.equal(config.workers_dev,false);assert.equal(config.preview_urls,false);assert.deepEqual(config.triggers.crons,[]);
  assert.deepEqual(config.vars,{API_FOOTBALL_FPL_SEASON:'2026-27',API_FOOTBALL_PROVIDER_SEASON:'2026',EIA_2I5D_ACTIVATION:'REPOSITORY_ONLY_BLOCKED'});
  assert.equal(config.d1_databases[0].database_id,'00000000-0000-0000-0000-000000000000');
  assert.equal(JSON.stringify(config).includes('API_FOOTBALL_API_KEY'),false);
});

test('exact Worker shell request body disables workers.dev and Version previews before any Version',()=>{
  assert.deepEqual(buildWorkerShellRequestBody(),{name:WORKER_NAME,observability:{enabled:true},subdomain:{enabled:false,previews_enabled:false}});
});

test('first Version metadata has exact production D1 plus three plain-text bindings and zero secrets',()=>{
  assert.equal(metadata.main_module,'collector.mjs');assert.equal(metadata.compatibility_date,'2026-09-16');
  assert.deepEqual(metadata.bindings,[
    {name:'TEAMSHEET_DATA_DB',type:'d1',database_id:EXPECTED_D1_DATABASE_ID},
    {name:'API_FOOTBALL_FPL_SEASON',type:'plain_text',text:'2026-27'},
    {name:'API_FOOTBALL_PROVIDER_SEASON',type:'plain_text',text:'2026'},
    {name:'EIA_2I5D_ACTIVATION',type:'plain_text',text:'REPOSITORY_ONLY_BLOCKED'}
  ]);
  assert.equal(metadata.bindings.some(row=>row.type==='secret_text'||row.name==='API_FOOTBALL_API_KEY'),false);
  assert.equal(metadata.annotations['workers/message'],'API-Football inactive staging from '+SHA);
  assert.equal(metadata.annotations['workers/tag'],'api-football-collector-inactive-'+SHA.slice(0,12));
});

test('closed transitive module graph is exact, deterministic and excludes qualification/crosswalk construction code',()=>{
  assert.equal(modules.size,REVIEWED_MODULE_PATHS.length);
  assert.deepEqual([...modules.keys()].sort(),[...buildUploadGraph().keys()].sort());
  assert.equal(REVIEWED_MODULE_PATHS.includes('workers/api-football-collector/mapping-persistence.mjs'),false);
  assert.equal(REVIEWED_MODULE_PATHS.includes('src/decision-intelligence/api-football-owner-mapping.mjs'),false);
  assert.equal(REVIEWED_MODULE_PATHS.includes('src/decision-intelligence/api-football-prelive-qualification.mjs'),false);
  assert.match(planner,/from '\.\/mapping-runtime\.mjs'/);
  assert.doesNotMatch(mappingRuntime,/api-football-owner-mapping|issueOwnerApprovedTwentyClubMappings|providerEntityId!=='49'|providerEntityId!=='63'/);
  for(const [name,source] of modules){
    assert.match(name,/^[A-Za-z0-9._-]+\.mjs$/);
    assert.doesNotMatch(source,/\b(?:import|export)\s+[^;]*?from\s*['"](?:https?:|npm:|node:|[^'"]*node_modules\/)/);
  }
});

test('module resolver rejects remote, npm, node, node_modules, non-relative and escaping imports',()=>{
  for(const specifier of ['https://example.com/x.mjs','http://example.com/x.mjs','npm:x','node:fs','pkg','./node_modules/x.mjs','../../../escape.mjs']){
    assert.throws(()=>resolveRelativeModule('workers/api-football-collector/collector.mjs',specifier),/external_module_dependency|unresolved_module/);
  }
});

test('graph resolver fails closed on unresolved or unreviewed transitive imports',()=>{
  const unresolved=file=>{
    if(file==='workers/api-football-collector/collector.mjs')return "import './missing.mjs';";
    throw new Error('missing');
  };
  assert.throws(()=>buildUploadGraph(unresolved),/unresolved_module/);
  const unreviewed=file=>file==='workers/api-football-collector/collector.mjs'?"import './extra.mjs';":'';
  assert.throws(()=>buildUploadGraph(unreviewed),/unreviewed_module/);
});

test('module and metadata hashes deterministically bind every uploaded byte to the exact approved SHA',()=>{
  const again=deterministicIdentity(buildVersionMetadata(SHA),buildUploadGraph(),SHA);
  assert.deepEqual(again,identity);
  assert.match(identity.metadataSha256,/^[0-9a-f]{64}$/);assert.match(identity.graphSha256,/^[0-9a-f]{64}$/);
  assert.equal(Object.keys(identity.modules).length,modules.size);
  for(const value of Object.values(identity.modules))assert.match(value,/^[0-9a-f]{64}$/);
  assert.notEqual(deterministicIdentity(buildVersionMetadata('b'.repeat(40)),modules,'b'.repeat(40)).graphSha256,identity.graphSha256);
});

test('mutation allowlist permits only one shell-create path and one inactive-Version upload path',()=>{
  const account='acct';
  assert.equal(assertMutationAllowed('POST','/accounts/acct/workers/workers',account),true);
  assert.equal(assertMutationAllowed('POST','/accounts/acct/workers/scripts/'+WORKER_NAME+'/versions',account),true);
  for(const [method,pathValue] of [
    ['POST','/accounts/acct/workers/scripts/'+WORKER_NAME+'/deployments'],
    ['PUT','/accounts/acct/workers/scripts/'+WORKER_NAME+'/schedules'],
    ['POST','/accounts/acct/workers/scripts/'+WORKER_NAME+'/secrets'],
    ['PUT','/accounts/acct/workers/domains'],['POST','/accounts/acct/access/apps'],
    ['POST','/accounts/acct/d1/database/x/query'],['DELETE','/accounts/acct/workers/scripts/'+WORKER_NAME]
  ])assert.throws(()=>assertMutationAllowed(method,pathValue,account),/mutation_endpoint_forbidden/);
});

test('Cloudflare mutation transport classifies definite 4xx separately from ambiguous 5xx, network and malformed success',async()=>{
  const pathValue='/accounts/acct/workers/workers';
  const rejected=createCloudflareRequester({accountId:'acct',token:'t',fetchImpl:async()=>jsonResponse(400,null,{success:false})});
  await assert.rejects(()=>rejected(pathValue,{method:'POST',body:{}}),MutationRejectedError);
  const server=createCloudflareRequester({accountId:'acct',token:'t',fetchImpl:async()=>jsonResponse(503,null,{success:false})});
  await assert.rejects(()=>server(pathValue,{method:'POST',body:{}}),MutationAmbiguousError);
  const network=createCloudflareRequester({accountId:'acct',token:'t',fetchImpl:async()=>{throw new Error('lost');}});
  await assert.rejects(()=>network(pathValue,{method:'POST',body:{}}),MutationAmbiguousError);
  const malformed=createCloudflareRequester({accountId:'acct',token:'t',fetchImpl:async()=>jsonResponse(200,null,{text:'not-json'})});
  await assert.rejects(()=>malformed(pathValue,{method:'POST',body:{}}),MutationAmbiguousError);
});

test('definite shell rejection stops after one mutation and performs no reconciliation read',async()=>{
  let mutations=0,reads=0;
  await assert.rejects(()=>performShellCreate({accountId:'acct',request:async()=>{mutations++;throw new MutationRejectedError();},readWorker:async()=>{reads++;return inertWorker();}}),MutationRejectedError);
  assert.deepEqual({mutations,reads},{mutations:1,reads:0});
});

test('ambiguous shell create never retries and continues only after exact inert reconciliation',async()=>{
  let mutations=0,reads=0;
  const result=await performShellCreate({accountId:'acct',request:async()=>{mutations++;throw new MutationAmbiguousError();},readWorker:async()=>{reads++;return inertWorker();}});
  assert.equal(result.disposition,'reconciled');assert.deepEqual({mutations,reads},{mutations:1,reads:1});
  await assert.rejects(()=>performShellCreate({accountId:'acct',request:async()=>{throw new MutationAmbiguousError();},readWorker:async()=>null}),/ambiguous_owner_review_required/);
});

test('definite Version rejection stops after one upload and performs no reconciliation read',async()=>{
  let mutations=0,reads=0;
  await assert.rejects(()=>performVersionUpload({accountId:'acct',multipart:new FormData(),beforeIds:[],request:async()=>{mutations++;throw new MutationRejectedError();},readVersions:async()=>{reads++;return [VERSION];}}),MutationRejectedError);
  assert.deepEqual({mutations,reads},{mutations:1,reads:0});
});

test('ambiguous Version upload never retries and resolves only one new Version by read-only delta',async()=>{
  let mutations=0,reads=0;
  const result=await performVersionUpload({accountId:'acct',multipart:new FormData(),beforeIds:[],request:async()=>{mutations++;throw new MutationAmbiguousError();},readVersions:async()=>{reads++;return [VERSION];}});
  assert.equal(result.disposition,'reconciled');assert.equal(result.versionId,VERSION);assert.deepEqual({mutations,reads},{mutations:1,reads:1});
  await assert.rejects(()=>performVersionUpload({accountId:'acct',multipart:new FormData(),beforeIds:[],request:async()=>{throw new MutationAmbiguousError();},readVersions:async()=>[VERSION,'22222222-2222-4222-8222-222222222222']}),/ambiguous_owner_review_required/);
});

test('uploaded Version readback proves exact runtime, bindings, zero routable URLs and every module hash',()=>{
  assert.equal(validateVersionDetail(versionDetail(),{versionId:VERSION,approvedSha:SHA,identity}),true);
  const changed=versionDetail();changed.modules=changed.modules.map((row,index)=>index?row:{...row,content_base64:Buffer.from('changed').toString('base64')});
  assert.throws(()=>validateVersionDetail(changed,{versionId:VERSION,approvedSha:SHA,identity}),/module_hash_drift/);
});

test('postflight fails closed on Deployment, Cron, workers.dev, previews, routes, domains, secrets or extra Versions',()=>{
  assert.equal(validatePostflightState(postflight()),true);
  const cases=[
    value=>{value.deployments={deployments:[{id:'x'}]};},
    value=>{value.schedules={schedules:[{cron:'* * * * *'}]};},
    value=>{value.worker={...value.worker,subdomain:{enabled:true,previews_enabled:false}};},
    value=>{value.subdomain={enabled:false,previews_enabled:true};},
    value=>{value.scripts=[{id:WORKER_NAME,routes:[{id:'r'}]}];},
    value=>{value.domains=[{service:WORKER_NAME,hostname:'example.com'}];},
    value=>{value.versionDetail={...value.versionDetail,bindings:[...value.versionDetail.bindings,{name:'API_FOOTBALL_API_KEY',type:'secret_text'}]};},
    value=>{value.versionIds=[VERSION,'22222222-2222-4222-8222-222222222222'];}
  ];
  for(const mutate of cases){const value=postflight();mutate(value);assert.throws(()=>validatePostflightState(value));}
});

test('staging executable has no provider egress, D1 request, deployment/Cron/secret/domain mutation or cleanup primitive',()=>{
  assert.doesNotMatch(helper,/v3\.football\.api-sports\.io|fantasy\.premierleague\.com\/api/);
  assert.doesNotMatch(helper,/\/d1\/database/);
  assert.doesNotMatch(helper,/method:\s*['"](?:PUT|PATCH|DELETE)['"]/);
  assert.doesNotMatch(helper,/wrangler\s+(?:deploy|versions|triggers)|deleteVersion|automatic cleanup/i);
  assert.match(helper,/cloudflareMutationPrimitives:2/);
});

test('bad protected account fingerprint fails before graph reads or any Cloudflare request',async()=>{
  let reads=0,fetches=0;
  await assert.rejects(()=>runInactiveVersionStaging({
    env:{CLOUDFLARE_COLLECTOR_WORKER_UPLOAD_TOKEN:'t',CLOUDFLARE_ACCOUNT_ID:'acct',CLOUDFLARE_ACCOUNT_FINGERPRINT:'0'.repeat(64),APPROVED_SHA:SHA},
    readFile:()=>{reads++;return '';},fetchImpl:async()=>{fetches++;throw new Error('must not fetch');}
  }),/account_identity_mismatch/);
  assert.deepEqual({reads,fetches},{reads:0,fetches:0});
});

test('manual workflow is first-attempt exact-main exact-Verify gated before either protected environment',()=>{
  for(const expected of [/workflow_dispatch:/,/approved_sha:/,/github\.run_attempt == 1/,/refs\/heads\/main/,/test "\$EVENT_SHA" = "\$APPROVED_SHA"/,/git ls-remote/,/git status --porcelain/,/Tests and deterministic build/,/node-version: 24\.19\.0/,/persist-credentials: false/])assert.match(workflow,expected);
  assert.doesNotMatch(workflow,/^\s{2}(?:push|schedule|pull_request|pull_request_target|workflow_run|repository_dispatch|issue_comment):/m);
  assert.doesNotMatch(workflow,/uses:\s+[^\s]+@v\d+/);
  const gate=workflow.indexOf('repository-gate:'),readonly=workflow.indexOf('fresh-readonly-admission:'),protectedJob=workflow.indexOf('protected-inactive-staging:'),closeoutJob=workflow.indexOf('final-readonly-closeout:');
  assert.ok(gate>=0&&readonly>gate&&protectedJob>readonly&&closeoutJob>protectedJob);
  assert.ok(workflow.indexOf("report.classification!=='READY_FOR_REPOSITORY_INFRASTRUCTURE_STAGING'")<workflow.indexOf('environment:\n      name: api-football-collector-version-upload'));
});

test('workflow credentials are isolated and the protected staging environment has no provider credential',()=>{
  assert.match(workflow,/environment:\s*\n\s*name: data-steward-readonly/);
  assert.match(workflow,/environment:\s*\n\s*name: api-football-collector-version-upload/);
  assert.match(workflow,/CLOUDFLARE_COLLECTOR_WORKER_UPLOAD_TOKEN: \$\{\{ secrets\.CLOUDFLARE_COLLECTOR_WORKER_UPLOAD_TOKEN \}\}/);
  assert.match(workflow,/CLOUDFLARE_ACCOUNT_ID: \$\{\{ secrets\.CLOUDFLARE_ACCOUNT_ID \}\}/);
  assert.match(workflow,/CLOUDFLARE_ACCOUNT_FINGERPRINT: \$\{\{ vars\.CLOUDFLARE_ACCOUNT_FINGERPRINT \}\}/);
  assert.doesNotMatch(workflow,/API_FOOTBALL_API_KEY|OWNER_CROSSWALK|CLOUDFLARE_D1_WRITE_TOKEN|CLOUDFLARE_PHASE3_DEPLOY_TOKEN|DATA_S1_HTTP_AUTH_TOKEN|CF_ACCESS_CLIENT/);
});

test('workflow invokes only the staging admission, staging helper and independent closeout, with no workflow chaining',()=>{
  const executables=[...workflow.matchAll(/node\s+(workers\/[^\s]+\.mjs)/g)].map(row=>row[1]);
  assert.deepEqual([...new Set(executables)].sort(),[
    'workers/api-football-collector/activation-live-preflight.mjs',
    'workers/api-football-collector/inactive-version-closeout.mjs',
    'workers/api-football-collector/inactive-version-staging.mjs'
  ]);
  assert.doesNotMatch(workflow,/gh\s+workflow\s+run|mapping-0006|migration-000[456]|owner-mapping|team-universe|wrangler\s+deploy/);
});

test('independent closeout accepts only unchanged D1/runtime/model evidence plus the intentional collector inventory transition',()=>{
  const report={
    reason:'repository_stage_inventory_unexpected',migrationCount:6,foreignKeyViolations:0,
    officialFplAuthority:{teamCount:20},
    mapping:{state:'COMMITTED',mappingCount:20,memberCount:20,distinctProviderIds:20,distinctFplIds:20,canonicalCoverageMatches:true,historicalAuthorityProvenancePresent:true},
    runtime:{collectionEnabled:0,credentialState:'UNPROVISIONED',activeLease:false},
    priorState:{requestAttempts:0,generations:0,fixtureRevisions:0,attempt2Count:0,reservedAttemptCount:0,stagingGenerationCount:0},
    modelUiImportCount:0,evidence:{productionMutations:0,apiFootballRequests:0,secretValuesRead:0}
  };
  assert.equal(validateReadOnlyD1Closeout(report),true);
  assert.throws(()=>validateReadOnlyD1Closeout({...report,priorState:{...report.priorState,requestAttempts:1}}),/history_drift/);
  assert.doesNotMatch(closeout,/method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/);
});

test('production model and browser graph remains isolated from collector staging',()=>{
  assert.equal(productionModelUiImportCount(),0);
});
