import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {expectedAttendedBindings} from '../workers/api-football-collector/attended-version.mjs';
import {buildUploadModules,resolveModuleGraph} from '../workers/api-football-collector/stage-inactive-version.mjs';
import {
  GATE_C_CLONE_VERSION_ID,ORIGINAL_COLLECTOR,ORIGINAL_COLLECTOR_ID,ORIGINAL_VERSION_IDS,REPLACEMENT_COLLECTOR,
  REPLACEMENT_MUTATION_CEILINGS,buildReplacementIdentity,buildReplacementShellBody,buildReplacementUploadForm,
  replacementMutationKind,replacementPaths,runReplacementFoundation,validateReplacementProbe,validateReplacementReconciliation
} from '../workers/api-football-collector/replacement-foundation.mjs';
import {runReplacementReconciliation} from '../workers/api-football-collector/replacement-reconciliation.mjs';

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

function fakeCloudflare({route=true,wrongShell=false,ambiguousShell=false,rejectShell=false,probeTransport=null,upload='ok',disable='ok'}={}){
  const paths=replacementPaths(ACCOUNT),fx=fixtures();
  const state={replacement:false,preview:false,version:false,calls:[],shellPosts:0,versionPosts:0,disablePosts:0};
  const original={id:ORIGINAL_COLLECTOR_ID,name:ORIGINAL_COLLECTOR,subdomain:{enabled:false,previews_enabled:false}};
  const replacement=()=>({id:REPLACEMENT_ID,name:REPLACEMENT_COLLECTOR,deployed_on:null,subdomain:{enabled:false,previews_enabled:wrongShell?false:state.preview}});
  const scripts=()=>[{id:ORIGINAL_COLLECTOR,modified_on:'2026-09-29T20:57:49Z',routes:[]},...(state.replacement?[{id:REPLACEMENT_COLLECTOR,modified_on:'2026-09-30T00:00:00Z',routes:[]}]:[])];
  const fetchImpl=async(url,init={})=>{
    const method=(init.method||'GET').toUpperCase();state.calls.push({url:String(url),method,headers:init.headers,body:init.body});
    const parsed=new URL(url);
    if(parsed.hostname.endsWith('.workers.dev')){
      if(probeTransport==='root'&&parsed.pathname==='/'||probeTransport==='attended'&&parsed.pathname!=='/')throw new TypeError('fetch failed');
      return route?workerRejection():new Response('platform',{status:404,headers:{'content-type':'text/html'}});
    }
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
      state.shellPosts++;const body=JSON.parse(init.body);assert.deepEqual(body,buildReplacementShellBody());
      if(rejectShell)return new Response(JSON.stringify({success:false}),{status:400});
      state.replacement=true;state.preview=!wrongShell;
      if(ambiguousShell)return new Response('bad gateway',{status:502});
      return ok(replacement());
    }
    if(method==='POST'&&p===paths.replacementUpload){
      state.versionPosts++;
      if(upload==='rejected')return new Response(JSON.stringify({success:false}),{status:400});
      if(upload==='ambiguous-absent')return new Response('bad gateway',{status:502});
      state.version=true;
      if(upload==='ambiguous-created')throw new TypeError('fetch failed');
      return ok({id:VERSION_ID});
    }
    if(method==='POST'&&p===paths.replacementSubdomain){
      state.disablePosts++;const body=JSON.parse(init.body);assert.deepEqual(body,{enabled:false,previews_enabled:false});
      if(disable==='ambiguous-unapplied')return new Response('bad gateway',{status:502});
      state.preview=false;
      if(disable==='ambiguous-applied')throw new TypeError('fetch failed');
      return ok(body);
    }
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
  assert.equal(report.safeStop,false);assert.equal(report.routingProved,true);assert.equal(report.replacementState,'ONE_VERSION');assert.equal(report.previewCleanup,'DEFINITE');
  assert.equal(fake.state.preview,false);assertNoForbiddenTraffic(fake);
  const disableIndex=fake.state.calls.findIndex(row=>row.method==='POST'&&row.url.endsWith('/subdomain'));
  const lastProbe=fake.state.calls.map(row=>new URL(row.url).hostname.endsWith('.workers.dev')).lastIndexOf(true);
  assert.ok(lastProbe>=0&&disableIndex>lastProbe,'Preview disabled only after both probes');
  assert.deepEqual({deployments:report.deploymentsCreated,workersDev:report.workersDevEnabled,topology:report.cronRouteDomainMutations,access:report.accessMutations,d1:report.d1Mutations,provider:report.providerRequests,trigger:report.triggerHeaderRequests},{deployments:0,workersDev:0,topology:0,access:0,d1:0,provider:0,trigger:0});
  const probes=fake.state.calls.filter(row=>new URL(row.url).hostname.endsWith('.workers.dev'));
  assert.equal(probes.length,2);assert.deepEqual(probes.map(row=>row.method),['GET','GET']);
  for(const row of probes){assert.equal(row.body,undefined);assert.equal(row.headers,undefined);}
  assert.ok(fake.state.calls.filter(row=>row.method!=='GET').every(row=>!new RegExp('/scripts/'+ORIGINAL_COLLECTOR+'(?:/|$)').test(new URL(row.url).pathname)));
});

const zeroEvidence=report=>({deployments:report.deploymentsCreated,workersDev:report.workersDevEnabled,topology:report.cronRouteDomainMutations,access:report.accessMutations,d1:report.d1Mutations,provider:report.providerRequests,trigger:report.triggerHeaderRequests,retry:report.retryAuthorized});
const ZERO={deployments:0,workersDev:0,topology:0,access:0,d1:0,provider:0,trigger:0,retry:false};
function assertNoForbiddenTraffic(fake){
  for(const row of fake.state.calls){
    const url=new URL(row.url);
    assert.ok(!/api-sports\.io$|api-football\.com$/.test(url.hostname),'provider request');
    if(url.hostname.endsWith('.workers.dev')){assert.equal(row.method,'GET');assert.equal(row.headers,undefined);assert.equal(row.body,undefined);continue;}
    if(row.method==='GET')continue;
    assert.ok(!new RegExp('/scripts/'+ORIGINAL_COLLECTOR+'(?:/|$)').test(url.pathname),'original collector mutation');
    assert.ok(!/\/deployments|\/schedules|\/routes|\/domains|\/access\/|\/d1\//.test(url.pathname),'forbidden mutation surface');
    if(url.pathname.endsWith('/subdomain'))assert.deepEqual(JSON.parse(row.body),{enabled:false,previews_enabled:false});
  }
}
function assertCleanSafeStop(report,fake,{reason,state,uploads=1,disables=1}){
  assert.equal(report.complete,false);assert.equal(report.safeStop,true);assert.equal(report.routingProved,false);
  assert.equal(report.classification,'REPLACEMENT_INACTIVE_COLLECTOR_CLEAN_SAFE_STOP');assert.equal(report.reason,reason);
  assert.equal(report.replacementState,state);assert.equal(report.originalUnchanged,true);assert.deepEqual(zeroEvidence(report),ZERO);
  assert.equal(fake.state.shellPosts,1);assert.equal(fake.state.versionPosts,uploads);assert.equal(fake.state.disablePosts,disables);
  assert.ok(report.mutationCounts.disablePreview<=REPLACEMENT_MUTATION_CEILINGS.disablePreview);
  if(state!=='ABSENT'){assert.equal(report.previewDisabled,true);assert.equal(fake.state.preview,false);}
  assertNoForbiddenTraffic(fake);
}

test('routing signature mismatch still submits the single Preview disable and ends inactive as a clean safe stop',async()=>{
  const fake=fakeCloudflare({route:false});const report=await runReplacementFoundation({env,fetchImpl:fake.fetchImpl});
  assertCleanSafeStop(report,fake,{reason:'replacement_routing_signature_not_proved',state:'ONE_VERSION'});
  assert.deepEqual(report.mutationCounts,{createShell:1,uploadVersion:1,disablePreview:1});
  assert.equal(report.previewCleanup,'DEFINITE');assert.equal(report.versionId,VERSION_ID);
  assert.equal(fake.state.calls.filter(row=>new URL(row.url).hostname.endsWith('.workers.dev')).length,2,'no probe retry');
});

for(const which of ['root','attended'])test(which+'-probe transport failure attempts Preview cleanup and stops cleanly without retry',async()=>{
  const fake=fakeCloudflare({probeTransport:which});const report=await runReplacementFoundation({env,fetchImpl:fake.fetchImpl});
  assertCleanSafeStop(report,fake,{reason:'replacement_routing_signature_not_proved',state:'ONE_VERSION'});
  assert.equal(report[which+'Probe'].outcome,'TRANSPORT_FAILURE');
  assert.equal(fake.state.calls.filter(row=>new URL(row.url).hostname.endsWith('.workers.dev')).length,2);
});

test('definite Version upload failure after shell creation disables Preview and proves shell-only inactive state',async()=>{
  const fake=fakeCloudflare({upload:'rejected'});const report=await runReplacementFoundation({env,fetchImpl:fake.fetchImpl});
  assertCleanSafeStop(report,fake,{reason:'replacement_mutation_rejected_uploadVersion',state:'SHELL_ONLY'});
  assert.equal(report.versionDisposition,'REJECTED');assert.equal(report.versionId,null);
});

test('ambiguous Version upload reconciled to one Version is never re-uploaded and is cleaned up on later stop',async()=>{
  const fake=fakeCloudflare({upload:'ambiguous-created',route:false});const report=await runReplacementFoundation({env,fetchImpl:fake.fetchImpl});
  assertCleanSafeStop(report,fake,{reason:'replacement_routing_signature_not_proved',state:'ONE_VERSION'});
  assert.equal(report.versionDisposition,'RECONCILED');assert.equal(report.versionId,VERSION_ID);
});

test('ambiguous Version upload reconciled absent disables Preview and safe-stops shell-only without retry',async()=>{
  const fake=fakeCloudflare({upload:'ambiguous-absent'});const report=await runReplacementFoundation({env,fetchImpl:fake.fetchImpl});
  assertCleanSafeStop(report,fake,{reason:'replacement_version_upload_reconciled_absent',state:'SHELL_ONLY'});
  assert.equal(report.versionDisposition,'RECONCILED_ABSENT');
});

test('ambiguous Preview-disable response reconciled read-only to disabled is accepted as cleanup',async()=>{
  const fake=fakeCloudflare({disable:'ambiguous-applied'});const report=await runReplacementFoundation({env,fetchImpl:fake.fetchImpl});
  assert.equal(report.complete,true);assert.equal(report.previewCleanup,'RECONCILED');assert.equal(fake.state.disablePosts,1);
  const stop=fakeCloudflare({disable:'ambiguous-applied',route:false});const stopped=await runReplacementFoundation({env,fetchImpl:stop.fetchImpl});
  assertCleanSafeStop(stopped,stop,{reason:'replacement_routing_signature_not_proved',state:'ONE_VERSION'});assert.equal(stopped.previewCleanup,'RECONCILED');
});

test('ambiguous Preview-disable response with Preview still enabled is unresolved owner attention, never resubmitted',async()=>{
  for(const route of [true,false]){
    const fake=fakeCloudflare({disable:'ambiguous-unapplied',route});const report=await runReplacementFoundation({env,fetchImpl:fake.fetchImpl});
    assert.equal(report.complete,false);assert.equal(report.safeStop,false);
    assert.equal(report.classification,'REPLACEMENT_INACTIVE_COLLECTOR_OWNER_ATTENTION_REQUIRED');
    assert.equal(report.previewCleanup,'UNRESOLVED');assert.equal(report.previewDisabled,false);assert.equal(report.replacementState,null);
    assert.equal(fake.state.disablePosts,1);assert.equal(report.mutationCounts.disablePreview,1);
    if(route)assert.equal(report.reason,'replacement_preview_cleanup_unresolved');
  }
  const unknown=fakeCloudflare({disable:'ambiguous-unapplied'});const base=unknown.fetchImpl;let posted=false;
  unknown.fetchImpl=async(url,init={})=>{if(String(url).endsWith('/scripts/'+REPLACEMENT_COLLECTOR+'/subdomain')){if((init.method||'GET')==='POST')posted=true;else if(posted)throw new TypeError('fetch failed');}return base(url,init);};
  const report=await runReplacementFoundation({env,fetchImpl:unknown.fetchImpl});
  assert.equal(report.previewCleanup,'UNRESOLVED');assert.equal(report.classification,'REPLACEMENT_INACTIVE_COLLECTOR_OWNER_ATTENTION_REQUIRED');
});

test('definite shell rejection needs no Preview cleanup and safe-stops only on read-only absence proof',async()=>{
  const fake=fakeCloudflare({rejectShell:true});const report=await runReplacementFoundation({env,fetchImpl:fake.fetchImpl});
  assertCleanSafeStop(report,fake,{reason:'replacement_mutation_rejected_createShell',state:'ABSENT',uploads:0,disables:0});
  assert.equal(report.previewCleanup,'NOT_REQUIRED');assert.deepEqual(report.mutationCounts,{createShell:1,uploadVersion:0,disablePreview:0});
});

test('unresolved shell creation is owner attention with no blind retry and no cleanup guess',async()=>{
  const fake=fakeCloudflare({ambiguousShell:true});const base=fake.fetchImpl;
  fake.fetchImpl=async(url,init={})=>{const response=await base(url,init);if((init.method||'GET')==='POST'&&String(url).endsWith('/workers/workers'))fake.state.replacement=false;return response;};
  const report=await runReplacementFoundation({env,fetchImpl:fake.fetchImpl});
  assert.equal(report.classification,'REPLACEMENT_INACTIVE_COLLECTOR_OWNER_ATTENTION_REQUIRED');assert.equal(report.shellDisposition,'UNRESOLVED');
  assert.deepEqual(report.mutationCounts,{createShell:1,uploadVersion:0,disablePreview:0});assert.equal(fake.state.shellPosts,1);
});

test('ambiguous shell creation reconciles exact approved initial state without resubmission',async()=>{
  const fake=fakeCloudflare({ambiguousShell:true});const report=await runReplacementFoundation({env,fetchImpl:fake.fetchImpl});
  assert.equal(report.complete,true);assert.equal(report.shellDisposition,'RECONCILED');assert.equal(fake.state.shellPosts,1);
});

test('wrong creation-time Preview state stops and is never repaired by toggle',async()=>{
  const fake=fakeCloudflare({wrongShell:true});const report=await runReplacementFoundation({env,fetchImpl:fake.fetchImpl});
  assert.equal(report.complete,false);assert.equal(report.reason,'replacement_shell_reconciliation_failed');
  assert.deepEqual(report.mutationCounts,{createShell:1,uploadVersion:0,disablePreview:0});
  assert.equal(report.previewCleanup,'ALREADY_DISABLED');assert.equal(report.replacementState,'SHELL_ONLY');assert.equal(report.safeStop,true);
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

const ORIGINAL_REPORT={ok:true,stage:'VERSION_URL_CREATION_EXPERIMENT_CLOSEOUT',runtime:{collectionEnabled:0,credentialState:'AVAILABLE',activeLease:false},priorState:{requestAttempts:0,generations:0,fixtureRevisions:0},inventory:{versionInventoryExact:true,cloneVersionIdentityExact:true,workersDev:false,previewUrls:false,deploymentCount:0,cronCount:0,routeCount:0,customDomainCount:0}};
const BASE_EXECUTION={originalUnchanged:true,workerId:REPLACEMENT_ID,versionId:VERSION_ID,mutationCounts:{createShell:1,uploadVersion:1,disablePreview:1},
  deploymentsCreated:0,workersDevEnabled:0,cronRouteDomainMutations:0,accessMutations:0,d1Mutations:0,providerRequests:0,triggerHeaderRequests:0,retryAuthorized:false};
const SUCCESS_EXECUTION={...BASE_EXECUTION,complete:true,safeStop:false,routingProved:true,previewDisabled:true,replacementState:'ONE_VERSION',classification:'REPLACEMENT_INACTIVE_COLLECTOR_FOUNDATION_RECONCILIATION_REQUIRED'};
const SAFE_STOP={...BASE_EXECUTION,complete:false,safeStop:true,routingProved:false,previewDisabled:true,replacementState:'ONE_VERSION',classification:'REPLACEMENT_INACTIVE_COLLECTOR_CLEAN_SAFE_STOP'};
const ONE_VERSION_STATE={present:true,workerName:REPLACEMENT_COLLECTOR,workerId:REPLACEMENT_ID,versionId:VERSION_ID,workersDev:false,previewUrls:false,versionCount:1,versionInventoryExact:true,deploymentCount:0,cronCount:0,routeCount:0,customDomainCount:0,versionIdentityExact:true};
const SHELL_STATE={...ONE_VERSION_STATE,versionId:null,versionCount:0,versionIdentityExact:null};

test('independent reconciliation requires pristine old and exact inactive replacement state for success',()=>{
  const result=validateReplacementReconciliation({execution:SUCCESS_EXECUTION,originalReport:ORIGINAL_REPORT,replacement:ONE_VERSION_STATE});
  assert.equal(result.classification,'REPLACEMENT_INACTIVE_COLLECTOR_FOUNDATION_RECONCILED');assert.equal(result.foundationSucceeded,true);
  for(const changed of [{previewUrls:true},{workersDev:true},{deploymentCount:1},{cronCount:1},{routeCount:1},{customDomainCount:1},{versionIdentityExact:false},{versionCount:2},{workerId:'other'}])
    assert.throws(()=>validateReplacementReconciliation({execution:SUCCESS_EXECUTION,originalReport:ORIGINAL_REPORT,replacement:{...ONE_VERSION_STATE,...changed}}),/candidate_invalid/);
  assert.throws(()=>validateReplacementReconciliation({execution:SUCCESS_EXECUTION,originalReport:ORIGINAL_REPORT,replacement:SHELL_STATE}),/candidate_invalid/);
  for(const changed of [{previewDisabled:false},{routingProved:false},{replacementState:'SHELL_ONLY'},{originalUnchanged:false},{retryAuthorized:true},{providerRequests:1},{d1Mutations:1},{deploymentsCreated:1},{mutationCounts:{createShell:1,uploadVersion:2,disablePreview:1}}])
    assert.throws(()=>validateReplacementReconciliation({execution:{...SUCCESS_EXECUTION,...changed},originalReport:ORIGINAL_REPORT,replacement:ONE_VERSION_STATE}),/execution_invalid/);
  assert.throws(()=>validateReplacementReconciliation({execution:SUCCESS_EXECUTION,originalReport:{...ORIGINAL_REPORT,inventory:{...ORIGINAL_REPORT.inventory,previewUrls:true}},replacement:ONE_VERSION_STATE}),/original_invalid/);
});

test('independent reconciliation proves failed-but-clean one-Version and shell-only inactive states as safe stops',()=>{
  const one=validateReplacementReconciliation({execution:SAFE_STOP,originalReport:ORIGINAL_REPORT,replacement:ONE_VERSION_STATE});
  assert.equal(one.classification,'REPLACEMENT_INACTIVE_COLLECTOR_SAFE_STOP_RECONCILED');assert.equal(one.foundationSucceeded,false);assert.equal(one.replacementState,'ONE_VERSION');
  const shellExecution={...SAFE_STOP,versionId:null,replacementState:'SHELL_ONLY',mutationCounts:{createShell:1,uploadVersion:1,disablePreview:1}};
  const shell=validateReplacementReconciliation({execution:shellExecution,originalReport:ORIGINAL_REPORT,replacement:SHELL_STATE});
  assert.equal(shell.classification,'REPLACEMENT_INACTIVE_COLLECTOR_SAFE_STOP_RECONCILED');assert.equal(shell.replacementState,'SHELL_ONLY');assert.equal(shell.retryAuthorized,false);
  for(const changed of [{previewUrls:true},{workersDev:true},{versionCount:1},{versionInventoryExact:false},{deploymentCount:1}])
    assert.throws(()=>validateReplacementReconciliation({execution:shellExecution,originalReport:ORIGINAL_REPORT,replacement:{...SHELL_STATE,...changed}}),/candidate_invalid/);
  assert.throws(()=>validateReplacementReconciliation({execution:{...SAFE_STOP,previewDisabled:false},originalReport:ORIGINAL_REPORT,replacement:ONE_VERSION_STATE}),/execution_invalid/);
  const absent=validateReplacementReconciliation({execution:{...SAFE_STOP,workerId:null,versionId:null,previewDisabled:false,replacementState:'ABSENT',mutationCounts:{createShell:1,uploadVersion:0,disablePreview:0}},originalReport:ORIGINAL_REPORT,replacement:{present:false,workerId:null,versionId:null,versionCount:0}});
  assert.equal(absent.replacementState,'ABSENT');
});

test('owner-attention execution never reconciles as success or safe stop',()=>{
  const execution={...BASE_EXECUTION,complete:false,safeStop:false,routingProved:false,previewDisabled:false,replacementState:null,classification:'REPLACEMENT_INACTIVE_COLLECTOR_OWNER_ATTENTION_REQUIRED'};
  for(const replacement of [ONE_VERSION_STATE,SHELL_STATE])assert.throws(()=>validateReplacementReconciliation({execution,originalReport:ORIGINAL_REPORT,replacement}),/execution_invalid/);
});

test('reconciliation runner reads each final state from live-shaped inventory and distinguishes all three outcomes',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'replacement-reconciliation-'));
  const run=async(fake,execution)=>{
    const executionPath=path.join(dir,'execution.json'),originalPath=path.join(dir,'original.json');
    fs.writeFileSync(executionPath,JSON.stringify(execution));fs.writeFileSync(originalPath,JSON.stringify({...ORIGINAL_REPORT,approvedSha:SHA}));
    return runReplacementReconciliation({env:{APPROVED_SHA:SHA,CLOUDFLARE_ACCOUNT_ID:ACCOUNT,CLOUDFLARE_REPLACEMENT_READ_TOKEN:READ_TOKEN,API_FOOTBALL_REPLACEMENT_EXECUTION_PATH:executionPath,API_FOOTBALL_REPLACEMENT_ORIGINAL_REPORT_PATH:originalPath},fetchImpl:fake.fetchImpl});
  };
  const success=fakeCloudflare();const executed=await runReplacementFoundation({env,fetchImpl:success.fetchImpl});
  const calls=success.state.calls.length;const good=await run(success,executed);
  assert.equal(good.classification,'REPLACEMENT_INACTIVE_COLLECTOR_FOUNDATION_RECONCILED');assert.equal(good.ok,true);
  assert.ok(success.state.calls.slice(calls).every(row=>row.method==='GET'&&row.headers.Authorization==='Bearer '+READ_TOKEN));
  const routed=fakeCloudflare({route:false});const stopped=await run(routed,await runReplacementFoundation({env,fetchImpl:routed.fetchImpl}));
  assert.equal(stopped.classification,'REPLACEMENT_INACTIVE_COLLECTOR_SAFE_STOP_RECONCILED');assert.equal(stopped.replacementState,'ONE_VERSION');assert.equal(stopped.foundationSucceeded,false);
  const shell=fakeCloudflare({upload:'rejected'});const shellOnly=await run(shell,await runReplacementFoundation({env,fetchImpl:shell.fetchImpl}));
  assert.equal(shellOnly.classification,'REPLACEMENT_INACTIVE_COLLECTOR_SAFE_STOP_RECONCILED');assert.equal(shellOnly.replacementState,'SHELL_ONLY');
  const stuck=fakeCloudflare({disable:'ambiguous-unapplied',route:false});const unresolved=await run(stuck,await runReplacementFoundation({env,fetchImpl:stuck.fetchImpl}));
  assert.equal(unresolved.classification,'REPLACEMENT_INACTIVE_COLLECTOR_OWNER_ATTENTION_REQUIRED');assert.equal(unresolved.ok,false);assert.equal(unresolved.replacement.previewUrls,true);
  fs.rmSync(dir,{recursive:true,force:true});
});

test('workflow remains manual exact-main first-attempt-only and cannot activate production topology',()=>{
  const yml=fs.readFileSync(path.join(root,'.github/workflows/api-football-replacement-inactive-foundation.yml'),'utf8');
  assert.match(yml,/^on:\n  workflow_dispatch:\n/m);assert.doesNotMatch(yml,/\n  (push|pull_request|schedule|workflow_run|repository_dispatch):/);
  assert.match(yml,/github\.run_attempt == 1/);assert.match(yml,/git ls-remote https:\/\/github\.com\/priteshpatel390-del\/FPL\.git refs\/heads\/main/);
  assert.match(yml,/Tests and deterministic build/);assert.match(yml,/name: api-football-replacement-foundation/);assert.match(yml,/name: data-steward-readonly/);
  assert.doesNotMatch(yml,/wrangler deploy|versions deploy|\/routes|\/domains|\/schedules|\/access\/apps|API_FOOTBALL_ATTENDED_TRIGGER_HEADER/);
  assert.match(yml,/CLOUDFLARE_REPLACEMENT_READ_TOKEN/);assert.match(yml,/CLOUDFLARE_REPLACEMENT_MUTATION_TOKEN/);
  assert.equal((yml.match(/API_FOOTBALL_LIFECYCLE_CLONE_APPROVED_SHA: cdb7d7ba140c38395893f223c42aee90d33b8b59/g)||[]).length,2);
  assert.match(yml,/CLONE_APPROVED_SHA: cdb7d7ba140c38395893f223c42aee90d33b8b59/);assert.match(yml,/r\.cloneApprovedSha!==process\.env\.CLONE_APPROVED_SHA/);
  const execute=yml.slice(yml.indexOf('id: execute'),yml.indexOf('- id: handoff',yml.indexOf('id: execute')));
  assert.match(execute,/continue-on-error: true/);
  const handoff=yml.slice(yml.indexOf('- id: handoff',yml.indexOf('id: execute')),yml.indexOf('final-readonly-reconciliation:'));
  assert.match(handoff,/if: always\(\)/);assert.match(handoff,/REPLACEMENT_INACTIVE_COLLECTOR_CLEAN_SAFE_STOP/);assert.match(handoff,/if-no-files-found: error/);
  assert.match(handoff,/Preserve protected execution outcome\n        if: steps\.execute\.outcome != 'success'\n        run: exit 1/);
  const final=yml.slice(yml.indexOf('final-readonly-reconciliation:'));
  assert.match(final,/if: always\(\) && needs\.repository-gate\.result == 'success' && needs\.fresh-readonly-admission\.result == 'success' && needs\.protected-replacement-foundation\.result != 'skipped'/);
  assert.match(final,/name: data-steward-readonly/);assert.doesNotMatch(final,/MUTATION_TOKEN|API_FOOTBALL_API_KEY|TRIGGER_SECRET/);
  assert.match(final,/if: always\(\)\n        with:\n          name: api-football-replacement-reconciliation/);
});

test('replacement foundation stays isolated from production model browser and provider paths',()=>{
  const files=['workers/api-football-collector/replacement-foundation.mjs','workers/api-football-collector/replacement-reconciliation.mjs','.github/workflows/api-football-replacement-inactive-foundation.yml'];
  const text=files.map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n');
  assert.doesNotMatch(text,/src\/model|src\/ui|captain|transfer|mini-league|recommendation/i);
  assert.doesNotMatch(text,/v3\.football\.api-sports\.io|x-apisports-key/);
  assert.ok(!ORIGINAL_VERSION_IDS.includes(GATE_C_CLONE_VERSION_ID)===false);
});
