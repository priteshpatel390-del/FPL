import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {expectedAttendedBindings} from '../workers/api-football-collector/attended-version.mjs';
import {buildUploadModules,resolveModuleGraph} from '../workers/api-football-collector/stage-inactive-version.mjs';
import {buildReplacementIdentity,ORIGINAL_COLLECTOR,REPLACEMENT_COLLECTOR,REPLACEMENT_RECOVERY_WORKER_ID,replacementPaths} from '../workers/api-football-collector/replacement-foundation.mjs';
import {runReplacementRecoveryAdmission,runReplacementShellRecovery,recoveryMutationKind,REPLACEMENT_RECOVERY_MUTATION_CEILINGS} from '../workers/api-football-collector/replacement-shell-recovery.mjs';
import {runReplacementRecoveryReconciliation,validateReplacementRecoveryReconciliation} from '../workers/api-football-collector/replacement-shell-recovery-reconciliation.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ACCOUNT='account-123',SHA='e'.repeat(40),FINGERPRINT=createHash('sha256').update(ACCOUNT).digest('hex');
const VERSION_ID='44444444-4444-4444-8444-444444444444',READ_TOKEN='read-token',MUTATION_TOKEN='mutation-token',API_KEY='provider-key',TRIGGER='x'.repeat(40);
const env={CLOUDFLARE_ACCOUNT_ID:ACCOUNT,CLOUDFLARE_ACCOUNT_FINGERPRINT:FINGERPRINT,APPROVED_SHA:SHA,CLOUDFLARE_REPLACEMENT_READ_TOKEN:READ_TOKEN,CLOUDFLARE_REPLACEMENT_MUTATION_TOKEN:MUTATION_TOKEN,API_FOOTBALL_API_KEY:API_KEY,API_FOOTBALL_ATTENDED_TRIGGER_SECRET:TRIGGER};
const API='https://api.cloudflare.com/client/v4';
const ok=result=>new Response(JSON.stringify({success:true,result}),{status:200,headers:{'content-type':'application/json'}});
const workerRejection=()=>new Response('Not found',{status:404,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
const ORIGINAL_REPORT={ok:true,approvedSha:SHA,stage:'VERSION_URL_CREATION_EXPERIMENT_CLOSEOUT',runtime:{collectionEnabled:0,credentialState:'AVAILABLE',activeLease:false},priorState:{requestAttempts:0,generations:0,fixtureRevisions:0},inventory:{versionInventoryExact:true,cloneVersionIdentityExact:true,workersDev:false,previewUrls:false,deploymentCount:0,cronCount:0,routeCount:0,customDomainCount:0}};

function fixtureVersion(){
  const identity=buildReplacementIdentity(SHA),modules=buildUploadModules(resolveModuleGraph());
  return {
    stable:{id:VERSION_ID,resources:{script_runtime:{compatibility_date:identity.compatibilityDate},bindings:structuredClone(expectedAttendedBindings())}},
    beta:{id:VERSION_ID,main_module:identity.mainModule,compatibility_date:identity.compatibilityDate,annotations:{'workers/message':identity.message,'workers/tag':identity.tag},modules:[...modules].map(([name,source])=>({name,content_base64:Buffer.from(source).toString('base64')}))}
  };
}

function fakeCloudflare({route=true,enable='ok',upload='ok',disable='ok',drift={}}={}){
  const paths=replacementPaths(ACCOUNT),fx=fixtureVersion();
  const state={preview:false,version:false,calls:[],enablePosts:0,uploadPosts:0,disablePosts:0};
  const worker=()=>({id:drift.workerId??REPLACEMENT_RECOVERY_WORKER_ID,name:REPLACEMENT_COLLECTOR,deployed_on:drift.deployed?new Date().toISOString():null,subdomain:{enabled:drift.workersDev??false,previews_enabled:state.preview}});
  const scripts=()=>[{id:ORIGINAL_COLLECTOR,routes:[]},...(state.version?[{id:REPLACEMENT_COLLECTOR,routes:drift.routes??[]}]:[])];
  const fetchImpl=async(url,init={})=>{
    const method=(init.method||'GET').toUpperCase();state.calls.push({url:String(url),method,headers:init.headers,body:init.body});
    const parsed=new URL(url);
    if(parsed.hostname.endsWith('.workers.dev'))return route?workerRejection():new Response('platform',{status:404,headers:{'content-type':'text/html'}});
    assert.ok(String(url).startsWith(API));const full=String(url).slice(API.length),p=full.split('?')[0];
    if(method==='GET'){
      if(full===paths.betaWorkers)return ok([worker()]);
      if(p===paths.scripts)return ok(scripts());
      if(p===paths.domains)return ok(drift.domain?[{service:REPLACEMENT_COLLECTOR}]:[]);
      if(p===paths.accountSubdomain)return ok({subdomain:'fpltsheet'});
      if(p===paths.replacementSubdomain)return ok({enabled:drift.workersDev??false,previews_enabled:state.preview});
      if(p===paths.replacementDeployments)return ok({deployments:drift.deployment?[{id:'dep'}]:[]});
      if(p===paths.replacementSchedules)return ok({schedules:drift.cron?[{cron:'* * * * *'}]:[]});
      if(full===paths.replacementVersions)return ok({items:state.version?[{id:VERSION_ID}]:[]});
      if(p===paths.replacement+'/'+VERSION_ID)return ok(fx.stable);
      if(full===paths.createShell+'/'+REPLACEMENT_RECOVERY_WORKER_ID+'/versions/'+VERSION_ID+'?include=modules')return ok(fx.beta);
      if(p===paths.createShell+'/'+REPLACEMENT_RECOVERY_WORKER_ID+'/versions/'+VERSION_ID)return ok({id:VERSION_ID,urls:['https://'+VERSION_ID.slice(0,8)+'-'+REPLACEMENT_COLLECTOR+'.fpltsheet.workers.dev']});
    }
    if(method==='POST'&&p===paths.replacementSubdomain){
      const body=JSON.parse(init.body);
      if(body.previews_enabled===true){
        state.enablePosts++;
        if(enable==='rejected')return new Response(JSON.stringify({success:false}),{status:400});
        if(enable==='ambiguous-unapplied')return new Response('gateway',{status:502});
        state.preview=true;
        if(enable==='ambiguous-applied')throw new TypeError('fetch failed');
        return ok(body);
      }
      state.disablePosts++;
      if(disable==='ambiguous-unapplied')return new Response('gateway',{status:502});
      state.preview=false;
      if(disable==='ambiguous-applied')throw new TypeError('fetch failed');
      return ok(body);
    }
    if(method==='POST'&&p===paths.replacementUpload){
      state.uploadPosts++;
      if(upload==='rejected')return new Response(JSON.stringify({success:false}),{status:400});
      if(upload==='ambiguous-absent')return new Response('gateway',{status:502});
      state.version=true;
      if(upload==='ambiguous-created')throw new TypeError('fetch failed');
      return ok({id:VERSION_ID});
    }
    throw new Error('unexpected '+method+' '+full);
  };
  return {state,fetchImpl};
}

test('read-only recovery admission accepts exact shell-only state before scripts inventory materializes',async()=>{
  const fake=fakeCloudflare(),report=await runReplacementRecoveryAdmission({env,fetchImpl:fake.fetchImpl});
  assert.equal(report.ok,true);assert.equal(report.workerId,REPLACEMENT_RECOVERY_WORKER_ID);assert.equal(report.replacementState,'SHELL_ONLY');assert.equal(report.scriptPresent,false);
  assert.ok(fake.state.calls.every(row=>row.method==='GET'));assert.equal(report.productionMutations,0);assert.equal(report.apiFootballRequests,0);
});

test('recovery admission fails closed on identity, Preview, Version or topology drift',async()=>{
  for(const options of [{drift:{workerId:'other'}},{drift:{deployment:true}},{drift:{cron:true}},{drift:{domain:true}}]){
    const fake=fakeCloudflare(options);await assert.rejects(runReplacementRecoveryAdmission({env,fetchImpl:fake.fetchImpl}),/replacement_recovery_shell_state_invalid/);
  }
  const preview=fakeCloudflare();preview.state.preview=true;await assert.rejects(runReplacementRecoveryAdmission({env,fetchImpl:preview.fetchImpl}),/replacement_recovery_shell_state_invalid/);
  const version=fakeCloudflare();version.state.version=true;await assert.rejects(runReplacementRecoveryAdmission({env,fetchImpl:version.fetchImpl}),/replacement_recovery_shell_state_invalid/);
});

test('recovery mutation allowlist excludes shell creation and production activation surfaces',()=>{
  const p=replacementPaths(ACCOUNT);
  assert.deepEqual(REPLACEMENT_RECOVERY_MUTATION_CEILINGS,{enablePreview:1,uploadVersion:1,disablePreview:1});
  assert.equal(recoveryMutationKind('POST',p.replacementSubdomain,{accountId:ACCOUNT,body:{enabled:false,previews_enabled:true}}),'enablePreview');
  assert.equal(recoveryMutationKind('POST',p.replacementUpload,{accountId:ACCOUNT}),'uploadVersion');
  assert.equal(recoveryMutationKind('POST',p.replacementSubdomain,{accountId:ACCOUNT,body:{enabled:false,previews_enabled:false}}),'disablePreview');
  for(const [method,pathName,body] of [['POST',p.createShell,{name:REPLACEMENT_COLLECTOR}],['POST',p.replacementDeployments],['POST',p.replacementSchedules],['POST',p.domains],['DELETE',p.replacement],['POST','/accounts/'+ACCOUNT+'/d1/database/x/query'],['POST','/accounts/'+ACCOUNT+'/access/apps']])
    assert.throws(()=>recoveryMutationKind(method,pathName,{accountId:ACCOUNT,body}),/replacement_recovery_mutation_forbidden/);
});

test('shell recovery enables Preview once, uploads once, proves two secret-free paths and disables Preview',async()=>{
  const fake=fakeCloudflare(),report=await runReplacementShellRecovery({env,fetchImpl:fake.fetchImpl});
  assert.equal(report.complete,true);assert.equal(report.classification,'REPLACEMENT_SHELL_RECOVERY_RECONCILIATION_REQUIRED');assert.equal(report.replacementState,'ONE_VERSION');
  assert.deepEqual(report.mutationCounts,{enablePreview:1,uploadVersion:1,disablePreview:1});assert.equal(report.createShellMutations,0);assert.equal(report.versionId,VERSION_ID);
  assert.equal(report.rootProbe.workerSignatureProved,true);assert.equal(report.attendedProbe.workerSignatureProved,true);assert.equal(report.previewDisabled,true);assert.equal(fake.state.preview,false);
  const probes=fake.state.calls.filter(row=>new URL(row.url).hostname.endsWith('.workers.dev'));assert.equal(probes.length,2);for(const row of probes){assert.equal(row.method,'GET');assert.equal(row.headers,undefined);assert.equal(row.body,undefined);}
  assert.ok(fake.state.calls.every(row=>!(row.method==='POST'&&row.url.endsWith('/workers/workers'))));
});

test('routing mismatch is a clean one-Version safe stop with no retry',async()=>{
  const fake=fakeCloudflare({route:false}),report=await runReplacementShellRecovery({env,fetchImpl:fake.fetchImpl});
  assert.equal(report.classification,'REPLACEMENT_SHELL_RECOVERY_CLEAN_SAFE_STOP');assert.equal(report.safeStop,true);assert.equal(report.replacementState,'ONE_VERSION');
  assert.equal(report.reason,'replacement_recovery_routing_signature_not_proved');assert.deepEqual(report.mutationCounts,{enablePreview:1,uploadVersion:1,disablePreview:1});
  assert.equal(fake.state.uploadPosts,1);assert.equal(fake.state.calls.filter(row=>new URL(row.url).hostname.endsWith('.workers.dev')).length,2);
});

test('upload rejection or reconciled absence restores disabled Preview and proves shell-only safe stop',async()=>{
  for(const upload of ['rejected','ambiguous-absent']){
    const fake=fakeCloudflare({upload}),report=await runReplacementShellRecovery({env,fetchImpl:fake.fetchImpl});
    assert.equal(report.classification,'REPLACEMENT_SHELL_RECOVERY_CLEAN_SAFE_STOP');assert.equal(report.replacementState,'SHELL_ONLY');assert.equal(report.previewDisabled,true);
    assert.equal(fake.state.uploadPosts,1);assert.equal(fake.state.disablePosts,1);assert.equal(report.versionId,null);
  }
});

test('ambiguous applied upload is reconciled to one Version without resubmission',async()=>{
  const fake=fakeCloudflare({upload:'ambiguous-created'}),report=await runReplacementShellRecovery({env,fetchImpl:fake.fetchImpl});
  assert.equal(report.complete,true);assert.equal(report.versionDisposition,'RECONCILED');assert.equal(fake.state.uploadPosts,1);
});

test('Preview enable rejection or unapplied ambiguity never uploads and remains shell-only',async()=>{
  for(const enable of ['rejected','ambiguous-unapplied']){
    const fake=fakeCloudflare({enable}),report=await runReplacementShellRecovery({env,fetchImpl:fake.fetchImpl});
    assert.equal(report.classification,'REPLACEMENT_SHELL_RECOVERY_CLEAN_SAFE_STOP');assert.equal(report.replacementState,'SHELL_ONLY');assert.equal(report.previewDisabled,true);
    assert.equal(fake.state.uploadPosts,0);assert.equal(fake.state.disablePosts,0);assert.equal(report.mutationCounts.enablePreview,1);
  }
});

test('ambiguous applied Preview enable reconciles and continues without second enable',async()=>{
  const fake=fakeCloudflare({enable:'ambiguous-applied'}),report=await runReplacementShellRecovery({env,fetchImpl:fake.fetchImpl});
  assert.equal(report.complete,true);assert.equal(report.enableDisposition,'RECONCILED');assert.equal(fake.state.enablePosts,1);
});

test('unresolved Preview cleanup is owner attention and never resubmits cleanup',async()=>{
  const fake=fakeCloudflare({disable:'ambiguous-unapplied',route:false}),report=await runReplacementShellRecovery({env,fetchImpl:fake.fetchImpl});
  assert.equal(report.classification,'REPLACEMENT_SHELL_RECOVERY_OWNER_ATTENTION_REQUIRED');assert.equal(report.previewDisabled,false);assert.equal(report.replacementState,null);assert.equal(fake.state.disablePosts,1);
});

test('recovery credentials are distinct and retained reports exclude secret material',async()=>{
  await assert.rejects(runReplacementShellRecovery({env:{...env,CLOUDFLARE_REPLACEMENT_MUTATION_TOKEN:READ_TOKEN},fetchImpl:fakeCloudflare().fetchImpl}),/replacement_recovery_credential_separation_required/);
  const report=await runReplacementShellRecovery({env,fetchImpl:fakeCloudflare().fetchImpl}),serialized=JSON.stringify(report);
  for(const value of [READ_TOKEN,MUTATION_TOKEN,API_KEY,TRIGGER,'api-sports','x-teamsheet-attended-trigger'])assert.ok(!serialized.includes(value));
});

test('independent recovery reconciliation accepts exact one-Version success and shell-only safe stop',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'replacement-recovery-'));
  const run=async(fake,execution)=>{
    const executionPath=path.join(dir,'execution.json'),originalPath=path.join(dir,'original.json');
    fs.writeFileSync(executionPath,JSON.stringify(execution));fs.writeFileSync(originalPath,JSON.stringify(ORIGINAL_REPORT));
    return runReplacementRecoveryReconciliation({env:{APPROVED_SHA:SHA,CLOUDFLARE_ACCOUNT_ID:ACCOUNT,CLOUDFLARE_REPLACEMENT_READ_TOKEN:READ_TOKEN,API_FOOTBALL_REPLACEMENT_RECOVERY_EXECUTION_PATH:executionPath,API_FOOTBALL_REPLACEMENT_RECOVERY_ORIGINAL_REPORT_PATH:originalPath},fetchImpl:fake.fetchImpl});
  };
  const good=fakeCloudflare(),execution=await runReplacementShellRecovery({env,fetchImpl:good.fetchImpl}),reconciled=await run(good,execution);
  assert.equal(reconciled.ok,true);assert.equal(reconciled.classification,'REPLACEMENT_SHELL_RECOVERY_RECONCILED');assert.equal(reconciled.foundationSucceeded,true);
  const shell=fakeCloudflare({upload:'rejected'}),stopped=await run(shell,await runReplacementShellRecovery({env,fetchImpl:shell.fetchImpl}));
  assert.equal(stopped.ok,true);assert.equal(stopped.classification,'REPLACEMENT_SHELL_RECOVERY_SAFE_STOP_RECONCILED');assert.equal(stopped.replacementState,'SHELL_ONLY');
  const bad={...execution,classification:'REPLACEMENT_SHELL_RECOVERY_OWNER_ATTENTION_REQUIRED',complete:false,safeStop:false};
  assert.throws(()=>validateReplacementRecoveryReconciliation({execution:bad,originalReport:ORIGINAL_REPORT,replacement:reconciled.replacement}),/execution_invalid/);
  fs.rmSync(dir,{recursive:true,force:true});
});

test('recovery workflow is manual exact-main first-attempt-only with no create/deploy/provider primitive',()=>{
  const yml=fs.readFileSync(path.join(root,'.github/workflows/api-football-replacement-shell-recovery.yml'),'utf8');
  assert.match(yml,/^on:\n  workflow_dispatch:\n/m);assert.doesNotMatch(yml,/\n  (push|pull_request|schedule|workflow_run|repository_dispatch):/);
  assert.match(yml,/github\.run_attempt == 1/);assert.match(yml,/git ls-remote https:\/\/github\.com\/priteshpatel390-del\/FPL\.git refs\/heads\/main/);
  assert.match(yml,/Tests and deterministic build/);assert.match(yml,/name: api-football-replacement-foundation/);assert.match(yml,/name: data-steward-readonly/);
  assert.match(yml,new RegExp(REPLACEMENT_RECOVERY_WORKER_ID));assert.doesNotMatch(yml,/wrangler deploy|versions deploy|\/routes|\/domains|\/schedules|\/access\/apps|API_FOOTBALL_ATTENDED_TRIGGER_HEADER/);
  assert.match(yml,/r\.createShellMutations!==0/);
  assert.match(yml,/CLOUDFLARE_REPLACEMENT_READ_TOKEN/);assert.match(yml,/CLOUDFLARE_REPLACEMENT_MUTATION_TOKEN/);assert.match(yml,/Preserve protected recovery outcome/);
});
