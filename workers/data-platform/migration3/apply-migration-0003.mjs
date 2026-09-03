// DATA-S2B migration 0003 — dedicated production application runner.
//
// This runner exists to allow exactly one later owner-approved application of the reviewed
// migration `0003_production_query_plan_indexes.sql` against the production `teamsheet-data` D1,
// and nothing else. It is deliberately NOT a generic migration executor: there is no migration
// selection, no version input, no path input, no SQL input and no Wrangler invocation. It reads
// the reviewed migration file itself, proves its digest and its four reviewed statements, and
// submits them through the existing repository-approved production D1 REST identity.
//
// It performs no collection, no resume, no schedule or Cron change, no Worker version or
// deployment change, no route/domain/Access/secret change, no restore, and no live
// `EXPLAIN QUERY PLAN`. The unresolved first production `started` run is counted but never
// updated or deleted.

import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {createD1RestClient} from '../d1-rest-client.mjs';
import {buildMigration0003Mutation,buildMigration0003ReconciliationRead,MIGRATION_0003_RECONCILIATION_STATEMENT_COUNT} from '../official-fpl-d1-rest-plan.mjs';
import {PRODUCTION_D1_ID} from '../production-collection.mjs';
import {
  assertMigration0003Budget,classifyMigration0003State,estimateMigration0003Rows,
  MIGRATION_0003_ALREADY_APPLIED,MIGRATION_0003_AMBIGUOUS,MIGRATION_0003_APPLIED,
  MIGRATION_0003_BYTES,MIGRATION_0003_CLASSIFICATIONS,MIGRATION_0003_INDEXES,
  MIGRATION_0003_MAX_D1_API_CALLS,MIGRATION_0003_MAX_ROWS_READ,MIGRATION_0003_MAX_ROWS_WRITTEN,
  MIGRATION_0003_NOT_APPLIED,MIGRATION_0003_PATH,MIGRATION_0003_SHA256,
  MIGRATION_0003_STATE_ALREADY_APPLIED,MIGRATION_0003_STATE_EXACT_PRE,MIGRATION_0003_STATEMENT_COUNT,
  splitPinnedMigration0003,validateMigration0003Counts,validateMigration0003PostState
} from './migration-0003-contract.mjs';

const fingerprint=value=>createHash('sha256').update(value).digest('hex');
const rowsAt=(result,index)=>result.results[index]?.results??[];

export function migration0003Digest(sql){return createHash('sha256').update(sql,'utf8').digest('hex');}

// Reads the reviewed migration from its pinned path and proves size, digest and the exact four
// reviewed statements before anything can be dispatched.
export function readPinnedMigration0003(readFile=path=>fs.readFileSync(path,'utf8')){
  const sql=readFile(MIGRATION_0003_PATH);
  if(typeof sql!=='string')throw new Error('migration_0003_content_drift');
  if(Buffer.byteLength(sql,'utf8')!==MIGRATION_0003_BYTES)throw new Error('migration_0003_content_drift');
  if(migration0003Digest(sql)!==MIGRATION_0003_SHA256)throw new Error('migration_0003_content_drift');
  return splitPinnedMigration0003(sql);
}

// Every failure carries an explicit mutation classification. A run whose migration request
// definitely completed is never reported as a no-write, and no classification is retryable
// inside this execution: a retry is only ever a future owner-approved run whose own fresh
// reconciliation proves the complete exact pre-state again.
export function classifyMigration0003Failure(error,classification,phase,accounting){
  const carried=error instanceof Error?error:new Error(String(error));
  if(typeof carried.migration0003Classification==='string')return carried;
  carried.migration0003Classification=classification;
  carried.migration0003Phase=phase??null;
  carried.migration0003Retryable=false;
  carried.migration0003Accounting=accounting??null;
  return carried;
}

export function migration0003FailureClassification(error){
  const classification=error?.migration0003Classification;
  return Object.freeze({
    classification:MIGRATION_0003_CLASSIFICATIONS.includes(classification)?classification:MIGRATION_0003_AMBIGUOUS,
    phase:typeof error?.migration0003Phase==='string'?error.migration0003Phase:null,
    code:/^[a-z0-9_]{1,64}$/.test(String(error?.code??error?.message??''))?String(error.code??error.message):'unclassified',
    d1:error?.migration0003Accounting??null,
    retryable:false
  });
}

export async function applyMigration0003(options){
  const allowed=['accountId','accountFingerprint','databaseId','token','transport','readFile'];
  if(!options||Object.keys(options).some(key=>!allowed.includes(key)))throw new Error('migration_0003_config_invalid');
  const {accountId,accountFingerprint,databaseId,token,transport,readFile}=options;
  if(!/^[0-9a-f]{64}$/.test(accountFingerprint||'')||fingerprint(accountId||'')!==accountFingerprint)throw new Error('production_account_fingerprint_mismatch');
  if(databaseId!==PRODUCTION_D1_ID)throw new Error('production_d1_identity_mismatch');

  const statements=readPinnedMigration0003(readFile);
  const client=createD1RestClient({accountId,databaseId,token,transport});
  let calls=0,rowsRead=0,rowsWritten=0,requestBytes=0;
  const accounting=()=>Object.freeze({apiCalls:calls,rowsRead,rowsWritten,requestBytes});
  const stop=(code,classification,phase)=>{throw classifyMigration0003Failure(new Error(code),classification,phase,accounting());};

  const dispatch=async plan=>{
    if(calls+1>MIGRATION_0003_MAX_D1_API_CALLS)throw new Error('migration_0003_api_budget_exceeded');
    calls+=1;
    const out=await client.run(plan);
    rowsRead+=out.usage.rowsRead;rowsWritten+=out.usage.rowsWritten;requestBytes+=out.requestBytes;
    return out;
  };
  const withinCeilings=()=>rowsRead<=MIGRATION_0003_MAX_ROWS_READ&&rowsWritten<=MIGRATION_0003_MAX_ROWS_WRITTEN;

  const reconcile=async()=>{
    const out=await dispatch(buildMigration0003ReconciliationRead());
    if(out.results.length!==MIGRATION_0003_RECONCILIATION_STATEMENT_COUNT)throw new Error('migration_0003_reconciliation_contract_invalid');
    const ledger=rowsAt(out,0),indexes=rowsAt(out,1),countRows=rowsAt(out,2);
    if(countRows.length!==1)throw new Error('migration_0003_reconciliation_contract_invalid');
    const counts=validateMigration0003Counts(countRows[0]);
    return Object.freeze({ledger,indexes,counts,state:classifyMigration0003State({ledger,indexes})});
  };

  // 1. Bounded read-only pre-reconciliation. Only the exact expected pre-state may permit the
  //    mutation; the exact already-applied state completes here without issuing any SQL.
  let pre;
  try{pre=await reconcile();}
  catch(error){throw classifyMigration0003Failure(error,MIGRATION_0003_NOT_APPLIED,'pre_reconciliation',accounting());}
  if(!withinCeilings())stop('migration_0003_resource_ceiling_exceeded',MIGRATION_0003_NOT_APPLIED,'pre_reconciliation_resource');
  if(pre.state===MIGRATION_0003_STATE_ALREADY_APPLIED)
    return report(MIGRATION_0003_ALREADY_APPLIED,pre,pre,null,false);
  if(pre.state!==MIGRATION_0003_STATE_EXACT_PRE)
    stop('migration_0003_state_inconsistent',MIGRATION_0003_NOT_APPLIED,'pre_reconciliation_state');

  // 2. Narrowly reasoned migration-only budget gate, before any mutation.
  const estimate=estimateMigration0003Rows(pre.counts);
  try{assertMigration0003Budget({rowsReadSoFar:rowsRead,rowsWrittenSoFar:rowsWritten,estimate});}
  catch(error){throw classifyMigration0003Failure(error,MIGRATION_0003_NOT_APPLIED,'budget_gate',accounting());}

  // 3. Exactly one migration request, containing exactly the four reviewed statements. No second
  //    mutation is ever issued inside this execution, whatever the outcome.
  let mutation=null;
  try{mutation=await dispatch(buildMigration0003Mutation(statements));}
  catch(error){
    // The transport outcome cannot prove completion, so the mutation state is UNKNOWN. Reconcile
    // read-only; never infer a no-write from a thrown request error, and never retry.
    let after;
    try{after=await reconcile();}
    catch(readError){throw classifyMigration0003Failure(readError,MIGRATION_0003_AMBIGUOUS,'ambiguous_reconciliation',accounting());}
    if(after.state===MIGRATION_0003_STATE_ALREADY_APPLIED){
      try{validateMigration0003PostState({pre,post:after});}
      catch(postError){throw classifyMigration0003Failure(postError,MIGRATION_0003_AMBIGUOUS,'ambiguous_post_state',accounting());}
      return report(MIGRATION_0003_APPLIED,pre,after,'reconciled_after_unknown_transport',true);
    }
    if(after.state===MIGRATION_0003_STATE_EXACT_PRE)
      throw classifyMigration0003Failure(error,MIGRATION_0003_NOT_APPLIED,'ambiguous_reconciliation',accounting());
    throw classifyMigration0003Failure(error,MIGRATION_0003_AMBIGUOUS,'ambiguous_reconciliation',accounting());
  }

  // 4. The migration response is definite. Require the exact reviewed result cardinality.
  if(mutation.results.length!==MIGRATION_0003_STATEMENT_COUNT)
    stop('migration_0003_result_cardinality_invalid',MIGRATION_0003_AMBIGUOUS,'mutation_result');
  if(!withinCeilings())stop('migration_0003_resource_ceiling_exceeded',MIGRATION_0003_AMBIGUOUS,'mutation_resource');

  // 5. Bounded read-only postflight over the same fixed reconciliation contract.
  let post;
  try{post=await reconcile();}
  catch(error){throw classifyMigration0003Failure(error,MIGRATION_0003_AMBIGUOUS,'postflight_read',accounting());}
  try{validateMigration0003PostState({pre,post});}
  catch(error){throw classifyMigration0003Failure(error,MIGRATION_0003_AMBIGUOUS,'postflight_acceptance',accounting());}
  if(!withinCeilings())stop('migration_0003_resource_ceiling_exceeded',MIGRATION_0003_AMBIGUOUS,'postflight_resource');
  return report(MIGRATION_0003_APPLIED,pre,post,null,true);

  function report(classification,before,after,note,mutationIssued){
    return Object.freeze({
      ok:true,classification,note:note??null,mutationIssued,
      state:Object.freeze({before:before.state,after:after.state}),
      migration:Object.freeze({path:MIGRATION_0003_PATH,sha256:MIGRATION_0003_SHA256,statements:MIGRATION_0003_STATEMENT_COUNT}),
      ledger:Object.freeze(after.ledger.map(row=>`${Number(row.version)}:${String(row.name)}`)),
      indexes:Object.freeze(MIGRATION_0003_INDEXES.map(index=>index.name)
        .filter(name=>after.indexes.some(row=>row?.name===name))),
      counts:Object.freeze({before:before.counts,after:after.counts}),
      estimate:before.state===MIGRATION_0003_STATE_EXACT_PRE?estimateMigration0003Rows(before.counts):null,
      d1:accounting()
    });
  }
}
