import {validatePostState} from '../phase1/migrate-0002.mjs';

export const EXPECTED_ACTIVE_DEPLOYMENT_ID='06135b20-2508-4046-a21d-143077149825';
export const EXPECTED_ACTIVE_VERSION_ID='733093ef-e01f-43a8-828a-0c8c67e7626f';
export const EXPECTED_ROLLBACK_VERSION_ID=EXPECTED_ACTIVE_VERSION_ID;
export const RETAINED_OLDER_VERSION_ID='3a2b065a-6527-4887-9bf8-b08e82e81133';
export const EXPECTED_D1_DATABASE_ID='01e2b4f9-313a-4a14-8ce6-86c5aecc50d7';
export const EXPECTED_CRON='*/30 * * * *';
export const KNOWN_REDIRECT_RUNTIME_ERROR_CLASS='Invalid_redirect_value__must_be_one_of__follow__or__manual_';

export const POST_ACTIVATION_RUNS_QUERY=`SELECT run_id, source_revision_id, run_type, mode, status,
  records_seen, records_accepted, records_quarantined, records_rejected, error_class
  FROM ingestion_runs ORDER BY started_at, run_id`;

const numeric=value=>{const number=Number(value);if(!Number.isFinite(number))throw new Error('phase4b_d1_numeric_contract_invalid');return number;};

export function isKnownPreRemediationFailure(errorClass){
  return errorClass===KNOWN_REDIRECT_RUNTIME_ERROR_CLASS;
}

export function validateExactCron(rows){
  if(!Array.isArray(rows)||rows.length!==1||rows[0]?.cron!==EXPECTED_CRON)throw new Error('phase4b_cron_drift');
  return [EXPECTED_CRON];
}

export function validatePostActivationState({migrations,sourceRows,revisionRows,counts,official,runs}){
  validatePostState({migrations,sourceRows,revisionRows,counts:{...counts,ingestion_runs:0},official:{...official,ingestion_runs:0}});
  if(numeric(counts?.shadow_observations)!==0||numeric(counts?.observation_heads)!==0||numeric(official?.shadow_observations)!==0||numeric(official?.observation_heads)!==0)throw new Error('phase4b_partial_accepted_history');
  const runCount=numeric(counts?.ingestion_runs),officialRunCount=numeric(official?.ingestion_runs);
  if(!Array.isArray(runs)||runs.length!==runCount||officialRunCount!==runCount)throw new Error('phase4b_ingestion_run_count_contradiction');
  if(runCount<2)throw new Error('phase4b_known_failed_history_missing');
  for(const run of runs){
    if(run?.source_revision_id!=='official-fpl-r1'||run?.run_type!=='official_fpl_structured_history'||run?.mode!=='shadow_only'||run?.status!=='failed'||numeric(run.records_seen)!==0||numeric(run.records_accepted)!==0||numeric(run.records_quarantined)!==0||numeric(run.records_rejected)!==0||!isKnownPreRemediationFailure(run.error_class))throw new Error('phase4b_unknown_failed_run_contract');
  }
  return true;
}
