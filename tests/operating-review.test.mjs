import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  REVIEW_RULES,buildWeeklyOperatingReview,buildOperatingReviewBundle,serialiseOperatingReviewBundle,validateOperatingReviewBundle
} from '../src/evidence/review.mjs';
import { makeReviewEvidence,makeTransferEvaluation } from './review-fixtures.mjs';

test('operating-review bundle is deterministic, exact and hash-verifiable',async()=>{
  const first=await makeReviewEvidence({observedPoints:6}),corrected=await makeReviewEvidence({observedPoints:9,previousOutcome:first.outcome,previousEvaluation:first.evaluation}),transfer=await makeTransferEvaluation(corrected.evaluation);
  const input={snapshots:[corrected.snapshot],outcomes:[first.outcome,corrected.outcome],evaluations:[first.evaluation,corrected.evaluation],transferEvaluations:[transfer],scope:{season:'2026-27',gameweek:1},build:{commit:'verified',sourceHash:'source',modelVersion:'2.4.0',rulesVersion:'2026-27.3'},cryptoImpl:webcrypto};
  const a=await buildOperatingReviewBundle(input),b=await buildOperatingReviewBundle(input);
  assert.equal(serialiseOperatingReviewBundle(a).text,serialiseOperatingReviewBundle(b).text);
  assert.equal(a.weeklyReviews.length,1);assert.equal(a.weeklyReviews[0].sourceIdentity.evaluationRevision,2);assert.equal(a.records.outcomes.length,2);assert.equal(a.records.evaluations.length,2);assert.equal(a.completeness.status,'complete');
  assert.equal(a.weeklyReviews[0].transfer.status,'complete');assert.equal(a.weeklyReviews[0].transfer.plans[0].netGainAfterHits,6);
  assert.equal((await validateOperatingReviewBundle(a,webcrypto)).ok,true);
  const tampered=structuredClone(a);tampered.weeklyReviews[0].headline.playerMae=99;assert.equal((await validateOperatingReviewBundle(tampered,webcrypto)).reason,'review_hash');
});

test('missing exact sources and pruned revision metadata are explicit partial evidence',async()=>{
  const fixture=await makeReviewEvidence();
  const bundle=await buildOperatingReviewBundle({evaluations:[fixture.evaluation],sourceMetadata:[{recordType:'gameweekOutcome',recordId:'outcome-pruned',logicalKey:'2026-27|gw1',season:'2026-27',gameweek:1,revision:1,current:false,contentHash:'a'.repeat(64),outcomeDataHash:'b'.repeat(64),collectedAt:'2026-08-22T20:00:00.000Z',hasFullRecord:false}],scope:{season:'2026-27',gameweek:1},cryptoImpl:webcrypto});
  assert.equal(bundle.completeness.status,'partial');assert.deepEqual(bundle.completeness.missingFullSnapshotIds,[fixture.evaluation.sources.snapshotId]);assert.deepEqual(bundle.completeness.missingFullOutcomeIds,[fixture.evaluation.sources.outcomeId]);assert.deepEqual(bundle.completeness.prunedRecordIds,['outcome-pruned']);
  assert.ok(bundle.weeklyReviews[0].warnings.some(value=>value.includes('full source snapshot')));
});

test('weekly review keeps incomplete transfer horizons pending without interim gain',()=>{
  const evaluation={recordType:'gameweekEvaluation',season:'2026-27',gameweek:3,deadlineTime:'2026-09-04T17:30:00.000Z',identity:{evaluationId:'evaluation-2026-27-gw3-r1-0123456789abcdef',revision:1,contentHash:'a'.repeat(64)},sources:{snapshotId:'snapshot',snapshotContentHash:'b'.repeat(64),outcomeId:'outcome',outcomeRevision:1,outcomeDataHash:'c'.repeat(64),outcomeStatus:'complete'},observations:{players:[],minuteFixtures:[]},coverage:{},reports:{player:{n:0},minutes:{},uncertainty:{}},decisions:{transferBasis:{horizon:3}},completeness:{complete:true}};
  const review=buildWeeklyOperatingReview(evaluation);
  assert.equal(review.transfer.status,'horizon_in_progress');assert.deepEqual(review.transfer.requiredGameweeks,[3,4,5]);assert.equal(Object.hasOwn(review.transfer,'netGainAfterHits'),false);
});

test('unsupported source schemas fail closed and exports are bounded',async()=>{
  const fixture=await makeReviewEvidence(),bad={...fixture.evaluation,schemaVersion:'2.0.0'};
  await assert.rejects(()=>buildOperatingReviewBundle({evaluations:[bad],scope:{season:'2026-27'},cryptoImpl:webcrypto}),/unsupported source-record version/);
  assert.equal(REVIEW_RULES.warningBytes,10*1024*1024);assert.equal(REVIEW_RULES.maxBytes,25*1024*1024);
});
