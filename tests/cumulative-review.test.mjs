import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCumulativeOperatingReview } from '../src/evidence/review.mjs';
import { makeReviewEvidence } from './review-fixtures.mjs';

test('cumulative review presents overall and schedule-aligned samples side by side',async()=>{
  const gw1=await makeReviewEvidence({gameweek:1,predictedPoints:5,observedPoints:7}),gw2=await makeReviewEvidence({gameweek:2,predictedPoints:4,observedPoints:4,frozenFixtureId:20,officialFixtureId:21});
  const review=buildCumulativeOperatingReview([gw1.evaluation,gw2.evaluation],{snapshots:[gw1.snapshot,gw2.snapshot]});
  assert.equal(review.overall.player.metrics.n,2);assert.equal(review.scheduleAligned.player.metrics.n,1);assert.deepEqual(review.gameweeks,[1,2]);assert.equal(review.coverageTrend[1].scheduleAlignedPlayers,0);
  assert.ok(review.limitations.some(value=>value.includes('structural blank zeroes')));
});

test('cumulative review uses only the current correction revision',async()=>{
  const first=await makeReviewEvidence({gameweek:1,observedPoints:6}),corrected=await makeReviewEvidence({gameweek:1,observedPoints:10,previousOutcome:first.outcome,previousEvaluation:first.evaluation}),gw2=await makeReviewEvidence({gameweek:2,observedPoints:4});
  const review=buildCumulativeOperatingReview([first.evaluation,corrected.evaluation,gw2.evaluation]);
  assert.equal(review.overall.player.metrics.n,2);assert.equal(review.overall.player.metrics.observedMean,7);assert.deepEqual(review.gameweeks,[1,2]);
});

test('one selected segment is reported without arbitrary subgroup cross-products',async()=>{
  const gw1=await makeReviewEvidence({gameweek:1}),review=buildCumulativeOperatingReview([gw1.evaluation],{dimension:'position',value:'MID'});
  assert.equal(review.selectedSegment.dimension,'position');assert.equal(review.selectedSegment.value,'MID');assert.equal(review.selectedSegment.report.player.metrics.n,1);assert.equal(review.overall.player.sample.level,'raw_only');
});

test('full-season 38 Gameweeks by 700 players remains practical for on-demand review',()=>{
  const evaluations=[];
  for(let gameweek=1;gameweek<=38;gameweek++){
    const players=Array.from({length:700},(_,index)=>({playerId:index+1,clubId:index%20+1,position:index%4+1,nowCost:45+(index%80),predictedPoints:(index%9)+.5,observedPoints:index%11,error:(index%9)+.5-(index%11),absError:Math.abs((index%9)+.5-(index%11)),errorBand:'material',appeared:true,reachedSixty:true,starts:1,observedMinutes:90,frozenFixtureIds:[gameweek*100],officialFixtureIds:[gameweek*100],scheduleAligned:index%10!==0,uncertainty:{available:false},segments:{position:['GKP','DEF','MID','FWD'][index%4]}}));
    const minuteFixtures=players.map(row=>({playerId:row.playerId,fixtureId:gameweek*100,scheduleAligned:row.scheduleAligned,predictedMinutes:75,observedMinutes:90,pStart:.8,started:1,pAppear:.95,appeared:1,p60:.75,reachedSixty:1,allocation:'official_per_fixture'}));
    evaluations.push({recordType:'gameweekEvaluation',season:'2026-27',gameweek,createdAt:new Date(Date.UTC(2026,7,gameweek)).toISOString(),identity:{logicalKey:`2026-27|gw${gameweek}`,evaluationId:`evaluation-2026-27-gw${gameweek}-r1-${String(gameweek).padStart(16,'0')}`,revision:1},observations:{players,minuteFixtures},coverage:{matchedPlayers:700,eligiblePredictions:700,coverage:1,minuteFixtureRows:700,unallocatableMinuteRows:0,startLabelRows:700,uncertaintyRows:0,scheduleAlignedPlayers:630},decisions:{status:'not_available'},completeness:{complete:true}});
  }
  const started=performance.now(),review=buildCumulativeOperatingReview(evaluations),elapsed=performance.now()-started;
  assert.equal(review.overall.player.metrics.n,26600);assert.equal(review.scheduleAligned.player.metrics.n,23940);assert.ok(elapsed<10000,`full-season review took ${elapsed.toFixed(0)}ms`);
});
