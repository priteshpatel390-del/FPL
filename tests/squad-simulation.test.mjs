import test from 'node:test';
import assert from 'node:assert/strict';
import { formationCounts, legalXI, applyAutosubs, applyCaptainFallback } from '../src/model/squad-simulation.mjs';

const entry=(id,pos)=>({p:{id,element_type:pos}});
const starters=[entry(1,1),entry(2,2),entry(3,2),entry(4,2),entry(5,2),entry(6,3),entry(7,3),entry(8,3),entry(9,3),entry(10,4),entry(11,4)];
const bench=[entry(12,1),entry(13,3),entry(14,2),entry(15,4)];

function outcomes(appearing){
  const map=new Map();
  [...starters,...bench].forEach(item=>map.set(item.p.id,{appeared:appearing.includes(item.p.id),points:item.p.id}));
  return map;
}

test('legal XI enforces official formation minimums',()=>{
  assert.deepEqual(formationCounts(starters),{1:1,2:4,3:4,4:2});
  assert.equal(legalXI(starters),true);
  assert.equal(legalXI(starters.filter(item=>item.p.id!==2).concat(entry(20,4))),true);
  assert.equal(legalXI(starters.filter(item=>[2,3].includes(item.p.id)).concat(entry(20,4),entry(21,4))),false);
});

test('reserve goalkeeper only replaces a missing goalkeeper',()=>{
  const map=outcomes([2,3,4,5,6,7,8,9,10,11,12,13,14,15]);
  const result=applyAutosubs(starters,bench,map);
  assert.ok(result.scoringXI.some(item=>item.p.id===12));
  assert.ok(!result.scoringXI.some(item=>item.p.id===1));
});

test('outfield bench order is respected while preserving formation',()=>{
  const map=outcomes([1,3,4,5,6,7,8,9,10,11,13,14,15]);
  const result=applyAutosubs(starters,bench,map);
  assert.ok(result.scoringXI.some(item=>item.p.id===14));
  assert.ok(!result.scoringXI.some(item=>item.p.id===13));
});

test('captain falls to vice only when captain does not appear',()=>{
  const map=outcomes([1,2,3,4,5,6,7,8,9,10,11,13,14,15]);
  assert.equal(applyCaptainFallback(12,13,map),13);
  assert.equal(applyCaptainFallback(13,14,map),13);
  assert.equal(applyCaptainFallback(12,99,map),null);
});
