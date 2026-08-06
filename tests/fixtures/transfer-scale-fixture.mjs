const POSITION_QUOTAS={1:2,2:5,3:5,4:3};

// Deterministic value source. No randomness enters the fixture from the environment.
function deterministic(seed){
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

/* -----------------------------------------------------------------------------
   Official-scale reference pool.

   This reproduces the shape of the physical iPhone Safari failure: a full
   twenty-club Official FPL universe of roughly seven hundred players, a complete
   but uneven owned squad carrying genuine bench fodder, an empty bank, one free
   transfer and the default six-Gameweek horizon. Cheap enablers, doubtful players
   and unavailable players are all present and are never filtered out.
   ----------------------------------------------------------------------------- */
const OFFICIAL_SCALE_SQUAD_PER_POSITION={1:3,2:11,3:15,4:6};

export function buildOfficialScalePool({seed=7,horizon=6,teams=20,unavailableRate=0.08}={}){
  const next=deterministic(seed),players=[],strength=[];
  let id=1;
  for(let index=0;index<teams;index++) strength.push(0.6+next()*0.8);
  for(let team=1;team<=teams;team++) for(const pos of [1,2,3,4]){
    const depth=OFFICIAL_SCALE_SQUAD_PER_POSITION[pos],starters=pos===1?1:pos===2?4:pos===3?4:2;
    for(let index=0;index<depth;index++){
      const quality=Math.max(0,(1-index/depth)**1.7)*strength[team-1];
      const priceFloor={1:40,2:40,3:44,4:44}[pos],priceRange={1:15,2:35,3:100,4:105}[pos];
      const price=Math.max(38,Math.round(priceFloor+priceRange*quality*(0.55+next()*0.55)));
      const share=index<starters?0.75+next()*0.25:Math.max(0,next()*0.45);
      const perGameweek=(0.9+quality*7.2)*share;
      const scores=Array.from({length:horizon},()=>+Math.max(0,perGameweek*(0.75+next()*0.5)).toFixed(4));
      const roll=next();
      const status=roll<unavailableRate?'i':roll<unavailableRate+0.05?'d':'a';
      players.push(player(id++,pos,team,price,scores,status));
    }
  }
  return players;
}

export function buildOfficialScaleCase({seed=7,horizon=6,bank=0,freeTransfers=1,maxResults=8,
  maxTransfers=3,maxEvaluations=2000000}={}){
  const players=buildOfficialScalePool({seed,horizon});
  const budget=1000-bank,byPosition={1:[],2:[],3:[],4:[]};
  for(const p of players) if(p.status==='a') byPosition[p.element_type].push(p);
  const horizonScore=p=>p.scores.reduce((sum,value)=>sum+value,0);
  for(const pos of [1,2,3,4]) byPosition[pos].sort((a,b)=>
    (horizonScore(b)/b.now_cost)-(horizonScore(a)/a.now_cost)||a.id-b.id);
  const squad=[],clubs={};
  let spend=0;
  for(const pos of [1,2,3,4]){
    let taken=0;
    for(const p of byPosition[pos]){
      if(taken>=POSITION_QUOTAS[pos]) break;
      if((clubs[p.team]||0)>=3) continue;
      clubs[p.team]=(clubs[p.team]||0)+1; taken++; spend+=p.now_cost;
      squad.push({p,bought:p.now_cost});
    }
  }
  // Bring the squad inside the 100.0m budget by downgrading its dearest players,
  // which is what leaves a real manager holding cheap bench fodder.
  const cheapest={1:[],2:[],3:[],4:[]};
  for(const pos of [1,2,3,4]) cheapest[pos]=byPosition[pos].slice().sort((a,b)=>a.now_cost-b.now_cost||a.id-b.id);
  for(let guard=0;spend>budget&&guard<200;guard++){
    squad.sort((a,b)=>b.p.now_cost-a.p.now_cost||a.p.id-b.p.id);
    const owned=new Set(squad.map(entry=>entry.p.id));
    let replaced=false;
    for(const entry of squad){
      for(const option of cheapest[entry.p.element_type]){
        if(owned.has(option.id)||option.now_cost>=entry.p.now_cost) continue;
        if(option.team!==entry.p.team&&(clubs[option.team]||0)>=3) continue;
        spend+=option.now_cost-entry.p.now_cost;
        clubs[entry.p.team]--; clubs[option.team]=(clubs[option.team]||0)+1;
        entry.p=option; entry.bought=option.now_cost; replaced=true; break;
      }
      if(replaced) break;
    }
    if(!replaced) break;
  }
  squad.sort((a,b)=>a.p.element_type-b.p.element_type||a.p.id-b.p.id);
  return {squad,players,bank,freeTransfers,startGW:1,horizon,maxTransfers,maxResults,maxEvaluations,
    scorePlayer:(p,gw)=>p.scores[gw-1]};
}

export function transferResultSummary(result){
  return {status:result.status,pricingMode:result.pricingMode,plans:(result.plans||[]).map(plan=>({
    signature:plan.signature,transferCount:plan.transferCount,netGain:plan.netGain,
    grossBestXIPoints:plan.grossBestXIPoints,hitCost:plan.hitCost,bankAfter:plan.bankAfter,
    freeTransfersNextGW:plan.freeTransfersNextGW,perGameweekBestXI:plan.perGameweekBestXI
  }))};
}
