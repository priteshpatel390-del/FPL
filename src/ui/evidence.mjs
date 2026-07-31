import { S } from '../state.mjs';
import { $, num, el, setChildren } from '../util.mjs';
import { recordStage10Diagnostic, stage10Diagnostics, stage10DiagnosticMessage, stage10Journal, parseStage10Journal } from './evidence-recovery.mjs';
import { requestStage10Download, stage10DownloadRequestedMessage } from './download.mjs';
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
const K_EVIDENCE_JOURNAL = 'fpl:evidence:pending:v1';
const MAX_EVIDENCE_IMPORT_BYTES = 25 * 1024 * 1024;
const EVIDENCE_ORIGINS = Object.freeze({LOCAL:'local_capture',RECOVERY:'recovery_import'});
const AUTO_CAPTURE_PRIORITY = Object.freeze({open:1,due_soon:2,ideal:3,final_window:4});
const AUTO_CAPTURE_RETRY_MS=5*60*1000;
const AUTO_CAPTURE_MAX_ATTEMPTS=3;
let autoCaptureVerifiedAt=0;
const autoCaptureAttempts=new Map();
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
  try{
    const stream=new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    const bytes=new Uint8Array(await new Response(stream).arrayBuffer());
    return `gzip-base64:${bytesToBase64(bytes)}`;
  }catch(error){
    recordStage10Diagnostic('compression_fallback',{recordType:record?.recordType,recordId:record?.identity?.snapshotId||record?.identity?.outcomeId||record?.identity?.evaluationId||record?.identity?.transferEvaluationId,severity:'warning',message:'Native compression failed; canonical plain JSON was stored instead.'});
    return text;
  }
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
    .map(row=>{
      const origin=Object.values(EVIDENCE_ORIGINS).includes(row.origin)?row.origin:EVIDENCE_ORIGINS.RECOVERY;
      return {
        ...row,
        origin,
        recordOfficialEligible:row.recordOfficialEligible===undefined?Boolean(row.officialEligible):Boolean(row.recordOfficialEligible),
        officialEligible:origin===EVIDENCE_ORIGINS.LOCAL&&Boolean(row.officialEligible)
      };
    })
    .sort((a,b)=>Date.parse(b.capturedAt)-Date.parse(a.capturedAt)||a.snapshotId.localeCompare(b.snapshotId))
    .slice(0,EVIDENCE_RULES.localIndexLimit);
}
async function loadEvidenceIndex(){
  const raw = await rawEvidenceGet(K_EVIDENCE_INDEX);
  if(!raw) return [];
  try{ return normaliseEvidenceIndex(JSON.parse(raw)); }
  catch(error){recordStage10Diagnostic('index_corrupt',{recordType:'preDeadlineSnapshot',severity:'error',message:error.message});return [];}
}
async function loadEvidenceRecord(snapshotId){
  if(!snapshotId) return null;
  const raw = await rawEvidenceGet(K_EVIDENCE_PREFIX+snapshotId);
  if(!raw) return null;
  try{
    const checked = await validateSnapshotRecord(JSON.parse(await decodeEvidenceRecord(raw)));
    if(!checked.ok){recordStage10Diagnostic(checked.reason==='schema_version'?'unsupported_version':'payload_corrupt',{recordType:'preDeadlineSnapshot',recordId:snapshotId,severity:'error',message:checked.reason});return null;}
    return checked.record;
  }catch(error){recordStage10Diagnostic('payload_corrupt',{recordType:'preDeadlineSnapshot',recordId:snapshotId,severity:'error',message:error.message});return null;}
}
async function writeEvidenceJournal(record,origin,phase){
  const journal=stage10Journal({recordType:'preDeadlineSnapshot',recordId:record.identity.snapshotId,contentHash:record.identity.contentHash,logicalKey:record.identity.duplicateKey,origin,phase});
  await rawEvidenceSet(K_EVIDENCE_JOURNAL,stableStringify(journal));
  return journal;
}
async function recoverEvidenceJournal(){
  const raw=await rawEvidenceGet(K_EVIDENCE_JOURNAL);if(!raw)return false;
  const journal=parseStage10Journal(raw);
  if(!journal||journal.recordType!=='preDeadlineSnapshot'){
    recordStage10Diagnostic('journal_corrupt',{recordType:'preDeadlineSnapshot',severity:'error'});await rawEvidenceDelete(K_EVIDENCE_JOURNAL).catch(()=>{});return true;
  }
  const index=await loadEvidenceIndex(),record=await loadEvidenceRecord(journal.recordId);
  if(record&&record.identity.contentHash===journal.contentHash){
    const origin=journal.origin===EVIDENCE_ORIGINS.LOCAL?EVIDENCE_ORIGINS.LOCAL:EVIDENCE_ORIGINS.RECOVERY;
    const next=boundedSnapshotIndex(index,record,{origin}),keep=new Set(next.slice(0,EVIDENCE_RULES.localFullRecordLimit).map(row=>row.snapshotId));
    await rawEvidenceSet(K_EVIDENCE_INDEX,stableStringify(next));
    for(const row of index){if(!keep.has(row.snapshotId))await rawEvidenceDelete(K_EVIDENCE_PREFIX+row.snapshotId).catch(()=>{});}
    activeEvidenceRecord=record;recordStage10Diagnostic('recovery_completed',{recordType:'preDeadlineSnapshot',recordId:journal.recordId,severity:'info'});
  }else{
    if(!index.some(row=>row.snapshotId===journal.recordId))await rawEvidenceDelete(K_EVIDENCE_PREFIX+journal.recordId).catch(()=>{});
    recordStage10Diagnostic('payload_corrupt',{recordType:'preDeadlineSnapshot',recordId:journal.recordId,severity:'error'});
  }
  await rawEvidenceDelete(K_EVIDENCE_JOURNAL).catch(()=>{});return true;
}
async function storeEvidenceRecord(record,{origin=EVIDENCE_ORIGINS.LOCAL}={}){
  if(!Object.values(EVIDENCE_ORIGINS).includes(origin)) throw new Error('Evidence origin is not supported');
  const checked = await validateSnapshotRecord(record);
  if(!checked.ok) throw new Error(`Evidence record rejected: ${checked.reason}`);
  const existing = await loadEvidenceIndex(),nextIndex = boundedSnapshotIndex(existing,checked.record,{origin});
  const keep = new Set(nextIndex.slice(0,EVIDENCE_RULES.localFullRecordLimit).map(row=>row.snapshotId));
  const knownIds = new Set(existing.map(row=>row.snapshotId).concat(checked.record.identity.snapshotId));
  const toDelete = [...knownIds].filter(snapshotId=>!keep.has(snapshotId));
  await writeEvidenceJournal(checked.record,origin,'prepared');
  try{
    if(keep.has(checked.record.identity.snapshotId)){
      const key=K_EVIDENCE_PREFIX+checked.record.identity.snapshotId,encoded=await encodeEvidenceRecord(checked.record);
      try{ await rawEvidenceSet(key,encoded); }
      catch(firstError){
        for(const snapshotId of toDelete) await rawEvidenceDelete(K_EVIDENCE_PREFIX+snapshotId).catch(()=>{});
        try{ await rawEvidenceSet(key,encoded); }
        catch(secondError){recordStage10Diagnostic('storage_full',{recordType:'preDeadlineSnapshot',recordId:checked.record.identity.snapshotId,severity:'error',message:secondError.message});throw new Error(`Evidence storage failed after recovery: ${secondError.message}`);}
      }
      const verified=await loadEvidenceRecord(checked.record.identity.snapshotId);if(!verified||verified.identity.contentHash!==checked.record.identity.contentHash)throw new Error('Evidence storage verification failed');
    }
    await writeEvidenceJournal(checked.record,origin,'payload_verified');
    await rawEvidenceSet(K_EVIDENCE_INDEX,stableStringify(nextIndex));
    await writeEvidenceJournal(checked.record,origin,'index_committed');
    for(const snapshotId of toDelete) await rawEvidenceDelete(K_EVIDENCE_PREFIX+snapshotId).catch(()=>{});
    activeEvidenceRecord = checked.record;
    await rawEvidenceDelete(K_EVIDENCE_JOURNAL).catch(()=>{});
    return nextIndex;
  }catch(error){if(/quota|storage|space|full/i.test(error.message))recordStage10Diagnostic('storage_full',{recordType:'preDeadlineSnapshot',recordId:checked.record.identity.snapshotId,severity:'error',message:error.message});throw error;}
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
  await rawEvidenceDelete(K_EVIDENCE_JOURNAL).catch(()=>{});
  await rawEvidenceDelete(K_EVIDENCE_MANAGER);
  activeEvidenceRecord=null;
  return true;
}
function evidenceFileName(record){
  return `teamsheet-${record.season}-gw${record.gameweek}-predeadline-${record.identity.snapshotId.slice(-16)}.json`;
}
function downloadEvidence(record){
  const filename=evidenceFileName(record);requestStage10Download(filename,stableStringify(record)+'\n','application/json');return filename;
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
    unavailable:['Waiting for season data','Automatic evidence starts after verified data is available.'],
    too_early:['Evidence not due yet',`Automatic capture opens 24 hours before the deadline.`],
    open:['Automatic evidence armed','The next verified refresh will secure a pre-deadline record.'],
    due_soon:['Automatic evidence due soon','Teamsheet will secure the latest verified decision state.'],
    ideal:['Ideal automatic window','The latest verified state will be secured without user action.'],
    final_window:['Final automatic window','Teamsheet will fail closed at the two-minute safety cutoff.'],
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
  if(typeof globalThis.__teamsheetNavigate==='function') globalThis.__teamsheetNavigate('#/settings/evidence');
  else if(globalThis.location) globalThis.location.hash='#/settings/evidence';
}
function ensureEvidenceCompact(){
  $('evidenceCompact')?.remove?.();
}
function ensureStage10OperationsUi(){
  const panel=$('evidencePanel');if(!panel||$('stage10Operations'))return;
  panel.appendChild(el('details',{class:'mt-12',id:'stage10Operations'},
    el('summary',{},'Live-season checklist and recovery'),
    el('div',{class:'mt-10'},
      el('p',{class:'hint'},'Before each deadline, confirm Official-eligible evidence and request the snapshot JSON. After a complete or corrected outcome, request the weekly operating-review JSON and confirm it appears in Files or Downloads.'),
      el('p',{class:'hint'},'Restored JSON remains recovery-only. Never clear browser data until durable files have been checked. Google Sheets import remains manual.'),
      el('div',{id:'stage10Diagnostics'},el('div',{class:'status'},'No recovery warning is active.')))));
}
function renderStage10Diagnostics(){
  const node=$('stage10Diagnostics');if(!node)return;const rows=stage10Diagnostics();
  if(!rows.length){setChildren(node,el('div',{class:'status'},'No recovery warning is active.'));return;}
  setChildren(node,rows.slice(0,5).map(row=>el('article',{class:`note ${row.severity==='error'?'bad':'plain'}`},el('b',{},row.code.replaceAll('_',' ')),el('div',{class:'status'},stage10DiagnosticMessage(row.code)),row.recordId?el('div',{class:'status mono'},row.recordId):null)));
}
async function renderEvidenceStatus(){
  const sequence=++evidenceRenderSequence;
  ensureEvidenceCompact();ensureStage10OperationsUi();
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
    capture.textContent=evidenceBusy?'Securing evidence…':'Diagnostic capture';
  }
  const exportButton=$('exportEvidenceBtn');
  if(exportButton) exportButton.disabled=!(activeEvidenceRecord||latest);
  const history=$('evidenceHistory');
  renderStage10Diagnostics();
  if(history){
    if(!index.length) setChildren(history,el('div',{class:'status'},'No evidence snapshots saved on this device.'));
    else setChildren(history,index.map(row=>el('article',{class:'note plain'},
      el('div',{},el('b',{},`GW${row.gameweek} · ${row.origin===EVIDENCE_ORIGINS.RECOVERY?'Recovery only':row.officialEligible?'Official-eligible':'Recorded only'}`),el('span',{class:`flag ${evidenceFlagClass(row.timingGrade)}`},row.timingGrade.replaceAll('_',' '))),
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
async function captureEvidence({automatic=false}={}){
  if(evidenceBusy) return null;
  evidenceBusy=true; await renderEvidenceStatus();
  const message=$('evidenceMessage');
  try{
    const managerRef=await evidenceManagerRef();
    const horizon=Math.max(1,Math.min(8,Math.trunc(num($('trHorizon')?.value)||6)));
    if(message) message.textContent=automatic?'Securing verified deadline evidence…':'Freezing the current verified state…';
    const record=await capturePreDeadlineSnapshot({managerRef,horizon});
    await storeEvidenceRecord(record,{origin:EVIDENCE_ORIGINS.LOCAL});
    if(message) message.textContent=record.timing.officialEligible
      ? `Evidence secured automatically for GW${record.gameweek}.`
      : `Evidence recorded for GW${record.gameweek}, but it cannot qualify officially: ${record.timing.reasons.join(', ').replaceAll('_',' ')}.`;
    return record;
  }catch(error){
    if(message) message.textContent=`Evidence capture failed: ${error.message}`;
    return null;
  }finally{
    evidenceBusy=false; await renderEvidenceStatus();
  }
}
function captureWindowPriority(deadlineTime,capturedAt=Date.now()){
  const state=deadlineWindow(deadlineTime,capturedAt).state;
  return AUTO_CAPTURE_PRIORITY[state]||0;
}
async function maybeAutoCaptureEvidence({reason='verified_refresh',verifiedAt=null}={}){
  const deadline=currentDeadline();
  if(!deadline||!S.boot||evidenceBusy) return {captured:false,reason:'not_ready'};
  if(Number.isFinite(Number(verifiedAt))&&Number(verifiedAt)!==autoCaptureVerifiedAt){autoCaptureVerifiedAt=Number(verifiedAt);autoCaptureAttempts.clear();}
  const priority=captureWindowPriority(deadline,Date.now());
  if(!priority) return {captured:false,reason:'outside_window'};
  const index=await loadEvidenceIndex();
  const existing=index.find(row=>row.origin===EVIDENCE_ORIGINS.LOCAL&&Number(row.gameweek)===Number(S.nextGW)&&row.deadlineTime===new Date(deadline).toISOString()&&row.officialEligible);
  const existingPriority=existing?captureWindowPriority(deadline,Date.parse(existing.capturedAt)):0;
  if(existing&&existingPriority>=priority) return {captured:false,reason:'equivalent_or_better_exists',snapshotId:existing.snapshotId};
  const key=`${new Date(deadline).toISOString()}|${priority}|${autoCaptureVerifiedAt}`;
  const attempts=autoCaptureAttempts.get(key)||0;if(attempts>=AUTO_CAPTURE_MAX_ATTEMPTS)return {captured:false,reason:'retry_limit'};
  autoCaptureAttempts.set(key,attempts+1);
  const record=await captureEvidence({automatic:true});
  return record?{captured:true,reason,snapshotId:record.identity.snapshotId,attempt:attempts+1}:{captured:false,reason:'capture_failed',attempt:attempts+1};
}

async function exportLatestEvidence(){
  const message=$('evidenceMessage');
  try{
    const record=await latestEvidenceRecord();
    if(!record) throw new Error('No saved snapshot is available');
    const filename=downloadEvidence(record);recordStage10Diagnostic('download_requested',{recordType:'preDeadlineSnapshot',recordId:record.identity.snapshotId,severity:'info'});
    if(message) message.textContent=stage10DownloadRequestedMessage(filename);
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
    await storeEvidenceRecord(checked.record,{origin:EVIDENCE_ORIGINS.RECOVERY});
    if(message) message.textContent=`Imported ${checked.record.identity.snapshotId} as recovery-only evidence. It cannot become the official prospective record.`;
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
  document.addEventListener('teamsheet:data-verified',event=>{
    const task=maybeAutoCaptureEvidence({reason:event.detail?.reason||'verified_refresh',verifiedAt:event.detail?.verifiedAt});
    if(typeof event.detail?.waitUntil==='function') event.detail.waitUntil(task);
  });
  void recoverEvidenceJournal().then(renderEvidenceStatus);
  setInterval(renderEvidenceStatus,60*1000);
  setInterval(()=>{if(!document.visibilityState||document.visibilityState==='visible')void maybeAutoCaptureEvidence({reason:'visible_retry'});},AUTO_CAPTURE_RETRY_MS);
}

initEvidenceUi();

export {
  K_EVIDENCE_MANAGER,
  K_EVIDENCE_INDEX,
  K_EVIDENCE_PREFIX,
  K_EVIDENCE_JOURNAL,
  MAX_EVIDENCE_IMPORT_BYTES,
  EVIDENCE_ORIGINS,
  AUTO_CAPTURE_PRIORITY,
  AUTO_CAPTURE_RETRY_MS,
  AUTO_CAPTURE_MAX_ATTEMPTS,
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
  recoverEvidenceJournal,
  captureWindowPriority,
  maybeAutoCaptureEvidence,
  clearEvidenceStorage,
  evidenceFileName,
  renderEvidenceStatus,
  initEvidenceUi
};
