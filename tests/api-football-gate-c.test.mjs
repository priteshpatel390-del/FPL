// Gate C synthetic tests. Reuse Gate B reviewed mock Version bytes; no live network. No live Cloudflare or API-Football action is performed.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  ATTENDED_VERSION_ID,ORIGINAL_BLOCKED_VERSION_ACTIVATION,ORIGINAL_BLOCKED_VERSION_ID,buildImmutableAttendedVersionIdentity,buildLifecycleCloneIdentity,
  expectedAttendedBindings
} from '../workers/api-football-collector/attended-version.mjs';
import {buildUploadModules,resolveModuleGraph} from '../workers/api-football-collector/stage-inactive-version.mjs';
import {
  DEPLOYED_ONE_SHOT_CLONE_APPROVED_SHA,DEPLOYED_ONE_SHOT_CLONE_VERSION_ID,DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_REASON,
  DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_STOP,DEPLOYED_ONE_SHOT_EXISTING_DEPLOYMENT_ID,DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE,
  DEPLOYED_ONE_SHOT_VERSION_APPROVED_SHA,DEPLOYED_ONE_SHOT_VERSION_ID,DEPLOYED_ONE_SHOT_WORKER,DEPLOYED_ONE_SHOT_WORKER_ID
} from '../workers/api-football-collector/deployed-one-shot.mjs';
import {
  TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS,TRANSPORT_REMEDIATED_VERSION_MODULE_SHA256,buildTransportRemediatedVersionIdentity,
  readCurrentTreeModuleSource,resolveTransportRemediatedModuleGraph
} from '../workers/api-football-collector/transport-remediated-version.mjs';
import {
  PROMOTION_ADMISSION_STOP,PROMOTION_CANDIDATE_CREATION_SHA,PROMOTION_CANDIDATE_GRAPH_SHA256,PROMOTION_CANDIDATE_METADATA_SHA256,
  PROMOTION_CANDIDATE_MODULE_COUNT,PROMOTION_CANDIDATE_VERSION_ID,PROMOTION_CLEAN_STOP,PROMOTION_EXECUTION_KEYS,PROMOTION_EXPECTED_VERSION_IDS,
  PROMOTION_GATE_A_RUN_ID,PROMOTION_MESSAGE_MAX_LENGTH,PROMOTION_MUTATION_CEILINGS,PROMOTION_OUTCOMES,PROMOTION_OWNER_ATTENTION,
  PROMOTION_PROMOTED_INERT,PROMOTION_READY,PROMOTION_RETAINED_DEPLOYMENT_ID,PROMOTION_RETAINED_VERSION_ID,buildPromotionAdmission,
  buildPromotionCandidateIdentity,buildPromotionDeploymentBody,buildPromotionDeploymentMessage,buildPromotionExecutionEvidence,
  classifyPromotionReconciliation,closedDiagnostic,promotionAdmissionDiagnostic,promotionDeploymentRows,promotionPostStateExact,
  promotionPreStateExact,promotionVersionInventoryDiagnostic,serializePromotionDeploymentBody,submitPromotionDeployment,
  validatePromotionAdmissionHandoff,validatePromotionExecutionEvidence
} from '../workers/api-football-collector/transport-remediated-deployment-promotion.mjs';
import {
  PROMOTION_FORBIDDEN_ENV,assertPromotionMutationAllowed,createPromotionGuardedFetch,executeTransportRemediatedDeploymentPromotion,promotionPaths
} from '../workers/api-football-collector/run-transport-remediated-deployment-promotion.mjs';
import {
  promotionReadPaths,runPromotionAdmission,runPromotionReconciliation
} from '../workers/api-football-collector/transport-remediated-deployment-promotion-readonly.mjs';
import {activeDeploymentState,transportRemediatedAdmissionDiagnostic} from '../workers/api-football-collector/transport-remediated-version-preparation.mjs';

const root=path.resolve(import.meta.dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const uncommented=source=>source.replace(/^\s*(?:\/\/|#).*$/gm,'');
const sha256=value=>createHash('sha256').update(value).digest('hex');
const ACCOUNT='production-account',FINGERPRINT=sha256(ACCOUNT);
// Gate B executes on a LATER main SHA than the candidate's immutable creation SHA.
const EXEC_SHA='e'.repeat(40);
const READ='synthetic-read-token',PROMOTE='synthetic-promotion-token',TOPOLOGY_TOKEN='synthetic-topology-token';
const SUBDOMAIN='fpltsheet',CANDIDATE=PROMOTION_CANDIDATE_VERSION_ID,RETAINED=DEPLOYED_ONE_SHOT_EXISTING_DEPLOYMENT_ID;
const NEW_DEPLOYMENT='9b48b57a-e505-4213-9547-fe44835a9bdb',THIRD_DEPLOYMENT='77777777-6666-4555-8444-333333333333';
const ZONE={proof:'ZONE_ROUTE_SCAN',zoneCount:1,routeRowCount:0,routeCount:0};
const RETAINED_CREATED='2026-10-06T08:00:00.000Z';
const retainedRow={id:RETAINED,created_on:RETAINED_CREATED,strategy:'percentage',versions:[{version_id:ATTENDED_VERSION_ID,percentage:100}]};
const promotedRow={id:NEW_DEPLOYMENT,created_on:'2026-10-08T08:00:00.000Z',strategy:'percentage',versions:[{version_id:CANDIDATE,percentage:100}],annotations:{'workers/message':'x'}};
const API='https://api.cloudflare.com/client/v4';
const paths=promotionPaths(ACCOUNT),readPaths=promotionReadPaths(ACCOUNT);
const rows=list=>promotionDeploymentRows({deployments:list});

const CONSUMED={requestAttempts:1,attempt1Count:1,attempt2Count:0,succeededAttemptCount:0,transportUnknownCount:1,generations:1,failedGenerationCount:1,
  committedGenerationCount:0,fixtureRevisions:0,reservedAttemptCount:0,stagingGenerationCount:0,authFailureCount:0,quotaBlockedCount:0,timeoutCount:0,
  schemaFailureCount:0,httpFailureCount:0,persistenceUncertainCount:0,completionUncertainCount:0,membershipConsistentCount:0,headMatchCount:0};
function report(overrides={},approvedSha=EXEC_SHA){
  const base={
    ok:false,stage:DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE,classification:DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_STOP,reason:DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_REASON,
    approvedSha,versionApprovedSha:DEPLOYED_ONE_SHOT_VERSION_APPROVED_SHA,cloneApprovedSha:DEPLOYED_ONE_SHOT_CLONE_APPROVED_SHA,accountFingerprint:FINGERPRINT,
    migrationCount:6,foreignKeyViolations:0,officialFplAuthority:{valid:true,teamCount:20,fetchedAt:'2026-10-08T01:20:00.000Z'},
    mapping:{state:'COMMITTED',mappingCount:20,memberCount:20,distinctProviderIds:20,distinctFplIds:20,canonicalCoverageMatches:true,historicalAuthorityProvenancePresent:true},
    runtime:{collectionEnabled:0,credentialState:'AVAILABLE',activeLease:false},
    priorState:{...CONSUMED},
    // With four Versions the generic preflight cannot prove the three-Version lifecycle inventory; Gate B proves it itself.
    inventory:{activation:'ATTENDED_ONE_SHOT_DISCOVERY',databaseIdPlaceholder:false,productionBindingProven:true,configurationExact:true,workerPresent:true,deploymentCount:2,cronCount:0,routeCount:0,customDomainCount:0,
      workersDev:false,previewUrls:false,secretBindingPresent:true,secretBindingNames:['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET'],
      reviewedVersionId:DEPLOYED_ONE_SHOT_VERSION_ID,reviewedWorkerId:DEPLOYED_ONE_SHOT_WORKER_ID,versionIdentityExact:false,versionInventoryExact:false,
      cloneVersionId:DEPLOYED_ONE_SHOT_CLONE_VERSION_ID,cloneVersionIdentityExact:false,previewUrlIdentityExact:true,accountSubdomain:SUBDOMAIN},
    modelUiImportCount:0,rawPayloadStoragePresent:false,evidence:{productionMutations:0,apiFootballRequests:0,secretValuesRead:0}
  };
  return structuredClone({...base,...overrides,inventory:{...base.inventory,...overrides.inventory},runtime:{...base.runtime,...overrides.runtime},
    priorState:{...base.priorState,...overrides.priorState},mapping:{...base.mapping,...overrides.mapping},officialFplAuthority:{...base.officialFplAuthority,...overrides.officialFplAuthority},
    evidence:{...base.evidence,...overrides.evidence}});
}

// ---- Version detail fixtures built from the real reviewed bytes ----
const b64=source=>Buffer.from(source).toString('base64');
const bindingsCopy=()=>expectedAttendedBindings().map(binding=>({...binding}));
function originalStable(){
  return {id:ORIGINAL_BLOCKED_VERSION_ID,resources:{script_runtime:{compatibility_date:'2026-09-16'},
    bindings:expectedAttendedBindings().slice(0,4).map(binding=>binding.name==='EIA_2I5D_ACTIVATION'?{...binding,text:ORIGINAL_BLOCKED_VERSION_ACTIVATION}:{...binding})}};
}
function detail(versionId,identity,modules){
  return {stable:{id:versionId,resources:{script_runtime:{compatibility_date:identity.compatibilityDate},bindings:bindingsCopy()}},
    beta:{id:versionId,main_module:identity.mainModule,compatibility_date:identity.compatibilityDate,annotations:{'workers/message':identity.message,'workers/tag':identity.tag},urls:[],
      modules:[...modules].map(([name,source])=>({name,content_base64:b64(source)}))}};
}
const historicalModules=()=>buildUploadModules(resolveModuleGraph());
const candidateModules=()=>buildUploadModules(resolveTransportRemediatedModuleGraph());
function versionsFixture(){
  return {versionIds:[...PROMOTION_EXPECTED_VERSION_IDS],originalStable:originalStable(),
    attended:detail(ATTENDED_VERSION_ID,buildImmutableAttendedVersionIdentity(),historicalModules()),
    clone:detail(DEPLOYED_ONE_SHOT_CLONE_VERSION_ID,buildLifecycleCloneIdentity(DEPLOYED_ONE_SHOT_CLONE_APPROVED_SHA),historicalModules()),
    candidate:detail(CANDIDATE,buildTransportRemediatedVersionIdentity(PROMOTION_CANDIDATE_CREATION_SHA),candidateModules())};
}
const VERSIONS=versionsFixture();
const clone=value=>structuredClone(value);
const admission=(overrides={})=>buildPromotionAdmission({report:report(),deploymentRows:rows([retainedRow]),versions:clone(VERSIONS),topology:ZONE,approvedSha:EXEC_SHA,accountFingerprint:FINGERPRINT,...overrides});
function tempFile(value){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'promotion-'));const file=path.join(dir,'admission.json');fs.writeFileSync(file,JSON.stringify(value));return file;}


import {
  GATE_C_ACTIVE_DEPLOYMENT_ID,GATE_C_READY,GATE_C_STOP,GATE_C_SUCCESS,GATE_C_OWNER_ATTENTION,GATE_C_CLEAN_STOP,
  GATE_C_EXECUTION_VERSION,GATE_C_EARLIEST_UTC_DAY,GATE_C_MUTATION_CEILINGS,
  gateCHistoryDiagnostic,gateCAdmissionDiagnostic,buildGateCAdmission,validateGateCAdmissionHandoff,
  classifyGateCReconciliation
} from '../workers/api-football-collector/gate-c.mjs';
import {gateCCriticalRecheckDiagnostic,assertGateCRequestAllowed} from '../workers/api-football-collector/run-gate-c.mjs';
import {runDeployedOneShotContinuation} from '../workers/api-football-collector/deployed-one-shot.mjs';
import {deployedOneShotCloudflarePaths} from '../workers/api-football-collector/run-deployed-one-shot.mjs';

const goodRows=()=>rows([promotedRow,retainedRow]);
const goodInput=(overrides={})=>({report:report(),deploymentRows:goodRows(),versions:clone(VERSIONS),
  topology:ZONE,approvedSha:EXEC_SHA,accountFingerprint:FINGERPRINT,utcDay:'2026-10-08',...overrides});
const admitted=()=>buildGateCAdmission(goodInput());
const completed=()=>({...CONSUMED,requestAttempts:6,attempt1Count:6,succeededAttemptCount:5,generations:2,
  committedGenerationCount:1,membershipConsistentCount:1,headMatchCount:1,fixtureRevisions:7});
function successfulExecution(){
  return {version:GATE_C_EXECUTION_VERSION,approvedSha:EXEC_SHA,versionId:CANDIDATE,
    deployment:{deploymentId:GATE_C_ACTIVE_DEPLOYMENT_ID},mutations:{createDeployment:0,enableWorkersDev:1,disableWorkersDev:1},
    controlBudget:{d1Calls:2,d1RowsChanged:2},triggerRequests:1,ok:true,
    cleanup:{collectionDisable:{outcome:'SUCCEEDED'},workersDevDisable:{outcome:'SUCCEEDED'}},
    retryAuthorized:false,evidence:{apiFootballRequestsByExecutor:0,secretValuesSerialized:0}};
}
const reconcile=(newReport=report({priorState:completed()}),execution=successfulExecution(),more={})=>
  classifyGateCReconciliation({report:newReport,deploymentRows:goodRows(),versions:clone(VERSIONS),topology:ZONE,
    execution,admission:admitted(),approvedSha:EXEC_SHA,accountFingerprint:FINGERPRINT,...more});

test('Gate C admits exact corrected two-Deployment inert state and consumed historical attempt',()=>{
  assert.equal(GATE_C_EARLIEST_UTC_DAY,'2026-10-08');
  assert.deepEqual(GATE_C_MUTATION_CEILINGS,{deploymentPost:0,versionUpload:0,workersDevEnable:1,workersDevDisable:1,controlD1Calls:2,triggerPost:1,preview:0,cron:0,routes:0,domains:0});
  const a=admitted();assert.equal(a.ok,true);assert.equal(a.classification,GATE_C_READY);
  assert.equal(a.versionId,CANDIDATE);assert.equal(a.deploymentId,GATE_C_ACTIVE_DEPLOYMENT_ID);
  assert.equal(validateGateCAdmissionHandoff(a,{approvedSha:EXEC_SHA,accountFingerprint:FINGERPRINT,utcDay:'2026-10-08'}),true);
});

test('Gate C admission rejects stale/pristine/extra history and old or split Deployment',()=>{
  for(const history of [{...CONSUMED,requestAttempts:0},{...CONSUMED,requestAttempts:2},
    {...CONSUMED,transportUnknownCount:0},{...CONSUMED,attempt2Count:1},{...CONSUMED,generations:2}]){
    assert.equal(buildGateCAdmission(goodInput({report:report({priorState:history})})).classification,GATE_C_STOP);
  }
  for(const deployments of [rows([retainedRow]),rows([retainedRow,promotedRow]),
    rows([{...promotedRow,versions:[{version_id:CANDIDATE,percentage:50}]},retainedRow]),
    rows([{...promotedRow,id:'aaaa1111-bbbb-4222-8333-444444444444'},retainedRow]),
    rows([promotedRow,retainedRow,{...retainedRow,id:'bbbb1111-bbbb-4222-8333-444444444444'}])]){
    assert.equal(buildGateCAdmission(goodInput({deploymentRows:deployments})).ok,false);
  }
  assert.equal(buildGateCAdmission(goodInput({utcDay:'2026-10-06'})).reason,'new_utc_day_not_approved');
  assert.equal(buildGateCAdmission(goodInput({topology:{...ZONE,routeCount:1}})).ok,false);
});

test('Gate C rejects malformed and drifted Version inventory and configuration',()=>{
  const five=clone(VERSIONS);five.versionIds.push('11111111-2222-4333-8444-555555555555');
  assert.equal(buildGateCAdmission(goodInput({versions:five})).ok,false);
  const changed=clone(VERSIONS);changed.candidate.beta.modules[0].content_base64=b64('mutation');
  assert.equal(buildGateCAdmission(goodInput({versions:changed})).ok,false);
  assert.equal(buildGateCAdmission(goodInput({report:report({inventory:{workersDev:true}})})).ok,false);
  assert.equal(buildGateCAdmission(goodInput({report:report({migrationCount:5})})).ok,false);
});

test('Gate C handoff refuses tampering and a different UTC day',()=>{
  const a=admitted();
  for(const modified of [{...a,versionId:ATTENDED_VERSION_ID},{...a,retryAuthorized:true},
    {...a,versionIds:[...a.versionIds,'extra']},{...a,deployments:rows([retainedRow])},
    {...a,preflight:report({priorState:{...CONSUMED,attempt2Count:1}})]){
    assert.throws(()=>validateGateCAdmissionHandoff(modified,{approvedSha:EXEC_SHA,accountFingerprint:FINGERPRINT,utcDay:'2026-10-08'}));
  }
  assert.throws(()=>validateGateCAdmissionHandoff(a,{approvedSha:EXEC_SHA,accountFingerprint:FINGERPRINT,utcDay:'2026-10-09'}));
});

test('Gate C pre-mutation rechecks current history, topology and four Version identities',()=>{
  assert.equal(gateCCriticalRecheckDiagnostic(report(),goodRows(),clone(VERSIONS),ZONE,
    {approvedSha:EXEC_SHA,accountFingerprint:FINGERPRINT,utcDay:'2026-10-08'}),null);
  assert.match(gateCCriticalRecheckDiagnostic(report({priorState:{...CONSUMED,requestAttempts:2}}),goodRows(),clone(VERSIONS),ZONE,
    {approvedSha:EXEC_SHA,accountFingerprint:FINGERPRINT,utcDay:'2026-10-08'}),/GATE_C_CRITICAL_STATE_DRIFT/);
});

test('Gate C success needs old failed attempt retained, five new successes, exact head and cleanup',()=>{
  const result=reconcile();
  assert.equal(result.ok,true);assert.equal(result.classification,GATE_C_SUCCESS);
  assert.equal(result.providerRequests,5);assert.equal(result.committedGenerationCount,1);
  for(const history of [
    {...completed(),transportUnknownCount:0},{...completed(),attempt2Count:1},
    {...completed(),requestAttempts:5},{...completed(),committedGenerationCount:0},
    {...completed(),membershipConsistentCount:0},{...completed(),headMatchCount:0},
    {...completed(),fixtureRevisions:2501},{...completed(),persistenceUncertainCount:1},
    {...completed(),reservedAttemptCount:1},{...completed(),schemaFailureCount:1}
  ])assert.equal(reconcile(report({priorState:history})).classification,GATE_C_OWNER_ATTENTION);
  for(const execution of [
    {...successfulExecution(),triggerRequests:0},{...successfulExecution(),retryAuthorized:true},
    {...successfulExecution(),mutations:{createDeployment:1,enableWorkersDev:1,disableWorkersDev:1}},
    {...successfulExecution(),cleanup:{collectionDisable:{outcome:'FAILED'},workersDevDisable:{outcome:'SUCCEEDED'}}}
  ])assert.equal(reconcile(report({priorState:completed()}),execution).ok,false);
});

test('Gate C no-new-generation is a clean stop, never successful collection',()=>{
  assert.equal(reconcile(report()).classification,GATE_C_CLEAN_STOP);
  assert.equal(reconcile(report({runtime:{collectionEnabled:1}})).classification,GATE_C_OWNER_ATTENTION);
  assert.equal(reconcile(report({inventory:{workersDev:true}})).classification,GATE_C_OWNER_ATTENTION);
});

test('Gate C executor has closed API allowlist, no Deployment or Version write and one trigger composition',async()=>{
  const paths=deployedOneShotCloudflarePaths(ACCOUNT);
  assert.equal(assertGateCRequestAllowed('POST',paths.subdomain,{accountId:ACCOUNT}),'MUTATION');
  assert.equal(assertGateCRequestAllowed('POST',paths.d1,{accountId:ACCOUNT}),'MUTATION');
  assert.equal(assertGateCRequestAllowed('GET',paths.deployments,{accountId:ACCOUNT}),'READ');
  for(const p of [paths.deployments,'/accounts/x/workers/scripts/x/versions','/zones/a/workers/routes'])
    assert.throws(()=>assertGateCRequestAllowed('POST',p,{accountId:ACCOUNT}));
  const source=read('workers/api-football-collector/run-gate-c.mjs');
  assert.doesNotMatch(source,/createDeployment:\s*async|method:'PUT'|method:'DELETE'/);
  assert.match(source,/GATE_C_RERUN_FORBIDDEN/);
  let trigger=0,disableCollection=0,disableWorkersDev=0;
  const result=await runDeployedOneShotContinuation({admissionValid:true,ops:{
    verifyDeployment:async()=>{},enableWorkersDev:async()=>{},proveReadiness:async()=>{},enableCollection:async()=>{},
    triggerOnce:async()=>{trigger++;return {requestCount:1,outcome:'AMBIGUOUS'};},
    disableCollection:async()=>{disableCollection++;},disableWorkersDev:async()=>{disableWorkersDev++;}
  }});
  assert.equal(result.ok,false);assert.equal(trigger,1);assert.equal(disableCollection,1);assert.equal(disableWorkersDev,1);
});

test('Gate C manual workflow is dormant, exact-main, protected, serialised and evidence-gated',()=>{
  const workflow=read('.github/workflows/api-football-gate-c-new-day-collection.yml');
  assert.match(workflow,/workflow_dispatch:/);assert.doesNotMatch(workflow,/\bschedule:\s*\n/);
  assert.match(workflow,/github.run_attempt == 1/);assert.match(workflow,/refs\/heads\/main/);
  assert.match(workflow,/group: api-football-collector-attended-acceptance/);
  assert.match(workflow,/name: data-steward-readonly/);assert.match(workflow,/name: api-football-attended-acceptance/);
  assert.match(workflow,/gate-c-readonly\.mjs/);assert.match(workflow,/run-gate-c\.mjs/);
  assert.match(workflow,/sha256sum/);assert.match(workflow,/if: always\(\)/);
  const old=read('.github/workflows/api-football-deployed-one-shot-continuation.yml');
  assert.match(old,/^# CONSUMED \(run 37511401491/);
  assert.match(read('CLAUDE.md'),/Gate C repository-only/);
  assert.match(read('docs\/API-FOOTBALL-GATE-C-CONTROLLED-COLLECTION.md'),/No live dispatch is approved/);
});
