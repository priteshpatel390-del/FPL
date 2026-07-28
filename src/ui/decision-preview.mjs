const DECISION_PREVIEW_ROLES = Object.freeze(['captain','vice']);
const decisionPreviewState = {
  transfer:null,
  captainId:null,
  viceId:null,
  selectionMode:null,
  squadSignature:null,
  optimiserSignature:null
};

function decisionPreviewPlayer(entry){ return entry?.p || entry || null; }
function decisionPreviewSquadSignature(squad=[]){
  return (Array.isArray(squad)?squad:[]).map((entry,index)=>{
    const p=decisionPreviewPlayer(entry);
    const bought=entry?.bought ?? entry?.purchasePrice ?? '';
    return `${index}:${Number(p?.id)||0}:${bought}`;
  }).join('|');
}
function decisionPreviewPlanSignature(plan={}){
  if(plan?.signature) return String(plan.signature);
  return (plan?.transfers||[]).map(t=>`${Number(t.outPlayerId)}>${Number(t.inPlayerId)}`).sort().join('|');
}
function decisionPreviewOptimiserSignature({squadSignature='',horizon=0,bank=0,freeTransfers=0,plans=[]}={}){
  return [String(squadSignature),Number(horizon)||0,Number(bank)||0,Number(freeTransfers)||0,
    (plans||[]).map(decisionPreviewPlanSignature).join(',')].join('::');
}
function decisionPreviewClonePlan(plan){
  if(!plan) return null;
  return {...plan,
    transfers:(plan.transfers||[]).map(t=>({...t})),
    finalSquadIds:(plan.finalSquadIds||[]).map(Number),
    warnings:(plan.warnings||[]).slice(),
    perGameweekBestXI:(plan.perGameweekBestXI||[]).map(g=>({...g,playerIds:(g.playerIds||[]).slice()}))};
}
function decisionPreviewSnapshot(){
  return {...decisionPreviewState,transfer:decisionPreviewClonePlan(decisionPreviewState.transfer)};
}
function decisionPreviewClearCaptaincy(){
  decisionPreviewState.captainId=null;
  decisionPreviewState.viceId=null;
  decisionPreviewState.selectionMode=null;
}
function decisionPreviewClearTransfer(){
  decisionPreviewState.transfer=null;
  decisionPreviewState.optimiserSignature=null;
  decisionPreviewClearCaptaincy();
}
function decisionPreviewClearAll(){
  decisionPreviewClearTransfer();
  decisionPreviewState.squadSignature=null;
}
function decisionPreviewSyncSquad(squad){
  const signature=decisionPreviewSquadSignature(squad);
  const changed=decisionPreviewState.squadSignature!==null && decisionPreviewState.squadSignature!==signature;
  if(changed) decisionPreviewClearAll();
  decisionPreviewState.squadSignature=signature;
  return changed;
}
function decisionPreviewSyncOptimiser(signature){
  const next=String(signature||'');
  const changed=!!decisionPreviewState.transfer && decisionPreviewState.optimiserSignature!==next;
  if(changed) decisionPreviewClearTransfer();
  decisionPreviewState.optimiserSignature=next;
  return changed;
}
function decisionPreviewSelectTransfer(plan,squad,optimiserSignature){
  decisionPreviewSyncSquad(squad);
  if(!plan || Number(plan.transferCount)===0){
    decisionPreviewClearTransfer();
    decisionPreviewState.squadSignature=decisionPreviewSquadSignature(squad);
    decisionPreviewState.optimiserSignature=String(optimiserSignature||'');
    return decisionPreviewSnapshot();
  }
  decisionPreviewState.transfer=decisionPreviewClonePlan(plan);
  decisionPreviewState.optimiserSignature=String(optimiserSignature||'');
  decisionPreviewClearCaptaincy();
  return decisionPreviewSnapshot();
}
function decisionPreviewApplyTransferPlan(squad,plan,byId={}){
  const source=(Array.isArray(squad)?squad:[]).map(entry=>({...entry,p:decisionPreviewPlayer(entry)}));
  if(!plan || Number(plan.transferCount)===0)
    return {ok:true,squad:source,incomingIds:[],outgoingIds:[]};
  const transfers=Array.isArray(plan.transfers)?plan.transfers:[];
  const incomingIds=[], outgoingIds=[];
  for(const move of transfers){
    const outId=Number(move.outPlayerId), inId=Number(move.inPlayerId);
    const index=source.findIndex(entry=>Number(entry.p?.id)===outId);
    const incoming=byId?.[inId];
    if(index<0 || !incoming || source.some((entry,i)=>i!==index&&Number(entry.p?.id)===inId))
      return {ok:false,reason:'invalid_transfer',squad:source,incomingIds:[],outgoingIds:[]};
    const previous=source[index];
    source[index]={...previous,p:incoming,bought:Number(incoming.now_cost)||0,multiplier:1,is_captain:false};
    incomingIds.push(inId); outgoingIds.push(outId);
  }
  const actual=source.map(entry=>Number(entry.p?.id)).sort((a,b)=>a-b);
  const expected=(plan.finalSquadIds||[]).map(Number).sort((a,b)=>a-b);
  if(actual.length!==15 || new Set(actual).size!==actual.length || expected.length!==actual.length ||
     actual.some((id,index)=>id!==expected[index]))
    return {ok:false,reason:'final_squad_mismatch',squad:source,incomingIds:[],outgoingIds:[]};
  return {ok:true,squad:source,incomingIds,outgoingIds};
}
function decisionPreviewBeginRole(role,modelCaptaincy={}){
  if(!DECISION_PREVIEW_ROLES.includes(role)) return false;
  if(decisionPreviewState.captainId==null) decisionPreviewState.captainId=Number(modelCaptaincy.captainId)||null;
  if(decisionPreviewState.viceId==null) decisionPreviewState.viceId=Number(modelCaptaincy.viceId)||null;
  decisionPreviewState.selectionMode=role;
  return true;
}
function decisionPreviewChooseRole(role,playerId,xiIds=[]){
  if(!DECISION_PREVIEW_ROLES.includes(role)) return false;
  const id=Number(playerId), eligible=new Set((xiIds||[]).map(Number));
  if(!eligible.has(id)) return false;
  if(role==='captain'){
    if(decisionPreviewState.viceId===id){
      const oldCaptain=decisionPreviewState.captainId;
      decisionPreviewState.captainId=id;
      decisionPreviewState.viceId=eligible.has(Number(oldCaptain))&&Number(oldCaptain)!==id?Number(oldCaptain):null;
    }else decisionPreviewState.captainId=id;
  }else{
    if(decisionPreviewState.captainId===id){
      const oldVice=decisionPreviewState.viceId;
      decisionPreviewState.viceId=id;
      decisionPreviewState.captainId=eligible.has(Number(oldVice))&&Number(oldVice)!==id?Number(oldVice):null;
    }else decisionPreviewState.viceId=id;
  }
  if(decisionPreviewState.captainId===decisionPreviewState.viceId){
    if(role==='captain') decisionPreviewState.viceId=null;
    else decisionPreviewState.captainId=null;
  }
  decisionPreviewState.selectionMode=null;
  return true;
}
function decisionPreviewEffectiveCaptaincy(modelCaptaincy={},xiIds=[]){
  const eligible=new Set((xiIds||[]).map(Number));
  let captainId=eligible.has(Number(decisionPreviewState.captainId))?Number(decisionPreviewState.captainId):Number(modelCaptaincy.captainId)||null;
  let viceId=eligible.has(Number(decisionPreviewState.viceId))?Number(decisionPreviewState.viceId):Number(modelCaptaincy.viceId)||null;
  if(captainId===viceId) viceId=(xiIds||[]).map(Number).find(id=>id!==captainId)??null;
  return {captainId,viceId,isPreview:decisionPreviewState.captainId!=null||decisionPreviewState.viceId!=null};
}
function decisionPreviewCaptainTotal(xiTotal,captainId,scoreById={}){
  const uplift=Number(scoreById?.[captainId])||0;
  return {uplift,total:(Number(xiTotal)||0)+uplift};
}

export {
  DECISION_PREVIEW_ROLES,
  decisionPreviewSquadSignature,
  decisionPreviewPlanSignature,
  decisionPreviewOptimiserSignature,
  decisionPreviewSnapshot,
  decisionPreviewClearCaptaincy,
  decisionPreviewClearTransfer,
  decisionPreviewClearAll,
  decisionPreviewSyncSquad,
  decisionPreviewSyncOptimiser,
  decisionPreviewSelectTransfer,
  decisionPreviewApplyTransferPlan,
  decisionPreviewBeginRole,
  decisionPreviewChooseRole,
  decisionPreviewEffectiveCaptaincy,
  decisionPreviewCaptainTotal
};
