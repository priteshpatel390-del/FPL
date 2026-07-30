import { S } from '../state.mjs';
import { $, el, setChildren } from '../util.mjs';
import { recordStage10Diagnostic, stage10Journal, parseStage10Journal, reconcileLocalCurrentRows } from './evidence-recovery.mjs';
import { requestStage10Download, stage10DownloadRequestedMessage } from './download.mjs';
import { api } from '../providers/transport.mjs';
import {
  OUTCOME_RULES, captureGameweekOutcome, dueOutcomeGameweeks, validateOutcomeRecord
} from '../evidence/outcome.mjs';
import {
  stableStringify
} from '../evidence/snapshot.mjs';
import {
  rawEvidenceGet, rawEvidenceSet, rawEvidenceDelete, encodeEvidenceRecord, decodeEvidenceRecord,
  evidenceManagerRef, loadEvidenceIndex, loadEvidenceRecord
} from './evidence.mjs';

const K_OUTCOME_INDEX='fpl:evidence-outcome:index:v1';
const K_OUTCOME_PREFIX='fpl:evidence-outcome:record:';
const K_OUTCOME_JOURNAL='fpl:evidence-outcome:pending:v1';
const MAX_OUTCOME_IMPORT_BYTES=25*1024*1024;
const OUTCOME_ORIGINS=Object.freeze({LOCAL:'local_collection',RECOVERY:'recovery_import'});
let outcomeBusy=false;
let outcomePromise=null;
let lastOutcomeCheckAt=0;
let outcomeRenderSequence=0;

function normaliseOutcomeIndex(value){
  if(!Array.isArray(value)) return [];
  return value.filter(row=>row&&typeof row==='object'&&
    /^outcome-\d{4}-\d{2}-gw\d+-r\d+-[0-9a-f]{16}$/.test(row.outcomeId||'')&&
    /^[0-9a-f]{64}$/.test(row.contentHash||'')&&
    /^[0-9a-f]{64}$/.test(row.outcomeDataHash||'')&&
    Number.isInteger(Number(row.gameweek))&&Number(row.gameweek)>=1&&Number(row.gameweek)<=38&&
    Number.isFinite(Date.parse(row.collectedAt)))
    .map(row=>({
      ...row,
      gameweek:Number(row.gameweek),
      revision:Math.max(1,Number(row.revision)||1),
      origin:Object.values(OUTCOME_ORIGINS).includes(row.origin)?row.origin:OUTCOME_ORIGINS.RECOVERY,
      current:row.origin===OUTCOME_ORIGINS.LOCAL&&Boolean(row.current),
      hasFullRecord:Boolean(row.hasFullRecord)
    }))
    .sort((a,b)=>Date.parse(b.collectedAt)-Date.parse(a.collectedAt)||b.revision-a.revision||a.outcomeId.localeCompare(b.outcomeId))
    .slice(0,OUTCOME_RULES.localIndexLimit);
}
async function loadOutcomeIndex(){
  const raw=await rawEvidenceGet(K_OUTCOME_INDEX);if(!raw)return [];
  try{return normaliseOutcomeIndex(JSON.parse(raw));}catch(error){recordStage10Diagnostic('index_corrupt',{recordType:'gameweekOutcome',severity:'error',message:error.message});return [];}
}
async function loadOutcomeRecord(outcomeId){
  if(!outcomeId)return null;const raw=await rawEvidenceGet(K_OUTCOME_PREFIX+outcomeId);if(!raw)return null;
  try{const checked=await validateOutcomeRecord(JSON.parse(await decodeEvidenceRecord(raw)));if(!checked.ok){recordStage10Diagnostic(checked.reason==='schema_version'?'unsupported_version':'payload_corrupt',{recordType:'gameweekOutcome',recordId:outcomeId,severity:'error',message:checked.reason});return null;}return checked.record;}catch(error){recordStage10Diagnostic('payload_corrupt',{recordType:'gameweekOutcome',recordId:outcomeId,severity:'error',message:error.message});return null;}
}
function compactOutcomeMetadata(record,{origin=OUTCOME_ORIGINS.LOCAL,current=true,hasFullRecord=true,lastCheckedAt=null}={}){
  return {
    outcomeId:record.identity.outcomeId,
    rootOutcomeId:record.identity.rootOutcomeId,
    logicalKey:record.identity.logicalKey,
    contentHash:record.identity.contentHash,
    outcomeDataHash:record.identity.outcomeDataHash,
    season:record.season,
    gameweek:record.gameweek,
    revision:record.identity.revision,
    status:record.status,
    collectedAt:record.collection.completedAt,
    finalisedAt:record.collection.finalisedAt,
    deadlineTime:record.officialDeadlineIdentity.deadlineTime,
    relatedSnapshotStatus:record.relatedSnapshot.status,
    relatedSnapshotId:record.relatedSnapshot.snapshotId,
    origin,
    current:origin===OUTCOME_ORIGINS.LOCAL&&Boolean(current),
    hasFullRecord:Boolean(hasFullRecord),
    lastCheckedAt:lastCheckedAt||record.collection.completedAt
  };
}
async function outcomeEncodedSize(value){
  if(typeof TextEncoder!=='undefined') return new TextEncoder().encode(String(value)).length;
  return String(value).length*2;
}
async function removeOutcomePayload(outcomeId){
  await rawEvidenceDelete(K_OUTCOME_PREFIX+outcomeId);
}
function outcomeFullRecordKeepSet(index,newId=null){
  const current=index.filter(row=>row.origin===OUTCOME_ORIGINS.LOCAL&&row.current).map(row=>row.outcomeId);
  const recovery=index.filter(row=>row.origin===OUTCOME_ORIGINS.RECOVERY).slice(0,1).map(row=>row.outcomeId);
  const superseded=index.filter(row=>row.origin===OUTCOME_ORIGINS.LOCAL&&!row.current&&row.hasFullRecord).slice(0,OUTCOME_RULES.supersededFullLimit).map(row=>row.outcomeId);
  return new Set([...current,...recovery,...superseded,...(newId?[newId]:[])]);
}
async function enforceOutcomeBounds(index){
  let rows=normaliseOutcomeIndex(index);
  let keep=outcomeFullRecordKeepSet(rows);
  for(const row of rows){
    if(row.hasFullRecord&&!keep.has(row.outcomeId)){
      await removeOutcomePayload(row.outcomeId);
      row.hasFullRecord=false;
    }
  }
  const payloads=[];
  for(const row of rows.filter(item=>item.hasFullRecord)){
    const raw=await rawEvidenceGet(K_OUTCOME_PREFIX+row.outcomeId);
    if(raw!=null) payloads.push({row,bytes:await outcomeEncodedSize(raw)});
    else row.hasFullRecord=false;
  }
  let total=payloads.reduce((sum,item)=>sum+item.bytes,0);
  const droppable=payloads.filter(item=>!item.row.current).sort((a,b)=>Date.parse(a.row.collectedAt)-Date.parse(b.row.collectedAt));
  for(const item of droppable){
    if(total<=OUTCOME_RULES.maxEncodedBytes) break;
    await removeOutcomePayload(item.row.outcomeId);
    item.row.hasFullRecord=false;
    total-=item.bytes;
  }
  if(total>OUTCOME_RULES.maxEncodedBytes) throw new Error('Current official outcome records exceed the local storage budget');
  await rawEvidenceSet(K_OUTCOME_INDEX,stableStringify(rows));
  return rows;
}
async function storeOutcomeRecord(record,{origin=OUTCOME_ORIGINS.LOCAL}={}){
  if(!Object.values(OUTCOME_ORIGINS).includes(origin)) throw new Error('Outcome origin is not supported');
  const checked=await validateOutcomeRecord(record);
  if(!checked.ok) throw new Error(`Outcome record rejected: ${checked.reason}`);
  let index=await loadOutcomeIndex();
  const same=index.find(row=>row.origin===origin&&row.logicalKey===checked.record.identity.logicalKey&&row.outcomeDataHash===checked.record.identity.outcomeDataHash&&row.status===checked.record.status);
  if(same) return {index,stored:false,metadata:same};
  if(origin===OUTCOME_ORIGINS.LOCAL){
    index=index.map(row=>row.origin===OUTCOME_ORIGINS.LOCAL&&row.logicalKey===checked.record.identity.logicalKey?{...row,current:false}:row);
  }
  const metadata=compactOutcomeMetadata(checked.record,{origin,current:origin===OUTCOME_ORIGINS.LOCAL,hasFullRecord:true});
  index=normaliseOutcomeIndex([metadata,...index.filter(row=>row.outcomeId!==metadata.outcomeId)]);
  const encoded=await encodeEvidenceRecord(checked.record);
  const priorCurrent=index.find(row=>row.origin===OUTCOME_ORIGINS.LOCAL&&row.logicalKey===metadata.logicalKey&&row.current)?.outcomeId||null;
  await rawEvidenceSet(K_OUTCOME_JOURNAL,stableStringify(stage10Journal({recordType:'gameweekOutcome',recordId:metadata.outcomeId,contentHash:metadata.contentHash,logicalKey:metadata.logicalKey,origin,priorCurrentId:priorCurrent,phase:'prepared'})));
  try{
    try{ await rawEvidenceSet(K_OUTCOME_PREFIX+metadata.outcomeId,encoded); }
    catch(firstError){
      const stale=index.filter(row=>row.hasFullRecord&&!row.current&&row.outcomeId!==metadata.outcomeId);
      for(const row of stale) await removeOutcomePayload(row.outcomeId);
      await rawEvidenceSet(K_OUTCOME_PREFIX+metadata.outcomeId,encoded);
    }
    const verified=await loadOutcomeRecord(metadata.outcomeId);
    if(!verified||verified.identity.contentHash!==metadata.contentHash) throw new Error('Outcome storage verification failed');
    await rawEvidenceSet(K_OUTCOME_JOURNAL,stableStringify(stage10Journal({recordType:'gameweekOutcome',recordId:metadata.outcomeId,contentHash:metadata.contentHash,logicalKey:metadata.logicalKey,origin,priorCurrentId:priorCurrent,phase:'payload_verified'})));
    index=await enforceOutcomeBounds(index);
    await rawEvidenceSet(K_OUTCOME_JOURNAL,stableStringify(stage10Journal({recordType:'gameweekOutcome',recordId:metadata.outcomeId,contentHash:metadata.contentHash,logicalKey:metadata.logicalKey,origin,priorCurrentId:priorCurrent,phase:'index_committed'})));
    return {index,stored:true,metadata};
  }finally{
    await rawEvidenceDelete(K_OUTCOME_JOURNAL).catch(()=>{});
  }
}
async function recoverOutcomeJournal(){
  const raw=await rawEvidenceGet(K_OUTCOME_JOURNAL);if(!raw)return false;const journal=parseStage10Journal(raw);
  if(!journal||journal.recordType!=='gameweekOutcome'){recordStage10Diagnostic('journal_corrupt',{recordType:'gameweekOutcome',severity:'error'});await rawEvidenceDelete(K_OUTCOME_JOURNAL).catch(()=>{});return true;}
  const record=await loadOutcomeRecord(journal.recordId),index=await loadOutcomeIndex();
  if(record&&record.identity.contentHash===journal.contentHash){
    const origin=journal.origin===OUTCOME_ORIGINS.LOCAL?OUTCOME_ORIGINS.LOCAL:OUTCOME_ORIGINS.RECOVERY;
    const metadata=compactOutcomeMetadata(record,{origin,current:origin===OUTCOME_ORIGINS.LOCAL});
    let next=normaliseOutcomeIndex([metadata,...index.filter(row=>row.outcomeId!==metadata.outcomeId)]);
    next=reconcileLocalCurrentRows(next,{logicalKey:metadata.logicalKey,recordId:metadata.outcomeId,idKey:'outcomeId',origin:OUTCOME_ORIGINS.LOCAL});
    await enforceOutcomeBounds(next);recordStage10Diagnostic('recovery_completed',{recordType:'gameweekOutcome',recordId:journal.recordId,severity:'info'});
  }else{
    if(!index.some(row=>row.outcomeId===journal.recordId))await removeOutcomePayload(journal.recordId).catch(()=>{});
    recordStage10Diagnostic('payload_corrupt',{recordType:'gameweekOutcome',recordId:journal.recordId,severity:'error'});
  }
  await rawEvidenceDelete(K_OUTCOME_JOURNAL).catch(()=>{});return true;
}
async function clearOutcomeStorage(){
  const index=await loadOutcomeIndex();
  for(const row of index) await removeOutcomePayload(row.outcomeId);
  if(!globalThis.window?.storage&&globalThis.localStorage){
    const keys=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i); if(key?.startsWith(K_OUTCOME_PREFIX)) keys.push(key);
    }
    for(const key of keys) await rawEvidenceDelete(key);
  }
  await rawEvidenceDelete(K_OUTCOME_INDEX);
  await rawEvidenceDelete(K_OUTCOME_JOURNAL).catch(()=>{});
}
function currentLocalMetadata(index,gameweek){
  return index.find(row=>row.origin===OUTCOME_ORIGINS.LOCAL&&row.current&&Number(row.gameweek)===Number(gameweek))||null;
}
async function touchOutcomeCheck(gameweek,at=Date.now()){
  const index=await loadOutcomeIndex();
  let changed=false;
  const next=index.map(row=>{
    if(row.origin===OUTCOME_ORIGINS.LOCAL&&row.current&&Number(row.gameweek)===Number(gameweek)){
      changed=true; return {...row,lastCheckedAt:new Date(at).toISOString()};
    }
    return row;
  });
  if(changed) await rawEvidenceSet(K_OUTCOME_INDEX,stableStringify(next));
}
function shouldCheckOutcome(metadata,now=Date.now()){
  if(!metadata) return true;
  const checked=Date.parse(metadata.lastCheckedAt||metadata.collectedAt);
  const age=Number.isFinite(checked)?now-checked:Infinity;
  if(metadata.status==='provisional') return age>=OUTCOME_RULES.provisionalRecheckMs;
  const finalised=Date.parse(metadata.finalisedAt||metadata.collectedAt);
  return Number.isFinite(finalised)&&now-finalised<=OUTCOME_RULES.correctionWindowMs&&age>=OUTCOME_RULES.correctionRecheckMs;
}
async function snapshotInputsForGameweek(gameweek){
  const metadata=(await loadEvidenceIndex()).filter(row=>Number(row.gameweek)===Number(gameweek));
  const records=[];
  for(const row of metadata){
    const record=await loadEvidenceRecord(row.snapshotId);
    if(record) records.push(record);
  }
  return {metadata,records};
}
async function latestOutcomeRecord(){
  const index=await loadOutcomeIndex();
  const row=index.find(item=>item.hasFullRecord&&item.origin===OUTCOME_ORIGINS.LOCAL&&item.current)||index.find(item=>item.hasFullRecord);
  return row?loadOutcomeRecord(row.outcomeId):null;
}
function outcomeFileName(record){
  return `teamsheet-${record.season}-gw${record.gameweek}-outcome-r${record.identity.revision}-${record.identity.contentHash.slice(0,16)}.json`;
}
function downloadOutcome(record){const filename=outcomeFileName(record);requestStage10Download(filename,stableStringify(record)+'\n','application/json');return filename;}
function ensureOutcomeUi(){
  if(typeof document==='undefined'||$('outcomeStatus')) return;
  const details=$('evidenceHistory')?.parentElement;
  if(!details) return;
  const section=el('div',{class:'mt-12'},
    el('h3',{},'Official outcomes'),
    el('div',{class:'note plain',id:'outcomeStatus'},el('b',{},'Waiting for completed Gameweeks'),document.createTextNode(' Outcome checks run automatically after the app opens.')),
    el('div',{class:'mt-10',id:'outcomeHistory'},el('div',{class:'status'},'No official outcome records saved on this device.')),
    el('p',{class:'hint m-hint-top'},'Outcome backups are complete unencrypted JSON. Restored files remain recovery-only and cannot silently become the local official record.'),
    el('div',{class:'evidence-actions'},
      el('button',{class:'btn ghost',id:'exportOutcomeBtn',type:'button'},'Export latest outcome'),
      el('button',{class:'btn ghost',id:'importOutcomeBtn',type:'button'},'Restore outcome JSON'),
      el('button',{class:'btn ghost',id:'deleteOutcomeBtn',type:'button'},'Delete local outcomes'),
      el('input',{id:'outcomeImport',type:'file',accept:'application/json,.json',hidden:true})
    ),
    el('p',{class:'status evidence-message',id:'outcomeMessage'},'Collection is automatic and does not delay access to Teamsheet.')
  );
  details.appendChild(section);
}
function outcomeFlagClass(status){
  if(status==='complete'||status==='corrected') return 'rise';
  if(status==='provisional') return 'doubt';
  return 'dark';
}
async function renderOutcomeStatus(){
  const sequence=++outcomeRenderSequence;
  ensureOutcomeUi();
  const index=await loadOutcomeIndex();
  if(sequence!==outcomeRenderSequence) return;
  const local=index.filter(row=>row.origin===OUTCOME_ORIGINS.LOCAL&&row.current).sort((a,b)=>b.gameweek-a.gameweek);
  const latest=local[0]||null;
  const due=dueOutcomeGameweeks(S.boot?.events||[]);
  const backlog=due.filter(gw=>!currentLocalMetadata(index,gw)).length;
  const status=$('outcomeStatus');
  if(status){
    if(!latest) setChildren(status,el('b',{},'Waiting for completed Gameweeks'),document.createTextNode(backlog?` ${backlog} Gameweek${backlog===1?' is':'s are'} queued for automatic collection.`:' Outcome checks run automatically after the app opens.'));
    else setChildren(status,el('b',{},`GW${latest.gameweek} ${latest.status}`),document.createTextNode(` Last checked ${new Date(latest.lastCheckedAt||latest.collectedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}.${backlog?` ${backlog} older Gameweek${backlog===1?' remains':'s remain'} queued.`:''}`));
  }
  const history=$('outcomeHistory');
  if(history){
    if(!index.length) setChildren(history,el('div',{class:'status'},'No official outcome records saved on this device.'));
    else setChildren(history,index.slice(0,8).map(row=>el('article',{class:'note plain'},
      el('div',{},el('b',{},`GW${row.gameweek} · ${row.origin===OUTCOME_ORIGINS.RECOVERY?'Recovery only':row.current?'Current':'Superseded'}`),el('span',{class:`flag ${outcomeFlagClass(row.status)}`},row.status)),
      el('div',{class:'status'},`${new Date(row.collectedAt).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})} · revision ${row.revision}${row.relatedSnapshotId?' · snapshot linked':''}`)
    )));
  }
  const exportButton=$('exportOutcomeBtn'); if(exportButton) exportButton.disabled=!index.some(row=>row.hasFullRecord);
}
async function dispatchOutcomeStored(outcomeId){
  if(typeof document==='undefined'||typeof document.dispatchEvent!=='function'||typeof CustomEvent!=='function')return [];
  const pending=[],detail={outcomeId,waitUntil(promise){pending.push(Promise.resolve(promise));}};document.dispatchEvent(new CustomEvent('teamsheet:outcome-stored',{detail}));return Promise.allSettled(pending);
}
async function collectOneOutcome(gameweek,{trigger,historyPayload,nowFn=Date.now}={}){
  const index=await loadOutcomeIndex();
  const metadata=currentLocalMetadata(index,gameweek);
  const previous=metadata?.hasFullRecord?await loadOutcomeRecord(metadata.outcomeId):null;
  const snapshots=await snapshotInputsForGameweek(gameweek);
  const managerRef=await evidenceManagerRef();
  const due=dueOutcomeGameweeks(S.boot?.events||[],nowFn());
  const newest=due[due.length-1]||gameweek;
  const result=await captureGameweekOutcome({
    managerRef,gameweek,previousRecord:previous,snapshotRecords:snapshots.records,snapshotMetadata:snapshots.metadata,
    historyPayload,trigger,mode:gameweek<newest?'historical_recovery':'prospective_recheck',nowFn
  });
  if(result.ok){
    if(result.unchanged) await touchOutcomeCheck(gameweek,nowFn());
    else {const stored=await storeOutcomeRecord(result.record,{origin:OUTCOME_ORIGINS.LOCAL});if(stored.stored)await dispatchOutcomeStored(result.record.identity.outcomeId);}
  }
  return result;
}
async function runOutcomeCollection({trigger='automatic',force=false,nowFn=Date.now}={}){
  if(outcomePromise) return outcomePromise;
  if(!S.boot?.events?.length) return {ok:false,reason:'season_not_ready'};
  if(!force&&lastOutcomeCheckAt&&nowFn()-lastOutcomeCheckAt<OUTCOME_RULES.foregroundMinAgeMs) return {ok:true,skipped:true,reason:'recently_checked'};
  outcomePromise=(async()=>{
    outcomeBusy=true; lastOutcomeCheckAt=nowFn(); await renderOutcomeStatus();
    const index=await loadOutcomeIndex();
    const due=dueOutcomeGameweeks(S.boot.events,nowFn());
    const candidates=due.filter(gw=>shouldCheckOutcome(currentLocalMetadata(index,gw),nowFn())).slice(0,OUTCOME_RULES.batchLimit);
    let historyPayload=undefined;
    if(S.teamId&&candidates.length) historyPayload=await api(`/entry/${S.teamId}/history/`,{optional:true});
    const results=[];
    for(const gw of candidates){
      try{ results.push(await collectOneOutcome(gw,{trigger,historyPayload,nowFn})); }
      catch(error){ results.push({ok:false,disposition:'retry',reason:error.message}); }
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    return {ok:true,checked:candidates.length,results};
  })();
  try{ return await outcomePromise; }
  finally{ outcomeBusy=false; outcomePromise=null; await renderOutcomeStatus(); }
}
async function exportLatestOutcome(){
  const message=$('outcomeMessage');
  try{ const record=await latestOutcomeRecord(); if(!record) throw new Error('No saved outcome is available'); const filename=downloadOutcome(record); recordStage10Diagnostic('download_requested',{recordType:'gameweekOutcome',recordId:record.identity.outcomeId,severity:'info'}); if(message) message.textContent=stage10DownloadRequestedMessage(filename); }
  catch(error){ if(message) message.textContent=`Outcome export failed: ${error.message}`; }
}
async function importOutcomeFile(file){
  const message=$('outcomeMessage');
  try{
    if(!file) return;
    if(Number(file.size)>MAX_OUTCOME_IMPORT_BYTES) throw new Error('file exceeds the 25 MB outcome limit');
    const checked=await validateOutcomeRecord(JSON.parse(await file.text()));
    if(!checked.ok) throw new Error(`record rejected (${checked.reason})`);
    await storeOutcomeRecord(checked.record,{origin:OUTCOME_ORIGINS.RECOVERY});
    if(message) message.textContent=`Imported ${checked.record.identity.outcomeId} as recovery-only evidence.`;
  }catch(error){ if(message) message.textContent=`Outcome import failed: ${error.message}`; }
  finally{ await renderOutcomeStatus(); }
}
async function deleteOutcomes(){
  const message=$('outcomeMessage');
  try{
    if(typeof globalThis.confirm==='function'&&!globalThis.confirm('Delete all locally stored official outcome records? Exported JSON files and deadline snapshots will not be affected.')) return;
    await clearOutcomeStorage(); if(message) message.textContent='Local official outcome records were deleted. Deadline snapshots and exported files were not affected.';
  }catch(error){ if(message) message.textContent=`Outcome deletion failed: ${error.message}`; }
  finally{ await renderOutcomeStatus(); }
}
function initOutcomeUi(){
  if(typeof document==='undefined') return;
  ensureOutcomeUi();
  $('exportOutcomeBtn')?.addEventListener('click',exportLatestOutcome);
  $('importOutcomeBtn')?.addEventListener('click',()=>$('outcomeImport')?.click());
  $('deleteOutcomeBtn')?.addEventListener('click',deleteOutcomes);
  $('outcomeImport')?.addEventListener('change',event=>{ const file=event.target.files?.[0]; importOutcomeFile(file); event.target.value=''; });
  document.addEventListener('teamsheet:data-rendered',renderOutcomeStatus);
  document.addEventListener('teamsheet:data-verified',event=>{
    const task=runOutcomeCollection({trigger:event.detail?.reason||'verified_refresh'});
    if(typeof event.detail?.waitUntil==='function') event.detail.waitUntil(task);
  });
  const foreground=()=>{
    if(document.visibilityState&&document.visibilityState!=='visible') return;
    if(!lastOutcomeCheckAt||Date.now()-lastOutcomeCheckAt>=OUTCOME_RULES.foregroundMinAgeMs) void runOutcomeCollection({trigger:'foreground'});
  };
  document.addEventListener('visibilitychange',foreground);
  globalThis.window?.addEventListener?.('pageshow',foreground);
  setInterval(()=>{ if(!document.visibilityState||document.visibilityState==='visible') void runOutcomeCollection({trigger:'visible_interval',force:true}); },OUTCOME_RULES.provisionalRecheckMs);
  void recoverOutcomeJournal().then(renderOutcomeStatus);
}

initOutcomeUi();

export {
  K_OUTCOME_INDEX,K_OUTCOME_PREFIX,K_OUTCOME_JOURNAL,MAX_OUTCOME_IMPORT_BYTES,OUTCOME_ORIGINS,
  normaliseOutcomeIndex,loadOutcomeIndex,loadOutcomeRecord,compactOutcomeMetadata,storeOutcomeRecord,
  recoverOutcomeJournal,clearOutcomeStorage,currentLocalMetadata,touchOutcomeCheck,shouldCheckOutcome,
  snapshotInputsForGameweek,latestOutcomeRecord,dispatchOutcomeStored,runOutcomeCollection,renderOutcomeStatus,initOutcomeUi
};
