import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {ATTENDED_ACCEPTANCE_PATH} from '../workers/api-football-collector/collector.mjs';
import {
  DEPLOYED_ONE_SHOT_ADMISSION_VERSION,DEPLOYED_ONE_SHOT_CLONE_APPROVED_SHA,DEPLOYED_ONE_SHOT_CLONE_VERSION_ID,DEPLOYED_ONE_SHOT_CLOUDFLARE_MUTATION_CEILINGS,
  DEPLOYED_ONE_SHOT_EXECUTION_VERSION,DEPLOYED_ONE_SHOT_MAX_D1_CALLS,DEPLOYED_ONE_SHOT_MAX_PROVIDER_REQUESTS,DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE,DEPLOYED_ONE_SHOT_READY,
  DEPLOYED_ONE_SHOT_RUNTIME_SQL,DEPLOYED_ONE_SHOT_VERSION_APPROVED_SHA,DEPLOYED_ONE_SHOT_VERSION_ID,DEPLOYED_ONE_SHOT_WORKER,DEPLOYED_ONE_SHOT_WORKER_ID,
  buildDeployedOneShotAdmission,buildDeploymentBody,classifyDeployedOneShotReconciliation,deployedOneShotAdmissionDiagnostic,deriveWorkersDevTarget,runDeployedOneShot
} from '../workers/api-football-collector/deployed-one-shot.mjs';
import {runDeployedOneShotAdmission,runDeployedOneShotReconciliation} from '../workers/api-football-collector/deployed-one-shot-readonly.mjs';
import {
  assertDeployedOneShotRequestAllowed,buildDeployedOneShotExecutionEvidence,buildDeployedOneShotPreMutationFailure,deployedOneShotCloudflarePaths,deployedOneShotFinalRouteScan,executeDeployedOneShot
} from '../workers/api-football-collector/run-deployed-one-shot.mjs';
import {ATTENDED_VERSION_ID} from '../workers/api-football-collector/attended-version.mjs';
import {REPLACEMENT_COLLECTOR} from '../workers/api-football-collector/replacement-foundation.mjs';
import {EXPECTED_D1_DATABASE_ID} from '../workers/data-platform/phase4b/live-contract.mjs';

const ACCOUNT='production-account',FINGERPRINT=createHash('sha256').update(ACCOUNT).digest('hex');
const SHA='b'.repeat(40),SUBDOMAIN='fpltsheet',TRIGGER='t'.repeat(64),READ='attended-read',MUTATE='attended-mutate',TOPO_TOKEN='topology-read';
const API='https://api.cloudflare.com/client/v4';
const TARGET=`https://${DEPLOYED_ONE_SHOT_WORKER}.${SUBDOMAIN}.workers.dev${ATTENDED_ACCEPTANCE_PATH}`;
const paths=deployedOneShotCloudflarePaths(ACCOUNT);
const TOPOLOGY={proof:'ZONE_ROUTE_SCAN',zoneCount:1,routeRowCount:0,routeCount:0};

function report(overrides={}){
  const base={
    ok:true,stage:DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE,classification:'VERSION_URL_CREATION_EXPERIMENT_RECONCILED',reason:null,
    approvedSha:SHA,versionApprovedSha:DEPLOYED_ONE_SHOT_VERSION_APPROVED_SHA,cloneApprovedSha:DEPLOYED_ONE_SHOT_CLONE_APPROVED_SHA,accountFingerprint:FINGERPRINT,
    migrationCount:6,foreignKeyViolations:0,officialFplAuthority:{valid:true,teamCount:20,fetchedAt:'2026-10-06T01:20:00.000Z'},
    mapping:{state:'COMMITTED',mappingCount:20,memberCount:20,distinctProviderIds:20,distinctFplIds:20,canonicalCoverageMatches:true,historicalAuthorityProvenancePresent:true},
    runtime:{collectionEnabled:0,credentialState:'AVAILABLE',activeLease:false},
    priorState:{requestAttempts:0,generations:0,fixtureRevisions:0,attempt1Count:0,attempt2Count:0,reservedAttemptCount:0,stagingGenerationCount:0,succeededAttemptCount:0,
      authFailureCount:0,quotaBlockedCount:0,timeoutCount:0,transportUnknownCount:0,schemaFailureCount:0,httpFailureCount:0,committedGenerationCount:0,failedGenerationCount:0,
      membershipConsistentCount:0,headMatchCount:0,persistenceUncertainCount:0,completionUncertainCount:0},
    inventory:{activation:'ATTENDED_ONE_SHOT_DISCOVERY',productionBindingProven:true,configurationExact:true,workerPresent:true,deploymentCount:0,cronCount:0,routeCount:0,customDomainCount:0,
      workersDev:false,previewUrls:false,secretBindingPresent:true,secretBindingNames:['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET'],
      reviewedVersionId:DEPLOYED_ONE_SHOT_VERSION_ID,reviewedWorkerId:DEPLOYED_ONE_SHOT_WORKER_ID,versionIdentityExact:true,versionInventoryExact:true,
      cloneVersionId:DEPLOYED_ONE_SHOT_CLONE_VERSION_ID,cloneVersionIdentityExact:true,previewUrlIdentityExact:true,accountSubdomain:SUBDOMAIN},
    modelUiImportCount:0,rawPayloadStoragePresent:false,evidence:{productionMutations:0,apiFootballRequests:0,secretValuesRead:0}
  };
  return structuredClone({...base,...overrides,inventory:{...base.inventory,...overrides.inventory},runtime:{...base.runtime,...overrides.runtime},priorState:{...base.priorState,...overrides.priorState}});
}
const successHistory={requestAttempts:5,attempt1Count:5,succeededAttemptCount:5,generations:1,committedGenerationCount:1,membershipConsistentCount:1,headMatchCount:1,fixtureRevisions:380};
function admission(){return buildDeployedOneShotAdmission({report:report(),topology:TOPOLOGY,approvedSha:SHA,accountFingerprint:FINGERPRINT});}
function tempAdmission(value=admission()){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'one-shot-'));const file=path.join(dir,'admission.json');fs.writeFileSync(file,JSON.stringify(value));return file;}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const worker=(status,body)=>new Response(body,{status,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
const exactDeployment={id:'dep-1',strategy:'percentage',versions:[{version_id:ATTENDED_VERSION_ID,percentage:100}]};

function fakeLive({zones='ok',deploy='ok',readback='exact',enableDev='ok',readinessFailures=0,trigger='accepted',enableD1='ok',disableD1='ok',disableDev='ok'}={}){
  const calls=[];
  const fetchImpl=async(url,init={})=>{
    const href=String(url),method=init.method||'GET',body=init.body?JSON.parse(init.body):null;
    calls.push({href,method,body,headers:init.headers??{}});
    const parsed=new URL(href);
    if(parsed.pathname==='/client/v4/zones'){
      assert.equal(method,'GET');assert.equal(init.headers?.Authorization,'Bearer '+TOPO_TOKEN);
      if(zones==='throw')throw new Error('reset');
      if(zones==='malformed')return json({success:true,result:[{id:'zone-a',account:{id:ACCOUNT}}],result_info:{total_pages:'x'}});
      if(zones==='http')return json({success:false},500);
      return json({success:true,result:[{id:'zone-a',account:{id:ACCOUNT}}],result_info:{total_pages:1}});
    }
    if(parsed.pathname==='/client/v4/zones/zone-a/workers/routes'){
      assert.equal(method,'GET');assert.equal(init.headers?.Authorization,'Bearer '+TOPO_TOKEN);
      if(zones==='badrow')return json({success:true,result:[{id:7,pattern:'x/*'}]});
      const rows=[{id:'r0',pattern:'other.example/*',script:REPLACEMENT_COLLECTOR}];
      if(zones==='route')rows.push({id:'r1',pattern:'example.com/*',script:DEPLOYED_ONE_SHOT_WORKER});
      return json({success:true,result:rows});
    }
    if(href===API+paths.deployments&&method==='POST'){
      if(deploy==='throw')throw new Error('reset');
      if(deploy==='reject')return json({success:false,errors:[{code:1}]},400);
      if(deploy==='server')return json({success:false},503);
      return json({success:true,result:deploy==='wrong'?{...exactDeployment,versions:[{version_id:DEPLOYED_ONE_SHOT_CLONE_VERSION_ID,percentage:100}]}:exactDeployment});
    }
    if(href===API+paths.deployments&&method==='GET')return json({success:true,result:{deployments:readback==='exact'?[exactDeployment]:readback==='two'?[exactDeployment,{...exactDeployment,id:'dep-0'}]:[]}});
    if(href===API+paths.subdomain){
      const mode=body.enabled?enableDev:disableDev;
      if(mode==='throw')throw new Error('reset');
      return json({success:true,result:{enabled:mode==='mismatch'?!body.enabled:body.enabled,previews_enabled:false}});
    }
    if(href===API+paths.d1){
      const enabling=body.sql===DEPLOYED_ONE_SHOT_RUNTIME_SQL.enable.sql,mode=enabling?enableD1:disableD1;
      if(mode==='throw')throw new Error('reset');
      return json({success:true,result:[{success:true,meta:{changes:mode==='zero'?0:1}}]});
    }
    if(href===TARGET&&method==='GET'){
      const readinessCalls=calls.filter(call=>call.href===TARGET&&call.method==='GET').length;
      return readinessCalls<=readinessFailures?new Response('platform',{status:404}):worker(404,'Not found');
    }
    if(href===TARGET&&method==='POST'){
      if(trigger==='throw')throw new Error('reset');
      if(trigger==='rejected')return worker(404,'Not found');
      if(trigger==='not-accepted')return worker(409,'Not accepted');
      return worker(202,'Accepted');
    }
    throw new Error('unexpected request '+method+' '+href);
  };
  return {fetchImpl,calls};
}
function liveEnv(file=tempAdmission()){
  return {CLOUDFLARE_ACCOUNT_ID:ACCOUNT,CLOUDFLARE_ACCOUNT_FINGERPRINT:FINGERPRINT,CLOUDFLARE_ATTENDED_READ_TOKEN:READ,CLOUDFLARE_ATTENDED_MUTATION_TOKEN:MUTATE,
    APPROVED_SHA:SHA,API_FOOTBALL_ATTENDED_TRIGGER_SECRET:TRIGGER,API_FOOTBALL_DEPLOYED_ONE_SHOT_ADMISSION_PATH:file,CLOUDFLARE_TOPOLOGY_READ_TOKEN:TOPO_TOKEN};
}
const recheck=(value=report())=>async({env,stage})=>{
  assert.equal(stage,DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE);
  assert.equal(env.DATA_STEWARD_CLOUDFLARE_READ_TOKEN,READ);
  assert.equal(env.API_FOOTBALL_ATTENDED_VERSION_ID,DEPLOYED_ONE_SHOT_VERSION_ID);
  assert.equal(env.API_FOOTBALL_LIFECYCLE_CLONE_VERSION_ID,DEPLOYED_ONE_SHOT_CLONE_VERSION_ID);
  return value;
};
const run=(options={})=>{const fake=fakeLive(options);return executeDeployedOneShot({env:options.env??liveEnv(),fetchImpl:fake.fetchImpl,criticalRecheck:options.recheck??recheck(),wait:async()=>{}}).then(result=>({result,calls:fake.calls}));};
const triggerPosts=calls=>calls.filter(call=>call.href===TARGET&&call.method==='POST');
const subdomainCalls=calls=>calls.filter(call=>call.href===API+paths.subdomain).map(call=>call.body.enabled);
const d1Sql=calls=>calls.filter(call=>call.href===API+paths.d1).map(call=>call.body.sql);

// Admission
test('admission accepts only the exact pristine original collector with inert topology',()=>{
  const result=admission();
  assert.equal(result.ok,true);assert.equal(result.classification,DEPLOYED_ONE_SHOT_READY);assert.equal(result.version,DEPLOYED_ONE_SHOT_ADMISSION_VERSION);
  assert.equal(result.versionId,ATTENDED_VERSION_ID);assert.equal(result.retryAuthorized,false);
  assert.deepEqual(result.evidence,{productionMutations:0,apiFootballRequests:0,secretValuesRead:0});
});

test('admission fails closed for every foundational, identity, runtime or topology drift',()=>{
  const cases=[
    [report({ok:false,classification:'STOP'}),'preflight_not_ready'],
    [report({approvedSha:'c'.repeat(40)}),'preflight_identity_mismatch'],
    [report({migrationCount:5}),'migration_or_foreign_key_drift'],
    [report({foreignKeyViolations:1}),'migration_or_foreign_key_drift'],
    [report({officialFplAuthority:{valid:false,teamCount:20}}),'official_fpl_authority_invalid'],
    [report({mapping:{state:'COMMITTED',mappingCount:19,memberCount:20,distinctProviderIds:20,distinctFplIds:20,canonicalCoverageMatches:true,historicalAuthorityProvenancePresent:true}}),'mapping_drift'],
    [report({inventory:{reviewedVersionId:DEPLOYED_ONE_SHOT_CLONE_VERSION_ID}}),'version_identity_mismatch'],
    [report({inventory:{versionInventoryExact:false}}),'version_identity_mismatch'],
    [report({inventory:{reviewedWorkerId:'other'}}),'worker_identity_mismatch'],
    [report({inventory:{secretBindingNames:['API_FOOTBALL_API_KEY']}}),'secret_binding_mismatch'],
    [report({inventory:{accountSubdomain:'evil.example.com/'}}),'account_subdomain_invalid'],
    [report({modelUiImportCount:1}),'model_isolation_mismatch'],
    [report({inventory:{deploymentCount:1}}),'collector_topology_mismatch'],
    [report({inventory:{workersDev:true}}),'collector_topology_mismatch'],
    [report({inventory:{cronCount:1}}),'collector_topology_mismatch'],
    [report({inventory:{customDomainCount:1}}),'collector_topology_mismatch'],
    [report({runtime:{collectionEnabled:1}}),'collection_not_disabled'],
    [report({runtime:{credentialState:'UNPROVISIONED'}}),'credential_not_available'],
    [report({runtime:{activeLease:true}}),'active_lease'],
    [report({priorState:{requestAttempts:5}}),'history_not_pristine']
  ];
  for(const [candidate,reason] of cases){
    assert.equal(deployedOneShotAdmissionDiagnostic(candidate,{approvedSha:SHA,accountFingerprint:FINGERPRINT}),reason,reason);
    const built=buildDeployedOneShotAdmission({report:candidate,topology:TOPOLOGY,approvedSha:SHA,accountFingerprint:FINGERPRINT});
    assert.equal(built.ok,false);assert.equal(built.classification,'STOP_DEPLOYED_ONE_SHOT_ADMISSION_REVIEW_REQUIRED');
  }
  assert.equal(buildDeployedOneShotAdmission({report:report(),topology:{...TOPOLOGY,routeCount:1},approvedSha:SHA,accountFingerprint:FINGERPRINT}).reason,'zone_route_topology_not_inert');
  assert.equal(buildDeployedOneShotAdmission({report:report(),topology:null,topologyFailure:'x',approvedSha:SHA,accountFingerprint:FINGERPRINT}).reason,'zone_route_topology_unreadable');
});

test('read-only admission composes the pinned lifecycle-closeout preflight and an independent zone route scan',async()=>{
  const calls=[];
  const fetchImpl=async(url,init={})=>{
    calls.push({url:String(url),method:init.method||'GET',auth:init.headers?.Authorization});assert.equal(init.method||'GET','GET');
    const parsed=new URL(url);
    if(parsed.pathname==='/client/v4/zones')return json({success:true,result:[{id:'zone-a',account:{id:ACCOUNT}}],result_info:{total_pages:1}});
    if(parsed.pathname==='/client/v4/zones/zone-a/workers/routes')return json({success:true,result:[{id:'r',pattern:'example.com/*',script:'other-worker'}]});
    throw new Error('unexpected '+url);
  };
  const env={DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID:ACCOUNT,DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT:FINGERPRINT,DATA_STEWARD_CLOUDFLARE_READ_TOKEN:'read',CLOUDFLARE_TOPOLOGY_READ_TOKEN:'topology',APPROVED_SHA:SHA};
  const result=await runDeployedOneShotAdmission({env,fetchImpl,preflight:async({env:preflightEnv,stage})=>{
    assert.equal(stage,DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE);assert.equal(preflightEnv.API_FOOTBALL_LIFECYCLE_CLONE_APPROVED_SHA,DEPLOYED_ONE_SHOT_CLONE_APPROVED_SHA);return report();}});
  assert.equal(result.ok,true);assert.equal(result.topology.routeRowCount,1);assert.equal(result.topology.routeCount,0);
  assert.ok(calls.every(call=>call.auth==='Bearer topology'));
  const sameToken=await runDeployedOneShotAdmission({env:{...env,CLOUDFLARE_TOPOLOGY_READ_TOKEN:'read'},fetchImpl,preflight:async()=>report()});
  assert.equal(sameToken.ok,false);
  const routed=await runDeployedOneShotAdmission({env,preflight:async()=>report(),fetchImpl:async url=>new URL(url).pathname.endsWith('/routes')?json({success:true,result:[{id:'r',pattern:'x/*',script:DEPLOYED_ONE_SHOT_WORKER}]}):json({success:true,result:[{id:'zone-a',account:{id:ACCOUNT}}],result_info:{total_pages:1}})});
  assert.equal(routed.ok,false);assert.equal(routed.reason,'zone_route_topology_not_inert');
});

// Deployment / traffic / trigger
test('successful execution deploys the exact reviewed Version once, uses workers.dev only and sends one trigger',async()=>{
  const {result,calls}=await run();
  assert.equal(result.ok,true);assert.equal(result.classification,'DEPLOYED_ONE_SHOT_TRIGGER_ACCEPTED_RECONCILIATION_REQUIRED');
  const deployPosts=calls.filter(call=>call.href===API+paths.deployments&&call.method==='POST');
  assert.equal(deployPosts.length,1);
  assert.deepEqual(deployPosts[0].body.versions,[{version_id:ATTENDED_VERSION_ID,percentage:100}]);assert.equal(deployPosts[0].body.strategy,'percentage');
  assert.equal(deployPosts[0].headers.Authorization,'Bearer '+MUTATE);
  assert.equal(calls.find(call=>call.href===API+paths.deployments&&call.method==='GET').headers.Authorization,'Bearer '+READ);
  assert.deepEqual(subdomainCalls(calls),[true,false]);
  assert.ok(calls.filter(call=>call.href===API+paths.subdomain).every(call=>call.body.previews_enabled===false));
  assert.equal(triggerPosts(calls).length,1);
  assert.equal(triggerPosts(calls)[0].headers['x-teamsheet-attended-trigger'],TRIGGER);
  assert.deepEqual(d1Sql(calls),[DEPLOYED_ONE_SHOT_RUNTIME_SQL.enable.sql,DEPLOYED_ONE_SHOT_RUNTIME_SQL.disable.sql]);
  assert.deepEqual(result.mutations,{createDeployment:1,enableWorkersDev:1,disableWorkersDev:1});
  const firstRouteRead=calls.findIndex(call=>call.href.endsWith('/zones/zone-a/workers/routes')),firstMutation=calls.findIndex(call=>call.method==='POST');
  assert.ok(firstRouteRead>=0&&firstRouteRead<firstMutation,'final zone route scan precedes the first mutation');
  assert.deepEqual(result.finalRouteScan,{proof:'ZONE_ROUTE_SCAN',zoneCount:1,routeRowCount:1,routeCount:0});
  assert.ok(calls.every(call=>!/\/versions|\/schedules|workers\/domains|preview/i.test(call.href)&&call.method!=='DELETE'&&call.method!=='PUT'));
  // Route endpoints are touched only by the read-only final scan: GET with the topology credential, never mutated.
  const routeCalls=calls.filter(call=>/\/zones/.test(call.href));
  assert.ok(routeCalls.length>0&&routeCalls.every(call=>call.method==='GET'&&call.headers.Authorization==='Bearer '+TOPO_TOKEN));
  const evidence=buildDeployedOneShotExecutionEvidence(result,{approvedSha:SHA});
  assert.equal(evidence.version,DEPLOYED_ONE_SHOT_EXECUTION_VERSION);assert.equal(evidence.triggerRequests,1);assert.equal(evidence.deployment.deploymentId,'dep-1');
  const serialized=JSON.stringify(evidence);
  for(const secret of [TRIGGER,READ,MUTATE,ACCOUNT])assert.equal(serialized.includes(secret),false);
});

test('target hostname is derived only from trusted metadata and closed constants',()=>{
  assert.equal(deriveWorkersDevTarget({accountSubdomain:SUBDOMAIN}).href,TARGET);
  for(const bad of ['evil.com/x','a@b','UPPER','','-x','x'.repeat(64),'x.y'])assert.throws(()=>deriveWorkersDevTarget({accountSubdomain:bad}),/DEPLOYED_ONE_SHOT_TARGET_INVALID/);
  assert.throws(()=>deriveWorkersDevTarget({accountSubdomain:SUBDOMAIN,workerName:'teamsheet-api-football-shadow-collector-v2'}),/TARGET_INVALID/);
  assert.throws(()=>deriveWorkersDevTarget({accountSubdomain:SUBDOMAIN,path:'/other'}),/TARGET_INVALID/);
  assert.deepEqual(buildDeploymentBody(SHA).versions,[{version_id:ATTENDED_VERSION_ID,percentage:100}]);
  assert.throws(()=>buildDeploymentBody('nope'));
});

test('closed endpoint allowlist refuses Version upload, schedules, routes, domains and deletes',()=>{
  assert.equal(assertDeployedOneShotRequestAllowed('POST',paths.deployments,{accountId:ACCOUNT}),'MUTATION');
  assert.equal(assertDeployedOneShotRequestAllowed('GET',paths.deployments,{accountId:ACCOUNT}),'READ');
  const script=`/accounts/${ACCOUNT}/workers/scripts/${DEPLOYED_ONE_SHOT_WORKER}`;
  for(const [method,p] of [['POST',script+'/versions'],['PUT',script+'/schedules'],['DELETE',paths.deployments],['POST',`/accounts/${ACCOUNT}/workers/domains`],['POST','/zones/z/workers/routes'],['GET',paths.d1],['POST',`/accounts/${ACCOUNT}/workers/scripts/teamsheet-api-football-shadow-collector-v2/deployments`]])
    assert.throws(()=>assertDeployedOneShotRequestAllowed(method,p,{accountId:ACCOUNT}),/ENDPOINT_FORBIDDEN/);
  assert.equal(paths.d1.includes(EXPECTED_D1_DATABASE_ID),true);
});

test('wrong Version in the Deployment response or readback stops before any traffic surface',async()=>{
  for(const options of [{deploy:'wrong',readback:'none'},{deploy:'wrong',readback:'two'},{readback:'none'},{readback:'two'}]){
    const {result,calls}=await run(options);
    assert.equal(result.ok,false);assert.equal(triggerPosts(calls).length,0);
    assert.equal(result.collectionEnableSucceeded,false);
    assert.deepEqual(subdomainCalls(calls),[false]);
    assert.equal(calls.filter(call=>call.href===API+paths.deployments&&call.method==='POST').length,1);
  }
});

test('Deployment rejection and ambiguity never resend the POST, read back exactly once and still run cleanup',async()=>{
  for(const [deploy,readback,diagnostic,outcome] of [
    ['reject','exact','DEPLOYED_ONE_SHOT_DEPLOYMENT_REJECTED','REJECTED'],
    ['throw','none','DEPLOYED_ONE_SHOT_DEPLOYMENT_NOT_APPLIED','NOT_APPLIED'],['server','none','DEPLOYED_ONE_SHOT_DEPLOYMENT_NOT_APPLIED','NOT_APPLIED'],
    ['throw','two','DEPLOYED_ONE_SHOT_DEPLOYMENT_AMBIGUOUS','AMBIGUOUS_OWNER_ATTENTION'],['server','two','DEPLOYED_ONE_SHOT_DEPLOYMENT_AMBIGUOUS','AMBIGUOUS_OWNER_ATTENTION']]){
    const {result,calls}=await run({deploy,readback});
    assert.equal(result.primaryFailure,diagnostic);assert.equal(result.deployment.outcome,outcome);
    assert.equal(calls.filter(call=>call.href===API+paths.deployments&&call.method==='POST').length,1);
    assert.equal(calls.filter(call=>call.href===API+paths.deployments&&call.method==='GET').length,outcome==='REJECTED'?0:1);
    assert.equal(triggerPosts(calls).length,0);
    assert.equal(result.cleanup.collectionDisable.attempted,true);assert.equal(result.cleanup.workersDevDisable.attempted,true);
    assert.equal(result.retryAuthorized,false);
  }
});

test('an applied Deployment whose POST response was ambiguous is confirmed by one readback and continues without a second POST',async()=>{
  for(const deploy of ['throw','server','wrong']){
    const {result,calls}=await run({deploy});
    assert.equal(result.deployment.outcome,'APPLIED_CONFIRMED_BY_READBACK');assert.equal(result.deployment.deploymentId,'dep-1');
    assert.equal(calls.filter(call=>call.href===API+paths.deployments&&call.method==='POST').length,1);
    assert.equal(result.mutations.createDeployment,1);assert.equal(result.ok,true);
  }
});

test('readiness failure stops before collection enablement and the trigger',async()=>{
  const {result,calls}=await run({readinessFailures:99});
  assert.equal(result.primaryFailure,'DEPLOYED_ONE_SHOT_READINESS_NOT_PROVEN');
  assert.equal(result.readiness.attempts,7);assert.equal(triggerPosts(calls).length,0);
  assert.deepEqual(d1Sql(calls),[DEPLOYED_ONE_SHOT_RUNTIME_SQL.disable.sql]);assert.deepEqual(subdomainCalls(calls),[true,false]);
  const late=await run({readinessFailures:2});assert.equal(late.result.ok,true);assert.equal(late.result.readiness.attempts,3);
});

test('trigger is attempted at most once: ambiguous or rejected trigger is never retried',async()=>{
  for(const [trigger,diagnostic] of [['throw','DEPLOYED_ONE_SHOT_TRIGGER_TRANSPORT_AMBIGUOUS'],['rejected','DEPLOYED_ONE_SHOT_TRIGGER_REJECTED'],['not-accepted','DEPLOYED_ONE_SHOT_COLLECTION_NOT_ACCEPTED']]){
    const {result,calls}=await run({trigger});
    assert.equal(triggerPosts(calls).length,1);assert.equal(result.triggerRequests,1);assert.equal(result.primaryFailure,diagnostic);
    assert.deepEqual(subdomainCalls(calls),[true,false]);assert.deepEqual(d1Sql(calls),[DEPLOYED_ONE_SHOT_RUNTIME_SQL.enable.sql,DEPLOYED_ONE_SHOT_RUNTIME_SQL.disable.sql]);
    assert.equal(result.ok,false);
  }
});

test('collection enablement ambiguity stops before the trigger and cleanup still disables',async()=>{
  const {result,calls}=await run({enableD1:'throw'});
  assert.equal(result.primaryFailure,'DEPLOYED_ONE_SHOT_COLLECTION_ENABLE_AMBIGUOUS');assert.equal(triggerPosts(calls).length,0);
  assert.deepEqual(d1Sql(calls),[DEPLOYED_ONE_SHOT_RUNTIME_SQL.enable.sql,DEPLOYED_ONE_SHOT_RUNTIME_SQL.disable.sql]);
  assert.equal(result.controlBudget.d1Calls,DEPLOYED_ONE_SHOT_MAX_D1_CALLS);
  const zero=await run({enableD1:'zero'});assert.equal(zero.result.primaryFailure,'DEPLOYED_ONE_SHOT_COLLECTION_ENABLE_AMBIGUOUS');
});

test('workers.dev enable ambiguity stops before collection enablement',async()=>{
  for(const enableDev of ['throw','mismatch']){
    const {result,calls}=await run({enableDev});
    assert.match(result.primaryFailure,/DEPLOYED_ONE_SHOT_WORKERS_DEV_ENABLE_/);assert.equal(triggerPosts(calls).length,0);
    assert.deepEqual(d1Sql(calls),[DEPLOYED_ONE_SHOT_RUNTIME_SQL.disable.sql]);assert.deepEqual(subdomainCalls(calls),[true,false]);
  }
});

test('cleanup failure never manufactures success and stays distinguishable from the primary failure',async()=>{
  const devFail=await run({disableDev:'throw'});
  assert.equal(devFail.result.ok,false);assert.equal(devFail.result.primaryFailure,null);
  assert.equal(devFail.result.cleanupFailure,'DEPLOYED_ONE_SHOT_WORKERS_DEV_DISABLE_AMBIGUOUS');
  assert.equal(devFail.result.cleanup.collectionDisable.outcome,'SUCCEEDED');
  const both=await run({trigger:'throw',disableD1:'throw'});
  assert.equal(both.result.primaryFailure,'DEPLOYED_ONE_SHOT_TRIGGER_TRANSPORT_AMBIGUOUS');
  assert.equal(both.result.cleanupFailure,'DEPLOYED_ONE_SHOT_COLLECTION_DISABLE_AMBIGUOUS');
  assert.equal(both.result.cleanup.workersDevDisable.outcome,'SUCCEEDED');
  const idempotent=await run({disableD1:'zero'});assert.equal(idempotent.result.ok,true);
});

test('pure orchestrator attempts both cleanups for every failure point',async()=>{
  const stages=['createDeployment','verifyDeployment','enableWorkersDev','proveReadiness','enableCollection','triggerOnce'];
  for(const failing of stages){
    const log=[];
    const ops=Object.fromEntries(stages.map(name=>[name,async()=>{log.push(name);if(name===failing)throw new Error('DEPLOYED_ONE_SHOT_TEST_'+name.toUpperCase());return name==='triggerOnce'?{requestCount:1,outcome:'ACCEPTED'}:undefined;}]));
    ops.disableCollection=async()=>{log.push('disableCollection');};ops.disableWorkersDev=async()=>{log.push('disableWorkersDev');};
    const result=await runDeployedOneShot({admissionValid:true,ops});
    assert.equal(result.ok,false);assert.equal(result.primaryFailure,'DEPLOYED_ONE_SHOT_TEST_'+failing.toUpperCase());
    assert.deepEqual(log.slice(-2),['disableCollection','disableWorkersDev']);
    assert.equal(log.filter(name=>name==='triggerOnce').length,stages.indexOf(failing)>=5?1:0);
  }
  const unexpected=await runDeployedOneShot({admissionValid:true,ops:{...Object.fromEntries(stages.map(name=>[name,async()=>{throw new Error('raw text with secret');}])),disableCollection:async()=>{},disableWorkersDev:async()=>{}}});
  assert.equal(unexpected.primaryFailure,'DEPLOYED_ONE_SHOT_UNEXPECTED_FAILURE');
  assert.equal((await runDeployedOneShot({admissionValid:false,ops:{}})).classification,'DEPLOYED_ONE_SHOT_NOT_ADMITTED');
});

test('pre-mutation gates: handoff, critical recheck drift, credential separation and account identity',async()=>{
  const drifted=await run({recheck:recheck(report({runtime:{activeLease:true}}))}).catch(error=>error);
  assert.match(drifted.message,/DEPLOYED_ONE_SHOT_CRITICAL_STATE_DRIFT__ACTIVE_LEASE/);
  for(const env of [{...liveEnv(),CLOUDFLARE_ATTENDED_MUTATION_TOKEN:READ},{...liveEnv(),CLOUDFLARE_ACCOUNT_FINGERPRINT:'0'.repeat(64)},{...liveEnv(),API_FOOTBALL_ATTENDED_TRIGGER_SECRET:'short'},{...liveEnv(),APPROVED_SHA:'c'.repeat(40)},
    liveEnv(tempAdmission({...admission(),ok:false})),liveEnv(tempAdmission({...admission(),topology:{...TOPOLOGY,routeCount:1}}))]){
    const fake=fakeLive();
    await assert.rejects(executeDeployedOneShot({env,fetchImpl:fake.fetchImpl,criticalRecheck:recheck(),wait:async()=>{}}),/DEPLOYED_ONE_SHOT_/);
    assert.equal(fake.calls.length,0);
  }
  const failure=buildDeployedOneShotPreMutationFailure(new Error('DEPLOYED_ONE_SHOT_ADMISSION_HANDOFF_INVALID'),{approvedSha:SHA});
  assert.equal(failure.classification,'DEPLOYED_ONE_SHOT_STOPPED_BEFORE_MUTATION');assert.equal(failure.triggerRequests,0);
  assert.equal(buildDeployedOneShotPreMutationFailure(new Error('arbitrary remote text'),{}).diagnostic,'DEPLOYED_ONE_SHOT_UNEXPECTED_FAILURE');
});

// Reconciliation
const execution=(overrides={})=>({version:DEPLOYED_ONE_SHOT_EXECUTION_VERSION,approvedSha:SHA,versionId:ATTENDED_VERSION_ID,retryAuthorized:false,triggerRequests:1,deployment:{outcome:'CREATED',deploymentId:'dep-1'},...overrides});
const postRun=(overrides={})=>report({ok:false,classification:'STOP_VERSION_URL_CREATION_EXPERIMENT_CLOSEOUT_REVIEW_REQUIRED',reason:'lifecycle_clone_inventory_unexpected',inventory:{deploymentCount:1},priorState:successHistory,...overrides});
const deployed={count:1,exactSingle:true,deploymentId:'dep-1'};
const reconcile=(input={})=>classifyDeployedOneShotReconciliation({report:postRun(),deployments:deployed,topology:TOPOLOGY,execution:execution(),approvedSha:SHA,accountFingerprint:FINGERPRINT,...input});

test('reconciled success is classified only from independently read state',()=>{
  const result=reconcile();
  assert.equal(result.ok,true);assert.equal(result.classification,'DEPLOYED_ONE_SHOT_RECONCILED_SUCCESS');assert.equal(result.retryAuthorized,false);
  // A trigger that "succeeded" is not enough: partial state fails closed.
  assert.equal(reconcile({report:postRun({priorState:{...successHistory,succeededAttemptCount:4}})}).reason,'collection_state_ambiguous');
  assert.equal(reconcile({execution:null}).reason,'execution_evidence_inconsistent');
});

test('reconciliation fails closed for every unsafe or ambiguous post-run state',()=>{
  const cases=[
    [{report:postRun({inventory:{deploymentCount:1,workersDev:true}})},'workers_dev_cleanup_incomplete'],
    [{report:postRun({inventory:{deploymentCount:1,previewUrls:true}})},'preview_urls_enabled'],
    [{report:postRun({runtime:{collectionEnabled:1}})},'collection_cleanup_incomplete'],
    [{report:postRun({inventory:{deploymentCount:1,cronCount:1}})},'cron_present'],
    [{report:postRun({inventory:{deploymentCount:1,customDomainCount:1}})},'custom_domain_present'],
    [{topology:{...TOPOLOGY,routeCount:1}},'route_present_or_unproven'],
    [{topology:null},'route_present_or_unproven'],
    [{deployments:null},'deployment_state_unreadable'],
    [{deployments:{count:2,exactSingle:false,deploymentId:null},report:postRun({inventory:{deploymentCount:2}})},'deployment_identity_unexpected'],
    [{deployments:{count:1,exactSingle:false,deploymentId:'dep-1'}},'deployment_identity_unexpected'],
    [{deployments:{count:1,exactSingle:true,deploymentId:'dep-9'}},'deployment_identity_unexpected'],
    [{deployments:{count:0,exactSingle:false,deploymentId:null}},'deployment_state_inconsistent'],
    [{report:postRun({runtime:{activeLease:true}})},'active_lease'],
    [{report:postRun({runtime:{credentialState:'INVALID'},priorState:{...successHistory,authFailureCount:1}})},'authentication_failure'],
    [{report:postRun({priorState:{...successHistory,quotaBlockedCount:1}})},'quota_blocked'],
    [{report:postRun({priorState:{...successHistory,timeoutCount:1}})},'timeout_attempt_consumed'],
    [{report:postRun({priorState:{...successHistory,schemaFailureCount:1}})},'schema_failure'],
    [{report:postRun({priorState:{...successHistory,reservedAttemptCount:1}})},'reserved_attempt_unresolved'],
    [{report:postRun({priorState:{...successHistory,stagingGenerationCount:1}})},'staging_generation_unresolved'],
    [{report:postRun({priorState:{...successHistory,attempt2Count:1}})},'retry_attempt_detected'],
    [{report:postRun({priorState:{...successHistory,fixtureRevisions:2501}})},'collection_state_ambiguous'],
    [{report:postRun({priorState:{...successHistory,headMatchCount:0}})},'collection_state_ambiguous'],
    [{report:postRun({modelUiImportCount:1})},'model_isolation_mismatch'],
    [{report:postRun({rawPayloadStoragePresent:true})},'model_isolation_mismatch'],
    [{report:postRun({mapping:{state:'COMMITTED',mappingCount:20,memberCount:19,distinctProviderIds:20,distinctFplIds:20,canonicalCoverageMatches:true,historicalAuthorityProvenancePresent:true}})},'mapping_drift'],
    [{report:postRun({officialFplAuthority:{valid:false}})},'official_fpl_authority_invalid'],
    [{report:{ok:false,reason:'activation_d1_read_failed'}},'preflight_unreadable'],
    [{report:null},'preflight_unreadable']
  ];
  for(const [input,reason] of cases){
    const result=reconcile(input);
    assert.equal(result.ok,false,reason);assert.equal(result.reason,reason,reason);assert.equal(result.retryAuthorized,false);
  }
});

test('pristine post-run state is a clean no-provider stop, never success',()=>{
  const pristine=report({ok:false,classification:'STOP',reason:'lifecycle_clone_inventory_unexpected',inventory:{deploymentCount:1}});
  const stopped=reconcile({report:pristine,execution:execution({triggerRequests:0,deployment:{outcome:'CREATED',deploymentId:'dep-1'}})});
  assert.equal(stopped.ok,false);assert.equal(stopped.classification,'DEPLOYED_ONE_SHOT_CLEAN_STOP_NO_PROVIDER_REQUEST');assert.equal(stopped.reason,'stopped_before_trigger');
  const noDeployment=reconcile({report:report(),deployments:{count:0,exactSingle:false,deploymentId:null},execution:execution({triggerRequests:0,deployment:{outcome:'REJECTED',deploymentId:null}})});
  assert.equal(noDeployment.classification,'DEPLOYED_ONE_SHOT_CLEAN_STOP_NO_PROVIDER_REQUEST');
});

test('read-only reconciliation composes preflight, Deployment read and zone scan with zero mutations',async()=>{
  const calls=[];
  const fetchImpl=async(url,init={})=>{
    calls.push({url:String(url),method:init.method||'GET'});assert.equal(init.method||'GET','GET');
    const parsed=new URL(url);
    if(parsed.pathname.endsWith('/deployments'))return json({success:true,result:{deployments:[exactDeployment]}});
    if(parsed.pathname==='/client/v4/zones')return json({success:true,result:[],result_info:{total_pages:0}});
    throw new Error('unexpected '+url);
  };
  const env={DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID:ACCOUNT,DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT:FINGERPRINT,DATA_STEWARD_CLOUDFLARE_READ_TOKEN:'read',CLOUDFLARE_TOPOLOGY_READ_TOKEN:'topology',APPROVED_SHA:SHA};
  const result=await runDeployedOneShotReconciliation({env,fetchImpl,preflight:async()=>postRun(),execution:execution()});
  assert.equal(result.ok,true);assert.equal(result.classification,'DEPLOYED_ONE_SHOT_RECONCILED_SUCCESS');
  assert.deepEqual(result.evidence,{productionMutations:0,apiFootballRequests:0,secretValuesRead:0});
  assert.equal(result.observed.topology.deploymentExact,true);assert.equal(result.observed.topology.zoneRouteCount,0);
  assert.ok(calls.every(call=>call.method==='GET'));
});

// Provider and model boundary (repository-level)
test('provider ceiling, endpoint set and model/product isolation are unchanged',()=>{
  assert.equal(DEPLOYED_ONE_SHOT_MAX_PROVIDER_REQUESTS,5);
  assert.deepEqual(DEPLOYED_ONE_SHOT_CLOUDFLARE_MUTATION_CEILINGS,{createDeployment:1,enableWorkersDev:1,disableWorkersDev:1});
  const sources=['deployed-one-shot.mjs','deployed-one-shot-readonly.mjs','run-deployed-one-shot.mjs'].map(file=>fs.readFileSync(path.join('workers/api-football-collector',file),'utf8')).join('\n');
  assert.doesNotMatch(sources,/v3\.football\.api-sports\.io|x-apisports-key|lineups|fixtures\/players|fixtures\/events|API_FOOTBALL_API_KEY:|versions\/upload|method:'DELETE'|method:'PUT'/);
  for(const file of fs.readdirSync('src').filter(name=>name.endsWith('.js')||name.endsWith('.mjs')))assert.doesNotMatch(fs.readFileSync(path.join('src',file),'utf8'),/deployed-one-shot/);
  for(const file of ['build.mjs','index.html','dist/index.html'])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/deployed-one-shot|attended-one-shot/);
  const wrangler=fs.readFileSync('workers/api-football-collector/wrangler.jsonc','utf8');
  assert.match(wrangler,/"crons":\s*\[\s*\]/);
});

test('workflow is dormant, manual, first-attempt-only, exact-main and least-privilege',()=>{
  const source=fs.readFileSync('.github/workflows/api-football-deployed-one-shot-collection.yml','utf8');
  assert.match(source,/^on:\n  workflow_dispatch:/m);assert.doesNotMatch(source,/^\s{2}(?:schedule|push|pull_request|workflow_run|repository_dispatch):/m);
  assert.equal((source.match(/github\.run_attempt == 1/g)||[]).length,4);
  assert.match(source,/Tests and deterministic build/);
  assert.match(source,/name: data-steward-readonly/);assert.match(source,/name: api-football-attended-acceptance/);
  assert.doesNotMatch(source,/secrets\.API_FOOTBALL_API_KEY|x-apisports-key|v3\.football\.api-sports\.io|wrangler|CLOUDFLARE_REPLACEMENT_MUTATION_TOKEN|teamsheet-api-football-shadow-collector-v2/);
  for(const line of source.split('\n').filter(line=>/uses:/.test(line)))assert.match(line,/@[0-9a-f]{40}/,line);
  // Mutation credentials appear only in the protected execution job.
  const jobs=source.split(/\n  (?=[a-z-]+:\n    if:)/);
  const protectedJob=jobs.find(job=>job.startsWith('protected-one-shot-execution'));
  for(const job of jobs.filter(job=>job!==protectedJob))assert.doesNotMatch(job,/CLOUDFLARE_ATTENDED_MUTATION_TOKEN|API_FOOTBALL_ATTENDED_TRIGGER_SECRET/);
  assert.match(protectedJob,/CLOUDFLARE_ATTENDED_MUTATION_TOKEN/);assert.match(protectedJob,/API_FOOTBALL_ATTENDED_TRIGGER_SECRET/);
  assert.doesNotMatch(protectedJob,/DATA_STEWARD_CLOUDFLARE_READ_TOKEN/);
  // The topology credential reaches the protected job only as the read-only final route-scan input.
  assert.equal((protectedJob.match(/CLOUDFLARE_REPLACEMENT_TOPOLOGY_READ_TOKEN/g)||[]).length,1);
  assert.match(protectedJob,/CLOUDFLARE_TOPOLOGY_READ_TOKEN: \$\{\{ secrets\.CLOUDFLARE_REPLACEMENT_TOPOLOGY_READ_TOKEN \}\}/);
  assert.match(source,/permissions:\n  contents: read\n  actions: read\n  checks: read\n/);
});

// Final pre-mutation route scan (closes the admission-to-execution gap)
const mutationOrTrigger=calls=>calls.filter(call=>call.method==='POST');

test('a route, malformed topology or failed topology read after admission stops before any mutation',async()=>{
  for(const [zones,diagnostic] of [['route','DEPLOYED_ONE_SHOT_FINAL_ROUTE_SCAN_NOT_INERT'],['malformed','DEPLOYED_ONE_SHOT_FINAL_ROUTE_SCAN_FAILED'],
    ['badrow','DEPLOYED_ONE_SHOT_FINAL_ROUTE_SCAN_FAILED'],['throw','DEPLOYED_ONE_SHOT_FINAL_ROUTE_SCAN_FAILED'],['http','DEPLOYED_ONE_SHOT_FINAL_ROUTE_SCAN_FAILED']]){
    const fake=fakeLive({zones});
    await assert.rejects(executeDeployedOneShot({env:liveEnv(),fetchImpl:fake.fetchImpl,criticalRecheck:recheck(),wait:async()=>{}}),new RegExp(diagnostic),zones);
    assert.equal(mutationOrTrigger(fake.calls).length,0,zones);
    assert.equal(fake.calls.filter(call=>call.href.includes('/deployments')||call.href.includes('/subdomain')||call.href.includes('/d1/')||call.href===TARGET).length,0,zones);
    assert.ok(fake.calls.every(call=>call.method==='GET'&&call.headers.Authorization==='Bearer '+TOPO_TOKEN),zones);
    const evidence=buildDeployedOneShotPreMutationFailure(new Error(diagnostic),{approvedSha:SHA});
    assert.equal(evidence.diagnostic,diagnostic);assert.equal(evidence.triggerRequests,0);
    assert.deepEqual(evidence.mutations,{createDeployment:0,enableWorkersDev:0,disableWorkersDev:0});assert.deepEqual(evidence.controlBudget,{d1Calls:0,d1RowsChanged:0});
  }
});

test('final route scan targets the original collector, never replacement-v2, and requires a distinct topology credential',async()=>{
  let seen=null;
  const scan=await deployedOneShotFinalRouteScan({accountId:ACCOUNT,topologyToken:TOPO_TOKEN,fetchImpl:async()=>{throw new Error('unused');},
    routeScan:async options=>{seen=options;return {proof:'ZONE_ROUTE_SCAN',zoneCount:2,routeRowCount:3,routeCount:0};}});
  assert.equal(seen.workerName,DEPLOYED_ONE_SHOT_WORKER);assert.notEqual(seen.workerName,REPLACEMENT_COLLECTOR);assert.equal(seen.topologyToken,TOPO_TOKEN);
  assert.deepEqual(scan,{proof:'ZONE_ROUTE_SCAN',zoneCount:2,routeRowCount:3,routeCount:0});
  for(const bad of [{proof:'LEGACY_SCRIPT_INVENTORY',zoneCount:1,routeRowCount:0,routeCount:0},{proof:'ZONE_ROUTE_SCAN',zoneCount:-1,routeRowCount:0,routeCount:0},
    {proof:'ZONE_ROUTE_SCAN',zoneCount:1,routeRowCount:null,routeCount:0},{proof:'ZONE_ROUTE_SCAN',zoneCount:1,routeRowCount:1,routeCount:1},null])
    await assert.rejects(deployedOneShotFinalRouteScan({accountId:ACCOUNT,topologyToken:TOPO_TOKEN,fetchImpl:null,routeScan:async()=>bad}),/FINAL_ROUTE_SCAN_NOT_INERT/);
  for(const env of [{...liveEnv(),CLOUDFLARE_TOPOLOGY_READ_TOKEN:MUTATE},{...liveEnv(),CLOUDFLARE_TOPOLOGY_READ_TOKEN:READ},{...liveEnv(),CLOUDFLARE_TOPOLOGY_READ_TOKEN:undefined}]){
    const fake=fakeLive();
    await assert.rejects(executeDeployedOneShot({env,fetchImpl:fake.fetchImpl,criticalRecheck:recheck(),wait:async()=>{}}),/DEPLOYED_ONE_SHOT_(?:CREDENTIAL_SEPARATION_REQUIRED|ENVIRONMENT_INCOMPLETE)/);
    assert.equal(fake.calls.length,0);
  }
  // A drifted critical recheck stops before even the route scan.
  const fake=fakeLive();
  await assert.rejects(executeDeployedOneShot({env:liveEnv(),fetchImpl:fake.fetchImpl,criticalRecheck:recheck(report({inventory:{workersDev:true}})),wait:async()=>{}}),/CRITICAL_STATE_DRIFT/);
  assert.equal(fake.calls.length,0);
});
