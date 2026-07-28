import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateDatasetPin, normaliseObservations, buildWalkForwardFolds,
  fitPositionCalibration, applyPositionCalibration, metricSummary,
  segmentedMetrics, compareAblations, stableResult, evaluateWalkForward
} from '../src/model/walk-forward.mjs';

const checksum='a'.repeat(64);
const sourceRef='b'.repeat(40);
const pin={season:'2025-26',sourceRef,sha256:checksum,rows:200,malformedRows:2};

function rows(gameweeks=14, variants=['raw']){
  const out=[];
  for(let gw=1;gw<=gameweeks;gw++) for(const variant of variants) for(let playerId=1;playerId<=4;playerId++){
    out.push({playerId,position:playerId,gameweek:gw,informationGameweek:gw-1,
      predicted:gw+playerId+(variant==='alt'?0.5:0),actual:gw+playerId+1,variant});
  }
  return out;
}

test('dataset pin requires immutable reference and SHA-256 checksum',()=>{
  assert.equal(validateDatasetPin(pin).ok,true);
  assert.equal(validateDatasetPin({...pin,sourceRef:'main'}).ok,false);
  assert.equal(validateDatasetPin({...pin,sha256:'bad'}).ok,false);
});

test('observations are sorted deterministically and identical duplicates collapse',()=>{
  const input=[rows(1)[3],rows(1)[0],rows(1)[0]];
  const clean=normaliseObservations(input);
  assert.equal(clean.length,2);
  assert.deepEqual(clean.map(row=>row.playerId),[1,4]);
});

test('conflicting duplicate observations fail closed',()=>{
  const base=rows(1)[0];
  assert.throws(()=>normaliseObservations([base,{...base,actual:99}]),/conflicting duplicate/);
});

test('future information is rejected',()=>{
  const row=rows(1)[0];
  assert.throws(()=>normaliseObservations([{...row,informationGameweek:1}]),/future information/);
});

test('walk-forward fold boundaries are chronological and separated',()=>{
  const result=buildWalkForwardFolds(rows(14),{minTrainingGameweeks:8,calibrationGameweeks:4,holdoutGameweeks:1});
  assert.equal(result.folds.length,2);
  assert.deepEqual(result.folds[0].trainGameweeks,[1,2,3,4,5,6,7,8]);
  assert.deepEqual(result.folds[0].calibrationGameweeks,[9,10,11,12]);
  assert.deepEqual(result.folds[0].holdoutGameweeks,[13]);
  assert.deepEqual(result.folds[1].holdoutGameweeks,[14]);
});

test('position calibration is fitted only from supplied rows and bounded',()=>{
  const calibration=fitPositionCalibration([
    {playerId:1,position:1,gameweek:2,informationGameweek:1,predicted:1,actual:10,variant:'raw'},
    {playerId:2,position:2,gameweek:2,informationGameweek:1,predicted:10,actual:1,variant:'raw'}
  ]);
  assert.equal(calibration[1],1.3);
  assert.equal(calibration[2],0.7);
});

test('calibration application creates an isolated named variant',()=>{
  const source=rows(1);
  const calibrated=applyPositionCalibration(source,{1:1.2,2:1,3:1,4:1});
  assert.equal(calibrated[0].variant,'fold_calibrated');
  assert.equal(calibrated[0].predicted,source[0].predicted*1.2);
  assert.equal(source[0].variant,'raw');
});

test('metric summary calculates deterministic MAE RMSE bias and correlation',()=>{
  const summary=metricSummary([
    {playerId:1,position:1,gameweek:2,informationGameweek:1,predicted:2,actual:1,variant:'raw'},
    {playerId:2,position:2,gameweek:2,informationGameweek:1,predicted:4,actual:2,variant:'raw'},
    {playerId:3,position:3,gameweek:2,informationGameweek:1,predicted:6,actual:3,variant:'raw'}
  ]);
  assert.equal(summary.n,3);
  assert.equal(summary.mae,2);
  assert.ok(Math.abs(summary.rmse-Math.sqrt(14/3))<1e-12);
  assert.equal(summary.bias,2);
  assert.equal(summary.r,1);
});

test('segmented metrics expose position gameweek variant and prediction bands',()=>{
  const result=segmentedMetrics(rows(2,['raw','alt']));
  assert.ok(result.byPosition['1']);
  assert.ok(result.byGameweek['2']);
  assert.ok(result.byVariant.raw);
  assert.ok(Object.keys(result.byPredictionBand).length>0);
});

test('ablation comparison requires identical holdout keys',()=>{
  const matched=rows(2,['raw','alt']);
  assert.deepEqual(Object.keys(compareAblations(matched)),['alt','raw']);
  assert.throws(()=>compareAblations(matched.slice(0,-1)),/identical holdout keys/);
});

test('stable result serialisation is key ordered and rounds finite numbers',()=>{
  assert.equal(stableResult({z:1/3,a:{y:2,x:1}}),'{"a":{"x":1,"y":2},"z":0.33333333}');
});

test('full evaluation preserves supplied ablations when fold calibration is disabled',()=>{
  const result=evaluateWalkForward(rows(14,['raw','alt']),{dataset:pin},{includeFoldCalibration:false});
  assert.equal(result.method,'deadline-information-only walk-forward');
  assert.equal(result.folds.length,2);
  assert.equal(result.oddsHistory,'not_available');
  assert.equal(result.dataset.malformedRows,2);
  assert.deepEqual(Object.keys(result.ablations),['alt','raw']);
  assert.throws(()=>evaluateWalkForward(rows(14),{dataset:{...pin,sourceRef:'main'}}),/not pinned/);
});

test('raw-only evaluation emits train-only fold calibration',()=>{
  const result=evaluateWalkForward(rows(14),{dataset:pin});
  assert.deepEqual(Object.keys(result.ablations),['fold_calibrated','raw']);
  assert.equal(result.ablations.raw.overall.n,result.ablations.fold_calibrated.overall.n);
  assert.ok(result.folds.every(fold=>fold.calibration&&Object.keys(fold.calibration).length===4));
});
