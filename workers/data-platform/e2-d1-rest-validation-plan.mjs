/** Repository-only E2A synthetic plans. This module has no production execution path. */
import {createHash} from 'node:crypto';
import {D1_MAX_BATCH_STATEMENTS,D1_MAX_VALUE_BYTES} from './official-fpl-d1-rest-plan.mjs';

export const E2_REPRESENTATIVE_FACTS=9860;
/** Read-only limit-profile 100% target; this is not W01's serialized mutation size. */
export const E2_REPRESENTATIVE_REQUEST_BYTES=3688875;
export const E2_REPRESENTATIVE_STATEMENTS=24;
export const E2_W01_SERIALIZED_REQUEST_BYTES=2378752;
export const E2_SCHEMA_PHASES=Object.freeze(['initial','setup']);
export const E2_INITIAL_SCHEMA_REPRESENTATION=Object.freeze([]);
export const E2_SCHEMA_DDL=Object.freeze([
  'CREATE TABLE e2_atomicity (run_id TEXT NOT NULL, sequence_no INTEGER NOT NULL, marker TEXT NOT NULL, valid_value INTEGER NOT NULL CHECK (valid_value IN (0, 1)), PRIMARY KEY (run_id, sequence_no), UNIQUE (run_id, marker))',
  "CREATE TABLE e2_entities (entity_id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('event', 'team', 'player', 'fixture')), created_at TEXT NOT NULL)",
  'CREATE TABLE e2_observations (observation_id TEXT PRIMARY KEY, logical_key TEXT NOT NULL UNIQUE, value_number REAL, value_text TEXT, value_boolean INTEGER CHECK (value_boolean IS NULL OR value_boolean IN (0, 1)))',
  'CREATE TABLE e2_heads (logical_key TEXT PRIMARY KEY, observation_id TEXT NOT NULL, FOREIGN KEY (observation_id) REFERENCES e2_observations(observation_id))',
  "CREATE TABLE e2_runs (run_id TEXT PRIMARY KEY, status TEXT NOT NULL CHECK (status IN ('started', 'completed')), records_accepted INTEGER NOT NULL DEFAULT 0 CHECK (records_accepted >= 0))"
]);
export const canonicalE2SchemaRepresentation=schema=>JSON.stringify(schema);
export const deriveE2SchemaFingerprint=schema=>`sha256:${createHash('sha256').update(canonicalE2SchemaRepresentation(schema)).digest('hex')}`;
export const E2_INITIAL_SCHEMA_FINGERPRINT=deriveE2SchemaFingerprint(E2_INITIAL_SCHEMA_REPRESENTATION);
export const E2_SETUP_SCHEMA_FINGERPRINT=deriveE2SchemaFingerprint(E2_SCHEMA_DDL);
export const E2_SCHEMA_FINGERPRINT=E2_SETUP_SCHEMA_FINGERPRINT;
export const E2_APPROVED_TABLES=Object.freeze(['e2_atomicity','e2_entities','e2_observations','e2_heads','e2_runs']);
export const E2_ATOMICITY_RUN_IDS=Object.freeze({A01:'e2-run-a01',A02:'e2-run-a02',A03:'e2-run-a03'});

const plans=new WeakSet();
const encoder=new TextEncoder();
const freezePlan=(caseId,mutation,statements,metadata={})=>{
  if(!Array.isArray(statements)||statements.length<1||statements.length>D1_MAX_BATCH_STATEMENTS)throw new Error('e2_statement_count_invalid');
  const safe=statements.map(({sql,params=[]})=>Object.freeze({sql,params:Object.freeze(params.map(value=>{
    if(typeof value!=='string')throw new Error('e2_parameter_not_string');
    if(encoder.encode(value).byteLength>D1_MAX_VALUE_BYTES)throw new Error('e2_parameter_too_large');
    return value;
  }))}));
  const plan=Object.freeze({caseId,mutation,...metadata,statements:Object.freeze(safe)});plans.add(plan);return plan;
};
export const inspectE2ValidationPlan=plan=>plans.has(plan)?plan:null;
export const buildSyntheticSchemaSetupPlan=()=>freezePlan('F-SCHEMA-SETUP',true,E2_SCHEMA_DDL.map(sql=>({sql,params:[]})),{phase:'setup',schemaFingerprint:E2_SETUP_SCHEMA_FINGERPRINT});
const insert=(runId,sequence,marker,valid=1)=>({sql:'INSERT INTO e2_atomicity (run_id, sequence_no, marker, valid_value) VALUES (?, ?, ?, ?)',params:[runId,String(sequence),marker,String(valid)]});
export function buildAtomicityCase(caseId){
  const runId=E2_ATOMICITY_RUN_IDS[caseId];if(!runId)throw new Error('e2_atomicity_case_invalid');
  const middle=caseId==='A02'?insert(runId,2,'a02-runtime-failure',2):caseId==='A03'?{sql:'E2_INTENTIONALLY INVALID SQL',params:[]}:insert(runId,2,'a01-middle');
  return freezePlan(caseId,true,[insert(runId,1,`${caseId.toLowerCase()}-first`),middle,insert(runId,3,`${caseId.toLowerCase()}-last`)],{runId});
}
export function buildAtomicityReconciliation(caseId){
  const runId=E2_ATOMICITY_RUN_IDS[caseId];if(!runId)throw new Error('e2_reconciliation_case_invalid');
  return freezePlan(`A04-${caseId}`,false,[{sql:'SELECT sequence_no, marker FROM e2_atomicity WHERE run_id=? ORDER BY sequence_no',params:[runId]}],{runId});
}
export function classifyAtomicityRows(rows){
  if(!Array.isArray(rows))return 'AMBIGUOUS';const seq=rows.map(row=>Number(row.sequence_no));
  if(seq.length===0)return 'FULL_ROLLBACK';if(seq.length===3&&seq.join(',')==='1,2,3')return 'COMPLETE_SUCCESS';
  if(seq.every(value=>[1,2,3].includes(value))&&new Set(seq).size===seq.length)return 'PARTIAL_WRITE';return 'AMBIGUOUS';
}
export function buildAffinityPlan(){
  const direct=['42','3.125','0042','0','1','2026-09-01T12:34:56.000Z','{"safe":true}','true','false'];
  const mixed=JSON.stringify([{kind:'integer',value:42},{kind:'real',value:3.125},{kind:'string',value:'0042'},{kind:'boolean',value:true},{kind:'null',value:null}]);
  return freezePlan('P01-P07',false,[
    ...direct.map(value=>({sql:'SELECT typeof(?) AS bound_type, ? AS exact_value, CAST(? AS NUMERIC) AS numeric_value, typeof(CAST(? AS NUMERIC)) AS numeric_type, (? COLLATE BINARY = ?) AS text_equal, (CAST(? AS NUMERIC) = CAST(? AS NUMERIC)) AS numeric_equal',params:[value,value,value,value,value,value,value,value]})),
    {sql:'SELECT ? AS left_value, ? AS right_value, (? COLLATE BINARY < ?) AS text_order, (CAST(? AS NUMERIC) < CAST(? AS NUMERIC)) AS numeric_order',params:['0042','42','0042','42','0042','42']},
    {sql:"SELECT json_extract(value,'$.kind') AS kind, json_type(value,'$.value') AS json_value_type, typeof(json_extract(value,'$.value')) AS sqlite_value_type, json_extract(value,'$.value') AS exact_value FROM json_each(?) ORDER BY key",params:[mixed]}
  ]);
}
export function buildStorageAffinityMutation(){return freezePlan('P-STORAGE-WRITE',true,[{sql:"INSERT INTO e2_observations (observation_id,logical_key,value_number,value_text,value_boolean) VALUES ('e2-affinity-42','e2|affinity|42',?,?,NULL),('e2-affinity-0042','e2|affinity|0042',?,?,NULL)",params:['42','42','0042','0042']}]);}
export function buildStorageAffinityReconciliation(){return freezePlan('P-STORAGE-READ',false,[{sql:"SELECT observation_id,typeof(value_number) AS number_type,value_number,typeof(value_text) AS text_type,value_text FROM e2_observations WHERE logical_key LIKE 'e2|affinity|%' ORDER BY logical_key COLLATE BINARY",params:[]}]);}
export function buildSchemaInspectionPlan(){
  const statements=[{sql:"SELECT type,name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name",params:[]}];
  for(const table of E2_APPROVED_TABLES){
    statements.push({sql:'SELECT cid,name,type,notnull,dflt_value,pk,hidden FROM pragma_table_xinfo(?) ORDER BY cid',params:[table]});
    statements.push({sql:'SELECT seq,name,"unique",origin,partial FROM pragma_index_list(?) ORDER BY seq',params:[table]});
    statements.push({sql:'SELECT il.name AS index_name,xi.seqno,xi.cid,xi.name,xi.desc,xi.coll,xi.key FROM pragma_index_list(?) il JOIN pragma_index_xinfo(il.name) xi WHERE xi.key=1 ORDER BY il.name,xi.seqno',params:[table]});
    statements.push({sql:'SELECT id,seq,"table","from","to",on_update,on_delete,match FROM pragma_foreign_key_list(?) ORDER BY id,seq',params:[table]});
  }
  return freezePlan('SCHEMA-RECONCILE',false,statements,{tables:E2_APPROVED_TABLES});
}
export function buildLargeJsonAffinityPlan(length=1990000){const value=JSON.stringify({payload:'x'.repeat(length-14)});return freezePlan('P08',false,[{sql:'SELECT length(?) AS parameter_length',params:[value]}]);}
export function buildStatementProfile(count){return freezePlan(`L-${count}`,false,Array.from({length:count},(_,i)=>({sql:'SELECT ? AS sequence_no',params:[String(i+1)]})));}
const body=plan=>JSON.stringify(plan.statements.length===1?plan.statements[0]:{batch:plan.statements});
export const serializedBodyBytes=plan=>encoder.encode(body(inspectE2ValidationPlan(plan)||(()=>{throw new Error('e2_plan_untrusted');})())).byteLength;
export function buildBodySizeProfile(targetBytes){
  if(!Number.isSafeInteger(targetBytes)||targetBytes<100||targetBytes>5*1024*1024)throw new Error('e2_body_target_invalid');
  const count=Math.ceil(targetBytes/1900000);let totalPadding=targetBytes-count*100;
  for(let attempt=0;attempt<4;attempt++){
    const sizes=Array.from({length:count},(_,i)=>Math.floor(totalPadding/count)+(i<totalPadding%count?1:0));
    const plan=freezePlan(`L-body-${targetBytes}`,false,sizes.map((size,i)=>({sql:'SELECT length(?) AS payload_length, ? AS profile_part',params:['x'.repeat(size),String(i+1)]})));
    const delta=targetBytes-serializedBodyBytes(plan);if(delta===0)return plan;totalPadding+=delta;
  }
  throw new Error('e2_body_target_unreachable');
}
export const E2_BODY_PROFILE_TARGETS=Object.freeze([.25,.5,.75,1,1.25].map(ratio=>Math.round(E2_REPRESENTATIVE_REQUEST_BYTES*ratio)));
export function buildFullWriteRunStart(){return freezePlan('W00',true,[{sql:"INSERT INTO e2_runs (run_id,status,records_accepted) VALUES (?,'started',?)",params:['e2-run-full-write','0']}]);}
export function buildFullWriteRunStartReconciliation(){return freezePlan('W00-R',false,[{sql:'SELECT run_id,status,records_accepted FROM e2_runs WHERE run_id=?',params:['e2-run-full-write']}]);}
export function reconcileFullWriteRunStart(rows){return Array.isArray(rows)&&rows.length===1&&rows[0]?.run_id==='e2-run-full-write'&&rows[0]?.status==='started'&&Number(rows[0]?.records_accepted)===0;}
export function buildFullWriteReconciliation(){return freezePlan('W01-R',false,[{sql:"SELECT (SELECT count(*) FROM e2_entities) AS entities,(SELECT count(*) FROM e2_observations) AS observations,(SELECT count(*) FROM e2_heads) AS heads,(SELECT count(*) FROM e2_heads h LEFT JOIN e2_observations o ON o.observation_id=h.observation_id WHERE o.observation_id IS NULL) AS orphan_heads,(SELECT count(*) FROM e2_runs WHERE run_id='e2-run-full-write') AS run_rows,(SELECT status FROM e2_runs WHERE run_id='e2-run-full-write') AS run_status,(SELECT records_accepted FROM e2_runs WHERE run_id='e2-run-full-write') AS records_accepted",params:[]}]);}
export function reconcileFullWrite(rows,completionChanges){const row=Array.isArray(rows)&&rows.length===1?rows[0]:null;return Number(completionChanges)===1&&Number(row?.entities)===1064&&Number(row?.observations)===E2_REPRESENTATIVE_FACTS&&Number(row?.heads)===E2_REPRESENTATIVE_FACTS&&Number(row?.orphan_heads)===0&&Number(row?.run_rows)===1&&row?.run_status==='completed'&&Number(row?.records_accepted)===E2_REPRESENTATIVE_FACTS;}
export function buildSyntheticFullWriteAnalogue(){
  const entities=Array.from({length:1064},(_,i)=>({entity_id:`e2-entity-${String(i).padStart(4,'0')}`,kind:['event','team','player','fixture'][i%4],created_at:'2026-09-01T00:00:00.000Z'}));
  const observations=Array.from({length:E2_REPRESENTATIVE_FACTS},(_,i)=>({observation_id:`e2-observation-${String(i).padStart(5,'0')}`,logical_key:`e2|fact|${String(i).padStart(5,'0')}`,value_number:i%3===0?i/10:null,value_text:i%3===1?`synthetic-${i}`:null,value_boolean:i%3===2?i%2===0:null}));
  const statements=[{sql:"INSERT INTO e2_entities SELECT json_extract(value,'$.entity_id'),json_extract(value,'$.kind'),json_extract(value,'$.created_at') FROM json_each(?)",params:[JSON.stringify(entities)]}];
  for(let i=0;i<observations.length;i+=600)statements.push({sql:"INSERT INTO e2_observations SELECT json_extract(value,'$.observation_id'),json_extract(value,'$.logical_key'),json_extract(value,'$.value_number'),json_extract(value,'$.value_text'),json_extract(value,'$.value_boolean') FROM json_each(?)",params:[JSON.stringify(observations.slice(i,i+600))]});
  const heads=observations.map(row=>({logical_key:row.logical_key,observation_id:row.observation_id}));
  for(let i=0;i<heads.length;i+=2000)statements.push({sql:"INSERT INTO e2_heads SELECT json_extract(value,'$.logical_key'),json_extract(value,'$.observation_id') FROM json_each(?) ON CONFLICT(logical_key) DO UPDATE SET observation_id=excluded.observation_id",params:[JSON.stringify(heads.slice(i,i+2000))]});
  statements.push({sql:"UPDATE e2_runs SET status='completed', records_accepted=? WHERE run_id=?",params:[String(E2_REPRESENTATIVE_FACTS),'e2-run-full-write']});return freezePlan('W01',true,statements);
}
