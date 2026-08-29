import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stableStringify} from '../src/decision-intelligence/canonical.mjs';
import {adaptTeamRecommendation,adaptTransferRecommendation,createParityRuntime,DI3_PARITY_POLICY} from '../src/decision-intelligence/parity-integration.mjs';

const basis={season:'2026-27',gameweek:2,eventId:2,deadline:'2026-08-28T17:30:00Z',evaluationCutoff:'2026-08-28T17:30:00Z',sourceCommit:'source-commit',modelVersion:'2.4.0',rulesVersion:'2026-27.3',squadHash:'squad:1-15',bank:10,freeTransfers:1,priceBasis:'exact'};
const team={basis,formation:'4-4-2',xiPlayerIds:[1,2,3,4,5,6,7,8,9,10,11],benchPlayerIds:[12,13,14,15],xiExpectedPoints:55.5,benchExpectedPoints:13.5,captainId:10,captainExpectedPoints:8.2,viceId:11,viceExpectedPoints:7.9};
const baseline={transferCount:0,transfers:[],finalSquadIds:Array.from({length:15},(_,i)=>i+1),bankBefore:10,bankAfter:10,freeTransfersBefore:1,paidTransfers:0,hitCost:0,freeTransfersNextGW:2,grossBestXIPoints:300,grossGain:0,rollDifference:0,netGain:0,perGameweekBestXI:[],doubtfulIncoming:0,signature:'',warnings:[],pricingMode:'exact'};
const plan={...baseline,transferCount:1,transfers:[{outPlayerId:2,inPlayerId:22,position:2,sellPrice:45,buyPrice:44}],bankAfter:11,freeTransfersNextGW:1,grossBestXIPoints:306,grossGain:6,netGain:5.5,signature:'2>22',finalSquadIds:[1,3,4,5,6,7,8,9,10,11,12,13,14,15,22]};
const transfer={basis,result:{status:'ok',issues:[],plans:[plan,baseline],baseline,pricingMode:'exact'},horizon:6,startGameweek:2};

test('DI-3 Stage B team adapter exactly represents emitted XI, bench, captain and vice without mutation',async()=>{
  const before=stableStringify(team),rows=await adaptTeamRecommendation(team),byDomain=Object.fromEntries(rows.map(row=>[row.action.domain,row]));
  assert.deepEqual(byDomain.xi.action.playerIds,team.xiPlayerIds);assert.equal(byDomain.xi.action.formation,team.formation);
  assert.deepEqual(byDomain.bench.action.playerIds,team.benchPlayerIds);assert.equal(byDomain.captain.action.playerId,team.captainId);assert.equal(byDomain.vice.action.playerId,team.viceId);
  assert.equal(byDomain.xi.consequence.expectedFootballPoints,team.xiExpectedPoints);assert.equal(stableStringify(team),before);
});

test('DI-3 Stage B transfer adapter preserves selected plan, production order, roll, hits, bank and free transfers',async()=>{
  const before=stableStringify(transfer),adapted=await adaptTransferRecommendation(transfer);
  assert.equal(adapted.recommendation.action.actionId,adapted.allRows.find(row=>row.action.type==='transfer').action.actionId);
  assert.deepEqual(adapted.productionActionOrder,['2>22','']);assert.equal(adapted.alternatives.some(row=>row.action.type==='roll'),true);
  assert.equal(adapted.recommendation.consequence.transferHit,plan.hitCost);assert.equal(adapted.recommendation.consequence.bankAfter,plan.bankAfter);assert.equal(adapted.recommendation.consequence.freeTransfersAfter,plan.freeTransfersNextGW);
  assert.equal(stableStringify(transfer),before);
});

test('DI-3 Stage B runtime generates deterministic partial then complete parity artifacts without feedback',async()=>{
  const runtime=createParityRuntime(),production={team,transfer},before=stableStringify(production);
  const partial=await runtime.recordTeam(team);assert.equal(partial.ok,true);assert.equal(partial.artifact.completeness.state,'partial');assert.deepEqual(partial.artifact.completeness.missingDomains,['transfers']);
  const complete=await runtime.recordTransfer(transfer);assert.equal(complete.ok,true);assert.equal(complete.artifact.completeness.state,'complete');
  const second=createParityRuntime();await second.recordTeam(team);const repeated=await second.recordTransfer(transfer);assert.equal(stableStringify(complete.artifact),stableStringify(repeated.artifact));assert.equal(stableStringify(production),before);
});

test('DI-3 Stage B complete artifacts require a coherent Team and Transfers basis',async()=>{
  for(const [field,value] of Object.entries({gameweek:3,eventId:3,squadHash:'stale-squad',bank:11,freeTransfers:2,sourceCommit:'other-source',modelVersion:'other-model',rulesVersion:'other-rules',deadline:'2026-09-01T17:30:00Z',evaluationCutoff:'2026-09-01T17:00:00Z',season:'2027-28',priceBasis:'estimated'})){
    const runtime=createParityRuntime();await runtime.recordTeam(team);const result=await runtime.recordTransfer({...transfer,basis:{...basis,[field]:value}});assert.equal(result.ok,false,field);assert.equal(result.artifact,null,field);assert.match(result.error,new RegExp(`parity_basis_mismatch:${field}`),field);
  }
});

test('DI-3 Stage B stale snapshots cannot combine in either update direction',async()=>{
  const production={team,transfer},before=stableStringify(production),newBasis={...basis,gameweek:3,eventId:3,deadline:'2026-09-04T17:30:00Z',evaluationCutoff:'2026-09-04T17:30:00Z'};
  const oldTransfer=createParityRuntime();await oldTransfer.recordTransfer(transfer);const teamResult=await oldTransfer.recordTeam({...team,basis:newBasis});assert.equal(teamResult.ok,false);assert.equal(teamResult.artifact,null);
  const oldTeam=createParityRuntime();await oldTeam.recordTeam(team);const transferResult=await oldTeam.recordTransfer({...transfer,basis:newBasis,startGameweek:3});assert.equal(transferResult.ok,false);assert.equal(transferResult.artifact,null);assert.equal(stableStringify(production),before);
});

test('DI-3 Stage B failures, partial and no artifact states cannot mutate or suppress production output',async()=>{
  const runtime=createParityRuntime(),production={recommendation:'existing',team},before=stableStringify(production);
  const failed=await runtime.recordTeam({...team,captainId:0});assert.equal(failed.ok,false);assert.equal(failed.artifact,null);assert.equal(stableStringify(production),before);
  runtime.reset();assert.equal(runtime.latest(),null);const partial=await runtime.recordTransfer(transfer);assert.equal(partial.artifact.completeness.state,'partial');assert.equal(stableStringify(production),before);
});

test('DI-3 Stage B artifact actions and consequences exactly match existing production fixture output',async()=>{
  const runtime=createParityRuntime();await runtime.recordTeam(team);const {artifact}=await runtime.recordTransfer(transfer);
  const represented=Object.fromEntries(artifact.recommendations.map(row=>[row.action.domain,row]));
  assert.deepEqual(represented.xi.action.playerIds,team.xiPlayerIds);assert.equal(represented.xi.action.formation,team.formation);
  assert.deepEqual(represented.bench.action.playerIds,team.benchPlayerIds);assert.equal(represented.captain.action.playerId,team.captainId);assert.equal(represented.vice.action.playerId,team.viceId);
  assert.deepEqual(represented.transfers.action.transfers,plan.transfers);assert.equal(represented.transfers.consequence.transferHit,plan.hitCost);assert.equal(represented.transfers.consequence.bankAfter,plan.bankAfter);assert.equal(represented.transfers.consequence.freeTransfersAfter,plan.freeTransfersNextGW);
  assert.equal(artifact.alternatives.some(row=>row.action.type==='roll'),true);assert.equal(DI3_PARITY_POLICY.allowedProductionSignals.length,0);
});

test('DI-3 Stage B production graph is one-way and adds no UI, provider, DI-2 or DATA-S2B consumer',()=>{
  const productionRoots=['src/main.mjs','src/squad.mjs',...fs.readdirSync('src/model').map(name=>`src/model/${name}`),...fs.readdirSync('src/providers').map(name=>`src/providers/${name}`)];
  for(const file of productionRoots)assert.doesNotMatch(fs.readFileSync(file,'utf8'),/DI3_PARITY_RUNTIME|parity-integration|decision-artifact/,file);
  const ui=fs.readFileSync('src/ui/team-decision-home.mjs','utf8')+fs.readFileSync('src/ui/transfer-performance.mjs','utf8');assert.match(ui,/DI3_PARITY_RUNTIME\.recordTeam/);assert.match(ui,/DI3_PARITY_RUNTIME\.recordTransfer/);assert.match(ui,/renderWeeklyDecision\(globalThis\.DI3_PARITY_RUNTIME\.latest\(\)\)/);assert.doesNotMatch(ui,/artifact\.recommendations|createDecisionArtifact/);
  const integration=fs.readFileSync('src/decision-intelligence/parity-integration.mjs','utf8');assert.doesNotMatch(integration,/evaluation-runner|workers\/data-platform|observation_heads|cloudflare|understat|odds|fetch\s*\(/i);
});
