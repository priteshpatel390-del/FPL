import { TRANSFER_RULES } from '../config.mjs';

const byId = (a,b) => Number(a.id)-Number(b.id);
const playerOf = entry => entry.p || entry;
const saleOf = entry => entry.sellingPrice ?? entry.sellPrice ?? playerOf(entry).now_cost;

function validateTransferSquad(squad, rules=TRANSFER_RULES){
  if(!Array.isArray(squad) || squad.length !== rules.squadSize) return false;
  const ids=new Set(), positions={1:0,2:0,3:0,4:0}, clubs={};
  for(const entry of squad){
    const p=playerOf(entry);
    if(!p || p.id == null || ids.has(p.id) || !rules.positions[p.element_type]) return false;
    ids.add(p.id); positions[p.element_type]++;
    clubs[p.team]=(clubs[p.team]||0)+1;
    if(clubs[p.team] > rules.maxPerClub) return false;
  }
  return Object.entries(rules.positions).every(([pos,count])=>positions[pos]===count);
}

function nextFreeTransfers(freeTransfers, transferCount, rules=TRANSFER_RULES){
  return Math.min(rules.maxFreeTransfers,Math.max(0,freeTransfers-transferCount)+1);
}

function evaluateTransferPlan(squad, transfers, options){
  const rules=options.rules || TRANSFER_RULES, count=transfers.length;
  const paid=Math.max(0,count-options.freeTransfers), hit=paid*rules.hitCost;
  const nextFT=nextFreeTransfers(options.freeTransfers,count,rules);
  let projected=0;
  for(let offset=0;offset<options.horizon;offset++) projected += options.bestXI(squad,options.fromGW+offset);
  return {projected,paidTransfers:paid,hit,nextFreeTransfers:nextFT,
    objective:projected-hit+rules.nextFreeTransferValue*nextFT};
}

function comparePlans(a,b){
  const delta=b.objective-a.objective;
  if(Math.abs(delta)>1e-9) return delta;
  if(a.transfers.length!==b.transfers.length) return a.transfers.length-b.transfers.length;
  const ak=a.transfers.map(t=>`${t.out.id}:${t.in.id}`).join('|');
  const bk=b.transfers.map(t=>`${t.out.id}:${t.in.id}`).join('|');
  return ak.localeCompare(bk);
}

function optimiseTransfers(input,{branchAndBound=true}={}){
  const rules=input.rules || TRANSFER_RULES;
  if(!validateTransferSquad(input.squad,rules) || !Number.isFinite(input.bank) || input.bank<0 ||
      !Number.isInteger(input.horizon) || input.horizon<1) return {complete:false,plans:[]};
  const owned=input.squad.map(e=>({p:playerOf(e),sellingPrice:saleOf(e)})).sort((a,b)=>byId(a.p,b.p));
  const ownedIds=new Set(owned.map(e=>e.p.id));
  const candidates=(input.players||[]).filter(p=>p && !ownedIds.has(p.id) &&
    rules.positions[p.element_type] && input.availability(p)>0).slice().sort(byId);
  const options={...input,rules};
  const plans=[], maxResults=Number.isInteger(input.maxResults)&&input.maxResults>0?input.maxResults:Infinity;
  const addPlan=(outs,ins)=>{
    const outIds=new Set(outs.map(e=>e.p.id));
    const result=owned.filter(e=>!outIds.has(e.p.id)).concat(ins.map(p=>({p}))).map(e=>e.p);
    if(!validateTransferSquad(result,rules)) return;
    const funds=input.bank+outs.reduce((s,e)=>s+e.sellingPrice,0)-ins.reduce((s,p)=>s+p.now_cost,0);
    if(funds<0) return;
    const transfers=outs.map((e,i)=>({out:e.p,in:ins[i]})).sort((a,b)=>byId(a.out,b.out));
    plans.push({...evaluateTransferPlan(result,transfers,options),transfers,squad:result,bank:funds});
    if(plans.length>maxResults*2){ plans.sort(comparePlans); plans.length=maxResults; }
  };
  addPlan([],[]);
  const max=Math.min(rules.maxTransfers,owned.length);
  function chooseOut(start,want,outs){
    if(outs.length===want){
      const orderedOuts=outs.slice().sort((a,b)=>a.p.element_type-b.p.element_type||byId(a.p,b.p));
      const slots=orderedOuts.map(e=>e.p.element_type);
      const chosen=[];
      function chooseIn(slotIndex,lastByPos){
        if(slotIndex===slots.length){ addPlan(orderedOuts,chosen); return; }
        if(branchAndBound && plans.length>=maxResults && input.playerPoints){
          const retained=owned.filter(e=>!orderedOuts.includes(e)).map(e=>e.p).concat(chosen);
          const remaining=new Set(slots.slice(slotIndex));
          const universe=retained.concat(candidates.filter(p=>remaining.has(p.element_type)));
          let optimistic=0;
          for(let offset=0;offset<input.horizon;offset++) optimistic+=universe.map(p=>input.playerPoints(p,input.fromGW+offset))
            .sort((a,b)=>b-a).slice(0,11).reduce((s,x)=>s+x,0);
          const hit=Math.max(0,want-input.freeTransfers)*rules.hitCost;
          const upper=optimistic-hit+nextFreeTransfers(input.freeTransfers,want,rules)*rules.nextFreeTransferValue;
          plans.sort(comparePlans);
          if(upper<plans[Math.min(maxResults,plans.length)-1].objective-1e-9) return;
        }
        const pos=slots[slotIndex], min=lastByPos[pos] ?? -Infinity;
        for(const p of candidates){
          if(p.element_type!==pos || p.id<=min || chosen.some(x=>x.id===p.id)) continue;
          chosen.push(p);
          if(branchAndBound){
            const retained=owned.filter(e=>!orderedOuts.includes(e)).map(e=>e.p).concat(chosen);
            const clubs={}; retained.forEach(x=>clubs[x.team]=(clubs[x.team]||0)+1);
            const spent=chosen.reduce((s,x)=>s+x.now_cost,0);
            const funds=input.bank+orderedOuts.reduce((s,e)=>s+e.sellingPrice,0);
            if(clubs[p.team]>rules.maxPerClub || spent>funds){ chosen.pop(); continue; }
          }
          chooseIn(slotIndex+1,{...lastByPos,[pos]:p.id}); chosen.pop();
        }
      }
      chooseIn(0,{}); return;
    }
    for(let i=start;i<=owned.length-(want-outs.length);i++){
      outs.push(owned[i]); chooseOut(i+1,want,outs); outs.pop();
    }
  }
  // The production path prunes only branches already proved illegal (club/budget),
  // so it remains exact. The reference path enumerates them and rejects at the leaf.
  for(let count=1;count<=max;count++) chooseOut(0,count,[]);
  plans.sort(comparePlans);
  if(plans.length>maxResults) plans.length=maxResults;
  return {complete:true,algorithm:branchAndBound?'branch-and-bound':'exhaustive',plans};
}

const exhaustiveTransferPlans = input => optimiseTransfers(input,{branchAndBound:false});
const branchAndBoundTransferPlans = input => optimiseTransfers(input,{branchAndBound:true});

export { validateTransferSquad, nextFreeTransfers, evaluateTransferPlan, comparePlans,
  exhaustiveTransferPlans, branchAndBoundTransferPlans };
