import {deepFreeze} from './canonical.mjs';
import {eia1SecretFinding} from './eia1-safety.mjs';
import {
  API_FOOTBALL_COLLECTION_MODE,API_FOOTBALL_ENDPOINTS,API_FOOTBALL_ORIGIN,API_FOOTBALL_SOURCE_KEY,
  apiFootballRequestInit,buildPinnedApiFootballUrl,decodeApiFootballResponse,normalizeApiFootballQuotaHeaders
} from './api-football-foundation.mjs';
import {
  apiFootballCompetitionRegistry,apiFootballFixtureIdentity,apiFootballTeamIdentity,crossSourceQualify,
  currentSeasonOfficialFplTeamIdentities,qualifyProviderFixture,resolveFieldObservations,validateProviderMapping
} from './api-football-shadow-contracts.mjs';
import {classifyRights,OWNER_RISK_PRIVATE_USE,OWNER_RISK_PROVIDER} from './rights.mjs';

export const API_FOOTBALL_FPL_SEASON='2026-27';
export const API_FOOTBALL_PROVIDER_SEASON=2026;
export const API_FOOTBALL_DISCOVERY_ENDPOINT='fixtures';
export const API_FOOTBALL_DISCOVERY_ATTEMPT_GAP_MS=1000;
export const API_FOOTBALL_DISCOVERY_MAX_SCAN_ATTEMPTS=10;
export const API_FOOTBALL_DISCOVERY_MAX_ATTEMPTS_PER_QUERY=2;
export const API_FOOTBALL_DISCOVERY_MODE='disabled_fixture_discovery_only';
const SOURCE_REVISION=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ISO_INSTANT=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const STATUS=new Set(['NS','TBD','1H','HT','2H','ET','BT','P','SUSP','INT','FT','AET','PEN','PST','CANC','ABD','AWD','WO','LIVE']);
const RETRYABLE=new Set(['transport_failure','temporary_server_failure']);
const STOP_SCAN=new Set(['quota_exhausted']);
const DISCOVERY_QUERY_KEYS=Object.freeze(['league','season']);

function safeFailure(reason){return deepFreeze({ok:false,reason:String(reason)});}
function positiveId(value){const text=String(value??'');return /^\d+$/.test(text)&&Number(text)>0?text:null;}
function strictIsoInstant(value){
  if(typeof value!=='string'||!ISO_INSTANT.test(value))return null;
  const parsed=Date.parse(value);if(!Number.isFinite(parsed))return null;
  const canonical=new Date(parsed).toISOString(),expected=value.includes('.')?`${value.slice(0,value.indexOf('.')+1)}${value.slice(value.indexOf('.')+1,-1).padEnd(3,'0')}Z`:value.replace(/Z$/,'.000Z');
  return canonical===expected?canonical:null;
}
function httpClass(status){
  if(!Number.isInteger(status))return 'transport';
  if(status>=300&&status<400)return '3xx';
  if(status>=400&&status<500)return '4xx';
  if(status>=500&&status<600)return '5xx';
  if(status>=200&&status<300)return '2xx';
  return 'unknown';
}
function classifyAttemptFailure(status){
  if(status==null)return 'transport_failure';
  if(status>=300&&status<400)return 'redirect_rejected';
  if(status===401||status===403)return 'authentication_failure';
  if(status===429)return 'quota_exhausted';
  if(status>=500&&status<600)return 'temporary_server_failure';
  if(status>=200&&status<300)return null;
  return 'provider_unavailable';
}
function providerKickoff(value){
  if(typeof value!=='string'||!value)return null;
  const parsed=Date.parse(value);
  return Number.isFinite(parsed)?new Date(parsed).toISOString():null;
}
function exactKeys(value,keys){
  return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.prototype.hasOwnProperty.call(value,key));
}
function fixtureCoreKey(row){
  return `${row.fplSeason}|${row.canonicalCompetitionId}|${row.providerLeagueId}|${row.providerHomeTeamId}|${row.providerAwayTeamId}`;
}
function scopedToProviderFixture(rows,fixture){
  const wanted=new Set([String(fixture.providerFixtureId),String(fixture.identity)]);
  return (rows||[]).filter(row=>{
    const scope=row?.providerFixtureId??row?.providerFixtureIdentity;
    return scope!=null&&scope!==''&&wanted.has(String(scope));
  });
}
function collapseFixtureRows(rows){
  const cores=[...new Set(rows.map(fixtureCoreKey))];
  const kickoffs=rows.map(row=>row.kickoffObservation).filter(Boolean);
  return {
    ...rows[0],
    identityCollision:cores.length>1,
    collidingCoreIdentities:cores.length>1?cores:null,
    extraKickoffObservations:kickoffs.slice(1)
  };
}
function rejectSecret(value){return eia1SecretFinding(value)?safeFailure('secret_material'):null;}
function emptyScan(reason,overrides={}){
  return deepFreeze({ok:false,reason,scanState:overrides.scanState||reason,mode:API_FOOTBALL_DISCOVERY_MODE,attempts:overrides.attempts||0,fixtures:[],audit:overrides.audit||[],mappingCoverage:overrides.mappingCoverage||null,limitations:overrides.limitations||[reason]});
}

export function apiFootballDiscoveryPlan(fplSeason=API_FOOTBALL_FPL_SEASON){
  if(fplSeason!==API_FOOTBALL_FPL_SEASON)return safeFailure('season_not_allowed');
  const items=apiFootballCompetitionRegistry(fplSeason).map(row=>({
    logicalCompetitionKey:row.canonicalCompetitionId,
    canonicalCompetitionId:row.canonicalCompetitionId,
    providerLeagueId:row.providerLeagueId,
    providerSeason:API_FOOTBALL_PROVIDER_SEASON,
    fplSeason,
    endpoint:API_FOOTBALL_DISCOVERY_ENDPOINT,
    liveCollectionEnabled:false
  }));
  if(items.length!==5||items.some(row=>row.endpoint!=='fixtures'||row.liveCollectionEnabled!==false))return safeFailure('discovery_plan_invalid');
  return deepFreeze({ok:true,fplSeason,providerSeason:API_FOOTBALL_PROVIDER_SEASON,items});
}

export function buildApiFootballDiscoveryRequest(input={}){
  if(input.url||input.origin||input.headers||input.method&&input.method!=='GET')return safeFailure('endpoint_not_allowed');
  const endpoint=input.endpoint??API_FOOTBALL_DISCOVERY_ENDPOINT;
  if(typeof endpoint!=='string'||endpoint.includes('://')||endpoint.startsWith('//')||endpoint.startsWith('/')||endpoint!==API_FOOTBALL_DISCOVERY_ENDPOINT||!API_FOOTBALL_ENDPOINTS.includes(endpoint))return safeFailure('endpoint_not_allowed');
  const parameters=input.parameters;
  if(parameters!=null){
    if(typeof parameters!=='object'||Array.isArray(parameters)||!exactKeys(parameters,DISCOVERY_QUERY_KEYS))return safeFailure('parameters_invalid');
  }
  const extraKeys=Object.keys(input).filter(key=>!['logicalCompetitionKey','providerLeagueId','providerSeason','endpoint','parameters','fplSeason','url','origin','headers','method'].includes(key));
  if(extraKeys.length)return safeFailure('parameters_invalid');
  const plan=apiFootballDiscoveryPlan(input.fplSeason||API_FOOTBALL_FPL_SEASON);
  if(!plan.ok)return plan;
  const wantedLeague=String(parameters?.league??input.providerLeagueId??'');
  const wantedSeason=parameters?.season??input.providerSeason;
  if(wantedSeason!=null&&Number(wantedSeason)!==API_FOOTBALL_PROVIDER_SEASON)return safeFailure('season_not_allowed');
  const item=plan.items.find(row=>row.providerLeagueId===wantedLeague&&row.providerSeason===API_FOOTBALL_PROVIDER_SEASON&&(!input.logicalCompetitionKey||row.logicalCompetitionKey===input.logicalCompetitionKey));
  if(!item)return safeFailure('league_not_allowed');
  const pinned=buildPinnedApiFootballUrl(item.endpoint,{league:item.providerLeagueId,season:String(item.providerSeason)});
  if(!pinned.ok)return pinned;
  return deepFreeze({ok:true,planItem:item,origin:pinned.url.origin,url:String(pinned.url),search:{league:item.providerLeagueId,season:String(item.providerSeason)}});
}

export function decodeApiFootballDiscoveryResponse(payload,planItem){
  const decoded=decodeApiFootballResponse(payload,{endpoint:API_FOOTBALL_DISCOVERY_ENDPOINT});
  if(!decoded.ok)return decoded;
  if(!exactKeys(payload.parameters,DISCOVERY_QUERY_KEYS)||String(payload.parameters.league)!==planItem.providerLeagueId||String(payload.parameters.season)!==String(planItem.providerSeason))return safeFailure('competition_identity_invalid');
  if(payload.paging.current!==1||payload.paging.total!==1)return safeFailure('pagination_unsupported');
  return decoded;
}

export function normalizeApiFootballDiscoveryFixtures(payload,planItem,{fetchedAt,sourceRevision}={}){
  const decoded=decodeApiFootballDiscoveryResponse(payload,planItem);
  if(!decoded.ok)return decoded;
  const canonicalFetchedAt=strictIsoInstant(fetchedAt);
  if(!canonicalFetchedAt||!SOURCE_REVISION.test(sourceRevision||''))return safeFailure('provenance_invalid');
  const fixtures=[];
  for(const row of decoded.response){
    if(eia1SecretFinding(row))return safeFailure('secret_material');
    const fixtureId=positiveId(row?.fixture?.id),home=positiveId(row?.teams?.home?.id),away=positiveId(row?.teams?.away?.id);
    const leagueId=positiveId(row?.league?.id),season=row?.league?.season,statusShort=row?.fixture?.status?.short;
    if(!fixtureId||!home||!away||home===away)return safeFailure('fixture_identity_invalid');
    if(leagueId!==planItem.providerLeagueId||Number(season)!==planItem.providerSeason)return safeFailure('competition_identity_invalid');
    const kickoff=providerKickoff(row?.fixture?.date);
    if(!kickoff)return safeFailure('kickoff_invalid');
    if(typeof statusShort!=='string'||!STATUS.has(statusShort))return safeFailure('status_invalid');
    let identity;try{identity=apiFootballFixtureIdentity({season:planItem.fplSeason,providerFixtureId:fixtureId});}catch{return safeFailure('fixture_identity_invalid');}
    fixtures.push({
      identity,providerFixtureId:fixtureId,providerLeagueId:leagueId,providerSeason:planItem.providerSeason,
      canonicalCompetitionId:planItem.canonicalCompetitionId,fplSeason:planItem.fplSeason,
      providerHomeTeamId:home,providerAwayTeamId:away,
      kickoffObservation:{value:kickoff,source:API_FOOTBALL_SOURCE_KEY,sourceRevision},
      statusObservation:{value:statusShort,source:API_FOOTBALL_SOURCE_KEY,sourceRevision},
      fetchedAt:canonicalFetchedAt,sourceRevision,provider:API_FOOTBALL_SOURCE_KEY
    });
  }
  const byId=new Map();
  for(const row of fixtures){
    if(!byId.has(row.providerFixtureId))byId.set(row.providerFixtureId,[]);
    byId.get(row.providerFixtureId).push(row);
  }
  return deepFreeze({ok:true,fixtures:[...byId.values()].map(collapseFixtureRows)});
}

export function qualifyDiscoveredFixture(fixture,{teamMappings=[],independentCandidates=[],kickoffObservations=[]}={}){
  const extras=[
    ...(fixture.extraKickoffObservations||[]),
    ...scopedToProviderFixture(kickoffObservations,fixture).map(row=>({value:row.value,source:row.source,sourceRevision:row.sourceRevision}))
  ];
  const kickoff=resolveFieldObservations('kickoff',[fixture.kickoffObservation,...extras]);
  if(fixture.identityCollision){
    return deepFreeze({
      ...fixture,qualification:deepFreeze({ok:true,identity:fixture.identity,state:'CONFLICTED'}),kickoff,canonicalKickoff:kickoff.canonicalValue,
      homeTeamIdentity:null,awayTeamIdentity:null,homeIdentityScope:null,awayIdentityScope:null,
      workloadRelevant:false,unmapped:false,conflicted:true,rejected:false
    });
  }
  const qualification=qualifyProviderFixture({
    season:fixture.fplSeason,providerFixtureId:fixture.providerFixtureId,providerLeagueId:fixture.providerLeagueId,
    canonicalCompetitionId:fixture.canonicalCompetitionId,providerHomeTeamId:fixture.providerHomeTeamId,providerAwayTeamId:fixture.providerAwayTeamId
  },{teamMappings});
  const scopedCandidates=scopedToProviderFixture(independentCandidates,fixture);
  const cross=qualification.state==='PROVIDER_QUALIFIED'?crossSourceQualify(qualification,scopedCandidates):qualification;
  const state=cross.state;
  const unmapped=state==='DISCOVERED';
  const conflicted=state==='CONFLICTED';
  const rejected=state==='REJECTED';
  const workloadRelevant=state==='PROVIDER_QUALIFIED'||state==='CROSS_SOURCE_VERIFIED';
  return deepFreeze({
    ...fixture,qualification:cross,kickoff,canonicalKickoff:kickoff.canonicalValue,
    homeTeamIdentity:cross.homeTeamIdentity||null,awayTeamIdentity:cross.awayTeamIdentity||null,
    homeIdentityScope:cross.homeIdentityScope||null,awayIdentityScope:cross.awayIdentityScope||null,
    workloadRelevant,unmapped,conflicted,rejected
  });
}

export function mappingCoverage(teamMappings,fplSeason=API_FOOTBALL_FPL_SEASON,{officialTeams}={}){
  const clubs=currentSeasonOfficialFplTeamIdentities(fplSeason,officialTeams);
  if(!clubs.ok)return deepFreeze({verifiedPremierLeagueTeamCount:0,completeTwentyClubCoverage:false,limitation:clubs.reason});
  const authoritative=new Set(clubs.identities);
  const providerToClubs=new Map();
  const clubToProviders=new Map();
  for(const row of teamMappings||[]){
    const valid=validateProviderMapping(row,{entityType:'team',season:fplSeason});
    if(!valid.ok)continue;
    const providerEntityId=String(row.providerEntityId);
    if(!providerToClubs.has(providerEntityId))providerToClubs.set(providerEntityId,new Set());
    providerToClubs.get(providerEntityId).add(valid.canonicalFplId);
    if(!clubToProviders.has(valid.canonicalFplId))clubToProviders.set(valid.canonicalFplId,new Set());
    clubToProviders.get(valid.canonicalFplId).add(providerEntityId);
  }
  const verified=new Set();
  for(const club of clubs.identities){
    const providers=clubToProviders.get(club);
    if(!providers||providers.size!==1)continue;
    const mapped=providerToClubs.get([...providers][0]);
    if(!mapped||mapped.size!==1||!mapped.has(club))continue;
    verified.add(club);
  }
  const extraTargets=[...clubToProviders.keys()].some(id=>!authoritative.has(id));
  const complete=!extraTargets&&providerToClubs.size===verified.size&&verified.size===20&&clubs.identities.every(id=>verified.has(id));
  return deepFreeze({
    verifiedPremierLeagueTeamCount:verified.size,completeTwentyClubCoverage:complete,
    limitation:complete?null:'current_season_pl_team_mapping_incomplete'
  });
}

function auditEntry(fields){
  const record={
    ok:true,logicalCompetitionKey:fields.logicalCompetitionKey,providerLeagueId:fields.providerLeagueId,providerSeason:fields.providerSeason,
    attemptNumber:fields.attemptNumber,category:fields.category,httpClass:fields.httpClass||null,quota:fields.quota||null,
    fetchedAt:fields.fetchedAt||null,providerRowsObserved:fields.providerRowsObserved||0,workloadRelevantAdmitted:fields.workloadRelevantAdmitted||0,
    rejected:fields.rejected||0,unmapped:fields.unmapped||0,conflicted:fields.conflicted||0
  };
  const secret=rejectSecret(record);return secret||deepFreeze(record);
}

function quotaSnapshot(quota){
  return quota?.ok?{state:quota.state,requestsLimit:quota.requestsLimit,requestsRemaining:quota.requestsRemaining,rateLimit:quota.rateLimit,remaining:quota.remaining}:null;
}

async function performDiscoveryAttempt({planItem,apiKey,fetchImpl,budget,nowImpl,sourceRevision,teamMappings,independentCandidates,kickoffObservations}){
  const request=buildApiFootballDiscoveryRequest({logicalCompetitionKey:planItem.logicalCompetitionKey,providerLeagueId:planItem.providerLeagueId,providerSeason:planItem.providerSeason});
  if(!request.ok)return {result:request,consumed:false};
  const pinned=buildPinnedApiFootballUrl(planItem.endpoint,request.search);
  const requestInit=apiFootballRequestInit(apiKey);
  if(!pinned.ok)return {result:pinned,consumed:false};
  if(!requestInit.ok)return {result:requestInit,consumed:false};
  if(!budget.consume())return {result:safeFailure('quota_exhausted'),consumed:false};
  const fetchedAt=strictIsoInstant(nowImpl());
  if(!fetchedAt)return {result:safeFailure('provenance_invalid'),consumed:true};
  let response;
  try{response=await fetchImpl(pinned.url,requestInit.init);}
  catch{return {result:safeFailure('transport_failure'),consumed:true,fetchedAt,httpClass:'transport'};}
  const quota=normalizeApiFootballQuotaHeaders(response?.headers);
  const failure=classifyAttemptFailure(response?.status);
  if(failure==='quota_exhausted')return {result:safeFailure('quota_exhausted'),consumed:true,fetchedAt,httpClass:httpClass(response.status),quota:quota.ok?quota:null};
  if(!quota.ok)return {result:quota,consumed:true,fetchedAt,httpClass:httpClass(response?.status)};
  if(failure)return {result:safeFailure(failure),consumed:true,fetchedAt,httpClass:httpClass(response.status),quota};
  let payload;try{payload=await response.json();}catch{return {result:safeFailure('provider_schema_invalid'),consumed:true,fetchedAt,httpClass:httpClass(response.status),quota};}
  const normalized=normalizeApiFootballDiscoveryFixtures(payload,planItem,{fetchedAt,sourceRevision});
  if(!normalized.ok)return {result:normalized,consumed:true,fetchedAt,httpClass:httpClass(response.status),quota};
  const fixtures=normalized.fixtures.map(row=>qualifyDiscoveredFixture(row,{teamMappings,independentCandidates,kickoffObservations}));
  return {result:deepFreeze({ok:true,fixtures}),consumed:true,fetchedAt,httpClass:httpClass(response.status),quota,providerRowsObserved:normalized.fixtures.length};
}

export async function runApiFootballDiscoveryScan({
  apiKey,fetchImpl,sleepImpl,budget,nowImpl,sourceRevision,rights,teamMappings=[],independentCandidates=[],kickoffObservations=[],officialTeams
}={}){
  const classified=classifyRights(rights||{});
  if(!classified.valid||classified.classification!==OWNER_RISK_PRIVATE_USE||classified.provider!==OWNER_RISK_PROVIDER)return emptyScan('rights_invalid');
  if(typeof apiKey!=='string'||!apiKey.length)return emptyScan('provider_disabled_secret_missing');
  if(typeof fetchImpl!=='function'||typeof sleepImpl!=='function'||!budget?.consume||typeof nowImpl!=='function'||!SOURCE_REVISION.test(sourceRevision||''))return emptyScan('provider_disabled_configuration_invalid');
  const plan=apiFootballDiscoveryPlan();
  if(!plan.ok)return emptyScan(plan.reason);
  const coverage=mappingCoverage(teamMappings,plan.fplSeason,{officialTeams});
  const audit=[],fixtures=[];
  let attempts=0,needDelay=false,scanState='completed';
  competitionLoop: for(const planItem of plan.items){
    for(let tryNumber=1;tryNumber<=API_FOOTBALL_DISCOVERY_MAX_ATTEMPTS_PER_QUERY;tryNumber++){
      if(attempts>=API_FOOTBALL_DISCOVERY_MAX_SCAN_ATTEMPTS){scanState='stopped_attempt_limit';break competitionLoop;}
      if(needDelay){
        try{await sleepImpl(API_FOOTBALL_DISCOVERY_ATTEMPT_GAP_MS);}
        catch{return emptyScan('provider_disabled_configuration_invalid',{attempts,audit,mappingCoverage:coverage});}
      }
      const attempt=await performDiscoveryAttempt({planItem,apiKey,fetchImpl,budget,nowImpl,sourceRevision,teamMappings,independentCandidates,kickoffObservations});
      if(attempt.consumed){attempts+=1;needDelay=true;}else needDelay=false;
      if(attempt.result.ok){
        const admitted=attempt.result.fixtures;
        fixtures.push(...admitted);
        const entry=auditEntry({
          logicalCompetitionKey:planItem.logicalCompetitionKey,providerLeagueId:planItem.providerLeagueId,providerSeason:planItem.providerSeason,
          attemptNumber:tryNumber,category:'success',httpClass:attempt.httpClass,quota:quotaSnapshot(attempt.quota),fetchedAt:attempt.fetchedAt,
          providerRowsObserved:attempt.providerRowsObserved||0,workloadRelevantAdmitted:admitted.filter(row=>row.workloadRelevant).length,
          rejected:admitted.filter(row=>row.rejected).length,unmapped:admitted.filter(row=>row.unmapped).length,conflicted:admitted.filter(row=>row.conflicted).length
        });
        if(!entry.ok)return emptyScan(entry.reason,{attempts,audit,mappingCoverage:coverage});
        audit.push(entry);continue competitionLoop;
      }
      const entry=auditEntry({
        logicalCompetitionKey:planItem.logicalCompetitionKey,providerLeagueId:planItem.providerLeagueId,providerSeason:planItem.providerSeason,
        attemptNumber:tryNumber,category:attempt.result.reason,httpClass:attempt.httpClass||null,quota:quotaSnapshot(attempt.quota),fetchedAt:attempt.fetchedAt||null
      });
      if(!entry.ok)return emptyScan(entry.reason,{attempts,audit,mappingCoverage:coverage});
      audit.push(entry);
      if(STOP_SCAN.has(attempt.result.reason)){scanState='stopped_quota_exhausted';break competitionLoop;}
      if(!RETRYABLE.has(attempt.result.reason))break;
    }
  }
  const succeeded=new Set(audit.filter(row=>row.category==='success').map(row=>row.logicalCompetitionKey));
  if(scanState==='completed'&&succeeded.size!==plan.items.length)scanState='completed_with_failures';
  const byIdentity=new Map();
  for(const row of fixtures){
    if(!byIdentity.has(row.identity))byIdentity.set(row.identity,[]);
    byIdentity.get(row.identity).push(row);
  }
  const reconciled=[];
  for(const rows of byIdentity.values()){
    if(rows.length===1){reconciled.push(rows[0]);continue;}
    reconciled.push(qualifyDiscoveredFixture(collapseFixtureRows(rows),{teamMappings,independentCandidates,kickoffObservations}));
  }
  const countsByCompetition=new Map();
  for(const row of reconciled){
    const key=row.canonicalCompetitionId;
    if(!countsByCompetition.has(key))countsByCompetition.set(key,{workloadRelevantAdmitted:0,rejected:0,unmapped:0,conflicted:0});
    const bucket=countsByCompetition.get(key);
    if(row.workloadRelevant)bucket.workloadRelevantAdmitted+=1;
    if(row.rejected)bucket.rejected+=1;
    if(row.unmapped)bucket.unmapped+=1;
    if(row.conflicted)bucket.conflicted+=1;
  }
  const restated=audit.map(entry=>{
    if(entry.category!=='success')return entry;
    const counts=countsByCompetition.get(entry.logicalCompetitionKey)||{workloadRelevantAdmitted:0,rejected:0,unmapped:0,conflicted:0};
    return deepFreeze({...entry,...counts});
  });
  const limitations=[coverage.limitation,scanState==='completed'?null:scanState].filter(Boolean);
  const result={
    ok:scanState==='completed',reason:scanState==='completed'?null:scanState,scanState,mode:API_FOOTBALL_DISCOVERY_MODE,
    attempts,fixtures:reconciled,audit:restated,mappingCoverage:coverage,limitations,origin:API_FOOTBALL_ORIGIN,collectionMode:API_FOOTBALL_COLLECTION_MODE
  };
  const secret=rejectSecret(result);
  if(secret)return emptyScan('secret_material',{attempts,mappingCoverage:coverage});
  return deepFreeze(result);
}

export {apiFootballTeamIdentity,API_FOOTBALL_ORIGIN};
