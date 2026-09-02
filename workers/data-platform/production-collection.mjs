import {createHash} from 'node:crypto';
import {createD1RestClient,D1_REST_REQUEST_LIMIT_BYTES} from './d1-rest-client.mjs';
import {buildCommitBatch,buildCompleteUnchangedMutation,buildCurrentHeadsRead,buildProductionGovernanceRead,buildRunRead,buildStartRunMutation} from './official-fpl-d1-rest-plan.mjs';
import {DATA_S2_SCHEMA_VERSION,DATA_S2_SOURCE_REVISION_ID,DATA_S2_TRANSFORM_VERSION,DATA_S2_VALIDATION_VERSION,diffOfficialFplHistory,materialiseOfficialFplChanges,normaliseOfficialFplHistory} from './official-fpl-canonical.mjs';

export const PRODUCTION_COLLECTION_SCHEDULE='17 1 * * *';
export const PRODUCTION_SEASON='2026-27';
export const PRODUCTION_D1_ID='01e2b4f9-313a-4a14-8ce6-86c5aecc50d7';
export const OFFICIAL_FPL_ENDPOINTS=Object.freeze(['https://fantasy.premierleague.com/api/bootstrap-static/','https://fantasy.premierleague.com/api/fixtures/']);
export const MAX_OFFICIAL_RESPONSE_BYTES=8*1024*1024;
export const MAX_D1_ROWS_READ_PER_CYCLE=25000;
export const MAX_D1_ROWS_WRITTEN_PER_CYCLE=40000;
export const MAX_D1_API_CALLS_PER_CYCLE=8;
const fp=value=>createHash('sha256').update(value).digest('hex');
const rows=result=>result.results[0].results??[];
const exactGovernance=row=>Number(row?.migration_version)===2&&row.migration_name==='official_fpl_structured_history'&&row.source_revision_id===DATA_S2_SOURCE_REVISION_ID&&row.schema_version===DATA_S2_SCHEMA_VERSION&&row.rights_classification==='durable_allowed'&&Number(row.retention_allowed)===1&&Number(row.redistribution_allowed)===0&&Number(row.shadow_ingest_allowed)===1&&row.acquisition_status==='approved_internal_shadow_history'&&row.source_key==='official-fpl'&&row.source_kind==='official_fpl';
const runIdFor=value=>`gha-${fp(`${DATA_S2_SOURCE_REVISION_ID}:${value}`).slice(0,40)}`;

export async function runProductionCollection(options){
  const allowed=['accountId','accountFingerprint','databaseId','season','token','scheduledAt','transport','fetchImpl','cryptoImpl'];
  if(!options||Object.keys(options).some(k=>!allowed.includes(k)))throw new Error('production_config_invalid');
  const {accountId,accountFingerprint,databaseId,season,token,transport,fetchImpl,cryptoImpl=globalThis.crypto}=options;
  if(!/^[0-9a-f]{64}$/.test(accountFingerprint||'')||fp(accountId||'')!==accountFingerprint)throw new Error('production_account_fingerprint_mismatch');
  if(databaseId!==PRODUCTION_D1_ID)throw new Error('production_d1_identity_mismatch');
  if(season!==PRODUCTION_SEASON)throw new Error('production_season_mismatch');
  const scheduledAt=new Date(options.scheduledAt).toISOString();
  const client=createD1RestClient({accountId,databaseId,token,transport});let calls=0,read=0,written=0,bytes=0;
  const execute=async plan=>{if(++calls>MAX_D1_API_CALLS_PER_CYCLE)throw new Error('production_api_budget_exceeded');const out=await client.run(plan);read+=out.usage.rowsRead;written+=out.usage.rowsWritten;bytes+=out.requestBytes;if(read>MAX_D1_ROWS_READ_PER_CYCLE||written>MAX_D1_ROWS_WRITTEN_PER_CYCLE||out.requestBytes>D1_REST_REQUEST_LIMIT_BYTES)throw new Error('production_d1_budget_exceeded');return out;};
  const governance=rows(await execute(buildProductionGovernanceRead({sourceRevisionId:DATA_S2_SOURCE_REVISION_ID})));
  if(governance.length!==1||!exactGovernance(governance[0]))throw new Error('production_governance_mismatch');
  const runId=runIdFor(scheduledAt),readRun=()=>execute(buildRunRead({runId,sourceRevisionId:DATA_S2_SOURCE_REVISION_ID}));let existing=rows(await readRun());
  if(existing.length===1&&existing[0].status==='completed')return finish('already_completed',existing[0].records_accepted);
  if(existing.length)throw new Error('production_run_state_ambiguous');
  const start=buildStartRunMutation({runId,sourceRevisionId:DATA_S2_SOURCE_REVISION_ID,startedAt:scheduledAt,safeEndpointClass:'official_fpl_public_core',parserVersion:DATA_S2_VALIDATION_VERSION,transformVersion:DATA_S2_TRANSFORM_VERSION,schemaVersion:DATA_S2_SCHEMA_VERSION});
  try{await execute(start);}catch(error){if(error?.code!=='d1_mutation_outcome_unknown')throw error;existing=rows(await readRun());if(existing.length!==1||existing[0].status!=='started')throw new Error('production_start_ambiguous');}
  const fetched=[];
  for(const endpoint of OFFICIAL_FPL_ENDPOINTS){const response=await fetchImpl(endpoint,{method:'GET',redirect:'error',headers:{Accept:'application/json'}});if(response?.status!==200)throw new Error('official_fpl_http_failed');const body=await response.arrayBuffer();if(body.byteLength>MAX_OFFICIAL_RESPONSE_BYTES)throw new Error('official_fpl_payload_too_large');let json;try{json=JSON.parse(new TextDecoder().decode(body));}catch{throw new Error('official_fpl_json_invalid');}fetched.push(json);}
  const normal=normaliseOfficialFplHistory({bootstrap:fetched[0],fixtures:fetched[1],season,fetchedAt:scheduledAt});
  const previous=rows(await execute(buildCurrentHeadsRead({sourceRevisionId:DATA_S2_SOURCE_REVISION_ID})));const changes=diffOfficialFplHistory(normal.candidates,previous);
  const observations=await materialiseOfficialFplChanges(changes,{runId,sourceRevision:governance[0],fetchedAt:scheduledAt,cryptoImpl});
  const commit=changes.length?buildCommitBatch({entities:normal.entities,previousRows:previous,observations,completedAt:scheduledAt,recordsSeen:normal.candidates.length,runId,sourceRevisionId:DATA_S2_SOURCE_REVISION_ID}):buildCompleteUnchangedMutation({completedAt:scheduledAt,recordsSeen:normal.candidates.length,runId,sourceRevisionId:DATA_S2_SOURCE_REVISION_ID});
  try{await execute(commit);}catch(error){if(error?.code!=='d1_mutation_outcome_unknown')throw error;const reconciled=rows(await readRun());if(reconciled.length!==1||reconciled[0].status!=='completed'||Number(reconciled[0].records_accepted)!==observations.length)throw new Error('production_commit_ambiguous');return finish(changes.length?'changed_reconciled':'unchanged_reconciled',observations.length);}
  return finish(changes.length?(previous.length?'changed':'baseline'):'unchanged',observations.length);
  function finish(result,changed){return Object.freeze({ok:true,result,runId,changed:Number(changed),recordsSeen:Number(existing[0]?.records_seen??0)||undefined,d1:Object.freeze({apiCalls:calls,rowsRead:read,rowsWritten:written,requestBytes:bytes})});}
}
