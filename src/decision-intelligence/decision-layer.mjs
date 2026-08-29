import {canonicalise,deepFreeze,sha256Hex,stableStringify} from './canonical.mjs';

const ACTION_TYPES=new Set(['starting_xi','bench_order','captain','vice_captain','roll','transfer']);
const COMPLETENESS=new Set(['complete','partial','no_decision']);
const DOMAINS=new Set(['xi','bench','captain','vice','transfers']);
const ID=/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const VERSION=/^[1-9]\d*\.\d+\.\d+$/;
const integer=(value,min=0)=>Number.isInteger(value)&&value>=min;
const finite=value=>typeof value==='number'&&Number.isFinite(value);
function fail(condition,code){if(condition)throw new Error(`di3_${code}`);}
function ids(values,name,{length}={}){
  fail(!Array.isArray(values)||(length!==undefined&&values.length!==length)||values.some(value=>!integer(value,1))||new Set(values).size!==values.length,`${name}_invalid`);
  return values.slice().sort((a,b)=>a-b);
}

export async function createAction(raw,{cryptoImpl=globalThis.crypto}={}){
  const action=canonicalise(raw); fail(!ACTION_TYPES.has(action.type),'action_type');
  const domain=action.type==='starting_xi'?'xi':action.type==='bench_order'?'bench':action.type==='vice_captain'?'vice':['roll','transfer'].includes(action.type)?'transfers':'captain';
  fail(action.domain!==undefined&&action.domain!==domain,'action_domain'); action.domain=domain;
  if(action.type==='starting_xi'){action.playerIds=ids(action.playerIds,'xi',{length:11});fail(!/^(3|4|5)-(2|3|4|5)-(1|2|3)$/.test(action.formation||''),'formation');}
  if(action.type==='bench_order'){fail(!Array.isArray(action.playerIds)||action.playerIds.length!==4||action.playerIds.some(id=>!integer(id,1))||new Set(action.playerIds).size!==4,'bench_invalid');}
  if(['captain','vice_captain'].includes(action.type))fail(!integer(action.playerId,1),'captain_invalid');
  if(action.type==='roll')fail(action.transfers!==undefined&&action.transfers.length!==0,'roll_transfer');
  if(action.type==='transfer'){
    fail(!Array.isArray(action.transfers)||action.transfers.length<1,'transfers_invalid');
    action.transfers=action.transfers.map(row=>canonicalise(row)).sort((a,b)=>a.outPlayerId-b.outPlayerId||a.inPlayerId-b.inPlayerId);
    fail(action.transfers.some(row=>!integer(row.outPlayerId,1)||!integer(row.inPlayerId,1)||row.outPlayerId===row.inPlayerId||!integer(row.position,1)||!integer(row.sellPrice)||!integer(row.buyPrice)),'transfer_pair');
    fail(new Set(action.transfers.map(row=>row.outPlayerId)).size!==action.transfers.length||new Set(action.transfers.map(row=>row.inPlayerId)).size!==action.transfers.length,'transfer_duplicate');
  }
  const identityBasis=canonicalise(action),hash=await sha256Hex(stableStringify(identityBasis),cryptoImpl);
  return deepFreeze({...identityBasis,actionId:`act-${hash}`});
}

export function createLegality(raw){
  const value=canonicalise(raw); fail(typeof value.legal!=='boolean'||!Array.isArray(value.constraints)||!value.proofVersion,'legality');
  fail(value.legal&&value.constraints.some(row=>row.satisfied!==true),'legal_proof');
  return deepFreeze(value);
}

export function createConsequence(raw){
  const value=canonicalise(raw);
  fail(!finite(value.expectedFootballPoints)||!integer(value.transferHit)||!integer(value.bankBefore)||!integer(value.bankAfter)||!integer(value.freeTransfersBefore)||!integer(value.freeTransfersAfter),'consequence_numeric');
  fail(value.transferHit%4!==0,'hit_conservation');
  fail(!integer(value.transferCount)||!Array.isArray(value.squadChanges)||value.squadChanges.length!==value.transferCount,'transfer_conservation');
  fail(!integer(value.horizon?.startGameweek,1)||!integer(value.horizon?.gameweeks,1),'horizon');
  fail(Object.hasOwn(value,'score')||Object.hasOwn(value,'bonus')||Object.hasOwn(value,'futureValue'),'unexplained_score');
  if(value.flexibility!==undefined)fail(typeof value.flexibility!=='object'||finite(value.flexibility.points),'flexibility_points');
  return deepFreeze(value);
}

export function createUncertainty(raw){
  const value=canonicalise(raw),required=['modelDispersion','availability','sourceQuality','sourceDisagreement','decisionMargin','sensitivity','schedule'];
  fail(required.some(key=>!Object.hasOwn(value,key))||Object.hasOwn(value,'confidence')||Object.hasOwn(value,'confidencePercent'),'uncertainty');
  return deepFreeze(value);
}

export function createPolicy(raw){
  const value=canonicalise(raw);
  fail(value.schemaVersion!=='di3-policy-v1'||!ID.test(value.policyId||'')||!VERSION.test(value.version||'')||!value.objective||!value.comparisonBasis||!Array.isArray(value.tieBreaks)||!value.fallback||!value.alternativeSelection||!Array.isArray(value.requiredDomains)||value.requiredDomains.some(domain=>!DOMAINS.has(domain))||!Array.isArray(value.allowedProductionSignals),'policy');
  fail(value.allowedProductionSignals.some(row=>!row.signalId||!row.version||!row.scope),'policy_signal');
  return deepFreeze(value);
}

export function requirePolicyApprovals(policy,ledger){
  return deepFreeze(policy.allowedProductionSignals.map(row=>ledger.requireProductionRead(row.signalId,row.version,row.scope)));
}

export async function createDecisionArtifact(raw,{ledger,cryptoImpl=globalThis.crypto}={}){
  const value=canonicalise(raw); fail(value.schemaVersion!=='di3-decision-artifact-v1','artifact_schema');
  fail(!value.deadline?.season||!integer(value.deadline?.gameweek,1)||!integer(value.deadline?.eventId,1)||!Number.isFinite(Date.parse(value.deadline?.deadline||''))||!Number.isFinite(Date.parse(value.deadline?.evaluationCutoff||'')),'deadline');
  fail(!value.build?.sourceCommit||!value.build?.modelVersion||!value.build?.rulesVersion||!value.build?.policyVersion,'lineage');
  fail(!value.squadBasis?.squadHash||!integer(value.squadBasis?.bank)||!integer(value.squadBasis?.freeTransfers),'squad_basis');
  fail(!COMPLETENESS.has(value.completeness?.state)||!Array.isArray(value.completeness?.missingDomains)||!Array.isArray(value.completeness?.staleDomains)||!Array.isArray(value.completeness?.conflicts),'completeness');
  fail(!Array.isArray(value.recommendations)||!Array.isArray(value.alternatives)||!Array.isArray(value.reconsiderationConditions)||!Array.isArray(value.evidenceReferences)||!Array.isArray(value.assumptionReferences)||!Array.isArray(value.rationaleCodes),'artifact_collections');
  if(value.policy){const policy=createPolicy(value.policy);if(ledger)requirePolicyApprovals(policy,ledger);}
  if(value.completeness.state==='complete')fail(value.completeness.missingDomains.length||value.completeness.staleDomains.length||value.completeness.conflicts.length,'complete_with_gaps');
  if(value.completeness.state==='no_decision')fail(value.recommendations.length!==0,'no_decision_recommendation');
  for(const condition of value.reconsiderationConditions)fail(!condition.conditionId||!condition.observablePredicate||!Array.isArray(condition.affectedActionIds)||!condition.materiality||!Number.isFinite(Date.parse(condition.expiresAt||''))||!condition.evidenceReference,'reconsideration');
  const actionIds=[...value.recommendations,...value.alternatives].map(row=>row.action?.actionId); fail(actionIds.some(id=>!/^act-[0-9a-f]{64}$/.test(id||'')),'action_identity');
  const candidateActionSetHash=await sha256Hex(stableStringify(actionIds.slice().sort()),cryptoImpl);
  const identityBasis=canonicalise({...value,identity:undefined,hashes:{...value.hashes,candidateActionSetHash}});
  fail(!identityBasis.hashes?.featureInputViewHash,'input_hash');
  const contentHash=await sha256Hex(stableStringify(identityBasis),cryptoImpl);
  const decisionId=`decision-${value.deadline.season}-gw${value.deadline.gameweek}-${contentHash.slice(0,16)}`;
  return deepFreeze({...identityBasis,identity:{decisionId,contentHash},hashes:{...identityBasis.hashes,candidateActionSetHash,contentHash}});
}

export async function adaptTransferOptimiser(result,{horizon,startGameweek,cryptoImpl=globalThis.crypto}={}){
  fail(!result||!result.baseline||!Array.isArray(result.plans),'adapter_input');
  const before=stableStringify(result),rows=[];
  const ordered=[result.baseline,...result.plans.filter(plan=>plan!==result.baseline&&Number(plan.transferCount)>0)];
  for(const plan of ordered){
    const action=plan.transferCount===0?await createAction({type:'roll',transfers:[]},{cryptoImpl}):await createAction({type:'transfer',transfers:plan.transfers},{cryptoImpl});
    const consequence=createConsequence({expectedFootballPoints:Number(plan.grossBestXIPoints),transferHit:Number(plan.hitCost),bankBefore:Number(plan.bankBefore),bankAfter:Number(plan.bankAfter),freeTransfersBefore:Number(plan.freeTransfersBefore),freeTransfersAfter:Number(plan.freeTransfersNextGW),transferCount:Number(plan.transferCount),squadChanges:(plan.transfers||[]).map(row=>({outPlayerId:row.outPlayerId,inPlayerId:row.inPlayerId})),horizon:{startGameweek:Number(startGameweek),gameweeks:Number(horizon)},opportunityCost:{grossGain:Number(plan.grossGain),rollDifference:Number(plan.rollDifference)},flexibility:{descriptor:'free_transfer_roll_only',freeTransferDelta:Number(plan.rollDifference)}});
    rows.push(deepFreeze({action,consequence,legality:createLegality({legal:true,proofVersion:'existing-optimiser-output-v1',constraints:[{code:'emitted_by_current_optimiser',satisfied:true}]})}));
  }
  fail(stableStringify(result)!==before,'adapter_mutation'); return deepFreeze(rows);
}

export function diffDecisionArtifacts(current,proposed){
  const byDomain=artifact=>Object.fromEntries((artifact.recommendations||[]).map(row=>[row.action.domain,row]));
  const a=byDomain(current),b=byDomain(proposed),domains=[...new Set([...Object.keys(a),...Object.keys(b)])].sort();
  const changes=domains.flatMap(domain=>stableStringify(a[domain]?.action)===stableStringify(b[domain]?.action)?[]:[{domain,currentActionId:a[domain]?.action?.actionId||null,proposedActionId:b[domain]?.action?.actionId||null,expectedFootballPointsDelta:(b[domain]?.consequence?.expectedFootballPoints??0)-(a[domain]?.consequence?.expectedFootballPoints??0),hitDelta:(b[domain]?.consequence?.transferHit??0)-(a[domain]?.consequence?.transferHit??0),bankDelta:(b[domain]?.consequence?.bankAfter??0)-(a[domain]?.consequence?.bankAfter??0),reasonCodes:b[domain]?.rationaleCodes||[],causes:b[domain]?.causes||[]}]);
  return deepFreeze({changed:changes.length>0,changes});
}
