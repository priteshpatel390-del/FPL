import { TRANSFER_RULES } from '../config.mjs';

const POSITION_QUOTAS = TRANSFER_RULES.positionQuotas;
const UNAVAILABLE = new Set(TRANSFER_RULES.unavailableStatuses);

function transferSellPrice(entry){
  const now = Number(entry?.p?.now_cost ?? entry?.now_cost);
  const boughtRaw = entry?.bought ?? entry?.purchasePrice;
  const bought = Number.isFinite(Number(boughtRaw)) ? Number(boughtRaw) : now;
  if(!Number.isFinite(now)) return 0;
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

function playerOf(entry){ return entry?.p || entry; }
function playerId(entry){ return Number(playerOf(entry)?.id); }
function positionOf(entry){ return Number(playerOf(entry)?.element_type); }

function validateSquad(squad, {allowInheritedOverQuota=true}={}){
  const issues=[];
  if(!Array.isArray(squad) || squad.length !== 15) issues.push('squad_size');
  const players = Array.isArray(squad) ? squad.map(playerOf).filter(Boolean) : [];
  const ids = players.map(p=>Number(p.id));
  if(new Set(ids).size !== ids.length) issues.push('duplicate_player');
  if(players.some(p=>!Number.isFinite(Number(p.id)) || !POSITION_QUOTAS[Number(p.element_type)])) issues.push('unknown_player');
  const pos={1:0,2:0,3:0,4:0}, clubs={};
  players.forEach(p=>{ pos[p.element_type]=(pos[p.element_type]||0)+1; clubs[p.team]=(clubs[p.team]||0)+1; });
  Object.entries(POSITION_QUOTAS).forEach(([k,v])=>{ if(pos[k]!==v) issues.push(`position_${k}`); });
  if(!allowInheritedOverQuota && Object.values(clubs).some(n=>n>TRANSFER_RULES.maxPerClub)) issues.push('club_quota');
  return {ok:issues.length===0, issues:[...new Set(issues)], positionCounts:pos, clubCounts:clubs};
}

function bestXIForGW(squad, gw, scorePlayer){
  const byPos={1:[],2:[],3:[],4:[]};
  squad.forEach(entry=>{
    const p=playerOf(entry), raw=Number(scorePlayer(p,gw));
    byPos[p.element_type].push({entry,p,score:Number.isFinite(raw)?raw:0});
  });
  Object.values(byPos).forEach(arr=>arr.sort((a,b)=>b.score-a.score || Number(a.p.id)-Number(b.p.id)));
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

function buildPlan({startSquad,outgoing,incoming,bank,freeTransfers,startGW,horizon,scorePlayer,baseline}){
  const outIds=new Set(outgoing.map(playerId));
  const finalSquad=startSquad.filter(e=>!outIds.has(playerId(e))).concat(incoming.map(p=>({p,bought:p.now_cost})));
  const legality=validateSquad(finalSquad,{allowInheritedOverQuota:true});
  if(!legality.ok) return null;
  const startCounts=validateSquad(startSquad,{allowInheritedOverQuota:true}).clubCounts;
  if(!inheritedClubLegal(startCounts,legality.clubCounts,outgoing.length)) return null;
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
    doubtfulIncoming:incoming.filter(p=>p.status==='d').length,signature:planSignature(transfers),
    warnings:incoming.filter(p=>p.status==='d').map(p=>`${p.web_name||p.id} doubtful (${p.chance_of_playing_next_round??'?'}%)`)};
}

function optimiseTransfers({squad,players,bank=0,freeTransfers=1,startGW=1,horizon=6,maxTransfers=TRANSFER_RULES.maxTransfers,
  maxResults=20,maxEvaluations=TRANSFER_RULES.maxEvaluations,scorePlayer}){
  const legality=validateSquad(squad,{allowInheritedOverQuota:true});
  if(!legality.ok) return {status:'invalid-input',issues:legality.issues,plans:[],evaluations:0};
  if(typeof scorePlayer!=='function') return {status:'projection-unavailable',issues:['score_player_missing'],plans:[],evaluations:0};
  const cleanBank=Math.max(0,Math.trunc(Number(bank)||0));
  const cleanFT=Math.max(0,Math.min(TRANSFER_RULES.maxFreeTransfers,Math.trunc(Number(freeTransfers)||0)));
  const cleanHorizon=Math.max(1,Math.min(TRANSFER_RULES.maxHorizon,Math.trunc(Number(horizon)||1)));
  const baselineScore=scoreSquadAcrossHorizon(squad,startGW,cleanHorizon,scorePlayer);
  const baseline={transferCount:0,transfers:[],finalSquadIds:squad.map(playerId).sort((a,b)=>a-b),bankBefore:cleanBank,bankAfter:cleanBank,
    freeTransfersBefore:cleanFT,paidTransfers:0,hitCost:0,freeTransfersNextGW:nextFreeTransfers(cleanFT,0),grossBestXIPoints:baselineScore.total,
    grossGain:0,rollDifference:0,netGain:0,perGameweekBestXI:baselineScore.perGameweek,doubtfulIncoming:0,signature:'',warnings:[]};
  const owned=new Set(squad.map(playerId));
  const eligible=(players||[]).filter(p=>p&&!owned.has(Number(p.id))&&POSITION_QUOTAS[p.element_type]&&!UNAVAILABLE.has(p.status)).sort((a,b)=>Number(a.id)-Number(b.id));
  const plans=[baseline]; let evaluations=0, incomplete=false;
  const limit=Math.min(TRANSFER_RULES.maxTransfers,Math.max(0,Math.trunc(maxTransfers||0)));
  outer: for(let n=1;n<=limit;n++){
    for(const outgoing of combinations(squad,n)){
      const required=outgoing.map(positionOf).sort((a,b)=>a-b);
      const candidates=eligible.filter(p=>required.includes(Number(p.element_type)));
      for(const incoming of combinations(candidates,n)){
        if(++evaluations>maxEvaluations){ incomplete=true; break outer; }
        const incomingPos=incoming.map(p=>Number(p.element_type)).sort((a,b)=>a-b);
        if(incomingPos.some((v,i)=>v!==required[i])) continue;
        const orderedIncoming=[]; const used=new Set();
        for(const out of outgoing){
          const idx=incoming.findIndex((p,i)=>!used.has(i)&&Number(p.element_type)===positionOf(out));
          if(idx<0) break; used.add(idx); orderedIncoming.push(incoming[idx]);
        }
        if(orderedIncoming.length!==n) continue;
        const plan=buildPlan({startSquad:squad,outgoing,incoming:orderedIncoming,bank:cleanBank,freeTransfers:cleanFT,startGW,horizon:cleanHorizon,scorePlayer,baseline});
        if(plan) plans.push(plan);
      }
    }
  }
  plans.sort(comparePlans);
  if(incomplete) return {status:'search-incomplete',issues:['evaluation_limit'],plans:[baseline],evaluations};
  return {status:'ok',issues:[],plans:plans.slice(0,Math.max(1,maxResults)),evaluations,baseline};
}

const exhaustiveTransferSearch = optimiseTransfers;

export { transferSellPrice, nextFreeTransfers, transferHit, validateSquad, bestXIForGW, scoreSquadAcrossHorizon,
  comparePlans, optimiseTransfers, exhaustiveTransferSearch };
