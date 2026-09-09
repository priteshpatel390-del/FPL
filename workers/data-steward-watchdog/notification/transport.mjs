// DATA-OPS-A1.4 — the one narrow Cloudflare email transport, and nothing wider.
//
// This is deliberately the only place in the whole watchdog package that touches a `send_email`
// binding. It never accepts a recipient from a caller: Cloudflare's own binding configuration
// (`destination_address` in `wrangler.jsonc`) is the sole authority over who can ever receive
// mail from this Worker, so this module passes `to` as `undefined` and lets Cloudflare substitute
// the one address the binding was deployed with. There is no parameter, no environment variable
// and no code path anywhere here that could name a different recipient — the binding's own
// platform-level restriction is what makes this structurally incapable of becoming a mail relay,
// not application logic, which could always be changed later. Application logic backs that up
// only by never accepting a `to` at all.
//
// The message body is a hand-built, minimal RFC 5322 message. This repository's toolchain is
// zero-dependency by design, so no MIME-building package is introduced for one plain-text email.
import {secretFinding} from '../../../src/decision-intelligence/canonical.mjs';

export const NOTIFICATION_SENDER_ADDRESS='data-steward-watchdog@fpltsheet.co.uk';
export const NOTIFICATION_SENDER_NAME='Teamsheet Data Steward Watchdog';

export class NotificationTransportError extends Error{
  constructor(code){super(code);this.name='NotificationTransportError';this.code=code;}
}
const fail=code=>{throw new NotificationTransportError(code);};

const crlfWrap=text=>text.replace(/\r\n/g,'\n').split('\n').join('\r\n');

// A minimal, valid RFC 5322 message: headers, one blank line, a plain-text body. No HTML part, no
// attachment, no header the caller supplies beyond the fixed sender and the validated subject.
function buildRawMessage({subject,body}){
  if(typeof subject!=='string'||subject===''||/[\r\n]/.test(subject))fail('notification_transport_subject_invalid');
  if(typeof body!=='string'||body==='')fail('notification_transport_body_invalid');
  if(secretFinding({subject,body})!==null)fail('notification_transport_secret_forbidden');
  const headers=[
    `From: ${NOTIFICATION_SENDER_NAME} <${NOTIFICATION_SENDER_ADDRESS}>`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit'
  ];
  return `${headers.join('\r\n')}\r\n\r\n${crlfWrap(body)}\r\n`;
}

// `binding` is the Worker's `env.OWNER_NOTIFICATION_EMAIL` (a `send_email` binding). `EmailMessageCtor`
// is injected so this module never imports the Cloudflare-runtime-only `cloudflare:email` module at
// the top level — the real Worker supplies it, and tests supply a deterministic fake.
export async function sendOwnerNotification({binding,subject,body,EmailMessageCtor}){
  if(!binding||typeof binding.send!=='function')fail('notification_transport_binding_missing');
  if(typeof EmailMessageCtor!=='function')fail('notification_transport_constructor_missing');
  const raw=buildRawMessage({subject,body});
  const message=new EmailMessageCtor(NOTIFICATION_SENDER_ADDRESS,undefined,raw);
  try{
    await binding.send(message);
  }catch{
    return Object.freeze({delivered:false});
  }
  return Object.freeze({delivered:true});
}
