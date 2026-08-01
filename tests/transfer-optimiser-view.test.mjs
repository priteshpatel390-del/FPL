import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TRANSFER_PLANNER_COMMITTED_CONTROL_IDS,
  transferPlannerControlSignature,
  transferPlannerRefreshRequired,
  transferPlannerHasActivePreview
} from '../src/ui/transfer-optimiser-view.mjs';

test('committed transfer controls cover both planner dropdowns',()=>{
  assert.deepEqual(TRANSFER_PLANNER_COMMITTED_CONTROL_IDS,['trHorizon','trTop']);
});

test('transfer planner refreshes only when the committed selection differs from the last render',()=>{
  const previous=transferPlannerControlSignature('6','8');
  assert.equal(transferPlannerRefreshRequired(previous,transferPlannerControlSignature('6','8')),false);
  assert.equal(transferPlannerRefreshRequired(previous,transferPlannerControlSignature('3','8')),true);
  assert.equal(transferPlannerRefreshRequired(previous,transferPlannerControlSignature('6','15')),true);
});

test('any active transfer or captaincy comparison is recognised before a committed refresh',()=>{
  assert.equal(transferPlannerHasActivePreview({}),false);
  assert.equal(transferPlannerHasActivePreview({transfer:{transferCount:1}}),true);
  assert.equal(transferPlannerHasActivePreview({captainId:9}),true);
  assert.equal(transferPlannerHasActivePreview({selectionMode:'vice'}),true);
});

test('production wiring listens for committed select changes, clears preview state and redraws',()=>{
  const source=readFileSync(new URL('../src/ui/transfer-optimiser-view.mjs',import.meta.url),'utf8');
  const bundle=readFileSync(new URL('../dist/app.bundle.js',import.meta.url),'utf8');
  assert.match(source,/control\.addEventListener\('change',transferPlannerRefreshCommittedSelection\)/);
  assert.match(source,/decisionPreviewClearTransfer\(\);[\s\S]*renderTransfers\(\);/);
  assert.match(source,/transferPlannerRenderedControlSignature=transferPlannerCurrentControlSignature\(\)/);
  assert.match(bundle,/committedRefreshInstalled/);
});
