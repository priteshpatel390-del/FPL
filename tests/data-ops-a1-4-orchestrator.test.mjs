import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveWatchdogEnvironment,WATCHDOG_D1_BINDING,WATCHDOG_EMAIL_BINDING,
  WATCHDOG_GITHUB_TOKEN,WATCHDOG_OBSERVER_CLOCK_D1_BINDING}
  from '../workers/data-steward-watchdog/lib/environment-contract.mjs';
import {WatchdogExecutionError,runWatchdogCycle} from '../workers/data-steward-watchdog/run-watchdog.mjs';
import {CLAIM_SCHEDULED_EVENT} from '../workers/data-steward-watchdog/persistence/statements.mjs';
import {createFakeWatchdogD1} from './helpers/fake-watchdog-d1.mjs';

class FakeEmailMessage{constructor(from,to,raw){this.from=from;this.to=to;this.raw=raw;}}
const SHA='a'.repeat(40);
const DAY=24*60*60*1000;
const OPP_0417=Date.UTC(2026,8,10,4,17,0);
const WATCH_0447=Date.UTC(2026,8,10,4,47,0);
const RUN_ID=34450020001;
const JOB_ID=102800200001;
const iso=value=>new Date(value).toISOString();

function receipt({opportunity=OPP_0417,state='DISPATCHED',runId=RUN_ID}={}){
  return {opportunity_at:iso(opportunity),cron:'17 4 * * *',dispatch_state:state,
    github_run_id:state==='DISPATCHED'?runId:null,
    reason_code:state==='DISPATCHED'?'observer_dispatch_accepted':`observer_dispatch_${state.toLowerCase()}`,
    claimed_at:iso(opportunity+1000),finalized_at:state==='CLAIMED'?null:iso(opportunity+2000)};
}

function createClockDb(rows=[]){
  const byOpportunity=new Map(rows.map(row=>[row.opportunity_at,row]));
  const state={reads:[],writes:0};
  return {state,prepare(sql){
    assert.match(sql,/^SELECT /);assert.doesNotMatch(sql,/INSERT|UPDATE|DELETE/i);
    return {bind(...args){state.reads.push({sql,args});return {
      async first(){return byOpportunity.get(args[0])??null;},
      async run(){state.writes+=1;throw new Error('clock write forbidden');}
    };}};
  }};
}

function logResponse(summary){
  const bytes=new TextEncoder().encode(`${JSON.stringify(summary)}\n`);
  return {status:200,headers:{get:name=>name.toLowerCase()==='content-length'?String(bytes.length):null},
    body:new ReadableStream({start(controller){controller.enqueue(bytes);controller.close();}})};
}

function observerSummary({healthy=true,day='2026-09-10'}={}){
  return {dayDate:day,verdict:healthy?'HEALTHY':'UNHEALTHY',
    evaluationReason:healthy?'HEALTHY_EXPECTED_STATE':'OBSERVER_RUNTIME_FAILED',
    heartbeat:healthy?'COMPLETE':'INCOMPLETE',escalationRequired:!healthy,sentinels:[]};
}

function exactFetch({runId=RUN_ID,opportunity=OPP_0417,health='success',unavailable=false,
  path='.github/workflows/data-steward-readonly-observer.yml@main'}={}){
  const calls=[];
  const fetchImpl=async(url,init)=>{
    calls.push({url,method:init.method});
    if(unavailable)throw new Error('network down');
    if(url.endsWith(`/actions/runs/${runId}`))return {status:200,json:async()=>({id:runId,
      name:'Data Steward Read-Only Observer',path,event:'workflow_dispatch',head_branch:'main',
      head_sha:SHA,status:'completed',conclusion:health,
      created_at:iso(opportunity+60000)})};
    if(url.includes(`/actions/runs/${runId}/jobs`))return {status:200,json:async()=>({total_count:1,jobs:[{
      id:JOB_ID,name:'observe-production-chain',status:'completed',conclusion:health,
      completed_at:iso(opportunity+120000),run_attempt:1}]})};
    if(url.endsWith(`/actions/jobs/${JOB_ID}/logs`))return logResponse(observerSummary({healthy:health==='success'}));
    return {status:404,json:async()=>({})};
  };
  return {calls,fetchImpl};
}

function makeEnv(db,clockDb,{sent=[],emailFailure=false}={}){
  return {
    [WATCHDOG_GITHUB_TOKEN]:'read-token',
    [WATCHDOG_D1_BINDING]:db,
    [WATCHDOG_OBSERVER_CLOCK_D1_BINDING]:clockDb,
    [WATCHDOG_EMAIL_BINDING]:{send:async message=>{if(emailFailure)throw new Error('rejected');sent.push(message);}}
  };
}

function cycle({db=createFakeWatchdogD1(),clockDb=createClockDb([receipt()]),sent=[],fetcher=exactFetch(),
  now=WATCH_0447,scheduledTime=WATCH_0447,emailFailure=false}={}){
  const env=makeEnv(db,clockDb,{sent,emailFailure});
  return {db,clockDb,sent,fetcher,env,run:()=>runWatchdogCycle({env,fetchImpl:fetcher.fetchImpl,
    now,scheduledTime,EmailMessageCtor:FakeEmailMessage})};
}

test('environment contract resolves exactly token, lifecycle D1, clock D1 and email; missing values fail closed',()=>{
  const db=createFakeWatchdogD1();const clockDb=createClockDb();
  const complete=resolveWatchdogEnvironment(makeEnv(db,clockDb));
  assert.equal(complete.ok,true);assert.equal(complete.db,db);assert.equal(complete.clockDb,clockDb);
  assert.deepEqual(resolveWatchdogEnvironment({}).missing,
    [WATCHDOG_GITHUB_TOKEN,WATCHDOG_D1_BINDING,WATCHDOG_OBSERVER_CLOCK_D1_BINDING,WATCHDOG_EMAIL_BINDING]);
});

test('incomplete environment throws rather than resolving a false healthy cycle',async()=>{
  await assert.rejects(runWatchdogCycle({env:{}}),error=>{
    assert.ok(error instanceof WatchdogExecutionError);
    assert.equal(error.code,'WATCHDOG_ENVIRONMENT_INCOMPLETE');return true;
  });
});

test('first legitimate 04:47 watchdog firing evaluates its paired 04:17 opportunity',async()=>{
  const c=cycle({clockDb:createClockDb([]),fetcher:{calls:[],fetchImpl:async()=>{throw new Error('must not read');}}});
  const result=await c.run();
  assert.equal(result.heartbeat.opportunityAt,OPP_0417);
  assert.equal(result.heartbeat.state,'MISSING');
  assert.equal(result.incidents.observerHeartbeat.transition,'NEW');
  assert.equal(c.clockDb.state.reads.length,1);
});

test('receipt-proven successful automatic observer is HEALTHY',async()=>{
  const c=cycle();const result=await c.run();
  assert.equal(result.githubEvidenceOk,true);
  assert.equal(result.heartbeat.state,'HEALTHY');
  assert.equal(result.incidents.observerHeartbeat.transition,'NONE');
  assert.equal(c.sent.length,0);
  assert.deepEqual(c.fetcher.calls.map(call=>call.method),['GET','GET','GET']);
  assert.equal(c.db._tables.attributions.size,1);
  assert.equal(c.db._tables.observations.size,1);
});

test('ordinary manual GitHub runs cannot satisfy heartbeat without a Cloudflare receipt',async()=>{
  const fetcher=exactFetch();const c=cycle({clockDb:createClockDb([]),fetcher});
  const result=await c.run();
  assert.equal(result.heartbeat.state,'MISSING');
  assert.equal(fetcher.calls.length,0,'watchdog never searches GitHub for a convenient manual run');
});

test('CLAIMED, FAILED and AMBIGUOUS dispatcher receipts are never trusted as executions',async()=>{
  for(const state of ['CLAIMED','FAILED','AMBIGUOUS']){
    const fetcher=exactFetch();const c=cycle({clockDb:createClockDb([receipt({state})]),fetcher});
    const result=await c.run();
    assert.equal(result.heartbeat.state,'MISSING',state);
    assert.equal(fetcher.calls.length,0,state);
  }
});

test('exact receipt-proven observer job failure opens an incident immediately at watchdog evaluation',async()=>{
  const sent=[];const fetcher=exactFetch({health:'failure'});const c=cycle({sent,fetcher});
  const result=await c.run();
  assert.equal(result.heartbeat.state,'FAILED');
  assert.equal(result.heartbeat.reasonCode,'OBSERVER_JOB_FAILED');
  assert.equal(result.incidents.observerHeartbeat.transition,'NEW');
  assert.equal(sent.length,1);
});

test('GitHub exact-run evidence failure is independent and never turns heartbeat healthy',async()=>{
  const sent=[];const fetcher=exactFetch({unavailable:true});const c=cycle({sent,fetcher});
  const result=await c.run();
  assert.equal(result.githubEvidenceOk,false);
  assert.equal(result.heartbeat.state,'MISSING');
  assert.equal(result.incidents.githubEvidence.transition,'NEW');
  assert.equal(result.incidents.observerHeartbeat.transition,'NEW');
});

test('wrong workflow identity on the receipt-proven run fails closed as unavailable evidence',async()=>{
  const fetcher=exactFetch({path:'.github/workflows/other.yml@main'});const c=cycle({fetcher});
  const result=await c.run();
  assert.equal(result.githubEvidenceOk,false);
  assert.equal(result.heartbeat.state,'MISSING');
  assert.equal(fetcher.calls.length,1);
});

test('trusted automatic observation persists logical schedule provenance while raw GitHub event stays workflow_dispatch',async()=>{
  const c=cycle();await c.run();
  const [row]=[...c.db._tables.observations.values()];
  assert.equal(row.event_type,'schedule');
  assert.equal(row.source_kind,'scheduled_run');
  assert.equal(row.workflow_run_id,RUN_ID);
  assert.equal(row.opportunity_at,iso(OPP_0417));
  assert.equal(row.head_sha,SHA);
});

test('missing day opens once; next-day receipt-proven success recovers with real run provenance',async()=>{
  const db=createFakeWatchdogD1();const sent=[];
  const missingClock=createClockDb([]);
  const first=await runWatchdogCycle({env:makeEnv(db,missingClock,{sent}),fetchImpl:async()=>{throw new Error('unused');},
    now:WATCH_0447,scheduledTime:WATCH_0447,EmailMessageCtor:FakeEmailMessage});
  assert.equal(first.incidents.observerHeartbeat.transition,'NEW');
  assert.equal(sent.length,1);assert.match(sent[0].raw,/none recorded/);

  const nextOpp=OPP_0417+DAY;const nextWatch=WATCH_0447+DAY;const nextRun=RUN_ID+1;
  const fetcher=exactFetch({runId:nextRun,opportunity:nextOpp});
  // exactFetch uses a fixed job id, which is valid across this synthetic independent run.
  const recovered=await runWatchdogCycle({env:makeEnv(db,createClockDb([receipt({opportunity:nextOpp,runId:nextRun})]),{sent}),
    fetchImpl:fetcher.fetchImpl,now:nextWatch,scheduledTime:nextWatch,EmailMessageCtor:FakeEmailMessage});
  assert.equal(recovered.heartbeat.state,'HEALTHY');
  assert.equal(recovered.incidents.observerHeartbeat.transition,'RECOVERED');
  assert.equal(sent.length,2);
  assert.match(sent[1].raw,new RegExp(String(nextRun)));
  assert.match(sent[1].raw,new RegExp(SHA));
});

test('same logical 04:47 event is single-writer: retry becomes duplicate and sends no second email',async()=>{
  const db=createFakeWatchdogD1();const sent=[];const env=makeEnv(db,createClockDb([]),{sent});
  const first=await runWatchdogCycle({env,fetchImpl:async()=>{throw new Error('unused');},now:WATCH_0447,
    scheduledTime:WATCH_0447,EmailMessageCtor:FakeEmailMessage});
  const retry=await runWatchdogCycle({env,fetchImpl:async()=>{throw new Error('unused');},now:WATCH_0447,
    scheduledTime:WATCH_0447,EmailMessageCtor:FakeEmailMessage});
  assert.equal(first.duplicate,false);assert.equal(retry.duplicate,true);
  assert.equal(retry.reasonCode,'WATCHDOG_DUPLICATE_SCHEDULED_EVENT');
  assert.equal(sent.length,1);
});

test('concurrent copies of the same 04:47 event produce exactly one winner',async()=>{
  const db=createFakeWatchdogD1();const sent=[];const env=makeEnv(db,createClockDb([]),{sent});
  const args={env,fetchImpl:async()=>{throw new Error('unused');},now:WATCH_0447,
    scheduledTime:WATCH_0447,EmailMessageCtor:FakeEmailMessage};
  const [a,b]=await Promise.all([runWatchdogCycle(args),runWatchdogCycle(args)]);
  assert.equal([a,b].filter(row=>row.duplicate===false).length,1);
  assert.equal([a,b].filter(row=>row.duplicate===true).length,1);
  assert.equal(sent.length,1);
});

test('different daily 04:47 events remain independent',async()=>{
  const db=createFakeWatchdogD1();const sent=[];
  const first=await runWatchdogCycle({env:makeEnv(db,createClockDb([]),{sent}),
    fetchImpl:async()=>{throw new Error('unused');},now:WATCH_0447,scheduledTime:WATCH_0447,
    EmailMessageCtor:FakeEmailMessage});
  const secondWatch=WATCH_0447+DAY;
  const second=await runWatchdogCycle({env:makeEnv(db,createClockDb([]),{sent}),
    fetchImpl:async()=>{throw new Error('unused');},now:secondWatch,scheduledTime:secondWatch,
    EmailMessageCtor:FakeEmailMessage});
  assert.equal(first.duplicate,false);assert.equal(second.duplicate,false);
});

test('fatal lifecycle D1 failure propagates and cannot look successful',async()=>{
  const failingDb={prepare(){return {bind(){return {run(){throw new Error('d1 down');},
    first(){throw new Error('d1 down');}};}};}};
  await assert.rejects(runWatchdogCycle({env:makeEnv(failingDb,createClockDb([])),
    fetchImpl:async()=>{throw new Error('unused');},now:WATCH_0447,scheduledTime:WATCH_0447,
    EmailMessageCtor:FakeEmailMessage}));
});

test('clock D1 read failure propagates fail-closed after the watchdog claim',async()=>{
  const db=createFakeWatchdogD1();const brokenClock={prepare(){throw new Error('clock down');}};
  await assert.rejects(runWatchdogCycle({env:makeEnv(db,brokenClock),fetchImpl:async()=>{throw new Error('unused');},
    now:WATCH_0447,scheduledTime:WATCH_0447,EmailMessageCtor:FakeEmailMessage}),
    error=>error.code==='WATCHDOG_CLOCK_DB_UNAVAILABLE');
  assert.ok(db._tables.claims.has(iso(WATCH_0447)));
});

test('a crash after claim makes exact retry duplicate but next daily watchdog can proceed',async()=>{
  const baseDb=createFakeWatchdogD1();const sent=[];
  const crashingDb={prepare(sql){
    if(sql===CLAIM_SCHEDULED_EVENT)return baseDb.prepare(sql);
    return {bind(){return {async run(){throw new Error('crash');},async first(){throw new Error('crash');}};}};
  },_tables:baseDb._tables};
  await assert.rejects(runWatchdogCycle({env:makeEnv(crashingDb,createClockDb([]),{sent}),
    fetchImpl:async()=>{throw new Error('unused');},now:WATCH_0447,scheduledTime:WATCH_0447,
    EmailMessageCtor:FakeEmailMessage}));
  const retry=await runWatchdogCycle({env:makeEnv(baseDb,createClockDb([]),{sent}),
    fetchImpl:async()=>{throw new Error('unused');},now:WATCH_0447,scheduledTime:WATCH_0447,
    EmailMessageCtor:FakeEmailMessage});
  assert.equal(retry.duplicate,true);
  const next=WATCH_0447+DAY;
  const later=await runWatchdogCycle({env:makeEnv(baseDb,createClockDb([]),{sent}),
    fetchImpl:async()=>{throw new Error('unused');},now:next,scheduledTime:next,
    EmailMessageCtor:FakeEmailMessage});
  assert.equal(later.duplicate,false);
});

test('failed email delivery reuses its reservation on the next daily watchdog and creates no lifecycle occurrence',async()=>{
  const db=createFakeWatchdogD1();const failedSent=[];
  const first=await runWatchdogCycle({env:makeEnv(db,createClockDb([]),{sent:failedSent,emailFailure:true}),
    fetchImpl:async()=>{throw new Error('unused');},now:WATCH_0447,scheduledTime:WATCH_0447,
    EmailMessageCtor:FakeEmailMessage});
  assert.equal(first.incidents.observerHeartbeat.notified,false);
  assert.equal(db._tables.notifications.size,1);

  const sent=[];const next=WATCH_0447+DAY;
  const second=await runWatchdogCycle({env:makeEnv(db,createClockDb([]),{sent}),
    fetchImpl:async()=>{throw new Error('unused');},now:next,scheduledTime:next,
    EmailMessageCtor:FakeEmailMessage});
  assert.equal(second.incidents.observerHeartbeat.transition,'NONE');
  assert.equal(second.incidents.observerHeartbeat.notified,true);
  assert.equal(sent.length,1);
  assert.equal(db._tables.notifications.size,1);
  assert.equal([...db._tables.incidents.values()].find(row=>row.problem_class==='OBSERVER_HEARTBEAT').occurrence_count,1);
});

test('replaying the same failed exact GitHub evidence on a later logical day is lifecycle-safe',async()=>{
  const db=createFakeWatchdogD1();const sent=[];
  const firstFetcher=exactFetch({health:'failure'});
  const first=await runWatchdogCycle({env:makeEnv(db,createClockDb([receipt()]),{sent}),
    fetchImpl:firstFetcher.fetchImpl,now:WATCH_0447,scheduledTime:WATCH_0447,EmailMessageCtor:FakeEmailMessage});
  assert.equal(first.incidents.observerHeartbeat.transition,'NEW');
  // A second read of the same run cannot own a second opportunity because the receipt ledger and
  // attribution table bind it to its original 04:17 opportunity. That is a fail-closed conflict.
  const next=WATCH_0447+DAY;
  await assert.rejects(runWatchdogCycle({env:makeEnv(db,createClockDb([receipt({opportunity:OPP_0417+DAY})]),{sent}),
    fetchImpl:firstFetcher.fetchImpl,now:next,scheduledTime:next,EmailMessageCtor:FakeEmailMessage}),
    error=>error.code==='WATCHDOG_TRUSTED_ATTRIBUTION_CONFLICT');
});
