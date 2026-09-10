// DATA-OPS-A1.2 — the expected shape of the closed DATA-S2C production collection chain, and the
// timing semantics that decide when its absence is allowed to mean anything.
//
// The chain A1.2 observes is exactly the one DATA-S2C closed, and A1.2 does not redesign it:
//
//   Cloudflare Cron  →  isolated dispatcher Worker  →  GitHub Actions workflow B
//     →  repository gate  →  opportunity guard  →  Official FPL collection  →  production D1
//
// Cloudflare is the sole automatic clock. GitHub Actions is the execution engine. Workflow C is
// the attended recovery path. There is no Cloudflare Workflow anywhere in this chain, and A1.2
// must never be implemented as though there were.
//
// Exactly one automatic collection opportunity exists at 01:17 UTC. The shared fail-closed
// opportunity guard remains defence-in-depth and permits at most one production collection per UTC
// day. An attended recovery run whose guard refuses with `OPPORTUNITY_CONSUMED` after an earlier
// successful collection is the system working, not an incident.
//
// This module is pure. It holds constants and arithmetic, reads no file, issues no request and
// touches no credential.
import {deepFreeze} from '../../../src/decision-intelligence/canonical.mjs';

export const PRODUCTION_CHAIN_CONTRACT_VERSION='data-ops-a1.2-chain-v1';

// ---------------------------------------------------------------- expected identities
// The repository is the authority on every one of these. They are pinned by permanent tests
// against the modules that actually own them, so a future change to the dispatcher, the workflow
// set or the guard cannot leave the sentinels silently observing a chain that no longer exists.
export const EXPECTED_REPOSITORY='priteshpatel390-del/FPL';
export const EXPECTED_DEFAULT_BRANCH='main';
export const EXPECTED_DISPATCHER_WORKER='teamsheet-data-s2-dispatcher';
export const EXPECTED_WORKFLOW_B_FILE='data-s2-production-external.yml';
export const EXPECTED_WORKFLOW_C_FILE='data-s2-production-collection.yml';
export const EXPECTED_VERIFY_CHECK_NAME='Tests and deterministic build';

// The two governed job names inside workflow B and workflow C, and the exact guard step name.
// The guard step name is what makes a legitimate `OPPORTUNITY_CONSUMED` refusal distinguishable
// from every other reason a repository gate can fail, so it is a load-bearing constant rather
// than a label.
export const EXPECTED_GATE_JOB='repository-gate';
export const EXPECTED_COLLECT_JOB='collect';
export const EXPECTED_GUARD_STEP='Require an unconsumed daily collection opportunity';

// ---------------------------------------------------------------- the opportunity schedule
// The owner-approved permanent Cloudflare cron declaration, in UTC. Cloudflare executes Cron
// Triggers on UTC and the dispatcher declares no timezone override, so these minutes are UTC
// without conversion. A permanent test pins this list byte-for-byte against
// `workers/schedule-dispatcher/wrangler.jsonc`, so the repository cannot declare one schedule and
// observe another.
export const EXPECTED_CRON_EXPRESSIONS=deepFreeze(['17 1 * * *']);
export const OPPORTUNITY_MINUTES=deepFreeze([
  Object.freeze({hour:1,minute:17})
]);

// The gap between two consecutive opportunities, derived from the daily schedule above. It is one
// UTC day, and it is the natural bound on how long a reading may stay
// load-bearing: a fact observed longer ago than one whole opportunity interval could already have
// been superseded by the next opportunity, so it is no longer evidence about the current state.
export const OPPORTUNITY_INTERVAL_MS=24*60*60*1000;
export const MAX_EVIDENCE_AGE_MS=OPPORTUNITY_INTERVAL_MS;

// How long one workflow B run may take, derived from the workflow's own declared job timeouts —
// `repository-gate` at 10 minutes and `collect` at 20 — and pinned by a permanent test that reads
// those numbers out of `.github/workflows/data-s2-production-external.yml`. It is the longest a
// dispatched run can still be legitimately in flight, so it is the earliest point at which a run
// that has not finished can be called late rather than running.
export const WORKFLOW_B_GATE_TIMEOUT_MINUTES=10;
export const WORKFLOW_B_COLLECT_TIMEOUT_MINUTES=20;
export const WORKFLOW_B_MAX_EXECUTION_MS=
  (WORKFLOW_B_GATE_TIMEOUT_MINUTES+WORKFLOW_B_COLLECT_TIMEOUT_MINUTES)*60*1000;

// Cloudflare documents that Cron Trigger changes take up to 15 minutes to propagate to its global
// network. That figure bounds configuration propagation, not per-fire delivery latency, and it is
// used here for exactly what it bounds: a schedule the repository declared may legitimately not
// yet be the schedule Cloudflare is running, and a fire may legitimately be that late relative to
// its nominal minute. Cloudflare publishes no delivery-latency guarantee, so no tighter figure is
// invented and no looser one is assumed.
export const CRON_PROPAGATION_ALLOWANCE_MS=15*60*1000;

// The evaluation tolerance is the sum of the two bounds above and nothing else. Both terms are
// derived — one from the repository's own workflow, one from Cloudflare's published propagation
// figure — so there is no unexplained number in the timing model.
export const EVALUATION_TOLERANCE_MS=WORKFLOW_B_MAX_EXECUTION_MS+CRON_PROPAGATION_ALLOWANCE_MS;

export const MS_PER_DAY=24*60*60*1000;

const safeInstant=value=>Number.isSafeInteger(value)&&value>=0;

export class ChainContractError extends Error{
  constructor(code){super(code);this.name='ChainContractError';this.code=code;}
}
const fail=code=>{throw new ChainContractError(code);};

// The UTC day an instant belongs to, as the exact boundary instants and the `YYYY-MM-DD` label
// the GitHub Actions `created` filter and the D1 window both use.
export function utcDayWindow(now){
  if(!safeInstant(now))fail('chain_now_invalid');
  const day=new Date(now);
  const start=Date.UTC(day.getUTCFullYear(),day.getUTCMonth(),day.getUTCDate());
  return deepFreeze({start,end:start+MS_PER_DAY,date:new Date(start).toISOString().slice(0,10)});
}

// The nominal opportunity instant of the UTC day containing `now`.
export function opportunityInstants(now){
  const {start}=utcDayWindow(now);
  return deepFreeze(OPPORTUNITY_MINUTES.map(({hour,minute})=>start+((hour*60)+minute)*60*1000));
}

// The instant after which the day's collection can no longer be legitimately in flight: the last
// nominal opportunity plus the derived tolerance. Before it, absence of a proven collection is
// not yet a failure; from it, inability to prove the day's collection fails closed.
export function evaluationDeadline(now){
  const instants=opportunityInstants(now);
  return instants[instants.length-1]+EVALUATION_TOLERANCE_MS;
}

export const EVALUATION_NOT_DUE='NOT_DUE';
export const EVALUATION_AWAITING_LATER_OPPORTUNITY='AWAITING_LATER_OPPORTUNITY';
export const EVALUATION_DUE='DUE';
export const EVALUATION_PHASES=deepFreeze([EVALUATION_NOT_DUE,
  EVALUATION_AWAITING_LATER_OPPORTUNITY,EVALUATION_DUE]);

// Where `now` sits in the day's collection contract. This is an evaluation phase and nothing
// more: it grants no authority, registers no classification and enables no action. It exists so
// that a missing collection before the single opportunity's tolerance expires is not mistaken for
// a failed day. The legacy awaiting-later phase remains exported for compatibility but is
// unreachable while only one automatic opportunity exists.
export function evaluationPhase(now){
  const instants=opportunityInstants(now);
  const deadline=evaluationDeadline(now);
  // Before the first opportunity has even had time to complete, nothing is expected yet.
  if(now<instants[0]+WORKFLOW_B_MAX_EXECUTION_MS)
    return deepFreeze({phase:EVALUATION_NOT_DUE,deadline,remainingOpportunities:instants.length});
  if(now<deadline){
    const remaining=instants.filter(instant=>now<instant+WORKFLOW_B_MAX_EXECUTION_MS).length;
    return deepFreeze({phase:remaining>0?EVALUATION_AWAITING_LATER_OPPORTUNITY:EVALUATION_NOT_DUE,
      deadline,remainingOpportunities:remaining});
  }
  return deepFreeze({phase:EVALUATION_DUE,deadline,remainingOpportunities:0});
}
