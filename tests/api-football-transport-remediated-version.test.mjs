// Transport-remediated reviewed Version preparation (repository only). No live Cloudflare or API-Football action is performed.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  ATTENDED_VERSION_APPROVED_SHA,ATTENDED_VERSION_ID,ATTENDED_VERSION_MODULE_SHA256,ORIGINAL_BLOCKED_VERSION_ID,
  buildImmutableAttendedVersionIdentity,buildLifecycleCloneIdentity,buildReviewedAttendedIdentity,expectedAttendedBindings
} from '../workers/api-football-collector/attended-version.mjs';
import {
  REVIEWED_ATTENDED_MODULE_SNAPSHOTS,REVIEWED_MODULE_PATHS,buildUploadModules,readReviewedAttendedModuleSource,resolveModuleGraph
} from '../workers/api-football-collector/stage-inactive-version.mjs';
import {GATE_C_CLONE_VERSION_ID} from '../workers/api-football-collector/replacement-foundation.mjs';
import {
  DEPLOYED_ONE_SHOT_CLONE_APPROVED_SHA,DEPLOYED_ONE_SHOT_CLONE_VERSION_ID,DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_REASON,
  DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_STOP,DEPLOYED_ONE_SHOT_EXISTING_DEPLOYMENT_ID,DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE,
  DEPLOYED_ONE_SHOT_VERSION_APPROVED_SHA,DEPLOYED_ONE_SHOT_VERSION_ID,DEPLOYED_ONE_SHOT_WORKER,DEPLOYED_ONE_SHOT_WORKER_ID
} from '../workers/api-football-collector/deployed-one-shot.mjs';
import {
  TRANSPORT_REMEDIATED_CLEAN_STOP,TRANSPORT_REMEDIATED_CONSUMED_HISTORY,TRANSPORT_REMEDIATED_EXECUTION_KEYS,TRANSPORT_REMEDIATED_OWNER_ATTENTION,
  TRANSPORT_REMEDIATED_PREPARED,TRANSPORT_REMEDIATED_READY,TRANSPORT_REMEDIATED_UPLOAD_OUTCOMES,activeDeploymentState,buildTransportRemediatedAdmission,
  buildTransportRemediatedExecutionEvidence,classifyTransportRemediatedReconciliation,closedDiagnostic,submitTransportRemediatedVersionUpload,
  transportRemediatedAdmissionDiagnostic,validateTransportRemediatedAdmissionHandoff,validateTransportRemediatedExecutionEvidence
} from '../workers/api-football-collector/transport-remediated-version-preparation.mjs';
import {
  TRANSPORT_REMEDIATED_CHANGED_FROM_ATTENDED,TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS,TRANSPORT_REMEDIATED_VERSION_CONTRACT,
  TRANSPORT_REMEDIATED_VERSION_MODULE_SHA256,buildTransportRemediatedVersionIdentity,buildTransportRemediatedVersionUploadForm,
  buildTransportRemediatedVersionUploadMetadata,readCurrentTreeModuleSource,resolveTransportRemediatedModuleGraph,transportRemediatedModuleSha256,
  transportRemediatedPublicMetadata,validateTransportRemediatedSecretMaterial,validateTransportRemediatedVersion
} from '../workers/api-football-collector/transport-remediated-version.mjs';
import {
  assertTransportRemediatedMutationAllowed,createTransportRemediatedGuardedFetch,executeTransportRemediatedVersionUpload,transportRemediatedPaths
} from '../workers/api-football-collector/run-transport-remediated-version-upload.mjs';
import {
  runTransportRemediatedAdmission,runTransportRemediatedReconciliation,transportRemediatedReadPaths
} from '../workers/api-football-collector/transport-remediated-version-readonly.mjs';

const root=path.resolve(import.meta.dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const sha256=value=>createHash('sha256').update(value).digest('hex');
const ACCOUNT='production-account',FINGERPRINT=sha256(ACCOUNT),SHA='c'.repeat(40);
const API_KEY='synthetic-api-key-material-0123456789',TRIGGER='synthetic-trigger-material-'.padEnd(48,'t');
const READ='synthetic-read-token',UPLOAD='synthetic-upload-token',TOPOLOGY_TOKEN='synthetic-topology-token';
const SUBDOMAIN='fpltsheet',EXISTING=DEPLOYED_ONE_SHOT_EXISTING_DEPLOYMENT_ID,NEW_VERSION='11111111-2222-4333-8444-555555555555';
const ZONE={proof:'ZONE_ROUTE_SCAN',zoneCount:1,routeRowCount:0,routeCount:0};
const exactDeploymentRow={id:EXISTING,created_on:'2026-10-06T08:00:00.000Z',strategy:'percentage',versions:[{version_id:ATTENDED_VERSION_ID,percentage:100}]};
const DEPLOYMENTS=activeDeploymentState({deployments:[exactDeploymentRow]});
const API='https://api.cloudflare.com/client/v4';
const paths=transportRemediatedPaths(ACCOUNT);

const CONSUMED={requestAttempts:1,attempt1Count:1,attempt2Count:0,succeededAttemptCount:0,transportUnknownCount:1,generations:1,failedGenerationCount:1,
  committedGenerationCount:0,fixtureRevisions:0,reservedAttemptCount:0,stagingGenerationCount:0,authFailureCount:0,quotaBlockedCount:0,timeoutCount:0,
  schemaFailureCount:0,httpFailureCount:0,persistenceUncertainCount:0,completionUncertainCount:0,membershipConsistentCount:0,headMatchCount:0};
function report(overrides={}){
  const base={
    ok:false,stage:DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE,classification:DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_STOP,reason:DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_REASON,
    approvedSha:SHA,versionApprovedSha:DEPLOYED_ONE_SHOT_VERSION_APPROVED_SHA,cloneApprovedSha:DEPLOYED_ONE_SHOT_CLONE_APPROVED_SHA,accountFingerprint:FINGERPRINT,
    migrationCount:6,foreignKeyViolations:0,officialFplAuthority:{valid:true,teamCount:20,fetchedAt:'2026-10-06T01:20:00.000Z'},
    mapping:{state:'COMMITTED',mappingCount:20,memberCount:20,distinctProviderIds:20,distinctFplIds:20,canonicalCoverageMatches:true,historicalAuthorityProvenancePresent:true},
    runtime:{collectionEnabled:0,credentialState:'AVAILABLE',activeLease:false},
    priorState:{...CONSUMED},
    inventory:{activation:'ATTENDED_ONE_SHOT_DISCOVERY',databaseIdPlaceholder:false,productionBindingProven:true,configurationExact:true,workerPresent:true,deploymentCount:1,cronCount:0,routeCount:0,customDomainCount:0,
      workersDev:false,previewUrls:false,secretBindingPresent:true,secretBindingNames:['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET'],
      reviewedVersionId:DEPLOYED_ONE_SHOT_VERSION_ID,reviewedWorkerId:DEPLOYED_ONE_SHOT_WORKER_ID,versionIdentityExact:true,versionInventoryExact:true,
      cloneVersionId:DEPLOYED_ONE_SHOT_CLONE_VERSION_ID,cloneVersionIdentityExact:true,previewUrlIdentityExact:true,accountSubdomain:SUBDOMAIN},
    modelUiImportCount:0,rawPayloadStoragePresent:false,evidence:{productionMutations:0,apiFootballRequests:0,secretValuesRead:0}
  };
  return structuredClone({...base,...overrides,inventory:{...base.inventory,...overrides.inventory},runtime:{...base.runtime,...overrides.runtime},
    priorState:{...base.priorState,...overrides.priorState},mapping:{...base.mapping,...overrides.mapping},officialFplAuthority:{...base.officialFplAuthority,...overrides.officialFplAuthority},
    evidence:{...base.evidence,...overrides.evidence}});
}
const diagnostic=(r=report(),d=DEPLOYMENTS)=>transportRemediatedAdmissionDiagnostic(r,d,{approvedSha:SHA,accountFingerprint:FINGERPRINT});
const admission=()=>buildTransportRemediatedAdmission({report:report(),deployments:DEPLOYMENTS,topology:ZONE,approvedSha:SHA,accountFingerprint:FINGERPRINT});
function tempFile(value){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'remediated-'));const file=path.join(dir,'admission.json');fs.writeFileSync(file,JSON.stringify(value));return file;}
const modulesOf=form=>{const out={};for(const [name,value] of form.entries())if(name!=='metadata')out[name]=value;return out;};
async function candidateDetails(versionId=NEW_VERSION,approvedSha=SHA){
  const identity=buildTransportRemediatedVersionIdentity(approvedSha),form=buildTransportRemediatedVersionUploadForm(approvedSha,{apiKey:API_KEY,triggerSecret:TRIGGER});
  const modules=[];for(const [name,file] of Object.entries(modulesOf(form)))modules.push({name,content_base64:Buffer.from(await file.text()).toString('base64')});
  const bindings=expectedAttendedBindings().map(binding=>({...binding}));
  return {identity,stable:{id:versionId,resources:{script_runtime:{compatibility_date:identity.compatibilityDate},bindings}},
    beta:{id:versionId,main_module:identity.mainModule,compatibility_date:identity.compatibilityDate,annotations:{'workers/message':identity.message,'workers/tag':identity.tag},urls:[],modules}};
}
function attendedDetails(){
  const identity=buildImmutableAttendedVersionIdentity();
  const modules=[...buildUploadModules(resolveModuleGraph())].map(([name,source])=>({name,content_base64:Buffer.from(source).toString('base64')}));
  return {stable:{id:ATTENDED_VERSION_ID,resources:{script_runtime:{compatibility_date:identity.compatibilityDate},bindings:expectedAttendedBindings().map(binding=>({...binding}))}},
    beta:{id:ATTENDED_VERSION_ID,main_module:identity.mainModule,compatibility_date:identity.compatibilityDate,annotations:{'workers/message':identity.message,'workers/tag':identity.tag},urls:[],modules}};
}

// ---------------- identity: historical vs current-tree builders ----------------
test('historical builder reproduces the immutable Version from snapshots while the remediated builder reads the corrected current tree',()=>{
  const historicalGraph=resolveModuleGraph(),remediatedGraph=resolveTransportRemediatedModuleGraph();
  const f='src/decision-intelligence/api-football-foundation.mjs',c='workers/api-football-collector/collector.mjs';
  assert.equal(historicalGraph.get(f),readReviewedAttendedModuleSource(f));assert.equal(historicalGraph.get(c),readReviewedAttendedModuleSource(c));
  assert.equal(remediatedGraph.get(f),read(f));assert.equal(remediatedGraph.get(c),read(c));
  assert.notEqual(historicalGraph.get(f),remediatedGraph.get(f));assert.notEqual(historicalGraph.get(c),remediatedGraph.get(c));
  for(const repoPath of Object.keys(REVIEWED_ATTENDED_MODULE_SNAPSHOTS))assert.notEqual(readReviewedAttendedModuleSource(repoPath),readCurrentTreeModuleSource(repoPath));
  // Old Version 04d79556 remains reproducible byte-for-byte through the historical path.
  const old=buildReviewedAttendedIdentity('d'.repeat(40));
  assert.deepEqual(old.moduleSha256,ATTENDED_VERSION_MODULE_SHA256);
  assert.deepEqual(buildImmutableAttendedVersionIdentity().moduleSha256,ATTENDED_VERSION_MODULE_SHA256);
  assert.deepEqual(buildLifecycleCloneIdentity('d'.repeat(40)).moduleSha256,ATTENDED_VERSION_MODULE_SHA256);
  assert.match(historicalGraph.get(f),/redirect:'error'/);assert.doesNotMatch(remediatedGraph.get(f),/redirect\s*:\s*'error'/);
  const hash=readReviewedAttendedModuleSource(f);assert.equal(sha256(hash),REVIEWED_ATTENDED_MODULE_SNAPSHOTS[f].sha256);
});

test('remediated identity is deterministic, distinct from every historical identity and pins the exact 17 reviewed modules',()=>{
  const a=buildTransportRemediatedVersionIdentity(SHA),b=buildTransportRemediatedVersionIdentity(SHA);
  assert.deepEqual(a,b);assert.equal(a.contract,TRANSPORT_REMEDIATED_VERSION_CONTRACT);assert.ok(Object.isFrozen(a));
  assert.equal(a.mainModule,'collector.mjs');assert.equal(a.compatibilityDate,'2026-09-16');
  assert.equal(Object.keys(a.moduleSha256).length,17);assert.equal(REVIEWED_MODULE_PATHS.length,17);
  assert.deepEqual(a.moduleSha256,TRANSPORT_REMEDIATED_VERSION_MODULE_SHA256);assert.deepEqual(transportRemediatedModuleSha256(),TRANSPORT_REMEDIATED_VERSION_MODULE_SHA256);
  assert.match(a.metadataSha256,/^[0-9a-f]{64}$/);assert.match(a.graphSha256,/^[0-9a-f]{64}$/);
  assert.notDeepEqual(a.moduleSha256,ATTENDED_VERSION_MODULE_SHA256);
  assert.deepEqual([...TRANSPORT_REMEDIATED_CHANGED_FROM_ATTENDED].sort(),['collector.mjs','modules/src/decision-intelligence/api-football-foundation.mjs']);
  for(const [name,hash] of Object.entries(ATTENDED_VERSION_MODULE_SHA256))if(!TRANSPORT_REMEDIATED_CHANGED_FROM_ATTENDED.includes(name))assert.equal(a.moduleSha256[name],hash);
  assert.notEqual(a.graphSha256,buildTransportRemediatedVersionIdentity('d'.repeat(40)).graphSha256);
  assert.notEqual(a.tag,buildReviewedAttendedIdentity(SHA).tag);assert.match(a.tag,/^api-football-transport-remediated-/);
  assert.match(a.message,/transport-remediated/);
  for(const id of TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS)assert.notEqual(id,'');
  assert.deepEqual([...TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS],[ORIGINAL_BLOCKED_VERSION_ID,ATTENDED_VERSION_ID,GATE_C_CLONE_VERSION_ID]);
});

test('approved SHA is required and invalid values are rejected',()=>{
  for(const bad of [undefined,null,'',123,'abc','Z'.repeat(40),'A'.repeat(40),'a'.repeat(39),'a'.repeat(41)])
    assert.throws(()=>buildTransportRemediatedVersionIdentity(bad),/collector_transport_remediated_approved_sha_invalid/);
  assert.throws(()=>buildTransportRemediatedVersionUploadForm('x',{apiKey:API_KEY,triggerSecret:TRIGGER}),/approved_sha_invalid/);
});

test('any reviewed-module change, unreviewed import, dynamic import or external dependency fails closed',()=>{
  const f='src/decision-intelligence/api-football-foundation.mjs';
  const withSource=(target,transform)=>repoPath=>repoPath===target?transform(readCurrentTreeModuleSource(repoPath)):readCurrentTreeModuleSource(repoPath);
  assert.throws(()=>buildTransportRemediatedVersionIdentity(SHA,{readFile:withSource(f,s=>s+'\n// drift\n')}),/collector_transport_remediated_source_drift/);
  assert.throws(()=>buildTransportRemediatedVersionIdentity(SHA,{readFile:withSource('src/decision-intelligence/rights.mjs',s=>s+' ')}),/source_drift/);
  // The historical snapshot bytes must never be accepted as the remediated contract.
  assert.throws(()=>buildTransportRemediatedVersionIdentity(SHA,{readFile:repoPath=>readReviewedAttendedModuleSource(repoPath)}),/collector_transport_remediated_request_contract_invalid/);
  assert.throws(()=>buildTransportRemediatedVersionIdentity(SHA,{readFile:withSource('src/decision-intelligence/rights.mjs',s=>s+"\nimport './unreviewed.mjs';\n")}),/collector_staging_unreviewed_module/);
  assert.throws(()=>buildTransportRemediatedVersionIdentity(SHA,{readFile:withSource('src/decision-intelligence/rights.mjs',s=>s+"\nawait import('./x.mjs');\n")}),/collector_staging_dynamic_import_forbidden/);
  assert.throws(()=>buildTransportRemediatedVersionIdentity(SHA,{readFile:withSource('src/decision-intelligence/rights.mjs',s=>s+"\nimport fs from 'node:fs';\n")}),/collector_staging_external_module_dependency/);
  assert.throws(()=>buildTransportRemediatedVersionIdentity(SHA,{readFile:withSource('src/decision-intelligence/rights.mjs',s=>s+"\nimport x from 'npm:left-pad';\n")}),/collector_staging_external_module_dependency/);
  assert.throws(()=>readCurrentTreeModuleSource('src/main.mjs'),/unreviewed_module/);
  assert.throws(()=>buildTransportRemediatedVersionIdentity(SHA,{readFile:()=>{throw new Error('missing');}}),/collector_staging_module_missing/);
});

test('uploaded bytes carry redirect manual, exactly the x-apisports-key header and no old contract',async()=>{
  const form=buildTransportRemediatedVersionUploadForm(SHA,{apiKey:API_KEY,triggerSecret:TRIGGER});
  const files=modulesOf(form);assert.equal(Object.keys(files).length,17);
  const foundation=await files['modules/src/decision-intelligence/api-football-foundation.mjs'].text(),collector=await files['collector.mjs'].text();
  assert.match(foundation,/API_FOOTBALL_REQUEST_REDIRECT_MODE='manual'/);
  assert.match(foundation,/init:\{method:'GET',redirect:API_FOOTBALL_REQUEST_REDIRECT_MODE,headers:Object\.freeze\(\{'x-apisports-key':apiKey\}\)\}/);
  assert.match(foundation,/API_FOOTBALL_REQUEST_HEADER_NAMES=Object\.freeze\(\['x-apisports-key'\]\)/);
  for(const source of [foundation,collector]){assert.doesNotMatch(source,/redirect\s*:\s*'error'/);assert.doesNotMatch(source,/accept\s*:\s*'application\/json'/i);}
  assert.match(foundation,/API_FOOTBALL_REQUEST_TIMEOUT_MS=15000/);
  assert.match(foundation,/https:\/\/v3\.football\.api-sports\.io/);
  for(const [name,file] of Object.entries(files))assert.equal(sha256(await file.text()),TRANSPORT_REMEDIATED_VERSION_MODULE_SHA256[name]);
  assert.deepEqual(Object.keys(files).sort(),Object.keys(TRANSPORT_REMEDIATED_VERSION_MODULE_SHA256).sort());
});

test('the remediated builder has no snapshot indirection and the historical builder keeps its snapshot default',()=>{
  const remediated=read('workers/api-football-collector/transport-remediated-version.mjs');
  assert.doesNotMatch(remediated,/REVIEWED_ATTENDED_MODULE_SNAPSHOTS|readReviewedAttendedModuleSource|\.snapshot|reviewed-attended-module-snapshots/);
  assert.match(read('workers/api-football-collector/stage-inactive-version.mjs'),/export function resolveModuleGraph\(\{readFile=readReviewedAttendedModuleSource\}/);
  // No historical builder path may be reachable from the remediated upload path.
  for(const file of ['transport-remediated-version-preparation.mjs','run-transport-remediated-version-upload.mjs','transport-remediated-version-readonly.mjs']){
    const source=read('workers/api-football-collector/'+file);
    assert.doesNotMatch(source,/buildAttendedVersionUploadForm|buildLifecycleCloneVersionUploadForm|prepareFinalAttendedVersion|buildReviewedAttendedIdentity|readReviewedAttendedModuleSource/,file);
  }
});

// ---------------- secrets ----------------
test('secret binding names are exact and secret values never enter identity, annotations or public metadata',()=>{
  const bindings=expectedAttendedBindings();
  assert.deepEqual(bindings.filter(b=>b.type==='secret_text').map(b=>b.name),['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET']);
  assert.deepEqual(bindings.filter(b=>b.type==='plain_text').map(b=>[b.name,b.text]),[['API_FOOTBALL_FPL_SEASON','2026-27'],['API_FOOTBALL_PROVIDER_SEASON','2026'],['EIA_2I5D_ACTIVATION','ATTENDED_ONE_SHOT_DISCOVERY']]);
  assert.equal(bindings.find(b=>b.name==='TEAMSHEET_DATA_DB').database_id.length,36);
  const identity=buildTransportRemediatedVersionIdentity(SHA),metadata=buildTransportRemediatedVersionUploadMetadata(SHA,{apiKey:API_KEY,triggerSecret:TRIGGER});
  const publicText=JSON.stringify([identity,transportRemediatedPublicMetadata(identity)]);
  for(const secret of [API_KEY,TRIGGER])assert.ok(!publicText.includes(secret));
  assert.deepEqual(metadata.annotations,{'workers/message':identity.message,'workers/tag':identity.tag});
  for(const secret of [API_KEY,TRIGGER])assert.ok(!JSON.stringify(metadata.annotations).includes(secret));
  const upload=metadata.bindings.filter(b=>b.type==='secret_text');
  assert.equal(upload.find(b=>b.name==='API_FOOTBALL_API_KEY').text,API_KEY);assert.equal(upload.find(b=>b.name==='API_FOOTBALL_ATTENDED_TRIGGER_SECRET').text,TRIGGER);
  assert.ok(transportRemediatedPublicMetadata(identity).bindings.filter(b=>b.type==='secret_text').every(b=>!Object.hasOwn(b,'text')));
});

test('secret material rules: missing, equal and short secrets are rejected',()=>{
  assert.equal(validateTransportRemediatedSecretMaterial({apiKey:API_KEY,triggerSecret:TRIGGER}),true);
  for(const bad of [{},{apiKey:API_KEY},{triggerSecret:TRIGGER},{apiKey:'',triggerSecret:TRIGGER},{apiKey:API_KEY,triggerSecret:''},{apiKey:TRIGGER,triggerSecret:TRIGGER},
    {apiKey:API_KEY,triggerSecret:'s'.repeat(31)},{apiKey:5,triggerSecret:TRIGGER}])
    assert.throws(()=>validateTransportRemediatedSecretMaterial(bad),/secret_material_invalid/);
  assert.equal(validateTransportRemediatedSecretMaterial({apiKey:API_KEY,triggerSecret:'s'.repeat(32)}),true);
  assert.throws(()=>buildTransportRemediatedVersionUploadForm(SHA,{apiKey:'',triggerSecret:TRIGGER}),/secret_material_invalid/);
});

// ---------------- created Version validation ----------------
test('a created Version validates only when module bytes, metadata, bindings and annotations are exact',async()=>{
  const d=await candidateDetails();
  assert.equal(validateTransportRemediatedVersion({stableVersion:d.stable,betaVersion:d.beta,versionId:NEW_VERSION,identity:d.identity}),true);
  const mutate=(fn)=>{const c=structuredClone({stable:d.stable,beta:d.beta});fn(c);return ()=>validateTransportRemediatedVersion({stableVersion:c.stable,betaVersion:c.beta,versionId:NEW_VERSION,identity:d.identity});};
  assert.throws(mutate(c=>{c.beta.modules[0].content_base64=Buffer.from('x').toString('base64');}),/module_content_drift/);
  assert.throws(mutate(c=>{c.beta.modules.pop();}),/module_set_drift/);
  assert.throws(mutate(c=>{c.beta.modules[1].name='extra.mjs';}),/module_set_drift/);
  assert.throws(mutate(c=>{c.beta.annotations['workers/tag']='other';}),/annotation_drift/);
  assert.throws(mutate(c=>{c.beta.annotations['workers/message']='other';}),/annotation_drift/);
  assert.throws(mutate(c=>{c.stable.resources.bindings.find(b=>b.type==='secret_text').text='leaked';}),/binding_drift/);
  assert.throws(mutate(c=>{c.stable.resources.bindings.pop();}),/binding_drift/);
  assert.throws(mutate(c=>{c.stable.resources.bindings.find(b=>b.type==='d1').database_id='00000000-0000-4000-8000-000000000000';}),/binding_drift/);
  assert.throws(mutate(c=>{c.stable.resources.script_runtime.compatibility_date='2026-01-01';}),/runtime_drift/);
  assert.throws(mutate(c=>{c.beta.compatibility_date='2026-01-01';}),/runtime_drift/);
  assert.throws(mutate(c=>{c.beta.urls=['https://x.workers.dev'];}),/version_routable/);
  assert.throws(mutate(c=>{c.beta.package_dependencies=[{name:'x'}];}),/package_dependency/);
  assert.throws(()=>validateTransportRemediatedVersion({stableVersion:d.stable,betaVersion:d.beta,versionId:'not-a-uuid',identity:d.identity}),/identity_drift/);
  for(const historical of TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS)
    assert.throws(()=>validateTransportRemediatedVersion({stableVersion:{...d.stable,id:historical},betaVersion:{...d.beta,id:historical},versionId:historical,identity:d.identity}),/version_not_new/);
  assert.throws(()=>validateTransportRemediatedVersion({stableVersion:d.stable,betaVersion:d.beta,versionId:NEW_VERSION,identity:{...d.identity,contract:'old'}}),/identity_invalid/);
  // The old attended module set must never validate as the remediated Version.
  const oldIdentity={...d.identity,moduleSha256:ATTENDED_VERSION_MODULE_SHA256};
  assert.throws(()=>validateTransportRemediatedVersion({stableVersion:d.stable,betaVersion:d.beta,versionId:NEW_VERSION,identity:oldIdentity}),/module_content_drift/);
});

// ---------------- active Deployment reader ----------------
test('active Deployment reader follows Cloudflare list order: the first row is the active Deployment',()=>{
  assert.deepEqual({...DEPLOYMENTS,activeVersionIds:[...DEPLOYMENTS.activeVersionIds]},{count:1,orderingProven:true,activeDeploymentId:EXISTING,activeVersionIds:[ATTENDED_VERSION_ID],selectsRetainedVersionAt100:true});
  assert.equal(activeDeploymentState({deployments:[]}).activeDeploymentId,null);assert.equal(activeDeploymentState({deployments:[]}).count,0);
  const first={id:EXISTING,created_on:'bad-or-irrelevant',strategy:'percentage',versions:[{version_id:ATTENDED_VERSION_ID,percentage:100}]};
  const second={id:'older-or-newer-does-not-matter',created_on:'2099-01-01T00:00:00Z',strategy:'percentage',versions:[{version_id:NEW_VERSION,percentage:100}]};
  assert.equal(activeDeploymentState({deployments:[first,second]}).activeDeploymentId,EXISTING);
  assert.equal(activeDeploymentState({deployments:[second,first]}).activeDeploymentId,second.id);
  assert.equal(activeDeploymentState({deployments:[first,second]}).orderingProven,true);
  assert.equal(activeDeploymentState({deployments:[first,{...first}]}),null);assert.equal(activeDeploymentState({deployments:[null]}),null);
  assert.equal(activeDeploymentState('x'),null);assert.equal(activeDeploymentState(null),null);
  assert.equal(activeDeploymentState({deployments:[{...exactDeploymentRow,versions:[{version_id:ATTENDED_VERSION_ID,percentage:50},{version_id:NEW_VERSION,percentage:50}]}]}).selectsRetainedVersionAt100,false);
  assert.equal(activeDeploymentState({deployments:[{...exactDeploymentRow,strategy:'other'}]}).selectsRetainedVersionAt100,false);
});

// ---------------- admission ----------------
test('admission accepts only the exact known post-consumption state',()=>{
  assert.equal(diagnostic(),null);
  const built=admission();assert.equal(built.ok,true);assert.equal(built.classification,TRANSPORT_REMEDIATED_READY);assert.equal(built.retryAuthorized,false);
  assert.equal(validateTransportRemediatedAdmissionHandoff(JSON.parse(JSON.stringify(built)),{approvedSha:SHA,accountFingerprint:FINGERPRINT}),true);
});

test('admission rejects every drift from the exact known state before any mutation',()=>{
  const reject=(label,r,d=DEPLOYMENTS)=>assert.notEqual(diagnostic(r,d),null,label);
  const twoDeployments=activeDeploymentState({deployments:[exactDeploymentRow,{id:'dep-2',created_on:'2026-10-07T00:00:00Z',strategy:'percentage',versions:[{version_id:ATTENDED_VERSION_ID,percentage:100}]}]});
  reject('zero deployments',report({inventory:{deploymentCount:0}}),activeDeploymentState({deployments:[]}));
  reject('two deployments',report({inventory:{deploymentCount:2}}),twoDeployments);
  reject('wrong deployment id',report(),activeDeploymentState({deployments:[{...exactDeploymentRow,id:'other'}]}));
  reject('deployment points to wrong version',report(),activeDeploymentState({deployments:[{...exactDeploymentRow,versions:[{version_id:NEW_VERSION,percentage:100}]}]}));
  reject('deployment 50 percent',report(),activeDeploymentState({deployments:[{...exactDeploymentRow,versions:[{version_id:ATTENDED_VERSION_ID,percentage:50}]}]}));
  reject('deployment unreadable',report(),null);
  reject('deployment count inconsistent',report({inventory:{deploymentCount:2}}));
  reject('existing remediated Version (four Versions)',report({inventory:{versionInventoryExact:false,versionIdentityExact:false}}));
  reject('clone not exact',report({inventory:{cloneVersionIdentityExact:false}}));
  reject('wrong clone id',report({inventory:{cloneVersionId:NEW_VERSION}}));
  reject('workers.dev on',report({inventory:{workersDev:true}}));
  reject('preview on',report({inventory:{previewUrls:true}}));
  reject('legacy route present',report({inventory:{routeCount:1}}));
  reject('legacy route unproven',report({inventory:{routeCount:null}}));
  reject('domain present',report({inventory:{customDomainCount:1}}));
  reject('cron present',report({inventory:{cronCount:1}}));
  reject('collection enabled',report({runtime:{collectionEnabled:1}}));
  reject('credential unprovisioned',report({runtime:{credentialState:'UNPROVISIONED'}}));
  reject('credential invalid',report({runtime:{credentialState:'INVALID'}}));
  reject('lease active',report({runtime:{activeLease:true}}));
  reject('mapping not 20',report({mapping:{mappingCount:19,memberCount:19}}));
  reject('mapping not committed',report({mapping:{state:'STAGING'}}));
  reject('authority invalid',report({officialFplAuthority:{valid:false}}));
  reject('authority team count',report({officialFplAuthority:{teamCount:19}}));
  reject('pristine history',report({priorState:{requestAttempts:0,attempt1Count:0,transportUnknownCount:0,generations:0,failedGenerationCount:0}}));
  reject('attempt 2',report({priorState:{requestAttempts:2,attempt2Count:1}}));
  reject('two attempts',report({priorState:{requestAttempts:2,attempt1Count:2}}));
  reject('success',report({priorState:{succeededAttemptCount:1}}));
  reject('committed generation',report({priorState:{committedGenerationCount:1}}));
  reject('extra generation',report({priorState:{generations:2}}));
  reject('RESERVED',report({priorState:{reservedAttemptCount:1}}));
  reject('STAGING',report({priorState:{stagingGenerationCount:1}}));
  reject('fixture revisions',report({priorState:{fixtureRevisions:1}}));
  reject('timeout instead of transport unknown',report({priorState:{timeoutCount:1,transportUnknownCount:0}}));
  reject('auth failure',report({priorState:{authFailureCount:1}}));
  reject('model/UI integration',report({modelUiImportCount:1}));
  reject('raw payload storage',report({rawPayloadStoragePresent:true}));
  reject('migration drift',report({migrationCount:5}));
  reject('foreign key',report({foreignKeyViolations:1}));
  reject('wrong secret names',report({inventory:{secretBindingNames:['API_FOOTBALL_API_KEY']}}));
  reject('wrong worker',report({inventory:{reviewedWorkerId:'x'}}));
  reject('identity mismatch',report({accountFingerprint:'f'.repeat(64)}));
  reject('wrong stage',report({stage:'ATTENDED_ACCEPTANCE'}));
  reject('production mutation evidence',report({evidence:{productionMutations:1}}));
  reject('preflight reported ok',report({ok:true,classification:'VERSION_URL_CREATION_EXPERIMENT_RECONCILED',reason:null}));
  reject('other stop reason',report({reason:'credential_state_unexpected'}));
  reject('null report',null);
  assert.equal(transportRemediatedAdmissionDiagnostic(report(),DEPLOYMENTS,{approvedSha:'bad',accountFingerprint:FINGERPRINT}),'admission_identity_invalid');
  assert.notEqual(buildTransportRemediatedAdmission({report:report(),deployments:DEPLOYMENTS,topology:{...ZONE,routeCount:1},approvedSha:SHA,accountFingerprint:FINGERPRINT}).ok,true);
  assert.notEqual(buildTransportRemediatedAdmission({report:report(),deployments:DEPLOYMENTS,topology:null,approvedSha:SHA,accountFingerprint:FINGERPRINT}).ok,true);
  assert.notEqual(buildTransportRemediatedAdmission({report:report(),deployments:DEPLOYMENTS,topology:ZONE,topologyFailure:'x',approvedSha:SHA,accountFingerprint:FINGERPRINT}).ok,true);
  assert.deepEqual(TRANSPORT_REMEDIATED_CONSUMED_HISTORY,CONSUMED);
});

test('admission handoff validation rejects tampered or foreign artifacts',()=>{
  const good=JSON.parse(JSON.stringify(admission())),id={approvedSha:SHA,accountFingerprint:FINGERPRINT};
  assert.equal(validateTransportRemediatedAdmissionHandoff(good,id),true);
  for(const mutate of [a=>{a.ok=false;},a=>{a.classification='x';},a=>{a.approvedSha='d'.repeat(40);},a=>{a.retainedDeploymentId='x';},a=>{a.retryAuthorized=true;},
    a=>{a.evidence.productionMutations=1;},a=>{a.topology.routeCount=1;},a=>{a.preflight.runtime.collectionEnabled=1;},a=>{a.deployments.count=2;},a=>{a.version='old';}]){
    const bad=structuredClone(good);mutate(bad);assert.throws(()=>validateTransportRemediatedAdmissionHandoff(bad,id),/ADMISSION_HANDOFF_INVALID/);
  }
});

// ---------------- Version upload outcomes: at most one POST, never resent ----------------
test('upload: definite acceptance is confirmed by readback and never resent',async()=>{
  let posts=0,reads=0;
  const result=await submitTransportRemediatedVersionUpload({beforeIds:[...TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS],
    post:async()=>{posts+=1;return {kind:'OK',result:{id:NEW_VERSION}};},readVersions:async()=>{reads+=1;return [...TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS,NEW_VERSION];}});
  assert.deepEqual({outcome:result.outcome,versionId:result.versionId},{outcome:'CREATED',versionId:NEW_VERSION});assert.equal(posts,1);assert.equal(reads,1);
});
test('upload: explicit rejection stops with no readback and no resend',async()=>{
  let posts=0,reads=0;
  const result=await submitTransportRemediatedVersionUpload({beforeIds:[...TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS],post:async()=>{posts+=1;return {kind:'REJECTED'};},readVersions:async()=>{reads+=1;return [];}});
  assert.equal(result.outcome,'REJECTED');assert.equal(posts,1);assert.equal(reads,0);
});
test('upload: ambiguous response resolved by readback never sends a second POST',async()=>{
  const before=[...TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS];
  const run=async(post,readVersions)=>{let posts=0;const waits=[];const result=await submitTransportRemediatedVersionUpload({beforeIds:before,wait:async ms=>{waits.push(ms);},post:async()=>{posts+=1;return post();},readVersions});return {result,posts,waits};};
  const applied=await run(()=>({kind:'AMBIGUOUS'}),async()=>[...before,NEW_VERSION]);
  assert.deepEqual({o:applied.result.outcome,v:applied.result.versionId,p:applied.posts},{o:'APPLIED_CONFIRMED_BY_READBACK',v:NEW_VERSION,p:1});
  const thrown=await run(()=>{throw new Error('transport');},async()=>[...before,NEW_VERSION]);assert.equal(thrown.result.outcome,'APPLIED_CONFIRMED_BY_READBACK');assert.equal(thrown.posts,1);
  const absentAmbiguous=await run(()=>({kind:'AMBIGUOUS'}),async()=>[...before]);
  assert.equal(absentAmbiguous.result.outcome,'AMBIGUOUS_OWNER_ATTENTION');assert.equal(absentAmbiguous.posts,1);assert.equal(absentAmbiguous.result.readbackAttempts,3);assert.deepEqual(absentAmbiguous.waits,[2000,5000]);
  const lateAppears=await run(()=>({kind:'AMBIGUOUS'}),(()=>{let n=0;return async()=>++n<3?[...before]:[...before,NEW_VERSION];})());
  assert.equal(lateAppears.result.outcome,'APPLIED_CONFIRMED_BY_READBACK');assert.equal(lateAppears.posts,1);
  const unreadable=await run(()=>({kind:'AMBIGUOUS'}),async()=>{throw new Error('read');});assert.equal(unreadable.result.outcome,'AMBIGUOUS_OWNER_ATTENTION');assert.equal(unreadable.posts,1);
  const malformed=await run(()=>({kind:'AMBIGUOUS'}),async()=>['not-a-uuid']);assert.equal(malformed.result.outcome,'AMBIGUOUS_OWNER_ATTENTION');
  const duplicate=await run(()=>({kind:'AMBIGUOUS'}),async()=>[...before,NEW_VERSION,NEW_VERSION]);assert.equal(duplicate.result.outcome,'AMBIGUOUS_OWNER_ATTENTION');
  const two=await run(()=>({kind:'AMBIGUOUS'}),async()=>[...before,NEW_VERSION,'99999999-2222-4333-8444-555555555555']);assert.equal(two.result.outcome,'AMBIGUOUS_OWNER_ATTENTION');
  const removed=await run(()=>({kind:'AMBIGUOUS'}),async()=>[before[0],before[1],NEW_VERSION]);assert.equal(removed.result.outcome,'AMBIGUOUS_OWNER_ATTENTION');
  const acceptedInvisible=await run(()=>({kind:'OK',result:{id:NEW_VERSION}}),async()=>[...before]);assert.equal(acceptedInvisible.result.outcome,'AMBIGUOUS_OWNER_ATTENTION');
  const mismatch=await run(()=>({kind:'OK',result:{id:NEW_VERSION}}),async()=>[...before,'99999999-2222-4333-8444-555555555555']);assert.equal(mismatch.result.outcome,'AMBIGUOUS_OWNER_ATTENTION');
  const malformedAccept=await run(()=>({kind:'OK',result:{id:'bad'}}),async()=>[...before,NEW_VERSION]);assert.equal(malformedAccept.result.outcome,'APPLIED_CONFIRMED_BY_READBACK');assert.equal(malformedAccept.posts,1);
  const reusedId=await run(()=>({kind:'OK',result:{id:before[0]}}),async()=>[...before]);assert.equal(reusedId.result.outcome,'AMBIGUOUS_OWNER_ATTENTION');
  for(const r of [applied,thrown,absentAmbiguous,lateAppears,unreadable,malformed,duplicate,two,removed,acceptedInvisible,mismatch,malformedAccept,reusedId])assert.ok(TRANSPORT_REMEDIATED_UPLOAD_OUTCOMES.includes(r.result.outcome));
});
test('upload: operations and starting inventory are validated before any POST',async()=>{
  let posts=0;const post=async()=>{posts+=1;return {kind:'OK',result:{id:NEW_VERSION}};};
  for(const beforeIds of [[],[ATTENDED_VERSION_ID],[...TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS,NEW_VERSION],[ORIGINAL_BLOCKED_VERSION_ID,ATTENDED_VERSION_ID,NEW_VERSION],null])
    await assert.rejects(()=>submitTransportRemediatedVersionUpload({post,readVersions:async()=>[],beforeIds}),/UPLOAD_OPERATIONS_INVALID/);
  await assert.rejects(()=>submitTransportRemediatedVersionUpload({readVersions:async()=>[],beforeIds:[...TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS]}),/UPLOAD_OPERATIONS_INVALID/);
  assert.equal(posts,0);
});

// ---------------- executor: allowlist, guarded network, ceilings ----------------
test('executor mutation allowlist contains only the Version upload POST and rejects everything else before network',()=>{
  assert.equal(assertTransportRemediatedMutationAllowed('POST',paths.versions,{accountId:ACCOUNT}),true);
  const script='/accounts/'+ACCOUNT+'/workers/scripts/'+DEPLOYED_ONE_SHOT_WORKER;
  for(const [method,requestPath] of [
    ['POST',script+'/deployments'],['POST',script+'/subdomain'],['POST',paths.d1],['POST',script+'/schedules'],['PUT',script+'/schedules'],['POST','/zones/z/workers/routes'],
    ['POST','/accounts/'+ACCOUNT+'/workers/domains'],['PUT','/accounts/'+ACCOUNT+'/workers/domains'],['DELETE',script],['DELETE',script+'/versions'],['PUT',paths.versions],['PATCH',paths.versions],
    ['POST','/accounts/'+ACCOUNT+'/workers/workers'],['POST',script],['POST',script+'/secrets'],['PUT',script+'/secrets'],['GET',paths.versions],['POST',paths.versions+'?x=1'],
    ['POST','/accounts/'+ACCOUNT+'/workers/scripts/other-worker/versions'],['POST',script+'/versions/'+NEW_VERSION]])
    assert.throws(()=>assertTransportRemediatedMutationAllowed(method,requestPath,{accountId:ACCOUNT}),/ENDPOINT_FORBIDDEN/,method+' '+requestPath);
});

test('guarded fetch allows Cloudflare GETs plus exactly one Version POST and forbids every D1/provider/Worker/mutation path',async()=>{
  const calls=[];const guard=createTransportRemediatedGuardedFetch({accountId:ACCOUNT,readToken:READ,uploadToken:UPLOAD,fetchImpl:async(url,init)=>{calls.push([init?.method||'GET',String(url)]);return new Response('{}');}});
  const script=API+'/accounts/'+ACCOUNT+'/workers/scripts/'+DEPLOYED_ONE_SHOT_WORKER;
  const d1=API+'/accounts/'+ACCOUNT+'/d1/database/00000000-0000-0000-0000-000000000000/query';
  const forbidden=[
    ['https://v3.football.api-sports.io/fixtures?league=39','GET',{'x-apisports-key':API_KEY}],
    ['https://'+DEPLOYED_ONE_SHOT_WORKER+'.'+SUBDOMAIN+'.workers.dev/internal/attended-acceptance','POST',{}],
    ['https://'+DEPLOYED_ONE_SHOT_WORKER+'.'+SUBDOMAIN+'.workers.dev/','GET',{}],
    ['https://api.cloudflare.com.evil.example/client/v4/accounts','GET',{}],['http://api.cloudflare.com/client/v4/accounts','GET',{}],['https://api.cloudflare.com:8443/client/v4/x','GET',{}],
    ['https://user:pass@api.cloudflare.com/client/v4/x','GET',{}],['https://api.cloudflare.com/other','GET',{}],['not a url','GET',{}],
    [script+'/deployments','POST',{Authorization:'Bearer '+UPLOAD}],[script+'/subdomain','POST',{Authorization:'Bearer '+UPLOAD}],
    [script+'/schedules','PUT',{Authorization:'Bearer '+UPLOAD}],['https://api.cloudflare.com/client/v4/zones/z/workers/routes','POST',{Authorization:'Bearer '+UPLOAD}],
    [API+'/accounts/'+ACCOUNT+'/workers/domains','PUT',{Authorization:'Bearer '+UPLOAD}],[script,'DELETE',{Authorization:'Bearer '+UPLOAD}],[script+'/versions','PUT',{Authorization:'Bearer '+UPLOAD}],
    [API+'/accounts/'+ACCOUNT+'/workers/workers','POST',{Authorization:'Bearer '+UPLOAD}],[script+'/versions','POST',{Authorization:'Bearer '+READ}],[script+'/versions','POST',{}],
    [d1,'POST',{Authorization:'Bearer '+READ}],[d1,'POST',{Authorization:'Bearer '+UPLOAD}]
  ];
  for(const [url,method,headers] of forbidden)await assert.rejects(()=>guard.fetch(url,{method,headers,body:'{}'}),/TRANSPORT_REMEDIATED_/,method+' '+url);
  assert.deepEqual(calls,[]);assert.ok(guard.counters.blockedEgress>0);assert.equal(guard.counters.versionUploadAttempts,0);
  await assert.rejects(()=>guard.fetch(script+'/versions?deployable=true',{method:'GET',headers:{Authorization:'Bearer '+UPLOAD}}),/UPLOAD_CREDENTIAL_READ_FORBIDDEN/);
  await guard.fetch(script+'/deployments',{method:'GET',headers:{Authorization:'Bearer '+READ}});
  await guard.fetch(script+'/versions',{method:'POST',headers:{Authorization:'Bearer '+UPLOAD},body:new FormData()});
  await assert.rejects(()=>guard.fetch(script+'/versions',{method:'POST',headers:{Authorization:'Bearer '+UPLOAD},body:new FormData()}),/UPLOAD_CEILING_EXCEEDED/);
  assert.equal(calls.length,2);assert.equal(guard.counters.versionUploadAttempts,1);assert.equal('d1ReadQueries' in guard.counters,false);
});

function fakeCloudflare({post='created',versionsAfter=null,deployments=[exactDeploymentRow],versions=[...TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS],
  subdomain={enabled:false,previews_enabled:false},schedules=[],domains=[]}={}){
  const calls=[];let current=[...versions];
  const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
  const fetchImpl=async(url,init={})=>{
    const method=String(init.method||'GET').toUpperCase(),requestPath=new URL(String(url)).pathname.slice('/client/v4'.length)+new URL(String(url)).search;
    calls.push({method,requestPath,authorization:init.headers?.Authorization,body:init.body});
    if(method==='GET'&&requestPath===paths.deployments)return json({success:true,result:{deployments}});
    if(method==='GET'&&requestPath===paths.versionList)return json({success:true,result:{items:current.map(id=>({id}))}});
    if(method==='GET'&&requestPath===paths.subdomain)return json({success:true,result:subdomain});
    if(method==='GET'&&requestPath===paths.schedules)return json({success:true,result:{schedules}});
    if(method==='GET'&&requestPath===paths.domains)return json({success:true,result:domains});
    if(method==='POST'&&requestPath===paths.versions){
      if(post==='rejected')return json({success:false,errors:[{code:10000}]},403);
      if(post==='transport')throw new TypeError('socket hang up');
      if(post==='server-error'){if(versionsAfter==='applied')current=[...current,NEW_VERSION];return json({success:false},500);}
      current=[...current,NEW_VERSION];
      if(post==='created')return json({success:true,result:{id:NEW_VERSION}});
      if(post==='ambiguous-applied')return new Response('<html>gateway</html>',{status:200});
    }
    throw new Error('unexpected request '+method+' '+requestPath);
  };
  return {fetchImpl,calls,posts:()=>calls.filter(c=>c.method==='POST')};
}
function executorEnv(admissionFile,overrides={}){
  return {CLOUDFLARE_ACCOUNT_ID:ACCOUNT,CLOUDFLARE_ACCOUNT_FINGERPRINT:FINGERPRINT,CLOUDFLARE_ATTENDED_READ_TOKEN:READ,CLOUDFLARE_ATTENDED_VERSION_UPLOAD_TOKEN:UPLOAD,
    CLOUDFLARE_TOPOLOGY_READ_TOKEN:TOPOLOGY_TOKEN,API_FOOTBALL_API_KEY:API_KEY,API_FOOTBALL_ATTENDED_TRIGGER_SECRET:TRIGGER,APPROVED_SHA:SHA,
    API_FOOTBALL_TRANSPORT_REMEDIATED_ADMISSION_PATH:admissionFile,...overrides};
}
const runExecutor=async({fake=fakeCloudflare(),env,routeScan=async()=>ZONE,admissionValue=admission()}={})=>{
  const file=tempFile(admissionValue);
  const evidence=await executeTransportRemediatedVersionUpload({env:env??executorEnv(file),fetchImpl:fake.fetchImpl,routeScan,wait:async()=>{}});
  return {evidence,fake};
};

test('executor submits exactly one Version POST, no other mutation, and returns sanitized evidence without secrets',async()=>{
  const {evidence,fake}=await runExecutor();
  assert.equal(evidence.outcome,'CREATED');assert.equal(evidence.versionId,NEW_VERSION);assert.equal(evidence.ok,true);
  assert.equal(fake.posts().length,1);assert.equal(fake.posts()[0].requestPath,paths.versions);assert.equal(fake.posts()[0].authorization,'Bearer '+UPLOAD);
  assert.ok(fake.calls.filter(c=>c.method==='GET').every(c=>c.authorization==='Bearer '+READ));
  assert.deepEqual([...Object.keys(evidence)].sort(),[...TRANSPORT_REMEDIATED_EXECUTION_KEYS].sort());
  assert.deepEqual({u:evidence.versionUploadAttempts,p:evidence.productionMutations,d:evidence.deploymentMutations,d1:evidence.d1Mutations,w:evidence.workersDevMutations,pv:evidence.previewMutations,a:evidence.apiFootballRequests,s:evidence.secretValuesSerialized,r:evidence.retryAuthorized},
    {u:1,p:1,d:0,d1:0,w:0,pv:0,a:0,s:0,r:false});
  const text=JSON.stringify(evidence);for(const secret of [API_KEY,TRIGGER,READ,UPLOAD,TOPOLOGY_TOKEN,ACCOUNT])assert.ok(!text.includes(secret));
  assert.equal(validateTransportRemediatedExecutionEvidence(evidence,{approvedSha:SHA}),true);
  assert.equal(evidence.identity.moduleCount,17);assert.equal(evidence.identity.graphSha256,buildTransportRemediatedVersionIdentity(SHA).graphSha256);
  // The uploaded multipart form carries the corrected bytes and the two secret bindings but no Deployment request exists.
  const form=fake.posts()[0].body;assert.ok(form instanceof FormData);
  const metadata=JSON.parse(form.get('metadata'));assert.deepEqual(metadata.bindings.filter(b=>b.type==='secret_text').map(b=>b.name),['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET']);
  assert.match(await form.get('modules/src/decision-intelligence/api-football-foundation.mjs').text(),/redirect:API_FOOTBALL_REQUEST_REDIRECT_MODE/);
  assert.ok(fake.calls.every(c=>!/deployments$/.test(c.requestPath)||c.method==='GET'));
});

test('executor ambiguity handling never turns bounded absence into NOT_APPLIED and never resends',async()=>{
  const applied=await runExecutor({fake:fakeCloudflare({post:'ambiguous-applied'})});
  assert.equal(applied.evidence.outcome,'APPLIED_CONFIRMED_BY_READBACK');assert.equal(applied.evidence.versionId,NEW_VERSION);assert.equal(applied.fake.posts().length,1);
  const serverError=await runExecutor({fake:fakeCloudflare({post:'server-error',versionsAfter:'applied'})});
  assert.equal(serverError.evidence.outcome,'APPLIED_CONFIRMED_BY_READBACK');assert.equal(serverError.fake.posts().length,1);
  const absent=await runExecutor({fake:fakeCloudflare({post:'server-error'})});
  assert.equal(absent.evidence.outcome,'AMBIGUOUS_OWNER_ATTENTION');assert.equal(absent.evidence.ok,false);assert.equal(absent.fake.posts().length,1);assert.equal(absent.evidence.versionId,null);
  const transport=await runExecutor({fake:fakeCloudflare({post:'transport'})});
  assert.equal(transport.evidence.outcome,'AMBIGUOUS_OWNER_ATTENTION');assert.equal(transport.fake.posts().length,1);
  const rejected=await runExecutor({fake:fakeCloudflare({post:'rejected'})});
  assert.equal(rejected.evidence.outcome,'REJECTED');assert.equal(rejected.fake.posts().length,1);assert.equal(rejected.evidence.versionUploadAttempts,1);
  for(const r of [applied,serverError,absent,transport,rejected]){assert.equal(r.evidence.retryAuthorized,false);assert.equal(validateTransportRemediatedExecutionEvidence(r.evidence,{approvedSha:SHA}),true);}
});

test('executor sends zero network on credential/admission failure and zero POST on fresh Cloudflare drift',async()=>{
  const file=tempFile(admission());
  const base=executorEnv(file);
  const stops=async(label,options)=>{const {evidence,fake}=await runExecutor(options);assert.equal(evidence.outcome,'NOT_SUBMITTED',label);assert.equal(evidence.versionUploadAttempts,0,label);assert.equal(fake.posts().length,0,label);assert.equal(evidence.ok,false,label);return {evidence,fake};};
  for(const name of ['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_ACCOUNT_FINGERPRINT','CLOUDFLARE_ATTENDED_READ_TOKEN','CLOUDFLARE_ATTENDED_VERSION_UPLOAD_TOKEN','CLOUDFLARE_TOPOLOGY_READ_TOKEN','API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET','APPROVED_SHA','API_FOOTBALL_TRANSPORT_REMEDIATED_ADMISSION_PATH']){
    const env={...base};delete env[name];const {fake}=await stops('missing '+name,{env});assert.equal(fake.calls.length,0,name);
  }
  assert.equal((await stops('equal read/upload',{env:{...base,CLOUDFLARE_ATTENDED_VERSION_UPLOAD_TOKEN:READ}})).fake.calls.length,0);
  assert.equal((await stops('equal topology/read',{env:{...base,CLOUDFLARE_TOPOLOGY_READ_TOKEN:READ}})).fake.calls.length,0);
  assert.equal((await stops('equal topology/upload',{env:{...base,CLOUDFLARE_TOPOLOGY_READ_TOKEN:UPLOAD}})).fake.calls.length,0);
  assert.equal((await stops('api key equals token',{env:{...base,API_FOOTBALL_API_KEY:READ}})).fake.calls.length,0);
  assert.equal((await stops('equal secrets',{env:{...base,API_FOOTBALL_API_KEY:TRIGGER}})).fake.calls.length,0);
  assert.equal((await stops('short trigger',{env:{...base,API_FOOTBALL_ATTENDED_TRIGGER_SECRET:'short'}})).fake.calls.length,0);
  assert.equal((await stops('bad sha',{env:{...base,APPROVED_SHA:'x'}})).fake.calls.length,0);
  assert.equal((await stops('fingerprint mismatch',{env:{...base,CLOUDFLARE_ACCOUNT_FINGERPRINT:'a'.repeat(64)}})).fake.calls.length,0);
  assert.equal((await stops('rerun attempt 2',{env:{...base,GITHUB_RUN_ATTEMPT:'2'}})).evidence.diagnostic,'TRANSPORT_REMEDIATED_RERUN_FORBIDDEN');
  assert.equal((await stops('admission wrong sha',{env:{...base,APPROVED_SHA:'d'.repeat(40)}})).fake.calls.length,0);
  const tampered=admission();assert.equal((await stops('tampered admission',{admissionValue:{...JSON.parse(JSON.stringify(tampered)),ok:false}})).fake.calls.length,0);
  const historyTamper=JSON.parse(JSON.stringify(admission()));historyTamper.preflight.priorState.attempt2Count=1;
  assert.equal((await stops('tampered consumed history',{admissionValue:historyTamper})).fake.calls.length,0);

  await stops('workers.dev appeared',{fake:fakeCloudflare({subdomain:{enabled:true,previews_enabled:false}})});
  await stops('Preview appeared',{fake:fakeCloudflare({subdomain:{enabled:false,previews_enabled:true}})});
  await stops('Cron appeared',{fake:fakeCloudflare({schedules:[{cron:'0 * * * *'}]})});
  await stops('custom domain appeared',{fake:fakeCloudflare({domains:[{service:DEPLOYED_ONE_SHOT_WORKER}]})});
  await stops('deployment drift',{fake:fakeCloudflare({deployments:[{...exactDeploymentRow,id:'other'}]})});
  await stops('two deployments',{fake:fakeCloudflare({deployments:[exactDeploymentRow,{...exactDeploymentRow,id:'two'}]})});
  await stops('route appeared',{routeScan:async()=>({...ZONE,routeCount:1})});
  await stops('route scan failed',{routeScan:async()=>{throw new Error('boom');}});
  await stops('route scan malformed',{routeScan:async()=>({proof:'x'})});
  await stops('start inventory has an extra Version',{fake:fakeCloudflare({versions:[...TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS,NEW_VERSION]})});
  await stops('start inventory is missing a Version',{fake:fakeCloudflare({versions:[ORIGINAL_BLOCKED_VERSION_ID,ATTENDED_VERSION_ID]})});
  const depBase=fakeCloudflare();const dep=await stops('deployment unreadable',{fake:{...depBase,fetchImpl:async(url,init)=>String(url).endsWith('/deployments')?new Response('x',{status:500}):depBase.fetchImpl(url,init)}});
  assert.ok(dep.evidence.diagnostic.startsWith('TRANSPORT_REMEDIATED_'));
});

test('executor uses Cloudflare GET-only state/topology reads plus one Version POST, with no D1/provider/Worker path',async()=>{
  const {fake}=await runExecutor();
  for(const call of fake.calls){
    assert.ok(['GET','POST'].includes(call.method));
    if(call.method==='POST')assert.equal(call.requestPath,paths.versions);
    assert.doesNotMatch(call.requestPath,/d1\/database/);
  }
  assert.ok(fake.calls.some(c=>c.method==='GET'&&c.requestPath===paths.subdomain));
  assert.ok(fake.calls.some(c=>c.method==='GET'&&c.requestPath===paths.schedules));
  assert.ok(fake.calls.some(c=>c.method==='GET'&&c.requestPath===paths.domains));
  const source=read('workers/api-football-collector/run-transport-remediated-version-upload.mjs').replace(/^\s*\/\/.*$/gm,'');
  assert.doesNotMatch(source,/x-apisports-key|v3\.football\.api-sports\.io|x-teamsheet-attended-trigger|workers\.dev|createDeployment|buildDeploymentBody|collection_enabled\s*=|method:\s*'(?:PUT|DELETE|PATCH)'/i);
  assert.doesNotMatch(source,/d1\/database|assertActivationReadOnlySql|runApiFootballActivationLivePreflight|EXPECTED_D1_DATABASE_ID/);
  assert.match(source,/redirect:'manual'/);assert.doesNotMatch(source,/redirect:'error'/);
});

test('execution evidence validation rejects forged or inconsistent evidence',()=>{
  const good=buildTransportRemediatedExecutionEvidence({approvedSha:SHA,outcome:'CREATED',versionId:NEW_VERSION,readbackAttempts:1,counters:{versionUploadAttempts:1},identity:buildTransportRemediatedVersionIdentity(SHA)});
  assert.equal(validateTransportRemediatedExecutionEvidence(good,{approvedSha:SHA}),true);
  for(const mutate of [e=>{e.versionUploadAttempts=2;},e=>{e.productionMutations=0;},e=>{e.deploymentMutations=1;},e=>{e.d1Mutations=1;},e=>{e.workersDevMutations=1;},e=>{e.previewMutations=1;},
    e=>{e.apiFootballRequests=1;},e=>{e.secretValuesSerialized=1;},e=>{e.retryAuthorized=true;},e=>{e.approvedSha='d'.repeat(40);},e=>{e.outcome='MAGIC';},e=>{e.versionId=null;},
    e=>{e.extra=1;},e=>{delete e.outcome;},e=>{e.version='old';}]){
    const bad=structuredClone(good);mutate(bad);assert.equal(validateTransportRemediatedExecutionEvidence(bad,{approvedSha:SHA}),false);
  }
  const stop=buildTransportRemediatedExecutionEvidence({approvedSha:SHA,diagnostic:'TRANSPORT_REMEDIATED_X'});
  assert.equal(validateTransportRemediatedExecutionEvidence(stop,{approvedSha:SHA}),true);assert.equal(stop.outcome,'NOT_SUBMITTED');assert.equal(stop.versionUploadAttempts,0);
  assert.equal(validateTransportRemediatedExecutionEvidence({...stop,versionUploadAttempts:1,productionMutations:1},{approvedSha:SHA}),false);
  assert.equal(closedDiagnostic('collector_transport_remediated_source_drift'),'TRANSPORT_REMEDIATED_SOURCE_DRIFT');
  assert.equal(closedDiagnostic(new Error('secret '+API_KEY)),'TRANSPORT_REMEDIATED_UNEXPECTED_FAILURE');
  assert.equal(closedDiagnostic('TRANSPORT_REMEDIATED_OK'),'TRANSPORT_REMEDIATED_OK');
});

// ---------------- reconciliation ----------------
async function successInputs(overrides={}){
  const d=await candidateDetails(),a=attendedDetails();
  const execution=buildTransportRemediatedExecutionEvidence({approvedSha:SHA,outcome:'CREATED',versionId:NEW_VERSION,readbackAttempts:1,counters:{versionUploadAttempts:1},identity:d.identity});
  return {report:report({inventory:{versionInventoryExact:false,versionIdentityExact:false,cloneVersionIdentityExact:false}}),versionIds:[...TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS,NEW_VERSION],
    candidate:{versionId:NEW_VERSION,stable:d.stable,beta:d.beta},attended:a,deployments:DEPLOYMENTS,topology:ZONE,execution,approvedSha:SHA,accountFingerprint:FINGERPRINT,identity:d.identity,...overrides};
}
const classify=input=>classifyTransportRemediatedReconciliation(input);

test('reconciliation succeeds only for exactly one new exact Version created but not deployed, with everything else unchanged',async()=>{
  const result=classify(await successInputs());
  assert.equal(result.ok,true);assert.equal(result.classification,TRANSPORT_REMEDIATED_PREPARED);assert.equal(result.candidateVersionId,NEW_VERSION);assert.equal(result.retryAuthorized,false);
  const ambiguousExec=buildTransportRemediatedExecutionEvidence({approvedSha:SHA,outcome:'AMBIGUOUS_OWNER_ATTENTION',counters:{versionUploadAttempts:1}});
  assert.equal(classify(await successInputs({execution:ambiguousExec})).ok,true,'state-proven exact Version created exactly once');
  const confirmed=buildTransportRemediatedExecutionEvidence({approvedSha:SHA,outcome:'APPLIED_CONFIRMED_BY_READBACK',versionId:NEW_VERSION,counters:{versionUploadAttempts:1}});
  assert.equal(classify(await successInputs({execution:confirmed})).ok,true);
});

test('reconciliation fails closed for every unsafe or partial post-upload state',async()=>{
  const stop=async(label,mutate)=>{const input=await successInputs();mutate(input);const r=classify(input);assert.equal(r.ok,false,label);assert.equal(r.classification,TRANSPORT_REMEDIATED_OWNER_ATTENTION,label);assert.equal(r.retryAuthorized,false);return r;};
  await stop('deployment changed to the new Version',i=>{i.deployments=activeDeploymentState({deployments:[{...exactDeploymentRow,versions:[{version_id:NEW_VERSION,percentage:100}]}]});});
  await stop('second deployment created',i=>{i.deployments=activeDeploymentState({deployments:[exactDeploymentRow,{id:'new',created_on:'2026-10-07T00:00:00Z',strategy:'percentage',versions:[{version_id:NEW_VERSION,percentage:100}]}]});i.report.inventory.deploymentCount=2;});
  await stop('deployment unreadable',i=>{i.deployments=null;});
  await stop('deployment count inconsistent',i=>{i.report.inventory.deploymentCount=2;});
  await stop('workers.dev on',i=>{i.report.inventory.workersDev=true;});
  await stop('preview on',i=>{i.report.inventory.previewUrls=true;});
  await stop('cron',i=>{i.report.inventory.cronCount=1;});
  await stop('domain',i=>{i.report.inventory.customDomainCount=1;});
  await stop('legacy route',i=>{i.report.inventory.routeCount=1;});
  await stop('zone route',i=>{i.topology={...ZONE,routeCount:1};});
  await stop('zone route unproven',i=>{i.topology=null;});
  await stop('collection enabled',i=>{i.report.runtime.collectionEnabled=1;});
  await stop('lease',i=>{i.report.runtime.activeLease=true;});
  await stop('credential not available',i=>{i.report.runtime.credentialState='INVALID';});
  await stop('history changed: attempt 2',i=>{i.report.priorState.attempt2Count=1;i.report.priorState.requestAttempts=2;});
  await stop('history changed: success',i=>{i.report.priorState.succeededAttemptCount=1;});
  await stop('history reset to pristine',i=>{Object.assign(i.report.priorState,{requestAttempts:0,attempt1Count:0,transportUnknownCount:0,generations:0,failedGenerationCount:0});});
  await stop('provider activity',i=>{i.report.priorState.fixtureRevisions=1;});
  await stop('model/UI',i=>{i.report.modelUiImportCount=1;});
  await stop('preflight evidence mutation',i=>{i.report.evidence.productionMutations=1;});
  await stop('historical version missing',i=>{i.versionIds=[ORIGINAL_BLOCKED_VERSION_ID,ATTENDED_VERSION_ID,NEW_VERSION];});
  await stop('two new Versions',i=>{i.versionIds=[...i.versionIds,'99999999-2222-4333-8444-555555555555'];});
  await stop('version inventory unreadable',i=>{i.versionIds=null;});
  await stop('duplicate ids',i=>{i.versionIds=[...i.versionIds,NEW_VERSION];});
  await stop('candidate detail unreadable',i=>{i.candidate=null;});
  await stop('candidate id mismatch',i=>{i.candidate.versionId='99999999-2222-4333-8444-555555555555';});
  await stop('candidate module drift',i=>{i.candidate.beta.modules[0].content_base64=Buffer.from('x').toString('base64');});
  await stop('candidate old module set',i=>{const old=attendedDetails();i.candidate={versionId:NEW_VERSION,stable:{...old.stable,id:NEW_VERSION},beta:{...old.beta,id:NEW_VERSION}};});
  await stop('candidate secret value exposed',i=>{i.candidate.stable.resources.bindings.find(b=>b.type==='secret_text').text='x';});
  await stop('candidate routable',i=>{i.candidate.beta.urls=['https://x'];});
  await stop('retained attended Version drift',i=>{i.attended.beta.modules[0].content_base64=Buffer.from('x').toString('base64');});
  await stop('attended detail unreadable',i=>{i.attended=null;});
  await stop('execution evidence unavailable',i=>{i.execution=null;});
  await stop('execution forged counters',i=>{i.execution={...i.execution,deploymentMutations:1};});
  await stop('execution says rejected but a Version exists',i=>{i.execution=buildTransportRemediatedExecutionEvidence({approvedSha:SHA,outcome:'REJECTED',counters:{versionUploadAttempts:1}});});
  await stop('execution says not submitted but a Version exists',i=>{i.execution=buildTransportRemediatedExecutionEvidence({approvedSha:SHA});});
  await stop('execution version id differs',i=>{i.execution=buildTransportRemediatedExecutionEvidence({approvedSha:SHA,outcome:'CREATED',versionId:'99999999-2222-4333-8444-555555555555',counters:{versionUploadAttempts:1}});});
  await stop('unreadable preflight',i=>{i.report=null;});
  await stop('identity invalid',i=>{i.approvedSha='bad';});
  await stop('mapping drift',i=>{i.report.mapping.mappingCount=19;});
  await stop('other approved sha in preflight',i=>{i.report.approvedSha='d'.repeat(40);});
  const unreadableIdentity=await successInputs({identity:undefined,approvedSha:'d'.repeat(40)});
  unreadableIdentity.report.approvedSha='d'.repeat(40);unreadableIdentity.execution=buildTransportRemediatedExecutionEvidence({approvedSha:'d'.repeat(40),outcome:'CREATED',versionId:NEW_VERSION,counters:{versionUploadAttempts:1}});
  assert.equal(classify(unreadableIdentity).ok,false,'identity derived for another SHA does not match the created Version annotations');
});

test('reconciliation treats ambiguous upload with no visible Version as owner attention, never a clean stop',async()=>{
  const clean=report();
  const base=async execution=>({report:clean,versionIds:[...TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS],deployments:DEPLOYMENTS,topology:ZONE,execution,approvedSha:SHA,accountFingerprint:FINGERPRINT});
  for(const [outcome,pattern] of [['NOT_SUBMITTED',/stopped_before_upload/],['REJECTED',/upload_rejected/],['NOT_APPLIED',/upload_not_applied/]]){
    const execution=buildTransportRemediatedExecutionEvidence({approvedSha:SHA,outcome,counters:{versionUploadAttempts:outcome==='NOT_SUBMITTED'?0:1}});
    const r=classify(await base(execution));assert.equal(r.classification,TRANSPORT_REMEDIATED_CLEAN_STOP,outcome);assert.match(r.reason,pattern);assert.equal(r.ok,false);
  }
  const ambiguous=buildTransportRemediatedExecutionEvidence({approvedSha:SHA,outcome:'AMBIGUOUS_OWNER_ATTENTION',counters:{versionUploadAttempts:1}});
  const ambiguousResult=classify(await base(ambiguous));
  assert.equal(ambiguousResult.classification,TRANSPORT_REMEDIATED_OWNER_ATTENTION);assert.equal(ambiguousResult.reason,'upload_ambiguous_no_version_observed');assert.equal(ambiguousResult.retryAuthorized,false);
  assert.match(classify(await base(null)).reason,/execution_evidence_unavailable/);
  const claims=buildTransportRemediatedExecutionEvidence({approvedSha:SHA,outcome:'CREATED',versionId:NEW_VERSION,counters:{versionUploadAttempts:1}});
  assert.equal(classify(await base(claims)).classification,TRANSPORT_REMEDIATED_OWNER_ATTENTION);
  const drifted=report({inventory:{versionInventoryExact:false}});
  assert.equal(classify({...await base(null),report:drifted}).classification,TRANSPORT_REMEDIATED_OWNER_ATTENTION);
  assert.equal(classify({...await base(null),deployments:activeDeploymentState({deployments:[]}),report:report({inventory:{deploymentCount:0}})}).classification,TRANSPORT_REMEDIATED_OWNER_ATTENTION);
});

// ---------------- read-only runners ----------------
function readEnv(overrides={}){
  return {DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID:ACCOUNT,DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT:FINGERPRINT,DATA_STEWARD_CLOUDFLARE_READ_TOKEN:READ,
    CLOUDFLARE_TOPOLOGY_READ_TOKEN:TOPOLOGY_TOKEN,APPROVED_SHA:SHA,...overrides};
}
function readOnlyFetch({deployments=[exactDeploymentRow],versions=[...TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS],details={},zones=true,routes=[]}={}){
  const calls=[];const read=transportRemediatedReadPaths(ACCOUNT);
  const json=body=>new Response(JSON.stringify({success:true,result:body}),{status:200});
  const fetchImpl=async(url,init={})=>{
    const method=String(init.method||'GET').toUpperCase(),requestPath=new URL(String(url)).pathname.slice('/client/v4'.length)+new URL(String(url)).search;
    calls.push({method,requestPath});
    if(method!=='GET')throw new Error('non-GET read request');
    if(requestPath.startsWith('/zones?'))return new Response(JSON.stringify({success:true,result:zones?[{id:'zone1',account:{id:ACCOUNT}}]:[],result_info:{total_pages:zones?1:0}}),{status:200});
    if(requestPath==='/zones/zone1/workers/routes')return json(routes);
    if(requestPath===read.deployments)return json({deployments});
    if(requestPath===read.versions)return json({items:versions.map(id=>({id}))});
    for(const [key,value] of Object.entries(details))if(requestPath.includes(key))return json(value);
    throw new Error('unexpected read '+requestPath);
  };
  return {fetchImpl,calls};
}

test('read-only admission accepts the exact known state and makes only GET requests',async()=>{
  const fake=readOnlyFetch();let preflightCalls=0;
  const result=await runTransportRemediatedAdmission({env:readEnv(),fetchImpl:fake.fetchImpl,preflight:async({env,stage})=>{preflightCalls+=1;assert.equal(stage,DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE);assert.equal(env.API_FOOTBALL_ATTENDED_VERSION_ID,ATTENDED_VERSION_ID);return report();}});
  assert.equal(preflightCalls,1);assert.equal(result.ok,true);assert.equal(result.classification,TRANSPORT_REMEDIATED_READY);assert.equal(result.reason,null);
  assert.deepEqual({...result.topology},ZONE);assert.equal(result.deployments.activeDeploymentId,EXISTING);assert.equal(result.evidence.productionMutations,0);
  assert.ok(fake.calls.every(c=>c.method==='GET'));assert.ok(fake.calls.some(c=>c.requestPath===transportRemediatedReadPaths(ACCOUNT).deployments));
  assert.equal(validateTransportRemediatedAdmissionHandoff(JSON.parse(JSON.stringify(result)),{approvedSha:SHA,accountFingerprint:FINGERPRINT}),true);
  // Same credential for read and topology is refused before any request.
  const calls=[];const refused=await runTransportRemediatedAdmission({env:{...readEnv(),CLOUDFLARE_TOPOLOGY_READ_TOKEN:READ},fetchImpl:async(...args)=>{calls.push(args);return new Response('{}');},preflight:async()=>{calls.push('preflight');return report();}});
  assert.equal(refused.ok,false);assert.deepEqual(calls,[]);
  // A route, an unreadable zone scan, an extra Deployment or a drifted preflight each stop admission.
  assert.equal((await runTransportRemediatedAdmission({env:readEnv(),fetchImpl:readOnlyFetch({routes:[{id:'r',pattern:'x/*',script:DEPLOYED_ONE_SHOT_WORKER}]}).fetchImpl,preflight:async()=>report()})).ok,false);
  assert.equal((await runTransportRemediatedAdmission({env:readEnv(),fetchImpl:readOnlyFetch({deployments:[{...exactDeploymentRow,id:'x'}]}).fetchImpl,preflight:async()=>report()})).ok,false);
  assert.equal((await runTransportRemediatedAdmission({env:readEnv(),fetchImpl:readOnlyFetch().fetchImpl,preflight:async()=>report({runtime:{collectionEnabled:1}})})).ok,false);
  const unreadableTopology=await runTransportRemediatedAdmission({env:readEnv(),fetchImpl:async(url,init)=>String(url).includes('/zones')?new Response('x',{status:500}):readOnlyFetch().fetchImpl(url,init),preflight:async()=>report()});
  assert.equal(unreadableTopology.reason,'zone_route_topology_unreadable');
});

test('read-only reconciliation reads only GET endpoints and classifies the exact prepared-not-deployed state',async()=>{
  const d=await candidateDetails(),a=attendedDetails();
  const read=transportRemediatedReadPaths(ACCOUNT);
  const details={
    [read.betaVersion(DEPLOYED_ONE_SHOT_WORKER_ID,NEW_VERSION)]:d.beta,[read.betaVersion(DEPLOYED_ONE_SHOT_WORKER_ID,ATTENDED_VERSION_ID)]:a.beta,
    [read.stableVersion(NEW_VERSION)]:d.stable,[read.stableVersion(ATTENDED_VERSION_ID)]:a.stable};
  const preparedFetch=()=>readOnlyFetch({versions:[...TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS,NEW_VERSION],details});
  const execution=buildTransportRemediatedExecutionEvidence({approvedSha:SHA,outcome:'CREATED',versionId:NEW_VERSION,counters:{versionUploadAttempts:1},identity:d.identity});
  const fourVersions=()=>report({inventory:{versionInventoryExact:false,versionIdentityExact:false,cloneVersionIdentityExact:false}});
  const fake=preparedFetch();
  const result=await runTransportRemediatedReconciliation({env:readEnv(),fetchImpl:fake.fetchImpl,execution,identity:d.identity,preflight:async()=>fourVersions()});
  assert.equal(result.ok,true);assert.equal(result.classification,TRANSPORT_REMEDIATED_PREPARED);assert.equal(result.candidateVersionId,NEW_VERSION);
  assert.equal(result.evidence.productionMutations,0);assert.equal(result.evidence.apiFootballRequests,0);assert.equal(result.evidence.secretValuesRead,0);
  assert.ok(fake.calls.every(c=>c.method==='GET'));assert.equal(result.observed.versionCount,4);assert.equal(result.observed.candidateVersionId,NEW_VERSION);
  assert.equal(result.observed.deployments.activeDeploymentId,EXISTING);assert.equal(result.observed.deployments.selectsRetainedVersionAt100,true);
  assert.ok(!JSON.stringify(result).includes(API_KEY)&&!JSON.stringify(result).includes(TRIGGER));
  // The Deployment moving to the new Version is detected from read-only state.
  const moved=await runTransportRemediatedReconciliation({env:readEnv(),execution,identity:d.identity,preflight:async()=>fourVersions(),
    fetchImpl:readOnlyFetch({versions:[...TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS,NEW_VERSION],details,deployments:[{...exactDeploymentRow,versions:[{version_id:NEW_VERSION,percentage:100}]}]}).fetchImpl});
  assert.equal(moved.ok,false);assert.equal(moved.reason,'deployment_identity_unexpected');
  const routed=await runTransportRemediatedReconciliation({env:readEnv(),execution,identity:d.identity,preflight:async()=>fourVersions(),
    fetchImpl:readOnlyFetch({versions:[...TRANSPORT_REMEDIATED_HISTORICAL_VERSION_IDS,NEW_VERSION],details,routes:[{id:'r',pattern:'x/*',script:DEPLOYED_ONE_SHOT_WORKER}]}).fetchImpl});
  assert.equal(routed.ok,false);assert.equal(routed.reason,'route_present_or_unproven');
  // Clean stop: no Version created, execution stopped before upload.
  const stopExecution=buildTransportRemediatedExecutionEvidence({approvedSha:SHA,diagnostic:'TRANSPORT_REMEDIATED_X'});
  const clean=await runTransportRemediatedReconciliation({env:readEnv(),fetchImpl:readOnlyFetch().fetchImpl,execution:stopExecution,preflight:async()=>report()});
  assert.equal(clean.classification,TRANSPORT_REMEDIATED_CLEAN_STOP);assert.equal(clean.ok,false);assert.equal(clean.reason,'stopped_before_upload');
  const noIdentity=await runTransportRemediatedReconciliation({env:{...readEnv(),DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT:'x'},fetchImpl:fake.fetchImpl});
  assert.equal(noIdentity.reason,'reconciliation_identity_invalid');
});

// ---------------- workflow structure ----------------
test('the remediated Version preparation workflow is dormant, manual, first-attempt-only, pinned and least-privilege',()=>{
  const source=read('.github/workflows/api-football-remediated-version-preparation.yml');
  assert.match(source,/^name: API-Football Transport-Remediated Reviewed Version Preparation$/m);
  assert.match(source,/^on:\n  workflow_dispatch:\n    inputs:\n      approved_sha:/m);
  assert.doesNotMatch(source,/^\s{2}(?:schedule|push|pull_request|pull_request_target|workflow_run|repository_dispatch|workflow_call):/m);
  assert.equal([...source.matchAll(/github\.run_attempt == 1/g)].length,4);
  assert.match(source,/test "\$EVENT_REF" = refs\/heads\/main/);assert.match(source,/test "\$EVENT_SHA" = "\$APPROVED_SHA"/);
  assert.match(source,/Tests and deterministic build/);
  for(const action of source.matchAll(/uses: ([^\s]+)/g))assert.match(action[1],/@[0-9a-f]{40}$/);
  assert.match(source,/permissions:\n  contents: read\n  actions: read\n  checks: read/);
  assert.match(source,/cancel-in-progress: false/);
  for(const environment of ['data-steward-readonly','api-football-remediated-version-upload'])assert.match(source,new RegExp('name: '+environment));
  assert.equal([...source.matchAll(/environment:/g)].length,3);
  assert.match(source,/run-transport-remediated-version-upload\.mjs/);assert.match(source,/transport-remediated-version-readonly\.mjs/);
  assert.match(source,/api-football-transport-remediated-admission/);assert.match(source,/api-football-transport-remediated-execution/);
  assert.match(source,/EXPECTED_ARTIFACT_SHA256/);assert.match(source,/sha256sum/);
  assert.doesNotMatch(source.replace(/^\s*#.*$/gm,''),/x-apisports-key|v3\.football\.api-sports\.io|wrangler|\/deployments|\/subdomain|workers\.dev|CLOUDFLARE_ATTENDED_MUTATION_TOKEN|CLOUDFLARE_ATTENDED_D1_MUTATION_TOKEN|D1_WRITE|x-teamsheet-attended-trigger|method:\s*DELETE/i);
  // Mutation credentials and secret binding values appear only in the protected job.
  const jobs=source.split(/\n  (?=[a-z-]+:\n    (?:if|needs|runs-on))/);
  const protectedJob=jobs.find(job=>job.startsWith('protected-version-upload:'));assert.ok(protectedJob);
  for(const job of jobs.filter(job=>job!==protectedJob&&!/^(?:name|on|permissions|concurrency|jobs)/.test(job)&&/^[a-z-]+:/.test(job)))
    assert.doesNotMatch(job,/CLOUDFLARE_ATTENDED_VERSION_UPLOAD_TOKEN|secrets\.API_FOOTBALL_API_KEY|API_FOOTBALL_ATTENDED_TRIGGER_SECRET/,job.split('\n')[0]);
  assert.match(protectedJob,/CLOUDFLARE_ATTENDED_VERSION_UPLOAD_TOKEN: \$\{\{ secrets\.CLOUDFLARE_ATTENDED_VERSION_UPLOAD_TOKEN \}\}/);
  assert.match(protectedJob,/CLOUDFLARE_ATTENDED_READ_TOKEN/);assert.match(protectedJob,/CLOUDFLARE_REPLACEMENT_TOPOLOGY_READ_TOKEN/);
  assert.match(source,/needs\.fresh-readonly-admission\.outputs\.classification == 'READY_FOR_TRANSPORT_REMEDIATED_VERSION_UPLOAD'/);
  assert.match(source,/final-readonly-reconciliation:\n    if: \$\{\{ always\(\)/);
});

test('this checkpoint adds no live path to historical contracts: old workflows and builders are unchanged in behaviour',()=>{
  assert.equal(ATTENDED_VERSION_ID,'04d79556-3070-429f-9944-b5b53d799842');assert.equal(ATTENDED_VERSION_APPROVED_SHA,'69bb84fadbcce94e9fece3ff438d985866cce183');
  assert.equal(EXISTING,'2417a3e0-15db-4e45-a3c8-00b148a300f4');assert.equal(GATE_C_CLONE_VERSION_ID,'7405abc0-8358-4156-8226-b6cc7bcf244f');
  const continuation=read('.github/workflows/api-football-deployed-one-shot-continuation.yml');
  assert.doesNotMatch(continuation,/transport-remediated/);
  for(const file of ['attended-version.mjs','stage-inactive-version.mjs','deployed-one-shot.mjs','run-deployed-one-shot-continuation.mjs'])
    assert.doesNotMatch(read('workers/api-football-collector/'+file),/transport-remediated|TRANSPORT_REMEDIATED/,file);
  // The production application graph does not import the new modules.
  for(const file of ['src/main.mjs','src/providers/registry.mjs','build.mjs'])assert.doesNotMatch(read(file),/transport-remediated/i,file);
});
