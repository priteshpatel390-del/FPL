import {apiFootballRequestInit,buildPinnedApiFootballUrl,sendApiFootballRequest} from '../../src/decision-intelligence/api-football-foundation.mjs';
import {createD1CollectorRepository} from './d1-persistence.mjs';
import {classifyCompletion,readBoundedJson,validateCollectorRequest,validatePlannerConfiguration,validateRuntimeActivation,validateRuntimeConfiguration,API_FOOTBALL_MAX_RESPONSE_BYTES} from './runtime-contracts.mjs';
import {planScheduledCollection} from './planner-orchestrator.mjs';
import {validateProviderPayload} from './semantic-validation.mjs';
import {runOneShotDiscoveryGeneration} from './activation-orchestrator.mjs';

const safe=result=>Object.freeze(result);
export const ATTENDED_ACCEPTANCE_PATH='/__teamsheet/api-football/attended-one-shot';
export const ATTENDED_TRIGGER_BINDING='API_FOOTBALL_ATTENDED_TRIGGER_SECRET';
const GENERIC_REJECTION=Object.freeze({status:404,body:'Not found'});
export function sanitizedEvent(event={}){
  const allowed=['operationClass','logicalState','failureReason','requestCount','timeout','httpClass','quotaState','mappingCoverageCount','admittedCount','conflictedCount'];
  return Object.freeze(Object.fromEntries(allowed.filter(key=>event[key]!==undefined).map(key=>[key,event[key]])));
}

export async function executeProviderTransport({env,request,fetchImpl=globalThis.fetch,now=()=>new Date().toISOString(),maxResponseBytes=API_FOOTBALL_MAX_RESPONSE_BYTES,timeoutSignal}={}){
  const contract=validateCollectorRequest(request);if(!contract.ok)return contract;
  const pinned=buildPinnedApiFootballUrl(request?.endpoint,request?.search);if(!pinned.ok)return pinned;
  if(typeof env?.API_FOOTBALL_API_KEY!=='string'||!env.API_FOOTBALL_API_KEY)return safe({ok:false,reason:'credential_unavailable'});
  if(!Number.isInteger(maxResponseBytes)||maxResponseBytes<1)return safe({ok:false,reason:'response_limit_unqualified'});
  const init=apiFootballRequestInit(env.API_FOOTBALL_API_KEY);if(!init.ok)return init;
  const fetchedAt=now();
  const sent=await sendApiFootballRequest({fetchImpl,url:pinned.url,init:init.init,timeoutSignal});
  if(!sent.ok){
    const completion=classifyCompletion({timedOut:sent.reason==='provider_timeout',transportUnknown:sent.reason!=='provider_timeout',now:now()});
    return safe({ok:false,reason:sent.reason,completion});
  }
  let completion=classifyCompletion({status:sent.response.status,headers:sent.response.headers,now:now()});
  if(completion.outcome==='AUTH_FAILURE')return safe({ok:false,reason:'provider_authentication_failed',completion});
  if(sent.response.status===429)return safe({ok:false,reason:'quota_exhausted',completion});
  if(!sent.response.ok)return safe({ok:false,reason:'provider_unavailable',completion});
  let decoded;try{decoded=await readBoundedJson(sent.response,{maxBytes:maxResponseBytes});}catch{decoded=safe({ok:false,reason:'provider_schema_invalid'});}
  if(!decoded.ok){completion=safe({...completion,outcome:'SCHEMA_FAILURE'});return safe({...decoded,completion});}
  return safe({ok:true,payload:decoded.payload,completion,fetchedAt});
}

export function createCollectorExecutionDependencies({env,plan,fetchImpl=globalThis.fetch,timeoutSignal}={}){
  const context=plan?.executionContext;
  if(!context?.authority||context.mappings?.length!==20)return null;
  const repository=createD1CollectorRepository(env?.TEAMSHEET_DATA_DB,{authority:context.authority,cryptoImpl:env?.crypto||globalThis.crypto});
  if(!repository)return null;
  return safe({
    repository,
    transport:request=>executeProviderTransport({env,request,fetchImpl,maxResponseBytes:API_FOOTBALL_MAX_RESPONSE_BYTES,timeoutSignal}),
    validate:(payload,request,fetchedAt)=>validateProviderPayload(payload,request,{fetchedAt,teamMappings:context.mappings})
  });
}

export async function runScheduledCollector({controller,env,dependencyFactory=createCollectorExecutionDependencies,planner=planScheduledCollection}={}){
  const activation=validateRuntimeActivation(env);
  if(!activation.ok){console.log(JSON.stringify(sanitizedEvent({operationClass:'SCHEDULER',logicalState:'BLOCKED',failureReason:activation.reason,requestCount:0})));return activation;}
  const configuration=validatePlannerConfiguration(env);
  if(!configuration.ok){console.log(JSON.stringify(sanitizedEvent({operationClass:'SCHEDULER',logicalState:'BLOCKED',failureReason:configuration.reason,requestCount:0})));return configuration;}
  const scheduledMs=Number(controller?.scheduledTime);
  if(!Number.isFinite(scheduledMs)){const invalid=safe({ok:false,reason:'planner_timestamp_invalid'});console.log(JSON.stringify(sanitizedEvent({operationClass:'SCHEDULER',logicalState:'BLOCKED',failureReason:invalid.reason,requestCount:0})));return invalid;}
  const at=new Date(scheduledMs).toISOString();
  let plan;try{plan=await planner(env.TEAMSHEET_DATA_DB,{now:at});}catch{plan=safe({ok:false,reason:'planner_storage_unavailable'});}
  if(!plan.ok){console.log(JSON.stringify(sanitizedEvent({operationClass:'SCHEDULER',logicalState:'BLOCKED',failureReason:plan.reason,requestCount:0})));return plan;}
  console.log(JSON.stringify(sanitizedEvent({operationClass:'SCHEDULER',logicalState:'PLANNED',requestCount:plan.requestCount,mappingCoverageCount:plan.mappingCoverageCount})));
  if(activation.mode==='prelive_planner_only')return safe({ok:false,reason:'provider_execution_not_approved',plannerReady:true,requestCount:plan.requestCount,blockedOperationCount:plan.blockedOperations.length,deferredOperationCount:plan.deferredOperations.length});
  const runtime=validateRuntimeConfiguration(env);if(!runtime.ok)return runtime;
  const dependencies=dependencyFactory({env,plan,now:at});
  if(!dependencies?.repository||typeof dependencies.transport!=='function'||typeof dependencies.validate!=='function')return safe({ok:false,reason:'execution_composition_unavailable'});
  return runOneShotDiscoveryGeneration({requests:plan.requests.filter(request=>request.operationClass==='DISCOVERY'),...dependencies,now:at});
}

export async function scheduled(controller,env){return runScheduledCollector({controller,env});}

async function constantTimeSecretMatch(provided,expected,cryptoImpl=globalThis.crypto){
  if(typeof provided!=='string'||typeof expected!=='string'||provided.length<32||expected.length<32||!cryptoImpl?.subtle)return false;
  const encode=value=>new TextEncoder().encode(value);
  const [left,right]=await Promise.all([cryptoImpl.subtle.digest('SHA-256',encode(provided)),cryptoImpl.subtle.digest('SHA-256',encode(expected))]);
  const a=new Uint8Array(left),b=new Uint8Array(right);let difference=a.length^b.length;
  for(let index=0;index<Math.max(a.length,b.length);index++)difference|=(a[index%a.length]??0)^(b[index%b.length]??0);
  return difference===0;
}

export async function runAttendedHttpRequest(request,env,{run=runScheduledCollector,cryptoImpl=globalThis.crypto,now=()=>Date.now()}={}){
  let url;try{url=new URL(request?.url);}catch{return GENERIC_REJECTION;}
  if(request?.method!=='POST'||url.pathname!==ATTENDED_ACCEPTANCE_PATH||url.search!=='')return GENERIC_REJECTION;
  const activation=validateRuntimeActivation(env);
  if(!activation.ok||activation.mode!=='attended_one_shot_discovery')return GENERIC_REJECTION;
  const provided=request.headers?.get?.('x-teamsheet-attended-trigger');
  if(!await constantTimeSecretMatch(provided,env?.[ATTENDED_TRIGGER_BINDING],cryptoImpl))return GENERIC_REJECTION;
  let result;try{result=await run({controller:{scheduledTime:now()},env});}catch{result=safe({ok:false});}
  return result?.ok?safe({status:202,body:'Accepted'}):safe({status:409,body:'Not accepted'});
}

export async function fetch(request,env){
  const result=await runAttendedHttpRequest(request,env);
  return new Response(result.body,{status:result.status,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
}

export default {scheduled,fetch};
