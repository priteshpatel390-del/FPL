import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng, buildMinutesDistribution, sampleMinutes, summariseSamples, poisson } from '../src/model/simulation.mjs';

test('seeded RNG is deterministic and bounded',()=>{
  const a=createRng(123), b=createRng(123);
  const left=Array.from({length:20},()=>a()), right=Array.from({length:20},()=>b());
  assert.deepEqual(left,right);
  assert.ok(left.every(value=>value>=0&&value<1));
});

test('minutes distribution preserves approved marginals',()=>{
  const d=buildMinutesDistribution({pStart:0.7,pAppear:0.9,p60:0.6,expMin:62});
  const total=d.states.reduce((sum,row)=>sum+row.probability,0);
  const start=d.states.filter(row=>row.key.startsWith('start')).reduce((sum,row)=>sum+row.probability,0);
  const sixty=d.states.filter(row=>row.min>=60).reduce((sum,row)=>sum+row.probability,0);
  assert.ok(Math.abs(total-1)<1e-12);
  assert.ok(Math.abs(start-0.7)<1e-12);
  assert.ok(Math.abs(sixty-0.6)<1e-12);
  assert.equal(d.quality,'full');
});

test('sampled minutes converge to expected minutes',()=>{
  const d=buildMinutesDistribution({pStart:0.65,pAppear:0.85,p60:0.55,expMin:57});
  const rng=createRng(7);
  const values=Array.from({length:25000},()=>sampleMinutes(d,rng).minutes);
  const mean=values.reduce((a,b)=>a+b,0)/values.length;
  assert.ok(Math.abs(mean-57)<0.7,`mean ${mean}`);
});

test('inconsistent minutes are bounded and labelled reduced',()=>{
  const d=buildMinutesDistribution({pStart:1,pAppear:1,p60:1,expMin:10});
  assert.equal(d.quality,'reduced');
  assert.equal(d.targetMean,60);
});

test('summary thresholds and percentile order are stable',()=>{
  const result=summariseSamples([0,1,2,5,10,15]);
  assert.ok(result.p10<=result.p25&&result.p25<=result.median&&result.median<=result.p75&&result.p75<=result.p90);
  assert.equal(result.blankProbability,0.5);
  assert.equal(result.returnProbability,0.5);
  assert.equal(result.haulProbability,2/6);
  assert.equal(result.megaHaulProbability,1/6);
});

test('Poisson sampler handles zero and remains deterministic',()=>{
  const a=createRng(42), b=createRng(42);
  assert.equal(poisson(0,a),0);
  assert.deepEqual(Array.from({length:50},()=>poisson(1.4,a)),Array.from({length:50},()=>poisson(1.4,b)));
});
