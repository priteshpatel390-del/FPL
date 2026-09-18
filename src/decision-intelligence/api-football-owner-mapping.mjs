import {deepFreeze,sha256Hex} from './canonical.mjs';
import {API_FOOTBALL_FPL_SEASON} from './api-football-discovery.mjs';
import {currentSeasonOfficialFplTeamIdentities} from './api-football-shadow-contracts.mjs';
import {
  confirmPreviouslyQualifiedTeamMappings,issueQualificationMappingReceipt,qualifyTwentyClubMapping,
  validateApiFootballTeamUniverseEvidence
} from './api-football-prelive-qualification.mjs';

export const API_FOOTBALL_OWNER_CROSSWALK_HASH='d48c7980d1c39e7d4a6f82cb56d25a750286c925fd4996d0f8c728a4fb45c7f5';
export const API_FOOTBALL_OWNER_REVIEW_REFERENCE='owner-approved-crosswalk-2026-09-18';
export const API_FOOTBALL_OWNER_REVIEWED_AT='2026-09-18T09:21:00.000Z';
export const API_FOOTBALL_APPROVED_PROVIDER_RUN_ID='35328500278';
export const API_FOOTBALL_APPROVED_PROVIDER_ARTIFACT_ID='10540321648';
export const API_FOOTBALL_APPROVED_PROVIDER_ARTIFACT_SHA256='4a69b38d20857767007b23f6259efe5894aab35202ad8e10ee8cdc62bdafce97';
export const API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_INTEGRITY_HASH='5b404fb0a736a72973b6a1772d984992acea1dff6e2d2d7336c8253a078ae5f1';
export const API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_REVISION=`api-football-team-universe:${API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_INTEGRITY_HASH}`;
export const API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_OBSERVED_AT='2026-09-18T09:14:56.730Z';
export const API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_EXECUTION_IDENTITY='github:priteshpatel390-del/FPL:run:35328500278:attempt:1:sha:f3a173362feba67020157f7c81c0fa3aaf2ca94a';

const FPL_IDS=Object.freeze(Array.from({length:20},(_,index)=>String(index+1)));
const fail=reason=>deepFreeze({ok:false,reason:String(reason)});
const canonicalProviderId=value=>{const text=String(value??'');return /^[1-9]\d*$/.test(text)?text:null;};

export const OFFICIAL_FPL_2026_27_OWNER_REVIEW_TEAM_LABELS=deepFreeze([
  {officialFplTeamId:'1',name:'Arsenal',shortName:'ARS'},
  {officialFplTeamId:'2',name:'Aston Villa',shortName:'AVL'},
  {officialFplTeamId:'3',name:'Bournemouth',shortName:'BOU'},
  {officialFplTeamId:'4',name:'Brentford',shortName:'BRE'},
  {officialFplTeamId:'5',name:'Brighton',shortName:'BHA'},
  {officialFplTeamId:'6',name:'Chelsea',shortName:'CHE'},
  {officialFplTeamId:'7',name:'Coventry City',shortName:'COV'},
  {officialFplTeamId:'8',name:'Crystal Palace',shortName:'CRY'},
  {officialFplTeamId:'9',name:'Everton',shortName:'EVE'},
  {officialFplTeamId:'10',name:'Fulham',shortName:'FUL'},
  {officialFplTeamId:'11',name:'Hull City',shortName:'HUL'},
  {officialFplTeamId:'12',name:'Ipswich Town',shortName:'IPS'},
  {officialFplTeamId:'13',name:'Leeds',shortName:'LEE'},
  {officialFplTeamId:'14',name:'Liverpool',shortName:'LIV'},
  {officialFplTeamId:'15',name:'Man City',shortName:'MCI'},
  {officialFplTeamId:'16',name:'Man Utd',shortName:'MUN'},
  {officialFplTeamId:'17',name:'Newcastle',shortName:'NEW'},
  {officialFplTeamId:'18',name:"Nott'm Forest",shortName:'NFO'},
  {officialFplTeamId:'19',name:'Spurs',shortName:'TOT'},
  {officialFplTeamId:'20',name:'Sunderland',shortName:'SUN'}
]);

function normalizeOwnerCrosswalk(crosswalk){
  if(!crosswalk||typeof crosswalk!=='object'||Array.isArray(crosswalk))return fail('owner_crosswalk_invalid');
  const keys=Object.keys(crosswalk).sort((a,b)=>Number(a)-Number(b));
  if(keys.length!==20||keys.some((key,index)=>key!==FPL_IDS[index]))return fail('owner_crosswalk_invalid');
  const rows=FPL_IDS.map(officialFplTeamId=>({
    officialFplTeamId,
    providerTeamId:canonicalProviderId(crosswalk[officialFplTeamId])
  }));
  if(rows.some(row=>row.providerTeamId==null)||new Set(rows.map(row=>row.providerTeamId)).size!==20)return fail('owner_crosswalk_invalid');
  if(rows.find(row=>row.officialFplTeamId==='6')?.providerTeamId!=='49'||
    rows.find(row=>row.officialFplTeamId==='13')?.providerTeamId!=='63')return fail('legacy_anchor_conflict');
  const canonicalText=rows.map(row=>`${row.officialFplTeamId}:${row.providerTeamId}`).join('|');
  return deepFreeze({ok:true,rows,canonicalText});
}

export async function validateOwnerApprovedTeamCrosswalk(crosswalk,cryptoImpl=globalThis.crypto){
  const normalized=normalizeOwnerCrosswalk(crosswalk);if(!normalized.ok)return normalized;
  const integrityHash=await sha256Hex(normalized.canonicalText,cryptoImpl);
  if(integrityHash!==API_FOOTBALL_OWNER_CROSSWALK_HASH)return fail('owner_crosswalk_hash_mismatch');
  return deepFreeze({ok:true,rows:normalized.rows,integrityHash});
}

function validateOwnerReviewedOfficialFplLabels(authority){
  const clubs=currentSeasonOfficialFplTeamIdentities(API_FOOTBALL_FPL_SEASON,authority);if(!clubs.ok)return clubs;
  if(!Array.isArray(authority?.teams)||authority.teams.length!==20)return fail('owner_review_official_fpl_identity_mismatch');
  const byId=new Map(authority.teams.map(row=>[String(row?.id),row]));
  for(const expected of OFFICIAL_FPL_2026_27_OWNER_REVIEW_TEAM_LABELS){
    const actual=byId.get(expected.officialFplTeamId);
    if(!actual||actual.name!==expected.name||actual.short_name!==expected.shortName)return fail('owner_review_official_fpl_identity_mismatch');
  }
  return deepFreeze({ok:true,clubs});
}

function providerUniverseMatchesApprovedObservation(providerUniverse){
  return providerUniverse?.revision===API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_REVISION&&
    providerUniverse?.integrityHash===API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_INTEGRITY_HASH&&
    providerUniverse?.observedAt===API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_OBSERVED_AT&&
    providerUniverse?.executionIdentity===API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_EXECUTION_IDENTITY;
}

function ownerReviewProvenance(){
  return 'Owner approved the exact 2026/27 API-Football provider-ID to Official FPL team-ID crosswalk on 2026-09-18 after attended provider-universe run 35328500278; the mapping is hash-bound and is not inferred from provider names or codes.';
}

export async function issueOwnerApprovedTwentyClubMappings({authority,providerUniverse,crosswalk}={},cryptoImpl=globalThis.crypto){
  const official=validateOwnerReviewedOfficialFplLabels(authority);if(!official.ok)return official;
  const universe=await validateApiFootballTeamUniverseEvidence(providerUniverse,cryptoImpl);if(!universe.ok)return universe;
  if(!providerUniverseMatchesApprovedObservation(providerUniverse))return fail('provider_team_universe_not_owner_reviewed');
  const approved=await validateOwnerApprovedTeamCrosswalk(crosswalk,cryptoImpl);if(!approved.ok)return approved;
  const providerIds=new Set(providerUniverse.teams.map(row=>String(row.providerTeamId)));
  if(providerIds.size!==20||approved.rows.some(row=>!providerIds.has(row.providerTeamId)))return fail('provider_team_universe_mapping_mismatch');

  const legacy=await confirmPreviouslyQualifiedTeamMappings(authority,cryptoImpl);
  if(!legacy.ok||legacy.mappings.length!==2)return fail('legacy_mapping_reuse_failed');
  const legacyByFpl=new Map(legacy.mappings.map(row=>[String(row.canonicalFplId).split(':').pop(),row]));
  const labelsById=new Map(OFFICIAL_FPL_2026_27_OWNER_REVIEW_TEAM_LABELS.map(row=>[row.officialFplTeamId,row]));
  const mappings=[];
  let newReceiptCount=0;
  for(const row of approved.rows){
    const legacyMapping=legacyByFpl.get(row.officialFplTeamId);
    if(legacyMapping){mappings.push(legacyMapping);continue;}
    const label=labelsById.get(row.officialFplTeamId);
    const provenance=ownerReviewProvenance();
    const mapping={
      provider:'api-football',entityType:'team',providerEntityId:row.providerTeamId,
      canonicalFplId:`${API_FOOTBALL_FPL_SEASON}:fpl:team:${row.officialFplTeamId}`,
      mappingRevision:'owner-approved-2026-09-18-crosswalk',revision:1,status:'VERIFIED',
      season:API_FOOTBALL_FPL_SEASON,method:'manually_verified',provenance,club:label.name,
      evidenceDate:'2026-09-18',evidenceType:'attended_api_football_team_universe',
      evidenceSources:['attended-api-football-team-universe','owner-review','current-official-fpl-authority']
    };
    const evidence={
      evidenceType:'attended_api_football_team_universe',qualificationMethod:'owner_verified_provider_id_crosswalk',
      reviewState:'OWNER_VERIFIED',reviewReference:API_FOOTBALL_OWNER_REVIEW_REFERENCE,
      reviewedAt:API_FOOTBALL_OWNER_REVIEWED_AT,provenance
    };
    const receipt=await issueQualificationMappingReceipt({mapping,evidence,authority,providerUniverse},cryptoImpl);
    if(receipt?.ok===false)return fail('owner_mapping_receipt_issue_failed');
    mappings.push({...mapping,qualificationEvidenceReceipt:receipt});
    newReceiptCount+=1;
  }
  if(newReceiptCount!==18||mappings.length!==20)return fail('owner_mapping_receipt_count_invalid');

  const qualification=await qualifyTwentyClubMapping({authority,mappings,providerUniverse},cryptoImpl);
  if(!qualification.ok||qualification.decision!=='GO'||qualification.verifiedPremierLeagueTeamCount!==20||
    qualification.completeTwentyClubCoverage!==true||qualification.unresolved.length!==0||
    qualification.receiptFailures.length!==0)return deepFreeze({
      ok:false,decision:'NO-GO',reason:qualification.reason||'current_season_pl_team_mapping_incomplete',
      newReceiptCount,legacyReceiptCount:2,qualification
    });
  return deepFreeze({
    ok:true,decision:'GO',newReceiptCount,legacyReceiptCount:2,
    ownerReviewReference:API_FOOTBALL_OWNER_REVIEW_REFERENCE,
    crosswalkIntegrityHash:approved.integrityHash,mappings,qualification
  });
}
