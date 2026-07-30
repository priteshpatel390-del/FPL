from pathlib import Path
import re

ROOT = Path('.')

def read(path):
    return (ROOT / path).read_text()

def write(path, content):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)

def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one anchor, found {count}: {old[:100]!r}')
    write(path, text.replace(old, new, 1))

def regex_once(path, pattern, replacement, flags=0):
    text = read(path)
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'{path}: regex anchor not found exactly once: {pattern[:120]!r}')
    write(path, next_text)

def append_once(path, marker, block):
    text = read(path)
    if marker in text:
        return
    write(path, text.rstrip() + '\n\n' + block.strip() + '\n')

write('src/ui/evidence-recovery.mjs', r'''import { canonicalise } from '../evidence/snapshot.mjs';

const STAGE10_JOURNAL_PHASES=Object.freeze(['prepared','payload_verified','index_committed']);
const STAGE10_DIAGNOSTIC_LIMIT=20;
let stage10DiagnosticRows=[];

function stage10SafeText(value,maxLength=180){
  let text=String(value??'');
  try{text=decodeURIComponent(text);}catch(error){}
  text=text
    .replace(/(?:sk|ant)-[A-Za-z0-9_-]{8,}/gi,'[redacted]')
    .replace(/(?:api[_-]?key|authorization|access[_-]?token|refresh[_-]?token)\s*[:=]\s*[^\s,;]+/gi,'[redacted]')
    .replace(/\/entry\/\d+/gi,'/entry/[redacted]')
    .replace(/\/leagues-classic\/\d+/gi,'/leagues-classic/[redacted]')
    .replace(/[?#][^\s]*/g,'');
  return text.slice(0,Math.max(0,Number(maxLength)||180));
}
function recordStage10Diagnostic(code,{recordType=null,recordId=null,severity='warning',message=null,at=Date.now()}={}){
  const row=canonicalise({code:String(code||'unknown'),recordType:recordType==null?null:String(recordType),recordId:recordId==null?null:String(recordId).slice(0,120),severity:['info','warning','error'].includes(severity)?severity:'warning',message:message==null?null:stage10SafeText(message),at:new Date(at).toISOString()});
  const key=`${row.code}|${row.recordType||''}|${row.recordId||''}`;
  stage10DiagnosticRows=[row,...stage10DiagnosticRows.filter(item=>`${item.code}|${item.recordType||''}|${item.recordId||''}`!==key)].slice(0,STAGE10_DIAGNOSTIC_LIMIT);
  return row;
}
function stage10Diagnostics(){return stage10DiagnosticRows.slice();}
function clearStage10Diagnostics(){stage10DiagnosticRows=[];}
function stage10DiagnosticMessage(code){
  const messages={
    storage_unavailable:'Persistent browser storage is unavailable. Export any accessible records before closing Teamsheet.',
    storage_full:'Browser storage is full. Existing verified records were preserved where possible.',
    index_corrupt:'Saved evidence metadata could not be read. Full records were not trusted or promoted automatically.',
    payload_corrupt:'A saved evidence record failed decompression, schema or hash verification and was not used.',
    journal_corrupt:'An interrupted-write journal was malformed and could not be trusted.',
    recovery_completed:'An interrupted verified write was recovered safely.',
    recovery_only:'A restored record remains recovery-only and cannot become official or current.',
    unsupported_version:'A record uses an unsupported schema or metric version and was not migrated.',
    download_requested:'The browser download was requested. Confirm the file appears in Files or Downloads.'
  };
  return messages[code]||'Stage 10 evidence needs attention. No unsafe record was used.';
}
function stage10Journal({recordType,recordId,contentHash,logicalKey=null,origin,priorCurrentId=null,phase='prepared',startedAt=new Date().toISOString()}={}){
  if(!['preDeadlineSnapshot','gameweekOutcome','gameweekEvaluation','transferHorizonEvaluation'].includes(recordType)) throw new Error('Stage 10 journal record type is not supported');
  if(typeof recordId!=='string'||!recordId||!/^[-a-z0-9|]+$/i.test(recordId)) throw new Error('Stage 10 journal record ID is invalid');
  if(!/^[0-9a-f]{64}$/.test(contentHash||'')) throw new Error('Stage 10 journal content hash is invalid');
  if(!STAGE10_JOURNAL_PHASES.includes(phase)) throw new Error('Stage 10 journal phase is invalid');
  if(!['local_capture','local_collection','local_derivation','recovery_import'].includes(origin)) throw new Error('Stage 10 journal origin is invalid');
  return canonicalise({recordType,recordId,contentHash,logicalKey:logicalKey==null?null:String(logicalKey),origin,priorCurrentId:priorCurrentId==null?null:String(priorCurrentId),phase,startedAt:new Date(startedAt).toISOString()});
}
function parseStage10Journal(raw){
  try{
    const value=typeof raw==='string'?JSON.parse(raw):raw;
    if(!value||typeof value!=='object'||Array.isArray(value)) return null;
    const exact=['contentHash','logicalKey','origin','phase','priorCurrentId','recordId','recordType','startedAt'].sort();
    if(JSON.stringify(Object.keys(value).sort())!==JSON.stringify(exact)) return null;
    return stage10Journal(value);
  }catch(error){return null;}
}
function reconcileLocalCurrentRows(rows,{logicalKey,recordId,idKey='recordId',origin='local_collection'}={}){
  return (Array.isArray(rows)?rows:[]).map(row=>{
    if(!row||typeof row!=='object') return row;
    if(row.origin!=='recovery_import'&&row.origin===origin&&row.logicalKey===logicalKey) return {...row,current:row[idKey]===recordId};
    if(row.origin==='recovery_import'&&row.current) return {...row,current:false};
    return row;
  });
}

export {
  STAGE10_JOURNAL_PHASES,STAGE10_DIAGNOSTIC_LIMIT,stage10SafeText,recordStage10Diagnostic,
  stage10Diagnostics,clearStage10Diagnostics,stage10DiagnosticMessage,stage10Journal,
  parseStage10Journal,reconcileLocalCurrentRows
};
''')

write('src/ui/download.mjs', r'''const STAGE10_DOWNLOAD_REVOKE_DELAY_MS=30*1000;
function requestStage10Download(filename,text,type,{documentImpl=globalThis.document,urlImpl=globalThis.URL,BlobImpl=globalThis.Blob,setTimeoutImpl=globalThis.setTimeout}={}){
  if(!documentImpl?.createElement||!documentImpl?.body||!urlImpl?.createObjectURL||typeof BlobImpl!=='function') throw new Error('Browser download support is unavailable');
  const blob=new BlobImpl([String(text)],{type:String(type||'application/octet-stream')}),url=urlImpl.createObjectURL(blob),anchor=documentImpl.createElement('a');
  anchor.href=url;anchor.download=String(filename);anchor.rel='noopener';documentImpl.body.appendChild(anchor);anchor.click();anchor.remove();
  setTimeoutImpl(()=>urlImpl.revokeObjectURL(url),STAGE10_DOWNLOAD_REVOKE_DELAY_MS);
  return {filename:String(filename),requested:true,bytes:typeof TextEncoder!=='undefined'?new TextEncoder().encode(String(text)).length:String(text).length*2};
}
function stage10DownloadRequestedMessage(filename){return `Download requested — confirm ${String(filename)} appears in Files or Downloads.`;}
export {STAGE10_DOWNLOAD_REVOKE_DELAY_MS,requestStage10Download,stage10DownloadRequestedMessage};
''')

replace_once('build.mjs',
"  'src/ui/markdown.mjs', 'src/ui/security-wiring.mjs', 'src/ui/evidence.mjs', 'src/ui/outcomes.mjs', 'src/ui/metrics.mjs', 'src/ui/review.mjs',",
"  'src/ui/markdown.mjs', 'src/ui/security-wiring.mjs', 'src/ui/evidence-recovery.mjs', 'src/ui/download.mjs', 'src/ui/evidence.mjs', 'src/ui/outcomes.mjs', 'src/ui/metrics.mjs', 'src/ui/review.mjs',")

replace_once('src/evidence/snapshot.mjs',
"    Object.keys(value).sort().forEach(key => {\n      if(value[key] !== undefined) out[key] = canonicalise(value[key]);\n    });",
"    Object.keys(value).sort().forEach(key => {\n      if(['__proto__','prototype','constructor'].includes(key)) throw new Error(`Evidence records cannot contain unsafe object key: ${key}`);\n      if(value[key] !== undefined) out[key] = canonicalise(value[key]);\n    });")

regex_once('src/evidence/snapshot.mjs',
r"function safeEndpoint\(value\)\{[\s\S]*?\n\}\nfunction safeIssue\(issue\)\{[\s\S]*?\n\}\nfunction safeRetry\(record\)\{[\s\S]*?\n\}",
r'''function safeEvidenceText(value,maxLength=160){
  let text=String(value??'');
  try{text=decodeURIComponent(text);}catch(error){}
  text=text
    .replace(/(?:sk|ant)-[A-Za-z0-9_-]{8,}/gi,'[redacted]')
    .replace(/(?:api[_-]?key|authorization|access[_-]?token|refresh[_-]?token)\s*[:=]\s*[^\s,;]+/gi,'[redacted]')
    .replace(/\/entry\/\d+/gi,'/entry/[redacted]')
    .replace(/\/leagues-classic\/\d+/gi,'/leagues-classic/[redacted]')
    .replace(/[?#][^\s]*/g,'');
  return text.slice(0,Math.max(0,Number(maxLength)||160));
}
function safeEvidenceEndpoint(value){ return safeEvidenceText(value,160); }
function safeIssue(issue){
  return canonicalise({
    provider:String(issue?.provider||''),
    endpoint:safeEvidenceEndpoint(issue?.endpoint),
    code:String(issue?.code||''),
    severity:String(issue?.severity||''),
    count:Number.isFinite(Number(issue?.count)) ? Number(issue.count) : 1,
    received:issue?.received == null ? null : safeEvidenceText(issue.received,80)
  });
}
function safeRetry(record){
  return canonicalise({
    provider:String(record?.provider||''),
    endpoint:safeEvidenceEndpoint(record?.endpoint),
    attempts:Math.max(0,Math.trunc(num(record?.attempts))),
    outcome:safeEvidenceText(record?.outcome||record?.status||'',80),
    usedFallback:Boolean(record?.usedFallback),
    completedAt:Number.isFinite(Number(record?.completedAt||record?.at)) ? Number(record.completedAt||record.at) : null
  });
}''', flags=re.M)

replace_once('src/evidence/snapshot.mjs',
"  assertEvidenceSafe,\n  deadlineWindow,",
"  assertEvidenceSafe,\n  safeEvidenceText,\n  safeEvidenceEndpoint,\n  deadlineWindow,")

replace_once('src/evidence/outcome.mjs',
"  canonicalise, stableStringify, sha256Hex, deepFreeze, assertEvidenceSafe, selectOfficialSnapshot\n} from './snapshot.mjs';",
"  canonicalise, stableStringify, sha256Hex, deepFreeze, assertEvidenceSafe, selectOfficialSnapshot, safeEvidenceEndpoint, safeEvidenceText\n} from './snapshot.mjs';")
replace_once('src/evidence/outcome.mjs',
"    endpoint:String(row?.endpoint||'').replace(/\\/entry\\/\\d+/g,'/entry/[redacted]').replace(/\\d+/g,'{id}').slice(0,160),",
"    endpoint:safeEvidenceEndpoint(String(row?.endpoint||'').replace(/\\d+/g,'{id}')),")
replace_once('src/evidence/outcome.mjs',
"    finalStatus:String(row?.finalStatus||row?.outcome||''),",
"    finalStatus:safeEvidenceText(row?.finalStatus||row?.outcome||'',80),")

regex_once('src/evidence/metrics.mjs',
r"function stage10EvaluationShapeError\(record\)\{[\s\S]*?\n\}\nasync function validateGameweekEvaluation",
r'''function stage10EvaluationShapeError(record){
  const keys=['completeness','createdAt','deadlineTime','decisions','gameweek','identity','managerRef','metricVersion','observations','recordType','reports','rules','schemaVersion','season','segmentationVersion','sources'].sort();
  if(!record||record.recordType!=='gameweekEvaluation') return 'record_type';
  if(record.schemaVersion!==METRIC_SCHEMA_VERSION||record.metricVersion!==METRIC_VERSION||record.segmentationVersion!==SEGMENTATION_VERSION) return 'version';
  if(stableStringify(Object.keys(record).sort())!==stableStringify(keys)) return 'top_level_schema';
  if(!/^mgr-[0-9a-f]{32}$/.test(record.managerRef||'')) return 'manager_ref';
  if(!/^\d{4}-\d{2}$/.test(record.season||'')||!Number.isInteger(record.gameweek)||record.gameweek<1||record.gameweek>38) return 'identity';
  if(!record.identity||record.identity.logicalKey!==`${record.season}|gw${record.gameweek}`||!Number.isInteger(record.identity.revision)||record.identity.revision<1) return 'identity';
  if(!/^evaluation-\d{4}-\d{2}-gw\d+-r\d+-[0-9a-f]{16}$/.test(record.identity.evaluationId||'')) return 'identity';
  if(!/^[0-9a-f]{64}$/.test(record.identity.contentHash||'')||!/^[0-9a-f]{64}$/.test(record.identity.metricDataHash||'')) return 'identity';
  if(!record.identity.sectionHashes||typeof record.identity.sectionHashes!=='object') return 'identity';
  if(!record.sources||typeof record.sources!=='object'||!Array.isArray(record.observations?.players)||!Array.isArray(record.observations?.minuteFixtures)) return 'observations';
  return null;
}
async function validateGameweekEvaluation''', flags=re.M)

regex_once('src/evidence/metrics.mjs',
r"async function validateTransferHorizonEvaluation\(record,cryptoImpl=globalThis\.crypto\)\{[\s\S]*?\n\}",
r'''async function validateTransferHorizonEvaluation(record,cryptoImpl=globalThis.crypto){
  try{
    const keys=['baseline','completeness','createdAt','horizon','identity','managerRef','metricVersion','plans','recordType','schemaVersion','season','sources','startGameweek'].sort();
    if(!record||record.recordType!=='transferHorizonEvaluation') return {ok:false,reason:'record_type'};
    if(record.schemaVersion!==TRANSFER_METRIC_SCHEMA_VERSION||record.metricVersion!==METRIC_VERSION) return {ok:false,reason:'version'};
    if(stableStringify(Object.keys(record).sort())!==stableStringify(keys)) return {ok:false,reason:'top_level_schema'};
    if(!/^mgr-[0-9a-f]{32}$/.test(record.managerRef||'')) return {ok:false,reason:'manager_ref'};
    if(!/^\d{4}-\d{2}$/.test(record.season||'')||!Number.isInteger(record.startGameweek)||record.startGameweek<1||record.startGameweek>38||!Number.isInteger(record.horizon)||record.horizon<1) return {ok:false,reason:'identity'};
    const expectedLogicalKey=`${record.season}|transfer|gw${record.startGameweek}|h${record.horizon}`;
    if(record.identity?.logicalKey!==expectedLogicalKey||!Number.isInteger(record.identity?.revision)||record.identity.revision<1) return {ok:false,reason:'identity'};
    if(!/^transfer-evaluation-\d{4}-\d{2}-gw\d+-h\d+-r\d+-[0-9a-f]{16}$/.test(record.identity?.transferEvaluationId||'')) return {ok:false,reason:'identity'};
    if(!/^[0-9a-f]{64}$/.test(record.identity?.contentHash||'')||!/^[0-9a-f]{64}$/.test(record.identity?.metricDataHash||'')) return {ok:false,reason:'identity'};
    if(!record.sources||typeof record.sources!=='object'||!Array.isArray(record.sources.gameweekEvaluationIds)||!Array.isArray(record.plans)) return {ok:false,reason:'sources'};
    assertEvidenceSafe(record);
    const dataHash=await sha256Hex(stableStringify(evaluationTransferDataMaterial(record)),cryptoImpl);if(dataHash!==record.identity.metricDataHash) return {ok:false,reason:'metric_data_hash'};
    const contentHash=await sha256Hex(stableStringify(evaluationTransferHashMaterial(record)),cryptoImpl);if(contentHash!==record.identity.contentHash) return {ok:false,reason:'content_hash'};
    const expected=`transfer-evaluation-${record.season}-gw${record.startGameweek}-h${record.horizon}-r${record.identity.revision}-${contentHash.slice(0,16)}`;if(record.identity.transferEvaluationId!==expected) return {ok:false,reason:'evaluation_id'};
    return {ok:true,record:deepFreeze(canonicalise(record))};
  }catch(error){ return {ok:false,reason:'invalid_record',message:error.message}; }
}''', flags=re.M)

replace_once('src/evidence/metrics.mjs',
"  return {ok:true,unchanged:false,record:deepFreeze(canonicalise({...draft,identity:{...draft.identity,contentHash,transferEvaluationId}}))};",
"  const record=canonicalise({...draft,identity:{...draft.identity,contentHash,transferEvaluationId}});assertEvidenceSafe(record);return {ok:true,unchanged:false,record:deepFreeze(record)};")

replace_once('src/evidence/review.mjs',
"  return /^[=+\\-@\\t\\r]/.test(candidate)?`'${text}`:text;",
"  return /^[=+\\-@\\t\\r\\n\\f\\v]/.test(candidate)?`'${text}`:text;")

replace_once('src/ui/evidence.mjs',
"import { $, num, el, setChildren } from '../util.mjs';",
"import { $, num, el, setChildren } from '../util.mjs';\nimport { recordStage10Diagnostic, stage10Diagnostics, stage10DiagnosticMessage, stage10Journal, parseStage10Journal } from './evidence-recovery.mjs';\nimport { requestStage10Download, stage10DownloadRequestedMessage } from './download.mjs';")
replace_once('src/ui/evidence.mjs',
"const K_EVIDENCE_PREFIX = 'fpl:evidence:snapshot:';\nconst MAX_EVIDENCE_IMPORT_BYTES",
"const K_EVIDENCE_PREFIX = 'fpl:evidence:snapshot:';\nconst K_EVIDENCE_JOURNAL = 'fpl:evidence:pending:v1';\nconst MAX_EVIDENCE_IMPORT_BYTES")
replace_once('src/ui/evidence.mjs',
"const AUTO_CAPTURE_PRIORITY = Object.freeze({open:1,due_soon:2,ideal:3,final_window:4});\nlet activeEvidenceRecord",
"const AUTO_CAPTURE_PRIORITY = Object.freeze({open:1,due_soon:2,ideal:3,final_window:4});\nconst AUTO_CAPTURE_RETRY_MS=5*60*1000;\nconst AUTO_CAPTURE_MAX_ATTEMPTS=3;\nlet autoCaptureVerifiedAt=0;\nconst autoCaptureAttempts=new Map();\nlet activeEvidenceRecord")

regex_once('src/ui/evidence.mjs',
r"async function encodeEvidenceRecord\(record\)\{[\s\S]*?\n\}",
r'''async function encodeEvidenceRecord(record){
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
}''', flags=re.M)

regex_once('src/ui/evidence.mjs',
r"async function loadEvidenceIndex\(\)\{[\s\S]*?\n\}",
r'''async function loadEvidenceIndex(){
  const raw = await rawEvidenceGet(K_EVIDENCE_INDEX);
  if(!raw) return [];
  try{ return normaliseEvidenceIndex(JSON.parse(raw)); }
  catch(error){recordStage10Diagnostic('index_corrupt',{recordType:'preDeadlineSnapshot',severity:'error',message:error.message});return [];}
}''', flags=re.M)
regex_once('src/ui/evidence.mjs',
r"async function loadEvidenceRecord\(snapshotId\)\{[\s\S]*?\n\}",
r'''async function loadEvidenceRecord(snapshotId){
  if(!snapshotId) return null;
  const raw = await rawEvidenceGet(K_EVIDENCE_PREFIX+snapshotId);
  if(!raw) return null;
  try{
    const checked = await validateSnapshotRecord(JSON.parse(await decodeEvidenceRecord(raw)));
    if(!checked.ok){recordStage10Diagnostic(checked.reason==='schema_version'?'unsupported_version':'payload_corrupt',{recordType:'preDeadlineSnapshot',recordId:snapshotId,severity:'error',message:checked.reason});return null;}
    return checked.record;
  }catch(error){recordStage10Diagnostic('payload_corrupt',{recordType:'preDeadlineSnapshot',recordId:snapshotId,severity:'error',message:error.message});return null;}
}''', flags=re.M)

regex_once('src/ui/evidence.mjs',
r"async function storeEvidenceRecord\(record,\{origin=EVIDENCE_ORIGINS\.LOCAL\}=\{\}\)\{[\s\S]*?\n\}\nasync function clearEvidenceStorage",
r'''async function writeEvidenceJournal(record,origin,phase){
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
async function clearEvidenceStorage''', flags=re.M)

replace_once('src/ui/evidence.mjs',
"  await rawEvidenceDelete(K_EVIDENCE_INDEX);\n  await rawEvidenceDelete(K_EVIDENCE_MANAGER);",
"  await rawEvidenceDelete(K_EVIDENCE_INDEX);\n  await rawEvidenceDelete(K_EVIDENCE_JOURNAL).catch(()=>{});\n  await rawEvidenceDelete(K_EVIDENCE_MANAGER);")

regex_once('src/ui/evidence.mjs',
r"function downloadEvidence\(record\)\{[\s\S]*?\n\}",
r'''function downloadEvidence(record){
  const filename=evidenceFileName(record);requestStage10Download(filename,stableStringify(record)+'\n','application/json');return filename;
}''', flags=re.M)

replace_once('src/ui/evidence.mjs',
"async function renderEvidenceStatus(){\n  const sequence=++evidenceRenderSequence;\n  ensureEvidenceCompact();",
r'''function ensureStage10OperationsUi(){
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
  ensureEvidenceCompact();ensureStage10OperationsUi();''')
replace_once('src/ui/evidence.mjs',
"  if(history){\n    if(!index.length)",
"  renderStage10Diagnostics();\n  if(history){\n    if(!index.length)")

regex_once('src/ui/evidence.mjs',
r"async function maybeAutoCaptureEvidence\(\{reason='verified_refresh'\}=\{\}\)\{[\s\S]*?\n\}",
r'''async function maybeAutoCaptureEvidence({reason='verified_refresh',verifiedAt=null}={}){
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
}''', flags=re.M)

replace_once('src/ui/evidence.mjs',
"    downloadEvidence(record);\n    if(message) message.textContent=`Exported ${evidenceFileName(record)}.`;",
"    const filename=downloadEvidence(record);recordStage10Diagnostic('download_requested',{recordType:'preDeadlineSnapshot',recordId:record.identity.snapshotId,severity:'info'});\n    if(message) message.textContent=stage10DownloadRequestedMessage(filename);")
replace_once('src/ui/evidence.mjs',
"    const task=maybeAutoCaptureEvidence({reason:event.detail?.reason||'verified_refresh'});",
"    const task=maybeAutoCaptureEvidence({reason:event.detail?.reason||'verified_refresh',verifiedAt:event.detail?.verifiedAt});")
replace_once('src/ui/evidence.mjs',
"  renderEvidenceStatus();\n  setInterval(renderEvidenceStatus,60*1000);",
"  void recoverEvidenceJournal().then(renderEvidenceStatus);\n  setInterval(renderEvidenceStatus,60*1000);\n  setInterval(()=>{if(!document.visibilityState||document.visibilityState==='visible')void maybeAutoCaptureEvidence({reason:'visible_retry'});},AUTO_CAPTURE_RETRY_MS);")
replace_once('src/ui/evidence.mjs',
"  K_EVIDENCE_PREFIX,\n  MAX_EVIDENCE_IMPORT_BYTES,",
"  K_EVIDENCE_PREFIX,\n  K_EVIDENCE_JOURNAL,\n  MAX_EVIDENCE_IMPORT_BYTES,")
replace_once('src/ui/evidence.mjs',
"  AUTO_CAPTURE_PRIORITY,\n  normaliseEvidenceIndex,",
"  AUTO_CAPTURE_PRIORITY,\n  AUTO_CAPTURE_RETRY_MS,\n  AUTO_CAPTURE_MAX_ATTEMPTS,\n  normaliseEvidenceIndex,")
replace_once('src/ui/evidence.mjs',
"  storeEvidenceRecord,\n  captureWindowPriority,",
"  storeEvidenceRecord,\n  recoverEvidenceJournal,\n  captureWindowPriority,")

replace_once('src/ui/outcomes.mjs',
"import { $, el, setChildren } from '../util.mjs';",
"import { $, el, setChildren } from '../util.mjs';\nimport { recordStage10Diagnostic, stage10Journal, parseStage10Journal, reconcileLocalCurrentRows } from './evidence-recovery.mjs';\nimport { requestStage10Download, stage10DownloadRequestedMessage } from './download.mjs';")
regex_once('src/ui/outcomes.mjs',
r"async function loadOutcomeIndex\(\)\{[\s\S]*?\n\}",
r'''async function loadOutcomeIndex(){
  const raw=await rawEvidenceGet(K_OUTCOME_INDEX);if(!raw)return [];
  try{return normaliseOutcomeIndex(JSON.parse(raw));}catch(error){recordStage10Diagnostic('index_corrupt',{recordType:'gameweekOutcome',severity:'error',message:error.message});return [];}
}''', flags=re.M)
regex_once('src/ui/outcomes.mjs',
r"async function loadOutcomeRecord\(outcomeId\)\{[\s\S]*?\n\}",
r'''async function loadOutcomeRecord(outcomeId){
  if(!outcomeId)return null;const raw=await rawEvidenceGet(K_OUTCOME_PREFIX+outcomeId);if(!raw)return null;
  try{const checked=await validateOutcomeRecord(JSON.parse(await decodeEvidenceRecord(raw)));if(!checked.ok){recordStage10Diagnostic(checked.reason==='schema_version'?'unsupported_version':'payload_corrupt',{recordType:'gameweekOutcome',recordId:outcomeId,severity:'error',message:checked.reason});return null;}return checked.record;}catch(error){recordStage10Diagnostic('payload_corrupt',{recordType:'gameweekOutcome',recordId:outcomeId,severity:'error',message:error.message});return null;}
}''', flags=re.M)

replace_once('src/ui/outcomes.mjs',
"  await rawEvidenceSet(K_OUTCOME_JOURNAL,stableStringify({outcomeId:metadata.outcomeId,contentHash:metadata.contentHash,startedAt:new Date().toISOString()}));",
"  const priorCurrent=index.find(row=>row.origin===OUTCOME_ORIGINS.LOCAL&&row.logicalKey===metadata.logicalKey&&row.current)?.outcomeId||null;\n  await rawEvidenceSet(K_OUTCOME_JOURNAL,stableStringify(stage10Journal({recordType:'gameweekOutcome',recordId:metadata.outcomeId,contentHash:metadata.contentHash,logicalKey:metadata.logicalKey,origin,priorCurrentId:priorCurrent,phase:'prepared'})));")
replace_once('src/ui/outcomes.mjs',
"    const verified=await loadOutcomeRecord(metadata.outcomeId);\n    if(!verified||verified.identity.contentHash!==metadata.contentHash) throw new Error('Outcome storage verification failed');\n    index=await enforceOutcomeBounds(index);",
"    const verified=await loadOutcomeRecord(metadata.outcomeId);\n    if(!verified||verified.identity.contentHash!==metadata.contentHash) throw new Error('Outcome storage verification failed');\n    await rawEvidenceSet(K_OUTCOME_JOURNAL,stableStringify(stage10Journal({recordType:'gameweekOutcome',recordId:metadata.outcomeId,contentHash:metadata.contentHash,logicalKey:metadata.logicalKey,origin,priorCurrentId:priorCurrent,phase:'payload_verified'})));\n    index=await enforceOutcomeBounds(index);\n    await rawEvidenceSet(K_OUTCOME_JOURNAL,stableStringify(stage10Journal({recordType:'gameweekOutcome',recordId:metadata.outcomeId,contentHash:metadata.contentHash,logicalKey:metadata.logicalKey,origin,priorCurrentId:priorCurrent,phase:'index_committed'})));")

regex_once('src/ui/outcomes.mjs',
r"async function recoverOutcomeJournal\(\)\{[\s\S]*?\n\}",
r'''async function recoverOutcomeJournal(){
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
}''', flags=re.M)

regex_once('src/ui/outcomes.mjs',
r"function downloadOutcome\(record\)\{[\s\S]*?\n\}",
r'''function downloadOutcome(record){const filename=outcomeFileName(record);requestStage10Download(filename,stableStringify(record)+'\n','application/json');return filename;}''', flags=re.M)

replace_once('src/ui/outcomes.mjs',
"async function collectOneOutcome(gameweek,{trigger,historyPayload,nowFn=Date.now}={}){",
r'''async function dispatchOutcomeStored(outcomeId){
  if(typeof document==='undefined'||typeof document.dispatchEvent!=='function'||typeof CustomEvent!=='function')return [];
  const pending=[],detail={outcomeId,waitUntil(promise){pending.push(Promise.resolve(promise));}};document.dispatchEvent(new CustomEvent('teamsheet:outcome-stored',{detail}));return Promise.allSettled(pending);
}
async function collectOneOutcome(gameweek,{trigger,historyPayload,nowFn=Date.now}={}){''')
replace_once('src/ui/outcomes.mjs',
"    else await storeOutcomeRecord(result.record,{origin:OUTCOME_ORIGINS.LOCAL});",
"    else {const stored=await storeOutcomeRecord(result.record,{origin:OUTCOME_ORIGINS.LOCAL});if(stored.stored)await dispatchOutcomeStored(result.record.identity.outcomeId);}")
replace_once('src/ui/outcomes.mjs',
"  try{ const record=await latestOutcomeRecord(); if(!record) throw new Error('No saved outcome is available'); downloadOutcome(record); if(message) message.textContent=`Exported ${outcomeFileName(record)}.`; }",
"  try{ const record=await latestOutcomeRecord(); if(!record) throw new Error('No saved outcome is available'); const filename=downloadOutcome(record); recordStage10Diagnostic('download_requested',{recordType:'gameweekOutcome',recordId:record.identity.outcomeId,severity:'info'}); if(message) message.textContent=stage10DownloadRequestedMessage(filename); }")
replace_once('src/ui/outcomes.mjs',
"  snapshotInputsForGameweek,latestOutcomeRecord,runOutcomeCollection,renderOutcomeStatus,initOutcomeUi",
"  snapshotInputsForGameweek,latestOutcomeRecord,dispatchOutcomeStored,runOutcomeCollection,renderOutcomeStatus,initOutcomeUi")

replace_once('src/ui/metrics.mjs',
"import { $, el, setChildren } from '../util.mjs';",
"import { $, el, setChildren } from '../util.mjs';\nimport { recordStage10Diagnostic, stage10Journal, parseStage10Journal, reconcileLocalCurrentRows } from './evidence-recovery.mjs';")
regex_once('src/ui/metrics.mjs',
r"async function loadMetricIndex\(\)\{[\s\S]*?\n\}",
r'''async function loadMetricIndex(){
  const raw=await rawEvidenceGet(K_METRIC_INDEX);if(!raw)return [];
  try{return normaliseMetricIndex(JSON.parse(raw));}catch(error){recordStage10Diagnostic('index_corrupt',{recordType:'gameweekEvaluation',severity:'error',message:error.message});return [];}
}''', flags=re.M)
regex_once('src/ui/metrics.mjs',
r"async function loadMetricRecord\(recordId\)\{[\s\S]*?\n\}",
r'''async function loadMetricRecord(recordId){
  if(!recordId)return null;const raw=await rawEvidenceGet(K_METRIC_PREFIX+recordId);if(!raw)return null;
  try{const checked=await validateMetricRecord(JSON.parse(await decodeEvidenceRecord(raw)));if(!checked.ok){recordStage10Diagnostic(checked.reason==='version'?'unsupported_version':'payload_corrupt',{recordType:'gameweekEvaluation',recordId,severity:'error',message:checked.reason});return null;}return checked.record;}catch(error){recordStage10Diagnostic('payload_corrupt',{recordType:'gameweekEvaluation',recordId,severity:'error',message:error.message});return null;}
}''', flags=re.M)
replace_once('src/ui/metrics.mjs',
"  await rawEvidenceSet(K_METRIC_JOURNAL,stableStringify({recordId:id,contentHash:metadata.contentHash,startedAt:new Date().toISOString()}));",
"  const priorCurrent=index.find(row=>row.logicalKey===logicalKey&&row.current)?.recordId||null;\n  await rawEvidenceSet(K_METRIC_JOURNAL,stableStringify(stage10Journal({recordType:checked.record.recordType,recordId:id,contentHash:metadata.contentHash,logicalKey,origin:'local_derivation',priorCurrentId:priorCurrent,phase:'prepared'})));")
replace_once('src/ui/metrics.mjs',
"    const verified=await loadMetricRecord(id);if(!verified||verified.identity.contentHash!==metadata.contentHash) throw new Error('Metric storage verification failed');\n    index=await enforceMetricBounds(index);return {stored:true,index,metadata};",
"    const verified=await loadMetricRecord(id);if(!verified||verified.identity.contentHash!==metadata.contentHash) throw new Error('Metric storage verification failed');\n    await rawEvidenceSet(K_METRIC_JOURNAL,stableStringify(stage10Journal({recordType:checked.record.recordType,recordId:id,contentHash:metadata.contentHash,logicalKey,origin:'local_derivation',priorCurrentId:priorCurrent,phase:'payload_verified'})));\n    index=await enforceMetricBounds(index);\n    await rawEvidenceSet(K_METRIC_JOURNAL,stableStringify(stage10Journal({recordType:checked.record.recordType,recordId:id,contentHash:metadata.contentHash,logicalKey,origin:'local_derivation',priorCurrentId:priorCurrent,phase:'index_committed'})));return {stored:true,index,metadata};")
regex_once('src/ui/metrics.mjs',
r"async function recoverMetricJournal\(\)\{[\s\S]*?\n\}",
r'''async function recoverMetricJournal(){
  const raw=await rawEvidenceGet(K_METRIC_JOURNAL);if(!raw)return false;const journal=parseStage10Journal(raw);
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
}''', flags=re.M)

replace_once('src/ui/review.mjs',
"import { $, el, setChildren } from '../util.mjs';",
"import { $, el, setChildren } from '../util.mjs';\nimport { recordStage10Diagnostic } from './evidence-recovery.mjs';\nimport { requestStage10Download, stage10DownloadRequestedMessage } from './download.mjs';")
regex_once('src/ui/review.mjs',
r"function reviewUiDownload\(filename,text,type\)\{[\s\S]*?\n\}",
r'''function reviewUiDownload(filename,text,type){return requestStage10Download(filename,text,type);}''', flags=re.M)
replace_once('src/ui/review.mjs',
"reviewUiDownload(`teamsheet-${bundle.scope.season}-${bundle.scope.label}-operating-review.json`,output.text,'application/json');if(message)message.textContent=`Downloaded ${bundle.identity.bundleId}.`;",
"const filename=`teamsheet-${bundle.scope.season}-${bundle.scope.label}-operating-review.json`;reviewUiDownload(filename,output.text,'application/json');recordStage10Diagnostic('download_requested',{recordType:'operatingReviewBundle',recordId:bundle.identity.bundleId,severity:'info'});if(message)message.textContent=stage10DownloadRequestedMessage(filename);")
replace_once('src/ui/review.mjs',
"reviewUiDownload(output.filename,output.text,'text/markdown;charset=utf-8');if(message)message.textContent=`Downloaded ${output.filename}.`;",
"reviewUiDownload(output.filename,output.text,'text/markdown;charset=utf-8');recordStage10Diagnostic('download_requested',{recordType:'operatingReviewBundle',recordId:output.filename,severity:'info'});if(message)message.textContent=stage10DownloadRequestedMessage(output.filename);")
replace_once('src/ui/review.mjs',
"reviewUiDownload(output.filename,output.text,'text/csv;charset=utf-8');if(message)message.textContent=`Downloaded ${output.filename} with ${output.rows} data row${output.rows===1?'':'s'}.`;",
"reviewUiDownload(output.filename,output.text,'text/csv;charset=utf-8');recordStage10Diagnostic('download_requested',{recordType:'operatingReviewBundle',recordId:output.filename,severity:'info'});if(message)message.textContent=`${stage10DownloadRequestedMessage(output.filename)} ${output.rows} data row${output.rows===1?'':'s'} prepared.`;")

append_once('tests/evidence-storage.test.mjs','Stage 10.5 snapshot journal recovery',r'''
// Stage 10.5 snapshot journal recovery

test('Stage 10.5 snapshot journal recovers a verified payload after an interrupted index write',async()=>{
  globalThis.localStorage.data={};
  const item=await record(7,deadline+7*86400000-18*60000);
  await evidence.rawEvidenceSet(evidence.K_EVIDENCE_PREFIX+item.identity.snapshotId,await evidence.encodeEvidenceRecord(item));
  await evidence.rawEvidenceSet(evidence.K_EVIDENCE_JOURNAL,JSON.stringify({recordType:'preDeadlineSnapshot',recordId:item.identity.snapshotId,contentHash:item.identity.contentHash,logicalKey:item.identity.duplicateKey,origin:evidence.EVIDENCE_ORIGINS.LOCAL,priorCurrentId:null,phase:'payload_verified',startedAt:new Date().toISOString()}));
  assert.deepEqual(await evidence.loadEvidenceIndex(),[]);
  await evidence.recoverEvidenceJournal();
  const recovered=await evidence.loadEvidenceIndex();
  assert.equal(recovered[0].snapshotId,item.identity.snapshotId);
  assert.equal(recovered[0].officialEligible,true);
  assert.equal(await evidence.rawEvidenceGet(evidence.K_EVIDENCE_JOURNAL),null);
});

test('Stage 10.5 malformed snapshot journal fails closed and is cleared',async()=>{
  globalThis.localStorage.data={};
  await evidence.rawEvidenceSet(evidence.K_EVIDENCE_JOURNAL,'{"recordId":"untrusted"}');
  await evidence.recoverEvidenceJournal();
  assert.equal(await evidence.rawEvidenceGet(evidence.K_EVIDENCE_JOURNAL),null);
  assert.deepEqual(await evidence.loadEvidenceIndex(),[]);
});

test('Stage 10.5 compression failure falls back to canonical plain JSON',async()=>{
  const original=globalThis.CompressionStream;
  globalThis.CompressionStream=class{constructor(){throw new Error('compression unavailable');}};
  try{const item=await record(8,deadline+8*86400000-18*60000);const encoded=await evidence.encodeEvidenceRecord(item);assert.ok(encoded.startsWith('{'));}
  finally{globalThis.CompressionStream=original;}
});
''')

append_once('tests/outcome-storage.test.mjs','Stage 10.5 outcome journal reconciliation',r'''
// Stage 10.5 outcome journal reconciliation

test('Stage 10.5 outcome journal recovery leaves exactly one current local revision',async()=>{
  reset();const first=await recordFor();await storeOutcomeRecord(first);const second=await recordFor(1,9,first);
  await rawEvidenceSet(K_OUTCOME_PREFIX+second.identity.outcomeId,await encodeEvidenceRecord(second));
  await rawEvidenceSet(K_OUTCOME_JOURNAL,JSON.stringify({recordType:'gameweekOutcome',recordId:second.identity.outcomeId,contentHash:second.identity.contentHash,logicalKey:second.identity.logicalKey,origin:OUTCOME_ORIGINS.LOCAL,priorCurrentId:first.identity.outcomeId,phase:'payload_verified',startedAt:new Date().toISOString()}));
  await recoverOutcomeJournal();const index=await loadOutcomeIndex();assert.equal(index.filter(row=>row.current).length,1);assert.equal(currentLocalMetadata(index,1).outcomeId,second.identity.outcomeId);
});

test('Stage 10.5 malformed outcome journal fails closed without promoting a record',async()=>{
  reset();await rawEvidenceSet(K_OUTCOME_JOURNAL,'{"recordType":"gameweekOutcome"}');await recoverOutcomeJournal();assert.deepEqual(await loadOutcomeIndex(),[]);assert.equal(await rawEvidenceGet(K_OUTCOME_JOURNAL),null);
});
''')

append_once('tests/metrics-storage.test.mjs','Stage 10.5 metric journal reconciliation',r'''
// Stage 10.5 metric journal reconciliation

test('Stage 10.5 metric journal recovery leaves exactly one current revision',async()=>{
  reset();const first=await record();await storeMetricRecord(first);const second=await record(9,first);
  await rawEvidenceSet(K_METRIC_PREFIX+second.identity.evaluationId,await encodeEvidenceRecord(second));
  await rawEvidenceSet(K_METRIC_JOURNAL,JSON.stringify({recordType:'gameweekEvaluation',recordId:second.identity.evaluationId,contentHash:second.identity.contentHash,logicalKey:second.identity.logicalKey,origin:'local_derivation',priorCurrentId:first.identity.evaluationId,phase:'payload_verified',startedAt:new Date().toISOString()}));
  await recoverMetricJournal();const index=await loadMetricIndex();assert.equal(index.filter(row=>row.current).length,1);assert.equal(metricCurrentMetadata(index,'2026-27|gw1').recordId,second.identity.evaluationId);
});

test('Stage 10.5 malformed metric journal fails closed',async()=>{
  reset();await rawEvidenceSet(K_METRIC_JOURNAL,'{"recordId":"bad"}');await recoverMetricJournal();assert.deepEqual(await loadMetricIndex(),[]);assert.equal(await rawEvidenceGet(K_METRIC_JOURNAL),null);
});
''')

write('tests/stage10-hardening.test.mjs', r'''import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canonicalise,safeEvidenceText,safeEvidenceEndpoint } from '../src/evidence/snapshot.mjs';
import { validateTransferHorizonEvaluation,METRIC_VERSION,TRANSFER_METRIC_SCHEMA_VERSION } from '../src/evidence/metrics.mjs';
import { reviewCsvTextValue,reviewCsvCell } from '../src/evidence/review.mjs';
import { stage10Journal,parseStage10Journal,reconcileLocalCurrentRows,stage10SafeText,recordStage10Diagnostic,stage10Diagnostics,clearStage10Diagnostics } from '../src/ui/evidence-recovery.mjs';
import { STAGE10_DOWNLOAD_REVOKE_DELAY_MS,requestStage10Download,stage10DownloadRequestedMessage } from '../src/ui/download.mjs';

const EVIDENCE_SOURCE=readFileSync(new URL('../src/ui/evidence.mjs',import.meta.url),'utf8');
const OUTCOME_SOURCE=readFileSync(new URL('../src/ui/outcomes.mjs',import.meta.url),'utf8');
const METRIC_SOURCE=readFileSync(new URL('../src/ui/metrics.mjs',import.meta.url),'utf8');
const REVIEW_SOURCE=readFileSync(new URL('../src/ui/review.mjs',import.meta.url),'utf8');

function transferRecord(overrides={}){return {recordType:'transferHorizonEvaluation',schemaVersion:TRANSFER_METRIC_SCHEMA_VERSION,metricVersion:METRIC_VERSION,managerRef:'mgr-0123456789abcdef0123456789abcdef',season:'2026-27',startGameweek:1,horizon:3,createdAt:'2026-09-01T00:00:00.000Z',sources:{startEvaluationId:'evaluation-2026-27-gw1-r1-0123456789abcdef',gameweekEvaluationIds:[]},baseline:{},plans:[],completeness:{complete:true,requiredGameweeks:[1,2,3]},identity:{logicalKey:'2026-27|transfer|gw1|h3',revision:1,rootTransferEvaluationId:'root',supersedesTransferEvaluationId:null,metricDataHash:'a'.repeat(64),contentHash:'b'.repeat(64),transferEvaluationId:'transfer-evaluation-2026-27-gw1-h3-r1-0123456789abcdef'},...overrides};}

test('Stage 10.5 rejects prototype-bearing JSON keys before canonicalisation',()=>{
  for(const key of ['__proto__','prototype','constructor']){const value=JSON.parse(`{"${key}":{"polluted":true}}`);assert.throws(()=>canonicalise(value),/unsafe object key/);}
  assert.equal({}.polluted,undefined);
});

test('Stage 10.5 diagnostic redaction removes secrets, queries and account identifiers',()=>{
  const value='https://example.test/entry/12345/history/?api_key=sk-secret-value#fragment';
  assert.equal(safeEvidenceEndpoint(value).includes('12345'),false);assert.equal(safeEvidenceEndpoint(value).includes('api_key'),false);assert.equal(stage10SafeText(value).includes('sk-secret'),false);
  assert.equal(safeEvidenceText('/leagues-classic/999/standings/?page=2'),'/leagues-classic/[redacted]/standings/');
});

test('Stage 10.5 journals are strict and current pointers reconcile deterministically',()=>{
  const journal=stage10Journal({recordType:'gameweekOutcome',recordId:'outcome-2026-27-gw1-r2-0123456789abcdef',contentHash:'a'.repeat(64),logicalKey:'2026-27|gw1',origin:'local_collection',priorCurrentId:'old',phase:'payload_verified'});
  assert.equal(parseStage10Journal(JSON.stringify(journal)).recordId,journal.recordId);assert.equal(parseStage10Journal('{"recordId":"bad"}'),null);
  const rows=reconcileLocalCurrentRows([{outcomeId:'old',logicalKey:'2026-27|gw1',origin:'local_collection',current:true},{outcomeId:journal.recordId,logicalKey:'2026-27|gw1',origin:'local_collection',current:true},{outcomeId:'imported',logicalKey:'2026-27|gw1',origin:'recovery_import',current:true}],{logicalKey:'2026-27|gw1',recordId:journal.recordId,idKey:'outcomeId',origin:'local_collection'});
  assert.equal(rows.filter(row=>row.current).length,1);assert.equal(rows.find(row=>row.current).outcomeId,journal.recordId);
});

test('Stage 10.5 diagnostics are bounded and owner-safe',()=>{
  clearStage10Diagnostics();for(let i=0;i<25;i++)recordStage10Diagnostic(`code_${i}`,{message:`/entry/${i}?api_key=secret`});assert.equal(stage10Diagnostics().length,20);assert.equal(stage10Diagnostics().some(row=>row.message.includes('api_key')),false);
});

test('Stage 10.5 transfer records reject version mismatch and forbidden evidence',async()=>{
  assert.equal((await validateTransferHorizonEvaluation(transferRecord({metricVersion:'2.0.0'}))).reason,'version');
  const unsafe=transferRecord();unsafe.baseline={note:'Authorization: Bearer abc'};const checked=await validateTransferHorizonEvaluation(unsafe);assert.equal(checked.ok,false);assert.match(checked.message,/Evidence safety check failed/);
});

test('Stage 10.5 CSV neutralises line-feed formula text without changing numeric negatives',()=>{
  assert.equal(reviewCsvTextValue('\n=SUM(A1:A2)'),"'\n=SUM(A1:A2)");assert.equal(reviewCsvCell(-4),'-4');
});

test('Stage 10.5 download helper reports only a request and delays URL cleanup',()=>{
  const calls=[],anchor={click(){calls.push('click');},remove(){calls.push('remove');}};
  const documentImpl={body:{appendChild(){calls.push('append');}},createElement(){return anchor;}};
  const urlImpl={createObjectURL(){calls.push('create');return 'blob:test';},revokeObjectURL(){calls.push('revoke');}};
  let delay=null,task=null;const result=requestStage10Download('file.json','{}','application/json',{documentImpl,urlImpl,BlobImpl:Blob,setTimeoutImpl(fn,ms){task=fn;delay=ms;}});
  assert.equal(result.requested,true);assert.equal(delay,STAGE10_DOWNLOAD_REVOKE_DELAY_MS);assert.equal(calls.includes('revoke'),false);task();assert.equal(calls.includes('revoke'),true);assert.match(stage10DownloadRequestedMessage('file.json'),/confirm file\.json appears in Files or Downloads/);
});

test('Stage 10.5 wiring includes bounded retry, journals, immediate metrics and honest downloads',()=>{
  assert.match(EVIDENCE_SOURCE,/AUTO_CAPTURE_RETRY_MS=5\*60\*1000/);assert.match(EVIDENCE_SOURCE,/AUTO_CAPTURE_MAX_ATTEMPTS=3/);assert.match(EVIDENCE_SOURCE,/K_EVIDENCE_JOURNAL/);assert.match(EVIDENCE_SOURCE,/Live-season checklist and recovery/);
  assert.match(OUTCOME_SOURCE,/dispatchOutcomeStored/);assert.match(OUTCOME_SOURCE,/reconcileLocalCurrentRows/);assert.match(METRIC_SOURCE,/reconcileLocalCurrentRows/);assert.match(REVIEW_SOURCE,/stage10DownloadRequestedMessage/);
  for(const source of [EVIDENCE_SOURCE,OUTCOME_SOURCE,REVIEW_SOURCE])assert.doesNotMatch(source,/message\.textContent=`(?:Exported|Downloaded)/);
});
''')

write('docs/STAGE10-OPERATIONS.md', r'''# STAGE10-OPERATIONS.md — Live-season evidence operations
Purpose: phone-first operating and disaster-recovery procedure for Stage 10. Last updated: 2026-07-30.

## Before every deadline
1. Open Teamsheet in Safari during the preferred 20–10 minute window.
2. Let the verified refresh complete, then open More → Deadline evidence.
3. Confirm the current Gameweek is Official-eligible. “Recorded only” is valid diagnostic evidence but is not official.
4. If capture is still due, keep the visible page open. Teamsheet retries every five minutes, at most three times for the same verified dataset and timing priority, and stops at the two-minute safety cutoff.
5. Use Diagnostic capture only before the cutoff when automatic capture has not succeeded.
6. Request the snapshot JSON and confirm the deterministic file appears in Files or Downloads. A browser click is not proof that the file was retained.

## After a Gameweek
1. Open Teamsheet after Official FPL marks the event checked.
2. Provisional outcomes remain outside metrics. Complete or corrected outcomes create immutable downstream revisions.
3. Confirm the evaluated Gameweek appears in Operating review.
4. Request the weekly operating-review JSON and verify it in Files. Import only the required CSV tables into Google Sheets.
5. After a correction, retain the earlier export if an audit trail is wanted and request the corrected weekly bundle.

## Warning meanings
- Official-eligible: locally captured prospective evidence that passed timing and completeness rules.
- Recorded only: valid evidence that cannot qualify officially.
- Recovery only: imported or origin-unproven evidence; never official/current.
- Provisional: official outcome checking is incomplete.
- Complete/Corrected: authoritative outcome revision eligible for evaluation.
- Partial review: derived metrics remain usable, but one or more exact source/revision payloads are missing.
- Storage attention required: the app failed closed; export accessible records before reset or deletion.

## Durable backup schedule
- Every deadline: snapshot JSON.
- Every complete or corrected Gameweek: weekly operating-review JSON.
- As needed: CSV tables for manual Google Sheets import.
- Monthly, before clearing browser data, and before changing devices: season operating-review JSON.

## Storage loss and disaster recovery
1. Do not reset or delete storage until accessible files have been checked.
2. Restore snapshot/outcome JSON only through the recovery controls. Restored records remain recovery-only and cannot establish local official/current status.
3. Imported files are never silently migrated or rewritten. Unknown versions fail closed and the original file remains owner-controlled.
4. A trustworthy interrupted-write journal may complete a local transaction. An orphan without that journal is never promoted to official/current.
5. Local metric views may not be reconstructable from recovery-only imports. The exported operating-review JSON is the durable audit copy.
6. Static GitHub Pages cannot collect while Safari is fully closed or suspended. Reopen Teamsheet to resume checks.

## Manual Google Sheets boundary
Use the future dedicated Teamsheet Google account. Keep the live 2026/27 workbook separate from historical read-only data. Import one deterministic CSV into its matching tab, preserve IDs/hashes/revisions, and retain canonical JSON outside the sheet. No OAuth, workbook ID or unattended append exists in Stage 10.5.

## Completion wording
Stage 10 collection and evaluation infrastructure is complete; prospective model validation remains in progress. This does not prove accuracy, calibration, external timestamp notarisation or guaranteed closed-app collection.
''')

write('docs/STAGE10-ITEM5.md', r'''# STAGE10-ITEM5.md — Hardening and documentation
Purpose: authoritative implementation and verification record for Stage 10.5. Last updated: 2026-07-30.

## Status
Implemented and verified on branch `agent/stage10-5-hardening-documentation` after explicit owner approval. Draft PR and physical iPhone acceptance remain required before merge.

- Base main: `8ee46fb7b82e2c32484beaff34989ff766a3215f`
- Verified source: `__SOURCE_COMMIT__`
- Generated/verification commit: `__GENERATED_COMMIT__`
- Tests: **__TEST_COUNT__ passed, 0 failed, 0 skipped**
- Embedded source hash: `__SOURCE_HASH__`
- Production HTML: `__HTML_BYTES__` bytes

## Implemented scope
1. Transactional snapshot journal plus consistent outcome/metric journal phases and deterministic current-pointer recovery.
2. Five-minute visible snapshot retry with a three-attempt cap per verified dataset/window priority.
3. Strict dangerous-key rejection, version/shape parity, diagnostic redaction and line-feed spreadsheet-formula protection.
4. Shared honest download requests with delayed object-URL cleanup and iPhone-oriented recovery diagnostics.
5. Live-season and disaster-recovery runbook.
6. Deterministic fault-injection, storage, security and wiring tests.

## Deliberately unchanged
No projection, expected-minutes, scoring, calibration, fixture, uncertainty, squad, captaincy, transfer optimiser, provider, transport, endpoint, backend, database, OAuth, automatic Google Sheets sync, FPL write action, package or later-stage work changed.

## Verification
`./run-tests.sh` passed with no golden regeneration. Two builds using `BUILD_COMMIT=__SOURCE_COMMIT__` were byte-identical for `dist/index.html`, `dist/app.bundle.js` and `dist/manifest.json`; root `index.html` exactly matched `dist/index.html`. The manifest commit, module order and source hash agreed with generated output.

## Remaining limitations
Browser files are unencrypted and owner-controlled. Safari cannot confirm durable download retention. Static GitHub Pages cannot wake a fully closed/suspended iPhone. Recovery imports cannot become official/current. No existing immutable schema required migration, so no migration engine was added. Prospective validation begins with genuine pre-deadline observations and does not yet establish accuracy or calibration.
''')

regex_once('CLAUDE.md',r"## Current checkpoint\n[\s\S]*?\n\n## Non-negotiable rules",
"## Current checkpoint\nStage 10.5 — Hardening and documentation is implemented and verified on branch `agent/stage10-5-hardening-documentation` after explicit owner approval. Verified source `__SOURCE_COMMIT__` passes **__TEST_COUNT__/__TEST_COUNT__ tests** with deterministic exact-identity builds. The draft PR and physical iPhone acceptance remain the merge gate. No model, provider, backend or automatic Google Sheets behaviour changed.\n\n## Non-negotiable rules",flags=re.M)

regex_once('docs/ROADMAP.md',r"## Current\n[\s\S]*?\n\n## Upcoming",
"## Current\n- **Stage 10.5 — Hardening and documentation** · IMPLEMENTED AND VERIFIED on `agent/stage10-5-hardening-documentation` after owner approval; draft PR and physical iPhone acceptance remain pending.\n- Verified source `__SOURCE_COMMIT__`: **__TEST_COUNT__/__TEST_COUNT__ tests passed** with byte-identical exact-identity builds.\n- Storage recovery, schema/security parity, bounded retry, honest downloads and live-season operations are hardened without model/provider changes.\n\n## Upcoming",flags=re.M)

append_once('docs/PROJECT_CONTEXT.md','## Stage 10.5 implementation candidate',r'''
## Stage 10.5 implementation candidate
Stage 10.5 is implemented and verified on `agent/stage10-5-hardening-documentation` at source `__SOURCE_COMMIT__`. It hardens browser recovery, version/import security, bounded snapshot retry, honest downloads and owner operations only. Draft PR review and physical iPhone acceptance remain required before merge. Stage 10 completion still means infrastructure complete while prospective validation remains in progress.
''')
append_once('docs/ARCHITECTURE.md','## Stage 10.5 recovery architecture',r'''
## Stage 10.5 recovery architecture
Stage 10 storage uses verified payload writes, phase journals, index/current-pointer commitment and bounded pruning. Recovery trusts local origin only when a valid journal links the candidate ID and hash; unproven or imported records remain recovery-only. Shared diagnostics expose corruption/storage states without raw payloads, URLs or secrets. Downloads are owner-controlled browser requests rather than acknowledged durable backups.
''')
append_once('docs/DECISIONS.md','## D-Stage10.5 — Explicit recovery, no migration engine',r'''
## D-Stage10.5 — Explicit recovery, no migration engine
Approved 2026-07-30. Current version-1 Stage 10 records have no older supported schema requiring conversion. Unknown versions fail closed; immutable records are never silently repaired or rewritten. A future migration must be separately approved, deterministic, one-way, fixture-tested and preserve the original exact record. Snapshot retries are five-minute visible checks capped at three per verified dataset/window priority.
''')
append_once('docs/KNOWN_LIMITATIONS.md','## Stage 10.5 hardening limitations',r'''
## Stage 10.5 hardening limitations
- Safari can acknowledge only that a download was requested; Pritesh must confirm the file in Files or Downloads.
- Browser storage and exported JSON remain unencrypted and are not a permanent database.
- Static GitHub Pages cannot perform guaranteed closed-app collection.
- Recovery-only imports cannot become official/current or automatically recreate every local metric view.
- No migration engine exists because no older supported Stage 10 schema currently requires one.
- Stage 10 infrastructure completion does not establish prediction accuracy or calibration.
''')
append_once('docs/DATA_SOURCES.md','## Stage 10.5 data-source boundary',r'''
## Stage 10.5 data-source boundary
Stage 10.5 changes no provider, transport, endpoint, validation threshold or source allowlist. Recovery and metrics operate only on existing validated immutable records. Google Sheets remains a manual analysis destination and is not a provider or authoritative evidence source.
''')
append_once('docs/SECURITY.md','## Stage 10.5 storage and import hardening',r'''
## Stage 10.5 storage and import hardening
Untrusted JSON now rejects prototype-bearing keys before canonicalisation. Metric and transfer validators enforce supported versions, exact public shapes, identity consistency and forbidden-evidence checks. Diagnostic text strips queries/fragments, numeric manager/league paths and raw or encoded secret-shaped values. Phase journals may complete only a hash-verified local transaction; imports and unproven orphans remain recovery-only. CSV text beginning with line-feed and other formula-control prefixes is neutralised while genuine numeric negatives remain numeric.
''')
append_once('docs/TESTING.md','## Stage 10.5 hardening verification',r'''
## Stage 10.5 hardening verification
Stage 10.5 adds deterministic fault-injection coverage for snapshot/outcome/metric journals, corrupt journals, duplicate-current reconciliation, compression fallback, dangerous JSON keys, version parity, diagnostic redaction, line-feed formula injection, bounded automatic retry, immediate outcome-to-metric orchestration and honest delayed-cleanup downloads. Verified source `__SOURCE_COMMIT__` passes **__TEST_COUNT__/__TEST_COUNT__ tests** with byte-identical exact-identity builds and root/deployable equality.
''')
append_once('docs/STAGE10-DESIGN.md','## Stage 10.5 verified implementation',r'''
## Stage 10.5 verified implementation
The owner approved the exact hardening/documentation scope on 30 July 2026. Source `__SOURCE_COMMIT__` adds transactional recovery, strict schema/import parity, bounded deadline retry, honest mobile download handling and the live-season runbook without changing any production formula, provider or Google boundary. The correct completion wording remains: **Stage 10 collection and evaluation infrastructure is complete; prospective model validation remains in progress.**
''')

replace_once('docs/TESTING.md',
"24. `metrics-storage.test.mjs` — verified compressed metric writes, deterministic metadata, current/superseded revision pointers, correction retention, interrupted-write journal recovery, tamper rejection, bounds, quota failure and deletion isolation from source evidence.",
"24. `metrics-storage.test.mjs` — verified compressed metric writes, deterministic metadata, current/superseded revision pointers, correction retention, interrupted-write journal recovery, tamper rejection, bounds, quota failure and deletion isolation from source evidence.\n25. `stage10-hardening.test.mjs` — dangerous-key rejection, diagnostic redaction, strict journals/current reconciliation, transfer-version parity, line-feed spreadsheet protection, honest download requests and bounded retry/orchestration wiring.")

print('Stage 10.5 source transformations applied successfully')
