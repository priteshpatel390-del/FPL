import { TRANSFER_RULES } from '../config.mjs';

const POSITION_QUOTAS = TRANSFER_RULES.positionQuotas;
const UNAVAILABLE = new Set(TRANSFER_RULES.unavailableStatuses);
// Reporting cadence only. It never changes which plans are evaluated, retained or ranked.
const TRANSFER_PROGRESS_INTERVAL = 20000;

function playerOf(entry){ return entry?.p || entry; }
function playerId(entry){ return Number(playerOf(entry)?.id); }
function positionOf(entry){ return Number(playerOf(entry)?.element_type); }
function hasKnownPurchasePrice(entry){
  const raw = entry?.bought ?? entry?.purchasePrice;
  return raw !== null && raw !== undefined && Number.isFinite(Number(raw));
}

function transferSellPrice(entry){
  const now = Number(entry?.p?.now_cost ?? entry?.now_cost);
  if(!Number.isFinite(now)) return 0;
  const bought = hasKnownPurchasePrice(entry) ? Number(entry?.bought ?? entry?.purchasePrice) : now;
  if(now <= bought) return now;
  return bought + Math.floor((now - bought) / 2);
}

function nextFreeTransfers(freeTransfers, transferCount){
  const ft = Math.max(0, Math.min(TRANSFER_RULES.maxFreeTransfers, Math.trunc(Number(freeTransfers) || 0)));
  const n = Math.max(0, Math.trunc(Number(transferCount) || 0));
  return Math.min(TRANSFER_RULES.maxFreeTransfers, Math.max(0, ft - n) + 1);
}

function transferHit(freeTransfers, transferCount){
  const ft = Math.max(0, Math.min(TRANSFER_RULES.maxFreeTransfers, Math.trunc(Number(freeTransfers) || 0)));
  const n = Math.max(0, Math.trunc(Number(transferCount) || 0));
  const paidTransfers = Math.max(0, n - ft);
  return { paidTransfers, hitCost: paidTransfers * TRANSFER_RULES.pointsPerPaidTransfer };
}

function combinations(items, size, start=0, chosen=[], out=[]){
  if(chosen.length === size){ out.push(chosen.slice()); return out; }
  for(let i=start; i<=items.length-(size-chosen.length); i++){
    chosen.push(items[i]); combinations(items,size,i+1,chosen,out); chosen.pop();
  }
  return out;
}

function validateSquad(squad, {allowInheritedOverQuota=true}={}){
  const issues=[];
  if(!Array.isArray(squad) || squad.length !== 15) issues.push('squad_size');
  const players = Array.isArray(squad) ? squad.map(playerOf).filter(Boolean) : [];
  const ids = players.map(p=>Number(p.id));
  if(new Set(ids).size !== ids.length) issues.push('duplicate_player');
  if(players.some(p=>!Number.isFinite(Number(p.id)) || !POSITION_QUOTAS[Number(p.element_type)] || !Number.isFinite(Number(p.team)))) issues.push('unknown_player');
  const pos={1:0,2:0,3:0,4:0}, clubs={};
  players.forEach(p=>{ pos[p.element_type]=(pos[p.element_type]||0)+1; clubs[p.team]=(clubs[p.team]||0)+1; });
  Object.entries(POSITION_QUOTAS).forEach(([k,v])=>{ if(pos[k]!==v) issues.push(`position_${k}`); });
  if(!allowInheritedOverQuota && Object.values(clubs).some(n=>n>TRANSFER_RULES.maxPerClub)) issues.push('club_quota');
  return {ok:issues.length===0, issues:[...new Set(issues)], positionCounts:pos, clubCounts:clubs};
}

function bestXIFromPositionRows(byPos){
  let best=null;
  for(let d=3;d<=5;d++) for(let m=2;m<=5;m++){
    const f=10-d-m; if(f<1||f>3) continue;
    if(byPos[1].length<1||byPos[2].length<d||byPos[3].length<m||byPos[4].length<f) continue;
    const selected=[byPos[1][0],...byPos[2].slice(0,d),...byPos[3].slice(0,m),...byPos[4].slice(0,f)];
    const total=selected.reduce((a,x)=>a+x.score,0);
    const signature=`${d}-${m}-${f}|${selected.map(x=>x.p.id).sort((a,b)=>a-b).join(',')}`;
    if(!best || total>best.total || (total===best.total && signature<best.signature))
      best={total,formation:`${d}-${m}-${f}`,playerIds:selected.map(x=>Number(x.p.id)),signature};
  }
  return best || {total:0,formation:'—',playerIds:[],signature:''};
}

function bestXIForGW(squad, gw, scorePlayer){
  const byPos={1:[],2:[],3:[],4:[]};
  squad.forEach(entry=>{
    const p=playerOf(entry), raw=Number(scorePlayer(p,gw));
    byPos[p.element_type].push({entry,p,score:Number.isFinite(raw)?raw:0});
  });
  Object.values(byPos).forEach(arr=>arr.sort((a,b)=>b.score-a.score || Number(a.p.id)-Number(b.p.id)));
  return bestXIFromPositionRows(byPos);
}

function scoreSquadAcrossHorizon(squad,startGW,horizon,scorePlayer){
  const perGameweek=[]; let total=0;
  for(let gw=startGW;gw<startGW+horizon;gw++){
    const xi=bestXIForGW(squad,gw,scorePlayer); total+=xi.total; perGameweek.push({gw,...xi});
  }
  return {total,perGameweek};
}

function canonicalTransfers(transfers){
  return transfers.slice().sort((a,b)=>a.position-b.position||a.outPlayerId-b.outPlayerId||a.inPlayerId-b.inPlayerId);
}
function planSignature(transfers){ return canonicalTransfers(transfers).map(t=>`${t.outPlayerId}>${t.inPlayerId}`).join('|'); }

function comparePlans(a,b){
  return b.netGain-a.netGain || b.grossBestXIPoints-a.grossBestXIPoints || a.hitCost-b.hitCost ||
    a.transferCount-b.transferCount || b.freeTransfersNextGW-a.freeTransfersNextGW || b.bankAfter-a.bankAfter ||
    a.doubtfulIncoming-b.doubtfulIncoming || a.signature.localeCompare(b.signature);
}

function inheritedClubLegal(startCounts, finalCounts, transferCount){
  for(const [club,count] of Object.entries(finalCounts)){
    const start=startCounts[club]||0;
    if(start<=TRANSFER_RULES.maxPerClub && count>TRANSFER_RULES.maxPerClub) return false;
    if(start>TRANSFER_RULES.maxPerClub && count>start) return false;
  }
  const startExcess=Object.values(startCounts).reduce((a,n)=>a+Math.max(0,n-TRANSFER_RULES.maxPerClub),0);
  const finalExcess=Object.values(finalCounts).reduce((a,n)=>a+Math.max(0,n-TRANSFER_RULES.maxPerClub),0);
  return finalExcess <= Math.max(0,startExcess-transferCount);
}

function buildBaseline({squad,bank,freeTransfers,startGW,horizon,scorePlayer}){
  const baselineScore=scoreSquadAcrossHorizon(squad,startGW,horizon,scorePlayer);
  return {transferCount:0,transfers:[],finalSquadIds:squad.map(playerId).sort((a,b)=>a-b),bankBefore:bank,bankAfter:bank,
    freeTransfersBefore:freeTransfers,paidTransfers:0,hitCost:0,freeTransfersNextGW:nextFreeTransfers(freeTransfers,0),grossBestXIPoints:baselineScore.total,
    grossGain:0,rollDifference:0,netGain:0,perGameweekBestXI:baselineScore.perGameweek,doubtfulIncoming:0,signature:'',warnings:[],pricingMode:'exact'};
}

function buildPlan({startSquad,outgoing,incoming,bank,freeTransfers,startGW,horizon,scorePlayer,baseline,startCounts,pricingMode}){
  const outIds=new Set(outgoing.map(playerId));
  const finalSquad=startSquad.filter(e=>!outIds.has(playerId(e))).concat(incoming.map(p=>({p,bought:p.now_cost})));
  const legality=validateSquad(finalSquad,{allowInheritedOverQuota:true});
  if(!legality.ok || !inheritedClubLegal(startCounts,legality.clubCounts,outgoing.length)) return null;
  const sellTotal=outgoing.reduce((a,e)=>a+transferSellPrice(e),0);
  const buyTotal=incoming.reduce((a,p)=>a+Number(p.now_cost||0),0);
  const bankAfter=bank+sellTotal-buyTotal;
  if(bankAfter<0) return null;
  const hit=transferHit(freeTransfers,outgoing.length);
  const score=scoreSquadAcrossHorizon(finalSquad,startGW,horizon,scorePlayer);
  const nextFT=nextFreeTransfers(freeTransfers,outgoing.length);
  const rollDifference=nextFT-baseline.freeTransfersNextGW;
  const grossGain=score.total-baseline.grossBestXIPoints;
  const netGain=grossGain-hit.hitCost+TRANSFER_RULES.rollValue*rollDifference;
  const transfers=canonicalTransfers(outgoing.map((out,i)=>({outPlayerId:playerId(out),inPlayerId:Number(incoming[i].id),position:positionOf(out),sellPrice:transferSellPrice(out),buyPrice:Number(incoming[i].now_cost)})));
  return {transferCount:outgoing.length,transfers,finalSquadIds:finalSquad.map(playerId).sort((a,b)=>a-b),bankBefore:bank,bankAfter,
    freeTransfersBefore:freeTransfers,paidTransfers:hit.paidTransfers,hitCost:hit.hitCost,freeTransfersNextGW:nextFT,
    grossBestXIPoints:score.total,grossGain,rollDifference,netGain,perGameweekBestXI:score.perGameweek,
    doubtfulIncoming:incoming.filter(p=>p.status==='d').length,signature:planSignature(transfers),pricingMode,
    warnings:incoming.filter(p=>p.status==='d').map(p=>`${p.web_name||p.id} doubtful (${p.chance_of_playing_next_round??'?'}%)`)};
}

// Bounded top-K retention. comparePlans() is a total order — its final tiebreak is the
// plan signature, signatures are unique per transfer set and contain only ASCII digits,
// '>' and '|', so two distinct plans never compare equal.
function retainPlan(plans,plan,limit){
  if(plans.length>=limit && comparePlans(plan,plans[plans.length-1])>0) return plans;
  plans.push(plan);
  plans.sort(comparePlans);
  if(plans.length>limit) plans.length=limit;
  return plans;
}

function normaliseSearch(args){
  const {squad,players,bank=0,freeTransfers=1,startGW=1,horizon=6,maxTransfers=TRANSFER_RULES.maxTransfers,
    maxResults=20,maxEvaluations=TRANSFER_RULES.maxEvaluations,scorePlayer,
    onProgress,progressInterval=TRANSFER_PROGRESS_INTERVAL}=args;
  const legality=validateSquad(squad,{allowInheritedOverQuota:true});
  if(!legality.ok) return {error:{status:'invalid-input',issues:legality.issues,plans:[],evaluations:0}};
  if(typeof scorePlayer!=='function') return {error:{status:'projection-unavailable',issues:['score_player_missing'],plans:[],evaluations:0}};
  const cleanBank=Math.max(0,Math.trunc(Number(bank)||0));
  const cleanFT=Math.max(0,Math.min(TRANSFER_RULES.maxFreeTransfers,Math.trunc(Number(freeTransfers)||0)));
  const cleanHorizon=Math.max(1,Math.min(TRANSFER_RULES.maxHorizon,Math.trunc(Number(horizon)||1)));
  const cleanLimit=Math.min(TRANSFER_RULES.maxTransfers,Math.max(0,Math.trunc(Number(maxTransfers)||0)));
  const cleanMaxResults=Math.max(1,Math.trunc(Number(maxResults)||1));
  const cleanMaxEvaluations=Math.max(0,Math.trunc(Number(maxEvaluations)||0));
  const owned=new Set(squad.map(playerId));
  const eligible=(players||[]).filter(p=>p&&!owned.has(Number(p.id))&&POSITION_QUOTAS[p.element_type]&&!UNAVAILABLE.has(p.status)).sort((a,b)=>Number(a.id)-Number(b.id));
  const pricingMode=squad.every(hasKnownPurchasePrice)?'exact':'estimated';
  const baseline=buildBaseline({squad,bank:cleanBank,freeTransfers:cleanFT,startGW,horizon:cleanHorizon,scorePlayer});
  baseline.pricingMode=pricingMode;
  return {squad,eligible,bank:cleanBank,freeTransfers:cleanFT,startGW,horizon:cleanHorizon,limit:cleanLimit,maxResults:cleanMaxResults,
    maxEvaluations:cleanMaxEvaluations,scorePlayer,baseline,startCounts:legality.clubCounts,pricingMode,
    onProgress:typeof onProgress==='function'?onProgress:null,
    progressInterval:Math.max(1,Math.trunc(Number(progressInterval)||TRANSFER_PROGRESS_INTERVAL))};
}

function completeResult(ctx,plans,evaluations,pruned=0,incomplete=false,profile=null){
  plans.sort(comparePlans);
  const base={evaluations,pruned,baseline:ctx.baseline,pricingMode:ctx.pricingMode};
  if(profile) base.profile=Object.freeze({...profile});
  if(incomplete) return {status:'search-incomplete',issues:['evaluation_limit'],plans:[ctx.baseline],...base};
  return {status:'ok',issues:[],plans:plans.slice(0,ctx.maxResults),...base};
}

function exhaustiveTransferSearch(args){
  const ctx=normaliseSearch(args); if(ctx.error) return ctx.error;
  const plans=[ctx.baseline]; let evaluations=0, incomplete=false;
  outer: for(let n=1;n<=ctx.limit;n++){
    for(const outgoing of combinations(ctx.squad,n)){
      const required=outgoing.map(positionOf).sort((a,b)=>a-b);
      const candidates=ctx.eligible.filter(p=>required.includes(Number(p.element_type)));
      for(const incoming of combinations(candidates,n)){
        if(++evaluations>ctx.maxEvaluations){ incomplete=true; break outer; }
        const incomingPos=incoming.map(p=>Number(p.element_type)).sort((a,b)=>a-b);
        if(incomingPos.some((v,i)=>v!==required[i])) continue;
        const ordered=[], used=new Set();
        for(const out of outgoing){
          const idx=incoming.findIndex((p,i)=>!used.has(i)&&Number(p.element_type)===positionOf(out));
          if(idx<0) break; used.add(idx); ordered.push(incoming[idx]);
        }
        if(ordered.length!==n) continue;
        const plan=buildPlan({startSquad:ctx.squad,outgoing,incoming:ordered,bank:ctx.bank,freeTransfers:ctx.freeTransfers,startGW:ctx.startGW,
          horizon:ctx.horizon,scorePlayer:ctx.scorePlayer,baseline:ctx.baseline,startCounts:ctx.startCounts,pricingMode:ctx.pricingMode});
        if(plan) plans.push(plan);
      }
    }
  }
  return completeResult(ctx,plans,evaluations,0,incomplete);
}

function prepareScoreRows(ctx){
  const rows=new Map(), all=[], seen=new Set();
  for(const entry of ctx.squad){ const p=playerOf(entry),id=Number(p.id); if(!seen.has(id)){seen.add(id);all.push(p);} }
  for(const p of ctx.eligible){ const id=Number(p.id); if(!seen.has(id)){seen.add(id);all.push(p);} }
  for(const p of all){
    const values=[];
    for(let offset=0;offset<ctx.horizon;offset++){
      const raw=Number(ctx.scorePlayer(p,ctx.startGW+offset));
      values.push(Number.isFinite(raw)?raw:0);
    }
    rows.set(Number(p.id),values);
  }
  return rows;
}
function horizonScore(scoreRows,p){ return (scoreRows.get(Number(p.id))||[]).reduce((sum,value)=>sum+value,0); }

function buildCoreByGameweek(core,scoreRows,horizon){
  const games=[];
  for(let offset=0;offset<horizon;offset++){
    const byPos={1:[],2:[],3:[],4:[]};
    for(const entry of core){
      const p=playerOf(entry),score=Number(scoreRows.get(Number(p.id))?.[offset])||0;
      byPos[p.element_type].push({entry,p,score});
    }
    Object.values(byPos).forEach(rows=>rows.sort((a,b)=>b.score-a.score||Number(a.p.id)-Number(b.p.id)));
    games.push(byPos);
  }
  return games;
}

function scoreCoreWithIncoming(coreByGameweek,incoming,scoreRows,startGW,horizon){
  const perGameweek=[]; let total=0;
  for(let offset=0;offset<horizon;offset++){
    const base=coreByGameweek[offset];
    const byPos={1:base[1].slice(),2:base[2].slice(),3:base[3].slice(),4:base[4].slice()};
    for(const p of incoming){
      const score=Number(scoreRows.get(Number(p.id))?.[offset])||0;
      byPos[p.element_type].push({entry:p,p,score});
    }
    Object.values(byPos).forEach(rows=>rows.sort((a,b)=>b.score-a.score||Number(a.p.id)-Number(b.p.id)));
    const xi=bestXIFromPositionRows(byPos);
    total+=xi.total; perGameweek.push({gw:startGW+offset,...xi});
  }
  return {total,perGameweek};
}

function candidateScoreOrders(byPosition,scoreRows,horizon){
  const result={1:[],2:[],3:[],4:[]};
  for(const pos of [1,2,3,4]) for(let offset=0;offset<horizon;offset++)
    result[pos][offset]=byPosition[pos].slice().sort((a,b)=>
      (Number(scoreRows.get(Number(b.id))?.[offset])||0)-(Number(scoreRows.get(Number(a.id))?.[offset])||0)||Number(a.id)-Number(b.id));
  return result;
}

// Admissible upper bound: budget, shared club capacity and cross-Gameweek player identity
// are relaxed only in the optimistic direction, so no real descendant can score higher.
function optimisticSquadUpperBound(coreByGameweek,chosen,remainingNeed,candidatesByScore,scoreRows,horizon,maxCandidateCost=Infinity,clubCounts=null,startCounts=null){
  const chosenIds=new Set(chosen.map(p=>Number(p.id)));
  let total=0;
  for(let offset=0;offset<horizon;offset++){
    const base=coreByGameweek[offset];
    const byPos={1:base[1].slice(),2:base[2].slice(),3:base[3].slice(),4:base[4].slice()};
    for(const p of chosen){
      const score=Number(scoreRows.get(Number(p.id))?.[offset])||0;
      byPos[p.element_type].push({entry:p,p,score});
    }
    for(const pos of [1,2,3,4]){
      let left=Number(remainingNeed[pos])||0;
      if(!left) continue;
      for(const p of candidatesByScore[pos][offset]){
        if(chosenIds.has(Number(p.id))) continue;
        if(Number(p.now_cost||0)>maxCandidateCost) continue;
        if(clubCounts){
          const club=String(p.team),allowed=Math.max(TRANSFER_RULES.maxPerClub,startCounts?.[club]||0);
          if((clubCounts[club]||0)>=allowed) continue;
        }
        const score=Number(scoreRows.get(Number(p.id))?.[offset])||0;
        byPos[pos].push({entry:p,p,score});
        if(--left===0) break;
      }
      if(left>0) return -Infinity;
    }
    Object.values(byPos).forEach(rows=>rows.sort((a,b)=>b.score-a.score||Number(a.p.id)-Number(b.p.id)));
    total+=bestXIFromPositionRows(byPos).total;
  }
  return total;
}

function boundCannotBeat(upperGross,ctx,transferCount,kth){
  if(!kth||!Number.isFinite(upperGross)) return upperGross===-Infinity;
  const hit=transferHit(ctx.freeTransfers,transferCount);
  const nextFT=nextFreeTransfers(ctx.freeTransfers,transferCount);
  const rollDifference=nextFT-ctx.baseline.freeTransfersNextGW;
  const upperNet=upperGross-ctx.baseline.grossBestXIPoints-hit.hitCost+TRANSFER_RULES.rollValue*rollDifference;
  const epsilon=1e-9;
  if(upperNet<kth.netGain-epsilon) return true;
  if(upperNet>kth.netGain+epsilon) return false;
  return upperGross<kth.grossBestXIPoints-epsilon;
}

function cheapestAvailableCost(poolByCost,count,usedIds){
  if(count<=0) return 0;
  let total=0,found=0;
  for(const p of poolByCost){
    if(usedIds.has(Number(p.id))) continue;
    total+=Number(p.now_cost||0);
    if(++found===count) return total;
  }
  return Infinity;
}

function orderedIncomingForOutgoing(outgoing,chosen){
  const byPos={1:[],2:[],3:[],4:[]};
  chosen.forEach(p=>byPos[positionOf(p)].push(p));
  Object.values(byPos).forEach(rows=>rows.sort((a,b)=>Number(a.id)-Number(b.id)));
  const used={1:0,2:0,3:0,4:0};
  return outgoing.map(out=>byPos[positionOf(out)][used[positionOf(out)]++]);
}

function buildPreparedPlan({ctx,outgoing,incoming,core,coreByGameweek,scoreRows,bankAfter,clubCounts,preparedScore=null}){
  if(!inheritedClubLegal(ctx.startCounts,clubCounts,outgoing.length)) return null;
  const hit=transferHit(ctx.freeTransfers,outgoing.length);
  const score=preparedScore||scoreCoreWithIncoming(coreByGameweek,incoming,scoreRows,ctx.startGW,ctx.horizon);
  const nextFT=nextFreeTransfers(ctx.freeTransfers,outgoing.length);
  const rollDifference=nextFT-ctx.baseline.freeTransfersNextGW;
  const grossGain=score.total-ctx.baseline.grossBestXIPoints;
  const netGain=grossGain-hit.hitCost+TRANSFER_RULES.rollValue*rollDifference;
  const transfers=canonicalTransfers(outgoing.map((out,i)=>({outPlayerId:playerId(out),inPlayerId:Number(incoming[i].id),position:positionOf(out),sellPrice:transferSellPrice(out),buyPrice:Number(incoming[i].now_cost)})));
  return {transferCount:outgoing.length,transfers,finalSquadIds:core.map(playerId).concat(incoming.map(p=>Number(p.id))).sort((a,b)=>a-b),
    bankBefore:ctx.bank,bankAfter,freeTransfersBefore:ctx.freeTransfers,paidTransfers:hit.paidTransfers,hitCost:hit.hitCost,
    freeTransfersNextGW:nextFT,grossBestXIPoints:score.total,grossGain,rollDifference,netGain,perGameweekBestXI:score.perGameweek,
    doubtfulIncoming:incoming.filter(p=>p.status==='d').length,signature:planSignature(transfers),pricingMode:ctx.pricingMode,
    warnings:incoming.filter(p=>p.status==='d').map(p=>`${p.web_name||p.id} doubtful (${p.chance_of_playing_next_round??'?'}%)`)};
}

function bestXITotalFromScores(byPos){
  const prefix={1:[0],2:[0],3:[0],4:[0]};
  for(const pos of [1,2,3,4]){
    byPos[pos].sort((a,b)=>b-a);
    for(const value of byPos[pos]) prefix[pos].push(prefix[pos][prefix[pos].length-1]+value);
  }
  let best=-Infinity;
  for(let d=3;d<=5;d++) for(let m=2;m<=5;m++){
    const f=10-d-m; if(f<1||f>3) continue;
    if(byPos[1].length<1||byPos[2].length<d||byPos[3].length<m||byPos[4].length<f) continue;
    const total=prefix[1][1]+prefix[2][d]+prefix[3][m]+prefix[4][f];
    if(total>best) best=total;
  }
  return Number.isFinite(best)?best:0;
}

function scoreCoreTotalWithIncoming(coreByGameweek,incoming,scoreRows,horizon){
  let total=0;
  for(let offset=0;offset<horizon;offset++){
    const base=coreByGameweek[offset];
    const byPos={
      1:base[1].map(row=>row.score),2:base[2].map(row=>row.score),
      3:base[3].map(row=>row.score),4:base[4].map(row=>row.score)
    };
    for(const p of incoming) byPos[p.element_type].push(Number(scoreRows.get(Number(p.id))?.[offset])||0);
    total+=bestXITotalFromScores(byPos);
  }
  return total;
}

function lightweightPreparedPlan(ctx,outgoing,incoming,grossBestXIPoints,bankAfter){
  const hit=transferHit(ctx.freeTransfers,outgoing.length);
  const nextFT=nextFreeTransfers(ctx.freeTransfers,outgoing.length);
  const rollDifference=nextFT-ctx.baseline.freeTransfersNextGW;
  const grossGain=grossBestXIPoints-ctx.baseline.grossBestXIPoints;
  const transfers=canonicalTransfers(outgoing.map((out,i)=>({
    outPlayerId:playerId(out),inPlayerId:Number(incoming[i].id),position:positionOf(out),
    sellPrice:transferSellPrice(out),buyPrice:Number(incoming[i].now_cost)
  })));
  return {netGain:grossGain-hit.hitCost+TRANSFER_RULES.rollValue*rollDifference,grossBestXIPoints,
    hitCost:hit.hitCost,transferCount:outgoing.length,freeTransfersNextGW:nextFT,bankAfter,
    doubtfulIncoming:incoming.filter(p=>p.status==='d').length,signature:planSignature(transfers)};
}


function lightweightCannotEnter(plan,kth){
  const epsilon=1e-9;
  if(plan.netGain<kth.netGain-epsilon) return true;
  if(plan.netGain>kth.netGain+epsilon) return false;
  if(plan.grossBestXIPoints<kth.grossBestXIPoints-epsilon) return true;
  if(plan.grossBestXIPoints>kth.grossBestXIPoints+epsilon) return false;
  return comparePlans({...plan,netGain:kth.netGain,grossBestXIPoints:kth.grossBestXIPoints},kth)>0;
}

function optimiseTransfers(args){
  const ctx=normaliseSearch(args); if(ctx.error) return ctx.error;
  const plans=[ctx.baseline]; let evaluations=0, pruned=0, incomplete=false;
  const profile={outgoingBranches:0,boundPruned:0,affordabilityPruned:0,clubPruned:0,leafEvaluations:0,materialisedPlans:0};
  const scoreRows=prepareScoreRows(ctx);
  const byPosition={1:[],2:[],3:[],4:[]};
  ctx.eligible.forEach(p=>byPosition[p.element_type].push(p));
  const byPositionCost={1:[],2:[],3:[],4:[]};
  for(const pos of [1,2,3,4]){
    byPosition[pos].sort((a,b)=>horizonScore(scoreRows,b)-horizonScore(scoreRows,a)||Number(a.now_cost||0)-Number(b.now_cost||0)||Number(a.id)-Number(b.id));
    byPositionCost[pos]=byPosition[pos].slice().sort((a,b)=>Number(a.now_cost||0)-Number(b.now_cost||0)||Number(a.id)-Number(b.id));
  }
  const candidatesByScore=candidateScoreOrders(byPosition,scoreRows,ctx.horizon);

  outer: for(let n=1;n<=ctx.limit;n++){
    ctx.onProgress?.({depth:n,maxDepth:ctx.limit,evaluations});
    const outgoingSets=combinations(ctx.squad,n).sort((a,b)=>{
      const aScore=a.reduce((sum,e)=>sum+horizonScore(scoreRows,playerOf(e)),0);
      const bScore=b.reduce((sum,e)=>sum+horizonScore(scoreRows,playerOf(e)),0);
      if(aScore!==bScore) return aScore-bScore;
      return a.map(playerId).sort((x,y)=>x-y).join(',').localeCompare(b.map(playerId).sort((x,y)=>x-y).join(','));
    });
    for(const outgoing of outgoingSets){
      profile.outgoingBranches++;
      const required=outgoing.map(positionOf).sort((a,b)=>a-b);
      const need={1:0,2:0,3:0,4:0}; required.forEach(pos=>need[pos]++);
      if(Object.entries(need).some(([pos,count])=>byPosition[pos].length<count)){ pruned++; continue; }
      const sellTotal=outgoing.reduce((sum,e)=>sum+transferSellPrice(e),0);
      const minimumBuy=Object.entries(need).reduce((sum,[pos,count])=>sum+cheapestAvailableCost(byPositionCost[pos],count,new Set()),0);
      if(minimumBuy>ctx.bank+sellTotal){ pruned++; profile.affordabilityPruned++; continue; }
      const outIds=new Set(outgoing.map(playerId));
      const core=ctx.squad.filter(entry=>!outIds.has(playerId(entry)));
      const coreByGameweek=buildCoreByGameweek(core,scoreRows,ctx.horizon);
      const afterOut={...ctx.startCounts}; outgoing.forEach(e=>{ afterOut[playerOf(e).team]=(afterOut[playerOf(e).team]||0)-1; });
      const kth=plans.length>=ctx.maxResults?plans[plans.length-1]:null;
      if(kth){
        const upper=optimisticSquadUpperBound(coreByGameweek,[],need,candidatesByScore,scoreRows,ctx.horizon,
          ctx.bank+sellTotal,afterOut,ctx.startCounts);
        if(boundCannotBeat(upper,ctx,n,kth)){ pruned++; profile.boundPruned++; continue; }
      }

      const chosen=[],chosenPoolIndexes=[];
      function choose(index,cost,clubCounts){
        if(incomplete) return;
        if(index===required.length){
          if(++evaluations>ctx.maxEvaluations){ incomplete=true; return; }
          profile.leafEvaluations=evaluations;
          if(ctx.onProgress&&evaluations%ctx.progressInterval===0)
            ctx.onProgress({depth:n,maxDepth:ctx.limit,evaluations});
          if(!inheritedClubLegal(ctx.startCounts,clubCounts,n)) return;
          const incoming=orderedIncomingForOutgoing(outgoing,chosen);
          const bankAfter=ctx.bank+sellTotal-cost;
          const gross=scoreCoreTotalWithIncoming(coreByGameweek,incoming,scoreRows,ctx.horizon);
          const lightweight=lightweightPreparedPlan(ctx,outgoing,incoming,gross,bankAfter);
          if(plans.length>=ctx.maxResults&&lightweightCannotEnter(lightweight,plans[plans.length-1])) return;
          const plan=buildPreparedPlan({ctx,outgoing,incoming,core,coreByGameweek,scoreRows,bankAfter,clubCounts});
          if(plan){ profile.materialisedPlans++; retainPlan(plans,plan,ctx.maxResults); }
          return;
        }
        const pos=required[index],pool=byPosition[pos];
        const samePosition=index>0&&required[index-1]===pos;
        const startAt=samePosition?chosenPoolIndexes[index-1]+1:0;
        for(let poolIndex=startAt;poolIndex<pool.length;poolIndex++){
          const candidate=pool[poolIndex];
          const nextCost=cost+Number(candidate.now_cost||0);
          const usedIds=new Set(chosen.map(p=>Number(p.id)).concat(Number(candidate.id)));
          const remainingNeed={1:0,2:0,3:0,4:0}; required.slice(index+1).forEach(rpos=>remainingNeed[rpos]++);
          const cheapestRest=Object.entries(remainingNeed).reduce((sum,[rpos,count])=>sum+cheapestAvailableCost(byPositionCost[rpos],count,usedIds),0);
          if(nextCost+cheapestRest>ctx.bank+sellTotal){ pruned++; profile.affordabilityPruned++; continue; }
          const club=String(candidate.team),nextClubs={...clubCounts,[club]:(clubCounts[club]||0)+1};
          const allowed=Math.max(TRANSFER_RULES.maxPerClub,ctx.startCounts[club]||0);
          if(nextClubs[club]>allowed){ pruned++; profile.clubPruned++; continue; }
          chosen.push(candidate); chosenPoolIndexes.push(poolIndex);
          const nextKth=plans.length>=ctx.maxResults?plans[plans.length-1]:null;
          if(index===0&&required.length===3&&nextKth){
            const upper=optimisticSquadUpperBound(coreByGameweek,chosen,remainingNeed,candidatesByScore,scoreRows,ctx.horizon,
              ctx.bank+sellTotal-nextCost,nextClubs,ctx.startCounts);
            if(boundCannotBeat(upper,ctx,n,nextKth)){
              pruned++; profile.boundPruned++; chosen.pop(); chosenPoolIndexes.pop(); continue;
            }
          }
          choose(index+1,nextCost,nextClubs);
          chosen.pop(); chosenPoolIndexes.pop();
          if(incomplete) return;
        }
      }
      choose(0,0,afterOut);
      if(incomplete) break outer;
    }
  }
  return completeResult(ctx,plans,evaluations,pruned,incomplete,profile);
}

export { TRANSFER_PROGRESS_INTERVAL, hasKnownPurchasePrice, transferSellPrice, nextFreeTransfers, transferHit, validateSquad,
  bestXIForGW, scoreSquadAcrossHorizon, comparePlans, retainPlan, optimisticSquadUpperBound,
  optimiseTransfers, exhaustiveTransferSearch };
