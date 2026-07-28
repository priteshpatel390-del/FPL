import test from 'node:test';
import assert from 'node:assert/strict';
import { TRANSFER_RULES } from '../src/config.mjs';
import {
  transferSellPrice, nextFreeTransfers, transferHit, validateSquad,
  bestXIForGW, optimiseTransfers, exhaustiveTransferSearch
} from '../src/model/transfers.mjs';

function player(id,pos,team,cost,xp,status='a'){
  return {id,element_type:pos,team,now_cost:cost,web_name:`P${id}`,status,xp};
}
function legalSquad(){
  const ps=[]; let id=1;
  for(const [pos,n] of [[1,2],[2,5],[3,5],[4,3]]) for(let i=0;i<n;i++) ps.push({p:player(id++,pos,(i%5)+1,50,2+i/10),bought:50});
  return ps;
}
const score=(p)=>p.xp;

test('Stage 6 rules are explicit and versioned',()=>{
  assert.equal(TRANSFER_RULES.maxTransfers,3);
  assert.equal(TRANSFER_RULES.maxFreeTransfers,5);
  assert.equal(TRANSFER_RULES.pointsPerPaidTransfer,4);
  assert.equal(TRANSFER_RULES.rollValue,0.5);
  assert.deepEqual(TRANSFER_RULES.positionQuotas,{1:2,2:5,3:5,4:3});
});

test('selling price keeps half of rises rounded down',()=>{
  assert.equal(transferSellPrice({p:{now_cost:49},bought:50}),49);
  assert.equal(transferSellPrice({p:{now_cost:51},bought:50}),50);
  assert.equal(transferSellPrice({p:{now_cost:52},bought:50}),51);
  assert.equal(transferSellPrice({p:{now_cost:53},bought:50}),51);
});

test('free-transfer and hit formulas cover ordinary plans',()=>{
  assert.deepEqual(transferHit(1,3),{paidTransfers:2,hitCost:8});
  assert.deepEqual(transferHit(3,3),{paidTransfers:0,hitCost:0});
  assert.equal(nextFreeTransfers(1,0),2);
  assert.equal(nextFreeTransfers(1,1),1);
  assert.equal(nextFreeTransfers(5,0),5);
  assert.equal(nextFreeTransfers(5,3),3);
});

test('full squad legality enforces 15 distinct players and exact quotas',()=>{
  const squad=legalSquad();
  assert.equal(validateSquad(squad).ok,true);
  assert.equal(validateSquad(squad.slice(0,14)).ok,false);
  const duplicate=squad.slice(); duplicate[14]=duplicate[0];
  assert.equal(validateSquad(duplicate).ok,false);
});

test('best XI selects a legal formation deterministically',()=>{
  const squad=legalSquad();
  const xi=bestXIForGW(squad,1,score);
  assert.equal(xi.playerIds.length,11);
  assert.match(xi.formation,/^[3-5]-[2-5]-[1-3]$/);
  const shuffled=squad.slice().reverse();
  assert.deepEqual(bestXIForGW(shuffled,1,score),xi);
});

test('zero-transfer baseline is always present and can win',()=>{
  const squad=legalSquad();
  const pool=squad.map(x=>x.p).concat([player(100,2,10,50,0.1)]);
  const result=optimiseTransfers({squad,players:pool,bank:0,freeTransfers:1,startGW:1,horizon:1,scorePlayer:score});
  assert.equal(result.status,'ok');
  assert.equal(result.plans[0].transferCount,0);
  assert.equal(result.plans[0].netGain,0);
});

test('shared bank is applied once across a coordinated plan',()=>{
  const squad=legalSquad();
  const mids=squad.filter(x=>x.p.element_type===3);
  mids[0].p.xp=0; mids[1].p.xp=0;
  const pool=squad.map(x=>x.p).concat([
    player(101,3,10,60,10),
    player(102,3,11,40,4)
  ]);
  const result=optimiseTransfers({squad,players:pool,bank:0,freeTransfers:2,startGW:1,horizon:1,scorePlayer:score,maxResults:10});
  assert.equal(result.status,'ok');
  const two=result.plans.find(p=>p.transferCount===2&&p.transfers.some(t=>t.inPlayerId===101)&&p.transfers.some(t=>t.inPlayerId===102));
  assert.ok(two);
  assert.equal(two.bankAfter,0);
});

test('unavailable purchases are excluded while doubtful purchases remain eligible',()=>{
  const squad=legalSquad();
  const out=squad.find(x=>x.p.element_type===4); out.p.xp=0;
  const pool=squad.map(x=>x.p).concat([
    player(201,4,10,50,20,'i'),
    {...player(202,4,11,50,10,'d'),chance_of_playing_next_round:50}
  ]);
  const result=optimiseTransfers({squad,players:pool,bank:0,freeTransfers:1,startGW:1,horizon:1,scorePlayer:score});
  assert.equal(result.plans.some(p=>p.transfers.some(t=>t.inPlayerId===201)),false);
  const doubt=result.plans.find(p=>p.transfers.some(t=>t.inPlayerId===202));
  assert.ok(doubt);
  assert.equal(doubt.warnings.length,1);
});

test('production and exhaustive reference exports agree exactly on a reduced pool',()=>{
  const squad=legalSquad();
  const out=squad.find(x=>x.p.element_type===2); out.p.xp=0;
  const pool=squad.map(x=>x.p).concat([player(301,2,10,50,4),player(302,2,11,50,5)]);
  const args={squad,players:pool,bank:0,freeTransfers:1,startGW:1,horizon:2,scorePlayer:score,maxResults:20};
  assert.deepEqual(optimiseTransfers(args),exhaustiveTransferSearch(args));
});

test('an evaluation ceiling fails closed instead of claiming a partial optimum',()=>{
  const squad=legalSquad();
  const pool=squad.map(x=>x.p).concat([player(401,2,10,50,10),player(402,2,11,50,9)]);
  const result=optimiseTransfers({squad,players:pool,bank:0,freeTransfers:1,startGW:1,horizon:1,scorePlayer:score,maxEvaluations:0});
  assert.equal(result.status,'search-incomplete');
  assert.equal(result.plans.length,1);
  assert.equal(result.plans[0].transferCount,0);
});
