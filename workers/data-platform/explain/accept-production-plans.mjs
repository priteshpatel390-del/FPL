// DATA-S2B — live production EXPLAIN QUERY PLAN acceptance runner.
//
// Strictly read-only. It issues exactly one D1 REST request, containing exactly the four fixed
// `EXPLAIN QUERY PLAN` statements over the exact repository-owned production SELECTs, and then
// validates the returned plans against the pinned acceptance contract.
//
// It imports no mutation plan builder, so no INSERT, UPDATE, DELETE or DDL statement is reachable
// from it. It performs no collection, no first-run resume, no migration, no schedule or Cron
// change, no Worker version or deployment change, no route/domain/Access/secret change and no
// retry: a second attempt is only ever a separate owner-approved dispatch. `EXPLAIN QUERY PLAN`
// prepares each statement and returns its plan; it executes none of them and visits no
// application rows.

import {createHash} from 'node:crypto';
import {createD1RestClient} from '../d1-rest-client.mjs';
import {buildProductionExplainAcceptanceRead} from '../official-fpl-d1-rest-plan.mjs';
import {DATA_S2_SOURCE_REVISION_ID} from '../official-fpl-canonical.mjs';
import {FIRST_PRODUCTION_RUN_SCHEDULED_AT,PRODUCTION_D1_ID,productionRunIdFor} from '../production-collection.mjs';
import {
  PRODUCTION_EXPLAIN_ACCEPTED,PRODUCTION_EXPLAIN_AMBIGUOUS,PRODUCTION_EXPLAIN_MAX_D1_API_CALLS,
  PRODUCTION_EXPLAIN_MAX_ROWS_READ,PRODUCTION_EXPLAIN_MAX_ROWS_WRITTEN,
  PRODUCTION_EXPLAIN_STATEMENT_COUNT,productionExplainFailureClassification,
  validateProductionExplainAcceptance
} from './production-explain-contract.mjs';

export {productionExplainFailureClassification};

const fingerprint=value=>createHash('sha256').update(value).digest('hex');

function carry(error,classification,phase,accounting){
  const held=error instanceof Error?error:new Error(String(error));
  held.explainClassification=held.explainClassification??classification;
  held.explainPhase=held.explainPhase??phase;
  held.explainAccounting=held.explainAccounting??accounting;
  held.explainRetryable=false;
  return held;
}

export async function acceptProductionExplainPlans(options){
  const allowed=['accountId','accountFingerprint','databaseId','token','transport'];
  if(!options||Object.keys(options).some(key=>!allowed.includes(key)))throw new Error('production_explain_config_invalid');
  const {accountId,accountFingerprint,databaseId,token,transport}=options;
  if(!/^[0-9a-f]{64}$/.test(accountFingerprint||'')||fingerprint(accountId||'')!==accountFingerprint)throw new Error('production_account_fingerprint_mismatch');
  if(databaseId!==PRODUCTION_D1_ID)throw new Error('production_d1_identity_mismatch');

  const client=createD1RestClient({accountId,databaseId,token,transport});
  let calls=0,rowsRead=0,rowsWritten=0,requestBytes=0;
  const accounting=()=>Object.freeze({apiCalls:calls,rowsRead,rowsWritten,requestBytes});
  const stop=(code,phase)=>{throw carry(new Error(code),PRODUCTION_EXPLAIN_AMBIGUOUS,phase,accounting());};

  // Exactly one request. The identifiers are the deterministic repository constants the
  // production SQL already binds; they are bound parameters and never reach the statement text.
  const plan=buildProductionExplainAcceptanceRead({
    sourceRevisionId:DATA_S2_SOURCE_REVISION_ID,
    runId:productionRunIdFor(FIRST_PRODUCTION_RUN_SCHEDULED_AT)
  });
  if(calls+1>PRODUCTION_EXPLAIN_MAX_D1_API_CALLS)stop('production_explain_api_budget_exceeded','dispatch');
  calls+=1;
  let out;
  try{out=await client.run(plan);}
  catch(error){throw carry(error,PRODUCTION_EXPLAIN_AMBIGUOUS,'dispatch',accounting());}
  rowsRead+=out.usage.rowsRead;rowsWritten+=out.usage.rowsWritten;requestBytes+=out.requestBytes;

  // Provider accounting is only ever what Cloudflare returned. A read-only acceptance that
  // reports any written row is never accepted, whatever the plans say.
  if(rowsWritten!==PRODUCTION_EXPLAIN_MAX_ROWS_WRITTEN)stop('production_explain_read_only_violation','read_only');
  if(rowsRead>PRODUCTION_EXPLAIN_MAX_ROWS_READ)stop('production_explain_resource_ceiling_exceeded','resource');
  if(out.results.length!==PRODUCTION_EXPLAIN_STATEMENT_COUNT)stop('production_explain_statement_cardinality_invalid','decode');

  let evidence;
  try{evidence=validateProductionExplainAcceptance(out.results.map(result=>result.results??[]));}
  catch(error){throw carry(error,PRODUCTION_EXPLAIN_AMBIGUOUS,'acceptance',accounting());}

  return Object.freeze({
    ok:true,classification:PRODUCTION_EXPLAIN_ACCEPTED,mutationIssued:false,
    queries:evidence.queries,d1:accounting()
  });
}
