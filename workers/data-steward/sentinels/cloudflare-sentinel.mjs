// DATA-OPS-A1.2 — the read-only Cloudflare sentinel.
//
// It observes the Cloudflare portion of the chain that ACTUALLY EXISTS: an isolated dispatcher
// Worker armed by Cron Triggers. There is no Cloudflare Workflow in this architecture and this
// module must never be extended into one unless `main` genuinely changes.
//
// WHAT IT CAN PROVE, AND WHAT IT DELIBERATELY CANNOT.
//
// It proves configuration identity: that the expected dispatcher Worker exists under the expected
// account, what its live Cron Trigger set is, and whether that set is exactly the three
// owner-approved opportunities. Those three reads use endpoint shapes this repository has already
// exercised live and read-only against production Cloudflare in the Phase 4B diagnostics bundle.
//
// It CANNOT prove that any individual scheduled fire happened, or what that fire returned.
// Cloudflare's dashboard exposes Cron Events as invocation history, but this repository has not
// proven a supported read-only API that returns per-fire dispatcher invocation outcomes, and no
// endpoint is invented here to pretend otherwise. Dispatcher execution is therefore reported as
// `OBSERVATION_UNAVAILABLE` — a named, permanent limitation — and it can never contribute to a
// healthy verdict. Execution causality is established downstream instead, from GitHub's own
// record of whether workflow B actually appeared and ran, and from production D1. ABSENCE OF
// VISIBILITY IS NEVER TURNED INTO GREEN.
//
// READ-ONLY BY CONSTRUCTION. Every request builder emits `method:'GET'` against one of three
// fixed paths under one fixed Worker name. There is no Worker upload, deploy, version promotion,
// rollback, Cron create/update/delete, secret, route, domain, binding, D1 or arbitrary-API
// surface, and no builder accepts a method, a path, a query or a body from a caller. The minimum
// Cloudflare API-token permission for this sentinel is account-scoped `Workers Scripts: Read`,
// and nothing here needs or requests more.
import {deepFreeze} from '../../../src/decision-intelligence/canonical.mjs';
import {derivedAccountFingerprint} from '../../data-platform/production-identity.mjs';
import {EXPECTED_CRON_EXPRESSIONS,EXPECTED_DISPATCHER_WORKER} from './production-chain-contract.mjs';

export const CLOUDFLARE_SENTINEL_ID='cloudflare';
export const CLOUDFLARE_SENTINEL_VERSION='data-ops-a1.2-cloudflare-v1';
export const CLOUDFLARE_API_BASE='https://api.cloudflare.com/client/v4';
export const CLOUDFLARE_REQUEST_TIMEOUT_MS=15000;

// Exactly three reads, and a hard cap that matches them. A fourth request is a defect, not a
// budget question.
export const CLOUDFLARE_READ_SCHEDULES='schedules';
export const CLOUDFLARE_READ_DEPLOYMENTS='deployments';
export const CLOUDFLARE_READ_SETTINGS='settings';
export const CLOUDFLARE_READS=deepFreeze([CLOUDFLARE_READ_SCHEDULES,CLOUDFLARE_READ_DEPLOYMENTS,
  CLOUDFLARE_READ_SETTINGS]);
export const CLOUDFLARE_SENTINEL_MAX_READS=3;

export const CLOUDFLARE_OBSERVATION_OK='CLOUDFLARE_CONFIGURATION_OBSERVED';
// Live evidence (run 34277208819) proved the collapsed `CLOUDFLARE_READ_FAILED` code could not
// identify which of the three fixed reads actually failed. Each read now carries its own closed
// reason code instead, naming only the stage — never a status, provider message, URL or body.
export const CLOUDFLARE_SCHEDULES_READ_FAILED='CLOUDFLARE_SCHEDULES_READ_FAILED';
export const CLOUDFLARE_DEPLOYMENTS_READ_FAILED='CLOUDFLARE_DEPLOYMENTS_READ_FAILED';
export const CLOUDFLARE_SETTINGS_READ_FAILED='CLOUDFLARE_SETTINGS_READ_FAILED';
export const CLOUDFLARE_IDENTITY_MISMATCH='CLOUDFLARE_IDENTITY_MISMATCH';
export const CLOUDFLARE_CRON_MISMATCH='CLOUDFLARE_CRON_SET_MISMATCH';
// The permanent, named limitation. It is a reason code rather than a silence so that it appears
// in the observation record every cycle instead of being forgotten.
export const CLOUDFLARE_INVOCATION_UNOBSERVABLE='CLOUDFLARE_INVOCATION_HISTORY_UNOBSERVABLE';

export class CloudflareSentinelError extends Error{
  constructor(code){super(code);this.name='CloudflareSentinelError';this.code=code;}
}
const fail=code=>{throw new CloudflareSentinelError(code);};

const ACCOUNT_ID=/^[A-Za-z0-9_-]{1,128}$/;
const FINGERPRINT=/^[0-9a-f]{64}$/;
// A cron expression is echoed back into the observation record, so it is bounded to the shape
// Cloudflare accepts and nothing else may travel in that field.
const CRON=/^[0-9A-Z*,\-/?#]{1,16}(?: [0-9A-Z*,\-/?#]{1,16}){4}$/;

// The one Worker this sentinel may ever address, and the three fixed paths under it.
export function workerBase(accountId){
  if(typeof accountId!=='string'||!ACCOUNT_ID.test(accountId))fail('cloudflare_account_invalid');
  return `/accounts/${encodeURIComponent(accountId)}/workers/scripts/${EXPECTED_DISPATCHER_WORKER}`;
}

export function cloudflareReadRequest(read,{accountId,token}){
  if(!CLOUDFLARE_READS.includes(read))fail('cloudflare_read_forbidden');
  if(typeof token!=='string'||!token)fail('cloudflare_token_missing');
  return Object.freeze({
    url:`${CLOUDFLARE_API_BASE}${workerBase(accountId)}/${read}`,
    init:Object.freeze({method:'GET',redirect:'error',headers:Object.freeze({
      authorization:`Bearer ${token}`,accept:'application/json'})})
  });
}

// Cloudflare wraps every v4 response in an envelope. A body that is not that envelope, or whose
// `success` is not exactly `true`, is not partially interpreted.
export function decodeEnvelope(body){
  if(body===null||typeof body!=='object'||Array.isArray(body))return null;
  if(body.success!==true)return null;
  return Object.hasOwn(body,'result')?body.result:null;
}

// `GET .../schedules` returns `{ schedules: [{ cron, created_on, modified_on }] }`. Only the cron
// expressions are extracted; timestamps and any other field are deliberately left behind.
export function decodeSchedules(result){
  if(result===null||typeof result!=='object'||Array.isArray(result))return null;
  if(!Array.isArray(result.schedules)||result.schedules.length>16)return null;
  const crons=[];
  for(const row of result.schedules){
    const cron=typeof row==='string'?row:row?.cron;
    if(typeof cron!=='string'||!CRON.test(cron))return null;
    crons.push(cron);
  }
  return crons;
}

// `GET .../deployments` returns the Worker's deployment history. Only the newest deployment's own
// identity and instant are extracted, because that is the only fact the observation needs: which
// version of the dispatcher is live and when it became live.
export function decodeDeployments(result){
  if(result===null||typeof result!=='object'||Array.isArray(result))return null;
  const list=Array.isArray(result.deployments)?result.deployments:null;
  if(list===null||list.length===0)return null;
  const [newest]=list;
  if(newest===null||typeof newest!=='object'||Array.isArray(newest))return null;
  const id=newest.id;
  const createdOn=newest.created_on;
  if(typeof id!=='string'||!/^[0-9a-fA-F-]{1,64}$/.test(id))return null;
  if(typeof createdOn!=='string'||!Number.isFinite(Date.parse(createdOn)))return null;
  return {deploymentId:id.toLowerCase(),deployedAt:new Date(Date.parse(createdOn)).toISOString()};
}

// `GET .../settings` carries the Worker's observability flag. It is recorded as a fact about the
// deployed Worker; it is never used as proof that any fire occurred.
export function decodeSettings(result){
  if(result===null||typeof result!=='object'||Array.isArray(result))return null;
  const observability=result.observability;
  if(observability===undefined||observability===null)return {observabilityEnabled:null};
  if(typeof observability!=='object'||Array.isArray(observability))return null;
  return {observabilityEnabled:observability.enabled===true};
}

// The live Cron Trigger set must be exactly the three owner-approved opportunities. Order is not
// significant — Cloudflare does not promise one — but membership and multiplicity are.
export function cronSetMatches(crons){
  if(!Array.isArray(crons))return false;
  const observed=[...crons].sort();
  const expected=[...EXPECTED_CRON_EXPRESSIONS].sort();
  return observed.length===expected.length&&observed.every((value,index)=>value===expected[index]);
}

// The account this sentinel is pointed at must be the reviewed production account. The fingerprint
// is supplied by configuration and compared with the SHA-256 of the supplied account id through
// the existing canonical helper rather than a competing local definition; deriving it from the
// credential it validates would make the check tautological, so a missing fingerprint fails
// closed rather than being derived.
export function assertProductionAccount({accountId,accountFingerprint}){
  if(typeof accountId!=='string'||!ACCOUNT_ID.test(accountId))fail('cloudflare_account_invalid');
  if(typeof accountFingerprint!=='string'||!FINGERPRINT.test(accountFingerprint))fail('cloudflare_account_unproven');
  if(derivedAccountFingerprint(accountId)!==accountFingerprint)fail('cloudflare_account_mismatch');
  return true;
}

async function read(request,fetchImpl){
  let response;
  try{
    response=await fetchImpl(request.url,{...request.init,signal:AbortSignal.timeout(CLOUDFLARE_REQUEST_TIMEOUT_MS)});
  }catch{return null;}
  if(response?.status!==200)return null;
  let body;
  try{body=await response.json();}catch{return null;}
  return decodeEnvelope(body);
}

// Issues exactly the three fixed reads and returns the decoded configuration view. Every failure
// is a failed observation carrying a closed reason code; no request URL, account id, token,
// header, response body or provider error message ever leaves this module.
export async function readCloudflareConfiguration({accountId,accountFingerprint,token,fetchImpl}){
  if(typeof fetchImpl!=='function')fail('cloudflare_input_invalid');
  try{assertProductionAccount({accountId,accountFingerprint});}
  catch{return deepFreeze({ok:false,reasonCode:CLOUDFLARE_IDENTITY_MISMATCH});}
  const schedules=decodeSchedules(await read(cloudflareReadRequest(CLOUDFLARE_READ_SCHEDULES,{accountId,token}),fetchImpl));
  if(schedules===null)return deepFreeze({ok:false,reasonCode:CLOUDFLARE_SCHEDULES_READ_FAILED});
  const deployment=decodeDeployments(await read(cloudflareReadRequest(CLOUDFLARE_READ_DEPLOYMENTS,{accountId,token}),fetchImpl));
  if(deployment===null)return deepFreeze({ok:false,reasonCode:CLOUDFLARE_DEPLOYMENTS_READ_FAILED});
  const settings=decodeSettings(await read(cloudflareReadRequest(CLOUDFLARE_READ_SETTINGS,{accountId,token}),fetchImpl));
  if(settings===null)return deepFreeze({ok:false,reasonCode:CLOUDFLARE_SETTINGS_READ_FAILED});
  const cronSetExpected=cronSetMatches(schedules);
  return deepFreeze({
    ok:cronSetExpected,
    reasonCode:cronSetExpected?CLOUDFLARE_OBSERVATION_OK:CLOUDFLARE_CRON_MISMATCH,
    worker:EXPECTED_DISPATCHER_WORKER,
    cronExpressions:deepFreeze([...schedules].sort()),
    cronSetExpected,
    deploymentId:deployment.deploymentId,
    deployedAt:deployment.deployedAt,
    observabilityEnabled:settings.observabilityEnabled,
    // Restated on every successful read so the limitation is visible in the record rather than
    // implied by its absence.
    invocationHistory:CLOUDFLARE_INVOCATION_UNOBSERVABLE,
    reads:CLOUDFLARE_SENTINEL_MAX_READS
  });
}
