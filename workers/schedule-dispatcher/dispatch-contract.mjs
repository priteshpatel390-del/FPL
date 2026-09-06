// DATA-S2C — the pure GitHub workflow_dispatch contract for the isolated schedule dispatcher.
//
// This module holds every fixed value and every decision the dispatcher makes, and it holds no
// I/O at all, so the whole state machine is provable without a network, a credential or a
// Cloudflare runtime.
//
// It is deliberately isolated: it imports nothing, it can reach nothing outside its own
// directory, and it knows nothing about Official FPL, D1, SQL, schemas, migrations, ceilings or
// collection semantics. The dispatcher is a timer, not the collection engine. The collection
// engine remains the GitHub Actions runner invoking the unchanged production entry point, and the
// historical Cloudflare Worker collector remains superseded and forbidden.
//
// The one credential this contract can ever name is the future secret binding
// `GITHUB_DISPATCH_TOKEN`. No Cloudflare account id, D1 token, D1 database id, account
// fingerprint, Official FPL endpoint, Anthropic key or Odds key appears anywhere in this Worker.

export const DISPATCH_REPOSITORY='priteshpatel390-del/FPL';
export const DISPATCH_WORKFLOW_FILE='data-s2-production-external.yml';
export const DISPATCH_WORKFLOW_PATH='.github/workflows/data-s2-production-external.yml';
export const DISPATCH_TOKEN_BINDING='GITHUB_DISPATCH_TOKEN';
export const DISPATCH_API_VERSION='2022-11-28';
export const DISPATCH_REF='main';
export const DISPATCH_URL=
  `https://api.github.com/repos/${DISPATCH_REPOSITORY}/actions/workflows/${DISPATCH_WORKFLOW_FILE}/dispatches`;
// No workflow inputs. The caller supplies the ref and nothing else; GitHub resolves the event SHA
// and the repository-side gates re-prove current main independently.
export const DISPATCH_BODY=JSON.stringify({ref:DISPATCH_REF,return_run_details:true});
export const DISPATCH_TIMEOUT_MS=15000;
// A latency measurement is only reported when it is a non-negative integer inside a day. Anything
// outside that is unavailable, and unavailable is reported as unavailable — never as zero.
export const MAX_LATENCY_MS=24*60*60*1000;

export const ACCEPTED_WITH_IDENTITY='ACCEPTED_WITH_IDENTITY';
export const ACCEPTED_NO_IDENTITY='ACCEPTED_NO_IDENTITY';
export const REJECTED='REJECTED';
export const AMBIGUOUS='AMBIGUOUS';

// Only responses whose no-side-effect semantics GitHub documents definitely may be REJECTED. Every
// other status — 5xx, 429, any 3xx, and anything unrecognised — is AMBIGUOUS, because a dispatch
// that may have been accepted must never be retried on a guess.
export const REJECTED_STATUSES=Object.freeze([401,403,404,422]);

export const DISPATCH_REASONS=Object.freeze(['dispatch_accepted','dispatch_token_missing',
  'dispatch_status_rejected','dispatch_body_invalid','dispatch_status_ambiguous',
  'dispatch_transport_failed']);

export function dispatchRequest(token){
  if(typeof token!=='string'||!token)throw new Error('dispatch_token_missing');
  return Object.freeze({
    url:DISPATCH_URL,
    init:Object.freeze({method:'POST',headers:Object.freeze({
      authorization:`Bearer ${token}`,accept:'application/vnd.github+json',
      'content-type':'application/json','x-github-api-version':DISPATCH_API_VERSION,
      'user-agent':'teamsheet-data-s2-dispatcher'}),body:DISPATCH_BODY})
  });
}

// The one bounded read that may follow an accepted dispatch, and only for the exact run identity
// the acceptance itself returned. The run list is never searched and no run is ever guessed at.
export function runReadRequest(runId,token){
  if(!Number.isSafeInteger(runId)||runId<=0)throw new Error('dispatch_run_id_invalid');
  if(typeof token!=='string'||!token)throw new Error('dispatch_token_missing');
  return Object.freeze({
    url:`https://api.github.com/repos/${DISPATCH_REPOSITORY}/actions/runs/${runId}`,
    init:Object.freeze({method:'GET',headers:Object.freeze({
      authorization:`Bearer ${token}`,accept:'application/vnd.github+json',
      'x-github-api-version':DISPATCH_API_VERSION,'user-agent':'teamsheet-data-s2-dispatcher'})})
  });
}

// A 200 body is identity only when it carries a positive safe integer run id and both URLs are
// exactly this repository's canonical paths for that same id. Any other shape — including a shape
// a future provider change might introduce — is not identity, and a 200 without identity is
// AMBIGUOUS rather than an assumed success.
export function validateRunIdentity(body){
  if(body===null||typeof body!=='object'||Array.isArray(body))return null;
  const runId=body.workflow_run_id;
  if(!Number.isSafeInteger(runId)||runId<=0)return null;
  if(body.run_url!==`https://api.github.com/repos/${DISPATCH_REPOSITORY}/actions/runs/${runId}`)return null;
  if(body.html_url!==`https://github.com/${DISPATCH_REPOSITORY}/actions/runs/${runId}`)return null;
  return runId;
}

export function classifyDispatchResponse({status,body=null}={}){
  if(status===200){
    const runId=validateRunIdentity(body);
    return runId===null
      ?Object.freeze({classification:AMBIGUOUS,reason:'dispatch_body_invalid',runId:null})
      :Object.freeze({classification:ACCEPTED_WITH_IDENTITY,reason:'dispatch_accepted',runId});
  }
  if(status===204)return Object.freeze({classification:ACCEPTED_NO_IDENTITY,reason:'dispatch_accepted',runId:null});
  if(REJECTED_STATUSES.includes(status))
    return Object.freeze({classification:REJECTED,reason:'dispatch_status_rejected',runId:null});
  return Object.freeze({classification:AMBIGUOUS,reason:'dispatch_status_ambiguous',runId:null});
}

export const boundedLatency=value=>
  Number.isFinite(value)&&Number.isInteger(value)&&value>=0&&value<=MAX_LATENCY_MS?value:null;

// Three separate measurements that are never conflated:
//
//   A  timer   — Cloudflare timer delivery: the handler starting, against the scheduled instant;
//   B  dispatch— GitHub run creation, against the instant GitHub accepted the dispatch;
//   C  total   — GitHub run creation, against the scheduled instant.
//
// B is structurally unavailable on ACCEPTED_NO_IDENTITY, because a 204 returns no run to read a
// creation time from. That stays honestly unavailable and is never filled in with zero.
export function dispatchTelemetry({classification,scheduledTime,handlerStart,acceptedAt=null,runCreatedAt=null}){
  const timerLatencyMs=boundedLatency(handlerStart-scheduledTime);
  const identified=classification===ACCEPTED_WITH_IDENTITY&&Number.isFinite(runCreatedAt);
  return Object.freeze({
    timerLatencyMs,
    dispatchLatencyMs:identified&&Number.isFinite(acceptedAt)?boundedLatency(runCreatedAt-acceptedAt):null,
    endToEndLatencyMs:identified?boundedLatency(runCreatedAt-scheduledTime):null
  });
}
