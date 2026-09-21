import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {classifyCollectorActivationPreflight,COLLECTOR_ACTIVATION_PREFLIGHT_VERSION} from '../workers/api-football-collector/activation-preflight.mjs';
import {ATTENDED_ACCEPTANCE_PATH,runAttendedHttpRequest} from '../workers/api-football-collector/collector.mjs';
import {buildAttendedVersionMetadata,buildUploadModules,deterministicIdentity,resolveModuleGraph,validateAttendedVersionDetail} from '../workers/api-football-collector/stage-inactive-version.mjs';
import {classifyAcceptanceReconciliation,runAttendedAcceptance,runtimeMutationContract} from '../workers/api-football-collector/attended-acceptance.mjs';
import {EXPECTED_D1_DATABASE_ID} from '../workers/data-platform/phase4b/live-contract.mjs';

const root=path.resolve(import.meta.dirname,'..');
const NOW='2026-09-21T12:00:00.000Z';
const SHA='a'.repeat(40),VERSION='11111111-1111-4111-8111-111111111111';
const SECRET='x'.repeat(64);
const request=(method='POST',path=ATTENDED_ACCEPTANCE_PATH,secret=SECRET)=>new Request('https://preview.invalid'+path,{method,headers:{'x-teamsheet-attended-trigger':secret}});

test('attended HTTP path is exact, secret-gated, generic, and reuses collector composition',async()=>{
  let calls=0;const run=async({controller,env})=>{calls++;assert.equal(env.EIA_2I5D_ACTIVATION,'ATTENDED_ONE_SHOT_DISCOVERY');assert.ok(Number.isFinite(controller.scheduledTime));return {ok:true};};
  const env={EIA_2I5D_ACTIVATION:'ATTENDED_ONE_SHOT_DISCOVERY',API_FOOTBALL_ATTENDED_TRIGGER_SECRET:SECRET};
  assert.deepEqual(await runAttendedHttpRequest(request(),env,{run,now:()=>1}),{status:202,body:'Accepted'});assert.equal(calls,1);
  for(const [candidate,candidateEnv] of [
    [request('GET'),env],[request('POST','/wrong'),env],[request('POST',ATTENDED_ACCEPTANCE_PATH,'y'.repeat(64)),env],
    [request(),{...env,EIA_2I5D_ACTIVATION:'REPOSITORY_ONLY_BLOCKED'}]
  ])assert.deepEqual(await runAttendedHttpRequest(candidate,candidateEnv,{run}),{status:404,body:'Not found'});
  assert.equal(calls,1);
});

test('attended HTTP failures never render either secret',async()=>{
  const env={EIA_2I5D_ACTIVATION:'ATTENDED_ONE_SHOT_DISCOVERY',API_FOOTBALL_ATTENDED_TRIGGER_SECRET:SECRET,API_FOOTBALL_API_KEY:'provider-secret'};
  const result=await runAttendedHttpRequest(request(),env,{run:async()=>{throw new Error(SECRET+' provider-secret');}});
  assert.deepEqual(result,{status:409,body:'Not accepted'});assert.doesNotMatch(JSON.stringify(result),/provider-secret|x{16}/);
});

function attendedEvidence(overrides={}){return {
  version:COLLECTOR_ACTIVATION_PREFLIGHT_VERSION,stage:'ATTENDED_ACCEPTANCE',
  migrations:[[1,'shadow_data_foundation'],[2,'official_fpl_structured_history'],[3,'production_query_plan_indexes'],[4,'api_football_shadow_identity'],[5,'api_football_shadow_runtime'],[6,'api_football_mapping_qualification']],
  foreignKeyViolations:0,
  authority:{season:'2026-27',sourceKey:'official-fpl',sourceRevisionId:'official-fpl-r1',runId:'run',runStatus:'completed',fetchedAt:NOW,digest:'a'.repeat(64),teamIds:Array.from({length:20},(_,i)=>`2026-27:fpl:team:${i+1}`)},
  mapping:{state:'COMMITTED',isCurrentHead:true,mappingCount:20,memberCount:20,distinctProviderIds:20,distinctFplIds:20,canonicalTeamIds:Array.from({length:20},(_,i)=>`2026-27:fpl:team:${i+1}`),historicalAuthorityDigest:'b'.repeat(64),historicalAuthorityFetchedAt:NOW},
  runtime:{provider:'api-football',collectionEnabled:0,credentialState:'AVAILABLE',inFlightAttemptId:null,inFlightLeaseExpiresAt:null},
  counts:{requestAttempts:0,generations:0,fixtureRevisions:0},priorState:{attempt2Count:0,reservedAttemptCount:0,stagingGenerationCount:0},modelUiImportCount:0,
  inventory:{activation:'ATTENDED_ONE_SHOT_DISCOVERY',databaseIdPlaceholder:false,productionBindingProven:true,workerPresent:true,deploymentCount:0,cronCount:0,workersDev:false,previewUrls:false,configurationExact:true,versionIdentityExact:true,routeCount:0,customDomainCount:0,secretBindingPresent:true,secretBindingNames:['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET']},
  ...overrides
};}

test('attended admission requires zero Deployments, exact Version, both secret names, disabled runtime and pristine history',()=>{
  assert.equal(classifyCollectorActivationPreflight(attendedEvidence(),{now:NOW}).classification,'READY_FOR_SEPARATELY_APPROVED_ATTENDED_ACCEPTANCE');
  for(const evidence of [
    attendedEvidence({inventory:{...attendedEvidence().inventory,deploymentCount:1}}),
    attendedEvidence({inventory:{...attendedEvidence().inventory,versionIdentityExact:false}}),
    attendedEvidence({inventory:{...attendedEvidence().inventory,secretBindingNames:['API_FOOTBALL_API_KEY']}}),
    attendedEvidence({runtime:{...attendedEvidence().runtime,collectionEnabled:1}}),
    attendedEvidence({counts:{requestAttempts:1,generations:0,fixtureRevisions:0}})
  ])assert.equal(classifyCollectorActivationPreflight(evidence,{now:NOW}).ok,false);
});

test('attended Version metadata is deterministic and has exact closed bindings',()=>{
  const metadata=buildAttendedVersionMetadata(SHA),modules=buildUploadModules(resolveModuleGraph()),identity=deterministicIdentity(metadata,modules,SHA);
  assert.deepEqual(metadata.bindings.map(row=>row.name),['TEAMSHEET_DATA_DB','API_FOOTBALL_FPL_SEASON','API_FOOTBALL_PROVIDER_SEASON','EIA_2I5D_ACTIVATION','API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET']);
  assert.equal(metadata.bindings.find(row=>row.name==='EIA_2I5D_ACTIVATION').text,'ATTENDED_ONE_SHOT_DISCOVERY');
  const detail={id:VERSION,metadata_sha256:identity.metadataSha256,resources:{bindings:metadata.bindings}};
  assert.equal(validateAttendedVersionDetail(detail,{versionId:VERSION,approvedSha:SHA,identity}),true);
  assert.equal(metadata.bindings.find(row=>row.name==='TEAMSHEET_DATA_DB').database_id,EXPECTED_D1_DATABASE_ID);
  assert.doesNotMatch(JSON.stringify(metadata),new RegExp(SECRET));
});

test('attended controller invokes once and always disables collection and Preview URLs',async()=>{
  const events=[];const admission={ok:true,stage:'ATTENDED_ACCEPTANCE',classification:'READY_FOR_SEPARATELY_APPROVED_ATTENDED_ACCEPTANCE',inventory:{reviewedVersionId:VERSION,versionIdentityExact:true},runtime:{collectionEnabled:0,credentialState:'AVAILABLE',activeLease:false},evidence:{productionMutations:0,apiFootballRequests:0,secretValuesRead:0}};
  const result=await runAttendedAcceptance({admission,versionId:VERSION,enablePreview:async()=>events.push('preview-on'),enableCollection:async()=>events.push('collection-on'),invokeOnce:async()=>{events.push('invoke');throw new Error('unknown');},disableCollection:async()=>events.push('collection-off'),disablePreview:async()=>events.push('preview-off')});
  assert.equal(result.retryAuthorized,false);assert.deepEqual(events,['preview-on','collection-on','invoke','collection-off','preview-off']);
});

test('credential and collection mutations are explicit, distinct and bounded',()=>{
  const contracts=['SET_CREDENTIAL_AVAILABLE','ENABLE_COLLECTION','DISABLE_COLLECTION','RESET_CREDENTIAL'].map(runtimeMutationContract);
  assert.equal(contracts.every(row=>row.expectedChanges===1),true);
  assert.equal(new Set(contracts.map(row=>row.sql)).size,4);
  assert.match(contracts[0].sql,/credential_state='AVAILABLE'/);assert.match(contracts[1].sql,/collection_enabled=1/);
  assert.match(contracts[2].sql,/collection_enabled=0/);assert.match(contracts[3].sql,/credential_state='UNPROVISIONED'/);
});

test('reconciliation accepts exact success and never authorizes retry for ambiguity',()=>{
  const success={collectionEnabled:0,activeLease:false,attempt2Count:0,requestAttempts:5,succeededAttempts:5,attemptOneCount:5,generations:1,committedGenerations:1,headMatchesGeneration:true,fixtureRevisions:2500,rawPayloadRows:0,modelUiImportCount:0};
  assert.equal(classifyAcceptanceReconciliation(success).classification,'ATTENDED_ACCEPTANCE_SUCCEEDED');
  assert.equal(classifyAcceptanceReconciliation({...success,committedGenerations:0}).retryAuthorized,false);
});

test('shipped config remains inert and model paths do not import attended collector',()=>{
  const config=JSON.parse(fs.readFileSync(path.join(root,'workers/api-football-collector/wrangler.jsonc'),'utf8'));
  assert.equal(config.vars.EIA_2I5D_ACTIVATION,'REPOSITORY_ONLY_BLOCKED');assert.deepEqual(config.triggers.crons,[]);assert.equal(config.workers_dev,false);assert.equal(config.preview_urls,false);assert.equal(config.d1_databases[0].database_id,'00000000-0000-0000-0000-000000000000');
  for(const file of fs.readdirSync(path.join(root,'src')).filter(name=>name.endsWith('.js')))assert.doesNotMatch(fs.readFileSync(path.join(root,'src',file),'utf8'),/attended-acceptance|api-football-collector/);
});

test('attended workflow is manual exact-main zero-Deployment and one-invocation only',()=>{
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/api-football-collector-attended-acceptance.yml'),'utf8');
  const executor=fs.readFileSync(path.join(root,'workers/api-football-collector/run-attended-acceptance.mjs'),'utf8');
  for(const expected of [/workflow_dispatch:/,/github\.run_attempt == 1/,/refs\/heads\/main/,/Tests and deterministic build/,/ATTENDED_ACCEPTANCE/,/run-attended-acceptance\.mjs/,/node-version: 24\.19\.0/])assert.match(workflow,expected);
  assert.doesNotMatch(workflow,/schedule:|wrangler\s+deploy|\/deployments/);
  assert.match(executor,/providerInvocations!==0/);assert.match(executor,/disableCollection/);assert.match(executor,/disablePreview/);
  assert.doesNotMatch(executor,/v3\.football\.api-sports\.io|API_FOOTBALL_API_KEY|attempt_number\s*=\s*2/);
});
