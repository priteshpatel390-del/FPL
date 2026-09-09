import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MS_PER_DAY,OBSERVER_GRACE_MS,OBSERVER_OPPORTUNITY_MINUTES,OpportunityScheduleError,
  attributableOpportunityCandidates,latestExpectedOpportunity}
  from '../workers/data-steward-watchdog/lib/opportunity-schedule.mjs';

const workflow=fs.readFileSync('.github/workflows/data-steward-readonly-observer.yml','utf8');

test('the declared opportunity minutes are pinned exactly against A1.3\'s own workflow cron',()=>{
  const crons=[...workflow.matchAll(/cron:\s*['"]([^'"]+)['"]/g)].map(match=>match[1]);
  assert.deepEqual(crons,['17 4 * * *','17 8 * * *']);
  assert.deepEqual([...OBSERVER_OPPORTUNITY_MINUTES],[{hour:4,minute:17},{hour:8,minute:17}]);
});

test('grace exceeds every historically observed GitHub schedule-delivery lateness recorded in CLAUDE.md',()=>{
  const claude=fs.readFileSync('CLAUDE.md','utf8');
  // The three samples this repository has independently measured for its other cron workflows.
  for(const sample of ['3h21m','4h31m','4h44m'])assert.match(claude,new RegExp(sample));
  const worstObservedMs=(4*60+44)*60*1000;
  assert.ok(OBSERVER_GRACE_MS>worstObservedMs,'grace must exceed the worst documented sample');
  assert.equal(OBSERVER_GRACE_MS,5*60*60*1000);
});

const T=(y,m,d,h,mi)=>Date.UTC(y,m-1,d,h,mi);

test('the latest expected opportunity is the most recent declared instant at or before now',()=>{
  // Between 08:17 and the next day's 04:17, the latest opportunity is today's 08:17.
  const now=T(2026,9,9,20,0);
  assert.equal(latestExpectedOpportunity({now,bootstrapAt:0}),T(2026,9,9,8,17));
});

test('before the first opportunity of the day, the latest is still yesterday\'s second one',()=>{
  const now=T(2026,9,9,1,0);
  assert.equal(latestExpectedOpportunity({now,bootstrapAt:0}),T(2026,9,8,8,17));
});

test('exactly at an opportunity instant, that instant is already the latest',()=>{
  const now=T(2026,9,9,4,17);
  assert.equal(latestExpectedOpportunity({now,bootstrapAt:0}),T(2026,9,9,4,17));
});

test('between the two same-day opportunities, the latest is the first one',()=>{
  const now=T(2026,9,9,6,0);
  assert.equal(latestExpectedOpportunity({now,bootstrapAt:0}),T(2026,9,9,4,17));
});

test('bootstrap clamps a natural opportunity that precedes deployment to null (nothing due yet)',()=>{
  const now=T(2026,9,9,20,0);
  const bootstrapAt=T(2026,9,9,10,0); // deployed after today's 08:17 already passed
  assert.equal(latestExpectedOpportunity({now,bootstrapAt}),null);
});

test('bootstrap does not clamp an opportunity that falls after deployment',()=>{
  const now=T(2026,9,9,20,0);
  const bootstrapAt=T(2026,9,9,6,0); // deployed between the two opportunities
  assert.equal(latestExpectedOpportunity({now,bootstrapAt}),T(2026,9,9,8,17));
});

test('bootstrap exactly equal to the natural opportunity still counts it as due',()=>{
  const now=T(2026,9,9,20,0);
  assert.equal(latestExpectedOpportunity({now,bootstrapAt:T(2026,9,9,8,17)}),T(2026,9,9,8,17));
});

test('rejects invalid inputs',()=>{
  assert.throws(()=>latestExpectedOpportunity({now:-1,bootstrapAt:0}),OpportunityScheduleError);
  assert.throws(()=>latestExpectedOpportunity({now:0,bootstrapAt:-1}),OpportunityScheduleError);
});

test('MS_PER_DAY is exactly one UTC day',()=>{
  assert.equal(MS_PER_DAY,24*60*60*1000);
});

test('overlap attribution offers 04:17 before 08:17 for a 09:01 scheduled run',()=>{
  const bootstrap=Date.UTC(2026,8,9,0,0);
  assert.deepEqual([...attributableOpportunityCandidates({
    createdAt:Date.UTC(2026,8,9,9,1),bootstrapAt:bootstrap})],
  [Date.UTC(2026,8,9,4,17),Date.UTC(2026,8,9,8,17)]);
});

test('delayed 08:17 evidence after the earlier grace window belongs only to 08:17',()=>{
  assert.deepEqual([...attributableOpportunityCandidates({createdAt:Date.UTC(2026,8,9,10,0),
    bootstrapAt:Date.UTC(2026,8,9,0,0)})],[Date.UTC(2026,8,9,8,17)]);
});

test('overnight candidates never cross into the previous day and bootstrap rejects old runs',()=>{
  assert.deepEqual([...attributableOpportunityCandidates({createdAt:Date.UTC(2026,8,10,4,30),
    bootstrapAt:Date.UTC(2026,8,9,12,0)})],[Date.UTC(2026,8,10,4,17)]);
  assert.deepEqual([...attributableOpportunityCandidates({createdAt:Date.UTC(2026,8,9,9,1),
    bootstrapAt:Date.UTC(2026,8,9,9,0)})],[]);
});
