import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {
  classifyApiResponse,extractD1DatabaseDetails,extractD1QueryResult,extractDeploymentsResult,
  extractSchedulesResult,extractWorkersDomains,validateReadOnlySql
} from '../phase0/readonly-preflight.mjs';
import {PHASE0_QUERIES} from '../phase0/queries.mjs';
import {PHASE1_QUERIES} from '../phase1/migrate-0002.mjs';
import {
  EXPECTED_ACTIVE_VERSION_ID,EXPECTED_CRON,EXPECTED_D1_DATABASE_ID,EXPECTED_ROLLBACK_VERSION_ID,
} from './live-contract.mjs';
import {
  EXPECTED_COMPATIBILITY_DATE,EXPECTED_PRODUCTION_HOSTNAME,EXPECTED_SEASON,WORKER_NAME,
  extractVersions,validateActiveVersion,validateDatabase,validateHealth
} from './preflight.mjs';

export const EXPECTED_PRODUCTION_ACCOUNT_SHA256='dbc3bff2fd3c60fc14b04d8b88a70303c567e0d5c0d9dc7d48dc614be5b921c4';
export const MAX_RUN_SUMMARIES=12;
export const STATUS=Object.freeze(['PASS','FAIL','PARTIAL','PENDING','SUPERSEDED']);
const safeCron=value=>typeof value==='string'&&/^[0-9*/?, -]{1,64}$/.test(value)?value:'[invalid]';
const safeText=value=>value===null?null:typeof value==='string'&&/^[A-Za-z0-9_.:+-]{0,64}$/.test(value)?value:'[invalid]';
const number=value=>Number.isFinite(Number(value))?Number(value):null;
const status=(state,evidence)=>({status:STATUS.includes(state)?state:'FAIL',evidence:String(evidence).slice(0,240)});

export function assertProductionIdentity({account,workerName=WORKER_NAME,databaseId=EXPECTED_D1_DATABASE_ID}){
  if(typeof account!=='string'||!/^[a-f0-9]{32}$/.test(account)||createHash('sha256').update(account).digest('hex')!==EXPECTED_PRODUCTION_ACCOUNT_SHA256)throw new Error('diagnostics_production_account_identity_mismatch');
  if(workerName!==WORKER_NAME||databaseId!==EXPECTED_D1_DATABASE_ID)throw new Error('diagnostics_production_resource_identity_mismatch');
  return true;
}
export function assertDiagnosticRequest({method='GET',path,workerBase,d1Base,sql}){
  const accountBase=workerBase.split('/workers/scripts/')[0];
  const gets=new Set([`${workerBase}/deployments`,`${workerBase}/versions?deployable=true`,`${workerBase}/schedules`,`${accountBase}/workers/domains`,`${d1Base}?fields=uuid,name,file_size`]);
  const detail=new RegExp(`^${workerBase.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}/versions/[0-9a-f-]{36}$`);
  if(method==='GET'&&(gets.has(path)||detail.test(path)))return {method:'GET'};
  if(method==='POST'&&path===`${d1Base}/query`&&DIAGNOSTIC_SQL.has(sql))return {method:'POST',body:{sql:validateReadOnlySql(sql)}};
  throw new Error('diagnostics_endpoint_forbidden');
}
export function classifyCron(rows){
  const expressions=Array.isArray(rows)?rows.slice(0,3).map(row=>safeCron(row?.cron)):[];
  let classification='unexpected',result='FAIL';
  if(expressions.length===0){classification='absent';result='FAIL';}
  else if(expressions.length===1&&expressions[0]===EXPECTED_CRON){classification='matches_repository_expectation';result='PASS';}
  else if(expressions.length===1&&/^(?:0\s+1\s+\*\s+\*\s+\*|0\s+1\s+\*\s+\*\s+\?)$/.test(expressions[0])){classification='daily_only';result='FAIL';}
  return {status:result,count:Array.isArray(rows)?rows.length:null,expressions,classification};
}
export function boundedRuns(rows){
  if(!Array.isArray(rows)||rows.length>MAX_RUN_SUMMARIES)throw new Error('diagnostics_runs_unbounded');
  return rows.map(row=>({
    started_at:safeText(row?.started_at),completed_at:safeText(row?.completed_at),status:safeText(row?.status),season:safeText(/^data-s2:(\d{4}-\d{2}):/.exec(row?.run_id||'')?.[1]??null),
    records_seen:number(row?.records_seen),records_accepted:number(row?.records_accepted),records_quarantined:number(row?.records_quarantined),records_rejected:number(row?.records_rejected),error_class:safeText(row?.error_class),observation_count:number(row?.observation_count),current_head_count:number(row?.current_head_count)
  }));
}
export function buildMatrix({worker,cron,d1,runs,aggregates,orphans,health}){
  const completed=runs.filter(row=>row.status==='completed'),failed=runs.filter(row=>row.status==='failed');
  const baseline=completed.find(row=>row.records_seen>0&&row.records_accepted>0&&row.observation_count===row.records_accepted);
  const unchanged=baseline&&completed.find(row=>row.started_at>baseline.started_at&&row.records_seen>0&&row.records_accepted===0&&row.observation_count===0);
  const changed=baseline&&completed.find(row=>row.started_at>baseline.started_at&&row.records_accepted>0&&row.observation_count===row.records_accepted&&row.current_head_count>0);
  const consistency=number(d1.official?.shadow_observations)===number(aggregates?.completed_records_accepted)&&number(d1.official?.observation_heads)>0&&number(d1.official?.observation_heads)<=number(d1.official?.shadow_observations)?'PASS':'FAIL';
  return {
    worker_version_deployment:status(worker.ok?'PASS':'FAIL',worker.summary),cron_triggers:status(cron.status,`${cron.classification}; count=${cron.count}; ${cron.expressions.join(',')}`),collector_cadence:status(cron.status==='PASS'?'PASS':'PARTIAL','daily gate remains repository-owned; live trigger classified above'),fetch_transport:status('PASS','promoted manual-redirect/reject-3xx Version'),bootstrap_static_evidence:status(baseline||number(aggregates?.populated_completed)>0?'PASS':'PENDING','populated atomic Official collection run assessment'),fixtures_evidence:status(baseline||number(aggregates?.populated_completed)>0?'PASS':'PENDING','same atomic Official collection run'),season_validation:status(runs.every(row=>row.season===EXPECTED_SEASON)?'PASS':'FAIL',EXPECTED_SEASON),baseline_ingestion:status(baseline||number(aggregates?.populated_completed)>0?'PASS':'PENDING',baseline?`seen=${baseline.records_seen}; accepted=${baseline.records_accepted}`:'aggregate only'),unchanged_cycle_proof:status(unchanged?'PASS':'PENDING',unchanged?'completed zero-append run after baseline':'not provable from bounded recent rows'),changed_fact_proof:status(changed?'PASS':'PENDING',changed?'post-baseline append with current head reference':'not provable'),d1_observations_heads_orphans:status(consistency==='PASS'&&orphans===0?'PASS':'FAIL',`observations=${d1.counts.shadow_observations}; heads=${d1.counts.observation_heads}; orphans=${orphans}`),ingestion_bookkeeping:status(number(aggregates?.completed)>0&&number(aggregates?.failed)>0&&number(aggregates?.started)===0?'PASS':'PARTIAL',`completed=${number(aggregates?.completed)}; failed=${number(aggregates?.failed)}; started=${number(aggregates?.started)}`),cpu_resource_suitability:status('PENDING','CPU/invocation analytics unavailable through approved read endpoints'),d1_accounting:status(d1.file_size!==null?'PARTIAL':'PENDING',`storage_bytes=${d1.file_size}; per-invocation rows unavailable`),rollback_stop_evidence:status(worker.rollback?'PASS':'FAIL',`rollback=${worker.rollback?'retained':'missing'}; read-only stop controls retained`),observability:status(health?'PARTIAL':'FAIL',health?'health PASS; analytics unavailable':'health failed'),provider_data_security_boundaries:status('PASS','Official FPL only; shadow-only; bounded sanitized read output')
  };
}

const RUNS_QUERY=`SELECT r.run_id,r.started_at,r.completed_at,r.status,r.records_seen,r.records_accepted,r.records_quarantined,r.records_rejected,r.error_class,
 (SELECT COUNT(*) FROM shadow_observations o WHERE o.ingestion_run_id=r.run_id AND o.source_revision_id=r.source_revision_id) observation_count,
 (SELECT COUNT(*) FROM observation_heads h JOIN shadow_observations o ON o.observation_id=h.observation_id WHERE o.ingestion_run_id=r.run_id AND o.source_revision_id=r.source_revision_id) current_head_count
 FROM ingestion_runs r WHERE r.source_revision_id='official-fpl-r1' ORDER BY r.started_at DESC,r.run_id DESC LIMIT 12`;
const ORPHANS_QUERY=`SELECT COUNT(*) orphan_heads FROM observation_heads h LEFT JOIN shadow_observations o ON o.observation_id=h.observation_id WHERE o.observation_id IS NULL`;
const RUN_AGGREGATES_QUERY=`SELECT COUNT(*) total,
 SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) completed,SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) failed,SUM(CASE WHEN status='started' THEN 1 ELSE 0 END) started,
 COALESCE(SUM(CASE WHEN status='completed' THEN records_accepted ELSE 0 END),0) completed_records_accepted,
 SUM(CASE WHEN status='completed' AND records_seen>0 AND records_accepted>0 THEN 1 ELSE 0 END) populated_completed
 FROM ingestion_runs WHERE source_revision_id='official-fpl-r1'`;
const OBJECTS_QUERY=`SELECT type,name FROM sqlite_schema WHERE name IN ('schema_migrations','data_sources','data_source_revisions','ingestion_runs','shadow_observations','observation_heads','canonical_entities','idx_shadow_observations_source_logical') ORDER BY type,name`;
const DIAGNOSTIC_SQL=new Set([...Object.values(PHASE0_QUERIES),PHASE1_QUERIES.source,PHASE1_QUERIES.revision,RUNS_QUERY,RUN_AGGREGATES_QUERY,ORPHANS_QUERY,OBJECTS_QUERY]);

async function main(){
  const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID,approvedSha=process.env.APPROVED_SHA;
  const healthToken=process.env.DATA_S1_HTTP_AUTH_TOKEN,accessId=process.env.CF_ACCESS_CLIENT_ID,accessSecret=process.env.CF_ACCESS_CLIENT_SECRET;
  if(!token||!healthToken||!accessId||!accessSecret||!/^[0-9a-f]{40}$/.test(approvedSha||''))throw new Error('diagnostics_required_identity_missing');
  assertProductionIdentity({account});for(const value of [token,account,healthToken,accessId,accessSecret])process.stdout.write(`::add-mask::${value}\n`);
  const api='https://api.cloudflare.com/client/v4',workerBase=`/accounts/${account}/workers/scripts/${WORKER_NAME}`,d1Base=`/accounts/${account}/d1/database/${EXPECTED_D1_DATABASE_ID}`;
  const request=async(path,{method='GET',sql}={})=>{const allowed=assertDiagnosticRequest({method,path,workerBase,d1Base,sql});let response,text;try{response=await fetch(`${api}${path}`,{method:allowed.method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:allowed.body?JSON.stringify(allowed.body):undefined,redirect:'error',signal:AbortSignal.timeout(15000)});text=await response.text();}catch{throw new Error('diagnostics_transport_failed');}let parsed;try{parsed=JSON.parse(text);}catch{throw new Error('diagnostics_response_malformed');}const result=classifyApiResponse(response.status,parsed);if(!result.ok)throw new Error(result.diagnostic);return result.result;};
  const query=async sql=>extractD1QueryResult(await request(`${d1Base}/query`,{method:'POST',sql}));
  const deployments=extractDeploymentsResult(await request(`${workerBase}/deployments`)),versions=extractVersions(await request(`${workerBase}/versions?deployable=true`));
  const active=deployments[0],activeId=active?.versions?.length===1?active.versions[0].version_id:null,traffic=active?.versions?.[0]?.percentage;
  if(!activeId)throw new Error('diagnostics_active_worker_ambiguous');
  const detail=await request(`${workerBase}/versions/${activeId}`);const workerOk=activeId===EXPECTED_ACTIVE_VERSION_ID&&traffic===100;let detailOk=false;try{validateActiveVersion(detail);detailOk=true;}catch{}
  const rollback=versions.includes(EXPECTED_ROLLBACK_VERSION_ID),domains=extractWorkersDomains(await request(`/accounts/${account}/workers/domains`));
  if(!domains.some(row=>row?.service===WORKER_NAME&&row?.hostname===EXPECTED_PRODUCTION_HOSTNAME))throw new Error('diagnostics_production_domain_identity_mismatch');
  const cron=classifyCron(extractSchedulesResult(await request(`${workerBase}/schedules`)));
  const database=validateDatabase(extractD1DatabaseDetails(await request(`${d1Base}?fields=uuid,name,file_size`),{uuid:EXPECTED_D1_DATABASE_ID}),EXPECTED_D1_DATABASE_ID);
  const [migrations,sourceRows,revisionRows,countsRows,officialRows,runsRows,aggregateRows,orphansRows,objects]=await Promise.all([query(PHASE0_QUERIES.migrations),query(PHASE1_QUERIES.source),query(PHASE1_QUERIES.revision),query(PHASE0_QUERIES.counts),query(PHASE0_QUERIES.officialHistory),query(RUNS_QUERY),query(RUN_AGGREGATES_QUERY),query(ORPHANS_QUERY),query(OBJECTS_QUERY)]);
  const runs=boundedRuns(runsRows);let health=false;try{const response=await fetch(`https://${EXPECTED_PRODUCTION_HOSTNAME}/v1/health`,{headers:{Authorization:`Bearer ${healthToken}`,'CF-Access-Client-Id':accessId,'CF-Access-Client-Secret':accessSecret},redirect:'error',signal:AbortSignal.timeout(15000)});validateHealth(response.status,await response.json());health=true;}catch{}
  const d1={migrations,sourceRows,revisionRows,counts:countsRows[0],official:officialRows[0],runs:runsRows,file_size:number(database.file_size),objects:objects.map(row=>({type:safeText(row.type),name:safeText(row.name)}))};
  const worker={ok:workerOk&&detailOk,rollback,summary:`deployment=${safeText(active.id)}; active=${safeText(activeId)}; traffic=${number(traffic)}; compatibility=${safeText(detail?.resources?.script_runtime?.compatibility_date)}`};
  const aggregates=aggregateRows[0];const matrix=buildMatrix({worker,cron,d1,runs,aggregates,orphans:number(orphansRows[0]?.orphan_heads),health});
  const report={schema:'data-s2b-production-diagnostics-v1',repository_sha:approvedSha,generated_at:new Date().toISOString(),worker:{...worker,active_version:safeText(activeId),traffic_percentage:number(traffic),deployment_id:safeText(active.id),rollback_retained:rollback},cron,d1:{file_size:d1.file_size,counts:d1.counts,official:d1.official,migrations:d1.migrations,source_rows:d1.sourceRows,revision_rows:d1.revisionRows,objects:d1.objects,orphan_heads:number(orphansRows[0]?.orphan_heads)},ingestion_aggregates:aggregates,runs,matrix,resources:{cpu_time:null,invocation_outcome:null,d1_rows_read:null,d1_rows_written:null,availability:'not_available_through_approved_read_endpoints'}};
  const output=JSON.stringify(report,null,2)+'\n';if(output.length>40000)throw new Error('diagnostics_report_unbounded');fs.writeFileSync(process.env.DIAGNOSTICS_OUTPUT,output);fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`## DATA-S2B bounded production diagnostics\n\n${Object.entries(matrix).map(([key,value])=>`- ${key}: **${value.status}** — ${value.evidence}`).join('\n')}\n`);
}
if(import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{process.stderr.write(`DATA-S2B diagnostics stopped: ${safeText(error.message)}\n`);process.exitCode=1;});
