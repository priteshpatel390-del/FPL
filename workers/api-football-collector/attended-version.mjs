import {createHash} from 'node:crypto';
import {
  ATTENDED_ACTIVATION,ATTENDED_SECRET_BINDINGS,ENTRY_MODULE,EXPECTED_BINDING_NAME,EXPECTED_COMPATIBILITY_DATE,
  EXPECTED_PLAIN_TEXT_VARS,REVIEWED_MODULE_PATHS,WORKER_NAME,buildUploadModules,performVersionUpload,resolveModuleGraph
} from './stage-inactive-version.mjs';
import {EXPECTED_D1_DATABASE_ID} from '../data-platform/phase4b/live-contract.mjs';

export const ORIGINAL_BLOCKED_VERSION_ID='e49ac8f2-4289-46bc-9f0b-87a20cd7be62';
export const ORIGINAL_BLOCKED_VERSION_ACTIVATION='REPOSITORY_ONLY_BLOCKED';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX40=/^[0-9a-f]{40}$/;
const sha256=value=>createHash('sha256').update(value).digest('hex');
const fail=code=>{throw new Error(code);};

export function expectedAttendedBindings(){
  return Object.freeze([
    Object.freeze({name:EXPECTED_BINDING_NAME,type:'d1',database_id:EXPECTED_D1_DATABASE_ID}),
    Object.freeze({name:'API_FOOTBALL_FPL_SEASON',type:'plain_text',text:EXPECTED_PLAIN_TEXT_VARS.API_FOOTBALL_FPL_SEASON}),
    Object.freeze({name:'API_FOOTBALL_PROVIDER_SEASON',type:'plain_text',text:EXPECTED_PLAIN_TEXT_VARS.API_FOOTBALL_PROVIDER_SEASON}),
    Object.freeze({name:'EIA_2I5D_ACTIVATION',type:'plain_text',text:ATTENDED_ACTIVATION}),
    ...ATTENDED_SECRET_BINDINGS.map(name=>Object.freeze({name,type:'secret_text'}))
  ]);
}

export function buildReviewedAttendedIdentity(approvedSha,{readFile}={}){
  if(!HEX40.test(String(approvedSha||'')))fail('collector_attended_approved_sha_invalid');
  const modules=buildUploadModules(resolveModuleGraph(readFile?{readFile}:{}));
  return Object.freeze({
    approvedSha,mainModule:ENTRY_MODULE,compatibilityDate:EXPECTED_COMPATIBILITY_DATE,
    message:'API-Football attended acceptance from '+approvedSha,
    tag:'api-football-attended-'+approvedSha.slice(0,12),
    moduleSha256:Object.freeze(Object.fromEntries([...modules].map(([name,source])=>[name,sha256(source)])))
  });
}

function exactBindings(rows,expected){
  if(!Array.isArray(rows)||rows.length!==expected.length)return false;
  const actual=new Map();for(const row of rows){if(!row||actual.has(row.name))return false;actual.set(row.name,row);}
  return expected.every(binding=>{
    const row=actual.get(binding.name);if(!row||row.type!==binding.type)return false;
    if(binding.type==='d1')return row.database_id===binding.database_id;
    if(binding.type==='plain_text')return String(row.text)===String(binding.text);
    return binding.type==='secret_text'&&!Object.hasOwn(row,'text');
  });
}

export function validateReviewedAttendedVersion({stableVersion,betaVersion,versionId,identity}={}){
  if(!UUID.test(String(versionId||''))||stableVersion?.id!==versionId||betaVersion?.id!==versionId)return fail('collector_attended_version_identity_drift');
  if(!identity||!HEX40.test(String(identity.approvedSha||'')))return fail('collector_attended_review_identity_invalid');
  if(stableVersion.resources?.script_runtime?.compatibility_date!==identity.compatibilityDate)return fail('collector_attended_runtime_drift');
  if(!exactBindings(stableVersion.resources?.bindings,expectedAttendedBindings()))return fail('collector_attended_binding_drift');
  if(betaVersion.main_module!==identity.mainModule||betaVersion.compatibility_date!==identity.compatibilityDate)return fail('collector_attended_runtime_drift');
  if(betaVersion.annotations?.['workers/message']!==identity.message||betaVersion.annotations?.['workers/tag']!==identity.tag)return fail('collector_attended_annotation_drift');
  if(!Array.isArray(betaVersion.modules)||betaVersion.modules.length!==Object.keys(identity.moduleSha256).length)return fail('collector_attended_module_set_drift');
  const seen=new Set();for(const module of betaVersion.modules){
    if(!module||typeof module.name!=='string'||seen.has(module.name)||typeof module.content_base64!=='string'||!identity.moduleSha256[module.name])return fail('collector_attended_module_set_drift');
    if(sha256(Buffer.from(module.content_base64,'base64'))!==identity.moduleSha256[module.name])return fail('collector_attended_module_content_drift');
    seen.add(module.name);
  }
  if(seen.size!==REVIEWED_MODULE_PATHS.length)return fail('collector_attended_module_set_drift');
  return true;
}

export function validateClosedVersionInventory({versionIds,originalStable,attendedVersionId,attendedStable,attendedBeta,identity}={}){
  if(!Array.isArray(versionIds)||versionIds.length!==2||new Set(versionIds).size!==2||
    !versionIds.includes(ORIGINAL_BLOCKED_VERSION_ID)||!versionIds.includes(attendedVersionId))fail('collector_attended_version_inventory_drift');
  const originalBindings=originalStable?.resources?.bindings,expectedOriginal=expectedAttendedBindings().slice(0,4).map(binding=>binding.name==='EIA_2I5D_ACTIVATION'?{...binding,text:ORIGINAL_BLOCKED_VERSION_ACTIVATION}:binding);
  if(originalStable?.id!==ORIGINAL_BLOCKED_VERSION_ID||!exactBindings(originalBindings,expectedOriginal))fail('collector_attended_original_version_not_inert');
  validateReviewedAttendedVersion({stableVersion:attendedStable,betaVersion:attendedBeta,versionId:attendedVersionId,identity});
  return true;
}

export function deriveVersionPreviewUrl({versionId,previewUrlSuffix,accountSubdomain,path}={}){
  if(!UUID.test(String(versionId||''))||typeof previewUrlSuffix!=='string'||typeof accountSubdomain!=='string'||!/^[a-z0-9-]+$/.test(accountSubdomain))fail('collector_attended_preview_identity_invalid');
  const expectedSuffix='-'+WORKER_NAME+'.'+accountSubdomain+'.workers.dev';
  if(previewUrlSuffix!==expectedSuffix||previewUrlSuffix.includes('/')||previewUrlSuffix.includes('@')||previewUrlSuffix.includes(':'))fail('collector_attended_preview_identity_invalid');
  if(typeof path!=='string'||!path.startsWith('/')||path.includes('?')||path.includes('#'))fail('collector_attended_preview_identity_invalid');
  const url=new URL('https://'+versionId.slice(0,8)+previewUrlSuffix+path);
  if(url.protocol!=='https:'||url.port||url.username||url.password||url.search||url.hash||url.pathname!==path||url.hostname!==versionId.slice(0,8)+previewUrlSuffix)return fail('collector_attended_preview_identity_invalid');
  return url;
}

export function buildAttendedVersionUploadMetadata(approvedSha,{apiKey,triggerSecret}={}){
  const identity=buildReviewedAttendedIdentity(approvedSha);
  if(typeof apiKey!=='string'||!apiKey||typeof triggerSecret!=='string'||triggerSecret.length<32)fail('collector_attended_secret_material_invalid');
  return {
    main_module:ENTRY_MODULE,compatibility_date:EXPECTED_COMPATIBILITY_DATE,
    bindings:expectedAttendedBindings().map(binding=>binding.type==='secret_text'?{...binding,text:binding.name==='API_FOOTBALL_API_KEY'?apiKey:triggerSecret}:{...binding}),
    annotations:{'workers/message':identity.message,'workers/tag':identity.tag}
  };
}

export function buildAttendedVersionUploadForm(approvedSha,secrets,{readFile}={}){
  const metadata=buildAttendedVersionUploadMetadata(approvedSha,secrets),modules=buildUploadModules(resolveModuleGraph(readFile?{readFile}:{}));
  const form=new FormData();form.set('metadata',JSON.stringify(metadata));
  for(const [name,source] of [...modules].sort(([a],[b])=>a.localeCompare(b)))form.set(name,new File([source],name,{type:'application/javascript+module'}));
  return form;
}

export async function prepareFinalAttendedVersion({request,readVersions,accountId,approvedSha,secrets,beforeIds=[ORIGINAL_BLOCKED_VERSION_ID]}={}){
  if(!Array.isArray(beforeIds)||beforeIds.length!==1||beforeIds[0]!==ORIGINAL_BLOCKED_VERSION_ID)fail('collector_attended_preparation_inventory_invalid');
  const result=await performVersionUpload({request,readVersions,accountId,multipart:buildAttendedVersionUploadForm(approvedSha,secrets),beforeIds});
  if(result.disposition!=='definite')fail('collector_attended_preparation_ambiguous_reconciliation_required_no_retry');
  if(result.versionId===ORIGINAL_BLOCKED_VERSION_ID||result.afterIds.length!==2||!result.afterIds.includes(ORIGINAL_BLOCKED_VERSION_ID))fail('collector_attended_preparation_version_delta_invalid');
  return result;
}
