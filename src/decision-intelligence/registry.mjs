import {canonicalise,stableStringify} from './canonical.mjs';
import {RIGHTS_CLASSIFICATIONS} from './rights.mjs';
import {SUBJECT_TYPES} from './observation.mjs';

const SIGNAL_ID=/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const VERSION=/^[1-9]\d*\.\d+\.\d+$/;
export function signalVersionKey(signalId,version){return `${signalId}@${version}`;}
export function createSignalRegistry(candidates=[]){
  const records=new Map();
  for(const raw of candidates){
    const row=canonicalise(raw),key=signalVersionKey(row.signalId,row.version);
    if(!SIGNAL_ID.test(row.signalId||'')||!VERSION.test(row.version||'')||!row.domain||!row.sourceKey||!SUBJECT_TYPES.includes(row.subjectType)||!Array.isArray(row.requiredTimingFields)||!RIGHTS_CLASSIFICATIONS.includes(row.rightsClassification)||typeof row.persistenceAllowed!=='boolean'||!row.expectedEvidenceType||!Array.isArray(row.upstreamDependencies)||!Array.isArray(row.overlapRisks)||!row.evaluationDomain||row.productionStatus!=='shadow_only')throw new Error('signal_invalid');
    if(records.has(key))throw new Error('signal_duplicate');
    records.set(key,Object.freeze(row));
  }
  return Object.freeze({get:(signalId,version)=>records.get(signalVersionKey(signalId,version))||null,list:()=>Array.from(records.values()).sort((a,b)=>signalVersionKey(a.signalId,a.version).localeCompare(signalVersionKey(b.signalId,b.version))),canonical:()=>stableStringify(Array.from(records.values()).sort((a,b)=>signalVersionKey(a.signalId,a.version).localeCompare(signalVersionKey(b.signalId,b.version))))});
}
