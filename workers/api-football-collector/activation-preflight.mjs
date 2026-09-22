import {API_FOOTBALL_ATTENDED_DISCOVERY_ACTIVATION,API_FOOTBALL_FPL_SEASON,validateAuthority} from './runtime-contracts.mjs';

export const COLLECTOR_ACTIVATION_PREFLIGHT_VERSION='collector-activation-preflight-v3';
export const COLLECTOR_PREFLIGHT_REPOSITORY_STAGE='REPOSITORY_INFRASTRUCTURE_STAGING';
export const COLLECTOR_PREFLIGHT_ATTENDED_STAGE='ATTENDED_ACCEPTANCE';
export const COLLECTOR_PREFLIGHT_PREPARATION_START_STAGE='ATTENDED_PREPARATION_START';
export const COLLECTOR_PREFLIGHT_PREPARATION_VERSION_STAGE='ATTENDED_PREPARATION_VERSION_READY';
export const COLLECTOR_PREFLIGHT_PREPARATION_CLOSEOUT_STAGE='ATTENDED_PREPARATION_CLOSEOUT';
export const COLLECTOR_REPOSITORY_STAGE_READY='READY_FOR_REPOSITORY_INFRASTRUCTURE_STAGING';
export const COLLECTOR_PREPARATION_START_READY='READY_FOR_ATTENDED_VERSION_PREPARATION';
export const COLLECTOR_PREPARATION_VERSION_READY='READY_FOR_ATTENDED_CREDENTIAL_PREPARATION';
export const COLLECTOR_ATTENDED_STAGE_READY='READY_FOR_SEPARATELY_APPROVED_ATTENDED_ACCEPTANCE';
const MIGRATIONS=Object.freeze([
  [1,'shadow_data_foundation'],[2,'official_fpl_structured_history'],[3,'production_query_plan_indexes'],
  [4,'api_football_shadow_identity'],[5,'api_football_shadow_runtime'],[6,'api_football_mapping_qualification']
]);
const safe=value=>Object.freeze(value);
const stop=(stage,reason)=>safe({ok:false,stage,classification:`STOP_${stage}_REVIEW_REQUIRED`,reason});
const hex64=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const validIso=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));

function sharedEvidence(evidence,stage,{now}={}){
  if(!evidence||evidence.version!==COLLECTOR_ACTIVATION_PREFLIGHT_VERSION||evidence.stage!==stage)return stop(stage,'preflight_contract_invalid');
  if(JSON.stringify(evidence.migrations)!==JSON.stringify(MIGRATIONS))return stop(stage,'migration_ledger_unexpected');
  if(evidence.foreignKeyViolations!==0)return stop(stage,'foreign_key_violations');
  const authority=validateAuthority(evidence.authority,{now,season:API_FOOTBALL_FPL_SEASON});if(!authority.ok)return stop(stage,authority.reason);
  const mapping=evidence.mapping;
  if(!mapping||mapping.state!=='COMMITTED'||mapping.isCurrentHead!==true||mapping.mappingCount!==20||mapping.memberCount!==20||mapping.distinctProviderIds!==20||mapping.distinctFplIds!==20)return stop(stage,'qualified_mapping_unavailable');
  if(!hex64(mapping.historicalAuthorityDigest)||!validIso(mapping.historicalAuthorityFetchedAt))return stop(stage,'mapping_provenance_invalid');
  if(!Array.isArray(mapping.canonicalTeamIds)||mapping.canonicalTeamIds.length!==20||new Set(mapping.canonicalTeamIds).size!==20)return stop(stage,'qualified_mapping_unavailable');
  const currentTeamIds=evidence.authority.teamIds.slice().sort(),mappedTeamIds=mapping.canonicalTeamIds.slice().sort();
  if(JSON.stringify(mappedTeamIds)!==JSON.stringify(currentTeamIds))return stop(stage,'qualified_mapping_unavailable');
  const runtime=evidence.runtime;
  if(!runtime||runtime.provider!=='api-football'||runtime.collectionEnabled!==0||!['UNPROVISIONED','AVAILABLE'].includes(runtime.credentialState))return stop(stage,'runtime_state_unexpected');
  if(runtime.inFlightAttemptId!==null||runtime.inFlightLeaseExpiresAt!==null)return stop(stage,'active_request_lease');
  const counts=evidence.counts;
  if(!counts||Object.values(counts).some(value=>!Number.isSafeInteger(value)||value<0)||counts.requestAttempts>100_000||counts.generations>10_000||counts.fixtureRevisions>1_000_000)return stop(stage,'historical_state_unbounded');
  if(evidence.priorState?.attempt2Count!==0||evidence.priorState?.reservedAttemptCount!==0||evidence.priorState?.stagingGenerationCount!==0)return stop(stage,'prior_state_requires_reconciliation');
  if(evidence.modelUiImportCount!==0)return stop(stage,'model_ui_integration_detected');
  if(evidence.rawPayloadStoragePresent!==false)return stop(stage,'raw_payload_storage_detected');
  return safe({ok:true});
}

function pristineFirstAcceptance(evidence,stage){
  if(evidence.counts.requestAttempts!==0||evidence.counts.generations!==0||evidence.counts.fixtureRevisions!==0)return stop(stage,'first_acceptance_history_not_pristine');
  return safe({ok:true});
}

function exactAttendedInventory(inventory,{requireOriginalBytes=false,requirePreviewIdentity=false}={}){
  return inventory.activation===API_FOOTBALL_ATTENDED_DISCOVERY_ACTIVATION&&inventory.databaseIdPlaceholder===false&&inventory.productionBindingProven===true&&
    inventory.workerPresent===true&&inventory.deploymentCount===0&&inventory.configurationExact===true&&inventory.versionIdentityExact===true&&
    inventory.versionInventoryExact===true&&(!requireOriginalBytes||inventory.originalVersionIdentityExact===true)&&
    (!requirePreviewIdentity||inventory.previewUrlIdentityExact===true)&&inventory.routeCount===0&&inventory.customDomainCount===0&&
    inventory.secretBindingPresent===true&&
    JSON.stringify(inventory.secretBindingNames)===JSON.stringify(['API_FOOTBALL_API_KEY','API_FOOTBALL_ATTENDED_TRIGGER_SECRET']);
}

export function classifyCollectorActivationPreflight(evidence,{now}={}){
  const stage=evidence?.stage;
  const allowedStages=[
    COLLECTOR_PREFLIGHT_REPOSITORY_STAGE,COLLECTOR_PREFLIGHT_ATTENDED_STAGE,
    COLLECTOR_PREFLIGHT_PREPARATION_START_STAGE,COLLECTOR_PREFLIGHT_PREPARATION_VERSION_STAGE,
    COLLECTOR_PREFLIGHT_PREPARATION_CLOSEOUT_STAGE
  ];
  if(!allowedStages.includes(stage))return stop('UNKNOWN_STAGE','preflight_stage_invalid');
  const shared=sharedEvidence(evidence,stage,{now});if(!shared.ok)return shared;
  const inventory=evidence.inventory;if(!inventory||inventory.cronCount!==0||inventory.workersDev!==false||inventory.previewUrls!==false||
    typeof inventory.workerPresent!=='boolean'||!Number.isSafeInteger(inventory.deploymentCount)||inventory.deploymentCount<0||
    typeof inventory.secretBindingPresent!=='boolean')return stop(stage,'collector_inventory_unexpected');
  if(stage===COLLECTOR_PREFLIGHT_REPOSITORY_STAGE){
    if(inventory.activation!=='REPOSITORY_ONLY_BLOCKED'||inventory.databaseIdPlaceholder!==true||inventory.workerPresent!==false||
      inventory.deploymentCount!==0||inventory.secretBindingPresent!==false)return stop(stage,'repository_stage_inventory_unexpected');
    return safe({ok:true,stage,classification:COLLECTOR_REPOSITORY_STAGE_READY,secretBindingPresent:false});
  }
  if(stage===COLLECTOR_PREFLIGHT_PREPARATION_START_STAGE){
    if(inventory.activation!=='REPOSITORY_ONLY_BLOCKED'||inventory.databaseIdPlaceholder!==false||inventory.productionBindingProven!==true||
      inventory.workerPresent!==true||inventory.deploymentCount!==0||inventory.configurationExact!==true||
      inventory.originalVersionIdentityExact!==true||inventory.versionInventoryExact!==true||
      inventory.routeCount!==0||inventory.customDomainCount!==0||inventory.secretBindingPresent!==false||
      !Array.isArray(inventory.secretBindingNames)||inventory.secretBindingNames.length!==0)return stop(stage,'preparation_start_inventory_unexpected');
    if(evidence.runtime.credentialState!=='UNPROVISIONED')return stop(stage,'credential_state_unexpected');
    const pristine=pristineFirstAcceptance(evidence,stage);if(!pristine.ok)return pristine;
    return safe({ok:true,stage,classification:COLLECTOR_PREPARATION_START_READY,secretBindingPresent:false});
  }
  if(stage===COLLECTOR_PREFLIGHT_PREPARATION_VERSION_STAGE){
    if(!exactAttendedInventory(inventory,{requireOriginalBytes:true}))return stop(stage,'preparation_version_inventory_unexpected');
    if(evidence.runtime.credentialState!=='UNPROVISIONED')return stop(stage,'credential_state_unexpected');
    const pristine=pristineFirstAcceptance(evidence,stage);if(!pristine.ok)return pristine;
    return safe({ok:true,stage,classification:COLLECTOR_PREPARATION_VERSION_READY,secretBindingPresent:true});
  }
  if(stage===COLLECTOR_PREFLIGHT_PREPARATION_CLOSEOUT_STAGE){
    if(!exactAttendedInventory(inventory,{requireOriginalBytes:true}))return stop(stage,'preparation_closeout_inventory_unexpected');
    if(evidence.runtime.credentialState!=='AVAILABLE')return stop(stage,'credential_state_unexpected');
    const pristine=pristineFirstAcceptance(evidence,stage);if(!pristine.ok)return pristine;
    return safe({ok:true,stage,classification:COLLECTOR_ATTENDED_STAGE_READY,secretBindingPresent:true});
  }
  if(!exactAttendedInventory(inventory,{requirePreviewIdentity:true}))return stop(stage,'attended_stage_inventory_unexpected');
  if(evidence.runtime.credentialState!=='AVAILABLE')return stop(stage,'credential_state_unexpected');
  const pristine=pristineFirstAcceptance(evidence,stage);if(!pristine.ok)return pristine;
  return safe({ok:true,stage,classification:COLLECTOR_ATTENDED_STAGE_READY,secretBindingPresent:true});
}

export async function runCollectorActivationPreflight({readEvidence,stage,now}={}){
  if(typeof readEvidence!=='function')return stop(stage||'UNKNOWN_STAGE','read_authority_unavailable');
  let evidence;try{evidence=await readEvidence(stage);}catch{return stop(stage||'UNKNOWN_STAGE','read_authority_failed');}
  return classifyCollectorActivationPreflight(evidence,{now});
}
