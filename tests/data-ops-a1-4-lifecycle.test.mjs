import test from 'node:test';
import assert from 'node:assert/strict';
import {incidentFingerprint,knownProblemKeys} from '../workers/data-steward-watchdog/lib/incident-fingerprint.mjs';
import {LIFECYCLE_STATE_ACTIVE,LIFECYCLE_STATE_RECOVERED,LifecycleError,TRANSITION_CHANGED,
  TRANSITION_NEW,TRANSITION_NONE,TRANSITION_ONGOING,TRANSITION_RECOVERED,TRANSITION_REOPENED,
  reduceIncidentLifecycle} from '../workers/data-steward-watchdog/lib/lifecycle-reducer.mjs';

const T0='2026-09-09T00:00:00.000Z';
const T1='2026-09-09T06:00:00.000Z';
const T2='2026-09-09T12:00:00.000Z';
const T3='2026-09-09T18:00:00.000Z';
const T4='2026-09-10T00:00:00.000Z';

const evalActive=(reasonCode,evidenceObservedAt,now)=>({active:true,reasonCode,evidenceObservedAt,now});
const evalHealthy=(evidenceObservedAt,now)=>({active:false,reasonCode:null,evidenceObservedAt,now});

test('incident fingerprints are stable, deterministic and closed to known problems',async()=>{
  const a=await incidentFingerprint('OBSERVER_HEARTBEAT');
  const b=await incidentFingerprint('OBSERVER_HEARTBEAT');
  assert.equal(a.fingerprint,b.fingerprint);
  assert.match(a.fingerprint,/^watchdog-[0-9a-f]{24}$/);
  const other=await incidentFingerprint('GITHUB_EVIDENCE');
  assert.notEqual(a.fingerprint,other.fingerprint);
  assert.deepEqual([...knownProblemKeys()].sort(),['GITHUB_EVIDENCE','OBSERVER_HEARTBEAT']);
  await assert.rejects(incidentFingerprint('NOT_A_REAL_PROBLEM'));
});

test('reason code is not part of the fingerprint identity',async()=>{
  const stale=await incidentFingerprint('OBSERVER_HEARTBEAT');
  // The same problem, observed with two different reason codes (e.g. STALE then MISSING), must
  // still resolve to the SAME fingerprint — continuity of the underlying incident is what lets
  // the reducer report CHANGED instead of minting an unrelated new incident.
  const missing=await incidentFingerprint('OBSERVER_HEARTBEAT');
  assert.equal(stale.fingerprint,missing.fingerprint);
});

test('first failure produces exactly one NEW incident',async()=>{
  const {fingerprint}=await incidentFingerprint('OBSERVER_HEARTBEAT');
  const {transition,next}=reduceIncidentLifecycle({fingerprint,previous:null,
    evaluation:evalActive('OBSERVER_HEARTBEAT_STALE',T0,T0)});
  assert.equal(transition,TRANSITION_NEW);
  assert.equal(next.lifecycleState,LIFECYCLE_STATE_ACTIVE);
  assert.equal(next.occurrenceCount,1);
  assert.equal(next.reopenedCount,0);
  assert.equal(next.firstSeenAt,T0);
});

test('repeated identical failure is ONGOING, never a duplicate NEW',async()=>{
  const {fingerprint}=await incidentFingerprint('OBSERVER_HEARTBEAT');
  const first=reduceIncidentLifecycle({fingerprint,previous:null,
    evaluation:evalActive('OBSERVER_HEARTBEAT_STALE',T0,T0)});
  const second=reduceIncidentLifecycle({fingerprint,previous:first.next,
    evaluation:evalActive('OBSERVER_HEARTBEAT_STALE',T1,T1)});
  assert.equal(second.transition,TRANSITION_ONGOING);
  assert.equal(second.next.occurrenceCount,2);
  assert.equal(second.next.firstSeenAt,T0);
});

test('material reason-code change while active is CHANGED',async()=>{
  const {fingerprint}=await incidentFingerprint('OBSERVER_HEARTBEAT');
  const first=reduceIncidentLifecycle({fingerprint,previous:null,
    evaluation:evalActive('OBSERVER_HEARTBEAT_STALE',T0,T0)});
  const escalated=reduceIncidentLifecycle({fingerprint,previous:first.next,
    evaluation:evalActive('OBSERVER_HEARTBEAT_MISSING',T1,T1)});
  assert.equal(escalated.transition,TRANSITION_CHANGED);
  assert.equal(escalated.next.reasonCode,'OBSERVER_HEARTBEAT_MISSING');
});

test('recovery reports RECOVERED exactly once',async()=>{
  const {fingerprint}=await incidentFingerprint('OBSERVER_HEARTBEAT');
  const first=reduceIncidentLifecycle({fingerprint,previous:null,
    evaluation:evalActive('OBSERVER_HEARTBEAT_STALE',T0,T0)});
  const recovered=reduceIncidentLifecycle({fingerprint,previous:first.next,
    evaluation:evalHealthy(T1,T1)});
  assert.equal(recovered.transition,TRANSITION_RECOVERED);
  assert.equal(recovered.next.lifecycleState,LIFECYCLE_STATE_RECOVERED);
  assert.equal(recovered.next.recoveredAt,T1);
  const staysRecovered=reduceIncidentLifecycle({fingerprint,previous:recovered.next,
    evaluation:evalHealthy(T2,T2)});
  assert.equal(staysRecovered.transition,TRANSITION_NONE);
});

test('a healthy observation with no prior incident creates none',async()=>{
  const {fingerprint}=await incidentFingerprint('OBSERVER_HEARTBEAT');
  const result=reduceIncidentLifecycle({fingerprint,previous:null,evaluation:evalHealthy(T0,T0)});
  assert.equal(result.transition,TRANSITION_NONE);
  assert.equal(result.next,null);
});

test('recurrence after recovery is REOPENED and increments reopenedCount',async()=>{
  const {fingerprint}=await incidentFingerprint('OBSERVER_HEARTBEAT');
  const first=reduceIncidentLifecycle({fingerprint,previous:null,
    evaluation:evalActive('OBSERVER_HEARTBEAT_STALE',T0,T0)});
  const recovered=reduceIncidentLifecycle({fingerprint,previous:first.next,
    evaluation:evalHealthy(T1,T1)});
  const reopened=reduceIncidentLifecycle({fingerprint,previous:recovered.next,
    evaluation:evalActive('OBSERVER_HEARTBEAT_STALE',T2,T2)});
  assert.equal(reopened.transition,TRANSITION_REOPENED);
  assert.equal(reopened.next.reopenedCount,1);
  assert.equal(reopened.next.occurrenceCount,2);
  assert.equal(reopened.next.firstSeenAt,T0,'first-seen continuity survives a reopen');
  assert.equal(reopened.next.lifecycleState,LIFECYCLE_STATE_ACTIVE);
});

test('a second reopen increments the counter again',async()=>{
  const {fingerprint}=await incidentFingerprint('OBSERVER_HEARTBEAT');
  let state=reduceIncidentLifecycle({fingerprint,previous:null,
    evaluation:evalActive('OBSERVER_HEARTBEAT_STALE',T0,T0)}).next;
  state=reduceIncidentLifecycle({fingerprint,previous:state,evaluation:evalHealthy(T1,T1)}).next;
  state=reduceIncidentLifecycle({fingerprint,previous:state,
    evaluation:evalActive('OBSERVER_HEARTBEAT_STALE',T2,T2)}).next;
  state=reduceIncidentLifecycle({fingerprint,previous:state,evaluation:evalHealthy(T3,T3)}).next;
  const secondReopen=reduceIncidentLifecycle({fingerprint,previous:state,
    evaluation:evalActive('OBSERVER_HEARTBEAT_STALE',T4,T4)});
  assert.equal(secondReopen.next.reopenedCount,2);
});

test('separate materially different problems have independent incident identity',async()=>{
  const heartbeat=await incidentFingerprint('OBSERVER_HEARTBEAT');
  const evidence=await incidentFingerprint('GITHUB_EVIDENCE');
  const heartbeatIncident=reduceIncidentLifecycle({fingerprint:heartbeat.fingerprint,previous:null,
    evaluation:evalActive('OBSERVER_HEARTBEAT_STALE',T0,T0)});
  const evidenceIncident=reduceIncidentLifecycle({fingerprint:evidence.fingerprint,previous:null,
    evaluation:evalActive('GITHUB_EVIDENCE_UNAVAILABLE',T0,T0)});
  assert.notEqual(heartbeatIncident.next.fingerprint,evidenceIncident.next.fingerprint);
  assert.equal(heartbeatIncident.transition,TRANSITION_NEW);
  assert.equal(evidenceIncident.transition,TRANSITION_NEW);
});

test('replayed identical evidence is a safe no-op',async()=>{
  const {fingerprint}=await incidentFingerprint('OBSERVER_HEARTBEAT');
  const first=reduceIncidentLifecycle({fingerprint,previous:null,
    evaluation:evalActive('OBSERVER_HEARTBEAT_STALE',T1,T1)});
  const replay=reduceIncidentLifecycle({fingerprint,previous:first.next,
    evaluation:evalActive('OBSERVER_HEARTBEAT_STALE',T1,T1)});
  assert.equal(replay.transition,TRANSITION_NONE);
  assert.deepEqual(replay.next,first.next);
});

test('out-of-order (older) evidence never overwrites newer incident state',async()=>{
  const {fingerprint}=await incidentFingerprint('OBSERVER_HEARTBEAT');
  const newer=reduceIncidentLifecycle({fingerprint,previous:null,
    evaluation:evalActive('OBSERVER_HEARTBEAT_MISSING',T2,T2)});
  const older=reduceIncidentLifecycle({fingerprint,previous:newer.next,
    evaluation:evalActive('OBSERVER_HEARTBEAT_STALE',T1,T1)});
  assert.equal(older.transition,TRANSITION_NONE);
  assert.equal(older.next.reasonCode,'OBSERVER_HEARTBEAT_MISSING','older evidence must not downgrade state');
});

test('duplicate execution over the same evidence instant never duplicates a transition',async()=>{
  const {fingerprint}=await incidentFingerprint('OBSERVER_HEARTBEAT');
  const run1=reduceIncidentLifecycle({fingerprint,previous:null,
    evaluation:evalActive('OBSERVER_HEARTBEAT_STALE',T0,T0)});
  // A retry of the exact same watchdog cycle re-observes the same evidence at the same instant.
  const retry=reduceIncidentLifecycle({fingerprint,previous:run1.next,
    evaluation:evalActive('OBSERVER_HEARTBEAT_STALE',T0,T0)});
  assert.equal(retry.transition,TRANSITION_NONE);
});

test('rejects a fingerprint mismatch between previous state and the current evaluation',async()=>{
  const a=await incidentFingerprint('OBSERVER_HEARTBEAT');
  const b=await incidentFingerprint('GITHUB_EVIDENCE');
  const prior=reduceIncidentLifecycle({fingerprint:a.fingerprint,previous:null,
    evaluation:evalActive('OBSERVER_HEARTBEAT_STALE',T0,T0)}).next;
  assert.throws(()=>reduceIncidentLifecycle({fingerprint:b.fingerprint,previous:prior,
    evaluation:evalActive('GITHUB_EVIDENCE_UNAVAILABLE',T1,T1)}),LifecycleError);
});

test('rejects malformed previous/evaluation shapes',()=>{
  assert.throws(()=>reduceIncidentLifecycle({fingerprint:'x',previous:{},evaluation:evalHealthy(T0,T0)}),
    LifecycleError);
  assert.throws(()=>reduceIncidentLifecycle({fingerprint:'x',previous:null,
    evaluation:{active:true,reasonCode:null,evidenceObservedAt:T0,now:T0}}),LifecycleError);
  assert.throws(()=>reduceIncidentLifecycle({fingerprint:'',previous:null,evaluation:evalHealthy(T0,T0)}),
    LifecycleError);
});
