#!/usr/bin/env bash
set -euo pipefail

BRANCH='agent/stage9-4-decision-previews'
RESULT='.stage9-4-result'

if [ -f "$RESULT" ]; then
  echo 'Stage 9.4 result already recorded.'
  exit 0
fi

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'

python - <<'PY'
from pathlib import Path


def replace_once(text, old, new, label):
    if text.count(old) != 1:
        raise SystemExit(f'{label}: expected one marker, found {text.count(old)}')
    return text.replace(old, new, 1)

preview_module = r'''const DECISION_PREVIEW_ROLES = Object.freeze(['captain','vice']);
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
'''
Path('src/ui/decision-preview.mjs').write_text(preview_module)

preview_tests = r'''import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  decisionPreviewSquadSignature,
  decisionPreviewPlanSignature,
  decisionPreviewOptimiserSignature,
  decisionPreviewSnapshot,
  decisionPreviewClearAll,
  decisionPreviewSyncSquad,
  decisionPreviewSyncOptimiser,
  decisionPreviewSelectTransfer,
  decisionPreviewApplyTransferPlan,
  decisionPreviewBeginRole,
  decisionPreviewChooseRole,
  decisionPreviewEffectiveCaptaincy,
  decisionPreviewCaptainTotal
} from '../src/ui/decision-preview.mjs';

const player=(id,pos=3,cost=70)=>({id,element_type:pos,team:id,now_cost:cost,web_name:`P${id}`});
const squad=()=>Array.from({length:15},(_,i)=>({p:player(i+1,i===0?1:i<6?2:i<11?3:4),bought:60+i,position:i+1}));

test('transfer preview creates the optimiser final squad without mutating the real squad',()=>{
  decisionPreviewClearAll();
  const real=squad(), before=structuredClone(real), incoming=player(99,3,85);
  const byId=Object.fromEntries([...real.map(x=>x.p),incoming].map(p=>[p.id,p]));
  const expected=real.map(x=>x.p.id).filter(id=>id!==7).concat(99).sort((a,b)=>a-b);
  const plan={transferCount:1,signature:'7>99',transfers:[{outPlayerId:7,inPlayerId:99}],finalSquadIds:expected};
  const result=decisionPreviewApplyTransferPlan(real,plan,byId);
  assert.equal(result.ok,true);
  assert.deepEqual(result.squad.map(x=>x.p.id).sort((a,b)=>a-b),expected);
  assert.deepEqual(real,before);
  assert.deepEqual(result.incomingIds,[99]);
});

test('transfer preview fails closed when final squad identity disagrees with the optimiser',()=>{
  const real=squad(), incoming=player(99);
  const result=decisionPreviewApplyTransferPlan(real,{transferCount:1,transfers:[{outPlayerId:7,inPlayerId:99}],finalSquadIds:[1,2]}, {...Object.fromEntries(real.map(x=>[x.p.id,x.p])),99:incoming});
  assert.equal(result.ok,false);
  assert.equal(result.reason,'final_squad_mismatch');
});

test('captain and vice selections remain distinct and selecting the opposite role swaps them',()=>{
  decisionPreviewClearAll();
  decisionPreviewBeginRole('captain',{captainId:1,viceId:2});
  assert.equal(decisionPreviewChooseRole('captain',2,[1,2,3]),true);
  let state=decisionPreviewSnapshot();
  assert.equal(state.captainId,2);
  assert.equal(state.viceId,1);
  decisionPreviewBeginRole('vice',{captainId:1,viceId:2});
  assert.equal(decisionPreviewChooseRole('vice',2,[1,2,3]),true);
  state=decisionPreviewSnapshot();
  assert.notEqual(state.captainId,state.viceId);
});

test('bench players cannot be selected for captaincy preview',()=>{
  decisionPreviewClearAll();
  decisionPreviewBeginRole('captain',{captainId:1,viceId:2});
  assert.equal(decisionPreviewChooseRole('captain',12,[1,2,3,4,5,6,7,8,9,10,11]),false);
});

test('squad or optimiser changes clear stale preview state',()=>{
  decisionPreviewClearAll();
  const real=squad(), sig=decisionPreviewSquadSignature(real);
  const plan={transferCount:1,signature:'7>99',transfers:[{outPlayerId:7,inPlayerId:99}],finalSquadIds:real.map(x=>x.p.id)};
  decisionPreviewSelectTransfer(plan,real,'optimiser-a');
  assert.ok(decisionPreviewSnapshot().transfer);
  assert.equal(decisionPreviewSyncOptimiser('optimiser-b'),true);
  assert.equal(decisionPreviewSnapshot().transfer,null);
  decisionPreviewSelectTransfer(plan,real,'optimiser-c');
  const changed=real.map(x=>({...x})); changed[0]={...changed[0],bought:999};
  assert.equal(decisionPreviewSyncSquad(changed),true);
  assert.equal(decisionPreviewSnapshot().transfer,null);
  assert.notEqual(sig,decisionPreviewSquadSignature(changed));
});

test('optimiser and plan signatures are deterministic',()=>{
  const plans=[{signature:'2>22'},{transfers:[{outPlayerId:1,inPlayerId:11}]}];
  assert.equal(decisionPreviewPlanSignature(plans[1]),'1>11');
  assert.equal(decisionPreviewOptimiserSignature({squadSignature:'s',horizon:6,bank:10,freeTransfers:2,plans}),
    decisionPreviewOptimiserSignature({squadSignature:'s',horizon:6,bank:10,freeTransfers:2,plans}));
});

test('captain preview total keeps base XI score separate from the captain uplift',()=>{
  assert.deepEqual(decisionPreviewCaptainTotal(50,7,{7:6.4}),{uplift:6.4,total:56.4});
  assert.deepEqual(decisionPreviewEffectiveCaptaincy({captainId:1,viceId:2},[1,2,3]),{captainId:1,viceId:2,isPreview:false});
});

test('preview implementation is session-only and wired to accessible controls',()=>{
  const module=readFileSync(new URL('../src/ui/decision-preview.mjs',import.meta.url),'utf8');
  const views=readFileSync(new URL('../src/ui/views.mjs',import.meta.url),'utf8');
  const transfers=readFileSync(new URL('../src/ui/transfer-optimiser-view.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(module,/localStorage|sessionStorage|sset\(|saveCfg/);
  assert.match(views,/Choose captain/);
  assert.match(views,/Choose vice-captain/);
  assert.match(views,/Clear preview/);
  assert.match(transfers,/Preview on pitch/);
  assert.match(transfers,/Use current squad/);
});
'''
Path('tests/decision-preview.test.mjs').write_text(preview_tests)

# Build order
build=Path('build.mjs')
text=build.read_text()
old="  'src/ui/app-shell.mjs', 'src/ui/team-pitch.mjs', 'src/ui/player-detail.mjs', 'src/ui/views.mjs', 'src/ui/transfer-optimiser-view.mjs', 'src/ui/backtest-copy.mjs',"
new="  'src/ui/app-shell.mjs', 'src/ui/team-pitch.mjs', 'src/ui/player-detail.mjs', 'src/ui/decision-preview.mjs', 'src/ui/views.mjs', 'src/ui/transfer-optimiser-view.mjs', 'src/ui/backtest-copy.mjs',"
build.write_text(replace_once(text,old,new,'build module order'))

# Transfer view
path=Path('src/ui/transfer-optimiser-view.mjs')
text=path.read_text()
old="import { optimiseTransfers } from '../model/transfers.mjs';\n"
new="""import { optimiseTransfers } from '../model/transfers.mjs';
import {
  decisionPreviewSquadSignature,
  decisionPreviewPlanSignature,
  decisionPreviewOptimiserSignature,
  decisionPreviewSnapshot,
  decisionPreviewSyncOptimiser,
  decisionPreviewSelectTransfer
} from './decision-preview.mjs';
"""
text=replace_once(text,old,new,'transfer imports')
old="""  const plans=result.plans||[];
  const best=plans[0];
  const nodes=[];
"""
new="""  const plans=result.plans||[];
  const squadSignature=decisionPreviewSquadSignature(squad);
  const optimiserSignature=decisionPreviewOptimiserSignature({squadSignature,horizon,bank,freeTransfers,plans});
  const previewCleared=decisionPreviewSyncOptimiser(optimiserSignature);
  if(previewCleared && typeof document!=='undefined') document.dispatchEvent(new CustomEvent('teamsheet:preview-change'));
  const previewState=decisionPreviewSnapshot();
  const best=plans[0];
  const nodes=[];
"""
text=replace_once(text,old,new,'transfer preview context')
old="""  const head=el('thead',{},el('tr',{},...['Plan','Moves','Gross gain','Hit','Roll','Net','Bank','Next FT'].map(x=>el('th',{},x))));
  const body=el('tbody');
  plans.slice(0,maxResults).forEach((plan,i)=>{
    const label=plan.transferCount===0?'Roll':plan.transfers.map(t=>`${S.byId[t.outPlayerId]?.web_name||t.outPlayerId} → ${S.byId[t.inPlayerId]?.web_name||t.inPlayerId}`).join('; ');
    body.appendChild(el('tr',{},
      el('td',{},i===0?el('b',{},label):label),
      el('td',{class:'num'},String(plan.transferCount)),
      el('td',{class:'num'},`${plan.grossGain>=0?'+':''}${plan.grossGain.toFixed(1)}`),
      el('td',{class:'num'},`−${plan.hitCost}`),
      el('td',{class:'num'},`${(plan.rollDifference*0.5).toFixed(1)}`),
      el('td',{class:'num'},`${plan.netGain>=0?'+':''}${plan.netGain.toFixed(1)}`),
      el('td',{class:'num'},`£${(plan.bankAfter/10).toFixed(1)}m`),
      el('td',{class:'num'},String(plan.freeTransfersNextGW))));
  });
"""
new="""  const head=el('thead',{},el('tr',{},...['Plan','Moves','Gross gain','Hit','Roll','Net','Bank','Next FT','Preview'].map(x=>el('th',{},x))));
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
"""
text=replace_once(text,old,new,'transfer table actions')
path.write_text(text)

# Views integration
path=Path('src/ui/views.mjs')
text=path.read_text()
old="""function renderSquad(){
  const out = $('squadOut'), squad = mySquad();
  if(!squad.length){
"""
new="""function renderSquad(){
  const out = $('squadOut'), realSquad = mySquad();
  if(!realSquad.length){
    decisionPreviewClearAll();
"""
text=replace_once(text,old,new,'render squad opening')
old="""  const gw=S.nextGW, xi=bestXI(squad,gw), nodes=[];
  nodes.push(elNode('div',{class:'team-summary'},
    elNode('div',{class:'team-score'},elNode('span',{class:'label'},`Projected GW${gw}`),elNode('span',{class:'value'},fmt1(xi.tot)),elNode('span',{class:'unit'},'expected points')),
"""
new="""  decisionPreviewSyncSquad(realSquad);
  let previewState=decisionPreviewSnapshot();
  let applied=previewState.transfer?decisionPreviewApplyTransferPlan(realSquad,previewState.transfer,S.byId):{ok:true,squad:realSquad,incomingIds:[],outgoingIds:[]};
  if(previewState.transfer&&!applied.ok){
    decisionPreviewClearTransfer();
    previewState=decisionPreviewSnapshot();
    applied={ok:true,squad:realSquad,incomingIds:[],outgoingIds:[]};
  }
  const squad=applied.squad, incomingIds=new Set(applied.incomingIds), gw=S.nextGW, xi=bestXI(squad,gw), nodes=[];
  const currentXi=previewState.transfer?bestXI(realSquad,gw):xi;
  nodes.push(elNode('div',{class:'team-summary'},
    elNode('div',{class:'team-score'},elNode('span',{class:'label'},`${previewState.transfer?'Preview':'Projected'} GW${gw}`),elNode('span',{class:'value'},fmt1(xi.tot)),elNode('span',{class:'unit'},'expected points')),
"""
text=replace_once(text,old,new,'render squad preview setup')
old="""  if(S.entry) nodes.push(elNode('p',{class:'status team-entry'},`${S.entry.name} · ${S.entry.player_first_name||''} ${S.entry.player_last_name||''} · OR ${(S.entry.summary_overall_rank||0).toLocaleString('en-GB')}`));

  const problems=[];
"""
new="""  if(previewState.transfer){
    const moves=previewState.transfer.transfers.map(t=>`${S.byId[t.outPlayerId]?.web_name||t.outPlayerId} → ${S.byId[t.inPlayerId]?.web_name||t.inPlayerId}`).join(' · ');
    nodes.push(elNode('section',{class:'decision-preview-banner transfer-preview','aria-label':'Temporary transfer preview'},
      elNode('div',{},elNode('span',{class:'eyebrow'},'Preview only'),elNode('strong',{},moves),
        elNode('p',{},`Current squad ${fmt1(currentXi.tot)} xP → preview ${fmt1(xi.tot)} xP for GW${gw}. Optimiser net ${previewState.transfer.netGain>=0?'+':''}${fmt1(previewState.transfer.netGain)} over ${previewState.transfer.previewHorizon||1} GW${(previewState.transfer.previewHorizon||1)>1?'s':''} · hit −${previewState.transfer.hitCost} · £${fmt1(previewState.transfer.bankAfter/10)}m left · ${previewState.transfer.freeTransfersNextGW} FT next GW.`)),
      elNode('button',{type:'button',class:'btn ghost sm',onclick:()=>{decisionPreviewClearTransfer();renderSquad();renderTransfers();}},'Clear preview')));
  }
  if(S.entry) nodes.push(elNode('p',{class:'status team-entry'},`${S.entry.name} · ${S.entry.player_first_name||''} ${S.entry.player_last_name||''} · OR ${(S.entry.summary_overall_rank||0).toLocaleString('en-GB')}`));

  const problems=[];
"""
text=replace_once(text,old,new,'transfer preview banner')
old="""  const capRank=xi.xi.map(s=>({s,x:xpOf(s.p,gw,1).total,own:num(s.p.selected_by_percent)})).sort((a,b)=>b.x-a.x);
  const captaincy=teamPitchCaptaincy(capRank);
  const fixtureLabel=p=>{
"""
new="""  const capRank=xi.xi.map(s=>({s,x:xpOf(s.p,gw,1).total,own:num(s.p.selected_by_percent)})).sort((a,b)=>b.x-a.x);
  const captaincy=teamPitchCaptaincy(capRank);
  const xiIds=xi.xi.map(s=>Number(s.p.id));
  previewState=decisionPreviewSnapshot();
  const effectiveCaptaincy=decisionPreviewEffectiveCaptaincy(captaincy,xiIds);
  const scoreById=Object.fromEntries(xi.xi.map(s=>[s.p.id,xpOf(s.p,gw,1).total]));
  const captainTotal=decisionPreviewCaptainTotal(xi.tot,effectiveCaptaincy.captainId,scoreById);
  const modelCaptain=S.byId[captaincy.captainId]?.web_name||'—', modelVice=S.byId[captaincy.viceId]?.web_name||'—';
  const previewCaptain=S.byId[effectiveCaptaincy.captainId]?.web_name||'—', previewVice=S.byId[effectiveCaptaincy.viceId]?.web_name||'—';
  nodes.push(elNode('section',{class:'decision-preview-controls','aria-label':'Captain and vice-captain preview controls'},
    elNode('div',{class:'decision-preview-copy'},elNode('span',{class:'eyebrow'},'Captaincy'),
      elNode('strong',{},`Model: ${modelCaptain} C · ${modelVice} VC`),
      effectiveCaptaincy.isPreview?elNode('p',{},`Preview: ${previewCaptain} C · ${previewVice} VC · captain uplift ${fmt1(captainTotal.uplift)} · total ${fmt1(captainTotal.total)}.`):elNode('p',{},`Captain uplift ${fmt1(captainTotal.uplift)} · total with captain ${fmt1(captainTotal.total)}.`)),
    elNode('div',{class:'decision-preview-actions'},
      elNode('button',{type:'button',class:`btn ghost sm${previewState.selectionMode==='captain'?' active':''}`,'aria-pressed':previewState.selectionMode==='captain',onclick:()=>{decisionPreviewBeginRole('captain',captaincy);renderSquad();}},'Choose captain'),
      elNode('button',{type:'button',class:`btn ghost sm${previewState.selectionMode==='vice'?' active':''}`,'aria-pressed':previewState.selectionMode==='vice',onclick:()=>{decisionPreviewBeginRole('vice',captaincy);renderSquad();}},'Choose vice-captain'),
      effectiveCaptaincy.isPreview?elNode('button',{type:'button',class:'btn ghost sm',onclick:()=>{decisionPreviewClearCaptaincy();renderSquad();}},'Reset captaincy'):null)),
    previewState.selectionMode?elNode('p',{class:'selection-help',role:'status'},`Tap a starting player to choose ${previewState.selectionMode==='captain'?'captain':'vice-captain'}.`):null));
  const fixtureLabel=p=>{
"""
text=replace_once(text,old,new,'captain preview controls')
old="""  const playerNode=(slot,benchIndex=null)=>{
    const p=slot.p, team=S.teams[p.team], palette=teamPitchPalette(team);
    const role=p.id===captaincy.captainId?'captain':p.id===captaincy.viceId?'vice':null;
    const bad=availability(p)<1;
    const fixture=fixtureLabel(p), projected=fmt1(xpOf(p,gw,1).total);
    const label=benchIndex==null?p.web_name:`${benchIndex}. ${p.web_name}`;
    const style=`--shirt-primary:${palette.primary};--shirt-secondary:${palette.secondary};--shirt-accent:${palette.accent};--shirt-ink:${palette.ink}`;
    return elNode('button',{type:'button',class:`pitch-player${benchIndex==null?'':' bench-player'}${bad?' warn':''}`,
      onclick:event=>openPlayerDetailView(p,gw,1,event.currentTarget),
      'aria-label':`${label}, ${fixture}, ${projected} expected points${role==='captain'?', captain':role==='vice'?', vice-captain':''}`},
      elNode('div',{class:'shirt-wrap'},
        elNode('span',{class:`club-shirt pattern-${palette.pattern}`,style,'aria-hidden':'true'},elNode('span',{class:'club-shirt-code'},palette.code)),
        role?elNode('span',{class:`captain-badge${role==='vice'?' vice':''}`},role==='captain'?'C':'VC'):null),
      elNode('div',{class:'pitch-copy'},elNode('div',{class:'pitch-name'},label),elNode('div',{class:'pitch-meta'},fixture),elNode('div',{class:'pitch-xp'},`${projected} xP`)));
  };
"""
new="""  const playerNode=(slot,benchIndex=null)=>{
    const p=slot.p, team=S.teams[p.team], palette=teamPitchPalette(team);
    const role=p.id===effectiveCaptaincy.captainId?'captain':p.id===effectiveCaptaincy.viceId?'vice':null;
    const bad=availability(p)<1, incoming=incomingIds.has(Number(p.id));
    const selectable=benchIndex==null&&!!previewState.selectionMode;
    const fixture=fixtureLabel(p), projected=fmt1(xpOf(p,gw,1).total);
    const label=benchIndex==null?p.web_name:`${benchIndex}. ${p.web_name}`;
    const style=`--shirt-primary:${palette.primary};--shirt-secondary:${palette.secondary};--shirt-accent:${palette.accent};--shirt-ink:${palette.ink}`;
    return elNode('button',{type:'button',class:`pitch-player${benchIndex==null?'':' bench-player'}${bad?' warn':''}${incoming?' incoming':''}${selectable?' selection-target':''}`,
      onclick:event=>{
        if(selectable){ decisionPreviewChooseRole(previewState.selectionMode,p.id,xiIds); renderSquad(); }
        else openPlayerDetailView(p,gw,1,event.currentTarget);
      },
      'aria-label':selectable?`Select ${label} as ${previewState.selectionMode==='captain'?'captain':'vice-captain'}`:`${label}, ${fixture}, ${projected} expected points${role==='captain'?', captain':role==='vice'?', vice-captain':''}${incoming?', incoming transfer preview':''}`},
      elNode('div',{class:'shirt-wrap'},
        elNode('span',{class:`club-shirt pattern-${palette.pattern}`,style,'aria-hidden':'true'},elNode('span',{class:'club-shirt-code'},palette.code)),
        role?elNode('span',{class:`captain-badge${role==='vice'?' vice':''}${effectiveCaptaincy.isPreview?' preview':''}`},role==='captain'?'C':'VC'):null,
        incoming?elNode('span',{class:'incoming-badge'},'IN'):null),
      elNode('div',{class:'pitch-copy'},elNode('div',{class:'pitch-name'},label),elNode('div',{class:'pitch-meta'},fixture),elNode('div',{class:'pitch-xp'},`${projected} xP`)));
  };
"""
text=replace_once(text,old,new,'pitch preview interaction')
old="""document.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => { $('q').value = c.dataset.q; ask(); }));

const reFixtures = debounce(() => { clearXP(); renderTicker(); renderPlayers(); renderSquad(); renderTransfers(); }, 180);
"""
new="""document.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => { $('q').value = c.dataset.q; ask(); }));
document.addEventListener('teamsheet:preview-change',()=>renderSquad());

const reFixtures = debounce(() => { clearXP(); renderTicker(); renderPlayers(); renderSquad(); renderTransfers(); }, 180);
"""
text=replace_once(text,old,new,'preview change listener')
path.write_text(text)

# CSS
path=Path('app.html')
text=path.read_text()
marker="/* team pitch */\n"
css=r'''/* temporary decision previews */
.decision-preview-banner,.decision-preview-controls{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #B9D3C0;border-radius:14px;background:#F1F8F3;padding:12px 13px;margin:10px 0}
.decision-preview-banner strong,.decision-preview-controls strong{display:block;font-family:'Bricolage Grotesque',sans-serif;font-size:14px;margin-top:2px}
.decision-preview-banner p,.decision-preview-controls p{font-size:11px;color:var(--ink-soft);margin:4px 0 0;line-height:1.4}
.decision-preview-copy{min-width:0}
.decision-preview-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px;flex:0 0 auto}
.decision-preview-actions .active{background:var(--pitch);border-color:var(--pitch);color:#fff}
.selection-help{width:100%;font-weight:700;color:var(--pitch)!important}
.pitch-player.selection-target .pitch-copy{outline:2px dashed rgba(255,255,255,.9);outline-offset:2px}
.pitch-player.selection-target:hover .pitch-copy{transform:translateY(-1px)}
.pitch-player.incoming .pitch-copy{box-shadow:0 0 0 2px #B7F51B,0 4px 10px rgba(7,27,17,.2)}
.incoming-badge{position:absolute;left:-8px;top:-7px;z-index:4;border-radius:999px;background:#B7F51B;color:#102816;border:2px solid #fff;font-family:'IBM Plex Mono',monospace;font-size:8px;font-weight:800;padding:3px 4px}
.captain-badge.preview{background:#fff;color:var(--pitch);border:2px solid var(--pitch);box-shadow:0 0 0 2px #fff}
.preview-plan-action.selected{background:var(--pitch);border-color:var(--pitch);color:#fff}
.preview-plan-row{background:#F1F8F3}
@media(max-width:600px){.decision-preview-banner,.decision-preview-controls{align-items:stretch;flex-direction:column}.decision-preview-actions{justify-content:flex-start;width:100%}.decision-preview-actions .btn{flex:1 1 auto}}

'''
text=replace_once(text,marker,css+marker,'preview css')
path.write_text(text)
PY

git add app.html build.mjs src/ui/decision-preview.mjs src/ui/views.mjs src/ui/transfer-optimiser-view.mjs tests/decision-preview.test.mjs
git commit -m 'Implement Stage 9.4 decision previews'
SOURCE_SHA=$(git rev-parse HEAD)

BUILD_COMMIT="$SOURCE_SHA" ./run-tests.sh | tee /tmp/stage9-4.log
mkdir -p /tmp/stage9-4-first
cp dist/index.html dist/app.bundle.js dist/manifest.json /tmp/stage9-4-first/
BUILD_COMMIT="$SOURCE_SHA" node build.mjs
cmp /tmp/stage9-4-first/index.html dist/index.html
cmp /tmp/stage9-4-first/app.bundle.js dist/app.bundle.js
cmp /tmp/stage9-4-first/manifest.json dist/manifest.json
node -e "const m=require('./dist/manifest.json');if(m.commit!=='$SOURCE_SHA')throw new Error('build identity mismatch: '+m.commit)"

git add dist/index.html dist/app.bundle.js dist/manifest.json
git commit -m 'Commit verified Stage 9.4 deployables'
ARTEFACT_SHA=$(git rev-parse HEAD)

{
  echo 'status=0'
  echo "source=$SOURCE_SHA"
  echo "artefact=$ARTEFACT_SHA"
  echo '--- log tail ---'
  tail -n 180 /tmp/stage9-4.log
} > "$RESULT"

git add "$RESULT"
git commit -m 'Record Stage 9.4 verification result'
git push origin HEAD:"$BRANCH"
