// DATA-OPS A1.4 — explicit expected-opportunity model for the single daily A1.3 observation.
// Cloudflare, not GitHub Actions, owns the automatic clock. The isolated observer dispatcher
// declares exactly one opportunity at 04:17 UTC. A1.4 allows a bounded 30-minute delivery window
// before judging that opportunity missing; successful evidence remains healthy until the next
// day's 04:17 opportunity becomes due.
import {deepFreeze} from './canonical.mjs';

export const OBSERVER_OPPORTUNITY_MINUTES=deepFreeze([
  Object.freeze({hour:4,minute:17})
]);

export const OBSERVER_DELIVERY_TOLERANCE_MS=30*60*1000;
// Compatibility alias for callers/tests written before the GitHub-clock correction.
export const OBSERVER_GRACE_MS=OBSERVER_DELIVERY_TOLERANCE_MS;
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

export function latestExpectedOpportunity({now,bootstrapAt}){
  if(!safeInstant(now))fail('opportunity_schedule_now_invalid');
  if(!safeInstant(bootstrapAt))fail('opportunity_schedule_bootstrap_invalid');
  const [latest]=recentOpportunityInstants(now);
  if(latest===undefined)fail('opportunity_schedule_unresolved');
  if(latest<bootstrapAt)return null;
  return latest;
}

// Retained as a narrow compatibility helper for historical attribution tests. New automatic
// evidence is authoritative by exact receipt/run id and does not use time-based attribution.
export function attributableOpportunityCandidates({createdAt,bootstrapAt}){
  if(!safeInstant(createdAt))fail('opportunity_schedule_created_invalid');
  if(!safeInstant(bootstrapAt))fail('opportunity_schedule_bootstrap_invalid');
  const candidates=[];
  for(const daysBack of [1,0]){
    const start=dayStart(createdAt)-daysBack*MS_PER_DAY;
    for(const {hour,minute} of OBSERVER_OPPORTUNITY_MINUTES){
      const opportunity=start+(hour*60+minute)*60*1000;
      if(opportunity>=bootstrapAt&&createdAt>=opportunity
        &&createdAt<opportunity+OBSERVER_DELIVERY_TOLERANCE_MS)candidates.push(opportunity);
    }
  }
  return deepFreeze(candidates.sort((a,b)=>a-b));
}
