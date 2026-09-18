import {canonicalise,deepFreeze,sha256Hex,stableStringify} from '../../src/decision-intelligence/canonical.mjs';
import {
  API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_INTEGRITY_HASH,
  API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_OBSERVED_AT,
  API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_REVISION,
  API_FOOTBALL_OWNER_CROSSWALK_HASH,
  API_FOOTBALL_OWNER_QUALIFICATION_INTEGRITY_HASH,
  API_FOOTBALL_OWNER_REVIEW_REFERENCE,
  API_FOOTBALL_OWNER_REVIEWED_AT,
  issueOwnerApprovedTwentyClubMappings
} from '../../src/decision-intelligence/api-football-owner-mapping.mjs';
import {validateProviderMapping} from '../../src/decision-intelligence/api-football-shadow-contracts.mjs';
import {API_FOOTBALL_FPL_SEASON} from './runtime-contracts.mjs';

export const API_FOOTBALL_MAPPING_SOURCE_REVISION_ID='api-football:eia-2i5a:1';
export const API_FOOTBALL_MAPPING_PERSISTENCE_KIND='api-football-team-mapping-persistence-v1';

const fail=reason=>deepFreeze({ok:false,reason:String(reason)});
const iso=value=>{const ms=Date.parse(value);return Number.isFinite(ms)?new Date(ms).toISOString():null;};
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

export async function prepareQualifiedTeamMappingPersistence({
  authority,providerUniverse,crosswalk,now,cryptoImpl=globalThis.crypto
}={}){
  const createdAt=iso(now);if(!createdAt)return fail('mapping_persistence_timestamp_invalid');
  const issued=await issueOwnerApprovedTwentyClubMappings({authority,providerUniverse,crosswalk},cryptoImpl);
  if(!issued.ok||issued.decision!=='GO')return fail(issued.reason||'mapping_qualification_not_go');
  const qualification=issued.qualification;
  if(!qualification?.ok||qualification.decision!=='GO'||qualification.completeTwentyClubCoverage!==true||
    qualification.verifiedPremierLeagueTeamCount!==20||qualification.unresolved?.length!==0||
    qualification.receiptFailures?.length!==0||qualification.providerUniverseRevision!==API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_REVISION||
    !hex64(qualification.integrityHash))return fail('mapping_qualification_not_go');
  if(issued.crosswalkIntegrityHash!==API_FOOTBALL_OWNER_CROSSWALK_HASH||
    issued.ownerReviewReference!==API_FOOTBALL_OWNER_REVIEW_REFERENCE)return fail('mapping_qualification_provenance_invalid');
  if(providerUniverse?.integrityHash!==API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_INTEGRITY_HASH||
    providerUniverse?.revision!==API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_REVISION||
    providerUniverse?.observedAt!==API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_OBSERVED_AT)return fail('mapping_qualification_provenance_invalid');
  const officialIds=authorityTeamIds(authority);
  if(!officialIds||authority?.season!==API_FOOTBALL_FPL_SEASON||!hex64(authority?.digest)||!iso(authority?.fetchedAt))return fail('official_fpl_authority_invalid');

  const rows=[];
  for(const mapping of issued.mappings.slice().sort((a,b)=>a.canonicalFplId.localeCompare(b.canonicalFplId))){
    const valid=validateProviderMapping(mapping,{entityType:'team',season:API_FOOTBALL_FPL_SEASON});
    const receiptHash=mapping?.qualificationEvidenceReceipt?.integrityHash;
    if(!valid.ok||!officialIds.includes(mapping.canonicalFplId)||!hex64(receiptHash))return fail('mapping_persistence_member_invalid');
    rows.push(deepFreeze({
      mappingId:await mappingIdFor(mapping,cryptoImpl),
      providerTeamId:String(mapping.providerEntityId),
      canonicalFplTeamId:mapping.canonicalFplId,
      mappingMethod:mapping.method,
      mappingVersion:Number(mapping.revision),
      receiptIntegrityHash:receiptHash,
      verifiedAt:API_FOOTBALL_OWNER_REVIEWED_AT
    }));
  }
  if(rows.length!==20||new Set(rows.map(row=>row.providerTeamId)).size!==20||
    new Set(rows.map(row=>row.canonicalFplTeamId)).size!==20||
    rows.find(row=>row.canonicalFplTeamId===API_FOOTBALL_FPL_SEASON+':fpl:team:6')?.providerTeamId!=='49'||
    rows.find(row=>row.canonicalFplTeamId===API_FOOTBALL_FPL_SEASON+':fpl:team:13')?.providerTeamId!=='63')return fail('mapping_persistence_member_invalid');

  const basis=canonicalise({
    kind:API_FOOTBALL_MAPPING_PERSISTENCE_KIND,
    fplSeason:API_FOOTBALL_FPL_SEASON,
    sourceRevisionId:API_FOOTBALL_MAPPING_SOURCE_REVISION_ID,
    approvalQualificationIntegrityHash:API_FOOTBALL_OWNER_QUALIFICATION_INTEGRITY_HASH,
    currentQualificationIntegrityHash:qualification.integrityHash,
    crosswalkIntegrityHash:API_FOOTBALL_OWNER_CROSSWALK_HASH,
    providerUniverseRevision:API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_REVISION,
    providerUniverseIntegrityHash:API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_INTEGRITY_HASH,
    providerUniverseObservedAt:API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_OBSERVED_AT,
    ownerReviewReference:API_FOOTBALL_OWNER_REVIEW_REFERENCE,
    ownerReviewedAt:API_FOOTBALL_OWNER_REVIEWED_AT,
    officialFplAuthorityDigest:authority.digest,
    officialFplAuthorityFetchedAt:iso(authority.fetchedAt),
    rows:rows.map(row=>({
      providerTeamId:row.providerTeamId,canonicalFplTeamId:row.canonicalFplTeamId,
      mappingMethod:row.mappingMethod,mappingVersion:row.mappingVersion,receiptIntegrityHash:row.receiptIntegrityHash
    }))
  });
  const persistenceIntegrityHash=await sha256Hex(stableStringify(basis),cryptoImpl);
  const qualificationId='api-football:team-mapping:'+API_FOOTBALL_FPL_SEASON+':'+persistenceIntegrityHash;
  return deepFreeze({
    ok:true,kind:API_FOOTBALL_MAPPING_PERSISTENCE_KIND,qualificationId,
    fplSeason:API_FOOTBALL_FPL_SEASON,sourceRevisionId:API_FOOTBALL_MAPPING_SOURCE_REVISION_ID,
    approvalQualificationIntegrityHash:API_FOOTBALL_OWNER_QUALIFICATION_INTEGRITY_HASH,
    currentQualificationIntegrityHash:qualification.integrityHash,
    persistenceIntegrityHash,crosswalkIntegrityHash:API_FOOTBALL_OWNER_CROSSWALK_HASH,
    providerUniverseRevision:API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_REVISION,
    providerUniverseIntegrityHash:API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_INTEGRITY_HASH,
    providerUniverseObservedAt:API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_OBSERVED_AT,
    ownerReviewReference:API_FOOTBALL_OWNER_REVIEW_REFERENCE,ownerReviewedAt:API_FOOTBALL_OWNER_REVIEWED_AT,
    officialFplAuthorityDigest:authority.digest,officialFplAuthorityFetchedAt:iso(authority.fetchedAt),
    currentQualificationFetchedAt:qualification.fetchedAt,createdAt,rows
  });
}

function qualifiedProvenanceValid(row){
  return row&&row.state==='COMMITTED'&&row.fpl_season===API_FOOTBALL_FPL_SEASON&&
    row.source_revision_id===API_FOOTBALL_MAPPING_SOURCE_REVISION_ID&&row.mapping_count===20&&
    row.approval_qualification_integrity_hash===API_FOOTBALL_OWNER_QUALIFICATION_INTEGRITY_HASH&&
    row.crosswalk_integrity_hash===API_FOOTBALL_OWNER_CROSSWALK_HASH&&
    row.provider_universe_revision===API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_REVISION&&
    row.provider_universe_integrity_hash===API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_INTEGRITY_HASH&&
    row.provider_universe_observed_at===API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_OBSERVED_AT&&
    row.owner_review_reference===API_FOOTBALL_OWNER_REVIEW_REFERENCE&&
    row.owner_reviewed_at===API_FOOTBALL_OWNER_REVIEWED_AT&&hex64(row.persistence_integrity_hash)&&
    hex64(row.current_qualification_integrity_hash)&&hex64(row.official_fpl_authority_digest);
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
  if(rows.length!==20||new Set(rows.map(row=>row.provider_team_id)).size!==20||new Set(rows.map(row=>row.canonical_fpl_team_id)).size!==20)return fail('qualified_mapping_members_invalid');
  const mappings=[];
  for(const row of rows){
    if(row.source_revision_id!==API_FOOTBALL_MAPPING_SOURCE_REVISION_ID||row.provider_entity_type!=='team'||
      row.provider_entity_id!==row.provider_team_id||row.canonical_entity_id!==row.canonical_fpl_team_id||
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
    rows:rows.map(row=>({providerTeamId:String(row.provider_team_id),canonicalFplTeamId:row.canonical_fpl_team_id,mappingMethod:row.mapping_method,mappingVersion:Number(row.mapping_version),receiptIntegrityHash:row.receipt_integrity_hash}))
  });
  if(await sha256Hex(stableStringify(persistenceBasis),cryptoImpl)!==qualification.persistence_integrity_hash)return fail('qualified_mapping_integrity_mismatch');
  if(mappings.find(row=>row.canonicalFplId===season+':fpl:team:6')?.providerEntityId!=='49'||
    mappings.find(row=>row.canonicalFplId===season+':fpl:team:13')?.providerEntityId!=='63')return fail('qualified_mapping_members_invalid');
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

export async function persistQualifiedTeamMappingPlan(db,plan){
  if(!db?.prepare||!db?.batch||plan?.ok!==true||plan.kind!==API_FOOTBALL_MAPPING_PERSISTENCE_KIND||
    plan.rows?.length!==20||!hex64(plan.persistenceIntegrityHash))return fail('mapping_persistence_plan_invalid');
  const existing=await readQualifiedTeamMappings(db,{season:plan.fplSeason});
  if(existing.ok&&existing.persistenceIntegrityHash===plan.persistenceIntegrityHash)return deepFreeze({ok:true,result:'already_committed',qualificationId:existing.qualificationId});
  const statements=[];
  for(const row of plan.rows){
    statements.push(db.prepare(
      "INSERT INTO entity_mappings(mapping_id,source_revision_id,provider_entity_type,provider_entity_id,canonical_entity_id,mapping_method,mapping_status,valid_from,valid_to,verified_at,mapping_version,supersedes_mapping_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(mapping_id) DO NOTHING"
    ).bind(row.mappingId,plan.sourceRevisionId,'team',row.providerTeamId,row.canonicalFplTeamId,row.mappingMethod,'verified',plan.ownerReviewedAt,null,row.verifiedAt,row.mappingVersion,null,plan.createdAt));
  }
  statements.push(db.prepare(
    "INSERT INTO api_football_team_mapping_qualifications(qualification_id,fpl_season,provider,source_revision_id,approval_qualification_integrity_hash,current_qualification_integrity_hash,persistence_integrity_hash,crosswalk_integrity_hash,provider_universe_revision,provider_universe_integrity_hash,provider_universe_observed_at,owner_review_reference,owner_reviewed_at,official_fpl_authority_digest,official_fpl_authority_fetched_at,mapping_count,state,committed_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'STAGING',NULL,?)"
  ).bind(plan.qualificationId,plan.fplSeason,'api-football',plan.sourceRevisionId,plan.approvalQualificationIntegrityHash,plan.currentQualificationIntegrityHash,plan.persistenceIntegrityHash,plan.crosswalkIntegrityHash,plan.providerUniverseRevision,plan.providerUniverseIntegrityHash,plan.providerUniverseObservedAt,plan.ownerReviewReference,plan.ownerReviewedAt,plan.officialFplAuthorityDigest,plan.officialFplAuthorityFetchedAt,20,plan.createdAt));
  for(const row of plan.rows){
    statements.push(db.prepare(
      'INSERT INTO api_football_team_mapping_members(qualification_id,mapping_id,provider_team_id,canonical_fpl_team_id,receipt_integrity_hash) VALUES(?,?,?,?,?)'
    ).bind(plan.qualificationId,row.mappingId,row.providerTeamId,row.canonicalFplTeamId,row.receiptIntegrityHash));
  }
  statements.push(db.prepare(
    "UPDATE api_football_team_mapping_qualifications SET state='COMMITTED',committed_at=? WHERE qualification_id=? AND state='STAGING'"
  ).bind(plan.createdAt,plan.qualificationId));
  statements.push(db.prepare(
    'INSERT INTO api_football_team_mapping_heads(fpl_season,qualification_id,updated_at) VALUES(?,?,?) ON CONFLICT(fpl_season) DO UPDATE SET qualification_id=excluded.qualification_id,updated_at=excluded.updated_at'
  ).bind(plan.fplSeason,plan.qualificationId,plan.createdAt));
  try{await db.batch(statements);}catch{return fail('mapping_persistence_failed');}
  const verified=await readQualifiedTeamMappings(db,{season:plan.fplSeason});
  if(!verified.ok||verified.persistenceIntegrityHash!==plan.persistenceIntegrityHash)return fail('mapping_persistence_verification_failed');
  return deepFreeze({ok:true,result:'committed',qualificationId:verified.qualificationId,persistenceIntegrityHash:verified.persistenceIntegrityHash});
}
