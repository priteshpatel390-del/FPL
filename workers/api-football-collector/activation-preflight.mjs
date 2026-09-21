import {API_FOOTBALL_FPL_SEASON,validateAuthority} from './runtime-contracts.mjs';

export const COLLECTOR_ACTIVATION_PREFLIGHT_VERSION='collector-activation-preflight-v1';
export const COLLECTOR_ACTIVATION_PREFLIGHT_READY='READY_FOR_SEPARATE_ATTENDED_ACTIVATION';
const MIGRATIONS=Object.freeze([
  [1,'shadow_data_foundation'],[2,'official_fpl_structured_history'],[3,'production_query_plan_indexes'],
  [4,'api_football_shadow_identity'],[5,'api_football_shadow_runtime'],[6,'api_football_mapping_qualification']
]);
const safe=value=>Object.freeze(value);
const stop=reason=>safe({ok:false,classification:'STOP_REVIEW_REQUIRED',reason});

export function classifyCollectorActivationPreflight(evidence,{now}={}){
  if(!evidence||evidence.version!==COLLECTOR_ACTIVATION_PREFLIGHT_VERSION)return stop('preflight_contract_invalid');
  if(JSON.stringify(evidence.migrations)!==JSON.stringify(MIGRATIONS))return stop('migration_ledger_unexpected');
  if(evidence.foreignKeyViolations!==0)return stop('foreign_key_violations');
  const authority=validateAuthority(evidence.authority,{now,season:API_FOOTBALL_FPL_SEASON});if(!authority.ok)return stop(authority.reason);
  const mapping=evidence.mapping;
  if(!mapping||mapping.state!=='COMMITTED'||mapping.isCurrentHead!==true||mapping.mappingCount!==20||mapping.memberCount!==20||mapping.distinctProviderIds!==20||mapping.distinctFplIds!==20||mapping.authorityDigest!==evidence.authority.digest)return stop('qualified_mapping_unavailable');
  const runtime=evidence.runtime;
  if(!runtime||runtime.provider!=='api-football'||runtime.collectionEnabled!==0||!['UNPROVISIONED','AVAILABLE'].includes(runtime.credentialState))return stop('runtime_state_unexpected');
  if(runtime.inFlightAttemptId!==null||runtime.inFlightLeaseExpiresAt!==null)return stop('active_request_lease');
  const inventory=evidence.inventory;
  if(!inventory||inventory.activation!=='REPOSITORY_ONLY_BLOCKED'||inventory.cronCount!==0||inventory.workersDev!==false||inventory.previewUrls!==false||inventory.databaseIdPlaceholder!==true)return stop('collector_inventory_unexpected');
  if(typeof inventory.secretBindingPresent!=='boolean')return stop('secret_presence_unproven');
  const counts=evidence.counts;
  if(!counts||Object.values(counts).some(value=>!Number.isSafeInteger(value)||value<0)||counts.requestAttempts>100_000||counts.generations>10_000||counts.fixtureRevisions>1_000_000)return stop('historical_state_unbounded');
  if(evidence.modelUiImportCount!==0)return stop('model_ui_integration_detected');
  return safe({ok:true,classification:COLLECTOR_ACTIVATION_PREFLIGHT_READY,secretBindingPresent:inventory.secretBindingPresent});
}

export async function runCollectorActivationPreflight({readEvidence,now}={}){
  if(typeof readEvidence!=='function')return stop('read_authority_unavailable');
  let evidence;try{evidence=await readEvidence();}catch{return stop('read_authority_failed');}
  return classifyCollectorActivationPreflight(evidence,{now});
}
