// DATA-OPS-A1.4 — the Data Steward Watchdog Worker entry point.
//
// A scheduled handler, and nothing else. No `fetch` handler is exported, so this Worker has no
// public HTTP surface at all. `cloudflare:email`'s `EmailMessage` is imported only inside the
// handler, and only because a Cloudflare Worker runtime is the one place that module resolves —
// every other module in this package receives it by dependency injection instead, exactly like
// the rest of the steward's adapters receive `fetchImpl` and `cryptoImpl`.
//
// `controller.scheduledTime` — the exact logical instant Cloudflare scheduled this firing for,
// distinct from the wall-clock instant this handler happens to execute at — is passed through as
// the single-writer claim identity. A genuine runtime failure is deliberately allowed to escape
// this handler (after a sanitized diagnostic is logged) so Cloudflare's own Cron invocation
// history records a real failure rather than a falsely successful run.
import {isWatchdogReasonCode} from './lib/reason-codes.mjs';
import {runWatchdogCycle} from './run-watchdog.mjs';

const CLOSED_LOG_KEYS=['ok','reasonCode','version','now','duplicate','githubEvidenceOk',
  'heartbeat','incidents'];

function sanitizeForLog(result){
  const out={};
  for(const key of CLOSED_LOG_KEYS)if(key in result)out[key]=result[key];
  return out;
}

export default {
  async scheduled(controller,env){
    let EmailMessageCtor;
    try{({EmailMessage:EmailMessageCtor}=await import('cloudflare:email'));}
    catch{EmailMessageCtor=null;}
    let result;
    try{
      result=await runWatchdogCycle({env,now:Date.now(),scheduledTime:controller.scheduledTime,
        EmailMessageCtor});
    }catch(error){
      const reasonCode=isWatchdogReasonCode(error?.code)?error.code:'WATCHDOG_EXECUTION_FAILED';
      console.log(JSON.stringify({ok:false,reasonCode}));
      // Rethrow a sanitized error — never the caught exception's own message or stack, which
      // could carry provider text — so this invocation still fails visibly in Cloudflare.
      throw new Error(reasonCode);
    }
    console.log(JSON.stringify(sanitizeForLog(result)));
  }
};
