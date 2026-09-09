import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveWatchdogEnvironment,WATCHDOG_D1_BINDING,WATCHDOG_EMAIL_BINDING,
  WATCHDOG_GITHUB_TOKEN} from '../workers/data-steward-watchdog/lib/environment-contract.mjs';
import {OBSERVER_GRACE_MS} from '../workers/data-steward-watchdog/lib/opportunity-schedule.mjs';
import {WatchdogExecutionError,runWatchdogCycle} from '../workers/data-steward-watchdog/run-watchdog.mjs';
import {CLAIM_SCHEDULED_EVENT} from '../workers/data-steward-watchdog/persistence/statements.mjs';
import {createFakeWatchdogD1} from './helpers/fake-watchdog-d1.mjs';

class FakeEmailMessage{constructor(from,to,raw){this.from=from;this.to=to;this.raw=raw;}}

function runsBody(runs){return {total_count:runs.length,workflow_runs:runs};}
function jobsBody(jobs){return {total_count:jobs.length,jobs};}
const SHA='a'.repeat(40);

// One successful scheduled run, created `minutesAgo` minutes before `opportunityAt` + `offsetMin`
// minutes, i.e. at `opportunityAt + offsetMin` minutes exactly.
function healthyFetch(opportunityAtMs,offsetMinutes=1,runId=1){
  const createdAt=new Date(opportunityAtMs+offsetMinutes*60000).toISOString();
  return async url=>{
    if(new RegExp(`/actions/runs/${runId}/jobs`).test(url))
      return {status:200,json:async()=>jobsBody([{id:runId*10+1,name:'observe-production-chain',
        status:'completed',conclusion:'success',completed_at:createdAt,run_attempt:1}])};
    if(new RegExp(`/actions/jobs/${runId*10+1}/logs`).test(url)){
      const text=JSON.stringify({dayDate:'2026-09-09',verdict:'HEALTHY',
        evaluationReason:'HEALTHY_EXPECTED_STATE',heartbeat:'COMPLETE',escalationRequired:false,
        sentinels:[]})+'\n';
      const bytes=new TextEncoder().encode(text);
      return {status:200,headers:{get:name=>name==='content-length'?String(bytes.byteLength):null},
        body:new ReadableStream({start(controller){controller.enqueue(bytes);controller.close();}})};
    }
    if(/\/workflows\/.*\/runs\?/.test(url))return {status:200,json:async()=>runsBody([{id:runId,
      created_at:createdAt,event:'schedule',head_sha:SHA,status:'completed',conclusion:'success'}])};
    return {status:404,json:async()=>({})};
  };
}
function emptyFetch(){
  return async url=>{
    if(/\/workflows\/.*\/runs\?/.test(url))return {status:200,json:async()=>runsBody([])};
    return {status:404,json:async()=>({})};
  };
}
function unavailableFetch(){return async()=>{throw new Error('network down');};}

function makeEnv(db,{sent}){
  return {
    [WATCHDOG_GITHUB_TOKEN]:'t',
    [WATCHDOG_D1_BINDING]:db,
    [WATCHDOG_EMAIL_BINDING]:{send:async message=>{sent.push(message);}}
  };
}

// 2026-09-09 opportunities, in ms since epoch.
const OPP_0417=Date.UTC(2026,8,9,4,17);
const OPP_0817=Date.UTC(2026,8,9,8,17);

test('environment contract resolves exactly the three named bindings and fails closed otherwise',()=>{
  const db=createFakeWatchdogD1();
  const complete=resolveWatchdogEnvironment(makeEnv(db,{sent:[]}));
  assert.equal(complete.ok,true);
  assert.equal(resolveWatchdogEnvironment({}).ok,false);
  assert.deepEqual(resolveWatchdogEnvironment({}).missing,
    [WATCHDOG_GITHUB_TOKEN,WATCHDOG_D1_BINDING,WATCHDOG_EMAIL_BINDING]);
});

test('an incomplete environment is a genuine runtime failure — it throws, it does not resolve quietly',async()=>{
  await assert.rejects(runWatchdogCycle({env:{}}),error=>{
    assert.ok(error instanceof WatchdogExecutionError);
    assert.equal(error.code,'WATCHDOG_ENVIRONMENT_INCOMPLETE');
    return true;
  });
});

test('bootstrap: a freshly deployed watchdog does not retroactively judge an opportunity that predates it',async()=>{
  const db=createFakeWatchdogD1();
  const sent=[];
  // First ever cycle fires well after today's 08:17 opportunity would naturally be "missing".
  const now=OPP_0817+6*60*60*1000;
  const result=await runWatchdogCycle({env:makeEnv(db,{sent}),fetchImpl:emptyFetch(),now,
    EmailMessageCtor:FakeEmailMessage});
  assert.equal(result.heartbeat.state,'PENDING');
  assert.equal(result.incidents.observerHeartbeat.transition,'NONE');
  assert.equal(sent.length,0);
});

test('a healthy scheduled observation stays HEALTHY across the whole ~20h overnight gap',async()=>{
  const db=createFakeWatchdogD1();
  const sent=[];
  const env=makeEnv(db,{sent});
  // Bootstrap before 04:17 so today's opportunities are in scope.
  await runWatchdogCycle({env,fetchImpl:emptyFetch(),now:OPP_0417-60*60*1000,EmailMessageCtor:FakeEmailMessage});
  await runWatchdogCycle({env,fetchImpl:healthyFetch(OPP_0417,2),now:OPP_0417+5*60*1000,
    EmailMessageCtor:FakeEmailMessage});
  await runWatchdogCycle({env,fetchImpl:healthyFetch(OPP_0817,2,2),now:OPP_0817+5*60*1000,
    EmailMessageCtor:FakeEmailMessage});
  const result=await runWatchdogCycle({env,fetchImpl:emptyFetch(),now:OPP_0817+15*60*60*1000,
    EmailMessageCtor:FakeEmailMessage});
  assert.equal(result.heartbeat.state,'HEALTHY');
  assert.equal(result.incidents.observerHeartbeat.transition,'NONE');
});

// These "missing past grace" scenarios are deliberately evaluated against the 08:17 opportunity,
// never 04:17: grace (5h) exceeds the 4-hour gap to the NEXT same-day opportunity, so by the time
// 04:17's own grace would expire (09:17), 08:17 has already become the latest due opportunity.
// 08:17's own next opportunity is the following day's 04:17, roughly 20 hours later — comfortably
// longer than grace — so evaluating there is unambiguous.
test('a missing opportunity past grace opens NEW and sends exactly one email',async()=>{
  const db=createFakeWatchdogD1();
  const sent=[];
  const env=makeEnv(db,{sent});
  await runWatchdogCycle({env,fetchImpl:emptyFetch(),now:OPP_0817-60*60*1000,EmailMessageCtor:FakeEmailMessage});
  const result=await runWatchdogCycle({env,fetchImpl:emptyFetch(),
    now:OPP_0817+OBSERVER_GRACE_MS+1,EmailMessageCtor:FakeEmailMessage});
  assert.equal(result.heartbeat.state,'MISSING');
  assert.equal(result.incidents.observerHeartbeat.transition,'NEW');
  assert.equal(sent.length,1);
  assert.match(sent[0].raw,/NEW/);
});

test('a real observer job failure opens an incident immediately, without waiting for grace',async()=>{
  const db=createFakeWatchdogD1();
  const sent=[];
  const env=makeEnv(db,{sent});
  await runWatchdogCycle({env,fetchImpl:emptyFetch(),now:OPP_0417-60*60*1000,EmailMessageCtor:FakeEmailMessage});
  const failedFetch=async url=>{
    if(/\/actions\/runs\/1\/jobs/.test(url))
      return {status:200,json:async()=>jobsBody([{id:11,name:'observe-production-chain',
        status:'completed',conclusion:'failure',
        completed_at:new Date(OPP_0417+120000).toISOString(),run_attempt:1}])};
    if(/\/actions\/jobs\/11\/logs/.test(url))
      return {status:200,headers:{get:()=>null},
        body:new ReadableStream({start(controller){
          controller.enqueue(new TextEncoder().encode(JSON.stringify({dayDate:'2026-09-09',
            verdict:'UNHEALTHY',evaluationReason:'OBSERVER_RUNTIME_FAILED',heartbeat:'INCOMPLETE',
            escalationRequired:true,sentinels:[]})+'\n'));controller.close();}})};
    if(/\/workflows\/.*\/runs\?/.test(url))return {status:200,json:async()=>runsBody([{id:1,
      created_at:new Date(OPP_0417+60000).toISOString(),event:'schedule',head_sha:SHA,
      status:'completed',conclusion:'failure'}])};
    return {status:404,json:async()=>({})};
  };
  const result=await runWatchdogCycle({env,fetchImpl:failedFetch,now:OPP_0417+130000,
    EmailMessageCtor:FakeEmailMessage});
  assert.equal(result.heartbeat.state,'FAILED');
  assert.equal(result.incidents.observerHeartbeat.transition,'NEW');
  assert.equal(sent.length,1);
});

test('a notification carries real evidence provenance, not a placeholder timestamp',async()=>{
  const db=createFakeWatchdogD1();
  const sent=[];
  const env=makeEnv(db,{sent});
  await runWatchdogCycle({env,fetchImpl:emptyFetch(),now:OPP_0817-60*60*1000,EmailMessageCtor:FakeEmailMessage});
  await runWatchdogCycle({env,fetchImpl:emptyFetch(),now:OPP_0817+OBSERVER_GRACE_MS+1,
    EmailMessageCtor:FakeEmailMessage});
  assert.equal(sent.length,1);
  // A MISSING incident legitimately has no evidence yet — there is nothing to show. The real
  // provenance check is on the RECOVERED email below, which must show genuine evidence rather
  // than reusing the MISSING email's placeholder.
  assert.match(sent[0].raw,/none recorded/);
  // Now recover with a genuine observed run the NEXT day, and check the RECOVERED email shows
  // its real run id.
  const nextDay0417=OPP_0417+24*60*60*1000;
  const recovered=await runWatchdogCycle({env,fetchImpl:healthyFetch(nextDay0417,3,2),now:nextDay0417+5*60*1000,
    EmailMessageCtor:FakeEmailMessage});
  assert.equal(recovered.incidents.observerHeartbeat.transition,'RECOVERED');
  assert.equal(sent.length,2);
  assert.match(sent[1].raw,/Related GitHub Actions run id: 2/);
  assert.match(sent[1].raw,new RegExp(SHA));
});

test('re-running the exact same scheduled event (retry) never duplicates the incident or the email',async()=>{
  const db=createFakeWatchdogD1();
  const sent=[];
  const env=makeEnv(db,{sent});
  await runWatchdogCycle({env,fetchImpl:emptyFetch(),now:OPP_0817-60*60*1000,EmailMessageCtor:FakeEmailMessage});
  const now=OPP_0817+OBSERVER_GRACE_MS+1;
  await runWatchdogCycle({env,fetchImpl:emptyFetch(),now,scheduledTime:now,EmailMessageCtor:FakeEmailMessage});
  const retry=await runWatchdogCycle({env,fetchImpl:emptyFetch(),now,scheduledTime:now,
    EmailMessageCtor:FakeEmailMessage});
  assert.equal(retry.duplicate,true);
  assert.equal(retry.reasonCode,'WATCHDOG_DUPLICATE_SCHEDULED_EVENT');
  assert.equal(sent.length,1,'a retry of the exact same logical scheduled event must not send a second email');
});

test('CONCURRENCY: two genuinely overlapping executions of the same scheduled event — only one wins the claim',async()=>{
  const db=createFakeWatchdogD1();
  const sent=[];
  const env=makeEnv(db,{sent});
  await runWatchdogCycle({env,fetchImpl:emptyFetch(),now:OPP_0817-60*60*1000,EmailMessageCtor:FakeEmailMessage});
  const now=OPP_0817+OBSERVER_GRACE_MS+1;
  const [a,b]=await Promise.all([
    runWatchdogCycle({env,fetchImpl:emptyFetch(),now,scheduledTime:now,EmailMessageCtor:FakeEmailMessage}),
    runWatchdogCycle({env,fetchImpl:emptyFetch(),now,scheduledTime:now,EmailMessageCtor:FakeEmailMessage})
  ]);
  const duplicates=[a,b].filter(result=>result.duplicate===true);
  const winners=[a,b].filter(result=>result.duplicate===false);
  assert.equal(duplicates.length,1,'exactly one of the two concurrent executions must lose the claim');
  assert.equal(winners.length,1,'exactly one execution must actually run the cycle');
  assert.equal(db._tables.incidents.size,1,'only one lifecycle mutation happened');
  assert.equal(sent.length,1,'only one notification was ever sent for this one logical event');
});

test('CONCURRENCY: a duplicate delivery of the same event cannot duplicate the incident even under many overlapping calls',async()=>{
  const db=createFakeWatchdogD1();
  const sent=[];
  const env=makeEnv(db,{sent});
  await runWatchdogCycle({env,fetchImpl:emptyFetch(),now:OPP_0817-60*60*1000,EmailMessageCtor:FakeEmailMessage});
  const now=OPP_0817+OBSERVER_GRACE_MS+1;
  const results=await Promise.all(Array.from({length:5},()=>
    runWatchdogCycle({env,fetchImpl:emptyFetch(),now,scheduledTime:now,EmailMessageCtor:FakeEmailMessage})));
  assert.equal(results.filter(result=>result.duplicate===false).length,1);
  assert.equal(sent.length,1);
});

test('CONCURRENCY: different scheduled events execute fully independently',async()=>{
  const db=createFakeWatchdogD1();
  const sent=[];
  const env=makeEnv(db,{sent});
  await runWatchdogCycle({env,fetchImpl:emptyFetch(),now:OPP_0817-60*60*1000,EmailMessageCtor:FakeEmailMessage});
  const t1=OPP_0817+OBSERVER_GRACE_MS+1;
  const t2=t1+60000;
  const [a,b]=await Promise.all([
    runWatchdogCycle({env,fetchImpl:emptyFetch(),now:t1,scheduledTime:t1,EmailMessageCtor:FakeEmailMessage}),
    runWatchdogCycle({env,fetchImpl:emptyFetch(),now:t2,scheduledTime:t2,EmailMessageCtor:FakeEmailMessage})
  ]);
  assert.equal(a.duplicate,false);
  assert.equal(b.duplicate,false);
});

test('GitHub evidence unavailable raises its own independent incident, never a heartbeat lie',async()=>{
  const db=createFakeWatchdogD1();
  const sent=[];
  const env=makeEnv(db,{sent});
  const now=OPP_0417+30*60*1000;
  const result=await runWatchdogCycle({env,fetchImpl:unavailableFetch(),now,EmailMessageCtor:FakeEmailMessage});
  assert.equal(result.githubEvidenceOk,false);
  assert.equal(result.incidents.githubEvidence.transition,'NEW');
  assert.doesNotMatch(JSON.stringify(result),/outage/i);
});

test('heartbeat detection survives a GitHub-unavailable cycle using durable D1 history',async()=>{
  const db=createFakeWatchdogD1();
  const sent=[];
  const env=makeEnv(db,{sent});
  await runWatchdogCycle({env,fetchImpl:emptyFetch(),now:OPP_0417-60*60*1000,EmailMessageCtor:FakeEmailMessage});
  await runWatchdogCycle({env,fetchImpl:healthyFetch(OPP_0417,2),now:OPP_0417+5*60*1000,
    EmailMessageCtor:FakeEmailMessage});
  const result=await runWatchdogCycle({env,fetchImpl:unavailableFetch(),now:OPP_0417+60*60*1000,
    EmailMessageCtor:FakeEmailMessage});
  assert.equal(result.heartbeat.state,'HEALTHY','the earlier success recorded in D1 is still honoured');
});

test('a fatal D1 failure propagates and fails the whole cycle, never looking successful',async()=>{
  const failingDb={prepare(){return {bind(){return {
    run(){throw new Error('d1 down');},first(){throw new Error('d1 down');}
  };}};}};
  const env=makeEnv(failingDb,{sent:[]});
  await assert.rejects(runWatchdogCycle({env,fetchImpl:emptyFetch(),now:OPP_0417,
    EmailMessageCtor:FakeEmailMessage}));
});

test('a failure after the claim but before later phases still records the claim and never corrupts a later cycle',async()=>{
  const baseDb=createFakeWatchdogD1();
  const sent=[];
  await runWatchdogCycle({env:makeEnv(baseDb,{sent}),fetchImpl:emptyFetch(),now:OPP_0817-60*60*1000,
    EmailMessageCtor:FakeEmailMessage});
  // A db that lets the claim itself succeed (delegating to the real fake) but throws on every
  // other statement — simulating a crash the instant after the single-writer claim commits.
  const crashingDb={
    prepare(sql){
      if(sql===CLAIM_SCHEDULED_EVENT)return baseDb.prepare(sql);
      return {bind(){return {
        async run(){throw new Error('simulated crash after claim');},
        async first(){throw new Error('simulated crash after claim');}
      };}};
    },
    _tables:baseDb._tables
  };
  const t1=OPP_0817+OBSERVER_GRACE_MS+1;
  await assert.rejects(runWatchdogCycle({env:makeEnv(crashingDb,{sent}),fetchImpl:emptyFetch(),
    now:t1,scheduledTime:t1,EmailMessageCtor:FakeEmailMessage}));
  // The claim was still durably recorded before the crash.
  assert.ok(baseDb._tables.claims.has(new Date(t1).toISOString()));
  // A retry of the exact same scheduled event against the healthy db is correctly a duplicate —
  // the crashed cycle's own work is not silently repeated.
  const retry=await runWatchdogCycle({env:makeEnv(baseDb,{sent}),fetchImpl:emptyFetch(),now:t1,
    scheduledTime:t1,EmailMessageCtor:FakeEmailMessage});
  assert.equal(retry.duplicate,true);
  // A later, independently-scheduled cycle is completely unaffected — the system self-heals at
  // the next natural firing, which is the honestly-stated limitation of this mechanism.
  const t2=t1+6*60*60*1000;
  const later=await runWatchdogCycle({env:makeEnv(baseDb,{sent}),fetchImpl:emptyFetch(),now:t2,
    scheduledTime:t2,EmailMessageCtor:FakeEmailMessage});
  assert.equal(later.duplicate,false);
});

test('a delivery failure still reserves the notification and self-heals on the next cycle',async()=>{
  const db=createFakeWatchdogD1();
  const env={...makeEnv(db,{sent:[]}),
    [WATCHDOG_EMAIL_BINDING]:{send:async()=>{throw new Error('rejected');}}};
  await runWatchdogCycle({env,fetchImpl:emptyFetch(),now:OPP_0817-60*60*1000,EmailMessageCtor:FakeEmailMessage});
  const t0=OPP_0817+OBSERVER_GRACE_MS+1;
  const first=await runWatchdogCycle({env,fetchImpl:emptyFetch(),now:t0,scheduledTime:t0,
    EmailMessageCtor:FakeEmailMessage});
  assert.equal(first.incidents.observerHeartbeat.notified,false);
  const sentAfterFix=[];
  const healedEnv={...env,[WATCHDOG_EMAIL_BINDING]:{send:async message=>{sentAfterFix.push(message);}}};
  const t1=t0+6*60*60*1000;
  const second=await runWatchdogCycle({env:healedEnv,fetchImpl:emptyFetch(),now:t1,scheduledTime:t1,
    EmailMessageCtor:FakeEmailMessage});
  assert.equal(second.incidents.observerHeartbeat.transition,'NONE');
  assert.equal(second.incidents.observerHeartbeat.notified,true);
  assert.equal(sentAfterFix.length,1);
  assert.equal(db._tables.notifications.size,1,'retry updates original notification record');
  assert.equal([...db._tables.incidents.values()][0].occurrence_count,1,
    'retry creates no lifecycle occurrence');
});

test('same failed GitHub evidence on a later watchdog cycle is replay-safe',async()=>{
  const db=createFakeWatchdogD1();const sent=[];const env=makeEnv(db,{sent});
  await runWatchdogCycle({env,fetchImpl:emptyFetch(),now:OPP_0417-3600000,EmailMessageCtor:FakeEmailMessage});
  const failure=async url=>{
    if(/runs\/7\/jobs/.test(url))return {status:200,json:async()=>jobsBody([{id:71,
      name:'observe-production-chain',status:'completed',conclusion:'failure',run_attempt:1,
      completed_at:new Date(OPP_0417+120000).toISOString()}])};
    if(/jobs\/71\/logs/.test(url)){const bytes=new TextEncoder().encode(JSON.stringify({dayDate:'2026-09-09',
      verdict:'UNHEALTHY',evaluationReason:'OBSERVER_RUNTIME_FAILED',heartbeat:'INCOMPLETE',
      escalationRequired:true,sentinels:[]})+'\n');return {status:200,headers:{get:()=>null},
      body:new ReadableStream({start(c){c.enqueue(bytes);c.close();}})};}
    if(/workflows\/.*\/runs\?/.test(url))return {status:200,json:async()=>runsBody([{id:7,
      created_at:new Date(OPP_0417+60000).toISOString(),event:'schedule',head_sha:SHA,
      status:'completed',conclusion:'failure'}])};return {status:404,json:async()=>({})};};
  const first=await runWatchdogCycle({env,fetchImpl:failure,now:OPP_0417+180000,
    EmailMessageCtor:FakeEmailMessage});
  const replay=await runWatchdogCycle({env,fetchImpl:failure,now:OPP_0417+3600000,
    EmailMessageCtor:FakeEmailMessage});
  assert.equal(first.incidents.observerHeartbeat.transition,'NEW');
  assert.equal(replay.incidents.observerHeartbeat.transition,'NONE');
  assert.equal([...db._tables.incidents.values()].find(row=>row.problem_class==='OBSERVER_HEARTBEAT').occurrence_count,1);
});
