import {createHash} from 'node:crypto';
import {inspectE2ValidationPlan,E2_APPROVED_TABLES,E2_SCHEMA_FINGERPRINT,serializedBodyBytes} from './e2-d1-rest-validation-plan.mjs';

const DB_NAME=/^teamsheet-data-e2-rest-validation-\d{8}-[a-z0-9]{6}$/;
const PROD_TABLES=new Set(['shadow_observations','observation_heads','canonical_entities','ingestion_runs','data_sources','data_source_revisions']);
const CLASS=Object.freeze({SUCCESS:'success',SQL_FAILURE:'known_sql_provider_failure',UNKNOWN:'mutation_outcome_unknown',MALFORMED:'malformed_provider_response',RATE:'rate_limited',AUTH:'auth_failure',TRANSPORT:'transport_failure'});
export class E2ValidationError extends Error{constructor(code){super(code);this.name='E2ValidationError';this.code=code;}}
const fail=code=>{throw new E2ValidationError(code);};
const hash=value=>createHash('sha256').update(value).digest('hex');
const mask=value=>`sha256:${hash(value).slice(0,12)}`;
export function validateDisposableIdentity(value){
  if(!value||Object.keys(value).some(key=>!['accountFingerprint','approvedAccountFingerprint','productionAccountFingerprint','databaseName','databaseFingerprint','expectedDatabaseFingerprint','schemaFingerprint','expectedSchemaFingerprint','tables','phase'].includes(key)))fail('e2_identity_invalid');
  const {accountFingerprint,approvedAccountFingerprint,productionAccountFingerprint,databaseName,databaseFingerprint,expectedDatabaseFingerprint,schemaFingerprint,expectedSchemaFingerprint,tables,phase='initial'}=value;
  if(!accountFingerprint||!approvedAccountFingerprint||accountFingerprint!==approvedAccountFingerprint)fail('e2_account_fingerprint_mismatch');
  if(productionAccountFingerprint&&accountFingerprint===productionAccountFingerprint)fail('e2_production_account_rejected');
  if(databaseName==='teamsheet-data'||!DB_NAME.test(databaseName||''))fail('e2_database_name_rejected');
  if(!databaseFingerprint||!expectedDatabaseFingerprint||databaseFingerprint!==expectedDatabaseFingerprint)fail('e2_database_fingerprint_mismatch');
  if(!schemaFingerprint||!expectedSchemaFingerprint||schemaFingerprint!==expectedSchemaFingerprint||schemaFingerprint!==E2_SCHEMA_FINGERPRINT)fail('e2_schema_fingerprint_mismatch');
  if(!Array.isArray(tables))fail('e2_schema_tables_invalid');if(tables.some(table=>PROD_TABLES.has(table)))fail('e2_production_schema_rejected');
  if(phase==='initial'&&tables.length)fail('e2_initial_schema_not_empty');if(phase==='setup'&&tables.some(table=>!E2_APPROVED_TABLES.includes(table)))fail('e2_unapproved_schema_table');
  return Object.freeze({databaseName,accountMask:mask(accountFingerprint),databaseMask:mask(databaseFingerprint),schemaFingerprint});
}
const resultCount=payload=>Array.isArray(payload?.result)?payload.result.length:-1;
export function createE2ValidationHarness(options={}){
  if(!options||Object.keys(options).some(key=>!['transport','identity'].includes(key))||typeof options.transport!=='function')fail('e2_transport_required');
  const identity=validateDisposableIdentity(options.identity);const transport=options.transport;
  return Object.freeze({execute:async(plan,{sourceSha='offline-source-sha',startedAt='2026-09-01T00:00:00.000Z'}={})=>{
    const trusted=inspectE2ValidationPlan(plan);if(!trusted)fail('e2_plan_untrusted');let calls=0,response,payload,classification;
    try{calls++;response=await transport(Object.freeze({operation:'synthetic-d1-query',body:JSON.stringify(trusted.statements.length===1?trusted.statements[0]:{batch:trusted.statements})}));}
    catch{classification=trusted.mutation?CLASS.UNKNOWN:CLASS.TRANSPORT;return evidence();}
    const status=Number(response?.status);if(status===401||status===403)classification=CLASS.AUTH;else if(status===429)classification=CLASS.RATE;else if(!Number.isInteger(status)||status<200||status>=300)classification=CLASS.SQL_FAILURE;else{try{payload=typeof response.json==='function'?await response.json():JSON.parse(response.body);}catch{classification=CLASS.MALFORMED;}if(!classification)classification=payload?.success===true&&resultCount(payload)===trusted.statements.length?CLASS.SUCCESS:(payload&&payload.success===false?CLASS.SQL_FAILURE:CLASS.MALFORMED);}
    return evidence();
    function evidence(){return Object.freeze({sourceSha,startedAt,testCaseId:trusted.caseId,databaseName:identity.databaseName,accountFingerprint:identity.accountMask,databaseFingerprint:identity.databaseMask,schemaFingerprint:identity.schemaFingerprint,statementCount:trusted.statements.length,serializedBodyBytes:serializedBodyBytes(trusted),classification,dispatchCount:calls,rowCount:classification===CLASS.SUCCESS?resultCount(payload):null,reconciliation:null});}
  }});
}
export {CLASS as E2_OUTCOME_CLASSIFICATIONS};
