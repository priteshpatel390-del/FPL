import {
  MIGRATION_0004_REQUIRED_OBJECTS,MIGRATION_0004_RIGHTS_COLUMNS,
  officialFplAuthoritySnapshot,assertSameOfficialFplAuthority
} from '../migration4/migration-0004-contract.mjs';

export {officialFplAuthoritySnapshot,assertSameOfficialFplAuthority};

export const MIGRATION_0005_PATH='workers/data-platform/migrations/0005_api_football_shadow_runtime.sql';
export const MIGRATION_0005_GIT_BLOB_SHA='a65c57924a5e18ad8e72e491c376fe0f1c149e88';
export const MIGRATION_0005_BYTES=9923;
export const MIGRATION_0005_VERSION=5;
export const MIGRATION_0005_NAME='api_football_shadow_runtime';
export const MIGRATION_0005_APPLIED_AT='2026-09-16T00:00:00.000Z';
export const MIGRATION_0005_STATEMENT_COUNT=20;
export const MIGRATION_0005_FPL_SEASON='2026-27';
export const MIGRATION_0005_SOURCE_ID='source:api-football';
export const MIGRATION_0005_SOURCE_REVISION='api-football:eia-2i5a:1';
export const MIGRATION_0005_RUNTIME_DISABLE_REASON='EIA_2I5D_REPOSITORY_ONLY';
export const MIGRATION_0005_MAX_OBSERVED_ROWS_READ=1000000;
export const MIGRATION_0005_MAX_OBSERVED_ROWS_WRITTEN=10000;

export const MIGRATION_0005_PRIOR_LEDGER=Object.freeze([
  Object.freeze({version:1,name:'shadow_data_foundation'}),
  Object.freeze({version:2,name:'official_fpl_structured_history'}),
  Object.freeze({version:3,name:'production_query_plan_indexes'}),
  Object.freeze({version:4,name:'api_football_shadow_identity'})
]);

export const MIGRATION_0005_REQUIRED_OBJECTS=Object.freeze([
  Object.freeze({type:'table',name:'api_football_runtime_state',table:'api_football_runtime_state'}),
  Object.freeze({type:'table',name:'api_football_discovery_generations',table:'api_football_discovery_generations'}),
  Object.freeze({type:'table',name:'api_football_discovery_heads',table:'api_football_discovery_heads'}),
  Object.freeze({type:'trigger',name:'api_football_committed_head_insert',table:'api_football_discovery_heads'}),
  Object.freeze({type:'trigger',name:'api_football_committed_head_update',table:'api_football_discovery_heads'}),
  Object.freeze({type:'trigger',name:'api_football_committed_generation_immutable',table:'api_football_discovery_generations'}),
  Object.freeze({type:'table',name:'api_football_request_attempts',table:'api_football_request_attempts'}),
  Object.freeze({type:'index',name:'api_football_attempt_retention',table:'api_football_request_attempts'}),
  Object.freeze({type:'table',name:'api_football_fixture_revisions',table:'api_football_fixture_revisions'}),
  Object.freeze({type:'index',name:'api_football_fixture_revision_history',table:'api_football_fixture_revisions'}),
  Object.freeze({type:'trigger',name:'api_football_fixture_supersession_insert',table:'api_football_fixture_revisions'}),
  Object.freeze({type:'table',name:'api_football_generation_fixtures',table:'api_football_generation_fixtures'}),
  Object.freeze({type:'trigger',name:'api_football_generation_fixture_consistency',table:'api_football_generation_fixtures'}),
  Object.freeze({type:'trigger',name:'api_football_participation_run_insert',table:'provider_participation_revisions'}),
  Object.freeze({type:'trigger',name:'api_football_participation_run_update',table:'provider_participation_revisions'})
]);

export const MIGRATION_0005_BASE_OBJECTS=MIGRATION_0004_REQUIRED_OBJECTS;
export const MIGRATION_0005_RIGHTS_COLUMNS=MIGRATION_0004_RIGHTS_COLUMNS;

export const MIGRATION_0005_FORBIDDEN_LATER_OBJECTS=Object.freeze([
  'api_football_team_mapping_qualifications','api_football_team_mapping_members',
  'api_football_mapping_member_insert','api_football_mapping_qualification_commit',
  'api_football_mapping_qualification_immutable','api_football_mapping_member_update_immutable',
  'api_football_mapping_member_delete_immutable','api_football_team_mapping_heads',
  'api_football_mapping_head_insert','api_football_mapping_head_update','api_football_mapping_members_provider'
]);

export const MIGRATION_0005_PROTECTED_COUNT_KEYS=Object.freeze([
  'data_sources','data_source_revisions','canonical_entities','ingestion_runs','entity_mappings',
  'shadow_observations','observation_relations','observation_heads','observation_rejections',
  'accepted_logical_keys','orphan_heads','invalid_heads','started_runs','completed_runs','other_runs',
  'provider_fixture_identities','provider_participation_revisions','schema_migrations'
]);

export const MIGRATION_0005_STATE_EXACT_PRE='exact_pre_state';
export const MIGRATION_0005_STATE_EXACT_POST='exact_post_state';
export const MIGRATION_0005_STATE_INCONSISTENT='inconsistent';
export const MIGRATION_0005_APPLIED='DEFINITELY_APPLIED_SUCCESSFULLY';
export const MIGRATION_0005_APPLIED_RESOURCE_REVIEW='DEFINITELY_APPLIED_RESOURCE_REVIEW_REQUIRED';
export const MIGRATION_0005_ALREADY_APPLIED='DEFINITELY_ALREADY_APPLIED';
export const MIGRATION_0005_NOT_APPLIED='DEFINITELY_NOT_APPLIED';
export const MIGRATION_0005_AMBIGUOUS='AMBIGUOUS_REQUIRES_OWNER_ATTENTION';

const fail=code=>{throw new Error(code);};
const integer=value=>{
  const number=Number(value);
  if(!Number.isSafeInteger(number)||number<0)fail('migration_0005_contract_invalid');
  return number;
};
const objectKey=row=>`${row.type}:${row.name}:${row.tbl_name??row.table}`;
const expectedKeys=rows=>new Set(rows.map(row=>objectKey({type:row.type,name:row.name,tbl_name:row.table})));

function withoutLineComments(sql){return sql.replace(/^[ \t]*--.*(?:\r?\n|$)/gm,'');}

export function splitMigration0005Sql(sql){
  if(typeof sql!=='string'||!sql)fail('migration_0005_content_invalid');
  const source=withoutLineComments(sql),statements=[];
  let buffer='',quote=null,trigger=false;
  for(let index=0;index<source.length;index+=1){
    const char=source[index];
    if(quote!==null){
      buffer+=char;
      if(char===quote){if(source[index+1]===quote)buffer+=source[++index];else quote=null;}
      continue;
    }
    if(char==="'"||char==='"'){quote=char;buffer+=char;continue;}
    buffer+=char;
    if(!trigger&&buffer.trimStart().toUpperCase().startsWith('CREATE TRIGGER'))trigger=true;
    if(char===';'){
      const candidate=buffer.slice(0,-1).trim();
      if(!trigger||candidate.toUpperCase().endsWith('END')){
        if(candidate)statements.push(candidate);
        buffer='';trigger=false;
      }
    }
  }
  if(quote!==null||buffer.trim())fail('migration_0005_statement_contract_invalid');
  return Object.freeze(statements);
}

export function assertPinnedMigration0005Statements(statements){
  if(!Array.isArray(statements)||statements.length!==MIGRATION_0005_STATEMENT_COUNT)
    fail('migration_0005_statement_contract_invalid');
  const prefixes=[
    'INSERT INTO schema_migrations (version, name, applied_at)',
    'INSERT OR IGNORE INTO data_sources (source_id, source_key, source_name, source_kind, created_at)',
    'INSERT OR IGNORE INTO data_source_revisions (',
    'CREATE TABLE api_football_runtime_state (',
    'INSERT INTO api_football_runtime_state (provider,collection_enabled,disable_reason,updated_at)',
    'CREATE TABLE api_football_discovery_generations (',
    'CREATE TABLE api_football_discovery_heads (',
    'CREATE TRIGGER api_football_committed_head_insert BEFORE INSERT ON api_football_discovery_heads',
    'CREATE TRIGGER api_football_committed_head_update BEFORE UPDATE ON api_football_discovery_heads',
    'CREATE TRIGGER api_football_committed_generation_immutable BEFORE UPDATE OF state,fpl_season ON api_football_discovery_generations',
    'CREATE TABLE api_football_request_attempts (',
    'CREATE INDEX api_football_attempt_retention ON api_football_request_attempts(reserved_at,attempt_id)',
    'CREATE TABLE api_football_fixture_revisions (',
    'CREATE INDEX api_football_fixture_revision_history ON api_football_fixture_revisions(provider_fixture_identity,fetched_at)',
    'CREATE TRIGGER api_football_fixture_supersession_insert BEFORE INSERT ON api_football_fixture_revisions',
    'CREATE TABLE api_football_generation_fixtures (',
    'CREATE TRIGGER api_football_generation_fixture_consistency BEFORE INSERT ON api_football_generation_fixtures',
    'ALTER TABLE provider_participation_revisions ADD COLUMN ingestion_run_id TEXT REFERENCES ingestion_runs(run_id)',
    'CREATE TRIGGER api_football_participation_run_insert BEFORE INSERT ON provider_participation_revisions',
    'CREATE TRIGGER api_football_participation_run_update BEFORE UPDATE OF ingestion_run_id,source_revision_id ON provider_participation_revisions'
  ];
  for(let index=0;index<prefixes.length;index+=1)
    if(!String(statements[index]??'').startsWith(prefixes[index]))fail('migration_0005_statement_contract_invalid');
  const triggers=statements.filter(statement=>statement.trimStart().toUpperCase().startsWith('CREATE TRIGGER'));
  if(triggers.length!==7||triggers.some(statement=>!statement.trimEnd().toUpperCase().endsWith('END')))
    fail('migration_0005_statement_contract_invalid');
  return Object.freeze([...statements]);
}

function normalizedLedger(rows){
  if(!Array.isArray(rows))fail('migration_0005_state_contract_invalid');
  return rows.map(row=>{
    const version=Number(row?.version);
    if(!Number.isSafeInteger(version)||version<1||typeof row?.name!=='string')fail('migration_0005_state_contract_invalid');
    return {version,name:row.name,appliedAt:row.applied_at??row.appliedAt??null};
  });
}
function ledgerPrefix(rows){
  return MIGRATION_0005_PRIOR_LEDGER.every((expected,index)=>rows[index]?.version===expected.version&&rows[index]?.name===expected.name);
}
function objectSet(rows){
  if(!Array.isArray(rows))fail('migration_0005_state_contract_invalid');
  return new Set(rows.map(row=>{
    if(!row||typeof row.type!=='string'||typeof row.name!=='string'||typeof row.tbl_name!=='string')fail('migration_0005_state_contract_invalid');
    return objectKey(row);
  }));
}
function hasExactObjects(set,rows){
  const expected=expectedKeys(rows);
  return [...expected].every(key=>set.has(key));
}
function hasForbidden(set){return MIGRATION_0005_FORBIDDEN_LATER_OBJECTS.some(name=>[...set].some(key=>key.includes(`:${name}:`)));}
function columnNames(rows){return new Set((rows??[]).map(row=>String(row?.name??'')).filter(Boolean));}

export function classifyMigration0005State({ledger,objects,participationColumns}){
  const rows=normalizedLedger(ledger),set=objectSet(objects),columns=columnNames(participationColumns);
  if(!ledgerPrefix(rows)||!hasExactObjects(set,MIGRATION_0005_BASE_OBJECTS)||hasForbidden(set))return MIGRATION_0005_STATE_INCONSISTENT;
  const fifth=rows.filter(row=>row.version===MIGRATION_0005_VERSION);
  const newObjectsPresent=hasExactObjects(set,MIGRATION_0005_REQUIRED_OBJECTS);
  const anyNew=MIGRATION_0005_REQUIRED_OBJECTS.some(row=>set.has(objectKey({type:row.type,name:row.name,tbl_name:row.table})));
  const hasRunColumn=columns.has('ingestion_run_id');
  if(rows.length===4&&fifth.length===0&&!anyNew&&!hasRunColumn)return MIGRATION_0005_STATE_EXACT_PRE;
  if(rows.length===5&&fifth.length===1&&fifth[0].name===MIGRATION_0005_NAME&&fifth[0].appliedAt===MIGRATION_0005_APPLIED_AT&&newObjectsPresent&&hasRunColumn)
    return MIGRATION_0005_STATE_EXACT_POST;
  return MIGRATION_0005_STATE_INCONSISTENT;
}

export function validateMigration0005Counts(row){
  if(!row||typeof row!=='object')fail('migration_0005_counts_invalid');
  const result={};
  for(const key of MIGRATION_0005_PROTECTED_COUNT_KEYS)result[key]=integer(row[key]);
  return Object.freeze(result);
}

export function expectedApiFootballSource(){
  return Object.freeze({source_id:MIGRATION_0005_SOURCE_ID,source_key:'api-football',source_name:'API-Football',source_kind:'external_provider',created_at:MIGRATION_0005_APPLIED_AT});
}
export function expectedApiFootballRevision(){
  return Object.freeze({
    source_revision_id:MIGRATION_0005_SOURCE_REVISION,source_id:MIGRATION_0005_SOURCE_ID,revision:1,
    schema_version:'api-football-v3-foundation-1',rights_classification:'owner_risk_accepted_private_use',
    retention_allowed:1,redistribution_allowed:0,attribution_required:0,acquisition_status:'repository_only_disabled',
    shadow_ingest_allowed:1,provider:'api-football',source_key:'api-football',owner_approval_id:'EIA-2I5A',
    allowed_use:'private_noncommercial_research',normalized_facts_only:1,public_use_allowed:0,
    commercial_use_allowed:0,raw_payload_retention_allowed:0,stop_on_objection:1
  });
}
function exactSubset(row,expected){return row&&Object.entries(expected).every(([key,value])=>row[key]===value);}
function oneRow(rows,code){if(!Array.isArray(rows)||rows.length!==1)fail(code);return rows[0];}
function zeroRows(rows,code){if(!Array.isArray(rows)||rows.length!==0)fail(code);}
function zeroCount(row,code){if(integer(row?.count)!==0)fail(code);}

export function validateMigration0005Pre({state,counts,foreignKeys,rightsColumns,sourceRows,revisionRows,mappingRows,fixtureRows,participationRows}){
  if(state!==MIGRATION_0005_STATE_EXACT_PRE)fail('migration_0005_pre_state_invalid');
  const c=validateMigration0005Counts(counts);
  if(!Array.isArray(foreignKeys)||foreignKeys.length!==0)fail('migration_0005_foreign_key_violation');
  const rights=columnNames(rightsColumns);if(!MIGRATION_0005_RIGHTS_COLUMNS.every(name=>rights.has(name)))fail('migration_0005_rights_schema_invalid');
  if(c.started_runs!==0)fail('migration_0005_collection_in_progress');
  zeroRows(sourceRows,'migration_0005_source_preexisting');
  zeroRows(revisionRows,'migration_0005_revision_preexisting');
  zeroCount(mappingRows,'migration_0005_mapping_preexisting');
  zeroCount(fixtureRows,'migration_0005_fixture_preexisting');
  zeroCount(participationRows,'migration_0005_participation_preexisting');
  return true;
}

export function validateMigration0005Post({state,preCounts,postCounts,foreignKeys,rightsColumns,sourceRows,revisionRows,runtimeRows,emptyCounts}){
  if(state!==MIGRATION_0005_STATE_EXACT_POST)fail('migration_0005_post_state_invalid');
  const before=validateMigration0005Counts(preCounts),after=validateMigration0005Counts(postCounts);
  if(!Array.isArray(foreignKeys)||foreignKeys.length!==0)fail('migration_0005_foreign_key_violation');
  const rights=columnNames(rightsColumns);if(!MIGRATION_0005_RIGHTS_COLUMNS.every(name=>rights.has(name)))fail('migration_0005_rights_schema_invalid');
  for(const key of MIGRATION_0005_PROTECTED_COUNT_KEYS){
    let expected=before[key];
    if(key==='schema_migrations'||key==='data_sources'||key==='data_source_revisions')expected+=1;
    if(after[key]!==expected)fail('migration_0005_history_not_preserved');
  }
  if(!exactSubset(oneRow(sourceRows,'migration_0005_source_post_invalid'),expectedApiFootballSource()))fail('migration_0005_source_post_invalid');
  if(!exactSubset(oneRow(revisionRows,'migration_0005_revision_post_invalid'),expectedApiFootballRevision()))fail('migration_0005_revision_post_invalid');
  const runtime=oneRow(runtimeRows,'migration_0005_runtime_post_invalid');
  const expectedRuntime={provider:'api-football',collection_enabled:0,disable_reason:MIGRATION_0005_RUNTIME_DISABLE_REASON,
    credential_state:'UNPROVISIONED',quota_state:'UNOBSERVED',quota_utc_day:null,daily_attempt_count:0,
    in_flight_attempt_id:null,in_flight_lease_expires_at:null,earliest_next_request_at:null,last_429_at:null,
    last_successful_request_at:null,updated_at:MIGRATION_0005_APPLIED_AT};
  if(!exactSubset(runtime,expectedRuntime))fail('migration_0005_runtime_post_invalid');
  for(const [key,row] of Object.entries(emptyCounts??{}))zeroCount(row,`migration_0005_${key}_not_empty`);
  return true;
}
