import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync,readdirSync } from 'node:fs';
import {
  OPERATING_REVIEW_RULES,buildWeeklyOperatingReview,buildOperatingReviewBundle,
  operatingReviewCsvSafeText,buildOperatingReviewCsv,buildOperatingReviewMarkdown,
  operatingReviewFileName,assessOperatingReviewExport
} from '../src/evidence/review.mjs';
import { hash,reviewSnapshot,reviewOutcome,reviewEvaluation,reviewTransfer } from './review-fixtures.mjs';

test('operating review bundle is deterministic, hash-linked and partial when full records are pruned',async()=>{
  const input={profile:'weekly_evidence',fromGameweek:1,toGameweek:1,snapshots:[reviewSnapshot()],outcomes:[reviewOutcome()],evaluations:[reviewEvaluation()],transferEvaluations:[],snapshotMetadata:[{snapshotId:'predeadline-gw1-0123456789abcdef',contentHash:hash('a'),season:'2026-27',gameweek:1,capturedAt:'2026-08-21T17:00:00.000Z',deadlineTime:'2026-08-21T17:30:00.000Z',origin:'local_capture'}],outcomeMetadata:[{outcomeId:'outcome-2026-27-gw1-r1-0123456789abcdef',contentHash:hash('b'),outcomeDataHash:hash('c'),season:'2026-27',gameweek:1,revision:1,status:'complete',collectedAt:'2026-08-23T20:00:00.000Z',origin:'local_collection',current:true,hasFullRecord:true},{outcomeId:'outcome-2026-27-gw1-r0-fedcba9876543210',contentHash:hash('z'),outcomeDataHash:hash('y'),season:'2026-27',gameweek:1,revision:1,status:'complete',collectedAt:'2026-08-22T20:00:00.000Z',origin:'local_collection',current:false,hasFullRecord:false}],metricMetadata:[],cryptoImpl:webcrypto};
  const first=await buildOperatingReviewBundle(input),second=await buildOperatingReviewBundle(input);
  assert.equal(first.identity.contentHash,second.identity.contentHash);assert.equal(first.identity.bundleId,second.identity.bundleId);assert.equal(first.completeness.status,'partial');assert.ok(first.completeness.missingFullRecordIds.includes('outcome-2026-27-gw1-r0-fedcba9876543210'));
});

test('recovery-only snapshot metadata cannot be presented as official evidence',()=>{
  const snapshot=reviewSnapshot();
  const review=buildWeeklyOperatingReview({gameweek:1,snapshot,snapshotMetadata:[{snapshotId:snapshot.identity.snapshotId,season:'2026-27',gameweek:1,origin:'recovery_import',officialEligible:false,capturedAt:snapshot.timing.captureCompletedAt,deadlineTime:snapshot.deadlineTime}],outcome:reviewOutcome(),evaluation:reviewEvaluation()});
  assert.equal(review.status.snapshot,'recovery_only');
  assert.equal(review.completeness.status,'complete');
});

test('bundle range exposes missing intermediate Gameweeks and obeys local current pointers',async()=>{
  const local=reviewOutcome(1,1),recovery=reviewOutcome(1,2);
  const bundle=await buildOperatingReviewBundle({profile:'season_review',fromGameweek:1,toGameweek:3,snapshots:[reviewSnapshot(1),reviewSnapshot(3)],outcomes:[local,recovery],evaluations:[reviewEvaluation(1),reviewEvaluation(3)],outcomeMetadata:[{outcomeId:local.identity.outcomeId,season:'2026-27',gameweek:1,revision:1,status:'complete',collectedAt:local.collection.completedAt,origin:'local_collection',current:true,hasFullRecord:true},{outcomeId:recovery.identity.outcomeId,season:'2026-27',gameweek:1,revision:2,status:'corrected',collectedAt:recovery.collection.completedAt,origin:'recovery_import',current:false,hasFullRecord:true}],cryptoImpl:webcrypto});
  assert.deepEqual(bundle.scope.gameweeks,[1,2,3]);
  assert.equal(bundle.weeklyReviews.find(row=>row.gameweek===1).status.outcome,'complete');
  assert.equal(bundle.weeklyReviews.find(row=>row.gameweek===2).status.evaluation,'unavailable');
  assert.ok(bundle.completeness.missingEvaluationGameweeks.includes(2));
});

test('CSV output is deterministic, ordered and protects spreadsheet formulas without corrupting numeric negatives',async()=>{
  const bundle=await buildOperatingReviewBundle({profile:'weekly_evidence',fromGameweek:1,toGameweek:1,snapshots:[reviewSnapshot()],outcomes:[reviewOutcome()],evaluations:[reviewEvaluation()],cryptoImpl:webcrypto});
  const csv=buildOperatingReviewCsv(bundle,'players');assert.ok(csv.text.startsWith('\uFEFF'));assert.match(csv.text,/\r\n/);assert.match(csv.text,/'=IMPORTXML/);assert.match(csv.text,/,-2,2,/);assert.doesNotMatch(csv.text,/\'-2/);assert.equal(operatingReviewCsvSafeText('  @SUM(A1:A2)'),"'  @SUM(A1:A2)");assert.equal(operatingReviewCsvSafeText('\n=SUM(A1:A2)'),"'\n=SUM(A1:A2)");assert.equal(operatingReviewCsvSafeText('ordinary'),'ordinary');
});

test('all approved tidy CSV tables produce explicit row units',async()=>{
  const bundle=await buildOperatingReviewBundle({profile:'season_review',fromGameweek:1,toGameweek:2,snapshots:[reviewSnapshot(1),reviewSnapshot(2)],outcomes:[reviewOutcome(1),reviewOutcome(2)],evaluations:[reviewEvaluation(1),reviewEvaluation(2)],transferEvaluations:[reviewTransfer()],cryptoImpl:webcrypto});
  for(const table of ['gameweeks','players','minute_fixtures','squad_decisions','transfer_horizons','transfer_horizon_gameweeks','provider_states','revisions']){
    const csv=buildOperatingReviewCsv(bundle,table,{snapshots:[reviewSnapshot(1),reviewSnapshot(2)],evaluations:[reviewEvaluation(1),reviewEvaluation(2)]});assert.ok(csv.columns.length>0,table);assert.ok(csv.rowCount>=0,table);
  }
});

test('Markdown and filenames are deterministic and carry integrity warnings',async()=>{
  const bundle=await buildOperatingReviewBundle({profile:'weekly_evidence',fromGameweek:1,toGameweek:1,snapshots:[reviewSnapshot()],outcomes:[reviewOutcome()],evaluations:[reviewEvaluation()],cryptoImpl:webcrypto});
  const markdown=buildOperatingReviewMarkdown(bundle);assert.match(markdown,/Descriptive evidence only/);assert.match(markdown,/Hindsight oracle/);assert.match(markdown,/Bundle SHA-256/);assert.equal(operatingReviewFileName(bundle,'json'),'teamsheet-2026-27-gw01-gw01-weekly_evidence-v1.json');
});

test('size guard warns at 10 MB, rejects above 25 MB and source has no model recomputation path',()=>{
  assert.equal(assessOperatingReviewExport('x'.repeat(OPERATING_REVIEW_RULES.warningBytes+1)).warning,true);
  assert.equal(assessOperatingReviewExport('x'.repeat(OPERATING_REVIEW_RULES.maximumBytes+1)).allowed,false);
  const evidenceDirectory=new URL('../src/evidence/',import.meta.url),source=readdirSync(evidenceDirectory).filter(name=>name.startsWith('review')&&name.endsWith('.mjs')).map(name=>readFileSync(new URL(name,evidenceDirectory),'utf8')).join('\n'),ui=[new URL('../src/ui/review.mjs',import.meta.url),new URL('../src/ui/review-components.mjs',import.meta.url)].map(url=>readFileSync(url,'utf8')).join('\n');
  for(const forbidden of ['projectXP','minutesEstimate','simulatePlayerGameweek','optimiseTransfers']) assert.equal(source.includes(forbidden),false);
  assert.match(ui,/Operating review/);assert.match(ui,/Generated files are not retained/);assert.equal(/\.style(?:\.|\[|\s*=)|setAttribute\(\s*['"]style/.test(ui),false);
});

test('recovery-only outcomes do not become current when local outcome metadata is absent',async()=>{
  const recovery=reviewOutcome(1,2);
  const bundle=await buildOperatingReviewBundle({profile:'weekly_evidence',fromGameweek:1,toGameweek:1,snapshots:[reviewSnapshot()],outcomes:[recovery],evaluations:[],outcomeMetadata:[{outcomeId:recovery.identity.outcomeId,season:'2026-27',gameweek:1,revision:2,status:'corrected',collectedAt:recovery.collection.completedAt,origin:'recovery_import',current:false,hasFullRecord:true}],cryptoImpl:webcrypto});
  assert.equal(bundle.weeklyReviews[0].status.outcome,'unavailable');assert.ok(bundle.completeness.missingEvaluationGameweeks.includes(1));
});

test('season profile omits raw outcomes, compacts weekly row detail and still exports player rows',async()=>{
  const bundle=await buildOperatingReviewBundle({profile:'season_review',fromGameweek:1,toGameweek:2,snapshots:[reviewSnapshot(1),reviewSnapshot(2)],outcomes:[reviewOutcome(1),reviewOutcome(2)],evaluations:[reviewEvaluation(1),reviewEvaluation(2)],cryptoImpl:webcrypto});
  assert.equal(bundle.records.outcomes.length,0);assert.equal(bundle.weeklyReviews[0].rowDetailsOmitted,true);assert.equal(bundle.weeklyReviews[0].players.length,0);assert.equal(buildOperatingReviewCsv(bundle,'players',{snapshots:[reviewSnapshot(1),reviewSnapshot(2)],evaluations:[reviewEvaluation(1),reviewEvaluation(2)]}).rowCount,4);assert.ok(bundle.completeness.profileExcludedRecordIds.length>=2);
});

test('large 38-Gameweek season export remains bounded and produces 26,600 player rows',async()=>{
  const makeEvaluation=(gameweek,count=700)=>{
    const evaluation=reviewEvaluation(gameweek),player=evaluation.observations.players[0],minute=evaluation.observations.minuteFixtures[0];
    evaluation.observations.players=Array.from({length:count},(_,index)=>({...structuredClone(player),playerId:index+1,clubId:index%20+1,predictedPoints:index%12/2,observedPoints:index%16,error:index%12/2-index%16,absError:Math.abs(index%12/2-index%16),scheduleAligned:index%13!==0}));
    evaluation.observations.minuteFixtures=Array.from({length:count},(_,index)=>({...structuredClone(minute),playerId:index+1,fixtureId:gameweek*1000+index+1,observedMinutes:index%17===0?null:index%91,scheduleAligned:index%13!==0}));
    evaluation.coverage={...evaluation.coverage,eligiblePredictions:count,officialOutcomes:count,matchedPlayers:count,coverage:1,minuteFixtureRows:count,unallocatableMinuteRows:evaluation.observations.minuteFixtures.filter(row=>row.observedMinutes===null).length,startLabelRows:count,uncertaintyRows:count,scheduleAlignedPlayers:evaluation.observations.players.filter(row=>row.scheduleAligned).length};
    evaluation.identity={...evaluation.identity,logicalKey:`2026-27|gw${gameweek}`,evaluationId:`evaluation-2026-27-gw${gameweek}-r1-${String(gameweek).padStart(16,'0')}`};
    return evaluation;
  };
  const evaluations=Array.from({length:38},(_,index)=>makeEvaluation(index+1)),bundle=await buildOperatingReviewBundle({profile:'season_review',fromGameweek:1,toGameweek:38,evaluations,cryptoImpl:webcrypto}),json=JSON.stringify(bundle)+'\n',players=buildOperatingReviewCsv(bundle,'players',{evaluations});
  assert.equal(bundle.records.gameweekEvaluations.length,0);assert.equal(bundle.weeklyReviews.length,38);assert.equal(players.rowCount,26600);assert.equal(assessOperatingReviewExport(json).allowed,true);assert.equal(assessOperatingReviewExport(players.text).allowed,true);
});
