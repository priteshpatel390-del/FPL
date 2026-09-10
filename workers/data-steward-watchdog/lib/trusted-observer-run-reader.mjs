// DATA-OPS A1.4 — exact-run GitHub evidence reader.
// The only run id accepted here comes from the isolated Cloudflare observer-clock receipt ledger.
// All requests are GETs and target only that exact run, its observer job and that job's log.
import {decodeJobs,decodeObserverSummary,GITHUB_EVIDENCE_API_VERSION,GITHUB_EVIDENCE_JOB_NAME,
  GITHUB_EVIDENCE_REPOSITORY,GITHUB_EVIDENCE_REQUEST_TIMEOUT_MS,GITHUB_EVIDENCE_SUMMARY_LOG_MAX_BYTES,
  JOB_HEALTH_FAILED,JOB_HEALTH_SUCCESS,READ_OK,READ_UNAVAILABLE,classifyJobHealth,jobLogRequest,
  runJobsRequest} from './github-evidence-reader.mjs';
import {deepFreeze} from './canonical.mjs';

const WORKFLOW_NAME='Data Steward Read-Only Observer';
const WORKFLOW_PATH='.github/workflows/data-steward-readonly-observer.yml';
const SHA=/^[0-9a-f]{40}$/;
const runIdValid=value=>Number.isSafeInteger(value)&&value>0;

function headers(token){
  if(typeof token!=='string'||!token)throw new Error('github_evidence_token_missing');
  return Object.freeze({authorization:`Bearer ${token}`,accept:'application/vnd.github+json',
    'x-github-api-version':GITHUB_EVIDENCE_API_VERSION,'user-agent':'teamsheet-data-steward-watchdog'});
}

export function trustedWorkflowRunRequest(runId,token){
  if(!runIdValid(runId))throw new Error('github_evidence_run_id_invalid');
  return Object.freeze({url:`https://api.github.com/repos/${GITHUB_EVIDENCE_REPOSITORY}/actions/runs/${runId}`,
    init:Object.freeze({method:'GET',headers:headers(token)})});
}

export function decodeTrustedWorkflowRun(body,expectedRunId){
  if(body===null||typeof body!=='object'||Array.isArray(body)||body.id!==expectedRunId)return null;
  if(body.name!==WORKFLOW_NAME||body.path!==WORKFLOW_PATH||body.event!=='workflow_dispatch'
    ||body.head_branch!=='main'||typeof body.head_sha!=='string'||!SHA.test(body.head_sha))return null;
  if(typeof body.status!=='string'||(body.conclusion!==null&&typeof body.conclusion!=='string'))return null;
  const created=Date.parse(body.created_at);
  if(!Number.isFinite(created))return null;
  return Object.freeze({id:body.id,createdAt:new Date(created).toISOString(),event:'workflow_dispatch',
    headSha:body.head_sha,status:body.status,conclusion:body.conclusion??null});
}

async function fetchJson(request,fetchImpl){
  let response;
  try{response=await fetchImpl(request.url,{...request.init,
    signal:AbortSignal.timeout(GITHUB_EVIDENCE_REQUEST_TIMEOUT_MS)});}catch{return null;}
  if(response?.status!==200)return null;
  try{return await response.json();}catch{return null;}
}

async function readSummary(jobId,token,fetchImpl){
  const request=jobLogRequest(jobId,token);
  let response;
  try{response=await fetchImpl(request.url,{...request.init,
    signal:AbortSignal.timeout(GITHUB_EVIDENCE_REQUEST_TIMEOUT_MS)});}catch{return null;}
  if(response?.status!==200||typeof response.body?.getReader!=='function')return null;
  const declaredRaw=response.headers?.get?.('content-length');
  let declared=null;
  if(declaredRaw!==null&&declaredRaw!==undefined){
    if(typeof declaredRaw!=='string'||!/^(?:0|[1-9][0-9]{0,6})$/.test(declaredRaw))return null;
    declared=Number(declaredRaw);
    if(declared>GITHUB_EVIDENCE_SUMMARY_LOG_MAX_BYTES)return null;
  }
  const chunks=[];
  let total=0;
  try{
    const reader=response.body.getReader();
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      if(!(value instanceof Uint8Array)||total+value.byteLength>GITHUB_EVIDENCE_SUMMARY_LOG_MAX_BYTES){
        await reader.cancel();return null;
      }
      chunks.push(value);total+=value.byteLength;
    }
  }catch{return null;}
  if(declared!==null&&declared!==total)return null;
  const bytes=new Uint8Array(total);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try{return decodeObserverSummary(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
  catch{return null;}
}

export async function readTrustedObserverRun({runId,token,fetchImpl}){
  if(!runIdValid(runId)||typeof fetchImpl!=='function')
    return deepFreeze({ok:false,reasonCode:READ_UNAVAILABLE});
  const runBody=await fetchJson(trustedWorkflowRunRequest(runId,token),fetchImpl);
  const run=decodeTrustedWorkflowRun(runBody,runId);
  if(run===null)return deepFreeze({ok:false,reasonCode:READ_UNAVAILABLE});
  const jobs=decodeJobs(await fetchJson(runJobsRequest(runId,token),fetchImpl));
  if(jobs===null)return deepFreeze({ok:false,reasonCode:READ_UNAVAILABLE});
  const observerJobs=jobs.filter(job=>job.name===GITHUB_EVIDENCE_JOB_NAME);
  if(observerJobs.length===0)return deepFreeze({ok:false,reasonCode:READ_UNAVAILABLE});
  const latest=observerJobs.reduce((best,job)=>job.runAttempt>best.runAttempt?job:best,observerJobs[0]);
  const jobHealth=classifyJobHealth(latest);
  const summaryAttempted=jobHealth===JOB_HEALTH_SUCCESS||jobHealth===JOB_HEALTH_FAILED;
  const summary=summaryAttempted?await readSummary(latest.id,token,fetchImpl):null;
  return deepFreeze({ok:true,reasonCode:READ_OK,run:deepFreeze({...run,jobHealth,
    jobConclusion:latest.conclusion,jobCompletedAt:latest.completedAt,runAttempt:latest.runAttempt,
    summaryAttempted,summary})});
}
