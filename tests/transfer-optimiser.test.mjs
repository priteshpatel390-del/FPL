import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTransferSquad, transferSellPrice, optimiseTransfersExhaustive, optimiseTransfersBranchAndBound } from '../src/model/transfers.mjs';

const positions=[1,1,2,2,2,2,2,3,3,3,3,3,4,4,4];
const squad=positions.map((pos,i)=>({p:{id:i+1,web_name:`P${i+1}`,element_type:pos,team:(i%5)+1,now_cost:50,status:'a'},bought:i===0?46:50}));
const candidates=[
  {id:101,web_name:'GK+',element_type:1,team:6,now_cost:52,status:'a'},
  {id:102,web_name:'DEF+',element_type:2,team:6,now_cost:54,status:'a'},
  {id:103,web_name:'MID+',element_type:3,team:7,now_cost:55,status:'d',chance_of_playing_next_round:50},
  {id:104,web_name:'FWD+',element_type:4,team:8,now_cost:56,status:'a'},
  {id:105,web_name:'OUT',element_type:3,team:9,now_cost:40,status:'i'}
];
const players=squad.map(x=>x.p).concat(candidates);
const project=(p,gw)=>(p.id>=100?8:2)+(gw%2)/10;

test('complete squad validation enforces position, duplicate and club rules',()=>{
  assert.equal(validateTransferSquad(squad).ok,true);
  assert.equal(validateTransferSquad(squad.slice(0,14)).ok,false);
  assert.equal(validateTransferSquad(squad.slice(0,14).concat(squad[0])).ok,false);
  const clubHeavy=squad.map((x,i)=>({p:{...x.p,team:i<4?20:x.p.team}}));
  assert.equal(validateTransferSquad(clubHeavy).ok,false);
});

test('selling price uses actual selling price and FPL rise calculation fallback',()=>{
  assert.equal(transferSellPrice({p:{now_cost:55},selling:51,bought:40}),51);
  assert.equal(transferSellPrice({p:{now_cost:55},bought:50}),52);
  assert.equal(transferSellPrice({p:{now_cost:45},bought:50}),45);
});

test('branch-and-bound exactly matches exhaustive search with deterministic ordering',()=>{
  const options={squad,players,bank:20,freeTransfers:1,startGW:4,horizon:3,project,maxResults:30};
  const exhaustive=optimiseTransfersExhaustive(options);
  const bounded=optimiseTransfersBranchAndBound(options);
  assert.equal(exhaustive.complete,true);
  assert.equal(bounded.complete,true);
  const shape=r=>r.plans.map(p=>({moves:p.moves.map(m=>[m.out.id,m.in.id]),objective:p.objective,hit:p.hit,next:p.nextFreeTransfers,bank:p.bank}));
  assert.deepEqual(shape(bounded),shape(exhaustive));
  assert.equal(bounded.plans.some(p=>p.moves.some(m=>m.in.id===103)),true,'doubtful incoming is allowed');
  assert.equal(bounded.plans.some(p=>p.moves.some(m=>m.in.id===105)),false,'unavailable incoming is excluded');
});

test('hit and next-free-transfer formulas cover zero through three moves',()=>{
  const r=optimiseTransfersExhaustive({squad,players,bank:30,freeTransfers:2,startGW:1,horizon:1,project,maxResults:1000});
  for(let count=0;count<=3;count++){
    const p=r.plans.find(x=>x.transferCount===count);
    assert.ok(p,`has ${count}-transfer plan`);
    assert.equal(p.paidTransfers,Math.max(0,count-2));
    assert.equal(p.hit,4*Math.max(0,count-2));
    assert.equal(p.nextFreeTransfers,Math.min(5,Math.max(0,2-count)+1));
  }
});

test('invalid squads fail closed without presenting a plan',()=>{
  const r=optimiseTransfersBranchAndBound({squad:squad.slice(1),players,project});
  assert.equal(r.complete,false);
  assert.deepEqual(r.plans,[]);
});
