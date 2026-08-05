// Runtime contracts for the background Transfers calculation, exercised against the
// production bundle with a controllable Worker. These cover the behaviour the earlier
// implementation could not prove: route rendering never calculates, calculation is
// explicit, cancellation terminates real work, stale results cannot land, and the session
// cache returns an exact earlier result without recalculating.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadApp, syntheticWorld } from './harness.mjs';

const walk = root => { const nodes=[]; const visit=n=>{ if(!n) return; nodes.push(n); (n.children||[]).forEach(visit); }; visit(root); return nodes; };
const visibleText = root => walk(root).filter(n=>n.nodeType===3).map(n=>n.textContent).join('');
const buttons = root => walk(root).filter(n=>n.tagName==='BUTTON');
const settle = async (turns=8) => { for(let i=0;i<turns;i++) await new Promise(resolve=>setTimeout(resolve,0)); };

// A legal 15-player squad drawn from the synthetic world, priced so affordability is exact.
function completeSquad(T){
  const need={1:2,2:5,3:5,4:3};
  const manual=[];
  let id=900;
  for(const [position,count] of Object.entries(need)){
    for(let i=0;i<count;i++){
      const player={id:id++,web_name:`S${id}`,element_type:Number(position),team:(i%3)+1,now_cost:45,
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
  return manual;
}

function openTransfers(fields={}){
  const app=loadApp({trHorizon:'1',trTop:'8',trFtCount:'1',trBankIn:'0',useManual:true,...fields},{interactive:true});
  syntheticWorld(app.T);
  completeSquad(app.T);
  app.doc.useManual.checked=true;
  app.T.S.nextGW=11;
  return app;
}

function workerResult(app,worker,plans){
  const request=worker.messages.find(message=>message.type==='calculate');
  const baseline={transferCount:0,transfers:[],netGain:0,grossBestXIPoints:10,hitCost:0,bankAfter:0,
    freeTransfersBefore:1,freeTransfersNextGW:2,signature:'',warnings:[],perGameweekBestXI:[],pricingMode:'exact'};
  worker.onmessage({data:{type:'result',requestId:request.requestId,
    result:{status:'ok',issues:[],plans:plans||[baseline],evaluations:12,pruned:3,baseline,pricingMode:'exact'}}});
  return request;
}

// Opening #/transfers calls exactly this renderer. The route-aware deferral wrapper itself is
// covered by manual-squad-runtime.test.mjs, whose module sits past the harness init boundary.
test('opening Transfers paints the workspace without calculating anything',()=>{
  const {T,doc,workers}=openTransfers();
  T.S.lastOptimiser=null;
  T.renderTransfers();
  const text=visibleText(doc.transferOut);
  assert.match(text,/Transfers is ready/);
  assert.equal(workers.length,0,'route rendering must not construct a worker');
  assert.equal(T.S.lastOptimiser,null,'route rendering must not produce an optimiser result');
  assert.equal(doc.transferOut.attrs['aria-busy'],'false');
  assert.match(doc.transferStatus.textContent,/Calculation starts only when requested/);
});

test('calculation begins only on the explicit action',async()=>{
  const {T,doc,workers}=openTransfers();
  T.renderTransfers();
  assert.equal(workers.length,0);
  const action=buttons(doc.transferOut).find(node=>visibleText(node).includes('Calculate transfers'));
  assert.ok(action,'the workspace must offer an explicit calculate action');
  action.click();
  await settle();
  assert.equal(workers.length,1,'the explicit action must start exactly one background worker');
  assert.match(workers[0].url,/^blob:/,'the optimiser must run from a local Blob worker');
  assert.equal(workers[0].messages[0].type,'calculate');
});

test('a completed worker result renders and is reused from the session cache',async()=>{
  const {T,doc,workers}=openTransfers();
  T.renderTransfers();
  void T.transferPerformanceStart();
  await settle();
  workerResult(T,workers[0]);
  await settle();
  assert.match(visibleText(doc.transferOut),/Make no transfer/);
  assert.ok(T.S.lastOptimiser,'a completed calculation must record its optimiser result');
  assert.equal(workers[0].terminated,true,'a finished worker must be terminated');

  T.renderTransfers();
  assert.match(visibleText(doc.transferOut),/Make no transfer/);
  assert.match(doc.transferStatus.textContent,/reused instantly/);
  assert.equal(workers.length,1,'an unchanged input set must not recalculate');
});

test('every material input change invalidates the cached result without recalculating',async()=>{
  for(const change of [
    app=>{ app.doc.trHorizon.value='3'; },
    app=>{ app.doc.trTop.value='20'; },
    // Free transfers and bank are owned by the canonical Team-setup controls; the Transfers
    // fields mirror them, so a durable change updates both.
    app=>{ app.doc.ftCount.value='2'; app.doc.trFtCount.value='2'; },
    app=>{ app.doc.bankIn.value='1.5'; app.doc.trBankIn.value='1.5'; },
    app=>{ app.T.S.nextGW=12; },
    app=>{ app.T.S.manual[0].bought=46; },
    app=>{ app.T.S.manual.pop(); app.T.S.manual.push({id:app.T.S.boot.elements[0].id,bought:50}); }
  ]){
    const app=openTransfers();
    app.T.renderTransfers();
    void app.T.transferPerformanceStart();
    await settle();
    workerResult(app.T,app.workers[0]);
    await settle();
    assert.match(visibleText(app.doc.transferOut),/Make no transfer/);

    change(app);
    app.T.renderTransfers();
    assert.match(visibleText(app.doc.transferOut),/Transfers is ready|complete 15-player squad|planning assumptions/);
    assert.equal(app.workers.length,1,'invalidation must not start a new search on its own');
  }
});

test('cancelling terminates the active worker and returns to the explicit action',async()=>{
  const {T,doc,workers}=openTransfers();
  T.renderTransfers();
  void T.transferPerformanceStart();
  await settle();
  assert.equal(workers.length,1);
  const cancel=buttons(doc.transferOut).find(node=>visibleText(node).includes('Cancel calculation'));
  assert.ok(cancel,'an active calculation must offer a cancel action');
  cancel.click();
  await settle();
  assert.equal(workers[0].terminated,true);
  assert.match(visibleText(doc.transferOut),/Calculation cancelled/);
});

test('leaving Transfers terminates active background work',async()=>{
  const {T,workers,dispatch}=openTransfers();
  T.renderTransfers();
  void T.transferPerformanceStart();
  await settle();
  assert.equal(workers.length,1);
  dispatch('teamsheet:before-route-change',{from:'#/transfers',to:'#/team'});
  assert.equal(workers[0].terminated,true,'navigating away must terminate the worker');
});

test('verified data changes cancel obsolete work and clear the cached result',async()=>{
  const {T,doc,workers,dispatch}=openTransfers();
  T.renderTransfers();
  void T.transferPerformanceStart();
  await settle();
  workerResult(T,workers[0]);
  await settle();
  assert.match(visibleText(doc.transferOut),/Make no transfer/);
  dispatch('teamsheet:data-rendered',{});
  assert.match(visibleText(doc.transferOut),/Transfers is ready/);
  assert.equal(workers.length,1,'invalidation must not start a new search on its own');
});

test('a stale worker response cannot overwrite a newer calculation',async()=>{
  const {T,doc,workers}=openTransfers();
  T.renderTransfers();
  void T.transferPerformanceStart();
  await settle();
  const stale=workers[0];
  void T.transferPerformanceStart();
  await settle();
  assert.equal(workers.length,2,'a superseding calculation must start its own worker');
  assert.equal(stale.terminated,true,'the superseded worker must be terminated');
  workerResult(T,stale);
  await settle();
  assert.doesNotMatch(visibleText(doc.transferOut),/Make no transfer/,'a stale result must not render');
  assert.equal(T.S.lastOptimiser,null,'a stale result must not become the recorded optimiser result');
});

test('an unavailable Worker fails honestly and never falls back to a blocking search',async()=>{
  const {T,doc,workers}=openTransfers();
  T.renderTransfers();
  const RealWorker=globalThis.Worker;
  globalThis.Worker=undefined;
  try{
    await T.transferPerformanceStart();
  }finally{
    globalThis.Worker=RealWorker;
  }
  const text=visibleText(doc.transferOut);
  assert.match(text,/could not be calculated/);
  assert.match(text,/cannot run the transfer calculation in the background/);
  assert.doesNotMatch(text,/worker_|Blob|optimiser source/,'internal reasons must stay out of the interface');
  assert.equal(workers.length,0);
  assert.equal(T.S.lastOptimiser,null,'a failed calculation must not claim an optimiser result');
  assert.equal(doc.transferOut.attrs['aria-busy'],'false');
});

test('an incomplete search stays fail-closed through the worker boundary',async()=>{
  const {T,doc,workers}=openTransfers();
  T.renderTransfers();
  void T.transferPerformanceStart();
  await settle();
  const request=workers[0].messages.find(message=>message.type==='calculate');
  workers[0].onmessage({data:{type:'result',requestId:request.requestId,
    result:{status:'search-incomplete',issues:['evaluation_limit'],plans:[{transferCount:0}],evaluations:1,pruned:0,
      baseline:{transferCount:0},pricingMode:'exact'}}});
  await settle();
  const text=visibleText(doc.transferOut);
  assert.match(text,/did not complete/);
  assert.doesNotMatch(text,/Highest-ranked/,'a partial search must never be presented as optimal');
});

test('progress updates rewrite the status without rebuilding the workspace',async()=>{
  const {T,doc,workers}=openTransfers();
  T.renderTransfers();
  void T.transferPerformanceStart();
  await settle();
  const request=workers[0].messages.find(message=>message.type==='calculate');
  const before=doc.transferOut.children.length;
  workers[0].onmessage({data:{type:'progress',requestId:request.requestId,depth:2,maxDepth:3,evaluations:41000}});
  assert.equal(doc.transferOut.children.length,before,'progress must not rebuild the workspace');
  assert.match(visibleText(doc.transferOut),/Depth 2 of 3 · 41,000 plans checked/);
  assert.match(doc.transferStatus.textContent,/Depth 2 of 3/);
  assert.equal(workers[0].terminated,false,'progress must not end the calculation');
});
