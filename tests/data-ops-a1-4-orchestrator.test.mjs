import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveWatchdogEnvironment,WATCHDOG_D1_BINDING,WATCHDOG_EMAIL_BINDING,
  WATCHDOG_GITHUB_TOKEN} from '../workers/data-steward-watchdog/lib/environment-contract.mjs';
import {runWatchdogCycle} from '../workers/data-steward-watchdog/run-watchdog.mjs';
import {createFakeWatchdogD1} from './helpers/fake-watchdog-d1.mjs';

class FakeEmailMessage{constructor(from,to,raw){this.from=from;this.to=to;this.raw=raw;}}

function runsBody(runs){return {total_count:runs.length,workflow_runs:runs};}
function jobsBody(jobs){return {total_count:jobs.length,jobs};}
const SHA='a'.repeat(40);
const run=({id,event='schedule',createdAt})=>({id,created_at:createdAt,event,head_sha:SHA,
  status:'completed',conclusion:id%2===0?'success':'failure'});

// One healthy scheduled run, `minutesAgo` minutes before `now`.
function healthyFetch(now,minutesAgo){
  const createdAt=new Date(now-minutesAgo*60000).toISOString();
  return async url=>{
    if(/\/actions\/runs\/1\/jobs/.test(url))
      return {status:200,json:async()=>jobsBody([{id:11,name:'observe-production-chain',
        status:'completed',conclusion:'success',completed_at:createdAt,run_attempt:1}])};
    if(/\/actions\/jobs\/11\/logs/.test(url)){
      const text=JSON.stringify({dayDate:'2026-09-09',verdict:'HEALTHY',
        evaluationReason:'HEALTHY_EXPECTED_STATE',heartbeat:'COMPLETE',escalationRequired:false,
        sentinels:[]})+'\n';
      const bytes=new TextEncoder().encode(text);
      return {status:200,headers:{get:name=>name==='content-length'?String(bytes.byteLength):null},
        body:new ReadableStream({start(controller){controller.enqueue(bytes);controller.close();}})};
    }
    if(/\/workflows\/.*\/runs\?/.test(url))return {status:200,json:async()=>runsBody([{id:1,
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

test('environment contract resolves exactly the three named bindings and fails closed otherwise',()=>{
  const db=createFakeWatchdogD1();
  const complete=resolveWatchdogEnvironment(makeEnv(db,{sent:[]}));
  assert.equal(complete.ok,true);
  assert.equal(resolveWatchdogEnvironment({}).ok,false);
  assert.deepEqual(resolveWatchdogEnvironment({}).missing,
    [WATCHDOG_GITHUB_TOKEN,WATCHDOG_D1_BINDING,WATCHDOG_EMAIL_BINDING]);
  assert.equal(resolveWatchdogEnvironment({[WATCHDOG_GITHUB_TOKEN]:'t'}).ok,false);
});

test('a cycle with an incomplete environment does nothing and reports why',async()=>{
  const result=await runWatchdogCycle({env:{}});
  assert.equal(result.ok,false);
  assert.equal(result.reasonCode,'WATCHDOG_ENVIRONMENT_INCOMPLETE');
});

test('a healthy scheduled observation inside 12 hours produces no incident and no email',async()=>{
  const db=createFakeWatchdogD1();
  const sent=[];
  const now=Date.parse('2026-09-09T12:00:00.000Z');
  const result=await runWatchdogCycle({env:makeEnv(db,{sent}),fetchImpl:healthyFetch(now,30),now,
    EmailMessageCtor:FakeEmailMessage});
  assert.equal(result.ok,true);
  assert.equal(result.heartbeat.state,'HEALTHY');
  assert.equal(result.incidents.observerHeartbeat.transition,'NONE');
  assert.equal(sent.length,0);
});

test('a first missing heartbeat opens NEW and sends exactly one email',async()=>{
  const db=createFakeWatchdogD1();
  const sent=[];
  const now=Date.parse('2026-09-09T12:00:00.000Z');
  const result=await runWatchdogCycle({env:makeEnv(db,{sent}),fetchImpl:emptyFetch(),now,
    EmailMessageCtor:FakeEmailMessage});
  assert.equal(result.heartbeat.state,'MISSING');
  assert.equal(result.incidents.observerHeartbeat.transition,'NEW');
  assert.equal(sent.length,1);
  assert.match(sent[0].raw,/NEW/);
});

test('re-running the exact same cycle (retry) never duplicates the incident or the email',async()=>{
  const db=createFakeWatchdogD1();
  const sent=[];
  const now=Date.parse('2026-09-09T12:00:00.000Z');
  const env=makeEnv(db,{sent});
  await runWatchdogCycle({env,fetchImpl:emptyFetch(),now,EmailMessageCtor:FakeEmailMessage});
  await runWatchdogCycle({env,fetchImpl:emptyFetch(),now,EmailMessageCtor:FakeEmailMessage});
  assert.equal(sent.length,1,'a retry at the exact same instant must not send a second email');
  assert.equal(db._tables.incidents.size,1);
});

test('a later cycle with the same unresolved condition is ONGOING and silent until the reminder window',async()=>{
  const db=createFakeWatchdogD1();
  const sent=[];
  const env=makeEnv(db,{sent});
  const t0=Date.parse('2026-09-09T12:00:00.000Z');
  await runWatchdogCycle({env,fetchImpl:emptyFetch(),now:t0,EmailMessageCtor:FakeEmailMessage});
  const t1=t0+6*60*60*1000;
  const result=await runWatchdogCycle({env,fetchImpl:emptyFetch(),now:t1,EmailMessageCtor:FakeEmailMessage});
  assert.equal(result.incidents.observerHeartbeat.transition,'ONGOING');
  assert.equal(sent.length,1,'still within the 24h reminder ceiling, no second email yet');
});

test('escalation from STALE to MISSING is CHANGED and notifies again',async()=>{
  const db=createFakeWatchdogD1();
  const sent=[];
  const env=makeEnv(db,{sent});
  const t0=Date.parse('2026-09-09T00:00:00.000Z');
  // One success 13 hours before t0: STALE, not yet MISSING.
  await runWatchdogCycle({env,fetchImpl:healthyFetch(t0,13*60),now:t0,EmailMessageCtor:FakeEmailMessage});
  assert.equal(sent.length,1);
  // Same success record is still the most recent; 13 hours later it crosses into MISSING.
  const t2=t0+13*60*60*1000;
  const result=await runWatchdogCycle({env,fetchImpl:emptyFetch(),now:t2,EmailMessageCtor:FakeEmailMessage});
  assert.equal(result.heartbeat.state,'MISSING');
  assert.equal(result.incidents.observerHeartbeat.transition,'CHANGED');
  assert.equal(sent.length,2);
});

test('recovery after a missing heartbeat sends RECOVERED, then a later reopen sends REOPENED',async()=>{
  const db=createFakeWatchdogD1();
  const sent=[];
  const env=makeEnv(db,{sent});
  const t0=Date.parse('2026-09-09T00:00:00.000Z');
  await runWatchdogCycle({env,fetchImpl:emptyFetch(),now:t0,EmailMessageCtor:FakeEmailMessage});
  assert.equal(sent.length,1);
  const t1=t0+60*60*1000;
  const recovered=await runWatchdogCycle({env,fetchImpl:healthyFetch(t1,1),now:t1,
    EmailMessageCtor:FakeEmailMessage});
  assert.equal(recovered.incidents.observerHeartbeat.transition,'RECOVERED');
  assert.equal(sent.length,2);
  const t2=t1+25*60*60*1000;
  const reopened=await runWatchdogCycle({env,fetchImpl:emptyFetch(),now:t2,EmailMessageCtor:FakeEmailMessage});
  assert.equal(reopened.incidents.observerHeartbeat.transition,'REOPENED');
  assert.equal(sent.length,3);
});

test('GitHub evidence unavailable raises its own independent incident, never a heartbeat lie',async()=>{
  const db=createFakeWatchdogD1();
  const sent=[];
  const env=makeEnv(db,{sent});
  const now=Date.parse('2026-09-09T12:00:00.000Z');
  const result=await runWatchdogCycle({env,fetchImpl:unavailableFetch(),now,EmailMessageCtor:FakeEmailMessage});
  assert.equal(result.githubEvidenceOk,false);
  assert.equal(result.incidents.githubEvidence.transition,'NEW');
  assert.doesNotMatch(JSON.stringify(result),/outage/i);
});

test('heartbeat detection survives a GitHub-unavailable cycle using durable D1 history',async()=>{
  const db=createFakeWatchdogD1();
  const sent=[];
  const env=makeEnv(db,{sent});
  const t0=Date.parse('2026-09-09T00:00:00.000Z');
  await runWatchdogCycle({env,fetchImpl:healthyFetch(t0,30),now:t0,EmailMessageCtor:FakeEmailMessage});
  const t1=t0+60*60*1000;
  const result=await runWatchdogCycle({env,fetchImpl:unavailableFetch(),now:t1,
    EmailMessageCtor:FakeEmailMessage});
  assert.equal(result.heartbeat.state,'HEALTHY','the earlier success recorded in D1 is still honoured');
});

test('a delivery failure still reserves the notification and self-heals on the next cycle',async()=>{
  const db=createFakeWatchdogD1();
  const env={...makeEnv(db,{sent:[]}),
    [WATCHDOG_EMAIL_BINDING]:{send:async()=>{throw new Error('rejected');}}};
  const t0=Date.parse('2026-09-09T00:00:00.000Z');
  const first=await runWatchdogCycle({env,fetchImpl:emptyFetch(),now:t0,EmailMessageCtor:FakeEmailMessage});
  assert.equal(first.incidents.observerHeartbeat.notified,false);
  const sentAfterFix=[];
  const healedEnv={...env,[WATCHDOG_EMAIL_BINDING]:{send:async message=>{sentAfterFix.push(message);}}};
  const t1=t0+60*60*1000;
  const second=await runWatchdogCycle({env:healedEnv,fetchImpl:emptyFetch(),now:t1,
    EmailMessageCtor:FakeEmailMessage});
  assert.equal(second.incidents.observerHeartbeat.notified,true);
  assert.equal(sentAfterFix.length,1);
});
