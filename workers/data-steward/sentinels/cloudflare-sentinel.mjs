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
export const CLOUDFLARE_DEPLOYMENTS_READ_FAILED='CLOUDFLARE_DEPLOYMENTS_READ_FAILED';
export const CLOUDFLARE_SETTINGS_READ_FAILED='CLOUDFLARE_SETTINGS_READ_FAILED';
// Live evidence (run 34311398342) proved identity admission now succeeds and the failure narrows
// to the first fixed read, `/schedules`, but the still-collapsed per-stage code could not say
// which broad category of failure that was. These five replace it for `/schedules` only — the
// classification is read internally from the HTTP status and then discarded; only the matching
// enum below ever leaves this module.
export const CLOUDFLARE_SCHEDULES_AUTH_REFUSED='CLOUDFLARE_SCHEDULES_AUTH_REFUSED';
export const CLOUDFLARE_SCHEDULES_NOT_FOUND='CLOUDFLARE_SCHEDULES_NOT_FOUND';
export const CLOUDFLARE_SCHEDULES_HTTP_FAILED='CLOUDFLARE_SCHEDULES_HTTP_FAILED';
// Live evidence (run 34319945520) proved identity admission succeeds, the request reaches
// HTTP 200, and the still-collapsed `CLOUDFLARE_SCHEDULES_RESPONSE_INVALID` code could not say
// which of three response-processing layers actually failed. These three replace it: they are
// read internally from which step (JSON parse, envelope decode, payload decode) first produced
// an unusable result, and only the matching enum below ever leaves this module. `decodeEnvelope`
// and `decodeSchedules` are invoked exactly as before and are not changed by this split.
export const CLOUDFLARE_SCHEDULES_JSON_INVALID='CLOUDFLARE_SCHEDULES_JSON_INVALID';
export const CLOUDFLARE_SCHEDULES_ENVELOPE_INVALID='CLOUDFLARE_SCHEDULES_ENVELOPE_INVALID';
export const CLOUDFLARE_SCHEDULES_TRANSPORT_FAILED='CLOUDFLARE_SCHEDULES_TRANSPORT_FAILED';
// Live evidence (run 34325772296, head dea6a3239443970dd2e5495fe7759e187fb34e20) proved identity
// admission succeeds, the request reaches HTTP 200, JSON parsing succeeds and the Cloudflare
// envelope decodes, so the failure sits specifically inside the still-collapsed
// `CLOUDFLARE_SCHEDULES_PAYLOAD_INVALID` code — it could not say which of `decodeSchedules`'s own
// predicates rejected the live result. These five replace it, one per predicate, in the exact
// order `decodeSchedules` evaluates them; `classifySchedulesPayload` below is the single shared
// definition of those predicates, so `decodeSchedules` and this classification can never drift
// apart into two competing notions of "valid".
export const CLOUDFLARE_SCHEDULES_RESULT_INVALID='CLOUDFLARE_SCHEDULES_RESULT_INVALID';
export const CLOUDFLARE_SCHEDULES_ARRAY_INVALID='CLOUDFLARE_SCHEDULES_ARRAY_INVALID';
export const CLOUDFLARE_SCHEDULES_COUNT_EXCEEDED='CLOUDFLARE_SCHEDULES_COUNT_EXCEEDED';
export const CLOUDFLARE_SCHEDULES_CRON_NOT_STRING='CLOUDFLARE_SCHEDULES_CRON_NOT_STRING';
export const CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED='CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED';
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

// Live evidence (run 34342701912, head dfc78882a507e90662f2937582ab0b35af34bdec) proved that a
// byte-identical-text requirement was itself wrong: the owner's Cloudflare dashboard showed the
// approved daily 01:17 trigger can be represented as a full day-of-month enumeration
// (`17 1 1,2,3,...,31 * *`) rather than the repository's textual wildcard (`17 1 * * *`) — the same
// schedule, a different valid Cloudflare text encoding of it. A per-field length cap sized for the
// wildcard form rejected that legitimate encoding before semantic comparison ever ran. This module
// therefore parses and canonicalises only the narrow schedule subset this observer needs, rather
// than accepting or further widening arbitrary Cron text: exactly five fields; minute `0`-`59` and
// hour `0`-`23` as one or two decimal digits; day-of-month either `*` or the complete `1`..`31`
// domain as a comma list with no gap, duplicate or out-of-range entry; month and day-of-week always
// `*`. A day-of-month enumeration that is complete canonicalises to `*`; anything else — a partial
// list, a duplicate, an out-of-range value, a non-numeric minute/hour, a wrong field count, or any
// unsupported month/day-of-week value — is rejected outright rather than partially interpreted.
// Canonicalisation never widens what is *accepted* as a schedule: it only lets two different valid
// Cloudflare encodings of the same schedule compare equal, and `cronSetMatches()` below still
// requires the canonicalised set to equal the three approved expressions exactly, so a canonicalised
// but different schedule (`18 1 * * *` say) still reaches `CLOUDFLARE_CRON_SET_MISMATCH` rather than
// being mistaken for an approved one.
const CRON_MAX_LENGTH=128;
const CRON_MINUTE_OR_HOUR=/^[0-9]{1,2}$/;
const DAY_OF_MONTH_DOMAIN_SIZE=31;

function canonicaliseBoundedInt(field,max){
  if(!CRON_MINUTE_OR_HOUR.test(field))return null;
  const value=Number(field);
  return value<=max?value:null;
}

// A day-of-month field is accepted only as the literal wildcard, or as a comma list that is
// provably the complete 1..31 domain — no gap, no duplicate, no out-of-range value, in any order.
// Anything else fails closed rather than being partially matched against the domain.
function canonicaliseDayOfMonth(field){
  if(field==='*')return '*';
  const parts=field.split(',');
  if(parts.length!==DAY_OF_MONTH_DOMAIN_SIZE)return null;
  const days=new Set();
  for(const part of parts){
    const day=canonicaliseBoundedInt(part,DAY_OF_MONTH_DOMAIN_SIZE);
    if(day===null||day<1)return null;
    if(days.has(day))return null;
    days.add(day);
  }
  return days.size===DAY_OF_MONTH_DOMAIN_SIZE?'*':null;
}

// Parses exactly the supported schedule subset and returns its canonical text, or `null` if the
// expression is not exactly one of that subset's legitimate encodings. Never returns the raw input
// unmodified when a day-of-month enumeration was expanded, so a canonicalised result is always safe
// to echo: it is one of a closed set of shapes this module itself constructs.
function canonicaliseCron(cron){
  if(typeof cron!=='string'||cron.length>CRON_MAX_LENGTH)return null;
  const fields=cron.split(' ');
  if(fields.length!==5)return null;
  const [minuteField,hourField,dayOfMonthField,monthField,dayOfWeekField]=fields;
  const minute=canonicaliseBoundedInt(minuteField,59);
  if(minute===null)return null;
  const hour=canonicaliseBoundedInt(hourField,23);
  if(hour===null)return null;
  const dayOfMonth=canonicaliseDayOfMonth(dayOfMonthField);
  if(dayOfMonth===null)return null;
  if(monthField!=='*'||dayOfWeekField!=='*')return null;
  return `${minute} ${hour} ${dayOfMonth} * *`;
}

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

// The one place the `/schedules` payload predicates are written down, evaluated in a single pass
// in the exact order they have always been checked. Every other function that needs to know
// whether a result is a valid schedules payload — the diagnostic classification, the decoder, and
// the live per-cycle read — calls this once and reads the answer it needs from its result, so the
// predicates themselves exist in exactly one place and cannot drift into two different notions of
// "valid". `crons` is the successful extraction, canonicalised through `canonicaliseCron` (same
// row order, same string-row/`row.cron` acceptance as before; a day-of-month enumeration that is
// the complete domain is folded to `*`, so two legitimate Cloudflare encodings of the same schedule
// compare equal downstream); `reasonCode` is `null` on success and one of the five closed
// schedules-payload codes otherwise. Exactly one of the two is non-null.
function analyseSchedulesPayload(result){
  if(result===null||typeof result!=='object'||Array.isArray(result))
    return {reasonCode:CLOUDFLARE_SCHEDULES_RESULT_INVALID,crons:null};
  if(!Array.isArray(result.schedules))
    return {reasonCode:CLOUDFLARE_SCHEDULES_ARRAY_INVALID,crons:null};
  if(result.schedules.length>16)
    return {reasonCode:CLOUDFLARE_SCHEDULES_COUNT_EXCEEDED,crons:null};
  const crons=[];
  for(const row of result.schedules){
    const cron=typeof row==='string'?row:row?.cron;
    if(typeof cron!=='string')return {reasonCode:CLOUDFLARE_SCHEDULES_CRON_NOT_STRING,crons:null};
    const canonical=canonicaliseCron(cron);
    if(canonical===null)return {reasonCode:CLOUDFLARE_SCHEDULES_CRON_PATTERN_REJECTED,crons:null};
    crons.push(canonical);
  }
  return {reasonCode:null,crons};
}

// Delegates to `analyseSchedulesPayload` rather than repeating its predicates.
export function classifySchedulesPayload(result){
  return analyseSchedulesPayload(result).reasonCode;
}

// `GET .../schedules` returns `{ schedules: [{ cron, created_on, modified_on }] }`. Only the cron
// expressions are extracted; timestamps and any other field are deliberately left behind. Delegates
// to `analyseSchedulesPayload` rather than repeating its predicates.
export function decodeSchedules(result){
  return analyseSchedulesPayload(result).crons;
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

// The one narrow exception to the generic `read()` helper above: `/schedules` is the read live
// evidence has now repeatedly named as the actual failure point, so its failure is classified
// into one of eleven closed categories instead of collapsing into a single code — six for
// transport/HTTP/JSON/envelope failure, five for the individual `decodeSchedules` predicates via
// `classifySchedulesPayload`. The classification reads `response.status` and which
// response-processing step or decoder predicate first produced an unusable result, entirely
// internally, to select an enum member and nothing else — the status, any provider body, message,
// header, the request URL, or any exception/parse-error text never leave this function. Exactly
// one request is issued, matching the generic helper's shape exactly. `decodeEnvelope` is called
// exactly as the generic `read()` helper would call it; a decoded envelope is passed to
// `analyseSchedulesPayload` exactly once — never through `decodeSchedules` and
// `classifySchedulesPayload` separately — so a live cycle runs the five payload predicates a single
// time. Only the failure of each step is named separately instead of being folded into one code.
async function readSchedulesStage(request,fetchImpl){
  let response;
  try{
    response=await fetchImpl(request.url,{...request.init,signal:AbortSignal.timeout(CLOUDFLARE_REQUEST_TIMEOUT_MS)});
  }catch{
    return {crons:null,reasonCode:CLOUDFLARE_SCHEDULES_TRANSPORT_FAILED};
  }
  const status=response?.status;
  if(status===401||status===403)return {crons:null,reasonCode:CLOUDFLARE_SCHEDULES_AUTH_REFUSED};
  if(status===404)return {crons:null,reasonCode:CLOUDFLARE_SCHEDULES_NOT_FOUND};
  if(status!==200)return {crons:null,reasonCode:CLOUDFLARE_SCHEDULES_HTTP_FAILED};
  let body;
  try{body=await response.json();}catch{
    return {crons:null,reasonCode:CLOUDFLARE_SCHEDULES_JSON_INVALID};
  }
  const envelope=decodeEnvelope(body);
  if(envelope===null)return {crons:null,reasonCode:CLOUDFLARE_SCHEDULES_ENVELOPE_INVALID};
  return analyseSchedulesPayload(envelope);
}

// Issues exactly the three fixed reads and returns the decoded configuration view. Every failure
// is a failed observation carrying a closed reason code; no request URL, account id, token,
// header, response body or provider error message ever leaves this module.
export async function readCloudflareConfiguration({accountId,accountFingerprint,token,fetchImpl}){
  if(typeof fetchImpl!=='function')fail('cloudflare_input_invalid');
  try{assertProductionAccount({accountId,accountFingerprint});}
  catch{return deepFreeze({ok:false,reasonCode:CLOUDFLARE_IDENTITY_MISMATCH});}
  const schedulesStage=await readSchedulesStage(cloudflareReadRequest(CLOUDFLARE_READ_SCHEDULES,{accountId,token}),fetchImpl);
  if(schedulesStage.crons===null)return deepFreeze({ok:false,reasonCode:schedulesStage.reasonCode});
  const schedules=schedulesStage.crons;
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
