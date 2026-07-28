import { TRANSFER_RULES } from '../config.mjs';

const unavailable = p => ['i','u','s','n'].includes(p?.status);
const playerOf = entry => entry?.p || entry;
const idOf = entry => playerOf(entry)?.id;

function transferSellPrice(entry){
  const p = playerOf(entry), now = Number(p?.now_cost);
  if(Number.isFinite(Number(entry?.selling))) return Number(entry.selling);
  const bought = Number.isFinite(Number(entry?.bought)) ? Number(entry.bought) : now;
  if(!Number.isFinite(now)) return NaN;
  return now <= bought ? now : bought + Math.floor((now - bought) / 2);
}

function validateTransferSquad(squad){
  if(!Array.isArray(squad) || squad.length !== 15) return {ok:false, reason:'A complete 15-player squad is required.'};
  const ids = new Set(), positions = {1:0,2:0,3:0,4:0}, clubs = {};
  for(const entry of squad){
    const p = playerOf(entry);
    if(!p || !Number.isInteger(p.id) || ids.has(p.id)) return {ok:false, reason:'Squad contains a missing or duplicate player.'};
    if(!TRANSFER_RULES.squadPositions[p.element_type] || !Number.isInteger(p.team)) return {ok:false, reason:'Squad contains incomplete player data.'};
    ids.add(p.id); positions[p.element_type]++; clubs[p.team] = (clubs[p.team] || 0) + 1;
  }
  if(Object.keys(TRANSFER_RULES.squadPositions).some(pos => positions[pos] !== TRANSFER_RULES.squadPositions[pos]))
    return {ok:false, reason:'Squad must contain 2 GKs, 5 DEFs, 5 MIDs and 3 FWDs.'};
  if(Object.values(clubs).some(n => n > TRANSFER_RULES.maximumPerClub)) return {ok:false, reason:'Squad exceeds three players from one club.'};
  return {ok:true};
}

function bestXIValue(squad, gw, project){
  const byPos = {1:[],2:[],3:[],4:[]};
  squad.forEach(entry => byPos[playerOf(entry).element_type].push(Number(project(playerOf(entry),gw)) || 0));
  Object.values(byPos).forEach(a => a.sort((x,y) => y-x));
  let best = -Infinity;
  for(let d=3; d<=5; d++) for(let m=2; m<=5; m++){
    const f=10-d-m;
    if(f<1 || f>3) continue;
    const value=byPos[1][0]+byPos[2].slice(0,d).reduce((a,x)=>a+x,0)+byPos[3].slice(0,m).reduce((a,x)=>a+x,0)+byPos[4].slice(0,f).reduce((a,x)=>a+x,0);
    if(value>best) best=value;
  }
  return best;
}

function planKey(plan){
  return plan.moves.map(m => `${String(m.out.id).padStart(6,'0')}>${String(m.in.id).padStart(6,'0')}`).sort().join('|');
}
function comparePlans(a,b){
  return b.objective-a.objective || a.transferCount-b.transferCount || planKey(a).localeCompare(planKey(b));
}

function optimiseTransfers({squad, players, bank=0, freeTransfers=1, startGW=1, horizon=1, project, exhaustive=false, maxResults=25}={}){
  const valid=validateTransferSquad(squad);
  if(!valid.ok || !Array.isArray(players) || typeof project !== 'function' || !Number.isInteger(horizon) || horizon<1)
    return {complete:false, reason:valid.reason || 'Optimisation inputs are incomplete.', plans:[]};
  const owned=squad.map(e => ({...e,p:playerOf(e)}));
  const ownedIds=new Set(owned.map(idOf));
  const pool=players.filter(p => p && Number.isInteger(p.id) && !ownedIds.has(p.id) && !unavailable(p) && Number.isFinite(Number(p.now_cost)))
    .slice().sort((a,b)=>a.id-b.id);
  const fts=Math.max(0,Math.min(TRANSFER_RULES.maximumFreeTransfers,Math.floor(Number(freeTransfers)||0)));
  const cash=Math.max(0,Math.round(Number(bank)||0));
  const scoreSquad = finalSquad => {
    let projected=0;
    for(let offset=0;offset<horizon;offset++) projected += bestXIValue(finalSquad,startGW+offset,project);
    return projected;
  };
  const makePlan=(moves,finalSquad) => {
    const transferCount=moves.length, paidTransfers=Math.max(0,transferCount-fts);
    const nextFreeTransfers=Math.min(TRANSFER_RULES.maximumFreeTransfers,Math.max(0,fts-transferCount)+1);
    const projectedBestXI=scoreSquad(finalSquad), hit=paidTransfers*TRANSFER_RULES.hitCost;
    return {moves:moves.map(m=>({out:m.out.p,in:m.in})),squad:finalSquad,transferCount,paidTransfers,hit,nextFreeTransfers,projectedBestXI,
      objective:projectedBestXI-hit+TRANSFER_RULES.nextFreeTransferValue*nextFreeTransfers,
      bank:cash+moves.reduce((v,m)=>v+transferSellPrice(m.out)-m.in.now_cost,0)};
  };
  const baseline=makePlan([],owned), plans=[baseline];
  let evaluated=1;
  const keepPlan=plan => {
    evaluated++;
    plans.push(plan);
    if(!exhaustive && plans.length>Math.max(1,maxResults)){
      plans.sort(comparePlans);
      plans.length=Math.max(1,maxResults);
    }
  };
  const horizonValue=p => {
    let value=0;
    for(let offset=0;offset<horizon;offset++) value+=Number(project(p,startGW+offset))||0;
    return value;
  };
  let completed=true;
  try {
    const chooseOut=(need,start,chosen) => {
      if(chosen.length===need){
        const ordered=chosen.slice().sort((a,b)=>a.p.element_type-b.p.element_type||a.p.id-b.p.id);
        if(!exhaustive && plans.length>=Math.max(1,maxResults)){
          const paid=Math.max(0,need-fts), next=Math.min(5,Math.max(0,fts-need)+1);
          const optimistic=baseline.projectedBestXI+ordered.reduce((sum,out)=>{
            const best=pool.filter(p=>p.element_type===out.p.element_type).reduce((v,p)=>Math.max(v,horizonValue(p)),-Infinity);
            return sum+Math.max(0,best-horizonValue(out.p));
          },0)-paid*TRANSFER_RULES.hitCost+next;
          plans.sort(comparePlans);
          if(optimistic<plans.at(-1).objective) return;
        }
        chooseIn(ordered,0,[],cash+ordered.reduce((v,e)=>v+transferSellPrice(e),0)); return;
      }
      for(let i=start;i<=owned.length-(need-chosen.length);i++) chooseOut(need,i+1,chosen.concat(owned[i]));
    };
    const chooseIn=(outs,index,ins,budget) => {
      if(index===outs.length){
        const removed=new Set(outs.map(idOf));
        const finalSquad=owned.filter(e=>!removed.has(idOf(e))).concat(ins.map(p=>({p,bought:p.now_cost})));
        if(validateTransferSquad(finalSquad).ok) keepPlan(makePlan(outs.map((out,i)=>({out,in:ins[i]})),finalSquad));
        return;
      }
      const pos=outs[index].p.element_type;
      for(const p of pool){
        if(p.element_type!==pos || ins.some(x=>x.id===p.id) || p.now_cost>budget) continue;
        // Canonical order within a position removes permutation duplicates.
        const prior=ins.map((x,i)=>outs[i].p.element_type===pos?x.id:-1).filter(x=>x>=0).at(-1);
        if(prior!==undefined && p.id<=prior) continue;
        chooseIn(outs,index+1,ins.concat(p),budget-p.now_cost);
      }
    };
    for(let count=1;count<=TRANSFER_RULES.maximumTransfers;count++) chooseOut(count,0,[]);
  } catch { completed=false; }
  if(!completed) return {complete:false, reason:'Exact optimisation did not complete.', plans:[baseline]};
  plans.sort(comparePlans);
  // maxResults affects returned presentation only; every candidate was searched exactly.
  return {complete:true, algorithm:exhaustive?'exhaustive':'branch-and-bound', evaluated, plans:plans.slice(0,Math.max(1,maxResults))};
}

const optimiseTransfersExhaustive = options => optimiseTransfers({...options,exhaustive:true});
const optimiseTransfersBranchAndBound = options => optimiseTransfers({...options,exhaustive:false});

export { transferSellPrice, validateTransferSquad, bestXIValue, comparePlans, optimiseTransfersExhaustive, optimiseTransfersBranchAndBound };
