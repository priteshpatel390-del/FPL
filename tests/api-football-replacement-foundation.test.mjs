import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {expectedAttendedBindings} from '../workers/api-football-collector/attended-version.mjs';
import {buildUploadModules,resolveModuleGraph} from '../workers/api-football-collector/stage-inactive-version.mjs';
import {
  GATE_C_CLONE_VERSION_ID,ORIGINAL_COLLECTOR,ORIGINAL_COLLECTOR_ID,ORIGINAL_VERSION_IDS,REPLACEMENT_COLLECTOR,
  REPLACEMENT_MUTATION_CEILINGS,buildReplacementIdentity,buildReplacementShellBody,buildReplacementUploadForm,
  replacementMutationKind,replacementPaths,runReplacementFoundation,validateReplacementProbe,validateReplacementReconciliation
} from '../workers/api-football-collector/replacement-foundation.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ACCOUNT='account-123',SHA='d'.repeat(40),FINGERPRINT=createHash('sha256').update(ACCOUNT).digest('hex');
const REPLACEMENT_ID='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',VERSION_ID='33333333-3333-4333-8333-333333333333';
const READ_TOKEN='read-token',MUTATION_TOKEN='mutation-token',API_KEY='synthetic-provider-key',TRIGGER='t'.repeat(40);
const env={CLOUDFLARE_ACCOUNT_ID:ACCOUNT,CLOUDFLARE_ACCOUNT_FINGERPRINT:FINGERPRINT,APPROVED_SHA:SHA,
  CLOUDFLARE_REPLACEMENT_READ_TOKEN:READ_TOKEN,CLOUDFLARE_REPLACEMENT_MUTATION_TOKEN:MUTATION_TOKEN,
  API_FOOTBALL_API_KEY:API_KEY,API_FOOTBALL_ATTENDED_TRIGGER_SECRET:TRIGGER};
const API='https://api.cloudflare.com/client/v4';
const ok=result=>new Response(JSON.stringify({success:true,result}),{status:200,headers:{'content-type':'application/json'}});
const workerRejection=()=>new Response('Not found',{status:404,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});

function fixtures(){
  const identity=buildReplacementIdentity(SHA),modules=buildUploadModules(resolveModuleGraph());
  return {identity,
    stable:{id:VERSION_ID,resources:{script_runtime:{compatibility_date:identity.compatibilityDate},bindings:structuredClone(expectedAttendedBindings())}},
    beta:{id:VERSION_ID,main_module:identity.mainModule,compatibility_date:identity.compatibilityDate,
      annotations:{'workers/message':identity.message,'workers/tag':identity.tag},
      modules:[...modules].map(([name,source])=>({name,content_base64:Buffer.from(source).toString('base64')}))}};
}

function fakeCloudflare({route=true,wrongShell=false,ambiguousShell=false}={}){
  const paths=replacementPaths(ACCOUNT),fx=fixtures();
  const state={replacement:false,preview:false,version:false,calls:[],shellPosts:0,versionPosts:0,disablePosts:0};
  const original={id:ORIGINAL_COLLECTOR_ID,name:ORIGINAL_COLLECTOR,subdomain:{enabled:false,previews_enabled:false}};
  const replacement=()=>({id:REPLACEMENT_ID,name:REPLACEMENT_COLLECTOR,deployed_on:null,subdomain:{enabled:false,previews_enabled:wrongShell?false:state.preview}});
  const scripts=()=>[{id:ORIGINAL_COLLECTOR,modified_on:'2026-09-29T20:57:49Z',routes:[]},...(state.replacement?[{id:REPLACEMENT_COLLECTOR,modified_on:'2026-09-30T00:00:00Z',routes:[]}]:[])];
  const fetchImpl=async(url,init={})=>{
    const method=(init.method||'GET').toUpperCase();state.calls.push({url:String(url),method,headers:init.headers,body:init.body});
    const parsed=new URL(url);
    if(parsed.hostname.endsWith('.workers.dev'))return route?workerRejection():new Response('platform',{status:404,headers:{'content-type':'text/html'}});
    assert.ok(String(url).startsWith(API));const full=String(url).slice(API.length),p=full.split('?')[0];
    if(method==='GET'){
      if(full===paths.betaWorkers)return ok([original,...(state.replacement?[replacement()]:[])]);
      if(p===paths.scripts)return ok(scripts());
      if(p===paths.domains)return ok([]);
      if(p===paths.accountSubdomain)return ok({subdomain:'fpltsheet'});
      if(p===paths.originalSubdomain)return ok({enabled:false,previews_enabled:false});
      if(p===paths.originalDeployments)return ok({deployments:[]});
      if(p===paths.originalSchedules)return ok({schedules:[]});
      if(full===paths.originalVersions)return ok({items:ORIGINAL_VERSION_IDS.map(id=>({id}))});
      if(p===paths.replacementSubdomain)return state.replacement?ok({enabled:false,previews_enabled:state.preview}):new Response(JSON.stringify({success:false}),{status:404});
      if(p===paths.replacementDeployments)return state.replacement?ok({deployments:[]}):new Response(JSON.stringify({success:false}),{status:404});
      if(p===paths.replacementSchedules)return state.replacement?ok({schedules:[]}):new Response(JSON.stringify({success:false}),{status:404});
      if(full===paths.replacementVersions)return state.replacement?ok({items:state.version?[{id:VERSION_ID}]:[]}):new Response(JSON.stringify({success:false}),{status:404});
      if(p===paths.replacement+'/'+VERSION_ID)return ok(fx.stable);
      if(full===paths.createShell+'/'+REPLACEMENT_ID+'/versions/'+VERSION_ID+'?include=modules')return ok(fx.beta);
      if(p===paths.createShell+'/'+REPLACEMENT_ID+'/versions/'+VERSION_ID)return ok({id:VERSION_ID,urls:['https://'+VERSION_ID.slice(0,8)+'-'+REPLACEMENT_COLLECTOR+'.fpltsheet.workers.dev']});
    }
    if(method==='POST'&&p===paths.createShell){
      state.shellPosts++;const body=JSON.parse(init.body);assert.deepEqual(body,buildReplacementShellBody());state.replacement=true;state.preview=!wrongShell;
      if(ambiguousShell)return new Response('bad gateway',{status:502});
      return ok(replacement());
    }
    if(method==='POST'&&p===paths.replacementUpload){state.versionPosts++;state.version=true;return ok({id:VERSION_ID});}
    if(method==='POST'&&p===paths.replacementSubdomain){state.disablePosts++;const body=JSON.parse(init.body);assert.deepEqual(body,{enabled:false,previews_enabled:false});state.preview=false;return ok(body);}
    throw new Error('unexpected '+method+' '+full);
  };
  return {state,fetchImpl,fx};
}

test('replacement identity and initial shell provisioning are permanent closed constants',()=>{
  assert.notEqual(REPLACEMENT_COLLECTOR,ORIGINAL_COLLECTOR);
  assert.equal(REPLACEMENT_COLLECTOR,'teamsheet-api-football-shadow-collector-v2');
  assert.deepEqual(buildReplacementShellBody(),{name:REPLACEMENT_COLLECTOR,observability:{enabled:true},subdomain:{enabled:false,previews_enabled:true}});
  assert.deepEqual(REPLACEMENT_MUTATION_CEILINGS,{createShell:1,uploadVersion:1,disablePreview:1});
  const form=buildReplacementUploadForm(SHA,{apiKey:API_KEY,triggerSecret:TRIGGER});
  const metadata=JSON.parse(form.get('metadata'));
  assert.equal(metadata.bindings.filter(row=>row.type==='secret_text').length,2);
  assert.deepEqual(metadata.bindings.filter(row=>row.type==='secret_text').map(row=>row.name),['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET']);
  assert.equal(metadata.bindings.find(row=>row.name==='EIA_2I5D_ACTIVATION').text,'ATTENDED_ONE_SHOT_DISCOVERY');
  assert.ok(!JSON.stringify(metadata).includes(ORIGINAL_COLLECTOR));
});

test('mutation allowlist permits only candidate creation upload and final Preview disable',()=>{
  const paths=replacementPaths(ACCOUNT);
  assert.equal(replacementMutationKind('POST',paths.createShell,{accountId:ACCOUNT,body:buildReplacementShellBody()}),'createShell');
  assert.equal(replacementMutationKind('POST',paths.replacementUpload,{accountId:ACCOUNT}),'uploadVersion');
  assert.equal(replacementMutationKind('POST',paths.replacementSubdomain,{accountId:ACCOUNT,body:{enabled:false,previews_enabled:false}}),'disablePreview');
  for(const [method,p,body] of [
    ['POST',paths.originalSubdomain,{enabled:false,previews_enabled:true}],['POST',paths.original+'/versions'],['POST',paths.originalDeployments],
    ['DELETE',paths.original],['POST',paths.replacementDeployments],['POST',paths.replacementSchedules],['POST',paths.domains],
    ['POST','/accounts/'+ACCOUNT+'/access/apps'],['POST','/accounts/'+ACCOUNT+'/d1/database/x/query'],['POST','https://v3.football.api-sports.io/fixtures'],
    ['POST',paths.replacementSubdomain,{enabled:true,previews_enabled:true}],['POST',paths.createShell,{name:REPLACEMENT_COLLECTOR,subdomain:{enabled:false,previews_enabled:false}}]
  ])assert.throws(()=>replacementMutationKind(method,p,{accountId:ACCOUNT,body}),/replacement_(mutation_forbidden|preview_disable_body_invalid|shell_body_invalid)/);
});

test('replacement foundation creates once, uploads once, proves both secret-free paths and disables Preview',async()=>{
  const fake=fakeCloudflare();const report=await runReplacementFoundation({env,fetchImpl:fake.fetchImpl});
  assert.equal(report.complete,true);assert.equal(report.classification,'REPLACEMENT_INACTIVE_COLLECTOR_FOUNDATION_RECONCILIATION_REQUIRED');
  assert.deepEqual(report.mutationCounts,{createShell:1,uploadVersion:1,disablePreview:1});
  assert.equal(report.rootProbe.workerSignatureProved,true);assert.equal(report.attendedProbe.workerSignatureProved,true);
  assert.equal(report.previewDisabled,true);assert.equal(report.originalUnchanged,true);assert.equal(report.versionId,VERSION_ID);
  assert.deepEqual({deployments:report.deploymentsCreated,workersDev:report.workersDevEnabled,topology:report.cronRouteDomainMutations,access:report.accessMutations,d1:report.d1Mutations,provider:report.providerRequests,trigger:report.triggerHeaderRequests},{deployments:0,workersDev:0,topology:0,access:0,d1:0,provider:0,trigger:0});
  const probes=fake.state.calls.filter(row=>new URL(row.url).hostname.endsWith('.workers.dev'));
  assert.equal(probes.length,2);assert.deepEqual(probes.map(row=>row.method),['GET','GET']);
  for(const row of probes){assert.equal(row.body,undefined);assert.equal(row.headers,undefined);}
  assert.ok(fake.state.calls.filter(row=>row.method!=='GET').every(row=>!new RegExp('/scripts/'+ORIGINAL_COLLECTOR+'(?:/|$)').test(new URL(row.url).pathname)));
});

test('routing failure stops without Preview disable, Deployment, workers.dev fallback, second Version, or retry',async()=>{
  const fake=fakeCloudflare({route:false});const report=await runReplacementFoundation({env,fetchImpl:fake.fetchImpl});
  assert.equal(report.complete,false);assert.equal(report.reason,'replacement_routing_signature_not_proved');
  assert.deepEqual(report.mutationCounts,{createShell:1,uploadVersion:1,disablePreview:0});
  assert.equal(fake.state.versionPosts,1);assert.equal(fake.state.disablePosts,0);assert.equal(report.retryAuthorized,false);
  assert.ok(fake.state.calls.every(row=>!row.url.endsWith('/deployments')||row.method==='GET'));
});

test('ambiguous shell creation reconciles exact approved initial state without resubmission',async()=>{
  const fake=fakeCloudflare({ambiguousShell:true});const report=await runReplacementFoundation({env,fetchImpl:fake.fetchImpl});
  assert.equal(report.complete,true);assert.equal(report.shellDisposition,'RECONCILED');assert.equal(fake.state.shellPosts,1);
});

test('wrong creation-time Preview state stops and is never repaired by toggle',async()=>{
  const fake=fakeCloudflare({wrongShell:true});const report=await runReplacementFoundation({env,fetchImpl:fake.fetchImpl});
  assert.equal(report.complete,false);assert.equal(report.reason,'replacement_shell_reconciliation_failed');
  assert.deepEqual(report.mutationCounts,{createShell:1,uploadVersion:0,disablePreview:0});
});

test('pre-existing replacement or original collector drift fails before mutation',async()=>{
  const fake=fakeCloudflare();fake.state.replacement=true;fake.state.preview=true;
  await assert.rejects(runReplacementFoundation({env,fetchImpl:fake.fetchImpl}),/replacement_worker_preexists/);
  assert.ok(fake.state.calls.every(row=>row.method==='GET'));
  const drift=fakeCloudflare();const original=drift.fetchImpl;drift.fetchImpl=async(url,init={})=>String(url).endsWith('/scripts/'+ORIGINAL_COLLECTOR+'/deployments')?ok({deployments:[{id:'unexpected'}]}):original(url,init);
  await assert.rejects(runReplacementFoundation({env,fetchImpl:drift.fetchImpl}),/replacement_original_collector_drift/);
  assert.ok(drift.state.calls.every(row=>row.method==='GET'));
});

test('credentials are separated and retained report has only closed evidence',async()=>{
  await assert.rejects(runReplacementFoundation({env:{...env,CLOUDFLARE_REPLACEMENT_MUTATION_TOKEN:READ_TOKEN},fetchImpl:fakeCloudflare().fetchImpl}),/replacement_credential_separation_required/);
  const report=await runReplacementFoundation({env,fetchImpl:fakeCloudflare().fetchImpl});const serialized=JSON.stringify(report);
  for(const sensitive of [READ_TOKEN,MUTATION_TOKEN,API_KEY,TRIGGER,'api-sports','x-teamsheet-attended-trigger'])assert.ok(!serialized.includes(sensitive));
  assert.equal(validateReplacementProbe(report.rootProbe),true);
});

test('independent reconciliation requires pristine old and exact inactive replacement state',()=>{
  const execution={complete:true,classification:'REPLACEMENT_INACTIVE_COLLECTOR_FOUNDATION_RECONCILIATION_REQUIRED',previewDisabled:true,originalUnchanged:true,versionId:VERSION_ID,
    deploymentsCreated:0,workersDevEnabled:0,cronRouteDomainMutations:0,accessMutations:0,d1Mutations:0,providerRequests:0,triggerHeaderRequests:0,retryAuthorized:false};
  const originalReport={ok:true,stage:'VERSION_URL_CREATION_EXPERIMENT_CLOSEOUT',runtime:{collectionEnabled:0,credentialState:'AVAILABLE',activeLease:false},priorState:{requestAttempts:0,generations:0,fixtureRevisions:0},inventory:{versionInventoryExact:true,cloneVersionIdentityExact:true,workersDev:false,previewUrls:false,deploymentCount:0,cronCount:0,routeCount:0,customDomainCount:0}};
  const replacement={workerName:REPLACEMENT_COLLECTOR,versionId:VERSION_ID,workersDev:false,previewUrls:false,versionCount:1,versionInventoryExact:true,deploymentCount:0,cronCount:0,routeCount:0,customDomainCount:0,versionIdentityExact:true};
  assert.equal(validateReplacementReconciliation({execution,originalReport,replacement}).classification,'REPLACEMENT_INACTIVE_COLLECTOR_FOUNDATION_RECONCILED');
  for(const changed of [{previewUrls:true},{deploymentCount:1},{versionIdentityExact:false}])assert.throws(()=>validateReplacementReconciliation({execution,originalReport,replacement:{...replacement,...changed}}));
});

test('workflow remains manual exact-main first-attempt-only and cannot activate production topology',()=>{
  const yml=fs.readFileSync(path.join(root,'.github/workflows/api-football-replacement-inactive-foundation.yml'),'utf8');
  assert.match(yml,/^on:\n  workflow_dispatch:\n/m);assert.doesNotMatch(yml,/\n  (push|pull_request|schedule|workflow_run|repository_dispatch):/);
  assert.match(yml,/github\.run_attempt == 1/);assert.match(yml,/git ls-remote https:\/\/github\.com\/priteshpatel390-del\/FPL\.git refs\/heads\/main/);
  assert.match(yml,/Tests and deterministic build/);assert.match(yml,/name: api-football-replacement-foundation/);assert.match(yml,/name: data-steward-readonly/);
  assert.doesNotMatch(yml,/wrangler deploy|versions deploy|\/routes|\/domains|\/schedules|\/access\/apps|API_FOOTBALL_ATTENDED_TRIGGER_HEADER/);
  assert.match(yml,/CLOUDFLARE_REPLACEMENT_READ_TOKEN/);assert.match(yml,/CLOUDFLARE_REPLACEMENT_MUTATION_TOKEN/);
});

test('replacement foundation stays isolated from production model browser and provider paths',()=>{
  const files=['workers/api-football-collector/replacement-foundation.mjs','workers/api-football-collector/replacement-reconciliation.mjs','.github/workflows/api-football-replacement-inactive-foundation.yml'];
  const text=files.map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n');
  assert.doesNotMatch(text,/src\/model|src\/ui|captain|transfer|mini-league|recommendation/i);
  assert.doesNotMatch(text,/v3\.football\.api-sports\.io|x-apisports-key/);
  assert.ok(!ORIGINAL_VERSION_IDS.includes(GATE_C_CLONE_VERSION_ID)===false);
});
