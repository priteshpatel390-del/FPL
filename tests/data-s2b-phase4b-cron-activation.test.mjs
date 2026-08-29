import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as cron from '../workers/data-platform/phase4b/activate-cron.mjs';

const helper=fs.readFileSync('workers/data-platform/phase4b/activate-cron.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/data-s2b-phase4b-cron-activation.yml','utf8');
const scheduleResult=crons=>({schedules:crons.map(value=>({cron:value,created_on:'fixture'}))});

test('production identity, candidate, rollback and cadence pins are exact',()=>{
  assert.equal(cron.CANDIDATE_VERSION_ID,'733093ef-e01f-43a8-828a-0c8c67e7626f');
  assert.equal(cron.ROLLBACK_VERSION_ID,'3a2b065a-6527-4887-9bf8-b08e82e81133');
  assert.equal(cron.EXPECTED_CRON,'*/30 * * * *');
  assert.equal(cron.EXPECTED_PRODUCTION_HOSTNAME,'data.fpltsheet.co.uk');
  assert.equal(cron.EXPECTED_COMPATIBILITY_DATE,'2026-08-22');assert.equal(cron.EXPECTED_SEASON,'2026-27');
});
test('binding, D1 governance and pre-Cron anchors are exact',()=>{
  assert.deepEqual([...cron.EXPECTED_BINDINGS],[['TEAMSHEET_DATA_DB','d1'],['DATA_S1_HTTP_AUTH_TOKEN','secret_text'],['DATA_S2_SEASON','plain_text']]);
  assert.equal(cron.EXPECTED_D1_SIZE_BYTES,151552);assert.deepEqual(cron.validateSchedules(scheduleResult([]),[]),[]);
  assert.match(helper,/validatePostPhase1State\(state\)/);assert.match(helper,/PHASE0_QUERIES\.officialHistory/);
  assert.doesNotMatch(helper,/DATA_S1_HTTP_AUTH_TOKEN.*\.text|binding\.text.*DATA_S1_HTTP_AUTH_TOKEN/);
});
test('the sole mutation allowlist is exact schedules PUT with one exact body',()=>{
  const base='/accounts/a/workers/scripts/teamsheet-data-platform';
  assert.equal(cron.assertCronMutation('PUT',`${base}/schedules`,base),true);assert.deepEqual(cron.activationBody(),[{cron:'*/30 * * * *'}]);
  for(const [method,path] of [['POST',`${base}/schedules`],['PUT',`${base}/versions`],['POST',`${base}/deployments`],['PUT',`${base}/secrets`],['POST','/accounts/a/d1/database/x/query'],['PUT','/accounts/a/workers/domains'],['POST','/accounts/a/access/apps']])assert.throws(()=>cron.assertCronMutation(method,path,base),/mutation_endpoint_forbidden/);
});
test('executable schedule fixtures classify reconciliation without guessing',()=>{
  assert.equal(cron.classifyScheduleReconciliation(scheduleResult(['*/30 * * * *'])),'TARGET_PRESENT');
  assert.equal(cron.classifyScheduleReconciliation(scheduleResult([])),'ABSENT');
  assert.equal(cron.classifyScheduleReconciliation(scheduleResult(['0 * * * *'])),'UNEXPECTED');
  assert.equal(cron.classifyScheduleReconciliation({broken:true}),'UNPROVABLE');
  assert.throws(()=>cron.validateSchedules(scheduleResult(['0 * * * *']),['*/30 * * * *']),/state_drift/);
});
test('schedule PUT timeout is bounded and classified as an ambiguous mutation',async()=>{
  const durations=[];let calls=0;
  await assert.rejects(cron.fetchTextBounded({url:'https://api.cloudflare.test/schedules',options:{method:'PUT'},mutation:true,fetchFn:async(_url,options)=>{calls++;assert.equal(options.method,'PUT');assert.deepEqual(options.signal,{bounded:true});throw new DOMException('timed out','TimeoutError');},timeoutSignal:milliseconds=>{durations.push(milliseconds);return {bounded:true};}}),/phase4b_cron_mutation_ambiguous/);
  assert.equal(calls,1);assert.deepEqual(durations,[cron.REQUEST_TIMEOUT_MS]);assert.equal(cron.REQUEST_TIMEOUT_MS,15000);
});
test('ordinary read timeout fails closed as a transport failure',async()=>{
  let calls=0;
  await assert.rejects(cron.fetchTextBounded({url:'https://api.cloudflare.test/deployments',fetchFn:async()=>{calls++;throw new DOMException('timed out','TimeoutError');},timeoutSignal:()=>({bounded:true})}),/phase4b_cron_api_transport_failed/);
  assert.equal(calls,1);
});
test('ambiguous timeout performs one GET and TARGET_PRESENT alone reaches postflight',async()=>{
  let puts=0,gets=0,postflights=0;
  await cron.executeScheduleActivation({mutate:async()=>{puts++;throw new Error('phase4b_cron_mutation_ambiguous');},readSchedules:async()=>{gets++;return scheduleResult([cron.EXPECTED_CRON]);},postflight:async()=>{postflights++;}});
  assert.deepEqual({puts,gets,postflights},{puts:1,gets:1,postflights:1});
});
for(const [name,result,diagnostic] of [
  ['ABSENT',scheduleResult([]),'absent'],
  ['UNEXPECTED',scheduleResult(['0 * * * *']),'unexpected'],
  ['UNPROVABLE',null,'unprovable']
])test(`ambiguous timeout reconciliation ${name} stops with no second PUT`,async()=>{
  let puts=0,gets=0,postflights=0;
  await assert.rejects(cron.executeScheduleActivation({mutate:async()=>{puts++;throw new Error('phase4b_cron_mutation_ambiguous');},readSchedules:async()=>{gets++;if(result===null)throw new Error('read timeout');return result;},postflight:async()=>{postflights++;}}),new RegExp(`ambiguous_${diagnostic}_stop_no_retry`));
  assert.deepEqual({puts,gets,postflights},{puts:1,gets:1,postflights:0});
});
test('definite 4xx, 5xx and malformed response contracts remain fail closed',()=>{
  assert.match(helper,/response\.status>=500/);assert.match(helper,/phase4b_cron_mutation_ambiguous/);
  assert.match(helper,/ambiguous_.*_stop_no_retry/);assert.doesNotMatch(helper,/while\s*\(/);
  assert.ok(helper.indexOf("if(!classified.ok)")<helper.indexOf("response.status>=500"));
});
test('postflight proves schedule exactness and immutable Version, Deployment, D1 and domain state',()=>{
  assert.match(helper,/postflight:async\(\)=>\{await snapshot\(\[EXPECTED_CRON\],before\);await snapshot\(\[EXPECTED_CRON\],before\);\}/);
  assert.match(helper,/phase4b_cron_worker_version_created/);assert.match(helper,/phase4b_cron_deployment_changed/);
  assert.match(helper,/phase4b_cron_d1_changed/);assert.match(helper,/phase4b_cron_domain_changed/);
  assert.match(helper,/body\?\.ok!==true\|\|body\?\.mode!=='shadow_only'/);
});
test('activation has no automatic rollback and never invokes runtime or collector paths',()=>{
  assert.doesNotMatch(helper,/scheduled\s*\(|collectOfficial|runOfficial|ROLLBACK_REQUIRED|deploy\s*\(|wrangler/);
  assert.match(helper,/stop_no_retry/);assert.equal((helper.match(/assertCronMutation\(/g)??[]).length,2);
});
test('workflow is manual-only, exact-main gated and protects credentials until CI passes',()=>{
  for(const pattern of [/workflow_dispatch:/,/approved_sha:/,/refs\/heads\/main/,/git ls-remote/,/git status --porcelain/,/Tests and deterministic build/,/environment:\s*\n\s+name: data-s2b-phase3-deployment/,/node-version: 24\.19\.0/,/cancel-in-progress: false/,/if: \$\{\{ always\(\) \}\}/])assert.match(workflow,pattern);
  assert.doesNotMatch(workflow,/\n\s+(?:push|pull_request|schedule):/);
  assert.ok(workflow.indexOf('Require exact-head repository tests and deterministic build')<workflow.indexOf('CLOUDFLARE_PHASE4B_CRON_TOKEN'));
});
test('workflow invokes only the dedicated mutation helper and no deploy, trigger or collector command',()=>{
  const invocations=workflow.match(/node workers\/data-platform\/phase4b\/[^\s]+/g)??[];
  assert.deepEqual(invocations,['node workers/data-platform/phase4b/activate-cron.mjs']);
  assert.doesNotMatch(workflow,/wrangler\s+(?:deploy|triggers)|upload-version\.mjs|deploy-version\.mjs|scheduled\(|collector/);
});
