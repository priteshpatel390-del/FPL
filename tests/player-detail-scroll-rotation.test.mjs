// UX-A2 — Player Detail scroll and rotation correction.
//
// The dialog is opened over a scrolled page. Locking `html`/`body` overflow is
// the only CSP-compatible way to stop the background moving, but mobile Safari
// can clamp or discard the page offset while that lock is applied, so the
// pre-open coordinates are captured and reapplied on a normal close. Route
// navigation is the exception: the router owns the destination scroll and
// focus, so nothing from the previous route may be replayed over it.
//
// The dialog controller only reads a live `document`, and it registers its
// route listener at module evaluation time, so the fake document is installed
// before the dynamic import below.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const listeners = {};
const scrollCalls = [];
const attached = new Set();

function makeNode(id){
  const node = {
    id, nodeType:1, hidden:true, attrs:{}, children:[], disabled:false, textContent:'',
    scrollTop:0, focusCount:0, lastFocusOptions:undefined,
    classList:{
      values:new Set(),
      add(v){ this.values.add(v); },
      remove(v){ this.values.delete(v); },
      contains(v){ return this.values.has(v); }
    },
    addEventListener(type,fn){ listeners[`${id}:${type}`] = fn; },
    setAttribute(key,value){ this.attrs[key] = String(value); },
    getAttribute(key){ return key in this.attrs ? this.attrs[key] : null; },
    appendChild(child){ this.children.push(child); child.parentNode = this; return child; },
    removeChild(child){ this.children.splice(this.children.indexOf(child),1); },
    get firstChild(){ return this.children[0] || null; },
    querySelectorAll(){ return [nodes.playerDetailClose]; },
    closest(){ return null; },
    focus(options){
      globalThis.document.activeElement = this;
      this.focusCount += 1;
      this.lastFocusOptions = options ?? null;
    }
  };
  attached.add(node);
  return node;
}

const nodes = {
  playerDetailPanel:makeNode('playerDetailPanel'),
  playerDetailBackdrop:makeNode('playerDetailBackdrop'),
  playerDetailClose:makeNode('playerDetailClose'),
  playerDetailTitle:makeNode('playerDetailTitle'),
  playerDetailBody:makeNode('playerDetailBody')
};
const documentElement = makeNode('documentElement');
const pageBody = makeNode('body');
const trigger = makeNode('trigger');
trigger.hidden = false;

globalThis.document = {
  documentElement,
  body:pageBody,
  activeElement:null,
  getElementById:id => nodes[id] || null,
  addEventListener(type,fn){ listeners[`document:${type}`] = fn; },
  createTextNode:text => ({nodeType:3, textContent:String(text)}),
  contains:node => attached.has(node)
};
globalThis.scrollTo = options => { scrollCalls.push(options); };
globalThis.scrollX = 0;
globalThis.scrollY = 0;

const {
  PLAYER_DETAIL_OPEN_CLASS,
  playerDetailOpen,
  playerDetailClose,
  playerDetailIsOpen,
  playerDetailCurrentScroll
} = await import('../src/ui/player-detail.mjs');

const source = readFileSync(new URL('../src/ui/player-detail.mjs',import.meta.url),'utf8');
const app = readFileSync(new URL('../app.html',import.meta.url),'utf8');
const shell = readFileSync(new URL('../src/ui/app-shell.mjs',import.meta.url),'utf8');
const detailCss = app.slice(
  app.indexOf('/* player detail sheet / panel */'),
  app.indexOf('/* temporary decision previews */')
);
const ruleBody = (css,selector) => {
  const found = new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\$&')}\\{([^}]*)\\}`).exec(css);
  assert.ok(found,`expected a ${selector} rule`);
  return found[1];
};

// Returns the dialog to a closed, unlocked, unscrolled starting point without
// leaving saved coordinates or a saved trigger behind.
function reset(){
  if(playerDetailIsOpen()) playerDetailClose({restoreFocus:false, restoreScroll:false});
  scrollCalls.length = 0;
  for(const node of [...Object.values(nodes), documentElement, pageBody, trigger]){
    node.attrs = {};
    node.scrollTop = 0;
    node.focusCount = 0;
    node.lastFocusOptions = undefined;
    node.classList.values.clear();
  }
  for(const node of Object.values(nodes)) node.hidden = true;
  trigger.hidden = false;
  attached.add(trigger);
  globalThis.document.activeElement = null;
  globalThis.scrollX = 0;
  globalThis.scrollY = 0;
}

// Reproduces the platform behaviour the correction exists for: applying the
// overflow lock can drop the page to the top while the dialog is open.
const simulateLockClampingPageToTop = () => { globalThis.scrollX = 0; globalThis.scrollY = 0; };

test('fresh open captures the exact background offset and a normal close restores it',()=>{
  reset();
  globalThis.scrollX = 17;
  globalThis.scrollY = 940;
  assert.equal(playerDetailOpen({title:'Saka', body:['detail'], trigger}),true);
  simulateLockClampingPageToTop();
  assert.equal(playerDetailClose(),true);
  assert.deepEqual(scrollCalls.at(-1),{top:940, left:17, behavior:'auto'});
});

test('opening locks both the root element and the body, closing unlocks both',()=>{
  reset();
  playerDetailOpen({title:'Saka', body:['detail'], trigger});
  assert.equal(documentElement.classList.contains(PLAYER_DETAIL_OPEN_CLASS),true);
  assert.equal(pageBody.classList.contains(PLAYER_DETAIL_OPEN_CLASS),true);
  playerDetailClose();
  assert.equal(documentElement.classList.contains(PLAYER_DETAIL_OPEN_CLASS),false);
  assert.equal(pageBody.classList.contains(PLAYER_DETAIL_OPEN_CLASS),false);
});

test('every open starts the detail content at the top',()=>{
  reset();
  playerDetailOpen({title:'Saka', body:['detail'], trigger});
  nodes.playerDetailBody.scrollTop = 620;
  playerDetailClose();
  playerDetailOpen({title:'Saka', body:['detail'], trigger});
  assert.equal(nodes.playerDetailBody.scrollTop,0);
});

test('open focuses the close control without scrolling the page',()=>{
  reset();
  playerDetailOpen({title:'Saka', body:['detail'], trigger});
  assert.equal(nodes.playerDetailClose.focusCount,1);
  assert.deepEqual(nodes.playerDetailClose.lastFocusOptions,{preventScroll:true});
  assert.equal(globalThis.document.activeElement,nodes.playerDetailClose);
});

test('normal close restores the trigger without scrolling the page',()=>{
  reset();
  globalThis.scrollY = 500;
  playerDetailOpen({title:'Saka', body:['detail'], trigger});
  playerDetailClose();
  assert.equal(trigger.focusCount,1);
  assert.deepEqual(trigger.lastFocusOptions,{preventScroll:true});
});

test('the close button, the backdrop and Escape all close and restore the page',()=>{
  for(const [name,fire] of [
    ['close button',()=>listeners['playerDetailClose:click']({})],
    ['backdrop',()=>listeners['playerDetailBackdrop:click']({})],
    ['Escape',()=>listeners['document:keydown']({key:'Escape',preventDefault(){}})]
  ]){
    reset();
    globalThis.scrollX = 3;
    globalThis.scrollY = 812;
    playerDetailOpen({title:'Saka', body:['detail'], trigger});
    simulateLockClampingPageToTop();
    fire();
    assert.equal(nodes.playerDetailPanel.hidden,true,`${name} hides the panel`);
    assert.equal(nodes.playerDetailBackdrop.hidden,true,`${name} hides the backdrop`);
    assert.equal(nodes.playerDetailPanel.attrs['aria-hidden'],'true',`${name} marks the panel hidden`);
    assert.equal(pageBody.classList.contains(PLAYER_DETAIL_OPEN_CLASS),false,`${name} unlocks the body`);
    assert.equal(documentElement.classList.contains(PLAYER_DETAIL_OPEN_CLASS),false,`${name} unlocks the root`);
    assert.deepEqual(scrollCalls.at(-1),{top:812, left:3, behavior:'auto'},`${name} restores the page`);
    assert.equal(trigger.focusCount,1,`${name} restores the trigger`);
  }
});

test('replacing the displayed player while open keeps the original saved position and trigger',()=>{
  reset();
  const otherTrigger = makeNode('otherTrigger');
  otherTrigger.hidden = false;
  globalThis.scrollX = 8;
  globalThis.scrollY = 1240;
  playerDetailOpen({title:'Saka', body:['first'], trigger});
  simulateLockClampingPageToTop();
  playerDetailOpen({title:'Salah', body:['second'], trigger:otherTrigger});
  assert.equal(nodes.playerDetailTitle.textContent,'Salah');
  assert.equal(nodes.playerDetailBody.scrollTop,0);
  playerDetailClose();
  assert.deepEqual(scrollCalls.at(-1),{top:1240, left:8, behavior:'auto'});
  assert.equal(trigger.focusCount,1);
  assert.equal(otherTrigger.focusCount,0);
});

test('route-driven close unlocks without replaying the previous route scroll or focus',()=>{
  reset();
  globalThis.scrollX = 4;
  globalThis.scrollY = 1500;
  playerDetailOpen({title:'Saka', body:['detail'], trigger});
  scrollCalls.length = 0;
  listeners['document:teamsheet:before-route-change']({detail:{from:'#/team', to:'#/transfers'}});
  assert.equal(nodes.playerDetailPanel.hidden,true);
  assert.equal(documentElement.classList.contains(PLAYER_DETAIL_OPEN_CLASS),false);
  assert.equal(pageBody.classList.contains(PLAYER_DETAIL_OPEN_CLASS),false);
  assert.deepEqual(scrollCalls,[]);
  assert.equal(trigger.focusCount,0);
});

test('a route change with the dialog already closed changes nothing',()=>{
  reset();
  listeners['document:teamsheet:before-route-change']({detail:{from:'#/team', to:'#/transfers'}});
  assert.deepEqual(scrollCalls,[]);
  assert.equal(trigger.focusCount,0);
});

test('detached or hidden triggers are never focused on close',()=>{
  for(const [name,make] of [
    ['detached',()=>{ const node = makeNode('detachedTrigger'); node.hidden = false; attached.delete(node); return node; }],
    ['hidden',()=>{ const node = makeNode('hiddenTrigger'); node.hidden = true; return node; }]
  ]){
    reset();
    const candidate = make();
    playerDetailOpen({title:'Saka', body:['detail'], trigger:candidate});
    playerDetailClose();
    assert.equal(candidate.focusCount,0,`${name} trigger is not focused`);
  }
});

test('the captured offset falls back through the documented viewport properties',()=>{
  reset();
  delete globalThis.scrollX;
  delete globalThis.scrollY;
  globalThis.pageXOffset = 11;
  globalThis.pageYOffset = 222;
  assert.deepEqual(playerDetailCurrentScroll(),{left:11, top:222});
  delete globalThis.pageXOffset;
  delete globalThis.pageYOffset;
  documentElement.scrollLeft = 5;
  documentElement.scrollTop = 77;
  assert.deepEqual(playerDetailCurrentScroll(),{left:5, top:77});
  documentElement.scrollLeft = undefined;
  documentElement.scrollTop = undefined;
  assert.deepEqual(playerDetailCurrentScroll(),{left:0, top:0});
  globalThis.scrollX = 0;
  globalThis.scrollY = 0;
});

test('the detail content is the only scrollable modal region and uses robust flex scrolling',()=>{
  const panel = ruleBody(detailCss,'.player-detail-panel');
  const body = ruleBody(detailCss,'.player-detail-body');
  assert.match(panel,/display:flex/);
  assert.match(panel,/flex-direction:column/);
  assert.match(panel,/overflow:hidden/);
  assert.doesNotMatch(panel,/overflow-y:auto/);
  assert.match(body,/flex:1 1 auto/);
  assert.match(body,/min-height:0/);
  assert.match(body,/overflow-y:auto/);
  assert.match(body,/-webkit-overflow-scrolling:touch/);
  assert.match(body,/overscroll-behavior:contain/);
  // A shrinking header would clip the close control before the content scrolls.
  assert.match(ruleBody(detailCss,'.player-detail-top'),/flex:0 0 auto/);
});

test('panel height declares a conventional viewport fallback before dvh',()=>{
  const heights = [...ruleBody(detailCss,'.player-detail-panel').matchAll(/max-height:([^;]+)/g)].map(m => m[1]);
  assert.deepEqual(heights,['min(88vh,780px)','min(88dvh,780px)']);
});

test('compact phone landscape uses the full viewport height',()=>{
  const query = /@media\(max-width:759px\) and \(orientation:landscape\) and \(max-height:520px\)\{([\s\S]*?)\n\}/.exec(detailCss);
  assert.ok(query,'expected a compact landscape media query');
  assert.match(query[1],/\.player-detail-panel\{[^}]*top:0[^}]*bottom:0/);
  const heights = [...query[1].matchAll(/max-height:([^;}]+)/g)].map(m => m[1]);
  assert.deepEqual(heights,['100vh','100dvh']);
  assert.match(query[1],/\.player-detail-grip\{display:none\}/);
});

test('background scrolling is locked on both the root element and the body',()=>{
  const lock = /html\.player-detail-open,body\.player-detail-open\{([^}]*)\}/.exec(detailCss);
  assert.ok(lock,'expected a combined root and body lock rule');
  assert.match(lock[1],/overflow:hidden/);
  assert.match(lock[1],/overscroll-behavior:none/);
  assert.match(ruleBody(detailCss,'.player-detail-backdrop'),/overscroll-behavior:contain/);
});

test('safe areas are respected on all four sides',()=>{
  for(const side of ['top','right','bottom','left'])
    assert.match(detailCss,new RegExp(`env\\(safe-area-inset-${side}`),`missing safe-area-inset-${side}`);
});


test('Player Detail layers above the fixed primary dock so final content cannot be covered',()=>{
  const numericZIndex = (css,label) => {
    const match = /(?:^|;)z-index:(\d+)/.exec(css);
    assert.ok(match,`expected numeric z-index for ${label}`);
    return Number(match[1]);
  };
  const navRules = [...app.matchAll(/(?:^|\n)nav\.tabs\{([^}]*)\}/g)].map(match => match[1]);
  assert.ok(navRules.length >= 1,'expected primary dock CSS');
  const dockZIndex = Math.max(...navRules.map((rule,index) => numericZIndex(rule,`primary dock rule ${index + 1}`)));
  const backdropZIndex = numericZIndex(ruleBody(detailCss,'.player-detail-backdrop'),'Player Detail backdrop');
  const panelZIndex = numericZIndex(ruleBody(detailCss,'.player-detail-panel'),'Player Detail panel');
  assert.ok(backdropZIndex > dockZIndex,'the modal backdrop must cover the fixed primary dock');
  assert.ok(panelZIndex > backdropZIndex,'the modal panel must sit above its backdrop');
});

// The physical iPhone Safari review found the first portrait → landscape →
// portrait cycle left the text permanently enlarged: Safari applies automatic
// text inflation at the root document on rotation. Fixing the root text size
// adjustment at 100% suppresses that inflation. Both the WebKit property and
// the standards property are required, and neither may be achieved by
// disabling the user's own pinch zoom.
test('the production root rule fixes text size adjustment so rotation cannot inflate text',()=>{
  const root = ruleBody(app,'html');
  assert.match(root,/-webkit-text-size-adjust:100%/,'missing -webkit-text-size-adjust:100%');
  assert.match(root,/(?:^|;)text-size-adjust:100%/,'missing standards text-size-adjust:100%');
  const viewport = /<meta name="viewport" content="([^"]*)">/.exec(app);
  assert.ok(viewport,'expected viewport metadata');
  assert.doesNotMatch(viewport[1],/user-scalable\s*=\s*no/);
  assert.doesNotMatch(viewport[1],/maximum-scale/);
});

test('Player Detail remains a dialog and never becomes a route',()=>{
  assert.match(app,/id="playerDetailPanel"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.doesNotMatch(source,/location\s*\.\s*hash/);
  assert.doesNotMatch(source,/history\s*\.\s*(?:pushState|replaceState)/);
  assert.doesNotMatch(source,/__teamsheetNavigate/);
  // The router owns navigation; it must not know the dialog exists, and the
  // dialog must close from the router's own event rather than a history entry.
  assert.doesNotMatch(shell,/playerDetail/);
  assert.match(source,/teamsheet:before-route-change/);
});

test('the dialog controller introduces no runtime inline styling',()=>{
  assert.doesNotMatch(source,/\.style\b/);
  assert.doesNotMatch(source,/cssText/);
  assert.doesNotMatch(source,/setAttribute\(\s*['"]style/);
  assert.doesNotMatch(source,/\bstyle\s*:/);
});

test('the dialog controller reaches no data, model or projection behaviour',()=>{
  const imports = [...source.matchAll(/^import\s[\s\S]*?from\s*'([^']+)';/gm)].map(m => m[1]);
  assert.deepEqual(imports,['../util.mjs']);
  for(const forbidden of [/\bfetch\s*\(/, /localStorage/, /simulate/i, /expectedPoints/i, /minutesEstimate/i])
    assert.doesNotMatch(source,forbidden);
});
