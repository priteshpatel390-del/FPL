// DATA-S2B — strictly read-only verification of the committed 5 September production run.
//
// It issues exactly one D1 REST request containing exactly the one fixed repository-owned
// production postflight statement, and classifies the state it returns. It imports no mutation
// plan builder, so no INSERT, UPDATE, DELETE or DDL statement is reachable from it, and it
// contains no repair, no completion write, no resume and no retry: a second attempt is only ever
// a separate owner-approved dispatch.
//
// It proves nothing about whether a future collection would fit its resource envelope, and a
// COMMITTED_STATE_VALID outcome is a fact about existing state, never an authorisation to
// collect, to resume, or to re-enable the scheduler.

import {createHash} from 'node:crypto';
import {createD1RestClient} from '../d1-rest-client.mjs';
import {buildProductionPostflightRead} from '../official-fpl-d1-rest-plan.mjs';
import {DATA_S2_SOURCE_REVISION_ID} from '../official-fpl-canonical.mjs';
import {PRODUCTION_D1_ID,productionRunIdFor,validateProductionPostflight} from '../production-collection.mjs';
import {
  COMMITTED_RUN_INTEGRITY_MAX_D1_API_CALLS,COMMITTED_RUN_INTEGRITY_MAX_ROWS_READ,
  COMMITTED_RUN_INTEGRITY_MAX_ROWS_WRITTEN,COMMITTED_RUN_INTEGRITY_STATEMENT_COUNT,
  COMMITTED_RUN_SCHEDULED_AT,COMMITTED_STATE_AMBIGUOUS,COMMITTED_STATE_VALID,
  committedRunIntegrityClassification,validateCommittedRunIntegrity
} from './committed-run-integrity-contract.mjs';

export {committedRunIntegrityClassification};

const fingerprint=value=>createHash('sha256').update(value).digest('hex');

function hold(error,classification,phase,accounting){
  const held=error instanceof Error?error:new Error(String(error));
  held.integrityClassification=held.integrityClassification??classification;
  held.integrityPhase=held.integrityPhase??phase;
  held.integrityAccounting=held.integrityAccounting??accounting;
  held.integrityRetryable=false;
  return held;
}

export async function verifyCommittedProductionRun(options){
  const allowed=['accountId','accountFingerprint','databaseId','token','transport'];
  if(!options||Object.keys(options).some(key=>!allowed.includes(key)))throw new Error('committed_run_integrity_config_invalid');
  const {accountId,accountFingerprint,databaseId,token,transport}=options;
  if(!/^[0-9a-f]{64}$/.test(accountFingerprint||'')||fingerprint(accountId||'')!==accountFingerprint)throw new Error('production_account_fingerprint_mismatch');
  if(databaseId!==PRODUCTION_D1_ID)throw new Error('production_d1_identity_mismatch');

  const client=createD1RestClient({accountId,databaseId,token,transport});
  let calls=0,rowsRead=0,rowsWritten=0,requestBytes=0;
  const accounting=()=>Object.freeze({apiCalls:calls,rowsRead,rowsWritten,requestBytes});
  const stop=(code,phase)=>{throw hold(new Error(code),COMMITTED_STATE_AMBIGUOUS,phase,accounting());};

  // Repository-owned and derived. The scheduled minute is a reviewed constant and the run id is
  // derived from it by the same function production collection uses, so no workflow input, no
  // supplied identity and no free-form value reaches the request.
  const runId=productionRunIdFor(COMMITTED_RUN_SCHEDULED_AT);
  const plan=buildProductionPostflightRead({runId,sourceRevisionId:DATA_S2_SOURCE_REVISION_ID});
  if(calls+1>COMMITTED_RUN_INTEGRITY_MAX_D1_API_CALLS)stop('api_budget_exceeded','dispatch');
  calls+=1;
  let out;
  // The original error object is discarded rather than carried: a runtime message from the
  // transport can contain the request URL, and the sanitized classification must never be able to
  // pick one up. Only the fixed code below survives.
  try{out=await client.run(plan);}
  catch(error){throw hold(new Error(/^[a-z0-9_]{1,64}$/.test(String(error?.code??''))?String(error.code):'dispatch_failed'),
    COMMITTED_STATE_AMBIGUOUS,'dispatch',accounting());}
  rowsRead+=out.usage.rowsRead;rowsWritten+=out.usage.rowsWritten;requestBytes+=out.requestBytes;

  // Provider accounting is only ever what Cloudflare returned.
  if(rowsWritten!==COMMITTED_RUN_INTEGRITY_MAX_ROWS_WRITTEN)stop('read_only_violation','read_only');
  if(rowsRead>COMMITTED_RUN_INTEGRITY_MAX_ROWS_READ)stop('resource_ceiling_exceeded','resource');
  if(out.results.length!==COMMITTED_RUN_INTEGRITY_STATEMENT_COUNT)stop('statement_cardinality_invalid','decode');

  let state;
  try{state=validateCommittedRunIntegrity(out.results[0].results??[],{runId,validateProductionPostflight});}
  catch(error){throw hold(error,COMMITTED_STATE_AMBIGUOUS,'acceptance',accounting());}

  return Object.freeze({
    ok:true,classification:COMMITTED_STATE_VALID,mutationIssued:false,
    run:state.run,integrity:state.integrity,d1:accounting()
  });
}
