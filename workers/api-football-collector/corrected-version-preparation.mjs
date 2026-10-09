// Corrected R1/R2 collector Version preparation. Repository-only until a distinct owner-approved upload.
import {createHash} from 'node:crypto';
import {stableStringify} from '../../src/decision-intelligence/canonical.mjs';
import {expectedAttendedBindings} from './attended-version.mjs';
import {buildCorrectedVersionCandidateIdentity,readCorrectedCandidateModuleSource,CORRECTED_VERSION_CANDIDATE_MODULE_SHA256} from './corrected-version-candidate.mjs';
import {ENTRY_MODULE,EXPECTED_COMPATIBILITY_DATE,buildUploadModules,resolveModuleGraph,REVIEWED_MODULE_PATHS} from './stage-inactive-version.mjs';
import {PROMOTION_EXPECTED_VERSION_IDS,promotionPostStateExact} from './transport-remediated-deployment-promotion.mjs';
import {GATE_C_ACTIVE_DEPLOYMENT_ID} from './gate-c.mjs';
import {validateZoneTopology,DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_STOP,DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_REASON} from './deployed-one-shot.mjs';
import {foundationDiagnostic,TRANSPORT_REMEDIATED_CONSUMED_HISTORY} from './transport-remediated-version-preparation.mjs';

export const CORRECTED_PREPARATION_CONTRACT='api-football-corrected-r1-r2-version-preparation-v1';
export const CORRECTED_ADMISSION_CONTRACT='api-football-corrected-r1-r2-version-admission-v1';
export const CORRECTED_EXECUTION_CONTRACT='api-football-corrected-r1-r2-version-execution-v1';
export const CORRECTED_RECONCILIATION_CONTRACT='api-football-corrected-r1-r2-version-reconciliation-v1';
export const CORRECTED_READY='READY_FOR_CORRECTED_VERSION_UPLOAD';
export const CORRECTED_PREPARED='CORRECTED_VERSION_PREPARED_NOT_DEPLOYED';
export const CORRECTED_ATTENTION='CORRECTED_VERSION_OWNER_ATTENTION_REQUIRED';
export const CORRECTED_HISTORICAL_VERSION_IDS=Object.freeze([...PROMOTION_EXPECTED_VERSION_IDS]);
export const CORRECTED_MAX_VERSION_UPLOADS=1;
export const CORRECTED_EXPECTED_HISTORY=Object.freeze({
  ...TRANSPORT_REMEDIATED_CONSUMED_HISTORY,
  requestAttempts:5,attempt1Count:5,succeededAttemptCount:3,transportUnknownCount:1,
  generations:2,failedGenerationCount:2,fixtureRevisions:824,schemaFailureCount:1
});
const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=code=>{throw new Error(code);};
const hex40=x=>typeof x==='string'&&/^[0-9a-f]{40}$/.test(x);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const ids=(values,expected)=>Array.isArray(values)&&values.length===expected.length&&new Set(values).size===values.length&&
  values.every(uuid)&&same([...values].sort(),[...expected].sort());
const frozen=x=>Object.freeze(x);

export function buildCorrectedVersionIdentity(creationSha){
  if(!hex40(creationSha))fail('corrected_creation_sha_invalid');
  const candidate=buildCorrectedVersionCandidateIdentity();
  if(!same(candidate.moduleSha256,CORRECTED_VERSION_CANDIDATE_MODULE_SHA256)||candidate.uploadAuthorized!==false)
    fail('corrected_source_identity_invalid');
  const annotations=frozen({'workers/message':'API-Football corrected R1/R2 Version from '+creationSha,
    'workers/tag':'api-football-corrected-r1-r2-'+creationSha.slice(0,12)});
  const bindings=expectedAttendedBindings().map(row=>row.type==='secret_text'?{name:row.name,type:row.type}:{...row});
  const metadata=frozen({main_module:ENTRY_MODULE,compatibility_date:EXPECTED_COMPATIBILITY_DATE,bindings,annotations});
  const metadataSha256=sha(stableStringify(metadata));
  const graphSha256=sha(stableStringify({contract:CORRECTED_PREPARATION_CONTRACT,creationSha,
    entryModule:ENTRY_MODULE,metadataSha256,moduleSha256:candidate.moduleSha256}));
  return frozen({contract:CORRECTED_PREPARATION_CONTRACT,creationSha,entryModule:ENTRY_MODULE,
    moduleSha256:candidate.moduleSha256,metadata,metadataSha256,graphSha256,
    uploadAuthorized:false,deploymentAuthorized:false});
}
export function buildCorrectedUploadForm(identity,{apiKey,triggerSecret}={}){
  if(!identity||!hex40(identity.creationSha)||identity.graphSha256!==buildCorrectedVersionIdentity(identity.creationSha).graphSha256)
    fail('corrected_upload_identity_invalid');
  if(typeof apiKey!=='string'||!apiKey||typeof triggerSecret!=='string'||triggerSecret.length<32||triggerSecret===apiKey)
    fail('corrected_secret_invalid');
  const graph=resolveModuleGraph({readFile:readCorrectedCandidateModuleSource});
  const modules=buildUploadModules(graph);
  if(modules.size!==REVIEWED_MODULE_PATHS.length||!same(Object.fromEntries([...modules].sort(([a],[b])=>a.localeCompare(b)).map(([name,body])=>[name,sha(body)])),identity.moduleSha256))
    fail('corrected_upload_bytes_invalid');
  const metadata={...identity.metadata,bindings:identity.metadata.bindings.map(binding=>
    binding.type!=='secret_text'?{...binding}:{...binding,text:binding.name==='API_FOOTBALL_API_KEY'?apiKey:triggerSecret})};
  const form=new FormData();form.set('metadata',JSON.stringify(metadata));
  for(const [name,source] of [...modules].sort(([a],[b])=>a.localeCompare(b)))
    form.set(name,new File([source],name,{type:'application/javascript+module'}));
  return form;
}
// Closed, sanitised sub-reasons for a rejected returned Version. Each is a fixed repository-owned token; no remote value,
// module name, binding name or hash is ever interpolated, so the reason cannot carry provider text or secret material.
export const CORRECTED_VERSION_FAILURE_REASONS=Object.freeze([
  'version_identity_invalid','version_response_incomplete','runtime_compatibility_date_mismatch','main_module_mismatch',
  'beta_compatibility_date_mismatch','annotations_mismatch','bindings_response_incomplete','binding_count_mismatch',
  'binding_missing','binding_type_mismatch','d1_binding_identity_mismatch','plain_text_binding_mismatch',
  'secret_binding_value_exposed','version_url_present','external_dependency_present','modules_response_incomplete',
  'module_count_mismatch','module_name_duplicate','module_unexpected','module_content_encoding_invalid','module_content_mismatch'
]);
const reasonFail=(prefix,reason)=>{throw new Error(prefix+'__'+reason);};
// Cloudflare adds its own read-only workers/triggered_by annotation to returned Versions.
// Preserve exact user-supplied creation-SHA annotations; accept only this one documented,
// string-typed server field as optional. Object/property order is not identity.
const correctedAnnotationsMatch=(actual,expected)=>{
  if(!actual||typeof actual!=='object'||Array.isArray(actual)||
    !expected||typeof expected!=='object'||Array.isArray(expected))return false;
  const keys=Reflect.ownKeys(actual);
  if(keys.length!==2&&keys.length!==3)return false;
  if(!Object.hasOwn(actual,'workers/message')||!Object.hasOwn(actual,'workers/tag')||
    typeof expected['workers/message']!=='string'||typeof expected['workers/tag']!=='string'||
    actual['workers/message']!==expected['workers/message']||
    actual['workers/tag']!==expected['workers/tag'])return false;
  if(keys.length===2)return true;
  return Object.hasOwn(actual,'workers/triggered_by')&&
    typeof actual['workers/triggered_by']==='string';
};
export function validateCorrectedVersion({stable,beta,versionId,identity}={}){
  if(!identity||identity.contract!==CORRECTED_PREPARATION_CONTRACT||!uuid(versionId)||
    CORRECTED_HISTORICAL_VERSION_IDS.includes(versionId)||stable?.id!==versionId||beta?.id!==versionId)
    reasonFail('corrected_version_identity_invalid','version_identity_invalid');
  const meta=reason=>reasonFail('corrected_version_metadata_drift',reason);
  if(stable?.resources?.script_runtime?.compatibility_date===undefined||beta?.compatibility_date===undefined||beta?.annotations===undefined)
    meta('version_response_incomplete');
  if(stable.resources.script_runtime.compatibility_date!==EXPECTED_COMPATIBILITY_DATE)meta('runtime_compatibility_date_mismatch');
  if(beta.main_module!==ENTRY_MODULE)meta('main_module_mismatch');
  if(beta.compatibility_date!==EXPECTED_COMPATIBILITY_DATE)meta('beta_compatibility_date_mismatch');
  if(!correctedAnnotationsMatch(beta.annotations,identity.metadata.annotations))meta('annotations_mismatch');
  const bind=reason=>reasonFail('corrected_version_bindings_drift',reason);
  const expected=identity.metadata.bindings,got=stable.resources?.bindings;
  if(!Array.isArray(got))bind('bindings_response_incomplete');
  if(got.length!==expected.length||new Set(got.map(x=>x?.name)).size!==expected.length)bind('binding_count_mismatch');
  for(const binding of expected){
    const actual=got.find(x=>x?.name===binding.name);
    if(!actual)bind('binding_missing');
    if(actual.type!==binding.type)bind('binding_type_mismatch');
    if(binding.type==='d1'&&actual.database_id!==binding.database_id)bind('d1_binding_identity_mismatch');
    if(binding.type==='plain_text'&&actual.text!==binding.text)bind('plain_text_binding_mismatch');
    if(binding.type==='secret_text'&&Object.hasOwn(actual,'text'))bind('secret_binding_value_exposed');
  }
  if(beta.urls!==undefined&&(!Array.isArray(beta.urls)||beta.urls.length!==0))reasonFail('corrected_version_url_present','version_url_present');
  if(beta.package_dependencies!==undefined&&(!Array.isArray(beta.package_dependencies)||beta.package_dependencies.length!==0))
    reasonFail('corrected_version_external_dependency','external_dependency_present');
  const mod=reason=>reasonFail('corrected_version_module_drift',reason),list=beta.modules;
  if(!Array.isArray(list))mod('modules_response_incomplete');
  if(list.length!==17)mod('module_count_mismatch');
  if(new Set(list.map(m=>m?.name)).size!==17)mod('module_name_duplicate');
  for(const m of list){
    if(!m||typeof m.name!=='string'||!Object.hasOwn(identity.moduleSha256,m.name))mod('module_unexpected');
    if(typeof m.content_base64!=='string')mod('module_content_encoding_invalid');
    if(sha(Buffer.from(m.content_base64,'base64'))!==identity.moduleSha256[m.name])mod('module_content_mismatch');
  }
  return true;
}
export function correctedHistoryDiagnostic(history,detail){
  if(!history||Object.entries(CORRECTED_EXPECTED_HISTORY).some(([k,v])=>history[k]!==v))return 'consumed_history_drift';
  // Extra targeted SELECT-only evidence, not inferred from revision.generation_id (content-addressed reuse is permitted).
  if(!detail||detail.quotaState!=='QUOTA_UNCERTAIN'||detail.totalMemberships!==824||detail.failedMemberships!==824||detail.committedMemberships!==0||
    detail.orphanMemberships!==0||detail.mismatchedMembershipRevisions!==0||detail.discoveryHeads!==0||
    detail.october8Attempts!==4||detail.october8Succeeded!==3||detail.october8SchemaFailures!==1||
    detail.failedGenerationMemberships!==1)return 'failed_generation_membership_drift';
  return null;
}
export function correctedAdmissionDiagnostic({report,detail,deployments,versions,topology,approvedSha,accountFingerprint}={}){
  if(!hex40(approvedSha)||typeof accountFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(accountFingerprint))
    return 'admission_identity_invalid';
  if(report?.ok!==false||report.classification!==DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_STOP||
    report.reason!==DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_REASON)return 'preflight_stop_unexpected';
  const history=correctedHistoryDiagnostic(report?.priorState,detail);if(history)return history;
  // Shared foundation may only see its original consumed-history shape after the TRUE new history was independently checked.
  const foundation=foundationDiagnostic({...report,priorState:TRANSPORT_REMEDIATED_CONSUMED_HISTORY},
    {approvedSha,accountFingerprint,requireVersionInventory:false});
  if(foundation)return foundation;
  if(report.inventory?.deploymentCount!==2||!promotionPostStateExact(deployments)||
    deployments[0].id!==GATE_C_ACTIVE_DEPLOYMENT_ID)return 'deployment_drift';
  if(!versions||!ids(versions.versionIds,CORRECTED_HISTORICAL_VERSION_IDS)||versions.identityExact!==true)
    return 'version_inventory_drift';
  if(!validateZoneTopology(topology))return 'zone_routes_unproven';
  return null;
}
export function buildCorrectedAdmission(input={}){
  const reason=correctedAdmissionDiagnostic(input),ok=reason===null;
  return frozen({version:CORRECTED_ADMISSION_CONTRACT,ok,classification:ok?CORRECTED_READY:'STOP_CORRECTED_VERSION_PREPARATION',
    reason,approvedSha:input.approvedSha??null,accountFingerprint:input.accountFingerprint??null,
    versions:input.versions?.versionIds?[...input.versions.versionIds].sort():null,
    deployments:input.deployments??null,topology:input.topology??null,preflight:input.report??null,detail:input.detail??null,
    retryAuthorized:false,evidence:frozen({productionMutations:0,d1Mutations:0,apiFootballRequests:0,secretValuesRead:0})});
}
export function validateCorrectedAdmission(admission,{approvedSha,accountFingerprint}={}){
  if(admission?.version!==CORRECTED_ADMISSION_CONTRACT||admission.ok!==true||admission.classification!==CORRECTED_READY||
    admission.approvedSha!==approvedSha||admission.accountFingerprint!==accountFingerprint||
    !ids(admission.versions,CORRECTED_HISTORICAL_VERSION_IDS)||admission.retryAuthorized!==false||
    admission.evidence?.productionMutations!==0||admission.evidence?.apiFootballRequests!==0||
    correctedAdmissionDiagnostic({report:admission.preflight,detail:admission.detail,deployments:admission.deployments,
      versions:{versionIds:admission.versions,identityExact:true},topology:admission.topology,approvedSha,accountFingerprint}))
    fail('corrected_admission_handoff_invalid');
  return true;
}
export async function submitCorrectedVersionOnce({post,readVersions,beforeIds,wait=async()=>{}}={}){
  if(typeof post!=='function'||typeof readVersions!=='function'||typeof wait!=='function'||
    !ids(beforeIds,CORRECTED_HISTORICAL_VERSION_IDS))fail('corrected_upload_preconditions_invalid');
  let response;try{response=await post();}catch{response={kind:'AMBIGUOUS'};}
  if(response?.kind==='REJECTED')return frozen({outcome:'REJECTED',versionId:null,readbackAttempts:0});
  const returnedId=response?.kind==='OK'&&uuid(response.result?.id)&&!beforeIds.includes(response.result.id)?response.result.id:null;
  for(let i=0;i<3;i++){
    await wait([0,2000,5000][i]);
    let after;try{after=await readVersions();}catch{after=null;}
    if(!Array.isArray(after)||new Set(after).size!==after.length||after.some(x=>!uuid(x))||
      beforeIds.some(x=>!after.includes(x))||after.length>beforeIds.length+1)
      return frozen({outcome:'AMBIGUOUS_OWNER_ATTENTION',versionId:null,readbackAttempts:i+1});
    const added=after.filter(x=>!beforeIds.includes(x));
    if(added.length===1){
      if(returnedId&&added[0]!==returnedId)return frozen({outcome:'AMBIGUOUS_OWNER_ATTENTION',versionId:null,readbackAttempts:i+1});
      return frozen({outcome:returnedId?'CREATED':'APPLIED_CONFIRMED_BY_READBACK',versionId:added[0],readbackAttempts:i+1});
    }
  }
  return frozen({outcome:'AMBIGUOUS_OWNER_ATTENTION',versionId:null,readbackAttempts:3});
}
export function classifyCorrectedReconciliation({admission,report,detail,deployments,versions,topology,created,identity,approvedSha,accountFingerprint}={}){
  const stop=reason=>frozen({ok:false,version:CORRECTED_RECONCILIATION_CONTRACT,classification:CORRECTED_ATTENTION,reason,retryAuthorized:false});
  try{validateCorrectedAdmission(admission,{approvedSha,accountFingerprint});}catch{return stop('admission_invalid');}
  // Check all non-Version invariants again, comparing the exact pre- and post-upload historical D1 evidence.
  if(!same(report?.priorState,admission.preflight?.priorState)||!same(detail,admission.detail)||
    report?.ok!==false||report?.classification!==DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_STOP||
    report?.reason!==DEPLOYED_ONE_SHOT_CONTINUATION_PREFLIGHT_REASON||
    foundationDiagnostic({...report,priorState:TRANSPORT_REMEDIATED_CONSUMED_HISTORY},
      {approvedSha,accountFingerprint,requireVersionInventory:false})||
    report?.inventory?.deploymentCount!==2||!promotionPostStateExact(deployments)||
    !same(deployments,admission.deployments)||!validateZoneTopology(topology)||!same(topology,admission.topology))
    return stop('preparation_state_drift');
  if(!created||created.version!==CORRECTED_EXECUTION_CONTRACT||created.approvedSha!==approvedSha||
    created.retryAuthorized!==false||created.versionUploadAttempts!==1||created.productionMutations!==1||
    created.identity?.creationSha!==identity?.creationSha||created.identity?.graphSha256!==identity?.graphSha256||
    created.identity?.metadataSha256!==identity?.metadataSha256||created.identity?.moduleCount!==17||
    !same(created.admission,admission)||created.deploymentMutations!==0||created.d1Mutations!==0||
    created.workersDevMutations!==0||created.previewMutations!==0||created.cronMutations!==0||
    created.routeMutations!==0||created.domainMutations!==0||created.workerInvocations!==0||
    created.apiFootballRequests!==0||created.secretValuesSerialized!==0||
    !['CREATED','APPLIED_CONFIRMED_BY_READBACK'].includes(created.outcome)||
    !uuid(created.versionId)||!ids(versions?.versionIds,[...CORRECTED_HISTORICAL_VERSION_IDS,created.versionId])||
    !versions?.identityExact)return stop('version_creation_unproven');
  // Missing stable/beta evidence is incomplete evidence, never reported as a byte or metadata mismatch.
  if(!versions.candidate?.stable||!versions.candidate?.beta||typeof versions.candidate.stable!=='object'||typeof versions.candidate.beta!=='object')
    return stop('corrected_version_evidence_unavailable');
  try{validateCorrectedVersion({stable:versions.candidate?.stable,beta:versions.candidate?.beta,versionId:created.versionId,identity});}
  catch(error){
    // Aggregate prefix is unchanged; the suffix is one closed token from CORRECTED_VERSION_FAILURE_REASONS, else omitted.
    const token=String(error?.message).split('__')[1];
    return stop('corrected_version_byte_or_metadata_drift'+(CORRECTED_VERSION_FAILURE_REASONS.includes(token)?':'+token:''));
  }
  return frozen({ok:true,version:CORRECTED_RECONCILIATION_CONTRACT,classification:CORRECTED_PREPARED,
    createdVersionId:created.versionId,graphSha256:identity.graphSha256,metadataSha256:identity.metadataSha256,
    retryAuthorized:false,evidence:frozen({deploymentMutations:0,d1Mutations:0,apiFootballRequests:0,workerInvocations:0})});
}
