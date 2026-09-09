import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ALLOWED_STATEMENTS,StatementNotAllowedError,assertAllowedStatement}
  from '../workers/data-steward-watchdog/persistence/statements.mjs';
import {RETENTION_INCIDENTS_MS,RETENTION_NOTIFICATIONS_MS,RETENTION_OBSERVATIONS_MS,
  getIncident,lastScheduledSuccessAt,markIncidentNotified,pruneRetention,
  recordNotificationDelivery,recordObservation,reserveNotification,saveIncident}
  from '../workers/data-steward-watchdog/persistence/repository.mjs';
import {createFakeWatchdogD1} from './helpers/fake-watchdog-d1.mjs';

const observation=(overrides={})=>({observationId:'obs-1',sourceKind:'scheduled_run',
  eventType:'schedule',workflowRunId:501,runAttempt:1,observedAt:'2026-09-09T05:20:00.000Z',
  runCreatedAt:'2026-09-09T05:17:00.000Z',runCompletedAt:'2026-09-09T05:20:00.000Z',
  headSha:'a'.repeat(40),healthState:'SUCCESS',reasonCode:'OBSERVER_HEARTBEAT_HEALTHY',
  evidenceHash:'b'.repeat(64),createdAt:'2026-09-09T05:20:00.000Z',...overrides});

test('every statement the repository imports is allowlisted',()=>{
  const repositorySource=fs.readFileSync('workers/data-steward-watchdog/persistence/repository.mjs','utf8');
  for(const statement of ALLOWED_STATEMENTS)assert.equal(assertAllowedStatement(statement),statement);
  assert.throws(()=>assertAllowedStatement('SELECT * FROM sqlite_master'),StatementNotAllowedError);
  assert.doesNotMatch(repositorySource,/DROP |ALTER |PRAGMA |ATTACH /i);
});

test('recording the same observation twice inserts exactly one row',async()=>{
  const db=createFakeWatchdogD1();
  const first=await recordObservation(db,observation());
  const second=await recordObservation(db,observation());
  assert.equal(first.inserted,true);
  assert.equal(second.inserted,false);
  assert.equal(db._tables.observations.size,1);
});

test('a health-state change for the same run id is a new, distinct row',async()=>{
  const db=createFakeWatchdogD1();
  await recordObservation(db,observation({observationId:'obs-inflight',healthState:'IN_FLIGHT',
    runCompletedAt:null,reasonCode:'OBSERVER_HEARTBEAT_INCOMPLETE'}));
  await recordObservation(db,observation({observationId:'obs-success'}));
  assert.equal(db._tables.observations.size,2);
  assert.equal(await lastScheduledSuccessAt(db),'2026-09-09T05:20:00.000Z');
});

test('lastScheduledSuccessAt ignores manual runs and non-success rows',async()=>{
  const db=createFakeWatchdogD1();
  await recordObservation(db,observation({observationId:'obs-manual',eventType:'workflow_dispatch',
    sourceKind:'manual_run',runCompletedAt:'2026-09-09T09:00:00.000Z'}));
  await recordObservation(db,observation({observationId:'obs-failed',healthState:'FAILED',
    reasonCode:'OBSERVER_JOB_FAILED',runCompletedAt:'2026-09-09T10:00:00.000Z'}));
  assert.equal(await lastScheduledSuccessAt(db),null);
});

test('saveIncident then getIncident round-trips exactly',async()=>{
  const db=createFakeWatchdogD1();
  await saveIncident(db,{problemClass:'OBSERVER_HEARTBEAT',component:'data_steward_readonly_observer',
    next:{fingerprint:'watchdog-'+'a'.repeat(24),lifecycleState:'ACTIVE',
      reasonCode:'OBSERVER_HEARTBEAT_STALE',firstSeenAt:'2026-09-09T00:00:00.000Z',
      lastSeenAt:'2026-09-09T00:00:00.000Z',recoveredAt:null,occurrenceCount:1,reopenedCount:0,
      lastEvidenceObservedAt:'2026-09-09T00:00:00.000Z'},
    evidenceObservationId:null,updatedAt:'2026-09-09T00:00:00.000Z'});
  const row=await getIncident(db,'watchdog-'+'a'.repeat(24));
  assert.equal(row.reasonCode,'OBSERVER_HEARTBEAT_STALE');
  assert.equal(row.occurrenceCount,1);
  assert.equal(await getIncident(db,'watchdog-'+'b'.repeat(24)),null);
});

test('markIncidentNotified survives a later unrelated upsert without being clobbered',async()=>{
  const db=createFakeWatchdogD1();
  const fingerprint='watchdog-'+'c'.repeat(24);
  const base={fingerprint,lifecycleState:'ACTIVE',reasonCode:'OBSERVER_HEARTBEAT_STALE',
    firstSeenAt:'2026-09-09T00:00:00.000Z',lastSeenAt:'2026-09-09T00:00:00.000Z',recoveredAt:null,
    occurrenceCount:1,reopenedCount:0,lastEvidenceObservedAt:'2026-09-09T00:00:00.000Z'};
  await saveIncident(db,{problemClass:'OBSERVER_HEARTBEAT',component:'x',next:base,
    evidenceObservationId:null,updatedAt:'2026-09-09T00:00:00.000Z'});
  await markIncidentNotified(db,fingerprint,'2026-09-09T00:05:00.000Z');
  await saveIncident(db,{problemClass:'OBSERVER_HEARTBEAT',component:'x',
    next:{...base,occurrenceCount:2,lastSeenAt:'2026-09-09T06:00:00.000Z'},
    evidenceObservationId:null,updatedAt:'2026-09-09T06:00:00.000Z'});
  const row=await getIncident(db,fingerprint);
  assert.equal(row.lastNotifiedAt,'2026-09-09T00:05:00.000Z');
  assert.equal(row.occurrenceCount,2);
});

test('reserving the same notification twice sends exactly once',async()=>{
  const db=createFakeWatchdogD1();
  const args={idempotencyKey:'notif-1',fingerprint:'watchdog-'+'d'.repeat(24),transition:'NEW',
    decidedAt:'2026-09-09T00:00:00.000Z',evidenceObservationId:null,createdAt:'2026-09-09T00:00:00.000Z'};
  const first=await reserveNotification(db,args);
  const second=await reserveNotification(db,args);
  assert.equal(first.reserved,true);
  assert.equal(second.reserved,false);
  assert.equal(db._tables.notifications.size,1);
});

test('notification delivery status transitions record without duplicating the row',async()=>{
  const db=createFakeWatchdogD1();
  const key='notif-2';
  await reserveNotification(db,{idempotencyKey:key,fingerprint:'watchdog-'+'e'.repeat(24),
    transition:'NEW',decidedAt:'2026-09-09T00:00:00.000Z',evidenceObservationId:null,
    createdAt:'2026-09-09T00:00:00.000Z'});
  await recordNotificationDelivery(db,key,'SENT','2026-09-09T00:00:01.000Z');
  assert.equal(db._tables.notifications.get(key).delivery_status,'SENT');
  assert.equal(db._tables.notifications.size,1);
  await assert.rejects(recordNotificationDelivery(db,key,'BOGUS','2026-09-09T00:00:02.000Z'));
});

test('45-day observation retention prunes strictly older rows and keeps the boundary',async()=>{
  const db=createFakeWatchdogD1();
  const now=Date.parse('2026-09-09T00:00:00.000Z');
  await recordObservation(db,observation({observationId:'obs-old',
    observedAt:new Date(now-RETENTION_OBSERVATIONS_MS-1).toISOString()}));
  await recordObservation(db,observation({observationId:'obs-boundary',
    observedAt:new Date(now-RETENTION_OBSERVATIONS_MS).toISOString()}));
  await recordObservation(db,observation({observationId:'obs-fresh',observedAt:new Date(now).toISOString()}));
  await pruneRetention(db,now);
  assert.deepEqual([...db._tables.observations.keys()].sort(),['obs-boundary','obs-fresh']);
});

test('an observation feeding an ACTIVE incident survives pruning even if it is old',async()=>{
  const db=createFakeWatchdogD1();
  const now=Date.parse('2026-09-09T00:00:00.000Z');
  const oldIso=new Date(now-RETENTION_OBSERVATIONS_MS*2).toISOString();
  await recordObservation(db,observation({observationId:'obs-load-bearing',observedAt:oldIso}));
  await saveIncident(db,{problemClass:'OBSERVER_HEARTBEAT',component:'x',
    next:{fingerprint:'watchdog-'+'f'.repeat(24),lifecycleState:'ACTIVE',
      reasonCode:'OBSERVER_HEARTBEAT_MISSING',firstSeenAt:oldIso,lastSeenAt:oldIso,recoveredAt:null,
      occurrenceCount:1,reopenedCount:0,lastEvidenceObservedAt:oldIso},
    evidenceObservationId:'obs-load-bearing',updatedAt:oldIso});
  await pruneRetention(db,now);
  assert.ok(db._tables.observations.has('obs-load-bearing'));
});

test('365-day incident retention prunes only RECOVERED incidents past the boundary',async()=>{
  const db=createFakeWatchdogD1();
  const now=Date.parse('2026-09-09T00:00:00.000Z');
  const oldIso=new Date(now-RETENTION_INCIDENTS_MS-1).toISOString();
  await saveIncident(db,{problemClass:'OBSERVER_HEARTBEAT',component:'x',
    next:{fingerprint:'watchdog-'+'1'.repeat(24),lifecycleState:'RECOVERED',
      reasonCode:'OBSERVER_HEARTBEAT_STALE',firstSeenAt:oldIso,lastSeenAt:oldIso,recoveredAt:oldIso,
      occurrenceCount:1,reopenedCount:0,lastEvidenceObservedAt:oldIso},
    evidenceObservationId:null,updatedAt:oldIso});
  await saveIncident(db,{problemClass:'OBSERVER_HEARTBEAT',component:'x',
    next:{fingerprint:'watchdog-'+'2'.repeat(24),lifecycleState:'ACTIVE',
      reasonCode:'OBSERVER_HEARTBEAT_STALE',firstSeenAt:oldIso,lastSeenAt:oldIso,recoveredAt:null,
      occurrenceCount:1,reopenedCount:0,lastEvidenceObservedAt:oldIso},
    evidenceObservationId:null,updatedAt:oldIso});
  await pruneRetention(db,now);
  assert.equal(db._tables.incidents.has('watchdog-'+'1'.repeat(24)),false,'recovered past 365 days is pruned');
  assert.equal(db._tables.incidents.has('watchdog-'+'2'.repeat(24)),true,'an ACTIVE incident is never pruned by age');
});

test('90-day notification retention prunes strictly older rows',async()=>{
  const db=createFakeWatchdogD1();
  const now=Date.parse('2026-09-09T00:00:00.000Z');
  await reserveNotification(db,{idempotencyKey:'notif-old',fingerprint:'watchdog-'+'3'.repeat(24),
    transition:'NEW',decidedAt:new Date(now-RETENTION_NOTIFICATIONS_MS-1).toISOString(),
    evidenceObservationId:null,createdAt:'2026-09-09T00:00:00.000Z'});
  await reserveNotification(db,{idempotencyKey:'notif-fresh',fingerprint:'watchdog-'+'3'.repeat(24),
    transition:'ONGOING',decidedAt:new Date(now).toISOString(),evidenceObservationId:null,
    createdAt:'2026-09-09T00:00:00.000Z'});
  await pruneRetention(db,now);
  assert.deepEqual([...db._tables.notifications.keys()],['notif-fresh']);
});

test('a D1 failure fails closed rather than being swallowed',async()=>{
  const failing={prepare(){return {bind(){return {run(){throw new Error('d1 down');},
    first(){throw new Error('d1 down');}};}};}};
  await assert.rejects(recordObservation(failing,observation()));
  await assert.rejects(getIncident(failing,'x'));
  await assert.rejects(lastScheduledSuccessAt(failing));
});

test('the persistence package never imports production Official FPL D1 code',()=>{
  for(const file of ['statements.mjs','repository.mjs']){
    const source=fs.readFileSync(`workers/data-steward-watchdog/persistence/${file}`,'utf8');
    assert.doesNotMatch(source,/data-platform|official-fpl|TEAMSHEET_DATA_DB|d1-rest-client/);
  }
});
