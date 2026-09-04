// DATA-S2B — strictly read-only credential/environment preflight for the unattended scheduled
// production boundary.
//
// This module proves one narrow thing and nothing else: that the GitHub environment
// `data-s2-production-scheduled` holds credentials that are internally consistent and can reach
// the reviewed production D1 database. It is a diagnostic, not a scheduler and not a collector.
//
// It is deliberately incapable of collection. It builds exactly two Cloudflare requests, both
// `GET`, neither of them the D1 `/query` endpoint; it accepts, builds and sends no SQL, no
// statement, no table name and no request body at all; and it has no mutation, migration,
// deployment, Cron, Worker, schedule or repair surface. Nothing here explains, touches or
// depends on GitHub's schedule-event creation, which is upstream of every credential this
// checks.
//
// Every value it handles is an identifier or a credential, so nothing it emits is derived from
// one. Failures are a closed set of stable sanitized classes; a request URL, an account id, a
// database id, a fingerprint, a token, an authorization header, a response body and a raw
// provider or transport error message never leave this module.
import {PRODUCTION_D1_ID} from '../production-collection.mjs';
import {derivedAccountFingerprint} from '../production-identity.mjs';

export const PREFLIGHT_PASS='PASS';
export const PREFLIGHT_FAIL='FAIL';

export const CHECK_ACCOUNT_FINGERPRINT='account_fingerprint';
export const CHECK_API_TOKEN_ACTIVE='api_token_active';
export const CHECK_PRODUCTION_D1_ACCESS='production_d1_access';
export const PREFLIGHT_CHECKS=Object.freeze([CHECK_ACCOUNT_FINGERPRINT,CHECK_API_TOKEN_ACTIVE,CHECK_PRODUCTION_D1_ACCESS]);

// Cloudflare's official read-only API-token verification endpoint. It carries no account scope
// and no resource identifier: the credential is the whole request.
export const TOKEN_VERIFY_URL='https://api.cloudflare.com/client/v4/user/tokens/verify';
export const ACTIVE_TOKEN_STATUS='active';
// Cloudflare's read-only D1 database detail endpoint. `D1:Read` is sufficient; it executes no SQL.
export const D1_METADATA_BASE_URL='https://api.cloudflare.com/client/v4/accounts';

const ACCOUNT_ID=/^[A-Za-z0-9_-]{1,128}$/;
const FINGERPRINT=/^[0-9a-f]{64}$/;

export class PreflightError extends Error{
  constructor(code,check){super(code);this.name='PreflightError';this.code=code;this.check=check;}
}
const fail=(code,check)=>{throw new PreflightError(code,check);};

// Check 1 — the environment's account credential and its account fingerprint must be the same
// account, under the repository's one canonical formula SHA-256(CLOUDFLARE_ACCOUNT_ID). The
// derivation is imported rather than restated so a competing definition cannot appear here.
export function assertAccountFingerprint(accountId,accountFingerprint){
  if(typeof accountId!=='string'||!ACCOUNT_ID.test(accountId))fail('preflight_account_id_invalid',CHECK_ACCOUNT_FINGERPRINT);
  if(typeof accountFingerprint!=='string'||!FINGERPRINT.test(accountFingerprint))fail('preflight_account_fingerprint_invalid',CHECK_ACCOUNT_FINGERPRINT);
  if(derivedAccountFingerprint(accountId)!==accountFingerprint)fail('preflight_account_fingerprint_mismatch',CHECK_ACCOUNT_FINGERPRINT);
  return CHECK_ACCOUNT_FINGERPRINT;
}

export function tokenVerifyRequest(token){
  if(typeof token!=='string'||!token)fail('preflight_token_missing',CHECK_API_TOKEN_ACTIVE);
  return Object.freeze({url:TOKEN_VERIFY_URL,check:CHECK_API_TOKEN_ACTIVE,prefix:'preflight_token_verify',
    init:Object.freeze({method:'GET',redirect:'error',
      headers:Object.freeze({Authorization:`Bearer ${token}`,Accept:'application/json'})})});
}

// The database id is never accepted from a caller as a target: it must be the reviewed
// repository constant, so no environment value can point this check at another database.
export function d1MetadataRequest({accountId,databaseId,token}={}){
  if(typeof accountId!=='string'||!ACCOUNT_ID.test(accountId))fail('preflight_account_id_invalid',CHECK_PRODUCTION_D1_ACCESS);
  if(databaseId!==PRODUCTION_D1_ID)fail('preflight_d1_identity_mismatch',CHECK_PRODUCTION_D1_ACCESS);
  if(typeof token!=='string'||!token)fail('preflight_token_missing',CHECK_PRODUCTION_D1_ACCESS);
  return Object.freeze({
    url:`${D1_METADATA_BASE_URL}/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}`,
    check:CHECK_PRODUCTION_D1_ACCESS,prefix:'preflight_d1_metadata',
    init:Object.freeze({method:'GET',redirect:'error',
      headers:Object.freeze({Authorization:`Bearer ${token}`,Accept:'application/json'})})});
}

export function classifyTokenVerify(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||payload.success!==true)
    fail('preflight_token_verify_contract_invalid',CHECK_API_TOKEN_ACTIVE);
  const result=payload.result;
  if(!result||typeof result!=='object'||Array.isArray(result)||typeof result.status!=='string'||!result.status)
    fail('preflight_token_verify_contract_invalid',CHECK_API_TOKEN_ACTIVE);
  if(result.status!==ACTIVE_TOKEN_STATUS)fail('preflight_token_not_active',CHECK_API_TOKEN_ACTIVE);
  return CHECK_API_TOKEN_ACTIVE;
}

// Success must mean the credentials authenticated AND the account reached this exact database.
// Cloudflare returns the database identity as `uuid`; `id` is accepted as an alias where it is
// present. Every identity the response does carry must equal the repository constant, and a
// response carrying none at all is a contract failure rather than a pass.
export function classifyD1Metadata(payload,databaseId){
  if(databaseId!==PRODUCTION_D1_ID)fail('preflight_d1_identity_mismatch',CHECK_PRODUCTION_D1_ACCESS);
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||payload.success!==true)
    fail('preflight_d1_metadata_contract_invalid',CHECK_PRODUCTION_D1_ACCESS);
  const result=payload.result;
  if(!result||typeof result!=='object'||Array.isArray(result))
    fail('preflight_d1_metadata_contract_invalid',CHECK_PRODUCTION_D1_ACCESS);
  const identities=['uuid','id'].map(key=>result[key]).filter(value=>value!==undefined&&value!==null);
  if(identities.length===0)fail('preflight_d1_metadata_contract_invalid',CHECK_PRODUCTION_D1_ACCESS);
  if(identities.some(value=>typeof value!=='string'||value!==databaseId))
    fail('preflight_d1_identity_mismatch',CHECK_PRODUCTION_D1_ACCESS);
  return CHECK_PRODUCTION_D1_ACCESS;
}

// One request, one bounded read, no retry. A transport, HTTP, authorization or decoding failure
// is converted into a stable class here so no provider or runtime message can escape.
async function readSanitizedJson(request,fetchImpl){
  const {check,prefix}=request;
  let response;
  try{response=await fetchImpl(request.url,request.init);}
  catch{fail(`${prefix}_transport_failed`,check);}
  const status=Number(response?.status);
  if(status===401||status===403)fail(`${prefix}_unauthorized`,check);
  if(status===404)fail(`${prefix}_not_found`,check);
  if(status===429)fail(`${prefix}_rate_limited`,check);
  if(!Number.isInteger(status)||status<200||status>=300)fail(`${prefix}_http_failed`,check);
  let payload;
  try{payload=typeof response.json==='function'?await response.json():JSON.parse(response.body);}
  catch{fail(`${prefix}_contract_invalid`,check);}
  return payload;
}

export async function runScheduledEnvironmentPreflight(options={}){
  const allowed=['accountId','accountFingerprint','databaseId','token','fetchImpl'];
  if(!options||typeof options!=='object'||Object.keys(options).some(key=>!allowed.includes(key)))
    fail('preflight_config_invalid',CHECK_ACCOUNT_FINGERPRINT);
  const {accountId,accountFingerprint,databaseId,token,fetchImpl=globalThis.fetch}=options;
  if(typeof fetchImpl!=='function')fail('preflight_config_invalid',CHECK_ACCOUNT_FINGERPRINT);

  // Ordered deliberately: the free local identity check runs before any credential leaves the
  // runner, so a mismatched environment never reaches Cloudflare at all.
  assertAccountFingerprint(accountId,accountFingerprint);
  classifyTokenVerify(await readSanitizedJson(tokenVerifyRequest(token),fetchImpl));
  classifyD1Metadata(await readSanitizedJson(d1MetadataRequest({accountId,databaseId,token}),fetchImpl),databaseId);

  return Object.freeze({result:PREFLIGHT_PASS,
    checks:Object.freeze(PREFLIGHT_CHECKS.map(check=>Object.freeze({check,status:PREFLIGHT_PASS})))});
}

// The only failure shape this preflight may report. An error that is not one of this module's
// own classes is reported as `preflight_unexpected_error`, because an arbitrary runtime message
// could carry a request URL and therefore an account or database identifier.
export function preflightFailure(error){
  const known=error instanceof PreflightError;
  return Object.freeze({result:PREFLIGHT_FAIL,
    check:known&&PREFLIGHT_CHECKS.includes(error.check)?error.check:'unknown',
    reason:known?error.code:'preflight_unexpected_error'});
}
