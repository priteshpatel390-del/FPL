import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TRANSFER_PLANNER_COMMITTED_CONTROL_IDS,
  TRANSFER_PRESENTATION_STATES,
  transferPlannerControlSignature,
  transferPlannerRefreshRequired,
  transferPlannerHasActivePreview,
  transferPlannerReadAssumptions,
  transferPlannerPresentationState,
  transferPlannerNoTransferCopy,
  transferPlannerNetLabel,
  transferPlannerPlanNames
} from '../src/ui/transfer-optimiser-view.mjs';

test('committed transfer controls cover assumptions and display controls',()=>{
  assert.deepEqual(TRANSFER_PLANNER_COMMITTED_CONTROL_IDS,['trFtCount','trBankIn','trHorizon','trTop']);
});

test('transfer planner signature changes for any committed assumption or display choice',()=>{
  const previous=transferPlannerControlSignature('1','0.5','6','8');
  assert.equal(transferPlannerRefreshRequired(previous,transferPlannerControlSignature('1','0.5','6','8')),false);
  assert.equal(transferPlannerRefreshRequired(previous,transferPlannerControlSignature('2','0.5','6','8')),true);
  assert.equal(transferPlannerRefreshRequired(previous,transferPlannerControlSignature('1','0.6','6','8')),true);
  assert.equal(transferPlannerRefreshRequired(previous,transferPlannerControlSignature('1','0.5','3','8')),true);
  assert.equal(transferPlannerRefreshRequired(previous,transferPlannerControlSignature('1','0.5','6','15')),true);
});

test('planning assumptions validate explicitly instead of silently coercing blanks',()=>{
  assert.deepEqual(transferPlannerReadAssumptions('','').issues,[
    'Enter your current free transfers.',
    'Enter your bank balance.'
  ]);
  assert.equal(transferPlannerReadAssumptions('1.5','0').valid,false);
  assert.equal(transferPlannerReadAssumptions('6','0').valid,false);
  assert.equal(transferPlannerReadAssumptions('1','-0.1').valid,false);
  assert.equal(transferPlannerReadAssumptions('1','0.15').valid,false);
  assert.deepEqual(transferPlannerReadAssumptions('2','1.7'),{
    valid:true,
    issues:[],
    freeTransfers:2,
    bankMillions:1.7,
    bankTenths:17
  });
});

test('presentation state distinguishes transfer winner, baseline winner and baseline-only evidence',()=>{
  const baseline={transferCount:0,netGain:0};
  const transfer={transferCount:1,netGain:2};
  assert.equal(transferPlannerPresentationState([]),TRANSFER_PRESENTATION_STATES.UNAVAILABLE);
  assert.equal(transferPlannerPresentationState([baseline]),TRANSFER_PRESENTATION_STATES.BASELINE_ONLY);
  assert.equal(transferPlannerPresentationState([baseline,transfer]),TRANSFER_PRESENTATION_STATES.BASELINE_FIRST);
  assert.equal(transferPlannerPresentationState([transfer,baseline]),TRANSFER_PRESENTATION_STATES.TRANSFER_FIRST);
});

test('no-transfer wording describes FT consequences without overstating incomplete evidence',()=>{
  const only=transferPlannerNoTransferCopy({freeTransfersBefore:1,freeTransfersNextGW:2},0,false);
  assert.equal(only.headline,'Make no transfer');
  assert.match(only.ftEffect,/Roll one FT/);
  assert.match(only.comparison,/not evidence/);

  const cap=transferPlannerNoTransferCopy({freeTransfersBefore:5,freeTransfersNextGW:5},4,true);
  assert.match(cap.ftEffect,/5 FT cap/);
  assert.match(cap.comparison,/ranks above/);
});

test('net label calls the output a model comparison rather than promised points',()=>{
  assert.equal(transferPlannerNetLabel(1.24),'+1.2 net model advantage');
  assert.equal(transferPlannerNetLabel(-0.76),'−0.8 net model disadvantage');
  assert.equal(transferPlannerNetLabel(0),'Level net model comparison');
});

test('plan names resolve known players and retain deterministic ID fallbacks',()=>{
  const names=transferPlannerPlanNames({transfers:[
    {outPlayerId:1,inPlayerId:2},
    {outPlayerId:3,inPlayerId:4}
  ]},{1:{web_name:'Alpha'},2:{web_name:'Beta'}});
  assert.deepEqual(names,[
    {outName:'Alpha',inName:'Beta',outPlayerId:1,inPlayerId:2},
    {outName:'3',inName:'4',outPlayerId:3,inPlayerId:4}
  ]);
});

test('any active transfer or captaincy comparison is recognised before invalidation',()=>{
  assert.equal(transferPlannerHasActivePreview({}),false);
  assert.equal(transferPlannerHasActivePreview({transfer:{transferCount:1}}),true);
  assert.equal(transferPlannerHasActivePreview({captainId:9}),true);
  assert.equal(transferPlannerHasActivePreview({viceId:10}),true);
  assert.equal(transferPlannerHasActivePreview({selectionMode:'vice'}),true);
});

// Replaces an earlier assertion that required transfer-optimiser-view.mjs to call
// optimiseTransfers({...}) directly. That call was the synchronous main-thread search which
// froze Safari, so the contract is now the stronger one: the presentation module must not be
// able to enter the optimiser at all, and the background worker must be the only entry point.
test('workspace presentation cannot enter the optimiser and keeps Team preview routing',()=>{
  const source=readFileSync(new URL('../src/ui/transfer-optimiser-view.mjs',import.meta.url),'utf8');
  const performance=readFileSync(new URL('../src/ui/transfer-performance.mjs',import.meta.url),'utf8');
  const views=readFileSync(new URL('../src/ui/views.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/optimiseTransfers\s*\(/);
  assert.doesNotMatch(source,/function renderTransfers\s*\(/);
  assert.match(performance,/function renderTransfers\(\)/);
  assert.match(performance,/const result=optimiseTransfers\(\{\.\.\.payload\.args/);
  assert.match(source,/globalThis\.__teamsheetNavigate\?\.\('#\/team'\)/);
  assert.doesNotMatch(source,/data-view="squad"/);
  assert.doesNotMatch(source,/el\('table'/);
  assert.doesNotMatch(views,/VIEW — TRANSFER PLANNER/);
  assert.doesNotMatch(views,/\['trHorizon','trTop'\]\.forEach/);
});

test('app shell exposes accessible assumptions, live status and corrected display limits',()=>{
  const app=readFileSync(new URL('../app.html',import.meta.url),'utf8');
  assert.match(app,/<fieldset class="transfer-assumptions"/);
  assert.match(app,/id="trFtCount"/);
  assert.match(app,/id="trBankIn"/);
  assert.match(app,/id="transferStatus"[^>]*aria-live="polite"/);
  assert.match(app,/<option value="20">Top 20<\/option>/);
  assert.doesNotMatch(app,/Top 25/);
  assert.doesNotMatch(app,/Only green numbers/);
});

test('production bundle contains decision cards, honest comparison language and central Team preview routing',()=>{
  const bundle=readFileSync(new URL('../dist/app.bundle.js',import.meta.url),'utf8');
  assert.match(bundle,/Highest-ranked decision/);
  assert.match(bundle,/No comparable legal transfer plan was returned/);
  assert.match(bundle,/Net model comparison/);
  assert.match(bundle,/Preview on Team/);
  assert.match(bundle,/__teamsheetNavigate/);
});

test('transfer renderer is bundled before the views startup boundary',()=>{
  const build=readFileSync(new URL('../build.mjs',import.meta.url),'utf8');
  const transferIndex=build.indexOf("'src/ui/transfer-optimiser-view.mjs'");
  const viewsIndex=build.indexOf("'src/ui/views.mjs'");
  assert.ok(transferIndex>=0);
  assert.ok(viewsIndex>=0);
  assert.ok(transferIndex<viewsIndex);
});
