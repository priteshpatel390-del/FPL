const STRUCTURED_PROJECTION_VERSION=1;
const MAX_JSON_CHUNK_BYTES=900_000;
const MAX_JSON_CHUNK_ROWS=100;

function isoOrNull(value){
  const ms=Date.parse(value);
  return Number.isFinite(ms)?new Date(ms).toISOString():null;
}
function numOrNull(value){
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}
function boolInt(value){return value?1:0;}
function json(value){return JSON.stringify(value??null);}
function assertCanonicalSnapshot(record){
  if(!record||record.recordType!=='preDeadlineSnapshot'||!/^[0-9a-f]{64}$/.test(record?.identity?.contentHash||''))
    throw Object.assign(new Error('Structured projection requires validated canonical evidence'),{code:'structured_projection_record'});
}
function selected(source,keys){
  const out={};
  for(const key of keys) if(source?.[key]!==undefined) out[key]=source[key];
  return out;
}
function structuredProjectionRows(record){
  assertCanonicalSnapshot(record);
  const contentHash=record.identity.contentHash;
  const events=(record.modelInputs?.events||[]).map(row=>({
    contentHash,
    eventId:Number(row?.id),
    eventJson:json(selected(row,['id','name','deadline_time','release_time','average_entry_score','finished','data_checked','highest_scoring_entry','deadline_time_epoch','deadline_time_game_offset','highest_score','is_previous','is_current','is_next','cup_leagues_created','h2h_ko_matches_created','ranked_count','chip_plays','most_selected','most_transferred_in','top_element','top_element_info','transfers_made','most_captained','most_vice_captained']))
  })).filter(row=>Number.isInteger(row.eventId));
  const teams=(record.modelInputs?.teams||[]).map(row=>({
    contentHash,
    teamId:Number(row?.id),
    name:String(row?.name||''),
    shortName:String(row?.short_name||''),
    teamJson:json(selected(row,['id','code','name','short_name','strength','strength_overall_home','strength_overall_away','strength_attack_home','strength_attack_away','strength_defence_home','strength_defence_away','pulse_id']))
  })).filter(row=>Number.isInteger(row.teamId));
  const players=(record.modelInputs?.players||[]).map(row=>({
    contentHash,
    playerId:Number(row?.id),
    teamId:numOrNull(row?.team),
    position:numOrNull(row?.element_type),
    webName:String(row?.web_name||''),
    nowCost:numOrNull(row?.now_cost),
    status:String(row?.status||''),
    chanceOfPlaying:row?.chance_of_playing_next_round==null?null:numOrNull(row.chance_of_playing_next_round),
    playerJson:json(row)
  })).filter(row=>Number.isInteger(row.playerId));
  const fixtures=(record.modelInputs?.fixtures||[]).map(row=>({
    contentHash,
    fixtureId:Number(row?.id),
    event:numOrNull(row?.event),
    kickoffTime:isoOrNull(row?.kickoff_time),
    teamH:numOrNull(row?.team_h),
    teamA:numOrNull(row?.team_a),
    finished:boolInt(row?.finished),
    fixtureJson:json(row)
  })).filter(row=>Number.isInteger(row.fixtureId));
  const providers=(record.providers||[]).map(row=>({
    contentHash,
    provider:String(row?.provider||''),
    state:String(row?.state||''),
    included:boolInt(row?.included),
    didAffectModel:boolInt(row?.didAffectModel),
    acceptedRecordCount:Math.max(0,Math.trunc(Number(row?.acceptedRecordCount)||0)),
    rejectedRecordCount:Math.max(0,Math.trunc(Number(row?.rejectedRecordCount)||0)),
    lastSuccessAt:isoOrNull(row?.lastSuccessAt),
    recordedAt:isoOrNull(row?.recordedAt),
    ageMs:numOrNull(row?.ageMs),
    thresholdMs:numOrNull(row?.thresholdMs)
  })).filter(row=>row.provider);
  const predictions=(record.outputs?.players||[]).map(row=>({
    contentHash,
    playerId:Number(row?.playerId),
    clubId:numOrNull(row?.clubId),
    position:numOrNull(row?.position),
    nowCost:numOrNull(row?.nowCost),
    status:String(row?.status||''),
    chanceOfPlaying:row?.chanceOfPlaying==null?null:numOrNull(row.chanceOfPlaying),
    nextGameweek:numOrNull(row?.nextGameweek?.gw),
    nextGameweekTotal:numOrNull(row?.nextGameweek?.total),
    horizonFromGameweek:numOrNull(row?.aggregate?.fromGameweek),
    horizon:Number(row?.aggregate?.horizon)||0,
    horizonTotal:numOrNull(row?.aggregate?.total),
    minutesJson:json(row?.minutes),
    uncertaintyJson:json(row?.uncertainty),
    sourceUsageJson:json(row?.sourceUsage),
    perGameweekJson:json(row?.perGameweek),
    aggregateJson:json(row?.aggregate)
  })).filter(row=>Number.isInteger(row.playerId));
  return Object.freeze({events,teams,players,fixtures,providers,predictions});
}
function projectionMetadata(record){
  assertCanonicalSnapshot(record);
  return Object.freeze({
    contentHash:record.identity.contentHash,
    season:String(record.season),
    gameweek:Number(record.gameweek),
    deadlineTime:String(record.deadlineTime),
    captureCompletedAt:String(record.timing?.captureCompletedAt||record.capture?.projectionCompletedAt||''),
    horizon:Math.max(1,Math.trunc(Number(record.capture?.horizon)||1)),
    timingGrade:String(record.timing?.grade||''),
    officialEligible:boolInt(record.timing?.officialEligible),
    buildCommit:String(record.build?.commit||'unversioned'),
    buildSourceHash:String(record.build?.sourceHash||'unknown'),
    modelVersion:String(record.versions?.model||''),
    rulesVersion:String(record.versions?.rules||''),
    simulationVersion:String(record.versions?.simulation||'')
  });
}
function utf8Bytes(text){return new TextEncoder().encode(text).byteLength;}
function chunkRows(rows,{maxRows=MAX_JSON_CHUNK_ROWS,maxBytes=MAX_JSON_CHUNK_BYTES}={}){
  const chunks=[];let current=[];
  for(const row of rows||[]){
    const candidate=[...current,row],text=JSON.stringify(candidate);
    if(current.length&&(candidate.length>maxRows||utf8Bytes(text)>maxBytes)){
      chunks.push(current);current=[row];
      if(utf8Bytes(JSON.stringify(current))>maxBytes) throw Object.assign(new Error('Structured projection row exceeds D1 chunk budget'),{code:'structured_projection_chunk'});
    }else current=candidate;
  }
  if(current.length)chunks.push(current);
  return chunks;
}
function jsonEachStatements(db,rows,sql){
  return chunkRows(rows).map(chunk=>db.prepare(sql).bind(JSON.stringify(chunk)));
}
function deleteStatement(db,table,hash){return db.prepare(`DELETE FROM ${table} WHERE content_hash=?`).bind(hash);}
async function projectStructuredSnapshot(db,record,{nowFn=Date.now}={}){
  if(!db?.prepare||!db?.batch) throw Object.assign(new Error('Structured projection database is unavailable'),{code:'structured_projection_storage'});
  const meta=projectionMetadata(record),rows=structuredProjectionRows(record),hash=meta.contentHash;
  const statements=[
    deleteStatement(db,'prediction_gameweeks',hash),deleteStatement(db,'prediction_teams',hash),deleteStatement(db,'prediction_players',hash),
    deleteStatement(db,'prediction_fixtures',hash),deleteStatement(db,'provider_observations',hash),deleteStatement(db,'player_predictions',hash),
    db.prepare(`INSERT INTO prediction_snapshots(content_hash,season,gameweek,deadline_time,capture_completed_at,horizon,timing_grade,official_eligible,build_commit,build_source_hash,model_version,rules_version,simulation_version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(content_hash) DO UPDATE SET season=excluded.season,gameweek=excluded.gameweek,deadline_time=excluded.deadline_time,capture_completed_at=excluded.capture_completed_at,horizon=excluded.horizon,timing_grade=excluded.timing_grade,official_eligible=excluded.official_eligible,build_commit=excluded.build_commit,build_source_hash=excluded.build_source_hash,model_version=excluded.model_version,rules_version=excluded.rules_version,simulation_version=excluded.simulation_version`).bind(meta.contentHash,meta.season,meta.gameweek,meta.deadlineTime,meta.captureCompletedAt,meta.horizon,meta.timingGrade,meta.officialEligible,meta.buildCommit,meta.buildSourceHash,meta.modelVersion,meta.rulesVersion,meta.simulationVersion)
  ];
  statements.push(...jsonEachStatements(db,rows.events,`INSERT INTO prediction_gameweeks(content_hash,event_id,event_json) SELECT json_extract(value,'$.contentHash'),json_extract(value,'$.eventId'),json_extract(value,'$.eventJson') FROM json_each(?)`));
  statements.push(...jsonEachStatements(db,rows.teams,`INSERT INTO prediction_teams(content_hash,team_id,name,short_name,team_json) SELECT json_extract(value,'$.contentHash'),json_extract(value,'$.teamId'),json_extract(value,'$.name'),json_extract(value,'$.shortName'),json_extract(value,'$.teamJson') FROM json_each(?)`));
  statements.push(...jsonEachStatements(db,rows.players,`INSERT INTO prediction_players(content_hash,player_id,team_id,position,web_name,now_cost,status,chance_of_playing,player_json) SELECT json_extract(value,'$.contentHash'),json_extract(value,'$.playerId'),json_extract(value,'$.teamId'),json_extract(value,'$.position'),json_extract(value,'$.webName'),json_extract(value,'$.nowCost'),json_extract(value,'$.status'),json_extract(value,'$.chanceOfPlaying'),json_extract(value,'$.playerJson') FROM json_each(?)`));
  statements.push(...jsonEachStatements(db,rows.fixtures,`INSERT INTO prediction_fixtures(content_hash,fixture_id,event,kickoff_time,team_h,team_a,finished,fixture_json) SELECT json_extract(value,'$.contentHash'),json_extract(value,'$.fixtureId'),json_extract(value,'$.event'),json_extract(value,'$.kickoffTime'),json_extract(value,'$.teamH'),json_extract(value,'$.teamA'),json_extract(value,'$.finished'),json_extract(value,'$.fixtureJson') FROM json_each(?)`));
  statements.push(...jsonEachStatements(db,rows.providers,`INSERT INTO provider_observations(content_hash,provider,state,included,did_affect_model,accepted_record_count,rejected_record_count,last_success_at,recorded_at,age_ms,threshold_ms) SELECT json_extract(value,'$.contentHash'),json_extract(value,'$.provider'),json_extract(value,'$.state'),json_extract(value,'$.included'),json_extract(value,'$.didAffectModel'),json_extract(value,'$.acceptedRecordCount'),json_extract(value,'$.rejectedRecordCount'),json_extract(value,'$.lastSuccessAt'),json_extract(value,'$.recordedAt'),json_extract(value,'$.ageMs'),json_extract(value,'$.thresholdMs') FROM json_each(?)`));
  statements.push(...jsonEachStatements(db,rows.predictions,`INSERT INTO player_predictions(content_hash,player_id,club_id,position,now_cost,status,chance_of_playing,next_gameweek,next_gameweek_total,horizon_from_gameweek,horizon,horizon_total,minutes_json,uncertainty_json,source_usage_json,per_gameweek_json,aggregate_json) SELECT json_extract(value,'$.contentHash'),json_extract(value,'$.playerId'),json_extract(value,'$.clubId'),json_extract(value,'$.position'),json_extract(value,'$.nowCost'),json_extract(value,'$.status'),json_extract(value,'$.chanceOfPlaying'),json_extract(value,'$.nextGameweek'),json_extract(value,'$.nextGameweekTotal'),json_extract(value,'$.horizonFromGameweek'),json_extract(value,'$.horizon'),json_extract(value,'$.horizonTotal'),json_extract(value,'$.minutesJson'),json_extract(value,'$.uncertaintyJson'),json_extract(value,'$.sourceUsageJson'),json_extract(value,'$.perGameweekJson'),json_extract(value,'$.aggregateJson') FROM json_each(?)`));
  const sectionCounts={events:rows.events.length,teams:rows.teams.length,players:rows.players.length,fixtures:rows.fixtures.length,providers:rows.providers.length,predictions:rows.predictions.length};
  const rowCount=Object.values(sectionCounts).reduce((sum,value)=>sum+value,1);
  statements.push(db.prepare(`INSERT INTO structured_projection_runs(content_hash,projection_version,status,projected_at,row_count,section_counts_json) VALUES(?,?,?,?,?,?) ON CONFLICT(content_hash) DO UPDATE SET projection_version=excluded.projection_version,status=excluded.status,projected_at=excluded.projected_at,row_count=excluded.row_count,section_counts_json=excluded.section_counts_json`).bind(hash,STRUCTURED_PROJECTION_VERSION,'complete',new Date(nowFn()).toISOString(),rowCount,JSON.stringify(sectionCounts)));
  if(statements.length>45) throw Object.assign(new Error('Structured projection exceeds the bounded D1 statement budget'),{code:'structured_projection_budget'});
  await db.batch(statements);
  return Object.freeze({status:'complete',contentHash:hash,projectionVersion:STRUCTURED_PROJECTION_VERSION,rowCount,sectionCounts,statementCount:statements.length});
}
async function gunzipObject(object){
  const bytes=new Uint8Array(await object.arrayBuffer());
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}
async function projectStoredEvidence(env,contentHash,{validateSnapshotRecord,retentionPolicyError,nowFn=Date.now}={}){
  if(typeof validateSnapshotRecord!=='function'||typeof retentionPolicyError!=='function') throw Object.assign(new Error('Structured projection validator is unavailable'),{code:'structured_projection_validator'});
  if(!/^[0-9a-f]{64}$/.test(contentHash||'')) throw Object.assign(new Error('Structured projection hash is invalid'),{code:'structured_projection_hash'});
  const manifest=await env.EVIDENCE_DB.prepare(`SELECT content_hash,r2_key FROM evidence_records WHERE content_hash=?`).bind(contentHash).first();
  if(!manifest?.r2_key||manifest.content_hash!==contentHash) throw Object.assign(new Error('Canonical evidence manifest is unavailable'),{code:'structured_projection_manifest'});
  const object=await env.EVIDENCE_BUCKET.get(manifest.r2_key);
  if(!object) throw Object.assign(new Error('Canonical evidence object is unavailable'),{code:'structured_projection_object'});
  let record;try{record=JSON.parse(await gunzipObject(object));}catch(error){throw Object.assign(new Error('Canonical evidence object is invalid'),{code:'structured_projection_object'});}
  const checked=await validateSnapshotRecord(record);
  if(!checked?.ok||checked.record?.identity?.contentHash!==contentHash) throw Object.assign(new Error('Canonical evidence validation failed'),{code:'structured_projection_validation'});
  const policyError=retentionPolicyError(checked.record,env);
  if(policyError) throw Object.assign(new Error('Provider retention does not permit structured projection'),{code:policyError});
  return projectStructuredSnapshot(env.EVIDENCE_DB,checked.record,{nowFn});
}

export {
  STRUCTURED_PROJECTION_VERSION,MAX_JSON_CHUNK_BYTES,MAX_JSON_CHUNK_ROWS,
  structuredProjectionRows,projectionMetadata,chunkRows,projectStructuredSnapshot,projectStoredEvidence
};
