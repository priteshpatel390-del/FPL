// DATA-OPS-A1.4 — sanitized owner-notification content, built from a closed field set.
//
// This module accepts only the exact fields listed in `CONTEXT_KEYS` and rejects anything else,
// so a caller cannot smuggle a raw GitHub payload, a Cloudflare response body or a caught
// exception's own message into an email by adding an extra field. `secretFinding()` from the
// shared canonical module runs over the built content as defence in depth even though nothing
// upstream should ever be able to place a secret here.
import {secretFinding} from '../../../src/decision-intelligence/canonical.mjs';

export const CONTEXT_KEYS=deepFreezeKeys(['fingerprint','transition','problemClass','component',
  'reasonCode','lastKnownHealthyOrScheduledAt','ageMs','workflowRunId','headSha',
  'occurrenceCount','reopenedCount']);
function deepFreezeKeys(keys){return Object.freeze(keys);}

const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)
  &&Object.keys(value).sort().join(',')===keys.slice().sort().join(',');
const text=(value,pattern)=>typeof value==='string'&&pattern.test(value);
const FINGERPRINT=/^watchdog-[0-9a-f]{24}$/;
const REASON=/^[A-Z][A-Z0-9_]{1,63}$/;
const TRANSITION=/^(?:NEW|CHANGED|RECOVERED|REOPENED|REMINDER)$/;
const SHA=/^[0-9a-f]{40}$/;
const iso=value=>value===null||(typeof value==='string'
  &&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value)));

export class NotificationMessageError extends Error{
  constructor(code){super(code);this.name='NotificationMessageError';this.code=code;}
}
const fail=code=>{throw new NotificationMessageError(code);};

function validate(context){
  if(!exact(context,CONTEXT_KEYS))fail('notification_message_schema_invalid');
  if(!text(context.fingerprint,FINGERPRINT))fail('notification_message_fingerprint_invalid');
  if(!text(context.transition,TRANSITION))fail('notification_message_transition_invalid');
  if(!text(context.problemClass,/^[A-Z][A-Z0-9_]{1,63}$/))fail('notification_message_problem_invalid');
  if(!text(context.component,/^[a-z][a-z0-9_]{1,63}$/))fail('notification_message_component_invalid');
  if(!text(context.reasonCode,REASON))fail('notification_message_reason_invalid');
  if(!iso(context.lastKnownHealthyOrScheduledAt))fail('notification_message_timestamp_invalid');
  if(context.ageMs!==null&&(!Number.isSafeInteger(context.ageMs)||context.ageMs<0))
    fail('notification_message_age_invalid');
  if(context.workflowRunId!==null&&(!Number.isSafeInteger(context.workflowRunId)||context.workflowRunId<=0))
    fail('notification_message_run_id_invalid');
  if(context.headSha!==null&&!text(context.headSha,SHA))fail('notification_message_head_sha_invalid');
  if(!Number.isSafeInteger(context.occurrenceCount)||context.occurrenceCount<0)
    fail('notification_message_occurrence_invalid');
  if(!Number.isSafeInteger(context.reopenedCount)||context.reopenedCount<0)
    fail('notification_message_reopened_invalid');
}

const hours=ms=>ms===null?'unknown':`${Math.floor(ms/3600000)}h${Math.floor((ms%3600000)/60000)}m`;

export function buildNotificationMessage(context){
  validate(context);
  const subject=`Teamsheet Data Steward — ${context.transition} — ${context.component}`;
  const lines=[
    `Data Steward Watchdog (A1.4) — ${context.transition}`,
    '',
    `Problem class: ${context.problemClass}`,
    `Component: ${context.component}`,
    `Reason code: ${context.reasonCode}`,
    `Incident fingerprint: ${context.fingerprint}`,
    `Last known healthy/scheduled observation: ${context.lastKnownHealthyOrScheduledAt??'none recorded'}`,
    `Freshness age: ${hours(context.ageMs)}`,
    `Occurrences: ${context.occurrenceCount} (reopened ${context.reopenedCount} time(s))`,
    context.workflowRunId!==null?`Related GitHub Actions run id: ${context.workflowRunId}`:null,
    context.headSha!==null?`Related main SHA: ${context.headSha}`:null,
    '',
    'No remediation, repair, mutation or production action was attempted or is possible from this notification.',
    'This is a read-only observation of the Data Steward observer\'s own operational health.'
  ].filter(line=>line!==null);
  const body=lines.join('\n');
  const finding=secretFinding({subject,body});
  if(finding!==null)fail('notification_message_secret_forbidden');
  return Object.freeze({subject,body});
}
