import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {EXPECTED_D1_DATABASE_ID} from '../phase4b/live-contract.mjs';
import {
  MIGRATION_0005_ALREADY_APPLIED,MIGRATION_0005_AMBIGUOUS,MIGRATION_0005_APPLIED,
  MIGRATION_0005_APPLIED_RESOURCE_REVIEW,MIGRATION_0005_BASE_OBJECTS,MIGRATION_0005_FORBIDDEN_LATER_OBJECTS,
  MIGRATION_0005_GIT_BLOB_SHA,MIGRATION_0005_MAX_OBSERVED_ROWS_READ,MIGRATION_0005_MAX_OBSERVED_ROWS_WRITTEN,
  MIGRATION_0005_NOT_APPLIED,MIGRATION_0005_PATH,MIGRATION_0005_REQUIRED_OBJECTS,
  MIGRATION_0005_STATE_EXACT_POST,MIGRATION_0005_STATE_EXACT_PRE,
  assertPinnedMigration0005Statements,assertSameOfficialFplAuthority,classifyMigration0005State,
  officialFplAuthoritySnapshot,splitMigration0005Sql,validateMigration0005Post,validateMigration0005Pre
} from './migration-0005-contract.mjs';

const API_BASE='https://api.cloudflare.com/client/v4';
const READ_TIMEOUT_MS=20000;
const MUTATION_TIMEOUT_MS=120000;
const MAX_READ_STATEMENTS=20;
const MAX_MUTATION_STATEMENTS=20;
const MAX_D1_API_CALLS=6;
const MAX_SQL_BYTES=100000;
const MAX_REQUEST_BYTES=16*1024*1024;
const encoder=new TextEncoder();
const sha256=value=>createHash('sha256').update(String(value)).digest('hex');
const hex64=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const gitBlobSha=content=>createHash('sha1').update(`blob ${Buffer.byteLength(content,'utf8')}\0`).update(content,'utf8').digest('hex');
const d1Url=(accountId,databaseId,suffix)=>`${API_BASE}/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}${suffix}`;

const LEDGER_SQL='SELECT version,name,applied_at FROM schema_migrations ORDER BY version';
const OBJECT_NAMES=Object.freeze([...new Set([
  ...MIGRATION_0005_BASE_OBJECTS.map(row=>row.name),...MIGRATION_0005_REQUIRED_OBJECTS.map(row=>row.name),...MIGRATION_0005_FORBIDDEN_LATER_OBJECTS
])]);
const OBJECT_SQL=`SELECT type,name,tbl_name FROM sqlite_master WHERE name IN (${OBJECT_NAMES.map(name=>`'${name}'`).join(',')}) ORDER BY type,name`;
const FK_SQL='PRAGMA foreign_key_check';
const RIGHTS_COLUMNS_SQL='PRAGMA table_info(data_source_revisions)';
const PARTICIPATION_COLUMNS_SQL='PRAGMA table_info(provider_participation_revisions)';
const COUNTS_SQL=`SELECT
(SELECT COUNT(*) FROM data_sources) AS data_sources,
(SELECT COUNT(*) FROM data_source_revisions) AS data_source_revisions,
(SELECT COUNT(*) FROM canonical_entities) AS canonical_entities,
(SELECT COUNT(*) FROM ingestion_runs) AS ingestion_runs,
(SELECT COUNT(*) FROM entity_mappings) AS entity_mappings,
(SELECT COUNT(*) FROM shadow_observations) AS shadow_observations,
(SELECT COUNT(*) FROM observation_relations) AS observation_relations,
(SELECT COUNT(*) FROM observation_heads) AS observation_heads,
(SELECT COUNT(*) FROM observation_rejections) AS observation_rejections,
(SELECT COUNT(DISTINCT logical_key) FROM shadow_observations WHERE admission_state='accepted') AS accepted_logical_keys,
(SELECT COUNT(*) FROM observation_heads h LEFT JOIN shadow_observations o ON o.observation_id=h.observation_id WHERE o.observation_id IS NULL) AS orphan_heads,
(SELECT COUNT(*) FROM observation_heads h JOIN shadow_observations o ON o.observation_id=h.observation_id LEFT JOIN ingestion_runs r ON r.run_id=o.ingestion_run_id AND r.source_revision_id=o.source_revision_id WHERE h.logical_key<>o.logical_key OR o.admission_state<>'accepted' OR r.status<>'completed') AS invalid_heads,
(SELECT COUNT(*) FROM ingestion_runs WHERE status='started') AS started_runs,
(SELECT COUNT(*) FROM ingestion_runs WHERE status='completed') AS completed_runs,
(SELECT COUNT(*) FROM ingestion_runs WHERE status NOT IN ('started','completed')) AS other_runs,
(SELECT COUNT(*) FROM provider_fixture_identities) AS provider_fixture_identities,
(SELECT COUNT(*) FROM provider_participation_revisions) AS provider_participation_revisions,
(SELECT COUNT(*) FROM schema_migrations) AS schema_migrations`;
const OFFICIAL_RUN_SQL="SELECT run_id,completed_at,status FROM ingestion_runs WHERE source_revision_id='official-fpl-r1' AND status='completed' AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1";
const OFFICIAL_TEAMS_SQL="SELECT o.subject_entity_id,o.observation_id,o.input_revision,o.logical_key FROM observation_heads h JOIN shadow_observations o ON o.observation_id=h.observation_id JOIN ingestion_runs r ON r.run_id=o.ingestion_run_id AND r.source_revision_id=o.source_revision_id WHERE h.logical_key>='official-fpl|2026-27|team|' AND h.logical_key<'official-fpl|2026-27|team|￿' AND o.source_revision_id='official-fpl-r1' AND o.category='official_fpl_team' AND o.metric='present' AND o.value_type='boolean' AND o.value_boolean=1 AND r.status='completed' ORDER BY o.logical_key";
const SOURCE_SQL="SELECT source_id,source_key,source_name,source_kind,created_at FROM data_sources WHERE source_id='source:api-football' OR source_key='api-football' ORDER BY source_id";
const REVISION_SQL="SELECT source_revision_id,source_id,revision,schema_version,rights_classification,retention_allowed,redistribution_allowed,attribution_required,acquisition_status,shadow_ingest_allowed,provider,source_key,owner_approval_id,allowed_use,normalized_facts_only,public_use_allowed,commercial_use_allowed,raw_payload_retention_allowed,stop_on_objection FROM data_source_revisions WHERE source_revision_id='api-football:eia-2i5a:1' OR provider='api-football' OR source_key='api-football' ORDER BY source_revision_id";
const MAPPING_SQL="SELECT COUNT(*) AS count FROM entity_mappings WHERE source_revision_id='api-football:eia-2i5a:1'";
const FIXTURE_SQL='SELECT COUNT(*) AS count FROM provider_fixture_identities';
const PARTICIPATION_SQL='SELECT COUNT(*) AS count FROM provider_participation_revisions';
const RUNTIME_SQL="SELECT provider,collection_enabled,disable_reason,credential_state,quota_state,quota_utc_day,daily_attempt_count,in_flight_attempt_id,in_flight_lease_expires_at,earliest_next_request_at,last_429_at,last_successful_request_at,updated_at FROM api_football_runtime_state WHERE provider='api-football'";
const ATTEMPTS_SQL='SELECT COUNT(*) AS count FROM api_football_request_attempts';
const GENERATIONS_SQL='SELECT COUNT(*) AS count FROM api_football_discovery_generations';
const DISCOVERY_HEADS_SQL='SELECT COUNT(*) AS count FROM api_football_discovery_heads';
const FIXTURE_REVISIONS_SQL='SELECT COUNT(*) AS count FROM api_football_fixture_revisions';
const GENERATION_FIXTURES_SQL='SELECT COUNT(*) AS count FROM api_football_generation_fixtures';

const BASE_QUERIES=Object.freeze([
  {key:'ledger',sql:LEDGER_SQL},{key:'objects',sql:OBJECT_SQL},{key:'foreignKeys',sql:FK_SQL},
  {key:'rightsColumns',sql:RIGHTS_COLUMNS_SQL},{key:'participationColumns',sql:PARTICIPATION_COLUMNS_SQL},
  {key:'counts',sql:COUNTS_SQL},{key:'officialRun',sql:OFFICIAL_RUN_SQL},{key:'officialTeams',sql:OFFICIAL_TEAMS_SQL},
  {key:'sourceRows',sql:SOURCE_SQL},{key:'revisionRows',sql:REVISION_SQL},{key:'mappingRows',sql:MAPPING_SQL},
  {key:'fixtureRows',sql:FIXTURE_SQL},{key:'participationRows',sql:PARTICIPATION_SQL}
]);
const POST_ONLY_QUERIES=Object.freeze([
  {key:'runtimeRows',sql:RUNTIME_SQL},{key:'attempts',sql:ATTEMPTS_SQL},{key:'generations',sql:GENERATIONS_SQL},
  {key:'discoveryHeads',sql:DISCOVERY_HEADS_SQL},{key:'fixtureRevisions',sql:FIXTURE_REVISIONS_SQL},
  {key:'generationFixtures',sql:GENERATION_FIXTURES_SQL}
]);

function validateIdentity({accountId,accountFingerprint,databaseId,token}){
  if(typeof accountId!=='string'||!accountId||!hex64(accountFingerprint)||sha256(accountId)!==accountFingerprint||
     databaseId!==EXPECTED_D1_DATABASE_ID||typeof token!=='string'||!token)throw new Error('migration_0005_identity_invalid');
}
function headers(token){return Object.freeze({Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json'});}
async function requestJson(transport,request,{mutation=false}={}){
  let response;
  try{response=await transport(Object.freeze({...request,signal:AbortSignal.timeout(mutation?MUTATION_TIMEOUT_MS:READ_TIMEOUT_MS)}));}
  catch{
    const error=new Error(mutation?'migration_0005_mutation_outcome_unknown':'migration_0005_transport_failed');
    error.outcomeUnknown=mutation;throw error;
  }
  const status=Number(response?.status);
  if(status===401||status===403)throw new Error('migration_0005_auth_failed');
  if(status===429)throw new Error('migration_0005_rate_limited');
  if(!Number.isInteger(status)||status<200||status>=300)throw new Error('migration_0005_http_failed');
  let payload;try{payload=typeof response.json==='function'?await response.json():JSON.parse(response.body);}
  catch{throw new Error('migration_0005_response_json_invalid');}
  if(!payload||payload.success!==true)throw new Error('migration_0005_api_failed');
  return payload.result;
}

export function readPinnedMigration0005(readFile=path=>fs.readFileSync(path,'utf8')){
  const sql=readFile(MIGRATION_0005_PATH);
  if(typeof sql!=='string'||Buffer.byteLength(sql,'utf8')!==9923||gitBlobSha(sql)!==MIGRATION_0005_GIT_BLOB_SHA)
    throw new Error('migration_0005_content_drift');
  return assertPinnedMigration0005Statements(splitMigration0005Sql(sql));
}
function oneRow(rows,key){if(!Array.isArray(rows)||rows.length!==1||!rows[0]||typeof rows[0]!=='object')throw new Error(`migration_0005_${key}_contract_invalid`);return rows[0];}

function createClient({accountId,accountFingerprint,databaseId=EXPECTED_D1_DATABASE_ID,token,transport}){
  validateIdentity({accountId,accountFingerprint,databaseId,token});
  if(typeof transport!=='function')throw new Error('migration_0005_transport_invalid');
  const base=d1Url(accountId,databaseId,'');
  let calls=0,rowsRead=0,rowsWritten=0,requestBytes=0;
  const takeCall=()=>{calls+=1;if(calls>MAX_D1_API_CALLS)throw new Error('migration_0005_api_call_ceiling_exceeded');};
  const accounting=()=>Object.freeze({apiCalls:calls,rowsRead,rowsWritten,requestBytes});
  const d1Batch=async(queries,{mutation=false}={})=>{
    if(!Array.isArray(queries)||queries.length<1||queries.length>(mutation?MAX_MUTATION_STATEMENTS:MAX_READ_STATEMENTS))
      throw new Error('migration_0005_batch_contract_invalid');
    for(const query of queries)if(typeof query?.sql!=='string'||encoder.encode(query.sql).byteLength>MAX_SQL_BYTES)
      throw new Error('migration_0005_sql_size_invalid');
    takeCall();
    const bodyObject={batch:queries.map(query=>({sql:query.sql,params:[]}))};
    const body=JSON.stringify(bodyObject),bytes=encoder.encode(body).byteLength;
    if(bytes>MAX_REQUEST_BYTES)throw new Error('migration_0005_request_too_large');
    requestBytes+=bytes;
    const result=await requestJson(transport,{method:'POST',url:base+'/query',headers:headers(token),body,redirect:'error'},{mutation});
    if(!Array.isArray(result)||result.length!==queries.length)throw new Error('migration_0005_result_contract_invalid');
    const rows={};
    for(let index=0;index<queries.length;index+=1){
      const item=result[index];
      if(!item||item.success!==true||!Array.isArray(item.results))throw new Error('migration_0005_statement_failed');
      const read=Number(item.meta?.rows_read??0),written=Number(item.meta?.rows_written??0);
      if(!Number.isSafeInteger(read)||read<0||!Number.isSafeInteger(written)||written<0)throw new Error('migration_0005_accounting_invalid');
      if(!mutation&&written!==0)throw new Error('migration_0005_read_wrote_rows');
      rowsRead+=read;rowsWritten+=written;rows[queries[index].key]=item.results;
    }
    return Object.freeze(rows);
  };
  const reconcile=async({post=false,nowIso})=>{
    const rows=await d1Batch(post?[...BASE_QUERIES,...POST_ONLY_QUERIES]:BASE_QUERIES);
    const state=classifyMigration0005State({ledger:rows.ledger,objects:rows.objects,participationColumns:rows.participationColumns});
    const authority=officialFplAuthoritySnapshot(rows.officialRun,rows.officialTeams,nowIso);
    return Object.freeze({
      state,
      ledger:Object.freeze(rows.ledger.map(row=>Object.freeze({version:Number(row.version),name:String(row.name),appliedAt:row.applied_at??null}))),
      counts:oneRow(rows.counts,'counts'),foreignKeys:rows.foreignKeys,rightsColumns:rows.rightsColumns,
      participationColumns:rows.participationColumns,sourceRows:rows.sourceRows,revisionRows:rows.revisionRows,
      mappingRows:oneRow(rows.mappingRows,'mapping_rows'),fixtureRows:oneRow(rows.fixtureRows,'fixture_rows'),
      participationRows:oneRow(rows.participationRows,'participation_rows'),authority,
      runtimeRows:post?rows.runtimeRows:null,
      emptyCounts:post?Object.freeze({
        attempts:oneRow(rows.attempts,'attempts'),generations:oneRow(rows.generations,'generations'),
        discovery_heads:oneRow(rows.discoveryHeads,'discovery_heads'),fixture_revisions:oneRow(rows.fixtureRevisions,'fixture_revisions'),
        generation_fixtures:oneRow(rows.generationFixtures,'generation_fixtures'),mapping_rows:oneRow(rows.mappingRows,'mapping_rows'),
        fixture_identities:oneRow(rows.fixtureRows,'fixture_rows'),participation_revisions:oneRow(rows.participationRows,'participation_rows')
      }):null
    });
  };
  const mutate=async statements=>{
    const pinned=assertPinnedMigration0005Statements(statements);
    return d1Batch(pinned.map((sql,index)=>({key:`statement_${index+1}`,sql})),{mutation:true});
  };
  const bookmark=async()=>{
    takeCall();
    const result=await requestJson(transport,{method:'GET',url:base+'/time_travel/bookmark',headers:headers(token),redirect:'error'});
    if(typeof result?.bookmark!=='string'||!result.bookmark)throw new Error('migration_0005_time_travel_bookmark_invalid');
    return result.bookmark;
  };
  return Object.freeze({reconcile,mutate,bookmark,accounting});
}

const snapshotDigest=snapshot=>sha256(JSON.stringify(snapshot));
const stateDigest=state=>sha256(JSON.stringify({ledger:state.ledger.map(row=>[row.version,row.name]),counts:state.counts,authority:snapshotDigest(state.authority)}));
function withinResourceCeilings(accounting){const d1=accounting();return d1.rowsRead<=MIGRATION_0005_MAX_OBSERVED_ROWS_READ&&d1.rowsWritten<=MIGRATION_0005_MAX_OBSERVED_ROWS_WRITTEN;}
function reportBase({classification,ok,mutationIssued,before,after,checkpointAt,preBookmarkDigest=null,postBookmarkDigest=null,note=null,accounting}){
  return Object.freeze({
    ok,classification,note,mutationIssued,recoveryIssued:false,automaticRestorePermitted:false,
    migration:Object.freeze({path:MIGRATION_0005_PATH,gitBlobSha:MIGRATION_0005_GIT_BLOB_SHA,statements:20}),
    recovery:Object.freeze({mechanism:'cloudflare_d1_time_travel_attended_only',checkpointAt:checkpointAt??null,preBookmarkDigest,postBookmarkDigest}),
    state:Object.freeze({before:before?.state??null,after:after?.state??null}),
    ledger:Object.freeze((after?.ledger??before?.ledger??[]).map(row=>`${row.version}:${row.name}`)),
    counts:Object.freeze({before:before?.counts??null,after:after?.counts??null}),
    officialAuthority:Object.freeze({before:before?snapshotDigest(before.authority):null,after:after?snapshotDigest(after.authority):null}),
    preStateDigest:before?stateDigest(before):null,d1:accounting()
  });
}

export async function applyMigration0005(options){
  const allowed=['accountId','accountFingerprint','databaseId','token','transport','readFile','clock'];
  if(!options||Object.keys(options).some(key=>!allowed.includes(key)))throw new Error('migration_0005_config_invalid');
  const {accountId,accountFingerprint,databaseId=EXPECTED_D1_DATABASE_ID,token,transport,readFile,clock=()=>new Date()}=options;
  const statements=readPinnedMigration0005(readFile);
  const client=createClient({accountId,accountFingerprint,databaseId,token,transport});
  const nowIso=()=>new Date(clock()).toISOString();
  let before;
  try{before=await client.reconcile({post:false,nowIso:nowIso()});}
  catch(error){error.migration0005Phase='pre_reconciliation';error.mutationIssued=false;throw error;}
  if(before.state===MIGRATION_0005_STATE_EXACT_POST){
    const applied=await client.reconcile({post:true,nowIso:nowIso()});
    return reportBase({classification:MIGRATION_0005_ALREADY_APPLIED,ok:false,mutationIssued:false,before:applied,after:applied,accounting:client.accounting});
  }
  validateMigration0005Pre({
    state:before.state,counts:before.counts,foreignKeys:before.foreignKeys,rightsColumns:before.rightsColumns,
    sourceRows:before.sourceRows,revisionRows:before.revisionRows,mappingRows:before.mappingRows,
    fixtureRows:before.fixtureRows,participationRows:before.participationRows
  });
  let preBookmark;
  try{preBookmark=await client.bookmark();}
  catch(error){error.migration0005Phase='time_travel_preflight';error.mutationIssued=false;throw error;}
  const checkpointAt=nowIso(),preBookmarkDigest=sha256(preBookmark);
  let mutationIssued=false,mutationDefinite=false,mutationError=null;
  try{mutationIssued=true;await client.mutate(statements);mutationDefinite=true;}
  catch(error){mutationError=error;}
  let after=null,postError=null;
  try{
    // Common-schema reconciliation first: a lost response can prove an unchanged 0004 pre-state
    // without querying tables that may never have been created.
    after=await client.reconcile({post:false,nowIso:nowIso()});
    if(after.state===MIGRATION_0005_STATE_EXACT_POST){
      after=await client.reconcile({post:true,nowIso:nowIso()});
      validateMigration0005Post({
        state:after.state,preCounts:before.counts,postCounts:after.counts,foreignKeys:after.foreignKeys,
        rightsColumns:after.rightsColumns,sourceRows:after.sourceRows,revisionRows:after.revisionRows,
        runtimeRows:after.runtimeRows,emptyCounts:after.emptyCounts
      });
      assertSameOfficialFplAuthority(before.authority,after.authority);
      let postBookmarkDigest=null,postBookmarkNote=null;
      try{postBookmarkDigest=sha256(await client.bookmark());}catch{postBookmarkNote='post_bookmark_unavailable';}
      const mutationNote=mutationDefinite?null:'reconciled_after_unknown_mutation_transport';
      const resourceOk=withinResourceCeilings(client.accounting);
      return reportBase({
        classification:resourceOk?MIGRATION_0005_APPLIED:MIGRATION_0005_APPLIED_RESOURCE_REVIEW,
        ok:resourceOk,mutationIssued,before,after,checkpointAt,preBookmarkDigest,postBookmarkDigest,
        note:[mutationNote,postBookmarkNote,resourceOk?null:'observed_d1_resource_ceiling_exceeded'].filter(Boolean).join('+')||null,
        accounting:client.accounting
      });
    }
    if(after.state===MIGRATION_0005_STATE_EXACT_PRE&&!mutationDefinite){
      validateMigration0005Pre({
        state:after.state,counts:after.counts,foreignKeys:after.foreignKeys,rightsColumns:after.rightsColumns,
        sourceRows:after.sourceRows,revisionRows:after.revisionRows,mappingRows:after.mappingRows,
        fixtureRows:after.fixtureRows,participationRows:after.participationRows
      });
      assertSameOfficialFplAuthority(before.authority,after.authority);
      return reportBase({classification:MIGRATION_0005_NOT_APPLIED,ok:false,mutationIssued,before,after,checkpointAt,preBookmarkDigest,note:'reconciled_exact_prestate',accounting:client.accounting});
    }
    postError=new Error('migration_0005_post_state_not_accepted');
  }catch(error){postError=error;}
  return reportBase({
    classification:MIGRATION_0005_AMBIGUOUS,ok:false,mutationIssued,before,after,checkpointAt,preBookmarkDigest,
    note:`owner_attention_required:${String(postError?.message??mutationError?.message??'unknown').slice(0,96)}`,
    accounting:client.accounting
  });
}
