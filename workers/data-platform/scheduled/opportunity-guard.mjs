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
// A run consumes the day's opportunity when a `collect` job of ANY of its attempts exists with any
// conclusion other than `skipped`. A `skipped` collect job is exactly what a run whose
// credential-free repository gate refused looks like from the Actions API, so a gate-only failure
// correctly leaves the opportunity available. A collect job that is queued or in progress carries a
// null conclusion and DOES consume: it is either running or about to, and treating it as free is
// the one direction this guard must never fail in.
//
// EVERY ATTEMPT IS INSPECTED, not only the latest. The jobs listing is requested with
// `filter=all`, because `filter=latest` returns only the most recent execution of each job and a
// re-run would then hide a real collection: attempt 1 reaches `collect` and mutates production,
// somebody later re-runs all jobs, attempt 2's gate refuses, attempt 2's `collect` is `skipped`,
// and a `latest` view would report the day as free. A newer skipped attempt therefore never erases
// an older started one — each attempt's `collect` is separate evidence, and any one of them
// consumes.
//
// THE WINDOW IS MEASURED FROM WHEN `collect` STARTED, never from when GitHub created the run
// object. A run can be created and then wait — on GitHub, on environment admission, or behind the
// shared production concurrency group — for a long time before its collect job begins, so a run
// created at 23:50 UTC whose collect starts at 00:10 UTC performed its collection on the following
// UTC day. Judging that by `created_at` would call the collection stale and admit a second one.
// A non-skipped `collect` whose start instant cannot be established, or whose start instant
// contradicts its own run's creation or the current clock, is AMBIGUOUS rather than assumed.
//
// The window is the union of two rules. The current UTC day is the primary rule. The trailing six
// hours exists because GitHub schedule delivery has already been observed hours late — the 4
// September acceptance run arrived approximately 3h21m after its nominal minute, the 5 September
// run approximately 4h31m and the 6 September run approximately 4h44m — so a collection starting
// at 23:58 UTC and another starting at 00:03 UTC the next day are two collections in about five
// minutes that a bare calendar-day rule would both admit.
//
// CANDIDATE DISCOVERY AND THE CONSUMPTION DECISION ARE TWO DIFFERENT WINDOWS, and conflating them
// is a correctness bug rather than a tidiness one. The consumption decision above is made from
// `collect.started_at`. The Actions API, however, can only filter a run listing by the run's own
// `created_at`, so asking it for runs created inside the consumption window omits exactly the run
// this guard most needs: one created at 23:50 whose `collect` started at 00:10 is invisible to a
// `created>=` filter dated on the new day, and the classifier never sees the collection it would
// have correctly refused. Discovery therefore uses its own, deliberately wider, provider-justified
// lookback, and the classifier still decides on `collect.started_at` alone. Discovery may return
// runs that cannot consume; it must never omit a run that could.
//
// ONLY THE FIRST ATTEMPT OF A RUN CAN CONSUME THE DAY. The shared production entry point refuses
// every attempt after the first — `workflow_retry_forbidden` — before it resolves any production
// identity and before it reaches the collector, so a re-run cannot fetch Official FPL, cannot reach
// D1 and cannot mutate production. That repository invariant, pinned by a permanent structural
// regression over the entry point's own source order, is what makes later attempts harmless, and it
// is also what bounds candidate discovery: discovery only has to cover how long an ORIGINAL attempt
// can wait before its `collect` begins. `filter=all` stays load-bearing, because a later attempt
// must never be allowed to hide attempt 1's evidence — but a later attempt is never evidence of a
// collection itself. A later attempt reporting a SUCCESSFUL `collect` contradicts that invariant
// outright, and impossible state fails closed rather than being read in either direction.
//
// THE CANDIDATE LISTING IS PAGINATED, and bounded twice over. Workflow B gains three dispatch
// opportunities a day under Package C, so a 35-day discovery horizon holds well over one page of
// candidate runs and a single page would silently omit the run that collected. Pagination is a
// fixed, non-recursive sequence of explicitly numbered page reads reconciled against the provider's
// own `total_count`, spending the same shared read budget as every other request. Ordering is never
// relied on; an inconsistent count, a short or over-full page or a duplicated run is an ambiguity;
// and exceeding either the page cap or the read bound stops the run.

export const OPPORTUNITY_GUARD_REPOSITORY='priteshpatel390-del/FPL';
export const OPPORTUNITY_COLLECT_JOB_NAME='collect';
// Six hours closes the UTC-midnight duplicate hole without reaching back into the previous day's
// legitimate opportunity: the nominal cadence is 01:17 UTC, so a trailing window this size can
// only ever see the current day's own late arrivals.
export const OPPORTUNITY_TRAILING_WINDOW_MS=6*60*60*1000;
// Every GitHub request the guard issues — each candidate-listing page and each run's job listing —
// spends one of these. Exceeding it is not a licence to keep reading, it is an ambiguity.
//
// This is a HARD CAP, not a target, and the normal path exits far below it. The budget it has to
// cover is the steady state of the overlap period, when workflow A asks once a day and workflow B
// asks three times a day: across the 35-day discovery horizon that is about 35 A runs and about 105
// B runs, so about 140 job listings plus about four listing pages — roughly 144 requests — leaving
// about 56 for attended workflow C runs, additional historical routine runs and page-shape
// variance. That is a budget, never a proof: a pathological history still exceeds it, and exceeding
// it still refuses the collection rather than admitting an unexamined candidate.
export const OPPORTUNITY_GUARD_MAX_READS=200;

// One candidate-listing page carries at most this many runs, and one workflow's listing is read for
// at most this many pages. The page cap is a second, independent bound on the same read: ten pages
// is 1,000 candidate runs inside a 35-day window, which no governed cadence reaches, and hitting it
// stops the run rather than paging on.
export const WORKFLOW_RUNS_PAGE_SIZE=100;
export const MAX_WORKFLOW_RUN_PAGES=10;

// The candidate-discovery lookback, derived from a first-party GitHub Actions limit rather than
// chosen. One documented limit bounds how long after a workflow run is created its ORIGINAL
// attempt's `collect` can still begin:
//
//   * workflow run time — "35 days / workflow run ... If a workflow run reaches this limit, the
//     workflow run is cancelled. This period includes execution duration, and time spent on waiting
//     and approval."
//
// Environment approval waiting is already inside that limit ("A workflow may wait for up to 30 days
// on environment approvals"), so it adds nothing to the horizon.
//
// GitHub's 30-day re-run eligibility is DELIBERATELY NOT part of this bound, and chaining the two
// into 65 days would be conservatism bought with reads the guard needs elsewhere. Re-run
// eligibility would only matter if a re-run could consume the day, and none can: the shared
// production entry point throws `workflow_retry_forbidden` on every attempt after the first, before
// it resolves the production identity and before it reaches the collector. A repository invariant
// that refuses the work outright is stronger and more specific than a provider window that merely
// permits the attempt, so discovery only has to reach back far enough to find the original attempt
// of every run whose `collect` could have begun inside the consumption window — 35 days. The bound
// holds whichever way GitHub treats `created_at` on a re-run: attempt 1 is dated by the original
// creation either way, and a run that looked newer would only be discovered more easily.
export const WORKFLOW_RUN_TIME_LIMIT_DAYS=35;
export const CANDIDATE_DISCOVERY_LOOKBACK_MS=WORKFLOW_RUN_TIME_LIMIT_DAYS*24*60*60*1000;

// GitHub permits a workflow run to be re-run at most 50 times, and those re-runs are IN ADDITION to
// the original attempt, so a fully exhausted run carries 51 attempts rather than 50. The governed
// workflows carry exactly two jobs per attempt, so that exhausted history is 102 job executions and
// a single 100-row `filter=all` page therefore CANNOT be claimed to cover every execution a run is
// permitted to have. The jobs listing stays one page regardless, because a listing the provider
// counts higher than it returned is truncated and fails closed in the decoder: the pathological
// history refuses the day rather than being read as a subset of itself. These constants record that
// arithmetic; they bound no request.
export const MAX_RERUNS_PER_RUN=50;
export const MAX_RUN_ATTEMPTS=1+MAX_RERUNS_PER_RUN;

// Only this attempt of a run can consume the day. See the header: every later attempt is refused by
// the production entry point before any production work, so it is never evidence of a collection,
// while `filter=all` still ensures it can never hide the first attempt's evidence.
export const CONSUMING_RUN_ATTEMPT=1;

// The complete set of job states the Actions API reports. A `collect` job in any other state is
// one this guard does not understand, and an unrecognised state is never assumed harmless.
export const COLLECT_JOB_STATUSES=Object.freeze(['queued','in_progress','completed']);

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
  'owner_collection_today','guard_input_invalid','guard_collect_timing_unusable','guard_read_failed',
  'guard_read_bound_exhausted','guard_rerun_contract_violated']);

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

// Where candidate discovery starts: the consumption window's own start, pushed back by the provider
// worst case above. It is never the consumption window itself — see the header. A run created
// before this instant cannot contain a `collect` execution that started inside the consumption
// window, because GitHub would have cancelled the run first.
export function candidateDiscoveryStart(now){
  const start=opportunityWindowStart(now)-CANDIDATE_DISCOVERY_LOOKBACK_MS;
  return start<0?0:start;
}

// The UTC date the Actions `created` filter is given. A whole date rather than an instant, which
// only ever widens the search — the provider bounds the listing, and this module never trusts an
// unbounded page to be ordered.
export function candidateDiscoveryDate(now){
  return new Date(candidateDiscoveryStart(now)).toISOString().slice(0,10);
}

// One explicitly numbered page of at most `WORKFLOW_RUNS_PAGE_SIZE` candidate runs for one governed
// workflow, bounded by the provider's own `created>=` filter over the discovery lookback. The page
// number is always explicit and always supplied by the caller — never an implicit "next" cursor,
// never a `Link` header — so the whole sequence of reads is fixed before the second one is issued
// and cannot run away. A page carrying the wrong number of rows fails closed in the decoder, because
// a short or over-full candidate page could be missing exactly the run that collected.
export function workflowRunsRequest(workflowFile,token,now,pageNumber=1){
  if(!ROUTINE_COLLECTION_WORKFLOWS.some(entry=>entry.file===workflowFile))
    throw new Error('opportunity_workflow_unknown');
  if(typeof token!=='string'||!token)throw new Error('opportunity_token_missing');
  if(!Number.isSafeInteger(pageNumber)||pageNumber<1||pageNumber>MAX_WORKFLOW_RUN_PAGES)
    throw new Error('opportunity_page_invalid');
  const since=encodeURIComponent(`>=${candidateDiscoveryDate(now)}`);
  return Object.freeze({
    url:`https://api.github.com/repos/${OPPORTUNITY_GUARD_REPOSITORY}/actions/workflows/${workflowFile}/runs`
      +`?per_page=${WORKFLOW_RUNS_PAGE_SIZE}&exclude_pull_requests=true&created=${since}`
      +`&page=${pageNumber}`,
    init:Object.freeze({method:'GET',headers:Object.freeze({
      authorization:`Bearer ${token}`,accept:'application/vnd.github+json',
      'x-github-api-version':'2022-11-28','user-agent':'teamsheet-data-s2-opportunity-guard'})})
  });
}

// `filter=all` is load-bearing, not a preference: `latest` returns only the most recent execution
// of each job, so a re-run whose newest attempt skipped `collect` would hide the earlier attempt
// that actually collected — and attempt 1 is the only attempt that can consume the day.
//
// This listing is DELIBERATELY NOT PAGINATED, unlike the candidate listing. One 100-row page covers
// every execution of every realistic history, but it does NOT cover every history GitHub permits:
// `MAX_RUN_ATTEMPTS` attempts of two jobs each is 102 executions, so a run re-run to the provider's
// limit exceeds the page. That case is bounded rather than assumed away — a listing whose
// `total_count` exceeds the rows returned is truncated and fails closed in the decoder rather than
// being paged through, so the pathological history refuses the day as ambiguous instead of being
// read as a subset. It is an accepted pathological limit, not an incomplete-history assumption: it
// takes a single run exhausting essentially the whole permitted re-run allowance to reach.
export function runJobsRequest(runId,token){
  if(!runIdValid(runId))throw new Error('opportunity_run_id_invalid');
  if(typeof token!=='string'||!token)throw new Error('opportunity_token_missing');
  return Object.freeze({
    url:`https://api.github.com/repos/${OPPORTUNITY_GUARD_REPOSITORY}/actions/runs/${runId}/jobs`
      +'?per_page=100&filter=all',
    init:Object.freeze({method:'GET',headers:Object.freeze({
      authorization:`Bearer ${token}`,accept:'application/vnd.github+json',
      'x-github-api-version':'2022-11-28','user-agent':'teamsheet-data-s2-opportunity-guard'})})
  });
}

// The pure classifier. `workflows` is keyed by the governed repository path and carries only the
// minimum decoded metadata: the provider's own total for the filtered listing, and for each run its
// id, its creation instant and, for every job execution of every attempt, that job's name,
// conclusion, status, start instant and attempt number.
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
        if(typeof job.status!=='string')return ambiguous('guard_input_invalid');
        if(job.startedAt!==null&&typeof job.startedAt!=='string')return ambiguous('guard_input_invalid');
        // Every job execution names the attempt it belongs to. Missing attempt metadata means the
        // listing cannot be reasoned about across re-runs at all.
        if(!Number.isSafeInteger(job.runAttempt)||job.runAttempt<1)return ambiguous('guard_input_invalid');
      }
      // This run is the one asking. It can never consume its own opportunity, on any attempt.
      if(selfRunId!==null&&run.id===selfRunId)continue;
      // Only the first attempt can consume. A skipped collect is the shape of a refused gate and
      // proves nothing, so it needs no timing at all; every other first-attempt collect must prove
      // when it began. `filter=all` keeps every attempt visible precisely so a later attempt can
      // never hide attempt 1's evidence — but a later attempt is not itself evidence, because the
      // production entry point refuses it before any production work.
      for(const job of run.jobs){
        if(job.name!==OPPORTUNITY_COLLECT_JOB_NAME)continue;
        if(job.conclusion==='skipped')continue;
        if(job.runAttempt!==CONSUMING_RUN_ATTEMPT){
          // A re-run's collect job does start — the runner boots and the entry point throws — so a
          // later attempt that failed is exactly what the invariant predicts, and it is ignored
          // rather than counted. A later attempt reporting SUCCESS is not producible under that
          // invariant at all, and metadata contradicting the repository contract is never
          // interpreted in either direction.
          if(job.conclusion==='success')return ambiguous('guard_rerun_contract_violated');
          continue;
        }
        if(!COLLECT_JOB_STATUSES.includes(job.status))return ambiguous('guard_collect_timing_unusable');
        const startedAt=instant(job.startedAt);
        // A collect job that has not started, or whose start will not parse, cannot be placed in or
        // out of the window. That is a reason to stop, never a reason to proceed.
        if(startedAt===null)return ambiguous('guard_collect_timing_unusable');
        // A collect cannot begin before its own run was created, and cannot begin in the future.
        // Either chronology contradicts the payload rather than dating the collection.
        if(startedAt<created||startedAt>now)return ambiguous('guard_collect_timing_unusable');
        // The window is judged on when collection actually began, never on when GitHub created the
        // run object, so a run that waited hours before collecting is dated by the collection.
        if(startedAt<windowStart)continue;
        if(consumed===null)consumed=entry.kind;
      }
    }
  }
  if(consumed===OWNER_COLLECTION)return frozen(OPPORTUNITY_CONSUMED,'owner_collection_today');
  if(consumed===AUTOMATIC_COLLECTION)return frozen(OPPORTUNITY_CONSUMED,'automatic_collection_consumed');
  return frozen(OPPORTUNITY_AVAILABLE,'opportunity_available');
}

// Strict decoders. Anything the provider returns that is not exactly the shape this guard reads
// is an ambiguity, never a best-effort interpretation.
// One explicitly numbered candidate-listing page. The provider's `total_count` is the size of the
// whole filtered set, not of this page, so the exact number of rows this page must carry is
// arithmetic: whatever remains after the preceding full pages, capped at the page size. A page
// carrying any other number of rows is truncated or over-full, either of which could be missing
// exactly the run that collected, so it is rejected rather than interpreted. Ordering is never
// relied on for correctness.
const decodeRunsPage=(body,pageNumber)=>{
  if(body===null||typeof body!=='object'||Array.isArray(body))return null;
  if(!safeCount(body.total_count)||!Array.isArray(body.workflow_runs))return null;
  const preceding=(pageNumber-1)*WORKFLOW_RUNS_PAGE_SIZE;
  const expected=Math.max(0,Math.min(WORKFLOW_RUNS_PAGE_SIZE,body.total_count-preceding));
  if(body.workflow_runs.length!==expected)return null;
  const runs=[];
  for(const row of body.workflow_runs){
    if(row===null||typeof row!=='object'||Array.isArray(row))return null;
    if(!runIdValid(row.id)||instant(row.created_at)===null)return null;
    runs.push({id:row.id,createdAt:row.created_at});
  }
  return {totalCount:body.total_count,runs};
};

// One page of at most 100 job executions across every attempt. `total_count` is the provider's own
// count for the same `filter=all` listing, so a page that returned fewer rows than the provider
// counted is truncated — and a truncated listing could be missing exactly the earlier attempt that
// collected, which is why it is rejected here instead of paged through.
const decodeJobs=body=>{
  if(body===null||typeof body!=='object'||Array.isArray(body))return null;
  if(!safeCount(body.total_count)||!Array.isArray(body.jobs))return null;
  if(body.total_count!==body.jobs.length)return null;
  const jobs=[];
  for(const row of body.jobs){
    if(row===null||typeof row!=='object'||Array.isArray(row))return null;
    if(typeof row.name!=='string')return null;
    if(row.conclusion!==null&&typeof row.conclusion!=='string')return null;
    if(typeof row.status!=='string')return null;
    if(row.started_at!==null&&row.started_at!==undefined&&typeof row.started_at!=='string')return null;
    if(!Number.isSafeInteger(row.run_attempt)||row.run_attempt<1)return null;
    jobs.push({name:row.name,conclusion:row.conclusion??null,status:row.status,
      startedAt:row.started_at??null,runAttempt:row.run_attempt});
  }
  return jobs;
};

// Reads every candidate-listing page of one governed workflow as a fixed, non-recursive sequence.
// Page 1 establishes the provider's `total_count`; that count fixes how many pages exist before any
// further request is issued, and every later page must report the same total. The accumulated rows
// must then reconcile exactly with that total and carry no duplicate run id — a filtered set that
// shifted underneath the sequence is an ambiguity, never a best guess, because a shift can drop a
// run as easily as repeat one. Each page spends one unit of the shared read budget, and both that
// budget and the page cap stop the sequence rather than extending it.
const readWorkflowRunsPages=async(entry,token,now,read)=>{
  const first=await read(workflowRunsRequest(entry.file,token,now,1));
  if(first==='bound')return 'bound';
  const page=first===null?null:decodeRunsPage(first,1);
  if(page===null)return null;
  const {totalCount}=page;
  const pages=Math.ceil(totalCount/WORKFLOW_RUNS_PAGE_SIZE);
  if(pages>MAX_WORKFLOW_RUN_PAGES)return 'bound';
  const runs=[...page.runs];
  for(let pageNumber=2;pageNumber<=pages;pageNumber+=1){
    const body=await read(workflowRunsRequest(entry.file,token,now,pageNumber));
    if(body==='bound')return 'bound';
    const next=body===null?null:decodeRunsPage(body,pageNumber);
    if(next===null)return null;
    // The filtered set must not have changed size underneath the sequence.
    if(next.totalCount!==totalCount)return null;
    runs.push(...next.runs);
  }
  if(runs.length!==totalCount)return null;
  if(new Set(runs.map(row=>row.id)).size!==runs.length)return null;
  return {totalCount,runs};
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
    const listing=await readWorkflowRunsPages(entry,token,now,read);
    if(listing==='bound')return ambiguous('guard_read_bound_exhausted');
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
