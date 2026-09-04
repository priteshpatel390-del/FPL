// DATA-S2B Stage D — bounded, read-only proof that the exact scheduled head passed CI.
//
// A manual production dispatch carries an owner-supplied `approved_sha` that the owner only
// supplies after seeing Verify Teamsheet pass. A scheduled event carries no such judgement: it
// fires at a fixed UTC minute and may fire while the exact-head `Tests and deterministic build`
// check for that same commit is still running. This module is the whole of the difference.
//
// It is deliberately narrow and fail-closed:
//
//   * it issues GitHub REST GETs and nothing else — it never dispatches a workflow, never
//     re-runs a job, never re-requests a check and never writes to GitHub;
//   * it accepts a check run only when the run is named exactly `Tests and deterministic build`,
//     is `completed`, concluded `success`, was produced by the `github-actions` app, links to an
//     Actions run in this repository, and carries the exact scheduled head SHA — a success on any
//     other commit is never evidence for this one;
//   * it waits only while a matching check exists but has not completed, only inside a fixed
//     attempt bound, and it stops on a completed non-success, on an exhausted bound and on an
//     absent check alike.
//
// It runs in the credential-free repository gate, before the protected production job exists, so
// nothing here has or needs Cloudflare authority.

export const EXACT_HEAD_VERIFY_REPOSITORY='priteshpatel390-del/FPL';
export const EXACT_HEAD_VERIFY_CHECK_NAME='Tests and deterministic build';
export const EXACT_HEAD_VERIFY_APP_SLUG='github-actions';
// Ten attempts thirty seconds apart bound the wait at nine sleep intervals — four and a half
// minutes of waiting — which is a bounded allowance for a Verify run that started moments before
// the scheduled event, not an open-ended poll. The job timeout bounds it a second time.
export const EXACT_HEAD_VERIFY_MAX_ATTEMPTS=10;
export const EXACT_HEAD_VERIFY_INTERVAL_MS=30000;

export const VERIFY_SUCCESS='verify_success';
export const VERIFY_PENDING='verify_pending';
export const VERIFY_FAILED='verify_failed';
export const VERIFY_ABSENT='verify_absent';

const SHA_PATTERN=/^[0-9a-f]{40}$/;

export const assertScheduledSha=sha=>{
  if(typeof sha!=='string'||!SHA_PATTERN.test(sha))throw new Error('scheduled_sha_invalid');
  return sha;
};

// A single check run is evidence for this commit only when every one of these holds.
const exactHeadRun=(row,sha)=>row!==null&&typeof row==='object'
  &&row.name===EXACT_HEAD_VERIFY_CHECK_NAME
  &&row.head_sha===sha
  &&row.app?.slug===EXACT_HEAD_VERIFY_APP_SLUG
  &&typeof row.details_url==='string'
  &&row.details_url.startsWith(`https://github.com/${EXACT_HEAD_VERIFY_REPOSITORY}/actions/runs/`);

export function classifyExactHeadVerify(body,sha){
  assertScheduledSha(sha);
  const runs=body?.check_runs;
  if(!Array.isArray(runs))throw new Error('verify_check_contract_invalid');
  const matching=runs.filter(row=>exactHeadRun(row,sha));
  // A completed success on this exact head is proof, exactly as the manual gate treats it, even
  // when an earlier attempt on the same commit failed and was re-run to green.
  if(matching.some(row=>row.status==='completed'&&row.conclusion==='success'))return VERIFY_SUCCESS;
  if(matching.some(row=>row.status==='completed'))return VERIFY_FAILED;
  return matching.length>0?VERIFY_PENDING:VERIFY_ABSENT;
}

export function exactHeadVerifyRequest(sha,token){
  assertScheduledSha(sha);
  if(typeof token!=='string'||!token)throw new Error('verify_check_token_missing');
  return Object.freeze({
    url:`https://api.github.com/repos/${EXACT_HEAD_VERIFY_REPOSITORY}/commits/${sha}/check-runs?per_page=100`,
    init:Object.freeze({method:'GET',headers:Object.freeze({
      authorization:`Bearer ${token}`,accept:'application/vnd.github+json',
      'x-github-api-version':'2022-11-28','user-agent':'teamsheet-data-s2-scheduled-gate'})})
  });
}

// Resolves only on a proven exact-head success. Every other terminal state throws, and the caller
// is a gate step whose failure stops the workflow before the production job can exist.
export async function awaitExactHeadVerify({sha,token,fetchImpl,sleep,
  maxAttempts=EXACT_HEAD_VERIFY_MAX_ATTEMPTS,intervalMs=EXACT_HEAD_VERIFY_INTERVAL_MS}){
  assertScheduledSha(sha);
  if(typeof fetchImpl!=='function'||typeof sleep!=='function')throw new Error('verify_check_caller_invalid');
  if(!Number.isSafeInteger(maxAttempts)||maxAttempts<1||maxAttempts>EXACT_HEAD_VERIFY_MAX_ATTEMPTS)
    throw new Error('verify_wait_bound_invalid');
  if(!Number.isSafeInteger(intervalMs)||intervalMs<0)throw new Error('verify_wait_bound_invalid');
  const request=exactHeadVerifyRequest(sha,token);
  let classification=VERIFY_ABSENT;
  for(let attempts=1;attempts<=maxAttempts;attempts+=1){
    const response=await fetchImpl(request.url,request.init);
    if(response?.status!==200)throw new Error('verify_check_http_failed');
    classification=classifyExactHeadVerify(await response.json(),sha);
    if(classification===VERIFY_SUCCESS)return Object.freeze({classification,attempts});
    if(classification===VERIFY_FAILED)throw new Error('verify_check_failed');
    if(attempts<maxAttempts)await sleep(intervalMs);
  }
  throw new Error(classification===VERIFY_PENDING?'verify_check_wait_exhausted':'verify_check_absent');
}
