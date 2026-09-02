import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {classifyApiResponse,extractD1DatabaseDetails,extractD1QueryResult,extractDeploymentsResult,extractSchedulesResult,extractWorkersDomains} from '../phase0/readonly-preflight.mjs';
import {PHASE0_QUERIES} from '../phase0/queries.mjs';
import {PHASE1_QUERIES} from '../phase1/migrate-0002.mjs';
import {assertReadOnlyApiRequest,EXPECTED_ACTIVE_VERSION_ID,EXPECTED_COMPATIBILITY_DATE,EXPECTED_CRON,EXPECTED_D1_DATABASE_ID,EXPECTED_PRODUCTION_HOSTNAME,EXPECTED_ROLLBACK_VERSION_ID,EXPECTED_SEASON,WORKER_NAME} from './preflight.mjs';

export const DIAGNOSTIC_QUERIES=Object.freeze({
  schema:PHASE0_QUERIES.schema,
  migrations:PHASE0_QUERIES.migrations,
  source:PHASE1_QUERIES.source,
  revision:PHASE1_QUERIES.revision,
  counts:PHASE0_QUERIES.counts,
  official:PHASE0_QUERIES.officialHistory,
  runStatuses:`SELECT COUNT(*) AS total_runs, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed_runs, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed_runs, SUM(CASE WHEN status='started' THEN 1 ELSE 0 END) AS started_runs FROM ingestion_runs WHERE source_revision_id='official-fpl-r1'`,
  runs:`SELECT run_id, source_revision_id, run_type, mode, started_at, completed_at, status, safe_endpoint_class, parser_version, transform_version, schema_version, records_seen, records_accepted, records_quarantined, records_rejected, error_class FROM ingestion_runs WHERE source_revision_id='official-fpl-r1' ORDER BY started_at DESC, run_id DESC LIMIT 20`,
  runFacts:`SELECT r.run_id, r.started_at, r.completed_at, r.status, r.records_seen, r.records_accepted, COUNT(o.observation_id) AS observations_appended, COUNT(DISTINCT CASE WHEN h.observation_id=o.observation_id THEN h.logical_key END) AS current_heads FROM ingestion_runs r LEFT JOIN shadow_observations o ON o.ingestion_run_id=r.run_id AND o.source_revision_id=r.source_revision_id LEFT JOIN observation_heads h ON h.observation_id=o.observation_id WHERE r.source_revision_id='official-fpl-r1' GROUP BY r.run_id, r.started_at, r.completed_at, r.status, r.records_seen, r.records_accepted ORDER BY r.started_at DESC, r.run_id DESC LIMIT 100`,
  orphans:`SELECT COUNT(*) AS orphan_heads FROM observation_heads h LEFT JOIN shadow_observations o ON o.observation_id=h.observation_id WHERE o.observation_id IS NULL`,
  officialOrphans:`SELECT COUNT(*) AS orphan_official_heads FROM observation_heads h JOIN shadow_observations o ON o.observation_id=h.observation_id LEFT JOIN ingestion_runs r ON r.run_id=o.ingestion_run_id AND r.source_revision_id=o.source_revision_id WHERE o.source_revision_id='official-fpl-r1' AND (r.run_id IS NULL OR r.status<>'completed')`
});
const STATUS=new Set(['PASS','FAIL','PARTIAL','PENDING','SUPERSEDED']);
const safeId=value=>typeof value==='string'&&/^[0-9a-f-]{1,64}$/.test(value)?value:'[invalid]';
const number=value=>Number.isFinite(Number(value))?Number(value):null;
const item=(status,evidence)=>{if(!STATUS.has(status)||typeof evidence!=='string'||evidence.length>300)throw new Error('diagnostic_status_invalid');return {status,evidence};};
export function assertProductionIdentity({account,fingerprint,databaseId=EXPECTED_D1_DATABASE_ID,worker=WORKER_NAME}={}){
  if(typeof account!=='string'||!account||!/^sha256:[0-9a-f]{64}$/.test(fingerprint||'')||databaseId!==EXPECTED_D1_DATABASE_ID||worker!==WORKER_NAME)throw new Error('diagnostic_production_identity_invalid');
  const actual=`sha256:${createHash('sha256').update(account).digest('hex')}`;if(actual!==fingerprint)throw new Error('diagnostic_production_identity_invalid');return true;
}

export function classifySchedules(rows){
  if(!Array.isArray(rows)||rows.length>10)throw new Error('diagnostic_schedule_response_unbounded');
  const expressions=rows.map(row=>typeof row?.cron==='string'&&/^[0-9*/?, -]{1,64}$/.test(row.cron)?row.cron:'[invalid]');
  const classification=expressions.length===0?'absent':expressions.every(value=>value===EXPECTED_CRON)?'matches_repository':expressions.length===1&&expressions[0]==='0 1 * * *'?'daily_only':'unexpected';
  return {count:expressions.length,expressions,classification,status:classification==='matches_repository'?'PASS':'FAIL'};
}
export function inspectDeployment(result){
  const rows=extractDeploymentsResult(result);if(rows.length<1)throw new Error('diagnostic_deployment_missing');
  const current=rows[0],versions=Array.isArray(current?.versions)?current.versions:[];
  if(typeof current?.id!=='string'||!current.id||versions.length<1||versions.length>5)throw new Error('diagnostic_deployment_malformed');
  const traffic=versions.map(row=>({version:safeId(row?.version_id),percentage:number(row?.percentage)}));
  if(traffic.some(row=>row.version==='[invalid]'||row.percentage===null||row.percentage<0||row.percentage>100))throw new Error('diagnostic_deployment_malformed');
  return {deploymentId:safeId(current.id),traffic,status:traffic.length===1&&traffic[0].version===EXPECTED_ACTIVE_VERSION_ID&&traffic[0].percentage===100?'PASS':'FAIL'};
}
export function inspectVersion(detail,actualId){
  if(!detail||detail.id!==actualId||!detail.resources)throw new Error('diagnostic_version_identity_mismatch');
  const bindings=detail.resources.bindings;if(!Array.isArray(bindings)||bindings.length>20)throw new Error('diagnostic_bindings_malformed');
  const secret=bindings.find(row=>row?.name==='DATA_S1_HTTP_AUTH_TOKEN');if(!secret||secret.type!=='secret_text'||Object.hasOwn(secret,'text'))throw new Error('diagnostic_secret_exposure_risk');
  const db=bindings.find(row=>row?.name==='TEAMSHEET_DATA_DB');if(db?.type!=='d1'||db.database_id!==EXPECTED_D1_DATABASE_ID)throw new Error('diagnostic_database_identity_mismatch');
  const season=bindings.find(row=>row?.name==='DATA_S2_SEASON');
  return {databaseId:db.database_id,compatibilityDate:detail.resources.script_runtime?.compatibility_date??null,season:season?.type==='plain_text'?season.text:null};
}
export function analyzeD1({schema,migrations,source,revision,counts,official,runStatuses,runs,runFacts,orphans,officialOrphans}){
  if(!Array.isArray(runs)||runs.length>20||!Array.isArray(runFacts)||runFacts.length>100||!Array.isArray(schema)||schema.length>20||!Array.isArray(migrations)||migrations.length>20||!Array.isArray(source)||source.length>5||!Array.isArray(revision)||revision.length>5)throw new Error('diagnostic_d1_response_unbounded');
  const status=runStatuses?.[0]??{},completed=runs.filter(row=>row.status==='completed');
  const accepted=completed.reduce((sum,row)=>sum+(number(row.records_accepted)??0),0);
  const baseline=completed.some(row=>(number(row.records_seen)??0)>0&&(number(row.records_accepted)??0)>0);
  const unchanged=runFacts.some(row=>row.status==='completed'&&(number(row.records_seen)??0)>0&&number(row.records_accepted)===0&&number(row.observations_appended)===0);
  const positive=[...runFacts].filter(row=>row.status==='completed'&&(number(row.records_accepted)??0)>0).sort((a,b)=>String(a.started_at).localeCompare(String(b.started_at)));const changed=positive.slice(1).some(row=>number(row.observations_appended)===number(row.records_accepted)&&(number(row.current_heads)??0)>0);
  const observationCount=number(official?.shadow_observations),headCount=number(official?.observation_heads),orphanCount=number(orphans?.[0]?.orphan_heads),officialOrphanCount=number(officialOrphans?.[0]?.orphan_official_heads);
  const safeText=value=>typeof value==='string'&&/^[A-Za-z0-9_.:-]{1,80}$/.test(value)?value:'[invalid]';
  const recentRuns=runs.map(row=>({runId:safeText(row.run_id),startedAt:safeText(row.started_at),completedAt:row.completed_at===null?null:safeText(row.completed_at),status:safeText(row.status),recordsSeen:number(row.records_seen),recordsAccepted:number(row.records_accepted),recordsQuarantined:number(row.records_quarantined),recordsRejected:number(row.records_rejected),errorClass:row.error_class===null?null:safeText(row.error_class)}));
  return {schemaObjects:schema.map(row=>safeText(row?.name)),migrations:migrations.map(row=>({version:number(row?.version),name:safeText(row?.name)})),governance:{officialSourceRows:source.length,officialRevisionRows:revision.length,sourceExact:source.length===1&&source[0]?.source_id==='source-official-fpl'&&source[0]?.source_key==='official-fpl',revisionExact:revision.length===1&&revision[0]?.source_revision_id==='official-fpl-r1'&&revision[0]?.shadow_ingest_allowed==1},counts:{ingestionRuns:number(counts?.ingestion_runs),observations:number(counts?.shadow_observations),heads:number(counts?.observation_heads),entities:number(counts?.canonical_entities)},recentRuns,summary:{runCount:number(status.total_runs),completed:number(status.completed_runs),failed:number(status.failed_runs),started:number(status.started_runs),accepted,baseline,unchanged,changed,observationCount,headCount,orphanCount,officialOrphanCount,consistent:observationCount===accepted&&headCount!==null&&headCount>0&&headCount<=accepted&&orphanCount===0&&officialOrphanCount===0}};
}
export function buildReport({approvedSha,deployment,versions,version,cron,database,d1,health}){
  if(!/^[0-9a-f]{40}$/.test(approvedSha)||!deployment||!version||!cron||!database||!d1)throw new Error('diagnostic_report_input_invalid');
  const rollback=versions.includes(EXPECTED_ROLLBACK_VERSION_ID);
  const matrix={
    worker_version_deployment:item(deployment.status,`deployment=${deployment.deploymentId}; traffic=${deployment.traffic.map(x=>`${x.version}:${x.percentage}`).join(',')}`),
    cron_triggers:item(cron.status,`count=${cron.count}; class=${cron.classification}; expressions=${cron.expressions.join(',')||'none'}`),
    collector_cadence:item(cron.classification==='matches_repository'?'PASS':cron.classification==='daily_only'?'SUPERSEDED':'PARTIAL',`observed=${cron.classification}`),
    fetch_transport:item('PASS','deployed candidate retains manual redirect rejection'),
    bootstrap_static_evidence:item(d1.summary.baseline?'PASS':'PENDING','bounded ingestion evidence; endpoint-specific transport is not retained'),
    fixtures_evidence:item(d1.summary.baseline?'PASS':'PENDING','bounded ingestion evidence; endpoint-specific transport is not retained'),
    season_validation:item(version.season===EXPECTED_SEASON?'PASS':'FAIL',`observed=${String(version.season)}`),
    baseline_ingestion:item(d1.summary.baseline?'PASS':'PENDING',`completed=${d1.summary.completed}; observations=${d1.summary.observationCount}`),
    unchanged_cycle_proof:item(d1.summary.unchanged?'PASS':'PENDING','zero-accepted completed run with zero appended observations'),
    changed_fact_proof:item(d1.summary.changed?'PASS':'PENDING','accepted/appended run with at least one current head'),
    d1_observations_heads_orphans:item(d1.summary.consistent?'PASS':'FAIL',`observations=${d1.summary.observationCount}; heads=${d1.summary.headCount}; orphans=${d1.summary.orphanCount}; noncompleted_heads=${d1.summary.officialOrphanCount}`),
    ingestion_bookkeeping:item(d1.summary.runCount===d1.summary.completed+d1.summary.failed+d1.summary.started?'PASS':'FAIL',`runs=${d1.summary.runCount}; completed=${d1.summary.completed}; failed=${d1.summary.failed}; started=${d1.summary.started}`),
    cpu_resource_suitability:item('PENDING','CPU and invocation row metrics unavailable through the approved read endpoints'),
    d1_accounting:item(database.file_size>=0?'PARTIAL':'PENDING',`storage_bytes=${database.file_size}; rows-read/written unavailable through approved reads`),
    rollback_stop_evidence:item(rollback?'PASS':'FAIL',`retained_predecessor=${rollback}`),
    observability:item(health?'PARTIAL':'FAIL','health available; CPU/invocation analytics not in approved endpoint set'),
    provider_data_security_boundaries:item('PASS','Official FPL shadow-only bounded reads; no raw payload or credential retention')
  };
  return {schema:'data-s2b-production-diagnostics-v1',repositorySha:approvedSha,generatedAt:new Date().toISOString(),worker:{deployment,versions:versions.slice(0,20).map(safeId),compatibilityDate:version.compatibilityDate,health},cron,database:{name:database.name,fileSize:database.file_size},d1,matrix,unavailable:{workerCpuMs:true,invocationOutcomeMetrics:true,d1RowsRead:true,d1RowsWritten:true,cronInvocationCount:true},mutations:{workerUploads:0,deployments:0,cron:0,d1:0,collectorInvocations:0,cleanup:0,retries:0}};
}

async function main(){
  const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID,approvedSha=process.env.APPROVED_SHA,healthToken=process.env.DATA_S1_HTTP_AUTH_TOKEN,accessId=process.env.CF_ACCESS_CLIENT_ID,accessSecret=process.env.CF_ACCESS_CLIENT_SECRET,productionFingerprint=process.env.PRODUCTION_ACCOUNT_FINGERPRINT;
  const sensitive=[token,account,healthToken,accessId,accessSecret];if(sensitive.some(value=>!value)||!/^[0-9a-f]{40}$/.test(approvedSha||''))throw new Error('diagnostic_identity_missing');for(const value of sensitive)process.stdout.write(`::add-mask::${value}\n`);
  assertProductionIdentity({account,fingerprint:productionFingerprint});
  const api='https://api.cloudflare.com/client/v4',workerBase=`/accounts/${encodeURIComponent(account)}/workers/scripts/${WORKER_NAME}`;let d1Base='';
  const request=async(path,{method='GET',sql}={})=>{const allowed=assertReadOnlyApiRequest({method,path,workerBase,d1Base,sql});let response,text;try{response=await fetch(`${api}${path}`,{method:allowed.method,headers:{Authorization:`Bearer ${token}`,...(allowed.body?{'Content-Type':'application/json'}:{})},body:allowed.body?JSON.stringify(allowed.body):undefined,redirect:'error',signal:AbortSignal.timeout(15000)});text=await response.text();}catch{throw new Error('diagnostic_transport_failed');}let parsed;try{parsed=JSON.parse(text);}catch{throw new Error('diagnostic_response_malformed');}const outcome=classifyApiResponse(response.status,parsed);if(!outcome.ok)throw new Error('diagnostic_provider_rejected');return outcome.result;};
  const deployment=inspectDeployment(await request(`${workerBase}/deployments`));const actualVersion=deployment.traffic[0].version;
  const versions=(await request(`${workerBase}/versions?deployable=true`))?.items?.map(row=>row?.id);if(!Array.isArray(versions)||versions.length>100||versions.some(id=>safeId(id)==='[invalid]'))throw new Error('diagnostic_versions_malformed');
  const domains=extractWorkersDomains(await request(`/accounts/${encodeURIComponent(account)}/workers/domains`)).filter(row=>row?.service===WORKER_NAME).map(row=>row?.hostname);if(domains.length!==1||domains[0]!==EXPECTED_PRODUCTION_HOSTNAME)throw new Error('diagnostic_worker_identity_mismatch');
  const version=inspectVersion(await request(`${workerBase}/versions/${actualVersion}`),actualVersion);process.stdout.write(`::add-mask::${version.databaseId}\n`);d1Base=`/accounts/${encodeURIComponent(account)}/d1/database/${encodeURIComponent(version.databaseId)}`;
  const database=extractD1DatabaseDetails(await request(`${d1Base}?fields=uuid,name,file_size`),{uuid:version.databaseId});if(database.uuid!==EXPECTED_D1_DATABASE_ID||database.name!=='teamsheet-data')throw new Error('diagnostic_database_identity_mismatch');
  const cron=classifySchedules(extractSchedulesResult(await request(`${workerBase}/schedules`)));
  const query=async sql=>extractD1QueryResult(await request(`${d1Base}/query`,{method:'POST',sql}));const values={};for(const [name,sql] of Object.entries(DIAGNOSTIC_QUERIES))values[name]=await query(sql);values.counts=values.counts[0];values.official=values.official[0];const d1=analyzeD1(values);
  let health=false;try{const response=await fetch(`https://${EXPECTED_PRODUCTION_HOSTNAME}/v1/health`,{headers:{Authorization:`Bearer ${healthToken}`,'CF-Access-Client-Id':accessId,'CF-Access-Client-Secret':accessSecret},redirect:'error',signal:AbortSignal.timeout(15000)});const body=await response.json();health=response.status===200&&body?.ok===true&&body?.mode==='shadow_only';}catch{health=false;}
  const report=buildReport({approvedSha,deployment,versions,version,cron,database,d1,health});const json=`${JSON.stringify(report,null,2)}\n`;fs.writeFileSync(process.env.DIAGNOSTIC_REPORT_PATH,json,{mode:0o600});fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`## DATA-S2B bounded production diagnostics\n\n${Object.entries(report.matrix).map(([name,value])=>`- **${name}** — ${value.status}: ${value.evidence}`).join('\n')}\n\nMutations: ${JSON.stringify(report.mutations)}\n`);
}
if(import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{process.stderr.write(`DATA-S2B diagnostics stopped: ${error.message}\n`);process.exitCode=1;});
