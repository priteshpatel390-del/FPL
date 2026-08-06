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
test('opening Transfers paints immediately and starts one automatic background calculation',async()=>{
  const {T,doc,workers}=openTransfers();
  T.S.lastOptimiser=null;
  T.renderTransfers();
  assert.match(visibleText(doc.transferOut),/Updating transfer advice|Preparing projections/);
  assert.doesNotMatch(visibleText(doc.transferOut),/Calculate transfers/);
  await settle();
  assert.equal(workers.length,1,'valid inputs must start exactly one background worker automatically');
  assert.match(workers[0].url,/^blob:/);
  assert.equal(workers[0].messages[0].type,'calculate');
  assert.equal(T.S.lastOptimiser,null,'an in-flight calculation must not claim a result');
  assert.equal(doc.transferOut.attrs['aria-busy'],'true');
});

test('re-rendering Transfers reconnects to the existing in-flight calculation',async()=>{
  const {T,doc,workers}=openTransfers();
  T.renderTransfers();
  await settle();
  assert.equal(workers.length,1);
  const active=workers[0];
  T.renderTransfers();
  await settle(2);
  assert.equal(workers.length,1,'route rendering must not start a duplicate worker');
  assert.equal(active.terminated,false,'route rendering must not terminate valid work');
  assert.match(visibleText(doc.transferOut),/Updating transfer advice|Checking exact transfer plans/);
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

test('every material input change invalidates the cached result and starts one replacement calculation',async()=>{
  for(const change of [
    app=>{ app.doc.trHorizon.value='3'; },
    app=>{ app.doc.trTop.value='20'; },
    app=>{ app.doc.ftCount.value='2'; app.doc.trFtCount.value='2'; },
    app=>{ app.doc.bankIn.value='1.5'; app.doc.trBankIn.value='1.5'; },
    app=>{ app.T.S.nextGW=12; },
    app=>{ app.T.S.manual[0].bought=46; }
  ]){
    const app=openTransfers();
    app.T.renderTransfers();
    await settle();
    workerResult(app.T,app.workers[0]);
    await settle();
    assert.match(visibleText(app.doc.transferOut),/Make no transfer/);

    change(app);
    app.T.renderTransfers();
    await settle();
    assert.equal(app.workers.length,2,'a changed material fingerprint must start one replacement worker');
    assert.match(visibleText(app.doc.transferOut),/Updating transfer advice|Checking exact transfer plans/);
  }
});

test('explicit cancellation pauses the exact job and Resume starts a new one',async()=>{
  const {T,doc,workers}=openTransfers();
  T.renderTransfers();
  await settle();
  assert.equal(workers.length,1);
  const cancel=buttons(doc.transferOut).find(node=>visibleText(node).includes('Cancel calculation'));
  assert.ok(cancel);
  cancel.click();
  await settle();
  assert.equal(workers[0].terminated,true);
  assert.match(visibleText(doc.transferOut),/Transfer calculation paused/);
  assert.doesNotMatch(visibleText(doc.transferOut),/Retry/,'Retry is reserved for genuine failure');
  const resume=buttons(doc.transferOut).find(node=>visibleText(node).includes('Resume calculation'));
  assert.ok(resume);
  resume.click();
  await settle();
  assert.equal(workers.length,2);
});

test('leaving Transfers preserves active background work and returning reconnects to it',async()=>{
  const {T,workers,dispatch}=openTransfers();
  T.renderTransfers();
  await settle();
  assert.equal(workers.length,1);
  const active=workers[0];
  dispatch('teamsheet:before-route-change',{from:'#/transfers',to:'#/team'});
  assert.equal(active.terminated,false,'internal navigation must not terminate valid exact work');
  T.renderTransfers();
  await settle(2);
  assert.equal(workers.length,1,'returning must reconnect to the same worker');
});

test('verified data changes cancel obsolete work and automatically start one replacement',async()=>{
  const {T,workers,dispatch}=openTransfers();
  T.renderTransfers();
  await settle();
  assert.equal(workers.length,1);
  const obsolete=workers[0];
  dispatch('teamsheet:data-rendered',{});
  await settle();
  assert.equal(obsolete.terminated,true);
  assert.equal(workers.length,2,'one new verified-data fingerprint must start one new worker');
});

test('a stale worker response cannot overwrite a force-started newer calculation',async()=>{
  const {T,doc,workers}=openTransfers();
  T.renderTransfers();
  await settle();
  const stale=workers[0];
  void T.transferPerformanceStart(T.transferPerformanceSnapshot(),{force:true});
  await settle();
  assert.equal(workers.length,2);
  assert.equal(stale.terminated,true);
  workerResult(T,stale);
  await settle();
  assert.doesNotMatch(visibleText(doc.transferOut),/Make no transfer/);
  assert.equal(T.S.lastOptimiser,null);
});

test('a genuine Worker failure shows Retry and never falls back to blocking search',async()=>{
  const {T,doc,workers}=openTransfers();
  const RealWorker=globalThis.Worker;
  globalThis.Worker=undefined;
  try{
    T.renderTransfers();
    await settle(12);
  }finally{
    globalThis.Worker=RealWorker;
  }
  const text=visibleText(doc.transferOut);
  assert.match(text,/could not be calculated/);
  assert.match(text,/cannot run the transfer calculation in the background/);
  assert.match(text,/Retry/);
  assert.doesNotMatch(text,/worker_|Blob|optimiser source/);
  assert.equal(workers.length,0);
  assert.equal(T.S.lastOptimiser,null);
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
  await settle();
  const request=workers[0].messages.find(message=>message.type==='calculate');
  const before=doc.transferOut.children.length;
  workers[0].onmessage({data:{type:'progress',requestId:request.requestId,depth:2,maxDepth:3,evaluations:41000}});
  assert.equal(doc.transferOut.children.length,before);
  assert.match(visibleText(doc.transferOut),/41,000 complete plans verified · up to 2 transfers/);
  assert.match(doc.transferStatus.textContent,/41,000 complete plans verified/);
  assert.equal(workers[0].terminated,false);
});
