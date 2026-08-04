import { S } from '../state.mjs';
import { $, el, setChildren } from '../util.mjs';
import { xpOf } from '../model/xp.mjs';
import { mySquad } from '../squad.mjs';
import { optimiseTransfers } from '../model/transfers.mjs';
import { saveCfg } from '../storage.mjs';
import { renderRouteDataWarning } from './data-warning.mjs';
import {
  decisionPreviewSquadSignature,
  decisionPreviewPlanSignature,
  decisionPreviewOptimiserSignature,
  decisionPreviewSnapshot,
  decisionPreviewSyncOptimiser,
  decisionPreviewSelectTransfer,
  decisionPreviewClearTransfer
} from './decision-preview.mjs';

const TRANSFER_PLANNER_COMMITTED_CONTROL_IDS = Object.freeze(['trFtCount','trBankIn','trHorizon','trTop']);
const TRANSFER_PRESENTATION_STATES = Object.freeze({
  TRANSFER_FIRST:'transfer-first',
  BASELINE_FIRST:'baseline-first',
  BASELINE_ONLY:'baseline-only',
  UNAVAILABLE:'unavailable'
});
let transferPlannerRenderedControlSignature = null;

function transferPlannerControlSignature(...values){
  return values.map(value=>String(value ?? '')).join('|');
}

function transferPlannerCurrentControlSignature(){
  return transferPlannerControlSignature(
    $('trFtCount')?.value,
    $('trBankIn')?.value,
    $('trHorizon')?.value,
    $('trTop')?.value
  );
}

function transferPlannerRefreshRequired(renderedSignature,currentSignature){
  return renderedSignature!==currentSignature;
}

function transferPlannerHasActivePreview(preview={}){
  return Boolean(preview.transfer||preview.captainId!=null||preview.viceId!=null||preview.selectionMode!=null);
}

function transferPlannerDispatchPreviewChange(){
  if(typeof document!=='undefined') document.dispatchEvent(new CustomEvent('teamsheet:preview-change'));
}

function transferPlannerReadAssumptions(ftRaw,bankRaw){
  const issues=[];
  const ftText=String(ftRaw ?? '').trim();
  const bankText=String(bankRaw ?? '').trim();
  const ft=Number(ftText);
  const bankMillions=Number(bankText);

  if(!ftText) issues.push('Enter your current free transfers.');
  else if(!Number.isInteger(ft)||ft<0||ft>5) issues.push('Free transfers must be a whole number from 0 to 5.');

  if(!bankText) issues.push('Enter your bank balance.');
  else if(!Number.isFinite(bankMillions)||bankMillions<0) issues.push('Bank must be a non-negative amount.');
  else if(Math.abs(bankMillions*10-Math.round(bankMillions*10))>1e-8) issues.push('Bank must use £0.1m steps.');

  return {
    valid:issues.length===0,
    issues,
    freeTransfers:Number.isInteger(ft)&&ft>=0&&ft<=5?ft:null,
    bankMillions:Number.isFinite(bankMillions)&&bankMillions>=0?bankMillions:null,
    bankTenths:Number.isFinite(bankMillions)&&bankMillions>=0?Math.round(bankMillions*10):null
  };
}

function transferPlannerPresentationState(plans=[]){
  const source=Array.isArray(plans)?plans:[];
  const baseline=source.find(plan=>Number(plan?.transferCount)===0);
  if(!baseline) return TRANSFER_PRESENTATION_STATES.UNAVAILABLE;
  const alternatives=source.filter(plan=>Number(plan?.transferCount)>0);
  if(!alternatives.length) return TRANSFER_PRESENTATION_STATES.BASELINE_ONLY;
  return Number(source[0]?.transferCount)===0
    ? TRANSFER_PRESENTATION_STATES.BASELINE_FIRST
    : TRANSFER_PRESENTATION_STATES.TRANSFER_FIRST;
}

function transferPlannerNoTransferCopy(baseline={},alternativesCount=0,rankedFirst=false){
  const before=Math.max(0,Math.trunc(Number(baseline.freeTransfersBefore)||0));
  const next=Math.max(0,Math.trunc(Number(baseline.freeTransfersNextGW)||0));
  let ftEffect=`Keep ${next} free transfer${next===1?'':'s'} for next Gameweek.`;
  if(before>=5&&next>=5) ftEffect='No additional free transfer rolls while you are at the 5 FT cap.';
  else if(next>before&&before>0) ftEffect=`Roll one FT and move to ${next} free transfers next Gameweek.`;
  else if(next>before) ftEffect=`Make no transfer and move to ${next} free transfer${next===1?'':'s'} next Gameweek.`;

  let comparison='This is the required zero-transfer comparison.';
  if(alternativesCount===0)
    comparison='No comparable legal transfer plan was returned, so this is not evidence that making no transfer is optimal.';
  else if(rankedFirst)
    comparison='This baseline ranks above every returned legal 1–3 transfer plan under the current assumptions.';
  else
    comparison='This is the benchmark used to judge every returned transfer plan.';

  return {headline:'Make no transfer',ftEffect,comparison};
}

function transferPlannerNetLabel(value){
  const n=Number(value)||0;
  if(Math.abs(n)<0.05) return 'Level net model comparison';
  return `${n>0?'+':'−'}${Math.abs(n).toFixed(1)} net model ${n>0?'advantage':'disadvantage'}`;
}

function transferPlannerPlanNames(plan={},byId={}){
  return (plan.transfers||[]).map(move=>({
    outName:byId[move.outPlayerId]?.web_name||String(move.outPlayerId),
    inName:byId[move.inPlayerId]?.web_name||String(move.inPlayerId),
    outPlayerId:Number(move.outPlayerId),
    inPlayerId:Number(move.inPlayerId)
  }));
}

function transferPlannerFormatDeadline(){
  const event=S.boot?.events?.find(item=>Number(item.id)===Number(S.nextGW));
  if(!event?.deadline_time) return `GW${S.nextGW||'—'} deadline unavailable`;
  const deadline=new Date(event.deadline_time);
  const hours=(deadline-Date.now())/3600000;
  const stamp=deadline.toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  if(hours<0) return `${stamp} · passed`;
  if(hours<48) return `${stamp} · ${Math.floor(hours)}h ${Math.max(0,Math.floor((hours%1)*60))}m`;
  return `${stamp} · ${Math.floor(hours/24)}d`;
}

function transferPlannerSourceLabel(){
  if(S.cachedAt) return 'Verified saved FPL data';
  if(S.source) return `FPL ${S.source}`;
  return 'Verified FPL data';
}

function transferPlannerMoveList(plan){
  const moves=transferPlannerPlanNames(plan,S.byId);
  return el('div',{class:'transfer-moves'},moves.map(move=>
    el('div',{class:'transfer-move'},
      el('div',{class:'transfer-player transfer-player-out'},el('span',{class:'transfer-kicker'},'Out'),el('strong',{},move.outName)),
      el('span',{class:'transfer-arrow','aria-hidden':'true'},'→'),
      el('div',{class:'transfer-player transfer-player-in'},el('span',{class:'transfer-kicker'},'In'),el('strong',{},move.inName))
    )));
}

function transferPlannerMetric(label,value,meta=''){
  return el('div',{class:'transfer-metric'},
    el('span',{class:'transfer-metric-label'},label),
    el('strong',{},value),
    meta?el('span',{class:'transfer-metric-meta'},meta):null);
}

function transferPlannerPlanContext(plan,horizon){
  const first=plan.perGameweekBestXI?.[0];
  if(!first) return 'Next-Gameweek XI consequence unavailable.';
  const incoming=new Set((plan.transfers||[]).map(move=>Number(move.inPlayerId)));
  const firstIds=(first.playerIds||[]).map(Number);
  const starters=firstIds.filter(id=>incoming.has(id)).map(id=>S.byId[id]?.web_name||String(id));
  const benched=[...incoming].filter(id=>!firstIds.includes(id)).map(id=>S.byId[id]?.web_name||String(id));
  const parts=[`GW${first.gw} formation ${first.formation}`];
  if(starters.length) parts.push(`${starters.join(', ')} projected in the XI`);
  if(benched.length) parts.push(`${benched.join(', ')} projected on the bench`);
  parts.push(`the ${horizon}-GW comparison does not include captain doubling or bench points`);
  return parts.join(' · ');
}

function transferPlannerCautions(plan,pricingMode){
  const cautions=[];
  if(pricingMode==='estimated') cautions.push('Affordability is estimated because verified purchase prices are unavailable. Confirm the move inside FPL.');
  else cautions.push('Affordability uses the recorded squad purchase prices.');
  (plan?.warnings||[]).forEach(warning=>cautions.push(warning));
  if(!(plan?.warnings||[]).length) cautions.push('No incoming availability warning was returned; still check the latest team news before confirming.');
  return cautions;
}

function transferPlannerDetails(plan,horizon){
  const rollAdjustment=(Number(plan.rollDifference)||0)*0.5;
  return el('details',{class:'transfer-details'},
    el('summary',{},'Review details'),
    el('div',{class:'transfer-details-body'},
      el('div',{class:'transfer-metrics'},
        transferPlannerMetric('Gross XI gain',`${Number(plan.grossGain)>=0?'+':''}${Number(plan.grossGain||0).toFixed(1)}`,'Best legal XI across the selected horizon'),
        transferPlannerMetric('Hit',`−${Number(plan.hitCost)||0}`,'Actual FPL transfer deduction'),
        transferPlannerMetric('FT adjustment',`${rollAdjustment>=0?'+':''}${rollAdjustment.toFixed(1)}`,'Decision utility, not an FPL score'),
        transferPlannerMetric('Net comparison',`${Number(plan.netGain)>=0?'+':''}${Number(plan.netGain||0).toFixed(1)}`,'Gross gain minus hit plus FT utility')),
      el('p',{class:'transfer-explainer'},transferPlannerPlanContext(plan,horizon))));
}

function transferPlannerPreviewButton(plan,index,squad,optimiserSignature,horizon,selected){
  return el('button',{
    type:'button',
    class:`btn transfer-preview-action${selected?' selected':''}`,
    'aria-label':`Preview transfer plan ${index+1} on the Team pitch`,
    onclick:()=>{
      decisionPreviewSelectTransfer({...plan,previewHorizon:horizon},squad,optimiserSignature);
      transferPlannerDispatchPreviewChange();
      globalThis.__teamsheetNavigate?.('#/team');
    }
  },selected?'Previewing on Team':'Preview on Team');
}

function transferPlannerPlanCard(plan,{title,index,squad,optimiserSignature,horizon,selected,primary=false,pricingMode='exact'}){
  const moves=transferPlannerPlanNames(plan,S.byId);
  const cautionItems=transferPlannerCautions(plan,pricingMode);
  return el('article',{class:`transfer-card transfer-plan-card${primary?' primary':''}`},
    el('div',{class:'transfer-card-head'},
      el('div',{},el('span',{class:'eyebrow'},title),el('h3',{},moves.map(move=>`${move.outName} → ${move.inName}`).join(' · '))),
      el('span',{class:'transfer-rank'},`#${index+1}`)),
    transferPlannerMoveList(plan),
    el('div',{class:'transfer-metrics transfer-metrics-summary'},
      transferPlannerMetric('Net model comparison',`${Number(plan.netGain)>=0?'+':''}${Number(plan.netGain||0).toFixed(1)}`,`vs no transfer over ${horizon} GW${horizon===1?'':'s'}`),
      transferPlannerMetric('Hit',`−${Number(plan.hitCost)||0}`,plan.hitCost?'Paid transfer cost':'No points deduction'),
      transferPlannerMetric('Bank after',`£${(Number(plan.bankAfter||0)/10).toFixed(1)}m`),
      transferPlannerMetric('Next GW',`${Number(plan.freeTransfersNextGW)||0} FT`)),
    el('p',{class:'transfer-why'},el('b',{},'Why shown: '),primary
      ? 'Highest net comparison returned under these planning assumptions.'
      : 'Next highest returned legal option under these planning assumptions.'),
    el('div',{class:'transfer-caution'},
      el('strong',{},'Known cautions'),
      el('ul',{},cautionItems.map(item=>el('li',{},item)))),
    transferPlannerDetails(plan,horizon),
    el('div',{class:'transfer-actions'},
      transferPlannerPreviewButton(plan,index,squad,optimiserSignature,horizon,selected)));
}

function transferPlannerBaselineCard(baseline,{alternativesCount,rankedFirst,primary=false}){
  const copy=transferPlannerNoTransferCopy(baseline,alternativesCount,rankedFirst);
  return el('article',{class:`transfer-card transfer-baseline-card${primary?' primary':''}`},
    el('span',{class:'eyebrow'},rankedFirst?'Highest-ranked decision':'Required comparison'),
    el('h3',{},copy.headline),
    el('p',{class:'transfer-card-lead'},copy.comparison),
    el('div',{class:'transfer-metrics transfer-metrics-summary'},
      transferPlannerMetric('Net comparison','0.0','The benchmark'),
      transferPlannerMetric('Hit','−0','No points deduction'),
      transferPlannerMetric('Bank after',`£${(Number(baseline.bankAfter||0)/10).toFixed(1)}m`),
      transferPlannerMetric('Next GW',`${Number(baseline.freeTransfersNextGW)||0} FT`)),
    el('p',{class:'transfer-ft-effect'},copy.ftEffect));
}

function transferPlannerDecisionHero(state,baseline,topAlternative,horizon){
  let eyebrow='Decision status',title='No verified comparison',detail='Teamsheet cannot rank a transfer decision yet.',metric='—',hit='—';
  if(state===TRANSFER_PRESENTATION_STATES.TRANSFER_FIRST&&topAlternative){
    const moves=transferPlannerPlanNames(topAlternative,S.byId);
    eyebrow='Highest-ranked decision';
    title=moves.map(move=>`${move.outName} → ${move.inName}`).join(' · ');
    detail='This transfer plan ranks above making no transfer under the current assumptions.';
    metric=transferPlannerNetLabel(topAlternative.netGain);
    hit=`${Number(topAlternative.hitCost)||0}-point hit`;
  }else if(state===TRANSFER_PRESENTATION_STATES.BASELINE_FIRST){
    eyebrow='Highest-ranked decision';
    title='Make no transfer';
    detail='The zero-transfer baseline ranks above the returned legal transfer plans.';
    metric='Baseline ranks first';
    hit='No hit';
  }else if(state===TRANSFER_PRESENTATION_STATES.BASELINE_ONLY){
    eyebrow='Comparison incomplete';
    title='Make no transfer is the only legal comparison';
    detail='No transfer alternative was returned, so Teamsheet is not calling this optimal.';
    metric='Baseline only';
    hit='No hit';
  }
  return el('section',{class:`transfer-decision-hero state-${state}`,'aria-labelledby':'transferDecisionTitle'},
    el('span',{class:'eyebrow'},eyebrow),
    el('h3',{id:'transferDecisionTitle'},title),
    el('p',{},detail),
    el('div',{class:'transfer-hero-facts'},
      el('span',{},metric),
      el('span',{},hit),
      el('span',{},`${horizon} GW${horizon===1?'':'s'}`)));
}

function transferPlannerContext(){
  return el('div',{class:'transfer-context-chips','aria-label':'Transfer comparison context'},
    el('span',{class:'transfer-context-chip'},`GW${S.nextGW||'—'}`),
    el('span',{class:'transfer-context-chip deadline'},transferPlannerFormatDeadline()),
    el('span',{class:'transfer-context-chip source'},transferPlannerSourceLabel()));
}

function transferPlannerBlocking(out,title,detail){
  S.lastOptimiser=null;
  setChildren(out,transferPlannerContext(),el('div',{class:'note bad',role:'alert'},el('b',{},title),` ${detail}`));
}

function transferPlannerSyncVisibleAssumptions(){
  const pairs=[['trFtCount','ftCount'],['trBankIn','bankIn']];
  pairs.forEach(([visibleId,canonicalId])=>{
    const visible=$(visibleId),canonical=$(canonicalId);
    if(!visible||!canonical||document.activeElement===visible) return;
    visible.value=canonical.value;
  });
}

function transferPlannerMarkUpdating(){
  const out=$('transferOut'),status=$('transferStatus');
  if(out) out.setAttribute('aria-busy','true');
  if(status) status.textContent='Updating transfer comparison…';
}

function renderTransfers(){
  const out=$('transferOut');
  if(!out) return;
  renderRouteDataWarning('transferDataWarning',{showUnavailable:false});
  transferPlannerSyncVisibleAssumptions();
  transferPlannerRenderedControlSignature=transferPlannerCurrentControlSignature();
  transferPlannerMarkUpdating();

  try{
    if(!S.boot){
      transferPlannerBlocking(out,'Verified player data is unavailable.','Refresh from Settings before using transfer comparisons.');
      return;
    }
    const squad=mySquad();
    if(squad.length!==15){
      transferPlannerBlocking(out,'A complete 15-player squad is required.','Load your team or finish the manual squad in Team setup.');
      return;
    }

    const assumptions=transferPlannerReadAssumptions($('trFtCount')?.value,$('trBankIn')?.value);
    if(!assumptions.valid){
      transferPlannerBlocking(out,'Check the planning assumptions.',assumptions.issues.join(' '));
      return;
    }

    const horizon=Math.max(1,Math.min(8,Math.trunc(Number($('trHorizon')?.value)||6)));
    const maxResults=Math.max(1,Math.min(20,Math.trunc(Number($('trTop')?.value)||8)));
    const squadSignature=decisionPreviewSquadSignature(squad);
    const result=optimiseTransfers({
      squad,
      players:S.boot.elements||[],
      bank:assumptions.bankTenths,
      freeTransfers:assumptions.freeTransfers,
      startGW:S.nextGW,
      horizon,
      maxResults,
      scorePlayer:(player,gw)=>xpOf(player,gw,1).total
    });
    S.lastOptimiser={result,horizon,bank:assumptions.bankTenths,freeTransfers:assumptions.freeTransfers,startGW:S.nextGW,squadSignature};

    if(result.status==='invalid-input'){
      transferPlannerBlocking(out,'Squad cannot be compared.',`Fix the squad before continuing: ${(result.issues||[]).join(', ')}.`);
      return;
    }
    if(result.status==='projection-unavailable'){
      transferPlannerBlocking(out,'Projections are unavailable.','No transfer recommendation can be made from an unverified comparison.');
      return;
    }
    if(result.status==='search-incomplete'){
      transferPlannerBlocking(out,'Exact search did not complete.','No partial result is being presented as optimal. Try a shorter horizon.');
      return;
    }

    const plans=result.plans||[];
    const state=transferPlannerPresentationState(plans);
    const baseline=plans.find(plan=>Number(plan.transferCount)===0);
    if(!baseline){
      transferPlannerBlocking(out,'No zero-transfer baseline was returned.','Teamsheet will not present a transfer decision without its required comparison.');
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
        el('summary',{},`Other legal options (${otherAlternatives.length})`),
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

    nodes.push(el('p',{class:'transfer-disclaimer'},
      'Net model comparison = best-XI projection change minus transfer hits plus the versioned free-transfer utility. It is not a promise of FPL points, and it excludes captain doubling and bench points.'));
    setChildren(out,nodes);
  }finally{
    out.setAttribute('aria-busy','false');
    const status=$('transferStatus');
    if(status) status.textContent='Transfer comparison updated.';
  }
}

function transferPlannerClearPreview(){
  const preview=decisionPreviewSnapshot();
  decisionPreviewClearTransfer();
  if(transferPlannerHasActivePreview(preview)) transferPlannerDispatchPreviewChange();
}

function transferPlannerRefreshCommittedSelection(){
  const currentSignature=transferPlannerCurrentControlSignature();
  if(!transferPlannerRefreshRequired(transferPlannerRenderedControlSignature,currentSignature)) return false;
  transferPlannerClearPreview();
  void saveCfg();
  renderTransfers();
  return true;
}

function transferPlannerMirrorAssumption(visibleId,canonicalId){
  const visible=$(visibleId),canonical=$(canonicalId);
  if(!visible||!canonical||visible.dataset.assumptionMirrorInstalled==='true') return;
  visible.dataset.assumptionMirrorInstalled='true';
  visible.addEventListener('input',()=>{
    transferPlannerMarkUpdating();
    transferPlannerClearPreview();
    canonical.value=visible.value;
    canonical.dispatchEvent(new Event('input',{bubbles:true}));
  });
}

function installTransferPlannerCommittedControlRefresh(){
  if(typeof document==='undefined') return;
  transferPlannerSyncVisibleAssumptions();
  transferPlannerMirrorAssumption('trFtCount','ftCount');
  transferPlannerMirrorAssumption('trBankIn','bankIn');

  ['trHorizon','trTop'].forEach(id=>{
    const control=$(id);
    if(!control||control.dataset.committedRefreshInstalled==='true') return;
    control.dataset.committedRefreshInstalled='true';
    control.addEventListener('input',transferPlannerMarkUpdating);
    control.addEventListener('change',transferPlannerRefreshCommittedSelection);
  });
}

installTransferPlannerCommittedControlRefresh();

export {
  TRANSFER_PLANNER_COMMITTED_CONTROL_IDS,
  TRANSFER_PRESENTATION_STATES,
  transferPlannerControlSignature,
  transferPlannerRefreshRequired,
  transferPlannerHasActivePreview,
  transferPlannerReadAssumptions,
  transferPlannerPresentationState,
  transferPlannerNoTransferCopy,
  transferPlannerNetLabel,
  transferPlannerPlanNames,
  transferPlannerRefreshCommittedSelection,
  installTransferPlannerCommittedControlRefresh,
  renderTransfers
};
