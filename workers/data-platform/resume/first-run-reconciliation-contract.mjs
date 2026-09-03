// DATA-S2B — first production run reconciliation contract.
//
// Pure module: no node built-ins, no I/O, no network, no SQL text and no mutation surface. It
// fixes the exact state the unresolved first production run must be in before any resume
// mutation may be considered, the bounded result shape that state may be proved with, and the
// read-only resource contract of the proof itself.
//
// The reconciliation answers one question and never repairs anything: did the run that stopped
// at `d1_result_contract_invalid` leave exactly its start-ledger row, and nothing else, behind?
// Every outcome is one of three explicit classifications; there is no retry, no repair and no
// mutation path reachable from this contract.

import {DATA_S2_SCHEMA_VERSION,DATA_S2_SOURCE_REVISION_ID,DATA_S2_TRANSFORM_VERSION,DATA_S2_VALIDATION_VERSION} from '../official-fpl-canonical.mjs';

export const RESUME_RECONCILIATION_SAFE='RESUME_RECONCILIATION_SAFE';
export const RESUME_RECONCILIATION_BLOCKED='RESUME_RECONCILIATION_BLOCKED';
export const RESUME_RECONCILIATION_AMBIGUOUS='AMBIGUOUS_REQUIRES_OWNER_ATTENTION';
export const RESUME_RECONCILIATION_CLASSIFICATIONS=Object.freeze([
  RESUME_RECONCILIATION_SAFE,RESUME_RECONCILIATION_BLOCKED,RESUME_RECONCILIATION_AMBIGUOUS
]);

// The reconciliation is one bounded read-only request: governance, the exact pinned run row, and
// one run-scoped integrity row. The high-volume observation, head and rejection predicates are
// index-supported, so those never scan a population. The small `ingestion_runs` counters filtered
// by source revision and status are NOT covered by a source-revision-leading index under the
// current schema; they are bounded instead by `FIRST_RUN_RECONCILIATION_MAX_ROWS_READ`, which is
// an operational ceiling on Cloudflare's returned `meta.rows_read` and not a billing prediction.
// Any unexpected read amplification therefore fails closed rather than proceeding. Only
// Cloudflare's returned `meta.rows_read` and `meta.rows_written` are ever reported as accounting. The routine
// collection ceilings and the migration-0003 envelope stand unchanged and are not reinterpreted.
export const FIRST_RUN_RECONCILIATION_STATEMENT_COUNT=3;
export const FIRST_RUN_RECONCILIATION_MAX_D1_API_CALLS=1;
export const FIRST_RUN_RECONCILIATION_MAX_ROWS_READ=1000;
export const FIRST_RUN_RECONCILIATION_MAX_ROWS_WRITTEN=0;
export const FIRST_RUN_RECONCILIATION_MAX_ROWS_PER_STATEMENT=4;

// Counters the integrity statement must return, in the exact order the fixed SQL names them.
export const FIRST_RUN_RECONCILIATION_COUNTERS=Object.freeze([
  'run_observations','run_heads','run_rejections','revision_runs','started_runs','completed_runs','other_runs'
]);

// Counters that must be exactly zero for a resume to be safe: the pinned run may not own an
// observation, a governed head or a rejection row.
const ZERO_COUNTERS=Object.freeze(['run_observations','run_heads','run_rejections']);

const carry=(code,classification)=>{
  const error=new Error(`first_run_reconciliation_${code}`);
  error.reconciliationClassification=classification;
  error.reconciliationRetryable=false;
  throw error;
};
const ambiguous=code=>carry(code,RESUME_RECONCILIATION_AMBIGUOUS);
const blocked=code=>carry(code,RESUME_RECONCILIATION_BLOCKED);

const counter=(row,key)=>{
  const raw=row?.[key];
  // A null, absent or non-numeric counter is undecidable, never a silent zero.
  if(typeof raw==='number'?!Number.isSafeInteger(raw):!(typeof raw==='string'&&/^\d{1,15}$/.test(raw)))ambiguous('counter_invalid');
  const value=Number(raw);
  if(!Number.isSafeInteger(value)||value<0)ambiguous('counter_invalid');
  return value;
};

const object=row=>{
  if(!row||typeof row!=='object'||Array.isArray(row))ambiguous('row_invalid');
  return row;
};

const statementRows=rows=>{
  if(!Array.isArray(rows)||rows.length>FIRST_RUN_RECONCILIATION_MAX_ROWS_PER_STATEMENT)ambiguous('row_cardinality_invalid');
  return rows;
};

// The exact governed source revision. Identical to the gate the routine collection already
// applies, held here so the reconciliation and the collection can never drift apart.
export function exactGovernance(row){
  return Number(row?.migration_version)===3&&row.migration_name==='production_query_plan_indexes'&&
    row.source_revision_id===DATA_S2_SOURCE_REVISION_ID&&row.schema_version===DATA_S2_SCHEMA_VERSION&&
    row.rights_classification==='durable_allowed'&&Number(row.retention_allowed)===1&&
    Number(row.redistribution_allowed)===0&&Number(row.shadow_ingest_allowed)===1&&
    row.acquisition_status==='approved_internal_shadow_history'&&row.source_key==='official-fpl'&&
    row.source_kind==='official_fpl';
}

// The exact untouched start-ledger row the failed run left behind. Identity is pinned: the run
// id and the immutable `started_at` are supplied by the caller from repository constants, never
// from a workflow input, and every counter must still be zero.
export function exactUntouchedStartedRun(row,{runId,startedAt}){
  return row?.run_id===runId&&row.source_revision_id===DATA_S2_SOURCE_REVISION_ID&&
    row.run_type==='official_fpl_structured_history'&&row.mode==='shadow_only'&&
    row.started_at===startedAt&&row.completed_at===null&&row.status==='started'&&
    row.safe_endpoint_class==='official_fpl_public_core'&&row.parser_version===DATA_S2_VALIDATION_VERSION&&
    row.transform_version===DATA_S2_TRANSFORM_VERSION&&row.schema_version===DATA_S2_SCHEMA_VERSION&&
    Number(row.records_seen)===0&&Number(row.records_accepted)===0&&
    Number(row.records_quarantined)===0&&Number(row.records_rejected)===0&&row.error_class===null;
}

// Validates the three fixed statement results and classifies the state.
//
// A malformed, unbounded or undecidable result is AMBIGUOUS. A well-formed result that proves a
// state a resume must not mutate from — a completed or failed run, a partially written run, a
// second unresolved run, drifted governance — is BLOCKED. Only the exact expected pre-state is
// SAFE, and SAFE still resumes nothing: it is a precondition, not an authorisation.
export function validateFirstRunReconciliation(statements,{runId,startedAt}){
  if(typeof runId!=='string'||!runId||typeof startedAt!=='string'||!startedAt)ambiguous('identity_invalid');
  if(!Array.isArray(statements)||statements.length!==FIRST_RUN_RECONCILIATION_STATEMENT_COUNT)ambiguous('statement_cardinality_invalid');

  const governanceRows=statementRows(statements[0]);
  if(governanceRows.length!==1)blocked('governance_absent');
  const governance=object(governanceRows[0]);
  if(!exactGovernance(governance))blocked('governance_mismatch');

  const runRows=statementRows(statements[1]);
  if(runRows.length!==1)blocked('run_row_absent');
  const run=object(runRows[0]);
  if(run.status==='completed')blocked('run_already_completed');
  if(run.status!=='started')blocked('run_status_unexpected');
  if(!exactUntouchedStartedRun(run,{runId,startedAt}))blocked('run_row_not_untouched');

  const integrityRows=statementRows(statements[2]);
  if(integrityRows.length!==1)ambiguous('integrity_row_absent');
  const integrityRow=object(integrityRows[0]);
  const counters={};
  for(const key of FIRST_RUN_RECONCILIATION_COUNTERS)counters[key]=counter(integrityRow,key);
  for(const key of ZERO_COUNTERS)if(counters[key]!==0)blocked(`partial_${key}`);
  // Exactly one unresolved run may exist, and it is the pinned one proved above. A second
  // `started` row means another attempt is outstanding and no resume may proceed.
  if(counters.started_runs!==1)blocked('unresolved_run_population_unexpected');
  if(counters.revision_runs<1)blocked('run_population_unexpected');

  return Object.freeze({
    classification:RESUME_RECONCILIATION_SAFE,
    runId,startedAt,
    governance,
    run:Object.freeze({status:run.status,startedAt:run.started_at,completedAt:run.completed_at,
      recordsSeen:Number(run.records_seen),recordsAccepted:Number(run.records_accepted),
      recordsQuarantined:Number(run.records_quarantined),recordsRejected:Number(run.records_rejected),
      errorClass:run.error_class}),
    integrity:Object.freeze({...counters})
  });
}

export function firstRunReconciliationClassification(error){
  const classification=error?.reconciliationClassification;
  return Object.freeze({
    classification:RESUME_RECONCILIATION_CLASSIFICATIONS.includes(classification)?classification:RESUME_RECONCILIATION_AMBIGUOUS,
    phase:typeof error?.reconciliationPhase==='string'?error.reconciliationPhase:null,
    code:/^[a-z0-9_]{1,64}$/.test(String(error?.code??error?.message??''))?String(error.code??error.message):'unclassified',
    d1:error?.reconciliationAccounting??null,
    retryable:false
  });
}
