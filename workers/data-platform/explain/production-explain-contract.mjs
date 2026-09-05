// DATA-S2B — live production EXPLAIN QUERY PLAN acceptance contract.
//
// Pure module: no node built-ins, no I/O, no network. It fixes the four production plan shapes
// that must be proved live after migration 0003, the exact index binding required of each, the
// forbidden access patterns, the bounded plan-row shape and the EXPLAIN-only resource contract.
//
// It validates the semantic content of each returned `detail` string only. SQLite node ids,
// parent ids, row ordering and cosmetic formatting are deliberately never asserted, because D1
// may legitimately vary them. Every requirement is bound to the operation and the table or alias
// it must apply to, so an index name appearing against an unrelated operation can never satisfy
// a requirement.

export const PRODUCTION_EXPLAIN_QUERIES=Object.freeze([
  'current_heads','observation_population','head_population','postflight'
]);
export const PRODUCTION_EXPLAIN_STATEMENT_COUNT=PRODUCTION_EXPLAIN_QUERIES.length;
export const PRODUCTION_EXPLAIN_MAX_ROWS_PER_STATEMENT=32;
export const PRODUCTION_EXPLAIN_MAX_DETAIL_LENGTH=512;

export const PRODUCTION_EXPLAIN_ACCEPTED='PLAN_ACCEPTED';
export const PRODUCTION_EXPLAIN_REJECTED='PLAN_REJECTED';
export const PRODUCTION_EXPLAIN_AMBIGUOUS='AMBIGUOUS_REQUIRES_OWNER_ATTENTION';
export const PRODUCTION_EXPLAIN_CLASSIFICATIONS=Object.freeze([
  PRODUCTION_EXPLAIN_ACCEPTED,PRODUCTION_EXPLAIN_REJECTED,PRODUCTION_EXPLAIN_AMBIGUOUS
]);

// EXPLAIN-only resource contract. `EXPLAIN QUERY PLAN` prepares a statement and returns its plan;
// it does not execute the query, so it visits no application rows. The routine collection
// ceilings (100,000 expected reads, 125,000 hard reads, 40,000 writes, eight API calls) and the
// migration-0003 envelope both stand unchanged and are NOT reinterpreted here.
//
// `PRODUCTION_EXPLAIN_MAX_ROWS_READ` is an operational guard, not a billing prediction: no
// provider accounting for a D1 REST `EXPLAIN QUERY PLAN` has been observed yet, so this bound is
// deliberately far below anything that could threaten the account's daily allowance, and the run
// fails closed rather than assuming a value. Only Cloudflare's returned `meta.rows_read` and
// `meta.rows_written` are ever reported as accounting.
export const PRODUCTION_EXPLAIN_MAX_D1_API_CALLS=1;
export const PRODUCTION_EXPLAIN_MAX_ROWS_READ=1000;
export const PRODUCTION_EXPLAIN_MAX_ROWS_WRITTEN=0;

// Table names and the exact aliases the fixed repository SQL gives them. Nothing here is derived
// from a caller, a workflow input or a returned plan.
const TABLE_NAMES=Object.freeze({
  shadow_observations:Object.freeze(['shadow_observations','o']),
  observation_heads:Object.freeze(['observation_heads','h']),
  ingestion_runs:Object.freeze(['ingestion_runs','r','ir']),
  observation_rejections:Object.freeze(['observation_rejections'])
});

const OBSERVATION_REVISION_INDEX='shadow_observation_idempotency';
const OBSERVATION_ID_INDEX='sqlite_autoindex_shadow_observations_1';
const HEAD_OBSERVATION_INDEX='observation_heads_observation_id';
const REJECTION_REVISION_INDEX='observation_rejections_source_revision';
const RUN_INDEX=/^sqlite_autoindex_ingestion_runs_\d+$/;

const NODE=/^(SCAN|SEARCH)\s+(?:TABLE\s+)?([A-Za-z_][A-Za-z0-9_]*)(?:\s+AS\s+([A-Za-z_][A-Za-z0-9_]*))?/;
const INDEX_NAME=/\bINDEX\s+([A-Za-z_][A-Za-z0-9_]*)/;

const malformed=code=>{const error=new Error(`production_explain_${code}`);error.explainClassification=PRODUCTION_EXPLAIN_AMBIGUOUS;throw error;};
const reject=code=>{const error=new Error(`production_explain_${code}`);error.explainClassification=PRODUCTION_EXPLAIN_REJECTED;throw error;};

// One plan row, reduced to the semantics this contract reasons about. A row that is not an
// access node — `MATERIALIZE x`, `USE TEMP B-TREE FOR count(DISTINCT)`, a CO-ROUTINE marker — is
// kept with `op:null` and constrains nothing.
export function parseExplainDetail(detail){
  if(typeof detail!=='string'||!detail||detail.length>PRODUCTION_EXPLAIN_MAX_DETAIL_LENGTH)malformed('plan_detail_invalid');
  const node=NODE.exec(detail);
  const index=INDEX_NAME.exec(detail);
  return Object.freeze({
    op:node?node[1]:null,
    name:node?node[2]:null,
    alias:node?.[3]??null,
    index:index?index[1]:null,
    covering:/\bCOVERING INDEX\b/.test(detail),
    automatic:/\bAUTOMATIC\b/.test(detail),
    primaryKey:/\bUSING\s+(?:INTEGER\s+)?PRIMARY KEY\b/.test(detail)
  });
}

export function parseExplainStatement(rows){
  if(!Array.isArray(rows)||rows.length<1||rows.length>PRODUCTION_EXPLAIN_MAX_ROWS_PER_STATEMENT)malformed('plan_row_cardinality_invalid');
  return Object.freeze(rows.map(row=>{
    if(!row||typeof row!=='object'||Array.isArray(row))malformed('plan_row_invalid');
    return parseExplainDetail(row.detail);
  }));
}

const on=(node,table)=>{
  const names=TABLE_NAMES[table];
  return Boolean(node.op)&&(names.includes(node.name)||(node.alias!==null&&names.includes(node.alias)));
};
const need=(nodes,predicate,code)=>{if(!nodes.some(predicate))reject(code);};
const forbid=(nodes,predicate,code)=>{if(nodes.some(predicate))reject(code);};
const noAutomaticIndex=(nodes,query)=>forbid(nodes,node=>node.automatic,`${query}_automatic_index`);
const indexedRun=node=>(typeof node.index==='string'&&RUN_INDEX.test(node.index))||node.primaryKey;

// Q1 — current governed heads, O(N). The statement now drives from `observation_heads` and probes
// outward, so the accepted plan is exactly: one bounded covering-index pass of migration 0003's
// `observation_heads_observation_id`, one primary-key probe of `shadow_observations`, and one
// unique-index probe of `ingestion_runs`.
//
// The previous contract required the reverse — a revision-led SEARCH of `shadow_observations`
// through `shadow_observation_idempotency` — and rejected every `SCAN` of `observation_heads`.
// That blanket head-scan rejection existed because before migration 0003 the only way
// `observation_heads` could be scanned was the catastrophic repeated inner scan. It is not
// weakened away: it is replaced by a stricter contract that pins the exact good shape. The head
// pass must be the covering index (a plain table scan of `observation_heads` is still rejected),
// there must be exactly one head node (a nested or repeated head scan is rejected), and the
// superseded revision-led traversal is rejected wherever it appears, so the whole pre-0003 and
// O(H) family stays rejected while the one bounded O(N) shape is accepted.
export function validateCurrentHeadsPlan(nodes){
  noAutomaticIndex(nodes,'current_heads');
  const access=nodes.filter(node=>node.op);
  const heads=access.filter(node=>on(node,'observation_heads'));
  if(heads.length!==1)reject('current_heads_head_node_cardinality');
  need(heads,node=>node.op==='SCAN'&&node.index===HEAD_OBSERVATION_INDEX&&node.covering,
    'current_heads_head_covering_scan_missing');
  need(access,node=>node.op==='SEARCH'&&on(node,'shadow_observations')&&(node.index===OBSERVATION_ID_INDEX||node.primaryKey),
    'current_heads_observation_probe_missing');
  need(access,node=>node.op==='SEARCH'&&on(node,'ingestion_runs')&&indexedRun(node),
    'current_heads_run_lookup_missing');
  forbid(access,node=>node.index===OBSERVATION_REVISION_INDEX,'current_heads_historical_revision_traversal');
  forbid(access,node=>node.op==='SCAN'&&on(node,'shadow_observations'),'current_heads_observation_scan');
  forbid(access,node=>node.op==='SCAN'&&on(node,'ingestion_runs'),'current_heads_run_scan');
  return true;
}

// Q2 — governed observation population. Covering use of the source-revision index only.
export function validateObservationPopulationPlan(nodes){
  noAutomaticIndex(nodes,'observation_population');
  need(nodes,node=>node.op==='SEARCH'&&on(node,'shadow_observations')&&node.index===OBSERVATION_REVISION_INDEX&&node.covering,
    'observation_population_covering_lookup_missing');
  forbid(nodes,node=>node.op==='SCAN'&&on(node,'shadow_observations'),'observation_population_scan');
  return true;
}

// Q3 — head population. A covering scan of migration 0003's index is the accepted shape; a plain
// table scan of `observation_heads` is a failure.
export function validateHeadPopulationPlan(nodes){
  noAutomaticIndex(nodes,'head_population');
  need(nodes,node=>node.op==='SCAN'&&on(node,'observation_heads')&&node.index===HEAD_OBSERVATION_INDEX&&node.covering,
    'head_population_covering_scan_missing');
  forbid(nodes,node=>node.op==='SCAN'&&on(node,'observation_heads')&&!(node.covering&&node.index===HEAD_OBSERVATION_INDEX),
    'head_population_table_scan');
  return true;
}

// Q4 — consolidated postflight. `observation_state` must traverse the source-revision index
// exactly once: a second occurrence would mean the materialized CTE is being re-evaluated, which
// the whole-cycle read model does not charge for. The `head_state` scan of `observation_heads` is
// the expected and permitted shape; its observation and ingestion-run probes must stay indexed,
// and `rejection_state` must use migration 0003's rejection index.
export function validatePostflightPlan(nodes){
  noAutomaticIndex(nodes,'postflight');
  const revisionTraversals=nodes.filter(node=>node.index===OBSERVATION_REVISION_INDEX).length;
  if(revisionTraversals<1)reject('postflight_observation_lookup_missing');
  if(revisionTraversals>1)reject('postflight_repeated_observation_traversal');
  need(nodes,node=>node.op==='SEARCH'&&on(node,'shadow_observations')&&node.index===OBSERVATION_REVISION_INDEX,
    'postflight_observation_lookup_missing');
  need(nodes,node=>node.op==='SEARCH'&&on(node,'shadow_observations')&&(node.index===OBSERVATION_ID_INDEX||node.primaryKey),
    'postflight_observation_id_lookup_missing');
  need(nodes,node=>node.op==='SEARCH'&&on(node,'ingestion_runs')&&indexedRun(node),
    'postflight_run_lookup_missing');
  need(nodes,node=>node.op==='SEARCH'&&on(node,'observation_rejections')&&node.index===REJECTION_REVISION_INDEX,
    'postflight_rejection_lookup_missing');
  forbid(nodes,node=>node.op==='SCAN'&&on(node,'shadow_observations'),'postflight_observation_scan');
  return true;
}

const VALIDATORS=Object.freeze([
  validateCurrentHeadsPlan,validateObservationPopulationPlan,validateHeadPopulationPlan,validatePostflightPlan
]);

// Bounded structural evidence for the workflow summary. It carries no SQL text, no free-form
// provider string, no identifier and no bound parameter value.
const evidence=nodes=>Object.freeze(nodes.filter(node=>node.op).map(node=>Object.freeze({
  op:node.op,target:node.alias??node.name,index:node.index,covering:node.covering
})));

export function validateProductionExplainAcceptance(statements){
  if(!Array.isArray(statements)||statements.length!==PRODUCTION_EXPLAIN_STATEMENT_COUNT)malformed('statement_cardinality_invalid');
  const parsed=statements.map(parseExplainStatement);
  parsed.forEach((nodes,index)=>VALIDATORS[index](nodes));
  return Object.freeze({
    classification:PRODUCTION_EXPLAIN_ACCEPTED,
    queries:Object.freeze(PRODUCTION_EXPLAIN_QUERIES.map((query,index)=>Object.freeze({
      query,rows:parsed[index].length,plan:evidence(parsed[index])
    })))
  });
}

export function productionExplainFailureClassification(error){
  const classification=error?.explainClassification;
  return Object.freeze({
    classification:PRODUCTION_EXPLAIN_CLASSIFICATIONS.includes(classification)?classification:PRODUCTION_EXPLAIN_AMBIGUOUS,
    phase:typeof error?.explainPhase==='string'?error.explainPhase:null,
    code:/^[a-z0-9_]{1,64}$/.test(String(error?.code??error?.message??''))?String(error.code??error.message):'unclassified',
    d1:error?.explainAccounting??null,
    retryable:false
  });
}
