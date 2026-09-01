import {inspectE2ValidationPlan} from './e2-d1-rest-validation-plan.mjs';

export const E2_LIVE_RESPONSE_CLASS=Object.freeze({SUCCESS:'success',SQL_FAILURE:'known_sql_provider_failure',UNKNOWN:'mutation_outcome_unknown',MALFORMED:'malformed_provider_response',RATE:'rate_limited',AUTH:'auth_failure',TRANSPORT:'transport_failure'});
const bounded=(value,max=1000000)=>Number.isSafeInteger(value)&&value>=0&&value<=max?value:null;
const timing=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=600000?value:null;
const malformed=()=>Object.freeze({classification:E2_LIVE_RESPONSE_CLASS.MALFORMED,rowsByStatement:[],rowsRead:0,rowsWritten:0,changes:0,providerTimingMs:0,completionChanges:null});

export async function decodeE2QueryResponse(response,plan){
  const trusted=inspectE2ValidationPlan(plan);if(!trusted)throw new Error('e2_response_plan_untrusted');
  const status=Number(response?.status);if(status===401||status===403)return {...malformed(),classification:E2_LIVE_RESPONSE_CLASS.AUTH};if(status===429)return {...malformed(),classification:E2_LIVE_RESPONSE_CLASS.RATE};if(!Number.isInteger(status)||status<200||status>=300)return {...malformed(),classification:trusted.mutation?E2_LIVE_RESPONSE_CLASS.UNKNOWN:E2_LIVE_RESPONSE_CLASS.TRANSPORT};
  let payload;try{payload=await response.json();}catch{return malformed();}
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||typeof payload.success!=='boolean')return malformed();
  if(payload.success===false)return Array.isArray(payload.errors)&&payload.errors.length>0?{...malformed(),classification:E2_LIVE_RESPONSE_CLASS.SQL_FAILURE}:malformed();
  if(!Array.isArray(payload.result)||payload.result.length!==trusted.statements.length)return malformed();
  if(payload.result.some(item=>!item||typeof item!=='object'||typeof item.success!=='boolean'))return malformed();
  if(payload.result.some(item=>item.success===false))return {...malformed(),classification:E2_LIVE_RESPONSE_CLASS.SQL_FAILURE};
  let rowsRead=0,rowsWritten=0,changes=0,providerTimingMs=0;const rowsByStatement=[];
  for(const item of payload.result){if(item.results!==undefined&&!Array.isArray(item.results))return malformed();rowsByStatement.push(item.results||[]);const meta=item.meta;if(meta!==undefined){if(!meta||typeof meta!=='object'||Array.isArray(meta))return malformed();for(const [key,target] of [['rows_read','rowsRead'],['rows_written','rowsWritten'],['changes','changes']]){if(meta[key]!==undefined&&bounded(meta[key])===null)return malformed();if(target==='rowsRead')rowsRead+=meta[key]||0;else if(target==='rowsWritten')rowsWritten+=meta[key]||0;else changes+=meta[key]||0;}if(meta.duration!==undefined&&timing(meta.duration)===null)return malformed();providerTimingMs+=meta.duration||0;}}
  if([rowsRead,rowsWritten,changes].some(value=>bounded(value)===null)||timing(providerTimingMs)===null)return malformed();
  const lastMeta=payload.result.at(-1).meta,completionChanges=lastMeta&&bounded(lastMeta.changes);
  return Object.freeze({classification:E2_LIVE_RESPONSE_CLASS.SUCCESS,rowsByStatement:Object.freeze(rowsByStatement),rowsRead,rowsWritten,changes,providerTimingMs,completionChanges});
}

export const classifyE2TransportFailure=mutation=>Object.freeze({...malformed(),classification:mutation?E2_LIVE_RESPONSE_CLASS.UNKNOWN:E2_LIVE_RESPONSE_CLASS.TRANSPORT});

export async function decodeE2DatabaseMetadataResponse(response,{databaseId,databaseName}){
  const status=Number(response?.status);if(status===401||status===403)return Object.freeze({classification:E2_LIVE_RESPONSE_CLASS.AUTH});if(status===429)return Object.freeze({classification:E2_LIVE_RESPONSE_CLASS.RATE});if(!Number.isInteger(status)||status<200||status>=300)return Object.freeze({classification:E2_LIVE_RESPONSE_CLASS.TRANSPORT});
  let payload;try{payload=await response.json();}catch{return Object.freeze({classification:E2_LIVE_RESPONSE_CLASS.MALFORMED});}
  const result=payload?.result;if(payload?.success!==true||!result||typeof result!=='object'||Array.isArray(result))return Object.freeze({classification:E2_LIVE_RESPONSE_CLASS.MALFORMED});
  const returnedId=result.uuid??result.id;if(typeof returnedId!=='string'||typeof result.name!=='string')return Object.freeze({classification:E2_LIVE_RESPONSE_CLASS.MALFORMED});
  if(returnedId!==databaseId||result.name!==databaseName||result.name==='teamsheet-data')return Object.freeze({classification:E2_LIVE_RESPONSE_CLASS.MALFORMED});
  return Object.freeze({classification:E2_LIVE_RESPONSE_CLASS.SUCCESS});
}
