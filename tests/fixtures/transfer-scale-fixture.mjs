const POSITION_QUOTAS={1:2,2:5,3:5,4:3};

function player(id,pos,team,cost,scores,status='a'){
  return {id,element_type:pos,team,now_cost:cost,web_name:`P${id}`,status,scores};
}

function squadPlayer(id,pos,team,index,horizon){
  const base=3.15+pos*0.08+(index%3)*0.04;
  return player(id,pos,team,58+((index*5+pos*3)%24),Array.from({length:horizon},(_,gw)=>
    +(base+((index+gw*2+pos)%5)*0.025).toFixed(6)));
}

function candidatePlayer(id,pos,index,horizon,{tieHeavy=false}={}){
  const team=1+((index*7+pos*3)%20);
  const tier=Math.floor(index/12);
  const base=tieHeavy
    ? 5.15-Math.min(7,tier)*0.18
    : 2.35+pos*0.07+Math.max(0,3.8-index*0.055);
  const cost=tieHeavy?52+(tier%4)*3:40+((index*11+pos*13)%51);
  const scores=Array.from({length:horizon},(_,gw)=>{
    const shape=tieHeavy?((gw+pos)%2)*0.04:((index*5+gw*7+pos*3)%13)*0.021;
    return +(base+shape).toFixed(6);
  });
  return player(id,pos,team,cost,scores,index%47===0?'d':'a');
}

export function buildTransferScaleCase({counts={1:32,2:96,3:112,4:48},tieHeavy=false,horizon=6,maxEvaluations=2000000}={}){
  const squad=[]; let id=1,team=1;
  for(const [rawPos,quota] of Object.entries(POSITION_QUOTAS)){
    const pos=Number(rawPos);
    for(let index=0;index<quota;index++){
      const p=squadPlayer(id++,pos,team++,index,horizon);
      squad.push({p,bought:p.now_cost});
    }
  }
  const players=squad.map(entry=>entry.p); let candidateId=1000;
  for(const pos of [1,2,3,4]) for(let index=0;index<(counts[pos]||0);index++)
    players.push(candidatePlayer(candidateId++,pos,index,horizon,{tieHeavy}));
  return {squad,players,bank:30,freeTransfers:1,startGW:1,horizon,maxTransfers:3,maxResults:8,maxEvaluations,
    scorePlayer:(p,gw)=>p.scores[gw-1]};
}

export function transferResultSummary(result){
  return {status:result.status,pricingMode:result.pricingMode,plans:(result.plans||[]).map(plan=>({
    signature:plan.signature,transferCount:plan.transferCount,netGain:plan.netGain,
    grossBestXIPoints:plan.grossBestXIPoints,hitCost:plan.hitCost,bankAfter:plan.bankAfter,
    freeTransfersNextGW:plan.freeTransfersNextGW,perGameweekBestXI:plan.perGameweekBestXI
  }))};
}
