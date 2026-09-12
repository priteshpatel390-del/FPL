// DATA-OPS A1.3 — isolated Cloudflare clock for the read-only observer.
// One 04:17 UTC opportunity. One GitHub workflow_dispatch attempt. No retry, no public fetch surface.
// The exact workflow run id returned by GitHub is persisted into a dedicated receipt database so
// A1.4 can distinguish this automatic run from ordinary manual workflow_dispatch runs.
import {AMBIGUOUS,DISPATCHED,DUPLICATE,FAILED,OBSERVER_CLOCK_DB_BINDING,OBSERVER_CRON,
  OBSERVER_DISPATCH_TIMEOUT_MS,OBSERVER_DISPATCH_TOKEN_BINDING,classifyObserverDispatchResponse,
  observerDispatchRequest,observerOpportunityAt,validateScheduledOpportunity} from './dispatch-contract.mjs';
import {claimObserverOpportunity,finalizeObserverOpportunity} from './persistence.mjs';

const iso=value=>new Date(value).toISOString();
const diagnostic=(reason,details={})=>console.log(JSON.stringify({dispatch:FAILED,reason,...details}));

export async function runObserverScheduledDispatch({controller,env,fetchImpl=fetch,now=Date.now}={}){
  controller?.noRetry?.();
  const scheduledTime=controller?.scheduledTime;
  const cron=controller?.cron;
  if(!validateScheduledOpportunity({scheduledTime,cron})){
    const when=Number.isSafeInteger(scheduledTime)&&scheduledTime>=0?new Date(scheduledTime):null;
    const timestampValid=when!==null&&!Number.isNaN(when.getTime());
    const reason=timestampValid?'observer_dispatch_schedule_invalid':'observer_dispatch_timestamp_invalid';
    diagnostic(reason,{cronMatched:cron===OBSERVER_CRON,hourMatched:timestampValid&&when.getUTCHours()===4,
      minuteMatched:timestampValid&&when.getUTCMinutes()===17});
    throw new Error(reason);
  }

  const db=env?.[OBSERVER_CLOCK_DB_BINDING];
  const token=env?.[OBSERVER_DISPATCH_TOKEN_BINDING];
  const opportunityAt=observerOpportunityAt(scheduledTime);
  let claimedAt;
  try{claimedAt=iso(now());}
  catch{diagnostic('observer_dispatch_timestamp_invalid');throw new Error('observer_dispatch_timestamp_invalid');}
  let claim;
  try{claim=await claimObserverOpportunity(db,{opportunityAt,cron,claimedAt});}
  catch(error){
    const reason=error?.code==='observer_clock_db_missing'
      ?'observer_clock_db_missing':'observer_clock_claim_failed';
    diagnostic(reason);
    throw new Error(reason);
  }
  if(!claim.claimed){
    console.log(JSON.stringify({dispatch:DUPLICATE,reason:'observer_dispatch_opportunity_already_claimed'}));
    return Object.freeze({dispatch:DUPLICATE,reason:'observer_dispatch_opportunity_already_claimed'});
  }

  if(typeof token!=='string'||!token){
    await finalizeObserverOpportunity(db,{opportunityAt,state:FAILED,runId:null,
      reason:'observer_dispatch_token_missing',finalizedAt:iso(now())});
    console.log(JSON.stringify({dispatch:FAILED,reason:'observer_dispatch_token_missing'}));
    throw new Error('observer_dispatch_failed');
  }

  let response;
  try{
    const request=observerDispatchRequest(token);
    response=await fetchImpl(request.url,{...request.init,
      signal:AbortSignal.timeout(OBSERVER_DISPATCH_TIMEOUT_MS)});
  }catch{
    await finalizeObserverOpportunity(db,{opportunityAt,state:AMBIGUOUS,runId:null,
      reason:'observer_dispatch_transport_failed',finalizedAt:iso(now())});
    console.log(JSON.stringify({dispatch:AMBIGUOUS,reason:'observer_dispatch_transport_failed'}));
    throw new Error('observer_dispatch_ambiguous');
  }

  let body=null;
  if(response?.status===200){try{body=await response.json();}catch{body=null;}}
  const outcome=classifyObserverDispatchResponse({status:response?.status,body});
  await finalizeObserverOpportunity(db,{opportunityAt,state:outcome.state,runId:outcome.runId,
    reason:outcome.reason,finalizedAt:iso(now())});
  console.log(JSON.stringify({dispatch:outcome.state,reason:outcome.reason}));
  if(outcome.state!==DISPATCHED)throw new Error(outcome.state===AMBIGUOUS
    ?'observer_dispatch_ambiguous':'observer_dispatch_failed');
  return Object.freeze({dispatch:DISPATCHED,reason:outcome.reason});
}

export default {
  async scheduled(controller,env){await runObserverScheduledDispatch({controller,env});}
};
