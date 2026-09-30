import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {DIAGNOSTIC_SIGNATURE_BODY,DIAGNOSTIC_SIGNATURE_HEADER} from '../workers/version-url-diagnostic/diagnostic.mjs';
import * as diagnosticWorker from '../workers/version-url-diagnostic/diagnostic.mjs';
import {
  COLLECTOR_VERSION_IDS,COLLECTOR_WORKER,COLLECTOR_WORKER_ID,DIAGNOSTIC_WORKER,MUTATION_CEILINGS,PHASES,READINESS_DELAYS_MS,
  buildShellBody,buildUploadForm,classifyDiagnostic,classifyResponse,deploymentBody,diagnosticPaths,mutationKind,
  assertReadAllowed,runDisposableDiagnostic,validateVersionUrl
} from '../workers/version-url-diagnostic/run-disposable-diagnostic.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ACCOUNT='account-123',FINGERPRINT=createHash('sha256').update(ACCOUNT).digest('hex'),SHA='b'.repeat(40);
const API='https://api.cloudflare.com/client/v4';
const DIAG_ID='d1a90000000000000000000000000001',DIAG_VERSION='9f8e7d6c-1111-4222-8333-444455556666';
const VERSION_HOST=DIAG_VERSION.slice(0,8)+'-'+DIAGNOSTIC_WORKER+'.fpltsheet.workers.dev';
const PROD_HOST=DIAGNOSTIC_WORKER+'.fpltsheet.workers.dev';
const env={CLOUDFLARE_ACCOUNT_ID:ACCOUNT,CLOUDFLARE_ACCOUNT_FINGERPRINT:FINGERPRINT,APPROVED_SHA:SHA,CLOUDFLARE_DIAGNOSTIC_TOKEN:'token-value'};
const ok=result=>new Response(JSON.stringify({success:true,result}),{status:200,headers:{'content-type':'application/json'}});
const signature=()=>new Response(DIAGNOSTIC_SIGNATURE_BODY,{status:200,headers:{'content-type':'text/plain; charset=utf-8',[DIAGNOSTIC_SIGNATURE_HEADER]:'1'}});
const errorPage=code=>new Response('error code: '+code,{status:404,headers:{'content-type':'text/plain; charset=UTF-8','cf-ray':'0123456789abcdef-LHR'}});
const htmlPage=()=>new Response('<!DOCTYPE html><html><body>nothing</body></html>',{status:404,headers:{'content-type':'text/html'}});

// Minimal stateful fake Cloudflare. `routesWhen(state)` decides whether the edge dispatches the Version URL.
function fakeCloudflare({routesWhen=()=>false,collector={}}={}){
  const state={diag:null,workersDev:false,previews:false,deployments:0,calls:[],deleted:false};
  const col={enabled:false,previews_enabled:false,deployments:[],versions:COLLECTOR_VERSION_IDS.map(id=>({id})),...collector};
  const scripts=()=>[
    {id:COLLECTOR_WORKER,modified_on:'2026-09-29T20:57:49.924228Z'},
    {id:'teamsheet-fpl-gateway',modified_on:'2026-09-29T20:50:49.486144Z'},
    ...(state.diag?[{id:DIAGNOSTIC_WORKER,modified_on:'2026-09-30T00:00:00Z'}]:[])
  ];
  const base='/accounts/'+ACCOUNT+'/workers';
  const fetchImpl=async(url,init={})=>{
    const method=(init.method||'GET').toUpperCase();
    state.calls.push(method+' '+url);
    const parsed=new URL(url);
    if(parsed.hostname===VERSION_HOST)return routesWhen(state)?signature():htmlPage();
    if(parsed.hostname===PROD_HOST)return state.workersDev&&state.deployments?signature():errorPage(1042);
    assert.ok(url.startsWith(API),'unexpected host '+url);
    const p=url.slice(API.length).split('?')[0];
    if(method==='GET'){
      if(p===base+'/scripts')return ok(scripts());
      if(p===base+'/workers')return ok([{id:COLLECTOR_WORKER_ID,name:COLLECTOR_WORKER},...(state.diag?[{id:DIAG_ID,name:DIAGNOSTIC_WORKER}]:[])]);
      if(p===base+'/subdomain')return ok({subdomain:'fpltsheet'});
      if(p===base+'/scripts/'+COLLECTOR_WORKER+'/subdomain')return ok({enabled:col.enabled,previews_enabled:col.previews_enabled});
      if(p===base+'/scripts/'+COLLECTOR_WORKER+'/deployments')return ok({deployments:col.deployments});
      if(p===base+'/scripts/'+COLLECTOR_WORKER+'/versions')return ok({items:col.versions});
      if(p===base+'/scripts/'+DIAGNOSTIC_WORKER+'/subdomain')return ok({enabled:state.workersDev,previews_enabled:state.previews});
      if(p===base+'/scripts/'+DIAGNOSTIC_WORKER+'/deployments')return ok({deployments:Array.from({length:state.deployments},(_,i)=>({id:'dep'+i}))});
      if(p===base+'/workers/'+DIAG_ID+'/versions/'+DIAG_VERSION)return ok({id:DIAG_VERSION,urls:state.previews?['https://'+VERSION_HOST]:[]});
    }
    if(method==='POST'&&p===base+'/workers'){state.diag={id:DIAG_ID};return ok({id:DIAG_ID,name:DIAGNOSTIC_WORKER});}
    if(method==='POST'&&p===base+'/scripts/'+DIAGNOSTIC_WORKER+'/subdomain'){const b=JSON.parse(init.body);state.workersDev=b.enabled;state.previews=b.previews_enabled;return ok(b);}
    if(method==='POST'&&p===base+'/scripts/'+DIAGNOSTIC_WORKER+'/versions')return ok({id:DIAG_VERSION});
    if(method==='POST'&&p===base+'/scripts/'+DIAGNOSTIC_WORKER+'/deployments'){state.deployments+=1;return ok({id:'dep'});}
    if(method==='DELETE'&&p===base+'/scripts/'+DIAGNOSTIC_WORKER){state.diag=null;state.deleted=true;return ok(null);}
    throw new Error('unexpected request '+method+' '+p);
  };
  return {state,fetchImpl};
}
const noWait=async()=>{};
const run=(fake,overrides={})=>runDisposableDiagnostic({env:{...env,...overrides},fetchImpl:fake.fetchImpl,wait:noWait,now:()=>0});

test('disposable diagnostic Worker returns only its fixed signature and has no imports or bindings',async()=>{
  const response=await diagnosticWorker.default.fetch(new Request('https://example.test/anything'));
  assert.equal(response.status,200);
  assert.equal(await response.text(),DIAGNOSTIC_SIGNATURE_BODY);
  assert.equal(response.headers.get(DIAGNOSTIC_SIGNATURE_HEADER),'1');
  const source=fs.readFileSync(path.join(root,'workers/version-url-diagnostic/diagnostic.mjs'),'utf8');
  assert.doesNotMatch(source,/\bimport\b|\benv\.|fetch\(\s*['"`h]/);
  const form=buildUploadForm(SHA,source);
  assert.deepEqual(JSON.parse(form.get('metadata')).bindings,[]);
});

test('mutation allowlist addresses only the disposable Worker',()=>{
  const paths=diagnosticPaths(ACCOUNT);
  assert.equal(mutationKind('POST',paths.createShell,{accountId:ACCOUNT}),'createShell');
  assert.equal(mutationKind('POST',paths.uploadVersion,{accountId:ACCOUNT}),'uploadVersion');
  assert.equal(mutationKind('POST',paths.subdomain,{accountId:ACCOUNT}),'subdomain');
  assert.equal(mutationKind('POST',paths.deployments,{accountId:ACCOUNT}),'deployment');
  assert.equal(mutationKind('DELETE',paths.deleteWorker,{accountId:ACCOUNT}),'deleteWorker');
  const collector='/accounts/'+ACCOUNT+'/workers/scripts/'+COLLECTOR_WORKER;
  for(const [method,p] of [['POST',collector+'/subdomain'],['POST',collector+'/versions'],['POST',collector+'/deployments'],['DELETE',collector],
    ['PUT',paths.deleteWorker],['PATCH',paths.subdomain],['DELETE',paths.deleteWorker+'?force=true'],['POST','/accounts/'+ACCOUNT+'/d1/database/x/query'],
    ['POST','/accounts/other/workers/workers']])
    assert.throws(()=>mutationKind(method,p,{accountId:ACCOUNT}),/diagnostic_mutation_forbidden/);
  assert.throws(()=>assertReadAllowed('/accounts/'+ACCOUNT+'/d1/database',{accountId:ACCOUNT}),/diagnostic_read_forbidden/);
  assert.deepEqual(buildShellBody(),{name:DIAGNOSTIC_WORKER,subdomain:{enabled:false,previews_enabled:false}});
  assert.throws(()=>deploymentBody(COLLECTOR_VERSION_IDS[1]),/diagnostic_deployment_target_invalid/);
  assert.deepEqual(MUTATION_CEILINGS,{createShell:1,uploadVersion:1,subdomain:2,deployment:1,deleteWorker:1});
  assert.equal(READINESS_DELAYS_MS.reduce((a,b)=>a+b,0),112_000);
});

test('response classification retains closed enums only',()=>{
  const plain=classifyResponse({status:404,headers:new Headers({'content-type':'text/plain; charset=UTF-8','cf-ray':'0123456789abcdef-LHR'}),body:'error code: 1042'});
  assert.deepEqual({...plain},{outcome:'HTTP_RESPONSE',httpStatus:404,contentTypeFamily:'TEXT_PLAIN',bodyKind:'CLOUDFLARE_ERROR_CODE',cloudflareErrorCode:1042,bodyLengthBucket:'B1_64',cfRay:'0123456789abcdef-LHR',signatureProved:false});
  const html=classifyResponse({status:404,headers:new Headers({'content-type':'text/html','cf-ray':'<script>'}),body:'<!DOCTYPE html><p>x</p>'});
  assert.equal(html.bodyKind,'HTML_DOCUMENT');assert.equal(html.contentTypeFamily,'TEXT_HTML');assert.equal(html.cfRay,null);
  const sig=classifyResponse({status:200,headers:new Headers({[DIAGNOSTIC_SIGNATURE_HEADER]:'1'}),body:DIAGNOSTIC_SIGNATURE_BODY});
  assert.equal(sig.signatureProved,true);
  const noHeader=classifyResponse({status:200,headers:new Headers(),body:DIAGNOSTIC_SIGNATURE_BODY});
  assert.equal(noHeader.signatureProved,false);
  assert.ok(!JSON.stringify(html).includes('DOCTYPE'));
});

test('Version URL must be the exact Cloudflare-published hostname for this Version',()=>{
  assert.equal(validateVersionUrl('https://'+VERSION_HOST,{versionId:DIAG_VERSION,accountSubdomain:'fpltsheet'}),'https://'+VERSION_HOST+'/');
  for(const bad of ['http://'+VERSION_HOST,'https://'+VERSION_HOST+'/x','https://00000000-'+DIAGNOSTIC_WORKER+'.fpltsheet.workers.dev',
    'https://'+DIAG_VERSION.slice(0,8)+'-'+COLLECTOR_WORKER+'.fpltsheet.workers.dev'])
    assert.throws(()=>validateVersionUrl(bad,{versionId:DIAG_VERSION,accountSubdomain:'fpltsheet'}),/diagnostic_version_url_invalid/);
});

test('phase A success refutes the zero-Deployment hypothesis and stops without further mutation',async()=>{
  const fake=fakeCloudflare({routesWhen:()=>true});
  const report=await run(fake);
  assert.equal(report.classification,'ZERO_DEPLOYMENT_HYPOTHESIS_REFUTED');
  assert.equal(report.phases.length,1);
  assert.deepEqual(report.mutationCounts,{createShell:1,uploadVersion:1,subdomain:1,deployment:0,deleteWorker:1});
  assert.equal(report.cleanup,'DISPOSABLE_WORKER_DELETED');
  assert.equal(report.safe,true);assert.equal(report.collectorUnchanged,true);assert.equal(report.otherWorkersUnchanged,true);
  assert.ok(fake.state.calls.every(call=>!/\/scripts\/teamsheet-api-football-shadow-collector(\/|$)/.test(call)||call.startsWith('GET ')));
});

test('workers.dev route requirement is isolated when only phase B dispatches',async()=>{
  const fake=fakeCloudflare({routesWhen:s=>s.workersDev&&s.deployments===0});
  const report=await run(fake);
  assert.equal(report.classification,'WORKERS_DEV_ROUTE_REQUIRED_SUPPORTED');
  assert.equal(report.phases.length,2);
  assert.equal(report.phases[0].versionUrl.attemptCount,READINESS_DELAYS_MS.length);
  assert.equal(report.phases[0].versionUrl.attempts[0].bodyKind,'HTML_DOCUMENT');
  assert.equal(report.mutationCounts.deployment,0);
  assert.equal(report.safe,true);
});

test('first Deployment requirement is isolated when only phase C dispatches',async()=>{
  const fake=fakeCloudflare({routesWhen:s=>s.deployments>0});
  const report=await run(fake);
  assert.equal(report.classification,'FIRST_DEPLOYMENT_REQUIRED_SUPPORTED');
  assert.deepEqual(report.phases.map(row=>row.phase),PHASES.map(row=>row.id));
  assert.equal(report.mutationCounts.deployment,1);
  assert.equal(report.phases[2].productionRoute.signatureProved,true);
  assert.equal(report.safe,true);assert.equal(fake.state.deleted,true);
});

test('failure in every phase is reported as deeper than Deployment and workers.dev',async()=>{
  const report=await run(fakeCloudflare());
  assert.equal(report.classification,'FAILS_BEYOND_DEPLOYMENT_AND_WORKERS_DEV');
  assert.equal(report.cleanup,'DISPOSABLE_WORKER_DELETED');assert.equal(report.safe,true);
  assert.equal(classifyDiagnostic([]),'DIAGNOSTIC_INCOMPLETE');
});

test('preflight refuses before any mutation when collector is not pristine or diagnostic Worker exists',async()=>{
  for(const collector of [{previews_enabled:true},{enabled:true},{deployments:[{id:'x'}]},{versions:[{id:COLLECTOR_VERSION_IDS[0]}]}]){
    const fake=fakeCloudflare({collector});
    await assert.rejects(run(fake),/diagnostic_collector_not_pristine/);
    assert.ok(fake.state.calls.every(call=>call.startsWith('GET ')));
  }
  const fake=fakeCloudflare();fake.state.diag={id:DIAG_ID};
  await assert.rejects(run(fake),/diagnostic_worker_preexists/);
  await assert.rejects(run(fakeCloudflare(),{CLOUDFLARE_ACCOUNT_FINGERPRINT:'0'.repeat(64)}),/diagnostic_account_identity_mismatch/);
});

test('mid-run failure still deletes the disposable Worker and is never safe-and-complete',async()=>{
  const fake=fakeCloudflare();
  const inner=fake.fetchImpl;
  fake.fetchImpl=async(url,init={})=>{
    if((init.method||'GET')==='POST'&&url.endsWith('/scripts/'+DIAGNOSTIC_WORKER+'/versions'))return new Response('{"success":false}',{status:400});
    return inner(url,init);
  };
  const report=await run(fake);
  assert.equal(report.classification,'DIAGNOSTIC_INCOMPLETE');
  assert.equal(report.failure,'diagnostic_mutation_rejected_uploadVersion');
  assert.equal(report.cleanup,'DISPOSABLE_WORKER_DELETED');
  assert.equal(fake.state.deleted,true);
});

test('workflow is manual, first-attempt-only, exact-main gated and uses a dedicated environment',()=>{
  const yml=fs.readFileSync(path.join(root,'.github/workflows/cloudflare-version-url-disposable-diagnostic.yml'),'utf8');
  assert.match(yml,/^on:\n  workflow_dispatch:\n/m);
  assert.doesNotMatch(yml,/\n  (schedule|push|pull_request|workflow_run|repository_dispatch):/);
  assert.match(yml,/github\.run_attempt == 1/);
  assert.match(yml,/name: cloudflare-version-url-diagnostic/);
  assert.match(yml,/git ls-remote https:\/\/github\.com\/priteshpatel390-del\/FPL\.git refs\/heads\/main/);
  assert.match(yml,/Tests and deterministic build/);
  assert.doesNotMatch(yml,/API_FOOTBALL|TRIGGER_SECRET|D1_TOKEN|DATA_STEWARD/);
  assert.match(yml,/node workers\/version-url-diagnostic\/run-disposable-diagnostic\.mjs/);
});
