// DATA-S2B Phase 4B — bounded read-only production diagnostics runner.
//
// One protected run gathers the whole remaining read-only acceptance bundle. It owns no
// mutation surface: every request passes the diagnostics allowlist, every statement is
// one of the fixed diagnostic SELECTs, and there is no upload, deployment, schedule,
// D1 write, collector invocation, cleanup or post-mutation retry path to reach.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {extractD1QueryResult} from '../phase0/readonly-preflight.mjs';
import {
  DIAGNOSTIC_QUERIES,DIAGNOSTIC_REPORT_BEGIN,DIAGNOSTIC_REPORT_END,
  EXPECTED_D1_DATABASE_ID,EXPECTED_PRODUCTION_HOSTNAME,METRICS_UNAVAILABLE,WORKER_NAME,
  assertProductionIdentity,assertReadOnlyDiagnosticRequest,assertSanitizedOutput,buildDiagnosticJson,
  buildDiagnosticMatrix,buildDiagnosticReport,classifyBaselineIngestion,classifyBookkeeping,classifyBoundaries,
  classifyBootstrapEvidence,classifyChangedFact,classifyCollectorCadence,classifyConsistency,classifyCronTriggers,
  classifyD1Accounting,classifyFetchTransport,classifyFixturesEvidence,classifyObservability,
  classifyResourceSuitability,classifyRollbackStop,classifySeasonValidation,classifyUnchangedCycle,classifyWorkerDeployment,
  diagnosticRow,extractActiveDeployment,extractCronExpressions,extractD1Metadata,extractDeployableVersions,
  extractObservability,extractQueryRows,extractVersionFacts,extractWorkerHostnames,fatal,isFatalDiagnostic,
  normaliseCategories,normaliseRunLedger
} from './diagnostics-contract.mjs';

export const identityFingerprint=value=>`sha256:${createHash('sha256').update(String(value)).digest('hex')}`;

export function classifyReadResponse(status,parsed){
  if(status===401||status===403)fatal('diagnostics_api_unauthorized');
  if(!Number.isInteger(status)||status<200||status>=300)return {ok:false,outcome:`UNAVAILABLE (HTTP_${Number.isInteger(status)?status:'UNKNOWN'})`};
  if(!parsed||typeof parsed!=='object')fatal('diagnostics_response_malformed');
  if(parsed.success!==true)return {ok:false,outcome:'UNAVAILABLE (cloudflare_success_false)'};
  return {ok:true,result:parsed.result};
}

export function healthOutcome(status,body){
  if(status===200&&body?.ok===true&&body?.mode==='shadow_only')return 'PASS (HTTP 200, ok, shadow_only)';
  if(!Number.isInteger(status))return 'UNAVAILABLE (transport)';
  return `UNAVAILABLE (HTTP_${status})`;
}

// A safe check failure becomes a recorded FAIL row; only a fatal diagnostic stops the run.
export function guardedRow(id,build){
  try{return build();}
  catch(error){
    if(isFatalDiagnostic(error))throw error;
    return diagnosticRow(id,'FAIL',['note=check_could_not_be_evaluated','detail=[withheld]']);
  }
}

async function main(){
  const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID,approvedSha=process.env.APPROVED_SHA;
  const healthToken=process.env.DATA_S1_HTTP_AUTH_TOKEN,accessId=process.env.CF_ACCESS_CLIENT_ID,accessSecret=process.env.CF_ACCESS_CLIENT_SECRET;
  const expectedProductionFingerprint=process.env.PRODUCTION_ACCOUNT_FINGERPRINT;
  if(!/^[0-9a-f]{40}$/.test(approvedSha||''))fatal('diagnostics_repository_identity_missing');
  if(!token||!account)fatal('diagnostics_production_account_ambiguous');
  for(const value of [token,account,healthToken,accessId,accessSecret,expectedProductionFingerprint])if(value)process.stdout.write(`::add-mask::${value}\n`);

  const api='https://api.cloudflare.com/client/v4';
  const workerBase=`/accounts/${encodeURIComponent(account)}/workers/scripts/${WORKER_NAME}`;
  const accountBase=`/accounts/${encodeURIComponent(account)}`;
  let d1Base='';
  const readOutcomes=[];
  const request=async(name,path,{method='GET',sql}={})=>{
    const allowed=assertReadOnlyDiagnosticRequest({method,path,workerBase,d1Base,sql});
    const headers={Authorization:`Bearer ${token}`};
    if(allowed.body)headers['Content-Type']='application/json';
    let status,parsed;
    try{
      const response=await fetch(`${api}${path}`,{method:allowed.method,headers,body:allowed.body?JSON.stringify(allowed.body):undefined,redirect:'error'});
      status=response.status;
      const text=await response.text();
      if(text.length>2_000_000)fatal('diagnostics_response_unbounded');
      try{parsed=JSON.parse(text);}catch{parsed=null;if(status>=200&&status<300)fatal('diagnostics_response_malformed');}
    }catch(error){
      if(isFatalDiagnostic(error))throw error;
      readOutcomes.push({name,outcome:'UNAVAILABLE (transport)'});
      return {ok:false};
    }
    const outcome=classifyReadResponse(status,parsed);
    readOutcomes.push({name,outcome:outcome.ok?'PASS':outcome.outcome});
    return outcome;
  };
  const requireRead=async(name,path)=>{
    const outcome=await request(name,path);
    if(!outcome.ok)fatal('diagnostics_production_account_ambiguous');
    return outcome.result;
  };
  const query=async(name,sql)=>{
    const outcome=await request(name,`${d1Base}/query`,{method:'POST',sql});
    if(!outcome.ok)return null;
    try{return extractQueryRows(extractD1QueryResult(outcome.result));}
    catch(error){if(isFatalDiagnostic(error))throw error;readOutcomes[readOutcomes.length-1].outcome='UNAVAILABLE (result contract)';return null;}
  };

  // Identity is established from the genuinely active Version, never from a repository pin.
  const active=extractActiveDeployment(await requireRead('worker_deployments',`${workerBase}/deployments`));
  const activeVersionId=(active.versions.find(row=>row.percentage===100)??active.versions[0])?.versionId;
  if(typeof activeVersionId!=='string'||activeVersionId==='[invalid]')fatal('diagnostics_worker_identity_mismatch');
  const versionFacts=extractVersionFacts(await requireRead('active_version_detail',`${workerBase}/versions/${activeVersionId}`));
  if(versionFacts.databaseId!==EXPECTED_D1_DATABASE_ID)fatal('diagnostics_database_identity_mismatch');
  process.stdout.write(`::add-mask::${versionFacts.databaseId}\n`);
  const hostnames=extractWorkerHostnames(await requireRead('worker_domains',`${accountBase}/workers/domains`));
  d1Base=`${accountBase}/d1/database/${encodeURIComponent(versionFacts.databaseId)}`;
  const database=extractD1Metadata(await requireRead('d1_metadata',`${d1Base}?fields=uuid,name,file_size`));
  const identity=assertProductionIdentity({
    accountId:account,accountFingerprint:identityFingerprint(account),expectedProductionFingerprint,
    workerName:WORKER_NAME,databaseId:database.uuid,databaseName:database.name,hostnames
  });

  const versionsRead=await request('deployable_versions',`${workerBase}/versions?deployable=true`);
  const deployableVersionIds=versionsRead.ok?extractDeployableVersions(versionsRead.result):[];
  const schedulesRead=await request('worker_schedules',`${workerBase}/schedules`);
  const expressions=schedulesRead.ok?extractCronExpressions(schedulesRead.result):[];
  const settingsRead=await request('worker_settings',`${workerBase}/settings`);
  const observability=settingsRead.ok?extractObservability(settingsRead.result):{enabled:'[unavailable]',headSamplingRate:'[unavailable]',logpush:'[unavailable]'};

  const schema=await query('d1_schema_tables',DIAGNOSTIC_QUERIES.schema);
  const migrations=await query('d1_applied_migrations',DIAGNOSTIC_QUERIES.migrations);
  const governance=(await query('d1_governance_counts',DIAGNOSTIC_QUERIES.governance))?.[0]??null;
  const sourceRows=await query('d1_source_governance',DIAGNOSTIC_QUERIES.source);
  const revisionRows=await query('d1_revision_governance',DIAGNOSTIC_QUERIES.revision);
  const counts=(await query('d1_counts',DIAGNOSTIC_QUERIES.counts))?.[0]??null;
  const official=(await query('d1_official_history',DIAGNOSTIC_QUERIES.officialHistory))?.[0]??null;
  const statusTotals=(await query('d1_run_status_totals',DIAGNOSTIC_QUERIES.runStatusTotals))??[];
  const runLedger=normaliseRunLedger((await query('d1_run_ledger',DIAGNOSTIC_QUERIES.runLedger))??[]);
  const consistency=(await query('d1_consistency',DIAGNOSTIC_QUERIES.consistency))?.[0]??null;
  const categories=normaliseCategories((await query('d1_observation_categories',DIAGNOSTIC_QUERIES.categories))??[]);
  const seasons=(await query('d1_canonical_seasons',DIAGNOSTIC_QUERIES.seasons))??[];
  const revisions=(await query('d1_revised_facts',DIAGNOSTIC_QUERIES.revisions))?.[0]??null;
  const rejections=(await query('d1_rejections',DIAGNOSTIC_QUERIES.rejections))??[];

  if(healthToken&&accessId&&accessSecret){
    let status,body;
    try{
      const response=await fetch(`https://${EXPECTED_PRODUCTION_HOSTNAME}/v1/health`,{headers:{Authorization:`Bearer ${healthToken}`,'CF-Access-Client-Id':accessId,'CF-Access-Client-Secret':accessSecret},redirect:'error'});
      status=response.status;body=await response.json();
    }catch{status=null;}
    readOutcomes.push({name:'worker_health',outcome:healthOutcome(status,body)});
  }else readOutcomes.push({name:'worker_health',outcome:'NOT ATTEMPTED (health credentials absent)'});

  const metricsAvailability=METRICS_UNAVAILABLE;
  const matrix=buildDiagnosticMatrix([
    guardedRow('worker_version_deployment',()=>classifyWorkerDeployment({active,deployableVersionIds,versionFacts})),
    guardedRow('cron_triggers',()=>classifyCronTriggers(expressions)),
    guardedRow('collector_cadence',()=>classifyCollectorCadence({expressions,runLedger})),
    guardedRow('fetch_transport',()=>classifyFetchTransport(runLedger)),
    guardedRow('bootstrap_static_evidence',()=>classifyBootstrapEvidence(categories)),
    guardedRow('fixtures_evidence',()=>classifyFixturesEvidence(categories)),
    guardedRow('season_validation',()=>classifySeasonValidation({seasons,versionFacts})),
    guardedRow('baseline_ingestion',()=>classifyBaselineIngestion({counts,official,statusTotals,runLedger})),
    guardedRow('unchanged_cycle_proof',()=>classifyUnchangedCycle(runLedger)),
    guardedRow('changed_fact_proof',()=>classifyChangedFact({revisions,runLedger})),
    guardedRow('d1_observations_heads_orphans',()=>classifyConsistency({consistency,counts,official})),
    guardedRow('ingestion_bookkeeping',()=>classifyBookkeeping({runLedger,statusTotals,counts,official,rejections})),
    guardedRow('cpu_resource_suitability',()=>classifyResourceSuitability({runLedger,metricsAvailability})),
    guardedRow('d1_accounting',()=>classifyD1Accounting({database,counts,consistency,schema,migrations,governance})),
    guardedRow('rollback_stop_evidence',()=>classifyRollbackStop({deployableVersionIds,active,runLedger})),
    guardedRow('observability',()=>classifyObservability({observability,runLedger,metricsAvailability})),
    guardedRow('provider_data_security_boundaries',()=>classifyBoundaries({revisionRows,sourceRows,runLedger,consistency,categories}))
  ]);

  const generatedAt=new Date().toISOString();
  const forbidden=[token,account,versionFacts.databaseId,database.uuid,healthToken,accessId,accessSecret];
  const report=assertSanitizedOutput(buildDiagnosticReport({approvedSha,identity,matrix,readOutcomes,generatedAt}),forbidden);
  const json=buildDiagnosticJson({approvedSha,identity,matrix,readOutcomes,generatedAt});
  const serialised=assertSanitizedOutput(`${JSON.stringify(json,null,2)}\n`,forbidden);
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,report);
  if(process.env.DIAGNOSTICS_REPORT_PATH)fs.writeFileSync(process.env.DIAGNOSTICS_REPORT_PATH,serialised,{mode:0o600});
  // Third copy of the already-sanitized report, in the one place an agent session can always
  // read: the job log. It is the same string the artifact and step summary receive, after the
  // same assertSanitizedOutput clearance, so it widens legibility and not exposure.
  process.stdout.write(`${DIAGNOSTIC_REPORT_BEGIN}\n${report}${DIAGNOSTIC_REPORT_END}\n`);
  process.stdout.write(`diagnostic bundle outcome: ${json.outcome}\n`);
}

if(import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{
  process.stderr.write(`Phase 4B read-only diagnostics stopped: ${isFatalDiagnostic(error)?error.code:'diagnostics_unclassified_stop'}\n`);
  process.exitCode=1;
});
