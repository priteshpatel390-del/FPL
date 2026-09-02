import {inspectE2ValidationPlan} from './e2-d1-rest-validation-plan.mjs';

export const E2_LIVE_RESPONSE_CLASS=Object.freeze({SUCCESS:'success',SQL_FAILURE:'known_sql_provider_failure',UNKNOWN:'mutation_outcome_unknown',MALFORMED:'malformed_provider_response',RATE:'rate_limited',AUTH:'auth_failure',TRANSPORT:'transport_failure'});
export const E2_PRE_MUTATION_DIAGNOSTIC_STAGE=Object.freeze(['metadata','initial_schema']);
export const E2_PRE_MUTATION_DIAGNOSTIC_REASON=Object.freeze(['success','transport_exception','http_status','json_parse','malformed_envelope','top_level_failure','result_count','result_success','unsuccessful_result','invalid_results','malformed_meta','identity_mismatch']);
const DIAGNOSTIC_KEYS=Object.freeze(['stage','reason','classification','httpStatus','jsonParsed','topLevelSuccessPresent','topLevelSuccessValue','expectedResultCount','observedResultCount','missingOrNonBooleanSuccessCount','unsuccessfulResultCount','invalidResultsCount','malformedMetaCount','firstFailingResultIndex']);
const bounded=(value,max=1000000)=>Number.isSafeInteger(value)&&value>=0&&value<=max?value:null;
const timing=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=600000?value:null;
const malformed=()=>Object.freeze({classification:E2_LIVE_RESPONSE_CLASS.MALFORMED,rowsByStatement:[],rowsRead:null,rowsWritten:null,changes:null,providerTimingMs:null,totalAttempts:null,completionChanges:null});
const statusOf=response=>{const value=Number(response?.status);return Number.isInteger(value)&&value>=100&&value<=599?value:null;};
const diagnostic=(stage,expectedResultCount,values={})=>Object.freeze({stage,reason:values.reason??'malformed_envelope',classification:values.classification??E2_LIVE_RESPONSE_CLASS.MALFORMED,httpStatus:values.httpStatus??null,jsonParsed:values.jsonParsed??false,topLevelSuccessPresent:values.topLevelSuccessPresent??false,topLevelSuccessValue:values.topLevelSuccessValue??null,expectedResultCount,observedResultCount:values.observedResultCount??null,missingOrNonBooleanSuccessCount:values.missingOrNonBooleanSuccessCount??0,unsuccessfulResultCount:values.unsuccessfulResultCount??0,invalidResultsCount:values.invalidResultsCount??0,malformedMetaCount:values.malformedMetaCount??0,firstFailingResultIndex:values.firstFailingResultIndex??null});
export function validateE2PreMutationDiagnostic(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==DIAGNOSTIC_KEYS.length||!DIAGNOSTIC_KEYS.every(key=>Object.hasOwn(value,key)))throw new Error('e2_pre_mutation_diagnostic_invalid');
  if(!E2_PRE_MUTATION_DIAGNOSTIC_STAGE.includes(value.stage)||!E2_PRE_MUTATION_DIAGNOSTIC_REASON.includes(value.reason)||![E2_LIVE_RESPONSE_CLASS.SUCCESS,E2_LIVE_RESPONSE_CLASS.SQL_FAILURE,E2_LIVE_RESPONSE_CLASS.MALFORMED,E2_LIVE_RESPONSE_CLASS.RATE,E2_LIVE_RESPONSE_CLASS.AUTH,E2_LIVE_RESPONSE_CLASS.TRANSPORT].includes(value.classification))throw new Error('e2_pre_mutation_diagnostic_invalid');
  if(value.httpStatus!==null&&(bounded(value.httpStatus,599)===null||value.httpStatus<100)||typeof value.jsonParsed!=='boolean'||typeof value.topLevelSuccessPresent!=='boolean'||![true,false,null].includes(value.topLevelSuccessValue))throw new Error('e2_pre_mutation_diagnostic_invalid');
  for(const key of ['expectedResultCount','missingOrNonBooleanSuccessCount','unsuccessfulResultCount','invalidResultsCount','malformedMetaCount'])if(bounded(value[key],40)===null)throw new Error('e2_pre_mutation_diagnostic_invalid');
  if(value.observedResultCount!==null&&bounded(value.observedResultCount,40)===null)throw new Error('e2_pre_mutation_diagnostic_invalid');
  if(value.firstFailingResultIndex!==null&&bounded(value.firstFailingResultIndex,20)===null)throw new Error('e2_pre_mutation_diagnostic_invalid');
  return Object.freeze({...value});
}
const withDiagnostic=(result,value)=>Object.freeze({...result,preMutationDiagnostic:validateE2PreMutationDiagnostic(value)});
export const createE2TransportDiagnostic=stage=>validateE2PreMutationDiagnostic(diagnostic(stage,stage==='initial_schema'?21:1,{reason:'transport_exception',classification:E2_LIVE_RESPONSE_CLASS.TRANSPORT}));

export async function decodeE2QueryResponse(response,plan){
  const trusted=inspectE2ValidationPlan(plan);if(!trusted)throw new Error('e2_response_plan_untrusted');
  const expected=trusted.statements.length,stage=trusted.caseId==='SCHEMA-RECONCILE'?'initial_schema':null,status=statusOf(response),base={httpStatus:status};
  const finish=(result,values)=>stage?withDiagnostic(result,diagnostic(stage,expected,{...base,...values})):Object.freeze(result);
  if(status===401||status===403)return finish({...malformed(),classification:E2_LIVE_RESPONSE_CLASS.AUTH},{reason:'http_status',classification:E2_LIVE_RESPONSE_CLASS.AUTH});
  if(status===429)return finish({...malformed(),classification:E2_LIVE_RESPONSE_CLASS.RATE},{reason:'http_status',classification:E2_LIVE_RESPONSE_CLASS.RATE});
  if(status===null||status<200||status>=300){const classification=trusted.mutation?E2_LIVE_RESPONSE_CLASS.UNKNOWN:E2_LIVE_RESPONSE_CLASS.TRANSPORT;return finish({...malformed(),classification},{reason:'http_status',classification});}
  let payload;try{payload=await response.json();}catch{return finish(malformed(),{reason:'json_parse'});}
  const present=!!payload&&typeof payload==='object'&&!Array.isArray(payload)&&Object.hasOwn(payload,'success'),success=present&&typeof payload.success==='boolean'?payload.success:null,json={jsonParsed:true,topLevelSuccessPresent:present,topLevelSuccessValue:success};
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||typeof payload.success!=='boolean')return finish(malformed(),{...json,reason:'malformed_envelope'});
  if(payload.success===false)return finish(Array.isArray(payload.errors)&&payload.errors.length>0?{...malformed(),classification:E2_LIVE_RESPONSE_CLASS.SQL_FAILURE}:malformed(),{...json,reason:'top_level_failure',classification:Array.isArray(payload.errors)&&payload.errors.length>0?E2_LIVE_RESPONSE_CLASS.SQL_FAILURE:E2_LIVE_RESPONSE_CLASS.MALFORMED});
  if(!Array.isArray(payload.result)||payload.result.length!==expected)return finish(malformed(),{...json,reason:'result_count',observedResultCount:Array.isArray(payload.result)&&payload.result.length<=40?payload.result.length:null});
  const observedResultCount=payload.result.length,missing=payload.result.filter(item=>!item||typeof item!=='object'||typeof item.success!=='boolean'),unsuccessful=payload.result.filter(item=>item&&typeof item==='object'&&item.success===false),invalidResults=payload.result.filter(item=>item&&typeof item==='object'&&item.results!==undefined&&!Array.isArray(item.results)),badMeta=payload.result.filter(item=>item&&typeof item==='object'&&item.meta!==undefined&&(!item.meta||typeof item.meta!=='object'||Array.isArray(item.meta)||[['rows_read',1000000],['rows_written',1000000],['changes',1000000],['total_attempts',1000000]].some(([key,max])=>item.meta[key]!==undefined&&bounded(item.meta[key],max)===null)||(item.meta.duration!==undefined&&timing(item.meta.duration)===null)));
  const indexOf=item=>payload.result.indexOf(item),counts={...json,observedResultCount,missingOrNonBooleanSuccessCount:missing.length,unsuccessfulResultCount:unsuccessful.length,invalidResultsCount:invalidResults.length,malformedMetaCount:badMeta.length};
  if(missing.length)return finish(malformed(),{...counts,reason:'result_success',firstFailingResultIndex:indexOf(missing[0])});
  if(unsuccessful.length)return finish({...malformed(),classification:E2_LIVE_RESPONSE_CLASS.SQL_FAILURE},{...counts,reason:'unsuccessful_result',classification:E2_LIVE_RESPONSE_CLASS.SQL_FAILURE,firstFailingResultIndex:indexOf(unsuccessful[0])});
  if(invalidResults.length)return finish(malformed(),{...counts,reason:'invalid_results',firstFailingResultIndex:indexOf(invalidResults[0])});
  if(badMeta.length)return finish(malformed(),{...counts,reason:'malformed_meta',firstFailingResultIndex:indexOf(badMeta[0])});
  let rowsRead=null,rowsWritten=null,changes=null,providerTimingMs=null,totalAttempts=null;const rowsByStatement=[];const add=(current,value)=>current===null?value:current+value;
  for(const item of payload.result){rowsByStatement.push(item.results||[]);const meta=item.meta;if(meta!==undefined)for(const [key,target] of [['rows_read','rowsRead'],['rows_written','rowsWritten'],['changes','changes'],['total_attempts','totalAttempts']])if(meta[key]!==undefined){if(target==='rowsRead')rowsRead=add(rowsRead,meta[key]);else if(target==='rowsWritten')rowsWritten=add(rowsWritten,meta[key]);else if(target==='changes')changes=add(changes,meta[key]);else totalAttempts=add(totalAttempts,meta[key]);}if(meta?.duration!==undefined)providerTimingMs=add(providerTimingMs,meta.duration);}
  if([rowsRead,rowsWritten,changes,totalAttempts].some(value=>value!==null&&bounded(value)===null)||(providerTimingMs!==null&&timing(providerTimingMs)===null))return finish(malformed(),{...counts,reason:'malformed_meta',malformedMetaCount:1,firstFailingResultIndex:20});
  const lastMeta=payload.result.at(-1).meta,completionChanges=lastMeta&&bounded(lastMeta.changes),result={classification:E2_LIVE_RESPONSE_CLASS.SUCCESS,rowsByStatement:Object.freeze(rowsByStatement),rowsRead,rowsWritten,changes,providerTimingMs,totalAttempts,completionChanges};
  return finish(result,{...counts,reason:'success',classification:E2_LIVE_RESPONSE_CLASS.SUCCESS});
}

export const classifyE2TransportFailure=mutation=>Object.freeze({...malformed(),classification:mutation?E2_LIVE_RESPONSE_CLASS.UNKNOWN:E2_LIVE_RESPONSE_CLASS.TRANSPORT});

export async function decodeE2DatabaseMetadataResponse(response,{databaseId,databaseName}){
  const stage='metadata',expected=1,status=statusOf(response),finish=(result,values)=>withDiagnostic(result,diagnostic(stage,expected,{httpStatus:status,...values}));
  if(status===401||status===403)return finish({classification:E2_LIVE_RESPONSE_CLASS.AUTH},{reason:'http_status',classification:E2_LIVE_RESPONSE_CLASS.AUTH});if(status===429)return finish({classification:E2_LIVE_RESPONSE_CLASS.RATE},{reason:'http_status',classification:E2_LIVE_RESPONSE_CLASS.RATE});if(status===null||status<200||status>=300)return finish({classification:E2_LIVE_RESPONSE_CLASS.TRANSPORT},{reason:'http_status',classification:E2_LIVE_RESPONSE_CLASS.TRANSPORT});
  let payload;try{payload=await response.json();}catch{return finish({classification:E2_LIVE_RESPONSE_CLASS.MALFORMED},{reason:'json_parse'});}
  const present=!!payload&&typeof payload==='object'&&!Array.isArray(payload)&&Object.hasOwn(payload,'success'),success=present&&typeof payload.success==='boolean'?payload.success:null,json={jsonParsed:true,topLevelSuccessPresent:present,topLevelSuccessValue:success};
  const result=payload?.result;if(payload?.success!==true||!result||typeof result!=='object'||Array.isArray(result))return finish({classification:E2_LIVE_RESPONSE_CLASS.MALFORMED},{...json,reason:payload?.success===false?'top_level_failure':'malformed_envelope'});
  const returnedId=result.uuid??result.id;if(typeof returnedId!=='string'||typeof result.name!=='string'||returnedId!==databaseId||result.name!==databaseName||result.name==='teamsheet-data')return finish({classification:E2_LIVE_RESPONSE_CLASS.MALFORMED},{...json,reason:'identity_mismatch',observedResultCount:1});
  return finish({classification:E2_LIVE_RESPONSE_CLASS.SUCCESS},{...json,reason:'success',classification:E2_LIVE_RESPONSE_CLASS.SUCCESS,observedResultCount:1});
}
