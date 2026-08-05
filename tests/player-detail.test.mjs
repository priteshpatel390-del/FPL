import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PLAYER_DETAIL_SPREAD_THRESHOLDS,
  playerDetailSpread,
  playerDetailRangePosition,
  playerDetailAvailabilityLabel,
  playerDetailSetup,
  playerDetailOpen
} from '../src/ui/player-detail.mjs';

test('approved uncertainty labels use exact 2.0 and 5.0 point boundaries',()=>{
  assert.deepEqual(PLAYER_DETAIL_SPREAD_THRESHOLDS,{tightMax:2,moderateMax:5});
  assert.equal(playerDetailSpread({available:true,p25:1,p75:3,quality:'full'}).label,'Tight');
  assert.equal(playerDetailSpread({available:true,p25:1,p75:3.01,quality:'full'}).label,'Moderate');
  assert.equal(playerDetailSpread({available:true,p25:1,p75:6,quality:'full'}).label,'Moderate');
  assert.equal(playerDetailSpread({available:true,p25:1,p75:6.01,quality:'full'}).label,'Wide');
});

test('unavailable and reduced-quality simulations suppress descriptive labels',()=>{
  assert.deepEqual(playerDetailSpread({available:false,quality:'baseline-only'}),{
    available:false,label:null,width:null,quality:'baseline-only'
  });
  const reduced=playerDetailSpread({available:true,p25:2,p75:8,quality:'reduced'});
  assert.equal(reduced.width,6);
  assert.equal(reduced.label,null);
  assert.equal(reduced.quality,'reduced');
});

test('official doubtful status stays doubtful regardless of percentage',()=>{
  assert.equal(playerDetailAvailabilityLabel({status:'d',chance_of_playing_next_round:25}),'Doubtful');
  assert.equal(playerDetailAvailabilityLabel({status:'i'}),'Unavailable');
  assert.equal(playerDetailAvailabilityLabel({status:'a'}),'Available');
});

test('range marker positions are deterministic and bounded',()=>{
  assert.equal(playerDetailRangePosition(5,0,10),50);
  assert.equal(playerDetailRangePosition(-5,0,10),0);
  assert.equal(playerDetailRangePosition(15,0,10),100);
  assert.equal(playerDetailRangePosition(4,4,4),50);
});

test('dialog controller opens accessibly, closes on Escape and restores focus',()=>{
  const listeners={};
  const makeNode=id=>({
    id,nodeType:1,hidden:true,attrs:{},children:[],disabled:false,textContent:'',
    classList:{values:new Set(),add(v){this.values.add(v);},remove(v){this.values.delete(v);}},
    addEventListener(type,fn){listeners[`${id}:${type}`]=fn;},
    setAttribute(key,value){this.attrs[key]=String(value);},
    getAttribute(key){return this.attrs[key];},
    appendChild(child){this.children.push(child);child.parentNode=this;return child;},
    removeChild(child){this.children.splice(this.children.indexOf(child),1);},
    get firstChild(){return this.children[0]||null;},
    querySelectorAll(){return [nodes.playerDetailClose];},
    focus(){document.activeElement=this;this.focused=true;}
  });
  const nodes={
    playerDetailPanel:makeNode('playerDetailPanel'),
    playerDetailBackdrop:makeNode('playerDetailBackdrop'),
    playerDetailClose:makeNode('playerDetailClose'),
    playerDetailTitle:makeNode('playerDetailTitle'),
    playerDetailBody:makeNode('playerDetailBody')
  };
  const trigger=makeNode('trigger');
  trigger.hidden=false;
  globalThis.document={
    activeElement:trigger,
    body:{classList:{values:new Set(),add(v){this.values.add(v);},remove(v){this.values.delete(v);}}},
    getElementById:id=>nodes[id],
    addEventListener(type,fn){listeners[`document:${type}`]=fn;},
    createTextNode:text=>({nodeType:3,textContent:String(text)})
  };

  assert.equal(playerDetailSetup(),true);
  assert.equal(playerDetailOpen({title:'Saka details',body:['content'],trigger}),true);
  assert.equal(nodes.playerDetailPanel.hidden,false);
  assert.equal(nodes.playerDetailBackdrop.hidden,false);
  assert.equal(nodes.playerDetailPanel.attrs['aria-hidden'],'false');
  assert.equal(nodes.playerDetailTitle.textContent,'Saka details');
  assert.equal(nodes.playerDetailClose.focused,true);

  let prevented=false;
  listeners['document:keydown']({key:'Escape',preventDefault(){prevented=true;}});
  assert.equal(prevented,true);
  assert.equal(nodes.playerDetailPanel.hidden,true);
  assert.equal(nodes.playerDetailBackdrop.hidden,true);
  assert.equal(nodes.playerDetailPanel.attrs['aria-hidden'],'true');
  assert.equal(trigger.focused,true);
  delete globalThis.document;
});

test('template provides mobile bottom sheet and desktop side panel semantics',()=>{
  const html=readFileSync(new URL('../app.html',import.meta.url),'utf8');
  assert.match(html,/id="playerDetailPanel"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(html,/aria-labelledby="playerDetailTitle"/);
  assert.match(html,/id="playerDetailClose"[^>]*aria-label="Close player details"/);
  assert.match(html,/@media\(min-width:760px\)\{[\s\S]*\.player-detail-panel\{top:0;bottom:0;left:auto;right:0/);
});

test('player surfaces open the new detail view without the legacy inline drawer',()=>{
  const views=readFileSync(new URL('../src/ui/views.mjs',import.meta.url),'utf8');
  assert.match(views,/simulatePlayerGameweek\(p,S\.nextGW\)/);
  assert.match(views,/minutesEstimate\(p\)/);
  assert.match(views,/playerDetailOpen\(\{title:/);
  assert.match(views,/onclick:event=>openPlayerDetailView/);
  assert.doesNotMatch(views,/tr\.bd|class:'bd'/);
});
