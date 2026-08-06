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

/* ---------------------------------------------------------------------------
   Exact position-pool machinery.

   Every legal transfer keeps the squad on its exact position quota, so for a
   fixed outgoing set the final pool at each position always holds exactly
   POSITION_QUOTAS[pos] players. A horizon best-XI total can therefore be read
   from per-Gameweek descending score prefix sums rather than rebuilding,
   re-sorting and re-scanning squad rows for every candidate.

   An incoming slot that is not yet filled is held as a zero placeholder. Zero
   is optimistic because a real incoming player may score below zero, so a
   padded pool never understates any descendant of the node.
   --------------------------------------------------------------------------- */
const FORMATIONS=Object.freeze([[3,4,3],[3,5,2],[4,3,3],[4,4,2],[4,5,1],[5,2,3],[5,3,2],[5,4,1]]);
// Largest starting count each position reaches across the legal formations.
const STARTER_LIMIT=Object.freeze({1:1,2:5,3:5,4:3});

function createPoolLevel(horizon){
  const level={count:{1:0,2:0,3:0,4:0},real:{},values:{},prefix:{}};
  for(const pos of [1,2,3,4]){
    const quota=POSITION_QUOTAS[pos];
    level.real[pos]=new Float64Array(horizon*quota);
    level.values[pos]=new Float64Array(horizon*quota);
    level.prefix[pos]=new Float64Array(horizon*(quota+1));
  }
  return level;
}

function sortDescInPlace(row,base,length){
  for(let k=1;k<length;k++){
    const value=row[base+k]; let j=k-1;
    while(j>=0&&row[base+j]<value){ row[base+j+1]=row[base+j]; j--; }
    row[base+j+1]=value;
  }
}

// Rebuilds the zero-padded pool and its descending prefix sums for one position.
function refreshPool(level,pos,horizon){
  const quota=POSITION_QUOTAS[pos],count=level.count[pos],
    real=level.real[pos],values=level.values[pos],prefix=level.prefix[pos];
  for(let offset=0;offset<horizon;offset++){
    const rowBase=offset*quota,prefixBase=offset*(quota+1);
    for(let k=0;k<quota;k++) values[rowBase+k]=k<count?real[rowBase+k]:0;
    sortDescInPlace(values,rowBase,quota);
    let sum=0; prefix[prefixBase]=0;
    for(let k=0;k<quota;k++){ sum+=values[rowBase+k]; prefix[prefixBase+k+1]=sum; }
  }
}

function seedPoolLevel(level,core,scoreRows,horizon){
  const rows={1:[],2:[],3:[],4:[]};
  for(const entry of core) rows[positionOf(entry)].push(scoreRows.get(playerId(entry)));
  for(const pos of [1,2,3,4]){
    const quota=POSITION_QUOTAS[pos],members=rows[pos],real=level.real[pos];
    level.count[pos]=members.length;
    for(let offset=0;offset<horizon;offset++){
      const rowBase=offset*quota;
      for(let k=0;k<members.length;k++) real[rowBase+k]=Number(members[k]?.[offset])||0;
      sortDescInPlace(real,rowBase,members.length);
    }
    refreshPool(level,pos,horizon);
  }
}

// Copies `from` into `to` with one further real member added at `pos`.
function extendPoolLevel(from,to,pos,scoreRow,horizon){
  for(const other of [1,2,3,4]){
    to.count[other]=from.count[other];
    to.real[other].set(from.real[other]);
    if(other!==pos){ to.values[other].set(from.values[other]); to.prefix[other].set(from.prefix[other]); }
  }
  const quota=POSITION_QUOTAS[pos],count=from.count[pos],real=to.real[pos];
  for(let offset=0;offset<horizon;offset++){
    const rowBase=offset*quota;
    real[rowBase+count]=Number(scoreRow?.[offset])||0;
    sortDescInPlace(real,rowBase,count+1);
  }
  to.count[pos]=count+1;
  refreshPool(to,pos,horizon);
}

function horizonTotalFromPrefixes(gkPrefix,defPrefix,midPrefix,fwdPrefix,horizon){
  let total=0;
  for(let offset=0;offset<horizon;offset++){
    const gk=gkPrefix[offset*3+1],defBase=offset*6,midBase=offset*6,fwdBase=offset*4;
    let best=-Infinity;
    for(let i=0;i<FORMATIONS.length;i++){
      const shape=FORMATIONS[i];
      const value=gk+defPrefix[defBase+shape[0]]+midPrefix[midBase+shape[1]]+fwdPrefix[fwdBase+shape[2]];
      if(value>best) best=value;
    }
    total+=best;
  }
  return total;
}

// Exact horizon best-XI total for a complete pool; an optimistic base while slots remain.
function poolHorizonTotal(level,horizon){
  return horizonTotalFromPrefixes(level.prefix[1],level.prefix[2],level.prefix[3],level.prefix[4],horizon);
}

// Admissible identity-preserving marginal of one candidate against a padded pool.
// Filling a placeholder with score s raises any top-k total by at most
// max(0, s - kth value of the padded pool), and the largest starting count gives
// the smallest such threshold, so one gain is valid for every legal formation and
// for every placeholder still outstanding at that position.
function poolPlayerGain(level,pos,scoreRow,horizon){
  const quota=POSITION_QUOTAS[pos],values=level.values[pos],index=STARTER_LIMIT[pos]-1;
  let total=0;
  for(let offset=0;offset<horizon;offset++){
    const delta=(Number(scoreRow?.[offset])||0)-values[offset*quota+index];
    if(delta>0) total+=delta;
  }
  return total;
}

/* Cost of moving an identity gain from the branch-level padded pool to the node's
   padded pool. max(0, s - b) <= max(0, s - a) + max(0, a - b) for every score, so
   adding this constant per outstanding slot keeps a branch-level gain admissible
   at any node while leaving the branch-level ordering intact. */
function thresholdDelta(branchLevel,nodeLevel,pos,horizon){
  const quota=POSITION_QUOTAS[pos],index=STARTER_LIMIT[pos]-1;
  const branchValues=branchLevel.values[pos],nodeValues=nodeLevel.values[pos];
  let total=0;
  for(let offset=0;offset<horizon;offset++){
    const drop=branchValues[offset*quota+index]-nodeValues[offset*quota+index];
    if(drop>0) total+=drop;
  }
  return total;
}

// Admissible per-formation bound for the last outstanding slot. It preserves the
// candidate's identity across every Gameweek and applies each formation's own
// threshold instead of the smallest threshold across formations.
function finalSlotUpperBound(level,pos,scoreRow,horizon){
  const gkPrefix=level.prefix[1],defPrefix=level.prefix[2],midPrefix=level.prefix[3],fwdPrefix=level.prefix[4];
  const quota=POSITION_QUOTAS[pos],values=level.values[pos];
  let total=0;
  for(let offset=0;offset<horizon;offset++){
    const gk=gkPrefix[offset*3+1],defBase=offset*6,midBase=offset*6,fwdBase=offset*4,
      valueBase=offset*quota,score=Number(scoreRow?.[offset])||0;
    let best=-Infinity;
    for(let i=0;i<FORMATIONS.length;i++){
      const shape=FORMATIONS[i];
      const starters=pos===1?1:pos===2?shape[0]:pos===3?shape[1]:shape[2];
      const delta=score-values[valueBase+starters-1];
      const value=gk+defPrefix[defBase+shape[0]]+midPrefix[midBase+shape[1]]+fwdPrefix[fwdBase+shape[2]]+(delta>0?delta:0);
      if(value>best) best=value;
    }
    total+=best;
  }
  return total;
}

/* Exact "best k scores available at or below a price" tables.

   Candidates are swept in ascending price once per position, so for any budget a
   binary search returns both how many candidates are affordable and their highest
   scores in each Gameweek. This replaces a price-filtered scan of the whole
   position pool at every partial node. */
const RELAXED_TOP_K=TRANSFER_RULES.maxTransfers;

function buildCostCappedTables(byPositionCost,scoreRows,horizon){
  const tables={1:null,2:null,3:null,4:null};
  for(const pos of [1,2,3,4]){
    const pool=byPositionCost[pos],costs=[];
    for(const p of pool){
      const cost=Number(p.now_cost||0);
      if(!costs.length||costs[costs.length-1]!==cost) costs.push(cost);
    }
    const steps=costs.length,available=new Int32Array(steps),top=new Float64Array(horizon*steps*RELAXED_TOP_K);
    top.fill(-Infinity);
    for(let offset=0;offset<horizon;offset++){
      const best=new Float64Array(RELAXED_TOP_K).fill(-Infinity);
      let index=0,seen=0,i=0;
      while(i<pool.length){
        const cost=Number(pool[i].now_cost||0);
        while(i<pool.length&&Number(pool[i].now_cost||0)===cost){
          const score=Number(scoreRows.get(Number(pool[i].id))?.[offset])||0;
          for(let k=0;k<RELAXED_TOP_K;k++) if(score>best[k]){
            for(let j=RELAXED_TOP_K-1;j>k;j--) best[j]=best[j-1];
            best[k]=score; break;
          }
          seen++; i++;
        }
        const base=(offset*steps+index)*RELAXED_TOP_K;
        for(let k=0;k<RELAXED_TOP_K;k++) top[base+k]=best[k];
        if(offset===0) available[index]=seen;
        index++;
      }
    }
    tables[pos]={costs:Float64Array.from(costs),steps,available,top};
  }
  return tables;
}

// Largest table step whose price is within budget, or -1 when nothing is affordable.
function costCappedStep(table,maxCandidateCost){
  const costs=table.costs;
  let low=0,high=table.steps-1,found=-1;
  while(low<=high){
    const mid=(low+high)>>1;
    if(costs[mid]<=maxCandidateCost){ found=mid; low=mid+1; } else high=mid-1;
  }
  return found;
}

/* Admissible bound that keeps `fixedRow` at `fixedPos` with its true identity and
   fills every other outstanding slot with the highest-scoring affordable candidate
   of that Gameweek. Cross-Gameweek identity, club capacity and candidate reuse are
   relaxed only in the optimistic direction and the per-player price cap is exact,
   so no reachable descendant can score higher. -Infinity means no completion can
   be afforded at all. */
function relaxedHorizonUpperBound(from,scratch,prefixRefs,remainingNeed,horizon,costTables,
  fixedPos,fixedRow,caps){
  for(let pos=1;pos<=4;pos++){
    const quota=POSITION_QUOTAS[pos],count=from.count[pos];
    const relaxedNeed=remainingNeed[pos]|0,fixed=pos===fixedPos?1:0;
    if(!relaxedNeed&&!fixed){ prefixRefs[pos]=from.prefix[pos]; continue; }
    const values=scratch.values[pos],prefix=scratch.prefix[pos],real=from.real[pos];
    let step=-1,table=null;
    if(relaxedNeed){
      table=costTables[pos];
      step=costCappedStep(table,caps[pos]);
      if(step<0||table.available[step]<relaxedNeed) return -Infinity;
    }
    for(let offset=0;offset<horizon;offset++){
      const rowBase=offset*quota,prefixBase=offset*(quota+1);
      for(let k=0;k<count;k++) values[rowBase+k]=real[rowBase+k];
      let filled=0;
      if(fixed){ values[rowBase+count]=Number(fixedRow?.[offset])||0; filled=1; }
      if(relaxedNeed){
        const base=(offset*table.steps+step)*RELAXED_TOP_K;
        for(let k=0;k<relaxedNeed;k++) values[rowBase+count+filled+k]=table.top[base+k];
        filled+=relaxedNeed;
      }
      sortDescInPlace(values,rowBase,quota);
      let sum=0; prefix[prefixBase]=0;
      for(let k=0;k<quota;k++){ sum+=values[rowBase+k]; prefix[prefixBase+k+1]=sum; }
    }
    prefixRefs[pos]=prefix;
  }
  return horizonTotalFromPrefixes(prefixRefs[1],prefixRefs[2],prefixRefs[3],prefixRefs[4],horizon);
}

function minimumRemainingDoubtful(byPosition,remainingNeed,usedIds){
  let total=0;
  for(const pos of [1,2,3,4]){
    const count=Number(remainingNeed[pos])||0;
    if(!count) continue;
    let available=0,nonDoubtful=0;
    for(const p of byPosition[pos]){
      if(usedIds.has(Number(p.id))) continue;
      available++;
      if(p.status!=='d') nonDoubtful++;
    }
    if(available<count) return Infinity;
    total+=Math.max(0,count-nonDoubtful);
  }
  return total;
}

function optimisticSignatureLower(outgoing,chosen,remainingNeed,byPositionId){
  const completion=chosen.slice(),used=new Set(chosen.map(p=>Number(p.id)));
  for(const pos of [1,2,3,4]){
    let left=Number(remainingNeed[pos])||0;
    for(const p of byPositionId[pos]){
      if(!left) break;
      if(used.has(Number(p.id))) continue;
      used.add(Number(p.id)); completion.push(p); left--;
    }
    if(left>0) return '';
  }
  const incoming=orderedIncomingForOutgoing(outgoing,completion);
  const transfers=canonicalTransfers(outgoing.map((out,index)=>({
    outPlayerId:playerId(out),inPlayerId:Number(incoming[index]?.id),position:positionOf(out)
  })));
  return planSignature(transfers);
}

function optimisticTieBreak({ctx,outgoing,chosen,remainingNeed,byPosition,byPositionCost,byPositionId,usedIds,cost,sellTotal}){
  const cheapestRest=Object.entries(remainingNeed).reduce((sum,[pos,count])=>
    sum+cheapestAvailableCost(byPositionCost[pos],count,usedIds),0);
  const hasRemaining=Object.values(remainingNeed).some(Boolean);
  return {
    bankAfter:ctx.bank+sellTotal-cost-cheapestRest,
    doubtfulIncoming:chosen.filter(p=>p.status==='d').length+minimumRemainingDoubtful(byPosition,remainingNeed,usedIds),
    // Every real transfer signature is non-empty. The empty string is therefore
    // universally optimistic for a partial node, without assuming numeric player-ID
    // order is the same as locale string order for mixed-width identifiers.
    signature:hasRemaining?'':optimisticSignatureLower(outgoing,chosen,remainingNeed,byPositionId)
  };
}

const BOUND_EPSILON=1e-9;

/* Comparator-complete rejection for an already-tied optimistic bound. It is only
   reached when the optimistic net gain and gross score both tie the retained Kth
   plan, so the optimistic completion signature — the expensive part — is built
   only when it can change the outcome. */
function tiedBoundCannotBeat(depth,kth,optimisticTie){
  return comparePlans({
    netGain:kth.netGain,grossBestXIPoints:kth.grossBestXIPoints,
    hitCost:depth.hitCost,transferCount:depth.transferCount,freeTransfersNextGW:depth.freeTransfersNextGW,
    bankAfter:Number.isFinite(optimisticTie?.bankAfter)?optimisticTie.bankAfter:Number.MAX_SAFE_INTEGER,
    doubtfulIncoming:Number.isFinite(optimisticTie?.doubtfulIncoming)?optimisticTie.doubtfulIncoming:-1,
    signature:String(optimisticTie?.signature??'')
  },kth)>0;
}

// Fixed comparator terms for one transfer depth. netOffset converts any gross
// best-XI bound into the matching net-gain bound in one addition.
function depthConstants(ctx,transferCount){
  const hit=transferHit(ctx.freeTransfers,transferCount);
  const freeTransfersNextGW=nextFreeTransfers(ctx.freeTransfers,transferCount);
  const rollDifference=freeTransfersNextGW-ctx.baseline.freeTransfersNextGW;
  return {transferCount,hitCost:hit.hitCost,paidTransfers:hit.paidTransfers,freeTransfersNextGW,
    netOffset:-ctx.baseline.grossBestXIPoints-hit.hitCost+TRANSFER_RULES.rollValue*rollDifference};
}

// -1 rejected outright on net gain, 0 undecided until the tie keys, 1 retained.
function boundVerdict(upperGross,depth,kth){
  if(!kth) return Number.isFinite(upperGross)?1:(upperGross===-Infinity?-1:1);
  if(!Number.isFinite(upperGross)) return upperGross===-Infinity?-1:1;
  const upperNet=upperGross+depth.netOffset;
  if(upperNet<kth.netGain-BOUND_EPSILON) return -1;
  if(upperNet>kth.netGain+BOUND_EPSILON) return 1;
  if(upperGross<kth.grossBestXIPoints-BOUND_EPSILON) return -1;
  if(upperGross>kth.grossBestXIPoints+BOUND_EPSILON) return 1;
  return 0;
}

function cheapestAvailableCost(poolByCost,count,usedIds,extraUsedId=null){
  if(count<=0) return 0;
  let total=0,found=0;
  for(const p of poolByCost){
    const id=Number(p.id);
    if(usedIds.has(id)||id===extraUsedId) continue;
    total+=Number(p.now_cost||0);
    if(++found===count) return total;
  }
  return Infinity;
}

// Cheapest `count + 1` still-available prices at a position. One spare entry is
// enough to price the remaining slots exactly when the candidate being tried is
// itself one of the cheapest.
function cheapestAvailableCosts(poolByCost,count,usedIds){
  const rows=[];
  if(count<=0) return rows;
  for(const p of poolByCost){
    if(usedIds.has(Number(p.id))) continue;
    rows.push({id:Number(p.id),cost:Number(p.now_cost||0)});
    if(rows.length===count+1) break;
  }
  return rows;
}

// Price of the dearest member of the cheapest `count` still-available candidates.
// Subtracting it from a cheapest-completion total leaves a true lower bound on the
// price of every other outstanding slot.
function dearestOfCheapest(rows,count,excludedId){
  let found=0,last=0;
  for(let i=0;i<rows.length&&found<count;i++){
    if(rows[i].id===excludedId) continue;
    last=rows[i].cost; found++;
  }
  return found<count?Infinity:last;
}

function cheapestFrom(rows,count,excludedId){
  let total=0,found=0;
  for(let i=0;i<rows.length&&found<count;i++){
    if(rows[i].id===excludedId) continue;
    total+=rows[i].cost; found++;
  }
  return found<count?Infinity:total;
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

function outgoingCombinations(squad,size,scoreRows){
  return combinations(squad,size).map(set=>({
    set,
    score:set.reduce((sum,entry)=>sum+horizonScore(scoreRows,playerOf(entry)),0),
    key:set.map(playerId).sort((a,b)=>a-b).join(',')
  })).sort((a,b)=>a.score-b.score||a.key.localeCompare(b.key)).map(item=>item.set);
}

function optimiseTransfers(args){
  const ctx=normaliseSearch(args); if(ctx.error) return ctx.error;
  const plans=[ctx.baseline]; let evaluations=0, pruned=0, incomplete=false;
  const profile={outgoingBranches:0,boundPruned:0,identityBoundPruned:0,relaxedBoundPruned:0,finalSlotPruned:0,
    orderedBreaks:0,affordabilityPruned:0,clubPruned:0,leafEvaluations:0,materialisedPlans:0};
  const scoreRows=prepareScoreRows(ctx);
  const byPosition={1:[],2:[],3:[],4:[]};
  ctx.eligible.forEach(p=>byPosition[p.element_type].push(p));
  const byPositionCost={1:[],2:[],3:[],4:[]},byPositionId={1:[],2:[],3:[],4:[]};
  for(const pos of [1,2,3,4]){
    byPosition[pos].sort((a,b)=>horizonScore(scoreRows,b)-horizonScore(scoreRows,a)||Number(a.now_cost||0)-Number(b.now_cost||0)||Number(a.id)-Number(b.id));
    byPositionCost[pos]=byPosition[pos].slice().sort((a,b)=>Number(a.now_cost||0)-Number(b.now_cost||0)||Number(a.id)-Number(b.id));
    byPositionId[pos]=byPosition[pos].slice().sort((a,b)=>Number(a.id)-Number(b.id));
  }
  const costTables=buildCostCappedTables(byPositionCost,scoreRows,ctx.horizon);
  const allowanceCache=new Map();
  const clubAllowance=team=>{
    let allowed=allowanceCache.get(team);
    if(allowed===undefined){
      allowed=Math.max(TRANSFER_RULES.maxPerClub,Number(ctx.startCounts[team])||0);
      allowanceCache.set(team,allowed);
    }
    return allowed;
  };
  const levels=[]; for(let depth=0;depth<=TRANSFER_RULES.maxTransfers;depth++) levels.push(createPoolLevel(ctx.horizon));
  const scratch=createPoolLevel(ctx.horizon),prefixRefs={1:null,2:null,3:null,4:null};
  const retainedKth=()=>plans.length>=ctx.maxResults?plans[plans.length-1]:null;

  outer: for(let n=1;n<=ctx.limit;n++){
    ctx.onProgress?.({depth:n,maxDepth:ctx.limit,evaluations});
    const depth=depthConstants(ctx,n);
    for(const outgoing of outgoingCombinations(ctx.squad,n,scoreRows)){
      profile.outgoingBranches++;
      const required=outgoing.map(positionOf).sort((a,b)=>a-b);
      const need={1:0,2:0,3:0,4:0}; required.forEach(pos=>need[pos]++);
      if(Object.entries(need).some(([pos,count])=>byPosition[pos].length<count)){ pruned++; continue; }
      const sellTotal=outgoing.reduce((sum,e)=>sum+transferSellPrice(e),0);
      const budget=ctx.bank+sellTotal;
      const noneUsed=new Set();
      const minimumBuy=Object.entries(need).reduce((sum,[pos,count])=>sum+cheapestAvailableCost(byPositionCost[pos],count,noneUsed),0);
      if(minimumBuy>budget){ pruned++; profile.affordabilityPruned++; continue; }
      const outIds=new Set(outgoing.map(playerId));
      const core=ctx.squad.filter(entry=>!outIds.has(playerId(entry)));
      const afterOut={...ctx.startCounts}; outgoing.forEach(e=>{ afterOut[playerOf(e).team]=(afterOut[playerOf(e).team]||0)-1; });
      seedPoolLevel(levels[0],core,scoreRows,ctx.horizon);

      const caps={1:0,2:0,3:0,4:0};
      for(let rpos=1;rpos<=4;rpos++){
        const count=need[rpos]|0;
        caps[rpos]=count?budget-minimumBuy+dearestOfCheapest(
          cheapestAvailableCosts(byPositionCost[rpos],count,noneUsed),count,null):0;
      }
      const branchRelaxed=relaxedHorizonUpperBound(levels[0],scratch,prefixRefs,need,ctx.horizon,costTables,0,null,caps);
      const branchKth=retainedKth();
      let branchVerdict=boundVerdict(branchRelaxed,depth,branchKth);
      if(branchVerdict===0) branchVerdict=tiedBoundCannotBeat(depth,branchKth,optimisticTieBreak({ctx,outgoing,chosen:[],
        remainingNeed:need,byPosition,byPositionCost,byPositionId,usedIds:noneUsed,cost:0,sellTotal}))?-1:1;
      if(branchVerdict<0){ pruned++; profile.boundPruned++; profile.relaxedBoundPruned++; continue; }

      // Identity gains and their descending order are immutable for the whole branch.
      const gainOrder={},gainValue={};
      for(const pos of [1,2,3,4]){
        if(!need[pos]) continue;
        const values=new Map();
        for(const p of byPosition[pos]) values.set(Number(p.id),poolPlayerGain(levels[0],pos,scoreRows.get(Number(p.id)),ctx.horizon));
        gainOrder[pos]=byPosition[pos].slice().sort((a,b)=>
          (values.get(Number(b.id))-values.get(Number(a.id)))||
          Number(a.now_cost||0)-Number(b.now_cost||0)||Number(a.id)-Number(b.id));
        gainValue[pos]=values;
      }
      const bestRemainingGain=(remainingNeed,usedIds,maxCandidateCost,clubCounts)=>{
        let total=0;
        for(let pos=1;pos<=4;pos++){
          let left=remainingNeed[pos]|0;
          if(!left) continue;
          for(const p of gainOrder[pos]){
            const id=Number(p.id);
            if(usedIds.has(id)) continue;
            if(Number(p.now_cost||0)>maxCandidateCost) continue;
            if((clubCounts[p.team]|0)>=clubAllowance(p.team)) continue;
            total+=gainValue[pos].get(id)||0;
            if(--left===0) break;
          }
          if(left>0) return Infinity;
        }
        return total;
      };
      let coreByGameweek=null;
      const preparedCore=()=>coreByGameweek||(coreByGameweek=buildCoreByGameweek(core,scoreRows,ctx.horizon));

      const chosen=[],chosenPoolIndexes=[],usedIds=new Set(),clubCounts={...afterOut};
      function choose(index,cost,level){
        if(incomplete) return;
        const pos=required[index],pool=gainOrder[pos],last=index===required.length-1;
        const remainingAfter={1:0,2:0,3:0,4:0};
        for(let i=index+1;i<required.length;i++) remainingAfter[required[i]]++;
        const restGain=last?0:bestRemainingGain(remainingAfter,usedIds,budget-cost,clubCounts);
        if(restGain===Infinity){ pruned++; profile.boundPruned++; return; }
        // Exact base for everything already chosen, plus the admissible gain of an
        // optimistic completion. Both stay valid for every descendant of this node.
        const slotDelta={1:0,2:0,3:0,4:0}; let restDelta=0;
        for(let rpos=1;rpos<=4;rpos++){
          const outstanding=(remainingAfter[rpos]|0)+(rpos===pos?1:0);
          if(!outstanding) continue;
          slotDelta[rpos]=thresholdDelta(levels[0],level,rpos,ctx.horizon);
          restDelta+=(remainingAfter[rpos]|0)*slotDelta[rpos];
        }
        const nodeCeiling=poolHorizonTotal(level,ctx.horizon)+restGain+restDelta,slotBonus=slotDelta[pos];
        // Remaining-slot prices are fixed for the node; one spare entry per position
        // covers the case where the candidate being tried is itself among the cheapest.
        const cheapRows={1:null,2:null,3:null,4:null},cheapBase={1:0,2:0,3:0,4:0};
        let cheapestRestBase=0,restPriceable=true;
        for(let rpos=1;rpos<=4&&restPriceable;rpos++){
          const count=remainingAfter[rpos]|0;
          if(!count) continue;
          const rows=cheapestAvailableCosts(byPositionCost[rpos],count,usedIds);
          const total=cheapestFrom(rows,count,null);
          if(!Number.isFinite(total)) restPriceable=false;
          else { cheapRows[rpos]=rows; cheapBase[rpos]=total; cheapestRestBase+=total; }
        }
        if(!restPriceable){ pruned++; profile.affordabilityPruned++; return; }
        const startAt=index>0&&required[index-1]===pos?chosenPoolIndexes[index-1]+1:0;
        for(let poolIndex=startAt;poolIndex<pool.length;poolIndex++){
          const candidate=pool[poolIndex],id=Number(candidate.id),team=candidate.team;
          const gain=gainValue[pos].get(id)||0;
          const kth=retainedKth();
          // Descending identity order: the whole remainder of this pool is hopeless too.
          if(boundVerdict(nodeCeiling+gain+slotBonus,depth,kth)<0){
            pruned++; profile.boundPruned++; profile.identityBoundPruned++; profile.orderedBreaks++; break;
          }
          const nextCost=cost+Number(candidate.now_cost||0);
          let cheapestRest=cheapestRestBase;
          if(cheapRows[pos]){
            const count=remainingAfter[pos]|0;
            const replacement=cheapestFrom(cheapRows[pos],count,id);
            if(!Number.isFinite(replacement)){ pruned++; profile.affordabilityPruned++; continue; }
            cheapestRest=cheapestRest-cheapBase[pos]+replacement;
          }
          if(nextCost+cheapestRest>budget){ pruned++; profile.affordabilityPruned++; continue; }
          if((clubCounts[team]|0)>=clubAllowance(team)){ pruned++; profile.clubPruned++; continue; }

          if(last){
            if(kth){
              let verdict=boundVerdict(finalSlotUpperBound(level,pos,scoreRows.get(id),ctx.horizon),depth,kth);
              if(verdict===0){
                chosen.push(candidate);
                verdict=tiedBoundCannotBeat(depth,kth,optimisticTieBreak({ctx,outgoing,chosen,
                  remainingNeed:{1:0,2:0,3:0,4:0},byPosition,byPositionCost,byPositionId,usedIds,cost:nextCost,sellTotal}))?-1:1;
                chosen.pop();
              }
              if(verdict<0){ pruned++; profile.boundPruned++; profile.finalSlotPruned++; continue; }
            }
            if(++evaluations>ctx.maxEvaluations){ incomplete=true; return; }
            profile.leafEvaluations=evaluations;
            if(ctx.onProgress&&evaluations%ctx.progressInterval===0)
              ctx.onProgress({depth:n,maxDepth:ctx.limit,evaluations});
            clubCounts[team]=(clubCounts[team]|0)+1;
            if(inheritedClubLegal(ctx.startCounts,clubCounts,n)){
              chosen.push(candidate);
              extendPoolLevel(level,levels[index+1],pos,scoreRows.get(id),ctx.horizon);
              const incoming=orderedIncomingForOutgoing(outgoing,chosen),bankAfter=budget-nextCost;
              const gross=poolHorizonTotal(levels[index+1],ctx.horizon);
              const kthNow=retainedKth();
              let contend=boundVerdict(gross,depth,kthNow);
              if(contend===0) contend=tiedBoundCannotBeat(depth,kthNow,{bankAfter,
                doubtfulIncoming:incoming.filter(p=>p.status==='d').length,
                signature:planSignature(canonicalTransfers(outgoing.map((out,i)=>({
                  outPlayerId:playerId(out),inPlayerId:Number(incoming[i].id),position:positionOf(out)}))))})?-1:1;
              if(contend>=0){
                const plan=buildPreparedPlan({ctx,outgoing,incoming,core,coreByGameweek:preparedCore(),scoreRows,bankAfter,clubCounts});
                if(plan){ profile.materialisedPlans++; retainPlan(plans,plan,ctx.maxResults); }
              }
              chosen.pop();
            }
            clubCounts[team]=(clubCounts[team]|0)-1;
            continue;
          }

          clubCounts[team]=(clubCounts[team]|0)+1;
          for(let rpos=1;rpos<=4;rpos++){
            const count=remainingAfter[rpos]|0;
            caps[rpos]=count?budget-nextCost-cheapestRest+dearestOfCheapest(cheapRows[rpos],count,id):0;
          }
          const relaxed=relaxedHorizonUpperBound(level,scratch,prefixRefs,remainingAfter,ctx.horizon,costTables,
            pos,scoreRows.get(id),caps);
          const identityUpper=nodeCeiling+gain+slotBonus;
          const upper=Math.min(identityUpper,relaxed);
          let verdict=boundVerdict(upper,depth,kth);
          if(verdict===0){
            chosen.push(candidate);
            verdict=tiedBoundCannotBeat(depth,kth,optimisticTieBreak({ctx,outgoing,chosen,remainingNeed:remainingAfter,
              byPosition,byPositionCost,byPositionId,usedIds,cost:nextCost,sellTotal}))?-1:1;
            chosen.pop();
          }
          if(verdict<0){
            pruned++; profile.boundPruned++;
            if(identityUpper<=relaxed) profile.identityBoundPruned++; else profile.relaxedBoundPruned++;
            clubCounts[team]=(clubCounts[team]|0)-1;
            continue;
          }
          chosen.push(candidate); chosenPoolIndexes.push(poolIndex); usedIds.add(id);
          extendPoolLevel(level,levels[index+1],pos,scoreRows.get(id),ctx.horizon);
          choose(index+1,nextCost,levels[index+1]);
          chosen.pop(); chosenPoolIndexes.pop(); usedIds.delete(id);
          clubCounts[team]=(clubCounts[team]|0)-1;
          if(incomplete) return;
        }
      }
      choose(0,0,levels[0]);
      if(incomplete) break outer;
    }
  }
  return completeResult(ctx,plans,evaluations,pruned,incomplete,profile);
}

export { TRANSFER_PROGRESS_INTERVAL, hasKnownPurchasePrice, transferSellPrice, nextFreeTransfers, transferHit, validateSquad,
  bestXIForGW, scoreSquadAcrossHorizon, comparePlans, retainPlan, createPoolLevel, seedPoolLevel, poolHorizonTotal,
  optimiseTransfers, exhaustiveTransferSearch };
