import test from 'node:test';
import assert from 'node:assert/strict';
import { TRANSFER_RULES } from '../src/config.mjs';
import { sellingPrice } from '../src/squad.mjs';
import { validateTransferSquad, nextFreeTransfers, evaluateTransferPlan,
  exhaustiveTransferPlans, branchAndBoundTransferPlans } from '../src/model/transfers.mjs';

const quotas={1:2,2:5,3:5,4:3};
function controlled(){
  let id=1;
  const squad=[];
  for(const [position,count] of Object.entries(quotas)) for(let i=0;i<count;i++){
    const p={id,element_type:+position,team:((id-1)%5)+1,now_cost:50,web_name:`O${position}-${i}`,score:2+i}; id++;
    squad.push({p,sellingPrice:i===0?48:50});
  }
  const players=squad.map(x=>x.p);
  for(const position of [1,2,3,4]) for(let i=0;i<2;i++) players.push({
    id:id++,element_type:position,team:6+i,now_cost:49+i*3,web_name:`N${position}-${i}`,
    score:position+i+5,status:i?'d':'a',chance_of_playing_next_round:i?50:100
  });
  players.push({id:id++,element_type:3,team:7,now_cost:45,web_name:'Unavailable',score:99,status:'i'});
  return {squad,players};
}
function bestXI(players,gw){
  const sorted=players.slice().sort((a,b)=>(b.score+gw/100)-(a.score+gw/100)||a.id-b.id);
  let best=-Infinity;
  for(let d=3;d<=5;d++) for(let m=2;m<=5;m++){
    const f=10-d-m;
    if(f<1||f>3) continue;
    const take=pos=>sorted.filter(p=>p.element_type===pos);
    const xi=[take(1)[0],...take(2).slice(0,d),...take(3).slice(0,m),...take(4).slice(0,f)];
    if(xi.length===11) best=Math.max(best,xi.reduce((s,p)=>s+p.score+gw/100,0));
  }
  return best;
}
const availability=p=>['i','u','s','n'].includes(p.status)?0:p.status==='d'?(p.chance_of_playing_next_round??50)/100:1;

test('Stage 6 rules validate the entire 2/5/5/3 squad and fail closed',()=>{
  const {squad}=controlled();
  assert.equal(validateTransferSquad(squad),true);
  assert.equal(validateTransferSquad(squad.slice(1)),false);
  assert.equal(validateTransferSquad([...squad.slice(0,-1),squad[0]]),false);
  const fourFromClub=squad.map((x,i)=>i<4?{...x,p:{...x.p,team:20}}:x);
  assert.equal(validateTransferSquad(fourFromClub),false);
});

test('paid hits and next-gameweek free transfers follow approved formulas',()=>{
  assert.equal(nextFreeTransfers(5,0),5);
  assert.equal(nextFreeTransfers(3,2),2);
  assert.equal(nextFreeTransfers(1,3),1);
  const result=evaluateTransferPlan(controlled().squad.map(x=>x.p),[{}, {}, {}],{
    freeTransfers:1,fromGW:1,horizon:2,bestXI:()=>50,rules:TRANSFER_RULES
  });
  assert.deepEqual({paid:result.paidTransfers,hit:result.hit,next:result.nextFreeTransfers,objective:result.objective},
    {paid:2,hit:8,next:1,objective:93});
});

test('exact branch-and-bound matches exhaustive search with deterministic ordering',()=>{
  const data=controlled(), input={...data,bank:5,freeTransfers:2,fromGW:4,horizon:3,bestXI,availability};
  const exhaustive=exhaustiveTransferPlans(input), production=branchAndBoundTransferPlans(input);
  const summary=r=>r.plans.map(p=>({objective:p.objective,bank:p.bank,
    moves:p.transfers.map(t=>[t.out.id,t.in.id])}));
  assert.equal(exhaustive.complete,true);
  assert.deepEqual(summary(production),summary(exhaustive));
  assert.ok(production.plans.some(p=>p.transfers.length===0));
  assert.ok(production.plans.some(p=>p.transfers.length===3));
  assert.ok(production.plans.some(p=>p.transfers.some(t=>t.in.status==='d')));
  assert.ok(production.plans.every(p=>p.transfers.every(t=>t.in.status!=='i')));
});

test('combined affordability uses actual selling prices plus bank',()=>{
  const data=controlled(), input={...data,bank:0,freeTransfers:1,fromGW:1,horizon:1,bestXI,availability};
  const result=branchAndBoundTransferPlans(input);
  const firstOwned=data.squad[0].p.id;
  assert.ok(result.plans.filter(p=>p.transfers.length===1).every(p=>
    !p.transfers.some(t=>t.out.id===firstOwned&&t.in.now_cost>48)));
});

test('manual selling price retains half a rise with profit rounded down',()=>{
  assert.equal(sellingPrice(55,50),52);
  assert.equal(sellingPrice(56,50),53);
  assert.equal(sellingPrice(49,50),49);
});

test('manual purchase price rejects a move affordable only at current price',()=>{
  const data=controlled(), outgoing=data.squad[0];
  delete outgoing.sellingPrice;
  outgoing.bought=50;
  outgoing.p.now_cost=55;
  const incoming={id:999,element_type:outgoing.p.element_type,team:9,now_cost:54,
    web_name:'False current-price bargain',score:50,status:'a'};
  data.players.push(incoming);
  const result=branchAndBoundTransferPlans({...data,bank:0,freeTransfers:1,fromGW:1,horizon:1,bestXI,availability});
  assert.ok(outgoing.p.now_cost>=incoming.now_cost);
  assert.equal(sellingPrice(outgoing.p.now_cost,outgoing.bought),52);
  assert.ok(result.plans.filter(plan=>plan.transfers.length===1).every(plan=>
    !plan.transfers.some(t=>t.out.id===outgoing.p.id&&t.in.id===incoming.id)));
});

test('invalid optimiser input returns no recommendation',()=>{
  const data=controlled();
  assert.deepEqual(branchAndBoundTransferPlans({...data,squad:data.squad.slice(1),bank:0,
    freeTransfers:1,fromGW:1,horizon:1,bestXI,availability}),{complete:false,plans:[]});
});
