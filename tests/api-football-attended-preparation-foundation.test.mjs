import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  buildAttendedVersionUploadMetadata,
  buildReviewedAttendedIdentity,
  ORIGINAL_BLOCKED_VERSION_APPROVED_SHA,
  ORIGINAL_BLOCKED_VERSION_ID,
  ORIGINAL_BLOCKED_VERSION_MODULE_SHA256
} from '../workers/api-football-collector/attended-version.mjs';
import {
  classifyCollectorActivationPreflight,
  COLLECTOR_ACTIVATION_PREFLIGHT_VERSION,
  COLLECTOR_ATTENDED_STAGE_READY,
  COLLECTOR_PREPARATION_START_READY,
  COLLECTOR_PREPARATION_VERSION_READY,
  COLLECTOR_PREFLIGHT_PREPARATION_CLOSEOUT_STAGE,
  COLLECTOR_PREFLIGHT_PREPARATION_START_STAGE,
  COLLECTOR_PREFLIGHT_PREPARATION_VERSION_STAGE
} from '../workers/api-football-collector/activation-preflight.mjs';
import {
  ATTENDED_PREPARATION_VERSION,
  CREDENTIAL_PREPARATION_AMBIGUOUS,
  CREDENTIAL_PREPARATION_SUCCESS,
  VERSION_PREPARATION_CLASSIFICATION,
  assertPreparationCredentialRequestAllowed,
  assertPreparationVersionRequestAllowed,
  runCredentialPreparation,
  runVersionPreparation,
  validatePreparationAdmission
} from '../workers/api-football-collector/attended-preparation.mjs';
import {EXPECTED_D1_DATABASE_ID} from '../workers/data-platform/phase4b/live-contract.mjs';
import {productionModelUiImportCount} from '../workers/api-football-collector/activation-live-preflight.mjs';

const root=path.resolve(import.meta.dirname,'..');
const NOW='2026-09-22T08:30:00.000Z';
const APPROVED_SHA='a'.repeat(40);
const ACCOUNT='synthetic-production-account';
const FINGERPRINT=createHash('sha256').update(ACCOUNT).digest('hex');
const ATTENDED_VERSION_ID='11111111-1111-4111-8111-111111111111';
const API_KEY='api-key-sentinel-never-retain';
const TRIGGER='trigger-secret-sentinel-0123456789abcdef0123456789abcdef';

function inventoryStart(){
  return {
    activation:'REPOSITORY_ONLY_BLOCKED',databaseIdPlaceholder:false,productionBindingProven:true,
    workerPresent:true,deploymentCount:0,cronCount:0,workersDev:false,previewUrls:false,configurationExact:true,
    reviewedVersionId:ORIGINAL_BLOCKED_VERSION_ID,originalVersionIdentityExact:true,versionIdentityExact:true,versionInventoryExact:true,
    previewUrlIdentityExact:true,routeCount:0,customDomainCount:0,secretBindingPresent:false,secretBindingNames:[]
  };
}
function inventoryAttended(){
  return {
    activation:'ATTENDED_ONE_SHOT_DISCOVERY',databaseIdPlaceholder:false,productionBindingProven:true,
    workerPresent:true,deploymentCount:0,cronCount:0,workersDev:false,previewUrls:false,configurationExact:true,
    reviewedVersionId:ATTENDED_VERSION_ID,originalVersionIdentityExact:true,versionIdentityExact:true,versionInventoryExact:true,
    previewUrlIdentityExact:true,routeCount:0,customDomainCount:0,secretBindingPresent:true,
    secretBindingNames:['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET']
  };
}
function evidence(stage,{inventory=inventoryStart(),credentialState='UNPROVISIONED'}={}){
  const teamIds=Array.from({length:20},(_,i)=>`2026-27:fpl:team:${i+1}`);
  return {
    version:COLLECTOR_ACTIVATION_PREFLIGHT_VERSION,stage,
    migrations:[[1,'shadow_data_foundation'],[2,'official_fpl_structured_history'],[3,'production_query_plan_indexes'],[4,'api_football_shadow_identity'],[5,'api_football_shadow_runtime'],[6,'api_football_mapping_qualification']],
    foreignKeyViolations:0,
    authority:{season:'2026-27',sourceKey:'official-fpl',sourceRevisionId:'official-fpl-r1',runId:'run',runStatus:'completed',fetchedAt:NOW,teamIds,digest:'a'.repeat(64)},
    mapping:{state:'COMMITTED',isCurrentHead:true,mappingCount:20,memberCount:20,distinctProviderIds:20,distinctFplIds:20,canonicalTeamIds:teamIds,historicalAuthorityDigest:'b'.repeat(64),historicalAuthorityFetchedAt:NOW},
    runtime:{provider:'api-football',collectionEnabled:0,credentialState,inFlightAttemptId:null,inFlightLeaseExpiresAt:null},
    counts:{requestAttempts:0,generations:0,fixtureRevisions:0},
    priorState:{attempt2Count:0,reservedAttemptCount:0,stagingGenerationCount:0},
    inventory,modelUiImportCount:0,rawPayloadStoragePresent:false
  };
}
function report(stage,{inventory=inventoryStart(),credentialState='UNPROVISIONED',classification}={}){
  const e=evidence(stage,{inventory,credentialState});
  const classified=classification??classifyCollectorActivationPreflight(e,{now:NOW}).classification;
  return {
    ok:true,approvedSha:APPROVED_SHA,accountFingerprint:FINGERPRINT,stage,classification:classified,
    migrationCount:6,foreignKeyViolations:0,officialFplAuthority:{valid:true,teamCount:20,fetchedAt:NOW},
    mapping:{state:'COMMITTED',mappingCount:20,memberCount:20,distinctProviderIds:20,distinctFplIds:20,canonicalCoverageMatches:true,historicalAuthorityProvenancePresent:true},
    runtime:{collectionEnabled:0,credentialState,activeLease:false},
    priorState:{requestAttempts:0,generations:0,fixtureRevisions:0,attempt2Count:0,reservedAttemptCount:0,stagingGenerationCount:0},
    inventory,modelUiImportCount:0,rawPayloadStoragePresent:false,
    evidence:{productionMutations:0,apiFootballRequests:0,secretValuesRead:0}
  };
}
const startReport=()=>report(COLLECTOR_PREFLIGHT_PREPARATION_START_STAGE,{inventory:inventoryStart(),credentialState:'UNPROVISIONED',classification:COLLECTOR_PREPARATION_START_READY});
const versionReport=()=>report(COLLECTOR_PREFLIGHT_PREPARATION_VERSION_STAGE,{inventory:inventoryAttended(),credentialState:'UNPROVISIONED',classification:COLLECTOR_PREPARATION_VERSION_READY});
const closeoutReport=()=>report(COLLECTOR_PREFLIGHT_PREPARATION_CLOSEOUT_STAGE,{inventory:inventoryAttended(),credentialState:'AVAILABLE',classification:COLLECTOR_ATTENDED_STAGE_READY});

test('starting preparation admission accepts only the exact pristine singleton-original state',()=>{
  const base=evidence(COLLECTOR_PREFLIGHT_PREPARATION_START_STAGE);
  assert.deepEqual(classifyCollectorActivationPreflight(base,{now:NOW}),{ok:true,stage:COLLECTOR_PREFLIGHT_PREPARATION_START_STAGE,classification:COLLECTOR_PREPARATION_START_READY,secretBindingPresent:false});
  for(const [name,change] of [
    ['absent original',i=>({...i,workerPresent:false})],
    ['unexpected second or third Version',i=>({...i,versionInventoryExact:false})],
    ['secret-bearing original',i=>({...i,secretBindingPresent:true,secretBindingNames:['API_FOOTBALL_API_KEY']})],
    ['wrong activation',i=>({...i,activation:'ATTENDED_ONE_SHOT_DISCOVERY'})],
    ['Deployment present',i=>({...i,deploymentCount:1})],
    ['Preview enabled',i=>({...i,previewUrls:true})],
    ['Cron present',i=>({...i,cronCount:1})],
    ['route present',i=>({...i,routeCount:1})],
    ['custom domain present',i=>({...i,customDomainCount:1})],
    ['original content drift',i=>({...i,originalVersionIdentityExact:false})]
  ]){
    const result=classifyCollectorActivationPreflight({...base,inventory:change(base.inventory)},{now:NOW});
    assert.equal(result.ok,false,name);
  }
  assert.equal(classifyCollectorActivationPreflight({...base,runtime:{...base.runtime,credentialState:'AVAILABLE'}},{now:NOW}).ok,false);
  assert.equal(classifyCollectorActivationPreflight({...base,counts:{...base.counts,requestAttempts:1}},{now:NOW}).ok,false);
});

test('original inactive Version identity is pinned to its accepted creation SHA and exact 17-module byte hashes',()=>{
  assert.equal(ORIGINAL_BLOCKED_VERSION_APPROVED_SHA,'302dc21cc4b821ac8b224d176765a29c0724a244');
  assert.equal(Object.keys(ORIGINAL_BLOCKED_VERSION_MODULE_SHA256).length,17);
  assert.equal(ORIGINAL_BLOCKED_VERSION_MODULE_SHA256['collector.mjs'],'9c956c37e59a7165533eb98d6face03b0ae2e137a1931bfdd62b67d60895a888');
  for(const hash of Object.values(ORIGINAL_BLOCKED_VERSION_MODULE_SHA256))assert.match(hash,/^[0-9a-f]{64}$/);
});

test('attended Version construction is exact and keeps API key and trigger secret distinct',()=>{
  const metadata=buildAttendedVersionUploadMetadata(APPROVED_SHA,{apiKey:API_KEY,triggerSecret:TRIGGER});
  assert.equal(metadata.main_module,'collector.mjs');
  assert.equal(metadata.compatibility_date,'2026-09-16');
  assert.equal(metadata.annotations['workers/message'],'API-Football attended acceptance from '+APPROVED_SHA);
  assert.equal(metadata.annotations['workers/tag'],'api-football-attended-'+APPROVED_SHA.slice(0,12));
  assert.equal(metadata.bindings.length,6);
  assert.deepEqual(metadata.bindings.filter(x=>x.type==='plain_text').map(x=>[x.name,x.text]),[
    ['API_FOOTBALL_FPL_SEASON','2026-27'],['API_FOOTBALL_PROVIDER_SEASON','2026'],['EIA_2I5D_ACTIVATION','ATTENDED_ONE_SHOT_DISCOVERY']
  ]);
  const d1=metadata.bindings.find(x=>x.type==='d1');assert.equal(d1.name,'TEAMSHEET_DATA_DB');assert.equal(d1.database_id,EXPECTED_D1_DATABASE_ID);
  assert.deepEqual(metadata.bindings.filter(x=>x.type==='secret_text').map(x=>x.name),['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET']);
  assert.throws(()=>buildAttendedVersionUploadMetadata(APPROVED_SHA,{apiKey:TRIGGER,triggerSecret:TRIGGER}),/collector_attended_secret_material_invalid/);
  const identity=buildReviewedAttendedIdentity(APPROVED_SHA);assert.equal(Object.keys(identity.moduleSha256).length,17);
});

function versionEnv(){return {
  APPROVED_SHA,CLOUDFLARE_ACCOUNT_ID:ACCOUNT,CLOUDFLARE_ACCOUNT_FINGERPRINT:FINGERPRINT,
  CLOUDFLARE_ATTENDED_VERSION_UPLOAD_TOKEN:'synthetic-upload-token',API_FOOTBALL_API_KEY:API_KEY,API_FOOTBALL_ATTENDED_TRIGGER_SECRET:TRIGGER
};}
function json(result,status=200){return new Response(JSON.stringify({success:status>=200&&status<300,result}),{status,headers:{'content-type':'application/json'}});}

test('Version preparation submits one upload, retains no secret values, and leaves every other mutation domain at zero',async()=>{
  let posts=0;const urls=[];let uploadedMetadata=null;
  const fetchImpl=async(url,init={})=>{
    urls.push(String(url));
    if(init.method==='POST'){
      posts++;uploadedMetadata=JSON.parse(init.body.get('metadata'));
      return json({id:ATTENDED_VERSION_ID});
    }
    return json({items:[{id:ORIGINAL_BLOCKED_VERSION_ID},{id:ATTENDED_VERSION_ID}]});
  };
  const result=await runVersionPreparation({env:versionEnv(),fetchImpl,admission:startReport()});
  assert.equal(result.ok,true);assert.equal(result.version,ATTENDED_PREPARATION_VERSION);assert.equal(result.classification,VERSION_PREPARATION_CLASSIFICATION);
  assert.equal(result.attendedVersionId,ATTENDED_VERSION_ID);assert.equal(result.versionMutationSubmissions,1);assert.equal(posts,1);
  assert.equal(result.deploymentMutations,0);assert.equal(result.previewMutations,0);assert.equal(result.cronRouteDomainMutations,0);assert.equal(result.d1Mutations,0);assert.equal(result.apiFootballRequests,0);
  assert.equal(uploadedMetadata.bindings.find(x=>x.name==='API_FOOTBALL_API_KEY').text,API_KEY);
  assert.equal(uploadedMetadata.bindings.find(x=>x.name==='API_FOOTBALL_ATTENDED_TRIGGER_SECRET').text,TRIGGER);
  const retained=JSON.stringify(result);assert.doesNotMatch(retained,new RegExp(API_KEY));assert.doesNotMatch(retained,new RegExp(TRIGGER));
  for(const url of urls){assert.doesNotMatch(url,new RegExp(API_KEY));assert.doesNotMatch(url,new RegExp(TRIGGER));assert.doesNotMatch(url,/deployments|subdomain|schedules|domains/);}
});

test('ambiguous Version transport reconciles read-only once and never submits a second upload',async()=>{
  let posts=0,gets=0;
  const fetchImpl=async(url,init={})=>{
    if(init.method==='POST'){posts++;throw new Error('synthetic transport loss');}
    gets++;return json({items:[{id:ORIGINAL_BLOCKED_VERSION_ID},{id:ATTENDED_VERSION_ID}]});
  };
  const result=await runVersionPreparation({env:versionEnv(),fetchImpl,admission:startReport()});
  assert.equal(result.mutationDisposition,'reconciled');assert.equal(result.attendedVersionId,ATTENDED_VERSION_ID);assert.equal(posts,1);assert.equal(gets,1);
});

test('ambiguous Version state stops without automatic recreation',async()=>{
  let posts=0;
  await assert.rejects(()=>runVersionPreparation({
    env:versionEnv(),admission:startReport(),fetchImpl:async(url,init={})=>{
      if(init.method==='POST'){posts++;throw new Error('synthetic transport loss');}
      return json({items:[{id:ORIGINAL_BLOCKED_VERSION_ID},{id:ATTENDED_VERSION_ID},{id:'22222222-2222-4222-8222-222222222222'}]});
    }
  }),/collector_staging_version_delta_ambiguous_owner_review_required/);
  assert.equal(posts,1);
});

test('preparation request allowlists expose no Deployment Preview Cron route domain or provider endpoint',()=>{
  const versionBase=`/accounts/${ACCOUNT}/workers/scripts/teamsheet-api-football-shadow-collector/versions`;
  assert.equal(assertPreparationVersionRequestAllowed('POST',versionBase,{accountId:ACCOUNT}),true);
  assert.equal(assertPreparationVersionRequestAllowed('GET',versionBase+'?deployable=true',{accountId:ACCOUNT}),true);
  for(const p of [versionBase+'/x',`/accounts/${ACCOUNT}/workers/scripts/teamsheet-api-football-shadow-collector/deployments`,`/accounts/${ACCOUNT}/workers/scripts/teamsheet-api-football-shadow-collector/subdomain`])
    assert.throws(()=>assertPreparationVersionRequestAllowed('POST',p,{accountId:ACCOUNT}),/attended_preparation_version_endpoint_forbidden/);
  const d1=`/accounts/${ACCOUNT}/d1/database/${EXPECTED_D1_DATABASE_ID}/query`;
  assert.equal(assertPreparationCredentialRequestAllowed('POST',d1,{accountId:ACCOUNT}),true);
  assert.throws(()=>assertPreparationCredentialRequestAllowed('GET',d1,{accountId:ACCOUNT}),/attended_preparation_credential_endpoint_forbidden/);
});

function credentialEnv(){return {
  APPROVED_SHA,CLOUDFLARE_ACCOUNT_ID:ACCOUNT,CLOUDFLARE_ACCOUNT_FINGERPRINT:FINGERPRINT,
  CLOUDFLARE_ATTENDED_D1_MUTATION_TOKEN:'synthetic-d1-token',API_FOOTBALL_ATTENDED_VERSION_ID:ATTENDED_VERSION_ID
};}

test('credential preparation performs exactly one fail-closed UNPROVISIONED to AVAILABLE statement and one row change',async()=>{
  let calls=0,body=null;
  const result=await runCredentialPreparation({
    env:credentialEnv(),admission:versionReport(),fetchImpl:async(url,init)=>{
      calls++;body=JSON.parse(init.body);
      return json([{success:true,results:[],meta:{changes:1,rows_written:1}}]);
    }
  });
  assert.equal(result.ok,true);assert.equal(result.classification,CREDENTIAL_PREPARATION_SUCCESS);assert.equal(result.d1Calls,1);assert.equal(result.d1Statements,1);assert.equal(result.rowsChanged,1);assert.equal(calls,1);
  assert.equal(body.sql,"UPDATE api_football_runtime_state SET credential_state='AVAILABLE' WHERE provider='api-football' AND collection_enabled=0 AND credential_state='UNPROVISIONED' AND in_flight_attempt_id IS NULL");
  assert.deepEqual(body.params,[]);
  assert.equal(result.providerRequests,0);assert.equal(result.versionMutations,0);assert.equal(result.deploymentMutations,0);assert.equal(result.previewMutations,0);
});

test('credential mutation ambiguity never resubmits and requires independent reconciliation',async()=>{
  let calls=0;
  const result=await runCredentialPreparation({env:credentialEnv(),admission:versionReport(),fetchImpl:async()=>{calls++;throw new Error('lost');}});
  assert.equal(result.ok,false);assert.equal(result.classification,CREDENTIAL_PREPARATION_AMBIGUOUS);assert.equal(result.retryAuthorized,false);assert.equal(result.d1Calls,1);assert.equal(calls,1);
});

test('credential preparation rejects invalid prior state before any mutation',async()=>{
  let calls=0;const bad=versionReport();bad.runtime.credentialState='AVAILABLE';
  await assert.rejects(()=>runCredentialPreparation({env:credentialEnv(),admission:bad,fetchImpl:async()=>{calls++;return json([]);}}),/attended_preparation_handoff_invalid|attended_preparation_version_not_ready/);
  assert.equal(calls,0);
});

test('independent closeout reaches only READY_FOR_SEPARATELY_APPROVED_ATTENDED_ACCEPTANCE from exact AVAILABLE pristine state',()=>{
  const base=evidence(COLLECTOR_PREFLIGHT_PREPARATION_CLOSEOUT_STAGE,{inventory:inventoryAttended(),credentialState:'AVAILABLE'});
  const result=classifyCollectorActivationPreflight(base,{now:NOW});
  assert.equal(result.ok,true);assert.equal(result.classification,COLLECTOR_ATTENDED_STAGE_READY);
  for(const mutated of [
    {...base,runtime:{...base.runtime,credentialState:'UNPROVISIONED'}},
    {...base,inventory:{...base.inventory,deploymentCount:1}},
    {...base,inventory:{...base.inventory,previewUrls:true}},
    {...base,inventory:{...base.inventory,originalVersionIdentityExact:false}},
    {...base,counts:{...base.counts,generations:1}}
  ])assert.equal(classifyCollectorActivationPreflight(mutated,{now:NOW}).ok,false);
  assert.equal(validatePreparationAdmission(closeoutReport(),{approvedSha:APPROVED_SHA,accountFingerprint:FINGERPRINT,phase:'CLOSEOUT',versionId:ATTENDED_VERSION_ID}),true);
});

test('preparation workflow is manual first-attempt exact-main protected and structurally incapable of acceptance or provider execution',()=>{
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/api-football-attended-preparation.yml'),'utf8');
  assert.match(workflow,/workflow_dispatch:/);assert.match(workflow,/github\.run_attempt == 1/);assert.match(workflow,/refs\/heads\/main/);
  assert.match(workflow,/Tests and deterministic build/);assert.match(workflow,/row\.app\?\.slug==='github-actions'/);
  assert.match(workflow,/https:\/\/github\.com\/priteshpatel390-del\/FPL\/actions\/runs\//);
  assert.match(workflow,/persist-credentials: false/);assert.match(workflow,/cancel-in-progress: false/);
  assert.match(workflow,/name: data-steward-readonly/);
  assert.match(workflow,/name: api-football-attended-preparation-version/);
  assert.match(workflow,/name: api-football-attended-preparation-credential/);
  assert.match(workflow,/CLOUDFLARE_ATTENDED_VERSION_UPLOAD_TOKEN/);assert.match(workflow,/CLOUDFLARE_ATTENDED_D1_MUTATION_TOKEN/);
  assert.match(workflow,/READY_FOR_SEPARATELY_APPROVED_ATTENDED_ACCEPTANCE/);
  assert.ok((workflow.match(/git ls-remote/g)||[]).length>=5);
  assert.ok((workflow.match(/git status --porcelain --untracked-files=all/g)||[]).length>=5);
  assert.doesNotMatch(workflow,/^\s{2}(?:schedule|push):/m);
  assert.doesNotMatch(workflow,/CLOUDFLARE_COLLECTOR_WORKER_UPLOAD_TOKEN|run-attended-acceptance|attended-one-shot|v3\.football\.api-sports\.io|wrangler\s+deploy|\/deployments(?:['"\s]|$)/);
  for(const match of workflow.matchAll(/uses:\s+[^@\s]+@([^\s#]+)/g))assert.match(match[1],/^[0-9a-f]{40}$/);
});

test('preparation remains completely isolated from production model and browser paths',()=>{
  assert.equal(productionModelUiImportCount(),0);
  const prep=fs.readFileSync(path.join(root,'workers/api-football-collector/attended-preparation.mjs'),'utf8');
  assert.doesNotMatch(prep,/src\/model|optimiseTransfers|projectXP|captain|mini.?league/i);
  assert.doesNotMatch(prep,/v3\.football\.api-sports\.io|attended-one-shot|previews_enabled\s*:\s*true|\/deployments/);
});
