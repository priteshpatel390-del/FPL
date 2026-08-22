/* GW1-P2C5 — temporary, production-origin-only acceptance control.

   There is deliberately no route card, setting, gesture or persistent enable
   flag. The panel exists only at the exact deadline-evidence route when the
   explicit query gate is present on the intended production application
   origin and the candidate's generated fixture matches its predeclared hash. */

import { $, el, setChildren } from '../util.mjs';
import {
  STAGE10_ACCEPTANCE_SEASON,STAGE10_ACCEPTANCE_GAMEWEEK,
  STAGE10_ACCEPTANCE_CONTENT_HASH,STAGE10_ACCEPTANCE_SNAPSHOT_ID,
  buildStage10AcceptanceFixture,isExactStage10AcceptanceIdentity
} from '../evidence/stage10-acceptance.mjs';
import { storeEvidenceRecord, loadEvidenceRecord } from './evidence.mjs';
import { renderDeliveryStatus } from './evidence-delivery.mjs';

const STAGE10_ACCEPTANCE_ORIGIN = 'https://app.fpltsheet.co.uk';
const STAGE10_ACCEPTANCE_QUERY = 'stage10Acceptance';
const STAGE10_ACCEPTANCE_ROUTE = '#/settings/evidence/deadline';
let stage10AcceptanceBusy=false;
let stage10AcceptanceComplete=false;

function stage10AcceptanceGate(locationRef=globalThis.location){
  if(!locationRef || locationRef.origin!==STAGE10_ACCEPTANCE_ORIGIN || locationRef.hash!==STAGE10_ACCEPTANCE_ROUTE) return false;
  try{return new URLSearchParams(locationRef.search).get(STAGE10_ACCEPTANCE_QUERY)==='1';}
  catch(error){return false;}
}

async function verifiedStage10AcceptanceFixture(){
  const fixture=await buildStage10AcceptanceFixture();
  return isExactStage10AcceptanceIdentity(fixture) ? fixture : null;
}

async function runStage10Acceptance(){
  const button=$('stage10AcceptanceRun'),message=$('stage10AcceptanceMessage');
  if(stage10AcceptanceBusy||stage10AcceptanceComplete||!stage10AcceptanceGate()) return false;
  stage10AcceptanceBusy=true;
  if(button) button.disabled=true;
  if(message) message.textContent='Creating and securing the synthetic fixture on this device…';
  try{
    const fixture=await verifiedStage10AcceptanceFixture();
    if(!fixture) throw new Error('candidate fixture identity mismatch');
    const existing=await loadEvidenceRecord(STAGE10_ACCEPTANCE_SNAPSHOT_ID);
    if(!existing) await storeEvidenceRecord(fixture);
    stage10AcceptanceComplete=true;
    if(message) message.textContent='Synthetic fixture stored locally. Normal background archive delivery has been scheduled.';
    await renderDeliveryStatus();
    return true;
  }catch(error){
    if(message) message.textContent='Synthetic acceptance could not be created. No direct archive request was made.';
    if(button) button.disabled=false;
    return false;
  }finally{stage10AcceptanceBusy=false;}
}

async function renderStage10Acceptance(){
  const existing=$('stage10AcceptancePanel');
  if(!stage10AcceptanceGate()) { existing?.remove?.(); return false; }
  const fixture=await verifiedStage10AcceptanceFixture();
  if(!fixture){ existing?.remove?.(); return false; }
  const host=$('evidenceDeliveryHost');
  if(!host) return false;
  if(!existing){
    const panel=el('section',{class:'panel settings-content-panel',id:'stage10AcceptancePanel'},
      el('span',{class:'eyebrow'},'Acceptance only'),
      el('h3',{},'Synthetic Stage 10 infrastructure acceptance'),
      el('div',{class:'note plain'},el('b',{},`Synthetic ${STAGE10_ACCEPTANCE_SEASON} · GW${STAGE10_ACCEPTANCE_GAMEWEEK}`),
        document.createTextNode(' Incomplete, non-official and provider-disabled. It contains no genuine FPL evidence.')),
      el('p',{class:'status'},`Snapshot ID: ${STAGE10_ACCEPTANCE_SNAPSHOT_ID}`),
      el('p',{class:'status'},`Full hash: ${STAGE10_ACCEPTANCE_CONTENT_HASH}`),
      el('button',{class:'btn ghost',id:'stage10AcceptanceRun',type:'button'},'Run archive acceptance'),
      el('p',{class:'status evidence-message',id:'stage10AcceptanceMessage'},'No synthetic evidence has been created by this control in this page session.'));
    host.appendChild(panel);
    $('stage10AcceptanceRun')?.addEventListener('click',()=>void runStage10Acceptance());
  }
  const stored=await loadEvidenceRecord(STAGE10_ACCEPTANCE_SNAPSHOT_ID);
  if(stored&&isExactStage10AcceptanceIdentity(stored)){
    stage10AcceptanceComplete=true;
    const button=$('stage10AcceptanceRun');if(button)button.disabled=true;
    const message=$('stage10AcceptanceMessage');if(message)message.textContent='The exact synthetic fixture already exists on this device; repeated activation is disabled.';
  }
  return true;
}

function initStage10AcceptanceUi(){
  if(typeof document==='undefined') return;
  document.addEventListener('teamsheet:route-changed',()=>void renderStage10Acceptance());
  globalThis.addEventListener?.('hashchange',()=>void renderStage10Acceptance());
  void renderStage10Acceptance();
}

initStage10AcceptanceUi();

export {
  STAGE10_ACCEPTANCE_ORIGIN,STAGE10_ACCEPTANCE_QUERY,STAGE10_ACCEPTANCE_ROUTE,
  stage10AcceptanceGate,verifiedStage10AcceptanceFixture,runStage10Acceptance,
  renderStage10Acceptance,initStage10AcceptanceUi
};
