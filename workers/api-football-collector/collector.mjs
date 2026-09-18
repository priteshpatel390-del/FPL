import {apiFootballRequestInit,buildPinnedApiFootballUrl,sendApiFootballRequest} from '../../src/decision-intelligence/api-football-foundation.mjs';
import {completeAttempt,readOfficialFplAuthority,reserveAttempt} from './d1-persistence.mjs';
import {classifyCompletion,readBoundedJson,validateAuthority,validateCollectorRequest,validatePlannerConfiguration,validateRuntimeActivation,validateRuntimeConfiguration} from './runtime-contracts.mjs';
import {planScheduledCollection} from './planner-orchestrator.mjs';

const safe=result=>Object.freeze(result);
export function sanitizedEvent(event={}){
  const allowed=['operationClass','logicalState','failureReason','requestCount','timeout','httpClass','quotaState','mappingCoverageCount','admittedCount','conflictedCount'];
  return Object.freeze(Object.fromEntries(allowed.filter(key=>event[key]!==undefined).map(key=>[key,event[key]])));
}

export async function executeReservedRequest({env,request,fetchImpl=globalThis.fetch,now=()=>new Date().toISOString(),maxResponseBytes=null,timeoutSignal}={}){
  const contract=validateCollectorRequest(request);if(!contract.ok)return contract;
  const pinned=buildPinnedApiFootballUrl(request?.endpoint,request?.search);
  if(!pinned.ok)return pinned;
  if(!env?.TEAMSHEET_DATA_DB)return safe({ok:false,reason:'storage_unavailable'});
  if(typeof env.API_FOOTBALL_API_KEY!=='string'||!env.API_FOOTBALL_API_KEY)return safe({ok:false,reason:'credential_unavailable'});
  if(!Number.isInteger(maxResponseBytes)||maxResponseBytes<1)return safe({ok:false,reason:'response_limit_unqualified'});
  let authority=null;
  if(request.requiresAuthority!==false){
    const read=await readOfficialFplAuthority(env.TEAMSHEET_DATA_DB,{now:now(),cryptoImpl:env.crypto||globalThis.crypto});
    if(!read.ok)return read;authority=read.authority;
    const valid=validateAuthority(authority,{now:now()});if(!valid.ok)return valid;
  }
  const reserved=await reserveAttempt(env.TEAMSHEET_DATA_DB,{...request,authority,now:now()});
  if(!reserved.ok)return reserved;
  const init=apiFootballRequestInit(env.API_FOOTBALL_API_KEY);if(!init.ok)return init;
  const sent=await sendApiFootballRequest({fetchImpl,url:pinned.url,init:init.init,timeoutSignal});
  if(!sent.ok){
    const completion=classifyCompletion({timedOut:sent.reason==='provider_timeout',transportUnknown:sent.reason!=='provider_timeout',now:now()});
    await completeAttempt(env.TEAMSHEET_DATA_DB,{attemptId:request.attemptId,completion,now:now()});
    return safe({ok:false,reason:sent.reason});
  }
  let completion=classifyCompletion({status:sent.response.status,headers:sent.response.headers,now:now()});
  if(completion.outcome==='AUTH_FAILURE'){await completeAttempt(env.TEAMSHEET_DATA_DB,{attemptId:request.attemptId,completion,now:now()});return safe({ok:false,reason:'provider_authentication_failed'});}
  if(sent.response.status===429){await completeAttempt(env.TEAMSHEET_DATA_DB,{attemptId:request.attemptId,completion,now:now()});return safe({ok:false,reason:'quota_exhausted'});}
  if(!sent.response.ok){await completeAttempt(env.TEAMSHEET_DATA_DB,{attemptId:request.attemptId,completion,now:now()});return safe({ok:false,reason:'provider_unavailable'});}
  let decoded;try{decoded=await readBoundedJson(sent.response,{maxBytes:maxResponseBytes});}catch{decoded=safe({ok:false,reason:'provider_schema_invalid'});}
  if(!decoded.ok)completion=safe({...completion,outcome:'SCHEMA_FAILURE'});
  await completeAttempt(env.TEAMSHEET_DATA_DB,{attemptId:request.attemptId,completion,now:now()});
  return decoded.ok?safe({ok:true,payload:decoded.payload}):decoded;
}

export async function scheduled(controller,env){
  const activation=validateRuntimeActivation(env);
  if(!activation.ok){console.log(JSON.stringify(sanitizedEvent({operationClass:'SCHEDULER',logicalState:'BLOCKED',failureReason:activation.reason,requestCount:0})));return activation;}
  const configuration=validatePlannerConfiguration(env);
  if(!configuration.ok){console.log(JSON.stringify(sanitizedEvent({operationClass:'SCHEDULER',logicalState:'BLOCKED',failureReason:configuration.reason,requestCount:0})));return configuration;}
  const scheduledMs=Number(controller?.scheduledTime);
  if(!Number.isFinite(scheduledMs)){const invalid=safe({ok:false,reason:'planner_timestamp_invalid'});console.log(JSON.stringify(sanitizedEvent({operationClass:'SCHEDULER',logicalState:'BLOCKED',failureReason:invalid.reason,requestCount:0})));return invalid;}
  const plan=await planScheduledCollection(env.TEAMSHEET_DATA_DB,{now:new Date(scheduledMs).toISOString()});
  if(!plan.ok){console.log(JSON.stringify(sanitizedEvent({operationClass:'SCHEDULER',logicalState:'BLOCKED',failureReason:plan.reason,requestCount:0})));return plan;}
  console.log(JSON.stringify(sanitizedEvent({operationClass:'SCHEDULER',logicalState:'PLANNED',requestCount:plan.requestCount,mappingCoverageCount:plan.mappingCoverageCount})));
  return safe({ok:false,reason:'provider_execution_not_approved',plannerReady:true,requestCount:plan.requestCount,blockedOperationCount:plan.blockedOperations.length,deferredOperationCount:plan.deferredOperations.length});
}

export default {scheduled};
