import {apiFootballDiscoveryPlan,normalizeApiFootballDiscoveryFixtures,qualifyDiscoveredFixture} from '../../src/decision-intelligence/api-football-discovery.mjs';
import {validateProviderMapping} from '../../src/decision-intelligence/api-football-shadow-contracts.mjs';
import {API_FOOTBALL_FPL_SEASON,API_FOOTBALL_PROVIDER_SEASON,validateCollectorRequest} from './runtime-contracts.mjs';

const safe=value=>Object.freeze(value);
const fail=reason=>safe({ok:false,reason});
const STATUS=new Set(['TBD','NS','1H','HT','2H','ET','BT','P','SUSP','INT','FT','AET','PEN','PST','CANC','ABD','AWD','WO','LIVE']);
const positive=value=>/^\d+$/.test(String(value))&&Number(value)>0?String(value):null;
const plan=apiFootballDiscoveryPlan(API_FOOTBALL_FPL_SEASON);

function envelope(payload,request){
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||payload.get!=='fixtures'||!payload.parameters||typeof payload.parameters!=='object'||Array.isArray(payload.parameters))return fail('provider_schema_invalid');
  if(!Array.isArray(payload.errors)&&(!payload.errors||typeof payload.errors!=='object'||Array.isArray(payload.errors)))return fail('provider_schema_invalid');
  if(payload.paging?.current!==1||payload.paging?.total!==1)return fail('pagination_unsupported');
  if(!Array.isArray(payload.response)||payload.results!==payload.response.length)return fail('provider_schema_invalid');
  const expected=Object.fromEntries(Object.entries(request.search).map(([key,value])=>[key,String(value)]));
  const actual=Object.fromEntries(Object.entries(payload.parameters).map(([key,value])=>[key,String(value)]));
  if(Object.keys(actual).length!==Object.keys(expected).length||Object.keys(expected).some(key=>actual[key]!==expected[key]))return fail('response_parameters_mismatch');
  return safe({ok:true});
}

function validMappings(teamMappings){
  return Array.isArray(teamMappings)&&teamMappings.length===20&&new Set(teamMappings.map(row=>String(row.providerEntityId))).size===20&&
    new Set(teamMappings.map(row=>row.canonicalFplId)).size===20&&!teamMappings.some(row=>!validateProviderMapping(row,{entityType:'team',season:API_FOOTBALL_FPL_SEASON}).ok);
}

function durableFixture(row){
  const state=row?.qualification?.state;
  if(!row?.identity||!positive(row.providerFixtureId)||!positive(row.providerLeagueId)||!positive(row.providerHomeTeamId)||!positive(row.providerAwayTeamId)||
    !row.canonicalCompetitionId||!row.canonicalKickoff||!STATUS.has(row?.statusObservation?.value)||!['DISCOVERED','PROVIDER_QUALIFIED','CROSS_SOURCE_VERIFIED','AMBIGUOUS','CONFLICTED','REJECTED'].includes(state))return null;
  return safe({
    providerFixtureIdentity:row.identity,providerFixtureId:String(row.providerFixtureId),fplSeason:row.fplSeason,
    canonicalCompetitionId:row.canonicalCompetitionId,providerLeagueId:String(row.providerLeagueId),
    providerHomeTeamId:String(row.providerHomeTeamId),providerAwayTeamId:String(row.providerAwayTeamId),
    providerKickoff:row.canonicalKickoff,providerStatus:row.statusObservation.value,qualificationState:state,
    mappingProvenance:`qualified:${state}:${row.homeIdentityScope||'NONE'}:${row.awayIdentityScope||'NONE'}`,
    extraTimeState:'UNKNOWN',fetchedAt:row.fetchedAt,sourceRevisionId:row.sourceRevision
  });
}

function qualifyRows(rows,teamMappings){
  const fixtures=[];
  for(const row of rows){const normalized=durableFixture(qualifyDiscoveredFixture(row,{teamMappings}));if(!normalized)return fail('fixture_schema_invalid');fixtures.push(normalized);}
  return safe({ok:true,fixtures:safe(fixtures)});
}

export function validateKnownFixturePayload(payload,request,{fetchedAt,sourceRevision='api-football:eia-2i5a:1',teamMappings=[]}={}){
  const contract=validateCollectorRequest(request);if(!contract.ok)return contract;
  if(request.endpointClass!=='fixture')return fail('endpoint_class_mismatch');
  const valid=envelope(payload,request);if(!valid.ok)return valid;
  if(!validMappings(teamMappings))return fail('qualified_mapping_unavailable');
  if(payload.response.length!==1)return fail('fixture_identity_invalid');
  const row=payload.response[0],fixtureId=positive(row?.fixture?.id),home=positive(row?.teams?.home?.id),away=positive(row?.teams?.away?.id);
  if(fixtureId!==String(request.search.id)||!home||!away||home===away||Object.keys(row?.teams||{}).sort().join('|')!=='away|home')return fail('fixture_identity_invalid');
  const leagueId=positive(row?.league?.id),planItem=plan.ok?plan.items.find(item=>item.providerLeagueId===leagueId):null;
  if(!planItem||Number(row?.league?.season)!==API_FOOTBALL_PROVIDER_SEASON)return fail('competition_identity_invalid');
  const kickoff=Number.isFinite(Date.parse(row?.fixture?.date))?new Date(row.fixture.date).toISOString():null,status=row?.fixture?.status?.short;
  if(!STATUS.has(status)||!kickoff)return fail('fixture_schema_invalid');
  const normalized={
    identity:`${API_FOOTBALL_FPL_SEASON}:api-football:fixture:${fixtureId}`,providerFixtureId:fixtureId,
    providerLeagueId:leagueId,providerSeason:API_FOOTBALL_PROVIDER_SEASON,canonicalCompetitionId:planItem.canonicalCompetitionId,
    fplSeason:API_FOOTBALL_FPL_SEASON,providerHomeTeamId:home,providerAwayTeamId:away,
    kickoffObservation:{value:kickoff,source:'api-football',sourceRevision},statusObservation:{value:status,source:'api-football',sourceRevision},
    fetchedAt,sourceRevision,provider:'api-football'
  };
  return qualifyRows([normalized],teamMappings);
}

export function validateDiscoveryPayload(payload,request,{fetchedAt,sourceRevision='api-football:eia-2i5a:1',teamMappings=[]}={}){
  const contract=validateCollectorRequest(request);if(!contract.ok)return contract;
  if(request.endpointClass!=='fixtures_discovery')return fail('endpoint_class_mismatch');
  const valid=envelope(payload,request);if(!valid.ok)return valid;
  const planItem=plan.ok?plan.items.find(item=>String(item.providerLeagueId)===String(request.search.league)&&item.providerSeason===Number(request.search.season)):null;
  if(!planItem)return fail('competition_identity_invalid');
  if(!validMappings(teamMappings))return fail('qualified_mapping_unavailable');
  const normalized=normalizeApiFootballDiscoveryFixtures(payload,planItem,{fetchedAt,sourceRevision});
  if(!normalized.ok)return normalized;
  return qualifyRows(normalized.fixtures,teamMappings);
}

export function validateProviderPayload(payload,request,context={}){
  if(request?.endpointClass==='fixtures_discovery')return validateDiscoveryPayload(payload,request,context);
  if(request?.endpointClass==='fixture')return validateKnownFixturePayload(payload,request,context);
  return fail('workload_ingestion_not_approved');
}
