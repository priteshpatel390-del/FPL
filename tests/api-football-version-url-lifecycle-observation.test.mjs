import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {ATTENDED_ACCEPTANCE_PATH} from '../workers/api-football-collector/collector.mjs';
import {ATTENDED_VERSION_ID,ATTENDED_VERSION_APPROVED_SHA} from '../workers/api-football-collector/attended-version.mjs';
import {
  assertLifecycleControlRequestAllowed,classifyLifecycleRouting,lifecycleControlPath,
  runVersionUrlLifecycleObservation,validateLifecycleProbeEvidence
} from '../workers/api-football-collector/run-version-url-lifecycle-observation.mjs';
import {classifyVersionUrlLifecycleReconciliation} from '../workers/api-football-collector/version-url-lifecycle-reconciliation.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SHA='a'.repeat(40),ACCOUNT='account-123',FINGERPRINT=createHash('sha256').update(ACCOUNT).digest('hex');
const WORKER_ID='worker-id',SUBDOMAIN='fpltsheet';
const PREVIEW_SUFFIX='-teamsheet-api-football-shadow-collector.fpltsheet.workers.dev';
const VERSION_URL=`https://${ATTENDED_VERSION_ID.slice(0,8)}${PREVIEW_SUFFIX}/`;
const NOW='2026-09-29T00:00:00.000Z';

const workerResponse=(body='Not found',status=404,headers={})=>new Response(body,{status,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store',...headers}});

function admission(){
  return {
    ok:true,approvedSha:SHA,versionApprovedSha:ATTENDED_VERSION_APPROVED_SHA,observedAt:NOW,accountFingerprint:FINGERPRINT,
    stage:'ATTENDED_ACCEPTANCE',classification:'READY_FOR_SEPARATELY_APPROVED_ATTENDED_ACCEPTANCE',
    inventory:{reviewedVersionId:ATTENDED_VERSION_ID,versionIdentityExact:true,versionInventoryExact:true},
    evidence:{observedAt:NOW,productionMutations:0,apiFootballRequests:0,secretValuesRead:0}
  };
}

function criticalAdmission(overrides={}){
  const base={
    ...admission(),migrationCount:6,foreignKeyViolations:0,officialFplAuthority:{valid:true,teamCount:20,fetchedAt:NOW},
    mapping:{state:'COMMITTED',mappingCount:20,memberCount:20,distinctProviderIds:20,distinctFplIds:20,canonicalCoverageMatches:true,historicalAuthorityProvenancePresent:true},
    inventory:{reviewedVersionId:ATTENDED_VERSION_ID,versionIdentityExact:true,versionInventoryExact:true,productionBindingProven:true,configurationExact:true,
      previewUrlIdentityExact:true,previewUrlSuffix:PREVIEW_SUFFIX,reviewedWorkerId:WORKER_ID,accountSubdomain:SUBDOMAIN,
      workerPresent:true,workersDev:false,previewUrls:false,deploymentCount:0,cronCount:0,routeCount:0,customDomainCount:0,
      secretBindingPresent:true,secretBindingNames:['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET']},
    runtime:{collectionEnabled:0,credentialState:'AVAILABLE',activeLease:false},
    priorState:{requestAttempts:0,generations:0,fixtureRevisions:0,attempt1Count:0,attempt2Count:0,reservedAttemptCount:0,stagingGenerationCount:0},
    modelUiImportCount:0,rawPayloadStoragePresent:false,
    evidence:{observedAt:NOW,productionMutations:0,apiFootballRequests:0,secretValuesRead:0}
  };
  return {...base,...overrides,inventory:{...base.inventory,...(overrides.inventory||{})},runtime:{...base.runtime,...(overrides.runtime||{})},
    priorState:{...base.priorState,...(overrides.priorState||{})},mapping:{...base.mapping,...(overrides.mapping||{})},evidence:{...base.evidence,...(overrides.evidence||{})}};
}

function envFor(file,extra={}){
  return {
    CLOUDFLARE_ACCOUNT_ID:ACCOUNT,CLOUDFLARE_ACCOUNT_FINGERPRINT:FINGERPRINT,
    CLOUDFLARE_ATTENDED_READ_TOKEN:'read-token',CLOUDFLARE_ATTENDED_MUTATION_TOKEN:'mutation-token',
    APPROVED_SHA:SHA,API_FOOTBALL_ATTENDED_VERSION_ID:ATTENDED_VERSION_ID,
    API_FOOTBALL_ATTENDED_VERSION_APPROVED_SHA:ATTENDED_VERSION_APPROVED_SHA,
    API_FOOTBALL_ATTENDED_ADMISSION_PATH:file,...extra
  };
}

function versionResponse(){
  return new Response(JSON.stringify({success:true,result:{id:ATTENDED_VERSION_ID,urls:[VERSION_URL]}}),{status:200,headers:{'content-type':'application/json'}});
}
function controlResponse(){
  return new Response(JSON.stringify({success:true,result:{}}),{status:200,headers:{'content-type':'application/json'}});
}

test('lifecycle control surface allows only exact Script Subdomain POST',()=>{
  const exact=lifecycleControlPath(ACCOUNT);
  assert.equal(assertLifecycleControlRequestAllowed('POST',exact,{accountId:ACCOUNT}),true);
  for(const [method,p] of [['GET',exact],['POST',`/accounts/${ACCOUNT}/d1/database/x/query`],['POST',`/accounts/${ACCOUNT}/workers/scripts/x/deployments`],['POST',`/accounts/${ACCOUNT}/workers/routes`]])
    assert.throws(()=>assertLifecycleControlRequestAllowed(method,p,{accountId:ACCOUNT}),/forbidden/);
});

test('Gate B probes root and attended path secret-free and cleans Preview',async()=>{
  const file='/tmp/version-url-lifecycle-admission.json';fs.writeFileSync(file,JSON.stringify(admission()));
  const calls=[];
  const result=await runVersionUrlLifecycleObservation({
    env:envFor(file),criticalRecheck:async()=>criticalAdmission(),wait:async()=>{},
    fetchImpl:async(url,init={})=>{
      const value=String(url);calls.push({value,init});
      if(value.includes(`/workers/workers/${WORKER_ID}/versions/${ATTENDED_VERSION_ID}`))return versionResponse();
      if(value.includes('workers.dev'))return workerResponse();
      return controlResponse();
    }
  });
  assert.equal(result.ok,true);assert.equal(result.routing,'EXISTING_VERSION_ROUTABLE_BOTH_PATHS');
  assert.equal(result.previewEnableAttempted,true);assert.equal(result.previewEnableSucceeded,true);assert.equal(result.previewDisableSucceeded,true);
  assert.equal(result.previewMutations,2);assert.equal(result.providerRequests,0);assert.equal(result.d1Mutations,0);assert.equal(result.versionMutations,0);assert.equal(result.triggerSecretReads,0);
  const probes=calls.filter(row=>row.value.includes('workers.dev'));assert.equal(probes.length,2);
  assert.ok(probes.some(row=>new URL(row.value).pathname==='/'));assert.ok(probes.some(row=>new URL(row.value).pathname===ATTENDED_ACCEPTANCE_PATH));
  for(const row of probes){assert.equal(row.init.method,'GET');assert.equal(row.init.redirect,'error');assert.equal(row.init.headers,undefined);}
  assert.doesNotMatch(JSON.stringify(result),/workers\.dev|Not found|read-token|mutation-token/);
  fs.unlinkSync(file);
});

test('routing mismatch is a completed observation rather than an automatic retry',async()=>{
  const file='/tmp/version-url-lifecycle-mismatch.json';fs.writeFileSync(file,JSON.stringify(admission()));
  const result=await runVersionUrlLifecycleObservation({
    env:envFor(file),criticalRecheck:async()=>criticalAdmission(),wait:async()=>{},
    fetchImpl:async(url)=>{
      const value=String(url);
      if(value.includes(`/workers/workers/${WORKER_ID}/versions/${ATTENDED_VERSION_ID}`))return versionResponse();
      if(value.includes('workers.dev'))return new URL(value).pathname==='/'?workerResponse():workerResponse('platform response',404);
      return controlResponse();
    }
  });
  assert.equal(result.ok,true);assert.equal(result.routing,'EXISTING_VERSION_ROUTABLE_ROOT_ONLY');assert.equal(result.retryAuthorized,false);
  assert.equal(result.attendedProbe.mismatch,'BODY');assert.deepEqual(result.attendedProbe.signatureChecks,{statusMatches:true,bodyMatches:false,cacheControlMatches:true,contentTypeMatches:true});
  fs.unlinkSync(file);
});

test('transport evidence is closed and still performs Preview cleanup',async()=>{
  const file='/tmp/version-url-lifecycle-transport.json';fs.writeFileSync(file,JSON.stringify(admission()));let probe=0,disable=0;
  const result=await runVersionUrlLifecycleObservation({
    env:envFor(file),criticalRecheck:async()=>criticalAdmission(),wait:async()=>{},
    fetchImpl:async(url,init={})=>{
      const value=String(url);
      if(value.includes(`/workers/workers/${WORKER_ID}/versions/${ATTENDED_VERSION_ID}`))return versionResponse();
      if(value.includes('workers.dev')){probe++;throw new Error('private remote detail');}
      if(JSON.parse(init.body).previews_enabled===false)disable++;
      return controlResponse();
    }
  });
  assert.equal(result.ok,false);assert.equal(result.classification,'LIFECYCLE_OBSERVATION_RECONCILIATION_REQUIRED');assert.equal(result.routing,'LIFECYCLE_OBSERVATION_INCOMPLETE');assert.equal(result.retryAuthorized,false);assert.equal(probe,2);assert.equal(disable,1);
  assert.deepEqual(result.rootProbe,{outcome:'TRANSPORT_FAILURE',lastHttpStatus:null,mismatch:null,signatureChecks:null,workerSignatureProved:false});
  assert.doesNotMatch(JSON.stringify(result),/private remote detail/);fs.unlinkSync(file);
});

test('ambiguous enable still attempts disable cleanup and cannot qualify as completed',async()=>{
  const file='/tmp/version-url-lifecycle-enable-ambiguous.json';fs.writeFileSync(file,JSON.stringify(admission()));let controlCalls=0;
  const result=await runVersionUrlLifecycleObservation({
    env:envFor(file),criticalRecheck:async()=>criticalAdmission(),wait:async()=>{},
    fetchImpl:async(url)=>{
      const value=String(url);
      if(value.endsWith('/subdomain')){controlCalls++;if(controlCalls===1)throw new Error('unknown enable delivery');return controlResponse();}
      throw new Error('unexpected network');
    }
  });
  assert.equal(controlCalls,2);assert.equal(result.previewEnableAttempted,true);assert.equal(result.previewEnableSucceeded,false);assert.equal(result.previewDisableSucceeded,true);
  assert.equal(result.ok,false);assert.equal(result.retryAuthorized,false);assert.equal(result.providerRequests,0);fs.unlinkSync(file);
});

test('trigger secret presence is rejected before any network request',async()=>{
  const file='/tmp/version-url-lifecycle-trigger-forbidden.json';fs.writeFileSync(file,JSON.stringify(admission()));let calls=0;
  await assert.rejects(()=>runVersionUrlLifecycleObservation({env:envFor(file,{API_FOOTBALL_ATTENDED_TRIGGER_SECRET:'x'.repeat(40)}),fetchImpl:async()=>{calls++;}}),/trigger_secret_forbidden/);
  assert.equal(calls,0);fs.unlinkSync(file);
});

test('probe evidence shape and mismatch ordering are closed',()=>{
  const good={outcome:'HTTP_RESPONSE',lastHttpStatus:404,mismatch:null,signatureChecks:{statusMatches:true,bodyMatches:true,cacheControlMatches:true,contentTypeMatches:true},workerSignatureProved:true};
  assert.equal(validateLifecycleProbeEvidence(good),true);
  const wrong={...good,mismatch:'BODY',signatureChecks:{...good.signatureChecks,bodyMatches:false,cacheControlMatches:false},workerSignatureProved:false};
  assert.equal(validateLifecycleProbeEvidence(wrong),true);
  assert.equal(validateLifecycleProbeEvidence({...wrong,mismatch:'CACHE_CONTROL'}),false);
  assert.equal(validateLifecycleProbeEvidence({...wrong,signatureChecks:{...wrong.signatureChecks,extra:false}}),false);
  assert.equal(validateLifecycleProbeEvidence({...wrong,lastHttpStatus:99}),false);
  assert.equal(validateLifecycleProbeEvidence({...wrong,lastHttpStatus:600}),false);
  assert.equal(validateLifecycleProbeEvidence({...wrong,lastHttpStatus:404.5}),false);
  assert.equal(classifyLifecycleRouting({rootProbe:good,attendedProbe:wrong}),'EXISTING_VERSION_ROUTABLE_ROOT_ONLY');
});

test('independent reconciliation accepts routability findings only with pristine post-state',()=>{
  const report=criticalAdmission();
  const probe={outcome:'HTTP_RESPONSE',lastHttpStatus:404,mismatch:'BODY',signatureChecks:{statusMatches:true,bodyMatches:false,cacheControlMatches:true,contentTypeMatches:true},workerSignatureProved:false};
  const evidence={version:'api-football-version-url-lifecycle-observation-v1',approvedSha:SHA,versionId:ATTENDED_VERSION_ID,ok:true,classification:'LIFECYCLE_OBSERVATION_COMPLETE_RECONCILIATION_REQUIRED',reason:'observation_complete_requires_reconciliation',routing:'EXISTING_VERSION_ROUTABILITY_NOT_PROVEN',versionUrlReads:1,previewMutations:2,previewEnableAttempted:true,previewEnableSucceeded:true,previewDisableSucceeded:true,rootProbe:probe,attendedProbe:probe,providerRequests:0,d1Mutations:0,versionMutations:0,triggerSecretReads:0,retryAuthorized:false};
  const result=classifyVersionUrlLifecycleReconciliation(report,{observationEvidence:evidence});
  assert.equal(result.ok,true);assert.equal(result.classification,'VERSION_URL_LIFECYCLE_RECONCILED');assert.equal(result.routing,'EXISTING_VERSION_ROUTABILITY_NOT_PROVEN');
  assert.equal(classifyVersionUrlLifecycleReconciliation({...report,inventory:{...report.inventory,previewUrls:true}},{observationEvidence:evidence}).ok,false);
  assert.equal(classifyVersionUrlLifecycleReconciliation(report,{observationEvidence:{...evidence,d1Mutations:1}}).ok,false);
  assert.equal(classifyVersionUrlLifecycleReconciliation(report,{observationEvidence:{...evidence,routing:'EXISTING_VERSION_ROUTABLE_BOTH_PATHS'}}).ok,false);
});

test('workflow is manual, exact-main, first-attempt-only and contains no provider-capable secret or mutation path',()=>{
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/api-football-version-url-lifecycle-observation.yml'),'utf8');
  for(const required of ['workflow_dispatch:','github.run_attempt == 1','refs/heads/main',"row.name==='Tests and deterministic build'",'data-steward-readonly','api-football-attended-acceptance','run-version-url-lifecycle-observation.mjs','version-url-lifecycle-reconciliation.mjs','EXPECTED_ARTIFACT_SHA256','sha256sum','final-readonly-reconciliation:'])
    assert.ok(workflow.includes(required),required);
  for(const forbidden of ['API_FOOTBALL_ATTENDED_TRIGGER_SECRET','API_FOOTBALL_API_KEY','/d1/database/','wrangler deploy','versions upload','/deployments','/schedules','workers/routes','workers/domains'])
    assert.equal(workflow.includes(forbidden),false,forbidden);
});
