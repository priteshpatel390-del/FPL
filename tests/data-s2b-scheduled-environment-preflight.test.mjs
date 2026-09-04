// DATA-S2B — the manual, strictly read-only scheduled-environment credential preflight.
//
// Permanent trust-boundary regressions. They prove the diagnostic's trigger shape, its zero-input
// design, its exact environment, its complete absence of SQL, D1 query and mutation surface, the
// canonical fingerprint derivation, every fail-closed classification, the sanitized PASS shape,
// and that no identifier, credential or response body can be emitted. They also prove this
// diagnostic changes neither the production collector, the scheduled cron nor the manual
// collection workflow.
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import {createHash} from 'node:crypto';
import {PRODUCTION_COLLECTION_SCHEDULE,PRODUCTION_D1_ID} from '../workers/data-platform/production-collection.mjs';
import {derivedAccountFingerprint} from '../workers/data-platform/production-identity.mjs';
import {ACTIVE_TOKEN_STATUS,CHECK_ACCOUNT_FINGERPRINT,CHECK_API_TOKEN_ACTIVE,CHECK_PRODUCTION_D1_ACCESS,
  PREFLIGHT_CHECKS,PREFLIGHT_FAIL,PREFLIGHT_PASS,PreflightError,TOKEN_VERIFY_URL,assertAccountFingerprint,
  classifyD1Metadata,classifyTokenVerify,d1MetadataRequest,preflightFailure,runScheduledEnvironmentPreflight,
  tokenVerifyRequest} from '../workers/data-platform/scheduled/environment-preflight.mjs';

const WORKFLOW_PATH='.github/workflows/data-s2-scheduled-environment-preflight.yml';
const MODULE_PATH='workers/data-platform/scheduled/environment-preflight.mjs';
const ENTRY_PATH='workers/data-platform/scheduled/run-scheduled-environment-preflight.mjs';
const SCHEDULED_WORKFLOW_PATH='.github/workflows/data-s2-production-scheduled.yml';
const MANUAL_WORKFLOW_PATH='.github/workflows/data-s2-production-collection.yml';
const COLLECTOR_PATH='workers/data-platform/production-collection.mjs';
const COLLECTION_ENTRY_PATH='workers/data-platform/run-production-collection.mjs';

const read=file=>fs.readFileSync(file,'utf8');
const uncommented=source=>source.split('\n').filter(line=>!/^\s*(#|\/\/)/.test(line)).join('\n');
const workflow=read(WORKFLOW_PATH);
const moduleSource=read(MODULE_PATH);
const entrySource=read(ENTRY_PATH);

const ACCOUNT='cf-account-0123456789abcdef';
const FINGERPRINT=createHash('sha256').update(ACCOUNT).digest('hex');
const TOKEN='cf-token-value';
const identity={accountId:ACCOUNT,accountFingerprint:FINGERPRINT,databaseId:PRODUCTION_D1_ID,token:TOKEN};

// A transport that answers each request in order and records exactly what it was asked to send.
function transport(pages){
  const sent=[];
  let call=0;
  const fetchImpl=async(url,init)=>{
    sent.push({url,init});
    const page=pages[Math.min(call,pages.length-1)];
    call+=1;
    if(page instanceof Error)throw page;
    return page;
  };
  return {sent,fetchImpl,calls:()=>call};
}
const body=(payload,status=200)=>({status,json:async()=>payload});
const tokenOk=body({success:true,result:{id:'redacted',status:ACTIVE_TOKEN_STATUS}});
const databaseOk=body({success:true,result:{uuid:PRODUCTION_D1_ID,name:'teamsheet-data',version:'production'}});
const pass=()=>transport([tokenOk,databaseOk]);

/* ------------------------------ trigger, inputs and environment ------------------------------ */

test('the preflight workflow exists and is workflow_dispatch-only with zero triggers beside it',()=>{
  assert.ok(fs.existsSync(WORKFLOW_PATH));
  assert.match(workflow,/^name: DATA-S2 Scheduled Environment Credential Preflight$/m);
  const trigger=workflow.slice(workflow.indexOf('\non:'),workflow.indexOf('\npermissions:'));
  assert.equal(trigger.trim(),'on:\n  workflow_dispatch:');
  for(const forbidden of [/^\s{2}schedule:/m,/cron:/,/^\s{2}push:/m,/^\s{2}pull_request:/m,/pull_request_target/,
    /repository_dispatch/,/workflow_call/,/workflow_run/,/^\s{2}release:/m,/^\s{2}issues:/m])
    assert.doesNotMatch(uncommented(workflow),forbidden,String(forbidden));
  assert.match(workflow,/if: github\.event_name == 'workflow_dispatch'/);
  assert.doesNotMatch(workflow,/github\.event_name == '(?:schedule|push|pull_request)'/);
});

test('the preflight accepts no input of any kind',()=>{
  assert.doesNotMatch(uncommented(workflow),/^\s*inputs:/m);
  assert.equal([...workflow.matchAll(/inputs\./g)].length,0);
  assert.equal([...workflow.matchAll(/github\.event\.inputs/g)].length,0);
  for(const forbidden of [/approved_sha/,/database_id/i,/sql/i,/statement/i,/endpoint/i,/run_id/i,/COLLECTION_SCHEDULED_AT/])
    assert.doesNotMatch(uncommented(workflow),forbidden,String(forbidden));
});

test('the preflight requests exactly the scheduled environment with least privilege',()=>{
  assert.match(workflow,/environment:\n      name: data-s2-production-scheduled\n/);
  assert.equal([...workflow.matchAll(/^\s*name: data-s2-production-scheduled$/gm)].length,1);
  // The attended manual/recovery environment is never requested by this diagnostic.
  assert.doesNotMatch(uncommented(workflow),/data-s2-production-collection/);
  assert.match(workflow,/permissions:\n  contents: read\n/);
  assert.equal([...workflow.matchAll(/^permissions:$/gm)].length,1);
  // Nothing beyond `contents: read` is granted, and no GitHub token is used at all.
  assert.doesNotMatch(workflow,/checks: (?:read|write)|contents: write|packages:|id-token:|deployments:|actions:/);
  assert.doesNotMatch(workflow,/GH_TOKEN|github\.token|GITHUB_TOKEN/);
  assert.match(workflow,/node-version: 24\.19\.0/);
  assert.match(workflow,/test "\$\(node --version\)" = v24\.19\.0/);
  // Its own concurrency group: a read-only diagnostic never serializes with real production work.
  assert.match(workflow,/concurrency:\n  group: data-s2-scheduled-environment-preflight\n  cancel-in-progress: false/);
  assert.doesNotMatch(workflow,/group: data-s2-production-collection/);
});

/* ------------------------------- no SQL, no query, no mutation ------------------------------- */

test('neither the workflow nor the executable can execute SQL or reach the D1 query endpoint',()=>{
  const source=`${uncommented(moduleSource)}\n${uncommented(entrySource)}\n${uncommented(workflow)}`;
  for(const forbidden of [/\/query/,/SELECT/i,/INSERT/i,/UPDATE\b/i,/DELETE/i,/CREATE /i,/DROP /i,/PRAGMA/i,
    /EXPLAIN/i,/batch/i,/params/,/d1-rest-client/,/official-fpl/,/migrations?\//,/run-production-collection/,
    /run-production-resume/,/run-migration-0003/,/run-first-run-reconciliation/,/run-production-explain/])
    assert.doesNotMatch(source,forbidden,String(forbidden));
  // Every request this executable can build is a GET, and there is no body anywhere.
  assert.deepEqual([...new Set([...uncommented(moduleSource).matchAll(/method:'([A-Z]+)'/g)].map(row=>row[1]))],['GET']);
  for(const forbidden of [/'POST'/,/'PUT'/,/'PATCH'/,/'DELETE'/,/body:/,/wrangler/i,/deploy/i,/versions/,
    /deployments/,/schedules/,/crons?:/,/secret/i])
    assert.doesNotMatch(uncommented(moduleSource),forbidden,String(forbidden));
  // The only host it contacts is the Cloudflare API, on exactly two read endpoints.
  assert.deepEqual([...new Set([...uncommented(moduleSource).matchAll(/https:\/\/([a-z.]+)\//g)].map(row=>row[1]))],
    ['api.cloudflare.com']);
  assert.equal(TOKEN_VERIFY_URL,'https://api.cloudflare.com/client/v4/user/tokens/verify');
});

test('the workflow invokes exactly the preflight entry point and nothing else',()=>{
  assert.deepEqual([...uncommented(workflow).matchAll(/node workers\/data-platform\/[a-z0-9/-]+\.mjs/g)].map(row=>row[0]),
    ['node workers/data-platform/scheduled/run-scheduled-environment-preflight.mjs']);
  assert.doesNotMatch(uncommented(workflow),/curl|-v\b|--verbose|set -x|GITHUB_ENV|GITHUB_OUTPUT|upload-artifact|actions\/cache/);
  for(const step of uncommented(workflow).split('\n').filter(line=>/run: \|/.test(line)))assert.ok(step.trim()==='run: |',step);
  for(const shell of uncommented(workflow).split('- name: ').slice(1))
    if(shell.includes('run: |'))assert.ok(shell.includes('set -euo pipefail'),shell.split('\n')[0]);
});

/* ---------------------------- check 1: account id to fingerprint ---------------------------- */

test('the fingerprint check reuses the canonical SHA-256 derivation and fails closed on mismatch',()=>{
  assert.equal(FINGERPRINT,derivedAccountFingerprint(ACCOUNT));
  assert.equal(assertAccountFingerprint(ACCOUNT,FINGERPRINT),CHECK_ACCOUNT_FINGERPRINT);
  // One definition only: the module imports the derivation rather than restating it.
  assert.match(moduleSource,/import\s*\{derivedAccountFingerprint\}\s*from\s*'\.\.\/production-identity\.mjs'/);
  assert.doesNotMatch(uncommented(moduleSource),/createHash|sha256/);
  // Byte-for-byte: a fingerprint for another account, a truncated one and a case change all stop.
  const other=createHash('sha256').update('another-account').digest('hex');
  assert.throws(()=>assertAccountFingerprint(ACCOUNT,other),/preflight_account_fingerprint_mismatch/);
  for(const bad of [FINGERPRINT.slice(0,63),FINGERPRINT.toUpperCase(),`${FINGERPRINT}0`,'',null,undefined,FINGERPRINT.replace(/^./,'g')])
    assert.throws(()=>assertAccountFingerprint(ACCOUNT,bad),/preflight_account_fingerprint_invalid/,String(bad));
  for(const bad of ['','account id',null,undefined,'a'.repeat(129)])
    assert.throws(()=>assertAccountFingerprint(bad,FINGERPRINT),/preflight_account_id_invalid/,String(bad));
});

test('a mismatched fingerprint stops the preflight before any Cloudflare request',async()=>{
  const t=transport([tokenOk,databaseOk]);
  await assert.rejects(runScheduledEnvironmentPreflight({...identity,
    accountFingerprint:createHash('sha256').update('another-account').digest('hex'),fetchImpl:t.fetchImpl}),
    /preflight_account_fingerprint_mismatch/);
  assert.equal(t.calls(),0);
});

/* -------------------------------- check 2: token validity -------------------------------- */

test('token verification is Cloudflare\'s official read-only endpoint and carries no identity',()=>{
  const request=tokenVerifyRequest(TOKEN);
  assert.equal(request.url,TOKEN_VERIFY_URL);
  assert.equal(request.init.method,'GET');
  assert.equal(request.init.headers.Authorization,`Bearer ${TOKEN}`);
  assert.equal(request.init.redirect,'error');
  assert.equal(request.init.body,undefined);
  // The credential is the whole request: no account, database or fingerprint appears in it.
  assert.ok(!request.url.includes(ACCOUNT)&&!request.url.includes(PRODUCTION_D1_ID));
  for(const bad of ['',null,undefined,5])assert.throws(()=>tokenVerifyRequest(bad),/preflight_token_missing/,String(bad));
});

test('only an active token passes; every other status or shape fails closed',()=>{
  assert.equal(classifyTokenVerify({success:true,result:{status:ACTIVE_TOKEN_STATUS}}),CHECK_API_TOKEN_ACTIVE);
  for(const status of ['disabled','expired','revoked','inactive','ACTIVE',''])
    assert.throws(()=>classifyTokenVerify({success:true,result:{status}}),
      status===''?/preflight_token_verify_contract_invalid/:/preflight_token_not_active/,String(status));
  for(const malformed of [null,undefined,'ok',[],{},{success:false,result:{status:'active'}},{success:true},
    {success:true,result:null},{success:true,result:[]},{success:true,result:{status:1}},{success:'true',result:{status:'active'}}])
    assert.throws(()=>classifyTokenVerify(malformed),/preflight_token_verify_contract_invalid/,JSON.stringify(malformed)??'undefined');
});

test('an unauthorized, rate-limited, failed, unreachable or unparseable verify response fails closed',async()=>{
  const cases=[[body({},401),/preflight_token_verify_unauthorized/],[body({},403),/preflight_token_verify_unauthorized/],
    [body({},404),/preflight_token_verify_not_found/],[body({},429),/preflight_token_verify_rate_limited/],
    [body({},500),/preflight_token_verify_http_failed/],[body({},302),/preflight_token_verify_http_failed/],
    [{status:'ok'},/preflight_token_verify_http_failed/],[{},/preflight_token_verify_http_failed/],
    [{status:200,json:async()=>{throw new Error('https://api.cloudflare.com/secret');}},/preflight_token_verify_contract_invalid/],
    [new Error('connect ECONNREFUSED to https://api.cloudflare.com'),/preflight_token_verify_transport_failed/]];
  for(const [response,expected] of cases){
    const t=transport([response]);
    await assert.rejects(runScheduledEnvironmentPreflight({...identity,fetchImpl:t.fetchImpl}),expected,String(expected));
    // It stops at the failing check: the D1 read is never attempted.
    assert.equal(t.calls(),1,String(expected));
  }
});

/* ------------------------------ check 3: production D1 access ------------------------------ */

test('the D1 read is a metadata lookup for the reviewed repository constant only',()=>{
  const request=d1MetadataRequest(identity);
  assert.equal(request.url,
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${PRODUCTION_D1_ID}`);
  assert.equal(request.init.method,'GET');
  assert.equal(request.init.body,undefined);
  assert.ok(!request.url.endsWith('/query'));
  // No environment value may redirect the check at another database.
  for(const bad of ['','other',PRODUCTION_D1_ID.toUpperCase(),null,undefined])
    assert.throws(()=>d1MetadataRequest({...identity,databaseId:bad}),/preflight_d1_identity_mismatch/,String(bad));
  assert.doesNotMatch(uncommented(moduleSource),/CLOUDFLARE_PRODUCTION_D1_ID/);
  assert.doesNotMatch(uncommented(entrySource),/CLOUDFLARE_PRODUCTION_D1_ID/);
  assert.doesNotMatch(workflow,/CLOUDFLARE_PRODUCTION_D1_ID/);
  assert.ok(!workflow.includes(PRODUCTION_D1_ID));
});

test('the returned database identity must be the repository constant, or the check fails closed',()=>{
  assert.equal(classifyD1Metadata({success:true,result:{uuid:PRODUCTION_D1_ID}},PRODUCTION_D1_ID),CHECK_PRODUCTION_D1_ACCESS);
  assert.equal(classifyD1Metadata({success:true,result:{id:PRODUCTION_D1_ID}},PRODUCTION_D1_ID),CHECK_PRODUCTION_D1_ACCESS);
  assert.equal(classifyD1Metadata({success:true,result:{uuid:PRODUCTION_D1_ID,id:PRODUCTION_D1_ID}},PRODUCTION_D1_ID),
    CHECK_PRODUCTION_D1_ACCESS);
  // A different database, a partial agreement and a non-string identity are all mismatches.
  for(const result of [{uuid:'01e2b4f9-313a-4a14-8ce6-000000000000'},{id:'other'},
    {uuid:PRODUCTION_D1_ID,id:'other'},{uuid:{}},{uuid:123}])
    assert.throws(()=>classifyD1Metadata({success:true,result},PRODUCTION_D1_ID),/preflight_d1_identity_mismatch/,
      JSON.stringify(result));
  // A response carrying no identity at all is a contract failure, never a pass.
  for(const malformed of [null,undefined,'ok',[],{},{success:false,result:{uuid:PRODUCTION_D1_ID}},{success:true},
    {success:true,result:null},{success:true,result:[]},{success:true,result:{name:'teamsheet-data'}}])
    assert.throws(()=>classifyD1Metadata(malformed,PRODUCTION_D1_ID),/preflight_d1_metadata_contract_invalid/,
      JSON.stringify(malformed)??'undefined');
});

test('an unauthorized, absent, malformed or unreachable D1 metadata response fails closed',async()=>{
  const cases=[[body({},401),/preflight_d1_metadata_unauthorized/],[body({},403),/preflight_d1_metadata_unauthorized/],
    [body({},404),/preflight_d1_metadata_not_found/],[body({},429),/preflight_d1_metadata_rate_limited/],
    [body({},500),/preflight_d1_metadata_http_failed/],
    [body({success:true,result:{uuid:'01e2b4f9-313a-4a14-8ce6-000000000000'}}),/preflight_d1_identity_mismatch/],
    [body({success:false,errors:[{code:7003}]}),/preflight_d1_metadata_contract_invalid/],
    [new Error('socket hang up'),/preflight_d1_metadata_transport_failed/]];
  for(const [response,expected] of cases){
    const t=transport([tokenOk,response]);
    await assert.rejects(runScheduledEnvironmentPreflight({...identity,fetchImpl:t.fetchImpl}),expected,String(expected));
    assert.equal(t.calls(),2,String(expected));
  }
});

/* ------------------------------- the success path and its shape ------------------------------- */

test('the expected success path returns a sanitized PASS for exactly the three checks',async()=>{
  const t=pass();
  const result=await runScheduledEnvironmentPreflight({...identity,fetchImpl:t.fetchImpl});
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{result:PREFLIGHT_PASS,
    checks:[{check:CHECK_ACCOUNT_FINGERPRINT,status:'PASS'},{check:CHECK_API_TOKEN_ACTIVE,status:'PASS'},
      {check:CHECK_PRODUCTION_D1_ACCESS,status:'PASS'}]});
  assert.deepEqual([...PREFLIGHT_CHECKS],[CHECK_ACCOUNT_FINGERPRINT,CHECK_API_TOKEN_ACTIVE,CHECK_PRODUCTION_D1_ACCESS]);
  assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.checks));
  // Exactly two Cloudflare reads, both GET, neither of them a query, and no retry anywhere.
  assert.equal(t.calls(),2);
  assert.deepEqual(t.sent.map(entry=>entry.init.method),['GET','GET']);
  assert.deepEqual(t.sent.map(entry=>entry.url),[TOKEN_VERIFY_URL,
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${PRODUCTION_D1_ID}`]);
  assert.ok(t.sent.every(entry=>entry.init.body===undefined));
  assert.doesNotMatch(uncommented(moduleSource),/for\s*\(|while\s*\(|setTimeout|retry/i);
});

test('the preflight rejects an unknown option and a missing transport before anything else',async()=>{
  for(const options of [{...identity,sql:'SELECT 1'},{...identity,url:'https://example.invalid'},
    {...identity,fetchImpl:'fetch'},{}])
    await assert.rejects(runScheduledEnvironmentPreflight({...options,fetchImpl:options.fetchImpl}),
      /preflight_config_invalid|preflight_account_id_invalid/,JSON.stringify(Object.keys(options)));
});

/* ---------------------------------- sanitized reporting ---------------------------------- */

test('every reported failure is a stable class and never a raw message, URL or identifier',()=>{
  const known=new PreflightError('preflight_token_not_active',CHECK_API_TOKEN_ACTIVE);
  assert.deepEqual({...preflightFailure(known)},
    {result:PREFLIGHT_FAIL,check:CHECK_API_TOKEN_ACTIVE,reason:'preflight_token_not_active'});
  // Anything that is not this module's own error could carry a URL, so its message is discarded.
  for(const foreign of [new Error(`fetch failed https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}`),
    new TypeError(PRODUCTION_D1_ID),null,undefined,'boom']){
    const reported=preflightFailure(foreign);
    assert.deepEqual({...reported},{result:PREFLIGHT_FAIL,check:'unknown',reason:'preflight_unexpected_error'});
    const text=JSON.stringify(reported);
    assert.ok(!text.includes(ACCOUNT)&&!text.includes(PRODUCTION_D1_ID)&&!text.includes('api.cloudflare.com'));
  }
  // An unrecognised check on an otherwise known error is reported as unknown, not echoed.
  assert.equal(preflightFailure(new PreflightError('preflight_token_not_active','made_up')).check,'unknown');
});

test('the entry point masks before any request and emits no identifier, credential or body',()=>{
  assert.match(entrySource,/maskProductionIdentity\(resolveProductionIdentity\(process\.env\)\)/);
  const source=uncommented(entrySource);
  assert.ok(source.indexOf('maskProductionIdentity')<source.indexOf('runScheduledEnvironmentPreflight('));
  // The rethrow discards the original error object, so no runtime message reaches the log.
  assert.match(source,/catch\(error\)\{const classified=preflightFailure\(error\);summary\(classified\);throw new Error\(classified\.reason\);\}/);
  for(const forbidden of [/console\.log/,/console\.error/,/accountId\b[^,)]*\)\s*;?\s*$/m,/JSON\.stringify\((?!payload)/,
    /GITHUB_ENV/,/GITHUB_OUTPUT/,/writeFileSync/,/response/,/headers/,/Authorization/])
    assert.doesNotMatch(source,forbidden,String(forbidden));
  // The only thing written anywhere is the sanitized summary payload.
  assert.equal([...source.matchAll(/appendFileSync|process\.stdout\.write/g)].length,2);
  assert.match(source,/const line=`## DATA-S2 scheduled environment preflight\\n\\n\\`\$\{JSON\.stringify\(payload\)\}\\`\\n`/);
});

test('no secret, account, fingerprint or database value can be produced by the module',()=>{
  const source=uncommented(moduleSource);
  for(const forbidden of [/console\./,/writeFileSync/,/appendFileSync/,/process\.stdout/,/process\.env/,
    /GITHUB_ENV/,/GITHUB_OUTPUT/,/upload/i,/artifact/i])
    assert.doesNotMatch(source,forbidden,String(forbidden));
  // Nothing the module returns carries an identifier, a credential or provider content.
  const result={result:PREFLIGHT_PASS,checks:PREFLIGHT_CHECKS.map(check=>({check,status:PREFLIGHT_PASS}))};
  const text=JSON.stringify(result);
  for(const secret of [ACCOUNT,FINGERPRINT,TOKEN,PRODUCTION_D1_ID,'Bearer','api.cloudflare.com'])
    assert.ok(!text.includes(secret),secret);
});

/* ------------------------- nothing production changes underneath it ------------------------- */

test('the scheduled production cron and its workflow are untouched by this diagnostic',()=>{
  const scheduled=read(SCHEDULED_WORKFLOW_PATH);
  const trigger=scheduled.slice(scheduled.indexOf('\non:'),scheduled.indexOf('\npermissions:'));
  assert.equal(trigger.trim(),"on:\n  schedule:\n    - cron: '17 14 * * *'");
  assert.equal(PRODUCTION_COLLECTION_SCHEDULE,'17 14 * * *');
  assert.doesNotMatch(uncommented(scheduled),/timezone/i);
  assert.ok(scheduled.includes(`- cron: '${PRODUCTION_COLLECTION_SCHEDULE}'`));
  assert.equal([...scheduled.matchAll(/^\s*- cron:/gm)].length,1);
  assert.doesNotMatch(uncommented(scheduled),/workflow_dispatch/);
  // The diagnostic is additive: neither production workflow references it.
  assert.ok(!scheduled.includes('scheduled-environment-preflight'));
  assert.ok(!read(MANUAL_WORKFLOW_PATH).includes('scheduled-environment-preflight'));
});

test('the manual production collection workflow and the collector are unchanged in shape',()=>{
  const manual=read(MANUAL_WORKFLOW_PATH);
  const trigger=manual.slice(manual.indexOf('on:'),manual.indexOf('\npermissions:'));
  assert.match(trigger,/^on:\n  workflow_dispatch:\n    inputs:\n      approved_sha:/m);
  assert.doesNotMatch(trigger,/schedule:|cron:/);
  assert.match(manual,/environment:\n      name: data-s2-production-collection/);
  // The shared production entry point and collector gain nothing from this checkpoint.
  const entry=read(COLLECTION_ENTRY_PATH);
  assert.match(entry,/GITHUB_RUN_ATTEMPT!=='1'\)throw new Error\('workflow_retry_forbidden'\)/);
  assert.doesNotMatch(entry,/preflight|environment-preflight/i);
  assert.doesNotMatch(read(COLLECTOR_PATH),/preflight|tokens\/verify|d1\/database\/[^/]+'/i);
});

test('the preflight record states the diagnostic boundary and what a pass would not prove',()=>{
  const record=read('workers/data-platform/DATA-S2B-SCHEDULED-ENVIRONMENT-PREFLIGHT.md');
  for(const required of ['data-s2-production-scheduled','workflow_dispatch','CLOUDFLARE_D1_TOKEN',
    'CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_PRODUCTION_ACCOUNT_FINGERPRINT','user/tokens/verify',
    'no collection','no SQL','separate owner approval'])
    assert.ok(record.includes(required),required);
  // It must never claim to explain or prove GitHub cron scheduling.
  assert.match(record,/does not prove|cannot prove/i);
  assert.match(record,/schedule-event creation/i);
  assert.ok(!record.includes(PRODUCTION_D1_ID));
  assert.ok(read('CLAUDE.md').includes('(workers/data-platform/DATA-S2B-SCHEDULED-ENVIRONMENT-PREFLIGHT.md)'));
});
