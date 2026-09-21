import {API_FOOTBALL_MAX_DISCOVERY_GENERATION_ROWS} from './runtime-contracts.mjs';

export const DISCOVERY_COMPETITION_COUNT=5;
export const DISCOVERY_MAX_HTTP_ATTEMPTS=5;
// Worst case per fixture: identity upsert + current-revision read + revision insert + membership insert.
export const DISCOVERY_MAX_FIXTURE_STATEMENTS=API_FOOTBALL_MAX_DISCOVERY_GENERATION_ROWS*4;
// Generation/run creation, two writes for each reservation and completion, generation update and head.
export const DISCOVERY_MAX_CONTROL_STATEMENTS=24;
export const DISCOVERY_MAX_D1_STATEMENTS=DISCOVERY_MAX_FIXTURE_STATEMENTS+DISCOVERY_MAX_CONTROL_STATEMENTS;
export const DISCOVERY_MAX_FIXTURE_ROWS_WRITTEN=API_FOOTBALL_MAX_DISCOVERY_GENERATION_ROWS*3;
export const DISCOVERY_MAX_D1_ROWS_WRITTEN=DISCOVERY_MAX_FIXTURE_ROWS_WRITTEN+DISCOVERY_MAX_CONTROL_STATEMENTS;

const safe=value=>Object.freeze(value);
const fail=reason=>safe({ok:false,reason});

export function classifyPriorAttempt(attempt,{now}={}){
  if(!attempt)return safe({ok:true,action:'RESERVE_FIRST_ATTEMPT'});
  if(attempt.attempt_number!==1)return fail('unexpected_attempt_number');
  if(attempt.outcome==='SUCCEEDED')return fail('succeeded_attempt_requires_reconciliation');
  if(attempt.outcome==='RESERVED')return fail(Date.parse(attempt.lease_expires_at)>Date.parse(now)?'request_lease_busy':'expired_reservation_consumed');
  return fail('prior_attempt_consumed');
}

export function enforceGenerationCeiling(currentRows,nextRows){
  if(!Number.isInteger(currentRows)||!Number.isInteger(nextRows)||currentRows<0||nextRows<0)return fail('generation_row_count_invalid');
  if(currentRows+nextRows>API_FOOTBALL_MAX_DISCOVERY_GENERATION_ROWS)return fail('generation_row_ceiling_exceeded');
  return safe({ok:true,totalRows:currentRows+nextRows});
}

export async function runOneShotDiscoveryGeneration({requests,repository,execute,now}={}){
  if(!Array.isArray(requests)||requests.length!==DISCOVERY_COMPETITION_COUNT||new Set(requests.map(row=>String(row.search?.league))).size!==DISCOVERY_COMPETITION_COUNT)return fail('one_shot_plan_invalid');
  if(!repository||typeof execute!=='function')return fail('execution_dependencies_invalid');
  const generation=await repository.createStaging({requests,now});if(!generation?.ok)return generation||fail('generation_stage_failed');
  let totalRows=0,attempts=0;
  for(const request of requests){
    const prior=classifyPriorAttempt(await repository.readAttempt(request.attemptId),{now});
    if(!prior.ok){await repository.failGeneration(generation.generationId,prior.reason,now);return prior;}
    const reserved=await repository.reserve(request,generation.generationId,now);if(!reserved?.ok){await repository.failGeneration(generation.generationId,reserved?.reason||'reservation_failed',now);return reserved;}
    attempts+=1;
    if(attempts>DISCOVERY_MAX_HTTP_ATTEMPTS){await repository.failGeneration(generation.generationId,'attempt_ceiling_exceeded',now);return fail('attempt_ceiling_exceeded');}
    const result=await execute(request);
    if(!result?.ok){await repository.completeFailure(request,result?.completion||{outcome:'SCHEMA_FAILURE'},now);await repository.failGeneration(generation.generationId,result?.reason||'request_failed',now);return result||fail('request_failed');}
    const ceiling=enforceGenerationCeiling(totalRows,result.fixtures.length);
    if(!ceiling.ok){await repository.completeFailure(request,{outcome:'SCHEMA_FAILURE'},now);await repository.failGeneration(generation.generationId,ceiling.reason,now);return ceiling;}
    const persisted=await repository.persistValidated(request,generation.generationId,result.fixtures,result.completion,now);
    if(!persisted?.ok){await repository.failGeneration(generation.generationId,'persistence_uncertain',now);return fail('persistence_uncertain');}
    totalRows=ceiling.totalRows;
  }
  const committed=await repository.commitGeneration(generation.generationId,{competitionCount:5,fixtureCount:totalRows,now});
  return committed?.ok?safe({ok:true,generationId:generation.generationId,attempts,fixtureCount:totalRows}):fail('generation_commit_failed');
}
