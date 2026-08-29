export const RIGHTS_CLASSIFICATIONS=Object.freeze(['durable_allowed','attribution_required','local_research_only','durable_blocked','unknown_fail_closed']);

export function classifyRights(rights={}){
  const classification=RIGHTS_CLASSIFICATIONS.includes(rights.classification)?rights.classification:'unknown_fail_closed';
  const attributionRequired=classification==='attribution_required';
  const retentionAllowed=['durable_allowed','attribution_required'].includes(classification)&&rights.retentionAllowed===true;
  const redistributionAllowed=retentionAllowed&&rights.redistributionAllowed===true;
  const valid=classification!=='unknown_fail_closed'&&
    rights.attributionRequired===attributionRequired&&
    (!attributionRequired||Boolean(String(rights.attributionText||'').trim()));
  return Object.freeze({classification,retentionAllowed:valid&&retentionAllowed,redistributionAllowed:valid&&redistributionAllowed,attributionRequired,attributionText:attributionRequired?String(rights.attributionText||'').trim():null,valid});
}
export function persistenceDecision(rights){
  const result=classifyRights(rights);
  return result.valid&&result.retentionAllowed?{ok:true,rights:result}:{ok:false,reason:result.classification==='unknown_fail_closed'?'rights_unknown':'retention_blocked',rights:result};
}
