import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {stableStringify} from '../src/decision-intelligence/canonical.mjs';
import {EXPECTED_D1_DATABASE_ID} from '../workers/data-platform/phase4b/live-contract.mjs';
import {
  ACTIVATION_QUERIES,
  API_FOOTBALL_ACTIVATION_LIVE_PREFLIGHT_VERSION,
  assertActivationReadOnlySql,
  buildAuthority,
  PREFLIGHT_ATTENDED_CLOUDFLARE_GETS,
  PREFLIGHT_MAX_CLOUDFLARE_GETS,
  PREFLIGHT_REPOSITORY_CLOUDFLARE_GETS,
  PREFLIGHT_MAX_D1_QUERY_CALLS,
  productionModelUiImportCount,
  runApiFootballActivationLivePreflight,scriptRouteCount
} from '../workers/api-football-collector/activation-live-preflight.mjs';
import {
  COLLECTOR_PREFLIGHT_REPOSITORY_STAGE,
  COLLECTOR_REPOSITORY_STAGE_READY
} from '../workers/api-football-collector/activation-preflight.mjs';
import {ATTENDED_VERSION_APPROVED_SHA,buildReviewedAttendedIdentity,expectedAttendedBindings,ORIGINAL_BLOCKED_VERSION_ID} from '../workers/api-football-collector/attended-version.mjs';
import {buildUploadModules,resolveModuleGraph} from '../workers/api-football-collector/stage-inactive-version.mjs';

const root=path.resolve(import.meta.dirname,'..');
const ACCOUNT='synthetic-production-account';
const TOKEN='synthetic-read-token';
const NOW='2026-09-21T16:00:00.000Z';
const fingerprint=createHash('sha256').update(ACCOUNT).digest('hex');
const APPROVED_SHA=ATTENDED_VERSION_APPROVED_SHA,ATTENDED_VERSION_ID='11111111-1111-4111-8111-111111111111';
const migrations=[
  [1,'shadow_data_foundation'],[2,'official_fpl_structured_history'],[3,'production_query_plan_indexes'],
  [4,'api_football_shadow_identity'],[5,'api_football_shadow_runtime'],[6,'api_football_mapping_qualification']
];
const officialRun={run_id:'official-run',completed_at:'2026-09-21T12:00:00.000Z',status:'completed'};
const officialTeams=Array.from({length:20},(_,index)=>({
  subject_entity_id:`2026-27:fpl:team:${index+1}`,
  observation_id:String(index+1).padStart(64,'0'),
  input_revision:`official-input-${index+1}`,
  logical_key:`official-fpl|2026-27|team|${index+1}|present`
}));
const authority=buildAuthority([officialRun],officialTeams);
assert.ok(authority);

function json(result,status=200){
  return new Response(JSON.stringify({success:status===200,result}),{status,headers:{'content-type':'application/json'}});
}
function absent(){return new Response('',{status:404});}
function d1Rows({attempts=0,generations=0,fixtureRevisions=0,credentialState='UNPROVISIONED',rowsWritten=0,completedAt=officialRun.completed_at,historicalAuthorityDigest=null,historicalAuthorityFetchedAt='2026-09-20T12:00:00.000Z',canonicalTeamIds=officialTeams.map(row=>row.subject_entity_id).sort()}={}){
  const run={...officialRun,completed_at:completedAt};
  const currentAuthority=buildAuthority([run],officialTeams);
  const persistedAuthorityDigest=historicalAuthorityDigest??createHash('sha256').update(currentAuthority.digest).digest('hex');
  return {
    ledger:migrations.map(([version,name])=>({version,name})),
    foreignKeys:[],
    officialRun:[run],
    officialTeams,
    mappingHead:[{fpl_season:'2026-27',state:'COMMITTED',mapping_count:20,official_fpl_authority_digest:persistedAuthorityDigest,official_fpl_authority_fetched_at:historicalAuthorityFetchedAt}],
    mappingMembers:[{member_count:20,distinct_provider_ids:20,distinct_fpl_ids:20,canonical_fpl_team_ids:canonicalTeamIds.join('|')}],
    runtime:[{provider:'api-football',collection_enabled:0,credential_state:credentialState,in_flight_attempt_id:null,in_flight_lease_expires_at:null}],
    attempts:[{total:attempts,attempt1_count:attempts,attempt2_count:0,reserved_count:0,succeeded_count:attempts,auth_failure_count:0,quota_blocked_count:0,timeout_count:0,transport_unknown_count:0,schema_failure_count:0,http_failure_count:0}],
    generations:[{total:generations,staging_count:0,committed_count:generations,failed_count:0,persistence_uncertain_count:0,completion_uncertain_count:0,membership_consistent_count:generations,head_match_count:generations}],
    fixtureRevisions:[{total:fixtureRevisions}],
    rawPayloadStorage:[],
    rowsWritten
  };
}
function attendedFixtures(){
  const identity=buildReviewedAttendedIdentity(APPROVED_SHA),modules=buildUploadModules(resolveModuleGraph());
  const attendedStable={id:ATTENDED_VERSION_ID,resources:{script_runtime:{compatibility_date:identity.compatibilityDate},bindings:structuredClone(expectedAttendedBindings())}};
  const attendedBeta={id:ATTENDED_VERSION_ID,main_module:identity.mainModule,compatibility_date:identity.compatibilityDate,annotations:{'workers/message':identity.message,'workers/tag':identity.tag},modules:[...modules].map(([name,source])=>({name,content_base64:Buffer.from(source).toString('base64')}))};
  const originalStable={id:ORIGINAL_BLOCKED_VERSION_ID,resources:{bindings:[
    {name:'TEAMSHEET_DATA_DB',type:'d1',database_id:EXPECTED_D1_DATABASE_ID},{name:'API_FOOTBALL_FPL_SEASON',type:'plain_text',text:'2026-27'},
    {name:'API_FOOTBALL_PROVIDER_SEASON',type:'plain_text',text:'2026'},{name:'EIA_2I5D_ACTIVATION',type:'plain_text',text:'REPOSITORY_ONLY_BLOCKED'}]}};
  return {identity,attendedStable,attendedBeta,originalStable};
}
function fakeFetch({collectorPresent=false,attended=false,state=d1Rows(),mutateAttended=()=>{}}={}){
  const fixtures=attendedFixtures();mutateAttended(fixtures);
  const bySql=new Map(Object.entries(ACTIVATION_QUERIES).map(([key,sql])=>[sql,key]));
  return async (url,init={})=>{
    const value=String(url);
    if(value.includes('/d1/database/')&&value.includes('?fields='))return json({uuid:EXPECTED_D1_DATABASE_ID,name:'teamsheet-data',file_size:123});
    if(value.includes('/workers/scripts/teamsheet-data-platform/settings'))return json({bindings:[{name:'TEAMSHEET_DATA_DB',type:'d1',database_id:EXPECTED_D1_DATABASE_ID}]});
    if(attended&&value.includes('/workers/scripts/teamsheet-api-football-shadow-collector/versions/'+ATTENDED_VERSION_ID))return json(fixtures.attendedStable);
    if(attended&&value.includes('/workers/scripts/teamsheet-api-football-shadow-collector/versions/'+ORIGINAL_BLOCKED_VERSION_ID))return json(fixtures.originalStable);
    if(attended&&value.includes('/workers/scripts/teamsheet-api-football-shadow-collector/versions?'))return json({items:[{id:ORIGINAL_BLOCKED_VERSION_ID},{id:ATTENDED_VERSION_ID}]});
    if(attended&&value.includes('/workers/workers?'))return json([{id:'worker-object-id',name:'teamsheet-api-football-shadow-collector'}]);
    if(attended&&value.includes('/workers/workers/worker-object-id/versions/'))return json(fixtures.attendedBeta);
    if(attended&&value.endsWith('/workers/workers/worker-object-id'))return json({id:'worker-object-id',name:'teamsheet-api-football-shadow-collector',subdomain:{enabled:false,previews_enabled:false,preview_url_suffix:'-teamsheet-api-football-shadow-collector.example.workers.dev'}});
    if(attended&&value.includes('/workers/scripts/teamsheet-api-football-shadow-collector/subdomain'))return json({enabled:false,previews_enabled:false});
    if(attended&&value.endsWith('/workers/subdomain'))return json({subdomain:'example'});
    if(attended&&value.endsWith('/workers/domains'))return json([]);
    if(attended&&value.endsWith('/workers/scripts'))return json([{id:'teamsheet-api-football-shadow-collector',routes:[]}]);
    if(value.includes('/workers/scripts/teamsheet-api-football-shadow-collector/settings')){
      return collectorPresent?json({bindings:[]}):absent();
    }
    if(value.includes('/workers/scripts/teamsheet-api-football-shadow-collector/schedules')){
      return collectorPresent?json({schedules:[]}):absent();
    }
    if(value.includes('/workers/scripts/teamsheet-api-football-shadow-collector/deployments')){
      return collectorPresent?json({deployments:[]}):absent();
    }
    if(value.endsWith('/query')){
      assert.equal(init.method,'POST');
      const body=JSON.parse(init.body);
      const result=body.batch.map(({sql})=>{
        const key=bySql.get(sql);assert.ok(key,`unexpected query: ${sql}`);
        const results=state[key];
        return {success:true,results,meta:{rows_read:Array.isArray(results)?results.length:0,rows_written:state.rowsWritten||0}};
      });
      return json(result);
    }
    throw new Error(`unexpected URL: ${url}`);
  };
}
function env(){
  return {
    DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID:ACCOUNT,
    DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT:fingerprint,
    DATA_STEWARD_CLOUDFLARE_READ_TOKEN:TOKEN
  };
}
function attendedEnv(){return {...env(),APPROVED_SHA,API_FOOTBALL_PREFLIGHT_STAGE:'ATTENDED_ACCEPTANCE',API_FOOTBALL_ATTENDED_VERSION_ID:ATTENDED_VERSION_ID,API_FOOTBALL_ATTENDED_VERSION_APPROVED_SHA:ATTENDED_VERSION_APPROVED_SHA};}

test('activation live preflight SQL registry is read-only and closed',()=>{
  assert.equal(Object.keys(ACTIVATION_QUERIES).length,11);
  for(const sql of Object.values(ACTIVATION_QUERIES))assert.equal(assertActivationReadOnlySql(sql),sql);
  for(const sql of [
    "UPDATE api_football_runtime_state SET collection_enabled=1",
    "INSERT INTO api_football_request_attempts VALUES('x')",
    "DELETE FROM api_football_request_attempts",
    "SELECT * FROM api_football_runtime_state; DROP TABLE x",
    "PRAGMA writable_schema=ON"
  ])assert.throws(()=>assertActivationReadOnlySql(sql),/activation_preflight_sql_invalid/);
});

test('repository infrastructure staging admission passes only from exact post-0006 dormant state',async()=>{
  const report=await runApiFootballActivationLivePreflight({env:env(),fetchImpl:fakeFetch(),now:()=>NOW});
  assert.equal(report.ok,true);
  assert.equal(report.version,API_FOOTBALL_ACTIVATION_LIVE_PREFLIGHT_VERSION);
  assert.equal(report.stage,COLLECTOR_PREFLIGHT_REPOSITORY_STAGE);
  assert.equal(report.classification,COLLECTOR_REPOSITORY_STAGE_READY);
  assert.equal(report.migrationCount,6);
  assert.equal(report.foreignKeyViolations,0);
  assert.equal(report.officialFplAuthority.teamCount,20);
  assert.deepEqual(report.mapping,{state:'COMMITTED',mappingCount:20,memberCount:20,distinctProviderIds:20,distinctFplIds:20,canonicalCoverageMatches:true,historicalAuthorityProvenancePresent:true});
  assert.equal(report.priorState.requestAttempts,0);assert.equal(report.priorState.attempt2Count,0);assert.equal(report.priorState.stagingGenerationCount,0);
  assert.equal(report.inventory.workerPresent,false);
  assert.equal(report.inventory.deploymentCount,0);
  assert.equal(report.inventory.cronCount,0);
  assert.equal(report.inventory.secretBindingPresent,false);
  assert.equal(report.inventory.databaseIdPlaceholder,true);
  assert.equal(report.modelUiImportCount,0);
  assert.equal(report.evidence.cloudflareGets,PREFLIGHT_REPOSITORY_CLOUDFLARE_GETS);
  assert.equal(report.evidence.cloudflareGetCeiling,PREFLIGHT_REPOSITORY_CLOUDFLARE_GETS);
  assert.equal(report.evidence.d1QueryCalls,PREFLIGHT_MAX_D1_QUERY_CALLS);
  assert.equal(report.evidence.productionMutations,0);
  assert.equal(report.evidence.apiFootballRequests,0);
  assert.equal(report.evidence.secretValuesRead,0);
});

test('attended live preflight proves exact reviewed content and closed two-Version inventory',async()=>{
  const report=await runApiFootballActivationLivePreflight({env:attendedEnv(),fetchImpl:fakeFetch({collectorPresent:true,attended:true,state:d1Rows({credentialState:'AVAILABLE'})}),now:()=>NOW});
  assert.equal(report.ok,true);
  assert.equal(report.inventory.versionIdentityExact,true);assert.equal(report.inventory.versionInventoryExact,true);
  assert.equal(report.inventory.previewUrlSuffix,'-teamsheet-api-football-shadow-collector.example.workers.dev');assert.equal(report.inventory.reviewedWorkerId,'worker-object-id');assert.equal(report.inventory.accountSubdomain,'example');
  assert.equal(report.evidence.cloudflareGets,PREFLIGHT_ATTENDED_CLOUDFLARE_GETS);assert.equal(PREFLIGHT_MAX_CLOUDFLARE_GETS,PREFLIGHT_ATTENDED_CLOUDFLARE_GETS);
});

test('attended Preview identity comes from modern Worker metadata, not legacy Script Subdomain shape',async()=>{
  const calls=[];
  const baseFetch=fakeFetch({collectorPresent:true,attended:true,state:d1Rows({credentialState:'AVAILABLE'})});
  const report=await runApiFootballActivationLivePreflight({
    env:attendedEnv(),
    fetchImpl:async(url,init)=>{calls.push(String(url));return baseFetch(url,init);},
    now:()=>NOW
  });
  assert.equal(report.ok,true);
  assert.equal(report.inventory.previewUrlIdentityExact,true);
  assert.equal(report.inventory.previewUrlSuffix,'-teamsheet-api-football-shadow-collector.example.workers.dev');
  assert.equal(report.inventory.reviewedWorkerId,'worker-object-id');
  assert.ok(calls.some(value=>value.endsWith('/workers/scripts/teamsheet-api-football-shadow-collector/subdomain')));
  assert.ok(calls.some(value=>value.endsWith('/workers/workers/worker-object-id')));
});

test('attended Preview identity fails closed when modern Worker metadata has a wrong suffix',async()=>{
  const baseFetch=fakeFetch({collectorPresent:true,attended:true,state:d1Rows({credentialState:'AVAILABLE'})});
  const report=await runApiFootballActivationLivePreflight({
    env:attendedEnv(),
    fetchImpl:async(url,init)=>{
      if(String(url).endsWith('/workers/workers/worker-object-id'))return json({id:'worker-object-id',name:'teamsheet-api-football-shadow-collector',subdomain:{enabled:false,previews_enabled:false,preview_url_suffix:'-wrong.example.workers.dev'}});
      return baseFetch(url,init);
    },
    now:()=>NOW
  });
  assert.equal(report.ok,false);
  assert.equal(report.inventory.previewUrlIdentityExact,false);
  assert.equal(report.reason,'attended_stage_inventory_unexpected');
});

test('attended Version provenance remains pinned when the executing repository head advances',async()=>{
  const executionSha='b'.repeat(40);
  const report=await runApiFootballActivationLivePreflight({
    env:{...attendedEnv(),APPROVED_SHA:executionSha,API_FOOTBALL_ATTENDED_VERSION_APPROVED_SHA:APPROVED_SHA},
    fetchImpl:fakeFetch({collectorPresent:true,attended:true,state:d1Rows({credentialState:'AVAILABLE'})}),now:()=>NOW
  });
  assert.equal(report.ok,true);
  assert.equal(report.approvedSha,executionSha);
  assert.equal(report.versionApprovedSha,APPROVED_SHA);
  assert.equal(report.inventory.versionIdentityExact,true);
  assert.equal(report.inventory.versionInventoryExact,true);
});

test('attended Version provenance override fails closed when malformed',async()=>{
  const report=await runApiFootballActivationLivePreflight({
    env:{...attendedEnv(),API_FOOTBALL_ATTENDED_VERSION_APPROVED_SHA:'not-a-sha'},
    fetchImpl:fakeFetch({collectorPresent:true,attended:true}),now:()=>NOW
  });
  assert.equal(report.ok,false);
  assert.equal(report.reason,'activation_attended_version_approved_sha_invalid');
});

test('attended Version provenance fails closed when a different well-formed SHA is supplied',async()=>{
  const report=await runApiFootballActivationLivePreflight({
    env:{...attendedEnv(),API_FOOTBALL_ATTENDED_VERSION_APPROVED_SHA:'c'.repeat(40)},
    fetchImpl:fakeFetch({collectorPresent:true,attended:true}),now:()=>NOW
  });
  assert.equal(report.ok,false);
  assert.equal(report.versionApprovedSha,'c'.repeat(40));
  assert.equal(report.inventory.versionIdentityExact,false);
  assert.equal(report.reason,'attended_stage_inventory_unexpected');
});

for(const [name,mutate] of [
  ['wrong module content',value=>{value.attendedBeta.modules[0].content_base64=Buffer.from('wrong').toString('base64');}],
  ['wrong commit annotation',value=>{value.attendedBeta.annotations['workers/message']='wrong';}],
  ['wrong binding',value=>{value.attendedStable.resources.bindings[0].database_id='wrong';}],
  ['missing module',value=>{value.attendedBeta.modules.pop();}]
])test(`attended live preflight rejects correct UUID with ${name}`,async()=>{
  const report=await runApiFootballActivationLivePreflight({env:attendedEnv(),fetchImpl:fakeFetch({collectorPresent:true,attended:true,mutateAttended:mutate}),now:()=>NOW});
  assert.equal(report.inventory.versionIdentityExact,false);assert.equal(report.ok,false);
});

test('fresh authority may differ from immutable historical mapping provenance when canonical coverage is unchanged',async()=>{
  const state=d1Rows();
  assert.notEqual(state.mappingHead[0].official_fpl_authority_digest,buildAuthority(state.officialRun,state.officialTeams).digest);
  const report=await runApiFootballActivationLivePreflight({env:env(),fetchImpl:fakeFetch({state}),now:()=>NOW});
  assert.equal(report.ok,true);
  assert.equal(report.classification,COLLECTOR_REPOSITORY_STAGE_READY);
  assert.equal(report.mapping.canonicalCoverageMatches,true);
  assert.equal(report.mapping.historicalAuthorityProvenancePresent,true);
});

test('canonical mapping coverage drift still fails closed',async()=>{
  const ids=officialTeams.map(row=>row.subject_entity_id).sort();
  ids[ids.length-1]='2026-27:fpl:team:99';
  const report=await runApiFootballActivationLivePreflight({env:env(),fetchImpl:fakeFetch({state:d1Rows({canonicalTeamIds:ids})}),now:()=>NOW});
  assert.equal(report.ok,false);
  assert.equal(report.reason,'qualified_mapping_unavailable');
});

test('invalid historical mapping provenance still fails closed',async()=>{
  const report=await runApiFootballActivationLivePreflight({env:env(),fetchImpl:fakeFetch({state:d1Rows({historicalAuthorityDigest:'invalid'})}),now:()=>NOW});
  assert.equal(report.ok,false);
  assert.equal(report.reason,'mapping_provenance_invalid');
});

test('existing live collector blocks repository-infrastructure staging admission',async()=>{
  const report=await runApiFootballActivationLivePreflight({env:env(),fetchImpl:fakeFetch({collectorPresent:true}),now:()=>NOW});
  assert.equal(report.ok,false);
  assert.equal(report.reason,'repository_stage_inventory_unexpected');
  assert.match(report.classification,/^STOP_REPOSITORY_INFRASTRUCTURE_STAGING_/);
});

test('Worker presence is reported separately from Deployment count',async()=>{
  const report=await runApiFootballActivationLivePreflight({env:env(),fetchImpl:fakeFetch({collectorPresent:true}),now:()=>NOW});
  assert.equal(report.inventory.workerPresent,true);
  assert.equal(report.inventory.deploymentCount,0);
  assert.equal(report.reason,'repository_stage_inventory_unexpected');
});

test('stale Official FPL authority fails closed',async()=>{
  const state=d1Rows({completedAt:'2026-09-18T12:00:00.000Z'});
  const report=await runApiFootballActivationLivePreflight({env:env(),fetchImpl:fakeFetch({state}),now:()=>NOW});
  assert.equal(report.ok,false);
  assert.equal(report.reason,'official_fpl_authority_stale');
});

test('any D1 rows-written telemetry stops the read-only preflight',async()=>{
  const report=await runApiFootballActivationLivePreflight({env:env(),fetchImpl:fakeFetch({state:d1Rows({rowsWritten:1})}),now:()=>NOW});
  assert.equal(report.ok,false);
  assert.equal(report.reason,'activation_d1_write_detected');
});

test('wrong production account fingerprint fails before any Cloudflare request',async()=>{
  let calls=0;
  const report=await runApiFootballActivationLivePreflight({
    env:{...env(),DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT:'0'.repeat(64)},
    fetchImpl:async()=>{calls+=1;throw new Error('must not fetch');},now:()=>NOW
  });
  assert.equal(report.reason,'activation_production_account_identity_mismatch');
  assert.equal(calls,0);
});

test('production model and browser graph remains isolated from collector persistence',()=>{
  assert.equal(productionModelUiImportCount(),0);
});

test('workflow is manual exact-main read-only and contains no provider or mutation credential',()=>{
  const source=fs.readFileSync(path.join(root,'.github/workflows/api-football-collector-activation-preflight.yml'),'utf8');
  assert.match(source,/workflow_dispatch:/);
  assert.match(source,/github\.run_attempt == 1/);
  assert.match(source,/refs\/heads\/main/);
  assert.match(source,/Tests and deterministic build/);
  assert.match(source,/environment:\s*\n\s*name: data-steward-readonly/);
  assert.match(source,/DATA_STEWARD_CLOUDFLARE_READ_TOKEN/);
  assert.match(source,/activation-live-preflight\.mjs/);
  assert.match(source,/persist-credentials: false/);
  assert.doesNotMatch(source,/API_FOOTBALL_API_KEY/);
  assert.doesNotMatch(source,/OWNER_CROSSWALK|DEPLOY_TOKEN|WORKER_UPLOAD_TOKEN|wrangler\s+deploy|d1\s+execute|v3\.football\.api-sports\.io/);
  assert.doesNotMatch(source,/schedule:/);
  assert.doesNotMatch(source,/push:/);
});


test('script route decoder normalizes Cloudflare no-route encodings without weakening route admission',()=>{
  assert.equal(scriptRouteCount([{id:'teamsheet-api-football-shadow-collector',routes:null}]),0);
  assert.equal(scriptRouteCount([{id:'teamsheet-api-football-shadow-collector'}]),0);
  assert.equal(scriptRouteCount([{id:'teamsheet-api-football-shadow-collector',routes:[]}]),0);
  assert.equal(scriptRouteCount([{id:'teamsheet-api-football-shadow-collector',routes:[{pattern:'example/*'}]}]),1);
  assert.equal(scriptRouteCount([{id:'teamsheet-api-football-shadow-collector',routes:{pattern:'malformed'}}]),null);
  assert.equal(scriptRouteCount(null),null);
});
