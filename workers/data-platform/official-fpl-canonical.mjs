import {observationIdentity,validateObservation} from './data-platform-core.mjs';

export const DATA_S2_SOURCE_REVISION_ID='official-fpl-r1';
export const DATA_S2_SCHEMA_VERSION='data-s2a-v1';
export const DATA_S2_TRANSFORM_VERSION='data-s2a-official-fpl-history-v1';
export const DATA_S2_VALIDATION_VERSION='data-s2a-official-fpl-validation-v2';
export const DATA_S2_NULL='__teamsheet_explicit_null__';
export const MAX_CHANGED_OBSERVATIONS_PER_RUN=15000;

const SOURCE_KEY='official-fpl';

const has=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const isObject=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const positiveId=value=>Number.isInteger(Number(value))&&Number(value)>0;
const iso=value=>{const ms=Date.parse(value);if(!Number.isFinite(ms))throw new Error('timestamp_invalid');return new Date(ms).toISOString();};
const canonicalEntityId=(season,type,id)=>`${season}:fpl:${type}:${Number(id)}`;
const logicalKey=(season,type,id,metric)=>`${SOURCE_KEY}|${season}|${type}|${Number(id)}|${metric}`;

function scalar(type,value){
  if(type==='boolean')return {value_type:'boolean',value_boolean:Boolean(value),value_number:null,value_text:null};
  if(type==='number'){
    if(!finite(value))throw new Error('value_invalid');
    return {value_type:'number',value_number:value,value_text:null,value_boolean:null};
  }
  if(type==='text')return {value_type:'text',value_text:String(value),value_number:null,value_boolean:null};
  throw new Error('value_invalid');
}

function candidate({season,type,id,category,metric,typeName,value,unit=null}){
  return {
    logical_key:logicalKey(season,type,id,metric),category,subject_type:type,
    subject_entity_id:canonicalEntityId(season,type,id),fixture_entity_id:null,competition_entity_id:null,
    subject_mapping_id:null,fixture_mapping_id:null,competition_mapping_id:null,
    provenance_kind:'canonical_native_fpl',metric,...scalar(typeName,value),unit,
    provider_record_id:String(Number(id))
  };
}

function required(row,keys,kind){
  if(!isObject(row))throw new Error(`${kind}_row_invalid`);
  for(const key of keys)if(!has(row,key))throw new Error(`${kind}_${key}_missing`);
  if(!positiveId(row.id))throw new Error(`${kind}_id_invalid`);
}

function uniqueRows(rows,kind){
  const seen=new Set();
  for(const row of rows){required(row,['id'],kind);const id=Number(row.id);if(seen.has(id))throw new Error(`${kind}_duplicate_id`);seen.add(id);}
  return seen;
}

function assertString(value,code){if(typeof value!=='string')throw new Error(code);return value;}
function assertNumber(value,code){const n=Number(value);if(!Number.isFinite(n))throw new Error(code);return n;}
function nullableNumber(value,code){if(value===null)return DATA_S2_NULL;return assertNumber(value,code);}
function nullableTimestamp(value,code){if(value===null)return DATA_S2_NULL;try{return iso(assertString(value,code));}catch{throw new Error(code);}}

export function deriveOfficialFplSeason(bootstrap){
  if(!isObject(bootstrap)||!Array.isArray(bootstrap.events))throw new Error('season_evidence_unavailable');
  const firstEvent=bootstrap.events.find(row=>isObject(row)&&Number(row.id)===1);
  if(!firstEvent||typeof firstEvent.deadline_time!=='string')throw new Error('season_evidence_unavailable');
  let deadline;
  try{deadline=iso(firstEvent.deadline_time);}catch{throw new Error('season_evidence_invalid');}
  const startYear=Number(deadline.slice(0,4));
  return `${startYear}-${String((startYear+1)%100).padStart(2,'0')}`;
}

function entity(season,type,id,createdAt){return {canonical_entity_id:canonicalEntityId(season,type,id),entity_type:type,season,canonical_system:'fpl',canonical_external_id:String(Number(id)),created_at:createdAt};}

export function normaliseOfficialFplHistory({bootstrap,fixtures,season,fetchedAt}){
  if(!/^\d{4}-\d{2}$/.test(String(season||'')))throw new Error('season_invalid');
  const fetched=iso(fetchedAt);
  if(!isObject(bootstrap))throw new Error('bootstrap_invalid');
  for(const key of ['events','teams','elements','element_types'])if(!Array.isArray(bootstrap[key]))throw new Error(`bootstrap_${key}_invalid`);
  if(!Array.isArray(fixtures))throw new Error('fixtures_invalid');
  if(bootstrap.events.length<30)throw new Error('event_population_implausible');
  if(bootstrap.teams.length!==20)throw new Error('team_population_implausible');
  if(bootstrap.elements.length<400)throw new Error('player_population_implausible');
  if(fixtures.length<300)throw new Error('fixture_population_implausible');
  if(deriveOfficialFplSeason(bootstrap)!==season)throw new Error('season_mismatch');

  const eventIds=uniqueRows(bootstrap.events,'event');
  const teamIds=uniqueRows(bootstrap.teams,'team');
  const playerIds=uniqueRows(bootstrap.elements,'player');
  const fixtureIds=uniqueRows(fixtures,'fixture');
  const typeIds=uniqueRows(bootstrap.element_types,'element_type');
  const candidates=[];const entities=[];
  const add=(type,row,category,metric,typeName,value,unit=null)=>candidates.push(candidate({season,type,id:row.id,category,metric,typeName,value,unit}));

  for(const row of bootstrap.events){
    required(row,['id','name','deadline_time'],'event');
    assertString(row.name,'event_name_invalid');
    const deadline=iso(assertString(row.deadline_time,'event_deadline_invalid'));
    entities.push(entity(season,'event',row.id,fetched));
    add('event',row,'official_fpl_event','present','boolean',true);
    add('event',row,'official_fpl_event','name','text',row.name);
    add('event',row,'official_fpl_event','deadline_time','text',deadline);
  }

  const teamFields=['strength','strength_overall_home','strength_overall_away','strength_attack_home','strength_attack_away','strength_defence_home','strength_defence_away'];
  for(const row of bootstrap.teams){
    required(row,['id','name','short_name',...teamFields],'team');
    assertString(row.name,'team_name_invalid');assertString(row.short_name,'team_short_name_invalid');
    entities.push(entity(season,'team',row.id,fetched));
    add('team',row,'official_fpl_team','present','boolean',true);
    add('team',row,'official_fpl_team','name','text',row.name);
    add('team',row,'official_fpl_team','short_name','text',row.short_name);
    for(const field of teamFields)add('team',row,'official_fpl_team',field,'number',assertNumber(row[field],`team_${field}_invalid`));
  }

  const playerRequired=['id','team','element_type','web_name','now_cost','status','chance_of_playing_next_round','chance_of_playing_this_round','news','news_added','selected_by_percent'];
  for(const row of bootstrap.elements){
    required(row,playerRequired,'player');
    if(!teamIds.has(Number(row.team)))throw new Error('player_team_invalid');
    if(!typeIds.has(Number(row.element_type)))throw new Error('player_element_type_invalid');
    assertString(row.web_name,'player_web_name_invalid');assertString(row.status,'player_status_invalid');assertString(row.news,'player_news_invalid');
    entities.push(entity(season,'player',row.id,fetched));
    add('player',row,'official_fpl_player','present','boolean',true);
    add('player',row,'official_fpl_player','team','number',assertNumber(row.team,'player_team_invalid'));
    add('player',row,'official_fpl_player','element_type','number',assertNumber(row.element_type,'player_element_type_invalid'));
    add('player',row,'official_fpl_player','web_name','text',row.web_name);
    add('player',row,'official_fpl_player','now_cost','number',assertNumber(row.now_cost,'player_now_cost_invalid'),'tenths_gbp');
    add('player',row,'official_fpl_player','status','text',row.status);
    const next=nullableNumber(row.chance_of_playing_next_round,'player_chance_next_invalid');
    add('player',row,'official_fpl_player','chance_of_playing_next_round',next===DATA_S2_NULL?'text':'number',next,'percent');
    const current=nullableNumber(row.chance_of_playing_this_round,'player_chance_current_invalid');
    add('player',row,'official_fpl_player','chance_of_playing_this_round',current===DATA_S2_NULL?'text':'number',current,'percent');
    add('player',row,'official_fpl_player','news','text',row.news);
    const newsAdded=nullableTimestamp(row.news_added,'player_news_added_invalid');
    add('player',row,'official_fpl_player','news_added','text',newsAdded);
    add('player',row,'official_fpl_player','selected_by_percent','number',assertNumber(row.selected_by_percent,'player_selected_by_percent_invalid'),'percent');
  }

  const fixtureRequired=['id','event','kickoff_time','team_h','team_a','team_h_difficulty','team_a_difficulty'];
  for(const row of fixtures){
    required(row,fixtureRequired,'fixture');
    if(!teamIds.has(Number(row.team_h))||!teamIds.has(Number(row.team_a))||Number(row.team_h)===Number(row.team_a))throw new Error('fixture_team_invalid');
    if(row.event!==null&&!eventIds.has(Number(row.event)))throw new Error('fixture_event_invalid');
    entities.push(entity(season,'fixture',row.id,fetched));
    add('fixture',row,'official_fpl_fixture','present','boolean',true);
    const eventValue=nullableNumber(row.event,'fixture_event_invalid');
    add('fixture',row,'official_fpl_fixture','event',eventValue===DATA_S2_NULL?'text':'number',eventValue);
    const kickoff=nullableTimestamp(row.kickoff_time,'fixture_kickoff_invalid');
    add('fixture',row,'official_fpl_fixture','kickoff_time','text',kickoff);
    add('fixture',row,'official_fpl_fixture','team_h','number',assertNumber(row.team_h,'fixture_team_h_invalid'));
    add('fixture',row,'official_fpl_fixture','team_a','number',assertNumber(row.team_a,'fixture_team_a_invalid'));
    const homeDifficulty=nullableNumber(row.team_h_difficulty,'fixture_team_h_difficulty_invalid');
    add('fixture',row,'official_fpl_fixture','team_h_difficulty',homeDifficulty===DATA_S2_NULL?'text':'number',homeDifficulty);
    const awayDifficulty=nullableNumber(row.team_a_difficulty,'fixture_team_a_difficulty_invalid');
    add('fixture',row,'official_fpl_fixture','team_a_difficulty',awayDifficulty===DATA_S2_NULL?'text':'number',awayDifficulty);
  }

  const keys=new Set();for(const row of candidates){if(keys.has(row.logical_key))throw new Error('logical_key_duplicate');keys.add(row.logical_key);}
  return {season,fetchedAt:fetched,candidates,entities,counts:{events:eventIds.size,teams:teamIds.size,players:playerIds.size,fixtures:fixtureIds.size}};
}

function sameScalar(a,b){
  if(!a||!b||a.value_type!==b.value_type)return false;
  if(a.value_type==='number')return Number(a.value_number)===Number(b.value_number);
  if(a.value_type==='boolean')return Boolean(Number(a.value_boolean))===Boolean(b.value_boolean);
  return String(a.value_text??'')===String(b.value_text??'');
}

export function diffOfficialFplHistory(candidates,previousRows=[]){
  const previous=new Map(previousRows.map(row=>[row.logical_key,row]));
  const currentPresent=new Set(candidates.filter(row=>row.metric==='present').map(row=>row.logical_key));
  const changes=[];
  for(const row of candidates)if(!sameScalar(row,previous.get(row.logical_key)))changes.push(row);
  for(const row of previousRows){
    if(row.metric!=='present'||!Boolean(Number(row.value_boolean))||currentPresent.has(row.logical_key))continue;
    changes.push({...row,value_type:'boolean',value_boolean:false,value_number:null,value_text:null,unit:null,
      fixture_entity_id:null,competition_entity_id:null,subject_mapping_id:null,fixture_mapping_id:null,competition_mapping_id:null,
      provenance_kind:'canonical_native_fpl'});
  }
  changes.sort((a,b)=>a.logical_key.localeCompare(b.logical_key));
  return changes;
}

export async function materialiseOfficialFplChanges(changes,{runId,sourceRevision,fetchedAt,cryptoImpl=globalThis.crypto}={}){
  if(changes.length>MAX_CHANGED_OBSERVATIONS_PER_RUN)throw new Error('write_budget_exceeded');
  const fetched=iso(fetchedAt);
  return Promise.all(changes.map(async change=>{
    const input={...change,ingestion_run_id:runId,source_revision_id:sourceRevision.source_revision_id,
      observed_at:null,effective_at:null,fetched_at:fetched,expires_at:null,source_timestamp:null,
      transform_version:DATA_S2_TRANSFORM_VERSION,validation_version:DATA_S2_VALIDATION_VERSION,input_revision:runId,
      admission_state:'accepted',quality_state:'fresh',conflict_group_id:null,mode:'shadow_only'};
    const verdict=validateObservation(input,sourceRevision);if(!verdict.ok)throw new Error(`observation_${verdict.reason}`);
    const row={...verdict.observation};row.observation_id=await observationIdentity(row,cryptoImpl);row.created_at=fetched;return row;
  }));
}
