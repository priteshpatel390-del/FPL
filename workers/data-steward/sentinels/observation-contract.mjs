// DATA-OPS-A1.2 — the repository-owned evidence envelope every sentinel must produce.
//
// A1.1 established the trust boundary: supplied evidence → incident classification → untrusted
// proposal → deterministic policy decision → audit. A1.2 supplies observations INTO that
// boundary and must not widen it. The single rule this module exists to enforce is that a raw
// provider object never reaches classification: GitHub, Cloudflare and D1 responses are decoded
// into a fixed, versioned, canonical envelope first, and only the envelope travels onwards.
//
// The envelope carries no secret, no credential, no request URL, no authorization header, no raw
// log line and no free-form provider text. It carries a closed source type, a bounded subject
// identity, timestamps, one closed normalized state, bounded provenance references, and a
// deterministic hash of its own canonical form.
//
// Observation states are DELIBERATELY NOT operational states. `GREEN`/`AMBER`/`RED` remain
// A1.1's, and A1.2 registers no new classification authority: an envelope says only what was
// observed and how confidently, and a `NOT_DUE` or `AWAITING_LATER_OPPORTUNITY` envelope is a
// statement about the evaluation window, never a decision, never an authorization and never a
// remediation class. AMBER is never produced anywhere in A1.2.
import {canonicalise,deepFreeze,sha256Hex,stableStringify,secretFinding}
  from '../../../src/decision-intelligence/canonical.mjs';

export const OBSERVATION_SCHEMA_VERSION='data-ops-a1.2-observation-v1';

// The closed set of sources A1.2 may observe. Nothing else can produce an envelope, so a future
// provider cannot be smuggled in as an observation source without a repository change.
export const OBSERVATION_SOURCES=deepFreeze(['github','cloudflare','d1','steward']);

// The closed set of observation outcomes.
//
//   OBSERVED                    the fact was read and decoded successfully
//   NOT_DUE                     the evaluation window has not opened yet
//   AWAITING_LATER_OPPORTUNITY  the window is open, the fact is not yet provable, and at least
//                               one further scheduled opportunity remains inside the window
//   NOT_EVALUATED               the sentinel was deliberately not run this cycle
//   OBSERVATION_UNAVAILABLE     no supported read-only API can establish the fact at all
//   OBSERVATION_FAILED          a read was attempted and could not be completed or decoded
//   OBSERVATION_STALE           the fact was read, but too long ago to still be load-bearing
//
// Only OBSERVED can ever contribute to a healthy verdict. Every other state is an absence of
// proof, and absence of proof never becomes proof of health.
export const OBSERVATION_STATES=deepFreeze(['OBSERVED','NOT_DUE','AWAITING_LATER_OPPORTUNITY',
  'NOT_EVALUATED','OBSERVATION_UNAVAILABLE','OBSERVATION_FAILED','OBSERVATION_STALE']);

export const PROVING_OBSERVATION_STATE='OBSERVED';

const ENVELOPE_KEYS=Object.freeze(['sourceType','sourceIdentity','subjectIdentity','observedAt',
  'subjectTime','observationState','reasonCode','normalizedState','provenance','freshnessAgeMs']);

const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)
  &&stableStringify(Object.keys(value).sort())===stableStringify(keys.slice().sort());
const text=(value,pattern)=>typeof value==='string'&&pattern.test(value);
const iso=value=>text(value,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)&&Number.isFinite(Date.parse(value));

// Provenance is a reference, never a payload: it names where a fact came from in a shape the
// A1.1 incident contract already accepts, so an envelope reference can be handed to an incident
// without reshaping and without carrying provider text.
// Deliberately NARROWER than the A1.1 incident pattern this feeds. A1.1 accepts any reference
// shaped like `word:path`, which a URL also satisfies; A1.2 requires a closed source prefix and a
// path with no scheme, no host and no query, so a raw provider URL can never become provenance.
const REFERENCE=/^(?:github|cloudflare|d1|steward):[a-z0-9][a-z0-9/._-]{1,96}$/;
const IDENTITY=/^[a-z0-9][a-z0-9/._-]{1,96}$/;
const REASON=/^[A-Z][A-Z0-9_]{1,63}$/;

export class ObservationError extends Error{
  constructor(code){super(code);this.name='ObservationError';this.code=code;}
}
const fail=code=>{throw new ObservationError(code);};

// A normalized state is a flat, bounded record of decoded facts. Nested objects, arrays of
// objects, unbounded strings and non-finite numbers are all refused, because they are how a raw
// provider payload gets carried into classification by accident.
const MAX_NORMALIZED_KEYS=32;
const MAX_NORMALIZED_TEXT=256;
const MAX_PROVENANCE=16;

function validNormalizedValue(value){
  if(value===null||typeof value==='boolean')return true;
  if(typeof value==='number')return Number.isFinite(value);
  if(typeof value==='string')return value.length<=MAX_NORMALIZED_TEXT&&!/[\r\n]/.test(value);
  if(Array.isArray(value))return value.length<=MAX_NORMALIZED_KEYS
    &&value.every(entry=>entry===null||typeof entry==='boolean'
      ||(typeof entry==='number'&&Number.isFinite(entry))
      ||(typeof entry==='string'&&entry.length<=MAX_NORMALIZED_TEXT&&!/[\r\n]/.test(entry)));
  return false;
}

export function validNormalizedState(value){
  if(value===null||typeof value!=='object'||Array.isArray(value))return false;
  const keys=Object.keys(value);
  if(keys.length>MAX_NORMALIZED_KEYS)return false;
  return keys.every(key=>/^[a-z][a-zA-Z0-9]{0,47}$/.test(key)&&validNormalizedValue(value[key]));
}

// Builds one canonical, hash-identified observation envelope. Every rejection is a fixed code and
// no part of the offending input is carried out with it.
export async function createObservation(input,{cryptoImpl=globalThis.crypto}={}){
  if(!exact(input,ENVELOPE_KEYS))fail('observation_schema_invalid');
  if(!OBSERVATION_SOURCES.includes(input.sourceType))fail('observation_source_invalid');
  if(!OBSERVATION_STATES.includes(input.observationState))fail('observation_state_invalid');
  if(!text(input.sourceIdentity,IDENTITY)||!text(input.subjectIdentity,IDENTITY))fail('observation_identity_invalid');
  if(!iso(input.observedAt))fail('observation_time_invalid');
  if(input.subjectTime!==null&&!iso(input.subjectTime))fail('observation_time_invalid');
  if(!text(input.reasonCode,REASON))fail('observation_reason_invalid');
  if(!validNormalizedState(input.normalizedState))fail('observation_normalized_state_invalid');
  if(!Array.isArray(input.provenance)||input.provenance.length>MAX_PROVENANCE
    ||!input.provenance.every(value=>text(value,REFERENCE)))fail('observation_provenance_invalid');
  if(input.freshnessAgeMs!==null
    &&(!Number.isSafeInteger(input.freshnessAgeMs)||input.freshnessAgeMs<0))fail('observation_freshness_invalid');
  // Defence in depth. Nothing upstream is permitted to place a credential here, and if anything
  // ever does the envelope is refused rather than hashed, logged or classified.
  if(secretFinding(input)!==null)fail('observation_secret_forbidden');
  const core=canonicalise({schemaVersion:OBSERVATION_SCHEMA_VERSION,...input});
  const evidenceHash=await sha256Hex(stableStringify(core),cryptoImpl);
  return deepFreeze(canonicalise({...core,evidenceHash}));
}

// The A1.1 incident evidence row for an envelope. A1.1 validates the pair independently; this is
// only the shape conversion, and it deliberately carries the hash rather than the envelope, so
// no decoded provider field can reach classification through the evidence array.
export function observationEvidenceRow(observation){
  if(!observation||typeof observation!=='object')fail('observation_schema_invalid');
  const reference=`${observation.sourceType}:${observation.subjectIdentity}`;
  if(!text(reference,REFERENCE)||!text(observation.evidenceHash,/^[0-9a-f]{64}$/))fail('observation_provenance_invalid');
  return deepFreeze({reference,hash:observation.evidenceHash});
}

// An envelope proves something only when it was actually observed AND it is still inside the
// freshness bound the caller supplies. A stale reading is not a weak reading, it is no reading.
export function isProvingObservation(observation,maxAgeMs){
  if(!observation||observation.observationState!==PROVING_OBSERVATION_STATE)return false;
  if(!Number.isSafeInteger(maxAgeMs)||maxAgeMs<=0)return false;
  if(observation.freshnessAgeMs===null)return false;
  return observation.freshnessAgeMs<=maxAgeMs;
}

export const observationJson=observation=>`${stableStringify(observation)}\n`;
