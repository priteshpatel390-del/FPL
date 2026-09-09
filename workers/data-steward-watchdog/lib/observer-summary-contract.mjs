// DATA-OPS-A1.4 — the semantic contract over A1.3's own sanitized summary line.
//
// `github-evidence-reader.mjs`'s `decodeObserverSummary()` only proves the summary is
// STRUCTURALLY well-formed JSON of the expected shape. That is not enough: a summary can be
// perfectly well-formed and still not mean the opportunity was healthy. This module pins the
// actual semantics `run-observer.mjs` and `observation-run.mjs` (A1.2/A1.3) establish:
//
//   - `verdict` is `HEALTHY`, `UNHEALTHY` or `NOT_EVALUATED`.
//   - `escalationRequired` is true exactly when `verdict === 'UNHEALTHY'`.
//   - `runObserver()` exits non-zero exactly when `escalationRequired` is true, which is what
//     makes the GitHub Actions job conclusion `failure` — so a genuinely UNHEALTHY verdict can
//     only ever be paired with a failed job, never a successful one.
//   - `heartbeat` is `INCOMPLETE` only when a required sentinel did not complete, which itself
//     forces `verdict === 'UNHEALTHY'` (see `evaluateProductionChain()`'s first check) — so a
//     successful job can never carry an incomplete heartbeat either.
//
// `NOT_EVALUATED` IS DELIBERATELY ACCEPTED, NOT TREATED AS A FAILURE. It means the underlying
// production-collection day-window was not yet evaluable when A1.3 ran — a fact about the
// production chain A1.3 observes, not about whether A1.3 itself executed correctly. A1.3 exits
// zero for it, precisely because it is not an A1.3 problem. Requiring literal `verdict ===
// 'HEALTHY'` here would manufacture a false watchdog incident every time A1.3 legitimately runs
// outside the production evaluation window.
//
// A JOB THE GITHUB API REPORTS AS SUCCESSFUL WHOSE OWN SUMMARY DISAGREES IS NEVER TRUSTED. That
// contradiction is reported as its own closed outcome rather than resolved by picking whichever
// field is more convenient, exactly per the required correction.
import {deepFreeze} from './canonical.mjs';

export const SUMMARY_OUTCOME_SUCCESS='SUCCESS';
export const SUMMARY_OUTCOME_NOT_EVALUATED_OK='NOT_EVALUATED_OK';
export const SUMMARY_OUTCOME_FAILED='FAILED';
export const SUMMARY_OUTCOME_INVALID='SUMMARY_INVALID';
export const SUMMARY_OUTCOME_UNHEALTHY='SUMMARY_UNHEALTHY';
export const SUMMARY_OUTCOME_CONTRADICTORY='SUMMARY_CONTRADICTORY';

export class ObserverSummaryContractError extends Error{
  constructor(code){super(code);this.name='ObserverSummaryContractError';this.code=code;}
}
const fail=code=>{throw new ObserverSummaryContractError(code);};

// `summary` is the already-structurally-decoded object from `decodeObserverSummary()`, or `null`
// if that decode failed or no log was read. `jobConclusion` is the exact GitHub job conclusion —
// only `'success'` and `'failure'` are meaningful inputs here; a caller must not ask this for a
// skipped or in-flight job, since neither has a decisive terminal outcome to check a summary
// against.
export function evaluateObserverSummary({summary,jobConclusion}){
  if(jobConclusion!=='success'&&jobConclusion!=='failure')fail('observer_summary_conclusion_invalid');
  if(summary!==null&&(typeof summary!=='object'||Array.isArray(summary)))
    fail('observer_summary_shape_invalid');

  if(summary===null){
    // No decodable summary at all. For a successful job that is decisive malformation — the job
    // ran to completion and must have printed one. For a failed job it is unremarkable: many
    // failure points (checkout, Node setup, an early throw) precede the summary ever being
    // printed, so absence alone is not a contradiction.
    return jobConclusion==='success'?SUMMARY_OUTCOME_INVALID:SUMMARY_OUTCOME_FAILED;
  }

  const {verdict,heartbeat,escalationRequired}=summary;

  if(jobConclusion==='success'){
    if(escalationRequired===true||heartbeat==='INCOMPLETE'||verdict==='UNHEALTHY')
      return SUMMARY_OUTCOME_CONTRADICTORY;
    if(verdict==='HEALTHY')return SUMMARY_OUTCOME_SUCCESS;
    if(verdict==='NOT_EVALUATED')return SUMMARY_OUTCOME_NOT_EVALUATED_OK;
    return SUMMARY_OUTCOME_INVALID;
  }

  // jobConclusion === 'failure'
  if(escalationRequired===true&&verdict==='UNHEALTHY')return SUMMARY_OUTCOME_FAILED;
  // A failed job whose own summary does not confirm escalation is suspicious rather than
  // reassuring: never interpreted as evidence the opportunity was actually fine.
  return SUMMARY_OUTCOME_CONTRADICTORY;
}

export const SUMMARY_OUTCOMES=deepFreeze([SUMMARY_OUTCOME_SUCCESS,SUMMARY_OUTCOME_NOT_EVALUATED_OK,
  SUMMARY_OUTCOME_FAILED,SUMMARY_OUTCOME_INVALID,SUMMARY_OUTCOME_UNHEALTHY,SUMMARY_OUTCOME_CONTRADICTORY]);
