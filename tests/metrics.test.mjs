import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  metricSummary,brierScore,reliabilityBins,intervalSummary,sampleStatus,errorBand,priceBand,seasonPeriod,
  allocateMinuteFixtures,legalXIIds,enumerateLegalXIs,applyRealisedAutosubs,captainPairScore,
  buildGameweekEvaluation,validateGameweekEvaluation,buildMetricsReport,
  buildTransferHorizonEvaluation,validateTransferHorizonEvaluation
} from '../src/evidence/metrics.mjs';

const managerRef='mgr-0123456789abcdef0123456789abcdef';
const deadline='2026-08-21T17:30:00.000Z';
const hash=value=>String(value).repeat(64).slice(0,64);
function prediction(id,overrides={}){
  return {playerId:id,clubId:overrides.clubId??1,position:overrides.position??3,nowCost:overrides.nowCost??75,status:overrides.status??'a',minutes:{pStart:.7,pAppear:.9,p60:.6,expMin:70,confidence:.8,confidenceLabel:'High',source:'detailed'},nextGameweek:{gw:1,total:overrides.predicted??5,games:1,parts:{}},perGameweek:[{gw:1,total:overrides.predicted??5,games:1,parts:{}}],aggregate:{fromGameweek:1,horizon:1,total:overrides.predicted??5,perGameweek:[overrides.predicted??5],games:1,parts:{}},uncertainty:{status:'available',p10:1,p25:3,median:5,p75:7,p90:10,blankProbability:.2,returnProbability:.5,haulProbability:.1,megaHaulProbability:.02},sourceUsage:{fpl:true,understat:false,odds:false,minutesSource:'detailed',archiveCalibration:false},...overrides};
}
function officialPlayer(id,overrides={}){
  const minutes=overrides.minutes??90,starts=overrides.starts===undefined?1:overrides.starts,totalPoints=overrides.totalPoints??6;
  return {playerId:id,totalPoints,minutes,starts,appeared:minutes>0,reachedSixty:minutes>=60,perFixture:overrides.perFixture??[{fixtureId:10,points:totalPoints,officialStats:[{identifier:'minutes',points:0,value:minutes},{identifier:'starts',points:0,value:starts??0}]}]};
}
function snapshot(players=[prediction(1)],overrides={}){
  return {recordType:'preDeadlineSnapshot',schemaVersion:'1.0.0',metricVersion:'1.0.0',segmentationVersion:'1.0.0',managerRef,season:'2026-27',gameweek:1,deadlineTime:deadline,timing:{officialEligible:true},completeness:{complete:true},identity:{snapshotId:'predeadline-gw1-0123456789abcdef',contentHash:hash('a')},providers:[{provider:'fpl',state:'Live'},{provider:'understat',state:'Disabled'},{provider:'odds',state:'Disabled'},{provider:'archive',state:'Disabled'}],modelInputs:{fixtures:[{id:10,event:1,team_h:1,team_a:2,team_h_difficulty:2,team_a_difficulty:4}]},outputs:{players,squad:{status:'not_available'}},...overrides};
}
function outcome(players=[officialPlayer(1)],overrides={}){
  return {recordType:'gameweekOutcome',schemaVersion:'1.0.0',managerRef,season:'2026-27',gameweek:1,status:'complete',officialDeadlineIdentity:{deadlineTime:deadline},relatedSnapshot:{status:'matched_official',snapshotId:'predeadline-gw1-0123456789abcdef',contentHash:hash('a')},fixtureOutcomes:{records:[{fixtureId:10,event:1,homeTeamId:1,awayTeamId:2,finished:true}]},allPlayerOutcomes:{records:players},realSquadOutcome:{status:'not_available',reason:'public_manager_outcome_unavailable',picks:[]},completeness:{complete:true},identity:{outcomeId:'outcome-2026-27-gw1-r1-0123456789abcdef',outcomeDataHash:hash('b'),revision:1},...overrides};
}

test('fixed player metrics cover zero error, signed bias and correlations',()=>{
  const zero=metricSummary([{predicted:2,observed:2},{predicted:4,observed:4},{predicted:6,observed:6}]);
  assert.equal(zero.mae,0);assert.equal(zero.rmse,0);assert.equal(zero.bias,0);assert.equal(zero.pearson,1);assert.equal(zero.spearman,1);
  assert.equal(metricSummary([{predicted:3,observed:1},{predicted:4,observed:2},{predicted:5,observed:3}]).bias,2);
  assert.equal(metricSummary([{predicted:1,observed:3},{predicted:2,observed:4},{predicted:3,observed:5}]).bias,-2);
  assert.equal(metricSummary([{predicted:1,observed:1},{predicted:1,observed:2},{predicted:1,observed:3}]).pearson,null);
});

test('Spearman average ranks and error-band boundaries are deterministic',()=>{
  const tied=metricSummary([{predicted:1,observed:1},{predicted:1,observed:1},{predicted:3,observed:3}]);
  assert.equal(tied.spearman,1);
  assert.deepEqual([0,.1,2,2.1,5,5.1,10,10.1].map(errorBand),['exact','small','small','material','material','large','large','very_large']);
});

test('Brier, reliability and interval calculations use approved inclusive rules',()=>{
  assert.equal(brierScore([{probability:.8,outcome:1},{probability:.2,outcome:0}]).brier,.04);
  const bins=reliabilityBins(Array.from({length:30},()=>({probability:.95,outcome:1})));
  assert.equal(bins[9].observedFrequency,1);
  assert.equal(reliabilityBins(Array.from({length:29},()=>({probability:.95,outcome:1})))[9].observedFrequency,null);
  const interval=intervalSummary([{lower:1,upper:5,observed:1},{lower:2,upper:4,observed:5}],'lower','upper');
  assert.equal(interval.coverage,.5);assert.equal(interval.width,3);
});

test('sample safeguards enforce exact boundaries and provider AND rule',()=>{
  assert.equal(sampleStatus(29,9).level,'raw_only');
  assert.equal(sampleStatus(30,9).level,'descriptive');
  assert.equal(sampleStatus(199,20).level,'descriptive');
  assert.equal(sampleStatus(200,9).level,'descriptive');
  assert.equal(sampleStatus(200,10).level,'potentially_stable');
  assert.equal(sampleStatus(100,4,{kind:'provider'}).level,'raw_only');
  assert.equal(sampleStatus(99,5,{kind:'provider'}).level,'raw_only');
  assert.equal(sampleStatus(100,5,{kind:'provider'}).level,'descriptive');
});

test('approved season periods and position-aware price bands are exact',()=>{
  assert.deepEqual([0,1,6,7,12,13,38].map(seasonPeriod),['pre-season','early','early','transition','transition','mature','mature']);
  assert.equal(priceBand(2,44),'up_to_4.4');assert.equal(priceBand(2,45),'4.5_to_5.4');assert.equal(priceBand(3,100),'10.0_plus');assert.equal(priceBand(4,95),'9.5_plus');
});

test('minutes allocation handles singles, doubles, missing starts and postponed fixtures',()=>{
  const p=prediction(1);
  const single=allocateMinuteFixtures(p,officialPlayer(1,{minutes:72,starts:null,perFixture:[]}),[{id:10}], [{fixtureId:10}]);
  assert.equal(single[0].observedMinutes,72);assert.equal(single[0].started,null);
  const double=allocateMinuteFixtures(p,officialPlayer(1,{minutes:90,starts:1,perFixture:[{fixtureId:10,officialStats:[{identifier:'minutes',value:90,points:0},{identifier:'starts',value:1,points:0}]}]}),[{id:10},{id:11}],[{fixtureId:10},{fixtureId:11}]);
  assert.deepEqual(double.map(row=>row.observedMinutes),[90,0]);assert.deepEqual(double.map(row=>row.started),[1,0]);
  const unallocatable=allocateMinuteFixtures(p,officialPlayer(1,{minutes:120,starts:2,perFixture:[{fixtureId:10,officialStats:[{identifier:'minutes',value:70,points:0}]}]}),[{id:10},{id:11}],[{fixtureId:10},{fixtureId:11}]);
  assert.equal(unallocatable[1].observedMinutes,null);
  const postponed=allocateMinuteFixtures(p,officialPlayer(1,{minutes:0,starts:0,perFixture:[]}),[{id:10}],[]);
  assert.equal(postponed[0].observedMinutes,0);assert.equal(postponed[0].scheduleAligned,false);
});

test('legal substitutions respect goalkeeper and minimum formation constraints',()=>{
  const positions=new Map([[1,1],[2,1],[3,2],[4,2],[5,2],[6,2],[7,2],[8,3],[9,3],[10,3],[11,3],[12,3],[13,4],[14,4],[15,4]]);
  const starters=[1,3,4,5,8,9,10,11,13,14,15],bench=[2,6,7,12];
  assert.equal(legalXIIds(starters,positions),true);assert.ok(enumerateLegalXIs([...starters,...bench],positions).length>0);
  const outcomes=new Map([...positions.keys()].map(id=>[id,{points:id,appeared:true}]));outcomes.set(1,{points:0,appeared:false});outcomes.set(3,{points:0,appeared:false});
  const result=applyRealisedAutosubs(starters,bench,positions,outcomes);
  assert.deepEqual(result.replacements,[{playerIn:2,playerOut:1},{playerIn:6,playerOut:3}]);
  assert.ok(result.scoringXI.includes(2));assert.ok(result.scoringXI.includes(6));
});

test('captain non-appearance uses vice and neither appearance gives no doubled points',()=>{
  const outcomes=new Map([[1,{points:10,appeared:false}],[2,{points:7,appeared:true}]]);
  assert.deepEqual(captainPairScore(1,2,outcomes),{captainId:1,doubledContribution:7,effectiveCaptainId:2,viceCaptainId:2,viceTookOver:true});
  outcomes.set(2,{points:7,appeared:false});assert.equal(captainPairScore(1,2,outcomes).doubledContribution,0);
});

test('authoritative evaluation joins exact IDs, preserves source records and validates hashes',async()=>{
  const s=snapshot([prediction(1,{predicted:5}),prediction(2,{predicted:2,clubId:2})],{modelInputs:{fixtures:[{id:10,event:1,team_h:1,team_a:2,team_h_difficulty:2,team_a_difficulty:4}]}}),o=outcome([officialPlayer(1,{totalPoints:8}),officialPlayer(2,{totalPoints:0})]);
  const beforeS=structuredClone(s),beforeO=structuredClone(o),built=await buildGameweekEvaluation(s,o,{cryptoImpl:webcrypto});
  assert.equal(built.ok,true);assert.equal(built.record.reports.player.mae,2.5);assert.equal(built.record.reports.player.bias,-.5);assert.equal(built.record.coverage.matchedPlayers,2);
  assert.deepEqual(s,beforeS);assert.deepEqual(o,beforeO);assert.equal(Object.isFrozen(built.record),true);
  assert.equal((await validateGameweekEvaluation(built.record,webcrypto)).ok,true);
  const tampered=structuredClone(built.record);tampered.observations.players[0].observedPoints=99;assert.equal((await validateGameweekEvaluation(tampered,webcrypto)).ok,false);
});

test('invalid, late, provisional and mismatched records fail closed',async()=>{
  const s=snapshot(),o=outcome();
  assert.equal((await buildGameweekEvaluation({...s,timing:{officialEligible:false}},o,{cryptoImpl:webcrypto})).reason,'snapshot_not_official');
  assert.equal((await buildGameweekEvaluation(s,{...o,status:'provisional',completeness:{complete:false}},{cryptoImpl:webcrypto})).reason,'outcome_not_authoritative');
  assert.equal((await buildGameweekEvaluation(s,{...o,gameweek:2},{cryptoImpl:webcrypto})).reason,'identity_mismatch');
});

test('corrected official outcomes append an immutable evaluation revision',async()=>{
  const first=(await buildGameweekEvaluation(snapshot(),outcome(),{cryptoImpl:webcrypto})).record;
  const correctedOutcome=outcome([officialPlayer(1,{totalPoints:9})],{status:'corrected',identity:{outcomeId:'outcome-2026-27-gw1-r2-fedcba9876543210',outcomeDataHash:hash('c'),revision:2}});
  const second=(await buildGameweekEvaluation(snapshot(),correctedOutcome,{previousRecord:first,cryptoImpl:webcrypto})).record;
  assert.equal(second.identity.revision,2);assert.equal(second.identity.supersedesEvaluationId,first.identity.evaluationId);assert.equal(first.observations.players[0].observedPoints,6);assert.equal(second.observations.players[0].observedPoints,9);
});

test('cumulative reporting filters scheduled and owned segments without hiding missingness',async()=>{
  const built=(await buildGameweekEvaluation(snapshot(),outcome(),{cryptoImpl:webcrypto})).record;
  assert.equal(buildMetricsReport([built]).player.metrics.n,1);
  assert.equal(buildMetricsReport([built],{dimension:'schedule',value:'schedule_aligned'}).player.metrics.n,1);
  assert.equal(buildMetricsReport([built],{dimension:'owned',value:'owned'}).player.metrics.n,0);
});

function transferStartEvaluation(){
  const positions=new Map([[1,1],[2,1],[3,2],[4,2],[5,2],[6,2],[7,2],[8,3],[9,3],[10,3],[11,3],[12,3],[13,4],[14,4],[15,4],[16,4]]);
  const squad=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],planSquad=[1,2,3,4,5,6,7,8,9,10,11,12,13,14,16],xi=[1,3,4,5,8,9,10,11,13,14,15],planXi=[1,3,4,5,8,9,10,11,13,14,16];
  const players=[...positions].map(([playerId,position])=>({playerId,position,perGameweek:[{gw:1,total:playerId===16?8:4}]}));
  return {recordType:'gameweekEvaluation',managerRef,season:'2026-27',gameweek:1,completeness:{complete:true},identity:{evaluationId:'evaluation-2026-27-gw1-r1-0123456789abcdef'},observations:{players:[...positions].map(([playerId])=>({playerId,observedPoints:playerId===16?12:playerId===15?2:4,appeared:true,scheduleAligned:true}))},decisions:{transferBasis:{horizon:1,players,baseline:{transferCount:0,finalSquadIds:squad,perGameweekBestXI:[{gw:1,playerIds:xi}],hitCost:0,rollDifference:0,freeTransfersNextGW:2,signature:''},plans:[{transferCount:1,finalSquadIds:planSquad,perGameweekBestXI:[{gw:1,playerIds:planXi}],hitCost:4,rollDifference:-1,freeTransfersNextGW:1,signature:'15>16',transfers:[{outPlayerId:15,inPlayerId:16}]}]}}};
}

test('frozen transfer horizon compares plan with zero-transfer baseline and subtracts hits only',async()=>{
  const start=transferStartEvaluation(),byGw=new Map([[1,start]]),built=await buildTransferHorizonEvaluation(start,byGw,{cryptoImpl:webcrypto});
  assert.equal(built.ok,true);assert.equal(built.record.plans[0].grossGain,10);assert.equal(built.record.plans[0].netGainAfterHits,6);assert.equal(built.record.plans[0].rollDifference,-1);
  assert.equal((await validateTransferHorizonEvaluation(built.record,webcrypto)).ok,true);
  assert.equal((await buildTransferHorizonEvaluation({...start,decisions:{...start.decisions,transferBasis:{...start.decisions.transferBasis,horizon:2}}},byGw,{cryptoImpl:webcrypto})).reason,'horizon_in_progress');
});

test('metric engine never imports or calls live production formula functions',()=>{
  const source=readFileSync(new URL('../src/evidence/metrics.mjs',import.meta.url),'utf8');
  for(const forbidden of ['projectXP','minutesEstimate','simulatePlayerGameweek','optimiseTransfers']) assert.equal(source.includes(forbidden),false,forbidden);
});
