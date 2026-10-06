// API-Football transport-unknown investigation remediation (after consumed run 37511401491).
// Pins the corrected provider request contract and the closed, sanitized transport diagnostic.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  API_FOOTBALL_ORIGIN,API_FOOTBALL_ENDPOINTS,API_FOOTBALL_REQUEST_HEADER_NAMES,API_FOOTBALL_REQUEST_REDIRECT_MODE,API_FOOTBALL_REQUEST_TIMEOUT_MS,
  API_FOOTBALL_TRANSPORT_DIAGNOSTICS,apiFootballRequestInit,buildPinnedApiFootballUrl,classifyApiFootballTransportException,
  isApiFootballTransportDiagnostic,sendApiFootballRequest
} from '../src/decision-intelligence/api-football-foundation.mjs';
import {ATTENDED_ACCEPTANCE_PATH,ATTENDED_TRANSPORT_DIAGNOSTIC_HEADER,executeProviderTransport,fetch as collectorFetch,runAttendedHttpRequest,sanitizedEvent} from '../workers/api-football-collector/collector.mjs';
import {API_FOOTBALL_ATTENDED_DISCOVERY_ACTIVATION} from '../workers/api-football-collector/runtime-contracts.mjs';
import {REVIEWED_ATTENDED_MODULE_SNAPSHOTS,readReviewedAttendedModuleSource} from '../workers/api-football-collector/stage-inactive-version.mjs';
import {ATTENDED_VERSION_MODULE_SHA256} from '../workers/api-football-collector/attended-version.mjs';
import {runDeployedOneShotContinuation} from '../workers/api-football-collector/deployed-one-shot.mjs';
import {requestPlanForOpportunity} from '../workers/api-football-collector/planner-orchestrator.mjs';
import {discoveryOpportunity} from '../workers/api-football-collector/scheduler.mjs';

const root=path.resolve(import.meta.dirname,'..');
const KEY='deliberate-test-key-material-0123456789';
const D=API_FOOTBALL_TRANSPORT_DIAGNOSTICS;
const FORBIDDEN=/deliberate-test-key-material|x-apisports-key|api-sports\.io|v3\.football|stack|at\s+\S+\s+\(|secret|leak|Invalid redirect|Network connection|http/i;
const request=requestPlanForOpportunity(discoveryOpportunity('2026-10-06T18:29:00.000Z')).requests[0];
const live=()=>new AbortController().signal;

test('provider request contract is GET, redirect manual, exactly one secret header, pinned origin and unchanged endpoint allowlist',()=>{
  const init=apiFootballRequestInit(KEY);
  assert.equal(init.ok,true);
  assert.deepEqual(Object.keys(init.init).sort(),['headers','method','redirect']);
  assert.equal(init.init.method,'GET');assert.equal(init.init.redirect,'manual');assert.equal(API_FOOTBALL_REQUEST_REDIRECT_MODE,'manual');
  assert.deepEqual(Object.keys(init.init.headers),['x-apisports-key']);assert.deepEqual(API_FOOTBALL_REQUEST_HEADER_NAMES,['x-apisports-key']);
  assert.equal(init.init.headers['x-apisports-key'],KEY);assert.ok(Object.isFrozen(init.init.headers));
  assert.equal(apiFootballRequestInit('').reason,'provider_disabled_secret_missing');
  assert.equal(API_FOOTBALL_ORIGIN,'https://v3.football.api-sports.io');assert.equal(API_FOOTBALL_REQUEST_TIMEOUT_MS,15000);
  assert.deepEqual(API_FOOTBALL_ENDPOINTS,['fixtures','fixtures/lineups','fixtures/players','fixtures/events']);
  const url=buildPinnedApiFootballUrl('fixtures',{league:2,season:2026}).url;
  assert.equal(url.origin,API_FOOTBALL_ORIGIN);assert.doesNotMatch(String(url),/deliberate-test-key-material|key/i);
});

test('no shipped Worker-reachable provider request uses redirect "error", which the Workers runtime rejects before network',()=>{
  for(const file of ['src/decision-intelligence/api-football-foundation.mjs','workers/api-football-collector/collector.mjs']){
    const source=fs.readFileSync(path.join(root,file),'utf8');
    assert.doesNotMatch(source,/redirect\s*:\s*'error'/);assert.doesNotMatch(source,/accept\s*:\s*'application\/json'/i);
  }
});

test('the immutable attended Version bytes are reproduced from pinned snapshots, not from the remediated working tree',()=>{
  for(const [repoPath,snapshot] of Object.entries(REVIEWED_ATTENDED_MODULE_SNAPSHOTS)){
    const historical=readReviewedAttendedModuleSource(repoPath),current=fs.readFileSync(path.join(root,repoPath),'utf8');
    assert.notEqual(historical,current,'working tree is remediated');assert.ok(snapshot.file.endsWith('.snapshot'));
  }
  const foundation=readReviewedAttendedModuleSource('src/decision-intelligence/api-football-foundation.mjs');
  assert.match(foundation,/redirect:'error',headers:Object\.freeze\(\{'x-apisports-key':apiKey,accept:'application\/json'\}\)/,'deployed Version 04d79556 still carries the old contract');
  assert.equal(ATTENDED_VERSION_MODULE_SHA256['modules/src/decision-intelligence/api-football-foundation.mjs'],REVIEWED_ATTENDED_MODULE_SNAPSHOTS['src/decision-intelligence/api-football-foundation.mjs'].sha256);
});

test('closed transport taxonomy maps only exact known names and never copies error material',()=>{
  const values=Object.values(D);
  assert.deepEqual(values,['TRANSPORT_TIMEOUT','TRANSPORT_RUNTIME_REDIRECT_MODE_REJECTED','TRANSPORT_FETCH_TYPE_ERROR','TRANSPORT_ABORTED','TRANSPORT_GENERIC_ERROR','TRANSPORT_NON_ERROR_THROWN','TRANSPORT_EXCEPTION_UNKNOWN']);
  const named=(name,message='x')=>Object.assign(new Error(message),{name});
  const cases=[
    [new TypeError('Invalid redirect value, must be one of "follow" or "manual"'),D.RUNTIME_REDIRECT_MODE_REJECTED],
    [new TypeError('fetch failed'),D.FETCH_TYPE_ERROR],
    [named('TimeoutError'),D.TIMEOUT],
    [named('AbortError'),D.ABORTED],
    [new Error('Network connection lost.'),D.GENERIC_ERROR],
    [new RangeError('bad'),D.UNKNOWN],
    [named('SecretError: x-apisports-key=deliberate-test-key-material'),D.UNKNOWN],
    [named('TypeError'.padEnd(5000,'X')),D.UNKNOWN],
    [named(`TypeError${'\u0000'}`),D.UNKNOWN],
    [Object.assign(Object.create(null),{name:'TypeError'}),D.FETCH_TYPE_ERROR],
    [{name:{toString(){return 'TypeError';}}},D.UNKNOWN],
    [new Proxy({},{get(){throw new Error('trap');}}),D.UNKNOWN],
    [{get name(){throw new Error('getter');}},D.UNKNOWN],
    ['x-apisports-key: deliberate-test-key-material',D.NON_ERROR_THROWN],
    [undefined,D.NON_ERROR_THROWN],[null,D.NON_ERROR_THROWN],[42,D.NON_ERROR_THROWN],
    [Object.assign(new TypeError('a'.repeat(10_000)),{cause:new Error('deliberate-test-key-material')}),D.FETCH_TYPE_ERROR],
    [Object.assign(new TypeError('x'),{message:{toString(){return 'Invalid redirect value';}}}),D.FETCH_TYPE_ERROR]
  ];
  for(const [error,expected] of cases){
    const result=classifyApiFootballTransportException(error);
    assert.equal(result,expected);assert.ok(values.includes(result));assert.ok(isApiFootballTransportDiagnostic(result));
  }
  assert.equal(classifyApiFootballTransportException(new TypeError('Invalid redirect value'),{timedOut:true}),D.TIMEOUT);
  for(const bogus of ['transport_failure','TRANSPORT_UNKNOWN','',null,{},'TRANSPORT_EXCEPTION_UNKNOWN '])assert.equal(isApiFootballTransportDiagnostic(bogus),false);
});

test('sendApiFootballRequest keeps the coarse safety reason and adds only a closed diagnostic',async()=>{
  const secretError=Object.assign(new TypeError(`Invalid redirect value for https://v3.football.api-sports.io/fixtures with ${KEY}`),{stack:`TypeError: ${KEY}\n    at fetch (worker.js:1:1)`,cause:{key:KEY},request:{headers:{'x-apisports-key':KEY}}});
  const init=apiFootballRequestInit(KEY).init,url=buildPinnedApiFootballUrl('fixtures',{league:2,season:2026}).url;
  let calls=0;
  const thrown=await sendApiFootballRequest({fetchImpl:()=>{calls+=1;throw secretError;},url,init,timeoutSignal:live});
  assert.deepEqual(Object.keys(thrown).sort(),['ok','reason','transportDiagnostic']);
  assert.equal(thrown.reason,'transport_failure');assert.equal(thrown.transportDiagnostic,D.RUNTIME_REDIRECT_MODE_REJECTED);assert.equal(calls,1);
  assert.doesNotMatch(JSON.stringify(thrown),FORBIDDEN);
  const rejected=await sendApiFootballRequest({fetchImpl:async()=>{calls+=1;throw 'raw provider text deliberate-test-key-material';},url,init,timeoutSignal:live});
  assert.equal(rejected.reason,'transport_failure');assert.equal(rejected.transportDiagnostic,D.NON_ERROR_THROWN);assert.doesNotMatch(JSON.stringify(rejected),FORBIDDEN);
  const controller=new AbortController();controller.abort(Object.assign(new Error('timeout'),{name:'TimeoutError'}));
  const timedOut=await sendApiFootballRequest({fetchImpl:()=>new Promise(()=>{}),url,init,timeoutSignal:()=>controller.signal});
  assert.equal(timedOut.reason,'provider_timeout');assert.equal(timedOut.transportDiagnostic,D.TIMEOUT);
  const ok=await sendApiFootballRequest({fetchImpl:async()=>new Response('{}',{status:200}),url,init,timeoutSignal:live});
  assert.equal(ok.ok,true);assert.equal('transportDiagnostic' in ok,false);
});

test('collector transport: thrown fetch is TRANSPORT_UNKNOWN once, with a sanitized diagnostic and no retry',async()=>{
  let calls=0;
  const result=await executeProviderTransport({env:{API_FOOTBALL_API_KEY:KEY},request,fetchImpl:(url,init)=>{calls+=1;assert.equal(init.redirect,'manual');assert.deepEqual(Object.keys(init.headers),['x-apisports-key']);throw new TypeError(`boom ${KEY} ${url}`);},now:()=> '2026-10-06T18:29:00.000Z',timeoutSignal:live});
  assert.equal(calls,1);assert.equal(result.ok,false);assert.equal(result.reason,'transport_failure');
  assert.equal(result.completion.outcome,'TRANSPORT_UNKNOWN');assert.equal(result.completion.quotaState,'QUOTA_UNCERTAIN');assert.equal(result.completion.timeout,0);
  assert.equal(result.transportDiagnostic,D.FETCH_TYPE_ERROR);assert.doesNotMatch(JSON.stringify(result),FORBIDDEN);
});

test('collector transport: existing HTTP outcomes are unchanged and a 3xx is rejected, never followed',async()=>{
  const at=()=> '2026-10-06T18:29:00.000Z';
  const run=async(status,headers={})=>{let calls=0;const result=await executeProviderTransport({env:{API_FOOTBALL_API_KEY:KEY},request,fetchImpl:async()=>{calls+=1;return new Response('',{status,headers});},now:at,timeoutSignal:live});return {result,calls};};
  for(const [status,reason,outcome] of [[401,'provider_authentication_failed','AUTH_FAILURE'],[403,'provider_authentication_failed','AUTH_FAILURE'],[429,'quota_exhausted','QUOTA_BLOCKED'],[500,'provider_unavailable','HTTP_FAILURE'],[302,'redirect_rejected','HTTP_FAILURE'],[301,'redirect_rejected','HTTP_FAILURE']]){
    const {result,calls}=await run(status,status>=300&&status<400?{location:'https://evil.example/'}:{});
    assert.equal(calls,1);assert.equal(result.reason,reason);assert.equal(result.completion.outcome,outcome);assert.equal('transportDiagnostic' in result,false);
  }
  const body=JSON.stringify({get:'fixtures',parameters:{},errors:[],results:0,paging:{current:1,total:1},response:[]});
  const success=await executeProviderTransport({env:{API_FOOTBALL_API_KEY:KEY},request,fetchImpl:async()=>new Response(body,{status:200,headers:{'content-length':String(body.length),'x-ratelimit-requests-limit':'7500','x-ratelimit-requests-remaining':'7499'}}),now:at,timeoutSignal:live});
  assert.equal(success.ok,true);assert.equal(success.completion.outcome,'SUCCEEDED');
  const schema=await executeProviderTransport({env:{API_FOOTBALL_API_KEY:KEY},request,fetchImpl:async()=>new Response('not json',{status:200}),now:at,timeoutSignal:live});
  assert.equal(schema.ok,false);assert.equal(schema.completion.outcome,'SCHEMA_FAILURE');
});

test('authenticated 409 carries only an allowlisted diagnostic; unauthenticated callers stay generic',async()=>{
  const env={EIA_2I5D_ACTIVATION:API_FOOTBALL_ATTENDED_DISCOVERY_ACTIVATION,API_FOOTBALL_ATTENDED_TRIGGER_SECRET:'t'.repeat(40)};
  const req=(secret=env.API_FOOTBALL_ATTENDED_TRIGGER_SECRET)=>new Request('https://collector.example'+ATTENDED_ACCEPTANCE_PATH,{method:'POST',headers:{'x-teamsheet-attended-trigger':secret}});
  for(const [runResult,expected] of [
    [{ok:false,reason:'transport_failure',transportDiagnostic:D.RUNTIME_REDIRECT_MODE_REJECTED},D.RUNTIME_REDIRECT_MODE_REJECTED],
    [{ok:false,reason:'transport_failure',transportDiagnostic:`TRANSPORT_FETCH_TYPE_ERROR ${KEY}`},null],
    [{ok:false,reason:'transport_failure',transportDiagnostic:{toString:()=>D.FETCH_TYPE_ERROR}},null],
    [{ok:false,reason:'provider_unavailable'},null]
  ]){
    const result=await runAttendedHttpRequest(req(),env,{run:async()=>runResult});
    assert.equal(result.status,409);assert.equal(result.body,'Not accepted');assert.equal(result.transportDiagnostic??null,expected);
    assert.doesNotMatch(JSON.stringify(result),/deliberate-test-key-material/);
  }
  const unauthenticated=await runAttendedHttpRequest(req('w'.repeat(40)),env,{run:async()=>{throw new Error('must not run');}});
  assert.deepEqual({...unauthenticated},{status:404,body:'Not found'});
  const event=sanitizedEvent({operationClass:'PROVIDER',transportDiagnostic:D.ABORTED,message:KEY});
  assert.deepEqual({...event},{operationClass:'PROVIDER',transportDiagnostic:D.ABORTED});
  assert.deepEqual({...sanitizedEvent({transportDiagnostic:KEY})},{});
  assert.equal(ATTENDED_TRANSPORT_DIAGNOSTIC_HEADER,'x-teamsheet-provider-transport-diagnostic');
  const response=await collectorFetch(new Request('https://collector.example/other',{method:'GET'}),env);
  assert.equal(response.status,404);assert.equal(response.headers.get(ATTENDED_TRANSPORT_DIAGNOSTIC_HEADER),null);
});

test('continuation evidence records only an allowlisted provider diagnostic and keeps retryAuthorized false',async()=>{
  const ops=diagnostic=>({verifyDeployment:async()=>{},enableWorkersDev:async()=>{},proveReadiness:async()=>{},enableCollection:async()=>{},
    triggerOnce:async()=>({requestCount:1,outcome:'REJECTED',diagnostic:'DEPLOYED_ONE_SHOT_COLLECTION_NOT_ACCEPTED',providerTransportDiagnostic:diagnostic}),
    disableCollection:async()=>{},disableWorkersDev:async()=>{}});
  for(const [given,expected] of [[D.FETCH_TYPE_ERROR,D.FETCH_TYPE_ERROR],[`${KEY}`,null],[undefined,null]]){
    const result=await runDeployedOneShotContinuation({admissionValid:true,ops:ops(given)});
    assert.equal(result.ok,false);assert.equal(result.retryAuthorized,false);
    assert.equal(result.trigger.requestCount,1);assert.equal(result.trigger.providerTransportDiagnostic,expected);
    assert.doesNotMatch(JSON.stringify(result),/deliberate-test-key-material/);
  }
});

test('continuation executor reads the diagnostic header through the closed allowlist only',()=>{
  const source=fs.readFileSync(path.join(root,'workers/api-football-collector/run-deployed-one-shot-continuation.mjs'),'utf8');
  assert.match(source,/ATTENDED_TRANSPORT_DIAGNOSTIC_HEADER/);assert.match(source,/isApiFootballTransportDiagnostic\(headerValue\)\?headerValue:null/);
  assert.doesNotMatch(source,/x-apisports-key|v3\.football\.api-sports\.io/);
});
