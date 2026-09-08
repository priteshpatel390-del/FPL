import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readStewardEnvironment,runObserver,sanitizedSummary}
  from '../workers/data-steward/run-observer.mjs';
import {STEWARD_ENVIRONMENT_NAMES} from '../workers/data-steward/sentinels/environment-contract.mjs';

const workflowPath='.github/workflows/data-steward-readonly-observer.yml';
const workflow=fs.readFileSync(workflowPath,'utf8');
const activationDoc=fs.readFileSync('docs/DATA-OPS-A1-3-LIVE-READONLY-OBSERVER.md','utf8');
const securityDoc=fs.readFileSync('docs/SECURITY.md','utf8');
const stewardFiles=()=>fs.readdirSync('workers/data-steward/sentinels')
  .filter(name=>name.endsWith('.mjs')).map(name=>`workers/data-steward/sentinels/${name}`);

test('dedicated observer workflow declares only two approved UTC opportunities and manual dispatch',()=>{
  assert.match(workflow,/^name: Data Steward Read-Only Observer$/m);
  assert.match(workflow,/^  workflow_dispatch:$/m);
  assert.deepEqual([...workflow.matchAll(/cron:\s*['"]([^'"]+)['"]/g)].map(match=>match[1]),
    ['17 4 * * *','17 8 * * *']);
  assert.equal((workflow.match(/^  schedule:$/gm)??[]).length,1);
  assert.match(workflow,/node workers\/data-steward\/run-observer\.mjs/);
});

test('schedule activation is exact and fail-closed while manual dispatch remains independent',()=>{
  const condition=/if:\s*(.+)/.exec(workflow)?.[1]??'';
  const enabled=(event,value,ref='refs/heads/main')=>ref==='refs/heads/main'
    &&(event==='workflow_dispatch'||(event==='schedule'&&value==='true'));
  assert.match(condition,/github\.ref == 'refs\/heads\/main'/);
  assert.match(condition,/github\.event_name == 'workflow_dispatch'/);
  assert.match(condition,/github\.event_name == 'schedule'/);
  assert.match(condition,/vars\.DATA_STEWARD_SCHEDULED_ENABLED == 'true'/);
  assert.equal(enabled('schedule',undefined),false);
  assert.equal(enabled('schedule','TRUE'),false);
  assert.equal(enabled('schedule','false'),false);
  assert.equal(enabled('schedule','true'),true);
  assert.equal(enabled('workflow_dispatch',undefined),true);
  assert.equal(enabled('workflow_dispatch',undefined,'refs/heads/feature'),false);
  assert.equal(enabled('workflow_dispatch',undefined,'refs/tags/v1'),false);
  assert.equal(enabled('schedule','true','refs/heads/feature'),false);
});

test('workflow permissions and protected runtime contract are exact and read-only',()=>{
  const permissions=/permissions:\n([\s\S]*?)\n\njobs:/.exec(workflow)?.[1].trim();
  assert.equal(permissions,'contents: read\n  actions: read\n  checks: read');
  assert.doesNotMatch(workflow,/\b(?:write|id-token|deployments|packages|pull-requests|issues):/);
  assert.match(workflow,/name: data-steward-readonly/);
  assert.match(workflow,/environment:\n      name: data-steward-readonly\n      deployment: false/);
  assert.match(workflow,/DATA_STEWARD_GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
  assert.doesNotMatch(workflow,/\bPAT\b|GITHUB_DISPATCH_TOKEN|CLOUDFLARE_D1_TOKEN|ANTHROPIC|OPENAI|ODDS/i);
});

test('activation docs require exact-main environment protection before credentials or dispatch',()=>{
  for(const text of [activationDoc,securityDoc]){
    assert.match(text,/Selected branches and tags[^\n]*exact branch `main`/);
    assert.match(text,/Protected branches\s+only/);
    assert.match(text,/before[\s\S]{0,80}Cloudflare/i);
    assert.match(text,/automatically create|automatically created/);
    assert.match(text,/HTTP 403/);
    assert.match(text,/dormant-on-merge[\s\S]{0,80}(?:not|unproven)/);
  }
});

test('observer workflow and adapter expose no mutation route',()=>{
  const adapter=fs.readFileSync('workers/data-steward/run-observer.mjs','utf8');
  for(const text of [workflow,adapter]){
    assert.doesNotMatch(text,/\/dispatches|\/rerun|\/cancel|wrangler|curl|method\s*:\s*['"](?:PUT|PATCH|DELETE)|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM/i);
  }
  assert.doesNotMatch(workflow,/data-s2-production-(?:collection|external|resume)\.yml/);
});

test('runtime adapter is sole steward ambient environment boundary',()=>{
  const ambientReaders=['workers/data-steward/run-observer.mjs',...stewardFiles()].filter(file=>
    /process\.env/.test(fs.readFileSync(file,'utf8')));
  assert.deepEqual(ambientReaders,['workers/data-steward/run-observer.mjs']);
  const ambient={EXTRA_SECRET:'must-not-pass'};
  for(const name of STEWARD_ENVIRONMENT_NAMES)ambient[name]=`${name}-value`;
  assert.deepEqual(Object.keys(readStewardEnvironment(ambient)).sort(),[...STEWARD_ENVIRONMENT_NAMES].sort());
  assert.equal(readStewardEnvironment(ambient).EXTRA_SECRET,undefined);
});

const result=({unhealthy=false,phase='HEALTHY_EXPECTED_STATE'}={})=>({
  dayDate:'2026-09-08',outcome:{verdict:unhealthy?'UNHEALTHY':phase==='HEALTHY_EXPECTED_STATE'?'HEALTHY':'NOT_EVALUATED',reasonCode:phase},
  heartbeat:{allCompleted:!unhealthy,allProving:!unhealthy},escalationRequired:unhealthy,
  observations:[{sourceType:'github',observationState:'OBSERVED',reasonCode:'GITHUB_CHAIN_OBSERVED',normalizedState:{}},
    {sourceType:'cloudflare',observationState:'OBSERVED',reasonCode:'CLOUDFLARE_CONFIGURATION_OBSERVED',normalizedState:{}},
    {sourceType:'d1',observationState:'OBSERVED',reasonCode:'D1_STATE_OBSERVED',normalizedState:{rowsRead:42}}]
});

test('healthy and legitimate open-window runtime outcomes exit successfully',async()=>{
  for(const phase of ['HEALTHY_EXPECTED_STATE','EVALUATION_NOT_DUE','AWAITING_LATER_OPPORTUNITY']){
    const logs=[];
    assert.equal(await runObserver({ambient:{},observeImpl:async()=>result({phase}),log:value=>logs.push(value)}),0);
    assert.equal(logs.length,1);
  }
});

test('missing runtime values fail closed and unhealthy outcome exits non-zero',async()=>{
  let supplied;
  const code=await runObserver({ambient:{},observeImpl:async input=>{supplied=input.env;return result({unhealthy:true});},log:()=>{}});
  assert.equal(code,1);
  assert.deepEqual(Object.keys(supplied).sort(),[...STEWARD_ENVIRONMENT_NAMES].sort());
  assert.ok(Object.values(supplied).every(value=>value===undefined));
});

test('runtime summary is closed and excludes tokens, account values, raw bodies and arbitrary text',()=>{
  const input=result();
  input.secret='gh-secret-fragment';
  input.rawBody={account:'account-secret'};
  input.observations[0].providerText='raw repository gate log';
  const summary=sanitizedSummary(input);
  assert.deepEqual(Object.keys(summary),['dayDate','verdict','evaluationReason','heartbeat','escalationRequired','sentinels']);
  assert.deepEqual(Object.keys(summary.sentinels[0]),['sentinel','state','reasonCode']);
  assert.equal(summary.sentinels[2].rowsRead,42);
  const output=JSON.stringify(summary);
  assert.doesNotMatch(output,/gh-secret|account-secret|repository gate log|rawBody|token/i);
});

test('migration inventory remains 0001-0003 and production collection surfaces are not observer inputs',()=>{
  assert.deepEqual(fs.readdirSync('workers/data-platform/migrations').sort(),
    ['0001_shadow_data_foundation.sql','0002_official_fpl_structured_history.sql','0003_production_query_plan_indexes.sql']);
  assert.doesNotMatch(workflow,/workers\/data-platform|schedule-dispatcher|production-collection/);
});
