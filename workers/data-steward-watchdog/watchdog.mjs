// DATA-OPS-A1.4 — the Data Steward Watchdog Worker entry point.
//
// A scheduled handler, and nothing else. No `fetch` handler is exported, so this Worker has no
// public HTTP surface at all. `cloudflare:email`'s `EmailMessage` is imported only inside the
// handler, and only because a Cloudflare Worker runtime is the one place that module resolves —
// every other module in this package receives it by dependency injection instead, exactly like
// the rest of the steward's adapters receive `fetchImpl` and `cryptoImpl`.
import {runWatchdogCycle} from './run-watchdog.mjs';

const CLOSED_LOG_KEYS=['ok','reasonCode','version','now','githubEvidenceOk','heartbeat','incidents','pruned'];

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
    const result=await runWatchdogCycle({env,now:Date.now(),EmailMessageCtor}).catch(()=>
      Object.freeze({ok:false,reasonCode:'OBSERVER_HEARTBEAT_INCOMPLETE'}));
    console.log(JSON.stringify(sanitizeForLog(result)));
  }
};
