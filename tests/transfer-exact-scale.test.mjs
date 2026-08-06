import test from 'node:test';
import assert from 'node:assert/strict';
import { optimiseTransfers, exhaustiveTransferSearch } from '../src/model/transfers.mjs';
import { buildTransferScaleCase, transferResultSummary } from './fixtures/transfer-scale-fixture.mjs';

test('official-scale shaped exact search completes below the unchanged safety ceiling',()=>{
  const result=optimiseTransfers(buildTransferScaleCase());
  assert.equal(result.status,'ok');
  assert.ok(result.evaluations<2000000);
  assert.ok(result.profile.identityBoundPruned>0);
  assert.equal(result.plans.length,8);
});

test('tie-heavy branch ordering and optimistic tie bounds preserve exhaustive top-K identity',()=>{
  const args=buildTransferScaleCase({counts:{1:5,2:8,3:8,4:5},tieHeavy:true,maxEvaluations:500000});
  const prepared=optimiseTransfers(args),oracle=exhaustiveTransferSearch(args);
  assert.deepEqual(transferResultSummary(prepared),transferResultSummary(oracle));
  assert.ok(prepared.profile.identityBoundPruned>0);
});

test('identity-preserving bounds remain exact when projections include negative and tied values',()=>{
  const args=buildTransferScaleCase({counts:{1:4,2:6,3:6,4:4},tieHeavy:true,maxEvaluations:500000});
  for(const p of args.players) p.scores=p.scores.map((value,index)=>index%3===0?value-6:index%3===1?1.25:value);
  assert.deepEqual(transferResultSummary(optimiseTransfers(args)),transferResultSummary(exhaustiveTransferSearch(args)));
});
