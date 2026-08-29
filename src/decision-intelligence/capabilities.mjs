import {canonicalise,deepFreeze,stableStringify} from './canonical.mjs';
import {signalVersionKey} from './registry.mjs';

const AUTHENTIC_APPROVAL_LEDGERS=new WeakSet();

export function approvalKey(signalId,version,scope){return `${signalVersionKey(signalId,version)}#${scope}`;}
export function createApprovalLedger(records=[]){
  const approvals=new Map();
  for(const raw of records){
    const row=canonicalise(raw),key=approvalKey(row.signalId,row.version,row.scope);
    if(!row.approvalId||!row.signalId||!row.version||!row.scope||row.capability!=='production_read'||row.status!=='approved'||!row.approvedAt||!row.approvedBy)throw new Error('approval_invalid');
    if(approvals.has(key))throw new Error('approval_duplicate');approvals.set(key,deepFreeze(row));
  }
  const ledger=Object.freeze({requireProductionRead(signalId,version,scope){const record=approvals.get(approvalKey(signalId,version,scope));if(!record)throw new Error('production_read_unapproved');return record;},canonical:()=>stableStringify(Array.from(approvals.values()).sort((a,b)=>a.approvalId.localeCompare(b.approvalId)))});
  AUTHENTIC_APPROVAL_LEDGERS.add(ledger);
  return ledger;
}
export function isAuthenticApprovalLedger(value){return Boolean(value&&typeof value==='object'&&AUTHENTIC_APPROVAL_LEDGERS.has(value));}

export function createShadowRepository(){
  const observations=new Map();
  return Object.freeze({
    add(observation){if(observation?.boundary?.capability!=='shadow_only'||!/^obs-[0-9a-f]{64}$/.test(observation?.identity?.observationId||''))throw new Error('shadow_observation_invalid');const stored=deepFreeze(canonicalise(observation));observations.set(stored.identity.observationId,stored);return stored.identity.observationId;},
    list(){return deepFreeze(Array.from(observations.values()).sort((a,b)=>a.identity.observationId.localeCompare(b.identity.observationId)));},
    productionRead(){throw new Error('shadow_repository_has_no_production_capability');}
  });
}
