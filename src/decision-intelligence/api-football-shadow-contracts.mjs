import {canonicalise,deepFreeze,sha256Hex,stableStringify} from './canonical.mjs';
import {canonicalFplIdentity} from './observation.mjs';
import {
  DATA_S2_SCHEMA_VERSION,DATA_S2_SOURCE_REVISION_ID,DATA_S2_TRANSFORM_VERSION,DATA_S2_VALIDATION_VERSION,
  OFFICIAL_FPL_SOURCE_KEY,OFFICIAL_FPL_SOURCE_KIND,normaliseOfficialFplHistory
} from './official-fpl-history-canonical.mjs';

export {OFFICIAL_FPL_SOURCE_KEY,OFFICIAL_FPL_SOURCE_KIND};
export const API_FOOTBALL_PROVIDER='api-football';
export const OFFICIAL_FPL_SOURCE_REVISION_ID=DATA_S2_SOURCE_REVISION_ID;
export const OFFICIAL_FPL_SCHEMA_VERSION=DATA_S2_SCHEMA_VERSION;
export const OFFICIAL_FPL_VALIDATION_VERSION=DATA_S2_VALIDATION_VERSION;
export const OFFICIAL_FPL_TRANSFORM_VERSION=DATA_S2_TRANSFORM_VERSION;
export const OFFICIAL_FPL_TEAM_UNIVERSE_KIND='official-fpl-team-universe-authority';
export const TEAM_MAPPING_STATES=Object.freeze(['UNMAPPED','CANDIDATE','VERIFIED','AMBIGUOUS','CONFLICTED']);
export const FIXTURE_QUALIFICATION_STATES=Object.freeze(['DISCOVERED','PROVIDER_QUALIFIED','CROSS_SOURCE_VERIFIED','AMBIGUOUS','CONFLICTED','REJECTED']);
export const LINEUP_ROLES=Object.freeze(['STARTER','BENCH','NO_LINEUP_EVIDENCE','UNKNOWN']);
export const APPEARANCE_STATES=Object.freeze(['STARTED','SUBBED_ON','NOT_USED','UNKNOWN']);
export const SUBSTITUTION_EVIDENCE_STATES=Object.freeze(['COMPLETE','MISSING','INVALID','UNKNOWN']);
export const MAPPING_METHODS=Object.freeze(['provider_id_crosswalk','manually_verified']);
export const INDEPENDENT_RESOLUTION_METHODS=Object.freeze(['verified_identity_crosswalk','provider_id_crosswalk']);
export const API_FOOTBALL_COMPETITIONS=deepFreeze([
  {canonicalCompetitionId:'uefa_champions_league',name:'UEFA Champions League',providerLeagueId:'2'},
  {canonicalCompetitionId:'uefa_europa_league',name:'UEFA Europa League',providerLeagueId:'3'},
  {canonicalCompetitionId:'uefa_conference_league',name:'UEFA Conference League',providerLeagueId:'848'},
  {canonicalCompetitionId:'fa_cup',name:'FA Cup',providerLeagueId:'45'},
  {canonicalCompetitionId:'league_cup',name:'League Cup',providerLeagueId:'48'}
].map(row=>({...row,provider:API_FOOTBALL_PROVIDER,liveCollectionEnabled:false,registryVersion:1})));

const SEASON=/^\d{4}-\d{2}$/;
const ID=/^[1-9]\d*$/;
const fail=reason=>deepFreeze({ok:false,reason});
const providerId=value=>ID.test(String(value??''))?String(value):null;
function teamIdentityRow(row){return {id:Number(row.id),name:String(row.name),short_name:String(row.short_name)};}
function teamIdentityKey(row){return `${Number(row.id)}\0${row.name}\0${row.short_name}`;}
function sameTeamUniverse(left,right){
  if(!Array.isArray(left)||!Array.isArray(right)||left.length!==right.length)return false;
  const a=[...left].map(teamIdentityKey).sort();
  const b=[...right].map(teamIdentityKey).sort();
  return a.every((key,index)=>key===b[index]);
}
function officialFplInputFingerprint(bootstrap,fixtures){
  return {
    events:bootstrap.events.map(row=>Number(row.id)).sort((a,b)=>a-b),
    teams:bootstrap.teams.map(teamIdentityRow).sort((a,b)=>a.id-b.id),
    players:bootstrap.elements.map(row=>({id:Number(row.id),team:Number(row.team)})).sort((a,b)=>a.id-b.id),
    fixtures:fixtures.map(row=>({id:Number(row.id),team_h:Number(row.team_h),team_a:Number(row.team_a)})).sort((a,b)=>a.id-b.id)
  };
}
function mapCanonicalFailure(error){
  const reason=String(error?.message||'official_fpl_canonical_validation_failed');
  if(reason==='season_invalid')return 'season_invalid';
  if(reason==='season_mismatch'||reason==='season_evidence_unavailable'||reason==='season_evidence_invalid')return 'official_fpl_season_mismatch';
  if(reason==='timestamp_invalid')return 'official_fpl_provenance_invalid';
  if(reason==='team_population_implausible'||reason==='team_duplicate_id'||reason==='team_id_invalid'||reason==='team_row_invalid'||reason==='team_name_invalid'||reason==='team_short_name_invalid'||reason.startsWith('team_'))return 'authoritative_pl_team_set_invalid';
  return 'official_fpl_canonical_validation_failed';
}

export function apiFootballCompetitionRegistry(season){
  if(!SEASON.test(season||''))throw new Error('competition_season_invalid');
  return deepFreeze(API_FOOTBALL_COMPETITIONS.map(row=>({...row,season})));
}
export function apiFootballFixtureIdentity({season,providerFixtureId}={}){
  const id=providerId(providerFixtureId);if(!SEASON.test(season||'')||!id)throw new Error('provider_fixture_identity_invalid');
  return `${season}:${API_FOOTBALL_PROVIDER}:fixture:${id}`;
}
export function apiFootballPlayerIdentity(providerPlayerId){
  const id=providerId(providerPlayerId);if(!id)throw new Error('provider_player_identity_invalid');return `${API_FOOTBALL_PROVIDER}:player:${id}`;
}
export function apiFootballTeamIdentity({season,providerTeamId}={}){
  const id=providerId(providerTeamId);if(!SEASON.test(season||'')||!id)throw new Error('provider_team_identity_invalid');
  return `${season}:${API_FOOTBALL_PROVIDER}:team:${id}`;
}
export function officialFplTeamIdentity({season,teamId}={}){
  const id=providerId(teamId);
  if(!SEASON.test(season||'')||!id)return fail('official_fpl_team_identity_invalid');
  try{return deepFreeze({ok:true,canonicalFplId:canonicalFplIdentity(season,'team',id)});}
  catch{return fail('official_fpl_team_identity_invalid');}
}
export function issueOfficialFplTeamUniverseAuthority(input={}){
  if(input==null||typeof input!=='object'||Array.isArray(input))return fail('authoritative_pl_team_set_unavailable');
  const bootstrap=input.bootstrap;
  const fixtures=input.fixtures;
  if(!bootstrap||typeof bootstrap!=='object'||Array.isArray(bootstrap)||!Array.isArray(fixtures))return fail('authoritative_pl_team_set_unavailable');
  if(Array.isArray(input.teams)&&!sameTeamUniverse(input.teams,bootstrap.teams||[]))return fail('official_fpl_team_representation_conflicted');
  if(!SEASON.test(input.season||''))return fail('season_invalid');
  let normalised;
  try{normalised=normaliseOfficialFplHistory({bootstrap,fixtures,season:input.season,fetchedAt:input.fetchedAt});}
  catch(error){return fail(mapCanonicalFailure(error));}
  const teams=bootstrap.teams.map(teamIdentityRow).sort((a,b)=>a.id-b.id);
  const identities=teams.map(row=>canonicalFplIdentity(input.season,'team',String(row.id)));
  const digest=stableStringify({
    kind:OFFICIAL_FPL_TEAM_UNIVERSE_KIND,sourceKey:OFFICIAL_FPL_SOURCE_KEY,sourceKind:OFFICIAL_FPL_SOURCE_KIND,
    sourceRevisionId:OFFICIAL_FPL_SOURCE_REVISION_ID,schemaVersion:OFFICIAL_FPL_SCHEMA_VERSION,
    validationVersion:OFFICIAL_FPL_VALIDATION_VERSION,transformVersion:OFFICIAL_FPL_TRANSFORM_VERSION,
    season:normalised.season,fetchedAt:normalised.fetchedAt,teams,identities,counts:normalised.counts,
    inputFingerprint:officialFplInputFingerprint(bootstrap,fixtures)
  });
  return deepFreeze({
    ok:true,kind:OFFICIAL_FPL_TEAM_UNIVERSE_KIND,sourceKey:OFFICIAL_FPL_SOURCE_KEY,sourceKind:OFFICIAL_FPL_SOURCE_KIND,
    sourceRevisionId:OFFICIAL_FPL_SOURCE_REVISION_ID,schemaVersion:OFFICIAL_FPL_SCHEMA_VERSION,
    validationVersion:OFFICIAL_FPL_VALIDATION_VERSION,transformVersion:OFFICIAL_FPL_TRANSFORM_VERSION,
    season:normalised.season,fetchedAt:normalised.fetchedAt,identities,teams,counts:normalised.counts,digest,bootstrap,fixtures
  });
}
export function verifyOfficialFplTeamUniverseAuthority(season,authority){
  if(authority==null||typeof authority!=='object'||Array.isArray(authority)||authority.kind!==OFFICIAL_FPL_TEAM_UNIVERSE_KIND)return fail('authoritative_pl_team_set_unavailable');
  if(typeof authority.digest!=='string'||!authority.digest)return fail('official_fpl_provenance_invalid');
  if(authority.season!==season)return fail('official_fpl_season_mismatch');
  const issued=issueOfficialFplTeamUniverseAuthority({
    bootstrap:authority.bootstrap,fixtures:authority.fixtures,season,fetchedAt:authority.fetchedAt,teams:authority.teams
  });
  if(!issued.ok)return issued;
  if(issued.digest!==authority.digest)return fail('official_fpl_authority_tampered');
  if(!Array.isArray(authority.identities)||issued.identities.length!==authority.identities.length||issued.identities.some((id,index)=>id!==authority.identities[index]))return fail('official_fpl_authority_tampered');
  return issued;
}
export function currentSeasonOfficialFplTeamIdentities(season,evidence){
  if(!SEASON.test(season||''))return fail('season_invalid');
  if(evidence==null||typeof evidence!=='object'||Array.isArray(evidence))return fail('authoritative_pl_team_set_unavailable');
  if(evidence.season!=null&&evidence.season!==season)return fail('official_fpl_season_mismatch');
  const authority=evidence.kind===OFFICIAL_FPL_TEAM_UNIVERSE_KIND
    ?verifyOfficialFplTeamUniverseAuthority(season,evidence)
    :issueOfficialFplTeamUniverseAuthority({bootstrap:evidence.bootstrap,fixtures:evidence.fixtures,season,fetchedAt:evidence.fetchedAt,teams:evidence.teams});
  if(!authority.ok)return authority;
  return deepFreeze({
    ok:true,identities:authority.identities,sourceKey:authority.sourceKey,sourceKind:authority.sourceKind,
    sourceRevisionId:authority.sourceRevisionId,season:authority.season,fetchedAt:authority.fetchedAt,digest:authority.digest
  });
}
export function validateProviderMapping(mapping,{entityType,season}={}){
  if(!mapping||mapping.provider!==API_FOOTBALL_PROVIDER||mapping.entityType!==entityType||!providerId(mapping.providerEntityId)||!SEASON.test(mapping.season||'')||mapping.season!==season||!TEAM_MAPPING_STATES.includes(mapping.status)||!providerId(mapping.revision)||!MAPPING_METHODS.includes(mapping.method)||!String(mapping.provenance||'').trim())return fail('mapping_invalid');
  if(mapping.status!=='VERIFIED')return fail(`mapping_${mapping.status.toLowerCase()}`);
  const pattern=new RegExp(`^${season}:fpl:${entityType}:([1-9]\\d*)$`);
  if(!pattern.test(mapping.canonicalFplId||''))return fail('mapping_target_invalid');
  return deepFreeze({ok:true,canonicalFplId:mapping.canonicalFplId,mappingRevision:String(mapping.revision)});
}
export function candidatePlayerMapping({providerPlayerId,season,normalizedFullName,providerTeamMapping,canonicalTeamId}={}){
  const club=validateProviderMapping(providerTeamMapping,{entityType:'team',season});
  if(!providerId(providerPlayerId)||!String(normalizedFullName||'').trim()||!club.ok||club.canonicalFplId!==canonicalTeamId)return fail('candidate_evidence_insufficient');
  const playerIdentity=apiFootballPlayerIdentity(providerPlayerId);
  return deepFreeze({ok:true,playerIdentity,season,status:'CANDIDATE',method:'exact_normalized_full_name_verified_club'});
}
export async function deterministicRevision(kind,value,cryptoImpl=globalThis.crypto){
  return `${kind}-${await sha256Hex(stableStringify(canonicalise(value)),cryptoImpl)}`;
}
export function qualifyProviderFixture(fixture,{teamMappings=[],registry=apiFootballCompetitionRegistry(fixture?.season)}={}){
  let identity;try{identity=apiFootballFixtureIdentity(fixture);}catch{return fail('fixture_identity_invalid');}
  const competition=registry.filter(row=>row.providerLeagueId===String(fixture.providerLeagueId)&&row.canonicalCompetitionId===fixture.canonicalCompetitionId&&row.season===fixture.season);
  if(competition.length!==1)return deepFreeze({ok:true,identity,state:competition.length?'CONFLICTED':'REJECTED'});
  const home=providerId(fixture.providerHomeTeamId),away=providerId(fixture.providerAwayTeamId);if(!home||!away||home===away)return deepFreeze({ok:true,identity,state:'REJECTED'});
  const resolved=new Map();
  for(const id of [home,away]){
    const rows=teamMappings.filter(row=>String(row?.providerEntityId)===id);
    const valid=rows.filter(row=>validateProviderMapping(row,{entityType:'team',season:fixture.season}).ok);
    const targets=[...new Set(valid.map(row=>row.canonicalFplId))];
    if(targets.length>1)return deepFreeze({ok:true,identity,state:'CONFLICTED'});
    if(targets.length===1)resolved.set(id,targets[0]);
  }
  const collisions=teamMappings.filter(row=>row.provider===API_FOOTBALL_PROVIDER&&row.entityType==='fixture'&&String(row.providerEntityId)===String(fixture.providerFixtureId)&&row.coreIdentity&&row.coreIdentity!==`${fixture.season}|${fixture.canonicalCompetitionId}|${home}|${away}`);
  if(collisions.length)return deepFreeze({ok:true,identity,state:'CONFLICTED'});
  const homeIdentity=resolved.get(home)??apiFootballTeamIdentity({season:fixture.season,providerTeamId:home});
  const awayIdentity=resolved.get(away)??apiFootballTeamIdentity({season:fixture.season,providerTeamId:away});
  return deepFreeze({ok:true,identity,state:resolved.size?'PROVIDER_QUALIFIED':'DISCOVERED',canonicalCompetitionId:fixture.canonicalCompetitionId,homeTeamIdentity:homeIdentity,awayTeamIdentity:awayIdentity,homeIdentityScope:resolved.has(home)?'FPL':'PROVIDER',awayIdentityScope:resolved.has(away)?'FPL':'PROVIDER'});
}
export function crossSourceQualify(providerQualification,candidates=[]){
  if(providerQualification?.state!=='PROVIDER_QUALIFIED')return deepFreeze({...providerQualification,state:providerQualification?.state||'REJECTED'});
  const exact=candidates.filter(row=>row.season===providerQualification.identity.slice(0,7)&&row.canonicalCompetitionId===providerQualification.canonicalCompetitionId&&row.homeTeamIdentity===providerQualification.homeTeamIdentity&&row.awayTeamIdentity===providerQualification.awayTeamIdentity&&row.identitiesResolved===true&&INDEPENDENT_RESOLUTION_METHODS.includes(row.identityResolutionMethod)&&String(row.identityResolutionProvenance||'').trim());
  if(exact.length>1)return deepFreeze({...providerQualification,state:'AMBIGUOUS'});
  if(exact.length===0)return deepFreeze({...providerQualification,state:candidates.length?'CONFLICTED':'PROVIDER_QUALIFIED'});
  return deepFreeze({...providerQualification,state:'CROSS_SOURCE_VERIFIED',independentFixtureId:exact[0].fixtureId});
}
export function resolveFieldObservations(fieldName,observations=[]){
  const usable=observations.filter(row=>row&&row.value!==undefined&&String(row.source||'').trim()&&String(row.sourceRevision||'').trim());
  const values=[...new Set(usable.map(row=>stableStringify(row.value)))];
  if(!usable.length)return deepFreeze({fieldName,state:'MISSING',canonicalValue:null,observations:[]});
  return deepFreeze({fieldName,state:values.length===1?'AGREED':'CONFLICTED',canonicalValue:values.length===1?usable[0].value:null,observations:canonicalise(usable)});
}
export function normalizeParticipation({explicitLineupRole='NO_LINEUP_EVIDENCE',directMinutes=null,substitutionOn=false,substitutionOff=false,substitutionEvidenceState='UNKNOWN'}={}){
  if(!LINEUP_ROLES.includes(explicitLineupRole)||!SUBSTITUTION_EVIDENCE_STATES.includes(substitutionEvidenceState)||directMinutes!==null&&(!Number.isInteger(directMinutes)||directMinutes<0||directMinutes>130))throw new Error('participation_invalid');
  let appearanceState='UNKNOWN';
  if(explicitLineupRole==='STARTER')appearanceState='STARTED';
  else if(substitutionOn)appearanceState='SUBBED_ON';
  else if(explicitLineupRole==='BENCH'&&directMinutes===0&&substitutionEvidenceState==='COMPLETE')appearanceState='NOT_USED';
  const eventMinutes=substitutionOn||substitutionOff;
  const conflictState=directMinutes===0&&substitutionOn?'CONFLICTED':'NONE';
  if(conflictState==='CONFLICTED')appearanceState='UNKNOWN';
  return deepFreeze({lineupRole:explicitLineupRole,appearanceState,directMinutes,substitutionEvidenceState,eventEvidence:{substitutionOn,substitutionOff,present:eventMinutes},conflictState});
}
