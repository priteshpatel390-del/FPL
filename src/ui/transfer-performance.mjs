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
const TRANSFER_PERFORMANCE_INPUT_IDS = new Set(['ftCount','bankIn','trFtCount','trBankIn','trHorizon','trTop','useManual']);
const transferPerformanceCache = new Map();
let transferPerformanceWorker = null;
let transferPerformanceToken = 0;
let transferPerformanceDataVersion = 0;
let transferPerformanceInstalled = false;
let transferPerformanceBusyDetail = null;
let transferPerformanceActive = null;
let transferPerformanceCancelledSignature = '';
let transferPerformanceFailure = null;
let transferPerformanceAutoTimer = null;

// The worker runs the reviewed transfer model verbatim. Nothing rewrites, patches or
// re-derives the optimiser at runtime.
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
  return `"use strict";\nconst TRANSFER_RULES=${JSON.stringify(rules)};\n${source}\n${TRANSFER_PERFORMANCE_WORKER_HANDLER}`;
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
function transferPerformanceVisible(){ return transferPerformanceCurrentRoute()==='#/transfers'; }

function transferPerformanceYield(){
  return new Promise(resolve=>{
    if(typeof globalThis.requestAnimationFrame==='function') globalThis.requestAnimationFrame(()=>resolve());
    else globalThis.setTimeout?.(resolve,0);
  });
}

function transferPerformanceAbortError(){
  const error=new Error('Cancelled');
  error.name='AbortError';
  return error;
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
  while(transferPerformanceCache.size>TRANSFER_PERFORMANCE_CACHE_LIMIT)
    transferPerformanceCache.delete(transferPerformanceCache.keys().next().value);
}

function transferPerformanceStatus(text){
  const status=$('transferStatus');
  if(status) status.textContent=text;
}

function transferPerformanceAction(label,handler,{secondary=false}={}){
  return el('button',{type:'button',class:`btn${secondary?' ghost':''}`,onclick:handler},label);
}

function transferPerformancePreparingDetail(completed,total){
  const share=total>0?Math.min(100,Math.round(completed/total*100)):100;
  return `Preparing projections ${share}%.`;
}

function transferPerformanceSearchingDetail(progress=null){
  const depth=Math.max(0,Math.trunc(Number(progress?.depth)||0));
  const evaluations=Math.max(0,Math.trunc(Number(progress?.evaluations)||0));
  if(!evaluations) return 'Checking exact transfer plans in the background.';
  const scope=depth?` · up to ${depth} transfer${depth===1?'':'s'}`:'';
  return `Checking exact transfer plans in the background. ${evaluations.toLocaleString('en-GB')} complete plans verified${scope}.`;
}

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
    el('div',{class:'note plain'},el('b',{},'Updating transfer advice. '),transferPerformanceBusyDetail),
    el('div',{class:'transfer-actions'},
      transferPerformanceAction('Cancel calculation',()=>transferPerformanceCancel('Calculation cancelled.',{explicit:true}),{secondary:true})));
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

function transferPerformanceRenderCancelled(snapshot,message='Calculation cancelled.'){
  const out=$('transferOut');
  if(!out) return;
  transferPerformanceBusyDetail=null;
  out.setAttribute('aria-busy','false');
  setChildren(out,
    transferPlannerContext(),
    el('div',{class:'note plain'},el('b',{},'Transfer calculation paused. '),message),
    el('div',{class:'transfer-actions'},
      transferPerformanceAction('Resume calculation',()=>{
        transferPerformanceCancelledSignature='';
        void transferPerformanceStart(snapshot,{force:true});
      })));
  transferPerformanceStatus('Transfer calculation paused.');
}

function transferPerformanceRenderFailure(snapshot){
  const out=$('transferOut');
  if(!out) return;
  transferPerformanceBusyDetail=null;
  out.setAttribute('aria-busy','false');
  setChildren(out,
    transferPlannerContext(),
    el('div',{class:'note bad',role:'alert'},el('b',{},'Transfers could not be calculated. '),TRANSFER_PERFORMANCE_UNAVAILABLE),
    el('div',{class:'transfer-actions'},
      transferPerformanceAction('Retry',()=>{
        transferPerformanceFailure=null;
        void transferPerformanceStart(snapshot,{force:true});
      })));
  transferPerformanceStatus('Transfer comparison unavailable.');
}

function transferPerformanceResultBaseline(result={}){
  const baseline=result?.baseline;
  if(!baseline||Number(baseline.transferCount)!==0) return null;
  if(!Array.isArray(baseline.transfers)||baseline.transfers.length!==0) return null;
  return baseline;
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
    transferPerformanceRenderError('Exact search did not complete.','No partial result is being presented as optimal.');
    return;
  }

  const rankedPlans=Array.isArray(result.plans)?result.plans:[];
  const baseline=transferPerformanceResultBaseline(result);
  if(!baseline){
    transferPerformanceRenderError('No zero-transfer baseline was returned.','Teamsheet will not present a transfer decision without its required comparison.');
    return;
  }
  const plans=rankedPlans.some(plan=>Number(plan?.transferCount)===0)
    ? rankedPlans.map(plan=>Number(plan?.transferCount)===0?baseline:plan)
    : [...rankedPlans,baseline];
  const state=transferPlannerPresentationState(plans);
  const alternatives=rankedPlans.filter(plan=>Number(plan?.transferCount)>0);
  const topAlternative=alternatives[0]||null;
  const optimiserSignature=decisionPreviewOptimiserSignature({
    squadSignature,horizon,bank:assumptions.bankTenths,freeTransfers:assumptions.freeTransfers,plans
  });
  const event=S.boot?.events?.find(row=>Number(row.id)===Number(S.nextGW));
  if(event?.deadline_time&&globalThis.DI3_PARITY_RUNTIME){const deadline=new Date(event.deadline_time).toISOString();void globalThis.DI3_PARITY_RUNTIME.recordTransfer({basis:{season:FPL_RULES.season,gameweek:S.nextGW,eventId:S.nextGW,deadline,evaluationCutoff:deadline,sourceCommit:BUILD_INFO.commit,modelVersion:BUILD_INFO.modelVersion,rulesVersion:BUILD_INFO.rulesVersion,squadHash:`squad:${squad.map(slot=>Number(slot.p.id)).sort((a,b)=>a-b).join(',')}`,bank:assumptions.bankTenths,freeTransfers:assumptions.freeTransfers,priceBasis:result.pricingMode},result,horizon,startGameweek:S.nextGW});}
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
        index:plans.indexOf(topAlternative),squad,optimiserSignature,horizon,
        selected:Boolean(previewState.transfer)&&decisionPreviewPlanSignature(previewState.transfer)===decisionPreviewPlanSignature(topAlternative),
        primary:state===TRANSFER_PRESENTATION_STATES.TRANSFER_FIRST,pricingMode:result.pricingMode
      }):null)
  ];

  const otherAlternatives=alternatives.slice(1,4);
  if(otherAlternatives.length){
    nodes.push(el('details',{class:'transfer-alternatives'},
      el('summary',{},`Other legal options shown (${otherAlternatives.length} of ${Math.max(0,alternatives.length-1)})`),
      el('div',{class:'transfer-card-stack'},otherAlternatives.map(plan=>transferPlannerPlanCard(plan,{
        title:plan.hitCost?`${plan.transferCount}-transfer plan · ${plan.hitCost}-point hit`:`${plan.transferCount}-transfer plan`,
        index:plans.indexOf(plan),squad,optimiserSignature,horizon,
        selected:Boolean(previewState.transfer)&&decisionPreviewPlanSignature(previewState.transfer)===decisionPreviewPlanSignature(plan),
        primary:false,pricingMode:result.pricingMode
      })))));
  }

  nodes.push(el('p',{class:'transfer-disclaimer'},
    'Net model comparison = best-XI projection change minus transfer hits plus the versioned free-transfer utility. It is not a promise of FPL points, and it excludes captain doubling and bench points. The interface shows the highest-ranked plan plus up to three additional alternatives.'));
  setChildren(out,nodes);
  out.setAttribute('aria-busy','false');
  transferPlannerRenderedControlSignature=transferPerformanceControlSignature();
  transferPerformanceStatus(cached?'Saved transfer comparison reused instantly.':'Transfer comparison updated.');
}

function transferPerformanceUpdateBusy(detail){
  if(transferPerformanceActive) transferPerformanceActive.detail=detail;
  if(transferPerformanceVisible()) transferPerformanceRenderBusy(detail);
}

async function transferPerformanceScores(snapshot,token){
  const rows=[];
  let dataHash=2166136261;
  const total=snapshot.players.length;
  for(let start=0;start<total;start+=TRANSFER_PERFORMANCE_SCORE_BATCH){
    if(token!==transferPerformanceToken) throw transferPerformanceAbortError();
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
    transferPerformanceUpdateBusy(transferPerformancePreparingDetail(end,total));
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
  try{ return new Worker(url); }
  finally{ URL.revokeObjectURL(url); }
}

/* Pre-GW1 unlimited-change guard.

   While the guard owns the Transfers screen no optimiser work may run, no cached or paused
   result may be repainted, and no previewed transfer plan may survive on the Team pitch.
   Suspension is idempotent, so every guarded entry point can call it safely. */
function transferPerformanceInitialSquadSuspend(){
  if(transferPerformanceAutoTimer!=null){
    globalThis.clearTimeout?.(transferPerformanceAutoTimer);
    transferPerformanceAutoTimer=null;
  }
  if(transferPerformanceActive) transferPerformanceCancel('',{render:false,explicit:false});
  transferPerformanceCache.clear();
  transferPerformanceCancelledSignature='';
  transferPerformanceFailure=null;
  transferPerformanceBusyDetail=null;
  S.lastOptimiser=null;
  transferPlannerRenderedControlSignature=null;
  transferPlannerClearPreview();
}

function transferPerformanceRenderInitialSquad(windowState){
  const out=$('transferOut');
  if(!out) return;
  transferPlannerSetAssumptionsVisible(false);
  out.setAttribute('aria-busy','false');
  setChildren(out,
    transferPlannerContext(),
    transferPlannerInitialSquadNotice(windowState),
    transferPlannerInitialSquadGuidance());
  transferPerformanceStatus(`Unlimited squad changes until the GW${INITIAL_SQUAD_WINDOW_GAMEWEEK} deadline. No transfer comparison applies yet.`);
}

// Returns the guard window when it owns the screen, having already suspended background work.
function transferPerformanceInitialSquadClaim({render=transferPerformanceVisible()}={}){
  const windowState=initialSquadWindow();
  if(!windowState.active) return null;
  transferPerformanceInitialSquadSuspend();
  if(render) transferPerformanceRenderInitialSquad(windowState);
  return windowState;
}

async function transferPerformanceStart(initialSnapshot=transferPerformanceSnapshot(),{force=false}={}){
  if(transferPerformanceInitialSquadClaim()) return;
  if(initialSnapshot?.error){
    if(transferPerformanceVisible()) transferPerformanceRenderError(initialSnapshot.error[0],initialSnapshot.error[1]);
    return;
  }
  const snapshot=initialSnapshot;
  const cached=transferPerformanceCache.get(snapshot.signature);
  if(cached&&!force){
    transferPerformanceRenderResult(cached.result,cached.context,{cached:true});
    return cached.result;
  }
  if(transferPerformanceActive?.signature===snapshot.signature&&!force){
    if(transferPerformanceVisible()) transferPerformanceRenderBusy(transferPerformanceActive.detail);
    return transferPerformanceActive.promise;
  }
  transferPerformanceCancel('',{render:false,explicit:false});
  transferPerformanceCancelledSignature='';
  transferPerformanceFailure=null;
  const token=++transferPerformanceToken;
  transferPlannerClearPreview();
  void saveCfg();
  const detail=transferPerformancePreparingDetail(0,snapshot.players.length);
  transferPerformanceActive={signature:snapshot.signature,detail,promise:null,token,cancel:null};
  transferPerformanceUpdateBusy(detail);

  const promise=(async()=>{
    try{
      const prepared=await transferPerformanceScores(snapshot,token);
      if(token!==transferPerformanceToken) return;
      const exactSignature=`${snapshot.signature}|${prepared.dataHash}`;
      const exactCached=transferPerformanceCache.get(exactSignature);
      if(exactCached){
        transferPerformanceActive=null;
        transferPerformanceCacheSet(snapshot.signature,exactCached);
        transferPerformanceRenderResult(exactCached.result,exactCached.context,{cached:true});
        return exactCached.result;
      }

      const worker=transferPerformanceCreateWorker();
      transferPerformanceWorker=worker;
      transferPerformanceUpdateBusy(transferPerformanceSearchingDetail());
      const result=await new Promise((resolve,reject)=>{
        let settled=false;
        const settle=(callback,value)=>{
          if(settled) return;
          settled=true;
          if(transferPerformanceActive?.token===token) transferPerformanceActive.cancel=null;
          callback(value);
        };
        const cancel=()=>settle(reject,transferPerformanceAbortError());
        if(transferPerformanceActive?.token===token) transferPerformanceActive.cancel=cancel;
        else { cancel(); return; }
        worker.onmessage=event=>{
          const payload=event.data||{};
          if(payload.requestId!==token||token!==transferPerformanceToken) return;
          if(payload.type==='progress'){
            transferPerformanceUpdateBusy(transferPerformanceSearchingDetail(payload));
            return;
          }
          if(payload.type==='result') settle(resolve,payload.result);
          else settle(reject,new Error('worker_failed'));
        };
        worker.onerror=()=>settle(reject,new Error('worker_failed'));
        worker.postMessage({type:'calculate',requestId:token,args:snapshot.args,scoreRows:prepared.rows});
      });
      if(token!==transferPerformanceToken) return;
      worker.terminate();
      transferPerformanceWorker=null;
      transferPerformanceActive=null;
      const context={snapshot,preparedAt:Date.now()};
      const record={result,context};
      transferPerformanceCacheSet(exactSignature,record);
      transferPerformanceCacheSet(snapshot.signature,record);
      transferPerformanceRenderResult(result,context);
      return result;
    }catch(error){
      if(error?.name==='AbortError'||token!==transferPerformanceToken) return;
      transferPerformanceWorker?.terminate?.();
      transferPerformanceWorker=null;
      transferPerformanceActive=null;
      transferPerformanceFailure={signature:snapshot.signature};
      if(transferPerformanceVisible()) transferPerformanceRenderFailure(snapshot);
    }
  })();
  transferPerformanceActive.promise=promise;
  return promise;
}

function transferPerformanceCancel(message='Calculation cancelled.',{render=true,explicit=false}={}){
  const active=transferPerformanceActive;
  const activeSignature=active?.signature||transferPerformanceSnapshot()?.signature||'';
  transferPerformanceToken++;
  active?.cancel?.();
  transferPerformanceWorker?.terminate?.();
  transferPerformanceWorker=null;
  transferPerformanceActive=null;
  if(explicit) transferPerformanceCancelledSignature=activeSignature;
  if(render&&transferPerformanceVisible()){
    const snapshot=transferPerformanceSnapshot();
    if(snapshot.error) transferPerformanceRenderError(snapshot.error[0],snapshot.error[1]);
    else if(explicit) transferPerformanceRenderCancelled(snapshot,message);
  }
}

function transferPerformanceEnsure(snapshot=transferPerformanceSnapshot()){
  if(transferPerformanceInitialSquadClaim({render:true})) return;
  if(snapshot.error){
    if(transferPerformanceActive) transferPerformanceCancel('',{render:false,explicit:false});
    if(transferPerformanceVisible()) transferPerformanceRenderError(snapshot.error[0],snapshot.error[1]);
    return;
  }
  const cached=transferPerformanceCache.get(snapshot.signature);
  if(cached){ transferPerformanceRenderResult(cached.result,cached.context,{cached:true}); return; }
  if(transferPerformanceActive?.signature===snapshot.signature){
    transferPerformanceRenderBusy(transferPerformanceActive.detail); return;
  }
  if(transferPerformanceCancelledSignature===snapshot.signature){
    transferPerformanceRenderCancelled(snapshot); return;
  }
  if(transferPerformanceFailure?.signature===snapshot.signature){
    transferPerformanceRenderFailure(snapshot); return;
  }
  transferPerformanceRenderBusy(transferPerformancePreparingDetail(0,snapshot.players.length));
  void transferPerformanceStart(snapshot);
}

function transferPerformanceScheduleAuto(){
  if(transferPerformanceAutoTimer!=null) globalThis.clearTimeout?.(transferPerformanceAutoTimer);
  transferPerformanceAutoTimer=globalThis.setTimeout?.(()=>{
    transferPerformanceAutoTimer=null;
    if(transferPerformanceInitialSquadClaim()) return;
    const snapshot=transferPerformanceSnapshot();
    if(snapshot.error){
      if(transferPerformanceActive) transferPerformanceCancel('',{render:false,explicit:false});
      if(transferPerformanceVisible()) transferPerformanceRenderError(snapshot.error[0],snapshot.error[1]);
      return;
    }
    if(transferPerformanceCancelledSignature===snapshot.signature||transferPerformanceFailure?.signature===snapshot.signature){
      if(transferPerformanceVisible()) transferPerformanceEnsure(snapshot);
      return;
    }
    void transferPerformanceStart(snapshot);
  },0);
}

function renderTransfers(){
  const out=$('transferOut');
  if(!out) return;
  renderRouteDataWarning('transferDataWarning',{showUnavailable:false});
  if(transferPerformanceInitialSquadClaim({render:true})) return;
  transferPlannerSetAssumptionsVisible(true);
  transferPlannerSyncVisibleAssumptions();
  transferPlannerRenderedControlSignature=transferPerformanceControlSignature();
  transferPerformanceEnsure(transferPerformanceSnapshot());
}

function installTransferPerformanceRuntime(){
  if(transferPerformanceInstalled||typeof document==='undefined') return;
  transferPerformanceInstalled=true;

  document.addEventListener('teamsheet:route-change',event=>{
    if(event?.detail?.route==='#/transfers') renderTransfers();
  });
  document.addEventListener('teamsheet:data-rendered',()=>{
    transferPerformanceDataVersion++;
    transferPerformanceCache.clear();
    transferPerformanceCancelledSignature='';
    transferPerformanceFailure=null;
    transferPerformanceCancel('',{render:false,explicit:false});
    transferPerformanceScheduleAuto();
  });
  const scheduleFromInput=event=>{
    if(TRANSFER_PERFORMANCE_INPUT_IDS.has(String(event?.target?.id||''))) transferPerformanceScheduleAuto();
  };
  document.addEventListener('input',scheduleFromInput);
  document.addEventListener('change',scheduleFromInput);
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
  transferPerformanceInitialSquadSuspend,
  transferPerformanceRenderInitialSquad,
  transferPerformanceInitialSquadClaim,
  transferPerformanceStart,
  transferPerformanceCancel,
  transferPerformanceScheduleAuto,
  installTransferPerformanceRuntime,
  renderTransfers
};
