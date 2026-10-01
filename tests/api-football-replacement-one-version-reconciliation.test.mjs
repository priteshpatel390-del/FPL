import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {expectedAttendedBindings} from '../workers/api-football-collector/attended-version.mjs';
import {buildUploadModules,resolveModuleGraph} from '../workers/api-football-collector/stage-inactive-version.mjs';
import {buildReplacementIdentity,ORIGINAL_COLLECTOR,REPLACEMENT_COLLECTOR,REPLACEMENT_RECOVERY_WORKER_ID,replacementPaths} from '../workers/api-football-collector/replacement-foundation.mjs';
import {readReplacementRouteTopology,readReplacementState} from '../workers/api-football-collector/replacement-reconciliation.mjs';
import {
  REPLACEMENT_LIVE_VERSION_APPROVED_SHA,REPLACEMENT_LIVE_VERSION_ID,runReplacementOneVersionReconciliation
} from '../workers/api-football-collector/replacement-one-version-reconciliation.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ACCOUNT='account-123',EXEC_SHA='f'.repeat(40),READ_TOKEN='workers-read-token',TOPOLOGY_TOKEN='topology-read-token';
const FINGERPRINT=createHash('sha256').update(ACCOUNT).digest('hex');
const API='https://api.cloudflare.com/client/v4';
const ok=(result,result_info)=>new Response(JSON.stringify({success:true,result,...(result_info?{result_info}:{})}),{status:200,headers:{'content-type':'application/json'}});
const env={APPROVED_SHA:EXEC_SHA,CLOUDFLARE_ACCOUNT_ID:ACCOUNT,CLOUDFLARE_ACCOUNT_FINGERPRINT:FINGERPRINT,
  CLOUDFLARE_REPLACEMENT_READ_TOKEN:READ_TOKEN,CLOUDFLARE_REPLACEMENT_TOPOLOGY_READ_TOKEN:TOPOLOGY_TOKEN};

function fixtureVersion(){
  const identity=buildReplacementIdentity(REPLACEMENT_LIVE_VERSION_APPROVED_SHA),modules=buildUploadModules(resolveModuleGraph());
  return {
    stable:{id:REPLACEMENT_LIVE_VERSION_ID,resources:{script_runtime:{compatibility_date:identity.compatibilityDate},bindings:structuredClone(expectedAttendedBindings())}},
    beta:{id:REPLACEMENT_LIVE_VERSION_ID,main_module:identity.mainModule,compatibility_date:identity.compatibilityDate,
      annotations:{'workers/message':identity.message,'workers/tag':identity.tag},
      modules:[...modules].map(([name,source])=>({name,content_base64:Buffer.from(source).toString('base64')}))}
  };
}

function fakeCloudflare({preview=false,replacementRoute=false,legacyScript=false,workerDeployed=false,domain=false}={}){
  const paths=replacementPaths(ACCOUNT),fx=fixtureVersion(),calls=[];
  const worker={id:REPLACEMENT_RECOVERY_WORKER_ID,name:REPLACEMENT_COLLECTOR,deployed_on:workerDeployed?'2026-10-01T00:00:00Z':null};
  const fetchImpl=async(url,init={})=>{
    const parsed=new URL(url),method=(init.method||'GET').toUpperCase(),auth=init.headers?.Authorization;calls.push({url:String(url),method,auth});
    assert.equal(method,'GET');
    if(parsed.pathname==='/client/v4/zones'){
      assert.equal(auth,'Bearer '+TOPOLOGY_TOKEN);assert.equal(parsed.searchParams.get('account.id'),ACCOUNT);
      return ok([{id:'zone-a',account:{id:ACCOUNT}},{id:'zone-b',account:{id:ACCOUNT}}],{page:1,per_page:50,total_count:2,total_pages:1});
    }
    if(parsed.pathname==='/client/v4/zones/zone-a/workers/routes'){
      assert.equal(auth,'Bearer '+TOPOLOGY_TOKEN);
      return ok(replacementRoute?[{id:'route-a',pattern:'example.com/*',script:REPLACEMENT_COLLECTOR}]:[{id:'route-a',pattern:'example.com/*',script:'other-worker'}]);
    }
    if(parsed.pathname==='/client/v4/zones/zone-b/workers/routes'){assert.equal(auth,'Bearer '+TOPOLOGY_TOKEN);return ok([]);}
    assert.equal(auth,'Bearer '+READ_TOKEN);
    const full=String(url).slice(API.length),p=full.split('?')[0];
    if(full===paths.betaWorkers)return ok([worker]);
    if(p===paths.scripts)return ok([{id:ORIGINAL_COLLECTOR,routes:[]},...(legacyScript?[{id:REPLACEMENT_COLLECTOR,routes:[]}]:[])]);
    if(p===paths.domains)return ok(domain?[{service:REPLACEMENT_COLLECTOR}]:[]);
    if(p===paths.replacementSubdomain)return ok({enabled:false,previews_enabled:preview});
    if(p===paths.replacementDeployments)return ok({deployments:[]});
    if(p===paths.replacementSchedules)return ok({schedules:[]});
    if(full===paths.replacementVersions)return ok({items:[{id:REPLACEMENT_LIVE_VERSION_ID}]});
    if(p===paths.replacement+'/'+REPLACEMENT_LIVE_VERSION_ID)return ok(fx.stable);
    if(full===paths.createShell+'/'+REPLACEMENT_RECOVERY_WORKER_ID+'/versions/'+REPLACEMENT_LIVE_VERSION_ID+'?include=modules')return ok(fx.beta);
    throw new Error('unexpected '+String(url));
  };
  return {fetchImpl,calls};
}

test('independent zone route scan proves zero replacement routes without retaining zone identity',async()=>{
  const fake=fakeCloudflare(),proof=await readReplacementRouteTopology({account:ACCOUNT,topologyToken:TOPOLOGY_TOKEN,fetchImpl:fake.fetchImpl});
  assert.deepEqual(proof,{proof:'ZONE_ROUTE_SCAN',zoneCount:2,routeCount:0});
  assert.equal(JSON.stringify(proof).includes('zone-a'),false);
});

test('one-Version state is provable when legacy Scripts row is still absent',async()=>{
  const fake=fakeCloudflare(),state=await readReplacementState({account:ACCOUNT,token:READ_TOKEN,topologyToken:TOPOLOGY_TOKEN,
    versionId:REPLACEMENT_LIVE_VERSION_ID,approvedSha:EXEC_SHA,versionApprovedSha:REPLACEMENT_LIVE_VERSION_APPROVED_SHA,fetchImpl:fake.fetchImpl});
  assert.equal(state.scriptPresent,false);assert.equal(state.routeProof,'ZONE_ROUTE_SCAN');assert.equal(state.routeCount,0);assert.equal(state.topologyZoneCount,2);
  assert.equal(state.versionIdentityExact,true);assert.equal(state.workerDeployedOnNull,true);assert.equal(state.previewUrls,false);
});

test('one-Version state without independent route credential fails closed instead of assuming zero routes',async()=>{
  const fake=fakeCloudflare();
  await assert.rejects(readReplacementState({account:ACCOUNT,token:READ_TOKEN,versionId:REPLACEMENT_LIVE_VERSION_ID,approvedSha:EXEC_SHA,
    versionApprovedSha:REPLACEMENT_LIVE_VERSION_APPROVED_SHA,fetchImpl:fake.fetchImpl}),/replacement_reconciliation_route_proof_required/);
});

test('historical Version provenance remains distinct from later execution main',async()=>{
  const fake=fakeCloudflare(),report=await runReplacementOneVersionReconciliation({env,fetchImpl:fake.fetchImpl});
  assert.equal(report.ok,true);assert.equal(report.classification,'REPLACEMENT_ONE_VERSION_INACTIVE_RECONCILED');
  assert.equal(report.approvedSha,EXEC_SHA);assert.equal(report.versionApprovedSha,REPLACEMENT_LIVE_VERSION_APPROVED_SHA);
  assert.equal(report.replacement.versionIdentityExact,true);assert.equal(report.productionMutations,0);assert.equal(report.apiFootballRequests,0);
});

test('zone route targeting replacement fails the exact inactive-state proof',async()=>{
  const fake=fakeCloudflare({replacementRoute:true}),report=await runReplacementOneVersionReconciliation({env,fetchImpl:fake.fetchImpl});
  assert.equal(report.ok,false);assert.equal(report.classification,'REPLACEMENT_ONE_VERSION_OWNER_ATTENTION_REQUIRED');
  assert.equal(report.reason,'replacement_one_version_state_invalid');assert.equal(report.replacement.routeCount,1);
});

test('Preview still enabled is reported explicitly without any mutation',async()=>{
  const fake=fakeCloudflare({preview:true}),report=await runReplacementOneVersionReconciliation({env,fetchImpl:fake.fetchImpl});
  assert.equal(report.ok,false);assert.equal(report.classification,'REPLACEMENT_ONE_VERSION_PREVIEW_ENABLED_OWNER_ATTENTION');
  assert.equal(report.reason,'replacement_one_version_preview_still_enabled');assert.equal(report.productionMutations,0);
  assert.ok(fake.calls.every(row=>row.method==='GET'));
});

test('topology credential is distinct and sanitized evidence excludes credential material',async()=>{
  const fake=fakeCloudflare(),report=await runReplacementOneVersionReconciliation({env,fetchImpl:fake.fetchImpl});
  const serialized=JSON.stringify(report);assert.equal(serialized.includes(READ_TOKEN),false);assert.equal(serialized.includes(TOPOLOGY_TOKEN),false);
  await assert.rejects(runReplacementOneVersionReconciliation({env:{...env,CLOUDFLARE_REPLACEMENT_TOPOLOGY_READ_TOKEN:READ_TOKEN},fetchImpl:fake.fetchImpl}),/replacement_one_version_identity_invalid/);
});

test('read-only reconciliation workflow is manual, exact-main gated and has no mutation/provider secret path',()=>{
  const yml=fs.readFileSync(path.join(root,'.github/workflows/api-football-replacement-one-version-reconciliation.yml'),'utf8');
  assert.match(yml,/^on:\n  workflow_dispatch:\n/m);assert.match(yml,/github\.run_attempt == 1/);
  assert.match(yml,/Tests and deterministic build/);assert.match(yml,/CLOUDFLARE_REPLACEMENT_TOPOLOGY_READ_TOKEN/);
  assert.match(yml,new RegExp(REPLACEMENT_LIVE_VERSION_ID));
  assert.doesNotMatch(yml,/CLOUDFLARE_REPLACEMENT_MUTATION_TOKEN|API_FOOTBALL_API_KEY|API_FOOTBALL_ATTENDED_TRIGGER_SECRET|wrangler deploy|versions deploy/);
});
