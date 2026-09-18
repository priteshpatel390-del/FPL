import {createHash} from 'node:crypto';
import {writeFileSync,appendFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {stableStringify} from '../../src/decision-intelligence/canonical.mjs';
import {EXPECTED_D1_DATABASE_ID} from '../data-platform/phase4b/live-contract.mjs';

export const API_FOOTBALL_LIVE_STORAGE_PREFLIGHT_VERSION='api-football-live-storage-preflight-v1';
export const CLOUDFLARE_API_BASE='https://api.cloudflare.com/client/v4';
export const EXPECTED_DATABASE_NAME='teamsheet-data';
export const EXPECTED_DATA_PLATFORM_WORKER='teamsheet-data-platform';
export const EXPECTED_COLLECTOR_WORKER='teamsheet-api-football-shadow-collector';
export const EXPECTED_COLLECTOR_BINDING='TEAMSHEET_DATA_DB';
export const EXPECTED_ACTIVATION='REPOSITORY_ONLY_BLOCKED';
export const EXPECTED_RUNTIME_DISABLE_REASON='EIA_2I5D_REPOSITORY_ONLY';
export const EXPECTED_FPL_SEASON='2026-27';
export const EXPECTED_SOURCE_REVISION='api-football:eia-2i5a:1';
export const EXPECTED_OFFICIAL_SOURCE_REVISION='official-fpl-r1';
export const EXPECTED_MIGRATIONS=Object.freeze({
  1:'shadow_data_foundation',
  2:'official_fpl_structured_history',
  3:'production_query_plan_indexes',
  4:'api_football_shadow_identity',
  5:'api_football_shadow_runtime',
  6:'api_football_mapping_qualification'
});
export const PREFLIGHT_TIMEOUT_MS=15000;
export const PREFLIGHT_MAX_D1_CALLS=2;
export const PREFLIGHT_MAX_CLOUDFLARE_GETS=5;

const fail=reason=>Object.freeze({ok:false,reason:String(reason)});
const hex64=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const integer=value=>Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value):null;
const iso=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(Date.parse(value)).toISOString():null;
const digest=value=>createHash('sha256').update(String(value)).digest('hex');
const apiPath=(accountId,suffix)=>CLOUDFLARE_API_BASE+'/accounts/'+encodeURIComponent(accountId)+suffix;
const workerPath=(accountId,worker,suffix)=>apiPath(accountId,'/workers/scripts/'+encodeURIComponent(worker)+suffix);
const d1Path=(accountId,suffix)=>apiPath(accountId,'/d1/database/'+encodeURIComponent(EXPECTED_D1_DATABASE_ID)+suffix);

const FORBIDDEN_SQL=/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|TRUNCATE|ATTACH|DETACH|VACUUM|REINDEX|BEGIN|COMMIT|ROLLBACK|GRANT|RETURNING)\b/i;
export function assertReadOnlySql(sql){
  if(typeof sql!=='string'||!sql)throw new Error('preflight_sql_invalid');
  if(!/^(SELECT|PRAGMA)\s/i.test(sql))throw new Error('preflight_sql_invalid');
  if(FORBIDDEN_SQL.test(sql)||sql.includes(';')||sql.includes('--')||sql.includes('/*'))throw new Error('preflight_sql_invalid');
  return sql;
}

export const BASE_QUERIES=Object.freeze({
  ledger:"SELECT version,name,applied_at FROM schema_migrations ORDER BY version",
  objects:"SELECT type,name,tbl_name FROM sqlite_master WHERE name LIKE 'api_football_%' OR name IN ('provider_fixture_identities','provider_participation_revisions','provider_participation_history','owner_risk_source_revision_insert','owner_risk_source_revision_update') ORDER BY type,name",
  foreignKeys:"PRAGMA foreign_key_check",
  dataSourceRevisionColumns:"PRAGMA table_info(data_source_revisions)",
  participationColumns:"PRAGMA table_info(provider_participation_revisions)",
  officialRun:"SELECT run_id,completed_at,status FROM ingestion_runs WHERE source_revision_id='official-fpl-r1' AND status='completed' AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1",
  officialTeams:"SELECT o.subject_entity_id,o.observation_id,o.input_revision,o.logical_key FROM observation_heads h JOIN shadow_observations o ON o.observation_id=h.observation_id JOIN ingestion_runs r ON r.run_id=o.ingestion_run_id AND r.source_revision_id=o.source_revision_id WHERE h.logical_key>='official-fpl|2026-27|team|' AND h.logical_key<'official-fpl|2026-27|team|￿' AND o.source_revision_id='official-fpl-r1' AND o.category='official_fpl_team' AND r.status='completed' ORDER BY o.logical_key",
  mappingRows:"SELECT COUNT(*) AS count FROM entity_mappings WHERE source_revision_id='api-football:eia-2i5a:1' AND provider_entity_type='team'"
});

export const OPTIONAL_QUERIES=Object.freeze({
  runtime:"SELECT provider,collection_enabled,disable_reason,credential_state,quota_state,daily_attempt_count,updated_at FROM api_football_runtime_state WHERE provider='api-football'",
  attempts:"SELECT COUNT(*) AS count FROM api_football_request_attempts",
  generations:"SELECT COUNT(*) AS total,SUM(CASE WHEN state='STAGING' THEN 1 ELSE 0 END) AS staging,SUM(CASE WHEN state='COMMITTED' THEN 1 ELSE 0 END) AS committed,SUM(CASE WHEN state='FAILED' THEN 1 ELSE 0 END) AS failed FROM api_football_discovery_generations",
  discoveryHeads:"SELECT COUNT(*) AS count FROM api_football_discovery_heads",
  fixtureRevisions:"SELECT COUNT(*) AS count FROM api_football_fixture_revisions",
  generationFixtures:"SELECT COUNT(*) AS count FROM api_football_generation_fixtures",
  qualifications:"SELECT COUNT(*) AS total,SUM(CASE WHEN state='STAGING' THEN 1 ELSE 0 END) AS staging,SUM(CASE WHEN state='COMMITTED' THEN 1 ELSE 0 END) AS committed FROM api_football_team_mapping_qualifications",
  mappingHeads:"SELECT h.fpl_season,h.qualification_id,q.state,q.mapping_count,q.crosswalk_integrity_hash,q.approval_qualification_integrity_hash,q.current_qualification_integrity_hash,q.persistence_integrity_hash,q.provider_universe_revision,q.provider_universe_integrity_hash,q.official_fpl_authority_digest,q.official_fpl_authority_fetched_at FROM api_football_team_mapping_heads h JOIN api_football_team_mapping_qualifications q ON q.qualification_id=h.qualification_id WHERE h.fpl_season='2026-27'",
  mappingMembers:"SELECT COUNT(*) AS total,COUNT(DISTINCT provider_team_id) AS unique_provider,COUNT(DISTINCT canonical_fpl_team_id) AS unique_fpl FROM api_football_team_mapping_members WHERE qualification_id=(SELECT qualification_id FROM api_football_team_mapping_heads WHERE fpl_season='2026-27')"
});

for(const sql of [...Object.values(BASE_QUERIES),...Object.values(OPTIONAL_QUERIES)])assertReadOnlySql(sql);

const OPTIONAL_QUERY_REQUIREMENTS=Object.freeze({
  runtime:['api_football_runtime_state'],
  attempts:['api_football_request_attempts'],
  generations:['api_football_discovery_generations'],
  discoveryHeads:['api_football_discovery_heads'],
  fixtureRevisions:['api_football_fixture_revisions'],
  generationFixtures:['api_football_generation_fixtures'],
  qualifications:['api_football_team_mapping_qualifications'],
  mappingHeads:['api_football_team_mapping_heads','api_football_team_mapping_qualifications'],
  mappingMembers:['api_football_team_mapping_members','api_football_team_mapping_heads']
});

export function optionalQueryKeysForObjects(objects=[]){
  const tableNames=new Set((objects||[]).filter(row=>row?.type==='table').map(row=>String(row.name)));
  return Object.freeze(Object.entries(OPTIONAL_QUERY_REQUIREMENTS)
    .filter(([,tables])=>tables.every(table=>tableNames.has(table)))
    .map(([key])=>key));
}

function cloudflareHeaders(token){
  return Object.freeze({Authorization:'Bearer '+token,Accept:'application/json'});
}

async function readJson(fetchImpl,url,{token,method='GET',body=null}={}){
  let response;
  try{
    response=await fetchImpl(url,{
      method,redirect:'error',headers:method==='GET'?cloudflareHeaders(token):Object.freeze({...cloudflareHeaders(token),'Content-Type':'application/json'}),
      ...(body===null?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(PREFLIGHT_TIMEOUT_MS)
    });
  }catch{return {ok:false,status:null};}
  if(!response||response.status!==200)return {ok:false,status:response?.status??null};
  let payload;
  try{payload=await response.json();}catch{return {ok:false,status:200};}
  if(!payload||payload.success!==true)return {ok:false,status:200};
  return {ok:true,status:200,result:payload.result};
}

function decodeBindings(result){
  const bindings=Array.isArray(result?.bindings)?result.bindings:[];
  return bindings.filter(row=>row&&typeof row.name==='string'&&typeof row.type==='string');
}

export function summarizeCollectorSettings(result){
  const bindings=decodeBindings(result);
  const d1=bindings.find(row=>row.name===EXPECTED_COLLECTOR_BINDING&&row.type==='d1');
  const activation=bindings.find(row=>row.name==='EIA_2I5D_ACTIVATION'&&row.type==='plain_text');
  const secret=bindings.find(row=>row.name==='API_FOOTBALL_API_KEY'&&row.type==='secret_text');
  return Object.freeze({
    d1BindingPresent:Boolean(d1),
    d1BindingMatchesProduction:Boolean(d1&&d1.database_id===EXPECTED_D1_DATABASE_ID),
    activation:typeof activation?.text==='string'?activation.text:null,
    apiFootballSecretBindingPresent:Boolean(secret)
  });
}

export function summarizeDataPlatformSettings(result){
  const bindings=decodeBindings(result);
  const d1=bindings.find(row=>row.name===EXPECTED_COLLECTOR_BINDING&&row.type==='d1');
  return Object.freeze({
    d1BindingPresent:Boolean(d1),
    d1BindingMatchesProduction:Boolean(d1&&d1.database_id===EXPECTED_D1_DATABASE_ID)
  });
}

async function runD1Batch(fetchImpl,{accountId,token,queries}){
  const entries=Object.entries(queries);
  if(!entries.length)return {ok:true,rows:{},rowsRead:0};
  const response=await readJson(fetchImpl,d1Path(accountId,'/query'),{
    token,method:'POST',body:{batch:entries.map(([,sql])=>({sql:assertReadOnlySql(sql),params:[]}))}
  });
  if(!response.ok||!Array.isArray(response.result)||response.result.length!==entries.length)return fail('d1_read_failed');
  let rowsRead=0;
  const rows={};
  for(let index=0;index<entries.length;index++){
    const item=response.result[index];
    if(!item||item.success!==true||!Array.isArray(item.results))return fail('d1_read_failed');
    const read=integer(item.meta?.rows_read??0),written=integer(item.meta?.rows_written??0);
    if(read===null||written===null||written!==0)return fail(written===0?'d1_read_failed':'d1_write_detected');
    rowsRead+=read;
    rows[entries[index][0]]=item.results;
  }
  return Object.freeze({ok:true,rows:Object.freeze(rows),rowsRead});
}

function ledgerSummary(rows){
  if(!Array.isArray(rows))return null;
  const ledger=[];
  const seen=new Set();
  for(const row of rows){
    const version=integer(row?.version);
    if(version===null||version<1||seen.has(version)||typeof row?.name!=='string')return null;
    seen.add(version);
    ledger.push(Object.freeze({version,name:row.name,appliedAt:iso(row.applied_at)}));
  }
  return Object.freeze(ledger);
}

function migrationState(ledger,version){
  const row=ledger.find(item=>item.version===version);
  if(!row)return Object.freeze({applied:false,exact:false,name:null,appliedAt:null});
  return Object.freeze({applied:true,exact:row.name===EXPECTED_MIGRATIONS[version],name:row.name,appliedAt:row.appliedAt});
}

function countRow(rows,key='count'){
  if(!Array.isArray(rows)||rows.length!==1)return null;
  return integer(rows[0]?.[key]);
}

function aggregation(rows,keys){
  if(!Array.isArray(rows)||rows.length!==1)return null;
  const result={};
  for(const key of keys){
    const value=integer(rows[0]?.[key]??0);
    if(value===null)return null;
    result[key]=value;
  }
  return Object.freeze(result);
}

function officialAuthority(rowsRun,rowsTeams,nowIso){
  if(!Array.isArray(rowsRun)||rowsRun.length!==1||!Array.isArray(rowsTeams))return Object.freeze({present:false,valid:false});
  const run=rowsRun[0],completedAt=iso(run?.completed_at);
  if(typeof run?.run_id!=='string'||run.status!=='completed'||!completedAt)return Object.freeze({present:false,valid:false});
  const rows=rowsTeams.slice();
  const teamIds=[...new Set(rows.map(row=>String(row?.subject_entity_id||'')).filter(Boolean))].sort();
  const logicalUnique=new Set(rows.map(row=>String(row?.logical_key||'')));
  const expectedTeamIds=Array.from({length:20},(_,index)=>EXPECTED_FPL_SEASON+':fpl:team:'+(index+1)).sort();
  const validRows=rows.length===20&&teamIds.length===20&&logicalUnique.size===20&&
    teamIds.join('|')===expectedTeamIds.join('|')&&rows.every(row=>
      typeof row?.logical_key==='string'&&typeof row?.observation_id==='string'&&typeof row?.input_revision==='string');
  const authorityDigest=validRows?digest(stableStringify({
    season:EXPECTED_FPL_SEASON,sourceRevisionId:EXPECTED_OFFICIAL_SOURCE_REVISION,runId:run.run_id,
    fetchedAt:completedAt,teamIds,
    content:rows.map(row=>({logical_key:row.logical_key,observation_id:row.observation_id,input_revision:row.input_revision}))
  })):null;
  const fresh=validRows&&(Date.parse(nowIso)-Date.parse(completedAt)<=48*60*60*1000)&&(Date.parse(nowIso)>=Date.parse(completedAt));
  return Object.freeze({
    present:true,valid:validRows,fresh,completedAt,teamCount:teamIds.length,digest:authorityDigest
  });
}

function objectNames(rows){
  if(!Array.isArray(rows))return new Set();
  return new Set(rows.map(row=>String(row?.name||'')).filter(Boolean));
}
function columnNames(rows){
  if(!Array.isArray(rows))return new Set();
  return new Set(rows.map(row=>String(row?.name||'')).filter(Boolean));
}
const hasColumns=(rows,required)=>required.every(name=>columnNames(rows).has(name));

export function evaluateStoragePreflight({ledger,objects,foreignKeys,baseRows,optionalRows,databaseIdentityMatch,dataPlatformBindingMatch,collector,nowIso}){
  const hardStops=[];
  const m4=migrationState(ledger,4),m5=migrationState(ledger,5),m6=migrationState(ledger,6);
  const names=objectNames(objects);
  const requireObjects=(version,list)=>{
    const state=version===4?m4:version===5?m5:m6;
    if(!state.applied)return false;
    const present=list.every(name=>names.has(name));
    if(!present)hardStops.push('migration_000'+version+'_schema_incomplete');
    return present;
  };
  if(!databaseIdentityMatch)hardStops.push('production_d1_identity_mismatch');
  if(!dataPlatformBindingMatch)hardStops.push('production_d1_binding_mismatch');
  for(const version of [1,2,3]){
    const state=migrationState(ledger,version);
    if(!state.applied)hardStops.push('migration_000'+version+'_missing');
    else if(!state.exact)hardStops.push('migration_000'+version+'_name_mismatch');
  }
  for(const [version,state] of [[4,m4],[5,m5],[6,m6]])if(state.applied&&!state.exact)hardStops.push('migration_000'+version+'_name_mismatch');
  if(ledger.some(row=>row.version>6))hardStops.push('migration_ledger_ahead_of_repository');
  const versions=ledger.map(row=>row.version).sort((a,b)=>a-b);
  if(versions.some((version,index)=>version!==index+1))hardStops.push('migration_ledger_non_contiguous');
  if(m5.applied&&!m4.applied)hardStops.push('migration_0005_without_0004');
  if(m6.applied&&!m5.applied)hardStops.push('migration_0006_without_0005');
  const schema4Objects=requireObjects(4,[
    'provider_fixture_identities','provider_participation_revisions','provider_participation_history',
    'owner_risk_source_revision_insert','owner_risk_source_revision_update'
  ]);
  const schema4Columns=!m4.applied?false:hasColumns(baseRows.dataSourceRevisionColumns,[
    'provider','source_key','owner_approval_id','allowed_use','normalized_facts_only','public_use_allowed',
    'commercial_use_allowed','raw_payload_retention_allowed','stop_on_objection'
  ]);
  if(m4.applied&&!schema4Columns)hardStops.push('migration_0004_schema_incomplete');
  const schema4=schema4Objects&&schema4Columns;
  const schema5Objects=requireObjects(5,[
    'api_football_runtime_state','api_football_request_attempts','api_football_discovery_generations',
    'api_football_discovery_heads','api_football_fixture_revisions','api_football_generation_fixtures',
    'api_football_committed_head_insert','api_football_committed_head_update',
    'api_football_committed_generation_immutable','api_football_attempt_retention',
    'api_football_fixture_revision_history','api_football_fixture_supersession_insert',
    'api_football_generation_fixture_consistency','api_football_participation_run_insert',
    'api_football_participation_run_update'
  ]);
  const schema5Columns=!m5.applied?false:hasColumns(baseRows.participationColumns,['ingestion_run_id']);
  if(m5.applied&&!schema5Columns)hardStops.push('migration_0005_schema_incomplete');
  const schema5=schema5Objects&&schema5Columns;
  const schema6=requireObjects(6,[
    'api_football_team_mapping_qualifications','api_football_team_mapping_members','api_football_team_mapping_heads',
    'api_football_mapping_member_insert','api_football_mapping_qualification_commit',
    'api_football_mapping_qualification_immutable','api_football_mapping_member_update_immutable',
    'api_football_mapping_member_delete_immutable','api_football_mapping_head_insert',
    'api_football_mapping_head_update','api_football_mapping_members_provider'
  ]);
  const fkViolations=Array.isArray(foreignKeys)?foreignKeys.length:null;
  if(fkViolations===null)hardStops.push('foreign_key_state_unreadable');
  else if(fkViolations!==0)hardStops.push('foreign_key_violation');
  const mappingRows=countRow(baseRows.mappingRows);
  if(mappingRows===null)hardStops.push('mapping_row_count_unreadable');
  const authority=officialAuthority(baseRows.officialRun,baseRows.officialTeams,nowIso);
  if(!authority.valid)hardStops.push('official_fpl_authority_invalid');
  else if(!authority.fresh)hardStops.push('official_fpl_authority_stale');
  const runtime=Array.isArray(optionalRows.runtime)&&optionalRows.runtime.length===1?optionalRows.runtime[0]:null;
  if(m5.applied){
    if(!runtime)hardStops.push('runtime_state_missing');
    else{
      if(integer(runtime.collection_enabled)!==0)hardStops.push('collection_not_disabled');
      if(runtime.disable_reason!==EXPECTED_RUNTIME_DISABLE_REASON)hardStops.push('runtime_disable_reason_unexpected');
    }
  }
  const attempts=optionalRows.attempts?countRow(optionalRows.attempts):0;
  const generations=optionalRows.generations?aggregation(optionalRows.generations,['total','staging','committed','failed']):Object.freeze({total:0,staging:0,committed:0,failed:0});
  const discoveryHeads=optionalRows.discoveryHeads?countRow(optionalRows.discoveryHeads):0;
  const fixtureRevisions=optionalRows.fixtureRevisions?countRow(optionalRows.fixtureRevisions):0;
  const generationFixtures=optionalRows.generationFixtures?countRow(optionalRows.generationFixtures):0;
  const qualifications=optionalRows.qualifications?aggregation(optionalRows.qualifications,['total','staging','committed']):Object.freeze({total:0,staging:0,committed:0});
  const headRows=Array.isArray(optionalRows.mappingHeads)?optionalRows.mappingHeads:[];
  const memberCounts=optionalRows.mappingMembers?aggregation(optionalRows.mappingMembers,['total','unique_provider','unique_fpl']):Object.freeze({total:0,unique_provider:0,unique_fpl:0});
  for(const [key,value] of Object.entries({attempts,discoveryHeads,fixtureRevisions,generationFixtures}))if(value===null)hardStops.push(key+'_count_unreadable');
  if(generations===null)hardStops.push('generation_count_unreadable');
  if(qualifications===null)hardStops.push('qualification_count_unreadable');
  if(memberCounts===null)hardStops.push('mapping_member_count_unreadable');
  const mappingHead=headRows.length===1?headRows[0]:null;
  if(headRows.length>1)hardStops.push('mapping_head_ambiguous');
  if(mappingHead){
    if(mappingHead.state!=='COMMITTED'||integer(mappingHead.mapping_count)!==20)hardStops.push('mapping_head_not_committed_exact20');
    for(const key of ['crosswalk_integrity_hash','approval_qualification_integrity_hash','current_qualification_integrity_hash','persistence_integrity_hash','provider_universe_integrity_hash','official_fpl_authority_digest']){
      if(!hex64(mappingHead[key]))hardStops.push('mapping_head_hash_invalid');
    }
    if(memberCounts&&(memberCounts.total!==20||memberCounts.unique_provider!==20||memberCounts.unique_fpl!==20))hardStops.push('mapping_head_member_count_invalid');
  }
  if(collector?.exists){
    hardStops.push('collector_worker_present');
    if(!collector.d1BindingPresent)hardStops.push('collector_d1_binding_missing');
    else if(!collector.d1BindingMatchesProduction)hardStops.push('collector_d1_binding_mismatch');
    if(collector.activation!==EXPECTED_ACTIVATION)hardStops.push('collector_activation_unexpected');
    if((collector.crons||[]).length!==0)hardStops.push('collector_cron_present');
    if(collector.apiFootballSecretBindingPresent)hardStops.push('collector_secret_present');
  }
  let nextAction='STOP_REVIEW_REQUIRED';
  if(hardStops.length===0){
    if(!m4.applied)nextAction='STOP_0004_NOT_APPLIED';
    else if(!m5.applied&&schema4)nextAction='READY_FOR_MIGRATION_0005';
    else if(m5.applied&&!m6.applied&&schema5)nextAction='READY_FOR_MIGRATION_0006';
    else if(m5.applied&&m6.applied&&schema5&&schema6&&!mappingHead)nextAction='READY_FOR_PRIVATE_MAPPING_PERSISTENCE';
    else if(mappingHead)nextAction='EXISTING_MAPPING_STATE_REQUIRES_RECONCILIATION';
  }
  return Object.freeze({
    migrations:Object.freeze({ledger,migration0004:m4,migration0005:m5,migration0006:m6,schema0004Present:schema4,schema0005Present:schema5,schema0006Present:schema6}),
    foreignKeyViolations:fkViolations,
    officialFplAuthority:authority,
    apiFootballState:Object.freeze({
      mappingRowCount:mappingRows,
      runtimeState:runtime?Object.freeze({
        present:true,collectionEnabled:integer(runtime.collection_enabled),disableReason:runtime.disable_reason,
        credentialState:runtime.credential_state,quotaState:runtime.quota_state,dailyAttemptCount:integer(runtime.daily_attempt_count),
        updatedAt:iso(runtime.updated_at)
      }):Object.freeze({present:false}),
      requestAttemptCount:attempts,
      discoveryGenerations:generations,
      discoveryHeadCount:discoveryHeads,
      fixtureRevisionCount:fixtureRevisions,
      generationFixtureCount:generationFixtures,
      mappingQualifications:qualifications,
      mappingHead:mappingHead?Object.freeze({
        present:true,fplSeason:mappingHead.fpl_season,qualificationId:mappingHead.qualification_id,state:mappingHead.state,
        mappingCount:integer(mappingHead.mapping_count),crosswalkIntegrityHash:mappingHead.crosswalk_integrity_hash,
        approvalQualificationIntegrityHash:mappingHead.approval_qualification_integrity_hash,
        currentQualificationIntegrityHash:mappingHead.current_qualification_integrity_hash,
        persistenceIntegrityHash:mappingHead.persistence_integrity_hash,
        providerUniverseRevision:mappingHead.provider_universe_revision,
        providerUniverseIntegrityHash:mappingHead.provider_universe_integrity_hash,
        officialFplAuthorityDigest:mappingHead.official_fpl_authority_digest,
        officialFplAuthorityFetchedAt:iso(mappingHead.official_fpl_authority_fetched_at)
      }):Object.freeze({present:false}),
      mappingMembers:memberCounts
    }),
    hardStops:Object.freeze([...new Set(hardStops)]),
    nextAction
  });
}

function collectorSummary({settings,schedules,deployments}){
  const statuses=[settings.status,schedules.status,deployments.status];
  if(statuses.every(status=>status===404))return Object.freeze({
    exists:false,deploymentCount:0,crons:Object.freeze([]),d1BindingPresent:false,d1BindingMatchesProduction:false,
    activation:null,apiFootballSecretBindingPresent:false
  });
  if(!settings.ok||!schedules.ok||!deployments.ok)return null;
  const settingsSummary=summarizeCollectorSettings(settings.result);
  const scheduleRows=Array.isArray(schedules.result?.schedules)?schedules.result.schedules:Array.isArray(schedules.result)?schedules.result:[];
  const crons=Object.freeze(scheduleRows.map(row=>typeof row==='string'?row:row?.cron).filter(value=>typeof value==='string').slice(0,16));
  const deploymentRows=Array.isArray(deployments.result)?deployments.result:Array.isArray(deployments.result?.deployments)?deployments.result.deployments:[];
  return Object.freeze({exists:true,deploymentCount:deploymentRows.length,crons,...settingsSummary});
}

export async function runApiFootballLiveStoragePreflight({env=process.env,fetchImpl=globalThis.fetch,now=()=>new Date().toISOString()}={}){
  const accountId=env.DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID;
  const accountFingerprint=env.DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT;
  const token=env.DATA_STEWARD_CLOUDFLARE_READ_TOKEN;
  if(typeof accountId!=='string'||!accountId||typeof accountFingerprint!=='string'||!hex64(accountFingerprint)||typeof token!=='string'||!token)
    return fail('preflight_environment_incomplete');
  if(digest(accountId)!==accountFingerprint)return fail('production_account_identity_mismatch');
  const nowIso=iso(now());if(!nowIso)return fail('preflight_now_invalid');

  const database=await readJson(fetchImpl,d1Path(accountId,'?fields=uuid,name,file_size'),{token});
  if(!database.ok)return fail('production_d1_metadata_unavailable');
  const databaseIdentityMatch=database.result?.uuid===EXPECTED_D1_DATABASE_ID&&database.result?.name===EXPECTED_DATABASE_NAME;

  const platformSettings=await readJson(fetchImpl,workerPath(accountId,EXPECTED_DATA_PLATFORM_WORKER,'/settings'),{token});
  if(!platformSettings.ok)return fail('data_platform_settings_unavailable');
  const dataPlatform=summarizeDataPlatformSettings(platformSettings.result);

  const collectorReads={
    settings:await readJson(fetchImpl,workerPath(accountId,EXPECTED_COLLECTOR_WORKER,'/settings'),{token}),
    schedules:await readJson(fetchImpl,workerPath(accountId,EXPECTED_COLLECTOR_WORKER,'/schedules'),{token}),
    deployments:await readJson(fetchImpl,workerPath(accountId,EXPECTED_COLLECTOR_WORKER,'/deployments'),{token})
  };
  const collector=collectorSummary(collectorReads);
  if(!collector)return fail('collector_inventory_unreadable');

  const first=await runD1Batch(fetchImpl,{accountId,token,queries:BASE_QUERIES});
  if(!first.ok)return first;
  const ledger=ledgerSummary(first.rows.ledger);
  if(!ledger)return fail('migration_ledger_invalid');
  const optionalKeys=optionalQueryKeysForObjects(first.rows.objects);
  const optionalQueries=Object.fromEntries(optionalKeys.map(key=>[key,OPTIONAL_QUERIES[key]]));
  const second=await runD1Batch(fetchImpl,{accountId,token,queries:optionalQueries});
  if(!second.ok)return second;

  const evaluated=evaluateStoragePreflight({
    ledger,objects:first.rows.objects,foreignKeys:first.rows.foreignKeys,baseRows:first.rows,optionalRows:second.rows,
    databaseIdentityMatch,dataPlatformBindingMatch:dataPlatform.d1BindingMatchesProduction,collector,nowIso
  });
  return Object.freeze({
    ok:true,version:API_FOOTBALL_LIVE_STORAGE_PREFLIGHT_VERSION,observedAt:nowIso,
    database:Object.freeze({name:EXPECTED_DATABASE_NAME,identityMatch:databaseIdentityMatch,dataPlatformBindingMatch:dataPlatform.d1BindingMatchesProduction}),
    collector,
    ...evaluated,
    evidence:Object.freeze({cloudflareGets:PREFLIGHT_MAX_CLOUDFLARE_GETS,d1QueryCalls:optionalKeys.length?2:1,d1RowsRead:first.rowsRead+second.rowsRead,productionMutations:0,apiFootballRequests:0})
  });
}

export function sanitizedSummaryLines(report){
  if(!report?.ok)return ['### API-Football live storage preflight','', '- Outcome: FAIL', '- Reason: '+String(report?.reason||'preflight_failed')];
  const m=report.migrations;
  const s=report.apiFootballState;
  const c=report.collector;
  return [
    '### API-Football live storage preflight','',
    '- Production D1 identity: '+(report.database.identityMatch?'PASS':'FAIL'),
    '- Production data-platform D1 binding: '+(report.database.dataPlatformBindingMatch?'PASS':'FAIL'),
    '- Migration ledger: '+m.ledger.map(row=>String(row.version).padStart(4,'0')+' '+row.name).join(', '),
    '- Migration 0004: '+(m.migration0004.applied?(m.migration0004.exact?'APPLIED':'UNEXPECTED'):'NOT APPLIED'),
    '- Migration 0005: '+(m.migration0005.applied?(m.migration0005.exact?'APPLIED':'UNEXPECTED'):'NOT APPLIED'),
    '- Migration 0006: '+(m.migration0006.applied?(m.migration0006.exact?'APPLIED':'UNEXPECTED'):'NOT APPLIED'),
    '- Foreign-key violations: '+String(report.foreignKeyViolations),
    '- Official FPL authority: '+(report.officialFplAuthority.valid?'VALID':'INVALID')+' / teams='+String(report.officialFplAuthority.teamCount??0)+' / fresh48h='+String(report.officialFplAuthority.fresh??false),
    '- API-Football mapping rows: '+String(s.mappingRowCount),
    '- API-Football runtime row present: '+String(s.runtimeState.present),
    '- API-Football collection enabled: '+String(s.runtimeState.collectionEnabled??'N/A'),
    '- API-Football disable reason: '+String(s.runtimeState.disableReason??'N/A'),
    '- API-Football request attempts: '+String(s.requestAttemptCount),
    '- API-Football discovery generations: '+String(s.discoveryGenerations?.total??0),
    '- API-Football fixture revisions: '+String(s.fixtureRevisionCount),
    '- Mapping qualifications: '+String(s.mappingQualifications?.total??0),
    '- Mapping head present: '+String(s.mappingHead.present),
    '- Collector Worker exists: '+String(c.exists),
    '- Collector deployments: '+String(c.deploymentCount),
    '- Collector Cron count: '+String(c.crons.length),
    '- Collector API_FOOTBALL_API_KEY secret binding present: '+String(c.apiFootballSecretBindingPresent),
    '- Hard stops: '+(report.hardStops.length?report.hardStops.join(', '):'none'),
    '- Next action: '+report.nextAction,
    '- Production mutations: 0',
    '- API-Football requests: 0'
  ];
}

export async function main(){
  const report=await runApiFootballLiveStoragePreflight();
  const path=process.env.API_FOOTBALL_PREFLIGHT_REPORT_PATH;
  if(typeof path==='string'&&path)writeFileSync(path,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  if(typeof process.env.GITHUB_STEP_SUMMARY==='string'&&process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,sanitizedSummaryLines(report).join('\n')+'\n');
  console.log(JSON.stringify({ok:report.ok,nextAction:report.nextAction??null,hardStopCount:report.hardStops?.length??null,productionMutations:0,apiFootballRequests:0}));
  return report.ok?0:1;
}

if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
