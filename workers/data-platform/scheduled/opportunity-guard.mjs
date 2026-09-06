// DATA-S2C — the daily routine-collection opportunity guard.
//
// DATA-S2 offers exactly one full Official FPL collection opportunity per UTC day. Until now the
// only thing preventing two collections in one day was that exactly one trigger existed. DATA-S2C
// adds a second unattended execution path — the externally dispatched workflow B — so "one
// opportunity a day" has to become something the repository can actually prove, rather than
// something the trigger count happens to imply.
//
// This module is the whole of that proof, and it is deliberately narrow:
//
//   * it governs ROUTINE COLLECTION ONLY — the scheduled workflow A, the external workflow B and
//     the attended manual workflow C. Resume, migration, reconciliation, EXPLAIN and integrity
//     workflows are NOT part of the daily opportunity: they carry their own owner-input and
//     approval gates and they share the production concurrency group, and folding them into a
//     daily counter would let a read-only integrity check silently cancel a day's collection;
//   * it issues GitHub REST GETs and nothing else — it never dispatches a workflow, never re-runs
//     a job, never cancels anything and never writes to GitHub;
//   * it needs `actions: read` and nothing else. No Cloudflare credential, no D1 credential and
//     no production D1 identifier exists anywhere in this module or its entry point;
//   * every malformed, partial, truncated or unreadable response is AMBIGUOUS. It never fails
//     open, and a run it cannot classify is always treated as a reason to stop.
//
// A run consumes the day's opportunity when its `collect` job exists with any conclusion other
// than `skipped`. A `skipped` collect job is exactly what a run whose credential-free
// repository gate refused looks like from the Actions API, so a gate-only failure correctly leaves
// the opportunity available. A collect job that is queued or in progress carries a null
// conclusion and DOES consume: it is either running or about to, and treating it as free is the
// one direction this guard must never fail in.
//
// The window is the union of two rules. The current UTC day is the primary rule. The trailing six
// hours exists because GitHub schedule delivery has already been observed hours late — the 4
// September acceptance run arrived approximately 3h21m after its nominal minute and the
// 5 September run approximately 4h31m — so a late run created at 23:58 UTC and a punctual run
// created at 00:03 UTC the next day are two collections in about five minutes that a bare
// calendar-day rule would both admit.

export const OPPORTUNITY_GUARD_REPOSITORY='priteshpatel390-del/FPL';
export const OPPORTUNITY_COLLECT_JOB_NAME='collect';
// Six hours closes the UTC-midnight duplicate hole without reaching back into the previous day's
// legitimate opportunity: the nominal cadence is 01:17 UTC, so a trailing window this size can
// only ever see the current day's own late arrivals.
export const OPPORTUNITY_TRAILING_WINDOW_MS=6*60*60*1000;
// Three workflow listings plus the job listings of the runs those return. In a normal day the
// listings return zero, one or two runs, so the bound is generous; exceeding it is not a licence
// to keep reading, it is an ambiguity.
export const OPPORTUNITY_GUARD_MAX_READS=12;

export const AUTOMATIC_COLLECTION='automatic';
export const OWNER_COLLECTION='owner';

// The exact repository files this guard governs, each with the identifier the Actions API accepts
// for it. Both are pinned: a test proves the repository files exist, and the API identifier can
// never drift away from the file the repository actually holds.
export const ROUTINE_COLLECTION_WORKFLOWS=Object.freeze([
  Object.freeze({path:'.github/workflows/data-s2-production-scheduled.yml',
    file:'data-s2-production-scheduled.yml',kind:AUTOMATIC_COLLECTION}),
  Object.freeze({path:'.github/workflows/data-s2-production-external.yml',
    file:'data-s2-production-external.yml',kind:AUTOMATIC_COLLECTION}),
  Object.freeze({path:'.github/workflows/data-s2-production-collection.yml',
    file:'data-s2-production-collection.yml',kind:OWNER_COLLECTION})
]);

export const OPPORTUNITY_AVAILABLE='OPPORTUNITY_AVAILABLE';
export const OPPORTUNITY_CONSUMED='OPPORTUNITY_CONSUMED';
export const AMBIGUOUS_REQUIRES_OWNER_ATTENTION='AMBIGUOUS_REQUIRES_OWNER_ATTENTION';

// Closed reason set. Nothing outside it is ever reported, so no run id, URL, header, token or
// account identifier can reach a log through this module.
export const OPPORTUNITY_REASONS=Object.freeze(['opportunity_available','automatic_collection_consumed',
  'owner_collection_today','guard_input_invalid','guard_read_failed','guard_read_bound_exhausted']);

const frozen=(classification,reason)=>{
  if(!OPPORTUNITY_REASONS.includes(reason))throw new Error('opportunity_reason_invalid');
  return Object.freeze({classification,reason});
};
const ambiguous=reason=>frozen(AMBIGUOUS_REQUIRES_OWNER_ATTENTION,reason);

const safeCount=value=>Number.isSafeInteger(value)&&value>=0;
const runIdValid=value=>Number.isSafeInteger(value)&&value>0;

// A timestamp is only usable when it round-trips: GitHub emits `2026-09-06T01:17:04Z`, and
// anything that does not parse to a finite instant is an ambiguity rather than a zero.
const instant=value=>{
  if(typeof value!=='string'||value==='')return null;
  const ms=Date.parse(value);
  return Number.isFinite(ms)?ms:null;
};

// The union of the two rules, expressed once: the earliest instant either rule admits.
export function opportunityWindowStart(now){
  if(!Number.isSafeInteger(now)||now<0)throw new Error('opportunity_now_invalid');
  const day=new Date(now);
  const dayStart=Date.UTC(day.getUTCFullYear(),day.getUTCMonth(),day.getUTCDate());
  return Math.min(dayStart,now-OPPORTUNITY_TRAILING_WINDOW_MS);
}

// The UTC date the Actions `created` filter is given, so the provider itself bounds the listing
// rather than this module trusting an unbounded page to be ordered.
export function opportunityWindowDate(now){
  return new Date(opportunityWindowStart(now)).toISOString().slice(0,10);
}

export function workflowRunsRequest(workflowFile,token,now){
  if(!ROUTINE_COLLECTION_WORKFLOWS.some(entry=>entry.file===workflowFile))
    throw new Error('opportunity_workflow_unknown');
  if(typeof token!=='string'||!token)throw new Error('opportunity_token_missing');
  const since=encodeURIComponent(`>=${opportunityWindowDate(now)}`);
  return Object.freeze({
    url:`https://api.github.com/repos/${OPPORTUNITY_GUARD_REPOSITORY}/actions/workflows/${workflowFile}/runs`
      +`?per_page=100&exclude_pull_requests=true&created=${since}`,
    init:Object.freeze({method:'GET',headers:Object.freeze({
      authorization:`Bearer ${token}`,accept:'application/vnd.github+json',
      'x-github-api-version':'2022-11-28','user-agent':'teamsheet-data-s2-opportunity-guard'})})
  });
}

export function runJobsRequest(runId,token){
  if(!runIdValid(runId))throw new Error('opportunity_run_id_invalid');
  if(typeof token!=='string'||!token)throw new Error('opportunity_token_missing');
  return Object.freeze({
    url:`https://api.github.com/repos/${OPPORTUNITY_GUARD_REPOSITORY}/actions/runs/${runId}/jobs`
      +'?per_page=100&filter=latest',
    init:Object.freeze({method:'GET',headers:Object.freeze({
      authorization:`Bearer ${token}`,accept:'application/vnd.github+json',
      'x-github-api-version':'2022-11-28','user-agent':'teamsheet-data-s2-opportunity-guard'})})
  });
}

// The pure classifier. `workflows` is keyed by the governed repository path and carries only the
// minimum decoded metadata: the provider's own total for the filtered listing, and for each run
// its id, its creation instant and its job names and conclusions.
export function classifyOpportunity({workflows,now,selfRunId=null}){
  if(!Number.isSafeInteger(now)||now<0)return ambiguous('guard_input_invalid');
  if(selfRunId!==null&&!runIdValid(selfRunId))return ambiguous('guard_input_invalid');
  if(workflows===null||typeof workflows!=='object'||Array.isArray(workflows))
    return ambiguous('guard_input_invalid');
  const governed=ROUTINE_COLLECTION_WORKFLOWS.map(entry=>entry.path);
  const supplied=Object.keys(workflows);
  if(supplied.length!==governed.length||!governed.every(path=>supplied.includes(path)))
    return ambiguous('guard_input_invalid');

  const windowStart=opportunityWindowStart(now);
  let consumed=null;
  for(const entry of ROUTINE_COLLECTION_WORKFLOWS){
    const listing=workflows[entry.path];
    if(listing===null||typeof listing!=='object'||Array.isArray(listing))
      return ambiguous('guard_input_invalid');
    const {totalCount,runs}=listing;
    if(!safeCount(totalCount)||!Array.isArray(runs))return ambiguous('guard_input_invalid');
    // A listing that returned fewer rows than the provider counted is truncated, and a truncated
    // listing cannot prove the day is free.
    if(totalCount!==runs.length)return ambiguous('guard_input_invalid');
    for(const run of runs){
      if(run===null||typeof run!=='object'||Array.isArray(run))return ambiguous('guard_input_invalid');
      if(!runIdValid(run.id))return ambiguous('guard_input_invalid');
      const created=instant(run.createdAt);
      if(created===null)return ambiguous('guard_input_invalid');
      if(!Array.isArray(run.jobs))return ambiguous('guard_input_invalid');
      for(const job of run.jobs){
        if(job===null||typeof job!=='object'||Array.isArray(job))return ambiguous('guard_input_invalid');
        if(typeof job.name!=='string')return ambiguous('guard_input_invalid');
        if(job.conclusion!==null&&typeof job.conclusion!=='string')return ambiguous('guard_input_invalid');
      }
      // This run is the one asking. It can never consume its own opportunity.
      if(selfRunId!==null&&run.id===selfRunId)continue;
      if(created<windowStart)continue;
      const consumes=run.jobs.some(job=>job.name===OPPORTUNITY_COLLECT_JOB_NAME&&job.conclusion!=='skipped');
      if(consumes&&consumed===null)consumed=entry.kind;
    }
  }
  if(consumed===OWNER_COLLECTION)return frozen(OPPORTUNITY_CONSUMED,'owner_collection_today');
  if(consumed===AUTOMATIC_COLLECTION)return frozen(OPPORTUNITY_CONSUMED,'automatic_collection_consumed');
  return frozen(OPPORTUNITY_AVAILABLE,'opportunity_available');
}

// Strict decoders. Anything the provider returns that is not exactly the shape this guard reads
// is an ambiguity, never a best-effort interpretation.
const decodeRuns=body=>{
  if(body===null||typeof body!=='object'||Array.isArray(body))return null;
  if(!safeCount(body.total_count)||!Array.isArray(body.workflow_runs))return null;
  if(body.total_count!==body.workflow_runs.length)return null;
  const runs=[];
  for(const row of body.workflow_runs){
    if(row===null||typeof row!=='object'||Array.isArray(row))return null;
    if(!runIdValid(row.id)||instant(row.created_at)===null)return null;
    runs.push({id:row.id,createdAt:row.created_at});
  }
  return {totalCount:body.total_count,runs};
};

const decodeJobs=body=>{
  if(body===null||typeof body!=='object'||Array.isArray(body))return null;
  if(!safeCount(body.total_count)||!Array.isArray(body.jobs))return null;
  if(body.total_count!==body.jobs.length)return null;
  const jobs=[];
  for(const row of body.jobs){
    if(row===null||typeof row!=='object'||Array.isArray(row))return null;
    if(typeof row.name!=='string')return null;
    if(row.conclusion!==null&&typeof row.conclusion!=='string')return null;
    jobs.push({name:row.name,conclusion:row.conclusion??null});
  }
  return jobs;
};

// Issues the bounded read set and feeds the pure classifier. Every failure — a non-200, a body
// that will not decode, an exhausted read bound, a transport error — is AMBIGUOUS, and no part of
// the underlying error is carried out.
export async function resolveOpportunity({token,fetchImpl,now,selfRunId=null,
  maxReads=OPPORTUNITY_GUARD_MAX_READS}){
  if(typeof fetchImpl!=='function')return ambiguous('guard_input_invalid');
  if(typeof token!=='string'||!token)return ambiguous('guard_input_invalid');
  if(!Number.isSafeInteger(now)||now<0)return ambiguous('guard_input_invalid');
  if(selfRunId!==null&&!runIdValid(selfRunId))return ambiguous('guard_input_invalid');
  if(!Number.isSafeInteger(maxReads)||maxReads<1||maxReads>OPPORTUNITY_GUARD_MAX_READS)
    return ambiguous('guard_input_invalid');

  let reads=0;
  const read=async request=>{
    if(reads>=maxReads)return 'bound';
    reads+=1;
    let response;
    try{response=await fetchImpl(request.url,request.init);}catch{return null;}
    if(response?.status!==200)return null;
    try{return await response.json();}catch{return null;}
  };

  const workflows={};
  for(const entry of ROUTINE_COLLECTION_WORKFLOWS){
    const body=await read(workflowRunsRequest(entry.file,token,now));
    if(body==='bound')return ambiguous('guard_read_bound_exhausted');
    const listing=body===null?null:decodeRuns(body);
    if(listing===null)return ambiguous('guard_read_failed');
    workflows[entry.path]={totalCount:listing.totalCount,runs:[]};
    for(const run of listing.runs){
      // The asking run never needs its own job listing, and spending a read on it would only
      // narrow the bound available to the runs that can actually consume the day.
      if(selfRunId!==null&&run.id===selfRunId){workflows[entry.path].runs.push({...run,jobs:[]});continue;}
      const jobsBody=await read(runJobsRequest(run.id,token));
      if(jobsBody==='bound')return ambiguous('guard_read_bound_exhausted');
      const jobs=jobsBody===null?null:decodeJobs(jobsBody);
      if(jobs===null)return ambiguous('guard_read_failed');
      workflows[entry.path].runs.push({...run,jobs});
    }
  }
  return classifyOpportunity({workflows,now,selfRunId});
}
