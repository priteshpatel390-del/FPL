import {validatePostState} from '../phase1/migrate-0002.mjs';

// Deployment run 33433195713 promoted the redirect-compatible candidate.
// Deployment IDs are response identities, so the read-only closeout records the
// current ID rather than pretending the pre-promotion ID is still authoritative.
export const EXPECTED_ACTIVE_DEPLOYMENT_ID=null;
export const EXPECTED_ACTIVE_VERSION_ID='222e62d5-9979-468d-9c54-b97f903d58f6';
export const EXPECTED_ROLLBACK_VERSION_ID='733093ef-e01f-43a8-828a-0c8c67e7626f';
export const RETAINED_OLDER_VERSION_ID='3a2b065a-6527-4887-9bf8-b08e82e81133';
export const EXPECTED_D1_DATABASE_ID='01e2b4f9-313a-4a14-8ce6-86c5aecc50d7';
export const EXPECTED_CRON='*/30 * * * *';
export const KNOWN_REDIRECT_RUNTIME_ERROR_CLASS='Invalid_redirect_value__must_be_one_of__follow__or__manual____er';

export const POST_ACTIVATION_RUNS_QUERY=`SELECT run_id, source_revision_id, run_type, mode, status,
  records_seen, records_accepted, records_quarantined, records_rejected, error_class
  FROM ingestion_runs ORDER BY started_at, run_id`;

const numeric=value=>{const number=Number(value);if(!Number.isFinite(number))throw new Error('phase4b_d1_numeric_contract_invalid');return number;};
const RUN_STRING_FIELDS=Object.freeze(['source_revision_id','run_type','mode','status','error_class']);
const RUN_COUNTER_FIELDS=Object.freeze(['records_seen','records_accepted','records_quarantined','records_rejected']);
const safeString=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(value)?value:'[invalid]';
const safeCounter=value=>Number.isFinite(Number(value))?Number(value):'[invalid]';

export function isKnownPreRemediationFailure(errorClass){
  return errorClass===KNOWN_REDIRECT_RUNTIME_ERROR_CLASS;
}

export function failedRunDiagnostic(run,index){
  const expected={source_revision_id:'official-fpl-r1',run_type:'official_fpl_structured_history',mode:'shadow_only',status:'failed',records_seen:0,records_accepted:0,records_quarantined:0,records_rejected:0,error_class:KNOWN_REDIRECT_RUNTIME_ERROR_CLASS};
  const actual={};
  for(const field of RUN_STRING_FIELDS)actual[field]=safeString(run?.[field]);
  for(const field of RUN_COUNTER_FIELDS)actual[field]=safeCounter(run?.[field]);
  const mismatches=Object.keys(expected).filter(field=>actual[field]!==expected[field]);
  return {index:Number.isSafeInteger(index)&&index>=0?index:'[invalid]',mismatches,actual};
}

function failedRunMatches(run){
  return run?.source_revision_id==='official-fpl-r1'&&run?.run_type==='official_fpl_structured_history'&&run?.mode==='shadow_only'&&run?.status==='failed'&&RUN_COUNTER_FIELDS.every(field=>Number.isFinite(Number(run?.[field]))&&Number(run[field])===0)&&isKnownPreRemediationFailure(run?.error_class);
}

export function validateExactCron(rows){
  if(!Array.isArray(rows)||rows.length!==1||rows[0]?.cron!==EXPECTED_CRON)throw new Error('phase4b_cron_drift');
  return [EXPECTED_CRON];
}

export function validatePostActivationState({migrations,sourceRows,revisionRows,counts,official,runs}){
  validatePostState({migrations,sourceRows,revisionRows,counts:{...counts,ingestion_runs:0,shadow_observations:0,observation_heads:0,canonical_entities:0},official:{...official,ingestion_runs:0,shadow_observations:0,observation_heads:0}});
  const runCount=numeric(counts?.ingestion_runs),officialRunCount=numeric(official?.ingestion_runs);
  if(!Array.isArray(runs)||runs.length!==runCount||officialRunCount!==runCount)throw new Error('phase4b_ingestion_run_count_contradiction');
  if(runCount<2)throw new Error('phase4b_known_failed_history_missing');
  const failures=runs.filter(run=>run?.status==='failed');
  const completed=runs.filter(run=>run?.status==='completed');
  for(const [index,run] of failures.entries())if(!failedRunMatches(run))throw new Error(`phase4b_unknown_failed_run_contract diagnostic=${JSON.stringify(failedRunDiagnostic(run,index))}`);
  if(failures.length<2)throw new Error('phase4b_known_failed_history_missing');
  if(completed.length<1)throw new Error('phase4b_completed_baseline_missing');
  for(const run of completed){
    if(run?.source_revision_id!=='official-fpl-r1'||run?.run_type!=='official_fpl_structured_history'||run?.mode!=='shadow_only'||run?.error_class!==null)throw new Error('phase4b_completed_run_contract_invalid');
    if(numeric(run.records_seen)<=0||numeric(run.records_accepted)<0||numeric(run.records_accepted)>numeric(run.records_seen)||numeric(run.records_quarantined)!==0||numeric(run.records_rejected)!==0)throw new Error('phase4b_completed_run_contract_invalid');
  }
  const accepted=completed.reduce((sum,run)=>sum+numeric(run.records_accepted),0);
  if(numeric(counts?.shadow_observations)!==accepted||numeric(official?.shadow_observations)!==accepted)throw new Error('phase4b_observation_count_contradiction');
  const heads=numeric(counts?.observation_heads);
  if(heads<=0||heads>accepted||numeric(official?.observation_heads)!==heads)throw new Error('phase4b_head_count_contradiction');
  return true;
}
