import test from 'node:test';
import assert from 'node:assert/strict';
import { S } from '../src/state.mjs';
import { aggregateMinutes, minutesEstimate } from '../src/model/minutes.mjs';
import { validateElementSummary } from '../src/providers/minutes-history.mjs';

globalThis.window = globalThis.window || {};
globalThis.localStorage = globalThis.localStorage || {getItem(){return null;},setItem(){}};

function setup(){
  S.seasonLive = true;
  S.fixtures = Array.from({length:8},(_,i)=>({id:i+1,team_h:1,team_a:2,finished:true}));
  S.minuteHistory = {};
}
function player(extra={}){
  return {id:10,team:1,minutes:720,starts:8,status:'a',chance_of_playing_next_round:null,...extra};
}

test('aggregate denominator uses completed team matches', () => {
  const a = aggregateMinutes(player({minutes:450,starts:5}), 10);
  assert.equal(a.expMin,45);
  assert.equal(a.pStart,0.5);
});

test('stable starter produces coherent high-role outputs', () => {
  setup();
  S.minuteHistory[10] = Array.from({length:8},(_,i)=>({fixture:i+1,round:i+1,minutes:80,starts:1,kickoff_time:`2026-09-${String(i+1).padStart(2,'0')}T14:00:00Z`}));
  const m = minutesEstimate(player({minutes:640}));
  assert.ok(m.pStart > 0.9);
  assert.ok(m.pAppear >= m.pStart);
  assert.ok(m.p60 <= m.pAppear);
  assert.ok(m.expMin > 75 && m.expMin <= 90);
  assert.equal(m.source,'detailed');
});

test('regular substitute separates appearance from start probability', () => {
  setup();
  S.minuteHistory[10] = Array.from({length:8},(_,i)=>({fixture:i+1,round:i+1,minutes:25,starts:0}));
  const m = minutesEstimate(player({minutes:200,starts:0}));
  assert.ok(m.pAppear > m.pStart);
  assert.ok(m.p60 < m.pAppear);
  assert.ok(m.expMin < 35);
});

test('rotation sequence lowers role stability confidence', () => {
  setup();
  S.minuteHistory[10] = Array.from({length:8},(_,i)=>({fixture:i+1,round:i+1,minutes:i%2?20:80,starts:i%2?0:1}));
  const rotated = minutesEstimate(player({minutes:400,starts:4}));
  S.minuteHistory[10] = Array.from({length:8},(_,i)=>({fixture:i+1,round:i+1,minutes:50,starts:1}));
  const stable = minutesEstimate(player({minutes:400,starts:8}));
  assert.ok(rotated.confidence < stable.confidence);
});

test('doubtful availability is applied exactly once', () => {
  setup();
  S.minuteHistory[10] = Array.from({length:8},(_,i)=>({fixture:i+1,round:i+1,minutes:90,starts:1}));
  const full = minutesEstimate(player());
  const half = minutesEstimate(player({status:'d',chance_of_playing_next_round:50}));
  assert.ok(Math.abs(half.expMin - full.expMin*0.5) < 1e-9);
  assert.ok(Math.abs(half.pAppear - full.pAppear*0.5) < 1e-9);
});

test('injured and suspended players return zero outputs', () => {
  setup();
  for(const status of ['i','u','s','n']){
    const m = minutesEstimate(player({status}));
    assert.deepEqual([m.pStart,m.pAppear,m.p60,m.expMin],[0,0,0,0]);
  }
});

test('limited history remains shrunk toward aggregate evidence', () => {
  setup();
  S.minuteHistory[10] = [{fixture:8,round:8,minutes:90,starts:1}];
  const m = minutesEstimate(player({minutes:180,starts:2}));
  assert.ok(m.pStart < 0.7);
  assert.equal(m.confidenceLabel,'Low');
});

test('logical invariants hold for hostile numeric inputs', () => {
  setup();
  S.minuteHistory[10] = [{fixture:8,round:8,minutes:999,starts:5}];
  const m = minutesEstimate(player({minutes:-100,starts:99}));
  assert.ok(m.pStart >= 0 && m.pStart <= m.pAppear);
  assert.ok(m.p60 >= 0 && m.p60 <= m.pAppear);
  assert.ok(m.pAppear <= 1);
  assert.ok(m.expMin >= 0 && m.expMin <= 90);
  assert.ok(Number.isFinite(m.confidence));
});

test('element-summary validation drops malformed rows without payload leakage', () => {
  const v = validateElementSummary({history:[{fixture:1,round:1,minutes:90,starts:1},{fixture:'bad',minutes:'x',secret:'do-not-copy'}]});
  assert.equal(v.value.length,1);
  assert.equal(v.issues[0].severity,'partial');
  assert.equal(JSON.stringify(v.issues).includes('do-not-copy'),false);
});

test('element-summary unusable structure is fatal', () => {
  const v = validateElementSummary({history:null});
  assert.equal(v.value,null);
  assert.equal(v.issues[0].severity,'fatal');
});
