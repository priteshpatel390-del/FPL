import {createHash} from 'node:crypto';
import {inspectE2ValidationPlan} from './e2-d1-rest-validation-plan.mjs';
import {validateDisposableIdentity} from './e2-d1-rest-validation-harness.mjs';
import {classifyE2TransportFailure,createE2TransportDiagnostic,decodeE2DatabaseMetadataResponse,decodeE2QueryResponse,E2_LIVE_RESPONSE_CLASS} from './e2-live-response-decoder.mjs';

const API='https://api.cloudflare.com/client/v4';
const ID=/^[A-Fa-f0-9-]{16,64}$/;const ACCOUNT=/^[A-Za-z0-9_-]{1,128}$/;
const invalid=code=>{throw new Error(code);};
export const e2IdentityFingerprint=value=>`sha256:${createHash('sha256').update(String(value)).digest('hex')}`;

/** Inert until explicitly constructed with exact raw IDs matching a validated disposable identity. */
export function createE2LiveHttpAdapter({accountId,databaseId,token,fetchImpl,identity}){
  if(!ACCOUNT.test(accountId||'')||!ID.test(databaseId||'')||typeof token!=='string'||!token||typeof fetchImpl!=='function')invalid('e2_http_adapter_config_invalid');
  if(!/^sha256:[0-9a-f]{64}$/.test(identity?.productionAccountFingerprint||''))invalid('e2_production_account_fingerprint_required');
  validateDisposableIdentity(identity);
  if(identity.accountFingerprint!==e2IdentityFingerprint(accountId)||identity.databaseFingerprint!==e2IdentityFingerprint(databaseId))invalid('e2_http_adapter_identity_mismatch');
  const base=`${API}/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}`;
  const headers=Object.freeze({Authorization:`Bearer ${token}`,'Content-Type':'application/json'});
  return Object.freeze({
    readExactMetadata:async()=>{let response;try{response=await fetchImpl(base,{method:'GET',redirect:'error',headers});}catch{return Object.freeze({classification:E2_LIVE_RESPONSE_CLASS.TRANSPORT,preMutationDiagnostic:createE2TransportDiagnostic('metadata')});}return decodeE2DatabaseMetadataResponse(response,{databaseId,databaseName:identity.databaseName});},
    execute:async plan=>{const trusted=inspectE2ValidationPlan(plan);if(!trusted)invalid('e2_http_plan_untrusted');const body=JSON.stringify(trusted.statements.length===1?trusted.statements[0]:{batch:trusted.statements});let response;try{response=await fetchImpl(`${base}/query`,{method:'POST',redirect:'error',headers,body});}catch{const result=classifyE2TransportFailure(trusted.mutation);return trusted.caseId==='SCHEMA-RECONCILE'?Object.freeze({...result,preMutationDiagnostic:createE2TransportDiagnostic('initial_schema')}):result;}return decodeE2QueryResponse(response,trusted);}
  });
}
export const E2_LIVE_HTTP_CAPABILITY=Object.freeze({host:'api.cloudflare.com',metadataMethod:'GET',queryMethod:'POST',querySuffix:'/query'});
