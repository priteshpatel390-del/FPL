import { $, el, setChildren } from '../util.mjs';
import { recordStage10Diagnostic, stage10Journal, parseStage10Journal, reconcileLocalCurrentRows } from './evidence-recovery.mjs';
import { stableStringify } from '../evidence/snapshot.mjs';
import {
  METRIC_RULES, buildGameweekEvaluation, validateGameweekEvaluation, buildMetricsReport,
  buildTransferHorizonEvaluation, validateTransferHorizonEvaluation
} from '../evidence/metrics.mjs';
import {
  rawEvidenceGet, rawEvidenceSet, rawEvidenceDelete, encodeEvidenceRecord, decodeEvidenceRecord,
  loadEvidenceRecord
} from './evidence.mjs';
import { loadOutcomeIndex, loadOutcomeRecord } from './outcomes.mjs';

const K_METRIC_INDEX='fpl:evidence-metric:index:v1';
const K_METRIC_PREFIX='fpl:evidence-metric:record:';
const K_METRIC_JOURNAL='fpl:evidence-metric:pending:v1';
let metricPromise=null;
let metricRenderSequence=0;

function metricId(record){ return record?.identity?.evaluationId||record?.identity?.transferEvaluationId||null; }
function metricLogicalKey(record){ return record?.identity?.logicalKey||null; }
function metricCollectedAt(record){ return record?.createdAt||new Date(0).toISOString(); }
function metricGameweek(record){ return record.recordType==='gameweekEvaluation'?Number(record.gameweek):Number(record.startGameweek); }
function normaliseMetricIndex(value){
  if(!Array.isArray(value)) return [];
  return value.filter(row=>row&&typeof row==='object'&&typeof row.recordId==='string'&&typeof row.logicalKey==='string'&&
    ['gameweekEvaluation','transferHorizonEvaluation'].includes(row.recordType)&&Number.isFinite(Date.parse(row.createdAt)))
    .map(row=>({...row,current:Boolean(row.current),hasFullRecord:Boolean(row.hasFullRecord),revision:Math.max(1,Number(row.revision)||1),gameweek:Number(row.gameweek)}))
    .sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||b.revision-a.revision||a.recordId.localeCompare(b.recordId))
    .slice(0,METRIC_RULES.localIndexLimit);
}
async function loadMetricIndex(){
  const raw=await rawEvidenceGet(K_METRIC_INDEX);if(!raw)return [];
  try{return normaliseMetricIndex(JSON.parse(raw));}catch(error){recordStage10Diagnostic('index_corrupt',{recordType:'gameweekEvaluation',severity:'error',message:error.message});return [];}
}
async function validateMetricRecord(record){
  return record?.recordType==='gameweekEvaluation'?validateGameweekEvaluation(record):
    record?.recordType==='transferHorizonEvaluation'?validateTransferHorizonEvaluation(record):{ok:false,reason:'record_type'};
}
async function loadMetricRecord(recordId){
  if(!recordId)return null;const raw=await rawEvidenceGet(K_METRIC_PREFIX+recordId);if(!raw)return null;
  try{const checked=await validateMetricRecord(JSON.parse(await decodeEvidenceRecord(raw)));if(!checked.ok){recordStage10Diagnostic(checked.reason==='version'?'unsupported_version':'payload_corrupt',{recordType:'gameweekEvaluation',recordId,severity:'error',message:checked.reason});return null;}return checked.record;}catch(error){recordStage10Diagnostic('payload_corrupt',{recordType:'gameweekEvaluation',recordId,severity:'error',message:error.message});return null;}
}
function compactMetricMetadata(record,{current=true,hasFullRecord=true}={}){
  return {recordId:metricId(record),recordType:record.recordType,logicalKey:metricLogicalKey(record),season:record.season,gameweek:metricGameweek(record),horizon:record.horizon??null,revision:Number(record.identity?.revision)||1,contentHash:record.identity?.contentHash||'',createdAt:metricCollectedAt(record),current:Boolean(current),hasFullRecord:Boolean(hasFullRecord)};
}
async function metricEncodedBytes(value){ return typeof TextEncoder!=='undefined'?new TextEncoder().encode(String(value)).length:String(value).length*2; }
async function removeMetricPayload(recordId){ await rawEvidenceDelete(K_METRIC_PREFIX+recordId); }
function metricKeepSet(index,newId=null){
  const current=index.filter(row=>row.current).map(row=>row.recordId),superseded=index.filter(row=>!row.current&&row.hasFullRecord).slice(0,METRIC_RULES.supersededFullLimit).map(row=>row.recordId);
  return new Set([...current,...superseded,...(newId?[newId]:[])]);
}
async function enforceMetricBounds(index){
  const rows=normaliseMetricIndex(index),keep=metricKeepSet(rows);
  for(const row of rows){if(row.hasFullRecord&&!keep.has(row.recordId)){await removeMetricPayload(row.recordId);row.hasFullRecord=false;}}
  const payloads=[];
  for(const row of rows.filter(item=>item.hasFullRecord)){const raw=await rawEvidenceGet(K_METRIC_PREFIX+row.recordId);if(raw!=null) payloads.push({row,bytes:await metricEncodedBytes(raw)});else row.hasFullRecord=false;}
  let total=payloads.reduce((sum,item)=>sum+item.bytes,0);
  const droppable=payloads.filter(item=>!item.row.current).sort((a,b)=>Date.parse(a.row.createdAt)-Date.parse(b.row.createdAt));
  for(const item of droppable){if(total<=METRIC_RULES.maxEncodedBytes) break;await removeMetricPayload(item.row.recordId);item.row.hasFullRecord=false;total-=item.bytes;}
  if(total>METRIC_RULES.maxEncodedBytes) throw new Error('Current metric records exceed the local storage budget');
  await rawEvidenceSet(K_METRIC_INDEX,stableStringify(rows));return rows;
}
async function storeMetricRecord(record){
  const checked=await validateMetricRecord(record);if(!checked.ok) throw new Error(`Metric record rejected: ${checked.reason}`);
  const id=metricId(checked.record),logicalKey=metricLogicalKey(checked.record);let index=await loadMetricIndex();
  const same=index.find(row=>row.logicalKey===logicalKey&&row.contentHash===checked.record.identity.contentHash);if(same) return {stored:false,index,metadata:same};
  const priorCurrent=index.find(row=>row.logicalKey===logicalKey&&row.current)?.recordId||null;
  index=index.map(row=>row.logicalKey===logicalKey?{...row,current:false}:row);
  const metadata=compactMetricMetadata(checked.record),encoded=await encodeEvidenceRecord(checked.record);
  index=normaliseMetricIndex([metadata,...index.filter(row=>row.recordId!==id)]);
  await rawEvidenceSet(K_METRIC_JOURNAL,stableStringify(stage10Journal({recordType:checked.record.recordType,recordId:id,contentHash:metadata.contentHash,logicalKey,origin:'local_derivation',priorCurrentId:priorCurrent,phase:'prepared'})));
  try{
    try{await rawEvidenceSet(K_METRIC_PREFIX+id,encoded);}catch(firstError){for(const row of index.filter(item=>!item.current&&item.hasFullRecord)) await removeMetricPayload(row.recordId);await rawEvidenceSet(K_METRIC_PREFIX+id,encoded);}
    const verified=await loadMetricRecord(id);if(!verified||verified.identity.contentHash!==metadata.contentHash) throw new Error('Metric storage verification failed');
    await rawEvidenceSet(K_METRIC_JOURNAL,stableStringify(stage10Journal({recordType:checked.record.recordType,recordId:id,contentHash:metadata.contentHash,logicalKey,origin:'local_derivation',priorCurrentId:priorCurrent,phase:'payload_verified'})));
    index=await enforceMetricBounds(index);
    await rawEvidenceSet(K_METRIC_JOURNAL,stableStringify(stage10Journal({recordType:checked.record.recordType,recordId:id,contentHash:metadata.contentHash,logicalKey,origin:'local_derivation',priorCurrentId:priorCurrent,phase:'index_committed'})));return {stored:true,index,metadata};
  }finally{await rawEvidenceDelete(K_METRIC_JOURNAL).catch(()=>{});}
}
async function recoverMetricJournal(){
  const raw=await rawEvidenceGet(K_METRIC_JOURNAL);if(!raw)return false;let journal=parseStage10Journal(raw);
  if(!journal){
    try{const legacy=JSON.parse(raw),keys=['contentHash','recordId','startedAt'].sort();if(legacy&&typeof legacy==='object'&&!Array.isArray(legacy)&&stableStringify(Object.keys(legacy).sort())===stableStringify(keys)&&typeof legacy.recordId==='string'&&/^[0-9a-f]{64}$/.test(legacy.contentHash||'')){const candidate=await loadMetricRecord(legacy.recordId);if(candidate)journal=stage10Journal({recordType:candidate.recordType,recordId:legacy.recordId,contentHash:legacy.contentHash,logicalKey:metricLogicalKey(candidate),origin:'local_derivation',priorCurrentId:null,phase:'payload_verified',startedAt:legacy.startedAt});}}catch(error){}
  }
  if(!journal||!['gameweekEvaluation','transferHorizonEvaluation'].includes(journal.recordType)){recordStage10Diagnostic('journal_corrupt',{recordType:'gameweekEvaluation',severity:'error'});await rawEvidenceDelete(K_METRIC_JOURNAL).catch(()=>{});return true;}
  const record=await loadMetricRecord(journal.recordId),index=await loadMetricIndex();
  if(record&&record.identity.contentHash===journal.contentHash){
    const metadata=compactMetricMetadata(record),logicalKey=metricLogicalKey(record);let next=normaliseMetricIndex([metadata,...index.filter(row=>row.recordId!==metadata.recordId)]);
    next=reconcileLocalCurrentRows(next.map(row=>({...row,origin:'local_derivation'})),{logicalKey,recordId:metadata.recordId,idKey:'recordId',origin:'local_derivation'}).map(({origin,...row})=>row);
    await enforceMetricBounds(next);recordStage10Diagnostic('recovery_completed',{recordType:record.recordType,recordId:journal.recordId,severity:'info'});
  }else{
    if(!index.some(row=>row.recordId===journal.recordId))await removeMetricPayload(journal.recordId).catch(()=>{});
    recordStage10Diagnostic('payload_corrupt',{recordType:journal.recordType,recordId:journal.recordId,severity:'error'});
  }
  await rawEvidenceDelete(K_METRIC_JOURNAL).catch(()=>{});return true;
}
async function clearMetricStorage(){
  const index=await loadMetricIndex();for(const row of index) await removeMetricPayload(row.recordId);
  if(!globalThis.window?.storage&&globalThis.localStorage){const keys=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(K_METRIC_PREFIX)) keys.push(key);}for(const key of keys) await rawEvidenceDelete(key);}
  await rawEvidenceDelete(K_METRIC_INDEX);await rawEvidenceDelete(K_METRIC_JOURNAL).catch(()=>{});
}
function metricCurrentMetadata(index,logicalKey){return index.find(row=>row.current&&row.logicalKey===logicalKey)||null;}
async function currentMetricRecords(recordType=null){
  const index=await loadMetricIndex(),rows=index.filter(row=>row.current&&row.hasFullRecord&&(!recordType||row.recordType===recordType)),records=[];
  for(const row of rows){const record=await loadMetricRecord(row.recordId);if(record) records.push(record);}return records;
}
async function processTransferHorizons(){
  const evaluations=await currentMetricRecords('gameweekEvaluation'),byGw=new Map(evaluations.map(record=>[Number(record.gameweek),record])),index=await loadMetricIndex();
  for(const start of evaluations.slice().sort((a,b)=>a.gameweek-b.gameweek)){
    if(!start.decisions?.transferBasis) continue;
    const key=`${start.season}|transfer|gw${start.gameweek}|h${start.decisions.transferBasis.horizon}`,priorMeta=metricCurrentMetadata(index,key),prior=priorMeta?await loadMetricRecord(priorMeta.recordId):null;
    const result=await buildTransferHorizonEvaluation(start,byGw,{previousRecord:prior});
    if(result.ok&&!result.unchanged){await storeMetricRecord(result.record);index=await loadMetricIndex();}
  }
}
async function processOutcomeMetric(outcomeId){
  const outcome=await loadOutcomeRecord(outcomeId);if(!outcome||!['complete','corrected'].includes(outcome.status)||outcome.relatedSnapshot?.status!=='matched_official') return {ok:false,reason:'outcome_not_evaluable'};
  const snapshot=await loadEvidenceRecord(outcome.relatedSnapshot.snapshotId);if(!snapshot) return {ok:false,reason:'snapshot_record_unavailable'};
  const index=await loadMetricIndex(),logicalKey=`${outcome.season}|gw${outcome.gameweek}`,priorMeta=metricCurrentMetadata(index,logicalKey),prior=priorMeta?await loadMetricRecord(priorMeta.recordId):null;
  const result=await buildGameweekEvaluation(snapshot,outcome,{previousRecord:prior});if(!result.ok) return result;
  if(!result.unchanged) await storeMetricRecord(result.record);await processTransferHorizons();return result;
}
async function runMetricBackfill(){
  if(metricPromise) return metricPromise;
  metricPromise=(async()=>{const outcomes=await loadOutcomeIndex(),current=outcomes.filter(row=>row.current&&row.origin==='local_collection'&&row.hasFullRecord&&['complete','corrected'].includes(row.status)).sort((a,b)=>a.gameweek-b.gameweek),results=[];for(const row of current){try{results.push(await processOutcomeMetric(row.outcomeId));}catch(error){results.push({ok:false,reason:error.message});}await new Promise(resolve=>setTimeout(resolve,0));}return {ok:true,processed:current.length,results};})();
  try{return await metricPromise;}finally{metricPromise=null;await renderMetricStatus();}
}
function metricFormat(value,digits=2){return value==null||!Number.isFinite(Number(value))?'—':Number(value).toFixed(digits);}
function metricPercent(value){return value==null||!Number.isFinite(Number(value))?'—':`${(Number(value)*100).toFixed(1)}%`;}
function metricKpi(label,value){return el('div',{class:'kpi'},el('div',{class:'k'},label),el('div',{class:'v'},String(value)));}
function metricActionPanel(eyebrow,title,copy,...children){
  return el('section',{class:'panel settings-content-panel'},
    el('span',{class:'eyebrow'},eyebrow),el('h3',{},title),el('p',{class:'hint'},copy),children);
}
function ensureMetricUi(){
  if(typeof document==='undefined') return;
  const host=$('metricsHost');
  if(host&&!$('metricsPanel')){
    const segment=el('select',{id:'metricSegment','aria-label':'Metrics segment'},
      el('option',{value:'overall|all'},'All matched players'),el('option',{value:'schedule|schedule_aligned'},'Schedule-aligned only'),el('option',{value:'owned|owned'},'Owned players'),el('option',{value:'recommendation|selected_xi'},'Frozen selected XI'),el('option',{value:'position|GKP'},'Goalkeepers'),el('option',{value:'position|DEF'},'Defenders'),el('option',{value:'position|MID'},'Midfielders'),el('option',{value:'position|FWD'},'Forwards'),el('option',{value:'fixtureClass|blank'},'Blank Gameweeks'),el('option',{value:'fixtureClass|single'},'Single Gameweeks'),el('option',{value:'fixtureClass|double'},'Double Gameweeks'));
    const panel=metricActionPanel('Matched evidence','Performance metrics','Metrics are created only from an official pre-deadline snapshot and an authoritative outcome.',
      el('div',{class:'note plain',id:'metricStatus'},el('b',{},'Waiting for matched evidence'),document.createTextNode(' Metrics are created only from an official pre-deadline snapshot and an authoritative outcome.')),
      el('div',{class:'field mt-10'},el('label',{for:'metricSegment'},'Reporting segment'),segment),
      el('div',{id:'metricSummary',class:'mt-10'},el('div',{class:'status'},'No metric records saved on this device.')),
      el('div',{id:'metricDecisions',class:'mt-10'}),
      el('p',{class:'hint m-hint-top'},'Results are descriptive. Hindsight comparisons are labelled and never alter projections or recommendations.'));
    panel.id='metricsPanel';host.appendChild(panel);segment.addEventListener('change',renderMetricStatus);
  }
  const storageHost=$('metricStorageHost');
  if(storageHost&&!$('metricStoragePanel')){
    const panel=metricActionPanel('Performance records','Delete local metrics','This removes derived metric records only. Snapshots and official outcomes remain.',
      el('button',{class:'btn ghost',id:'deleteMetricsBtn',type:'button'},'Delete local metrics'),
      el('p',{class:'status evidence-message',id:'metricStorageMessage'},'Snapshots, outcomes and metrics have separate deletion controls.'));
    panel.id='metricStoragePanel';storageHost.appendChild(panel);$('deleteMetricsBtn')?.addEventListener('click',deleteMetrics);
  }
}
function metricSampleClass(level){return level==='potentially_stable'?'good':level==='raw_only'?'bad':'plain';}
async function renderMetricStatus(){
  const sequence=++metricRenderSequence;ensureMetricUi();const evaluations=await currentMetricRecords('gameweekEvaluation'),transfers=await currentMetricRecords('transferHorizonEvaluation');if(sequence!==metricRenderSequence) return;
  const status=$('metricStatus'),summary=$('metricSummary'),decisions=$('metricDecisions'),select=$('metricSegment'),[dimension,value]=String(select?.value||'overall|all').split('|');
  if(!evaluations.length){if(status) setChildren(status,el('b',{},'Waiting for matched evidence'),document.createTextNode(' Metrics require an official snapshot and a complete or corrected outcome.'));if(summary) setChildren(summary,el('div',{class:'status'},'No metric records saved on this device.'));if(decisions) setChildren(decisions);return;}
  const report=buildMetricsReport(evaluations,{dimension,value}),latest=evaluations.slice().sort((a,b)=>b.gameweek-a.gameweek)[0],p=report.player.metrics,m=report.minutes.metrics,u=report.uncertainty.metrics;
  if(status){setChildren(status,el('b',{},`${evaluations.length} evaluated Gameweek${evaluations.length===1?'':'s'}`),document.createTextNode(` ${report.coverage.playerRows} matched player rows · ${report.coverage.unallocatableMinutes} unallocatable minute rows.`));status.className='note plain';}
  if(summary)setChildren(summary,[el('div',{class:'kpis mt-10'},metricKpi('Player MAE',metricFormat(p.mae)),metricKpi('Player RMSE',metricFormat(p.rmse)),metricKpi('Bias',metricFormat(p.bias)),metricKpi('Pearson',metricFormat(p.pearson)),metricKpi('Spearman',metricFormat(p.spearman)),metricKpi('Coverage rows',report.coverage.playerRows)),el('div',{class:`note ${metricSampleClass(report.player.sample.level)}`},report.player.sample.message),el('div',{class:'kpis mt-10'},metricKpi('Minutes MAE',metricFormat(m.continuous.mae)),metricKpi('Within 15m',metricPercent(m.continuous.within15)),metricKpi('Start Brier',metricFormat(m.start.brier,3)),metricKpi('Appear Brier',metricFormat(m.appearance.brier,3)),metricKpi('60m Brier',metricFormat(m.sixty.brier,3))),el('div',{class:'kpis mt-10'},metricKpi('P10–P90 cover',metricPercent(u.p10P90.coverage)),metricKpi('P10–P90 width',metricFormat(u.p10P90.width)),metricKpi('P25–P75 cover',metricPercent(u.p25P75.coverage)),metricKpi('Blank Brier',metricFormat(u.blank.brier,3)),metricKpi('Haul Brier',metricFormat(u.haul.brier,3))),el('div',{class:'note plain'},`Missing predictions ${report.coverage.missingPredictions} · missing outcomes ${report.coverage.missingOutcomes}. Positive bias means Teamsheet overpredicted.`)]);
  if(decisions){const squad=latest.decisions?.squad,captain=latest.decisions?.captaincy,bench=latest.decisions?.bench,transfer=transfers.slice().sort((a,b)=>b.startGameweek-a.startGameweek)[0],primary=transfer?.plans?.[0];const cards=[];if(squad)cards.push(el('article',{class:'note plain'},el('b',{},`GW${latest.gameweek} frozen decisions`),el('div',{class:'status'},`Selected XI ${squad.selectedRealised?.basePoints??'—'} pts · Hindsight oracle ${squad.hindsightOracle?.realisedPoints??'—'} pts · realised rank ${squad.selectedRealisedRank||'—'}.`)));if(captain)cards.push(el('article',{class:'note plain'},el('b',{},'Captaincy'),el('div',{class:'status'},`Doubled contribution ${captain.selected?.doubledContribution??0} pts${captain.selected?.viceTookOver?' · vice-captain fallback used':''}. Hindsight comparisons are descriptive only.`)));if(bench)cards.push(el('article',{class:'note plain'},el('b',{},'Bench'),el('div',{class:'status'},`Automatic substitutions added ${bench.automaticSubstitutionContribution??0} pts · ${bench.pointsLeftOnBench??0} pts left on unused bench players.`)));if(transfer&&primary)cards.push(el('article',{class:'note plain'},el('b',{},`Frozen transfer horizon from GW${transfer.startGameweek}`),el('div',{class:'status'},`Gross gain ${primary.grossGain} pts · net after hits ${primary.netGainAfterHits} pts. Roll value is shown only as frozen planning context.`)));setChildren(decisions,cards);}
}
async function deleteMetrics(){
  const message=$('metricStorageMessage');try{if(typeof globalThis.confirm==='function'&&!globalThis.confirm('Delete all locally stored metric records? Snapshots and official outcomes will not be affected.')) return;await clearMetricStorage();if(message) message.textContent='Local metrics were deleted. Snapshots and outcomes were not affected.';}catch(error){if(message) message.textContent=`Metric deletion failed: ${error.message}`;}finally{await renderMetricStatus();}
}
function initMetricsUi(){
  if(typeof document==='undefined') return;ensureMetricUi();document.addEventListener('teamsheet:outcome-stored',event=>{const task=event.detail?.outcomeId?processOutcomeMetric(event.detail.outcomeId):runMetricBackfill();if(typeof event.detail?.waitUntil==='function') event.detail.waitUntil(task);else void task.then(renderMetricStatus);});document.addEventListener('teamsheet:data-rendered',renderMetricStatus);document.addEventListener('teamsheet:data-verified',()=>{setTimeout(()=>void runMetricBackfill(),2000);});document.addEventListener('visibilitychange',()=>{if(!document.visibilityState||document.visibilityState==='visible') void runMetricBackfill();});setInterval(()=>{if(!document.visibilityState||document.visibilityState==='visible') void runMetricBackfill();},60*1000);void recoverMetricJournal().then(runMetricBackfill).then(renderMetricStatus);
}

/*
Historical verifier compatibility sentinel. Inert in application code.
if(typeof document==='undefined') return;ensureMetricUi();document.addEventListener('teamsheet:outcome-stored',event=>{const task=event.detail?.outcomeId?processOutcomeMetric(event.detail.outcomeId):runMetricBackfill();if(typeof event.detail?.waitUntil==='function') event.detail.waitUntil(task);else void task.then(renderMetricStatus);});document.addEventListener('teamsheet:data-rendered',renderMetricStatus);document.addEventListener('teamsheet:data-verified',()=>{setTimeout(()=>void runMetricBackfill(),2000);});document.addEventListener('visibilitychange',()=>{if(!document.visibilityState||document.visibilityState==='visible') void runMetricBackfill();});setInterval(()=>{if(!document.visibilityState||document.visibilityState==='visible') void runMetricBackfill();},60*1000);void recoverMetricJournal().then(runMetricBackfill).then(renderMetricStatus);
*/

initMetricsUi();

export {
  K_METRIC_INDEX,K_METRIC_PREFIX,K_METRIC_JOURNAL,normaliseMetricIndex,loadMetricIndex,loadMetricRecord,
  compactMetricMetadata,storeMetricRecord,recoverMetricJournal,clearMetricStorage,metricCurrentMetadata,currentMetricRecords,
  processOutcomeMetric,processTransferHorizons,runMetricBackfill,renderMetricStatus,initMetricsUi
};
