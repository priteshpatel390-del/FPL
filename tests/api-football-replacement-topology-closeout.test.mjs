import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {REPLACEMENT_COLLECTOR,REPLACEMENT_RECOVERY_WORKER_ID,replacementPaths} from '../workers/api-football-collector/replacement-foundation.mjs';
import {runReplacementTopologyCloseout} from '../workers/api-football-collector/replacement-topology-closeout.mjs';

const ACCOUNT='acct-restart';
const READ_TOKEN='read-token';
const TOPOLOGY_TOKEN='topology-token';
const APPROVED_SHA='a88512b2f24977f32d378e7b4658864475f72843';
const API='https://api.cloudflare.com/client/v4';
const fingerprint=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ACCOUNT)).then(buffer=>Buffer.from(buffer).toString('hex'));
const env={
  CLOUDFLARE_ACCOUNT_ID:ACCOUNT,
  CLOUDFLARE_ACCOUNT_FINGERPRINT:fingerprint,
  APPROVED_SHA,
  CLOUDFLARE_REPLACEMENT_READ_TOKEN:READ_TOKEN,
  CLOUDFLARE_REPLACEMENT_TOPOLOGY_READ_TOKEN:TOPOLOGY_TOKEN
};

function response(result,{pages}={}){
  return {ok:true,status:200,async json(){return {success:true,result,...(pages===undefined?{}:{result_info:{total_pages:pages}})};}};
}

function fakeCloudflare({preview=false,workersDev=false,deployment=false,cron=false,route=false,domain=false,workerAbsent=false}={}){
  const paths=replacementPaths(ACCOUNT),calls=[];
  const fetchImpl=async(url,init={})=>{
    calls.push({url:String(url),method:init.method||'GET',authorization:init.headers?.Authorization});
    assert.equal(init.method||'GET','GET');
    const parsed=new URL(url),auth=init.headers?.Authorization;
    if(parsed.pathname==='/client/v4/zones'){
      assert.equal(auth,'Bearer '+TOPOLOGY_TOKEN);
      return response([{id:'zone-a',account:{id:ACCOUNT}}],{pages:1});
    }
    if(parsed.pathname==='/client/v4/zones/zone-a/workers/routes'){
      assert.equal(auth,'Bearer '+TOPOLOGY_TOKEN);
      return response(route?[{id:'route-1',pattern:'example.com/*',script:REPLACEMENT_COLLECTOR}]:[]);
    }
    assert.equal(auth,'Bearer '+READ_TOKEN);
    const full=String(url).slice(API.length),path=full.split('?')[0];
    if(full===paths.betaWorkers)return response(workerAbsent?[]:[{id:REPLACEMENT_RECOVERY_WORKER_ID,name:REPLACEMENT_COLLECTOR,deployed_on:deployment?'2026-10-06T00:00:00Z':null}]);
    if(path===paths.scripts)return response(workerAbsent?[]:[{id:REPLACEMENT_COLLECTOR,routes:null}]);
    if(path===paths.domains)return response(domain?[{service:REPLACEMENT_COLLECTOR}]:[]);
    if(workerAbsent)throw new Error('unexpected replacement detail read for absent worker');
    if(path===paths.replacementSubdomain)return response({enabled:workersDev,previews_enabled:preview});
    if(path===paths.replacementDeployments)return response({deployments:deployment?[{id:'deployment-1'}]:[]});
    if(path===paths.replacementSchedules)return response({schedules:cron?[{cron:'15 * * * *'}]:[]});
    if(full===paths.replacementVersions)return response([{id:'995b0396-a61e-4bee-a405-aa6b3f765e5c'}]);
    throw new Error('unexpected endpoint '+full);
  };
  return {fetchImpl,calls};
}

test('topology closeout proves an existing abandoned replacement is traffic-inert without Version-detail reads',async()=>{
  const fake=fakeCloudflare(),result=await runReplacementTopologyCloseout({env,fetchImpl:fake.fetchImpl});
  assert.equal(result.ok,true);
  assert.equal(result.classification,'REPLACEMENT_ABANDONED_TOPOLOGY_SAFE');
  assert.equal(result.topologySafeProved,true);
  assert.equal(result.topology.versionCount,1);
  assert.equal(result.topology.deploymentCount,0);
  assert.equal(result.topology.cronCount,0);
  assert.equal(result.topology.routeCount,0);
  assert.equal(result.topology.customDomainCount,0);
  assert.equal(result.topology.workersDev,false);
  assert.equal(result.topology.previewUrls,false);
  assert.equal(fake.calls.some(call=>call.url.includes('/995b0396-a61e-4bee-a405-aa6b3f765e5c')),false);
  assert.equal(result.productionMutations,0);
  assert.equal(result.apiFootballRequests,0);
  assert.equal(result.secretValuesRead,0);
});

test('an absent replacement is also a safe terminal topology when no route or domain targets it',async()=>{
  const fake=fakeCloudflare({workerAbsent:true}),result=await runReplacementTopologyCloseout({env,fetchImpl:fake.fetchImpl});
  assert.equal(result.ok,true);
  assert.equal(result.topology.present,false);
  assert.equal(result.topology.routeCount,0);
  assert.equal(result.topology.customDomainCount,0);
});

test('any traffic-capable replacement topology fails closeout',async()=>{
  for(const options of [{preview:true},{workersDev:true},{deployment:true},{cron:true},{route:true},{domain:true}]){
    const fake=fakeCloudflare(options),result=await runReplacementTopologyCloseout({env,fetchImpl:fake.fetchImpl});
    assert.equal(result.ok,false,JSON.stringify(options));
    assert.equal(result.classification,'REPLACEMENT_ABANDONED_TOPOLOGY_OWNER_ATTENTION');
    assert.equal(result.reason,'replacement_topology_not_inert');
  }
});

test('closeout output never retains read credentials or arbitrary remote details',async()=>{
  const fake=fakeCloudflare({route:true}),result=await runReplacementTopologyCloseout({env,fetchImpl:fake.fetchImpl});
  const serialized=JSON.stringify(result);
  assert.equal(serialized.includes(READ_TOKEN),false);
  assert.equal(serialized.includes(TOPOLOGY_TOKEN),false);
  assert.equal(serialized.includes('example.com'),false);
  assert.equal(serialized.includes('route-1'),false);
});

test('workflow is manual, exact-main, read-only and provider-secret-free',()=>{
  const workflow=fs.readFileSync('.github/workflows/api-football-replacement-topology-closeout.yml','utf8');
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/github\.run_attempt == 1/);
  assert.match(workflow,/refs\/heads\/main/);
  assert.match(workflow,/Tests and deterministic build/);
  assert.match(workflow,/data-steward-readonly/);
  assert.match(workflow,/CLOUDFLARE_REPLACEMENT_TOPOLOGY_READ_TOKEN/);
  assert.doesNotMatch(workflow,/API_FOOTBALL_API_KEY/);
  assert.doesNotMatch(workflow,/API_FOOTBALL_ATTENDED_TRIGGER_SECRET/);
  assert.doesNotMatch(workflow,/D1_MUTATION|MUTATION_TOKEN|previews_enabled=true|workers_dev=true/);
});
