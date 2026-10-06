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

function fakeCloudflare({preview=false,replacementRoute=false,zoneARoutes=undefined,legacyScript=false,legacyRoutes=[],legacyRoutesMissing=false,workerDeployed=false,domain=false,readFailure=null}={}){
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
      const rows=zoneARoutes!==undefined?zoneARoutes:(replacementRoute?[{id:'route-a',pattern:'example.com/*',script:REPLACEMENT_COLLECTOR}]:[{id:'route-a',pattern:'example.com/*',script:'other-worker'}]);
      return ok(rows);
    }
    if(parsed.pathname==='/client/v4/zones/zone-b/workers/routes'){assert.equal(auth,'Bearer '+TOPOLOGY_TOKEN);return ok([]);}
    assert.equal(auth,'Bearer '+READ_TOKEN);
    const full=String(url).slice(API.length),p=full.split('?')[0];
    const failedPath=
      (readFailure==='worker_inventory'&&full===paths.betaWorkers)||
      (readFailure==='legacy_scripts'&&p===paths.scripts)||
      (readFailure==='custom_domains'&&p===paths.domains)||
      (readFailure==='subdomain'&&p===paths.replacementSubdomain)||
      (readFailure==='deployments'&&p===paths.replacementDeployments)||
      (readFailure==='schedules'&&p===paths.replacementSchedules)||
      (readFailure==='version_inventory'&&full===paths.replacementVersions)||
      (readFailure==='stable_version'&&p===paths.replacement+'/'+REPLACEMENT_LIVE_VERSION_ID)||
      (readFailure==='beta_version'&&full===paths.createShell+'/'+REPLACEMENT_RECOVERY_WORKER_ID+'/versions/'+REPLACEMENT_LIVE_VERSION_ID+'?include=modules');
    if(failedPath)throw new Error('private transport detail must not escape');
    if(full===paths.betaWorkers)return ok([worker]);
    if(p===paths.scripts)return ok([{id:ORIGINAL_COLLECTOR,routes:[]},...(legacyScript?[{id:REPLACEMENT_COLLECTOR,...(legacyRoutesMissing?{}:{routes:legacyRoutes})}]:[])]);
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
  assert.deepEqual(proof,{proof:'ZONE_ROUTE_SCAN',zoneCount:2,routeRowCount:1,routeCount:0});
  assert.equal(JSON.stringify(proof).includes('zone-a'),false);
});

test('one-Version state is provable when legacy Scripts row is still absent',async()=>{
  const fake=fakeCloudflare(),state=await readReplacementState({account:ACCOUNT,token:READ_TOKEN,topologyToken:TOPOLOGY_TOKEN,
    versionId:REPLACEMENT_LIVE_VERSION_ID,approvedSha:EXEC_SHA,versionApprovedSha:REPLACEMENT_LIVE_VERSION_APPROVED_SHA,fetchImpl:fake.fetchImpl});
  assert.equal(state.scriptPresent,false);assert.equal(state.routeProof,'ZONE_ROUTE_SCAN');assert.equal(state.routeCount,0);assert.equal(state.topologyZoneCount,2);assert.equal(state.topologyRouteRowCount,1);
  assert.equal(state.versionIdentityExact,true);assert.equal(state.workerDeployedOnNull,true);assert.equal(state.previewUrls,false);
});

test('standard Cloudflare read failures retain only endpoint-class diagnostics',async()=>{
  const cases=[
    ['worker_inventory','replacement_reconciliation_worker_inventory_read_failed'],
    ['legacy_scripts','replacement_reconciliation_legacy_scripts_read_failed'],
    ['custom_domains','replacement_reconciliation_custom_domains_read_failed'],
    ['subdomain','replacement_reconciliation_subdomain_read_failed'],
    ['deployments','replacement_reconciliation_deployments_read_failed'],
    ['schedules','replacement_reconciliation_schedules_read_failed'],
    ['version_inventory','replacement_reconciliation_version_inventory_read_failed'],
    ['stable_version','replacement_reconciliation_stable_version_read_failed'],
    ['beta_version','replacement_reconciliation_beta_version_read_failed']
  ];
  for(const [readFailure,reason] of cases){
    const fake=fakeCloudflare({readFailure}),report=await runReplacementOneVersionReconciliation({env,fetchImpl:fake.fetchImpl});
    assert.equal(report.ok,false);assert.equal(report.classification,'REPLACEMENT_ONE_VERSION_OWNER_ATTENTION_REQUIRED');
    assert.equal(report.reason,reason);assert.equal(report.replacement,null);
    assert.equal(JSON.stringify(report).includes('private transport detail'),false);
  }
});

test('route inventory failures retain only closed field-level diagnostics',async()=>{
  const cases=[
    [{zoneARoutes:{}},'replacement_reconciliation_zone_route_result_invalid'],
    [{zoneARoutes:[null]},'replacement_reconciliation_zone_route_row_invalid'],
    [{zoneARoutes:[{pattern:'private.example/*',script:'other-worker'}]},'replacement_reconciliation_zone_route_id_invalid'],
    [{zoneARoutes:[{id:'route-private',script:'other-worker'}]},'replacement_reconciliation_zone_route_pattern_invalid'],
    [{zoneARoutes:[{id:'route-private',pattern:'private.example/*',script:{name:'secret-worker'}}]},'replacement_reconciliation_zone_route_script_invalid']
  ];
  for(const [options,reason] of cases){
    const fake=fakeCloudflare(options),report=await runReplacementOneVersionReconciliation({env,fetchImpl:fake.fetchImpl});
    assert.equal(report.ok,false);assert.equal(report.reason,reason);assert.equal(report.replacement,null);
    const serialized=JSON.stringify(report);
    assert.equal(serialized.includes('private.example'),false);assert.equal(serialized.includes('route-private'),false);assert.equal(serialized.includes('secret-worker'),false);
  }
});

test('legacy Scripts null routes are unavailable metadata and independent zone scan remains authoritative',async()=>{
  const fake=fakeCloudflare({legacyScript:true,legacyRoutes:null}),report=await runReplacementOneVersionReconciliation({env,fetchImpl:fake.fetchImpl});
  assert.equal(report.ok,true);assert.equal(report.classification,'REPLACEMENT_ONE_VERSION_INACTIVE_RECONCILED');
  assert.equal(report.replacement.scriptPresent,true);assert.equal(report.replacement.legacyRouteCount,null);
  assert.equal(report.replacement.routeProof,'ZONE_ROUTE_SCAN');assert.equal(report.replacement.routeCount,0);
});

test('legacy Scripts missing routes are unavailable metadata and independent zone scan remains authoritative',async()=>{
  const fake=fakeCloudflare({legacyScript:true,legacyRoutesMissing:true}),report=await runReplacementOneVersionReconciliation({env,fetchImpl:fake.fetchImpl});
  assert.equal(report.ok,true);assert.equal(report.classification,'REPLACEMENT_ONE_VERSION_INACTIVE_RECONCILED');
  assert.equal(report.replacement.scriptPresent,true);assert.equal(report.replacement.legacyRouteCount,null);
  assert.equal(report.replacement.routeProof,'ZONE_ROUTE_SCAN');assert.equal(report.replacement.routeCount,0);
});

test('legacy Scripts non-null non-array routes still fail closed',async()=>{
  const fake=fakeCloudflare({legacyScript:true,legacyRoutes:{unexpected:true}}),report=await runReplacementOneVersionReconciliation({env,fetchImpl:fake.fetchImpl});
  assert.equal(report.ok,false);assert.equal(report.reason,'replacement_reconciliation_legacy_route_inventory_invalid');assert.equal(report.replacement,null);
});

test('legacy Scripts array still cross-checks the authoritative zone route scan',async()=>{
  const fake=fakeCloudflare({legacyScript:true,legacyRoutes:[{id:'legacy-route'}]}),report=await runReplacementOneVersionReconciliation({env,fetchImpl:fake.fetchImpl});
  assert.equal(report.ok,false);assert.equal(report.reason,'replacement_reconciliation_route_inventory_mismatch');assert.equal(report.replacement,null);
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
