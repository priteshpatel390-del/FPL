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
  MIGRATION_0003_ACCOUNTING_NOT_ISSUED,MIGRATION_0003_ACCOUNTING_OBSERVED,
  MIGRATION_0003_ACCOUNTING_UNAVAILABLE,
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
  // Provider accounting is only ever what Cloudflare actually returned. When the migration
  // response never arrives or cannot be decoded, its `meta.rows_read` / `meta.rows_written` are
  // simply absent: reconciliation proves database state, it does not reconstruct missing provider
  // metadata. `mutationAccounting` therefore says whether the reported totals include the
  // migration request, so a reader can never mistake an observed total for complete accounting.
  let mutationAccounting=MIGRATION_0003_ACCOUNTING_NOT_ISSUED;
  const accounting=()=>Object.freeze({apiCalls:calls,rowsRead,rowsWritten,requestBytes,mutationAccounting});
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
  let mutation=null,mutationError=null;
  try{
    mutation=await dispatch(buildMigration0003Mutation(statements));
    mutationAccounting=MIGRATION_0003_ACCOUNTING_OBSERVED;
  }
  catch(error){mutationError=error;mutationAccounting=MIGRATION_0003_ACCOUNTING_UNAVAILABLE;}

  // 4. One migration request has now been issued and no second one ever will be, so the resulting
  //    production state must always be established. Whether the response was definite, malformed
  //    or lost, and whether or not a resource ceiling has already been crossed, the runner
  //    performs exactly one fixed bounded read-only reconciliation before classifying anything.
  //    A resource overrun is never allowed to skip this read, and the read is never allowed to
  //    convert a resource overrun into successful acceptance.
  let after;
  try{after=await reconcile();}
  catch(error){throw classifyMigration0003Failure(error,MIGRATION_0003_AMBIGUOUS,
    mutationError?'ambiguous_reconciliation':'postflight_read',accounting());}

  // A definite response is one that both returned and carried exactly the four reviewed results.
  const definite=!mutationError&&mutation.results.length===MIGRATION_0003_STATEMENT_COUNT;
  let postState=null;
  if(after.state===MIGRATION_0003_STATE_ALREADY_APPLIED){
    try{validateMigration0003PostState({pre,post:after});postState=true;}
    catch(error){postState=error;}
  }
  const resourceOk=withinCeilings();

  // 5. Classification. There are two distinct successful shapes, and they prove different things.
  //
  //    DIRECT SUCCESS — the migration response was definite and exactly shaped, the post-state is
  //    exact, and the accounting Cloudflare returned for every request, the migration included,
  //    is inside this runner's own ceilings.
  //
  //    RECONCILED SUCCESS AFTER UNKNOWN TRANSPORT — the migration response never proved
  //    completion, so exactly one read-only reconciliation established the exact applied
  //    post-state instead. This is a deliberate, approved outcome. Its accounting is necessarily
  //    incomplete: the migration request's own provider metadata was never received and is not
  //    reconstructed, so the reported totals cover only the requests that did return and are
  //    marked `mutation_accounting_unavailable`. The ceiling check below is applied to the
  //    accounting actually observed, and never claims the missing mutation accounting was
  //    verified or within ceiling.
  //
  //    Either way a resource overrun in the observed accounting stays owner attention.
  if(postState===true){
    if(!resourceOk)stop('migration_0003_resource_ceiling_exceeded',MIGRATION_0003_AMBIGUOUS,'postflight_resource');
    return report(MIGRATION_0003_APPLIED,pre,after,definite?null:'reconciled_after_unknown_transport',true);
  }
  if(postState instanceof Error)
    throw classifyMigration0003Failure(postState,MIGRATION_0003_AMBIGUOUS,'postflight_acceptance',accounting());
  // The migration state did not move. Only an outcome that never proved completion may be
  // reported as definitely not applied; a definite exactly-shaped success over an unchanged
  // database is contradictory and stays with the owner.
  if(after.state===MIGRATION_0003_STATE_EXACT_PRE&&!definite)
    throw classifyMigration0003Failure(mutationError??new Error('migration_0003_result_cardinality_invalid'),
      MIGRATION_0003_NOT_APPLIED,mutationError?'ambiguous_reconciliation':'postflight_acceptance',accounting());
  throw classifyMigration0003Failure(mutationError??new Error('migration_0003_post_state_mismatch'),
    MIGRATION_0003_AMBIGUOUS,mutationError?'ambiguous_reconciliation':'postflight_acceptance',accounting());

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
