import {API_FOOTBALL_DAILY_REQUEST_LIMIT,API_FOOTBALL_QUOTA_HEADER_NAMES,normalizeApiFootballQuotaHeaders} from '../../src/decision-intelligence/api-football-foundation.mjs';
export {API_FOOTBALL_DAILY_REQUEST_LIMIT};

export const API_FOOTBALL_PROVIDER='api-football';
export const API_FOOTBALL_FPL_SEASON='2026-27';
export const API_FOOTBALL_PROVIDER_SEASON=2026;
export const API_FOOTBALL_LEASE_MS=30_000;
export const API_FOOTBALL_MIN_GAP_MS=1_000;
export const API_FOOTBALL_AUTHORITY_MAX_AGE_MS=48*60*60*1000;
export const API_FOOTBALL_MAX_RESPONSE_BYTES=null;
export const API_FOOTBALL_MAX_ROWS=2_000;
export const API_FOOTBALL_ATTEMPT_RETENTION_DAYS=35;
export const API_FOOTBALL_SCHEDULE='15 * * * *';
export const API_FOOTBALL_OPERATION_CLASSES=Object.freeze(['DISCOVERY','PRE_MATCH','FINALITY','FINAL_ENRICHMENT','CORRECTION','MANUAL_BACKFILL']);
const DISCOVERY_LEAGUES=new Set(['2','3','848','45','48']);

const fail=reason=>Object.freeze({ok:false,reason});
const iso=value=>{const ms=Date.parse(value);return Number.isFinite(ms)?new Date(ms).toISOString():null;};
export const utcDay=value=>iso(value)?.slice(0,10)||null;
export function requestAttemptIdentity(logicalRequestId,attemptNumber){
  if(typeof logicalRequestId!=='string'||!logicalRequestId||logicalRequestId.length>240||!Number.isInteger(attemptNumber)||attemptNumber<1||attemptNumber>2)return null;
  return `${logicalRequestId}:attempt:${attemptNumber}`;
}
export function validateCollectorRequest(request){
  if(!request||!API_FOOTBALL_OPERATION_CLASSES.includes(request.operationClass)||!['fixtures','fixtures/lineups','fixtures/players','fixtures/events'].includes(request.endpoint))return fail('request_contract_invalid');
  if(request.attemptId!==requestAttemptIdentity(request.logicalRequestId,request.attemptNumber))return fail('request_identity_invalid');
  const entries=Object.entries(request.search||{});const knownId=request.endpoint==='fixtures'?'id':'fixture';
  if(request.endpoint==='fixtures'&&request.endpointClass==='fixtures_discovery'){
    if(entries.length!==2||String(request.search.season)!==String(API_FOOTBALL_PROVIDER_SEASON)||!DISCOVERY_LEAGUES.has(String(request.search.league)))return fail('parameters_invalid');
  }else if(entries.length!==1||entries[0][0]!==knownId||!/^\d+$/.test(String(entries[0][1]))||Number(entries[0][1])<1)return fail('parameters_invalid');
  return Object.freeze({ok:true});
}

export function validateRuntimeConfiguration(env){
  if(!env?.TEAMSHEET_DATA_DB)return fail('storage_unavailable');
  if(typeof env.API_FOOTBALL_API_KEY!=='string'||!env.API_FOOTBALL_API_KEY)return fail('credential_unavailable');
  if(API_FOOTBALL_MAX_RESPONSE_BYTES===null)return fail('response_limit_unqualified');
  return Object.freeze({ok:true});
}

export function validateAuthority(authority,{now,season=API_FOOTBALL_FPL_SEASON}={}){
  if(!authority||authority.season!==season||authority.sourceKey!=='official-fpl'||authority.sourceRevisionId!=='official-fpl-r1'||authority.runStatus!=='completed')return fail('official_fpl_authority_invalid');
  if(!Array.isArray(authority.teamIds)||authority.teamIds.length!==20||new Set(authority.teamIds).size!==20||authority.teamIds.some(id=>!new RegExp(`^${season}:fpl:team:[1-9]\\d*$`).test(id)))return fail('official_fpl_authority_conflicted');
  const fetched=Date.parse(authority.fetchedAt),current=Date.parse(now);
  if(!Number.isFinite(fetched)||!Number.isFinite(current)||fetched>current||current-fetched>API_FOOTBALL_AUTHORITY_MAX_AGE_MS)return fail('official_fpl_authority_stale');
  if(typeof authority.digest!=='string'||authority.digest.length!==64)return fail('official_fpl_authority_invalid');
  return Object.freeze({ok:true,authority});
}

export function effectiveRequestGapMs(observedMinuteLimit){
  if(!Number.isInteger(observedMinuteLimit)||observedMinuteLimit<=0)return API_FOOTBALL_MIN_GAP_MS;
  return Math.max(API_FOOTBALL_MIN_GAP_MS,Math.ceil(60_000/observedMinuteLimit));
}

export function reservationDecision(state,{now,requiresAuthority=true,authority=null}={}){
  const at=iso(now);if(!at)return fail('timestamp_invalid');
  if(!state||state.provider!==API_FOOTBALL_PROVIDER)return fail('runtime_state_unavailable');
  if(state.collection_enabled!==1)return fail('collection_disabled');
  if(requiresAuthority){const valid=validateAuthority(authority,{now:at});if(!valid.ok)return valid;}
  const day=utcDay(at),newDay=state.quota_utc_day!==day;
  if(!newDay&&state.quota_state==='BLOCKED_429')return fail('quota_blocked_429');
  if(!newDay&&state.quota_state==='QUOTA_UNCERTAIN')return fail('quota_uncertain');
  const used=newDay?0:Number(state.daily_attempt_count||0);
  if(used>=API_FOOTBALL_DAILY_REQUEST_LIMIT)return fail('daily_ceiling_reached');
  if(state.in_flight_attempt_id&&Date.parse(state.in_flight_lease_expires_at)>Date.parse(at))return fail('request_lease_busy');
  if(!newDay&&state.earliest_next_request_at&&Date.parse(state.earliest_next_request_at)>Date.parse(at))return fail('request_spacing');
  return Object.freeze({ok:true,utcDay:day,nextCount:used+1,probeRequired:newDay||state.quota_state==='UNOBSERVED'||state.quota_state==='PROBE_REQUIRED',leaseExpiresAt:new Date(Date.parse(at)+API_FOOTBALL_LEASE_MS).toISOString()});
}

export function normalizeQuotaTelemetry(headers){
  const result=normalizeApiFootballQuotaHeaders(headers);
  if(!result.ok||result.state!=='known')return fail('quota_headers_uncertain');
  if(result.requestsLimit!==null&&result.requestsRemaining!==null&&result.requestsRemaining>result.requestsLimit)return fail('quota_headers_uncertain');
  if(result.rateLimit!==null&&result.remaining!==null&&result.remaining>result.rateLimit)return fail('quota_headers_uncertain');
  return Object.freeze({ok:true,dailyLimit:result.requestsLimit,dailyRemaining:result.requestsRemaining,minuteLimit:result.rateLimit,minuteRemaining:result.remaining,headerNames:API_FOOTBALL_QUOTA_HEADER_NAMES});
}

export function classifyCompletion({status,headers,timedOut=false,transportUnknown=false,now}={}){
  const at=iso(now);if(!at)return fail('timestamp_invalid');
  if(timedOut)return Object.freeze({ok:true,outcome:'TIMEOUT',timeout:1,quotaState:'QUOTA_UNCERTAIN'});
  if(transportUnknown)return Object.freeze({ok:true,outcome:'TRANSPORT_UNKNOWN',timeout:0,quotaState:'QUOTA_UNCERTAIN'});
  if(status===429)return Object.freeze({ok:true,outcome:'QUOTA_BLOCKED',timeout:0,quotaState:'BLOCKED_429',last429At:at});
  const quota=normalizeQuotaTelemetry(headers);
  if(!quota.ok)return Object.freeze({ok:true,outcome:Number(status)>=200&&Number(status)<300?'SUCCEEDED':'HTTP_FAILURE',timeout:0,quotaState:'QUOTA_UNCERTAIN'});
  return Object.freeze({ok:true,outcome:Number(status)>=200&&Number(status)<300?'SUCCEEDED':'HTTP_FAILURE',timeout:0,quotaState:'KNOWN',quota});
}

export async function readBoundedJson(response,{maxBytes=API_FOOTBALL_MAX_RESPONSE_BYTES,maxRows=API_FOOTBALL_MAX_ROWS}={}){
  if(!Number.isInteger(maxBytes)||maxBytes<1)return fail('response_limit_unqualified');
  const declared=Number(response?.headers?.get?.('content-length'));
  if(Number.isFinite(declared)&&declared>maxBytes)return fail('provider_response_too_large');
  if(!response?.body?.getReader)return fail('provider_body_unreadable');
  const reader=response.body.getReader(),chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();return fail('provider_response_too_large');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  let payload;try{payload=JSON.parse(new TextDecoder().decode(bytes));}catch{return fail('provider_schema_invalid');}
  if(!Array.isArray(payload?.response)||payload.response.length>maxRows)return fail(payload?.response?.length>maxRows?'provider_row_limit_exceeded':'provider_schema_invalid');
  return Object.freeze({ok:true,payload});
}
