import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRANSFER_RULES } from '../src/config.mjs';
import { stripModuleSyntax } from '../build-utils.mjs';
import { comparePlans, retainPlan, optimiseTransfers, exhaustiveTransferSearch } from '../src/model/transfers.mjs';
import {
  TRANSFER_PERFORMANCE_CACHE_LIMIT,
  TRANSFER_PERFORMANCE_SCORE_BATCH,
  TRANSFER_PERFORMANCE_PROGRESS_MS,
  TRANSFER_PERFORMANCE_UNAVAILABLE,
  transferPerformanceWorkerSource,
  transferPerformanceWorkerPlayer,
  transferPerformancePreparingDetail,
  transferPerformanceSearchingDetail
} from '../src/ui/transfer-performance.mjs';

const MODEL_SOURCE = stripModuleSyntax(readFileSync(new URL('../src/model/transfers.mjs',import.meta.url),'utf8'));

/* ---------------------------------------------------------------------
   Deterministic fixtures
   --------------------------------------------------------------------- */

// Mulberry32 — deterministic, dependency-free, identical on every run.
function rng(seed){
  let state=seed>>>0;
  return ()=>{
    state=(state+0x6D2B79F5)>>>0;
    let t=Math.imul(state^(state>>>15),1|state);
    t=(t+Math.imul(t^(t>>>7),61|t))^t;
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}

function player(id,pos,team,cost,xp,status='a'){
  return {id,element_type:pos,team,now_cost:cost,web_name:`P${id}`,status,xp};
}

function syntheticCase(seed){
  const next=rng(seed);
  const pick=(min,max)=>min+Math.floor(next()*(max-min+1));
  const squad=[];
  let id=1;
  for(const [pos,n] of [[1,2],[2,5],[3,5],[4,3]])
    for(let i=0;i<n;i++){
      const cost=40+pick(0,60);
      squad.push({p:player(id++,pos,pick(1,12),cost,+(next()*6).toFixed(3)),bought:cost});
    }
  const pool=squad.map(entry=>entry.p);
  for(let i=0;i<pick(6,16);i++){
    const pos=pick(1,4);
    pool.push(player(200+i,pos,pick(1,12),40+pick(0,70),+(next()*7).toFixed(3),next()<0.12?'d':'a'));
  }
  return {
    squad,
    players:pool,
    bank:pick(0,40),
    freeTransfers:pick(0,3),
    startGW:1,
    horizon:pick(1,3),
    maxTransfers:pick(0,3),
    maxResults:pick(1,12),
    scorePlayer:p=>p.xp
  };
}

// Forces exact netGain/grossBestXIPoints ties so the comparator's later keys — including the
// signature tiebreak that makes it a total order — decide the ordering.
function tiedCase(){
  const squad=[];
  let id=1;
  for(const [pos,n] of [[1,2],[2,5],[3,5],[4,3]])
    for(let i=0;i<n;i++) squad.push({p:player(id++,pos,(i%4)+1,50,2),bought:50});
  const pool=squad.map(entry=>entry.p);
  for(let i=0;i<10;i++) pool.push(player(300+i,(i%4)+1,(i%6)+1,50,3));
  return {squad,players:pool,bank:0,freeTransfers:2,startGW:1,horizon:2,maxTransfers:2,maxResults:9,scorePlayer:p=>p.xp};
}

const planSummary=result=>({
  status:result.status,
  pricingMode:result.pricingMode,
  plans:(result.plans||[]).map(plan=>({
    signature:plan.signature,
    transferCount:plan.transferCount,
    netGain:plan.netGain,
    grossBestXIPoints:plan.grossBestXIPoints,
    hitCost:plan.hitCost,
    bankAfter:plan.bankAfter,
    freeTransfersNextGW:plan.freeTransfersNextGW
  }))
});

/* ---------------------------------------------------------------------
   Bounded retention versus the exhaustive reference
   --------------------------------------------------------------------- */

test('bounded retention returns exactly the exhaustive plans in exactly the same order',()=>{
  for(let seed=1;seed<=60;seed++){
    const args=syntheticCase(seed);
    const bounded=optimiseTransfers(args);
    const reference=exhaustiveTransferSearch(args);
    assert.deepEqual(planSummary(bounded),planSummary(reference),`seed ${seed}`);
    assert.ok(bounded.plans.length<=args.maxResults,`seed ${seed} retained more than maxResults`);
  }
});

test('bounded retention preserves ordering when the comparator reaches its signature tiebreak',()=>{
  const args=tiedCase();
  const bounded=optimiseTransfers(args);
  const reference=exhaustiveTransferSearch(args);
  const tied=bounded.plans.filter(plan=>plan.netGain===bounded.plans[0].netGain);
  assert.ok(tied.length>1,'fixture must produce comparator ties');
  assert.deepEqual(planSummary(bounded),planSummary(reference));
});

test('bounded retention covers every legal transfer depth from 0 to 3',()=>{
  const depths=new Set();
  for(let seed=1;seed<=60;seed++){
    const args={...syntheticCase(seed),maxTransfers:3,maxResults:20};
    const bounded=optimiseTransfers(args);
    assert.deepEqual(planSummary(bounded),planSummary(exhaustiveTransferSearch(args)),`seed ${seed}`);
    bounded.plans.forEach(plan=>depths.add(Number(plan.transferCount)));
  }
  assert.deepEqual([...depths].sort(),[0,1,2,3]);
});

test('the zero-transfer baseline is retained and evicted exactly as a full sort and slice would',()=>{
  const args=tiedCase();
  for(const maxResults of [1,2,3,5,9,20]){
    const bounded=optimiseTransfers({...args,maxResults});
    const reference=exhaustiveTransferSearch({...args,maxResults});
    assert.deepEqual(planSummary(bounded),planSummary(reference),`maxResults ${maxResults}`);
    assert.equal(
      bounded.plans.some(plan=>Number(plan.transferCount)===0),
      reference.plans.some(plan=>Number(plan.transferCount)===0),
      `maxResults ${maxResults} baseline retention`
    );
  }
});

test('retainPlan never exceeds its limit and matches sort-then-slice on a large plan stream',()=>{
  const next=rng(99);
  const stream=[];
  for(let i=0;i<5000;i++) stream.push({netGain:+(next()*10).toFixed(4),grossBestXIPoints:+(next()*40).toFixed(4),
    hitCost:0,transferCount:1,freeTransfersNextGW:1,bankAfter:0,doubtfulIncoming:0,signature:`s${i}`});
  const retained=[];
  let peak=0;
  stream.forEach(plan=>{ retainPlan(retained,plan,8); peak=Math.max(peak,retained.length); });
  assert.equal(peak,8);
  assert.deepEqual(retained,stream.slice().sort(comparePlans).slice(0,8));
});

/* ---------------------------------------------------------------------
   Worker versus direct optimiser
   --------------------------------------------------------------------- */

// Executes the assembled worker source exactly as a Blob Worker would, with a stub `self`.
function runWorker(source,message){
  const posted=[];
  const self={postMessage:payload=>posted.push(payload)};
  const now=Date.now;
  // eslint-disable-next-line no-new-func
  new Function('self','Date',source)(self,{now});
  self.onmessage({data:message});
  return posted;
}

function workerArgs(args){
  return {
    squad:args.squad.map(entry=>({p:transferPerformanceWorkerPlayer(entry.p),bought:entry.bought})),
    players:args.players.map(transferPerformanceWorkerPlayer),
    bank:args.bank,
    freeTransfers:args.freeTransfers,
    startGW:args.startGW,
    horizon:args.horizon,
    maxTransfers:args.maxTransfers,
    maxResults:args.maxResults
  };
}

function scoreRows(args){
  return args.players.map(p=>[Number(p.id),Array.from({length:args.horizon},()=>p.xp)]);
}

test('the assembled worker source builds against the real reviewed transfer model',()=>{
  const source=transferPerformanceWorkerSource(MODEL_SOURCE);
  assert.match(source,/function optimiseTransfers\(/);
  assert.match(source,/function exhaustiveTransferSearch\(/);
  assert.match(source,/retainPlan\(plans,plan,ctx\.maxResults\)/);
  assert.match(source,/self\.onmessage/);
  assert.match(source,/self\.postMessage/);
  assert.doesNotMatch(source,/^\s*(?:import|export)\b/m);
  assert.doesNotMatch(source,/\beval\s*\(|new Function/);
  assert.throws(()=>transferPerformanceWorkerSource('function unrelated(){}'),/reviewed transfer model is missing/);
});

test('the worker returns exactly the same result as a direct optimiseTransfers call',()=>{
  const source=transferPerformanceWorkerSource(MODEL_SOURCE);
  for(let seed=1;seed<=25;seed++){
    const args=syntheticCase(seed);
    const posted=runWorker(source,{type:'calculate',requestId:seed,args:workerArgs(args),scoreRows:scoreRows(args)});
    const result=posted.find(message=>message.type==='result');
    assert.ok(result,`seed ${seed} produced no result`);
    assert.equal(result.requestId,seed);
    assert.deepEqual(planSummary(result.result),planSummary(optimiseTransfers(args)),`seed ${seed}`);
    assert.deepEqual(planSummary(result.result),planSummary(exhaustiveTransferSearch(args)),`seed ${seed} vs exhaustive`);
  }
});

test('the worker fails closed on an incomplete search instead of returning a partial optimum',()=>{
  const source=transferPerformanceWorkerSource(MODEL_SOURCE);
  const args=syntheticCase(7);
  const posted=runWorker(source,{
    type:'calculate',requestId:1,
    args:{...workerArgs(args),maxTransfers:2,maxEvaluations:0},
    scoreRows:scoreRows(args)
  });
  const result=posted.find(message=>message.type==='result').result;
  assert.equal(result.status,'search-incomplete');
  assert.equal(result.plans.length,1);
  assert.equal(result.plans[0].transferCount,0);
  assert.deepEqual(result.issues,['evaluation_limit']);
});

test('the worker reports a failure instead of throwing across the message boundary',()=>{
  const source=transferPerformanceWorkerSource(MODEL_SOURCE);
  const posted=runWorker(source,{type:'calculate',requestId:3,args:{squad:null},scoreRows:[]});
  const result=posted.find(message=>message.type==='result');
  assert.equal(result.result.status,'invalid-input');
  assert.equal(posted.some(message=>message.type==='error'),false);
});

test('the worker ignores any message that is not an explicit calculate request',()=>{
  const source=transferPerformanceWorkerSource(MODEL_SOURCE);
  assert.deepEqual(runWorker(source,{type:'ping'}),[]);
});

/* ---------------------------------------------------------------------
   Progress reporting is inert by default
   --------------------------------------------------------------------- */

test('the progress hook never changes results, evaluations or pruning',()=>{
  for(let seed=1;seed<=12;seed++){
    const args={...syntheticCase(seed),maxTransfers:3,maxResults:20};
    const silent=optimiseTransfers(args);
    const reports=[];
    const observed=optimiseTransfers({...args,onProgress:state=>reports.push(state),progressInterval:1});
    assert.deepEqual(planSummary(observed),planSummary(silent),`seed ${seed}`);
    assert.equal(observed.evaluations,silent.evaluations);
    assert.equal(observed.pruned,silent.pruned);
    assert.ok(reports.length>0,`seed ${seed} reported no progress`);
    assert.ok(reports.every(state=>state.depth>=1&&state.depth<=state.maxDepth));
  }
});

test('worker progress reporting is throttled rather than posted per evaluation',()=>{
  const source=transferPerformanceWorkerSource(MODEL_SOURCE);
  assert.match(source,new RegExp(`now-reportedAt<${TRANSFER_PERFORMANCE_PROGRESS_MS}`));
  const args={...syntheticCase(4),maxTransfers:3,maxResults:20};
  const posted=runWorker(source,{type:'calculate',requestId:1,args:workerArgs(args),scoreRows:scoreRows(args)});
  const progress=posted.filter(message=>message.type==='progress');
  const result=posted.find(message=>message.type==='result').result;
  assert.ok(progress.length<=Math.ceil(result.evaluations/1000),'progress must not be posted per evaluation');
});

/* ---------------------------------------------------------------------
   Payload, presentation and build wiring
   --------------------------------------------------------------------- */

test('worker payload retains only optimiser-required player fields',()=>{
  assert.deepEqual(transferPerformanceWorkerPlayer({
    id:'7',web_name:'Seven',team:'3',element_type:'2',now_cost:'55',
    status:'d',chance_of_playing_next_round:50,news:'not transferred'
  }),{
    id:7,web_name:'Seven',team:3,element_type:2,now_cost:55,
    status:'d',chance_of_playing_next_round:50
  });
});

test('progress copy states verified complete plans without claiming finality',()=>{
  assert.equal(transferPerformancePreparingDetail(0,700),'Preparing projections 0%.');
  assert.equal(transferPerformancePreparingDetail(350,700),'Preparing projections 50%.');
  assert.equal(transferPerformancePreparingDetail(0,0),'Preparing projections 100%.');
  assert.equal(transferPerformanceSearchingDetail(),'Checking exact transfer plans in the background.');
  assert.equal(
    transferPerformanceSearchingDetail({depth:2,maxDepth:3,evaluations:41000}),
    'Checking exact transfer plans in the background. 41,000 complete plans verified · up to 2 transfers.'
  );
});

test('failure copy is owner-facing, exposes Retry and never exposes an internal reason',()=>{
  const source=readFileSync(new URL('../src/ui/transfer-performance.mjs',import.meta.url),'utf8');
  assert.match(TRANSFER_PERFORMANCE_UNAVAILABLE,/cannot run the transfer calculation in the background/);
  assert.doesNotMatch(TRANSFER_PERFORMANCE_UNAVAILABLE,/worker_|optimiser source|retention site/);
  assert.match(source,/function transferPerformanceRenderFailure\(snapshot\)/);
  assert.match(source,/transferPerformanceAction\('Retry'/);
  assert.doesNotMatch(source,/transferPerformanceRenderError\([^)]*error\?\.message/);
});

test('Transfers owns one automatic persistent calculation with explicit Cancel, Resume and failure Retry',()=>{
  const source=readFileSync(new URL('../src/ui/transfer-performance.mjs',import.meta.url),'utf8');
  assert.equal(TRANSFER_PERFORMANCE_CACHE_LIMIT,4);
  assert.equal(TRANSFER_PERFORMANCE_SCORE_BATCH,12);
  assert.doesNotMatch(source,/Calculate transfers/);
  assert.doesNotMatch(source,/Recalculate transfers/);
  assert.match(source,/Cancel calculation/);
  assert.match(source,/Resume calculation/);
  assert.match(source,/transferPerformanceAction\('Retry'/);
  assert.match(source,/transferPerformanceScheduleAuto/);
  assert.match(source,/await transferPerformanceYield\(\)/);
  assert.match(source,/new Worker\(url\)/);
  assert.match(source,/function renderTransfers\(\)/);
  assert.doesNotMatch(source,/renderTransfers=/);
  assert.doesNotMatch(source,/teamsheet:before-route-change/,'internal navigation must not own worker lifetime');
  const rendererStart=source.indexOf('function renderTransfers(){');
  const rendererEnd=source.indexOf('function installTransferPerformanceRuntime(){',rendererStart);
  const renderer=source.slice(rendererStart,rendererEnd);
  assert.doesNotMatch(renderer,/transferPerformanceCancel/,'route rendering must reconnect rather than cancel');
  assert.match(renderer,/transferPerformanceEnsure/);
});

test('no runtime optimiser-source rewriting survives anywhere in the Transfers path',()=>{
  const source=readFileSync(new URL('../src/ui/transfer-performance.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/plans\.push\(plan\)/);
  assert.doesNotMatch(source,/\.replace\(target/);
  assert.doesNotMatch(source,/plan-retention site/);
  assert.doesNotMatch(source,/\.toString\(\)/);
});

test('build embeds the exact transfer model for the Blob worker and grants only worker execution',()=>{
  const build=readFileSync(new URL('../build.mjs',import.meta.url),'utf8');
  const viewIndex=build.indexOf("'src/ui/transfer-optimiser-view.mjs'");
  const performanceIndex=build.indexOf("'src/ui/transfer-performance.mjs'");
  const manualIndex=build.indexOf("'src/ui/manual-squad-runtime.mjs'");
  assert.ok(viewIndex>=0&&performanceIndex>viewIndex&&manualIndex>performanceIndex);
  assert.match(build,/TRANSFER_WORKER_MODEL_SOURCE/);
  assert.match(build,/worker-src 'self' blob:/);
  assert.doesNotMatch(build,/worker-src[^;\n]*https:/);
});

/* ---------------------------------------------------------------------
   Production deployable
   --------------------------------------------------------------------- */

function embeddedModelSource(){
  const bundle=readFileSync(new URL('../dist/app.bundle.js',import.meta.url),'utf8');
  const match=/^const TRANSFER_WORKER_MODEL_SOURCE = (".*");$/m.exec(bundle);
  assert.ok(match,'the deployable must embed the transfer model for the worker');
  return JSON.parse(match[1]);
}

test('the shipped deployable can actually build and run its own worker',()=>{
  const embedded=embeddedModelSource();
  assert.equal(embedded,MODEL_SOURCE,'the embedded model must be the reviewed source verbatim');
  const source=transferPerformanceWorkerSource(embedded);
  const args=syntheticCase(11);
  const posted=runWorker(source,{type:'calculate',requestId:1,args:workerArgs(args),scoreRows:scoreRows(args)});
  const result=posted.find(message=>message.type==='result');
  assert.ok(result,'the shipped worker source produced no result');
  assert.deepEqual(planSummary(result.result),planSummary(optimiseTransfers(args)));
});

test('production bundle contains the automatic persistent worker flow and one Transfers renderer',()=>{
  const bundle=readFileSync(new URL('../dist/app.bundle.js',import.meta.url),'utf8');
  assert.doesNotMatch(bundle,/Calculate transfers/);
  assert.match(bundle,/Checking exact transfer plans in the background/);
  assert.match(bundle,/Resume calculation/);
  assert.match(bundle,/TRANSFER_WORKER_MODEL_SOURCE/);
  assert.equal((bundle.match(/function renderTransfers\(/g)||[]).length,1);
});

test('a large realistic player pool stays bounded in retention and evaluation',()=>{
  const next=rng(2026);
  const squad=[];
  let id=1;
  for(const [pos,n] of [[1,2],[2,5],[3,5],[4,3]])
    for(let i=0;i<n;i++){
      const cost=45+Math.floor(next()*55);
      squad.push({p:player(id++,pos,1+Math.floor(next()*20),cost,+(next()*6).toFixed(3)),bought:cost});
    }
  const players=squad.map(entry=>entry.p);
  // Approximately the size of a real Official FPL catalogue.
  for(let i=0;i<640;i++)
    players.push(player(1000+i,1+(i%4),1+Math.floor(next()*20),40+Math.floor(next()*95),+(next()*7).toFixed(3)));

  const args={squad,players,bank:12,freeTransfers:1,startGW:1,horizon:6,maxTransfers:1,maxResults:8,scorePlayer:p=>p.xp};
  const result=optimiseTransfers(args);
  assert.equal(result.status,'ok');
  assert.ok(result.plans.length<=args.maxResults,'retention must stay bounded on a full-size pool');
  assert.ok(result.evaluations<=TRANSFER_RULES.maxEvaluations);
  assert.ok(result.pruned>0,'affordability and quota pruning must remain active');
  assert.deepEqual(planSummary(result),planSummary(exhaustiveTransferSearch(args)));
});
