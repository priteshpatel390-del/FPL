// DATA-S2C — permanent regressions for the isolated Cloudflare production schedule dispatcher.
// The owner-approved cadence is now one daily collection opportunity at 01:17 UTC. The existing
// production opportunity guard remains the defence against duplicate same-day collection; there
// is deliberately no second automatic retry opportunity.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {ACCEPTED_NO_IDENTITY,ACCEPTED_WITH_IDENTITY,AMBIGUOUS,DISPATCH_API_VERSION,DISPATCH_BODY,
  DISPATCH_REASONS,DISPATCH_REF,DISPATCH_REPOSITORY,DISPATCH_TOKEN_BINDING,DISPATCH_URL,
  DISPATCH_WORKFLOW_FILE,DISPATCH_WORKFLOW_PATH,MAX_LATENCY_MS,REJECTED,REJECTED_STATUSES,
  boundedLatency,classifyDispatchResponse,dispatchRequest,dispatchTelemetry,runReadRequest,
  validateRunIdentity} from '../workers/schedule-dispatcher/dispatch-contract.mjs';
import dispatcher,{runScheduledDispatch} from '../workers/schedule-dispatcher/dispatcher.mjs';

const DIR='workers/schedule-dispatcher';
const CONFIG=`${DIR}/wrangler.jsonc`;
const WORKER=`${DIR}/dispatcher.mjs`;
const CONTRACT=`${DIR}/dispatch-contract.mjs`;
const PLATFORM='workers/data-platform/wrangler.jsonc';
const read=file=>fs.readFileSync(file,'utf8');
const uncommented=source=>source.split('\n').filter(line=>!/^\s*(#|\/\/)/.test(line)).join('\n');
const config=JSON.parse(read(CONFIG));
const sources=()=>uncommented(`${read(WORKER)}\n${read(CONTRACT)}`);
const APPROVED_CRONS=['17 1 * * *'];
const SCHEDULED_TIME=Date.UTC(2026,8,10,1,17,0);
const RUN_ID=34450010001;

const json=(status,body)=>({status,json:async()=>body});
const identityBody=(runId=RUN_ID)=>({workflow_run_id:runId,
  run_url:`https://api.github.com/repos/${DISPATCH_REPOSITORY}/actions/runs/${runId}`,
  html_url:`https://github.com/${DISPATCH_REPOSITORY}/actions/runs/${runId}`});

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

function controller({scheduledTime=SCHEDULED_TIME,calls=[]}={}){
  const state={noRetryCalls:0,noRetryAtCall:null};
  return {state,controller:{scheduledTime,noRetry(){state.noRetryCalls+=1;
    if(state.noRetryAtCall===null)state.noRetryAtCall=calls.length;}}};
}

const clock=(...values)=>{
  const fn=()=>{const value=values[Math.min(fn.calls,values.length-1)];fn.calls+=1;return value;};
  fn.calls=0;return fn;
};

async function fire({responses=[json(204,null)],now=clock(SCHEDULED_TIME+2000,SCHEDULED_TIME+3000),
  env={GITHUB_DISPATCH_TOKEN:'t'},scheduledTime=SCHEDULED_TIME}={}){
  const t=transport(responses);const c=controller({scheduledTime,calls:t.calls});
  const logs=[];const original=console.log;console.log=line=>logs.push(line);
  const clockReadsAtRequest=[];
  const fetchImpl=async(url,init)=>{clockReadsAtRequest.push(now.calls);return t.fetchImpl(url,init);};
  let outcome;
  try{outcome=await runScheduledDispatch({controller:c.controller,env,fetchImpl,now});}
  finally{console.log=original;}
  return {outcome,calls:t.calls,logs,state:c.state,clockReadsAtRequest,clockReads:now.calls};
}

test('production dispatcher keeps its dedicated isolated Worker identity',()=>{
  assert.equal(config.name,'teamsheet-data-s2-dispatcher');
  assert.notEqual(config.name,JSON.parse(read(PLATFORM)).name);
  assert.equal(config.main,'dispatcher.mjs');
  assert.deepEqual(fs.readdirSync(DIR).sort(),['dispatch-contract.mjs','dispatcher.mjs','wrangler.jsonc']);
});

test('production dispatcher declares exactly one 01:17 UTC collection opportunity',()=>{
  assert.deepEqual(config.triggers,{crons:APPROVED_CRONS});
  assert.equal(config.triggers.crons.length,1);
  assert.deepEqual(config.triggers.crons[0].split(' '),['17','1','*','*','*']);
  assert.doesNotMatch(read(CONFIG),/"17 [23] \* \* \*"/);
  assert.doesNotMatch(read(CONFIG),/\*\/\d+/);
});

test('production dispatcher has no timezone override, so 01:17 is UTC',()=>{
  assert.doesNotMatch(read(CONFIG),/timezone|time_zone|"tz"|Europe\/London|BST/i);
});

test('GitHub scheduled workflow A stays retired; Cloudflare is the only automatic production clock',()=>{
  assert.ok(!fs.existsSync('.github/workflows/data-s2-production-scheduled.yml'));
  const surfaces=[...fs.readdirSync('.github/workflows').filter(name=>/\.ya?ml$/.test(name))
    .map(name=>`.github/workflows/${name}`),
    ...fs.readdirSync('scripts').filter(name=>/\.(mjs|sh)$/.test(name)).map(name=>`scripts/${name}`)];
  for(const path of surfaces){
    const body=uncommented(read(path));
    assert.doesNotMatch(body,/actions\/workflows\/[^\s]*\/(enable|disable|dispatches)/,path);
    assert.doesNotMatch(body,/gh workflow (enable|disable|run)/,path);
    assert.ok(!body.includes('workers/schedule-dispatcher'),path);
  }
});

test('dispatcher config holds no data, storage, service, email or public routing surface',()=>{
  for(const forbidden of ['d1_databases','kv_namespaces','r2_buckets','services','durable_objects',
    'queues','hyperdrive','vectorize','ai','routes','route','custom_domain','vars','send_email',
    'browser','analytics_engine_datasets','mtls_certificates','dispatch_namespaces'])
    assert.equal(config[forbidden],undefined,forbidden);
  assert.equal(config.workers_dev,false);
  assert.equal(config.preview_urls,false);
  assert.doesNotMatch(JSON.stringify(config),/secret|token|credential|d1|account|fingerprint/i);
});

test('dispatcher exposes scheduled only and no public fetch surface',()=>{
  assert.equal(typeof dispatcher.scheduled,'function');
  assert.equal(dispatcher.fetch,undefined);
  assert.deepEqual(Object.keys(dispatcher),['scheduled']);
  assert.doesNotMatch(sources(),/async fetch\s*\(|export const fetch|addEventListener|WebSocket/);
});

test('dispatcher imports only its local pure contract and cannot reach production implementation',()=>{
  const imports=[...sources().matchAll(/from\s*'([^']+)'/g)].map(row=>row[1]);
  assert.deepEqual(imports,['./dispatch-contract.mjs']);
  const raw=`${read(WORKER)}\n${read(CONTRACT)}`;
  for(const forbidden of [/\.\.\//,/import\(/,/require\(/,/TEAMSHEET_DATA_DB/,
    /CLOUDFLARE_D1_TOKEN/,/CLOUDFLARE_ACCOUNT_ID/,/api\.cloudflare/i,/fantasy\.premierleague/i,
    /understat/i,/ANTHROPIC/i,/ODDS_/i])assert.doesNotMatch(raw,forbidden,String(forbidden));
});

test('historical collector Worker remains byte-pinned and is never deployed from dispatcher surfaces',()=>{
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(PLATFORM)).digest('hex'),
    '2814f28b9fb14cc0ebf42e1f4ce083b5f3b1fe6d37d57a64ced88edf2c5535b6');
  const platform=JSON.parse(read(PLATFORM));
  assert.deepEqual(platform.triggers,{crons:['*/30 * * * *']});
  assert.deepEqual(platform.d1_databases,
    [{binding:'TEAMSHEET_DATA_DB',database_name:'teamsheet-data',migrations_dir:'migrations'}]);
});

test('dispatcher names exactly one dedicated GitHub dispatch secret and no production identifier',()=>{
  assert.equal(DISPATCH_TOKEN_BINDING,'GITHUB_DISPATCH_TOKEN');
  for(const forbidden of [/CLOUDFLARE_ACCOUNT_ID/,/CLOUDFLARE_D1_TOKEN/,/CLOUDFLARE_PRODUCTION/,
    /FINGERPRINT/i,/database_id/i,/TEAMSHEET_DATA_DB/,/fantasy\.premierleague/i,/ANTHROPIC/i,
    /ODDS_/i,/api\.cloudflare/i,/understat/i])assert.doesNotMatch(sources(),forbidden,String(forbidden));
  assert.deepEqual([...new Set([...sources().matchAll(/https:\/\/([a-z.]+)\//g)].map(row=>row[1]))].sort(),
    ['api.github.com','github.com']);
});

test('dispatch request is exact: workflow B, main, no inputs and fixed GitHub headers',()=>{
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
  assert.deepEqual(Object.keys(JSON.parse(DISPATCH_BODY)).sort(),['ref','return_run_details']);
  for(const bad of ['',null,7])assert.throws(()=>dispatchRequest(bad),/dispatch_token_missing/);
});

test('noRetry runs before every dispatch attempt and there is never a second POST',async()=>{
  const scenarios=[{responses:[json(204,null)]},{responses:[json(403,{})]},
    {responses:[json(500,{})]},{responses:[()=>{throw new Error('offline');}]},{env:{}}];
  for(const scenario of scenarios){
    const fired=await fire(scenario);
    assert.equal(fired.state.noRetryCalls,1);
    assert.equal(fired.state.noRetryAtCall,0);
    assert.ok(fired.calls.filter(call=>call.url===DISPATCH_URL).length<=1);
  }
  const body=uncommented(read(WORKER));
  const handler=body.slice(body.indexOf('export async function runScheduledDispatch'));
  assert.ok(handler.indexOf('controller.noRetry();')<handler.indexOf('fetchImpl('));
  assert.equal([...handler.matchAll(/dispatchRequest\(/g)].length,1);
  assert.doesNotMatch(handler,/for\s*\(|while\s*\(|setTimeout|setInterval|\.retry\s*\(|\bretry\s*\(/i);
});

test('valid HTTP 200 identity is accepted and malformed identity is ambiguous',()=>{
  const valid=classifyDispatchResponse({status:200,body:identityBody()});
  assert.equal(valid.classification,ACCEPTED_WITH_IDENTITY);
  assert.equal(valid.runId,RUN_ID);
  assert.equal(validateRunIdentity(identityBody()),RUN_ID);
  for(const body of [null,{},[],{workflow_run_id:RUN_ID},
    {...identityBody(),run_url:`https://api.github.com/repos/other/repo/actions/runs/${RUN_ID}`},
    {...identityBody(),html_url:`https://github.com/other/repo/actions/runs/${RUN_ID}`}]){
    assert.equal(classifyDispatchResponse({status:200,body}).classification,AMBIGUOUS);
    assert.equal(validateRunIdentity(body),null);
  }
});

test('204 remains accepted without identity; definite rejected statuses stay closed',()=>{
  assert.equal(classifyDispatchResponse({status:204}).classification,ACCEPTED_NO_IDENTITY);
  assert.deepEqual([...REJECTED_STATUSES],[401,403,404,422]);
  for(const status of REJECTED_STATUSES)
    assert.equal(classifyDispatchResponse({status}).classification,REJECTED,String(status));
});

test('all other statuses are ambiguous rather than automatically retried',()=>{
  for(const status of [500,502,503,504,429,301,307,201,202,400,405,409,999,0,undefined,null,'200'])
    assert.equal(classifyDispatchResponse({status}).classification,AMBIGUOUS,String(status));
});

test('transport uncertainty is ambiguous; missing credential is definite no-dispatch',async()=>{
  const failed=await fire({responses:[()=>{throw new Error('offline');}]});
  assert.equal(failed.outcome.dispatch,AMBIGUOUS);
  assert.equal(failed.outcome.reason,'dispatch_transport_failed');
  const noToken=await fire({env:{}});
  assert.equal(noToken.outcome.dispatch,REJECTED);
  assert.equal(noToken.outcome.reason,'dispatch_token_missing');
  assert.equal(noToken.calls.length,0);
  assert.match(uncommented(read(WORKER)),/AbortSignal\.timeout\(DISPATCH_TIMEOUT_MS\)/);
});

test('only exact returned run id may be read back; run history is never searched',async()=>{
  const fired=await fire({responses:[json(200,identityBody()),
    json(200,{id:RUN_ID,created_at:new Date(SCHEDULED_TIME+9000).toISOString()})]});
  assert.equal(fired.calls.length,2);
  assert.equal(fired.calls[1].method,'GET');
  assert.equal(fired.calls[1].url,`https://api.github.com/repos/${DISPATCH_REPOSITORY}/actions/runs/${RUN_ID}`);
  assert.equal(runReadRequest(RUN_ID,'t').url,fired.calls[1].url);
  assert.doesNotMatch(sources(),/actions\/runs\?|per_page|workflow_runs|\/runs\?/);
  const noIdentity=await fire({responses:[json(204,null)]});
  assert.equal(noIdentity.calls.length,1);
});

test('logs contain only closed outcome fields and bounded latency integers',async()=>{
  const fired=await fire({responses:[json(200,identityBody()),
    json(200,{id:RUN_ID,created_at:new Date(SCHEDULED_TIME+9000).toISOString()})]});
  assert.equal(fired.logs.length,1);
  const logged=JSON.parse(fired.logs[0]);
  assert.deepEqual(Object.keys(logged).sort(),
    ['dispatch','endToEndLatencyMs','reason','requestToRunCreationLatencyMs','timerLatencyMs']);
  assert.ok(DISPATCH_REASONS.includes(logged.reason));
  for(const key of ['timerLatencyMs','requestToRunCreationLatencyMs','endToEndLatencyMs'])
    assert.ok(logged[key]===null||Number.isSafeInteger(logged[key]),key);
  assert.doesNotMatch(fired.logs[0],/Bearer|api\.github\.com|https:|authorization|token/i);
  assert.doesNotMatch(fired.logs[0],new RegExp(String(RUN_ID)));
  assert.ok(Object.isFrozen(fired.outcome));
});

test('three telemetry dimensions stay separate and request latency uses request start',async()=>{
  const fired=await fire({now:clock(SCHEDULED_TIME+2000,SCHEDULED_TIME+3500),
    responses:[json(200,identityBody()),
      json(200,{id:RUN_ID,created_at:new Date(SCHEDULED_TIME+11000).toISOString()})]});
  assert.equal(fired.outcome.timerLatencyMs,2000);
  assert.equal(fired.outcome.requestToRunCreationLatencyMs,7500);
  assert.equal(fired.outcome.endToEndLatencyMs,11000);
  assert.deepEqual(fired.clockReadsAtRequest,[2,2]);
  assert.equal(fired.clockReads,2);
});

test('latency telemetry stays bounded, non-negative, integral, nullable and frozen',()=>{
  assert.equal(MAX_LATENCY_MS,24*60*60*1000);
  for(const value of [0,1,MAX_LATENCY_MS])assert.equal(boundedLatency(value),value);
  for(const value of [-1,MAX_LATENCY_MS+1,1.5,Number.NaN,Infinity,'5',null,undefined])
    assert.equal(boundedLatency(value),null,String(value));
  const telemetry=dispatchTelemetry({classification:ACCEPTED_WITH_IDENTITY,
    scheduledTime:SCHEDULED_TIME,handlerStart:SCHEDULED_TIME+10,
    dispatchRequestStartedAt:SCHEDULED_TIME+20,runCreatedAt:SCHEDULED_TIME+30});
  assert.deepEqual({...telemetry},{timerLatencyMs:10,requestToRunCreationLatencyMs:10,endToEndLatencyMs:30});
  assert.ok(Object.isFrozen(telemetry));
});

test('one 01:17 fire is the only automatic chance; dispatcher itself contains no recovery scheduler',()=>{
  assert.deepEqual(config.triggers.crons,['17 1 * * *']);
  const body=uncommented(read(WORKER));
  assert.doesNotMatch(body,/02:17|03:17|next scheduled opportunity/i);
  // `controller.noRetry()` is required to stop Cloudflare re-delivery. Forbid actual retry
  // mechanisms, not the protective noRetry call itself.
  assert.doesNotMatch(body,/setTimeout|setInterval|\.retry\s*\(|\bretry\s*\(/i);
});

test('default scheduled handler drives the same one-fire path',async()=>{
  const c=controller();const original=globalThis.fetch;const calls=[];
  globalThis.fetch=async(url,init)=>{calls.push({url,method:init.method});return json(204,null);};
  const logged=[];const originalLog=console.log;console.log=line=>logged.push(line);
  try{await dispatcher.scheduled(c.controller,{GITHUB_DISPATCH_TOKEN:'t'});}
  finally{globalThis.fetch=original;console.log=originalLog;}
  assert.equal(c.state.noRetryCalls,1);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,DISPATCH_URL);
  assert.equal(JSON.parse(logged[0]).dispatch,ACCEPTED_NO_IDENTITY);
});
