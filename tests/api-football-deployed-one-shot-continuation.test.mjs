import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {ATTENDED_ACCEPTANCE_PATH} from '../workers/api-football-collector/collector.mjs';
import {
  DEPLOYED_ONE_SHOT_CLONE_APPROVED_SHA,DEPLOYED_ONE_SHOT_CLONE_VERSION_ID,DEPLOYED_ONE_SHOT_CONTINUATION_ADMISSION_VERSION,DEPLOYED_ONE_SHOT_CONTINUATION_EXECUTION_VERSION,
  DEPLOYED_ONE_SHOT_CONTINUATION_MUTATION_CEILINGS,DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_REASON,DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_STOP,DEPLOYED_ONE_SHOT_CONTINUATION_READY,
  DEPLOYED_ONE_SHOT_EXISTING_DEPLOYMENT_ID,DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE,DEPLOYED_ONE_SHOT_RUNTIME_SQL,DEPLOYED_ONE_SHOT_VERSION_APPROVED_SHA,DEPLOYED_ONE_SHOT_VERSION_ID,
  DEPLOYED_ONE_SHOT_WORKER,DEPLOYED_ONE_SHOT_WORKER_ID,
  buildDeployedOneShotAdmission,buildDeployedOneShotContinuationAdmission,classifyDeployedOneShotContinuationReconciliation,classifyDeployedOneShotReconciliation,
  createDeploymentWithReadback,deployedOneShotContinuationAdmissionDiagnostic,runDeployedOneShotContinuation,validateDeployedOneShotContinuationAdmissionHandoff
} from '../workers/api-football-collector/deployed-one-shot.mjs';
import {runDeployedOneShotContinuationAdmission,runDeployedOneShotContinuationReconciliation} from '../workers/api-football-collector/deployed-one-shot-continuation-readonly.mjs';
import {deployedOneShotCloudflarePaths} from '../workers/api-football-collector/run-deployed-one-shot.mjs';
import {
  assertDeployedOneShotContinuationRequestAllowed,buildDeployedOneShotContinuationExecutionEvidence,buildDeployedOneShotContinuationPreMutationFailure,executeDeployedOneShotContinuation
} from '../workers/api-football-collector/run-deployed-one-shot-continuation.mjs';
import {REPLACEMENT_COLLECTOR} from '../workers/api-football-collector/replacement-foundation.mjs';

const ACCOUNT='production-account',FINGERPRINT=createHash('sha256').update(ACCOUNT).digest('hex');
const SHA='b'.repeat(40),SUBDOMAIN='fpltsheet',TRIGGER='t'.repeat(64),READ='attended-read',MUTATE='attended-mutate',TOPO_TOKEN='topology-read';
const API='https://api.cloudflare.com/client/v4';
const TARGET=`https://${DEPLOYED_ONE_SHOT_WORKER}.${SUBDOMAIN}.workers.dev${ATTENDED_ACCEPTANCE_PATH}`;
const paths=deployedOneShotCloudflarePaths(ACCOUNT);
const TOPOLOGY={proof:'ZONE_ROUTE_SCAN',zoneCount:1,routeRowCount:0,routeCount:0};
const EXISTING=DEPLOYED_ONE_SHOT_EXISTING_DEPLOYMENT_ID;
const exactDeployment={id:EXISTING,strategy:'percentage',versions:[{version_id:DEPLOYED_ONE_SHOT_VERSION_ID,percentage:100}]};
const DEPLOYMENTS={count:1,exactSingle:true,deploymentId:EXISTING};

// The live preflight report shape produced by run 37505586273's reconciliation: generic zero-Deployment preflight STOPs.
function report(overrides={}){
  const base={
    ok:false,stage:DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE,classification:DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_STOP,reason:DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_REASON,
    approvedSha:SHA,versionApprovedSha:DEPLOYED_ONE_SHOT_VERSION_APPROVED_SHA,cloneApprovedSha:DEPLOYED_ONE_SHOT_CLONE_APPROVED_SHA,accountFingerprint:FINGERPRINT,
    migrationCount:6,foreignKeyViolations:0,officialFplAuthority:{valid:true,teamCount:20,fetchedAt:'2026-10-06T01:20:00.000Z'},
    mapping:{state:'COMMITTED',mappingCount:20,memberCount:20,distinctProviderIds:20,distinctFplIds:20,canonicalCoverageMatches:true,historicalAuthorityProvenancePresent:true},
    runtime:{collectionEnabled:0,credentialState:'AVAILABLE',activeLease:false},
    priorState:{requestAttempts:0,generations:0,fixtureRevisions:0,attempt1Count:0,attempt2Count:0,reservedAttemptCount:0,stagingGenerationCount:0,succeededAttemptCount:0,
      authFailureCount:0,quotaBlockedCount:0,timeoutCount:0,transportUnknownCount:0,schemaFailureCount:0,httpFailureCount:0,committedGenerationCount:0,failedGenerationCount:0,
      membershipConsistentCount:0,headMatchCount:0,persistenceUncertainCount:0,completionUncertainCount:0},
    inventory:{activation:'ATTENDED_ONE_SHOT_DISCOVERY',databaseIdPlaceholder:false,productionBindingProven:true,configurationExact:true,workerPresent:true,deploymentCount:1,cronCount:0,routeCount:0,customDomainCount:0,
      workersDev:false,previewUrls:false,secretBindingPresent:true,secretBindingNames:['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET'],
      reviewedVersionId:DEPLOYED_ONE_SHOT_VERSION_ID,reviewedWorkerId:DEPLOYED_ONE_SHOT_WORKER_ID,versionIdentityExact:true,versionInventoryExact:true,
      cloneVersionId:DEPLOYED_ONE_SHOT_CLONE_VERSION_ID,cloneVersionIdentityExact:true,previewUrlIdentityExact:true,accountSubdomain:SUBDOMAIN},
    modelUiImportCount:0,rawPayloadStoragePresent:false,evidence:{productionMutations:0,apiFootballRequests:0,secretValuesRead:0}
  };
  return structuredClone({...base,...overrides,inventory:{...base.inventory,...overrides.inventory},runtime:{...base.runtime,...overrides.runtime},priorState:{...base.priorState,...overrides.priorState}});
}
const successHistory={requestAttempts:5,attempt1Count:5,succeededAttemptCount:5,generations:1,committedGenerationCount:1,membershipConsistentCount:1,headMatchCount:1,fixtureRevisions:380};
const diag=(r=report(),d=DEPLOYMENTS)=>deployedOneShotContinuationAdmissionDiagnostic(r,d,{approvedSha:SHA,accountFingerprint:FINGERPRINT});
const admission=()=>buildDeployedOneShotContinuationAdmission({report:report(),deployments:DEPLOYMENTS,topology:TOPOLOGY,approvedSha:SHA,accountFingerprint:FINGERPRINT});
function tempAdmission(value=admission()){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'continuation-'));const file=path.join(dir,'admission.json');fs.writeFileSync(file,JSON.stringify(value));return file;}
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
const worker=(status,body)=>new Response(body,{status,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});

function fakeLive({zones='ok',deployments='exact',deploymentsAfterFirst=null,enableDev='ok',readinessFailures=0,trigger='accepted',enableD1='ok',disableD1='ok',disableDev='ok'}={}){
  const calls=[];let deploymentGets=0;
  const fetchImpl=async(url,init={})=>{
    const href=String(url),method=init.method||'GET',body=init.body?JSON.parse(init.body):null;
    calls.push({href,method,body,headers:init.headers??{}});
    const parsed=new URL(href);
    if(parsed.pathname==='/client/v4/zones'){
      assert.equal(method,'GET');assert.equal(init.headers?.Authorization,'Bearer '+TOPO_TOKEN);
      if(zones==='throw')throw new Error('reset');
      return json({success:true,result:[{id:'zone-a',account:{id:ACCOUNT}}],result_info:{total_pages:1}});
    }
    if(parsed.pathname==='/client/v4/zones/zone-a/workers/routes'){
      assert.equal(method,'GET');
      const rows=[{id:'r0',pattern:'other.example/*',script:REPLACEMENT_COLLECTOR}];
      if(zones==='route')rows.push({id:'r1',pattern:'example.com/*',script:DEPLOYED_ONE_SHOT_WORKER});
      return json({success:true,result:rows});
    }
    if(href===API+paths.deployments&&method==='GET'){
      deploymentGets+=1;
      const mode=deploymentGets>1&&deploymentsAfterFirst?deploymentsAfterFirst:deployments;
      if(mode==='throw')throw new Error('reset');
      if(mode==='malformed')return json({success:true,result:{deployments:'x'}});
      const rows=mode==='exact'?[exactDeployment]:mode==='two'?[exactDeployment,{...exactDeployment,id:'dep-0'}]:mode==='wrong-id'?[{...exactDeployment,id:'other'}]:mode==='wrong-version'?[{...exactDeployment,versions:[{version_id:DEPLOYED_ONE_SHOT_CLONE_VERSION_ID,percentage:100}]}]:mode==='split'?[{...exactDeployment,versions:[{version_id:DEPLOYED_ONE_SHOT_VERSION_ID,percentage:50}]}]:[];
      return json({success:true,result:{deployments:rows}});
    }
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
const recheck=(value=report())=>async()=>value;
const run=(options={})=>{const fake=fakeLive(options);return executeDeployedOneShotContinuation({env:options.env??liveEnv(),fetchImpl:fake.fetchImpl,criticalRecheck:options.recheck??recheck(),wait:async()=>{}}).then(result=>({result,calls:fake.calls}));};
const triggerPosts=calls=>calls.filter(call=>call.href===TARGET&&call.method==='POST');
const subdomainCalls=calls=>calls.filter(call=>call.href===API+paths.subdomain).map(call=>call.body.enabled);
const d1Sql=calls=>calls.filter(call=>call.href===API+paths.d1).map(call=>call.body.sql);
const deploymentPosts=calls=>calls.filter(call=>call.href===API+paths.deployments&&call.method!=='GET');
const mutationCalls=calls=>calls.filter(call=>call.method!=='GET'&&call.href!==TARGET);

// ---- Continuation admission ----
test('continuation admission accepts only the exact single inert Deployment state',()=>{
  const result=admission();
  assert.equal(result.ok,true);assert.equal(result.classification,DEPLOYED_ONE_SHOT_CONTINUATION_READY);assert.equal(result.version,DEPLOYED_ONE_SHOT_CONTINUATION_ADMISSION_VERSION);
  assert.equal(result.deploymentId,EXISTING);assert.equal(result.retryAuthorized,false);assert.equal(validateDeployedOneShotContinuationAdmissionHandoff(result,{approvedSha:SHA,accountFingerprint:FINGERPRINT}),true);
  assert.deepEqual(result.evidence,{productionMutations:0,apiFootballRequests:0,secretValuesRead:0});
});

test('continuation admission fails closed for every Deployment, topology, runtime, history and foundational drift',()=>{
  const cases=[
    [report(),{count:0,exactSingle:false,deploymentId:null},'deployment_identity_unexpected'],
    [report(),{count:2,exactSingle:false,deploymentId:null},'deployment_identity_unexpected'],
    [report(),{count:1,exactSingle:true,deploymentId:'other'},'deployment_identity_unexpected'],
    [report(),{count:1,exactSingle:false,deploymentId:EXISTING},'deployment_identity_unexpected'],
    [report(),null,'deployment_state_unreadable'],
    [report({inventory:{deploymentCount:0}}),DEPLOYMENTS,'deployment_identity_unexpected'],
    [report({inventory:{workersDev:true}}),DEPLOYMENTS,'collector_topology_mismatch'],
    [report({inventory:{previewUrls:true}}),DEPLOYMENTS,'collector_topology_mismatch'],
    [report({inventory:{cronCount:1}}),DEPLOYMENTS,'collector_topology_mismatch'],
    [report({inventory:{routeCount:1}}),DEPLOYMENTS,'collector_topology_mismatch'],
    [report({inventory:{customDomainCount:1}}),DEPLOYMENTS,'collector_topology_mismatch'],
    [report({runtime:{collectionEnabled:1}}),DEPLOYMENTS,'collection_not_disabled'],
    [report({runtime:{activeLease:true}}),DEPLOYMENTS,'active_lease'],
    [report({runtime:{credentialState:'INVALID'}}),DEPLOYMENTS,'credential_not_available'],
    [report({priorState:{requestAttempts:1}}),DEPLOYMENTS,'history_not_pristine'],
    [report({priorState:{generations:1}}),DEPLOYMENTS,'history_not_pristine'],
    [report({priorState:{fixtureRevisions:1}}),DEPLOYMENTS,'history_not_pristine'],
    [report({priorState:{attempt2Count:1}}),DEPLOYMENTS,'history_not_pristine'],
    [report({priorState:{reservedAttemptCount:1}}),DEPLOYMENTS,'history_not_pristine'],
    [report({priorState:{stagingGenerationCount:1}}),DEPLOYMENTS,'history_not_pristine'],
    [report({mapping:{state:'COMMITTED',mappingCount:19,memberCount:20,distinctProviderIds:20,distinctFplIds:20,canonicalCoverageMatches:true,historicalAuthorityProvenancePresent:true}}),DEPLOYMENTS,'mapping_drift'],
    [report({officialFplAuthority:{valid:false,teamCount:20}}),DEPLOYMENTS,'official_fpl_authority_invalid'],
    [report({officialFplAuthority:{valid:true,teamCount:19}}),DEPLOYMENTS,'official_fpl_authority_invalid'],
    [report({migrationCount:5}),DEPLOYMENTS,'migration_or_foreign_key_drift'],
    [report({foreignKeyViolations:1}),DEPLOYMENTS,'migration_or_foreign_key_drift'],
    [report({modelUiImportCount:1}),DEPLOYMENTS,'model_isolation_mismatch'],
    [report({rawPayloadStoragePresent:true}),DEPLOYMENTS,'model_isolation_mismatch'],
    [report({inventory:{versionInventoryExact:false}}),DEPLOYMENTS,'version_identity_mismatch'],
    [report({inventory:{previewUrlIdentityExact:false}}),DEPLOYMENTS,'collector_configuration_mismatch'],
    [report({inventory:{databaseIdPlaceholder:true}}),DEPLOYMENTS,'collector_configuration_mismatch'],
    [report({approvedSha:'c'.repeat(40)}),DEPLOYMENTS,'preflight_identity_mismatch'],
    [report({ok:true,classification:'READY_FOR_DEPLOYED_ONE_SHOT_COLLECTION',reason:null}),DEPLOYMENTS,'preflight_not_continuation_state'],
    [report({reason:'credential_state_unexpected'}),DEPLOYMENTS,'preflight_not_continuation_state'],
    [report({classification:'STOP_SOMETHING_ELSE'}),DEPLOYMENTS,'preflight_not_continuation_state'],
    [null,DEPLOYMENTS,'preflight_not_continuation_state']
  ];
  for(const [r,d,expected] of cases)assert.equal(diag(r,d),expected);
  assert.equal(diag(report(),DEPLOYMENTS),null);
  for(const [topology,topologyFailure,expected] of [[null,'zone_route_topology_unreadable','zone_route_topology_unreadable'],[{...TOPOLOGY,routeCount:1},null,'zone_route_topology_not_inert'],[{...TOPOLOGY,proof:'LEGACY'},null,'zone_route_topology_not_inert']]){
    const result=buildDeployedOneShotContinuationAdmission({report:report(),deployments:DEPLOYMENTS,topology,topologyFailure,approvedSha:SHA,accountFingerprint:FINGERPRINT});
    assert.equal(result.ok,false);assert.equal(result.reason,expected);assert.throws(()=>validateDeployedOneShotContinuationAdmissionHandoff(result,{approvedSha:SHA,accountFingerprint:FINGERPRINT}),/HANDOFF_INVALID/);
  }
});

test('historical zero-Deployment admission and reconciliation are not weakened by the continuation state',()=>{
  const old=buildDeployedOneShotAdmission({report:report(),topology:TOPOLOGY,approvedSha:SHA,accountFingerprint:FINGERPRINT});
  assert.equal(old.ok,false);assert.equal(old.reason,'preflight_not_ready');
  const forged=buildDeployedOneShotAdmission({report:report({ok:true,classification:'READY_FOR_DEPLOYED_ONE_SHOT_COLLECTION'.replace('READY_FOR_DEPLOYED_ONE_SHOT_COLLECTION','VERSION_URL_CREATION_EXPERIMENT_RECONCILED'),reason:null}),topology:TOPOLOGY,approvedSha:SHA,accountFingerprint:FINGERPRINT});
  assert.equal(forged.ok,false);assert.equal(forged.reason,'collector_topology_mismatch');
  assert.throws(()=>validateDeployedOneShotContinuationAdmissionHandoff(old,{approvedSha:SHA,accountFingerprint:FINGERPRINT}),/HANDOFF_INVALID/);
});

test('continuation admission entry point reads Deployment and zone routes with distinct read credentials and mutates nothing',async()=>{
  const calls=[];
  const fetchImpl=async(url,init={})=>{
    calls.push({href:String(url),method:init.method||'GET'});
    const parsed=new URL(url);
    if(parsed.pathname==='/client/v4/zones')return json({success:true,result:[{id:'zone-a',account:{id:ACCOUNT}}],result_info:{total_pages:1}});
    if(parsed.pathname==='/client/v4/zones/zone-a/workers/routes')return json({success:true,result:[]});
    if(String(url)===API+paths.deployments)return json({success:true,result:{deployments:[exactDeployment]}});
    throw new Error('unexpected '+url);
  };
  const env={DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID:ACCOUNT,DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT:FINGERPRINT,DATA_STEWARD_CLOUDFLARE_READ_TOKEN:READ,CLOUDFLARE_TOPOLOGY_READ_TOKEN:TOPO_TOKEN,APPROVED_SHA:SHA};
  const result=await runDeployedOneShotContinuationAdmission({env,fetchImpl,preflight:async()=>report()});
  assert.equal(result.ok,true);assert.equal(calls.every(call=>call.method==='GET'),true);
  const same=await runDeployedOneShotContinuationAdmission({env:{...env,CLOUDFLARE_TOPOLOGY_READ_TOKEN:READ},fetchImpl,preflight:async()=>report()});
  assert.equal(same.ok,false);
  const unreadable=await runDeployedOneShotContinuationAdmission({env,fetchImpl:async url=>String(url)===API+paths.deployments?json({success:false},500):fetchImpl(url),preflight:async()=>report()});
  assert.equal(unreadable.ok,false);assert.equal(unreadable.reason,'deployment_state_unreadable');
});

// ---- Final pre-mutation gate ----
test('continuation reads fresh Deployment state and route scan before the first mutation, then makes no Deployment mutation',async()=>{
  const {result,calls}=await run();
  assert.equal(result.ok,true);assert.equal(result.classification,'DEPLOYED_ONE_SHOT_TRIGGER_ACCEPTED_RECONCILIATION_REQUIRED');
  assert.deepEqual(result.stagesReached,['VERIFY_EXISTING_DEPLOYMENT','ENABLE_WORKERS_DEV','PROVE_READINESS','ENABLE_COLLECTION','TRIGGER_ONCE']);
  const firstMutation=calls.findIndex(call=>call.method==='POST');
  const deploymentGets=calls.map((call,index)=>call.href===API+paths.deployments&&call.method==='GET'?index:-1).filter(index=>index>=0);
  const routeGets=calls.map((call,index)=>call.href.includes('/workers/routes')?index:-1).filter(index=>index>=0);
  assert.equal(deploymentGets.length,2);assert.equal(deploymentGets.every(index=>index<firstMutation),true);assert.equal(routeGets.length>0&&routeGets.every(index=>index<firstMutation),true);
  assert.equal(calls.indexOf(calls[routeGets.at(-1)])<deploymentGets[1],true);
  assert.equal(deploymentPosts(calls).length,0);assert.equal(result.mutations.createDeployment,0);
  assert.deepEqual(result.deployment,{outcome:'EXISTING_VERIFIED',deploymentId:EXISTING,readbackExact:true});
  assert.equal(result.triggerRequests,1);assert.equal(triggerPosts(calls).length,1);
  assert.deepEqual(subdomainCalls(calls),[true,false]);assert.deepEqual(d1Sql(calls),[DEPLOYED_ONE_SHOT_RUNTIME_SQL.enable.sql,DEPLOYED_ONE_SHOT_RUNTIME_SQL.disable.sql]);
  assert.equal(calls.some(call=>['PUT','DELETE','PATCH'].includes(call.method)||/versions|schedules|domains|routes\/.+/.test(call.href)&&call.method!=='GET'),false);
  assert.deepEqual(result.cleanup.collectionDisable,{attempted:true,outcome:'SUCCEEDED',diagnostic:null});
  assert.deepEqual(DEPLOYED_ONE_SHOT_CONTINUATION_MUTATION_CEILINGS,{createDeployment:0,enableWorkersDev:1,disableWorkersDev:1});
  const evidence=buildDeployedOneShotContinuationExecutionEvidence(result,{approvedSha:SHA});
  assert.equal(evidence.version,DEPLOYED_ONE_SHOT_CONTINUATION_EXECUTION_VERSION);assert.equal(evidence.mutations.createDeployment,0);assert.equal(evidence.retryAuthorized,false);
  assert.equal(JSON.stringify(evidence).includes(TRIGGER),false);assert.equal(JSON.stringify(evidence).includes(MUTATE),false);
});

test('every drift detected before the first mutation sends no mutation and no trigger',async()=>{
  const scenarios=[
    {options:{zones:'route'},code:/FINAL_ROUTE_SCAN_NOT_INERT/},
    {options:{zones:'throw'},code:/FINAL_ROUTE_SCAN_FAILED/},
    {options:{deployments:'none'},code:/CRITICAL_STATE_DRIFT__DEPLOYMENT_IDENTITY_UNEXPECTED/},
    {options:{deployments:'two'},code:/CRITICAL_STATE_DRIFT__DEPLOYMENT_IDENTITY_UNEXPECTED/},
    {options:{deployments:'wrong-id'},code:/CRITICAL_STATE_DRIFT__DEPLOYMENT_IDENTITY_UNEXPECTED/},
    {options:{deployments:'wrong-version'},code:/CRITICAL_STATE_DRIFT__DEPLOYMENT_IDENTITY_UNEXPECTED/},
    {options:{deployments:'split'},code:/CRITICAL_STATE_DRIFT__DEPLOYMENT_IDENTITY_UNEXPECTED/},
    {options:{deployments:'malformed'},code:/CRITICAL_STATE_DRIFT__DEPLOYMENT_STATE_UNREADABLE/},
    {options:{deployments:'throw'},code:/CRITICAL_STATE_DRIFT__DEPLOYMENT_STATE_UNREADABLE/},
    {options:{recheck:recheck(report({inventory:{workersDev:true}}))},code:/CRITICAL_STATE_DRIFT__COLLECTOR_TOPOLOGY_MISMATCH/},
    {options:{recheck:recheck(report({runtime:{collectionEnabled:1}}))},code:/CRITICAL_STATE_DRIFT__COLLECTION_NOT_DISABLED/},
    {options:{recheck:recheck(report({runtime:{activeLease:true}}))},code:/CRITICAL_STATE_DRIFT__ACTIVE_LEASE/},
    {options:{recheck:recheck(report({priorState:{requestAttempts:1}}))},code:/CRITICAL_STATE_DRIFT__HISTORY_NOT_PRISTINE/},
    {options:{recheck:recheck(report({mapping:{state:'COMMITTED',mappingCount:19,memberCount:20,distinctProviderIds:20,distinctFplIds:20,canonicalCoverageMatches:true,historicalAuthorityProvenancePresent:true}}))},code:/CRITICAL_STATE_DRIFT__MAPPING_DRIFT/},
    {options:{recheck:recheck(report({officialFplAuthority:{valid:false,teamCount:20}}))},code:/CRITICAL_STATE_DRIFT__OFFICIAL_FPL_AUTHORITY_INVALID/}
  ];
  for(const {options,code} of scenarios){
    const fake=fakeLive(options);
    await assert.rejects(executeDeployedOneShotContinuation({env:liveEnv(),fetchImpl:fake.fetchImpl,criticalRecheck:options.recheck??recheck(),wait:async()=>{}}),code);
    assert.equal(mutationCalls(fake.calls).length,0);assert.equal(triggerPosts(fake.calls).length,0);
  }
});

test('Deployment drift between the final reads stops before workers.dev with zero mutation',async()=>{
  const {result,calls}=await run({deploymentsAfterFirst:'two'});
  assert.equal(result.ok,false);assert.equal(result.primaryFailure,'DEPLOYED_ONE_SHOT_DEPLOYMENT_READBACK_MISMATCH');
  assert.deepEqual(result.stagesReached,['VERIFY_EXISTING_DEPLOYMENT']);assert.equal(mutationCalls(calls).length,0);assert.equal(triggerPosts(calls).length,0);
  assert.equal(result.cleanup,null);assert.equal(result.deployment.outcome,'EXISTING_MISMATCH');assert.equal(deploymentPosts(calls).length,0);
});

test('missing topology credential or credential reuse sends zero network requests',async()=>{
  for(const mutate of [env=>{delete env.CLOUDFLARE_TOPOLOGY_READ_TOKEN;},env=>{env.CLOUDFLARE_TOPOLOGY_READ_TOKEN=READ;},env=>{env.CLOUDFLARE_TOPOLOGY_READ_TOKEN=MUTATE;},env=>{env.CLOUDFLARE_ATTENDED_MUTATION_TOKEN=READ;},env=>{env.API_FOOTBALL_ATTENDED_TRIGGER_SECRET='short';},env=>{env.API_FOOTBALL_ATTENDED_TRIGGER_SECRET=TOPO_TOKEN.padEnd(40,'x');env.CLOUDFLARE_TOPOLOGY_READ_TOKEN=env.API_FOOTBALL_ATTENDED_TRIGGER_SECRET;}]){
    const env=liveEnv();mutate(env);
    const fake=fakeLive();let rechecked=false;
    await assert.rejects(executeDeployedOneShotContinuation({env,fetchImpl:fake.fetchImpl,criticalRecheck:async()=>{rechecked=true;return report();},wait:async()=>{}}));
    assert.equal(fake.calls.length,0);assert.equal(rechecked,false);
  }
  const stale=liveEnv(tempAdmission(buildDeployedOneShotContinuationAdmission({report:report(),deployments:{count:0,exactSingle:false,deploymentId:null},topology:TOPOLOGY,approvedSha:SHA,accountFingerprint:FINGERPRINT})));
  const fake=fakeLive();await assert.rejects(executeDeployedOneShotContinuation({env:stale,fetchImpl:fake.fetchImpl,criticalRecheck:recheck(),wait:async()=>{}}),/HANDOFF_INVALID/);assert.equal(fake.calls.length,0);
  const oldAdmission=liveEnv(tempAdmission(buildDeployedOneShotAdmission({report:report({ok:true,classification:'VERSION_URL_CREATION_EXPERIMENT_RECONCILED',reason:null,inventory:{deploymentCount:0}}),topology:TOPOLOGY,approvedSha:SHA,accountFingerprint:FINGERPRINT})));
  const fake2=fakeLive();await assert.rejects(executeDeployedOneShotContinuation({env:oldAdmission,fetchImpl:fake2.fetchImpl,criticalRecheck:recheck(),wait:async()=>{}}),/HANDOFF_INVALID/);assert.equal(fake2.calls.length,0);
});

// ---- Executable ceilings ----
test('continuation request allowlist refuses Deployment POST, Version upload, DELETE, PUT, schedules, routes and domains before network',()=>{
  assert.equal(assertDeployedOneShotContinuationRequestAllowed('GET',paths.deployments,{accountId:ACCOUNT}),'READ');
  assert.equal(assertDeployedOneShotContinuationRequestAllowed('POST',paths.subdomain,{accountId:ACCOUNT}),'MUTATION');
  assert.equal(assertDeployedOneShotContinuationRequestAllowed('POST',paths.d1,{accountId:ACCOUNT}),'MUTATION');
  const script=`/accounts/${ACCOUNT}/workers/scripts/${DEPLOYED_ONE_SHOT_WORKER}`;
  for(const [method,p] of [['POST',paths.deployments],['PUT',paths.deployments],['DELETE',paths.deployments],['DELETE',`${paths.deployments}/${EXISTING}`],['PATCH',paths.deployments],['POST',script+'/versions'],['PUT',script+'/schedules'],['POST',`/accounts/${ACCOUNT}/workers/domains`],['POST','/zones/z/workers/routes'],['GET',paths.d1],['PUT',paths.subdomain]])
    assert.throws(()=>assertDeployedOneShotContinuationRequestAllowed(method,p,{accountId:ACCOUNT}),/ENDPOINT_FORBIDDEN/);
});

test('continuation orchestration has no Deployment operation and rejects one if supplied',async()=>{
  const ops=Object.fromEntries(['verifyDeployment','enableWorkersDev','proveReadiness','enableCollection','triggerOnce','disableCollection','disableWorkersDev'].map(name=>[name,async()=>({requestCount:1,outcome:'ACCEPTED'})]));
  assert.equal((await runDeployedOneShotContinuation({admissionValid:true,ops:{...ops,createDeployment:async()=>{}}})).classification,'DEPLOYED_ONE_SHOT_OPERATIONS_INCOMPLETE');
  assert.equal((await runDeployedOneShotContinuation({admissionValid:false,ops})).classification,'DEPLOYED_ONE_SHOT_NOT_ADMITTED');
  const source=fs.readFileSync(new URL('../workers/api-football-collector/run-deployed-one-shot-continuation.mjs',import.meta.url),'utf8');
  assert.equal(/createDeploymentWithReadback|buildDeploymentBody|createDeployment:async/.test(source),false);
  assert.equal(/'POST',\s*paths\.deployments|method:'DELETE'|method:'PUT'/.test(source),false);
});

test('workers.dev enable, workers.dev disable and trigger are each submitted at most once',async()=>{
  for(const options of [{},{trigger:'throw'},{trigger:'rejected'},{readinessFailures:99},{enableD1:'zero'}]){
    const {result,calls}=await run(options);
    assert.equal(subdomainCalls(calls).filter(Boolean).length,1);assert.equal(subdomainCalls(calls).filter(value=>!value).length,1);
    assert.equal(triggerPosts(calls).length<=1,true);assert.equal(result.mutations.createDeployment,0);assert.equal(d1Sql(calls).length<=2,true);
    assert.equal(deploymentPosts(calls).length,0);assert.equal(result.retryAuthorized,false);
  }
});

// ---- Cleanup ----
test('every failure after workers.dev enable attempts both cleanups and keeps primary and cleanup failures distinct',async()=>{
  const flows=[{readinessFailures:99},{enableD1:'throw'},{trigger:'throw'},{trigger:'rejected'}];
  for(const options of flows){
    const {result,calls}=await run(options);
    assert.equal(result.cleanup.collectionDisable.attempted,true);assert.equal(result.cleanup.workersDevDisable.attempted,true);assert.deepEqual(subdomainCalls(calls),[true,false]);assert.equal(result.ok,false);
  }
  const both=await run({trigger:'throw',disableD1:'throw',disableDev:'throw'});
  assert.equal(both.result.ok,false);assert.equal(both.result.primaryFailure,'DEPLOYED_ONE_SHOT_TRIGGER_TRANSPORT_AMBIGUOUS');
  assert.equal(both.result.cleanup.collectionDisable.outcome,'FAILED');assert.equal(both.result.cleanup.workersDevDisable.outcome,'FAILED');
  assert.equal(both.result.cleanupFailure,'DEPLOYED_ONE_SHOT_COLLECTION_DISABLE_AMBIGUOUS');
  const devOnly=await run({disableDev:'mismatch'});
  assert.equal(devOnly.result.ok,false);assert.equal(devOnly.result.primaryFailure,null);assert.equal(devOnly.result.cleanupFailure,'DEPLOYED_ONE_SHOT_WORKERS_DEV_DISABLE_STATE_MISMATCH');
  assert.equal(devOnly.result.cleanup.collectionDisable.outcome,'SUCCEEDED');
  const enableFailed=await run({enableDev:'throw'});
  assert.equal(enableFailed.result.primaryFailure,'DEPLOYED_ONE_SHOT_WORKERS_DEV_ENABLE_AMBIGUOUS');assert.equal(enableFailed.result.cleanup.workersDevDisable.attempted,true);assert.equal(triggerPosts(enableFailed.calls).length,0);
});

test('pre-mutation failure evidence records zero mutations, no trigger and no Deployment mutation',()=>{
  const evidence=buildDeployedOneShotContinuationPreMutationFailure(new Error('DEPLOYED_ONE_SHOT_FINAL_ROUTE_SCAN_FAILED'),{approvedSha:SHA});
  assert.equal(evidence.classification,'DEPLOYED_ONE_SHOT_STOPPED_BEFORE_MUTATION');assert.deepEqual(evidence.mutations,{createDeployment:0,enableWorkersDev:0,disableWorkersDev:0});
  assert.equal(evidence.triggerRequests,0);assert.equal(buildDeployedOneShotContinuationPreMutationFailure(new Error('secret '+TRIGGER)).diagnostic,'DEPLOYED_ONE_SHOT_UNEXPECTED_FAILURE');
});

// ---- Continuation reconciliation ----
const executionEvidence=(overrides={})=>({version:DEPLOYED_ONE_SHOT_CONTINUATION_EXECUTION_VERSION,approvedSha:SHA,versionId:DEPLOYED_ONE_SHOT_VERSION_ID,retryAuthorized:false,triggerRequests:1,
  mutations:{createDeployment:0,enableWorkersDev:1,disableWorkersDev:1},deployment:{outcome:'EXISTING_VERIFIED',deploymentId:EXISTING,readbackExact:true},...overrides});
const reconcile=(overrides={},{deployments=DEPLOYMENTS,topology=TOPOLOGY,execution=executionEvidence()}={})=>
  classifyDeployedOneShotContinuationReconciliation({report:report(overrides),deployments,topology,execution,approvedSha:SHA,accountFingerprint:FINGERPRINT});

test('continuation reconciliation accepts a five-request committed generation with the exact Deployment retained',()=>{
  const result=reconcile({priorState:successHistory});
  assert.equal(result.ok,true);assert.equal(result.classification,'DEPLOYED_ONE_SHOT_RECONCILED_SUCCESS');assert.equal(result.retryAuthorized,false);
});

test('pristine history after the continuation is a clean stop, never success',()=>{
  const stopped=reconcile({},{execution:executionEvidence({triggerRequests:0})});
  assert.equal(stopped.ok,false);assert.equal(stopped.classification,'DEPLOYED_ONE_SHOT_CLEAN_STOP_NO_PROVIDER_REQUEST');assert.equal(stopped.reason,'stopped_before_trigger');
  assert.equal(reconcile({}).reason,'trigger_sent_without_provider_activity');
  assert.equal(reconcile({},{execution:null}).reason,'execution_evidence_unavailable');
});

test('continuation reconciliation fails closed on every unexpected state',()=>{
  const owner=(result,reason)=>{assert.equal(result.ok,false);assert.equal(result.classification,'DEPLOYED_ONE_SHOT_OWNER_ATTENTION_REQUIRED');assert.equal(result.reason,reason);};
  const ok=successHistory;
  owner(reconcile({priorState:ok},{deployments:{count:0,exactSingle:false,deploymentId:null}}),'deployment_state_inconsistent');
  owner(reconcile({priorState:ok,inventory:{deploymentCount:2}},{deployments:{count:2,exactSingle:false,deploymentId:null}}),'deployment_identity_unexpected');
  owner(reconcile({priorState:ok},{deployments:{count:1,exactSingle:true,deploymentId:'other'}}),'deployment_identity_unexpected');
  owner(reconcile({priorState:ok},{deployments:{count:1,exactSingle:false,deploymentId:EXISTING}}),'deployment_identity_unexpected');
  owner(reconcile({priorState:ok},{deployments:null}),'deployment_state_unreadable');
  owner(reconcile({priorState:ok,inventory:{workersDev:true}}),'workers_dev_cleanup_incomplete');
  owner(reconcile({priorState:ok,inventory:{previewUrls:true}}),'preview_urls_enabled');
  owner(reconcile({priorState:ok,runtime:{collectionEnabled:1}}),'collection_cleanup_incomplete');
  owner(reconcile({priorState:ok,inventory:{cronCount:1}}),'cron_present');
  owner(reconcile({priorState:ok,inventory:{customDomainCount:1}}),'custom_domain_present');
  owner(reconcile({priorState:ok,inventory:{routeCount:1}}),'route_present_or_unproven');
  owner(reconcile({priorState:ok},{topology:{...TOPOLOGY,routeCount:1}}),'route_present_or_unproven');
  owner(reconcile({priorState:ok},{topology:null}),'route_present_or_unproven');
  owner(reconcile({priorState:ok,runtime:{activeLease:true}}),'active_lease');
  owner(reconcile({priorState:{...ok,attempt2Count:1}}),'retry_attempt_detected');
  owner(reconcile({priorState:{...ok,reservedAttemptCount:1}}),'reserved_attempt_unresolved');
  owner(reconcile({priorState:{...ok,stagingGenerationCount:1}}),'staging_generation_unresolved');
  owner(reconcile({priorState:{...ok,transportUnknownCount:1}}),'transport_unknown_attempt_consumed');
  owner(reconcile({priorState:{...ok,authFailureCount:1}}),'authentication_failure');
  owner(reconcile({priorState:{...ok,quotaBlockedCount:1}}),'quota_blocked');
  owner(reconcile({priorState:{...ok,schemaFailureCount:1}}),'schema_failure');
  owner(reconcile({priorState:{...ok,persistenceUncertainCount:1}}),'persistence_uncertainty');
  owner(reconcile({priorState:{...ok,completionUncertainCount:1}}),'completion_uncertainty');
  owner(reconcile({priorState:{...ok,requestAttempts:3,attempt1Count:3,succeededAttemptCount:3}}),'collection_state_ambiguous');
  owner(reconcile({priorState:ok,modelUiImportCount:1}),'model_isolation_mismatch');
  owner(reconcile({priorState:ok,rawPayloadStoragePresent:true}),'model_isolation_mismatch');
  owner(reconcile({priorState:ok},{execution:executionEvidence({triggerRequests:0})}),'execution_evidence_inconsistent');
  owner(reconcile({priorState:ok},{execution:null}),'execution_evidence_inconsistent');
  owner(reconcile({priorState:ok},{execution:executionEvidence({mutations:{createDeployment:1,enableWorkersDev:1,disableWorkersDev:1}})}),'execution_evidence_inconsistent');
  owner(reconcile({priorState:ok},{execution:executionEvidence({version:'api-football-deployed-one-shot-execution-v1'})}),'execution_evidence_inconsistent');
  owner(reconcile({priorState:ok},{execution:executionEvidence({deployment:{outcome:'EXISTING_VERIFIED',deploymentId:'other',readbackExact:true}})}),'execution_evidence_inconsistent');
});

test('continuation reconciliation entry point is read-only and reports the retained Deployment',async()=>{
  const calls=[];
  const fetchImpl=async(url,init={})=>{
    calls.push(init.method||'GET');const parsed=new URL(url);
    if(parsed.pathname==='/client/v4/zones')return json({success:true,result:[{id:'zone-a',account:{id:ACCOUNT}}],result_info:{total_pages:1}});
    if(parsed.pathname==='/client/v4/zones/zone-a/workers/routes')return json({success:true,result:[]});
    return json({success:true,result:{deployments:[exactDeployment]}});
  };
  const env={DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID:ACCOUNT,DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT:FINGERPRINT,DATA_STEWARD_CLOUDFLARE_READ_TOKEN:READ,CLOUDFLARE_TOPOLOGY_READ_TOKEN:TOPO_TOKEN,APPROVED_SHA:SHA};
  const result=await runDeployedOneShotContinuationReconciliation({env,fetchImpl,preflight:async()=>report({priorState:successHistory}),execution:executionEvidence()});
  assert.equal(result.ok,true);assert.equal(result.observed.topology.deploymentId,EXISTING);assert.equal(calls.every(method=>method==='GET'),true);
  assert.deepEqual(result.evidence,{productionMutations:0,apiFootballRequests:0,secretValuesRead:0});
});

// ---- Generic Deployment creation ambiguity regression ----
const post=outcome=>{let count=0;return {fn:async()=>{count+=1;if(outcome instanceof Error)throw outcome;return outcome;},get count(){return count;}};};
const readback=state=>{let count=0;return {fn:async()=>{count+=1;if(state instanceof Error)throw state;return state;},get count(){return count;}};};
const exactState={count:1,exactSingle:true,deploymentId:'dep-new'};

test('valid creation response needs no readback and submits one POST',async()=>{
  const p=post({kind:'OK',result:{...exactDeployment,id:'dep-new'}}),r=readback(exactState);
  const result=await createDeploymentWithReadback({post:p.fn,readback:r.fn});
  assert.deepEqual({...result},{outcome:'CREATED',deploymentId:'dep-new',readbackPerformed:false});assert.equal(p.count,1);assert.equal(r.count,0);
});

test('definite rejection is not retried and not read back',async()=>{
  const p=post({kind:'REJECTED'}),r=readback(exactState);
  const result=await createDeploymentWithReadback({post:p.fn,readback:r.fn});
  assert.equal(result.outcome,'REJECTED');assert.equal(p.count,1);assert.equal(r.count,0);
});

test('every ambiguous creation response triggers exactly one readback and zero second POST',async()=>{
  const ambiguous=[{kind:'AMBIGUOUS'},new Error('transport'),{kind:'OK',result:{id:'x'}},{kind:'OK',result:null},{kind:'OK',result:{...exactDeployment,versions:[{version_id:'other',percentage:100}]}},undefined];
  for(const response of ambiguous){
    for(const [state,outcome,id] of [[exactState,'APPLIED_CONFIRMED_BY_READBACK','dep-new'],[{count:0,exactSingle:false,deploymentId:null},'NOT_APPLIED',null],
      [{count:2,exactSingle:false,deploymentId:null},'AMBIGUOUS_OWNER_ATTENTION',null],[{count:1,exactSingle:false,deploymentId:'d'},'AMBIGUOUS_OWNER_ATTENTION',null],
      [null,'AMBIGUOUS_OWNER_ATTENTION',null],[new Error('read'),'AMBIGUOUS_OWNER_ATTENTION',null],[{count:'x'},'AMBIGUOUS_OWNER_ATTENTION',null]]){
      const p=post(response),r=readback(state);
      const result=await createDeploymentWithReadback({post:p.fn,readback:r.fn});
      assert.equal(result.outcome,outcome);assert.equal(result.deploymentId,id);assert.equal(p.count,1);assert.equal(r.count,1);assert.equal(result.readbackPerformed,true);
    }
  }
});

test('creation logic is bounded: closed outcomes and incomplete operations are refused',async()=>{
  await assert.rejects(createDeploymentWithReadback({}),/OPERATIONS_INCOMPLETE/);
  await assert.rejects(createDeploymentWithReadback({post:async()=>({kind:'OK'})}),/OPERATIONS_INCOMPLETE/);
});

test('the consumed run is recorded: the generic reconciliation accepts an applied-by-readback Deployment and still requires its exact ID',()=>{
  const generic=(deployments,outcome='APPLIED_CONFIRMED_BY_READBACK')=>classifyDeployedOneShotReconciliation({
    report:report({inventory:{deploymentCount:deployments.count}}),deployments,topology:TOPOLOGY,
    execution:{version:'api-football-deployed-one-shot-execution-v1',approvedSha:SHA,versionId:DEPLOYED_ONE_SHOT_VERSION_ID,retryAuthorized:false,triggerRequests:0,deployment:{outcome,deploymentId:EXISTING}},
    approvedSha:SHA,accountFingerprint:FINGERPRINT});
  const clean=generic(DEPLOYMENTS);
  assert.equal(clean.classification,'DEPLOYED_ONE_SHOT_CLEAN_STOP_NO_PROVIDER_REQUEST');assert.equal(clean.reason,'stopped_before_trigger');
  assert.equal(generic({count:1,exactSingle:true,deploymentId:'other'}).reason,'deployment_identity_unexpected');
});

// ---- Workflow ----
test('continuation workflow is dormant, manual, first-attempt-only, exact-main, least-privilege and has no Deployment mutation',()=>{
  const source=fs.readFileSync('.github/workflows/api-football-deployed-one-shot-continuation.yml','utf8');
  assert.match(source,/^name: API-Football Deployed One-Shot Continuation$/m);
  assert.match(source,/^on:\n  workflow_dispatch:/m);assert.doesNotMatch(source,/^\s{2}(?:schedule|push|pull_request|workflow_run|repository_dispatch):/m);
  assert.equal((source.match(/github\.run_attempt == 1/g)||[]).length,4);
  assert.match(source,/Tests and deterministic build/);
  assert.match(source,/name: data-steward-readonly/);assert.match(source,/name: api-football-attended-acceptance/);
  assert.doesNotMatch(source,/secrets\.API_FOOTBALL_API_KEY|x-apisports-key|v3\.football\.api-sports\.io|wrangler|CLOUDFLARE_REPLACEMENT_MUTATION_TOKEN|teamsheet-api-football-shadow-collector-v2/);
  for(const line of source.split('\n').filter(line=>/uses:/.test(line)))assert.match(line,/@[0-9a-f]{40}/,line);
  // Continuation entry points only; the Deployment-creating executor and admission are never referenced.
  assert.match(source,/run-deployed-one-shot-continuation\.mjs/);assert.match(source,/deployed-one-shot-continuation-readonly\.mjs/);
  assert.doesNotMatch(source,/run-deployed-one-shot\.mjs|deployed-one-shot-readonly\.mjs/);
  assert.match(source,/mutations\?\.createDeployment!==0/);
  const jobs=source.split(/\n  (?=[a-z-]+:\n    if:)/);
  const protectedJob=jobs.find(job=>job.startsWith('protected-one-shot-execution'));
  for(const job of jobs.filter(job=>job!==protectedJob))assert.doesNotMatch(job,/CLOUDFLARE_ATTENDED_MUTATION_TOKEN|API_FOOTBALL_ATTENDED_TRIGGER_SECRET/);
  assert.match(protectedJob,/CLOUDFLARE_ATTENDED_MUTATION_TOKEN/);assert.match(protectedJob,/CLOUDFLARE_ATTENDED_READ_TOKEN/);assert.match(protectedJob,/API_FOOTBALL_ATTENDED_TRIGGER_SECRET/);
  assert.doesNotMatch(protectedJob,/DATA_STEWARD_CLOUDFLARE_READ_TOKEN/);
  assert.equal((protectedJob.match(/CLOUDFLARE_REPLACEMENT_TOPOLOGY_READ_TOKEN/g)||[]).length,1);
  assert.match(source,/permissions:\n  contents: read\n  actions: read\n  checks: read\n/);
  assert.match(source,/group: api-football-collector-attended-acceptance\n  cancel-in-progress: false/);
});

test('the consumed one-shot workflow is marked consumed and the historical sources keep their zero-Deployment admission',()=>{
  const old=fs.readFileSync('.github/workflows/api-football-deployed-one-shot-collection.yml','utf8');
  assert.match(old,/CONSUMED \(run 37505586273\): do NOT dispatch again/);
  const continuation=fs.readFileSync('workers/api-football-collector/run-deployed-one-shot-continuation.mjs','utf8');
  assert.match(continuation,/Deployment POST is deliberately absent/);
  assert.equal(DEPLOYED_ONE_SHOT_EXISTING_DEPLOYMENT_ID,'2417a3e0-15db-4e45-a3c8-00b148a300f4');
  assert.equal(DEPLOYED_ONE_SHOT_VERSION_ID,'04d79556-3070-429f-9944-b5b53d799842');
});
