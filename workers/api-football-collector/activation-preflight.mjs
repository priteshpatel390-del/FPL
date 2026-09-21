import {API_FOOTBALL_ATTENDED_DISCOVERY_ACTIVATION,API_FOOTBALL_FPL_SEASON,validateAuthority} from './runtime-contracts.mjs';

export const COLLECTOR_ACTIVATION_PREFLIGHT_VERSION='collector-activation-preflight-v2';
export const COLLECTOR_PREFLIGHT_REPOSITORY_STAGE='REPOSITORY_INFRASTRUCTURE_STAGING';
export const COLLECTOR_PREFLIGHT_ATTENDED_STAGE='ATTENDED_ACCEPTANCE';
export const COLLECTOR_REPOSITORY_STAGE_READY='READY_FOR_REPOSITORY_INFRASTRUCTURE_STAGING';
export const COLLECTOR_ATTENDED_STAGE_READY='READY_FOR_SEPARATELY_APPROVED_ATTENDED_ACCEPTANCE';
const MIGRATIONS=Object.freeze([
  [1,'shadow_data_foundation'],[2,'official_fpl_structured_history'],[3,'production_query_plan_indexes'],
  [4,'api_football_shadow_identity'],[5,'api_football_shadow_runtime'],[6,'api_football_mapping_qualification']
]);
const safe=value=>Object.freeze(value);
const stop=(stage,reason)=>safe({ok:false,stage,classification:`STOP_${stage}_REVIEW_REQUIRED`,reason});

function sharedEvidence(evidence,stage,{now}={}){
  if(!evidence||evidence.version!==COLLECTOR_ACTIVATION_PREFLIGHT_VERSION||evidence.stage!==stage)return stop(stage,'preflight_contract_invalid');
  if(JSON.stringify(evidence.migrations)!==JSON.stringify(MIGRATIONS))return stop(stage,'migration_ledger_unexpected');
  if(evidence.foreignKeyViolations!==0)return stop(stage,'foreign_key_violations');
  const authority=validateAuthority(evidence.authority,{now,season:API_FOOTBALL_FPL_SEASON});if(!authority.ok)return stop(stage,authority.reason);
  const mapping=evidence.mapping;
  if(!mapping||mapping.state!=='COMMITTED'||mapping.isCurrentHead!==true||mapping.mappingCount!==20||mapping.memberCount!==20||mapping.distinctProviderIds!==20||mapping.distinctFplIds!==20||mapping.authorityDigest!==evidence.authority.digest)return stop(stage,'qualified_mapping_unavailable');
  const runtime=evidence.runtime;
  if(!runtime||runtime.provider!=='api-football'||runtime.collectionEnabled!==0||!['UNPROVISIONED','AVAILABLE'].includes(runtime.credentialState))return stop(stage,'runtime_state_unexpected');
  if(runtime.inFlightAttemptId!==null||runtime.inFlightLeaseExpiresAt!==null)return stop(stage,'active_request_lease');
  const counts=evidence.counts;
  if(!counts||Object.values(counts).some(value=>!Number.isSafeInteger(value)||value<0)||counts.requestAttempts>100_000||counts.generations>10_000||counts.fixtureRevisions>1_000_000)return stop(stage,'historical_state_unbounded');
  if(evidence.priorState?.attempt2Count!==0||evidence.priorState?.reservedAttemptCount!==0||evidence.priorState?.stagingGenerationCount!==0)return stop(stage,'prior_state_requires_reconciliation');
  if(evidence.modelUiImportCount!==0)return stop(stage,'model_ui_integration_detected');
  return safe({ok:true});
}

export function classifyCollectorActivationPreflight(evidence,{now}={}){
  const stage=evidence?.stage;
  if(![COLLECTOR_PREFLIGHT_REPOSITORY_STAGE,COLLECTOR_PREFLIGHT_ATTENDED_STAGE].includes(stage))return stop('UNKNOWN_STAGE','preflight_stage_invalid');
  const shared=sharedEvidence(evidence,stage,{now});if(!shared.ok)return shared;
  const inventory=evidence.inventory;if(!inventory||inventory.cronCount!==0||inventory.workersDev!==false||inventory.previewUrls!==false||typeof inventory.secretBindingPresent!=='boolean')return stop(stage,'collector_inventory_unexpected');
  if(stage===COLLECTOR_PREFLIGHT_REPOSITORY_STAGE){
    if(inventory.activation!=='REPOSITORY_ONLY_BLOCKED'||inventory.databaseIdPlaceholder!==true||inventory.deployed!==false||inventory.secretBindingPresent!==false)return stop(stage,'repository_stage_inventory_unexpected');
    return safe({ok:true,stage,classification:COLLECTOR_REPOSITORY_STAGE_READY,secretBindingPresent:false});
  }
  if(inventory.activation!==API_FOOTBALL_ATTENDED_DISCOVERY_ACTIVATION||inventory.databaseIdPlaceholder!==false||inventory.productionBindingProven!==true||inventory.deployed!==true||inventory.configurationExact!==true||inventory.secretBindingPresent!==true)return stop(stage,'attended_stage_inventory_unexpected');
  if(evidence.runtime.credentialState!=='AVAILABLE')return stop(stage,'credential_state_unexpected');
  if(evidence.counts.requestAttempts!==0||evidence.counts.generations!==0||evidence.counts.fixtureRevisions!==0)return stop(stage,'first_acceptance_history_not_pristine');
  return safe({ok:true,stage,classification:COLLECTOR_ATTENDED_STAGE_READY,secretBindingPresent:true});
}

export async function runCollectorActivationPreflight({readEvidence,stage,now}={}){
  if(typeof readEvidence!=='function')return stop(stage||'UNKNOWN_STAGE','read_authority_unavailable');
  let evidence;try{evidence=await readEvidence(stage);}catch{return stop(stage||'UNKNOWN_STAGE','read_authority_failed');}
  return classifyCollectorActivationPreflight(evidence,{now});
}
