// Offline regression contract for a FUTURE corrected R1/R2 Worker Version. No live Cloudflare/D1/provider calls.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {expectedAttendedBindings,ATTENDED_VERSION_ID} from '../workers/api-football-collector/attended-version.mjs';
import {CORRECTED_VERSION_CANDIDATE_MODULE_SHA256,buildCorrectedVersionCandidateIdentity,readCorrectedCandidateModuleSource} from '../workers/api-football-collector/corrected-version-candidate.mjs';
import {REVIEWED_MODULE_PATHS} from '../workers/api-football-collector/stage-inactive-version.mjs';
import {readReviewedRemediatedModuleSource} from '../workers/api-football-collector/reviewed-remediated-snapshots.mjs';
import {GATE_C_ACTIVE_DEPLOYMENT_ID} from '../workers/api-football-collector/gate-c.mjs';
import {DEPLOYED_ONE_SHOT_CLONE_APPROVED_SHA,DEPLOYED_ONE_SHOT_VERSION_APPROVED_SHA,DEPLOYED_ONE_SHOT_CLONE_VERSION_ID,
  DEPLOYED_ONE_SHOT_VERSION_ID,DEPLOYED_ONE_SHOT_WORKER_ID,DEPLOYED_ONE_SHOT_EXISTING_DEPLOYMENT_ID,
  DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE,DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_STOP,
  DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_REASON} from '../workers/api-football-collector/deployed-one-shot.mjs';
import {PROMOTION_CANDIDATE_VERSION_ID,promotionDeploymentRows} from '../workers/api-football-collector/transport-remediated-deployment-promotion.mjs';
import {CORRECTED_EXPECTED_HISTORY,CORRECTED_HISTORICAL_VERSION_IDS,CORRECTED_READY,CORRECTED_PREPARED,
  buildCorrectedVersionIdentity,buildCorrectedUploadForm,buildCorrectedAdmission,validateCorrectedAdmission,
  validateCorrectedVersion,correctedHistoryDiagnostic,correctedAdmissionDiagnostic,submitCorrectedVersionOnce,
  classifyCorrectedReconciliation} from '../workers/api-football-collector/corrected-version-preparation.mjs';
import {CORRECTED_HISTORY_QUERY,readCorrectedHistoryDetail} from '../workers/api-football-collector/corrected-version-readonly.mjs';
import {createCorrectedGuardedFetch} from '../workers/api-football-collector/run-corrected-version-upload.mjs';

const root=path.resolve(import.meta.dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sha=x=>createHash('sha256').update(x).digest('hex');
const SHA='b'.repeat(40),ACCOUNT='test-account',FINGERPRINT=sha(ACCOUNT);
const ID='11111111-2222-4333-8444-555555555555',API_KEY='synthetic-api-key-material',TRIGGER='synthetic-secret-trigger-material-0123456789';
const ZONE={proof:'ZONE_ROUTE_SCAN',zoneCount:1,routeRowCount:0,routeCount:0};
const detail={totalMemberships:824,failedMemberships:824,committedMemberships:0,orphanMemberships:0,
  mismatchedMembershipRevisions:0,discoveryHeads:0,october8Attempts:4,october8Succeeded:3,
  october8SchemaFailures:1,failedGenerationMemberships:1,quotaState:'QUOTA_UNCERTAIN'};
const deployments=promotionDeploymentRows({deployments:[
  {id:GATE_C_ACTIVE_DEPLOYMENT_ID,created_on:'2026-10-08T09:00:00Z',strategy:'percentage',versions:[{version_id:PROMOTION_CANDIDATE_VERSION_ID,percentage:100}]},
  {id:DEPLOYED_ONE_SHOT_EXISTING_DEPLOYMENT_ID,created_on:'2026-10-06T09:00:00Z',strategy:'percentage',versions:[{version_id:ATTENDED_VERSION_ID,percentage:100}]}
]});
const versions={versionIds:[...CORRECTED_HISTORICAL_VERSION_IDS],identityExact:true};
function report(changes={}){
  const b={ok:false,stage:DEPLOYED_ONE_SHOT_PREFLIGHT_STAGE,
    classification:DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_STOP,reason:DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_REASON,
    approvedSha:SHA,versionApprovedSha:DEPLOYED_ONE_SHOT_VERSION_APPROVED_SHA,cloneApprovedSha:DEPLOYED_ONE_SHOT_CLONE_APPROVED_SHA,
    accountFingerprint:FINGERPRINT,migrationCount:6,foreignKeyViolations:0,
    officialFplAuthority:{valid:true,teamCount:20},
    mapping:{state:'COMMITTED',mappingCount:20,memberCount:20,distinctProviderIds:20,distinctFplIds:20,canonicalCoverageMatches:true,historicalAuthorityProvenancePresent:true},
    inventory:{activation:'ATTENDED_ONE_SHOT_DISCOVERY',databaseIdPlaceholder:false,productionBindingProven:true,configurationExact:true,
      workerPresent:true,deploymentCount:2,cronCount:0,routeCount:0,customDomainCount:0,workersDev:false,previewUrls:false,
      reviewedVersionId:DEPLOYED_ONE_SHOT_VERSION_ID,reviewedWorkerId:DEPLOYED_ONE_SHOT_WORKER_ID,
      secretBindingPresent:true,secretBindingNames:['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET'],
      accountSubdomain:'fpltsheet',previewUrlIdentityExact:true},
    runtime:{collectionEnabled:0,credentialState:'AVAILABLE',activeLease:false},
    priorState:{...CORRECTED_EXPECTED_HISTORY},modelUiImportCount:0,rawPayloadStoragePresent:false,
    evidence:{productionMutations:0,apiFootballRequests:0,secretValuesRead:0}};
  return {...b,...changes,priorState:{...b.priorState,...changes.priorState},inventory:{...b.inventory,...changes.inventory},
    runtime:{...b.runtime,...changes.runtime}};
}
const source=()=>buildCorrectedVersionIdentity(SHA);
const state=()=>({report:report(),detail:{...detail},versions:{...versions,versionIds:[...versions.versionIds]},
  deployments:structuredClone(deployments),topology:{...ZONE},approvedSha:SHA,accountFingerprint:FINGERPRINT});
const admit=()=>buildCorrectedAdmission(state());
const b64=x=>Buffer.from(x).toString('base64');
async function candidateVersion(id=ID){
  const identity=source(),form=buildCorrectedUploadForm(identity,{apiKey:API_KEY,triggerSecret:TRIGGER});
  const modules=[];
  for(const [name,file] of form.entries())if(name!=='metadata')modules.push({name,content_base64:b64(await file.text())});
  return {stable:{id,resources:{script_runtime:{compatibility_date:'2026-09-16'},bindings:expectedAttendedBindings().map(x=>({...x}))}},
    beta:{id,main_module:'collector.mjs',compatibility_date:'2026-09-16',annotations:identity.metadata.annotations,urls:[],modules}};
}

test('source identity is exactly 17 pinned corrected current-tree modules and a distinct full creation SHA',()=>{
  const one=source(),two=source(),later=buildCorrectedVersionIdentity('c'.repeat(40));
  assert.equal(one.graphSha256,two.graphSha256);assert.notEqual(one.graphSha256,later.graphSha256);
  assert.notEqual(one.metadataSha256,later.metadataSha256);
  assert.equal(one.creationSha,SHA);assert.equal(Object.keys(one.moduleSha256).length,17);
  assert.deepEqual(one.moduleSha256,buildCorrectedVersionCandidateIdentity().moduleSha256);
  assert.deepEqual(one.moduleSha256,CORRECTED_VERSION_CANDIDATE_MODULE_SHA256);
  assert.equal(one.uploadAuthorized,false);assert.equal(one.deploymentAuthorized,false);
  assert.throws(()=>buildCorrectedVersionIdentity('bad'),/creation_sha_invalid/);
});
test('historical snapshot substitution is rejected and only the five reviewed corrected modules differ',()=>{
  const changes=REVIEWED_MODULE_PATHS.filter(p=>readCorrectedCandidateModuleSource(p)!==readReviewedRemediatedModuleSource(p));
  assert.deepEqual(changes.sort(),[
    'workers/api-football-collector/activation-orchestrator.mjs','workers/api-football-collector/collector.mjs',
    'workers/api-football-collector/planner-orchestrator.mjs','workers/api-football-collector/runtime-contracts.mjs',
    'workers/api-football-collector/semantic-validation.mjs'
  ].sort());
  assert.throws(()=>buildCorrectedVersionCandidateIdentity({readFile:readReviewedRemediatedModuleSource}),/source_drift/);
});
test('upload form contains exactly pinned module bytes and only secret names appear in public identity',async()=>{
  const identity=source(),form=buildCorrectedUploadForm(identity,{apiKey:API_KEY,triggerSecret:TRIGGER}),hashes={};
  for(const [name,item] of form.entries())if(name!=='metadata')hashes[name]=sha(await item.text());
  assert.deepEqual(hashes,identity.moduleSha256);assert.equal(Object.keys(hashes).length,17);
  assert.doesNotMatch(JSON.stringify(identity),/synthetic-api-key|synthetic-secret-trigger/);
  const metadata=JSON.parse(form.get('metadata'));assert.equal(metadata.bindings.filter(x=>x.type==='secret_text').length,2);
  assert.ok(metadata.bindings.some(x=>x.name==='API_FOOTBALL_API_KEY'&&x.text===API_KEY));
  assert.throws(()=>buildCorrectedUploadForm(identity,{apiKey:API_KEY,triggerSecret:'short'}),/secret_invalid/);
});
test('corrected Version validates independent module bytes, immutable SHA and metadata',async()=>{
  const v=await candidateVersion();assert.equal(validateCorrectedVersion({...v,versionId:ID,identity:source()}),true);
  const bad=structuredClone(v);bad.beta.modules[0].content_base64=b64('corrupted');
  assert.throws(()=>validateCorrectedVersion({...bad,versionId:ID,identity:source()}),/module_drift/);
  const wrong=structuredClone(v);wrong.beta.annotations['workers/tag']='wrong';
  assert.throws(()=>validateCorrectedVersion({...wrong,versionId:ID,identity:source()}),/metadata_drift/);
  const leaked=structuredClone(v);leaked.stable.resources.bindings.find(x=>x.type==='secret_text').text=API_KEY;
  assert.throws(()=>validateCorrectedVersion({...leaked,versionId:ID,identity:source()}),/bindings_drift/);
  assert.throws(()=>validateCorrectedVersion({...v,versionId:CORRECTED_HISTORICAL_VERSION_IDS[0],identity:source()}),/identity_invalid/);
});
test('history requires two failed generations, 5 attempts, exact 824 memberships, zero committed heads',()=>{
  assert.equal(correctedHistoryDiagnostic(CORRECTED_EXPECTED_HISTORY,detail),null);
  for(const [k,value] of [['requestAttempts',4],['failedGenerationCount',1],['fixtureRevisions',0],['committedGenerationCount',1]]){
    assert.notEqual(correctedHistoryDiagnostic({...CORRECTED_EXPECTED_HISTORY,[k]:value},detail),null);
  }
  for(const [k,value] of [['totalMemberships',823],['failedMemberships',823],['discoveryHeads',1],
    ['mismatchedMembershipRevisions',1],['october8Attempts',5],['failedGenerationMemberships',2],['quotaState','KNOWN']])
    assert.notEqual(correctedHistoryDiagnostic(CORRECTED_EXPECTED_HISTORY,{...detail,[k]:value}),null);
});
test('new admission accepts only strict four-Version/two-Deployment inert non-pristine state',()=>{
  const a=admit();assert.equal(a.ok,true,a.reason);assert.equal(a.classification,CORRECTED_READY);
  assert.equal(validateCorrectedAdmission(a,{approvedSha:SHA,accountFingerprint:FINGERPRINT}),true);
  assert.equal(correctedAdmissionDiagnostic(state()),null);
  assert.notEqual(buildCorrectedAdmission({...state(),versions:{versionIds:versions.versionIds.slice(1),identityExact:true}}).reason,null);
  assert.notEqual(buildCorrectedAdmission({...state(),topology:{...ZONE,routeCount:1}}).reason,null);
  assert.notEqual(buildCorrectedAdmission({...state(),report:report({inventory:{workersDev:true}})}).reason,null);
  assert.notEqual(buildCorrectedAdmission({...state(),report:report({runtime:{collectionEnabled:1}})}).reason,null);
});
test('admission handoff is bound to approved SHA, exact history and topology and never grants retry',()=>{
  const a=admit();assert.equal(a.retryAuthorized,false);assert.equal(a.evidence.productionMutations,0);
  assert.throws(()=>validateCorrectedAdmission(a,{approvedSha:'c'.repeat(40),accountFingerprint:FINGERPRINT}),/handoff_invalid/);
  assert.throws(()=>validateCorrectedAdmission({...a,detail:{...detail,discoveryHeads:1}},{approvedSha:SHA,accountFingerprint:FINGERPRINT}),/handoff_invalid/);
});
test('once-only upload readback: success, ambiguity, absent and invalid inventory never retry',async()=>{
  const base=[...CORRECTED_HISTORICAL_VERSION_IDS];let count=0;
  const created=await submitCorrectedVersionOnce({beforeIds:base,post:async()=>{count++;return {kind:'OK',result:{id:ID}};},
    readVersions:async()=>[...base,ID],wait:async()=>{}});assert.equal(created.outcome,'CREATED');assert.equal(count,1);
  const ambiguous=await submitCorrectedVersionOnce({beforeIds:base,post:async()=>{count++;throw new Error('network');},
    readVersions:async()=>[...base,ID],wait:async()=>{}});assert.equal(ambiguous.outcome,'APPLIED_CONFIRMED_BY_READBACK');assert.equal(count,2);
  const absent=await submitCorrectedVersionOnce({beforeIds:base,post:async()=>{count++;throw new Error('network');},
    readVersions:async()=>base,wait:async()=>{}});assert.equal(absent.outcome,'AMBIGUOUS_OWNER_ATTENTION');assert.equal(absent.readbackAttempts,3);
  assert.equal(count,3);
  const invalid=await submitCorrectedVersionOnce({beforeIds:base,post:async()=>{count++;return {kind:'OK',result:{id:ID}};},
    readVersions:async()=>[...base,ID,ID],wait:async()=>{}});assert.equal(invalid.outcome,'AMBIGUOUS_OWNER_ATTENTION');
  assert.equal(count,4);
  assert.equal((await submitCorrectedVersionOnce({beforeIds:base,post:async()=>({kind:'REJECTED'}),
    readVersions:async()=>{throw new Error('should not read');}})).outcome,'REJECTED');
});
test('guarded executor permits only GET inventory/zone and the one exact POST with the upload token',async()=>{
  let calls=0;
  const form=new FormData(),guard=createCorrectedGuardedFetch({accountId:ACCOUNT,readToken:'read',uploadToken:'upload',
    topologyToken:'topology',uploadForm:form,fetchImpl:async()=>{calls++;return {ok:true,status:200,json:async()=>({success:true,result:{}})};}});
  const doFetch=guard.fetch;
  const url='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/workers/scripts/teamsheet-api-football-shadow-collector/versions';
  await assert.rejects(()=>doFetch('https://v3.football.api-sports.io/fixtures',{method:'GET'}),/EGRESS_FORBIDDEN/);
  await assert.rejects(()=>doFetch(url.replace('/versions','/deployments'),{method:'POST',headers:{Authorization:'Bearer upload'},body:form}),/EGRESS_FORBIDDEN/);
  await assert.rejects(()=>doFetch(url,{method:'POST',headers:{Authorization:'Bearer read'},body:form}),/EGRESS_FORBIDDEN/);
  await assert.rejects(()=>doFetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/d1/database/xyz/query',
    {method:'POST',headers:{Authorization:'Bearer read'}}),/EGRESS_FORBIDDEN/);
  await doFetch(url,{method:'POST',headers:{Authorization:'Bearer upload'},body:form});
  await assert.rejects(()=>doFetch(url,{method:'POST',headers:{Authorization:'Bearer upload'},body:form}),/EGRESS_FORBIDDEN/);
  assert.equal(calls,1);assert.equal(guard.counters.versionUploadAttempts,1);
});
test('read-only D1 detail query is fixed SELECT-only SQL and never exposes secrets or provider response',async()=>{
  assert.match(CORRECTED_HISTORY_QUERY,/SELECT/);assert.doesNotMatch(CORRECTED_HISTORY_QUERY,/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER)\b/i);
  let calls=0;
  const output=await readCorrectedHistoryDetail({accountId:ACCOUNT,readToken:'readonly',fetchImpl:async(url,init)=>{
    calls++;assert.equal(init.method,'POST');assert.match(url,/\/d1\/database\//);
    assert.equal(JSON.parse(init.body).sql,CORRECTED_HISTORY_QUERY);
    return {ok:true,status:200,json:async()=>({success:true,result:[{results:[{...detail}]}]})};
  }});
  assert.deepEqual({...output},detail);assert.equal(calls,1);
});
test('independent reconciliation accepts five exact Versions but unchanged two Deployments and failed-generation state',async()=>{
  const admission=admit(),identity=source(),candidate=await candidateVersion();
  const created={version: 'api-football-corrected-r1-r2-version-execution-v1',approvedSha:SHA,
    identity:{creationSha:identity.creationSha,graphSha256:identity.graphSha256,metadataSha256:identity.metadataSha256,moduleCount:17},
    admission,versionUploadAttempts:1,productionMutations:1,outcome:'CREATED',versionId:ID,retryAuthorized:false,
    deploymentMutations:0,d1Mutations:0,workersDevMutations:0,previewMutations:0,cronMutations:0,
    routeMutations:0,domainMutations:0,workerInvocations:0,apiFootballRequests:0,secretValuesSerialized:0};
  const fields={admission,report:report(),detail,deployments,topology:ZONE,
    versions:{versionIds:[...CORRECTED_HISTORICAL_VERSION_IDS,ID],identityExact:true,candidate},
    created,identity,approvedSha:SHA,accountFingerprint:FINGERPRINT};
  const ok=classifyCorrectedReconciliation(fields);
  assert.equal(ok.classification,CORRECTED_PREPARED,ok.reason);assert.equal(ok.ok,true);assert.equal(ok.retryAuthorized,false);
  assert.equal(classifyCorrectedReconciliation({...fields,deployments:deployments.slice(1)}).ok,false);
  assert.equal(classifyCorrectedReconciliation({...fields,created:{...created,productionMutations:2}}).ok,false);
  assert.equal(classifyCorrectedReconciliation({...fields,created:{...created,identity:{...created.identity,creationSha:'a'.repeat(40)}}}).ok,false);
  assert.equal(classifyCorrectedReconciliation({...fields,versions:{...fields.versions,versionIds:CORRECTED_HISTORICAL_VERSION_IDS}}).ok,false);
  assert.equal(classifyCorrectedReconciliation({...fields,detail:{...detail,totalMemberships:823}}).ok,false);
});
test('workflow is distinct, manual only, first attempt only and carries no live trigger or deployment mutation',()=>{
  const text=read('.github/workflows/api-football-corrected-version-preparation.yml');
  assert.match(text,/workflow_dispatch:/);assert.doesNotMatch(text,/^\s+(push|schedule|pull_request):/m);
  assert.match(text,/github\.run_attempt == 1/);assert.match(text,/api-football-corrected-version-upload/);
  assert.match(text,/data-steward-readonly/);assert.match(text,/CORRECTED_ADMISSION_SHA256/);
  assert.doesNotMatch(text,/CLOUDFLARE_ATTENDED_MUTATION_TOKEN|CLOUDFLARE_REMEDIATED_DEPLOYMENT_PROMOTION_TOKEN/);
  assert.doesNotMatch(text,/api-football-gate-c-new-day-collection\.yml|run-gate-c\.mjs/);
});
function stepOutputHandoffs(text){
  const steps=text.split(/\n(?=      - )/);
  const referenced=new Set([...text.matchAll(/steps\.([\w-]+)\.outputs\.(\w+)/g)].map(m=>m[1]+'.'+m[2]));
  const problems=[];
  for(const ref of referenced){
    const [id,name]=ref.split('.');
    const step=steps.find(s=>new RegExp('^      - (?:[^\\n]*\\n\\s+)?id: '+id+'\\s*$','m').test(s)||new RegExp('^\\s+id: '+id+'\\s*$','m').test(s));
    if(!step){problems.push(ref+':step_missing');continue;}
    const writes=/GITHUB_OUTPUT/.test(step)&&new RegExp('(?:\\\\n|[\'"\\s])'+name+'=').test(step);
    if(!writes)problems.push(ref+':not_written');
  }
  return problems;
}
test('every steps.<id>.outputs.<name> consumed by the corrected preparation workflow is written to GITHUB_OUTPUT by that step',()=>{
  assert.deepEqual(stepOutputHandoffs(read('.github/workflows/api-football-corrected-version-preparation.yml')),[]);
  assert.deepEqual(stepOutputHandoffs(read('.github/workflows/api-football-corrected-version-readonly-admission.yml')),[]);
});
test('repository-gate approved_sha handoff is written only after every identity validation check',()=>{
  const text=read('.github/workflows/api-football-corrected-version-preparation.yml');
  const identity=text.slice(text.indexOf('- id: identity'),text.indexOf('- name: Require exact-main Verify Teamsheet success'));
  const write=identity.indexOf('echo "approved_sha=$APPROVED_SHA" >> "$GITHUB_OUTPUT"');
  assert.ok(write>0,'approved_sha must be written to GITHUB_OUTPUT');
  for(const check of ['test "$EVENT_NAME" = workflow_dispatch','test "$RUN_ATTEMPT" = 1','test "$EVENT_REF" = refs/heads/main',"grep -Eq '^[0-9a-f]{40}$'",'test "$EVENT_SHA" = "$APPROVED_SHA"','test "$(git rev-parse HEAD)" = "$APPROVED_SHA"','git ls-remote'])
    assert.ok(identity.indexOf(check)>=0&&identity.indexOf(check)<write,check+' must precede the output write');
  assert.equal(identity.split('GITHUB_OUTPUT').length-1,1);
  assert.match(text,/approved_sha: \$\{\{ steps\.identity\.outputs\.approved_sha \}\}/);
});
test('stepOutputHandoffs detector fails when the identity output write is removed',()=>{
  const text=read('.github/workflows/api-football-corrected-version-preparation.yml').replace('          echo "approved_sha=$APPROVED_SHA" >> "$GITHUB_OUTPUT"\n','');
  assert.deepEqual(stepOutputHandoffs(text),['identity.approved_sha:not_written']);
});
test('protected upload job maps CLOUDFLARE_TOPOLOGY_READ_TOKEN from the replacement topology secret only',()=>{
  const text=read('.github/workflows/api-football-corrected-version-preparation.yml');
  const job=text.slice(text.indexOf('  protected-version-upload:'),text.indexOf('  final-readonly-reconciliation:'));
  assert.ok(job.length>0,'upload job slice must exist');
  assert.equal(job.split('CLOUDFLARE_TOPOLOGY_READ_TOKEN: ').length-1,1,'exactly one topology token mapping in the upload job');
  assert.match(job,/CLOUDFLARE_TOPOLOGY_READ_TOKEN: \$\{\{ secrets\.CLOUDFLARE_REPLACEMENT_TOPOLOGY_READ_TOKEN \}\}/);
  assert.doesNotMatch(text,/secrets\.CLOUDFLARE_TOPOLOGY_READ_TOKEN\b/);
});

// ---- Forensic sub-reason diagnostics (run 37841681952 reported only the aggregate corrected_version_byte_or_metadata_drift) ----
const reasonOf=(mutate)=>candidateVersion().then(v=>{const x=structuredClone(v);mutate(x);
  try{validateCorrectedVersion({...x,versionId:ID,identity:source()});return null;}catch(e){return e.message;}});
test('rejections carry one closed sanitised sub-reason and the exact valid response is still accepted',async()=>{
  assert.equal(await reasonOf(()=>{}),null);
  const cases=[
    [x=>{x.beta.modules[0].content_base64=b64('corrupted');},'module_content_mismatch'],
    [x=>{x.beta.modules.pop();},'module_count_mismatch'],
    [x=>{x.beta.modules[1].name='modules/unexpected.mjs';},'module_unexpected'],
    [x=>{x.beta.modules[1]={...x.beta.modules[0]};},'module_name_duplicate'],
    [x=>{x.beta.modules[0].content_base64=undefined;},'module_content_encoding_invalid'],
    [x=>{delete x.beta.modules;},'modules_response_incomplete'],
    [x=>{x.stable.resources.script_runtime.compatibility_date='2026-01-01';},'runtime_compatibility_date_mismatch'],
    [x=>{x.beta.compatibility_date='2026-01-01';},'beta_compatibility_date_mismatch'],
    [x=>{delete x.beta.compatibility_date;},'version_response_incomplete'],
    [x=>{x.beta.main_module='other.mjs';},'main_module_mismatch'],
    [x=>{x.beta.annotations['workers/tag']='wrong';},'annotations_mismatch'],
    [x=>{x.stable.resources.bindings.pop();},'binding_count_mismatch'],
    [x=>{x.stable.resources.bindings.find(b=>b.type==='d1').database_id='x';},'d1_binding_identity_mismatch'],
    [x=>{x.stable.resources.bindings.find(b=>b.type==='secret_text').text=API_KEY;},'secret_binding_value_exposed'],
    [x=>{delete x.stable.resources.bindings;},'bindings_response_incomplete'],
    [x=>{x.beta.urls=['https://x'];},'version_url_present'],
    [x=>{x.beta.package_dependencies=[{}];},'external_dependency_present']
  ];
  for(const [mutate,token] of cases){
    const message=await reasonOf(mutate);
    assert.match(message,new RegExp('__'+token+'$'),token);
    for(const secret of [API_KEY,TRIGGER,ACCOUNT])assert.equal(message.includes(secret),false);
  }
});
test('reconciliation surfaces the closed sub-reason, flags missing evidence separately and never claims success',async()=>{
  const identity=source(),admission=admit();
  const v=await candidateVersion();v.beta.annotations={...v.beta.annotations,'workers/tag':'wrong'};
  const created={version:'api-football-corrected-r1-r2-version-execution-v1',approvedSha:SHA,retryAuthorized:false,versionUploadAttempts:1,
    productionMutations:1,identity:{creationSha:SHA,graphSha256:identity.graphSha256,metadataSha256:identity.metadataSha256,moduleCount:17},
    admission,deploymentMutations:0,d1Mutations:0,workersDevMutations:0,previewMutations:0,cronMutations:0,routeMutations:0,
    domainMutations:0,workerInvocations:0,apiFootballRequests:0,secretValuesSerialized:0,outcome:'CREATED',versionId:ID};
  const input=cand=>({admission,report:admission.preflight,detail:admission.detail,deployments:admission.deployments,topology:admission.topology,
    versions:{versionIds:[...CORRECTED_HISTORICAL_VERSION_IDS,ID],identityExact:true,candidate:cand},created,identity,approvedSha:SHA,accountFingerprint:FINGERPRINT});
  const bad=classifyCorrectedReconciliation(input(v));
  assert.equal(bad.ok,false);assert.equal(bad.reason,'corrected_version_byte_or_metadata_drift:annotations_mismatch');
  for(const cand of [null,{stable:null,beta:null}]){
    const r=classifyCorrectedReconciliation(input(cand));assert.equal(r.ok,false);assert.equal(r.reason,'corrected_version_evidence_unavailable');
  }
  const good=classifyCorrectedReconciliation(input(await candidateVersion()));
  assert.equal(good.ok,true);assert.equal(good.retryAuthorized,false);
});
