import test from 'node:test';
import assert from 'node:assert/strict';
import {HEARTBEAT_HEALTHY_WINDOW_MS,HEARTBEAT_MISSING_WINDOW_MS,HEARTBEAT_STATE_HEALTHY,
  HEARTBEAT_STATE_MISSING,HEARTBEAT_STATE_STALE,HeartbeatError,classifyHeartbeat}
  from '../workers/data-steward-watchdog/lib/heartbeat.mjs';

const NOW=Date.parse('2026-09-09T12:00:00.000Z');
const iso=ms=>new Date(ms).toISOString();

test('never observed scheduled success is MISSING',()=>{
  const result=classifyHeartbeat({lastScheduledSuccessAt:null,now:NOW});
  assert.equal(result.state,HEARTBEAT_STATE_MISSING);
  assert.equal(result.reasonCode,'OBSERVER_HEARTBEAT_MISSING');
  assert.equal(result.ageMs,null);
});

test('success just now is healthy',()=>{
  const result=classifyHeartbeat({lastScheduledSuccessAt:iso(NOW),now:NOW});
  assert.equal(result.state,HEARTBEAT_STATE_HEALTHY);
  assert.equal(result.ageMs,0);
});

test('exact 12 hour boundary is healthy (inclusive)',()=>{
  const result=classifyHeartbeat({lastScheduledSuccessAt:iso(NOW-HEARTBEAT_HEALTHY_WINDOW_MS),now:NOW});
  assert.equal(result.state,HEARTBEAT_STATE_HEALTHY);
  assert.equal(result.reasonCode,'OBSERVER_HEARTBEAT_HEALTHY');
});

test('one millisecond past 12 hours is stale',()=>{
  const result=classifyHeartbeat({lastScheduledSuccessAt:iso(NOW-HEARTBEAT_HEALTHY_WINDOW_MS-1),now:NOW});
  assert.equal(result.state,HEARTBEAT_STATE_STALE);
  assert.equal(result.reasonCode,'OBSERVER_HEARTBEAT_STALE');
});

test('exact 24 hour boundary is stale (inclusive), not missing',()=>{
  const result=classifyHeartbeat({lastScheduledSuccessAt:iso(NOW-HEARTBEAT_MISSING_WINDOW_MS),now:NOW});
  assert.equal(result.state,HEARTBEAT_STATE_STALE);
});

test('one millisecond past 24 hours is missing',()=>{
  const result=classifyHeartbeat({lastScheduledSuccessAt:iso(NOW-HEARTBEAT_MISSING_WINDOW_MS-1),now:NOW});
  assert.equal(result.state,HEARTBEAT_STATE_MISSING);
});

test('a success far in the past is missing, not merely stale',()=>{
  const result=classifyHeartbeat({lastScheduledSuccessAt:iso(NOW-10*HEARTBEAT_MISSING_WINDOW_MS),now:NOW});
  assert.equal(result.state,HEARTBEAT_STATE_MISSING);
});

test('rejects a success timestamp in the future',()=>{
  assert.throws(()=>classifyHeartbeat({lastScheduledSuccessAt:iso(NOW+1000),now:NOW}),HeartbeatError);
});

test('rejects a malformed timestamp and a non-integer now',()=>{
  assert.throws(()=>classifyHeartbeat({lastScheduledSuccessAt:'not-a-timestamp',now:NOW}),HeartbeatError);
  assert.throws(()=>classifyHeartbeat({lastScheduledSuccessAt:null,now:-1}),HeartbeatError);
  assert.throws(()=>classifyHeartbeat({lastScheduledSuccessAt:null,now:1.5}),HeartbeatError);
});

test('heartbeat classification is a pure deterministic function of its two inputs',()=>{
  const a=classifyHeartbeat({lastScheduledSuccessAt:iso(NOW-1000),now:NOW});
  const b=classifyHeartbeat({lastScheduledSuccessAt:iso(NOW-1000),now:NOW});
  assert.deepEqual(a,b);
});
