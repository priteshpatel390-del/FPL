import {canonicalise,deepFreeze,sha256Hex,stableStringify} from './canonical.mjs';
import {createAction,createConsequence,createDecisionArtifact,createLegality,createUncertainty,adaptTransferOptimiser} from './decision-layer.mjs';

export const DI3_PARITY_POLICY=deepFreeze({schemaVersion:'di3-policy-v1',policyId:'production-parity',version:'1.0.0',objective:'represent_current_output',comparisonBasis:'current_production_order',materialityThreshold:null,uncertaintyHandling:'disclosure_only',tieBreaks:['preserve_current_production_order'],fallback:'partial_or_no_decision',alternativeSelection:'all_adapter_outputs',requiredDomains:['xi','bench','captain','vice','transfers'],allowedProductionSignals:[]});
const proof=()=>createLegality({legal:true,proofVersion:'current-production-output-v1',constraints:[{code:'emitted_by_current_production',satisfied:true}]});
const uncertainty=margin=>createUncertainty({modelDispersion:null,availability:{state:'not_adapted'},sourceQuality:{state:'current_production_output'},sourceDisagreement:{state:'not_adapted'},decisionMargin:margin??null,sensitivity:[],schedule:{state:'current_fixture_output'}});
const consequence=(points,basis)=>createConsequence({expectedFootballPoints:Number(points),transferHit:0,bankBefore:basis.bank,bankAfter:basis.bank,freeTransfersBefore:basis.freeTransfers,freeTransfersAfter:basis.freeTransfers,transferCount:0,squadChanges:[],horizon:{startGameweek:basis.gameweek,gameweeks:1}});

export async function adaptTeamRecommendation(raw,{cryptoImpl=globalThis.crypto}={}){
  const input=canonicalise(raw),before=stableStringify(input),basis=input.basis;
  if(!basis||!Array.isArray(input.xiPlayerIds)||!Array.isArray(input.benchPlayerIds))throw new Error('di3_team_adapter_input');
  const rows=[];
  for(const [actionRaw,points] of [
    [{type:'starting_xi',formation:input.formation,playerIds:input.xiPlayerIds},input.xiExpectedPoints],
    [{type:'bench_order',playerIds:input.benchPlayerIds},input.benchExpectedPoints],
    [{type:'captain',playerId:input.captainId},input.captainExpectedPoints],
    [{type:'vice_captain',playerId:input.viceId},input.viceExpectedPoints]
  ])rows.push(deepFreeze({action:await createAction(actionRaw,{cryptoImpl}),consequence:consequence(points,basis),legality:proof(),rationaleCodes:['current-production-output']}));
  if(stableStringify(input)!==before)throw new Error('di3_team_adapter_mutation');
  return deepFreeze(rows);
}

function transferRowKey(row){return row.action.type==='roll'?'':row.action.transfers.map(move=>`${move.outPlayerId}>${move.inPlayerId}`).join('|');}
export async function adaptTransferRecommendation(raw,{cryptoImpl=globalThis.crypto}={}){
  const input=canonicalise(raw),before=stableStringify(input),rows=await adaptTransferOptimiser(input.result,{horizon:input.horizon,startGameweek:input.startGameweek,cryptoImpl});
  const selectedPlan=input.result.plans?.[0]||input.result.baseline,selectedKey=String(selectedPlan?.signature||''),selected=rows.find(row=>transferRowKey(row)===selectedKey);
  if(!selected)throw new Error('di3_transfer_selected_missing');
  if(stableStringify(input)!==before)throw new Error('di3_transfer_adapter_mutation');
  return deepFreeze({recommendation:selected,alternatives:rows.filter(row=>row!==selected),productionActionOrder:(input.result.plans||[]).map(plan=>String(plan.signature||'')),allRows:rows});
}

async function artifactBasis(team,transfer,cryptoImpl){
  const basis=team?.basis||transfer?.basis;if(!basis)return null;
  const recommendations=[],alternatives=[];
  if(team)recommendations.push(...await adaptTeamRecommendation(team,{cryptoImpl}));
  if(transfer){const adapted=await adaptTransferRecommendation(transfer,{cryptoImpl});recommendations.push(adapted.recommendation);alternatives.push(...adapted.alternatives);}
  const domains=recommendations.map(row=>row.action.domain),missing=DI3_PARITY_POLICY.requiredDomains.filter(domain=>!domains.includes(domain));
  const state=missing.length?'partial':'complete';
  return {schemaVersion:'di3-decision-artifact-v1',deadline:{season:basis.season,gameweek:basis.gameweek,eventId:basis.eventId,deadline:basis.deadline,evaluationCutoff:basis.evaluationCutoff,eligibilityPolicy:'current-production-output'},build:{sourceCommit:basis.sourceCommit,modelVersion:basis.modelVersion,rulesVersion:basis.rulesVersion,policyVersion:DI3_PARITY_POLICY.version},squadBasis:{squadHash:basis.squadHash,bank:basis.bank,freeTransfers:basis.freeTransfers,priceBasis:basis.priceBasis},policy:DI3_PARITY_POLICY,recommendations,alternatives,uncertainty:uncertainty(),risks:[],reconsiderationConditions:[],completeness:{state,missingDomains:missing,staleDomains:[],conflicts:[]},evidenceReferences:['current-production-output'],assumptionReferences:[],rationaleCodes:['current-output-parity'],explanationGraphReferences:[],hashes:{featureInputViewHash:await sha256Hex(stableStringify({team,transfer}),cryptoImpl)}};
}

export function createParityRuntime({cryptoImpl=globalThis.crypto}={}){
  let team=null,transfer=null,latest=null;
  const generate=async()=>{try{const raw=await artifactBasis(team,transfer,cryptoImpl);latest=raw?{ok:true,artifact:await createDecisionArtifact(raw,{cryptoImpl})}:{ok:true,artifact:null};}catch(error){latest={ok:false,artifact:null,error:String(error?.message||error)};}return latest;};
  return Object.freeze({recordTeam(raw){team=deepFreeze(canonicalise(raw));return generate();},recordTransfer(raw){transfer=deepFreeze(canonicalise(raw));return generate();},latest:()=>latest,reset(){team=null;transfer=null;latest=null;}});
}
