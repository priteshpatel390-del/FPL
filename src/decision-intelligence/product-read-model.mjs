import {canonicalise,deepFreeze,stableStringify} from './canonical.mjs';
export const DI4_READ_MODEL_VERSION='di4-product-read-model-v1';
export const DI4_SUPPORTED_ARTIFACT_VERSION='di3-decision-artifact-v1';
const REQUIRED_DOMAINS=Object.freeze(['xi','bench','captain','vice','transfers']);
const VALID_DOMAINS=new Set(REQUIRED_DOMAINS);
function unavailable(reason,detail=null){return deepFreeze(canonicalise({schemaVersion:DI4_READ_MODEL_VERSION,status:'unavailable',reason,detail,deadline:null,decisions:[],alternatives:[],uncertainty:null,risks:[],reconsiderationConditions:[],missingDomains:REQUIRED_DOMAINS}));}
function validRow(row){return row&&VALID_DOMAINS.has(row.action?.domain)&&typeof row.action?.type==='string'&&row.action?.actionId&&row.consequence&&row.legality?.legal===true;}
function copyRow(row){return canonicalise({domain:row.action.domain,action:row.action,consequence:row.consequence,rationaleCodes:row.rationaleCodes||[],evidenceReferences:row.evidenceReferences||[],assumptionReferences:row.assumptionReferences||[]});}
// The caller supplies `now`; no wall clock or production calculation is hidden in this boundary.
export function createWeeklyDecisionReadModel(runtimeResult,{now}={}){
  if(!runtimeResult||runtimeResult.ok!==true||!runtimeResult.artifact)return unavailable(runtimeResult?.error?'artifact_invalid':'artifact_missing',runtimeResult?.error||null);
  const artifact=runtimeResult.artifact;
  if(artifact.schemaVersion!==DI4_SUPPORTED_ARTIFACT_VERSION)return unavailable('unsupported_schema',String(artifact.schemaVersion||'missing'));
  if(!artifact.deadline||!artifact.completeness||!Array.isArray(artifact.recommendations)||!Array.isArray(artifact.alternatives))return unavailable('artifact_invalid');
  if(artifact.recommendations.some(row=>!validRow(row))||artifact.alternatives.some(row=>!validRow(row)))return unavailable('artifact_invalid');
  const domains=artifact.recommendations.map(row=>row.action.domain);if(new Set(domains).size!==domains.length)return unavailable('artifact_invalid');
  const missing=Array.from(new Set([...(artifact.completeness.missingDomains||[]),...REQUIRED_DOMAINS.filter(domain=>!domains.includes(domain))]));
  const stale=(artifact.completeness.staleDomains||[]).slice(),conflicts=(artifact.completeness.conflicts||[]).slice();
  const complete=artifact.completeness.state==='complete'&&!missing.length&&!stale.length&&!conflicts.length;
  const deadlineMs=Date.parse(artifact.deadline.deadline),nowMs=Date.parse(now);const deadlinePassed=Number.isFinite(deadlineMs)&&Number.isFinite(nowMs)?nowMs>=deadlineMs:null;
  return deepFreeze(canonicalise({schemaVersion:DI4_READ_MODEL_VERSION,status:complete?'complete':'partial',reason:complete?null:'artifact_incomplete',deadline:{season:artifact.deadline.season,gameweek:artifact.deadline.gameweek,eventId:artifact.deadline.eventId,at:artifact.deadline.deadline,passed:deadlinePassed},decisions:artifact.recommendations.map(copyRow),alternatives:artifact.alternatives.map(copyRow),uncertainty:artifact.uncertainty||null,risks:artifact.risks||[],reconsiderationConditions:artifact.reconsiderationConditions||[],missingDomains:missing,staleDomains:stale,conflicts,evidenceReferences:artifact.evidenceReferences||[],assumptionReferences:artifact.assumptionReferences||[],rationaleCodes:artifact.rationaleCodes||[],provenance:{sourceCommit:artifact.build?.sourceCommit||null,modelVersion:artifact.build?.modelVersion||null,rulesVersion:artifact.build?.rulesVersion||null,artifactHash:artifact.hashes?.artifactHash||null}}));
}
export function weeklyDecisionReadModelBytes(result,options){return stableStringify(createWeeklyDecisionReadModel(result,options));}
