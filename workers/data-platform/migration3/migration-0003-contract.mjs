// DATA-S2B migration 0003 — repository-owned pinned contract.
//
// Pure module: no node built-ins, no I/O, no network. It fixes the exact reviewed migration
// bytes, the exact four reviewed statements, the exact index and ledger semantics, the three
// permitted live states and the narrowly reasoned migration-only resource contract. Every
// executable surface downstream validates against these constants, so no caller — and no
// workflow input — can widen the mutation beyond the reviewed migration.

export const MIGRATION_0003_PATH='workers/data-platform/migrations/0003_production_query_plan_indexes.sql';
export const MIGRATION_0003_SHA256='608a9c9c04cf9685494f7c500622d03eb46b3b32c2aa23a30694b9466c6ebcb1';
export const MIGRATION_0003_BYTES=506;
export const MIGRATION_0003_STATEMENT_COUNT=4;
export const MIGRATION_0003_VERSION=3;
export const MIGRATION_0003_NAME='production_query_plan_indexes';
export const MIGRATION_0003_APPLIED_AT='2026-09-02T00:00:00.000Z';

export const MIGRATION_0003_INDEXES=Object.freeze([
  Object.freeze({name:'observation_heads_observation_id',table:'observation_heads',
    sql:'CREATE INDEX observation_heads_observation_id ON observation_heads(observation_id)'}),
  Object.freeze({name:'observation_rejections_source_revision',table:'observation_rejections',
    sql:'CREATE INDEX observation_rejections_source_revision ON observation_rejections(source_revision_id)'}),
  Object.freeze({name:'shadow_observations_ingestion_run',table:'shadow_observations',
    sql:'CREATE INDEX shadow_observations_ingestion_run ON shadow_observations(ingestion_run_id, source_revision_id)'})
]);

// The exact four reviewed statements, in the exact repository order. Statement order is part of
// the contract: the three indexes are created before the ledger row, so a failed index creation
// can never leave a version-3 ledger row claiming an absent index.
export const MIGRATION_0003_STATEMENTS=Object.freeze([
  'CREATE INDEX observation_heads_observation_id ON observation_heads(observation_id)',
  'CREATE INDEX shadow_observations_ingestion_run ON shadow_observations(ingestion_run_id, source_revision_id)',
  'CREATE INDEX observation_rejections_source_revision ON observation_rejections(source_revision_id)',
  `INSERT INTO schema_migrations (version, name, applied_at)\nVALUES (3, 'production_query_plan_indexes', '2026-09-02T00:00:00.000Z')`
]);

// Migrations 0001 and 0002 are already applied in production and are never re-issued here.
export const MIGRATION_0003_PRIOR_LEDGER=Object.freeze([
  Object.freeze({version:1,name:'shadow_data_foundation',applied_at:'2026-08-22T00:00:00.000Z'}),
  Object.freeze({version:2,name:'official_fpl_structured_history',applied_at:'2026-08-26T00:00:00.000Z'})
]);

// Aggregate application-data facts captured before and after the migration. Migration 0003 is
// additive DDL plus one ledger row, so every key except `schema_migrations` must be identical
// across the mutation. `accepted_logical_keys` is deliberately separate from `observation_heads`:
// the append-only observation population is never equated with the head population.
export const MIGRATION_0003_PROTECTED_COUNT_KEYS=Object.freeze([
  'ingestion_runs','shadow_observations','observation_heads','observation_rejections',
  'canonical_entities','data_sources','data_source_revisions','accepted_logical_keys',
  'orphan_heads','started_runs','completed_runs','schema_migrations'
]);

export const MIGRATION_0003_STATE_EXACT_PRE='exact_pre_state';
export const MIGRATION_0003_STATE_ALREADY_APPLIED='already_applied';
export const MIGRATION_0003_STATE_INCONSISTENT='inconsistent';

export const MIGRATION_0003_APPLIED='DEFINITELY_APPLIED_SUCCESSFULLY';
export const MIGRATION_0003_ALREADY_APPLIED='DEFINITELY_ALREADY_APPLIED';
export const MIGRATION_0003_NOT_APPLIED='DEFINITELY_NOT_APPLIED';
export const MIGRATION_0003_AMBIGUOUS='AMBIGUOUS_REQUIRES_OWNER_ATTENTION';
export const MIGRATION_0003_CLASSIFICATIONS=Object.freeze([
  MIGRATION_0003_APPLIED,MIGRATION_0003_ALREADY_APPLIED,MIGRATION_0003_NOT_APPLIED,MIGRATION_0003_AMBIGUOUS
]);

// Migration-only resource contract. The routine collection ceilings (100,000 expected reads,
// 125,000 hard reads, 40,000 writes, 4,000 changed observations, eight API calls) govern routine
// collection and are NOT reinterpreted as a migration allowance. This runner reasons its own
// bound from its own fixed statements: at most three D1 REST calls (one pre-reconciliation, one
// migration request, one postflight or ambiguity reconciliation), a read bound derived from the
// live population before any mutation, and a write bound derived from the index entries the
// reviewed DDL must create.
export const MIGRATION_0003_MAX_D1_API_CALLS=3;
export const MIGRATION_0003_MAX_ROWS_READ=150000;
export const MIGRATION_0003_MAX_ROWS_WRITTEN=40000;

// Structural visit model for the fixed reconciliation SQL and the fixed index DDL.
//   reconciliation : COUNT(*) plus COUNT(DISTINCT logical_key) over shadow_observations  -> 2H
//                    heads count, orphan-head scan and its indexed observation probe     -> 3N
//                    canonical entity count                                              -> E
//                    small governed/ledger/sqlite_master reads                           -> fixed reserve
//   index build    : one pass over each indexed table                                    -> H + N + J
// Write cost is one index entry per source row plus the ledger row and its two unique-index
// entries. These are conservative repository plan estimates, never an exact Cloudflare bill;
// returned `meta.rows_read` / `meta.rows_written` remain the independently enforced accounting.
export const MIGRATION_0003_VISITS=Object.freeze({
  reconciliationObservations:2,reconciliationHeads:3,reconciliationEntities:1,reconciliationFixedReserve:64,
  indexBuildObservations:1,indexBuildHeads:1,indexBuildRejections:1
});
export const MIGRATION_0003_LEDGER_WRITE_AMPLIFICATION=3;

const invalid=code=>{throw new Error(code);};
const CONTRACT='migration_0003_reconciliation_contract_invalid';

export function assertPinnedMigration0003Statements(statements){
  if(!Array.isArray(statements)||statements.length!==MIGRATION_0003_STATEMENT_COUNT)invalid('migration_0003_statement_contract_invalid');
  for(let index=0;index<MIGRATION_0003_STATEMENT_COUNT;index+=1)
    if(statements[index]!==MIGRATION_0003_STATEMENTS[index])invalid('migration_0003_statement_contract_invalid');
  return Object.freeze([...statements]);
}

// Splits the reviewed migration file, then requires byte-exact equality with the pinned reviewed
// statements. A digest match alone would not stop a split defect; this makes an unreviewed
// statement unreachable even if the file were somehow read differently.
export function splitPinnedMigration0003(sql){
  if(typeof sql!=='string')invalid('migration_0003_content_drift');
  const statements=sql.replace(/^[ \t]*--.*$/gm,'').split(';').map(statement=>statement.trim()).filter(Boolean);
  return assertPinnedMigration0003Statements(statements);
}

function ledgerRow(row){
  if(!row||typeof row!=='object')invalid(CONTRACT);
  const version=Number(row.version);
  if(!Number.isSafeInteger(version)||version<0)invalid(CONTRACT);
  if(typeof row.name!=='string'||typeof row.applied_at!=='string')invalid(CONTRACT);
  return {version,name:row.name,applied_at:row.applied_at};
}

function exactLedgerPrefix(rows){
  return MIGRATION_0003_PRIOR_LEDGER.every((expected,index)=>{
    const row=rows[index];
    return row&&row.version===expected.version&&row.name===expected.name&&row.applied_at===expected.applied_at;
  });
}

function exactLedgerThird(row){
  return Boolean(row)&&row.version===MIGRATION_0003_VERSION&&row.name===MIGRATION_0003_NAME&&row.applied_at===MIGRATION_0003_APPLIED_AT;
}

// Any index object carrying one of the three reviewed names must match its reviewed table and
// its exact `CREATE INDEX` text. A same-named index over different columns, a different column
// order or a different table is drift, never a partial success.
function presentIndexes(indexes){
  if(!Array.isArray(indexes))invalid(CONTRACT);
  const seen=new Set();
  let exact=true;
  for(const row of indexes){
    if(!row||typeof row!=='object'||typeof row.name!=='string')invalid(CONTRACT);
    const expected=MIGRATION_0003_INDEXES.find(entry=>entry.name===row.name);
    if(!expected||seen.has(row.name)){exact=false;continue;}
    if(row.tbl_name!==expected.table||row.sql!==expected.sql)exact=false;
    seen.add(row.name);
  }
  return {count:seen.size,exact};
}

export function validateMigration0003Counts(row){
  if(!row||typeof row!=='object')invalid(CONTRACT);
  const counts={};
  for(const key of MIGRATION_0003_PROTECTED_COUNT_KEYS){
    const value=Number(row[key]);
    if(!Number.isSafeInteger(value)||value<0)invalid(CONTRACT);
    counts[key]=value;
  }
  return Object.freeze(counts);
}

// Returns one of exactly three states. Only `exact_pre_state` may permit the mutation;
// `already_applied` completes with bounded readback and issues no SQL; anything else — a
// version-3 row without its indexes, indexes without the ledger row, a partial index set, a
// wrong name or timestamp, or unexpected ledger ordering — is `inconsistent` and fails closed.
export function classifyMigration0003State({ledger,indexes}){
  if(!Array.isArray(ledger))invalid(CONTRACT);
  const rows=ledger.map(ledgerRow);
  const present=presentIndexes(indexes);
  if(!exactLedgerPrefix(rows)||!present.exact)return MIGRATION_0003_STATE_INCONSISTENT;
  const third=rows.filter(row=>row.version===MIGRATION_0003_VERSION);
  if(rows.length===MIGRATION_0003_PRIOR_LEDGER.length&&third.length===0&&present.count===0)return MIGRATION_0003_STATE_EXACT_PRE;
  if(rows.length===MIGRATION_0003_PRIOR_LEDGER.length+1&&third.length===1&&exactLedgerThird(rows[2])&&
     present.count===MIGRATION_0003_INDEXES.length)return MIGRATION_0003_STATE_ALREADY_APPLIED;
  return MIGRATION_0003_STATE_INCONSISTENT;
}

// Proves the exact post-migration ledger and index definitions, and proves that no protected
// application-data fact moved. The only permitted change is exactly one additional ledger row.
export function validateMigration0003PostState({pre,post}){
  if(classifyMigration0003State(post)!==MIGRATION_0003_STATE_ALREADY_APPLIED)throw new Error('migration_0003_post_state_mismatch');
  const before=validateMigration0003Counts(pre?.counts),after=validateMigration0003Counts(post?.counts);
  for(const key of MIGRATION_0003_PROTECTED_COUNT_KEYS){
    const expected=key==='schema_migrations'?before[key]+1:before[key];
    if(after[key]!==expected)throw new Error('migration_0003_application_data_mutated');
  }
  return true;
}

export function estimateMigration0003Rows(counts){
  const c=validateMigration0003Counts(counts);
  const v=MIGRATION_0003_VISITS;
  const reconciliationRows=c.shadow_observations*v.reconciliationObservations+c.observation_heads*v.reconciliationHeads+
    c.canonical_entities*v.reconciliationEntities+v.reconciliationFixedReserve;
  const indexBuildRows=c.shadow_observations*v.indexBuildObservations+c.observation_heads*v.indexBuildHeads+
    c.observation_rejections*v.indexBuildRejections;
  const rowsWritten=c.shadow_observations+c.observation_heads+c.observation_rejections+MIGRATION_0003_LEDGER_WRITE_AMPLIFICATION;
  return Object.freeze({reconciliationRows,indexBuildRows,postflightRows:reconciliationRows,rowsWritten,
    outstandingRows:indexBuildRows+reconciliationRows});
}

// Fails closed before the migration request when the live population makes the complete planned
// migration structurally incompatible with this runner's own bounded contract.
export function assertMigration0003Budget({rowsReadSoFar,rowsWrittenSoFar,estimate}){
  for(const value of [rowsReadSoFar,rowsWrittenSoFar,estimate?.outstandingRows,estimate?.rowsWritten])
    if(!Number.isSafeInteger(value)||value<0)throw new Error('migration_0003_budget_contract_invalid');
  const projectedRead=rowsReadSoFar+estimate.outstandingRows,projectedWrite=rowsWrittenSoFar+estimate.rowsWritten;
  if(projectedRead>MIGRATION_0003_MAX_ROWS_READ||projectedWrite>MIGRATION_0003_MAX_ROWS_WRITTEN)throw new Error('migration_0003_budget_exceeded');
  return Object.freeze({projectedRead,projectedWrite});
}
