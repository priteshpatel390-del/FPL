import {createHash} from 'node:crypto';
import {appendFileSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {stableStringify} from '../../src/decision-intelligence/canonical.mjs';
import {EXPECTED_D1_DATABASE_ID} from '../data-platform/phase4b/live-contract.mjs';
import {
  classifyCollectorActivationPreflight,
  COLLECTOR_ACTIVATION_PREFLIGHT_VERSION,
  COLLECTOR_PREFLIGHT_REPOSITORY_STAGE
} from './activation-preflight.mjs';

export const API_FOOTBALL_ACTIVATION_LIVE_PREFLIGHT_VERSION='api-football-activation-live-preflight-v1';
export const CLOUDFLARE_API_BASE='https://api.cloudflare.com/client/v4';
export const EXPECTED_DATABASE_NAME='teamsheet-data';
export const EXPECTED_DATA_PLATFORM_WORKER='teamsheet-data-platform';
export const EXPECTED_COLLECTOR_WORKER='teamsheet-api-football-shadow-collector';
export const EXPECTED_COLLECTOR_BINDING='TEAMSHEET_DATA_DB';
export const EXPECTED_FPL_SEASON='2026-27';
export const EXPECTED_OFFICIAL_SOURCE_REVISION='official-fpl-r1';
export const EXPECTED_MIGRATIONS=Object.freeze([
  [1,'shadow_data_foundation'],
  [2,'official_fpl_structured_history'],
  [3,'production_query_plan_indexes'],
  [4,'api_football_shadow_identity'],
  [5,'api_football_shadow_runtime'],
  [6,'api_football_mapping_qualification']
]);
export const PREFLIGHT_TIMEOUT_MS=15_000;
export const PREFLIGHT_MAX_CLOUDFLARE_GETS=5;
export const PREFLIGHT_MAX_D1_QUERY_CALLS=1;

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const fail=reason=>Object.freeze({ok:false,reason:String(reason)});
const hex64=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const integer=value=>Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value):null;
const iso=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(Date.parse(value)).toISOString():null;
const digest=value=>createHash('sha256').update(String(value)).digest('hex');
const apiPath=(accountId,suffix)=>CLOUDFLARE_API_BASE+'/accounts/'+encodeURIComponent(accountId)+suffix;
const workerPath=(accountId,worker,suffix)=>apiPath(accountId,'/workers/scripts/'+encodeURIComponent(worker)+suffix);
const d1Path=(accountId,suffix)=>apiPath(accountId,'/d1/database/'+encodeURIComponent(EXPECTED_D1_DATABASE_ID)+suffix);

const FORBIDDEN_SQL=/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|TRUNCATE|ATTACH|DETACH|VACUUM|REINDEX|BEGIN|COMMIT|ROLLBACK|GRANT|RETURNING)\b/i;
const ALLOWED_PRAGMA=/^PRAGMA foreign_key_check$/;
export function assertActivationReadOnlySql(sql){
  if(typeof sql!=='string'||!sql)throw new Error('activation_preflight_sql_invalid');
  if(!/^SELECT\s/.test(sql)&&!ALLOWED_PRAGMA.test(sql))throw new Error('activation_preflight_sql_invalid');
  if(FORBIDDEN_SQL.test(sql)||sql.includes(';')||sql.includes('--')||sql.includes('/*'))throw new Error('activation_preflight_sql_invalid');
  return sql;
}

export const ACTIVATION_QUERIES=Object.freeze({
  ledger:"SELECT version,name FROM schema_migrations ORDER BY version",
  foreignKeys:"PRAGMA foreign_key_check",
  officialRun:"SELECT run_id,completed_at,status FROM ingestion_runs WHERE source_revision_id='official-fpl-r1' AND status='completed' AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1",
  officialTeams:"SELECT o.subject_entity_id,o.observation_id,o.input_revision,o.logical_key FROM observation_heads h JOIN shadow_observations o ON o.observation_id=h.observation_id JOIN ingestion_runs r ON r.run_id=o.ingestion_run_id AND r.source_revision_id=o.source_revision_id WHERE h.logical_key>='official-fpl|2026-27|team|' AND h.logical_key<'official-fpl|2026-27|team|￿' AND o.source_revision_id='official-fpl-r1' AND o.category='official_fpl_team' AND o.metric='present' AND o.value_type='boolean' AND o.value_boolean=1 AND r.status='completed' ORDER BY o.logical_key",
  mappingHead:"SELECT h.fpl_season,q.state,q.mapping_count,q.official_fpl_authority_digest FROM api_football_team_mapping_heads h JOIN api_football_team_mapping_qualifications q ON q.qualification_id=h.qualification_id WHERE h.fpl_season='2026-27'",
  mappingMembers:"SELECT COUNT(*) AS member_count,COUNT(DISTINCT provider_team_id) AS distinct_provider_ids,COUNT(DISTINCT canonical_fpl_team_id) AS distinct_fpl_ids FROM api_football_team_mapping_members WHERE qualification_id=(SELECT qualification_id FROM api_football_team_mapping_heads WHERE fpl_season='2026-27')",
  runtime:"SELECT provider,collection_enabled,credential_state,in_flight_attempt_id,in_flight_lease_expires_at FROM api_football_runtime_state WHERE provider='api-football'",
  attempts:"SELECT COUNT(*) AS total,SUM(CASE WHEN attempt_number=2 THEN 1 ELSE 0 END) AS attempt2_count,SUM(CASE WHEN outcome='RESERVED' THEN 1 ELSE 0 END) AS reserved_count FROM api_football_request_attempts",
  generations:"SELECT COUNT(*) AS total,SUM(CASE WHEN state='STAGING' THEN 1 ELSE 0 END) AS staging_count FROM api_football_discovery_generations",
  fixtureRevisions:"SELECT COUNT(*) AS total FROM api_football_fixture_revisions"
});
for(const sql of Object.values(ACTIVATION_QUERIES))assertActivationReadOnlySql(sql);

function headers(token){return Object.freeze({Authorization:'Bearer '+token,Accept:'application/json'});}
async function readJson(fetchImpl,url,{token,method='GET',body=null}={}){
  let response;
  try{
    response=await fetchImpl(url,{
      method,redirect:'error',
      headers:method==='GET'?headers(token):Object.freeze({...headers(token),'Content-Type':'application/json'}),
      ...(body===null?{}:{body:JSON.stringify(body)}),
      signal:AbortSignal.timeout(PREFLIGHT_TIMEOUT_MS)
    });
  }catch{return {ok:false,status:null};}
  const status=response?.status??null;
  if(status!==200)return {ok:false,status};
  let payload;try{payload=await response.json();}catch{return {ok:false,status};}
  if(!payload||payload.success!==true)return {ok:false,status};
  return {ok:true,status,result:payload.result};
}

function decodeBindings(result){
  const bindings=Array.isArray(result?.bindings)?result.bindings:[];
  return bindings.filter(row=>row&&typeof row.name==='string'&&typeof row.type==='string');
}
function dataPlatformBindingMatches(result){
  const d1=decodeBindings(result).find(row=>row.name===EXPECTED_COLLECTOR_BINDING&&row.type==='d1');
  return Boolean(d1&&d1.database_id===EXPECTED_D1_DATABASE_ID);
}
function collectorInventory(reads){
  const statuses=[reads.settings.status,reads.schedules.status,reads.deployments.status];
  if(statuses.every(status=>status===404))return Object.freeze({deployed:false,secretBindingPresent:false,cronCount:0});
  if(!reads.settings.ok||!reads.schedules.ok||!reads.deployments.ok)return null;
  const bindings=decodeBindings(reads.settings.result);
  const secretBindingPresent=bindings.some(row=>row.name==='API_FOOTBALL_API_KEY'&&row.type==='secret_text');
  const schedules=Array.isArray(reads.schedules.result?.schedules)?reads.schedules.result.schedules:Array.isArray(reads.schedules.result)?reads.schedules.result:[];
  return Object.freeze({deployed:true,secretBindingPresent,cronCount:schedules.length});
}

function parseWrangler(){
  let config;try{config=JSON.parse(readFileSync(path.join(root,'workers/api-football-collector/wrangler.jsonc'),'utf8'));}catch{return null;}
  const d1=Array.isArray(config.d1_databases)?config.d1_databases.find(row=>row?.binding===EXPECTED_COLLECTOR_BINDING):null;
  return Object.freeze({
    activation:config?.vars?.EIA_2I5D_ACTIVATION??null,
    databaseIdPlaceholder:d1?.database_id==='00000000-0000-0000-0000-000000000000',
    cronCount:Array.isArray(config?.triggers?.crons)?config.triggers.crons.length:null,
    workersDev:config?.workers_dev,
    previewUrls:config?.preview_urls
  });
}

export function productionModelUiImportCount(){
  const files=[
    ...readdirSync(path.join(root,'src')).filter(name=>name.endsWith('.js')).map(name=>path.join(root,'src',name)),
    path.join(root,'build.mjs')
  ];
  const pattern=/api-football-collector|api_football_(?:runtime|request|discovery|fixture|generation)/;
  return files.reduce((count,file)=>count+(pattern.test(readFileSync(file,'utf8'))?1:0),0);
}

async function runD1(fetchImpl,{accountId,token}){
  const entries=Object.entries(ACTIVATION_QUERIES);
  const response=await readJson(fetchImpl,d1Path(accountId,'/query'),{
    token,method:'POST',body:{batch:entries.map(([,sql])=>({sql:assertActivationReadOnlySql(sql),params:[]}))}
  });
  if(!response.ok||!Array.isArray(response.result)||response.result.length!==entries.length)return fail('activation_d1_read_failed');
  let rowsRead=0;const rows={};
  for(let i=0;i<entries.length;i++){
    const result=response.result[i];
    if(!result||result.success!==true||!Array.isArray(result.results))return fail('activation_d1_read_failed');
    const read=integer(result.meta?.rows_read??0),written=integer(result.meta?.rows_written??0);
    if(read===null||written===null)return fail('activation_d1_metadata_invalid');
    if(written!==0)return fail('activation_d1_write_detected');
    rowsRead+=read;rows[entries[i][0]]=result.results;
  }
  return Object.freeze({ok:true,rows:Object.freeze(rows),rowsRead});
}

function one(rows){return Array.isArray(rows)&&rows.length===1?rows[0]:null;}
function count(value){const result=integer(value);return result===null?null:result;}
export function buildAuthority(runRows,teamRows){
  const run=one(runRows),fetchedAt=iso(run?.completed_at);
  if(!run||run.status!=='completed'||typeof run.run_id!=='string'||!fetchedAt||!Array.isArray(teamRows))return null;
  const rows=teamRows.slice().sort((a,b)=>String(a?.logical_key||'').localeCompare(String(b?.logical_key||'')));
  const expectedKeys=Array.from({length:20},(_,i)=>'official-fpl|'+EXPECTED_FPL_SEASON+'|team|'+(i+1)+'|present').sort();
  const teamIds=rows.map(row=>String(row?.subject_entity_id||''));
  if(rows.length!==20||new Set(teamIds).size!==20||rows.map(row=>String(row?.logical_key||'')).sort().join('|')!==expectedKeys.join('|'))return null;
  const expectedTeamIds=Array.from({length:20},(_,i)=>EXPECTED_FPL_SEASON+':fpl:team:'+(i+1)).sort();
  if(teamIds.slice().sort().join('|')!==expectedTeamIds.join('|'))return null;
  if(rows.some(row=>typeof row?.observation_id!=='string'||typeof row?.input_revision!=='string'))return null;
  const authorityDigest=digest(stableStringify({
    season:EXPECTED_FPL_SEASON,sourceRevisionId:EXPECTED_OFFICIAL_SOURCE_REVISION,runId:run.run_id,
    fetchedAt,teamIds:teamIds.slice().sort(),
    content:rows.map(row=>({logical_key:row.logical_key,observation_id:row.observation_id,input_revision:row.input_revision}))
  }));
  return Object.freeze({
    season:EXPECTED_FPL_SEASON,sourceKey:'official-fpl',sourceRevisionId:EXPECTED_OFFICIAL_SOURCE_REVISION,
    runId:run.run_id,runStatus:'completed',fetchedAt,teamIds:Object.freeze(teamIds.slice().sort()),digest:authorityDigest
  });
}

function buildEvidence(rows,{inventory,nowIso}){
  const ledger=Array.isArray(rows.ledger)?rows.ledger.map(row=>[count(row.version),String(row.name||'')]):null;
  if(!ledger||ledger.some(([version,name])=>version===null||!name))return fail('activation_migration_ledger_invalid');
  const authority=buildAuthority(rows.officialRun,rows.officialTeams);
  if(!authority)return fail('activation_official_authority_invalid');
  const mappingHead=one(rows.mappingHead),members=one(rows.mappingMembers),runtime=one(rows.runtime),attempts=one(rows.attempts),generations=one(rows.generations),fixtureRevisions=one(rows.fixtureRevisions);
  if(!mappingHead||!members||!runtime||!attempts||!generations||!fixtureRevisions)return fail('activation_state_incomplete');
  const evidence={
    version:COLLECTOR_ACTIVATION_PREFLIGHT_VERSION,
    stage:COLLECTOR_PREFLIGHT_REPOSITORY_STAGE,
    migrations:ledger,
    foreignKeyViolations:Array.isArray(rows.foreignKeys)?rows.foreignKeys.length:null,
    authority,
    mapping:{
      state:mappingHead.state,isCurrentHead:true,mappingCount:count(mappingHead.mapping_count),
      memberCount:count(members.member_count),distinctProviderIds:count(members.distinct_provider_ids),
      distinctFplIds:count(members.distinct_fpl_ids),authorityDigest:mappingHead.official_fpl_authority_digest
    },
    runtime:{
      provider:runtime.provider,collectionEnabled:count(runtime.collection_enabled),credentialState:runtime.credential_state,
      inFlightAttemptId:runtime.in_flight_attempt_id??null,inFlightLeaseExpiresAt:runtime.in_flight_lease_expires_at??null
    },
    counts:{
      requestAttempts:count(attempts.total),generations:count(generations.total),fixtureRevisions:count(fixtureRevisions.total)
    },
    priorState:{
      attempt2Count:count(attempts.attempt2_count??0),reservedAttemptCount:count(attempts.reserved_count??0),
      stagingGenerationCount:count(generations.staging_count??0)
    },
    inventory,
    modelUiImportCount:productionModelUiImportCount()
  };
  if(!Number.isFinite(Date.parse(nowIso)))return fail('activation_now_invalid');
  return Object.freeze({ok:true,evidence:Object.freeze(evidence)});
}

export async function runApiFootballActivationLivePreflight({env=process.env,fetchImpl=globalThis.fetch,now=()=>new Date().toISOString()}={}){
  const accountId=env.DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID,accountFingerprint=env.DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT,token=env.DATA_STEWARD_CLOUDFLARE_READ_TOKEN;
  if(typeof accountId!=='string'||!accountId||typeof accountFingerprint!=='string'||!hex64(accountFingerprint)||typeof token!=='string'||!token)return fail('activation_preflight_environment_incomplete');
  if(digest(accountId)!==accountFingerprint)return fail('activation_production_account_identity_mismatch');
  const nowIso=iso(now());if(!nowIso)return fail('activation_now_invalid');

  const database=await readJson(fetchImpl,d1Path(accountId,'?fields=uuid,name,file_size'),{token});
  if(!database.ok||database.result?.uuid!==EXPECTED_D1_DATABASE_ID||database.result?.name!==EXPECTED_DATABASE_NAME)return fail('activation_production_d1_identity_mismatch');
  const platform=await readJson(fetchImpl,workerPath(accountId,EXPECTED_DATA_PLATFORM_WORKER,'/settings'),{token});
  if(!platform.ok||!dataPlatformBindingMatches(platform.result))return fail('activation_data_platform_binding_mismatch');

  const collectorReads={
    settings:await readJson(fetchImpl,workerPath(accountId,EXPECTED_COLLECTOR_WORKER,'/settings'),{token}),
    schedules:await readJson(fetchImpl,workerPath(accountId,EXPECTED_COLLECTOR_WORKER,'/schedules'),{token}),
    deployments:await readJson(fetchImpl,workerPath(accountId,EXPECTED_COLLECTOR_WORKER,'/deployments'),{token})
  };
  const collector=collectorInventory(collectorReads);if(!collector)return fail('activation_collector_inventory_unreadable');
  const wrangler=parseWrangler();if(!wrangler)return fail('activation_repository_config_unreadable');

  const d1=await runD1(fetchImpl,{accountId,token});if(!d1.ok)return d1;
  const inventory=Object.freeze({
    activation:wrangler.activation,databaseIdPlaceholder:wrangler.databaseIdPlaceholder,deployed:collector.deployed,
    secretBindingPresent:collector.secretBindingPresent,cronCount:collector.cronCount,workersDev:wrangler.workersDev,previewUrls:wrangler.previewUrls
  });
  const built=buildEvidence(d1.rows,{inventory,nowIso});if(!built.ok)return built;
  const classified=classifyCollectorActivationPreflight(built.evidence,{now:nowIso});

  return Object.freeze({
    ok:classified.ok===true,
    version:API_FOOTBALL_ACTIVATION_LIVE_PREFLIGHT_VERSION,
    observedAt:nowIso,stage:COLLECTOR_PREFLIGHT_REPOSITORY_STAGE,
    classification:classified.classification,reason:classified.reason??null,
    migrationCount:built.evidence.migrations.length,
    foreignKeyViolations:built.evidence.foreignKeyViolations,
    officialFplAuthority:Object.freeze({valid:true,teamCount:20,fetchedAt:built.evidence.authority.fetchedAt}),
    mapping:Object.freeze({
      state:built.evidence.mapping.state,mappingCount:built.evidence.mapping.mappingCount,
      memberCount:built.evidence.mapping.memberCount,distinctProviderIds:built.evidence.mapping.distinctProviderIds,
      distinctFplIds:built.evidence.mapping.distinctFplIds
    }),
    runtime:Object.freeze({
      collectionEnabled:built.evidence.runtime.collectionEnabled,credentialState:built.evidence.runtime.credentialState,
      activeLease:built.evidence.runtime.inFlightAttemptId!==null
    }),
    priorState:Object.freeze({...built.evidence.counts,...built.evidence.priorState}),
    inventory:Object.freeze({...inventory}),
    modelUiImportCount:built.evidence.modelUiImportCount,
    evidence:Object.freeze({
      cloudflareGets:PREFLIGHT_MAX_CLOUDFLARE_GETS,d1QueryCalls:PREFLIGHT_MAX_D1_QUERY_CALLS,d1RowsRead:d1.rowsRead,
      productionMutations:0,apiFootballRequests:0,secretValuesRead:0
    })
  });
}

export function sanitizedSummaryLines(report){
  return [
    '### API-Football collector activation read-only preflight','',
    '- Outcome: '+(report?.ok?'PASS':'STOP'),
    '- Stage: '+String(report?.stage??COLLECTOR_PREFLIGHT_REPOSITORY_STAGE),
    '- Classification: '+String(report?.classification??'STOP_READONLY_PREFLIGHT_FAILED'),
    '- Reason: '+String(report?.reason??'none'),
    '- Migrations observed: '+String(report?.migrationCount??'unknown'),
    '- Foreign-key violations: '+String(report?.foreignKeyViolations??'unknown'),
    '- Official FPL authority teams: '+String(report?.officialFplAuthority?.teamCount??'unknown'),
    '- Mapping members: '+String(report?.mapping?.memberCount??'unknown'),
    '- Collection enabled: '+String(report?.runtime?.collectionEnabled??'unknown'),
    '- Request attempts: '+String(report?.priorState?.requestAttempts??'unknown'),
    '- Discovery generations: '+String(report?.priorState?.generations??'unknown'),
    '- Fixture revisions: '+String(report?.priorState?.fixtureRevisions??'unknown'),
    '- Collector deployed: '+String(report?.inventory?.deployed??'unknown'),
    '- Collector Cron count: '+String(report?.inventory?.cronCount??'unknown'),
    '- API key binding present: '+String(report?.inventory?.secretBindingPresent??'unknown'),
    '- Production mutations: 0',
    '- API-Football requests: 0',
    '- Secret values read: 0'
  ];
}

export async function main(){
  const report=await runApiFootballActivationLivePreflight();
  const reportPath=process.env.API_FOOTBALL_ACTIVATION_PREFLIGHT_REPORT_PATH;
  if(typeof reportPath==='string'&&reportPath)writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  if(typeof process.env.GITHUB_STEP_SUMMARY==='string'&&process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,sanitizedSummaryLines(report).join('\n')+'\n');
  console.log(JSON.stringify({
    ok:report.ok===true,classification:report.classification??null,reason:report.reason??null,
    productionMutations:0,apiFootballRequests:0,secretValuesRead:0
  }));
  return report.ok?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
