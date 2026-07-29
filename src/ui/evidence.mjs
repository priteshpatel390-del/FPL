import { S } from '../state.mjs';
import { $, num, el, setChildren } from '../util.mjs';
import { loadAll } from '../main.mjs';
import {
  EVIDENCE_RULES,
  stableStringify,
  deadlineWindow,
  capturePreDeadlineSnapshot,
  validateSnapshotRecord,
  boundedSnapshotIndex
} from '../evidence/snapshot.mjs';

const K_EVIDENCE_MANAGER = 'fpl:evidence-manager-ref';
const K_EVIDENCE_INDEX = 'fpl:evidence-index';
const K_EVIDENCE_PREFIX = 'fpl:evidence:snapshot:';
const MAX_EVIDENCE_IMPORT_BYTES = 25 * 1024 * 1024;
let activeEvidenceRecord = null;
let evidenceBusy = false;
let evidenceRenderSequence = 0;

function bytesToBase64(bytes){
  let binary='';
  const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk) binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
  return btoa(binary);
}
function base64ToBytes(value){
  const binary=atob(value), bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  return bytes;
}
async function encodeEvidenceRecord(record){
  const text=stableStringify(record);
  if(typeof CompressionStream!=='function') return text;
  const stream=new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes=new Uint8Array(await new Response(stream).arrayBuffer());
  return `gzip-base64:${bytesToBase64(bytes)}`;
}
async function decodeEvidenceRecord(value){
  const text=String(value||'');
  if(!text.startsWith('gzip-base64:')) return text;
  if(typeof DecompressionStream!=='function') throw new Error('Compressed evidence cannot be read in this browser');
  const bytes=base64ToBytes(text.slice('gzip-base64:'.length));
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

async function rawEvidenceGet(key){
  if(globalThis.window?.storage){
    const result = await window.storage.get(key);
    return result?.value ?? null;
  }
  return globalThis.localStorage?.getItem(key) ?? null;
}
async function rawEvidenceSet(key,value){
  const text = String(value);
  if(globalThis.window?.storage) await window.storage.set(key,text);
  else if(globalThis.localStorage) localStorage.setItem(key,text);
  else throw new Error('Persistent browser storage is unavailable');
  const verified = await rawEvidenceGet(key);
  if(verified !== text) throw new Error('Evidence storage verification failed');
}
async function rawEvidenceDelete(key){
  if(globalThis.window?.storage){
    if(typeof window.storage.delete === 'function') await window.storage.delete(key);
    else await window.storage.set(key,'');
  }else if(globalThis.localStorage) localStorage.removeItem(key);
  else throw new Error('Persistent browser storage is unavailable');
  const verified=await rawEvidenceGet(key);
  if(verified!==null&&verified!=='') throw new Error('Evidence deletion verification failed');
}
async function evidenceManagerRef(cryptoImpl=globalThis.crypto){
  const existing = await rawEvidenceGet(K_EVIDENCE_MANAGER);
  if(existing && /^mgr-[0-9a-f]{32}$/.test(existing)) return existing;
  if(!cryptoImpl?.getRandomValues) throw new Error('Secure random identifiers are unavailable');
  const bytes = new Uint8Array(16); cryptoImpl.getRandomValues(bytes);
  const value = 'mgr-' + Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
  await rawEvidenceSet(K_EVIDENCE_MANAGER,value);
  return value;
}
function normaliseEvidenceIndex(value){
  if(!Array.isArray(value)) return [];
  return value.filter(row=>row&&typeof row==='object'&&
    /^predeadline-gw\d+-[0-9a-f]{16}$/.test(row.snapshotId||'')&&
    /^[0-9a-f]{64}$/.test(row.contentHash||'')&&
    Number.isInteger(row.gameweek)&&row.gameweek>=1&&row.gameweek<=38&&
    Number.isFinite(Date.parse(row.capturedAt))&&Number.isFinite(Date.parse(row.deadlineTime)))
    .sort((a,b)=>Date.parse(b.capturedAt)-Date.parse(a.capturedAt)||a.snapshotId.localeCompare(b.snapshotId))
    .slice(0,EVIDENCE_RULES.localIndexLimit);
}
async function loadEvidenceIndex(){
  const raw = await rawEvidenceGet(K_EVIDENCE_INDEX);
  if(!raw) return [];
  try{ return normaliseEvidenceIndex(JSON.parse(raw)); }
  catch(error){ return []; }
}
async function loadEvidenceRecord(snapshotId){
  if(!snapshotId) return null;
  const raw = await rawEvidenceGet(K_EVIDENCE_PREFIX+snapshotId);
  if(!raw) return null;
  try{
    const checked = await validateSnapshotRecord(JSON.parse(await decodeEvidenceRecord(raw)));
    return checked.ok ? checked.record : null;
  }catch(error){ return null; }
}
async function storeEvidenceRecord(record){
  const checked = await validateSnapshotRecord(record);
  if(!checked.ok) throw new Error(`Evidence record rejected: ${checked.reason}`);
  const existing = await loadEvidenceIndex();
  const nextIndex = boundedSnapshotIndex(existing,checked.record);
  const keep = new Set(nextIndex.slice(0,EVIDENCE_RULES.localFullRecordLimit).map(row=>row.snapshotId));
  const knownIds = new Set(existing.map(row=>row.snapshotId).concat(checked.record.identity.snapshotId));
  const toDelete = [...knownIds].filter(snapshotId=>!keep.has(snapshotId));
  if(keep.has(checked.record.identity.snapshotId)){
    const key=K_EVIDENCE_PREFIX+checked.record.identity.snapshotId;
    const encoded=await encodeEvidenceRecord(checked.record);
    try{ await rawEvidenceSet(key,encoded); }
    catch(firstError){
      for(const snapshotId of toDelete) await rawEvidenceDelete(K_EVIDENCE_PREFIX+snapshotId);
      try{ await rawEvidenceSet(key,encoded); }
      catch(secondError){ throw new Error(`Evidence storage failed after recovery: ${secondError.message}`); }
    }
  }
  for(const snapshotId of toDelete) await rawEvidenceDelete(K_EVIDENCE_PREFIX+snapshotId);
  await rawEvidenceSet(K_EVIDENCE_INDEX,stableStringify(nextIndex));
  activeEvidenceRecord = checked.record;
  return nextIndex;
}
async function clearEvidenceStorage(){
  const existing=await loadEvidenceIndex();
  for(const row of existing) await rawEvidenceDelete(K_EVIDENCE_PREFIX+row.snapshotId);
  if(!globalThis.window?.storage&&globalThis.localStorage){
    const orphanKeys=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(key?.startsWith(K_EVIDENCE_PREFIX)) orphanKeys.push(key);
    }
    for(const key of orphanKeys) await rawEvidenceDelete(key);
  }
  await rawEvidenceDelete(K_EVIDENCE_INDEX);
  await rawEvidenceDelete(K_EVIDENCE_MANAGER);
  activeEvidenceRecord=null;
  return true;
}
function evidenceFileName(record){
  return `teamsheet-${record.season}-gw${record.gameweek}-predeadline-${record.identity.snapshotId.slice(-16)}.json`;
}
function downloadEvidence(record){
  const blob = new Blob([stableStringify(record)+'\n'],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href=url; anchor.download=evidenceFileName(record); anchor.rel='noopener';
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),0);
}
function currentDeadline(){
  const event = S.boot?.events?.find(row=>Number(row.id)===Number(S.nextGW));
  return event?.deadline_time || null;
}
function minutesLabel(ms){
  if(ms == null) return '';
  const total=Math.max(0,Math.ceil(ms/60000));
  if(total<60) return `${total}m`;
  const hours=Math.floor(total/60), minutes=total%60;
  if(hours<24) return minutes?`${hours}h ${minutes}m`:`${hours}h`;
  const days=Math.floor(hours/24); return `${days}d`;
}
function windowCopy(windowState){
  const labels={
    unavailable:['Waiting for season data','Load data before capturing evidence.'],
    too_early:['Capture not open yet',`The evidence window opens 24 hours before the deadline.`],
    open:['Capture window open','Refresh and freeze before the final hour.'],
    due_soon:['Evidence due soon','The deadline is within one hour.'],
    ideal:['Ideal capture window','Freeze the final decision state now.'],
    final_window:['Final safe window','Capture now; the two-minute safety cutoff is close.'],
    safety_cutoff:['Safety cutoff reached','A new snapshot cannot qualify as the official pre-deadline record.'],
    closed:['Deadline passed','Missed snapshots are not backfilled.']
  };
  return labels[windowState]||labels.unavailable;
}
function evidenceFlagClass(state){
  if(state==='ideal'||state==='open') return 'rise';
  if(state==='due_soon'||state==='final_window'||state==='client_recorded') return 'doubt';
  if(state==='network_attested') return 'rise';
  if(state==='too_early'||state==='unavailable') return 'dark';
  return 'out';
}
function openEvidencePanel(){
  document.querySelector('nav.tabs .tab[data-view="more"]')?.click();
  const panel=$('evidencePanel');
  setTimeout(()=>{ panel?.scrollIntoView?.({block:'start'}); panel?.focus?.({preventScroll:true}); },0);
}
function ensureEvidenceCompact(){
  const header=document.querySelector('header');
  if(!header||$('evidenceCompact')) return;
  const button=el('button',{id:'evidenceCompact',type:'button',class:'chip','aria-controls':'evidencePanel','aria-label':'Validation evidence status'},
    'Evidence ',el('span',{class:'flag dark'},'Waiting'));
  button.addEventListener('click',openEvidencePanel);
  header.appendChild(button);
}
async function renderEvidenceStatus(){
  const sequence=++evidenceRenderSequence;
  ensureEvidenceCompact();
  const deadline=currentDeadline();
  const state=deadline?deadlineWindow(deadline):{state:'unavailable',remainingMs:null};
  const [title,detail]=windowCopy(state.state);
  const index=await loadEvidenceIndex();
  if(sequence!==evidenceRenderSequence) return;
  const latest=index[0]||null;
  const latestForCurrent=latest&&Number(latest.gameweek)===Number(S.nextGW)?latest:null;
  const compact=$('evidenceCompact');
  const compactState=latestForCurrent?.timingGrade||state.state;
  const compactLabel=latestForCurrent
    ? (latest.officialEligible?'Captured':'Recorded')
    : state.state==='ideal'?'Due now':state.state==='due_soon'||state.state==='final_window'?'Due soon':state.state==='closed'?'Missed':'Waiting';
  if(compact){
    setChildren(compact,document.createTextNode('Evidence '),el('span',{class:`flag ${evidenceFlagClass(compactState)}`},compactLabel));
    compact.setAttribute('aria-label',`Validation evidence: ${compactLabel}. Open evidence controls.`);
  }
  const status=$('evidenceStatus');
  if(status){
    const remaining=state.remainingMs!=null&&state.remainingMs>0?` ${minutesLabel(state.remainingMs)} remaining.`:'';
    setChildren(status,el('b',{},title),document.createTextNode(' '+detail+remaining));
    status.className=`note ${['ideal','open'].includes(state.state)?'good':['due_soon','final_window'].includes(state.state)?'plain':['safety_cutoff','closed'].includes(state.state)?'bad':'plain'}`;
  }
  const deadlineNode=$('evidenceDeadline');
  if(deadlineNode) deadlineNode.textContent=deadline
    ? `GW${S.nextGW} deadline: ${new Date(deadline).toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZoneName:'short'})}`
    : 'Deadline unavailable.';
  const capture=$('captureEvidenceBtn');
  if(capture){
    capture.disabled=evidenceBusy||!['open','due_soon','ideal','final_window'].includes(state.state);
    capture.textContent=evidenceBusy?'Refreshing and freezing…':'Refresh & freeze';
  }
  const exportButton=$('exportEvidenceBtn');
  if(exportButton) exportButton.disabled=!(activeEvidenceRecord||latest);
  const history=$('evidenceHistory');
  if(history){
    if(!index.length) setChildren(history,el('div',{class:'status'},'No evidence snapshots saved on this device.'));
    else setChildren(history,index.map(row=>el('article',{class:'note plain'},
      el('div',{},el('b',{},`GW${row.gameweek} · ${row.officialEligible?'Official-eligible':'Recorded only'}`),el('span',{class:`flag ${evidenceFlagClass(row.timingGrade)}`},row.timingGrade.replaceAll('_',' '))),
      el('div',{class:'status'},`${new Date(row.capturedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} · ${row.snapshotId}`))));
  }
}
async function latestEvidenceRecord(){
  const index=await loadEvidenceIndex();
  const latestId=index[0]?.snapshotId;
  if(!latestId) return null;
  if(activeEvidenceRecord?.identity?.snapshotId===latestId) return activeEvidenceRecord;
  activeEvidenceRecord=await loadEvidenceRecord(latestId);
  return activeEvidenceRecord;
}
async function captureEvidence(){
  if(evidenceBusy) return;
  evidenceBusy=true; await renderEvidenceStatus();
  const message=$('evidenceMessage');
  try{
    if(message) message.textContent='Refreshing FPL and optional providers before the freeze…';
    await loadAll({awaitOptional:true});
    const managerRef=await evidenceManagerRef();
    const horizon=Math.max(1,Math.min(8,Math.trunc(num($('trHorizon')?.value)||6)));
    if(message) message.textContent='Freezing model outputs and checking deadline evidence…';
    const record=await capturePreDeadlineSnapshot({managerRef,horizon});
    await storeEvidenceRecord(record);
    if(message) message.textContent=record.timing.officialEligible
      ? `Saved ${record.identity.snapshotId}. Network-attested and eligible to be the official GW${record.gameweek} snapshot.`
      : `Saved ${record.identity.snapshotId}, but it is recorded-only: ${record.timing.reasons.join(', ').replaceAll('_',' ')}.`;
  }catch(error){
    if(message) message.textContent=`Evidence capture failed: ${error.message}`;
  }finally{
    evidenceBusy=false; await renderEvidenceStatus();
  }
}
async function exportLatestEvidence(){
  const message=$('evidenceMessage');
  try{
    const record=await latestEvidenceRecord();
    if(!record) throw new Error('No saved snapshot is available');
    downloadEvidence(record);
    if(message) message.textContent=`Exported ${evidenceFileName(record)}.`;
  }catch(error){ if(message) message.textContent=`Export failed: ${error.message}`; }
}
async function deleteEvidence(){
  const message=$('evidenceMessage');
  try{
    if(typeof globalThis.confirm==='function'&&!globalThis.confirm('Delete all locally stored validation evidence and the anonymous device reference? Exported JSON files will not be affected.')) return;
    await clearEvidenceStorage();
    if(message) message.textContent='Local evidence and the anonymous device reference were deleted. Exported JSON files were not affected.';
  }catch(error){ if(message) message.textContent=`Delete failed: ${error.message}`; }
  finally{ await renderEvidenceStatus(); }
}
async function importEvidenceFile(file){
  const message=$('evidenceMessage');
  try{
    if(!file) return;
    if(Number(file.size)>MAX_EVIDENCE_IMPORT_BYTES) throw new Error('file exceeds the 25 MB evidence limit');
    const parsed=JSON.parse(await file.text());
    const checked=await validateSnapshotRecord(parsed);
    if(!checked.ok) throw new Error(`record rejected (${checked.reason})`);
    await storeEvidenceRecord(checked.record);
    if(message) message.textContent=`Imported and verified ${checked.record.identity.snapshotId}.`;
  }catch(error){ if(message) message.textContent=`Import failed: ${error.message}`; }
  finally{ await renderEvidenceStatus(); }
}
function initEvidenceUi(){
  if(typeof document==='undefined') return;
  ensureEvidenceCompact();
  $('captureEvidenceBtn')?.addEventListener('click',captureEvidence);
  $('exportEvidenceBtn')?.addEventListener('click',exportLatestEvidence);
  $('importEvidenceBtn')?.addEventListener('click',()=> $('evidenceImport')?.click());
  $('deleteEvidenceBtn')?.addEventListener('click',deleteEvidence);
  $('evidenceImport')?.addEventListener('change',event=>{
    const file=event.target.files?.[0]; importEvidenceFile(file); event.target.value='';
  });
  document.addEventListener('teamsheet:data-rendered',renderEvidenceStatus);
  renderEvidenceStatus();
  setInterval(renderEvidenceStatus,60*1000);
}

initEvidenceUi();

export {
  K_EVIDENCE_MANAGER,
  K_EVIDENCE_INDEX,
  K_EVIDENCE_PREFIX,
  MAX_EVIDENCE_IMPORT_BYTES,
  normaliseEvidenceIndex,
  bytesToBase64,
  base64ToBytes,
  encodeEvidenceRecord,
  decodeEvidenceRecord,
  rawEvidenceGet,
  rawEvidenceSet,
  rawEvidenceDelete,
  evidenceManagerRef,
  loadEvidenceIndex,
  loadEvidenceRecord,
  storeEvidenceRecord,
  clearEvidenceStorage,
  evidenceFileName,
  renderEvidenceStatus,
  initEvidenceUi
};
