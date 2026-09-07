// DATA-S2C — the isolated Cloudflare schedule dispatcher.
//
// A timer, and nothing else. It asks GitHub Actions to start the external production collection
// workflow, records three bounded, client-observable latency measurements, and stops. It never
// collects Official FPL data, never touches D1, holds no D1 binding or Cloudflare data credential,
// imports nothing at all outside this directory, and exposes no HTTP fetch handler, no workers.dev
// hostname, no preview URL, no route and no custom domain. The historical collector Worker — which
// still declares a thirty-minute Cron trigger and a D1 binding, and still exposes a scheduled
// collector — is untouched by this Worker and must never be redeployed by it. This Worker
// deliberately runs under its own dedicated identity for exactly that reason.
//
// Its Wrangler configuration declares `triggers.crons` explicitly, and Cloudflare treats that block
// as a total assignment, so an attended deploy sets exactly the Cron Triggers listed there and
// nothing else. Package A shipped an empty list. The owner-approved Package C list is 01:17, 02:17
// and 03:17 UTC: three dispatch OPPORTUNITIES a day, never three collection entitlements — the
// shared fail-closed opportunity guard refuses production collection once the UTC day is consumed.
// Declaring them in the repository arms nothing by itself; only an attended deployment of that
// configuration can arm the live Worker.
//
// Failure discipline: exactly one dispatch request per Cloudflare fire, `controller.noRetry()`
// before that request is even built, and no second attempt on any outcome. A rejection is
// definite and a retry would be pointless; an ambiguity may already have created a run and a
// retry could create a second collection. The next scheduled opportunity is the only automatic
// recovery there is.
//
// Log discipline: closed enums and bounded integers only. No URL, header, token, run id, account
// id or database id may ever reach a log line.
import {AMBIGUOUS,DISPATCH_TIMEOUT_MS,REJECTED,ACCEPTED_WITH_IDENTITY,classifyDispatchResponse,
  dispatchRequest,dispatchTelemetry,runReadRequest} from './dispatch-contract.mjs';

const instant=value=>{
  if(typeof value!=='string'||value==='')return null;
  const ms=Date.parse(value);
  return Number.isFinite(ms)?ms:null;
};

// One bounded read of the exact run the accepted dispatch named, used only to measure run-creation
// latency against the client's own request-start instant. It never searches, never guesses and
// never changes the classification: a read that fails simply leaves the two run-creation
// measurements unavailable.
async function readRunCreatedAt(runId,token,fetchImpl){
  let response;
  try{
    const request=runReadRequest(runId,token);
    response=await fetchImpl(request.url,{...request.init,signal:AbortSignal.timeout(DISPATCH_TIMEOUT_MS)});
  }catch{return null;}
  if(response?.status!==200)return null;
  let body;
  try{body=await response.json();}catch{return null;}
  if(body===null||typeof body!=='object'||Array.isArray(body))return null;
  return body.id===runId?instant(body.created_at):null;
}

export async function runScheduledDispatch({controller,env,fetchImpl=fetch,now=Date.now}){
  // Before anything else, and unconditionally: Cloudflare must never re-deliver this fire.
  controller.noRetry();

  const scheduledTime=controller.scheduledTime;
  const handlerStart=now();
  const token=env?.GITHUB_DISPATCH_TOKEN;
  const report=(classification,reason,telemetry)=>{
    const outcome=Object.freeze({dispatch:classification,reason,...telemetry});
    console.log(JSON.stringify(outcome));
    return outcome;
  };

  // No credential, no request. Nothing was sent, so this is a definite no-side-effect outcome.
  if(typeof token!=='string'||!token)
    return report(REJECTED,'dispatch_token_missing',
      dispatchTelemetry({classification:REJECTED,scheduledTime,handlerStart}));

  let response;
  // Captured immediately before the POST is issued, and never after it returns. This is the
  // baseline for measurement B, and it must be a request-START instant: GitHub may create the
  // workflow run before the successful response comes back, so measuring from the response would
  // turn a perfectly good run-creation time into a negative, and therefore unavailable, value.
  // The instant GitHub internally accepted the dispatch is not observable here and is not guessed.
  const dispatchRequestStartedAt=now();
  try{
    const request=dispatchRequest(token);
    response=await fetchImpl(request.url,{...request.init,signal:AbortSignal.timeout(DISPATCH_TIMEOUT_MS)});
  }catch{
    // A transport failure or a timeout cannot prove the request never reached GitHub, so it is
    // ambiguous and is never retried inside this fire.
    return report(AMBIGUOUS,'dispatch_transport_failed',
      dispatchTelemetry({classification:AMBIGUOUS,scheduledTime,handlerStart}));
  }

  let body=null;
  if(response?.status===200){try{body=await response.json();}catch{body=null;}}
  const decided=classifyDispatchResponse({status:response?.status,body});

  const runCreatedAt=decided.classification===ACCEPTED_WITH_IDENTITY&&decided.runId!==null
    ?await readRunCreatedAt(decided.runId,token,fetchImpl):null;

  return report(decided.classification,decided.reason,dispatchTelemetry({
    classification:decided.classification,scheduledTime,handlerStart,dispatchRequestStartedAt,
    runCreatedAt}));
}

// No `fetch` handler is exported, so this Worker has no public HTTP surface at all.
export default {
  async scheduled(controller,env){await runScheduledDispatch({controller,env});}
};
