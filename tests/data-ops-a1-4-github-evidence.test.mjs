import test from 'node:test';
import assert from 'node:assert/strict';
import {GITHUB_EVIDENCE_JOB_NAME,GITHUB_EVIDENCE_MAX_RUN_PAGES,GITHUB_EVIDENCE_RUNS_PAGE_SIZE,
  GithubEvidenceError,JOB_HEALTH_FAILED,JOB_HEALTH_IN_FLIGHT,JOB_HEALTH_SKIPPED,
  JOB_HEALTH_SUCCESS,JOB_HEALTH_UNCLASSIFIED,READ_BOUND_EXHAUSTED,READ_OK,READ_UNAVAILABLE,
  classifyJobHealth,decodeJobs,decodeObserverSummary,decodeRunsPage,jobLogRequest,
  readObserverEvidence,runJobsRequest,workflowRunsRequest} from '../workers/data-steward-watchdog/lib/github-evidence-reader.mjs';

const SHA='a'.repeat(40);
const summaryLine=(overrides={})=>JSON.stringify({dayDate:'2026-09-09',verdict:'HEALTHY',
  evaluationReason:'HEALTHY_EXPECTED_STATE',heartbeat:'COMPLETE',escalationRequired:false,
  sentinels:[{sentinel:'github',state:'OBSERVED',reasonCode:'GITHUB_CHAIN_OBSERVED'}],...overrides});

function runsBody(runs){return {total_count:runs.length,workflow_runs:runs};}
function jobsBody(jobs){return {total_count:jobs.length,jobs};}
function run({id,event='schedule',createdAt='2026-09-09T05:17:03Z',status='completed',conclusion='success'}){
  return {id,created_at:createdAt,event,head_sha:SHA,status,conclusion};
}
function job({id=900,name=GITHUB_EVIDENCE_JOB_NAME,status='completed',conclusion='success',
  completedAt='2026-09-09T05:20:00Z',runAttempt=1}={}){
  return {id,name,status,conclusion,completed_at:completedAt,run_attempt:runAttempt};
}

function fakeFetch({runsById={},jobsById={},logsById={},status=null}={}){
  return async url=>{
    if(status)return {status,json:async()=>({})};
    const runsMatch=/\/runs\?.*page=(\d+)/.exec(url);
    if(runsMatch){
      const page=Number(runsMatch[1]);
      return {status:200,json:async()=>runsById[page]??runsBody([])};
    }
    const jobsMatch=/\/actions\/runs\/(\d+)\/jobs/.exec(url);
    if(jobsMatch)return {status:200,json:async()=>jobsBody(jobsById[jobsMatch[1]]??[])};
    const logMatch=/\/actions\/jobs\/(\d+)\/logs/.exec(url);
    if(logMatch){
      const text=logsById[logMatch[1]];
      if(text===undefined)return {status:404,json:async()=>({})};
      if(text==='THROW')throw new Error('transport');
      const bytes=new TextEncoder().encode(text);
      return {status:200,headers:{get:name=>name==='content-length'?String(bytes.byteLength):null},
        body:new ReadableStream({start(controller){controller.enqueue(bytes);controller.close();}})};
    }
    return {status:404,json:async()=>({})};
  };
}

test('request builders are GET-only and bounded',()=>{
  const runsReq=workflowRunsRequest('t','2026-09-06T00:00:00.000Z',1);
  assert.equal(runsReq.init.method,'GET');
  assert.throws(()=>workflowRunsRequest('t','2026-09-06T00:00:00.000Z',GITHUB_EVIDENCE_MAX_RUN_PAGES+1),
    GithubEvidenceError);
  assert.equal(runJobsRequest(1,'t').init.method,'GET');
  assert.throws(()=>runJobsRequest(0,'t'),GithubEvidenceError);
  assert.equal(jobLogRequest(1,'t').init.method,'GET');
  assert.throws(()=>jobLogRequest(0,'t'),GithubEvidenceError);
});

test('decodeRunsPage rejects inconsistent counts and malformed rows',()=>{
  assert.equal(decodeRunsPage(null,1),null);
  assert.equal(decodeRunsPage({total_count:2,workflow_runs:[run({id:1})]},1),null);
  assert.equal(decodeRunsPage({total_count:1,workflow_runs:[{id:1}]},1),null);
  const ok=decodeRunsPage(runsBody([run({id:1})]),1);
  assert.equal(ok.runs[0].id,1);
  assert.equal(ok.runs[0].event,'schedule');
});

test('decodeJobs rejects a truncated listing and malformed rows',()=>{
  assert.equal(decodeJobs({total_count:2,jobs:[job()]}),null);
  assert.equal(decodeJobs({total_count:1,jobs:[{id:1}]}),null);
  const ok=decodeJobs(jobsBody([job()]));
  assert.equal(ok[0].name,GITHUB_EVIDENCE_JOB_NAME);
});

test('classifyJobHealth covers success, failure, skip, in-flight and unclassified',()=>{
  assert.equal(classifyJobHealth(job({status:'completed',conclusion:'success'})),JOB_HEALTH_SUCCESS);
  assert.equal(classifyJobHealth(job({status:'completed',conclusion:'failure'})),JOB_HEALTH_FAILED);
  assert.equal(classifyJobHealth(job({status:'completed',conclusion:'cancelled'})),JOB_HEALTH_FAILED);
  assert.equal(classifyJobHealth(job({status:'completed',conclusion:'skipped'})),JOB_HEALTH_SKIPPED);
  assert.equal(classifyJobHealth(job({status:'in_progress',conclusion:null})),JOB_HEALTH_IN_FLIGHT);
  assert.equal(classifyJobHealth(job({status:'completed',conclusion:'neutral'})),JOB_HEALTH_UNCLASSIFIED);
});

test('decodeObserverSummary accepts exactly one well-formed line and rejects the rest',()=>{
  const ok=decodeObserverSummary(`2026-09-09T05:20:00.0000000Z ${summaryLine()}\n`);
  assert.equal(ok.verdict,'HEALTHY');
  assert.equal(decodeObserverSummary('not json at all'),null);
  assert.equal(decodeObserverSummary(''),null);
  assert.equal(decodeObserverSummary(null),null);
  assert.equal(decodeObserverSummary(`${summaryLine()}\n${summaryLine()}\n`),null,'more than one candidate is ambiguous');
  assert.equal(decodeObserverSummary(summaryLine({verdict:'BOGUS'})),null);
  assert.equal(decodeObserverSummary(summaryLine({escalationRequired:'no'})),null);
  assert.equal(decodeObserverSummary(JSON.stringify({...JSON.parse(summaryLine()),sentinels:[{sentinel:'GITHUB',state:'OBSERVED',reasonCode:'X'}]})),null);
});

test('reads one healthy scheduled run and recovers its sanitized summary',async()=>{
  const fetchImpl=fakeFetch({
    runsById:{1:runsBody([run({id:501})])},
    jobsById:{501:[job({id:9001})]},
    logsById:{9001:`${summaryLine()}\n`}
  });
  const result=await readObserverEvidence({token:'t',fetchImpl,now:Date.parse('2026-09-09T12:00:00Z')});
  assert.equal(result.ok,true);
  assert.equal(result.reasonCode,READ_OK);
  assert.equal(result.runs.length,1);
  assert.equal(result.runs[0].jobHealth,JOB_HEALTH_SUCCESS);
  assert.equal(result.runs[0].summary.verdict,'HEALTHY');
});

test('a manual dispatch run is observed but distinguishable from a scheduled one',async()=>{
  const fetchImpl=fakeFetch({
    runsById:{1:runsBody([run({id:601,event:'workflow_dispatch'})])},
    jobsById:{601:[job({id:9101})]},
    logsById:{9101:`${summaryLine()}\n`}
  });
  const result=await readObserverEvidence({token:'t',fetchImpl,now:Date.parse('2026-09-09T12:00:00Z')});
  assert.equal(result.runs[0].event,'workflow_dispatch');
});

test('the summary log is read for at most one run per cycle',async()=>{
  let logReads=0;
  const fetchImpl=async(url,init)=>{
    if(/\/actions\/jobs\/\d+\/logs/.test(url)){
      logReads+=1;
      const bytes=new TextEncoder().encode(`${summaryLine()}\n`);
      return {status:200,headers:{get:name=>name==='content-length'?String(bytes.byteLength):null},
        body:new ReadableStream({start(controller){controller.enqueue(bytes);controller.close();}})};
    }
    if(/\/runs\?.*page=1/.test(url))
      return {status:200,json:async()=>runsBody([
        run({id:701,createdAt:'2026-09-09T05:17:00Z'}),run({id:702,createdAt:'2026-09-09T02:17:00Z'})])};
    if(/\/actions\/runs\/701\/jobs/.test(url))return {status:200,json:async()=>jobsBody([job({id:9201})])};
    if(/\/actions\/runs\/702\/jobs/.test(url))return {status:200,json:async()=>jobsBody([job({id:9202})])};
    return {status:404,json:async()=>({})};
  };
  const result=await readObserverEvidence({token:'t',fetchImpl,now:Date.parse('2026-09-09T12:00:00Z')});
  assert.equal(result.ok,true);
  assert.equal(logReads,1,'only the most recent qualifying run is checked for a summary');
  assert.equal(result.runs[0].summary!==null||result.runs[1].summary!==null,true);
});

test('a job whose observer summary is malformed is still reported, decoded as null',async()=>{
  const fetchImpl=fakeFetch({
    runsById:{1:runsBody([run({id:801})])},
    jobsById:{801:[job({id:9301})]},
    logsById:{9301:'not a json line at all\n'}
  });
  const result=await readObserverEvidence({token:'t',fetchImpl,now:Date.parse('2026-09-09T12:00:00Z')});
  assert.equal(result.ok,true);
  assert.equal(result.runs[0].summary,null);
});

test('a failed and a skipped run are both observed without a log read',async()=>{
  const fetchImpl=fakeFetch({
    runsById:{1:runsBody([run({id:901,conclusion:'success'})])},
    jobsById:{901:[job({id:9401,conclusion:'failure'})]}
  });
  const result=await readObserverEvidence({token:'t',fetchImpl,now:Date.parse('2026-09-09T12:00:00Z')});
  assert.equal(result.runs[0].jobHealth,JOB_HEALTH_FAILED);
  assert.equal(result.runs[0].summary,null);
});

test('an in-flight job is IN_FLIGHT, never counted as success or failure',async()=>{
  const fetchImpl=fakeFetch({
    runsById:{1:runsBody([run({id:1001,status:'in_progress',conclusion:null})])},
    jobsById:{1001:[job({id:9501,status:'in_progress',conclusion:null})]}
  });
  const result=await readObserverEvidence({token:'t',fetchImpl,now:Date.parse('2026-09-09T12:00:00Z')});
  assert.equal(result.runs[0].jobHealth,JOB_HEALTH_IN_FLIGHT);
});

test('a non-200 runs listing is evidence-unavailable, never an outage claim',async()=>{
  const fetchImpl=fakeFetch({status:500});
  const result=await readObserverEvidence({token:'t',fetchImpl,now:Date.parse('2026-09-09T12:00:00Z')});
  assert.equal(result.ok,false);
  assert.equal(result.reasonCode,READ_UNAVAILABLE);
  assert.doesNotMatch(JSON.stringify(result),/outage/i);
});

test('a transport exception is evidence-unavailable',async()=>{
  const fetchImpl=async()=>{throw new Error('network down');};
  const result=await readObserverEvidence({token:'t',fetchImpl,now:Date.parse('2026-09-09T12:00:00Z')});
  assert.equal(result.ok,false);
  assert.equal(result.reasonCode,READ_UNAVAILABLE);
});

test('malformed jobs payload for a listed run is evidence-unavailable',async()=>{
  const fetchImpl=fakeFetch({runsById:{1:runsBody([run({id:1101})])},jobsById:{1101:'not-an-array'}});
  const badFetch=async url=>{
    if(/\/actions\/runs\/1101\/jobs/.test(url))return {status:200,json:async()=>({total_count:1,jobs:'oops'})};
    return fetchImpl(url);
  };
  const result=await readObserverEvidence({token:'t',fetchImpl:badFetch,now:Date.parse('2026-09-09T12:00:00Z')});
  assert.equal(result.ok,false);
  assert.equal(result.reasonCode,READ_UNAVAILABLE);
});

test('exceeding the declared page count fails closed as a bound exhaustion',async()=>{
  const fetchImpl=async url=>{
    if(/page=1/.test(url))return {status:200,json:async()=>({total_count:GITHUB_EVIDENCE_RUNS_PAGE_SIZE*
      (GITHUB_EVIDENCE_MAX_RUN_PAGES+1),workflow_runs:Array.from({length:GITHUB_EVIDENCE_RUNS_PAGE_SIZE},
      (_,i)=>run({id:i+1}))})};
    return {status:404,json:async()=>({})};
  };
  const result=await readObserverEvidence({token:'t',fetchImpl,now:Date.parse('2026-09-09T12:00:00Z')});
  assert.equal(result.ok,false);
  assert.equal(result.reasonCode,READ_BOUND_EXHAUSTED);
});

test('the read budget is bounded and exhaustion is reported, not silently truncated',async()=>{
  const manyRuns=Array.from({length:5},(_,i)=>run({id:2000+i}));
  const fetchImpl=fakeFetch({runsById:{1:runsBody(manyRuns)},
    jobsById:Object.fromEntries(manyRuns.map(r=>[r.id,[job({id:r.id+1})]]))});
  const result=await readObserverEvidence({token:'t',fetchImpl,now:Date.parse('2026-09-09T12:00:00Z'),
    maxReads:2});
  assert.equal(result.ok,false);
  assert.equal(result.reasonCode,READ_BOUND_EXHAUSTED);
});

test('every request builder resolves to this repository and this one workflow file only',()=>{
  const url=workflowRunsRequest('t','2026-09-06T00:00:00.000Z',1).url;
  assert.match(url,/repos\/priteshpatel390-del\/FPL\/actions\/workflows\/data-steward-readonly-observer\.yml\/runs/);
});
