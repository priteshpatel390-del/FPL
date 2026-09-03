// DATA-S2B — read-only reconciliation of the unresolved first production run.
//
// Strictly read-only. It issues exactly one D1 REST request containing exactly the three fixed
// repository-owned reconciliation statements and classifies the returned state. It imports no
// mutation plan builder, so no INSERT, UPDATE, DELETE or DDL statement is reachable from it, and
// it contains no repair, no completion write and no retry: a second attempt is only ever a
// separate owner-approved dispatch.
//
// It resumes nothing. `RESUME_RECONCILIATION_SAFE` is a precondition for a separately approved
// resume, never an authorisation to perform one.

import {createHash} from 'node:crypto';
import {createD1RestClient} from '../d1-rest-client.mjs';
import {buildFirstRunReconciliationRead} from '../official-fpl-d1-rest-plan.mjs';
import {DATA_S2_SOURCE_REVISION_ID} from '../official-fpl-canonical.mjs';
import {FIRST_PRODUCTION_RUN_SCHEDULED_AT,PRODUCTION_D1_ID,productionRunIdFor} from '../production-collection.mjs';
import {
  FIRST_RUN_RECONCILIATION_MAX_D1_API_CALLS,FIRST_RUN_RECONCILIATION_MAX_ROWS_READ,
  FIRST_RUN_RECONCILIATION_MAX_ROWS_WRITTEN,FIRST_RUN_RECONCILIATION_STATEMENT_COUNT,
  firstRunReconciliationClassification,RESUME_RECONCILIATION_AMBIGUOUS,RESUME_RECONCILIATION_SAFE,
  validateFirstRunReconciliation
} from './first-run-reconciliation-contract.mjs';

export {firstRunReconciliationClassification};

const fingerprint=value=>createHash('sha256').update(value).digest('hex');

function hold(error,classification,phase,accounting){
  const held=error instanceof Error?error:new Error(String(error));
  held.reconciliationClassification=held.reconciliationClassification??classification;
  held.reconciliationPhase=held.reconciliationPhase??phase;
  held.reconciliationAccounting=held.reconciliationAccounting??accounting;
  held.reconciliationRetryable=false;
  return held;
}

export async function reconcileFirstProductionRun(options){
  const allowed=['accountId','accountFingerprint','databaseId','token','transport'];
  if(!options||Object.keys(options).some(key=>!allowed.includes(key)))throw new Error('first_run_reconciliation_config_invalid');
  const {accountId,accountFingerprint,databaseId,token,transport}=options;
  if(!/^[0-9a-f]{64}$/.test(accountFingerprint||'')||fingerprint(accountId||'')!==accountFingerprint)throw new Error('production_account_fingerprint_mismatch');
  if(databaseId!==PRODUCTION_D1_ID)throw new Error('production_d1_identity_mismatch');

  const client=createD1RestClient({accountId,databaseId,token,transport});
  let calls=0,rowsRead=0,rowsWritten=0,requestBytes=0;
  const accounting=()=>Object.freeze({apiCalls:calls,rowsRead,rowsWritten,requestBytes});
  const stop=(code,phase)=>{throw hold(new Error(code),RESUME_RECONCILIATION_AMBIGUOUS,phase,accounting());};

  // The identity is deterministic and repository-owned: the pinned source revision and the run
  // id derived from the immutable first-run scheduled time. No workflow input reaches it.
  const runId=productionRunIdFor(FIRST_PRODUCTION_RUN_SCHEDULED_AT);
  const plan=buildFirstRunReconciliationRead({runId,sourceRevisionId:DATA_S2_SOURCE_REVISION_ID});
  if(calls+1>FIRST_RUN_RECONCILIATION_MAX_D1_API_CALLS)stop('first_run_reconciliation_api_budget_exceeded','dispatch');
  calls+=1;
  let out;
  try{out=await client.run(plan);}
  catch(error){throw hold(error,RESUME_RECONCILIATION_AMBIGUOUS,'dispatch',accounting());}
  rowsRead+=out.usage.rowsRead;rowsWritten+=out.usage.rowsWritten;requestBytes+=out.requestBytes;

  // Provider accounting is only ever what Cloudflare returned. A read-only reconciliation that
  // reports any written row is never accepted, whatever the rows say.
  if(rowsWritten!==FIRST_RUN_RECONCILIATION_MAX_ROWS_WRITTEN)stop('first_run_reconciliation_read_only_violation','read_only');
  if(rowsRead>FIRST_RUN_RECONCILIATION_MAX_ROWS_READ)stop('first_run_reconciliation_resource_ceiling_exceeded','resource');
  if(out.results.length!==FIRST_RUN_RECONCILIATION_STATEMENT_COUNT)stop('first_run_reconciliation_statement_cardinality_invalid','decode');

  let state;
  try{state=validateFirstRunReconciliation(out.results.map(result=>result.results??[]),
    {runId,startedAt:FIRST_PRODUCTION_RUN_SCHEDULED_AT});}
  catch(error){throw hold(error,RESUME_RECONCILIATION_AMBIGUOUS,'acceptance',accounting());}

  return Object.freeze({
    ok:true,classification:RESUME_RECONCILIATION_SAFE,mutationIssued:false,resumed:false,
    run:state.run,integrity:state.integrity,d1:accounting()
  });
}
