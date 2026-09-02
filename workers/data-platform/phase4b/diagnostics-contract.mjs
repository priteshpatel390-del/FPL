// DATA-S2B Phase 4B — bounded read-only production diagnostics contract.
//
// The earlier preflight validated one exact expectation at a time and threw on the
// first mismatch, so each stale repository constant cost a whole protected run. This
// contract keeps every dangerous condition fail-closed while turning a safe stale
// expectation into recorded evidence, so a single protected read can gather the whole
// remaining DATA-S2B acceptance bundle. It owns no transport and no mutation surface.
import {PHASE0_QUERIES} from '../phase0/queries.mjs';
import {PHASE1_QUERIES} from '../phase1/migrate-0002.mjs';
import {validateReadOnlySql} from '../phase0/readonly-preflight.mjs';
import {
  EXPECTED_ACTIVE_VERSION_ID,EXPECTED_CRON,EXPECTED_D1_DATABASE_ID,
  EXPECTED_ROLLBACK_VERSION_ID,KNOWN_REDIRECT_RUNTIME_ERROR_CLASS,RETAINED_OLDER_VERSION_ID
} from './live-contract.mjs';

export {EXPECTED_ACTIVE_VERSION_ID,EXPECTED_CRON,EXPECTED_D1_DATABASE_ID,EXPECTED_ROLLBACK_VERSION_ID,RETAINED_OLDER_VERSION_ID};
export const WORKER_NAME='teamsheet-data-platform';
export const EXPECTED_PRODUCTION_HOSTNAME='data.fpltsheet.co.uk';
export const EXPECTED_D1_DATABASE_NAME='teamsheet-data';
export const EXPECTED_SEASON='2026-27';
export const EXPECTED_SOURCE_REVISION_ID='official-fpl-r1';
export const EXPECTED_RUN_TYPE='official_fpl_structured_history';
export const EXPECTED_ENDPOINT_CLASS='official_fpl_public_core';

export const REQUIRED_D1_TABLES=Object.freeze(['canonical_entities','data_source_revisions','data_sources','ingestion_runs','observation_heads','schema_migrations','shadow_observations']);
export const EXPECTED_D1_MIGRATIONS=Object.freeze(['1:shadow_data_foundation','2:official_fpl_structured_history']);

export const DIAGNOSTIC_STATUSES=Object.freeze(['PASS','FAIL','PARTIAL','PENDING','SUPERSEDED']);

// Every row the owner asked the single consolidated read to answer, in report order.
export const DIAGNOSTIC_ROWS=Object.freeze([
  'worker_version_deployment','cron_triggers','collector_cadence','fetch_transport',
  'bootstrap_static_evidence','fixtures_evidence','season_validation','baseline_ingestion',
  'unchanged_cycle_proof','changed_fact_proof','d1_observations_heads_orphans','ingestion_bookkeeping',
  'cpu_resource_suitability','d1_accounting','rollback_stop_evidence','observability',
  'provider_data_security_boundaries'
]);

// Only these conditions may stop the run. Everything else is recorded and the read continues.
export const FATAL_DIAGNOSTIC_CODES=Object.freeze([
  'diagnostics_repository_identity_missing','diagnostics_production_account_ambiguous',
  'diagnostics_worker_identity_mismatch','diagnostics_database_identity_mismatch',
  'diagnostics_endpoint_forbidden','diagnostics_sql_forbidden','diagnostics_api_unauthorized',
  'diagnostics_response_malformed','diagnostics_response_unbounded','diagnostics_secret_exposure_risk',
  'diagnostics_mutation_required','diagnostics_fatal_code_unknown'
]);
const FATAL=new Set(FATAL_DIAGNOSTIC_CODES);

export class DiagnosticFatalError extends Error{
  constructor(code){super(FATAL.has(code)?code:'diagnostics_fatal_code_unknown');this.name='DiagnosticFatalError';this.code=this.message;}
}
export function fatal(code){throw new DiagnosticFatalError(code);}
export function isFatalDiagnostic(error){return error instanceof DiagnosticFatalError&&FATAL.has(error.code);}

// ---------------------------------------------------------------- bounded sanitizers
export const MAX_ROWS=Object.freeze({deployments:50,versions:200,schedules:10,domains:500,d1:50,evidence:12});
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
export const safeId=value=>typeof value==='string'&&/^[A-Za-z0-9_.:@-]{1,64}$/.test(value)?value:'[invalid]';
export const safeVersionId=value=>typeof value==='string'&&UUID.test(value)?value:'[invalid]';
export const safeCron=value=>typeof value==='string'&&/^[0-9*/?,\- ]{1,64}$/.test(value)?value:'[invalid]';
export const safeSeason=value=>typeof value==='string'&&/^\d{4}-\d{2}$/.test(value)?value:'[invalid]';
export const safeTimestamp=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)?value:'[invalid]';
export const safeCount=value=>Number.isFinite(Number(value))?Number(value):'[invalid]';
export const safeFlag=value=>value===true?'true':value===false?'false':'[invalid]';

function boundedRows(rows,limit,code='diagnostics_response_unbounded'){
  if(!Array.isArray(rows))fatal('diagnostics_response_malformed');
  if(rows.length>limit)fatal(code);
  return rows;
}
const numeric=value=>{const number=Number(value);return Number.isFinite(number)?number:null;};

// ---------------------------------------------------------------- read-only surfaces
export const DIAGNOSTIC_QUERIES=Object.freeze({
  schema:PHASE0_QUERIES.schema,
  migrations:PHASE0_QUERIES.migrations,
  governance:PHASE0_QUERIES.governance,
  counts:PHASE0_QUERIES.counts,
  officialHistory:PHASE0_QUERIES.officialHistory,
  source:PHASE1_QUERIES.source,
  revision:PHASE1_QUERIES.revision,
  runStatusTotals:`SELECT status, COUNT(*) AS runs, SUM(records_seen) AS records_seen,
    SUM(records_accepted) AS records_accepted, SUM(records_quarantined) AS records_quarantined,
    SUM(records_rejected) AS records_rejected
    FROM ingestion_runs WHERE source_revision_id = 'official-fpl-r1' GROUP BY status ORDER BY status LIMIT 20`,
  runLedger:`SELECT r.run_id AS run_id, r.run_type AS run_type, r.mode AS mode, r.status AS status,
    r.safe_endpoint_class AS safe_endpoint_class, r.started_at AS started_at, r.completed_at AS completed_at,
    r.records_seen AS records_seen, r.records_accepted AS records_accepted,
    r.records_quarantined AS records_quarantined, r.records_rejected AS records_rejected,
    r.error_class AS error_class, r.schema_version AS schema_version,
    COUNT(o.observation_id) AS observations, COUNT(h.logical_key) AS heads
    FROM ingestion_runs r
    LEFT JOIN shadow_observations o ON o.ingestion_run_id = r.run_id AND o.source_revision_id = r.source_revision_id
    LEFT JOIN observation_heads h ON h.logical_key = o.logical_key AND h.observation_id = o.observation_id
    WHERE r.source_revision_id = 'official-fpl-r1'
    GROUP BY r.run_id ORDER BY r.started_at DESC, r.run_id DESC LIMIT 20`,
  consistency:`SELECT
    (SELECT COUNT(*) FROM observation_heads) AS total_heads,
    (SELECT COUNT(*) FROM observation_heads h LEFT JOIN shadow_observations o ON o.observation_id = h.observation_id WHERE o.observation_id IS NULL) AS orphan_heads,
    (SELECT COUNT(*) FROM observation_heads h JOIN shadow_observations o ON o.observation_id = h.observation_id WHERE o.source_revision_id <> 'official-fpl-r1') AS foreign_heads,
    (SELECT COUNT(*) FROM shadow_observations WHERE admission_state <> 'accepted') AS non_accepted_observations,
    (SELECT COUNT(*) FROM shadow_observations WHERE mode <> 'shadow_only') AS non_shadow_observations,
    (SELECT COUNT(DISTINCT logical_key) FROM shadow_observations WHERE source_revision_id = 'official-fpl-r1') AS distinct_logical_keys,
    (SELECT COUNT(*) FROM shadow_observations o LEFT JOIN ingestion_runs r ON r.run_id = o.ingestion_run_id AND r.source_revision_id = o.source_revision_id WHERE r.run_id IS NULL) AS unparented_observations`,
  categories:`SELECT category, subject_type, COUNT(*) AS observations, COUNT(DISTINCT subject_entity_id) AS subjects
    FROM shadow_observations WHERE source_revision_id = 'official-fpl-r1'
    GROUP BY category, subject_type ORDER BY category, subject_type LIMIT 20`,
  seasons:`SELECT season, entity_type, COUNT(*) AS entities FROM canonical_entities
    GROUP BY season, entity_type ORDER BY season, entity_type LIMIT 20`,
  revisions:`SELECT
    (SELECT COUNT(*) FROM (SELECT logical_key FROM shadow_observations WHERE source_revision_id = 'official-fpl-r1' GROUP BY logical_key HAVING COUNT(*) > 1)) AS revised_logical_keys,
    (SELECT COUNT(*) FROM observation_heads h JOIN shadow_observations o ON o.observation_id = h.observation_id
      JOIN (SELECT logical_key AS lk, MAX(fetched_at) AS latest FROM shadow_observations WHERE source_revision_id = 'official-fpl-r1' GROUP BY logical_key HAVING COUNT(*) > 1) v
      ON v.lk = o.logical_key WHERE o.fetched_at = v.latest) AS advanced_heads,
    (SELECT COUNT(DISTINCT input_revision) FROM shadow_observations WHERE source_revision_id = 'official-fpl-r1') AS distinct_input_revisions,
    (SELECT COUNT(DISTINCT ingestion_run_id) FROM shadow_observations WHERE source_revision_id = 'official-fpl-r1') AS contributing_runs`,
  rejections:`SELECT reason_code, COUNT(*) AS rejections FROM observation_rejections GROUP BY reason_code ORDER BY reason_code LIMIT 20`
});
// Membership is checked against the raw pinned text, so no comment-stripped or
// otherwise rewritten statement can be smuggled past the allowlist.
const ALLOWED_SQL=new Set(Object.values(DIAGNOSTIC_QUERIES));
for(const sql of ALLOWED_SQL)validateReadOnlySql(sql);

export function assertAllowedDiagnosticSql(sql){
  if(typeof sql!=='string'||!ALLOWED_SQL.has(sql))fatal('diagnostics_sql_forbidden');
  try{return validateReadOnlySql(sql);}catch{return fatal('diagnostics_sql_forbidden');}
}

function escapeRegex(value){return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}

export function assertReadOnlyDiagnosticRequest({method='GET',path,workerBase,d1Base,sql}){
  if(typeof path!=='string'||typeof workerBase!=='string'||!workerBase||typeof d1Base!=='string')fatal('diagnostics_endpoint_forbidden');
  const accountBase=workerBase.split('/workers/scripts/')[0];
  const reads=new Set([
    `${workerBase}/deployments`,`${workerBase}/versions?deployable=true`,
    `${workerBase}/schedules`,`${workerBase}/settings`,`${accountBase}/workers/domains`
  ]);
  const versionDetail=new RegExp(`^${escapeRegex(workerBase)}/versions/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$`);
  const validD1Base=/^\/accounts\/[^/]+\/d1\/database\/[^/]+$/.test(d1Base);
  const d1Metadata=validD1Base&&path===`${d1Base}?fields=uuid,name,file_size`;
  if(method==='GET'&&(reads.has(path)||versionDetail.test(path)||d1Metadata))return {method:'GET'};
  if(method==='POST'&&validD1Base&&path===`${d1Base}/query`)return {method:'POST',body:{sql:assertAllowedDiagnosticSql(sql)}};
  return fatal('diagnostics_endpoint_forbidden');
}

// ---------------------------------------------------------------- identity gates
export function assertProductionIdentity({accountId,accountFingerprint,expectedProductionFingerprint,workerName,databaseId,databaseName,hostnames}){
  if(typeof accountId!=='string'||!accountId)fatal('diagnostics_production_account_ambiguous');
  if(typeof accountFingerprint!=='string'||!/^sha256:[0-9a-f]{64}$/.test(accountFingerprint))fatal('diagnostics_production_account_ambiguous');
  let fingerprintCheck='NOT PROVIDED';
  if(typeof expectedProductionFingerprint==='string'&&expectedProductionFingerprint.trim()){
    if(!/^sha256:[0-9a-f]{64}$/.test(expectedProductionFingerprint))fatal('diagnostics_production_account_ambiguous');
    if(expectedProductionFingerprint!==accountFingerprint)fatal('diagnostics_production_account_ambiguous');
    fingerprintCheck='MATCHED';
  }
  if(workerName!==WORKER_NAME)fatal('diagnostics_worker_identity_mismatch');
  if(!Array.isArray(hostnames)||hostnames.length!==1||hostnames[0]!==EXPECTED_PRODUCTION_HOSTNAME)fatal('diagnostics_worker_identity_mismatch');
  if(databaseId!==EXPECTED_D1_DATABASE_ID||databaseName!==EXPECTED_D1_DATABASE_NAME)fatal('diagnostics_database_identity_mismatch');
  return {fingerprintCheck,worker:WORKER_NAME,hostname:EXPECTED_PRODUCTION_HOSTNAME,database:EXPECTED_D1_DATABASE_NAME};
}

// ---------------------------------------------------------------- bounded extractors
export function extractActiveDeployment(result){
  if(!result||!Array.isArray(result.deployments))fatal('diagnostics_response_malformed');
  const rows=boundedRows(result.deployments,MAX_ROWS.deployments);
  const current=rows[0];
  if(!current||typeof current.id!=='string'||!current.id||!Array.isArray(current.versions))fatal('diagnostics_response_malformed');
  const versions=boundedRows(current.versions,MAX_ROWS.deployments).map(row=>({
    versionId:safeVersionId(row?.version_id),percentage:safeCount(row?.percentage)
  }));
  const priorVersionIds=[...new Set(rows.slice(1).flatMap(row=>Array.isArray(row?.versions)?row.versions:[]).map(row=>row?.version_id).filter(id=>typeof id==='string'&&UUID.test(id)))];
  return {deploymentId:safeId(current.id),deploymentCount:rows.length,versions,priorVersionIds};
}

export function extractDeployableVersions(result){
  if(!result||!Array.isArray(result.items))fatal('diagnostics_response_malformed');
  const ids=boundedRows(result.items,MAX_ROWS.versions).map(row=>row?.id);
  if(ids.some(id=>typeof id!=='string'||!UUID.test(id)))fatal('diagnostics_response_malformed');
  if(new Set(ids).size!==ids.length)fatal('diagnostics_response_malformed');
  return ids;
}

export function extractWorkerHostnames(result){
  const rows=boundedRows(Array.isArray(result)?result:fatal('diagnostics_response_malformed'),MAX_ROWS.domains);
  return rows.filter(row=>row?.service===WORKER_NAME).map(row=>typeof row?.hostname==='string'?row.hostname:'[invalid]').sort();
}

// The D1 binding is read from whichever Version is genuinely active, never from a
// repository pin: a stale pin must be recorded as drift, not used to address D1.
export function extractVersionFacts(detail){
  if(!detail||typeof detail.id!=='string'||!UUID.test(detail.id)||!detail.resources)fatal('diagnostics_response_malformed');
  const bindings=boundedRows(detail.resources.bindings,MAX_ROWS.versions);
  const names=bindings.map(row=>row?.name);
  if(names.some(name=>typeof name!=='string')||new Set(names).size!==names.length)fatal('diagnostics_response_malformed');
  const exposed=bindings.filter(row=>row?.type==='secret_text'&&Object.hasOwn(row,'text'));
  if(exposed.length)fatal('diagnostics_secret_exposure_risk');
  const d1=bindings.filter(row=>row?.type==='d1');
  if(d1.length!==1||typeof d1[0].database_id!=='string'||!d1[0].database_id)fatal('diagnostics_database_identity_mismatch');
  const season=bindings.find(row=>row?.name==='DATA_S2_SEASON');
  return {
    versionId:detail.id,
    databaseId:d1[0].database_id,
    databaseBindingName:safeId(d1[0].name),
    compatibilityDate:safeId(detail.resources.script_runtime?.compatibility_date),
    bindings:bindings.map(row=>({name:safeId(row.name),type:safeId(row.type)})),
    season:season?safeSeason(season.text):'[absent]'
  };
}

export function extractCronExpressions(result){
  if(!result||!Array.isArray(result.schedules))fatal('diagnostics_response_malformed');
  return boundedRows(result.schedules,MAX_ROWS.schedules).map(row=>safeCron(typeof row==='string'?row:row?.cron));
}

export function extractObservability(settings){
  if(!settings||typeof settings!=='object')fatal('diagnostics_response_malformed');
  const observability=settings.observability&&typeof settings.observability==='object'?settings.observability:null;
  return {
    enabled:observability?safeFlag(observability.enabled===true):'[absent]',
    headSamplingRate:observability&&observability.head_sampling_rate!=null?safeCount(observability.head_sampling_rate):'[absent]',
    logpush:Object.hasOwn(settings,'logpush')?safeFlag(settings.logpush===true):'[absent]'
  };
}

export function extractD1Metadata(result){
  if(!result||typeof result!=='object')fatal('diagnostics_response_malformed');
  if(typeof result.uuid!=='string'||!result.uuid||typeof result.name!=='string')fatal('diagnostics_response_malformed');
  if(typeof result.file_size!=='number'||!Number.isFinite(result.file_size)||result.file_size<0)fatal('diagnostics_response_malformed');
  return {uuid:result.uuid,name:result.name,fileSize:result.file_size};
}

export function extractQueryRows(rows,limit=MAX_ROWS.d1){return boundedRows(rows,limit);}

// ---------------------------------------------------------------- status matrix rows
const EVIDENCE_LIMIT=MAX_ROWS.evidence;
export function diagnosticRow(id,status,evidence){
  if(!DIAGNOSTIC_ROWS.includes(id))fatal('diagnostics_fatal_code_unknown');
  if(!DIAGNOSTIC_STATUSES.includes(status))fatal('diagnostics_fatal_code_unknown');
  const bounded=(Array.isArray(evidence)?evidence:[]).slice(0,EVIDENCE_LIMIT).map(entry=>String(entry).slice(0,160));
  return {id,status,evidence:bounded};
}
const worst=(...statuses)=>{
  const order=['PASS','SUPERSEDED','PARTIAL','PENDING','FAIL'];
  return statuses.reduce((current,next)=>order.indexOf(next)>order.indexOf(current)?next:current,'PASS');
};

export function classifyWorkerDeployment({active,deployableVersionIds,versionFacts,expectedCompatibilityDate='2026-08-22'}){
  const full=active.versions.filter(row=>row.percentage===100&&row.versionId!=='[invalid]');
  const issues=[];
  if(active.versions.length!==1||full.length!==1)issues.push('traffic_split_or_ambiguous');
  const activeVersionId=full[0]?.versionId??active.versions[0]?.versionId??'[invalid]';
  if(versionFacts.compatibilityDate!==expectedCompatibilityDate)issues.push('compatibility_date_drift');
  if(versionFacts.season!==EXPECTED_SEASON)issues.push('season_binding_drift');
  if(!Array.isArray(deployableVersionIds)||!deployableVersionIds.includes(activeVersionId))issues.push('active_version_not_deployable');
  const superseded=activeVersionId!==EXPECTED_ACTIVE_VERSION_ID;
  const status=issues.length?'FAIL':superseded?'SUPERSEDED':'PASS';
  return diagnosticRow('worker_version_deployment',status,[
    `active_version=${safeVersionId(activeVersionId)}`,
    `repository_pinned_version=${EXPECTED_ACTIVE_VERSION_ID}`,
    `traffic_percentage=${safeCount(full[0]?.percentage??active.versions[0]?.percentage)}`,
    `current_deployment_id=${active.deploymentId}`,
    `deployment_history_entries=${safeCount(active.deploymentCount)}`,
    `deployable_versions=${Array.isArray(deployableVersionIds)?deployableVersionIds.length:'[invalid]'}`,
    `compatibility_date=${versionFacts.compatibilityDate}`,
    issues.length?`issues=${issues.join('|')}`:'issues=none'
  ]);
}

export function classifyCronCadence(expressions){
  if(!Array.isArray(expressions))fatal('diagnostics_response_malformed');
  const daily=/^\d{1,2} \d{1,2} \* \* \*$/;
  if(expressions.length===0)return 'absent';
  if(expressions.length===1&&expressions[0]===EXPECTED_CRON)return 'matches_expectation';
  if(expressions.every(value=>daily.test(value)))return 'daily_only';
  return 'unexpected';
}

export function classifyCronTriggers(expressions){
  const classification=classifyCronCadence(expressions);
  const status=classification==='matches_expectation'?'PASS':'FAIL';
  return diagnosticRow('cron_triggers',status,[
    `schedule_count=${expressions.length}`,
    `expressions=${expressions.length?expressions.join(' , '):'none'}`,
    `repository_expectation=${EXPECTED_CRON}`,
    `classification=${classification}`,
    status==='FAIL'?'note=recorded_as_evidence_no_schedule_mutation_performed':'note=exact_expected_cadence'
  ]);
}

// The deployed collector refuses every schedule other than its own cadence constant,
// so a safe-looking schedule difference is still a live collection consequence.
export function classifyCollectorCadence({expressions,runLedger,collectorCron=EXPECTED_CRON}){
  const classification=classifyCronCadence(expressions);
  const compatible=classification==='matches_expectation';
  const starts=runLedger.map(run=>Date.parse(run.startedAt)).filter(Number.isFinite).sort((a,b)=>b-a);
  const gaps=starts.slice(1).map((value,index)=>Math.round((starts[index]-value)/60000)).filter(Number.isFinite);
  const status=!runLedger.length?'PENDING':compatible?'PASS':'FAIL';
  return diagnosticRow('collector_cadence',status,[
    `live_schedule_classification=${classification}`,
    `collector_required_cron=${collectorCron}`,
    `collector_accepts_live_schedule=${compatible?'true':'false'}`,
    compatible?'collector_guard=collect_paths_reachable':'collector_guard=cron_unrecognised_no_collection',
    `observed_runs_sampled=${runLedger.length}`,
    `observed_gap_minutes_min=${gaps.length?Math.min(...gaps):'[none]'}`,
    `observed_gap_minutes_max=${gaps.length?Math.max(...gaps):'[none]'}`
  ]);
}

export function classifyFetchTransport(runLedger){
  const completed=runLedger.filter(run=>run.status==='completed');
  const redirectFailures=runLedger.filter(run=>run.status==='failed'&&run.errorClass===KNOWN_REDIRECT_RUNTIME_ERROR_CLASS);
  const otherFailures=runLedger.filter(run=>run.status==='failed'&&run.errorClass!==KNOWN_REDIRECT_RUNTIME_ERROR_CLASS);
  const newestCompleted=completed.map(run=>Date.parse(run.startedAt)).filter(Number.isFinite).sort((a,b)=>b-a)[0]??null;
  const laterRedirect=newestCompleted===null?redirectFailures.length>0:redirectFailures.some(run=>Date.parse(run.startedAt)>newestCompleted);
  const status=!runLedger.length?'PENDING':laterRedirect?'FAIL':completed.length?'PASS':'PARTIAL';
  return diagnosticRow('fetch_transport',status,[
    `completed_runs=${completed.length}`,
    `retained_redirect_class_failures=${redirectFailures.length}`,
    `other_failed_runs=${otherFailures.length}`,
    `redirect_failure_after_latest_completed=${laterRedirect?'true':'false'}`,
    `endpoint_classes=${[...new Set(runLedger.map(run=>run.safeEndpointClass))].join('|')||'none'}`
  ]);
}

const CATEGORY_EXPECTATION=Object.freeze({
  official_fpl_event:{group:'bootstrap',minimumSubjects:30},
  official_fpl_team:{group:'bootstrap',minimumSubjects:20},
  official_fpl_player:{group:'bootstrap',minimumSubjects:400},
  official_fpl_fixture:{group:'fixtures',minimumSubjects:300}
});

function categoryGroupRow(id,categories,group){
  const expected=Object.entries(CATEGORY_EXPECTATION).filter(([,value])=>value.group===group);
  const present=expected.map(([name,rule])=>{
    const row=categories.find(entry=>entry.category===name);
    return {name,rule,subjects:row?Number(row.subjects):0,observations:row?Number(row.observations):0};
  });
  const unexpected=categories.filter(row=>!Object.hasOwn(CATEGORY_EXPECTATION,row.category));
  const missing=present.filter(row=>row.subjects===0);
  const short=present.filter(row=>row.subjects>0&&row.subjects<row.rule.minimumSubjects);
  const status=unexpected.length?'FAIL':missing.length===present.length?'PENDING':missing.length||short.length?'PARTIAL':'PASS';
  return diagnosticRow(id,status,[
    ...present.map(row=>`${row.name}: subjects=${row.subjects} observations=${row.observations} minimum=${row.rule.minimumSubjects}`),
    `unexpected_categories=${unexpected.length?unexpected.map(row=>safeId(row.category)).join('|'):'none'}`
  ]);
}
export function classifyBootstrapEvidence(categories){return categoryGroupRow('bootstrap_static_evidence',categories,'bootstrap');}
export function classifyFixturesEvidence(categories){return categoryGroupRow('fixtures_evidence',categories,'fixtures');}

export function classifySeasonValidation({seasons,versionFacts}){
  const observed=[...new Set(seasons.map(row=>safeSeason(row.season)))];
  const bindingMatch=versionFacts.season===EXPECTED_SEASON;
  const status=!observed.length?'PENDING':observed.length===1&&observed[0]===EXPECTED_SEASON&&bindingMatch?'PASS':'FAIL';
  return diagnosticRow('season_validation',status,[
    `canonical_entity_seasons=${observed.length?observed.join('|'):'none'}`,
    `expected_season=${EXPECTED_SEASON}`,
    `worker_season_binding=${versionFacts.season}`,
    `entity_types=${[...new Set(seasons.map(row=>safeId(row.entity_type)))].join('|')||'none'}`
  ]);
}

export function classifyBaselineIngestion({counts,official,statusTotals,runLedger}){
  const completed=runLedger.filter(run=>run.status==='completed');
  const populated=completed.filter(run=>Number(run.recordsSeen)>0&&Number(run.recordsAccepted)>0&&Number(run.observations)>0);
  const started=statusTotals.filter(row=>row.status==='started');
  const status=!completed.length?'PENDING':populated.length?'PASS':'PARTIAL';
  return diagnosticRow('baseline_ingestion',status,[
    `official_ingestion_runs=${safeCount(official?.ingestion_runs)}`,
    `total_ingestion_runs=${safeCount(counts?.ingestion_runs)}`,
    `status_totals=${statusTotals.map(row=>`${safeId(row.status)}:${safeCount(row.runs)}`).join('|')||'none'}`,
    `completed_runs_sampled=${completed.length}`,
    `populated_completed_runs=${populated.length}`,
    `unresolved_started_runs=${started.length?safeCount(started[0].runs):0}`,
    `official_observations=${safeCount(official?.shadow_observations)}`,
    `official_heads=${safeCount(official?.observation_heads)}`
  ]);
}

// An unchanged cycle is only proven when a completed run genuinely saw records,
// accepted none, wrote no observation and moved no head.
export function classifyUnchangedCycle(runLedger){
  const candidates=runLedger.filter(run=>run.status==='completed'&&Number(run.recordsSeen)>0&&Number(run.recordsAccepted)===0);
  const proven=candidates.filter(run=>Number(run.observations)===0&&Number(run.heads)===0);
  const status=proven.length?'PASS':candidates.length?'PARTIAL':'PENDING';
  return diagnosticRow('unchanged_cycle_proof',status,[
    `completed_runs_with_zero_accepted=${candidates.length}`,
    `of_those_writing_no_observation_and_no_head=${proven.length}`,
    proven.length?`example_run=${safeId(proven[0].runId)} records_seen=${safeCount(proven[0].recordsSeen)}`:'example_run=none',
    status==='PENDING'?'note=no_retained_completed_run_yet_reports_zero_acceptance':'note=derived_from_retained_completed_history'
  ]);
}

export function classifyChangedFact({revisions,runLedger}){
  const revised=numeric(revisions?.revised_logical_keys);
  const advanced=numeric(revisions?.advanced_heads);
  const contributing=numeric(revisions?.contributing_runs);
  const appending=runLedger.filter(run=>run.status==='completed'&&Number(run.recordsAccepted)>0&&Number(run.observations)===Number(run.recordsAccepted));
  const proven=revised!==null&&revised>0&&advanced!==null&&advanced>0&&appending.length>1;
  const status=proven?'PASS':revised===null?'PENDING':revised>0?'PARTIAL':contributing!==null&&contributing<2?'PENDING':'PARTIAL';
  return diagnosticRow('changed_fact_proof',status,[
    `logical_keys_with_multiple_observations=${safeCount(revised)}`,
    `heads_pointing_at_latest_revised_observation=${safeCount(advanced)}`,
    `distinct_input_revisions=${safeCount(revisions?.distinct_input_revisions)}`,
    `runs_contributing_observations=${safeCount(contributing)}`,
    `completed_runs_with_consistent_appended_counts=${appending.length}`,
    proven?'note=append_only_revision_and_head_advance_present':'note=no_official_fact_change_proven_from_retained_evidence'
  ]);
}

export function classifyConsistency({consistency,counts,official}){
  const orphan=numeric(consistency?.orphan_heads);
  const foreign=numeric(consistency?.foreign_heads);
  const heads=numeric(consistency?.total_heads);
  const nonAccepted=numeric(consistency?.non_accepted_observations);
  const nonShadow=numeric(consistency?.non_shadow_observations);
  const unparented=numeric(consistency?.unparented_observations);
  const observations=numeric(counts?.shadow_observations);
  const distinct=numeric(consistency?.distinct_logical_keys);
  const breaches=[];
  if(orphan!==0)breaches.push('orphan_heads');
  if(foreign!==0)breaches.push('foreign_source_heads');
  if(nonShadow!==0)breaches.push('non_shadow_observations');
  if(unparented!==0)breaches.push('observations_without_run');
  if(heads!==null&&observations!==null&&heads>observations)breaches.push('heads_exceed_observations');
  if(heads!==null&&distinct!==null&&heads<distinct)breaches.push('heads_below_distinct_logical_keys');
  if(numeric(official?.observation_heads)!==null&&heads!==null&&numeric(official?.observation_heads)>heads)breaches.push('official_head_count_contradiction');
  const status=breaches.length?'FAIL':heads===0?'PENDING':'PASS';
  return diagnosticRow('d1_observations_heads_orphans',status,[
    `official_observations=${safeCount(official?.shadow_observations)}`,
    `total_observations=${safeCount(observations)}`,
    `total_heads=${safeCount(heads)}`,
    `official_heads=${safeCount(official?.observation_heads)}`,
    `orphan_heads=${safeCount(orphan)}`,
    `distinct_logical_keys=${safeCount(distinct)}`,
    `quarantined_or_non_accepted_observations=${safeCount(nonAccepted)}`,
    `breaches=${breaches.length?breaches.join('|'):'none'}`
  ]);
}

export function classifyBookkeeping({runLedger,statusTotals,counts,official,rejections}){
  const breaches=[];
  for(const run of runLedger){
    if(run.runType!==EXPECTED_RUN_TYPE||run.mode!=='shadow_only')breaches.push('run_identity_drift');
    const seen=Number(run.recordsSeen),accepted=Number(run.recordsAccepted);
    if(!Number.isFinite(seen)||!Number.isFinite(accepted)||accepted<0||accepted>seen)breaches.push('counter_contradiction');
    if(run.status==='completed'&&Number(run.observations)!==accepted)breaches.push('observation_count_contradiction');
    if(run.status==='failed'&&(accepted!==0||Number(run.observations)!==0))breaches.push('failed_run_wrote_records');
  }
  const runTotal=numeric(counts?.ingestion_runs),officialTotal=numeric(official?.ingestion_runs);
  if(runTotal!==null&&officialTotal!==null&&runTotal!==officialTotal)breaches.push('non_official_ingestion_runs_present');
  const unique=[...new Set(breaches)];
  const status=unique.length?'FAIL':runLedger.length?'PASS':'PENDING';
  return diagnosticRow('ingestion_bookkeeping',status,[
    `sampled_runs=${runLedger.length}`,
    `status_totals=${statusTotals.map(row=>`${safeId(row.status)}:${safeCount(row.runs)}`).join('|')||'none'}`,
    `records_seen_total=${statusTotals.reduce((sum,row)=>sum+(numeric(row.records_seen)??0),0)}`,
    `records_accepted_total=${statusTotals.reduce((sum,row)=>sum+(numeric(row.records_accepted)??0),0)}`,
    `records_quarantined_total=${statusTotals.reduce((sum,row)=>sum+(numeric(row.records_quarantined)??0),0)}`,
    `records_rejected_total=${statusTotals.reduce((sum,row)=>sum+(numeric(row.records_rejected)??0),0)}`,
    `rejection_reasons=${rejections.map(row=>`${safeId(row.reason_code)}:${safeCount(row.rejections)}`).join('|')||'none'}`,
    `breaches=${unique.length?unique.join('|'):'none'}`
  ]);
}

// CPU time and D1 rows-read/rows-written are not exposed by the approved read surface.
// They are reported as unavailable rather than silently widened to another API.
export function classifyResourceSuitability({runLedger,metricsAvailability}){
  const durations=runLedger.filter(run=>run.status==='completed').map(run=>{
    const start=Date.parse(run.startedAt),end=Date.parse(run.completedAt);
    return Number.isFinite(start)&&Number.isFinite(end)?end-start:null;
  }).filter(value=>value!==null&&value>=0);
  return diagnosticRow('cpu_resource_suitability','PENDING',[
    `worker_cpu_time=${metricsAvailability.cpuTime}`,
    `d1_rows_read=${metricsAvailability.rowsRead}`,
    `d1_rows_written=${metricsAvailability.rowsWritten}`,
    `cron_invocation_counts=${metricsAvailability.invocations}`,
    `available_proxy_completed_run_wall_clock_ms_min=${durations.length?Math.min(...durations):'[none]'}`,
    `available_proxy_completed_run_wall_clock_ms_max=${durations.length?Math.max(...durations):'[none]'}`,
    `free_plan_limits_reverified_on=${VERIFIED_FREE_PLAN_LIMITS.verifiedOn} cpu_ms_per_cron_trigger=${VERIFIED_FREE_PLAN_LIMITS.workerCpuPerCronTriggerMs}`,
    `free_plan_d1_rows_read_per_day=${VERIFIED_FREE_PLAN_LIMITS.d1RowsReadPerDay} rows_written_per_day=${VERIFIED_FREE_PLAN_LIMITS.d1RowsWrittenPerDay}`,
    'note=wall_clock_is_not_cpu_time_and_does_not_establish_free_plan_suitability',
    'note=no_additional_analytics_permission_requested_by_this_diagnostic'
  ]);
}

export function classifyD1Accounting({database,counts,consistency,schema,migrations,governance}){
  const tables=(schema??[]).map(row=>safeId(row?.name)).sort();
  const applied=(migrations??[]).map(row=>`${safeCount(row?.version)}:${safeId(row?.name)}`);
  const breaches=[];
  if(schema&&JSON.stringify(tables)!==JSON.stringify([...REQUIRED_D1_TABLES]))breaches.push('schema_table_drift');
  if(migrations&&JSON.stringify(applied)!==JSON.stringify([...EXPECTED_D1_MIGRATIONS]))breaches.push('migration_drift');
  if(governance&&(numeric(governance.source_official_fpl)!==1||numeric(governance.official_fpl_r1)!==1))breaches.push('governance_row_drift');
  const size=numeric(database?.fileSize);
  const status=breaches.length?'FAIL':size===null?'PENDING':'PARTIAL';
  return diagnosticRow('d1_accounting',status,[
    `database_size_bytes=${safeCount(size)}`,
    `tables_present=${schema?`${tables.length}/${REQUIRED_D1_TABLES.length}`:'[unavailable]'}`,
    `applied_migrations=${migrations?applied.join('|')||'none':'[unavailable]'}`,
    `governance_rows=source:${safeCount(governance?.source_official_fpl)} revision:${safeCount(governance?.official_fpl_r1)}`,
    `ingestion_runs=${safeCount(counts?.ingestion_runs)} shadow_observations=${safeCount(counts?.shadow_observations)}`,
    `observation_heads=${safeCount(counts?.observation_heads)} canonical_entities=${safeCount(counts?.canonical_entities)}`,
    `distinct_logical_keys=${safeCount(consistency?.distinct_logical_keys)}`,
    `breaches=${breaches.length?breaches.join('|'):'none'}`,
    'note=byte-level_storage_accounting_is_size_only_no_first_party_row_metrics'
  ]);
}

export function classifyRollbackStop({deployableVersionIds,active,runLedger}){
  const ids=Array.isArray(deployableVersionIds)?deployableVersionIds:[];
  const activeVersionId=active.versions.find(row=>row.percentage===100)?.versionId??'[invalid]';
  const retained=[EXPECTED_ROLLBACK_VERSION_ID,RETAINED_OLDER_VERSION_ID].filter(id=>ids.includes(id));
  const alternatives=ids.filter(id=>id!==activeVersionId);
  const failedClosed=runLedger.filter(run=>run.status==='failed'&&Number(run.recordsAccepted)===0&&Number(run.observations)===0);
  const failed=runLedger.filter(run=>run.status==='failed');
  const status=!alternatives.length?'FAIL':failed.length&&failedClosed.length!==failed.length?'FAIL':'PASS';
  return diagnosticRow('rollback_stop_evidence',status,[
    `deployable_rollback_targets=${alternatives.length}`,
    `retained_expected_versions=${retained.length}/2`,
    `failed_runs_sampled=${failed.length}`,
    `failed_runs_that_wrote_nothing=${failedClosed.length}`,
    `prior_deployment_versions_retained=${active.priorVersionIds.length}`
  ]);
}

export function classifyObservability({observability,runLedger,metricsAvailability}){
  const failures=runLedger.filter(run=>run.status==='failed');
  const failuresWithClass=failures.filter(run=>typeof run.errorClass==='string'&&run.errorClass!=='[invalid]');
  const enabled=observability.enabled==='true';
  const classesRetained=failures.length===failuresWithClass.length;
  const status=!runLedger.length?'PENDING':!enabled&&!classesRetained?'FAIL':'PARTIAL';
  return diagnosticRow('observability',status,[
    `worker_observability_enabled=${observability.enabled}`,
    `head_sampling_rate=${observability.headSamplingRate}`,
    `logpush=${observability.logpush}`,
    `failed_runs_with_retained_error_class=${failuresWithClass.length}/${failures.length}`,
    `analytics_metrics=${metricsAvailability.cpuTime}`,
    'note=failure_classes_are_retained_in_d1_and_are_readable_without_log_access',
    'note=partial_until_first_party_cpu_and_row_metrics_are_separately_approved'
  ]);
}

export function classifyBoundaries({revisionRows,sourceRows,runLedger,consistency,categories}){
  const revision=Array.isArray(revisionRows)?revisionRows[0]:null;
  const source=Array.isArray(sourceRows)?sourceRows[0]:null;
  const breaches=[];
  if(source?.source_key!=='official-fpl'||source?.source_kind!=='official_fpl')breaches.push('source_governance_drift');
  if(revision?.rights_classification!=='durable_allowed'||Number(revision?.retention_allowed)!==1)breaches.push('retention_rights_drift');
  if(Number(revision?.redistribution_allowed)!==0)breaches.push('redistribution_rights_drift');
  if(Number(revision?.shadow_ingest_allowed)!==1)breaches.push('shadow_ingest_drift');
  if(runLedger.some(run=>run.mode!=='shadow_only'))breaches.push('non_shadow_run_mode');
  if(numeric(consistency?.non_shadow_observations)!==0)breaches.push('non_shadow_observations');
  if(runLedger.some(run=>run.safeEndpointClass!==EXPECTED_ENDPOINT_CLASS&&run.safeEndpointClass!=='[absent]'))breaches.push('unexpected_endpoint_class');
  if(categories.some(row=>!Object.hasOwn(CATEGORY_EXPECTATION,row.category)))breaches.push('unexpected_observation_category');
  const status=breaches.length?'FAIL':'PASS';
  return diagnosticRow('provider_data_security_boundaries',status,[
    `source_key=${safeId(source?.source_key)}`,
    `rights_classification=${safeId(revision?.rights_classification)}`,
    `retention_allowed=${safeCount(revision?.retention_allowed)}`,
    `redistribution_allowed=${safeCount(revision?.redistribution_allowed)}`,
    `shadow_ingest_allowed=${safeCount(revision?.shadow_ingest_allowed)}`,
    `run_modes=${[...new Set(runLedger.map(run=>safeId(run.mode)))].join('|')||'none'}`,
    `endpoint_classes=${[...new Set(runLedger.map(run=>safeId(run.safeEndpointClass)))].join('|')||'none'}`,
    `breaches=${breaches.length?breaches.join('|'):'none'}`
  ]);
}

// A run ledger row is normalised to bounded safe fields before any classifier sees it.
export function normaliseRunLedger(rows){
  return extractQueryRows(rows,MAX_ROWS.d1).map(row=>({
    runId:safeId(row?.run_id),runType:safeId(row?.run_type),mode:safeId(row?.mode),status:safeId(row?.status),
    safeEndpointClass:row?.safe_endpoint_class==null?'[absent]':safeId(row.safe_endpoint_class),
    startedAt:safeTimestamp(row?.started_at),completedAt:row?.completed_at==null?'[absent]':safeTimestamp(row.completed_at),
    recordsSeen:safeCount(row?.records_seen),recordsAccepted:safeCount(row?.records_accepted),
    recordsQuarantined:safeCount(row?.records_quarantined),recordsRejected:safeCount(row?.records_rejected),
    errorClass:row?.error_class==null?null:safeId(row.error_class),
    schemaVersion:safeId(row?.schema_version),
    observations:safeCount(row?.observations),heads:safeCount(row?.heads)
  }));
}

export function normaliseCategories(rows){
  return extractQueryRows(rows,MAX_ROWS.d1).map(row=>({
    category:safeId(row?.category),subjectType:safeId(row?.subject_type),
    observations:safeCount(row?.observations),subjects:safeCount(row?.subjects)
  }));
}

// ---------------------------------------------------------------- bounded reporting
// Re-verified against first-party Cloudflare documentation on 2 September 2026. These
// values are reported as context only: this diagnostic asserts no suitability verdict.
export const VERIFIED_FREE_PLAN_LIMITS=Object.freeze({
  verifiedOn:'2026-09-02',
  workerCpuPerCronTriggerMs:10,
  workerRequestsPerDay:100000,
  d1RowsReadPerDay:5000000,
  d1RowsWrittenPerDay:100000,
  d1StorageBytes:5368709120
});

export const METRICS_UNAVAILABLE=Object.freeze({
  cpuTime:'NOT AVAILABLE via approved read surface',
  rowsRead:'NOT AVAILABLE via approved read surface',
  rowsWritten:'NOT AVAILABLE via approved read surface',
  invocations:'NOT AVAILABLE via approved read surface'
});

export function buildDiagnosticMatrix(rows){
  if(!Array.isArray(rows))fatal('diagnostics_response_malformed');
  const byId=new Map(rows.map(row=>[row?.id,row]));
  if(byId.size!==rows.length)fatal('diagnostics_fatal_code_unknown');
  return DIAGNOSTIC_ROWS.map(id=>byId.get(id)??diagnosticRow(id,'PENDING',['note=check_did_not_produce_a_result']));
}

export function overallOutcome(matrix){
  if(matrix.some(row=>row.status==='FAIL'))return 'FAIL';
  if(matrix.some(row=>row.status!=='PASS'))return 'PARTIAL';
  return 'PASS';
}

// The retained report may never carry a credential, an account/database identifier or
// a raw provider response, so the emitted text is checked against the live values.
export function assertSanitizedOutput(text,forbidden){
  if(typeof text!=='string')fatal('diagnostics_secret_exposure_risk');
  for(const value of forbidden??[]){
    if(typeof value==='string'&&value.length>=8&&text.includes(value))fatal('diagnostics_secret_exposure_risk');
  }
  if(/Bearer\s+\S/i.test(text)||/CF-Access-Client-Secret/i.test(text)||/Authorization:/i.test(text))fatal('diagnostics_secret_exposure_risk');
  return text;
}

export function buildDiagnosticReport({approvedSha,identity,matrix,readOutcomes,generatedAt}){
  if(!/^[0-9a-f]{40}$/.test(approvedSha||''))fatal('diagnostics_repository_identity_missing');
  if(!safeTimestamp(generatedAt).startsWith('20'))fatal('diagnostics_response_malformed');
  const outcome=overallOutcome(matrix);
  const lines=[
    '## DATA-S2B Phase 4B — bounded read-only production diagnostics','',
    `- Evidence bundle: **${outcome}**`,
    `- Repository SHA: \`${approvedSha}\``,
    `- Generated at: ${generatedAt}`,
    `- Worker: \`${identity.worker}\` at \`${identity.hostname}\``,
    `- D1 database: \`${identity.database}\` (identity verified against the repository pin)`,
    `- Production account fingerprint cross-check: ${identity.fingerprintCheck}`,
    '','A completed bundle means the read finished and the evidence was gathered.',
    'It is **not** DATA-S2B production acceptance: read every row status below.','',
    '### Mutation accounting','',
    '- Worker Version uploads: 0','- Deployments: 0','- Cron mutations: 0','- D1 writes/migrations: 0',
    '- Route/domain mutations: 0','- Access mutations: 0','- Secret mutations: 0','- Collector executions: 0',
    '- Cleanup operations: 0','- Retries after ambiguous mutation: 0 (no mutation is reachable)','',
    '### Status matrix','','| Check | Status | Evidence |','|---|---|---|'
  ];
  // Evidence joins several values with a pipe, which would otherwise split the table cell.
  const cell=entry=>entry.replaceAll('|','\\|');
  for(const row of matrix)lines.push(`| \`${row.id}\` | **${row.status}** | ${row.evidence.map(cell).join('<br>')||'none'} |`);
  lines.push('','### Read outcomes','');
  for(const read of readOutcomes)lines.push(`- \`${read.name}\`: ${read.outcome}`);
  lines.push('','Raw Cloudflare responses, tokens, account and database identifiers are never retained.');
  return `${lines.join('\n')}\n`;
}

export function buildDiagnosticJson({approvedSha,identity,matrix,readOutcomes,generatedAt}){
  return {
    schema:'data-s2b-phase4b-readonly-diagnostics-v1',
    repositorySha:approvedSha,
    generatedAt,
    outcome:overallOutcome(matrix),
    identity:{worker:identity.worker,hostname:identity.hostname,database:identity.database,productionAccountFingerprintCheck:identity.fingerprintCheck},
    mutations:{versionUploads:0,deployments:0,cronMutations:0,d1Writes:0,routeMutations:0,accessMutations:0,secretMutations:0,collectorExecutions:0,cleanups:0,retries:0},
    matrix:matrix.map(row=>({check:row.id,status:row.status,evidence:row.evidence})),
    reads:readOutcomes.map(read=>({name:read.name,outcome:read.outcome}))
  };
}
