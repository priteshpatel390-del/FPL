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
  // No steward runtime credential is declared at job level at all — only step level, scoped to
  // exactly the step that needs it.
  assert.doesNotMatch(workflow,/^ {4}env:$/m);
});

test('activation docs require exact-main environment protection before credentials or dispatch',()=>{
  for(const text of [activationDoc,securityDoc]){
    assert.match(text,/Selected branches and tags[^\n]*exact branch `main`/);
    assert.match(text,/Protected branches\s+only/);
    assert.match(text,/before[\s\S]{0,80}Cloudflare/i);
    assert.match(text,/automatically create|automatically created/);
    assert.match(text,/HTTP 403/);
    assert.match(text,/owner UI/i);
    assert.match(text,/absent/);
    assert.match(text,/(?:created, edited|created\/set|create\/set|creating, editing)/);
    assert.match(text,/dormant on merge/);
    assert.doesNotMatch(text,/dormant-on-merge[\s\S]{0,80}(?:remain|is)[\s\S]{0,20}unproven/);
  }
  assert.match(activationDoc,/exact lowercase `true`/);
  assert.match(activationDoc,/no variable was created, edited or deleted/i);
  assert.match(securityDoc,/DATA_STEWARD_SCHEDULED_ENABLED=true/);
});

test('activation docs keep every later live gate separate and unclaimed',()=>{
  for(const gate of [/Selected branches and tags[^\n]*exact branch `main`/,
    /Workers Scripts Read/,/D1 Read/,/manual/i,/DATA_STEWARD_SCHEDULED_ENABLED=true/])
    assert.match(activationDoc,gate);
  assert.doesNotMatch(activationDoc,
    /\b(?:environment provisioned|credentials? (?:are|is) provisioned|live acceptance (?:is )?complete|scheduled observer is active|live monitoring is active)\b/i);
  assert.match(activationDoc,/NOT LIVE-ACTIVATED/);
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

// Live evidence (run 34277208819) proved the Cloudflare sentinel now fails at one of three named
// stages rather than one collapsed code, live evidence (run 34311398342) then proved the
// `/schedules` stage itself needed five closed categories rather than one, and live evidence
// (run 34319945520) then proved the response-processing category itself needed three closed
// layers rather than one. The sanitized summary must carry any of these closed reason codes
// through unchanged while remaining exactly as closed as any other reason code — no request URL,
// header, status, provider message, account id, fingerprint or raw body can ever ride along.
test('the new closed Cloudflare stage reason codes pass through sanitized output with nothing else attached',()=>{
  for(const reasonCode of ['CLOUDFLARE_SCHEDULES_AUTH_REFUSED','CLOUDFLARE_SCHEDULES_NOT_FOUND',
    'CLOUDFLARE_SCHEDULES_HTTP_FAILED','CLOUDFLARE_SCHEDULES_JSON_INVALID',
    'CLOUDFLARE_SCHEDULES_ENVELOPE_INVALID','CLOUDFLARE_SCHEDULES_PAYLOAD_INVALID',
    'CLOUDFLARE_SCHEDULES_TRANSPORT_FAILED','CLOUDFLARE_DEPLOYMENTS_READ_FAILED',
    'CLOUDFLARE_SETTINGS_READ_FAILED']){
    const input=result({unhealthy:true});
    input.observations[1]={sourceType:'cloudflare',observationState:'OBSERVATION_FAILED',reasonCode,
      normalizedState:{observed:false}};
    const summary=sanitizedSummary(input);
    const cloudflareRow=summary.sentinels.find(row=>row.sentinel==='cloudflare');
    assert.equal(cloudflareRow.reasonCode,reasonCode);
    assert.deepEqual(Object.keys(cloudflareRow),['sentinel','state','reasonCode']);
    const output=JSON.stringify(summary);
    assert.doesNotMatch(output,
      /token|authorization|account[_-]?id|fingerprint|https?:\/\/|status\s*:\s*\d|error|message/i);
  }
});

test('migration inventory remains 0001-0003 and production collection surfaces are not observer inputs',()=>{
  assert.deepEqual(fs.readdirSync('workers/data-platform/migrations').sort(),
    ['0001_shadow_data_foundation.sql','0002_official_fpl_structured_history.sql','0003_production_query_plan_indexes.sql']);
  assert.doesNotMatch(workflow,/workers\/data-platform|schedule-dispatcher|production-collection/);
});

// Live first-run evidence (run 34269989975, head 2f8a4850f911779d2ec48db2f835d0f6af5a45c5) proved
// GitHub echoes each step's resolved `vars.*` environment in its log header, so the fingerprint
// leaked into Actions logs before any credential was ever exposed. Owner review then tightened the
// boundary further: no steward runtime credential of any kind may sit at job level, only the exact
// step that needs a given value may declare it. This block pins that tightened contract.
const stepEnvBlock=stepText=>{
  const lines=stepText.split('\n');
  const envIndex=lines.findIndex(line=>line==='        env:');
  if(envIndex===-1)return [];
  const out=[];
  for(let i=envIndex+1;i<lines.length;i++){
    if(!lines[i].startsWith('          '))break;
    out.push(lines[i].trim());
  }
  return out;
};

test('no steward protected value sits at job level; each step declares only the env it needs',()=>{
  assert.doesNotMatch(workflow,/^ {4}env:$/m);
  const steps=workflow.split(/\n      - name: /).slice(1);
  assert.equal(steps.length,4);
  const [maskStep,checkoutStep,nodeStep,executeStep]=steps;
  assert.match(maskStep,/^Register Cloudflare account fingerprint mask before any other step/);
  assert.match(checkoutStep,/^Check out observer source/);
  assert.match(nodeStep,/^Set up exact Node/);
  assert.match(executeStep,/^Execute one read-only observation/);

  // The masking step receives exactly the Account ID and nothing else.
  assert.deepEqual(stepEnvBlock(maskStep),
    ['DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID: ${{ secrets.DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID }}']);
  assert.doesNotMatch(maskStep,/DATA_STEWARD_GITHUB_TOKEN|DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT|DATA_STEWARD_CLOUDFLARE_READ_TOKEN/);

  // Checkout and setup-node receive no steward value of any kind — no step-level env block at all.
  assert.deepEqual(stepEnvBlock(checkoutStep),[]);
  assert.deepEqual(stepEnvBlock(nodeStep),[]);
  assert.doesNotMatch(checkoutStep,/DATA_STEWARD/);
  assert.doesNotMatch(nodeStep,/DATA_STEWARD/);

  // Only the final execution step receives the full runtime contract, and exactly that contract —
  // fingerprint materialised only here, strictly after the masking step has already run.
  assert.deepEqual(stepEnvBlock(executeStep).sort(),[
    'DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT: ${{ vars.DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT }}',
    'DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID: ${{ secrets.DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID }}',
    'DATA_STEWARD_CLOUDFLARE_READ_TOKEN: ${{ secrets.DATA_STEWARD_CLOUDFLARE_READ_TOKEN }}',
    'DATA_STEWARD_GITHUB_TOKEN: ${{ github.token }}'
  ].sort());
  const fingerprintOccurrences=[...workflow.matchAll(
    /DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT: \$\{\{ vars\.DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT \}\}/g)];
  assert.equal(fingerprintOccurrences.length,1);
});

test('the masking step derives from the secret account id, fails closed and touches no network/state surface',()=>{
  const maskStep=workflow.split(/\n      - name: /)[1];
  assert.match(maskStep,/test -n "\$DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID"/);
  assert.match(maskStep,/sha256sum/);
  assert.match(maskStep,/::add-mask::/);
  assert.doesNotMatch(maskStep,/curl|wget|fetch|http:|https:|wrangler/i);
  assert.doesNotMatch(maskStep,/GITHUB_ENV|GITHUB_OUTPUT/);
  assert.doesNotMatch(maskStep,/\buses:/);
});

test('workflow contract otherwise unchanged by the masking remediation',()=>{
  assert.match(workflow,/^name: Data Steward Read-Only Observer$/m);
  assert.deepEqual([...workflow.matchAll(/cron:\s*['"]([^'"]+)['"]/g)].map(match=>match[1]),
    ['17 4 * * *','17 8 * * *']);
  assert.match(workflow,/environment:\n      name: data-steward-readonly\n      deployment: false/);
  const permissions=/permissions:\n([\s\S]*?)\n\njobs:/.exec(workflow)?.[1].trim();
  assert.equal(permissions,'contents: read\n  actions: read\n  checks: read');
  assert.doesNotMatch(workflow,/\b(?:write|id-token|deployments|packages|pull-requests|issues):/);
  assert.match(workflow,
    /github\.ref == 'refs\/heads\/main' && \(github\.event_name == 'workflow_dispatch' \|\| \(github\.event_name == 'schedule' && vars\.DATA_STEWARD_SCHEDULED_ENABLED == 'true'\)\)/);
});

test('no full live fingerprint or account id value appears anywhere in repository text',()=>{
  const scanned=[workflow,activationDoc,securityDoc,
    fs.readFileSync('docs/KNOWN_LIMITATIONS.md','utf8'),fs.readFileSync('docs/ROADMAP.md','utf8'),
    fs.readFileSync('docs/PROJECT_CONTEXT.md','utf8'),fs.readFileSync('docs/TESTING.md','utf8'),
    fs.readFileSync('workers/data-steward/sentinels/environment-contract.mjs','utf8'),
    fs.readFileSync('workers/data-steward/sentinels/cloudflare-sentinel.mjs','utf8')];
  for(const text of scanned){
    // Only a short evidence prefix (7 hex characters) is ever recorded, never the full 64-character
    // fingerprint or account id.
    assert.doesNotMatch(text,/\bdbc3bff[0-9a-f]{2,}/i);
    assert.doesNotMatch(text,/\bsha256:[0-9a-f]{64}\b/);
  }
});
