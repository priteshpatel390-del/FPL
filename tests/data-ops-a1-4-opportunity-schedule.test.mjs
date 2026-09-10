import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MS_PER_DAY,OBSERVER_DELIVERY_TOLERANCE_MS,OBSERVER_GRACE_MS,
  OBSERVER_OPPORTUNITY_MINUTES,OpportunityScheduleError,attributableOpportunityCandidates,
  latestExpectedOpportunity} from '../workers/data-steward-watchdog/lib/opportunity-schedule.mjs';

const workflow=fs.readFileSync('.github/workflows/data-steward-readonly-observer.yml','utf8');
const dispatcher=JSON.parse(fs.readFileSync('workers/data-steward-observer-dispatcher/wrangler.jsonc','utf8'));

test('Cloudflare declares exactly one 04:17 automatic observer opportunity and GitHub declares none',()=>{
  const workflowCrons=[...workflow.matchAll(/cron:\s*['"]([^'"]+)['"]/g)].map(match=>match[1]);
  assert.deepEqual(workflowCrons,[]);
  assert.deepEqual(dispatcher.triggers.crons,['17 4 * * *']);
  assert.deepEqual([...OBSERVER_OPPORTUNITY_MINUTES],[{hour:4,minute:17}]);
});

test('observer delivery tolerance is exactly 30 minutes and the legacy alias cannot diverge',()=>{
  assert.equal(OBSERVER_DELIVERY_TOLERANCE_MS,30*60*1000);
  assert.equal(OBSERVER_GRACE_MS,OBSERVER_DELIVERY_TOLERANCE_MS);
});

const T=(y,m,d,h,mi)=>Date.UTC(y,m-1,d,h,mi);

test('the latest expected opportunity is the single 04:17 instant for the current UTC day',()=>{
  assert.equal(latestExpectedOpportunity({now:T(2026,9,9,20,0),bootstrapAt:0}),T(2026,9,9,4,17));
});

test('before 04:17 the latest opportunity is the previous day 04:17',()=>{
  assert.equal(latestExpectedOpportunity({now:T(2026,9,9,1,0),bootstrapAt:0}),T(2026,9,8,4,17));
});

test('exactly at 04:17 that opportunity is already due',()=>{
  assert.equal(latestExpectedOpportunity({now:T(2026,9,9,4,17),bootstrapAt:0}),T(2026,9,9,4,17));
});

test('there is no second same-day observer opportunity',()=>{
  assert.equal(latestExpectedOpportunity({now:T(2026,9,9,8,17),bootstrapAt:0}),T(2026,9,9,4,17));
});

test('bootstrap clamps an opportunity that predates the first monitored opportunity',()=>{
  assert.equal(latestExpectedOpportunity({now:T(2026,9,9,20,0),bootstrapAt:T(2026,9,9,5,0)}),null);
});

test('bootstrap exactly equal to 04:17 includes that opportunity',()=>{
  assert.equal(latestExpectedOpportunity({now:T(2026,9,9,20,0),bootstrapAt:T(2026,9,9,4,17)}),T(2026,9,9,4,17));
});

test('rejects invalid inputs',()=>{
  assert.throws(()=>latestExpectedOpportunity({now:-1,bootstrapAt:0}),OpportunityScheduleError);
  assert.throws(()=>latestExpectedOpportunity({now:0,bootstrapAt:-1}),OpportunityScheduleError);
});

test('MS_PER_DAY is exactly one UTC day',()=>{
  assert.equal(MS_PER_DAY,24*60*60*1000);
});

test('legacy time-attribution helper is narrow, single-opportunity and non-overlapping',()=>{
  const bootstrap=T(2026,9,9,0,0);
  assert.deepEqual([...attributableOpportunityCandidates({createdAt:T(2026,9,9,4,20),bootstrapAt:bootstrap})],
    [T(2026,9,9,4,17)]);
  assert.deepEqual([...attributableOpportunityCandidates({createdAt:T(2026,9,9,5,0),bootstrapAt:bootstrap})],[]);
});

test('legacy helper excludes the exact 30-minute deadline and respects bootstrap',()=>{
  assert.deepEqual([...attributableOpportunityCandidates({createdAt:T(2026,9,9,4,47),
    bootstrapAt:T(2026,9,9,0,0)})],[]);
  assert.deepEqual([...attributableOpportunityCandidates({createdAt:T(2026,9,9,4,20),
    bootstrapAt:T(2026,9,9,4,18)})],[]);
});
