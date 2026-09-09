import test from 'node:test';
import assert from 'node:assert/strict';
import {HEARTBEAT_STATE_FAILED,HEARTBEAT_STATE_HEALTHY,HEARTBEAT_STATE_MALFORMED,
  HEARTBEAT_STATE_MISSING,HEARTBEAT_STATE_PENDING,HEARTBEAT_STATE_SKIPPED,HeartbeatError,
  classifyHeartbeat} from '../workers/data-steward-watchdog/lib/heartbeat.mjs';
import {OBSERVER_GRACE_MS} from '../workers/data-steward-watchdog/lib/opportunity-schedule.mjs';

const T=(y,m,d,h,mi)=>Date.UTC(y,m-1,d,h,mi);
const OPP_0417=T(2026,9,9,4,17);
const OPP_0817=T(2026,9,9,8,17);

test('no opportunity due yet (bootstrap not reached) is PENDING, never an incident',()=>{
  const result=classifyHeartbeat({opportunityAt:null,opportunityEvidence:null,now:T(2026,9,9,3,0)});
  assert.equal(result.state,HEARTBEAT_STATE_PENDING);
  assert.equal(result.active,false);
  assert.equal(result.reasonCode,null);
});

test('normal 04:17 success is HEALTHY',()=>{
  const evidence={healthState:'SUCCESS',createdAt:OPP_0417+180000};
  const result=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:evidence,now:OPP_0417+300000});
  assert.equal(result.state,HEARTBEAT_STATE_HEALTHY);
  assert.equal(result.active,false);
});

test('normal 08:17 success is HEALTHY',()=>{
  const evidence={healthState:'SUCCESS',createdAt:OPP_0817+180000};
  const result=classifyHeartbeat({opportunityAt:OPP_0817,opportunityEvidence:evidence,now:OPP_0817+300000});
  assert.equal(result.state,HEARTBEAT_STATE_HEALTHY);
});

test('watchdog at 11:17 still sees the 08:17 success as HEALTHY, not aged out',()=>{
  const evidence={healthState:'SUCCESS',createdAt:OPP_0817+180000};
  const result=classifyHeartbeat({opportunityAt:OPP_0817,opportunityEvidence:evidence,now:T(2026,9,9,11,17)});
  assert.equal(result.state,HEARTBEAT_STATE_HEALTHY);
});

test('watchdog at 17:17 still sees the 08:17 success as HEALTHY',()=>{
  const evidence={healthState:'SUCCESS',createdAt:OPP_0817+180000};
  const result=classifyHeartbeat({opportunityAt:OPP_0817,opportunityEvidence:evidence,now:T(2026,9,9,17,17)});
  assert.equal(result.state,HEARTBEAT_STATE_HEALTHY);
});

test('watchdog at 23:17 still sees the 08:17 success as HEALTHY — the normal ~20h overnight gap is never a false alarm',()=>{
  const evidence={healthState:'SUCCESS',createdAt:OPP_0817+180000};
  const result=classifyHeartbeat({opportunityAt:OPP_0817,opportunityEvidence:evidence,now:T(2026,9,9,23,17)});
  assert.equal(result.state,HEARTBEAT_STATE_HEALTHY);
  assert.equal(result.active,false);
});

test('watchdog just before the next day\'s 04:17 opportunity is still HEALTHY on yesterday\'s 08:17 success',()=>{
  const evidence={healthState:'SUCCESS',createdAt:OPP_0817+180000};
  const result=classifyHeartbeat({opportunityAt:OPP_0817,opportunityEvidence:evidence,now:T(2026,9,10,4,16)});
  assert.equal(result.state,HEARTBEAT_STATE_HEALTHY);
});

test('within grace with no evidence yet is PENDING, not an incident',()=>{
  const result=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:null,
    now:OPP_0417+OBSERVER_GRACE_MS-1});
  assert.equal(result.state,HEARTBEAT_STATE_PENDING);
  assert.equal(result.active,false);
});

test('exactly at the grace boundary with no evidence is still PENDING (inclusive)',()=>{
  const result=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:null,
    now:OPP_0417+OBSERVER_GRACE_MS});
  assert.equal(result.state,HEARTBEAT_STATE_PENDING);
});

test('one millisecond past grace with no evidence is MISSING',()=>{
  const result=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:null,
    now:OPP_0417+OBSERVER_GRACE_MS+1});
  assert.equal(result.state,HEARTBEAT_STATE_MISSING);
  assert.equal(result.active,true);
  assert.equal(result.reasonCode,'OBSERVER_HEARTBEAT_MISSING');
});

test('a GitHub schedule delay around the historically observed 4h31m/4h44m lateness still resolves healthy once the run appears',()=>{
  const lateBy=(4*60+40)*60*1000; // inside grace
  const evidence={healthState:'SUCCESS',createdAt:OPP_0417+lateBy};
  const result=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:evidence,
    now:OPP_0417+lateBy+60000});
  assert.equal(result.state,HEARTBEAT_STATE_HEALTHY);
});

test('a decisive failure never waits for grace',()=>{
  const evidence={healthState:'FAILED',createdAt:OPP_0417+120000};
  const result=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:evidence,
    now:OPP_0417+130000});
  assert.equal(result.state,HEARTBEAT_STATE_FAILED);
  assert.equal(result.active,true);
  assert.equal(result.reasonCode,'OBSERVER_JOB_FAILED');
});

test('a decisive skip never waits for grace',()=>{
  const evidence={healthState:'SKIPPED',createdAt:OPP_0417+120000};
  const result=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:evidence,
    now:OPP_0417+130000});
  assert.equal(result.state,HEARTBEAT_STATE_SKIPPED);
  assert.equal(result.reasonCode,'OBSERVER_JOB_SKIPPED');
});

test('a malformed/contradictory summary is MALFORMED and never resets health',()=>{
  for(const healthState of ['SUMMARY_INVALID','SUMMARY_UNHEALTHY','SUMMARY_CONTRADICTORY','UNCLASSIFIED']){
    const evidence={healthState,createdAt:OPP_0417+120000};
    const result=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:evidence,
      now:OPP_0417+130000});
    assert.equal(result.state,HEARTBEAT_STATE_MALFORMED,healthState);
    assert.equal(result.active,true,healthState);
  }
});

test('an in-flight run within grace is PENDING; past grace it is MISSING',()=>{
  const evidence={healthState:'IN_FLIGHT',createdAt:OPP_0417+60000};
  const within=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:evidence,
    now:OPP_0417+OBSERVER_GRACE_MS});
  assert.equal(within.state,HEARTBEAT_STATE_PENDING);
  const beyond=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:evidence,
    now:OPP_0417+OBSERVER_GRACE_MS+1});
  assert.equal(beyond.state,HEARTBEAT_STATE_MISSING);
  assert.equal(beyond.reasonCode,'OBSERVER_HEARTBEAT_INCOMPLETE');
});

test('NOT_EVALUATED_OK evidence counts as healthy — A1.3 ran correctly even though the production day was not yet evaluable',()=>{
  const evidence={healthState:'NOT_EVALUATED_OK',createdAt:OPP_0417+120000};
  const result=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:evidence,
    now:OPP_0417+130000});
  assert.equal(result.state,HEARTBEAT_STATE_HEALTHY);
});

test('a previous day\'s success never permanently masks the current opportunity',()=>{
  // The caller is responsible for supplying evidence scoped to the CURRENT opportunity only
  // (see `opportunityEvidenceSince` — its query is bound to `run_created_at >= opportunityAt`).
  // Here, no evidence at all exists for today's 04:17, even though evidence existed for
  // yesterday's opportunities: that must resolve exactly as "no evidence", never masked healthy.
  const result=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:null,
    now:OPP_0417+OBSERVER_GRACE_MS+1});
  assert.equal(result.state,HEARTBEAT_STATE_MISSING);
});

test('rejects malformed inputs',()=>{
  assert.throws(()=>classifyHeartbeat({opportunityAt:-1,opportunityEvidence:null,now:0}),HeartbeatError);
  assert.throws(()=>classifyHeartbeat({opportunityAt:0,opportunityEvidence:{},now:0}),HeartbeatError);
  assert.throws(()=>classifyHeartbeat({opportunityAt:0,opportunityEvidence:null,now:-1}),HeartbeatError);
});

test('heartbeat classification is a pure deterministic function of its inputs',()=>{
  const evidence={healthState:'SUCCESS',createdAt:OPP_0417+1000};
  const a=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:evidence,now:OPP_0417+2000});
  const b=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:evidence,now:OPP_0417+2000});
  assert.deepEqual(a,b);
});
