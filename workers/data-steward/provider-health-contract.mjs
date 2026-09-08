import {APPROVED_PROVIDER_NAMES} from '../../src/providers/registry.mjs';
import {canonicalise,deepFreeze,stableStringify,secretFinding} from '../../src/decision-intelligence/canonical.mjs';

const KEYS=['providerId','approvedPurpose','approvedFields','freshnessRequirementMs','schemaVersion','parserVersion','requiredFields','quotaStatus','authStatus','qualityStatus','approvedFallbackState','costBoundary','prohibitedInfluence'];
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&stableStringify(Object.keys(value).sort())===stableStringify(keys.slice().sort());
const strings=value=>Array.isArray(value)&&value.every(item=>typeof item==='string'&&/^[a-z][a-z0-9_.-]{0,63}$/.test(item));

export function validateProviderHealthContract(input){
  if(!exact(input,KEYS))return deepFreeze({ok:false,reasonCode:'PROVIDER_CONTRACT_MALFORMED'});
  if(secretFinding(input)!==null)return deepFreeze({ok:false,reasonCode:'PROVIDER_CONTRACT_SECRET_FORBIDDEN'});
  if(!APPROVED_PROVIDER_NAMES.includes(input.providerId))return deepFreeze({ok:false,reasonCode:'PROVIDER_NOT_APPROVED'});
  if(typeof input.approvedPurpose!=='string'||input.approvedPurpose.length<1||input.approvedPurpose.length>160||!strings(input.approvedFields)||!strings(input.requiredFields)||!Number.isSafeInteger(input.freshnessRequirementMs)||input.freshnessRequirementMs<0||typeof input.schemaVersion!=='string'||typeof input.parserVersion!=='string'||!['AVAILABLE','LIMITED','EXHAUSTED','UNKNOWN'].includes(input.quotaStatus)||!['VALID','MISSING','EXPIRED','UNKNOWN'].includes(input.authStatus)||!['HEALTHY','DEGRADED','UNAVAILABLE','UNKNOWN'].includes(input.qualityStatus)||!['NONE','APPROVED','DISABLED'].includes(input.approvedFallbackState)||!exact(input.costBoundary,['currency','maximumMinorUnits','period'])||typeof input.costBoundary.currency!=='string'||!Number.isSafeInteger(input.costBoundary.maximumMinorUnits)||input.costBoundary.maximumMinorUnits<0||typeof input.costBoundary.period!=='string'||!strings(input.prohibitedInfluence))return deepFreeze({ok:false,reasonCode:'PROVIDER_CONTRACT_MALFORMED'});
  return deepFreeze({ok:true,reasonCode:'APPROVED_PROVIDER_HEALTH_ONLY',contract:deepFreeze(canonicalise(input)),mayInfluenceProduction:false});
}
