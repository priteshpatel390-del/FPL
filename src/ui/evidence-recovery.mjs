import { canonicalise } from '../evidence/snapshot.mjs';

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
