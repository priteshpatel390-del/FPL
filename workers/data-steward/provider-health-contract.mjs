import {APPROVED_PROVIDER_NAMES,APPROVED_PROVIDER_SOURCES} from '../../src/providers/registry.mjs';
import {canonicalise,deepFreeze,stableStringify,secretFinding} from '../../src/decision-intelligence/canonical.mjs';

const HEALTH_KEYS=['providerId','observedAt','availability','quotaStatus','authStatus','freshnessAgeMs','observedSchemaVersion','observedParserVersion','qualityStatus','costUsageMinorUnits'];
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&stableStringify(Object.keys(value).sort())===stableStringify(keys.slice().sort());
const iso=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value));
const version=value=>value===null||typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/.test(value);

export const PROVIDER_APPROVAL_POLICY=deepFreeze(Object.fromEntries(APPROVED_PROVIDER_NAMES.map(providerId=>{
  const source=APPROVED_PROVIDER_SOURCES[providerId];
  return [providerId,{providerId,label:source.label,authority:source.authority,approvedPurpose:source.purpose,approvedFallbackPolicy:null,prohibitedInfluence:['data_steward_production_influence']}];
})));

export function validateProviderHealthContract(input){
  if(!exact(input,HEALTH_KEYS))return deepFreeze({ok:false,reasonCode:'PROVIDER_HEALTH_MALFORMED'});
  if(secretFinding(input)!==null)return deepFreeze({ok:false,reasonCode:'PROVIDER_HEALTH_SECRET_FORBIDDEN'});
  const policy=PROVIDER_APPROVAL_POLICY[input.providerId];
  if(!policy)return deepFreeze({ok:false,reasonCode:'PROVIDER_NOT_APPROVED'});
  if(!iso(input.observedAt)||!['AVAILABLE','DEGRADED','UNAVAILABLE','UNKNOWN'].includes(input.availability)||!['AVAILABLE','LIMITED','EXHAUSTED','UNKNOWN'].includes(input.quotaStatus)||!['VALID','MISSING','EXPIRED','NOT_REQUIRED','UNKNOWN'].includes(input.authStatus)||!Number.isSafeInteger(input.freshnessAgeMs)||input.freshnessAgeMs<0||!version(input.observedSchemaVersion)||!version(input.observedParserVersion)||!['HEALTHY','DEGRADED','UNAVAILABLE','UNKNOWN'].includes(input.qualityStatus)||(input.costUsageMinorUnits!==null&&(!Number.isSafeInteger(input.costUsageMinorUnits)||input.costUsageMinorUnits<0)))return deepFreeze({ok:false,reasonCode:'PROVIDER_HEALTH_MALFORMED'});
  return deepFreeze({ok:true,reasonCode:'APPROVED_PROVIDER_HEALTH_ONLY',policy,health:deepFreeze(canonicalise(input)),mayInfluenceProduction:false});
}
