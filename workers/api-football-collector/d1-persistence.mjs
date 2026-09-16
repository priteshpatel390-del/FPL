import {stableStringify,sha256Hex} from '../../src/decision-intelligence/canonical.mjs';
import {API_FOOTBALL_ATTEMPT_RETENTION_DAYS,API_FOOTBALL_FPL_SEASON,API_FOOTBALL_MIN_GAP_MS,API_FOOTBALL_PROVIDER,reservationDecision,effectiveRequestGapMs,requestAttemptIdentity} from './runtime-contracts.mjs';

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

export async function reserveAttempt(db,input){
  if(input.attemptId!==requestAttemptIdentity(input.logicalRequestId,input.attemptNumber))return {ok:false,reason:'request_identity_invalid'};
  const now=new Date(input.now).toISOString();
  const state=await db.prepare(stateSql).bind(API_FOOTBALL_PROVIDER).first();
  const decision=reservationDecision(state,{now,requiresAuthority:input.requiresAuthority,authority:input.authority});
  if(!decision.ok)return decision;
  const update=db.prepare(`UPDATE api_football_runtime_state SET quota_utc_day=?,daily_attempt_count=?,quota_state=?,observed_daily_limit=?,observed_daily_remaining=?,observed_minute_limit=?,observed_minute_remaining=?,quota_observed_at=?,in_flight_attempt_id=?,in_flight_lease_expires_at=?,updated_at=? WHERE provider=? AND collection_enabled=1 AND credential_state='AVAILABLE' AND (in_flight_attempt_id IS NULL OR in_flight_lease_expires_at<=?) AND (earliest_next_request_at IS NULL OR earliest_next_request_at<=?)`).bind(decision.utcDay,decision.nextCount,decision.probeRequired?'PROBE_REQUIRED':state.quota_state,decision.probeRequired?null:state.observed_daily_limit,decision.probeRequired?null:state.observed_daily_remaining,decision.probeRequired?null:state.observed_minute_limit,decision.probeRequired?null:state.observed_minute_remaining,decision.probeRequired?null:state.quota_observed_at,input.attemptId,decision.leaseExpiresAt,now,API_FOOTBALL_PROVIDER,now,now);
  const insert=db.prepare("INSERT INTO api_football_request_attempts (attempt_id,logical_request_id,attempt_number,operation_class,endpoint_class,generation_id,ingestion_run_id,source_revision_id,quota_utc_day,reserved_at,lease_expires_at,outcome) SELECT ?,?,?,?,?,?,?,?,?,?,?,'RESERVED' WHERE EXISTS (SELECT 1 FROM api_football_runtime_state WHERE provider=? AND in_flight_attempt_id=? AND daily_attempt_count=?)").bind(input.attemptId,input.logicalRequestId,input.attemptNumber,input.operationClass,input.endpointClass,input.generationId??null,input.ingestionRunId??null,input.sourceRevisionId??null,decision.utcDay,now,decision.leaseExpiresAt,API_FOOTBALL_PROVIDER,input.attemptId,decision.nextCount);
  let results;try{results=await db.batch([update,insert]);}catch{return {ok:false,reason:'attempt_reservation_failed'};}
  if(results?.[0]?.meta?.changes!==1||results?.[1]?.meta?.changes!==1)return {ok:false,reason:'request_lease_lost'};
  return {ok:true,probeRequired:decision.probeRequired,leaseExpiresAt:decision.leaseExpiresAt};
}

export async function completeAttempt(db,{attemptId,completion,now}){
  const at=new Date(now).toISOString(),quota=completion.quota||{};
  const state=await db.prepare(stateSql).bind(API_FOOTBALL_PROVIDER).first();
  const gap=effectiveRequestGapMs(quota.minuteLimit??state?.observed_minute_limit);
  const earliest=new Date(Date.parse(at)+Math.max(API_FOOTBALL_MIN_GAP_MS,gap)).toISOString();
  await db.batch([
    db.prepare('UPDATE api_football_request_attempts SET completed_at=?,outcome=?,http_class=?,timeout=?,quota_state=?,observed_daily_limit=?,observed_daily_remaining=?,observed_minute_limit=?,observed_minute_remaining=? WHERE attempt_id=?').bind(at,completion.outcome,completion.httpClass??null,completion.timeout,completion.quotaState,quota.dailyLimit??null,quota.dailyRemaining??null,quota.minuteLimit??null,quota.minuteRemaining??null,attemptId),
    db.prepare("UPDATE api_football_runtime_state SET collection_enabled=CASE WHEN ?='AUTH_FAILURE' THEN 0 ELSE collection_enabled END,disable_reason=CASE WHEN ?='AUTH_FAILURE' THEN 'PROVIDER_AUTHENTICATION_FAILED' ELSE disable_reason END,credential_state=CASE WHEN ?='AUTH_FAILURE' THEN 'INVALID' ELSE credential_state END,quota_state=?,observed_daily_limit=?,observed_daily_remaining=?,observed_minute_limit=?,observed_minute_remaining=?,quota_observed_at=?,in_flight_attempt_id=NULL,in_flight_lease_expires_at=NULL,earliest_next_request_at=?,last_429_at=COALESCE(?,last_429_at),last_successful_request_at=CASE WHEN ?='SUCCEEDED' THEN ? ELSE last_successful_request_at END,updated_at=? WHERE provider=? AND in_flight_attempt_id=?").bind(completion.outcome,completion.outcome,completion.outcome,completion.quotaState,quota.dailyLimit??null,quota.dailyRemaining??null,quota.minuteLimit??null,quota.minuteRemaining??null,completion.quotaState==='KNOWN'?at:null,earliest,completion.last429At??null,completion.outcome,at,at,API_FOOTBALL_PROVIDER,attemptId)
  ]);
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
