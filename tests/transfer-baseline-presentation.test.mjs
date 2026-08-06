// Regression coverage for the contract between the exact optimiser and the
// Transfers presentation. result.plans remains ranked Top K; result.baseline
// remains the mandatory zero-transfer comparison even when Top K evicts it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, syntheticWorld } from './harness.mjs';

const walk=root=>{ const nodes=[]; const visit=node=>{ if(!node) return; nodes.push(node); (node.children||[]).forEach(visit); }; visit(root); return nodes; };
const visibleText=root=>walk(root).filter(node=>node.nodeType===3).map(node=>node.textContent).join('');
const textCount=(root,needle)=>visibleText(root).split(needle).length-1;
const settle=async(turns=8)=>{ for(let index=0;index<turns;index++) await new Promise(resolve=>setTimeout(resolve,0)); };

function completeSquad(T){
  const need={1:2,2:5,3:5,4:3},manual=[];
  let id=900;
  for(const [position,count] of Object.entries(need)){
    for(let index=0;index<count;index++){
      const player={id:id++,web_name:`S${id}`,element_type:Number(position),team:(index%3)+1,now_cost:45,
        status:'a',chance_of_playing_next_round:100,minutes:900,starts:10,total_points:40,form:'4.0',
        selected_by_percent:'10',goals_scored:2,assists:2,clean_sheets:2,saves:0,bonus:4,bps:200,
        expected_goals_per_90:0.2,expected_assists_per_90:0.2,defensive_contribution_per_90:0,
        news:'',cost_change_event:0,transfers_in_event:0,transfers_out_event:0,yellow_cards:0,penalties_order:null};
      T.S.boot.elements.push(player);
      T.S.byId[player.id]=player;
      manual.push({id:player.id,bought:45});
    }
  }
  T.S.manual=manual;
}

function openTransfers(fields={}){
  const app=loadApp({trHorizon:'1',trTop:'8',trFtCount:'1',trBankIn:'0',useManual:true,...fields},{interactive:true});
  syntheticWorld(app.T);
  completeSquad(app.T);
  app.doc.useManual.checked=true;
  app.T.S.nextGW=11;
  return app;
}

function baselinePlan(){
  return {transferCount:0,transfers:[],finalSquadIds:[],netGain:0,grossGain:0,grossBestXIPoints:10,
    hitCost:0,paidTransfers:0,bankBefore:0,bankAfter:0,freeTransfersBefore:1,freeTransfersNextGW:2,
    rollDifference:0,signature:'',warnings:[],doubtfulIncoming:0,perGameweekBestXI:[],pricingMode:'exact'};
}

function strongerTransferPlan(T){
  const incoming=T.S.boot.elements.find(player=>Number(player.id)<900&&Number(player.element_type)===1);
  assert.ok(incoming,'fixture requires an unowned goalkeeper');
  return {transferCount:1,transfers:[{outPlayerId:900,inPlayerId:Number(incoming.id),position:1,sellPrice:45,buyPrice:Number(incoming.now_cost)}],
    finalSquadIds:[],netGain:2,grossGain:2,grossBestXIPoints:12,hitCost:0,paidTransfers:0,
    bankBefore:0,bankAfter:0,freeTransfersBefore:1,freeTransfersNextGW:1,rollDifference:-1,
    signature:`900>${incoming.id}`,warnings:[],doubtfulIncoming:0,perGameweekBestXI:[],pricingMode:'exact'};
}

function sendResult(worker,result){
  const request=worker.messages.find(message=>message.type==='calculate');
  assert.ok(request,'worker calculate request missing');
  worker.onmessage({data:{type:'result',requestId:request.requestId,result}});
}

test('an evicted zero-transfer baseline renders from result.baseline without changing ranked Top K',async()=>{
  const {T,doc,workers}=openTransfers({trTop:'1'});
  T.renderTransfers();
  await settle();
  const baseline=baselinePlan(),plan=strongerTransferPlan(T);
  sendResult(workers[0],{status:'ok',issues:[],plans:[plan],evaluations:12,pruned:3,baseline,pricingMode:'exact'});
  await settle();

  const text=visibleText(doc.transferOut);
  assert.match(text,/Make no transfer/);
  assert.match(text,/Highest-ranked decision/);
  assert.doesNotMatch(text,/No zero-transfer baseline was returned/);
  assert.equal(textCount(doc.transferOut,'Make no transfer'),1);
  assert.equal(T.S.lastOptimiser.result.plans.length,1,'presentation must not insert the baseline into optimiser Top K');
  assert.equal(T.S.lastOptimiser.result.plans[0].transferCount,1);
});

test('the evicted-baseline result is reused from cache without recalculation or duplication',async()=>{
  const {T,doc,workers}=openTransfers({trTop:'1'});
  T.renderTransfers();
  await settle();
  sendResult(workers[0],{status:'ok',issues:[],plans:[strongerTransferPlan(T)],evaluations:12,pruned:3,baseline:baselinePlan(),pricingMode:'exact'});
  await settle();
  assert.equal(textCount(doc.transferOut,'Make no transfer'),1);

  T.renderTransfers();
  assert.match(doc.transferStatus.textContent,/reused instantly/);
  assert.equal(workers.length,1,'unchanged cached inputs must not create another worker');
  assert.equal(textCount(doc.transferOut,'Make no transfer'),1);
});

test('an ok result without a valid separate baseline remains fail-closed',async()=>{
  for(const baseline of [undefined,{transferCount:1,transfers:[]}]){
    const {T,doc,workers}=openTransfers({trTop:'1'});
    T.renderTransfers();
    await settle();
    const result={status:'ok',issues:[],plans:[strongerTransferPlan(T)],evaluations:12,pruned:3,pricingMode:'exact'};
    if(baseline!==undefined) result.baseline=baseline;
    sendResult(workers[0],result);
    await settle();
    const text=visibleText(doc.transferOut);
    assert.match(text,/No zero-transfer baseline was returned/);
    assert.doesNotMatch(text,/Highest-ranked decision/);
    assert.equal(textCount(doc.transferOut,'Make no transfer'),0);
    assert.equal(T.S.lastOptimiser,null);
  }
});
