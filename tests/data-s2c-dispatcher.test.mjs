// DATA-S2C — permanent regressions for the isolated Cloudflare schedule dispatcher.
//
// The dispatcher is a timer. Everything dangerous about it is what it must never become: a second
// collector, a second way into D1, a public HTTP surface, or a redeployment of the historical
// `teamsheet-data-platform` Worker that still declares a thirty-minute Cron trigger and a D1
// binding. These tests hold that isolation structurally, and hold the dispatch state machine's
// exactly-once, never-retry behaviour and its secret-free bounded telemetry.
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import crypto from 'node:crypto';
import {ACCEPTED_NO_IDENTITY,ACCEPTED_WITH_IDENTITY,AMBIGUOUS,DISPATCH_API_VERSION,DISPATCH_BODY,
  DISPATCH_REASONS,DISPATCH_REF,DISPATCH_REPOSITORY,DISPATCH_TOKEN_BINDING,DISPATCH_URL,
  DISPATCH_WORKFLOW_FILE,DISPATCH_WORKFLOW_PATH,MAX_LATENCY_MS,REJECTED,REJECTED_STATUSES,
  boundedLatency,classifyDispatchResponse,dispatchRequest,dispatchTelemetry,runReadRequest,
  validateRunIdentity} from '../workers/schedule-dispatcher/dispatch-contract.mjs';
import dispatcher,{runScheduledDispatch} from '../workers/schedule-dispatcher/dispatcher.mjs';

const DISPATCHER_DIR='workers/schedule-dispatcher';
const CONFIG_PATH=`${DISPATCHER_DIR}/wrangler.jsonc`;
const WORKER_PATH=`${DISPATCHER_DIR}/dispatcher.mjs`;
const CONTRACT_PATH=`${DISPATCHER_DIR}/dispatch-contract.mjs`;
const PLATFORM_CONFIG_PATH='workers/data-platform/wrangler.jsonc';
const read=file=>fs.readFileSync(file,'utf8');
const uncommented=source=>source.split('\n').filter(line=>!/^\s*(#|\/\/)/.test(line)).join('\n');
const config=JSON.parse(read(CONFIG_PATH));
const sources=()=>uncommented(`${read(WORKER_PATH)}\n${read(CONTRACT_PATH)}`);

const SCHEDULED_TIME=Date.UTC(2026,8,7,1,17,0);
const RUN_ID=34015422874;

function transport(responses){
  const calls=[];
  const fetchImpl=async(url,init)=>{
    calls.push({url,method:init.method,headers:init.headers,body:init.body});
    const next=responses[Math.min(calls.length-1,responses.length-1)];
    if(typeof next==='function')return next();
    return next;
  };
  return {calls,fetchImpl};
}

// A stub `controller` that records whether `noRetry()` was called and, crucially, how many
// outbound requests had already been issued when it was.
function controller({scheduledTime=SCHEDULED_TIME,calls=[]}={}){
  const state={noRetryCalls:0,noRetryAtCall:null};
  return {state,controller:{scheduledTime,noRetry(){state.noRetryCalls+=1;
    if(state.noRetryAtCall===null)state.noRetryAtCall=calls.length;}}};
}

const clock=(...values)=>{let index=0;return()=>values[Math.min(index++,values.length-1)];};
const identityBody=(runId=RUN_ID)=>({workflow_run_id:runId,
  run_url:`https://api.github.com/repos/${DISPATCH_REPOSITORY}/actions/runs/${runId}`,
  html_url:`https://github.com/${DISPATCH_REPOSITORY}/actions/runs/${runId}`});
const json=(status,body)=>({status,json:async()=>body});

async function fire({responses,now=clock(SCHEDULED_TIME+2000,SCHEDULED_TIME+3000),
  env={GITHUB_DISPATCH_TOKEN:'t'},scheduledTime=SCHEDULED_TIME}={}){
  const t=transport(responses??[json(204,null)]);
  const c=controller({scheduledTime,calls:t.calls});
  const logs=[];
  const original=console.log;
  console.log=line=>logs.push(line);
  let outcome;
  try{outcome=await runScheduledDispatch({controller:c.controller,env,fetchImpl:t.fetchImpl,now});}
  finally{console.log=original;}
  return {outcome,calls:t.calls,logs,state:c.state};
}

/* -------------------------------- dedicated, isolated identity -------------------------------- */

test('the dispatcher runs under a dedicated Worker identity, never the data platform Worker',()=>{
  assert.equal(config.name,'teamsheet-data-s2-dispatcher');
  assert.notEqual(config.name,'teamsheet-data-platform');
  assert.equal(JSON.parse(read(PLATFORM_CONFIG_PATH)).name,'teamsheet-data-platform');
  assert.equal(config.main,'dispatcher.mjs');
  assert.ok(fs.existsSync(`${DISPATCHER_DIR}/${config.main}`));
  // Its own directory, its own Wrangler config, nothing else in it.
  assert.deepEqual(fs.readdirSync(DISPATCHER_DIR).sort(),
    ['dispatch-contract.mjs','dispatcher.mjs','wrangler.jsonc']);
});

test('the Package A dispatcher config declares triggers explicitly and arms no cron',()=>{
  // Explicit, not omitted: Cloudflare treats the triggers block as a total assignment, so an
  // explicit empty array removes Cron triggers from this identity while omitting it would leave
  // whatever already exists in place.
  assert.ok(Object.prototype.hasOwnProperty.call(config,'triggers'));
  assert.deepEqual(config.triggers,{crons:[]});
  assert.equal(config.triggers.crons.length,0);
  assert.match(read(CONFIG_PATH),/"triggers": \{ "crons": \[\] \}/);
  // Package A activates no Cloudflare scheduling of any kind.
  assert.doesNotMatch(read(CONFIG_PATH),/\d+ \* \* \*|\*\/\d+/);
});

test('the dispatcher config holds no data, storage, service or public routing surface',()=>{
  for(const forbidden of ['d1_databases','kv_namespaces','r2_buckets','services','durable_objects',
    'queues','hyperdrive','vectorize','ai','routes','route','custom_domain','vars','send_email',
    'browser','analytics_engine_datasets','mtls_certificates','dispatch_namespaces'])
    assert.equal(config[forbidden],undefined,forbidden);
  assert.equal(config.workers_dev,false);
  assert.equal(config.preview_urls,false);
  assert.doesNotMatch(JSON.stringify(config),/secret|token|credential|d1|account|fingerprint/i);
});

test('the dispatcher exposes a scheduled handler and no public fetch surface',()=>{
  assert.equal(typeof dispatcher.scheduled,'function');
  assert.equal(dispatcher.fetch,undefined);
  // The default export offers exactly one handler, and it is the timer.
  assert.deepEqual(Object.keys(dispatcher),['scheduled']);
  assert.doesNotMatch(sources(),/async fetch\s*\(/);
  assert.doesNotMatch(sources(),/export const fetch|fetch\s*:\s*async|addEventListener|WebSocket/);
  // `fetch` appears only as the injected outbound client, never as an inbound handler.
  assert.deepEqual([...sources().matchAll(/^\s*(?:async )?fetch\s*[(:]/gm)],[]);
});

/* --------------------------- historical Worker re-arm protection --------------------------- */

test('the dispatcher imports nothing from the data platform and cannot escape its directory',()=>{
  const imports=[...sources().matchAll(/from\s*'([^']+)'/g)].map(row=>row[1]);
  assert.deepEqual(imports,['./dispatch-contract.mjs']);
  for(const specifier of imports){
    assert.ok(specifier.startsWith('./'),specifier);
    assert.ok(!specifier.includes('..'),specifier);
  }
  // Raw source, comments included: the dispatcher may not so much as name the collection surface,
  // which is also what the repository-wide production dependency invariant requires of it.
  const raw=`${read(WORKER_PATH)}\n${read(CONTRACT_PATH)}`;
  for(const forbidden of [/data-platform/,/official-fpl/,/production-collection/,/d1-rest/,
    /TEAMSHEET_DATA_DB/,/shadow_observations/,/\.\.\//,/import\(/,/require\(/])
    assert.doesNotMatch(raw,forbidden,String(forbidden));
});

test('the historical collector Worker stays byte-unchanged and undeployable from here',()=>{
  // Pinned byte identity. The historical Worker still declares a thirty-minute Cron trigger and a
  // D1 binding, and DATA-S2C must not touch, redeploy or re-arm it.
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(PLATFORM_CONFIG_PATH)).digest('hex'),
    '2814f28b9fb14cc0ebf42e1f4ce083b5f3b1fe6d37d57a64ced88edf2c5535b6');
  const platform=JSON.parse(read(PLATFORM_CONFIG_PATH));
  assert.deepEqual(platform.triggers,{crons:['*/30 * * * *']});
  assert.deepEqual(platform.d1_databases,
    [{binding:'TEAMSHEET_DATA_DB',database_name:'teamsheet-data',migrations_dir:'migrations'}]);
  assert.match(read('workers/data-platform/data-platform-rpc.mjs'),/scheduled\(/);
  // Nothing in the repository deploys or publishes with the data platform as working directory or
  // with its Wrangler configuration.
  const surfaces=[...fs.readdirSync('.github/workflows').filter(name=>/\.ya?ml$/.test(name))
    .map(name=>`.github/workflows/${name}`),
    ...fs.readdirSync('scripts').filter(name=>/\.(mjs|sh)$/.test(name)).map(name=>`scripts/${name}`)];
  for(const path of surfaces){
    const body=uncommented(read(path));
    assert.doesNotMatch(body,/working-directory:\s*workers\/data-platform/,path);
    assert.doesNotMatch(body,/--config\s+\S*workers\/data-platform/,path);
    assert.doesNotMatch(body,/wrangler\s+(deploy|publish|triggers)/,path);
    assert.ok(!body.includes('workers/data-platform/wrangler.jsonc'),path);
    // Nothing deploys the dispatcher either. Package A ships no deployment surface at all.
    assert.ok(!body.includes('workers/schedule-dispatcher'),path);
  }
});

/* ------------------------------------- secret boundary ------------------------------------- */

test('the dispatcher names exactly one future secret binding and no production identifier',()=>{
  assert.equal(DISPATCH_TOKEN_BINDING,'GITHUB_DISPATCH_TOKEN');
  assert.equal([...sources().matchAll(/GITHUB_DISPATCH_TOKEN/g)].length,2);
  for(const forbidden of [/CLOUDFLARE_ACCOUNT_ID/,/CLOUDFLARE_D1_TOKEN/,/CLOUDFLARE_PRODUCTION/,
    /FINGERPRINT/i,/database_id/i,/TEAMSHEET_DATA_DB/,/fantasy\.premierleague/i,/ANTHROPIC/i,
    /ODDS_/i,/api\.cloudflare/i,/understat/i])
    assert.doesNotMatch(sources(),forbidden,String(forbidden));
  // The only host it contacts is the GitHub API.
  assert.deepEqual([...new Set([...sources().matchAll(/https:\/\/([a-z.]+)\//g)].map(row=>row[1]))].sort(),
    ['api.github.com','github.com']);
});

test('logs carry closed enums and bounded integers only',async()=>{
  const fired=await fire({responses:[json(200,identityBody()),
    json(200,{id:RUN_ID,created_at:new Date(SCHEDULED_TIME+9000).toISOString()})]});
  assert.equal(fired.logs.length,1);
  const logged=JSON.parse(fired.logs[0]);
  assert.deepEqual(Object.keys(logged).sort(),
    ['dispatch','dispatchLatencyMs','endToEndLatencyMs','reason','timerLatencyMs']);
  assert.equal(logged.dispatch,ACCEPTED_WITH_IDENTITY);
  assert.ok(DISPATCH_REASONS.includes(logged.reason));
  for(const key of ['timerLatencyMs','dispatchLatencyMs','endToEndLatencyMs'])
    assert.ok(logged[key]===null||Number.isSafeInteger(logged[key]),key);
  // No token, URL, header, run id, account id or database id may ever reach a log line.
  for(const forbidden of [/Bearer/,/api\.github\.com/,/https:/,new RegExp(String(RUN_ID)),
    /authorization/i,/token/i])
    assert.doesNotMatch(fired.logs[0],forbidden,String(forbidden));
  assert.ok(Object.isFrozen(fired.outcome));
});

/* ----------------------------------- the no-retry contract ----------------------------------- */

test('noRetry is called before any dispatch attempt, on every outcome',async()=>{
  const outcomes=[
    {responses:[json(200,identityBody()),json(500,{})]},
    {responses:[json(204,null)]},
    {responses:[json(403,{})]},
    {responses:[json(500,{})]},
    {responses:[()=>{throw new Error('offline');}]},
    {env:{}}];
  for(const scenario of outcomes){
    const fired=await fire(scenario);
    assert.equal(fired.state.noRetryCalls,1,JSON.stringify(scenario.responses?.length??0));
    // It ran before the first outbound request existed.
    assert.equal(fired.state.noRetryAtCall,0);
  }
  // Structurally: `controller.noRetry()` is the first statement of the handler body, before the
  // token is even read.
  const body=uncommented(read(WORKER_PATH));
  const handler=body.slice(body.indexOf('export async function runScheduledDispatch'));
  assert.ok(handler.indexOf('controller.noRetry();')<handler.indexOf('fetchImpl('));
  assert.ok(handler.indexOf('controller.noRetry();')<handler.indexOf('GITHUB_DISPATCH_TOKEN'));
  assert.equal([...body.matchAll(/noRetry\(\)/g)].length,1);
});

test('exactly one dispatch request is issued per fire and nothing is ever retried',async()=>{
  for(const responses of [[json(204,null)],[json(500,{})],[json(422,{})],[json(429,{})],
    [json(200,{unexpected:true})]]){
    const fired=await fire({responses});
    const dispatches=fired.calls.filter(call=>call.url===DISPATCH_URL);
    assert.equal(dispatches.length,1,JSON.stringify(responses));
    assert.equal(dispatches[0].method,'POST');
  }
  // No loop, timer or scheduling primitive exists that could produce a second attempt.
  const body=uncommented(read(WORKER_PATH));
  assert.doesNotMatch(body,/for\s*\(|while\s*\(|setTimeout|setInterval|\.retry|waitUntil/);
  assert.equal([...body.matchAll(/dispatchRequest\(/g)].length,1);
});

/* ------------------------------ the dispatch request is exact ------------------------------ */

test('the dispatch request targets workflow B with the exact approved body and headers',()=>{
  assert.equal(DISPATCH_WORKFLOW_FILE,'data-s2-production-external.yml');
  assert.equal(DISPATCH_WORKFLOW_PATH,'.github/workflows/data-s2-production-external.yml');
  assert.ok(fs.existsSync(DISPATCH_WORKFLOW_PATH));
  assert.equal(DISPATCH_URL,
    'https://api.github.com/repos/priteshpatel390-del/FPL/actions/workflows/data-s2-production-external.yml/dispatches');
  const request=dispatchRequest('token');
  assert.equal(request.init.method,'POST');
  assert.equal(request.init.headers['x-github-api-version'],'2022-11-28');
  assert.equal(DISPATCH_API_VERSION,'2022-11-28');
  assert.equal(request.init.body,DISPATCH_BODY);
  assert.equal(DISPATCH_BODY,'{"ref":"main","return_run_details":true}');
  assert.equal(DISPATCH_REF,'main');
  // No workflow inputs are ever sent: the caller supplies the ref and nothing else.
  const parsed=JSON.parse(DISPATCH_BODY);
  assert.deepEqual(Object.keys(parsed).sort(),['ref','return_run_details']);
  assert.equal(parsed.inputs,undefined);
  for(const bad of ['',null,7])assert.throws(()=>dispatchRequest(bad),/dispatch_token_missing/);
  // The attended manual workflow is never a dispatch target.
  assert.ok(!DISPATCH_URL.includes('data-s2-production-collection'));
  assert.ok(!DISPATCH_URL.includes('data-s2-production-scheduled'));
});

/* ------------------------------- the response state machine ------------------------------- */

test('HTTP 200 with a valid run identity is accepted with identity',()=>{
  const decided=classifyDispatchResponse({status:200,body:identityBody()});
  assert.equal(decided.classification,ACCEPTED_WITH_IDENTITY);
  assert.equal(decided.reason,'dispatch_accepted');
  assert.equal(decided.runId,RUN_ID);
  assert.equal(validateRunIdentity(identityBody()),RUN_ID);
});

test('HTTP 204 is accepted without identity',()=>{
  const decided=classifyDispatchResponse({status:204,body:null});
  assert.equal(decided.classification,ACCEPTED_NO_IDENTITY);
  assert.equal(decided.runId,null);
});

test('only documented definite no-side-effect statuses are rejected',()=>{
  assert.deepEqual([...REJECTED_STATUSES],[401,403,404,422]);
  for(const status of REJECTED_STATUSES){
    const decided=classifyDispatchResponse({status});
    assert.equal(decided.classification,REJECTED,String(status));
    assert.equal(decided.reason,'dispatch_status_rejected');
  }
});

test('every other status, body or transport outcome is ambiguous, never assumed',()=>{
  for(const status of [500,502,503,504,429,301,302,304,307,308,100,201,202,400,405,409,418,999,0,
    undefined,null,'200'])
    assert.equal(classifyDispatchResponse({status}).classification,AMBIGUOUS,String(status));
  // A 200 whose body is not exactly this repository's run identity is ambiguous, not a success.
  for(const body of [null,undefined,'ok',[],{},{workflow_run_id:0},{workflow_run_id:1.5},
    {workflow_run_id:RUN_ID},
    {...identityBody(),run_url:`https://api.github.com/repos/other/repo/actions/runs/${RUN_ID}`},
    {...identityBody(),html_url:`https://github.com/other/repo/actions/runs/${RUN_ID}`},
    {...identityBody(),run_url:`https://api.github.com/repos/${DISPATCH_REPOSITORY}/actions/runs/1`}]){
    const decided=classifyDispatchResponse({status:200,body});
    assert.equal(decided.classification,AMBIGUOUS,JSON.stringify(body));
    assert.equal(decided.reason,'dispatch_body_invalid');
    assert.equal(validateRunIdentity(body),null);
  }
  assert.equal(classifyDispatchResponse().classification,AMBIGUOUS);
});

test('a transport failure, a timeout and a missing credential each end the fire safely',async()=>{
  const failed=await fire({responses:[()=>{throw new Error('offline');}]});
  assert.equal(failed.outcome.dispatch,AMBIGUOUS);
  assert.equal(failed.outcome.reason,'dispatch_transport_failed');
  const timedOut=await fire({responses:[()=>{throw Object.assign(new Error('t'),{name:'TimeoutError'});}]});
  assert.equal(timedOut.outcome.dispatch,AMBIGUOUS);
  assert.equal(timedOut.outcome.reason,'dispatch_transport_failed');
  // No credential means no request was ever built, so nothing can have happened at GitHub.
  const noToken=await fire({env:{}});
  assert.equal(noToken.outcome.dispatch,REJECTED);
  assert.equal(noToken.outcome.reason,'dispatch_token_missing');
  assert.equal(noToken.calls.length,0);
  // The bounded request carries an abort signal, so a hung connection cannot hold the fire open.
  assert.match(uncommented(read(WORKER_PATH)),/AbortSignal\.timeout\(DISPATCH_TIMEOUT_MS\)/);
});

/* ------------------------- bounded verification of the returned run ------------------------- */

test('only the exact returned run id may be read back, and the run list is never searched',async()=>{
  const fired=await fire({responses:[json(200,identityBody()),
    json(200,{id:RUN_ID,created_at:new Date(SCHEDULED_TIME+9000).toISOString()})]});
  assert.equal(fired.calls.length,2);
  assert.equal(fired.calls[1].method,'GET');
  assert.equal(fired.calls[1].url,
    `https://api.github.com/repos/${DISPATCH_REPOSITORY}/actions/runs/${RUN_ID}`);
  assert.equal(runReadRequest(RUN_ID,'t').url,fired.calls[1].url);
  for(const bad of [0,-1,1.5,'12',null])assert.throws(()=>runReadRequest(bad,'t'),/dispatch_run_id_invalid/);
  // No listing endpoint, no per_page, no heuristic search anywhere in the dispatcher.
  assert.doesNotMatch(sources(),/actions\/runs\?|per_page|workflow_runs|\/runs\?/);
  // A 204 has no identity to verify, so no read is attempted at all.
  const noIdentity=await fire({responses:[json(204,null)]});
  assert.equal(noIdentity.calls.length,1);
  // A verification read that fails changes nothing about the classification.
  const unreadable=await fire({responses:[json(200,identityBody()),json(500,{})]});
  assert.equal(unreadable.outcome.dispatch,ACCEPTED_WITH_IDENTITY);
  assert.equal(unreadable.outcome.dispatchLatencyMs,null);
  assert.equal(unreadable.outcome.endToEndLatencyMs,null);
  // A read that answers about a different run is not evidence about this one.
  const wrongRun=await fire({responses:[json(200,identityBody()),
    json(200,{id:RUN_ID+1,created_at:new Date(SCHEDULED_TIME+9000).toISOString()})]});
  assert.equal(wrongRun.outcome.endToEndLatencyMs,null);
});

/* ------------------------------------ latency telemetry ------------------------------------ */

test('the three latency measurements stay separate and are never conflated',async()=>{
  const fired=await fire({
    now:clock(SCHEDULED_TIME+2000,SCHEDULED_TIME+3500),
    responses:[json(200,identityBody()),
      json(200,{id:RUN_ID,created_at:new Date(SCHEDULED_TIME+11000).toISOString()})]});
  // A: Cloudflare timer delivery — handler start against the scheduled instant.
  assert.equal(fired.outcome.timerLatencyMs,2000);
  // B: GitHub run creation against the instant GitHub accepted the dispatch.
  assert.equal(fired.outcome.dispatchLatencyMs,11000-3500);
  // C: end to end — GitHub run creation against the scheduled instant.
  assert.equal(fired.outcome.endToEndLatencyMs,11000);
  assert.notEqual(fired.outcome.timerLatencyMs,fired.outcome.endToEndLatencyMs);
});

test('B is unavailable on an accepted dispatch without identity, and is never fabricated',async()=>{
  const fired=await fire({responses:[json(204,null)],now:clock(SCHEDULED_TIME+1500,SCHEDULED_TIME+1900)});
  assert.equal(fired.outcome.dispatch,ACCEPTED_NO_IDENTITY);
  assert.equal(fired.outcome.timerLatencyMs,1500);
  assert.equal(fired.outcome.dispatchLatencyMs,null);
  assert.equal(fired.outcome.endToEndLatencyMs,null);
  // Unavailable is null, never zero.
  assert.notEqual(fired.outcome.dispatchLatencyMs,0);
});

test('telemetry is bounded, non-negative, integral and frozen',()=>{
  assert.equal(MAX_LATENCY_MS,24*60*60*1000);
  for(const value of [0,1,MAX_LATENCY_MS])assert.equal(boundedLatency(value),value);
  for(const value of [-1,MAX_LATENCY_MS+1,1.5,Number.NaN,Infinity,'5',null,undefined])
    assert.equal(boundedLatency(value),null,String(value));
  const telemetry=dispatchTelemetry({classification:ACCEPTED_WITH_IDENTITY,
    scheduledTime:SCHEDULED_TIME,handlerStart:SCHEDULED_TIME+10,
    acceptedAt:SCHEDULED_TIME+20,runCreatedAt:SCHEDULED_TIME+30});
  assert.ok(Object.isFrozen(telemetry));
  assert.deepEqual({...telemetry},{timerLatencyMs:10,dispatchLatencyMs:10,endToEndLatencyMs:30});
  // A clock that runs backwards produces unavailable, never a negative number.
  const skewed=dispatchTelemetry({classification:ACCEPTED_WITH_IDENTITY,scheduledTime:SCHEDULED_TIME,
    handlerStart:SCHEDULED_TIME-5,acceptedAt:SCHEDULED_TIME+20,runCreatedAt:SCHEDULED_TIME+10});
  assert.equal(skewed.timerLatencyMs,null);
  assert.equal(skewed.dispatchLatencyMs,null);
  // An unbounded gap is unavailable rather than a huge integer.
  assert.equal(dispatchTelemetry({classification:ACCEPTED_WITH_IDENTITY,scheduledTime:0,
    handlerStart:MAX_LATENCY_MS+1}).timerLatencyMs,null);
});

test('the default scheduled handler drives the same single-fire path',async()=>{
  const c=controller();
  const original=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async(url,init)=>{calls.push({url,method:init.method});return json(204,null);};
  const logged=[];const originalLog=console.log;console.log=line=>logged.push(line);
  try{await dispatcher.scheduled(c.controller,{GITHUB_DISPATCH_TOKEN:'t'});}
  finally{globalThis.fetch=original;console.log=originalLog;}
  assert.equal(c.state.noRetryCalls,1);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,DISPATCH_URL);
  assert.equal(JSON.parse(logged[0]).dispatch,ACCEPTED_NO_IDENTITY);
});
