import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {ACTIVATION_QUERIES,buildAuthority} from '../workers/api-football-collector/activation-live-preflight.mjs';
import {EXPECTED_D1_DATABASE_ID} from '../workers/data-platform/phase4b/live-contract.mjs';
import {
  API_BASE,ENTRY_MODULE,WORKER_NAME,buildMetadata,deterministicIdentity,resolveModuleGraph
} from '../workers/api-football-collector/inactive-version-staging.mjs';
import {
  runInactiveVersionPostflight,validateD1State
} from '../workers/api-football-collector/inactive-version-postflight.mjs';

const ACCOUNT='synthetic-production-account';
const TOKEN='synthetic-read-token';
const SHA='0123456789abcdef0123456789abcdef01234567';
const WORKER_ID='worker-inert-1',VERSION_ID='version-inactive-1';
const NOW='2026-09-21T18:00:00.000Z';
const FINGERPRINT=createHash('sha256').update(ACCOUNT).digest('hex');
const sources=resolveModuleGraph();
const identity=deterministicIdentity(buildMetadata(SHA),sources);

function env(){return {
  DATA_STEWARD_CLOUDFLARE_READ_TOKEN:TOKEN,
  DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID:ACCOUNT,
  DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT:FINGERPRINT,
  APPROVED_SHA:SHA,STAGED_WORKER_ID:WORKER_ID,STAGED_VERSION_ID:VERSION_ID,
  STAGED_GRAPH_SHA256:identity.graphSha256,STAGED_METADATA_SHA256:identity.metadataSha256
};}
function json(result,status=200){return new Response(JSON.stringify({success:status===200,result}),{status});}
const officialRun={run_id:'official-run',completed_at:'2026-09-21T14:00:00.000Z',status:'completed'};
const officialTeams=Array.from({length:20},(_,index)=>({
  subject_entity_id:'2026-27:fpl:team:'+(index+1),
  observation_id:String(index+1).padStart(64,'0'),
  input_revision:'official-input-'+(index+1),
  logical_key:'official-fpl|2026-27|team|'+(index+1)+'|present'
}));
assert.ok(buildAuthority([officialRun],officialTeams));

function d1Data({attempts=0,generations=0,revisions=0}={}){
  return {
    ledger:[
      {version:1,name:'shadow_data_foundation'},
      {version:2,name:'official_fpl_structured_history'},
      {version:3,name:'production_query_plan_indexes'},
      {version:4,name:'api_football_shadow_identity'},
      {version:5,name:'api_football_shadow_runtime'},
      {version:6,name:'api_football_mapping_qualification'}
    ],
    foreignKeys:[],
    officialRun:[officialRun],
    officialTeams,
    mappingHead:[{
      fpl_season:'2026-27',state:'COMMITTED',mapping_count:20,
      official_fpl_authority_digest:'a'.repeat(64),
      official_fpl_authority_fetched_at:'2026-09-18T10:00:00.000Z'
    }],
    mappingMembers:[{
      member_count:20,distinct_provider_ids:20,distinct_fpl_ids:20,
      canonical_fpl_team_ids:Array.from({length:20},(_,i)=>'2026-27:fpl:team:'+(i+1)).sort().join('|')
    }],
    runtime:[{
      provider:'api-football',collection_enabled:0,credential_state:'UNPROVISIONED',
      in_flight_attempt_id:null,in_flight_lease_expires_at:null
    }],
    attempts:[{total:attempts,attempt2_count:0,reserved_count:0}],
    generations:[{total:generations,staging_count:0}],
    fixtureRevisions:[{total:revisions}]
  };
}
function betaVersion({urls=[]}={}){
  return {
    id:VERSION_ID,main_module:ENTRY_MODULE,compatibility_date:'2026-09-16',
    annotations:{'workers/tag':'api-football-collector-inactive-'+SHA.slice(0,12)},
    bindings:buildMetadata(SHA).bindings,urls,package_dependencies:[],
    modules:[...sources].map(([name,source])=>({
      name,content_type:'application/javascript+module',
      content_base64:Buffer.from(source).toString('base64')
    }))
  };
}
function fakeCloudflare({data=d1Data(),urls=[],rowsWritten=0}={}){
  const bySql=new Map(Object.entries(ACTIVATION_QUERIES).map(([key,sql])=>[sql,key]));
  return async(url,init={})=>{
    const path=String(url).slice(API_BASE.length);
    const script='/accounts/'+ACCOUNT+'/workers/scripts/'+WORKER_NAME;
    const beta='/accounts/'+ACCOUNT+'/workers/workers';
    if(path==='/accounts/'+ACCOUNT+'/d1/database/'+EXPECTED_D1_DATABASE_ID+'?fields=uuid,name,file_size')return json({uuid:EXPECTED_D1_DATABASE_ID,name:'teamsheet-data',file_size:123});
    if(path===beta+'/'+WORKER_ID)return json({
      id:WORKER_ID,name:WORKER_NAME,observability:{enabled:true},
      subdomain:{enabled:false,previews_enabled:false},deployed_on:null
    });
    if(path===script+'/schedules')return json({schedules:[]});
    if(path===script+'/deployments')return json([]);
    if(path===script+'/versions?deployable=true&per_page=100')return json({items:[{id:VERSION_ID}]});
    if(path==='/accounts/'+ACCOUNT+'/workers/domains')return json([]);
    if(path===script+'/subdomain')return json({enabled:false,previews_enabled:false});
    if(path===beta+'/'+WORKER_ID+'/versions/'+VERSION_ID+'?include=modules')return json(betaVersion({urls}));
    if(path==='/accounts/'+ACCOUNT+'/d1/database/'+EXPECTED_D1_DATABASE_ID+'/query'){
      assert.equal(init.method,'POST');
      const body=JSON.parse(init.body);
      return json(body.batch.map(statement=>{
        const key=bySql.get(statement.sql);assert.ok(key,'unexpected SQL');
        return {success:true,results:data[key],meta:{rows_read:Array.isArray(data[key])?data[key].length:0,rows_written:rowsWritten}};
      }));
    }
    throw new Error('unexpected request '+path);
  };
}

test('read-only postflight proves exact inert Version and pristine production collector history',async()=>{
  const report=await runInactiveVersionPostflight({env:env(),fetchImpl:fakeCloudflare(),now:()=>NOW});
  assert.equal(report.ok,true);
  assert.equal(report.workerId,WORKER_ID);
  assert.equal(report.versionId,VERSION_ID);
  assert.deepEqual(report.state,{authorityTeamCount:20,mappingCount:20,requestAttempts:0,generations:0,fixtureRevisions:0});
  assert.deepEqual(report.evidence.apiFootballRequests,0);
  assert.deepEqual(report.evidence.productionMutations,0);
  assert.deepEqual(report.evidence.secretValuesRead,0);
});

test('any collector history fails the postflight instead of being normalized away',async()=>{
  await assert.rejects(()=>runInactiveVersionPostflight({
    env:env(),fetchImpl:fakeCloudflare({data:d1Data({attempts:1})}),now:()=>NOW
  }),/postflight_history_not_pristine/);
});

test('a routable Version URL fails closed',async()=>{
  await assert.rejects(()=>runInactiveVersionPostflight({
    env:env(),fetchImpl:fakeCloudflare({urls:['https://example.workers.dev']}),now:()=>NOW
  }),/staging_version_routable_url_present/);
});

test('D1 telemetry showing a write fails the read-only contract',async()=>{
  await assert.rejects(()=>runInactiveVersionPostflight({
    env:env(),fetchImpl:fakeCloudflare({rowsWritten:1}),now:()=>NOW
  }),/postflight_d1_write_detected/);
});

test('D1 classifier independently rejects runtime, mapping and history drift',()=>{
  const good=d1Data();
  assert.equal(validateD1State(good,{now:NOW}).requestAttempts,0);
  assert.throws(()=>validateD1State({...good,runtime:[{...good.runtime[0],credential_state:'AVAILABLE'}]},{now:NOW}),/postflight_runtime_drift/);
  assert.throws(()=>validateD1State({...good,mappingHead:[{...good.mappingHead[0],mapping_count:19}]},{now:NOW}),/postflight_mapping_incomplete/);
  assert.throws(()=>validateD1State({...good,fixtureRevisions:[{total:1}]},{now:NOW}),/postflight_history_not_pristine/);
});

test('postflight executable has no general mutation surface or provider origin',()=>{
  const source=await import('node:fs').then(fs=>fs.readFileSync('workers/api-football-collector/inactive-version-postflight.mjs','utf8'));
  assert.doesNotMatch(source,/v3\.football\.api-sports\.io/);
  assert.doesNotMatch(source,/\b(?:PUT|PATCH|DELETE)\b/);
  assert.match(source,/rows_written/);
  assert.match(source,/productionMutations:0/);
  assert.match(source,/apiFootballRequests:0/);
});
