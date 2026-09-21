import {API_FOOTBALL_MAX_DISCOVERY_GENERATION_ROWS} from './runtime-contracts.mjs';

export const DISCOVERY_COMPETITION_COUNT=5;
export const DISCOVERY_MAX_HTTP_ATTEMPTS=5;
export const DISCOVERY_PERSISTENCE_CHUNK_ROWS=1_250;
// Five responses may fragment 2,500 admitted rows across as many as six fixed 1,250-row chunks.
export const DISCOVERY_MAX_PERSISTENCE_CHUNKS=6;
export const DISCOVERY_PERSISTENCE_STATEMENTS_PER_CHUNK=3;
export const DISCOVERY_MAX_CHUNK_JSON_BYTES=1_500_000;
export const DISCOVERY_MAX_FIXTURE_STATEMENTS=DISCOVERY_MAX_PERSISTENCE_CHUNKS*DISCOVERY_PERSISTENCE_STATEMENTS_PER_CHUNK;
export const DISCOVERY_MAX_CONTROL_MUTATION_STATEMENTS=25;
export const DISCOVERY_MAX_MUTATION_STATEMENTS=DISCOVERY_MAX_FIXTURE_STATEMENTS+DISCOVERY_MAX_CONTROL_MUTATION_STATEMENTS;
export const DISCOVERY_MAX_READ_STATEMENTS=6;
export const DISCOVERY_MAX_D1_STATEMENTS=DISCOVERY_MAX_MUTATION_STATEMENTS+DISCOVERY_MAX_READ_STATEMENTS;
export const DISCOVERY_MAX_FIXTURE_ROWS_WRITTEN=API_FOOTBALL_MAX_DISCOVERY_GENERATION_ROWS*3;
export const DISCOVERY_MAX_CONTROL_ROWS_WRITTEN=25;
export const DISCOVERY_MAX_D1_ROWS_WRITTEN=DISCOVERY_MAX_FIXTURE_ROWS_WRITTEN+DISCOVERY_MAX_CONTROL_ROWS_WRITTEN;

const safe=value=>Object.freeze(value);
const fail=reason=>safe({ok:false,reason});

export function classifyPriorAttempt(attempt,{now}={}){
  if(!attempt)return safe({ok:true,action:'RESERVE_FIRST_ATTEMPT'});
  if(Number(attempt.attempt_number)!==1)return fail('unexpected_attempt_number');
  if(attempt.outcome==='SUCCEEDED')return fail('succeeded_attempt_requires_reconciliation');
  if(attempt.outcome==='RESERVED')return fail(Date.parse(attempt.lease_expires_at)>Date.parse(now)?'request_lease_busy':'expired_reservation_consumed');
  return fail('prior_attempt_consumed');
}

export function enforceGenerationCeiling(currentRows,nextRows){
  if(!Number.isInteger(currentRows)||!Number.isInteger(nextRows)||currentRows<0||nextRows<0)return fail('generation_row_count_invalid');
  if(currentRows+nextRows>API_FOOTBALL_MAX_DISCOVERY_GENERATION_ROWS)return fail('generation_row_ceiling_exceeded');
  return safe({ok:true,totalRows:currentRows+nextRows});
}

export async function runOneShotDiscoveryGeneration({requests,repository,transport,validate,now,clock=()=>new Date().toISOString(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
  if(!Array.isArray(requests)||requests.length!==DISCOVERY_COMPETITION_COUNT||new Set(requests.map(row=>String(row.search?.league))).size!==DISCOVERY_COMPETITION_COUNT)return fail('one_shot_plan_invalid');
  if(!repository||typeof transport!=='function'||typeof validate!=='function')return fail('execution_dependencies_invalid');
  const generation=await repository.createStaging({requests,now});if(!generation?.ok)return generation||fail('generation_stage_failed');
  let totalRows=0,attempts=0;
  for(const request of requests){
    const admittedAt=clock();
    const prior=classifyPriorAttempt(await repository.readAttempt(request.attemptId),{now:admittedAt});
    if(!prior.ok){await repository.failGeneration(generation.generationId,prior.reason,clock());return prior;}
    const reserved=await repository.reserve(request,generation.generationId,admittedAt);if(!reserved?.ok){await repository.failGeneration(generation.generationId,reserved?.reason||'reservation_failed',clock());return reserved;}
    attempts+=1;
    if(attempts>DISCOVERY_MAX_HTTP_ATTEMPTS){await repository.failGeneration(generation.generationId,'attempt_ceiling_exceeded',clock());return fail('attempt_ceiling_exceeded');}
    const transported=await transport(request);
    if(!transported?.ok){await repository.completeFailure(request,transported?.completion,clock());await repository.failGeneration(generation.generationId,transported?.reason||'request_failed',clock());return transported||fail('request_failed');}
    const semantic=await validate(transported.payload,request,transported.fetchedAt);
    if(!semantic?.ok){await repository.completeFailure(request,{...transported.completion,outcome:'SCHEMA_FAILURE'},clock());await repository.failGeneration(generation.generationId,semantic?.reason||'provider_schema_invalid',clock());return semantic||fail('provider_schema_invalid');}
    const ceiling=enforceGenerationCeiling(totalRows,semantic.fixtures.length);
    if(!ceiling.ok){await repository.completeFailure(request,{...transported.completion,outcome:'SCHEMA_FAILURE'},clock());await repository.failGeneration(generation.generationId,ceiling.reason,clock());return ceiling;}
    const persisted=await repository.persistValidated(request,generation.generationId,semantic.fixtures,clock());
    if(!persisted?.ok){await repository.failGeneration(generation.generationId,'persistence_uncertain',clock());return fail('persistence_uncertain');}
    const completed=await repository.completeSuccess(request,transported.completion,clock());
    if(!completed?.ok){await repository.failGeneration(generation.generationId,'attempt_completion_uncertain',clock());return fail('attempt_completion_uncertain');}
    totalRows=ceiling.totalRows;
    if(attempts<requests.length)await sleep(1_000);
  }
  const committed=await repository.commitGeneration(generation.generationId,{competitionCount:5,fixtureCount:totalRows,now:clock()});
  return committed?.ok?safe({ok:true,generationId:generation.generationId,attempts,fixtureCount:totalRows,operations:repository.operationSnapshot?.()||null}):fail('generation_commit_failed');
}
