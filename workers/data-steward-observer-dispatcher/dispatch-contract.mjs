// DATA-OPS A1.3 — fixed contract for the isolated Cloudflare observer dispatcher.
// It can dispatch exactly one workflow on main and exposes no caller-controlled URL, ref or body.

export const OBSERVER_DISPATCH_REPOSITORY='priteshpatel390-del/FPL';
export const OBSERVER_DISPATCH_WORKFLOW_FILE='data-steward-readonly-observer.yml';
export const OBSERVER_DISPATCH_REF='main';
export const OBSERVER_DISPATCH_TOKEN_BINDING='DATA_STEWARD_OBSERVER_DISPATCH_TOKEN';
export const OBSERVER_CLOCK_DB_BINDING='STEWARD_OBSERVER_CLOCK_DB';
export const OBSERVER_CRON='17 4 * * *';
export const OBSERVER_DISPATCH_TIMEOUT_MS=15000;
export const OBSERVER_DISPATCH_API_VERSION='2022-11-28';
export const OBSERVER_DISPATCH_URL=`https://api.github.com/repos/${OBSERVER_DISPATCH_REPOSITORY}/actions/workflows/${OBSERVER_DISPATCH_WORKFLOW_FILE}/dispatches`;
export const OBSERVER_DISPATCH_BODY=JSON.stringify({ref:OBSERVER_DISPATCH_REF,return_run_details:true});

export const DISPATCHED='DISPATCHED';
export const FAILED='FAILED';
export const AMBIGUOUS='AMBIGUOUS';
export const DUPLICATE='DUPLICATE';

export const REJECTED_STATUSES=Object.freeze([401,403,404,422]);

export function observerDispatchRequest(token){
  if(typeof token!=='string'||!token)throw new Error('observer_dispatch_token_missing');
  return Object.freeze({url:OBSERVER_DISPATCH_URL,init:Object.freeze({method:'POST',headers:Object.freeze({
    authorization:`Bearer ${token}`,accept:'application/vnd.github+json','content-type':'application/json',
    'x-github-api-version':OBSERVER_DISPATCH_API_VERSION,'user-agent':'teamsheet-data-steward-observer-dispatcher'}),
    body:OBSERVER_DISPATCH_BODY})});
}

export function validateRunIdentity(body){
  if(body===null||typeof body!=='object'||Array.isArray(body))return null;
  const runId=body.workflow_run_id;
  if(!Number.isSafeInteger(runId)||runId<=0)return null;
  if(body.run_url!==`https://api.github.com/repos/${OBSERVER_DISPATCH_REPOSITORY}/actions/runs/${runId}`)return null;
  if(body.html_url!==`https://github.com/${OBSERVER_DISPATCH_REPOSITORY}/actions/runs/${runId}`)return null;
  return runId;
}

export function classifyObserverDispatchResponse({status,body=null}={}){
  if(status===200){
    const runId=validateRunIdentity(body);
    return runId===null
      ?Object.freeze({state:AMBIGUOUS,reason:'observer_dispatch_identity_missing',runId:null})
      :Object.freeze({state:DISPATCHED,reason:'observer_dispatch_accepted',runId});
  }
  if(REJECTED_STATUSES.includes(status))
    return Object.freeze({state:FAILED,reason:'observer_dispatch_rejected',runId:null});
  return Object.freeze({state:AMBIGUOUS,reason:'observer_dispatch_ambiguous',runId:null});
}

export function validateScheduledOpportunity({scheduledTime,cron}){
  if(!Number.isSafeInteger(scheduledTime)||scheduledTime<0||cron!==OBSERVER_CRON)return false;
  const when=new Date(scheduledTime);
  return !Number.isNaN(when.getTime())&&when.getUTCMinutes()===17&&when.getUTCHours()===4;
}

export function observerOpportunityAt(scheduledTime){
  if(!Number.isSafeInteger(scheduledTime)||scheduledTime<0)return null;
  const when=new Date(scheduledTime);
  if(Number.isNaN(when.getTime()))return null;
  when.setUTCSeconds(0,0);
  return when.toISOString();
}
