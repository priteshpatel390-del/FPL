import test from 'node:test';
import assert from 'node:assert/strict';
import {NOTIFICATION_TRANSITION_REMINDER,NotificationDecisionError,REMINDER_CEILING_MS,
  decideNotification} from '../workers/data-steward-watchdog/notification/decision.mjs';
import {buildNotificationMessage,NotificationMessageError} from '../workers/data-steward-watchdog/notification/message.mjs';
import {NOTIFICATION_SENDER_ADDRESS,NotificationTransportError,sendOwnerNotification}
  from '../workers/data-steward-watchdog/notification/transport.mjs';
import {TRANSITION_CHANGED,TRANSITION_NEW,TRANSITION_NONE,TRANSITION_ONGOING,
  TRANSITION_RECOVERED,TRANSITION_REOPENED} from '../workers/data-steward-watchdog/lib/lifecycle-reducer.mjs';

const NOW=Date.parse('2026-09-09T12:00:00.000Z');

test('NEW, CHANGED, RECOVERED and REOPENED always notify',()=>{
  for(const transition of [TRANSITION_NEW,TRANSITION_CHANGED,TRANSITION_RECOVERED,TRANSITION_REOPENED]){
    const decision=decideNotification({transition,lastNotifiedAt:null,now:NOW});
    assert.equal(decision.shouldNotify,true);
    assert.equal(decision.notificationTransition,transition);
  }
});

test('NONE never notifies',()=>{
  const decision=decideNotification({transition:TRANSITION_NONE,lastNotifiedAt:null,now:NOW});
  assert.equal(decision.shouldNotify,false);
  assert.equal(decision.notificationTransition,null);
});

test('ONGOING does not notify on every unchanged observation',()=>{
  const decision=decideNotification({transition:TRANSITION_ONGOING,
    lastNotifiedAt:new Date(NOW-1000).toISOString(),now:NOW});
  assert.equal(decision.shouldNotify,false);
});

test('ONGOING earns exactly one reminder every 24 hours, not more',()=>{
  const justUnder=decideNotification({transition:TRANSITION_ONGOING,
    lastNotifiedAt:new Date(NOW-REMINDER_CEILING_MS+1).toISOString(),now:NOW});
  assert.equal(justUnder.shouldNotify,false);
  const exact=decideNotification({transition:TRANSITION_ONGOING,
    lastNotifiedAt:new Date(NOW-REMINDER_CEILING_MS).toISOString(),now:NOW});
  assert.equal(exact.shouldNotify,true);
  assert.equal(exact.notificationTransition,NOTIFICATION_TRANSITION_REMINDER);
  const wellOver=decideNotification({transition:TRANSITION_ONGOING,
    lastNotifiedAt:new Date(NOW-REMINDER_CEILING_MS*3).toISOString(),now:NOW});
  assert.equal(wellOver.shouldNotify,true);
});

test('ONGOING with no prior successful notification notifies now as a reminder',()=>{
  const decision=decideNotification({transition:TRANSITION_ONGOING,lastNotifiedAt:null,now:NOW});
  assert.equal(decision.shouldNotify,true);
  assert.equal(decision.notificationTransition,NOTIFICATION_TRANSITION_REMINDER);
});

test('rejects malformed decision inputs',()=>{
  assert.throws(()=>decideNotification({transition:'BOGUS',lastNotifiedAt:null,now:NOW}),
    NotificationDecisionError);
  assert.throws(()=>decideNotification({transition:TRANSITION_NEW,lastNotifiedAt:'nope',now:NOW}),
    NotificationDecisionError);
  assert.throws(()=>decideNotification({transition:TRANSITION_NEW,lastNotifiedAt:null,now:-1}),
    NotificationDecisionError);
});

const context=(overrides={})=>({fingerprint:'watchdog-'+'a'.repeat(24),transition:'NEW',
  problemClass:'OBSERVER_HEARTBEAT',component:'data_steward_readonly_observer',
  reasonCode:'OBSERVER_HEARTBEAT_STALE',lastKnownHealthyOrScheduledAt:'2026-09-09T00:00:00.000Z',
  ageMs:12*60*60*1000,workflowRunId:null,headSha:null,occurrenceCount:1,reopenedCount:0,...overrides});

test('builds a sanitized message containing only closed, expected content',()=>{
  const message=buildNotificationMessage(context());
  assert.match(message.subject,/NEW/);
  assert.match(message.body,/No remediation, repair, mutation or production action was attempted/);
  assert.doesNotMatch(message.body,/bearer|token|secret|api[_-]?key/i);
});

test('rejects an unexpected extra field, never silently drops or carries it',()=>{
  assert.throws(()=>buildNotificationMessage({...context(),extra:'nope'}),NotificationMessageError);
});

test('rejects out-of-contract values for every field',()=>{
  assert.throws(()=>buildNotificationMessage(context({fingerprint:'not-a-fingerprint'})),NotificationMessageError);
  assert.throws(()=>buildNotificationMessage(context({transition:'DELETE'})),NotificationMessageError);
  assert.throws(()=>buildNotificationMessage(context({reasonCode:'lowercase_not_allowed'})),NotificationMessageError);
  assert.throws(()=>buildNotificationMessage(context({occurrenceCount:-1})),NotificationMessageError);
  assert.throws(()=>buildNotificationMessage(context({headSha:'not-hex'})),NotificationMessageError);
});

class FakeEmailMessage{
  constructor(from,to,raw){this.from=from;this.to=to;this.raw=raw;}
}

test('transport sends to the binding without ever specifying a recipient',async()=>{
  const sent=[];
  const binding={send:async message=>{sent.push(message);}};
  const result=await sendOwnerNotification({binding,subject:'Teamsheet Data Steward — NEW — x',
    body:'body text',EmailMessageCtor:FakeEmailMessage});
  assert.equal(result.delivered,true);
  assert.equal(sent.length,1);
  assert.equal(sent[0].to,undefined,'recipient is never specified — the binding config is the sole authority');
  assert.equal(sent[0].from,NOTIFICATION_SENDER_ADDRESS);
  assert.match(sent[0].raw,/^From: /);
  assert.match(sent[0].raw,/\r\n\r\n/);
});

test('a binding send failure is reported, never thrown past the transport',async()=>{
  const binding={send:async()=>{throw new Error('cloudflare rejected it');}};
  const result=await sendOwnerNotification({binding,subject:'s',body:'b',EmailMessageCtor:FakeEmailMessage});
  assert.equal(result.delivered,false);
});

test('transport refuses a subject/body carrying secret-shaped text',async()=>{
  const binding={send:async()=>{}};
  await assert.rejects(sendOwnerNotification({binding,subject:'s',
    body:'Authorization: Bearer abcdefgh12345678',EmailMessageCtor:FakeEmailMessage}),
    NotificationTransportError);
});

test('transport requires a real binding and a real constructor',async()=>{
  await assert.rejects(sendOwnerNotification({binding:null,subject:'s',body:'b',
    EmailMessageCtor:FakeEmailMessage}),NotificationTransportError);
  await assert.rejects(sendOwnerNotification({binding:{send:async()=>{}},subject:'s',body:'b',
    EmailMessageCtor:undefined}),NotificationTransportError);
});
