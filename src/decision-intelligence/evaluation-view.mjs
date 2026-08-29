import {canonicalise,deepFreeze,sha256Hex,stableStringify} from './canonical.mjs';
import {eligibleAsOf} from './observation.mjs';
import {signalVersionKey} from './registry.mjs';

function cohortEligible(row,cohort){
  if(row.season!==cohort.season||!cohort.subjectTypes.includes(row.subjectType))return false;
  if(cohort.gameweekRange&&(row.gameweek<cohort.gameweekRange.start||row.gameweek>cohort.gameweekRange.end))return false;
  if(cohort.includeSubjectIds&&!cohort.includeSubjectIds.includes(row.subjectId))return false;
  if(cohort.excludeSubjectIds?.includes(row.subjectId))return false;
  return true;
}
function timingReason(row,cutoff,required){
  if(row.dataRole==='outcome')return 'outcome_leakage';
  if(row.conflictState==='conflicting')return 'unresolved_conflict';
  for(const field of required)if(!row.timing?.[field])return `missing_${field}`;
  if(!eligibleAsOf({timing:row.timing,quality:{state:row.qualityState||'accepted'}},cutoff))return Number.isFinite(Date.parse(row.timing?.expiresAt))&&Date.parse(row.timing.expiresAt)<=Date.parse(cutoff)?'expired':'after_cutoff';
  if(row.timing.effectiveAt&&Date.parse(row.timing.effectiveAt)>Date.parse(cutoff))return 'not_effective';
  return null;
}
export async function freezePointInTimeView({manifest,observations,outcomes},cryptoImpl=globalThis.crypto){
  const cutoff=manifest.pointInTime.decisionCutoff,required=manifest.pointInTime.requiredTimingFields;
  const rejected=[],eligible=[];
  for(const source of observations){const row=canonicalise(source),reason=!cohortEligible(row,manifest.cohort)?'outside_cohort':timingReason(row,cutoff,required);(reason?rejected:eligible).push(reason?{recordId:row.recordId,reason}:row);}
  const selected=new Map();
  for(const row of eligible.sort((a,b)=>`${a.subjectId}|${a.signalId}|${a.version}|${a.timing.observedAt}|${a.recordId}`.localeCompare(`${b.subjectId}|${b.signalId}|${b.version}|${b.timing.observedAt}|${b.recordId}`))){
    const key=`${row.subjectId}|${signalVersionKey(row.signalId,row.version)}`; selected.set(key,row);
  }
  const outcomeRows=outcomes.filter(row=>cohortEligible(row,manifest.cohort)&&row.revision===manifest.outcomes.revision&&row.version===manifest.outcomes.version&&row.availableAt&&Date.parse(row.availableAt)>Date.parse(cutoff)).map(canonicalise).sort((a,b)=>a.subjectId.localeCompare(b.subjectId));
  const view=canonicalise({cutoff,observations:[...selected.values()],outcomes:outcomeRows,rejections:rejected.sort((a,b)=>a.recordId.localeCompare(b.recordId)||a.reason.localeCompare(b.reason))});
  return deepFreeze({...view,viewHash:await sha256Hex(stableStringify(view),cryptoImpl)});
}
