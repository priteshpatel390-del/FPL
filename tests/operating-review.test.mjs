import test from 'node:test';
import assert from 'node:assert/strict';
import { operatingReviewCurrentRecords,buildWeeklyOperatingReview,buildSeasonOperatingReview } from '../src/evidence/review.mjs';
import { reviewSnapshot,reviewOutcome,reviewEvaluation,reviewTransfer } from './review-fixtures.mjs';

test('weekly operating review exposes evidence, descriptive metrics and frozen decisions',()=>{
  const review=buildWeeklyOperatingReview({gameweek:1,snapshot:reviewSnapshot(),outcome:reviewOutcome(),evaluation:reviewEvaluation(),transferEvaluations:[reviewTransfer()],availableEvaluationGameweeks:[1,2]});
  assert.equal(review.status.snapshot,'official');assert.equal(review.status.outcome,'complete');assert.equal(review.status.evaluation,'current');assert.equal(review.status.transferHorizon,'complete');
  assert.equal(review.headline.playerMae,2);assert.equal(review.players[0].playerName,'Safe Player');assert.equal(review.frozenDecision.formation,'3-4-3');assert.equal(review.frozenDecision.captainName,'Safe Player');assert.equal(review.decisions.squad.hindsightOracle.label,'Hindsight oracle');assert.ok(review.warnings.some(row=>row.includes('unallocatable')));
});

test('incomplete transfer horizons never calculate a partial gain',()=>{
  const review=buildWeeklyOperatingReview({gameweek:1,snapshot:reviewSnapshot(),outcome:reviewOutcome(),evaluation:reviewEvaluation(),availableEvaluationGameweeks:[1]});
  assert.equal(review.transferHorizon.status,'in_progress');assert.deepEqual(review.transferHorizon.missingGameweeks,[2]);assert.equal(review.transferHorizon.record,null);
});

test('corrected records select the highest immutable revision without double counting',()=>{
  const first=reviewEvaluation(1,1),second=reviewEvaluation(1,2);
  assert.deepEqual(operatingReviewCurrentRecords([second,first],'gameweekEvaluation').map(row=>row.identity.revision),[2]);
  const season=buildSeasonOperatingReview([first,second]);assert.equal(season.status.evaluatedGameweeks,1);assert.equal(season.status.correctedGameweeks,1);
});

test('season review keeps overall and schedule-aligned evidence separate',()=>{
  const season=buildSeasonOperatingReview([reviewEvaluation(1,1),reviewEvaluation(2,1,{scheduleAligned:false})]);
  assert.equal(season.overall.player.metrics.n,4);assert.equal(season.scheduleAligned.player.metrics.n,2);assert.equal(season.safeguards.compositeScore,false);assert.equal(season.safeguards.oneSegmentAtATime,true);
});

test('provider-state summaries enforce the existing AND sample warning',()=>{
  const season=buildSeasonOperatingReview([reviewEvaluation()]);const fpl=season.providerStateContext.find(row=>row.provider==='fpl'&&row.state==='Live');
  assert.equal(fpl.sample.level,'raw_only');assert.match(fpl.sample.message,/100 observations across five affected Gameweeks/);
});

test('fixture-class segmentation keeps blank and double samples explicit',()=>{
  const blank=reviewEvaluation(1),double=reviewEvaluation(2);for(const row of blank.observations.players)row.segments.fixtureClass='blank';for(const row of double.observations.players)row.segments.fixtureClass='double';
  const blankReport=buildSeasonOperatingReview([blank,double],[],{dimension:'fixtureClass',value:'blank'}),doubleReport=buildSeasonOperatingReview([blank,double],[],{dimension:'fixtureClass',value:'double'});
  assert.equal(blankReport.selected.report.player.metrics.n,2);assert.equal(doubleReport.selected.report.player.metrics.n,2);
});
