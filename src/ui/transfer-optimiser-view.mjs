import { S } from '../state.mjs';
import { $, num, el, setChildren } from '../util.mjs';
import { xpOf } from '../model/xp.mjs';
import { mySquad } from '../squad.mjs';
import { optimiseTransfers } from '../model/transfers.mjs';
import {
  decisionPreviewSquadSignature,
  decisionPreviewPlanSignature,
  decisionPreviewOptimiserSignature,
  decisionPreviewSnapshot,
  decisionPreviewSyncOptimiser,
  decisionPreviewSelectTransfer
} from './decision-preview.mjs';

// Stage 6 replacement for the legacy isolated-swap renderer. The bundler places
// this declaration after views.mjs so renderAll resolves to this implementation.
function renderTransfers(){
  const out=$('transferOut');
  const squad=mySquad();
  if(!squad.length){
    setChildren(out,el('div',{class:'empty'},el('strong',{},'No squad loaded'),'Add your 15 on the Squad tab before running the optimiser.'));
    return;
  }
  const horizon=Math.max(1,Math.min(8,Math.trunc(num($('trHorizon')?.value)||6)));
  const maxResults=Math.max(1,Math.min(20,Math.trunc(num($('trTop')?.value)||10)));
  const bank=Math.max(0,Math.round(num($('bankIn')?.value)*10));
  const freeTransfers=Math.max(0,Math.min(5,Math.trunc(num($('ftCount')?.value)||0)));
  const squadSignature=decisionPreviewSquadSignature(squad);
  const result=optimiseTransfers({
    squad,players:S.boot?.elements||[],bank,freeTransfers,startGW:S.nextGW,horizon,maxResults,
    scorePlayer:(p,gw)=>xpOf(p,gw,1).total
  });
  S.lastOptimiser={result,horizon,bank,freeTransfers,startGW:S.nextGW,squadSignature};
  if(result.status==='invalid-input'){
    setChildren(out,el('div',{class:'note bad'},el('b',{},'Squad cannot be optimised.'),` Fix: ${result.issues.join(', ')}.`));
    return;
  }
  if(result.status==='projection-unavailable'){
    setChildren(out,el('div',{class:'note bad'},'Projections are unavailable, so no transfer recommendation can be made.'));
    return;
  }
  if(result.status==='search-incomplete'){
    setChildren(out,el('div',{class:'note bad'},el('b',{},'Exact search did not complete.'),' No partial result is being presented as optimal. Keep the current squad and try a shorter horizon.'));
    return;
  }
  const plans=result.plans||[];
  const optimiserSignature=decisionPreviewOptimiserSignature({squadSignature,horizon,bank,freeTransfers,plans});
  const previewCleared=decisionPreviewSyncOptimiser(optimiserSignature);
  if(previewCleared && typeof document!=='undefined') document.dispatchEvent(new CustomEvent('teamsheet:preview-change'));
  const previewState=decisionPreviewSnapshot();
  const best=plans[0];
  const nodes=[];
  if(!best||best.transferCount===0){
    nodes.push(el('div',{class:'note good'},el('b',{},'Roll the transfer.'),' No legal 1–3 move plan beats the zero-transfer baseline after hits and the 0.5-point roll value.'));
  }else{
    const moveText=best.transfers.map(t=>`${S.byId[t.outPlayerId]?.web_name||t.outPlayerId} → ${S.byId[t.inPlayerId]?.web_name||t.inPlayerId}`).join(' · ');
    nodes.push(el('div',{class:'note good'},el('b',{},'Top complete plan: '),moveText,` · net ${best.netGain>=0?'+':''}${best.netGain.toFixed(1)} points over ${horizon} GW${horizon>1?'s':''} · hit −${best.hitCost} · £${(best.bankAfter/10).toFixed(1)}m left · ${best.freeTransfersNextGW} FT next GW.`));
    if(best.warnings.length) nodes.push(el('div',{class:'note bad'},best.warnings.join(' · ')));
  }
  const table=el('table',{class:'data'});
  const head=el('thead',{},el('tr',{},...['Plan','Moves','Gross gain','Hit','Roll','Net','Bank','Next FT','Preview'].map(x=>el('th',{},x))));
  const body=el('tbody');
  plans.slice(0,maxResults).forEach((plan,i)=>{
    const label=plan.transferCount===0?'Roll':plan.transfers.map(t=>`${S.byId[t.outPlayerId]?.web_name||t.outPlayerId} → ${S.byId[t.inPlayerId]?.web_name||t.inPlayerId}`).join('; ');
    const selected=!!previewState.transfer&&decisionPreviewPlanSignature(previewState.transfer)===decisionPreviewPlanSignature(plan);
    const action=el('button',{type:'button',class:`btn ghost sm preview-plan-action${selected?' selected':''}`,
      'aria-label':plan.transferCount===0?'Use current squad on Team pitch':`Preview transfer plan ${i+1} on Team pitch`,
      onclick:()=>{
        decisionPreviewSelectTransfer({...plan,previewHorizon:horizon},squad,optimiserSignature);
        if(typeof document!=='undefined'){
          document.dispatchEvent(new CustomEvent('teamsheet:preview-change'));
          document.querySelector('nav.tabs .tab[data-view="squad"]')?.click();
        }
      }},plan.transferCount===0?'Use current squad':selected?'Previewing':'Preview on pitch');
    body.appendChild(el('tr',{class:selected?'preview-plan-row':''},
      el('td',{},i===0?el('b',{},label):label),
      el('td',{class:'num'},String(plan.transferCount)),
      el('td',{class:'num'},`${plan.grossGain>=0?'+':''}${plan.grossGain.toFixed(1)}`),
      el('td',{class:'num'},`−${plan.hitCost}`),
      el('td',{class:'num'},`${(plan.rollDifference*0.5).toFixed(1)}`),
      el('td',{class:'num'},`${plan.netGain>=0?'+':''}${plan.netGain.toFixed(1)}`),
      el('td',{class:'num'},`£${(plan.bankAfter/10).toFixed(1)}m`),
      el('td',{class:'num'},String(plan.freeTransfersNextGW)),
      el('td',{},action)));
  });
  table.append(head,body);
  nodes.push(el('div',{class:'scroll'},table));
  const estimated=squad.some(s=>s.bought==null);
  nodes.push(el('div',{class:'note plain'},estimated
    ? 'Affordability is estimated because the public picks feed does not expose purchase prices. Confirm the plan inside FPL before acting.'
    : 'Affordability uses the recorded purchase prices for this squad.'));
  setChildren(out,nodes);
}

export { renderTransfers };
