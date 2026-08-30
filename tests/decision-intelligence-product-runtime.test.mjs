import test from 'node:test';
import assert from 'node:assert/strict';
import {loadApp,syntheticWorld} from './harness.mjs';

const settle=async(turns=16)=>{for(let i=0;i<turns;i++)await new Promise(resolve=>setTimeout(resolve,0));};
const text=root=>{const rows=[];const visit=node=>{if(node?.nodeType===3)rows.push(node.textContent);(node?.children||[]).forEach(visit);};visit(root);return rows.join('');};
function productionApp({manual=true,bank='1.5',ft='2'}={}){
  const app=loadApp({trHorizon:'1',trTop:'8',trFtCount:ft,trBankIn:bank,ftCount:ft,bankIn:bank,useManual:manual},{interactive:true});
  const {T,doc}=app;syntheticWorld(T);const need={1:2,2:5,3:5,4:3},picks=[];let id=900;
  for(const [position,count] of Object.entries(need))for(let i=0;i<count;i++){
    const player={...T.S.boot.elements.find(row=>row.element_type===Number(position)),id:id++,web_name:`Fixture ${id}`,element_type:Number(position),team:(i%3)+1,now_cost:45,status:'a'};
    T.S.boot.elements.push(player);T.S.byId[player.id]=player;picks.push(player);
  }
  T.S.nextGW=11;doc.useManual.checked=manual;
  if(manual)T.S.manual=picks.map(player=>({id:player.id,bought:45}));
  else{T.S.picks={picks:picks.map((player,index)=>({element:player.id,position:index+1,multiplier:1,is_captain:false}))};T.S.picksStatus='live';}
  return {...app,picks,pricingMode:manual?'exact':'estimated',bankTenths:Math.round(Number(bank)*10),freeTransfers:Number(ft)};
}
function finishTransfer(app){
  const worker=app.workers.at(-1),request=worker.messages.find(message=>message.type==='calculate');
  assert.ok(request,'production Transfers worker request');
  const ids=app.picks.map(player=>player.id).sort((a,b)=>a-b),baseline={transferCount:0,transfers:[],finalSquadIds:ids,bankBefore:app.bankTenths,bankAfter:app.bankTenths,freeTransfersBefore:app.freeTransfers,paidTransfers:0,hitCost:0,freeTransfersNextGW:Math.min(5,app.freeTransfers+1),grossBestXIPoints:50,grossGain:0,rollDifference:0,netGain:0,perGameweekBestXI:[],doubtfulIncoming:0,signature:'',warnings:[],pricingMode:app.pricingMode};
  worker.onmessage({data:{type:'result',requestId:request.requestId,result:{status:'ok',issues:[],plans:[baseline],evaluations:1,pruned:0,baseline,pricingMode:app.pricingMode}}});
  return baseline;
}
async function runTransfers(app){globalThis.location.hash='#/transfers';app.T.renderTransfers();await settle();const before=JSON.stringify(app.T.S.lastOptimiser);const baseline=finishTransfer(app);await settle();return {baseline,before};}

test('DI-4 production Team → Transfers → Team call sites transition unavailable to partial to complete',async()=>{
  const app=productionApp(),{T,doc}=app;
  T.renderWeeklyDecision(T.DI3_PARITY_RUNTIME.latest());assert.match(text(doc.weeklyDecision),/Weekly decision unavailable/);
  globalThis.location.hash='#/team';T.renderSquad();await settle();assert.equal(T.DI3_PARITY_RUNTIME.latest().artifact.completeness.state,'partial');assert.match(text(doc.weeklyDecision),/Partial weekly decision/);
  const teamBefore=JSON.stringify(T.mySquad());await runTransfers(app);assert.equal(T.DI3_PARITY_RUNTIME.latest().artifact.completeness.state,'complete');
  globalThis.location.hash='#/team';T.renderSquad();await settle();const latest=T.DI3_PARITY_RUNTIME.latest();assert.equal(latest.ok,true);assert.equal(latest.artifact.completeness.state,'complete');assert.match(text(doc.weeklyDecision),/Complete weekly decision/);assert.equal(JSON.stringify(T.mySquad()),teamBefore);
});

test('DI-4 production Transfers → Team call sites also form a complete artifact',async()=>{
  const app=productionApp();await runTransfers(app);assert.equal(app.T.DI3_PARITY_RUNTIME.latest().artifact.completeness.state,'partial');
  globalThis.location.hash='#/team';app.T.renderSquad();await settle();assert.equal(app.T.DI3_PARITY_RUNTIME.latest().artifact.completeness.state,'complete');assert.match(text(app.doc.weeklyDecision),/Complete weekly decision/);
});

test('DI-4 production bases preserve bank tenths, FT, squad identity and exact/estimated pricing semantics',async()=>{
  for(const manual of [true,false]){const app=productionApp({manual,bank:'1.5',ft:'2'});globalThis.location.hash='#/team';app.T.renderSquad();await settle();await runTransfers(app);const artifact=app.T.DI3_PARITY_RUNTIME.latest().artifact;assert.equal(artifact.completeness.state,'complete');assert.equal(artifact.squadBasis.bank,15);assert.equal(artifact.squadBasis.freeTransfers,2);assert.equal(artifact.squadBasis.priceBasis,manual?'exact':'estimated');assert.equal(artifact.squadBasis.squadHash,`squad:${app.picks.map(player=>player.id).sort((a,b)=>a-b).join(',')}`);}
});

test('DI-4 production result and order remain byte-identical after representation',async()=>{
  const app=productionApp();globalThis.location.hash='#/team';app.T.renderSquad();await settle();globalThis.location.hash='#/transfers';app.T.renderTransfers();await settle();const worker=app.workers.at(-1),request=worker.messages.find(message=>message.type==='calculate'),resultBefore=JSON.stringify(request.args);finishTransfer(app);await settle();assert.equal(JSON.stringify(request.args),resultBefore);assert.equal(app.T.DI3_PARITY_RUNTIME.latest().artifact.policy.allowedProductionSignals.length,0);
});

test('DI-4 flattened production bundle exposes the lexical read boundary without a DI-4 global',()=>{
  const app=productionApp();assert.equal(typeof app.T.renderWeeklyDecision,'function');assert.equal(Object.hasOwn(globalThis,'createWeeklyDecisionReadModel'),false);assert.equal(Object.hasOwn(globalThis,'S'),false);
});
