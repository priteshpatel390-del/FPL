// API-Football migration 0004 — dedicated production application and recovery runner.
//
// One later owner-approved dispatch may apply exactly the pinned repository migration. The runner
// first proves the exact live pre-state, captures a D1 Time Travel bookmark, submits exactly one
// 40-statement transactional D1 batch, and reconciles the database regardless of transport
// certainty. If the resulting state is not the exact reviewed post-state, it makes at most one
// Time Travel restore attempt to the captured pre-mutation bookmark while the workflow-level
// production writer lock is still held, then verifies the restored pre-state.
//
// No API-Football request, mapping persistence, runtime activation, Worker/Cron/secret change,
// model read or UI path exists here.

import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {EXPECTED_D1_DATABASE_ID} from '../phase4b/live-contract.mjs';
import {
  MIGRATION_0004_ALREADY_APPLIED,MIGRATION_0004_AMBIGUOUS,MIGRATION_0004_APPLIED,
  MIGRATION_0004_GIT_BLOB_SHA,MIGRATION_0004_NOT_APPLIED,MIGRATION_0004_PATH,
  MIGRATION_0004_RECOVERED,MIGRATION_0004_STATE_EXACT_POST,MIGRATION_0004_STATE_EXACT_PRE,
  assertPinnedMigration0004Statements,assertSameOfficialFplAuthority,classifyMigration0004State,
  officialFplAuthoritySnapshot,splitMigration0004Sql,validateMigration0004Post,validateMigration0004Pre
} from './migration-0004-contract.mjs';

const API_BASE='https://api.cloudflare.com/client/v4';
const TIMEOUT_MS=20000;
const MAX_READ_STATEMENTS=9;
const MAX_MUTATION_STATEMENTS=40;
const encoder=new TextEncoder();
const hex64=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const sha256=value=>createHash('sha256').update(String(value)).digest('hex');
const gitBlobSha=content=>createHash('sha1').update(`blob ${Buffer.byteLength(content,'utf8')}\0`).update(content,'utf8').digest('hex');
const d1Url=(accountId,databaseId,suffix)=>`${API_BASE}/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}${suffix}`;

const LEDGER_SQL='SELECT version,name,applied_at FROM schema_migrations ORDER BY version';
const OBJECT_SQL=`SELECT type,name,tbl_name FROM sqlite_master WHERE name IN (
'shadow_observation_idempotency','shadow_observation_replay','observation_heads_observation_id',
'shadow_observations_ingestion_run','observation_rejections_source_revision',
'owner_risk_source_revision_insert','owner_risk_source_revision_update',
'provider_fixture_identities','provider_participation_revisions','provider_participation_history',
'api_football_runtime_state','api_football_request_attempts','api_football_discovery_generations',
'api_football_discovery_heads','api_football_fixture_revisions','api_football_generation_fixtures',
'api_football_team_mapping_qualifications','api_football_team_mapping_members','api_football_team_mapping_heads')
ORDER BY type,name`;
const FK_SQL='PRAGMA foreign_key_check';
const COLUMNS_SQL='PRAGMA table_info(data_source_revisions)';
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
(SELECT COUNT(*) FROM schema_migrations) AS schema_migrations`;
const OFFICIAL_RUN_SQL="SELECT run_id,completed_at,status FROM ingestion_runs WHERE source_revision_id='official-fpl-r1' AND status='completed' AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1";
const OFFICIAL_TEAMS_SQL="SELECT o.subject_entity_id,o.observation_id,o.input_revision,o.logical_key FROM observation_heads h JOIN shadow_observations o ON o.observation_id=h.observation_id JOIN ingestion_runs r ON r.run_id=o.ingestion_run_id AND r.source_revision_id=o.source_revision_id WHERE h.logical_key>='official-fpl|2026-27|team|' AND h.logical_key<'official-fpl|2026-27|team|￿' AND o.source_revision_id='official-fpl-r1' AND o.category='official_fpl_team' AND o.metric='present' AND o.value_type='boolean' AND o.value_boolean=1 AND r.status='completed' ORDER BY o.logical_key";
const PROVIDER_ROWS_SQL="SELECT COUNT(*) AS count FROM entity_mappings WHERE source_revision_id='api-football:eia-2i5a:1'";
const FIXTURE_ROWS_SQL='SELECT COUNT(*) AS count FROM provider_fixture_identities';
const PARTICIPATION_ROWS_SQL='SELECT COUNT(*) AS count FROM provider_participation_revisions';

const READ_QUERIES=Object.freeze([
  Object.freeze({key:'ledger',sql:LEDGER_SQL}),
  Object.freeze({key:'objects',sql:OBJECT_SQL}),
  Object.freeze({key:'foreignKeys',sql:FK_SQL}),
  Object.freeze({key:'counts',sql:COUNTS_SQL}),
  Object.freeze({key:'columns',sql:COLUMNS_SQL}),
  Object.freeze({key:'officialRun',sql:OFFICIAL_RUN_SQL}),
  Object.freeze({key:'officialTeams',sql:OFFICIAL_TEAMS_SQL}),
  Object.freeze({key:'providerRows',sql:PROVIDER_ROWS_SQL})
]);
const POST_ONLY_QUERIES=Object.freeze([
  Object.freeze({key:'fixtureRows',sql:FIXTURE_ROWS_SQL}),
  Object.freeze({key:'participationRows',sql:PARTICIPATION_ROWS_SQL})
]);

function validateIdentity({accountId,accountFingerprint,databaseId,token}){
  if(typeof accountId!=='string'||!accountId||!hex64(accountFingerprint)||
     sha256(accountId)!==accountFingerprint||databaseId!==EXPECTED_D1_DATABASE_ID||
     typeof token!=='string'||!token)throw new Error('migration_0004_identity_invalid');
}

async function requestJson(transport,request,{mutation=false}={}){
  let response;
  try{response=await transport(Object.freeze({...request,signal:AbortSignal.timeout(TIMEOUT_MS)}));}
  catch{
    const error=new Error(mutation?'migration_0004_mutation_outcome_unknown':'migration_0004_transport_failed');
    error.outcomeUnknown=mutation;throw error;
  }
  const status=Number(response?.status);
  if(status===401||status===403)throw new Error('migration_0004_auth_failed');
  if(status===429)throw new Error('migration_0004_rate_limited');
  if(!Number.isInteger(status)||status<200||status>=300)throw new Error('migration_0004_http_failed');
  let payload;
  try{payload=typeof response.json==='function'?await response.json():JSON.parse(response.body);}
  catch{throw new Error('migration_0004_response_json_invalid');}
  if(!payload||payload.success!==true)throw new Error('migration_0004_api_failed');
  return payload.result;
}

function headers(token){return Object.freeze({Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json'});}

export function readPinnedMigration0004(readFile=path=>fs.readFileSync(path,'utf8')){
  const sql=readFile(MIGRATION_0004_PATH);
  if(typeof sql!=='string'||gitBlobSha(sql)!==MIGRATION_0004_GIT_BLOB_SHA)
    throw new Error('migration_0004_content_drift');
  return assertPinnedMigration0004Statements(splitMigration0004Sql(sql));
}

function oneRow(rows,key){
  if(!Array.isArray(rows)||rows.length!==1||!rows[0]||typeof rows[0]!=='object')
    throw new Error(`migration_0004_${key}_contract_invalid`);
  return rows[0];
}

function createClient({accountId,accountFingerprint,databaseId=EXPECTED_D1_DATABASE_ID,token,transport}){
  validateIdentity({accountId,accountFingerprint,databaseId,token});
  if(typeof transport!=='function')throw new Error('migration_0004_transport_invalid');
  const base=d1Url(accountId,databaseId,'');
  let calls=0,rowsRead=0,rowsWritten=0,requestBytes=0;
  const accounting=()=>Object.freeze({apiCalls:calls,rowsRead,rowsWritten,requestBytes});

  const d1Batch=async(queries,{mutation=false}={})=>{
    if(!Array.isArray(queries)||queries.length<1||queries.length>(mutation?MAX_MUTATION_STATEMENTS:MAX_READ_STATEMENTS))
      throw new Error('migration_0004_batch_contract_invalid');
    calls+=1;
    const bodyObject={batch:queries.map(query=>({sql:query.sql,params:[]}))};
    const body=JSON.stringify(bodyObject);requestBytes+=encoder.encode(body).byteLength;
    const result=await requestJson(transport,{method:'POST',url:base+'/query',headers:headers(token),body,redirect:'error'},{mutation});
    if(!Array.isArray(result)||result.length!==queries.length)throw new Error('migration_0004_result_contract_invalid');
    const rows={};
    for(let index=0;index<queries.length;index+=1){
      const item=result[index];
      if(!item||item.success!==true||!Array.isArray(item.results))throw new Error('migration_0004_statement_failed');
      const read=Number(item.meta?.rows_read??0),written=Number(item.meta?.rows_written??0);
      if(!Number.isSafeInteger(read)||read<0||!Number.isSafeInteger(written)||written<0)
        throw new Error('migration_0004_accounting_invalid');
      if(!mutation&&written!==0)throw new Error('migration_0004_read_wrote_rows');
      rowsRead+=read;rowsWritten+=written;
      rows[queries[index].key]=item.results;
    }
    return Object.freeze(rows);
  };

  const reconcile=async({post=false,nowIso})=>{
    const rows=await d1Batch(post?[...READ_QUERIES,...POST_ONLY_QUERIES]:READ_QUERIES);
    const state=classifyMigration0004State({ledger:rows.ledger,objects:rows.objects,dataSourceRevisionColumns:rows.columns});
    const counts=oneRow(rows.counts,'counts');
    const providerRows=oneRow(rows.providerRows,'provider_rows');
    const authority=officialFplAuthoritySnapshot(rows.officialRun,rows.officialTeams,nowIso);
    return Object.freeze({
      state,ledger:Object.freeze(rows.ledger.map(row=>Object.freeze({version:Number(row.version),name:String(row.name),appliedAt:row.applied_at??null}))),
      objects:Object.freeze(rows.objects.map(row=>Object.freeze({type:String(row.type),name:String(row.name),table:String(row.tbl_name)}))),
      counts,foreignKeys:rows.foreignKeys,providerRows,authority,
      fixtureRows:post?oneRow(rows.fixtureRows,'fixture_rows'):null,
      participationRows:post?oneRow(rows.participationRows,'participation_rows'):null
    });
  };

  const mutate=async statements=>{
    const pinned=assertPinnedMigration0004Statements(statements);
    const queries=pinned.map((sql,index)=>({key:`statement_${index+1}`,sql}));
    return d1Batch(queries,{mutation:true});
  };

  const bookmark=async({timestamp=null}={})=>{
    calls+=1;
    const query=timestamp===null?'':`?timestamp=${encodeURIComponent(timestamp)}`;
    const result=await requestJson(transport,{method:'GET',url:base+'/time_travel/bookmark'+query,headers:headers(token),redirect:'error'});
    if(typeof result?.bookmark!=='string'||!result.bookmark)throw new Error('migration_0004_time_travel_bookmark_invalid');
    return result.bookmark;
  };

  const restore=async rawBookmark=>{
    if(typeof rawBookmark!=='string'||!rawBookmark)throw new Error('migration_0004_time_travel_bookmark_invalid');
    calls+=1;
    const result=await requestJson(transport,{
      method:'POST',url:base+'/time_travel/restore?bookmark='+encodeURIComponent(rawBookmark),
      headers:headers(token),body:'{}',redirect:'error'
    },{mutation:true});
    if(typeof result?.bookmark!=='string'||!result.bookmark||typeof result?.previous_bookmark!=='string'||!result.previous_bookmark)
      throw new Error('migration_0004_restore_contract_invalid');
    return Object.freeze({bookmark:result.bookmark,previousBookmark:result.previous_bookmark});
  };

  return Object.freeze({reconcile,mutate,bookmark,restore,accounting});
}

const snapshotDigest=snapshot=>sha256(JSON.stringify(snapshot));
const stateDigest=state=>sha256(JSON.stringify({
  ledger:state.ledger.map(row=>[row.version,row.name]),counts:state.counts,
  authority:snapshotDigest(state.authority)
}));

function reportBase({classification,ok,mutationIssued,recoveryIssued,before,after,recoveryCheckpointAt,
  preBookmarkDigest=null,postBookmarkDigest=null,note=null,accounting}){
  return Object.freeze({
    ok,classification,note,mutationIssued,recoveryIssued,
    migration:Object.freeze({path:MIGRATION_0004_PATH,gitBlobSha:MIGRATION_0004_GIT_BLOB_SHA,statements:MAX_MUTATION_STATEMENTS}),
    recovery:Object.freeze({
      mechanism:'cloudflare_d1_time_travel',checkpointAt:recoveryCheckpointAt??null,
      preBookmarkDigest,postBookmarkDigest
    }),
    state:Object.freeze({before:before?.state??null,after:after?.state??null}),
    ledger:Object.freeze((after?.ledger??before?.ledger??[]).map(row=>`${row.version}:${row.name}`)),
    counts:Object.freeze({before:before?.counts??null,after:after?.counts??null}),
    officialAuthority:Object.freeze({
      before:before?snapshotDigest(before.authority):null,
      after:after?snapshotDigest(after.authority):null
    }),
    preStateDigest:before?stateDigest(before):null,
    d1:accounting()
  });
}

export async function applyMigration0004(options){
  const allowed=['accountId','accountFingerprint','databaseId','token','transport','readFile','clock'];
  if(!options||Object.keys(options).some(key=>!allowed.includes(key)))throw new Error('migration_0004_config_invalid');
  const {accountId,accountFingerprint,databaseId=EXPECTED_D1_DATABASE_ID,token,transport,
    readFile,clock=()=>new Date()}=options;
  const statements=readPinnedMigration0004(readFile);
  const client=createClient({accountId,accountFingerprint,databaseId,token,transport});
  const nowIso=()=>new Date(clock()).toISOString();

  let before;
  try{before=await client.reconcile({post:false,nowIso:nowIso()});}
  catch(error){
    error.migration0004Phase='pre_reconciliation';error.mutationIssued=false;throw error;
  }

  if(before.state===MIGRATION_0004_STATE_EXACT_POST){
    const applied=await client.reconcile({post:true,nowIso:nowIso()});
    validateMigration0004Post({
      state:applied.state,preCounts:{...applied.counts,schema_migrations:Number(applied.counts.schema_migrations)-1},
      postCounts:applied.counts,foreignKeys:applied.foreignKeys,providerRows:applied.providerRows,
      fixtureRows:applied.fixtureRows,participationRows:applied.participationRows
    });
    return reportBase({classification:MIGRATION_0004_ALREADY_APPLIED,ok:true,mutationIssued:false,recoveryIssued:false,
      before:applied,after:applied,accounting:client.accounting});
  }

  validateMigration0004Pre({state:before.state,counts:before.counts,foreignKeys:before.foreignKeys,providerRows:before.providerRows});

  let preBookmark;
  try{preBookmark=await client.bookmark();}
  catch(error){
    error.migration0004Phase='time_travel_preflight';error.mutationIssued=false;throw error;
  }
  // Captured after the successful bookmark read. While the shared production writer lock is held,
  // no admitted writer can move D1 between the bookmark and this timestamp. A later operator can
  // resolve the nearest bookmark at/before this timestamp and require its digest to match.
  const recoveryCheckpointAt=nowIso();
  const preBookmarkDigest=sha256(preBookmark);

  let mutationIssued=false,mutationDefinite=false,mutationError=null;
  try{
    mutationIssued=true;
    await client.mutate(statements);
    mutationDefinite=true;
  }catch(error){mutationError=error;}

  let after=null,postError=null;
  try{
    after=await client.reconcile({post:true,nowIso:nowIso()});
    if(after.state===MIGRATION_0004_STATE_EXACT_POST){
      validateMigration0004Post({
        state:after.state,preCounts:before.counts,postCounts:after.counts,foreignKeys:after.foreignKeys,
        providerRows:after.providerRows,fixtureRows:after.fixtureRows,participationRows:after.participationRows
      });
      assertSameOfficialFplAuthority(before.authority,after.authority);
      const postBookmark=await client.bookmark();
      return reportBase({classification:MIGRATION_0004_APPLIED,ok:true,mutationIssued,recoveryIssued:false,
        before,after,recoveryCheckpointAt,preBookmarkDigest,postBookmarkDigest:sha256(postBookmark),
        note:mutationDefinite?null:'reconciled_after_unknown_mutation_transport',accounting:client.accounting});
    }
    if(after.state===MIGRATION_0004_STATE_EXACT_PRE&&!mutationDefinite){
      validateMigration0004Pre({state:after.state,counts:after.counts,foreignKeys:after.foreignKeys,providerRows:after.providerRows});
      assertSameOfficialFplAuthority(before.authority,after.authority);
      return reportBase({classification:MIGRATION_0004_NOT_APPLIED,ok:false,mutationIssued,recoveryIssued:false,
        before,after,recoveryCheckpointAt,preBookmarkDigest,note:'reconciled_exact_prestate',accounting:client.accounting});
    }
    postError=new Error('migration_0004_post_state_not_accepted');
  }catch(error){postError=error;}

  // A mutation was issued but exact acceptance was not proved. While the production writer lock is
  // still held, make one restore attempt to the exact pre-mutation bookmark and then independently
  // prove the original pre-state and Official FPL authority. No second migration mutation is issued.
  let restored=null,recoveryError=null;
  try{
    await client.restore(preBookmark);
    restored=await client.reconcile({post:false,nowIso:nowIso()});
    validateMigration0004Pre({state:restored.state,counts:restored.counts,foreignKeys:restored.foreignKeys,providerRows:restored.providerRows});
    assertSameOfficialFplAuthority(before.authority,restored.authority);
  }catch(error){recoveryError=error;}

  if(restored){
    return reportBase({classification:MIGRATION_0004_RECOVERED,ok:false,mutationIssued:true,recoveryIssued:true,
      before,after:restored,recoveryCheckpointAt,preBookmarkDigest,
      note:'postwrite_acceptance_failed_and_time_travel_recovered',accounting:client.accounting});
  }

  return reportBase({classification:MIGRATION_0004_AMBIGUOUS,ok:false,mutationIssued:true,recoveryIssued:true,
    before,after,recoveryCheckpointAt,preBookmarkDigest,
    note:`owner_attention_required:${String(recoveryError?.message??postError?.message??mutationError?.message??'unknown').slice(0,96)}`,
    accounting:client.accounting});
}
