import test from 'node:test';
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
  assert.match(EVIDENCE_SOURCE,/AUTO_CAPTURE_RETRY_MS=5\*60\*1000/);assert.match(EVIDENCE_SOURCE,/AUTO_CAPTURE_MAX_ATTEMPTS=3/);assert.match(EVIDENCE_SOURCE,/K_EVIDENCE_JOURNAL/);assert.match(EVIDENCE_SOURCE,/stage10DiagnosticsHost/);assert.match(EVIDENCE_SOURCE,/Recovery diagnostics/);
  assert.match(OUTCOME_SOURCE,/dispatchOutcomeStored/);assert.match(OUTCOME_SOURCE,/reconcileLocalCurrentRows/);assert.match(METRIC_SOURCE,/reconcileLocalCurrentRows/);assert.match(REVIEW_SOURCE,/stage10DownloadRequestedMessage/);
  for(const source of [EVIDENCE_SOURCE,OUTCOME_SOURCE,REVIEW_SOURCE])assert.doesNotMatch(source,/message\.textContent=`(?:Exported|Downloaded)/);
});
