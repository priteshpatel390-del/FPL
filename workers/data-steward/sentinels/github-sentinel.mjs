// DATA-OPS-A1.2 — the read-only GitHub sentinel.
//
// It observes the GitHub half of the DATA-S2C chain: current `main`, the exact-head Verify
// result, and every governed routine-collection run of the UTC day under evaluation, decoded down
// to whether the day's collection actually executed and, when a run failed, whether it failed for
// the one reason that is healthy.
//
// THE CENTRAL CORRECTION THIS MODULE EXISTS TO MAKE: a workflow B run whose overall conclusion is
// `failure` is not evidence of a production failure. The live T2 acceptance proved the opposite —
// run `34209137195` failed precisely because the repository gate refused an already-consumed day
// with `OPPORTUNITY_CONSUMED (automatic_collection_consumed)` and `collect` was correctly skipped.
// That is the guard working. This module therefore never classifies on `run.conclusion`; it
// classifies on the governed job and step outcomes underneath it.
//
// READ-ONLY BY CONSTRUCTION. Every request builder here emits `method:'GET'`. There is no
// dispatch, no re-run, no cancel, no enable or disable, no branch, commit, issue, pull request,
// review, label, secret or settings call, and no builder takes a method, a path or a body from a
// caller. The minimum GitHub permissions are Metadata: Read (mandatory), Contents: Read (the
// `main` ref), Actions: Read (runs and jobs) and Checks: Read (the Verify check run). Write access
// of any kind is neither required nor requested.
//
// Transport and interpretation are separated: every decision in this module is a pure function
// over decoded metadata, so the whole state machine is provable from fixtures without a network.
import {deepFreeze} from '../../../src/decision-intelligence/canonical.mjs';
import {EXACT_HEAD_VERIFY_APP_SLUG,EXACT_HEAD_VERIFY_CHECK_NAME,VERIFY_SUCCESS,
  classifyExactHeadVerify} from '../../data-platform/scheduled/exact-head-verify.mjs';
import {EXPECTED_COLLECT_JOB,EXPECTED_DEFAULT_BRANCH,EXPECTED_GATE_JOB,EXPECTED_GUARD_STEP,
  EXPECTED_REPOSITORY,EXPECTED_WORKFLOW_B_FILE,EXPECTED_WORKFLOW_C_FILE,MS_PER_DAY,
  utcDayWindow} from './production-chain-contract.mjs';

export const GITHUB_SENTINEL_ID='github';
export const GITHUB_SENTINEL_VERSION='data-ops-a1.2-github-v1';
export const GITHUB_API_VERSION='2022-11-28';
export const GITHUB_USER_AGENT='teamsheet-data-steward-sentinel';
export const GITHUB_REQUEST_TIMEOUT_MS=15000;

// Only the first attempt of a run can have collected: the shared production entry point throws
// `workflow_retry_forbidden` on every later attempt, before it resolves the production identity
// and before it reaches the collector. `filter=all` is still used so a later attempt can never
// hide the first attempt's evidence.
export const CONSUMING_RUN_ATTEMPT=1;
export const RUNS_PAGE_SIZE=100;
export const MAX_RUN_PAGES=2;
// A hard cap over every request this sentinel issues in one observation cycle: the `main` ref, the
// Verify check-run read, each candidate-listing page and each run's job listing. Two UTC days of
// governed runs is at most a handful of runs per workflow, so the normal path exits far below
// this. Exceeding it is an ambiguity, never a licence to keep reading.
export const GITHUB_SENTINEL_MAX_READS=32;

// The closed set of outcomes one governed run may be decoded into. Anything that does not fit
// exactly one of the first five is UNCLASSIFIED, and UNCLASSIFIED never contributes to health.
export const RUN_COLLECTED='COLLECTED';
export const RUN_COLLECT_FAILED='COLLECT_FAILED';
export const RUN_REFUSED_OPPORTUNITY_CONSUMED='REFUSED_OPPORTUNITY_CONSUMED';
export const RUN_GATE_REFUSED_OTHER='GATE_REFUSED_OTHER';
export const RUN_IN_FLIGHT='IN_FLIGHT';
export const RUN_UNCLASSIFIED='UNCLASSIFIED';
export const RUN_OUTCOMES=deepFreeze([RUN_COLLECTED,RUN_COLLECT_FAILED,
  RUN_REFUSED_OPPORTUNITY_CONSUMED,RUN_GATE_REFUSED_OTHER,RUN_IN_FLIGHT,RUN_UNCLASSIFIED]);

export const GITHUB_OBSERVATION_OK='GITHUB_CHAIN_OBSERVED';
export const GITHUB_READ_FAILED='GITHUB_READ_FAILED';
export const GITHUB_READ_BOUND_EXHAUSTED='GITHUB_READ_BOUND_EXHAUSTED';
export const GITHUB_IDENTITY_MISMATCH='GITHUB_IDENTITY_MISMATCH';

export class GithubSentinelError extends Error{
  constructor(code){super(code);this.name='GithubSentinelError';this.code=code;}
}
const fail=code=>{throw new GithubSentinelError(code);};

const SHA=/^[0-9a-f]{40}$/;
const safeCount=value=>Number.isSafeInteger(value)&&value>=0;
const runIdValid=value=>Number.isSafeInteger(value)&&value>0;
const instant=value=>{
  if(typeof value!=='string'||value==='')return null;
  const ms=Date.parse(value);
  return Number.isFinite(ms)?ms:null;
};

const headers=token=>{
  if(typeof token!=='string'||!token)fail('github_token_missing');
  return Object.freeze({authorization:`Bearer ${token}`,accept:'application/vnd.github+json',
    'x-github-api-version':GITHUB_API_VERSION,'user-agent':GITHUB_USER_AGENT});
};
const get=(url,token)=>Object.freeze({url,init:Object.freeze({method:'GET',headers:headers(token)})});

// ---------------------------------------------------------------- request builders (GET only)

// The current default-branch head. `git/ref` is the narrowest read that answers it and needs only
// Contents: Read.
export const mainRefRequest=token=>
  get(`https://api.github.com/repos/${EXPECTED_REPOSITORY}/git/ref/heads/${EXPECTED_DEFAULT_BRANCH}`,token);

// The exact-head Verify check runs for one commit. Checks: Read.
export function verifyCheckRunsRequest(sha,token){
  if(typeof sha!=='string'||!SHA.test(sha))fail('github_sha_invalid');
  return get(`https://api.github.com/repos/${EXPECTED_REPOSITORY}/commits/${sha}/check-runs?per_page=100`,token);
}

export const GOVERNED_WORKFLOW_FILES=deepFreeze([EXPECTED_WORKFLOW_B_FILE,EXPECTED_WORKFLOW_C_FILE]);

// One explicitly numbered page of candidate runs for one governed workflow. The page number is
// always supplied by the caller and never taken from a `Link` header, so the whole read sequence
// is fixed before the second request is issued. Discovery reaches back one extra UTC day because
// a run created at 23:58 can legitimately begin collecting after midnight, and such a run is dated
// by its collection rather than by its creation.
export function workflowRunsRequest(workflowFile,token,now,pageNumber=1){
  if(!GOVERNED_WORKFLOW_FILES.includes(workflowFile))fail('github_workflow_unknown');
  if(!Number.isSafeInteger(pageNumber)||pageNumber<1||pageNumber>MAX_RUN_PAGES)fail('github_page_invalid');
  const {start}=utcDayWindow(now);
  const since=new Date(start-MS_PER_DAY).toISOString().slice(0,10);
  return get(`https://api.github.com/repos/${EXPECTED_REPOSITORY}/actions/workflows/${workflowFile}/runs`
    +`?per_page=${RUNS_PAGE_SIZE}&exclude_pull_requests=true&created=${encodeURIComponent(`>=${since}`)}`
    +`&page=${pageNumber}`,token);
}

// Every job execution of every attempt of one run. `filter=all` is load-bearing rather than a
// preference: `latest` would let a re-run whose newest attempt skipped `collect` hide the earlier
// attempt that actually collected.
export function runJobsRequest(runId,token){
  if(!runIdValid(runId))fail('github_run_id_invalid');
  return get(`https://api.github.com/repos/${EXPECTED_REPOSITORY}/actions/runs/${runId}/jobs?per_page=100&filter=all`,token);
}

// ---------------------------------------------------------------- strict decoders

export function decodeMainRef(body){
  if(body===null||typeof body!=='object'||Array.isArray(body))return null;
  if(body.ref!==`refs/heads/${EXPECTED_DEFAULT_BRANCH}`)return null;
  const sha=body.object?.sha;
  return typeof sha==='string'&&SHA.test(sha)?sha:null;
}

export function decodeRunsPage(body,pageNumber){
  if(body===null||typeof body!=='object'||Array.isArray(body))return null;
  if(!safeCount(body.total_count)||!Array.isArray(body.workflow_runs))return null;
  const preceding=(pageNumber-1)*RUNS_PAGE_SIZE;
  const expected=Math.max(0,Math.min(RUNS_PAGE_SIZE,body.total_count-preceding));
  if(body.workflow_runs.length!==expected)return null;
  const runs=[];
  for(const row of body.workflow_runs){
    if(row===null||typeof row!=='object'||Array.isArray(row))return null;
    if(!runIdValid(row.id)||instant(row.created_at)===null)return null;
    if(typeof row.head_branch!=='string'||typeof row.event!=='string')return null;
    if(typeof row.head_sha!=='string'||!SHA.test(row.head_sha))return null;
    if(row.conclusion!==null&&typeof row.conclusion!=='string')return null;
    if(typeof row.status!=='string')return null;
    runs.push({id:row.id,createdAt:row.created_at,headBranch:row.head_branch,headSha:row.head_sha,
      event:row.event,status:row.status,conclusion:row.conclusion??null});
  }
  return {totalCount:body.total_count,runs};
}

// One page of at most 100 job executions across every attempt. A listing the provider counts
// higher than it returned is truncated, and a truncated listing could be missing exactly the
// attempt that collected, so it is rejected rather than paged through.
export function decodeJobs(body){
  if(body===null||typeof body!=='object'||Array.isArray(body))return null;
  if(!safeCount(body.total_count)||!Array.isArray(body.jobs))return null;
  if(body.total_count!==body.jobs.length)return null;
  const jobs=[];
  for(const row of body.jobs){
    if(row===null||typeof row!=='object'||Array.isArray(row))return null;
    if(typeof row.name!=='string'||typeof row.status!=='string')return null;
    if(row.conclusion!==null&&typeof row.conclusion!=='string')return null;
    if(row.started_at!==null&&row.started_at!==undefined&&typeof row.started_at!=='string')return null;
    if(!Number.isSafeInteger(row.run_attempt)||row.run_attempt<1)return null;
    // Step detail is what separates a legitimate opportunity refusal from every other gate
    // failure, so a job whose steps are absent or malformed is decoded as having no provable step
    // evidence rather than as having none to worry about.
    let steps=null;
    if(Array.isArray(row.steps)){
      steps=[];
      for(const step of row.steps){
        if(step===null||typeof step!=='object'||Array.isArray(step))return null;
        if(typeof step.name!=='string'||typeof step.status!=='string')return null;
        if(step.conclusion!==null&&typeof step.conclusion!=='string')return null;
        steps.push({name:step.name,status:step.status,conclusion:step.conclusion??null});
      }
    }else if(row.steps!==undefined&&row.steps!==null)return null;
    jobs.push({name:row.name,status:row.status,conclusion:row.conclusion??null,
      startedAt:row.started_at??null,runAttempt:row.run_attempt,steps});
  }
  return jobs;
}

// ---------------------------------------------------------------- pure run classification

const attemptOne=(jobs,name)=>jobs.filter(job=>job.name===name&&job.runAttempt===CONSUMING_RUN_ATTEMPT);

// Exactly one shape is a legitimate `OPPORTUNITY_CONSUMED` refusal: the gate job's guard step
// failed, every step before it succeeded, and `collect` was skipped. A gate that failed anywhere
// else is a different event and is never reported as the healthy one.
function guardRefusal(gate){
  if(!Array.isArray(gate.steps))return false;
  const index=gate.steps.findIndex(step=>step.name===EXPECTED_GUARD_STEP);
  if(index===-1)return false;
  const guard=gate.steps[index];
  if(guard.status!=='completed'||guard.conclusion!=='failure')return false;
  return gate.steps.slice(0,index).every(step=>step.status==='completed'&&step.conclusion==='success');
}

// Classifies one governed run from its attempt-1 job and step metadata alone. It never reads the
// run-level conclusion, and it never guesses: anything it cannot place exactly is UNCLASSIFIED.
export function classifyGovernedRun(jobs){
  if(!Array.isArray(jobs))return deepFreeze({outcome:RUN_UNCLASSIFIED,collectStartedAt:null});
  const gates=attemptOne(jobs,EXPECTED_GATE_JOB);
  const collects=attemptOne(jobs,EXPECTED_COLLECT_JOB);
  if(gates.length!==1||collects.length!==1)
    return deepFreeze({outcome:RUN_UNCLASSIFIED,collectStartedAt:null});
  // A later attempt reporting a SUCCESSFUL collect contradicts the entry point's
  // `workflow_retry_forbidden` invariant outright. Metadata that contradicts the repository
  // contract is never interpreted in either direction.
  if(jobs.some(job=>job.name===EXPECTED_COLLECT_JOB&&job.runAttempt!==CONSUMING_RUN_ATTEMPT
    &&job.conclusion==='success'))return deepFreeze({outcome:RUN_UNCLASSIFIED,collectStartedAt:null});
  const [gate]=gates,[collect]=collects;
  if(gate.status!=='completed'||collect.status!=='completed')
    return deepFreeze({outcome:RUN_IN_FLIGHT,collectStartedAt:null});
  if(collect.conclusion==='skipped'){
    if(gate.conclusion==='success')return deepFreeze({outcome:RUN_UNCLASSIFIED,collectStartedAt:null});
    return deepFreeze({outcome:guardRefusal(gate)?RUN_REFUSED_OPPORTUNITY_CONSUMED:RUN_GATE_REFUSED_OTHER,
      collectStartedAt:null});
  }
  // A collect that ran must prove when it began, because that instant is what dates the day's
  // collection. A start that will not parse cannot be placed in or out of the day.
  const startedAt=instant(collect.startedAt);
  if(startedAt===null)return deepFreeze({outcome:RUN_UNCLASSIFIED,collectStartedAt:null});
  return deepFreeze({outcome:collect.conclusion==='success'?RUN_COLLECTED:RUN_COLLECT_FAILED,
    collectStartedAt:startedAt});
}

// ---------------------------------------------------------------- pure day interpretation

// Reduces every decoded governed run to the facts the health verdict needs about one UTC day.
//
// A run that COLLECTED or whose collect FAILED is dated by the collect job's own start instant,
// so a run that waited hours before collecting is attributed to the day it collected in. A run
// that was refused or is still in flight has no collection to date and is attributed to the day
// its run object was created in.
export function interpretGithubDay({runs,now}){
  const {start,end}=utcDayWindow(now);
  const inDay=value=>value>=start&&value<end;
  const summary={collected:0,collectFailed:0,refusedOpportunityConsumed:0,gateRefusedOther:0,
    inFlight:0,unclassified:0,ownerCollections:0,automaticCollections:0,
    firstCollectionAt:null,lastRunCreatedAt:null};
  for(const run of runs){
    const created=instant(run.createdAt);
    if(created===null){summary.unclassified+=1;continue;}
    const dated=run.classification.collectStartedAt===null?created:run.classification.collectStartedAt;
    if(!inDay(dated))continue;
    if(summary.lastRunCreatedAt===null||created>summary.lastRunCreatedAt)summary.lastRunCreatedAt=created;
    switch(run.classification.outcome){
      case RUN_COLLECTED:
        summary.collected+=1;
        if(run.kind==='owner')summary.ownerCollections+=1;else summary.automaticCollections+=1;
        if(summary.firstCollectionAt===null||dated<summary.firstCollectionAt)summary.firstCollectionAt=dated;
        break;
      case RUN_COLLECT_FAILED:summary.collectFailed+=1;break;
      case RUN_REFUSED_OPPORTUNITY_CONSUMED:summary.refusedOpportunityConsumed+=1;break;
      case RUN_GATE_REFUSED_OTHER:summary.gateRefusedOther+=1;break;
      case RUN_IN_FLIGHT:summary.inFlight+=1;break;
      default:summary.unclassified+=1;
    }
  }
  // "Executed a collection" counts every attempt-1 `collect` that actually ran, successful or
  // not, because that is exactly what consumes the day under the guard's own rule. More than one
  // in a UTC day is a duplicate production collection whatever their conclusions were.
  const executions=summary.collected+summary.collectFailed;
  return deepFreeze({...summary,collectExecutions:executions,duplicateCollection:executions>1});
}

// ---------------------------------------------------------------- bounded read orchestration

async function readJson(request,fetchImpl,budget){
  if(budget.spent>=budget.max)fail('github_read_bound_exhausted');
  budget.spent+=1;
  let response;
  try{
    response=await fetchImpl(request.url,{...request.init,signal:AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT_MS)});
  }catch{return null;}
  if(response?.status!==200)return null;
  try{return await response.json();}catch{return null;}
}

async function readRunPages(workflowFile,token,now,fetchImpl,budget){
  const first=decodeRunsPage(await readJson(workflowRunsRequest(workflowFile,token,now,1),fetchImpl,budget),1);
  if(first===null)return null;
  const pages=Math.ceil(first.totalCount/RUNS_PAGE_SIZE);
  if(pages>MAX_RUN_PAGES)fail('github_read_bound_exhausted');
  const runs=[...first.runs];
  for(let page=2;page<=pages;page+=1){
    const next=decodeRunsPage(await readJson(workflowRunsRequest(workflowFile,token,now,page),fetchImpl,budget),page);
    if(next===null||next.totalCount!==first.totalCount)return null;
    runs.push(...next.runs);
  }
  if(runs.length!==first.totalCount)return null;
  if(new Set(runs.map(row=>row.id)).size!==runs.length)return null;
  return runs;
}

// Issues the bounded read set and returns the decoded, interpreted GitHub view of the day. Every
// failure — a non-200, a body that will not decode, an exhausted bound, a transport error — is a
// failed observation, and no part of the underlying error is carried out.
export async function readGithubChain({token,fetchImpl,now,maxReads=GITHUB_SENTINEL_MAX_READS}){
  if(typeof fetchImpl!=='function')fail('github_input_invalid');
  if(!Number.isSafeInteger(now)||now<0)fail('github_input_invalid');
  if(!Number.isSafeInteger(maxReads)||maxReads<1||maxReads>GITHUB_SENTINEL_MAX_READS)fail('github_input_invalid');
  const budget={spent:0,max:maxReads};
  const mainSha=decodeMainRef(await readJson(mainRefRequest(token),fetchImpl,budget));
  if(mainSha===null)return deepFreeze({ok:false,reasonCode:GITHUB_READ_FAILED});
  const verifyBody=await readJson(verifyCheckRunsRequest(mainSha,token),fetchImpl,budget);
  let verify;
  try{verify=verifyBody===null?null:classifyExactHeadVerify(verifyBody,mainSha);}catch{verify=null;}
  if(verify===null)return deepFreeze({ok:false,reasonCode:GITHUB_READ_FAILED});
  const runs=[];
  for(const workflowFile of GOVERNED_WORKFLOW_FILES){
    const listed=await readRunPages(workflowFile,token,now,fetchImpl,budget);
    if(listed===null)return deepFreeze({ok:false,reasonCode:GITHUB_READ_FAILED});
    for(const run of listed){
      const jobs=decodeJobs(await readJson(runJobsRequest(run.id,token),fetchImpl,budget));
      if(jobs===null)return deepFreeze({ok:false,reasonCode:GITHUB_READ_FAILED});
      runs.push({...run,kind:workflowFile===EXPECTED_WORKFLOW_C_FILE?'owner':'automatic',
        classification:classifyGovernedRun(jobs)});
    }
  }
  return deepFreeze({ok:true,reasonCode:GITHUB_OBSERVATION_OK,mainSha,verify,
    verifySuccess:verify===VERIFY_SUCCESS,day:interpretGithubDay({runs,now}),reads:budget.spent});
}

export const GITHUB_SENTINEL_CONSTANTS=deepFreeze({checkName:EXACT_HEAD_VERIFY_CHECK_NAME,
  appSlug:EXACT_HEAD_VERIFY_APP_SLUG,gateJob:EXPECTED_GATE_JOB,collectJob:EXPECTED_COLLECT_JOB,
  guardStep:EXPECTED_GUARD_STEP});
