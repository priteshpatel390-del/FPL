import test from 'node:test';
import assert from 'node:assert/strict';
import {GITHUB_EVIDENCE_REPOSITORY,READ_UNAVAILABLE}
  from '../workers/data-steward-watchdog/lib/github-evidence-reader.mjs';
import {decodeTrustedWorkflowRun,readTrustedObserverRun,trustedWorkflowRunRequest}
  from '../workers/data-steward-watchdog/lib/trusted-observer-run-reader.mjs';

const RUN_ID=34450000001;
const JOB_ID=102800000001;
const SHA='0123456789abcdef0123456789abcdef01234567';
const run=(overrides={})=>({id:RUN_ID,name:'Data Steward Read-Only Observer',
  path:'.github/workflows/data-steward-readonly-observer.yml@main',event:'workflow_dispatch',
  head_branch:'main',head_sha:SHA,status:'completed',conclusion:'success',
  created_at:'2026-09-10T04:17:02Z',...overrides});
const job=(overrides={})=>({id:JOB_ID,name:'observe-production-chain',status:'completed',conclusion:'success',
  completed_at:'2026-09-10T04:18:00Z',run_attempt:1,...overrides});
const summary=JSON.stringify({dayDate:'2026-09-10',verdict:'HEALTHY',evaluationReason:'HEALTHY_EXPECTED_STATE',
  heartbeat:'COMPLETE',escalationRequired:false,sentinels:[
    {sentinel:'github',state:'OBSERVED',reasonCode:'GITHUB_CHAIN_OBSERVED'},
    {sentinel:'cloudflare',state:'OBSERVED',reasonCode:'CLOUDFLARE_CONFIGURATION_OBSERVED'},
    {sentinel:'d1',state:'OBSERVED',reasonCode:'D1_STATE_OBSERVED'}]});

const jsonResponse=(body,status=200)=>({status,json:async()=>body});
function logResponse(text=summary){
  const bytes=new TextEncoder().encode(`${text}\n`);
  let sent=false;
  return {status:200,headers:{get:name=>name.toLowerCase()==='content-length'?String(bytes.length):null},
    body:{getReader(){return {async read(){if(sent)return {done:true};sent=true;return {done:false,value:bytes};},
      async cancel(){sent=true;}};}}};
}

function transport({runBody=run(),jobsBody={total_count:1,jobs:[job()]},logBody=summary}={}){
  const calls=[];
  const fetchImpl=async(url,init)=>{
    calls.push({url,method:init.method});
    if(url.endsWith(`/actions/runs/${RUN_ID}`))return jsonResponse(runBody);
    if(url.endsWith(`/actions/runs/${RUN_ID}/jobs?per_page=100&filter=all`))return jsonResponse(jobsBody);
    if(url.endsWith(`/actions/jobs/${JOB_ID}/logs`))return logResponse(logBody);
    throw new Error(`unexpected ${url}`);
  };
  return {calls,fetchImpl};
}

test('exact run request is a GET for only the receipt-proven run id',()=>{
  const request=trustedWorkflowRunRequest(RUN_ID,'read-token');
  assert.equal(request.url,`https://api.github.com/repos/${GITHUB_EVIDENCE_REPOSITORY}/actions/runs/${RUN_ID}`);
  assert.equal(request.init.method,'GET');
  assert.doesNotMatch(request.url,/workflows\/.*\/runs|per_page|created=/);
});

test('trusted run decoder requires exact observer identity, workflow path, main and workflow_dispatch',()=>{
  assert.equal(decodeTrustedWorkflowRun(run(),RUN_ID)?.id,RUN_ID);
  for(const body of [run({id:RUN_ID+1}),run({name:'Other'}),run({path:'.github/workflows/other.yml@main'}),
    run({event:'schedule'}),run({head_branch:'feature'}),run({head_sha:'bad'}),run({created_at:'bad'})])
    assert.equal(decodeTrustedWorkflowRun(body,RUN_ID),null);
});

test('one receipt-proven successful run is read through exact GETs and its sanitized summary is decoded',async()=>{
  const t=transport();
  const result=await readTrustedObserverRun({runId:RUN_ID,token:'read-token',fetchImpl:t.fetchImpl});
  assert.equal(result.ok,true);
  assert.equal(result.run.id,RUN_ID);
  assert.equal(result.run.runAttempt,1);
  assert.equal(result.run.jobHealth,'SUCCESS');
  assert.equal(result.run.summary.verdict,'HEALTHY');
  assert.deepEqual(t.calls.map(call=>call.method),['GET','GET','GET']);
  assert.ok(t.calls.every(call=>call.url.includes(String(RUN_ID))||call.url.includes(String(JOB_ID))));
  assert.ok(t.calls.every(call=>!call.url.includes('/dispatches')));
});

test('the reader never searches recent history or substitutes a different manual run',async()=>{
  const t=transport({runBody:run({id:RUN_ID+9})});
  const result=await readTrustedObserverRun({runId:RUN_ID,token:'read-token',fetchImpl:t.fetchImpl});
  assert.equal(result.ok,false);
  assert.equal(result.reasonCode,READ_UNAVAILABLE);
  assert.equal(t.calls.length,1);
  assert.equal(t.calls[0].url,`https://api.github.com/repos/${GITHUB_EVIDENCE_REPOSITORY}/actions/runs/${RUN_ID}`);
});

test('latest rerun attempt of the same receipt-proven run decides evidence',async()=>{
  const secondJob=job({id:JOB_ID+1,run_attempt:2,completed_at:'2026-09-10T04:19:00Z'});
  const calls=[];
  const fetchImpl=async(url,init)=>{
    calls.push({url,method:init.method});
    if(url.endsWith(`/actions/runs/${RUN_ID}`))return jsonResponse(run());
    if(url.includes(`/actions/runs/${RUN_ID}/jobs`))return jsonResponse({total_count:2,jobs:[job(),secondJob]});
    if(url.endsWith(`/actions/jobs/${JOB_ID+1}/logs`))return logResponse();
    throw new Error('wrong job selected');
  };
  const result=await readTrustedObserverRun({runId:RUN_ID,token:'read-token',fetchImpl});
  assert.equal(result.ok,true);
  assert.equal(result.run.runAttempt,2);
  assert.ok(calls.some(call=>call.url.endsWith(`/actions/jobs/${JOB_ID+1}/logs`)));
  assert.ok(!calls.some(call=>call.url.endsWith(`/actions/jobs/${JOB_ID}/logs`)));
});

test('in-flight and skipped exact runs do not attempt a summary read',async()=>{
  for(const fixture of [job({status:'in_progress',conclusion:null,completed_at:null}),
    job({conclusion:'skipped'})]){
    const t=transport({jobsBody:{total_count:1,jobs:[fixture]}});
    const result=await readTrustedObserverRun({runId:RUN_ID,token:'read-token',fetchImpl:t.fetchImpl});
    assert.equal(result.ok,true);
    assert.equal(result.run.summaryAttempted,false);
    assert.equal(t.calls.length,2);
  }
});

test('malformed run, jobs or transport failure is evidence unavailable, never healthy',async()=>{
  for(const t of [transport({runBody:run({path:'bad'})}),transport({jobsBody:{total_count:2,jobs:[job()]}})]){
    const result=await readTrustedObserverRun({runId:RUN_ID,token:'read-token',fetchImpl:t.fetchImpl});
    assert.equal(result.ok,false);assert.equal(result.reasonCode,READ_UNAVAILABLE);
  }
  const result=await readTrustedObserverRun({runId:RUN_ID,token:'read-token',fetchImpl:async()=>{throw new Error('network');}});
  assert.equal(result.ok,false);assert.equal(result.reasonCode,READ_UNAVAILABLE);
});
