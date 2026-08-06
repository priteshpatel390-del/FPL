import test from 'node:test';
import assert from 'node:assert/strict';
import { optimiseTransfers, exhaustiveTransferSearch } from '../src/model/transfers.mjs';

function rng(seed){
  let state=seed>>>0;
  return ()=>{
    state=(state+0x6D2B79F5)>>>0;
    let t=Math.imul(state^(state>>>15),1|state);
    t=(t+Math.imul(t^(t>>>7),61|t))^t;
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}
function player(id,pos,team,cost,scores,status='a'){
  return {id,element_type:pos,team,now_cost:cost,web_name:`P${id}`,status,scores};
}
function syntheticCase(seed){
  const next=rng(seed),pick=(min,max)=>min+Math.floor(next()*(max-min+1));
  const horizon=pick(1,4),squad=[];
  let id=1;
  for(const [pos,count] of [[1,2],[2,5],[3,5],[4,3]]){
    for(let i=0;i<count;i++){
      const p=player(id++,pos,pick(1,12),40+pick(0,60),Array.from({length:horizon},()=>+(next()*7).toFixed(4)));
      squad.push({p,bought:p.now_cost});
    }
  }
  const players=squad.map(entry=>entry.p);
  for(let i=0;i<pick(8,20);i++){
    const pos=pick(1,4);
    players.push(player(200+i,pos,pick(1,12),40+pick(0,70),Array.from({length:horizon},()=>+(next()*8).toFixed(4)),next()<0.1?'d':'a'));
  }
  return {squad,players,bank:pick(0,40),freeTransfers:pick(0,3),startGW:1,horizon,
    maxTransfers:pick(0,3),maxResults:pick(1,12),scorePlayer:(p,gw)=>p.scores[gw-1]};
}
const summary=result=>({status:result.status,pricingMode:result.pricingMode,plans:(result.plans||[]).map(plan=>({
  signature:plan.signature,transferCount:plan.transferCount,netGain:plan.netGain,grossBestXIPoints:plan.grossBestXIPoints,
  hitCost:plan.hitCost,bankAfter:plan.bankAfter,freeTransfersNextGW:plan.freeTransfersNextGW,
  perGameweekBestXI:plan.perGameweekBestXI
}))});

test('prepared exact search matches the independent exhaustive oracle across varied Gameweek score shapes',()=>{
  for(let seed=1;seed<=120;seed++){
    const args=syntheticCase(seed);
    assert.deepEqual(summary(optimiseTransfers(args)),summary(exhaustiveTransferSearch(args)),`seed ${seed}`);
  }
});

test('performance-only materialisation keeps complete-plan ordering exact while avoiding full detail for rejected plans',()=>{
  const args=syntheticCase(77);
  args.maxTransfers=3;
  args.maxResults=8;
  const result=optimiseTransfers(args);
  assert.equal(result.status,'ok');
  assert.ok(result.profile.leafEvaluations>0);
  assert.ok(result.profile.materialisedPlans>0);
  assert.ok(result.profile.materialisedPlans<=result.profile.leafEvaluations);
  assert.deepEqual(summary(result),summary(exhaustiveTransferSearch(args)));
});

test('exact search profiling is deterministic and does not alter the public plan contract',()=>{
  const args=syntheticCase(91);
  const first=optimiseTransfers(args);
  const second=optimiseTransfers(args);
  assert.deepEqual(first.profile,second.profile);
  assert.deepEqual(summary(first),summary(second));
  assert.equal(Object.prototype.hasOwnProperty.call(first.plans[0],'profile'),false);
});

test('evaluation ceiling remains a safety stop and never exposes a partial incumbent as optimal',()=>{
  const args={...syntheticCase(33),maxTransfers:3,maxEvaluations:0};
  const result=optimiseTransfers(args);
  assert.equal(result.status,'search-incomplete');
  assert.deepEqual(result.issues,['evaluation_limit']);
  assert.equal(result.plans.length,1);
  assert.equal(result.plans[0].transferCount,0);
});
