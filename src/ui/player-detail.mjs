import { $, num, clamp, setChildren } from '../util.mjs';

const PLAYER_DETAIL_SPREAD_THRESHOLDS = Object.freeze({tightMax:2, moderateMax:5});
let playerDetailPreviousFocus = null;
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

function playerDetailClose(){
  if(typeof document === 'undefined') return false;
  const panel = $('playerDetailPanel'), backdrop = $('playerDetailBackdrop');
  if(!panel || !backdrop) return false;
  panel.hidden = true;
  backdrop.hidden = true;
  panel.setAttribute('aria-hidden','true');
  if(document.body?.classList) document.body.classList.remove('player-detail-open');
  const restore = playerDetailPreviousFocus;
  playerDetailPreviousFocus = null;
  if(restore && typeof restore.focus === 'function') restore.focus();
  return true;
}

function playerDetailSetup(){
  if(typeof document === 'undefined') return false;
  if(playerDetailSetupDone) return true;
  const panel = $('playerDetailPanel'), backdrop = $('playerDetailBackdrop'), close = $('playerDetailClose');
  if(!panel || !backdrop || !close) return false;
  close.addEventListener('click',playerDetailClose);
  backdrop.addEventListener('click',playerDetailClose);
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
  playerDetailPreviousFocus = trigger || document.activeElement || null;
  titleNode.textContent = String(title);
  setChildren(bodyNode,body);
  backdrop.hidden = false;
  panel.hidden = false;
  panel.setAttribute('aria-hidden','false');
  if(document.body?.classList) document.body.classList.add('player-detail-open');
  if(close && typeof close.focus === 'function') close.focus();
  return true;
}

if(typeof document !== 'undefined') playerDetailSetup();

export {
  PLAYER_DETAIL_SPREAD_THRESHOLDS,
  playerDetailSpread,
  playerDetailRangePosition,
  playerDetailSetup,
  playerDetailOpen,
  playerDetailClose
};
