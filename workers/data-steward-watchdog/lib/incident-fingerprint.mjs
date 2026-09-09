// DATA-OPS-A1.4 — deterministic, long-lived incident identity.
//
// A fingerprint identifies a PROBLEM, not an observation. It is a hash over the closed
// (problemClass, component) pair from reason-codes.mjs and nothing else: no reason code, no run
// id, no head SHA, no timestamp and no evidence hash ever enters it. That is deliberate —
// including a per-observation fact would make the same underlying problem mint a new incident on
// every run (exactly the failure mode this checkpoint must avoid), and including the current
// reason code would make an escalation from STALE to MISSING look like an unrelated problem
// instead of the same incident changing state. Whether a reason-code change is material enough to
// notify is the lifecycle reducer's job, over a stable identity this module supplies.
import {deepFreeze,sha256Hex,stableStringify} from './canonical.mjs';
import {WATCHDOG_PROBLEMS} from './reason-codes.mjs';

export const INCIDENT_FINGERPRINT_VERSION='data-ops-a1.4-fingerprint-v1';

export class IncidentFingerprintError extends Error{
  constructor(code){super(code);this.name='IncidentFingerprintError';this.code=code;}
}
const fail=code=>{throw new IncidentFingerprintError(code);};

export async function incidentFingerprint(problemKey,{cryptoImpl=globalThis.crypto}={}){
  const problem=WATCHDOG_PROBLEMS[problemKey];
  if(!problem)fail('incident_problem_unknown');
  const hash=await sha256Hex(stableStringify({version:INCIDENT_FINGERPRINT_VERSION,...problem}),cryptoImpl);
  return deepFreeze({fingerprint:`watchdog-${hash.slice(0,24)}`,problemClass:problem.problemClass,
    component:problem.component});
}

export const knownProblemKeys=()=>Object.freeze(Object.keys(WATCHDOG_PROBLEMS));
