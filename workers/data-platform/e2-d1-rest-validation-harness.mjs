import {createHash} from 'node:crypto';
import {inspectE2ValidationPlan,E2_APPROVED_TABLES,E2_INITIAL_SCHEMA_FINGERPRINT,E2_SCHEMA_PHASES,E2_SETUP_SCHEMA_FINGERPRINT,serializedBodyBytes} from './e2-d1-rest-validation-plan.mjs';

const DB_NAME=/^teamsheet-data-e2-rest-validation-\d{8}-[a-z0-9]{6}$/;
const PROD_TABLES=new Set(['shadow_observations','observation_heads','canonical_entities','ingestion_runs','data_sources','data_source_revisions']);
const CLASS=Object.freeze({SUCCESS:'success',SQL_FAILURE:'known_sql_provider_failure',UNKNOWN:'mutation_outcome_unknown',MALFORMED:'malformed_provider_response',RATE:'rate_limited',AUTH:'auth_failure',TRANSPORT:'transport_failure'});
const trustedFakeTransports=new WeakSet();
export class E2ValidationError extends Error{constructor(code){super(code);this.name='E2ValidationError';this.code=code;}}
const fail=code=>{throw new E2ValidationError(code);};
const mask=value=>`sha256:${createHash('sha256').update(value).digest('hex').slice(0,12)}`;

export function createE2FakeTransport(spec){
  if(!spec||Object.keys(spec).some(key=>!['kind','status','payload'].includes(key))||!['response','malformed_json','throw'].includes(spec.kind))fail('e2_fake_transport_invalid');
  let transport;
  if(spec.kind==='throw')transport=async()=>{throw new Error('e2_synthetic_transport_failure');};
  else if(spec.kind==='malformed_json')transport=async()=>Object.freeze({status:Number(spec.status??200),json:async()=>{throw new Error('e2_synthetic_malformed_json');}});
  else{
    if(!Number.isInteger(spec.status))fail('e2_fake_transport_invalid');
    const payload=structuredClone(spec.payload);
    transport=async()=>Object.freeze({status:spec.status,json:async()=>structuredClone(payload)});
  }
  trustedFakeTransports.add(transport);return Object.freeze(transport);
}

export function validateDisposableIdentity(value){
  if(!value||Object.keys(value).some(key=>!['accountFingerprint','approvedAccountFingerprint','productionAccountFingerprint','databaseName','databaseFingerprint','expectedDatabaseFingerprint','schemaFingerprint','tables','phase'].includes(key)))fail('e2_identity_invalid');
  const {accountFingerprint,approvedAccountFingerprint,productionAccountFingerprint,databaseName,databaseFingerprint,expectedDatabaseFingerprint,schemaFingerprint,tables,phase='initial'}=value;
  if(!accountFingerprint||!approvedAccountFingerprint||accountFingerprint!==approvedAccountFingerprint)fail('e2_account_fingerprint_mismatch');
  if(productionAccountFingerprint&&accountFingerprint===productionAccountFingerprint)fail('e2_production_account_rejected');
  if(databaseName==='teamsheet-data'||!DB_NAME.test(databaseName||''))fail('e2_database_name_rejected');
  if(!databaseFingerprint||!expectedDatabaseFingerprint||databaseFingerprint!==expectedDatabaseFingerprint)fail('e2_database_fingerprint_mismatch');
  if(!E2_SCHEMA_PHASES.includes(phase))fail('e2_schema_phase_invalid');
  if(!Array.isArray(tables)||tables.some(table=>typeof table!=='string'||!table))fail('e2_schema_tables_invalid');
  if(tables.some(table=>PROD_TABLES.has(table)))fail('e2_production_schema_rejected');
  if(phase==='initial'){
    if(tables.length)fail('e2_initial_schema_not_empty');
    if(schemaFingerprint!==E2_INITIAL_SCHEMA_FINGERPRINT)fail('e2_initial_schema_fingerprint_mismatch');
  }else{
    if(schemaFingerprint!==E2_SETUP_SCHEMA_FINGERPRINT)fail('e2_setup_schema_fingerprint_mismatch');
    const observed=new Set(tables);
    if(observed.size!==tables.length||observed.size!==E2_APPROVED_TABLES.length||E2_APPROVED_TABLES.some(table=>!observed.has(table)))fail('e2_setup_schema_tables_mismatch');
  }
  return Object.freeze({databaseName,accountMask:mask(accountFingerprint),databaseMask:mask(databaseFingerprint),schemaFingerprint});
}

const statementContract=payload=>{
  if(!payload||payload.success!==true||!Array.isArray(payload.result))return null;
  if(payload.result.some(result=>!result||typeof result!=='object'||typeof result.success!=='boolean'))return null;
  return payload.result;
};
export function createE2ValidationHarness(options={}){
  if(!options||Object.keys(options).some(key=>!['transport','identity'].includes(key))||!trustedFakeTransports.has(options.transport))fail('e2_trusted_fake_transport_required');
  const identity=validateDisposableIdentity(options.identity);const transport=options.transport;
  return Object.freeze({execute:async(plan,{sourceSha='offline-source-sha',startedAt='2026-09-01T00:00:00.000Z'}={})=>{
    const trusted=inspectE2ValidationPlan(plan);if(!trusted)fail('e2_plan_untrusted');let calls=0,payload,classification,rowCount=null;
    let response;try{calls++;response=await transport(Object.freeze({operation:'synthetic-d1-query',body:JSON.stringify(trusted.statements.length===1?trusted.statements[0]:{batch:trusted.statements})}));}
    catch{classification=trusted.mutation?CLASS.UNKNOWN:CLASS.TRANSPORT;return evidence();}
    const status=Number(response?.status);
    if(status===401||status===403)classification=CLASS.AUTH;
    else if(status===429)classification=CLASS.RATE;
    else if(!Number.isInteger(status)||status<200||status>=300)classification=CLASS.SQL_FAILURE;
    else{
      try{payload=typeof response.json==='function'?await response.json():null;}catch{classification=CLASS.MALFORMED;}
      if(!classification){
        const results=statementContract(payload);
        if(payload?.success===false)classification=CLASS.SQL_FAILURE;
        else if(!results||results.length!==trusted.statements.length)classification=CLASS.MALFORMED;
        else if(results.some(result=>result.success===false))classification=CLASS.SQL_FAILURE;
        else{classification=CLASS.SUCCESS;rowCount=results.length;}
      }
    }
    return evidence();
    function evidence(){return Object.freeze({sourceSha,startedAt,testCaseId:trusted.caseId,databaseName:identity.databaseName,accountFingerprint:identity.accountMask,databaseFingerprint:identity.databaseMask,schemaFingerprint:identity.schemaFingerprint,statementCount:trusted.statements.length,serializedBodyBytes:serializedBodyBytes(trusted),classification,dispatchCount:calls,rowCount,reconciliation:null});}
  }});
}
export {CLASS as E2_OUTCOME_CLASSIFICATIONS};
