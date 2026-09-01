/** Repository-only E2A synthetic plans. This module has no production execution path. */
import {D1_MAX_BATCH_STATEMENTS,D1_MAX_VALUE_BYTES} from './official-fpl-d1-rest-plan.mjs';

export const E2_REPRESENTATIVE_FACTS=9860;
export const E2_REPRESENTATIVE_REQUEST_BYTES=3688875;
export const E2_REPRESENTATIVE_STATEMENTS=24;
export const E2_SCHEMA_FINGERPRINT='e2-rest-validation-schema-v1';
export const E2_APPROVED_TABLES=Object.freeze(['e2_atomicity','e2_entities','e2_observations','e2_heads','e2_runs']);
const plans=new WeakSet();
const encoder=new TextEncoder();
const freezePlan=(caseId,mutation,statements)=>{
  if(!Array.isArray(statements)||statements.length<1||statements.length>D1_MAX_BATCH_STATEMENTS)throw new Error('e2_statement_count_invalid');
  const safe=statements.map(({sql,params=[]})=>Object.freeze({sql,params:Object.freeze(params.map(value=>{if(typeof value!=='string')throw new Error('e2_parameter_not_string');if(encoder.encode(value).byteLength>D1_MAX_VALUE_BYTES)throw new Error('e2_parameter_too_large');return value;}))}));
  const plan=Object.freeze({caseId,mutation,statements:Object.freeze(safe)});plans.add(plan);return plan;
};
export const inspectE2ValidationPlan=plan=>plans.has(plan)?plan:null;
const insert=(sequence,marker,valid=1)=>({sql:'INSERT INTO e2_atomicity (run_id, sequence_no, marker, valid_value) VALUES (?, ?, ?, ?)',params:['e2-run-atomicity',String(sequence),marker,String(valid)]});
export function buildAtomicityCase(caseId){
  if(caseId==='A01')return freezePlan(caseId,true,[insert(1,'a01-first'),insert(2,'a01-middle'),insert(3,'a01-last')]);
  if(caseId==='A02')return freezePlan(caseId,true,[insert(1,'a02-first'),insert(2,'a02-runtime-failure',2),insert(3,'a02-last')]);
  if(caseId==='A03')return freezePlan(caseId,true,[insert(1,'a03-first'),{sql:'E2_INTENTIONALLY INVALID SQL',params:[]},insert(3,'a03-last')]);
  throw new Error('e2_atomicity_case_invalid');
}
export const buildAtomicityReconciliation=({runId='e2-run-atomicity'}={})=>freezePlan('A04',false,[{sql:'SELECT sequence_no, marker FROM e2_atomicity WHERE run_id=? ORDER BY sequence_no',params:[runId]}]);
export function classifyAtomicityRows(rows){
  if(!Array.isArray(rows))return 'AMBIGUOUS';const seq=rows.map(row=>Number(row.sequence_no));
  if(seq.length===0)return 'FULL_ROLLBACK';if(seq.length===3&&seq.join(',')==='1,2,3')return 'COMPLETE_SUCCESS';
  if(seq.every(value=>[1,2,3].includes(value))&&new Set(seq).size===seq.length)return 'PARTIAL_WRITE';return 'AMBIGUOUS';
}
export function buildAffinityPlan(){
  const direct=['42','3.125','0042','0','1','2026-09-01T12:34:56.000Z','{"safe":true}','true','false'];
  const mixed=JSON.stringify([{kind:'integer',value:42},{kind:'real',value:3.125},{kind:'string',value:'0042'},{kind:'boolean',value:true},{kind:'null',value:null}]);
  return freezePlan('P01-P07',false,[
    ...direct.map((value,index)=>({sql:'SELECT typeof(?) AS bound_type, ? AS exact_value, CAST(? AS NUMERIC) AS numeric_value',params:[value,value,value]})),
    {sql:"SELECT json_extract(value,'$.kind') AS kind, typeof(json_extract(value,'$.value')) AS value_type, json_extract(value,'$.value') AS exact_value FROM json_each(?) ORDER BY key",params:[mixed]}
  ]);
}
export function buildLargeJsonAffinityPlan(length=1990000){const value=JSON.stringify({payload:'x'.repeat(length-14)});return freezePlan('P08',false,[{sql:'SELECT length(?) AS parameter_length',params:[value]}]);}
export function buildStatementProfile(count){return freezePlan(`L-${count}`,false,Array.from({length:count},(_,i)=>({sql:'SELECT ? AS sequence_no',params:[String(i+1)]})));}
const body=plan=>JSON.stringify(plan.statements.length===1?plan.statements[0]:{batch:plan.statements});
export const serializedBodyBytes=plan=>encoder.encode(body(inspectE2ValidationPlan(plan)||(()=>{throw new Error('e2_plan_untrusted');})())).byteLength;
export function buildBodySizeProfile(targetBytes){
  if(!Number.isSafeInteger(targetBytes)||targetBytes<100||targetBytes>5*1024*1024)throw new Error('e2_body_target_invalid');
  const count=Math.ceil(targetBytes/1900000);let totalPadding=targetBytes-count*100;let plan;
  for(let attempt=0;attempt<4;attempt++){
    const sizes=Array.from({length:count},(_,i)=>Math.floor(totalPadding/count)+(i<totalPadding%count?1:0));
    plan=freezePlan(`L-body-${targetBytes}`,false,sizes.map((size,i)=>({sql:'SELECT length(?) AS payload_length, ? AS profile_part',params:['x'.repeat(size),String(i+1)]})));
    const delta=targetBytes-serializedBodyBytes(plan);if(delta===0)return plan;totalPadding+=delta;
  }
  throw new Error('e2_body_target_unreachable');
}
export const E2_BODY_PROFILE_TARGETS=Object.freeze([.25,.5,.75,1,1.25].map(ratio=>Math.round(E2_REPRESENTATIVE_REQUEST_BYTES*ratio)));
export function buildSyntheticFullWriteAnalogue(){
  const entities=Array.from({length:1064},(_,i)=>({entity_id:`e2-entity-${String(i).padStart(4,'0')}`,kind:['event','team','player','fixture'][i%4],created_at:'2026-09-01T00:00:00.000Z'}));
  const observations=Array.from({length:E2_REPRESENTATIVE_FACTS},(_,i)=>({observation_id:`e2-observation-${String(i).padStart(5,'0')}`,logical_key:`e2|fact|${String(i).padStart(5,'0')}`,value_number:i%7===0?null:String(i%1000),value_text:i%7===0?`synthetic-${i}`:null,value_boolean:i%11===0?String(i%2):null}));
  const statements=[{sql:"INSERT INTO e2_entities SELECT json_extract(value,'$.entity_id'),json_extract(value,'$.kind'),json_extract(value,'$.created_at') FROM json_each(?)",params:[JSON.stringify(entities)]}];
  for(let i=0;i<observations.length;i+=600)statements.push({sql:"INSERT INTO e2_observations SELECT json_extract(value,'$.observation_id'),json_extract(value,'$.logical_key'),json_extract(value,'$.value_number'),json_extract(value,'$.value_text'),json_extract(value,'$.value_boolean') FROM json_each(?)",params:[JSON.stringify(observations.slice(i,i+600))]});
  const heads=observations.map(row=>({logical_key:row.logical_key,observation_id:row.observation_id}));for(let i=0;i<heads.length;i+=2000)statements.push({sql:"INSERT INTO e2_heads SELECT json_extract(value,'$.logical_key'),json_extract(value,'$.observation_id') FROM json_each(?) ON CONFLICT(logical_key) DO UPDATE SET observation_id=excluded.observation_id",params:[JSON.stringify(heads.slice(i,i+2000))]});
  statements.push({sql:"UPDATE e2_runs SET status='completed', records_accepted=? WHERE run_id=?",params:[String(E2_REPRESENTATIVE_FACTS),'e2-run-full-write']});return freezePlan('W01',true,statements);
}
