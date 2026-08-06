import { $, num, clamp, setChildren } from '../util.mjs';

const PLAYER_DETAIL_SPREAD_THRESHOLDS = Object.freeze({tightMax:2, moderateMax:5});
const PLAYER_DETAIL_OPEN_CLASS = 'player-detail-open';
let playerDetailPreviousFocus = null;
let playerDetailSavedScroll = null;
let playerDetailSetupDone = false;

function playerDetailSpread(summary = {}){
  if(!summary || summary.available !== true)
    return {available:false,label:null,width:null,quality:summary?.quality || null};
  const p25 = num(summary.p25), p75 = num(summary.p75);
  const width = Math.max(0,p75-p25);
  const quality = summary.quality || 'full';
  const label = quality === 'reduced' ? null
    : width <= PLAYER_DETAIL_SPREAD_THRESHOLDS.tightMax ? 'Tight'
    : width <= PLAYER_DETAIL_SPREAD_THRESHOLDS.moderateMax ? 'Moderate'
    : 'Wide';
  return {available:true,label,width,quality,p25,p75};
}

function playerDetailRangePosition(value,min,max){
  const low = num(min), high = num(max);
  if(high <= low) return 50;
  return clamp((num(value)-low)/(high-low)*100,0,100);
}

function playerDetailAvailabilityLabel(p = {}){
  if(['i','u','s','n'].includes(p.status)) return 'Unavailable';
  if(p.status === 'd') return 'Doubtful';
  return 'Available';
}

function playerDetailCanRestoreFocus(node){
  if(!node||typeof node.focus!=='function') return false;
  if(typeof document!=='undefined'&&typeof document.contains==='function'&&!document.contains(node)) return false;
  if(node.hidden||node.getAttribute?.('aria-hidden')==='true') return false;
  if(node.closest?.('[hidden],[aria-hidden="true"]')) return false;
  return true;
}

// The background is locked by class only: no runtime inline style is permitted
// by the hash-locked CSP. Because `html`/`body` overflow locking can clamp or
// discard the page offset on mobile Safari, the exact pre-open coordinates are
// captured here and reapplied on a normal close.
function playerDetailCurrentScroll(){
  const view = typeof globalThis !== 'undefined' ? globalThis : {};
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  const axis = (primary,secondary,fallback) => {
    const value = Number(primary ?? secondary ?? fallback ?? 0);
    return Number.isFinite(value) ? value : 0;
  };
  return {
    left: axis(view.scrollX, view.pageXOffset, root?.scrollLeft),
    top: axis(view.scrollY, view.pageYOffset, root?.scrollTop)
  };
}

// Both the root element and the body carry the open state: body-only locking
// leaks background scrolling on mobile Safari.
function playerDetailSetLock(locked){
  if(typeof document === 'undefined') return;
  for(const node of [document.documentElement, document.body]){
    if(!node?.classList) continue;
    if(locked) node.classList.add(PLAYER_DETAIL_OPEN_CLASS);
    else node.classList.remove(PLAYER_DETAIL_OPEN_CLASS);
  }
}

function playerDetailIsOpen(){
  if(typeof document === 'undefined') return false;
  const panel = $('playerDetailPanel');
  return Boolean(panel) && panel.hidden === false;
}

// `restoreScroll` and `restoreFocus` are both suppressed for route-driven
// closure: the router owns the destination route's scroll and focus, so
// reapplying the previous route's coordinates or trigger would be stale.
function playerDetailClose({restoreFocus=true, restoreScroll=true}={}){
  if(typeof document === 'undefined') return false;
  const panel = $('playerDetailPanel'), backdrop = $('playerDetailBackdrop');
  if(!panel || !backdrop) return false;
  panel.hidden = true;
  backdrop.hidden = true;
  panel.setAttribute('aria-hidden','true');
  playerDetailSetLock(false);
  const saved = playerDetailSavedScroll;
  const restore = playerDetailPreviousFocus;
  playerDetailSavedScroll = null;
  playerDetailPreviousFocus = null;
  if(restoreScroll && saved && typeof globalThis.scrollTo === 'function')
    globalThis.scrollTo({top:saved.top, left:saved.left, behavior:'auto'});
  if(restoreFocus&&playerDetailCanRestoreFocus(restore)) restore.focus({preventScroll:true});
  return true;
}

function playerDetailSetup(){
  if(typeof document === 'undefined') return false;
  if(playerDetailSetupDone) return true;
  const panel = $('playerDetailPanel'), backdrop = $('playerDetailBackdrop'), close = $('playerDetailClose');
  if(!panel || !backdrop || !close) return false;
  // Wrapped so the DOM event object can never be read as close options.
  close.addEventListener('click',()=>playerDetailClose());
  backdrop.addEventListener('click',()=>playerDetailClose());
  document.addEventListener('keydown',event => {
    if(panel.hidden) return;
    if(event.key === 'Escape'){
      if(typeof event.preventDefault === 'function') event.preventDefault();
      playerDetailClose();
      return;
    }
    if(event.key !== 'Tab') return;
    const focusable = Array.from(panel.querySelectorAll(
      'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
    )).filter(node => !node.disabled && node.getAttribute?.('aria-hidden') !== 'true');
    if(!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length-1];
    if(event.shiftKey && document.activeElement === first){
      if(typeof event.preventDefault === 'function') event.preventDefault();
      last.focus();
    } else if(!event.shiftKey && document.activeElement === last){
      if(typeof event.preventDefault === 'function') event.preventDefault();
      first.focus();
    }
  });
  playerDetailSetupDone = true;
  return true;
}

function playerDetailOpen({title = '', body = [], trigger = null} = {}){
  if(!playerDetailSetup()) return false;
  const panel = $('playerDetailPanel'), backdrop = $('playerDetailBackdrop');
  const titleNode = $('playerDetailTitle'), bodyNode = $('playerDetailBody'), close = $('playerDetailClose');
  // Swapping the displayed player while the dialog is already open must not
  // overwrite the true background position with a locked-state reading, nor
  // move focus restoration away from the element the user actually left.
  if(!playerDetailIsOpen()){
    playerDetailSavedScroll = playerDetailCurrentScroll();
    playerDetailPreviousFocus = trigger || document.activeElement || null;
  }
  titleNode.textContent = String(title);
  setChildren(bodyNode,body);
  if(bodyNode) bodyNode.scrollTop = 0;
  backdrop.hidden = false;
  panel.hidden = false;
  panel.setAttribute('aria-hidden','false');
  playerDetailSetLock(true);
  if(close && typeof close.focus === 'function') close.focus({preventScroll:true});
  return true;
}

if(typeof document !== 'undefined'){
  playerDetailSetup();
  document.addEventListener('teamsheet:before-route-change',()=>{
    if(playerDetailIsOpen()) playerDetailClose({restoreFocus:false,restoreScroll:false});
  });
}

export {
  PLAYER_DETAIL_SPREAD_THRESHOLDS,
  PLAYER_DETAIL_OPEN_CLASS,
  playerDetailSpread,
  playerDetailRangePosition,
  playerDetailAvailabilityLabel,
  playerDetailCanRestoreFocus,
  playerDetailCurrentScroll,
  playerDetailIsOpen,
  playerDetailSetup,
  playerDetailOpen,
  playerDetailClose
};
