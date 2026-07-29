import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  VERIFIED_REFRESH_MIN_AGE_MS,
  shouldRefreshVerifiedData,
  dispatchVerifiedData
} from '../src/main.mjs';

const APP_HTML=readFileSync(new URL('../app.html',import.meta.url),'utf8');
const MAIN_SOURCE=readFileSync(new URL('../src/main.mjs',import.meta.url),'utf8');
const VIEWS_SOURCE=readFileSync(new URL('../src/ui/views.mjs',import.meta.url),'utf8');
const EVIDENCE_SOURCE=readFileSync(new URL('../src/ui/evidence.mjs',import.meta.url),'utf8');

test('startup gate is silent, minimalist and visible by default',()=>{
  assert.match(APP_HTML,/<body class="startup-pending" aria-busy="true">/);
  assert.match(APP_HTML,/id="startupGate"[^>]*role="status"[^>]*aria-label="Opening Teamsheet"/);
  assert.match(APP_HTML,/class="startup-wordmark">TEAMSHEET/);
  assert.match(APP_HTML,/class="startup-pitch"/);
  assert.doesNotMatch(APP_HTML,/startupTitle|startupDetail|startup-note/);
  assert.doesNotMatch(APP_HTML,/Loading verified data|Checking official FPL|Approved sources · automatic checks/);
});

test('foreground refresh is due only after the approved verification age',()=>{
  const now=1_000_000;
  assert.equal(VERIFIED_REFRESH_MIN_AGE_MS,10*60*1000);
  assert.equal(shouldRefreshVerifiedData(0,now),true);
  assert.equal(shouldRefreshVerifiedData(now-VERIFIED_REFRESH_MIN_AGE_MS+1,now),false);
  assert.equal(shouldRefreshVerifiedData(now-VERIFIED_REFRESH_MIN_AGE_MS,now),true);
});

test('startup and foreground paths use the same deferred verified refresh',()=>{
  assert.match(VIEWS_SOURCE,/await runVerifiedRefresh\(\{reason:'startup',startup:true,force:true\}\)/);
  assert.match(VIEWS_SOURCE,/installVerifiedRefreshTriggers\(\)/);
  assert.match(VIEWS_SOURCE,/runVerifiedRefresh\(\{reason:'manual',force:true\}\)/);
  assert.match(MAIN_SOURCE,/deferRender:true/);
  assert.match(MAIN_SOURCE,/Promise\.allSettled\(\[loadUnderstat\(\), loadOdds\(\), loadMinuteHistories\(\)\]\)/);
  assert.match(MAIN_SOURCE,/document\.addEventListener\('visibilitychange',refreshIfDue\)/);
});

test('automatic evidence is dispatched without extending startup loading',async()=>{
  assert.match(MAIN_SOURCE,/void dispatchVerifiedData\(\{reason,verifiedAt:lastVerifiedRefreshAt,source:report\.source\}\)/);
  assert.doesNotMatch(MAIN_SOURCE,/await dispatchVerifiedData/);
  const previousDocument=globalThis.document;
  const previousCustomEvent=globalThis.CustomEvent;
  let completed=false;
  globalThis.CustomEvent=class { constructor(type,options){ this.type=type; this.detail=options.detail; } };
  globalThis.document={
    dispatchEvent(event){
      assert.equal(event.type,'teamsheet:data-verified');
      event.detail.waitUntil(Promise.resolve().then(()=>{ completed=true; }));
      return true;
    }
  };
  try{
    const results=await dispatchVerifiedData({reason:'startup'});
    assert.equal(completed,true);
    assert.equal(results.length,1);
    assert.equal(results[0].status,'fulfilled');
  }finally{
    globalThis.document=previousDocument;
    globalThis.CustomEvent=previousCustomEvent;
  }
});

test('evidence is automatic and backup import is segregated from official records',()=>{
  assert.match(EVIDENCE_SOURCE,/teamsheet:data-verified/);
  assert.match(EVIDENCE_SOURCE,/maybeAutoCaptureEvidence/);
  assert.match(EVIDENCE_SOURCE,/origin:EVIDENCE_ORIGINS\.RECOVERY/);
  assert.match(APP_HTML,/No routine action is required/);
  assert.match(APP_HTML,/Imported files cannot become official prospective evidence/);
});
