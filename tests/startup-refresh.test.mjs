import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  VERIFIED_REFRESH_MIN_AGE_MS,
  shouldRefreshVerifiedData,
  shouldBlockRefreshInteractions,
  shouldRunForegroundRefresh,
  browserReportsOffline,
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


test('failed refresh attempts respect the foreground cooldown',()=>{
  const now=2_000_000;
  const failedAttemptCompletedAt=now-1_000;
  assert.equal(shouldRunForegroundRefresh(failedAttemptCompletedAt,{visibilityState:'visible',now}),false);
  assert.equal(shouldRunForegroundRefresh(now-VERIFIED_REFRESH_MIN_AGE_MS,{visibilityState:'visible',now}),true);
  assert.equal(shouldRunForegroundRefresh(0,{visibilityState:'hidden',now}),false);
});

test('only startup and manual refreshes block app interaction',()=>{
  assert.equal(shouldBlockRefreshInteractions({reason:'startup',startup:true}),true);
  assert.equal(shouldBlockRefreshInteractions({reason:'manual',startup:false}),true);
  assert.equal(shouldBlockRefreshInteractions({reason:'foreground',startup:false}),false);
});

test('a definite browser-offline state is distinguished from unknown connectivity',()=>{
  assert.equal(browserReportsOffline({onLine:false}),true);
  assert.equal(browserReportsOffline({onLine:true}),false);
  assert.equal(browserReportsOffline({}),false);
  assert.equal(browserReportsOffline(null),false);
});

test('definite-offline refresh preserves saved FPL data and discloses fallback use',()=>{
  assert.match(MAIN_SOURCE,/if\(browserReportsOffline\(\)\)\{\s*const error=new Error\('device offline'\);\s*error\.offline=true;\s*throw error;\s*\}/);
  assert.match(MAIN_SOURCE,/offline \? 'device is offline' : 'live feed unreachable'/);
  assert.match(MAIN_SOURCE,/Offline — still showing saved data from/);
  assert.match(MAIN_SOURCE,/Teamsheet is offline and no verified season data is available/);
});

test('Safari resume uses completed-attempt throttling and in-flight deduplication',()=>{
  assert.match(MAIN_SOURCE,/let lastRefreshAttemptAt = 0;/);
  assert.match(MAIN_SOURCE,/if\(verifiedRefreshPromise\) return verifiedRefreshPromise;/);
  assert.match(MAIN_SOURCE,/finally\{\s*lastRefreshAttemptAt=nowFn\(\);/);
  assert.match(MAIN_SOURCE,/shouldRunForegroundRefresh\(lastRefreshAttemptAt/);
  assert.match(MAIN_SOURCE,/if\(blockInteractions\) setRefreshInteractionLock\(true/);
});

test('startup and foreground paths use the same deferred verified refresh',()=>{
  assert.match(VIEWS_SOURCE,/await runVerifiedRefresh\(\{reason:'startup',startup:true,force:true\}\)/);
  assert.match(VIEWS_SOURCE,/installVerifiedRefreshTriggers\(\)/);
  assert.match(VIEWS_SOURCE,/runVerifiedRefresh\(\{reason:'manual',force:true\}\)/);
  assert.match(MAIN_SOURCE,/deferRender:true/);
  assert.match(MAIN_SOURCE,/loadUnderstat\(\{force:Boolean\(options\.forceSupporting\)\}\)/);
  assert.match(MAIN_SOURCE,/loadOdds\(\{force:Boolean\(options\.forceSupporting\)\}\)/);
  assert.match(MAIN_SOURCE,/loadMinuteHistories\(\)/);
  assert.match(MAIN_SOURCE,/forceSupporting:reason==='manual'/);
  assert.match(VIEWS_SOURCE,/oddsKey[\s\S]*loadOdds\(\{force:true\}\)/);
  assert.match(VIEWS_SOURCE,/useUstat[\s\S]*loadUnderstat\(\{force:true\}\)/);
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
  const shell=readFileSync(new URL('../src/ui/app-shell.mjs',import.meta.url),'utf8');
  assert.match(shell,/Restored evidence remains recovery-only/);
});
