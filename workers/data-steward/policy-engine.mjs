import {canonicalise,deepFreeze,stableStringify,secretFinding} from '../../src/decision-intelligence/canonical.mjs';
import {ACTION_REGISTRY,AUTO_MERGE_ALLOWLIST,AUTONOMY_CLASS,DECISION,MUTATION_DOMAINS,POLICY_VERSION,getActionDefinition} from './action-registry.mjs';

const PROPOSAL_KEYS=['actionId','actionClass','incidentId','mainSha','expectedStateFingerprint','parameters','policyVersion','expiresAt','nonce','evidence'];
const CONTEXT_KEYS=['now','currentMainSha','currentIncidentId','currentExpectedStateFingerprint','consumedNonces','incidentActionCount','actionRetryCount','cooldownUntil','circuitBreakerTripped','killSwitches'];
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&stableStringify(Object.keys(value).sort())===stableStringify(keys.slice().sort());
const text=(value,pattern)=>typeof value==='string'&&pattern.test(value);
const iso=value=>text(value,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)&&Number.isFinite(Date.parse(value));
const nonNegative=value=>Number.isSafeInteger(value)&&value>=0;
const result=(proposal,decision,reasonCode)=>deepFreeze(canonicalise({decision,reasonCode,policyVersion:POLICY_VERSION,actionId:typeof proposal?.actionId==='string'?proposal.actionId:null,incidentId:typeof proposal?.incidentId==='string'?proposal.incidentId:null}));
const deny=(proposal,reason)=>result(proposal,DECISION.DENY,reason);

function validSwitches(value){
  return exact(value,['overallAutonomy',...MUTATION_DOMAINS])&&Object.values(value).every(flag=>typeof flag==='boolean');
}

export function evaluateActionPolicy(proposal,context){
  try{
    if(!exact(proposal,PROPOSAL_KEYS)||!exact(context,CONTEXT_KEYS))return deny(proposal,'MALFORMED_REQUEST');
    if(!text(proposal.actionId,/^[a-z][a-z0-9_.-]{2,95}$/)||!Number.isInteger(proposal.actionClass)||proposal.actionClass<0||proposal.actionClass>4)return deny(proposal,'UNSUPPORTED_AUTONOMY_CLASS');
    if(!text(proposal.incidentId,/^incident-[0-9a-f]{24}$/)||!text(proposal.mainSha,/^[0-9a-f]{40}$/)||!text(proposal.expectedStateFingerprint,/^[0-9a-f]{64}$/)||!text(proposal.nonce,/^[a-zA-Z0-9_-]{16,96}$/)||!iso(proposal.expiresAt)||proposal.policyVersion!==POLICY_VERSION)return deny(proposal,'MALFORMED_REQUEST');
    if(!iso(context.now)||!text(context.currentMainSha,/^[0-9a-f]{40}$/)||!text(context.currentIncidentId,/^incident-[0-9a-f]{24}$/)||!text(context.currentExpectedStateFingerprint,/^[0-9a-f]{64}$/)||!Array.isArray(context.consumedNonces)||!context.consumedNonces.every(value=>text(value,/^[a-zA-Z0-9_-]{16,96}$/))||!nonNegative(context.incidentActionCount)||!nonNegative(context.actionRetryCount)||(context.cooldownUntil!==null&&!iso(context.cooldownUntil))||typeof context.circuitBreakerTripped!=='boolean'||!validSwitches(context.killSwitches))return deny(proposal,'MALFORMED_REQUEST');
    if(!exact(proposal.parameters,Object.keys(proposal.parameters??{}))||!Array.isArray(proposal.evidence)||!proposal.evidence.every(value=>text(value,/^[a-z][a-z0-9:/.@_-]{1,127}$/))||secretFinding(proposal)!==null)return deny(proposal,'MALFORMED_REQUEST');
    const action=getActionDefinition(proposal.actionId);
    if(!action)return deny(proposal,'UNKNOWN_ACTION_ID');
    if(action.actionClass!==proposal.actionClass)return deny(proposal,'ACTION_CLASS_MISMATCH');
    const parameterKeys=Object.keys(proposal.parameters).sort();
    if(parameterKeys.some(key=>!action.allowedParameters.includes(key))||parameterKeys.some(key=>!text(key,/^[a-z][a-zA-Z0-9]{0,47}$/)))return deny(proposal,'UNEXPECTED_PARAMETER');
    if(action.actionId==='observe.health.inspect'&&!['github','cloudflare','d1','provider','all'].includes(proposal.parameters.scope))return deny(proposal,'UNEXPECTED_PARAMETER');
    if(action.actionId==='observe.evidence.generate'&&proposal.parameters.format!=='json')return deny(proposal,'UNEXPECTED_PARAMETER');
    if(action.actionId==='repair.dispatch.retry'&&!text(proposal.parameters.dispatchIdentity,/^[0-9a-f]{64}$/))return deny(proposal,'UNEXPECTED_PARAMETER');
    if(action.actionId==='repair.repository.draft_pr'&&!text(proposal.parameters.runbookId,/^[a-z][a-z0-9_.-]{2,63}$/))return deny(proposal,'UNEXPECTED_PARAMETER');
    if(action.requiredEvidence.some(required=>!proposal.evidence.includes(required)))return deny(proposal,'MISSING_REQUIRED_EVIDENCE');
    if(Date.parse(context.now)>=Date.parse(proposal.expiresAt))return deny(proposal,'STALE_AUTHORIZATION');
    if(proposal.mainSha!==context.currentMainSha)return deny(proposal,'MAIN_SHA_MISMATCH');
    if(proposal.incidentId!==context.currentIncidentId)return deny(proposal,'INCIDENT_CONTEXT_MISMATCH');
    if(proposal.expectedStateFingerprint!==context.currentExpectedStateFingerprint)return deny(proposal,'PRE_STATE_MISMATCH');
    if(context.consumedNonces.includes(proposal.nonce))return deny(proposal,'REPLAY_DETECTED');
    if(!context.killSwitches.overallAutonomy)return deny(proposal,'AUTONOMY_DISABLED');
    if(action.mutates&&(!action.mutationDomain||!context.killSwitches[action.mutationDomain]))return deny(proposal,'MUTATION_DOMAIN_DISABLED');
    if(action.actionClass===AUTONOMY_CLASS.OWNER_APPROVAL||action.ownerApprovalRequired)return result(proposal,DECISION.ESCALATE,'OWNER_APPROVAL_REQUIRED');
    if(action.actionClass===AUTONOMY_CLASS.AUTO_MERGE&&!AUTO_MERGE_ALLOWLIST.includes(action.actionId))return deny(proposal,'AUTO_MERGE_ALLOWLIST_EMPTY');
    if(context.circuitBreakerTripped)return deny(proposal,'CIRCUIT_BREAKER_TRIPPED');
    if(context.cooldownUntil!==null&&Date.parse(context.now)<Date.parse(context.cooldownUntil))return deny(proposal,'ACTION_COOLDOWN_ACTIVE');
    if(context.incidentActionCount>=3)return deny(proposal,'INCIDENT_ACTION_BUDGET_EXHAUSTED');
    if(context.actionRetryCount>=action.retryBudget)return deny(proposal,'ACTION_RETRY_BUDGET_EXHAUSTED');
    if(action.actionClass!==AUTONOMY_CLASS.OBSERVE)return deny(proposal,'AUTONOMY_CLASS_DISABLED');
    if(action.mutates)return deny(proposal,'OBSERVE_ACTION_MUTATION_FORBIDDEN');
    if(!action.enabled)return deny(proposal,'ACTION_DISABLED');
    return result(proposal,DECISION.ALLOW,'OBSERVE_ACTION_ALLOWED');
  }catch{return deny(proposal,'POLICY_AMBIGUITY');}
}

export function executableObserveAction(actionId){
  const action=getActionDefinition(actionId);
  return action?.enabled===true&&action.actionClass===AUTONOMY_CLASS.OBSERVE&&action.mutates===false?action:null;
}

export const registeredActions=()=>ACTION_REGISTRY;
