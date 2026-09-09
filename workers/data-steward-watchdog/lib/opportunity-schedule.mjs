// DATA-OPS-A1.4 — the expected-opportunity model over A1.3's own declared schedule.
//
// A1.3 declares exactly two independent daily observation opportunities —
// `.github/workflows/data-steward-readonly-observer.yml`: `17 4 * * *` and `17 8 * * *`, i.e.
// 04:17 and 08:17 UTC — and, unlike the production-collection guard A1.2 observes, EACH one is
// independently expected to succeed. There is no "one opportunity consumed, the rest may safely
// refuse" contract here: A1.3's own runs are read-only and side-effect-free, so both are simply
// two chances a day for the observer to prove it is working.
//
// AN AGE-ONLY HEARTBEAT ("healthy if a success happened in the last N hours") IS WRONG FOR THIS
// SCHEDULE. The gap between the two opportunities is 4 hours; the overnight gap from 08:17 back to
// the next day's 04:17 is roughly 20 hours. A watchdog firing at 23:17 UTC would see roughly 15
// hours since the 08:17 success and — under a naive age rule — call a perfectly healthy day STALE
// or MISSING, every single day. This module replaces that with an explicit model of which
// opportunity is due right now.
//
// GRACE COMES FROM THIS REPOSITORY'S OWN MEASURED EVIDENCE, NOT AN INVENTED ROUND NUMBER.
// CLAUDE.md records three independently observed GitHub Actions schedule-delivery delays for this
// repository's other cron-triggered workflows: approximately 3h21m, 4h31m and 4h44m late relative
// to their nominal minute. Five hours is the smallest clean bound that still comfortably exceeds
// every one of those three samples, so a delayed-but-genuine run is never mistaken for a missed
// opportunity while it could still legitimately arrive.
import {deepFreeze} from './canonical.mjs';

// Pinned by a permanent test against the exact cron strings in
// `.github/workflows/data-steward-readonly-observer.yml`, exactly as
// `workers/data-steward/sentinels/production-chain-contract.mjs` pins the dispatcher's cron list
// against its own Wrangler config.
export const OBSERVER_OPPORTUNITY_MINUTES=deepFreeze([
  Object.freeze({hour:4,minute:17}),
  Object.freeze({hour:8,minute:17})
]);

export const OBSERVER_GRACE_MS=5*60*60*1000;
export const MS_PER_DAY=24*60*60*1000;

export class OpportunityScheduleError extends Error{
  constructor(code){super(code);this.name='OpportunityScheduleError';this.code=code;}
}
const fail=code=>{throw new OpportunityScheduleError(code);};

const safeInstant=value=>Number.isSafeInteger(value)&&value>=0;

function dayStart(instant){
  const day=new Date(instant);
  return Date.UTC(day.getUTCFullYear(),day.getUTCMonth(),day.getUTCDate());
}

// Every declared opportunity instant on or before `now`, most recent first, going back at most
// two days — comfortably more than enough to find the single latest one without an unbounded
// backward scan.
function recentOpportunityInstants(now){
  const instants=[];
  for(const daysBack of [0,1,2]){
    const start=dayStart(now)-daysBack*MS_PER_DAY;
    for(const {hour,minute} of OBSERVER_OPPORTUNITY_MINUTES){
      const instant=start+(hour*60+minute)*60*1000;
      if(instant<=now)instants.push(instant);
    }
  }
  return instants.sort((a,b)=>b-a);
}

// The single most recent declared opportunity at or before `now`, clamped forward to
// `bootstrapAt`. Clamping is what prevents a freshly deployed watchdog from retroactively judging
// every opportunity that occurred before it ever ran: if the natural latest opportunity precedes
// the watchdog's own bootstrap instant, there is nothing yet for this watchdog to have expected,
// and `null` is returned to mean exactly that — not an opportunity, not evidence, nothing due.
export function latestExpectedOpportunity({now,bootstrapAt}){
  if(!safeInstant(now))fail('opportunity_schedule_now_invalid');
  if(!safeInstant(bootstrapAt))fail('opportunity_schedule_bootstrap_invalid');
  const [latest]=recentOpportunityInstants(now);
  if(latest===undefined)fail('opportunity_schedule_unresolved');
  if(latest<bootstrapAt)return null;
  return latest;
}
