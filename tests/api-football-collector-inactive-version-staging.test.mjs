import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import {EXPECTED_D1_DATABASE_ID} from '../workers/data-platform/phase4b/live-contract.mjs';
import {
  API_BASE,COMPATIBILITY_DATE,ENTRY_MODULE,MODULE_PATHS,PLAIN_TEXT,SHELL_BODY,WORKER_NAME,
  assertMutation,buildMetadata,deterministicIdentity,resolveModuleGraph,runInactiveVersionStaging
} from '../workers/api-football-collector/inactive-version-staging.mjs';

const ACCOUNT='synthetic-production-account';
const TOKEN='synthetic-upload-token';
const SHA='0123456789abcdef0123456789abcdef01234567';
const FINGERPRINT=createHash('sha256').update(ACCOUNT).digest('hex');
const WORKER_ID='worker-inert-1',VERSION_ID='version-inactive-1';

function env(){return {
  CLOUDFLARE_COLLECTOR_WORKER_UPLOAD_TOKEN:TOKEN,
  CLOUDFLARE_ACCOUNT_ID:ACCOUNT,
  CLOUDFLARE_ACCOUNT_FINGERPRINT:FINGERPRINT,
  APPROVED_SHA:SHA
};}
function json(result,status=200,success=status>=200&&status<300){
  return new Response(JSON.stringify({success,result}),{status,headers:{'content-type':'application/json'}});
}
function notFound(){return json(null,404,false);}
function worker(){return {
  id:WORKER_ID,name:WORKER_NAME,observability:{enabled:true},
  subdomain:{enabled:false,previews_enabled:false},deployed_on:null
};}
function versionDetail({modules=true}={}){
  const sources=resolveModuleGraph();
  const detail={
    id:VERSION_ID,main_module:ENTRY_MODULE,compatibility_date:COMPATIBILITY_DATE,
    annotations:{'workers/tag':'api-football-collector-inactive-'+SHA.slice(0,12)},
    urls:[],package_dependencies:[],
    bindings:buildMetadata(SHA).bindings
  };
  if(modules)detail.modules=[...sources].map(([name,source])=>({
    name,content_type:'application/javascript+module',
    content_base64:Buffer.from(source).toString('base64')
  }));
  return detail;
}
function fakeCloudflare({shellAmbiguous=false,versionAmbiguous=false,shellReject=false}={}){
  let shell=false,version=false,shellPosts=0,versionPosts=0;
  const calls=[];
  const fetchImpl=async(url,init={})=>{
    const value=String(url),path=value.slice(API_BASE.length),method=init.method||'GET';
    calls.push({path,method,body:init.body});
    const beta='/accounts/'+ACCOUNT+'/workers/workers';
    const script='/accounts/'+ACCOUNT+'/workers/scripts/'+WORKER_NAME;
    if(method==='GET'&&path.startsWith(beta+'?')){
      return json(shell?[worker()]:[]);
    }
    if(method==='POST'&&path===beta){
      shellPosts++;
      assert.deepEqual(JSON.parse(String(init.body)),SHELL_BODY);
      if(shellReject)return json(null,409,false);
      shell=true;
      if(shellAmbiguous)throw new Error('transport lost after create');
      return json(worker());
    }
    if(method==='GET'&&path===beta+'/'+WORKER_ID)return shell?json(worker()):notFound();
    if(method==='GET'&&path===script+'/schedules')return shell?json({schedules:[]}):notFound();
    if(method==='GET'&&path===script+'/deployments')return shell?json([]):notFound();
    if(method==='GET'&&path===script+'/versions?deployable=true&per_page=100')return shell?json(version?{items:[{id:VERSION_ID}]}:{items:[]}):notFound();
    if(method==='GET'&&path==='/accounts/'+ACCOUNT+'/workers/domains')return json([]);
    if(method==='POST'&&path===script+'/versions'){
      versionPosts++;
      assert.equal(path.includes('bindings_inherit'),false);
      assert.ok(init.body instanceof FormData);
      const metadata=JSON.parse(await init.body.get('metadata').text());
      assert.deepEqual(metadata,buildMetadata(SHA));
      assert.equal([...init.body.keys()].filter(name=>name!=='metadata').length,MODULE_PATHS.length);
      version=true;
      if(versionAmbiguous)throw new Error('transport lost after upload');
      return json({id:VERSION_ID});
    }
    if(method==='GET'&&path===script+'/subdomain')return json({enabled:false,previews_enabled:false});
    if(method==='GET'&&path===beta+'/'+WORKER_ID+'/versions/'+VERSION_ID+'?include=modules')return json(versionDetail({modules:true}));
    if(method==='GET'&&path===script+'/versions/'+VERSION_ID)return json(versionDetail({modules:false}));
    throw new Error('unexpected request '+method+' '+path);
  };
  return {fetchImpl,calls,getCounts:()=>({shellPosts,versionPosts})};
}

test('shell and first Version contracts are exact and secret-free',()=>{
  assert.deepEqual(SHELL_BODY,{
    name:WORKER_NAME,observability:{enabled:true},
    subdomain:{enabled:false,previews_enabled:false}
  });
  const metadata=buildMetadata(SHA);
  assert.equal(metadata.main_module,ENTRY_MODULE);
  assert.equal(metadata.compatibility_date,'2026-09-16');
  assert.equal(metadata.bindings.length,4);
  assert.deepEqual(metadata.bindings[0],{name:'TEAMSHEET_DATA_DB',type:'d1',database_id:EXPECTED_D1_DATABASE_ID});
  assert.deepEqual(Object.fromEntries(metadata.bindings.slice(1).map(row=>[row.name,row.text])),PLAIN_TEXT);
  assert.equal(metadata.bindings.some(row=>row.type==='secret_text'||row.name==='API_FOOTBALL_API_KEY'),false);
  assert.equal(metadata.annotations['workers/commit_sha'],SHA);
  assert.equal(metadata.annotations['workers/tag'],'api-football-collector-inactive-'+SHA.slice(0,12));
});

test('collector upload graph is closed, deterministic and exactly nineteen repository modules',()=>{
  const first=resolveModuleGraph(),second=resolveModuleGraph();
  assert.equal(first.size,19);
  assert.deepEqual([...first.keys()],[...MODULE_PATHS]);
  assert.deepEqual(deterministicIdentity(buildMetadata(SHA),first),deterministicIdentity(buildMetadata(SHA),second));
  for(const source of first.values()){
    assert.doesNotMatch(source,/\bimport\s*\(/);
    assert.doesNotMatch(source,/\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"](?:https?:|npm:|node:|[^./][^'"]*)['"]/);
  }
});

test('graph validation rejects external, dynamic, unresolved and unreviewed dependencies',()=>{
  const base=new Map(resolveModuleGraph());
  const load=repoPath=>{
    if(repoPath===ENTRY_MODULE)return base.get(repoPath)+"\nimport x from 'npm:x';\n";
    return base.get(repoPath);
  };
  assert.throws(()=>resolveModuleGraph({load}),/staging_external_import_forbidden/);
  const dynamic=repoPath=>repoPath===ENTRY_MODULE?base.get(repoPath)+"\nimport('./runtime-contracts.mjs');\n":base.get(repoPath);
  assert.throws(()=>resolveModuleGraph({load:dynamic}),/staging_dynamic_import_forbidden/);
  const missing=repoPath=>{if(repoPath.endsWith('runtime-contracts.mjs'))throw new Error('missing');return base.get(repoPath);};
  assert.throws(()=>resolveModuleGraph({load:missing}),/staging_module_unresolved/);
});

test('mutation allowlist admits only shell creation and inactive Version upload',()=>{
  const beta='/accounts/'+ACCOUNT+'/workers/workers';
  const script='/accounts/'+ACCOUNT+'/workers/scripts/'+WORKER_NAME;
  assert.equal(assertMutation('POST',beta,ACCOUNT),true);
  assert.equal(assertMutation('POST',script+'/versions',ACCOUNT),true);
  for(const request of [
    ['POST',script+'/deployments'],['POST',script+'/schedules'],['PUT',script+'/settings'],
    ['POST',script+'/secrets'],['DELETE',script],['POST','/accounts/'+ACCOUNT+'/d1/database/x/query']
  ])assert.throws(()=>assertMutation(request[0],request[1],ACCOUNT),/staging_mutation_endpoint_forbidden/);
});

test('successful staging performs exactly one shell create and one Version upload with no other mutation',async()=>{
  const fake=fakeCloudflare();
  const report=await runInactiveVersionStaging({env:env(),fetchImpl:fake.fetchImpl});
  assert.equal(report.ok,true);
  assert.equal(report.workerId,WORKER_ID);
  assert.equal(report.versionId,VERSION_ID);
  assert.deepEqual(fake.getCounts(),{shellPosts:1,versionPosts:1});
  const mutations=fake.calls.filter(call=>call.method!=='GET');
  assert.deepEqual(mutations.map(call=>call.path),[
    '/accounts/'+ACCOUNT+'/workers/workers',
    '/accounts/'+ACCOUNT+'/workers/scripts/'+WORKER_NAME+'/versions'
  ]);
  assert.deepEqual(report.mutations,{
    workerShellCreates:1,versionUploads:1,deployments:0,cronMutations:0,
    secretMutations:0,d1Mutations:0,routeMutations:0,providerRequests:0
  });
});

test('ambiguous shell creation reconciles read-only and never repeats the create',async()=>{
  const fake=fakeCloudflare({shellAmbiguous:true});
  const report=await runInactiveVersionStaging({env:env(),fetchImpl:fake.fetchImpl});
  assert.equal(report.ok,true);
  assert.deepEqual(fake.getCounts(),{shellPosts:1,versionPosts:1});
});

test('ambiguous Version upload reconciles the exact candidate and never repeats the upload',async()=>{
  const fake=fakeCloudflare({versionAmbiguous:true});
  const report=await runInactiveVersionStaging({env:env(),fetchImpl:fake.fetchImpl});
  assert.equal(report.ok,true);
  assert.deepEqual(fake.getCounts(),{shellPosts:1,versionPosts:1});
});

test('definite shell rejection stops with no retry and no Version upload',async()=>{
  const fake=fakeCloudflare({shellReject:true});
  await assert.rejects(()=>runInactiveVersionStaging({env:env(),fetchImpl:fake.fetchImpl}),/staging_shell_rejected_http_409/);
  assert.deepEqual(fake.getCounts(),{shellPosts:1,versionPosts:0});
});

test('wrong production account fingerprint stops before any Cloudflare request',async()=>{
  let calls=0;
  await assert.rejects(()=>runInactiveVersionStaging({
    env:{...env(),CLOUDFLARE_ACCOUNT_FINGERPRINT:'0'.repeat(64)},
    fetchImpl:async()=>{calls++;throw new Error('must not fetch');}
  }),/staging_account_identity_mismatch/);
  assert.equal(calls,0);
});

test('workflow keeps repository admission before upload credentials and exposes no provider secret',()=>{
  const workflow=fs.readFileSync('.github/workflows/api-football-collector-inactive-version-staging.yml','utf8');
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/github\.run_attempt == 1/);
  assert.match(workflow,/refs\/heads\/main/);
  assert.match(workflow,/Tests and deterministic build/);
  assert.match(workflow,/READY_FOR_REPOSITORY_INFRASTRUCTURE_STAGING/);
  assert.match(workflow,/name: api-football-collector-version-upload/);
  assert.match(workflow,/CLOUDFLARE_COLLECTOR_WORKER_UPLOAD_TOKEN/);
  assert.match(workflow,/DATA_STEWARD_CLOUDFLARE_READ_TOKEN/);
  assert.doesNotMatch(workflow,/API_FOOTBALL_API_KEY|OWNER_CROSSWALK|CLOUDFLARE_PHASE3_DEPLOY_TOKEN/);
  assert.doesNotMatch(workflow,/^\s{2}(?:push|pull_request|schedule):/m);
  const repository=workflow.indexOf('repository-gate:');
  const admission=workflow.indexOf('fresh-readonly-admission:');
  const staging=workflow.indexOf('inactive-staging:');
  assert.ok(repository>0&&repository<admission&&admission<staging);
  assert.doesNotMatch(workflow.slice(repository,admission),/CLOUDFLARE_COLLECTOR_WORKER_UPLOAD_TOKEN|environment:\s*\n\s*name: api-football-collector-version-upload/);
});

test('staging executable has no provider origin or forbidden mutation primitive',()=>{
  const source=fs.readFileSync('workers/api-football-collector/inactive-version-staging.mjs','utf8');
  assert.doesNotMatch(source,/v3\.football\.api-sports\.io/);
  assert.doesNotMatch(source,/\bwrangler\s+(?:deploy|versions\s+deploy|secret|triggers)/i);
  assert.doesNotMatch(source,/['"]POST['"][^\n]*(?:deployments|schedules|secrets|routes|domains|d1\/database)/i);
});
