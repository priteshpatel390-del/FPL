export const OWNER_RISK_PRIVATE_USE='owner_risk_accepted_private_use';
export const OWNER_RISK_ALLOWED_USE='private_noncommercial_research';
export const OWNER_RISK_PROVIDER='api-football';
export const RIGHTS_CLASSIFICATIONS=Object.freeze(['durable_allowed','attribution_required','local_research_only','durable_blocked','unknown_fail_closed',OWNER_RISK_PRIVATE_USE]);

function validOwnerRiskContract(rights){
  return rights.classification===OWNER_RISK_PRIVATE_USE&&
    rights.provider===OWNER_RISK_PROVIDER&&
    rights.allowedUse===OWNER_RISK_ALLOWED_USE&&
    /^EIA-2I1(?:[-:][A-Za-z0-9._-]+)?$/.test(String(rights.ownerApprovalId||''))&&
    rights.retentionAllowed===true&&rights.redistributionAllowed===false&&
    rights.publicUseAllowed===false&&rights.commercialUseAllowed===false&&
    rights.rawPayloadRetentionAllowed===false&&rights.stopOnObjection===true;
}

export function classifyRights(rights={}){
  const classification=RIGHTS_CLASSIFICATIONS.includes(rights.classification)?rights.classification:'unknown_fail_closed';
  const attributionRequired=classification==='attribution_required';
  const ownerRiskValid=validOwnerRiskContract(rights);
  const retentionAllowed=(['durable_allowed','attribution_required'].includes(classification)&&rights.retentionAllowed===true)||ownerRiskValid;
  const redistributionAllowed=!ownerRiskValid&&retentionAllowed&&rights.redistributionAllowed===true;
  const valid=(classification!==OWNER_RISK_PRIVATE_USE||ownerRiskValid)&&classification!=='unknown_fail_closed'&&
    rights.attributionRequired===attributionRequired&&
    (!attributionRequired||Boolean(String(rights.attributionText||'').trim()));
  const result={classification,retentionAllowed:valid&&retentionAllowed,redistributionAllowed:valid&&redistributionAllowed,attributionRequired,attributionText:attributionRequired?String(rights.attributionText||'').trim():null,valid};
  if(ownerRiskValid)Object.assign(result,{ownerApprovalId:rights.ownerApprovalId,allowedUse:OWNER_RISK_ALLOWED_USE,provider:OWNER_RISK_PROVIDER,publicUseAllowed:false,commercialUseAllowed:false,rawPayloadRetentionAllowed:false,stopOnObjection:true});
  return Object.freeze(result);
}
export function persistenceDecision(rights){
  const result=classifyRights(rights);
  return result.valid&&result.retentionAllowed?{ok:true,rights:result}:{ok:false,reason:result.classification==='unknown_fail_closed'?'rights_unknown':'retention_blocked',rights:result};
}
