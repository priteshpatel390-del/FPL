import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stableStringify} from '../src/decision-intelligence/canonical.mjs';
import {createApprovalLedger} from '../src/decision-intelligence/capabilities.mjs';
import {adaptTransferOptimiser,createAction,createConsequence,createDecisionArtifact,createLegality,createPolicy,createUncertainty,diffDecisionArtifacts,requirePolicyApprovals} from '../src/decision-intelligence/decision-layer.mjs';
import {DI3_REFERENCE_SCENARIOS} from '../src/decision-intelligence/reference-scenarios.mjs';

const policyRaw={schemaVersion:'di3-policy-v1',policyId:'current-parity',version:'1.0.0',objective:'represent_current_output',comparisonBasis:'current_production_order',materialityThreshold:null,uncertaintyHandling:'disclose_only',tieBreaks:['existing_production_order'],fallback:'partial_or_no_decision',alternativeSelection:'all_adapter_outputs',requiredDomains:['xi','bench','captain','vice','transfers'],allowedProductionSignals:[]};
const uncertainty=()=>createUncertainty({modelDispersion:null,availability:{state:'missing'},sourceQuality:{state:'missing'},sourceDisagreement:{state:'missing'},decisionMargin:null,sensitivity:[],schedule:{state:'known'}});
const baseArtifact=async(recommendations,alternatives=[],completeness={state:'complete',missingDomains:[],staleDomains:[],conflicts:[]})=>createDecisionArtifact({schemaVersion:'di3-decision-artifact-v1',deadline:{season:'2026-27',gameweek:1,eventId:1,deadline:'2026-08-21T17:30:00Z',evaluationCutoff:'2026-08-21T17:00:00Z',eligibilityPolicy:'deadline_as_of'},build:{sourceCommit:'75b7be599b1f70af82c954081bc982fbe0a67c86',modelVersion:'current',rulesVersion:'current',policyVersion:'1.0.0'},squadBasis:{squadHash:'sha256:test',bank:10,freeTransfers:1,priceBasis:'current'},policy:policyRaw,recommendations,alternatives,uncertainty:uncertainty(),risks:[],reconsiderationConditions:[],completeness,evidenceReferences:['synthetic:test'],assumptionReferences:['synthetic-only'],rationaleCodes:['current-output-parity'],explanationGraphReferences:[],hashes:{featureInputViewHash:'sha256:input'}},{ledger:createApprovalLedger()});

test('DI-3 actions have canonical immutable identities and deterministic order independent of display text',async()=>{
  const raw={type:'transfer',transfers:[{outPlayerId:8,inPlayerId:18,position:3,sellPrice:70,buyPrice:72},{outPlayerId:2,inPlayerId:12,position:2,sellPrice:45,buyPrice:44}]};
  const one=await createAction(raw),two=await createAction({displayText:undefined,...raw,transfers:raw.transfers.slice().reverse()});
  assert.equal(one.actionId,two.actionId);assert.deepEqual(one.transfers.map(x=>x.outPlayerId),[2,8]);assert.throws(()=>{one.transfers[0].buyPrice=1;},TypeError);
  await assert.rejects(createAction({type:'starting_xi',formation:'4-4-2',playerIds:[1,2]}),/xi_invalid/);
  await assert.rejects(createAction({type:'captain',playerId:0}),/captain_invalid/);
  await assert.rejects(createAction({type:'roll',transfers:[{outPlayerId:1}]}),/roll_transfer/);
});

test('DI-3 legality separates legal state and proof from preference',()=>{
  assert.equal(createLegality({legal:true,proofVersion:'existing-v1',constraints:[{code:'formation',satisfied:true}]}).legal,true);
  assert.throws(()=>createLegality({legal:true,proofVersion:'v1',constraints:[{code:'bank',satisfied:false}]}),/legal_proof/);
});

test('DI-3 consequences conserve hits, bank, free transfers and exclude unexplained utility',()=>{
  const c=createConsequence({expectedFootballPoints:42.5,transferHit:4,bankBefore:10,bankAfter:8,freeTransfersBefore:1,freeTransfersAfter:1,transferCount:2,squadChanges:[{outPlayerId:1,inPlayerId:2},{outPlayerId:3,inPlayerId:4}],horizon:{startGameweek:2,gameweeks:6},opportunityCost:{grossGain:5},flexibility:{descriptor:'free_transfer_roll_only',freeTransferDelta:-1}});
  assert.equal(c.transferHit,4);assert.equal(c.bankAfter,8);assert.throws(()=>createConsequence({...c,transferHit:3}),/hit_conservation/);assert.throws(()=>createConsequence({...c,bonus:1}),/unexplained_score/);assert.throws(()=>createConsequence({...c,flexibility:{points:1}}),/flexibility_points/);
});

test('DI-3 uncertainty preserves dimensions and forbids universal confidence',()=>{
  const u=uncertainty();assert.equal(u.availability.state,'missing');assert.equal(u.sourceDisagreement.state,'missing');
  assert.throws(()=>createUncertainty({...u,confidencePercent:80}),/uncertainty/);
});

test('DI-3 policy is explicit and production signals fail closed by exact signal/version/scope',()=>{
  const policy=createPolicy({...policyRaw,allowedProductionSignals:[{signalId:'availability.fact',version:'1.0.0',scope:'minutes'}]});
  assert.throws(()=>requirePolicyApprovals(policy,createApprovalLedger()),/production_read_unapproved/);
  const ledger=createApprovalLedger([{approvalId:'owner-1',signalId:'availability.fact',version:'1.0.0',scope:'minutes',capability:'production_read',status:'approved',approvedAt:'2026-08-29T00:00:00Z',approvedBy:'owner'}]);
  assert.equal(requirePolicyApprovals(policy,ledger)[0].approvalId,'owner-1');assert.throws(()=>requirePolicyApprovals({...policy,allowedProductionSignals:[{signalId:'availability.fact',version:'1.0.1',scope:'minutes'}]},ledger),/unapproved/);
});

test('DI-3 transfer adapter preserves mandatory roll, current order, separate consequences and input bytes',async()=>{
  const baseline={transferCount:0,transfers:[],bankBefore:10,bankAfter:10,freeTransfersBefore:1,freeTransfersNextGW:2,hitCost:0,grossBestXIPoints:100,grossGain:0,rollDifference:0};
  const plan={transferCount:2,transfers:[{outPlayerId:2,inPlayerId:12,position:2,sellPrice:45,buyPrice:44},{outPlayerId:8,inPlayerId:18,position:3,sellPrice:70,buyPrice:72}],bankBefore:10,bankAfter:9,freeTransfersBefore:1,freeTransfersNextGW:1,hitCost:4,grossBestXIPoints:106,grossGain:6,rollDifference:-1};
  const result={status:'ok',baseline,plans:[plan]},before=stableStringify(result),rows=await adaptTransferOptimiser(result,{horizon:6,startGameweek:2});
  assert.equal(rows[0].action.type,'roll');assert.equal(rows[1].action.type,'transfer');assert.equal(rows[1].consequence.transferHit,4);assert.equal(stableStringify(result),before);assert.throws(()=>{rows[0].action.type='transfer';},TypeError);
});

test('DI-3 artifacts are deterministic, deeply immutable and preserve lineage, alternatives and gaps',async()=>{
  const roll=await createAction({type:'roll',transfers:[]}),rec={action:roll,consequence:createConsequence({expectedFootballPoints:40,transferHit:0,bankBefore:10,bankAfter:10,freeTransfersBefore:1,freeTransfersAfter:2,transferCount:0,squadChanges:[],horizon:{startGameweek:1,gameweeks:6}}),legality:createLegality({legal:true,proofVersion:'existing-v1',constraints:[{code:'baseline',satisfied:true}]})};
  const one=await baseArtifact([rec]),two=await baseArtifact([rec]);assert.equal(stableStringify(one),stableStringify(two));assert.equal(one.identity.contentHash,two.identity.contentHash);assert.equal(one.build.policyVersion,'1.0.0');assert.throws(()=>{one.completeness.state='partial';},TypeError);
  const partial=await baseArtifact([rec],[],{state:'partial',missingDomains:['captain'],staleDomains:[],conflicts:[]});assert.equal(partial.completeness.state,'partial');
  const none=await baseArtifact([],[],{state:'no_decision',missingDomains:['xi'],staleDomains:[],conflicts:[]});assert.equal(none.recommendations.length,0);
});

test('DI-3 reconsideration and exact behaviour diff identify domain, points, hit, bank and causes',async()=>{
  const roll=await createAction({type:'roll',transfers:[]}),transfer=await createAction({type:'transfer',transfers:[{outPlayerId:1,inPlayerId:16,position:4,sellPrice:60,buyPrice:60}]});
  const consequence=(points,hit,bank,count)=>createConsequence({expectedFootballPoints:points,transferHit:hit,bankBefore:10,bankAfter:bank,freeTransfersBefore:1,freeTransfersAfter:1,transferCount:count,squadChanges:count?[{outPlayerId:1,inPlayerId:16}]:[],horizon:{startGameweek:1,gameweeks:6}});
  const legality=createLegality({legal:true,proofVersion:'existing-v1',constraints:[{code:'emitted',satisfied:true}]});
  const current=await baseArtifact([{action:roll,consequence:consequence(40,0,10,0),legality}]);
  const proposed=await baseArtifact([{action:transfer,consequence:consequence(45,0,10,1),legality,rationaleCodes:['policy-threshold'],causes:['policy@2.0.0']}]);
  assert.deepEqual(diffDecisionArtifacts(current,current),{changed:false,changes:[]});const diff=diffDecisionArtifacts(current,proposed);assert.equal(diff.changes[0].domain,'transfers');assert.equal(diff.changes[0].expectedFootballPointsDelta,5);assert.deepEqual(diff.changes[0].causes,['policy@2.0.0']);
});

test('DI-3 Stage A remains offline: no production/UI/build/DATA-S2B/provider import or candidate graduation',()=>{
  for(const file of ['src/main.mjs','src/state.mjs','build.mjs',...fs.readdirSync('src/model').map(name=>`src/model/${name}`),...fs.readdirSync('src/ui').map(name=>`src/ui/${name}`),...fs.readdirSync('src/providers').map(name=>`src/providers/${name}`)])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/decision-intelligence\/decision-layer/,file);
  const source=fs.readFileSync('src/decision-intelligence/decision-layer.mjs','utf8');assert.doesNotMatch(source,/workers\/data-platform|observation_heads|cloudflare|understat|odds/i);
});

test('DI-3 permanent synthetic matrix covers every required Stage-A scenario deterministically',()=>{
  assert.equal(DI3_REFERENCE_SCENARIOS.length,14);assert.equal(new Set(DI3_REFERENCE_SCENARIOS.map(row=>row.id)).size,14);
  assert.deepEqual(DI3_REFERENCE_SCENARIOS.map(row=>row.id),['clear-xi','near-tied-xi','clear-captain','near-tied-captain','roll-v-marginal-transfer','beneficial-transfer','transfer-hit','missing-evidence','stale-conflicting-future-signal','unapproved-signal','partial-decision','no-decision','reconsideration-trigger','deterministic-tie']);
  assert.throws(()=>DI3_REFERENCE_SCENARIOS.push({id:'football-claim'}),TypeError);
});
