// API-Football migration 0004 — pure production application contract.
//
// This module is intentionally I/O-free. It fixes the one migration that a later owner-approved
// production workflow may apply, defines exact pre/post schema states, preserves the application
// population across the table rebuild, and validates the current Official FPL authority snapshot.
// It creates no credential, network, collection, model or UI path.

export const MIGRATION_0004_PATH='workers/data-platform/migrations/0004_api_football_shadow_identity.sql';
export const MIGRATION_0004_GIT_BLOB_SHA='293cb9a0f3cb797c3df162336f3d427ce49f7db5';
export const MIGRATION_0004_VERSION=4;
export const MIGRATION_0004_NAME='api_football_shadow_identity';
export const MIGRATION_0004_APPLIED_AT='2026-09-16T00:00:00.000Z';
export const MIGRATION_0004_STATEMENT_COUNT=40;
export const MIGRATION_0004_AUTHORITY_MAX_AGE_MS=48*60*60*1000;
export const MIGRATION_0004_FPL_SEASON='2026-27';

export const MIGRATION_0004_PRIOR_LEDGER=Object.freeze([
  Object.freeze({version:1,name:'shadow_data_foundation'}),
  Object.freeze({version:2,name:'official_fpl_structured_history'}),
  Object.freeze({version:3,name:'production_query_plan_indexes'})
]);

export const MIGRATION_0004_REQUIRED_OBJECTS=Object.freeze([
  Object.freeze({type:'index',name:'shadow_observation_idempotency',table:'shadow_observations'}),
  Object.freeze({type:'index',name:'shadow_observation_replay',table:'shadow_observations'}),
  Object.freeze({type:'index',name:'observation_heads_observation_id',table:'observation_heads'}),
  Object.freeze({type:'index',name:'shadow_observations_ingestion_run',table:'shadow_observations'}),
  Object.freeze({type:'index',name:'observation_rejections_source_revision',table:'observation_rejections'}),
  Object.freeze({type:'trigger',name:'owner_risk_source_revision_insert',table:'data_source_revisions'}),
  Object.freeze({type:'trigger',name:'owner_risk_source_revision_update',table:'data_source_revisions'}),
  Object.freeze({type:'table',name:'provider_fixture_identities',table:'provider_fixture_identities'}),
  Object.freeze({type:'table',name:'provider_participation_revisions',table:'provider_participation_revisions'}),
  Object.freeze({type:'index',name:'provider_participation_history',table:'provider_participation_revisions'})
]);

export const MIGRATION_0004_BASE_OBJECTS=Object.freeze(MIGRATION_0004_REQUIRED_OBJECTS.slice(0,5));

export const MIGRATION_0004_NEW_OBJECT_NAMES=Object.freeze([
  'owner_risk_source_revision_insert','owner_risk_source_revision_update',
  'provider_fixture_identities','provider_participation_revisions','provider_participation_history'
]);

export const MIGRATION_0004_RIGHTS_COLUMNS=Object.freeze([
  'provider','source_key','owner_approval_id','allowed_use','normalized_facts_only',
  'public_use_allowed','commercial_use_allowed','raw_payload_retention_allowed','stop_on_objection'
]);

export const MIGRATION_0004_FORBIDDEN_LATER_OBJECTS=Object.freeze([
  'api_football_runtime_state','api_football_request_attempts','api_football_discovery_generations',
  'api_football_discovery_heads','api_football_fixture_revisions','api_football_generation_fixtures',
  'api_football_team_mapping_qualifications','api_football_team_mapping_members','api_football_team_mapping_heads'
]);

export const MIGRATION_0004_PROTECTED_COUNT_KEYS=Object.freeze([
  'data_sources','data_source_revisions','canonical_entities','ingestion_runs','entity_mappings',
  'shadow_observations','observation_relations','observation_heads','observation_rejections',
  'accepted_logical_keys','orphan_heads','invalid_heads','started_runs','completed_runs','other_runs',
  'schema_migrations'
]);

export const MIGRATION_0004_STATE_EXACT_PRE='exact_pre_state';
export const MIGRATION_0004_STATE_EXACT_POST='exact_post_state';
export const MIGRATION_0004_STATE_INCONSISTENT='inconsistent';

export const MIGRATION_0004_APPLIED='DEFINITELY_APPLIED_SUCCESSFULLY';
export const MIGRATION_0004_ALREADY_APPLIED='DEFINITELY_ALREADY_APPLIED';
export const MIGRATION_0004_NOT_APPLIED='DEFINITELY_NOT_APPLIED';
export const MIGRATION_0004_RECOVERED='RECOVERED_TO_EXACT_PRESTATE';
export const MIGRATION_0004_AMBIGUOUS='AMBIGUOUS_REQUIRES_OWNER_ATTENTION';

const fail=code=>{throw new Error(code);};
const integer=value=>{
  const number=Number(value);
  if(!Number.isSafeInteger(number)||number<0)fail('migration_0004_contract_invalid');
  return number;
};

function withoutLineComments(sql){
  return sql.replace(/^[ \t]*--.*(?:\r?\n|$)/gm,'');
}

// Migration 0004 contains two CREATE TRIGGER statements whose BEGIN...END bodies contain their
// own semicolon. The parser therefore splits ordinary statements on an unquoted semicolon, but a
// CREATE TRIGGER terminates only at END;. No generic SQL input reaches this parser in production:
// the caller first pins the repository file by Git blob SHA.
export function splitMigration0004Sql(sql){
  if(typeof sql!=='string'||!sql)fail('migration_0004_content_invalid');
  const source=withoutLineComments(sql);
  const statements=[];
  let buffer='',quote=null,trigger=false;
  for(let index=0;index<source.length;index+=1){
    const char=source[index];
    if(quote!==null){
      buffer+=char;
      if(char===quote){
        if(source[index+1]===quote){buffer+=source[++index];}
        else quote=null;
      }
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
  if(quote!==null||buffer.trim())fail('migration_0004_statement_contract_invalid');
  return Object.freeze(statements);
}

export function assertPinnedMigration0004Statements(statements){
  if(!Array.isArray(statements)||statements.length!==MIGRATION_0004_STATEMENT_COUNT)
    fail('migration_0004_statement_contract_invalid');
  const exact=[
    [0,'PRAGMA defer_foreign_keys = ON'],
    [1,"INSERT INTO schema_migrations (version, name, applied_at)\nVALUES (4, 'api_football_shadow_identity', '2026-09-16T00:00:00.000Z')"],
    [35,"CREATE TRIGGER owner_risk_source_revision_insert"],
    [36,"CREATE TRIGGER owner_risk_source_revision_update"],
    [37,"CREATE TABLE provider_fixture_identities ("],
    [38,"CREATE TABLE provider_participation_revisions ("],
    [39,"CREATE INDEX provider_participation_history ON provider_participation_revisions(provider_fixture_identity, provider_player_id, fetched_at)"]
  ];
  for(const [index,prefix] of exact){
    const statement=String(statements[index]??'');
    if(index===0||index===1||index===39){
      if(statement!==prefix)fail('migration_0004_statement_contract_invalid');
    }else if(!statement.startsWith(prefix))fail('migration_0004_statement_contract_invalid');
  }
  const joined=statements.join('\n');
  if(/api_football_shadow_runtime|api_football_mapping_qualification|API_FOOTBALL_API_KEY|PRELIVE_PLANNER_ONLY/i.test(joined))
    fail('migration_0004_scope_violation');
  return Object.freeze([...statements]);
}

function ledgerRows(rows){
  if(!Array.isArray(rows))fail('migration_0004_ledger_invalid');
  const out=rows.map(row=>Object.freeze({version:integer(row?.version),name:String(row?.name??'')}));
  if(out.some(row=>!row.name)||new Set(out.map(row=>row.version)).size!==out.length)
    fail('migration_0004_ledger_invalid');
  return out.sort((a,b)=>a.version-b.version);
}

function priorLedgerExact(rows){
  return rows.length>=3&&MIGRATION_0004_PRIOR_LEDGER.every((expected,index)=>
    rows[index]?.version===expected.version&&rows[index]?.name===expected.name);
}

function exactObjectSet(rows){
  if(!Array.isArray(rows))fail('migration_0004_object_contract_invalid');
  const seen=new Map();
  for(const row of rows){
    if(typeof row?.name!=='string'||typeof row?.type!=='string'||typeof row?.tbl_name!=='string')
      fail('migration_0004_object_contract_invalid');
    if(seen.has(row.name))fail('migration_0004_object_contract_invalid');
    seen.set(row.name,{type:row.type,table:row.tbl_name});
  }
  return seen;
}

function columnNames(rows){
  if(!Array.isArray(rows))fail('migration_0004_column_contract_invalid');
  const names=new Set();
  for(const row of rows){
    if(typeof row?.name!=='string'||names.has(row.name))fail('migration_0004_column_contract_invalid');
    names.add(row.name);
  }
  return names;
}

export function classifyMigration0004State({ledger,objects,dataSourceRevisionColumns}){
  const rows=ledgerRows(ledger),objectMap=exactObjectSet(objects),columns=columnNames(dataSourceRevisionColumns);
  if(!priorLedgerExact(rows))return MIGRATION_0004_STATE_INCONSISTENT;
  if(rows.some(row=>row.version>4))return MIGRATION_0004_STATE_INCONSISTENT;
  if(MIGRATION_0004_FORBIDDEN_LATER_OBJECTS.some(name=>objectMap.has(name)))return MIGRATION_0004_STATE_INCONSISTENT;

  const version4=rows.filter(row=>row.version===4);
  const newObjects=MIGRATION_0004_NEW_OBJECT_NAMES.filter(name=>objectMap.has(name));
  const rights=MIGRATION_0004_RIGHTS_COLUMNS.filter(name=>columns.has(name));

  const baseObjectsExact=MIGRATION_0004_BASE_OBJECTS.every(expected=>{
    const actual=objectMap.get(expected.name);
    return actual?.type===expected.type&&actual?.table===expected.table;
  });
  if(rows.length===3&&version4.length===0&&newObjects.length===0&&rights.length===0&&baseObjectsExact)
    return MIGRATION_0004_STATE_EXACT_PRE;

  const exactV4=rows.length===4&&version4.length===1&&version4[0].name===MIGRATION_0004_NAME;
  const objectsExact=MIGRATION_0004_REQUIRED_OBJECTS.every(expected=>{
    const actual=objectMap.get(expected.name);
    return actual?.type===expected.type&&actual?.table===expected.table;
  });
  if(exactV4&&objectsExact&&rights.length===MIGRATION_0004_RIGHTS_COLUMNS.length)
    return MIGRATION_0004_STATE_EXACT_POST;
  return MIGRATION_0004_STATE_INCONSISTENT;
}

export function validateMigration0004Counts(row){
  if(!row||typeof row!=='object')fail('migration_0004_count_contract_invalid');
  const out={};
  for(const key of MIGRATION_0004_PROTECTED_COUNT_KEYS)out[key]=integer(row[key]);
  return Object.freeze(out);
}

export function validateMigration0004Pre({state,counts,foreignKeys,providerRows}){
  if(state!==MIGRATION_0004_STATE_EXACT_PRE)fail('migration_0004_pre_state_mismatch');
  const protectedCounts=validateMigration0004Counts(counts);
  if(!Array.isArray(foreignKeys)||foreignKeys.length!==0)fail('migration_0004_pre_foreign_key_violation');
  if(protectedCounts.started_runs!==0)fail('migration_0004_collection_in_progress');
  if(integer(providerRows?.count)!==0)fail('migration_0004_unexpected_provider_rows');
  return protectedCounts;
}

export function validateMigration0004Post({state,preCounts,postCounts,foreignKeys,providerRows,fixtureRows,participationRows}){
  if(state!==MIGRATION_0004_STATE_EXACT_POST)fail('migration_0004_post_state_mismatch');
  const before=validateMigration0004Counts(preCounts),after=validateMigration0004Counts(postCounts);
  for(const key of MIGRATION_0004_PROTECTED_COUNT_KEYS){
    const expected=key==='schema_migrations'?before[key]+1:before[key];
    if(after[key]!==expected)fail('migration_0004_history_not_preserved');
  }
  if(!Array.isArray(foreignKeys)||foreignKeys.length!==0)fail('migration_0004_post_foreign_key_violation');
  if(after.started_runs!==0)fail('migration_0004_collection_in_progress');
  if(integer(providerRows?.count)!==0||integer(fixtureRows?.count)!==0||integer(participationRows?.count)!==0)
    fail('migration_0004_provider_state_not_empty');
  return after;
}

export function officialFplAuthoritySnapshot(runRows,teamRows,nowIso){
  if(!Array.isArray(runRows)||runRows.length!==1||!Array.isArray(teamRows)||typeof nowIso!=='string')
    fail('migration_0004_official_authority_invalid');
  const run=runRows[0],completedMs=Date.parse(run?.completed_at),nowMs=Date.parse(nowIso);
  if(typeof run?.run_id!=='string'||!run.run_id||run.status!=='completed'||!Number.isFinite(completedMs)||!Number.isFinite(nowMs))
    fail('migration_0004_official_authority_invalid');
  if(nowMs<completedMs||nowMs-completedMs>MIGRATION_0004_AUTHORITY_MAX_AGE_MS)
    fail('migration_0004_official_authority_stale');
  const rows=teamRows.map(row=>({
    logicalKey:String(row?.logical_key??''),subjectEntityId:String(row?.subject_entity_id??''),
    observationId:String(row?.observation_id??''),inputRevision:String(row?.input_revision??'')
  })).sort((a,b)=>a.logicalKey.localeCompare(b.logicalKey));
  const expectedKeys=Array.from({length:20},(_,index)=>`official-fpl|${MIGRATION_0004_FPL_SEASON}|team|${index+1}|present`).sort();
  const expectedIds=Array.from({length:20},(_,index)=>`${MIGRATION_0004_FPL_SEASON}:fpl:team:${index+1}`).sort();
  const keys=rows.map(row=>row.logicalKey),ids=rows.map(row=>row.subjectEntityId).sort();
  if(rows.length!==20||new Set(keys).size!==20||new Set(ids).size!==20||
     keys.join('|')!==expectedKeys.join('|')||ids.join('|')!==expectedIds.join('|')||
     rows.some(row=>!row.observationId||!row.inputRevision))
    fail('migration_0004_official_authority_invalid');
  return Object.freeze({runId:run.run_id,completedAt:new Date(completedMs).toISOString(),rows:Object.freeze(rows.map(Object.freeze))});
}

export function assertSameOfficialFplAuthority(before,after){
  if(JSON.stringify(before)!==JSON.stringify(after))fail('migration_0004_official_authority_changed');
  return true;
}

export function assertRecoveryAge(checkpointIso,nowIso,maxAgeMs=6*24*60*60*1000){
  const checkpoint=Date.parse(checkpointIso),now=Date.parse(nowIso);
  if(!Number.isFinite(checkpoint)||!Number.isFinite(now)||now<checkpoint||now-checkpoint>maxAgeMs)
    fail('migration_0004_recovery_window_invalid');
  return true;
}
