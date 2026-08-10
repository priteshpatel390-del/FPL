import { TRANSFER_RULES } from '../config.mjs';
import { S } from '../state.mjs';
import { K_SQUAD, ssetVerified, saveCfg, setManualSquadPersistenceReady } from '../storage.mjs';

const MANUAL_SQUAD_POSITION_LABELS = Object.freeze({1:'GKP',2:'DEF',3:'MID',4:'FWD'});

function manualSquadBudget(rules=TRANSFER_RULES){
  const value=Number(rules?.squadBudget);
  return Number.isFinite(value)&&value>0?Math.trunc(value):1000;
}

function manualSquadMoney(value){
  const amount=Number(value);
  return Number.isFinite(amount)?`£${(amount/10).toFixed(1)}m`:'—';
}

function manualSquadEntryCost(entry,player){
  const stored=entry?.bought??entry?.purchasePrice;
  const bought=Number(stored);
  if(stored!==null&&stored!==undefined&&stored!==''&&Number.isFinite(bought)&&bought>=0)
    return Math.trunc(bought);
  const current=Number(player?.now_cost);
  return Number.isFinite(current)&&current>=0?Math.trunc(current):null;
}

function manualSquadValidation(manual=[],byId={},rules=TRANSFER_RULES){
  const entries=Array.isArray(manual)?manual:[];
  const quotas=rules?.positionQuotas||{1:2,2:5,3:5,4:3};
  const maxPerClub=Number(rules?.maxPerClub)||3;
  const budget=manualSquadBudget(rules);
  const positionCounts={1:0,2:0,3:0,4:0};
  const clubCounts={};
  const unknownIds=[];
  const duplicateIds=[];
  const invalidPriceIds=[];
  const seen=new Set();
  let cost=0;

  entries.forEach(entry=>{
    const id=Number(entry?.id);
    if(seen.has(id)) duplicateIds.push(id);
    seen.add(id);
    const player=byId?.[id];
    if(!player){ unknownIds.push(id); invalidPriceIds.push(id); return; }
    const position=Number(player.element_type);
    const club=Number(player.team);
    if(Object.prototype.hasOwnProperty.call(positionCounts,position)) positionCounts[position]++;
    if(Number.isFinite(club)) clubCounts[club]=(clubCounts[club]||0)+1;
    const entryCost=manualSquadEntryCost(entry,player);
    if(entryCost===null) invalidPriceIds.push(id);
    else cost+=entryCost;
  });

  const priceComplete=invalidPriceIds.length===0;
  const remainingBudget=priceComplete?budget-cost:null;
  const issues=[];
  if(entries.length>15) issues.push('The squad contains more than 15 players.');
  if(unknownIds.length) issues.push('One or more saved players are no longer in the verified player list.');
  if(duplicateIds.length) issues.push('The same player appears more than once.');
  if(!priceComplete) issues.push('One or more player purchase prices are unavailable.');
  Object.entries(quotas).forEach(([position,quota])=>{
    const count=positionCounts[position]||0;
    if(count>quota) issues.push(`Too many ${MANUAL_SQUAD_POSITION_LABELS[position]} players (${count}/${quota}).`);
  });
  if(Object.values(clubCounts).some(count=>count>maxPerClub))
    issues.push(`A maximum of ${maxPerClub} players from one club is allowed.`);
  if(priceComplete&&cost>budget)
    issues.push(`Squad cost ${manualSquadMoney(cost)} exceeds the ${manualSquadMoney(budget)} budget.`);

  const complete=entries.length===15;
  const exactPositions=Object.entries(quotas).every(([position,quota])=>(positionCounts[position]||0)===quota);
  if(complete&&!exactPositions) issues.push('A legal squad needs 2 GKP, 5 DEF, 5 MID and 3 FWD.');
  const legal=complete&&exactPositions&&issues.length===0;
  return Object.freeze({
    count:entries.length,
    complete,
    legal,
    issues:Object.freeze([...new Set(issues)]),
    positionCounts:Object.freeze({...positionCounts}),
    clubCounts:Object.freeze({...clubCounts}),
    unknownIds:Object.freeze(unknownIds.slice()),
    duplicateIds:Object.freeze(duplicateIds.slice()),
    invalidPriceIds:Object.freeze(invalidPriceIds.slice()),
    priceComplete,
    cost,
    budget,
    remainingBudget
  });
}

function manualSquadAddDecision(manual=[],player=null,byId={},rules=TRANSFER_RULES){
  if(!player||!Number.isFinite(Number(player.id))) return {ok:false,message:'That player is unavailable.'};
  const id=Number(player.id);
  if((manual||[]).some(entry=>Number(entry?.id)===id)) return {ok:false,message:`${player.web_name||'That player'} is already in your squad.`};
  if((manual||[]).length>=15) return {ok:false,message:'Remove a player before adding another.'};

  const current=manualSquadValidation(manual,byId,rules);
  const position=Number(player.element_type);
  const quota=Number(rules?.positionQuotas?.[position]);
  if(!Number.isFinite(quota)) return {ok:false,message:'That player has an unsupported position.'};
  if((current.positionCounts[position]||0)>=quota)
    return {ok:false,message:`You already have the maximum ${quota} ${MANUAL_SQUAD_POSITION_LABELS[position]} players.`};
  const club=Number(player.team);
  const maxPerClub=Number(rules?.maxPerClub)||3;
  if((current.clubCounts[club]||0)>=maxPerClub)
    return {ok:false,message:`You already have ${maxPerClub} players from ${S.teams?.[club]?.name||'that club'}.`};
  const playerCost=manualSquadEntryCost({bought:player.now_cost},player);
  if(playerCost===null) return {ok:false,message:`${player.web_name||'That player'} does not have a verified price.`};
  if(!current.priceComplete) return {ok:false,message:'A saved player price is unavailable, so the squad budget cannot be verified.'};
  const nextCost=current.cost+playerCost;
  if(nextCost>current.budget)
    return {ok:false,message:`Adding ${player.web_name||'that player'} would take the squad to ${manualSquadMoney(nextCost)}, above the ${manualSquadMoney(current.budget)} budget.`};
  return {ok:true,message:'',nextCost,remainingBudget:current.budget-nextCost};
}

function manualSquadStatusText(validation,rejection=''){
  const counts=validation?.positionCounts||{1:0,2:0,3:0,4:0};
  const budgetText=validation?.priceComplete===false
    ? ' · budget unavailable'
    : ` · ${manualSquadMoney(validation?.cost||0)} used · ${validation?.remainingBudget>=0
      ? `${manualSquadMoney(validation.remainingBudget)} left`
      : `${manualSquadMoney(Math.abs(validation?.remainingBudget||0))} over`}`;
  const base=`${validation?.count||0}/15 · ${counts[1]||0} GKP, ${counts[2]||0} DEF, ${counts[3]||0} MID, ${counts[4]||0} FWD${budgetText}`;
  if(rejection) return `${base} — ${rejection}`;
  if(validation?.legal) return `${base} — complete and legal`;
  if(validation?.complete&&validation?.issues?.length) return `${base} — fix: ${validation.issues[0]}`;
  const remaining=Math.max(0,15-(validation?.count||0));
  return `${base}${remaining?` — add ${remaining} more`:''}`;
}

function manualSquadApplyStatus(documentRef,manual=S.manual,byId=S.byId,rejection=''){
  const node=documentRef?.getElementById?.('manualCount');
  const validation=manualSquadValidation(manual,byId);
  if(node){
    node.textContent=manualSquadStatusText(validation,rejection);
    node.setAttribute?.('role','status');
    node.setAttribute?.('aria-live','polite');
  }
  return validation;
}

function manualSquadIsTransfersRoute(value=''){
  return String(value||'').split('?')[0]==='#/transfers';
}

function manualSquadCreateRouteAwareTransferRenderer(renderTransferView,routeProvider=()=>globalThis.location?.hash||''){
  if(typeof renderTransferView!=='function') throw new TypeError('renderTransferView must be a function');
  return function routeAwareTransferRenderer(options={}){
    const forced=options===true||options?.force===true;
    if(!forced&&!manualSquadIsTransfersRoute(routeProvider())) return {deferred:true};
    return renderTransferView();
  };
}

function manualPersistenceOutcome(value){
  if(value===false) return {ok:false,reason:'rejected'};
  if(value&&typeof value==='object'&&Object.prototype.hasOwnProperty.call(value,'ok')) return value;
  return {ok:true,via:'caller'};
}
async function manualPersistenceCall(fn,...args){
  try{ return manualPersistenceOutcome(await fn(...args)); }
  catch(error){ return {ok:false,reason:'exception',error}; }
}

async function manualSquadCommitAddition({
  manual,player,byId,persist=async()=>{},saveConfiguration=async()=>{},
  renderManualView=()=>{},renderTeamView=()=>{},dispatchRendered=()=>{}
}={}){
  const decision=manualSquadAddDecision(manual,player,byId);
  if(!decision.ok) return {ok:false,message:decision.message,validation:manualSquadValidation(manual,byId)};
  manual.push({id:Number(player.id),bought:Number(player.now_cost)});
  const squadPersistence=await manualPersistenceCall(persist,manual);
  const configurationPersistence=squadPersistence.ok
    ? await manualPersistenceCall(saveConfiguration)
    : {ok:false,reason:'skipped_after_squad_failure'};
  renderManualView();
  let teamRenderError=null;
  try{ renderTeamView(); }
  catch(error){ teamRenderError=error; }
  try{ dispatchRendered(); }
  catch(error){}
  return {
    ok:true,
    message:'',
    validation:manualSquadValidation(manual,byId),
    teamRenderError,
    persistence:{squad:squadPersistence,configuration:configurationPersistence}
  };
}

function manualSquadInstallBrowserRuntime({
  documentRef=globalThis.document,
  routeProvider=()=>globalThis.location?.hash||'',
  renderTransferView,
  renderManualView,
  renderTeamView
}={}){
  if(!documentRef?.addEventListener||documentRef.documentElement?.dataset?.manualSquadRuntime==='installed') return null;
  if(documentRef.documentElement?.dataset) documentRef.documentElement.dataset.manualSquadRuntime='installed';

  const routeAware=manualSquadCreateRouteAwareTransferRenderer(renderTransferView,routeProvider);
  documentRef.addEventListener('teamsheet:route-change',event=>{
    if(event?.detail?.route==='#/transfers') routeAware({force:true});
  });
  documentRef.addEventListener('teamsheet:data-rendered',()=>manualSquadApplyStatus(documentRef));

  documentRef.addEventListener('click',event=>{
    const target=event.target?.closest?.('[data-add],[data-rm]');
    if(!target) return;
    const add=target.hasAttribute?.('data-add')&&target.closest?.('#pResults');
    const remove=target.hasAttribute?.('data-rm')&&target.closest?.('#manualList');
    if(!add&&!remove) return;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();

    void (async()=>{
      if(add){
        const id=Number(target.dataset.add);
        const player=S.byId?.[id];
        const decision=manualSquadAddDecision(S.manual,player,S.byId);
        if(!decision.ok){ manualSquadApplyStatus(documentRef,S.manual,S.byId,decision.message); return; }
        const useManual=documentRef.getElementById?.('useManual');
        if(useManual) useManual.checked=true;
        const result=await manualSquadCommitAddition({
          manual:S.manual,
          player,
          byId:S.byId,
          persist:value=>ssetVerified(K_SQUAD,value),
          saveConfiguration:()=>saveCfg(),
          renderManualView,
          renderTeamView,
          dispatchRendered:()=>documentRef.dispatchEvent?.(new CustomEvent('teamsheet:data-rendered'))
        });
        setManualSquadPersistenceReady(Boolean(result.persistence?.squad?.ok));
        const search=documentRef.getElementById?.('pSearch');
        const results=documentRef.getElementById?.('pResults');
        if(search) search.value='';
        if(results) results.hidden=true;
        if(!result.persistence?.squad?.ok)
          manualSquadApplyStatus(documentRef,S.manual,S.byId,'Change active for this session, but Teamsheet could not save the manual squad. It may revert after reload.');
        else if(!result.persistence?.configuration?.ok)
          manualSquadApplyStatus(documentRef,S.manual,S.byId,'Squad saved, but the manual-team setting could not be saved. It may need to be re-enabled after reload.');
        else if(result.teamRenderError)
          manualSquadApplyStatus(documentRef,S.manual,S.byId,'Squad saved. Team analysis could not refresh; reopen Team.');
        else manualSquadApplyStatus(documentRef);
        return;
      }

      const index=Number(target.dataset.rm);
      if(!Number.isInteger(index)||index<0||index>=S.manual.length) return;
      S.manual.splice(index,1);
      const persistence=await ssetVerified(K_SQUAD,S.manual);
      setManualSquadPersistenceReady(Boolean(persistence.ok));
      renderManualView();
      try{ renderTeamView(); }
      catch(error){
        const suffix=persistence.ok?'Squad saved. ':'Change active for this session, but the manual squad was not saved. ';
        manualSquadApplyStatus(documentRef,S.manual,S.byId,suffix+'Team analysis could not refresh; reopen Team.');
        return;
      }
      documentRef.dispatchEvent?.(new CustomEvent('teamsheet:data-rendered'));
      if(!persistence.ok)
        manualSquadApplyStatus(documentRef,S.manual,S.byId,'Change active for this session, but Teamsheet could not save the manual squad. It may revert after reload.');
      else manualSquadApplyStatus(documentRef);
    })();
  },true);

  manualSquadApplyStatus(documentRef);
  return routeAware;
}

if(typeof document!=='undefined'&&typeof renderTransfers==='function'){
  const manualSquadOriginalRenderTransfers=renderTransfers;
  const manualSquadRouteAwareRenderTransfers=manualSquadCreateRouteAwareTransferRenderer(
    manualSquadOriginalRenderTransfers,()=>globalThis.location?.hash||''
  );
  renderTransfers=manualSquadRouteAwareRenderTransfers;
  manualSquadInstallBrowserRuntime({
    documentRef:document,
    renderTransferView:manualSquadOriginalRenderTransfers,
    renderManualView:typeof renderManual==='function'?renderManual:()=>{},
    renderTeamView:typeof renderSquad==='function'?renderSquad:()=>{}
  });
}

export {
  MANUAL_SQUAD_POSITION_LABELS,
  manualSquadBudget,
  manualSquadMoney,
  manualSquadEntryCost,
  manualSquadValidation,
  manualSquadAddDecision,
  manualSquadStatusText,
  manualSquadApplyStatus,
  manualSquadIsTransfersRoute,
  manualSquadCreateRouteAwareTransferRenderer,
  manualSquadCommitAddition,
  manualSquadInstallBrowserRuntime
};
