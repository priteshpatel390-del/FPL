import {canonicalise,deepFreeze,sha256Hex,stableStringify,secretFinding} from '../../src/decision-intelligence/canonical.mjs';
import {POLICY_VERSION} from './action-registry.mjs';

export const OPERATIONAL_STATE=deepFreeze({GREEN:'GREEN',AMBER:'AMBER',RED:'RED'});
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&stableStringify(Object.keys(value).sort())===stableStringify(keys.slice().sort());
const text=(value,pattern)=>typeof value==='string'&&pattern.test(value);
const equals=(value,expected)=>stableStringify(value)===stableStringify(expected);
const RULES=deepFreeze({
  healthy:{classification:'GREEN',reasonCode:'HEALTHY_EXPECTED_STATE',domains:['github','cloudflare','d1','provider','observation'],prove:({expectedState,observedState})=>equals(expectedState,{status:'healthy'})&&equals(observedState,{status:'healthy'})},
  opportunity_consumed:{classification:'GREEN',reasonCode:'ROUTINE_OPPORTUNITY_ALREADY_CONSUMED',domains:['github'],prove:({expectedState,observedState})=>equals(expectedState,{collectionPolicy:'one_routine_per_utc_day'})&&equals(observedState,{reasonCode:'automatic_collection_consumed',status:'consumed'})}
});

export function classifyOperationalState(observation){
  if(!exact(observation,['conditionId','domain','expectedState','observedState','evidence']))return deepFreeze({classification:'RED',reasonCode:'MALFORMED_OR_UNKNOWN_CONDITION'});
  const rule=RULES[observation.conditionId];
  if(!rule||!rule.domains.includes(observation.domain)||secretFinding(observation)!==null)
    return deepFreeze({classification:'RED',reasonCode:'MALFORMED_OR_UNKNOWN_CONDITION'});
  if(!Array.isArray(observation.evidence)||observation.evidence.length===0)
    return deepFreeze({classification:'RED',reasonCode:'MISSING_CLASSIFICATION_EVIDENCE'});
  let proven=false;
  try{proven=rule.prove(observation)===true;}catch{proven=false;}
  if(!proven)return deepFreeze({classification:'RED',reasonCode:'CONDITION_STATE_UNPROVEN'});
  return deepFreeze({classification:rule.classification,reasonCode:rule.reasonCode});
}

export async function createIncident(input,{cryptoImpl=globalThis.crypto}={}){
  const keys=['detectorId','detectorVersion','detectedAt','domain','expectedState','observedState','evidence','conditionId','mainSha','actionHistory','finalDisposition'];
  if(!exact(input,keys))throw new Error('incident_schema_invalid');
  if(!text(input.detectorId,/^[a-z][a-z0-9_.-]{2,63}$/)||!text(input.detectorVersion,/^[a-z0-9][a-z0-9_.-]{0,31}$/)||!text(input.domain,/^[a-z][a-z0-9_]{1,31}$/))throw new Error('incident_identity_invalid');
  if(!text(input.detectedAt,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)||!Number.isFinite(Date.parse(input.detectedAt)))throw new Error('incident_timestamp_invalid');
  if(input.mainSha!==null&&!text(input.mainSha,/^[0-9a-f]{40}$/))throw new Error('incident_main_sha_invalid');
  if(!Array.isArray(input.evidence)||input.evidence.length===0||!input.evidence.every(row=>exact(row,['reference','hash'])&&text(row.reference,/^[a-z][a-z0-9:/.@_-]{1,127}$/)&&text(row.hash,/^[0-9a-f]{64}$/)))throw new Error('incident_evidence_invalid');
  if(!Array.isArray(input.actionHistory)||!input.actionHistory.every(value=>text(value,/^[a-z][a-z0-9_.:-]{1,127}$/)))throw new Error('incident_history_invalid');
  if(input.finalDisposition!==null&&!text(input.finalDisposition,/^[A-Z][A-Z0-9_]{1,63}$/))throw new Error('incident_disposition_invalid');
  if(secretFinding(input)!==null)throw new Error('incident_secret_forbidden');
  const classification=classifyOperationalState({conditionId:input.conditionId,domain:input.domain,expectedState:input.expectedState,observedState:input.observedState,evidence:input.evidence});
  const expectedStateFingerprint=await sha256Hex(stableStringify(input.expectedState),cryptoImpl);
  const observedStateFingerprint=await sha256Hex(stableStringify(input.observedState),cryptoImpl);
  const deduplicationIdentity=await sha256Hex(stableStringify({detectorId:input.detectorId,detectorVersion:input.detectorVersion,domain:input.domain,conditionId:input.conditionId,expectedStateFingerprint,observedStateFingerprint,mainSha:input.mainSha}),cryptoImpl);
  const incidentId=`incident-${deduplicationIdentity.slice(0,24)}`;
  return deepFreeze(canonicalise({...input,incidentId,policyVersion:POLICY_VERSION,expectedStateFingerprint,observedStateFingerprint,deduplicationIdentity,...classification}));
}
