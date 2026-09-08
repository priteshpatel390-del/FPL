import {canonicalise,deepFreeze,sha256Hex,stableStringify,secretFinding} from '../../src/decision-intelligence/canonical.mjs';
import {DECISION,POLICY_VERSION} from './action-registry.mjs';

export const AUDIT_SCHEMA_VERSION='data-ops-audit-v1';
const KEYS=['incidentId','timestamp','sourceSha','detectorId','detectorVersion','policyVersion','expectedStateFingerprint','observedStateFingerprint','evidence','classification','diagnosticSummary','requestedActionId','decision','reasonCode','executorIdentity','beforeStateFingerprint','afterStateFingerprint','verificationEvidence','rollbackTarget','rollbackResult','finalStatus','notificationDisposition'];
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&stableStringify(Object.keys(value).sort())===stableStringify(keys.slice().sort());
const hash=value=>value===null||typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
const bounded=value=>value===null||typeof value==='string'&&value.length<=256&&!/[\r\n]/.test(value);

export async function createAuditRecord(input,{cryptoImpl=globalThis.crypto}={}){
  if(!exact(input,KEYS))throw new Error('audit_schema_invalid');
  if(input.policyVersion!==POLICY_VERSION||!/^incident-[0-9a-f]{24}$/.test(input.incidentId||'')||!/^[0-9a-f]{40}$/.test(input.sourceSha||'')||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.timestamp||'')||!Number.isFinite(Date.parse(input.timestamp)))throw new Error('audit_identity_invalid');
  if(!['GREEN','AMBER','RED'].includes(input.classification)||!Object.values(DECISION).includes(input.decision)||!/^([A-Z][A-Z0-9_]{1,63})$/.test(input.reasonCode||''))throw new Error('audit_decision_invalid');
  if(!hash(input.expectedStateFingerprint)||!hash(input.observedStateFingerprint)||!hash(input.beforeStateFingerprint)||!hash(input.afterStateFingerprint))throw new Error('audit_fingerprint_invalid');
  if(!Array.isArray(input.evidence)||!input.evidence.every(bounded)||!Array.isArray(input.verificationEvidence)||!input.verificationEvidence.every(bounded)||![input.diagnosticSummary,input.executorIdentity,input.rollbackTarget,input.rollbackResult,input.finalStatus,input.notificationDisposition,input.requestedActionId,input.detectorId,input.detectorVersion].every(bounded))throw new Error('audit_field_invalid');
  if(secretFinding(input)!==null)throw new Error('audit_secret_forbidden');
  const core=canonicalise({schemaVersion:AUDIT_SCHEMA_VERSION,...input});
  const auditId=await sha256Hex(stableStringify(core),cryptoImpl);
  return deepFreeze(canonicalise({...core,auditId}));
}

export const auditRecordJson=record=>`${stableStringify(record)}\n`;
