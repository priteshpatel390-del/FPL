// DATA-OPS-A1.4 — the scheduled-heartbeat freshness classifier.
//
// This module answers exactly one question, from exactly two inputs: given the most recent
// instant a SCHEDULED A1.3 observation is known to have executed successfully, and the current
// instant, is the observer's own schedule healthy, stale, or missing?
//
// It is deliberately pure and deliberately narrow. It takes no GitHub payload, no fetch
// implementation and no ambient clock: every boundary is provable from an explicit timestamp
// pair, exactly as the approved heartbeat policy requires. A manual `workflow_dispatch` run must
// never reach this function as `lastScheduledSuccessAt` — that exclusion is the caller's
// responsibility (the GitHub evidence reader never reports a manual run in that field) and is
// pinned by a permanent test on the reader, not re-checked here.
import {deepFreeze} from '../../../src/decision-intelligence/canonical.mjs';

export const HEARTBEAT_HEALTHY_WINDOW_MS=12*60*60*1000;
export const HEARTBEAT_MISSING_WINDOW_MS=24*60*60*1000;

export const HEARTBEAT_STATE_HEALTHY='HEALTHY';
export const HEARTBEAT_STATE_STALE='STALE';
export const HEARTBEAT_STATE_MISSING='MISSING';
export const HEARTBEAT_STATES=deepFreeze([HEARTBEAT_STATE_HEALTHY,HEARTBEAT_STATE_STALE,HEARTBEAT_STATE_MISSING]);

const REASON_BY_STATE=deepFreeze({
  [HEARTBEAT_STATE_HEALTHY]:'OBSERVER_HEARTBEAT_HEALTHY',
  [HEARTBEAT_STATE_STALE]:'OBSERVER_HEARTBEAT_STALE',
  [HEARTBEAT_STATE_MISSING]:'OBSERVER_HEARTBEAT_MISSING'
});

export class HeartbeatError extends Error{
  constructor(code){super(code);this.name='HeartbeatError';this.code=code;}
}
const fail=code=>{throw new HeartbeatError(code);};

const iso=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  &&Number.isFinite(Date.parse(value));

// `lastScheduledSuccessAt` is `null` when no scheduled A1.3 run has ever been observed to
// complete successfully. `now` is an explicit millisecond instant, supplied by the caller — this
// module never reads a clock.
export function classifyHeartbeat({lastScheduledSuccessAt,now}){
  if(!Number.isSafeInteger(now)||now<0)fail('heartbeat_now_invalid');
  if(lastScheduledSuccessAt!==null&&!iso(lastScheduledSuccessAt))fail('heartbeat_timestamp_invalid');
  if(lastScheduledSuccessAt===null){
    return deepFreeze({state:HEARTBEAT_STATE_MISSING,reasonCode:REASON_BY_STATE[HEARTBEAT_STATE_MISSING],
      ageMs:null,lastScheduledSuccessAt:null});
  }
  const lastMs=Date.parse(lastScheduledSuccessAt);
  if(lastMs>now)fail('heartbeat_timestamp_invalid');
  const ageMs=now-lastMs;
  const state=ageMs<=HEARTBEAT_HEALTHY_WINDOW_MS?HEARTBEAT_STATE_HEALTHY
    :ageMs<=HEARTBEAT_MISSING_WINDOW_MS?HEARTBEAT_STATE_STALE
    :HEARTBEAT_STATE_MISSING;
  return deepFreeze({state,reasonCode:REASON_BY_STATE[state],ageMs,lastScheduledSuccessAt});
}
