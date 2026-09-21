import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {EXPECTED_D1_DATABASE_ID} from '../phase4b/live-contract.mjs';
import {CLOUDFLARE_API_BASE,EXPECTED_MIGRATIONS,assertReadOnlySql} from '../../api-football-collector/live-storage-preflight.mjs';
import {
  API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_INTEGRITY_HASH,
  API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_OBSERVED_AT,
  API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_REVISION,
  API_FOOTBALL_OWNER_CROSSWALK_HASH,
  API_FOOTBALL_OWNER_QUALIFICATION_INTEGRITY_HASH,
  API_FOOTBALL_OWNER_REVIEWED_AT,
  API_FOOTBALL_OWNER_REVIEW_REFERENCE
} from '../../../src/decision-intelligence/api-football-owner-mapping.mjs';

export const NO_SUBMITTED_MAPPING_STATE_VISIBLE='NO_SUBMITTED_MAPPING_STATE_VISIBLE';
export const COMPLETE_QUALIFIED_MAPPING_VISIBLE='COMPLETE_QUALIFIED_MAPPING_VISIBLE';
export const PARTIAL_OR_UNEXPECTED_MAPPING_STATE_REQUIRES_OWNER_ATTENTION='PARTIAL_OR_UNEXPECTED_MAPPING_STATE_REQUIRES_OWNER_ATTENTION';
export const STATE_CANNOT_SAFELY_BE_DETERMINED='STATE_CANNOT_SAFELY_BE_DETERMINED';
export const RECONCILIATION_QUERIES=Object.freeze({
  ledger:'SELECT version,name,applied_at FROM schema_migrations ORDER BY version',
  foreignKeys:'PRAGMA foreign_key_check',
  mappings:"SELECT COUNT(*) AS total,SUM(CASE WHEN mapping_status='verified' AND mapping_method IN ('provider_id_crosswalk','manually_verified') AND mapping_version=1 AND canonical_entity_id LIKE '2026-27:fpl:team:%' THEN 1 ELSE 0 END) AS expected_shape FROM entity_mappings WHERE source_revision_id='api-football:eia-2i5a:1' AND provider_entity_type='team'",
  qualifications:`SELECT COUNT(*) AS total,SUM(CASE WHEN state='STAGING' THEN 1 ELSE 0 END) AS staging,SUM(CASE WHEN state='COMMITTED' THEN 1 ELSE 0 END) AS committed,SUM(CASE WHEN fpl_season='2026-27' AND provider='api-football' AND source_revision_id='api-football:eia-2i5a:1' AND mapping_count=20 AND state='COMMITTED' AND committed_at IS NOT NULL AND length(persistence_integrity_hash)=64 AND persistence_integrity_hash NOT GLOB '*[^0-9a-f]*' AND qualification_id='api-football:team-mapping:'||fpl_season||':'||persistence_integrity_hash AND crosswalk_integrity_hash='${API_FOOTBALL_OWNER_CROSSWALK_HASH}' AND approval_qualification_integrity_hash='${API_FOOTBALL_OWNER_QUALIFICATION_INTEGRITY_HASH}' AND current_qualification_integrity_hash='${API_FOOTBALL_OWNER_QUALIFICATION_INTEGRITY_HASH}' AND provider_universe_revision='${API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_REVISION}' AND provider_universe_integrity_hash='${API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_INTEGRITY_HASH}' AND provider_universe_observed_at='${API_FOOTBALL_APPROVED_PROVIDER_UNIVERSE_OBSERVED_AT}' AND owner_review_reference='${API_FOOTBALL_OWNER_REVIEW_REFERENCE}' AND owner_reviewed_at='${API_FOOTBALL_OWNER_REVIEWED_AT}' AND length(official_fpl_authority_digest)=64 AND official_fpl_authority_digest NOT GLOB '*[^0-9a-f]*' AND official_fpl_authority_fetched_at IS NOT NULL THEN 1 ELSE 0 END) AS expected_provenance FROM api_football_team_mapping_qualifications`,
  members:"SELECT COUNT(*) AS total,COUNT(DISTINCT mem.provider_team_id) AS unique_provider,COUNT(DISTINCT mem.canonical_fpl_team_id) AS unique_fpl,SUM(CASE WHEN m.mapping_id=mem.mapping_id AND m.source_revision_id='api-football:eia-2i5a:1' AND m.provider_entity_type='team' AND m.provider_entity_id=mem.provider_team_id AND m.canonical_entity_id=mem.canonical_fpl_team_id AND m.mapping_status='verified' AND m.mapping_method IN ('provider_id_crosswalk','manually_verified') AND m.mapping_version=1 AND length(mem.receipt_integrity_hash)=64 AND mem.receipt_integrity_hash NOT GLOB '*[^0-9a-f]*' THEN 1 ELSE 0 END) AS expected_shape FROM api_football_team_mapping_members mem JOIN entity_mappings m ON m.mapping_id=mem.mapping_id",
  heads:"SELECT COUNT(*) AS total,SUM(CASE WHEN h.fpl_season='2026-27' AND q.state='COMMITTED' AND q.mapping_count=20 AND length(q.persistence_integrity_hash)=64 AND q.persistence_integrity_hash NOT GLOB '*[^0-9a-f]*' AND q.qualification_id='api-football:team-mapping:'||q.fpl_season||':'||q.persistence_integrity_hash THEN 1 ELSE 0 END) AS expected_shape FROM api_football_team_mapping_heads h JOIN api_football_team_mapping_qualifications q ON q.qualification_id=h.qualification_id"
});
for(const sql of Object.values(RECONCILIATION_QUERIES))assertReadOnlySql(sql);

const integer=value=>Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value):null;
const one=(rows,keys)=>{
  if(!Array.isArray(rows)||rows.length!==1)return null;
  const out={};for(const key of keys){const value=integer(rows[0]?.[key]??0);if(value===null)return null;out[key]=value;}return out;
};
const exactLedger=rows=>Array.isArray(rows)&&rows.length===6&&rows.every((row,index)=>
  integer(row?.version)===index+1&&row?.name===EXPECTED_MIGRATIONS[index+1]&&typeof row?.applied_at==='string');

export function classifyMapping0006Reconciliation(rows){
  if(!rows||!exactLedger(rows.ledger)||!Array.isArray(rows.foreignKeys))return STATE_CANNOT_SAFELY_BE_DETERMINED;
  if(rows.foreignKeys.length!==0)return STATE_CANNOT_SAFELY_BE_DETERMINED;
  const mappings=one(rows.mappings,['total','expected_shape']);
  const qualifications=one(rows.qualifications,['total','staging','committed','expected_provenance']);
  const members=one(rows.members,['total','unique_provider','unique_fpl','expected_shape']);
  const heads=one(rows.heads,['total','expected_shape']);
  if(!mappings||!qualifications||!members||!heads)return STATE_CANNOT_SAFELY_BE_DETERMINED;
  if(mappings.total===0&&mappings.expected_shape===0&&qualifications.total===0&&qualifications.staging===0&&
    qualifications.committed===0&&qualifications.expected_provenance===0&&members.total===0&&
    members.unique_provider===0&&members.unique_fpl===0&&members.expected_shape===0&&heads.total===0&&heads.expected_shape===0)
    return NO_SUBMITTED_MAPPING_STATE_VISIBLE;
  if(mappings.total===20&&mappings.expected_shape===20&&qualifications.total===1&&qualifications.staging===0&&
    qualifications.committed===1&&qualifications.expected_provenance===1&&members.total===20&&
    members.unique_provider===20&&members.unique_fpl===20&&members.expected_shape===20&&heads.total===1&&heads.expected_shape===1)
    return COMPLETE_QUALIFIED_MAPPING_VISIBLE;
  return PARTIAL_OR_UNEXPECTED_MAPPING_STATE_REQUIRES_OWNER_ATTENTION;
}

export function decodeReconciliationD1Response(payload){
  const entries=Object.entries(RECONCILIATION_QUERIES),result=payload?.result;
  if(payload?.success!==true||(Array.isArray(payload?.errors)&&payload.errors.length)||!Array.isArray(result)||result.length!==entries.length)return null;
  const rows={};let rowsRead=0;
  for(let index=0;index<entries.length;index++){
    const item=result[index],read=integer(item?.meta?.rows_read),written=integer(item?.meta?.rows_written);
    if(item?.success!==true||!Array.isArray(item.results)||read===null||written!==0)return null;
    rows[entries[index][0]]=item.results;rowsRead+=read;
  }
  return Object.freeze({rows:Object.freeze(rows),rowsRead});
}

export async function runMapping0006Reconciliation({env=process.env,fetchImpl=globalThis.fetch}={}){
  const accountId=env.DATA_STEWARD_CLOUDFLARE_ACCOUNT_ID,token=env.DATA_STEWARD_CLOUDFLARE_READ_TOKEN;
  const fingerprint=createHash('sha256').update(String(accountId??'')).digest('hex');
  if(!accountId||!token||fingerprint!==env.DATA_STEWARD_CLOUDFLARE_ACCOUNT_FINGERPRINT)
    return Object.freeze({ok:false,classification:STATE_CANNOT_SAFELY_BE_DETERMINED,reason:'reconciliation_identity_invalid',productionMutations:0,apiFootballRequests:0});
  const url=`${CLOUDFLARE_API_BASE}/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(EXPECTED_D1_DATABASE_ID)}/query`;
  let response,payload;
  try{
    response=await fetchImpl(url,{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${token}`,Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({batch:Object.values(RECONCILIATION_QUERIES).map(sql=>({sql,params:[]}))}),signal:AbortSignal.timeout(15000)});
    if(response?.status!==200)throw new Error('http');payload=await response.json();
  }catch{return Object.freeze({ok:false,classification:STATE_CANNOT_SAFELY_BE_DETERMINED,reason:'reconciliation_read_failed',productionMutations:0,apiFootballRequests:0});}
  const decoded=decodeReconciliationD1Response(payload);
  if(!decoded)return Object.freeze({ok:false,classification:STATE_CANNOT_SAFELY_BE_DETERMINED,reason:'reconciliation_response_unsafe',productionMutations:0,apiFootballRequests:0});
  const classification=classifyMapping0006Reconciliation(decoded.rows);
  return Object.freeze({ok:classification!==STATE_CANNOT_SAFELY_BE_DETERMINED,classification,rowsRead:decoded.rowsRead,productionMutations:0,apiFootballRequests:0});
}

export async function main(){
  const report=await runMapping0006Reconciliation();
  if(process.env.MAPPING_0006_RECONCILIATION_REPORT_PATH)fs.writeFileSync(process.env.MAPPING_0006_RECONCILIATION_REPORT_PATH,JSON.stringify(report,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify(report));return report.ok?0:1;
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)process.exitCode=await main();
