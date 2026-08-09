import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadApp, syntheticWorld } from './harness.mjs';

const walk=root=>{
  const nodes=[];
  const visit=node=>{ nodes.push(node); (node?.children||[]).forEach(visit); };
  visit(root);
  return nodes;
};
const byClass=(root,className)=>walk(root).filter(node=>node?.classList?.contains(className));
const text=root=>walk(root).filter(node=>node?.nodeType===3).map(node=>node.textContent).join('');

function legalRuntime(){
  const runtime=loadApp({useManual:true},{interactive:true});
  const world=syntheticWorld(runtime.T);
  const extras=[2,2,2,3].map((type,index)=>({...world.elements.find(player=>player.element_type===type),
    id:900+index,web_name:`Extra ${index}`,team:10+index}));
  runtime.T.S.boot.elements.push(...extras);
  extras.forEach(player=>runtime.T.S.byId[player.id]=player);
  runtime.T.S.manual=runtime.T.S.boot.elements.map(player=>({id:player.id,bought:player.now_cost}));
  return {...runtime,world};
}

test('production bundle renders the accepted ready Team DOM directly in final order',()=>{
  const {T,doc}=legalRuntime();
  T.renderSquad();
  assert.deepEqual(doc.squadOut.children.map(node=>node.className),[
    'team-home-header','team-home-decision','team-resource-bar','team-stage','decision-preview-controls','team-home-actions'
  ]);
  assert.equal(byClass(doc.squadOut,'team-summary').length,0);
  assert.equal(byClass(doc.squadOut,'pitch-player').filter(node=>node.tagName==='BUTTON').length,15);
  assert.equal(byClass(doc.squadOut,'bench-player').length,4);
  assert.deepEqual(byClass(doc.squadOut,'bench-role').map(text),['GK','1st','2nd','3rd']);
  assert.deepEqual(doc.teamHomeSupport.children.map(node=>node.tagName),['DETAILS','DETAILS']);
  assert.match(text(doc.squadOut),/Team resources/);
  assert.match(text(doc.teamHomeSupport),/Why this XI and captaincy/);
  assert.match(text(doc.teamHomeSupport),/All 15 over six Gameweeks/);
});

test('placeholder rendering clears preview state and never calculates a false Team recommendation',()=>{
  const {T,doc}=loadApp({useManual:true},{interactive:true});
  syntheticWorld(T);
  T.S.manual=[];
  T.decisionPreviewSelectTransfer({transferCount:1,transfers:[{outPlayerId:1,inPlayerId:2}],finalSquadIds:[2]},[], 'invalid');
  T.renderSquad();
  assert.equal(T.decisionPreviewSnapshot().transfer,null);
  assert.deepEqual(doc.squadOut.children.map(node=>node.className),[
    'team-home-header','team-home-decision','team-resource-bar','team-stage'
  ]);
  assert.match(text(doc.squadOut),/Recommendation unavailable/);
  assert.doesNotMatch(text(doc.squadOut),/Start \d/);
});

test('captain controls, starter selection and reset rerender through the stable Team entry point',()=>{
  const {T,doc}=legalRuntime();
  T.renderSquad();
  byClass(doc.squadOut,'decision-preview-actions')[0].children[0].click();
  const target=byClass(doc.squadOut,'selection-target')[1];
  assert.ok(target);
  target.click();
  assert.match(text(doc.squadOut),/User preview/);
  const reset=walk(doc.squadOut).find(node=>node.tagName==='BUTTON'&&text(node)==='Reset captaincy');
  assert.ok(reset);
  reset.click();
  assert.equal(T.decisionPreviewSnapshot().captainId,null);
  assert.equal(T.decisionPreviewSnapshot().viceId,null);
  assert.doesNotMatch(text(doc.squadOut),/Reset captaincy/);
});

test('all Team player actions retain the correct one- and six-Gameweek Player Detail horizons',()=>{
  const {T,doc}=legalRuntime();
  T.renderSquad();
  const bench=byClass(doc.squadOut,'bench-player')[0];
  const benchName=text(byClass(bench,'pitch-name')[0]);
  bench.click();
  assert.equal(doc.playerDetailPanel.hidden,false);
  assert.equal(doc.playerDetailTitle.textContent,`${benchName} details`);
  assert.match(text(doc.playerDetailBody),/1 GW xP/);

  const allRow=byClass(doc.teamHomeSupport,'player-row-action')[0];
  const allName=text(byClass(allRow,'pname')[0]);
  allRow.click();
  assert.equal(doc.playerDetailTitle.textContent,`${allName} details`);
  assert.match(text(doc.playerDetailBody),/6 GW xP/);
});

test('valid and invalid transfer previews preserve fail-closed direct-render behaviour',()=>{
  const {T,doc,world}=legalRuntime();
  T.renderSquad();
  const real=T.mySquad(),out=real.find(slot=>slot.p.element_type===4);
  const incoming={...world.elements.find(player=>player.element_type===4),id:999,web_name:'Incoming FWD',team:19};
  T.S.boot.elements.push(incoming); T.S.byId[incoming.id]=incoming;
  const finalIds=real.map(slot=>slot.p.id===out.p.id?incoming.id:slot.p.id);
  T.decisionPreviewSelectTransfer({transferCount:1,transfers:[{outPlayerId:out.p.id,inPlayerId:incoming.id}],finalSquadIds:finalIds,
    netGain:1.2,hitCost:0,bankAfter:10,freeTransfersNextGW:1,previewHorizon:1},real,'valid');
  T.renderSquad();
  assert.equal(byClass(doc.squadOut,'decision-preview-banner').length,1);
  assert.equal(byClass(doc.squadOut,'incoming').length,1);
  const clear=walk(doc.squadOut).find(node=>node.tagName==='BUTTON'&&text(node)==='Clear preview');
  clear.click();
  assert.equal(T.decisionPreviewSnapshot().transfer,null);
  assert.equal(byClass(doc.squadOut,'decision-preview-banner').length,0);

  T.decisionPreviewSelectTransfer({transferCount:1,transfers:[{outPlayerId:out.p.id,inPlayerId:incoming.id}],finalSquadIds:[incoming.id]},real,'invalid');
  T.renderSquad();
  assert.equal(T.decisionPreviewSnapshot().transfer,null);
  assert.equal(byClass(doc.squadOut,'decision-preview-banner').length,0);
});

test('DTR-1 removes runtime renderer replacement and fixes deterministic module ownership',()=>{
  const team=readFileSync('src/ui/team-decision-home.mjs','utf8');
  const views=readFileSync('src/ui/views.mjs','utf8');
  const build=readFileSync('build.mjs','utf8');
  assert.doesNotMatch(team,/legacyRenderSquad|teamDecisionEnhanceRenderedTeam|renderSquad\s*=/);
  assert.match(views,/function renderSquad\(\)\{\s*return renderTeamDecisionHome/);
  const teamIndex=build.indexOf("'src/ui/team-decision-home.mjs'");
  const viewsIndex=build.indexOf("'src/ui/views.mjs'");
  const manualIndex=build.indexOf("'src/ui/manual-squad-runtime.mjs'");
  assert.ok(teamIndex>=0&&viewsIndex>teamIndex&&manualIndex>viewsIndex);
});
