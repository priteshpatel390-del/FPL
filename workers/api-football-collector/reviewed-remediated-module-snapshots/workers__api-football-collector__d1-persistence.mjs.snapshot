import {stableStringify,sha256Hex} from '../../src/decision-intelligence/canonical.mjs';
import {API_FOOTBALL_ATTEMPT_RETENTION_DAYS,API_FOOTBALL_FPL_SEASON,API_FOOTBALL_MAX_DISCOVERY_GENERATION_ROWS,API_FOOTBALL_MIN_GAP_MS,API_FOOTBALL_PROVIDER,reservationDecision,effectiveRequestGapMs,requestAttemptIdentity} from './runtime-contracts.mjs';
import {
  DISCOVERY_MAX_CHUNK_JSON_BYTES,DISCOVERY_MAX_D1_ROWS_WRITTEN,DISCOVERY_MAX_D1_STATEMENTS,
  DISCOVERY_MAX_MUTATION_STATEMENTS,DISCOVERY_PERSISTENCE_CHUNK_ROWS
} from './activation-orchestrator.mjs';

const stateSql='SELECT * FROM api_football_runtime_state WHERE provider=?';
export async function readOfficialFplAuthority(db,{now,season=API_FOOTBALL_FPL_SEASON,cryptoImpl=globalThis.crypto}={}){
  const run=await db.prepare("SELECT run_id,completed_at,status FROM ingestion_runs WHERE source_revision_id='official-fpl-r1' AND status='completed' AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1").first();
  if(!run)return {ok:false,reason:'official_fpl_authority_absent'};
  const prefix=`official-fpl|${season}|team|`;
  const rows=(await db.prepare("SELECT o.subject_entity_id,o.observation_id,o.input_revision,o.logical_key FROM observation_heads h JOIN shadow_observations o ON o.observation_id=h.observation_id JOIN ingestion_runs r ON r.run_id=o.ingestion_run_id AND r.source_revision_id=o.source_revision_id WHERE h.logical_key>=? AND h.logical_key<? AND o.source_revision_id='official-fpl-r1' AND o.category='official_fpl_team' AND r.status='completed' ORDER BY o.logical_key").bind(prefix,`${prefix}\uffff`).all()).results||[];
  const teamIds=[...new Set(rows.map(row=>row.subject_entity_id))];
  const digest=await sha256Hex(stableStringify({season,sourceRevisionId:'official-fpl-r1',runId:run.run_id,fetchedAt:run.completed_at,teamIds,content:rows.map(({logical_key,observation_id,input_revision})=>({logical_key,observation_id,input_revision}))}),cryptoImpl);
  return {ok:true,authority:{season,sourceKey:'official-fpl',sourceRevisionId:'official-fpl-r1',runId:run.run_id,runStatus:run.status,fetchedAt:run.completed_at,teamIds,digest}};
}

export async function reserveAttempt(db,input,{runtimeState=null}={}){
  if(input.attemptId!==requestAttemptIdentity(input.logicalRequestId,input.attemptNumber))return {ok:false,reason:'request_identity_invalid'};
  const now=new Date(input.now).toISOString();
  const state=runtimeState??await db.prepare(stateSql).bind(API_FOOTBALL_PROVIDER).first();
  const decision=reservationDecision(state,{now,requiresAuthority:input.requiresAuthority,authority:input.authority});
  if(!decision.ok)return decision;
  const update=db.prepare(`UPDATE api_football_runtime_state SET quota_utc_day=?,daily_attempt_count=?,quota_state=?,observed_daily_limit=?,observed_daily_remaining=?,observed_minute_limit=?,observed_minute_remaining=?,quota_observed_at=?,in_flight_attempt_id=?,in_flight_lease_expires_at=?,updated_at=? WHERE provider=? AND collection_enabled=1 AND credential_state='AVAILABLE' AND (in_flight_attempt_id IS NULL OR in_flight_lease_expires_at<=?) AND (earliest_next_request_at IS NULL OR earliest_next_request_at<=?)`).bind(decision.utcDay,decision.nextCount,decision.probeRequired?'PROBE_REQUIRED':state.quota_state,decision.probeRequired?null:state.observed_daily_limit,decision.probeRequired?null:state.observed_daily_remaining,decision.probeRequired?null:state.observed_minute_limit,decision.probeRequired?null:state.observed_minute_remaining,decision.probeRequired?null:state.quota_observed_at,input.attemptId,decision.leaseExpiresAt,now,API_FOOTBALL_PROVIDER,now,now);
  const insert=db.prepare("INSERT INTO api_football_request_attempts (attempt_id,logical_request_id,attempt_number,operation_class,endpoint_class,generation_id,ingestion_run_id,source_revision_id,quota_utc_day,reserved_at,lease_expires_at,outcome) SELECT ?,?,?,?,?,?,?,?,?,?,?,'RESERVED' WHERE EXISTS (SELECT 1 FROM api_football_runtime_state WHERE provider=? AND in_flight_attempt_id=? AND daily_attempt_count=?)").bind(input.attemptId,input.logicalRequestId,input.attemptNumber,input.operationClass,input.endpointClass,input.generationId??null,input.ingestionRunId??null,input.sourceRevisionId??null,decision.utcDay,now,decision.leaseExpiresAt,API_FOOTBALL_PROVIDER,input.attemptId,decision.nextCount);
  let results;try{results=await db.batch([update,insert]);}catch{return {ok:false,reason:'attempt_reservation_failed'};}
  if(results?.[0]?.meta?.changes!==1||results?.[1]?.meta?.changes!==1)return {ok:false,reason:'request_lease_lost'};
  return {ok:true,probeRequired:decision.probeRequired,leaseExpiresAt:decision.leaseExpiresAt};
}

export async function completeAttempt(db,{attemptId,completion,now,runtimeState=null}){
  const at=new Date(now).toISOString(),quota=completion.quota||{};
  const state=runtimeState??await db.prepare(stateSql).bind(API_FOOTBALL_PROVIDER).first();
  const gap=effectiveRequestGapMs(quota.minuteLimit??state?.observed_minute_limit);
  const earliest=new Date(Date.parse(at)+Math.max(API_FOOTBALL_MIN_GAP_MS,gap)).toISOString();
  let results;try{results=await db.batch([
    db.prepare('UPDATE api_football_request_attempts SET completed_at=?,outcome=?,http_class=?,timeout=?,quota_state=?,observed_daily_limit=?,observed_daily_remaining=?,observed_minute_limit=?,observed_minute_remaining=? WHERE attempt_id=?').bind(at,completion.outcome,completion.httpClass??null,completion.timeout,completion.quotaState,quota.dailyLimit??null,quota.dailyRemaining??null,quota.minuteLimit??null,quota.minuteRemaining??null,attemptId),
    db.prepare("UPDATE api_football_runtime_state SET collection_enabled=CASE WHEN ?='AUTH_FAILURE' THEN 0 ELSE collection_enabled END,disable_reason=CASE WHEN ?='AUTH_FAILURE' THEN 'PROVIDER_AUTHENTICATION_FAILED' ELSE disable_reason END,credential_state=CASE WHEN ?='AUTH_FAILURE' THEN 'INVALID' ELSE credential_state END,quota_state=?,observed_daily_limit=?,observed_daily_remaining=?,observed_minute_limit=?,observed_minute_remaining=?,quota_observed_at=?,in_flight_attempt_id=NULL,in_flight_lease_expires_at=NULL,earliest_next_request_at=?,last_429_at=COALESCE(?,last_429_at),last_successful_request_at=CASE WHEN ?='SUCCEEDED' THEN ? ELSE last_successful_request_at END,updated_at=? WHERE provider=? AND in_flight_attempt_id=?").bind(completion.outcome,completion.outcome,completion.outcome,completion.quotaState,quota.dailyLimit??null,quota.dailyRemaining??null,quota.minuteLimit??null,quota.minuteRemaining??null,completion.quotaState==='KNOWN'?at:null,earliest,completion.last429At??null,completion.outcome,at,at,API_FOOTBALL_PROVIDER,attemptId)
  ]);}catch{return {ok:false,reason:'attempt_completion_failed'};}
  if(results?.[0]?.meta?.changes!==1||results?.[1]?.meta?.changes!==1)return {ok:false,reason:'attempt_completion_uncertain'};
  return {ok:true};
}

export async function commitDiscoveryGeneration(db,{generationId,season=API_FOOTBALL_FPL_SEASON,completedAt,fixtureLinks=[]}){
  const statements=fixtureLinks.map(row=>db.prepare('INSERT INTO api_football_generation_fixtures (generation_id,provider_fixture_identity,fixture_revision_id) VALUES (?,?,?)').bind(generationId,row.providerFixtureIdentity,row.fixtureRevisionId));
  statements.push(db.prepare("UPDATE api_football_discovery_generations SET state='COMMITTED',competition_count=5,completed_at=?,failure_class=NULL WHERE generation_id=? AND state='STAGING'").bind(completedAt,generationId));
  statements.push(db.prepare('INSERT INTO api_football_discovery_heads (fpl_season,generation_id,updated_at) VALUES (?,?,?) ON CONFLICT(fpl_season) DO UPDATE SET generation_id=excluded.generation_id,updated_at=excluded.updated_at').bind(season,generationId,completedAt));
  await db.batch(statements);
}

export async function appendFixtureRevision(db,row){
  const current=await db.prepare('SELECT fixture_revision_id,input_hash FROM api_football_fixture_revisions WHERE provider_fixture_identity=? ORDER BY fetched_at DESC,fixture_revision_id DESC LIMIT 1').bind(row.providerFixtureIdentity).first();
  if(current?.input_hash===row.inputHash)return {ok:true,result:'unchanged',fixtureRevisionId:current.fixture_revision_id};
  await db.prepare('INSERT INTO api_football_fixture_revisions (fixture_revision_id,provider_fixture_identity,generation_id,ingestion_run_id,source_revision_id,provider_kickoff,provider_status,qualification_state,mapping_provenance,authoritative_duration,extra_time_state,extra_time_evidence,input_revision,input_hash,supersedes_revision_id,fetched_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(row.fixtureRevisionId,row.providerFixtureIdentity,row.generationId??null,row.ingestionRunId,row.sourceRevisionId,row.providerKickoff,row.providerStatus,row.qualificationState,row.mappingProvenance,row.authoritativeDuration??null,row.extraTimeState,row.extraTimeEvidence??null,row.inputRevision,row.inputHash,current?.fixture_revision_id??null,row.fetchedAt,row.createdAt).run();
  return {ok:true,result:'inserted',fixtureRevisionId:row.fixtureRevisionId,supersedesRevisionId:current?.fixture_revision_id??null};
}

export async function pruneCompletedAttempts(db,{now,batchSize=500}={}){
  if(!Number.isInteger(batchSize)||batchSize<1||batchSize>500)throw new Error('retention_batch_invalid');
  const cutoff=new Date(Date.parse(now)-API_FOOTBALL_ATTEMPT_RETENTION_DAYS*24*60*60*1000).toISOString();
  return db.prepare("DELETE FROM api_football_request_attempts WHERE attempt_id IN (SELECT attempt_id FROM api_football_request_attempts WHERE completed_at IS NOT NULL AND reserved_at<? ORDER BY reserved_at,attempt_id LIMIT ?)").bind(cutoff,batchSize).run();
}

const API_FOOTBALL_SOURCE_REVISION_ID='api-football:eia-2i5a:1';
const byteLength=value=>new TextEncoder().encode(value).byteLength;
const chunks=(rows,size)=>{const result=[];for(let index=0;index<rows.length;index+=size)result.push(rows.slice(index,index+size));return result;};
const safe=value=>Object.freeze(value);
const failure=reason=>safe({ok:false,reason});

const IDENTITY_BATCH_SQL=`INSERT INTO provider_fixture_identities(provider_fixture_identity,provider,provider_fixture_id,season,canonical_competition_id,provider_league_id,provider_home_team_id,provider_away_team_id,home_mapping_id,away_mapping_id,qualification_state,qualification_provenance,identity_revision,first_seen_at,last_seen_at)
SELECT json_extract(value,'$.providerFixtureIdentity'),'api-football',json_extract(value,'$.providerFixtureId'),json_extract(value,'$.fplSeason'),json_extract(value,'$.canonicalCompetitionId'),json_extract(value,'$.providerLeagueId'),json_extract(value,'$.providerHomeTeamId'),json_extract(value,'$.providerAwayTeamId'),NULL,NULL,json_extract(value,'$.qualificationState'),json_extract(value,'$.mappingProvenance'),json_extract(value,'$.identityRevision'),json_extract(value,'$.fetchedAt'),json_extract(value,'$.fetchedAt') FROM json_each(?) WHERE 1
ON CONFLICT(provider_fixture_identity) DO UPDATE SET qualification_state=excluded.qualification_state,qualification_provenance=excluded.qualification_provenance,identity_revision=excluded.identity_revision,last_seen_at=excluded.last_seen_at WHERE provider_fixture_identities.provider_fixture_id=excluded.provider_fixture_id AND provider_fixture_identities.season=excluded.season AND provider_fixture_identities.canonical_competition_id=excluded.canonical_competition_id AND provider_fixture_identities.provider_league_id=excluded.provider_league_id AND provider_fixture_identities.provider_home_team_id=excluded.provider_home_team_id AND provider_fixture_identities.provider_away_team_id=excluded.provider_away_team_id`;
const REVISION_BATCH_SQL=`INSERT INTO api_football_fixture_revisions(fixture_revision_id,provider_fixture_identity,generation_id,ingestion_run_id,source_revision_id,provider_kickoff,provider_status,qualification_state,mapping_provenance,authoritative_duration,extra_time_state,extra_time_evidence,input_revision,input_hash,supersedes_revision_id,fetched_at,created_at)
SELECT json_extract(j.value,'$.fixtureRevisionId'),json_extract(j.value,'$.providerFixtureIdentity'),?, ?,json_extract(j.value,'$.sourceRevisionId'),json_extract(j.value,'$.providerKickoff'),json_extract(j.value,'$.providerStatus'),json_extract(j.value,'$.qualificationState'),json_extract(j.value,'$.mappingProvenance'),NULL,json_extract(j.value,'$.extraTimeState'),NULL,json_extract(j.value,'$.inputRevision'),json_extract(j.value,'$.inputHash'),(SELECT r.fixture_revision_id FROM api_football_fixture_revisions r WHERE r.provider_fixture_identity=json_extract(j.value,'$.providerFixtureIdentity') ORDER BY r.fetched_at DESC,r.fixture_revision_id DESC LIMIT 1),json_extract(j.value,'$.fetchedAt'),json_extract(j.value,'$.fetchedAt') FROM json_each(?) j
WHERE NOT EXISTS(SELECT 1 FROM api_football_fixture_revisions same WHERE same.provider_fixture_identity=json_extract(j.value,'$.providerFixtureIdentity') AND same.input_hash=json_extract(j.value,'$.inputHash'))`;
const MEMBERSHIP_BATCH_SQL=`INSERT INTO api_football_generation_fixtures(generation_id,provider_fixture_identity,fixture_revision_id)
SELECT ?,json_extract(j.value,'$.providerFixtureIdentity'),(SELECT r.fixture_revision_id FROM api_football_fixture_revisions r WHERE r.provider_fixture_identity=json_extract(j.value,'$.providerFixtureIdentity') AND r.input_hash=json_extract(j.value,'$.inputHash') ORDER BY r.fetched_at DESC,r.fixture_revision_id DESC LIMIT 1) FROM json_each(?) j WHERE 1
ON CONFLICT(generation_id,provider_fixture_identity) DO UPDATE SET fixture_revision_id=excluded.fixture_revision_id`;

async function materializeFixture(row,cryptoImpl){
  const basis={
    providerFixtureIdentity:row.providerFixtureIdentity,providerFixtureId:row.providerFixtureId,fplSeason:row.fplSeason,
    canonicalCompetitionId:row.canonicalCompetitionId,providerLeagueId:row.providerLeagueId,
    providerHomeTeamId:row.providerHomeTeamId,providerAwayTeamId:row.providerAwayTeamId,
    providerKickoff:row.providerKickoff,providerStatus:row.providerStatus,qualificationState:row.qualificationState,
    mappingProvenance:row.mappingProvenance,extraTimeState:row.extraTimeState,sourceRevisionId:row.sourceRevisionId
  };
  const inputHash=await sha256Hex(stableStringify(basis),cryptoImpl);
  const identityRevision=await sha256Hex(stableStringify({providerFixtureIdentity:row.providerFixtureIdentity,canonicalCompetitionId:row.canonicalCompetitionId,providerLeagueId:row.providerLeagueId,providerHomeTeamId:row.providerHomeTeamId,providerAwayTeamId:row.providerAwayTeamId}),cryptoImpl);
  return {...row,inputHash,identityRevision,inputRevision:`api-football:${inputHash}`,fixtureRevisionId:await sha256Hex(`api-football-fixture-revision:${row.providerFixtureIdentity}:${inputHash}`,cryptoImpl)};
}

export function createD1CollectorRepository(db,{authority,cryptoImpl=globalThis.crypto}={}){
  if(!db?.prepare||!db?.batch||!authority?.digest||!authority?.runId)return null;
  const metrics={statements:0,mutationStatements:0,rowsWritten:0,batches:0};
  let generationContext=null;
  function admit({statements=0,mutationStatements=0,rowCeiling=0}={}){
    if(metrics.statements+statements>DISCOVERY_MAX_D1_STATEMENTS||metrics.mutationStatements+mutationStatements>DISCOVERY_MAX_MUTATION_STATEMENTS||metrics.rowsWritten+rowCeiling>DISCOVERY_MAX_D1_ROWS_WRITTEN)return false;
    metrics.statements+=statements;metrics.mutationStatements+=mutationStatements;metrics.rowsWritten+=rowCeiling;return true;
  }
  async function batch(statements,rowCeiling){
    if(!admit({statements:statements.length,mutationStatements:statements.length,rowCeiling}))return failure('d1_exposure_ceiling_exceeded');
    let results;try{results=await db.batch(statements);}catch{return failure('d1_mutation_failed');}metrics.batches+=1;
    if(!Array.isArray(results)||results.length!==statements.length||results.some(result=>result?.success===false))return failure('d1_mutation_uncertain');
    const actual=results.reduce((sum,result)=>sum+Number(result?.meta?.changes||0),0);
    if(actual>rowCeiling)return failure('d1_write_exposure_exceeded');
    metrics.rowsWritten-=rowCeiling-actual;
    return safe({ok:true,results,rowsWritten:actual});
  }
  return Object.freeze({
    async assertExecutionEnabled(now){
      if(!admit({statements:1}))return failure('d1_exposure_ceiling_exceeded');
      let state;try{state=await db.prepare(stateSql).bind(API_FOOTBALL_PROVIDER).first();}catch{return failure('runtime_state_unavailable');}
      const decision=reservationDecision(state,{now,requiresAuthority:true,authority});
      return decision.ok?safe({ok:true}):decision;
    },
    async readAdmission(request,now){
      if(!request?.attemptId)return failure('request_identity_invalid');
      if(!admit({statements:1}))return failure('d1_exposure_ceiling_exceeded');
      let row;try{row=await db.prepare(`SELECT a.attempt_id,a.attempt_number,a.outcome,a.lease_expires_at,a.completed_at,
        s.provider runtime_provider,s.collection_enabled runtime_collection_enabled,s.credential_state runtime_credential_state,
        s.quota_state runtime_quota_state,s.quota_utc_day runtime_quota_utc_day,s.daily_attempt_count runtime_daily_attempt_count,
        s.in_flight_attempt_id runtime_in_flight_attempt_id,s.in_flight_lease_expires_at runtime_in_flight_lease_expires_at,
        s.earliest_next_request_at runtime_earliest_next_request_at,s.observed_daily_limit runtime_observed_daily_limit,
        s.observed_daily_remaining runtime_observed_daily_remaining,s.observed_minute_limit runtime_observed_minute_limit,
        s.observed_minute_remaining runtime_observed_minute_remaining,s.quota_observed_at runtime_quota_observed_at
        FROM api_football_runtime_state s LEFT JOIN api_football_request_attempts a ON a.attempt_id=?
        WHERE s.provider=?`).bind(request.attemptId,API_FOOTBALL_PROVIDER).first();}catch{return failure('runtime_state_unavailable');}
      if(!row)return failure('runtime_state_unavailable');
      const runtimeState={
        provider:row.runtime_provider,collection_enabled:Number(row.runtime_collection_enabled),credential_state:row.runtime_credential_state,
        quota_state:row.runtime_quota_state,quota_utc_day:row.runtime_quota_utc_day,daily_attempt_count:Number(row.runtime_daily_attempt_count||0),
        in_flight_attempt_id:row.runtime_in_flight_attempt_id,in_flight_lease_expires_at:row.runtime_in_flight_lease_expires_at,
        earliest_next_request_at:row.runtime_earliest_next_request_at,observed_daily_limit:row.runtime_observed_daily_limit,
        observed_daily_remaining:row.runtime_observed_daily_remaining,observed_minute_limit:row.runtime_observed_minute_limit,
        observed_minute_remaining:row.runtime_observed_minute_remaining,quota_observed_at:row.runtime_quota_observed_at
      };
      const attempt=row.attempt_id?{attempt_id:row.attempt_id,attempt_number:Number(row.attempt_number),outcome:row.outcome,lease_expires_at:row.lease_expires_at,completed_at:row.completed_at}:null;
      return safe({ok:true,attempt,runtimeState});
    },
    async createStaging({requests,now}){
      const logicalOpportunity=requests?.[0]?.opportunityLogicalId;
      if(!logicalOpportunity||requests.some(request=>request.opportunityLogicalId!==logicalOpportunity))return failure('generation_identity_invalid');
      const generationId=`api-football:generation:${logicalOpportunity}`,ingestionRunId=`api-football:run:${logicalOpportunity}`;
      const created=await batch([
        db.prepare("INSERT INTO ingestion_runs(run_id,source_revision_id,run_type,mode,started_at,completed_at,status,safe_endpoint_class,parser_version,transform_version,schema_version,created_at) VALUES(?,?,'fixture_discovery','shadow_only',?,NULL,'started','fixtures_discovery','api-football-parser-1','api-football-normalizer-1','api-football-v3-foundation-1',?) ON CONFLICT(run_id) DO NOTHING").bind(ingestionRunId,API_FOOTBALL_SOURCE_REVISION_ID,now,now),
        db.prepare("INSERT INTO api_football_discovery_generations(generation_id,logical_opportunity,state,fpl_season,provider_season,ingestion_run_id,source_revision_id,official_fpl_authority_digest,official_fpl_authority_run_id,mapping_coverage_count,started_at,created_at) VALUES(?,?,'STAGING',?,2026,?,?,?, ?,20,?,?) ON CONFLICT(generation_id) DO NOTHING").bind(generationId,logicalOpportunity,API_FOOTBALL_FPL_SEASON,ingestionRunId,API_FOOTBALL_SOURCE_REVISION_ID,authority.digest,authority.runId,now,now)
      ],2);if(!created.ok)return created;
      if(!admit({statements:1}))return failure('d1_exposure_ceiling_exceeded');
      let row;try{row=await db.prepare('SELECT g.generation_id,g.state,g.ingestion_run_id,g.logical_opportunity,g.fpl_season,g.provider_season,g.source_revision_id,g.official_fpl_authority_digest,g.official_fpl_authority_run_id,r.status run_status,r.source_revision_id run_source_revision_id FROM api_football_discovery_generations g JOIN ingestion_runs r ON r.run_id=g.ingestion_run_id WHERE g.generation_id=?').bind(generationId).first();}catch{return failure('generation_state_unavailable');}
      if(!row||row.state!=='STAGING'||row.ingestion_run_id!==ingestionRunId||row.logical_opportunity!==logicalOpportunity||row.fpl_season!==API_FOOTBALL_FPL_SEASON||Number(row.provider_season)!==2026||row.source_revision_id!==API_FOOTBALL_SOURCE_REVISION_ID||row.official_fpl_authority_digest!==authority.digest||row.official_fpl_authority_run_id!==authority.runId||row.run_status!=='started'||row.run_source_revision_id!==API_FOOTBALL_SOURCE_REVISION_ID)return failure('generation_reconciliation_required');
      generationContext={generationId,ingestionRunId,logicalOpportunity};return safe({ok:true,generationId,ingestionRunId});
    },
    async reserve(request,generationId,now,runtimeState){
      if(!admit({statements:2,mutationStatements:2,rowCeiling:2}))return failure('d1_exposure_ceiling_exceeded');
      const result=await reserveAttempt(db,{...request,generationId,ingestionRunId:generationContext?.ingestionRunId,sourceRevisionId:API_FOOTBALL_SOURCE_REVISION_ID,authority,now},{runtimeState});if(result.ok)metrics.batches+=1;return result;
    },
    async completeFailure(request,completion,now,runtimeState){
      if(!completion?.outcome)return failure('completion_contract_invalid');
      if(!admit({statements:2,mutationStatements:2,rowCeiling:2}))return failure('d1_exposure_ceiling_exceeded');
      const result=await completeAttempt(db,{attemptId:request.attemptId,completion,now,runtimeState});if(result.ok)metrics.batches+=1;return result;
    },
    async completeSuccess(request,completion,now,runtimeState){
      if(completion?.outcome!=='SUCCEEDED')return failure('completion_contract_invalid');
      if(!admit({statements:2,mutationStatements:2,rowCeiling:2}))return failure('d1_exposure_ceiling_exceeded');
      const result=await completeAttempt(db,{attemptId:request.attemptId,completion,now,runtimeState});if(result.ok)metrics.batches+=1;return result;
    },
    async persistValidated(request,generationId,fixtures){
      if(generationId!==generationContext?.generationId||!Array.isArray(fixtures)||fixtures.length>API_FOOTBALL_MAX_DISCOVERY_GENERATION_ROWS)return failure('fixture_persistence_contract_invalid');
      const rows=[];for(const fixture of fixtures)rows.push(await materializeFixture(fixture,cryptoImpl));
      for(const group of chunks(rows,DISCOVERY_PERSISTENCE_CHUNK_ROWS)){
        const json=JSON.stringify(group);if(byteLength(json)>DISCOVERY_MAX_CHUNK_JSON_BYTES)return failure('fixture_chunk_too_large');
        const persisted=await batch([
          db.prepare(IDENTITY_BATCH_SQL).bind(json),
          db.prepare(REVISION_BATCH_SQL).bind(generationId,generationContext.ingestionRunId,json),
          db.prepare(MEMBERSHIP_BATCH_SQL).bind(generationId,json)
        ],group.length*3);
        if(!persisted.ok)return persisted;
        const identityChanges=Number(persisted.results[0]?.meta?.changes||0),membershipChanges=Number(persisted.results[2]?.meta?.changes||0);
        if(identityChanges!==group.length||membershipChanges!==group.length)return failure('fixture_persistence_conflict');
      }
      return safe({ok:true,result:'normalized_persisted'});
    },
    async failGeneration(generationId,reason,now){
      if(generationId!==generationContext?.generationId)return failure('generation_identity_invalid');
      return batch([
        db.prepare("UPDATE api_football_discovery_generations SET state='FAILED',failure_class=?,completed_at=? WHERE generation_id=? AND state='STAGING'").bind(String(reason).slice(0,80),now,generationId),
        db.prepare("UPDATE ingestion_runs SET status='failed',completed_at=?,error_class=? WHERE run_id=? AND status='started'").bind(now,String(reason).slice(0,80),generationContext.ingestionRunId)
      ],2);
    },
    async commitGeneration(generationId,{fixtureCount,now}){
      if(generationId!==generationContext?.generationId||!Number.isInteger(fixtureCount)||fixtureCount<0||fixtureCount>API_FOOTBALL_MAX_DISCOVERY_GENERATION_ROWS)return failure('generation_commit_contract_invalid');
      const committed=await batch([
        db.prepare("UPDATE api_football_discovery_generations SET state='COMMITTED',competition_count=5,fixture_count=(SELECT COUNT(*) FROM api_football_generation_fixtures WHERE generation_id=?),admitted_count=(SELECT COUNT(*) FROM api_football_generation_fixtures gf JOIN api_football_fixture_revisions r ON r.fixture_revision_id=gf.fixture_revision_id WHERE gf.generation_id=? AND r.qualification_state IN ('PROVIDER_QUALIFIED','CROSS_SOURCE_VERIFIED')),conflicted_count=(SELECT COUNT(*) FROM api_football_generation_fixtures gf JOIN api_football_fixture_revisions r ON r.fixture_revision_id=gf.fixture_revision_id WHERE gf.generation_id=? AND r.qualification_state IN ('AMBIGUOUS','CONFLICTED')),completed_at=?,failure_class=NULL WHERE generation_id=? AND state='STAGING' AND (SELECT COUNT(DISTINCT logical_request_id) FROM api_football_request_attempts WHERE generation_id=? AND attempt_number=1 AND outcome='SUCCEEDED')=5 AND (SELECT COUNT(*) FROM api_football_generation_fixtures WHERE generation_id=?)=?").bind(generationId,generationId,generationId,now,generationId,generationId,generationId,fixtureCount),
        db.prepare("UPDATE ingestion_runs SET status='completed',completed_at=?,records_seen=?,records_accepted=?,error_class=NULL WHERE run_id=? AND status='started' AND EXISTS(SELECT 1 FROM api_football_discovery_generations WHERE generation_id=? AND state='COMMITTED')").bind(now,fixtureCount,fixtureCount,generationContext.ingestionRunId,generationId),
        db.prepare("INSERT INTO api_football_discovery_heads(fpl_season,generation_id,updated_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM api_football_discovery_generations WHERE generation_id=? AND state='COMMITTED') ON CONFLICT(fpl_season) DO UPDATE SET generation_id=excluded.generation_id,updated_at=excluded.updated_at").bind(API_FOOTBALL_FPL_SEASON,generationId,now,generationId)
      ],3);
      if(!committed.ok)return committed;
      return committed.results.every(result=>result?.meta?.changes===1)?safe({ok:true}):failure('generation_commit_uncertain');
    },
    operationSnapshot(){return safe({...metrics});}
  });
}
