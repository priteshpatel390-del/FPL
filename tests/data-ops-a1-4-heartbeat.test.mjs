import test from 'node:test';
import assert from 'node:assert/strict';
import {HEARTBEAT_STATE_FAILED,HEARTBEAT_STATE_HEALTHY,HEARTBEAT_STATE_MALFORMED,
  HEARTBEAT_STATE_MISSING,HEARTBEAT_STATE_PENDING,HEARTBEAT_STATE_SKIPPED,HeartbeatError,
  classifyHeartbeat} from '../workers/data-steward-watchdog/lib/heartbeat.mjs';
import {OBSERVER_DELIVERY_TOLERANCE_MS} from '../workers/data-steward-watchdog/lib/opportunity-schedule.mjs';

const T=(y,m,d,h,mi)=>Date.UTC(y,m-1,d,h,mi);
const OPP_0417=T(2026,9,9,4,17);

test('no opportunity due yet is PENDING, never an incident',()=>{
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

test('one successful daily opportunity stays HEALTHY for the rest of the day',()=>{
  const evidence={healthState:'SUCCESS',createdAt:OPP_0417+180000};
  for(const now of [T(2026,9,9,8,17),T(2026,9,9,17,17),T(2026,9,9,23,17),T(2026,9,10,4,16)]){
    const result=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:evidence,now});
    assert.equal(result.state,HEARTBEAT_STATE_HEALTHY);
    assert.equal(result.active,false);
  }
});

test('inside the 30-minute delivery window with no evidence is PENDING',()=>{
  const result=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:null,
    now:OPP_0417+OBSERVER_DELIVERY_TOLERANCE_MS-1});
  assert.equal(result.state,HEARTBEAT_STATE_PENDING);
  assert.equal(result.active,false);
});

test('at the 04:47 deadline with no evidence the opportunity is MISSING',()=>{
  const result=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:null,
    now:OPP_0417+OBSERVER_DELIVERY_TOLERANCE_MS});
  assert.equal(result.state,HEARTBEAT_STATE_MISSING);
  assert.equal(result.active,true);
  assert.equal(result.reasonCode,'OBSERVER_HEARTBEAT_MISSING');
});

test('success is decisive even if observed after the delivery deadline',()=>{
  const evidence={healthState:'SUCCESS',createdAt:OPP_0417+OBSERVER_DELIVERY_TOLERANCE_MS+1000};
  const result=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:evidence,
    now:OPP_0417+OBSERVER_DELIVERY_TOLERANCE_MS+2000});
  assert.equal(result.state,HEARTBEAT_STATE_HEALTHY);
});

test('a decisive failure never waits for the delivery deadline',()=>{
  const evidence={healthState:'FAILED',createdAt:OPP_0417+120000};
  const result=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:evidence,
    now:OPP_0417+130000});
  assert.equal(result.state,HEARTBEAT_STATE_FAILED);
  assert.equal(result.active,true);
  assert.equal(result.reasonCode,'OBSERVER_JOB_FAILED');
});

test('a decisive skip never waits for the delivery deadline',()=>{
  const evidence={healthState:'SKIPPED',createdAt:OPP_0417+120000};
  const result=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:evidence,
    now:OPP_0417+130000});
  assert.equal(result.state,HEARTBEAT_STATE_SKIPPED);
  assert.equal(result.reasonCode,'OBSERVER_JOB_SKIPPED');
});

test('a malformed or contradictory summary is MALFORMED and never resets health',()=>{
  for(const healthState of ['SUMMARY_INVALID','SUMMARY_UNHEALTHY','SUMMARY_CONTRADICTORY','UNCLASSIFIED']){
    const evidence={healthState,createdAt:OPP_0417+120000};
    const result=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:evidence,
      now:OPP_0417+130000});
    assert.equal(result.state,HEARTBEAT_STATE_MALFORMED,healthState);
    assert.equal(result.active,true,healthState);
  }
});

test('an in-flight run is PENDING before 04:47 and incomplete at 04:47',()=>{
  const evidence={healthState:'IN_FLIGHT',createdAt:OPP_0417+60000};
  const within=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:evidence,
    now:OPP_0417+OBSERVER_DELIVERY_TOLERANCE_MS-1});
  assert.equal(within.state,HEARTBEAT_STATE_PENDING);
  const deadline=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:evidence,
    now:OPP_0417+OBSERVER_DELIVERY_TOLERANCE_MS});
  assert.equal(deadline.state,HEARTBEAT_STATE_MISSING);
  assert.equal(deadline.reasonCode,'OBSERVER_HEARTBEAT_INCOMPLETE');
});

test('NOT_EVALUATED_OK means the observer itself ran correctly',()=>{
  const evidence={healthState:'NOT_EVALUATED_OK',createdAt:OPP_0417+120000};
  const result=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:evidence,
    now:OPP_0417+130000});
  assert.equal(result.state,HEARTBEAT_STATE_HEALTHY);
});

test('a previous day success cannot mask a new missing daily opportunity',()=>{
  const result=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:null,
    now:OPP_0417+OBSERVER_DELIVERY_TOLERANCE_MS});
  assert.equal(result.state,HEARTBEAT_STATE_MISSING);
});

test('rejects malformed inputs',()=>{
  assert.throws(()=>classifyHeartbeat({opportunityAt:-1,opportunityEvidence:null,now:0}),HeartbeatError);
  assert.throws(()=>classifyHeartbeat({opportunityAt:0,opportunityEvidence:{},now:0}),HeartbeatError);
  assert.throws(()=>classifyHeartbeat({opportunityAt:0,opportunityEvidence:null,now:-1}),HeartbeatError);
});

test('heartbeat classification is deterministic',()=>{
  const evidence={healthState:'SUCCESS',createdAt:OPP_0417+1000};
  const a=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:evidence,now:OPP_0417+2000});
  const b=classifyHeartbeat({opportunityAt:OPP_0417,opportunityEvidence:evidence,now:OPP_0417+2000});
  assert.deepEqual(a,b);
});
