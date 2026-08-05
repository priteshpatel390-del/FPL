import { TRANSFER_RULES } from '../config.mjs';
import { S } from '../state.mjs';
import { $, el, setChildren } from '../util.mjs';
import { xpOf } from '../model/xp.mjs';
import { mySquad } from '../squad.mjs';
import { saveCfg } from '../storage.mjs';
import {
  decisionPreviewSquadSignature,
  decisionPreviewPlanSignature,
  decisionPreviewOptimiserSignature,
  decisionPreviewSnapshot,
  decisionPreviewSyncOptimiser
} from './decision-preview.mjs';
import { renderRouteDataWarning } from './data-warning.mjs';

const TRANSFER_PERFORMANCE_CACHE_LIMIT = 4;
const TRANSFER_PERFORMANCE_SCORE_BATCH = 12;
const TRANSFER_PERFORMANCE_PROGRESS_MS = 200;
const TRANSFER_PERFORMANCE_UNAVAILABLE = 'This browser cannot run the transfer calculation in the background, so no comparison is being produced.';
const transferPerformanceCache = new Map();
let transferPerformanceWorker = null;
let transferPerformanceToken = 0;
let transferPerformanceDataVersion = 0;
let transferPerformanceInstalled = false;
let transferPerformanceBusyDetail = null;

// The worker runs the reviewed transfer model verbatim. Nothing rewrites, patches or
// re-derives the optimiser at runtime: bounded top-K retention lives in the model itself,
// so the background search and a direct optimiseTransfers() call execute identical code.
const TRANSFER_PERFORMANCE_WORKER_HANDLER = `
self.onmessage=event=>{
  const payload=event.data||{};
  if(payload.type!=="calculate") return;
  const requestId=payload.requestId;
  const rows=Array.isArray(payload.scoreRows)?payload.scoreRows:[];
  const scoreMap=new Map(rows.map(row=>[Number(row[0]),Array.isArray(row[1])?row[1]:[]]));
  const startGW=Number(payload.args?.startGW)||1;
  const scorePlayer=(player,gw)=>{
    const scores=scoreMap.get(Number(player?.id));
    const value=Number(scores?.[Number(gw)-startGW]);
    return Number.isFinite(value)?value:0;
  };
  let reportedAt=0;
  const onProgress=state=>{
    const now=Date.now();
    if(now-reportedAt<${TRANSFER_PERFORMANCE_PROGRESS_MS}) return;
    reportedAt=now;
    self.postMessage({type:"progress",requestId,depth:state.depth,maxDepth:state.maxDepth,evaluations:state.evaluations});
  };
  try{
    const result=optimiseTransfers({...payload.args,scorePlayer,onProgress});
    self.postMessage({type:"result",requestId,result});
  }catch(error){
    self.postMessage({type:"error",requestId,message:String(error?.message||error||"Worker calculation failed")});
  }
};`;

function transferPerformanceWorkerSource(modelSource, rules=TRANSFER_RULES){
  const source=String(modelSource||'');
  if(!/function optimiseTransfers\(/.test(source))
    throw new Error('The reviewed transfer model is missing from this build.');
  return `"use strict";
const TRANSFER_RULES=${JSON.stringify(rules)};
${source}
${TRANSFER_PERFORMANCE_WORKER_HANDLER}`;
}

function transferPerformanceHash(value, seed=2166136261){
  let hash=seed>>>0;
  const text=String(value ?? '');
  for(let i=0;i<text.length;i++){
    hash^=text.charCodeAt(i);
    hash=Math.imul(hash,16777619)>>>0;
  }
  return hash>>>0;
}

function transferPerformanceCurrentRoute(){
  return String(globalThis.location?.hash||'').split('?')[0];
}

function transferPerformanceYield(){
  return new Promise(resolve=>{
    if(typeof globalThis.requestAnimationFrame==='function') globalThis.requestAnimationFrame(()=>resolve());
    else globalThis.setTimeout?.(resolve,0);
  });
}

function transferPerformanceControlSignature(){
  return transferPlannerControlSignature(
    $('trFtCount')?.value,
    $('trBankIn')?.value,
    $('trHorizon')?.value,
    $('trTop')?.value
  );
}

function transferPerformanceWorkerPlayer(player={}){
  return {
    id:Number(player.id),
    web_name:String(player.web_name||player.id||''),
    team:Number(player.team),
    element_type:Number(player.element_type),
    now_cost:Number(player.now_cost)||0,
    status:String(player.status||'a'),
    chance_of_playing_next_round:player.chance_of_playing_next_round??null
  };
}

function transferPerformanceSnapshot(){
  if(!S.boot) return {error:['Verified player data is unavailable.','Refresh from Settings before using transfer comparisons.']};
  const squad=mySquad();
  if(squad.length!==15) return {error:['A complete 15-player squad is required.','Load your team or finish the manual squad in Team setup.']};
  const assumptions=transferPlannerReadAssumptions($('trFtCount')?.value,$('trBankIn')?.value);
  if(!assumptions.valid) return {error:['Check the planning assumptions.',assumptions.issues.join(' ')]};
  const horizon=Math.max(1,Math.min(8,Math.trunc(Number($('trHorizon')?.value)||6)));
  const maxResults=Math.max(1,Math.min(20,Math.trunc(Number($('trTop')?.value)||8)));
  const squadSignature=decisionPreviewSquadSignature(squad);
  const signature=[
    transferPerformanceDataVersion,
    typeof BUILD_INFO!=='undefined'?BUILD_INFO.sourceHash:'',
    S.cachedAt||'live',
    S.nextGW,
    horizon,
    maxResults,
    assumptions.bankTenths,
    assumptions.freeTransfers,
    squadSignature
  ].join('|');
  return {
    squad,
    players:S.boot.elements||[],
    horizon,
    maxResults,
    assumptions,
    squadSignature,
    signature,
    args:{
      squad:squad.map(entry=>({
        p:transferPerformanceWorkerPlayer(entry?.p||entry),
        bought:entry?.bought??entry?.purchasePrice??null
      })),
      players:(S.boot.elements||[]).map(transferPerformanceWorkerPlayer),
      bank:assumptions.bankTenths,
      freeTransfers:assumptions.freeTransfers,
      startGW:S.nextGW,
      horizon,
      maxResults
    }
  };
}

function transferPerformanceCacheSet(key,value){
  transferPerformanceCache.delete(key);
  transferPerformanceCache.set(key,value);
  while(transferPerformanceCache.size>TRANSFER_PERFORMANCE_CACHE_LIMIT){
    transferPerformanceCache.delete(transferPerformanceCache.keys().next().value);
  }
}

function transferPerformanceStatus(text){
  const status=$('transferStatus');
  if(status) status.textContent=text;
}

function transferPerformanceAction(label,handler,{secondary=false}={}){
  return el('button',{
    type:'button',
    class:`btn${secondary?' ghost':''}`,
    onclick:handler
  },label);
}

function transferPerformanceRenderReady(snapshot,{message='Ready to calculate without blocking the rest of Teamsheet.'}={}){
  const out=$('transferOut');
  if(!out) return;
  transferPerformanceBusyDetail=null;
  out.setAttribute('aria-busy','false');
  const cached=transferPerformanceCache.get(snapshot.signature);
  if(cached){
    transferPerformanceRenderResult(cached.result,cached.context,{cached:true});
    return;
  }
  setChildren(out,
    transferPlannerContext(),
    el('div',{class:'note plain'},
      el('b',{},'Transfers is ready. '),
      message),
    el('div',{class:'transfer-actions'},
      transferPerformanceAction('Calculate transfers',()=>void transferPerformanceStart(snapshot))));
  transferPerformanceStatus('Ready. Calculation starts only when requested.');
}

function transferPerformancePreparingDetail(completed,total){
  const share=total>0?Math.min(100,Math.round(completed/total*100)):100;
  return `Preparing projections ${share}%.`;
}

function transferPerformanceSearchingDetail(progress=null){
  const depth=Math.max(0,Math.trunc(Number(progress?.depth)||0));
  const maxDepth=Math.max(0,Math.trunc(Number(progress?.maxDepth)||0));
  const evaluations=Math.max(0,Math.trunc(Number(progress?.evaluations)||0));
  if(!depth) return 'Evaluating legal transfer plans in the background.';
  const counted=evaluations?` · ${evaluations.toLocaleString('en-GB')} plans checked`:'';
  return `Evaluating legal transfer plans in the background. Depth ${depth}${maxDepth?` of ${maxDepth}`:''}${counted}.`;
}

// The busy panel is built once per calculation. Progress only rewrites one text node, so
// throttled worker updates cannot rebuild the workspace or fight the browser for the frame.
function transferPerformanceRenderBusy(detail){
  const out=$('transferOut');
  if(!out) return;
  out.setAttribute('aria-busy','true');
  if(transferPerformanceBusyDetail&&transferPerformanceBusyDetail.parentNode?.parentNode===out){
    if(transferPerformanceBusyDetail.textContent!==detail){
      transferPerformanceBusyDetail.textContent=detail;
      transferPerformanceStatus(detail);
    }
    return;
  }
  transferPerformanceBusyDetail=document.createTextNode(detail);
  setChildren(out,
    transferPlannerContext(),
    el('div',{class:'note plain'},el('b',{},'Calculating transfers. '),transferPerformanceBusyDetail),
    el('div',{class:'transfer-actions'},
      transferPerformanceAction('Cancel calculation',()=>transferPerformanceCancel('Calculation cancelled.'),{secondary:true})));
  transferPerformanceStatus(detail);
}

function transferPerformanceRenderError(title,detail){
  const out=$('transferOut');
  if(!out) return;
  transferPerformanceBusyDetail=null;
  out.setAttribute('aria-busy','false');
  transferPlannerBlocking(out,title,detail);
  transferPerformanceStatus('Transfer comparison unavailable.');
}

function transferPerformanceRenderResult(result,context,{cached=false}={}){
  const out=$('transferOut');
  if(!out) return;
  transferPerformanceBusyDetail=null;
  const {snapshot}=context;
  const {squad,horizon,assumptions,squadSignature}=snapshot;
  S.lastOptimiser={result,horizon,bank:assumptions.bankTenths,freeTransfers:assumptions.freeTransfers,startGW:S.nextGW,squadSignature};

  if(result.status==='invalid-input'){
    transferPerformanceRenderError('Squad cannot be compared.',`Fix the squad before continuing: ${(result.issues||[]).join(', ')}.`);
    return;
  }
  if(result.status==='projection-unavailable'){
    transferPerformanceRenderError('Projections are unavailable.','No transfer recommendation can be made from an unverified comparison.');
    return;
  }
  if(result.status==='search-incomplete'){
    transferPerformanceRenderError('Exact search did not complete.','No partial result is being presented as optimal. Try a shorter horizon.');
    return;
  }

  const plans=result.plans||[];
  const state=transferPlannerPresentationState(plans);
  const baseline=plans.find(plan=>Number(plan.transferCount)===0);
  if(!baseline){
    transferPerformanceRenderError('No zero-transfer baseline was returned.','Teamsheet will not present a transfer decision without its required comparison.');
    return;
  }

  const alternatives=plans.filter(plan=>Number(plan.transferCount)>0);
  const topAlternative=alternatives[0]||null;
  const optimiserSignature=decisionPreviewOptimiserSignature({
    squadSignature,
    horizon,
    bank:assumptions.bankTenths,
    freeTransfers:assumptions.freeTransfers,
    plans
  });
  const previewCleared=decisionPreviewSyncOptimiser(optimiserSignature);
  if(previewCleared) transferPlannerDispatchPreviewChange();
  const previewState=decisionPreviewSnapshot();
  const nodes=[
    transferPlannerContext(),
    transferPlannerDecisionHero(state,baseline,topAlternative,horizon),
    el('div',{class:'transfer-card-stack'},
      transferPlannerBaselineCard(baseline,{
        alternativesCount:alternatives.length,
        rankedFirst:state===TRANSFER_PRESENTATION_STATES.BASELINE_FIRST,
        primary:state===TRANSFER_PRESENTATION_STATES.BASELINE_FIRST||state===TRANSFER_PRESENTATION_STATES.BASELINE_ONLY
      }),
      topAlternative?transferPlannerPlanCard(topAlternative,{
        title:state===TRANSFER_PRESENTATION_STATES.TRANSFER_FIRST?'Highest-ranked transfer plan':'Best transfer alternative',
        index:plans.indexOf(topAlternative),
        squad,
        optimiserSignature,
        horizon,
        selected:Boolean(previewState.transfer)&&decisionPreviewPlanSignature(previewState.transfer)===decisionPreviewPlanSignature(topAlternative),
        primary:state===TRANSFER_PRESENTATION_STATES.TRANSFER_FIRST,
        pricingMode:result.pricingMode
      }):null)
  ];

  const otherAlternatives=alternatives.slice(1,4);
  if(otherAlternatives.length){
    nodes.push(el('details',{class:'transfer-alternatives'},
      el('summary',{},`Other legal options shown (${otherAlternatives.length} of ${Math.max(0,alternatives.length-1)})`),
      el('div',{class:'transfer-card-stack'},otherAlternatives.map(plan=>transferPlannerPlanCard(plan,{
        title:plan.hitCost?`${plan.transferCount}-transfer plan · ${plan.hitCost}-point hit`:`${plan.transferCount}-transfer plan`,
        index:plans.indexOf(plan),
        squad,
        optimiserSignature,
        horizon,
        selected:Boolean(previewState.transfer)&&decisionPreviewPlanSignature(previewState.transfer)===decisionPreviewPlanSignature(plan),
        primary:false,
        pricingMode:result.pricingMode
      })))));
  }

  nodes.push(
    el('div',{class:'transfer-actions'},
      transferPerformanceAction('Recalculate transfers',()=>{
        transferPerformanceCache.clear();
        void transferPerformanceStart(transferPerformanceSnapshot());
      },{secondary:true})),
    el('p',{class:'transfer-disclaimer'},
      'Net model comparison = best-XI projection change minus transfer hits plus the versioned free-transfer utility. It is not a promise of FPL points, and it excludes captain doubling and bench points. The interface shows the highest-ranked plan plus up to three additional alternatives.')
  );
  setChildren(out,nodes);
  out.setAttribute('aria-busy','false');
  transferPlannerRenderedControlSignature=transferPerformanceControlSignature();
  transferPerformanceStatus(cached?'Saved transfer comparison reused instantly.':'Transfer comparison updated.');
}

async function transferPerformanceScores(snapshot,token){
  const rows=[];
  let dataHash=2166136261;
  const total=snapshot.players.length;
  for(let start=0;start<total;start+=TRANSFER_PERFORMANCE_SCORE_BATCH){
    if(token!==transferPerformanceToken){
      const error=new Error('Cancelled');
      error.name='AbortError';
      throw error;
    }
    const end=Math.min(total,start+TRANSFER_PERFORMANCE_SCORE_BATCH);
    for(let index=start;index<end;index++){
      const player=snapshot.players[index];
      const scores=[];
      dataHash=transferPerformanceHash(`${player.id}|${player.team}|${player.element_type}|${player.now_cost}|${player.status}|${player.chance_of_playing_next_round}`,dataHash);
      for(let offset=0;offset<snapshot.horizon;offset++){
        const value=Number(xpOf(player,S.nextGW+offset,1).total);
        const safe=Number.isFinite(value)?value:0;
        scores.push(safe);
        dataHash=transferPerformanceHash(safe.toFixed(8),dataHash);
      }
      rows.push([Number(player.id),scores]);
    }
    transferPerformanceRenderBusy(transferPerformancePreparingDetail(end,total));
    await transferPerformanceYield();
  }
  return {rows,dataHash:dataHash.toString(16)};
}

function transferPerformanceCreateWorker(){
  if(typeof Worker!=='function'||typeof Blob!=='function'||!globalThis.URL?.createObjectURL)
    throw new Error('worker_unsupported');
  if(typeof TRANSFER_WORKER_MODEL_SOURCE!=='string'||!TRANSFER_WORKER_MODEL_SOURCE)
    throw new Error('worker_model_unavailable');
  const source=transferPerformanceWorkerSource(TRANSFER_WORKER_MODEL_SOURCE);
  const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
  try{
    return new Worker(url);
  }finally{
    URL.revokeObjectURL(url);
  }
}

async function transferPerformanceStart(initialSnapshot=transferPerformanceSnapshot()){
  if(initialSnapshot?.error){
    transferPerformanceRenderError(initialSnapshot.error[0],initialSnapshot.error[1]);
    return;
  }
  transferPerformanceCancel('',{render:false});
  const snapshot=initialSnapshot;
  const token=++transferPerformanceToken;
  transferPlannerClearPreview();
  void saveCfg();
  transferPerformanceRenderBusy(transferPerformancePreparingDetail(0,snapshot.players.length));

  try{
    const prepared=await transferPerformanceScores(snapshot,token);
    if(token!==transferPerformanceToken) return;
    const exactSignature=`${snapshot.signature}|${prepared.dataHash}`;
    const cached=transferPerformanceCache.get(exactSignature);
    if(cached){
      transferPerformanceCacheSet(snapshot.signature,cached);
      transferPerformanceRenderResult(cached.result,cached.context,{cached:true});
      return;
    }

    const worker=transferPerformanceCreateWorker();
    transferPerformanceWorker=worker;
    transferPerformanceRenderBusy(transferPerformanceSearchingDetail());
    const result=await new Promise((resolve,reject)=>{
      worker.onmessage=event=>{
        const payload=event.data||{};
        if(payload.requestId!==token||token!==transferPerformanceToken) return;
        if(payload.type==='progress'){ transferPerformanceRenderBusy(transferPerformanceSearchingDetail(payload)); return; }
        if(payload.type==='result') resolve(payload.result);
        else reject(new Error('worker_failed'));
      };
      worker.onerror=()=>reject(new Error('worker_failed'));
      worker.postMessage({type:'calculate',requestId:token,args:snapshot.args,scoreRows:prepared.rows});
    });
    if(token!==transferPerformanceToken) return;
    worker.terminate();
    transferPerformanceWorker=null;
    const context={snapshot,preparedAt:Date.now()};
    const record={result,context};
    transferPerformanceCacheSet(exactSignature,record);
    transferPerformanceCacheSet(snapshot.signature,record);
    transferPerformanceRenderResult(result,context);
  }catch(error){
    if(error?.name==='AbortError'||token!==transferPerformanceToken) return;
    transferPerformanceWorker?.terminate?.();
    transferPerformanceWorker=null;
    // Internal reasons stay out of the interface. Teamsheet fails closed and never falls
    // back to a blocking main-thread search.
    transferPerformanceRenderError('Transfers could not be calculated.',TRANSFER_PERFORMANCE_UNAVAILABLE);
  }
}

function transferPerformanceCancel(message='Calculation cancelled.',{render=true}={}){
  transferPerformanceToken++;
  transferPerformanceWorker?.terminate?.();
  transferPerformanceWorker=null;
  if(render&&transferPerformanceCurrentRoute()==='#/transfers'){
    const snapshot=transferPerformanceSnapshot();
    if(snapshot.error) transferPerformanceRenderError(snapshot.error[0],snapshot.error[1]);
    else transferPerformanceRenderReady(snapshot,{message});
  }
}

// The only Transfers renderer. Opening the route paints the workspace shell and, when an
// exact earlier result is still valid, restores it. It never enters the optimiser.
function renderTransfers(){
  const out=$('transferOut');
  if(!out) return;
  renderRouteDataWarning('transferDataWarning',{showUnavailable:false});
  transferPlannerSyncVisibleAssumptions();
  transferPlannerRenderedControlSignature=transferPerformanceControlSignature();
  const snapshot=transferPerformanceSnapshot();
  if(snapshot.error){
    transferPerformanceRenderError(snapshot.error[0],snapshot.error[1]);
    return;
  }
  transferPerformanceRenderReady(snapshot);
}

function installTransferPerformanceRuntime(){
  if(transferPerformanceInstalled||typeof document==='undefined') return;
  transferPerformanceInstalled=true;

  document.addEventListener('teamsheet:before-route-change',event=>{
    if(event?.detail?.from==='#/transfers'&&event?.detail?.to!=='#/transfers')
      transferPerformanceCancel('',{render:false});
  });
  document.addEventListener('teamsheet:data-rendered',()=>{
    transferPerformanceDataVersion++;
    transferPerformanceCache.clear();
    transferPerformanceCancel('',{render:false});
    if(transferPerformanceCurrentRoute()==='#/transfers') renderTransfers();
  });
}

installTransferPerformanceRuntime();

export {
  TRANSFER_PERFORMANCE_CACHE_LIMIT,
  TRANSFER_PERFORMANCE_SCORE_BATCH,
  TRANSFER_PERFORMANCE_PROGRESS_MS,
  TRANSFER_PERFORMANCE_UNAVAILABLE,
  transferPerformanceWorkerSource,
  transferPerformanceHash,
  transferPerformanceWorkerPlayer,
  transferPerformancePreparingDetail,
  transferPerformanceSearchingDetail,
  transferPerformanceSnapshot,
  transferPerformanceStart,
  transferPerformanceCancel,
  installTransferPerformanceRuntime,
  renderTransfers
};
