import {canonicalise,deepFreeze,sha256Hex,stableStringify} from '../../src/decision-intelligence/canonical.mjs';
import {validateProviderMapping} from '../../src/decision-intelligence/api-football-shadow-contracts.mjs';
import {API_FOOTBALL_FPL_SEASON} from './runtime-contracts.mjs';

export const API_FOOTBALL_MAPPING_SOURCE_REVISION_ID='api-football:eia-2i5a:1';
export const API_FOOTBALL_MAPPING_PERSISTENCE_KIND='api-football-team-mapping-persistence-v1';

// Immutable qualification/provenance hashes are not mapping pairs. They bind the
// already-persisted private mapping without carrying crosswalk issuance code into
// the collector Worker runtime graph.
const APPROVAL_QUALIFICATION_INTEGRITY_HASH='670ccccbf62764bc076293962ae4aa85085e06db48b503f597397d882f771367';
const CROSSWALK_INTEGRITY_HASH='d48c7980d1c39e7d4a6f82cb56d25a750286c925fd4996d0f8c728a4fb45c7f5';
const PROVIDER_UNIVERSE_INTEGRITY_HASH='5b404fb0a736a72973b6a1772d984992acea1dff6e2d2d7336c8253a078ae5f1';
const PROVIDER_UNIVERSE_REVISION='api-football-team-universe:'+PROVIDER_UNIVERSE_INTEGRITY_HASH;
const PROVIDER_UNIVERSE_OBSERVED_AT='2026-09-18T09:14:56.730Z';
const OWNER_REVIEW_REFERENCE='owner-approved-crosswalk-2026-09-18';
const OWNER_REVIEWED_AT='2026-09-18T09:21:00.000Z';

const fail=reason=>deepFreeze({ok:false,reason:String(reason)});
const hex64=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const canonicalTeamId=value=>typeof value==='string'&&new RegExp('^'+API_FOOTBALL_FPL_SEASON+':fpl:team:[1-9]\\d*$').test(value)?value:null;
const authorityTeamIds=authority=>{
  const values=Array.isArray(authority?.identities)?authority.identities:Array.isArray(authority?.teamIds)?authority.teamIds:null;
  if(!values||values.length!==20)return null;
  const ids=values.map(canonicalTeamId);
  return ids.every(Boolean)&&new Set(ids).size===20?ids.slice().sort():null;
};

async function mappingIdFor(row,cryptoImpl){
  const hash=await sha256Hex(stableStringify(canonicalise({
    sourceRevisionId:API_FOOTBALL_MAPPING_SOURCE_REVISION_ID,
    providerEntityType:'team',
    providerEntityId:String(row.providerEntityId),
    canonicalEntityId:row.canonicalFplId,
    mappingVersion:Number(row.revision)
  })),cryptoImpl);
  return 'api-football:team-mapping:'+hash;
}

function qualifiedProvenanceValid(row){
  return row&&row.state==='COMMITTED'&&row.fpl_season===API_FOOTBALL_FPL_SEASON&&
    row.source_revision_id===API_FOOTBALL_MAPPING_SOURCE_REVISION_ID&&Number(row.mapping_count)===20&&
    row.approval_qualification_integrity_hash===APPROVAL_QUALIFICATION_INTEGRITY_HASH&&
    row.crosswalk_integrity_hash===CROSSWALK_INTEGRITY_HASH&&
    row.provider_universe_revision===PROVIDER_UNIVERSE_REVISION&&
    row.provider_universe_integrity_hash===PROVIDER_UNIVERSE_INTEGRITY_HASH&&
    row.provider_universe_observed_at===PROVIDER_UNIVERSE_OBSERVED_AT&&
    row.owner_review_reference===OWNER_REVIEW_REFERENCE&&row.owner_reviewed_at===OWNER_REVIEWED_AT&&
    hex64(row.persistence_integrity_hash)&&hex64(row.current_qualification_integrity_hash)&&
    hex64(row.official_fpl_authority_digest);
}

export async function readQualifiedTeamMappings(db,{season=API_FOOTBALL_FPL_SEASON,authority=null,cryptoImpl=globalThis.crypto}={}){
  if(!db?.prepare||season!==API_FOOTBALL_FPL_SEASON)return fail('qualified_mapping_unavailable');
  let qualification;try{qualification=await db.prepare(
    'SELECT q.* FROM api_football_team_mapping_heads h JOIN api_football_team_mapping_qualifications q ON q.qualification_id=h.qualification_id WHERE h.fpl_season=?'
  ).bind(season).first();}catch{return fail('qualified_mapping_unavailable');}
  if(!qualifiedProvenanceValid(qualification))return fail(qualification?'qualified_mapping_provenance_invalid':'qualified_mapping_unavailable');

  let result;try{result=await db.prepare(
    "SELECT m.mapping_id,m.source_revision_id,m.provider_entity_type,m.provider_entity_id,m.canonical_entity_id,m.mapping_method,m.mapping_status,m.mapping_version,mem.receipt_integrity_hash,mem.provider_team_id,mem.canonical_fpl_team_id FROM api_football_team_mapping_members mem JOIN entity_mappings m ON m.mapping_id=mem.mapping_id WHERE mem.qualification_id=? ORDER BY mem.canonical_fpl_team_id"
  ).bind(qualification.qualification_id).all();}catch{return fail('qualified_mapping_unavailable');}
  const rows=result?.results||[];
  if(rows.length!==20||new Set(rows.map(row=>String(row.provider_team_id))).size!==20||new Set(rows.map(row=>row.canonical_fpl_team_id)).size!==20)return fail('qualified_mapping_members_invalid');

  const mappings=[];
  for(const row of rows){
    if(row.source_revision_id!==API_FOOTBALL_MAPPING_SOURCE_REVISION_ID||row.provider_entity_type!=='team'||
      String(row.provider_entity_id)!==String(row.provider_team_id)||row.canonical_entity_id!==row.canonical_fpl_team_id||
      row.mapping_status!=='verified'||!['manually_verified','provider_id_crosswalk'].includes(row.mapping_method)||
      !hex64(row.receipt_integrity_hash))return fail('qualified_mapping_members_invalid');
    const mapping={
      provider:'api-football',entityType:'team',providerEntityId:String(row.provider_entity_id),
      canonicalFplId:row.canonical_entity_id,mappingRevision:qualification.persistence_integrity_hash,
      revision:Number(row.mapping_version),status:'VERIFIED',season,mappingMethod:row.mapping_method,
      method:row.mapping_method,provenance:'owner-qualified durable mapping '+qualification.qualification_id
    };
    const valid=validateProviderMapping(mapping,{entityType:'team',season});if(!valid.ok)return fail('qualified_mapping_members_invalid');
    if(await mappingIdFor(mapping,cryptoImpl)!==row.mapping_id)return fail('qualified_mapping_members_invalid');
    mappings.push(deepFreeze(mapping));
  }

  const persistenceBasis=canonicalise({
    kind:API_FOOTBALL_MAPPING_PERSISTENCE_KIND,fplSeason:season,sourceRevisionId:qualification.source_revision_id,
    approvalQualificationIntegrityHash:qualification.approval_qualification_integrity_hash,
    currentQualificationIntegrityHash:qualification.current_qualification_integrity_hash,
    crosswalkIntegrityHash:qualification.crosswalk_integrity_hash,
    providerUniverseRevision:qualification.provider_universe_revision,
    providerUniverseIntegrityHash:qualification.provider_universe_integrity_hash,
    providerUniverseObservedAt:qualification.provider_universe_observed_at,
    ownerReviewReference:qualification.owner_review_reference,ownerReviewedAt:qualification.owner_reviewed_at,
    officialFplAuthorityDigest:qualification.official_fpl_authority_digest,
    officialFplAuthorityFetchedAt:qualification.official_fpl_authority_fetched_at,
    rows:rows.map(row=>({
      providerTeamId:String(row.provider_team_id),canonicalFplTeamId:row.canonical_fpl_team_id,
      mappingMethod:row.mapping_method,mappingVersion:Number(row.mapping_version),receiptIntegrityHash:row.receipt_integrity_hash
    }))
  });
  if(await sha256Hex(stableStringify(persistenceBasis),cryptoImpl)!==qualification.persistence_integrity_hash)return fail('qualified_mapping_integrity_mismatch');

  if(authority){
    const ids=authorityTeamIds(authority);
    if(!ids||ids.join('|')!==mappings.map(row=>row.canonicalFplId).sort().join('|'))return fail('qualified_mapping_authority_mismatch');
  }
  return deepFreeze({
    ok:true,fplSeason:season,verifiedPremierLeagueTeamCount:20,completeTwentyClubCoverage:true,
    qualificationId:qualification.qualification_id,persistenceIntegrityHash:qualification.persistence_integrity_hash,
    qualificationProvenance:deepFreeze({
      approvalQualificationIntegrityHash:qualification.approval_qualification_integrity_hash,
      currentQualificationIntegrityHash:qualification.current_qualification_integrity_hash,
      crosswalkIntegrityHash:qualification.crosswalk_integrity_hash,
      providerUniverseRevision:qualification.provider_universe_revision,
      officialFplAuthorityDigest:qualification.official_fpl_authority_digest,
      ownerReviewReference:qualification.owner_review_reference
    }),
    mappings
  });
}
