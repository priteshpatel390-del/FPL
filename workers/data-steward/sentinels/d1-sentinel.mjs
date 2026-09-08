// DATA-OPS-A1.2 — the read-only production D1 sentinel.
//
// It answers three questions about production data and nothing else: is the schema and governance
// state the one this repository expects, did the UTC day's collection actually persist, and is the
// persisted history internally consistent.
//
// SQL SAFETY IS THE POINT OF THIS MODULE, and it is enforced in application code rather than left
// to the API token. Even with a `D1: Read` credential, A1.2 exposes NO arbitrary SQL:
//
//   * there are exactly three statements, written here, in full, as frozen literals;
//   * every one begins `SELECT` and is validated against a forbidden-construct scan;
//   * every value is bound as a parameter — no identifier, table name, column name, predicate or
//     literal is ever assembled from an argument;
//   * a plan can only be produced by this module's own builders and is recognised by a private
//     WeakSet, so a hand-made object cannot be executed;
//   * the client refuses any plan it did not itself recognise, and refuses any response reporting
//     a written row;
//   * there is no builder, parameter or code path that can express INSERT, UPDATE, DELETE, DDL,
//     PRAGMA mutation or migration execution, and none that accepts SQL from an incident payload,
//     from a proposal, from configuration or from an AI.
//
// The statements are deliberately NOT imported from the production collection plan module. That
// module can build mutations by design; importing it would hand the steward a route to one. A1.2
// owns its own registry, and its registry has no mutation in it to reach.
//
// Every statement is written against the real migrated schema — migrations 0001, 0002 and 0003,
// with no migration 0004 — and against the collection semantics the production postflight already
// enforces. A1.2 changes no schema, adds no index and runs no migration.
import {deepFreeze} from '../../../src/decision-intelligence/canonical.mjs';
import {DATA_S2_SOURCE_REVISION_ID} from '../../data-platform/official-fpl-canonical.mjs';
import {PRODUCTION_D1_ID} from '../../data-platform/production-collection.mjs';

export const D1_SENTINEL_ID='d1';
export const D1_SENTINEL_VERSION='data-ops-a1.2-d1-v1';
export const D1_API_BASE='https://api.cloudflare.com/client/v4';
export const D1_REQUEST_TIMEOUT_MS=20000;

// The production run type the routine Official FPL collection writes, and the governance facts the
// migrated database must still report. All are repository constants, never inputs.
export const EXPECTED_RUN_TYPE='official_fpl_structured_history';
export const EXPECTED_MIGRATION_VERSION=3;
export const EXPECTED_MIGRATION_NAME='production_query_plan_indexes';
export const EXPECTED_SOURCE_KEY='official-fpl';
export const EXPECTED_SOURCE_KIND='official_fpl';
export const EXPECTED_SCHEMA_VERSION='data-s2a-v1';
export const EXPECTED_RIGHTS_CLASSIFICATION='durable_allowed';

// One API call carrying all three statements, and a hard bound on what that call may consume.
// The integrity aggregate scans the governed observation history, so its cost grows with the
// append-only history; the bound is generous against today's population and still far below the
// production collection envelope, and exceeding it stops the observation rather than continuing.
export const D1_SENTINEL_MAX_API_CALLS=1;
export const D1_SENTINEL_MAX_ROWS_READ=150000;
export const D1_SENTINEL_RECENT_RUN_LIMIT=20;

export const D1_OBSERVATION_OK='D1_STATE_OBSERVED';
export const D1_READ_FAILED='D1_READ_FAILED';
export const D1_WRITE_DETECTED='D1_WRITE_DETECTED';
export const D1_BUDGET_EXCEEDED='D1_READ_BUDGET_EXCEEDED';
export const D1_GOVERNANCE_MISMATCH='D1_GOVERNANCE_MISMATCH';
export const D1_STATE_INCONSISTENT='D1_STATE_INCONSISTENT';

export class D1SentinelError extends Error{
  constructor(code){super(code);this.name='D1SentinelError';this.code=code;}
}
const fail=code=>{throw new D1SentinelError(code);};

// ---------------------------------------------------------------- the fixed statement registry

export const D1_OBSERVATION_QUERY_IDS=deepFreeze(['governance','recent_runs','integrity']);

const GOVERNANCE_SQL=`SELECT
 (SELECT MAX(version) FROM schema_migrations) AS migration_version,
 (SELECT name FROM schema_migrations WHERE version=(SELECT MAX(version) FROM schema_migrations)) AS migration_name,
 r.source_revision_id AS source_revision_id, r.schema_version AS schema_version,
 r.rights_classification AS rights_classification, r.retention_allowed AS retention_allowed,
 r.redistribution_allowed AS redistribution_allowed, r.shadow_ingest_allowed AS shadow_ingest_allowed,
 s.source_key AS source_key, s.source_kind AS source_kind
 FROM data_source_revisions r JOIN data_sources s ON s.source_id=r.source_id
 WHERE r.source_revision_id=?`;

const RECENT_RUNS_SQL=`SELECT run_id, started_at, completed_at, status, records_seen, records_accepted,
 records_quarantined, records_rejected, error_class
 FROM ingestion_runs
 WHERE source_revision_id=? AND run_type=? AND started_at>=? AND started_at<?
 ORDER BY started_at DESC LIMIT ${D1_SENTINEL_RECENT_RUN_LIMIT}`;

const INTEGRITY_SQL=`SELECT
 (SELECT COUNT(*) FROM shadow_observations WHERE source_revision_id=?) AS observations,
 (SELECT COUNT(DISTINCT logical_key) FROM shadow_observations WHERE source_revision_id=? AND admission_state='accepted') AS logical_keys,
 (SELECT COUNT(*) FROM observation_heads) AS heads,
 (SELECT COUNT(*) FROM observation_heads h LEFT JOIN shadow_observations o ON o.observation_id=h.observation_id WHERE o.observation_id IS NULL) AS orphan_heads,
 (SELECT COUNT(*) FROM shadow_observations WHERE source_revision_id=? AND admission_state<>'accepted') AS non_accepted,
 (SELECT COUNT(*) FROM shadow_observations WHERE source_revision_id=? AND mode<>'shadow_only') AS non_shadow,
 (SELECT COUNT(*) FROM observation_rejections WHERE source_revision_id=?) AS rejections,
 (SELECT MAX(fetched_at) FROM shadow_observations WHERE source_revision_id=?) AS latest_observation_at`;

export const D1_OBSERVATION_QUERIES=deepFreeze({governance:GOVERNANCE_SQL,
  recent_runs:RECENT_RUNS_SQL,integrity:INTEGRITY_SQL});

// A second, independent gate over the same text. Membership in the registry is checked first, and
// this scan then proves the statement is a bare read: one statement, `SELECT`-led, with no
// mutating construct, no statement separator and no comment through which one could be hidden.
const FORBIDDEN=/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|TRUNCATE|ATTACH|DETACH|VACUUM|REINDEX|BEGIN|COMMIT|ROLLBACK|GRANT|RETURNING)\b/i;
export function assertReadOnlySql(sql){
  if(typeof sql!=='string'||!sql)fail('d1_sentinel_sql_forbidden');
  if(!/^SELECT\s/.test(sql))fail('d1_sentinel_sql_forbidden');
  if(FORBIDDEN.test(sql))fail('d1_sentinel_sql_forbidden');
  if(sql.includes(';')||sql.includes('--')||sql.includes('/*'))fail('d1_sentinel_sql_forbidden');
  if(/\bPRAGMA\b/i.test(sql))fail('d1_sentinel_sql_forbidden');
  return sql;
}
for(const sql of Object.values(D1_OBSERVATION_QUERIES))assertReadOnlySql(sql);

const trusted=new WeakSet();
const bound=value=>{
  if(typeof value!=='string'||!value||value.length>256)fail('d1_sentinel_parameter_invalid');
  return value;
};

// The only way to produce an executable plan. It takes the query id and the bound values, never
// SQL, never a table, never a column and never a predicate.
export function buildObservationPlan(queryId,params){
  if(!D1_OBSERVATION_QUERY_IDS.includes(queryId))fail('d1_sentinel_query_unknown');
  if(!Array.isArray(params)||params.length>16)fail('d1_sentinel_parameter_invalid');
  const plan=Object.freeze({queryId,sql:assertReadOnlySql(D1_OBSERVATION_QUERIES[queryId]),
    params:Object.freeze(params.map(bound))});
  trusted.add(plan);
  return plan;
}

export const inspectObservationPlan=plan=>trusted.has(plan)?plan:null;

// The exact three-statement batch this sentinel ever issues, for one UTC day window.
export function buildDailyObservationBatch({dayStartIso,dayEndIso}){
  const revision=DATA_S2_SOURCE_REVISION_ID;
  return deepFreeze([
    buildObservationPlan('governance',[revision]),
    buildObservationPlan('recent_runs',[revision,EXPECTED_RUN_TYPE,bound(dayStartIso),bound(dayEndIso)]),
    buildObservationPlan('integrity',[revision,revision,revision,revision,revision,revision])
  ]);
}

// ---------------------------------------------------------------- the read-only D1 client

export function d1QueryUrl(accountId){
  if(typeof accountId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(accountId))fail('d1_sentinel_account_invalid');
  return `${D1_API_BASE}/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(PRODUCTION_D1_ID)}/query`;
}

// Issues at most one POST to the D1 `/query` endpoint carrying only trusted plans, and refuses the
// response outright if the provider reports any written row. The written-row check is defence in
// depth over a batch that structurally cannot write: it means a future statement that somehow
// mutated would still be refused rather than reported.
export async function runObservationBatch({accountId,token,plans,fetchImpl}){
  if(typeof fetchImpl!=='function')fail('d1_sentinel_input_invalid');
  if(typeof token!=='string'||!token)fail('d1_sentinel_token_missing');
  if(!Array.isArray(plans)||plans.length===0||plans.length>D1_OBSERVATION_QUERY_IDS.length)fail('d1_sentinel_input_invalid');
  for(const plan of plans)if(!inspectObservationPlan(plan))fail('d1_sentinel_plan_untrusted');
  const body=JSON.stringify({batch:plans.map(plan=>({sql:plan.sql,params:plan.params}))});
  let response;
  try{
    response=await fetchImpl(d1QueryUrl(accountId),{method:'POST',redirect:'error',
      headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body,
      signal:AbortSignal.timeout(D1_REQUEST_TIMEOUT_MS)});
  }catch{return deepFreeze({ok:false,reasonCode:D1_READ_FAILED});}
  if(response?.status!==200)return deepFreeze({ok:false,reasonCode:D1_READ_FAILED});
  let payload;
  try{payload=await response.json();}catch{return deepFreeze({ok:false,reasonCode:D1_READ_FAILED});}
  if(!payload||payload.success!==true)return deepFreeze({ok:false,reasonCode:D1_READ_FAILED});
  const results=Array.isArray(payload.result)?payload.result:null;
  if(results===null||results.length!==plans.length)return deepFreeze({ok:false,reasonCode:D1_READ_FAILED});
  let rowsRead=0;
  const rows=[];
  for(const result of results){
    if(!result||result.success!==true)return deepFreeze({ok:false,reasonCode:D1_READ_FAILED});
    const meta=result.meta??{};
    const read=meta.rows_read??0,written=meta.rows_written??0;
    if(!Number.isSafeInteger(read)||read<0||!Number.isSafeInteger(written)||written<0)
      return deepFreeze({ok:false,reasonCode:D1_READ_FAILED});
    if(written!==0)return deepFreeze({ok:false,reasonCode:D1_WRITE_DETECTED});
    rowsRead+=read;
    if(!Array.isArray(result.results))return deepFreeze({ok:false,reasonCode:D1_READ_FAILED});
    rows.push(result.results);
  }
  if(rowsRead>D1_SENTINEL_MAX_ROWS_READ)return deepFreeze({ok:false,reasonCode:D1_BUDGET_EXCEEDED});
  return deepFreeze({ok:true,reasonCode:D1_OBSERVATION_OK,rows:deepFreeze(rows),rowsRead});
}

// ---------------------------------------------------------------- pure interpretation

const count=value=>{const n=Number(value);return Number.isSafeInteger(n)&&n>=0?n:null;};
const iso=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?Date.parse(value):null;

export function interpretGovernance(rows){
  if(!Array.isArray(rows)||rows.length!==1)return null;
  const [row]=rows;
  if(!row||typeof row!=='object')return null;
  const ok=count(row.migration_version)===EXPECTED_MIGRATION_VERSION
    &&row.migration_name===EXPECTED_MIGRATION_NAME
    &&row.source_revision_id===DATA_S2_SOURCE_REVISION_ID
    &&row.schema_version===EXPECTED_SCHEMA_VERSION
    &&row.rights_classification===EXPECTED_RIGHTS_CLASSIFICATION
    &&count(row.retention_allowed)===1
    &&count(row.redistribution_allowed)===0
    &&count(row.shadow_ingest_allowed)===1
    &&row.source_key===EXPECTED_SOURCE_KEY
    &&row.source_kind===EXPECTED_SOURCE_KIND;
  return deepFreeze({ok,migrationVersion:count(row.migration_version)});
}

// A run counts as the day's completed production collection only when it satisfies the same shape
// the production postflight already requires of a finished run: `completed`, no quarantine, no
// rejection, no error class, and accepted no greater than seen.
export function interpretRuns(rows){
  if(!Array.isArray(rows))return null;
  if(rows.length>D1_SENTINEL_RECENT_RUN_LIMIT)return null;
  const runs=[];
  for(const row of rows){
    if(!row||typeof row!=='object')return null;
    if(typeof row.run_id!=='string'||!/^gha-[0-9a-f]{40}$/.test(row.run_id))return null;
    const startedAt=iso(row.started_at);
    if(startedAt===null)return null;
    if(typeof row.status!=='string')return null;
    const seen=count(row.records_seen),accepted=count(row.records_accepted);
    const quarantined=count(row.records_quarantined),rejected=count(row.records_rejected);
    if([seen,accepted,quarantined,rejected].some(value=>value===null))return null;
    if(row.error_class!==null&&typeof row.error_class!=='string')return null;
    runs.push({runId:row.run_id,startedAt,completedAt:iso(row.completed_at),status:row.status,
      seen,accepted,quarantined,rejected,errorClass:row.error_class??null});
  }
  const completed=runs.filter(run=>run.status==='completed'&&run.completedAt!==null
    &&run.quarantined===0&&run.rejected===0&&run.errorClass===null&&run.accepted<=run.seen);
  const unresolved=runs.filter(run=>run.status!=='completed'&&run.status!=='failed');
  return deepFreeze({total:runs.length,completed:completed.length,failed:runs.filter(r=>r.status==='failed').length,
    unresolved:unresolved.length,
    latestCompletedAt:completed.length?Math.max(...completed.map(run=>run.completedAt)):null,
    latestCompletedRunId:completed.length
      ?completed.slice().sort((a,b)=>b.completedAt-a.completedAt)[0].runId:null});
}

// The same invariants the production postflight enforces at commit time, re-proved independently
// afterwards: heads equal distinct accepted logical keys, and there is no orphan head, no
// non-accepted observation, no non-shadow observation and no rejection.
export function interpretIntegrity(rows){
  if(!Array.isArray(rows)||rows.length!==1)return null;
  const [row]=rows;
  if(!row||typeof row!=='object')return null;
  const observations=count(row.observations),logicalKeys=count(row.logical_keys),heads=count(row.heads);
  const orphanHeads=count(row.orphan_heads),nonAccepted=count(row.non_accepted);
  const nonShadow=count(row.non_shadow),rejections=count(row.rejections);
  if([observations,logicalKeys,heads,orphanHeads,nonAccepted,nonShadow,rejections].some(value=>value===null))return null;
  const latest=row.latest_observation_at===null?null:iso(row.latest_observation_at);
  if(row.latest_observation_at!==null&&latest===null)return null;
  const consistent=heads===logicalKeys&&orphanHeads===0&&nonAccepted===0&&nonShadow===0
    &&rejections===0&&observations>=heads;
  return deepFreeze({consistent,observations,logicalKeys,heads,orphanHeads,nonAccepted,nonShadow,
    rejections,latestObservationAt:latest});
}

// Runs the whole bounded read and returns the decoded, interpreted production-data view for one
// UTC day. Every failure carries a closed reason code and no provider detail.
export async function readD1State({accountId,token,fetchImpl,dayStartIso,dayEndIso}){
  const batch=buildDailyObservationBatch({dayStartIso,dayEndIso});
  const result=await runObservationBatch({accountId,token,plans:batch,fetchImpl});
  if(!result.ok)return result;
  const governance=interpretGovernance(result.rows[0]);
  const runs=interpretRuns(result.rows[1]);
  const integrity=interpretIntegrity(result.rows[2]);
  if(governance===null||runs===null||integrity===null)
    return deepFreeze({ok:false,reasonCode:D1_READ_FAILED});
  if(!governance.ok)return deepFreeze({ok:false,reasonCode:D1_GOVERNANCE_MISMATCH,governance,runs,integrity});
  if(!integrity.consistent)return deepFreeze({ok:false,reasonCode:D1_STATE_INCONSISTENT,governance,runs,integrity});
  return deepFreeze({ok:true,reasonCode:D1_OBSERVATION_OK,governance,runs,integrity,
    rowsRead:result.rowsRead,apiCalls:D1_SENTINEL_MAX_API_CALLS});
}
