import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {classifyCollectorActivationPreflight,COLLECTOR_ACTIVATION_PREFLIGHT_VERSION} from '../workers/api-football-collector/activation-preflight.mjs';
import {ATTENDED_ACCEPTANCE_PATH,runAttendedHttpRequest} from '../workers/api-football-collector/collector.mjs';
import {
  ATTENDED_CONTROL_MAX_D1_CALLS,ATTENDED_CONTROL_MAX_D1_STATEMENTS,ATTENDED_CONTROL_MAX_ROWS_CHANGED,
  credentialLifecycleMutation,runAttendedAcceptance
} from '../workers/api-football-collector/attended-acceptance.mjs';
import {classifyAttendedReconciliation} from '../workers/api-football-collector/attended-reconciliation.mjs';
import {
  ATTENDED_VERSION_APPROVED_SHA,ATTENDED_VERSION_MODULE_SHA256,ORIGINAL_BLOCKED_VERSION_ID,buildAttendedVersionUploadForm,buildImmutableAttendedVersionIdentity,buildReviewedAttendedIdentity,deriveVersionPreviewUrl,
  expectedAttendedBindings,prepareFinalAttendedVersion,validateClosedVersionInventory,validateReviewedAttendedVersion
} from '../workers/api-football-collector/attended-version.mjs';
import {attendedCloudflarePaths,assertAttendedCloudflareRequestAllowed,executeLiveAttendedAcceptance} from '../workers/api-football-collector/run-attended-acceptance.mjs';
import {MutationAmbiguousError,buildUploadModules,resolveModuleGraph} from '../workers/api-football-collector/stage-inactive-version.mjs';
import {EXPECTED_D1_DATABASE_ID} from '../workers/data-platform/phase4b/live-contract.mjs';

const root=path.resolve(import.meta.dirname,'..');
const NOW='2026-09-21T12:00:00.000Z',SHA='a'.repeat(40),VERSION='11111111-1111-4111-8111-111111111111',VERSION_PROVENANCE=ATTENDED_VERSION_APPROVED_SHA;
const ACCOUNT='production-account',FINGERPRINT=createHash('sha256').update(ACCOUNT).digest('hex'),SECRET='x'.repeat(64);
const request=(method='POST',route=ATTENDED_ACCEPTANCE_PATH,secret=SECRET)=>new Request('https://preview.invalid'+route,{method,headers:{'x-teamsheet-attended-trigger':secret}});
const identity=buildReviewedAttendedIdentity(SHA),modules=buildUploadModules(resolveModuleGraph());
function attendedStable(){return {id:VERSION,resources:{script_runtime:{compatibility_date:identity.compatibilityDate},bindings:structuredClone(expectedAttendedBindings())}};}
function attendedBeta(){return {id:VERSION,main_module:identity.mainModule,compatibility_date:identity.compatibilityDate,annotations:{'workers/message':identity.message,'workers/tag':identity.tag},modules:[...modules].map(([name,source])=>({name,content_base64:Buffer.from(source).toString('base64')}))};}
function originalStable(){return {id:ORIGINAL_BLOCKED_VERSION_ID,resources:{bindings:[
  {name:'TEAMSHEET_DATA_DB',type:'d1',database_id:EXPECTED_D1_DATABASE_ID},{name:'API_FOOTBALL_FPL_SEASON',type:'plain_text',text:'2026-27'},
  {name:'API_FOOTBALL_PROVIDER_SEASON',type:'plain_text',text:'2026'},{name:'EIA_2I5D_ACTIVATION',type:'plain_text',text:'REPOSITORY_ONLY_BLOCKED'}]}};}
function admission(){return {ok:true,approvedSha:SHA,versionApprovedSha:VERSION_PROVENANCE,accountFingerprint:FINGERPRINT,observedAt:NOW,stage:'ATTENDED_ACCEPTANCE',classification:'READY_FOR_SEPARATELY_APPROVED_ATTENDED_ACCEPTANCE',inventory:{reviewedVersionId:VERSION,versionIdentityExact:true,versionInventoryExact:true},runtime:{collectionEnabled:0,credentialState:'AVAILABLE',activeLease:false},evidence:{observedAt:NOW,productionMutations:0,apiFootballRequests:0,secretValuesRead:0}};}

test('attended HTTP path is exact, secret-gated, generic, and reuses collector composition',async()=>{
  let calls=0;const run=async()=>{calls++;return {ok:true};},env={EIA_2I5D_ACTIVATION:'ATTENDED_ONE_SHOT_DISCOVERY',API_FOOTBALL_ATTENDED_TRIGGER_SECRET:SECRET};
  assert.deepEqual(await runAttendedHttpRequest(request(),env,{run,now:()=>1}),{status:202,body:'Accepted'});
  for(const candidate of [request('GET'),request('POST','/wrong'),request('POST',ATTENDED_ACCEPTANCE_PATH,'y'.repeat(64))])assert.deepEqual(await runAttendedHttpRequest(candidate,env,{run}),{status:404,body:'Not found'});
  assert.deepEqual(await runAttendedHttpRequest(request(),{...env,EIA_2I5D_ACTIVATION:'REPOSITORY_ONLY_BLOCKED'},{run}),{status:404,body:'Not found'});assert.equal(calls,1);
});

test('reviewed Version proof pins UUID, commit annotations, modules, runtime and exact final bindings',()=>{
  assert.equal(validateReviewedAttendedVersion({stableVersion:attendedStable(),betaVersion:attendedBeta(),versionId:VERSION,identity}),true);
  const cases=[
    value=>value.beta.modules[0].content_base64=Buffer.from('wrong').toString('base64'),
    value=>value.beta.annotations['workers/message']='wrong',value=>value.stable.resources.bindings[0].database_id='wrong',
    value=>value.beta.modules.pop(),value=>value.beta.modules.push({name:'unexpected.mjs',content_base64:Buffer.from('x').toString('base64')})
  ];
  for(const mutate of cases){const value={stable:attendedStable(),beta:attendedBeta()};mutate(value);assert.throws(()=>validateReviewedAttendedVersion({stableVersion:value.stable,betaVersion:value.beta,versionId:VERSION,identity}));}
});

test('immutable attended Version identity is pinned independently of current execution SHA',()=>{
  const historical=buildImmutableAttendedVersionIdentity(VERSION_PROVENANCE);
  assert.equal(historical.approvedSha,VERSION_PROVENANCE);
  assert.equal(Object.keys(historical.moduleSha256).length,17);
  assert.equal(historical.moduleSha256['collector.mjs'],'15fef416230115fd87226a76ac02513f5d24de5bec88577c61e8ea85ee8e6f77');
  assert.equal(historical.moduleSha256,ATTENDED_VERSION_MODULE_SHA256);
  assert.throws(()=>buildImmutableAttendedVersionIdentity(SHA),/version_provenance_invalid/);
});

test('closed Worker-wide Preview inventory admits only original inert plus reviewed attended Version',()=>{
  const input={versionIds:[ORIGINAL_BLOCKED_VERSION_ID,VERSION],originalStable:originalStable(),attendedVersionId:VERSION,attendedStable:attendedStable(),attendedBeta:attendedBeta(),identity};
  assert.equal(validateClosedVersionInventory(input),true);
  assert.throws(()=>validateClosedVersionInventory({...input,versionIds:[...input.versionIds,'22222222-2222-4222-8222-222222222222']}));
  const activated=originalStable();activated.resources.bindings.find(row=>row.name==='EIA_2I5D_ACTIVATION').text='ATTENDED_ONE_SHOT_DISCOVERY';assert.throws(()=>validateClosedVersionInventory({...input,originalStable:activated}));
  const secret=originalStable();secret.resources.bindings.push({name:'BAD',type:'secret_text'});assert.throws(()=>validateClosedVersionInventory({...input,originalStable:secret}));
  assert.throws(()=>validateClosedVersionInventory({...input,attendedVersionId:'22222222-2222-4222-8222-222222222222'}));
});

test('attended Version upload uses one documented multipart Version creation with both secrets',async()=>{
  const form=buildAttendedVersionUploadForm(SHA,{apiKey:'synthetic-api-key',triggerSecret:SECRET});
  const metadata=JSON.parse(String(form.get('metadata')));assert.deepEqual(metadata.bindings.filter(row=>row.type==='secret_text').map(row=>row.name),['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET']);
  assert.equal(metadata.bindings.find(row=>row.name==='API_FOOTBALL_API_KEY').text,'synthetic-api-key');assert.equal(metadata.bindings.find(row=>row.name==='API_FOOTBALL_ATTENDED_TRIGGER_SECRET').text,SECRET);
  assert.equal(form.has('collector.mjs'),true);assert.doesNotMatch(JSON.stringify({id:VERSION,bindingNames:metadata.bindings.map(row=>row.name)}),/synthetic-api-key|x{32}/);
});

test('final attended Version preparation creates one new inactive Version and ambiguity never retries',async()=>{
  let mutations=0,reads=0;const finalId=VERSION;
  const result=await prepareFinalAttendedVersion({accountId:'account',approvedSha:SHA,secrets:{apiKey:'synthetic-api-key',triggerSecret:SECRET},request:async(path,{method,multipart})=>{mutations++;assert.match(path,/\/versions$/);assert.equal(method,'POST');assert.ok(multipart instanceof FormData);return {result:{id:finalId}};},readVersions:async()=>{reads++;return [ORIGINAL_BLOCKED_VERSION_ID,finalId];}});
  assert.equal(result.versionId,finalId);assert.deepEqual({mutations,reads},{mutations:1,reads:1});
  mutations=0;reads=0;const reconciled=await prepareFinalAttendedVersion({accountId:'account',approvedSha:SHA,secrets:{apiKey:'synthetic-api-key',triggerSecret:SECRET},request:async()=>{mutations++;throw new MutationAmbiguousError();},readVersions:async()=>{reads++;return [ORIGINAL_BLOCKED_VERSION_ID,finalId];}});
  assert.equal(reconciled.versionId,finalId);assert.equal(reconciled.disposition,'reconciled');assert.deepEqual({mutations,reads},{mutations:1,reads:1});
  mutations=0;reads=0;await assert.rejects(()=>prepareFinalAttendedVersion({accountId:'account',approvedSha:SHA,secrets:{apiKey:'synthetic-api-key',triggerSecret:SECRET},request:async()=>{mutations++;throw new MutationAmbiguousError();},readVersions:async()=>{reads++;return [ORIGINAL_BLOCKED_VERSION_ID,finalId,'22222222-2222-4222-8222-222222222222'];}}),/version_delta_ambiguous_owner_review_required/);
  assert.deepEqual({mutations,reads},{mutations:1,reads:1});
});

test('Preview URL derives from trusted Cloudflare suffix and pins exact identity',()=>{
  const suffix='-teamsheet-api-football-shadow-collector.fpltsheet.workers.dev';
  assert.equal(deriveVersionPreviewUrl({versionId:VERSION,previewUrlSuffix:suffix,accountSubdomain:'fpltsheet',path:ATTENDED_ACCEPTANCE_PATH}).href,`https://${VERSION.slice(0,8)}${suffix}${ATTENDED_ACCEPTANCE_PATH}`);
  for(const bad of ['-teamsheet-api-football-shadow-collector.evil.example','-wrong-worker.fpltsheet.workers.dev','-teamsheet-api-football-shadow-collector.wrong.example.workers.dev','-teamsheet-api-football-shadow-collector.fpltsheet.workers.dev:443','@evil.example'])assert.throws(()=>deriveVersionPreviewUrl({versionId:VERSION,previewUrlSuffix:bad,accountSubdomain:'fpltsheet',path:ATTENDED_ACCEPTANCE_PATH}));
  for(const route of ['http://evil','/path?query=1','/path#fragment'])assert.throws(()=>deriveVersionPreviewUrl({versionId:VERSION,previewUrlSuffix:suffix,accountSubdomain:'fpltsheet',path:route}));
});

test('ambiguous or rejected invocation is hard failure after cleanup; only ACCEPTED succeeds',async()=>{
  const run=async(outcome,{cleanupFails=false}={})=>{const events=[];const result=await runAttendedAcceptance({admission:admission(),versionId:VERSION,
    enablePreview:async()=>events.push('preview-on'),enableCollection:async()=>events.push('collection-on'),invokeOnce:async()=>{events.push('invoke');return {requestCount:1,outcome};},
    disableCollection:async()=>{events.push('collection-off');if(cleanupFails)throw new Error('cleanup');},disablePreview:async()=>events.push('preview-off')});return {result,events};};
  for(const [outcome,options] of [['AMBIGUOUS',{}],['AMBIGUOUS',{cleanupFails:true}],['REJECTED',{}]]){const value=await run(outcome,options);assert.equal(value.result.ok,false);assert.equal(value.result.retryAuthorized,false);assert.deepEqual(value.events,['preview-on','collection-on','invoke','collection-off','preview-off']);}
  assert.equal((await run('ACCEPTED')).result.classification,'ATTENDED_INVOCATION_COMPLETE_RECONCILIATION_REQUIRED');
});

test('credential lifecycle requires proven final secrets and defers reset until secret Version removal',()=>{
  const base={collectionEnabled:0,activeLease:false,versionInventoryExact:true,secretBearingVersionPresent:true};
  assert.match(credentialLifecycleMutation('MARK_AVAILABLE',base).sql,/credential_state='AVAILABLE'/);
  assert.equal(credentialLifecycleMutation('MARK_AVAILABLE',{...base,secretBearingVersionPresent:false}).ok,false);
  assert.equal(credentialLifecycleMutation('RESET_UNPROVISIONED',base).ok,false);
  assert.match(credentialLifecycleMutation('RESET_UNPROVISIONED',{...base,secretBearingVersionPresent:false}).sql,/credential_state='UNPROVISIONED'/);
});

function criticalAdmission(overrides={}){
  const base={
    ...admission(),migrationCount:6,foreignKeyViolations:0,officialFplAuthority:{valid:true,teamCount:20,fetchedAt:NOW},
    mapping:{state:'COMMITTED',mappingCount:20,memberCount:20,distinctProviderIds:20,distinctFplIds:20,canonicalCoverageMatches:true,historicalAuthorityProvenancePresent:true},
    inventory:{reviewedVersionId:VERSION,versionIdentityExact:true,versionInventoryExact:true,productionBindingProven:true,configurationExact:true,
      previewUrlIdentityExact:true,previewUrlSuffix:'-teamsheet-api-football-shadow-collector.fpltsheet.workers.dev',accountSubdomain:'fpltsheet',
      workerPresent:true,workersDev:false,previewUrls:false,deploymentCount:0,cronCount:0,routeCount:0,customDomainCount:0,
      secretBindingPresent:true,secretBindingNames:['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET']},
    runtime:{collectionEnabled:0,credentialState:'AVAILABLE',activeLease:false},
    priorState:{requestAttempts:0,generations:0,fixtureRevisions:0,attempt2Count:0,reservedAttemptCount:0,stagingGenerationCount:0},
    modelUiImportCount:0,rawPayloadStoragePresent:false
  };
  return {...base,...overrides,inventory:{...base.inventory,...(overrides.inventory||{})},runtime:{...base.runtime,...(overrides.runtime||{})},
    priorState:{...base.priorState,...(overrides.priorState||{})},mapping:{...base.mapping,...(overrides.mapping||{})},evidence:{...base.evidence,...(overrides.evidence||{})}};
}

test('executor fingerprints account and closes mutation endpoint surface before fetch',async()=>{
  const paths=attendedCloudflarePaths(ACCOUNT);assert.equal(assertAttendedCloudflareRequestAllowed('POST',paths.subdomain,{accountId:ACCOUNT}),true);assert.equal(assertAttendedCloudflareRequestAllowed('POST',paths.d1,{accountId:ACCOUNT}),true);
  for(const [method,path] of [['GET',paths.subdomain],['GET',`/accounts/${ACCOUNT}/workers/subdomain`],['POST',`/accounts/${ACCOUNT}/workers/scripts/x/deployments`],['POST',`/accounts/${ACCOUNT}/workers/scripts/x/schedules`],['POST',`/accounts/${ACCOUNT}/workers/routes`],['POST',`/accounts/${ACCOUNT}/workers/domains`]])assert.throws(()=>assertAttendedCloudflareRequestAllowed(method,path,{accountId:ACCOUNT}),/forbidden/);
  let calls=0;const base={CLOUDFLARE_ACCOUNT_ID:ACCOUNT,CLOUDFLARE_ATTENDED_MUTATION_TOKEN:'token',APPROVED_SHA:SHA,API_FOOTBALL_ATTENDED_VERSION_ID:VERSION,API_FOOTBALL_ATTENDED_VERSION_APPROVED_SHA:VERSION_PROVENANCE,API_FOOTBALL_ATTENDED_TRIGGER_SECRET:SECRET,API_FOOTBALL_ATTENDED_ADMISSION_PATH:'/tmp/absent'};
  for(const env of [{...base,CLOUDFLARE_ACCOUNT_FINGERPRINT:'0'.repeat(64)},base])await assert.rejects(()=>executeLiveAttendedAcceptance({env,fetchImpl:async()=>{calls++;}}));assert.equal(calls,0);
});

test('executor performs fresh exact critical recheck immediately before any Preview or D1 mutation',async()=>{
  const file='/tmp/attended-admission-critical-drift.json';fs.writeFileSync(file,JSON.stringify(admission()));let networkCalls=0,criticalCalls=0;
  const env={CLOUDFLARE_ACCOUNT_ID:ACCOUNT,CLOUDFLARE_ACCOUNT_FINGERPRINT:FINGERPRINT,CLOUDFLARE_ATTENDED_MUTATION_TOKEN:'token',APPROVED_SHA:SHA,API_FOOTBALL_ATTENDED_VERSION_ID:VERSION,API_FOOTBALL_ATTENDED_VERSION_APPROVED_SHA:VERSION_PROVENANCE,API_FOOTBALL_ATTENDED_TRIGGER_SECRET:SECRET,API_FOOTBALL_ATTENDED_ADMISSION_PATH:file};
  await assert.rejects(()=>executeLiveAttendedAcceptance({env,fetchImpl:async()=>{networkCalls++;throw new Error('must not mutate');},criticalRecheck:async()=>{criticalCalls++;return criticalAdmission({ok:false,classification:'STOP_ATTENDED_ACCEPTANCE_REVIEW_REQUIRED',reason:'attended_stage_inventory_unexpected',inventory:{versionInventoryExact:false}});}}),/attended_critical_state_drift/);
  assert.equal(criticalCalls,1);assert.equal(networkCalls,0);fs.unlinkSync(file);
});

test('executor derives URL from fresh recheck, invokes once, and stays within separate control budget',async()=>{
  const file='/tmp/attended-admission-test.json';fs.writeFileSync(file,JSON.stringify(admission()));const calls=[];let criticalCalls=0;
  const env={CLOUDFLARE_ACCOUNT_ID:ACCOUNT,CLOUDFLARE_ACCOUNT_FINGERPRINT:FINGERPRINT,CLOUDFLARE_ATTENDED_MUTATION_TOKEN:'token',APPROVED_SHA:SHA,API_FOOTBALL_ATTENDED_VERSION_ID:VERSION,API_FOOTBALL_ATTENDED_VERSION_APPROVED_SHA:VERSION_PROVENANCE,API_FOOTBALL_ATTENDED_TRIGGER_SECRET:SECRET,API_FOOTBALL_ATTENDED_ADMISSION_PATH:file};
  const fetchImpl=async(url,init={})=>{calls.push({url:String(url),init});if(String(url).includes('workers.dev'))return new Response('',{status:202});if(String(url).includes('/query'))return new Response(JSON.stringify({success:true,result:[{success:true,meta:{changes:1}}]}));return new Response(JSON.stringify({success:true,result:{}}));};
  const result=await executeLiveAttendedAcceptance({env,fetchImpl,criticalRecheck:async()=>{criticalCalls++;return criticalAdmission();}});
  assert.equal(criticalCalls,1);assert.equal(result.ok,true);assert.equal(result.providerInvocations,1);assert.deepEqual(result.controlBudget,{d1Calls:2,d1Statements:2,d1RowsChanged:2});assert.deepEqual([ATTENDED_CONTROL_MAX_D1_CALLS,ATTENDED_CONTROL_MAX_D1_STATEMENTS,ATTENDED_CONTROL_MAX_ROWS_CHANGED],[2,2,2]);
  assert.equal(calls.filter(row=>row.init.headers?.['x-teamsheet-attended-trigger']).length,1);fs.unlinkSync(file);
});

test('executor transport ambiguity invokes exactly once, cleans up, returns failure and never retries',async()=>{
  const file='/tmp/attended-admission-ambiguous.json';fs.writeFileSync(file,JSON.stringify(admission()));let previewCalls=0,previewDisable=0;
  const env={CLOUDFLARE_ACCOUNT_ID:ACCOUNT,CLOUDFLARE_ACCOUNT_FINGERPRINT:FINGERPRINT,CLOUDFLARE_ATTENDED_MUTATION_TOKEN:'token',APPROVED_SHA:SHA,API_FOOTBALL_ATTENDED_VERSION_ID:VERSION,API_FOOTBALL_ATTENDED_VERSION_APPROVED_SHA:VERSION_PROVENANCE,API_FOOTBALL_ATTENDED_TRIGGER_SECRET:SECRET,API_FOOTBALL_ATTENDED_ADMISSION_PATH:file};
  const result=await executeLiveAttendedAcceptance({env,criticalRecheck:async()=>criticalAdmission(),fetchImpl:async(url,init={})=>{const value=String(url);if(value.includes('workers.dev')){previewCalls++;throw new Error('unknown delivery');}if(value.includes('/query'))return new Response(JSON.stringify({success:true,result:[{success:true,meta:{changes:1}}]}));if(value.endsWith('/subdomain')&&JSON.parse(init.body).previews_enabled===false)previewDisable++;return new Response(JSON.stringify({success:true,result:{}}));}});
  assert.equal(result.ok,false);assert.equal(result.retryAuthorized,false);assert.equal(result.providerInvocations,1);assert.equal(previewCalls,1);assert.equal(previewDisable,1);fs.unlinkSync(file);
});

test('bad fresh Preview identity prevents enablement and trigger-secret egress',async()=>{
  const file='/tmp/attended-admission-bad-preview.json';fs.writeFileSync(file,JSON.stringify(admission()));let calls=0;
  const env={CLOUDFLARE_ACCOUNT_ID:ACCOUNT,CLOUDFLARE_ACCOUNT_FINGERPRINT:FINGERPRINT,CLOUDFLARE_ATTENDED_MUTATION_TOKEN:'token',APPROVED_SHA:SHA,API_FOOTBALL_ATTENDED_VERSION_ID:VERSION,API_FOOTBALL_ATTENDED_VERSION_APPROVED_SHA:VERSION_PROVENANCE,API_FOOTBALL_ATTENDED_TRIGGER_SECRET:SECRET,API_FOOTBALL_ATTENDED_ADMISSION_PATH:file};
  await assert.rejects(()=>executeLiveAttendedAcceptance({env,fetchImpl:async()=>{calls++;},criticalRecheck:async()=>criticalAdmission({inventory:{previewUrlSuffix:'-teamsheet-api-football-shadow-collector.evil.example'}})}),/preview_identity/);
  assert.equal(calls,0);fs.unlinkSync(file);
});

function reconciliation(overrides={}){
  const base={ok:false,stage:'ATTENDED_ACCEPTANCE',classification:'STOP_ATTENDED_ACCEPTANCE_REVIEW_REQUIRED',reason:'first_acceptance_history_not_pristine',
    migrationCount:6,foreignKeyViolations:0,officialFplAuthority:{valid:true,teamCount:20,fetchedAt:NOW},
    mapping:{state:'COMMITTED',mappingCount:20,memberCount:20,distinctProviderIds:20,distinctFplIds:20,canonicalCoverageMatches:true,historicalAuthorityProvenancePresent:true},
    runtime:{collectionEnabled:0,credentialState:'AVAILABLE',activeLease:false},
    inventory:{previewUrls:false,versionInventoryExact:true,versionIdentityExact:true,productionBindingProven:true,configurationExact:true,previewUrlIdentityExact:true,
      secretBindingPresent:true,secretBindingNames:['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET'],workersDev:false,deploymentCount:0,cronCount:0,routeCount:0,customDomainCount:0},
    priorState:{requestAttempts:5,attempt1Count:5,attempt2Count:0,succeededAttemptCount:5,authFailureCount:0,quotaBlockedCount:0,timeoutCount:0,transportUnknownCount:0,schemaFailureCount:0,httpFailureCount:0,reservedAttemptCount:0,stagingGenerationCount:0,generations:1,committedGenerationCount:1,failedGenerationCount:0,persistenceUncertainCount:0,completionUncertainCount:0,membershipConsistentCount:1,headMatchCount:1,fixtureRevisions:10},
    modelUiImportCount:0,rawPayloadStoragePresent:false,evidence:{productionMutations:0,apiFootballRequests:0,secretValuesRead:0}};
  return {...base,...overrides,runtime:{...base.runtime,...(overrides.runtime||{})},inventory:{...base.inventory,...(overrides.inventory||{})},
    priorState:{...base.priorState,...(overrides.priorState||{})},mapping:{...base.mapping,...(overrides.mapping||{})},officialFplAuthority:{...base.officialFplAuthority,...(overrides.officialFplAuthority||{})},evidence:{...base.evidence,...(overrides.evidence||{})}};
}
test('independent reconciliation classifies success and every important terminal stop without retry',()=>{
  assert.equal(classifyAttendedReconciliation(reconciliation()).classification,'ATTENDED_ACCEPTANCE_RECONCILED_SUCCESS');
  const cases=[
    {runtime:{collectionEnabled:1}},{inventory:{previewUrls:true}},{runtime:{credentialState:'INVALID'}},{priorState:{authFailureCount:1,succeededAttemptCount:0}},
    {priorState:{quotaBlockedCount:1}},{priorState:{timeoutCount:1}},{priorState:{transportUnknownCount:1}},{priorState:{schemaFailureCount:1}},
    {priorState:{httpFailureCount:1}},{priorState:{reservedAttemptCount:1}},{priorState:{persistenceUncertainCount:1}},{priorState:{completionUncertainCount:1}},
    {priorState:{stagingGenerationCount:1,committedGenerationCount:0}},{inventory:{versionInventoryExact:false}},{runtime:{activeLease:true}}
  ];
  for(const value of cases){const result=classifyAttendedReconciliation(reconciliation(value));assert.equal(result.ok,false);assert.equal(result.retryAuthorized,false);}
});

test('reconciliation success is impossible when the underlying post-run preflight stopped for any foundational reason',()=>{
  for(const value of [
    {reason:'foreign_key_violations',foreignKeyViolations:1},
    {reason:'migration_ledger_unexpected',migrationCount:5},
    {reason:'official_fpl_authority_stale',officialFplAuthority:{teamCount:19}},
    {reason:'qualified_mapping_unavailable',mapping:{canonicalCoverageMatches:false}},
    {reason:'active_request_lease',runtime:{activeLease:true}},
    {ok:true,classification:'READY_FOR_SEPARATELY_APPROVED_ATTENDED_ACCEPTANCE',reason:null}
  ]){
    const result=classifyAttendedReconciliation(reconciliation(value));assert.equal(result.ok,false);assert.equal(result.retryAuthorized,false);
  }
});

test('abstract attended admission, shipped config, provider contract and model isolation remain pinned',()=>{
  const evidence={version:COLLECTOR_ACTIVATION_PREFLIGHT_VERSION,stage:'ATTENDED_ACCEPTANCE',migrations:[[1,'shadow_data_foundation'],[2,'official_fpl_structured_history'],[3,'production_query_plan_indexes'],[4,'api_football_shadow_identity'],[5,'api_football_shadow_runtime'],[6,'api_football_mapping_qualification']],foreignKeyViolations:0,authority:{season:'2026-27',sourceKey:'official-fpl',sourceRevisionId:'official-fpl-r1',runId:'run',runStatus:'completed',fetchedAt:NOW,digest:'a'.repeat(64),teamIds:Array.from({length:20},(_,i)=>`2026-27:fpl:team:${i+1}`)},mapping:{state:'COMMITTED',isCurrentHead:true,mappingCount:20,memberCount:20,distinctProviderIds:20,distinctFplIds:20,canonicalTeamIds:Array.from({length:20},(_,i)=>`2026-27:fpl:team:${i+1}`),historicalAuthorityDigest:'b'.repeat(64),historicalAuthorityFetchedAt:NOW},runtime:{provider:'api-football',collectionEnabled:0,credentialState:'AVAILABLE',inFlightAttemptId:null,inFlightLeaseExpiresAt:null},counts:{requestAttempts:0,generations:0,fixtureRevisions:0},priorState:{attempt2Count:0,reservedAttemptCount:0,stagingGenerationCount:0},modelUiImportCount:0,rawPayloadStoragePresent:false,inventory:{activation:'ATTENDED_ONE_SHOT_DISCOVERY',databaseIdPlaceholder:false,productionBindingProven:true,workerPresent:true,deploymentCount:0,cronCount:0,workersDev:false,previewUrls:false,configurationExact:true,versionIdentityExact:true,versionInventoryExact:true,previewUrlIdentityExact:true,routeCount:0,customDomainCount:0,secretBindingPresent:true,secretBindingNames:['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET']}};
  assert.equal(classifyCollectorActivationPreflight(evidence,{now:NOW}).ok,true);assert.equal(classifyCollectorActivationPreflight({...evidence,inventory:{...evidence.inventory,deploymentCount:1}},{now:NOW}).ok,false);
  const config=JSON.parse(fs.readFileSync(path.join(root,'workers/api-football-collector/wrangler.jsonc'),'utf8'));assert.equal(config.vars.EIA_2I5D_ACTIVATION,'REPOSITORY_ONLY_BLOCKED');assert.deepEqual(config.triggers.crons,[]);assert.equal(config.workers_dev,false);assert.equal(config.preview_urls,false);
  const runtime=fs.readFileSync(path.join(root,'workers/api-football-collector/runtime-contracts.mjs'),'utf8'),orchestrator=fs.readFileSync(path.join(root,'workers/api-football-collector/activation-orchestrator.mjs'),'utf8');
  for(const value of ['720_896','2_000','2_500','1_000'])assert.match(runtime+orchestrator,new RegExp(value));assert.match(orchestrator,/DISCOVERY_MAX_D1_STATEMENTS=.*50|DISCOVERY_MAX_D1_STATEMENTS/);
});

test('workflow pins exact-main provenance, artifact identity, protected execution and always-run closeout',()=>{
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/api-football-collector-attended-acceptance.yml'),'utf8');
  for(const required of ['API_FOOTBALL_ATTENDED_VERSION_APPROVED_SHA','69bb84fadbcce94e9fece3ff438d985866cce183',"row.name==='Tests and deterministic build'","row.status==='completed'","row.conclusion==='success'","row.head_sha===process.env.APPROVED_SHA","row.app?.slug==='github-actions'","https://github.com/priteshpatel390-del/FPL/actions/runs/",'github.run_attempt == 1','git ls-remote','git status --porcelain --untracked-files=all','EXPECTED_ARTIFACT_SHA256','sha256sum','$API_FOOTBALL_ATTENDED_ADMISSION_PATH','final-readonly-reconciliation:','continue-on-error: true','attended-reconciliation.mjs'])assert.match(workflow,new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.ok((workflow.match(/API_FOOTBALL_ATTENDED_VERSION_APPROVED_SHA/g)||[]).length>=3);assert.ok((workflow.match(/git ls-remote/g)||[]).length>=4);assert.ok((workflow.match(/refs\/heads\/main/g)||[]).length>=4);
  assert.doesNotMatch(workflow,/API_FOOTBALL_ATTENDED_VERSION_PREVIEW_URL|wrangler\s+deploy|\/deployments|^\s{2}schedule:/m);
});
