// DATA-OPS-A1.4 — the notification decision, kept deliberately separate from email transport.
//
// This module never sends anything. It is a pure function from a lifecycle transition plus the
// incident's own notification history to a yes/no decision and, when the answer is yes, which
// transition label the email should carry. That separation is what lets the whole notification
// POLICY be tested without a Worker, a D1 binding or a `send_email` binding anywhere in scope.
//
// The policy is exactly the approved one: NEW, CHANGED, RECOVERED and REOPENED always notify.
// ONGOING never notifies on its own — the owner is not emailed on every unchanged observation —
// except that an unresolved incident earns one bounded reminder every 24 hours so a long-running
// problem cannot silently stop being mentioned at all.
import {deepFreeze} from '../lib/canonical.mjs';
import {TRANSITION_CHANGED,TRANSITION_NEW,TRANSITION_ONGOING,TRANSITION_RECOVERED,
  TRANSITION_REOPENED,TRANSITION_NONE} from '../lib/lifecycle-reducer.mjs';

export const REMINDER_CEILING_MS=24*60*60*1000;
export const NOTIFICATION_TRANSITION_REMINDER='REMINDER';

const ALWAYS_NOTIFY=deepFreeze([TRANSITION_NEW,TRANSITION_CHANGED,TRANSITION_RECOVERED,
  TRANSITION_REOPENED]);

export class NotificationDecisionError extends Error{
  constructor(code){super(code);this.name='NotificationDecisionError';this.code=code;}
}
const fail=code=>{throw new NotificationDecisionError(code);};

const iso=value=>value===null||(typeof value==='string'
  &&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value)));

// `lastNotifiedAt` is the incident's own persisted field — `null` if it has never yet been
// notified about (which can happen for a fresh incident whose reservation this same cycle has not
// yet been recorded, or for one whose only prior send attempt failed).
export function decideNotification({transition,lastNotifiedAt,now}){
  if(!Number.isSafeInteger(now)||now<0)fail('notification_decision_now_invalid');
  if(!iso(lastNotifiedAt))fail('notification_decision_timestamp_invalid');
  if(transition===TRANSITION_NONE){
    return deepFreeze({shouldNotify:false,notificationTransition:null});
  }
  if(ALWAYS_NOTIFY.includes(transition)){
    return deepFreeze({shouldNotify:true,notificationTransition:transition});
  }
  if(transition===TRANSITION_ONGOING){
    if(lastNotifiedAt===null)return deepFreeze({shouldNotify:true,
      notificationTransition:NOTIFICATION_TRANSITION_REMINDER});
    const dueAt=Date.parse(lastNotifiedAt)+REMINDER_CEILING_MS;
    if(now<dueAt)return deepFreeze({shouldNotify:false,notificationTransition:null});
    return deepFreeze({shouldNotify:true,notificationTransition:NOTIFICATION_TRANSITION_REMINDER});
  }
  fail('notification_decision_transition_unknown');
}
