import {canonicalise,deepFreeze,sha256Hex,stableStringify} from './canonical.mjs';
import {canonicalFplIdentity} from './observation.mjs';

export const API_FOOTBALL_PROVIDER='api-football';
export const OFFICIAL_FPL_SOURCE_KEY='official-fpl';
export const OFFICIAL_FPL_SOURCE_KIND='official_fpl';
export const OFFICIAL_FPL_SOURCE_REVISION_ID='official-fpl-r1';
export const OFFICIAL_FPL_SCHEMA_VERSION='data-s2a-v1';
export const OFFICIAL_FPL_VALIDATION_VERSION='data-s2a-official-fpl-validation-v2';
export const OFFICIAL_FPL_TRANSFORM_VERSION='data-s2a-official-fpl-history-v1';
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
const ISO_INSTANT=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const fail=reason=>deepFreeze({ok:false,reason});
const providerId=value=>ID.test(String(value??''))?String(value):null;
function strictIsoInstant(value){
  if(typeof value!=='string'||!ISO_INSTANT.test(value))return null;
  const parsed=Date.parse(value);if(!Number.isFinite(parsed))return null;
  const canonical=new Date(parsed).toISOString(),expected=value.includes('.')?`${value.slice(0,value.indexOf('.')+1)}${value.slice(value.indexOf('.')+1,-1).padEnd(3,'0')}Z`:value.replace(/Z$/,'.000Z');
  return canonical===expected?canonical:null;
}
function snapshotTeams(snapshot){
  if(Array.isArray(snapshot.teams))return snapshot.teams;
  if(snapshot.bootstrap&&typeof snapshot.bootstrap==='object'&&Array.isArray(snapshot.bootstrap.teams))return snapshot.bootstrap.teams;
  return null;
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
export function currentSeasonOfficialFplTeamIdentities(season,snapshot){
  if(!SEASON.test(season||''))return fail('season_invalid');
  if(snapshot==null||typeof snapshot!=='object'||Array.isArray(snapshot))return fail('authoritative_pl_team_set_unavailable');
  if(snapshot.sourceKey!==OFFICIAL_FPL_SOURCE_KEY||snapshot.sourceKind!==OFFICIAL_FPL_SOURCE_KIND)return fail('authoritative_pl_team_set_unavailable');
  if(snapshot.season!==season)return fail('official_fpl_season_mismatch');
  if(snapshot.sourceRevisionId!==OFFICIAL_FPL_SOURCE_REVISION_ID||snapshot.schemaVersion!==OFFICIAL_FPL_SCHEMA_VERSION||snapshot.validationVersion!==OFFICIAL_FPL_VALIDATION_VERSION||snapshot.transformVersion!==OFFICIAL_FPL_TRANSFORM_VERSION||!strictIsoInstant(snapshot.fetchedAt))return fail('official_fpl_provenance_invalid');
  const teams=snapshotTeams(snapshot);
  if(!Array.isArray(teams))return fail('authoritative_pl_team_set_unavailable');
  if(teams.length!==20)return fail('authoritative_pl_team_set_invalid');
  const identities=[];
  const seen=new Set();
  for(const row of teams){
    if(!row||typeof row!=='object'||typeof row.name!=='string'||!row.name.trim()||typeof row.short_name!=='string'||!row.short_name.trim())return fail('authoritative_pl_team_set_invalid');
    const identity=officialFplTeamIdentity({season,teamId:row.id});
    if(!identity.ok||seen.has(identity.canonicalFplId))return fail('authoritative_pl_team_set_invalid');
    seen.add(identity.canonicalFplId);
    identities.push(identity.canonicalFplId);
  }
  return deepFreeze({
    ok:true,identities,sourceKey:OFFICIAL_FPL_SOURCE_KEY,sourceKind:OFFICIAL_FPL_SOURCE_KIND,
    sourceRevisionId:OFFICIAL_FPL_SOURCE_REVISION_ID,season,fetchedAt:strictIsoInstant(snapshot.fetchedAt)
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
