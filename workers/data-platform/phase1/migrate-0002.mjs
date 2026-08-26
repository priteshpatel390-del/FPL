import fs from 'node:fs';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {
  assessCron,assessDeployments,assessMigrations,classifyApiResponse,extractD1DatabaseDetails,
  extractD1QueryResult,extractDeploymentsResult,extractSchedulesResult,extractWorkerSettingsResult,
  normaliseD1Binding,normalisePlainTextBinding,validateReadOnlySql,validateWorkerBindingSet
} from '../phase0/readonly-preflight.mjs';
import {PHASE0_QUERIES} from '../phase0/queries.mjs';

export const MIGRATION_PATH='workers/data-platform/migrations/0002_official_fpl_structured_history.sql';
export const MIGRATION_SHA256='a217726d5f164c3d117afed83201194004451384493f089914a7c42c725fde83';
export const MIGRATION_STATEMENT_COUNT=4;

export const PHASE1_QUERIES=Object.freeze({
  source:`SELECT source_id, source_key, source_name, source_kind, created_at
    FROM data_sources WHERE source_id = 'source-official-fpl'`,
  revision:`SELECT source_revision_id, source_id, revision, schema_version,
    rights_classification, retention_allowed, redistribution_allowed,
    attribution_required, attribution_text, terms_reference, terms_reviewed_at,
    acquisition_status, shadow_ingest_allowed, supersedes_revision_id, created_at
    FROM data_source_revisions WHERE source_revision_id = 'official-fpl-r1'`
});

function numeric(value){const number=Number(value);if(!Number.isFinite(number))throw new Error('numeric_contract_invalid');return number;}

export function migrationDigest(sql){
  return crypto.createHash('sha256').update(sql,'utf8').digest('hex');
}

export function validatePinnedMigration(sql){
  if(typeof sql!=='string'||migrationDigest(sql)!==MIGRATION_SHA256)throw new Error('migration_content_drift');
  if(!sql.includes("VALUES (2, 'official_fpl_structured_history'")||
     !sql.includes("VALUES ('source-official-fpl', 'official-fpl', 'Official FPL API', 'official_fpl'")||
     !sql.includes("'official-fpl-r1', 'source-official-fpl', 1, 'data-s2a-v1'"))throw new Error('migration_content_drift');
  return sql;
}

export function splitPinnedMigration(sql){
  const pinned=validatePinnedMigration(sql);
  const statements=pinned.split(';').map(statement=>statement.trim()).filter(Boolean);
  if(statements.length!==MIGRATION_STATEMENT_COUNT||statements[0]!=='PRAGMA foreign_keys = ON')throw new Error('migration_statement_contract_invalid');
  return statements;
}

export function extractBookmark(result){
  if(!result||typeof result.bookmark!=='string'||!result.bookmark)throw new Error('time_travel_bookmark_invalid');
  return result.bookmark;
}

export function extractMutationBatchResult(result){
  if(!Array.isArray(result)||result.length!==MIGRATION_STATEMENT_COUNT||result.some(row=>row?.success!==true))throw new Error('migration_batch_contract_invalid');
  return result;
}

export function validatePreState({migrations,governance,counts,official}){
  assessMigrations(migrations);
  if(numeric(governance?.source_official_fpl)!==0||numeric(governance?.official_fpl_r1)!==0)throw new Error('pre_governance_drift');
  const expected={data_sources:0,data_source_revisions:0,ingestion_runs:0,shadow_observations:0,observation_heads:0,canonical_entities:0};
  for(const [key,value] of Object.entries(expected))if(numeric(counts?.[key])!==value)throw new Error('pre_table_count_drift');
  for(const key of ['ingestion_runs','shadow_observations','observation_heads'])if(numeric(official?.[key])!==0)throw new Error('pre_official_history_drift');
  return true;
}

export function validatePostState({migrations,sourceRows,revisionRows,counts,official}){
  if(!Array.isArray(migrations)||migrations.length!==2)throw new Error('post_migration_drift');
  const first=migrations[0],second=migrations[1];
  if(numeric(first?.version)!==1||String(first?.name)!=='shadow_data_foundation'||
     numeric(second?.version)!==2||String(second?.name)!=='official_fpl_structured_history')throw new Error('post_migration_drift');

  if(!Array.isArray(sourceRows)||sourceRows.length!==1)throw new Error('post_source_governance_drift');
  const source=sourceRows[0];
  if(source.source_id!=='source-official-fpl'||source.source_key!=='official-fpl'||
     source.source_name!=='Official FPL API'||source.source_kind!=='official_fpl'||
     source.created_at!=='2026-08-26T00:00:00.000Z')throw new Error('post_source_governance_drift');

  if(!Array.isArray(revisionRows)||revisionRows.length!==1)throw new Error('post_revision_governance_drift');
  const revision=revisionRows[0];
  const exact={
    source_revision_id:'official-fpl-r1',source_id:'source-official-fpl',revision:1,schema_version:'data-s2a-v1',
    rights_classification:'durable_allowed',retention_allowed:1,redistribution_allowed:0,attribution_required:0,
    attribution_text:null,terms_reference:'docs/DATA_SOURCES.md',terms_reviewed_at:'2026-08-26T00:00:00.000Z',
    acquisition_status:'approved_internal_shadow_history',shadow_ingest_allowed:1,supersedes_revision_id:null,
    created_at:'2026-08-26T00:00:00.000Z'
  };
  for(const [key,value] of Object.entries(exact)){
    if(typeof value==='number'){if(numeric(revision[key])!==value)throw new Error('post_revision_governance_drift');}
    else if(revision[key]!==value)throw new Error('post_revision_governance_drift');
  }

  const expectedCounts={data_sources:1,data_source_revisions:1,ingestion_runs:0,shadow_observations:0,observation_heads:0,canonical_entities:0};
  for(const [key,value] of Object.entries(expectedCounts))if(numeric(counts?.[key])!==value)throw new Error('post_table_count_drift');
  for(const key of ['ingestion_runs','shadow_observations','observation_heads'])if(numeric(official?.[key])!==0)throw new Error('post_official_history_drift');
  return true;
}

export function sameDeployment(before,after){
  if(!before||!after||before.deploymentId!==after.deploymentId||before.versionId!==after.versionId||before.timestamp!==after.timestamp)throw new Error('worker_deployment_changed_during_migration');
  return true;
}

function assertPreMutationWorkerState(settings,schedules){
  validateWorkerBindingSet(settings,'pre');
  const season=settings.bindings.some(row=>row?.name==='DATA_S2_SEASON')?normalisePlainTextBinding(settings,'DATA_S2_SEASON').text:null;
  if(season!==null)throw new Error('season_var_unexpectedly_live');
  assessCron(schedules);
}

async function main(){
  const token=process.env.CLOUDFLARE_D1_WRITE_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID,temp=process.env.RUNNER_TEMP;
  if(!token||!account)throw new Error('required_cloudflare_credentials_missing');
  if(!temp)throw new Error('runner_temp_missing');
  process.stdout.write(`::add-mask::${token}\n::add-mask::${account}\n`);

  const base='https://api.cloudflare.com/client/v4';
  const request=async(path,{method='GET',body}={})=>{
    const response=await fetch(`${base}${path}`,{
      method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      body:body&&JSON.stringify(body),redirect:'error'
    });
    const text=await response.text();
    fs.writeFileSync(`${temp}/phase1-${crypto.randomUUID()}.json`,text,{mode:0o600});
    let parsed;try{parsed=JSON.parse(text);}catch{throw new Error(response.ok?'api_json_invalid':`HTTP_${response.status}`);}
    const outcome=classifyApiResponse(response.status,parsed);
    if(!outcome.ok)throw new Error(outcome.diagnostic);
    return outcome.result;
  };

  const workerBase=`/accounts/${encodeURIComponent(account)}/workers/scripts/teamsheet-data-platform`;
  const deploymentsBefore=assessDeployments(extractDeploymentsResult(await request(`${workerBase}/deployments`)));
  const settingsBefore=extractWorkerSettingsResult(await request(`${workerBase}/settings`));
  const schedulesBefore=extractSchedulesResult(await request(`${workerBase}/schedules`));
  assertPreMutationWorkerState(settingsBefore,schedulesBefore);

  const d1=normaliseD1Binding(settingsBefore);
  const databaseId=d1.databaseId;
  process.stdout.write(`::add-mask::${databaseId}\n`);
  const d1Base=`/accounts/${encodeURIComponent(account)}/d1/database/${encodeURIComponent(databaseId)}`;
  const databaseBefore=extractD1DatabaseDetails(await request(`${d1Base}?fields=uuid,name,file_size`),{uuid:databaseId});

  const query=async sql=>extractD1QueryResult(await request(`${d1Base}/query`,{
    method:'POST',body:{sql:validateReadOnlySql(sql)}
  }));

  const pre={
    migrations:await query(PHASE0_QUERIES.migrations),
    governance:(await query(PHASE0_QUERIES.governance))[0],
    counts:(await query(PHASE0_QUERIES.counts))[0],
    official:(await query(PHASE0_QUERIES.officialHistory))[0]
  };
  validatePreState(pre);

  const rollbackTimestamp=new Date().toISOString();
  const bookmark=extractBookmark(await request(`${d1Base}/time_travel/bookmark`));
  process.stdout.write(`::add-mask::${bookmark}\n`);
  fs.writeFileSync(`${temp}/phase1-bookmark.txt`,bookmark,{mode:0o600});
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `## DATA-S2B Phase 1 — Pre-mutation checkpoint\n\n- Repository SHA: \`${process.env.APPROVED_SHA}\`\n- Time Travel rollback checkpoint: captured at ${rollbackTimestamp}\n- Live migration had not yet been submitted at this checkpoint.\n\n`);

  const migration=fs.readFileSync(MIGRATION_PATH,'utf8');
  const batch=splitPinnedMigration(migration).map(sql=>({sql}));
  const migrationResult=await request(`${d1Base}/query`,{method:'POST',body:{batch}});
  extractMutationBatchResult(migrationResult);

  const post={
    migrations:await query(PHASE0_QUERIES.migrations),
    sourceRows:await query(PHASE1_QUERIES.source),
    revisionRows:await query(PHASE1_QUERIES.revision),
    counts:(await query(PHASE0_QUERIES.counts))[0],
    official:(await query(PHASE0_QUERIES.officialHistory))[0]
  };
  validatePostState(post);

  const settingsAfter=extractWorkerSettingsResult(await request(`${workerBase}/settings`));
  const schedulesAfter=extractSchedulesResult(await request(`${workerBase}/schedules`));
  assertPreMutationWorkerState(settingsAfter,schedulesAfter);
  const d1After=normaliseD1Binding(settingsAfter);
  if(d1After.databaseId!==databaseId)throw new Error('d1_binding_database_drift');
  const deploymentsAfter=assessDeployments(extractDeploymentsResult(await request(`${workerBase}/deployments`)));
  sameDeployment(deploymentsBefore,deploymentsAfter);
  const databaseAfter=extractD1DatabaseDetails(await request(`${d1Base}?fields=uuid,name,file_size`),{uuid:databaseId});

  const summary=[
    '## DATA-S2B Phase 1 — Migration 0002',
    '',
    '- Outcome: **PASS**',
    `- Repository SHA: \`${process.env.APPROVED_SHA}\``,
    '- Migration: `0002_official_fpl_structured_history.sql` applied exactly once as one transactional D1 batch',
    '- Governance source: `source-official-fpl` PASS',
    '- Governance revision: `official-fpl-r1` PASS',
    '- Rights: durable retention allowed; redistribution disabled; shadow ingest allowed',
    '- Observation/head writes caused by migration: none',
    '- Ingestion runs: 0',
    '- Cron expressions: none',
    '- DATA_S2_SEASON: ABSENT',
    '- Worker deployment/version: unchanged',
    '- D1 binding: `TEAMSHEET_DATA_DB` -> `teamsheet-data` unchanged',
    `- Database size before/after: ${databaseBefore.file_size} / ${databaseAfter.file_size}`,
    `- Time Travel rollback checkpoint: captured before mutation at ${rollbackTimestamp}`,
    '',
    'The exact Time Travel bookmark is masked and remains only in RUNNER_TEMP; if rollback is later approved, retrieve/restore by the recorded pre-mutation timestamp.',
    'Raw Cloudflare responses remain only in RUNNER_TEMP and are not uploaded.',
    'No Worker upload/deployment, trigger, route/domain, secret or environment mutation was performed.'
  ];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`${summary.join('\n')}\n`);
}

if(import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{
  process.stderr.write(`Phase 1 stopped: ${error.message}\n`);
  process.exitCode=1;
});
