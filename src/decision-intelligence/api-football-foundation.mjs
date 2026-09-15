import {canonicalise,deepFreeze} from './canonical.mjs';
import {eia1SecretFinding} from './eia1-safety.mjs';
import {normaliseWorkloadObservation} from './eia1-workload-contract.mjs';
import {OWNER_RISK_PROVIDER} from './rights.mjs';

export const API_FOOTBALL_SOURCE_KEY=OWNER_RISK_PROVIDER;
export const API_FOOTBALL_ORIGIN='https://v3.football.api-sports.io';
export const API_FOOTBALL_SCHEMA_VERSION='api-football-v3-foundation-1';
export const API_FOOTBALL_DAILY_REQUEST_LIMIT=100;
export const API_FOOTBALL_COLLECTION_MODE='disabled_post_match_only';
export const API_FOOTBALL_ENDPOINTS=Object.freeze(['fixtures','fixtures/lineups','fixtures/players','fixtures/events']);
export const API_FOOTBALL_TARGET_COMPETITIONS=Object.freeze([
  'uefa_champions_league','uefa_europa_league','uefa_conference_league','fa_cup','league_cup'
]);
const FINAL_STATUS=new Set(['FT','AET','PEN']);
const MAX_MATCH_MINUTES=130;
const ISO_INSTANT=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const SOURCE_REVISION=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ENDPOINT_PARAMETER=Object.freeze({fixtures:'id','fixtures/lineups':'fixture','fixtures/players':'fixture','fixtures/events':'fixture'});

function safeFailure(reason){return deepFreeze({ok:false,reason:String(reason)});}
function positiveId(value){const text=String(value??'');return /^\d+$/.test(text)&&Number(text)>0?text:null;}
function minute(value){return Number.isInteger(value)&&value>=0&&value<=MAX_MATCH_MINUTES?value:null;}
function matchDuration(value){return Number.isInteger(value)&&value>0&&value<=MAX_MATCH_MINUTES?value:null;}
function qualifyFixtureDuration({fixtureId,finalStatus,providerElapsed,durationQualifications}={}){
  if(finalStatus==='FT')return providerElapsed!==null&&providerElapsed<=90?deepFreeze({authoritativeDuration:providerElapsed,extraTime:false,provenance:'fixture.status.elapsed_ft'}):deepFreeze({authoritativeDuration:null,extraTime:null,provenance:null});
  if(finalStatus==='AET')return providerElapsed!==null&&providerElapsed>90?deepFreeze({authoritativeDuration:providerElapsed,extraTime:true,provenance:'fixture.status.aet_with_consistent_elapsed'}):deepFreeze({authoritativeDuration:null,extraTime:null,provenance:null});
  if(finalStatus!=='PEN')return deepFreeze({authoritativeDuration:null,extraTime:null,provenance:null});
  const matches=(durationQualifications||[]).filter(row=>row?.provider===API_FOOTBALL_SOURCE_KEY&&String(row.providerFixtureId)===fixtureId&&row.verified===true&&['played','not_played'].includes(row.extraTimeStatus)&&matchDuration(row.authoritativeDurationMinutes)!==null&&typeof row.provenance==='string'&&row.provenance.length>0);
  if(matches.length===0)return deepFreeze({authoritativeDuration:null,extraTime:null,provenance:null});
  if(matches.length!==1)return safeFailure('duration_qualification_ambiguous');
  const match=matches[0],authoritativeDuration=matchDuration(match.authoritativeDurationMinutes),extraTime=match.extraTimeStatus==='played';
  if(extraTime!==authoritativeDuration>90)return safeFailure('duration_qualification_invalid');
  return deepFreeze({authoritativeDuration,extraTime,provenance:match.provenance});
}
function exactObject(value,keys){return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key));}
function strictIsoInstant(value){
  if(typeof value!=='string'||!ISO_INSTANT.test(value))return null;
  const parsed=Date.parse(value);if(!Number.isFinite(parsed))return null;
  const canonical=new Date(parsed).toISOString(),expected=value.includes('.')?`${value.slice(0,value.indexOf('.')+1)}${value.slice(value.indexOf('.')+1,-1).padEnd(3,'0')}Z`:value.replace(/Z$/,'.000Z');
  return canonical===expected?canonical:null;
}

export function createDailyRequestBudget({limit=API_FOOTBALL_DAILY_REQUEST_LIMIT,day,used=0}={}){
  if(!Number.isInteger(limit)||limit<1||limit>API_FOOTBALL_DAILY_REQUEST_LIMIT||!/^\d{4}-\d{2}-\d{2}$/.test(day||'')||!Number.isInteger(used)||used<0||used>limit)throw new Error('api_football_budget_invalid');
  let count=used;
  return Object.freeze({day,limit,get used(){return count;},get remaining(){return limit-count;},consume(){if(count>=limit)return false;count+=1;return true;}});
}

export function resolveApiFootballFplIdentity(mappings,{providerEntityType,providerEntityId}={}){
  if(!['player','team'].includes(providerEntityType))return safeFailure('provider_identity_type_invalid');
  const id=positiveId(providerEntityId);
  if(!id)return safeFailure('provider_identity_invalid');
  const canonicalPattern=new RegExp(`^\\d{4}-\\d{2}:fpl:${providerEntityType}:\\d+$`);
  const matches=(mappings||[]).filter(row=>row?.provider==='api-football'&&row.providerEntityType===providerEntityType&&String(row.providerEntityId)===id&&row.status==='verified'&&canonicalPattern.test(row.canonicalFplId||'')&&String(row.mappingRevision||'').length>0);
  const targets=[...new Set(matches.map(row=>row.canonicalFplId))];
  if(targets.length===0)return safeFailure('identity_missing');
  if(targets.length!==1||matches.length!==1)return safeFailure('identity_ambiguous');
  return deepFreeze({ok:true,canonicalFplId:targets[0],mappingRevision:String(matches[0].mappingRevision||'')});
}

export function resolveApiFootballCompetition(config,providerLeagueId){
  const id=positiveId(providerLeagueId);
  const matches=(config||[]).filter(row=>String(row.providerLeagueId)===id&&row.provider===API_FOOTBALL_SOURCE_KEY&&row.enabled===true&&API_FOOTBALL_TARGET_COMPETITIONS.includes(row.targetCompetition)&&row.competitionName&&row.provenance);
  return matches.length===1?deepFreeze({ok:true,...canonicalise(matches[0])}):safeFailure(matches.length?'competition_ambiguous':'competition_unsupported');
}

export function decodeApiFootballResponse(payload,{endpoint}={}){
  if(eia1SecretFinding(payload))return safeFailure('secret_material');
  const errorsEmpty=Array.isArray(payload?.errors)?payload.errors.length===0:payload?.errors&&typeof payload.errors==='object'&&Object.keys(payload.errors).length===0;
  if(!exactObject(payload,['get','parameters','errors','results','paging','response'])||payload.get!==endpoint||!Array.isArray(payload.response)||!errorsEmpty||!Number.isInteger(payload.results)||payload.results!==payload.response.length||!exactObject(payload.paging,['current','total'])||!Number.isInteger(payload.paging.current)||!Number.isInteger(payload.paging.total))return safeFailure('provider_schema_invalid');
  return deepFreeze({ok:true,response:payload.response});
}

export function createApiFootballClient({apiKey,fetchImpl,budget}={}){
  const enabled=typeof apiKey==='string'&&apiKey.length>0;
  const request=async(endpoint,parameters={})=>{
    if(!enabled)return safeFailure('provider_disabled_secret_missing');
    if(typeof fetchImpl!=='function'||!budget?.consume)return safeFailure('provider_disabled_configuration_invalid');
    if(typeof endpoint!=='string'||!API_FOOTBALL_ENDPOINTS.includes(endpoint))return safeFailure('endpoint_not_allowed');
    const parameterName=ENDPOINT_PARAMETER[endpoint],entries=Object.entries(parameters||{});
    if(entries.length!==1||entries[0][0]!==parameterName||!positiveId(entries[0][1]))return safeFailure('parameters_invalid');
    if(!budget.consume())return safeFailure('quota_exhausted');
    const url=new URL(`/${endpoint}`,API_FOOTBALL_ORIGIN);url.searchParams.set(parameterName,String(entries[0][1]));
    let response;try{response=await fetchImpl(url,{method:'GET',redirect:'error',headers:{'x-apisports-key':apiKey,'accept':'application/json'}});}catch{return safeFailure('provider_unavailable');}
    if(!response?.ok)return safeFailure(response?.status===429?'quota_exhausted':'provider_unavailable');
    let payload;try{payload=await response.json();}catch{return safeFailure('provider_schema_invalid');}
    return decodeApiFootballResponse(payload,{endpoint:endpoint.replace(/^\//,'')});
  };
  return Object.freeze({enabled,mode:API_FOOTBALL_COLLECTION_MODE,request});
}

function eventMinute(event){
  const elapsed=Number(event?.time?.elapsed),extra=Number(event?.time?.extra??0);
  return Number.isInteger(elapsed)&&elapsed>=0&&Number.isInteger(extra)&&extra>=0?minute(elapsed+extra):null;
}

export async function buildApiFootballWorkloadObservation({fixtureResponse,lineupResponse,playersResponse,eventsResponse,providerPlayerId,providerTeamId,identityMappings,competitionConfig,durationQualifications,fetchedAt,sourceRevision,rights,cryptoImpl=globalThis.crypto}={}){
  for(const [endpoint,payload] of Object.entries({fixtures:fixtureResponse,'fixtures/lineups':lineupResponse,'fixtures/players':playersResponse,'fixtures/events':eventsResponse})){
    const decoded=decodeApiFootballResponse(payload,{endpoint});if(!decoded.ok)return decoded;
  }
  const fixtureRows=fixtureResponse.response;
  if(fixtureRows.length!==1)return safeFailure('fixture_incomplete');
  const row=fixtureRows[0],fixtureId=positiveId(row?.fixture?.id),teamId=positiveId(providerTeamId),playerId=positiveId(providerPlayerId);
  if(!fixtureId||!teamId||!playerId||!row?.fixture?.date||!FINAL_STATUS.has(row?.fixture?.status?.short))return safeFailure('fixture_incomplete');
  if(![row?.teams?.home?.id,row?.teams?.away?.id].some(id=>String(id)===teamId))return safeFailure('fixture_incomplete');
  const canonicalFetchedAt=strictIsoInstant(fetchedAt);if(!canonicalFetchedAt||!SOURCE_REVISION.test(sourceRevision||''))return safeFailure('provenance_invalid');
  let kickoff;try{kickoff=new Date(row.fixture.date).toISOString();}catch{return safeFailure('fixture_incomplete');}
  const competition=resolveApiFootballCompetition(competitionConfig,row?.league?.id);if(!competition.ok)return competition;
  const playerIdentity=resolveApiFootballFplIdentity(identityMappings,{providerEntityType:'player',providerEntityId:playerId});if(!playerIdentity.ok)return playerIdentity;
  const teamIdentity=resolveApiFootballFplIdentity(identityMappings,{providerEntityType:'team',providerEntityId:teamId});if(!teamIdentity.ok)return teamIdentity;
  const season=playerIdentity.canonicalFplId.slice(0,7);
  if(!teamIdentity.canonicalFplId.startsWith(`${season}:`))return safeFailure('identity_season_mismatch');
  const externalFixtureId=`${season}:${API_FOOTBALL_SOURCE_KEY}:fixture:${fixtureId}`;
  const externalCompetitionId=`${season}:external:competition:${competition.targetCompetition}`;
  const lineups=lineupResponse.response.filter(team=>String(team?.team?.id)===teamId);
  if(lineups.length>1)return safeFailure('provider_schema_invalid');
  if(lineups.length&&(!Array.isArray(lineups[0].startXI)||!Array.isArray(lineups[0].substitutes)))return safeFailure('provider_schema_invalid');
  const starters=lineups[0]?.startXI||[],substitutes=lineups[0]?.substitutes||[];
  const inStarters=starters.some(entry=>String(entry?.player?.id)===playerId),inBench=substitutes.some(entry=>String(entry?.player?.id)===playerId);
  if(inStarters&&inBench)return safeFailure('provider_schema_invalid');
  const starter=inStarters?true:inBench?false:null,bench=inBench?true:inStarters?false:null;
  const playerRows=playersResponse.response.filter(team=>String(team?.team?.id)===teamId).flatMap(team=>team.players||[]).filter(entry=>String(entry?.player?.id)===playerId);
  if(playerRows.length>1)return safeFailure('provider_schema_invalid');
  const stats=playerRows[0]?.statistics;
  if(stats!==undefined&&(!Array.isArray(stats)||stats.length!==1))return safeFailure('provider_schema_invalid');
  const rawMinutes=stats?.[0]?.games?.minutes;
  const directMinutes=rawMinutes===null||rawMinutes===undefined?null:minute(rawMinutes);
  if(rawMinutes!==null&&rawMinutes!==undefined&&directMinutes===null)return safeFailure('minutes_invalid');
  const rawDuration=row.fixture.status.elapsed;
  const providerElapsed=rawDuration===null||rawDuration===undefined?null:matchDuration(rawDuration);
  if(rawDuration!==null&&rawDuration!==undefined&&providerElapsed===null)return safeFailure('duration_invalid');
  const duration=qualifyFixtureDuration({fixtureId,finalStatus:row.fixture.status.short,providerElapsed,durationQualifications});
  if(!('authoritativeDuration' in duration))return duration;
  const {authoritativeDuration,extraTime}=duration,durationQualificationProvenance=duration.provenance;
  if(directMinutes!==null&&authoritativeDuration!==null&&directMinutes>authoritativeDuration)return safeFailure('minutes_invalid');
  const events=eventsResponse.response;
  const onEvents=events.filter(event=>event?.type==='subst'&&String(event?.assist?.id)===playerId);
  const offEvents=events.filter(event=>event?.type==='subst'&&String(event?.player?.id)===playerId);
  if(onEvents.length>1||offEvents.length>1)return safeFailure('provider_schema_invalid');
  const redEvents=events.filter(event=>String(event?.player?.id)===playerId&&event?.type==='Card'&&/red/i.test(String(event?.detail||'')));
  const substitutionOnMinute=onEvents.length?eventMinute(onEvents[0]):null,substitutionOffMinute=offEvents.length?eventMinute(offEvents[0]):null;
  if(onEvents.length&&substitutionOnMinute===null||offEvents.length&&substitutionOffMinute===null)return safeFailure('provider_schema_invalid');
  const status=inStarters?'starter':inBench?'substitute':'unknown';
  const appeared=inStarters||onEvents.length?true:directMinutes===null?null:directMinutes>0;
  const unusedSubstitute=inBench&&directMinutes===0&&!onEvents.length;
  const participationStatus=unusedSubstitute?'not_used':status;
  const missingFields=[];
  if(directMinutes===null)missingFields.push('minutes');if(status==='unknown')missingFields.push('lineupStatus');
  const workload={schemaVersion:'eia1-workload-observation-v1',source:{sourceKey:API_FOOTBALL_SOURCE_KEY,sourceRevision,providerRecordIds:{fixtureId,leagueId:String(row.league.id),teamId,playerId}},identity:{canonicalPlayerId:playerIdentity.canonicalFplId,canonicalTeamId:teamIdentity.canonicalFplId,externalFixtureId,externalCompetitionId,mappingRevisions:{player:playerIdentity.mappingRevision,team:teamIdentity.mappingRevision}},fixture:{competition:competition.competitionName,targetCompetition:competition.targetCompetition,kickoff,finalStatus:row.fixture.status.short,authoritativeDurationMinutes:authoritativeDuration},participation:{status:participationStatus,starter,bench,appeared,unusedSubstitute,directMinutes:directMinutes!==null,minutes:directMinutes,substitutionOnMinute,substitutionOffMinute,extraTime,dismissal:redEvents.length?{redCard:true,minute:eventMinute(redEvents[0])}:null},timing:{fetchedAt:canonicalFetchedAt},provenance:{providerSchema:API_FOOTBALL_SCHEMA_VERSION,competitionConfigProvenance:competition.provenance,durationFieldContract:'status_qualified_v2',durationQualificationProvenance},quality:{missingFields},rights};
  try{return {ok:true,observation:await normaliseWorkloadObservation(workload,{cryptoImpl})};}catch(error){return safeFailure(error?.message||'workload_invalid');}
}
