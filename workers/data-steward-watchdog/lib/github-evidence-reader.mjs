// DATA-OPS-A1.4 — the bounded, read-only GitHub evidence adapter for the watchdog.
//
// This is the ONLY module in the watchdog package that ever builds a GitHub request, and every
// request it builds is `method: 'GET'`. It reads nothing but the run and job metadata of one
// fixed workflow file — the A1.3 read-only observer itself — plus, for at most two scheduled candidates per cycle, their own job logs, solely to recover the exact sanitized one-line JSON summary
// `run-observer.mjs` already prints. There is no dispatch, no re-run, no cancel, no write call
// and no builder that accepts a caller-supplied path, method or body. The minimum GitHub
// permission this adapter needs is Metadata: Read plus Actions: Read; it never asks for more.
//
// TRANSPORT FAILURE IS EVIDENCE UNAVAILABLE, NEVER AN OUTAGE CLAIM. Every non-200 response, every
// body that fails to decode and every transport exception collapses to the same closed
// `GITHUB_EVIDENCE_UNAVAILABLE` (or, once the bounded read budget is spent,
// `GITHUB_READ_BOUND_EXHAUSTED`) outcome. Nothing here ever concludes "GitHub is down" — absence
// of a reachable answer is recorded as exactly that, absence, and nothing stronger.
import {deepFreeze} from './canonical.mjs';

export const GITHUB_EVIDENCE_REPOSITORY='priteshpatel390-del/FPL';
export const GITHUB_EVIDENCE_WORKFLOW_FILE='data-steward-readonly-observer.yml';
export const GITHUB_EVIDENCE_JOB_NAME='observe-production-chain';
export const GITHUB_EVIDENCE_API_VERSION='2022-11-28';
export const GITHUB_EVIDENCE_USER_AGENT='teamsheet-data-steward-watchdog';
export const GITHUB_EVIDENCE_REQUEST_TIMEOUT_MS=15000;
export const GITHUB_EVIDENCE_SUMMARY_LOG_MAX_BYTES=64*1024;
export const GITHUB_EVIDENCE_LOOKBACK_MS=3*24*60*60*1000;
export const GITHUB_EVIDENCE_RUNS_PAGE_SIZE=100;
export const GITHUB_EVIDENCE_MAX_RUN_PAGES=2;
export const GITHUB_EVIDENCE_MAX_READS=16;
export const GITHUB_EVIDENCE_MAX_SUMMARY_READS=2;

export const EVENT_SCHEDULE='schedule';
export const EVENT_WORKFLOW_DISPATCH='workflow_dispatch';
export const EVENT_UNKNOWN='unknown';

export const JOB_HEALTH_SUCCESS='SUCCESS';
export const JOB_HEALTH_FAILED='FAILED';
export const JOB_HEALTH_SKIPPED='SKIPPED';
export const JOB_HEALTH_IN_FLIGHT='IN_FLIGHT';
export const JOB_HEALTH_UNCLASSIFIED='UNCLASSIFIED';

export const READ_OK='GITHUB_EVIDENCE_OBSERVED';
export const READ_UNAVAILABLE='GITHUB_EVIDENCE_UNAVAILABLE';
export const READ_BOUND_EXHAUSTED='GITHUB_READ_BOUND_EXHAUSTED';

export class GithubEvidenceError extends Error{
  constructor(code){super(code);this.name='GithubEvidenceError';this.code=code;}
}
const fail=code=>{throw new GithubEvidenceError(code);};

const SHA=/^[0-9a-f]{40}$/;
const safeCount=value=>Number.isSafeInteger(value)&&value>=0;
const runIdValid=value=>Number.isSafeInteger(value)&&value>0;
const instant=value=>{
  if(typeof value!=='string'||value==='')return null;
  const ms=Date.parse(value);
  return Number.isFinite(ms)?ms:null;
};

const headers=token=>{
  if(typeof token!=='string'||!token)fail('github_evidence_token_missing');
  return Object.freeze({authorization:`Bearer ${token}`,accept:'application/vnd.github+json',
    'x-github-api-version':GITHUB_EVIDENCE_API_VERSION,'user-agent':GITHUB_EVIDENCE_USER_AGENT});
};
const get=(url,token)=>Object.freeze({url,init:Object.freeze({method:'GET',headers:headers(token)})});

// ---------------------------------------------------------------- request builders (GET only)

export function workflowRunsRequest(token,sinceIso,pageNumber=1){
  if(typeof sinceIso!=='string'||instant(sinceIso)===null)fail('github_evidence_since_invalid');
  if(!Number.isSafeInteger(pageNumber)||pageNumber<1||pageNumber>GITHUB_EVIDENCE_MAX_RUN_PAGES)
    fail('github_evidence_page_invalid');
  return get(`https://api.github.com/repos/${GITHUB_EVIDENCE_REPOSITORY}/actions/workflows/`
    +`${GITHUB_EVIDENCE_WORKFLOW_FILE}/runs?per_page=${GITHUB_EVIDENCE_RUNS_PAGE_SIZE}`
    +`&exclude_pull_requests=true&created=${encodeURIComponent(`>=${sinceIso.slice(0,10)}`)}`
    +`&page=${pageNumber}`,token);
}

export function runJobsRequest(runId,token){
  if(!runIdValid(runId))fail('github_evidence_run_id_invalid');
  return get(`https://api.github.com/repos/${GITHUB_EVIDENCE_REPOSITORY}/actions/runs/${runId}`
    +`/jobs?per_page=100&filter=all`,token);
}

// Deliberately not a generic log reader: the only input is a decoded numeric job id, and the raw
// response body is never returned to a caller — only the closed summary-decode result is.
export function jobLogRequest(jobId,token){
  if(!runIdValid(jobId))fail('github_evidence_job_id_invalid');
  return get(`https://api.github.com/repos/${GITHUB_EVIDENCE_REPOSITORY}/actions/jobs/${jobId}/logs`,token);
}

// ---------------------------------------------------------------- strict decoders

export function decodeRunsPage(body,pageNumber){
  if(body===null||typeof body!=='object'||Array.isArray(body))return null;
  if(!safeCount(body.total_count)||!Array.isArray(body.workflow_runs))return null;
  const preceding=(pageNumber-1)*GITHUB_EVIDENCE_RUNS_PAGE_SIZE;
  const expected=Math.max(0,Math.min(GITHUB_EVIDENCE_RUNS_PAGE_SIZE,body.total_count-preceding));
  if(body.workflow_runs.length!==expected)return null;
  const runs=[];
  for(const row of body.workflow_runs){
    if(row===null||typeof row!=='object'||Array.isArray(row))return null;
    if(!runIdValid(row.id)||instant(row.created_at)===null)return null;
    if(typeof row.event!=='string')return null;
    if(typeof row.head_sha!=='string'||!SHA.test(row.head_sha))return null;
    if(row.conclusion!==null&&typeof row.conclusion!=='string')return null;
    if(typeof row.status!=='string')return null;
    const event=row.event===EVENT_SCHEDULE?EVENT_SCHEDULE
      :row.event===EVENT_WORKFLOW_DISPATCH?EVENT_WORKFLOW_DISPATCH:EVENT_UNKNOWN;
    // Normalized to a millisecond-inclusive `toISOString()` form immediately: GitHub's own
    // timestamps omit milliseconds (`...T04:17:00Z`), and comparing that lexicographically in SQL
    // against a `.toISOString()`-formatted bound (`...T04:17:00.000Z`) would put `.` (0x2E) before
    // `Z` (0x5A) and rank an exact-instant match as earlier than the bound. Normalizing every
    // stored timestamp to the same format once, here, is what keeps every later TEXT comparison
    // (`opportunityEvidenceSince`, retention pruning) a correct chronological comparison.
    runs.push({id:row.id,createdAt:new Date(row.created_at).toISOString(),event,headSha:row.head_sha,
      status:row.status,conclusion:row.conclusion??null});
  }
  return {totalCount:body.total_count,runs};
}

export function decodeJobs(body){
  if(body===null||typeof body!=='object'||Array.isArray(body))return null;
  if(!safeCount(body.total_count)||!Array.isArray(body.jobs))return null;
  if(body.total_count!==body.jobs.length)return null;
  const jobs=[];
  for(const row of body.jobs){
    if(row===null||typeof row!=='object'||Array.isArray(row))return null;
    if(!runIdValid(row.id)||typeof row.name!=='string'||typeof row.status!=='string')return null;
    if(row.conclusion!==null&&typeof row.conclusion!=='string')return null;
    if(row.completed_at!==null&&row.completed_at!==undefined&&typeof row.completed_at!=='string')return null;
    if(!Number.isSafeInteger(row.run_attempt)||row.run_attempt<1)return null;
    jobs.push({id:row.id,name:row.name,status:row.status,conclusion:row.conclusion??null,
      completedAt:row.completed_at===null||row.completed_at===undefined?null
        :new Date(row.completed_at).toISOString(),
      runAttempt:row.run_attempt});
  }
  return jobs;
}

// One decoded job's health, from status/conclusion alone. `success` counts even on a re-run
// attempt: the observer performs no mutation, so a later attempt succeeding is never ambiguous
// the way a production collection re-run would be.
export function classifyJobHealth(job){
  if(!job||job.status!=='completed')return JOB_HEALTH_IN_FLIGHT;
  switch(job.conclusion){
    case 'success':return JOB_HEALTH_SUCCESS;
    case 'failure':case 'timed_out':case 'cancelled':return JOB_HEALTH_FAILED;
    case 'skipped':return JOB_HEALTH_SKIPPED;
    default:return JOB_HEALTH_UNCLASSIFIED;
  }
}

const SUMMARY_LOG_PREFIX='(?:[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?Z )?';
const SUMMARY_LINE=new RegExp(`^${SUMMARY_LOG_PREFIX}(\\{.*\\})$`);
const DAY_DATE=/^\d{4}-\d{2}-\d{2}$/;
const REASON=/^[A-Z][A-Z0-9_]{1,63}$/;
const SENTINEL_ID=/^[a-z][a-z0-9]{1,31}$/;

// Strict validator for the exact shape `sanitizedSummary()` in run-observer.mjs produces. It is
// a structural check only — it never imports the A1.2/A1.3 modules that define the shape, so this
// adapter has no dependency on their internals and cannot be broken by refactoring them, only by
// changing the printed shape itself.
export function decodeObserverSummary(text){
  if(typeof text!=='string')return null;
  const candidates=[];
  for(const line of text.split(/\r?\n/)){
    const match=line.match(SUMMARY_LINE);
    if(!match)continue;
    let parsed;
    try{parsed=JSON.parse(match[1]);}catch{continue;}
    candidates.push(parsed);
  }
  if(candidates.length!==1)return null;
  const [summary]=candidates;
  if(summary===null||typeof summary!=='object'||Array.isArray(summary))return null;
  if(!DAY_DATE.test(summary.dayDate))return null;
  if(!['HEALTHY','UNHEALTHY','NOT_EVALUATED'].includes(summary.verdict))return null;
  if(!REASON.test(summary.evaluationReason))return null;
  if(!['COMPLETE','INCOMPLETE'].includes(summary.heartbeat))return null;
  if(typeof summary.escalationRequired!=='boolean')return null;
  if(!Array.isArray(summary.sentinels)||summary.sentinels.length>8)return null;
  for(const entry of summary.sentinels){
    if(entry===null||typeof entry!=='object'||Array.isArray(entry))return null;
    if(!SENTINEL_ID.test(entry.sentinel))return null;
    if(typeof entry.state!=='string'||!/^[A-Z][A-Z0-9_]{1,63}$/.test(entry.state))return null;
    if(!REASON.test(entry.reasonCode))return null;
  }
  return deepFreeze({dayDate:summary.dayDate,verdict:summary.verdict,
    evaluationReason:summary.evaluationReason,heartbeat:summary.heartbeat,
    escalationRequired:summary.escalationRequired,sentinelCount:summary.sentinels.length});
}

// ---------------------------------------------------------------- bounded read orchestration

async function readJson(request,fetchImpl,budget){
  if(budget.spent>=budget.max)fail('github_evidence_read_bound_exhausted');
  budget.spent+=1;
  let response;
  try{
    response=await fetchImpl(request.url,{...request.init,
      signal:AbortSignal.timeout(GITHUB_EVIDENCE_REQUEST_TIMEOUT_MS)});
  }catch{return null;}
  if(response?.status!==200)return null;
  try{return await response.json();}catch{return null;}
}

async function readRunPages(token,sinceIso,fetchImpl,budget){
  const first=decodeRunsPage(await readJson(workflowRunsRequest(token,sinceIso,1),fetchImpl,budget),1);
  if(first===null)return null;
  const pages=Math.ceil(first.totalCount/GITHUB_EVIDENCE_RUNS_PAGE_SIZE);
  if(pages>GITHUB_EVIDENCE_MAX_RUN_PAGES)fail('github_evidence_read_bound_exhausted');
  const runs=[...first.runs];
  for(let page=2;page<=pages;page+=1){
    const next=decodeRunsPage(await readJson(workflowRunsRequest(token,sinceIso,page),fetchImpl,budget),page);
    if(next===null||next.totalCount!==first.totalCount)return null;
    runs.push(...next.runs);
  }
  if(runs.length!==first.totalCount)return null;
  if(new Set(runs.map(row=>row.id)).size!==runs.length)return null;
  return runs;
}

async function readSummaryLog(jobId,token,fetchImpl,budget){
  if(budget.spent>=budget.max)fail('github_evidence_read_bound_exhausted');
  budget.spent+=1;
  let response;
  try{
    response=await fetchImpl(jobLogRequest(jobId,token).url,
      {...jobLogRequest(jobId,token).init,signal:AbortSignal.timeout(GITHUB_EVIDENCE_REQUEST_TIMEOUT_MS)});
  }catch{return null;}
  if(response?.status!==200)return null;
  const rawLength=response.headers?.get?.('content-length');
  let declared=null;
  if(rawLength!==null&&rawLength!==undefined){
    if(typeof rawLength!=='string'||!/^(?:0|[1-9][0-9]{0,6})$/.test(rawLength))return null;
    declared=Number(rawLength);
    if(declared>GITHUB_EVIDENCE_SUMMARY_LOG_MAX_BYTES)return null;
  }
  if(typeof response.body?.getReader!=='function')return null;
  const chunks=[];
  let total=0;
  try{
    const reader=response.body.getReader();
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      if(!(value instanceof Uint8Array)||total+value.byteLength>GITHUB_EVIDENCE_SUMMARY_LOG_MAX_BYTES){
        await reader.cancel();
        return null;
      }
      chunks.push(value);
      total+=value.byteLength;
    }
  }catch{return null;}
  if(declared!==null&&declared!==total)return null;
  const bytes=new Uint8Array(total);
  let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  let text;
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return null;}
  return decodeObserverSummary(text);
}

// One decoded, interpreted run: which job it carried, that job's health, and — for the single
// most recently created run in the batch that reached a completed job — its sanitized summary,
// read once and only once per cycle.
async function decorateRun(run,token,fetchImpl,budget,{readSummary}){
  const jobs=decodeJobs(await readJson(runJobsRequest(run.id,token),fetchImpl,budget));
  if(jobs===null)return null;
  const observerJobs=jobs.filter(job=>job.name===GITHUB_EVIDENCE_JOB_NAME);
  if(observerJobs.length===0)
    return deepFreeze({...run,jobHealth:JOB_HEALTH_UNCLASSIFIED,jobConclusion:null,
      jobCompletedAt:null,runAttempt:null,summaryAttempted:false,summary:null});
  // The most recently attempted execution decides this run's health, exactly like A1.3's own
  // "later evidence wins" rule for anything that is not production-mutation-sensitive.
  const latest=observerJobs.reduce((best,job)=>job.runAttempt>best.runAttempt?job:best,observerJobs[0]);
  const jobHealth=classifyJobHealth(latest);
  let summary=null;
  // A summary is worth checking against a SUCCESS or FAILED job, and never for one still in
  // flight or skipped — there is nothing decisive to compare it against in either of those.
  const summaryAttempted=readSummary&&(jobHealth===JOB_HEALTH_SUCCESS||jobHealth===JOB_HEALTH_FAILED);
  if(summaryAttempted){
    summary=await readSummaryLog(latest.id,token,fetchImpl,budget).catch(()=>null);
  }
  return deepFreeze({...run,jobHealth,jobConclusion:latest.conclusion,
    jobCompletedAt:latest.completedAt,runAttempt:latest.runAttempt,summaryAttempted,summary});
}

// Issues the bounded read set and returns the decoded, per-run view of the observer's own recent
// history. `now` bounds the lookback window; it never mutates anything and the caller supplies
// the clock, exactly like every other steward adapter.
export async function readObserverEvidence({token,fetchImpl,now,maxReads=GITHUB_EVIDENCE_MAX_READS}){
  if(typeof fetchImpl!=='function')fail('github_evidence_input_invalid');
  if(!Number.isSafeInteger(now)||now<0)fail('github_evidence_input_invalid');
  if(!Number.isSafeInteger(maxReads)||maxReads<1||maxReads>GITHUB_EVIDENCE_MAX_READS)
    fail('github_evidence_input_invalid');
  const budget={spent:0,max:maxReads};
  const sinceIso=new Date(now-GITHUB_EVIDENCE_LOOKBACK_MS).toISOString();
  let runs;
  try{runs=await readRunPages(token,sinceIso,fetchImpl,budget);}
  catch(error){
    return deepFreeze({ok:false,
      reasonCode:error?.code==='github_evidence_read_bound_exhausted'?READ_BOUND_EXHAUSTED:READ_UNAVAILABLE});
  }
  if(runs===null)return deepFreeze({ok:false,reasonCode:READ_UNAVAILABLE});
  const sorted=[...runs].sort((a,b)=>instant(b.createdAt)-instant(a.createdAt));
  const decorated=[];
  let summaryReads=0;
  for(const run of sorted){
    let decoratedRun;
    try{
      decoratedRun=await decorateRun(run,token,fetchImpl,budget,
        {readSummary:run.event===EVENT_SCHEDULE&&summaryReads<GITHUB_EVIDENCE_MAX_SUMMARY_READS});
    }catch(error){
      return deepFreeze({ok:false,
        reasonCode:error?.code==='github_evidence_read_bound_exhausted'?READ_BOUND_EXHAUSTED:READ_UNAVAILABLE});
    }
    if(decoratedRun===null)return deepFreeze({ok:false,reasonCode:READ_UNAVAILABLE});
    if(decoratedRun.summaryAttempted)summaryReads+=1;
    decorated.push(decoratedRun);
  }
  return deepFreeze({ok:true,reasonCode:READ_OK,runs:deepFreeze(decorated),reads:budget.spent});
}
