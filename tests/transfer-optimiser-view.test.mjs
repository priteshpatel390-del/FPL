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


test('transfer renderer is bundled before the views startup boundary',()=>{
  const build=readFileSync(new URL('../build.mjs',import.meta.url),'utf8');
  const transferIndex=build.indexOf("'src/ui/transfer-optimiser-view.mjs'");
  const viewsIndex=build.indexOf("'src/ui/views.mjs'");
  assert.ok(transferIndex>=0);
  assert.ok(viewsIndex>=0);
  assert.ok(transferIndex<viewsIndex);
});
