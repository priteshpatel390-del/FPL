// Transport-remediated Deployment promotion (Gate B, repository only). No live Cloudflare or API-Football action is performed.
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
const NEW_DEPLOYMENT='99999999-8888-4777-8666-555555555555',THIRD_DEPLOYMENT='77777777-6666-4555-8444-333333333333';
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
    inventory:{activation:'ATTENDED_ONE_SHOT_DISCOVERY',databaseIdPlaceholder:false,productionBindingProven:true,configurationExact:true,workerPresent:true,deploymentCount:1,cronCount:0,routeCount:0,customDomainCount:0,
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

// ================= immutable candidate provenance =================
test('candidate provenance is pinned exactly to the consumed Gate A run and live Version',()=>{
  assert.equal(PROMOTION_GATE_A_RUN_ID,'37680114065');
  assert.equal(PROMOTION_CANDIDATE_VERSION_ID,'4171f3cf-953e-452e-9e5f-068df9a3ca47');
  assert.equal(PROMOTION_CANDIDATE_CREATION_SHA,'f01ccff5b13a4bbc98d7927cf620f69f46c4c54c');
  assert.equal(PROMOTION_CANDIDATE_GRAPH_SHA256,'03db54c4faf0bfc08f52382e56fc165cadccb7337786581053328e07f2f8f6cc');
  assert.equal(PROMOTION_CANDIDATE_METADATA_SHA256,'67097c838c1e0f9a5f2c765ea17dff3eb690bb4e646688c35cab4c66055b1119');
  assert.equal(PROMOTION_CANDIDATE_MODULE_COUNT,17);
  assert.equal(PROMOTION_RETAINED_DEPLOYMENT_ID,'2417a3e0-15db-4e45-a3c8-00b148a300f4');
  assert.equal(PROMOTION_RETAINED_VERSION_ID,'04d79556-3070-429f-9944-b5b53d799842');
  assert.deepEqual([...PROMOTION_EXPECTED_VERSION_IDS],[...TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS,CANDIDATE]);
  assert.equal(new Set(PROMOTION_EXPECTED_VERSION_IDS).size,4);
});

test('candidate identity rebuilds from the immutable creation SHA and reproduces the live Gate A hashes over the unchanged 17 modules',()=>{
  const identity=buildPromotionCandidateIdentity();
  assert.equal(identity.approvedSha,PROMOTION_CANDIDATE_CREATION_SHA);
  assert.equal(identity.graphSha256,PROMOTION_CANDIDATE_GRAPH_SHA256);assert.equal(identity.metadataSha256,PROMOTION_CANDIDATE_METADATA_SHA256);
  assert.equal(Object.keys(identity.moduleSha256).length,17);assert.deepEqual({...identity.moduleSha256},{...TRANSPORT_REMEDIATED_VERSION_MODULE_SHA256});
  assert.equal(identity.message,'API-Football transport-remediated attended Version from '+PROMOTION_CANDIDATE_CREATION_SHA);
  assert.equal(identity.tag,'api-football-transport-remediated-f01ccff5b13a');
  // The 17 reviewed current-tree module bytes are unchanged from the Gate A pin.
  for(const [name,source] of candidateModules())assert.equal(sha256(source),TRANSPORT_REMEDIATED_VERSION_MODULE_SHA256[name],name);
});

test('rebuilding the candidate from the later execution SHA is rejected; a differing execution SHA is valid and expected',()=>{
  assert.notEqual(EXEC_SHA,PROMOTION_CANDIDATE_CREATION_SHA);
  for(const bad of [EXEC_SHA,'d'.repeat(40),'',null,123])assert.throws(()=>buildPromotionCandidateIdentity(bad),/transport_remediated_promotion_candidate_provenance_invalid/);
  // An identity built from the execution SHA would differ (graph hash + annotations) and must never validate the candidate.
  const fromExecution=buildTransportRemediatedVersionIdentity(EXEC_SHA);
  assert.notEqual(fromExecution.graphSha256,PROMOTION_CANDIDATE_GRAPH_SHA256);assert.notEqual(fromExecution.metadataSha256,PROMOTION_CANDIDATE_METADATA_SHA256);
  const wrong=clone(VERSIONS);wrong.candidate=detail(CANDIDATE,fromExecution,candidateModules());
  assert.equal(promotionVersionInventoryDiagnostic(wrong),'candidate_annotation_drift');
  // Exact Gate A state with a later execution SHA is admitted.
  assert.equal(admission().ok,true);
});

test('any reviewed-module drift makes the immutable candidate identity unavailable',()=>{
  const f='src/decision-intelligence/rights.mjs';
  assert.throws(()=>buildPromotionCandidateIdentity(PROMOTION_CANDIDATE_CREATION_SHA,{readFile:p=>p===f?readCurrentTreeModuleSource(p)+' ':readCurrentTreeModuleSource(p)}),/candidate_identity_drift/);
});

// ================= admission =================
test('admission accepts exactly the Gate A prepared-but-not-deployed state',()=>{
  const a=admission();
  assert.equal(a.ok,true);assert.equal(a.classification,PROMOTION_READY);assert.equal(a.reason,null);assert.equal(a.retryAuthorized,false);
  assert.deepEqual(a.versionIds,[...PROMOTION_EXPECTED_VERSION_IDS].sort());assert.equal(a.versionInventoryExact,true);
  assert.equal(a.candidate.versionId,CANDIDATE);assert.equal(a.candidate.creationSha,PROMOTION_CANDIDATE_CREATION_SHA);
  assert.deepEqual(a.evidence,{productionMutations:0,apiFootballRequests:0,secretValuesRead:0});
  assert.equal(validatePromotionAdmissionHandoff(JSON.parse(JSON.stringify(a)),{approvedSha:EXEC_SHA,accountFingerprint:FINGERPRINT}),true);
  assert.doesNotMatch(JSON.stringify(a),/content_base64/);
});

test('admission rejects every Version-inventory deviation',()=>{
  const reject=(label,mutate,expected)=>{const v=clone(VERSIONS);mutate(v);const a=admission({versions:v});assert.equal(a.ok,false,label);assert.equal(a.classification,PROMOTION_ADMISSION_STOP,label);if(expected)assert.equal(a.reason,expected,label);};
  reject('candidate missing',v=>{v.versionIds=v.versionIds.filter(id=>id!==CANDIDATE);},'version_missing');
  reject('fifth Version',v=>{v.versionIds.push('12345678-1234-4234-8234-123456789012');},'unexpected_extra_version');
  reject('wrong candidate ID',v=>{v.versionIds=v.versionIds.map(id=>id===CANDIDATE?'12345678-1234-4234-8234-123456789012':id);},'version_inventory_mismatch');
  reject('historical Version missing',v=>{v.versionIds=v.versionIds.map(id=>id===ORIGINAL_BLOCKED_VERSION_ID?'12345678-1234-4234-8234-123456789012':id);},'version_inventory_mismatch');
  reject('duplicate ids',v=>{v.versionIds=[CANDIDATE,CANDIDATE,ATTENDED_VERSION_ID,ORIGINAL_BLOCKED_VERSION_ID];},'version_inventory_unreadable');
  reject('inventory unreadable',v=>{v.versionIds=null;},'version_inventory_unreadable');
  reject('candidate stable id mismatch',v=>{v.candidate.stable.id=ATTENDED_VERSION_ID;},'candidate_version_identity_drift');
  reject('candidate beta id mismatch',v=>{v.candidate.beta.id=ATTENDED_VERSION_ID;},'candidate_version_identity_drift');
  reject('candidate detail unreadable',v=>{v.candidate.beta=null;},'candidate_version_identity_drift');
  reject('candidate module drift',v=>{v.candidate.beta.modules[0].content_base64=b64('drift');},'candidate_module_content_drift');
  reject('candidate module missing',v=>{v.candidate.beta.modules.pop();},'candidate_module_set_drift');
  reject('candidate metadata drift (annotation)',v=>{v.candidate.beta.annotations['workers/tag']='other';},'candidate_annotation_drift');
  reject('candidate compatibility drift',v=>{v.candidate.stable.resources.script_runtime.compatibility_date='2026-01-01';},'candidate_runtime_drift');
  reject('candidate routable',v=>{v.candidate.beta.urls=['https://x'];},'candidate_version_routable');
  reject('candidate secret binding renamed',v=>{v.candidate.stable.resources.bindings.find(b=>b.type==='secret_text').name='OTHER';},'candidate_binding_drift');
  reject('candidate secret binding type changed',v=>{const b=v.candidate.stable.resources.bindings.find(x=>x.type==='secret_text');b.type='plain_text';b.text='leak';},'candidate_binding_drift');
  reject('candidate binding leaks a value',v=>{v.candidate.stable.resources.bindings.find(b=>b.type==='secret_text').text='leak';},'candidate_binding_drift');
  reject('old attended module drift',v=>{v.attended.beta.modules[0].content_base64=b64('drift');},'historical_version_drift');
  reject('Gate C clone annotation drift',v=>{v.clone.beta.annotations['workers/message']='x';},'historical_version_drift');
  reject('original binding drift',v=>{v.originalStable.resources.bindings.find(b=>b.name==='EIA_2I5D_ACTIVATION').text='ATTENDED_ONE_SHOT_DISCOVERY';},'historical_version_drift');
});

test('admission rejects every Deployment deviation, using API order (first row active) rather than created_on',()=>{
  const reject=(label,list,expected)=>{const r=report({inventory:{deploymentCount:Array.isArray(list)?list.length:1}});
    const a=admission({report:r,deploymentRows:Array.isArray(list)?rows(list):list});assert.equal(a.ok,false,label);if(expected)assert.equal(a.reason,expected,label);};
  reject('zero Deployments',[],'deployment_missing');
  reject('two Deployments before promotion',[promotedRow,retainedRow],'deployment_count_unexpected');
  reject('wrong historical Deployment id',[{...retainedRow,id:THIRD_DEPLOYMENT}],'deployment_identity_unexpected');
  reject('historical Deployment already points to candidate',[{...retainedRow,versions:[{version_id:CANDIDATE,percentage:100}]}],'deployment_identity_unexpected');
  reject('percentage not 100',[{...retainedRow,versions:[{version_id:ATTENDED_VERSION_ID,percentage:90}]}],'deployment_identity_unexpected');
  reject('split deployment',[{...retainedRow,versions:[{version_id:ATTENDED_VERSION_ID,percentage:50},{version_id:CANDIDATE,percentage:50}]}],'deployment_identity_unexpected');
  reject('wrong strategy',[{...retainedRow,strategy:'other'}],'deployment_identity_unexpected');
  reject('unreadable',null,'deployment_state_unreadable');
  const inconsistent=admission({report:report({inventory:{deploymentCount:2}})});assert.equal(inconsistent.reason,'deployment_state_inconsistent');
  // Ordering: a newer created_on on a second row never makes it "active" — two rows are refused outright.
  assert.equal(promotionPreStateExact(rows([retainedRow,{...promotedRow,created_on:'2099-01-01T00:00:00Z'}])),false);
  assert.equal(promotionDeploymentRows({deployments:[retainedRow,retainedRow]}),null,'duplicate ids are unreadable');
  assert.equal(promotionDeploymentRows({deployments:[{id:RETAINED}]}),null,'versions array required');
});

test('admission rejects every topology, runtime, consumed-history and isolation deviation',()=>{
  const reject=(label,overrides,expected)=>{const a=admission({report:report(overrides)});assert.equal(a.ok,false,label);if(expected)assert.equal(a.reason,expected,label);};
  reject('workers.dev on',{inventory:{workersDev:true}},'collector_topology_mismatch');
  reject('Preview on',{inventory:{previewUrls:true}},'collector_topology_mismatch');
  reject('Cron present',{inventory:{cronCount:1}},'collector_topology_mismatch');
  reject('domain present',{inventory:{customDomainCount:1}},'collector_topology_mismatch');
  reject('legacy route present',{inventory:{routeCount:1}},'collector_topology_mismatch');
  reject('collection enabled',{runtime:{collectionEnabled:1}},'collection_not_disabled');
  reject('credential unavailable',{runtime:{credentialState:'INVALID'}},'credential_not_available');
  reject('lease active',{runtime:{activeLease:true}},'active_lease');
  reject('attempt 2',{priorState:{attempt2Count:1,requestAttempts:2}},'retry_attempt_detected');
  reject('two attempts',{priorState:{requestAttempts:2,attempt1Count:2}},'history_not_the_exact_consumed_shape');
  reject('success history',{priorState:{succeededAttemptCount:1}},'history_has_collection_success');
  reject('extra generation',{priorState:{generations:2,failedGenerationCount:2}},'history_not_the_exact_consumed_shape');
  reject('committed generation',{priorState:{committedGenerationCount:1}},'history_has_collection_success');
  reject('fixture revisions',{priorState:{fixtureRevisions:3}},'history_has_collection_success');
  reject('RESERVED',{priorState:{reservedAttemptCount:1}},'history_unresolved_reservation_or_staging');
  reject('STAGING',{priorState:{stagingGenerationCount:1}},'history_unresolved_reservation_or_staging');
  reject('persistence uncertain',{priorState:{persistenceUncertainCount:1}},'history_not_the_exact_consumed_shape');
  reject('completion uncertain',{priorState:{completionUncertainCount:1}},'history_not_the_exact_consumed_shape');
  reject('pristine history (not the consumed shape)',{priorState:{requestAttempts:0,attempt1Count:0,transportUnknownCount:0,generations:0,failedGenerationCount:0}},'history_not_the_exact_consumed_shape');
  reject('mapping drift',{mapping:{mappingCount:19}},'mapping_drift');
  reject('mapping state',{mapping:{state:'STAGED'}},'mapping_drift');
  reject('distinct ids',{mapping:{distinctFplIds:19}},'mapping_drift');
  reject('Official FPL invalid',{officialFplAuthority:{valid:false}},'official_fpl_authority_invalid');
  reject('Official FPL team count',{officialFplAuthority:{teamCount:19}},'official_fpl_authority_invalid');
  reject('model/UI path',{modelUiImportCount:1},'model_isolation_mismatch');
  reject('raw storage',{rawPayloadStoragePresent:true},'model_isolation_mismatch');
  reject('secret binding names',{inventory:{secretBindingNames:['API_FOOTBALL_API_KEY']}},'secret_binding_mismatch');
  reject('preflight verdict not the stale STOP',{ok:true,classification:'VERSION_URL_CREATION_EXPERIMENT_RECONCILED',reason:null},'preflight_not_expected_post_deployment_state');
  reject('preflight different reason',{reason:'other'},'preflight_not_expected_post_deployment_state');
  reject('preflight approved SHA mismatch',{approvedSha:'d'.repeat(40)},'preflight_identity_mismatch');
  for(const [label,topology,failure] of [['zone route present',{...ZONE,routeCount:1}],['zone route unproven',null],['zone scan failed',ZONE,'zone_route_topology_unreadable']]){
    const a=admission({topology,topologyFailure:failure??null});assert.equal(a.ok,false,label);
  }
  assert.equal(admission({approvedSha:'x'}).reason,'admission_identity_invalid');
  assert.equal(admission({accountFingerprint:'x'}).reason,'admission_identity_invalid');
});

test('admission handoff refuses tampering',()=>{
  const good=JSON.parse(JSON.stringify(admission()));
  const ok=value=>validatePromotionAdmissionHandoff(value,{approvedSha:EXEC_SHA,accountFingerprint:FINGERPRINT});
  assert.equal(ok(good),true);
  for(const mutate of [a=>{a.ok=false;},a=>{a.classification='X';},a=>{a.approvedSha='d'.repeat(40);},a=>{a.candidate.versionId=ATTENDED_VERSION_ID;},
    a=>{a.candidate.creationSha=EXEC_SHA;},a=>{a.versionIds.pop();},a=>{a.deployments.push({...a.deployments[0],id:THIRD_DEPLOYMENT});},
    a=>{a.deployments[0].versions[0].versionId=CANDIDATE;},a=>{a.topology.routeCount=1;},a=>{a.retryAuthorized=true;},a=>{a.preflight.priorState.attempt2Count=1;},
    a=>{a.preflight.runtime.collectionEnabled=1;},a=>{a.evidence.productionMutations=1;},a=>{a.versionInventoryExact=false;},a=>{a.version='other';}]){
    const bad=structuredClone(good);mutate(bad);assert.throws(()=>ok(bad),/TRANSPORT_REMEDIATED_PROMOTION_ADMISSION_HANDOFF_INVALID/);
  }
  assert.throws(()=>validatePromotionAdmissionHandoff(good,{approvedSha:EXEC_SHA,accountFingerprint:'a'.repeat(64)}),/HANDOFF_INVALID/);
});

// ================= exact promotion body =================
test('promotion body selects only the candidate at exactly 100% with percentage strategy, no force and a sanitized deterministic message',()=>{
  const body=buildPromotionDeploymentBody(EXEC_SHA);
  assert.deepEqual(JSON.parse(JSON.stringify(body)),{strategy:'percentage',versions:[{version_id:CANDIDATE,percentage:100}],
    annotations:{'workers/message':'GateB v='+CANDIDATE+' c='+PROMOTION_CANDIDATE_CREATION_SHA+' x='+EXEC_SHA}});
  assert.equal(body.versions.length,1);assert.equal(body.versions.reduce((sum,row)=>sum+row.percentage,0),100);
  assert.ok(!body.versions.some(row=>row.version_id===PROMOTION_RETAINED_VERSION_ID));
  assert.equal(Object.hasOwn(body,'force'),false);assert.doesNotMatch(serializePromotionDeploymentBody(EXEC_SHA),/force/);
  const message=buildPromotionDeploymentMessage(EXEC_SHA);
  assert.ok(message.length<=PROMOTION_MESSAGE_MAX_LENGTH);assert.ok(message.includes(EXEC_SHA));assert.ok(message.includes(CANDIDATE));assert.ok(message.includes(PROMOTION_CANDIDATE_CREATION_SHA));
  assert.ok(message.includes(PROMOTION_CANDIDATE_CREATION_SHA.slice(0,8)));
  assert.doesNotMatch(message,/token|secret|key|account/i);
  assert.equal(serializePromotionDeploymentBody(EXEC_SHA),serializePromotionDeploymentBody(EXEC_SHA));
  assert.ok(Object.isFrozen(body)&&Object.isFrozen(body.versions)&&Object.isFrozen(body.versions[0]));
  for(const bad of ['x','',null,'A'.repeat(40)])assert.throws(()=>buildPromotionDeploymentBody(bad),/APPROVED_SHA_INVALID/);
});

// ================= guarded fetch =================
test('guarded fetch allows approved Cloudflare GETs plus one exact Deployment POST and refuses everything else before network',async()=>{
  const calls=[];const fetchImpl=async(url,init)=>{calls.push({url:String(url),method:init.method});return new Response('{}',{status:200});};
  const body=serializePromotionDeploymentBody(EXEC_SHA);
  const guard=createPromotionGuardedFetch({accountId:ACCOUNT,readToken:READ,promotionToken:PROMOTE,topologyToken:TOPOLOGY_TOKEN,expectedBody:body,fetchImpl});
  const auth=token=>({Authorization:'Bearer '+token});
  const script=API+'/accounts/'+ACCOUNT+'/workers/scripts/'+DEPLOYED_ONE_SHOT_WORKER;
  const forbidden=[
    [script+'/deployments','POST',auth(PROMOTE),'{"strategy":"percentage","versions":[{"version_id":"'+ATTENDED_VERSION_ID+'","percentage":100}]}'],
    [script+'/versions','POST',auth(PROMOTE),'{}'],
    [API+'/accounts/'+ACCOUNT+'/d1/database/x/query','POST',auth(PROMOTE),'{}'],
    [API+'/accounts/'+ACCOUNT+'/d1/database/x/query','GET',auth(READ)],
    [script+'/subdomain','POST',auth(PROMOTE),'{"enabled":true}'],
    [script+'/schedules','PUT',auth(PROMOTE),'[]'],
    [API+'/zones/'+'a'.repeat(32)+'/workers/routes','POST',auth(PROMOTE),'{}'],
    [API+'/accounts/'+ACCOUNT+'/workers/domains','PUT',auth(PROMOTE),'{}'],
    [script,'PUT',auth(PROMOTE),'{}'],
    [API+'/accounts/'+ACCOUNT+'/workers/workers','POST',auth(PROMOTE),'{}'],
    [script+'/deployments/'+RETAINED,'DELETE',auth(PROMOTE)],
    [script,'DELETE',auth(PROMOTE)],
    [script+'/deployments','PATCH',auth(PROMOTE),body],
    [script+'/settings','PATCH',auth(PROMOTE),'{}'],
    ['https://'+DEPLOYED_ONE_SHOT_WORKER+'.'+SUBDOMAIN+'.workers.dev/','GET',{}],
    ['https://v3.football.api-sports.io/fixtures','GET',{'x-apisports-key':'k'}],
    ['https://example.com/','GET',{}],
    ['http://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/workers/scripts','GET',auth(READ)],
    [API+'/accounts/'+ACCOUNT+'/workers/scripts/other-worker/deployments','POST',auth(PROMOTE),body],
    [API+'/accounts/'+ACCOUNT+'/workers/scripts/'+DEPLOYED_ONE_SHOT_WORKER+'/content','GET',auth(READ)],
    [API+'/accounts/'+ACCOUNT+'/workers/scripts/'+DEPLOYED_ONE_SHOT_WORKER+'/secrets','GET',auth(READ)],
    [script+'/deployments','POST',auth(READ),body],
    [script+'/deployments','GET',auth(PROMOTE)],
    [script+'/deployments','GET',auth(TOPOLOGY_TOKEN)],
    [API+'/zones/'+'a'.repeat(32)+'/workers/routes','GET',auth(READ)],
    ['not a url','GET',{}]
  ];
  for(const [url,method,headers,requestBody] of forbidden)await assert.rejects(()=>guard.fetch(url,{method,headers,body:requestBody}),/TRANSPORT_REMEDIATED_PROMOTION_/,method+' '+url);
  assert.deepEqual(calls,[]);assert.equal(guard.counters.deploymentPostAttempts,0);assert.ok(guard.counters.blockedEgress>=forbidden.length);
  for(const url of [script+'/deployments',script+'/subdomain',script+'/schedules',API+'/accounts/'+ACCOUNT+'/workers/domains',script+'/versions?deployable=true',
    script+'/versions/'+CANDIDATE,API+'/accounts/'+ACCOUNT+'/workers/workers/'+DEPLOYED_ONE_SHOT_WORKER_ID+'/versions/'+CANDIDATE+'?include=modules'])
    await guard.fetch(url,{method:'GET',headers:auth(READ)});
  await guard.fetch(API+'/zones?account.id='+ACCOUNT+'&page=1&per_page=50&type=full%2Cpartial%2Csecondary%2Cinternal',{headers:auth(TOPOLOGY_TOKEN)});
  await guard.fetch(API+'/zones/'+'a'.repeat(32)+'/workers/routes',{headers:auth(TOPOLOGY_TOKEN)});
  await guard.fetch(script+'/deployments',{method:'POST',headers:auth(PROMOTE),body});
  await assert.rejects(()=>guard.fetch(script+'/deployments',{method:'POST',headers:auth(PROMOTE),body}),/POST_CEILING_EXCEEDED/);
  assert.equal(guard.counters.deploymentPostAttempts,1);assert.equal(calls.filter(c=>c.method==='POST').length,1);
  assert.equal(assertPromotionMutationAllowed('POST',paths.deployments,{accountId:ACCOUNT}),true);
  for(const [method,p] of [['POST',script.replace(API,'')+'/versions'],['DELETE',paths.deployments],['PUT',paths.deployments],['POST',paths.subdomain]])
    assert.throws(()=>assertPromotionMutationAllowed(method,p,{accountId:ACCOUNT}),/ENDPOINT_FORBIDDEN/);
  assert.deepEqual({...PROMOTION_MUTATION_CEILINGS},{deploymentPost:1,versionUpload:0,workersDev:0,preview:0,d1:0,schedules:0,routes:0,domains:0,workerShell:0,delete:0,put:0,patch:0,apiFootball:0,workerInvocation:0});
});

// ================= executor =================
function fakeCloudflare({post='created',after='applied',deployments=[retainedRow],versions=clone(VERSIONS),subdomain={enabled:false,previews_enabled:false},schedules=[],domains=[],readbackRows=null}={}){
  const calls=[];let current=[...deployments],posted=false;
  const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
  const versionDetail={[ORIGINAL_BLOCKED_VERSION_ID]:{stable:versions.originalStable},[ATTENDED_VERSION_ID]:versions.attended,[DEPLOYED_ONE_SHOT_CLONE_VERSION_ID]:versions.clone,[CANDIDATE]:versions.candidate};
  const fetchImpl=async(url,init={})=>{
    const parsed=new URL(String(url)),method=String(init.method||'GET').toUpperCase(),requestPath=parsed.pathname.slice('/client/v4'.length)+parsed.search;
    calls.push({method,requestPath,authorization:init.headers?.Authorization,body:init.body});
    if(method==='GET'&&requestPath===paths.deployments){
      if(posted&&readbackRows)return typeof readbackRows==='function'?readbackRows():json({success:true,result:{deployments:readbackRows}});
      return json({success:true,result:{deployments:current}});
    }
    if(method==='GET'&&requestPath===readPaths.versions)return json({success:true,result:{items:versions.versionIds.map(id=>({id}))}});
    if(method==='GET'&&requestPath===paths.subdomain)return json({success:true,result:subdomain});
    if(method==='GET'&&requestPath===paths.schedules)return json({success:true,result:{schedules}});
    if(method==='GET'&&requestPath===paths.domains)return json({success:true,result:domains});
    for(const [id,value] of Object.entries(versionDetail)){
      if(method==='GET'&&requestPath===readPaths.stableVersion(id))return json({success:true,result:value.stable});
      if(method==='GET'&&requestPath===readPaths.betaVersion(id))return json({success:true,result:value.beta});
    }
    if(method==='POST'&&requestPath===paths.deployments){
      posted=true;
      if(post==='rejected')return json({success:false,errors:[{code:10000,message:'denied'}]},403);
      if(after==='applied')current=[promotedRow,...current];
      if(post==='transport')throw new TypeError('socket hang up');
      if(post==='created')return json({success:true,result:promotedRow});
      if(post==='server-error')return json({success:false,errors:[]},500);
      if(post==='malformed')return new Response('<html>gateway</html>',{status:200});
      if(post==='wrong-version')return json({success:true,result:{...promotedRow,versions:[{version_id:ATTENDED_VERSION_ID,percentage:100}]}});
    }
    throw new Error('unexpected request '+method+' '+requestPath);
  };
  return {fetchImpl,calls,posts:()=>calls.filter(c=>c.method==='POST')};
}
function executorEnv(admissionFile,overrides={}){
  return {CLOUDFLARE_ACCOUNT_ID:ACCOUNT,CLOUDFLARE_ACCOUNT_FINGERPRINT:FINGERPRINT,CLOUDFLARE_ATTENDED_READ_TOKEN:READ,CLOUDFLARE_REMEDIATED_DEPLOYMENT_PROMOTION_TOKEN:PROMOTE,
    CLOUDFLARE_TOPOLOGY_READ_TOKEN:TOPOLOGY_TOKEN,APPROVED_SHA:EXEC_SHA,API_FOOTBALL_DEPLOYMENT_PROMOTION_ADMISSION_PATH:admissionFile,...overrides};
}
const runExecutor=async({fake=fakeCloudflare(),env,routeScan=async()=>ZONE,admissionValue=admission()}={})=>{
  const file=tempFile(JSON.parse(JSON.stringify(admissionValue)));
  const evidence=await executeTransportRemediatedDeploymentPromotion({env:env??executorEnv(file),fetchImpl:fake.fetchImpl,routeScan,wait:async()=>{}});
  return {evidence,fake,file};
};

test('executor submits exactly one exact Deployment POST, no other mutation, and returns sanitized evidence',async()=>{
  const {evidence,fake}=await runExecutor();
  assert.equal(evidence.outcome,'CREATED');assert.equal(evidence.deploymentId,NEW_DEPLOYMENT);assert.equal(evidence.ok,true);
  assert.equal(fake.posts().length,1);assert.equal(fake.posts()[0].requestPath,paths.deployments);assert.equal(fake.posts()[0].authorization,'Bearer '+PROMOTE);
  assert.equal(fake.posts()[0].body,serializePromotionDeploymentBody(EXEC_SHA));
  assert.ok(fake.calls.filter(c=>c.method==='GET').every(c=>c.authorization==='Bearer '+READ));
  assert.deepEqual([...Object.keys(evidence)].sort(),[...PROMOTION_EXECUTION_KEYS].sort());
  assert.deepEqual({p:evidence.deploymentPostAttempts,d:evidence.deploymentMutations,m:evidence.productionMutations,v:evidence.versionUploads,d1:evidence.d1Mutations,w:evidence.workersDevMutations,
    pv:evidence.previewMutations,s:evidence.scheduleMutations,r:evidence.routeMutations,dm:evidence.domainMutations,i:evidence.workerInvocations,a:evidence.apiFootballRequests,
    ss:evidence.secretValuesSerialized,retry:evidence.retryAuthorized},{p:1,d:1,m:1,v:0,d1:0,w:0,pv:0,s:0,r:0,dm:0,i:0,a:0,ss:0,retry:false});
  assert.equal(evidence.candidateVersionId,CANDIDATE);assert.equal(evidence.candidateCreationSha,PROMOTION_CANDIDATE_CREATION_SHA);assert.equal(evidence.approvedSha,EXEC_SHA);
  assert.deepEqual(evidence.finalRouteScan,ZONE);
  const text=JSON.stringify(evidence);for(const secret of [READ,PROMOTE,TOPOLOGY_TOKEN,ACCOUNT])assert.ok(!text.includes(secret));
  assert.equal(validatePromotionExecutionEvidence(evidence,{approvedSha:EXEC_SHA}),true);
  for(const call of fake.calls){assert.ok(['GET','POST'].includes(call.method));assert.doesNotMatch(call.requestPath,/d1\/database|\/versions$|subdomain.*POST/);}
});

test('executor POST outcomes: rejection, ambiguity readback and owner attention never resend',async()=>{
  const outcome=async(label,options,expected,extra=()=>{})=>{const r=await runExecutor({fake:fakeCloudflare(options)});
    assert.equal(r.evidence.outcome,expected,label);assert.equal(r.fake.posts().length,1,label);assert.equal(r.evidence.retryAuthorized,false,label);
    assert.equal(validatePromotionExecutionEvidence(r.evidence,{approvedSha:EXEC_SHA}),true,label);extra(r);return r;};
  await outcome('explicit rejection',{post:'rejected',after:'none'},'REJECTED',r=>{assert.equal(r.evidence.readbackAttempts,0);assert.equal(r.evidence.deploymentId,null);});
  await outcome('transport failure + readback proves applied',{post:'transport'},'APPLIED_CONFIRMED_BY_READBACK',r=>assert.equal(r.evidence.deploymentId,NEW_DEPLOYMENT));
  await outcome('5xx + readback proves applied',{post:'server-error'},'APPLIED_CONFIRMED_BY_READBACK');
  await outcome('malformed JSON + readback proves applied',{post:'malformed'},'APPLIED_CONFIRMED_BY_READBACK');
  await outcome('ambiguous + old-only readback',{post:'server-error',after:'none'},'AMBIGUOUS_OWNER_ATTENTION',r=>{assert.equal(r.evidence.readbackAttempts,3);assert.equal(r.evidence.deploymentId,null);assert.equal(r.evidence.ok,false);});
  await outcome('transport + old-only readback',{post:'transport',after:'none'},'AMBIGUOUS_OWNER_ATTENTION');
  await outcome('readback unreadable',{post:'transport',readbackRows:()=>new Response('x',{status:500})},'AMBIGUOUS_OWNER_ATTENTION');
  await outcome('three Deployments',{post:'transport',readbackRows:[{...promotedRow,id:THIRD_DEPLOYMENT},promotedRow,retainedRow]},'AMBIGUOUS_OWNER_ATTENTION',r=>assert.equal(r.evidence.readbackAttempts,1));
  await outcome('wrong new Version',{post:'transport',readbackRows:[{...promotedRow,versions:[{version_id:ATTENDED_VERSION_ID,percentage:100}]},retainedRow]},'AMBIGUOUS_OWNER_ATTENTION');
  await outcome('old Deployment missing',{post:'transport',readbackRows:[promotedRow]},'AMBIGUOUS_OWNER_ATTENTION');
  await outcome('historical Deployment changed',{post:'transport',readbackRows:[promotedRow,{...retainedRow,versions:[{version_id:CANDIDATE,percentage:100}]}]},'AMBIGUOUS_OWNER_ATTENTION');
  await outcome('historical Deployment created_on changed',{post:'transport',readbackRows:[promotedRow,{...retainedRow,created_on:'2026-10-08T00:00:00Z'}]},'AMBIGUOUS_OWNER_ATTENTION');
  await outcome('split traffic',{post:'transport',readbackRows:[{...promotedRow,versions:[{version_id:CANDIDATE,percentage:50},{version_id:ATTENDED_VERSION_ID,percentage:50}]},retainedRow]},'AMBIGUOUS_OWNER_ATTENTION');
  await outcome('accepted response with wrong Version, readback disagrees',{post:'wrong-version'},'AMBIGUOUS_OWNER_ATTENTION');
});

test('pure submission never resends and never converts bounded absence into NOT_APPLIED',async()=>{
  assert.equal(PROMOTION_OUTCOMES.includes('NOT_APPLIED'),false);
  let posts=0;const post=async()=>{posts+=1;return {kind:'AMBIGUOUS'};};
  const old=async()=>rows([retainedRow]);
  const r=await submitPromotionDeployment({post,readDeployments:old});
  assert.equal(r.outcome,'AMBIGUOUS_OWNER_ATTENTION');assert.equal(posts,1);
  const thrown=await submitPromotionDeployment({post:async()=>{posts+=1;throw new Error('x');},readDeployments:async()=>rows([promotedRow,retainedRow])});
  assert.equal(thrown.outcome,'APPLIED_CONFIRMED_BY_READBACK');assert.equal(posts,2);
  const created=await submitPromotionDeployment({post:async()=>({kind:'OK',result:promotedRow}),readDeployments:async()=>{throw new Error('must not read');}});
  assert.equal(created.outcome,'CREATED');assert.equal(created.readbackAttempts,0);
  const reusedOld=await submitPromotionDeployment({post:async()=>({kind:'OK',result:{...retainedRow,versions:[{version_id:CANDIDATE,percentage:100}]}}),readDeployments:old});
  assert.equal(reusedOld.outcome,'AMBIGUOUS_OWNER_ATTENTION','response reusing the historical Deployment id is never CREATED');
  const idMismatch=await submitPromotionDeployment({post:async()=>({kind:'OK',result:{id:THIRD_DEPLOYMENT}}),readDeployments:async()=>rows([promotedRow,retainedRow])});
  assert.equal(idMismatch.outcome,'AMBIGUOUS_OWNER_ATTENTION');
  await assert.rejects(()=>submitPromotionDeployment({post}),/OPERATIONS_INVALID/);
});

test('executor sends zero network on credential/admission failure and zero POST on fresh Cloudflare drift',async()=>{
  const file=tempFile(JSON.parse(JSON.stringify(admission())));
  const base=executorEnv(file);
  const stops=async(label,options)=>{const {evidence,fake}=await runExecutor(options);assert.equal(evidence.outcome,'NOT_SUBMITTED',label);
    assert.equal(evidence.deploymentPostAttempts,0,label);assert.equal(fake.posts().length,0,label);assert.equal(evidence.ok,false,label);
    assert.equal(evidence.retryAuthorized,false,label);assert.equal(evidence.deploymentMutations,0,label);return {evidence,fake};};
  for(const name of ['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_ACCOUNT_FINGERPRINT','CLOUDFLARE_ATTENDED_READ_TOKEN','CLOUDFLARE_REMEDIATED_DEPLOYMENT_PROMOTION_TOKEN','CLOUDFLARE_TOPOLOGY_READ_TOKEN','APPROVED_SHA','API_FOOTBALL_DEPLOYMENT_PROMOTION_ADMISSION_PATH']){
    const env={...base};delete env[name];const {fake}=await stops('missing '+name,{env});assert.equal(fake.calls.length,0,name);
  }
  assert.equal((await stops('equal read/promotion',{env:{...base,CLOUDFLARE_REMEDIATED_DEPLOYMENT_PROMOTION_TOKEN:READ}})).fake.calls.length,0);
  assert.equal((await stops('equal topology/read',{env:{...base,CLOUDFLARE_TOPOLOGY_READ_TOKEN:READ}})).fake.calls.length,0);
  assert.equal((await stops('equal topology/promotion',{env:{...base,CLOUDFLARE_TOPOLOGY_READ_TOKEN:PROMOTE}})).fake.calls.length,0);
  for(const name of PROMOTION_FORBIDDEN_ENV){
    const r=await stops('provider/upload secret present: '+name,{env:{...base,[name]:'present'}});
    assert.equal(r.fake.calls.length,0);assert.equal(r.evidence.diagnostic,'TRANSPORT_REMEDIATED_PROMOTION_FORBIDDEN_SECRET_PRESENT');
  }
  assert.equal((await stops('fingerprint mismatch',{env:{...base,CLOUDFLARE_ACCOUNT_FINGERPRINT:'a'.repeat(64)}})).fake.calls.length,0);
  assert.equal((await stops('rerun attempt 2',{env:{...base,GITHUB_RUN_ATTEMPT:'2'}})).evidence.diagnostic,'TRANSPORT_REMEDIATED_PROMOTION_RERUN_FORBIDDEN');
  assert.equal((await stops('main SHA drift vs admission',{env:{...base,APPROVED_SHA:'d'.repeat(40)}})).fake.calls.length,0);
  const tampered=JSON.parse(JSON.stringify(admission()));tampered.preflight.priorState.attempt2Count=1;
  assert.equal((await stops('tampered consumed history',{admissionValue:tampered})).fake.calls.length,0);

  await stops('workers.dev appears',{fake:fakeCloudflare({subdomain:{enabled:true,previews_enabled:false}})});
  await stops('Preview appears',{fake:fakeCloudflare({subdomain:{enabled:false,previews_enabled:true}})});
  await stops('Cron appears',{fake:fakeCloudflare({schedules:[{cron:'0 * * * *'}]})});
  await stops('domain appears',{fake:fakeCloudflare({domains:[{service:DEPLOYED_ONE_SHOT_WORKER}]})});
  await stops('route appears',{routeScan:async()=>({...ZONE,routeCount:1})});
  await stops('route scan fails',{routeScan:async()=>{throw new Error('boom');}});
  await stops('route scan malformed',{routeScan:async()=>({proof:'x'})});
  await stops('active Deployment drift',{fake:fakeCloudflare({deployments:[{...retainedRow,id:THIRD_DEPLOYMENT}]})});
  await stops('already promoted',{fake:fakeCloudflare({deployments:[promotedRow,retainedRow]})});
  await stops('historical created_on drift',{fake:fakeCloudflare({deployments:[{...retainedRow,created_on:'2026-10-08T00:00:00Z'}]})});
  const v1=clone(VERSIONS);v1.versionIds.push('12345678-1234-4234-8234-123456789012');await stops('fifth Version',{fake:fakeCloudflare({versions:v1})});
  const v2=clone(VERSIONS);v2.versionIds=v2.versionIds.filter(id=>id!==CANDIDATE);await stops('candidate missing',{fake:fakeCloudflare({versions:v2})});
  const v3=clone(VERSIONS);v3.candidate.beta.modules[0].content_base64=b64('drift');await stops('candidate identity drift',{fake:fakeCloudflare({versions:v3})});
  const v4=clone(VERSIONS);v4.attended.beta.annotations['workers/tag']='x';await stops('historical Version drift',{fake:fakeCloudflare({versions:v4})});
});

test('executor source has no D1, provider, Worker-invocation, Version-upload or rollback path',()=>{
  const source=uncommented(read('workers/api-football-collector/run-transport-remediated-deployment-promotion.mjs'));
  assert.doesNotMatch(source,/x-apisports-key|v3\.football\.api-sports\.io|x-teamsheet-attended-trigger|buildTransportRemediatedVersionUploadForm|collection_enabled\s*=|method:\s*'(?:PUT|DELETE|PATCH)'/i);
  assert.doesNotMatch(source,/runApiFootballActivationLivePreflight|EXPECTED_D1_DATABASE_ID|assertActivationReadOnlySql|force\s*:/);
  assert.match(source,/redirect:'manual'/);assert.doesNotMatch(source,/redirect:'error'/);
  const pure=uncommented(read('workers/api-football-collector/transport-remediated-deployment-promotion.mjs'));
  assert.doesNotMatch(pure,/fetch\(|force\s*:|rollback\s*\(/i);
  // Rollback is unrepresentable: the only body ever built selects the candidate.
  assert.equal([...pure.matchAll(/version_id:/g)].length,1);
});

// ================= reconciliation =================
const executionCreated=()=>buildPromotionExecutionEvidence({approvedSha:EXEC_SHA,outcome:'CREATED',deploymentId:NEW_DEPLOYMENT,deploymentPostAttempts:1,finalRouteScan:ZONE});
function reconcileInputs(overrides={}){
  return {report:report({inventory:{deploymentCount:2}}),deploymentRows:rows([promotedRow,retainedRow]),versions:clone(VERSIONS),topology:ZONE,
    execution:executionCreated(),approvedSha:EXEC_SHA,accountFingerprint:FINGERPRINT,...overrides};
}
test('reconciliation succeeds only for the exact promoted-but-inert state',()=>{
  const result=classifyPromotionReconciliation(reconcileInputs());
  assert.equal(result.ok,true);assert.equal(result.classification,PROMOTION_PROMOTED_INERT);assert.equal(result.activeDeploymentId,NEW_DEPLOYMENT);assert.equal(result.retryAuthorized,false);
  const confirmed=buildPromotionExecutionEvidence({approvedSha:EXEC_SHA,outcome:'APPLIED_CONFIRMED_BY_READBACK',deploymentId:NEW_DEPLOYMENT,deploymentPostAttempts:1});
  assert.equal(classifyPromotionReconciliation(reconcileInputs({execution:confirmed})).ok,true);
  const ambiguous=buildPromotionExecutionEvidence({approvedSha:EXEC_SHA,outcome:'AMBIGUOUS_OWNER_ATTENTION',deploymentPostAttempts:1});
  assert.equal(classifyPromotionReconciliation(reconcileInputs({execution:ambiguous})).ok,true,'state proves the single POST applied exactly');
});

test('reconciliation fails closed for every partial or unsafe alternative',()=>{
  const stop=(label,mutate,expected)=>{const input=reconcileInputs();mutate(input);const r=classifyPromotionReconciliation(input);
    assert.equal(r.ok,false,label);assert.equal(r.classification,PROMOTION_OWNER_ATTENTION,label);assert.equal(r.retryAuthorized,false,label);if(expected)assert.equal(r.reason,expected,label);};
  stop('three Deployments',i=>{i.deploymentRows=rows([{...promotedRow,id:THIRD_DEPLOYMENT},promotedRow,retainedRow]);i.report.inventory.deploymentCount=3;},'deployment_identity_unexpected');
  stop('wrong active Version',i=>{i.deploymentRows=rows([{...promotedRow,versions:[{version_id:ATTENDED_VERSION_ID,percentage:100}]},retainedRow]);},'deployment_identity_unexpected');
  stop('active is historical id',i=>{i.deploymentRows=rows([{...promotedRow,id:RETAINED},{...retainedRow,id:THIRD_DEPLOYMENT}]);},'deployment_identity_unexpected');
  stop('historical Deployment missing',i=>{i.deploymentRows=rows([promotedRow,{...retainedRow,id:THIRD_DEPLOYMENT}]);},'deployment_identity_unexpected');
  stop('historical Deployment changed',i=>{i.deploymentRows=rows([promotedRow,{...retainedRow,versions:[{version_id:CANDIDATE,percentage:100}]}]);},'deployment_identity_unexpected');
  stop('split traffic',i=>{i.deploymentRows=rows([{...promotedRow,versions:[{version_id:CANDIDATE,percentage:90},{version_id:ATTENDED_VERSION_ID,percentage:10}]},retainedRow]);},'deployment_identity_unexpected');
  stop('order reversed',i=>{i.deploymentRows=rows([retainedRow,promotedRow]);},'deployment_identity_unexpected');
  stop('deployments unreadable',i=>{i.deploymentRows=null;},'deployment_state_unreadable');
  stop('deployment count inconsistent',i=>{i.report.inventory.deploymentCount=1;},'deployment_state_inconsistent');
  stop('fifth Version',i=>{i.versions.versionIds.push('12345678-1234-4234-8234-123456789012');},'unexpected_extra_version');
  stop('candidate drift',i=>{i.versions.candidate.beta.modules[0].content_base64=b64('x');},'candidate_module_content_drift');
  stop('historical Version drift',i=>{i.versions.clone.beta.modules[0].content_base64=b64('x');},'historical_version_drift');
  stop('workers.dev on',i=>{i.report.inventory.workersDev=true;},'collector_topology_mismatch');
  stop('Preview on',i=>{i.report.inventory.previewUrls=true;},'collector_topology_mismatch');
  stop('Cron',i=>{i.report.inventory.cronCount=1;},'collector_topology_mismatch');
  stop('domain',i=>{i.report.inventory.customDomainCount=1;},'collector_topology_mismatch');
  stop('zone route',i=>{i.topology={...ZONE,routeCount:1};},'route_present_or_unproven');
  stop('zone route unproven',i=>{i.topology=null;},'route_present_or_unproven');
  stop('collection enabled',i=>{i.report.runtime.collectionEnabled=1;},'collection_not_disabled');
  stop('credential',i=>{i.report.runtime.credentialState='INVALID';},'credential_not_available');
  stop('lease',i=>{i.report.runtime.activeLease=true;},'active_lease');
  stop('attempt 2',i=>{i.report.priorState.attempt2Count=1;i.report.priorState.requestAttempts=2;},'retry_attempt_detected');
  stop('success',i=>{i.report.priorState.succeededAttemptCount=1;},'history_has_collection_success');
  stop('fixture revisions',i=>{i.report.priorState.fixtureRevisions=1;},'history_has_collection_success');
  stop('RESERVED',i=>{i.report.priorState.reservedAttemptCount=1;},'history_unresolved_reservation_or_staging');
  stop('STAGING',i=>{i.report.priorState.stagingGenerationCount=1;},'history_unresolved_reservation_or_staging');
  stop('mapping',i=>{i.report.mapping.mappingCount=19;},'mapping_drift');
  stop('Official FPL',i=>{i.report.officialFplAuthority.valid=false;},'official_fpl_authority_invalid');
  stop('model/UI',i=>{i.report.modelUiImportCount=1;},'model_isolation_mismatch');
  stop('raw storage',i=>{i.report.rawPayloadStoragePresent=true;},'model_isolation_mismatch');
  stop('execution evidence missing',i=>{i.execution=null;},'execution_evidence_unavailable');
  stop('execution forged: Version upload',i=>{i.execution={...i.execution,versionUploads:1};},'execution_evidence_unavailable');
  stop('execution forged: API-Football request',i=>{i.execution={...i.execution,apiFootballRequests:1};},'execution_evidence_unavailable');
  stop('execution says rejected',i=>{i.execution=buildPromotionExecutionEvidence({approvedSha:EXEC_SHA,outcome:'REJECTED',deploymentPostAttempts:1});},'execution_evidence_inconsistent');
  stop('execution id mismatch',i=>{i.execution=buildPromotionExecutionEvidence({approvedSha:EXEC_SHA,outcome:'CREATED',deploymentId:THIRD_DEPLOYMENT,deploymentPostAttempts:1});},'execution_evidence_inconsistent');
  stop('preflight unreadable',i=>{i.report=null;},'preflight_unreadable');
  stop('identity invalid',i=>{i.approvedSha='x';},'reconciliation_identity_invalid');
});

test('reconciliation of an unpromoted state is a clean stop only with definite non-application',()=>{
  const old=()=>({report:report(),deploymentRows:rows([retainedRow])});
  const notSubmitted=buildPromotionExecutionEvidence({approvedSha:EXEC_SHA,diagnostic:'TRANSPORT_REMEDIATED_PROMOTION_X'});
  const clean=classifyPromotionReconciliation(reconcileInputs({...old(),execution:notSubmitted}));
  assert.equal(clean.ok,false);assert.equal(clean.classification,PROMOTION_CLEAN_STOP);assert.equal(clean.reason,'stopped_before_promotion');
  const rejected=classifyPromotionReconciliation(reconcileInputs({...old(),execution:buildPromotionExecutionEvidence({approvedSha:EXEC_SHA,outcome:'REJECTED',deploymentPostAttempts:1})}));
  assert.equal(rejected.classification,PROMOTION_CLEAN_STOP);assert.equal(rejected.reason,'promotion_rejected');
  const ambiguous=classifyPromotionReconciliation(reconcileInputs({...old(),execution:buildPromotionExecutionEvidence({approvedSha:EXEC_SHA,outcome:'AMBIGUOUS_OWNER_ATTENTION',deploymentPostAttempts:1})}));
  assert.equal(ambiguous.classification,PROMOTION_OWNER_ATTENTION);assert.equal(ambiguous.reason,'promotion_ambiguous_no_new_deployment_observed');
  const claims=classifyPromotionReconciliation(reconcileInputs({...old(),execution:executionCreated()}));
  assert.equal(claims.classification,PROMOTION_OWNER_ATTENTION);assert.equal(claims.reason,'execution_claims_promotion_but_none_active');
});

test('execution evidence validation rejects forged or inconsistent evidence',()=>{
  const good=executionCreated();assert.equal(validatePromotionExecutionEvidence(good,{approvedSha:EXEC_SHA}),true);
  for(const mutate of [e=>{e.deploymentPostAttempts=2;e.deploymentMutations=2;e.productionMutations=2;},e=>{e.productionMutations=0;},e=>{e.versionUploads=1;},e=>{e.d1Mutations=1;},
    e=>{e.workersDevMutations=1;},e=>{e.previewMutations=1;},e=>{e.scheduleMutations=1;},e=>{e.routeMutations=1;},e=>{e.domainMutations=1;},e=>{e.workerInvocations=1;},
    e=>{e.apiFootballRequests=1;},e=>{e.secretValuesSerialized=1;},e=>{e.retryAuthorized=true;},e=>{e.approvedSha='d'.repeat(40);},e=>{e.outcome='NOT_APPLIED';},
    e=>{e.deploymentId=null;},e=>{e.deploymentId=RETAINED;},e=>{e.candidateVersionId=ATTENDED_VERSION_ID;},e=>{e.candidateCreationSha=EXEC_SHA;},e=>{e.extra=1;},e=>{delete e.outcome;},e=>{e.version='x';}]){
    const bad=structuredClone(good);mutate(bad);assert.equal(validatePromotionExecutionEvidence(bad,{approvedSha:EXEC_SHA}),false);
  }
  const stopped=buildPromotionExecutionEvidence({approvedSha:EXEC_SHA,diagnostic:'TRANSPORT_REMEDIATED_PROMOTION_X'});
  assert.equal(validatePromotionExecutionEvidence(stopped,{approvedSha:EXEC_SHA}),true);
  assert.equal(validatePromotionExecutionEvidence({...stopped,deploymentPostAttempts:1,deploymentMutations:1,productionMutations:1},{approvedSha:EXEC_SHA}),false);
  assert.equal(closedDiagnostic('transport_remediated_promotion_candidate_identity_drift'),'TRANSPORT_REMEDIATED_PROMOTION_CANDIDATE_IDENTITY_DRIFT');
  assert.equal(closedDiagnostic(new Error('token '+PROMOTE)),'TRANSPORT_REMEDIATED_PROMOTION_UNEXPECTED_FAILURE');
});

// ================= read-only runners (fake preflight, fake Cloudflare) =================
const readonlyEnv={DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID:ACCOUNT,DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT:FINGERPRINT,DATA_STEWARD_CLOUDFLARE_READ_TOKEN:READ,
  CLOUDFLARE_TOPOLOGY_READ_TOKEN:TOPOLOGY_TOKEN,APPROVED_SHA:EXEC_SHA};
function zoneAware(fake){
  return async(url,init={})=>{
    const p=new URL(String(url));
    if(p.pathname.endsWith('/zones'))return new Response(JSON.stringify({success:true,result:[{id:'a'.repeat(32),account:{id:ACCOUNT}}],result_info:{total_pages:1}}),{status:200});
    if(/\/zones\/[0-9a-f]{32}\/workers\/routes$/.test(p.pathname))return new Response(JSON.stringify({success:true,result:[]}),{status:200});
    return fake.fetchImpl(url,init);
  };
}
test('read-only admission and reconciliation runners use GET only and classify the exact states',async()=>{
  const fake=fakeCloudflare();
  const a=await runPromotionAdmission({env:readonlyEnv,fetchImpl:zoneAware(fake),preflight:async()=>report()});
  assert.equal(a.ok,true,a.reason);assert.equal(a.classification,PROMOTION_READY);
  assert.ok(fake.calls.every(c=>c.method==='GET'));assert.ok(fake.calls.every(c=>c.authorization==='Bearer '+READ));
  const promoted=fakeCloudflare({deployments:[promotedRow,retainedRow]});
  const r=await runPromotionReconciliation({env:readonlyEnv,fetchImpl:zoneAware(promoted),preflight:async()=>report({inventory:{deploymentCount:2}}),execution:executionCreated()});
  assert.equal(r.ok,true,r.reason);assert.equal(r.classification,PROMOTION_PROMOTED_INERT);assert.equal(r.observed.versionCount,4);
  assert.deepEqual(r.evidence,{productionMutations:0,apiFootballRequests:0,secretValuesRead:0});
  assert.ok(promoted.calls.every(c=>c.method==='GET'));
  const bad=await runPromotionAdmission({env:{...readonlyEnv,CLOUDFLARE_TOPOLOGY_READ_TOKEN:READ},fetchImpl:async()=>{throw new Error('no network');}});
  assert.equal(bad.ok,false);
  for(const file of ['workers/api-football-collector/transport-remediated-deployment-promotion-readonly.mjs']){
    const source=uncommented(read(file));
    assert.doesNotMatch(source,/method:'(?:POST|PUT|DELETE|PATCH)'|x-apisports-key|v3\.football\.api-sports\.io|workers\.dev/);
  }
});

// ================= workflow =================
test('Gate B workflow is dormant, manual, exact-main, first-attempt-only and holds no provider secret',()=>{
  const source=read('.github/workflows/api-football-remediated-deployment-promotion.yml'),body=uncommented(source);
  assert.match(source,/^name: API-Football Transport-Remediated Deployment Promotion$/m);
  assert.match(body,/^on:\n  workflow_dispatch:\n    inputs:\n      approved_sha:/m);
  assert.doesNotMatch(body,/^\s{2}(?:schedule|push|pull_request|workflow_run|repository_dispatch|workflow_call):/m);
  assert.equal([...body.matchAll(/github\.run_attempt == 1/g)].length,4);
  assert.match(body,/test "\$EVENT_REF" = refs\/heads\/main/);assert.match(body,/test "\$EVENT_SHA" = "\$APPROVED_SHA"/);
  assert.match(body,/Tests and deterministic build/);
  assert.match(body,/concurrency:\n  group: api-football-collector-attended-acceptance\n  cancel-in-progress: false/);
  for(const uses of body.match(/uses: [^\n]+/g))assert.match(uses,/@[0-9a-f]{40}( |$)/,uses);
  assert.equal([...body.matchAll(/name: data-steward-readonly/g)].length,2);
  assert.equal([...body.matchAll(/name: api-football-remediated-deployment-promotion$/gm)].length,1);
  for(const name of ['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_ATTENDED_READ_TOKEN','CLOUDFLARE_REMEDIATED_DEPLOYMENT_PROMOTION_TOKEN','CLOUDFLARE_REPLACEMENT_TOPOLOGY_READ_TOKEN'])
    assert.match(body,new RegExp('secrets\\.'+name+'\\b'),name);
  assert.match(body,/vars\.CLOUDFLARE_ACCOUNT_FINGERPRINT/);
  assert.doesNotMatch(body,/API_FOOTBALL_API_KEY|API_FOOTBALL_ATTENDED_TRIGGER_SECRET|CLOUDFLARE_ATTENDED_VERSION_UPLOAD_TOKEN|CLOUDFLARE_ATTENDED_MUTATION_TOKEN|x-apisports-key|v3\.football\.api-sports\.io|wrangler|workers\.dev|\/subdomain|\/d1\/database/);
  assert.match(body,/run-transport-remediated-deployment-promotion\.mjs/);assert.match(body,/transport-remediated-deployment-promotion-readonly\.mjs/);
  assert.match(body,/sha256sum "\$API_FOOTBALL_DEPLOYMENT_PROMOTION_ADMISSION_PATH"/);
  // The protected job must not see read-only steward credentials, and the read-only jobs must not see the promotion token.
  const jobs=body.split(/\n  (?=[a-z-]+:\n    if:)/);
  const protectedJob=jobs.find(job=>job.startsWith('protected-deployment-promotion:'));
  assert.ok(protectedJob);assert.doesNotMatch(protectedJob,/DATA_STEWARD_CLOUDFLARE_READ_TOKEN/);
  for(const job of jobs.filter(job=>/^(fresh-readonly-admission|final-readonly-reconciliation):/.test(job)))assert.doesNotMatch(job,/PROMOTION_TOKEN/);
});

test('Gate A workflow is marked consumed and its admission can no longer admit the four-Version state',()=>{
  const source=read('.github/workflows/api-football-remediated-version-preparation.yml');
  assert.match(source,/^# CONSUMED \(run 37680114065, attempt 1, exact main f01ccff5b13a4bbc98d7927cf620f69f46c4c54c\): do NOT dispatch again\./);
  assert.ok(fs.existsSync(path.join(root,'docs/API-FOOTBALL-TRANSPORT-REMEDIATED-DEPLOYMENT-PROMOTION.md')));
  // The live four-Version state (preflight cannot prove the three-Version lifecycle inventory) is refused by Gate A admission.
  assert.equal(transportRemediatedAdmissionDiagnostic(report(),activeDeploymentState({deployments:[retainedRow]}),{approvedSha:EXEC_SHA,accountFingerprint:FINGERPRINT}),'version_identity_mismatch');
});
