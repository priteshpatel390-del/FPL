import test from 'node:test';
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

test('squad or optimiser changes clear stale transfer preview state',()=>{
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

test('changed optimiser inputs also clear captain-only preview state',()=>{
  decisionPreviewClearAll();
  decisionPreviewSyncOptimiser('optimiser-a');
  decisionPreviewBeginRole('captain',{captainId:1,viceId:2});
  decisionPreviewChooseRole('captain',3,[1,2,3]);
  assert.equal(decisionPreviewSnapshot().captainId,3);
  assert.equal(decisionPreviewSyncOptimiser('optimiser-b'),true);
  const state=decisionPreviewSnapshot();
  assert.equal(state.captainId,null);
  assert.equal(state.viceId,null);
});

test('optimiser signatures include result changes as well as transfer identities',()=>{
  const plan={signature:'2>22',transferCount:1,finalSquadIds:[1,2,22],netGain:3.2,hitCost:0,bankAfter:5,freeTransfersNextGW:1,grossBestXIPoints:50};
  const first=decisionPreviewOptimiserSignature({squadSignature:'s',horizon:6,bank:10,freeTransfers:2,plans:[plan]});
  const same=decisionPreviewOptimiserSignature({squadSignature:'s',horizon:6,bank:10,freeTransfers:2,plans:[{...plan}]});
  const changed=decisionPreviewOptimiserSignature({squadSignature:'s',horizon:6,bank:10,freeTransfers:2,plans:[{...plan,netGain:3.3}]});
  assert.equal(decisionPreviewPlanSignature({transfers:[{outPlayerId:1,inPlayerId:11}]}),'1>11');
  assert.equal(first,same);
  assert.notEqual(first,changed);
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
  assert.match(views,/bestXI\(squad,gw\)/);
  assert.match(transfers,/Preview on Team/);
  assert.match(transfers,/__teamsheetNavigate/);
});
