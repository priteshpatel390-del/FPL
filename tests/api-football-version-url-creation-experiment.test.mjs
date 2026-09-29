import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  ATTENDED_VERSION_APPROVED_SHA,ATTENDED_VERSION_ID,ORIGINAL_BLOCKED_VERSION_ID,
  buildLifecycleCloneIdentity,expectedAttendedBindings
} from '../workers/api-football-collector/attended-version.mjs';
import {
  assertLifecycleCreationMutationAllowed,lifecycleCreationPaths,runVersionUrlCreationExperiment
} from '../workers/api-football-collector/run-version-url-creation-experiment.mjs';
import {
  classifyVersionUrlCreationReconciliation
} from '../workers/api-football-collector/version-url-creation-experiment-reconciliation.mjs';
import {
  buildUploadModules,resolveModuleGraph
} from '../workers/api-football-collector/stage-inactive-version.mjs';
import {
  COLLECTOR_LIFECYCLE_CLONE_CLOSEOUT_READY,COLLECTOR_PREFLIGHT_LIFECYCLE_CLONE_CLOSEOUT_STAGE
} from '../workers/api-football-collector/activation-preflight.mjs';

const SHA='c'.repeat(40);
const ACCOUNT='synthetic-account';
const FINGERPRINT=createHash('sha256').update(ACCOUNT).digest('hex');
const WORKER_ID='worker-object-id';
const SUBDOMAIN='example';
const SUFFIX='-teamsheet-api-football-shadow-collector.example.workers.dev';
const CLONE_ID='22222222-2222-4222-8222-222222222222';
const NOW='2026-09-29T13:00:00.000Z';
const API_KEY='synthetic-api-key';
const TRIGGER='t'.repeat(40);

function admission(){
  return {
    ok:true,approvedSha:SHA,versionApprovedSha:ATTENDED_VERSION_APPROVED_SHA,observedAt:NOW,accountFingerprint:FINGERPRINT,
    stage:'ATTENDED_ACCEPTANCE',classification:'READY_FOR_SEPARATELY_APPROVED_ATTENDED_ACCEPTANCE',
    inventory:{
      reviewedVersionId:ATTENDED_VERSION_ID,versionIdentityExact:true,versionInventoryExact:true,previewUrlIdentityExact:true,
      previewUrlSuffix:SUFFIX,accountSubdomain:SUBDOMAIN,reviewedWorkerId:WORKER_ID
    },
    evidence:{observedAt:NOW,productionMutations:0,apiFootballRequests:0,secretValuesRead:0}
  };
}

function cloneFixtures(){
  const identity=buildLifecycleCloneIdentity(SHA),modules=buildUploadModules(resolveModuleGraph());
  return {
    identity,
    stable:{id:CLONE_ID,resources:{script_runtime:{compatibility_date:identity.compatibilityDate},bindings:structuredClone(expectedAttendedBindings())}},
    beta:{id:CLONE_ID,main_module:identity.mainModule,compatibility_date:identity.compatibilityDate,
      annotations:{'workers/message':identity.message,'workers/tag':identity.tag},
      modules:[...modules].map(([name,source])=>({name,content_base64:Buffer.from(source).toString('base64')}))}
  };
}

function workerResponse(exact){
  return exact
    ?new Response('Not found',{status:404,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}})
    :new Response('platform response',{status:404,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'public'}});
}

test('creation experiment mutation surface is only exact Preview toggle and Version upload',()=>{
  const paths=lifecycleCreationPaths(ACCOUNT);
  assert.equal(assertLifecycleCreationMutationAllowed('POST',paths.subdomain,{accountId:ACCOUNT}),true);
  assert.equal(assertLifecycleCreationMutationAllowed('POST',paths.versions,{accountId:ACCOUNT}),true);
  for(const [method,p] of [
    ['DELETE',paths.versions+'/'+CLONE_ID],['POST','/accounts/'+ACCOUNT+'/d1/database/x/query'],
    ['POST','/accounts/'+ACCOUNT+'/workers/scripts/x/deployments'],['POST','/accounts/'+ACCOUNT+'/workers/routes']
  ])assert.throws(()=>assertLifecycleCreationMutationAllowed(method,p,{accountId:ACCOUNT}),/forbidden/);
});

test('creation-time A/B experiment uploads one exact clone, probes old and new secret-free, and restores Preview',async()=>{
  const file='/tmp/creation-experiment-admission.json';fs.writeFileSync(file,JSON.stringify(admission()));
  const fixtures=cloneFixtures(),paths=lifecycleCreationPaths(ACCOUNT),calls=[];
  let preview=false,created=false;
  const result=await runVersionUrlCreationExperiment({
    env:{
      CLOUDFLARE_ACCOUNT_ID:ACCOUNT,CLOUDFLARE_ACCOUNT_FINGERPRINT:FINGERPRINT,CLOUDFLARE_ATTENDED_VERSION_UPLOAD_TOKEN:'upload-token',
      APPROVED_SHA:SHA,API_FOOTBALL_API_KEY:API_KEY,API_FOOTBALL_ATTENDED_TRIGGER_SECRET:TRIGGER,API_FOOTBALL_ATTENDED_ADMISSION_PATH:file
    },
    wait:async()=>{},
    fetchImpl:async(url,init={})=>{
      const value=String(url);calls.push({value,init});
      if(value=== 'https://api.cloudflare.com/client/v4'+paths.subdomain){
        if((init.method||'GET')==='GET')return new Response(JSON.stringify({success:true,result:{enabled:false,previews_enabled:preview}}),{status:200});
        const body=JSON.parse(init.body);preview=body.previews_enabled;
        return new Response(JSON.stringify({success:true,result:{enabled:false,previews_enabled:preview}}),{status:200});
      }
      if(value=== 'https://api.cloudflare.com/client/v4'+paths.versions+'?deployable=true'){
        const ids=created?[ORIGINAL_BLOCKED_VERSION_ID,ATTENDED_VERSION_ID,CLONE_ID]:[ORIGINAL_BLOCKED_VERSION_ID,ATTENDED_VERSION_ID];
        return new Response(JSON.stringify({success:true,result:{items:ids.map(id=>({id}))}}),{status:200});
      }
      if(value=== 'https://api.cloudflare.com/client/v4'+paths.versions&&(init.method||'GET')==='POST'){
        assert.equal(preview,true);assert.ok(init.body instanceof FormData);
        const metadata=JSON.parse(init.body.get('metadata'));
        const secrets=metadata.bindings.filter(row=>row.type==='secret_text');
        assert.deepEqual(secrets.map(row=>row.name),['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET']);
        assert.deepEqual(secrets.map(row=>row.text),[API_KEY,TRIGGER]);
        created=true;return new Response(JSON.stringify({success:true,result:{id:CLONE_ID}}),{status:200});
      }
      if(value=== 'https://api.cloudflare.com/client/v4'+paths.versions+'/'+CLONE_ID)return new Response(JSON.stringify({success:true,result:fixtures.stable}),{status:200});
      if(value.includes('/workers/workers/'+WORKER_ID+'/versions/'+CLONE_ID+'?include=modules'))return new Response(JSON.stringify({success:true,result:fixtures.beta}),{status:200});
      if(value.includes('/workers/workers/'+WORKER_ID+'/versions/'+ATTENDED_VERSION_ID)&&!value.includes('?include=modules'))
        return new Response(JSON.stringify({success:true,result:{id:ATTENDED_VERSION_ID,urls:[`https://${ATTENDED_VERSION_ID.slice(0,8)}${SUFFIX}/`]}}),{status:200});
      if(value.includes('/workers/workers/'+WORKER_ID+'/versions/'+CLONE_ID)&&!value.includes('?include=modules'))
        return new Response(JSON.stringify({success:true,result:{id:CLONE_ID,urls:[`https://${CLONE_ID.slice(0,8)}${SUFFIX}/`]}}),{status:200});
      if(value.includes('workers.dev')){
        assert.equal(init.method,'GET');assert.equal(init.redirect,'error');assert.equal(init.headers,undefined);
        return value.includes(CLONE_ID.slice(0,8))?workerResponse(true):workerResponse(false);
      }
      throw new Error('unexpected URL '+value);
    }
  });
  assert.equal(result.ok,true);
  assert.equal(result.cloneVersionId,CLONE_ID);
  assert.equal(result.versionMutationSubmissions,1);
  assert.equal(result.previewMutationSubmissions,2);
  assert.equal(result.previewEnableSucceeded,true);assert.equal(result.previewDisableSucceeded,true);
  assert.equal(result.oldRouting,'EXISTING_VERSION_ROUTABILITY_NOT_PROVEN');
  assert.equal(result.cloneRouting,'EXISTING_VERSION_ROUTABLE_BOTH_PATHS');
  assert.equal(result.comparison,'OLD_NOT_PROVEN_NEW_ROUTABLE_BOTH_PATHS');
  assert.equal(result.secretBindingsSubmitted,2);assert.equal(result.triggerSecretRequestEgress,0);
  assert.equal(result.providerRequests,0);assert.equal(result.d1Mutations,0);assert.equal(result.deploymentMutations,0);
  const serialized=JSON.stringify(result);
  assert.doesNotMatch(serialized,/synthetic-api-key|tttttttttt|workers\.dev|Not found|platform response|upload-token/);
  assert.equal(preview,false);
  assert.equal(calls.some(row=>/d1\/database|\/deployments|\/schedules|workers\/routes|workers\/domains/.test(row.value)),false);
  fs.unlinkSync(file);
});

test('ambiguous Preview enable still forces disable and never uploads a Version',async()=>{
  const file='/tmp/creation-experiment-enable-ambiguous.json';fs.writeFileSync(file,JSON.stringify(admission()));
  const paths=lifecycleCreationPaths(ACCOUNT);let subdomainPosts=0,versionPosts=0;
  const result=await runVersionUrlCreationExperiment({
    env:{
      CLOUDFLARE_ACCOUNT_ID:ACCOUNT,CLOUDFLARE_ACCOUNT_FINGERPRINT:FINGERPRINT,CLOUDFLARE_ATTENDED_VERSION_UPLOAD_TOKEN:'upload-token',
      APPROVED_SHA:SHA,API_FOOTBALL_API_KEY:API_KEY,API_FOOTBALL_ATTENDED_TRIGGER_SECRET:TRIGGER,API_FOOTBALL_ATTENDED_ADMISSION_PATH:file
    },
    wait:async()=>{},
    fetchImpl:async(url,init={})=>{
      const value=String(url);
      if(value.endsWith('/subdomain')){
        if((init.method||'GET')==='GET')return new Response(JSON.stringify({success:true,result:{enabled:false,previews_enabled:false}}),{status:200});
        subdomainPosts++;if(subdomainPosts===1)throw new Error('delivery unknown');
        return new Response(JSON.stringify({success:true,result:{enabled:false,previews_enabled:false}}),{status:200});
      }
      if(value.includes('/versions?deployable=true'))return new Response(JSON.stringify({success:true,result:{items:[{id:ORIGINAL_BLOCKED_VERSION_ID},{id:ATTENDED_VERSION_ID}]}}),{status:200});
      if(value=== 'https://api.cloudflare.com/client/v4'+paths.versions){versionPosts++;throw new Error('must not upload');}
      throw new Error('unexpected network');
    }
  });
  assert.equal(result.ok,false);assert.equal(result.retryAuthorized,false);
  assert.equal(subdomainPosts,2);assert.equal(versionPosts,0);
  assert.equal(result.previewEnableAttempted,true);assert.equal(result.previewEnableSucceeded,false);assert.equal(result.previewDisableSucceeded,true);
  assert.equal(result.versionMutationSubmissions,0);assert.equal(result.secretBindingsSubmitted,0);assert.equal(result.providerRequests,0);
  fs.unlinkSync(file);
});

test('clone construction fails before mutation if current reviewed module bytes drift from immutable attended provenance',()=>{
  assert.throws(()=>buildLifecycleCloneIdentity(SHA,{readFile:repoPath=>{
    const source=fs.readFileSync(path.join(process.cwd(),repoPath),'utf8');
    return repoPath==='workers/api-football-collector/collector.mjs'?source+'\n// synthetic drift':source;
  }}),/collector_lifecycle_clone_source_drift/);
});

function closeoutReport(){
  return {
    ok:true,approvedSha:SHA,stage:COLLECTOR_PREFLIGHT_LIFECYCLE_CLONE_CLOSEOUT_STAGE,classification:COLLECTOR_LIFECYCLE_CLONE_CLOSEOUT_READY,
    migrationCount:6,foreignKeyViolations:0,officialFplAuthority:{valid:true,teamCount:20},
    mapping:{state:'COMMITTED',mappingCount:20,memberCount:20,distinctProviderIds:20,distinctFplIds:20,canonicalCoverageMatches:true,historicalAuthorityProvenancePresent:true},
    runtime:{collectionEnabled:0,credentialState:'AVAILABLE',activeLease:false},
    priorState:{requestAttempts:0,generations:0,fixtureRevisions:0,attempt2Count:0,reservedAttemptCount:0,stagingGenerationCount:0},
    inventory:{reviewedVersionId:ATTENDED_VERSION_ID,cloneVersionId:CLONE_ID,cloneVersionIdentityExact:true,originalVersionIdentityExact:true,
      versionIdentityExact:true,versionInventoryExact:true,previewUrlIdentityExact:true,workerPresent:true,workersDev:false,previewUrls:false,
      deploymentCount:0,cronCount:0,routeCount:0,customDomainCount:0,productionBindingProven:true,configurationExact:true,
      secretBindingPresent:true,secretBindingNames:['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET']},
    evidence:{productionMutations:0,apiFootballRequests:0,secretValuesRead:0}
  };
}
function mismatchProbe(){return {outcome:'HTTP_RESPONSE',lastHttpStatus:404,mismatch:'BODY',signatureChecks:{statusMatches:true,bodyMatches:false,cacheControlMatches:false,contentTypeMatches:true},workerSignatureProved:false};}
function exactProbe(){return {outcome:'HTTP_RESPONSE',lastHttpStatus:404,mismatch:null,signatureChecks:{statusMatches:true,bodyMatches:true,cacheControlMatches:true,contentTypeMatches:true},workerSignatureProved:true};}
function experimentEvidence(){
  const old=mismatchProbe(),clone=exactProbe();
  return {
    version:'api-football-version-url-creation-experiment-v1',approvedSha:SHA,sourceVersionId:ATTENDED_VERSION_ID,sourceVersionApprovedSha:ATTENDED_VERSION_APPROVED_SHA,
    cloneVersionId:CLONE_ID,ok:true,classification:'VERSION_URL_CREATION_EXPERIMENT_COMPLETE_RECONCILIATION_REQUIRED',reason:'experiment_complete_requires_reconciliation',
    comparison:'OLD_NOT_PROVEN_NEW_ROUTABLE_BOTH_PATHS',oldRouting:'EXISTING_VERSION_ROUTABILITY_NOT_PROVEN',cloneRouting:'EXISTING_VERSION_ROUTABLE_BOTH_PATHS',
    oldVersionUrlReads:1,cloneVersionUrlReads:1,previewEnableAttempted:true,previewEnableSucceeded:true,previewDisableSucceeded:true,previewMutationSubmissions:2,
    versionMutationSubmissions:1,versionUploadDisposition:'definite',oldRootProbe:old,oldAttendedProbe:old,cloneRootProbe:clone,cloneAttendedProbe:clone,
    secretBindingsSubmitted:2,triggerSecretRequestEgress:0,providerRequests:0,d1Mutations:0,deploymentMutations:0,cronRouteDomainMutations:0,retryAuthorized:false
  };
}

test('independent reconciliation accepts only exact three-Version clean A/B evidence',()=>{
  const good=classifyVersionUrlCreationReconciliation(closeoutReport(),{experimentEvidence:experimentEvidence()});
  assert.equal(good.ok,true);assert.equal(good.classification,'VERSION_URL_CREATION_EXPERIMENT_RECONCILED');
  assert.equal(good.comparison,'OLD_NOT_PROVEN_NEW_ROUTABLE_BOTH_PATHS');
  assert.equal(classifyVersionUrlCreationReconciliation({...closeoutReport(),inventory:{...closeoutReport().inventory,previewUrls:true}},{experimentEvidence:experimentEvidence()}).ok,false);
  assert.equal(classifyVersionUrlCreationReconciliation(closeoutReport(),{experimentEvidence:{...experimentEvidence(),providerRequests:1}}).ok,false);
  assert.equal(classifyVersionUrlCreationReconciliation(closeoutReport(),{experimentEvidence:{...experimentEvidence(),cloneRouting:'EXISTING_VERSION_ROUTABILITY_NOT_PROVEN'}}).ok,false);
});

test('creation experiment workflow is manual exact-main first-attempt-only and excludes provider/D1/deploy/delete surfaces',()=>{
  const workflow=fs.readFileSync('.github/workflows/api-football-version-url-creation-experiment.yml','utf8');
  for(const required of ['workflow_dispatch:','github.run_attempt == 1','refs/heads/main',"row.name==='Tests and deterministic build'",
    'api-football-attended-preparation-version','CLOUDFLARE_ATTENDED_VERSION_UPLOAD_TOKEN','API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET',
    'run-version-url-creation-experiment.mjs','version-url-creation-experiment-reconciliation.mjs','final-readonly-reconciliation:'])
    assert.ok(workflow.includes(required),required);
  for(const forbidden of ['x-teamsheet-attended-trigger','x-apisports-key','v3.football.api-sports.io','/d1/database/','wrangler deploy','/deployments','/schedules','workers/routes','workers/domains','method: DELETE'])
    assert.equal(workflow.includes(forbidden),false,forbidden);
});
