import {canonicalise,deepFreeze,sha256Hex,stableStringify} from './canonical.mjs';
import {eia1SecretFinding} from './eia1-safety.mjs';
import {classifyRights,OWNER_RISK_PRIVATE_USE,OWNER_RISK_PROVIDER} from './rights.mjs';

export const EIA1_WORKLOAD_VERSION='1.0.0';
const RIGHTS=new Set(['durable_allowed','attribution_required','local_research_only','durable_blocked','unknown_fail_closed',OWNER_RISK_PRIVATE_USE]);
const STATUS=new Set(['starter','substitute','not_used','unknown']);
const LINEUP_STATE=Object.freeze({starter:Object.freeze([true,false]),substitute:Object.freeze([false,true]),not_used:Object.freeze([false,true]),unknown:Object.freeze([null,null])});
function fail(condition,code){if(condition)throw new Error(`eia1_workload_${code}`);}
const nullableNumber=value=>value==null?null:(Number.isFinite(Number(value))?Number(value):(()=>{throw new Error('eia1_workload_number')})());
function validLineupState({status,starter,bench}={}){const expected=LINEUP_STATE[status];return Boolean(expected)&&starter===expected[0]&&bench===expected[1];}
export async function normaliseWorkloadObservation(raw,{cryptoImpl=globalThis.crypto}={}){
  fail(Boolean(eia1SecretFinding(raw)),'secret_material');
  fail(raw?.schemaVersion!=='eia1-workload-observation-v1','schema');fail(!RIGHTS.has(raw.rights?.classification),'rights');
  const rights=classifyRights(raw.rights);
  fail(rights.classification===OWNER_RISK_PRIVATE_USE&&raw.source?.sourceKey!==OWNER_RISK_PROVIDER,'rights_source_mismatch');
  fail(raw.rights.classification!=='local_research_only'&&!(rights.valid&&rights.classification===OWNER_RISK_PRIVATE_USE&&rights.retentionAllowed),'retention_not_fail_closed');fail(!STATUS.has(raw.participation?.status),'status');
  const status=raw.participation.status,minutes=nullableNumber(raw.participation.minutes);
  fail(minutes!=null&&(minutes<0||minutes>130),'minutes');fail(status==='not_used'&&minutes!==0,'not_used_minutes');
  fail(!validLineupState(raw.participation),'lineup_semantics');
  const core=canonicalise({...raw,rights:raw.rights.classification===OWNER_RISK_PRIVATE_USE?rights:raw.rights,contractVersion:EIA1_WORKLOAD_VERSION,participation:{...raw.participation,minutes,substitutionOnMinute:nullableNumber(raw.participation.substitutionOnMinute),substitutionOffMinute:nullableNumber(raw.participation.substitutionOffMinute),extraTime:raw.participation.extraTime??null},quality:{...raw.quality,missingFields:[...(raw.quality?.missingFields||[])].sort()}});
  return deepFreeze({...core,observationHash:await sha256Hex(stableStringify(core),cryptoImpl)});
}
export function workloadExperimentArms(){return deepFreeze([{armId:'baseline',features:[]},{armId:'schedule-density-a',features:['scheduleDensity']},{armId:'player-workload-b',features:['playerWorkload']},{armId:'schedule-density-plus-player-workload',features:['scheduleDensity','playerWorkload']}]);}
